package game

import (
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// newTestCollisionSystem creates a CollisionSystem with a fresh SpatialHash
// and inserts the given agents into the spatial hash.
func newTestCollisionSystem(agents map[string]*domain.Agent) *CollisionSystem {
	sh := NewSpatialHash()
	for id, a := range agents {
		sh.Insert(id, a.Position.X, a.Position.Y)
	}
	return NewCollisionSystem(sh)
}

// --- TestProcessAuraCombat ---

func TestProcessAuraCombat(t *testing.T) {
	t.Run("mutual DPS when agents close", func(t *testing.T) {
		// Place two agents within AuraRadius of each other
		a1 := newTestAgentAt("a1", "Agent1", 0, 0)
		a2 := newTestAgentAt("a2", "Agent2", AuraRadius*0.5, 0) // well within aura range

		// Disable grace period
		a1.GracePeriodEnd = 0
		a2.GracePeriodEnd = 0

		agents := map[string]*domain.Agent{
			"a1": a1,
			"a2": a2,
		}
		cs := newTestCollisionSystem(agents)
		startMass1 := a1.Mass
		startMass2 := a2.Mass

		events := cs.ProcessAuraCombat(agents, 1000)

		// Both should have taken damage
		if a1.Mass >= startMass1 {
			t.Errorf("a1 mass should decrease: %v >= %v", a1.Mass, startMass1)
		}
		if a2.Mass >= startMass2 {
			t.Errorf("a2 mass should decrease: %v >= %v", a2.Mass, startMass2)
		}

		// No death events expected (both have plenty of mass)
		if len(events) != 0 {
			t.Errorf("expected 0 death events, got %v", len(events))
		}
	})

	t.Run("no damage when agents far apart", func(t *testing.T) {
		a1 := newTestAgentAt("a1", "Agent1", 0, 0)
		a2 := newTestAgentAt("a2", "Agent2", AuraRadius*3, 0) // way outside aura range

		a1.GracePeriodEnd = 0
		a2.GracePeriodEnd = 0

		agents := map[string]*domain.Agent{
			"a1": a1,
			"a2": a2,
		}
		cs := newTestCollisionSystem(agents)
		startMass1 := a1.Mass
		startMass2 := a2.Mass

		cs.ProcessAuraCombat(agents, 1000)

		if a1.Mass != startMass1 {
			t.Errorf("a1 mass changed when agents far apart: %v != %v", a1.Mass, startMass1)
		}
		if a2.Mass != startMass2 {
			t.Errorf("a2 mass changed when agents far apart: %v != %v", a2.Mass, startMass2)
		}
	})

	t.Run("death event on kill", func(t *testing.T) {
		a1 := newTestAgentAt("a1", "Agent1", 0, 0)
		a2 := newTestAgentAt("a2", "Victim", 10, 0) // very close

		a1.GracePeriodEnd = 0
		a2.GracePeriodEnd = 0
		a2.Mass = 0.5 // very low mass -> will die from aura DPS

		agents := map[string]*domain.Agent{
			"a1": a1,
			"a2": a2,
		}
		cs := newTestCollisionSystem(agents)

		events := cs.ProcessAuraCombat(agents, 1000)

		if len(events) == 0 {
			t.Fatal("expected at least 1 death event")
		}

		found := false
		for _, e := range events {
			if e.VictimID == "a2" && e.KillerID == "a1" && e.DamageSource == domain.DamageSourceAura {
				found = true
			}
		}
		if !found {
			t.Error("expected death event for a2 killed by a1 via aura")
		}
	})

	t.Run("grace period protects target", func(t *testing.T) {
		a1 := newTestAgentAt("a1", "Agent1", 0, 0)
		a2 := newTestAgentAt("a2", "Protected", 10, 0)

		a1.GracePeriodEnd = 0
		a2.GracePeriodEnd = 9999 // far in the future

		agents := map[string]*domain.Agent{
			"a1": a1,
			"a2": a2,
		}
		cs := newTestCollisionSystem(agents)
		startMass2 := a2.Mass

		cs.ProcessAuraCombat(agents, 100) // tick 100 < 9999

		if a2.Mass != startMass2 {
			t.Errorf("grace period should protect: mass %v != %v", a2.Mass, startMass2)
		}
	})
}

// --- TestProcessDashCollisions ---

func TestProcessDashCollisions(t *testing.T) {
	t.Run("boosting attacker deals burst damage", func(t *testing.T) {
		attacker := newTestAgentAt("att", "Attacker", 0, 0)
		target := newTestAgentAt("tgt", "Target", 10, 0) // within hitbox overlap

		attacker.GracePeriodEnd = 0
		target.GracePeriodEnd = 0
		attacker.Boosting = true

		agents := map[string]*domain.Agent{
			"att": attacker,
			"tgt": target,
		}
		cs := newTestCollisionSystem(agents)
		startMass := target.Mass

		cs.ProcessDashCollisions(agents, 1000)

		if target.Mass >= startMass {
			t.Errorf("target should take damage from dash: mass %v >= %v", target.Mass, startMass)
		}
	})

	t.Run("non-boosting attacker no damage", func(t *testing.T) {
		attacker := newTestAgentAt("att", "Attacker", 0, 0)
		target := newTestAgentAt("tgt", "Target", 10, 0)

		attacker.GracePeriodEnd = 0
		target.GracePeriodEnd = 0
		attacker.Boosting = false // NOT boosting

		agents := map[string]*domain.Agent{
			"att": attacker,
			"tgt": target,
		}
		cs := newTestCollisionSystem(agents)
		startMass := target.Mass

		cs.ProcessDashCollisions(agents, 1000)

		if target.Mass != startMass {
			t.Errorf("non-boosting attacker should not deal dash damage: mass %v != %v", target.Mass, startMass)
		}
	})

	t.Run("dash kill generates event", func(t *testing.T) {
		attacker := newTestAgentAt("att", "Attacker", 0, 0)
		target := newTestAgentAt("tgt", "Victim", 10, 0)

		attacker.GracePeriodEnd = 0
		target.GracePeriodEnd = 0
		attacker.Boosting = true
		attacker.Mass = 100.0
		// Dash damage = target.Mass * DashDamageRatio. To guarantee a kill,
		// give the target Cursed Tome stacks to amplify incoming damage above 100%.
		// With 5 cursed stacks: vulnerability = 5*0.20 = 1.00, so effective mult = (1.0 + 1.0) = 2.0
		// Damage dealt = mass * 0.30 * 2.0 = mass * 0.60. Still not enough.
		// Instead, set mass extremely low: 0.001
		// Damage = 0.001 * 0.30 = 0.0003 -> leaves 0.0007. Still alive.
		// The actual solution: ProcessDashCollisions checks target.Mass <= 0 AFTER TakeDamage.
		// With cursed stacks, damage dealt > mass. E.g., 5 cursed: effective = mass * 0.30 * 2.0 = 0.60 * mass > mass if 0.60>1.0 (not).
		// Actually need cursed 5 => +100% vuln, so eff = 0.30 * (1 + 1.0) = 0.60. Still < mass.
		// Let's use berserker synergy on attacker: dash damage x3 => 0.90 * mass. Still < mass.
		// Berserker + cursed on target: 0.90 * (1 + 1.0) = 1.80 * mass => kill!
		attacker.ActiveSynergies = []string{"berserker"}
		target.Mass = 5.0
		target.Build.Tomes[domain.TomeCursed] = 5 // +100% damage taken

		agents := map[string]*domain.Agent{
			"att": attacker,
			"tgt": target,
		}
		cs := newTestCollisionSystem(agents)

		events := cs.ProcessDashCollisions(agents, 1000)

		if len(events) == 0 {
			t.Fatal("expected death event from dash kill")
		}
		if events[0].VictimID != "tgt" || events[0].KillerID != "att" {
			t.Errorf("wrong event: victim=%v killer=%v", events[0].VictimID, events[0].KillerID)
		}
		if events[0].DamageSource != domain.DamageSourceDash {
			t.Errorf("damage source = %v, want dash", events[0].DamageSource)
		}
	})

	t.Run("grace period target is immune to dash", func(t *testing.T) {
		attacker := newTestAgentAt("att", "Attacker", 0, 0)
		target := newTestAgentAt("tgt", "Protected", 10, 0)

		attacker.GracePeriodEnd = 0
		target.GracePeriodEnd = 9999
		attacker.Boosting = true

		agents := map[string]*domain.Agent{
			"att": attacker,
			"tgt": target,
		}
		cs := newTestCollisionSystem(agents)
		startMass := target.Mass

		cs.ProcessDashCollisions(agents, 100)

		if target.Mass != startMass {
			t.Errorf("grace period should protect from dash: mass %v != %v", target.Mass, startMass)
		}
	})
}

// --- TestProcessBoundaryCollisions ---

func TestProcessBoundaryCollisions(t *testing.T) {
	t.Run("agent inside boundary is safe", func(t *testing.T) {
		a := newTestAgentAt("a1", "Inside", 0, 0)
		a.GracePeriodEnd = 0

		agents := map[string]*domain.Agent{"a1": a}
		cs := newTestCollisionSystem(agents)
		startMass := a.Mass

		events := cs.ProcessBoundaryCollisions(agents, ArenaRadius, 1000)

		if a.Mass != startMass {
			t.Errorf("inside agent mass changed: %v != %v", a.Mass, startMass)
		}
		if len(events) != 0 {
			t.Errorf("expected no events for inside agent, got %v", len(events))
		}
	})

	t.Run("agent outside boundary takes damage", func(t *testing.T) {
		a := newTestAgentAt("a1", "Outside", ArenaRadius+100, 0) // outside boundary
		a.GracePeriodEnd = 0

		agents := map[string]*domain.Agent{"a1": a}
		cs := newTestCollisionSystem(agents)
		startMass := a.Mass

		cs.ProcessBoundaryCollisions(agents, ArenaRadius, 1000)

		if a.Mass >= startMass {
			t.Errorf("outside agent should lose mass: %v >= %v", a.Mass, startMass)
		}
	})

	t.Run("boundary death after repeated ticks", func(t *testing.T) {
		// Boundary penalty is a percentage of current mass per tick.
		// With very low mass and many ticks, agent eventually dies due to float precision.
		// For this test, we manually set mass to 0 after verifying penalty applies,
		// to confirm the death event pathway works.
		a := newTestAgentAt("a1", "Dying", ArenaRadius+100, 0)
		a.GracePeriodEnd = 0
		a.Mass = 0.1

		agents := map[string]*domain.Agent{"a1": a}
		cs := newTestCollisionSystem(agents)

		// Apply boundary damage many times until mass is negligible
		for i := 0; i < 5000; i++ {
			cs.ProcessBoundaryCollisions(agents, ArenaRadius, 1000)
			if !a.Alive {
				break
			}
		}

		// Due to exponential decay, mass may never reach exactly 0.
		// Verify mass is very close to 0.
		if a.Mass > 0.0001 {
			t.Errorf("after many boundary ticks, mass should be near 0, got %v", a.Mass)
		}

		// Now test the death event pathway: set mass to 0 and run one more tick
		a.Mass = 0
		a.Alive = true // reset for test
		// The ProcessBoundaryCollisions checks dist > currentRadius first,
		// then penalty = mass * rate = 0, so mass stays 0, then checks mass <= 0 -> death.
		events := cs.ProcessBoundaryCollisions(agents, ArenaRadius, 1000)

		if len(events) == 0 {
			t.Fatal("expected boundary death event")
		}
		if events[0].VictimID != "a1" {
			t.Errorf("victim = %v, want a1", events[0].VictimID)
		}
		if events[0].KillerID != "" {
			t.Errorf("boundary death should have no killer, got %v", events[0].KillerID)
		}
		if events[0].DamageSource != domain.DamageSourceBoundary {
			t.Errorf("damage source = %v, want boundary", events[0].DamageSource)
		}
		if a.Alive {
			t.Error("agent should be dead after boundary kill")
		}
	})

	t.Run("grace period protects from boundary damage", func(t *testing.T) {
		a := newTestAgentAt("a1", "Protected", ArenaRadius+100, 0)
		a.GracePeriodEnd = 9999

		agents := map[string]*domain.Agent{"a1": a}
		cs := newTestCollisionSystem(agents)
		startMass := a.Mass

		cs.ProcessBoundaryCollisions(agents, ArenaRadius, 100) // tick < grace end

		if a.Mass != startMass {
			t.Errorf("grace period should protect from boundary: mass %v != %v", a.Mass, startMass)
		}
	})
}
