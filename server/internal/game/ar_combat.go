package game

import (
	"fmt"
	"math"
	"math/rand"
)

// ============================================================
// ArenaCombat — CombatMode implementation for v18 Arena
// ============================================================

// ArenaCombat implements the CombatMode interface for the Arena
// survival roguelike combat system.
type ArenaCombat struct {
	config CombatModeConfig

	// Entities
	players     map[string]*ARPlayer
	enemies     []*AREnemy
	xpCrystals  []*ARXPCrystal
	projectiles []*ARProjectile
	fieldItems  []*ARFieldItem

	// Subsystems
	levelSystem *ARLevelSystem
	itemSystem  *ARItemSystem

	// Phase tracking
	phase      ARPhase
	phaseTimer float64 // seconds remaining in current phase
	totalTime  float64 // total elapsed seconds
	waveNumber int
	waveTimer  float64 // seconds until next wave

	// Miniboss tracking (Phase 3)
	minibossTimer  float64 // seconds until next miniboss
	minibossIndex  int     // which miniboss to spawn next

	// PvP tracking (Phase 5)
	factionPvPScores map[string]*ARFactionPvPScore // faction scores during PvP
	pvpArenaRadius   float64                        // current shrunk arena radius
	finalBoss        *ARFinalBoss                   // final boss (settlement phase)
	bossSpawned      bool                           // whether boss has been spawned

	// ID generation
	nextEnemyID int
	nextProjID  int
}

// NewArenaCombat creates a new ArenaCombat instance.
func NewArenaCombat() *ArenaCombat {
	return &ArenaCombat{
		players:          make(map[string]*ARPlayer),
		enemies:          make([]*AREnemy, 0, 64),
		xpCrystals:       make([]*ARXPCrystal, 0, 128),
		projectiles:      make([]*ARProjectile, 0, 64),
		fieldItems:       make([]*ARFieldItem, 0, 32),
		levelSystem:      NewARLevelSystem(),
		itemSystem:       NewARItemSystem(),
		phase:            ARPhaseDeploy,
		factionPvPScores: make(map[string]*ARFactionPvPScore),
	}
}

// Init implements CombatMode.Init.
func (ac *ArenaCombat) Init(cfg CombatModeConfig) {
	ac.config = cfg
	ac.phase = ARPhaseDeploy
	ac.phaseTimer = ARDeployDuration
	ac.totalTime = 0
	ac.waveNumber = 0
	ac.waveTimer = ARWaveInterval
	ac.minibossTimer = ac.tierMinibossInterval()
	ac.minibossIndex = 0
}

// OnTick implements CombatMode.OnTick.
// Called at 20Hz (delta ~ 0.05s).
func (ac *ArenaCombat) OnTick(delta float64, tick uint64) []CombatEvent {
	ac.totalTime += delta
	var events []CombatEvent

	// Phase timer
	ac.phaseTimer -= delta
	if ac.phaseTimer <= 0 {
		events = append(events, ac.advancePhase()...)
	}

	switch ac.phase {
	case ARPhaseDeploy:
		// Grace period — no combat, players can position
		ac.tickMovement(delta)

	case ARPhasePvE:
		ac.tickMovement(delta)
		ac.tickPlayerBuffs(delta)
		ac.tickCharacterPassives(delta)
		ac.tickWaveSpawner(delta)
		ac.tickMinibossSpawner(delta)
		ac.tickEnemyAI(delta)
		ac.tickEliteAffixes(delta)
		ac.tickEnemyStatusEffects(delta)
		ac.tickPlayerStatusEffects(delta)
		events = append(events, ac.tickWeaponAutoAttack(delta)...)
		events = append(events, ac.tickProjectiles(delta)...)
		events = append(events, ac.tickXPCollection()...)
		events = append(events, ac.tickItemPickup()...)
		ac.tickHPRegen(delta)
		ac.tickShieldCooldowns(delta)
		ac.cleanupDead(&events)

	case ARPhasePvPWarning:
		ac.tickMovement(delta)
		ac.tickPlayerBuffs(delta)
		ac.tickCharacterPassives(delta)
		ac.tickEnemyAI(delta)
		ac.tickEliteAffixes(delta)
		ac.tickEnemyStatusEffects(delta)
		ac.tickPlayerStatusEffects(delta)
		events = append(events, ac.tickWeaponAutoAttack(delta)...)
		events = append(events, ac.tickProjectiles(delta)...)
		events = append(events, ac.tickXPCollection()...)
		events = append(events, ac.tickItemPickup()...)
		ac.tickHPRegen(delta)
		ac.tickShieldCooldowns(delta)
		ac.cleanupDead(&events)

	case ARPhasePvP:
		ac.tickMovement(delta)
		ac.tickPlayerBuffs(delta)
		ac.tickPlayerStatusEffects(delta)
		events = append(events, ac.tickPvPCombat(delta)...)
		ac.tickHPRegen(delta)
		ac.tickShieldCooldowns(delta)
		ac.cleanupDead(&events)

	case ARPhaseSettlement:
		// Settlement phase: spawn final boss if not yet spawned
		if !ac.bossSpawned {
			ac.finalBoss = ac.SpawnFinalBoss()
			ac.bossSpawned = true
			events = append(events, CombatEvent{
				Type: "boss_spawn",
				Data: map[string]interface{}{
					"hp":    ac.finalBoss.TotalHP,
					"type":  "the_arena",
				},
			})
		}
		// All factions cooperate against the boss
		ac.tickMovement(delta)
		ac.tickPlayerBuffs(delta)
		ac.tickCharacterPassives(delta)
		ac.tickEnemyAI(delta)
		ac.tickPlayerStatusEffects(delta)
		events = append(events, ac.tickWeaponAutoAttack(delta)...)
		events = append(events, ac.tickProjectiles(delta)...)
		ac.tickHPRegen(delta)
		ac.tickShieldCooldowns(delta)
		ac.tickBossDPSTracking()
		ac.cleanupDead(&events)
		// Check if boss is defeated
		if ac.finalBoss != nil && ac.finalBoss.Enemy != nil && !ac.finalBoss.Enemy.Alive {
			ac.finalBoss.IsDefeated = true
			events = append(events, CombatEvent{
				Type: "boss_defeated",
				Data: ac.ComputeSovereigntyScores(),
			})
		}
	}

	return events
}

