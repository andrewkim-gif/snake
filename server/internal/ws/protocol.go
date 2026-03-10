package ws

import (
	"encoding/json"
	"fmt"
	"log/slog"
)

// --- Event names (client → server) ---
const (
	EventJoinRoom       = "join_room"
	EventLeaveRoom      = "leave_room"
	EventInput          = "input"
	EventRespawn        = "respawn"
	EventPing           = "ping"
	EventChooseUpgrade  = "choose_upgrade"

	// v14: New client → server events
	EventSelectNationality  = "select_nationality"
	EventJoinCountryArena   = "join_country_arena"
	EventSwitchArena        = "switch_arena"
	EventDeclareWar         = "declare_war"

	// v19: Arena combat events (client → server)
	EventARInput  = "ar_input"  // arena combat movement input
	EventARChoose = "ar_choose" // arena tome/weapon choice

	// Agent-specific events (client → server)
	EventAgentAuth          = "agent_auth"
	EventAgentCommand       = "agent_command"
	EventAgentChooseUpgrade = "agent_choose_upgrade"
	EventAgentObserveReq    = "observe_game" // agent requests game observation
)

// --- Event names (server → client) ---
const (
	EventJoined           = "joined"
	EventState            = "state"
	EventDeath            = "death"
	EventKill             = "kill"
	EventMinimap          = "minimap"
	EventPong             = "pong"
	EventRoomsUpdate      = "rooms_update"
	EventRoundStart       = "round_start"
	EventRoundEnd         = "round_end"
	EventRoundReset       = "round_reset"
	EventLevelUp          = "level_up"
	EventSynergyActivated = "synergy_activated"
	EventArenaShrink      = "arena_shrink"
	EventError            = "error"
	EventCountriesState   = "countries_state"
	EventBattleComplete   = "battle_complete" // v11: cooldown ended, return to lobby

	// Agent-specific events (server → client)
	EventAgentAuthResult    = "agent_auth_result"
	EventAgentLevelUp       = "agent_level_up"
	EventAgentObserveGame   = "agent_observe_game"
	EventTrainingUpdate     = "training_update"

	// Coach/Analyst events (server → client) (S57, S58)
	EventCoachMessage       = "coach_message"
	EventRoundAnalysis      = "round_analysis"

	// v12: ability effect events (server → client)
	EventAbilityTriggered   = "ability_triggered"

	// v14: Epoch & respawn events (server → client)
	EventEpochStart         = "epoch_start"
	EventEpochEnd           = "epoch_end"
	EventWarPhaseStart      = "war_phase_start"
	EventWarPhaseEnd        = "war_phase_end"
	EventRespawnCountdown   = "respawn_countdown"
	EventRespawnComplete    = "respawn_complete"
	EventNationScoreUpdate  = "nation_score_update"
	EventWarDeclared        = "war_declared"
	EventWarEnded           = "war_ended"
	EventCapturePointUpdate = "capture_point_update"

	// v19: Arena combat events (server → client)
	EventARState         = "ar_state"           // 20Hz arena combat state
	EventARDamage        = "ar_damage"          // damage number event
	EventARLevelUp       = "ar_level_up"        // tome/weapon choice prompt
	EventARKill          = "ar_kill"            // enemy kill notification
	EventARPhaseChange   = "ar_phase_change"    // phase transition
	EventARBattleEnd     = "ar_battle_end"      // arena battle ended

	// v15: Globe effects events (server → client)
	EventDominationUpdate = "domination_update"
	EventTradeRouteUpdate = "trade_route_update"

	// v26: City simulation events (server → client)
	EventCityState      = "city_state"       // 2Hz city state broadcast
	EventCityEvent      = "city_event"       // city event notification (building complete, etc.)
	EventCityGlobeSync  = "city_globe_sync"  // Phase 8: Iso→Globe data sync (GDP, pop, happiness per country)

	// v26: City simulation events (client → server)
	EventCityCommand   = "city_command"   // build/demolish/upgrade/toggle
	EventCitySubscribe = "city_subscribe" // subscribe to a city's state updates
	EventCityUnsubscribe = "city_unsubscribe" // unsubscribe from a city

	// v33: Matrix online events (client → server)
	EventMatrixJoin    = "matrix_join"     // join a country's Matrix arena
	EventMatrixLeave   = "matrix_leave"    // leave Matrix arena
	EventMatrixInput   = "matrix_input"    // player position+input (10Hz)
	EventMatrixKill    = "matrix_kill"     // kill report (server validates)
	EventMatrixDamage  = "matrix_damage"   // PvP damage report
	EventMatrixCapture = "matrix_capture"  // capture point entry
	EventMatrixLevelUp = "matrix_level_up" // level-up skill/weapon choice

	// v33: Matrix online events (server → client)
	EventMatrixState         = "matrix_state"          // 20Hz world state (delta/full)
	EventMatrixEpoch         = "matrix_epoch"          // epoch phase transition
	EventMatrixSpawnSeed     = "matrix_spawn_seed"     // deterministic monster spawn seed
	EventMatrixKillConfirmed = "matrix_kill_confirmed"  // kill validated by server
	EventMatrixKillRejected  = "matrix_kill_rejected"   // kill rejected (anti-cheat)
	EventMatrixScore         = "matrix_score"           // real-time scoreboard
	EventMatrixResult        = "matrix_result"          // epoch end result + rewards
	EventMatrixLevelUpChoices = "matrix_level_up_choices" // server-generated level-up options
	EventMatrixBuff          = "matrix_buff"            // active token buffs
)

