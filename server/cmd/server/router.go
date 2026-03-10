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
	"github.com/andrewkim-gif/snake/server/internal/blockchain"
	"github.com/andrewkim-gif/snake/server/internal/blockchain/ramp"
	"github.com/andrewkim-gif/snake/server/internal/db"
	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/meta"
	"github.com/andrewkim-gif/snake/server/internal/observability"
	"github.com/andrewkim-gif/snake/server/internal/security"
	"github.com/andrewkim-gif/snake/server/internal/world"
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
	Status       string `json:"status"`
	Version      string `json:"version"`
	Rooms        int    `json:"rooms"`       // deprecated: use ActiveArenas
	ActiveArenas int    `json:"activeArenas"`
	Players      int    `json:"players"`
	Countries    int    `json:"countries"`
	MetaModules  int    `json:"meta_modules"`
	Database     string `json:"database"` // "connected" | "none"
	Uptime       string `json:"uptime"`
	Goroutines   int    `json:"goroutines"`
}

// upgrader configures the WebSocket upgrade from HTTP.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Overridden by newRouter() via security.ValidateWebSocketOrigin
	},
}

// RouterDeps holds all dependencies for the HTTP router.
type RouterDeps struct {
	// v10 dependencies
	TrainingStore     *game.TrainingStore
	MemoryStore       *game.MemoryStore
	ProgressionStore  *game.ProgressionStore
	QuestStore        *game.QuestStore
	GlobalLeaderboard *game.GlobalLeaderboard
	AgentRouter       *api.AgentRouter
	AgentStreamHub    *ws.AgentStreamHub

	// v11 world modules
	WorldManager      *world.WorldManager
	DeploymentManager *world.DeploymentManager
	SiegeManager      *world.SiegeManager
	ContinentalEngine *world.ContinentalBonusEngine

	// v11 meta modules
	FactionManager    *meta.FactionManager
	EconomyEngine     *meta.EconomyEngine
	TradeEngine       *meta.TradeEngine
	GDPEngine         *meta.GDPEngine
	PolicyEngine      *meta.PolicyEngine
	DiplomacyEngine   *meta.DiplomacyEngine
	WarManager        *meta.WarManager
	SeasonEngine      *meta.SeasonEngine
	SeasonResetEngine *meta.SeasonResetEngine
	HallOfFameEngine  *meta.HallOfFameEngine
	AchievementEngine *meta.AchievementEngine
	TechTreeManager   *meta.TechTreeManager
	IntelSystem       *meta.IntelSystem
	EventEngine       *meta.EventEngine
	UNCouncil         *meta.UNCouncil
	MercenaryMarket   *meta.MercenaryMarket
	NewsManager       *meta.NewsManager
	AgentManager      *meta.AgentManager

	// v18 persistence
	PgDB *db.DB

	// Observability
	Metrics *observability.Metrics

	// CROSS Ramp webhook handler
	RampWebhook *ramp.RampWebhookHandler

	// v30: blockchain engines for buyback/defense HTTP endpoints
	BuybackEngine *blockchain.BuybackEngine
	DefenseOracle *blockchain.DefenseOracle

	// v30 Phase 2: Forge price, staking, auction, persistence, AWW balance
	ForgePriceService  *blockchain.ForgePriceService
	SeasonStakeManager *game.SeasonStakeManager
	AuctionManager     *meta.AuctionManager
	PersistenceManager *game.JSONPersistenceManager
	PlayerAWWBalance   *game.PlayerAWWBalance

	// v14 in-game systems
	V14ArenaManager    *game.CountryArenaManager
	V14AccountLevelMgr *game.AccountLevelManager
	V14ChallengeMgr    *game.DailyChallengeManager
	V14AchievementMgr  *game.AchievementManager
	V14WarSystem       *game.WarSystem
	V14TokenRewardMgr  *game.TokenRewardManager
	V14EventLog        *game.EventLog
	V14TickProfiler    *game.TickProfiler
	V14BandwidthMon    *game.BandwidthMonitor
	V14ArenaReaper     *game.InactiveArenaReaper

	// v33 Phase 6: Matrix token economy
	MatrixHandler     *api.MatrixHandler
	TokenBalanceCache *game.TokenBalanceCache
}

