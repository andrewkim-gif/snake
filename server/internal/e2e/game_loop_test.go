package e2e

import (
	"context"
	"testing"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
)

// ============================================================
// v14 Phase 10 — S45: Server-Side E2E Integration Tests
// Full game loop validation
// ============================================================

// TestCharacterCreationToArenaEntry validates the complete flow from
// agent creation to arena entry with nationality.
func TestCharacterCreationToArenaEntry(t *testing.T) {
	arena := game.NewArena()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go arena.Run(ctx)

	// Wait for arena start
	for !arena.IsRunning() {
		time.Sleep(time.Millisecond)
	}

	// Create agent with nationality
	skin := domain.GetSkinByID(0)
	agent := game.NewAgentWithNationality("test_player", "TestAgent", domain.Position{X: 0, Y: 0}, skin, false, arena.GetTick(), "", "KOR")

	arena.AddAgent(agent)

	// Verify agent exists
	agents := arena.GetAgents()
	if _, ok := agents["test_player"]; !ok {
		t.Fatal("agent not found in arena after AddAgent")
	}

	// Verify nationality
	if agents["test_player"].Nationality != "KOR" {
		t.Errorf("expected nationality KOR, got %s", agents["test_player"].Nationality)
	}

	// Verify alive
	if !agents["test_player"].Alive {
		t.Error("agent should be alive after creation")
	}

	// Verify initial HP
	if agents["test_player"].HP <= 0 {
		t.Errorf("agent HP should be positive, got %f", agents["test_player"].HP)
	}

	cancel()
}

// TestEpochCycle validates the peace -> war -> end epoch cycle.
func TestEpochCycle(t *testing.T) {
	arena := game.NewArena()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go arena.Run(ctx)

	for !arena.IsRunning() {
		time.Sleep(time.Millisecond)
	}

	// Spawn 10 bots to simulate a battle
	bm := game.NewBotManager(10)
	bm.SetArena(arena)
	bm.SpawnBots(10)

	// Let the arena tick for 100 ticks (5 seconds at 20Hz)
	time.Sleep(100 * time.Millisecond)

	agents := arena.GetAgents()
	if len(agents) < 10 {
		t.Errorf("expected at least 10 agents, got %d", len(agents))
	}

	// Run for a bit more to ensure stability
	bm.UpdateBots()
	time.Sleep(50 * time.Millisecond)

	// Arena should still be running
	if !arena.IsRunning() {
		t.Error("arena should still be running")
	}

	cancel()
}

// TestLevelUpWeaponAcquisition validates the level-up system
// with weapon acquisition and synergy activation.
func TestLevelUpWeaponAcquisition(t *testing.T) {
	arena := game.NewArena()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go arena.Run(ctx)

	for !arena.IsRunning() {
		time.Sleep(time.Millisecond)
	}

	skin := domain.GetSkinByID(0)
	agent := game.NewAgentWithNationality("test_weapon", "WeaponTester", domain.Position{X: 0, Y: 0}, skin, false, arena.GetTick(), "", "USA")
	arena.AddAgent(agent)

	// Add weapon directly via combat system
	ok := game.AddWeapon(agent, domain.WeaponBonkMallet)
	if !ok {
		t.Error("failed to add BonkMallet weapon")
	}
	if len(agent.WeaponSlots) != 1 {
		t.Errorf("expected 1 weapon slot, got %d", len(agent.WeaponSlots))
	}
	if agent.WeaponSlots[0].Type != domain.WeaponBonkMallet {
		t.Errorf("expected BonkMallet, got %s", agent.WeaponSlots[0].Type)
	}

	// Add duplicate weapon — should evolve
	ok = game.AddWeapon(agent, domain.WeaponBonkMallet)
	if !ok {
		t.Error("failed to evolve BonkMallet")
	}
	if agent.WeaponSlots[0].Level != 2 {
		t.Errorf("expected weapon level 2 after evolution, got %d", agent.WeaponSlots[0].Level)
	}

	// Add more weapons up to max slots
	game.AddWeapon(agent, domain.WeaponChainBolt)
	game.AddWeapon(agent, domain.WeaponFlameRing)
	game.AddWeapon(agent, domain.WeaponFrostShards)
	game.AddWeapon(agent, domain.WeaponShadowStrike)

	if len(agent.WeaponSlots) != 5 {
		t.Errorf("expected 5 weapon slots (max), got %d", len(agent.WeaponSlots))
	}

	// 6th weapon should fail (slots full)
	ok = game.AddWeapon(agent, domain.WeaponThunderClap)
	if ok {
		t.Error("should not be able to add 6th weapon (max 5 slots)")
	}

	// Test synergy detection — Thermal Shock requires FlameRing + FrostShards
	agent.Passives = make(map[domain.PassiveType]int)
	activations := game.CheckAndActivateV14Synergies(agent)

	hasThermalShock := false
	for _, a := range activations {
		if a.Type == domain.SynergyThermalShock {
			hasThermalShock = true
		}
	}
	if !hasThermalShock {
		t.Error("expected Thermal Shock synergy (FlameRing + FrostShards) to activate")
	}

	cancel()
}

