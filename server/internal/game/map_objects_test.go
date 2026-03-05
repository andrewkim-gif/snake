package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestMapObjectManager_DefaultLayout(t *testing.T) {
	m := NewMapObjectManager(6000)
	objects := m.GetObjects()

	// Expect: 1 altar + 3 shrines + 2 springs + 4 gates = 10
	if len(objects) != 10 {
		t.Fatalf("expected 10 map objects, got %d", len(objects))
	}

	counts := make(map[MapObjectType]int)
	for _, obj := range objects {
		counts[obj.GetType()]++
	}
	if counts[MapObjectAltar] != 1 {
		t.Errorf("expected 1 altar, got %d", counts[MapObjectAltar])
	}
	if counts[MapObjectShrine] != 3 {
		t.Errorf("expected 3 shrines, got %d", counts[MapObjectShrine])
	}
	if counts[MapObjectSpring] != 2 {
		t.Errorf("expected 2 springs, got %d", counts[MapObjectSpring])
	}
	if counts[MapObjectGate] != 4 {
		t.Errorf("expected 4 gates, got %d", counts[MapObjectGate])
	}
}

func TestShrine_BuffApplication(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Add agent near a shrine
	shrine := arena.mapObjects.GetObjects()[1] // first shrine (index 0 is altar)
	shrinePos := shrine.GetPosition()
	agent := arena.AddAgent("test", "Tester", 0, shrinePos)

	// Run a tick to process interactions
	arena.Tick()

	// Check: agent should have the shrine XP buff
	if !agent.HasEffect(ShrineBuff) {
		t.Error("expected agent to have shrine XP buff")
	}

	// Check: shrine should now be inactive (on cooldown)
	if shrine.IsActive() {
		t.Error("expected shrine to be on cooldown after activation")
	}
}

func TestSpring_HealingInRange(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Find a spring object
	var spring *Spring
	for _, obj := range arena.mapObjects.GetObjects() {
		if s, ok := obj.(*Spring); ok {
			spring = s
			break
		}
	}
	if spring == nil {
		t.Fatal("no spring found in map objects")
	}

	springPos := spring.GetPosition()
	agent := arena.AddAgent("test", "Tester", 0, springPos)
	initialMass := agent.Mass

	// Run a tick
	arena.Tick()

	// Agent should have gained mass from healing spring
	if agent.Mass <= initialMass {
		t.Errorf("expected mass increase from spring healing, got %f (was %f)", agent.Mass, initialMass)
	}
}

func TestAltar_SacrificeAndLevelUp(t *testing.T) {
	// Test altar directly without full arena tick (to isolate from orb collection side effects)
	altarPos := domain.Position{X: 0, Y: 0}
	altar := NewAltar("test_altar", altarPos)

	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Add agent at altar position
	agent := arena.AddAgent("test", "Tester", 0, domain.Position{X: 5000, Y: 5000}) // far away
	agent.Mass = 100
	initialLevel := agent.Level
	initialMass := agent.Mass

	// Directly trigger altar
	result := altar.OnEnter(agent, arena)
	if !result {
		t.Error("expected altar interaction to succeed")
	}

	// Agent should have lost 50% mass
	expectedMass := initialMass * (1 - AltarMassSacrifice)
	if agent.Mass != expectedMass {
		t.Errorf("expected mass %f after altar, got %f", expectedMass, agent.Mass)
	}

	// Agent should have gained 2 levels
	if agent.Level != initialLevel+AltarLevelUpReward {
		t.Errorf("expected level %d, got %d", initialLevel+AltarLevelUpReward, agent.Level)
	}

	// Altar should be used (no longer active)
	if altar.IsActive() {
		t.Error("expected altar to be consumed after use")
	}

	// Second use should fail
	agent.Mass = 100
	result2 := altar.OnEnter(agent, arena)
	if result2 {
		t.Error("expected altar second use to fail (once per round)")
	}
}

func TestGate_Teleport(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Find a gate
	var gate *Gate
	for _, obj := range arena.mapObjects.GetObjects() {
		if g, ok := obj.(*Gate); ok {
			gate = g
			break
		}
	}
	if gate == nil {
		t.Fatal("no gate found")
	}

	gatePos := gate.GetPosition()
	agent := arena.AddAgent("test", "Tester", 0, gatePos)
	originalPos := agent.Position

	// Run tick
	arena.Tick()

	// Agent should have been teleported
	if agent.Position.X == originalPos.X && agent.Position.Y == originalPos.Y {
		t.Error("expected agent to be teleported to a new position")
	}

	// Agent should have speed buff
	if !agent.HasEffect(domain.EffectSpeed) {
		t.Error("expected agent to have speed buff after gate teleport")
	}

	// Gate should be on cooldown
	if gate.IsActive() {
		t.Error("expected gate to be on cooldown")
	}
}

func TestShrine_CooldownRecovery(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	shrine := arena.mapObjects.GetObjects()[1]
	shrinePos := shrine.GetPosition()
	agent := arena.AddAgent("test", "Tester", 0, shrinePos)

	// Activate shrine
	arena.Tick()
	if shrine.IsActive() {
		t.Error("shrine should be on cooldown")
	}

	// Move agent away
	agent.Position = domain.Position{X: 5000, Y: 5000}

	// Simulate cooldown ticks
	for i := 0; i < ShrineCooldownTicks+1; i++ {
		arena.Tick()
	}

	// Shrine should be active again
	if !shrine.IsActive() {
		t.Error("shrine should be active after cooldown")
	}
}

func TestMapObjectManager_Serialization(t *testing.T) {
	m := NewMapObjectManager(6000)
	states := m.GetStates()

	if len(states) != 10 {
		t.Fatalf("expected 10 states, got %d", len(states))
	}

	for _, s := range states {
		if s.ID == "" {
			t.Error("map object state has empty ID")
		}
		if s.Type == "" {
			t.Error("map object state has empty Type")
		}
	}
}

func TestMapObjectManager_Reset(t *testing.T) {
	m := NewMapObjectManager(6000)

	// Use altar
	altar := m.GetObjects()[0].(*Altar)
	altar.used = true
	altar.active = false

	// Reset
	m.Reset(6000)

	// Altar should be fresh
	newAltar := m.GetObjects()[0]
	if !newAltar.IsActive() {
		t.Error("expected altar to be active after reset")
	}
}
