package game

import (
	"math"
	"math/rand"

	"github.com/to-nexus/snake-server/internal/domain"
)

// Agent wraps domain.Agent with game-logic methods.
type Agent struct {
	domain.Agent
}

// NewAgent creates a new agent at a random position within the arena.
func NewAgent(id, name string, skinID int, pos domain.Position, tick uint64) *Agent {
	heading := rand.Float64() * 2 * math.Pi
	skin := domain.GetSkinByID(skinID)

	a := &Agent{
		Agent: domain.Agent{
			ID:              id,
			Name:            name,
			Position:        pos,
			Heading:         heading,
			TargetAngle:     heading,
			Speed:           0,
			Mass:            0,  // set below
			Level:           1,
			XP:              0,
			XPToNext:        domain.XPTable[1],
			Boosting:        false,
			Alive:           true,
			Build:           domain.NewPlayerBuild(),
			ActiveSynergies: make([]string, 0),
			Skin:            skin,
			ActiveEffects:   make([]domain.ActiveEffect, 0, 4),
			EffectCooldowns: make([]domain.EffectCooldown, 0, 4),
			Score:           0,
			Kills:           0,
			BestScore:       0,
			JoinedAt:        tick,
			LastInputSeq:    0,
			HitboxRadius:    0,
			LastDamagedBy:   "",
			KillStreak:      0,
			PendingChoices:  nil,
			UpgradeDeadline: 0,
			GracePeriodEnd:  0,
			IsBot:           false,
		},
	}
	return a
}

// InitWithConfig sets initial mass, speed, hitbox, and grace period from config.
func (a *Agent) InitWithConfig(cfg ArenaConfig, tick uint64) {
	a.Mass = cfg.InitialMass
	a.Speed = cfg.BaseSpeed
	a.HitboxRadius = calcHitboxRadius(a.Mass, cfg)
	a.GracePeriodEnd = tick + uint64(cfg.GracePeriodTicks)
}

// ApplyInput updates the agent's target angle, boost state, and input sequence.
func (a *Agent) ApplyInput(angle float64, boost int, seq int) {
	a.TargetAngle = normalizeAngle(angle)
	a.Boosting = boost != 0
	a.LastInputSeq = seq
}

// Update performs per-tick physics: steering, boost, movement, hitbox, regen.
func (a *Agent) Update(cfg ArenaConfig) {
	if !a.Alive {
		return
	}

	// 1. Steering (angle lerp with turn rate limit)
	diff := angleDiff(a.Heading, a.TargetAngle)
	if math.Abs(diff) <= cfg.TurnRate {
		a.Heading = a.TargetAngle
	} else {
		if diff > 0 {
			a.Heading += cfg.TurnRate
		} else {
			a.Heading -= cfg.TurnRate
		}
	}
	a.Heading = normalizeAngle(a.Heading)

	// 2. Speed Tome bonus
	speedTomeStacks := a.Build.Tomes[domain.TomeSpeed]
	speedBonus := 1.0 + float64(speedTomeStacks)*domain.TomeDefs[domain.TomeSpeed].EffectPerStack
	effectiveBaseSpeed := cfg.BaseSpeed * speedBonus

	// 3. Boost handling
	hasSpeedEffect := a.HasEffect(domain.EffectSpeed)
	speed := effectiveBaseSpeed

	if a.Boosting && (a.Mass > cfg.MinBoostMass || hasSpeedEffect) {
		speed = cfg.BoostSpeed
		if !hasSpeedEffect {
			boostCost := cfg.BoostCostPerTick
			// Speedster synergy: 50% boost cost reduction
			if a.HasSynergy("speedster") {
				boostCost *= 0.5
			}
			a.Mass -= boostCost
		}
	} else {
		a.Boosting = false
	}
	a.Speed = speed

	// 4. Position update
	movePerTick := speed / float64(cfg.TickRate)
	a.Position.X += math.Cos(a.Heading) * movePerTick
	a.Position.Y += math.Sin(a.Heading) * movePerTick

	// 5. Hitbox update
	a.HitboxRadius = calcHitboxRadius(a.Mass, cfg)

	// 6. Regen Tome
	regenStacks := a.Build.Tomes[domain.TomeRegen]
	if regenStacks > 0 {
		a.Mass += float64(regenStacks) * domain.TomeDefs[domain.TomeRegen].EffectPerStack
	}

	// 7. Score = current mass
	a.Score = int(a.Mass)
	if a.Score > a.BestScore {
		a.BestScore = a.Score
	}
}

// TakeDamage applies damage with armor/cursed damage reduction.
func (a *Agent) TakeDamage(rawDamage float64, sourceID string) {
	reduction := a.getDamageReduction()
	actualDamage := rawDamage * (1 - reduction)
	a.Mass -= actualDamage
	if sourceID != "" {
		a.LastDamagedBy = sourceID
	}
	if a.Mass < 0 {
		a.Mass = 0
	}
}

