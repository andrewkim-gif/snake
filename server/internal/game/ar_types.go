package game

import "math"

// ============================================================
// Arena Combat Type Definitions (v18)
// ============================================================

// ARPhase represents the current phase of an Arena battle.
type ARPhase string

const (
	ARPhaseDeploy     ARPhase = "deploy"      // 10s grace period
	ARPhasePvE        ARPhase = "pve"          // Main PvE auto-combat
	ARPhasePvPWarning ARPhase = "pvp_warning"  // 10s warning before PvP
	ARPhasePvP        ARPhase = "pvp"          // 60s faction PvP
	ARPhaseSettlement ARPhase = "settlement"   // 10s sovereignty judgement
)

// ARDamageType represents elemental damage categories.
type ARDamageType string

const (
	ARDmgPhysical  ARDamageType = "physical"
	ARDmgFire      ARDamageType = "fire"
	ARDmgFrost     ARDamageType = "frost"
	ARDmgLightning ARDamageType = "lightning"
	ARDmgPoison    ARDamageType = "poison"
)

// ARStatusEffect represents status effect types.
type ARStatusEffect string

const (
	ARStatusBurn   ARStatusEffect = "burn"
	ARStatusFreeze ARStatusEffect = "freeze"
	ARStatusShock  ARStatusEffect = "shock"
	ARStatusPoison ARStatusEffect = "poison"
	ARStatusBleed  ARStatusEffect = "bleed"
	ARStatusMark   ARStatusEffect = "mark"
)

// ARCharacterType represents playable character archetypes.
type ARCharacterType string

const (
	ARCharStriker   ARCharacterType = "striker"
	ARCharGuardian  ARCharacterType = "guardian"
	ARCharPyro      ARCharacterType = "pyro"
	ARCharFrostMage ARCharacterType = "frost_mage"
	ARCharSniper    ARCharacterType = "sniper"
	ARCharGambler   ARCharacterType = "gambler"
	ARCharBerserker ARCharacterType = "berserker"
	ARCharShadow    ARCharacterType = "shadow"
)

// ARTomeID identifies a passive tome.
type ARTomeID string

const (
	ARTomeDamage      ARTomeID = "damage"
	ARTomeAttackSpeed ARTomeID = "attack_speed"
	ARTomeCritChance  ARTomeID = "crit_chance"
	ARTomeCritDamage  ARTomeID = "crit_damage"
	ARTomeArea        ARTomeID = "area"
	ARTomeProjectile  ARTomeID = "projectile"
	ARTomeSpeed       ARTomeID = "speed"
	ARTomeHP          ARTomeID = "hp"
	ARTomeShield      ARTomeID = "shield"
	ARTomeThorns      ARTomeID = "thorns"
	ARTomeKnockback   ARTomeID = "knockback"
	ARTomeXP          ARTomeID = "xp"
	ARTomeLuck        ARTomeID = "luck"
	ARTomeMagnet      ARTomeID = "magnet"
	ARTomeDodge       ARTomeID = "dodge"
	ARTomeCursed      ARTomeID = "cursed"
)

// ARRarity represents item/tome rarity tiers.
type ARRarity string

const (
	ARRarityCommon    ARRarity = "common"
	ARRarityUncommon  ARRarity = "uncommon"
	ARRarityRare      ARRarity = "rare"
	ARRarityEpic      ARRarity = "epic"
	ARRarityLegendary ARRarity = "legendary"
)

// AREnemyType enumerates PvE enemy kinds.
type AREnemyType string

const (
	AREnemyZombie   AREnemyType = "zombie"
	AREnemySkeleton AREnemyType = "skeleton"
	AREnemySlime    AREnemyType = "slime"
	AREnemySpider   AREnemyType = "spider"
	AREnemyCreeper  AREnemyType = "creeper"
)

// ============================================================
// Entity Structs
// ============================================================

// ARVec3 is a simple 3D vector.
type ARVec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// DistTo returns the distance between two vectors (XZ plane).
func (v ARVec3) DistTo(other ARVec3) float64 {
	dx := v.X - other.X
	dz := v.Z - other.Z
	return math.Sqrt(dx*dx + dz*dz)
}

// ARInput is the player input received each frame.
type ARInput struct {
	DirX  float64 `json:"dirX"`  // -1..1
	DirZ  float64 `json:"dirZ"`  // -1..1
	Jump  bool    `json:"jump"`
	Slide bool    `json:"slide"`
	AimY  float64 `json:"aimY"` // camera yaw (radians)
}

// ARChoice is the player's tome/weapon selection during level-up.
type ARChoice struct {
	TomeID   string `json:"tomeId,omitempty"`
	WeaponID string `json:"weaponId,omitempty"`
}

