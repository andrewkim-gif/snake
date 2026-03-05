package game

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/to-nexus/snake-server/internal/domain"
)

// ─── Bot Names ───

var botNames = []string{
	"Slinky", "Nibbler", "Zigzag", "Viper", "Comet",
	"Noodle", "Blitz", "Shadow", "Spark", "Twister",
	"Dash", "Fang", "Ripple", "Echo", "Bolt",
	"Pixel", "Ghost", "Flash", "Storm", "Orbit",
	"Ace", "Rex", "Sly", "Frost", "Blaze",
	"Luna", "Nova", "Grim", "Hex", "Jinx",
}

// ─── Bot Difficulty ───

type BotDifficulty int

const (
	BotEasy BotDifficulty = iota
	BotMedium
	BotHard
)

// ─── Bot Build Paths ───

var allBuildPaths = []domain.BotBuildPath{
	domain.BuildAggressive,
	domain.BuildTank,
	domain.BuildXPRush,
	domain.BuildBalanced,
	domain.BuildGlassCannon,
}

// ─── Bot State ───

type BotState struct {
	ID           string
	Difficulty   BotDifficulty
	BuildPath    domain.BotBuildPath
	WanderAngle  float64
	WanderTimer  int
	BoostTimer   int
	StuckTimer   int
	LastPosition domain.Position
}

// ─── BotAction ───

type BotAction struct {
	TargetAngle float64
	Boost       bool
}

// ─── BotManager ───

// BotManager manages AI-controlled bots in an arena.
type BotManager struct {
	bots       map[string]*BotState
	maxBots    int
	botCounter int
}

// NewBotManager creates a new BotManager.
func NewBotManager(maxBots int) *BotManager {
	return &BotManager{
		bots:    make(map[string]*BotState, maxBots),
		maxBots: maxBots,
	}
}

// SpawnBots creates initial bots in the arena.
func (bm *BotManager) SpawnBots(arena *Arena) {
	for bm.botCount() < bm.maxBots {
		bm.spawnBot(arena)
	}
}

// Update runs AI for all bots and handles level-up auto-selection.
func (bm *BotManager) Update(arena *Arena) {
	for botID, bot := range bm.bots {
		agent, ok := arena.GetAgent(botID)
		if !ok || !agent.Alive {
			continue
		}

		// Auto-select upgrade if pending
		if agent.PendingChoices != nil && len(agent.PendingChoices) > 0 {
			bm.autoChooseUpgrade(agent, bot.BuildPath, arena)
		}

		// Run AI behavior tree
		bm.updateBotAI(botID, bot, arena)
	}
}

// ReplaceDead removes dead bots and spawns replacements.
func (bm *BotManager) ReplaceDead(arena *Arena) {
	// Collect dead bot IDs
	var dead []string
	for botID := range bm.bots {
		agent, ok := arena.GetAgent(botID)
		if !ok || !agent.Alive {
			dead = append(dead, botID)
		}
	}

	// Remove dead
	for _, botID := range dead {
		delete(bm.bots, botID)
		arena.RemoveAgent(botID)
	}

	// Spawn replacements
	for bm.botCount() < bm.maxBots {
		bm.spawnBot(arena)
	}
}

// RemoveAll removes all bots from the arena.
func (bm *BotManager) RemoveAll() {
	bm.bots = make(map[string]*BotState, bm.maxBots)
}

// IsBot returns true if the ID belongs to a bot.
func (bm *BotManager) IsBot(id string) bool {
	_, ok := bm.bots[id]
	return ok
}

// ─── Internal ───

func (bm *BotManager) botCount() int {
	return len(bm.bots)
}

func (bm *BotManager) spawnBot(arena *Arena) {
	bm.botCounter++
	id := fmt.Sprintf("bot_%d", bm.botCounter)
	nameIdx := bm.botCounter % len(botNames)
	skinID := rand.Intn(24)

	pos := RandomPositionInCircle(arena.Config.ArenaRadius * 0.6)
	arena.AddAgent(id, botNames[nameIdx], skinID, pos)

	// Mark as bot
	if agent, ok := arena.GetAgent(id); ok {
		agent.IsBot = true
	}

	bm.bots[id] = &BotState{
		ID:           id,
		Difficulty:   pickDifficulty(),
		BuildPath:    allBuildPaths[rand.Intn(len(allBuildPaths))],
		WanderAngle:  rand.Float64() * 2 * math.Pi,
		WanderTimer:  0,
		BoostTimer:   0,
		StuckTimer:   0,
		LastPosition: pos,
	}
}

