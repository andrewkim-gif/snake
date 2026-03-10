// Package api provides HTTP REST API handlers for the Agent API (Phase 5, S24).
// Endpoints: deploy, recall, status, battle-log, strategy + OpenAPI spec.
package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
)

// --- Public Registration types ---

// PublicRegisterRequest is the body for POST /api/v1/agents/register (no auth required).
type PublicRegisterRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Nationality string `json:"nationality"`
	OwnerWallet string `json:"owner_wallet,omitempty"`
	CallbackURL string `json:"callback_url,omitempty"`
}

// PublicRegisterResponse is returned after successful public registration.
type PublicRegisterResponse struct {
	AgentID   string `json:"agent_id"`
	APIKey    string `json:"api_key"`
	CreatedAt string `json:"created_at"`
}

// --- Request/Response types ---

// DeployRequest is the body for POST /api/agents/deploy.
type DeployRequest struct {
	CountryISO   string `json:"country_iso"`
	AgentName    string `json:"agent_name"`
	SkinID       int    `json:"skin_id"`
	AutoRedeploy bool   `json:"auto_redeploy"`
}

// DeployResponse is returned after a successful deployment.
type DeployResponse struct {
	AgentID    string `json:"agent_id"`
	CountryISO string `json:"country_iso"`
	Cost       int64  `json:"cost"`
	Status     string `json:"status"`
}

// RecallRequest is the body for POST /api/agents/recall.
type RecallRequest struct {
	AgentID string `json:"agent_id"`
}

// AgentStatusResponse is returned by GET /api/agents/{id}/status.
type AgentStatusResponse struct {
	AgentID      string    `json:"agent_id"`
	UserID       string    `json:"user_id"`
	CountryISO   string    `json:"country_iso"`
	CountryName  string    `json:"country_name"`
	Status       string    `json:"status"`
	Level        int       `json:"level"`
	XP           int       `json:"xp"`
	HP           float64   `json:"hp"`
	Kills        int       `json:"kills"`
	Deaths       int       `json:"deaths"`
	TotalScore   int       `json:"total_score"`
	Position     *Position `json:"position,omitempty"`
	DeployedAt   time.Time `json:"deployed_at"`
	AutoRedeploy bool      `json:"auto_redeploy"`
	FactionID    string    `json:"faction_id,omitempty"`
}

// Position is a 2D coordinate.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BattleLogEntry is a single entry in the battle log.
type BattleLogEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	BattleID    string    `json:"battle_id"`
	CountryISO  string    `json:"country_iso"`
	Result      string    `json:"result"` // "survived", "killed", "died"
	Kills       int       `json:"kills"`
	Deaths      int       `json:"deaths"`
	Score       int       `json:"score"`
	Duration    int       `json:"duration_sec"`
	FinalLevel  int       `json:"final_level"`
	KilledBy    string    `json:"killed_by,omitempty"`
}

// BattleLogResponse is returned by GET /api/agents/{id}/battle-log.
type BattleLogResponse struct {
	AgentID string           `json:"agent_id"`
	Logs    []BattleLogEntry `json:"logs"`
	Total   int              `json:"total"`
}

// StrategyRequest is the body for POST /api/agents/{id}/strategy.
type StrategyRequest struct {
	BuildPriority  *BuildPriority  `json:"build_priority,omitempty"`
	CombatBehavior *CombatBehavior `json:"combat_behavior,omitempty"`
	Deployment     *DeploymentPref `json:"deployment,omitempty"`
}

// BuildPriority configures the agent's preferred build choices.
type BuildPriority struct {
	PreferredTomes     []string `json:"preferred_tomes"`
	PreferredAbilities []string `json:"preferred_abilities"`
	SynergyTarget      string   `json:"synergy_target"`
}

// CombatBehavior configures the agent's combat style.
type CombatBehavior struct {
	Aggression       float64 `json:"aggression"`        // 0.0 ~ 1.0
	TargetPriority   string  `json:"target_priority"`   // "lowest_hp" | "highest_level" | "nearest" | "strongest"
	RetreatThreshold float64 `json:"retreat_threshold"`  // HP% (0.1 ~ 0.5)
	UseDash          bool    `json:"use_dash"`
}

// DeploymentPref configures deployment preferences.
type DeploymentPref struct {
	PreferredCountries []string `json:"preferred_countries"`
	AutoRedeploy       bool     `json:"auto_redeploy"`
	AvoidSTier         bool     `json:"avoid_s_tier"`
}

// StrategyResponse is returned after setting strategy.
type StrategyResponse struct {
	AgentID  string          `json:"agent_id"`
	Strategy StrategyRequest `json:"strategy"`
	Updated  time.Time       `json:"updated_at"`
}

// --- Function hooks (injected to avoid circular imports) ---

