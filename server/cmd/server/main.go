package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andrewkim-gif/snake/server/config"
	"github.com/andrewkim-gif/snake/server/internal/api"
	"github.com/andrewkim-gif/snake/server/internal/blockchain"
	"github.com/andrewkim-gif/snake/server/internal/blockchain/ramp"
	"github.com/andrewkim-gif/snake/server/internal/cache"
	"github.com/andrewkim-gif/snake/server/internal/db"
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
	// 4b. Supabase REST API (optional — graceful fallback if unavailable)
	// ================================================================
	var pgDB *db.DB
	pgConn, pgErr := db.NewFromEnv()
	if pgErr != nil {
		slog.Warn("Supabase unavailable — running without persistence",
			"error", pgErr,
		)
	} else if pgConn == nil {
		slog.Info("SUPABASE_URL not set — running without persistence")
	} else {
		pgDB = pgConn
		defer pgDB.Close()

		// Verify connectivity
		if err := pgDB.HealthCheck(context.Background()); err != nil {
			slog.Error("Supabase health check failed", "error", err)
			pgDB.Close()
			pgDB = nil
		} else {
			slog.Info("Supabase REST connected")
		}
	}
	// Store is created after managers are initialized (see section 7d below)
	// pgDB is used in section 7d for Store wiring

	// ================================================================
	// 4c. PostgreSQL Direct Pool (for Tycoon engines — optional)
	// ================================================================
	var tycoonMgr *game.TycoonManager
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		pgPool, pgPoolErr := db.NewPGPool(context.Background(), dbURL)
		if pgPoolErr != nil {
			slog.Warn("DATABASE_URL set but PGPool failed — tycoon engines disabled",
				"error", pgPoolErr,
			)
		} else {
			defer pgPool.Close()

			// 마이그레이션 실행
			if migErr := db.RunMigrations(context.Background(), pgPool.Pool, "data/migrations"); migErr != nil {
				slog.Warn("tycoon migrations failed — continuing without",
					"error", migErr,
				)
			} else {
				slog.Info("tycoon migrations applied")
			}

			// 타이쿤 매니저 초기화
			tycoonMgr = game.NewTycoonManager(pgPool.Pool)
			slog.Info("TycoonManager initialized",
				"engines", 9,
				"buildings", "ready",
				"territory", "ready",
				"auction", "ready",
				"income", "ready",
				"military", "ready",
				"battle", "ready",
				"trade", "ready",
				"merge", "ready",
				"diplomacy", "ready",
			)
		}
	} else {
		slog.Info("DATABASE_URL not set — tycoon engines disabled (classic mode)")
	}

	// ================================================================
	// 5. v11 Core: WebSocket Hub (RoomManager replaced by WorldManager)
	// ================================================================
	hub := ws.NewHub()

	// v10 Agent subsystems
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

	// NOTE: WorldManager.OnEvents is wired after v14 systems are created (see below)

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
	// Allow faster tick interval via env var (e.g. "30s" for simulations)
	if tickEnv := os.Getenv("ECONOMY_TICK_INTERVAL"); tickEnv != "" {
		if d, err := time.ParseDuration(tickEnv); err == nil {
			economyCfg.TickInterval = d
			slog.Info("economy tick interval overridden", "interval", d)
		}
	}
	economyEngine := meta.NewEconomyEngine(economyCfg)

	// Initialize economy for all 195 countries from seed data
	for _, seed := range world.AllCountries {
		economyEngine.InitializeCountry(
			seed.ISO3,
			string(seed.Tier),
			seed.Resources.Oil,
			seed.Resources.Minerals,
			seed.Resources.Food,
			seed.Resources.Tech,
			seed.Resources.Manpower,
		)
	}
	slog.Info("economy initialized", "countries", len(world.AllCountries))

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
	// v25: SEASON_DURATION env var for simulation (e.g. "1h" for 1-hour season → 15min per era)
	if sdEnv := os.Getenv("SEASON_DURATION"); sdEnv != "" {
		if d, err := time.ParseDuration(sdEnv); err == nil {
			seasonCfg.SeasonDuration = d
			slog.Info("season duration override", "duration", d)
		}
	}
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
	// 7d. Database Store Wiring (v18 — Supabase PostgreSQL persistence)
	// ================================================================
	if pgDB != nil {
		store := db.NewStore(pgDB)
		factionManager.SetStore(db.NewFactionStoreAdapter(store))
		seasonEngine.SetStore(db.NewSeasonStoreAdapter(store))
		diplomacyEngine.SetStore(db.NewDiplomacyStoreAdapter(store))
		economyEngine.SetStore(db.NewCountryStoreAdapter(store))

		// Load persisted data from DB into in-memory managers
		if err := factionManager.LoadFromDB(); err != nil {
			slog.Warn("failed to load factions from DB", "error", err)
		}
		if err := seasonEngine.LoadFromDB(); err != nil {
			slog.Warn("failed to load seasons from DB", "error", err)
		}
		if err := diplomacyEngine.LoadFromDB(); err != nil {
			slog.Warn("failed to load diplomacy from DB", "error", err)
		}
		slog.Info("Store wired — persistence active")
	}

	// ================================================================
	// 7c. v14 In-Game Total Overhaul — Core Systems
	// ================================================================

	// --- CountryArenaManager (v14 per-country arenas with epoch system) ---
	v14ArenaManager := game.NewCountryArenaManager(game.DefaultRoomConfig())
	v14ArenaManager.OnEvents = func(events []game.RoomEvent) {
		// Forward v14 arena events to WS hub using same pattern as v11
		for _, evt := range events {
			var wsEvent string
			switch evt.Type {
			case game.RoomEvtDeath:
				wsEvent = ws.EventDeath
			case game.RoomEvtKill:
				wsEvent = ws.EventKill
			case game.RoomEvtLevelUp:
				wsEvent = ws.EventLevelUp
			case game.RoomEvtState:
				wsEvent = ws.EventState
			case game.RoomEvtMinimap:
				wsEvent = ws.EventMinimap
			default:
				continue
			}
			frame, err := ws.EncodeFrame(wsEvent, evt.Data)
			if err != nil {
				continue
			}
			if evt.TargetID != "" {
				hub.SendToClient(evt.TargetID, frame)
			} else {
				hub.BroadcastToRoom(evt.RoomID, frame)
			}
		}
	}

	// --- TickProfiler (performance monitoring, NFR-01: 50ms/tick budget) ---
	tickProfiler := game.NewTickProfiler()

	// --- BandwidthMonitor (NFR-02: 50KB/s per client) ---
	bandwidthMonitor := game.NewBandwidthMonitor()

	// --- EventLog (global news ticker for lobby clients) ---
	v14EventLog := game.NewEventLog()
	v14EventLog.OnBroadcast = func(event game.GlobalEvent) {
		frame, err := ws.EncodeFrame("global_event", event)
		if err != nil {
			slog.Error("failed to encode global_event", "error", err)
			return
		}
		hub.BroadcastToLobby(frame)
	}

	// --- AccountLevelManager (account XP + cosmetic coins + titles) ---
	v14AccountLevelMgr := game.NewAccountLevelManager()

	// --- DailyChallengeManager (3 daily challenges, needs AccountLevelManager) ---
	v14ChallengeMgr := game.NewDailyChallengeManager(v14AccountLevelMgr)

	// --- AchievementManager (30 permanent achievements) ---
	v14AchievementMgr := game.NewAchievementManager(v14AccountLevelMgr)
	v14AchievementMgr.OnUnlock = func(event game.AchievementUnlockEvent) {
		frame, err := ws.EncodeFrame("achievements_update", event)
		if err != nil {
			slog.Error("failed to encode achievements_update", "error", err)
			return
		}
		hub.SendToClient(event.PlayerID, frame)
	}

	// --- WarSystem (v14 war state machine: declaration → prep → active → ended) ---
	// Dependencies: sovereignty tracker lookup, continent lookup, adjacency check
	v14WarSystem := game.NewWarSystem(
		func(countryCode string) *game.SovereigntyTracker {
			// Placeholder: v14 sovereignty tracked per-arena
			return nil
		},
		func(countryCode string) game.ContinentCode {
			// Lookup continent from world seed data
			for _, c := range world.AllCountries {
				if c.ISO3 == countryCode {
					return game.ContinentCode(c.Continent)
				}
			}
			return ""
		},
		func(a, b string) bool {
			// Adjacency check via world seed data
			for _, c := range world.AllCountries {
				if c.ISO3 == a {
					for _, adj := range c.Adjacency {
						if adj == b {
							return true
						}
					}
					break
				}
			}
			return false
		},
	)
	// v30: forward reference — v14TokenRewardMgr가 뒤에서 생성되므로 클로저에서 참조합니다
	var tokenRewardMgrRef *game.TokenRewardManager

	v14WarSystem.OnEvent = func(event game.WarEvent) {
		// Broadcast war events to lobby
		frame, err := ws.EncodeFrame("war_event", event)
		if err != nil {
			slog.Error("failed to encode war_event", "error", err)
			return
		}
		hub.BroadcastToLobby(frame)

		// Log war events to global event log
		switch event.Type {
		case game.WarEvtDeclared:
			v14EventLog.LogWarDeclared(event.Attacker, event.Attacker, event.Defender, event.Defender)
		case game.WarEvtEnded:
			winner, loser := event.Attacker, event.Defender
			if event.Outcome == game.WarOutcomeDefenderWin {
				winner, loser = event.Defender, event.Attacker
			}
			v14EventLog.LogWarEnded(winner, winner, loser, loser, event.Outcome)

			// v30 Task 1-1: 전쟁 종료 시 승리 보상 큐에 적재합니다
			// NOTE: tokenRewardMgrRef는 v14TokenRewardMgr 생성 후 할당됩니다
			if tokenRewardMgrRef != nil {
				// 승리자의 점수를 보상 계산에 사용합니다
				winnerScore := event.AttackerScore
				if event.Outcome == game.WarOutcomeDefenderWin {
					winnerScore = event.DefenderScore
				}
				tokenRewardMgrRef.QueueWarVictoryReward(
					winner, winner, winner, winnerScore, v14AccountLevelMgr,
				)
			}
		}
	}

	// --- v18: Wire meta module EventLog callbacks for live news feed ---
	factionManager.OnFactionCreated = func(name, tag, countryISO string) {
		v14EventLog.LogFactionCreated(name, tag, countryISO)
	}
	diplomacyEngine.OnTreatySigned = func(factionA, factionB, treatyType string) {
		v14EventLog.LogTreatySigned(factionA, factionB, treatyType)
	}
	diplomacyEngine.OnTreatyBroken = func(breaker, otherFaction, treatyType string) {
		v14EventLog.LogTreatyBroken(breaker, otherFaction, treatyType)
	}
	techTreeManager.OnTechCompleted = func(factionName, techName, nodeID string) {
		v14EventLog.LogTechCompleted(factionName, techName, nodeID)
	}
	warManager.OnWarDeclared = func(attackerName, defenderName string) {
		v14EventLog.LogWarDeclared(attackerName, attackerName, defenderName, defenderName)
	}
	warManager.OnWarEnded = func(winnerName, loserName, reason string) {
		v14EventLog.LogWarEnded(winnerName, winnerName, loserName, loserName, game.WarOutcomeTruce)
	}
	policyEngine.OnPolicyChanged = func(countryISO, factionID, policyCategory string, newValue float64) {
		v14EventLog.LogPolicyChanged(countryISO, countryISO, factionID, policyCategory, fmt.Sprintf("%.2f", newValue))
	}
	slog.Info("v18 EventLog callbacks wired", "modules", []string{"faction", "diplomacy", "techTree", "war", "policy"})

	// --- TokenRewardManager (blockchain token distribution) ---
	// Initialize blockchain infra (optional, no-op if RPC unavailable)
	var buybackEngine *blockchain.BuybackEngine
	var defenseOracle *blockchain.DefenseOracle
	crossRPC := os.Getenv("CROSS_RPC_URL")
	if crossRPC != "" {
		buybackEngine = blockchain.NewBuybackEngine(crossRPC)
		defenseOracle = blockchain.NewDefenseOracle(crossRPC)

		// Phase 0: 195개국을 DefenseOracle과 BuybackEngine에 일괄 등록합니다
		for _, seed := range world.AllCountries {
			defenseOracle.RegisterCountry(seed.ISO3)
			buybackEngine.RegisterCountry(seed.ISO3, "") // treasury 주소는 Phase 3+에서 설정 예정
		}
		slog.Info("v14 blockchain infra initialized",
			"rpcURL", crossRPC,
			"registeredCountries", len(world.AllCountries),
		)
	} else {
		// v30 Task 1-2/1-3: RPC 없으면 시뮬레이션 모드로 초기화합니다
		buybackEngine = blockchain.NewBuybackEngine("") // 시뮬레이션 모드 (no RPC)
		defenseOracle = blockchain.NewDefenseOracle("")  // 시뮬레이션 모드 (GDP 기반 폴백)
		for _, seed := range world.AllCountries {
			defenseOracle.RegisterCountry(seed.ISO3)
			buybackEngine.RegisterCountry(seed.ISO3, "")
		}
		slog.Info("v14 blockchain infra: simulation mode (no CROSS_RPC_URL)",
			"registeredCountries", len(world.AllCountries),
		)
	}
	v14TokenRewardMgr := game.NewTokenRewardManager(buybackEngine, defenseOracle)
	tokenRewardMgrRef = v14TokenRewardMgr // v30: forward reference 할당
	v14TokenRewardMgr.OnRewardDistributed = func(event game.TokenRewardEvent) {
		frame, err := ws.EncodeFrame("token_reward", event)
		if err != nil {
			slog.Error("failed to encode token_reward", "error", err)
			return
		}
		hub.SendToClient(event.PlayerID, frame)
	}

	// --- InactiveArenaReaper (memory release for idle arenas) ---
	v14ArenaReaper := game.NewInactiveArenaReaper()

	// --- CrossArenaManager (cross-arena invasion during wars) ---
	v14CrossArenaMgr := game.NewCrossArenaManager(v14WarSystem, v14ArenaManager)
	v14CrossArenaMgr.OnEvent = func(event game.CrossArenaEvent) {
		frame, err := ws.EncodeFrame("cross_arena_event", event)
		if err != nil {
			slog.Error("failed to encode cross_arena_event", "error", err)
			return
		}
		if event.CountryCode != "" {
			hub.BroadcastToRoom(event.CountryCode, frame)
		}
		hub.BroadcastToLobby(frame)
	}

	slog.Info("v14 in-game systems initialized",
		"modules", 11,
		"countryArenaManager", "ready",
		"tickProfiler", "ready",
		"bandwidthMonitor", "ready",
		"eventLog", "ready",
		"accountLevel", "ready",
		"challenges", "ready",
		"achievements", "ready",
		"warSystem", "ready",
		"tokenRewards", "ready",
		"arenaReaper", "ready",
		"crossArena", "ready",
	)

	// ================================================================
	// 7c-2. Wire WorldManager events → Hub + v14 modules
	// ================================================================
	// The v14Sys struct is created here so createWorldEventHandler can
	// forward kill/death events to v14 modules (CrossArenaManager, etc.)
	v14SysForEvents := &V14Systems{
		ArenaManager:    v14ArenaManager,
		AccountLevelMgr: v14AccountLevelMgr,
		ChallengeMgr:    v14ChallengeMgr,
		AchievementMgr:  v14AchievementMgr,
		WarSystem:       v14WarSystem,
		TokenRewardMgr:  v14TokenRewardMgr,
		EventLog:        v14EventLog,
		TickProfiler:    tickProfiler,
		CrossArenaMgr:   v14CrossArenaMgr,
		Hub:             hub,
	}
	worldManager.OnEvents = createWorldEventHandler(hub, v14SysForEvents)

	// ================================================================
	// 7c-3. Wire v14 EpochManager events → WebSocket Hub
	// ================================================================
	// The CountryArenaManager's OnEvents callback handles RoomEvents
	// (state, kill, death, etc.) but EpochManager events (epoch_start,
	// epoch_end, war_phase_start, etc.) need separate wiring.
	// Each arena's EpochManager.OnEvents is set when the arena is created.
	// We set a factory callback so newly-created arenas get the wiring.
	v14ArenaManager.OnEpochEvents = func(events []game.EpochEvent) {
		for _, evt := range events {
			var wsEvent string
			switch evt.Type {
			case game.EpochEvtEpochStart:
				wsEvent = ws.EventEpochStart
			case game.EpochEvtEpochEnd:
				wsEvent = ws.EventEpochEnd

				// On epoch end, process batch results for v14 account/challenge/achievement systems
				if endData, ok := evt.Data.(game.EpochEndData); ok {
					processEpochEndForV14(endData, v14SysForEvents)
				}

			case game.EpochEvtWarPhaseStart:
				wsEvent = ws.EventWarPhaseStart
			case game.EpochEvtWarPhaseEnd:
				wsEvent = ws.EventWarPhaseEnd
			case game.EpochEvtWarCountdown:
				wsEvent = ws.EventRespawnCountdown
			case game.EpochEvtShrinkUpdate:
				wsEvent = ws.EventArenaShrink
			case game.EpochEvtWarSiren:
				wsEvent = "war_siren"
			case game.EpochEvtPhaseChange:
				wsEvent = "epoch_phase_change"
			default:
				continue
			}

			frame, err := ws.EncodeFrame(wsEvent, evt.Data)
			if err != nil {
				slog.Error("failed to encode epoch event", "event", wsEvent, "error", err)
				continue
			}
			if evt.CountryCode != "" {
				hub.BroadcastToRoom(evt.CountryCode, frame)
			}
		}
	}

	// ================================================================
	// 7c-4. Wire v14 CapturePoint events → WebSocket Hub
	// ================================================================
	v14ArenaManager.OnCaptureEvent = func(event game.CapturePointEvent) {
		frame, err := ws.EncodeFrame(ws.EventCapturePointUpdate, event)
		if err != nil {
			slog.Error("failed to encode capture_point_update", "error", err)
			return
		}
		if event.CountryCode != "" {
			hub.BroadcastToRoom(event.CountryCode, frame)
		}
	}

	// ================================================================
	// 7c-5. Wire v15 Domination events → WebSocket Hub (domination_update)
	// ================================================================
	v14ArenaManager.OnDominationEvent = func(event game.DominationEvent) {
		// Map DominationStatus → level int
		level := 0
		switch {
		case event.Type == game.DomEvtNewDominant || event.Type == game.DomEvtDefended:
			level = 1
		}
		msg := ws.DominationUpdateMsg{
			Countries: []ws.DominationCountryData{{
				CountryCode:    event.CountryCode,
				DominantNation: event.DominantNation,
				Status:         string(event.Type),
				Level:          level,
			}},
		}
		frame, err := ws.EncodeFrame(ws.EventDominationUpdate, msg)
		if err != nil {
			slog.Error("failed to encode domination_update", "error", err)
			return
		}
		hub.BroadcastAll(frame)
	}

	// ================================================================
	// 7c-6. Wire v15 TradeEngine → WebSocket Hub (trade_route_update)
	// ================================================================
	tradeEngine.SetBroadcaster(&tradeBroadcasterAdapter{hub: hub})

	// ================================================================
	// 7d. v17 Phase 2: Economy engine dependency wiring
	// ================================================================
	// TradeEngine ← FactionManager, EconomyEngine, DiplomacyEngine
	tradeEngine.SetFactionManager(factionManager)
	slog.Info("wired", "engine", "TradeEngine.FactionManager")
	tradeEngine.SetEconomyEngine(economyEngine)
	slog.Info("wired", "engine", "TradeEngine.EconomyEngine")
	tradeEngine.SetDiplomacyEngine(diplomacyEngine)
	slog.Info("wired", "engine", "TradeEngine.DiplomacyEngine")

	// EconomyEngine ← FactionManager, DiplomacyEngine
	economyEngine.SetFactionManager(factionManager)
	slog.Info("wired", "engine", "EconomyEngine.FactionManager")
	economyEngine.SetDiplomacyEngine(diplomacyEngine)
	slog.Info("wired", "engine", "EconomyEngine.DiplomacyEngine")
	economyEngine.SetTechTreeManager(techTreeManager)
	economyEngine.SetSeasonEngine(seasonEngine)
	economyEngine.SetEventEngine(eventEngine)
	economyEngine.SetUNCouncil(unCouncil)
	// v30 Task 1-10: EconomyEngine에 BuybackEngine을 주입하여 GDP 기반 바이백을 직접 실행합니다
	if buybackEngine != nil {
		economyEngine.SetBuybackEngine(buybackEngine)
	}
	// v30 Task 1-3: DefenseOracle GDP 시뮬레이션 연결
	if defenseOracle != nil {
		economyEngine.SetDefenseOracle(defenseOracle)
	}
	// v30 Task 1-1: 주권 보상 콜백 연결 (경제 틱 시 QueueSovereigntyReward 호출)
	economyEngine.OnSovereigntyReward = func(playerID, playerName, countryCode string) {
		v14TokenRewardMgr.QueueSovereigntyReward(playerID, playerName, countryCode, v14AccountLevelMgr)
	}
	slog.Info("wired", "engine", "EconomyEngine.BonusSystems", "modules", []string{"TechTree", "Season", "Events", "UNCouncil", "BuybackEngine", "DefenseOracle", "SovereigntyReward"})

	// IntelSystem ← FactionManager, TechTreeManager
	intelSystem.SetFactionManager(factionManager)
	slog.Info("wired", "engine", "IntelSystem.FactionManager")
	intelSystem.SetTechTreeManager(techTreeManager)
	slog.Info("wired", "engine", "IntelSystem.TechTreeManager")

	// TechTreeManager ← FactionManager
	techTreeManager.SetFactionManager(factionManager)
	slog.Info("wired", "engine", "TechTreeManager.FactionManager")

	// MercenaryMarket ← FactionManager
	mercenaryMarket.SetFactionManager(factionManager)
	slog.Info("wired", "engine", "MercenaryMarket.FactionManager")

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
	// 8. Agent REST API (S24)
	// ================================================================
	agentRouter := api.NewAgentRouter()

	// ================================================================
	// 9. Event Router (client→server WebSocket events)
	// ================================================================
	eventRouter := ws.NewEventRouter()
	registerEventHandlers(eventRouter, hub, worldManager, &V14Systems{
		ArenaManager:    v14ArenaManager,
		AccountLevelMgr: v14AccountLevelMgr,
		ChallengeMgr:    v14ChallengeMgr,
		AchievementMgr:  v14AchievementMgr,
		WarSystem:       v14WarSystem,
		TokenRewardMgr:  v14TokenRewardMgr,
		EventLog:        v14EventLog,
		TickProfiler:    tickProfiler,
		CrossArenaMgr:   v14CrossArenaMgr,
		Hub:             hub,
	})

	// ================================================================
	// 9.5. v33 Phase 6: Matrix Token Economy Setup
	// ================================================================
	tokenBalanceCache := game.NewTokenBalanceCache(nil) // nil AWW balance — placeholder until full blockchain integration
	tokenBalanceCache.StartPolling()

	matrixBuffApplier := game.NewTokenBuffApplier()

	matrixHandler := api.NewMatrixHandler(
		v14TokenRewardMgr,
		tokenBalanceCache,
		matrixBuffApplier,
		nil, // PlayerAWWBalance — placeholder
	)

	// ================================================================
	// 9.6. v39 Phase 4: Region Manager + Event Handlers
	// ================================================================
	regionManager := game.NewCountryRegionManager()
	registerRegionEventHandlers(eventRouter, hub, regionManager)

	// ================================================================
	// 9.7. Phase 6: Tycoon Event Handlers
	// ================================================================
	registerTycoonEventHandlers(eventRouter, hub, tycoonMgr)

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
		PgDB:              pgDB,
		// v14 modules
		V14ArenaManager:    v14ArenaManager,
		V14AccountLevelMgr: v14AccountLevelMgr,
		V14ChallengeMgr:    v14ChallengeMgr,
		V14AchievementMgr:  v14AchievementMgr,
		V14WarSystem:       v14WarSystem,
		V14TokenRewardMgr:  v14TokenRewardMgr,
		V14EventLog:        v14EventLog,
		V14TickProfiler:    tickProfiler,
		V14BandwidthMon:    bandwidthMonitor,
		V14ArenaReaper:     v14ArenaReaper,
		// CROSS Ramp webhook
		RampWebhook: ramp.NewRampWebhookHandler(),
		// v30 Task 1-4: blockchain engines for HTTP endpoints
		BuybackEngine: buybackEngine,
		DefenseOracle: defenseOracle,
		// v33 Phase 6: matrix token economy
		MatrixHandler:     matrixHandler,
		TokenBalanceCache: tokenBalanceCache,
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

	// --- v17 Economy maintenance (trade expiry + GDP rankings, every 5 minutes) ---
	g.Go(func() error {
		slog.Info("v17 economy maintenance starting (5m interval)")
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-gCtx.Done():
				return nil
			case <-ticker.C:
				expired := tradeEngine.ExpireOldOrders()
				if expired > 0 {
					slog.Info("trade orders expired", "count", expired)
				}
				gdpEngine.UpdateRankings()
				slog.Debug("GDP rankings updated")
			}
		}
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

	// --- v14 Epoch ticker (20Hz = 50ms, ticks all active country arenas) ---
	g.Go(func() error {
		slog.Info("v14 Epoch ticker starting (20Hz)")
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		var epochTick uint64
		for {
			select {
			case <-gCtx.Done():
				return nil
			case <-ticker.C:
				epochTick++
				v14ArenaManager.TickActiveArenas(epochTick)
			}
		}
	})

	// --- v33 Matrix Broadcaster (20Hz downlinks for online Matrix arenas) ---
	g.Go(func() error {
		slog.Info("v33 Matrix broadcaster starting (20Hz)")
		startMatrixBroadcaster(hub, v14ArenaManager, gCtx.Done())
		return nil
	})

	// --- v14 WarSystem ticker (every 5 seconds) ---
	g.Go(func() error {
		slog.Info("v14 WarSystem ticker starting")
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-gCtx.Done():
				return nil
			case <-ticker.C:
				v14WarSystem.Tick()
			}
		}
	})

	// --- v30 Task 1-2: DefenseOracle background polling ---
	if defenseOracle != nil {
		g.Go(func() error {
			slog.Info("v30 DefenseOracle starting")
			defenseOracle.Start()
			<-gCtx.Done()
			return nil
		})
	}

	// --- v14 TokenReward distributor (every 30 seconds) ---
	g.Go(func() error {
		slog.Info("v14 TokenReward distributor starting")
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-gCtx.Done():
				return nil
			case <-ticker.C:
				count := v14TokenRewardMgr.DistributePendingRewards()
				if count > 0 {
					slog.Info("v14 token rewards distributed", "count", count)
				}
			}
		}
	})

	// --- v14 InactiveArenaReaper (every 30 seconds, checks for idle arenas) ---
	g.Go(func() error {
		slog.Info("v14 InactiveArenaReaper starting")
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-gCtx.Done():
				return nil
			case <-ticker.C:
				idleArenas := v14ArenaReaper.GetIdleArenas()
				for _, code := range idleArenas {
					slog.Info("v14 idle arena detected (reaper)", "country", code)
					v14ArenaReaper.RemoveTracking(code)
				}
			}
		}
	})

	// --- Tycoon engines (optional — only if DATABASE_URL is set) ---
	if tycoonMgr != nil {
		tycoonMgr.Start(gCtx)
	}

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

		slog.Info("stopping v14 systems...")
		v14WarSystem.Reset()
		v14TokenRewardMgr.DistributePendingRewards() // flush pending rewards
		bandwidthMonitor.Reset()
		// v33 Phase 6: stop token balance cache polling
		tokenBalanceCache.StopPolling()
		// v30 Task 1-2: DefenseOracle graceful shutdown
		if defenseOracle != nil {
			defenseOracle.Stop()
		}

		// Tycoon engines (optional)
		if tycoonMgr != nil {
			slog.Info("stopping tycoon engines...")
			tycoonMgr.Stop()
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

	// --- v39 Phase 4: Region arena idle cleanup (every 30 seconds) ---
	g.Go(func() error {
		slog.Info("v39 Region arena cleanup starting")
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-gCtx.Done():
				return nil
			case <-ticker.C:
				cleaned := regionManager.CleanupIdleRegions()
				if cleaned > 0 {
					slog.Info("cleaned idle region arenas", "count", cleaned)
				}
			}
		}
	})

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

