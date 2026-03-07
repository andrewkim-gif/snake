package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/blockchain"
)

// ============================================================
// v14 Phase 9 — S41: Token Economy Integration
// Domination rewards: country token proportional to nation score
// Hegemony rewards: weekly AWW token bonus
// Reuses v11 blockchain infra (Defense Oracle, Buyback Engine)
// Reward events → CROSSx wallet (via existing UI)
// ============================================================

// Token reward constants
const (
	// DominationTokenBaseRate is base country tokens per nation score point.
	DominationTokenBaseRate = 0.01 // 0.01 tokens per point

	// DominationTokenMinPayout is the minimum country token payout per evaluation.
	DominationTokenMinPayout = 1.0

	// DominationTokenMaxPayout is the maximum country token payout per evaluation.
	DominationTokenMaxPayout = 1000.0

	// HegemonyWeeklyAWWBonus is the weekly AWW token bonus for hegemony nations.
	HegemonyWeeklyAWWBonus = 100.0

	// HegemonyMemberBonusRate is the AWW token bonus per player in hegemony nation.
	HegemonyMemberBonusRate = 10.0

	// SovereigntyDailyBonus is the daily country token bonus for sovereignty.
	SovereigntyDailyBonus = 5.0

	// MVPBonusMultiplier is the token bonus multiplier for epoch MVPs.
	MVPBonusMultiplier = 1.5

	// TopThreeBonusMultiplier is the token bonus multiplier for top 3 players.
	TopThreeBonusMultiplier = 1.25

	// MinAccountLevelForTokens is the minimum account level to receive token rewards.
	MinAccountLevelForTokens = 3
)

// ============================================================
// Token Reward Event Types
// ============================================================

// TokenRewardType classifies the type of token reward.
type TokenRewardType string

const (
	TokenRewardDomination  TokenRewardType = "domination"
	TokenRewardHegemony    TokenRewardType = "hegemony"
	TokenRewardSovereignty TokenRewardType = "sovereignty"
	TokenRewardEpochMVP    TokenRewardType = "epoch_mvp"
	TokenRewardWarVictory  TokenRewardType = "war_victory"
)

// TokenRewardEvent represents a single token reward event.
type TokenRewardEvent struct {
	ID           string          `json:"id"`
	PlayerID     string          `json:"playerId"`
	PlayerName   string          `json:"playerName"`
	RewardType   TokenRewardType `json:"rewardType"`
	TokenType    string          `json:"tokenType"`    // "country" (ISO3) or "AWW"
	CountryCode  string          `json:"countryCode"`  // for country tokens
	Amount       float64         `json:"amount"`
	Reason       string          `json:"reason"`
	NationScore  int             `json:"nationScore,omitempty"`
	Timestamp    int64           `json:"timestamp"`
	TxHash       string          `json:"txHash,omitempty"` // blockchain tx hash (if on-chain)
	Pending      bool            `json:"pending"`           // true if awaiting on-chain confirmation
}

// ============================================================
// Token Reward Calculator
// ============================================================

// DominationRewardInput holds inputs for calculating domination token rewards.
type DominationRewardInput struct {
	CountryCode     string
	DominantNation  string
	NationScores    map[string]int // nationality → total score
	PlayerScores    map[string]*PlayerEpochStats // playerID → epoch stats
	IsSovereignty   bool
	IsHegemony      bool
}

// PlayerTokenReward holds the computed token reward for a single player.
type PlayerTokenReward struct {
	PlayerID    string  `json:"playerId"`
	PlayerName  string  `json:"playerName"`
	Nationality string  `json:"nationality"`
	BaseAmount  float64 `json:"baseAmount"`
	Multiplier  float64 `json:"multiplier"`
	FinalAmount float64 `json:"finalAmount"`
	TokenType   string  `json:"tokenType"`
	Reason      string  `json:"reason"`
}

