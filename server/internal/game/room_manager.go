package game

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
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

	// v17: Track which countries are currently in use (ISO3 → roomID)
	activeCountries map[string]string // ISO3 → roomID
	rng             *rand.Rand

	// Event callback (set by main.go to bridge game→ws)
	OnEvents RoomEventCallback
}

// NewRoomManager creates a RoomManager with the configured number of rooms.
// v17: Selects random countries from the pool and creates country-based arenas.
func NewRoomManager(cfg RoomConfig) *RoomManager {
	rm := &RoomManager{
		rooms:           make(map[string]*Room),
		playerRoom:      make(map[string]string),
		config:          cfg,
		activeCountries: make(map[string]string),
		rng:             rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	// Select random countries for arenas
	countries := SelectRandomCountries(cfg.MaxRooms)

	for _, country := range countries {
		roomID := fmt.Sprintf("room_%s", country.ISO3)
		roomCfg := cfg
		roomCfg.CountryISO3 = country.ISO3
		roomCfg.CountryName = country.Name
		// Scale max bots by country tier (larger countries = more bots)
		if country.MaxAgents > 0 && country.MaxAgents < cfg.MaxBotsPerRoom {
			roomCfg.MaxBotsPerRoom = country.MaxAgents
		}

		room := NewRoom(roomID, country.Name, roomCfg)
		// v17: Stagger auto-start — random delay 0~180s so rooms don't all start simultaneously
		room.stateTicksLeft = rm.rng.Intn(180 * TickRate)
		rm.rooms[roomID] = room
		rm.activeCountries[country.ISO3] = roomID
	}

	slog.Info("room manager created with country arenas", "count", len(rm.rooms))

	return rm
}

// Start starts all room goroutines.
func (rm *RoomManager) Start(ctx context.Context) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for _, room := range rm.rooms {
		room.OnEvents = rm.forwardEvents
		room.OnRotate = rm.rotateRoom
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

// RouteInput forwards a client's input to the correct room's arena (legacy single-angle).
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

// RouteInputSplit forwards a client's split move/aim input to the correct room (v16).
func (rm *RoomManager) RouteInputSplit(clientID string, moveAngle float64, aimAngle float64, boost bool, dash bool, jump bool) {
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

	room.HandleInputSplit(clientID, moveAngle, aimAngle, boost, dash, jump)
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

// RouteARInput forwards Arena combat input to the correct room.
func (rm *RoomManager) RouteARInput(clientID string, input ARInput) {
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

	room.HandleARInput(clientID, input)
}

// RouteARChoose forwards Arena tome/weapon choice to the correct room.
func (rm *RoomManager) RouteARChoose(clientID string, choice ARChoice) {
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

	room.HandleARChoose(clientID, choice)
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

// rotateRoom replaces a room's country with an unused one after cooldown ends.
// v17: Called AFTER Room.mu is released (via pendingRotate flag in tick()) to prevent
// lock-ordering deadlock. Lock order is always: RoomManager.mu → Room.mu.
func (rm *RoomManager) rotateRoom(roomID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, ok := rm.rooms[roomID]
	if !ok {
		return
	}

	// Pick a random unused country (under rm.mu)
	newCountry := rm.pickUnusedCountryLocked()
	if newCountry == nil {
		// No unused countries available; keep current
		return
	}

	// Acquire room.mu to safely update room config fields
	room.mu.Lock()
	oldISO3 := room.Config.CountryISO3
	room.Config.CountryISO3 = newCountry.ISO3
	room.Config.CountryName = newCountry.Name
	room.Name = newCountry.Name
	room.mu.Unlock()

	// Update active countries tracking (under rm.mu)
	delete(rm.activeCountries, oldISO3)
	rm.activeCountries[newCountry.ISO3] = roomID

	slog.Info("room rotated to new country",
		"roomId", roomID,
		"from", oldISO3,
		"to", newCountry.ISO3,
		"country", newCountry.Name,
	)
}

// pickUnusedCountryLocked selects a random country not currently in use.
// Caller must hold rm.mu.
func (rm *RoomManager) pickUnusedCountryLocked() *CountryData {
	// Build list of unused countries
	pool := SelectRandomCountries(195) // Get all shuffled
	for _, c := range pool {
		if _, inUse := rm.activeCountries[c.ISO3]; !inUse {
			return &c
		}
	}
	return nil // All 195 are in use (shouldn't happen with 50 rooms)
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
