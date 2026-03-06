package game

import (
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// --- TestNewArena ---

func TestNewArena(t *testing.T) {
	t.Run("initial state", func(t *testing.T) {
		a := NewArena()

		if a.GetTick() != 0 {
			t.Errorf("tick = %v, want 0", a.GetTick())
		}
		if a.AgentCount() != 0 {
			t.Errorf("agent count = %v, want 0", a.AgentCount())
		}
		if a.IsRunning() {
			t.Error("arena should not be running initially")
		}
		if a.GetOrbManager() == nil {
			t.Error("orb manager should not be nil")
		}
		if a.GetLeaderboard() == nil {
			t.Error("leaderboard should not be nil")
		}
		if a.GetMapObjects() == nil {
			t.Error("map objects should not be nil")
		}
	})

	t.Run("initial radius", func(t *testing.T) {
		a := NewArena()
		radius := a.GetCurrentRadius()
		if radius != ArenaRadius {
			t.Errorf("radius = %v, want %v", radius, ArenaRadius)
		}
	})
}

// --- TestAddRemoveAgent ---

func TestAddRemoveAgent(t *testing.T) {
	t.Run("add agent", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")

		a.AddAgent(agent)

		if a.AgentCount() != 1 {
			t.Errorf("agent count = %v, want 1", a.AgentCount())
		}

		retrieved, ok := a.GetAgent("p1")
		if !ok {
			t.Fatal("GetAgent should find p1")
		}
		if retrieved.Name != "Player1" {
			t.Errorf("name = %v, want Player1", retrieved.Name)
		}
	})

	t.Run("remove agent", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		a.AddAgent(agent)
		a.RemoveAgent("p1")

		if a.AgentCount() != 0 {
			t.Errorf("agent count = %v, want 0 after removal", a.AgentCount())
		}

		_, ok := a.GetAgent("p1")
		if ok {
			t.Error("GetAgent should not find removed agent")
		}
	})

	t.Run("multiple agents", func(t *testing.T) {
		a := NewArena()
		for i := 0; i < 10; i++ {
			id := "p" + string(rune('0'+i))
			agent := newTestAgent(id, "Player"+string(rune('0'+i)))
			a.AddAgent(agent)
		}

		if a.AgentCount() != 10 {
			t.Errorf("agent count = %v, want 10", a.AgentCount())
		}
	})

	t.Run("remove nonexistent agent is safe", func(t *testing.T) {
		a := NewArena()
		a.RemoveAgent("nonexistent") // should not panic
	})

	t.Run("GetAgents returns all agents", func(t *testing.T) {
		a := NewArena()
		a.AddAgent(newTestAgent("p1", "A"))
		a.AddAgent(newTestAgent("p2", "B"))
		a.AddAgent(newTestAgent("p3", "C"))

		agents := a.GetAgents()
		if len(agents) != 3 {
			t.Errorf("GetAgents returned %v agents, want 3", len(agents))
		}
	})
}

// --- TestProcessTick ---

func TestProcessTick(t *testing.T) {
	t.Run("tick increments", func(t *testing.T) {
		a := NewArena()
		a.AddAgent(newTestAgent("p1", "Player1"))

		a.processTick()

		if a.GetTick() != 1 {
			t.Errorf("tick = %v, want 1", a.GetTick())
		}

		a.processTick()
		if a.GetTick() != 2 {
			t.Errorf("tick = %v, want 2", a.GetTick())
		}
	})

	t.Run("agents move after tick", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		agent.Heading = 0
		agent.TargetAngle = 0
		a.AddAgent(agent)

		startX := agent.Position.X
		a.processTick()

		if agent.Position.X <= startX {
			t.Errorf("agent should move: X %v <= startX %v", agent.Position.X, startX)
		}
	})

	t.Run("event handler is called", func(t *testing.T) {
		a := NewArena()

		// Place two agents close together to generate events
		a1 := newTestAgentAt("a1", "Agent1", 0, 0)
		a2 := newTestAgentAt("a2", "Agent2", 10, 0)
		a1.GracePeriodEnd = 0
		a2.GracePeriodEnd = 0
		a2.Mass = 0.001 // will die from aura

		a.AddAgent(a1)
		a.AddAgent(a2)

		// Update spatial hash positions
		a.spatialHash.Update("a1", 0, 0)
		a.spatialHash.Update("a2", 10, 0)

		eventsCalled := false
		a.EventHandler = func(events []ArenaEvent) {
			if len(events) > 0 {
				eventsCalled = true
			}
		}

		a.processTick()

		if !eventsCalled {
			t.Error("EventHandler should be called when events are generated")
		}
	})
}

// --- TestHandleInput ---

