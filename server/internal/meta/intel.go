package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// MissionType defines the types of intelligence missions.
type MissionType string

const (
	MissionScout        MissionType = "scout"
	MissionSabotage     MissionType = "sabotage"
	MissionCounterIntel MissionType = "counter_intel"
)

// MissionStatus represents the lifecycle of a mission.
type MissionStatus string

const (
	MissionPending   MissionStatus = "pending"
	MissionActive    MissionStatus = "active"
	MissionCompleted MissionStatus = "completed"
	MissionFailed    MissionStatus = "failed"
	MissionDetected  MissionStatus = "detected"
)

// MissionConfig defines costs, cooldowns, and probabilities for each mission type.
type MissionConfig struct {
	GoldCost        int64         `json:"gold_cost"`
	OilCost         int64         `json:"oil_cost"`
	TechCost        int64         `json:"tech_cost"`
	Cooldown        time.Duration `json:"cooldown"`
	BaseAccuracy    float64       `json:"base_accuracy"`    // 0.0-1.0
	DetectionChance float64       `json:"detection_chance"` // 0.0-1.0
	Duration        time.Duration `json:"duration"`         // effect duration
}

// DefaultMissionConfigs returns the default configuration for each mission type.
func DefaultMissionConfigs() map[MissionType]MissionConfig {
	return map[MissionType]MissionConfig{
		MissionScout: {
			GoldCost:        50,
			OilCost:         20,
			Cooldown:        1 * time.Hour,
			BaseAccuracy:    0.80,
			DetectionChance: 0.10,
		},
		MissionSabotage: {
			GoldCost:        200,
			OilCost:         50,
			Cooldown:        4 * time.Hour,
			BaseAccuracy:    0.70,
			DetectionChance: 0.30,
			Duration:        5 * time.Minute, // affects next battle
		},
		MissionCounterIntel: {
			TechCost: 100,
			Cooldown: 6 * time.Hour,
			Duration: 24 * time.Hour,
		},
	}
}

// IntelMission represents an intelligence mission instance.
type IntelMission struct {
	ID             string        `json:"id"`
	Type           MissionType   `json:"type"`
	Status         MissionStatus `json:"status"`
	FactionID      string        `json:"faction_id"`      // Initiating faction
	TargetCountry  string        `json:"target_country"`  // ISO3
	TargetFaction  string        `json:"target_faction"`  // Defending faction
	InitiatedBy    string        `json:"initiated_by"`    // User ID
	CreatedAt      time.Time     `json:"created_at"`
	CompletedAt    time.Time     `json:"completed_at,omitempty"`
	ExpiresAt      time.Time     `json:"expires_at,omitempty"`

	// Results (populated on completion)
	Success   bool              `json:"success"`
	Detected  bool              `json:"detected"`
	Report    *IntelReport      `json:"report,omitempty"`
	SabotageEffect *SabotageEffect `json:"sabotage_effect,omitempty"`
}

// IntelReport holds the result of a scout mission.
type IntelReport struct {
	TargetCountry    string  `json:"target_country"`
	AgentCount       int     `json:"agent_count"`        // May be inaccurate
	AverageLevel     float64 `json:"average_level"`      // May be inaccurate
	DefenseStrength  float64 `json:"defense_strength"`   // May be inaccurate
	SovereigntyLevel int     `json:"sovereignty_level"`
	FactionName      string  `json:"faction_name"`
	Accuracy         float64 `json:"accuracy"`           // How accurate the report is (0-1)
	NoiseApplied     bool    `json:"noise_applied"`
}

// SabotageEffect holds the result of a sabotage mission.
type SabotageEffect struct {
	TargetCountry    string    `json:"target_country"`
	DefenseReduction float64   `json:"defense_reduction"` // e.g. 0.15 = -15%
	ExpiresAt        time.Time `json:"expires_at"`
	Active           bool      `json:"active"`
}

// CounterIntelEffect tracks active counter-intelligence on a country.
type CounterIntelEffect struct {
	FactionID         string    `json:"faction_id"`
	CountryISO        string    `json:"country_iso"`
	DetectionBonus    float64   `json:"detection_bonus"` // +0.50 to detection chance
	ExpiresAt         time.Time `json:"expires_at"`
}

