package domain

// ============================================================
// v14 Phase 2: Megabonk Weapon System — Data & Types
// ============================================================

// WeaponType identifies one of the 10 weapon types.
type WeaponType string

const (
	WeaponBonkMallet    WeaponType = "bonk_mallet"
	WeaponChainBolt     WeaponType = "chain_bolt"
	WeaponFlameRing     WeaponType = "flame_ring"
	WeaponFrostShards   WeaponType = "frost_shards"
	WeaponShadowStrike  WeaponType = "shadow_strike"
	WeaponThunderClap   WeaponType = "thunder_clap"
	WeaponVenomCloud    WeaponType = "venom_cloud"
	WeaponCrystalShield WeaponType = "crystal_shield"
	WeaponGravityBomb   WeaponType = "gravity_bomb"
	WeaponSoulDrain     WeaponType = "soul_drain"
)

// AllWeaponTypes lists all weapon types for iteration.
var AllWeaponTypes = []WeaponType{
	WeaponBonkMallet, WeaponChainBolt, WeaponFlameRing, WeaponFrostShards,
	WeaponShadowStrike, WeaponThunderClap, WeaponVenomCloud, WeaponCrystalShield,
	WeaponGravityBomb, WeaponSoulDrain,
}

// WeaponPattern describes the firing pattern type.
type WeaponPattern string

const (
	PatternFanSwing     WeaponPattern = "fan_swing"      // 전방 부채꼴
	PatternChainTarget  WeaponPattern = "chain_target"    // 체인 연쇄
	PatternCircularRing WeaponPattern = "circular_ring"   // 360° 원형
	PatternMultiShot    WeaponPattern = "multi_shot"      // 전방 다발
	PatternTeleportBack WeaponPattern = "teleport_back"   // 배후 텔레포트
	PatternTargetedAOE  WeaponPattern = "targeted_aoe"    // 타겟 AOE
	PatternDeployable   WeaponPattern = "deployable"      // 설치형
	PatternOrbital      WeaponPattern = "orbital"         // 궤도 회전
	PatternDeployExplode WeaponPattern = "deploy_explode" // 설치 폭발
	PatternBeam         WeaponPattern = "beam"            // 빔
)

// SpecialEffect describes the secondary effect of a weapon.
type SpecialEffect string

const (
	EffectNone      SpecialEffect = "none"
	EffectKnockback SpecialEffect = "knockback"
	EffectChainDecay SpecialEffect = "chain_decay"
	EffectBurnDOT   SpecialEffect = "burn_dot"
	EffectSlow      SpecialEffect = "slow"
	EffectBackstab  SpecialEffect = "backstab"
	EffectStun      SpecialEffect = "stun"
	EffectPoisonDOT SpecialEffect = "poison_dot"
	EffectReflect   SpecialEffect = "reflect"
	EffectPull      SpecialEffect = "pull"
	EffectLifesteal SpecialEffect = "lifesteal"
)

