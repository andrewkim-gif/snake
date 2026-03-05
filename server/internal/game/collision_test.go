package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestCollision_ProcessAura_BothTakeDamage(t *testing.T) {
	cfg := DefaultArenaConfig()
	hash := NewSpatialHash(cfg.ArenaRadius, 200)
	cs := NewCollisionSystem()

	// Place two agents within aura range (60px)
	a1 := NewAgent("a1", "Agent1", 0, domain.Position{X: 0, Y: 0}, 0)
	a1.InitWithConfig(cfg, 0)
	a1.GracePeriodEnd = 0 // no grace

	a2 := NewAgent("a2", "Agent2", 0, domain.Position{X: 30, Y: 0}, 0)
	a2.InitWithConfig(cfg, 0)
	a2.GracePeriodEnd = 0

	agents := map[string]*Agent{"a1": a1, "a2": a2}

	// Insert into hash
	hash.InsertAgent("a1", a1.Position)
	hash.InsertAgent("a2", a2.Position)

	mass1Before := a1.Mass
	mass2Before := a2.Mass

	cs.ProcessAura(agents, hash, cfg, 1000)

	// Both should have taken damage
	if a1.Mass >= mass1Before {
		t.Error("a1 should have taken aura damage")
	}
	if a2.Mass >= mass2Before {
		t.Error("a2 should have taken aura damage")
	}
}

func TestCollision_ProcessAura_GracePeriodImmunity(t *testing.T) {
	cfg := DefaultArenaConfig()
	hash := NewSpatialHash(cfg.ArenaRadius, 200)
	cs := NewCollisionSystem()

	a1 := NewAgent("a1", "Attacker", 0, domain.Position{X: 0, Y: 0}, 0)
	a1.InitWithConfig(cfg, 0)
	a1.GracePeriodEnd = 0 // no grace

	a2 := NewAgent("a2", "NewPlayer", 0, domain.Position{X: 30, Y: 0}, 0)
	a2.InitWithConfig(cfg, 0)
	a2.GracePeriodEnd = 10000 // has grace period

	agents := map[string]*Agent{"a1": a1, "a2": a2}
	hash.InsertAgent("a1", a1.Position)
	hash.InsertAgent("a2", a2.Position)

	mass2Before := a2.Mass
	cs.ProcessAura(agents, hash, cfg, 100) // tick < grace period

	if a2.Mass != mass2Before {
		t.Error("agent with grace period should not take damage")
	}
}

func TestCollision_ProcessDash(t *testing.T) {
	cfg := DefaultArenaConfig()
	hash := NewSpatialHash(cfg.ArenaRadius, 200)
	cs := NewCollisionSystem()

	a1 := NewAgent("dasher", "Dasher", 0, domain.Position{X: 0, Y: 0}, 0)
	a1.InitWithConfig(cfg, 0)
	a1.Boosting = true
	a1.Mass = 50

	a2 := NewAgent("target", "Target", 0, domain.Position{X: 20, Y: 0}, 0)
	a2.InitWithConfig(cfg, 0)
	a2.Mass = 50

	agents := map[string]*Agent{"dasher": a1, "target": a2}
	hash.InsertAgent("dasher", a1.Position)
	hash.InsertAgent("target", a2.Position)

	mass2Before := a2.Mass
	cs.ProcessDash(agents, hash, cfg)

	if a2.Mass >= mass2Before {
		t.Error("dash target should take damage")
	}
}

func TestCollision_DetectDeaths_MassZero(t *testing.T) {
	cs := NewCollisionSystem()

	a := NewAgent("dead", "DeadGuy", 0, domain.Position{X: 0, Y: 0}, 0)
	a.Mass = 0
	a.Alive = true
	a.LastDamagedBy = "killer1"

	agents := map[string]*Agent{"dead": a}
	deaths := cs.DetectDeaths(agents, 6000)

	if len(deaths) != 1 {
		t.Fatalf("expected 1 death, got %d", len(deaths))
	}
	if deaths[0].AgentID != "dead" {
		t.Error("wrong dead agent ID")
	}
	if deaths[0].KillerID != "killer1" {
		t.Errorf("expected killer 'killer1', got '%s'", deaths[0].KillerID)
	}
}

func TestCollision_DetectDeaths_OutOfBounds(t *testing.T) {
	cs := NewCollisionSystem()

	a := NewAgent("oob", "OutOfBounds", 0, domain.Position{X: 7000, Y: 0}, 0)
	a.Mass = 50
	a.Alive = true

	agents := map[string]*Agent{"oob": a}
	deaths := cs.DetectDeaths(agents, 6000) // 7000 > 6000*1.1 = 6600

	if len(deaths) != 1 {
		t.Fatalf("expected 1 death for out-of-bounds agent, got %d", len(deaths))
	}
	if deaths[0].DamageSource != domain.DamageSourceBoundary {
		t.Errorf("expected boundary damage source, got %s", deaths[0].DamageSource)
	}
}

func TestCollision_ProcessDeaths_CreatesOrbs(t *testing.T) {
	cfg := DefaultArenaConfig()
	om := NewOrbManager(cfg)

	a1 := NewAgent("victim", "Victim", 0, domain.Position{X: 100, Y: 100}, 0)
	a1.Mass = 50
	a1.Alive = true

	a2 := NewAgent("killer", "Killer", 0, domain.Position{X: 200, Y: 200}, 0)
	a2.InitWithConfig(cfg, 0)
	a2.Alive = true

	agents := map[string]*Agent{"victim": a1, "killer": a2}

	deaths := []DeathEvent{
		{AgentID: "victim", KillerID: "killer", DamageSource: domain.DamageSourceAura, VictimMass: 50},
	}

	cs := NewCollisionSystem()
	orbsBefore := om.GetCount()
	cs.ProcessDeaths(deaths, agents, om, 100)

	if a1.Alive {
		t.Error("victim should be dead")
	}
	if a2.Kills != 1 {
		t.Errorf("killer should have 1 kill, got %d", a2.Kills)
	}
	if om.GetCount() <= orbsBefore {
		t.Error("should have created death orbs")
	}
}