// Frame is the JSON wire format: {"e":"event_name","d":{...}}
type Frame struct {
	Event string          `json:"e"`
	Data  json.RawMessage `json:"d"`
}

// ParseFrame decodes a raw websocket message into a Frame.
func ParseFrame(raw []byte) (*Frame, error) {
	var f Frame
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, fmt.Errorf("invalid frame: %w", err)
	}
	if f.Event == "" {
		return nil, fmt.Errorf("missing event field 'e'")
	}
	return &f, nil
}

// EncodeFrame creates a JSON wire frame from an event name and payload.
func EncodeFrame(event string, data interface{}) ([]byte, error) {
	d, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	frame := Frame{
		Event: event,
		Data:  d,
	}
	return json.Marshal(frame)
}

// EventHandler handles a specific event type from a client.
type EventHandler func(client *Client, data json.RawMessage)

// EventRouter routes incoming events to their handlers.
type EventRouter struct {
	handlers map[string]EventHandler
}

// NewEventRouter creates a new event router.
func NewEventRouter() *EventRouter {
	return &EventRouter{
		handlers: make(map[string]EventHandler),
	}
}

// On registers a handler for a specific event name.
func (r *EventRouter) On(event string, handler EventHandler) {
	r.handlers[event] = handler
}

// HandleMessage parses a raw message, applies rate limiting, and routes to the correct handler.
func (r *EventRouter) HandleMessage(client *Client, raw []byte) {
	frame, err := ParseFrame(raw)
	if err != nil {
		slog.Warn("invalid frame", "clientId", client.ID, "error", err)
		return
	}

	// Rate limit check — silently drop if exceeded
	if !client.CheckRateLimit(frame.Event) {
		return
	}

	handler, ok := r.handlers[frame.Event]
	if !ok {
		// Unknown events are silently ignored
		slog.Debug("unknown event", "clientId", client.ID, "event", frame.Event)
		return
	}

	handler(client, frame.Data)
}

// --- Client → Server payload types ---

// JoinRoomPayload is sent by the client to join a game room.
type JoinRoomPayload struct {
	RoomID     string `json:"roomId"`
	Name       string `json:"name"`
	SkinID     int    `json:"skinId"`
	Appearance string `json:"appearance,omitempty"` // v10 Phase 2: packed BigInt string (pass-through)
}

// InputPayload is sent by the client at 30Hz with movement data.
// v16: Supports both legacy {a,b,s} and new {ma,aa,b,d,j,s} formats.
// Backward compat: if MoveAngle is nil (ma absent) and Angle is set, both move/aim use Angle.
type InputPayload struct {
	Angle     float64  `json:"a"`              // legacy: heading angle in radians (v15 compat)
	MoveAngle *float64 `json:"ma,omitempty"`   // v16: move direction angle (WASD-based), nil = use legacy 'a'
	AimAngle  *float64 `json:"aa,omitempty"`   // v16: aim/facing angle (mouse-based), nil = use legacy 'a'
	Boost     int      `json:"b"`              // 0 = no boost, 1 = boost
	Dash      int      `json:"d,omitempty"`    // v16: 0 = no dash, 1 = dash (E key, triggers PerformDash)
	Jump      int      `json:"j,omitempty"`    // v16: 0 = no jump, 1 = jump (Space key, Phase 6)
	Seq       int      `json:"s"`              // sequence number for reconciliation
}

// GetMoveAngle returns the effective move angle (v16 ma field, or legacy a fallback).
func (p *InputPayload) GetMoveAngle() float64 {
	if p.MoveAngle != nil {
		return *p.MoveAngle
	}
	return p.Angle
}

// GetAimAngle returns the effective aim angle (v16 aa field, or legacy a fallback).
func (p *InputPayload) GetAimAngle() float64 {
	if p.AimAngle != nil {
		return *p.AimAngle
	}
	return p.Angle
}

// RespawnPayload is sent by the client to request respawn.
type RespawnPayload struct {
	Name       string `json:"name,omitempty"`
	SkinID     int    `json:"skinId,omitempty"`
	Appearance string `json:"appearance,omitempty"` // v10 Phase 2: packed BigInt string (pass-through)
}

// PingPayload is sent by the client for latency measurement.
type PingPayload struct {
	T int64 `json:"t"` // client timestamp
}

// ChooseUpgradePayload is sent by the client to select a level-up upgrade.
type ChooseUpgradePayload struct {
	ChoiceID string `json:"choiceId"`
}

// AgentAuthPayload is sent by an agent to authenticate via API key.
type AgentAuthPayload struct {
	APIKey  string `json:"apiKey"`
	AgentID string `json:"agentId"`
}

