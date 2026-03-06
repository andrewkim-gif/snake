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
// Reputation Points (RP) System (S53)
// Round-based RP accumulation + unlock progression
// ============================================================

// RPSource defines the source of RP gain.
type RPSource string

const (
	RPSourceParticipation  RPSource = "participation"
	RPSourceTop50          RPSource = "top_50"
	RPSourceTop3           RPSource = "top_3"
	RPSourceWin            RPSource = "win"
	RPSourceSynergy        RPSource = "synergy"
	RPSourceHiddenSynergy  RPSource = "hidden_synergy_discovery"
	RPSourceKills3Plus     RPSource = "kills_3_plus"
	RPSourceQuestComplete  RPSource = "quest_complete"
)

// RPRewards defines the RP amount for each source.
var RPRewards = map[RPSource]int{
	RPSourceParticipation: 5,
	RPSourceTop50:         10,
	RPSourceTop3:          25,
	RPSourceWin:           50,
	RPSourceSynergy:       10,
	RPSourceHiddenSynergy: 100,
	RPSourceKills3Plus:    5,
}

// UnlockType identifies what is being unlocked.
type UnlockType string

const (
	UnlockAbilitySlot3   UnlockType = "ability_slot_3"
	UnlockBuildHistory   UnlockType = "build_history"
	UnlockAgentBadge     UnlockType = "agent_badge"
	UnlockCounterIntel   UnlockType = "counter_intel"
	UnlockSynergyHints   UnlockType = "synergy_hints"
)

