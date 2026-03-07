package game

import (
	"fmt"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 3: Leveling System (S14)
// Level 1→20, XP table, XP sources, 3 random choices,
// 5s timeout auto-select, epoch persistence + 1hr reset
// ============================================================

// V14MaxLevel is the maximum agent level in v14.
const V14MaxLevel = 20

// V14UpgradeChoiceCount is the number of choices per level-up.
const V14UpgradeChoiceCount = 3

// V14UpgradeTimeoutTicks is the 5-second timeout (20Hz).
const V14UpgradeTimeoutTicks = 5 * TickRate // 100

// Choice category weights
const (
	WeaponChoiceWeight      = 0.40 // 40%
	PassiveChoiceWeight     = 0.50 // 50%
	SynergyHintChoiceWeight = 0.10 // 10%
)

// ============================================================
// XP Table: Level 1→20 (50→2120 curve)
// ============================================================

// V14XPTable maps level → XP required for next level.
// Index 0 = level 1→2 (50 XP), ... index 18 = level 19→20 (2120 XP).
var V14XPTable = [V14MaxLevel]int{
	0,    // Level 1 (starting level, no XP needed)
	50,   // 1→2
	80,   // 2→3
	120,  // 3→4
	170,  // 4→5
	230,  // 5→6
	300,  // 6→7
	380,  // 7→8
	470,  // 8→9
	570,  // 9→10
	680,  // 10→11
	800,  // 11→12
	930,  // 12→13
	1070, // 13→14
	1220, // 14→15
	1380, // 15→16
	1550, // 16→17
	1730, // 17→18
	1920, // 18→19
	2120, // 19→20
}

// V14XPForNextLevel returns the XP required to advance from `level` to `level+1`.
// Returns 0 if at max level.
func V14XPForNextLevel(level int) int {
	if level < 1 || level >= V14MaxLevel {
		return 0
	}
	return V14XPTable[level]
}

// V14CumulativeXP returns total XP from level 1 to reach `level`.
func V14CumulativeXP(level int) int {
	if level < 1 || level > V14MaxLevel {
		return 0
	}
	total := 0
	for i := 1; i < level; i++ {
		total += V14XPTable[i]
	}
	return total
}

// ============================================================
// XP Sources
// ============================================================

// XP source constants
const (
	XPOrbMin          = 1  // 오브 최소 XP
	XPOrbMax          = 5  // 오브 최대 XP
	XPNPCMin          = 20 // NPC 처치 최소 XP
	XPNPCMax          = 50 // NPC 처치 최대 XP
	XPStrategicPerSec = 5  // 전략 포인트 점령 XP/s
	XPKillBase        = 100
	XPKillPerLevel    = 10
	XPAssistFraction  = 0.40 // 어시스트 = 킬 XP의 40%
)

// CalcKillXP returns the XP reward for killing a target of the given level.
func CalcKillXP(targetLevel int) int {
	return XPKillBase + targetLevel*XPKillPerLevel
}

// CalcAssistXP returns the XP for an assist (40% of kill XP).
func CalcAssistXP(targetLevel int) int {
	killXP := CalcKillXP(targetLevel)
	return int(float64(killXP) * XPAssistFraction)
}

// CalcUnderdogBonus returns extra XP percentage for killing a higher-level target.
// Level difference × 20% extra.
func CalcUnderdogBonus(killerLevel, targetLevel int) float64 {
	diff := targetLevel - killerLevel
	if diff <= 0 {
		return 0
	}
	return float64(diff) * 0.20
}

// ============================================================
// v14 XP Application
// ============================================================

// V14AddXP adds XP to the agent and returns true if leveled up.
// Applies Fortune (luck) passive bonus to XP gain.
func V14AddXP(a *domain.Agent, amount int) bool {
	if !a.Alive || a.Level >= V14MaxLevel {
		return false
	}

	// Fortune passive: +15% XP per stack (mapped to increased gain)
	fortuneStacks := 0
	if a.Passives != nil {
		fortuneStacks = a.Passives[domain.PassiveFortune]
	}
	xpMult := 1.0
	if fortuneStacks > 0 {
		xpMult += float64(fortuneStacks) * 0.15
	}

	// Legacy XP Tome bonus (backward compat)
	xpTomeStacks := a.Build.Tomes[domain.TomeXP]
	if xpTomeStacks > 0 {
		xpMult += float64(xpTomeStacks) * 0.20
	}

	// Apply synergy XP bonuses
	for _, syn := range a.ActiveSynergies {
		if syn == "holy_trinity" {
			xpMult += 0.50
		}
	}

	effectiveXP := int(float64(amount) * xpMult)
	if effectiveXP < 1 {
		effectiveXP = 1
	}
	a.XP += effectiveXP

	xpNeeded := V14XPForNextLevel(a.Level)
	if xpNeeded > 0 && a.XP >= xpNeeded {
		return true
	}
	return false
}

// V14PerformLevelUp increments the agent's level and updates XP thresholds.
func V14PerformLevelUp(a *domain.Agent) {
	if a.Level >= V14MaxLevel {
		return
	}
	xpNeeded := V14XPForNextLevel(a.Level)
	a.XP -= xpNeeded
	if a.XP < 0 {
		a.XP = 0
	}
	a.Level++
	a.XPToNext = V14XPForNextLevel(a.Level)

	// HP increase on level-up
	OnLevelUpCombat(a)
}

// ============================================================
// Level-Up Choice Generation
// ============================================================

// GenerateV14Choices generates 3 random upgrade choices for an agent.
// Weights: weapon 40%, passive 50%, synergy hint 10%.
func GenerateV14Choices(a *domain.Agent) []domain.UpgradeChoice {
	choices := make([]domain.UpgradeChoice, 0, V14UpgradeChoiceCount)
	used := make(map[string]bool) // track used choice IDs to avoid duplicates

	for len(choices) < V14UpgradeChoiceCount {
		roll := rand.Float64()
		var choice *domain.UpgradeChoice

		if roll < WeaponChoiceWeight {
			// 40%: Weapon choice
			choice = generateWeaponChoice(a, used)
		} else if roll < WeaponChoiceWeight+PassiveChoiceWeight {
			// 50%: Passive choice
			choice = generatePassiveChoice(a, used)
		} else {
			// 10%: Synergy hint
			choice = generateSynergyHintChoice(a, used)
		}

		if choice != nil {
			used[choice.ID] = true
			choices = append(choices, *choice)
		} else {
			// Fallback: try passive, then weapon
			choice = generatePassiveChoice(a, used)
			if choice == nil {
				choice = generateWeaponChoice(a, used)
			}
			if choice != nil {
				used[choice.ID] = true
				choices = append(choices, *choice)
			}
		}
	}

	return choices
}

// generateWeaponChoice creates a weapon upgrade choice.
func generateWeaponChoice(a *domain.Agent, used map[string]bool) *domain.UpgradeChoice {
	// Collect available weapons: either new weapons or existing ones not at Lv5
	type weaponOption struct {
		wt    domain.WeaponType
		level int // current level (0 = new)
	}

	var options []weaponOption

	// Existing weapons that can be evolved (not at Lv5)
	for _, slot := range a.WeaponSlots {
		if slot.Level < domain.MaxWeaponLevel {
			id := fmt.Sprintf("weapon_%s", slot.Type)
			if !used[id] {
				options = append(options, weaponOption{wt: slot.Type, level: slot.Level})
			}
		}
	}

	// New weapons (not yet acquired, if slots available)
	if len(a.WeaponSlots) < domain.MaxWeaponSlots {
		for _, wt := range domain.AllWeaponTypes {
			if !HasWeapon(a, wt) {
				id := fmt.Sprintf("weapon_%s", wt)
				if !used[id] {
					options = append(options, weaponOption{wt: wt, level: 0})
				}
			}
		}
	}

	if len(options) == 0 {
		return nil
	}

	opt := options[rand.Intn(len(options))]
	wd := domain.GetWeaponData(opt.wt)
	if wd == nil {
		return nil
	}

	id := fmt.Sprintf("weapon_%s", opt.wt)
	name := wd.Name
	desc := wd.Description
	nextLevel := opt.level + 1

	if opt.level > 0 {
		// Evolution choice
		evo := domain.GetEvolutionData(nextLevel)
		if evo != nil {
			if nextLevel == domain.MaxWeaponLevel {
				ultName := domain.UltimateWeaponNames[opt.wt]
				ultDesc := domain.UltimateWeaponDescs[opt.wt]
				name = fmt.Sprintf("%s -> %s", wd.Name, ultName)
				desc = fmt.Sprintf("ULTIMATE: %s", ultDesc)
			} else {
				name = fmt.Sprintf("%s Lv%d", wd.Name, nextLevel)
				switch nextLevel {
				case 2:
					desc = fmt.Sprintf("+30%% DMG (%.0f -> %.0f)", wd.BaseDPS, wd.BaseDPS*evo.DPSMult)
				case 3:
					desc = fmt.Sprintf("+25%% Range (%.0f -> %.0f)", wd.Range, wd.Range*evo.RangeMult)
				case 4:
					desc = fmt.Sprintf("-20%% Cooldown (%.1fs -> %.1fs)", wd.CooldownSec, wd.CooldownSec*evo.CooldownMult)
				}
			}
		}
	}

	return &domain.UpgradeChoice{
		ID:          id,
		Type:        "weapon",
		Name:        name,
		Description: desc,
		Tier:        weaponTier(nextLevel),
		WeaponType:  opt.wt,
		WeaponLevel: opt.level,
	}
}

// generatePassiveChoice creates a passive upgrade choice.
func generatePassiveChoice(a *domain.Agent, used map[string]bool) *domain.UpgradeChoice {
	passives := a.Passives
	if passives == nil {
		passives = make(map[domain.PassiveType]int)
	}

	type passiveOption struct {
		pt     domain.PassiveType
		stacks int
	}

	var options []passiveOption
	for _, pt := range domain.AllPassiveTypes {
		def := GetPassiveDef(pt)
		if def == nil {
			continue
		}
		current := passives[pt]
		if current < def.MaxStack {
			id := fmt.Sprintf("passive_%s", pt)
			if !used[id] {
				options = append(options, passiveOption{pt: pt, stacks: current})
			}
		}
	}

	if len(options) == 0 {
		return nil
	}

	opt := options[rand.Intn(len(options))]
	def := GetPassiveDef(opt.pt)
	if def == nil {
		return nil
	}

	return &domain.UpgradeChoice{
		ID:            fmt.Sprintf("passive_%s", opt.pt),
		Type:          "passive",
		Name:          def.Name,
		Description:   def.Description,
		Tier:          passiveTier(opt.stacks + 1),
		PassiveType:   opt.pt,
		PassiveStacks: opt.stacks,
		PassiveMax:    def.MaxStack,
	}
}

// generateSynergyHintChoice creates a synergy hint choice.
// Shows what synergy is closest to activation as a "hint" card.
func generateSynergyHintChoice(a *domain.Agent, used map[string]bool) *domain.UpgradeChoice {
	// Find a synergy that's closest to activation but not yet active
	bestSyn := findClosestInactiveSynergy(a)
	if bestSyn == nil {
		return nil // No synergy hints available, fallback to passive/weapon
	}

	id := fmt.Sprintf("synhint_%s", bestSyn.Type)
	if used[id] {
		return nil
	}

	def := GetV14SynergyDef(bestSyn.Type)
	if def == nil {
		return nil
	}

	// Build the "missing" description
	missing := describeMissingRequirements(a, def)

	return &domain.UpgradeChoice{
		ID:             id,
		Type:           "synergy_hint",
		Name:           def.Name,
		Description:    def.Description,
		Tier:           "S",
		SynergyType:    bestSyn.Type,
		SynergyMissing: missing,
	}
}

// synergyCandidate tracks proximity to a synergy
type synergyCandidate struct {
	Type       domain.V14SynergyType
	Completion float64 // 0.0~1.0
}

// findClosestInactiveSynergy finds the synergy closest to activation.
func findClosestInactiveSynergy(a *domain.Agent) *synergyCandidate {
	activeSynergies := make(map[domain.V14SynergyType]bool)
	for _, s := range a.V14Synergies {
		activeSynergies[s] = true
	}

	var best *synergyCandidate
	bestCompletion := -1.0

	for _, def := range AllV14Synergies {
		if activeSynergies[def.Type] {
			continue // Already active
		}
		completion := calcSynergyCompletion(a, &def)
		if completion > bestCompletion && completion > 0.2 { // At least 20% progress
			bestCompletion = completion
			best = &synergyCandidate{Type: def.Type, Completion: completion}
		}
	}
	return best
}

// ============================================================
// Auto-Select on Timeout
// ============================================================

// V14AutoSelectUpgrade selects the first choice automatically (5s timeout).
func V14AutoSelectUpgrade(a *domain.Agent) *domain.UpgradeChoice {
	if len(a.PendingChoices) == 0 {
		return nil
	}
	choice := a.PendingChoices[0]
	ApplyV14Choice(a, &choice)
	a.PendingChoices = nil
	a.UpgradeDeadline = 0
	return &choice
}

// ============================================================
// Apply Upgrade Choice
// ============================================================

// ApplyV14Choice applies the selected upgrade to the agent.
func ApplyV14Choice(a *domain.Agent, choice *domain.UpgradeChoice) {
	switch choice.Type {
	case "weapon":
		AddWeapon(a, choice.WeaponType)
	case "passive":
		if a.Passives == nil {
			a.Passives = make(map[domain.PassiveType]int)
		}
		def := GetPassiveDef(choice.PassiveType)
		if def != nil && a.Passives[choice.PassiveType] < def.MaxStack {
			a.Passives[choice.PassiveType]++
		}
		// Recalc stats affected by passives
		RecalcPassiveEffects(a)
	case "synergy_hint":
		// Synergy hints don't grant anything directly — they're informational.
		// But as a reward, give a small XP bonus.
		a.XP += 25
	case "tome":
		// Legacy tome support
		if choice.TomeType != "" {
			a.Build.Tomes[choice.TomeType]++
		}
	case "ability":
		// Legacy ability support
		if choice.AbilityType != "" {
			applyAbilityUpgrade(a, choice)
		}
	}

	// Clear pending choices
	a.PendingChoices = nil
	a.UpgradeDeadline = 0

	// Check synergies after each upgrade
	CheckAndActivateV14Synergies(a)
}

func applyAbilityUpgrade(a *domain.Agent, choice *domain.UpgradeChoice) {
	for i := range a.Build.AbilitySlots {
		if a.Build.AbilitySlots[i].Type == choice.AbilityType {
			if a.Build.AbilitySlots[i].Level < AbilityMaxLevel {
				a.Build.AbilitySlots[i].Level++
			}
			return
		}
	}
	if len(a.Build.AbilitySlots) < a.Build.MaxAbilities {
		a.Build.AbilitySlots = append(a.Build.AbilitySlots, domain.AbilitySlot{
			Type:  choice.AbilityType,
			Level: 1,
		})
	}
}

// ============================================================
// Epoch Persistence & Reset
// ============================================================

// ResetAgentProgression resets level, weapons, passives, synergies (1hr reset).
func ResetAgentProgression(a *domain.Agent) {
	a.Level = InitialLevel
	a.XP = 0
	a.XPToNext = V14XPForNextLevel(1)
	a.WeaponSlots = make([]domain.WeaponSlot, 0, domain.MaxWeaponSlots)
	a.Passives = make(map[domain.PassiveType]int)
	a.V14Synergies = nil
	a.Build = domain.PlayerBuild{
		Tomes:        make(map[domain.TomeType]int),
		AbilitySlots: make([]domain.AbilitySlot, 0),
		MaxAbilities: AbilityBaseSlots,
	}
	a.Gold = 0
	a.PendingChoices = nil
	a.UpgradeDeadline = 0
	a.Score = 0
	a.Kills = 0
	a.Deaths = 0
	a.Assists = 0
	a.KillStreak = 0
	InitAgentCombatStats(a)
}

// EpochTransition preserves level/build but resets HP (between epochs).
func EpochTransition(a *domain.Agent, spawnPos domain.Position) {
	a.Alive = true
	a.Position = spawnPos
	a.HP = a.MaxHP
	a.Invincible = false
	a.StatusEffects = make([]domain.StatusEffect, 0)
	a.Boosting = false
	a.Speed = BaseSpeed
	// Level, weapons, passives, synergies are PRESERVED
}

// ============================================================
// Tier Helpers
// ============================================================

func weaponTier(level int) string {
	switch {
	case level >= 5:
		return "S"
	case level >= 4:
		return "A"
	case level >= 3:
		return "B"
	default:
		return "C"
	}
}

func passiveTier(stacks int) string {
	switch {
	case stacks >= 5:
		return "S"
	case stacks >= 3:
		return "A"
	default:
		return "B"
	}
}

// InitV14Agent initializes v14-specific fields on an agent.
func InitV14Agent(a *domain.Agent) {
	a.XPToNext = V14XPForNextLevel(1)
	a.Passives = make(map[domain.PassiveType]int)
	a.V14Synergies = nil
	a.Gold = 0
	InitAgentCombatStats(a)
}
