package ramp

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"

	"github.com/go-chi/chi/v5"
)

// RampWebhookHandler handles CROSS Ramp webhook callbacks.
// Endpoints:
//   - POST /get-assets     — Return user's in-game assets for Ramp catalog
//   - POST /validate-order — Validate a mint/burn order before execution
//   - POST /order-result   — Process completed transaction results
type RampWebhookHandler struct {
	mu sync.RWMutex

	// In-memory player balances (Credits). Key = wallet address (lowercase).
	balances map[string]float64
}

// NewRampWebhookHandler creates a new webhook handler.
func NewRampWebhookHandler() *RampWebhookHandler {
	return &RampWebhookHandler{
		balances: make(map[string]float64),
	}
}

// Routes returns a chi.Router with all Ramp webhook endpoints.
func (h *RampWebhookHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/get-assets", h.handleGetAssets)
	r.Post("/validate-order", h.handleValidateOrder)
	r.Post("/order-result", h.handleOrderResult)
	return r
}

// --- Request / Response types ---

type getAssetsRequest struct {
	UserID        string `json:"userId"`
	WalletAddress string `json:"walletAddress"`
}

type asset struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Balance float64 `json:"balance"`
	IconURL string  `json:"iconUrl,omitempty"`
}

type validateOrderRequest struct {
	OrderID       string  `json:"orderId"`
	UserID        string  `json:"userId"`
	WalletAddress string  `json:"walletAddress"`
	AssetID       string  `json:"assetId"`
	Amount        float64 `json:"amount"`
	Action        string  `json:"action"` // "mint" | "burn"
}

type orderResultRequest struct {
	OrderID       string  `json:"orderId"`
	UserID        string  `json:"userId"`
	WalletAddress string  `json:"walletAddress"`
	AssetID       string  `json:"assetId"`
	Amount        float64 `json:"amount"`
	Action        string  `json:"action"` // "mint" | "burn"
	Status        string  `json:"status"` // "success" | "failed"
	TxHash        string  `json:"txHash,omitempty"`
}

// --- Handlers ---

// handleGetAssets returns the user's in-game asset balances.
// CROSS Ramp calls this to display available assets in the catalog.
func (h *RampWebhookHandler) handleGetAssets(w http.ResponseWriter, r *http.Request) {
	var req getAssetsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	slog.Info("ramp: get-assets", "userId", req.UserID, "wallet", req.WalletAddress)

	h.mu.RLock()
	balance := h.balances[req.WalletAddress]
	h.mu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"assets": []asset{
			{
				ID:      "credits",
				Name:    "Credits",
				Balance: balance,
				IconURL: "/assets/icons/credit-icon.png",
			},
		},
	})
}

// handleValidateOrder validates whether a mint/burn order is allowed.
// CROSS Ramp calls this before executing the on-chain transaction.
func (h *RampWebhookHandler) handleValidateOrder(w http.ResponseWriter, r *http.Request) {
	var req validateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	slog.Info("ramp: validate-order",
		"orderId", req.OrderID,
		"userId", req.UserID,
		"action", req.Action,
		"asset", req.AssetID,
		"amount", req.Amount,
	)

	// Validate: burn requires sufficient balance
	if req.Action == "burn" {
		h.mu.RLock()
		balance := h.balances[req.WalletAddress]
		h.mu.RUnlock()

		if balance < req.Amount {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"valid":  false,
				"reason": "insufficient credits balance",
			})
			return
		}
	}

	// Validate: positive amount
	if req.Amount <= 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"valid":  false,
			"reason": "amount must be positive",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid": true,
	})
}

// handleOrderResult processes the final result of a Ramp transaction.
// CROSS Ramp calls this after the on-chain transaction completes (or fails).
func (h *RampWebhookHandler) handleOrderResult(w http.ResponseWriter, r *http.Request) {
	var req orderResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	slog.Info("ramp: order-result",
		"orderId", req.OrderID,
		"userId", req.UserID,
		"action", req.Action,
		"amount", req.Amount,
		"status", req.Status,
		"txHash", req.TxHash,
	)

	if req.Status != "success" {
		slog.Warn("ramp: order failed", "orderId", req.OrderID, "status", req.Status)
		writeJSON(w, http.StatusOK, map[string]string{"result": "acknowledged"})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	switch req.Action {
	case "mint":
		// User spent tokens → receive Credits
		h.balances[req.WalletAddress] += req.Amount
		slog.Info("ramp: credits minted",
			"wallet", req.WalletAddress,
			"amount", req.Amount,
			"newBalance", h.balances[req.WalletAddress],
		)
	case "burn":
		// User spent Credits → receive tokens
		h.balances[req.WalletAddress] -= req.Amount
		if h.balances[req.WalletAddress] < 0 {
			h.balances[req.WalletAddress] = 0
		}
		slog.Info("ramp: credits burned",
			"wallet", req.WalletAddress,
			"amount", req.Amount,
			"newBalance", h.balances[req.WalletAddress],
		)
	}

	writeJSON(w, http.StatusOK, map[string]string{"result": "ok"})
}

// --- Helpers ---

// SetBalance sets a player's credit balance (for game integration).
func (h *RampWebhookHandler) SetBalance(walletAddress string, amount float64) {
	h.mu.Lock()
	h.balances[walletAddress] = amount
	h.mu.Unlock()
}

// GetBalance returns a player's credit balance.
func (h *RampWebhookHandler) GetBalance(walletAddress string) float64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.balances[walletAddress]
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
