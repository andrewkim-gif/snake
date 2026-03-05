package game

import (
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

// ─── RP Data ───

// RPData holds a player's reputation points and unlocks.
type RPData struct {
	TotalRP               int      `json:"totalRP"`
	UnlockedSkins         []int    `json:"unlockedSkins"`
	UnlockedPersonalities []string `json:"unlockedPersonalities"`
	GamesPlayed           int      `json:"gamesPlayed"`
}

// SkinUnlockThresholds defines RP thresholds to unlock additional skins (18 slots).
var SkinUnlockThresholds = []int{
	50, 100, 200, 350, 500, 750,
	1000, 1300, 1600, 2000, 2500, 3000,
	3500, 4000, 5000, 6000, 7500, 10000,
}

// CalculateRP computes RP earned from a round result.
func CalculateRP(kills int, survivalTimeSec float64, synergies int, rank int) int {
	rp := 0
	rp += kills * 10
	rp += int(math.Floor(survivalTimeSec/60.0)) * 15
	rp += synergies * 25

	switch rank {
	case 1:
		rp += 100
	case 2:
		rp += 50
	case 3:
		rp += 25
	}

	return rp
}

// NextUnlockThreshold returns the next RP threshold the player has not reached, and the index.
func NextUnlockThreshold(currentRP int) (int, int) {
	for i, threshold := range SkinUnlockThresholds {
		if currentRP < threshold {
			return threshold, i
		}
	}
	return -1, len(SkinUnlockThresholds) // all unlocked
}

// ─── RPStore ───

// RPStore manages RP data per player with JSON file backup.
type RPStore struct {
	data    map[string]*RPData
	dataDir string
	mu      sync.RWMutex
}

// NewRPStore creates a new RPStore.
func NewRPStore(dataDir string) *RPStore {
	s := &RPStore{
		data:    make(map[string]*RPData),
		dataDir: dataDir,
	}
	_ = os.MkdirAll(dataDir, 0o755)
	s.loadFromDisk()
	return s
}

// GetRP returns RP data for a player. Returns empty data if not found.
func (s *RPStore) GetRP(name string) RPData {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if d, ok := s.data[name]; ok {
		return *d
	}
	return RPData{
		UnlockedSkins:         []int{},
		UnlockedPersonalities: []string{},
	}
}

// RecordRP adds RP from a round result.
func (s *RPStore) RecordRP(name string, rp int) RPData {
	s.mu.Lock()
	defer s.mu.Unlock()

	d, ok := s.data[name]
	if !ok {
		d = &RPData{
			UnlockedSkins:         []int{},
			UnlockedPersonalities: []string{},
		}
		s.data[name] = d
	}

	d.TotalRP += rp
	d.GamesPlayed++

	// Check for new skin unlocks
	for i, threshold := range SkinUnlockThresholds {
		skinIdx := i + 6 // first 6 skins are free (IDs 0-5), unlockable start at 6
		if d.TotalRP >= threshold && !containsInt(d.UnlockedSkins, skinIdx) {
			d.UnlockedSkins = append(d.UnlockedSkins, skinIdx)
		}
	}

	go s.saveToDisk()

	return *d
}

// GetTop returns the top N players sorted by RP.
func (s *RPStore) GetTop(n int) []RPLeaderEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries := make([]RPLeaderEntry, 0, len(s.data))
	for name, d := range s.data {
		entries = append(entries, RPLeaderEntry{
			Name:        name,
			TotalRP:     d.TotalRP,
			GamesPlayed: d.GamesPlayed,
		})
	}

	// Sort by RP descending
	for i := 0; i < len(entries); i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[j].TotalRP > entries[i].TotalRP {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}

	if n > 0 && n < len(entries) {
		entries = entries[:n]
	}

	for i := range entries {
		entries[i].Rank = i + 1
	}

	return entries
}

// RPLeaderEntry is used for the global RP leaderboard.
type RPLeaderEntry struct {
	Rank        int    `json:"rank"`
	Name        string `json:"name"`
	TotalRP     int    `json:"totalRP"`
	GamesPlayed int    `json:"gamesPlayed"`
}

// ─── Persistence ───

type rpPersistedData struct {
	Data map[string]*RPData `json:"data"`
}

func (s *RPStore) saveToDisk() {
	s.mu.RLock()
	data := rpPersistedData{Data: s.data}
	s.mu.RUnlock()

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		slog.Error("rp store: marshal error", "error", err)
		return
	}

	path := filepath.Join(s.dataDir, "rp_data.json")
	if err := os.WriteFile(path, bytes, 0o644); err != nil {
		slog.Error("rp store: write error", "error", err, "path", path)
	}
}

func (s *RPStore) loadFromDisk() {
	path := filepath.Join(s.dataDir, "rp_data.json")
	bytes, err := os.ReadFile(path)
	if err != nil {
		return // file doesn't exist yet
	}

	var data rpPersistedData
	if err := json.Unmarshal(bytes, &data); err != nil {
		slog.Error("rp store: unmarshal error", "error", err)
		return
	}

	if data.Data != nil {
		s.data = data.Data
	}

	slog.Info("rp store loaded from disk", "players", len(s.data))
}

// ─── HTTP Handlers ───

// MetaAPI provides HTTP endpoints for RP, quests, leaderboard, etc.
type MetaAPI struct {
	rpStore          *RPStore
	questTracker     *QuestTracker
	globalStats      *GlobalStats
	personalityStore *PersonalityStore
}

// NewMetaAPI creates a new MetaAPI.
func NewMetaAPI(rpStore *RPStore, qt *QuestTracker, gs *GlobalStats, ps *PersonalityStore) *MetaAPI {
	return &MetaAPI{rpStore: rpStore, questTracker: qt, globalStats: gs, personalityStore: ps}
}

// HandleGetRP handles GET /api/meta/rp?name=X.
func (m *MetaAPI) HandleGetRP(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}

	data := m.rpStore.GetRP(name)
	nextThreshold, unlockedCount := NextUnlockThreshold(data.TotalRP)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"totalRP":               data.TotalRP,
		"unlockedSkins":         data.UnlockedSkins,
		"unlockedPersonalities": data.UnlockedPersonalities,
		"gamesPlayed":           data.GamesPlayed,
		"nextUnlock":            nextThreshold,
		"unlockedCount":         unlockedCount,
		"totalUnlocks":          len(SkinUnlockThresholds),
	})
}

// HandlePostRP handles POST /api/meta/rp — record RP after round end.
func (m *MetaAPI) HandlePostRP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name            string  `json:"name"`
		Kills           int     `json:"kills"`
		SurvivalTimeSec float64 `json:"survivalTimeSec"`
		Synergies       int     `json:"synergies"`
		Rank            int     `json:"rank"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}

	earned := CalculateRP(req.Kills, req.SurvivalTimeSec, req.Synergies, req.Rank)
	data := m.rpStore.RecordRP(req.Name, earned)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"earned":  earned,
		"totalRP": data.TotalRP,
	})
}

// HandleGetLeaderboard handles GET /api/meta/leaderboard — top 50 by RP.
func (m *MetaAPI) HandleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	top := m.rpStore.GetTop(50)
	writeJSON(w, http.StatusOK, top)
}

// ─── Helpers ───

func containsInt(slice []int, val int) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}
