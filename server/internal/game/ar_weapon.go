package game

import (
	"fmt"
	"math"
	"math/rand"
)

// ============================================================
// Arena Weapon System — 16 Weapons (v18 Phase 2)
// ============================================================

// AllWeaponDefs returns the full registry of weapon definitions.
func AllWeaponDefs() map[ARWeaponID]*ARWeaponDef {
	return weaponRegistry
}

// GetWeaponDef returns the definition for a weapon ID.
func GetWeaponDef(id ARWeaponID) *ARWeaponDef {
	return weaponRegistry[id]
}

// weaponRegistry is the static definition table for all 16 weapons.
var weaponRegistry = map[ARWeaponID]*ARWeaponDef{
	// ── S-Tier ──────────────────────────────────────────────
	ARWeaponSniperRifle: {
		ID: ARWeaponSniperRifle, Name: "Sniper Rifle", Tier: ARWeaponTierS,
		DamageType: ARDmgPhysical, BaseDamage: 120, BaseRange: 30,
		BaseCooldown: 1.0, Pattern: ARPatternRangedSingle,
		ProjType: ARProjStraight, ProjSpeed: 60, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "Long-range precision rifle. Highest single-target damage.",
	},
	ARWeaponLightningStaff: {
		ID: ARWeaponLightningStaff, Name: "Lightning Staff", Tier: ARWeaponTierS,
		DamageType: ARDmgLightning, BaseDamage: 95, BaseRange: 15,
		BaseCooldown: 0.8, Pattern: ARPatternRangedChain,
		ProjType: ARProjStraight, ProjSpeed: 40, PierceCount: 0,
		AOERadius: 0, StatusApply: ARStatusShock, StatusChance: 30,
		ChainCount: 3,
		Description: "Electric bolt chains to 3 nearby enemies.",
	},
	ARWeaponBow: {
		ID: ARWeaponBow, Name: "Bow", Tier: ARWeaponTierS,
		DamageType: ARDmgPhysical, BaseDamage: 80, BaseRange: 25,
		BaseCooldown: 0.5, Pattern: ARPatternRangedSingle,
		ProjType: ARProjStraight, ProjSpeed: 45, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "Fast-firing ranged weapon with good range.",
	},
	ARWeaponRevolver: {
		ID: ARWeaponRevolver, Name: "Revolver", Tier: ARWeaponTierS,
		DamageType: ARDmgPhysical, BaseDamage: 100, BaseRange: 20,
		BaseCooldown: 0.7, Pattern: ARPatternRangedSingle,
		ProjType: ARProjStraight, ProjSpeed: 50, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "High-damage medium-range sidearm.",
	},

	// ── A-Tier ──────────────────────────────────────────────
	ARWeaponKatana: {
		ID: ARWeaponKatana, Name: "Katana", Tier: ARWeaponTierA,
		DamageType: ARDmgPhysical, BaseDamage: 90, BaseRange: 3,
		BaseCooldown: 0.4, Pattern: ARPatternMelee,
		ProjType: ARProjPierce, ProjSpeed: 0, PierceCount: 3,
		AOERadius: 0, StatusApply: ARStatusBleed, StatusChance: 20,
		Description: "Fast melee blade. Slashes pierce through multiple enemies.",
	},
	ARWeaponFireStaff: {
		ID: ARWeaponFireStaff, Name: "Fire Staff", Tier: ARWeaponTierA,
		DamageType: ARDmgFire, BaseDamage: 70, BaseRange: 12,
		BaseCooldown: 1.2, Pattern: ARPatternRangedAOE,
		ProjType: ARProjAOE, ProjSpeed: 25, PierceCount: 0,
		AOERadius: 4, StatusApply: ARStatusBurn, StatusChance: 40,
		Description: "Launches fireballs that explode in a 4m radius.",
	},
	ARWeaponAegis: {
		ID: ARWeaponAegis, Name: "Aegis", Tier: ARWeaponTierA,
		DamageType: ARDmgPhysical, BaseDamage: 40, BaseRange: 2,
		BaseCooldown: 0.6, Pattern: ARPatternMelee,
		ProjType: ARProjStraight, ProjSpeed: 0, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "Shield bash. Low damage but blocks and reflects.",
	},
	ARWeaponWirelessDagger: {
		ID: ARWeaponWirelessDagger, Name: "Wireless Dagger", Tier: ARWeaponTierA,
		DamageType: ARDmgPhysical, BaseDamage: 65, BaseRange: 10,
		BaseCooldown: 0.8, Pattern: ARPatternRangedSingle,
		ProjType: ARProjHoming, ProjSpeed: 20, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "Auto-tracking dagger that homes on nearest enemy.",
	},
	ARWeaponBlackHole: {
		ID: ARWeaponBlackHole, Name: "Black Hole", Tier: ARWeaponTierA,
		DamageType: ARDmgPhysical, BaseDamage: 0, BaseRange: 8,
		BaseCooldown: 8.0, Pattern: ARPatternPlaced,
		ProjType: ARProjAOE, ProjSpeed: 0, PierceCount: 0,
		AOERadius: 5, StatusApply: "", StatusChance: 0,
		Description: "Creates a vortex that pulls enemies for 3 seconds.",
	},

	// ── B-Tier ──────────────────────────────────────────────
	ARWeaponAxe: {
		ID: ARWeaponAxe, Name: "Axe", Tier: ARWeaponTierB,
		DamageType: ARDmgPhysical, BaseDamage: 75, BaseRange: 3,
		BaseCooldown: 0.7, Pattern: ARPatternMelee,
		ProjType: ARProjAOE, ProjSpeed: 0, PierceCount: 0,
		AOERadius: 3, StatusApply: "", StatusChance: 0,
		Description: "360-degree melee cleave. Hits all nearby enemies.",
	},
	ARWeaponFrostwalker: {
		ID: ARWeaponFrostwalker, Name: "Frostwalker", Tier: ARWeaponTierB,
		DamageType: ARDmgFrost, BaseDamage: 50, BaseRange: 5,
		BaseCooldown: 0.3, Pattern: ARPatternTrail,
		ProjType: ARProjAOE, ProjSpeed: 0, PierceCount: 0,
		AOERadius: 2.5, StatusApply: ARStatusFreeze, StatusChance: 50,
		Description: "Leaves a freezing trail behind as you move.",
	},
	ARWeaponFlamewalker: {
		ID: ARWeaponFlamewalker, Name: "Flamewalker", Tier: ARWeaponTierB,
		DamageType: ARDmgFire, BaseDamage: 55, BaseRange: 5,
		BaseCooldown: 0.3, Pattern: ARPatternTrail,
		ProjType: ARProjAOE, ProjSpeed: 0, PierceCount: 0,
		AOERadius: 2.5, StatusApply: ARStatusBurn, StatusChance: 50,
		Description: "Leaves a burning trail behind as you move.",
	},
	ARWeaponPoisonFlask: {
		ID: ARWeaponPoisonFlask, Name: "Poison Flask", Tier: ARWeaponTierB,
		DamageType: ARDmgPoison, BaseDamage: 45, BaseRange: 10,
		BaseCooldown: 2.0, Pattern: ARPatternRangedAOE,
		ProjType: ARProjAOE, ProjSpeed: 15, PierceCount: 0,
		AOERadius: 3, StatusApply: ARStatusPoison, StatusChance: 60,
		Description: "Thrown flask creating a poison puddle for 5 seconds.",
	},
	ARWeaponLandmine: {
		ID: ARWeaponLandmine, Name: "Landmine", Tier: ARWeaponTierB,
		DamageType: ARDmgPhysical, BaseDamage: 200, BaseRange: 0,
		BaseCooldown: 5.0, Pattern: ARPatternPlaced,
		ProjType: ARProjAOE, ProjSpeed: 0, PierceCount: 0,
		AOERadius: 3, StatusApply: "", StatusChance: 0,
		Description: "Planted mine. Explodes when an enemy walks over it.",
	},
	ARWeaponShotgun: {
		ID: ARWeaponShotgun, Name: "Shotgun", Tier: ARWeaponTierB,
		DamageType: ARDmgPhysical, BaseDamage: 85, BaseRange: 8,
		BaseCooldown: 1.0, Pattern: ARPatternScatter,
		ProjType: ARProjStraight, ProjSpeed: 35, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "Fan of 5 pellets in a 30-degree cone.",
	},
	ARWeaponDice: {
		ID: ARWeaponDice, Name: "Dice", Tier: ARWeaponTierB,
		DamageType: ARDmgPhysical, BaseDamage: 0, BaseRange: 10,
		BaseCooldown: 1.5, Pattern: ARPatternRandom,
		ProjType: ARProjStraight, ProjSpeed: 30, PierceCount: 0,
		AOERadius: 0, StatusApply: "", StatusChance: 0,
		Description: "Random damage 0-300. Random damage type each shot.",
	},

	// ── Evolved Weapons (Phase 3) ─────────────────────────────
	ARWeaponStormBow: {
		ID: ARWeaponStormBow, Name: "Storm Bow", Tier: ARWeaponTierS,
		DamageType: ARDmgLightning, BaseDamage: 120, BaseRange: 28,
		BaseCooldown: 0.4, Pattern: ARPatternRangedSingle,
		ProjType: ARProjStraight, ProjSpeed: 50, PierceCount: 2,
		AOERadius: 0, StatusApply: ARStatusShock, StatusChance: 40,
		ChainCount: 2,
		Description: "Evolved Bow: arrows carry chain lightning.",
	},
	ARWeaponDexecutioner: {
		ID: ARWeaponDexecutioner, Name: "Dexecutioner", Tier: ARWeaponTierS,
		DamageType: ARDmgPhysical, BaseDamage: 140, BaseRange: 3.5,
		BaseCooldown: 0.3, Pattern: ARPatternMelee,
		ProjType: ARProjPierce, ProjSpeed: 0, PierceCount: 5,
		AOERadius: 0, StatusApply: ARStatusMark, StatusChance: 100,
		Description: "Evolved Katana: executes enemies below 30% HP.",
	},
	ARWeaponInferno: {
		ID: ARWeaponInferno, Name: "Inferno", Tier: ARWeaponTierS,
		DamageType: ARDmgFire, BaseDamage: 110, BaseRange: 20,
		BaseCooldown: 0.8, Pattern: ARPatternRangedAOE,
		ProjType: ARProjAOE, ProjSpeed: 30, PierceCount: 0,
		AOERadius: 10, StatusApply: ARStatusBurn, StatusChance: 80,
		Description: "Evolved Fire Staff: screen-wide fire storm.",
	},
	ARWeaponDragonBreath: {
		ID: ARWeaponDragonBreath, Name: "Dragon Breath", Tier: ARWeaponTierS,
		DamageType: ARDmgFire, BaseDamage: 100, BaseRange: 10,
		BaseCooldown: 0.2, Pattern: ARPatternScatter,
		ProjType: ARProjStraight, ProjSpeed: 40, PierceCount: 0,
		AOERadius: 2, StatusApply: ARStatusBurn, StatusChance: 60,
		Description: "Evolved Shotgun: continuous flame spray.",
	},
	ARWeaponPandemic: {
		ID: ARWeaponPandemic, Name: "Pandemic", Tier: ARWeaponTierS,
		DamageType: ARDmgPoison, BaseDamage: 80, BaseRange: 15,
		BaseCooldown: 1.5, Pattern: ARPatternRangedAOE,
		ProjType: ARProjAOE, ProjSpeed: 20, PierceCount: 0,
		AOERadius: 8, StatusApply: ARStatusPoison, StatusChance: 100,
		Description: "Evolved Poison Flask: poison spreads between enemies.",
	},
}

