package game

import (
	"fmt"
	"math/rand"

	"github.com/to-nexus/snake-server/internal/domain"
)

// UpgradeSystem manages the level-up upgrade choice generation and application.
type UpgradeSystem struct{}

// NewUpgradeSystem creates a new upgrade system.
func NewUpgradeSystem() *UpgradeSystem {
	return &UpgradeSystem{}
}

// GenerateChoices creates 3 random upgrade choices for the agent.
// ~35% Ability, ~65% Tome probability per slot.
func (u *UpgradeSystem) GenerateChoices(agent *Agent) []domain.UpgradeChoice {
	build := &agent.Build
	choices := make([]domain.UpgradeChoice, 0, domain.ChoicesPerLevel)
	usedIDs := make(map[string]bool)

	for len(choices) < domain.ChoicesPerLevel {
		var choice *domain.UpgradeChoice

		if rand.Float64() < domain.AbilityOfferChance {
			choice = u.genAbilityChoice(build, usedIDs)
		}

		// Fallback to Tome if Ability generation failed
		if choice == nil {
			choice = u.genTomeChoice(build, usedIDs)
		}

		if choice != nil {
			choices = append(choices, *choice)
			usedIDs[choice.ID] = true
		} else {
			// If we can't generate anything, break to avoid infinite loop
			break
		}
	}

	return choices
}

// genTomeChoice generates a random Tome upgrade choice.
func (u *UpgradeSystem) genTomeChoice(build *domain.PlayerBuild, usedIDs map[string]bool) *domain.UpgradeChoice {
	// Filter available tomes (not at max stacks, not already chosen)
	var available []domain.TomeType
	for _, tt := range domain.AllTomeTypes {
		def := domain.TomeDefs[tt]
		id := fmt.Sprintf("tome_%s", tt)
		if build.Tomes[tt] < def.MaxStacks && !usedIDs[id] {
			available = append(available, tt)
		}
	}

	if len(available) == 0 {
		return nil
	}

	tomeType := available[rand.Intn(len(available))]
	def := domain.TomeDefs[tomeType]

	return &domain.UpgradeChoice{
		ID:            fmt.Sprintf("tome_%s", tomeType),
		Type:          "tome",
		TomeType:      tomeType,
		Name:          def.Name,
		Description:   def.Description,
		CurrentStacks: build.Tomes[tomeType],
	}
}

// genAbilityChoice generates a random Ability upgrade choice.
func (u *UpgradeSystem) genAbilityChoice(build *domain.PlayerBuild, usedIDs map[string]bool) *domain.UpgradeChoice {
	// Find upgradeable existing abilities
	var upgradeable []domain.AbilitySlot
	for _, slot := range build.Abilities {
		id := fmt.Sprintf("ability_%s", slot.Type)
		if slot.Level < domain.MaxAbilityLevel && !usedIDs[id] {
			upgradeable = append(upgradeable, slot)
		}
	}

	// Find new abilities (if slot available)
	ownedTypes := make(map[domain.AbilityType]bool)
	for _, slot := range build.Abilities {
		ownedTypes[slot.Type] = true
	}

	var newAbilities []domain.AbilityType
	for _, at := range domain.AllAbilityTypes {
		id := fmt.Sprintf("ability_%s", at)
		if !ownedTypes[at] && !usedIDs[id] {
			newAbilities = append(newAbilities, at)
		}
	}

	canAddNew := len(build.Abilities) < domain.MaxAbilitySlots

	// 50/50: upgrade existing vs add new (if possible)
	if len(upgradeable) > 0 && (!canAddNew || rand.Float64() < 0.5) {
		slot := upgradeable[rand.Intn(len(upgradeable))]
		def := domain.AbilityDefs[slot.Type]
		return &domain.UpgradeChoice{
			ID:           fmt.Sprintf("ability_%s", slot.Type),
			Type:         "ability",
			AbilityType:  slot.Type,
			Name:         fmt.Sprintf("%s Lv%d", def.Name, slot.Level+1),
			Description:  fmt.Sprintf("%s (upgrade)", def.Description),
			CurrentLevel: slot.Level,
		}
	}

	if canAddNew && len(newAbilities) > 0 {
		abilityType := newAbilities[rand.Intn(len(newAbilities))]
		def := domain.AbilityDefs[abilityType]
		return &domain.UpgradeChoice{
			ID:          fmt.Sprintf("ability_%s", abilityType),
			Type:        "ability",
			AbilityType: abilityType,
			Name:        def.Name,
			Description: def.Description,
		}
	}

	return nil
}

