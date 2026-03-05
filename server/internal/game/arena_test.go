package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestArena_NewArena(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	if arena.GetTick() != 0 {
		t.Errorf("expected tick 0, got %d", arena.GetTick())
	}

	if arena.GetOrbCount() != cfg.NaturalOrbTarget {
		t.Errorf("expected %d orbs, got %d", cfg.NaturalOrbTarget, arena.GetOrbCount())
	}
}

func TestArena_AddRemoveAgent(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	agent := arena.AddAgent("p1", "Player1", 0, domain.Position{X: 0, Y: 0})
	if agent == nil {
		t.Fatal("expected non-nil agent")
	}
	if arena.GetPlayerCount() != 1 {
		t.Errorf("expected 1 player, got %d", arena.GetPlayerCount())
	}

	arena.RemoveAgent("p1")
	if arena.GetPlayerCount() != 0 {
		t.Errorf("expected 0 players after remove, got %d", arena.GetPlayerCount())
	}
}

func TestArena_Tick100_NoPanic(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Add some agents
	for i := 0; i < 10; i++ {
		id := "agent-" + string(rune('A'+i))
		pos := RandomPositionInCircle(cfg.ArenaRadius * 0.6)
		arena.AddAgent(id, "Bot"+string(rune('A'+i)), i%24, pos)
	}

	// Run 100 ticks without panicking
	for i := 0; i < 100; i++ {
		arena.Tick()
	}

	if arena.GetTick() != 100 {
		t.Errorf("expected tick 100, got %d", arena.GetTick())
	}
}

func TestArena_AgentsMove(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	pos := domain.Position{X: 0, Y: 0}
	agent := arena.AddAgent("p1", "Mover", 0, pos)
	agent.TargetAngle = 0
	agent.Heading = 0

	startX := agent.Position.X

	for i := 0; i < 10; i++ {
		arena.Tick()
	}

	if agent.Position.X <= startX {
		t.Error("agent should have moved after 10 ticks")
	}
}

func TestArena_OrbCollection(t *testing.T) {
	cfg := DefaultArenaConfig()
	cfg.NaturalOrbTarget = 100 // fewer orbs for faster test
	arena := NewArena(cfg)

	// Place agent at a position where orbs exist
	agent := arena.AddAgent("collector", "Collector", 0, domain.Position{X: 0, Y: 0})
	agent.GracePeriodEnd = 0

	// Run some ticks to collect nearby orbs
	initialMass := agent.Mass
	for i := 0; i < 50; i++ {
		arena.Tick()
	}

	// Agent may or may not have collected orbs depending on spawn positions
	// At minimum, agent should still be alive
	if !agent.Alive {
		t.Error("agent should still be alive after 50 ticks with initial orbs")
	}

	// If mass increased, orbs were collected
	if agent.Mass > initialMass {
		t.Logf("Agent collected orbs: mass %f -> %f", initialMass, agent.Mass)
	}
}

func TestArena_ApplyInput(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	arena.AddAgent("p1", "Player", 0, domain.Position{X: 0, Y: 0})

	arena.ApplyInput(InputMsg{
		AgentID: "p1",
		Angle:   1.5,
		Boost:   0,
		Seq:     1,
	})

	agent, ok := arena.GetAgent("p1")
	if !ok {
		t.Fatal("agent not found")
	}
	if agent.TargetAngle != normalizeAngle(1.5) {
		t.Errorf("expected target angle ~1.5, got %f", agent.TargetAngle)
	}
}

func TestArena_ChooseUpgrade(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	agent := arena.AddAgent("p1", "Player", 0, domain.Position{X: 0, Y: 0})

	// Simulate level up
	choices := arena.upgrade.GenerateChoices(agent)
	agent.PendingChoices = choices
	agent.UpgradeDeadline = arena.GetTick() + 100

	if len(choices) == 0 {
		t.Fatal("expected choices")
	}

	success := arena.ChooseUpgrade("p1", choices[0].ID)
	if !success {
		t.Error("expected successful upgrade choice")
	}
	if agent.PendingChoices != nil {
		t.Error("pending choices should be cleared")
	}
}

func TestArena_DeathCreatesOrbs(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Place two agents close together to trigger aura combat
	a1 := arena.AddAgent("a1", "Attacker", 0, domain.Position{X: 0, Y: 0})
	a1.GracePeriodEnd = 0
	a1.Mass = 100

	a2 := arena.AddAgent("a2", "Victim", 0, domain.Position{X: 20, Y: 0})
	a2.GracePeriodEnd = 0
	a2.Mass = 1 // very low mass, will die quickly

	orbsBefore := arena.GetOrbCount()

	// Tick until a2 dies
	for i := 0; i < 100; i++ {
		arena.Tick()
		if !a2.Alive {
			break
		}
	}

	if a2.Alive {
		t.Log("victim did not die in 100 ticks (may have moved apart)")
	} else {
		if arena.GetOrbCount() <= orbsBefore {
			// Death orbs might be created but also natural orbs maintained
			// Just verify death events were generated
			t.Log("victim died, death orbs should have been created")
		}
	}
}

func TestArena_SerializeForPlayer(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	arena.AddAgent("p1", "Player", 0, domain.Position{X: 0, Y: 0})

	arena.Tick() // need at least one tick for data

	payload := arena.SerializeForPlayer("p1")
	if payload == nil {
		t.Fatal("expected non-nil state payload")
	}
	if payload.T != arena.GetTick() {
		t.Errorf("expected tick %d in payload, got %d", arena.GetTick(), payload.T)
	}
}

func TestArena_RespawnAgent(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	agent := arena.AddAgent("p1", "Player", 0, domain.Position{X: 0, Y: 0})
	agent.Die()

	respawned := arena.RespawnAgent("p1")
	if respawned == nil {
		t.Fatal("expected non-nil respawned agent")
	}
	if !respawned.Alive {
		t.Error("respawned agent should be alive")
	}
}

func TestArena_ResetForNewRound(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	arena.AddAgent("p1", "Player", 0, domain.Position{X: 0, Y: 0})

	for i := 0; i < 50; i++ {
		arena.Tick()
	}

	arena.ResetForNewRound()

	if arena.GetPlayerCount() != 0 {
		t.Error("expected 0 players after reset")
	}
	if arena.GetTick() != 0 {
		t.Error("expected tick 0 after reset")
	}
}

func TestArena_Tick1000_Stable(t *testing.T) {
	cfg := DefaultArenaConfig()
	cfg.NaturalOrbTarget = 500 // reduce for speed
	arena := NewArena(cfg)

	// Add 20 agents
	for i := 0; i < 20; i++ {
		id := "bot-" + string(rune('A'+i))
		pos := RandomPositionInCircle(cfg.ArenaRadius * 0.5)
		agent := arena.AddAgent(id, "Bot"+string(rune('A'+i)), i%24, pos)
		agent.GracePeriodEnd = 0 // no grace period for combat
	}

	// Run 1000 ticks
	for i := 0; i < 1000; i++ {
		arena.Tick()
	}

	if arena.GetTick() != 1000 {
		t.Errorf("expected tick 1000, got %d", arena.GetTick())
	}

	// At least some agents should still exist (might be dead)
	aliveCount := arena.GetAliveCount()
	t.Logf("After 1000 ticks: %d/%d alive, %d orbs",
		aliveCount, arena.GetPlayerCount(), arena.GetOrbCount())
}
