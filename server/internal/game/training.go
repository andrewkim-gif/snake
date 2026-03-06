package game

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
)

// ============================================================
// Agent Training System (S49)
// REST API for build profiles, combat rules, strategy phases
// ============================================================

// TrainingProfile is the complete training configuration for an agent.
type TrainingProfile struct {
	AgentID        string          `json:"agentId"`
	BuildProfile   BuildProfile    `json:"buildProfile"`
	CombatRules    []CombatRule    `json:"combatRules"`
	StrategyPhases StrategyPhases  `json:"strategyPhases"`
	Personality    string          `json:"personality,omitempty"` // preset personality (S49: 6 presets)
}

// BuildProfile defines the agent's upgrade preferences.
type BuildProfile struct {
	PrimaryPath       string            `json:"primaryPath"`       // build path ID
	FallbackPath      string            `json:"fallbackPath"`      // fallback build path ID
	FallbackCondition FallbackCondition `json:"fallbackCondition"` // when to switch
	BannedUpgrades    []string          `json:"bannedUpgrades"`    // upgrade type IDs to never pick
	AlwaysPick        []string          `json:"alwaysPick"`        // upgrade type IDs to always pick if available
	NeverPick         []string          `json:"neverPick"`         // additional never-pick list
}

// FallbackCondition defines when to switch from primary to fallback path.
type FallbackCondition struct {
	LevelBelow  int `json:"levelBelow,omitempty"`  // switch if level < this
	TimeElapsed int `json:"timeElapsed,omitempty"` // switch if elapsed seconds > this
}

// CombatRule defines a conditional combat behavior rule.
type CombatRule struct {
	Condition string `json:"condition"` // e.g., "mass_ratio > 2.0", "time_remaining < 60"
	Action    string `json:"action"`    // e.g., "engage", "flee", "go_center", "no_boost"
}

// StrategyPhases defines combat style per game phase.
type StrategyPhases struct {
	Early string `json:"early"` // combat style for 0-2min
	Mid   string `json:"mid"`   // combat style for 2-4min
	Late  string `json:"late"`  // combat style for 4-5min
}

// ============================================================
// Personality Presets (6 types)
// ============================================================

// PersonalityPreset maps personality name to default training profile.
var PersonalityPresets = map[string]TrainingProfile{
	"warrior": {
		Personality: "warrior",
		BuildProfile: BuildProfile{
			PrimaryPath: "berserker",
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio > 1.5", Action: "engage"},
			{Condition: "mass_ratio < 0.3", Action: "flee"},
		},
		StrategyPhases: StrategyPhases{
			Early: "aggressive",
			Mid:   "aggressive",
			Late:  "aggressive",
		},
	},
	"guardian": {
		Personality: "guardian",
		BuildProfile: BuildProfile{
			PrimaryPath: "tank",
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio < 0.5", Action: "flee"},
			{Condition: "time_remaining < 60", Action: "go_center"},
			{Condition: "mass < 20", Action: "no_boost"},
		},
		StrategyPhases: StrategyPhases{
			Early: "defensive",
			Mid:   "defensive",
			Late:  "endgame",
		},
	},
	"scholar": {
		Personality: "scholar",
		BuildProfile: BuildProfile{
			PrimaryPath:  "scholar",
			FallbackPath: "tank",
			FallbackCondition: FallbackCondition{
				LevelBelow:  5,
				TimeElapsed: 120,
			},
			BannedUpgrades: []string{"cursed"},
			AlwaysPick:     []string{"xp"},
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio > 2.0", Action: "engage"},
			{Condition: "mass_ratio < 0.5", Action: "flee"},
			{Condition: "time_remaining < 60", Action: "go_center"},
		},
		StrategyPhases: StrategyPhases{
			Early: "xp_rush",
			Mid:   "balanced",
			Late:  "endgame",
		},
	},
	"runner": {
		Personality: "runner",
		BuildProfile: BuildProfile{
			PrimaryPath: "speedster",
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio < 0.8", Action: "flee"},
		},
		StrategyPhases: StrategyPhases{
			Early: "xp_rush",
			Mid:   "xp_rush",
			Late:  "balanced",
		},
	},
	"experimenter": {
		Personality: "experimenter",
		BuildProfile: BuildProfile{
			PrimaryPath: "", // random each round
		},
		StrategyPhases: StrategyPhases{
			Early: "balanced",
			Mid:   "balanced",
			Late:  "balanced",
		},
	},
	"adaptive": {
		Personality: "adaptive",
		BuildProfile: BuildProfile{
			PrimaryPath: "", // determined by memory analysis
		},
		StrategyPhases: StrategyPhases{
			Early: "balanced",
			Mid:   "balanced",
			Late:  "balanced",
		},
	},
}

// GetPersonalityPreset returns a training profile preset by personality name.
func GetPersonalityPreset(name string) (*TrainingProfile, bool) {
	preset, ok := PersonalityPresets[name]
	if !ok {
		return nil, false
	}
	copy := preset
	return &copy, true
}

// ============================================================
// Training Store — In-memory + JSON file persistence
// ============================================================

// TrainingStore manages training profiles for all agents.
type TrainingStore struct {
	mu       sync.RWMutex
	profiles map[string]*TrainingProfile // agentID -> profile
	dataDir  string                      // directory for JSON persistence
}

// NewTrainingStore creates a new training store with the given data directory.
func NewTrainingStore(dataDir string) *TrainingStore {
	ts := &TrainingStore{
		profiles: make(map[string]*TrainingProfile),
		dataDir:  dataDir,
	}
	// Ensure data directory exists
	if dataDir != "" {
		os.MkdirAll(filepath.Join(dataDir, "agents"), 0755)
	}
	return ts
}

