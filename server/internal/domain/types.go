package domain

// ─── Core Types ───

// Position represents a 2D world coordinate.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// ─── Tome / Ability / Upgrade Types ───

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

// AllTomeTypes lists all available tome types.
var AllTomeTypes = []TomeType{
	TomeXP, TomeSpeed, TomeDamage, TomeArmor,
	TomeMagnet, TomeLuck, TomeRegen, TomeCursed,
}

type AbilityType string

const (
	AbilityVenomAura      AbilityType = "venom_aura"
	AbilityShieldBurst    AbilityType = "shield_burst"
	AbilityLightningStrike AbilityType = "lightning_strike"
	AbilitySpeedDash      AbilityType = "speed_dash"
	AbilityMassDrain      AbilityType = "mass_drain"
	AbilityGravityWell    AbilityType = "gravity_well"
)

// AllAbilityTypes lists all available ability types.
var AllAbilityTypes = []AbilityType{
	AbilityVenomAura, AbilityShieldBurst, AbilityLightningStrike,
	AbilitySpeedDash, AbilityMassDrain, AbilityGravityWell,
}

type DamageSource string

const (
	DamageSourceAura     DamageSource = "aura"
	DamageSourceDash     DamageSource = "dash"
	DamageSourceBoundary DamageSource = "boundary"
	DamageSourceVenom    DamageSource = "venom"
)

// ─── Player Build ───

// PlayerBuild represents an agent's current upgrade build.
type PlayerBuild struct {
	Tomes           map[TomeType]int `json:"tomes"`
	Abilities       []AbilitySlot    `json:"abilities"`
	MaxAbilitySlots int              `json:"maxAbilitySlots"`
}

// NewPlayerBuild creates a fresh empty build.
func NewPlayerBuild() PlayerBuild {
	return PlayerBuild{
		Tomes: map[TomeType]int{
			TomeXP:     0,
			TomeSpeed:  0,
			TomeDamage: 0,
			TomeArmor:  0,
			TomeMagnet: 0,
			TomeLuck:   0,
			TomeRegen:  0,
			TomeCursed: 0,
		},
		Abilities:       make([]AbilitySlot, 0, 3),
		MaxAbilitySlots: 2,
	}
}

// AbilitySlot represents an equipped ability.
type AbilitySlot struct {
	Type          AbilityType `json:"type"`
	Level         int         `json:"level"`
	CooldownUntil uint64     `json:"cooldownUntil"`
}

// UpgradeChoice represents a level-up choice presented to the player.
type UpgradeChoice struct {
	ID            string      `json:"id"`
	Type          string      `json:"type"` // "tome" or "ability"
	TomeType      TomeType    `json:"tomeType,omitempty"`
	AbilityType   AbilityType `json:"abilityType,omitempty"`
	Name          string      `json:"name"`
	Description   string      `json:"description"`
	CurrentStacks int         `json:"currentStacks,omitempty"`
	CurrentLevel  int         `json:"currentLevel,omitempty"`
}

// ─── Effect System ───

type EffectType string

const (
	EffectMagnet EffectType = "magnet"
	EffectSpeed  EffectType = "speed"
	EffectGhost  EffectType = "ghost"
)

// ActiveEffect represents a currently active effect.
type ActiveEffect struct {
	Type      EffectType `json:"type"`
	ExpiresAt uint64     `json:"expiresAt"`
}

// EffectCooldown tracks when an effect becomes available again.
type EffectCooldown struct {
	Type        EffectType `json:"type"`
	AvailableAt uint64     `json:"availableAt"`
}

// ─── Agent Skin ───

// AgentSkin defines visual properties of an agent.
type AgentSkin struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	PrimaryColor   string `json:"primaryColor"`
	SecondaryColor string `json:"secondaryColor"`
	Pattern        string `json:"pattern"`   // solid, striped, gradient, dotted
	EyeStyle       string `json:"eyeStyle"`  // default, angry, cute, cool, dot, wink
	AccentColor    string `json:"accentColor,omitempty"`
}

// ─── Agent Entity ───

// Agent represents a player or bot entity in the game.
type Agent struct {
	ID   string `json:"id"`
	Name string `json:"name"`

	// Position & movement (single coordinate, not segments)
	Position    Position `json:"position"`
	Heading     float64  `json:"heading"`
	TargetAngle float64  `json:"targetAngle"`
	Speed       float64  `json:"speed"`

	// Combat & survival
	Mass     float64 `json:"mass"`
	Level    int     `json:"level"`
	XP       int     `json:"xp"`
	XPToNext int     `json:"xpToNext"`
	Boosting bool    `json:"boosting"`
	Alive    bool    `json:"alive"`

	// Build system
	Build           PlayerBuild `json:"build"`
	ActiveSynergies []string    `json:"activeSynergies"`

	// Visual
	Skin AgentSkin `json:"skin"`

	// Effects
	ActiveEffects   []ActiveEffect   `json:"activeEffects"`
	EffectCooldowns []EffectCooldown `json:"effectCooldowns"`

	// Score
	Score     int `json:"score"`
	Kills     int `json:"kills"`
	BestScore int `json:"bestScore"`

	// Meta
	JoinedAt     uint64 `json:"joinedAt"`
	LastInputSeq int    `json:"lastInputSeq"`

	// Hitbox (derived from mass)
	HitboxRadius float64 `json:"hitboxRadius"`

	// Combat tracking
	LastDamagedBy string `json:"lastDamagedBy"`
	KillStreak    int    `json:"killStreak"`

	// Level-up pending state
	PendingChoices  []UpgradeChoice `json:"pendingChoices,omitempty"`
	UpgradeDeadline uint64          `json:"upgradeDeadline"`

	// Grace period (combat immunity)
	GracePeriodEnd uint64 `json:"gracePeriodEnd"`

	// Bot flag
	IsBot bool `json:"isBot"`

	// Commander mode AI override
	AIOverride *AIOverride `json:"-"`
}

