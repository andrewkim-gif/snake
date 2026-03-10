package game

import (
	"fmt"
	"log/slog"
	"math"
	"sort"
	"sync"
)

// ============================================================
// v33 Phase 1 — EpochRewardCalculator: Computes per-player
// token rewards at epoch end based on Matrix score performance.
//
// Reward formula:
//   baseReward = playerScore × DominationTokenBaseRate (0.01)
//
// Multipliers (multiplicative):
//   × 2.0  — War victory (dominant nation)
//   × 1.5  — Epoch MVP (top scorer)
//   × 1.5  — Direct play (human, not agent)
//   × 1.25 — Top 3 player
//
// Sovereignty/Hegemony bonuses (additive to multiplier):
//   + 0.20 — Sovereignty (+20%)
//   + 0.50 — Hegemony (+50%)
//
// Population adjustment:
//   adjustedReward = reward / sqrt(nationPlayerCount)
//   if nationPlayerCount <= 5: ×1.3 underdog bonus
//
// Caps:
//   max: DominationTokenMaxPayout = 1000.0
//   daily: DailyPlayerRewardCap = 5000.0
//
// Integration: calls TokenRewardManager.QueueDominationRewards()
// ============================================================

// Epoch reward constants
const (
	// UnderdogPlayerThreshold is the max players for underdog bonus.
	UnderdogPlayerThreshold = 5

	// UnderdogBonusMultiplier is the bonus for small nations.
	UnderdogBonusMultiplier = 1.3

	// DirectPlayBonusMultiplier is the bonus for human players.
	DirectPlayBonusMultiplier = 1.5

	// WarVictoryMultiplier is the bonus for the dominant nation.
	WarVictoryMultiplier = 2.0

	// TopThreeCount is the number of top players who get bonus.
	TopThreeCount = 3
)

// MatrixRewardInput holds all inputs needed for reward calculation.
type MatrixRewardInput struct {
	Snapshot     *MatrixEpochSnapshot // epoch score snapshot
	CountryCode  string
	EpochNumber  int

	// Domination info
	DominantNation string // winning nation for this epoch (highest score)
	IsSovereignty  bool   // dominant nation has sovereignty
	IsHegemony     bool   // dominant nation has hegemony

	// Nation player counts for population adjustment
	NationPlayerCounts map[string]int
}

// MatrixRewardResult holds the computed rewards for all players.
type MatrixRewardResult struct {
	Rewards    []MatrixPlayerReward `json:"rewards"`
	MVP        *MatrixPlayerReward  `json:"mvp,omitempty"`
	TotalPaid  float64             `json:"totalPaid"`
}

// MatrixPlayerReward holds the computed reward for a single player.
type MatrixPlayerReward struct {
	PlayerID     string  `json:"playerId"`
	PlayerName   string  `json:"playerName"`
	Nationality  string  `json:"nationality"`
	RawScore     int     `json:"rawScore"`
	BaseAmount   float64 `json:"baseAmount"`
	Multiplier   float64 `json:"multiplier"`
	PopAdjust    float64 `json:"popAdjust"`
	FinalAmount  float64 `json:"finalAmount"`
	TokenType    string  `json:"tokenType"`  // country code or "AWW"
	IsMVP        bool    `json:"isMvp"`
	IsTopThree   bool    `json:"isTopThree"`
	IsDirectPlay bool    `json:"isDirectPlay"`
	Reason       string  `json:"reason"`
}

// EpochRewardCalculator computes token rewards at epoch end.
type EpochRewardCalculator struct {
	mu sync.RWMutex

	countryCode string

	// Statistics
	totalEpochsCalculated int
	totalRewardsIssued    int
	totalTokensIssued     float64
}

// NewEpochRewardCalculator creates a new reward calculator.
func NewEpochRewardCalculator(countryCode string) *EpochRewardCalculator {
	return &EpochRewardCalculator{
		countryCode: countryCode,
	}
}

