package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v33 Phase 6 — Matrix Token Economy Integration
//
// 1. QueueMatrixEpochRewards: bridges EpochRewardCalculator →
//    TokenRewardManager with daily cap & DefenseOracle issuanceMod.
// 2. TokenBalanceCache: 5-min in-memory cache of on-chain balances.
// 3. RewardHistory: in-memory store for recent reward events.
// ============================================================

// ──────────────────────────────────────────────────────────────
// 1. QueueMatrixEpochRewards — epoch end → queue for distribution
// ──────────────────────────────────────────────────────────────

// QueueMatrixEpochRewards converts MatrixPlayerReward slices into
// TokenRewardEvents and queues them through the existing
// TokenRewardManager pipeline.
//
// Flow:
//   OnlineMatrixEngine.OnEpochEnd()
//     → EpochRewardCalculator.Calculate()
//     → QueueMatrixEpochRewards()
//       1. Apply DefenseOracle issuanceMod (anti-inflation)
//       2. Check daily cap per player (5,000 tokens/player/day)
//       3. FIFO eviction if pending > MaxPendingRewards (1,000)
//       4. Queue as TokenRewardEvent
func (trm *TokenRewardManager) QueueMatrixEpochRewards(
	rewards []MatrixPlayerReward,
	countryCode string,
	epochNumber int,
) int {
	if len(rewards) == 0 {
		return 0
	}

	// Step 1: Apply DefenseOracle issuanceMod
	// issuanceMod = 1.0 - (defenseBuff * 0.5), floor 0.5
	issuanceMod := 1.0
	if trm.defenseOracle != nil {
		defBuff := trm.defenseOracle.ApplyDefenseBuff(countryCode)
		if defBuff > 0 {
			issuanceMod = 1.0 - (defBuff * 0.5)
			if issuanceMod < 0.5 {
				issuanceMod = 0.5
			}
		}
	}

	trm.mu.Lock()
	defer trm.mu.Unlock()

	now := time.Now().UnixMilli()
	queued := 0

	for _, r := range rewards {
		// Apply issuanceMod to the reward
		adjustedAmount := r.FinalAmount * issuanceMod
		if adjustedAmount < DominationTokenMinPayout {
			adjustedAmount = DominationTokenMinPayout
		}
		if adjustedAmount > DominationTokenMaxPayout {
			adjustedAmount = DominationTokenMaxPayout
		}

		// Step 2: Daily cap check (5,000 tokens/player/day)
		if !trm.checkDailyCap(r.PlayerID, adjustedAmount) {
			slog.Info("matrix reward capped by daily limit",
				"playerId", r.PlayerID,
				"amount", adjustedAmount,
				"epoch", epochNumber,
			)
			continue
		}

		// Step 3: FIFO eviction if pending queue full
		if len(trm.pendingRewards) >= MaxPendingRewards {
			slog.Warn("pending rewards queue full, dropping oldest (matrix)",
				"size", len(trm.pendingRewards),
				"playerId", r.PlayerID,
			)
			trm.pendingRewards = trm.pendingRewards[1:]
		}

		// Step 4: Queue as TokenRewardEvent
		trm.counter++
		event := TokenRewardEvent{
			ID:          fmt.Sprintf("mx_%d_%d", now, trm.counter),
			PlayerID:    r.PlayerID,
			PlayerName:  r.PlayerName,
			RewardType:  TokenRewardDomination,
			TokenType:   r.TokenType,
			CountryCode: countryCode,
			Amount:      adjustedAmount,
			Reason:      r.Reason,
			NationScore: r.RawScore,
			Timestamp:   now,
			Pending:     true,
		}
		trm.pendingRewards = append(trm.pendingRewards, event)
		queued++
	}

	slog.Info("matrix epoch rewards queued",
		"country", countryCode,
		"epoch", epochNumber,
		"queued", queued,
		"total", len(rewards),
		"issuanceMod", issuanceMod,
	)

	return queued
}

// GetDailyRemaining returns the remaining daily reward capacity for a player.
func (trm *TokenRewardManager) GetDailyRemaining(playerID string) float64 {
	trm.mu.RLock()
	defer trm.mu.RUnlock()

	today := time.Now().Format("2006-01-02")
	if trm.dailyResetDate != today {
		return DailyPlayerRewardCap
	}
	current := trm.dailyRewards[playerID]
	remaining := DailyPlayerRewardCap - current
	if remaining < 0 {
		remaining = 0
	}
	return remaining
}

// ──────────────────────────────────────────────────────────────
// 2. TokenBalanceCache — 5-min in-memory cache of token balances
// ──────────────────────────────────────────────────────────────

// TokenBalanceCacheTTL is the cache time-to-live.
const TokenBalanceCacheTTL = 5 * time.Minute

// TokenBalanceCacheEntry holds a cached balance with expiry.
type TokenBalanceCacheEntry struct {
	Balance   float64
	FetchedAt time.Time
}