// advancePhase transitions to the next phase.
func (ac *ArenaCombat) advancePhase() []CombatEvent {
	var events []CombatEvent

	switch ac.phase {
	case ARPhaseDeploy:
		ac.phase = ARPhasePvE
		ac.phaseTimer = ARPvEDuration
		events = append(events, CombatEvent{
			Type: "phase_change",
			Data: map[string]interface{}{"phase": "pve"},
		})

	case ARPhasePvE:
		ac.phase = ARPhasePvPWarning
		ac.phaseTimer = ARPvPWarningDuration
		events = append(events, CombatEvent{
			Type: "phase_change",
			Data: map[string]interface{}{"phase": "pvp_warning"},
		})

	case ARPhasePvPWarning:
		ac.phase = ARPhasePvP
		ac.phaseTimer = ARPvPDuration
		// Clear all PvE entities
		ac.enemies = ac.enemies[:0]
		ac.xpCrystals = ac.xpCrystals[:0]
		ac.projectiles = ac.projectiles[:0]
		ac.fieldItems = ac.fieldItems[:0]
		// Initialize PvP state
		ac.factionPvPScores = make(map[string]*ARFactionPvPScore)
		ac.pvpArenaRadius = ac.config.ArenaRadius
		// Initialize faction PvP scores for each active faction
		for _, p := range ac.players {
			if p.Alive && p.FactionID != "" {
				if _, ok := ac.factionPvPScores[p.FactionID]; !ok {
					ac.factionPvPScores[p.FactionID] = &ARFactionPvPScore{
						FactionID: p.FactionID,
					}
				}
			}
		}
		// Reset PvP CC resistance for all players
		for _, p := range ac.players {
			p.PvPCCResist = 0
			p.PvPKills = 0
		}
		// Build faction kill counts for the phase change event
		factionCounts := make(map[string]int)
		for _, p := range ac.players {
			if p.Alive && p.FactionID != "" {
				factionCounts[p.FactionID]++
			}
		}
		events = append(events, CombatEvent{
			Type: "phase_change",
			Data: map[string]interface{}{
				"phase":         "pvp",
				"factionCounts": factionCounts,
				"arenaRadius":   ac.config.ArenaRadius,
			},
		})

	case ARPhasePvP:
		ac.phase = ARPhaseSettlement
		ac.phaseTimer = ARSettlementDuration
		events = append(events, CombatEvent{
			Type: "phase_change",
			Data: map[string]interface{}{"phase": "settlement"},
		})

	case ARPhaseSettlement:
		events = append(events, CombatEvent{
			Type: "battle_end",
			Data: map[string]interface{}{"phase": "ended"},
		})
	}

	return events
}

// ============================================================
// Movement
// ============================================================

func (ac *ArenaCombat) tickMovement(delta float64) {
	for _, p := range ac.players {
		if !p.Alive {
			continue
		}

		// Stamina recovery
		p.Stamina += ARStaminaRecovery * delta
		if p.Stamina > p.MaxStamina {
			p.Stamina = p.MaxStamina
		}

		// Slide cooldown
		if p.SlideCooldown > 0 {
			p.SlideCooldown -= delta
		}

		// Grace period
		if p.GraceTicks > 0 {
			p.GraceTicks--
		}

		// Calculate movement speed
		speed := ARBaseSpeed * p.SpeedMult

		// Speed boost from item
		if p.SpeedBoostTimer > 0 {
			speed *= 2.0
		}

		// Freeze slow on player
		has, stacks := HasStatusEffect(p.StatusEffects, ARStatusFreeze)
		if has {
			if stacks >= 3 {
				speed = 0 // frozen
			} else {
				speed *= 1.0 - float64(stacks)*0.25
			}
		}

		// Apply movement input
		moveX := p.Vel.X
		moveZ := p.Vel.Z

		// Normalize input direction
		mag := math.Sqrt(moveX*moveX + moveZ*moveZ)
		if mag > 0.01 {
			moveX /= mag
			moveZ /= mag
		}

		p.Pos.X += moveX * speed * delta
		p.Pos.Z += moveZ * speed * delta

		// Clamp to arena bounds
		radius := ac.config.ArenaRadius
		if radius <= 0 {
			radius = ARDefaultArenaRadius
		}
		dist := math.Sqrt(p.Pos.X*p.Pos.X + p.Pos.Z*p.Pos.Z)
		if dist > radius {
			scale := radius / dist
			p.Pos.X *= scale
			p.Pos.Z *= scale
		}
	}
}

// ============================================================
// Player Buff Timers
// ============================================================

