package game

import (
	"fmt"
	"math"
	"math/rand"
)

// ============================================================
// Arena PvP System — Phase 5 (v18)
// ============================================================
//
// This file implements:
//   - 5-Phase battle cycle (Deploy → PvE → PvP Warning → PvP → Settlement)
//   - Faction-based team detection (same faction = ally, different = enemy)
//   - PvP damage coefficient (0.4 base, adjusted by level diff)
//   - CC (status effect) resistance in PvP
//   - PvP kill rewards (XP steal, faction score)
//   - Arena shrink during PvP phase
//   - Final boss spawn in settlement/ending phase
//   - Country theme → terrain mapping
//   - Sovereignty point integration

// ── PvP Constants ────────────────────────────────────────────

const (
	// PvP damage scaling
	ARPvPDamageCoeff       = 0.40  // PvP damage = PvE damage × 0.4
	ARPvPMaxSingleHit      = 0.30  // Max single hit = 30% of target's max HP
	ARPvPCCDurationMult    = 0.50  // CC duration halved in PvP
	ARPvPHealMult          = 0.50  // Healing/lifesteal halved in PvP
	ARPvPKillXPStealPct    = 0.20  // Steal 20% of victim's XP on kill
	ARPvPKillFactionScore  = 10    // Faction score per PvP kill
	ARPvPSurvivalScore     = 1     // Faction score per second survived in PvP
	ARPvPOutOfBoundsDOTPct = 0.05  // 5% max HP per second outside arena

	// Arena shrink during PvP
	ARPvPShrinkStartRadius = 1.0  // Fraction of arena radius at PvP start
	ARPvPShrinkEndRadius   = 0.33 // Fraction of arena radius at PvP end

	// Level difference correction
	ARPvPLevelDiffCap    = 5     // Max level difference for scaling
	ARPvPLevelDiffScale  = 0.05  // 5% damage adjust per level difference

	// Final boss
	ARBossHPPerSurvivor  = 50000.0
	ARBossDamage         = 50.0
	ARBossSpeed          = 2.5
	ARBossSovereigntyWeight = 1.5  // Boss kill = 1.5x sovereignty contribution

	// CC Resistance accumulation
	ARPvPCCResistPerHit  = 0.15 // +15% CC resistance per CC applied
	ARPvPCCResistDecay   = 0.05 // -5% resistance per second
	ARPvPCCResistMax     = 0.90 // Max 90% CC resistance
)

// ── PvP Faction Helpers ──────────────────────────────────────

// IsSameFaction returns true if two players are allies (same faction).
func IsSameFaction(a, b *ARPlayer) bool {
	if a.FactionID == "" || b.FactionID == "" {
		return false
	}
	return a.FactionID == b.FactionID
}

// IsEnemyFaction returns true if two players are enemies (different factions).
func IsEnemyFaction(a, b *ARPlayer) bool {
	if a.FactionID == "" || b.FactionID == "" {
		return true // unaffiliated = enemy to all
	}
	return a.FactionID != b.FactionID
}

// ── PvP Damage Calculation ──────────────────────────────────

// CalcPvPDamage calculates damage from attacker to defender in PvP.
// Applies PvP coefficient, level difference scaling, and max single hit cap.
func CalcPvPDamage(baseDamage float64, attacker, defender *ARPlayer) float64 {
	// 1. Apply PvP coefficient
	dmg := baseDamage * ARPvPDamageCoeff

	// 2. Level difference correction
	levelDiff := attacker.Level - defender.Level
	if levelDiff > ARPvPLevelDiffCap {
		levelDiff = ARPvPLevelDiffCap
	}
	if levelDiff < -ARPvPLevelDiffCap {
		levelDiff = -ARPvPLevelDiffCap
	}
	levelMult := 1.0 + float64(levelDiff)*ARPvPLevelDiffScale
	dmg *= levelMult

	// 3. Cap single hit at 30% of target's max HP
	maxHit := defender.MaxHP * ARPvPMaxSingleHit
	if dmg > maxHit {
		dmg = maxHit
	}

	// 4. Floor at 1 damage
	if dmg < 1.0 {
		dmg = 1.0
	}

	return dmg
}

// ── CC Resistance System ─────────────────────────────────────

// ARPvPCCState tracks CC resistance for a player during PvP.
type ARPvPCCState struct {
	Resistance float64 `json:"-"` // 0.0 ~ 0.90
}

