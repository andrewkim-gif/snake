package game

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// BotBuildPath defines a bot's preferred upgrade strategy.
type BotBuildPath string

const (
	BuildBerserker BotBuildPath = "berserker"
	BuildTank      BotBuildPath = "tank"
	BuildSpeedster BotBuildPath = "speedster"
	BuildVampire   BotBuildPath = "vampire"
	BuildScholar   BotBuildPath = "scholar"
)

// AllBuildPaths lists all available bot build paths.
var AllBuildPaths = []BotBuildPath{
	BuildBerserker,
	BuildTank,
	BuildSpeedster,
	BuildVampire,
	BuildScholar,
}

// PersonalityToBuildPath maps personality type to preferred bot build path (S56).
var PersonalityToBuildPath = map[PersonalityType]BotBuildPath{
	PersonalityAggro:    BuildBerserker,
	PersonalityCautious: BuildTank,
	PersonalityScholar:  BuildScholar,
	PersonalityGambler:  BuildBerserker, // Gambler uses berserker (high risk build)
	PersonalityBalanced: BuildVampire,
	PersonalityAdaptive: BuildScholar, // fallback; real adaptive uses memory
}

// PersonalityToCombatStyle maps personality type to combat style (S56).
var PersonalityToCombatStyle = map[PersonalityType]CombatStyle{
	PersonalityAggro:    CombatStyleAggressive,
	PersonalityCautious: CombatStyleDefensive,
	PersonalityScholar:  CombatStyleXPRush,
	PersonalityGambler:  CombatStyleAggressive,
	PersonalityBalanced: CombatStyleBalanced,
	PersonalityAdaptive: CombatStyleBalanced,
}

// buildPathTomePrefs defines tome preferences per build path (ordered by priority).
var buildPathTomePrefs = map[BotBuildPath][]domain.TomeType{
	BuildBerserker: {domain.TomeDamage, domain.TomeCursed, domain.TomeSpeed},
	BuildTank:      {domain.TomeArmor, domain.TomeRegen, domain.TomeMagnet},
	BuildSpeedster: {domain.TomeSpeed, domain.TomeMagnet, domain.TomeXP},
	BuildVampire:   {domain.TomeRegen, domain.TomeDamage, domain.TomeLuck},
	BuildScholar:   {domain.TomeXP, domain.TomeLuck, domain.TomeMagnet},
}

// BotState tracks the current behavior state of a bot.
type BotState struct {
	ID           string
	BuildPath    BotBuildPath
	WanderAngle  float64
	WanderTicks  int
	BehaviorTick int // ticks until next behavior decision
}

// BotManager manages AI bots within a single Room's Arena.
type BotManager struct {
	bots    map[string]*BotState
	arena   *Arena
	maxBots int
	nameIdx int
}

// NewBotManager creates a new BotManager with the given max bot count.
func NewBotManager(maxBots int) *BotManager {
	return &BotManager{
		bots:    make(map[string]*BotState),
		maxBots: maxBots,
	}
}

// SetArena sets the arena reference for the bot manager.
func (bm *BotManager) SetArena(arena *Arena) {
	bm.arena = arena
}

// SpawnBots spawns the given number of bots into the arena.
func (bm *BotManager) SpawnBots(count int) {
	if bm.arena == nil {
		return
	}
	for i := 0; i < count && len(bm.bots) < bm.maxBots; i++ {
		bm.spawnOneBot()
	}
}

// spawnOneBot creates and spawns a single bot.
func (bm *BotManager) spawnOneBot() {
	name := bm.nextBotName()
	id := fmt.Sprintf("bot_%s_%d", name, bm.nameIdx)
	bm.nameIdx++

	pos := bm.arena.RandomSpawnPosition()
	skinID := rand.Intn(12) // common skins 0-11
	skin := domain.GetSkinByID(skinID)
	agent := NewAgent(id, name, pos, skin, true, bm.arena.GetTick(), "") // 봇: 빈 appearance → 클라이언트에서 skinId fallback
	bm.arena.AddAgent(agent)

	buildPath := AllBuildPaths[rand.Intn(len(AllBuildPaths))]
	bm.bots[id] = &BotState{
		ID:           id,
		BuildPath:    buildPath,
		WanderAngle:  rand.Float64() * 2 * math.Pi,
		WanderTicks:  0,
		BehaviorTick: 0,
	}
}