// WeaponData defines the static properties of a weapon at base (Lv1).
type WeaponData struct {
	Type          WeaponType    `json:"type"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	BaseDPS       float64       `json:"baseDPS"`       // damage per hit
	Range         float64       `json:"range"`         // effective range in px
	CooldownSec   float64       `json:"cooldownSec"`   // seconds between attacks
	Pattern       WeaponPattern `json:"pattern"`
	SpecialEffect SpecialEffect `json:"specialEffect"`
	// Pattern-specific parameters
	FanAngleDeg    float64 `json:"fanAngleDeg,omitempty"`    // BonkMallet: 120°
	ChainCount     int     `json:"chainCount,omitempty"`     // ChainBolt: 3
	ChainDecay     float64 `json:"chainDecay,omitempty"`     // ChainBolt: -20% per chain
	ProjectileCount int    `json:"projectileCount,omitempty"` // FrostShards: 5
	KnockbackPx    float64 `json:"knockbackPx,omitempty"`    // BonkMallet: 30px
	DOTDurationSec float64 `json:"dotDurationSec,omitempty"` // FlameRing/VenomCloud: seconds
	DOTDPSPerSec   float64 `json:"dotDPSPerSec,omitempty"`   // DOT damage per second
	SlowPercent    float64 `json:"slowPercent,omitempty"`     // FrostShards: 0.40
	SlowDurationSec float64 `json:"slowDurationSec,omitempty"` // FrostShards: 1s
	StunDurationSec float64 `json:"stunDurationSec,omitempty"` // ThunderClap: 0.5s
	DeployDurationSec float64 `json:"deployDurationSec,omitempty"` // VenomCloud: 5s
	OrbitalCount   int     `json:"orbitalCount,omitempty"`   // CrystalShield: 3
	PullDurationSec float64 `json:"pullDurationSec,omitempty"` // GravityBomb: 2s
	LifestealPct   float64 `json:"lifestealPct,omitempty"`   // SoulDrain: 0.30
	BackstabMult   float64 `json:"backstabMult,omitempty"`   // ShadowStrike: 2.0
}

// WeaponEvolutionData defines the multipliers applied at each evolution level.
type WeaponEvolutionData struct {
	Level       int     `json:"level"`       // 1~5
	DPSMult     float64 `json:"dpsMult"`     // damage multiplier
	RangeMult   float64 `json:"rangeMult"`   // range multiplier
	CooldownMult float64 `json:"cooldownMult"` // cooldown multiplier (< 1 = faster)
	UltimateName string  `json:"ultimateName,omitempty"` // Lv5 only
	UltimateDesc string  `json:"ultimateDesc,omitempty"` // Lv5 only
}

// WeaponSlot holds a weapon instance in an agent's inventory.
type WeaponSlot struct {
	Type          WeaponType `json:"type"`
	Level         int        `json:"level"` // 1~5
	CooldownTicks int       `json:"cooldownTicks"` // remaining cooldown ticks
}

// MaxWeaponSlots is the maximum number of weapons an agent can hold.
const MaxWeaponSlots = 5

// MaxWeaponLevel is the maximum evolution level.
const MaxWeaponLevel = 5

// DamageSourceWeapon extends DamageSource for weapon-based deaths.
const DamageSourceWeapon DamageSource = "weapon"

// ============================================================
// Weapon Definitions — 10 Weapons
// ============================================================

// AllWeapons defines the base stats for all 10 weapons.
var AllWeapons = []WeaponData{
	{
		Type: WeaponBonkMallet, Name: "Bonk Mallet",
		Description:   "Smashes enemies in a 120° frontal cone with knockback",
		BaseDPS: 25, Range: 80, CooldownSec: 1.5,
		Pattern: PatternFanSwing, SpecialEffect: EffectKnockback,
		FanAngleDeg: 120, KnockbackPx: 30,
	},
	{
		Type: WeaponChainBolt, Name: "Chain Bolt",
		Description:   "Lightning bolt chains through 3 enemies with decreasing damage",
		BaseDPS: 15, Range: 150, CooldownSec: 1.2,
		Pattern: PatternChainTarget, SpecialEffect: EffectChainDecay,
		ChainCount: 3, ChainDecay: 0.20,
	},
	{
		Type: WeaponFlameRing, Name: "Flame Ring",
		Description:   "Expanding 360° ring of fire that burns enemies",
		BaseDPS: 20, Range: 120, CooldownSec: 3.0,
		Pattern: PatternCircularRing, SpecialEffect: EffectBurnDOT,
		DOTDurationSec: 2.0, DOTDPSPerSec: 10,
	},
	{
		Type: WeaponFrostShards, Name: "Frost Shards",
		Description:   "Fires 5 ice shards in a 45° cone, slowing enemies",
		BaseDPS: 12, Range: 180, CooldownSec: 1.0,
		Pattern: PatternMultiShot, SpecialEffect: EffectSlow,
		FanAngleDeg: 45, ProjectileCount: 5,
		SlowPercent: 0.40, SlowDurationSec: 1.0,
	},
	{
		Type: WeaponShadowStrike, Name: "Shadow Strike",
		Description:   "Teleports behind the nearest enemy for a backstab",
		BaseDPS: 40, Range: 200, CooldownSec: 4.0,
		Pattern: PatternTeleportBack, SpecialEffect: EffectBackstab,
		BackstabMult: 2.0,
	},
	{
		Type: WeaponThunderClap, Name: "Thunder Clap",
		Description:   "AOE lightning on the highest-HP enemy, stunning targets",
		BaseDPS: 30, Range: 250, CooldownSec: 3.5,
		Pattern: PatternTargetedAOE, SpecialEffect: EffectStun,
		StunDurationSec: 0.5,
	},
	{
		Type: WeaponVenomCloud, Name: "Venom Cloud",
		Description:   "Deploys a poison cloud at current position",
		BaseDPS: 8, Range: 100, CooldownSec: 5.0,
		Pattern: PatternDeployable, SpecialEffect: EffectPoisonDOT,
		DeployDurationSec: 5.0, DOTDurationSec: 5.0, DOTDPSPerSec: 8,
	},
	{
		Type: WeaponCrystalShield, Name: "Crystal Shield",
		Description:   "3 orbiting crystals that damage on contact and reflect projectiles",
		BaseDPS: 10, Range: 50, CooldownSec: 0,
		Pattern: PatternOrbital, SpecialEffect: EffectReflect,
		OrbitalCount: 3,
	},
	{
		Type: WeaponGravityBomb, Name: "Gravity Bomb",
		Description:   "Deploys a black hole that pulls enemies in, then explodes",
		BaseDPS: 35, Range: 200, CooldownSec: 6.0,
		Pattern: PatternDeployExplode, SpecialEffect: EffectPull,
		PullDurationSec: 2.0,
	},
	{
		Type: WeaponSoulDrain, Name: "Soul Drain",
		Description:   "Continuous beam to nearest enemy, stealing HP",
		BaseDPS: 18, Range: 120, CooldownSec: 0,
		Pattern: PatternBeam, SpecialEffect: EffectLifesteal,
		LifestealPct: 0.30,
	},
}

// GetWeaponData returns the WeaponData for a given WeaponType, or nil if not found.
func GetWeaponData(wt WeaponType) *WeaponData {
	for i := range AllWeapons {
		if AllWeapons[i].Type == wt {
			return &AllWeapons[i]
		}
	}
	return nil
}

// ============================================================
// Weapon Evolution — Lv1~5
// ============================================================

// WeaponEvolutionTable maps each level to its multipliers.
// Lv1 = base, Lv2 = +30% DMG, Lv3 = +25% range, Lv4 = -20% CD, Lv5 = ultimate.
var WeaponEvolutionTable = []WeaponEvolutionData{
	{Level: 1, DPSMult: 1.0, RangeMult: 1.0, CooldownMult: 1.0},
	{Level: 2, DPSMult: 1.3, RangeMult: 1.0, CooldownMult: 1.0},
	{Level: 3, DPSMult: 1.3, RangeMult: 1.25, CooldownMult: 1.0},
	{Level: 4, DPSMult: 1.3, RangeMult: 1.25, CooldownMult: 0.80},
	{Level: 5, DPSMult: 1.6, RangeMult: 1.5, CooldownMult: 0.70},
}

// GetEvolutionData returns the evolution multipliers for a given level (1-5).
func GetEvolutionData(level int) *WeaponEvolutionData {
	if level < 1 || level > MaxWeaponLevel {
		return nil
	}
	return &WeaponEvolutionTable[level-1]
}

// UltimateWeaponNames maps each weapon to its Lv5 ultimate transformation name.
var UltimateWeaponNames = map[WeaponType]string{
	WeaponBonkMallet:    "Earthquake",
	WeaponChainBolt:     "Storm Network",
	WeaponFlameRing:     "Inferno",
	WeaponFrostShards:   "Blizzard",
	WeaponShadowStrike:  "Phantom Dance",
	WeaponThunderClap:   "Judgment",
	WeaponVenomCloud:    "Plague",
	WeaponCrystalShield: "Diamond Fortress",
	WeaponGravityBomb:   "Singularity",
	WeaponSoulDrain:     "Life Siphon",
}

// UltimateWeaponDescs maps each weapon to its Lv5 ultimate description.
var UltimateWeaponDescs = map[WeaponType]string{
	WeaponBonkMallet:    "360° shockwave + crack zone",
	WeaponChainBolt:     "5-chain + residual lightning field",
	WeaponFlameRing:     "Double ring + piercing",
	WeaponFrostShards:   "360° ice storm",
	WeaponShadowStrike:  "Triple teleport + clone",
	WeaponThunderClap:   "Map-wide lightning + 5s stun (once per epoch)",
	WeaponVenomCloud:    "Moving cloud + infection spread",
	WeaponCrystalShield: "5 orbitals + 200% reflect",
	WeaponGravityBomb:   "5s black hole + 2x radius",
	WeaponSoulDrain:     "Frontal cone + ally heal",
}

// ============================================================
// Status Effects for Weapon System
// ============================================================

// StatusEffectType identifies a status effect applied by weapons.
type StatusEffectType string

const (
	StatusBurn     StatusEffectType = "burn"
	StatusPoison   StatusEffectType = "poison"
	StatusSlow     StatusEffectType = "slow"
	StatusStun     StatusEffectType = "stun"
	StatusPull     StatusEffectType = "pull"
	StatusKnockback StatusEffectType = "knockback_effect"
)

// StatusEffect represents an active status effect on an agent.
type StatusEffect struct {
	Type         StatusEffectType `json:"type"`
	SourceID     string           `json:"sourceId"`     // who applied it
	TicksLeft    int              `json:"ticksLeft"`     // remaining duration in ticks
	DamagePerTick float64         `json:"damagePerTick"` // for DOTs
	SlowFraction float64          `json:"slowFraction"`  // for slow (0.0-1.0)
	KnockbackX   float64          `json:"knockbackX"`    // knockback direction
	KnockbackY   float64          `json:"knockbackY"`
}

// WeaponDamageEvent is emitted when a weapon deals damage.
type WeaponDamageEvent struct {
	AttackerID   string     `json:"attackerId"`
	TargetID     string     `json:"targetId"`
	WeaponType   WeaponType `json:"weaponType"`
	Damage       float64    `json:"damage"`
	IsCritical   bool       `json:"isCritical"`
	IsDOT        bool       `json:"isDot"`
	IsLifesteal  bool       `json:"isLifesteal"`
	HealAmount   float64    `json:"healAmount,omitempty"`
	TargetX      float64    `json:"targetX"`
	TargetY      float64    `json:"targetY"`
}
