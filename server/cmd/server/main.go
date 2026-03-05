package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/to-nexus/snake-server/internal/config"
	"github.com/to-nexus/snake-server/internal/game"
	"github.com/to-nexus/snake-server/internal/server"
	"github.com/to-nexus/snake-server/internal/ws"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server exited with error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	// ── Config ──
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	// ── Logging ──
	setupLogging(cfg.LogLevel)
	slog.Info("starting server",
		"port", cfg.Port,
		"cors", cfg.CORSOrigin,
		"maxRooms", cfg.MaxRooms,
		"tickRate", cfg.TickRate,
	)

	// ── Context + Signal ──
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// ── Subsystems ──
	hub := ws.NewHub()

	// Create broadcaster adapter (ws.Hub → game.Broadcaster interface)
	bc := &ws.HubBroadcaster{Hub: hub}

	// Create game configs
	arenaConfig := game.DefaultArenaConfig()
	arenaConfig.TickRate = cfg.TickRate

	roomConfig := game.DefaultRoomConfig()
	roomConfig.MaxRooms = cfg.MaxRooms

	// Create RoomManager
	roomManager := game.NewRoomManager(arenaConfig, roomConfig, bc)

	// Create event dispatcher
	dispatcher := &ws.EventDispatcher{
		JoinRoom: func(clientID, roomID, name string, skinID int) {
			var joinedRoomID string
			var joinErr error

			if roomID == "" {
				joinedRoomID, joinErr = roomManager.QuickJoin(clientID, name, skinID)
			} else {
				joinedRoomID, joinErr = roomManager.JoinRoom(clientID, roomID, name, skinID)
			}

			if joinErr != nil {
				slog.Warn("join failed", "clientID", clientID, "roomID", roomID, "error", joinErr)
				// Send error via hub unicast
				errPayload := map[string]string{
					"code":    "JOIN_FAILED",
					"message": joinErr.Error(),
				}
				data, _ := json.Marshal(map[string]interface{}{"e": "error", "d": errPayload})
				hub.Unicast <- &ws.UnicastMsg{ClientID: clientID, Data: data}
				return
			}

			slog.Info("player joined", "clientID", clientID, "roomID", joinedRoomID, "name", name)
		},

		LeaveRoom: func(clientID string) {
			roomManager.LeaveRoom(clientID)
		},

		Input: func(clientID, roomID string, angle float64, boost, seq int) {
			// Find client's room if not provided
			if roomID == "" || roomID == "lobby" {
				roomID = roomManager.FindRoomForClient(clientID)
			}
			if roomID == "" {
				return
			}
			roomManager.SendInput(clientID, roomID, game.InputMsg{
				AgentID: clientID,
				Angle:   angle,
				Boost:   boost,
				Seq:     seq,
			})
		},

		Respawn: func(clientID, roomID string, name string, skinID int) {
			if roomID == "" || roomID == "lobby" {
				roomID = roomManager.FindRoomForClient(clientID)
			}
			if roomID == "" {
				return
			}
			roomManager.SendRespawn(clientID, roomID, game.RespawnRequest{
				ClientID: clientID,
				Name:     name,
				SkinID:   skinID,
			})
		},

		ChooseUpgrade: func(clientID, roomID, choiceID string) {
			if roomID == "" || roomID == "lobby" {
				roomID = roomManager.FindRoomForClient(clientID)
			}
			if roomID == "" {
				return
			}
			roomManager.SendUpgrade(clientID, roomID, game.UpgradeRequest{
				ClientID: clientID,
				ChoiceID: choiceID,
			})
		},
	}

	// Disconnect handler: remove from room on disconnect
	onDisconnect := func(clientID string) {
		roomManager.LeaveRoom(clientID)
	}

	wsHandlers := ws.WSHandlers{
		OnMessage:    dispatcher.HandleMessage,
		OnDisconnect: onDisconnect,
	}

	// Agent API + Training API
	agentAPI := game.NewAgentAPI(roomManager)
	trainingStore := game.NewTrainingStore("data/training")
	trainingAPI := game.NewTrainingAPI(trainingStore)

	// Meta systems: RP, Quests, Global Stats, Personalities
	rpStore := game.NewRPStore("data/meta")
	questTracker := game.NewQuestTracker(rpStore)
	globalStats := game.NewGlobalStats(rpStore, trainingStore)
	personalityStore := game.NewPersonalityStore()
	metaAPI := game.NewMetaAPI(rpStore, questTracker, globalStats, personalityStore)

	// Wire meta systems into rooms for round-end processing
	for i := 1; i <= roomConfig.MaxRooms; i++ {
		roomID := fmt.Sprintf("room-%d", i)
		if room := roomManager.GetRoom(roomID); room != nil {
			room.SetMetaSystems(rpStore, questTracker)
		}
	}

	apiHandlers := &server.APIHandlers{
		AgentCommand:       agentAPI.HandleCommand,
		AgentObserve:       agentAPI.HandleObserve,
		TrainingGetConfig:  trainingAPI.HandleGetConfig,
		TrainingSetConfig:  trainingAPI.HandleSetConfig,
		TrainingGetHistory: trainingAPI.HandleGetHistory,
		TrainingGetMetrics: trainingAPI.HandleGetMetrics,

		// Meta endpoints
		MetaGetRP:            metaAPI.HandleGetRP,
		MetaPostRP:           metaAPI.HandlePostRP,
		MetaGetQuests:        metaAPI.HandleGetQuests,
		MetaGetLeaderboard:   metaAPI.HandleGetLeaderboard,
		MetaGetStats:         metaAPI.HandleGetStats,
		MetaGetPersonalities: metaAPI.HandleGetPersonalities,
		MetaSetPersonality:   metaAPI.HandleSetPersonality,
		MetaAnalyze:          metaAPI.HandleAnalyze,
	}

	router := server.NewRouter(cfg, hub, wsHandlers, apiHandlers)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// ── Orchestration ──
	g, _ := errgroup.WithContext(ctx)

	// HTTP server
	g.Go(func() error {
		slog.Info("HTTP server listening", "addr", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			return fmt.Errorf("http server: %w", err)
		}
		return nil
	})

	// WebSocket Hub
	g.Go(func() error {
		hub.Run(ctx)
		return nil
	})

	// RoomManager (rooms + lobby broadcast)
	g.Go(func() error {
		return roomManager.Run(ctx)
	})

	// Signal handler
	g.Go(func() error {
		select {
		case sig := <-sigChan:
			slog.Info("shutdown signal received", "signal", sig)
		case <-ctx.Done():
		}

		slog.Info("shutting down...")
		cancel()

		// Graceful shutdown with timeout
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		hub.Stop()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			slog.Error("http server shutdown error", "error", err)
		}

		slog.Info("server stopped")
		return nil
	})

	return g.Wait()
}

func setupLogging(level string) {
	var logLevel slog.Level
	switch level {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	})
	slog.SetDefault(slog.New(handler))
}
