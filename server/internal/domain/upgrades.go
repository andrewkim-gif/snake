package domain

// ─── XP Table ───

// XPTable defines XP required per level. Index = current level, value = XP to next level.
// S30 balance-tuned: lower early thresholds for faster initial progression
var XPTable = []int{
	0,      // Lv0→1: start
	15,     // Lv1→2 (was 20)
	25,     // Lv2→3 (was 30)
	35,     // Lv3→4 (was 45)
	50,     // Lv4→5 (was 65)
	70,     // Lv5→6 (was 90)
	95,     // Lv6→7 (was 120)
	125,    // Lv7→8 (was 155)
	160,    // Lv8→9 (was 195)
	200,    // Lv9→10 (was 240)
	250,    // Lv10→11 (was 290)
	305,    // Lv11→12 (was 345)
	999999, // Lv12 (max)
}

const MaxLevel = 12

// ─── XP Sources (S30 balance-tuned) ───

const (
	XPNaturalOrb       = 2   // was 1: doubled for faster leveling
	XPDeathOrb         = 6   // was 4: increased for kill reward
	XPPowerUpOrb       = 8   // was 5: increased for power-up value
	XPAuraKillBase     = 15  // was 10: increased base kill XP
	XPAuraKillPerLevel = 4   // was 3: better scaling per level
	XPDashKillBase     = 20  // was 15: dash kills more rewarding
	XPDashKillPerLevel = 4   // was 3: better scaling per level
)

// KillStreakMultiplier maps kill streak count to XP multiplier.
var KillStreakMultiplier = map[int]float64{
	3:  1.5,
	5:  2.0,
	10: 3.0,
}

// ─── Tome Definitions (8 types) ───

var TomeDefs = map[TomeType]TomeDef{
	TomeXP: {
		Type: TomeXP, Name: "XP Tome", Tier: "S",
		EffectPerStack: 0.20, MaxStacks: 10,
		Description: "XP gain +20%", StatKey: "xpMultiplier",
	},
	TomeSpeed: {
		Type: TomeSpeed, Name: "Speed Tome", Tier: "S",
		EffectPerStack: 0.10, MaxStacks: 5,
		Description: "Move speed +10%", StatKey: "speedMultiplier",
	},
	TomeDamage: {
		Type: TomeDamage, Name: "Damage Tome", Tier: "S",
		EffectPerStack: 0.15, MaxStacks: 10,
		Description: "Aura DPS +15%", StatKey: "dpsMultiplier",
	},
	TomeArmor: {
		Type: TomeArmor, Name: "Armor Tome", Tier: "A",
		EffectPerStack: 0.10, MaxStacks: 8,
		Description: "Damage taken -10%", StatKey: "damageReduction",
	},
	TomeMagnet: {
		Type: TomeMagnet, Name: "Magnet Tome", Tier: "A",
		EffectPerStack: 0.25, MaxStacks: 6,
		Description: "Collect radius +25%", StatKey: "collectRadiusMultiplier",
	},
	TomeLuck: {
		Type: TomeLuck, Name: "Luck Tome", Tier: "A",
		EffectPerStack: 0.15, MaxStacks: 6,
		Description: "Rare upgrade chance +15%", StatKey: "luckMultiplier",
	},
	TomeRegen: {
		Type: TomeRegen, Name: "Regen Tome", Tier: "B",
		EffectPerStack: 0.025, MaxStacks: 5,
		Description: "Mass regen +0.5/s", StatKey: "regenPerTick",
	},
	TomeCursed: {
		Type: TomeCursed, Name: "Cursed Tome", Tier: "S",
		EffectPerStack: 0.25, MaxStacks: 5,
		Description: "DPS +25%, damage taken +20%", StatKey: "cursedMultiplier",
	},
}

// ─── Ability Definitions (6 types) ───