func TestHandleInput(t *testing.T) {
	t.Run("applies input to agent", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		a.AddAgent(agent)

		a.HandleInput("p1", 1.5, true)

		// The agent's target angle should be set
		retrieved, _ := a.GetAgent("p1")
		if retrieved.TargetAngle != 1.5 {
			t.Errorf("targetAngle = %v, want 1.5", retrieved.TargetAngle)
		}
		if !retrieved.Boosting {
			t.Error("agent should be boosting")
		}
	})

	t.Run("ignores input for nonexistent agent", func(t *testing.T) {
		a := NewArena()
		a.HandleInput("nonexistent", 1.0, true) // should not panic
	})

	t.Run("ignores input for dead agent", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		agent.Alive = false
		a.AddAgent(agent)

		a.HandleInput("p1", 2.0, true)
		if agent.TargetAngle != 0 {
			t.Errorf("dead agent target angle changed: %v", agent.TargetAngle)
		}
	})
}

// --- TestChooseUpgrade ---

func TestChooseUpgrade(t *testing.T) {
	t.Run("applies chosen upgrade", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		agent.PendingChoices = []domain.UpgradeChoice{
			{ID: "tome_xp_1", Type: "tome", TomeType: domain.TomeXP},
			{ID: "tome_speed_1", Type: "tome", TomeType: domain.TomeSpeed},
			{ID: "tome_damage_1", Type: "tome", TomeType: domain.TomeDamage},
		}
		agent.UpgradeDeadline = 9999
		a.AddAgent(agent)

		a.ChooseUpgrade("p1", 1) // choose Speed Tome

		if agent.Build.Tomes[domain.TomeSpeed] != 1 {
			t.Errorf("speed tome = %v, want 1", agent.Build.Tomes[domain.TomeSpeed])
		}
		if agent.PendingChoices != nil {
			t.Error("pending choices should be cleared after selection")
		}
	})

	t.Run("rejects invalid index", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		agent.PendingChoices = []domain.UpgradeChoice{
			{ID: "tome_xp_1", Type: "tome", TomeType: domain.TomeXP},
		}
		a.AddAgent(agent)

		a.ChooseUpgrade("p1", 5) // invalid index

		// PendingChoices should remain unchanged
		if len(agent.PendingChoices) != 1 {
			t.Error("invalid index should not modify pending choices")
		}
	})

	t.Run("rejects when no pending choices", func(t *testing.T) {
		a := NewArena()
		agent := newTestAgent("p1", "Player1")
		a.AddAgent(agent)

		a.ChooseUpgrade("p1", 0) // no pending choices, should be a no-op
		// Should not panic
	})
}

// --- TestAliveCount ---

func TestAliveCount(t *testing.T) {
	t.Run("counts alive agents", func(t *testing.T) {
		a := NewArena()
		a.AddAgent(newTestAgent("p1", "A"))
		a.AddAgent(newTestAgent("p2", "B"))
		a.AddAgent(newTestAgent("p3", "C"))

		if a.AliveCount() != 3 {
			t.Errorf("alive count = %v, want 3", a.AliveCount())
		}

		// Kill one
		agent, _ := a.GetAgent("p2")
		AgentDie(agent)

		if a.AliveCount() != 2 {
			t.Errorf("alive count = %v, want 2 after one death", a.AliveCount())
		}
	})
}

// --- TestAliveHumanCount ---

func TestAliveHumanCount(t *testing.T) {
	t.Run("counts only humans", func(t *testing.T) {
		a := NewArena()
		a.AddAgent(newTestAgent("p1", "Human"))
		a.AddAgent(newTestBotAgent("bot1", "Bot"))

		if a.AliveHumanCount() != 1 {
			t.Errorf("alive human count = %v, want 1", a.AliveHumanCount())
		}
	})
}

// --- TestReset ---

func TestReset(t *testing.T) {
	t.Run("clears all state", func(t *testing.T) {
		a := NewArena()
		a.AddAgent(newTestAgent("p1", "Player1"))
		a.AddAgent(newTestAgent("p2", "Player2"))

		// Process a few ticks
		for i := 0; i < 5; i++ {
			a.processTick()
		}

		a.Reset()

		if a.AgentCount() != 0 {
			t.Errorf("agent count after reset = %v, want 0", a.AgentCount())
		}
		if a.GetTick() != 0 {
			t.Errorf("tick after reset = %v, want 0", a.GetTick())
		}
	})
}

// --- TestRandomSpawnPosition ---

func TestRandomSpawnPosition(t *testing.T) {
	t.Run("spawn position within bounds", func(t *testing.T) {
		a := NewArena()
		maxDist := ArenaRadius * SpawnMarginRatio

		for i := 0; i < 100; i++ {
			pos := a.RandomSpawnPosition()
			dist := DistanceBetween(pos, domain.Position{X: 0, Y: 0})
			if dist > maxDist+1.0 { // small tolerance
				t.Errorf("spawn position (%v, %v) dist=%v exceeds max %v", pos.X, pos.Y, dist, maxDist)
			}
		}
	})
}
