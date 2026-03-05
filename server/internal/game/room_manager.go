package game

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/to-nexus/snake-server/internal/domain"
)

// RoomManager manages all rooms and handles player routing.
type RoomManager struct {
	rooms      map[string]*Room
	roomOrder  []string // ordered room IDs for consistent iteration
	roomConfig RoomConfig
	arenaConfig ArenaConfig
	bc         Broadcaster

	// Recent winners ring buffer
	recentWinners []domain.RecentWinner
	winnersMu     sync.RWMutex

	mu sync.RWMutex
}

// NewRoomManager creates a RoomManager with rooms pre-created.
func NewRoomManager(arenaConfig ArenaConfig, roomConfig RoomConfig, bc Broadcaster) *RoomManager {
	rm := &RoomManager{
		rooms:         make(map[string]*Room, roomConfig.MaxRooms),
		roomOrder:     make([]string, 0, roomConfig.MaxRooms),
		roomConfig:    roomConfig,
		arenaConfig:   arenaConfig,
		bc:            bc,
		recentWinners: make([]domain.RecentWinner, 0, roomConfig.RecentWinnersCount),
	}

	// Create rooms
	for i := 1; i <= roomConfig.MaxRooms; i++ {
		id := fmt.Sprintf("room-%d", i)
		room := NewRoom(id, arenaConfig, roomConfig)
		rm.rooms[id] = room
		rm.roomOrder = append(rm.roomOrder, id)
	}

	slog.Info("room manager created", "rooms", roomConfig.MaxRooms)
	return rm
}

// Run starts all room goroutines and the 1Hz lobby broadcaster.
func (rm *RoomManager) Run(ctx context.Context) error {
	// Start each room goroutine
	for _, id := range rm.roomOrder {
		room := rm.rooms[id]
		go room.Run(ctx, rm.bc)
	}

	// 1Hz lobby broadcast
	lobbyTicker := time.NewTicker(time.Duration(rm.roomConfig.LobbyUpdateMs) * time.Millisecond)
	defer lobbyTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("room manager stopping")
			return nil
		case <-lobbyTicker.C:
			rm.broadcastLobbyUpdate()
		}
	}
}

// QuickJoin finds the best room for the player and joins them.
func (rm *RoomManager) QuickJoin(clientID, name string, skinID int) (string, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	// Find the best joinable room:
	// Priority: 1) most players (active game), 2) waiting rooms
	var bestRoom *Room
	bestScore := -1

	for _, id := range rm.roomOrder {
		room := rm.rooms[id]
		if !room.IsJoinable() {
			continue
		}

		score := room.GetHumanCount()
		// Prefer rooms with players (more fun)
		if room.GetState() == StatePlaying || room.GetState() == StateCountdown {
			score += 100
		}
		if score > bestScore {
			bestScore = score
			bestRoom = room
		}
	}

	if bestRoom == nil {
		return "", fmt.Errorf("no joinable rooms")
	}

	return rm.joinRoom(clientID, bestRoom, name, skinID)
}

// JoinRoom joins a player to a specific room by ID.
func (rm *RoomManager) JoinRoom(clientID, roomID, name string, skinID int) (string, error) {
	rm.mu.RLock()
	room, ok := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !ok {
		return "", fmt.Errorf("room not found: %s", roomID)
	}

	if !room.IsJoinable() {
		return "", fmt.Errorf("room not joinable: %s", roomID)
	}

	return rm.joinRoom(clientID, room, name, skinID)
}

// joinRoom sends a join request to a room and waits for the response.
func (rm *RoomManager) joinRoom(clientID string, room *Room, name string, skinID int) (string, error) {
	respChan := make(chan JoinResponse, 1)
	room.JoinChan <- JoinRequest{
		ClientID: clientID,
		Name:     name,
		SkinID:   skinID,
		Response: respChan,
	}

	// Wait for response with timeout
	select {
	case resp := <-respChan:
		if resp.Err != nil {
			return "", resp.Err
		}
		return room.ID, nil
	case <-time.After(2 * time.Second):
		return "", fmt.Errorf("join timeout")
	}
}