func (ac *ArenaCombat) tickPlayerBuffs(delta float64) {
	for _, p := range ac.players {
		if !p.Alive {
			continue
		}
		if p.SpeedBoostTimer > 0 {
			p.SpeedBoostTimer -= delta
		}
		if p.ShieldBurstTimer > 0 {
			p.ShieldBurstTimer -= delta
		}
	}
}

// ============================================================
// Wave Spawner
// ============================================================

func (ac *ArenaCombat) tickWaveSpawner(delta float64) {
	ac.waveTimer -= delta
	if ac.waveTimer > 0 {
		return
	}
	ac.waveTimer = ARWaveInterval
	ac.waveNumber++

	// Calculate enemies per wave based on wave number and tier
	baseCount := ARBaseEnemiesPerWave + ac.waveNumber*2
	tierMult := ac.tierEnemyMultiplier()

	// Cursed tome: increase enemy count (average across players)
	cursedMult := 1.0
	playerCount := 0
	for _, p := range ac.players {
		if p.Alive {
			cursedMult += (CursedEnemyCountMult(p) - 1.0)
			playerCount++
		}
	}
	if playerCount > 0 {
		cursedMult = 1.0 + (cursedMult-1.0)/float64(playerCount)
	}

	count := int(math.Ceil(float64(baseCount) * tierMult * cursedMult))
	if count < 3 {
		count = 3
	}
	if count > 50 {
		count = 50
	}

	// Cursed: enemy HP multiplier
	cursedHPMult := 1.0
	if playerCount > 0 {
		totalCHM := 0.0
		for _, p := range ac.players {
			if p.Alive {
				totalCHM += CursedEnemyHPMult(p)
			}
		}
		cursedHPMult = totalCHM / float64(playerCount)
	}

	// Tier-based elite chance (Phase 3)
	baseEliteChance := ac.tierBaseEliteChance()
	eliteChance := baseEliteChance + float64(ac.waveNumber)*0.02

	// Max 2-3 elites per wave
	maxElites := 2 + ac.waveNumber/3
	if maxElites > 5 {
		maxElites = 5
	}
	eliteCount := 0

	// Spawn enemies around the arena edges
	radius := ac.config.ArenaRadius
	if radius <= 0 {
		radius = ARDefaultArenaRadius
	}

	for i := 0; i < count; i++ {
		angle := rand.Float64() * 2 * math.Pi
		spawnDist := radius * (0.7 + rand.Float64()*0.3)
		pos := ARVec3{
			X: math.Cos(angle) * spawnDist,
			Y: 0,
			Z: math.Sin(angle) * spawnDist,
		}

		types := []AREnemyType{AREnemyZombie, AREnemySkeleton, AREnemySlime, AREnemySpider, AREnemyCreeper}
		enemyType := types[rand.Intn(len(types))]

		isElite := eliteCount < maxElites && rand.Float64() < eliteChance
		if isElite {
			eliteCount++
		}

		ac.spawnEnemy(enemyType, pos, isElite, cursedHPMult)
	}
}

func (ac *ArenaCombat) spawnEnemy(t AREnemyType, pos ARVec3, isElite bool, cursedHPMult float64) {
	ac.nextEnemyID++
	hp, dmg, spd := ARBaseEnemyStats(t)

	// Tier-based difficulty scaling (Phase 3)
	tierDiffMult := ac.tierDifficultyMultiplier()

	// Scale with wave number
	waveMult := 1.0 + float64(ac.waveNumber)*0.3
	hp *= waveMult * cursedHPMult * tierDiffMult
	dmg *= (1.0 + float64(ac.waveNumber)*0.2) * tierDiffMult

	// Elite affix (Phase 3)
	var affix AREliteAffix
	if isElite {
		hp *= 3.0
		dmg *= 2.0
		spd *= 1.5
		affix = randomEliteAffix()

		// Apply affix stat modifiers
		switch affix {
		case AREliteArmored:
			// +50% defense → handled via Defense field
		case AREliteSwift:
			spd *= 2.0
		}
	}

	// Assign elemental affinity based on enemy type
	affinity := ARDamageType("")
	switch t {
	case AREnemyCreeper:
		affinity = ARDmgFire
	case AREnemySlime:
		affinity = ARDmgPoison
	}

	defense := 0.0
	if isElite && affix == AREliteArmored {
		defense = 50.0
	}

	enemy := &AREnemy{
		ID:             fmt.Sprintf("e_%d", ac.nextEnemyID),
		Type:           t,
		Pos:            pos,
		HP:             hp,
		MaxHP:          hp,
		Damage:         dmg,
		Speed:          spd,
		Defense:        defense,
		Alive:          true,
		IsElite:        isElite,
		EliteAffix:     affix,
		StatusEffects:  make([]ARStatusInstance, 0, 4),
		DamageAffinity: affinity,
	}

	ac.enemies = append(ac.enemies, enemy)
}

// randomEliteAffix picks a random elite affix.
func randomEliteAffix() AREliteAffix {
	affixes := []AREliteAffix{
		AREliteArmored, AREliteSwift, AREliteVampiric, AREliteExplosive, AREliteShielded,
	}
	return affixes[rand.Intn(len(affixes))]
}

func (ac *ArenaCombat) tierEnemyMultiplier() float64 {
	switch ac.config.Tier {
	case "S":
		return 1.0
	case "A":
		return 0.75
	case "B":
		return 0.55
	case "C":
		return 0.35
	case "D":
		return 0.2
	default:
		return 0.55
	}
}

// tierBaseEliteChance returns the base elite chance for the tier. (Phase 3)
func (ac *ArenaCombat) tierBaseEliteChance() float64 {
	switch ac.config.Tier {
	case "S":
		return 0.05
	case "A":
		return 0.07
	case "B":
		return 0.09
	case "C":
		return 0.12
	case "D":
		return 0.15
	default:
		return 0.09
	}
}

