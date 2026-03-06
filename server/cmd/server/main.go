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

	// Create agent command router (S47)
	agentCmdRouter := game.NewAgentCommandRouter()

	// Create training store (S49) + memory store (S50) — persists to data/ directory
	trainingStore := game.NewTrainingStore("data")
	memoryStore := game.NewMemoryStore("data")

	// Create progression store (S53), quest store (S54), global leaderboard (S55)
	progressionStore := game.NewProgressionStore("data")
	questStore := game.NewQuestStore(progressionStore)
	globalLeaderboard := game.NewGlobalLeaderboard(progressionStore)

	// Create event router with handlers
	eventRouter := ws.NewEventRouter()
	registerEventHandlers(eventRouter, hub, roomManager, agentCmdRouter)

	// Build HTTP router
	router := newRouter(cfg, hub, eventRouter, roomManager, &RouterDeps{
		TrainingStore:     trainingStore,
		MemoryStore:       memoryStore,
		ProgressionStore:  progressionStore,
		QuestStore:        questStore,
		GlobalLeaderboard: globalLeaderboard,
	})

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
func registerEventHandlers(router *ws.EventRouter, hub *ws.Hub, rm *game.RoomManager, agentCmdRouter *game.AgentCommandRouter) {
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

		if payload.RoomID == "" || payload.RoomID == "quick" {
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

	// --- Agent-specific event handlers (S46) ---

	// Agent Authentication
	router.On(ws.EventAgentAuth, func(client *ws.Client, data json.RawMessage) {
		var payload ws.AgentAuthPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid agent_auth payload", "clientId", client.ID, "error", err)
			return
		}

		// API key validation (simple for now; production would use hashed keys + DB)
		if payload.APIKey == "" || payload.AgentID == "" {
			frame, _ := ws.EncodeFrame(ws.EventAgentAuthResult, domain.AgentAuthResult{
				Success: false,
				Error:   "missing api_key or agent_id",
			})
			client.Send(frame)
			return
		}

		// Mark client as authenticated agent
		client.IsAgent = true
		client.AgentID = payload.AgentID
		client.AgentAPIKey = payload.APIKey

		slog.Info("agent authenticated",
			"clientId", client.ID,
			"agentId", payload.AgentID,
		)

		frame, _ := ws.EncodeFrame(ws.EventAgentAuthResult, domain.AgentAuthResult{
			Success: true,
			AgentID: payload.AgentID,
		})
		client.Send(frame)
	})

	// Agent Choose Upgrade (with reasoning)
	router.On(ws.EventAgentChooseUpgrade, func(client *ws.Client, data json.RawMessage) {
		if !client.IsAgent {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "not_agent",
				Message: "agent_choose_upgrade requires agent authentication",
			})
			client.Send(errFrame)
			return
		}

		var payload ws.AgentChooseUpgradePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		if payload.Reasoning != "" {
			slog.Info("agent upgrade choice",
				"agentId", client.AgentID,
				"choiceIndex", payload.ChoiceIndex,
				"reasoning", payload.Reasoning,
			)
		}

		rm.RouteChooseUpgrade(client.ID, payload.ChoiceIndex)
	})

	// Agent Commander Mode Command (S47)
	router.On(ws.EventAgentCommand, func(client *ws.Client, data json.RawMessage) {
		if !client.IsAgent {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "not_agent",
				Message: "agent_command requires agent authentication",
			})
			client.Send(errFrame)
			return
		}

		var payload ws.AgentCommandPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		// Get agent's room and arena
		roomID := rm.GetPlayerRoom(client.ID)
		if roomID == "" {
			return
		}
		room := rm.GetRoom(roomID)
		if room == nil {
			return
		}

		agent, ok := room.GetArena().GetAgent(client.ID)
		if !ok || !agent.Alive {
			return
		}

		if err := agentCmdRouter.ExecuteCommand(client.ID, agent, room.GetArena(), payload.Cmd, payload.Data); err != nil {
			slog.Warn("agent command failed",
				"agentId", client.AgentID,
				"cmd", payload.Cmd,
				"error", err,
			)
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "command_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
		}
	})

	// Agent Observe Game (S52) — request/response pattern
	router.On(ws.EventAgentObserveReq, func(client *ws.Client, data json.RawMessage) {
		if !client.IsAgent {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "not_agent",
				Message: "observe_game requires agent authentication",
			})
			client.Send(errFrame)
			return
		}

		// Get agent's room and arena
		roomID := rm.GetPlayerRoom(client.ID)
		if roomID == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "not_in_room",
				Message: "observe_game: not in a room",
			})
			client.Send(errFrame)
			return
		}
		room := rm.GetRoom(roomID)
		if room == nil {
			return
		}

		agent, ok := room.GetArena().GetAgent(client.ID)
		if !ok {
			return
		}

		// Build and send the observation response
		observation := game.BuildObserveGameResponse(agent, room.GetArena())
		if observation != nil {
			frame, err := ws.EncodeFrame(ws.EventAgentObserveGame, observation)
			if err == nil {
				client.Send(frame)
			}
		}
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
			case game.RoomEvtAgentLevelUp:
				wsEvent = ws.EventAgentLevelUp
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
			case game.RoomEvtCoachMessage:
				wsEvent = ws.EventCoachMessage
			case game.RoomEvtRoundAnalysis:
				wsEvent = ws.EventRoundAnalysis
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
