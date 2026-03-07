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

// ARMinibossType enumerates miniboss kinds.
type ARMinibossType string

const (
	ARMinibossGolem      ARMinibossType = "golem"
	ARMinibossWraith     ARMinibossType = "wraith"
	ARMinibossDragonWhelp ARMinibossType = "dragon_whelp"
	ARMinibossLichKing   ARMinibossType = "lich_king"
	ARMinibossTheArena   ARMinibossType = "the_arena"
)

// AREliteAffix enumerates elite modifier types.
type AREliteAffix string

const (
	AREliteArmored   AREliteAffix = "armored"   // +50% defense
	AREliteSwift     AREliteAffix = "swift"      // speed ×2
	AREliteVampiric  AREliteAffix = "vampiric"   // lifesteal on attack
	AREliteExplosive AREliteAffix = "explosive"  // explodes on death
	AREliteShielded  AREliteAffix = "shielded"   // blocks 1 hit per 3s
)

// ARSynergyID identifies a synergy combination.
type ARSynergyID string

const (
	ARSynergyInfernal    ARSynergyID = "infernal"
	ARSynergyBlizzard    ARSynergyID = "blizzard"
	ARSynergyThunderGod  ARSynergyID = "thunder_god"
	ARSynergyPlagueDoc   ARSynergyID = "plague_doctor"
	ARSynergyJuggernaut  ARSynergyID = "juggernaut"
	ARSynergyGlassCannon ARSynergyID = "glass_cannon_syn"
	ARSynergySpeedDemon  ARSynergyID = "speed_demon"
	ARSynergyHolyTrinity ARSynergyID = "holy_trinity"
	ARSynergyVampireLord ARSynergyID = "vampire_lord"
	ARSynergyFortress    ARSynergyID = "fortress"
)

// ARTerrainTheme represents the 6 national terrain themes.
type ARTerrainTheme string

const (
	ARTerrainUrban    ARTerrainTheme = "urban"
	ARTerrainDesert   ARTerrainTheme = "desert"
	ARTerrainMountain ARTerrainTheme = "mountain"
	ARTerrainForest   ARTerrainTheme = "forest"
	ARTerrainArctic   ARTerrainTheme = "arctic"
	ARTerrainIsland   ARTerrainTheme = "island"
)

// Evolved weapon IDs are defined as ARWeaponID constants (see weapon ID constants above).

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
	Tomes       map[ARTomeID]int   `json:"tomes"`
	WeaponSlots []string           `json:"weapons"` // weapon IDs (max 6)
	Weapons     []*ARWeaponInstance `json:"-"`        // equipped weapon instances with cooldowns
	Equipment   []ARItemID         `json:"equipment"` // equipped items (max 3)

	// Movement state (server-only)
	Grounded      bool    `json:"-"`
	Stamina       float64 `json:"-"`
	MaxStamina    float64 `json:"-"`
	SlideCooldown float64 `json:"-"`

	// Level-up pending
	PendingLevelUp bool          `json:"-"`
	LevelUpChoices []ARTomeOffer `json:"-"`

	// Combat stats (computed from tomes)
	DamageMult      float64 `json:"-"`
	AttackSpeedMult float64 `json:"-"`
	CritChance      float64 `json:"-"`
	CritDamageMult  float64 `json:"-"`
	AreaMult        float64 `json:"-"`
	SpeedMult       float64 `json:"-"`
	DodgeChance     float64 `json:"-"`
	MagnetRange     float64 `json:"-"`
	XPMult          float64 `json:"-"`
	ProjectileExtra int     `json:"-"` // extra projectiles from Projectile tome
	PierceExtra     int     `json:"-"` // extra pierce from Projectile tome
	KnockbackMult   float64 `json:"-"`
	ThornsPct       float64 `json:"-"` // thorns reflection percentage
	LifestealPct    float64 `json:"-"` // from Vampire Ring etc.

	// Status effects on this player
	StatusEffects []ARStatusInstance `json:"-"`

	// Shield tome cooldown
	ShieldCooldown float64 `json:"-"` // seconds until next shield charge

	// Temporary buffs
	SpeedBoostTimer float64 `json:"-"` // speed boost remaining seconds
	ShieldBurstTimer float64 `json:"-"` // invincibility remaining seconds

	// Grace period
	GraceTicks int `json:"-"`

	// Kill tracking
	Kills int `json:"kills"`

	// Character passive timers (Phase 3)
	GuardianDefTimer float64 `json:"-"` // Guardian: defense buff remaining seconds
	StealthTimer     float64 `json:"-"` // Shadow: stealth remaining seconds

	// Active synergies (Phase 3)
	ActiveSynergies []ARSynergyID `json:"synergies,omitempty"`

	// PvP state (Phase 5)
	PvPKills    int     `json:"pvpKills,omitempty"`   // PvP-specific kill count
	PvPCCResist float64 `json:"-"`                     // CC resistance accumulation (0.0~0.9)
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
	Defense  float64     `json:"-"` // damage reduction
	Alive    bool        `json:"alive"`
	IsElite  bool        `json:"isElite"`
	TargetID string      `json:"-"` // which player it targets

	// Status effects applied to this enemy
	StatusEffects []ARStatusInstance `json:"-"`

	// Damage type affinity (for elemental weakness/resistance)
	DamageAffinity ARDamageType `json:"-"`

	// Miniboss fields (Phase 3)
	IsMiniboss   bool           `json:"isMiniboss,omitempty"`
	MinibossType ARMinibossType `json:"minibossType,omitempty"`

	// Elite affix (Phase 3)
	EliteAffix       AREliteAffix `json:"eliteAffix,omitempty"`
	EliteShieldTimer float64      `json:"-"` // shielded affix cooldown
}