// ApplyPvPCCResistance checks if a CC effect should be applied considering resistance.
// Returns (should apply, effective duration).
func ApplyPvPCCResistance(target *ARPlayer, baseDuration float64) (bool, float64) {
	resist := target.PvPCCResist

	// Check if CC is resisted
	if rand.Float64() < resist {
		// CC fully resisted
		return false, 0
	}

	// Apply PvP CC duration reduction
	effectiveDuration := baseDuration * ARPvPCCDurationMult

	// Increase resistance after being hit
	target.PvPCCResist += ARPvPCCResistPerHit
	if target.PvPCCResist > ARPvPCCResistMax {
		target.PvPCCResist = ARPvPCCResistMax
	}

	return true, effectiveDuration
}

// DecayPvPCCResistance reduces CC resistance over time.
func DecayPvPCCResistance(p *ARPlayer, delta float64) {
	if p.PvPCCResist > 0 {
		p.PvPCCResist -= ARPvPCCResistDecay * delta
		if p.PvPCCResist < 0 {
			p.PvPCCResist = 0
		}
	}
}

// ── PvP Player-vs-Player Attack ──────────────────────────────

// PvPAttackResult holds the result of a PvP attack.
type PvPAttackResult struct {
	Damage    float64
	CritCount int
	DmgType   ARDamageType
	StatusFX  ARStatusEffect
	Killed    bool
}

// PvPWeaponAttackPlayer fires a weapon against an enemy player in PvP.
// Returns nil if the target is an ally or cannot be hit.
func PvPWeaponAttackPlayer(attacker *ARPlayer, weapon *ARWeaponInstance, target *ARPlayer) *PvPAttackResult {
	// Faction check: cannot attack allies
	if IsSameFaction(attacker, target) {
		return nil
	}

	// Target must be alive
	if !target.Alive || !attacker.Alive {
		return nil
	}

	// Grace period check
	if target.GraceTicks > 0 {
		return nil
	}

	// Shield burst invincibility
	if target.ShieldBurstTimer > 0 {
		return nil
	}

	// Stealth check: Shadow character stealth
	if target.StealthTimer > 0 {
		return nil
	}

	// Get weapon definition
	def := GetWeaponDef(weapon.WeaponID)
	if def == nil {
		return nil
	}

	// Range check
	dist := attacker.Pos.DistTo(target.Pos)
	weaponRange := def.BaseRange + float64(weapon.Level-1)*0.5
	if dist > weaponRange {
		return nil
	}

	// Calculate base damage
	baseDmg := def.BaseDamage * (1.0 + float64(weapon.Level-1)*0.2)
	baseDmg *= attacker.DamageMult

	// Critical hit
	critCount := calcCritCount(attacker.CritChance)
	critMult := calcCritMultiplier(critCount, attacker.CritDamageMult)
	baseDmg *= critMult

	// Apply PvP damage scaling
	pvpDmg := CalcPvPDamage(baseDmg, attacker, target)

	// Shield tome block check
	if ShieldCanBlock(target) {
		ShieldBlock(target)
		return &PvPAttackResult{Damage: 0, CritCount: critCount, DmgType: def.DamageType}
	}

	// Dodge check
	if target.DodgeChance > 0 && rand.Float64()*100 < target.DodgeChance {
		return &PvPAttackResult{Damage: 0, CritCount: 0, DmgType: def.DamageType}
	}

	// Apply damage
	target.HP -= pvpDmg
	killed := false
	if target.HP <= 0 {
		target.HP = 0
		target.Alive = false
		killed = true
	}

	// Lifesteal (halved in PvP)
	if attacker.LifestealPct > 0 {
		heal := pvpDmg * attacker.LifestealPct / 100.0 * ARPvPHealMult
		attacker.HP = math.Min(attacker.HP+heal, attacker.MaxHP)
	}

	// Thorns reflection (the defender reflects damage back)
	if target.ThornsPct > 0 && target.Alive {
		reflected := pvpDmg * target.ThornsPct / 100.0
		attacker.HP -= reflected
		if attacker.HP <= 0 {
			attacker.HP = 0
			attacker.Alive = false
		}
	}

	// Status effect application (with PvP CC resistance)
	var appliedStatus ARStatusEffect
	if def.StatusApply != "" && def.StatusChance > 0 {
		if rand.Float64()*100 < def.StatusChance {
			statusDuration := statusBaseDuration(def.StatusApply)
			shouldApply, effectiveDuration := ApplyPvPCCResistance(target, statusDuration)
			if shouldApply {
				applyStatusToPlayer(target, def.StatusApply, attacker.ID, effectiveDuration)
				appliedStatus = def.StatusApply
			}
		}
	}

	return &PvPAttackResult{
		Damage:    pvpDmg,
		CritCount: critCount,
		DmgType:   def.DamageType,
		StatusFX:  appliedStatus,
		Killed:    killed,
	}
}