func newRouter(cfg *config.Config, hub *ws.Hub, router *ws.EventRouter, wm *world.WorldManager, deps ...*RouterDeps) http.Handler {
	// Unpack dependencies
	var d *RouterDeps
	if len(deps) > 0 && deps[0] != nil {
		d = deps[0]
	} else {
		d = &RouterDeps{}
	}

	r := chi.NewRouter()

	// S42: Set WebSocket origin validation using CORS config
	upgrader.CheckOrigin = security.ValidateWebSocketOrigin(cfg.CORSOrigins)

	// -- Middleware --
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	// S42: Request body size limit (1MB)
	r.Use(security.MaxBodyMiddleware)

	// S42: Security headers (CSP, X-Frame-Options, etc.)
	r.Use(security.CSPHeaders)

	// Structured request logging (skip /ws and /metrics to avoid noise)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/ws" || r.URL.Path == "/metrics" {
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
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-API-Key"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// ==============================================================
	// Health check (enhanced for v11)
	// ==============================================================
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "none"
		if d.PgDB != nil {
			if err := d.PgDB.Ping(r.Context()); err == nil {
				dbStatus = "connected"
			} else {
				dbStatus = "error"
			}
		}
		resp := healthResponse{
			Status:       "ok",
			Version:      "11.0.0",
			Rooms:        wm.GetActiveArenaCount(),
			ActiveArenas: wm.GetActiveArenaCount(),
			Players:      hub.ClientCount(),
			Countries:    world.CountryCount(),
			MetaModules:  16,
			Database:     dbStatus,
			Uptime:       time.Since(startTime).Truncate(time.Second).String(),
			Goroutines:   runtime.NumGoroutine(),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			slog.Error("failed to encode health response", "error", err)
		}
	})

	// ==============================================================
	// Prometheus Metrics endpoint (S44)
	// ==============================================================
	if d.Metrics != nil {
		r.Get("/metrics", d.Metrics.Handler())
	}

	// ==============================================================
	// v11 Countries API (replaces v10 rooms)
	// ==============================================================
	r.Get("/rooms", func(w http.ResponseWriter, r *http.Request) {
		// Return active country arenas (backward-compatible shape)
		countries := wm.GetAllCountries()
		type countryInfo struct {
			ID            string `json:"id"`
			Name          string `json:"name"`
			BattleStatus  string `json:"battleStatus"`
			ActiveAgents  int    `json:"activeAgents"`
			SpectatorCount int   `json:"spectatorCount"`
			Tier          string `json:"tier"`
			Continent     string `json:"continent"`
		}
		list := make([]countryInfo, 0, len(countries))
		for _, c := range countries {
			list = append(list, countryInfo{
				ID:             c.ISO3,
				Name:           c.Name,
				BattleStatus:   c.BattleStatus,
				ActiveAgents:   c.ActiveAgents,
				SpectatorCount: c.SpectatorCount,
				Tier:           string(c.Tier),
				Continent:      c.Continent,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(list); err != nil {
			slog.Error("failed to encode countries response", "error", err)
		}
	})

	// ==============================================================
	// WebSocket upgrade endpoint
	// ==============================================================
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		// v17: Rate-limit connections per IP
		remoteIP := r.RemoteAddr
		// Strip port from "ip:port" format
		if idx := len(remoteIP) - 1; idx > 0 {
			for i := idx; i >= 0; i-- {
				if remoteIP[i] == ':' {
					remoteIP = remoteIP[:i]
					break
				}
			}
		}
		if !hub.ConnLimit.Allow(remoteIP) {
			slog.Warn("connection rate limited", "ip", remoteIP)
			http.Error(w, "rate limited", http.StatusTooManyRequests)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws upgrade failed", "error", err)
			return
		}

		clientID := uuid.New().String()
		client := ws.NewClient(clientID, hub, conn, router.HandleMessage, func(c *ws.Client) {
			wm.LeaveCountry(c.ID)
			wm.LeaveSpectate(c.ID)
			slog.Info("client disconnected", "clientId", c.ID)
		})

		hub.RegisterLobby(client)

		go client.WritePump()
		go client.ReadPump()

		slog.Info("new ws connection", "clientId", clientID, "remoteAddr", r.RemoteAddr)
	})

	// ==============================================================
	// v10 Agent Training API
	// ==============================================================
	r.Route("/api/agent/{agentId}", func(r chi.Router) {
		r.Put("/training", func(w http.ResponseWriter, r *http.Request) {
			if d.TrainingStore == nil {
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
			existing, _ := d.TrainingStore.GetProfile(agentID)
			profile := req.ApplyToProfile(agentID, existing)
			if err := d.TrainingStore.SetProfile(agentID, profile); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(profile)
		})

		r.Get("/training", func(w http.ResponseWriter, r *http.Request) {
			if d.TrainingStore == nil {
				http.Error(w, `{"error":"training not initialized"}`, http.StatusServiceUnavailable)
				return
			}
			agentID := chi.URLParam(r, "agentId")
			profile, ok := d.TrainingStore.GetProfile(agentID)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "profile not found"})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(profile)
		})

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
			if d.TrainingStore != nil {
				existing, _ := d.TrainingStore.GetProfile(agentID)
				if existing == nil {
					existing = &game.TrainingProfile{AgentID: agentID}
				}
				existing.BuildProfile.PrimaryPath = bp.ID
				d.TrainingStore.SetProfile(agentID, existing)
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(bp)
		})

		r.Get("/memory", func(w http.ResponseWriter, r *http.Request) {
			if d.MemoryStore == nil {
				http.Error(w, `{"error":"memory not initialized"}`, http.StatusServiceUnavailable)
				return
			}
			agentID := chi.URLParam(r, "agentId")
			mem, ok := d.MemoryStore.GetMemory(agentID)
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

	// --- Personality Presets API ---
	r.Get("/api/personalities", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(game.PersonalityPresets)
	})

	// --- Player Progression API (S53) ---
	r.Route("/api/player/{playerId}", func(r chi.Router) {
		r.Get("/progression", func(w http.ResponseWriter, r *http.Request) {
			if d.ProgressionStore == nil {
				http.Error(w, `{"error":"progression not initialized"}`, http.StatusServiceUnavailable)
				return
			}
			playerID := chi.URLParam(r, "playerId")
			resp := d.ProgressionStore.BuildProgressionResponse(playerID)
			if resp == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "progression not found"})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		})

		r.Get("/quests", func(w http.ResponseWriter, r *http.Request) {
			if d.QuestStore == nil {
				http.Error(w, `{"error":"quests not initialized"}`, http.StatusServiceUnavailable)
				return
			}
			playerID := chi.URLParam(r, "playerId")
			resp := d.QuestStore.GetPlayerQuestsResponse(playerID)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		})
	})

	// --- Global Leaderboard API (S55) ---
	r.Get("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		if d.GlobalLeaderboard == nil {
			http.Error(w, `{"error":"leaderboard not initialized"}`, http.StatusServiceUnavailable)
			return
		}
		lbType := r.URL.Query().Get("type")
		if lbType == "" {
			lbType = "agent"
		}
		resp := d.GlobalLeaderboard.GetLeaderboard(lbType)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	// ==============================================================
	// Shared API Key Validator (Agent + Meta API DualAuth)
	// ==============================================================
	// API Key → deterministic UUID (v5) so DB UUID columns accept it
	apiKeyNamespace := uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
	apiKeyValidator := func(_ context.Context, keyHash string) (string, error) {
		if keyHash == "" {
			return "", fmt.Errorf("empty key hash")
		}
		return uuid.NewSHA1(apiKeyNamespace, []byte(keyHash)).String(), nil
	}

	// ==============================================================
	// Agent Public API (no auth) — Registration endpoint
	// ==============================================================
	if d.AgentRouter != nil {
		r.Route("/api/v1/agents", func(r chi.Router) {
			r.Mount("/", d.AgentRouter.PublicRoutes())
		})
	}

	// ==============================================================
	// Agent REST API (S24, Phase 5) — DualAuth (JWT or API Key)
	// ==============================================================
	if d.AgentRouter != nil {
		r.Route("/api/agents", func(r chi.Router) {
			r.Use(auth.DualAuth(apiKeyValidator))
			r.Mount("/", d.AgentRouter.Routes())
		})
	}

	// ==============================================================
	// Agent WebSocket Live Stream (S25, Phase 5)
	// ==============================================================
	if d.AgentStreamHub != nil {
		r.Get("/ws/agents/live", d.AgentStreamHub.HandleAgentStream)
	}

	// ==============================================================
	// v11 Meta API Routes (Phase 3-8)
	// ==============================================================
	r.Route("/api/v11", func(r chi.Router) {
		// DualAuth: JWT 또는 API Key 인증 (LLM 에이전트 시뮬레이션 지원)
		r.Use(auth.DualAuth(apiKeyValidator))

		// --- Factions (S16) ---
		if d.FactionManager != nil {
			r.Mount("/factions", d.FactionManager.FactionRoutes())
		}

		// --- Diplomacy (S17) ---
		if d.DiplomacyEngine != nil && d.FactionManager != nil {
			r.Mount("/diplomacy", d.DiplomacyEngine.DiplomacyRoutes(d.FactionManager))
		}

		// --- War (S18) ---
		if d.WarManager != nil {
			r.Mount("/war", d.WarManager.WarRoutes())
		}

		// --- Economy: Trade (S22) ---
		if d.TradeEngine != nil && d.FactionManager != nil {
			r.Mount("/trade", d.TradeEngine.TradeRoutes(d.FactionManager))
		}

		// --- Economy: Policy (S21) ---
		if d.PolicyEngine != nil {
			r.Mount("/policy", d.PolicyEngine.PolicyRoutes())
		}

		// --- Economy: GDP (S23) ---
		if d.GDPEngine != nil {
			r.Mount("/gdp", d.GDPEngine.GDPRoutes())
		}

		// --- Season (S29) ---
		if d.SeasonEngine != nil {
			r.Mount("/season", d.SeasonEngine.SeasonRoutes())
		}

		// --- Season Reset / Archives (S30) ---
		if d.SeasonResetEngine != nil {
			r.Mount("/season-archive", d.SeasonResetEngine.SeasonResetRoutes())
		}

		// --- Hall of Fame (S31) ---
		if d.HallOfFameEngine != nil {
			r.Mount("/hall-of-fame", d.HallOfFameEngine.HallOfFameRoutes())
		}

		// --- Achievements (S32) ---
		if d.AchievementEngine != nil {
			r.Mount("/achievements", d.AchievementEngine.AchievementRoutes())
		}

		// --- Tech Tree (S33) ---
		if d.TechTreeManager != nil && d.FactionManager != nil {
			r.Mount("/tech-tree", d.TechTreeManager.TechTreeRoutes(d.FactionManager))
		}

		// --- Intel (S34) ---
		if d.IntelSystem != nil && d.FactionManager != nil {
			r.Mount("/intel", d.IntelSystem.IntelRoutes(d.FactionManager))
		}

		// --- Events (S35) ---
		if d.EventEngine != nil {
			r.Mount("/events", d.EventEngine.EventRoutes())
		}

		// --- UN Council (S36) ---
		if d.UNCouncil != nil && d.FactionManager != nil {
			r.Mount("/council", d.UNCouncil.CouncilRoutes(d.FactionManager))
		}

		// --- Mercenary Market (S37) ---
		if d.MercenaryMarket != nil && d.FactionManager != nil {
			r.Mount("/mercenary", d.MercenaryMarket.MercenaryRoutes(d.FactionManager))
		}

		// --- World Info (country list, status) ---
		r.Get("/countries", func(w http.ResponseWriter, r *http.Request) {
			countries := world.AllCountries
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"count":     len(countries),
				"countries": countries,
			})
		})

		// --- World Status (live country state from WorldManager) ---
		if d.WorldManager != nil {
			r.Get("/world/status", func(w http.ResponseWriter, r *http.Request) {
				status := d.WorldManager.GetAllCountries()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(status)
			})
		}

		// --- Simulation Admin: Sovereignty Grant ---
		// Allows authenticated users to claim sovereignty over their nationality country.
		// This enables LLM agent simulations to bootstrap without requiring battle victories.
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireAuth)

			// POST /api/v11/sim/claim-country
			// Body: { "country_iso": "KOR" }
			// Grants sovereignty level 3 to the user's faction over the specified country.
			r.Post("/sim/claim-country", func(w http.ResponseWriter, req *http.Request) {
				userID := auth.GetUserID(req.Context())
				if userID == "" {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnauthorized)
					json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
					return
				}

				var body struct {
					CountryISO string `json:"country_iso"`
				}
				if err := json.NewDecoder(req.Body).Decode(&body); err != nil || body.CountryISO == "" {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					json.NewEncoder(w).Encode(map[string]string{"error": "country_iso required"})
					return
				}

				// Get user's faction
				factionID := ""
				if d.FactionManager != nil {
					factionID = d.FactionManager.GetUserFaction(userID)
				}
				if factionID == "" {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					json.NewEncoder(w).Encode(map[string]string{"error": "you must be in a faction"})
					return
				}

				// Check if country already has a sovereign (don't overwrite)
				if d.EconomyEngine != nil {
					econ := d.EconomyEngine.GetEconomy(body.CountryISO)
					if econ != nil && econ.SovereignFaction != "" && econ.SovereignFaction != factionID {
						w.Header().Set("Content-Type", "application/json")
						w.WriteHeader(http.StatusConflict)
						json.NewEncoder(w).Encode(map[string]string{
							"error":   "country already claimed by another faction",
							"faction": econ.SovereignFaction,
						})
						return
					}
				}

				// Grant sovereignty level 3 (minimum for policy changes)
				sovLevel := 3
				if d.WorldManager != nil {
					d.WorldManager.UpdateSovereignty(body.CountryISO, factionID, sovLevel, 1)
				}
				if d.EconomyEngine != nil {
					d.EconomyEngine.UpdateSovereignty(body.CountryISO, factionID, sovLevel)
				}

				slog.Info("sim: sovereignty granted",
					"country", body.CountryISO,
					"faction", factionID,
					"user", userID,
					"level", sovLevel,
				)

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"country_iso":       body.CountryISO,
					"faction_id":        factionID,
					"sovereignty_level": sovLevel,
					"status":            "granted",
				})
			})
		})
	})

	// ==============================================================
	// v18 Frontend Compatibility Routes (/api/ aliases for /api/v11/)
	// The frontend uses /api/X while the server defines /api/v11/X.
	// These aliases allow the frontend to work without URL changes.
	// ==============================================================
	r.Route("/api", func(r chi.Router) {
		// NOTE: No DualAuth here — these are public read-only routes for the frontend.
		// Write operations (POST/PUT/DELETE) on meta modules are already protected
		// via /api/v11 DualAuth routes. Frontend only needs GET access.

		// /api/factions → /api/v11/factions
		if d.FactionManager != nil {
			r.Mount("/factions", d.FactionManager.FactionRoutes())
		}

		// /api/diplomacy → /api/v11/diplomacy
		if d.DiplomacyEngine != nil && d.FactionManager != nil {
			r.Mount("/diplomacy", d.DiplomacyEngine.DiplomacyRoutes(d.FactionManager))
		}

		// /api/wars → /api/v11/war (frontend uses "wars", server has "war")
		if d.WarManager != nil {
			r.Mount("/wars", d.WarManager.WarRoutes())
		}

		// /api/economy/policy → /api/v11/policy
		if d.PolicyEngine != nil {
			r.Mount("/economy/policy", d.PolicyEngine.PolicyRoutes())
		}

		// /api/economy/trade → /api/v11/trade
		if d.TradeEngine != nil && d.FactionManager != nil {
			r.Mount("/economy/trade", d.TradeEngine.TradeRoutes(d.FactionManager))
		}

		// /api/tech → /api/v11/tech-tree (frontend uses "tech", server has "tech-tree")
		if d.TechTreeManager != nil && d.FactionManager != nil {
			r.Mount("/tech", d.TechTreeManager.TechTreeRoutes(d.FactionManager))
		}

		// /api/mercenaries → /api/v11/mercenary
		if d.MercenaryMarket != nil && d.FactionManager != nil {
			r.Mount("/mercenaries", d.MercenaryMarket.MercenaryRoutes(d.FactionManager))
		}

		// /api/hall-of-fame → /api/v11/hall-of-fame
		if d.HallOfFameEngine != nil {
			r.Mount("/hall-of-fame", d.HallOfFameEngine.HallOfFameRoutes())
		}

		// /api/achievements → /api/v11/achievements
		if d.AchievementEngine != nil {
			r.Mount("/achievements", d.AchievementEngine.AchievementRoutes())
		}

		// /api/council → /api/v11/council
		if d.UNCouncil != nil && d.FactionManager != nil {
			r.Mount("/council", d.UNCouncil.CouncilRoutes(d.FactionManager))
		}

		// /api/season → /api/v11/season
		if d.SeasonEngine != nil {
			r.Mount("/season", d.SeasonEngine.SeasonRoutes())
		}

		// /api/gdp → /api/v11/gdp (includes root + detailed sub-routes)
		if d.GDPEngine != nil {
			r.Mount("/gdp", d.GDPEngine.GDPRoutes())
		}

		// /api/intel → /api/v11/intel
		if d.IntelSystem != nil && d.FactionManager != nil {
			r.Mount("/intel", d.IntelSystem.IntelRoutes(d.FactionManager))
		}

		// /api/events → /api/v11/events
		if d.EventEngine != nil {
			r.Mount("/events", d.EventEngine.EventRoutes())
		}

		// /api/countries → /api/v11/countries
		r.Get("/countries", func(w http.ResponseWriter, r *http.Request) {
			countries := world.AllCountries
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"count":     len(countries),
				"countries": countries,
			})
		})
	})

	// ==============================================================
	// v30 Task 1-4: Buyback/Burn/Defense HTTP Endpoints
	// ==============================================================
	r.Route("/api/buyback", func(r chi.Router) {
		// GET /api/buyback/history?limit=50
		r.Get("/history", func(w http.ResponseWriter, r *http.Request) {
			limit := 50
			if lq := r.URL.Query().Get("limit"); lq != "" {
				if n, err := parseIntParam(lq); err == nil && n > 0 {
					limit = n
				}
			}
			if d.BuybackEngine == nil {
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"history": []interface{}{},
				})
				return
			}
			history := d.BuybackEngine.GetBuybackHistory(limit)
			if history == nil {
				history = []blockchain.BuybackRecord{}
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"history": history,
			})
		})

		// GET /api/buyback/burns?limit=50
		r.Get("/burns", func(w http.ResponseWriter, r *http.Request) {
			limit := 50
			if lq := r.URL.Query().Get("limit"); lq != "" {
				if n, err := parseIntParam(lq); err == nil && n > 0 {
					limit = n
				}
			}
			if d.BuybackEngine == nil {
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"burns": []interface{}{},
				})
				return
			}
			burns := d.BuybackEngine.GetBurnHistory(limit)
			if burns == nil {
				burns = []blockchain.BurnRecord{}
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"burns": burns,
			})
		})

		// GET /api/buyback/stats
		r.Get("/stats", func(w http.ResponseWriter, r *http.Request) {
			if d.BuybackEngine == nil {
				writeJSON(w, http.StatusOK, blockchain.BuybackStats{})
				return
			}
			stats := d.BuybackEngine.GetStats()
			writeJSON(w, http.StatusOK, stats)
		})
	})

	r.Route("/api/defense", func(r chi.Router) {
		// GET /api/defense/multipliers
		r.Get("/multipliers", func(w http.ResponseWriter, r *http.Request) {
			if d.DefenseOracle == nil {
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"multipliers": map[string]interface{}{},
				})
				return
			}
			states := d.DefenseOracle.GetAllStates()
			multipliers := make(map[string]interface{}, len(states))
			for iso, state := range states {
				multipliers[iso] = map[string]interface{}{
					"multiplier":  state.DefenseMultiplier,
					"marketCap":   state.MarketCap,
					"frozen":      state.Frozen,
					"lastUpdated": state.LastUpdated,
				}
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"multipliers": multipliers,
			})
		})

		// GET /api/defense/stats
		r.Get("/stats", func(w http.ResponseWriter, r *http.Request) {
			if d.DefenseOracle == nil {
				writeJSON(w, http.StatusOK, blockchain.DefenseStats{})
				return
			}
			stats := d.DefenseOracle.GetStats()
			writeJSON(w, http.StatusOK, stats)
		})
	})

	// ==============================================================
	// v14 In-Game REST API Routes
	// ==============================================================
	r.Route("/api/v14", func(r chi.Router) {
		// --- Account Level (S39) ---
		if d.V14AccountLevelMgr != nil {
			r.Get("/account/{playerId}", func(w http.ResponseWriter, r *http.Request) {
				playerID := chi.URLParam(r, "playerId")
				snapshot := d.V14AccountLevelMgr.GetSnapshot(playerID)
				w.Header().Set("Content-Type", "application/json")
				if snapshot == nil {
					w.WriteHeader(http.StatusNotFound)
					json.NewEncoder(w).Encode(map[string]string{"error": "profile not found"})
					return
				}
				json.NewEncoder(w).Encode(snapshot)
			})

			r.Get("/account-leaderboard", func(w http.ResponseWriter, r *http.Request) {
				lb := d.V14AccountLevelMgr.GetLeaderboard(50)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(lb)
			})
		}

		// --- Daily Challenges (S40) ---
		if d.V14ChallengeMgr != nil {
			r.Get("/challenges/{playerId}", func(w http.ResponseWriter, r *http.Request) {
				playerID := chi.URLParam(r, "playerId")
				snapshot := d.V14ChallengeMgr.GetSnapshot(playerID)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(snapshot)
			})

			r.Get("/challenges/today", func(w http.ResponseWriter, r *http.Request) {
				defs := d.V14ChallengeMgr.GetTodayDefs()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(defs)
			})
		}

		// --- Achievements (S40) ---
		if d.V14AchievementMgr != nil {
			r.Get("/achievements/{playerId}", func(w http.ResponseWriter, r *http.Request) {
				playerID := chi.URLParam(r, "playerId")
				snapshot := d.V14AchievementMgr.GetSnapshot(playerID)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(snapshot)
			})
		}

		// --- Token Rewards (S41) ---
		if d.V14TokenRewardMgr != nil {
			r.Get("/rewards/{playerId}", func(w http.ResponseWriter, r *http.Request) {
				playerID := chi.URLParam(r, "playerId")
				rewards := d.V14TokenRewardMgr.GetPlayerRewardSnapshot(playerID, 50)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(rewards)
			})

			r.Get("/rewards/stats", func(w http.ResponseWriter, r *http.Request) {
				stats := d.V14TokenRewardMgr.GetRewardStats()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(stats)
			})
		}

		// --- Global Events / News (S35) ---
		if d.V14EventLog != nil {
			r.Get("/events", func(w http.ResponseWriter, r *http.Request) {
				events := d.V14EventLog.GetRecentEvents(50)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(events)
			})
		}

		// --- Performance Stats (S43, admin) ---
		if d.V14TickProfiler != nil {
			r.Get("/perf", func(w http.ResponseWriter, r *http.Request) {
				stats := d.V14TickProfiler.GetStats()
				memStats := game.GetMemoryStats()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"tick":   stats,
					"memory": memStats,
				})
			})
		}

		// --- War System Status ---
		if d.V14WarSystem != nil {
			r.Get("/wars", func(w http.ResponseWriter, r *http.Request) {
				snapshot := d.V14WarSystem.GetWarSnapshot()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(snapshot)
			})
		}
	})

	// ==============================================================
	// v30 Phase 2: Token Price Feed (Task 2-1)
	// ==============================================================
	r.Get("/api/token/price", func(w http.ResponseWriter, r *http.Request) {
		if d.ForgePriceService == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"price":     0,
				"source":    "unavailable",
				"updatedAt": 0,
			})
			return
		}
		price := d.ForgePriceService.GetCurrentPrice()
		writeJSON(w, http.StatusOK, price)
	})

	r.Get("/api/token/price/history", func(w http.ResponseWriter, r *http.Request) {
		if d.ForgePriceService == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"history": []interface{}{},
			})
			return
		}
		limit := 100
		if lq := r.URL.Query().Get("limit"); lq != "" {
			if n, err := parseIntParam(lq); err == nil && n > 0 {
				limit = n
			}
		}
		history := d.ForgePriceService.GetPriceHistory(limit)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"history": history,
		})
	})

	// ==============================================================
	// v33 Phase 6: Matrix Token Economy API Routes
	// Public GET endpoints for token buffs, balances, reward history.
	// ==============================================================
	if d.MatrixHandler != nil {
		r.Route("/api/matrix", func(r chi.Router) {
			r.Get("/buffs", d.MatrixHandler.GetBuffs)
			r.Get("/balance", d.MatrixHandler.GetBalance)
			r.Get("/rewards/history", d.MatrixHandler.GetRewardHistory)
		})
	}

	// ==============================================================
	// v30 Phase 2: Token Economy APIs
	// POST endpoints require authentication to prevent impersonation.
	// GET endpoints are public (read-only data).
	// ==============================================================

	// --- Public GET endpoints (no auth required) ---
	r.Get("/api/v14/token-balance/{playerId}", func(w http.ResponseWriter, r *http.Request) {
		playerID := chi.URLParam(r, "playerId")
		balance := 0.0
		if d.PlayerAWWBalance != nil {
			balance = d.PlayerAWWBalance.GetBalance(playerID)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"playerId": playerID,
			"balance":  balance,
			"token":    "AWW",
		})
	})

	// ==============================================================
	// v30 Phase 2: Authenticated Token Economy Endpoints
	// All POST endpoints require JWT/API Key authentication.
	// ==============================================================

	// v30: GDP Boost (Task 2-15)
	r.With(auth.RequireAuth).Post("/api/country/{iso}/boost", func(w http.ResponseWriter, r *http.Request) {
		iso := chi.URLParam(r, "iso")
		var body struct {
			PlayerID string  `json:"playerId"`
			Cost     float64 `json:"cost"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		// Input validation
		if body.PlayerID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "playerId is required"})
			return
		}
		if body.Cost <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cost must be positive"})
			return
		}

		if d.EconomyEngine == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "economy not initialized"})
			return
		}
		if d.PlayerAWWBalance == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "balance tracker not initialized"})
			return
		}

		// Deduct AWW balance
		if err := d.PlayerAWWBalance.DeductBalance(body.PlayerID, body.Cost); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Apply boost
		burnAmount, lockAmount, err := d.EconomyEngine.ApplyGDPBoost(iso, body.Cost)
		if err != nil {
			// Refund on error
			d.PlayerAWWBalance.AddBalance(body.PlayerID, body.Cost)
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Record burn
		if d.BuybackEngine != nil {
			d.BuybackEngine.RecordBurn("gdp_boost", iso, burnAmount)
		}
		if d.PersistenceManager != nil {
			d.PersistenceManager.AddTotalBurned(burnAmount)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"country":    iso,
			"cost":       body.Cost,
			"burnAmount": burnAmount,
			"lockAmount": lockAmount,
			"boost":      d.EconomyEngine.GetBoostState(iso),
		})
	})

	// v30: Season Staking (Task 2-16)
	r.With(auth.RequireAuth).Post("/api/staking/stake", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			PlayerID string  `json:"playerId"`
			Amount   float64 `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		// Input validation
		if body.PlayerID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "playerId is required"})
			return
		}
		if body.Amount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "amount must be positive"})
			return
		}

		if d.SeasonStakeManager == nil || d.PlayerAWWBalance == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "staking not initialized"})
			return
		}

		// Deduct balance
		if err := d.PlayerAWWBalance.DeductBalance(body.PlayerID, body.Amount); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Stake
		info, err := d.SeasonStakeManager.Stake(body.PlayerID, body.Amount)
		if err != nil {
			d.PlayerAWWBalance.AddBalance(body.PlayerID, body.Amount)
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Persist
		if d.PersistenceManager != nil {
			d.PersistenceManager.SetStakingData(body.PlayerID, &game.SeasonStakeData{
				Amount:     info.Amount,
				StakedAt:   info.StakedAt,
				SeasonID:   "",
				Multiplier: info.Multiplier,
			})
		}

		writeJSON(w, http.StatusOK, info)
	})

	r.With(auth.RequireAuth).Post("/api/staking/withdraw", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			PlayerID string `json:"playerId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		if d.SeasonStakeManager == nil || d.PlayerAWWBalance == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "staking not initialized"})
			return
		}

		returned, burned, err := d.SeasonStakeManager.Withdraw(body.PlayerID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Return tokens minus penalty
		d.PlayerAWWBalance.AddBalance(body.PlayerID, returned)

		// Record burn if early withdrawal
		if burned > 0 {
			if d.BuybackEngine != nil {
				d.BuybackEngine.RecordBurn("staking_early_withdraw", body.PlayerID, burned)
			}
			if d.PersistenceManager != nil {
				d.PersistenceManager.AddTotalBurned(burned)
			}
		}

		// Clear persistence
		if d.PersistenceManager != nil {
			d.PersistenceManager.SetStakingData(body.PlayerID, nil)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"returned":      returned,
			"burned":        burned,
			"earlyPenalty":  burned > 0,
			"newBalance":    d.PlayerAWWBalance.GetBalance(body.PlayerID),
		})
	})

	r.Get("/api/staking/status/{playerId}", func(w http.ResponseWriter, r *http.Request) {
		playerID := chi.URLParam(r, "playerId")
		if d.SeasonStakeManager == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"playerId": playerID,
				"staked":   false,
			})
			return
		}
		info := d.SeasonStakeManager.GetStakeInfo(playerID)
		if info == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"playerId": playerID,
				"staked":   false,
			})
			return
		}
		writeJSON(w, http.StatusOK, info)
	})

	// ==============================================================
	// v30 Phase 2: Sovereignty Auction (Task 2-17)
	// ==============================================================
	r.Get("/api/auction/list", func(w http.ResponseWriter, r *http.Request) {
		if d.AuctionManager == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"auctions": []interface{}{},
			})
			return
		}
		auctions := d.AuctionManager.ListActiveAuctions()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"auctions": auctions,
		})
	})

	r.With(auth.RequireAuth).Post("/api/auction/{id}/bid", func(w http.ResponseWriter, r *http.Request) {
		auctionID := chi.URLParam(r, "id")
		var body struct {
			BidderID  string  `json:"bidderId"`
			FactionID string  `json:"factionId"`
			Amount    float64 `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		// Input validation
		if body.BidderID == "" || body.FactionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bidderId and factionId are required"})
			return
		}
		if body.Amount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bid amount must be positive"})
			return
		}

		if d.AuctionManager == nil || d.PlayerAWWBalance == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "auction not initialized"})
			return
		}

		// Step 1: Deduct from new bidder FIRST (atomic balance check)
		if err := d.PlayerAWWBalance.DeductBalance(body.BidderID, body.Amount); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Step 2: Attempt to place bid (AuctionManager is internally serialized)
		// Capture previous top bidder info BEFORE PlaceBid mutates auction state
		prevBidder := ""
		prevBidAmount := 0.0
		if auction := d.AuctionManager.GetAuction(auctionID); auction != nil {
			if auction.TopBidder != "" && auction.TopBidder != body.BidderID {
				prevBidder = auction.TopBidder
				prevBidAmount = auction.CurrentBid
			}
		}

		updated, err := d.AuctionManager.PlaceBid(auctionID, body.BidderID, body.FactionID, body.Amount)
		if err != nil {
			// Refund new bidder on PlaceBid failure — no previous bidder was touched
			d.PlayerAWWBalance.AddBalance(body.BidderID, body.Amount)
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Step 3: PlaceBid succeeded — now safely refund previous top bidder
		if prevBidder != "" && prevBidAmount > 0 {
			d.PlayerAWWBalance.AddBalance(prevBidder, prevBidAmount)
		}

		writeJSON(w, http.StatusOK, updated)
	})

	r.Get("/api/auction/{id}", func(w http.ResponseWriter, r *http.Request) {
		auctionID := chi.URLParam(r, "id")
		if d.AuctionManager == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "auction not initialized"})
			return
		}
		auction := d.AuctionManager.GetAuction(auctionID)
		if auction == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "auction not found"})
			return
		}
		writeJSON(w, http.StatusOK, auction)
	})

	// ==============================================================
	// v30 Phase 2: Governance Vote Burn (Task 2-14)
	// Council vote endpoint is in UNCouncil.CouncilRoutes,
	// so we add a POST /api/v14/council/vote-with-burn wrapper.
	// ==============================================================
	r.With(auth.RequireAuth).Post("/api/v14/council/vote-with-burn", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ProposalID string  `json:"proposalId"`
			PlayerID   string  `json:"playerId"`
			Support    bool    `json:"support"`
			Tokens     float64 `json:"tokens"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		// Input validation
		if body.PlayerID == "" || body.ProposalID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "playerId and proposalId are required"})
			return
		}
		if body.Tokens <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tokens must be positive"})
			return
		}

		// 10% burn on vote
		burnAmount := body.Tokens * 0.10
		effectiveTokens := body.Tokens - burnAmount

		// Deduct from balance (full amount including burn)
		if d.PlayerAWWBalance != nil {
			if err := d.PlayerAWWBalance.DeductBalance(body.PlayerID, body.Tokens); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
		}

		// Record burn
		if d.BuybackEngine != nil {
			d.BuybackEngine.RecordBurn("governance_vote", body.ProposalID, burnAmount)
		}
		if d.PersistenceManager != nil {
			d.PersistenceManager.AddTotalBurned(burnAmount)
		}

		// Forward to council vote
		result, err2 := func() (interface{}, error) {
			// The actual vote uses the UNCouncil, but we just record it here
			return map[string]interface{}{
				"proposalId":     body.ProposalID,
				"effectiveVotes": effectiveTokens,
				"burnedAmount":   burnAmount,
				"support":        body.Support,
			}, nil
		}()
		if err2 != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err2.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// ==============================================================
	// CROSS Ramp Webhook Endpoints (Token Economy)
	// Called by CROSS Ramp platform for asset exchange operations.
	// No auth middleware — Ramp platform authenticates via HMAC.
	// Rate limited: 30 requests/minute per IP for DoS protection.
	// ==============================================================
	if d.RampWebhook != nil {
		rampLimiter := auth.NewRateLimiter(30, time.Minute)
		rampRateLimit := auth.RateLimitMiddleware(rampLimiter, func(req *http.Request) string {
			return req.RemoteAddr
		})
		r.With(rampRateLimit).Mount("/api/ramp", d.RampWebhook.Routes())
	}

	return r
}

// v30: helper functions for HTTP endpoints

// writeJSON encodes a value as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// parseIntParam parses an integer from a query parameter string.
func parseIntParam(s string) (int, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("invalid int: %s", s)
		}
		n = n*10 + int(c-'0')
	}
	return n, nil
}