// ============================================================
// Weapon Types
// ============================================================

// ARWeaponID identifies a weapon.
type ARWeaponID string

const (
	ARWeaponSniperRifle   ARWeaponID = "sniper_rifle"
	ARWeaponLightningStaff ARWeaponID = "lightning_staff"
	ARWeaponBow           ARWeaponID = "bow"
	ARWeaponRevolver      ARWeaponID = "revolver"
	ARWeaponKatana        ARWeaponID = "katana"
	ARWeaponFireStaff     ARWeaponID = "fire_staff"
	ARWeaponAegis         ARWeaponID = "aegis"
	ARWeaponWirelessDagger ARWeaponID = "wireless_dagger"
	ARWeaponBlackHole     ARWeaponID = "black_hole"
	ARWeaponAxe           ARWeaponID = "axe"
	ARWeaponFrostwalker   ARWeaponID = "frostwalker"
	ARWeaponFlamewalker   ARWeaponID = "flamewalker"
	ARWeaponPoisonFlask   ARWeaponID = "poison_flask"
	ARWeaponLandmine      ARWeaponID = "landmine"
	ARWeaponShotgun       ARWeaponID = "shotgun"
	ARWeaponDice          ARWeaponID = "dice"

	// Evolved weapons (Phase 3)
	ARWeaponStormBow     ARWeaponID = "storm_bow"
	ARWeaponDexecutioner ARWeaponID = "dexecutioner"
	ARWeaponInferno      ARWeaponID = "inferno"
	ARWeaponDragonBreath ARWeaponID = "dragon_breath"
	ARWeaponPandemic     ARWeaponID = "pandemic"
)

// ARWeaponTier classifies weapon power level.
type ARWeaponTier string

const (
	ARWeaponTierS ARWeaponTier = "S"
	ARWeaponTierA ARWeaponTier = "A"
	ARWeaponTierB ARWeaponTier = "B"
)

// ARProjectileType enumerates projectile movement patterns.
type ARProjectileType string

const (
	ARProjStraight ARProjectileType = "straight" // linear movement
	ARProjHoming   ARProjectileType = "homing"   // tracks target
	ARProjPierce   ARProjectileType = "pierce"   // passes through enemies
	ARProjAOE      ARProjectileType = "aoe"      // area of effect explosion
)

// ARAttackPattern defines how a weapon attacks.
type ARAttackPattern string

