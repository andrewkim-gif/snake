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
type InputPayload struct {
	Angle float64 `json:"a"` // heading angle in radians
	Boost int     `json:"b"` // 0 = no boost, 1 = boost
	Seq   int     `json:"s"` // sequence number for reconciliation
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