var AbilityDefs = map[AbilityType]AbilityDef{
	AbilityVenomAura: {
		Type: AbilityVenomAura, Name: "Venom Aura",
		BaseDamage: 15, CooldownTicks: 0, DurationTicks: 60,
		AutoTrigger: "Always active",
		Description: "Poison DoT to nearby enemies (3s)",
		UpgradeBonus: struct {
			DamageMultiplier  float64 `json:"damageMultiplier"`
			CooldownReduction float64 `json:"cooldownReduction"`
		}{DamageMultiplier: 1.3, CooldownReduction: 0},
	},
	AbilityShieldBurst: {
		Type: AbilityShieldBurst, Name: "Shield Burst",
		BaseDamage: 0, CooldownTicks: 300, DurationTicks: 60,
		AutoTrigger: "HP below 30%",
		Description: "3s invulnerability + push nearby enemies",
		UpgradeBonus: struct {
			DamageMultiplier  float64 `json:"damageMultiplier"`
			CooldownReduction float64 `json:"cooldownReduction"`
		}{DamageMultiplier: 1.0, CooldownReduction: 0.20},
	},
	AbilityLightningStrike: {
		Type: AbilityLightningStrike, Name: "Lightning Strike",
		BaseDamage: 50, CooldownTicks: 160, DurationTicks: 0,
		AutoTrigger: "Enemy in range",
		Description: "Instant damage to nearest enemy",
		UpgradeBonus: struct {
			DamageMultiplier  float64 `json:"damageMultiplier"`
			CooldownReduction float64 `json:"cooldownReduction"`
		}{DamageMultiplier: 1.3, CooldownReduction: 0.20},
	},
	AbilitySpeedDash: {
		Type: AbilitySpeedDash, Name: "Speed Dash",
		BaseDamage: 0, CooldownTicks: 240, DurationTicks: 40,
		AutoTrigger: "Chasing/fleeing enemy",
		Description: "2s 3x speed + collision immunity",
		UpgradeBonus: struct {
			DamageMultiplier  float64 `json:"damageMultiplier"`
			CooldownReduction float64 `json:"cooldownReduction"`
		}{DamageMultiplier: 1.0, CooldownReduction: 0.20},
	},
	AbilityMassDrain: {
		Type: AbilityMassDrain, Name: "Mass Drain",
		BaseDamage: 0, CooldownTicks: 200, DurationTicks: 0,
		AutoTrigger: "Hitbox collision",
		Description: "Absorb 10% of touched enemy mass",
		UpgradeBonus: struct {
			DamageMultiplier  float64 `json:"damageMultiplier"`
			CooldownReduction float64 `json:"cooldownReduction"`
		}{DamageMultiplier: 1.3, CooldownReduction: 0.20},
	},
	AbilityGravityWell: {
		Type: AbilityGravityWell, Name: "Gravity Well",
		BaseDamage: 0, CooldownTicks: 400, DurationTicks: 60,
		AutoTrigger: "Dense orb area",
		Description: "3s pull nearby orbs+enemies",
		UpgradeBonus: struct {
			DamageMultiplier  float64 `json:"damageMultiplier"`
			CooldownReduction float64 `json:"cooldownReduction"`
		}{DamageMultiplier: 1.0, CooldownReduction: 0.20},
	},
}

// ─── Synergy Definitions (10 types: 6 public + 4 hidden) ───

var AllSynergies = []SynergyDef{
	// Public synergies (6)
	{
		ID: "holy_trinity", Name: "Holy Trinity",
		Requirements: SynergyRequirements{
			Tomes: map[TomeType]int{TomeXP: 3, TomeLuck: 2, TomeCursed: 1},
		},
		Bonus:  SynergyBonus{Description: "All XP +50%", Effects: map[string]float64{"xpMultiplier": 1.5}},
		Hidden: false,
	},
	{
		ID: "glass_cannon", Name: "Glass Cannon",
		Requirements: SynergyRequirements{
			Tomes: map[TomeType]int{TomeDamage: 5, TomeCursed: 3},
		},
		Bonus:  SynergyBonus{Description: "DPS x2.0 (damage taken x2.0)", Effects: map[string]float64{"dpsMultiplier": 2.0, "damageTakenMultiplier": 2.0}},
		Hidden: false,
	},
	{
		ID: "iron_fortress", Name: "Iron Fortress",
		Requirements: SynergyRequirements{
			Tomes:     map[TomeType]int{TomeArmor: 4, TomeRegen: 3},
			Abilities: map[AbilityType]int{AbilityShieldBurst: 1},
		},
		Bonus:  SynergyBonus{Description: "Extra -30% damage taken", Effects: map[string]float64{"damageReduction": 0.30}},
		Hidden: false,
	},
	{
		ID: "speedster", Name: "Speedster",
		Requirements: SynergyRequirements{
			Tomes:     map[TomeType]int{TomeSpeed: 4, TomeMagnet: 2},
			Abilities: map[AbilityType]int{AbilitySpeedDash: 1},
		},
		Bonus:  SynergyBonus{Description: "Boost cost -50%", Effects: map[string]float64{"boostCostReduction": 0.50}},
		Hidden: false,
	},
	{
		ID: "vampire", Name: "Vampire",
		Requirements: SynergyRequirements{
			Tomes:     map[TomeType]int{TomeRegen: 2},
			Abilities: map[AbilityType]int{AbilityVenomAura: 1, AbilityMassDrain: 1},
		},
		Bonus:  SynergyBonus{Description: "Venom heals 20%", Effects: map[string]float64{"venomLifesteal": 0.20}},
		Hidden: false,
	},
	{
		ID: "storm", Name: "Storm",
		Requirements: SynergyRequirements{
			Tomes:     map[TomeType]int{TomeDamage: 3},
			Abilities: map[AbilityType]int{AbilityLightningStrike: 3},
		},
		Bonus:  SynergyBonus{Description: "Lightning chains to 3 enemies", Effects: map[string]float64{"lightningChain": 3}},
		Hidden: false,
	},

	// Hidden synergies (4)
	{
		ID: "berserker", Name: "???",
		Requirements: SynergyRequirements{
			Tomes: map[TomeType]int{TomeCursed: 5, TomeDamage: 3, TomeSpeed: 2},
		},
		Bonus:  SynergyBonus{Description: "Dash damage x3.0", Effects: map[string]float64{"dashDamageMultiplier": 3.0}},
		Hidden: true,
	},
	{
		ID: "pacifist", Name: "???",
		Requirements: SynergyRequirements{
			Tomes: map[TomeType]int{TomeXP: 5, TomeMagnet: 4, TomeRegen: 3},
		},
		Bonus:  SynergyBonus{Description: "XP orb value x3.0", Effects: map[string]float64{"orbValueMultiplier": 3.0}},
		Hidden: true,
	},
	{
		ID: "elemental", Name: "???",
		Requirements: SynergyRequirements{
			Abilities: map[AbilityType]int{AbilityVenomAura: 2, AbilityLightningStrike: 2, AbilityGravityWell: 1},
		},
		Bonus:  SynergyBonus{Description: "All ability cooldown -40%", Effects: map[string]float64{"abilityCooldownReduction": 0.40}},
		Hidden: true,
	},
	{
		ID: "immortal", Name: "???",
		Requirements: SynergyRequirements{
			Tomes:     map[TomeType]int{TomeArmor: 6, TomeRegen: 4},
			Abilities: map[AbilityType]int{AbilityShieldBurst: 3},
		},
		Bonus:  SynergyBonus{Description: "Revive once on death (50% mass)", Effects: map[string]float64{"reviveOnce": 1, "reviveMassRatio": 0.50}},
		Hidden: true,
	},
}

