package ws

import (
	"context"
	"log/slog"
)

// Registration holds client + room for Hub registration.
type Registration struct {
	Client *Client
	RoomID string
}

// BroadcastMsg sends data to all connected clients.
type BroadcastMsg struct {
	Data []byte
}

// RoomcastMsg sends data to all clients in a specific room.
type RoomcastMsg struct {
	RoomID  string
	Data    []byte
	Exclude string // client ID to exclude (optional)
}

// UnicastMsg sends data to a specific client.
type UnicastMsg struct {
	ClientID string
	Data     []byte
}

// MoveClientMsg moves a client to a different room by client ID.
type MoveClientMsg struct {
	ClientID string
	RoomID   string
}

// Hub manages WebSocket client registrations and message routing.
// It runs as a single goroutine using channels (lock-free).
type Hub struct {
	// rooms maps roomID → set of clients
	rooms map[string]map[*Client]bool

	// clientRoom maps client → roomID for fast lookup
	clientRoom map[*Client]string

	// clientByID maps clientID → client for unicast
	clientByID map[string]*Client

	// Channels
	Register   chan *Registration
	Unregister chan *Client
	Broadcast  chan *BroadcastMsg
	Roomcast   chan *RoomcastMsg
	Unicast    chan *UnicastMsg
	MoveClient chan *MoveClientMsg

	done chan struct{}
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		clientRoom: make(map[*Client]string),
		clientByID: make(map[string]*Client),
		Register:   make(chan *Registration, 64),
		Unregister: make(chan *Client, 64),
		Broadcast:  make(chan *BroadcastMsg, 256),
		Roomcast:   make(chan *RoomcastMsg, 256),
		Unicast:    make(chan *UnicastMsg, 256),
		MoveClient: make(chan *MoveClientMsg, 64),
		done:       make(chan struct{}),
	}
}

// Run starts the Hub event loop. Blocks until Stop() is called or context is cancelled.
func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			h.cleanup()
			return
		case <-h.done:
			h.cleanup()
			return

		case reg := <-h.Register:
			h.register(reg)

		case client := <-h.Unregister:
			h.unregister(client)

		case msg := <-h.Broadcast:
			h.broadcast(msg)

		case msg := <-h.Roomcast:
			h.roomcast(msg)

		case msg := <-h.Unicast:
			h.unicast(msg)

		case msg := <-h.MoveClient:
			h.moveClient(msg)
		}
	}
}

// Stop signals the Hub to stop.
func (h *Hub) Stop() {
	select {
	case <-h.done:
		// already stopped
	default:
		close(h.done)
	}
}

func (h *Hub) register(reg *Registration) {
	// Remove from previous room if any
	if prevRoom, ok := h.clientRoom[reg.Client]; ok {
		if clients, ok := h.rooms[prevRoom]; ok {
			delete(clients, reg.Client)
			if len(clients) == 0 {
				delete(h.rooms, prevRoom)
			}
		}
	}

	// Add to new room
	if h.rooms[reg.RoomID] == nil {
		h.rooms[reg.RoomID] = make(map[*Client]bool)
	}
	h.rooms[reg.RoomID][reg.Client] = true
	h.clientRoom[reg.Client] = reg.RoomID
	h.clientByID[reg.Client.ID] = reg.Client
	reg.Client.RoomID = reg.RoomID

	slog.Debug("client registered", "clientID", reg.Client.ID, "roomID", reg.RoomID)
}

func (h *Hub) unregister(client *Client) {
	if roomID, ok := h.clientRoom[client]; ok {
		if clients, ok := h.rooms[roomID]; ok {
			delete(clients, client)
			if len(clients) == 0 {
				delete(h.rooms, roomID)
			}
		}
		delete(h.clientRoom, client)
	}
	delete(h.clientByID, client.ID)

	// Close the send channel (signals WritePump to exit)
	select {
	case <-client.done:
		// already closed
	default:
		close(client.done)
	}

	slog.Debug("client unregistered", "clientID", client.ID)
}

func (h *Hub) broadcast(msg *BroadcastMsg) {
	for _, clients := range h.rooms {
		for client := range clients {
			h.trySend(client, msg.Data)
		}
	}
}

func (h *Hub) roomcast(msg *RoomcastMsg) {
	clients, ok := h.rooms[msg.RoomID]
	if !ok {
		return
	}
	for client := range clients {
		if msg.Exclude != "" && client.ID == msg.Exclude {
			continue
		}
		h.trySend(client, msg.Data)
	}
}

func (h *Hub) unicast(msg *UnicastMsg) {
	client, ok := h.clientByID[msg.ClientID]
	if !ok {
		return
	}
	h.trySend(client, msg.Data)
}

// moveClient moves a client to a different room by clientID string.
func (h *Hub) moveClient(msg *MoveClientMsg) {
	client, ok := h.clientByID[msg.ClientID]
	if !ok {
		return
	}
	h.register(&Registration{
		Client: client,
		RoomID: msg.RoomID,
	})
}

// GetClientRoom returns the current room of a client (for use via channel if needed).
func (h *Hub) GetClientRoom(clientID string) string {
	// NOTE: This is NOT goroutine-safe. Use only from Hub goroutine or with proper synchronization.
	client, ok := h.clientByID[clientID]
	if !ok {
		return ""
	}
	return h.clientRoom[client]
}

// trySend attempts a non-blocking send on the client's send channel.
// If the buffer is full, the client is evicted.
func (h *Hub) trySend(client *Client, data []byte) {
	select {
	case client.send <- data:
		// sent
	default:
		// Buffer overflow — evict the slow client
		slog.Warn("client buffer overflow, evicting", "clientID", client.ID)
		h.unregister(client)
	}
}

// cleanup closes all client connections.
func (h *Hub) cleanup() {
	for _, clients := range h.rooms {
		for client := range clients {
			select {
			case <-client.done:
			default:
				close(client.done)
			}
		}
	}
	h.rooms = make(map[string]map[*Client]bool)
	h.clientRoom = make(map[*Client]string)
	h.clientByID = make(map[string]*Client)
}

// GetRoomClientCount returns the number of clients in a room.
func (h *Hub) GetRoomClientCount(roomID string) int {
	if clients, ok := h.rooms[roomID]; ok {
		return len(clients)
	}
	return 0
}