// AgentChooseUpgradePayload is sent by an agent to select a level-up upgrade.
type AgentChooseUpgradePayload struct {
	ChoiceIndex int    `json:"choiceIndex"` // 0, 1, or 2
	Reasoning   string `json:"reasoning,omitempty"`
}

// AgentCommandPayload is sent by an agent to issue a commander mode command.
type AgentCommandPayload struct {
	Cmd  string          `json:"cmd"`
	Data json.RawMessage `json:"data,omitempty"`
}

// SelectNationalityPayload is sent by the client to set nationality.
type SelectNationalityPayload struct {
	Nationality string `json:"nationality"`
}

// JoinCountryArenaPayload is sent by the client to join a country arena.
type JoinCountryArenaPayload struct {
	CountryCode string `json:"countryCode"`
	Name        string `json:"name"`
	SkinID      int    `json:"skinId"`
	Appearance  string `json:"appearance,omitempty"`
	Nationality string `json:"nationality"`
}

// ARInputPayload is sent by the client with arena combat movement (v19).
type ARInputPayload struct {
	DirX  float64 `json:"dirX"`  // -1..1
	DirZ  float64 `json:"dirZ"`  // -1..1
	Jump  bool    `json:"jump"`
	Slide bool    `json:"slide"`
	AimY  float64 `json:"aimY"` // camera yaw radians
}

// ARChoosePayload is sent by the client to select a tome/weapon during level-up (v19).
type ARChoosePayload struct {
	TomeID   string `json:"tomeId,omitempty"`
	WeaponID string `json:"weaponId,omitempty"`
}

// --- Server → Client payload types ---

// PongPayload is the response to a ping.
type PongPayload struct {
	T  int64 `json:"t"`  // echo client timestamp
	ST int64 `json:"st"` // server timestamp
}

// ErrorPayload is sent to inform the client of an error.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// --- v26: City simulation payload types ---

// CityCommandPayload is sent by the client to issue a city command.
type CityCommandPayload struct {
	ISO3       string `json:"iso3"`
	Type       string `json:"type"`       // "build", "demolish", "upgrade", "toggle"
	BuildingID string `json:"buildingId"` // for demolish/upgrade/toggle
	DefID      string `json:"defId"`      // for build
	TileX      int    `json:"tileX"`      // for build
	TileY      int    `json:"tileY"`      // for build
}

// CitySubscribePayload is sent by the client to subscribe to a city.
type CitySubscribePayload struct {
	ISO3 string `json:"iso3"`
}

// CityUnsubscribePayload is sent by the client to unsubscribe from a city.
type CityUnsubscribePayload struct {
	ISO3 string `json:"iso3"`
}

// --- v33: Matrix online payload types (client → server) ---

// MatrixJoinPayload is sent by the client to join a Matrix arena.
type MatrixJoinPayload struct {
	CountryCode string `json:"countryCode"`
	Build       string `json:"build,omitempty"`
	AgentID     string `json:"agentId,omitempty"`
}

// MatrixLeavePayload is sent by the client to leave a Matrix arena.
type MatrixLeavePayload struct{}

// MatrixInputPayload is sent at 10Hz with position+input data.
type MatrixInputPayload struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Angle float64 `json:"angle"`
	Boost bool    `json:"boost"`
	Tick  uint64  `json:"tick"`
}

// MatrixKillPayload is the client's kill report for server validation.
type MatrixKillPayload struct {
	TargetID string  `json:"targetId"`
	WeaponID string  `json:"weaponId"`
	Damage   float64 `json:"damage"`
	Distance float64 `json:"distance"`
	Tick     uint64  `json:"tick"`
}

// MatrixDamagePayload is the client's PvP damage report.
type MatrixDamagePayload struct {
	TargetID string  `json:"targetId"`
	WeaponID string  `json:"weaponId"`
	Damage   float64 `json:"damage"`
	Tick     uint64  `json:"tick"`
}

// MatrixCapturePayload is sent when a player enters a capture point.
type MatrixCapturePayload struct {
	PointID string `json:"pointId"`
}

// MatrixLevelUpPayload is sent when a player selects a level-up choice.
type MatrixLevelUpPayload struct {
	ChoiceID string `json:"choiceId"`
}

// --- v15: Globe effects message structs ---

// DominationUpdateMsg is the payload for domination_update S2C events.
type DominationUpdateMsg struct {
	Countries []DominationCountryData `json:"countries"`
}

// DominationCountryData holds per-country domination state for broadcast.
type DominationCountryData struct {
	CountryCode    string `json:"countryCode"`
	DominantNation string `json:"dominantNation"`
	Status         string `json:"status"` // "none", "sovereignty", "hegemony"
	Level          int    `json:"level"`  // 0-2 (none, sov, heg)
}

// TradeRouteUpdateMsg is the payload for trade_route_update S2C events.
type TradeRouteUpdateMsg struct {
	From     string `json:"from"`     // ISO3 seller country
	To       string `json:"to"`       // ISO3 buyer country
	Type     string `json:"type"`     // "sea" | "land"
	Volume   int64  `json:"volume"`   // trade quantity
	Resource string `json:"resource"` // "oil" | "minerals" | "food" | "tech" | "manpower"
}