// ============================================================
// Weapon Evolution System (Phase 3)
// ============================================================

// AREvolutionPath defines the requirements to evolve a weapon.
type AREvolutionPath struct {
	BaseWeapon   ARWeaponID `json:"baseWeapon"`
	RequiredTome ARTomeID   `json:"requiredTome"`
	TomeStacks   int        `json:"tomeStacks"` // minimum stacks required
	EvolvedTo    ARWeaponID `json:"evolvedTo"`
}

// AllEvolutionPaths returns the 5 weapon evolution paths.
func AllEvolutionPaths() []AREvolutionPath {
	return evolutionPaths
}

var evolutionPaths = []AREvolutionPath{
	{BaseWeapon: ARWeaponBow, RequiredTome: ARTomeSpeed, TomeStacks: 3, EvolvedTo: ARWeaponStormBow},
	{BaseWeapon: ARWeaponKatana, RequiredTome: ARTomeCritChance, TomeStacks: 3, EvolvedTo: ARWeaponDexecutioner},
	{BaseWeapon: ARWeaponFireStaff, RequiredTome: ARTomeArea, TomeStacks: 3, EvolvedTo: ARWeaponInferno},
	{BaseWeapon: ARWeaponShotgun, RequiredTome: ARTomeKnockback, TomeStacks: 3, EvolvedTo: ARWeaponDragonBreath},
	{BaseWeapon: ARWeaponPoisonFlask, RequiredTome: ARTomeCursed, TomeStacks: 2, EvolvedTo: ARWeaponPandemic},
}

