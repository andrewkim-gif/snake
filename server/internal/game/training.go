package game

import (
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ─── Training Configuration ───

// CombatRule defines a conditional combat behavior.
type CombatRule struct {
	Condition string `json:"condition"` // e.g. "hp_below_30", "enemy_weaker", "outnumbered"
	Action    string `json:"action"`    // e.g. "flee", "engage", "kite"
}

// StrategyPhase defines behavior for a game phase.
type StrategyPhase struct {
	Phase    string `json:"phase"`    // early/mid/late
	Strategy string `json:"strategy"` // gather/fight/farm/kite/camp
}

// TrainingConfig holds the full agent training configuration.
type TrainingConfig struct {
	BuildPath       string          `json:"buildPath"`       // preset name
	CombatStyle     string          `json:"combatStyle"`     // aggressive/defensive/balanced
	StrategyPhases  []StrategyPhase `json:"strategyPhases"`
	CombatRules     []CombatRule    `json:"combatRules,omitempty"`
	CustomBuildPath *BuildPath      `json:"customBuildPath,omitempty"` // only when buildPath="custom"
	UpdatedAt       int64           `json:"updatedAt"`
}

// DefaultTrainingConfig returns a sensible default training configuration.
func DefaultTrainingConfig() TrainingConfig {
	return TrainingConfig{
		BuildPath:   "balanced",
		CombatStyle: "balanced",
		StrategyPhases: []StrategyPhase{
			{Phase: "early", Strategy: "gather"},
			{Phase: "mid", Strategy: "farm"},
			{Phase: "late", Strategy: "fight"},
		},
		CombatRules: []CombatRule{
			{Condition: "hp_below_30", Action: "flee"},
			{Condition: "enemy_weaker", Action: "engage"},
			{Condition: "outnumbered", Action: "kite"},
		},
		UpdatedAt: time.Now().UnixMilli(),
	}
}

// ─── Round Results / Learning Data ───

// RoundResult records what happened in a single round.
type RoundResult struct {
	Timestamp            int64    `json:"timestamp"`
	BuildPath            string   `json:"buildPath"`
	FinalLevel           int      `json:"finalLevel"`
	Tomes                map[string]int `json:"tomes"`
	Abilities            []string `json:"abilities"`
	Synergies            []string `json:"synergies"`
	Kills                int      `json:"kills"`
	DeathCause           string   `json:"deathCause"`
	SurvivalTimeSec      float64  `json:"survivalTimeSec"`
	Rank                 int      `json:"rank"`
	Score                int      `json:"score"`
}

// LearningMetrics aggregates stats across recent rounds.
type LearningMetrics struct {
	TotalRounds          int     `json:"totalRounds"`
	AvgSurvivalTime      float64 `json:"avgSurvivalTime"`
	AvgLevel             float64 `json:"avgLevel"`
	AvgKills             float64 `json:"avgKills"`
	AvgRank              float64 `json:"avgRank"`
	AvgScore             float64 `json:"avgScore"`
	BuildWinRate         float64 `json:"buildWinRate"` // % of rounds ranked #1
	SynergyActivationRate float64 `json:"synergyActivationRate"` // % of rounds with at least 1 synergy
}

// ─── Training Store ───

// TrainingStore manages training configs and round results in memory + JSON file backup.
type TrainingStore struct {
	configs  map[string]*TrainingConfig // agentID -> config
	history  map[string][]RoundResult   // agentID -> round results
	dataDir  string
	mu       sync.RWMutex
}

// NewTrainingStore creates a new training store with file-backed persistence.
func NewTrainingStore(dataDir string) *TrainingStore {
	ts := &TrainingStore{
		configs: make(map[string]*TrainingConfig),
		history: make(map[string][]RoundResult),
		dataDir: dataDir,
	}

	// Ensure data directory exists
	_ = os.MkdirAll(dataDir, 0o755)

	// Load existing data
	ts.loadFromDisk()

	return ts
}

// GetConfig returns the training config for an agent. Returns default if not found.
func (ts *TrainingStore) GetConfig(agentID string) TrainingConfig {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	if cfg, ok := ts.configs[agentID]; ok {
		return *cfg
	}
	return DefaultTrainingConfig()
}

// SetConfig updates the training config for an agent.
func (ts *TrainingStore) SetConfig(agentID string, cfg TrainingConfig) {
	ts.mu.Lock()
	cfg.UpdatedAt = time.Now().UnixMilli()
	ts.configs[agentID] = &cfg
	ts.mu.Unlock()

	ts.saveToDisk()
}

// GetHistory returns the last N round results for an agent.
func (ts *TrainingStore) GetHistory(agentID string, limit int) []RoundResult {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	results, ok := ts.history[agentID]
	if !ok {
		return []RoundResult{}
	}

	if limit > 0 && limit < len(results) {
		return results[len(results)-limit:]
	}
	return results
}

// AddRoundResult appends a round result and trims to last 50 entries.
func (ts *TrainingStore) AddRoundResult(agentID string, result RoundResult) {
	ts.mu.Lock()
	ts.history[agentID] = append(ts.history[agentID], result)
	// Keep last 50
	if len(ts.history[agentID]) > 50 {
		ts.history[agentID] = ts.history[agentID][len(ts.history[agentID])-50:]
	}
	ts.mu.Unlock()

	ts.saveToDisk()
}

// GetMetrics computes learning metrics from round history.
func (ts *TrainingStore) GetMetrics(agentID string) LearningMetrics {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	results := ts.history[agentID]
	if len(results) == 0 {
		return LearningMetrics{}
	}

	metrics := LearningMetrics{
		TotalRounds: len(results),
	}

	totalSurvival := 0.0
	totalLevel := 0
	totalKills := 0
	totalRank := 0
	totalScore := 0
	wins := 0
	synergized := 0

	for _, r := range results {
		totalSurvival += r.SurvivalTimeSec
		totalLevel += r.FinalLevel
		totalKills += r.Kills
		totalRank += r.Rank
		totalScore += r.Score
		if r.Rank == 1 {
			wins++
		}
		if len(r.Synergies) > 0 {
			synergized++
		}
	}

	n := float64(len(results))
	metrics.AvgSurvivalTime = math.Round(totalSurvival/n*10) / 10
	metrics.AvgLevel = math.Round(float64(totalLevel)/n*10) / 10
	metrics.AvgKills = math.Round(float64(totalKills)/n*10) / 10
	metrics.AvgRank = math.Round(float64(totalRank)/n*10) / 10
	metrics.AvgScore = math.Round(float64(totalScore)/n*10) / 10
	metrics.BuildWinRate = math.Round(float64(wins)/n*1000) / 10 // percentage
	metrics.SynergyActivationRate = math.Round(float64(synergized)/n*1000) / 10

	return metrics
}

// ─── Persistence ───

type persistedData struct {
	Configs map[string]*TrainingConfig `json:"configs"`
	History map[string][]RoundResult   `json:"history"`
}

func (ts *TrainingStore) saveToDisk() {
	ts.mu.RLock()
	data := persistedData{
		Configs: ts.configs,
		History: ts.history,
	}
	ts.mu.RUnlock()

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		slog.Error("training store: marshal error", "error", err)
		return
	}

	path := filepath.Join(ts.dataDir, "training_data.json")
	if err := os.WriteFile(path, bytes, 0o644); err != nil {
		slog.Error("training store: write error", "error", err, "path", path)
	}
}