const (
	ARPatternMelee     ARAttackPattern = "melee"      // close-range cone
	ARPatternRangedSingle ARAttackPattern = "ranged_single" // single projectile
	ARPatternRangedChain ARAttackPattern = "ranged_chain"  // chains between targets
	ARPatternRangedAOE  ARAttackPattern = "ranged_aoe"    // AOE blast
	ARPatternTrail      ARAttackPattern = "trail"         // movement-based trail damage
	ARPatternPlaced     ARAttackPattern = "placed"        // placed on ground
	ARPatternScatter    ARAttackPattern = "scatter"       // multiple spread shots
	ARPatternRandom     ARAttackPattern = "random"        // random effect each shot
)

// ARWeaponDef is the static definition of a weapon.
type ARWeaponDef struct {
	ID          ARWeaponID      `json:"id"`
	Name        string          `json:"name"`
	Tier        ARWeaponTier    `json:"tier"`
	DamageType  ARDamageType    `json:"damageType"`
	BaseDamage  float64         `json:"baseDamage"`
	BaseRange   float64         `json:"baseRange"`   // meters
	BaseCooldown float64        `json:"baseCooldown"` // seconds between attacks
	Pattern     ARAttackPattern `json:"pattern"`
	ProjType    ARProjectileType `json:"projType"`
	ProjSpeed   float64         `json:"projSpeed"`   // m/s (0 = instant/melee)
	PierceCount int             `json:"pierceCount"` // how many enemies to pierce
	AOERadius   float64         `json:"aoeRadius"`   // AOE explosion radius
	StatusApply ARStatusEffect  `json:"statusApply"` // status effect on hit ("" = none)
	StatusChance float64        `json:"statusChance"` // 0-100 chance to apply status
	ChainCount  int             `json:"chainCount"`  // for chain weapons
	Description string          `json:"desc"`
}

// ARWeaponInstance is a player's equipped weapon with level.
type ARWeaponInstance struct {
	WeaponID   ARWeaponID `json:"weaponId"`
	Level      int        `json:"level"`   // 1-7
	Cooldown   float64    `json:"-"`        // current cooldown remaining
}

// ============================================================
// Projectile Entity
// ============================================================

// ARProjectile is a live projectile in the arena.
type ARProjectile struct {
	ID        string           `json:"id"`
	OwnerID   string           `json:"-"`         // player who fired
	WeaponID  ARWeaponID       `json:"-"`
	Pos       ARVec3           `json:"pos"`
	Vel       ARVec3           `json:"-"`
	DmgType   ARDamageType     `json:"-"`
	Damage    float64          `json:"-"`
	ProjType  ARProjectileType `json:"-"`
	Speed     float64          `json:"-"`
	Range     float64          `json:"-"`         // max travel distance
	Traveled  float64          `json:"-"`
	PierceLeft int             `json:"-"`
	AOERadius float64          `json:"-"`
	TargetID  string           `json:"-"`         // for homing
	StatusFX  ARStatusEffect   `json:"-"`
	StatusPct float64          `json:"-"`         // chance 0-100
	Alive     bool             `json:"-"`
	HitIDs    map[string]bool  `json:"-"`         // already-hit enemies (for pierce)
}

// ARProjectileNet is the network representation of a projectile.
type ARProjectileNet struct {
	ID   string  `json:"id"`
	X    float64 `json:"x"`
	Z    float64 `json:"z"`
	Type string  `json:"type"` // weapon ID for visual selection
}

// ============================================================
// Status Effect Instance
// ============================================================

// ARStatusInstance is an active status effect on an entity.
type ARStatusInstance struct {
	Effect    ARStatusEffect `json:"effect"`
	Remaining float64        `json:"remaining"` // seconds left
	Stacks    int            `json:"stacks"`
	SourceID  string         `json:"-"` // who applied it
}

// ============================================================
// Item Types
// ============================================================

// ARItemID identifies an item type.
type ARItemID string

