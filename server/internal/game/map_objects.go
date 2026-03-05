package game

import (
	"math"
	"math/rand"

	"github.com/to-nexus/snake-server/internal/domain"
)

// ─── Map Object Type Constants ───

type MapObjectType string

const (
	MapObjectShrine MapObjectType = "xp_shrine"
	MapObjectSpring MapObjectType = "healing_spring"
	MapObjectAltar  MapObjectType = "upgrade_altar"
	MapObjectGate   MapObjectType = "speed_gate"
)

// ─── Map Object Constants ───

const (
	// Shrine: XP +50% buff for 10 seconds (200 ticks @ 20Hz), 60s cooldown
	ShrineBuff          = domain.EffectType("shrine_xp")
	ShrineBuffDuration  = 200   // 10s @ 20Hz
	ShrineCooldownTicks = 1200  // 60s @ 20Hz
	ShrineRadius        = 40.0  // interaction radius
	ShrineXPMultiplier  = 1.5

	// Spring: mass recovery +0.5/tick while in range, 45s cooldown after depletion
	SpringRadius        = 50.0
	SpringHealPerTick   = 0.5
	SpringMaxHeal       = 100.0  // total heal before depletion
	SpringCooldownTicks = 900    // 45s @ 20Hz

	// Altar: sacrifice 50% mass → 2 level-ups, once per round
	AltarRadius         = 35.0
	AltarMassSacrifice  = 0.5    // 50% mass cost
	AltarLevelUpReward  = 2

	// Gate: teleport to random location, 30s cooldown
	GateRadius          = 30.0
	GateCooldownTicks   = 600    // 30s @ 20Hz
	GateSpeedBuff       = 200    // 10s speed buff after teleport (placeholder, spec says 5s ×2 speed)
)

// ─── MapObject Interface ───

// MapObject defines a static interactive object on the arena map.
type MapObject interface {
	GetID() string
	GetType() MapObjectType
	GetPosition() domain.Position
	GetRadius() float64
	IsActive() bool
	OnEnter(agent *Agent, arena *Arena) bool // returns true if interaction happened
	OnTick(tick uint64)                       // per-tick update (cooldown management)
}

// ─── MapObjectState for serialization ───

// MapObjectState is the serializable state of a map object.
type MapObjectState struct {
	ID       string        `json:"id"`
	Type     MapObjectType `json:"type"`
	X        float64       `json:"x"`
	Y        float64       `json:"y"`
	Radius   float64       `json:"r"`
	Active   bool          `json:"active"`
	Cooldown int           `json:"cd,omitempty"` // remaining cooldown ticks
}

// ─── Shrine (XP Shrine) ───

// Shrine grants a temporary XP buff when an agent enters.
type Shrine struct {
	id            string
	position      domain.Position
	active        bool
	cooldownUntil uint64
}

func NewShrine(id string, pos domain.Position) *Shrine {
	return &Shrine{
		id:       id,
		position: pos,
		active:   true,
	}
}

func (s *Shrine) GetID() string                 { return s.id }
func (s *Shrine) GetType() MapObjectType         { return MapObjectShrine }
func (s *Shrine) GetPosition() domain.Position   { return s.position }
func (s *Shrine) GetRadius() float64             { return ShrineRadius }
func (s *Shrine) IsActive() bool                 { return s.active }

func (s *Shrine) OnEnter(agent *Agent, arena *Arena) bool {
	if !s.active || !agent.Alive {
		return false
	}
	// Check if agent already has shrine buff
	if agent.HasEffect(ShrineBuff) {
		return false
	}

	// Apply XP buff
	agent.AddEffect(ShrineBuff, ShrineBuffDuration, arena.GetTick())

	// Start cooldown
	s.active = false
	s.cooldownUntil = arena.GetTick() + ShrineCooldownTicks

	return true
}

func (s *Shrine) OnTick(tick uint64) {
	if !s.active && tick >= s.cooldownUntil {
		s.active = true
	}
}

// ─── Spring (Healing Spring) ───

// Spring heals agents within its radius each tick.
type Spring struct {
	id            string
	position      domain.Position
	active        bool
	remainingHeal float64
	cooldownUntil uint64
}