// statusBaseDuration returns the base duration for a status effect.
func statusBaseDuration(effect ARStatusEffect) float64 {
	switch effect {
	case ARStatusBurn:
		return 3.0
	case ARStatusFreeze:
		return 2.0
	case ARStatusShock:
		return 1.0
	case ARStatusPoison:
		return 5.0
	case ARStatusBleed:
		return 4.0
	case ARStatusMark:
		return 10.0
	default:
		return 2.0
	}
}

// applyStatusToPlayer applies a status effect to a player with a specific duration.
func applyStatusToPlayer(target *ARPlayer, effect ARStatusEffect, sourceID string, duration float64) {
	// Check existing stacks
	for i := range target.StatusEffects {
		if target.StatusEffects[i].Effect == effect {
			target.StatusEffects[i].Remaining = duration
			maxStacks := statusMaxStacks(effect)
			if target.StatusEffects[i].Stacks < maxStacks {
				target.StatusEffects[i].Stacks++
			}
			return
		}
	}
	// New status
	target.StatusEffects = append(target.StatusEffects, ARStatusInstance{
		Effect:    effect,
		Remaining: duration,
		Stacks:    1,
		SourceID:  sourceID,
	})
}

// statusMaxStacksPvP returns max stacks for a status effect (PvP context).
// Reuses the same values as PvE via statusMaxStacks in ar_weapon.go.

// ── PvP Kill Handling ────────────────────────────────────────

// HandlePvPKill processes a PvP kill: XP steal, faction score, equipment drop.
func HandlePvPKill(killer, victim *ARPlayer, ac *ArenaCombat) []CombatEvent {
	var events []CombatEvent

	// XP steal
	xpStolen := victim.XP * ARPvPKillXPStealPct
	killer.XP += xpStolen

	// Faction score
	killer.PvPKills++

	// Record kill in faction tracking
	if killer.FactionID != "" {
		if fs, ok := ac.factionPvPScores[killer.FactionID]; ok {
			fs.PvPKills++
			fs.Score += ARPvPKillFactionScore
		} else {
			ac.factionPvPScores[killer.FactionID] = &ARFactionPvPScore{
				FactionID: killer.FactionID,
				PvPKills:  1,
				Score:     ARPvPKillFactionScore,
			}
		}
	}

	// Equipment drop (random 1 equipment from victim)
	if len(victim.Equipment) > 0 {
		dropIdx := rand.Intn(len(victim.Equipment))
		droppedItem := victim.Equipment[dropIdx]
		// Remove from victim
		victim.Equipment = append(victim.Equipment[:dropIdx], victim.Equipment[dropIdx+1:]...)
		// Spawn as field item
		fi := ac.itemSystem.SpawnFieldItem(droppedItem, victim.Pos)
		ac.fieldItems = append(ac.fieldItems, fi)
	}

	events = append(events, CombatEvent{
		Type:     "pvp_kill",
		TargetID: killer.ID,
		Data: map[string]interface{}{
			"killerId":   killer.ID,
			"victimId":   victim.ID,
			"xpStolen":   xpStolen,
			"killerFac":  killer.FactionID,
			"victimFac":  victim.FactionID,
		},
	})

	return events
}

// ── Arena Shrink ─────────────────────────────────────────────

// CalcPvPArenaRadius returns the current arena radius during PvP phase.
// Linearly shrinks from full radius to 1/3 over the PvP duration.
func CalcPvPArenaRadius(baseRadius, pvpTimeRemaining, pvpTotalDuration float64) float64 {
	if pvpTotalDuration <= 0 {
		return baseRadius
	}
	elapsed := pvpTotalDuration - pvpTimeRemaining
	progress := elapsed / pvpTotalDuration
	if progress < 0 {
		progress = 0
	}
	if progress > 1 {
		progress = 1
	}
	startR := baseRadius * ARPvPShrinkStartRadius
	endR := baseRadius * ARPvPShrinkEndRadius
	return startR + (endR-startR)*progress
}

