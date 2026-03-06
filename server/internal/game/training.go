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
// Personality Presets (6 types) — v10 S56 Enhanced
// Maps: Aggro, Cautious, Scholar, Gambler, Balanced, Adaptive
// Each personality defines build path, combat style, and risk tolerance.
// ============================================================

// PersonalityType identifies a personality preset name.
type PersonalityType string

const (
	PersonalityAggro    PersonalityType = "aggro"
	PersonalityCautious PersonalityType = "cautious"
	PersonalityScholar  PersonalityType = "scholar"
	PersonalityGambler  PersonalityType = "gambler"
	PersonalityBalanced PersonalityType = "balanced"
	PersonalityAdaptive PersonalityType = "adaptive"
)

// PersonalityMeta holds personality metadata for display.
type PersonalityMeta struct {
	Type          PersonalityType `json:"type"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	RiskTolerance float64         `json:"riskTolerance"` // 0.0 (safe) to 1.0 (risky)
	Playstyle     string          `json:"playstyle"`     // short description
}

// AllPersonalityMeta provides display info for all personalities.
var AllPersonalityMeta = []PersonalityMeta{
	{Type: PersonalityAggro, Name: "Aggro", Description: "Maximum aggression. Hunt everything, never back down.", RiskTolerance: 0.9, Playstyle: "All-in combat"},
	{Type: PersonalityCautious, Name: "Cautious", Description: "Careful and defensive. Survive first, fight second.", RiskTolerance: 0.2, Playstyle: "Safe farming"},
	{Type: PersonalityScholar, Name: "Scholar", Description: "Knowledge is power. Rush XP, outscale opponents.", RiskTolerance: 0.3, Playstyle: "XP farming"},
	{Type: PersonalityGambler, Name: "Gambler", Description: "High risk, high reward. Cursed builds and risky plays.", RiskTolerance: 1.0, Playstyle: "Glass cannon"},
	{Type: PersonalityBalanced, Name: "Balanced", Description: "Adapt to the situation. No extreme commitment.", RiskTolerance: 0.5, Playstyle: "Flexible"},
	{Type: PersonalityAdaptive, Name: "Adaptive", Description: "Learns from past rounds. Adjusts strategy automatically.", RiskTolerance: 0.5, Playstyle: "Self-improving"},
}

// PersonalityPreset maps personality name to default training profile.
var PersonalityPresets = map[string]TrainingProfile{
	// Aggro (공격적): Berserker build, always engages, high risk
	"aggro": {
		Personality: "aggro",
		BuildProfile: BuildProfile{
			PrimaryPath:  "berserker",
			FallbackPath: "vampire",
			FallbackCondition: FallbackCondition{
				TimeElapsed: 180, // switch at 3min if behind
			},
			AlwaysPick: []string{"damage", "cursed", "venom_aura"},
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio > 0.7", Action: "engage"},
			{Condition: "mass_ratio < 0.3", Action: "flee"},
			{Condition: "kill_streak >= 3", Action: "engage"},
			{Condition: "time_remaining < 30", Action: "engage"},
		},
		StrategyPhases: StrategyPhases{
			Early: "aggressive",
			Mid:   "aggressive",
			Late:  "aggressive",
		},
	},
	// Cautious (신중): Tank build, avoids combat, farms safely
	"cautious": {
		Personality: "cautious",
		BuildProfile: BuildProfile{
			PrimaryPath:  "tank",
			FallbackPath: "scholar",
			FallbackCondition: FallbackCondition{
				LevelBelow:  4,
				TimeElapsed: 120,
			},
			BannedUpgrades: []string{"cursed"},
			AlwaysPick:     []string{"armor", "regen", "shield_burst"},
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio < 0.5", Action: "flee"},
			{Condition: "mass_ratio > 2.5", Action: "engage"},
			{Condition: "time_remaining < 60", Action: "go_center"},
			{Condition: "mass < 20", Action: "no_boost"},
			{Condition: "zone == danger", Action: "go_center"},
		},
		StrategyPhases: StrategyPhases{
			Early: "defensive",
			Mid:   "defensive",
			Late:  "endgame",
		},
	},
	// Scholar (학구적): XP rush, outscale, late-game dominance
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
			AlwaysPick:     []string{"xp", "luck", "magnet"},
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio > 2.0", Action: "engage"},
			{Condition: "mass_ratio < 0.5", Action: "flee"},
			{Condition: "time_remaining < 60", Action: "go_center"},
			{Condition: "level > 8", Action: "engage"},
		},
		StrategyPhases: StrategyPhases{
			Early: "xp_rush",
			Mid:   "balanced",
			Late:  "endgame",
		},
	},
	// Gambler (도박): High risk builds, cursed tome stacking
	"gambler": {
		Personality: "gambler",
		BuildProfile: BuildProfile{
			PrimaryPath:  "berserker",
			FallbackPath: "speedster",
			FallbackCondition: FallbackCondition{
				TimeElapsed: 240, // late fallback
			},
			AlwaysPick: []string{"cursed", "damage", "speed"},
			NeverPick:  []string{"armor", "regen"},
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio > 0.5", Action: "engage"},
			{Condition: "mass_ratio < 0.2", Action: "flee"},
			{Condition: "kill_streak >= 2", Action: "engage"},
		},
		StrategyPhases: StrategyPhases{
			Early: "aggressive",
			Mid:   "aggressive",
			Late:  "aggressive",
		},
	},
	// Balanced (균형): Adapts per phase, no extremes
	"balanced": {
		Personality: "balanced",
		BuildProfile: BuildProfile{
			PrimaryPath:  "vampire",
			FallbackPath: "tank",
			FallbackCondition: FallbackCondition{
				LevelBelow:  4,
				TimeElapsed: 150,
			},
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio > 1.5", Action: "engage"},
			{Condition: "mass_ratio < 0.4", Action: "flee"},
			{Condition: "time_remaining < 60", Action: "go_center"},
		},
		StrategyPhases: StrategyPhases{
			Early: "balanced",
			Mid:   "balanced",
			Late:  "endgame",
		},
	},
	// Adaptive (적응): Adjusts based on previous round results
	"adaptive": {
		Personality: "adaptive",
		BuildProfile: BuildProfile{
			PrimaryPath: "", // determined at runtime by memory analysis
		},
		StrategyPhases: StrategyPhases{
			Early: "balanced",
			Mid:   "balanced",
			Late:  "balanced",
		},
	},

	// --- Legacy aliases (backward compat with existing v1 presets) ---
	"warrior": {
		Personality: "aggro",
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
		Personality: "cautious",
		BuildProfile: BuildProfile{
			PrimaryPath: "tank",
		},
		CombatRules: []CombatRule{
			{Condition: "mass_ratio < 0.5", Action: "flee"},
			{Condition: "time_remaining < 60", Action: "go_center"},
		},
		StrategyPhases: StrategyPhases{
			Early: "defensive",
			Mid:   "defensive",
			Late:  "endgame",
		},
	},
	"runner": {
		Personality: "cautious",
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
		Personality: "gambler",
		BuildProfile: BuildProfile{
			PrimaryPath: "", // random each round
		},
		StrategyPhases: StrategyPhases{
			Early: "balanced",
			Mid:   "balanced",
			Late:  "balanced",
		},
	},
}

// AdaptiveSelectBuildPath selects a build path for the Adaptive personality
// based on previous round performance data from memory.
func AdaptiveSelectBuildPath(mem *AgentMemory) string {
	if mem == nil || len(mem.RoundHistory) == 0 {
		return "balanced" // default if no history
	}

	// Find the build hash with the best average rank
	bestPath := "balanced"
	bestRank := 999.0

	for hash, stats := range mem.BuildPerformance {
		if stats.SampleCount >= 3 && stats.AvgRank < bestRank {
			bestRank = stats.AvgRank
			bestPath = hash
		}
	}

	// If the last round was a loss (rank > 5), counter-pick
	lastRound := mem.RoundHistory[len(mem.RoundHistory)-1]
	if lastRound.Rank > 5 {
		// Switch to a counter strategy
		switch lastRound.DeathCause {
		case "aura":
			return "tank" // died from sustained damage → more armor
		case "dash":
			return "speedster" // died from burst → more speed/evasion
		case "boundary":
			return "speedster" // died from zone → more speed
		default:
			return "vampire" // balanced counter
		}
	}

	// Map build hash back to a known path if possible, otherwise use best
	for _, pathID := range AllBuildPathIDs() {
		if pathID == bestPath {
			return pathID
		}
	}

	return "balanced"
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
