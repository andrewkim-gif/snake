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
	players    map[string]*ARPlayer
	enemies    []*AREnemy
	xpCrystals []*ARXPCrystal

	// Subsystems
	levelSystem *ARLevelSystem

	// Phase tracking
	phase      ARPhase
	phaseTimer float64 // seconds remaining in current phase
	totalTime  float64 // total elapsed seconds
	waveNumber int
	waveTimer  float64 // seconds until next wave

	// ID generation
	nextEnemyID int
}

// NewArenaCombat creates a new ArenaCombat instance.
func NewArenaCombat() *ArenaCombat {
	return &ArenaCombat{
		players:     make(map[string]*ARPlayer),
		enemies:     make([]*AREnemy, 0, 64),
		xpCrystals:  make([]*ARXPCrystal, 0, 128),
		levelSystem: NewARLevelSystem(),
		phase:       ARPhaseDeploy,
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
}

// OnTick implements CombatMode.OnTick.
// Called at 20Hz (delta ≈ 0.05s).
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
		ac.tickWaveSpawner(delta)
		ac.tickEnemyAI(delta)
		events = append(events, ac.tickAutoAttack(delta)...)
		events = append(events, ac.tickXPCollection()...)
		ac.cleanupDead()

	case ARPhasePvPWarning:
		ac.tickMovement(delta)
		ac.tickEnemyAI(delta)
		events = append(events, ac.tickAutoAttack(delta)...)
		events = append(events, ac.tickXPCollection()...)
		ac.cleanupDead()

	case ARPhasePvP:
		ac.tickMovement(delta)
		// PvP: players can damage each other (future phase)
		ac.cleanupDead()

	case ARPhaseSettlement:
		// Settlement: no gameplay, show results
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
		// Clear all PvE enemies for PvP phase
		ac.enemies = ac.enemies[:0]
		ac.xpCrystals = ac.xpCrystals[:0]
		events = append(events, CombatEvent{
			Type: "phase_change",
			Data: map[string]interface{}{"phase": "pvp"},
		})

	case ARPhasePvP:
		ac.phase = ARPhaseSettlement
		ac.phaseTimer = ARSettlementDuration
		events = append(events, CombatEvent{
			Type: "phase_change",
			Data: map[string]interface{}{"phase": "settlement"},
		})

	case ARPhaseSettlement:
		// Battle is over; Room handles cooldown transition
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
	count := int(math.Ceil(float64(baseCount) * tierMult))
	if count < 3 {
		count = 3
	}
	if count > 50 {
		count = 50
	}

	// Elite chance increases with wave number
	eliteChance := 0.05 + float64(ac.waveNumber)*0.02

	// Spawn enemies around the arena edges
	radius := ac.config.ArenaRadius
	if radius <= 0 {
		radius = ARDefaultArenaRadius
	}

	for i := 0; i < count; i++ {
		// Random position on arena edge
		angle := rand.Float64() * 2 * math.Pi
		spawnDist := radius * (0.7 + rand.Float64()*0.3)
		pos := ARVec3{
			X: math.Cos(angle) * spawnDist,
			Y: 0,
			Z: math.Sin(angle) * spawnDist,
		}

		// Random enemy type
		types := []AREnemyType{AREnemyZombie, AREnemySkeleton, AREnemySlime, AREnemySpider, AREnemyCreeper}
		enemyType := types[rand.Intn(len(types))]

		isElite := rand.Float64() < eliteChance

		ac.spawnEnemy(enemyType, pos, isElite)
	}
}