// TokenBalanceCache provides an in-memory cache of on-chain token balances.
// Polls the blockchain every 5 minutes and caches results.
type TokenBalanceCache struct {
	mu      sync.RWMutex
	entries map[string]*TokenBalanceCacheEntry // playerID → entry

	// Fallback: PlayerAWWBalance for simulation mode
	awwBalance *PlayerAWWBalance

	// Stop channel
	stopChan chan struct{}
}

// NewTokenBalanceCache creates a new balance cache.
func NewTokenBalanceCache(awwBalance *PlayerAWWBalance) *TokenBalanceCache {
	return &TokenBalanceCache{
		entries:    make(map[string]*TokenBalanceCacheEntry),
		awwBalance: awwBalance,
		stopChan:   make(chan struct{}),
	}
}

// GetBalance returns the cached balance for a player.
// Falls back to PlayerAWWBalance if not cached.
func (c *TokenBalanceCache) GetBalance(playerID string) float64 {
	c.mu.RLock()
	entry, ok := c.entries[playerID]
	c.mu.RUnlock()

	if ok && time.Since(entry.FetchedAt) < TokenBalanceCacheTTL {
		return entry.Balance
	}

	// Fallback to in-memory AWW balance
	if c.awwBalance != nil {
		return c.awwBalance.GetBalance(playerID)
	}
	return 0
}

// SetBalance updates the cached balance for a player.
func (c *TokenBalanceCache) SetBalance(playerID string, balance float64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[playerID] = &TokenBalanceCacheEntry{
		Balance:   balance,
		FetchedAt: time.Now(),
	}
}

// InvalidatePlayer removes a player's cached balance.
func (c *TokenBalanceCache) InvalidatePlayer(playerID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, playerID)
}

// RefreshFromAWWBalance syncs all known players from the AWW balance store.
// Called periodically (every 5 minutes) by the polling loop.
func (c *TokenBalanceCache) RefreshFromAWWBalance() {
	if c.awwBalance == nil {
		return
	}

	// PlayerAWWBalance doesn't expose iteration, so we refresh
	// entries we already know about.
	c.mu.RLock()
	playerIDs := make([]string, 0, len(c.entries))
	for pid := range c.entries {
		playerIDs = append(playerIDs, pid)
	}
	c.mu.RUnlock()

	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, pid := range playerIDs {
		balance := c.awwBalance.GetBalance(pid)
		c.entries[pid] = &TokenBalanceCacheEntry{
			Balance:   balance,
			FetchedAt: now,
		}
	}
}

// StartPolling begins the 5-minute refresh loop.
func (c *TokenBalanceCache) StartPolling() {
	go func() {
		ticker := time.NewTicker(TokenBalanceCacheTTL)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				c.RefreshFromAWWBalance()
			case <-c.stopChan:
				return
			}
		}
	}()

	slog.Info("token balance cache polling started",
		"interval", TokenBalanceCacheTTL,
	)
}

// StopPolling stops the polling loop.
func (c *TokenBalanceCache) StopPolling() {
	select {
	case <-c.stopChan:
		// already closed
	default:
		close(c.stopChan)
	}
}

// ──────────────────────────────────────────────────────────────
// 3. RewardHistoryEntry — structured reward for history UI
// ──────────────────────────────────────────────────────────────

// RewardHistoryEntry is a single entry in the reward history feed.
type RewardHistoryEntry struct {
	ID          string  `json:"id"`
	EpochNumber int     `json:"epochNumber"`
	TokenType   string  `json:"tokenType"`
	Amount      float64 `json:"amount"`
	Reason      string  `json:"reason"`
	IsMVP       bool    `json:"isMvp"`
	CreatedAt   int64   `json:"createdAt"` // unix ms
}

// GetPlayerRewardHistory returns reward history entries for a player
// within the specified time window.
func (trm *TokenRewardManager) GetPlayerRewardHistory(playerID string, since time.Time, limit int) []RewardHistoryEntry {
	trm.mu.RLock()
	defer trm.mu.RUnlock()

	sinceMs := since.UnixMilli()
	var result []RewardHistoryEntry

	// Search distributed rewards backwards (most recent first)
	for i := len(trm.distributedRewards) - 1; i >= 0 && len(result) < limit; i-- {
		r := trm.distributedRewards[i]
		if r.PlayerID != playerID {
			continue
		}
		if r.Timestamp < sinceMs {
			break // older than window
		}
		result = append(result, RewardHistoryEntry{
			ID:        r.ID,
			TokenType: r.TokenType,
			Amount:    r.Amount,
			Reason:    r.Reason,
			CreatedAt: r.Timestamp,
		})
	}

	// Also check pending rewards
	for i := len(trm.pendingRewards) - 1; i >= 0 && len(result) < limit; i-- {
		r := trm.pendingRewards[i]
		if r.PlayerID != playerID {
			continue
		}
		if r.Timestamp < sinceMs {
			break
		}
		result = append(result, RewardHistoryEntry{
			ID:        r.ID,
			TokenType: r.TokenType,
			Amount:    r.Amount,
			Reason:    r.Reason + " (pending)",
			CreatedAt: r.Timestamp,
		})
	}

	return result
}
