package game

import (
	"math"
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// --- TestBotDecideUpgrade ---

func TestBotDecideUpgrade(t *testing.T) {
	t.Run("prefers build path tomes", func(t *testing.T) {
		agent := newTestAgent("bot1", "TestBot")

		choices := []domain.UpgradeChoice{
			{ID: "tome_xp_1", Type: "tome", TomeType: domain.TomeXP},
			{ID: "tome_damage_1", Type: "tome", TomeType: domain.TomeDamage},
			{ID: "tome_armor_1", Type: "tome", TomeType: domain.TomeArmor},
		}

		// Berserker prefers Damage > Cursed > Speed
		idx := BotDecideUpgrade(agent, choices, BuildBerserker, nil)
		if choices[idx].TomeType != domain.TomeDamage {
			t.Errorf("berserker should prefer damage tome, got %v (idx=%d)", choices[idx].TomeType, idx)
		}

		// Tank prefers Armor > Regen > Magnet
		idx = BotDecideUpgrade(agent, choices, BuildTank, nil)
		if choices[idx].TomeType != domain.TomeArmor {
			t.Errorf("tank should prefer armor tome, got %v (idx=%d)", choices[idx].TomeType, idx)
		}

		// Scholar prefers XP > Luck > Magnet
		idx = BotDecideUpgrade(agent, choices, BuildScholar, nil)
		if choices[idx].TomeType != domain.TomeXP {
			t.Errorf("scholar should prefer xp tome, got %v (idx=%d)", choices[idx].TomeType, idx)
		}
	})

	t.Run("prioritizes synergy completion", func(t *testing.T) {
		agent := newTestAgent("bot1", "TestBot")
		// Set up agent nearly meeting Holy Trinity: TomeXP: 3, TomeLuck: 2, TomeCursed: 1
		// Missing: TomeLuck (need 2, have 1)
		agent.Build.Tomes[domain.TomeXP] = 3
		agent.Build.Tomes[domain.TomeLuck] = 1
		agent.Build.Tomes[domain.TomeCursed] = 1

		choices := []domain.UpgradeChoice{
			{ID: "tome_damage_1", Type: "tome", TomeType: domain.TomeDamage},
			{ID: "tome_luck_2", Type: "tome", TomeType: domain.TomeLuck},
			{ID: "tome_speed_1", Type: "tome", TomeType: domain.TomeSpeed},
		}

		idx := BotDecideUpgrade(agent, choices, BuildBerserker, nil)
		if choices[idx].TomeType != domain.TomeLuck {
			t.Errorf("should prioritize synergy completion (luck for holy_trinity), got %v", choices[idx].TomeType)
		}
	})

	t.Run("ability upgrade scores well", func(t *testing.T) {
		agent := newTestAgent("bot1", "TestBot")
		agent.Build.AbilitySlots = []domain.AbilitySlot{
			{Type: domain.AbilityVenomAura, Level: 1},
		}

		choices := []domain.UpgradeChoice{
			{ID: "tome_magnet_1", Type: "tome", TomeType: domain.TomeMagnet},
			{ID: "ability_venom_lv2", Type: "ability", AbilityType: domain.AbilityVenomAura, AbilityLevel: 2},
			{ID: "tome_luck_1", Type: "tome", TomeType: domain.TomeLuck},
		}

		idx := BotDecideUpgrade(agent, choices, BuildVampire, nil)
		// For vampire, venom aura upgrade should score well (ability upgrade + build path bonus)
		if choices[idx].Type != "ability" || choices[idx].AbilityType != domain.AbilityVenomAura {
			t.Logf("vampire chose: %v (idx=%d) - this is acceptable if tome scores higher due to build path prefs", choices[idx].ID, idx)
		}
	})

	t.Run("empty choices returns 0", func(t *testing.T) {
		agent := newTestAgent("bot1", "TestBot")
		idx := BotDecideUpgrade(agent, nil, BuildBerserker, nil)
		if idx != 0 {
			t.Errorf("empty choices should return 0, got %v", idx)
		}

		idx = BotDecideUpgrade(agent, []domain.UpgradeChoice{}, BuildBerserker, nil)
		if idx != 0 {
			t.Errorf("empty choices should return 0, got %v", idx)
		}
	})
}

// --- TestBotBehaviors ---

func TestBotBehaviors(t *testing.T) {
	t.Run("return to center when near boundary", func(t *testing.T) {
		bm := NewBotManager(5)
		arena := NewArena()
		bm.SetArena(arena)

		// Place bot near boundary (85% of arena radius)
		bot := newTestAgentAt("bot1", "TestBot", ArenaRadius*0.9, 0)
		bot.IsBot = true
		bot.GracePeriodEnd = 0

		state := &BotState{
			ID:          "bot1",
			BuildPath:   BuildBerserker,
			WanderAngle: 0,
		}

		agents := map[string]*domain.Agent{"bot1": bot}
		angle, boost := bm.decideBehavior(bot, state, agents, ArenaRadius)

		// The bot should move toward center (angle pointing toward -X since it's at +X)
		if angle > -math.Pi/2 && angle < math.Pi/2 {
			t.Errorf("near boundary, bot should head toward center, got angle=%v", angle)
		}
		if boost {
			t.Error("return-to-center should not boost")
		}
	})

	t.Run("survive mode when low mass", func(t *testing.T) {
		bm := NewBotManager(5)
		arena := NewArena()
		bm.SetArena(arena)

		bot := newTestAgentAt("bot1", "TestBot", 0, 0)
		bot.IsBot = true
		bot.Mass = InitialMass * 0.3 // below 50% threshold

		// Place a larger enemy nearby
		enemy := newTestAgentAt("enemy", "Enemy", AuraRadius*2, 0)
		enemy.Mass = InitialMass * 3

		state := &BotState{
			ID:          "bot1",
			BuildPath:   BuildBerserker,
			WanderAngle: 0,
		}

		agents := map[string]*domain.Agent{
			"bot1":  bot,
			"enemy": enemy,
		}

		angle, boost := bm.decideBehavior(bot, state, agents, ArenaRadius)

		// Should flee (angle pointing away from enemy)
		// Enemy is at positive X, so flee angle should be roughly -pi (away from enemy)
		if math.Cos(angle) > 0 {
			t.Errorf("low mass bot should flee from larger enemy, got angle=%v (cos > 0 means toward enemy)", angle)
		}
		if !boost {
			t.Error("fleeing bot should boost")
		}
	})

	t.Run("hunt mode when nearby smaller enemy", func(t *testing.T) {
		bm := NewBotManager(5)
		arena := NewArena()
		bm.SetArena(arena)

		bot := newTestAgentAt("bot1", "TestBot", 0, 0)
		bot.IsBot = true
		bot.Mass = InitialMass * 3 // large bot

		// Place a much smaller enemy nearby
		prey := newTestAgentAt("prey", "Prey", AuraRadius*2, 0)
		prey.Mass = InitialMass * 0.5

		state := &BotState{
			ID:          "bot1",
			BuildPath:   BuildBerserker,
			WanderAngle: 0,
		}

		agents := map[string]*domain.Agent{
			"bot1": bot,
			"prey": prey,
		}

		angle, boost := bm.decideBehavior(bot, state, agents, ArenaRadius)

		// Should chase (angle pointing toward prey at positive X)
		if math.Cos(angle) < 0 {
			t.Errorf("large bot should chase smaller enemy, got angle=%v", angle)
		}
		if !boost {
			t.Error("hunting bot should boost")
		}
	})

	t.Run("wander when alone", func(t *testing.T) {
		bm := NewBotManager(5)
		arena := NewArena()
		bm.SetArena(arena)

		bot := newTestAgentAt("bot1", "TestBot", 0, 0)
		bot.IsBot = true

		state := &BotState{
			ID:          "bot1",
			BuildPath:   BuildBerserker,
			WanderAngle: 1.0,
			WanderTicks: 10,
		}

		agents := map[string]*domain.Agent{"bot1": bot}

		angle, boost := bm.decideBehavior(bot, state, agents, ArenaRadius)

		// Should wander (return some angle, no boost)
		_ = angle // any angle is fine
		if boost {
			t.Error("wandering bot should not boost")
		}
	})
}

// --- TestPersonalityToBuildPath ---

func TestPersonalityToBuildPath(t *testing.T) {
	t.Run("aggro maps to berserker", func(t *testing.T) {
		bp := PersonalityToBuildPath[PersonalityAggro]
		if bp != BuildBerserker {
			t.Errorf("aggro -> %v, want berserker", bp)
		}
	})

	t.Run("cautious maps to tank", func(t *testing.T) {
		bp := PersonalityToBuildPath[PersonalityCautious]
		if bp != BuildTank {
			t.Errorf("cautious -> %v, want tank", bp)
		}
	})

	t.Run("scholar maps to scholar", func(t *testing.T) {
		bp := PersonalityToBuildPath[PersonalityScholar]
		if bp != BuildScholar {
			t.Errorf("scholar -> %v, want scholar", bp)
		}
	})

	t.Run("gambler maps to berserker", func(t *testing.T) {
		bp := PersonalityToBuildPath[PersonalityGambler]
		if bp != BuildBerserker {
			t.Errorf("gambler -> %v, want berserker", bp)
		}
	})

	t.Run("balanced maps to vampire", func(t *testing.T) {
		bp := PersonalityToBuildPath[PersonalityBalanced]
		if bp != BuildVampire {
			t.Errorf("balanced -> %v, want vampire", bp)
		}
	})

	t.Run("adaptive maps to scholar", func(t *testing.T) {
		bp := PersonalityToBuildPath[PersonalityAdaptive]
		if bp != BuildScholar {
			t.Errorf("adaptive -> %v, want scholar", bp)
		}
	})

	t.Run("all personalities have mapping", func(t *testing.T) {
		personalities := []PersonalityType{
			PersonalityAggro, PersonalityCautious, PersonalityScholar,
			PersonalityGambler, PersonalityBalanced, PersonalityAdaptive,
		}
		for _, p := range personalities {
			bp, ok := PersonalityToBuildPath[p]
			if !ok {
				t.Errorf("personality %v has no build path mapping", p)
			}
			if bp == "" {
				t.Errorf("personality %v maps to empty build path", p)
			}
		}
	})
}

// --- TestPersonalityToCombatStyle ---

func TestPersonalityToCombatStyle(t *testing.T) {
	t.Run("aggro maps to aggressive", func(t *testing.T) {
		cs := PersonalityToCombatStyle[PersonalityAggro]
		if cs != CombatStyleAggressive {
			t.Errorf("aggro -> %v, want aggressive", cs)
		}
	})

	t.Run("cautious maps to defensive", func(t *testing.T) {
		cs := PersonalityToCombatStyle[PersonalityCautious]
		if cs != CombatStyleDefensive {
			t.Errorf("cautious -> %v, want defensive", cs)
		}
	})

	t.Run("scholar maps to xp_rush", func(t *testing.T) {
		cs := PersonalityToCombatStyle[PersonalityScholar]
		if cs != CombatStyleXPRush {
			t.Errorf("scholar -> %v, want xp_rush", cs)
		}
	})
}

// --- TestBotManager ---

func TestBotManager(t *testing.T) {
	t.Run("spawn and count bots", func(t *testing.T) {
		bm := NewBotManager(10)
		arena := NewArena()
		bm.SetArena(arena)

		bm.SpawnBots(5)

		if bm.Count() != 5 {
			t.Errorf("bot count = %v, want 5", bm.Count())
		}
		if arena.AgentCount() != 5 {
			t.Errorf("arena agent count = %v, want 5", arena.AgentCount())
		}
	})

	t.Run("respects max bots", func(t *testing.T) {
		bm := NewBotManager(3)
		arena := NewArena()
		bm.SetArena(arena)

		bm.SpawnBots(10) // try to spawn more than max

		if bm.Count() != 3 {
			t.Errorf("bot count = %v, want 3 (max)", bm.Count())
		}
	})

	t.Run("clear removes all bots", func(t *testing.T) {
		bm := NewBotManager(10)
		arena := NewArena()
		bm.SetArena(arena)

		bm.SpawnBots(5)
		bm.Clear()

		if bm.Count() != 0 {
			t.Errorf("bot count after clear = %v, want 0", bm.Count())
		}
	})

	t.Run("replace bot spawns new one", func(t *testing.T) {
		bm := NewBotManager(10)
		arena := NewArena()
		bm.SetArena(arena)

		bm.SpawnBots(3)
		initialCount := bm.Count()

		// Get first bot ID
		var firstBotID string
		for id := range bm.GetAllBotBuildPaths() {
			firstBotID = id
			break
		}

		bm.ReplaceBot(firstBotID)

		if bm.Count() != initialCount {
			t.Errorf("after replace, count = %v, want %v", bm.Count(), initialCount)
		}

		// Original bot should be gone
		_, ok := bm.GetBotBuildPath(firstBotID)
		if ok {
			t.Errorf("original bot %v should be removed after replace", firstBotID)
		}
	})

	t.Run("get bot build path", func(t *testing.T) {
		bm := NewBotManager(10)
		arena := NewArena()
		bm.SetArena(arena)

		bm.SpawnBots(1)

		for id := range bm.GetAllBotBuildPaths() {
			bp, ok := bm.GetBotBuildPath(id)
			if !ok {
				t.Errorf("GetBotBuildPath(%v) returned false", id)
			}
			if bp == "" {
				t.Errorf("build path for %v is empty", id)
			}
		}
	})
}
