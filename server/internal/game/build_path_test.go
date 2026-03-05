package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestRecommendChoice_PrioritizesTomes(t *testing.T) {
	path := PresetBuildPaths[PresetBerserker]
	build := domain.NewPlayerBuild()

	choices := []domain.UpgradeChoice{
		{ID: "tome_regen", Type: "tome", TomeType: domain.TomeRegen, Name: "Regen Tome"},
		{ID: "tome_damage", Type: "tome", TomeType: domain.TomeDamage, Name: "Damage Tome"},
		{ID: "tome_armor", Type: "tome", TomeType: domain.TomeArmor, Name: "Armor Tome"},
	}

	result := RecommendChoice(path, choices, build)
	if result == nil {
		t.Fatal("expected a recommendation, got nil")
	}
	if result.TomeType != domain.TomeDamage {
		t.Errorf("expected damage tome (berserker priority), got %s", result.TomeType)
	}
}

func TestRecommendChoice_PrioritizesAbilities(t *testing.T) {
	path := PresetBuildPaths[PresetFortress]
	build := domain.NewPlayerBuild()

	choices := []domain.UpgradeChoice{
		{ID: "ability_venom_aura", Type: "ability", AbilityType: domain.AbilityVenomAura, Name: "Venom Aura"},
		{ID: "ability_shield_burst", Type: "ability", AbilityType: domain.AbilityShieldBurst, Name: "Shield Burst"},
		{ID: "ability_lightning_strike", Type: "ability", AbilityType: domain.AbilityLightningStrike, Name: "Lightning"},
	}

	result := RecommendChoice(path, choices, build)
	if result == nil {
		t.Fatal("expected a recommendation, got nil")
	}
	if result.AbilityType != domain.AbilityShieldBurst {
		t.Errorf("expected shield_burst (fortress priority), got %s", result.AbilityType)
	}
}

func TestRecommendChoice_BannedUpgrades(t *testing.T) {
	path := BuildPath{
		Name:              "Test",
		PriorityTomes:     []domain.TomeType{domain.TomeDamage},
		PriorityAbilities: []domain.AbilityType{},
		BannedUpgrades:    []string{"tome_damage"},
	}
	build := domain.NewPlayerBuild()

	choices := []domain.UpgradeChoice{
		{ID: "tome_damage", Type: "tome", TomeType: domain.TomeDamage, Name: "Damage"},
		{ID: "tome_armor", Type: "tome", TomeType: domain.TomeArmor, Name: "Armor"},
	}

	result := RecommendChoice(path, choices, build)
	if result == nil {
		t.Fatal("expected a recommendation, got nil")
	}
	if result.ID == "tome_damage" {
		t.Error("banned tome_damage should not be recommended")
	}
}

func TestRecommendChoice_EmptyChoices(t *testing.T) {
	path := PresetBuildPaths[PresetBalanced]
	build := domain.NewPlayerBuild()

	result := RecommendChoice(path, []domain.UpgradeChoice{}, build)
	if result != nil {
		t.Errorf("expected nil for empty choices, got %v", result)
	}
}

func TestAllPresetsAreDefined(t *testing.T) {
	for _, preset := range AllPresets {
		if _, ok := PresetBuildPaths[preset]; !ok {
			t.Errorf("preset %s is not defined in PresetBuildPaths", preset)
		}
	}
}