// getDamageReduction calculates total damage reduction from armor, synergies, and cursed penalty.
func (a *Agent) getDamageReduction() float64 {
	armorStacks := a.Build.Tomes[domain.TomeArmor]
	reduction := float64(armorStacks) * domain.TomeDefs[domain.TomeArmor].EffectPerStack

	// Iron Fortress synergy: +30% damage reduction
	if a.HasSynergy("iron_fortress") {
		reduction += 0.30
	}

	// Cursed Tome penalty: +20% damage taken per stack
	cursedStacks := a.Build.Tomes[domain.TomeCursed]
	cursedPenalty := float64(cursedStacks) * 0.20

	// Glass Cannon synergy: x2 damage taken
	if a.HasSynergy("glass_cannon") {
		return math.Max(0, reduction-cursedPenalty-1.0)
	}

	result := reduction - cursedPenalty
	if result < 0 {
		result = 0
	}
	if result > 0.90 {
		result = 0.90
	}
	return result
}

// AddXP adds XP with XP Tome bonus. Returns true if the agent leveled up.
func (a *Agent) AddXP(baseXP int) bool {
	if a.Level >= domain.MaxLevel {
		return false
	}

	// XP Tome bonus
	xpMultiplier := 1.0 + float64(a.Build.Tomes[domain.TomeXP])*domain.TomeDefs[domain.TomeXP].EffectPerStack

	// Holy Trinity synergy: +50% XP
	if a.HasSynergy("holy_trinity") {
		xpMultiplier *= 1.5
	}

	// Shrine XP buff: +50% XP while active
	if a.HasEffect(ShrineBuff) {
		xpMultiplier *= ShrineXPMultiplier
	}

	a.XP += int(float64(baseXP) * xpMultiplier)

	// Level up check
	if a.XP >= a.XPToNext {
		a.XP -= a.XPToNext
		a.Level++
		if a.Level < len(domain.XPTable) {
			a.XPToNext = domain.XPTable[a.Level]
		} else {
			a.XPToNext = 999999
		}
		return true
	}
	return false
}

// GetAuraDPS calculates the agent's aura damage per tick.
func (a *Agent) GetAuraDPS(cfg ArenaConfig) float64 {
	dps := cfg.AuraDPSPerTick

	// Damage Tome
	dmgStacks := a.Build.Tomes[domain.TomeDamage]
	dps *= 1.0 + float64(dmgStacks)*domain.TomeDefs[domain.TomeDamage].EffectPerStack

	// Cursed Tome DPS bonus
	cursedStacks := a.Build.Tomes[domain.TomeCursed]
	dps *= 1.0 + float64(cursedStacks)*domain.TomeDefs[domain.TomeCursed].EffectPerStack

	// High level bonus
	if a.Level >= domain.CombatHighLevelThreshold {
		dps *= 1.0 + domain.CombatHighLevelDPSBonus
	}

	// Glass Cannon synergy: x2 DPS
	if a.HasSynergy("glass_cannon") {
		dps *= 2.0
	}

	return dps
}

// AddMass adds mass to the agent (orb collection).
func (a *Agent) AddMass(value float64) {
	a.Mass += value
}

// HasEffect returns true if the agent has the specified active effect.
func (a *Agent) HasEffect(effectType domain.EffectType) bool {
	for _, e := range a.ActiveEffects {
		if e.Type == effectType {
			return true
		}
	}
	return false
}

// HasSynergy returns true if the agent has the specified synergy active.
func (a *Agent) HasSynergy(synergyID string) bool {
	for _, s := range a.ActiveSynergies {
		if s == synergyID {
			return true
		}
	}
	return false
}

// AddEffect adds or replaces an active effect.
func (a *Agent) AddEffect(effectType domain.EffectType, durationTicks int, currentTick uint64) {
	// Remove existing effect of same type
	filtered := a.ActiveEffects[:0]
	for _, e := range a.ActiveEffects {
		if e.Type != effectType {
			filtered = append(filtered, e)
		}
	}
	a.ActiveEffects = append(filtered, domain.ActiveEffect{
		Type:      effectType,
		ExpiresAt: currentTick + uint64(durationTicks),
	})
}

// RemoveExpiredEffects removes effects that have expired and sets cooldowns.
func (a *Agent) RemoveExpiredEffects(currentTick uint64) {
	// Find expired effects and set cooldowns
	for _, e := range a.ActiveEffects {
		if e.ExpiresAt <= currentTick {
			// Ghost has a cooldown
			if e.Type == domain.EffectGhost {
				// Remove existing cooldown for this type
				filtered := a.EffectCooldowns[:0]
				for _, c := range a.EffectCooldowns {
					if c.Type != e.Type {
						filtered = append(filtered, c)
					}
				}
				a.EffectCooldowns = append(filtered, domain.EffectCooldown{
					Type:        e.Type,
					AvailableAt: currentTick + uint64(GhostCooldownTicks),
				})
			}
		}
	}

	// Remove expired effects
	filtered := a.ActiveEffects[:0]
	for _, e := range a.ActiveEffects {
		if e.ExpiresAt > currentTick {
			filtered = append(filtered, e)
		}
	}
	a.ActiveEffects = filtered

	// Remove expired cooldowns
	filteredCD := a.EffectCooldowns[:0]
	for _, c := range a.EffectCooldowns {
		if c.AvailableAt > currentTick {
			filteredCD = append(filteredCD, c)
		}
	}
	a.EffectCooldowns = filteredCD
}

