package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/andrewkim-gif/snake/server/internal/debug"
	"github.com/go-chi/chi/v5"
)

// DebugRouter는 개발 환경 전용 디버그 API 라우트를 제공합니다.
type DebugRouter struct{}

// NewDebugRouter는 새로운 DebugRouter를 생성합니다.
func NewDebugRouter() *DebugRouter {
	return &DebugRouter{}
}

// toggleRequest는 시스템 토글 요청 바디입니다.
type toggleRequest struct {
	Enabled bool `json:"enabled"`
}

// systemsResponse는 전체 시스템 상태 응답입니다.
type systemsResponse struct {
	Environment string             `json:"environment"`
	Systems     []debug.SystemInfo `json:"systems"`
}

// Routes는 chi.Router에 디버그 라우트를 마운트합니다.
// 개발 환경이 아니면 404를 반환합니다.
func (dr *DebugRouter) Routes(r chi.Router) {
	r.Route("/api/v1/debug", func(r chi.Router) {
		// 개발 환경 체크 미들웨어
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if !debug.IsDevelopment() {
					http.NotFound(w, r)
					return
				}
				next.ServeHTTP(w, r)
			})
		})

		// GET /api/v1/debug/systems — 전체 시스템 상태 조회
		r.Get("/systems", dr.handleGetSystems)

		// POST /api/v1/debug/systems/all — 전체 시스템 일괄 토글
		r.Post("/systems/all", dr.handleToggleAll)

		// POST /api/v1/debug/systems/{id} — 개별 시스템 토글
		r.Post("/systems/{id}", dr.handleToggleSystem)
	})
}

// handleGetSystems는 모든 시스템의 현재 상태를 반환합니다.
func (dr *DebugRouter) handleGetSystems(w http.ResponseWriter, r *http.Request) {
	resp := systemsResponse{
		Environment: "development",
		Systems:     debug.GetAll(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		slog.Error("failed to encode debug systems response", "error", err)
	}
}

// handleToggleSystem은 개별 시스템을 토글합니다.
func (dr *DebugRouter) handleToggleSystem(w http.ResponseWriter, r *http.Request) {
	systemID := chi.URLParam(r, "id")

	var req toggleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	ok := debug.SetEnabled(systemID, req.Enabled)
	if !ok {
		http.Error(w, `{"error":"unknown system"}`, http.StatusNotFound)
		return
	}

	slog.Info("debug system toggled via API",
		"system", systemID,
		"enabled", req.Enabled,
	)

	// 변경 후 전체 상태 반환
	dr.handleGetSystems(w, r)
}

// handleToggleAll은 모든 시스템을 일괄 토글합니다.
func (dr *DebugRouter) handleToggleAll(w http.ResponseWriter, r *http.Request) {
	var req toggleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	debug.SetAll(req.Enabled)

	slog.Info("debug all systems toggled via API",
		"enabled", req.Enabled,
	)

	// 변경 후 전체 상태 반환
	dr.handleGetSystems(w, r)
}
