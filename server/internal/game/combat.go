package game

import (
	"math"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 2: Combat System — HP/Defense/Critical/Dash Rework
// ============================================================

// Combat constants for v14.
const (
	// BaseHP is the starting HP for a new agent.
	BaseHP = 100.0

	// HPPerLevel is the HP bonus per level-up.
	HPPerLevel = 10.0

	// BaseCritChance is the default critical hit chance (5%).
	BaseCritChance = 0.05

	// CritDamageMultiplier is the damage multiplier on critical hits.
	CritDamageMultiplier = 2.0

	// PrecisionCritPerStack is the crit chance bonus per Precision passive stack.
	// Using TomeArmor slot for now; in v14 this maps to a dedicated passive.
	PrecisionCritPerStack = 0.08

	// BaseKnockbackPx is the knockback distance on any hit.
	BaseKnockbackPx = 10.0

	// DashSpeedV14 is the dash speed in px/s (v14 rework).
	DashSpeedV14 = 300.0

	// DashDurationSec is the dash duration in seconds.
	DashDurationSec = 1.0

	// DashCooldownSecV14 is the dash cooldown in seconds.
	DashCooldownSecV14 = 5.0

	// DashDurationTicks is the dash duration in ticks.
	DashDurationTicks = int(DashDurationSec * TickRate) // 20

	// DashCooldownTicks is the dash cooldown in ticks.
	DashCooldownTicks = int(DashCooldownSecV14 * TickRate) // 100

	// RespawnInvincibleSec is seconds of invincibility after respawn.
	RespawnInvincibleSec = 5.0

	// RespawnInvincibleTicks is ticks of invincibility after respawn.
	RespawnInvincibleTicks = int(RespawnInvincibleSec * TickRate) // 100

	// RespawnSpeedPenaltyDurationSec is duration of speed penalty after respawn.
	RespawnSpeedPenaltyDurationSec = 2.0

	// RespawnSpeedPenaltyFraction is the speed reduction during penalty.
	RespawnSpeedPenaltyFraction = 0.30
)

// InitAgentCombatStats initializes the v14 combat stats for a new agent.
func InitAgentCombatStats(a *domain.Agent) {
	a.HP = BaseHP
	a.MaxHP = BaseHP
	a.Defense = 0
	a.BaseDPS = 0
	a.CritChance = BaseCritChance
	a.Invincible = false
	a.InvincibleEnd = 0
	a.WeaponSlots = make([]domain.WeaponSlot, 0, domain.MaxWeaponSlots)
	a.StatusEffects = make([]domain.StatusEffect, 0)
	a.DashCooldownEnd = 0
	a.Deaths = 0
	a.Assists = 0
}

// RecalcMaxHP recalculates the agent's max HP based on level and passives.
func RecalcMaxHP(a *domain.Agent) {
	base := BaseHP
	levelBonus := float64(a.Level-1) * HPPerLevel
	// Vigor passive: +15% max HP per stack (maps to TomeXP for v14 prototype)
	// In the full system, Vigor will be a separate passive type
	a.MaxHP = base + levelBonus
	if a.HP > a.MaxHP {
		a.HP = a.MaxHP
	}
}

// RecalcCritChance recalculates the agent's critical hit chance.
func RecalcCritChance(a *domain.Agent) {
	a.CritChance = BaseCritChance
	// Precision passive adds +8% per stack
	// Using build system — in v14, precision will be a dedicated passive
}

// OnLevelUpCombat handles HP/defense changes on level-up.
func OnLevelUpCombat(a *domain.Agent) {
	a.MaxHP = BaseHP + float64(a.Level-1)*HPPerLevel
	a.HP = a.MaxHP // Full heal on level-up
}

// ============================================================
// Dash Rework (v14)
// ============================================================

// CanDash returns true if the agent can perform a dash.
func CanDash(a *domain.Agent, currentTick uint64) bool {
	if !a.Alive {
		return false
	}
	if IsStunned(a) {
		return false
	}
	return currentTick >= a.DashCooldownEnd
}

// PerformDash initiates a dash for the agent.
func PerformDash(a *domain.Agent, currentTick uint64) {
	if !CanDash(a, currentTick) {
		return
	}
	a.Boosting = true
	a.DashCooldownEnd = currentTick + uint64(DashCooldownTicks)
}

// UpdateDash checks if the dash should end (called every tick).
func UpdateDash(a *domain.Agent, currentTick uint64) {
	if !a.Boosting {
		return
	}
	// Dash ends after DashDurationTicks
	dashStartTick := a.DashCooldownEnd - uint64(DashCooldownTicks)
	dashEndTick := dashStartTick + uint64(DashDurationTicks)
	if currentTick >= dashEndTick {
		a.Boosting = false
	}
}

// GetDashSpeedPerTick returns the dash movement per tick.
func GetDashSpeedPerTick() float64 {
	return DashSpeedV14 / TickRate
}

// ============================================================
// Weapon Slot Management
// ============================================================

// AddWeapon adds a weapon to the agent's inventory.
// If the weapon already exists, it evolves (level up).
// Returns true if added/evolved, false if slots full and weapon is new.
func AddWeapon(a *domain.Agent, weaponType domain.WeaponType) bool {
	// Check if already have this weapon — evolve
	for i := range a.WeaponSlots {
		if a.WeaponSlots[i].Type == weaponType {
			if a.WeaponSlots[i].Level < domain.MaxWeaponLevel {
				a.WeaponSlots[i].Level++
			}
			return true
		}
	}

	// Check slot limit
	if len(a.WeaponSlots) >= domain.MaxWeaponSlots {
		return false
	}

	// Add new weapon
	a.WeaponSlots = append(a.WeaponSlots, domain.WeaponSlot{
		Type:          weaponType,
		Level:         1,
		CooldownTicks: 0,
	})
	return true
}

// HasWeapon checks if agent has a specific weapon type.
func HasWeapon(a *domain.Agent, weaponType domain.WeaponType) bool {
	for _, slot := range a.WeaponSlots {
		if slot.Type == weaponType {
			return true
		}
	}
	return false
}

// GetWeaponLevel returns the level of a weapon (0 if not owned).
func GetWeaponLevel(a *domain.Agent, weaponType domain.WeaponType) int {
	for _, slot := range a.WeaponSlots {
		if slot.Type == weaponType {
			return slot.Level
		}
	}
	return 0
}

// ============================================================
// Status Effect Queries
// ============================================================

// IsStunned returns true if the agent is currently stunned.
func IsStunned(a *domain.Agent) bool {
	for _, se := range a.StatusEffects {
		if se.Type == domain.StatusStun && se.TicksLeft > 0 {
			return true
		}
	}
	return false
}

// GetSlowFraction returns the total slow fraction applied to the agent.
func GetSlowFraction(a *domain.Agent) float64 {
	maxSlow := 0.0
	for _, se := range a.StatusEffects {
		if se.Type == domain.StatusSlow && se.TicksLeft > 0 {
			if se.SlowFraction > maxSlow {
				maxSlow = se.SlowFraction
			}
		}
	}
	return maxSlow
}

// ============================================================
// v14 Agent Update (replaces old movement for weapon system)
// ============================================================

// UpdateAgentV14 advances the agent state by one tick with v14 mechanics.
func UpdateAgentV14(a *domain.Agent, currentTick uint64, terrainMods ...TerrainModifiers) {
	if !a.Alive {
		return
	}

	// Check invincibility timeout
	if a.Invincible && currentTick >= a.InvincibleEnd {
		a.Invincible = false
	}

	// Stun check: no movement while stunned
	if IsStunned(a) {
		// Still tick effects and cooldowns
		tickActiveEffects(a)
		tickCooldowns(a)
		return
	}

	// 1. Update heading
	updateHeading(a)

	// 2. Handle dash
	UpdateDash(a, currentTick)

	// 3. Calculate effective speed
	speedMult := 1.0
	// Swift passive bonus (using TomeSpeed)
	swiftStacks := a.Build.Tomes[domain.TomeSpeed]
	speedMult += float64(swiftStacks) * 0.12

	// Slow debuff
	slowFrac := GetSlowFraction(a)
	speedMult *= (1.0 - slowFrac)

	// Terrain
	terrainSpeedMult := 1.0
	if len(terrainMods) > 0 {
		terrainSpeedMult = terrainMods[0].SpeedMult
	}

	var movePerTick float64
	if a.Boosting {
		movePerTick = GetDashSpeedPerTick() * terrainSpeedMult
	} else {
		movePerTick = BaseSpeedPerTick * speedMult * terrainSpeedMult
		maxSpeed := MaxSpeedPerTick * terrainSpeedMult
		if movePerTick > maxSpeed {
			movePerTick = maxSpeed
		}
	}

	// 4. Move position (v16: use MoveHeading for movement direction)
	a.Position.X += math.Cos(a.MoveHeading) * movePerTick
	a.Position.Y += math.Sin(a.MoveHeading) * movePerTick

	// 5. Update hitbox radius based on level (not mass)
	a.HitboxRadius = HitboxMinRadius + float64(a.Level)*0.5
	if a.HitboxRadius > HitboxMaxRadius {
		a.HitboxRadius = HitboxMaxRadius
	}

	// 6. HP regen from Vitality passive (using TomeRegen)
	regenStacks := a.Build.Tomes[domain.TomeRegen]
	if regenStacks > 0 {
		hpRegen := float64(regenStacks) * 2.0 / TickRate // +2 HP/s per stack
		a.HP += hpRegen
		if a.HP > a.MaxHP {
			a.HP = a.MaxHP
		}
	}

	// 7. Tick legacy active effects
	tickActiveEffects(a)

	// 8. Tick ability cooldowns
	tickCooldowns(a)

	// 9. Check death
	if a.HP <= 0 {
		a.HP = 0
		AgentDie(a)
	}
}

// RespawnAgent handles agent respawn in v14 deathmatch.
func RespawnAgent(a *domain.Agent, spawnPos domain.Position, currentTick uint64) {
	a.Alive = true
	a.Position = spawnPos
	a.HP = a.MaxHP
	a.Invincible = true
	a.InvincibleEnd = currentTick + uint64(RespawnInvincibleTicks)
	a.GracePeriodEnd = currentTick + uint64(RespawnInvincibleTicks)
	a.Boosting = false
	a.Speed = BaseSpeed
	a.StatusEffects = make([]domain.StatusEffect, 0)
	a.Deaths++
	// Level and weapons preserved
}