func NewSpring(id string, pos domain.Position) *Spring {
	return &Spring{
		id:            id,
		position:      pos,
		active:        true,
		remainingHeal: SpringMaxHeal,
	}
}

func (sp *Spring) GetID() string                 { return sp.id }
func (sp *Spring) GetType() MapObjectType         { return MapObjectSpring }
func (sp *Spring) GetPosition() domain.Position   { return sp.position }
func (sp *Spring) GetRadius() float64             { return SpringRadius }
func (sp *Spring) IsActive() bool                 { return sp.active }

func (sp *Spring) OnEnter(agent *Agent, arena *Arena) bool {
	if !sp.active || !agent.Alive {
		return false
	}

	// Heal the agent
	healAmount := SpringHealPerTick
	if healAmount > sp.remainingHeal {
		healAmount = sp.remainingHeal
	}

	agent.AddMass(healAmount)
	sp.remainingHeal -= healAmount

	// Deplete → cooldown
	if sp.remainingHeal <= 0 {
		sp.active = false
		sp.cooldownUntil = arena.GetTick() + SpringCooldownTicks
	}

	return true
}

func (sp *Spring) OnTick(tick uint64) {
	if !sp.active && tick >= sp.cooldownUntil {
		sp.active = true
		sp.remainingHeal = SpringMaxHeal
	}
}

// ─── Altar (Upgrade Altar) ───

// Altar sacrifices 50% mass for 2 level-ups. Once per round.
type Altar struct {
	id       string
	position domain.Position
	active   bool
	used     bool // once per round
}

func NewAltar(id string, pos domain.Position) *Altar {
	return &Altar{
		id:       id,
		position: pos,
		active:   true,
	}
}

func (a *Altar) GetID() string                 { return a.id }
func (a *Altar) GetType() MapObjectType         { return MapObjectAltar }
func (a *Altar) GetPosition() domain.Position   { return a.position }
func (a *Altar) GetRadius() float64             { return AltarRadius }
func (a *Altar) IsActive() bool                 { return a.active && !a.used }

func (a *Altar) OnEnter(agent *Agent, arena *Arena) bool {
	if !a.active || a.used || !agent.Alive {
		return false
	}
	if agent.Mass < 20 { // minimum mass to sacrifice
		return false
	}

	// Sacrifice 50% mass
	sacrificed := agent.Mass * AltarMassSacrifice
	agent.Mass -= sacrificed

	// Grant 2 level-ups
	for i := 0; i < AltarLevelUpReward; i++ {
		if agent.Level >= domain.MaxLevel {
			break
		}
		agent.Level++
		if agent.Level < len(domain.XPTable) {
			agent.XPToNext = domain.XPTable[agent.Level]
		}
		agent.XP = 0
	}

	a.used = true
	a.active = false

	return true
}

func (a *Altar) OnTick(tick uint64) {
	// Altar does not respawn within a round
}

// ─── Gate (Speed Gate / Teleport) ───

// Gate teleports the agent to a random location and grants a speed buff.
type Gate struct {
	id            string
	position      domain.Position
	active        bool
	cooldownUntil uint64
	arenaRadius   float64
}

func NewGate(id string, pos domain.Position, arenaRadius float64) *Gate {
	return &Gate{
		id:          id,
		position:    pos,
		active:      true,
		arenaRadius: arenaRadius,
	}
}

func (g *Gate) GetID() string                 { return g.id }
func (g *Gate) GetType() MapObjectType         { return MapObjectGate }
func (g *Gate) GetPosition() domain.Position   { return g.position }
func (g *Gate) GetRadius() float64             { return GateRadius }
func (g *Gate) IsActive() bool                 { return g.active }

func (g *Gate) OnEnter(agent *Agent, arena *Arena) bool {
	if !g.active || !agent.Alive {
		return false
	}

	// Teleport to random position within safe area
	teleportRadius := arena.GetCurrentRadius() * 0.6
	newPos := RandomPositionInCircle(teleportRadius)
	agent.Position = newPos

	// Grant temporary speed buff
	agent.AddEffect(domain.EffectSpeed, GateSpeedBuff, arena.GetTick())

	// Start cooldown
	g.active = false
	g.cooldownUntil = arena.GetTick() + GateCooldownTicks

	return true
}

