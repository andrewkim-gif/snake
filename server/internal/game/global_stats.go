package game

import (
	"net/http"
)

// ─── Global Stats ───

// GlobalStats provides aggregate statistics across all players.
type GlobalStats struct {
	rpStore       *RPStore
	trainingStore *TrainingStore
}

// NewGlobalStats creates a new GlobalStats instance.
func NewGlobalStats(rpStore *RPStore, trainingStore *TrainingStore) *GlobalStats {
	return &GlobalStats{
		rpStore:       rpStore,
		trainingStore: trainingStore,
	}
}

// BuildWinRate tracks a build path's win rate.
type BuildWinRate struct {
	BuildPath string  `json:"buildPath"`
	Wins      int     `json:"wins"`
	Rounds    int     `json:"rounds"`
	WinRate   float64 `json:"winRate"`
}

// SynergyStats tracks synergy discovery rate.
type SynergyStats struct {
	SynergyID     string  `json:"synergyId"`
	TimesAchieved int     `json:"timesAchieved"`
	TotalRounds   int     `json:"totalRounds"`
	Rate          float64 `json:"rate"`
}

// GetBuildWinRates aggregates build win rates from training history.
func (gs *GlobalStats) GetBuildWinRates() []BuildWinRate {
	gs.trainingStore.mu.RLock()
	defer gs.trainingStore.mu.RUnlock()

	buildCounts := make(map[string]int)
	buildWins := make(map[string]int)

	for _, results := range gs.trainingStore.history {
		for _, r := range results {
			if r.BuildPath == "" {
				continue
			}
			buildCounts[r.BuildPath]++
			if r.Rank == 1 {
				buildWins[r.BuildPath]++
			}
		}
	}

	rates := make([]BuildWinRate, 0, len(buildCounts))
	for path, count := range buildCounts {
		wins := buildWins[path]
		rate := 0.0
		if count > 0 {
			rate = float64(wins) / float64(count) * 100
		}
		rates = append(rates, BuildWinRate{
			BuildPath: path,
			Wins:      wins,
			Rounds:    count,
			WinRate:   rate,
		})
	}

	return rates
}

// GetSynergyStats aggregates synergy discovery rates from training history.
func (gs *GlobalStats) GetSynergyStats() []SynergyStats {
	gs.trainingStore.mu.RLock()
	defer gs.trainingStore.mu.RUnlock()

	totalRounds := 0
	synCounts := make(map[string]int)

	for _, results := range gs.trainingStore.history {
		for _, r := range results {
			totalRounds++
			for _, s := range r.Synergies {
				synCounts[s]++
			}
		}
	}

	stats := make([]SynergyStats, 0, len(synCounts))
	for synID, count := range synCounts {
		rate := 0.0
		if totalRounds > 0 {
			rate = float64(count) / float64(totalRounds) * 100
		}
		stats = append(stats, SynergyStats{
			SynergyID:     synID,
			TimesAchieved: count,
			TotalRounds:   totalRounds,
			Rate:          rate,
		})
	}

	return stats
}

// ─── HTTP Handlers (on MetaAPI) ───

// HandleGetStats handles GET /api/meta/stats.
func (m *MetaAPI) HandleGetStats(w http.ResponseWriter, r *http.Request) {
	if m.globalStats == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"buildWinRates": []BuildWinRate{},
			"synergyStats":  []SynergyStats{},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"buildWinRates": m.globalStats.GetBuildWinRates(),
		"synergyStats":  m.globalStats.GetSynergyStats(),
	})
}