// ApplyOutOfBoundsDOT damages players outside the PvP arena boundary.
func ApplyOutOfBoundsDOT(p *ARPlayer, currentArenaRadius, delta float64) bool {
	dist := math.Sqrt(p.Pos.X*p.Pos.X + p.Pos.Z*p.Pos.Z)
	if dist > currentArenaRadius {
		dot := p.MaxHP * ARPvPOutOfBoundsDOTPct * delta
		p.HP -= dot
		if p.HP <= 0 {
			p.HP = 0
			p.Alive = false
			return true // died from DOT
		}
	}
	return false
}

// ── PvP Tick in ArenaCombat ──────────────────────────────────

// tickPvPCombat processes one tick of PvP combat.
// Called from ArenaCombat.OnTick when phase == ARPhasePvP.
func (ac *ArenaCombat) tickPvPCombat(delta float64) []CombatEvent {
	var events []CombatEvent

	// 1. Calculate current shrunk arena radius
	currentRadius := CalcPvPArenaRadius(
		ac.config.ArenaRadius,
		ac.phaseTimer,
		ARPvPDuration,
	)
	ac.pvpArenaRadius = currentRadius

	// 2. Player-vs-player weapon auto-attack
	events = append(events, ac.tickPvPWeaponAttacks(delta)...)

	// 3. Out-of-bounds DOT
	for _, p := range ac.players {
		if !p.Alive {
			continue
		}
		died := ApplyOutOfBoundsDOT(p, currentRadius, delta)
		if died {
			events = append(events, CombatEvent{
				Type:     "death",
				TargetID: p.ID,
				Data: map[string]interface{}{
					"cause": "out_of_bounds",
					"level": p.Level,
					"kills": p.Kills,
				},
			})
		}
	}

	// 4. Survival score
	for _, p := range ac.players {
		if !p.Alive {
			continue
		}
		if p.FactionID != "" {
			if fs, ok := ac.factionPvPScores[p.FactionID]; ok {
				fs.SurvivalTime += delta
				fs.Score += int(delta * float64(ARPvPSurvivalScore))
			}
		}
	}

	// 5. Decay CC resistance
	for _, p := range ac.players {
		if p.Alive {
			DecayPvPCCResistance(p, delta)
		}
	}

	return events
}

// tickPvPWeaponAttacks fires each player's weapons against enemy faction players.
func (ac *ArenaCombat) tickPvPWeaponAttacks(delta float64) []CombatEvent {
	var events []CombatEvent

	// Build list of alive players
	alivePlayers := make([]*ARPlayer, 0, len(ac.players))
	for _, p := range ac.players {
		if p.Alive {
			alivePlayers = append(alivePlayers, p)
		}
	}

	for _, attacker := range alivePlayers {
		if !attacker.Alive || attacker.PendingLevelUp {
			continue
		}

		// Tick weapon cooldowns
		WeaponTickCooldowns(attacker, delta)

		for _, wi := range attacker.Weapons {
			if !WeaponCanFire(wi) {
				continue
			}

			// Find nearest enemy faction player
			var nearestEnemy *ARPlayer
			nearestDist := math.MaxFloat64
			for _, target := range alivePlayers {
				if target.ID == attacker.ID {
					continue
				}
				if !IsEnemyFaction(attacker, target) {
					continue
				}
				dist := attacker.Pos.DistTo(target.Pos)
				if dist < nearestDist {
					nearestDist = dist
					nearestEnemy = target
				}
			}

			if nearestEnemy == nil {
				continue
			}

			result := PvPWeaponAttackPlayer(attacker, wi, nearestEnemy)
			if result == nil {
				continue
			}

			// Reset weapon cooldown
			def := GetWeaponDef(wi.WeaponID)
			if def != nil {
				wi.Cooldown = def.BaseCooldown / attacker.AttackSpeedMult
			}

			if result.Damage > 0 {
				events = append(events, CombatEvent{
					Type:     "ar_damage",
					TargetID: attacker.ID,
					Data: ARDamageEvent{
						TargetID:  nearestEnemy.ID,
						Amount:    result.Damage,
						CritCount: result.CritCount,
						DmgType:   result.DmgType,
						StatusFX:  string(result.StatusFX),
						X:         nearestEnemy.Pos.X,
						Z:         nearestEnemy.Pos.Z,
					},
				})
			}

			// Handle kill
			if result.Killed {
				attacker.Kills++
				killEvents := HandlePvPKill(attacker, nearestEnemy, ac)
				events = append(events, killEvents...)
			}
		}
	}

	return events
}

