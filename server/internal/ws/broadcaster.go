package ws

// HubBroadcaster adapts the Hub to the game.Broadcaster interface.
// This lives in the ws package to avoid circular imports (game -> ws).
type HubBroadcaster struct {
	Hub *Hub
}

// RegisterClient moves a client to a room (by client ID).
func (hb *HubBroadcaster) RegisterClient(clientID, roomID string) {
	hb.Hub.MoveClient <- &MoveClientMsg{
		ClientID: clientID,
		RoomID:   roomID,
	}
}

// UnregisterToLobby moves a client back to the lobby.
func (hb *HubBroadcaster) UnregisterToLobby(clientID string) {
	hb.Hub.MoveClient <- &MoveClientMsg{
		ClientID: clientID,
		RoomID:   "lobby",
	}
}

// SendToClient sends raw data to a specific client.
func (hb *HubBroadcaster) SendToClient(clientID string, data []byte) {
	hb.Hub.Unicast <- &UnicastMsg{
		ClientID: clientID,
		Data:     data,
	}
}

// SendToRoom sends raw data to all clients in a room.
func (hb *HubBroadcaster) SendToRoom(roomID string, data []byte, excludeID string) {
	hb.Hub.Roomcast <- &RoomcastMsg{
		RoomID:  roomID,
		Data:    data,
		Exclude: excludeID,
	}
}

// BroadcastAll sends raw data to all connected clients.
func (hb *HubBroadcaster) BroadcastAll(data []byte) {
	hb.Hub.Broadcast <- &BroadcastMsg{
		Data: data,
	}
}
