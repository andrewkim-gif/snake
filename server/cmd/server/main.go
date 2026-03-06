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
	"github.com/andrewkim-gif/snake/server/internal/api"
	"github.com/andrewkim-gif/snake/server/internal/cache"
	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/meta"
	"github.com/andrewkim-gif/snake/server/internal/observability"
	"github.com/andrewkim-gif/snake/server/internal/security"
	"github.com/andrewkim-gif/snake/server/internal/world"
	"github.com/andrewkim-gif/snake/server/internal/ws"
	"golang.org/x/sync/errgroup"
)

func main() {
	// ================================================================
	// 1. Structured Logging (JSON for Railway log aggregation)
	// ================================================================
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// ================================================================
	// 2. Configuration
	// ================================================================
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

	// S42: Enforce production secrets in production mode
	if cfg.Environment == "production" {
		security.EnforceProductionSecrets()
	}

	// ================================================================
	// 3. Observability (Prometheus metrics + /metrics endpoint)
	// ================================================================
	metrics := observability.NewMetrics()
	// Configure alert webhook if set
	if webhookURL := os.Getenv("ALERT_WEBHOOK_URL"); webhookURL != "" {
		metrics.SetAlertWebhook(webhookURL)
		slog.Info("alert webhook configured")
	}
	slog.Info("observability initialized", "prometheusEnabled", true)

	// ================================================================
	// 4. Redis (optional — graceful fallback if unavailable)
	// ================================================================
	var redisClient *cache.RedisClient
	redisCfg := cache.DefaultConfig()
	rc, redisErr := cache.New(redisCfg)
	if redisErr != nil {
		slog.Warn("Redis unavailable — running without cache/pubsub",
			"addr", redisCfg.Addr,
			"error", redisErr,
		)
	} else {
		redisClient = rc
		slog.Info("Redis connected", "addr", redisCfg.Addr)
	}

	// Cache pipeline writer (if Redis available)
	var pipelineWriter *cache.PipelineWriter
	if redisClient != nil {
		pipelineWriter = cache.NewPipelineWriter(redisClient)
		_ = pipelineWriter // used by WorldManager internally
	}

	// ================================================================
	// 5. v10 Core: WebSocket Hub + RoomManager (backward compatible)
	// ================================================================
	hub := ws.NewHub()

	roomCfg := game.DefaultRoomConfig()
	roomCfg.MaxRooms = cfg.MaxRooms
	roomManager := game.NewRoomManager(roomCfg)
	roomManager.OnEvents = createRoomEventHandler(hub)

	// v10 Agent subsystems
	agentCmdRouter := game.NewAgentCommandRouter()
	trainingStore := game.NewTrainingStore("data")
	memoryStore := game.NewMemoryStore("data")
	progressionStore := game.NewProgressionStore("data")
	questStore := game.NewQuestStore(progressionStore)
	globalLeaderboard := game.NewGlobalLeaderboard(progressionStore)

	// ================================================================
	// 6. v11 World Manager (195 countries)
	// ================================================================
	worldCfg := world.DefaultWorldConfig()
	if redisClient != nil {
		worldCfg.RedisSyncEnabled = true
	}
	worldManager := world.NewWorldManager(worldCfg, redisClient)

	// Sovereignty engine
	sovCfg := world.DefaultSovereigntyConfig()
	sovereigntyEngine := world.NewSovereigntyEngine(sovCfg, worldManager, redisClient)
	worldManager.SetSovereignty(sovereigntyEngine)

	// Deployment manager
	deployCfg := world.DefaultDeploymentConfig()
	deploymentManager := world.NewDeploymentManager(deployCfg, worldManager)

	// Siege manager
	siegeCfg := world.DefaultSiegeConfig()
	siegeManager := world.NewSiegeManager(siegeCfg)

	// Continental bonus engine
	continentalEngine := world.NewContinentalBonusEngine()

	// S45: Validate seed data
	countryCount := world.CountryCount()
	if countryCount < 195 {
		slog.Warn("seed data incomplete",
			"expected", 195,
			"actual", countryCount,
		)
	}

	slog.Info("v11 world initialized",
		"countries", countryCount,
		"maxConcurrentArenas", worldCfg.MaxConcurrentArenas,
		"seedValid", countryCount >= 195,
	)

	// ================================================================
	// 7. v11 Meta Managers (economy, faction, diplomacy, etc.)
	// ================================================================

	// --- Faction (core, no deps) ---
	factionManager := meta.NewFactionManager()

	// --- Economy ---
	economyCfg := meta.DefaultEconomyConfig()
	economyEngine := meta.NewEconomyEngine(economyCfg)

	// --- Trade ---
	tradeCfg := meta.DefaultTradeConfig()
	tradeEngine := meta.NewTradeEngine(tradeCfg)

	// --- GDP ---
	gdpFormula := meta.DefaultGDPFormula()
	gdpEngine := meta.NewGDPEngine(gdpFormula, economyEngine, factionManager, tradeEngine)

	// --- Policy ---
	policyEngine := meta.NewPolicyEngine(economyEngine, factionManager)

	// --- Diplomacy ---
	diplomacyCfg := meta.DefaultDiplomacyConfig()
	diplomacyEngine := meta.NewDiplomacyEngine(diplomacyCfg)

	// --- War ---
	warManager := meta.NewWarManager(factionManager, diplomacyEngine)

	// --- Season ---
	seasonCfg := meta.DefaultSeasonConfig()
	seasonEngine := meta.NewSeasonEngine(seasonCfg)

	// --- Season Reset ---
	seasonResetEngine := meta.NewSeasonResetEngine(seasonEngine, factionManager, economyEngine)

	// --- Hall of Fame ---
	hallOfFameEngine := meta.NewHallOfFameEngine(seasonResetEngine)

	// --- Achievement ---
	achievementEngine := meta.NewAchievementEngine()

	// --- Tech Tree ---
	techTreeManager := meta.NewTechTreeManager()

	// --- Intel ---
	intelSystem := meta.NewIntelSystem()

	// --- Events ---
	eventsCfg := meta.DefaultEventEngineConfig()
	eventEngine := meta.NewEventEngine(eventsCfg)

	// --- UN Council ---
	unCouncil := meta.NewUNCouncil()

	// --- Mercenary Market ---
	mercenaryMarket := meta.NewMercenaryMarket()

	// --- News ---
	newsManager := meta.NewNewsManager()

	// --- Agent Manager ---
	agentManager := meta.NewAgentManager(factionManager)

	slog.Info("v11 meta managers initialized",
		"modules", 16,
		"economy", "ready",
		"faction", "ready",
		"diplomacy", "ready",
		"war", "ready",
		"season", "ready",
		"trade", "ready",
		"gdp", "ready",
		"policy", "ready",
		"techTree", "ready",
		"intel", "ready",
		"events", "ready",
		"council", "ready",
		"mercenary", "ready",
		"hallOfFame", "ready",
		"achievement", "ready",
		"news", "ready",
	)

	// ================================================================
	// 7b. Auto-initialize Season 1 if no season active (S45)
	// ================================================================
	if seasonEngine.GetCurrentSeason() == nil {
		season1, err := seasonEngine.CreateSeason("Era of Dawn", "season_1")
		if err != nil {
			slog.Warn("could not auto-create Season 1", "error", err)
		} else {
			slog.Info("Season 1 auto-initialized",
				"name", season1.Name,
				"id", season1.ID,
				"duration", seasonCfg.SeasonDuration.String(),
			)
		}
	} else {
		current := seasonEngine.GetCurrentSeason()
		slog.Info("existing season detected",
			"name", current.Name,
			"id", current.ID,
			"status", current.Status,
		)
	}

	// ================================================================
	// 8. Agent REST API (S24) + Agent WebSocket Stream (S25)
	// ================================================================
	agentRouter := api.NewAgentRouter()
	agentStreamHub := ws.NewAgentStreamHub()

	// ================================================================
	// 9. Event Router (client→server WebSocket events)
	// ================================================================
	eventRouter := ws.NewEventRouter()
	registerEventHandlers(eventRouter, hub, roomManager, agentCmdRouter)

	// ================================================================
	// 10. HTTP Router (all routes)
	// ================================================================
	router := newRouter(cfg, hub, eventRouter, roomManager, &RouterDeps{
		TrainingStore:     trainingStore,
		MemoryStore:       memoryStore,
		ProgressionStore:  progressionStore,
		QuestStore:        questStore,
		GlobalLeaderboard: globalLeaderboard,
		AgentRouter:       agentRouter,
		AgentStreamHub:    agentStreamHub,
		// v11 modules for route mounting
		WorldManager:      worldManager,
		FactionManager:    factionManager,
		EconomyEngine:     economyEngine,
		TradeEngine:       tradeEngine,
		GDPEngine:         gdpEngine,
		PolicyEngine:      policyEngine,
		DiplomacyEngine:   diplomacyEngine,
		WarManager:        warManager,
		SeasonEngine:      seasonEngine,
		SeasonResetEngine: seasonResetEngine,
		HallOfFameEngine:  hallOfFameEngine,
		AchievementEngine: achievementEngine,
		TechTreeManager:   techTreeManager,
		IntelSystem:       intelSystem,
		EventEngine:       eventEngine,
		UNCouncil:         unCouncil,
		MercenaryMarket:   mercenaryMarket,
		NewsManager:       newsManager,
		AgentManager:      agentManager,
		DeploymentManager: deploymentManager,
		SiegeManager:      siegeManager,
		ContinentalEngine: continentalEngine,
		Metrics:           metrics,
	})

	// ================================================================
	// 11. HTTP Server
	// ================================================================
	httpServer := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// ================================================================
	// 12. Start All Systems
	// ================================================================
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	g, gCtx := errgroup.WithContext(ctx)

	// --- WebSocket Hub ---
	g.Go(func() error {
		slog.Info("WS Hub starting")
		hub.Run()
		return nil
	})

	// --- v10 RoomManager (backward compatible) ---
	g.Go(func() error {
		slog.Info("v10 RoomManager starting")
		roomManager.Start(gCtx)
		return nil
	})

	// --- v10 Lobby broadcast (1Hz) ---
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

	// --- v11 WorldManager (195 countries) ---
	g.Go(func() error {
		slog.Info("v11 WorldManager starting", "countries", world.CountryCount())
		worldManager.Start(gCtx)
		return nil
	})

	// --- v11 Economy Engine (1-hour ticks) ---
	g.Go(func() error {
		slog.Info("v11 EconomyEngine starting")
		economyEngine.Start(gCtx)
		return nil
	})

	// --- v11 Season Engine (era transitions) ---
	g.Go(func() error {
		slog.Info("v11 SeasonEngine starting")
		seasonEngine.Start(gCtx)
		return nil
	})

	// --- v11 Event Engine (random events) ---
	g.Go(func() error {
		slog.Info("v11 EventEngine starting")
		eventEngine.Start(gCtx)
		return nil
	})

	// --- v11 Agent Stream Hub ---
	g.Go(func() error {
		slog.Info("v11 AgentStreamHub starting")
		agentStreamHub.Run()
		return nil
	})

	// --- Observability: metrics reporter (logs summary every 60s) ---
	g.Go(func() error {
		metrics.StartReporter(gCtx)
		return nil
	})

	// --- HTTP Server ---
	g.Go(func() error {
		slog.Info("HTTP server starting", "addr", cfg.Addr())
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	})

	// --- Signal Watcher (graceful shutdown) ---
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

		slog.Info("stopping v11 engines...")
		economyEngine.Stop()
		seasonEngine.Stop()
		eventEngine.Stop()
		worldManager.Stop()

		slog.Info("stopping v10 RoomManager...")
		roomManager.Stop()

		slog.Info("stopping WS Hub...")
		hub.Stop()

		slog.Info("server stopped")
		return nil
	})

	// ================================================================
	// 13. Log startup banner
	// ================================================================
	slog.Info("=== AI World War v11 Server ===",
		"version", "11.0.0",
		"v10_rooms", cfg.MaxRooms,
		"v11_countries", world.CountryCount(),
		"v11_meta_modules", 16,
		"addr", cfg.Addr(),
	)

	// Record server start in metrics
	metrics.RecordServerStart()

	// ================================================================
	// Wait for all goroutines
	// ================================================================
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
			roomID, err = rm.QuickJoin(client.ID, payload.Name, payload.SkinID, payload.Appearance)
		} else {
			roomID, err = rm.JoinRoom(client.ID, payload.RoomID, payload.Name, payload.SkinID, payload.Appearance)
			if err != nil {
				// Room not found (e.g. ISO3 country code) → fallback to QuickJoin
				slog.Info("room not found, falling back to QuickJoin",
					"requestedRoom", payload.RoomID,
					"clientId", client.ID,
				)
				roomID, err = rm.QuickJoin(client.ID, payload.Name, payload.SkinID, payload.Appearance)
			}
		}

		if err != nil {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "join_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		hub.MoveClientToRoom(client.ID, roomID)

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

	// Respawn — disabled in 1-life mode
	router.On(ws.EventRespawn, func(client *ws.Client, data json.RawMessage) {
		slog.Info("respawn received (1-life mode, ignored)", "clientId", client.ID)
	})

	// Choose Upgrade
	router.On(ws.EventChooseUpgrade, func(client *ws.Client, data json.RawMessage) {
		var payload ws.ChooseUpgradePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		choiceIndex := 0
		switch payload.ChoiceID {
		case "0":
			choiceIndex = 0
		case "1":
			choiceIndex = 1
		case "2":
			choiceIndex = 2
		default:
			if len(payload.ChoiceID) > 0 {
				if payload.ChoiceID[0] >= '0' && payload.ChoiceID[0] <= '9' {
					choiceIndex = int(payload.ChoiceID[0] - '0')
				}
			}
		}

		rm.RouteChooseUpgrade(client.ID, choiceIndex)
	})

	// --- Agent-specific event handlers ---

	// Agent Authentication
	router.On(ws.EventAgentAuth, func(client *ws.Client, data json.RawMessage) {
		var payload ws.AgentAuthPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid agent_auth payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.APIKey == "" || payload.AgentID == "" {
			frame, _ := ws.EncodeFrame(ws.EventAgentAuthResult, domain.AgentAuthResult{
				Success: false,
				Error:   "missing api_key or agent_id",
			})
			client.Send(frame)
			return
		}

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

	// Agent Commander Mode Command
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

	// Agent Observe Game
	router.On(ws.EventAgentObserveReq, func(client *ws.Client, data json.RawMessage) {
		if !client.IsAgent {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "not_agent",
				Message: "observe_game requires agent authentication",
			})
			client.Send(errFrame)
			return
		}

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
				hub.SendToClient(evt.TargetID, frame)
			} else {
				hub.BroadcastToRoom(evt.RoomID, frame)
			}
		}
	}
}
