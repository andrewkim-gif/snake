package ws

import (
	"encoding/json"
	"log/slog"
)

// EventDispatcher routes incoming client events to the appropriate handlers.
// It uses interfaces/callbacks to avoid importing the game package.
type EventDispatcher struct {
	// JoinRoom handles join_room events: (clientID, roomID, name, skinID)
	JoinRoom func(clientID, roomID, name string, skinID int)

	// LeaveRoom handles leave_room events: (clientID)
	LeaveRoom func(clientID string)

	// Input handles input events: (clientID, roomID, angle, boost, seq)
	Input func(clientID, roomID string, angle float64, boost, seq int)

	// Respawn handles respawn events: (clientID, roomID, name, skinID)
	Respawn func(clientID, roomID string, name string, skinID int)

	// ChooseUpgrade handles choose_upgrade events: (clientID, roomID, choiceID)
	ChooseUpgrade func(clientID, roomID, choiceID string)
}

// HandleMessage routes a client event to the appropriate dispatcher function.
func (d *EventDispatcher) HandleMessage(client *Client, event string, data json.RawMessage) {
	switch event {
	case EventJoinRoom:
		d.handleJoinRoom(client, data)
	case EventLeaveRoom:
		d.handleLeaveRoom(client)
	case EventInput:
		d.handleInput(client, data)
	case EventRespawn:
		d.handleRespawn(client, data)
	case EventChooseUpgrade:
		d.handleChooseUpgrade(client, data)
	default:
		slog.Debug("unknown event", "clientID", client.ID, "event", event)
		client.SendError("UNKNOWN_EVENT", "unknown event: "+event)
	}
}

func (d *EventDispatcher) handleJoinRoom(client *Client, data json.RawMessage) {
	if d.JoinRoom == nil {
		return
	}

	var payload struct {
		RoomID string `json:"roomId"`
		Name   string `json:"name"`
		SkinID int    `json:"skinId"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		client.SendError("INVALID_PAYLOAD", "invalid join_room payload")
		return
	}

	if payload.Name == "" {
		client.SendError("INVALID_NAME", "name is required")
		return
	}

	// Truncate name
	if len(payload.Name) > 20 {
		payload.Name = payload.Name[:20]
	}

	d.JoinRoom(client.ID, payload.RoomID, payload.Name, payload.SkinID)
}

func (d *EventDispatcher) handleLeaveRoom(client *Client) {
	if d.LeaveRoom == nil {
		return
	}
	d.LeaveRoom(client.ID)
}

func (d *EventDispatcher) handleInput(client *Client, data json.RawMessage) {
	if d.Input == nil {
		return
	}

	var payload struct {
		A float64 `json:"a"` // angle
		B int     `json:"b"` // boost
		S int     `json:"s"` // seq
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return // silently drop bad input
	}

	d.Input(client.ID, client.RoomID, payload.A, payload.B, payload.S)
}

func (d *EventDispatcher) handleRespawn(client *Client, data json.RawMessage) {
	if d.Respawn == nil {
		return
	}

	var payload struct {
		Name   string `json:"name,omitempty"`
		SkinID int    `json:"skinId"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	d.Respawn(client.ID, client.RoomID, payload.Name, payload.SkinID)
}

func (d *EventDispatcher) handleChooseUpgrade(client *Client, data json.RawMessage) {
	if d.ChooseUpgrade == nil {
		return
	}

	var payload struct {
		ChoiceID string `json:"choiceId"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	d.ChooseUpgrade(client.ID, client.RoomID, payload.ChoiceID)
}