// LeaveRoom removes a player from whatever room they're in.
func (rm *RoomManager) LeaveRoom(clientID string) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	for _, room := range rm.rooms {
		// Send leave to all rooms — only the correct one will have the player
		select {
		case room.LeaveChan <- clientID:
		default:
			// Channel full, skip
		}
	}
}

// SendInput routes input to the correct room.
func (rm *RoomManager) SendInput(clientID string, roomID string, msg InputMsg) {
	rm.mu.RLock()
	room, ok := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !ok {
		return
	}

	select {
	case room.InputChan <- msg:
	default:
		// Input channel full, drop
	}
}

// SendRespawn routes respawn to the correct room.
func (rm *RoomManager) SendRespawn(clientID, roomID string, req RespawnRequest) {
	rm.mu.RLock()
	room, ok := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !ok {
		return
	}

	select {
	case room.RespawnChan <- req:
	default:
	}
}

// SendUpgrade routes upgrade choice to the correct room.
func (rm *RoomManager) SendUpgrade(clientID, roomID string, req UpgradeRequest) {
	rm.mu.RLock()
	room, ok := rm.rooms[roomID]
	rm.mu.RUnlock()

	if !ok {
		return
	}

	select {
	case room.UpgradeChan <- req:
	default:
	}
}

// GetRoomsInfo returns all room infos for lobby display.
func (rm *RoomManager) GetRoomsInfo() []domain.RoomInfo {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	infos := make([]domain.RoomInfo, 0, len(rm.roomOrder))
	for _, id := range rm.roomOrder {
		infos = append(infos, rm.rooms[id].ToRoomInfo())
	}
	return infos
}

// GetRecentWinners returns the recent winners list.
func (rm *RoomManager) GetRecentWinners() []domain.RecentWinner {
	rm.winnersMu.RLock()
	defer rm.winnersMu.RUnlock()

	result := make([]domain.RecentWinner, len(rm.recentWinners))
	copy(result, rm.recentWinners)
	return result
}

// RecordWinner adds a winner to the recent winners list.
func (rm *RoomManager) RecordWinner(roomID string, winner *domain.WinnerInfo) {
	if winner == nil {
		return
	}

	rm.winnersMu.Lock()
	defer rm.winnersMu.Unlock()

	rw := domain.RecentWinner{
		WinnerInfo: *winner,
		RoomID:     roomID,
		Timestamp:  time.Now().UnixMilli(),
	}

	rm.recentWinners = append([]domain.RecentWinner{rw}, rm.recentWinners...)
	if len(rm.recentWinners) > rm.roomConfig.RecentWinnersCount {
		rm.recentWinners = rm.recentWinners[:rm.roomConfig.RecentWinnersCount]
	}
}

// broadcastLobbyUpdate sends rooms_update to all clients (lobby).
func (rm *RoomManager) broadcastLobbyUpdate() {
	payload := domain.RoomsUpdatePayload{
		Rooms:         rm.GetRoomsInfo(),
		RecentWinners: rm.GetRecentWinners(),
	}

	data, err := makeFrameBytes("rooms_update", payload)
	if err != nil {
		slog.Error("failed to serialize lobby update", "error", err)
		return
	}

	// Send to lobby room only
	rm.bc.SendToRoom("lobby", data, "")
}

// GetRoom returns a Room by ID, or nil if not found.
func (rm *RoomManager) GetRoom(roomID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.rooms[roomID]
}

// FindRoomForClient finds which room a client is in (by checking humans maps).
func (rm *RoomManager) FindRoomForClient(clientID string) string {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	for _, id := range rm.roomOrder {
		room := rm.rooms[id]
		room.mu.RLock()
		_, ok := room.humans[clientID]
		room.mu.RUnlock()
		if ok {
			return id
		}
	}
	return ""
}
