package game

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 4 — S19: NPC Monster System
// 3 NPC types: weak (20XP, HP50), medium (35XP, HP100), strong (50XP, HP200)
// Peace phase only. Spawn every 30s (5–10). AI: random move + flee on player proximity.
// Kill drops XP orbs. War phase start removes all remaining NPCs.
// ============================================================

// NPCTier identifies the NPC difficulty tier.
type NPCTier string

const (
	NPCTierWeak   NPCTier = "weak"
	NPCTierMedium NPCTier = "medium"
	NPCTierStrong NPCTier = "strong"
)

// NPCMonsterDef defines the static properties of an NPC tier.
type NPCMonsterDef struct {
	Tier     NPCTier
	HP       float64
	XPReward int
	Speed    float64 // px/s
	Radius   float64 // hitbox radius px
	FleeRange float64 // px — starts fleeing when a player is within this range
}

// NPCMonsterDefs contains the three NPC definitions.
var NPCMonsterDefs = map[NPCTier]NPCMonsterDef{
	NPCTierWeak: {
		Tier:      NPCTierWeak,
		HP:        50,
		XPReward:  20,
		Speed:     60,
		Radius:    12,
		FleeRange: 120,
	},
	NPCTierMedium: {
		Tier:      NPCTierMedium,
		HP:        100,
		XPReward:  35,
		Speed:     45,
		Radius:    16,
		FleeRange: 100,
	},
	NPCTierStrong: {
		Tier:      NPCTierStrong,
		HP:        200,
		XPReward:  50,
		Speed:     35,
		Radius:    22,
		FleeRange: 80,
	},
}

// NPCMonster represents a single NPC entity in the arena.
type NPCMonster struct {
	ID        string         `json:"id"`
	Tier      NPCTier        `json:"tier"`
	Position  domain.Position `json:"position"`
	HP        float64        `json:"hp"`
	MaxHP     float64        `json:"maxHP"`
	Heading   float64        `json:"heading"`
	Speed     float64        `json:"speed"`
	Radius    float64        `json:"radius"`
	XPReward  int            `json:"xpReward"`
	FleeRange float64        `json:"fleeRange"`
	Alive     bool           `json:"alive"`
	SpawnTick uint64         `json:"spawnTick"`
	// AI state
	wanderTarget domain.Position
	wanderTimer  int // ticks until next wander target
}

// NPC spawn constants
const (
	NPCSpawnIntervalTicks = 30 * TickRate // 30 seconds
	NPCSpawnMinCount      = 5
	NPCSpawnMaxCount      = 10
	NPCMaxTotal           = 30 // max alive NPCs per arena
	NPCWanderIntervalMin  = 3 * TickRate  // 3s
	NPCWanderIntervalMax  = 8 * TickRate  // 8s
	NPCFleeSpeedMult      = 1.5           // flee speed multiplier
)

// NPCMonsterManager manages NPC lifecycle for one arena.
type NPCMonsterManager struct {
	npcs        map[string]*NPCMonster
	nextID      int
	arenaRadius float64
	lastSpawnTick uint64
}

// NewNPCMonsterManager creates a new NPC manager.
func NewNPCMonsterManager(arenaRadius float64) *NPCMonsterManager {
	return &NPCMonsterManager{
		npcs:        make(map[string]*NPCMonster),
		nextID:      1,
		arenaRadius: arenaRadius,
	}
}

// SetArenaRadius updates the arena radius for spawning.
func (nm *NPCMonsterManager) SetArenaRadius(r float64) {
	nm.arenaRadius = r
}

// generateID returns a unique NPC ID.
func (nm *NPCMonsterManager) generateID() string {
	id := fmt.Sprintf("npc_%d", nm.nextID)
	nm.nextID++
	return id
}

