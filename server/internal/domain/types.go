package domain

// Position represents a 2D coordinate in the arena.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BodyColor — MC wool 12-color palette.
type BodyColor string

const (
	ColorWhite    BodyColor = "white"
	ColorLightGray BodyColor = "light_gray"
	ColorGray     BodyColor = "gray"
	ColorBlack    BodyColor = "black"
	ColorRed      BodyColor = "red"
	ColorOrange   BodyColor = "orange"
	ColorYellow   BodyColor = "yellow"
	ColorGreen    BodyColor = "green"
	ColorCyan     BodyColor = "cyan"
	ColorBlue     BodyColor = "blue"
	ColorPurple   BodyColor = "purple"
	ColorBrown    BodyColor = "brown"
)

// SkinRarity defines cosmetic rarity tiers.
type SkinRarity string

const (
	RarityCommon    SkinRarity = "common"
	RarityUncommon  SkinRarity = "uncommon"
	RarityRare      SkinRarity = "rare"
	RarityEpic      SkinRarity = "epic"
	RarityLegendary SkinRarity = "legendary"
	RarityMythic    SkinRarity = "mythic"
)

// SkinTone — 15 skin tone options.
type SkinTone string

const (
	SkinTonePale        SkinTone = "pale"
	SkinToneLight       SkinTone = "light"
	SkinToneFair        SkinTone = "fair"
	SkinToneMediumLight SkinTone = "medium_light"
	SkinToneMedium      SkinTone = "medium"
	SkinToneOlive       SkinTone = "olive"
	SkinToneTan         SkinTone = "tan"
	SkinToneBrown       SkinTone = "brown"
	SkinToneDarkBrown   SkinTone = "dark_brown"
	SkinToneDeep        SkinTone = "deep"
	SkinToneWarmBeige   SkinTone = "warm_beige"
	SkinToneCoolPink    SkinTone = "cool_pink"
	SkinToneGolden      SkinTone = "golden"
	SkinToneAshen       SkinTone = "ashen"
	SkinToneOtherworldly SkinTone = "otherworldly"
)

// SurfacePattern — 8 body pattern types.
type SurfacePattern string

const (
	PatternSolid     SurfacePattern = "solid"
	PatternStriped   SurfacePattern = "striped"
	PatternCheckered SurfacePattern = "checkered"
	PatternDotted    SurfacePattern = "dotted"
	PatternMarble    SurfacePattern = "marble"
	PatternScales    SurfacePattern = "scales"
	PatternCamo      SurfacePattern = "camo"
	PatternGradient  SurfacePattern = "gradient"
)

// EyeStyle — 8 eye style options.
type EyeStyle string

const (
	EyeDefault  EyeStyle = "default"
	EyeCute     EyeStyle = "cute"
	EyeAngry    EyeStyle = "angry"
	EyeCool     EyeStyle = "cool"
	EyeWink     EyeStyle = "wink"
	EyeDot      EyeStyle = "dot"
	EyeVisor    EyeStyle = "visor"
	EyeEnderman EyeStyle = "enderman"
)

// MouthStyle — 6 mouth style options.
type MouthStyle string

const (
	MouthSmile      MouthStyle = "smile"
	MouthNeutral    MouthStyle = "neutral"
	MouthDetermined MouthStyle = "determined"
	MouthOpen       MouthStyle = "open"
	MouthFangs      MouthStyle = "fangs"
	MouthNone       MouthStyle = "none"
)

// FaceMarkings — MC mob-themed face markings.
type FaceMarkings string

const (
	MarkingsNone          FaceMarkings = "none"
	MarkingsBlazeStripes  FaceMarkings = "blaze_stripes"
	MarkingsSkeletonFace  FaceMarkings = "skeleton_face"
	MarkingsCreeperFace   FaceMarkings = "creeper_face"
	MarkingsEndermanEyes  FaceMarkings = "enderman_eyes"
	MarkingsWitherScars   FaceMarkings = "wither_scars"
	MarkingsPiglinSnout   FaceMarkings = "piglin_snout"
	MarkingsGuardianSpikes FaceMarkings = "guardian_spikes"
)

