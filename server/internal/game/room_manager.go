package game

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// LobbyBroadcaster is a function that sends lobby updates to all lobby clients.
// Implemented by main.go to bridge game→ws without circular imports.
type LobbyBroadcaster func(data domain.RoomsUpdateEvent)

// RoomManager manages multiple game rooms and routes players between them.
type RoomManager struct {
	mu sync.RWMutex

	rooms      map[string]*Room
	playerRoom map[string]string // clientID → roomID
	config     RoomConfig

	// Event callback (set by main.go to bridge game→ws)
	OnEvents RoomEventCallback
}

// NewRoomManager creates a RoomManager with the configured number of rooms.
func NewRoomManager(cfg RoomConfig) *RoomManager {
	rm := &RoomManager{
		rooms:      make(map[string]*Room),
		playerRoom: make(map[string]string),
		config:     cfg,
	}

	// Create rooms
	roomNames := []string{
		"Overworld",
		"Nether",
		"The End",
		"Deep Dark",
		"Cherry Grove",
	}
	for i := 0; i < cfg.MaxRooms; i++ {
		name := fmt.Sprintf("Room %d", i+1)
		if i < len(roomNames) {
			name = roomNames[i]
		}
		roomID := fmt.Sprintf("room_%d", i+1)
		room := NewRoom(roomID, name, cfg)
		rm.rooms[roomID] = room
	}

	return rm
}

// Start starts all room goroutines.
func (rm *RoomManager) Start(ctx context.Context) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for _, room := range rm.rooms {
		room.OnEvents = rm.forwardEvents
		go room.Run(ctx)
	}

	slog.Info("room manager started", "rooms", len(rm.rooms))
}

// Stop is a no-op; rooms are stopped via context cancellation in Start.
func (rm *RoomManager) Stop() {
	slog.Info("room manager stopping")
}

// forwardEvents bridges room events to the external callback.
func (rm *RoomManager) forwardEvents(events []RoomEvent) {
	if rm.OnEvents != nil {
		rm.OnEvents(events)
	}
}

// QuickJoin auto-assigns a client to the most appropriate room.
// Priority: waiting/countdown rooms > playing rooms, fewest players first.
func (rm *RoomManager) QuickJoin(clientID, name string, skinID int, appearance string) (string, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Check if already in a room
	if existingRoom, ok := rm.playerRoom[clientID]; ok {
		return existingRoom, fmt.Errorf("already in room %s", existingRoom)
	}

	// Score rooms for best match
	type candidate struct {
		roomID string
		room   *Room
		score  int
	}

	var candidates []candidate
	for id, room := range rm.rooms {
		info := room.GetInfo()
		if info.Players >= rm.config.MaxHumansPerRoom {
			continue // full
		}

		score := 0
		switch info.State {
		case domain.RoomStateWaiting:
			score = 300
		case domain.RoomStateCountdown:
			score = 200
		case domain.RoomStatePlaying:
			score = 100
		case domain.RoomStateCooldown:
			score = 50
		case domain.RoomStateEnding:
			score = 10
		}
		// Prefer rooms with fewer players
		score -= info.Players * 5

		candidates = append(candidates, candidate{roomID: id, room: room, score: score})
	}

	if len(candidates) == 0 {
		return "", fmt.Errorf("all rooms are full")
	}

	// Sort by score descending
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	best := candidates[0]
	return rm.joinRoomLocked(clientID, best.roomID, name, skinID, appearance)
}

