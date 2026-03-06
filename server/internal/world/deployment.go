package world

import (
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"
)

// DeploymentConfig holds configuration for the agent deployment system.
type DeploymentConfig struct {
	// MaxDeploymentsPerUser is the max number of countries a user can deploy to simultaneously.
	MaxDeploymentsPerUser int

	// BaseDeployCostOil is the base oil cost for deploying an agent.
	BaseDeployCostOil int64

	// DistanceCostMultiplier scales oil cost by distance (per 1000km equivalent).
	DistanceCostMultiplier float64

	// RecallCooldownSec is the cooldown before a recalled agent can be redeployed.
	RecallCooldownSec int

	// AutoRedeployEnabled allows agents to auto-redeploy after death.
	AutoRedeployEnabled bool
}

// DefaultDeploymentConfig returns default deployment configuration.
func DefaultDeploymentConfig() DeploymentConfig {
	return DeploymentConfig{
		MaxDeploymentsPerUser:  3,
		BaseDeployCostOil:      50,
		DistanceCostMultiplier: 10.0,
		RecallCooldownSec:      30,
		AutoRedeployEnabled:    true,
	}
}

// DeployedAgent represents a single agent deployed to a country.
type DeployedAgent struct {
	AgentID     string    `json:"agent_id"`
	UserID      string    `json:"user_id"`
	FactionID   string    `json:"faction_id"`
	CountryISO  string    `json:"country_iso"`
	Name        string    `json:"name"`
	SkinID      int       `json:"skin_id"`
	Status      string    `json:"status"` // "active", "dead", "recalled", "deploying"
	DeployedAt  time.Time `json:"deployed_at"`
	RecalledAt  time.Time `json:"recalled_at,omitempty"`
	DeployCost  int64     `json:"deploy_cost"`
	AutoRedeploy bool    `json:"auto_redeploy"`

	// Stats from current deployment
	Kills      int   `json:"kills"`
	Deaths     int   `json:"deaths"`
	TotalScore int   `json:"total_score"`
}

// DeployRequest is the input for deploying an agent.
type DeployRequest struct {
	UserID       string `json:"user_id"`
	FactionID    string `json:"faction_id"`
	CountryISO   string `json:"country_iso"`
	AgentName    string `json:"agent_name"`
	SkinID       int    `json:"skin_id"`
	AutoRedeploy bool   `json:"auto_redeploy"`
	// OriginISO is the user's home/current country for distance cost calculation.
	OriginISO    string `json:"origin_iso,omitempty"`
}

// DeployResponse is the output after deploying an agent.
type DeployResponse struct {
	AgentID    string `json:"agent_id"`
	CountryISO string `json:"country_iso"`
	Cost       int64  `json:"cost"`
	Status     string `json:"status"`
}

// RecallRequest is the input for recalling an agent.
type RecallRequest struct {
	UserID  string `json:"user_id"`
	AgentID string `json:"agent_id"`
}

// DeploymentManager manages agent deployments across countries.
// It enforces deployment limits, calculates costs, and handles recalls.
type DeploymentManager struct {
	mu sync.RWMutex

	config DeploymentConfig

	// All deployed agents: agentID → DeployedAgent
	agents map[string]*DeployedAgent

	// Index: userID → list of agent IDs
	userAgents map[string][]string

	// Index: countryISO → list of agent IDs
	countryAgents map[string][]string

	// Reference to WorldManager for country lookups
	worldManager *WorldManager

	// Next agent ID counter
	nextAgentID int64
}

// NewDeploymentManager creates a new deployment manager.
func NewDeploymentManager(cfg DeploymentConfig, wm *WorldManager) *DeploymentManager {
	return &DeploymentManager{
		config:        cfg,
		agents:        make(map[string]*DeployedAgent),
		userAgents:    make(map[string][]string),
		countryAgents: make(map[string][]string),
		worldManager:  wm,
		nextAgentID:   1,
	}
}