// CheckWeaponEvolution checks if any of the player's weapons can evolve.
// Returns the first evolution found, or nil if none qualify.
func CheckWeaponEvolution(player *ARPlayer) *AREvolutionPath {
	for _, path := range evolutionPaths {
		// Check if player has the base weapon at level 7
		for _, wi := range player.Weapons {
			if wi.WeaponID == path.BaseWeapon && wi.Level >= 7 {
				// Check tome requirement
				if player.Tomes[path.RequiredTome] >= path.TomeStacks {
					return &path
				}
			}
		}
	}
	return nil
}

// AREvolveWeapon replaces a player's weapon with its evolved version.
// Returns true if evolution succeeded.
func AREvolveWeapon(player *ARPlayer, path *AREvolutionPath) bool {
	for i, wi := range player.Weapons {
		if wi.WeaponID == path.BaseWeapon {
			player.Weapons[i] = &ARWeaponInstance{
				WeaponID: path.EvolvedTo,
				Level:    7,
				Cooldown: 0,
			}
			// Update weapon slots
			for j, slot := range player.WeaponSlots {
				if ARWeaponID(slot) == path.BaseWeapon {
					player.WeaponSlots[j] = string(path.EvolvedTo)
					break
				}
			}
			return true
		}
	}
	return false
}