// SpawnWave spawns a wave of NPCs during the peace phase.
// Called every NPCSpawnIntervalTicks. Spawns 5–10 NPCs of random tiers.
func (nm *NPCMonsterManager) SpawnWave(currentTick uint64) []*NPCMonster {
	alive := nm.CountAlive()
	if alive >= NPCMaxTotal {
		return nil
	}

	count := NPCSpawnMinCount + rand.Intn(NPCSpawnMaxCount-NPCSpawnMinCount+1)
	remaining := NPCMaxTotal - alive
	if count > remaining {
		count = remaining
	}

	spawned := make([]*NPCMonster, 0, count)
	for i := 0; i < count; i++ {
		tier := randomNPCTier()
		def := NPCMonsterDefs[tier]
		pos := nm.randomPosition()

		npc := &NPCMonster{
			ID:           nm.generateID(),
			Tier:         tier,
			Position:     pos,
			HP:           def.HP,
			MaxHP:        def.HP,
			Heading:      rand.Float64() * 2 * math.Pi,
			Speed:        def.Speed,
			Radius:       def.Radius,
			XPReward:     def.XPReward,
			FleeRange:    def.FleeRange,
			Alive:        true,
			SpawnTick:    currentTick,
			wanderTarget: pos,
			wanderTimer:  rand.Intn(NPCWanderIntervalMax-NPCWanderIntervalMin) + NPCWanderIntervalMin,
		}
		nm.npcs[npc.ID] = npc
		spawned = append(spawned, npc)
	}

	nm.lastSpawnTick = currentTick
	return spawned
}

// ShouldSpawn returns true if it's time to spawn a new wave.
func (nm *NPCMonsterManager) ShouldSpawn(currentTick uint64) bool {
	if nm.lastSpawnTick == 0 {
		return true // First spawn
	}
	return currentTick-nm.lastSpawnTick >= NPCSpawnIntervalTicks
}

// Tick updates all alive NPCs (movement + AI).
// `agents` is used for flee detection.
func (nm *NPCMonsterManager) Tick(agents map[string]*domain.Agent) {
	for _, npc := range nm.npcs {
		if !npc.Alive {
			continue
		}
		nm.updateNPCAI(npc, agents)
	}
}

// updateNPCAI handles NPC movement: wander randomly, flee from nearby players.
func (nm *NPCMonsterManager) updateNPCAI(npc *NPCMonster, agents map[string]*domain.Agent) {
	// 1. Check for nearby player → flee
	fleeing := false
	var fleeDir float64
	closestDistSq := npc.FleeRange * npc.FleeRange

	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		dx := agent.Position.X - npc.Position.X
		dy := agent.Position.Y - npc.Position.Y
		distSq := dx*dx + dy*dy
		if distSq < closestDistSq {
			closestDistSq = distSq
			// Flee AWAY from the player
			fleeDir = math.Atan2(-dy, -dx)
			fleeing = true
		}
	}

	movePerTick := npc.Speed / TickRate
	if fleeing {
		movePerTick *= NPCFleeSpeedMult
		npc.Heading = fleeDir
	} else {
		// Wander AI
		npc.wanderTimer--
		if npc.wanderTimer <= 0 {
			// Pick new wander target within arena
			npc.wanderTarget = nm.randomPosition()
			npc.wanderTimer = rand.Intn(NPCWanderIntervalMax-NPCWanderIntervalMin) + NPCWanderIntervalMin
		}

		dx := npc.wanderTarget.X - npc.Position.X
		dy := npc.wanderTarget.Y - npc.Position.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		if dist > 5 {
			npc.Heading = math.Atan2(dy, dx)
		}
	}

	// Move
	npc.Position.X += math.Cos(npc.Heading) * movePerTick
	npc.Position.Y += math.Sin(npc.Heading) * movePerTick

	// Clamp within arena
	distFromCenter := math.Sqrt(npc.Position.X*npc.Position.X + npc.Position.Y*npc.Position.Y)
	maxR := nm.arenaRadius * 0.9
	if distFromCenter > maxR {
		scale := maxR / distFromCenter
		npc.Position.X *= scale
		npc.Position.Y *= scale
		// Turn around
		npc.Heading += math.Pi
		npc.wanderTarget = nm.randomPosition()
	}
}

