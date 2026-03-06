package game

import (
	"encoding/json"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// Build Path System (S48)
// Pre-defined build strategies for agents and bots
// ============================================================

// BuildPath defines a complete upgrade strategy for an agent.
type BuildPath struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	Priority      []string      `json:"priority"`      // ordered upgrade type IDs (tome/ability types)
	SynergyTarget string        `json:"synergyTarget"` // target synergy ID
	PhaseStrategy PhaseStrategy `json:"phaseStrategy"`
}

// PhaseStrategy defines combat style per game phase.
type PhaseStrategy struct {
	Early CombatStyle `json:"early"` // 0-2 min
	Mid   CombatStyle `json:"mid"`   // 2-4 min
	Late  CombatStyle `json:"late"`  // 4-5 min
}

// ============================================================
// 5 Preset Build Paths
// ============================================================

var PresetBuildPaths = map[string]*BuildPath{
	"berserker": {
		ID:          "berserker",
		Name:        "Berserker",
		Description: "Maximum DPS with Damage + Cursed Tomes and Venom Aura. High risk, high reward.",
		Priority: []string{
			string(domain.TomeDamage),
			string(domain.TomeCursed),
			string(domain.AbilityVenomAura),
			string(domain.TomeSpeed),
			string(domain.AbilitySpeedDash),
		},
		SynergyTarget: "glass_cannon",
		PhaseStrategy: PhaseStrategy{
			Early: CombatStyleXPRush,
			Mid:   CombatStyleAggressive,
			Late:  CombatStyleAggressive,
		},
	},
	"tank": {
		ID:          "tank",
		Name:        "Tank",
		Description: "Maximum survivability with Armor + Regen + Shield Burst. Outlast everyone.",
		Priority: []string{
			string(domain.TomeArmor),
			string(domain.TomeRegen),
			string(domain.AbilityShieldBurst),
			string(domain.AbilityMassDrain),
			string(domain.TomeMagnet),
		},
		SynergyTarget: "iron_fortress",
		PhaseStrategy: PhaseStrategy{
			Early: CombatStyleBalanced,
			Mid:   CombatStyleDefensive,
			Late:  CombatStyleEndgame,
		},
	},
	"speedster": {
		ID:          "speedster",
		Name:        "Speedster",
		Description: "Speed + Magnet for fast orb collection and evasion. Speed Dash for escape.",
		Priority: []string{
			string(domain.TomeSpeed),
			string(domain.TomeMagnet),
			string(domain.TomeXP),
			string(domain.AbilitySpeedDash),
			string(domain.TomeLuck),
		},
		SynergyTarget: "speedster",
		PhaseStrategy: PhaseStrategy{
			Early: CombatStyleXPRush,
			Mid:   CombatStyleXPRush,
			Late:  CombatStyleBalanced,
		},
	},
	"vampire": {
		ID:          "vampire",
		Name:        "Vampire",
		Description: "Venom + Mass Drain + Regen for sustained combat. Heal while dealing damage.",
		Priority: []string{
			string(domain.AbilityVenomAura),
			string(domain.AbilityMassDrain),
			string(domain.TomeRegen),
			string(domain.TomeDamage),
			string(domain.TomeArmor),
		},
		SynergyTarget: "vampire",
		PhaseStrategy: PhaseStrategy{
			Early: CombatStyleBalanced,
			Mid:   CombatStyleAggressive,
			Late:  CombatStyleAggressive,
		},
	},
	"scholar": {
		ID:          "scholar",
		Name:        "Scholar",
		Description: "XP + Luck + Magnet for rapid leveling. Outscale enemies with more upgrades.",
		Priority: []string{
			string(domain.TomeXP),
			string(domain.TomeLuck),
			string(domain.TomeMagnet),
			string(domain.AbilityGravityWell),
			string(domain.TomeArmor),
		},
		SynergyTarget: "holy_trinity",
		PhaseStrategy: PhaseStrategy{
			Early: CombatStyleXPRush,
			Mid:   CombatStyleBalanced,
			Late:  CombatStyleEndgame,
		},
	},
}

