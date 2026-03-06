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
	// 5. v11 Core: WebSocket Hub (RoomManager replaced by WorldManager)
	// ================================================================
	hub := ws.NewHub()

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

	// Wire WorldManager events to Hub (replaces createRoomEventHandler)
	worldManager.OnEvents = createWorldEventHandler(hub)

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
	registerEventHandlers(eventRouter, hub, worldManager, agentCmdRouter)

	// ================================================================
	// 10. HTTP Router (all routes)
	// ================================================================
	router := newRouter(cfg, hub, eventRouter, worldManager, &RouterDeps{
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

	// NOTE: v10 RoomManager removed — all game rooms managed by WorldManager

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
		"v11_countries", world.CountryCount(),
		"v11_meta_modules", 16,
		"maxConcurrentArenas", worldCfg.MaxConcurrentArenas,
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
// v11: Routes through WorldManager (195 countries) instead of v10 RoomManager (5 rooms).
func registerEventHandlers(router *ws.EventRouter, hub *ws.Hub, wm *world.WorldManager, agentCmdRouter *game.AgentCommandRouter) {
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

	// Join Room (v11: country ISO3 code as roomId)
	router.On(ws.EventJoinRoom, func(client *ws.Client, data json.RawMessage) {
		var payload ws.JoinRoomPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid join_room payload", "clientId", client.ID, "error", err)
			return
		}

		countryISO := payload.RoomID
		slog.Info("join_room received",
			"clientId", client.ID,
			"country", countryISO,
			"name", payload.Name,
		)

		if countryISO == "" || countryISO == "quick" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "join_failed",
				Message: "country ISO3 code required (click a country on the map)",
			})
			client.Send(errFrame)
			return
		}

		// Join country arena via WorldManager (creates arena on-demand)
		if err := wm.JoinCountry(client.ID, countryISO, payload.Name, payload.SkinID, payload.Appearance); err != nil {
			slog.Warn("join_country failed",
				"clientId", client.ID,
				"country", countryISO,
				"error", err,
			)
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "join_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		// Move client from lobby to country room in WS Hub
		hub.MoveClientToRoom(client.ID, countryISO)

		// Send joined event
		arena := wm.GetActiveArena(countryISO)
		if arena != nil {
			joinedEvt := arena.GetJoinedEvent(client.ID)
			frame, err := ws.EncodeFrame(ws.EventJoined, joinedEvt)
			if err == nil {
				client.Send(frame)
			}
		}
	})

	// Leave Room
	router.On(ws.EventLeaveRoom, func(client *ws.Client, data json.RawMessage) {
		slog.Info("leave_room received", "clientId", client.ID)
		wm.LeaveCountry(client.ID)
		wm.LeaveSpectate(client.ID)
		hub.RegisterLobby(client)
	})

	// Input
	router.On(ws.EventInput, func(client *ws.Client, data json.RawMessage) {
		var payload ws.InputPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		boost := payload.Boost == 1
		wm.RouteInput(client.ID, payload.Angle, boost)
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

		wm.RouteChooseUpgrade(client.ID, choiceIndex)
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

		wm.RouteChooseUpgrade(client.ID, payload.ChoiceIndex)
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

		countryISO := wm.GetPlayerCountry(client.ID)
		if countryISO == "" {
			return
		}
		arena := wm.GetActiveArena(countryISO)
		if arena == nil {
			return
		}

		agent, ok := arena.GetArena().GetAgent(client.ID)
		if !ok || !agent.Alive {
			return
		}

		if err := agentCmdRouter.ExecuteCommand(client.ID, agent, arena.GetArena(), payload.Cmd, payload.Data); err != nil {
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

		countryISO := wm.GetPlayerCountry(client.ID)
		if countryISO == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "not_in_room",
				Message: "observe_game: not in a country arena",
			})
			client.Send(errFrame)
			return
		}
		arena := wm.GetActiveArena(countryISO)
		if arena == nil {
			return
		}

		agent, ok := arena.GetArena().GetAgent(client.ID)
		if !ok {
			return
		}

		observation := game.BuildObserveGameResponse(agent, arena.GetArena())
		if observation != nil {
			frame, err := ws.EncodeFrame(ws.EventAgentObserveGame, observation)
			if err == nil {
				client.Send(frame)
			}
		}
	})
}

// createWorldEventHandler bridges WorldManager events to the WebSocket Hub.
// Handles two types of events:
// 1. WorldEvtCountryUpdate — wraps game.RoomEvent, forwarded to room/client
// 2. WorldEvtCountriesState — 1Hz country state broadcast to lobby
func createWorldEventHandler(hub *ws.Hub) world.WorldEventCallback {
	return func(events []world.WorldEvent) {
		for _, wEvt := range events {
			switch wEvt.Type {
			case world.WorldEvtCountriesState:
				// Broadcast country states to all lobby clients
				frame, err := ws.EncodeFrame(ws.EventCountriesState, wEvt.Data)
				if err != nil {
					slog.Error("failed to encode countries_state", "error", err)
					continue
				}
				hub.BroadcastToLobby(frame)

			case world.WorldEvtCountryUpdate:
				// Unwrap the embedded game.RoomEvent
				roomEvt, ok := wEvt.Data.(game.RoomEvent)
				if !ok {
					continue
				}

				var wsEvent string
				switch roomEvt.Type {
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
				case game.RoomEvtBattleComplete:
					wsEvent = ws.EventBattleComplete
				case game.RoomEvtAbilityTriggered:
					wsEvent = ws.EventAbilityTriggered
				default:
					continue
				}

				frame, err := ws.EncodeFrame(wsEvent, roomEvt.Data)
				if err != nil {
					slog.Error("failed to encode event", "event", wsEvent, "error", err)
					continue
				}

				if roomEvt.TargetID != "" {
					hub.SendToClient(roomEvt.TargetID, frame)
				} else {
					// RoomID = country ISO code
					hub.BroadcastToRoom(roomEvt.RoomID, frame)
				}

			case world.WorldEvtBattleStart, world.WorldEvtBattleEnd:
				// Broadcast battle lifecycle events to the specific country room
				frame, err := ws.EncodeFrame(string(wEvt.Type), wEvt.Data)
				if err != nil {
					continue
				}
				if wEvt.CountryISO != "" {
					hub.BroadcastToRoom(wEvt.CountryISO, frame)
				}
				// Also notify lobby clients
				hub.BroadcastToLobby(frame)

			case world.WorldEvtSovereigntyChange:
				// Broadcast sovereignty changes to everyone
				frame, err := ws.EncodeFrame(string(wEvt.Type), wEvt.Data)
				if err != nil {
					continue
				}
				hub.BroadcastToLobby(frame)
				if wEvt.CountryISO != "" {
					hub.BroadcastToRoom(wEvt.CountryISO, frame)
				}
			}
		}
	}
}