// UpdateBots updates all bot behaviors for one tick.
func (bm *BotManager) UpdateBots() {
	if bm.arena == nil {
		return
	}

	agents := bm.arena.GetAgents()
	currentRadius := bm.arena.GetCurrentRadius()

	for botID, state := range bm.bots {
		bot, ok := agents[botID]
		if !ok || !bot.Alive {
			continue
		}

		state.BehaviorTick--
		if state.BehaviorTick > 0 {
			continue
		}

		// Decision frequency: every 5-10 ticks (250-500ms)
		state.BehaviorTick = 5 + rand.Intn(6)

		// Choose behavior based on context
		angle, boost := bm.decideBehavior(bot, state, agents, currentRadius)
		bm.arena.HandleInput(botID, angle, boost)
	}
}

// decideBehavior selects a behavior and returns target angle + boost.
func (bm *BotManager) decideBehavior(
	bot *domain.Agent,
	state *BotState,
	agents map[string]*domain.Agent,
	currentRadius float64,
) (float64, bool) {
	// Priority 1: Escape boundary
	distFromCenter := math.Sqrt(bot.Position.X*bot.Position.X + bot.Position.Y*bot.Position.Y)
	if distFromCenter > currentRadius*0.85 {
		return bm.behaviorReturnToCenter(bot), false
	}

	// Priority 2: Survive — flee if low mass
	if bot.Mass < InitialMass*0.5 {
		if angle, ok := bm.behaviorSurvive(bot, agents); ok {
			return angle, true
		}
	}

	// Priority 3: Hunt — chase smaller nearby enemies
	if angle, ok := bm.behaviorHunt(bot, agents); ok {
		return angle, true
	}

	// Priority 4: Kite — stay at aura edge for damage
	if angle, ok := bm.behaviorKite(bot, agents); ok {
		return angle, false
	}

	// Priority 5: Gather — move toward orbs (implicit: just wander)
	// Priority 6: Wander
	return bm.behaviorWander(state), false
}

// behaviorReturnToCenter moves toward (0,0).
func (bm *BotManager) behaviorReturnToCenter(bot *domain.Agent) float64 {
	return math.Atan2(-bot.Position.Y, -bot.Position.X)
}

// behaviorSurvive flees from the nearest larger enemy.
func (bm *BotManager) behaviorSurvive(bot *domain.Agent, agents map[string]*domain.Agent) (float64, bool) {
	closestDist := math.MaxFloat64
	var closestPos *domain.Position

	for _, other := range agents {
		if other.ID == bot.ID || !other.Alive {
			continue
		}
		if other.Mass <= bot.Mass {
			continue // only flee from larger
		}
		dist := DistanceSq(bot.Position, other.Position)
		if dist < closestDist && dist < (AuraRadius*3)*(AuraRadius*3) {
			closestDist = dist
			p := other.Position
			closestPos = &p
		}
	}

	if closestPos == nil {
		return 0, false
	}

	// Run away from the threat
	fleeAngle := math.Atan2(bot.Position.Y-closestPos.Y, bot.Position.X-closestPos.X)
	return fleeAngle, true
}

// behaviorHunt chases a nearby enemy that is smaller.
func (bm *BotManager) behaviorHunt(bot *domain.Agent, agents map[string]*domain.Agent) (float64, bool) {
	closestDist := math.MaxFloat64
	var targetPos *domain.Position

	huntRange := AuraRadius * 4.0

	for _, other := range agents {
		if other.ID == bot.ID || !other.Alive {
			continue
		}
		if other.Mass >= bot.Mass*0.8 {
			continue // only hunt significantly smaller
		}
		dist := DistanceSq(bot.Position, other.Position)
		if dist < closestDist && dist < huntRange*huntRange {
			closestDist = dist
			p := other.Position
			targetPos = &p
		}
	}

	if targetPos == nil {
		return 0, false
	}

	chaseAngle := math.Atan2(targetPos.Y-bot.Position.Y, targetPos.X-bot.Position.X)
	return chaseAngle, true
}

// behaviorKite maintains distance at aura edge for sustained DPS.
func (bm *BotManager) behaviorKite(bot *domain.Agent, agents map[string]*domain.Agent) (float64, bool) {
	kiteRange := AuraRadius * 2.0

	for _, other := range agents {
		if other.ID == bot.ID || !other.Alive {
			continue
		}
		dist := DistanceBetween(bot.Position, other.Position)
		if dist < kiteRange && dist > AuraRadius*0.5 {
			// Stay at aura edge: tangent movement
			toEnemy := math.Atan2(other.Position.Y-bot.Position.Y, other.Position.X-bot.Position.X)
			// Orbit perpendicular
			return toEnemy + math.Pi/2, false
		}
	}
	return 0, false
}