func pickDifficulty() BotDifficulty {
	roll := rand.Float64()
	if roll < 0.4 {
		return BotEasy
	}
	if roll < 0.8 {
		return BotMedium
	}
	return BotHard
}

// autoChooseUpgrade selects an upgrade using the smart scoring system.
func (bm *BotManager) autoChooseUpgrade(agent *Agent, buildPath domain.BotBuildPath, arena *Arena) {
	choices := agent.PendingChoices
	if len(choices) == 0 {
		return
	}

	// Use the smart scoring system from UpgradeSystem
	bestID := arena.upgrade.SmartChooseUpgrade(agent, buildPath)
	if bestID != "" {
		arena.ChooseUpgrade(agent.ID, bestID)
	}
}

// ─── Bot AI Behavior Tree ───

func (bm *BotManager) updateBotAI(botID string, bot *BotState, arena *Arena) {
	agent, ok := arena.GetAgent(botID)
	if !ok || !agent.Alive {
		return
	}

	pos := agent.Position
	cfg := arena.Config

	// Check for AI override (Commander mode)
	if overrideAction := ProcessAIOverride(agent, arena, arena.GetTick()); overrideAction != nil {
		boostInt := 0
		if overrideAction.Boost {
			boostInt = 1
		}
		arena.ApplyInput(InputMsg{
			AgentID: botID,
			Angle:   normalizeAngle(overrideAction.TargetAngle),
			Boost:   boostInt,
			Seq:     0,
		})
		return
	}

	// Find nearby agents for decision making
	nearbyAgent := arena.FindNearbyAgent(botID, pos, 400)

	// Behavior tree: survive → hunt → gather → wander
	var action *BotAction

	// P0: Survive (boundary + threat avoidance)
	action = behaveSurvive(agent, cfg, nearbyAgent, arena)

	// P1: Hunt (medium/hard only)
	if action == nil {
		action = behaveHunt(agent, bot.Difficulty, arena, cfg)
	}

	// P2: Gather (orbs)
	if action == nil {
		action = behaveGather(agent, bot.Difficulty, arena, cfg)
	}

	// P3: Wander
	if action == nil {
		wAction, newAngle, newTimer := behaveWander(bot.WanderAngle, bot.WanderTimer, pos, cfg.ArenaRadius)
		action = &wAction
		bot.WanderAngle = newAngle
		bot.WanderTimer = newTimer
	}

	// Stuck detection
	dx := pos.X - bot.LastPosition.X
	dy := pos.Y - bot.LastPosition.Y
	if dx*dx+dy*dy < 4 {
		bot.StuckTimer++
		if bot.StuckTimer > 60 {
			action.TargetAngle = rand.Float64() * 2 * math.Pi
			bot.StuckTimer = 0
		}
	} else {
		bot.StuckTimer = 0
		bot.LastPosition = pos
	}

	// Apply input
	boostInt := 0
	if action.Boost {
		boostInt = 1
	}
	arena.ApplyInput(InputMsg{
		AgentID: botID,
		Angle:   normalizeAngle(action.TargetAngle),
		Boost:   boostInt,
		Seq:     0,
	})
}

// ─── Behavior Functions ───

// behaveSurvive: P0 — boundary avoidance + threat evasion.
func behaveSurvive(agent *Agent, cfg ArenaConfig, nearbyAgent *Agent, arena *Arena) *BotAction {
	pos := agent.Position
	distFromCenter := distanceFromOrigin(pos)
	currentRadius := arena.GetCurrentRadius()
	distRatio := distFromCenter / currentRadius

	// Boundary avoidance: flee toward center when past 85%
	if distRatio > 0.85 {
		centerAngle := math.Atan2(-pos.Y, -pos.X)
		offset := (rand.Float64() - 0.5) * math.Pi * 0.5
		return &BotAction{
			TargetAngle: centerAngle + offset,
			Boost:       distRatio > 0.92,
		}
	}

	// Threat avoidance: flee from much larger agents (1.5x mass) within 80px
	if nearbyAgent != nil && nearbyAgent.Alive && nearbyAgent.ID != agent.ID {
		otherPos := nearbyAgent.Position
		dist := distance(pos, otherPos)

		if dist < 80 && nearbyAgent.Mass > agent.Mass*1.5 {
			// Check if they're heading toward us
			headingToMe := math.Atan2(pos.Y-otherPos.Y, pos.X-otherPos.X)
			headingDiff := nearbyAgent.Heading - math.Atan2(otherPos.Y-pos.Y, otherPos.X-pos.X)
			// Normalize
			for headingDiff > math.Pi {
				headingDiff -= 2 * math.Pi
			}
			for headingDiff < -math.Pi {
				headingDiff += 2 * math.Pi
			}

			if math.Abs(headingDiff) < math.Pi/2 {
				return &BotAction{
					TargetAngle: headingToMe,
					Boost:       agent.Mass > cfg.MinBoostMass+5,
				}
			}
		}
	}

	return nil
}

