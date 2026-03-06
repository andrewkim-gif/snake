package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andrewkim-gif/snake/server/config"
	"github.com/andrewkim-gif/snake/server/internal/ws"
	"golang.org/x/sync/errgroup"
)

func main() {
	// Structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	slog.Info("config loaded",
		"port", cfg.Port,
		"tickRate", cfg.TickRate,
		"maxRooms", cfg.MaxRooms,
		"env", cfg.Environment,
	)

	// Create WebSocket hub
	hub := ws.NewHub()

	// Create event router with handlers
	eventRouter := ws.NewEventRouter()
	registerEventHandlers(eventRouter, hub)

	// Build HTTP router
	router := newRouter(cfg, hub, eventRouter)

	// HTTP server
	httpServer := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Context for coordinated shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	g, gCtx := errgroup.WithContext(ctx)

	// Hub goroutine
	g.Go(func() error {
		slog.Info("WS Hub starting")
		hub.Run()
		return nil
	})

	// HTTP server goroutine
	g.Go(func() error {
		slog.Info("HTTP server starting", "addr", cfg.Addr())
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	})

	// Signal watcher goroutine
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	g.Go(func() error {
		select {
		case sig := <-sigChan:
			slog.Info("shutdown signal received", "signal", sig)
		case <-gCtx.Done():
			slog.Info("context cancelled, shutting down")
		}

		cancel()

		// Graceful shutdown with 15s timeout
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer shutdownCancel()

		slog.Info("shutting down HTTP server...")
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			slog.Error("HTTP server shutdown error", "error", err)
			return err
		}

		slog.Info("stopping WS Hub...")
		hub.Stop()

		slog.Info("HTTP server stopped")
		return nil
	})

	if err := g.Wait(); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	slog.Info("server shutdown complete")
}

// registerEventHandlers sets up all client→server event handlers.
func registerEventHandlers(router *ws.EventRouter, hub *ws.Hub) {
	// Ping/Pong
	router.On(ws.EventPing, func(client *ws.Client, data json.RawMessage) {
		var payload ws.PingPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		pong := ws.PongPayload{
			T:  payload.T,
			ST: time.Now().UnixMilli(),
		}
		frame, err := ws.EncodeFrame(ws.EventPong, pong)
		if err != nil {
			return
		}
		client.Send(frame)
	})

	// Join Room (placeholder — will be fully implemented with RoomManager)
	router.On(ws.EventJoinRoom, func(client *ws.Client, data json.RawMessage) {
		var payload ws.JoinRoomPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid join_room payload", "clientId", client.ID, "error", err)
			return
		}
		slog.Info("join_room received",
			"clientId", client.ID,
			"roomId", payload.RoomID,
			"name", payload.Name,
		)
		// Move client to room in hub
		hub.MoveClientToRoom(client.ID, payload.RoomID)
	})

	// Leave Room (placeholder)
	router.On(ws.EventLeaveRoom, func(client *ws.Client, data json.RawMessage) {
		slog.Info("leave_room received", "clientId", client.ID)
		hub.RegisterLobby(client)
	})

	// Input (placeholder — will forward to game room)
	router.On(ws.EventInput, func(client *ws.Client, data json.RawMessage) {
		// Will be forwarded to the Room's input channel
	})

	// Respawn (placeholder)
	router.On(ws.EventRespawn, func(client *ws.Client, data json.RawMessage) {
		slog.Info("respawn received", "clientId", client.ID)
	})

	// Choose Upgrade (placeholder)
	router.On(ws.EventChooseUpgrade, func(client *ws.Client, data json.RawMessage) {
		slog.Info("choose_upgrade received", "clientId", client.ID)
	})
}