func (g *Gate) OnTick(tick uint64) {
	if !g.active && tick >= g.cooldownUntil {
		g.active = true
	}
}

// ─── Map Object Manager ───

// MapObjectManager handles all map objects in the arena.
type MapObjectManager struct {
	objects []MapObject
}

// NewMapObjectManager creates a manager and spawns the default map layout.
func NewMapObjectManager(arenaRadius float64) *MapObjectManager {
	m := &MapObjectManager{
		objects: make([]MapObject, 0, 10),
	}
	m.spawnDefaultLayout(arenaRadius)
	return m
}

// spawnDefaultLayout creates the standard map objects per the spec:
// 3 Shrines (random in mid zone), 2 Springs (edge zone), 1 Altar (center), 4 Gates (cardinal directions)
func (m *MapObjectManager) spawnDefaultLayout(arenaRadius float64) {
	// Altar: center
	m.objects = append(m.objects, NewAltar("altar_center", domain.Position{X: 0, Y: 0}))

	// Shrines: 3 in mid zone (35-65% radius)
	for i := 0; i < 3; i++ {
		angle := float64(i) * (2 * math.Pi / 3) + rand.Float64()*0.5
		r := arenaRadius * (0.35 + rand.Float64()*0.30)
		pos := domain.Position{
			X: math.Cos(angle) * r,
			Y: math.Sin(angle) * r,
		}
		m.objects = append(m.objects, NewShrine(
			"shrine_"+string(rune('a'+i)),
			pos,
		))
	}

	// Springs: 2 at edge zone (70-85% radius)
	for i := 0; i < 2; i++ {
		angle := float64(i)*math.Pi + rand.Float64()*0.8
		r := arenaRadius * (0.70 + rand.Float64()*0.15)
		pos := domain.Position{
			X: math.Cos(angle) * r,
			Y: math.Sin(angle) * r,
		}
		m.objects = append(m.objects, NewSpring(
			"spring_"+string(rune('a'+i)),
			pos,
		))
	}

	// Gates: 4 at cardinal directions, mid zone
	cardinals := []float64{0, math.Pi / 2, math.Pi, 3 * math.Pi / 2}
	for i, angle := range cardinals {
		r := arenaRadius * 0.50
		pos := domain.Position{
			X: math.Cos(angle) * r,
			Y: math.Sin(angle) * r,
		}
		m.objects = append(m.objects, NewGate(
			"gate_"+string(rune('a'+i)),
			pos,
			arenaRadius,
		))
	}
}

// Tick updates all map objects (cooldown recovery etc.)
func (m *MapObjectManager) Tick(tick uint64) {
	for _, obj := range m.objects {
		obj.OnTick(tick)
	}
}

// ProcessInteractions checks all agents against all map objects for proximity.
func (m *MapObjectManager) ProcessInteractions(agents map[string]*Agent, arena *Arena) {
	for _, obj := range m.objects {
		if !obj.IsActive() {
			continue
		}
		objPos := obj.GetPosition()
		objRadius := obj.GetRadius()

		for _, agent := range agents {
			if !agent.Alive {
				continue
			}
			dx := agent.Position.X - objPos.X
			dy := agent.Position.Y - objPos.Y
			distSq := dx*dx + dy*dy
			if distSq < objRadius*objRadius {
				obj.OnEnter(agent, arena)
			}
		}
	}
}

// GetStates returns serializable state of all map objects.
func (m *MapObjectManager) GetStates() []MapObjectState {
	states := make([]MapObjectState, len(m.objects))
	for i, obj := range m.objects {
		states[i] = MapObjectState{
			ID:     obj.GetID(),
			Type:   obj.GetType(),
			X:      obj.GetPosition().X,
			Y:      obj.GetPosition().Y,
			Radius: obj.GetRadius(),
			Active: obj.IsActive(),
		}
	}
	return states
}

// GetObjects returns the list of all map objects (for bot AI).
func (m *MapObjectManager) GetObjects() []MapObject {
	return m.objects
}

// Reset recreates all map objects for a new round.
func (m *MapObjectManager) Reset(arenaRadius float64) {
	m.objects = m.objects[:0]
	m.spawnDefaultLayout(arenaRadius)
}
