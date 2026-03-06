package game

import (
	"fmt"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// UpgradeSystem handles level-up upgrade generation and application.
type UpgradeSystem struct{}

// NewUpgradeSystem creates a new UpgradeSystem.
func NewUpgradeSystem() *UpgradeSystem {
	return &UpgradeSystem{}
}

// GenerateChoices creates UpgradeChoiceCount random upgrade options for a level-up.
// Avoids duplicates and respects max stack / max slot limits.
func (us *UpgradeSystem) GenerateChoices(level int, build domain.PlayerBuild) []domain.UpgradeChoice {
	var candidates []domain.UpgradeChoice

	// Generate Tome candidates
	for _, tome := range domain.AllTomes {
		currentStack := build.Tomes[tome.Type]
		if currentStack >= tome.MaxStack {
			continue // already maxed
		}
		candidates = append(candidates, domain.UpgradeChoice{
			ID:           fmt.Sprintf("tome_%s_%d", tome.Type, currentStack+1),
			Type:         "tome",
			Name:         tome.Name,
			Description:  tome.Description,
			Tier:         tome.Tier,
			TomeType:     tome.Type,
			CurrentStack: currentStack,
		})
	}

	// Generate Ability candidates
	equippedCount := len(build.AbilitySlots)
	for _, ability := range domain.AllAbilities {
		// Check if already equipped
		existingLevel := 0
		for _, slot := range build.AbilitySlots {
			if slot.Type == ability.Type {
				existingLevel = slot.Level
				break
			}
		}

		if existingLevel > 0 {
			// Can upgrade if below max level
			if existingLevel < AbilityMaxLevel {
				candidates = append(candidates, domain.UpgradeChoice{
					ID:           fmt.Sprintf("ability_%s_lv%d", ability.Type, existingLevel+1),
					Type:         "ability",
					Name:         fmt.Sprintf("%s Lv%d", ability.Name, existingLevel+1),
					Description:  ability.Description,
					Tier:         "A",
					AbilityType:  ability.Type,
					AbilityLevel: existingLevel + 1,
				})
			}
		} else {
			// New ability — only if slots available
			maxSlots := build.MaxAbilities
			if maxSlots == 0 {
				maxSlots = AbilityBaseSlots
			}
			if equippedCount < maxSlots {
				candidates = append(candidates, domain.UpgradeChoice{
					ID:           fmt.Sprintf("ability_%s_lv1", ability.Type),
					Type:         "ability",
					Name:         ability.Name,
					Description:  ability.Description,
					Tier:         "A",
					AbilityType:  ability.Type,
					AbilityLevel: 1,
				})
			}
		}
	}

	if len(candidates) == 0 {
		return nil
	}

	// Weighted selection: Tome vs Ability preference
	return us.weightedSelect(candidates, UpgradeChoiceCount)
}

// weightedSelect picks up to n unique choices with Tome/Ability weight bias.
func (us *UpgradeSystem) weightedSelect(candidates []domain.UpgradeChoice, n int) []domain.UpgradeChoice {
	if len(candidates) <= n {
		return candidates
	}

	// Assign weights
	type weighted struct {
		choice domain.UpgradeChoice
		weight float64
	}
	var pool []weighted
	for _, c := range candidates {
		w := TomeChoiceWeight
		if c.Type == "ability" {
			w = AbilityChoiceWeight
		}
		pool = append(pool, weighted{choice: c, weight: w})
	}

	// Weighted random selection without replacement
	selected := make([]domain.UpgradeChoice, 0, n)
	for i := 0; i < n && len(pool) > 0; i++ {
		totalWeight := 0.0
		for _, p := range pool {
			totalWeight += p.weight
		}

		r := rand.Float64() * totalWeight
		cumulative := 0.0
		chosenIdx := 0
		for j, p := range pool {
			cumulative += p.weight
			if r <= cumulative {
				chosenIdx = j
				break
			}
		}

		selected = append(selected, pool[chosenIdx].choice)
		// Remove chosen from pool
		pool = append(pool[:chosenIdx], pool[chosenIdx+1:]...)
	}

	return selected
}

// ApplyUpgrade applies a chosen upgrade to the agent's build.
func (us *UpgradeSystem) ApplyUpgrade(agent *domain.Agent, choice domain.UpgradeChoice) {
	switch choice.Type {
	case "tome":
		us.applyTome(agent, choice)
	case "ability":
		us.applyAbility(agent, choice)
	}
}

// applyTome increments the Tome stack for the agent.
func (us *UpgradeSystem) applyTome(agent *domain.Agent, choice domain.UpgradeChoice) {
	if agent.Build.Tomes == nil {
		agent.Build.Tomes = make(map[domain.TomeType]int)
	}
	tomeDef := domain.GetTomeDef(choice.TomeType)
	if tomeDef == nil {
		return
	}
	current := agent.Build.Tomes[choice.TomeType]
	if current < tomeDef.MaxStack {
		agent.Build.Tomes[choice.TomeType] = current + 1
	}
}

// applyAbility adds or upgrades an ability in the agent's build.
func (us *UpgradeSystem) applyAbility(agent *domain.Agent, choice domain.UpgradeChoice) {
	// Check if ability is already equipped
	for i := range agent.Build.AbilitySlots {
		if agent.Build.AbilitySlots[i].Type == choice.AbilityType {
			// Upgrade existing ability
			if agent.Build.AbilitySlots[i].Level < AbilityMaxLevel {
				agent.Build.AbilitySlots[i].Level = choice.AbilityLevel
			}
			return
		}
	}

	// New ability — check slot availability
	maxSlots := agent.Build.MaxAbilities
	if maxSlots == 0 {
		maxSlots = AbilityBaseSlots
	}
	if len(agent.Build.AbilitySlots) >= maxSlots {
		return // no slot available
	}

	agent.Build.AbilitySlots = append(agent.Build.AbilitySlots, domain.AbilitySlot{
		Type:  choice.AbilityType,
		Level: choice.AbilityLevel,
	})
}

// CheckSynergies checks which synergies the agent's build qualifies for.
// Returns IDs of newly activated synergies (not already active).
func (us *UpgradeSystem) CheckSynergies(agent *domain.Agent) []string {
	var newSynergies []string

	for _, synergy := range domain.AllSynergies {
		// Skip if already active
		alreadyActive := false
		for _, active := range agent.ActiveSynergies {
			if active == synergy.ID {
				alreadyActive = true
				break
			}
		}
		if alreadyActive {
			continue
		}

		// Check requirements
		if synergy.RequirementsMet(agent.Build) {
			agent.ActiveSynergies = append(agent.ActiveSynergies, synergy.ID)
			newSynergies = append(newSynergies, synergy.ID)
		}
	}

	return newSynergies
}

// GetAbilityEffectiveCooldown returns the cooldown ticks for an ability at a given level.
func GetAbilityEffectiveCooldown(abilityType domain.AbilityType, level int) int {
	def := domain.GetAbilityDef(abilityType)
	if def == nil {
		return 0
	}
	// Base cooldown in ticks
	baseCooldownTicks := int(def.BaseCooldownSec * float64(TickRate))

	// Each level above 1 multiplies cooldown by UpgradeCdMult (0.80)
	cdMult := 1.0
	for i := 1; i < level; i++ {
		cdMult *= AbilityUpgradeCdMult
	}

	return int(float64(baseCooldownTicks) * cdMult)
}

// GetAbilityEffectiveDamage returns the damage for an ability at a given level.
func GetAbilityEffectiveDamage(abilityType domain.AbilityType, level int) float64 {
	def := domain.GetAbilityDef(abilityType)
	if def == nil {
		return 0
	}

	dmg := def.BaseDamage
	// Each level above 1 multiplies damage by UpgradeDmgMult (1.30)
	for i := 1; i < level; i++ {
		dmg *= AbilityUpgradeDmgMult
	}

	return dmg
}