// GetBuildPath returns a preset build path by ID.
func GetBuildPath(id string) *BuildPath {
	return PresetBuildPaths[id]
}

// AllBuildPathIDs returns all available build path IDs.
func AllBuildPathIDs() []string {
	return []string{"berserker", "tank", "speedster", "vampire", "scholar"}
}

// BuildPathToJSON serializes a build path to JSON.
func BuildPathToJSON(bp *BuildPath) ([]byte, error) {
	return json.Marshal(bp)
}

// ============================================================
// ChooseUpgradeFromPath — Main Decision Algorithm
// ============================================================

// ChooseUpgradeFromPath selects the best upgrade from choices based on the build path.
// Priority order:
//  1. Synergy completion (highest priority)
//  2. Build path priority list
//  3. Ability upgrade for existing abilities
//  4. Game context fallback (late-game defensive)
//  5. Highest synergy score fallback
func ChooseUpgradeFromPath(
	agent *domain.Agent,
	choices []domain.UpgradeChoice,
	buildPath *BuildPath,
	timeRemainingSec int,
) int {
	if len(choices) == 0 {
		return 0
	}

	// Fallback to random if no build path
	if buildPath == nil {
		return rand.Intn(len(choices))
	}

	bestIdx := 0
	bestScore := -1000

	for i, choice := range choices {
		score := scoreChoice(agent, choice, buildPath, timeRemainingSec)
		if score > bestScore {
			bestScore = score
			bestIdx = i
		}
	}

	return bestIdx
}

// scoreChoice scores a single upgrade choice based on the build path algorithm.
func scoreChoice(
	agent *domain.Agent,
	choice domain.UpgradeChoice,
	buildPath *BuildPath,
	timeRemainingSec int,
) int {
	score := 0

	// --- Priority 1: Synergy completion check ---
	if buildPath.SynergyTarget != "" {
		synScore := synergyTargetScore(agent, choice, buildPath.SynergyTarget)
		if synScore > 0 {
			score += 500 + synScore*100
		}
	}

	// Also check any synergy completion opportunity
	if choice.Type == "tome" {
		generalSynScore := synergyCompletionScore(agent, choice.TomeType)
		if generalSynScore > 0 {
			score += 300 + generalSynScore*50
		}
	}

	// --- Priority 2: Build path priority list ---
	for rank, priorityType := range buildPath.Priority {
		if matchesPriority(choice, priorityType) {
			score += 200 - rank*20 // higher rank = higher score
			break
		}
	}

	// --- Priority 3: Ability slot logic ---
	if choice.Type == "ability" {
		equippedCount := len(agent.Build.AbilitySlots)
		maxSlots := agent.Build.MaxAbilities
		if maxSlots == 0 {
			maxSlots = AbilityBaseSlots
		}

		if choice.AbilityLevel > 1 {
			// Upgrading existing ability
			score += 80 + choice.AbilityLevel*15
		} else if equippedCount < maxSlots {
			// New ability in open slot
			score += 70
		} else {
			// No slot — penalize heavily
			score -= 100
		}
	}

	// --- Priority 4: Late-game defensive bias ---
	if timeRemainingSec > 0 && timeRemainingSec < 60 {
		if choice.Type == "tome" {
			switch choice.TomeType {
			case domain.TomeArmor:
				score += 50
			case domain.TomeRegen:
				score += 45
			case domain.TomeSpeed:
				score += 25 // escape utility
			}
		}
		if choice.Type == "ability" && choice.AbilityType == domain.AbilityShieldBurst {
			score += 40
		}
	}

	// --- Priority 5: Fallback universal value ---
	if choice.Type == "tome" {
		switch choice.TomeType {
		case domain.TomeXP:
			score += 15
		case domain.TomeSpeed:
			score += 12
		case domain.TomeMagnet:
			score += 10
		}
	}

	return score
}

