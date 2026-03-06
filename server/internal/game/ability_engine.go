package game

import (
	"math"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// AbilityDisplayTicks is how long the activeAbility field stays set (client display duration).
const AbilityDisplayTicks = 30 // ~1.5s at 20Hz

// ProcessAbilities checks auto-trigger conditions for all agents' abilities
// and fires them when conditions are met. Returns ability-triggered events.
func ProcessAbilities(agents map[string]*domain.Agent, spatialHash *SpatialHash, currentTick uint64) []ArenaEvent {
	var events []ArenaEvent

	for _, agent := range agents {
		if !agent.Alive {
			// Decay active ability display on dead agents
			agent.ActiveAbilityTicks = 0
			agent.ActiveAbility = ""
			continue
		}

		// Decay active ability display counter
		if agent.ActiveAbilityTicks > 0 {
			agent.ActiveAbilityTicks--
			if agent.ActiveAbilityTicks <= 0 {
				agent.ActiveAbility = ""
				agent.AbilityTargetX = 0
				agent.AbilityTargetY = 0
				agent.AbilityLevel = 0
			}
		}

		// Check each equipped ability for auto-trigger
		for _, slot := range agent.Build.AbilitySlots {
			// Skip if on cooldown
			if HasCooldown(agent, slot.Type) {
				continue
			}

			def := domain.GetAbilityDef(slot.Type)
			if def == nil {
				continue
			}

			// Evaluate auto-trigger condition
			triggered, targetX, targetY := evaluateAutoTrigger(agent, slot, def, agents, spatialHash)
			if !triggered {
				continue
			}

			// Fire ability: set active state, add cooldown, emit event
			agent.ActiveAbility = slot.Type
			agent.ActiveAbilityTicks = AbilityDisplayTicks
			agent.AbilityTargetX = targetX
			agent.AbilityTargetY = targetY
			agent.AbilityLevel = slot.Level

			// Add cooldown (skip for always_active / passive abilities with 0 cooldown)
			if def.BaseCooldownSec > 0 {
				cooldownTicks := GetAbilityEffectiveCooldown(slot.Type, slot.Level)
				AddCooldown(agent, slot.Type, cooldownTicks)
			}

			// Apply ability effect
			applyAbilityEffect(agent, slot, def, agents, targetX, targetY, currentTick)

			// Emit event for broadcast
			events = append(events, ArenaEvent{
				Type:      EventAbilityTriggered,
				AgentID:   agent.ID,
				AgentName: agent.Name,
				Data: domain.AbilityTriggeredEvent{
					AgentID:     agent.ID,
					AbilityType: slot.Type,
					TargetX:     targetX,
					TargetY:     targetY,
					Level:       slot.Level,
				},
			})

			// Only fire one ability per tick per agent
			break
		}
	}

	return events
}

// evaluateAutoTrigger checks if an ability's auto-trigger condition is met.
// Returns (shouldTrigger, targetX, targetY).
func evaluateAutoTrigger(
	agent *domain.Agent,
	slot domain.AbilitySlot,
	def *domain.AbilityDef,
	agents map[string]*domain.Agent,
	sh *SpatialHash,
) (bool, float64, float64) {
	switch def.AutoTrigger {
	case "always_active":
		// Venom Aura: always active (passive, no cooldown needed for re-trigger)
		// Only trigger once per cycle based on cooldown
		if def.BaseCooldownSec == 0 {
			// Passive: only trigger if not already active
			if agent.ActiveAbility == slot.Type {
				return false, 0, 0
			}
			// Check if any enemy is nearby
			nearbyIDs := sh.QueryRadiusExclude(agent.Position.X, agent.Position.Y, AuraRadius*1.5, agent.ID)
			for _, id := range nearbyIDs {
				if other, ok := agents[id]; ok && other.Alive {
					return true, agent.Position.X, agent.Position.Y
				}
			}
			return false, 0, 0
		}
		return true, agent.Position.X, agent.Position.Y

	case "hp_below_30pct":
		// Shield Burst: trigger when mass drops below 30% of initial
		threshold := InitialMass * 0.3
		if agent.Mass <= threshold {
			return true, agent.Position.X, agent.Position.Y
		}
		return false, 0, 0

	case "enemy_in_range":
		// Lightning Strike: trigger when enemy is within aura range
		nearbyIDs := sh.QueryRadiusExclude(agent.Position.X, agent.Position.Y, AuraRadius*2.0, agent.ID)
		closestDist := math.MaxFloat64
		var closestX, closestY float64
		for _, id := range nearbyIDs {
			other, ok := agents[id]
			if !ok || !other.Alive {
				continue
			}
			dist := DistanceSq(agent.Position, other.Position)
			if dist < closestDist {
				closestDist = dist
				closestX = other.Position.X
				closestY = other.Position.Y
			}
		}
		if closestDist < math.MaxFloat64 {
			return true, closestX, closestY
		}
		return false, 0, 0

	case "chase_or_flee":
		// Speed Dash: trigger when boosting near enemies or fleeing low HP
		if agent.Boosting {
			return true, agent.Position.X, agent.Position.Y
		}
		// Or when HP below 20% and enemies nearby
		if agent.Mass < InitialMass*0.2 {
			nearbyIDs := sh.QueryRadiusExclude(agent.Position.X, agent.Position.Y, AuraRadius*2.0, agent.ID)
			for _, id := range nearbyIDs {
				if other, ok := agents[id]; ok && other.Alive {
					_ = other
					return true, agent.Position.X, agent.Position.Y
				}
			}
		}
		return false, 0, 0

	case "on_contact":
		// Mass Drain: trigger when in aura combat range with another agent
		nearbyIDs := sh.QueryRadiusExclude(agent.Position.X, agent.Position.Y, AuraRadius, agent.ID)
		for _, id := range nearbyIDs {
			other, ok := agents[id]
			if !ok || !other.Alive {
				continue
			}
			dist := DistanceBetween(agent.Position, other.Position)
			if dist <= AuraRadius {
				return true, other.Position.X, other.Position.Y
			}
		}
		return false, 0, 0

	case "orb_dense_area":
		// Gravity Well: trigger when many agents are nearby (crowded area)
		nearbyIDs := sh.QueryRadiusExclude(agent.Position.X, agent.Position.Y, AuraRadius*3.0, agent.ID)
		nearbyCount := 0
		for _, id := range nearbyIDs {
			if other, ok := agents[id]; ok && other.Alive {
				nearbyCount++
			}
		}
		if nearbyCount >= 2 {
			return true, agent.Position.X, agent.Position.Y
		}
		return false, 0, 0

	default:
		return false, 0, 0
	}
}

// applyAbilityEffect applies the gameplay effect of a triggered ability.
func applyAbilityEffect(
	agent *domain.Agent,
	slot domain.AbilitySlot,
	def *domain.AbilityDef,
	agents map[string]*domain.Agent,
	targetX, targetY float64,
	currentTick uint64,
) {
	switch slot.Type {
	case domain.AbilityVenomAura:
		// Venom Aura: dealt via aura damage (already in collision system)
		// Add visual indicator effect
		AddEffect(agent, "venom_active", int(def.Duration*float64(TickRate)), def.BaseDamage)

	case domain.AbilityShieldBurst:
		// Shield Burst: invincibility + knockback
		durationTicks := int(def.Duration * float64(TickRate))
		AddEffect(agent, "shield_active", durationTicks, 0)
		// Extend grace period for invincibility
		newGrace := currentTick + uint64(durationTicks)
		if newGrace > agent.GracePeriodEnd {
			agent.GracePeriodEnd = newGrace
		}

	case domain.AbilityLightningStrike:
		// Lightning Strike: instant damage to target
		dmg := GetAbilityEffectiveDamage(slot.Type, slot.Level)
		// Find closest enemy to target position
		for _, other := range agents {
			if other.ID == agent.ID || !other.Alive {
				continue
			}
			dist := DistanceBetween(other.Position, domain.Position{X: targetX, Y: targetY})
			if dist < 30 { // small tolerance for targeting
				TakeDamage(other, dmg, agent.ID, currentTick)
				break
			}
		}

	case domain.AbilitySpeedDash:
		// Speed Dash: temporary speed boost + collision immunity
		durationTicks := int(def.Duration * float64(TickRate))
		AddEffect(agent, "speed_dash_active", durationTicks, 3.0) // 3x speed mult
		// Extend grace period for collision immunity
		newGrace := currentTick + uint64(durationTicks)
		if newGrace > agent.GracePeriodEnd {
			agent.GracePeriodEnd = newGrace
		}

	case domain.AbilityMassDrain:
		// Mass Drain: absorb 10% mass on contact
		for _, other := range agents {
			if other.ID == agent.ID || !other.Alive {
				continue
			}
			dist := DistanceBetween(other.Position, domain.Position{X: targetX, Y: targetY})
			if dist < 30 {
				drainPct := 0.10 * (1.0 + float64(slot.Level-1)*0.30) // +30% per level
				drainAmount := other.Mass * drainPct
				other.Mass -= drainAmount
				if other.Mass < 0 {
					other.Mass = 0
				}
				agent.Mass += drainAmount
				break
			}
		}

	case domain.AbilityGravityWell:
		// Gravity Well: pull nearby enemies toward agent position (applied per tick via effect)
		durationTicks := int(def.Duration * float64(TickRate))
		AddEffect(agent, "gravity_well_active", durationTicks, 1.0)
	}
}