// HeadwearType — 16 headwear options.
type HeadwearType string

const (
	HeadwearNone           HeadwearType = "none"
	HeadwearHelmetIron     HeadwearType = "helmet_iron"
	HeadwearHelmetGold     HeadwearType = "helmet_gold"
	HeadwearHelmetDiamond  HeadwearType = "helmet_diamond"
	HeadwearHelmetNetherite HeadwearType = "helmet_netherite"
	HeadwearCrown          HeadwearType = "crown"
	HeadwearTophat         HeadwearType = "tophat"
	HeadwearWizardHat      HeadwearType = "wizard_hat"
	HeadwearHeadband       HeadwearType = "headband"
	HeadwearAntenna        HeadwearType = "antenna"
	HeadwearPumpkin        HeadwearType = "pumpkin"
	HeadwearFlowerCrown    HeadwearType = "flower_crown"
	HeadwearStrawHat       HeadwearType = "straw_hat"
	HeadwearViking         HeadwearType = "viking"
	HeadwearSanta          HeadwearType = "santa"
	HeadwearGraduation     HeadwearType = "graduation"
)

// BackItemType — 14 back item options.
type BackItemType string

const (
	BackNone            BackItemType = "none"
	BackCapeRed         BackItemType = "cape_red"
	BackCapeBlue        BackItemType = "cape_blue"
	BackCapePurple      BackItemType = "cape_purple"
	BackCapeGold        BackItemType = "cape_gold"
	BackWingsAngel      BackItemType = "wings_angel"
	BackWingsBat        BackItemType = "wings_bat"
	BackWingsElytra     BackItemType = "wings_elytra"
	BackWingsButterfly  BackItemType = "wings_butterfly"
	BackWingsEnder      BackItemType = "wings_ender"
	BackWingsPhoenix    BackItemType = "wings_phoenix"
	BackBackpack        BackItemType = "backpack"
	BackQuiver          BackItemType = "quiver"
	BackJetpack         BackItemType = "jetpack"
)

// BodyOverlayType — 17 body overlay / costume options.
type BodyOverlayType string

const (
	OverlayNone           BodyOverlayType = "none"
	OverlayKnightArmor    BodyOverlayType = "knight_armor"
	OverlayPirateCoat     BodyOverlayType = "pirate_coat"
	OverlayNinjaSuit      BodyOverlayType = "ninja_suit"
	OverlayAstronautSuit  BodyOverlayType = "astronaut_suit"
	OverlayChefApron      BodyOverlayType = "chef_apron"
	OverlayScientistCoat  BodyOverlayType = "scientist_coat"
	OverlayWizardRobe     BodyOverlayType = "wizard_robe"
	OverlaySamuraiArmor   BodyOverlayType = "samurai_armor"
	OverlayHoodie         BodyOverlayType = "hoodie"
	OverlayTuxedo         BodyOverlayType = "tuxedo"
	OverlayCreeperHoodie  BodyOverlayType = "creeper_hoodie"
	OverlayEndermanSuit   BodyOverlayType = "enderman_suit"
	OverlayBlazeArmor     BodyOverlayType = "blaze_armor"
	OverlayWitherCloak    BodyOverlayType = "wither_cloak"
	OverlayDiamondArmor   BodyOverlayType = "diamond_armor"
	OverlayNetheriteArmor BodyOverlayType = "netherite_armor"
)

// AccessoryType — 10 accessory options.
type AccessoryType string

