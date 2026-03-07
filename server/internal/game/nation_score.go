package game

import (
	"sort"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 5 — S23: Nation Score Tracker
// Epoch-level nation score accumulation, 6-epoch history,
// per-nation top-3 contributors tracking.
// ============================================================

// MaxEpochHistory is the number of epochs retained (6 epochs = 1 hour).
const MaxEpochHistory = 6

// NationEpochRecord holds a snapshot of one nation's score for a single epoch.
type NationEpochRecord struct {
	EpochNumber int                  `json:"epochNumber"`
	TotalScore  int                  `json:"totalScore"`
	PlayerCount int                  `json:"playerCount"`
	TotalKills  int                  `json:"totalKills"`
	TotalLevel  int                  `json:"totalLevel"`
	TopPlayers  []NationContributor  `json:"topPlayers"` // top 3
	Timestamp   time.Time            `json:"timestamp"`
}

// NationContributor tracks an individual player's contribution to their nation.
type NationContributor struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Score       int    `json:"score"`
	Kills       int    `json:"kills"`
	Level       int    `json:"level"`
}

// NationScoreState holds accumulated data for a single nation across epochs.
type NationScoreState struct {
	Nationality   string               `json:"nationality"`
	EpochHistory  []NationEpochRecord  `json:"epochHistory"`  // ring buffer, max MaxEpochHistory
	CurrentEpoch  *NationEpochRecord   `json:"currentEpoch"`  // in-progress epoch accumulation
}

// NationScoreTracker tracks per-nation scores across epochs for a country arena.
// Thread-safe via mutex.
type NationScoreTracker struct {
	mu sync.RWMutex

	countryCode string

	// nationality → accumulated state
	nations map[string]*NationScoreState

	// Current epoch contributors (nationality → playerID → contribution)
	currentContribs map[string]map[string]*NationContributor

	// Current epoch number being tracked
	currentEpoch int
}

// NewNationScoreTracker creates a new tracker for a country arena.
func NewNationScoreTracker(countryCode string) *NationScoreTracker {
	return &NationScoreTracker{
		countryCode:     countryCode,
		nations:         make(map[string]*NationScoreState),
		currentContribs: make(map[string]map[string]*NationContributor),
		currentEpoch:    0,
	}
}

// getOrCreateNation returns or initializes the state for a nationality.
func (nst *NationScoreTracker) getOrCreateNation(nationality string) *NationScoreState {
	ns, ok := nst.nations[nationality]
	if !ok {
		ns = &NationScoreState{
			Nationality:  nationality,
			EpochHistory: make([]NationEpochRecord, 0, MaxEpochHistory),
		}
		nst.nations[nationality] = ns
	}
	return ns
}

// RecordPlayerScore records a player's contribution to their nation for the current epoch.
// Call this during epoch end to register each player's stats.
func (nst *NationScoreTracker) RecordPlayerScore(agent *domain.Agent, epochNumber int) {
	if agent.Nationality == "" {
		return
	}

	nst.mu.Lock()
	defer nst.mu.Unlock()

	nst.currentEpoch = epochNumber

	// Get or create contributor map for this nationality
	contribs, ok := nst.currentContribs[agent.Nationality]
	if !ok {
		contribs = make(map[string]*NationContributor)
		nst.currentContribs[agent.Nationality] = contribs
	}

	// Calculate player's nation score using the existing formula
	score := agent.Kills*NationScorePerKill +
		agent.Assists*NationScorePerAssist +
		agent.Level*NationScorePerLevel

	// Update or create contributor entry
	if existing, ok := contribs[agent.ID]; ok {
		// Update with latest values (scores accumulate within epoch)
		existing.Score = score
		existing.Kills = agent.Kills
		existing.Level = agent.Level
	} else {
		contribs[agent.ID] = &NationContributor{
			ID:    agent.ID,
			Name:  agent.Name,
			Score: score,
			Kills: agent.Kills,
			Level: agent.Level,
		}
	}
}

// FinalizeEpoch closes the current epoch, computes nation totals,
// stores the record in history (ring buffer capped at MaxEpochHistory),
// and resets for the next epoch.
// Returns the finalized nation scores: nationality → total score.
func (nst *NationScoreTracker) FinalizeEpoch(epochNumber int) map[string]int {
	nst.mu.Lock()
	defer nst.mu.Unlock()

	now := time.Now()
	result := make(map[string]int)

	for nationality, contribs := range nst.currentContribs {
		ns := nst.getOrCreateNation(nationality)

		// Build the epoch record
		record := NationEpochRecord{
			EpochNumber: epochNumber,
			Timestamp:   now,
		}

		// Compute totals and find top 3
		contributors := make([]NationContributor, 0, len(contribs))
		for _, c := range contribs {
			record.TotalScore += c.Score
			record.TotalKills += c.Kills
			record.TotalLevel += c.Level
			record.PlayerCount++
			contributors = append(contributors, *c)
		}

		// Sort by score descending, take top 3
		sort.Slice(contributors, func(i, j int) bool {
			if contributors[i].Score != contributors[j].Score {
				return contributors[i].Score > contributors[j].Score
			}
			return contributors[i].Kills > contributors[j].Kills
		})
		topCount := 3
		if len(contributors) < topCount {
			topCount = len(contributors)
		}
		record.TopPlayers = contributors[:topCount]

		// Append to history (ring buffer)
		if len(ns.EpochHistory) >= MaxEpochHistory {
			// Shift out oldest
			ns.EpochHistory = ns.EpochHistory[1:]
		}
		ns.EpochHistory = append(ns.EpochHistory, record)
		ns.CurrentEpoch = nil

		result[nationality] = record.TotalScore
	}

	// Reset current contributions for next epoch
	nst.currentContribs = make(map[string]map[string]*NationContributor)
	nst.currentEpoch = epochNumber

	return result
}

