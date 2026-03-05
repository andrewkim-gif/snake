package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestSerializer_FarAgentExcluded(t *testing.T) {
	cfg := DefaultArenaConfig()
	serializer := NewStateSerializer()

	agents := make(map[string]*Agent)

	// Player at center
	player := NewAgent("player", "Player", 0, domain.Position{X: 0, Y: 0}, 0)
	player.InitWithConfig(cfg, 0)
	agents["player"] = player

	// Nearby agent (should be included)
	near := NewAgent("near", "Near", 0, domain.Position{X: 100, Y: 100}, 0)
	near.InitWithConfig(cfg, 0)
	agents["near"] = near

	// Far agent (should be excluded)
	far := NewAgent("far", "Far", 0, domain.Position{X: 5000, Y: 5000}, 0)
	far.InitWithConfig(cfg, 0)
	agents["far"] = far

	orbs := make(map[uint64]*domain.Orb)
	leaderboard := []domain.LeaderEntry{}

	payload := serializer.SerializeForPlayer("player", agents, orbs, leaderboard, 100, cfg.ArenaRadius)

	if payload == nil {
		t.Fatal("expected non-nil payload")
	}

	// Check that near agent is included but far agent is excluded
	foundNear := false
	foundFar := false
	for _, s := range payload.S {
		if s.I == "near" {
			foundNear = true
		}
		if s.I == "far" {
			foundFar = true
		}
	}

	if !foundNear {
		t.Error("nearby agent should be in payload")
	}
	if foundFar {
		t.Error("far agent should NOT be in payload")
	}
}

func TestSerializer_FarOrbExcluded(t *testing.T) {
	cfg := DefaultArenaConfig()
	serializer := NewStateSerializer()

	agents := make(map[string]*Agent)
	player := NewAgent("player", "Player", 0, domain.Position{X: 0, Y: 0}, 0)
	player.InitWithConfig(cfg, 0)
	agents["player"] = player

	orbs := map[uint64]*domain.Orb{
		1: {ID: 1, Position: domain.Position{X: 50, Y: 50}, Value: 1, Type: domain.OrbNatural},
		2: {ID: 2, Position: domain.Position{X: 5000, Y: 5000}, Value: 1, Type: domain.OrbNatural},
	}

	payload := serializer.SerializeForPlayer("player", agents, orbs, nil, 100, cfg.ArenaRadius)

	if payload == nil {
		t.Fatal("expected non-nil payload")
	}

	nearFound := false
	farFound := false
	for _, o := range payload.O {
		if o.X == 50 && o.Y == 50 {
			nearFound = true
		}
		if o.X == 5000 && o.Y == 5000 {
			farFound = true
		}
	}

	if !nearFound {
		t.Error("nearby orb should be in payload")
	}
	if farFound {
		t.Error("far orb should NOT be in payload")
	}
}

func TestSerializer_NonExistentPlayer(t *testing.T) {
	serializer := NewStateSerializer()
	agents := make(map[string]*Agent)
	orbs := make(map[uint64]*domain.Orb)

	payload := serializer.SerializeForPlayer("nonexistent", agents, orbs, nil, 100, 6000)
	if payload != nil {
		t.Error("expected nil payload for non-existent player")
	}
}

func TestSerializer_Minimap(t *testing.T) {
	cfg := DefaultArenaConfig()
	serializer := NewStateSerializer()

	agents := make(map[string]*Agent)
	for i := 0; i < 5; i++ {
		id := "a" + string(rune('0'+i))
		a := NewAgent(id, "Agent", 0, domain.Position{X: float64(i * 100), Y: 0}, 0)
		a.InitWithConfig(cfg, 0)
		agents[id] = a
	}

	minimap := serializer.SerializeMinimap("a0", agents, cfg.ArenaRadius)

	if len(minimap.Snakes) != 5 {
		t.Errorf("expected 5 minimap entries, got %d", len(minimap.Snakes))
	}

	meCount := 0
	for _, s := range minimap.Snakes {
		if s.Me {
			meCount++
		}
	}
	if meCount != 1 {
		t.Errorf("expected 1 'me' entry, got %d", meCount)
	}

	if minimap.Boundary != cfg.ArenaRadius {
		t.Errorf("expected boundary %f, got %f", cfg.ArenaRadius, minimap.Boundary)
	}
}

func TestSerializer_DeathInfo(t *testing.T) {
	cfg := DefaultArenaConfig()
	serializer := NewStateSerializer()

	agents := make(map[string]*Agent)
	a := NewAgent("victim", "Victim", 0, domain.Position{X: 0, Y: 0}, 100)
	a.InitWithConfig(cfg, 100)
	a.Score = 50
	a.Kills = 3
	a.Level = 5
	a.LastDamagedBy = "killer1"
	a.Alive = false
	agents["victim"] = a

	leaderboard := []domain.LeaderEntry{}

	info := serializer.SerializeDeathInfo("victim", agents, leaderboard, 300)

	if info == nil {
		t.Fatal("expected non-nil death info")
	}
	if info.Score != 50 {
		t.Errorf("expected score 50, got %d", info.Score)
	}
	if info.Kills != 3 {
		t.Errorf("expected kills 3, got %d", info.Kills)
	}
	if info.Killer != "killer1" {
		t.Errorf("expected killer 'killer1', got '%s'", info.Killer)
	}
	if info.Level != 5 {
		t.Errorf("expected level 5, got %d", info.Level)
	}
}
