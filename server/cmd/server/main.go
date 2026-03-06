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
	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
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

	// Create RoomManager with default game config
	roomCfg := game.DefaultRoomConfig()
	roomCfg.MaxRooms = cfg.MaxRooms
	roomManager := game.NewRoomManager(roomCfg)

	// Wire RoomManager events → Hub messaging (bridge game→ws without circular import)
	roomManager.OnEvents = createRoomEventHandler(hub)

	// Create event router with handlers
	eventRouter := ws.NewEventRouter()
	registerEventHandlers(eventRouter, hub, roomManager)

	// Build HTTP router
	router := newRouter(cfg, hub, eventRouter, roomManager)

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

	// RoomManager goroutine (starts all room loops)
	g.Go(func() error {
		slog.Info("RoomManager starting")
		roomManager.Start(gCtx)
		return nil
	})

	// Lobby broadcast goroutine (1Hz)
	g.Go(func() error {
		roomManager.StartLobbyBroadcast(gCtx, func(data domain.RoomsUpdateEvent) {
			frame, err := ws.EncodeFrame(ws.EventRoomsUpdate, data)
			if err != nil {
				slog.Error("failed to encode rooms_update", "error", err)
				return
			}
			hub.BroadcastToLobby(frame)
		})
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

		slog.Info("stopping RoomManager...")
		roomManager.Stop()

		slog.Info("stopping WS Hub...")
		hub.Stop()

		slog.Info("server stopped")
		return nil
	})

	if err := g.Wait(); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	slog.Info("server shutdown complete")
}

// registerEventHandlers sets up all client→server event handlers.
func registerEventHandlers(router *ws.EventRouter, hub *ws.Hub, rm *game.RoomManager) {
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

	// Join Room
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

		var roomID string
		var err error

		if payload.RoomID == "" {
			// Quick join
			roomID, err = rm.QuickJoin(client.ID, payload.Name, payload.SkinID)
		} else {
			roomID, err = rm.JoinRoom(client.ID, payload.RoomID, payload.Name, payload.SkinID)
		}

		if err != nil {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "join_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		// Move client to room in hub
		hub.MoveClientToRoom(client.ID, roomID)

		// Send joined event
		room := rm.GetRoom(roomID)
		if room != nil {
			joinedEvt := room.GetJoinedEvent(client.ID)
			frame, err := ws.EncodeFrame(ws.EventJoined, joinedEvt)
			if err == nil {
				client.Send(frame)
			}
		}
	})

	// Leave Room
	router.On(ws.EventLeaveRoom, func(client *ws.Client, data json.RawMessage) {
		slog.Info("leave_room received", "clientId", client.ID)
		rm.LeaveRoom(client.ID)
		hub.RegisterLobby(client)
	})

	// Input
	router.On(ws.EventInput, func(client *ws.Client, data json.RawMessage) {
		var payload ws.InputPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		boost := payload.Boost == 1
		rm.RouteInput(client.ID, payload.Angle, boost)
	})

	// Respawn — disabled in 1-life mode, but handle gracefully
	router.On(ws.EventRespawn, func(client *ws.Client, data json.RawMessage) {
		slog.Info("respawn received (1-life mode, ignored)", "clientId", client.ID)
	})

	// Choose Upgrade
	router.On(ws.EventChooseUpgrade, func(client *ws.Client, data json.RawMessage) {
		var payload ws.ChooseUpgradePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		// Convert choiceId to index (choices are 0-indexed by their position)
		// The client sends the choice ID; we find its index
		// For simplicity, treat choice index as the ID suffix number
		// Format: "tome_xp_1" or "ability_venom_aura_lv1" — just use position
		// Better approach: iterate choices and find match
		// For now, use a simple sequential index approach (0, 1, 2)
		choiceIndex := 0
		switch payload.ChoiceID {
		case "0":
			choiceIndex = 0
		case "1":
			choiceIndex = 1
		case "2":
			choiceIndex = 2
		default:
			// Try to parse as index
			if len(payload.ChoiceID) > 0 {
				if payload.ChoiceID[0] >= '0' && payload.ChoiceID[0] <= '9' {
					choiceIndex = int(payload.ChoiceID[0] - '0')
				}
			}
		}

		rm.RouteChooseUpgrade(client.ID, choiceIndex)
	})
}

// createRoomEventHandler creates the callback that bridges Room events to Hub messaging.
func createRoomEventHandler(hub *ws.Hub) game.RoomEventCallback {
	return func(events []game.RoomEvent) {
		for _, evt := range events {
			var wsEvent string
			switch evt.Type {
			case game.RoomEvtDeath:
				wsEvent = ws.EventDeath
			case game.RoomEvtKill:
				wsEvent = ws.EventKill
			case game.RoomEvtLevelUp:
				wsEvent = ws.EventLevelUp
			case game.RoomEvtSynergy:
				wsEvent = ws.EventSynergyActivated
			case game.RoomEvtShrinkWarn:
				wsEvent = ws.EventArenaShrink
			case game.RoomEvtRoundStart:
				wsEvent = ws.EventRoundStart
			case game.RoomEvtRoundEnd:
				wsEvent = ws.EventRoundEnd
			case game.RoomEvtRoundReset:
				wsEvent = ws.EventRoundReset
			case game.RoomEvtState:
				wsEvent = ws.EventState
			case game.RoomEvtMinimap:
				wsEvent = ws.EventMinimap
			case game.RoomEvtArenaShrink:
				wsEvent = ws.EventArenaShrink
			default:
				continue
			}

			frame, err := ws.EncodeFrame(wsEvent, evt.Data)
			if err != nil {
				slog.Error("failed to encode event", "event", wsEvent, "error", err)
				continue
			}

			if evt.TargetID != "" {
				// Unicast to specific client
				hub.SendToClient(evt.TargetID, frame)
			} else {
				// Broadcast to room
				hub.BroadcastToRoom(evt.RoomID, frame)
			}
		}
	}
}
