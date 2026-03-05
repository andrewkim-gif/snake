package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestBotManager_SpawnBots(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	bm := NewBotManager(15)

	bm.SpawnBots(arena)

	if arena.GetPlayerCount() != 15 {
		t.Errorf("expected 15 bots, got %d", arena.GetPlayerCount())
	}

	// All agents should be bots
	for _, agent := range arena.GetAgents() {
		if !agent.IsBot {
			t.Errorf("expected agent %s to be a bot", agent.ID)
		}
		if !bm.IsBot(agent.ID) {
			t.Errorf("expected BotManager to track %s", agent.ID)
		}
	}
}

func TestBotManager_Update_NoPanic(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	bm := NewBotManager(10)

	bm.SpawnBots(arena)

	// Run 100 ticks with bot AI
	for i := 0; i < 100; i++ {
		bm.Update(arena)
		arena.Tick()
	}

	// Should not panic
	t.Logf("After 100 ticks: %d alive", arena.GetAliveCount())
}

func TestBotManager_ReplaceDead(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	bm := NewBotManager(5)

	bm.SpawnBots(arena)
	if arena.GetPlayerCount() != 5 {
		t.Fatalf("expected 5 bots, got %d", arena.GetPlayerCount())
	}

	// Kill one bot
	for _, agent := range arena.GetAgents() {
		agent.Die()
		break
	}

	bm.ReplaceDead(arena)

	// Should still have 5 bots total
	if arena.GetPlayerCount() != 5 {
		t.Errorf("expected 5 bots after replacement, got %d", arena.GetPlayerCount())
	}
}

func TestBotManager_RemoveAll(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	bm := NewBotManager(10)

	bm.SpawnBots(arena)
	bm.RemoveAll()

	if bm.IsBot("bot_1") {
		t.Error("expected no bots after RemoveAll")
	}
}

func TestBotManager_IsBot(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	bm := NewBotManager(3)

	bm.SpawnBots(arena)

	if !bm.IsBot("bot_1") {
		t.Error("expected bot_1 to be a bot")
	}
	if bm.IsBot("human_player") {
		t.Error("expected human_player to not be a bot")
	}
}

func TestArenaWithBots_Integration(t *testing.T) {
	cfg := DefaultArenaConfig()
	cfg.NaturalOrbTarget = 500 // fewer orbs for speed
	arena := NewArena(cfg)
	bm := NewBotManager(15)

	bm.SpawnBots(arena)

	// Add a human player
	arena.AddAgent("human1", "HumanPlayer", 5, RandomPositionInCircle(cfg.ArenaRadius*0.5))

	if arena.GetPlayerCount() != 16 {
		t.Fatalf("expected 16 players (15 bots + 1 human), got %d", arena.GetPlayerCount())
	}

	// Run 500 ticks (25 seconds of game time)
	for i := 0; i < 500; i++ {
		bm.Update(arena)
		arena.Tick()
		bm.ReplaceDead(arena)
	}

	// Verify stability
	alive := arena.GetAliveCount()
	total := arena.GetPlayerCount()
	t.Logf("After 500 ticks: %d alive / %d total, tick=%d, orbs=%d",
		alive, total, arena.GetTick(), arena.GetOrbCount())

	// Bot count should be maintained
	botCount := 0
	for _, agent := range arena.GetAgents() {
		if agent.IsBot {
			botCount++
		}
	}
	// Due to replacement, we should have roughly 15 bots (some dead ones get replaced)
	if botCount < 10 {
		t.Errorf("expected at least 10 bots, got %d", botCount)
	}
}

func TestBehaveSurvive_BoundaryAvoidance(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)

	// Place agent near boundary (90% of radius)
	pos := RandomPositionInCircle(cfg.ArenaRadius * 0.9)
	agent := arena.AddAgent("bot1", "NearEdge", 0, pos)
	agent.Position.X = cfg.ArenaRadius * 0.9
	agent.Position.Y = 0

	action := behaveSurvive(agent, cfg, nil, arena)
	if action == nil {
		t.Fatal("expected survive action near boundary")
	}

	// Agent should be heading roughly toward center
	t.Logf("Survive action: angle=%f, boost=%v", action.TargetAngle, action.Boost)
}

func TestBehaveWander_CenterBias(t *testing.T) {
	// Agent at 75% radius should have some center bias
	pos := domain.Position{X: 4500, Y: 0} // 75% of 6000
	action, newAngle, newTimer := behaveWander(0, 0, pos, 6000)

	t.Logf("Wander: angle=%f, newAngle=%f, timer=%d", action.TargetAngle, newAngle, newTimer)

	// Should not crash
	if action.Boost {
		t.Error("wander should not boost")
	}
}
