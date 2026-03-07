package domain

// --- Server → Client event payloads ---

// JoinedEvent is sent to the client after successfully joining a room.
type JoinedEvent struct {
	RoomID        string    `json:"roomId"`
	ID            string    `json:"id"`
	Spawn         Position  `json:"spawn"`
	ArenaRadius   float64   `json:"arenaRadius"`
	Tick          uint64    `json:"tick"`
	RoomState     RoomState `json:"roomState"`
	TimeRemaining int       `json:"timeRemaining"`
	TerrainTheme  string    `json:"terrainTheme,omitempty"` // v11: country terrain theme
	// v16: Dynamic arena settings (server is master, client overrides defaults)
	TurnRate      float64   `json:"turnRate,omitempty"`
}

// StateAgent is the per-tick serialized agent data sent to clients.
// JSON tags MUST match AgentNetworkData in shared/types/events.ts
type StateAgent struct {
	ID          string   `json:"i"`
	X           float64  `json:"x"`
	Y           float64  `json:"y"`
	Heading     float64  `json:"h"`              // movement heading (MoveHeading)
	Facing      float64  `json:"f,omitempty"`    // v16: aim/facing direction (AimHeading), 0 omitted for bandwidth
	Mass        float64  `json:"m"`
	Boosting    bool     `json:"b,omitempty"`
	Alive       bool     `json:"a"`
	Level       int      `json:"lv"`
	Name        string   `json:"n"`
	SkinID      int      `json:"k"`
	IsBot       bool     `json:"bot,omitempty"`
	KillStreak  int      `json:"ks,omitempty"`
	HitboxRadius float64 `json:"hr"`
	BuildType   string   `json:"bt,omitempty"` // v10: dominant build type (berserker/tank/speedster/farmer/balanced)
	Appearance  string   `json:"ap,omitempty"` // v10 Phase 2: packed BigInt string (매 state에 항상 포함)
	ActiveAbility string `json:"ab,omitempty"` // v12: currently active ability type (empty = none)
	AbilityTargetX float64 `json:"tx,omitempty"` // v12: ability target X coordinate
	AbilityTargetY float64 `json:"ty,omitempty"` // v12: ability target Y coordinate
	AbilityLevel   int     `json:"abl,omitempty"` // v12: ability level (1-4)
	Nationality    string  `json:"nat,omitempty"` // v14: nationality ISO3 code
}

// StateOrb is the per-tick serialized orb data sent to clients.
// JSON tags MUST match OrbNetworkData in shared/types/events.ts
type StateOrb struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Value float64 `json:"v"`
	Color int     `json:"c"`
	Type  OrbType `json:"t"`
}

// StateUpdate is the main 20Hz game state update.
type StateUpdate struct {
	Tick        uint64             `json:"t"`
	Agents      []StateAgent       `json:"s"`
	Orbs        []StateOrb         `json:"o"`
	Leaderboard []LeaderboardEntry `json:"l,omitempty"`
}

// DeathEvent is sent to the player who died.
type DeathEvent struct {
	Score        int          `json:"score"`
	Kills        int          `json:"kills"`
	Duration     int          `json:"duration"`     // seconds survived
	Rank         int          `json:"rank"`
	Killer       string       `json:"killer,omitempty"`
	KillerName   string       `json:"killerName,omitempty"`
	DamageSource DamageSource `json:"damageSource"`
	Level        int          `json:"level"`
	Build        PlayerBuild  `json:"build"`
}

// KillEvent is sent to the player who got a kill.
type KillEvent struct {
	Victim     string  `json:"victim"`
	VictimName string  `json:"victimName"`
	VictimMass float64 `json:"victimMass"`
}

// MinimapData is sent at 1Hz with all agent positions for the minimap.
type MinimapData struct {
	Agents   []MinimapAgent `json:"snakes"` // kept as "snakes" for client compat
	Boundary float64        `json:"boundary"`
}

// MinimapAgent is a single agent on the minimap.
type MinimapAgent struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Mass float64 `json:"m"`
	Me   bool    `json:"me,omitempty"`
}

// LevelUpEvent is sent when a player levels up with upgrade choices.
type LevelUpEvent struct {
	Level        int             `json:"level"`
	Choices      []UpgradeChoice `json:"choices"`
	TimeoutTicks int             `json:"timeoutTicks"`
	CurrentBuild PlayerBuild     `json:"currentBuild"`
}

// AgentLevelUpEvent is the enriched level_up event sent to AI agents.
// Includes game context for strategic decision-making.
type AgentLevelUpEvent struct {
	Level        int               `json:"level"`
	Choices      []UpgradeChoice   `json:"choices"`
	CurrentBuild AgentBuildInfo    `json:"currentBuild"`
	GameContext  AgentGameContext  `json:"gameContext"`
	Deadline     int               `json:"deadline"` // milliseconds until auto-select (5000ms)
}

// AgentBuildInfo is the detailed build state sent to agents.
type AgentBuildInfo struct {
	Tomes           map[TomeType]int `json:"tomes"`
	Abilities       []AbilitySlot    `json:"abilities"`
	ActiveSynergies []string         `json:"activeSynergies"`
	NearbySynergies []string         `json:"nearbySynergies"` // synergies 1 upgrade away
}

