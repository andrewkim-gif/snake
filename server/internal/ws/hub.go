package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
)

// Registration carries data for registering a client into a room.
type Registration struct {
	Client *Client
	RoomID string
}

// BroadcastMsg sends a message to all connected clients.
type BroadcastMsg struct {
	Data []byte
}

// RoomcastMsg sends a message to all clients in a specific room.
type RoomcastMsg struct {
	RoomID  string
	Data    []byte
	Exclude string // client ID to exclude (optional)
}

// UnicastMsg sends a message to a specific client.
type UnicastMsg struct {
	ClientID string
	Data     []byte
}

// Hub manages WebSocket clients and routes messages.
// It runs on a single goroutine using channels (lock-free).
type Hub struct {
	// rooms maps roomID → set of clients in that room.
	rooms map[string]map[*Client]bool

	// lobby clients not in any game room.
	lobby map[*Client]bool

	// allClients maps clientID → *Client for unicast lookups.
	allClients map[string]*Client

	// Channels for client lifecycle.
	register   chan *Registration
	unregister chan *Client

	// Channels for messaging.
	broadcast chan *BroadcastMsg
	roomcast  chan *RoomcastMsg
	unicast   chan *UnicastMsg

	// done signals the hub to stop.
	done chan struct{}

	// mu protects client count reads from outside the hub goroutine.
	mu sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		lobby:      make(map[*Client]bool),
		allClients: make(map[string]*Client),
		register:   make(chan *Registration, 256),
		unregister: make(chan *Client, 256),
		broadcast:  make(chan *BroadcastMsg, 256),
		roomcast:   make(chan *RoomcastMsg, 256),
		unicast:    make(chan *UnicastMsg, 256),
		done:       make(chan struct{}),
	}
}

// Run starts the hub event loop. Call this in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case reg := <-h.register:
			h.handleRegister(reg)

		case client := <-h.unregister:
			h.handleUnregister(client)

		case msg := <-h.broadcast:
			h.handleBroadcast(msg)

		case msg := <-h.roomcast:
			h.handleRoomcast(msg)

		case msg := <-h.unicast:
			h.handleUnicast(msg)

		case <-h.done:
			// Close all client connections
			for _, client := range h.allClients {
				close(client.send)
			}
			return
		}
	}
}

// Stop signals the hub to shut down.
func (h *Hub) Stop() {
	close(h.done)
}

// Register queues a client registration into a room.
func (h *Hub) Register(client *Client, roomID string) {
	h.register <- &Registration{Client: client, RoomID: roomID}
}

// RegisterLobby queues a client registration into the lobby (no game room).
func (h *Hub) RegisterLobby(client *Client) {
	h.register <- &Registration{Client: client, RoomID: ""}
}

// Unregister queues a client for removal.
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// BroadcastAll sends a message to all connected clients (lobby + rooms).
func (h *Hub) BroadcastAll(data []byte) {
	h.broadcast <- &BroadcastMsg{Data: data}
}

// BroadcastToRoom sends a message to all clients in a specific room.
func (h *Hub) BroadcastToRoom(roomID string, data []byte) {
	h.roomcast <- &RoomcastMsg{RoomID: roomID, Data: data}
}

// BroadcastToRoomExcept sends a message to all clients in a room except one.
func (h *Hub) BroadcastToRoomExcept(roomID string, data []byte, excludeID string) {
	h.roomcast <- &RoomcastMsg{RoomID: roomID, Data: data, Exclude: excludeID}
}

// BroadcastToLobby sends a message to all lobby (non-room) clients.
func (h *Hub) BroadcastToLobby(data []byte) {
	h.roomcast <- &RoomcastMsg{RoomID: "__lobby__", Data: data}
}

// SendToClient sends a message to a specific client by ID.
func (h *Hub) SendToClient(clientID string, data []byte) {
	h.unicast <- &UnicastMsg{ClientID: clientID, Data: data}
}