// CalcDominationRewards computes token rewards for all players in a domination evaluation.
func CalcDominationRewards(input *DominationRewardInput) []PlayerTokenReward {
	if input.DominantNation == "" {
		return nil
	}

	var rewards []PlayerTokenReward

	// Get total nation score for the dominant nation
	dominantScore := input.NationScores[input.DominantNation]
	if dominantScore <= 0 {
		return nil
	}

	for _, stats := range input.PlayerScores {
		// Only reward players of the dominant nation
		if stats.Nationality != input.DominantNation {
			continue
		}

		// Calculate player's share based on their contribution
		playerContribution := float64(stats.NationScore) / float64(dominantScore)
		baseAmount := float64(dominantScore) * DominationTokenBaseRate * playerContribution

		// Apply multipliers
		multiplier := 1.0

		// MVP bonus
		if stats.NationScore > 0 {
			// Sovereignty bonus
			if input.IsSovereignty {
				multiplier += 0.20 // +20% for sovereignty
			}
			// Hegemony bonus
			if input.IsHegemony {
				multiplier += 0.50 // +50% for hegemony
			}
		}

		finalAmount := baseAmount * multiplier

		// Clamp
		if finalAmount < DominationTokenMinPayout {
			finalAmount = DominationTokenMinPayout
		}
		if finalAmount > DominationTokenMaxPayout {
			finalAmount = DominationTokenMaxPayout
		}

		reason := fmt.Sprintf("Domination reward for %s in %s (score: %d)", input.DominantNation, input.CountryCode, stats.NationScore)
		rewards = append(rewards, PlayerTokenReward{
			PlayerID:    stats.ID,
			PlayerName:  stats.Name,
			Nationality: stats.Nationality,
			BaseAmount:  baseAmount,
			Multiplier:  multiplier,
			FinalAmount: finalAmount,
			TokenType:   input.CountryCode, // country token
			Reason:      reason,
		})
	}

	return rewards
}

// CalcHegemonyWeeklyRewards computes the weekly AWW token bonus for hegemony players.
func CalcHegemonyWeeklyRewards(playerIDs []string, playerNames map[string]string) []PlayerTokenReward {
	if len(playerIDs) == 0 {
		return nil
	}

	var rewards []PlayerTokenReward
	perPlayerBonus := HegemonyWeeklyAWWBonus/float64(len(playerIDs)) + HegemonyMemberBonusRate

	for _, pid := range playerIDs {
		name := playerNames[pid]
		if name == "" {
			name = pid
		}
		rewards = append(rewards, PlayerTokenReward{
			PlayerID:    pid,
			PlayerName:  name,
			BaseAmount:  perPlayerBonus,
			Multiplier:  1.0,
			FinalAmount: perPlayerBonus,
			TokenType:   "AWW",
			Reason:      "Weekly hegemony AWW bonus",
		})
	}

	return rewards
}

// ============================================================
// TokenRewardManager — orchestrates token rewards with blockchain
// ============================================================

// TokenRewardManager manages token reward distribution.
type TokenRewardManager struct {
	mu sync.RWMutex

	// Pending rewards (awaiting distribution)
	pendingRewards []TokenRewardEvent

	// Distributed rewards (history)
	distributedRewards []TokenRewardEvent

	// v11 blockchain infrastructure references
	buybackEngine  *blockchain.BuybackEngine
	defenseOracle  *blockchain.DefenseOracle

	// Event callback (for S→C wallet notification)
	OnRewardDistributed func(event TokenRewardEvent)

	// Counter for unique IDs
	counter int

	// Max history size
	maxHistory int
}

// NewTokenRewardManager creates a new token reward manager.
func NewTokenRewardManager(buyback *blockchain.BuybackEngine, oracle *blockchain.DefenseOracle) *TokenRewardManager {
	return &TokenRewardManager{
		pendingRewards:     make([]TokenRewardEvent, 0),
		distributedRewards: make([]TokenRewardEvent, 0, 1000),
		buybackEngine:      buyback,
		defenseOracle:      oracle,
		maxHistory:         10000,
	}
}

