package api

import (
	"net/http"

	"github.com/andrewkim-gif/snake/server/internal/game"
)

// MatrixHandler handles Matrix-related HTTP endpoints.
// Stub: all Matrix functionality was removed with the Arena cleanup.
type MatrixHandler struct{}

// NewMatrixHandler creates a new MatrixHandler. Stub.
func NewMatrixHandler(
	_ *game.TokenRewardManager,
	_ *game.TokenBalanceCache,
	_ *game.TokenBuffApplier,
	_ interface{}, // PlayerAWWBalance placeholder
) *MatrixHandler {
	return &MatrixHandler{}
}

// GetBuffs handles GET /api/matrix/buffs. Stub.
func (h *MatrixHandler) GetBuffs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("[]"))
}

// GetBalance handles GET /api/matrix/balance. Stub.
func (h *MatrixHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("{}"))
}

// GetRewardHistory handles GET /api/matrix/rewards/history. Stub.
func (h *MatrixHandler) GetRewardHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("[]"))
}