// ApplyChoice applies a selected upgrade to the agent.
func (u *UpgradeSystem) ApplyChoice(agent *Agent, choiceID string) error {
	if agent.PendingChoices == nil {
		return fmt.Errorf("no pending choices")
	}

	var chosen *domain.UpgradeChoice
	for i := range agent.PendingChoices {
		if agent.PendingChoices[i].ID == choiceID {
			chosen = &agent.PendingChoices[i]
			break
		}
	}

	if chosen == nil {
		return fmt.Errorf("choice %s not found in pending choices", choiceID)
	}

	build := &agent.Build

	if chosen.Type == "tome" && chosen.TomeType != "" {
		def := domain.TomeDefs[chosen.TomeType]
		if build.Tomes[chosen.TomeType] < def.MaxStacks {
			build.Tomes[chosen.TomeType]++
		}
	} else if chosen.Type == "ability" && chosen.AbilityType != "" {
		// Check if ability already owned (upgrade)
		found := false
		for i := range build.Abilities {
			if build.Abilities[i].Type == chosen.AbilityType {
				if build.Abilities[i].Level < domain.MaxAbilityLevel {
					build.Abilities[i].Level++
				}
				found = true
				break
			}
		}

		// New ability
		if !found && len(build.Abilities) < domain.MaxAbilitySlots {
			build.Abilities = append(build.Abilities, domain.AbilitySlot{
				Type:          chosen.AbilityType,
				Level:         1,
				CooldownUntil: 0,
			})
		}
	}

	// Clear pending choices
	agent.PendingChoices = nil
	agent.UpgradeDeadline = 0

	return nil
}

// ApplyRandomChoice selects a random pending choice (for timeout).
func (u *UpgradeSystem) ApplyRandomChoice(agent *Agent) {
	if agent.PendingChoices == nil || len(agent.PendingChoices) == 0 {
		return
	}
	choice := agent.PendingChoices[rand.Intn(len(agent.PendingChoices))]
	_ = u.ApplyChoice(agent, choice.ID)
}

// CheckSynergies returns the list of active synergy IDs for the given build.
func (u *UpgradeSystem) CheckSynergies(build domain.PlayerBuild) []string {
	var active []string
	for _, syn := range domain.AllSynergies {
		if u.meetsSynergyRequirements(build, syn) {
			active = append(active, syn.ID)
		}
	}
	return active
}