// DeployFunc deploys an agent to a country.
type DeployFunc func(userID, factionID, countryISO, agentName string, skinID int, autoRedeploy bool) (*DeployResponse, error)

// RecallFunc recalls an agent.
type RecallFunc func(userID, agentID string) error

// GetAgentStatusFunc returns the status of a specific agent.
type GetAgentStatusFunc func(userID, agentID string) (*AgentStatusResponse, error)

// GetBattleLogFunc returns the battle log for an agent.
type GetBattleLogFunc func(userID, agentID string, limit int) (*BattleLogResponse, error)

// SetStrategyFunc sets the strategy for an agent.
type SetStrategyFunc func(userID, agentID string, strategy StrategyRequest) (*StrategyResponse, error)

// GetFactionIDFunc returns the faction ID for a user.
type GetFactionIDFunc func(userID string) string

// --- AgentRouter ---

// agentRecord stores a registered agent's metadata.
type agentRecord struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Nationality string `json:"nationality"`
	OwnerWallet string `json:"owner_wallet,omitempty"`
	KeyPrefix   string `json:"key_prefix"`
	CreatedAt   string `json:"created_at"`
}

// AgentRouter provides the REST API routes for agent management.
type AgentRouter struct {
	mu sync.RWMutex

	// Injected function hooks
	Deploy         DeployFunc
	Recall         RecallFunc
	GetAgentStatus GetAgentStatusFunc
	GetBattleLog   GetBattleLogFunc
	SetStrategy    SetStrategyFunc
	GetFactionID   GetFactionIDFunc

	// In-memory strategy store (until DB integration)
	strategies map[string]*StrategyRequest // agentID → strategy

	// In-memory battle log store
	battleLogs map[string][]BattleLogEntry // agentID → logs

	// In-memory agent registry (public registration)
	agents map[string]*agentRecord // agentID → record

	// Rate limiter for public registration (5 per minute per IP)
	registerLimiter *auth.RateLimiter
}

// NewAgentRouter creates a new AgentRouter.
func NewAgentRouter() *AgentRouter {
	return &AgentRouter{
		strategies:      make(map[string]*StrategyRequest),
		battleLogs:      make(map[string][]BattleLogEntry),
		agents:          make(map[string]*agentRecord),
		registerLimiter: auth.NewRateLimiter(5, time.Minute),
	}
}

// Routes returns a chi.Router with all agent API routes mounted.
func (ar *AgentRouter) Routes() chi.Router {
	r := chi.NewRouter()

	// POST /api/agents/deploy
	r.Post("/deploy", ar.handleDeploy)

	// POST /api/agents/recall
	r.Post("/recall", ar.handleRecall)

	// GET /api/agents/{id}/status
	r.Get("/{id}/status", ar.handleGetStatus)

	// GET /api/agents/{id}/battle-log
	r.Get("/{id}/battle-log", ar.handleGetBattleLog)

	// POST /api/agents/{id}/strategy
	r.Post("/{id}/strategy", ar.handleSetStrategy)

	// GET /api/agents/openapi — OpenAPI spec document
	r.Get("/openapi", ar.handleOpenAPISpec)

	return r
}

// --- Handlers ---

func (ar *AgentRouter) handleDeploy(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req DeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CountryISO == "" {
		writeError(w, http.StatusBadRequest, "country_iso is required")
		return
	}
	if req.AgentName == "" {
		req.AgentName = fmt.Sprintf("Agent-%s", userID[:8])
	}

	if ar.Deploy == nil {
		writeError(w, http.StatusServiceUnavailable, "deployment service unavailable")
		return
	}

	factionID := ""
	if ar.GetFactionID != nil {
		factionID = ar.GetFactionID(userID)
	}

	resp, err := ar.Deploy(userID, factionID, req.CountryISO, req.AgentName, req.SkinID, req.AutoRedeploy)
	if err != nil {
		slog.Warn("agent deploy failed", "userId", userID, "country", req.CountryISO, "error", err)
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (ar *AgentRouter) handleRecall(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req RecallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.AgentID == "" {
		writeError(w, http.StatusBadRequest, "agent_id is required")
		return
	}

	if ar.Recall == nil {
		writeError(w, http.StatusServiceUnavailable, "recall service unavailable")
		return
	}

	if err := ar.Recall(userID, req.AgentID); err != nil {
		slog.Warn("agent recall failed", "userId", userID, "agentId", req.AgentID, "error", err)
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "recalled",
		"agent_id": req.AgentID,
	})
}

func (ar *AgentRouter) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	agentID := chi.URLParam(r, "id")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent id is required")
		return
	}

	if ar.GetAgentStatus != nil {
		resp, err := ar.GetAgentStatus(userID, agentID)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
		return
	}

	// Fallback: return basic status from strategy store
	writeError(w, http.StatusServiceUnavailable, "agent status service unavailable")
}