const (
	AccessoryNone        AccessoryType = "none"
	AccessoryScarf       AccessoryType = "scarf"
	AccessoryNecklace    AccessoryType = "necklace"
	AccessoryGoggles     AccessoryType = "goggles"
	AccessoryMaskCreeper AccessoryType = "mask_creeper"
	AccessoryMaskPumpkin AccessoryType = "mask_pumpkin"
	AccessoryMonocle     AccessoryType = "monocle"
	AccessoryBandana     AccessoryType = "bandana"
	AccessoryFlowerPin   AccessoryType = "flower_pin"
	AccessoryEarring     AccessoryType = "earring"
)

// HandItemType — 10 hand item options.
type HandItemType string

const (
	HandNone           HandItemType = "none"
	HandSwordDiamond   HandItemType = "sword_diamond"
	HandPickaxeIron    HandItemType = "pickaxe_iron"
	HandTorch          HandItemType = "torch"
	HandShieldIron     HandItemType = "shield_iron"
	HandEnchantedBook  HandItemType = "enchanted_book"
	HandFishingRod     HandItemType = "fishing_rod"
	HandBow            HandItemType = "bow"
	HandTrident        HandItemType = "trident"
	HandTotemOfUndying HandItemType = "totem_of_undying"
)

// FootwearType — 8 footwear options.
type FootwearType string

const (
	FootwearNone           FootwearType = "none"
	FootwearBootsIron      FootwearType = "boots_iron"
	FootwearBootsGold      FootwearType = "boots_gold"
	FootwearBootsDiamond   FootwearType = "boots_diamond"
	FootwearBootsNetherite FootwearType = "boots_netherite"
	FootwearSneakers       FootwearType = "sneakers"
	FootwearSandals        FootwearType = "sandals"
	FootwearRollerSkates   FootwearType = "roller_skates"
)

// TrailEffect — 8 trail effects.
type TrailEffect string

const (
	TrailNone            TrailEffect = "none"
	TrailSparkle         TrailEffect = "sparkle"
	TrailSmoke           TrailEffect = "smoke"
	TrailHearts          TrailEffect = "hearts"
	TrailFire            TrailEffect = "fire"
	TrailIceCrystals     TrailEffect = "ice_crystals"
	TrailEnderParticles  TrailEffect = "ender_particles"
	TrailRedstoneDust    TrailEffect = "redstone_dust"
)

// DeathEffect — 6 death effects.
type DeathEffect string

const (
	DeathEffectNone      DeathEffect = "none"
	DeathEffectExplosion DeathEffect = "explosion"
	DeathEffectPoof      DeathEffect = "poof"
	DeathEffectShatter   DeathEffect = "shatter"
	DeathEffectDissolve  DeathEffect = "dissolve"
	DeathEffectFirework  DeathEffect = "firework"
)

// KillEffect — 6 kill effects.
type KillEffect string

const (
	KillEffectNone           KillEffect = "none"
	KillEffectLightningStrike KillEffect = "lightning_strike"
	KillEffectConfetti       KillEffect = "confetti"
	KillEffectSkullPopup     KillEffect = "skull_popup"
	KillEffectGoldBurst      KillEffect = "gold_burst"
	KillEffectEnderFlash     KillEffect = "ender_flash"
)

// SpawnEffect — 8 spawn effects.
type SpawnEffect string

const (
	SpawnEffectNone           SpawnEffect = "none"
	SpawnEffectBeamDown       SpawnEffect = "beam_down"
	SpawnEffectPortalEmerge   SpawnEffect = "portal_emerge"
	SpawnEffectBlockBuild     SpawnEffect = "block_build"
	SpawnEffectNetherGate     SpawnEffect = "nether_gate"
	SpawnEffectLightningStrike SpawnEffect = "lightning_strike"
	SpawnEffectSoulFire       SpawnEffect = "soul_fire"
	SpawnEffectEnderTeleport  SpawnEffect = "ender_teleport"
)

// EmoteType — 8 emote types.
type EmoteType string