// MoveClientToRoom moves a client from lobby/current room to a new room.
func (h *Hub) MoveClientToRoom(clientID, roomID string) {
	// This is handled via unregister + register sequence externally.
	// For a direct move, we send it through the register channel with room info.
	h.mu.RLock()
	client, ok := h.allClients[clientID]
	h.mu.RUnlock()
	if ok {
		h.register <- &Registration{Client: client, RoomID: roomID}
	}
}

// ClientCount returns the total number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.allClients)
}

// RoomClientCount returns the number of clients in a specific room.
func (h *Hub) RoomClientCount(roomID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, ok := h.rooms[roomID]; ok {
		return len(clients)
	}
	return 0
}

// --- Internal handlers (all run on the hub goroutine) ---

func (h *Hub) handleRegister(reg *Registration) {
	client := reg.Client

	// Add to allClients
	h.mu.Lock()
	h.allClients[client.ID] = client
	h.mu.Unlock()

	if reg.RoomID == "" {
		// Remove from any existing room
		h.removeFromAllRooms(client)
		// Add to lobby
		h.lobby[client] = true
		slog.Info("client registered to lobby", "clientId", client.ID)
	} else {
		// Remove from lobby
		delete(h.lobby, client)
		// Remove from any existing room
		h.removeFromAllRooms(client)
		// Add to target room
		if h.rooms[reg.RoomID] == nil {
			h.rooms[reg.RoomID] = make(map[*Client]bool)
		}
		h.rooms[reg.RoomID][client] = true
		client.RoomID = reg.RoomID
		slog.Info("client registered to room", "clientId", client.ID, "roomId", reg.RoomID)
	}
}

func (h *Hub) handleUnregister(client *Client) {
	h.mu.Lock()
	if _, ok := h.allClients[client.ID]; !ok {
		h.mu.Unlock()
		return
	}
	delete(h.allClients, client.ID)
	h.mu.Unlock()

	// Remove from lobby
	delete(h.lobby, client)

	// Remove from all rooms
	h.removeFromAllRooms(client)

	// Close the send channel
	close(client.send)

	slog.Info("client unregistered", "clientId", client.ID)
}

func (h *Hub) handleBroadcast(msg *BroadcastMsg) {
	// Send to lobby clients
	for client := range h.lobby {
		h.trySend(client, msg.Data)
	}
	// Send to all room clients
	for _, clients := range h.rooms {
		for client := range clients {
			h.trySend(client, msg.Data)
		}
	}
}

func (h *Hub) handleRoomcast(msg *RoomcastMsg) {
	if msg.RoomID == "__lobby__" {
		for client := range h.lobby {
			if client.ID != msg.Exclude {
				h.trySend(client, msg.Data)
			}
		}
		return
	}

	clients, ok := h.rooms[msg.RoomID]
	if !ok {
		return
	}
	for client := range clients {
		if client.ID != msg.Exclude {
			h.trySend(client, msg.Data)
		}
	}
}

func (h *Hub) handleUnicast(msg *UnicastMsg) {
	h.mu.RLock()
	client, ok := h.allClients[msg.ClientID]
	h.mu.RUnlock()
	if ok {
		h.trySend(client, msg.Data)
	}
}

func (h *Hub) trySend(client *Client, data []byte) {
	select {
	case client.send <- data:
	default:
		// Buffer full — evict slow client
		slog.Warn("evicting slow client", "clientId", client.ID)
		h.handleUnregister(client)
	}
}

func (h *Hub) removeFromAllRooms(client *Client) {
	for roomID, clients := range h.rooms {
		if clients[client] {
			delete(clients, client)
			if len(clients) == 0 {
				delete(h.rooms, roomID)
			}
			break
		}
	}
	client.RoomID = ""
}

// BuildFrame creates a JSON websocket frame: {"e":"event","d":data}
func BuildFrame(event string, data interface{}) ([]byte, error) {
	d, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	frame := map[string]json.RawMessage{
		"e": json.RawMessage(`"` + event + `"`),
		"d": d,
	}
	return json.Marshal(frame)
}