// ── Final Boss ───────────────────────────────────────────────

// ARFinalBoss represents the end-of-battle raid boss.
type ARFinalBoss struct {
	Enemy         *AREnemy
	DPSContrib    map[string]float64 // factionID → total damage dealt
	TotalHP       float64
	IsDefeated    bool
}

// SpawnFinalBoss creates the final boss for the settlement/ending phase.
func (ac *ArenaCombat) SpawnFinalBoss() *ARFinalBoss {
	survivorCount := 0
	for _, p := range ac.players {
		if p.Alive {
			survivorCount++
		}
	}
	if survivorCount < 1 {
		survivorCount = 1
	}

	totalHP := ARBossHPPerSurvivor * float64(survivorCount)

	ac.nextEnemyID++
	enemy := &AREnemy{
		ID:            fmt.Sprintf("boss_%d", ac.nextEnemyID),
		Type:          AREnemyZombie,
		Pos:           ARVec3{X: 0, Y: 0, Z: 0},
		HP:            totalHP,
		MaxHP:         totalHP,
		Damage:        ARBossDamage,
		Speed:         ARBossSpeed,
		Alive:         true,
		IsMiniboss:    true,
		MinibossType:  ARMinibossTheArena,
		StatusEffects: make([]ARStatusInstance, 0, 4),
		DamageAffinity: ARDmgLightning,
	}

	ac.enemies = append(ac.enemies, enemy)

	boss := &ARFinalBoss{
		Enemy:      enemy,
		DPSContrib: make(map[string]float64),
		TotalHP:    totalHP,
		IsDefeated: false,
	}

	return boss
}

// RecordBossDamage records damage dealt to the boss by a player's faction.
func (boss *ARFinalBoss) RecordBossDamage(playerFactionID string, damage float64) {
	if playerFactionID != "" {
		boss.DPSContrib[playerFactionID] += damage
	}
}

// GetBossContribScores returns faction scores weighted by boss DPS contribution.
func (boss *ARFinalBoss) GetBossContribScores() map[string]int {
	scores := make(map[string]int, len(boss.DPSContrib))
	totalDmg := 0.0
	for _, d := range boss.DPSContrib {
		totalDmg += d
	}
	if totalDmg <= 0 {
		return scores
	}

	for fid, dmg := range boss.DPSContrib {
		contribution := dmg / totalDmg
		// Boss contribution score: base 50 points × contribution × sovereignty weight
		score := int(50.0 * contribution * ARBossSovereigntyWeight)
		scores[fid] = score
	}
	return scores
}

// ── Faction PvP Score Tracking ───────────────────────────────

// ARFactionPvPScore tracks faction performance during PvP phases.
type ARFactionPvPScore struct {
	FactionID    string  `json:"factionId"`
	PvPKills     int     `json:"pvpKills"`
	SurvivalTime float64 `json:"survivalTime"` // total seconds faction members survived
	Score        int     `json:"score"`
	BossContrib  float64 `json:"bossContrib"` // DPS contribution to final boss
}

// ── Country Theme → Terrain Mapping ──────────────────────────

