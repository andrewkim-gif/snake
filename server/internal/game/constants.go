package game

// ArenaConfig holds all arena gameplay constants.
// Values match packages/shared/src/constants/game.ts ARENA_CONFIG 1:1.
type ArenaConfig struct {
	// Arena dimensions
	ArenaRadius float64 // 6000
	MaxPlayers  int     // 100

	// Tick
	TickRate int // 20 Hz

	// Movement
	BaseSpeed       float64 // 150 px/s
	BoostSpeed      float64 // 300 px/s
	TurnRate        float64 // 0.25 rad/tick
	InitialMass     float64 // 10
	MinBoostMass    float64 // 15
	BoostCostPerTick float64 // 0.5

	// Collection
	CollectRadius    float64 // 20 units
	NaturalOrbTarget int     // 2000
	DeathOrbRatio    float64 // 0.8

	// v10 Combat
	AuraRadius       float64 // 60 px
	AuraDPSPerTick   float64 // 2.0 mass/tick
	DashDamageRatio  float64 // 0.3
	HitboxBaseRadius float64 // 16 px
	HitboxMaxRadius  float64 // 22 px

	// v10 Arena Shrink
	ShrinkEnabled          bool
	ShrinkRatePerMin       float64 // 600 px/min
	ShrinkMinRadius        float64 // 1200 px
	ShrinkPerTick          float64 // 0.5 px/tick (600/60/20)
	BoundaryPenaltyPerTick float64 // 0.0025

	// v10 Level-up
	UpgradeChoiceTimeout int    // 100 ticks (5s @ 20Hz)
	GracePeriodTicks     int    // 600 ticks (30s)
}

// DefaultArenaConfig returns the standard arena config matching TS constants.
func DefaultArenaConfig() ArenaConfig {
	return ArenaConfig{
		ArenaRadius:    6000,
		MaxPlayers:     100,
		TickRate:       20,
		BaseSpeed:      150,
		BoostSpeed:     300,
		TurnRate:       0.25,
		InitialMass:    10,
		MinBoostMass:   15,
		BoostCostPerTick: 0.5,
		CollectRadius:    20,
		NaturalOrbTarget: 2000,
		DeathOrbRatio:    0.8,
		AuraRadius:       60,
		AuraDPSPerTick:   2.0,
		DashDamageRatio:  0.30,
		HitboxBaseRadius: 16,
		HitboxMaxRadius:  22,
		ShrinkEnabled:          true,
		ShrinkRatePerMin:       600,
		ShrinkMinRadius:        1200,
		ShrinkPerTick:          0.5,
		BoundaryPenaltyPerTick: 0.0025,
		UpgradeChoiceTimeout:   100,
		GracePeriodTicks:       600,
	}
}

// RoomConfig holds room and round-related constants.
// Values match packages/shared/src/constants/game.ts ROOM_CONFIG 1:1.
type RoomConfig struct {
	MaxRooms          int // 5
	MaxPlayersPerRoom int // 50
	RoundDuration     int // 300 seconds (5 min)
	CountdownDuration int // 10 seconds
	EndingDuration    int // 5 seconds
	CooldownDuration  int // 15 seconds
	MinPlayersToStart int // 1
	BotsPerRoom       int // 15
	RoomOrbTarget     int // 1000
	LobbyUpdateMs     int // 1000 (1Hz)
	RecentWinnersCount int // 10
}

// DefaultRoomConfig returns the standard room config matching TS constants.
func DefaultRoomConfig() RoomConfig {
	return RoomConfig{
		MaxRooms:          5,
		MaxPlayersPerRoom: 50,
		RoundDuration:     300,
		CountdownDuration: 10,
		EndingDuration:    5,
		CooldownDuration:  15,
		MinPlayersToStart: 1,
		BotsPerRoom:       15,
		RoomOrbTarget:     1000,
		LobbyUpdateMs:     1000,
		RecentWinnersCount: 10,
	}
}

// ─── Network Constants ───

const (
	StateBroadcastInterval  = 1  // every tick
	LeaderboardInterval     = 5  // every 5 ticks
	MinimapInterval         = 20 // every 20 ticks (1Hz)
	ViewportMargin          = 200
	MaxInputRate            = 30
	RespawnCooldownMs       = 2000
	PingIntervalMs          = 5000
	ReconnectAttempts       = 5
)

// ─── Orb Constants ───

const (
	OrbNaturalValueMin = 1
	OrbNaturalValueMax = 2
	OrbDeathValueMin   = 3
	OrbDeathValueMax   = 5
	OrbSpawnPadding    = 200
	OrbColorCount      = 12
)

// ─── Effect Constants ───

const (
	MagnetDurationTicks = 100  // 5s
	MagnetPullRadius    = 200.0
	MagnetPullSpeed     = 3.0

	SpeedDurationTicks  = 80   // 4s

	GhostDurationTicks  = 60   // 3s
	GhostCooldownTicks  = 200  // 10s

	MegaOrbValue       = 30.0
	MegaOrbLifetime    = 600   // 30s
)
