package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime"
	"time"

	"github.com/andrewkim-gif/snake/server/config"
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
func newRouter(cfg *config.Config, hub *ws.Hub, router *ws.EventRouter, rm *game.RoomManager) http.Handler {
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

	return r
}