// CountryToTerrainTheme maps ISO3 country codes to terrain themes.
// Uses a representative mapping; countries not listed default to "urban".
var CountryToTerrainTheme = map[string]ARTerrainTheme{
	// Urban countries
	"USA": ARTerrainUrban, "CHN": ARTerrainUrban, "KOR": ARTerrainUrban,
	"DEU": ARTerrainUrban, "FRA": ARTerrainUrban, "ITA": ARTerrainUrban,
	"ESP": ARTerrainUrban, "IND": ARTerrainUrban, "MEX": ARTerrainUrban,
	"BEL": ARTerrainUrban, "NLD": ARTerrainUrban, "HKG": ARTerrainUrban,
	"SGP": ARTerrainUrban,

	// Desert countries
	"SAU": ARTerrainDesert, "EGY": ARTerrainDesert, "IRN": ARTerrainDesert,
	"IRQ": ARTerrainDesert, "ARE": ARTerrainDesert, "DZA": ARTerrainDesert,
	"MAR": ARTerrainDesert, "LBY": ARTerrainDesert, "JOR": ARTerrainDesert,
	"QAT": ARTerrainDesert, "KWT": ARTerrainDesert, "OMN": ARTerrainDesert,
	"YEM": ARTerrainDesert, "TUN": ARTerrainDesert, "SDN": ARTerrainDesert,

	// Mountain countries
	"CHE": ARTerrainMountain, "AUT": ARTerrainMountain, "PAK": ARTerrainMountain,
	"TUR": ARTerrainMountain, "CHL": ARTerrainMountain, "PER": ARTerrainMountain,
	"ETH": ARTerrainMountain, "NPL": ARTerrainMountain, "BOL": ARTerrainMountain,
	"GEO": ARTerrainMountain, "ARM": ARTerrainMountain, "AFG": ARTerrainMountain,
	"COL": ARTerrainMountain,

	// Forest countries
	"BRA": ARTerrainForest, "THA": ARTerrainForest, "VNM": ARTerrainForest,
	"NGA": ARTerrainForest, "MYS": ARTerrainForest, "COD": ARTerrainForest,
	"MMR": ARTerrainForest, "CMR": ARTerrainForest, "LAO": ARTerrainForest,
	"KHM": ARTerrainForest, "GAB": ARTerrainForest, "PNG": ARTerrainForest,

	// Arctic countries
	"RUS": ARTerrainArctic, "CAN": ARTerrainArctic, "SWE": ARTerrainArctic,
	"NOR": ARTerrainArctic, "FIN": ARTerrainArctic, "ISL": ARTerrainArctic,
	"DNK": ARTerrainArctic, "GRL": ARTerrainArctic,

	// Island countries
	"JPN": ARTerrainIsland, "GBR": ARTerrainIsland, "IDN": ARTerrainIsland,
	"PHL": ARTerrainIsland, "NZL": ARTerrainIsland, "TWN": ARTerrainIsland,
	"AUS": ARTerrainIsland, "CUB": ARTerrainIsland, "LKA": ARTerrainIsland,
	"MDG": ARTerrainIsland, "FJI": ARTerrainIsland, "JAM": ARTerrainIsland,
}

// GetTerrainForCountry returns the terrain theme for a country ISO3 code.
func GetTerrainForCountry(iso3 string) string {
	if theme, ok := CountryToTerrainTheme[iso3]; ok {
		return string(theme)
	}
	return string(ARTerrainUrban) // default
}

// ── Sovereignty Integration Helpers ──────────────────────────

// ARBattleSovereigntyResult holds the sovereignty-relevant data from a battle.
type ARBattleSovereigntyResult struct {
	FactionScores map[string]int `json:"factionScores"`
	PvPKills      map[string]int `json:"pvpKills"`
	BossContrib   map[string]int `json:"bossContrib"`
	TotalScore    map[string]int `json:"totalScore"` // combined score for sovereignty
}

// ComputeSovereigntyScores compiles all scoring sources into final sovereignty scores.
func (ac *ArenaCombat) ComputeSovereigntyScores() *ARBattleSovereigntyResult {
	result := &ARBattleSovereigntyResult{
		FactionScores: make(map[string]int),
		PvPKills:      make(map[string]int),
		BossContrib:   make(map[string]int),
		TotalScore:    make(map[string]int),
	}

	// PvE contribution: kills × 10 + survival time × 1
	for _, p := range ac.players {
		if p.FactionID == "" {
			continue
		}
		pveScore := p.Kills*10 + int(ac.totalTime)
		result.FactionScores[p.FactionID] += pveScore
	}

	// PvP scores
	for fid, fs := range ac.factionPvPScores {
		result.PvPKills[fid] = fs.PvPKills
		result.FactionScores[fid] += fs.Score
	}

	// Boss contribution
	if ac.finalBoss != nil {
		bossScores := ac.finalBoss.GetBossContribScores()
		for fid, score := range bossScores {
			result.BossContrib[fid] = score
			result.FactionScores[fid] += score
		}
	}

	// Total
	for fid, score := range result.FactionScores {
		result.TotalScore[fid] = score
	}

	return result
}