// tradeBroadcasterAdapter implements meta.TradeBroadcaster for WS broadcasting.
type tradeBroadcasterAdapter struct {
	hub *ws.Hub
}

func (t *tradeBroadcasterAdapter) BroadcastTradeRoute(from, to, routeType string, volume int64, resource string) {
	msg := ws.TradeRouteUpdateMsg{
		From:     from,
		To:       to,
		Type:     routeType,
		Volume:   volume,
		Resource: resource,
	}
	frame, err := ws.EncodeFrame(ws.EventTradeRouteUpdate, msg)
	if err != nil {
		slog.Error("failed to encode trade_route_update", "error", err)
		return
	}
	t.hub.BroadcastAll(frame)
}

// V14Systems bundles all v14 in-game systems for event handler access.
type V14Systems struct {
	ArenaManager     *game.CountryArenaManager
	AccountLevelMgr  *game.AccountLevelManager
	ChallengeMgr     *game.DailyChallengeManager
	AchievementMgr   *game.AchievementManager
	WarSystem        *game.WarSystem
	TokenRewardMgr   *game.TokenRewardManager
	EventLog         *game.EventLog
	TickProfiler     *game.TickProfiler
	CrossArenaMgr    *game.CrossArenaManager
	Hub              *ws.Hub
}

