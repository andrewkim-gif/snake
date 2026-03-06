package game

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// OrbManager handles orb spawning, collection, and lifecycle.
type OrbManager struct {
	orbs        map[string]*domain.Orb
	nextOrbID   int
	arenaRadius float64 // current arena radius for spawning
}

// NewOrbManager creates a new OrbManager.
func NewOrbManager(arenaRadius float64) *OrbManager {
	return &OrbManager{
		orbs:        make(map[string]*domain.Orb),
		nextOrbID:   1,
		arenaRadius: arenaRadius,
	}
}

// SetArenaRadius updates the radius used for spawning.
func (om *OrbManager) SetArenaRadius(r float64) {
	om.arenaRadius = r
}

// generateID returns a unique orb ID.
func (om *OrbManager) generateID() string {
	id := fmt.Sprintf("orb_%d", om.nextOrbID)
	om.nextOrbID++
	return id
}

// SpawnNaturalOrbs adds natural orbs to maintain the target count.
func (om *OrbManager) SpawnNaturalOrbs(currentTick uint64) {
	deficit := NaturalOrbTargetCount - om.CountNatural()
	if deficit <= 0 {
		return
	}

	for i := 0; i < deficit; i++ {
		pos := om.randomPositionInArena()
		value := NaturalOrbMinValue + rand.Float64()*(NaturalOrbMaxValue-NaturalOrbMinValue)

		orb := &domain.Orb{
			ID:        om.generateID(),
			Position:  pos,
			Value:     value,
			Type:      domain.OrbTypeNatural,
			SpawnTick: currentTick,
		}
		om.orbs[orb.ID] = orb
	}
}

// SpawnDeathOrbs creates XP orbs from a dead agent's mass.
func (om *OrbManager) SpawnDeathOrbs(pos domain.Position, mass float64, currentTick uint64) {
	totalXP := mass * DeathOrbMassRatio

	// Determine number of orbs (scale with mass)
	count := OrbsPerDeathMin + int(mass/10)
	if count > OrbsPerDeathMax {
		count = OrbsPerDeathMax
	}
	if count < OrbsPerDeathMin {
		count = OrbsPerDeathMin
	}

	xpPerOrb := totalXP / float64(count)

	for i := 0; i < count; i++ {
		// Spread orbs around death position
		angle := rand.Float64() * 2 * math.Pi
		distance := rand.Float64() * 40 // spread within 40px
		orbPos := domain.Position{
			X: pos.X + math.Cos(angle)*distance,
			Y: pos.Y + math.Sin(angle)*distance,
		}

		orb := &domain.Orb{
			ID:        om.generateID(),
			Position:  orbPos,
			Value:     xpPerOrb,
			Type:      domain.OrbTypeDeath,
			SpawnTick: currentTick,
		}
		om.orbs[orb.ID] = orb
	}
}

// CollectOrbs checks which orbs are within the agent's collect radius
// and returns total XP collected. Collected orbs are removed.
func (om *OrbManager) CollectOrbs(agent *domain.Agent, currentTick uint64) (xpGained int, massGained float64) {
	collectRadius := GetEffectiveCollectRadius(agent)
	collectRadiusSq := collectRadius * collectRadius

	var toRemove []string

	for id, orb := range om.orbs {
		dx := orb.Position.X - agent.Position.X
		dy := orb.Position.Y - agent.Position.Y
		distSq := dx*dx + dy*dy

		if distSq <= collectRadiusSq {
			xpGained += int(math.Ceil(orb.Value))
			massGained += orb.Value * 0.5 // each XP orb gives half its value as mass
			toRemove = append(toRemove, id)
		}
	}

	for _, id := range toRemove {
		delete(om.orbs, id)
	}

	return xpGained, massGained
}

// RemoveExpired removes orbs that have exceeded their lifetime.
func (om *OrbManager) RemoveExpired(currentTick uint64) {
	var toRemove []string
	for id, orb := range om.orbs {
		if currentTick-orb.SpawnTick >= OrbLifetimeTicks {
			toRemove = append(toRemove, id)
		}
	}
	for _, id := range toRemove {
		delete(om.orbs, id)
	}
}

// GetOrbs returns all current orbs (for serialization).
func (om *OrbManager) GetOrbs() map[string]*domain.Orb {
	return om.orbs
}

// GetOrbSlice returns all orbs as a slice.
func (om *OrbManager) GetOrbSlice() []*domain.Orb {
	result := make([]*domain.Orb, 0, len(om.orbs))
	for _, orb := range om.orbs {
		result = append(result, orb)
	}
	return result
}

// CountNatural returns the number of natural orbs currently alive.
func (om *OrbManager) CountNatural() int {
	count := 0
	for _, orb := range om.orbs {
		if orb.Type == domain.OrbTypeNatural {
			count++
		}
	}
	return count
}

// Count returns the total number of orbs.
func (om *OrbManager) Count() int {
	return len(om.orbs)
}

// Clear removes all orbs.
func (om *OrbManager) Clear() {
	om.orbs = make(map[string]*domain.Orb)
}

// randomPositionInArena returns a random position within the current arena radius.
func (om *OrbManager) randomPositionInArena() domain.Position {
	angle := rand.Float64() * 2 * math.Pi
	r := om.arenaRadius * math.Sqrt(rand.Float64()) * 0.95 // 95% of radius to avoid edge
	return domain.Position{
		X: math.Cos(angle) * r,
		Y: math.Sin(angle) * r,
	}
}
