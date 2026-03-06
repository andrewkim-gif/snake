package game

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ============================================================
// Agent Memory & Learning Data Storage (S50)
// Per-agent JSON file persistence for round results,
// opponent analysis, and synergy tracking.
// ============================================================

// AgentMemory is the complete learning data for an agent.
type AgentMemory struct {
	AgentID   string `json:"agentId"`
	UpdatedAt string `json:"updatedAt"`

	// Round results history
	RoundHistory []RoundResult `json:"roundHistory"`

	// Build performance tracking (buildHash -> stats)
	BuildPerformance map[string]*BuildStats `json:"buildPerformance"`

	// Synergy discovery tracking
	DiscoveredSynergies []string                     `json:"discoveredSynergies"`
	SynergyAttempts     map[string]*SynergyAttemptStats `json:"synergyAttempts"`

	// Opponent analysis
	OpponentProfiles map[string]*OpponentProfile `json:"opponentProfiles"`

	// Map knowledge
	MapKnowledge MapKnowledge `json:"mapKnowledge"`

	// Cumulative stats
	TotalRounds   int     `json:"totalRounds"`
	TotalKills    int     `json:"totalKills"`
	TotalDeaths   int     `json:"totalDeaths"`
	AvgRank       float64 `json:"avgRank"`
	AvgLevel      float64 `json:"avgLevel"`
	BestRank      int     `json:"bestRank"`
	WinCount      int     `json:"winCount"`
}

// RoundResult records the outcome of a single round.
type RoundResult struct {
	RoundID      string         `json:"roundId"`
	Timestamp    string         `json:"timestamp"`
	Rank         int            `json:"rank"`
	Level        int            `json:"level"`
	Kills        int            `json:"kills"`
	SurvivalTime int            `json:"survivalTime"` // seconds
	TotalXP      int            `json:"totalXP"`
	BuildHistory []BuildChoice  `json:"buildHistory"`
	Synergies    []string       `json:"synergies"`     // activated synergies
	DeathCause   string         `json:"deathCause"`    // "aura", "dash", "boundary", "survived"
	KeyMoments   []KeyMoment    `json:"keyMoments"`
	BuildHash    string         `json:"buildHash"`     // fingerprint of final build
}

// BuildChoice records a single upgrade choice during a round.
type BuildChoice struct {
	Level        int      `json:"level"`
	Choice       string   `json:"choice"`       // upgrade type ID chosen
	Alternatives []string `json:"alternatives"`  // other options available
	GamePhase    string   `json:"gamePhase"`     // "early", "mid", "late"
}

// KeyMoment records a notable event during a round.
type KeyMoment struct {
	Tick    uint64 `json:"tick"`
	Event   string `json:"event"`   // "kill", "death", "synergy_activated", "level_up"
	Context string `json:"context"` // human-readable description
}

// BuildStats tracks the performance of a specific build pattern.
type BuildStats struct {
	AvgRank     float64 `json:"avgRank"`
	AvgLevel    float64 `json:"avgLevel"`
	AvgKills    float64 `json:"avgKills"`
	SampleCount int     `json:"sampleCount"`
	WinCount    int     `json:"winCount"`
}

// SynergyAttemptStats tracks attempts to complete a synergy.
type SynergyAttemptStats struct {
	Attempts    int `json:"attempts"`
	Completions int `json:"completions"`
}

// OpponentProfile tracks a frequently-encountered opponent.
type OpponentProfile struct {
	OpponentID      string  `json:"opponentId"`
	PreferredBuild  string  `json:"preferredBuild"`  // most common build path
	Encounters      int     `json:"encounters"`
	WinsAgainst     int     `json:"winsAgainst"`
	LossesAgainst   int     `json:"lossesAgainst"`
	WinRateAgainst  float64 `json:"winRateAgainst"`
	CounterStrategy string  `json:"counterStrategy,omitempty"`
}

// MapKnowledge tracks zone safety by game phase.
type MapKnowledge struct {
	SafeZones   []ZoneInfo `json:"safeZones"`
	DangerZones []ZoneInfo `json:"dangerZones"`
}

// ZoneInfo describes a zone with phase context.
type ZoneInfo struct {
	Phase  string `json:"phase"`  // "early", "mid", "late"
	Zone   string `json:"zone"`   // "center", "mid", "edge"
	Reason string `json:"reason,omitempty"`
}

// ============================================================
// Memory Store
// ============================================================

// MemoryStore manages agent memory data with JSON file persistence.
type MemoryStore struct {
	mu      sync.RWMutex
	memories map[string]*AgentMemory
	dataDir  string
}

// NewMemoryStore creates a new memory store.
func NewMemoryStore(dataDir string) *MemoryStore {
	ms := &MemoryStore{
		memories: make(map[string]*AgentMemory),
		dataDir:  dataDir,
	}
	if dataDir != "" {
		os.MkdirAll(filepath.Join(dataDir, "agents"), 0755)
	}
	return ms
}

// GetMemory returns the memory for an agent.
func (ms *MemoryStore) GetMemory(agentID string) (*AgentMemory, bool) {
	ms.mu.RLock()
	mem, ok := ms.memories[agentID]
	ms.mu.RUnlock()

	if !ok {
		// Try loading from disk
		loaded := ms.loadFromDisk(agentID)
		if loaded != nil {
			return loaded, true
		}
		return nil, false
	}
	return mem, true
}

