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
}

// StateAgent is the per-tick serialized agent data sent to clients.
type StateAgent struct {
	ID          string   `json:"id"`
	X           float64  `json:"x"`
	Y           float64  `json:"y"`
	Heading     float64  `json:"h"`
	Mass        float64  `json:"m"`
	Boosting    bool     `json:"b,omitempty"`
	Alive       bool     `json:"a"`
	Level       int      `json:"l"`
	Name        string   `json:"n"`
	SkinID      int      `json:"sk"`
	IsBot       bool     `json:"bot,omitempty"`
	KillStreak  int      `json:"ks,omitempty"`
	HitboxRadius float64 `json:"hr"`
}

// StateOrb is the per-tick serialized orb data sent to clients.
type StateOrb struct {
	ID    string  `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Value float64 `json:"v"`
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
