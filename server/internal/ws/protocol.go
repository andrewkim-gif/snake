package ws

import (
	"encoding/json"
	"fmt"
)

// Frame is the JSON wire format for WebSocket messages: {"e": "event", "d": {...}}
type Frame struct {
	E string          `json:"e"` // event name
	D json.RawMessage `json:"d"` // event data
}

// ParseFrame decodes a raw message into event name + raw payload.
func ParseFrame(data []byte) (string, json.RawMessage, error) {
	var f Frame
	if err := json.Unmarshal(data, &f); err != nil {
		return "", nil, fmt.Errorf("parse frame: %w", err)
	}
	if f.E == "" {
		return "", nil, fmt.Errorf("parse frame: missing event name")
	}
	return f.E, f.D, nil
}

// MakeFrame serializes an event + data into the JSON wire format.
func MakeFrame(event string, data interface{}) ([]byte, error) {
	d, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("make frame: marshal data: %w", err)
	}
	f := Frame{
		E: event,
		D: json.RawMessage(d),
	}
	return json.Marshal(f)
}

// MakeFrameRaw creates a frame with pre-serialized data.
func MakeFrameRaw(event string, rawData json.RawMessage) ([]byte, error) {
	f := Frame{
		E: event,
		D: rawData,
	}
	return json.Marshal(f)
}

// Event name constants
const (
	// Client → Server
	EventJoinRoom       = "join_room"
	EventLeaveRoom      = "leave_room"
	EventInput          = "input"
	EventRespawn        = "respawn"
	EventChooseUpgrade  = "choose_upgrade"
	EventPing           = "ping"

	// Client → Server (agent API)
	EventObserveGame = "observe_game"

	// Server → Client
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
	EventCoachMessage     = "coach_message"
	EventRoundAnalysis    = "round_analysis"
	EventError            = "error"
)
