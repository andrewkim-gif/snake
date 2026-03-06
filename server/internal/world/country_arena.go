package world

import (
	"context"
	"log/slog"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
)

// CountryArena wraps v10's Room with country-specific attributes.
// It extends the existing Room → Arena architecture to include
// country tier, terrain bonuses, and sovereignty tracking.
type CountryArena struct {
	mu sync.RWMutex

	// Country identity
	CountryISO string
	CountryName string
	Tier       CountryTier

	// Embedded v10 Room (delegates all game logic to existing code)
	room *game.Room

	// Country-specific battle context
	DefenseBonus      float64 // Terrain defense bonus (0.0 - 0.3)
	SovereignFaction  string  // Current sovereign faction ID
	SovereigntyLevel  int     // Sovereignty level (affects defense)

	// Battle results aggregation (per faction)
	factionScores map[string]int // factionID → total score

	// Event forwarding
	OnEvents game.RoomEventCallback

	// Lifecycle
	cancel context.CancelFunc
}

// NewCountryArena creates a new country-specific arena.
func NewCountryArena(iso3, name string, tier CountryTier, cfg game.RoomConfig) *CountryArena {
	// Use the country ISO as the room ID for routing
	room := game.NewRoom(iso3, name, cfg)

	ca := &CountryArena{
		CountryISO:   iso3,
		CountryName:  name,
		Tier:         tier,
		room:         room,
		factionScores: make(map[string]int),
	}

	// Wire room events through the country arena
	room.OnEvents = ca.handleRoomEvents

	return ca
}

// Start starts the country arena's game loop.
func (ca *CountryArena) Start(ctx context.Context) {
	arenaCtx, cancel := context.WithCancel(ctx)
	ca.cancel = cancel
	go ca.room.Run(arenaCtx)

	slog.Info("country arena started",
		"country", ca.CountryISO,
		"tier", ca.Tier,
	)
}

// Stop stops the country arena's game loop.
func (ca *CountryArena) Stop() {
	if ca.cancel != nil {
		ca.cancel()
		ca.cancel = nil
	}
	slog.Info("country arena stopped", "country", ca.CountryISO)
}

// --- Player management (delegates to Room) ---

// AddPlayer adds a human player to the arena.
func (ca *CountryArena) AddPlayer(clientID, name string, skinID int) {
	if err := ca.room.AddPlayer(clientID, name, skinID); err != nil {
		slog.Warn("failed to add player to country arena",
			"country", ca.CountryISO,
			"clientId", clientID,
			"error", err,
		)
	}
}

// RemovePlayer removes a human player from the arena.
func (ca *CountryArena) RemovePlayer(clientID string) {
	ca.room.RemovePlayer(clientID)
}

// HasPlayer checks if a player is in this arena.
func (ca *CountryArena) HasPlayer(clientID string) bool {
	return ca.room.HasPlayer(clientID)
}

// PlayerCount returns the number of human players.
func (ca *CountryArena) PlayerCount() int {
	return ca.room.PlayerCount()
}

// --- Input handling (delegates to Room) ---

// HandleInput forwards player input.
func (ca *CountryArena) HandleInput(agentID string, angle float64, boost bool) {
	ca.room.HandleInput(agentID, angle, boost)
}

// HandleChooseUpgrade forwards upgrade choice.
func (ca *CountryArena) HandleChooseUpgrade(agentID string, choiceIndex int) {
	ca.room.HandleChooseUpgrade(agentID, choiceIndex)
}

// --- Info getters ---

// GetInfo returns room info for this country arena.
func (ca *CountryArena) GetInfo() domain.RoomInfo {
	info := ca.room.GetInfo()
	// Override room name with country name
	info.Name = ca.CountryName
	return info
}

// GetArena returns the underlying v10 Arena.
func (ca *CountryArena) GetArena() *game.Arena {
	return ca.room.GetArena()
}

// GetState returns the current room state.
func (ca *CountryArena) GetState() domain.RoomState {
	return ca.room.GetState()
}

// GetJoinedEvent creates a joined event for a new player.
func (ca *CountryArena) GetJoinedEvent(playerID string) domain.JoinedEvent {
	return ca.room.GetJoinedEvent(playerID)
}

// GetRecentWinners returns recent winners.
func (ca *CountryArena) GetRecentWinners() []domain.WinnerInfo {
	return ca.room.GetRecentWinners()
}

// --- Battle result tracking ---

// AddFactionScore records a faction's score contribution for sovereignty determination.
func (ca *CountryArena) AddFactionScore(factionID string, score int) {
	ca.mu.Lock()
	defer ca.mu.Unlock()
	ca.factionScores[factionID] += score
}

// GetBattleResults returns the faction scores from the current/last battle.
func (ca *CountryArena) GetBattleResults() map[string]int {
	ca.mu.RLock()
	defer ca.mu.RUnlock()
	result := make(map[string]int, len(ca.factionScores))
	for k, v := range ca.factionScores {
		result[k] = v
	}
	return result
}

// ResetBattleResults clears faction scores for the next battle cycle.
func (ca *CountryArena) ResetBattleResults() {
	ca.mu.Lock()
	defer ca.mu.Unlock()
	ca.factionScores = make(map[string]int)
}

// DetermineWinningFaction returns the faction with the highest score.
// The current sovereign gets a 20% defense advantage.
func (ca *CountryArena) DetermineWinningFaction() (factionID string, topScore int) {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	for fid, score := range ca.factionScores {
		adjustedScore := score
		// Defender bonus: 20% advantage
		if fid == ca.SovereignFaction {
			adjustedScore = int(float64(score) * 1.20)
		}
		if adjustedScore > topScore {
			topScore = adjustedScore
			factionID = fid
		}
	}
	return
}

// --- Event forwarding ---

func (ca *CountryArena) handleRoomEvents(events []game.RoomEvent) {
	if ca.OnEvents != nil {
		ca.OnEvents(events)
	}
}