// ============================================================
// Weapon Level Scaling
// ============================================================

// WeaponLevelDamageMult returns the damage multiplier for a weapon level.
func WeaponLevelDamageMult(level int) float64 {
	switch {
	case level <= 1:
		return 1.0
	case level == 2:
		return 1.20
	case level == 3:
		return 1.20 // Lv3 = attack speed +15%, not damage
	case level == 4:
		return 1.20
	case level == 5:
		return 1.20
	case level == 6:
		return 1.50 // +30% at lv6
	case level >= 7:
		return 1.50 // lv7 = evolution (handled separately)
	default:
		return 1.0
	}
}

// WeaponLevelCooldownMult returns cooldown multiplier (lower = faster).
func WeaponLevelCooldownMult(level int) float64 {
	if level >= 3 {
		return 0.85 // 15% faster at lv3+
	}
	return 1.0
}

// WeaponLevelRangeBonus returns the range bonus at a given level.
func WeaponLevelRangeBonus(level int) float64 {
	if level >= 4 {
		return 2.0 // +2m at lv4+
	}
	return 0
}

// ============================================================
// Weapon Firing Logic
// ============================================================

// WeaponCanFire checks if a weapon instance is ready to fire.
func WeaponCanFire(wi *ARWeaponInstance) bool {
	return wi.Cooldown <= 0
}

// WeaponTickCooldowns decrements all weapon cooldowns.
func WeaponTickCooldowns(player *ARPlayer, delta float64) {
	for _, w := range player.Weapons {
		if w.Cooldown > 0 {
			w.Cooldown -= delta * player.AttackSpeedMult
		}
	}
}

// WeaponFire attempts to fire a weapon, creating projectiles or dealing instant damage.
// Returns a list of projectiles spawned and direct damage events.
func WeaponFire(
	player *ARPlayer,
	wi *ARWeaponInstance,
	enemies []*AREnemy,
	nextProjID *int,
) ([]*ARProjectile, []ARDamageEvent) {
	def := GetWeaponDef(wi.WeaponID)
	if def == nil {
		return nil, nil
	}

	// Reset cooldown
	cd := def.BaseCooldown * WeaponLevelCooldownMult(wi.Level)
	wi.Cooldown = cd

	attackRange := def.BaseRange + WeaponLevelRangeBonus(wi.Level)
	baseDmg := def.BaseDamage * WeaponLevelDamageMult(wi.Level) * player.DamageMult

	// Find nearest enemy in range
	var target *AREnemy
	targetDist := math.MaxFloat64
	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		d := player.Pos.DistTo(e.Pos)
		if d <= attackRange && d < targetDist {
			targetDist = d
			target = e
		}
	}

	if target == nil && def.Pattern != ARPatternTrail && def.Pattern != ARPatternPlaced {
		return nil, nil
	}

	var projs []*ARProjectile
	var dmgEvents []ARDamageEvent

	switch def.Pattern {
	case ARPatternMelee:
		dmgEvents = weaponFireMelee(player, def, baseDmg, enemies, attackRange)

	case ARPatternRangedSingle:
		if target != nil {
			projs = weaponFireProjectile(player, def, baseDmg, target, nextProjID, 1)
		}

	case ARPatternRangedChain:
		if target != nil {
			projs = weaponFireProjectile(player, def, baseDmg, target, nextProjID, 1)
			// Chain hits are resolved on projectile impact
		}

	case ARPatternRangedAOE:
		if target != nil {
			projs = weaponFireProjectile(player, def, baseDmg, target, nextProjID, 1)
		}

	case ARPatternTrail:
		dmgEvents = weaponFireTrail(player, def, baseDmg, enemies)

	case ARPatternPlaced:
		projs = weaponFirePlaced(player, def, baseDmg, nextProjID)

	case ARPatternScatter:
		if target != nil {
			count := 5 + player.ProjectileExtra
			projs = weaponFireScatter(player, def, baseDmg, target, nextProjID, count)
		}

	case ARPatternRandom:
		if target != nil {
			projs = weaponFireRandom(player, def, target, nextProjID)
		}
	}

	return projs, dmgEvents
}