// GetProfile returns the training profile for an agent.
func (ts *TrainingStore) GetProfile(agentID string) (*TrainingProfile, bool) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	profile, ok := ts.profiles[agentID]
	if !ok {
		// Try loading from disk
		ts.mu.RUnlock()
		loaded := ts.loadFromDisk(agentID)
		ts.mu.RLock()
		if loaded != nil {
			return loaded, true
		}
		return nil, false
	}
	return profile, true
}

// SetProfile saves a training profile for an agent.
func (ts *TrainingStore) SetProfile(agentID string, profile *TrainingProfile) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	profile.AgentID = agentID
	ts.profiles[agentID] = profile

	// Persist to disk asynchronously
	go ts.saveToDisk(agentID, profile)

	slog.Info("training profile saved",
		"agentId", agentID,
		"primaryPath", profile.BuildProfile.PrimaryPath,
		"personality", profile.Personality,
	)

	return nil
}

// DeleteProfile removes a training profile.
func (ts *TrainingStore) DeleteProfile(agentID string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	delete(ts.profiles, agentID)

	// Delete from disk
	if ts.dataDir != "" {
		path := ts.profilePath(agentID)
		os.Remove(path)
	}
}

// ListProfiles returns all agent IDs with profiles.
func (ts *TrainingStore) ListProfiles() []string {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	ids := make([]string, 0, len(ts.profiles))
	for id := range ts.profiles {
		ids = append(ids, id)
	}
	return ids
}

// --- Persistence helpers ---

func (ts *TrainingStore) profilePath(agentID string) string {
	return filepath.Join(ts.dataDir, "agents", agentID+"_training.json")
}

func (ts *TrainingStore) saveToDisk(agentID string, profile *TrainingProfile) {
	if ts.dataDir == "" {
		return
	}

	path := ts.profilePath(agentID)
	data, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		slog.Error("failed to marshal training profile", "agentId", agentID, "error", err)
		return
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		slog.Error("failed to write training profile", "agentId", agentID, "error", err)
	}
}

func (ts *TrainingStore) loadFromDisk(agentID string) *TrainingProfile {
	if ts.dataDir == "" {
		return nil
	}

	path := ts.profilePath(agentID)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil // file not found
	}

	var profile TrainingProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		slog.Error("failed to parse training profile", "agentId", agentID, "error", err)
		return nil
	}

	// Cache in memory
	ts.mu.Lock()
	ts.profiles[agentID] = &profile
	ts.mu.Unlock()

	return &profile
}

// ============================================================
// Training API Request/Response types (for router.go handlers)
// ============================================================

// SetTrainingRequest is the PUT /api/agent/:id/training request body.
type SetTrainingRequest struct {
	BuildProfile   *BuildProfile   `json:"buildProfile,omitempty"`
	CombatRules    []CombatRule    `json:"combatRules,omitempty"`
	StrategyPhases *StrategyPhases `json:"strategyPhases,omitempty"`
	Personality    string          `json:"personality,omitempty"`
}

// Validate checks the training request for basic validity.
func (r *SetTrainingRequest) Validate() error {
	if r.BuildProfile != nil {
		if r.BuildProfile.PrimaryPath != "" {
			if GetBuildPath(r.BuildProfile.PrimaryPath) == nil {
				return fmt.Errorf("unknown build path: %s", r.BuildProfile.PrimaryPath)
			}
		}
		if r.BuildProfile.FallbackPath != "" {
			if GetBuildPath(r.BuildProfile.FallbackPath) == nil {
				return fmt.Errorf("unknown fallback build path: %s", r.BuildProfile.FallbackPath)
			}
		}
	}

	if r.Personality != "" {
		if _, ok := PersonalityPresets[r.Personality]; !ok {
			return fmt.Errorf("unknown personality preset: %s", r.Personality)
		}
	}

	if r.StrategyPhases != nil {
		validStyles := map[string]bool{
			"aggressive": true, "defensive": true, "balanced": true,
			"xp_rush": true, "endgame": true, "": true,
		}
		if !validStyles[r.StrategyPhases.Early] {
			return fmt.Errorf("unknown strategy style: %s", r.StrategyPhases.Early)
		}
		if !validStyles[r.StrategyPhases.Mid] {
			return fmt.Errorf("unknown strategy style: %s", r.StrategyPhases.Mid)
		}
		if !validStyles[r.StrategyPhases.Late] {
			return fmt.Errorf("unknown strategy style: %s", r.StrategyPhases.Late)
		}
	}

	return nil
}

// ApplyToProfile merges the request into an existing or new training profile.
func (r *SetTrainingRequest) ApplyToProfile(agentID string, existing *TrainingProfile) *TrainingProfile {
	profile := existing
	if profile == nil {
		profile = &TrainingProfile{AgentID: agentID}
	}

	// If personality is set, start from the preset
	if r.Personality != "" {
		if preset, ok := GetPersonalityPreset(r.Personality); ok {
			profile = preset
			profile.AgentID = agentID
		}
	}

	// Override with specific fields
	if r.BuildProfile != nil {
		profile.BuildProfile = *r.BuildProfile
	}
	if r.CombatRules != nil {
		profile.CombatRules = r.CombatRules
	}
	if r.StrategyPhases != nil {
		profile.StrategyPhases = *r.StrategyPhases
	}
	if r.Personality != "" {
		profile.Personality = r.Personality
	}

	return profile
}
