package game

import (
	"github.com/to-nexus/snake-server/internal/domain"
)

// BuildPath represents a named upgrade strategy for agents.
type BuildPath struct {
	Name              string              `json:"name"`
	PriorityTomes     []domain.TomeType    `json:"priorityTomes"`
	PriorityAbilities []domain.AbilityType `json:"priorityAbilities"`
	BannedUpgrades    []string             `json:"bannedUpgrades,omitempty"`
	SynergyTargets    []string             `json:"synergyTargets,omitempty"`
}

// BuildPathPreset identifies a named preset.
type BuildPathPreset string

const (
	PresetBerserker  BuildPathPreset = "berserker"
	PresetFortress   BuildPathPreset = "fortress"
	PresetQuicksilver BuildPathPreset = "quicksilver"
	PresetCollector  BuildPathPreset = "collector"
	PresetBalanced   BuildPathPreset = "balanced"
	PresetCustom     BuildPathPreset = "custom"
)

// AllPresets lists all available preset names.
var AllPresets = []BuildPathPreset{
	PresetBerserker, PresetFortress, PresetQuicksilver,
	PresetCollector, PresetBalanced, PresetCustom,
}

// PresetBuildPaths maps preset names to their BuildPath definitions.
var PresetBuildPaths = map[BuildPathPreset]BuildPath{
	PresetBerserker: {
		Name:              "Berserker",
		PriorityTomes:     []domain.TomeType{domain.TomeDamage, domain.TomeSpeed, domain.TomeCursed},
		PriorityAbilities: []domain.AbilityType{domain.AbilitySpeedDash, domain.AbilityVenomAura},
		SynergyTargets:    []string{"glass_cannon", "berserker"},
	},
	PresetFortress: {
		Name:              "Fortress",
		PriorityTomes:     []domain.TomeType{domain.TomeRegen, domain.TomeArmor, domain.TomeMagnet},
		PriorityAbilities: []domain.AbilityType{domain.AbilityShieldBurst, domain.AbilityMassDrain},
		SynergyTargets:    []string{"iron_fortress", "vampire"},
	},
	PresetQuicksilver: {
		Name:              "Quicksilver",
		PriorityTomes:     []domain.TomeType{domain.TomeSpeed, domain.TomeMagnet, domain.TomeLuck},
		PriorityAbilities: []domain.AbilityType{domain.AbilitySpeedDash, domain.AbilityGravityWell},
		SynergyTargets:    []string{"speedster"},
	},
	PresetCollector: {
		Name:              "Collector",
		PriorityTomes:     []domain.TomeType{domain.TomeMagnet, domain.TomeXP, domain.TomeRegen},
		PriorityAbilities: []domain.AbilityType{domain.AbilityGravityWell, domain.AbilitySpeedDash},
		SynergyTargets:    []string{"pacifist"},
	},
	PresetBalanced: {
		Name:              "Balanced",
		PriorityTomes:     []domain.TomeType{domain.TomeDamage, domain.TomeArmor, domain.TomeSpeed},
		PriorityAbilities: []domain.AbilityType{domain.AbilityVenomAura, domain.AbilityShieldBurst, domain.AbilityLightningStrike},
		SynergyTargets:    []string{},
	},
	PresetCustom: {
		Name:              "Custom",
		PriorityTomes:     []domain.TomeType{},
		PriorityAbilities: []domain.AbilityType{},
		SynergyTargets:    []string{},
	},
}

// RecommendChoice picks the best upgrade choice based on a build path.
// Returns nil if no choices available.
func RecommendChoice(path BuildPath, choices []domain.UpgradeChoice, build domain.PlayerBuild) *domain.UpgradeChoice {
	if len(choices) == 0 {
		return nil
	}

	bannedSet := make(map[string]bool, len(path.BannedUpgrades))
	for _, b := range path.BannedUpgrades {
		bannedSet[b] = true
	}

	bestScore := -1.0
	var bestChoice *domain.UpgradeChoice

	for i := range choices {
		c := &choices[i]

		// Skip banned upgrades
		if bannedSet[c.ID] {
			continue
		}

		score := scoreChoiceForPath(path, *c, build)
		if score > bestScore {
			bestScore = score
			bestChoice = c
		}
	}

	if bestChoice == nil && len(choices) > 0 {
		bestChoice = &choices[0]
	}

	return bestChoice
}

// scoreChoiceForPath evaluates how well a choice fits a build path.
func scoreChoiceForPath(path BuildPath, choice domain.UpgradeChoice, build domain.PlayerBuild) float64 {
	score := 1.0

	if choice.Type == "tome" {
		// Priority score based on position in priority list
		for i, pt := range path.PriorityTomes {
			if pt == choice.TomeType {
				score += 5.0 - float64(i)*1.0 // First = +5, second = +4, third = +3
				break
			}
		}

		// Stack diminishing returns
		currentStacks := build.Tomes[choice.TomeType]
		if currentStacks > 0 {
			score *= (1.0 - float64(currentStacks)*0.05)
		}

		// Synergy contribution
		score += synergyContribution(path, choice, build)
	}

	if choice.Type == "ability" {
		// Priority score
		for i, pa := range path.PriorityAbilities {
			if pa == choice.AbilityType {
				score += 5.0 - float64(i)*1.0
				break
			}
		}

		// Upgrading existing ability bonus
		if choice.CurrentLevel > 0 {
			score += 1.5
		}

		// Synergy contribution
		score += synergyContribution(path, choice, build)
	}

	return score
}

// synergyContribution calculates synergy progress score for a choice.
func synergyContribution(path BuildPath, choice domain.UpgradeChoice, build domain.PlayerBuild) float64 {
	if len(path.SynergyTargets) == 0 {
		return 0
	}

	score := 0.0
	targetSet := make(map[string]bool, len(path.SynergyTargets))
	for _, s := range path.SynergyTargets {
		targetSet[s] = true
	}

	for _, syn := range domain.AllSynergies {
		if !targetSet[syn.ID] {
			continue
		}

		if choice.Type == "tome" {
			for tomeType, minStacks := range syn.Requirements.Tomes {
				if domain.TomeType(tomeType) == choice.TomeType {
					if build.Tomes[choice.TomeType] < minStacks {
						score += 2.0
					}
				}
			}
		}

		if choice.Type == "ability" {
			for abilityType, minLevel := range syn.Requirements.Abilities {
				if domain.AbilityType(abilityType) == choice.AbilityType {
					currentLevel := 0
					for _, slot := range build.Abilities {
						if slot.Type == choice.AbilityType {
							currentLevel = slot.Level
							break
						}
					}
					if currentLevel < minLevel {
						score += 2.5
					}
				}
			}
		}
	}

	return score
}