// ============================================================
// Pattern Implementations
// ============================================================

func weaponFireMelee(
	player *ARPlayer,
	def *ARWeaponDef,
	baseDmg float64,
	enemies []*AREnemy,
	attackRange float64,
) []ARDamageEvent {
	var events []ARDamageEvent
	pierceCount := def.PierceCount + player.PierceExtra
	hitCount := 0
	aoeRange := def.AOERadius * player.AreaMult

	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		checkRange := attackRange
		if aoeRange > 0 {
			checkRange = aoeRange
		}
		if dist > checkRange {
			continue
		}

		// Critical hit
		critCount := calcCritCount(player.CritChance)
		critMult := calcCritMultiplier(critCount, player.CritDamageMult)
		finalDmg := baseDmg * critMult

		// Apply defense
		finalDmg = applyDefense(finalDmg, e.Defense)

		// Apply elemental affinity
		finalDmg *= elementalMultiplier(def.DamageType, e.DamageAffinity)

		e.HP -= finalDmg
		if e.HP < 0 {
			e.HP = 0
		}

		events = append(events, ARDamageEvent{
			TargetID:  e.ID,
			Amount:    finalDmg,
			CritCount: critCount,
			DmgType:   def.DamageType,
			X:         e.Pos.X,
			Z:         e.Pos.Z,
		})

		// Apply status effect
		if def.StatusApply != "" && rand.Float64()*100 < def.StatusChance {
			applyStatusToEnemy(e, def.StatusApply, player.ID)
			events[len(events)-1].StatusFX = string(def.StatusApply)
		}

		hitCount++
		if pierceCount > 0 && hitCount >= pierceCount {
			break
		}
	}

	return events
}

func weaponFireProjectile(
	player *ARPlayer,
	def *ARWeaponDef,
	baseDmg float64,
	target *AREnemy,
	nextProjID *int,
	count int,
) []*ARProjectile {
	projs := make([]*ARProjectile, 0, count+player.ProjectileExtra)

	totalCount := count + player.ProjectileExtra
	for i := 0; i < totalCount; i++ {
		*nextProjID++

		dx := target.Pos.X - player.Pos.X
		dz := target.Pos.Z - player.Pos.Z
		dist := math.Sqrt(dx*dx + dz*dz)
		if dist < 0.01 {
			dist = 1
		}

		// Slight spread for extra projectiles
		spread := 0.0
		if i > 0 {
			spread = (float64(i) - float64(totalCount-1)/2) * 0.15
		}

		vx := (dx/dist)*math.Cos(spread) - (dz/dist)*math.Sin(spread)
		vz := (dx/dist)*math.Sin(spread) + (dz/dist)*math.Cos(spread)

		proj := &ARProjectile{
			ID:        fmt.Sprintf("p_%d", *nextProjID),
			OwnerID:   player.ID,
			WeaponID:  def.ID,
			Pos:       player.Pos,
			Vel:       ARVec3{X: vx * def.ProjSpeed, Z: vz * def.ProjSpeed},
			DmgType:   def.DamageType,
			Damage:    baseDmg,
			ProjType:  def.ProjType,
			Speed:     def.ProjSpeed,
			Range:     def.BaseRange + WeaponLevelRangeBonus(1),
			Traveled:  0,
			PierceLeft: def.PierceCount + player.PierceExtra,
			AOERadius: def.AOERadius * player.AreaMult,
			TargetID:  target.ID,
			StatusFX:  def.StatusApply,
			StatusPct: def.StatusChance,
			Alive:     true,
			HitIDs:    make(map[string]bool),
		}

		projs = append(projs, proj)
	}

	return projs
}

