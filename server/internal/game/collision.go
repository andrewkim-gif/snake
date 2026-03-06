package game

import (
	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// CollisionEvent describes a death that occurred during collision processing.
type CollisionEvent struct {
	VictimID     string
	VictimName   string
	VictimMass   float64
	KillerID     string // empty for boundary deaths
	KillerName   string
	DamageSource domain.DamageSource
}

// CollisionSystem detects and resolves agent-agent and agent-boundary collisions.
type CollisionSystem struct {
	spatialHash *SpatialHash
}

// NewCollisionSystem creates a new collision system.
func NewCollisionSystem(sh *SpatialHash) *CollisionSystem {
	return &CollisionSystem{
		spatialHash: sh,
	}
}

// ProcessBoundaryCollisions checks all agents against the arena boundary
// and applies mass penalty for those outside.
func (cs *CollisionSystem) ProcessBoundaryCollisions(
	agents map[string]*domain.Agent,
	currentRadius float64,
	currentTick uint64,
) []CollisionEvent {
	var events []CollisionEvent

	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		// Grace period agents are immune
		if IsInGracePeriod(agent, currentTick) {
			continue
		}

		dist := DistanceBetween(agent.Position, domain.Position{X: 0, Y: 0})
		if dist > currentRadius {
			// Apply boundary penalty: percentage of current mass per tick
			penalty := agent.Mass * BoundaryPenaltyPerTick
			agent.Mass -= penalty
			if agent.Mass <= 0 {
				agent.Mass = 0
			}
			agent.LastDamagedBy = "" // boundary kills have no killer

			if agent.Mass <= 0 {
				AgentDie(agent)
				events = append(events, CollisionEvent{
					VictimID:     agent.ID,
					VictimName:   agent.Name,
					VictimMass:   0,
					KillerID:     "",
					KillerName:   "",
					DamageSource: domain.DamageSourceBoundary,
				})
			}
		}
	}

	return events
}

// ProcessAuraCombat handles aura-aura collisions (mutual DPS exchange).
// When two agents are within AuraRadius, they deal their aura DPS to each other.
func (cs *CollisionSystem) ProcessAuraCombat(
	agents map[string]*domain.Agent,
	currentTick uint64,
) []CollisionEvent {
	var events []CollisionEvent

	// Track pairs already processed to avoid double processing
	type pair struct{ a, b string }
	processed := make(map[pair]struct{})

	for _, agent := range agents {
		if !agent.Alive {
			continue
		}

		// Query spatial hash for nearby agents within aura radius
		nearbyIDs := cs.spatialHash.QueryRadiusExclude(
			agent.Position.X, agent.Position.Y,
			AuraRadius+HitboxMaxRadius, // slightly larger to account for hitbox
			agent.ID,
		)

		for _, otherID := range nearbyIDs {
			other, ok := agents[otherID]
			if !ok || !other.Alive {
				continue
			}

			// Avoid double processing
			p := pair{agent.ID, other.ID}
			pRev := pair{other.ID, agent.ID}
			if _, done := processed[p]; done {
				continue
			}
			if _, done := processed[pRev]; done {
				continue
			}
			processed[p] = struct{}{}

			// Check actual distance
			dist := DistanceBetween(agent.Position, other.Position)
			if dist > AuraRadius {
				continue
			}

			// Mutual DPS exchange
			// Agent damages other
			if !IsInGracePeriod(other, currentTick) {
				agentDPS := GetEffectiveAuraDPS(agent)
				TakeDamage(other, agentDPS, agent.ID, currentTick)

				if !other.Alive || other.Mass <= 0 {
					if other.Mass <= 0 && other.Alive {
						AgentDie(other)
					}
					events = append(events, CollisionEvent{
						VictimID:     other.ID,
						VictimName:   other.Name,
						VictimMass:   other.Mass,
						KillerID:     agent.ID,
						KillerName:   agent.Name,
						DamageSource: domain.DamageSourceAura,
					})
					continue
				}
			}

			// Other damages agent
			if !IsInGracePeriod(agent, currentTick) {
				otherDPS := GetEffectiveAuraDPS(other)
				TakeDamage(agent, otherDPS, other.ID, currentTick)

				if !agent.Alive || agent.Mass <= 0 {
					if agent.Mass <= 0 && agent.Alive {
						AgentDie(agent)
					}
					events = append(events, CollisionEvent{
						VictimID:     agent.ID,
						VictimName:   agent.Name,
						VictimMass:   agent.Mass,
						KillerID:     other.ID,
						KillerName:   other.Name,
						DamageSource: domain.DamageSourceAura,
					})
					break // agent is dead, stop processing its interactions
				}
			}
		}
	}

	return events
}

// ProcessDashCollisions handles boost-state hitbox collisions (burst damage).
// A boosting agent that overlaps another agent's hitbox deals DashDamageRatio burst damage.
func (cs *CollisionSystem) ProcessDashCollisions(
	agents map[string]*domain.Agent,
	currentTick uint64,
) []CollisionEvent {
	var events []CollisionEvent

	for _, attacker := range agents {
		if !attacker.Alive || !attacker.Boosting {
			continue
		}

		// Query nearby agents within max possible dash collision range
		maxRange := attacker.HitboxRadius + HitboxMaxRadius + 5 // small buffer
		nearbyIDs := cs.spatialHash.QueryRadiusExclude(
			attacker.Position.X, attacker.Position.Y,
			maxRange,
			attacker.ID,
		)

		for _, targetID := range nearbyIDs {
			target, ok := agents[targetID]
			if !ok || !target.Alive {
				continue
			}

			// Grace period: target is immune
			if IsInGracePeriod(target, currentTick) {
				continue
			}

			// Check hitbox overlap
			dist := DistanceBetween(attacker.Position, target.Position)
			collisionDist := attacker.HitboxRadius + target.HitboxRadius
			if dist > collisionDist {
				continue
			}

			// Apply burst damage: DashDamageRatio of target's mass
			burstDmg := GetEffectiveDashDamage(attacker, target.Mass)
			TakeDamage(target, burstDmg, attacker.ID, currentTick)

			if !target.Alive || target.Mass <= 0 {
				if target.Mass <= 0 && target.Alive {
					AgentDie(target)
				}
				events = append(events, CollisionEvent{
					VictimID:     target.ID,
					VictimName:   target.Name,
					VictimMass:   target.Mass,
					KillerID:     attacker.ID,
					KillerName:   attacker.Name,
					DamageSource: domain.DamageSourceDash,
				})
			}
		}
	}

	return events
}

// ProcessAll runs all collision checks in order and returns all death events.
func (cs *CollisionSystem) ProcessAll(
	agents map[string]*domain.Agent,
	currentRadius float64,
	currentTick uint64,
) []CollisionEvent {
	var allEvents []CollisionEvent

	// 1. Boundary collisions
	boundaryEvents := cs.ProcessBoundaryCollisions(agents, currentRadius, currentTick)
	allEvents = append(allEvents, boundaryEvents...)

	// 2. Aura combat (mutual DPS)
	auraEvents := cs.ProcessAuraCombat(agents, currentTick)
	allEvents = append(allEvents, auraEvents...)

	// 3. Dash collisions (burst damage)
	dashEvents := cs.ProcessDashCollisions(agents, currentTick)
	allEvents = append(allEvents, dashEvents...)

	return allEvents
}