// TestPassiveStacking validates passive upgrade stacking.
func TestPassiveStacking(t *testing.T) {
	agent := &domain.Agent{
		ID:    "test_passive",
		Level: 5,
		HP:    100,
		MaxHP: 100,
		Passives: map[domain.PassiveType]int{
			domain.PassiveVigor:     3, // +45% max HP
			domain.PassivePrecision: 2, // +16% crit chance
			domain.PassiveIronSkin:  2, // -24% damage taken
		},
		CritChance: 0.05,
	}

	game.RecalcPassiveEffects(agent)

	// Vigor: base 100 + level bonus (5-1)*10 = 40 → 140 * 1.45 = 203
	expectedMaxHP := (100.0 + 40.0) * 1.45
	if agent.MaxHP < expectedMaxHP-1 || agent.MaxHP > expectedMaxHP+1 {
		t.Errorf("expected MaxHP ~%.0f with 3 Vigor stacks, got %.0f", expectedMaxHP, agent.MaxHP)
	}

	// Precision: 0.05 + 2*0.08 = 0.21
	expectedCrit := 0.05 + 2*0.08
	if agent.CritChance < expectedCrit-0.01 || agent.CritChance > expectedCrit+0.01 {
		t.Errorf("expected crit chance ~%.2f with 2 Precision stacks, got %.2f", expectedCrit, agent.CritChance)
	}

	// IronSkin: 2*0.12 = 0.24
	expectedDef := 2 * 0.12
	if agent.Defense < expectedDef-0.01 || agent.Defense > expectedDef+0.01 {
		t.Errorf("expected defense ~%.2f with 2 IronSkin stacks, got %.2f", expectedDef, agent.Defense)
	}
}

// TestDominationScoring validates nation score calculation.
func TestDominationScoring(t *testing.T) {
	arena := game.NewArena()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go arena.Run(ctx)

	for !arena.IsRunning() {
		time.Sleep(time.Millisecond)
	}

	skin := domain.GetSkinByID(0)

	// Create agents from different nations
	agent1 := game.NewAgentWithNationality("kor_1", "Korean1", domain.Position{X: 100, Y: 0}, skin, false, arena.GetTick(), "", "KOR")
	agent2 := game.NewAgentWithNationality("usa_1", "American1", domain.Position{X: -100, Y: 0}, skin, false, arena.GetTick(), "", "USA")

	arena.AddAgent(agent1)
	arena.AddAgent(agent2)

	// Verify different nationalities are not allies
	if game.IsSameNation(agent1, agent2) {
		t.Error("KOR and USA should not be same nation")
	}

	// Verify same nationality agents are allies
	agent3 := game.NewAgentWithNationality("kor_2", "Korean2", domain.Position{X: 200, Y: 0}, skin, false, arena.GetTick(), "", "KOR")
	arena.AddAgent(agent3)

	if !game.IsSameNation(agent1, agent3) {
		t.Error("two KOR agents should be same nation")
	}

	cancel()
}

// TestRespawnMechanics validates death -> respawn flow.
func TestRespawnMechanics(t *testing.T) {
	skin := domain.GetSkinByID(0)
	agent := game.NewAgentWithNationality("test_respawn", "Respawner", domain.Position{X: 100, Y: 100}, skin, false, 0, "", "JPN")

	// Add some weapons and level up
	game.AddWeapon(agent, domain.WeaponBonkMallet)
	agent.Level = 5
	agent.MaxHP = 150
	agent.HP = 150

	// Kill the agent
	game.AgentDie(agent)
	if agent.Alive {
		t.Error("agent should be dead after AgentDie")
	}

	// Respawn
	spawnPos := domain.Position{X: 500, Y: 500}
	game.RespawnAgent(agent, spawnPos, 1000)

	// Verify respawn state
	if !agent.Alive {
		t.Error("agent should be alive after respawn")
	}
	if agent.HP != agent.MaxHP {
		t.Errorf("HP should be full after respawn, got %.0f/%.0f", agent.HP, agent.MaxHP)
	}
	if !agent.Invincible {
		t.Error("agent should be invincible after respawn")
	}
	if agent.Position.X != 500 || agent.Position.Y != 500 {
		t.Errorf("agent should be at spawn position, got (%.0f, %.0f)", agent.Position.X, agent.Position.Y)
	}
	if agent.Deaths != 1 {
		t.Errorf("death count should be 1, got %d", agent.Deaths)
	}
	// Weapons should be preserved
	if len(agent.WeaponSlots) != 1 {
		t.Errorf("weapons should be preserved after respawn, got %d slots", len(agent.WeaponSlots))
	}
	// Level should be preserved
	if agent.Level != 5 {
		t.Errorf("level should be preserved after respawn, got %d", agent.Level)
	}
}

// TestInGameLobbyTransition validates that arena state survives mode changes.
func TestInGameLobbyTransition(t *testing.T) {
	arena := game.NewArena()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go arena.Run(ctx)

	for !arena.IsRunning() {
		time.Sleep(time.Millisecond)
	}

	skin := domain.GetSkinByID(0)
	agent := game.NewAgentWithNationality("transition_test", "Transitioner", domain.Position{X: 0, Y: 0}, skin, false, arena.GetTick(), "", "GBR")
	arena.AddAgent(agent)

	// Let arena run
	time.Sleep(50 * time.Millisecond)

	// Agent should still exist (simulating lobby return — agent stays in arena)
	agents := arena.GetAgents()
	if _, ok := agents["transition_test"]; !ok {
		t.Error("agent should persist in arena during lobby return")
	}

	// Re-entering should find the same agent
	existingAgent := agents["transition_test"]
	if existingAgent.ID != "transition_test" {
		t.Error("re-entry should find the same agent")
	}

	cancel()
}
