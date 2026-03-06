package game

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// MapObjectType classifies the kind of map object.
type MapObjectType string

const (
	MapObjXPShrine     MapObjectType = "shrine"
	MapObjHealingSpring MapObjectType = "spring"
	MapObjUpgradeAltar MapObjectType = "altar"
	MapObjSpeedGate    MapObjectType = "gate"
)

// MapObject represents an interactive object placed in the arena.
type MapObject struct {
	ID           string        `json:"id"`
	Type         MapObjectType `json:"type"`
	Position     domain.Position `json:"position"`
	Active       bool          `json:"active"`
	CooldownTicks int          `json:"-"` // ticks remaining until reactivation
	RespawnTicks  int          `json:"-"` // total cooldown ticks for this type
	UsesLeft     int           `json:"-"` // for Altar: uses remaining this round (-1 = unlimited)
}

// MapObjectManager manages all arena map objects.
type MapObjectManager struct {
	objects map[string]*MapObject
	config  MapObjectConfig
}

// NewMapObjectManager creates a new MapObjectManager with default config.
func NewMapObjectManager() *MapObjectManager {
	cfg := DefaultMapObjectConfig()
	return &MapObjectManager{
		objects: make(map[string]*MapObject),
		config:  cfg,
	}
}

// PlaceObjects spawns all map objects at their designated positions.
// Called at round start after arena reset.
func (m *MapObjectManager) PlaceObjects(arenaRadius float64) {
	m.objects = make(map[string]*MapObject)

	// --- XP Shrines: 3 at random positions within 60% radius ---
	for i := 0; i < m.config.ShrineCount; i++ {
		angle := rand.Float64() * 2 * math.Pi
		r := arenaRadius * 0.6 * math.Sqrt(rand.Float64())
		m.objects[fmt.Sprintf("shrine_%d", i)] = &MapObject{
			ID:           fmt.Sprintf("shrine_%d", i),
			Type:         MapObjXPShrine,
			Position:     domain.Position{X: math.Cos(angle) * r, Y: math.Sin(angle) * r},
			Active:       true,
			CooldownTicks: 0,
			RespawnTicks:  m.config.ShrineCooldownSec * TickRate,
			UsesLeft:     -1, // unlimited
		}
	}

	// --- Healing Springs: 2 at edge positions (80% radius) ---
	for i := 0; i < m.config.SpringCount; i++ {
		angle := rand.Float64() * 2 * math.Pi
		r := arenaRadius * 0.8
		m.objects[fmt.Sprintf("spring_%d", i)] = &MapObject{
			ID:           fmt.Sprintf("spring_%d", i),
			Type:         MapObjHealingSpring,
			Position:     domain.Position{X: math.Cos(angle) * r, Y: math.Sin(angle) * r},
			Active:       true,
			CooldownTicks: 0,
			RespawnTicks:  m.config.SpringCooldownSec * TickRate,
			UsesLeft:     -1,
		}
	}

	// --- Upgrade Altar: 1 at center (0,0) ---
	m.objects["altar_0"] = &MapObject{
		ID:           "altar_0",
		Type:         MapObjUpgradeAltar,
		Position:     domain.Position{X: 0, Y: 0},
		Active:       true,
		CooldownTicks: 0,
		RespawnTicks:  0, // no respawn; uses-limited per round
		UsesLeft:     m.config.AltarUsesPerRound,
	}

	// --- Speed Gates: 4 at cardinal directions (50% radius, 90 degree intervals) ---
	for i := 0; i < m.config.GateCount; i++ {
		angle := float64(i) * math.Pi / 2 // 0, 90, 180, 270 degrees
		r := arenaRadius * 0.5
		m.objects[fmt.Sprintf("gate_%d", i)] = &MapObject{
			ID:           fmt.Sprintf("gate_%d", i),
			Type:         MapObjSpeedGate,
			Position:     domain.Position{X: math.Cos(angle) * r, Y: math.Sin(angle) * r},
			Active:       true,
			CooldownTicks: 0,
			RespawnTicks:  m.config.GateCooldownSec * TickRate,
			UsesLeft:     -1,
		}
	}
}