// synergyTargetScore returns a high score if this choice brings us closer to the target synergy.
func synergyTargetScore(agent *domain.Agent, choice domain.UpgradeChoice, targetSynergyID string) int {
	synDef := domain.GetSynergyDef(targetSynergyID)
	if synDef == nil {
		return 0
	}

	// Check if already active
	for _, active := range agent.ActiveSynergies {
		if active == targetSynergyID {
			return 0
		}
	}

	// Check if this choice contributes to the target synergy
	if choice.Type == "tome" {
		required, needed := synDef.TomeReqs[choice.TomeType]
		if !needed {
			return 0
		}
		current := agent.Build.Tomes[choice.TomeType]
		if current >= required {
			return 0 // already satisfied
		}
		// Count remaining
		remaining := countSynergyRemaining(agent, synDef)
		if current+1 >= required {
			remaining--
		}
		if remaining <= 0 {
			return 10 // would complete the synergy!
		}
		return 10 - remaining // closer = higher
	}

	if choice.Type == "ability" {
		requiredLevel, needed := synDef.AbilityReqs[choice.AbilityType]
		if !needed {
			return 0
		}
		// Check current level
		currentLevel := 0
		for _, slot := range agent.Build.AbilitySlots {
			if slot.Type == choice.AbilityType {
				currentLevel = slot.Level
				break
			}
		}
		if currentLevel >= requiredLevel {
			return 0 // already satisfied
		}
		if choice.AbilityLevel >= requiredLevel || currentLevel+1 >= requiredLevel {
			remaining := countSynergyRemaining(agent, synDef) - 1
			if remaining <= 0 {
				return 10
			}
			return 10 - remaining
		}
	}

	return 0
}

// countSynergyRemaining returns how many more upgrades needed to complete a synergy.
func countSynergyRemaining(agent *domain.Agent, synDef *domain.SynergyDef) int {
	remaining := 0
	for tome, required := range synDef.TomeReqs {
		diff := required - agent.Build.Tomes[tome]
		if diff > 0 {
			remaining += diff
		}
	}
	for ability, requiredLevel := range synDef.AbilityReqs {
		found := false
		for _, slot := range agent.Build.AbilitySlots {
			if slot.Type == ability && slot.Level >= requiredLevel {
				found = true
				break
			}
		}
		if !found {
			remaining++
		}
	}
	return remaining
}

// matchesPriority checks if a choice matches a priority type string.
func matchesPriority(choice domain.UpgradeChoice, priorityType string) bool {
	if choice.Type == "tome" {
		return string(choice.TomeType) == priorityType
	}
	if choice.Type == "ability" {
		return string(choice.AbilityType) == priorityType
	}
	return false
}

// ============================================================
// Integration with BotDecideUpgrade (existing bot.go)
// ============================================================

// BotBuildPathToBuildPath converts a BotBuildPath to a full BuildPath.
func BotBuildPathToBuildPath(bp BotBuildPath) *BuildPath {
	return PresetBuildPaths[string(bp)]
}

// ChooseUpgradeFromBotPath wraps ChooseUpgradeFromPath using the bot's build path.
// Falls back to BotDecideUpgrade if no matching BuildPath is found.
func ChooseUpgradeFromBotPath(agent *domain.Agent, choices []domain.UpgradeChoice, botPath BotBuildPath, arena *Arena) int {
	buildPath := BotBuildPathToBuildPath(botPath)
	if buildPath == nil {
		// Fallback to existing BotDecideUpgrade logic
		return BotDecideUpgrade(agent, choices, botPath, arena)
	}

	// Estimate time remaining from arena tick
	timeRemainingSec := 300 // default 5 min
	if arena != nil {
		tick := arena.GetTick()
		roundDuration := uint64(DefaultRoomConfig().RoundDurationSec * TickRate)
		if roundDuration > tick {
			timeRemainingSec = int((roundDuration - tick) / uint64(TickRate))
		}
	}

	return ChooseUpgradeFromPath(agent, choices, buildPath, timeRemainingSec)
}
