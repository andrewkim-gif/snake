package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
	"time"
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

// ConnLimiter rate-limits new WebSocket connections per IP.
// v17: Prevents burst connections from overwhelming the server.
type ConnLimiter struct {
	mu          sync.Mutex
	connections map[string][]time.Time // IP → timestamps of recent connections
	maxPerSec   int                    // max connections per IP per second
	window      time.Duration          // sliding window duration
}

// NewConnLimiter creates a rate limiter allowing maxPerSec connections per IP per second.
func NewConnLimiter(maxPerSec int) *ConnLimiter {
	return &ConnLimiter{
		connections: make(map[string][]time.Time),
		maxPerSec:   maxPerSec,
		window:      time.Second,
	}
}

// Allow returns true if the IP is allowed to connect (under rate limit).
func (cl *ConnLimiter) Allow(ip string) bool {
	cl.mu.Lock()
	defer cl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-cl.window)

	// Prune old entries
	times := cl.connections[ip]
	valid := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= cl.maxPerSec {
		cl.connections[ip] = valid
		return false
	}

	cl.connections[ip] = append(valid, now)
	return true
}

// Cleanup removes stale IP entries (call periodically to prevent memory leak).
func (cl *ConnLimiter) Cleanup() {
	cl.mu.Lock()
	defer cl.mu.Unlock()

	cutoff := time.Now().Add(-cl.window * 2)
	for ip, times := range cl.connections {
		valid := times[:0]
		for _, t := range times {
			if t.After(cutoff) {
				valid = append(valid, t)
			}
		}
		if len(valid) == 0 {
			delete(cl.connections, ip)
		} else {
			cl.connections[ip] = valid
		}
	}
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

	// v26: citySubscribers maps iso3 → set of clients subscribed to city updates.
	citySubscribers map[string]map[*Client]bool

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

	// v17: Connection rate limiter (IP-based)
	ConnLimit *ConnLimiter
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		rooms:           make(map[string]map[*Client]bool),
		lobby:           make(map[*Client]bool),
		allClients:      make(map[string]*Client),
		citySubscribers: make(map[string]map[*Client]bool),
		register:        make(chan *Registration, 1024),
		unregister:      make(chan *Client, 1024),
		broadcast:       make(chan *BroadcastMsg, 1024),
		roomcast:        make(chan *RoomcastMsg, 1024),
		unicast:         make(chan *UnicastMsg, 1024),
		done:            make(chan struct{}),
		ConnLimit:       NewConnLimiter(5), // v17: max 5 connections per IP per second
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
			// Close all client connections (safe: CloseSend prevents double-close)
			for _, client := range h.allClients {
				client.CloseSend()
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
// v17: Non-blocking to prevent goroutine leak if channel is full.
func (h *Hub) Unregister(client *Client) {
	select {
	case h.unregister <- client:
	default:
		slog.Warn("unregister channel full, forcing close", "clientId", client.ID)
		client.CloseSend()
	}
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

	// v26: Remove from all city subscriptions
	for iso3, subs := range h.citySubscribers {
		delete(subs, client)
		if len(subs) == 0 {
			delete(h.citySubscribers, iso3)
		}
	}
	h.mu.Unlock()

	// Remove from lobby
	delete(h.lobby, client)

	// Remove from all rooms
	h.removeFromAllRooms(client)

	// Close the send channel (safe: CloseSend prevents double-close)
	client.CloseSend()

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

// --- v26: City subscription methods ---

// SubscribeCity subscribes a client to city state updates for a country.
func (h *Hub) SubscribeCity(clientID, iso3 string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	client, ok := h.allClients[clientID]
	if !ok {
		return
	}

	if h.citySubscribers[iso3] == nil {
		h.citySubscribers[iso3] = make(map[*Client]bool)
	}
	h.citySubscribers[iso3][client] = true

	slog.Info("client subscribed to city",
		"clientId", clientID,
		"iso3", iso3,
	)
}

// UnsubscribeCity removes a client's subscription to a city.
func (h *Hub) UnsubscribeCity(clientID, iso3 string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	client, ok := h.allClients[clientID]
	if !ok {
		return
	}

	if subs, ok := h.citySubscribers[iso3]; ok {
		delete(subs, client)
		if len(subs) == 0 {
			delete(h.citySubscribers, iso3)
		}
	}

	slog.Info("client unsubscribed from city",
		"clientId", clientID,
		"iso3", iso3,
	)
}

// UnsubscribeAllCities removes all city subscriptions for a client.
func (h *Hub) UnsubscribeAllCities(clientID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	client, ok := h.allClients[clientID]
	if !ok {
		return
	}

	for iso3, subs := range h.citySubscribers {
		delete(subs, client)
		if len(subs) == 0 {
			delete(h.citySubscribers, iso3)
		}
	}
}

// BroadcastToCitySubscribers sends data to all clients subscribed to a city.
func (h *Hub) BroadcastToCitySubscribers(iso3 string, data []byte) {
	h.mu.RLock()
	subs, ok := h.citySubscribers[iso3]
	if !ok || len(subs) == 0 {
		h.mu.RUnlock()
		return
	}
	// Copy to avoid holding lock during send
	clients := make([]*Client, 0, len(subs))
	for c := range subs {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, client := range clients {
		select {
		case client.send <- data:
		default:
			// Buffer full, skip this frame
		}
	}
}

// GetCitySubscriberCount returns how many clients are subscribed to a city.
func (h *Hub) GetCitySubscriberCount(iso3 string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.citySubscribers[iso3])
}

// GetSubscribedCities returns the list of ISO3 codes that have subscribers.
func (h *Hub) GetSubscribedCities() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make([]string, 0, len(h.citySubscribers))
	for iso3, subs := range h.citySubscribers {
		if len(subs) > 0 {
			result = append(result, iso3)
		}
	}
	return result
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