const (
	EmoteNone  EmoteType = "none"
	EmoteWave  EmoteType = "wave"
	EmoteDance EmoteType = "dance"
	EmoteTaunt EmoteType = "taunt"
	EmoteClap  EmoteType = "clap"
	EmoteBow   EmoteType = "bow"
	EmoteSpin  EmoteType = "spin"
	EmoteFlex  EmoteType = "flex"
)

// NametagStyle — 6 nametag style options.
type NametagStyle string

const (
	NametagDefault       NametagStyle = "default"
	NametagGoldOutline   NametagStyle = "gold_outline"
	NametagEnchantedGlow NametagStyle = "enchanted_glow"
	NametagFireText      NametagStyle = "fire_text"
	NametagIceText       NametagStyle = "ice_text"
	NametagRainbowCycle  NametagStyle = "rainbow_cycle"
)

// AgentSkin represents the full 5-tier MC-style character customization.
type AgentSkin struct {
	ID     int        `json:"id"`
	Name   string     `json:"name"`
	Rarity SkinRarity `json:"rarity"`

	// Tier 1: Base
	BodyType string   `json:"bodyType"` // "standard" | "slim"
	BodySize string   `json:"bodySize"` // "small" | "medium" | "large"
	SkinTone SkinTone `json:"skinTone"`

	// Tier 2: Colors & Surface
	BodyColor    BodyColor      `json:"bodyColor"`
	LegColor     BodyColor      `json:"legColor"`
	Pattern      SurfacePattern `json:"pattern"`
	PatternColor BodyColor      `json:"patternColor,omitempty"`

	// Tier 3: Face
	EyeStyle  EyeStyle     `json:"eyeStyle"`
	EyeColor  string       `json:"eyeColor,omitempty"`
	MouthStyle MouthStyle  `json:"mouthStyle"`
	Markings  FaceMarkings `json:"markings"`

	// Tier 4: Equipment
	Hat         HeadwearType    `json:"hat"`
	BackItem    BackItemType    `json:"backItem"`
	BodyOverlay BodyOverlayType `json:"bodyOverlay"`
	Accessory   AccessoryType   `json:"accessory"`
	HandItem    HandItemType    `json:"handItem"`
	Footwear    FootwearType    `json:"footwear"`

	// Tier 5: Effects
	AuraColor    string      `json:"auraColor,omitempty"`
	WeaponVisual string      `json:"weaponVisual,omitempty"`
	TrailEffect  TrailEffect `json:"trailEffect"`
	DeathEffect  DeathEffect `json:"deathEffect"`
	KillEffect   KillEffect  `json:"killEffect"`
	SpawnEffect  SpawnEffect `json:"spawnEffect"`
	Emote        EmoteType   `json:"emote"`

	// Tier 6: Nametag
	NametagStyle NametagStyle `json:"nametagStyle"`
	NametagColor string       `json:"nametagColor,omitempty"`
	Title        string       `json:"title,omitempty"`
}

// TomeType identifies a Tome upgrade.
type TomeType string

const (
	TomeXP     TomeType = "xp"
	TomeSpeed  TomeType = "speed"
	TomeDamage TomeType = "damage"
	TomeArmor  TomeType = "armor"
	TomeMagnet TomeType = "magnet"
	TomeLuck   TomeType = "luck"
	TomeRegen  TomeType = "regen"
	TomeCursed TomeType = "cursed"
)

// AbilityType identifies an Ability upgrade.
type AbilityType string

const (
	AbilityVenomAura      AbilityType = "venom_aura"
	AbilityShieldBurst    AbilityType = "shield_burst"
	AbilityLightningStrike AbilityType = "lightning_strike"
	AbilitySpeedDash      AbilityType = "speed_dash"
	AbilityMassDrain      AbilityType = "mass_drain"
	AbilityGravityWell    AbilityType = "gravity_well"
)