func weaponFireTrail(
	player *ARPlayer,
	def *ARWeaponDef,
	baseDmg float64,
	enemies []*AREnemy,
) []ARDamageEvent {
	var events []ARDamageEvent
	trailRadius := def.AOERadius * player.AreaMult

	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		if dist > trailRadius {
			continue
		}

		// Trail does reduced DPS (continuous effect)
		dmg := baseDmg * 0.05 // per-tick damage (20Hz)

		e.HP -= dmg
		if e.HP < 0 {
			e.HP = 0
		}

		events = append(events, ARDamageEvent{
			TargetID: e.ID,
			Amount:   dmg,
			DmgType:  def.DamageType,
			X:        e.Pos.X,
			Z:        e.Pos.Z,
		})

		// Status
		if def.StatusApply != "" && rand.Float64()*100 < def.StatusChance*0.1 {
			applyStatusToEnemy(e, def.StatusApply, player.ID)
		}
	}

	return events
}

func weaponFirePlaced(
	player *ARPlayer,
	def *ARWeaponDef,
	baseDmg float64,
	nextProjID *int,
) []*ARProjectile {
	*nextProjID++
	proj := &ARProjectile{
		ID:        fmt.Sprintf("p_%d", *nextProjID),
		OwnerID:   player.ID,
		WeaponID:  def.ID,
		Pos:       player.Pos,
		Vel:       ARVec3{},
		DmgType:   def.DamageType,
		Damage:    baseDmg,
		ProjType:  ARProjAOE,
		Speed:     0,
		Range:     0,
		Traveled:  0,
		AOERadius: def.AOERadius * player.AreaMult,
		StatusFX:  def.StatusApply,
		StatusPct: def.StatusChance,
		Alive:     true,
		HitIDs:    make(map[string]bool),
	}
	return []*ARProjectile{proj}
}

func weaponFireScatter(
	player *ARPlayer,
	def *ARWeaponDef,
	baseDmg float64,
	target *AREnemy,
	nextProjID *int,
	count int,
) []*ARProjectile {
	projs := make([]*ARProjectile, 0, count)
	dx := target.Pos.X - player.Pos.X
	dz := target.Pos.Z - player.Pos.Z
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist < 0.01 {
		dist = 1
	}
	baseAngle := math.Atan2(dz, dx)

	// Spread angle: 30 degrees total
	spreadTotal := 30.0 * math.Pi / 180.0
	dmgPerPellet := baseDmg / float64(count) * 1.5 // total DPS slightly higher than listed

	for i := 0; i < count; i++ {
		*nextProjID++
		angle := baseAngle + spreadTotal*(float64(i)/float64(count-1)-0.5)

		vx := math.Cos(angle) * def.ProjSpeed
		vz := math.Sin(angle) * def.ProjSpeed

		proj := &ARProjectile{
			ID:        fmt.Sprintf("p_%d", *nextProjID),
			OwnerID:   player.ID,
			WeaponID:  def.ID,
			Pos:       player.Pos,
			Vel:       ARVec3{X: vx, Z: vz},
			DmgType:   def.DamageType,
			Damage:    dmgPerPellet,
			ProjType:  ARProjStraight,
			Speed:     def.ProjSpeed,
			Range:     def.BaseRange,
			Traveled:  0,
			AOERadius: 0,
			StatusFX:  def.StatusApply,
			StatusPct: def.StatusChance,
			Alive:     true,
			HitIDs:    make(map[string]bool),
		}
		projs = append(projs, proj)
	}

	return projs
}

