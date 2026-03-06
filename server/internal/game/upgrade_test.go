package game

import (
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// --- TestGenerateChoices ---

func TestGenerateChoices(t *testing.T) {
	us := NewUpgradeSystem()

	t.Run("generates correct number of choices", func(t *testing.T) {
		build := domain.PlayerBuild{
			Tomes:        make(map[domain.TomeType]int),
			AbilitySlots: make([]domain.AbilitySlot, 0),
			MaxAbilities: AbilityBaseSlots,
		}
		choices := us.GenerateChoices(2, build)

		if len(choices) != UpgradeChoiceCount {
			t.Errorf("got %d choices, want %d", len(choices), UpgradeChoiceCount)
		}
	})

	t.Run("no duplicates", func(t *testing.T) {
		build := domain.PlayerBuild{
			Tomes:        make(map[domain.TomeType]int),
			AbilitySlots: make([]domain.AbilitySlot, 0),
			MaxAbilities: AbilityBaseSlots,
		}

		// Run many times to check for duplicates statistically
		for attempt := 0; attempt < 50; attempt++ {
			choices := us.GenerateChoices(2, build)
			seen := make(map[string]bool)
			for _, c := range choices {
				if seen[c.ID] {
					t.Fatalf("duplicate choice ID: %v (attempt %d)", c.ID, attempt)
				}
				seen[c.ID] = true
			}
		}
	})

	t.Run("excludes maxed tomes", func(t *testing.T) {
		build := domain.PlayerBuild{
			Tomes: map[domain.TomeType]int{
				domain.TomeXP:     10, // maxed
				domain.TomeSpeed:  5,  // maxed
				domain.TomeDamage: 10, // maxed
				domain.TomeArmor:  8,  // maxed
				domain.TomeMagnet: 6,  // maxed
				domain.TomeLuck:   6,  // maxed
				domain.TomeRegen:  5,  // maxed
				domain.TomeCursed: 5,  // maxed
			},
			AbilitySlots: make([]domain.AbilitySlot, 0),
			MaxAbilities: AbilityBaseSlots,
		}
		choices := us.GenerateChoices(10, build)

		for _, c := range choices {
			if c.Type == "tome" {
				t.Errorf("should not offer maxed tome: %v", c.TomeType)
			}
		}
	})

	t.Run("respects ability slot limit", func(t *testing.T) {
		build := domain.PlayerBuild{
			Tomes: make(map[domain.TomeType]int),
			AbilitySlots: []domain.AbilitySlot{
				{Type: domain.AbilityVenomAura, Level: 1},
				{Type: domain.AbilityShieldBurst, Level: 1},
			},
			MaxAbilities: AbilityBaseSlots, // 2 slots, both filled
		}
		choices := us.GenerateChoices(5, build)

		for _, c := range choices {
			if c.Type == "ability" && c.AbilityLevel == 1 {
				// New ability at level 1 should only appear if it's upgrading an existing one
				isUpgrade := false
				for _, slot := range build.AbilitySlots {
					if slot.Type == c.AbilityType {
						isUpgrade = true
						break
					}
				}
				if !isUpgrade {
					t.Errorf("should not offer new ability when slots full: %v", c.AbilityType)
				}
			}
		}
	})

	t.Run("returns nil when no candidates", func(t *testing.T) {
		// Max out everything
		build := domain.PlayerBuild{
			Tomes: map[domain.TomeType]int{
				domain.TomeXP:     10,
				domain.TomeSpeed:  5,
				domain.TomeDamage: 10,
				domain.TomeArmor:  8,
				domain.TomeMagnet: 6,
				domain.TomeLuck:   6,
				domain.TomeRegen:  5,
				domain.TomeCursed: 5,
			},
			AbilitySlots: []domain.AbilitySlot{
				{Type: domain.AbilityVenomAura, Level: AbilityMaxLevel},
				{Type: domain.AbilityShieldBurst, Level: AbilityMaxLevel},
				{Type: domain.AbilityLightningStrike, Level: AbilityMaxLevel},
				{Type: domain.AbilitySpeedDash, Level: AbilityMaxLevel},
				{Type: domain.AbilityMassDrain, Level: AbilityMaxLevel},
				{Type: domain.AbilityGravityWell, Level: AbilityMaxLevel},
			},
			MaxAbilities: 6, // All slots used, all maxed
		}
		choices := us.GenerateChoices(10, build)

		if choices != nil {
			t.Errorf("expected nil when all upgrades maxed, got %v choices", len(choices))
		}
	})
}

// --- TestApplyTome ---

func TestApplyTome(t *testing.T) {
	us := NewUpgradeSystem()

	t.Run("increments tome stack", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")

		choice := domain.UpgradeChoice{
			Type:     "tome",
			TomeType: domain.TomeDamage,
		}
		us.ApplyUpgrade(agent, choice)

		if agent.Build.Tomes[domain.TomeDamage] != 1 {
			t.Errorf("damage tome stacks = %v, want 1", agent.Build.Tomes[domain.TomeDamage])
		}

		// Apply again
		us.ApplyUpgrade(agent, choice)
		if agent.Build.Tomes[domain.TomeDamage] != 2 {
			t.Errorf("damage tome stacks = %v, want 2", agent.Build.Tomes[domain.TomeDamage])
		}
	})

	t.Run("respects max stack", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		// Speed Tome has MaxStack = 5
		agent.Build.Tomes[domain.TomeSpeed] = 5

		choice := domain.UpgradeChoice{
			Type:     "tome",
			TomeType: domain.TomeSpeed,
		}
		us.ApplyUpgrade(agent, choice)

		if agent.Build.Tomes[domain.TomeSpeed] != 5 {
			t.Errorf("speed tome should stay at max 5, got %v", agent.Build.Tomes[domain.TomeSpeed])
		}
	})

	t.Run("each tome type independent", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")

		tomeTypes := []domain.TomeType{
			domain.TomeXP, domain.TomeSpeed, domain.TomeDamage,
			domain.TomeArmor, domain.TomeMagnet, domain.TomeLuck,
			domain.TomeRegen, domain.TomeCursed,
		}

		for _, tt := range tomeTypes {
			choice := domain.UpgradeChoice{Type: "tome", TomeType: tt}
			us.ApplyUpgrade(agent, choice)
		}

		for _, tt := range tomeTypes {
			if agent.Build.Tomes[tt] != 1 {
				t.Errorf("tome %v stacks = %v, want 1", tt, agent.Build.Tomes[tt])
			}
		}
	})
}