// AgentGameContext provides game state for agent decision-making.
type AgentGameContext struct {
	TimeRemaining int     `json:"timeRemaining"` // seconds
	MyRank        int     `json:"myRank"`
	MyMass        float64 `json:"myMass"`
	NearbyThreats int     `json:"nearbyThreats"` // count of nearby enemies
	ArenaRadius   float64 `json:"arenaRadius"`
}

// AgentAuthResult is sent to an agent after authentication attempt.
type AgentAuthResult struct {
	Success bool   `json:"success"`
	AgentID string `json:"agentId,omitempty"`
	Error   string `json:"error,omitempty"`
}

// --- observe_game response types (S52) ---

// ObserveGameResponse is the full game observation sent to AI agents.
// Maintains v9 backward compatibility while adding v10 fields.
type ObserveGameResponse struct {
	// --- v9 compatible fields ---
	ID       string  `json:"id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Heading  float64 `json:"heading"`
	Speed    float64 `json:"speed"`
	Mass     float64 `json:"mass"`
	Alive    bool    `json:"alive"`
	Score    int     `json:"score"`
	Kills    int     `json:"kills"`
	Boosting bool    `json:"boosting"`

	// Nearby agents (v9 compat: id, x, y, mass, heading)
	NearbyAgents []ObserveNearbyAgent `json:"nearbyAgents"`

	// Nearby orbs (v9 compat)
	NearbyOrbs []ObserveNearbyOrb `json:"nearbyOrbs"`

	// --- v10 extended fields ---
	Level          int                   `json:"level"`
	XP             int                   `json:"xp"`
	XPToNext       int                   `json:"xpToNext"`
	Build          ObserveBuildInfo      `json:"build"`
	ArenaRadius    float64               `json:"arenaRadius"`
	Zone           string                `json:"zone"` // "center", "mid", "edge", "danger"
	NearbyThreats  []ObserveNearbyThreat `json:"nearbyThreats"`
	NearbyMapObjs  []ObserveNearbyMapObj `json:"nearbyMapObjects"`
	TimeRemaining  int                   `json:"timeRemaining"` // seconds
	MyRank         int                   `json:"myRank"`
	AliveCount     int                   `json:"aliveCount"`
	Tick           uint64                `json:"tick"`
}

// ObserveNearbyAgent is a nearby agent in the observe_game response (v9 compat).
type ObserveNearbyAgent struct {
	ID       string  `json:"id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Mass     float64 `json:"mass"`
	Heading  float64 `json:"heading"`
	Boosting bool    `json:"boosting,omitempty"`
	Name     string  `json:"name"`
	Level    int     `json:"level"`
}

// ObserveNearbyOrb is a nearby orb in the observe_game response (v9 compat).
type ObserveNearbyOrb struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Value float64 `json:"value"`
	Type  OrbType `json:"type"`
}

// ObserveBuildInfo is the build state in the observe_game response (v10).
type ObserveBuildInfo struct {
	Tomes           map[TomeType]int `json:"tomes"`
	Abilities       []AbilitySlot    `json:"abilities"`
	ActiveSynergies []string         `json:"activeSynergies"`
}

// ObserveNearbyThreat is a nearby enemy with build classification (v10).
type ObserveNearbyThreat struct {
	ID        string  `json:"id"`
	Mass      float64 `json:"mass"`
	Distance  float64 `json:"distance"`
	BuildType string  `json:"buildType"` // "berserker", "tank", "speedster", "farmer", "balanced"
}

// ObserveNearbyMapObj is a nearby map object in the observe_game response (v10).
type ObserveNearbyMapObj struct {
	Type     string  `json:"type"` // "shrine", "spring", "altar", "gate"
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Distance float64 `json:"distance"`
}

