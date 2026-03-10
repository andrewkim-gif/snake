package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/game"
)

// ============================================================
// v33 Phase 6 — MatrixHandler: REST API endpoints for the
// Matrix token economy integration.
//
// Endpoints:
//   GET /api/matrix/buffs?playerId={id}     — token buffs
//   GET /api/matrix/balance?playerId={id}   — token balance
//   GET /api/matrix/rewards/history?playerId={id} — reward history
// ============================================================

// MatrixHandler serves Matrix token economy REST endpoints.
type MatrixHandler struct {
	tokenRewardMgr  *game.TokenRewardManager
	balanceCache    *game.TokenBalanceCache
	buffApplier     *game.TokenBuffApplier
	playerAWWBalance *game.PlayerAWWBalance
}

// NewMatrixHandler creates a new Matrix REST handler.
func NewMatrixHandler(
	tokenRewardMgr *game.TokenRewardManager,
	balanceCache *game.TokenBalanceCache,
	buffApplier *game.TokenBuffApplier,
	playerAWWBalance *game.PlayerAWWBalance,
) *MatrixHandler {
	return &MatrixHandler{
		tokenRewardMgr:  tokenRewardMgr,
		balanceCache:    balanceCache,
		buffApplier:     buffApplier,
		playerAWWBalance: playerAWWBalance,
	}
}

// ──────────────────────────────────────────────────────────────
// GET /api/matrix/buffs?playerId={id}
// Response: { tokenBalance, buffs: { xpBoost, statBoost, specialSkills }, tier, nextTierThreshold }
// ──────────────────────────────────────────────────────────────

type buffsResponse struct {
	TokenBalance      float64          `json:"tokenBalance"`
	Buffs             game.TokenBuffs  `json:"buffs"`
	NextTierThreshold float64          `json:"nextTierThreshold"`
}

func (h *MatrixHandler) GetBuffs(w http.ResponseWriter, r *http.Request) {
	playerID := r.URL.Query().Get("playerId")
	if playerID == "" {
		http.Error(w, `{"error":"playerId required"}`, http.StatusBadRequest)
		return
	}

	// Get balance from cache
	balance := 0.0
	if h.balanceCache != nil {
		balance = h.balanceCache.GetBalance(playerID)
	} else if h.playerAWWBalance != nil {
		balance = h.playerAWWBalance.GetBalance(playerID)
	}

	// Compute buffs
	buffs := game.NoTokenBuff()
	nextThreshold := 0.0
	if h.buffApplier != nil {
		buffs = h.buffApplier.GetBuffs(balance)
		nextThreshold = h.buffApplier.GetNextTierThreshold(balance)
	}

	resp := buffsResponse{
		TokenBalance:      balance,
		Buffs:             buffs,
		NextTierThreshold: nextThreshold,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ──────────────────────────────────────────────────────────────
// GET /api/matrix/balance?playerId={id}
// Response: { playerId, balance, cached, dailyRemaining }
// ──────────────────────────────────────────────────────────────

type balanceResponse struct {
	PlayerID       string  `json:"playerId"`
	Balance        float64 `json:"balance"`
	Cached         bool    `json:"cached"`
	DailyRemaining float64 `json:"dailyRemaining"`
}

func (h *MatrixHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	playerID := r.URL.Query().Get("playerId")
	if playerID == "" {
		http.Error(w, `{"error":"playerId required"}`, http.StatusBadRequest)
		return
	}

	balance := 0.0
	cached := false
	if h.balanceCache != nil {
		balance = h.balanceCache.GetBalance(playerID)
		cached = true
	} else if h.playerAWWBalance != nil {
		balance = h.playerAWWBalance.GetBalance(playerID)
	}

	dailyRemaining := game.DailyPlayerRewardCap
	if h.tokenRewardMgr != nil {
		dailyRemaining = h.tokenRewardMgr.GetDailyRemaining(playerID)
	}

	resp := balanceResponse{
		PlayerID:       playerID,
		Balance:        balance,
		Cached:         cached,
		DailyRemaining: dailyRemaining,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ──────────────────────────────────────────────────────────────
// GET /api/matrix/rewards/history?playerId={id}&period=day|week|season
// Response: { rewards: [...], total, dailyRemaining }
// ──────────────────────────────────────────────────────────────

type rewardHistoryResponse struct {
	Rewards        []game.RewardHistoryEntry `json:"rewards"`
	Total          float64                   `json:"total"`
	DailyRemaining float64                   `json:"dailyRemaining"`
}

func (h *MatrixHandler) GetRewardHistory(w http.ResponseWriter, r *http.Request) {
	playerID := r.URL.Query().Get("playerId")
	if playerID == "" {
		http.Error(w, `{"error":"playerId required"}`, http.StatusBadRequest)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "day"
	}

	// Calculate time window
	var since time.Time
	now := time.Now()
	switch period {
	case "day":
		since = now.Add(-24 * time.Hour)
	case "week":
		since = now.Add(-7 * 24 * time.Hour)
	case "season":
		since = now.Add(-28 * 24 * time.Hour) // 4 weeks
	default:
		since = now.Add(-24 * time.Hour)
	}

	limit := 100
	rewards := make([]game.RewardHistoryEntry, 0)
	total := 0.0
	dailyRemaining := game.DailyPlayerRewardCap

	if h.tokenRewardMgr != nil {
		rewards = h.tokenRewardMgr.GetPlayerRewardHistory(playerID, since, limit)
		for _, r := range rewards {
			total += r.Amount
		}
		dailyRemaining = h.tokenRewardMgr.GetDailyRemaining(playerID)
	}

	resp := rewardHistoryResponse{
		Rewards:        rewards,
		Total:          total,
		DailyRemaining: dailyRemaining,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		slog.Error("failed to encode reward history response", "error", err)
	}
}