// Deploy deploys an agent to a country.
func (dm *DeploymentManager) Deploy(req DeployRequest) (*DeployResponse, error) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	// 1. Validate country exists
	if dm.worldManager != nil {
		if cs := dm.worldManager.GetCountry(req.CountryISO); cs == nil {
			return nil, fmt.Errorf("country %s not found", req.CountryISO)
		}
	}

	// 2. Check user deployment limit (max 3 countries simultaneously)
	activeCountries := dm.getActiveCountriesForUserLocked(req.UserID)
	if len(activeCountries) >= dm.config.MaxDeploymentsPerUser {
		// Check if already deployed to this country
		alreadyDeployed := false
		for _, iso := range activeCountries {
			if iso == req.CountryISO {
				alreadyDeployed = true
				break
			}
		}
		if !alreadyDeployed {
			return nil, fmt.Errorf("max deployments (%d) reached; recall an agent first",
				dm.config.MaxDeploymentsPerUser)
		}
	}

	// 3. Calculate deployment cost
	cost := dm.calculateDeployCost(req.OriginISO, req.CountryISO)

	// 4. Create agent
	agentID := fmt.Sprintf("agent_%s_%d", req.UserID, dm.nextAgentID)
	dm.nextAgentID++

	agent := &DeployedAgent{
		AgentID:      agentID,
		UserID:       req.UserID,
		FactionID:    req.FactionID,
		CountryISO:   req.CountryISO,
		Name:         req.AgentName,
		SkinID:       req.SkinID,
		Status:       "deploying",
		DeployedAt:   time.Now(),
		DeployCost:   cost,
		AutoRedeploy: req.AutoRedeploy,
	}

	dm.agents[agentID] = agent
	dm.userAgents[req.UserID] = append(dm.userAgents[req.UserID], agentID)
	dm.countryAgents[req.CountryISO] = append(dm.countryAgents[req.CountryISO], agentID)

	// Mark as active after a brief delay (simulating deployment travel)
	agent.Status = "active"

	slog.Info("agent deployed",
		"agentId", agentID,
		"userId", req.UserID,
		"faction", req.FactionID,
		"country", req.CountryISO,
		"cost", cost,
	)

	return &DeployResponse{
		AgentID:    agentID,
		CountryISO: req.CountryISO,
		Cost:       cost,
		Status:     "active",
	}, nil
}

// Recall recalls an agent from their deployed country.
func (dm *DeploymentManager) Recall(req RecallRequest) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	agent, ok := dm.agents[req.AgentID]
	if !ok {
		return fmt.Errorf("agent %s not found", req.AgentID)
	}

	if agent.UserID != req.UserID {
		return fmt.Errorf("agent %s does not belong to user %s", req.AgentID, req.UserID)
	}

	if agent.Status == "recalled" {
		return fmt.Errorf("agent %s already recalled", req.AgentID)
	}

	agent.Status = "recalled"
	agent.RecalledAt = time.Now()

	// Remove from country index
	dm.removeFromCountryIndexLocked(agent.CountryISO, req.AgentID)

	slog.Info("agent recalled",
		"agentId", req.AgentID,
		"userId", req.UserID,
		"country", agent.CountryISO,
	)

	return nil
}

// HandleAgentDeath processes an agent death event.
// If auto-redeploy is enabled, the agent is requeued for the same country.
func (dm *DeploymentManager) HandleAgentDeath(agentID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	agent, ok := dm.agents[agentID]
	if !ok {
		return
	}

	agent.Status = "dead"
	agent.Deaths++

	if agent.AutoRedeploy && dm.config.AutoRedeployEnabled {
		// Schedule auto-redeploy after cooldown
		go func() {
			time.Sleep(time.Duration(dm.config.RecallCooldownSec) * time.Second)
			dm.autoRedeploy(agentID)
		}()
	}
}

// autoRedeploy re-activates a dead agent in the same country.
func (dm *DeploymentManager) autoRedeploy(agentID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	agent, ok := dm.agents[agentID]
	if !ok || agent.Status != "dead" {
		return
	}

	agent.Status = "active"
	agent.DeployedAt = time.Now()

	slog.Info("agent auto-redeployed",
		"agentId", agentID,
		"country", agent.CountryISO,
	)
}

// --- Queries ---

// GetAgent returns a deployed agent by ID.
func (dm *DeploymentManager) GetAgent(agentID string) *DeployedAgent {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	agent, ok := dm.agents[agentID]
	if !ok {
		return nil
	}
	copy := *agent
	return &copy
}