// Update ticks all cooldowns and re-activates map objects when ready.
func (m *MapObjectManager) Update(tick uint64) {
	for _, obj := range m.objects {
		if obj.Active {
			continue
		}
		// Altar has no respawn cooldown — it is use-limited per round
		if obj.Type == MapObjUpgradeAltar {
			continue
		}
		obj.CooldownTicks--
		if obj.CooldownTicks <= 0 {
			obj.Active = true
			obj.CooldownTicks = 0
		}
	}
}

// CheckCollisions tests all active map objects against all alive agents.
// Returns a list of activation events. The caller (Arena) applies effects.
func (m *MapObjectManager) CheckCollisions(agents map[string]*domain.Agent, tick uint64) []MapObjectActivation {
	var activations []MapObjectActivation
	collectRadiusSq := MapObjectCollectRadius * MapObjectCollectRadius

	for _, obj := range m.objects {
		if !obj.Active {
			continue
		}

		for _, agent := range agents {
			if !agent.Alive {
				continue
			}
			dx := agent.Position.X - obj.Position.X
			dy := agent.Position.Y - obj.Position.Y
			if dx*dx+dy*dy <= collectRadiusSq {
				activations = append(activations, MapObjectActivation{
					Object:  obj,
					AgentID: agent.ID,
				})
				// Deactivate this object (one agent per activation)
				m.deactivate(obj)
				break
			}
		}
	}

	return activations
}

// deactivate puts a map object on cooldown.
func (m *MapObjectManager) deactivate(obj *MapObject) {
	obj.Active = false
	switch obj.Type {
	case MapObjUpgradeAltar:
		obj.UsesLeft--
		if obj.UsesLeft <= 0 {
			// Altar exhausted for this round — stays inactive
			obj.CooldownTicks = 0
		}
	default:
		obj.CooldownTicks = obj.RespawnTicks
	}
}

// GetNearbyMapObjects returns active map objects within a given radius of (x, y).
// Used by bot AI for observation.
func (m *MapObjectManager) GetNearbyMapObjects(x, y, radius float64) []*MapObject {
	radiusSq := radius * radius
	var result []*MapObject
	for _, obj := range m.objects {
		if !obj.Active {
			continue
		}
		dx := obj.Position.X - x
		dy := obj.Position.Y - y
		if dx*dx+dy*dy <= radiusSq {
			result = append(result, obj)
		}
	}
	return result
}

// GetAllObjects returns all map objects (for serialization/broadcasting).
func (m *MapObjectManager) GetAllObjects() []*MapObject {
	result := make([]*MapObject, 0, len(m.objects))
	for _, obj := range m.objects {
		result = append(result, obj)
	}
	return result
}

// Reset clears all map objects (called at round start before PlaceObjects).
func (m *MapObjectManager) Reset() {
	m.objects = make(map[string]*MapObject)
}

// MapObjectActivation describes a single agent-object interaction event.
type MapObjectActivation struct {
	Object  *MapObject
	AgentID string
}

// ApplyMapObjectEffect applies the effect of an activated map object to the agent.
// Returns a human-readable effect description string.
func ApplyMapObjectEffect(agent *domain.Agent, obj *MapObject, cfg MapObjectConfig) string {
	switch obj.Type {
	case MapObjXPShrine:
		// +50% XP buff for 10 seconds (ticks)
		duration := cfg.ShrineEffectSec * TickRate
		AddEffect(agent, "xp_shrine_buff", duration, cfg.ShrineXPMultiplier)
		return fmt.Sprintf("+%.0f%% XP for %ds", cfg.ShrineXPMultiplier*100, cfg.ShrineEffectSec)

	case MapObjHealingSpring:
		// +20% mass recovery (based on InitialMass as reference)
		healAmount := agent.Mass * cfg.SpringMassRecovery
		agent.Mass += healAmount
		return fmt.Sprintf("+%.0f mass healed", healAmount)

	case MapObjUpgradeAltar:
		// Instant level-up
		if agent.Level < domain.MaxLevel {
			PerformLevelUp(agent)
			return fmt.Sprintf("Instant level-up to Lv%d", agent.Level)
		}
		return "Already max level"

	case MapObjSpeedGate:
		// x2 speed for 5 seconds
		duration := cfg.GateEffectSec * TickRate
		AddEffect(agent, "speed_gate_buff", duration, cfg.GateSpeedMult)
		return fmt.Sprintf("x%.0f speed for %ds", cfg.GateSpeedMult, cfg.GateEffectSec)

	default:
		return ""
	}
}
