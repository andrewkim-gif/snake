package game

import (
	"sort"

	"github.com/to-nexus/snake-server/internal/domain"
)

// Leaderboard maintains a sorted top-N list of agents by score.
type Leaderboard struct {
	entries []domain.LeaderEntry
	maxSize int
}

// NewLeaderboard creates a new leaderboard with a max size.
func NewLeaderboard(maxSize int) *Leaderboard {
	if maxSize <= 0 {
		maxSize = 10
	}
	return &Leaderboard{
		entries: make([]domain.LeaderEntry, 0, maxSize),
		maxSize: maxSize,
	}
}

// Update rebuilds the leaderboard from the current agents map.
func (lb *Leaderboard) Update(agents map[string]*Agent) {
	lb.entries = lb.entries[:0]

	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		lb.entries = append(lb.entries, domain.LeaderEntry{
			ID:    agent.ID,
			Name:  agent.Name,
			Score: agent.Score,
			Kills: agent.Kills,
			Rank:  0,
		})
	}

	// Sort by score descending
	sort.Slice(lb.entries, func(i, j int) bool {
		return lb.entries[i].Score > lb.entries[j].Score
	})

	// Assign ranks and truncate to maxSize
	if len(lb.entries) > lb.maxSize {
		lb.entries = lb.entries[:lb.maxSize]
	}

	for i := range lb.entries {
		lb.entries[i].Rank = i + 1
	}
}

// GetEntries returns the current leaderboard entries.
func (lb *Leaderboard) GetEntries() []domain.LeaderEntry {
	return lb.entries
}

// GetRank returns the rank of a specific player, or totalPlayers if not in top-N.
func (lb *Leaderboard) GetRank(playerID string, totalPlayers int) int {
	for _, e := range lb.entries {
		if e.ID == playerID {
			return e.Rank
		}
	}
	return totalPlayers
}