const (
	// Instant-use items
	ARItemHealthOrbSmall ARItemID = "health_orb_small"
	ARItemHealthOrbLarge ARItemID = "health_orb_large"
	ARItemXPMagnet       ARItemID = "xp_magnet"
	ARItemSpeedBoost     ARItemID = "speed_boost"
	ARItemShieldBurst    ARItemID = "shield_burst"
	ARItemBomb           ARItemID = "bomb"

	// Equipment items
	ARItemIronBoots    ARItemID = "iron_boots"
	ARItemFeatherCape  ARItemID = "feather_cape"
	ARItemVampireRing  ARItemID = "vampire_ring"
	ARItemBerserkerHelm ARItemID = "berserker_helm"
	ARItemCrownOfThorns ARItemID = "crown_of_thorns"
	ARItemMagnetAmulet ARItemID = "magnet_amulet"
	ARItemGlassCannon  ARItemID = "glass_cannon"
	ARItemFrozenHeart  ARItemID = "frozen_heart"
	ARItemLuckyClover  ARItemID = "lucky_clover"
	ARItemTitanBelt    ARItemID = "titan_belt"
)

// ARItemCategory distinguishes instant vs equipment items.
type ARItemCategory string

const (
	ARItemCatInstant   ARItemCategory = "instant"
	ARItemCatEquipment ARItemCategory = "equipment"
)

// ARItemDef is the static definition of a droppable item.
type ARItemDef struct {
	ID       ARItemID       `json:"id"`
	Name     string         `json:"name"`
	Category ARItemCategory `json:"category"`
	Rarity   ARRarity       `json:"rarity"`
	Desc     string         `json:"desc"`
}

// ARFieldItem is a dropped item on the ground.
type ARFieldItem struct {
	ID     string   `json:"id"`
	ItemID ARItemID `json:"itemId"`
	Pos    ARVec3   `json:"pos"`
	Alive  bool     `json:"-"`
}

// ARFieldItemNet is the network representation of a field item.
type ARFieldItemNet struct {
	ID     string   `json:"id"`
	ItemID ARItemID `json:"itemId"`
	X      float64  `json:"x"`
	Z      float64  `json:"z"`
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
	Phase         ARPhase                `json:"phase"`
	Timer         float64                `json:"timer"` // seconds remaining in current phase
	WaveNumber    int                    `json:"wave"`
	Terrain       ARTerrainTheme         `json:"terrain,omitempty"`
	Tier          string                 `json:"tier,omitempty"`
	Players       []*ARPlayer            `json:"players"`
	Enemies       []AREnemyNet           `json:"enemies"`
	XPCrystals    []ARCrystalNet         `json:"xpCrystals"`
	Projectiles   []ARProjectileNet      `json:"projectiles"`
	Items         []ARFieldItemNet       `json:"items"`
	PvPRadius     float64                `json:"pvpRadius,omitempty"`     // Phase 5: current shrunk PvP arena radius
	FactionScores []ARFactionPvPScoreNet `json:"factionScores,omitempty"` // Phase 5: faction PvP scores
}

// ARFactionPvPScoreNet is the network representation of faction PvP scores.
type ARFactionPvPScoreNet struct {
	FactionID string `json:"factionId"`
	PvPKills  int    `json:"pvpKills"`
	Score     int    `json:"score"`
}

// ARDamageEvent is sent to clients for damage number rendering.
type ARDamageEvent struct {
	TargetID  string       `json:"targetId"`
	Amount    float64      `json:"amount"`
	CritCount int          `json:"critCount"`
	DmgType   ARDamageType `json:"dmgType"`
	StatusFX  string       `json:"statusFx,omitempty"` // status effect applied
	X         float64      `json:"x"`
	Z         float64      `json:"z"`
}

// AREnemyNet is a network-safe enemy representation.
type AREnemyNet struct {
	ID           string         `json:"id"`
	Type         AREnemyType    `json:"type"`
	X            float64        `json:"x"`
	Z            float64        `json:"z"`
	HP           float64        `json:"hp"`
	MaxHP        float64        `json:"maxHp"`
	IsElite      bool           `json:"isElite"`
	IsMiniboss   bool           `json:"isMiniboss,omitempty"`
	MinibossType ARMinibossType `json:"minibossType,omitempty"`
	EliteAffix   AREliteAffix   `json:"eliteAffix,omitempty"`
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