// PlayerBuild holds a player's current Tome stacks and Ability slots.
type PlayerBuild struct {
	Tomes        map[TomeType]int       `json:"tomes"`
	AbilitySlots []AbilitySlot          `json:"abilitySlots"`
	MaxAbilities int                    `json:"maxAbilities"`
}

// AbilitySlot represents an equipped ability and its current level.
type AbilitySlot struct {
	Type  AbilityType `json:"type"`
	Level int         `json:"level"` // 1-4
}

// ActiveEffect represents a temporary effect applied to an agent.
type ActiveEffect struct {
	Type     string `json:"type"`
	Duration int    `json:"duration"`   // remaining ticks
	Value    float64 `json:"value"`
}

// EffectCooldown tracks the cooldown of an ability.
type EffectCooldown struct {
	AbilityType AbilityType `json:"abilityType"`
	TicksLeft   int         `json:"ticksLeft"`
}

// ============================================================
// v14 Phase 3: Passive Types (10 passives)
// ============================================================

// PassiveType identifies one of the 10 v14 passive upgrades.
type PassiveType string

const (
	PassiveVigor     PassiveType = "vigor"      // +15% max HP / stack (max 6)
	PassiveSwift     PassiveType = "swift"      // +12% move speed / stack (max 5)
	PassiveFury      PassiveType = "fury"       // +15% damage / stack (max 8)
	PassiveIronSkin  PassiveType = "iron_skin"  // -12% damage taken / stack (max 6)
	PassiveMagnet    PassiveType = "magnet"     // +25% pickup range / stack (max 5)
	PassiveFortune   PassiveType = "fortune"    // +15% rare chance / stack (max 5)
	PassiveVitality  PassiveType = "vitality"   // +2 HP/s regen / stack (max 5)
	PassivePrecision PassiveType = "precision"  // +8% crit chance / stack (max 6)
	PassiveBlast     PassiveType = "blast"      // +15% AOE size / stack (max 5)
	PassiveHaste     PassiveType = "haste"      // -8% cooldown / stack (max 5)
)

// AllPassiveTypes lists all passive types.
var AllPassiveTypes = []PassiveType{
	PassiveVigor, PassiveSwift, PassiveFury, PassiveIronSkin, PassiveMagnet,
	PassiveFortune, PassiveVitality, PassivePrecision, PassiveBlast, PassiveHaste,
}

// ============================================================
// v14 Phase 3: Synergy Types (10 combos)
// ============================================================

// V14SynergyType identifies one of the 10 v14 synergy combos.
type V14SynergyType string

const (
	SynergyThermalShock  V14SynergyType = "thermal_shock"   // FlameRing + FrostShards
	SynergyAssassinsMark V14SynergyType = "assassins_mark"  // ShadowStrike + Precision×3
	SynergyFortress      V14SynergyType = "fortress"        // CrystalShield + IronSkin×3
	SynergyCorruption    V14SynergyType = "corruption"      // SoulDrain + VenomCloud
	SynergyThunderGod    V14SynergyType = "thunder_god"     // ThunderClap + ChainBolt
	SynergyGravityMaster V14SynergyType = "gravity_master"  // GravityBomb + Magnet×3
	SynergyBerserker     V14SynergyType = "berserker_v14"   // Fury×5 + Swift×3
	SynergyIronMaiden    V14SynergyType = "iron_maiden"     // IronSkin×4 + Vigor×3
	SynergyGlassCannon   V14SynergyType = "glass_cannon_v14" // Fury×6 + Precision×4
	SynergySpeedster     V14SynergyType = "speedster_v14"   // Swift×4 + Haste×3
)

// DamageSource classifies the cause of death.
type DamageSource string

const (
	DamageSourceAura     DamageSource = "aura"
	DamageSourceDash     DamageSource = "dash"
	DamageSourceBoundary DamageSource = "boundary"
	DamageSourceVenom    DamageSource = "venom"
	DamageSourceLightning DamageSource = "lightning"
)

// OrbType classifies orb types.
type OrbType string