// behaviorWander moves in a random direction, changing periodically.
func (bm *BotManager) behaviorWander(state *BotState) float64 {
	state.WanderTicks--
	if state.WanderTicks <= 0 {
		state.WanderAngle += (rand.Float64() - 0.5) * math.Pi * 0.5
		state.WanderTicks = 20 + rand.Intn(40)
	}
	return state.WanderAngle
}

// ReplaceBot removes a dead bot and spawns a replacement.
func (bm *BotManager) ReplaceBot(botID string) {
	delete(bm.bots, botID)
	bm.arena.RemoveAgent(botID)
	bm.spawnOneBot()
}

// RemoveBot removes a bot entirely.
func (bm *BotManager) RemoveBot(botID string) {
	delete(bm.bots, botID)
	if bm.arena != nil {
		bm.arena.RemoveAgent(botID)
	}
}

// Clear removes all bots.
func (bm *BotManager) Clear() {
	for id := range bm.bots {
		if bm.arena != nil {
			bm.arena.RemoveAgent(id)
		}
	}
	bm.bots = make(map[string]*BotState)
}

// Count returns the number of active bots.
func (bm *BotManager) Count() int {
	return len(bm.bots)
}

// GetBotBuildPath returns the build path for a given bot ID.
func (bm *BotManager) GetBotBuildPath(botID string) (BotBuildPath, bool) {
	state, ok := bm.bots[botID]
	if !ok {
		return "", false
	}
	return state.BuildPath, true
}

// GetAllBotBuildPaths returns a map of botID -> BotBuildPath for all bots.
func (bm *BotManager) GetAllBotBuildPaths() map[string]BotBuildPath {
	result := make(map[string]BotBuildPath, len(bm.bots))
	for id, state := range bm.bots {
		result[id] = state.BuildPath
	}
	return result
}

// AutoChooseUpgrade selects an upgrade based on the bot's build path.
// Enhanced with synergy awareness, late-game defensive bias, and ability slot logic.
func (bm *BotManager) AutoChooseUpgrade(botID string, choices []domain.UpgradeChoice) int {
	state, ok := bm.bots[botID]
	if !ok || len(choices) == 0 {
		return 0
	}

	agent, agentOk := bm.arena.GetAgent(botID)
	if !agentOk {
		return 0
	}

	return BotDecideUpgrade(agent, choices, state.BuildPath, bm.arena)
}

// BotDecideUpgrade implements a multi-factor decision tree for bot upgrade selection.
// Priority:
//  1. Synergy completion opportunity (highest)
//  2. Build path Tome preference
//  3. Ability slot utilization
//  4. Late-game defensive bias
//  5. Fallback: generic useful choice
func BotDecideUpgrade(agent *domain.Agent, choices []domain.UpgradeChoice, buildPath BotBuildPath, arena *Arena) int {
	if len(choices) == 0 {
		return 0
	}

	prefs, hasPrefs := buildPathTomePrefs[buildPath]

	// Determine if late game (< 60 seconds remaining ~ < 1200 ticks)
	lateGame := false
	if arena != nil {
		// Rough heuristic: if the arena has been running for a while
		tick := arena.GetTick()
		roundDuration := uint64(DefaultRoomConfig().RoundDurationSec * TickRate)
		if roundDuration > 0 && tick > roundDuration-uint64(60*TickRate) {
			lateGame = true
		}
	}

	bestIdx := 0
	bestScore := -1000

	for i, choice := range choices {
		score := 0

		if choice.Type == "tome" {
			// --- Priority 1: Synergy completion check ---
			synScore := synergyCompletionScore(agent, choice.TomeType)
			if synScore > 0 {
				score += 200 + synScore*50 // very high priority
			}

			// --- Priority 2: Build path Tome preference ---
			if hasPrefs {
				for rank, pref := range prefs {
					if choice.TomeType == pref {
						score += 100 - rank*15
						break
					}
				}
			}

			// --- Priority 4: Late-game defensive bias ---
			if lateGame {
				switch choice.TomeType {
				case domain.TomeArmor:
					score += 40
				case domain.TomeRegen:
					score += 35
				case domain.TomeSpeed:
					score += 20 // escape utility
				}
			}

			// --- Priority 5: Fallback universal value ---
			switch choice.TomeType {
			case domain.TomeXP:
				score += 15 // always useful
			case domain.TomeSpeed:
				score += 12
			case domain.TomeMagnet:
				score += 10
			}

		} else if choice.Type == "ability" {
			// --- Priority 3: Ability slot logic ---
			equippedCount := len(agent.Build.AbilitySlots)
			maxSlots := agent.Build.MaxAbilities
			if maxSlots == 0 {
				maxSlots = AbilityBaseSlots
			}

			if choice.AbilityLevel > 1 {
				// Upgrading existing ability is decent
				score += 60 + choice.AbilityLevel*10
			} else if equippedCount < maxSlots {
				// New ability in open slot
				score += 55
				// Bonus for abilities matching build path
				score += abilityBuildPathBonus(choice.AbilityType, buildPath)
			} else {
				// No slot available — should not appear, but score low
				score -= 50
			}

			// Late-game: favor Shield Burst
			if lateGame && choice.AbilityType == domain.AbilityShieldBurst {
				score += 30
			}
		}

		if score > bestScore {
			bestScore = score
			bestIdx = i
		}
	}

	return bestIdx
}