func weaponFireRandom(
	player *ARPlayer,
	def *ARWeaponDef,
	target *AREnemy,
	nextProjID *int,
) []*ARProjectile {
	*nextProjID++

	// Random damage 0-300
	dmg := rand.Float64() * 300.0 * player.DamageMult

	// Random damage type
	types := []ARDamageType{ARDmgPhysical, ARDmgFire, ARDmgFrost, ARDmgLightning, ARDmgPoison}
	dmgType := types[rand.Intn(len(types))]

	// Random status
	statuses := []ARStatusEffect{"", ARStatusBurn, ARStatusFreeze, ARStatusShock, ARStatusPoison, ARStatusBleed}
	statusFX := statuses[rand.Intn(len(statuses))]

	dx := target.Pos.X - player.Pos.X
	dz := target.Pos.Z - player.Pos.Z
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist < 0.01 {
		dist = 1
	}

	proj := &ARProjectile{
		ID:        fmt.Sprintf("p_%d", *nextProjID),
		OwnerID:   player.ID,
		WeaponID:  def.ID,
		Pos:       player.Pos,
		Vel:       ARVec3{X: dx / dist * def.ProjSpeed, Z: dz / dist * def.ProjSpeed},
		DmgType:   dmgType,
		Damage:    dmg,
		ProjType:  ARProjStraight,
		Speed:     def.ProjSpeed,
		Range:     def.BaseRange,
		Traveled:  0,
		AOERadius: 0,
		StatusFX:  statusFX,
		StatusPct: 30,
		Alive:     true,
		HitIDs:    make(map[string]bool),
	}
	return []*ARProjectile{proj}
}

// ============================================================
// Projectile Tick — Movement & Collision
// ============================================================

// TickProjectiles moves projectiles and checks for hits.
func TickProjectiles(
	projs []*ARProjectile,
	enemies []*AREnemy,
	players map[string]*ARPlayer,
	delta float64,
) (alive []*ARProjectile, events []ARDamageEvent) {
	for _, p := range projs {
		if !p.Alive {
			continue
		}

		// Move
		if p.ProjType == ARProjHoming && p.TargetID != "" {
			// Re-acquire target direction
			for _, e := range enemies {
				if e.ID == p.TargetID && e.Alive {
					dx := e.Pos.X - p.Pos.X
					dz := e.Pos.Z - p.Pos.Z
					dist := math.Sqrt(dx*dx + dz*dz)
					if dist > 0.1 {
						p.Vel.X = dx / dist * p.Speed
						p.Vel.Z = dz / dist * p.Speed
					}
					break
				}
			}
		}

		travel := p.Speed * delta
		p.Pos.X += p.Vel.X * delta
		p.Pos.Z += p.Vel.Z * delta
		p.Traveled += travel

		// Range check
		if p.Range > 0 && p.Traveled >= p.Range {
			// AOE explosion at end of range
			if p.AOERadius > 0 {
				evts := projectileAOEHit(p, enemies, players)
				events = append(events, evts...)
			}
			p.Alive = false
			continue
		}

		// Collision check: projectile vs enemies
		hitRadius := 0.8 // collision radius
		for _, e := range enemies {
			if !e.Alive || p.HitIDs[e.ID] {
				continue
			}

			dist := p.Pos.DistTo(e.Pos)
			if dist > hitRadius {
				continue
			}

			p.HitIDs[e.ID] = true

			if p.AOERadius > 0 {
				// AOE: damage all enemies in radius
				evts := projectileAOEHit(p, enemies, players)
				events = append(events, evts...)
				p.Alive = false
				break
			}

			// Single-target hit
			owner := players[p.OwnerID]
			critCount := 0
			critMult := 1.0
			if owner != nil {
				critCount = calcCritCount(owner.CritChance)
				critMult = calcCritMultiplier(critCount, owner.CritDamageMult)
			}
			finalDmg := p.Damage * critMult
			finalDmg = applyDefense(finalDmg, e.Defense)
			finalDmg *= elementalMultiplier(p.DmgType, e.DamageAffinity)

			e.HP -= finalDmg
			if e.HP < 0 {
				e.HP = 0
			}

			evt := ARDamageEvent{
				TargetID:  e.ID,
				Amount:    finalDmg,
				CritCount: critCount,
				DmgType:   p.DmgType,
				X:         e.Pos.X,
				Z:         e.Pos.Z,
			}

			if p.StatusFX != "" && rand.Float64()*100 < p.StatusPct {
				applyStatusToEnemy(e, p.StatusFX, p.OwnerID)
				evt.StatusFX = string(p.StatusFX)
			}

			events = append(events, evt)

			// Pierce check
			if p.PierceLeft > 0 {
				p.PierceLeft--
			} else {
				p.Alive = false
				break
			}
		}
	}

	// Filter alive projectiles
	result := projs[:0]
	for _, p := range projs {
		if p.Alive {
			result = append(result, p)
		}
	}
	return result, events
}

