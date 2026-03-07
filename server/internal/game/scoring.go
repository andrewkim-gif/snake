package game

import (
	"sort"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 4 — S20: Scoring System Rework
// Epoch NationScore formula, player epoch score, scoreboard generation
// ============================================================

// CalcBattleScore computes a player's battle score for sovereignty determination.
// (v11 legacy — kept for backward compat)
func CalcBattleScore(alive bool, kills, level int, damage, survivalSec float64) int {
	base := 0
	if alive {
		base = 100
	}

	killScore := kills * 15
	levelScore := level * 10
	damageScore := int(damage * 0.5)

	score := base + killScore + levelScore + damageScore

	if !alive {
		score += int(survivalSec * 2)
	}

	return score
}

// TopPlayerInfo holds summarized player info for round_end (legacy).
type TopPlayerInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Score    int    `json:"score"`
	Kills    int    `json:"kills"`
	Level    int    `json:"level"`
	Alive    bool   `json:"alive"`
	Faction  string `json:"faction,omitempty"`
}

// ============================================================
// v14 Epoch Score Calculation
// ============================================================

// NationScoreWeights defines the scoring weights for epoch NationScore.
// NationScore = Kills×10 + Assists×4 + Level×5 + SurvivalMin×2 + Objectives×3
const (
	NationScorePerKill      = 10
	NationScorePerAssist    = 4
	NationScorePerLevel     = 5
	NationScorePerSurvival  = 2  // per minute survived
	NationScorePerObjective = 3
)

// PlayerEpochStats tracks one player's contributions within an epoch.
type PlayerEpochStats struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Nationality     string  `json:"nationality"`
	Kills           int     `json:"kills"`
	Deaths          int     `json:"deaths"`
	Assists         int     `json:"assists"`
	Level           int     `json:"level"`
	SurvivalMinutes float64 `json:"survivalMinutes"`
	ObjectivePoints int     `json:"objectivePoints"`
	DamageDealt     float64 `json:"damageDealt"`
	XPEarned        int     `json:"xpEarned"`
	GoldEarned      int     `json:"goldEarned"`
	NationScore     int     `json:"nationScore"`
}

// CalcPlayerNationScore computes a player's contribution to their nation's epoch score.
func CalcPlayerNationScore(stats *PlayerEpochStats) int {
	score := stats.Kills*NationScorePerKill +
		stats.Assists*NationScorePerAssist +
		stats.Level*NationScorePerLevel +
		int(stats.SurvivalMinutes)*NationScorePerSurvival +
		stats.ObjectivePoints*NationScorePerObjective
	return score
}

// CalcPlayerNationScoreFromAgent computes a player's nation score directly from Agent.
func CalcPlayerNationScoreFromAgent(a *domain.Agent, survivalMinutes float64, objectivePoints int) int {
	return a.Kills*NationScorePerKill +
		a.Assists*NationScorePerAssist +
		a.Level*NationScorePerLevel +
		int(survivalMinutes)*NationScorePerSurvival +
		objectivePoints*NationScorePerObjective
}

// ============================================================
// Epoch Scoreboard Generation
// ============================================================

// EpochScoreboardEntry is a player's entry on the epoch scoreboard.
type EpochScoreboardEntry struct {
	Rank        int    `json:"rank"`
	ID          string `json:"id"`
	Name        string `json:"name"`
	Nationality string `json:"nationality"`
	Kills       int    `json:"kills"`
	Deaths      int    `json:"deaths"`
	Assists     int    `json:"assists"`
	Level       int    `json:"level"`
	Score       int    `json:"score"`
	IsBot       bool   `json:"isBot"`
}

// NationScoreSummary is a per-nation summary for the epoch.
type NationScoreSummary struct {
	Nationality string `json:"nationality"`
	TotalScore  int    `json:"totalScore"`
	PlayerCount int    `json:"playerCount"`
	TotalKills  int    `json:"totalKills"`
}

// EpochScoreboard is the full scoreboard generated at epoch end.
type EpochScoreboard struct {
	EpochNumber    int                    `json:"epochNumber"`
	CountryCode    string                 `json:"countryCode"`
	Players        []EpochScoreboardEntry `json:"players"`
	NationScores   []NationScoreSummary   `json:"nationScores"`
	MVP            *EpochScoreboardEntry  `json:"mvp"`
}

// GenerateEpochScoreboard creates the full scoreboard from agents.
func GenerateEpochScoreboard(agents map[string]*domain.Agent, epochNumber int, countryCode string) *EpochScoreboard {
	// Build player entries
	entries := make([]EpochScoreboardEntry, 0, len(agents))
	nationTotals := make(map[string]*NationScoreSummary)

	for _, a := range agents {
		// Compute player nation score
		score := a.Kills*NationScorePerKill +
			a.Assists*NationScorePerAssist +
			a.Level*NationScorePerLevel

		entry := EpochScoreboardEntry{
			ID:          a.ID,
			Name:        a.Name,
			Nationality: a.Nationality,
			Kills:       a.Kills,
			Deaths:      a.Deaths,
			Assists:     a.Assists,
			Level:       a.Level,
			Score:       score,
			IsBot:       a.IsBot,
		}
		entries = append(entries, entry)

		// Accumulate nation scores
		if a.Nationality != "" {
			ns, ok := nationTotals[a.Nationality]
			if !ok {
				ns = &NationScoreSummary{Nationality: a.Nationality}
				nationTotals[a.Nationality] = ns
			}
			ns.TotalScore += score
			ns.PlayerCount++
			ns.TotalKills += a.Kills
		}
	}

	// Sort players by score descending
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Score != entries[j].Score {
			return entries[i].Score > entries[j].Score
		}
		if entries[i].Kills != entries[j].Kills {
			return entries[i].Kills > entries[j].Kills
		}
		return entries[i].Level > entries[j].Level
	})

	// Assign ranks
	for i := range entries {
		entries[i].Rank = i + 1
	}

	// Sort nation scores
	nationList := make([]NationScoreSummary, 0, len(nationTotals))
	for _, ns := range nationTotals {
		nationList = append(nationList, *ns)
	}
	sort.Slice(nationList, func(i, j int) bool {
		return nationList[i].TotalScore > nationList[j].TotalScore
	})

	// MVP is top player
	var mvp *EpochScoreboardEntry
	if len(entries) > 0 {
		first := entries[0]
		mvp = &first
	}

	return &EpochScoreboard{
		EpochNumber:  epochNumber,
		CountryCode:  countryCode,
		Players:      entries,
		NationScores: nationList,
		MVP:          mvp,
	}
}
