package domain

// ─── Client → Server Payloads ───

// JoinRoomPayload is sent by the client to join a room.
type JoinRoomPayload struct {
	RoomID string `json:"roomId"`
	Name   string `json:"name"`
	SkinID int    `json:"skinId"`
}

// InputPayload is the per-tick input from the client.
// Fields use compact names for bandwidth.
type InputPayload struct {
	A float64 `json:"a"` // target angle (0~2π)
	B int     `json:"b"` // boost flag (0 or 1)
	S int     `json:"s"` // sequence number
}

// RespawnPayload is sent to request a respawn.
type RespawnPayload struct {
	Name   string `json:"name,omitempty"`
	SkinID *int   `json:"skinId,omitempty"`
}

// ChooseUpgradePayload selects an upgrade choice.
type ChooseUpgradePayload struct {
	ChoiceID string `json:"choiceId"`
}

// PingPayload is for latency measurement.
type PingPayload struct {
	T int64 `json:"t"`
}

// ─── Server → Client Payloads ───

// JoinedPayload confirms room join.
type JoinedPayload struct {
	RoomID        string     `json:"roomId"`
	ID            string     `json:"id"`
	Spawn         Position   `json:"spawn"`
	Arena         ArenaInfo  `json:"arena"`
	Tick          uint64     `json:"tick"`
	RoomState     RoomStatus `json:"roomState"`
	TimeRemaining int        `json:"timeRemaining"`
}

// ArenaInfo is the arena summary sent on join.
type ArenaInfo struct {
	Radius   float64 `json:"radius"`
	OrbCount int     `json:"orbCount"`
}

// AgentNetworkData is the compressed agent state for network transfer.
type AgentNetworkData struct {
	I  string    `json:"i"`            // id
	N  string    `json:"n"`            // name
	X  float64   `json:"x"`            // position.x
	Y  float64   `json:"y"`            // position.y
	H  float64   `json:"h"`            // heading
	M  float64   `json:"m"`            // mass
	B  bool      `json:"b"`            // boosting
	K  int       `json:"k"`            // skin id
	LV int       `json:"lv"`           // level
	E  []int     `json:"e,omitempty"`  // activeEffects [type, remainingTicks, ...]
	P  [][]float64 `json:"p,omitempty"` // segments compat [[x,y]]
}

// OrbNetworkData is the compressed orb state for network transfer.
type OrbNetworkData struct {
	X float64 `json:"x"` // position.x
	Y float64 `json:"y"` // position.y
	V float64 `json:"v"` // value
	C int     `json:"c"` // color index
	T int     `json:"t"` // type (0=natural, 1=death, ...)
}

// MapObjectNetworkData is the compressed map object state for network transfer.
type MapObjectNetworkData struct {
	ID     string  `json:"id"`
	Type   string  `json:"type"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	R      float64 `json:"r"`      // radius
	Active bool    `json:"active"`
}

// StatePayload is the main game state broadcast (20Hz).
type StatePayload struct {
	T uint64                `json:"t"`            // server tick
	S []AgentNetworkData    `json:"s"`            // visible agents
	O []OrbNetworkData      `json:"o"`            // visible orbs
	L []LeaderEntry         `json:"l,omitempty"`  // leaderboard (periodic)
	MO []MapObjectNetworkData `json:"mo,omitempty"` // map objects (periodic)
}

// DeathPayload notifies the client of their death.
type DeathPayload struct {
	Score        int          `json:"score"`
	Kills        int          `json:"kills"`
	Duration     float64      `json:"duration"` // survival seconds
	Rank         int          `json:"rank"`
	Killer       string       `json:"killer,omitempty"`
	DamageSource DamageSource `json:"damageSource,omitempty"`
	Level        int          `json:"level,omitempty"`
}

// KillPayload notifies the client of a kill they made.
type KillPayload struct {
	Victim     string  `json:"victim"`
	VictimMass float64 `json:"victimMass"`
}

// MinimapPayload is the minimap data (1Hz).
type MinimapPayload struct {
	Snakes   []MinimapAgent `json:"snakes"`
	Boundary float64        `json:"boundary"`
}

// MinimapAgent is a compact representation for the minimap.
type MinimapAgent struct {
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	M  float64 `json:"m"`
	Me bool    `json:"me"`
}

// PongPayload is the server's pong response.
type PongPayload struct {
	T  int64 `json:"t"`  // echoed client timestamp
	ST int64 `json:"st"` // server timestamp
}

// RoomsUpdatePayload is the lobby room list (1Hz).
type RoomsUpdatePayload struct {
	Rooms         []RoomInfo     `json:"rooms"`
	RecentWinners []RecentWinner `json:"recentWinners"`
}

// RoundStartPayload is sent when countdown begins.
type RoundStartPayload struct {
	Countdown int `json:"countdown"`
}

// RoundEndPayload is sent when a round ends.
type RoundEndPayload struct {
	Winner           *WinnerInfo  `json:"winner"`
	FinalLeaderboard []LeaderEntry `json:"finalLeaderboard"`
	YourRank         int           `json:"yourRank"`
	YourScore        int           `json:"yourScore"`
}

// RoundResetPayload is sent when transitioning to the next round.
type RoundResetPayload struct {
	RoomState RoomStatus `json:"roomState"`
}

// LevelUpPayload presents upgrade choices on level-up.
type LevelUpPayload struct {
	Level        int             `json:"level"`
	Choices      []UpgradeChoice `json:"choices"`
	TimeoutTicks int             `json:"timeoutTicks"`
	// Agent API: current build info (included for external agent clients)
	Build    *PlayerBuild `json:"build,omitempty"`
	Synergies []string    `json:"synergies,omitempty"`
}

// SynergyActivatedPayload notifies when a synergy is achieved.
type SynergyActivatedPayload struct {
	SynergyID   string `json:"synergyId"`
	SynergyName string `json:"synergyName"`
	Description string `json:"description"`
}

// ArenaShrinkPayload is the periodic arena shrink update.
type ArenaShrinkPayload struct {
	CurrentRadius float64 `json:"currentRadius"`
	MinRadius     float64 `json:"minRadius"`
	ShrinkRate    float64 `json:"shrinkRate"` // px/min
}

// ErrorPayload reports errors to the client.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error codes
const (
	ErrArenaFull      = "ARENA_FULL"
	ErrInvalidName    = "INVALID_NAME"
	ErrRateLimited    = "RATE_LIMITED"
	ErrKicked         = "KICKED"
	ErrRoomFull       = "ROOM_FULL"
	ErrRoomNotFound   = "ROOM_NOT_FOUND"
	ErrAlreadyInRoom  = "ALREADY_IN_ROOM"
	ErrNotInRoom      = "NOT_IN_ROOM"
	ErrRoomNotJoinable = "ROOM_NOT_JOINABLE"
)