// Calculate computes rewards for all players based on the epoch snapshot.
func (erc *EpochRewardCalculator) Calculate(input *MatrixRewardInput) *MatrixRewardResult {
	erc.mu.Lock()
	defer erc.mu.Unlock()

	if input.Snapshot == nil || len(input.Snapshot.PlayerScores) == 0 {
		return &MatrixRewardResult{}
	}

	erc.totalEpochsCalculated++

	// Sort players by score to determine MVP and top-3
	type scoredPlayer struct {
		ID    string
		Score int
	}
	sorted := make([]scoredPlayer, 0, len(input.Snapshot.PlayerScores))
	for id, ps := range input.Snapshot.PlayerScores {
		sorted = append(sorted, scoredPlayer{ID: id, Score: ps.TotalScore})
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Score > sorted[j].Score
	})

	// Build rank map and identify MVP/top-3
	rankMap := make(map[string]int, len(sorted))
	for i, sp := range sorted {
		rankMap[sp.ID] = i + 1
	}

	mvpID := ""
	if len(sorted) > 0 {
		mvpID = sorted[0].ID
	}

	topThreeIDs := make(map[string]bool)
	for i := 0; i < TopThreeCount && i < len(sorted); i++ {
		topThreeIDs[sorted[i].ID] = true
	}

	// Calculate rewards for each player
	rewards := make([]MatrixPlayerReward, 0, len(input.Snapshot.PlayerScores))

	for _, ps := range input.Snapshot.PlayerScores {
		if ps.TotalScore <= 0 {
			continue
		}

		// Base reward: score × DominationTokenBaseRate
		baseAmount := float64(ps.TotalScore) * DominationTokenBaseRate

		// Calculate multiplier
		multiplier := 1.0

		// War victory bonus: dominant nation gets 2x
		isDominant := ps.Nationality == input.DominantNation && input.DominantNation != ""
		if isDominant {
			multiplier *= WarVictoryMultiplier
		}

		// MVP bonus
		isMVP := ps.PlayerID == mvpID
		if isMVP {
			multiplier *= MVPBonusMultiplier
		}

		// Direct play bonus (human, not agent)
		if ps.IsDirectPlay && !ps.IsAgent {
			multiplier *= DirectPlayBonusMultiplier
		}

		// Top-3 bonus
		isTopThree := topThreeIDs[ps.PlayerID]
		if isTopThree && !isMVP { // MVP already gets its own bonus
			multiplier *= TopThreeBonusMultiplier
		}

		// Sovereignty/Hegemony bonuses (additive to multiplier)
		if isDominant && input.IsSovereignty {
			multiplier += 0.20
		}
		if isDominant && input.IsHegemony {
			multiplier += 0.50
		}

		// Apply multiplier
		reward := baseAmount * multiplier

		// Population adjustment: reward / sqrt(nationPlayerCount)
		popAdjust := 1.0
		nationCount := 1
		if input.NationPlayerCounts != nil {
			if count, ok := input.NationPlayerCounts[ps.Nationality]; ok && count > 0 {
				nationCount = count
			}
		}
		if nationCount > 1 {
			popAdjust = 1.0 / math.Sqrt(float64(nationCount))
		}

		// Underdog bonus for small nations
		if nationCount <= UnderdogPlayerThreshold {
			popAdjust *= UnderdogBonusMultiplier
		}

		finalAmount := reward * popAdjust

		// Clamp to min/max
		if finalAmount < DominationTokenMinPayout {
			finalAmount = DominationTokenMinPayout
		}
		if finalAmount > DominationTokenMaxPayout {
			finalAmount = DominationTokenMaxPayout
		}

		reason := fmt.Sprintf("Matrix epoch %d reward in %s (score: %d, rank: %d)",
			input.EpochNumber, input.CountryCode, ps.TotalScore, rankMap[ps.PlayerID])

		playerReward := MatrixPlayerReward{
			PlayerID:     ps.PlayerID,
			PlayerName:   ps.Name,
			Nationality:  ps.Nationality,
			RawScore:     ps.TotalScore,
			BaseAmount:   baseAmount,
			Multiplier:   multiplier,
			PopAdjust:    popAdjust,
			FinalAmount:  finalAmount,
			TokenType:    input.CountryCode, // country token
			IsMVP:        isMVP,
			IsTopThree:   isTopThree,
			IsDirectPlay: ps.IsDirectPlay,
			Reason:       reason,
		}

		rewards = append(rewards, playerReward)
	}

	// Sort rewards by final amount descending
	sort.Slice(rewards, func(i, j int) bool {
		return rewards[i].FinalAmount > rewards[j].FinalAmount
	})

	// Build result
	result := &MatrixRewardResult{
		Rewards: rewards,
	}

	for i := range rewards {
		result.TotalPaid += rewards[i].FinalAmount
		if rewards[i].IsMVP {
			mvpCopy := rewards[i]
			result.MVP = &mvpCopy
		}
	}

	erc.totalRewardsIssued += len(rewards)
	erc.totalTokensIssued += result.TotalPaid

	slog.Info("matrix epoch rewards calculated",
		"country", input.CountryCode,
		"epoch", input.EpochNumber,
		"players", len(rewards),
		"totalTokens", result.TotalPaid,
		"dominant", input.DominantNation,
	)

	return result
}

// ToTokenRewardEvents converts MatrixPlayerReward slices to TokenRewardEvent format
// for integration with the existing TokenRewardManager.
func (erc *EpochRewardCalculator) ToTokenRewardEvents(rewards []MatrixPlayerReward, countryCode string) []PlayerTokenReward {
	result := make([]PlayerTokenReward, 0, len(rewards))
	for _, r := range rewards {
		result = append(result, PlayerTokenReward{
			PlayerID:    r.PlayerID,
			PlayerName:  r.PlayerName,
			Nationality: r.Nationality,
			BaseAmount:  r.BaseAmount,
			Multiplier:  r.Multiplier,
			FinalAmount: r.FinalAmount,
			TokenType:   r.TokenType,
			Reason:      r.Reason,
		})
	}
	return result
}

// GetStats returns calculation statistics.
func (erc *EpochRewardCalculator) GetStats() (epochs, rewards int, tokens float64) {
	erc.mu.RLock()
	defer erc.mu.RUnlock()
	return erc.totalEpochsCalculated, erc.totalRewardsIssued, erc.totalTokensIssued
}

// Reset clears all calculator state.
func (erc *EpochRewardCalculator) Reset() {
	erc.mu.Lock()
	defer erc.mu.Unlock()

	erc.totalEpochsCalculated = 0
	erc.totalRewardsIssued = 0
	erc.totalTokensIssued = 0
}