const (
	OrbTypeNatural OrbType = "natural"
	OrbTypeDeath   OrbType = "death"
)

// Orb represents a collectible XP orb in the arena.
type Orb struct {
	ID        string   `json:"id"`
	Position  Position `json:"position"`
	Value     float64  `json:"value"`
	Type      OrbType  `json:"type"`
	SpawnTick uint64   `json:"spawnTick"`
}

// Agent represents a player or bot agent entity in the arena.
type Agent struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Position        Position     `json:"position"`
	Heading         float64      `json:"heading"`          // v16: alias for MoveHeading (backward compat)
	MoveHeading     float64      `json:"moveHeading"`      // v16: movement direction (WASD)
	AimHeading      float64      `json:"aimHeading"`       // v16: facing/aim direction (mouse)
	TargetAngle     float64      `json:"targetAngle"`      // v16: alias for MoveTargetAngle
	MoveTargetAngle float64      `json:"moveTargetAngle"`  // v16: target move direction
	AimTargetAngle  float64      `json:"aimTargetAngle"`   // v16: target aim direction
	Speed           float64      `json:"speed"`
	Mass            float64      `json:"mass"`
	Level           int          `json:"level"`
	XP              int          `json:"xp"`
	XPToNext        int          `json:"xpToNext"`
	Boosting        bool         `json:"boosting"`
	Alive           bool         `json:"alive"`
	Build           PlayerBuild  `json:"build"`
	ActiveSynergies []string     `json:"activeSynergies"`
	Skin            AgentSkin    `json:"skin"`
	Appearance      string       `json:"appearance,omitempty"` // v10 Phase 2: packed BigInt string (pass-through from client)
	ActiveEffects   []ActiveEffect   `json:"activeEffects"`
	EffectCooldowns []EffectCooldown `json:"effectCooldowns"`
	Score           int          `json:"score"`
	Kills           int          `json:"kills"`
	BestScore       int          `json:"bestScore"`
	JoinedAt        int64        `json:"joinedAt"` // Unix timestamp ms
	LastInputSeq    int          `json:"lastInputSeq"`
	HitboxRadius    float64      `json:"hitboxRadius"`
	LastDamagedBy   string       `json:"lastDamagedBy"`
	KillStreak      int          `json:"killStreak"`
	PendingChoices  []UpgradeChoice  `json:"pendingChoices,omitempty"`
	UpgradeDeadline uint64       `json:"upgradeDeadline"`
	GracePeriodEnd  uint64       `json:"gracePeriodEnd"`
	// v12: Active ability tracking (for visual effects on clients)
	ActiveAbility      AbilityType `json:"activeAbility,omitempty"`
	ActiveAbilityTicks int         `json:"activeAbilityTicks,omitempty"` // remaining display ticks
	AbilityTargetX     float64     `json:"abilityTargetX,omitempty"`
	AbilityTargetY     float64     `json:"abilityTargetY,omitempty"`
	AbilityLevel       int         `json:"abilityLevel,omitempty"`
	// v16 Phase 4: Vertical position (heightmap terrain)
	ZPos            float64      `json:"zPos"`            // height above terrain (0 = on ground)
	ZVelocity       float64      `json:"zVelocity"`       // vertical velocity (jump/fall)
	// v16 Phase 5: Biome + water state
	InWater         bool         `json:"inWater,omitempty"`     // true if agent is in water
	BiomeIndex      uint8        `json:"biomeIndex,omitempty"`  // current biome type (0-5)

	IsBot           bool         `json:"isBot"`
	IsAgent         bool         `json:"isAgent,omitempty"` // true if controlled by AI agent
	AgentID         string       `json:"agentId,omitempty"` // agent identifier
	Nationality     string       `json:"nationality,omitempty"` // v14: ISO3 country code
	// v14 Phase 2: Megabonk combat system fields
	HP              float64        `json:"hp"`              // current HP (base 100, +10/level)
	MaxHP           float64        `json:"maxHP"`           // max HP
	Defense         float64        `json:"defense"`         // damage reduction (from IronSkin)
	BaseDPS         float64        `json:"baseDPS"`         // base weapon DPS output
	CritChance      float64        `json:"critChance"`      // 0.0~1.0 (base 0.05)
	Invincible      bool           `json:"invincible"`      // respawn invincibility
	InvincibleEnd   uint64         `json:"invincibleEnd"`   // tick when invincibility ends
	WeaponSlots     []WeaponSlot   `json:"weaponSlots"`     // equipped weapons (max 5)
	StatusEffects   []StatusEffect `json:"statusEffects"`   // active status effects (burn, slow, stun...)
	DashCooldownEnd uint64         `json:"dashCooldownEnd"` // tick when dash is available again
	Deaths          int            `json:"deaths"`          // v14: death count (respawn deathmatch)
	Assists         int            `json:"assists"`         // v14: assist count
	// v14 Phase 3: Skill tree & progression
	Passives        map[PassiveType]int  `json:"passives"`        // passive type → stack count
	V14Synergies    []V14SynergyType     `json:"v14Synergies"`    // active v14 synergies
	Gold            int                  `json:"gold"`            // in-match currency
}