// synergyCompletionScore returns a score based on how close adding this tome
// brings the agent to completing any synergy. Higher = closer to completion.
func synergyCompletionScore(agent *domain.Agent, tomeType domain.TomeType) int {
	bestScore := 0

	for _, synergy := range domain.AllSynergies {
		// Skip already active synergies
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

		// Check if this tome is relevant to this synergy
		required, needed := synergy.TomeReqs[tomeType]
		if !needed {
			continue
		}

		current := agent.Build.Tomes[tomeType]
		if current >= required {
			continue // already satisfied for this synergy
		}

		// Count how many tome requirements remain for this synergy
		remainingReqs := 0
		totalReqs := 0
		for reqTome, reqCount := range synergy.TomeReqs {
			totalReqs++
			if agent.Build.Tomes[reqTome] < reqCount {
				remainingReqs++
			}
		}
		// Also count ability reqs
		for reqAbility, reqLevel := range synergy.AbilityReqs {
			totalReqs++
			found := false
			for _, slot := range agent.Build.AbilitySlots {
				if slot.Type == reqAbility && slot.Level >= reqLevel {
					found = true
					break
				}
			}
			if !found {
				remainingReqs++
			}
		}

		// If adding this tome reduces remaining by 1, compute closeness score
		wouldReduce := current+1 >= required
		if wouldReduce {
			remainingAfter := remainingReqs - 1
			if remainingAfter <= 0 {
				// This tome completes the synergy!
				return 10
			}
			// Closer to completion = higher score
			closeness := totalReqs - remainingAfter
			if closeness > bestScore {
				bestScore = closeness
			}
		}
	}

	return bestScore
}

// abilityBuildPathBonus returns bonus score for abilities that synergize with a build path.
func abilityBuildPathBonus(abilityType domain.AbilityType, buildPath BotBuildPath) int {
	switch buildPath {
	case BuildBerserker:
		if abilityType == domain.AbilitySpeedDash || abilityType == domain.AbilityLightningStrike {
			return 20
		}
	case BuildTank:
		if abilityType == domain.AbilityShieldBurst {
			return 25
		}
	case BuildSpeedster:
		if abilityType == domain.AbilitySpeedDash {
			return 25
		}
	case BuildVampire:
		if abilityType == domain.AbilityVenomAura || abilityType == domain.AbilityMassDrain {
			return 25
		}
	case BuildScholar:
		if abilityType == domain.AbilityGravityWell {
			return 20
		}
	}
	return 0
}

// --- Bot name pool (30+ MC-style unique names) ---

var botNames = []string{
	"Herobrine",
	"Notch_Jr",
	"BlockBreaker",
	"CreeperHugger",
	"DiamondHunter",
	"NetherWalker",
	"EnderRunner",
	"RedstoneWiz",
	"IronGolem",
	"SnowGolem",
	"ZombieSlayer",
	"SkeletonKing",
	"WitchBrewer",
	"VillagerChief",
	"PiglinTrader",
	"BlazeRunner",
	"GhastHunter",
	"ShulkerBox",
	"PhantomFlyer",
	"DrownedFisher",
	"WardenEcho",
	"AllayHelper",
	"AxolotlFan",
	"FrogJumper",
	"GoatRammer",
	"BeeKeeper",
	"FoxSneaker",
	"CatWhisker",
	"WolfPack",
	"ParrotTalker",
	"TurtleMaster",
	"DolphinDiver",
}

// nextBotName returns a bot name from the pool.
func (bm *BotManager) nextBotName() string {
	idx := bm.nameIdx % len(botNames)
	return botNames[idx]
}