// QueueDominationRewards queues domination token rewards for distribution.
func (trm *TokenRewardManager) QueueDominationRewards(input *DominationRewardInput, accountMgr *AccountLevelManager) {
	rewards := CalcDominationRewards(input)
	if len(rewards) == 0 {
		return
	}

	trm.mu.Lock()
	defer trm.mu.Unlock()

	now := time.Now().UnixMilli()

	for _, r := range rewards {
		// Check minimum account level
		if accountMgr != nil {
			prof := accountMgr.GetProfileReadOnly(r.PlayerID)
			if prof != nil && prof.AccountLevel < MinAccountLevelForTokens {
				continue
			}
		}

		trm.counter++
		event := TokenRewardEvent{
			ID:          fmt.Sprintf("tr_%d_%d", now, trm.counter),
			PlayerID:    r.PlayerID,
			PlayerName:  r.PlayerName,
			RewardType:  TokenRewardDomination,
			TokenType:   r.TokenType,
			CountryCode: input.CountryCode,
			Amount:      r.FinalAmount,
			Reason:      r.Reason,
			Timestamp:   now,
			Pending:     true,
		}
		trm.pendingRewards = append(trm.pendingRewards, event)

		slog.Info("domination token reward queued",
			"playerId", r.PlayerID,
			"amount", r.FinalAmount,
			"tokenType", r.TokenType,
			"country", input.CountryCode,
		)
	}
}

// QueueHegemonyRewards queues weekly hegemony AWW token rewards.
func (trm *TokenRewardManager) QueueHegemonyRewards(playerIDs []string, playerNames map[string]string) {
	rewards := CalcHegemonyWeeklyRewards(playerIDs, playerNames)
	if len(rewards) == 0 {
		return
	}

	trm.mu.Lock()
	defer trm.mu.Unlock()

	now := time.Now().UnixMilli()

	for _, r := range rewards {
		trm.counter++
		event := TokenRewardEvent{
			ID:         fmt.Sprintf("tr_%d_%d", now, trm.counter),
			PlayerID:   r.PlayerID,
			PlayerName: r.PlayerName,
			RewardType: TokenRewardHegemony,
			TokenType:  "AWW",
			Amount:     r.FinalAmount,
			Reason:     r.Reason,
			Timestamp:  now,
			Pending:    true,
		}
		trm.pendingRewards = append(trm.pendingRewards, event)

		slog.Info("hegemony token reward queued",
			"playerId", r.PlayerID,
			"amount", r.FinalAmount,
		)
	}
}

// QueueSovereigntyReward queues a daily sovereignty bonus for a player.
func (trm *TokenRewardManager) QueueSovereigntyReward(playerID, playerName, countryCode string) {
	trm.mu.Lock()
	defer trm.mu.Unlock()

	now := time.Now().UnixMilli()
	trm.counter++

	event := TokenRewardEvent{
		ID:          fmt.Sprintf("tr_%d_%d", now, trm.counter),
		PlayerID:    playerID,
		PlayerName:  playerName,
		RewardType:  TokenRewardSovereignty,
		TokenType:   countryCode,
		CountryCode: countryCode,
		Amount:      SovereigntyDailyBonus,
		Reason:      fmt.Sprintf("Daily sovereignty bonus for %s", countryCode),
		Timestamp:   now,
		Pending:     true,
	}
	trm.pendingRewards = append(trm.pendingRewards, event)
}

