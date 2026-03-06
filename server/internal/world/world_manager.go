package world

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/game"
)

// WorldManager manages 195 countries as on-demand battle arenas.
// It extends the v10 RoomManager concept from 5 fixed rooms to 195 dynamic country arenas.
// Arenas are created on-demand when a battle is needed and returned to the pool when idle.
type WorldManager struct {
	mu sync.RWMutex

	// Country state: all 195 countries (always in memory)
	countries map[string]*CountryState

	// Active arenas: only countries currently running battles (on-demand)
	activeArenas map[string]*CountryArena

	// Player routing: which country a player is in
	playerCountry map[string]string // clientID → countryISO

	// Arena pool for reuse (reduces GC pressure)
	arenaPool []*CountryArena

	// Configuration
	config WorldConfig

	// Event callback (bridges world events → ws layer)
	OnEvents WorldEventCallback
}

// WorldConfig holds configuration for the WorldManager.
type WorldConfig struct {
	BattleDurationSec  int     // Default: 300 (5 minutes)
	BattleCooldownSec  int     // Default: 60 (1 minute between battles)
	MaxConcurrentArenas int    // Default: 50 (memory limit)
	CountdownSec       int     // Default: 10
	EndingSec          int     // Default: 5
	TickRate           int     // Default: 20 Hz
}

// DefaultWorldConfig returns the default WorldManager configuration.
func DefaultWorldConfig() WorldConfig {
	return WorldConfig{
		BattleDurationSec:  300,
		BattleCooldownSec:  60,
		MaxConcurrentArenas: 50,
		CountdownSec:       10,
		EndingSec:          5,
		TickRate:           20,
	}
}

// WorldEventType classifies world-level events.
type WorldEventType string

const (
	WorldEvtSovereigntyChange WorldEventType = "sovereignty_change"
	WorldEvtBattleStart       WorldEventType = "battle_start"
	WorldEvtBattleEnd         WorldEventType = "battle_end"
	WorldEvtCountryUpdate     WorldEventType = "country_update"
)

// WorldEvent is a world-level event emitted by the WorldManager.
type WorldEvent struct {
	Type       WorldEventType
	CountryISO string
	TargetID   string      // specific client, empty = broadcast
	Data       interface{}
}

// WorldEventCallback is called when world events are emitted.
type WorldEventCallback func(events []WorldEvent)

// CountryState holds the persistent state of a country.
type CountryState struct {
	ISO3              string
	Name              string
	Continent         string
	Tier              CountryTier
	Resources         Resources
	SovereignFaction  string // faction ID
	SovereigntyLevel  int    // 0-10
	SovereigntyStreak int    // consecutive wins
	GDP               int64
	BattleStatus      string // "idle", "preparing", "in_battle", "cooldown"
	ActiveAgents      int
	LastBattleAt      time.Time
	ArenaRadius       float64
	MaxAgents         int
	TerrainTheme      string
	Adjacent          []string
	Latitude          float64
	Longitude         float64
	CapitalName       string
}

// NewWorldManager creates a WorldManager and initializes all 195 countries.
func NewWorldManager(cfg WorldConfig) *WorldManager {
	wm := &WorldManager{
		countries:     make(map[string]*CountryState, len(AllCountries)),
		activeArenas:  make(map[string]*CountryArena),
		playerCountry: make(map[string]string),
		arenaPool:     make([]*CountryArena, 0, 10),
		config:        cfg,
	}

	// Initialize country states from seed data
	for _, seed := range AllCountries {
		tierCfg := TierConfigs[seed.Tier]
		wm.countries[seed.ISO3] = &CountryState{
			ISO3:              seed.ISO3,
			Name:              seed.Name,
			Continent:         seed.Continent,
			Tier:              seed.Tier,
			Resources:         seed.Resources,
			SovereignFaction:  "",
			SovereigntyLevel:  0,
			SovereigntyStreak: 0,
			GDP:               0,
			BattleStatus:      "idle",
			ActiveAgents:      0,
			ArenaRadius:       tierCfg.ArenaRadius,
			MaxAgents:         tierCfg.MaxAgents,
			TerrainTheme:      seed.TerrainTheme,
			Adjacent:          seed.Adjacency,
			Latitude:          seed.Latitude,
			Longitude:         seed.Longitude,
			CapitalName:       seed.CapitalName,
		}
	}

	slog.Info("world manager initialized", "countries", len(wm.countries))
	return wm
}

// Start begins the world manager's background tasks.
func (wm *WorldManager) Start(ctx context.Context) {
	// Country status broadcast (1Hz)
	go wm.broadcastLoop(ctx)

	slog.Info("world manager started")
}

// Stop shuts down all active arenas.
func (wm *WorldManager) Stop() {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	for iso, arena := range wm.activeArenas {
		arena.Stop()
		slog.Info("stopped arena", "country", iso)
	}

	slog.Info("world manager stopped", "activeArenas", len(wm.activeArenas))
}

// GetCountry returns the state of a country.
func (wm *WorldManager) GetCountry(iso3 string) *CountryState {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.countries[iso3]
}

// GetAllCountries returns a snapshot of all country states.
func (wm *WorldManager) GetAllCountries() map[string]*CountryState {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	snapshot := make(map[string]*CountryState, len(wm.countries))
	for k, v := range wm.countries {
		snapshot[k] = v
	}
	return snapshot
}

