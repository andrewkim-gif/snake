package game

import (
	"fmt"
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestLeaderboard_Top10(t *testing.T) {
	lb := NewLeaderboard(10)

	agents := make(map[string]*Agent)
	for i := 0; i < 20; i++ {
		id := fmt.Sprintf("agent-%d", i)
		a := NewAgent(id, fmt.Sprintf("Player%d", i), 0, domain.Position{X: float64(i * 100), Y: 0}, 0)
		a.Mass = float64((i + 1) * 10) // masses: 10, 20, ..., 200
		a.Score = int(a.Mass)
		a.Alive = true
		agents[id] = a
	}

	lb.Update(agents)
	entries := lb.GetEntries()

	if len(entries) != 10 {
		t.Fatalf("expected 10 entries, got %d", len(entries))
	}

	// Top entry should be agent-19 (mass=200)
	if entries[0].Name != "Player19" {
		t.Errorf("expected top player 'Player19', got '%s'", entries[0].Name)
	}
	if entries[0].Score != 200 {
		t.Errorf("expected top score 200, got %d", entries[0].Score)
	}
	if entries[0].Rank != 1 {
		t.Errorf("expected rank 1, got %d", entries[0].Rank)
	}

	// Last entry should be agent-10 (mass=110)
	if entries[9].Rank != 10 {
		t.Errorf("expected rank 10, got %d", entries[9].Rank)
	}
}

func TestLeaderboard_SortOrder(t *testing.T) {
	lb := NewLeaderboard(5)

	agents := make(map[string]*Agent)
	scores := []int{50, 100, 25, 75, 10}
	for i, score := range scores {
		id := fmt.Sprintf("a%d", i)
		a := NewAgent(id, fmt.Sprintf("P%d", i), 0, domain.Position{}, 0)
		a.Mass = float64(score)
		a.Score = score
		a.Alive = true
		agents[id] = a
	}

	lb.Update(agents)
	entries := lb.GetEntries()

	for i := 1; i < len(entries); i++ {
		if entries[i].Score > entries[i-1].Score {
			t.Errorf("leaderboard not sorted: entry %d score %d > entry %d score %d",
				i, entries[i].Score, i-1, entries[i-1].Score)
		}
	}
}

func TestLeaderboard_ExcludesDead(t *testing.T) {
	lb := NewLeaderboard(10)

	agents := make(map[string]*Agent)

	alive := NewAgent("alive", "Alive", 0, domain.Position{}, 0)
	alive.Mass = 100
	alive.Score = 100
	alive.Alive = true
	agents["alive"] = alive

	dead := NewAgent("dead", "Dead", 0, domain.Position{}, 0)
	dead.Mass = 200
	dead.Score = 200
	dead.Alive = false
	agents["dead"] = dead

	lb.Update(agents)
	entries := lb.GetEntries()

	if len(entries) != 1 {
		t.Fatalf("expected 1 entry (alive only), got %d", len(entries))
	}
	if entries[0].ID != "alive" {
		t.Errorf("expected alive agent, got %s", entries[0].ID)
	}
}

func TestLeaderboard_GetRank(t *testing.T) {
	lb := NewLeaderboard(10)

	agents := make(map[string]*Agent)
	for i := 0; i < 5; i++ {
		id := fmt.Sprintf("a%d", i)
		a := NewAgent(id, fmt.Sprintf("P%d", i), 0, domain.Position{}, 0)
		a.Mass = float64((i + 1) * 10)
		a.Score = int(a.Mass)
		a.Alive = true
		agents[id] = a
	}

	lb.Update(agents)

	// a4 has highest score (50) → rank 1
	rank := lb.GetRank("a4", 5)
	if rank != 1 {
		t.Errorf("expected rank 1 for top scorer, got %d", rank)
	}

	// Non-existent player → total players
	rank = lb.GetRank("nonexistent", 5)
	if rank != 5 {
		t.Errorf("expected rank 5 for missing player, got %d", rank)
	}
}