func (ac *ArenaCombat) spawnEnemy(t AREnemyType, pos ARVec3, isElite bool) {
	ac.nextEnemyID++
	hp, dmg, spd := ARBaseEnemyStats(t)

	// Scale with wave number
	waveMult := 1.0 + float64(ac.waveNumber)*0.3
	hp *= waveMult
	dmg *= 1.0 + float64(ac.waveNumber)*0.2

	if isElite {
		hp *= 3.0
		dmg *= 2.0
		spd *= 1.5
	}

	enemy := &AREnemy{
		ID:      fmt.Sprintf("e_%d", ac.nextEnemyID),
		Type:    t,
		Pos:     pos,
		HP:      hp,
		MaxHP:   hp,
		Damage:  dmg,
		Speed:   spd,
		Alive:   true,
		IsElite: isElite,
	}

	ac.enemies = append(ac.enemies, enemy)
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

// ============================================================
// Enemy AI
// ============================================================

func (ac *ArenaCombat) tickEnemyAI(delta float64) {
	for _, enemy := range ac.enemies {
		if !enemy.Alive {
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

		// Move toward target
		dx := nearest.Pos.X - enemy.Pos.X
		dz := nearest.Pos.Z - enemy.Pos.Z
		dist := math.Sqrt(dx*dx + dz*dz)
		if dist > 0.5 { // Don't overlap
			dx /= dist
			dz /= dist
			enemy.Pos.X += dx * enemy.Speed * delta
			enemy.Pos.Z += dz * enemy.Speed * delta
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

	// Dodge check
	if target.DodgeChance > 0 && rand.Float64()*100 < target.DodgeChance {
		return
	}

	// Deal damage (scaled by delta for frame-rate independence)
	damage := enemy.Damage * delta
	target.HP -= damage
	if target.HP <= 0 {
		target.HP = 0
		target.Alive = false
	}
}

// ============================================================
// Auto-Attack (Players → Enemies)
// ============================================================

func (ac *ArenaCombat) tickAutoAttack(delta float64) []CombatEvent {
	var events []CombatEvent

	for _, p := range ac.players {
		if !p.Alive {
			continue
		}

		// Find nearest enemy within attack range
		attackRange := ARBaseAttackRange * p.AreaMult
		var target *AREnemy
		targetDist := math.MaxFloat64

		for _, e := range ac.enemies {
			if !e.Alive {
				continue
			}
			d := p.Pos.DistTo(e.Pos)
			if d <= attackRange && d < targetDist {
				targetDist = d
				target = e
			}
		}

		if target == nil {
			continue
		}

		// Calculate damage
		baseDmg := ARBaseAttackDamage * p.DamageMult * p.AttackSpeedMult * delta

		// Critical hit
		critCount := calcCritCount(p.CritChance)
		critMult := calcCritMultiplier(critCount, p.CritDamageMult)
		finalDmg := baseDmg * critMult

		target.HP -= finalDmg
		if target.HP <= 0 {
			target.HP = 0
			target.Alive = false
			p.Kills++

			// Drop XP crystal
			xpValue := target.MaxHP * 0.1 // XP = 10% of enemy max HP
			if target.IsElite {
				xpValue *= 3.0
			}
			crystal := ac.levelSystem.SpawnXPCrystal(target.Pos, xpValue)
			ac.xpCrystals = append(ac.xpCrystals, crystal)

			events = append(events, CombatEvent{
				Type:     "enemy_kill",
				TargetID: p.ID,
				Data: map[string]interface{}{
					"enemyId": target.ID,
					"xp":      xpValue,
					"crit":    critCount,
				},
			})
		}

		if critCount > 0 {
			events = append(events, CombatEvent{
				Type:     "ar_damage",
				TargetID: p.ID,
				Data: map[string]interface{}{
					"target":    target.ID,
					"amount":    finalDmg,
					"critCount": critCount,
				},
			})
		}
	}

	return events
}

// calcCritCount determines how many crits occur (overcritical system).
func calcCritCount(critChance float64) int {
	guaranteed := int(critChance / 100.0)
	remainder := math.Mod(critChance, 100.0)
	extra := 0
	if rand.Float64()*100 < remainder {
		extra = 1
	}
	return guaranteed + extra
}

// calcCritMultiplier returns the damage multiplier for a given crit count.
func calcCritMultiplier(critCount int, baseCritMult float64) float64 {
	switch {
	case critCount <= 0:
		return 1.0
	case critCount == 1:
		return baseCritMult
	default:
		// Overcritical: (critCount * 0.5)^2 + critCount * (baseCritMult - 1)
		half := float64(critCount) * 0.5
		return half*half + float64(critCount)*(baseCritMult-1)
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
// Cleanup
// ============================================================

func (ac *ArenaCombat) cleanupDead() {
	// Remove dead enemies
	alive := ac.enemies[:0]
	for _, e := range ac.enemies {
		if e.Alive {
			alive = append(alive, e)
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
}

// ============================================================
// Player Lifecycle
// ============================================================

// OnPlayerJoin implements CombatMode.OnPlayerJoin.
func (ac *ArenaCombat) OnPlayerJoin(info *PlayerInfo) {
	// Spawn at random position near center
	angle := rand.Float64() * 2 * math.Pi
	spawnDist := 5.0 + rand.Float64()*10.0
	pos := ARVec3{
		X: math.Cos(angle) * spawnDist,
		Y: 0,
		Z: math.Sin(angle) * spawnDist,
	}

	player := &ARPlayer{
		ID:        info.ID,
		Name:      info.Name,
		Pos:       pos,
		HP:        ARBaseHP,
		MaxHP:     ARBaseHP,
		Level:     1,
		XP:        0,
		XPToNext:  XPToNextLevel(1),
		Alive:     true,
		Character: ARCharStriker, // default character
		Tomes:     make(map[ARTomeID]int),
		WeaponSlots: []string{"katana"}, // default weapon
		Stamina:    ARBaseStamina,
		MaxStamina: ARBaseStamina,
		GraceTicks: int(ARGracePeriodSec * TickRate),
	}

	// Initialize computed stats
	recomputePlayerStats(player)

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

	// Validate choice
	if choice.TomeID != "" {
		tomeID := ARTomeID(choice.TomeID)
		for _, offer := range p.LevelUpChoices {
			if offer.TomeID == tomeID {
				ApplyTome(p, tomeID, offer.Rarity)
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
			ID:      e.ID,
			Type:    e.Type,
			X:       e.Pos.X,
			Z:       e.Pos.Z,
			HP:      e.HP,
			MaxHP:   e.MaxHP,
			IsElite: e.IsElite,
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

	// Player list
	playerList := make([]*ARPlayer, 0, len(ac.players))
	for _, p := range ac.players {
		playerList = append(playerList, p)
	}

	return &ARState{
		Phase:      ac.phase,
		Timer:      ac.phaseTimer,
		WaveNumber: ac.waveNumber,
		Players:    playerList,
		Enemies:    enemyNet,
		XPCrystals: crystalNet,
	}
}

// Cleanup implements CombatMode.Cleanup.
func (ac *ArenaCombat) Cleanup() {
	ac.players = make(map[string]*ARPlayer)
	ac.enemies = ac.enemies[:0]
	ac.xpCrystals = ac.xpCrystals[:0]
}