// DamageNPC applies damage to an NPC. Returns (killed, xpReward).
func (nm *NPCMonsterManager) DamageNPC(npcID string, damage float64) (killed bool, xpReward int) {
	npc, ok := nm.npcs[npcID]
	if !ok || !npc.Alive {
		return false, 0
	}

	npc.HP -= damage
	if npc.HP <= 0 {
		npc.HP = 0
		npc.Alive = false
		return true, npc.XPReward
	}
	return false, 0
}

// GetNPC returns an NPC by ID, or nil.
func (nm *NPCMonsterManager) GetNPC(npcID string) *NPCMonster {
	return nm.npcs[npcID]
}

// RemoveAllAlive removes all alive NPCs (called when war phase starts).
func (nm *NPCMonsterManager) RemoveAllAlive() int {
	removed := 0
	for id, npc := range nm.npcs {
		if npc.Alive {
			npc.Alive = false
			delete(nm.npcs, id)
			removed++
		}
	}
	return removed
}

// ClearDead removes dead NPCs from the map (garbage collection).
func (nm *NPCMonsterManager) ClearDead() {
	for id, npc := range nm.npcs {
		if !npc.Alive {
			delete(nm.npcs, id)
		}
	}
}

// GetAliveNPCs returns all alive NPCs as a slice.
func (nm *NPCMonsterManager) GetAliveNPCs() []*NPCMonster {
	result := make([]*NPCMonster, 0, len(nm.npcs))
	for _, npc := range nm.npcs {
		if npc.Alive {
			result = append(result, npc)
		}
	}
	return result
}

// CountAlive returns the number of alive NPCs.
func (nm *NPCMonsterManager) CountAlive() int {
	count := 0
	for _, npc := range nm.npcs {
		if npc.Alive {
			count++
		}
	}
	return count
}

// GetDropPosition returns the NPC's position (for XP orb drop on death).
func (nm *NPCMonsterManager) GetDropPosition(npcID string) (domain.Position, bool) {
	npc, ok := nm.npcs[npcID]
	if !ok {
		return domain.Position{}, false
	}
	return npc.Position, true
}

// randomPosition returns a random position within the arena.
func (nm *NPCMonsterManager) randomPosition() domain.Position {
	angle := rand.Float64() * 2 * math.Pi
	r := nm.arenaRadius * math.Sqrt(rand.Float64()) * 0.85
	return domain.Position{
		X: math.Cos(angle) * r,
		Y: math.Sin(angle) * r,
	}
}

// randomNPCTier returns a random NPC tier with weighted distribution.
// 50% weak, 35% medium, 15% strong.
func randomNPCTier() NPCTier {
	roll := rand.Float64()
	switch {
	case roll < 0.50:
		return NPCTierWeak
	case roll < 0.85:
		return NPCTierMedium
	default:
		return NPCTierStrong
	}
}

// NPCNetworkData is the serialized NPC data sent to clients.
type NPCNetworkData struct {
	ID       string  `json:"id"`
	Tier     string  `json:"tier"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	HP       float64 `json:"hp"`
	MaxHP    float64 `json:"maxHP"`
	Heading  float64 `json:"h"`
	Radius   float64 `json:"r"`
	XPReward int     `json:"xp"`
}

// SerializeNPCs converts alive NPCs to network data.
func (nm *NPCMonsterManager) SerializeNPCs() []NPCNetworkData {
	result := make([]NPCNetworkData, 0, nm.CountAlive())
	for _, npc := range nm.npcs {
		if !npc.Alive {
			continue
		}
		result = append(result, NPCNetworkData{
			ID:       npc.ID,
			Tier:     string(npc.Tier),
			X:        npc.Position.X,
			Y:        npc.Position.Y,
			HP:       npc.HP,
			MaxHP:    npc.MaxHP,
			Heading:  npc.Heading,
			Radius:   npc.Radius,
			XPReward: npc.XPReward,
		})
	}
	return result
}