// JoinRoom assigns a client to a specific room.
func (rm *RoomManager) JoinRoom(clientID, roomID, name string, skinID int, appearance string) (string, error) {
	// Quick join if roomID is empty (separate lock path to avoid double-unlock)
	if roomID == "" {
		return rm.QuickJoin(clientID, name, skinID, appearance)
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Leave current room if any
	if currentRoom, ok := rm.playerRoom[clientID]; ok {
		if r, exists := rm.rooms[currentRoom]; exists {
			r.RemovePlayer(clientID)
		}
		delete(rm.playerRoom, clientID)
	}

	return rm.joinRoomLocked(clientID, roomID, name, skinID, appearance)
}

// joinRoomLocked performs the actual join (caller must hold rm.mu write lock).
func (rm *RoomManager) joinRoomLocked(clientID, roomID, name string, skinID int, appearance string) (string, error) {
	room, ok := rm.rooms[roomID]
	if !ok {
		return "", fmt.Errorf("room %s not found", roomID)
	}

	if err := room.AddPlayer(clientID, name, skinID, appearance); err != nil {
		return "", err
	}

	rm.playerRoom[clientID] = roomID

	slog.Info("player joined room",
		"clientId", clientID,
		"roomId", roomID,
		"name", name,
	)

	return roomID, nil
}

// LeaveRoom removes a client from their current room.
func (rm *RoomManager) LeaveRoom(clientID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	roomID, ok := rm.playerRoom[clientID]
	if !ok {
		return
	}

	if room, exists := rm.rooms[roomID]; exists {
		room.RemovePlayer(clientID)
	}
	delete(rm.playerRoom, clientID)

	slog.Info("player left room", "clientId", clientID, "roomId", roomID)
}

// GetPlayerRoom returns the room ID for a client, or empty string.
func (rm *RoomManager) GetPlayerRoom(clientID string) string {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.playerRoom[clientID]
}

// GetRoom returns the Room for the given room ID.
func (rm *RoomManager) GetRoom(roomID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.rooms[roomID]
}

// RouteInput forwards a client's input to the correct room's arena.
func (rm *RoomManager) RouteInput(clientID string, angle float64, boost bool, dash bool) {
	rm.mu.RLock()
	roomID, ok := rm.playerRoom[clientID]
	rm.mu.RUnlock()

	if !ok {
		return
	}

	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return
	}

	room.HandleInput(clientID, angle, boost, dash)
}

// RouteChooseUpgrade forwards upgrade choice to the correct room.
func (rm *RoomManager) RouteChooseUpgrade(clientID string, choiceIndex int) {
	rm.mu.RLock()
	roomID, ok := rm.playerRoom[clientID]
	rm.mu.RUnlock()

	if !ok {
		return
	}

	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !exists {
		return
	}

	room.HandleChooseUpgrade(clientID, choiceIndex)
}

// GetRoomList returns info for all rooms (for lobby display).
func (rm *RoomManager) GetRoomList() []domain.RoomInfo {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	list := make([]domain.RoomInfo, 0, len(rm.rooms))
	for _, room := range rm.rooms {
		list = append(list, room.GetInfo())
	}

	// Sort by room ID for consistent ordering
	sort.Slice(list, func(i, j int) bool {
		return list[i].ID < list[j].ID
	})

	return list
}

// GetRecentWinners aggregates recent winners from all rooms.
func (rm *RoomManager) GetRecentWinners() []domain.WinnerInfo {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var all []domain.WinnerInfo
	for _, room := range rm.rooms {
		all = append(all, room.GetRecentWinners()...)
	}

	// Limit to last 10
	if len(all) > 10 {
		all = all[len(all)-10:]
	}
	return all
}

// RoomCount returns the number of rooms.
func (rm *RoomManager) RoomCount() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return len(rm.rooms)
}

// TotalPlayers returns the total number of human players across all rooms.
func (rm *RoomManager) TotalPlayers() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return len(rm.playerRoom)
}

// --- Lobby Broadcasting (S25) ---

// BroadcastLobbyUpdate generates the current lobby state for broadcasting.
func (rm *RoomManager) BroadcastLobbyUpdate() domain.RoomsUpdateEvent {
	return domain.RoomsUpdateEvent{
		Rooms:         rm.GetRoomList(),
		RecentWinners: rm.GetRecentWinners(),
	}
}

// StartLobbyBroadcast starts a 1Hz goroutine that calls the broadcaster.
// Blocks until ctx is cancelled.
func (rm *RoomManager) StartLobbyBroadcast(ctx context.Context, broadcaster LobbyBroadcaster) {
	if broadcaster == nil {
		return
	}

	ticker := time.NewTicker(time.Second) // 1Hz
	defer ticker.Stop()

	slog.Info("lobby broadcast started (1Hz)")

	for {
		select {
		case <-ctx.Done():
			slog.Info("lobby broadcast stopped")
			return
		case <-ticker.C:
			update := rm.BroadcastLobbyUpdate()
			broadcaster(update)
		}
	}
}