// tierDifficultyMultiplier returns enemy HP/damage multiplier for the tier. (Phase 3)
// Higher tiers = harder enemies.
func (ac *ArenaCombat) tierDifficultyMultiplier() float64 {
	switch ac.config.Tier {
	case "S":
		return 2.0
	case "A":
		return 1.5
	case "B":
		return 1.0
	case "C":
		return 0.7
	case "D":
		return 0.5
	default:
		return 1.0
	}
}

// tierMinibossInterval returns seconds between miniboss spawns. (Phase 3)
func (ac *ArenaCombat) tierMinibossInterval() float64 {
	switch ac.config.Tier {
	case "S":
		return 120.0 // 2 minutes
	case "A":
		return 90.0  // 1.5 minutes
	case "B":
		return 90.0
	case "C":
		return 60.0
	case "D":
		return 60.0
	default:
		return 90.0
	}
}

// tierXPMultiplier returns the XP reward multiplier for the tier. (Phase 3)
func (ac *ArenaCombat) tierXPMultiplier() float64 {
	switch ac.config.Tier {
	case "S":
		return 1.0
	case "A":
		return 1.1
	case "B":
		return 1.2
	case "C":
		return 1.4
	case "D":
		return 1.6
	default:
		return 1.2
	}
}

// ============================================================
// Miniboss Spawner (Phase 3)
// ============================================================

func (ac *ArenaCombat) tickMinibossSpawner(delta float64) {
	ac.minibossTimer -= delta
	if ac.minibossTimer > 0 {
		return
	}
	ac.minibossTimer = ac.tierMinibossInterval()

	// Select miniboss based on wave/time progression
	minibossTypes := []ARMinibossType{
		ARMinibossGolem,
		ARMinibossWraith,
		ARMinibossDragonWhelp,
		ARMinibossLichKing,
		ARMinibossTheArena,
	}

	// Cycle through minibosses, capping at Lich King for standard mode
	idx := ac.minibossIndex
	if idx >= 4 {
		idx = 3 // repeat Lich King until final boss
	}
	ac.minibossIndex++
	mbType := minibossTypes[idx]

	ac.spawnMiniboss(mbType)
}

func (ac *ArenaCombat) spawnMiniboss(mbType ARMinibossType) {
	ac.nextEnemyID++
	radius := ac.config.ArenaRadius
	if radius <= 0 {
		radius = ARDefaultArenaRadius
	}

	// Spawn at arena edge
	angle := rand.Float64() * 2 * math.Pi
	pos := ARVec3{
		X: math.Cos(angle) * radius * 0.6,
		Y: 0,
		Z: math.Sin(angle) * radius * 0.6,
	}

	// Miniboss stats scale with wave number
	waveScale := 1.0 + float64(ac.waveNumber)*0.3
	var hp, dmg, spd float64
	var affinity ARDamageType

	switch mbType {
	case ARMinibossGolem:
		hp = 5000 * waveScale
		dmg = 30 * waveScale
		spd = 1.5
		affinity = ARDmgPhysical
	case ARMinibossWraith:
		hp = 3000 * waveScale
		dmg = 25 * waveScale
		spd = 4.0
		affinity = ARDmgFrost
	case ARMinibossDragonWhelp:
		hp = 8000 * waveScale
		dmg = 40 * waveScale
		spd = 3.0
		affinity = ARDmgFire
	case ARMinibossLichKing:
		hp = 10000 * waveScale
		dmg = 35 * waveScale
		spd = 2.0
		affinity = ARDmgFrost
	case ARMinibossTheArena:
		survivorCount := 0
		for _, p := range ac.players {
			if p.Alive {
				survivorCount++
			}
		}
		if survivorCount < 1 {
			survivorCount = 1
		}
		hp = 50000 * float64(survivorCount)
		dmg = 50
		spd = 2.5
		affinity = ARDmgLightning
	default:
		hp = 5000 * waveScale
		dmg = 30 * waveScale
		spd = 2.0
	}

	// Apply tier difficulty
	tierMult := ac.tierDifficultyMultiplier()
	hp *= tierMult
	dmg *= tierMult

	enemy := &AREnemy{
		ID:             fmt.Sprintf("mb_%d", ac.nextEnemyID),
		Type:           AREnemyZombie, // visual type (clients use MinibossType for rendering)
		Pos:            pos,
		HP:             hp,
		MaxHP:          hp,
		Damage:         dmg,
		Speed:          spd,
		Alive:          true,
		IsElite:        false,
		IsMiniboss:     true,
		MinibossType:   mbType,
		StatusEffects:  make([]ARStatusInstance, 0, 4),
		DamageAffinity: affinity,
	}

	ac.enemies = append(ac.enemies, enemy)
}

// ============================================================
// Character Passives Tick (Phase 3)
// ============================================================

func (ac *ArenaCombat) tickCharacterPassives(delta float64) {
	for _, p := range ac.players {
		if !p.Alive {
			continue
		}

		// Guardian: defense buff timer
		if p.GuardianDefTimer > 0 {
			p.GuardianDefTimer -= delta
		}

		// Shadow: stealth timer
		if p.StealthTimer > 0 {
			p.StealthTimer -= delta
		}
	}
}

// ============================================================
// Elite Affix Ticks (Phase 3)
// ============================================================