// AIOverride represents an external command that temporarily overrides bot AI.
type AIOverride struct {
	Command    string   `json:"command"`
	Params     map[string]interface{} `json:"params,omitempty"`
	ExpiresAt  uint64   `json:"expiresAt"`
	CombatStyle string  `json:"combatStyle,omitempty"` // aggressive/defensive/balanced
}

// ─── Orb Entity ───

type OrbType int

const (
	OrbNatural    OrbType = 0
	OrbDeath      OrbType = 1
	OrbBoostTrail OrbType = 2
	OrbMagnet     OrbType = 3
	OrbSpeed      OrbType = 4
	OrbGhost      OrbType = 5
	OrbMega       OrbType = 6
)

// Orb represents a collectible orb in the arena.
type Orb struct {
	ID        uint64   `json:"id"`
	Position  Position `json:"position"`
	Value     float64  `json:"value"`
	Color     int      `json:"color"`
	Type      OrbType  `json:"type"`
	SpawnTick uint64   `json:"spawnTick"`
	Lifetime  uint64   `json:"lifetime"` // 0 = no expiry
}

// ─── Room System Types ───

type RoomStatus string

const (
	RoomWaiting   RoomStatus = "waiting"
	RoomCountdown RoomStatus = "countdown"
	RoomPlaying   RoomStatus = "playing"
	RoomEnding    RoomStatus = "ending"
	RoomCooldown  RoomStatus = "cooldown"
)

// RoomInfo is the lobby-facing room summary.
type RoomInfo struct {
	ID            string     `json:"id"`
	State         RoomStatus `json:"state"`
	PlayerCount   int        `json:"playerCount"`
	MaxPlayers    int        `json:"maxPlayers"`
	TimeRemaining int        `json:"timeRemaining"`
	Winner        *WinnerInfo `json:"winner"`
}

// WinnerInfo describes a round winner.
type WinnerInfo struct {
	Name   string `json:"name"`
	Score  int    `json:"score"`
	Kills  int    `json:"kills"`
	SkinID int    `json:"skinId"`
}

// RecentWinner extends WinnerInfo with context.
type RecentWinner struct {
	WinnerInfo
	RoomID    string `json:"roomId"`
	Timestamp int64  `json:"timestamp"`
}

// ─── Leaderboard ───

// LeaderEntry represents one row in the leaderboard.
type LeaderEntry struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Score int    `json:"score"`
	Kills int    `json:"kills"`
	Rank  int    `json:"rank"`
}

// ─── Synergy Definition ───

type SynergyRequirements struct {
	Tomes     map[TomeType]int    `json:"tomes,omitempty"`
	Abilities map[AbilityType]int `json:"abilities,omitempty"`
}

type SynergyBonus struct {
	Description string             `json:"description"`
	Effects     map[string]float64 `json:"effects"`
}

type SynergyDef struct {
	ID           string              `json:"id"`
	Name         string              `json:"name"`
	Requirements SynergyRequirements `json:"requirements"`
	Bonus        SynergyBonus        `json:"bonus"`
	Hidden       bool                `json:"hidden"`
}

// ─── Tome / Ability Definitions ───

type TomeDef struct {
	Type           TomeType `json:"type"`
	Name           string   `json:"name"`
	Tier           string   `json:"tier"` // S, A, B
	EffectPerStack float64  `json:"effectPerStack"`
	MaxStacks      int      `json:"maxStacks"`
	Description    string   `json:"description"`
	StatKey        string   `json:"statKey"`
}

type AbilityDef struct {
	Type          AbilityType `json:"type"`
	Name          string      `json:"name"`
	BaseDamage    float64     `json:"baseDamage"`
	CooldownTicks int         `json:"cooldownTicks"`
	DurationTicks int         `json:"durationTicks"`
	AutoTrigger   string      `json:"autoTrigger"`
	Description   string      `json:"description"`
	UpgradeBonus  struct {
		DamageMultiplier  float64 `json:"damageMultiplier"`
		CooldownReduction float64 `json:"cooldownReduction"`
	} `json:"upgradeBonus"`
}
