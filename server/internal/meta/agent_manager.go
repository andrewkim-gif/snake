package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
)

// AgentDeploymentRequest is the HTTP request body for deploying an agent.
type AgentDeploymentRequest struct {
	CountryISO   string `json:"country_iso"`
	AgentName    string `json:"agent_name"`
	SkinID       int    `json:"skin_id"`
	AutoRedeploy bool   `json:"auto_redeploy"`
}

// AgentDeploymentResponse is the HTTP response for agent deployment.
type AgentDeploymentResponse struct {
	AgentID    string `json:"agent_id"`
	CountryISO string `json:"country_iso"`
	Cost       int64  `json:"cost"`
	Status     string `json:"status"`
}

// AgentRecallRequest is the HTTP request body for recalling an agent.
type AgentRecallRequest struct {
	AgentID string `json:"agent_id"`
}

// AgentInfo represents the current status of a user's deployed agent.
type AgentInfo struct {
	AgentID      string    `json:"agent_id"`
	CountryISO   string    `json:"country_iso"`
	CountryName  string    `json:"country_name,omitempty"`
	Status       string    `json:"status"`
	Kills        int       `json:"kills"`
	Deaths       int       `json:"deaths"`
	TotalScore   int       `json:"total_score"`
	DeployedAt   time.Time `json:"deployed_at"`
	AutoRedeploy bool     `json:"auto_redeploy"`
}

// DeployFunc is the function signature for deploying an agent.
// This decouples the HTTP handler from the world package to avoid circular imports.
type DeployFunc func(userID, factionID, countryISO, agentName string, skinID int, autoRedeploy bool) (*AgentDeploymentResponse, error)

// RecallFunc is the function signature for recalling an agent.
type RecallFunc func(userID, agentID string) error

// GetUserAgentsFunc returns all agents for a user.
type GetUserAgentsFunc func(userID string) []AgentInfo

// AgentManager provides HTTP handlers for agent deployment operations.
// It bridges the HTTP API layer with the world/deployment system.
type AgentManager struct {
	mu sync.RWMutex

	// Function hooks (injected by main.go to avoid circular imports)
	DeployAgent    DeployFunc
	RecallAgent    RecallFunc
	GetAgents      GetUserAgentsFunc

	// Faction manager reference for looking up user factions
	factionManager *FactionManager
}

// NewAgentManager creates a new AgentManager.
func NewAgentManager(fm *FactionManager) *AgentManager {
	return &AgentManager{
		factionManager: fm,
	}
}

// HandleDeploy handles POST /api/agents/deploy
func (am *AgentManager) HandleDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Extract user from auth context
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req AgentDeploymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.CountryISO == "" {
		http.Error(w, `{"error":"country_iso is required"}`, http.StatusBadRequest)
		return
	}
	if req.AgentName == "" {
		req.AgentName = fmt.Sprintf("Agent-%s", userID[:8])
	}

	// Look up user's faction
	factionID := ""
	if am.factionManager != nil {
		factionID = am.factionManager.GetUserFaction(userID)
	}

	if am.DeployAgent == nil {
		http.Error(w, `{"error":"deployment service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	// Deploy
	resp, err := am.DeployAgent(userID, factionID, req.CountryISO, req.AgentName, req.SkinID, req.AutoRedeploy)
	if err != nil {
		slog.Warn("agent deploy failed",
			"userId", userID,
			"country", req.CountryISO,
			"error", err,
		)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// HandleRecall handles POST /api/agents/recall
func (am *AgentManager) HandleRecall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID := auth.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req AgentRecallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.AgentID == "" {
		http.Error(w, `{"error":"agent_id is required"}`, http.StatusBadRequest)
		return
	}

	if am.RecallAgent == nil {
		http.Error(w, `{"error":"recall service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	if err := am.RecallAgent(userID, req.AgentID); err != nil {
		slog.Warn("agent recall failed",
			"userId", userID,
			"agentId", req.AgentID,
			"error", err,
		)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "recalled",
		"agent_id": req.AgentID,
	})
}

// HandleGetAgents handles GET /api/agents
func (am *AgentManager) HandleGetAgents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID := auth.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if am.GetAgents == nil {
		http.Error(w, `{"error":"agent service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	agents := am.GetAgents(userID)
	if agents == nil {
		agents = []AgentInfo{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"agents": agents,
		"count":  len(agents),
	})
}
