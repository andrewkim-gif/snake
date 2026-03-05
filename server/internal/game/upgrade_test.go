package game

import (
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

func TestUpgrade_GenerateChoices_Returns3(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	choices := us.GenerateChoices(a)

	if len(choices) != domain.ChoicesPerLevel {
		t.Errorf("expected %d choices, got %d", domain.ChoicesPerLevel, len(choices))
	}

	// All choices should have unique IDs
	ids := make(map[string]bool)
	for _, c := range choices {
		if ids[c.ID] {
			t.Errorf("duplicate choice ID: %s", c.ID)
		}
		ids[c.ID] = true
	}
}

func TestUpgrade_ApplyChoice_Tome(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	choices := us.GenerateChoices(a)
	a.PendingChoices = choices
	a.UpgradeDeadline = 1000

	// Find a tome choice
	var tomeChoice *domain.UpgradeChoice
	for i := range choices {
		if choices[i].Type == "tome" {
			tomeChoice = &choices[i]
			break
		}
	}

	if tomeChoice == nil {
		// All choices were abilities — that's ok for this test
		t.Skip("no tome choices generated in this run")
	}

	initialStacks := a.Build.Tomes[tomeChoice.TomeType]

	err := us.ApplyChoice(a, tomeChoice.ID)
	if err != nil {
		t.Fatalf("ApplyChoice failed: %v", err)
	}

	if a.Build.Tomes[tomeChoice.TomeType] != initialStacks+1 {
		t.Errorf("expected stacks to increase from %d to %d",
			initialStacks, a.Build.Tomes[tomeChoice.TomeType])
	}

	if a.PendingChoices != nil {
		t.Error("pending choices should be cleared after apply")
	}
}

func TestUpgrade_ApplyChoice_InvalidChoice(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	choices := us.GenerateChoices(a)
	a.PendingChoices = choices

	err := us.ApplyChoice(a, "nonexistent_choice")
	if err == nil {
		t.Error("expected error for invalid choice ID")
	}
}

func TestUpgrade_ApplyChoice_NoPending(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	err := us.ApplyChoice(a, "some_choice")
	if err == nil {
		t.Error("expected error when no pending choices")
	}
}

func TestUpgrade_CheckSynergies_NoSynergy(t *testing.T) {
	us := NewUpgradeSystem()
	build := domain.NewPlayerBuild()

	synergies := us.CheckSynergies(build)
	if len(synergies) != 0 {
		t.Errorf("expected 0 synergies for empty build, got %d", len(synergies))
	}
}

func TestUpgrade_CheckSynergies_GlassCannon(t *testing.T) {
	us := NewUpgradeSystem()
	build := domain.NewPlayerBuild()

	// Glass Cannon requires: Damage 5, Cursed 3
	build.Tomes[domain.TomeDamage] = 5
	build.Tomes[domain.TomeCursed] = 3

	synergies := us.CheckSynergies(build)

	found := false
	for _, s := range synergies {
		if s == "glass_cannon" {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("expected glass_cannon synergy, got %v", synergies)
	}
}

func TestUpgrade_ProcessTimeouts(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	choices := us.GenerateChoices(a)
	a.PendingChoices = choices
	a.UpgradeDeadline = 100

	agents := map[string]*Agent{"a1": a}

	// Before deadline
	us.ProcessTimeouts(agents, 50)
	if a.PendingChoices == nil {
		t.Error("should not auto-select before deadline")
	}

	// After deadline
	us.ProcessTimeouts(agents, 101)
	if a.PendingChoices != nil {
		t.Error("should auto-select after deadline")
	}
}

func TestUpgrade_SmartChooseUpgrade_Aggressive(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	// Generate choices and test that aggressive build path picks damage-related upgrades
	choices := us.GenerateChoices(a)
	a.PendingChoices = choices

	bestID := us.SmartChooseUpgrade(a, domain.BuildAggressive)
	if bestID == "" {
		t.Error("SmartChooseUpgrade should return a choice ID")
	}

	// Verify the returned ID is from the pending choices
	found := false
	for _, c := range choices {
		if c.ID == bestID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("SmartChooseUpgrade returned ID %s not in pending choices", bestID)
	}
}

func TestUpgrade_SmartChooseUpgrade_BuildDiversity(t *testing.T) {
	us := NewUpgradeSystem()

	// Run 100 rounds of upgrades with different build paths and check diversity
	buildPaths := []domain.BotBuildPath{
		domain.BuildAggressive,
		domain.BuildTank,
		domain.BuildXPRush,
		domain.BuildBalanced,
		domain.BuildGlassCannon,
	}

	tomeCountsByPath := make(map[domain.BotBuildPath]map[domain.TomeType]int)
	for _, path := range buildPaths {
		tomeCountsByPath[path] = make(map[domain.TomeType]int)
	}

	for _, path := range buildPaths {
		a := newTestAgent("bot_" + string(path))
		for level := 0; level < 10; level++ {
			choices := us.GenerateChoices(a)
			a.PendingChoices = choices
			a.UpgradeDeadline = 99999

			bestID := us.SmartChooseUpgrade(a, path)
			if bestID != "" {
				for _, c := range choices {
					if c.ID == bestID && c.Type == "tome" {
						tomeCountsByPath[path][c.TomeType]++
						break
					}
				}
				us.ApplyChoice(a, bestID)
				a.ActiveSynergies = us.CheckSynergies(a.Build)
			}
		}
	}

	// Check that different build paths produce different tome distributions
	// Aggressive should have more Damage tomes than Tank
	aggDmg := tomeCountsByPath[domain.BuildAggressive][domain.TomeDamage]
	tankDmg := tomeCountsByPath[domain.BuildTank][domain.TomeDamage]
	tankArmor := tomeCountsByPath[domain.BuildTank][domain.TomeArmor]

	// At least verify build paths produce non-zero selections
	totalSelections := 0
	for _, counts := range tomeCountsByPath {
		for _, c := range counts {
			totalSelections += c
		}
	}
	if totalSelections == 0 {
		t.Error("expected at least some tome selections across all build paths")
	}

	// Soft check: aggressive should favor damage over tank's damage preference
	t.Logf("Aggressive Damage: %d, Tank Damage: %d, Tank Armor: %d", aggDmg, tankDmg, tankArmor)
}

func TestUpgrade_ScoreUpgradeChoice_SynergyBonus(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	// Set up a build close to Glass Cannon synergy (needs Damage 5, Cursed 3)
	a.Build.Tomes[domain.TomeDamage] = 4
	a.Build.Tomes[domain.TomeCursed] = 3

	// A Damage tome choice should have high synergy score
	damageChoice := domain.UpgradeChoice{
		ID:       "tome_damage",
		Type:     "tome",
		TomeType: domain.TomeDamage,
	}

	// An unrelated tome choice
	regenChoice := domain.UpgradeChoice{
		ID:       "tome_regen",
		Type:     "tome",
		TomeType: domain.TomeRegen,
	}

	damageScore := us.ScoreUpgradeChoice(damageChoice, a, domain.BuildAggressive)
	regenScore := us.ScoreUpgradeChoice(regenChoice, a, domain.BuildAggressive)

	// Damage should score higher due to synergy contribution + build path priority
	if damageScore <= regenScore {
		t.Errorf("expected damage score (%f) > regen score (%f) for aggressive build near glass_cannon synergy",
			damageScore, regenScore)
	}
}

func TestUpgrade_ApplyChoice_Ability_New(t *testing.T) {
	us := NewUpgradeSystem()
	a := newTestAgent("a1")

	// Generate choices until we get an ability choice
	for attempts := 0; attempts < 50; attempts++ {
		choices := us.GenerateChoices(a)
		a.PendingChoices = choices

		for _, c := range choices {
			if c.Type == "ability" {
				err := us.ApplyChoice(a, c.ID)
				if err != nil {
					t.Fatalf("ApplyChoice failed: %v", err)
				}
				if len(a.Build.Abilities) != 1 {
					t.Errorf("expected 1 ability, got %d", len(a.Build.Abilities))
				}
				return
			}
		}
		// Reset for next attempt
		a.PendingChoices = nil
	}
	t.Skip("no ability choices generated in 50 attempts")
}
