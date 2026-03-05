package game

import (
	"math"

	"github.com/to-nexus/snake-server/internal/domain"
)

// DeathEvent records a single agent death.
type DeathEvent struct {
	AgentID      string
	KillerID     string
	DamageSource domain.DamageSource
	VictimMass   float64
	VictimLevel  int
}

// CollisionSystem handles aura combat, dash collisions, and death detection.
type CollisionSystem struct{}

// NewCollisionSystem creates a new collision system.
func NewCollisionSystem() *CollisionSystem {
	return &CollisionSystem{}
}

// ProcessAura handles aura DPS exchange between agents within AuraRadius.
func (c *CollisionSystem) ProcessAura(
	agents map[string]*Agent,
	hash *SpatialHash,
	cfg ArenaConfig,
	tick uint64,
) {
	for id, attacker := range agents {
		if !attacker.Alive {
			continue
		}
		// Grace period: combat immune
		if tick < attacker.GracePeriodEnd && attacker.Level <= 1 {
			continue
		}
		// Ghost effect: immune
		if attacker.HasEffect(domain.EffectGhost) {
			continue
		}

		nearby := hash.QueryAgents(attacker.Position, cfg.AuraRadius)
		dps := attacker.GetAuraDPS(cfg)

		for _, entry := range nearby {
			if entry.AgentID == id {
				continue
			}
			defender, ok := agents[entry.AgentID]
			if !ok || !defender.Alive {
				continue
			}
			// Defender grace period check
			if tick < defender.GracePeriodEnd && defender.Level <= 1 {
				continue
			}
			if defender.HasEffect(domain.EffectGhost) {
				continue
			}

			dx := attacker.Position.X - entry.X
			dy := attacker.Position.Y - entry.Y
			distSq := dx*dx + dy*dy
			auraRSq := cfg.AuraRadius * cfg.AuraRadius

			if distSq < auraRSq {
				defender.TakeDamage(dps, id)
			}
		}
	}
}

// ProcessDash handles boost-dash collisions: 30% mass instant damage.
func (c *CollisionSystem) ProcessDash(
	agents map[string]*Agent,
	hash *SpatialHash,
	cfg ArenaConfig,
) {
	for id, attacker := range agents {
		if !attacker.Alive || !attacker.Boosting {
			continue
		}

		nearby := hash.QueryAgents(attacker.Position, cfg.HitboxMaxRadius*2)

		for _, entry := range nearby {
			if entry.AgentID == id {
				continue
			}
			defender, ok := agents[entry.AgentID]
			if !ok || !defender.Alive {
				continue
			}
			if defender.HasEffect(domain.EffectGhost) {
				continue
			}

			dx := attacker.Position.X - entry.X
			dy := attacker.Position.Y - entry.Y
			distSq := dx*dx + dy*dy
			collisionR := attacker.HitboxRadius + defender.HitboxRadius

			if distSq < collisionR*collisionR {
				damage := defender.Mass * cfg.DashDamageRatio

				// Berserker synergy: dash damage x3
				if attacker.HasSynergy("berserker") {
					damage *= 3.0
				}

				defender.TakeDamage(damage, id)
			}
		}
	}
}

// DetectDeaths finds agents that should die (mass <= 0 or beyond boundary).
func (c *CollisionSystem) DetectDeaths(
	agents map[string]*Agent,
	currentRadius float64,
) []DeathEvent {
	var deaths []DeathEvent

	for _, agent := range agents {
		if !agent.Alive {
			continue
		}

		// Boundary death: beyond 110% of current radius
		dist := distanceFromOrigin(agent.Position)
		if dist > currentRadius*1.1 {
			deaths = append(deaths, DeathEvent{
				AgentID:      agent.ID,
				KillerID:     "",
				DamageSource: domain.DamageSourceBoundary,
				VictimMass:   agent.Mass,
				VictimLevel:  agent.Level,
			})
			continue
		}

		// Mass depletion death
		if agent.Mass <= 0 {
			source := domain.DamageSourceAura
			if agent.LastDamagedBy == "" {
				source = domain.DamageSourceBoundary
			}
			deaths = append(deaths, DeathEvent{
				AgentID:      agent.ID,
				KillerID:     agent.LastDamagedBy,
				DamageSource: source,
				VictimMass:   math.Max(0, agent.Mass),
				VictimLevel:  agent.Level,
			})
		}
	}

	return deaths
}

// ProcessDeaths handles death events: creates death orbs, updates killer stats.
func (c *CollisionSystem) ProcessDeaths(
	deaths []DeathEvent,
	agents map[string]*Agent,
	orbManager *OrbManager,
	tick uint64,
) {
	for _, death := range deaths {
		agent, ok := agents[death.AgentID]
		if !ok || !agent.Alive {
			continue
		}

		victimMass := agent.Mass
		if victimMass < 0 {
			victimMass = 0
		}

		// Spawn death orbs
		orbManager.SpawnDeathOrbs(agent.Position, victimMass, tick)

		// Mark agent as dead
		agent.Die()

		// Reward killer
		if death.KillerID != "" {
			killer, ok := agents[death.KillerID]
			if ok && killer.Alive {
				killer.Kills++
				killer.KillStreak++

				// Vampire synergy: venom kill heals 20%
				if killer.HasSynergy("vampire") && death.DamageSource == domain.DamageSourceVenom {
					killer.AddMass(victimMass * 0.20)
				}
			}
		}
	}
}