func (ar *AgentRouter) handleGetBattleLog(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	agentID := chi.URLParam(r, "id")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent id is required")
		return
	}

	if ar.GetBattleLog != nil {
		resp, err := ar.GetBattleLog(userID, agentID, 50)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
		return
	}

	// Fallback: return from in-memory store
	ar.mu.RLock()
	logs, ok := ar.battleLogs[agentID]
	ar.mu.RUnlock()

	if !ok {
		logs = []BattleLogEntry{}
	}

	writeJSON(w, http.StatusOK, &BattleLogResponse{
		AgentID: agentID,
		Logs:    logs,
		Total:   len(logs),
	})
}

func (ar *AgentRouter) handleSetStrategy(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	agentID := chi.URLParam(r, "id")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent id is required")
		return
	}

	var req StrategyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate combat behavior
	if req.CombatBehavior != nil {
		if req.CombatBehavior.Aggression < 0 || req.CombatBehavior.Aggression > 1.0 {
			writeError(w, http.StatusBadRequest, "aggression must be between 0.0 and 1.0")
			return
		}
		if req.CombatBehavior.RetreatThreshold < 0.1 || req.CombatBehavior.RetreatThreshold > 0.5 {
			writeError(w, http.StatusBadRequest, "retreat_threshold must be between 0.1 and 0.5")
			return
		}
		validPriorities := map[string]bool{
			"lowest_hp": true, "highest_level": true, "nearest": true, "strongest": true,
		}
		if req.CombatBehavior.TargetPriority != "" && !validPriorities[req.CombatBehavior.TargetPriority] {
			writeError(w, http.StatusBadRequest, "invalid target_priority")
			return
		}
	}

	if ar.SetStrategy != nil {
		resp, err := ar.SetStrategy(userID, agentID, req)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
		return
	}

	// Fallback: store in-memory
	ar.mu.Lock()
	ar.strategies[agentID] = &req
	ar.mu.Unlock()

	writeJSON(w, http.StatusOK, &StrategyResponse{
		AgentID:  agentID,
		Strategy: req,
		Updated:  time.Now(),
	})
}

// AddBattleLog appends a battle log entry for an agent (called by game loop).
func (ar *AgentRouter) AddBattleLog(agentID string, entry BattleLogEntry) {
	ar.mu.Lock()
	defer ar.mu.Unlock()

	logs := ar.battleLogs[agentID]
	logs = append(logs, entry)
	// Keep max 100 entries
	if len(logs) > 100 {
		logs = logs[len(logs)-100:]
	}
	ar.battleLogs[agentID] = logs
}

// GetStrategy returns the stored strategy for an agent.
func (ar *AgentRouter) GetStrategy(agentID string) *StrategyRequest {
	ar.mu.RLock()
	defer ar.mu.RUnlock()
	return ar.strategies[agentID]
}

// --- OpenAPI Spec ---