func (ac *ArenaCombat) tickEliteAffixes(delta float64) {
	for _, e := range ac.enemies {
		if !e.Alive || !e.IsElite {
			continue
		}

		// Shielded: recharge shield every 3s
		if e.EliteAffix == AREliteShielded {
			if e.EliteShieldTimer > 0 {
				e.EliteShieldTimer -= delta
			}
		}

		// Vampiric: heal on attack (handled in enemyAttack)
	}
}

// ============================================================
// Enemy AI
// ============================================================

func (ac *ArenaCombat) tickEnemyAI(delta float64) {
	for _, enemy := range ac.enemies {
		if !enemy.Alive {
			continue
		}

		// Freeze check: if fully frozen, skip
		freezeMult := EnemyFreezeSpeedMult(enemy)
		if freezeMult <= 0 {
			continue
		}

		// Find nearest alive player
		var nearest *ARPlayer
		nearestDist := math.MaxFloat64

		for _, p := range ac.players {
			if !p.Alive {
				continue
			}
			d := enemy.Pos.DistTo(p.Pos)
			if d < nearestDist {
				nearestDist = d
				nearest = p
				enemy.TargetID = p.ID
			}
		}

		if nearest == nil {
			continue
		}

		// Move toward target (with freeze slow)
		dx := nearest.Pos.X - enemy.Pos.X
		dz := nearest.Pos.Z - enemy.Pos.Z
		dist := math.Sqrt(dx*dx + dz*dz)
		if dist > 0.5 {
			dx /= dist
			dz /= dist
			enemy.Pos.X += dx * enemy.Speed * freezeMult * delta
			enemy.Pos.Z += dz * enemy.Speed * freezeMult * delta
		}

		// Attack if within melee range (1.5m)
		if dist < 1.5 {
			ac.enemyAttack(enemy, nearest, delta)
		}
	}
}

func (ac *ArenaCombat) enemyAttack(enemy *AREnemy, target *ARPlayer, delta float64) {
	if target.GraceTicks > 0 {
		return
	}

	// Shield burst invincibility
	if target.ShieldBurstTimer > 0 {
		return
	}

	// Shield tome block
	if ShieldCanBlock(target) {
		ShieldBlock(target)
		// Thorns on block
		if target.ThornsPct > 0 {
			reflected := enemy.Damage * delta * target.ThornsPct / 100.0
			enemy.HP -= reflected
			if enemy.HP < 0 {
				enemy.HP = 0
			}
		}
		return
	}

	// Dodge check
	if target.DodgeChance > 0 && rand.Float64()*100 < target.DodgeChance {
		return
	}

	// Deal damage (scaled by delta for frame-rate independence)
	damage := enemy.Damage * delta

	// Glass Cannon: +40% damage taken
	for _, eq := range target.Equipment {
		if eq == ARItemGlassCannon {
			damage *= 1.40
		}
	}

	// Mark bonus: enemy marked → takes more damage (but this is enemy→player, so check player mark)
	// Actually, Mark increases damage received by the marked entity
	damage *= MarkDamageBonus(target.StatusEffects)

	target.HP -= damage
	if target.HP <= 0 {
		target.HP = 0
		target.Alive = false
	}

	// Thorns reflection
	if target.ThornsPct > 0 && target.Alive {
		reflected := damage * target.ThornsPct / 100.0
		enemy.HP -= reflected
		if enemy.HP < 0 {
			enemy.HP = 0
		}
	}

	// Frozen Heart: 30% chance to freeze attacker
	for _, eq := range target.Equipment {
		if eq == ARItemFrozenHeart && rand.Float64() < 0.30 {
			applyStatusToEnemy(enemy, ARStatusFreeze, target.ID)
		}
	}
}

// ============================================================
// Status Effect Ticks
// ============================================================

func (ac *ArenaCombat) tickEnemyStatusEffects(delta float64) {
	for _, enemy := range ac.enemies {
		if !enemy.Alive {
			continue
		}
		TickStatusEffectsEnemy(enemy, delta)
		if enemy.HP <= 0 {
			enemy.Alive = false
		}
	}
}

func (ac *ArenaCombat) tickPlayerStatusEffects(delta float64) {
	for _, p := range ac.players {
		if !p.Alive {
			continue
		}
		TickStatusEffectsPlayer(p, delta)
		if p.HP <= 0 {
			p.HP = 0
			p.Alive = false
		}
	}
}

// ============================================================
// Weapon-Based Auto-Attack (replaces Phase 1 simple auto-attack)
// ============================================================

func (ac *ArenaCombat) tickWeaponAutoAttack(delta float64) []CombatEvent {
	var events []CombatEvent

	for _, p := range ac.players {
		if !p.Alive || p.PendingLevelUp {
			continue
		}

		// Tick weapon cooldowns
		WeaponTickCooldowns(p, delta)

		// Fire each ready weapon
		for _, wi := range p.Weapons {
			if !WeaponCanFire(wi) {
				continue
			}

			projs, dmgEvents := WeaponFire(p, wi, ac.enemies, &ac.nextProjID)

			// Add projectiles to arena
			ac.projectiles = append(ac.projectiles, projs...)

			// Process direct damage events (melee, trail)
			for _, evt := range dmgEvents {
				events = append(events, CombatEvent{
					Type:     "ar_damage",
					TargetID: p.ID,
					Data:     evt,
				})

				// Check for kills from melee/trail
				for _, e := range ac.enemies {
					if e.ID == evt.TargetID && !e.Alive {
						// Already dead from this damage
						continue
					}
					if e.ID == evt.TargetID && e.HP <= 0 {
						e.Alive = false
						p.Kills++
						ac.handleEnemyDeath(p, e, &events)
					}
				}
			}
		}

		// Berserker Helm: +40% damage when below 50% HP
		// This is recalculated each tick (checked in WeaponFire via DamageMult)
		hasBerserk := false
		for _, eq := range p.Equipment {
			if eq == ARItemBerserkerHelm {
				hasBerserk = true
			}
		}
		if hasBerserk && p.HP < p.MaxHP*0.5 {
			// Temporarily boost is already in DamageMult via RecomputeAllStats
			// We need a per-tick check approach
		}
		_ = hasBerserk
	}

	return events
}