// ARPlayer represents a player entity in the arena.
type ARPlayer struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Pos       ARVec3          `json:"pos"`
	Vel       ARVec3          `json:"-"` // server-only velocity
	Rotation  float64         `json:"rot"`
	HP        float64         `json:"hp"`
	MaxHP     float64         `json:"maxHp"`
	Level     int             `json:"level"`
	XP        float64         `json:"xp"`
	XPToNext  float64         `json:"xpToNext"`
	Alive     bool            `json:"alive"`
	Character ARCharacterType `json:"character"`
	FactionID string          `json:"factionId"`

	// Build state
	Tomes       map[ARTomeID]int `json:"tomes"`
	WeaponSlots []string         `json:"weapons"` // weapon IDs (max 6)

	// Movement state (server-only)
	Grounded    bool    `json:"-"`
	Stamina     float64 `json:"-"`
	MaxStamina  float64 `json:"-"`
	SlideCooldown float64 `json:"-"`

	// Level-up pending
	PendingLevelUp bool          `json:"-"`
	LevelUpChoices []ARTomeOffer `json:"-"`

	// Combat stats (computed from tomes)
	DamageMult    float64 `json:"-"`
	AttackSpeedMult float64 `json:"-"`
	CritChance    float64 `json:"-"`
	CritDamageMult float64 `json:"-"`
	AreaMult      float64 `json:"-"`
	SpeedMult     float64 `json:"-"`
	DodgeChance   float64 `json:"-"`
	MagnetRange   float64 `json:"-"`
	XPMult        float64 `json:"-"`

	// Grace period
	GraceTicks int `json:"-"`

	// Kill tracking
	Kills int `json:"kills"`
}

// ARTomeOffer is a single tome option presented during level-up.
type ARTomeOffer struct {
	TomeID ARTomeID `json:"tomeId"`
	Rarity ARRarity `json:"rarity"`
	Stacks int      `json:"stacks"` // how many stacks this adds
}

// AREnemy represents a PvE enemy.
type AREnemy struct {
	ID       string      `json:"id"`
	Type     AREnemyType `json:"type"`
	Pos      ARVec3      `json:"pos"`
	Vel      ARVec3      `json:"-"`
	HP       float64     `json:"hp"`
	MaxHP    float64     `json:"maxHp"`
	Damage   float64     `json:"-"`
	Speed    float64     `json:"-"`
	Alive    bool        `json:"alive"`
	IsElite  bool        `json:"isElite"`
	TargetID string      `json:"-"` // which player it targets
}

// ARXPCrystal is an XP drop on the ground.
type ARXPCrystal struct {
	ID    string  `json:"id"`
	Pos   ARVec3  `json:"pos"`
	Value float64 `json:"value"`
	Alive bool    `json:"-"`
}

// ============================================================
// State Snapshot (broadcast to clients)
// ============================================================

// ARState is the full game state sent to clients at 20Hz.
type ARState struct {
	Phase      ARPhase       `json:"phase"`
	Timer      float64       `json:"timer"` // seconds remaining in current phase
	WaveNumber int           `json:"wave"`
	Players    []*ARPlayer   `json:"players"`
	Enemies    []AREnemyNet  `json:"enemies"`
	XPCrystals []ARCrystalNet `json:"xpCrystals"`
}

// AREnemyNet is a network-safe enemy representation.
type AREnemyNet struct {
	ID      string      `json:"id"`
	Type    AREnemyType `json:"type"`
	X       float64     `json:"x"`
	Z       float64     `json:"z"`
	HP      float64     `json:"hp"`
	MaxHP   float64     `json:"maxHp"`
	IsElite bool        `json:"isElite"`
}

// ARCrystalNet is a network-safe XP crystal representation.
type ARCrystalNet struct {
	ID    string  `json:"id"`
	X     float64 `json:"x"`
	Z     float64 `json:"z"`
	Value float64 `json:"value"`
}

// ============================================================
// Arena Combat Constants
// ============================================================

const (
	// Standard battle duration phases (seconds)
	ARDeployDuration     = 10.0
	ARPvEDuration        = 210.0 // 3min 30s
	ARPvPWarningDuration = 10.0
	ARPvPDuration        = 60.0
	ARSettlementDuration = 10.0

	// Player defaults
	ARBaseHP          = 100.0
	ARBaseSpeed       = 5.0  // m/s walk
	ARSprintSpeed     = 8.0  // m/s sprint
	ARSlideSpeed      = 12.0 // m/s slide
	ARBaseStamina     = 100.0
	ARStaminaDrain    = 50.0 // per second while sprinting
	ARStaminaRecovery = 20.0 // per second while not sprinting
	ARSlideCost       = 30.0
	ARSlideCooldownSec = 3.0
	ARGracePeriodSec   = 10.0 // deploy phase grace

	// XP
	ARBaseXPToLevel  = 50.0
	ARXPPerLevel     = 30.0  // additional XP needed per level
	ARXPMagnetBase   = 2.0   // base magnet range (meters)
	ARXPMagnetPerTome = 1.0  // additional range per Magnet tome stack

	// Auto-attack
	ARBaseAttackRange  = 3.0  // meters (melee default)
	ARBaseAttackDamage = 10.0
	ARBaseAttackSpeed  = 1.0  // attacks per second

	// Wave spawning
	ARWaveInterval     = 3.0  // seconds between waves
	ARBaseEnemiesPerWave = 10
	AREnemySpawnRadius   = 25.0 // meters from arena center

	// Arena
	ARDefaultArenaRadius = 50.0 // meters
)

// ARBaseEnemyStats returns base stats for an enemy type.
func ARBaseEnemyStats(t AREnemyType) (hp, dmg, spd float64) {
	switch t {
	case AREnemyZombie:
		return 100, 10, 2.0
	case AREnemySkeleton:
		return 80, 15, 3.0
	case AREnemySlime:
		return 150, 8, 1.5
	case AREnemySpider:
		return 60, 12, 5.0
	case AREnemyCreeper:
		return 120, 80, 2.5
	default:
		return 100, 10, 2.0
	}
}