// GetOrCreateMemory returns existing memory or creates a new empty one.
func (ms *MemoryStore) GetOrCreateMemory(agentID string) *AgentMemory {
	mem, ok := ms.GetMemory(agentID)
	if ok {
		return mem
	}

	mem = &AgentMemory{
		AgentID:          agentID,
		UpdatedAt:        time.Now().UTC().Format(time.RFC3339),
		RoundHistory:     make([]RoundResult, 0),
		BuildPerformance: make(map[string]*BuildStats),
		DiscoveredSynergies: make([]string, 0),
		SynergyAttempts:  make(map[string]*SynergyAttemptStats),
		OpponentProfiles: make(map[string]*OpponentProfile),
		BestRank:         999,
	}

	ms.mu.Lock()
	ms.memories[agentID] = mem
	ms.mu.Unlock()

	return mem
}

// RecordRoundResult appends a round result and updates cumulative stats.
func (ms *MemoryStore) RecordRoundResult(agentID string, result RoundResult) {
	mem := ms.GetOrCreateMemory(agentID)

	ms.mu.Lock()
	defer ms.mu.Unlock()

	result.Timestamp = time.Now().UTC().Format(time.RFC3339)
	mem.RoundHistory = append(mem.RoundHistory, result)

	// Keep last 100 rounds
	if len(mem.RoundHistory) > 100 {
		mem.RoundHistory = mem.RoundHistory[len(mem.RoundHistory)-100:]
	}

	// Update cumulative stats
	mem.TotalRounds++
	mem.TotalKills += result.Kills
	if result.DeathCause != "survived" {
		mem.TotalDeaths++
	}
	if result.Rank == 1 {
		mem.WinCount++
	}
	if result.Rank < mem.BestRank {
		mem.BestRank = result.Rank
	}

	// Rolling average for rank and level
	n := float64(mem.TotalRounds)
	mem.AvgRank = mem.AvgRank*(n-1)/n + float64(result.Rank)/n
	mem.AvgLevel = mem.AvgLevel*(n-1)/n + float64(result.Level)/n

	// Update build performance
	if result.BuildHash != "" {
		stats, ok := mem.BuildPerformance[result.BuildHash]
		if !ok {
			stats = &BuildStats{}
			mem.BuildPerformance[result.BuildHash] = stats
		}
		stats.SampleCount++
		sn := float64(stats.SampleCount)
		stats.AvgRank = stats.AvgRank*(sn-1)/sn + float64(result.Rank)/sn
		stats.AvgLevel = stats.AvgLevel*(sn-1)/sn + float64(result.Level)/sn
		stats.AvgKills = stats.AvgKills*(sn-1)/sn + float64(result.Kills)/sn
		if result.Rank == 1 {
			stats.WinCount++
		}
	}

	// Track synergy discoveries
	for _, syn := range result.Synergies {
		found := false
		for _, existing := range mem.DiscoveredSynergies {
			if existing == syn {
				found = true
				break
			}
		}
		if !found {
			mem.DiscoveredSynergies = append(mem.DiscoveredSynergies, syn)
		}

		// Update synergy attempt stats
		stats, ok := mem.SynergyAttempts[syn]
		if !ok {
			stats = &SynergyAttemptStats{}
			mem.SynergyAttempts[syn] = stats
		}
		stats.Completions++
	}

	mem.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Persist to disk asynchronously
	memCopy := *mem
	go ms.saveToDisk(agentID, &memCopy)
}

// RecordOpponentEncounter updates opponent profile data.
func (ms *MemoryStore) RecordOpponentEncounter(agentID, opponentID, opponentBuild string, won bool) {
	mem := ms.GetOrCreateMemory(agentID)

	ms.mu.Lock()
	defer ms.mu.Unlock()

	profile, ok := mem.OpponentProfiles[opponentID]
	if !ok {
		profile = &OpponentProfile{OpponentID: opponentID}
		mem.OpponentProfiles[opponentID] = profile
	}

	profile.Encounters++
	if opponentBuild != "" {
		profile.PreferredBuild = opponentBuild
	}
	if won {
		profile.WinsAgainst++
	} else {
		profile.LossesAgainst++
	}
	total := profile.WinsAgainst + profile.LossesAgainst
	if total > 0 {
		profile.WinRateAgainst = float64(profile.WinsAgainst) / float64(total)
	}
}

// RecordSynergyAttempt records a synergy attempt (even if not completed).
func (ms *MemoryStore) RecordSynergyAttempt(agentID, synergyID string) {
	mem := ms.GetOrCreateMemory(agentID)

	ms.mu.Lock()
	defer ms.mu.Unlock()

	stats, ok := mem.SynergyAttempts[synergyID]
	if !ok {
		stats = &SynergyAttemptStats{}
		mem.SynergyAttempts[synergyID] = stats
	}
	stats.Attempts++
}

// --- Persistence ---

func (ms *MemoryStore) memoryPath(agentID string) string {
	return filepath.Join(ms.dataDir, "agents", agentID+"_memory.json")
}

func (ms *MemoryStore) saveToDisk(agentID string, mem *AgentMemory) {
	if ms.dataDir == "" {
		return
	}

	path := ms.memoryPath(agentID)
	data, err := json.MarshalIndent(mem, "", "  ")
	if err != nil {
		slog.Error("failed to marshal agent memory", "agentId", agentID, "error", err)
		return
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		slog.Error("failed to write agent memory", "agentId", agentID, "error", err)
	}
}

func (ms *MemoryStore) loadFromDisk(agentID string) *AgentMemory {
	if ms.dataDir == "" {
		return nil
	}

	path := ms.memoryPath(agentID)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var mem AgentMemory
	if err := json.Unmarshal(data, &mem); err != nil {
		slog.Error("failed to parse agent memory", "agentId", agentID, "error", err)
		return nil
	}

	ms.mu.Lock()
	ms.memories[agentID] = &mem
	ms.mu.Unlock()

	return &mem
}
