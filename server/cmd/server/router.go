package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"time"

	"github.com/andrewkim-gif/snake/server/config"
	"github.com/andrewkim-gif/snake/server/internal/api"
	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var startTime = time.Now()

// healthResponse is the JSON structure returned by GET /health.
type healthResponse struct {
	Status     string `json:"status"`
	Rooms      int    `json:"rooms"`
	Players    int    `json:"players"`
	Uptime     string `json:"uptime"`
	Goroutines int    `json:"goroutines"`
}

// upgrader configures the WebSocket upgrade from HTTP.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, validate origin against CORS config.
		// For now, allow all origins.
		return true
	},
}

// newRouter creates the chi HTTP router with middleware and routes.
// RouterDeps holds optional dependencies for the HTTP router.
type RouterDeps struct {
	TrainingStore     *game.TrainingStore
	MemoryStore       *game.MemoryStore
	ProgressionStore  *game.ProgressionStore
	QuestStore        *game.QuestStore
	GlobalLeaderboard *game.GlobalLeaderboard
	AgentRouter       *api.AgentRouter
	AgentStreamHub    *ws.AgentStreamHub
}

func newRouter(cfg *config.Config, hub *ws.Hub, router *ws.EventRouter, rm *game.RoomManager, deps ...*RouterDeps) http.Handler {
	// Optional dependencies
	var ts *game.TrainingStore
	var ms *game.MemoryStore
	var ps *game.ProgressionStore
	var qs *game.QuestStore
	var glb *game.GlobalLeaderboard
	if len(deps) > 0 && deps[0] != nil {
		ts = deps[0].TrainingStore
		ms = deps[0].MemoryStore
		ps = deps[0].ProgressionStore
		qs = deps[0].QuestStore
		glb = deps[0].GlobalLeaderboard
	}
	r := chi.NewRouter()

	// -- Middleware --
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	// Structured request logging (skip /ws to avoid noise)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/ws" {
				next.ServeHTTP(w, r)
				return
			}
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			slog.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"duration", time.Since(start).String(),
				"bytes", ww.BytesWritten(),
			)
		})
	})

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// -- Routes --

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		resp := healthResponse{
			Status:     "ok",
			Rooms:      rm.RoomCount(),
			Players:    hub.ClientCount(),
			Uptime:     time.Since(startTime).Truncate(time.Second).String(),
			Goroutines: runtime.NumGoroutine(),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			slog.Error("failed to encode health response", "error", err)
		}
	})

	// Rooms list (REST endpoint for initial lobby load)
	r.Get("/rooms", func(w http.ResponseWriter, r *http.Request) {
		rooms := rm.GetRoomList()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(rooms); err != nil {
			slog.Error("failed to encode rooms response", "error", err)
		}
	})

	// WebSocket upgrade endpoint
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws upgrade failed", "error", err)
			return
		}

		clientID := uuid.New().String()
		client := ws.NewClient(clientID, hub, conn, router.HandleMessage, func(c *ws.Client) {
			// On disconnect: clean up room membership
			rm.LeaveRoom(c.ID)
			slog.Info("client disconnected", "clientId", c.ID)
		})

		// Register to lobby (no room yet)
		hub.RegisterLobby(client)

		// Start read/write pumps
		go client.WritePump()
		go client.ReadPump()

		slog.Info("new ws connection", "clientId", clientID, "remoteAddr", r.RemoteAddr)
	})

	// --- Agent Training API (S49) ---
	r.Route("/api/agent/{agentId}", func(r chi.Router) {
		// PUT /api/agent/:id/training — Set training profile
		r.Put("/training", func(w http.ResponseWriter, r *http.Request) {
			if ts == nil {
				http.Error(w, `{"error":"training not initialized"}`, http.StatusServiceUnavailable)
				return
			}

			agentID := chi.URLParam(r, "agentId")
			if agentID == "" {
				http.Error(w, `{"error":"missing agentId"}`, http.StatusBadRequest)
				return
			}

			var req game.SetTrainingRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
				return
			}

			if err := req.Validate(); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}

			// Get existing or create new
			existing, _ := ts.GetProfile(agentID)
			profile := req.ApplyToProfile(agentID, existing)

			if err := ts.SetProfile(agentID, profile); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(profile)
		})

		// GET /api/agent/:id/training — Get training profile
		r.Get("/training", func(w http.ResponseWriter, r *http.Request) {
			if ts == nil {
				http.Error(w, `{"error":"training not initialized"}`, http.StatusServiceUnavailable)
				return
			}

			agentID := chi.URLParam(r, "agentId")
			profile, ok := ts.GetProfile(agentID)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "profile not found"})
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(profile)
		})

		// PUT /api/agent/:id/build-path — Register custom build path (S48)
		r.Put("/build-path", func(w http.ResponseWriter, r *http.Request) {
			agentID := chi.URLParam(r, "agentId")
			if agentID == "" {
				http.Error(w, `{"error":"missing agentId"}`, http.StatusBadRequest)
				return
			}

			var bp game.BuildPath
			if err := json.NewDecoder(r.Body).Decode(&bp); err != nil {
				http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
				return
			}

			bp.ID = "custom_" + agentID
			// Store as training profile build path
			if ts != nil {
				existing, _ := ts.GetProfile(agentID)
				if existing == nil {
					existing = &game.TrainingProfile{AgentID: agentID}
				}
				existing.BuildProfile.PrimaryPath = bp.ID
				ts.SetProfile(agentID, existing)
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(bp)
		})

		// GET /api/agent/:id/memory — Get agent learning data (S50)
		r.Get("/memory", func(w http.ResponseWriter, r *http.Request) {
			if ms == nil {
				http.Error(w, `{"error":"memory not initialized"}`, http.StatusServiceUnavailable)
				return
			}

			agentID := chi.URLParam(r, "agentId")
			mem, ok := ms.GetMemory(agentID)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "memory not found"})
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(mem)
		})
	})

	// --- Build Paths API (public, read-only) ---
	r.Get("/api/build-paths", func(w http.ResponseWriter, r *http.Request) {
		paths := make(map[string]*game.BuildPath)
		for _, id := range game.AllBuildPathIDs() {
			paths[id] = game.GetBuildPath(id)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(paths)
	})

	// --- Personality Presets API (public, read-only) ---
	r.Get("/api/personalities", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(game.PersonalityPresets)
	})

	// --- Player Progression API (S53) ---
	r.Route("/api/player/{playerId}", func(r chi.Router) {
		// GET /api/player/:id/progression — Get RP + unlock state
		r.Get("/progression", func(w http.ResponseWriter, r *http.Request) {
			if ps == nil {
				http.Error(w, `{"error":"progression not initialized"}`, http.StatusServiceUnavailable)
				return
			}
			playerID := chi.URLParam(r, "playerId")
			resp := ps.BuildProgressionResponse(playerID)
			if resp == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "progression not found"})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		})

		// GET /api/player/:id/quests — Get quest state (S54)
		r.Get("/quests", func(w http.ResponseWriter, r *http.Request) {
			if qs == nil {
				http.Error(w, `{"error":"quests not initialized"}`, http.StatusServiceUnavailable)
				return
			}
			playerID := chi.URLParam(r, "playerId")
			resp := qs.GetPlayerQuestsResponse(playerID)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		})
	})

	// --- Global Leaderboard API (S55) ---
	r.Get("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		if glb == nil {
			http.Error(w, `{"error":"leaderboard not initialized"}`, http.StatusServiceUnavailable)
			return
		}
		lbType := r.URL.Query().Get("type")
		if lbType == "" {
			lbType = "agent"
		}
		resp := glb.GetLeaderboard(lbType)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	// --- Agent REST API (S24, Phase 5) ---
	// DualAuth accepts JWT or API Key authentication for agent endpoints
	var agentRouter *api.AgentRouter
	if len(deps) > 0 && deps[0] != nil {
		agentRouter = deps[0].AgentRouter
	}
	if agentRouter != nil {
		apiKeyValidator := func(_ context.Context, keyHash string) (string, error) {
			// Simple validator: check keyHash is not empty
			// In production, this validates against DB
			if keyHash == "" {
				return "", fmt.Errorf("empty key hash")
			}
			return "api_user_" + keyHash[:8], nil
		}
		r.Route("/api/agents", func(r chi.Router) {
			r.Use(auth.DualAuth(apiKeyValidator))
			r.Mount("/", agentRouter.Routes())
		})
	}

	// --- Agent WebSocket Live Stream (S25, Phase 5) ---
	var agentStreamHub *ws.AgentStreamHub
	if len(deps) > 0 && deps[0] != nil {
		agentStreamHub = deps[0].AgentStreamHub
	}
	if agentStreamHub != nil {
		r.Get("/ws/agents/live", agentStreamHub.HandleAgentStream)
	}

	return r
}
