package game

import (
	"math"
	"math/rand"

	"github.com/to-nexus/snake-server/internal/domain"
)

// OrbManager manages orb lifecycle: spawn, collect, expire, death orbs.
type OrbManager struct {
	orbs   map[uint64]*domain.Orb
	nextID uint64
	config ArenaConfig
}

// NewOrbManager creates a new orb manager.
func NewOrbManager(cfg ArenaConfig) *OrbManager {
	return &OrbManager{
		orbs:   make(map[uint64]*domain.Orb, cfg.NaturalOrbTarget+500),
		nextID: 1,
		config: cfg,
	}
}

// Initialize spawns the initial set of natural orbs.
func (m *OrbManager) Initialize() {
	for i := 0; i < m.config.NaturalOrbTarget; i++ {
		m.spawnRandomOrb(0)
	}
}

// spawnRandomOrb creates an orb at a weighted random position.
func (m *OrbManager) spawnRandomOrb(tick uint64) *domain.Orb {
	id := m.nextID
	m.nextID++

	pos := m.weightedRandomPosition()
	orbType := m.rollOrbType()
	value := m.getOrbValue(orbType)
	color := m.getOrbColor(orbType)

	var lifetime uint64
	switch orbType {
	case domain.OrbMagnet:
		lifetime = uint64(MagnetDurationTicks) * 3 // lifetime on ground
	case domain.OrbSpeed:
		lifetime = uint64(SpeedDurationTicks) * 3
	case domain.OrbGhost:
		lifetime = uint64(GhostDurationTicks) * 3
	case domain.OrbMega:
		lifetime = uint64(MegaOrbLifetime)
	}

	orb := &domain.Orb{
		ID:        id,
		Position:  pos,
		Value:     value,
		Color:     color,
		Type:      orbType,
		SpawnTick: tick,
		Lifetime:  lifetime,
	}
	m.orbs[id] = orb
	return orb
}

// rollOrbType determines the orb type based on random probability.
func (m *OrbManager) rollOrbType() domain.OrbType {
	roll := rand.Float64()
	// Approximate spawn chances for special orbs
	const (
		megaChance   = 0.001
		ghostChance  = 0.002
		magnetChance = 0.002
		speedChance  = 0.002
	)

	threshold := megaChance
	if roll < threshold {
		return domain.OrbMega
	}
	threshold += ghostChance
	if roll < threshold {
		return domain.OrbGhost
	}
	threshold += magnetChance
	if roll < threshold {
		return domain.OrbMagnet
	}
	threshold += speedChance
	if roll < threshold {
		return domain.OrbSpeed
	}

	return domain.OrbNatural
}

// getOrbValue returns the value for an orb type.
func (m *OrbManager) getOrbValue(orbType domain.OrbType) float64 {
	switch orbType {
	case domain.OrbMega:
		return MegaOrbValue
	case domain.OrbMagnet, domain.OrbSpeed, domain.OrbGhost:
		return 0 // effect orbs have no mass value
	default:
		return float64(OrbNaturalValueMin) + rand.Float64()*float64(OrbNaturalValueMax-OrbNaturalValueMin)
	}
}

// getOrbColor returns the color index for an orb type.
func (m *OrbManager) getOrbColor(orbType domain.OrbType) int {
	switch orbType {
	case domain.OrbMagnet:
		return 100 // special color indices
	case domain.OrbSpeed:
		return 101
	case domain.OrbGhost:
		return 102
	case domain.OrbMega:
		return 103
	default:
		return rand.Intn(OrbColorCount)
	}
}

// weightedRandomPosition returns a position biased toward the arena edges.
func (m *OrbManager) weightedRandomPosition() domain.Position {
	roll := rand.Float64()
	var radius float64

	if roll < 0.2 {
		// Inner zone (20% chance)
		radius = rand.Float64() * m.config.ArenaRadius * 0.35
	} else if roll < 0.6 {
		// Mid zone (40% chance)
		radius = m.config.ArenaRadius*0.35 + rand.Float64()*m.config.ArenaRadius*0.4
	} else {
		// Outer zone (40% chance)
		radius = m.config.ArenaRadius*0.75 + rand.Float64()*m.config.ArenaRadius*0.25
	}

	radius = math.Max(0, radius-float64(OrbSpawnPadding))
	angle := rand.Float64() * 2 * math.Pi

	return domain.Position{
		X: math.Cos(angle) * radius,
		Y: math.Sin(angle) * radius,
	}
}