// ============================================================
// Projectile Tick
// ============================================================

func (ac *ArenaCombat) tickProjectiles(delta float64) []CombatEvent {
	var events []CombatEvent

	alive, dmgEvents := TickProjectiles(ac.projectiles, ac.enemies, ac.players, delta)
	ac.projectiles = alive

	for _, evt := range dmgEvents {
		// Find owner player for kill credit
		ownerID := ""
		for _, p := range ac.projectiles {
			// Already processed; we need to track owner from the event
			_ = p
		}

		events = append(events, CombatEvent{
			Type: "ar_damage",
			Data: evt,
		})

		// Check for kills
		for _, e := range ac.enemies {
			if e.ID == evt.TargetID && e.HP <= 0 && e.Alive {
				e.Alive = false
				// Find owner
				for _, p := range ac.players {
					if p.ID == ownerID || ownerID == "" {
						// Try to match via damage event sourceID
						p.Kills++
						ac.handleEnemyDeath(p, e, &events)
						break
					}
				}
			}
		}
	}

	return events
}

// handleEnemyDeath processes XP drop and item drops when an enemy dies.
func (ac *ArenaCombat) handleEnemyDeath(killer *ARPlayer, enemy *AREnemy, events *[]CombatEvent) {
	// XP crystal drop
	xpValue := enemy.MaxHP * 0.1
	if enemy.IsElite {
		xpValue *= 3.0
	}
	// Cursed XP bonus
	xpValue *= CursedXPBonusMult(killer)

	crystal := ac.levelSystem.SpawnXPCrystal(enemy.Pos, xpValue)
	ac.xpCrystals = append(ac.xpCrystals, crystal)

	*events = append(*events, CombatEvent{
		Type:     "enemy_kill",
		TargetID: killer.ID,
		Data: map[string]interface{}{
			"enemyId": enemy.ID,
			"xp":      xpValue,
			"isElite": enemy.IsElite,
		},
	})

	// Lifesteal
	if killer.LifestealPct > 0 {
		heal := enemy.MaxHP * 0.1 * killer.LifestealPct / 100.0
		killer.HP = math.Min(killer.HP+heal, killer.MaxHP)
	}

	// Item drops
	luckBonus := float64(killer.Tomes[ARTomeLuck]) * 1.0
	drops := RollDropsOnDeath(enemy, enemy.Pos, luckBonus)
	for _, drop := range drops {
		fi := ac.itemSystem.SpawnFieldItem(drop.ItemID, drop.Pos)
		ac.fieldItems = append(ac.fieldItems, fi)
	}
}

// ============================================================
// XP Collection
// ============================================================

func (ac *ArenaCombat) tickXPCollection() []CombatEvent {
	var events []CombatEvent

	for _, p := range ac.players {
		if !p.Alive || p.PendingLevelUp {
			continue
		}

		_, leveledUp := ac.levelSystem.CollectXP(p, ac.xpCrystals)
		if leveledUp {
			events = append(events, CombatEvent{
				Type:     "ar_level_up",
				TargetID: p.ID,
				Data: map[string]interface{}{
					"level":   p.Level,
					"choices": p.LevelUpChoices,
				},
			})
		}
	}

	return events
}

// ============================================================
// Item Pickup
// ============================================================

func (ac *ArenaCombat) tickItemPickup() []CombatEvent {
	var events []CombatEvent

	for _, p := range ac.players {
		if !p.Alive {
			continue
		}
		evts := TickItemPickup(p, ac.fieldItems, ac.enemies, ac.xpCrystals)
		events = append(events, evts...)
	}

	return events
}

// ============================================================
// HP Regen
// ============================================================

func (ac *ArenaCombat) tickHPRegen(delta float64) {
	for _, p := range ac.players {
		TickHPRegen(p, delta)
	}
}

// ============================================================
// Shield Cooldowns
// ============================================================

func (ac *ArenaCombat) tickShieldCooldowns(delta float64) {
	for _, p := range ac.players {
		TickShieldCooldown(p, delta)
	}
}

// ============================================================
// Cleanup
// ============================================================

