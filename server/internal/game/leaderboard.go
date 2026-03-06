package game

import (
	"sort"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// Leaderboard maintains a sorted list of top agents by mass.
type Leaderboard struct {
	entries []domain.LeaderboardEntry
}

// NewLeaderboard creates a new empty Leaderboard.
func NewLeaderboard() *Leaderboard {
	return &Leaderboard{
		entries: make([]domain.LeaderboardEntry, 0, LeaderboardSize),
	}
}

// Update recalculates the leaderboard from current agent states.
// Should be called at LeaderboardUpdateInterval (1Hz).
func (lb *Leaderboard) Update(agents map[string]*domain.Agent) {
	// Collect all alive agents
	type agentScore struct {
		id    string
		name  string
		mass  float64
		kills int
		level int
	}

	alive := make([]agentScore, 0, len(agents))
	for _, a := range agents {
		if a.Alive {
			alive = append(alive, agentScore{
				id:    a.ID,
				name:  a.Name,
				mass:  a.Mass,
				kills: a.Kills,
				level: a.Level,
			})
		}
	}

	// Sort by mass descending
	sort.Slice(alive, func(i, j int) bool {
		if alive[i].mass != alive[j].mass {
			return alive[i].mass > alive[j].mass
		}
		return alive[i].kills > alive[j].kills
	})

	// Take top N
	top := LeaderboardSize
	if len(alive) < top {
		top = len(alive)
	}

	lb.entries = make([]domain.LeaderboardEntry, top)
	for i := 0; i < top; i++ {
		lb.entries[i] = domain.LeaderboardEntry{
			ID:    alive[i].id,
			Name:  alive[i].name,
			Score: int(alive[i].mass),
			Kills: alive[i].kills,
			Level: alive[i].level,
		}
	}
}

// GetTop returns the current top leaderboard entries.
func (lb *Leaderboard) GetTop() []domain.LeaderboardEntry {
	return lb.entries
}

// GetRank returns the 1-indexed rank for the given agent, or 0 if not ranked.
func (lb *Leaderboard) GetRank(agentID string) int {
	for i, e := range lb.entries {
		if e.ID == agentID {
			return i + 1
		}
	}
	return 0
}

// GetFinalRanking returns a full ranking of all agents (alive first by mass, then dead).
// Used for round-end results.
func (lb *Leaderboard) GetFinalRanking(agents map[string]*domain.Agent) []domain.LeaderboardEntry {
	type ranked struct {
		entry domain.LeaderboardEntry
		alive bool
		mass  float64
	}

	all := make([]ranked, 0, len(agents))
	for _, a := range agents {
		all = append(all, ranked{
			entry: domain.LeaderboardEntry{
				ID:    a.ID,
				Name:  a.Name,
				Score: int(a.Mass) + a.Kills*100, // composite score
				Kills: a.Kills,
				Level: a.Level,
			},
			alive: a.Alive,
			mass:  a.Mass,
		})
	}

	// Sort: alive first (by mass desc), then dead (by score desc)
	sort.Slice(all, func(i, j int) bool {
		if all[i].alive != all[j].alive {
			return all[i].alive
		}
		if all[i].alive {
			return all[i].mass > all[j].mass
		}
		return all[i].entry.Score > all[j].entry.Score
	})

	result := make([]domain.LeaderboardEntry, len(all))
	for i, r := range all {
		result[i] = r.entry
	}
	return result
}

// GetAgentRankInFinal returns the 1-indexed rank for an agent in the final ranking.
func (lb *Leaderboard) GetAgentRankInFinal(agents map[string]*domain.Agent, agentID string) int {
	final := lb.GetFinalRanking(agents)
	for i, e := range final {
		if e.ID == agentID {
			return i + 1
		}
	}
	return len(agents)
}

// Reset clears the leaderboard.
func (lb *Leaderboard) Reset() {
	lb.entries = lb.entries[:0]
}
