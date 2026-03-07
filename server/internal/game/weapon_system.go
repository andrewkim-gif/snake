package game

import (
	"math"
	"sort"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 2: WeaponSystem — Auto-fire Combat Engine
// ============================================================

// WeaponSystem manages per-agent weapon slots and auto-fire logic.
type WeaponSystem struct {
	spatialHash  *SpatialHash
	terrainMods  TerrainModifiers
	// Deployable entities (VenomCloud, GravityBomb)
	deployables  []*Deployable
}

// Deployable represents a placed area effect (venom cloud, gravity bomb).
type Deployable struct {
	ID          string
	OwnerID     string
	WeaponType  domain.WeaponType
	Position    domain.Position
	Radius      float64
	TicksLeft   int
	DPSPerTick  float64
	PullForce   float64 // > 0 for gravity bomb
	Exploded    bool    // gravity bomb detonation flag
}

// NewWeaponSystem creates a new weapon system.
func NewWeaponSystem(sh *SpatialHash) *WeaponSystem {
	return &WeaponSystem{
		spatialHash: sh,
		terrainMods: DefaultTerrainModifiers(),
		deployables: make([]*Deployable, 0, 32),
	}
}

// SetTerrainModifiers updates terrain modifiers.
func (ws *WeaponSystem) SetTerrainModifiers(mods TerrainModifiers) {
	ws.terrainMods = mods
}

// ============================================================
// Main Tick — Process all weapons for all agents
// ============================================================

// ProcessWeapons runs the auto-fire loop for all agents.
// Returns weapon damage events for client rendering and collision events for deaths.
func (ws *WeaponSystem) ProcessWeapons(
	agents map[string]*domain.Agent,
	currentTick uint64,
	pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var damageEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		if len(agent.WeaponSlots) == 0 {
			continue
		}

		for i := range agent.WeaponSlots {
			slot := &agent.WeaponSlots[i]

			// Tick down cooldown
			if slot.CooldownTicks > 0 {
				slot.CooldownTicks--
				continue
			}

			// Get weapon data
			wd := domain.GetWeaponData(slot.Type)
			if wd == nil {
				continue
			}

			// Continuous weapons (cooldown=0) fire every tick
			// Cooldown weapons fire when ready
			evData := domain.GetEvolutionData(slot.Level)
			if evData == nil {
				continue
			}

			// Calculate effective stats
			effectiveDPS := wd.BaseDPS * evData.DPSMult
			effectiveRange := wd.Range * evData.RangeMult
			effectiveCooldown := wd.CooldownSec * evData.CooldownMult

			// Execute weapon pattern
			dmgEvts, deathEvts := ws.fireWeapon(agent, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
			damageEvents = append(damageEvents, dmgEvts...)
			deathEvents = append(deathEvents, deathEvts...)

			// Set cooldown (convert seconds to ticks)
			if effectiveCooldown > 0 {
				slot.CooldownTicks = int(effectiveCooldown * TickRate)
			}
		}
	}

	// Process deployables (VenomCloud, GravityBomb)
	dDmg, dDeath := ws.processDeployables(agents, currentTick, pvpEnabled)
	damageEvents = append(damageEvents, dDmg...)
	deathEvents = append(deathEvents, dDeath...)

	return damageEvents, deathEvents
}

// ============================================================
// Weapon Fire Patterns
// ============================================================

func (ws *WeaponSystem) fireWeapon(
	attacker *domain.Agent,
	slot *domain.WeaponSlot,
	wd *domain.WeaponData,
	effectiveDPS float64,
	effectiveRange float64,
	agents map[string]*domain.Agent,
	currentTick uint64,
	pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	switch wd.Pattern {
	case domain.PatternFanSwing:
		return ws.fireFanSwing(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternChainTarget:
		return ws.fireChainTarget(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternCircularRing:
		return ws.fireCircularRing(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternMultiShot:
		return ws.fireMultiShot(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternTeleportBack:
		return ws.fireTeleportBack(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternTargetedAOE:
		return ws.fireTargetedAOE(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternDeployable:
		ws.deployWeapon(attacker, slot, wd, effectiveDPS, effectiveRange)
		return nil, nil
	case domain.PatternOrbital:
		return ws.fireOrbital(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	case domain.PatternDeployExplode:
		ws.deployGravityBomb(attacker, slot, wd, effectiveDPS, effectiveRange)
		return nil, nil
	case domain.PatternBeam:
		return ws.fireBeam(attacker, slot, wd, effectiveDPS, effectiveRange, agents, currentTick, pvpEnabled)
	default:
		return nil, nil
	}
}

// --- Pattern: Fan Swing (Bonk Mallet) ---

func (ws *WeaponSystem) fireFanSwing(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	halfAngle := (wd.FanAngleDeg / 2.0) * (math.Pi / 180.0)
	nearbyIDs := ws.spatialHash.QueryRadiusExclude(attacker.Position.X, attacker.Position.Y, rng+HitboxMaxRadius, attacker.ID)

	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsSameNation(attacker, target) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceBetween(attacker.Position, target.Position)
		if dist > rng {
			continue
		}

		// Check angle
		angleToTarget := math.Atan2(target.Position.Y-attacker.Position.Y, target.Position.X-attacker.Position.X)
		angleDiff := normalizeAngle(angleToTarget - attacker.Heading)
		if math.Abs(angleDiff) > halfAngle {
			continue
		}

		dmg, isCrit := ws.calculateDamage(attacker, target, dps)
		dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, target, slot.Type, dmg, isCrit, currentTick)
		if dmgEvt != nil {
			dmgEvents = append(dmgEvents, *dmgEvt)
		}
		if deathEvt != nil {
			deathEvents = append(deathEvents, *deathEvt)
		}

		// Knockback
		if wd.KnockbackPx > 0 && dist > 0 {
			applyKnockback(target, attacker.Position, wd.KnockbackPx)
		}
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Chain Target (Chain Bolt) ---

func (ws *WeaponSystem) fireChainTarget(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	chainCount := wd.ChainCount
	if slot.Level >= 5 {
		chainCount = 5 // Ultimate: 5 chains
	}

	// Find nearest enemy
	nearest := ws.findNearestEnemy(attacker, agents, rng, currentTick, pvpEnabled)
	if nearest == nil {
		return nil, nil
	}

	chainDmgMult := 1.0
	hitSet := map[string]bool{attacker.ID: true}
	currentTarget := nearest

	for c := 0; c < chainCount; c++ {
		if currentTarget == nil {
			break
		}
		hitSet[currentTarget.ID] = true

		dmg, isCrit := ws.calculateDamage(attacker, currentTarget, dps*chainDmgMult)
		dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, currentTarget, slot.Type, dmg, isCrit, currentTick)
		if dmgEvt != nil {
			dmgEvents = append(dmgEvents, *dmgEvt)
		}
		if deathEvt != nil {
			deathEvents = append(deathEvents, *deathEvt)
		}

		chainDmgMult *= (1.0 - wd.ChainDecay)

		// Find next target near current
		currentTarget = ws.findNearestEnemyExcluding(currentTarget, agents, rng, currentTick, pvpEnabled, hitSet)
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Circular Ring (Flame Ring) ---

func (ws *WeaponSystem) fireCircularRing(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	nearbyIDs := ws.spatialHash.QueryRadiusExclude(attacker.Position.X, attacker.Position.Y, rng+HitboxMaxRadius, attacker.ID)

	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsSameNation(attacker, target) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceBetween(attacker.Position, target.Position)
		if dist > rng {
			continue
		}

		dmg, isCrit := ws.calculateDamage(attacker, target, dps)
		dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, target, slot.Type, dmg, isCrit, currentTick)
		if dmgEvt != nil {
			dmgEvents = append(dmgEvents, *dmgEvt)
		}
		if deathEvt != nil {
			deathEvents = append(deathEvents, *deathEvt)
		}

		// Apply burn DOT
		if wd.DOTDurationSec > 0 {
			applyStatusEffect(target, domain.StatusBurn, attacker.ID, int(wd.DOTDurationSec*TickRate), wd.DOTDPSPerSec/TickRate, 0)
		}
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Multi Shot (Frost Shards) ---

func (ws *WeaponSystem) fireMultiShot(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	halfAngle := (wd.FanAngleDeg / 2.0) * (math.Pi / 180.0)
	nearbyIDs := ws.spatialHash.QueryRadiusExclude(attacker.Position.X, attacker.Position.Y, rng+HitboxMaxRadius, attacker.ID)

	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsSameNation(attacker, target) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceBetween(attacker.Position, target.Position)
		if dist > rng {
			continue
		}

		angleToTarget := math.Atan2(target.Position.Y-attacker.Position.Y, target.Position.X-attacker.Position.X)
		angleDiff := normalizeAngle(angleToTarget - attacker.Heading)
		if math.Abs(angleDiff) > halfAngle {
			continue
		}

		dmg, isCrit := ws.calculateDamage(attacker, target, dps)
		dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, target, slot.Type, dmg, isCrit, currentTick)
		if dmgEvt != nil {
			dmgEvents = append(dmgEvents, *dmgEvt)
		}
		if deathEvt != nil {
			deathEvents = append(deathEvents, *deathEvt)
		}

		// Apply slow
		if wd.SlowPercent > 0 {
			applyStatusEffect(target, domain.StatusSlow, attacker.ID, int(wd.SlowDurationSec*TickRate), 0, wd.SlowPercent)
		}
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Teleport Back (Shadow Strike) ---

func (ws *WeaponSystem) fireTeleportBack(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	nearest := ws.findNearestEnemy(attacker, agents, rng, currentTick, pvpEnabled)
	if nearest == nil {
		return nil, nil
	}

	// Teleport behind the target
	behindAngle := nearest.Heading + math.Pi // opposite of target's heading
	behindDist := 20.0                        // just behind the target
	attacker.Position.X = nearest.Position.X + math.Cos(behindAngle)*behindDist
	attacker.Position.Y = nearest.Position.Y + math.Sin(behindAngle)*behindDist

	// Backstab damage multiplier
	finalDPS := dps * wd.BackstabMult
	dmg, isCrit := ws.calculateDamage(attacker, nearest, finalDPS)
	dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, nearest, slot.Type, dmg, isCrit, currentTick)

	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent
	if dmgEvt != nil {
		dmgEvents = append(dmgEvents, *dmgEvt)
	}
	if deathEvt != nil {
		deathEvents = append(deathEvents, *deathEvt)
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Targeted AOE (Thunder Clap) ---

func (ws *WeaponSystem) fireTargetedAOE(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	// Find highest HP enemy in range
	target := ws.findHighestHPEnemy(attacker, agents, rng, currentTick, pvpEnabled)
	if target == nil {
		return nil, nil
	}

	// AOE around target (half the weapon range as AOE radius)
	aoeRadius := rng * 0.4
	nearbyIDs := ws.spatialHash.QueryRadiusExclude(target.Position.X, target.Position.Y, aoeRadius+HitboxMaxRadius, attacker.ID)

	for _, tID := range nearbyIDs {
		t, ok := agents[tID]
		if !ok || !t.Alive || (!pvpEnabled && !t.IsBot) {
			continue
		}
		if IsSameNation(attacker, t) {
			continue
		}
		if IsInGracePeriod(t, currentTick) || isInvincible(t) {
			continue
		}

		dist := DistanceBetween(target.Position, t.Position)
		if dist > aoeRadius {
			continue
		}

		dmg, isCrit := ws.calculateDamage(attacker, t, dps)
		dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, t, slot.Type, dmg, isCrit, currentTick)
		if dmgEvt != nil {
			dmgEvents = append(dmgEvents, *dmgEvt)
		}
		if deathEvt != nil {
			deathEvents = append(deathEvents, *deathEvt)
		}

		// Apply stun
		if wd.StunDurationSec > 0 {
			applyStatusEffect(t, domain.StatusStun, attacker.ID, int(wd.StunDurationSec*TickRate), 0, 0)
		}
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Orbital (Crystal Shield) ---

func (ws *WeaponSystem) fireOrbital(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	// Damage enemies within orbital range
	nearbyIDs := ws.spatialHash.QueryRadiusExclude(attacker.Position.X, attacker.Position.Y, rng+HitboxMaxRadius, attacker.ID)

	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsSameNation(attacker, target) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceBetween(attacker.Position, target.Position)
		if dist > rng {
			continue
		}

		// Per-tick damage (continuous)
		tickDPS := dps / TickRate
		dmg, isCrit := ws.calculateDamage(attacker, target, tickDPS)
		dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, target, slot.Type, dmg, isCrit, currentTick)
		if dmgEvt != nil {
			dmgEvents = append(dmgEvents, *dmgEvt)
		}
		if deathEvt != nil {
			deathEvents = append(deathEvents, *deathEvt)
		}
	}
	return dmgEvents, deathEvents
}

// --- Pattern: Beam (Soul Drain) ---

func (ws *WeaponSystem) fireBeam(
	attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData,
	dps, rng float64, agents map[string]*domain.Agent,
	currentTick uint64, pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	nearest := ws.findNearestEnemy(attacker, agents, rng, currentTick, pvpEnabled)
	if nearest == nil {
		return nil, nil
	}

	// Per-tick damage (continuous)
	tickDPS := dps / TickRate
	dmg, isCrit := ws.calculateDamage(attacker, nearest, tickDPS)
	dmgEvt, deathEvt := ws.applyWeaponDamage(attacker, nearest, slot.Type, dmg, isCrit, currentTick)

	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent
	if dmgEvt != nil {
		// Lifesteal
		if wd.LifestealPct > 0 {
			healAmt := dmg * wd.LifestealPct
			attacker.HP += healAmt
			maxHP := getMaxHP(attacker)
			if attacker.HP > maxHP {
				attacker.HP = maxHP
			}
			dmgEvt.IsLifesteal = true
			dmgEvt.HealAmount = healAmt
		}
		dmgEvents = append(dmgEvents, *dmgEvt)
	}
	if deathEvt != nil {
		deathEvents = append(deathEvents, *deathEvt)
	}
	return dmgEvents, deathEvents
}

// --- Deployable: Venom Cloud ---

func (ws *WeaponSystem) deployWeapon(attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData, dps, rng float64) {
	ws.deployables = append(ws.deployables, &Deployable{
		ID:         attacker.ID + "_venom_" + string(rune(len(ws.deployables))),
		OwnerID:    attacker.ID,
		WeaponType: slot.Type,
		Position:   attacker.Position,
		Radius:     rng,
		TicksLeft:  int(wd.DeployDurationSec * TickRate),
		DPSPerTick: dps / TickRate,
	})
}

// --- Deployable: Gravity Bomb ---

func (ws *WeaponSystem) deployGravityBomb(attacker *domain.Agent, slot *domain.WeaponSlot, wd *domain.WeaponData, dps, rng float64) {
	// Find highest HP enemy for placement
	var targetPos domain.Position
	targetPos = attacker.Position // fallback: deploy at self

	ws.deployables = append(ws.deployables, &Deployable{
		ID:         attacker.ID + "_gravity_" + string(rune(len(ws.deployables))),
		OwnerID:    attacker.ID,
		WeaponType: slot.Type,
		Position:   targetPos,
		Radius:     rng,
		TicksLeft:  int(wd.PullDurationSec*TickRate) + TickRate, // pull + 1s explode
		DPSPerTick: dps,
		PullForce:  3.0, // px per tick pull
	})
}

// processDeployables ticks all deployed entities.
func (ws *WeaponSystem) processDeployables(
	agents map[string]*domain.Agent,
	currentTick uint64,
	pvpEnabled bool,
) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent
	var active []*Deployable

	for _, d := range ws.deployables {
		d.TicksLeft--
		if d.TicksLeft <= 0 {
			// Gravity bomb explode on expiry
			if d.WeaponType == domain.WeaponGravityBomb && !d.Exploded {
				d.Exploded = true
				dmg, death := ws.explodeDeployable(d, agents, currentTick, pvpEnabled)
				dmgEvents = append(dmgEvents, dmg...)
				deathEvents = append(deathEvents, death...)
			}
			continue // remove
		}

		// Apply area effects
		nearbyIDs := ws.spatialHash.QueryRadiusExclude(d.Position.X, d.Position.Y, d.Radius+HitboxMaxRadius, d.OwnerID)
		for _, targetID := range nearbyIDs {
			target, ok := agents[targetID]
			if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
				continue
			}
			if IsInGracePeriod(target, currentTick) || isInvincible(target) {
				continue
			}

			dist := DistanceBetween(d.Position, target.Position)
			if dist > d.Radius {
				continue
			}

			owner := agents[d.OwnerID]
			if owner != nil && IsSameNation(owner, target) {
				continue
			}

			// Gravity pull
			if d.PullForce > 0 && dist > 5 {
				angle := math.Atan2(d.Position.Y-target.Position.Y, d.Position.X-target.Position.X)
				target.Position.X += math.Cos(angle) * d.PullForce
				target.Position.Y += math.Sin(angle) * d.PullForce
			}

			// DOT damage
			if d.DPSPerTick > 0 && d.WeaponType != domain.WeaponGravityBomb {
				weaponApplyDamage(target, d.DPSPerTick, d.OwnerID, currentTick)
				dmgEvents = append(dmgEvents, domain.WeaponDamageEvent{
					AttackerID: d.OwnerID, TargetID: target.ID,
					WeaponType: d.WeaponType, Damage: d.DPSPerTick,
					IsDOT: true, TargetX: target.Position.X, TargetY: target.Position.Y,
				})

				if !target.Alive || target.HP <= 0 {
					if target.HP <= 0 && target.Alive {
						AgentDie(target)
					}
					deathEvents = append(deathEvents, CollisionEvent{
						VictimID: target.ID, VictimName: target.Name, VictimMass: target.Mass,
						KillerID: d.OwnerID, DamageSource: domain.DamageSourceWeapon,
					})
				}
			}
		}

		active = append(active, d)
	}

	ws.deployables = active
	return dmgEvents, deathEvents
}

func (ws *WeaponSystem) explodeDeployable(d *Deployable, agents map[string]*domain.Agent, currentTick uint64, pvpEnabled bool) ([]domain.WeaponDamageEvent, []CollisionEvent) {
	var dmgEvents []domain.WeaponDamageEvent
	var deathEvents []CollisionEvent

	nearbyIDs := ws.spatialHash.QueryRadiusExclude(d.Position.X, d.Position.Y, d.Radius+HitboxMaxRadius, d.OwnerID)
	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceBetween(d.Position, target.Position)
		if dist > d.Radius {
			continue
		}

		owner := agents[d.OwnerID]
		if owner != nil && IsSameNation(owner, target) {
			continue
		}

		weaponApplyDamage(target, d.DPSPerTick, d.OwnerID, currentTick)
		dmgEvents = append(dmgEvents, domain.WeaponDamageEvent{
			AttackerID: d.OwnerID, TargetID: target.ID,
			WeaponType: d.WeaponType, Damage: d.DPSPerTick,
			TargetX: target.Position.X, TargetY: target.Position.Y,
		})

		if !target.Alive || target.HP <= 0 {
			if target.HP <= 0 && target.Alive {
				AgentDie(target)
			}
			deathEvents = append(deathEvents, CollisionEvent{
				VictimID: target.ID, VictimName: target.Name, VictimMass: target.Mass,
				KillerID: d.OwnerID, DamageSource: domain.DamageSourceWeapon,
			})
		}
	}
	return dmgEvents, deathEvents
}

// ============================================================
// Damage Calculation
// ============================================================

// calculateDamage applies the v14 damage formula:
// FinalDmg = BaseDmg * (1 + Fury*0.15) * CritMult * TerrainMod - DEF
func (ws *WeaponSystem) calculateDamage(attacker, target *domain.Agent, baseDmg float64) (float64, bool) {
	// Fury passive bonus
	furyStacks := attacker.Build.Tomes[domain.TomeDamage]
	furyMult := 1.0 + float64(furyStacks)*0.15

	// Critical hit
	isCrit := false
	critMult := 1.0
	critChance := attacker.CritChance
	if critChance > 0 {
		// Deterministic pseudo-random: use tick-based check
		// Simple approach: use mod of attacker score as seed
		if pseudoRand(attacker.Score+attacker.Kills) < critChance {
			isCrit = true
			critMult = 2.0 // 200% critical damage
		}
	}

	// Terrain modifier
	terrainMod := ws.terrainMods.DPSMult

	// Defense
	ironSkinStacks := target.Build.Tomes[domain.TomeArmor]
	defense := float64(ironSkinStacks) * 0.12 * target.HP

	finalDmg := baseDmg*furyMult*critMult*terrainMod - defense
	if finalDmg < 1 {
		finalDmg = 1 // minimum 1 damage
	}

	return finalDmg, isCrit
}

// applyWeaponDamage deals damage and returns events.
func (ws *WeaponSystem) applyWeaponDamage(
	attacker, target *domain.Agent,
	weaponType domain.WeaponType,
	dmg float64, isCrit bool,
	currentTick uint64,
) (*domain.WeaponDamageEvent, *CollisionEvent) {
	weaponApplyDamage(target, dmg, attacker.ID, currentTick)

	evt := &domain.WeaponDamageEvent{
		AttackerID: attacker.ID,
		TargetID:   target.ID,
		WeaponType: weaponType,
		Damage:     dmg,
		IsCritical: isCrit,
		TargetX:    target.Position.X,
		TargetY:    target.Position.Y,
	}

	if !target.Alive || target.HP <= 0 {
		if target.HP <= 0 && target.Alive {
			AgentDie(target)
		}
		return evt, &CollisionEvent{
			VictimID:     target.ID,
			VictimName:   target.Name,
			VictimMass:   target.Mass,
			KillerID:     attacker.ID,
			KillerName:   attacker.Name,
			DamageSource: domain.DamageSourceWeapon,
		}
	}
	return evt, nil
}

// weaponApplyDamage reduces HP directly (v14 system).
func weaponApplyDamage(target *domain.Agent, amount float64, sourceID string, currentTick uint64) {
	if !target.Alive {
		return
	}
	if currentTick < target.GracePeriodEnd {
		return
	}

	target.HP -= amount
	if target.HP < 0 {
		target.HP = 0
	}
	if sourceID != "" {
		target.LastDamagedBy = sourceID
	}
}

// ============================================================
// Targeting Helpers
// ============================================================

func (ws *WeaponSystem) findNearestEnemy(
	attacker *domain.Agent, agents map[string]*domain.Agent,
	rng float64, currentTick uint64, pvpEnabled bool,
) *domain.Agent {
	var nearest *domain.Agent
	nearestDist := math.MaxFloat64

	nearbyIDs := ws.spatialHash.QueryRadiusExclude(attacker.Position.X, attacker.Position.Y, rng+HitboxMaxRadius, attacker.ID)
	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsSameNation(attacker, target) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceSq(attacker.Position, target.Position)
		if dist < nearestDist {
			nearestDist = dist
			nearest = target
		}
	}
	return nearest
}

func (ws *WeaponSystem) findNearestEnemyExcluding(
	origin *domain.Agent, agents map[string]*domain.Agent,
	rng float64, currentTick uint64, pvpEnabled bool,
	excludeSet map[string]bool,
) *domain.Agent {
	var nearest *domain.Agent
	nearestDist := math.MaxFloat64

	nearbyIDs := ws.spatialHash.QueryRadiusExclude(origin.Position.X, origin.Position.Y, rng+HitboxMaxRadius, origin.ID)
	for _, targetID := range nearbyIDs {
		if excludeSet[targetID] {
			continue
		}
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}

		dist := DistanceSq(origin.Position, target.Position)
		if dist < nearestDist {
			nearestDist = dist
			nearest = target
		}
	}
	return nearest
}

func (ws *WeaponSystem) findHighestHPEnemy(
	attacker *domain.Agent, agents map[string]*domain.Agent,
	rng float64, currentTick uint64, pvpEnabled bool,
) *domain.Agent {
	type candidate struct {
		agent *domain.Agent
		hp    float64
	}
	var candidates []candidate

	nearbyIDs := ws.spatialHash.QueryRadiusExclude(attacker.Position.X, attacker.Position.Y, rng+HitboxMaxRadius, attacker.ID)
	for _, targetID := range nearbyIDs {
		target, ok := agents[targetID]
		if !ok || !target.Alive || (!pvpEnabled && !target.IsBot) {
			continue
		}
		if IsSameNation(attacker, target) {
			continue
		}
		if IsInGracePeriod(target, currentTick) || isInvincible(target) {
			continue
		}
		dist := DistanceBetween(attacker.Position, target.Position)
		if dist > rng {
			continue
		}
		candidates = append(candidates, candidate{agent: target, hp: target.HP})
	}

	if len(candidates) == 0 {
		return nil
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].hp > candidates[j].hp
	})
	return candidates[0].agent
}

// ============================================================
// Status Effect Helpers
// ============================================================

func applyStatusEffect(target *domain.Agent, effectType domain.StatusEffectType, sourceID string, ticks int, dotPerTick, slowFrac float64) {
	target.StatusEffects = append(target.StatusEffects, domain.StatusEffect{
		Type:          effectType,
		SourceID:      sourceID,
		TicksLeft:     ticks,
		DamagePerTick: dotPerTick,
		SlowFraction:  slowFrac,
	})
}

func applyKnockback(target *domain.Agent, fromPos domain.Position, force float64) {
	dx := target.Position.X - fromPos.X
	dy := target.Position.Y - fromPos.Y
	dist := math.Sqrt(dx*dx + dy*dy)
	if dist < 1 {
		dist = 1
	}
	target.Position.X += (dx / dist) * force
	target.Position.Y += (dy / dist) * force
}

func isInvincible(a *domain.Agent) bool {
	return a.Invincible
}

func getMaxHP(a *domain.Agent) float64 {
	base := 100.0
	levelBonus := float64(a.Level-1) * 10.0
	vigorStacks := a.Build.Tomes[domain.TomeXP] // We'll use a dedicated check
	_ = vigorStacks
	return base + levelBonus
}

// pseudoRand returns a simple deterministic 0-1 value from an integer seed.
func pseudoRand(seed int) float64 {
	// Simple hash
	s := uint64(seed)*6364136223846793005 + 1442695040888963407
	return float64(s%10000) / 10000.0
}

// ProcessStatusEffects ticks all active status effects on agents.
func (ws *WeaponSystem) ProcessStatusEffects(agents map[string]*domain.Agent, currentTick uint64) []domain.WeaponDamageEvent {
	var dmgEvents []domain.WeaponDamageEvent

	for _, agent := range agents {
		if !agent.Alive || len(agent.StatusEffects) == 0 {
			continue
		}

		var active []domain.StatusEffect
		for _, se := range agent.StatusEffects {
			se.TicksLeft--
			if se.TicksLeft <= 0 {
				continue
			}

			// Apply DOT
			if se.DamagePerTick > 0 {
				agent.HP -= se.DamagePerTick
				if agent.HP < 0 {
					agent.HP = 0
				}
				dmgEvents = append(dmgEvents, domain.WeaponDamageEvent{
					AttackerID: se.SourceID, TargetID: agent.ID,
					Damage: se.DamagePerTick, IsDOT: true,
					TargetX: agent.Position.X, TargetY: agent.Position.Y,
				})
				if agent.HP <= 0 {
					AgentDie(agent)
				}
			}

			// Stun: prevent movement (checked in UpdateAgent)
			// Slow: applied in UpdateAgent movement calculation

			active = append(active, se)
		}
		agent.StatusEffects = active
	}
	return dmgEvents
}