// SpawnRandom spawns a single random orb. Called by Maintain.
func (m *OrbManager) SpawnRandom(tick uint64) {
	m.spawnRandomOrb(tick)
}

// SpawnDeathOrbs creates death orbs at the given position from dead agent mass.
func (m *OrbManager) SpawnDeathOrbs(pos domain.Position, mass float64, tick uint64) {
	if mass <= 0 {
		return
	}

	orbMass := mass * m.config.DeathOrbRatio
	// 5-15 orbs based on mass
	orbCount := int(math.Max(5, math.Min(15, math.Floor(mass/3))))
	valuePerOrb := orbMass / float64(orbCount)

	for i := 0; i < orbCount; i++ {
		id := m.nextID
		m.nextID++

		// Spread orbs in a circle around the death position
		angle := float64(i) / float64(orbCount) * 2 * math.Pi
		spread := 20 + rand.Float64()*30

		orb := &domain.Orb{
			ID: id,
			Position: domain.Position{
				X: pos.X + math.Cos(angle)*spread,
				Y: pos.Y + math.Sin(angle)*spread,
			},
			Value:     math.Max(1, math.Round(valuePerOrb)),
			Color:     rand.Intn(OrbColorCount),
			Type:      domain.OrbDeath,
			SpawnTick: tick,
			Lifetime:  600, // 30s at 20Hz
		}
		m.orbs[id] = orb
	}
}

// Collect returns and removes all orbs within collectRadius of the given position.
func (m *OrbManager) Collect(agentPos domain.Position, collectRadius float64) []*domain.Orb {
	rSq := collectRadius * collectRadius
	var collected []*domain.Orb

	for id, orb := range m.orbs {
		dx := agentPos.X - orb.Position.X
		dy := agentPos.Y - orb.Position.Y
		if dx*dx+dy*dy < rSq {
			collected = append(collected, orb)
			delete(m.orbs, id)
		}
	}

	return collected
}

// RemoveOrb removes a specific orb by ID.
func (m *OrbManager) RemoveOrb(id uint64) {
	delete(m.orbs, id)
}

// InsertAllToHash inserts all orbs into the spatial hash.
func (m *OrbManager) InsertAllToHash(hash *SpatialHash) {
	for _, orb := range m.orbs {
		hash.InsertOrb(orb)
	}
}

// Maintain ensures the natural orb count stays at the target.
func (m *OrbManager) Maintain(tick uint64) {
	naturalCount := m.countByType(domain.OrbNatural)
	deficit := m.config.NaturalOrbTarget - naturalCount
	if deficit <= 0 {
		return
	}
	// Spawn up to 10 per tick to avoid spikes
	spawnCount := deficit
	if spawnCount > 10 {
		spawnCount = 10
	}
	for i := 0; i < spawnCount; i++ {
		m.spawnRandomOrb(tick)
	}
}

// CleanExpired removes orbs that have exceeded their lifetime.
func (m *OrbManager) CleanExpired(tick uint64) {
	for id, orb := range m.orbs {
		if orb.Lifetime > 0 && tick-orb.SpawnTick >= orb.Lifetime {
			delete(m.orbs, id)
		}
	}
}

// GetAll returns the orb map (read-only intent).
func (m *OrbManager) GetAll() map[uint64]*domain.Orb {
	return m.orbs
}

// GetOrb returns a specific orb.
func (m *OrbManager) GetOrb(id uint64) (*domain.Orb, bool) {
	o, ok := m.orbs[id]
	return o, ok
}

// GetCount returns the total number of orbs.
func (m *OrbManager) GetCount() int {
	return len(m.orbs)
}

// countByType counts orbs of a specific type.
func (m *OrbManager) countByType(orbType domain.OrbType) int {
	count := 0
	for _, orb := range m.orbs {
		if orb.Type == orbType {
			count++
		}
	}
	return count
}

// PullOrbToward moves an orb toward a target position (for magnet effect).
func (m *OrbManager) PullOrbToward(orbID uint64, target domain.Position, pullSpeed float64) {
	orb, ok := m.orbs[orbID]
	if !ok {
		return
	}

	dx := target.X - orb.Position.X
	dy := target.Y - orb.Position.Y
	dist := math.Sqrt(dx*dx + dy*dy)
	if dist > 1 {
		orb.Position.X += (dx / dist) * pullSpeed
		orb.Position.Y += (dy / dist) * pullSpeed
	}
}