// CanPickupEffect returns true if the effect is not on cooldown.
func (a *Agent) CanPickupEffect(effectType domain.EffectType, currentTick uint64) bool {
	for _, c := range a.EffectCooldowns {
		if c.Type == effectType && c.AvailableAt > currentTick {
			return false
		}
	}
	return true
}

// Die marks the agent as dead.
func (a *Agent) Die() {
	a.Alive = false
	a.KillStreak = 0
}

// Respawn resets the agent to initial state at a new position.
func (a *Agent) Respawn(cfg ArenaConfig, pos domain.Position, tick uint64) {
	heading := rand.Float64() * 2 * math.Pi

	a.Position = pos
	a.Heading = heading
	a.TargetAngle = heading
	a.Speed = cfg.BaseSpeed
	a.Mass = cfg.InitialMass
	a.Level = 1
	a.XP = 0
	a.XPToNext = domain.XPTable[1]
	a.Boosting = false
	a.Alive = true
	a.Build = domain.NewPlayerBuild()
	a.ActiveSynergies = a.ActiveSynergies[:0]
	a.ActiveEffects = a.ActiveEffects[:0]
	a.EffectCooldowns = a.EffectCooldowns[:0]
	a.Score = 0
	a.Kills = 0
	a.HitboxRadius = calcHitboxRadius(cfg.InitialMass, cfg)
	a.LastDamagedBy = ""
	a.KillStreak = 0
	a.PendingChoices = nil
	a.UpgradeDeadline = 0
	a.GracePeriodEnd = tick + uint64(cfg.GracePeriodTicks)
}

// GetCollectRadius returns the orb collection radius including Magnet Tome bonus.
func (a *Agent) GetCollectRadius(cfg ArenaConfig) float64 {
	magnetStacks := a.Build.Tomes[domain.TomeMagnet]
	magnetBonus := 1.0 + float64(magnetStacks)*domain.TomeDefs[domain.TomeMagnet].EffectPerStack
	return cfg.CollectRadius * magnetBonus
}

// GetKillStreakMultiplier returns the XP multiplier based on current kill streak.
func (a *Agent) GetKillStreakMultiplier() float64 {
	if a.KillStreak >= 10 {
		return 3.0
	}
	if a.KillStreak >= 5 {
		return 2.0
	}
	if a.KillStreak >= 3 {
		return 1.5
	}
	return 1.0
}

// ─── Helper functions ───

// calcHitboxRadius computes hitbox radius from mass (16px at mass=10, 22px at mass=100+).
func calcHitboxRadius(mass float64, cfg ArenaConfig) float64 {
	t := (mass - 10) / 90
	if t < 0 {
		t = 0
	}
	if t > 1 {
		t = 1
	}
	return cfg.HitboxBaseRadius + t*(cfg.HitboxMaxRadius-cfg.HitboxBaseRadius)
}

// normalizeAngle wraps an angle to [-Pi, Pi).
func normalizeAngle(a float64) float64 {
	for a > math.Pi {
		a -= 2 * math.Pi
	}
	for a < -math.Pi {
		a += 2 * math.Pi
	}
	return a
}

// angleDiff returns the shortest angular difference from 'from' to 'to', in [-Pi, Pi).
func angleDiff(from, to float64) float64 {
	d := to - from
	for d > math.Pi {
		d -= 2 * math.Pi
	}
	for d < -math.Pi {
		d += 2 * math.Pi
	}
	return d
}

// RandomPositionInCircle returns a random position within a circle of given radius.
func RandomPositionInCircle(radius float64) domain.Position {
	angle := rand.Float64() * 2 * math.Pi
	r := radius * math.Sqrt(rand.Float64())
	return domain.Position{
		X: math.Cos(angle) * r,
		Y: math.Sin(angle) * r,
	}
}

// distance calculates the Euclidean distance between two positions.
func distance(a, b domain.Position) float64 {
	dx := a.X - b.X
	dy := a.Y - b.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// distanceSq calculates the squared Euclidean distance between two positions.
func distanceSq(a, b domain.Position) float64 {
	dx := a.X - b.X
	dy := a.Y - b.Y
	return dx*dx + dy*dy
}

// distanceFromOrigin calculates the distance from the origin.
func distanceFromOrigin(pos domain.Position) float64 {
	return math.Sqrt(pos.X*pos.X + pos.Y*pos.Y)
}
