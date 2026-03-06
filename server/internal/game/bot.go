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
	agent := NewAgent(id, name, pos, skin, true, bm.arena.GetTick())
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

// behaviorCamp stays near the shrink boundary edge.
func (bm *BotManager) behaviorCamp(bot *domain.Agent, currentRadius float64) (float64, bool) {
	distFromCenter := math.Sqrt(bot.Position.X*bot.Position.X + bot.Position.Y*bot.Position.Y)
	targetDist := currentRadius * 0.75

	if distFromCenter < targetDist*0.9 {
		// Move outward
		return math.Atan2(bot.Position.Y, bot.Position.X), false
	} else if distFromCenter > targetDist*1.1 {
		// Move inward
		return math.Atan2(-bot.Position.Y, -bot.Position.X), false
	}
	// Orbit at boundary
	return math.Atan2(bot.Position.Y, bot.Position.X) + math.Pi/2, false
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

// AutoChooseUpgrade selects an upgrade based on the bot's build path.
func (bm *BotManager) AutoChooseUpgrade(botID string, choices []domain.UpgradeChoice) int {
	state, ok := bm.bots[botID]
	if !ok || len(choices) == 0 {
		return 0
	}

	// Find preferred tome from build path
	prefs, ok := buildPathTomePrefs[state.BuildPath]
	if !ok {
		return 0 // default: first choice
	}

	// Score each choice based on build path preference
	bestIdx := 0
	bestScore := -1

	for i, choice := range choices {
		score := 0
		if choice.Type == "tome" {
			for rank, pref := range prefs {
				if choice.TomeType == pref {
					score = 100 - rank*10
					break
				}
			}
		} else if choice.Type == "ability" {
			score = 50 // abilities are secondary
		}
		if score > bestScore {
			bestScore = score
			bestIdx = i
		}
	}

	return bestIdx
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