// UpgradeChoice represents a single upgrade option presented at level-up.
type UpgradeChoice struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // "tome", "ability", "weapon", "passive", "synergy_hint"
	Name        string `json:"name"`
	Description string `json:"description"`
	Tier        string `json:"tier"`
	// For tomes (legacy):
	TomeType     TomeType    `json:"tomeType,omitempty"`
	CurrentStack int         `json:"currentStack,omitempty"`
	// For abilities (legacy):
	AbilityType  AbilityType `json:"abilityType,omitempty"`
	AbilityLevel int         `json:"abilityLevel,omitempty"`
	// v14 Phase 3: Weapon choices
	WeaponType    WeaponType    `json:"weaponType,omitempty"`
	WeaponLevel   int           `json:"weaponLevel,omitempty"`   // current level (0 = new)
	// v14 Phase 3: Passive choices
	PassiveType   PassiveType   `json:"passiveType,omitempty"`
	PassiveStacks int           `json:"passiveStacks,omitempty"` // current stacks
	PassiveMax    int           `json:"passiveMax,omitempty"`    // max stacks
	// v14 Phase 3: Synergy hint
	SynergyType   V14SynergyType `json:"synergyType,omitempty"`
	SynergyMissing string        `json:"synergyMissing,omitempty"` // what's needed to activate
}

// RoomState represents the current state of a game room.
type RoomState string

const (
	RoomStateWaiting   RoomState = "waiting"
	RoomStateCountdown RoomState = "countdown"
	RoomStatePlaying   RoomState = "playing"
	RoomStateEnding    RoomState = "ending"
	RoomStateCooldown  RoomState = "cooldown"
)

// RoomInfo holds public information about a room for lobby display.
type RoomInfo struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	State         RoomState `json:"state"`
	Players       int       `json:"players"`
	MaxPlayers    int       `json:"maxPlayers"`
	TimeRemaining int       `json:"timeRemaining"` // seconds
	Round         int       `json:"round"`
}

// WinnerInfo holds information about a round winner.
type WinnerInfo struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	Score     int         `json:"score"`
	Kills     int         `json:"kills"`
	Level     int         `json:"level"`
	Build     PlayerBuild `json:"build"`
	Synergies []string    `json:"synergies"`
	Skin      AgentSkin   `json:"skin"`
	RoomID    string      `json:"roomId,omitempty"`
	Timestamp int64       `json:"timestamp,omitempty"`
}

// LeaderboardEntry represents a single entry on the leaderboard.
type LeaderboardEntry struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Score int    `json:"score"`
	Kills int    `json:"kills"`
	Level int    `json:"level"`
}