// registerEventHandlers sets up all client→server event handlers.
// v11: Routes through WorldManager (195 countries) instead of v10 RoomManager (5 rooms).
// v14: Adds select_nationality, join_country_arena, switch_arena, daily challenges, achievements.
func registerEventHandlers(router *ws.EventRouter, hub *ws.Hub, wm *world.WorldManager, v14 *V14Systems) {
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

	// Input (v16: supports both legacy {a,b,s} and split {ma,aa,b,d,j,s})
	router.On(ws.EventInput, func(client *ws.Client, data json.RawMessage) {
		var payload ws.InputPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		boost := payload.Boost == 1
		dash := payload.Dash == 1
		jump := payload.Jump == 1

		// v16: If ma/aa fields present, use split input path
		if payload.MoveAngle != nil || payload.AimAngle != nil {
			moveAngle := payload.GetMoveAngle()
			aimAngle := payload.GetAimAngle()
			wm.RouteInputSplit(client.ID, moveAngle, aimAngle, boost, dash, jump)
		} else {
			// Legacy: single angle for both move and aim
			wm.RouteInput(client.ID, payload.Angle, boost, dash)
		}
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

	// ================================================================
	// v14 Event Handlers
	// ================================================================

	// select_nationality (C→S): Set player's nationality (ISO3 code)
	router.On(ws.EventSelectNationality, func(client *ws.Client, data json.RawMessage) {
		var payload struct {
			Nationality string `json:"nationality"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid select_nationality payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.Nationality == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "invalid_nationality",
				Message: "nationality ISO3 code required",
			})
			client.Send(errFrame)
			return
		}

		slog.Info("select_nationality",
			"clientId", client.ID,
			"nationality", payload.Nationality,
		)

		// Store nationality on the player's agent if they're in a country arena
		countryISO := wm.GetPlayerCountry(client.ID)
		if countryISO != "" {
			arena := wm.GetActiveArena(countryISO)
			if arena != nil {
				if agent, ok := arena.GetArena().GetAgent(client.ID); ok {
					agent.Nationality = payload.Nationality
				}
			}
		}

		// Send confirmation
		frame, _ := ws.EncodeFrame("nationality_confirmed", map[string]string{
			"nationality": payload.Nationality,
		})
		client.Send(frame)
	})

	// join_country_arena (C→S): Join a v14 country arena (creates on-demand)
	router.On(ws.EventJoinCountryArena, func(client *ws.Client, data json.RawMessage) {
		var payload struct {
			CountryCode string `json:"countryCode"`
			Name        string `json:"name"`
			SkinID      int    `json:"skinId"`
			Nationality string `json:"nationality"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid join_country_arena payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.CountryCode == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "invalid_country",
				Message: "countryCode required for join_country_arena",
			})
			client.Send(errFrame)
			return
		}

		slog.Info("join_country_arena",
			"clientId", client.ID,
			"country", payload.CountryCode,
			"name", payload.Name,
			"nationality", payload.Nationality,
		)

		// Delegate to existing WorldManager join flow
		if err := wm.JoinCountry(client.ID, payload.CountryCode, payload.Name, payload.SkinID, ""); err != nil {
			// v15: distinguish arena_full from other join errors
			code := "join_failed"
			var arenaFullErr *world.ArenaFullError
			if errors.As(err, &arenaFullErr) {
				code = "arena_full"
			}
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    code,
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		hub.MoveClientToRoom(client.ID, payload.CountryCode)

		// Set nationality if provided
		if payload.Nationality != "" {
			arena := wm.GetActiveArena(payload.CountryCode)
			if arena != nil {
				if agent, ok := arena.GetArena().GetAgent(client.ID); ok {
					agent.Nationality = payload.Nationality
				}
			}
		}

		// Send joined event
		arena := wm.GetActiveArena(payload.CountryCode)
		if arena != nil {
			joinedEvt := arena.GetJoinedEvent(client.ID)
			frame, err := ws.EncodeFrame(ws.EventJoined, joinedEvt)
			if err == nil {
				client.Send(frame)
			}
		}
	})

	// switch_arena (C→S): Leave current arena, join another country
	router.On(ws.EventSwitchArena, func(client *ws.Client, data json.RawMessage) {
		var payload struct {
			CountryCode string `json:"countryCode"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid switch_arena payload", "clientId", client.ID, "error", err)
			return
		}

		slog.Info("switch_arena",
			"clientId", client.ID,
			"newCountry", payload.CountryCode,
		)

		// Leave current arena
		wm.LeaveCountry(client.ID)
		hub.RegisterLobby(client)

		// If new country specified, join it
		if payload.CountryCode != "" {
			if err := wm.JoinCountry(client.ID, payload.CountryCode, "", 0, ""); err != nil {
				errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
					Code:    "switch_failed",
					Message: err.Error(),
				})
				client.Send(errFrame)
				return
			}
			hub.MoveClientToRoom(client.ID, payload.CountryCode)

			arena := wm.GetActiveArena(payload.CountryCode)
			if arena != nil {
				joinedEvt := arena.GetJoinedEvent(client.ID)
				frame, err := ws.EncodeFrame(ws.EventJoined, joinedEvt)
				if err == nil {
					client.Send(frame)
				}
			}
		}
	})

	// v19: ar_input (C→S): Arena combat movement input
	router.On(ws.EventARInput, func(client *ws.Client, data json.RawMessage) {
		var payload ws.ARInputPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		wm.RouteARInput(client.ID, game.ARInput{
			DirX:  payload.DirX,
			DirZ:  payload.DirZ,
			Jump:  payload.Jump,
			Slide: payload.Slide,
			AimY:  payload.AimY,
		})
	})

	// v19: ar_choose (C→S): Arena tome/weapon selection during level-up
	router.On(ws.EventARChoose, func(client *ws.Client, data json.RawMessage) {
		var payload ws.ARChoosePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		wm.RouteARChoose(client.ID, game.ARChoice{
			TomeID:   payload.TomeID,
			WeaponID: payload.WeaponID,
		})
	})

	// declare_war (C→S): Declare war on a target country
	router.On(ws.EventDeclareWar, func(client *ws.Client, data json.RawMessage) {
		var payload struct {
			Attacker  string   `json:"attacker"`  // attacking nationality ISO3
			Defender  string   `json:"defender"`   // defending nationality ISO3
			Coalition []string `json:"coalition"`  // coalition members (for coalition declaration)
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid declare_war payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.Attacker == "" || payload.Defender == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "invalid_war_params",
				Message: "attacker and defender nationalities are required",
			})
			client.Send(errFrame)
			return
		}

		if v14 == nil || v14.WarSystem == nil {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "war_system_unavailable",
				Message: "war system is not available",
			})
			client.Send(errFrame)
			return
		}

		warID, err := v14.WarSystem.DeclareWar(payload.Attacker, payload.Defender, payload.Coalition)
		if err != nil {
			slog.Info("declare_war rejected",
				"clientId", client.ID,
				"attacker", payload.Attacker,
				"defender", payload.Defender,
				"error", err,
			)
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "war_declaration_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		slog.Info("war declared via client",
			"clientId", client.ID,
			"warId", warID,
			"attacker", payload.Attacker,
			"defender", payload.Defender,
			"coalition", payload.Coalition,
		)

		// Send confirmation to the declaring client
		confirmFrame, _ := ws.EncodeFrame(ws.EventWarDeclared, map[string]interface{}{
			"warId":     warID,
			"attacker":  payload.Attacker,
			"defender":  payload.Defender,
			"coalition": payload.Coalition,
		})
		client.Send(confirmFrame)
	})

	// get_account_level (C→S): Request account level snapshot
	router.On("get_account_level", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.AccountLevelMgr == nil {
			return
		}
		snapshot := v14.AccountLevelMgr.GetSnapshot(client.ID)
		if snapshot != nil {
			frame, err := ws.EncodeFrame("account_level_update", snapshot)
			if err == nil {
				client.Send(frame)
			}
		}
	})

	// get_daily_challenges (C→S): Request daily challenges
	router.On("get_daily_challenges", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.ChallengeMgr == nil {
			return
		}
		snapshot := v14.ChallengeMgr.GetSnapshot(client.ID)
		if snapshot != nil {
			frame, err := ws.EncodeFrame("daily_challenges_update", snapshot)
			if err == nil {
				client.Send(frame)
			}
		}
	})

	// claim_challenge_reward (C→S): Claim a completed daily challenge reward
	router.On("claim_challenge_reward", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.ChallengeMgr == nil {
			return
		}
		var payload struct {
			ChallengeIndex int `json:"challengeIndex"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		rewardMsg, err := v14.ChallengeMgr.ClaimReward(client.ID, payload.ChallengeIndex)
		if err != nil {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "claim_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		// Send reward confirmation
		frame, _ := ws.EncodeFrame("challenge_reward_claimed", map[string]interface{}{
			"challengeIndex": payload.ChallengeIndex,
			"rewardMessage":  rewardMsg,
		})
		client.Send(frame)

		// Send updated challenges
		snapshot := v14.ChallengeMgr.GetSnapshot(client.ID)
		if snapshot != nil {
			updFrame, _ := ws.EncodeFrame("daily_challenges_update", snapshot)
			client.Send(updFrame)
		}
	})

	// get_achievements (C→S): Request achievement state
	router.On("get_achievements", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.AchievementMgr == nil {
			return
		}
		snapshot := v14.AchievementMgr.GetSnapshot(client.ID)
		if snapshot != nil {
			frame, err := ws.EncodeFrame("achievements_update", snapshot)
			if err == nil {
				client.Send(frame)
			}
		}
	})

	// get_global_events (C→S): Request recent global events for news ticker
	router.On("get_global_events", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.EventLog == nil {
			return
		}
		events := v14.EventLog.GetRecentEvents(20)
		frame, err := ws.EncodeFrame("global_events", events)
		if err == nil {
			client.Send(frame)
		}
	})

	// get_token_rewards (C→S): Request player's token reward history
	router.On("get_token_rewards", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.TokenRewardMgr == nil {
			return
		}
		snapshots := v14.TokenRewardMgr.GetPlayerRewardSnapshot(client.ID, 20)
		frame, err := ws.EncodeFrame("token_rewards_update", snapshots)
		if err == nil {
			client.Send(frame)
		}
	})

	// select_title (C→S): Player selects a previously unlocked account title
	router.On("select_title", func(client *ws.Client, data json.RawMessage) {
		if v14 == nil || v14.AccountLevelMgr == nil {
			return
		}
		var payload struct {
			Title string `json:"title"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		if err := v14.AccountLevelMgr.SelectTitle(client.ID, payload.Title); err != nil {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "title_failed",
				Message: err.Error(),
			})
			client.Send(errFrame)
			return
		}

		frame, _ := ws.EncodeFrame("title_selected", map[string]string{
			"title": payload.Title,
		})
		client.Send(frame)
	})

	// ================================================================
	// v33 Matrix Online Event Handlers
	// ================================================================
	registerMatrixEventHandlers(router, hub, v14)
}

// createWorldEventHandler bridges WorldManager events to the WebSocket Hub.
// Handles two types of events:
// 1. WorldEvtCountryUpdate — wraps game.RoomEvent, forwarded to room/client
// 2. WorldEvtCountriesState — 1Hz country state broadcast to lobby
//
// v14: Also feeds kill/death events to v14 modules for real-time tracking:
//   - CrossArenaManager.OnWarKill() for war score tracking
//   - EventLog for notable kill events in global news ticker
func createWorldEventHandler(hub *ws.Hub, v14Sys *V14Systems) world.WorldEventCallback {
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

				// v19: Arena combat events
				case game.RoomEvtARState:
					wsEvent = ws.EventARState
				case game.RoomEvtARDamage:
					wsEvent = ws.EventARDamage
				case game.RoomEvtARLevelUp:
					wsEvent = ws.EventARLevelUp
				case game.RoomEvtARKill:
					wsEvent = ws.EventARKill
				case game.RoomEvtARPhaseChange:
					wsEvent = ws.EventARPhaseChange
				case game.RoomEvtARBattleEnd:
					wsEvent = ws.EventARBattleEnd
				case game.RoomEvtARMinibossDeath:
					wsEvent = "ar_miniboss_death"
				case game.RoomEvtAREliteExplosion:
					wsEvent = "ar_elite_explosion"
				case game.RoomEvtARPvPKill:
					wsEvent = "ar_pvp_kill"
				case game.RoomEvtARBossSpawn:
					wsEvent = "ar_boss_spawn"
				case game.RoomEvtARBossDefeated:
					wsEvent = "ar_boss_defeated"
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

				// ============================================================
				// v14: Feed kill/death events to v14 modules
				// ============================================================
				if v14Sys != nil {
					countryCode := roomEvt.RoomID

					switch roomEvt.Type {
					case game.RoomEvtKill:
						killerID := roomEvt.TargetID // TargetID = killer for kill events

						// Feed kill to CrossArenaManager for war score tracking
						if v14Sys.CrossArenaMgr != nil && killerID != "" {
							// Resolve killer/victim nationalities from the arena
							arena := v14Sys.ArenaManager.GetArena(countryCode)
							if arena != nil && arena.Room != nil {
								killerAgent, killerOK := arena.Room.GetArena().GetAgent(killerID)
								if killEvt, ok := roomEvt.Data.(domain.KillEvent); ok {
									victimAgent, victimOK := arena.Room.GetArena().GetAgent(killEvt.Victim)
									if killerOK && victimOK && killerAgent.Nationality != "" && victimAgent.Nationality != "" {
										v14Sys.CrossArenaMgr.OnWarKill(countryCode, killerAgent.Nationality, victimAgent.Nationality)
									}
								}
							}
						}

					case game.RoomEvtDeath:
						// Death events: TargetID = victim
						// The v14 AccountLevelMgr/ChallengeMgr/AchievementMgr process
						// stats in batch at epoch end via ProcessEpochResult/ProcessEpochProgress/
						// ProcessEpochData. Individual kills/deaths accumulate on Agent struct
						// fields (agent.Kills, agent.Deaths) and are read at epoch finalization.
						_ = countryCode // tracked by epoch system
					}
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

// processEpochEndForV14 processes epoch-end data through v14 account/challenge/achievement systems.
// Called when an epoch ends in any country arena. Iterates all agents in the arena
// and builds batch results for ProcessEpochResult, ProcessEpochProgress, and ProcessEpochData.
func processEpochEndForV14(endData game.EpochEndData, v14Sys *V14Systems) {
	if v14Sys == nil || v14Sys.ArenaManager == nil {
		return
	}

	arena := v14Sys.ArenaManager.GetArena(endData.CountryCode)
	if arena == nil || arena.Room == nil {
		return
	}

	// Get all agents from the arena to build epoch results
	agents := arena.Room.GetArena().GetAgents()
	if len(agents) == 0 {
		return
	}

	totalPlayers := len(agents)
	nowMs := time.Now().UnixMilli()

	for _, agent := range agents {
		if agent.IsBot {
			continue
		}

		// Calculate survival minutes from JoinedAt timestamp
		survivalMinutes := 0.0
		if agent.JoinedAt > 0 {
			survivalMinutes = float64(nowMs-agent.JoinedAt) / 60000.0
		}

		// --- AccountLevelManager: ProcessEpochResult ---
		if v14Sys.AccountLevelMgr != nil {
			epochResult := &game.EpochAccountResult{
				PlayerID:        agent.ID,
				PlayerName:      agent.Name,
				EpochNumber:     endData.EpochNumber,
				CountryCode:     endData.CountryCode,
				Kills:           agent.Kills,
				Deaths:          agent.Deaths,
				Assists:         agent.Assists,
				Level:           agent.Level,
				SurvivalMinutes: survivalMinutes,
				EpochScore:      agent.Score,
				TotalPlayers:    totalPlayers,
				IsBot:           false,
			}
			v14Sys.AccountLevelMgr.ProcessEpochResult(epochResult)
		}

		// --- DailyChallengeManager: ProcessEpochProgress ---
		if v14Sys.ChallengeMgr != nil {
			progress := &game.ChallengeEpochProgress{
				PlayerID:       agent.ID,
				Kills:          agent.Kills,
				Assists:        agent.Assists,
				EpochsSurvived: 1,
				LevelReached:   agent.Level,
				TotalPlayers:   totalPlayers,
			}
			v14Sys.ChallengeMgr.ProcessEpochProgress(progress)
		}

		// --- AchievementManager: ProcessEpochData ---
		if v14Sys.AchievementMgr != nil {
			epochData := &game.AchievementEpochData{
				PlayerID:     agent.ID,
				Kills:        agent.Kills,
				Deaths:       agent.Deaths,
				Assists:      agent.Assists,
				Level:        agent.Level,
				Rank:         0, // could be derived from leaderboard
				TotalPlayers: totalPlayers,
			}
			v14Sys.AchievementMgr.ProcessEpochData(epochData)
		}
	}

	// --- NationScoreTracker: record each agent's contribution ---
	if arena.NationScore != nil {
		for _, agent := range agents {
			if agent.IsBot || agent.Nationality == "" {
				continue
			}
			arena.NationScore.RecordPlayerScore(agent, endData.EpochNumber)
		}

		// Finalize the epoch to compute nation totals and store in history
		nationScores := arena.NationScore.FinalizeEpoch(endData.EpochNumber)

		// Broadcast nation_score_update to all clients in this arena
		if len(nationScores) > 0 {
			scorePayload := map[string]interface{}{
				"countryCode":  endData.CountryCode,
				"epochNumber":  endData.EpochNumber,
				"nationScores": nationScores,
			}
			if v14Sys.Hub != nil {
				frame, err := ws.EncodeFrame(ws.EventNationScoreUpdate, scorePayload)
				if err == nil {
					v14Sys.Hub.BroadcastToRoom(endData.CountryCode, frame)
				}
			}
		}

		// --- DominationEngine: check if a domination evaluation is needed ---
		if arena.Domination != nil {
			evaluated := arena.Domination.OnEpochEnd(arena.NationScore, endData.EpochNumber)
			if evaluated {
				slog.Info("domination evaluation triggered",
					"country", endData.CountryCode,
					"epoch", endData.EpochNumber,
					"dominant", arena.Domination.GetDominantNation(),
				)

				// v30 Task 1-1: 에포크 종료 시 Domination 보상 큐에 적재합니다
				if v14Sys.TokenRewardMgr != nil {
					playerScores := make(map[string]*game.PlayerEpochStats)
					for _, ag := range agents {
						if ag.IsBot {
							continue
						}
						playerScores[ag.ID] = &game.PlayerEpochStats{
							ID:          ag.ID,
							Name:        ag.Name,
							Nationality: ag.Nationality,
							Kills:       ag.Kills,
							Deaths:      ag.Deaths,
							Assists:     ag.Assists,
							Level:       ag.Level,
							NationScore: ag.Score,
						}
					}
					domInput := &game.DominationRewardInput{
						CountryCode:    endData.CountryCode,
						DominantNation: arena.Domination.GetDominantNation(),
						NationScores:   endData.NationScores,
						PlayerScores:   playerScores,
					}
					v14Sys.TokenRewardMgr.QueueDominationRewards(domInput, v14Sys.AccountLevelMgr)
				}
			}
		}
	}

	slog.Info("v14 epoch end processed",
		"country", endData.CountryCode,
		"epoch", endData.EpochNumber,
		"players", totalPlayers,
	)
}