// QueueWarVictoryReward queues a war victory token reward.
func (trm *TokenRewardManager) QueueWarVictoryReward(playerID, playerName, countryCode string, warScore int) {
	trm.mu.Lock()
	defer trm.mu.Unlock()

	now := time.Now().UnixMilli()
	trm.counter++

	amount := float64(warScore) * DominationTokenBaseRate * 2.0 // 2x multiplier for war
	if amount < DominationTokenMinPayout {
		amount = DominationTokenMinPayout
	}
	if amount > DominationTokenMaxPayout {
		amount = DominationTokenMaxPayout
	}

	event := TokenRewardEvent{
		ID:          fmt.Sprintf("tr_%d_%d", now, trm.counter),
		PlayerID:    playerID,
		PlayerName:  playerName,
		RewardType:  TokenRewardWarVictory,
		TokenType:   countryCode,
		CountryCode: countryCode,
		Amount:      amount,
		Reason:      fmt.Sprintf("War victory reward in %s (score: %d)", countryCode, warScore),
		Timestamp:   now,
		Pending:     true,
	}
	trm.pendingRewards = append(trm.pendingRewards, event)
}

// DistributePendingRewards processes all pending rewards.
// Attempts on-chain distribution via BuybackEngine, falls back to local recording.
// Returns the number of rewards distributed.
func (trm *TokenRewardManager) DistributePendingRewards() int {
	trm.mu.Lock()
	pending := make([]TokenRewardEvent, len(trm.pendingRewards))
	copy(pending, trm.pendingRewards)
	trm.pendingRewards = trm.pendingRewards[:0]
	trm.mu.Unlock()

	if len(pending) == 0 {
		return 0
	}

	distributed := 0

	for i := range pending {
		event := &pending[i]
		event.Pending = false

		// Attempt blockchain distribution for country tokens via buyback
		if event.TokenType != "AWW" && trm.buybackEngine != nil {
			// Feed into buyback engine's economic tick
			// The buyback engine will handle the actual DEX purchase
			trm.buybackEngine.ProcessEconomicTick(event.CountryCode, event.Amount)
		}

		// Record distribution
		trm.mu.Lock()
		trm.distributedRewards = append(trm.distributedRewards, *event)
		if len(trm.distributedRewards) > trm.maxHistory {
			trm.distributedRewards = trm.distributedRewards[len(trm.distributedRewards)-trm.maxHistory:]
		}
		trm.mu.Unlock()

		// Notify client (for CROSSx wallet UI)
		if trm.OnRewardDistributed != nil {
			trm.OnRewardDistributed(*event)
		}

		distributed++

		slog.Info("token reward distributed",
			"id", event.ID,
			"playerId", event.PlayerID,
			"type", event.RewardType,
			"token", event.TokenType,
			"amount", event.Amount,
		)
	}

	// Trigger buyback execution if we fed country tokens
	if trm.buybackEngine != nil {
		records := trm.buybackEngine.ExecutePendingBuybacks()
		if len(records) > 0 {
			slog.Info("buyback executed for token rewards",
				"count", len(records),
			)
		}
	}

	return distributed
}

// --- Getters ---

// GetPendingRewards returns the current pending rewards.
func (trm *TokenRewardManager) GetPendingRewards() []TokenRewardEvent {
	trm.mu.RLock()
	defer trm.mu.RUnlock()

	result := make([]TokenRewardEvent, len(trm.pendingRewards))
	copy(result, trm.pendingRewards)
	return result
}

// GetPlayerRewards returns recent rewards for a specific player.
func (trm *TokenRewardManager) GetPlayerRewards(playerID string, limit int) []TokenRewardEvent {
	trm.mu.RLock()
	defer trm.mu.RUnlock()

	var result []TokenRewardEvent
	// Search backwards (most recent first)
	for i := len(trm.distributedRewards) - 1; i >= 0 && len(result) < limit; i-- {
		if trm.distributedRewards[i].PlayerID == playerID {
			result = append(result, trm.distributedRewards[i])
		}
	}
	return result
}

// GetRecentRewards returns the N most recent distributed rewards.
func (trm *TokenRewardManager) GetRecentRewards(n int) []TokenRewardEvent {
	trm.mu.RLock()
	defer trm.mu.RUnlock()

	if n > len(trm.distributedRewards) {
		n = len(trm.distributedRewards)
	}
	if n <= 0 {
		return nil
	}

	start := len(trm.distributedRewards) - n
	result := make([]TokenRewardEvent, n)
	copy(result, trm.distributedRewards[start:])
	return result
}