// --- TestApplyAbility ---

func TestApplyAbility(t *testing.T) {
	us := NewUpgradeSystem()

	t.Run("adds new ability", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")

		choice := domain.UpgradeChoice{
			Type:         "ability",
			AbilityType:  domain.AbilityVenomAura,
			AbilityLevel: 1,
		}
		us.ApplyUpgrade(agent, choice)

		if len(agent.Build.AbilitySlots) != 1 {
			t.Fatalf("ability slots = %v, want 1", len(agent.Build.AbilitySlots))
		}
		if agent.Build.AbilitySlots[0].Type != domain.AbilityVenomAura {
			t.Errorf("ability type = %v, want venom_aura", agent.Build.AbilitySlots[0].Type)
		}
		if agent.Build.AbilitySlots[0].Level != 1 {
			t.Errorf("ability level = %v, want 1", agent.Build.AbilitySlots[0].Level)
		}
	})

	t.Run("upgrades existing ability", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		agent.Build.AbilitySlots = []domain.AbilitySlot{
			{Type: domain.AbilityShieldBurst, Level: 1},
		}

		choice := domain.UpgradeChoice{
			Type:         "ability",
			AbilityType:  domain.AbilityShieldBurst,
			AbilityLevel: 2,
		}
		us.ApplyUpgrade(agent, choice)

		if len(agent.Build.AbilitySlots) != 1 {
			t.Fatalf("should not add new slot, got %v", len(agent.Build.AbilitySlots))
		}
		if agent.Build.AbilitySlots[0].Level != 2 {
			t.Errorf("ability level = %v, want 2", agent.Build.AbilitySlots[0].Level)
		}
	})

	t.Run("does not exceed slot limit", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		agent.Build.AbilitySlots = []domain.AbilitySlot{
			{Type: domain.AbilityVenomAura, Level: 1},
			{Type: domain.AbilityShieldBurst, Level: 1},
		}
		// MaxAbilities = AbilityBaseSlots = 2

		choice := domain.UpgradeChoice{
			Type:         "ability",
			AbilityType:  domain.AbilityLightningStrike,
			AbilityLevel: 1,
		}
		us.ApplyUpgrade(agent, choice)

		if len(agent.Build.AbilitySlots) != 2 {
			t.Errorf("should not add 3rd ability when slots full, got %v slots", len(agent.Build.AbilitySlots))
		}
	})

	t.Run("does not exceed max ability level", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		agent.Build.AbilitySlots = []domain.AbilitySlot{
			{Type: domain.AbilityVenomAura, Level: AbilityMaxLevel},
		}

		choice := domain.UpgradeChoice{
			Type:         "ability",
			AbilityType:  domain.AbilityVenomAura,
			AbilityLevel: AbilityMaxLevel + 1,
		}
		us.ApplyUpgrade(agent, choice)

		if agent.Build.AbilitySlots[0].Level != AbilityMaxLevel {
			t.Errorf("should not exceed max level, got %v", agent.Build.AbilitySlots[0].Level)
		}
	})
}

// --- TestCheckSynergies ---