// SynergyActivatedEvent is sent when a synergy is triggered.
type SynergyActivatedEvent struct {
	SynergyID   string `json:"synergyId"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ArenaShrinkEvent is sent at 1Hz with arena shrink status.
type ArenaShrinkEvent struct {
	CurrentRadius float64 `json:"currentRadius"`
	MinRadius     float64 `json:"minRadius"`
	ShrinkRate    float64 `json:"shrinkRate"`
}

// ArenaShrinkWarning is sent 10 seconds before a shrink event.
type ArenaShrinkWarning struct {
	SecondsUntilShrink int     `json:"secondsUntilShrink"`
	NewRadius          float64 `json:"newRadius"`
}

// --- Room lifecycle events ---

// RoundStartEvent is sent when a round begins.
type RoundStartEvent struct {
	Countdown int `json:"countdown"`
}

// RoundEndEvent is sent when a round ends.
type RoundEndEvent struct {
	Winner           *WinnerInfo        `json:"winner,omitempty"`
	FinalLeaderboard []LeaderboardEntry `json:"finalLeaderboard"`
	YourRank         int                `json:"yourRank"`
	YourScore        int                `json:"yourScore"`
	// v11: sovereignty battle results
	WinnerFaction     string             `json:"winnerFaction,omitempty"`
	SovereigntyChange *SovereigntyDelta  `json:"sovereigntyChange,omitempty"`
	TopPlayers        []TopPlayerEntry   `json:"topPlayers,omitempty"`
}

// SovereigntyDelta describes a sovereignty change after a battle.
type SovereigntyDelta struct {
	CountryISO   string `json:"countryIso"`
	OldFaction   string `json:"oldFaction,omitempty"`
	NewFaction   string `json:"newFaction"`
	NewLevel     int    `json:"newLevel"`
	IsNewClaim   bool   `json:"isNewClaim"`
}

// TopPlayerEntry is a summarized player entry for round_end.
type TopPlayerEntry struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Score   int    `json:"score"`
	Kills   int    `json:"kills"`
	Level   int    `json:"level"`
	Alive   bool   `json:"alive"`
	Faction string `json:"faction,omitempty"`
}

// BattleCompleteEvent is sent when cooldown ends and players should return to lobby.
type BattleCompleteEvent struct {
	CountryISO string `json:"countryIso"`
	NextBattle int    `json:"nextBattle,omitempty"` // seconds until next battle (0 = no scheduled)
}

// RoundResetEvent is sent when transitioning between rounds.
type RoundResetEvent struct {
	RoomState RoomState `json:"roomState"`
}

// RoomsUpdateEvent is sent at 1Hz to lobby clients with room info.
type RoomsUpdateEvent struct {
	Rooms         []RoomInfo   `json:"rooms"`
	RecentWinners []WinnerInfo `json:"recentWinners,omitempty"`
}

// --- Map object events ---

// AbilityTriggeredEvent is sent when an ability activates on an agent.
type AbilityTriggeredEvent struct {
	AgentID     string      `json:"agentId"`
	AbilityType AbilityType `json:"abilityType"`
	TargetX     float64     `json:"targetX"`
	TargetY     float64     `json:"targetY"`
	Level       int         `json:"level"`
}

// MapObjectEvent notifies clients about map object state changes.
type MapObjectEvent struct {
	ObjectID string   `json:"objectId"`
	Type     string   `json:"type"` // "shrine", "spring", "altar", "gate"
	Position Position `json:"position"`
	Active   bool     `json:"active"`
	Cooldown int      `json:"cooldown,omitempty"` // seconds until reactivation
}

// MapObjectActivatedEvent notifies that an agent activated a map object.
type MapObjectActivatedEvent struct {
	ObjectID  string `json:"objectId"`
	Type      string `json:"type"`
	AgentID   string `json:"agentId"`
	AgentName string `json:"agentName"`
	Effect    string `json:"effect"`
}

// --- v14: Epoch & Respawn event payloads ---

// EpochStartEvent is sent when a new epoch begins.
type EpochStartEvent struct {
	EpochNumber    int    `json:"epochNumber"`
	Phase          string `json:"phase"`
	DurationSec    int    `json:"durationSec"`
	PeaceDuration  int    `json:"peaceDurationSec"`
	WarDuration    int    `json:"warDurationSec"`
	ShrinkDuration int    `json:"shrinkDurationSec"`
	CountryCode    string `json:"countryCode"`
}

// EpochEndEvent is sent when an epoch ends with results.
type EpochEndEvent struct {
	EpochNumber  int            `json:"epochNumber"`
	CountryCode  string         `json:"countryCode"`
	NationScores map[string]int `json:"nationScores"`
	TopPlayers   []EpochPlayer  `json:"topPlayers"`
}

// EpochPlayer is a player entry in epoch results.
type EpochPlayer struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Nationality string `json:"nationality"`
	Score       int    `json:"score"`
	Kills       int    `json:"kills"`
}

// WarPhaseStartEvent is sent when the war phase begins.
type WarPhaseStartEvent struct {
	EpochNumber int    `json:"epochNumber"`
	WarDuration int    `json:"warDurationSec"`
	CountryCode string `json:"countryCode"`
}

// WarPhaseEndEvent is sent when the war phase ends.
type WarPhaseEndEvent struct {
	EpochNumber int    `json:"epochNumber"`
	CountryCode string `json:"countryCode"`
}

// RespawnCountdownEvent is sent during the 3-second respawn delay.
type RespawnCountdownEvent struct {
	SecondsLeft int `json:"secondsLeft"`
}

// RespawnCompleteEvent is sent when the agent respawns.
type RespawnCompleteEvent struct {
	Spawn           Position `json:"spawn"`
	Tick            uint64   `json:"tick"`
	InvincibleSec   int      `json:"invincibleSec"`
	SpeedPenaltySec int      `json:"speedPenaltySec"`
	Level           int      `json:"level"`
}

// NationScoreUpdateEvent is sent periodically with per-nation scores.
type NationScoreUpdateEvent struct {
	EpochNumber   int            `json:"epochNumber"`
	CountryCode   string         `json:"countryCode"`
	NationScores  map[string]int `json:"nationScores"`
	Phase         string         `json:"phase"`
	TimeRemaining int            `json:"timeRemaining"`
}