// GetActiveArenaCount returns the number of currently active arenas.
func (wm *WorldManager) GetActiveArenaCount() int {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return len(wm.activeArenas)
}

// JoinCountry places a player into a country's arena (creating it on-demand).
func (wm *WorldManager) JoinCountry(clientID, countryISO, name string, skinID int) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	// Verify country exists
	state, ok := wm.countries[countryISO]
	if !ok {
		return fmt.Errorf("country %s not found", countryISO)
	}

	// Leave current country if any
	if current, exists := wm.playerCountry[clientID]; exists {
		if arena, aok := wm.activeArenas[current]; aok {
			arena.RemovePlayer(clientID)
		}
		delete(wm.playerCountry, clientID)
	}

	// Get or create arena
	arena, err := wm.getOrCreateArenaLocked(countryISO, state)
	if err != nil {
		return err
	}

	// Add player to arena
	arena.AddPlayer(clientID, name, skinID)
	wm.playerCountry[clientID] = countryISO

	slog.Info("player joined country",
		"clientId", clientID,
		"country", countryISO,
		"name", name,
	)

	return nil
}

// LeaveCountry removes a player from their current country arena.
func (wm *WorldManager) LeaveCountry(clientID string) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	iso, ok := wm.playerCountry[clientID]
	if !ok {
		return
	}

	if arena, exists := wm.activeArenas[iso]; exists {
		arena.RemovePlayer(clientID)
	}
	delete(wm.playerCountry, clientID)

	slog.Info("player left country", "clientId", clientID, "country", iso)
}

// RouteInput forwards player input to the correct country arena.
func (wm *WorldManager) RouteInput(clientID string, angle float64, boost bool) {
	wm.mu.RLock()
	iso, ok := wm.playerCountry[clientID]
	if !ok {
		wm.mu.RUnlock()
		return
	}
	arena, exists := wm.activeArenas[iso]
	wm.mu.RUnlock()

	if !exists {
		return
	}
	arena.HandleInput(clientID, angle, boost)
}

// RouteChooseUpgrade forwards upgrade choice to the correct arena.
func (wm *WorldManager) RouteChooseUpgrade(clientID string, choiceIndex int) {
	wm.mu.RLock()
	iso, ok := wm.playerCountry[clientID]
	if !ok {
		wm.mu.RUnlock()
		return
	}
	arena, exists := wm.activeArenas[iso]
	wm.mu.RUnlock()

	if !exists {
		return
	}
	arena.HandleChooseUpgrade(clientID, choiceIndex)
}

// GetPlayerCountry returns the country ISO code a player is in.
func (wm *WorldManager) GetPlayerCountry(clientID string) string {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.playerCountry[clientID]
}

// TotalPlayers returns the total number of connected players across all arenas.
func (wm *WorldManager) TotalPlayers() int {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return len(wm.playerCountry)
}

// --- Internal helpers ---

// getOrCreateArenaLocked gets an existing arena or creates a new one.
// Caller must hold wm.mu write lock.
func (wm *WorldManager) getOrCreateArenaLocked(iso3 string, state *CountryState) (*CountryArena, error) {
	if arena, ok := wm.activeArenas[iso3]; ok {
		return arena, nil
	}

	// Check concurrent arena limit
	if len(wm.activeArenas) >= wm.config.MaxConcurrentArenas {
		return nil, fmt.Errorf("max concurrent arenas reached (%d)", wm.config.MaxConcurrentArenas)
	}

	// Create a new CountryArena using the room config from v10
	roomCfg := game.RoomConfig{
		MaxRooms:          1,
		MaxPlayersPerRoom: state.MaxAgents,
		MaxHumansPerRoom:  state.MaxAgents - 15,
		MaxBotsPerRoom:    15,
		RoundDurationSec:  wm.config.BattleDurationSec,
		CountdownSec:      wm.config.CountdownSec,
		EndingSec:         wm.config.EndingSec,
		CooldownSec:       wm.config.BattleCooldownSec,
		MinPlayersToStart: 1,
	}

	arena := NewCountryArena(iso3, state.Name, state.Tier, roomCfg)
	arena.OnEvents = wm.handleArenaEvents

	wm.activeArenas[iso3] = arena

	slog.Info("arena created on-demand",
		"country", iso3,
		"tier", state.Tier,
		"arenaRadius", state.ArenaRadius,
	)

	return arena, nil
}

// handleArenaEvents bridges CountryArena events to WorldManager events.
func (wm *WorldManager) handleArenaEvents(events []game.RoomEvent) {
	if wm.OnEvents == nil {
		return
	}
	// Forward as-is through the world event system
	var worldEvents []WorldEvent
	for _, evt := range events {
		worldEvents = append(worldEvents, WorldEvent{
			Type:       WorldEvtCountryUpdate,
			CountryISO: evt.RoomID, // RoomID = country ISO
			TargetID:   evt.TargetID,
			Data:       evt,
		})
	}
	wm.OnEvents(worldEvents)
}

// broadcastLoop sends country state updates at 1Hz.
func (wm *WorldManager) broadcastLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Update active agent counts
			wm.mu.Lock()
			for iso, arena := range wm.activeArenas {
				if state, ok := wm.countries[iso]; ok {
					state.ActiveAgents = arena.PlayerCount()
				}
			}
			wm.mu.Unlock()
		}
	}
}