func (ar *AgentRouter) handleOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	spec := map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "AI World War — Agent API",
			"version":     "1.0.0",
			"description": "REST API for deploying, managing, and monitoring AI agents in the World War game.",
		},
		"servers": []map[string]string{
			{"url": "/api/agents", "description": "Agent API base"},
		},
		"paths": map[string]interface{}{
			"/deploy": map[string]interface{}{
				"post": map[string]interface{}{
					"summary":     "Deploy an agent to a country",
					"operationId": "deployAgent",
					"security":    []map[string][]string{{"ApiKeyAuth": {}}},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/DeployRequest"},
							},
						},
					},
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Agent deployed successfully"},
						"400": map[string]interface{}{"description": "Invalid request or deployment limit reached"},
						"401": map[string]interface{}{"description": "Unauthorized"},
					},
				},
			},
			"/recall": map[string]interface{}{
				"post": map[string]interface{}{
					"summary":     "Recall an agent from deployment",
					"operationId": "recallAgent",
					"security":    []map[string][]string{{"ApiKeyAuth": {}}},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/RecallRequest"},
							},
						},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Agent recalled"},
						"400": map[string]interface{}{"description": "Invalid request"},
					},
				},
			},
			"/{id}/status": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Get agent status",
					"operationId": "getAgentStatus",
					"security":    []map[string][]string{{"ApiKeyAuth": {}}},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]string{"type": "string"}},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Agent status"},
						"404": map[string]interface{}{"description": "Agent not found"},
					},
				},
			},
			"/{id}/battle-log": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Get agent battle log",
					"operationId": "getAgentBattleLog",
					"security":    []map[string][]string{{"ApiKeyAuth": {}}},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]string{"type": "string"}},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Battle log entries"},
					},
				},
			},
			"/{id}/strategy": map[string]interface{}{
				"post": map[string]interface{}{
					"summary":     "Set agent strategy (build priority, combat behavior, deployment preferences)",
					"operationId": "setAgentStrategy",
					"security":    []map[string][]string{{"ApiKeyAuth": {}}},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]string{"type": "string"}},
					},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/StrategyRequest"},
							},
						},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Strategy updated"},
						"400": map[string]interface{}{"description": "Invalid strategy"},
					},
				},
			},
		},
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"ApiKeyAuth": map[string]interface{}{
					"type": "apiKey",
					"in":   "header",
					"name": "X-API-Key",
				},
				"BearerAuth": map[string]interface{}{
					"type":   "http",
					"scheme": "bearer",
				},
			},
			"schemas": map[string]interface{}{
				"DeployRequest": map[string]interface{}{
					"type": "object",
					"required": []string{"country_iso"},
					"properties": map[string]interface{}{
						"country_iso":  map[string]string{"type": "string", "description": "ISO 3166-1 alpha-3 country code"},
						"agent_name":   map[string]string{"type": "string", "description": "Display name for the agent"},
						"skin_id":      map[string]string{"type": "integer", "description": "Agent skin ID"},
						"auto_redeploy": map[string]string{"type": "boolean", "description": "Auto-redeploy after death"},
					},
				},
				"RecallRequest": map[string]interface{}{
					"type": "object",
					"required": []string{"agent_id"},
					"properties": map[string]interface{}{
						"agent_id": map[string]string{"type": "string", "description": "Agent ID to recall"},
					},
				},
				"StrategyRequest": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"build_priority":  map[string]string{"type": "object", "description": "Build priority (tomes, abilities, synergy target)"},
						"combat_behavior": map[string]string{"type": "object", "description": "Combat behavior settings (aggression, targeting, retreat)"},
						"deployment":      map[string]string{"type": "object", "description": "Deployment preferences"},
					},
				},
			},
		},
	}

	writeJSON(w, http.StatusOK, spec)
}

// PublicRoutes returns a chi.Router with unauthenticated agent endpoints.
// Mounted at /api/v1/agents (no auth middleware).
func (ar *AgentRouter) PublicRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/register", ar.handlePublicRegister)
	return r
}

// handlePublicRegister handles POST /api/v1/agents/register
// No authentication required — generates agent_id + api_key for new agents.
func (ar *AgentRouter) handlePublicRegister(w http.ResponseWriter, r *http.Request) {
	// Rate limit by IP
	ip := r.RemoteAddr
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ip = fwd
	}
	if !ar.registerLimiter.Allow(ip) {
		w.Header().Set("Retry-After", "60")
		writeError(w, http.StatusTooManyRequests, "rate limit exceeded, try again in 60s")
		return
	}

	var req PublicRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Validate required fields
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(req.Name) > 64 {
		writeError(w, http.StatusBadRequest, "name must be 64 characters or less")
		return
	}
	if req.Nationality == "" {
		writeError(w, http.StatusBadRequest, "nationality is required (ISO 3166-1 alpha-3)")
		return
	}
	if len(req.Nationality) != 3 {
		writeError(w, http.StatusBadRequest, "nationality must be a 3-letter ISO code (e.g. KOR, USA)")
		return
	}

	// Check duplicate name
	ar.mu.RLock()
	for _, a := range ar.agents {
		if a.Name == req.Name {
			ar.mu.RUnlock()
			writeError(w, http.StatusConflict, fmt.Sprintf("agent name %q already taken", req.Name))
			return
		}
	}
	ar.mu.RUnlock()

	// Generate API key
	fullKey, prefix, _, err := auth.GenerateAPIKey()
	if err != nil {
		slog.Error("failed to generate API key", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to generate API key")
		return
	}

	// Generate agent ID (aww_ag_ + 16 hex chars)
	idBytes := make([]byte, 8)
	if _, err := rand.Read(idBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate agent ID")
		return
	}
	agentID := "aww_ag_" + hex.EncodeToString(idBytes)

	now := time.Now().UTC()
	record := &agentRecord{
		ID:          agentID,
		Name:        req.Name,
		Description: req.Description,
		Nationality: req.Nationality,
		OwnerWallet: req.OwnerWallet,
		KeyPrefix:   prefix,
		CreatedAt:   now.Format(time.RFC3339),
	}

	ar.mu.Lock()
	ar.agents[agentID] = record
	ar.mu.Unlock()

	slog.Info("agent registered",
		"agent_id", agentID,
		"name", req.Name,
		"nationality", req.Nationality,
		"key_prefix", prefix,
		"ip", ip,
	)

	writeJSON(w, http.StatusCreated, PublicRegisterResponse{
		AgentID:   agentID,
		APIKey:    fullKey,
		CreatedAt: now.Format(time.RFC3339),
	})
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