// UnlockDef defines an RP-gated unlock.
type UnlockDef struct {
	Type        UnlockType `json:"type"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	RPRequired  int        `json:"rpRequired"`
}

// AllUnlocks defines all available RP unlocks (ordered by RP cost).
var AllUnlocks = []UnlockDef{
	{Type: UnlockAbilitySlot3, Name: "Ability Slot +1", Description: "Unlock 3rd ability slot (2 -> 3)", RPRequired: 50},
	{Type: UnlockBuildHistory, Name: "Build History", Description: "View last 50 rounds of build statistics", RPRequired: 100},
	{Type: UnlockAgentBadge, Name: "Agent Badge", Description: "Win-rate based badge (Bronze/Silver/Gold/Diamond)", RPRequired: 200},
	{Type: UnlockCounterIntel, Name: "Counter Intel", Description: "See current room agents' recent build patterns", RPRequired: 500},
	{Type: UnlockSynergyHints, Name: "Synergy Explorer", Description: "Receive 3 hidden synergy hints", RPRequired: 1000},
}

// PlayerProgression holds a player's RP and unlock state.
type PlayerProgression struct {
	PlayerID    string              `json:"playerId"`
	TotalRP     int                 `json:"totalRP"`
	Unlocks     map[UnlockType]bool `json:"unlocks"`
	RPHistory   []RPTransaction     `json:"rpHistory"`
	UpdatedAt   string              `json:"updatedAt"`

	// Achievement tracking
	TotalRounds   int `json:"totalRounds"`
	TotalWins     int `json:"totalWins"`
	TotalKills    int `json:"totalKills"`
	BestRank      int `json:"bestRank"`
	SynergiesFound int `json:"synergiesFound"`
	HiddenSynergiesDiscovered []string `json:"hiddenSynergiesDiscovered"`
}

// RPTransaction records a single RP gain event.
type RPTransaction struct {
	Source    RPSource `json:"source"`
	Amount    int      `json:"amount"`
	RoundID   string   `json:"roundId,omitempty"`
	Timestamp string   `json:"timestamp"`
}

// ProgressionResponse is the API response for GET /api/player/:id/progression.
type ProgressionResponse struct {
	PlayerID     string              `json:"playerId"`
	TotalRP      int                 `json:"totalRP"`
	Unlocks      map[UnlockType]bool `json:"unlocks"`
	NextUnlock   *UnlockDef          `json:"nextUnlock,omitempty"`
	RPToNext     int                 `json:"rpToNext,omitempty"`
	Stats        ProgressionStats    `json:"stats"`
}

// ProgressionStats holds summary statistics.
type ProgressionStats struct {
	TotalRounds   int    `json:"totalRounds"`
	TotalWins     int    `json:"totalWins"`
	TotalKills    int    `json:"totalKills"`
	BestRank      int    `json:"bestRank"`
	WinRate       float64 `json:"winRate"`
	BadgeTier     string  `json:"badgeTier,omitempty"`
}

// ============================================================
// Progression Store
// ============================================================

// ProgressionStore manages player progression data.
type ProgressionStore struct {
	mu          sync.RWMutex
	progressions map[string]*PlayerProgression
	dataDir     string
}

// NewProgressionStore creates a new progression store.
func NewProgressionStore(dataDir string) *ProgressionStore {
	ps := &ProgressionStore{
		progressions: make(map[string]*PlayerProgression),
		dataDir:      dataDir,
	}
	if dataDir != "" {
		os.MkdirAll(filepath.Join(dataDir, "players"), 0755)
	}
	return ps
}

// GetProgression returns the progression for a player.
func (ps *ProgressionStore) GetProgression(playerID string) (*PlayerProgression, bool) {
	ps.mu.RLock()
	prog, ok := ps.progressions[playerID]
	ps.mu.RUnlock()

	if !ok {
		loaded := ps.loadFromDisk(playerID)
		if loaded != nil {
			return loaded, true
		}
		return nil, false
	}
	return prog, true
}

// GetOrCreateProgression returns existing or creates new progression.
func (ps *ProgressionStore) GetOrCreateProgression(playerID string) *PlayerProgression {
	prog, ok := ps.GetProgression(playerID)
	if ok {
		return prog
	}

	prog = &PlayerProgression{
		PlayerID:  playerID,
		TotalRP:   0,
		Unlocks:   make(map[UnlockType]bool),
		RPHistory: make([]RPTransaction, 0),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		BestRank:  999,
		HiddenSynergiesDiscovered: make([]string, 0),
	}

	ps.mu.Lock()
	ps.progressions[playerID] = prog
	ps.mu.Unlock()

	return prog
}

// AwardRP adds RP to a player and checks for new unlocks.
func (ps *ProgressionStore) AwardRP(playerID string, source RPSource, amount int, roundID string) []UnlockType {
	prog := ps.GetOrCreateProgression(playerID)

	ps.mu.Lock()
	defer ps.mu.Unlock()

	prog.TotalRP += amount
	prog.RPHistory = append(prog.RPHistory, RPTransaction{
		Source:    source,
		Amount:    amount,
		RoundID:   roundID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})

	// Keep last 200 transactions
	if len(prog.RPHistory) > 200 {
		prog.RPHistory = prog.RPHistory[len(prog.RPHistory)-200:]
	}

	prog.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Check for new unlocks
	var newUnlocks []UnlockType
	for _, unlock := range AllUnlocks {
		if !prog.Unlocks[unlock.Type] && prog.TotalRP >= unlock.RPRequired {
			prog.Unlocks[unlock.Type] = true
			newUnlocks = append(newUnlocks, unlock.Type)
			slog.Info("player unlock achieved",
				"playerId", playerID,
				"unlock", unlock.Type,
				"rp", prog.TotalRP,
			)
		}
	}

	// Persist asynchronously
	progCopy := *prog
	go ps.saveToDisk(playerID, &progCopy)

	return newUnlocks
}

// ProcessRoundResult calculates and awards RP based on round performance.
func (ps *ProgressionStore) ProcessRoundResult(
	playerID string,
	roundID string,
	rank int,
	totalPlayers int,
	kills int,
	synergies []string,
	hiddenSynergies []string,
) (int, []UnlockType) {
	totalRP := 0
	var allNewUnlocks []UnlockType

	// 1. Participation: +5 RP
	newUnlocks := ps.AwardRP(playerID, RPSourceParticipation, RPRewards[RPSourceParticipation], roundID)
	totalRP += RPRewards[RPSourceParticipation]
	allNewUnlocks = append(allNewUnlocks, newUnlocks...)

	// 2. Top 50%: +10 RP
	if totalPlayers > 1 && rank <= totalPlayers/2 {
		newUnlocks = ps.AwardRP(playerID, RPSourceTop50, RPRewards[RPSourceTop50], roundID)
		totalRP += RPRewards[RPSourceTop50]
		allNewUnlocks = append(allNewUnlocks, newUnlocks...)
	}

	// 3. Top 3: +25 RP
	if rank <= 3 {
		newUnlocks = ps.AwardRP(playerID, RPSourceTop3, RPRewards[RPSourceTop3], roundID)
		totalRP += RPRewards[RPSourceTop3]
		allNewUnlocks = append(allNewUnlocks, newUnlocks...)
	}

	// 4. Win: +50 RP
	if rank == 1 {
		newUnlocks = ps.AwardRP(playerID, RPSourceWin, RPRewards[RPSourceWin], roundID)
		totalRP += RPRewards[RPSourceWin]
		allNewUnlocks = append(allNewUnlocks, newUnlocks...)
	}

	// 5. Synergy: +10 RP each
	for range synergies {
		newUnlocks = ps.AwardRP(playerID, RPSourceSynergy, RPRewards[RPSourceSynergy], roundID)
		totalRP += RPRewards[RPSourceSynergy]
		allNewUnlocks = append(allNewUnlocks, newUnlocks...)
	}

	// 6. Hidden synergy discovery: +100 RP each
	for _, syn := range hiddenSynergies {
		prog := ps.GetOrCreateProgression(playerID)
		ps.mu.Lock()
		alreadyDiscovered := false
		for _, existing := range prog.HiddenSynergiesDiscovered {
			if existing == syn {
				alreadyDiscovered = true
				break
			}
		}
		if !alreadyDiscovered {
			prog.HiddenSynergiesDiscovered = append(prog.HiddenSynergiesDiscovered, syn)
		}
		ps.mu.Unlock()

		if !alreadyDiscovered {
			newUnlocks = ps.AwardRP(playerID, RPSourceHiddenSynergy, RPRewards[RPSourceHiddenSynergy], roundID)
			totalRP += RPRewards[RPSourceHiddenSynergy]
			allNewUnlocks = append(allNewUnlocks, newUnlocks...)
		}
	}

	// 7. Kills 3+: +5 RP
	if kills >= 3 {
		newUnlocks = ps.AwardRP(playerID, RPSourceKills3Plus, RPRewards[RPSourceKills3Plus], roundID)
		totalRP += RPRewards[RPSourceKills3Plus]
		allNewUnlocks = append(allNewUnlocks, newUnlocks...)
	}

	// Update cumulative stats
	prog := ps.GetOrCreateProgression(playerID)
	ps.mu.Lock()
	prog.TotalRounds++
	prog.TotalKills += kills
	if rank == 1 {
		prog.TotalWins++
	}
	if rank < prog.BestRank {
		prog.BestRank = rank
	}
	prog.SynergiesFound += len(synergies)
	ps.mu.Unlock()

	slog.Info("round RP awarded",
		"playerId", playerID,
		"roundId", roundID,
		"rpEarned", totalRP,
		"totalRP", prog.TotalRP,
		"newUnlocks", len(allNewUnlocks),
	)

	return totalRP, allNewUnlocks
}

// HasUnlock checks if a player has a specific unlock.
func (ps *ProgressionStore) HasUnlock(playerID string, unlock UnlockType) bool {
	prog, ok := ps.GetProgression(playerID)
	if !ok {
		return false
	}
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return prog.Unlocks[unlock]
}

// GetMaxAbilitySlots returns the max ability slots for a player (2 base + unlock).
func (ps *ProgressionStore) GetMaxAbilitySlots(playerID string) int {
	if ps.HasUnlock(playerID, UnlockAbilitySlot3) {
		return AbilityMaxSlots // 3
	}
	return AbilityBaseSlots // 2
}

// BuildProgressionResponse creates the API response.
func (ps *ProgressionStore) BuildProgressionResponse(playerID string) *ProgressionResponse {
	prog, ok := ps.GetProgression(playerID)
	if !ok {
		return nil
	}

	ps.mu.RLock()
	defer ps.mu.RUnlock()

	resp := &ProgressionResponse{
		PlayerID: playerID,
		TotalRP:  prog.TotalRP,
		Unlocks:  prog.Unlocks,
		Stats: ProgressionStats{
			TotalRounds: prog.TotalRounds,
			TotalWins:   prog.TotalWins,
			TotalKills:  prog.TotalKills,
			BestRank:    prog.BestRank,
		},
	}

	// Calculate win rate
	if prog.TotalRounds > 0 {
		resp.Stats.WinRate = float64(prog.TotalWins) / float64(prog.TotalRounds)
	}

	// Determine badge tier
	resp.Stats.BadgeTier = computeBadgeTier(resp.Stats.WinRate, prog.TotalRounds)

	// Find next unlock
	for _, unlock := range AllUnlocks {
		if !prog.Unlocks[unlock.Type] {
			u := unlock
			resp.NextUnlock = &u
			resp.RPToNext = unlock.RPRequired - prog.TotalRP
			if resp.RPToNext < 0 {
				resp.RPToNext = 0
			}
			break
		}
	}

	return resp
}

// computeBadgeTier determines badge tier from win rate.
func computeBadgeTier(winRate float64, totalRounds int) string {
	if totalRounds < 10 {
		return "" // not enough data
	}
	switch {
	case winRate >= 0.30:
		return "diamond"
	case winRate >= 0.20:
		return "gold"
	case winRate >= 0.10:
		return "silver"
	case winRate >= 0.05:
		return "bronze"
	default:
		return ""
	}
}

// --- Persistence ---

func (ps *ProgressionStore) progressionPath(playerID string) string {
	return filepath.Join(ps.dataDir, "players", playerID+".json")
}

func (ps *ProgressionStore) saveToDisk(playerID string, prog *PlayerProgression) {
	if ps.dataDir == "" {
		return
	}

	path := ps.progressionPath(playerID)
	data, err := json.MarshalIndent(prog, "", "  ")
	if err != nil {
		slog.Error("failed to marshal progression", "playerId", playerID, "error", err)
		return
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		slog.Error("failed to write progression", "playerId", playerID, "error", err)
	}
}

func (ps *ProgressionStore) loadFromDisk(playerID string) *PlayerProgression {
	if ps.dataDir == "" {
		return nil
	}

	path := ps.progressionPath(playerID)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var prog PlayerProgression
	if err := json.Unmarshal(data, &prog); err != nil {
		slog.Error("failed to parse progression", "playerId", playerID, "error", err)
		return nil
	}

	ps.mu.Lock()
	ps.progressions[playerID] = &prog
	ps.mu.Unlock()

	return &prog
}