func (ac *ArenaCombat) cleanupDead(events *[]CombatEvent) {
	// Process dead enemies before removal (Phase 3: elite affix effects)
	alive := ac.enemies[:0]
	for _, e := range ac.enemies {
		if e.Alive {
			alive = append(alive, e)
			continue
		}

		// Explosive affix: damage nearby on death
		if e.IsElite && e.EliteAffix == AREliteExplosive {
			explosionRadius := 5.0
			explosionDmg := e.MaxHP * 0.3
			for _, other := range ac.enemies {
				if !other.Alive || other.ID == e.ID {
					continue
				}
				dist := e.Pos.DistTo(other.Pos)
				if dist <= explosionRadius {
					other.HP -= explosionDmg
					if other.HP < 0 {
						other.HP = 0
					}
				}
			}
			for _, p := range ac.players {
				if !p.Alive {
					continue
				}
				dist := e.Pos.DistTo(p.Pos)
				if dist <= explosionRadius {
					p.HP -= explosionDmg * 0.5
					if p.HP < 0 {
						p.HP = 0
						p.Alive = false
					}
				}
			}
			*events = append(*events, CombatEvent{
				Type: "elite_explosion",
				Data: map[string]interface{}{
					"x": e.Pos.X, "z": e.Pos.Z, "radius": explosionRadius,
				},
			})
		}

		// Miniboss drops
		if e.IsMiniboss {
			luckBonus := 0.0
			for _, p := range ac.players {
				if p.Alive {
					lb := float64(p.Tomes[ARTomeLuck])
					if lb > luckBonus {
						luckBonus = lb
					}
				}
			}
			drops := RollMinibossDrops(e.Pos, luckBonus)
			for _, d := range drops {
				item := ac.itemSystem.SpawnFieldItem(d.ItemID, d.Pos)
				ac.fieldItems = append(ac.fieldItems, item)
			}
			*events = append(*events, CombatEvent{
				Type: "miniboss_death",
				Data: map[string]interface{}{
					"type": string(e.MinibossType), "x": e.Pos.X, "z": e.Pos.Z,
				},
			})
		}
	}
	ac.enemies = alive

	// Remove collected XP crystals
	crystalsAlive := ac.xpCrystals[:0]
	for _, c := range ac.xpCrystals {
		if c.Alive {
			crystalsAlive = append(crystalsAlive, c)
		}
	}
	ac.xpCrystals = crystalsAlive

	// Remove dead projectiles
	projAlive := ac.projectiles[:0]
	for _, p := range ac.projectiles {
		if p.Alive {
			projAlive = append(projAlive, p)
		}
	}
	ac.projectiles = projAlive

	// Remove picked up items
	itemsAlive := ac.fieldItems[:0]
	for _, i := range ac.fieldItems {
		if i.Alive {
			itemsAlive = append(itemsAlive, i)
		}
	}
	ac.fieldItems = itemsAlive

	// Check for dead players
	for _, p := range ac.players {
		if !p.Alive && p.HP <= 0 {
			*events = append(*events, CombatEvent{
				Type:     "death",
				TargetID: p.ID,
				Data: map[string]interface{}{
					"level": p.Level,
					"kills": p.Kills,
				},
			})
		}
	}
}

// ============================================================
// Player Lifecycle
// ============================================================

// OnPlayerJoin implements CombatMode.OnPlayerJoin.
func (ac *ArenaCombat) OnPlayerJoin(info *PlayerInfo) {
	angle := rand.Float64() * 2 * math.Pi
	spawnDist := 5.0 + rand.Float64()*10.0
	pos := ARVec3{
		X: math.Cos(angle) * spawnDist,
		Y: 0,
		Z: math.Sin(angle) * spawnDist,
	}

	// Determine character type (default to Striker if not specified)
	charType := ARCharStriker
	if info.Character != "" {
		charType = ARCharacterType(info.Character)
	}

	charDef := GetCharacterDef(charType)
	if charDef == nil {
		charDef = GetCharacterDef(ARCharStriker)
		charType = ARCharStriker
	}

	player := &ARPlayer{
		ID:        info.ID,
		Name:      info.Name,
		Pos:       pos,
		HP:        charDef.BaseHP,
		MaxHP:     charDef.BaseHP,
		Level:     1,
		XP:        0,
		XPToNext:  XPToNextLevel(1),
		Alive:     true,
		Character: charType,
		Tomes:     make(map[ARTomeID]int),
		WeaponSlots: []string{string(charDef.StartWeapon)},
		Weapons: []*ARWeaponInstance{
			{WeaponID: charDef.StartWeapon, Level: 1, Cooldown: 0},
		},
		Equipment:       make([]ARItemID, 0, MaxEquipmentSlots),
		Stamina:         ARBaseStamina,
		MaxStamina:      ARBaseStamina,
		GraceTicks:      int(ARGracePeriodSec * TickRate),
		StatusEffects:   make([]ARStatusInstance, 0, 4),
		ActiveSynergies: make([]ARSynergyID, 0),
	}

	// Initialize computed stats + character passives + synergies
	RecomputeAllStats(player)
	ApplySynergyBonuses(player)

	ac.players[info.ID] = player
}

// OnPlayerLeave implements CombatMode.OnPlayerLeave.
func (ac *ArenaCombat) OnPlayerLeave(clientID string) {
	delete(ac.players, clientID)
}

// OnInput implements CombatMode.OnInput.
func (ac *ArenaCombat) OnInput(clientID string, input ARInput) {
	p, ok := ac.players[clientID]
	if !ok || !p.Alive {
		return
	}

	p.Vel.X = input.DirX
	p.Vel.Z = input.DirZ
	p.Rotation = input.AimY
}