func projectileAOEHit(
	p *ARProjectile,
	enemies []*AREnemy,
	players map[string]*ARPlayer,
) []ARDamageEvent {
	var events []ARDamageEvent
	owner := players[p.OwnerID]

	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		dist := p.Pos.DistTo(e.Pos)
		if dist > p.AOERadius {
			continue
		}

		// Damage falloff by distance
		falloff := 1.0 - (dist / p.AOERadius * 0.5)
		critCount := 0
		critMult := 1.0
		if owner != nil {
			critCount = calcCritCount(owner.CritChance)
			critMult = calcCritMultiplier(critCount, owner.CritDamageMult)
		}
		finalDmg := p.Damage * critMult * falloff
		finalDmg = applyDefense(finalDmg, e.Defense)

		e.HP -= finalDmg
		if e.HP < 0 {
			e.HP = 0
		}

		evt := ARDamageEvent{
			TargetID:  e.ID,
			Amount:    finalDmg,
			CritCount: critCount,
			DmgType:   p.DmgType,
			X:         e.Pos.X,
			Z:         e.Pos.Z,
		}

		if p.StatusFX != "" && rand.Float64()*100 < p.StatusPct {
			applyStatusToEnemy(e, p.StatusFX, p.OwnerID)
			evt.StatusFX = string(p.StatusFX)
		}

		events = append(events, evt)
	}

	return events
}

// ============================================================
// Helpers
// ============================================================

// applyDefense reduces damage using the defense formula: dmg * (100 / (100 + defense)).
func applyDefense(damage, defense float64) float64 {
	if defense <= 0 {
		return damage
	}
	return damage * (100.0 / (100.0 + defense))
}

// elementalMultiplier returns the type effectiveness multiplier.
func elementalMultiplier(attackType, defenseType ARDamageType) float64 {
	if defenseType == "" {
		return 1.0
	}
	// Effectiveness matrix from design doc §11
	matrix := map[ARDamageType]map[ARDamageType]float64{
		ARDmgPhysical:  {ARDmgPhysical: 1.0, ARDmgFire: 1.0, ARDmgFrost: 1.0, ARDmgLightning: 1.0, ARDmgPoison: 1.0},
		ARDmgFire:      {ARDmgPhysical: 1.0, ARDmgFire: 0.5, ARDmgFrost: 1.5, ARDmgLightning: 1.0, ARDmgPoison: 1.2},
		ARDmgFrost:     {ARDmgPhysical: 1.0, ARDmgFire: 1.5, ARDmgFrost: 0.5, ARDmgLightning: 0.8, ARDmgPoison: 1.0},
		ARDmgLightning: {ARDmgPhysical: 1.0, ARDmgFire: 0.8, ARDmgFrost: 1.2, ARDmgLightning: 0.5, ARDmgPoison: 1.5},
		ARDmgPoison:    {ARDmgPhysical: 1.0, ARDmgFire: 1.0, ARDmgFrost: 1.0, ARDmgLightning: 1.5, ARDmgPoison: 0.5},
	}
	if row, ok := matrix[attackType]; ok {
		if mult, ok2 := row[defenseType]; ok2 {
			return mult
		}
	}
	return 1.0
}

// applyStatusToEnemy applies or stacks a status effect on an enemy.
func applyStatusToEnemy(enemy *AREnemy, effect ARStatusEffect, sourceID string) {
	maxStacks := statusMaxStacks(effect)
	duration := statusDuration(effect)

	for i := range enemy.StatusEffects {
		if enemy.StatusEffects[i].Effect == effect {
			if enemy.StatusEffects[i].Stacks < maxStacks {
				enemy.StatusEffects[i].Stacks++
			}
			enemy.StatusEffects[i].Remaining = duration
			return
		}
	}

	enemy.StatusEffects = append(enemy.StatusEffects, ARStatusInstance{
		Effect:    effect,
		Remaining: duration,
		Stacks:    1,
		SourceID:  sourceID,
	})
}

func statusMaxStacks(effect ARStatusEffect) int {
	switch effect {
	case ARStatusBurn:
		return 5
	case ARStatusFreeze:
		return 3
	case ARStatusShock:
		return 1
	case ARStatusPoison:
		return 3
	case ARStatusBleed:
		return 5
	case ARStatusMark:
		return 1
	default:
		return 1
	}
}

func statusDuration(effect ARStatusEffect) float64 {
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
