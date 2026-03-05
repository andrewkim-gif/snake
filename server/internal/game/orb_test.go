package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestOrbManager_Initialize(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)
	om.Initialize()

	if om.GetCount() != cfg.NaturalOrbTarget {
		t.Errorf("expected %d orbs after init, got %d", cfg.NaturalOrbTarget, om.GetCount())
	}
}

func TestOrbManager_SpawnDeathOrbs(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	before := om.GetCount()
	om.SpawnDeathOrbs(domain.Position{X: 100, Y: 100}, 60, 100)

	after := om.GetCount()
	if after <= before {
		t.Errorf("expected more orbs after death spawn, before=%d, after=%d", before, after)
	}

	// mass=60 → floor(60/3)=20, clamped to [5, 15] → 15 orbs
	expectedOrbs := 15
	if after-before != expectedOrbs {
		t.Errorf("expected %d death orbs from mass=60, got %d", expectedOrbs, after-before)
	}
}

func TestOrbManager_SpawnDeathOrbs_ZeroMass(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	before := om.GetCount()
	om.SpawnDeathOrbs(domain.Position{X: 0, Y: 0}, 0, 100)

	if om.GetCount() != before {
		t.Error("should not spawn orbs for zero mass")
	}
}

func TestOrbManager_Collect(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	// Manually create an orb at a known position
	om.SpawnDeathOrbs(domain.Position{X: 50, Y: 50}, 30, 100)

	// Collect near the death position
	collected := om.Collect(domain.Position{X: 50, Y: 50}, 100)

	if len(collected) == 0 {
		t.Error("expected to collect some orbs near death position")
	}
}

func TestOrbManager_Collect_OutOfRange(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	om.SpawnDeathOrbs(domain.Position{X: 1000, Y: 1000}, 30, 100)

	// Try to collect far from the orbs
	collected := om.Collect(domain.Position{X: -1000, Y: -1000}, 20)

	if len(collected) != 0 {
		t.Errorf("should not collect orbs out of range, got %d", len(collected))
	}
}

func TestOrbManager_Maintain(t *testing.T) {
	cfg := DefaultArenaConfig()
	cfg.NaturalOrbTarget = 100
	om := NewOrbManager(cfg)

	// Start with 0 orbs
	om.Maintain(1)

	// Should have spawned up to 10 orbs (max per tick)
	if om.GetCount() > 10 {
		t.Errorf("should spawn at most 10 orbs per tick, got %d", om.GetCount())
	}
	if om.GetCount() == 0 {
		t.Error("should have spawned some orbs")
	}
}

func TestOrbManager_CleanExpired(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	// Create death orbs at tick 0 with lifetime 600
	om.SpawnDeathOrbs(domain.Position{X: 0, Y: 0}, 30, 0)
	count := om.GetCount()
	if count == 0 {
		t.Fatal("should have orbs")
	}

	// Clean at tick 500 — should not expire yet
	om.CleanExpired(500)
	if om.GetCount() != count {
		t.Error("orbs should not expire at tick 500")
	}

	// Clean at tick 700 — should expire (lifetime=600, spawned at 0)
	om.CleanExpired(700)
	if om.GetCount() != 0 {
		t.Errorf("all death orbs should be expired at tick 700, got %d", om.GetCount())
	}
}

func TestOrbManager_InsertAllToHash(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	om.SpawnDeathOrbs(domain.Position{X: 0, Y: 0}, 30, 0)

	hash := NewSpatialHash(cfg.ArenaRadius, 200)
	om.InsertAllToHash(hash)

	// Query orbs near the death position
	results := hash.QueryOrbs(domain.Position{X: 0, Y: 0}, 100)
	if len(results) == 0 {
		t.Error("should find orbs in spatial hash after InsertAllToHash")
	}
}