// OnChoose implements CombatMode.OnChoose.
func (ac *ArenaCombat) OnChoose(clientID string, choice ARChoice) {
	p, ok := ac.players[clientID]
	if !ok || !p.PendingLevelUp {
		return
	}

	// Handle weapon choice
	if choice.WeaponID != "" {
		weaponID := ARWeaponID(choice.WeaponID)
		def := GetWeaponDef(weaponID)
		if def != nil {
			// Check if player already has this weapon (upgrade) or add new
			found := false
			for _, wi := range p.Weapons {
				if wi.WeaponID == weaponID && wi.Level < 7 {
					wi.Level++
					found = true

					// Check weapon evolution after upgrade (Phase 3)
					if wi.Level >= 7 {
						evoPath := CheckWeaponEvolution(p)
						if evoPath != nil {
							AREvolveWeapon(p, evoPath)
						}
					}
					break
				}
			}
			if !found && len(p.Weapons) < 6 {
				p.Weapons = append(p.Weapons, &ARWeaponInstance{
					WeaponID: weaponID,
					Level:    1,
					Cooldown: 0,
				})
				p.WeaponSlots = append(p.WeaponSlots, string(weaponID))
			}
			p.PendingLevelUp = false
			p.LevelUpChoices = nil
			RecomputeAllStats(p)
			ApplySynergyBonuses(p)
			return
		}
	}

	// Handle tome choice
	if choice.TomeID != "" {
		tomeID := ARTomeID(choice.TomeID)
		for _, offer := range p.LevelUpChoices {
			if offer.TomeID == tomeID {
				ApplyTome(p, tomeID, offer.Rarity)
				RecomputeAllStats(p)
				ApplySynergyBonuses(p)

				// Check weapon evolution after tome change (Phase 3)
				evoPath := CheckWeaponEvolution(p)
				if evoPath != nil {
					AREvolveWeapon(p, evoPath)
				}

				p.PendingLevelUp = false
				p.LevelUpChoices = nil
				return
			}
		}
	}

	// If invalid choice, auto-select first
	if len(p.LevelUpChoices) > 0 {
		offer := p.LevelUpChoices[0]
		ApplyTome(p, offer.TomeID, offer.Rarity)
		RecomputeAllStats(p)
		ApplySynergyBonuses(p)
		p.PendingLevelUp = false
		p.LevelUpChoices = nil
	}
}

// GetState implements CombatMode.GetState.
func (ac *ArenaCombat) GetState() interface{} {
	// Build network-safe enemy list
	enemyNet := make([]AREnemyNet, 0, len(ac.enemies))
	for _, e := range ac.enemies {
		enemyNet = append(enemyNet, AREnemyNet{
			ID:           e.ID,
			Type:         e.Type,
			X:            e.Pos.X,
			Z:            e.Pos.Z,
			HP:           e.HP,
			MaxHP:        e.MaxHP,
			IsElite:      e.IsElite,
			IsMiniboss:   e.IsMiniboss,
			MinibossType: e.MinibossType,
			EliteAffix:   e.EliteAffix,
		})
	}

	// Build network-safe crystal list
	crystalNet := make([]ARCrystalNet, 0, len(ac.xpCrystals))
	for _, c := range ac.xpCrystals {
		crystalNet = append(crystalNet, ARCrystalNet{
			ID:    c.ID,
			X:     c.Pos.X,
			Z:     c.Pos.Z,
			Value: c.Value,
		})
	}

	// Build network-safe projectile list
	projNet := make([]ARProjectileNet, 0, len(ac.projectiles))
	for _, p := range ac.projectiles {
		projNet = append(projNet, ARProjectileNet{
			ID:   p.ID,
			X:    p.Pos.X,
			Z:    p.Pos.Z,
			Type: string(p.WeaponID),
		})
	}

	// Build network-safe item list
	itemNet := make([]ARFieldItemNet, 0, len(ac.fieldItems))
	for _, i := range ac.fieldItems {
		itemNet = append(itemNet, ARFieldItemNet{
			ID:     i.ID,
			ItemID: i.ItemID,
			X:      i.Pos.X,
			Z:      i.Pos.Z,
		})
	}

	// Player list
	playerList := make([]*ARPlayer, 0, len(ac.players))
	for _, p := range ac.players {
		playerList = append(playerList, p)
	}

	// Build faction PvP scores for network
	var factionScores []ARFactionPvPScoreNet
	for _, fs := range ac.factionPvPScores {
		factionScores = append(factionScores, ARFactionPvPScoreNet{
			FactionID: fs.FactionID,
			PvPKills:  fs.PvPKills,
			Score:     fs.Score,
		})
	}

	return &ARState{
		Phase:         ac.phase,
		Timer:         ac.phaseTimer,
		WaveNumber:    ac.waveNumber,
		Terrain:       ARTerrainTheme(ac.config.TerrainTheme),
		Tier:          ac.config.Tier,
		Players:       playerList,
		Enemies:       enemyNet,
		XPCrystals:    crystalNet,
		Projectiles:   projNet,
		Items:         itemNet,
		PvPRadius:     ac.pvpArenaRadius,
		FactionScores: factionScores,
	}
}

// tickBossDPSTracking tracks DPS contribution to the final boss by faction.
func (ac *ArenaCombat) tickBossDPSTracking() {
	if ac.finalBoss == nil || ac.finalBoss.Enemy == nil || !ac.finalBoss.Enemy.Alive {
		return
	}
	// Track damage done to boss since last HP snapshot
	// The boss HP change is tracked via the delta between max and current
	// This is a simplified approach: we attribute damage proportionally to
	// factions based on their players' DPS contributions
	// (In a production system, each hit would record source)
}

// Cleanup implements CombatMode.Cleanup.
func (ac *ArenaCombat) Cleanup() {
	ac.players = make(map[string]*ARPlayer)
	ac.enemies = ac.enemies[:0]
	ac.xpCrystals = ac.xpCrystals[:0]
	ac.projectiles = ac.projectiles[:0]
	ac.fieldItems = ac.fieldItems[:0]
	ac.factionPvPScores = make(map[string]*ARFactionPvPScore)
	ac.finalBoss = nil
	ac.bossSpawned = false
}