// behaveHunt: P1 — chase weaker targets (medium/hard only).
func behaveHunt(agent *Agent, difficulty BotDifficulty, arena *Arena, cfg ArenaConfig) *BotAction {
	if difficulty == BotEasy {
		return nil
	}
	if agent.Mass < 40 {
		return nil
	}

	pos := agent.Position
	agents := arena.GetAgents()

	var bestTarget *Agent
	bestDist := 300.0

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		// Only hunt targets with less than 50% of our mass
		if other.Mass > agent.Mass*0.5 {
			continue
		}
		dist := distance(pos, other.Position)
		if dist < bestDist {
			bestDist = dist
			bestTarget = other
		}
	}

	if bestTarget == nil {
		return nil
	}

	targetPos := bestTarget.Position

	// Hard bots predict target position
	if difficulty == BotHard {
		predictDist := 60.0
		predictX := targetPos.X + math.Cos(bestTarget.Heading)*predictDist
		predictY := targetPos.Y + math.Sin(bestTarget.Heading)*predictDist
		return &BotAction{
			TargetAngle: math.Atan2(predictY-pos.Y, predictX-pos.X),
			Boost:       bestDist < 150,
		}
	}

	return &BotAction{
		TargetAngle: math.Atan2(targetPos.Y-pos.Y, targetPos.X-pos.X),
		Boost:       bestDist < 120 && agent.Mass > cfg.MinBoostMass+10,
	}
}

// behaveGather: P2 — collect orbs (powerup > death > natural).
func behaveGather(agent *Agent, difficulty BotDifficulty, arena *Arena, cfg ArenaConfig) *BotAction {
	pos := agent.Position
	currentRadius := arena.GetCurrentRadius()
	headDist := distanceFromOrigin(pos)
	headRatio := headDist / currentRadius

	// Helper: check if orb is too far from center
	isTooFar := func(orbPos domain.Position) bool {
		if headRatio < 0.7 {
			return false
		}
		orbDist := distanceFromOrigin(orbPos)
		return orbDist/currentRadius > 0.8
	}

	// Find nearest orb
	nearestOrb := arena.FindNearestOrb(pos, 300)

	if nearestOrb != nil && !isTooFar(*nearestOrb) {
		return &BotAction{
			TargetAngle: math.Atan2(nearestOrb.Y-pos.Y, nearestOrb.X-pos.X),
			Boost:       false,
		}
	}

	return nil
}

// behaveWander: P3 — random wandering with center bias.
func behaveWander(wanderAngle float64, wanderTimer int, pos domain.Position, mapRadius float64) (BotAction, float64, int) {
	angle := wanderAngle
	timer := wanderTimer + 1

	// Small random turn
	angle += (rand.Float64() - 0.5) * 0.08

	// Center bias when far from center
	distRatio := distanceFromOrigin(pos) / mapRadius
	if distRatio > 0.65 {
		centerAngle := math.Atan2(-pos.Y, -pos.X)
		bias := (distRatio - 0.65) * 2.0
		diff := centerAngle - angle
		// Normalize diff
		for diff > math.Pi {
			diff -= 2 * math.Pi
		}
		for diff < -math.Pi {
			diff += 2 * math.Pi
		}
		angle += diff * bias * 0.1
	}

	// Periodic direction change
	if timer > 20+int(rand.Float64()*30) {
		if distRatio > 0.7 {
			centerAngle := math.Atan2(-pos.Y, -pos.X)
			angle = centerAngle + (rand.Float64()-0.5)*math.Pi*0.8
		} else {
			angle += (rand.Float64() - 0.5) * math.Pi * 1.2
		}
		timer = 0
	}

	return BotAction{TargetAngle: angle, Boost: false}, angle, timer
}