// GetRewardStats returns aggregated reward statistics.
func (trm *TokenRewardManager) GetRewardStats() TokenRewardStats {
	trm.mu.RLock()
	defer trm.mu.RUnlock()

	stats := TokenRewardStats{
		PendingCount: len(trm.pendingRewards),
	}

	for _, r := range trm.distributedRewards {
		stats.TotalDistributed++
		stats.TotalAmount += r.Amount

		switch r.RewardType {
		case TokenRewardDomination:
			stats.DominationRewards++
		case TokenRewardHegemony:
			stats.HegemonyRewards++
		case TokenRewardSovereignty:
			stats.SovereigntyRewards++
		case TokenRewardWarVictory:
			stats.WarVictoryRewards++
		}

		if r.TokenType == "AWW" {
			stats.TotalAWWDistributed += r.Amount
		} else {
			stats.TotalCountryTokensDistributed += r.Amount
		}
	}

	return stats
}

// TokenRewardStats holds aggregated statistics.
type TokenRewardStats struct {
	PendingCount                int     `json:"pendingCount"`
	TotalDistributed            int     `json:"totalDistributed"`
	TotalAmount                 float64 `json:"totalAmount"`
	TotalAWWDistributed         float64 `json:"totalAwwDistributed"`
	TotalCountryTokensDistributed float64 `json:"totalCountryTokensDistributed"`
	DominationRewards           int     `json:"dominationRewards"`
	HegemonyRewards             int     `json:"hegemonyRewards"`
	SovereigntyRewards          int     `json:"sovereigntyRewards"`
	WarVictoryRewards           int     `json:"warVictoryRewards"`
}

// ============================================================
// Token Reward Snapshot (for client / CROSSx wallet)
// ============================================================

// TokenRewardSnapshot is the client-facing reward notification.
type TokenRewardSnapshot struct {
	RewardType  TokenRewardType `json:"rewardType"`
	TokenType   string          `json:"tokenType"`
	Amount      float64         `json:"amount"`
	Reason      string          `json:"reason"`
	Timestamp   int64           `json:"timestamp"`
}

// GetPlayerRewardSnapshot returns a snapshot of recent rewards for the client.
func (trm *TokenRewardManager) GetPlayerRewardSnapshot(playerID string, limit int) []TokenRewardSnapshot {
	rewards := trm.GetPlayerRewards(playerID, limit)
	snaps := make([]TokenRewardSnapshot, len(rewards))
	for i, r := range rewards {
		snaps[i] = TokenRewardSnapshot{
			RewardType: r.RewardType,
			TokenType:  r.TokenType,
			Amount:     r.Amount,
			Reason:     r.Reason,
			Timestamp:  r.Timestamp,
		}
	}
	return snaps
}

// ============================================================
// Integration with Defense Oracle (v11 reuse)
// ============================================================

// ApplyDefenseOracleToRewards adjusts token rewards based on the country's
// defense multiplier from the Defense Oracle. Higher market cap → higher defense
// → slightly reduced token issuance (anti-inflation).
func (trm *TokenRewardManager) ApplyDefenseOracleToRewards(countryCode string, rewards []PlayerTokenReward) {
	if trm.defenseOracle == nil {
		return
	}

	buff := trm.defenseOracle.ApplyDefenseBuff(countryCode)
	if buff <= 0 {
		return
	}

	// Higher defense = lower token issuance (anti-inflation)
	// defense 0.30 → issuance reduced by 15%
	issuanceMod := 1.0 - (buff * 0.5)
	if issuanceMod < 0.5 {
		issuanceMod = 0.5 // minimum 50% issuance
	}

	for i := range rewards {
		rewards[i].FinalAmount *= issuanceMod
	}
}