func (ts *TrainingStore) loadFromDisk() {
	path := filepath.Join(ts.dataDir, "training_data.json")
	bytes, err := os.ReadFile(path)
	if err != nil {
		// File doesn't exist yet — that's fine
		return
	}

	var data persistedData
	if err := json.Unmarshal(bytes, &data); err != nil {
		slog.Error("training store: unmarshal error", "error", err)
		return
	}

	if data.Configs != nil {
		ts.configs = data.Configs
	}
	if data.History != nil {
		ts.history = data.History
	}

	slog.Info("training store loaded from disk",
		"configs", len(ts.configs),
		"agents_with_history", len(ts.history),
	)
}

// ─── HTTP Handlers ───

// TrainingAPI provides HTTP endpoints for training configuration.
type TrainingAPI struct {
	store *TrainingStore
}

// NewTrainingAPI creates a new TrainingAPI.
func NewTrainingAPI(store *TrainingStore) *TrainingAPI {
	return &TrainingAPI{store: store}
}

// HandleGetConfig handles GET /api/training?agentId=X.
func (t *TrainingAPI) HandleGetConfig(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agentId")
	if agentID == "" {
		agentID = "default"
	}

	cfg := t.store.GetConfig(agentID)
	writeJSON(w, http.StatusOK, cfg)
}

// HandleSetConfig handles PUT /api/training.
func (t *TrainingAPI) HandleSetConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		AgentID string         `json:"agentId"`
		Config  TrainingConfig `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
		return
	}

	if req.AgentID == "" {
		req.AgentID = "default"
	}

	// Validate build path
	validPaths := map[string]bool{
		"berserker": true, "fortress": true, "quicksilver": true,
		"collector": true, "balanced": true, "custom": true,
	}
	if !validPaths[req.Config.BuildPath] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid buildPath"})
		return
	}

	// Validate combat style
	validStyles := map[string]bool{"aggressive": true, "defensive": true, "balanced": true}
	if !validStyles[req.Config.CombatStyle] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid combatStyle"})
		return
	}

	t.store.SetConfig(req.AgentID, req.Config)
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// HandleGetHistory handles GET /api/training/history?agentId=X.
func (t *TrainingAPI) HandleGetHistory(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agentId")
	if agentID == "" {
		agentID = "default"
	}

	history := t.store.GetHistory(agentID, 10)
	writeJSON(w, http.StatusOK, history)
}

// HandleGetMetrics handles GET /api/training/metrics?agentId=X.
func (t *TrainingAPI) HandleGetMetrics(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agentId")
	if agentID == "" {
		agentID = "default"
	}

	metrics := t.store.GetMetrics(agentID)
	writeJSON(w, http.StatusOK, metrics)
}