// meetsSynergyRequirements checks if a build satisfies a synergy's requirements.
func (u *UpgradeSystem) meetsSynergyRequirements(build domain.PlayerBuild, syn domain.SynergyDef) bool {
	// Check tome requirements
	for tomeType, minStacks := range syn.Requirements.Tomes {
		if build.Tomes[tomeType] < minStacks {
			return false
		}
	}

	// Check ability requirements
	for abilityType, minLevel := range syn.Requirements.Abilities {
		found := false
		for _, slot := range build.Abilities {
			if slot.Type == abilityType && slot.Level >= minLevel {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	return true
}

// ─── Bot Smart Upgrade Decision Logic (S29) ───

// ScoreUpgradeChoice evaluates an upgrade choice for a bot with a given build path.
// Returns a score where higher is better.
func (u *UpgradeSystem) ScoreUpgradeChoice(choice domain.UpgradeChoice, agent *Agent, buildPath domain.BotBuildPath) float64 {
	prefs, ok := domain.BotBuildPreferences[buildPath]
	if !ok {
		prefs = domain.BotBuildPreferences[domain.BuildBalanced]
	}

	if choice.Type == "tome" {
		return u.scoreTomeChoice(choice, agent, prefs)
	}
	if choice.Type == "ability" {
		return u.scoreAbilityChoice(choice, agent, prefs)
	}
	return 0
}

// scoreTomeChoice calculates the value of stacking a Tome further.
// tomeValue = (currentStacks+1) * effectPerStack * priorityWeight
func (u *UpgradeSystem) scoreTomeChoice(choice domain.UpgradeChoice, agent *Agent, prefs domain.BotBuildPreference) float64 {
	def, ok := domain.TomeDefs[choice.TomeType]
	if !ok {
		return 0
	}

	currentStacks := agent.Build.Tomes[choice.TomeType]
	nextStacks := currentStacks + 1
	if nextStacks > def.MaxStacks {
		return 0
	}

	// Base tome value: effect of next stack
	tomeValue := float64(nextStacks) * def.EffectPerStack

	// Priority weight from build path
	priorityWeight := 1.0
	for i, pt := range prefs.TomePriority {
		if pt == choice.TomeType {
			priorityWeight = 3.0 - float64(i)*0.5 // First priority = 3.0, second = 2.5, third = 2.0
			break
		}
	}

	// Diminishing returns at high stacks
	stackPenalty := 1.0 - float64(currentStacks)*0.05
	if stackPenalty < 0.5 {
		stackPenalty = 0.5
	}

	return tomeValue * priorityWeight * stackPenalty
}

// scoreAbilityChoice calculates the value of an Ability choice.
// synergyScore considers how much it contributes toward unlocking synergies.
func (u *UpgradeSystem) scoreAbilityChoice(choice domain.UpgradeChoice, agent *Agent, prefs domain.BotBuildPreference) float64 {
	baseScore := 1.0

	// Priority weight from build path
	priorityWeight := 1.0
	for i, pa := range prefs.AbilityPriority {
		if pa == choice.AbilityType {
			priorityWeight = 3.0 - float64(i)*0.5
			break
		}
	}

	// Synergy contribution score
	synergyScore := u.calcSynergyContribution(choice, agent)

	// Upgrade existing ability has bonus value
	if choice.CurrentLevel > 0 {
		baseScore *= 1.3 // upgrading an existing ability is slightly better
	}

	return (baseScore + synergyScore) * priorityWeight
}

// calcSynergyContribution checks how many synergies this choice would help unlock.
func (u *UpgradeSystem) calcSynergyContribution(choice domain.UpgradeChoice, agent *Agent) float64 {
	score := 0.0

	for _, syn := range domain.AllSynergies {
		// Skip already active synergies
		if agent.HasSynergy(syn.ID) {
			continue
		}

		// Check how much closer this choice gets us to this synergy
		if choice.Type == "ability" {
			for abilityType, minLevel := range syn.Requirements.Abilities {
				if domain.AbilityType(abilityType) == choice.AbilityType {
					// Check if we have this ability and at what level
					currentLevel := 0
					for _, slot := range agent.Build.Abilities {
						if slot.Type == choice.AbilityType {
							currentLevel = slot.Level
							break
						}
					}
					if currentLevel < minLevel {
						// This choice brings us closer to synergy
						score += 2.0
					}
				}
			}
		} else if choice.Type == "tome" {
			for tomeType, minStacks := range syn.Requirements.Tomes {
				if domain.TomeType(tomeType) == choice.TomeType {
					if agent.Build.Tomes[choice.TomeType] < minStacks {
						score += 1.5
					}
				}
			}
		}
	}

	return score
}

// SmartChooseUpgrade uses the scoring system to pick the best upgrade for a bot.
// Returns the best choice ID, or empty string if no choices available.
func (u *UpgradeSystem) SmartChooseUpgrade(agent *Agent, buildPath domain.BotBuildPath) string {
	if agent.PendingChoices == nil || len(agent.PendingChoices) == 0 {
		return ""
	}

	bestScore := -1.0
	bestID := ""

	for _, choice := range agent.PendingChoices {
		score := u.ScoreUpgradeChoice(choice, agent, buildPath)

		// Spec: synergyScore > tomeValue * 1.5 → favor Ability
		// This is inherently captured by the scoring system,
		// but we add an explicit synergy bonus threshold
		if choice.Type == "ability" {
			synergyContrib := u.calcSynergyContribution(choice, agent)
			if synergyContrib > 3.0 { // significant synergy contribution
				score *= 1.5
			}
		}

		if score > bestScore {
			bestScore = score
			bestID = choice.ID
		}
	}

	if bestID == "" && len(agent.PendingChoices) > 0 {
		bestID = agent.PendingChoices[0].ID
	}

	return bestID
}

// ProcessTimeouts auto-selects for agents whose upgrade deadline has passed.
// Uses SmartChooseUpgrade (balanced build path) instead of random for better agent decisions.
func (u *UpgradeSystem) ProcessTimeouts(agents map[string]*Agent, tick uint64) {
	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		if agent.PendingChoices != nil && tick >= agent.UpgradeDeadline {
			// Use SmartChooseUpgrade with balanced build path for timeout auto-selection
			bestID := u.SmartChooseUpgrade(agent, domain.BuildBalanced)
			if bestID != "" {
				_ = u.ApplyChoice(agent, bestID)
			} else {
				u.ApplyRandomChoice(agent)
			}
			// Update synergies after auto-choice
			agent.ActiveSynergies = u.CheckSynergies(agent.Build)
		}
	}
}
