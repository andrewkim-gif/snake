package server

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/to-nexus/snake-server/internal/config"
	"github.com/to-nexus/snake-server/internal/ws"
)

var startTime = time.Now()

// APIHandlers holds HTTP handlers for game APIs.
type APIHandlers struct {
	// Agent command handler: POST /api/agent/command
	AgentCommand http.HandlerFunc
	// Agent observe handler: GET /api/agent/observe
	AgentObserve http.HandlerFunc
	// Training config GET handler
	TrainingGetConfig http.HandlerFunc
	// Training config PUT handler
	TrainingSetConfig http.HandlerFunc
	// Training history GET handler
	TrainingGetHistory http.HandlerFunc
	// Training metrics GET handler
	TrainingGetMetrics http.HandlerFunc

	// Meta: RP system
	MetaGetRP  http.HandlerFunc
	MetaPostRP http.HandlerFunc
	// Meta: Quests
	MetaGetQuests http.HandlerFunc
	// Meta: Leaderboard + Stats
	MetaGetLeaderboard http.HandlerFunc
	MetaGetStats       http.HandlerFunc
	// Meta: Personalities
	MetaGetPersonalities http.HandlerFunc
	MetaSetPersonality   http.HandlerFunc
	// Meta: Analyze
	MetaAnalyze http.HandlerFunc
}

// NewRouter creates and configures the chi router with all middleware and routes.
func NewRouter(cfg *config.Config, hub *ws.Hub, handlers ws.WSHandlers, apiHandlers *APIHandlers) http.Handler {
	r := chi.NewRouter()

	// ── Middleware ──
	r.Use(chimw.RealIP)
	r.Use(chimw.RequestID)
	r.Use(NewRecoveryMiddleware())
	r.Use(NewLoggingMiddleware())
	r.Use(NewCORSMiddleware(cfg.CORSOrigin))

	// ── Health endpoint ──
	r.Get("/health", healthHandler)

	// ── WebSocket endpoint ──
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWSWithHandlers(hub, w, r, handlers)
	})

	// ── Agent API endpoints ──
	if apiHandlers != nil {
		r.Route("/api", func(r chi.Router) {
			// Agent Commander
			r.Post("/agent/command", apiHandlers.AgentCommand)
			r.Get("/agent/observe", apiHandlers.AgentObserve)

			// Training
			r.Get("/training", apiHandlers.TrainingGetConfig)
			r.Put("/training", apiHandlers.TrainingSetConfig)
			r.Get("/training/history", apiHandlers.TrainingGetHistory)
			r.Get("/training/metrics", apiHandlers.TrainingGetMetrics)

			// Meta: RP, Quests, Leaderboard, Stats
			if apiHandlers.MetaGetRP != nil {
				r.Get("/meta/rp", apiHandlers.MetaGetRP)
				r.Post("/meta/rp", apiHandlers.MetaPostRP)
				r.Get("/meta/quests", apiHandlers.MetaGetQuests)
				r.Get("/meta/leaderboard", apiHandlers.MetaGetLeaderboard)
				r.Get("/meta/stats", apiHandlers.MetaGetStats)
				r.Get("/meta/personalities", apiHandlers.MetaGetPersonalities)
				r.Put("/agent/personality", apiHandlers.MetaSetPersonality)
				r.Post("/meta/analyze", apiHandlers.MetaAnalyze)
			}
		})
	}

	return r
}

// healthHandler returns the server health status.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	resp := map[string]interface{}{
		"status":     "ok",
		"uptime":     time.Since(startTime).String(),
		"goroutines": runtime.NumGoroutine(),
		"memory": map[string]interface{}{
			"alloc":      memStats.Alloc,
			"totalAlloc": memStats.TotalAlloc,
			"sys":        memStats.Sys,
			"numGC":      memStats.NumGC,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}