// GetDominationScores computes the 1-hour domination score per nation
// by summing all epoch scores in the history (up to 6 epochs).
// Returns nationality → total domination score.
func (nst *NationScoreTracker) GetDominationScores() map[string]int {
	nst.mu.RLock()
	defer nst.mu.RUnlock()

	scores := make(map[string]int)
	for nationality, ns := range nst.nations {
		total := 0
		for _, record := range ns.EpochHistory {
			total += record.TotalScore
		}
		if total > 0 {
			scores[nationality] = total
		}
	}
	return scores
}

// GetNationHistory returns the epoch history for a specific nationality.
func (nst *NationScoreTracker) GetNationHistory(nationality string) []NationEpochRecord {
	nst.mu.RLock()
	defer nst.mu.RUnlock()

	ns, ok := nst.nations[nationality]
	if !ok {
		return nil
	}

	// Return a copy
	history := make([]NationEpochRecord, len(ns.EpochHistory))
	copy(history, ns.EpochHistory)
	return history
}

// GetTopContributors returns the top N contributors for a nation across all epoch history.
func (nst *NationScoreTracker) GetTopContributors(nationality string, n int) []NationContributor {
	nst.mu.RLock()
	defer nst.mu.RUnlock()

	ns, ok := nst.nations[nationality]
	if !ok {
		return nil
	}

	// Aggregate contributions across all epochs
	aggregate := make(map[string]*NationContributor)
	for _, record := range ns.EpochHistory {
		for _, tp := range record.TopPlayers {
			if existing, ok := aggregate[tp.ID]; ok {
				existing.Score += tp.Score
				existing.Kills += tp.Kills
				if tp.Level > existing.Level {
					existing.Level = tp.Level
				}
			} else {
				copy := tp
				aggregate[tp.ID] = &copy
			}
		}
	}

	// Sort and return top N
	result := make([]NationContributor, 0, len(aggregate))
	for _, c := range aggregate {
		result = append(result, *c)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Score != result[j].Score {
			return result[i].Score > result[j].Score
		}
		return result[i].Kills > result[j].Kills
	})

	if len(result) > n {
		result = result[:n]
	}
	return result
}

// GetEpochCount returns the number of epochs recorded for any nation (max across all).
func (nst *NationScoreTracker) GetEpochCount() int {
	nst.mu.RLock()
	defer nst.mu.RUnlock()

	maxEpochs := 0
	for _, ns := range nst.nations {
		if len(ns.EpochHistory) > maxEpochs {
			maxEpochs = len(ns.EpochHistory)
		}
	}
	return maxEpochs
}

// HasFullCycle returns true if at least one nation has a complete 6-epoch history.
func (nst *NationScoreTracker) HasFullCycle() bool {
	nst.mu.RLock()
	defer nst.mu.RUnlock()

	for _, ns := range nst.nations {
		if len(ns.EpochHistory) >= MaxEpochHistory {
			return true
		}
	}
	return false
}

// Reset clears all tracked data (called on domination eval + full reset).
func (nst *NationScoreTracker) Reset() {
	nst.mu.Lock()
	defer nst.mu.Unlock()

	nst.nations = make(map[string]*NationScoreState)
	nst.currentContribs = make(map[string]map[string]*NationContributor)
	nst.currentEpoch = 0
}

// GetCurrentEpochScores returns in-progress scores for the current epoch (for HUD display).
func (nst *NationScoreTracker) GetCurrentEpochScores() map[string]int {
	nst.mu.RLock()
	defer nst.mu.RUnlock()

	scores := make(map[string]int)
	for nationality, contribs := range nst.currentContribs {
		total := 0
		for _, c := range contribs {
			total += c.Score
		}
		scores[nationality] = total
	}
	return scores
}

// NationRanking is a sorted entry for nation leaderboard display.
type NationRanking struct {
	Nationality string `json:"nationality"`
	Score       int    `json:"score"`
	Rank        int    `json:"rank"`
}

// GetNationRankings returns nations sorted by domination score (descending).
func (nst *NationScoreTracker) GetNationRankings() []NationRanking {
	scores := nst.GetDominationScores()

	rankings := make([]NationRanking, 0, len(scores))
	for nat, score := range scores {
		rankings = append(rankings, NationRanking{
			Nationality: nat,
			Score:       score,
		})
	}

	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Score > rankings[j].Score
	})

	for i := range rankings {
		rankings[i].Rank = i + 1
	}

	return rankings
}
