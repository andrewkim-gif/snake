package ramp

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"
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

	// HMAC-SHA256 시크릿 (RAMP_WEBHOOK_SECRET 환경변수에서 로드)
	webhookSecret string

	// 처리된 OrderID를 기록하여 중복 실행을 방지합니다
	processedOrders sync.Map // key: orderId (string), value: orderResultCache
}

// orderResultCache는 이미 처리된 주문의 결과를 캐싱합니다
type orderResultCache struct {
	StatusCode int
	Body       interface{}
}

// NewRampWebhookHandler creates a new webhook handler.
// RAMP_WEBHOOK_SECRET 환경변수에서 HMAC 시크릿을 로드합니다.
func NewRampWebhookHandler() *RampWebhookHandler {
	secret := os.Getenv("RAMP_WEBHOOK_SECRET")
	if secret == "" {
		slog.Warn("ramp: RAMP_WEBHOOK_SECRET not set — HMAC verification disabled")
	}
	return &RampWebhookHandler{
		balances:      make(map[string]float64),
		webhookSecret: secret,
	}
}

// Routes returns a chi.Router with all Ramp webhook endpoints.
// HMAC-SHA256 서명 검증 미들웨어가 모든 엔드포인트에 적용됩니다.
func (h *RampWebhookHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(h.hmacVerifyMiddleware)
	r.Post("/get-assets", h.handleGetAssets)
	r.Post("/validate-order", h.handleValidateOrder)
	r.Post("/order-result", h.handleOrderResult)
	return r
}

// hmacVerifyMiddleware는 X-Ramp-Signature 헤더의 HMAC-SHA256 서명을 검증합니다.
// 시크릿이 설정되지 않은 경우: RAILWAY_ENVIRONMENT 설정 시 모든 요청 거부 (프로덕션 보호),
// 미설정 시 검증 건너뜀 (로컬 개발 모드).
func (h *RampWebhookHandler) hmacVerifyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.webhookSecret == "" {
			// 프로덕션 환경에서는 시크릿 필수
			if os.Getenv("RAILWAY_ENVIRONMENT") != "" {
				slog.Error("ramp: RAMP_WEBHOOK_SECRET not set in production — rejecting request")
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "webhook secret not configured"})
				return
			}
			// 로컬 개발 모드에서만 검증 건너뜀
			next.ServeHTTP(w, r)
			return
		}

		// 요청 바디를 읽어서 서명을 검증한 뒤, 다시 읽을 수 있도록 복원합니다
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read request body"})
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))

		signature := r.Header.Get("X-Ramp-Signature")
		if signature == "" {
			slog.Warn("ramp: missing X-Ramp-Signature header")
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "missing signature"})
			return
		}

		mac := hmac.New(sha256.New, []byte(h.webhookSecret))
		mac.Write(body)
		expectedSig := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			slog.Warn("ramp: HMAC signature mismatch")
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "invalid signature"})
			return
		}

		next.ServeHTTP(w, r)
	})
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
// OrderID 기반 idempotency를 보장합니다 — 동일 주문이 재전송되면 기존 결과를 반환합니다.
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

	// Idempotency: 이미 처리된 주문인지 확인합니다
	if cached, ok := h.processedOrders.Load(req.OrderID); ok {
		result := cached.(orderResultCache)
		slog.Info("ramp: duplicate order-result, returning cached response",
			"orderId", req.OrderID,
		)
		writeJSON(w, result.StatusCode, result.Body)
		return
	}

	if req.Status != "success" {
		slog.Warn("ramp: order failed", "orderId", req.OrderID, "status", req.Status)
		respBody := map[string]string{"result": "acknowledged"}
		h.processedOrders.Store(req.OrderID, orderResultCache{
			StatusCode: http.StatusOK,
			Body:       respBody,
		})
		writeJSON(w, http.StatusOK, respBody)
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

	respBody := map[string]string{"result": "ok"}
	h.processedOrders.Store(req.OrderID, orderResultCache{
		StatusCode: http.StatusOK,
		Body:       respBody,
	})
	writeJSON(w, http.StatusOK, respBody)
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