// IntelSystem manages all intelligence operations.
type IntelSystem struct {
	mu sync.RWMutex

	configs  map[MissionType]MissionConfig
	missions map[string]*IntelMission // missionID → mission

	// Active effects
	sabotageEffects   map[string]*SabotageEffect    // countryISO → effect
	counterIntelEffects map[string]*CounterIntelEffect // countryISO → effect

	// Cooldown tracking: factionID:missionType → last completed time
	cooldowns map[string]time.Time

	// External references
	factionManager *FactionManager
	techTreeManager *TechTreeManager

	rng *rand.Rand
}

// NewIntelSystem creates a new intelligence system.
func NewIntelSystem() *IntelSystem {
	return &IntelSystem{
		configs:           DefaultMissionConfigs(),
		missions:          make(map[string]*IntelMission),
		sabotageEffects:   make(map[string]*SabotageEffect),
		counterIntelEffects: make(map[string]*CounterIntelEffect),
		cooldowns:         make(map[string]time.Time),
		rng:               rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// SetFactionManager sets the faction manager reference.
func (is *IntelSystem) SetFactionManager(fm *FactionManager) {
	is.mu.Lock()
	defer is.mu.Unlock()
	is.factionManager = fm
}

// SetTechTreeManager sets the tech tree manager for bonus lookups.
func (is *IntelSystem) SetTechTreeManager(ttm *TechTreeManager) {
	is.mu.Lock()
	defer is.mu.Unlock()
	is.techTreeManager = ttm
}

// cooldownKey returns the cooldown tracking key.
func cooldownKey(factionID string, mtype MissionType) string {
	return factionID + ":" + string(mtype)
}

// LaunchMission initiates an intelligence mission.
func (is *IntelSystem) LaunchMission(factionID, userID, targetCountry, targetFaction string, mtype MissionType) (*IntelMission, error) {
	is.mu.Lock()
	defer is.mu.Unlock()

	cfg, ok := is.configs[mtype]
	if !ok {
		return nil, fmt.Errorf("unknown mission type: %s", mtype)
	}

	// Check cooldown
	cdKey := cooldownKey(factionID, mtype)
	if lastTime, exists := is.cooldowns[cdKey]; exists {
		remaining := cfg.Cooldown - time.Since(lastTime)
		if remaining > 0 {
			return nil, fmt.Errorf("mission on cooldown for %v", remaining.Round(time.Second))
		}
	}

	// Cannot spy on yourself
	if factionID == targetFaction && mtype != MissionCounterIntel {
		return nil, fmt.Errorf("cannot target your own faction")
	}

	// Deduct costs from faction treasury
	if is.factionManager != nil {
		cost := ResourceBundle{
			Gold: cfg.GoldCost,
			Oil:  cfg.OilCost,
			Tech: cfg.TechCost,
		}
		if err := is.factionManager.WithdrawFromTreasury(factionID, cost); err != nil {
			return nil, fmt.Errorf("insufficient resources: %w", err)
		}
	}

	mission := &IntelMission{
		ID:            uuid.New().String(),
		Type:          mtype,
		Status:        MissionCompleted, // Instant resolution for now
		FactionID:     factionID,
		TargetCountry: targetCountry,
		TargetFaction: targetFaction,
		InitiatedBy:   userID,
		CreatedAt:     time.Now(),
		CompletedAt:   time.Now(),
	}

	// Resolve mission
	is.resolveMission(mission, cfg)

	// Store mission and update cooldown
	is.missions[mission.ID] = mission
	is.cooldowns[cdKey] = time.Now()

	slog.Info("intel mission completed",
		"type", mtype,
		"faction", factionID,
		"target", targetCountry,
		"success", mission.Success,
		"detected", mission.Detected,
	)

	return mission, nil
}

// resolveMission determines the outcome of a mission.
// Must be called with write lock held.
func (is *IntelSystem) resolveMission(mission *IntelMission, cfg MissionConfig) {
	switch mission.Type {
	case MissionScout:
		is.resolveScout(mission, cfg)
	case MissionSabotage:
		is.resolveSabotage(mission, cfg)
	case MissionCounterIntel:
		is.resolveCounterIntel(mission, cfg)
	}
}

// resolveScout generates an intelligence report with noise.
func (is *IntelSystem) resolveScout(mission *IntelMission, cfg MissionConfig) {
	accuracy := cfg.BaseAccuracy

	// Apply tech bonus (Spy Network: +20% accuracy)
	if is.techTreeManager != nil {
		bonus := is.techTreeManager.GetFactionBonus(mission.FactionID, "intel_success_mult")
		accuracy += bonus
		if accuracy > 0.99 {
			accuracy = 0.99
		}
	}

	// Check counter-intel on target
	detectionChance := cfg.DetectionChance
	if ci, ok := is.counterIntelEffects[mission.TargetCountry]; ok && time.Now().Before(ci.ExpiresAt) {
		detectionChance += ci.DetectionBonus
		// Counter-intel also reduces accuracy
		accuracy -= 0.15
		if accuracy < 0.40 {
			accuracy = 0.40
		}
	}

	// Determine detection
	mission.Detected = is.rng.Float64() < detectionChance

	// Generate report with noise
	// Real values would come from WorldManager; here we generate plausible data
	realAgentCount := 10 + is.rng.Intn(30)
	realAvgLevel := 3.0 + is.rng.Float64()*7.0
	realDefense := 0.5 + is.rng.Float64()*0.5

	report := &IntelReport{
		TargetCountry:    mission.TargetCountry,
		SovereigntyLevel: 1 + is.rng.Intn(5),
		FactionName:      mission.TargetFaction,
		Accuracy:         accuracy,
	}

	// Apply noise based on accuracy
	if is.rng.Float64() > accuracy {
		// Inaccurate report — add noise
		noiseFactor := 0.5 + is.rng.Float64()*1.0 // 50%-150%
		report.AgentCount = int(float64(realAgentCount) * noiseFactor)
		report.AverageLevel = realAvgLevel * (0.7 + is.rng.Float64()*0.6)
		report.DefenseStrength = realDefense * (0.6 + is.rng.Float64()*0.8)
		report.NoiseApplied = true
	} else {
		report.AgentCount = realAgentCount
		report.AverageLevel = realAvgLevel
		report.DefenseStrength = realDefense
		report.NoiseApplied = false
	}

	mission.Success = true
	mission.Report = report
	mission.Status = MissionCompleted

	if mission.Detected {
		mission.Status = MissionDetected
	}
}

// resolveSabotage attempts to weaken target country defenses.
func (is *IntelSystem) resolveSabotage(mission *IntelMission, cfg MissionConfig) {
	successChance := 0.70

	// Apply tech bonus
	if is.techTreeManager != nil {
		bonus := is.techTreeManager.GetFactionBonus(mission.FactionID, "intel_success_mult")
		successChance += bonus
	}

	// Check counter-intel on target
	detectionChance := cfg.DetectionChance
	if ci, ok := is.counterIntelEffects[mission.TargetCountry]; ok && time.Now().Before(ci.ExpiresAt) {
		detectionChance += ci.DetectionBonus
		successChance -= 0.20
	}

	// Determine detection
	mission.Detected = is.rng.Float64() < detectionChance

	// Determine success
	mission.Success = is.rng.Float64() < successChance

	if mission.Success {
		effect := &SabotageEffect{
			TargetCountry:    mission.TargetCountry,
			DefenseReduction: 0.15, // -15% defense
			ExpiresAt:        time.Now().Add(cfg.Duration),
			Active:           true,
		}
		is.sabotageEffects[mission.TargetCountry] = effect
		mission.SabotageEffect = effect
		mission.Status = MissionCompleted
	} else {
		mission.Status = MissionFailed
	}

	if mission.Detected {
		mission.Status = MissionDetected
	}
}

// resolveCounterIntel activates counter-intelligence on the faction's countries.
func (is *IntelSystem) resolveCounterIntel(mission *IntelMission, cfg MissionConfig) {
	// Counter-intel targets the faction's own country
	effect := &CounterIntelEffect{
		FactionID:      mission.FactionID,
		CountryISO:     mission.TargetCountry,
		DetectionBonus: 0.50, // +50% detection chance
		ExpiresAt:      time.Now().Add(cfg.Duration),
	}

	is.counterIntelEffects[mission.TargetCountry] = effect

	mission.Success = true
	mission.Status = MissionCompleted
}

// GetSabotageDefenseReduction returns the active sabotage defense reduction for a country.
// Returns 0.0 if no active sabotage.
func (is *IntelSystem) GetSabotageDefenseReduction(countryISO string) float64 {
	is.mu.RLock()
	defer is.mu.RUnlock()

	effect, ok := is.sabotageEffects[countryISO]
	if !ok || !effect.Active || time.Now().After(effect.ExpiresAt) {
		return 0
	}
	return effect.DefenseReduction
}

// HasCounterIntel returns true if a country has active counter-intelligence.
func (is *IntelSystem) HasCounterIntel(countryISO string) bool {
	is.mu.RLock()
	defer is.mu.RUnlock()

	ci, ok := is.counterIntelEffects[countryISO]
	return ok && time.Now().Before(ci.ExpiresAt)
}

// GetFactionMissions returns all missions for a faction.
func (is *IntelSystem) GetFactionMissions(factionID string) []*IntelMission {
	is.mu.RLock()
	defer is.mu.RUnlock()

	var result []*IntelMission
	for _, m := range is.missions {
		if m.FactionID == factionID {
			result = append(result, m)
		}
	}
	return result
}

// CleanExpiredEffects removes expired sabotage and counter-intel effects.
func (is *IntelSystem) CleanExpiredEffects() {
	is.mu.Lock()
	defer is.mu.Unlock()

	now := time.Now()

	for iso, effect := range is.sabotageEffects {
		if now.After(effect.ExpiresAt) {
			delete(is.sabotageEffects, iso)
		}
	}

	for iso, effect := range is.counterIntelEffects {
		if now.After(effect.ExpiresAt) {
			delete(is.counterIntelEffects, iso)
		}
	}
}

// --- HTTP API ---

// IntelRoutes returns a chi.Router with intelligence endpoints.
func (is *IntelSystem) IntelRoutes(fm *FactionManager) chi.Router {
	r := chi.NewRouter()
	r.Use(auth.JWTAuth)

	r.Post("/mission", is.handleLaunchMission(fm))
	r.Get("/missions/{factionID}", is.handleGetMissions(fm))
	r.Get("/status/{countryISO}", is.handleGetCountryIntelStatus)

	return r
}

// LaunchMissionRequest is the HTTP request body for launching an intel mission.
type LaunchMissionRequest struct {
	Type          MissionType `json:"type"`
	TargetCountry string      `json:"target_country"`
	TargetFaction string      `json:"target_faction"`
}

func (is *IntelSystem) handleLaunchMission(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())
		if userID == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		factionID := fm.GetUserFaction(userID)
		if factionID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "you must be in a faction"})
			return
		}

		if !fm.HasPermission(factionID, userID, RoleCommander) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "requires Commander+ permission"})
			return
		}

		var req LaunchMissionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if req.TargetCountry == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "target_country required"})
			return
		}

		mission, err := is.LaunchMission(factionID, userID, req.TargetCountry, req.TargetFaction, req.Type)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"mission": mission,
		})
	}
}

func (is *IntelSystem) handleGetMissions(fm *FactionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		factionID := chi.URLParam(r, "factionID")
		missions := is.GetFactionMissions(factionID)
		if missions == nil {
			missions = []*IntelMission{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"missions": missions,
			"count":    len(missions),
		})
	}
}

func (is *IntelSystem) handleGetCountryIntelStatus(w http.ResponseWriter, r *http.Request) {
	countryISO := chi.URLParam(r, "countryISO")

	sabotageReduction := is.GetSabotageDefenseReduction(countryISO)
	hasCI := is.HasCounterIntel(countryISO)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"country_iso":        countryISO,
		"sabotage_active":    sabotageReduction > 0,
		"defense_reduction":  sabotageReduction,
		"counter_intel_active": hasCI,
	})
}
