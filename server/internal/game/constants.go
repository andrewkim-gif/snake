package game

// ============================================================
// Core Game Constants
// ============================================================

const (
	// TickRate is the server update frequency (Hz).
	TickRate = 20

	// TickInterval is the time between ticks in milliseconds.
	TickInterval = 1000 / TickRate // 50ms

	// ArenaRadius is the initial arena radius in pixels.
	ArenaRadius = 3000.0

	// ArenaMinRadius is the minimum arena radius after full shrink.
	ArenaMinRadius = 500.0
)

// ============================================================
// Movement Constants
// ============================================================

const (
	// BaseSpeed is the base agent movement speed (px/s).
	BaseSpeed = 150.0

	// BoostSpeed is the agent speed while boosting (px/s).
	BoostSpeed = 300.0

	// BaseSpeedPerTick is the base movement per tick.
	// BaseSpeed / TickRate = 150 / 20 = 7.5 px/tick
	BaseSpeedPerTick = BaseSpeed / TickRate // 7.5

	// BoostSpeedPerTick is the boost movement per tick.
	// BoostSpeed / TickRate = 300 / 20 = 15.0 px/tick
	BoostSpeedPerTick = BoostSpeed / TickRate // 15.0

	// MaxSpeedPerTick is the max speed with Speed Tome x5.
	// 225px/s / 20 = 11.25 px/tick
	MaxSpeedPerTick = 225.0 / TickRate // 11.25

	// TurnRate is the maximum heading change per tick (radians).
	TurnRate = 0.15

	// BoostCostPerTick is the mass cost per tick while boosting.
	BoostCostPerTick = 0.15

	// MinBoostMass is the minimum mass required to boost.
	MinBoostMass = 15.0
)

// ============================================================
// Combat Constants
// ============================================================

const (
	// AuraRadius is the combat aura radius (px).
	AuraRadius = 60.0

	// BaseAuraDPSPerTick is the base aura DPS per tick.
	// 40 mass/s / 20 = 2.0 mass/tick
	BaseAuraDPSPerTick = 40.0 / TickRate // 2.0

	// DashDamageRatio is the fraction of defender mass dealt as burst damage.
	DashDamageRatio = 0.30

	// HitboxMinRadius is the minimum agent hitbox radius (px).
	HitboxMinRadius = 16.0

	// HitboxMaxRadius is the maximum agent hitbox radius (px).
	HitboxMaxRadius = 22.0

	// GracePeriodTicks is the number of ticks of invincibility after spawn.
	// 30 seconds * 20 Hz = 600 ticks
	GracePeriodTicks = 30 * TickRate // 600
)

// ============================================================
// Orb Constants
// ============================================================

const (
	// OrbCollectRadius is the radius to collect orbs (px).
	OrbCollectRadius = 50.0

	// NaturalOrbMinValue is the minimum XP value of natural orbs.
	NaturalOrbMinValue = 1.0

	// NaturalOrbMaxValue is the maximum XP value of natural orbs.
	NaturalOrbMaxValue = 2.0

	// DeathOrbMassRatio is the fraction of mass converted to orbs on death.
	DeathOrbMassRatio = 0.80

	// OrbLifetimeTicks is how long an orb lasts before expiring (30s at 20Hz).
	OrbLifetimeTicks = 30 * TickRate // 600

	// NaturalOrbTargetCount is the target number of natural orbs in the arena.
	NaturalOrbTargetCount = 500

	// OrbsPerDeathMin is the minimum number of orbs spawned on death.
	OrbsPerDeathMin = 5

	// OrbsPerDeathMax is the maximum number of orbs spawned on death.
	OrbsPerDeathMax = 20
)

// ============================================================
// Shrink Constants
// ============================================================

const (
	// ShrinkStartDelaySec is how many seconds before shrink begins.
	ShrinkStartDelaySec = 60 // 1 minute

	// ShrinkRatePerTick is the arena radius reduction per tick.
	// 600px/min / 60s / 20Hz = 0.5 px/tick
	ShrinkRatePerTick = 600.0 / 60.0 / TickRate // 0.5

	// BoundaryPenaltyPerTick is mass penalty per tick when outside arena.
	// 5%/s / 20Hz = 0.25%/tick = 0.0025
	BoundaryPenaltyPerTick = 0.0025

	// ShrinkWarningSecondsBefore is seconds before shrink to warn players.
	ShrinkWarningSecondsBefore = 10
)

// ============================================================
// Regen Constants
// ============================================================

const (
	// RegenPerTickPerStack is mass regen per tick per Regen Tome stack.
	// 0.5/s / 20 = 0.025 mass/tick
	RegenPerTickPerStack = 0.5 / TickRate // 0.025
)

// ============================================================
// Agent Spawn Constants
// ============================================================

const (
	// InitialMass is the starting mass for a new agent.
	InitialMass = 30.0

	// InitialLevel is the starting level for a new agent.
	InitialLevel = 1

	// SpawnMarginRatio is how far from center to allow spawning (fraction of arena radius).
	SpawnMarginRatio = 0.8
)

// ============================================================
// Upgrade Constants
// ============================================================