func TestCheckSynergies(t *testing.T) {
	us := NewUpgradeSystem()

	t.Run("activates synergy when requirements met", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		// Holy Trinity requires: TomeXP: 3, TomeLuck: 2, TomeCursed: 1
		agent.Build.Tomes[domain.TomeXP] = 3
		agent.Build.Tomes[domain.TomeLuck] = 2
		agent.Build.Tomes[domain.TomeCursed] = 1

		newSynergies := us.CheckSynergies(agent)

		found := false
		for _, id := range newSynergies {
			if id == "holy_trinity" {
				found = true
			}
		}
		if !found {
			t.Error("holy_trinity should activate when requirements are met")
		}

		// Check it's in the agent's active synergies
		active := false
		for _, s := range agent.ActiveSynergies {
			if s == "holy_trinity" {
				active = true
			}
		}
		if !active {
			t.Error("holy_trinity should be in agent's ActiveSynergies")
		}
	})

	t.Run("does not activate when requirements not met", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		// Only partially meet Holy Trinity requirements
		agent.Build.Tomes[domain.TomeXP] = 2 // needs 3
		agent.Build.Tomes[domain.TomeLuck] = 2
		agent.Build.Tomes[domain.TomeCursed] = 1

		newSynergies := us.CheckSynergies(agent)

		for _, id := range newSynergies {
			if id == "holy_trinity" {
				t.Error("holy_trinity should NOT activate with insufficient tomes")
			}
		}
	})

	t.Run("does not double-activate", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		agent.Build.Tomes[domain.TomeXP] = 3
		agent.Build.Tomes[domain.TomeLuck] = 2
		agent.Build.Tomes[domain.TomeCursed] = 1
		agent.ActiveSynergies = []string{"holy_trinity"} // already active

		newSynergies := us.CheckSynergies(agent)

		for _, id := range newSynergies {
			if id == "holy_trinity" {
				t.Error("holy_trinity should NOT be returned if already active")
			}
		}
	})

	t.Run("ability requirement check", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		// Iron Fortress requires: TomeArmor: 4, TomeRegen: 3, AbilityShieldBurst level 1
		agent.Build.Tomes[domain.TomeArmor] = 4
		agent.Build.Tomes[domain.TomeRegen] = 3
		agent.Build.AbilitySlots = []domain.AbilitySlot{
			{Type: domain.AbilityShieldBurst, Level: 1},
		}

		newSynergies := us.CheckSynergies(agent)

		found := false
		for _, id := range newSynergies {
			if id == "iron_fortress" {
				found = true
			}
		}
		if !found {
			t.Error("iron_fortress should activate with tome + ability requirements met")
		}
	})

	t.Run("ability requirement not met", func(t *testing.T) {
		agent := newTestAgent("p1", "Test")
		// Iron Fortress requires AbilityShieldBurst, but we don't have it
		agent.Build.Tomes[domain.TomeArmor] = 4
		agent.Build.Tomes[domain.TomeRegen] = 3

		newSynergies := us.CheckSynergies(agent)

		for _, id := range newSynergies {
			if id == "iron_fortress" {
				t.Error("iron_fortress should NOT activate without ShieldBurst ability")
			}
		}
	})
}

// --- TestGetAbilityEffectiveCooldown ---

func TestGetAbilityEffectiveCooldown(t *testing.T) {
	t.Run("level 1 base cooldown", func(t *testing.T) {
		cd := GetAbilityEffectiveCooldown(domain.AbilityLightningStrike, 1)
		// BaseCooldownSec = 8, TickRate = 20 => 160 ticks
		expected := int(8.0 * float64(TickRate))
		if cd != expected {
			t.Errorf("cooldown = %v, want %v", cd, expected)
		}
	})

	t.Run("higher level reduces cooldown", func(t *testing.T) {
		cd1 := GetAbilityEffectiveCooldown(domain.AbilityLightningStrike, 1)
		cd2 := GetAbilityEffectiveCooldown(domain.AbilityLightningStrike, 2)

		if cd2 >= cd1 {
			t.Errorf("level 2 cooldown (%v) should be less than level 1 (%v)", cd2, cd1)
		}
	})
}

// --- TestGetAbilityEffectiveDamage ---

func TestGetAbilityEffectiveDamage(t *testing.T) {
	t.Run("level 1 base damage", func(t *testing.T) {
		dmg := GetAbilityEffectiveDamage(domain.AbilityLightningStrike, 1)
		// BaseDamage = 50
		if dmg != 50.0 {
			t.Errorf("damage = %v, want 50", dmg)
		}
	})

	t.Run("higher level increases damage", func(t *testing.T) {
		dmg1 := GetAbilityEffectiveDamage(domain.AbilityLightningStrike, 1)
		dmg2 := GetAbilityEffectiveDamage(domain.AbilityLightningStrike, 2)

		if dmg2 <= dmg1 {
			t.Errorf("level 2 damage (%v) should exceed level 1 (%v)", dmg2, dmg1)
		}
	})
}