// GetUserAgents returns all agents for a user.
func (dm *DeploymentManager) GetUserAgents(userID string) []DeployedAgent {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	ids := dm.userAgents[userID]
	result := make([]DeployedAgent, 0, len(ids))
	for _, id := range ids {
		if agent, ok := dm.agents[id]; ok {
			result = append(result, *agent)
		}
	}
	return result
}

// GetActiveUserAgents returns only active agents for a user.
func (dm *DeploymentManager) GetActiveUserAgents(userID string) []DeployedAgent {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	ids := dm.userAgents[userID]
	var result []DeployedAgent
	for _, id := range ids {
		if agent, ok := dm.agents[id]; ok && agent.Status == "active" {
			result = append(result, *agent)
		}
	}
	return result
}

// GetCountryAgents returns all agents deployed to a country.
func (dm *DeploymentManager) GetCountryAgents(countryISO string) []DeployedAgent {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	ids := dm.countryAgents[countryISO]
	result := make([]DeployedAgent, 0, len(ids))
	for _, id := range ids {
		if agent, ok := dm.agents[id]; ok {
			result = append(result, *agent)
		}
	}
	return result
}

// GetActiveCountryAgentCount returns the number of active agents in a country.
func (dm *DeploymentManager) GetActiveCountryAgentCount(countryISO string) int {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	count := 0
	for _, id := range dm.countryAgents[countryISO] {
		if agent, ok := dm.agents[id]; ok && agent.Status == "active" {
			count++
		}
	}
	return count
}

// GetUserDeploymentCount returns the number of distinct countries a user has active agents in.
func (dm *DeploymentManager) GetUserDeploymentCount(userID string) int {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return len(dm.getActiveCountriesForUserLocked(userID))
}

// --- Cost calculation ---

// calculateDeployCost computes the oil cost to deploy based on distance.
func (dm *DeploymentManager) calculateDeployCost(originISO, targetISO string) int64 {
	baseCost := dm.config.BaseDeployCostOil

	if originISO == "" || originISO == targetISO || dm.worldManager == nil {
		return baseCost
	}

	origin := dm.worldManager.GetCountry(originISO)
	target := dm.worldManager.GetCountry(targetISO)
	if origin == nil || target == nil {
		return baseCost
	}

	// Calculate great circle distance (simplified)
	dist := haversineDistance(origin.Latitude, origin.Longitude, target.Latitude, target.Longitude)

	// Distance cost: base + (distance/1000) * multiplier
	distanceCost := int64(dist / 1000.0 * dm.config.DistanceCostMultiplier)

	return baseCost + distanceCost
}

// GetDeployCost returns the estimated cost without actually deploying.
func (dm *DeploymentManager) GetDeployCost(originISO, targetISO string) int64 {
	return dm.calculateDeployCost(originISO, targetISO)
}

// --- Internal helpers ---

// getActiveCountriesForUserLocked returns the set of countries where user has active agents.
// Caller must hold dm.mu read or write lock.
func (dm *DeploymentManager) getActiveCountriesForUserLocked(userID string) []string {
	ids := dm.userAgents[userID]
	countrySet := make(map[string]bool)
	for _, id := range ids {
		if agent, ok := dm.agents[id]; ok && agent.Status == "active" {
			countrySet[agent.CountryISO] = true
		}
	}

	countries := make([]string, 0, len(countrySet))
	for iso := range countrySet {
		countries = append(countries, iso)
	}
	return countries
}

// removeFromCountryIndexLocked removes an agent from the country index.
func (dm *DeploymentManager) removeFromCountryIndexLocked(countryISO, agentID string) {
	agents := dm.countryAgents[countryISO]
	for i, id := range agents {
		if id == agentID {
			dm.countryAgents[countryISO] = append(agents[:i], agents[i+1:]...)
			return
		}
	}
}

// haversineDistance calculates the great-circle distance between two points (km).
func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0

	dLat := degreesToRadians(lat2 - lat1)
	dLon := degreesToRadians(lon2 - lon1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(degreesToRadians(lat1))*math.Cos(degreesToRadians(lat2))*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

// degreesToRadians converts degrees to radians.
func degreesToRadians(deg float64) float64 {
	return deg * math.Pi / 180.0
}