const (
	// UpgradeChoiceCount is the number of upgrade options per level-up.
	UpgradeChoiceCount = 3

	// UpgradeTimeoutTicks is the timeout for choosing an upgrade.
	// 5 seconds * 20 Hz = 100 ticks
	UpgradeTimeoutTicks = 5 * TickRate // 100

	// AbilityBaseSlots is the default number of ability slots.
	AbilityBaseSlots = 2

	// AbilityMaxSlots is the maximum ability slots (with RP unlock).
	AbilityMaxSlots = 3

	// AbilityMaxLevel is the maximum level for an ability.
	AbilityMaxLevel = 4

	// AbilityUpgradeDmgMult is the damage multiplier per ability level.
	AbilityUpgradeDmgMult = 1.30

	// AbilityUpgradeCdMult is the cooldown multiplier per ability level.
	AbilityUpgradeCdMult = 0.80

	// TomeChoiceWeight is the probability of offering a Tome (vs Ability).
	TomeChoiceWeight = 0.65

	// AbilityChoiceWeight is the probability of offering an Ability.
	AbilityChoiceWeight = 0.35
)

// ============================================================
// Room Configuration
// ============================================================

// CombatModeType selects which combat system a Room uses.
type CombatModeType string

const (
	CombatModeClassic CombatModeType = "classic" // v10-v17 snake/aura combat
	CombatModeArena   CombatModeType = "arena"   // v18 Arena survival roguelike
)

// RoomConfig holds room lifecycle timing constants.
type RoomConfig struct {
	MaxRooms          int    // Phase 1: 5, max: 50
	MaxPlayersPerRoom int    // Humans + bots
	MaxHumansPerRoom  int
	MaxBotsPerRoom    int
	RoundDurationSec  int    // Playing phase length
	CountdownSec      int    // Countdown before round
	EndingSec         int    // Ending phase length
	CooldownSec       int    // Cooldown between rounds
	MinPlayersToStart int    // Min humans to start countdown
	TerrainTheme      string // v11: country terrain theme (urban, desert, tundra, etc.)
	CountryISO3       string // v17: ISO3 code of the country this room represents
	CountryName       string // v17: display name of the country

	// v18 Phase 4: Combat mode selection
	CombatMode  CombatModeType // "classic" or "arena"
	CountryTier string         // "S","A","B","C","D" — used for tier-based scaling
}

// DefaultRoomConfig returns the default room configuration.
func DefaultRoomConfig() RoomConfig {
	return RoomConfig{
		MaxRooms:          50,
		MaxPlayersPerRoom: 100,
		MaxHumansPerRoom:  85,
		MaxBotsPerRoom:    15,
		RoundDurationSec:  300, // 5 minutes
		CountdownSec:      0,
		EndingSec:         5,
		CooldownSec:       15,
		MinPlayersToStart: 0, // v17: auto-start with bots (no human required)
	}
}

// ============================================================
// Map Object Configuration
// ============================================================

// MapObjectConfig holds configuration for arena map objects.
type MapObjectConfig struct {
	// XP Shrine: +50% XP for 10 seconds
	ShrineCooldownSec  int
	ShrineEffectSec    int
	ShrineXPMultiplier float64
	ShrineCount        int

	// Healing Spring: +20% mass recovery
	SpringCooldownSec   int
	SpringMassRecovery  float64
	SpringCount         int

	// Upgrade Altar: instant level-up
	AltarUsesPerRound int

	// Speed Gate: x2 speed for 5 seconds
	GateCooldownSec  int
	GateSpeedMult    float64
	GateEffectSec    int
	GateCount        int
}

// DefaultMapObjectConfig returns the default map object configuration.
func DefaultMapObjectConfig() MapObjectConfig {
	return MapObjectConfig{
		ShrineCooldownSec:  60,
		ShrineEffectSec:    10,
		ShrineXPMultiplier: 0.50,
		ShrineCount:        3,

		SpringCooldownSec:  45,
		SpringMassRecovery: 0.20,
		SpringCount:        2,

		AltarUsesPerRound: 1,

		GateCooldownSec: 30,
		GateSpeedMult:   2.0,
		GateEffectSec:   5,
		GateCount:       4,
	}
}

// ============================================================
// Map Object Constants
// ============================================================

const (
	// MapObjectCollectRadius is the distance within which an agent can activate a map object (px).
	MapObjectCollectRadius = 40.0
)

// ============================================================
// Spatial Hash Constants
// ============================================================

const (
	// SpatialHashCellSize is the grid cell size for spatial hashing (px).
	SpatialHashCellSize = 200.0
)

// ============================================================
// Leaderboard Constants
// ============================================================

const (
	// LeaderboardSize is the number of entries in the top leaderboard.
	LeaderboardSize = 10

	// LeaderboardUpdateInterval is how often (in ticks) to update the leaderboard.
	// 1 second = 20 ticks
	LeaderboardUpdateInterval = TickRate // 20
)

// ============================================================
// Broadcasting Constants
// ============================================================

const (
	// StateUpdateRate is the rate of state updates sent to clients (same as TickRate).
	StateUpdateRate = TickRate // 20Hz

	// MinimapUpdateRate is the rate of minimap updates (1Hz = every 20 ticks).
	MinimapUpdateInterval = TickRate // 20

	// LobbyUpdateInterval is the rate of lobby updates (1Hz = every 20 ticks).
	LobbyUpdateInterval = TickRate // 20

	// ShrinkUpdateInterval is how often to send shrink data (1Hz).
	ShrinkUpdateInterval = TickRate // 20
)

// ============================================================
// Viewport / Culling Constants
// ============================================================

const (
	// ViewportWidth is the default client viewport width for culling.
	ViewportWidth = 1920.0

	// ViewportHeight is the default client viewport height for culling.
	ViewportHeight = 1080.0

	// ViewportMargin is extra margin around the viewport for culling.
	ViewportMargin = 200.0
)