// ─── Upgrade Config Constants ───

const (
	ChoicesPerLevel    = 3
	ChoiceTimeoutTicks = 100 // 5s @ 20Hz
	MaxAbilitySlots    = 2
	MaxAbilityLevel    = 4
	AbilityOfferChance = 0.35
	LuckRareBonusPerStack = 0.15
)

// ─── Combat Config Constants ───

const (
	CombatAuraRadius         = 60.0
	CombatBaseAuraDPS        = 2.0
	CombatDashDamageRatio    = 0.30
	CombatHitboxBaseRadius   = 16.0
	CombatHitboxMaxRadius    = 22.0
	CombatHighLevelThreshold = 8
	CombatHighLevelDPSBonus  = 0.20
	CombatVenomDPSPerTick    = 0.75
	CombatVenomDurationTicks = 60
	CombatMassDrainRatio     = 0.10
	CombatGravityPullRadius  = 200.0
	CombatGravityPullSpeed   = 5.0
	CombatShieldPushRadius   = 80.0
	CombatShieldPushForce    = 50.0
	CombatLightningRange     = 200.0
	CombatDeathXPOrbRatio    = 0.80
)

// ─── Bot Build Paths ───

type BotBuildPath string

const (
	BuildAggressive  BotBuildPath = "aggressive"
	BuildTank        BotBuildPath = "tank"
	BuildXPRush      BotBuildPath = "xp_rush"
	BuildBalanced    BotBuildPath = "balanced"
	BuildGlassCannon BotBuildPath = "glass_cannon"
)

// BotBuildPreference defines prioritized upgrades for a bot build path.
type BotBuildPreference struct {
	TomePriority    []TomeType
	AbilityPriority []AbilityType
}

// BotBuildPreferences maps build paths to their preferences.
var BotBuildPreferences = map[BotBuildPath]BotBuildPreference{
	BuildAggressive: {
		TomePriority:    []TomeType{TomeDamage, TomeSpeed, TomeCursed},
		AbilityPriority: []AbilityType{AbilityVenomAura, AbilityLightningStrike, AbilitySpeedDash},
	},
	BuildTank: {
		TomePriority:    []TomeType{TomeArmor, TomeRegen, TomeMagnet},
		AbilityPriority: []AbilityType{AbilityShieldBurst, AbilityMassDrain, AbilityGravityWell},
	},
	BuildXPRush: {
		TomePriority:    []TomeType{TomeXP, TomeMagnet, TomeSpeed},
		AbilityPriority: []AbilityType{AbilityGravityWell, AbilitySpeedDash, AbilityVenomAura},
	},
	BuildBalanced: {
		TomePriority:    []TomeType{TomeDamage, TomeArmor, TomeSpeed},
		AbilityPriority: []AbilityType{AbilityVenomAura, AbilityShieldBurst, AbilityLightningStrike},
	},
	BuildGlassCannon: {
		TomePriority:    []TomeType{TomeDamage, TomeCursed, TomeSpeed},
		AbilityPriority: []AbilityType{AbilityLightningStrike, AbilityVenomAura, AbilitySpeedDash},
	},
}
