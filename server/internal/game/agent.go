package game

import (
	"math"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// --- Agent Helper Functions ---
// These operate on domain.Agent pointers, keeping domain package free of game logic imports.

// NewAgent creates a new Agent with default values at the given position.
func NewAgent(id, name string, pos domain.Position, skin domain.AgentSkin, isBot bool, currentTick uint64, appearance string) *domain.Agent {
	return &domain.Agent{
		ID:              id,
		Name:            name,
		Position:        pos,
		Heading:         0,
		MoveHeading:     0,
		AimHeading:      0,
		TargetAngle:     0,
		MoveTargetAngle: 0,
		AimTargetAngle:  0,
		Speed:           BaseSpeed,
		Mass:     InitialMass,
		Level:    InitialLevel,
		XP:       0,
		XPToNext: domain.XPForLevel(2),
		Boosting: false,
		Alive:    true,
		Build: domain.PlayerBuild{
			Tomes:        make(map[domain.TomeType]int),
			AbilitySlots: make([]domain.AbilitySlot, 0),
			MaxAbilities: AbilityBaseSlots,
		},
		ActiveSynergies: make([]string, 0),
		Skin:            skin,
		Appearance:      appearance,
		ActiveEffects:   make([]domain.ActiveEffect, 0),
		EffectCooldowns: make([]domain.EffectCooldown, 0),
		Score:           0,
		Kills:           0,
		HitboxRadius:    HitboxMinRadius,
		GracePeriodEnd:  currentTick + GracePeriodTicks,
		IsBot:           isBot,
	}
}

// NewAgentWithNationality creates a new Agent with nationality set.
func NewAgentWithNationality(id, name string, pos domain.Position, skin domain.AgentSkin, isBot bool, currentTick uint64, appearance, nationality string) *domain.Agent {
	agent := NewAgent(id, name, pos, skin, isBot, currentTick, appearance)
	agent.Nationality = nationality
	return agent
}

// SetNationality sets the agent's nationality.
func SetNationality(a *domain.Agent, nationality string) {
	a.Nationality = nationality
}

// IsSameNation returns true if two agents share the same nationality (allies).
func IsSameNation(a, b *domain.Agent) bool {
	if a.Nationality == "" || b.Nationality == "" {
		return false
	}
	return a.Nationality == b.Nationality
}

// GroupByNationality groups agents by their nationality.
func GroupByNationality(agents map[string]*domain.Agent) map[string][]*domain.Agent {
	groups := make(map[string][]*domain.Agent)
	for _, agent := range agents {
		if agent.Nationality != "" {
			groups[agent.Nationality] = append(groups[agent.Nationality], agent)
		}
	}
	return groups
}

// NationalityPlayerCount returns the number of players of a given nationality.
func NationalityPlayerCount(agents map[string]*domain.Agent, nationality string) int {
	count := 0
	for _, agent := range agents {
		if agent.Nationality == nationality {
			count++
		}
	}
	return count
}

// ApplyInput sets the target angle and boosting state from player input.
// v16: Legacy single-angle mode — sets both move and aim to the same angle.
func ApplyInput(a *domain.Agent, angle float64, boost bool) {
	if !a.Alive {
		return
	}
	normalized := normalizeAngle(angle)
	a.TargetAngle = normalized
	a.MoveTargetAngle = normalized
	a.AimTargetAngle = normalized
	a.Boosting = boost
}

// ApplyInputSplit sets separate move and aim target angles (v16 WASD+mouse).
func ApplyInputSplit(a *domain.Agent, moveAngle float64, aimAngle float64, boost bool) {
	if !a.Alive {
		return
	}
	a.MoveTargetAngle = normalizeAngle(moveAngle)
	a.AimTargetAngle = normalizeAngle(aimAngle)
	a.TargetAngle = a.MoveTargetAngle // legacy compat
	a.Boosting = boost
}

// UpdateAgentOptions holds optional parameters for UpdateAgent.
type UpdateAgentOptions struct {
	TerrainMods TerrainModifiers
	Heightmap   *Heightmap
}

// UpdateAgent advances the agent state by one tick.
// terrainMods applies terrain-specific multipliers (pass DefaultTerrainModifiers() for no effect).
func UpdateAgent(a *domain.Agent, currentTick uint64, terrainMods ...TerrainModifiers) {
	UpdateAgentWithHeightmap(a, currentTick, nil, terrainMods...)
}

// UpdateAgentWithHeightmap advances the agent state by one tick with heightmap terrain physics.
func UpdateAgentWithHeightmap(a *domain.Agent, currentTick uint64, hm *Heightmap, terrainMods ...TerrainModifiers) {
	if !a.Alive {
		return
	}

	// 1. Update heading toward target angle with turn rate limit
	updateHeading(a)

	// 2. Handle boosting
	if a.Boosting {
		if a.Mass < MinBoostMass {
			a.Boosting = false
		} else {
			a.Mass -= BoostCostPerTick
			if a.Mass < 0 {
				a.Mass = 0
			}
		}
	}

	// 3. Calculate effective speed (base + Speed Tome bonus + terrain modifier)
	speedMult := 1.0 + float64(a.Build.Tomes[domain.TomeSpeed])*getTomeEffect(domain.TomeSpeed)
	// Apply terrain speed modifier
	terrainSpeedMult := 1.0
	if len(terrainMods) > 0 {
		terrainSpeedMult = terrainMods[0].SpeedMult
	}
	var movePerTick float64
	if a.Boosting {
		movePerTick = BoostSpeedPerTick * terrainSpeedMult
	} else {
		movePerTick = BaseSpeedPerTick * speedMult * terrainSpeedMult
		// Cap at max speed (pre-terrain)
		if movePerTick > MaxSpeedPerTick*terrainSpeedMult {
			movePerTick = MaxSpeedPerTick * terrainSpeedMult
		}
	}

	// 4. Move position (v16: use MoveHeading for movement direction)
	newX := a.Position.X + math.Cos(a.MoveHeading)*movePerTick
	newY := a.Position.Y + math.Sin(a.MoveHeading)*movePerTick

	// v16 Phase 4: Heightmap terrain checks (slope speed, cliff restriction)
	if hm != nil {
		curHeight := hm.GetHeight(a.Position.X, a.Position.Y)
		newHeight := hm.GetHeight(newX, newY)
		heightDiff := math.Abs(newHeight - curHeight)

		// Cliff restriction: can't climb steep cliffs
		if heightDiff > ClimbMaxDelta {
			// Block movement — stay at current position
			newX = a.Position.X
			newY = a.Position.Y
		} else {
			// Slope speed reduction: steep slopes slow you down
			slope := hm.GetSlope(newX, newY)
			if slope > SlopeThreshold {
				slopePenalty := 1.0 - slope*0.5
				if slopePenalty < 0.3 {
					slopePenalty = 0.3
				}
				dx := newX - a.Position.X
				dy := newY - a.Position.Y
				newX = a.Position.X + dx*slopePenalty
				newY = a.Position.Y + dy*slopePenalty
			}
		}
	}

	a.Position.X = newX
	a.Position.Y = newY

	// v16 Phase 4: Vertical physics (gravity + ground clamping)
	if hm != nil {
		groundHeight := hm.GetHeight(a.Position.X, a.Position.Y)
		a.ZVelocity -= Gravity
		a.ZPos += a.ZVelocity
		// Ground clamping
		if a.ZPos <= groundHeight {
			a.ZPos = groundHeight
			a.ZVelocity = 0
		}
	}

	// 5. Update hitbox radius based on mass
	a.HitboxRadius = calcHitboxRadius(a.Mass)

	// 6. Apply regen from Regen Tome
	regenStacks := a.Build.Tomes[domain.TomeRegen]
	if regenStacks > 0 {
		a.Mass += float64(regenStacks) * RegenPerTickPerStack
	}

	// 7. Tick active effects (decrement duration, remove expired)
	tickActiveEffects(a)

	// 8. Tick ability cooldowns
	tickCooldowns(a)

	// 9. Check death by zero mass
	if a.Mass <= 0 {
		a.Mass = 0
		AgentDie(a)
	}
}

// TakeDamage applies damage to an agent, respecting armor and grace period.
// Returns actual damage dealt.
func TakeDamage(a *domain.Agent, amount float64, sourceID string, currentTick uint64) float64 {
	if !a.Alive {
		return 0
	}

	// Grace period: invincible
	if currentTick < a.GracePeriodEnd {
		return 0
	}

	// Armor Tome reduces damage
	armorStacks := a.Build.Tomes[domain.TomeArmor]
	armorReduction := float64(armorStacks) * getTomeEffect(domain.TomeArmor)

	// Cursed Tome increases damage taken
	cursedStacks := a.Build.Tomes[domain.TomeCursed]
	cursedVulnerability := float64(cursedStacks) * 0.20 // +20% damage taken per stack

	// Check synergy: Iron Fortress — additional -30% damage reduction
	for _, syn := range a.ActiveSynergies {
		if syn == "iron_fortress" {
			armorReduction += 0.30
		}
	}

	effectiveDamage := amount * (1.0 - armorReduction + cursedVulnerability)
	if effectiveDamage < 0 {
		effectiveDamage = 0
	}

	a.Mass -= effectiveDamage
	if a.Mass < 0 {
		a.Mass = 0
	}

	if sourceID != "" {
		a.LastDamagedBy = sourceID
	}

	return effectiveDamage
}

// AgentDie marks the agent as dead.
func AgentDie(a *domain.Agent) {
	a.Alive = false
	a.Boosting = false
	a.Speed = 0
}

// AddXP adds XP to the agent and returns true if leveled up.
func AddXP(a *domain.Agent, amount int) bool {
	if !a.Alive || a.Level >= domain.MaxLevel {
		return false
	}

	// XP Tome bonus
	xpStacks := a.Build.Tomes[domain.TomeXP]
	xpMult := 1.0 + float64(xpStacks)*getTomeEffect(domain.TomeXP)

	// Check synergy: Holy Trinity — XP +50%
	for _, syn := range a.ActiveSynergies {
		if syn == "holy_trinity" {
			xpMult += 0.50
		}
	}

	effectiveXP := int(math.Ceil(float64(amount) * xpMult))
	a.XP += effectiveXP

	if a.XP >= a.XPToNext && a.Level < domain.MaxLevel {
		return true
	}
	return false
}

// PerformLevelUp increments the agent's level and updates XP thresholds.
func PerformLevelUp(a *domain.Agent) {
	if a.Level >= domain.MaxLevel {
		return
	}
	a.XP -= a.XPToNext
	if a.XP < 0 {
		a.XP = 0
	}
	a.Level++
	if a.Level < domain.MaxLevel {
		a.XPToNext = domain.XPForLevel(a.Level + 1)
	} else {
		a.XPToNext = 0
	}
}

// AddMass adds mass to the agent (from orb collection, etc.).
func AddMass(a *domain.Agent, amount float64) {
	if !a.Alive {
		return
	}
	a.Mass += amount
}

// AddKill records a kill for the agent.
func AddKill(a *domain.Agent) {
	a.Kills++
	a.KillStreak++
	a.Score += 100 // base kill score
}

// IsInGracePeriod returns true if the agent is in grace period.
func IsInGracePeriod(a *domain.Agent, currentTick uint64) bool {
	return currentTick < a.GracePeriodEnd
}

// GetEffectiveAuraDPS returns the agent's aura DPS per tick, factoring in Damage Tome and synergies.
func GetEffectiveAuraDPS(a *domain.Agent) float64 {
	dps := BaseAuraDPSPerTick

	// Damage Tome bonus
	dmgStacks := a.Build.Tomes[domain.TomeDamage]
	dps *= (1.0 + float64(dmgStacks)*getTomeEffect(domain.TomeDamage))

	// Cursed Tome DPS bonus (+25% per stack)
	cursedStacks := a.Build.Tomes[domain.TomeCursed]
	dps *= (1.0 + float64(cursedStacks)*getTomeEffect(domain.TomeCursed))

	// Synergy: Glass Cannon — DPS x2
	for _, syn := range a.ActiveSynergies {
		if syn == "glass_cannon" {
			dps *= 2.0
		}
	}

	return dps
}

// GetEffectiveDashDamage returns the burst dash damage based on target's mass.
func GetEffectiveDashDamage(attacker *domain.Agent, targetMass float64) float64 {
	dmg := targetMass * DashDamageRatio

	// Synergy: Berserker — dash damage x3
	for _, syn := range attacker.ActiveSynergies {
		if syn == "berserker" {
			dmg *= 3.0
		}
	}

	return dmg
}

// GetEffectiveCollectRadius returns the orb collect radius with Magnet Tome bonus.
func GetEffectiveCollectRadius(a *domain.Agent) float64 {
	magnetStacks := a.Build.Tomes[domain.TomeMagnet]
	return OrbCollectRadius * (1.0 + float64(magnetStacks)*getTomeEffect(domain.TomeMagnet))
}

// GetEffectiveBoostCost returns the boost cost per tick, factoring in Speedster synergy.
func GetEffectiveBoostCost(a *domain.Agent) float64 {
	cost := BoostCostPerTick
	for _, syn := range a.ActiveSynergies {
		if syn == "speedster" {
			cost *= 0.50 // Speedster: -50% boost cost
		}
	}
	return cost
}

// --- Internal helpers ---

// updateHeading rotates both MoveHeading and AimHeading toward their targets
// with TurnRate limit. Also syncs the legacy Heading field with MoveHeading.
func updateHeading(a *domain.Agent) {
	// Update MoveHeading toward MoveTargetAngle
	moveDiff := normalizeAngle(a.MoveTargetAngle - a.MoveHeading)
	if math.Abs(moveDiff) <= TurnRate {
		a.MoveHeading = a.MoveTargetAngle
	} else if moveDiff > 0 {
		a.MoveHeading = normalizeAngle(a.MoveHeading + TurnRate)
	} else {
		a.MoveHeading = normalizeAngle(a.MoveHeading - TurnRate)
	}

	// Update AimHeading toward AimTargetAngle (same turn rate for now)
	aimDiff := normalizeAngle(a.AimTargetAngle - a.AimHeading)
	if math.Abs(aimDiff) <= TurnRate {
		a.AimHeading = a.AimTargetAngle
	} else if aimDiff > 0 {
		a.AimHeading = normalizeAngle(a.AimHeading + TurnRate)
	} else {
		a.AimHeading = normalizeAngle(a.AimHeading - TurnRate)
	}

	// Sync legacy fields
	a.Heading = a.MoveHeading
	a.TargetAngle = a.MoveTargetAngle
}

// normalizeAngle wraps an angle to [-pi, pi].
func normalizeAngle(a float64) float64 {
	for a > math.Pi {
		a -= 2 * math.Pi
	}
	for a < -math.Pi {
		a += 2 * math.Pi
	}
	return a
}

// calcHitboxRadius returns the hitbox radius based on mass.
// Linear interpolation from HitboxMinRadius (mass=0) to HitboxMaxRadius (mass=200+).
func calcHitboxRadius(mass float64) float64 {
	t := mass / 200.0
	if t > 1.0 {
		t = 1.0
	}
	if t < 0.0 {
		t = 0.0
	}
	return HitboxMinRadius + (HitboxMaxRadius-HitboxMinRadius)*t
}

// getTomeEffect returns the effect-per-stack for a given TomeType.
func getTomeEffect(t domain.TomeType) float64 {
	def := domain.GetTomeDef(t)
	if def == nil {
		return 0
	}
	return def.EffectPerStack
}

// tickActiveEffects decrements durations and removes expired effects.
func tickActiveEffects(a *domain.Agent) {
	active := a.ActiveEffects[:0]
	for i := range a.ActiveEffects {
		a.ActiveEffects[i].Duration--
		if a.ActiveEffects[i].Duration > 0 {
			active = append(active, a.ActiveEffects[i])
		}
	}
	a.ActiveEffects = active
}

// tickCooldowns decrements ability cooldowns and removes completed ones.
func tickCooldowns(a *domain.Agent) {
	remaining := a.EffectCooldowns[:0]
	for i := range a.EffectCooldowns {
		a.EffectCooldowns[i].TicksLeft--
		if a.EffectCooldowns[i].TicksLeft > 0 {
			remaining = append(remaining, a.EffectCooldowns[i])
		}
	}
	a.EffectCooldowns = remaining
}

// HasCooldown checks if a specific ability is on cooldown.
func HasCooldown(a *domain.Agent, abilityType domain.AbilityType) bool {
	for _, cd := range a.EffectCooldowns {
		if cd.AbilityType == abilityType {
			return true
		}
	}
	return false
}

// AddCooldown adds a cooldown for an ability.
func AddCooldown(a *domain.Agent, abilityType domain.AbilityType, ticks int) {
	a.EffectCooldowns = append(a.EffectCooldowns, domain.EffectCooldown{
		AbilityType: abilityType,
		TicksLeft:   ticks,
	})
}

// AddEffect adds a temporary effect to an agent.
func AddEffect(a *domain.Agent, effectType string, duration int, value float64) {
	a.ActiveEffects = append(a.ActiveEffects, domain.ActiveEffect{
		Type:     effectType,
		Duration: duration,
		Value:    value,
	})
}

// HasEffect checks if the agent has a specific active effect.
func HasEffect(a *domain.Agent, effectType string) bool {
	for _, e := range a.ActiveEffects {
		if e.Type == effectType {
			return true
		}
	}
	return false
}

// DistanceBetween returns the Euclidean distance between two positions.
func DistanceBetween(a, b domain.Position) float64 {
	dx := a.X - b.X
	dy := a.Y - b.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// DistanceSq returns the squared distance between two positions (avoids sqrt).
func DistanceSq(a, b domain.Position) float64 {
	dx := a.X - b.X
	dy := a.Y - b.Y
	return dx*dx + dy*dy
}
