package world

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/cache"
	"github.com/andrewkim-gif/snake/server/internal/game"
)

// WorldManager manages 195 countries as on-demand battle arenas.
// It extends the v10 RoomManager concept from 5 fixed rooms to 195 dynamic country arenas.
// Arenas are created on-demand when a battle is needed and returned to the pool when idle.
//
// Phase 2 enhancements:
//   - Redis sync for country state persistence
//   - Arena pooling with max 50 concurrent
//   - 5-minute battle cycle scheduler (per-country independent)
//   - 1Hz country state broadcast to all connected clients
type WorldManager struct {
	mu sync.RWMutex

	// Country state: all 195 countries (always in memory)
	countries map[string]*CountryState

	// Active arenas: only countries currently running battles (on-demand)
	activeArenas map[string]*CountryArena

	// Player routing: which country a player is in
	playerCountry map[string]string // clientID → countryISO

	// Spectator routing: which country a spectator is watching
	spectatorCountry map[string]string // clientID → countryISO

	// Arena pool for reuse (reduces GC pressure)
	arenaPool []*CountryArena

	// Configuration
	config WorldConfig

	// Redis client for state sync (nil if Redis unavailable)
	redis *cache.RedisClient

	// Event callback (bridges world events → ws layer)
	OnEvents WorldEventCallback

	// Sovereignty engine reference (set after construction)
	sovereignty *SovereigntyEngine

	// Battle scheduler timers (per country)
	battleTimers map[string]*time.Timer

	// v17: Countries with auto-battle enabled (always re-schedule after cooldown)
	autoBattleCountries map[string]bool
}

// WorldConfig holds configuration for the WorldManager.
type WorldConfig struct {
	BattleDurationSec   int // Default: 300 (5 minutes)
	BattleCooldownSec   int // Default: 60 (1 minute between battles)
	MaxConcurrentArenas int // Default: 50 (memory limit)
	CountdownSec        int // Default: 10
	EndingSec           int // Default: 5
	TickRate            int // Default: 20 Hz
	RedisSyncEnabled    bool
	AutoBattleCount     int // v17: Number of countries to auto-start battles (0 = disabled)
}

// DefaultWorldConfig returns the default WorldManager configuration.
func DefaultWorldConfig() WorldConfig {
	return WorldConfig{
		BattleDurationSec:   300,
		BattleCooldownSec:   60,
		MaxConcurrentArenas: 50,
		CountdownSec:        0, // v11 Phase 0: instant start (no countdown)
		EndingSec:           5,
		TickRate:            20,
		RedisSyncEnabled:    false,
		AutoBattleCount:     20, // v17: auto-start 20 country battles with bots
	}
}

// WorldEventType classifies world-level events.
type WorldEventType string

const (
	WorldEvtSovereigntyChange WorldEventType = "sovereignty_change"
	WorldEvtBattleStart       WorldEventType = "battle_start"
	WorldEvtBattleEnd         WorldEventType = "battle_end"
	WorldEvtCountryUpdate     WorldEventType = "country_update"
	WorldEvtCountriesState    WorldEventType = "countries_state"
	WorldEvtSpectatorCount    WorldEventType = "spectator_count"
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
	ISO3              string      `json:"iso3"`
	Name              string      `json:"name"`
	Continent         string      `json:"continent"`
	Tier              CountryTier `json:"tier"`
	Resources         Resources   `json:"resources"`
	SovereignFaction  string      `json:"sovereign_faction"`
	SovereigntyLevel  int         `json:"sovereignty_level"`
	SovereigntyStreak int         `json:"sovereignty_streak"`
	GDP               int64       `json:"gdp"`
	BattleStatus      string      `json:"battle_status"` // "idle", "preparing", "in_battle", "cooldown"
	ActiveAgents      int         `json:"active_agents"`
	SpectatorCount    int         `json:"spectator_count"`
	LastBattleAt      time.Time   `json:"last_battle_at"`
	ArenaRadius       float64     `json:"arena_radius"`
	MaxAgents         int         `json:"max_agents"`
	TerrainTheme      string      `json:"terrain_theme"`
	Adjacent          []string    `json:"adjacent"`
	Latitude          float64     `json:"latitude"`
	Longitude         float64     `json:"longitude"`
	CapitalName       string      `json:"capital_name"`
	Population        int64       `json:"population"` // v15: from CountrySeed
}

// CountryBroadcastState is a compact representation for 1Hz broadcasts.
type CountryBroadcastState struct {
	ISO3             string `json:"iso3"`
	BattleStatus     string `json:"battleStatus"`
	SovereignFaction string `json:"sovereignFaction"`
	SovereigntyLevel int    `json:"sovereigntyLevel"`
	ActiveAgents     int    `json:"activeAgents"`
	SpectatorCount   int    `json:"spectatorCount"`
	// v15: population-based agent limits
	MaxAgents  int   `json:"maxAgents"`
	Population int64 `json:"population"`
}

// NewWorldManager creates a WorldManager and initializes all 195 countries.
func NewWorldManager(cfg WorldConfig, redisClient *cache.RedisClient) *WorldManager {
	wm := &WorldManager{
		countries:        make(map[string]*CountryState, len(AllCountries)),
		activeArenas:     make(map[string]*CountryArena),
		playerCountry:    make(map[string]string),
		spectatorCountry: make(map[string]string),
		arenaPool:        make([]*CountryArena, 0, 10),
		config:              cfg,
		redis:               redisClient,
		battleTimers:        make(map[string]*time.Timer),
		autoBattleCountries: make(map[string]bool),
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
			SpectatorCount:    0,
			ArenaRadius:       tierCfg.ArenaRadius,
			MaxAgents:         CalcMaxAgents(seed.Tier, seed.Population),
			TerrainTheme:      seed.TerrainTheme,
			Adjacent:          seed.Adjacency,
			Latitude:          seed.Latitude,
			Longitude:         seed.Longitude,
			CapitalName:       seed.CapitalName,
			Population:        seed.Population,
		}
	}

	slog.Info("world manager initialized", "countries", len(wm.countries))
	return wm
}

// SetSovereignty sets the sovereignty engine reference.
func (wm *WorldManager) SetSovereignty(sov *SovereigntyEngine) {
	wm.sovereignty = sov
}

// Start begins the world manager's background tasks.
func (wm *WorldManager) Start(ctx context.Context) {
	// Restore country state from Redis if available
	wm.restoreFromRedis(ctx)

	// Country status broadcast (1Hz)
	go wm.broadcastLoop(ctx)

	// Redis sync loop (5s interval)
	if wm.redis != nil && wm.config.RedisSyncEnabled {
		go wm.redisSyncLoop(ctx)
	}

	// v17: Auto-start battles in random countries (bots only)
	if wm.config.AutoBattleCount > 0 {
		go wm.autoStartBattles(ctx)
	}

	slog.Info("world manager started",
		"redisSyncEnabled", wm.config.RedisSyncEnabled,
		"autoBattleCount", wm.config.AutoBattleCount,
	)
}

// Stop shuts down all active arenas and cancels battle timers.
func (wm *WorldManager) Stop() {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	// Cancel all battle timers
	for iso, timer := range wm.battleTimers {
		timer.Stop()
		delete(wm.battleTimers, iso)
	}

	// Stop all active arenas
	for iso, arena := range wm.activeArenas {
		arena.Stop()
		slog.Info("stopped arena", "country", iso)
	}

	// Sync final state to Redis
	wm.syncAllToRedis()

	slog.Info("world manager stopped", "activeArenas", len(wm.activeArenas))
}

// --- Country accessors ---

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

// GetActiveArena returns the active arena for a country, or nil.
func (wm *WorldManager) GetActiveArena(countryISO string) *CountryArena {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.activeArenas[countryISO]
}

// --- Player management ---

// ArenaFullError indicates that a country arena has reached its max agent capacity.
type ArenaFullError struct {
	CountryCode string
	MaxAgents   int
	Current     int
}

func (e *ArenaFullError) Error() string {
	return fmt.Sprintf("arena %s full: %d/%d agents", e.CountryCode, e.Current, e.MaxAgents)
}

// JoinCountry places a player into a country's arena (creating it on-demand).
func (wm *WorldManager) JoinCountry(clientID, countryISO, name string, skinID int, appearance string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	// Verify country exists
	state, ok := wm.countries[countryISO]
	if !ok {
		return fmt.Errorf("country %s not found", countryISO)
	}

	// v15: Check population-based agent limit
	if state.ActiveAgents >= state.MaxAgents {
		return &ArenaFullError{
			CountryCode: countryISO,
			MaxAgents:   state.MaxAgents,
			Current:     state.ActiveAgents,
		}
	}

	// Leave current country if any
	if current, exists := wm.playerCountry[clientID]; exists {
		if arena, aok := wm.activeArenas[current]; aok {
			arena.RemovePlayer(clientID)
		}
		delete(wm.playerCountry, clientID)
	}

	// Also remove from spectator if spectating
	delete(wm.spectatorCountry, clientID)

	// Get or create arena
	arena, err := wm.getOrCreateArenaLocked(countryISO, state)
	if err != nil {
		return err
	}

	// Add player to arena
	arena.AddPlayer(clientID, name, skinID, appearance)
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

// --- Spectator management ---

// JoinSpectate places a client as a spectator in a country's arena.
func (wm *WorldManager) JoinSpectate(clientID, countryISO string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	state, ok := wm.countries[countryISO]
	if !ok {
		return fmt.Errorf("country %s not found", countryISO)
	}

	// Leave current spectating if any
	if prev, exists := wm.spectatorCountry[clientID]; exists {
		if prevState, pok := wm.countries[prev]; pok {
			prevState.SpectatorCount--
			if prevState.SpectatorCount < 0 {
				prevState.SpectatorCount = 0
			}
		}
	}

	// Leave playing if in any country
	if current, exists := wm.playerCountry[clientID]; exists {
		if arena, aok := wm.activeArenas[current]; aok {
			arena.RemovePlayer(clientID)
		}
		delete(wm.playerCountry, clientID)
	}

	wm.spectatorCountry[clientID] = countryISO
	state.SpectatorCount++

	slog.Info("spectator joined country",
		"clientId", clientID,
		"country", countryISO,
	)

	return nil
}

// LeaveSpectate removes a client from spectating.
func (wm *WorldManager) LeaveSpectate(clientID string) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	iso, ok := wm.spectatorCountry[clientID]
	if !ok {
		return
	}

	if state, exists := wm.countries[iso]; exists {
		state.SpectatorCount--
		if state.SpectatorCount < 0 {
			state.SpectatorCount = 0
		}
	}
	delete(wm.spectatorCountry, clientID)
}

// GetSpectatorCount returns the spectator count for a country.
func (wm *WorldManager) GetSpectatorCount(countryISO string) int {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	if state, ok := wm.countries[countryISO]; ok {
		return state.SpectatorCount
	}
	return 0
}

// --- Input routing ---

// RouteInput forwards player input to the correct country arena (legacy single-angle).
func (wm *WorldManager) RouteInput(clientID string, angle float64, boost bool, dash bool) {
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
	arena.HandleInput(clientID, angle, boost, dash)
}

// RouteInputSplit forwards split move/aim input to the correct country arena (v16).
func (wm *WorldManager) RouteInputSplit(clientID string, moveAngle float64, aimAngle float64, boost bool, dash bool, jump bool) {
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
	arena.HandleInputSplit(clientID, moveAngle, aimAngle, boost, dash, jump)
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

// RouteARInput forwards arena combat input to the correct country arena (v19).
func (wm *WorldManager) RouteARInput(clientID string, input game.ARInput) {
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
	arena.HandleARInput(clientID, input)
}

// RouteARChoose forwards arena tome/weapon choice to the correct country arena (v19).
func (wm *WorldManager) RouteARChoose(clientID string, choice game.ARChoice) {
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
	arena.HandleARChoose(clientID, choice)
}

// --- Queries ---

// GetPlayerCountry returns the country ISO code a player is in.
func (wm *WorldManager) GetPlayerCountry(clientID string) string {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.playerCountry[clientID]
}

// GetSpectatorCountry returns the country ISO code a spectator is watching.
func (wm *WorldManager) GetSpectatorCountry(clientID string) string {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return wm.spectatorCountry[clientID]
}

// TotalPlayers returns the total number of connected players across all arenas.
func (wm *WorldManager) TotalPlayers() int {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return len(wm.playerCountry)
}

// TotalSpectators returns the total number of spectators.
func (wm *WorldManager) TotalSpectators() int {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return len(wm.spectatorCountry)
}

// --- Battle Cycle Scheduler ---

// ScheduleBattle schedules a battle for a country after the cooldown period.
// Each country has its own independent battle cycle.
func (wm *WorldManager) ScheduleBattle(countryISO string) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	state, ok := wm.countries[countryISO]
	if !ok {
		return
	}

	// Don't schedule if already in battle or preparing
	if state.BattleStatus != "idle" && state.BattleStatus != "cooldown" {
		return
	}

	// Cancel existing timer if any
	if timer, exists := wm.battleTimers[countryISO]; exists {
		timer.Stop()
	}

	// Set preparing status
	state.BattleStatus = "preparing"

	// Schedule battle start after countdown
	countdownDuration := time.Duration(wm.config.CountdownSec) * time.Second
	wm.battleTimers[countryISO] = time.AfterFunc(countdownDuration, func() {
		wm.startBattle(countryISO)
	})

	slog.Info("battle scheduled",
		"country", countryISO,
		"startsIn", countdownDuration,
	)
}

// StartBattleIfNeeded starts a battle for a country if there are enough agents.
// Called when agents are deployed to a country.
func (wm *WorldManager) StartBattleIfNeeded(countryISO string) {
	wm.mu.RLock()
	state, ok := wm.countries[countryISO]
	if !ok {
		wm.mu.RUnlock()
		return
	}
	battleStatus := state.BattleStatus
	agentCount := state.ActiveAgents
	wm.mu.RUnlock()

	if battleStatus == "idle" && agentCount >= 1 {
		wm.ScheduleBattle(countryISO)
	}
}

// startBattle initiates an actual battle in the country arena.
func (wm *WorldManager) startBattle(countryISO string) {
	wm.mu.Lock()

	state, ok := wm.countries[countryISO]
	if !ok {
		wm.mu.Unlock()
		return
	}

	// Create arena on demand
	arena, err := wm.getOrCreateArenaLocked(countryISO, state)
	if err != nil {
		slog.Error("failed to start battle", "country", countryISO, "error", err)
		state.BattleStatus = "idle"
		wm.mu.Unlock()
		return
	}

	state.BattleStatus = "in_battle"
	state.LastBattleAt = time.Now()

	// Reset faction scores for fresh battle
	arena.ResetBattleResults()

	wm.mu.Unlock()

	// Emit battle start event
	wm.emitEvents([]WorldEvent{{
		Type:       WorldEvtBattleStart,
		CountryISO: countryISO,
		Data: map[string]interface{}{
			"country":    countryISO,
			"duration":   wm.config.BattleDurationSec,
			"agentCount": state.ActiveAgents,
		},
	}})

	// Publish to Redis
	wm.publishBattleEvent(countryISO, "battle_start", nil)

	// Schedule battle end
	battleDuration := time.Duration(wm.config.BattleDurationSec) * time.Second
	wm.mu.Lock()
	wm.battleTimers[countryISO] = time.AfterFunc(battleDuration, func() {
		wm.endBattle(countryISO)
	})
	wm.mu.Unlock()

	slog.Info("battle started",
		"country", countryISO,
		"duration", battleDuration,
	)
}

// endBattle concludes a battle and processes results.
func (wm *WorldManager) endBattle(countryISO string) {
	wm.mu.Lock()

	state, ok := wm.countries[countryISO]
	if !ok {
		wm.mu.Unlock()
		return
	}

	arena, arenaOk := wm.activeArenas[countryISO]
	if !arenaOk {
		state.BattleStatus = "idle"
		wm.mu.Unlock()
		return
	}

	// Get battle results
	factionScores := arena.GetBattleResults()
	winnerFaction, winnerScore := arena.DetermineWinningFaction()

	state.BattleStatus = "cooldown"

	wm.mu.Unlock()

	// v12 S21: 팩션별 에이전트 수 집계
	factionAgentCounts := make(map[string]int)
	detailedResults := arena.GetDetailedBattleResults()
	for fid, fs := range detailedResults {
		factionAgentCounts[fid] = fs.AgentCount
	}

	// Build result data
	resultData := BattleResult{
		CountryISO:         countryISO,
		WinnerFaction:      winnerFaction,
		WinnerScore:        winnerScore,
		FactionScores:      factionScores,
		FactionAgentCounts: factionAgentCounts,
		BattledAt:          time.Now(),
	}

	// Emit battle end event
	wm.emitEvents([]WorldEvent{{
		Type:       WorldEvtBattleEnd,
		CountryISO: countryISO,
		Data:       resultData,
	}})

	// Publish battle results to Redis for sovereignty processing
	wm.publishBattleEvent(countryISO, "battle_end", resultData)

	// Process sovereignty change
	if wm.sovereignty != nil && winnerFaction != "" {
		wm.sovereignty.ProcessBattleResult(resultData)
	}

	slog.Info("battle ended",
		"country", countryISO,
		"winner", winnerFaction,
		"score", winnerScore,
	)

	// Schedule cooldown → next battle cycle
	cooldownDuration := time.Duration(wm.config.BattleCooldownSec) * time.Second
	wm.mu.Lock()
	wm.battleTimers[countryISO] = time.AfterFunc(cooldownDuration, func() {
		wm.onCooldownEnd(countryISO)
	})
	wm.mu.Unlock()
}

// onCooldownEnd handles the end of a battle cooldown period.
func (wm *WorldManager) onCooldownEnd(countryISO string) {
	wm.mu.Lock()
	state, ok := wm.countries[countryISO]
	if !ok {
		wm.mu.Unlock()
		return
	}

	state.BattleStatus = "idle"

	// Check if arena should be returned to pool (no agents)
	arena, arenaOk := wm.activeArenas[countryISO]
	if arenaOk && arena.PlayerCount() == 0 && state.ActiveAgents == 0 {
		wm.returnArenaToPool(countryISO)
	}

	// Check if there are still agents that warrant another battle
	hasAgents := state.ActiveAgents > 0
	isAutoBattle := wm.autoBattleCountries[countryISO]
	wm.mu.Unlock()

	// v17: Auto-battle countries always re-schedule
	if hasAgents || isAutoBattle {
		wm.ScheduleBattle(countryISO)
	}

	slog.Info("battle cooldown ended", "country", countryISO, "hasAgents", hasAgents, "autoBattle", isAutoBattle)
}

// --- Arena pooling ---

// getOrCreateArenaLocked gets an existing arena or creates a new one.
// Caller must hold wm.mu write lock.
func (wm *WorldManager) getOrCreateArenaLocked(iso3 string, state *CountryState) (*CountryArena, error) {
	if arena, ok := wm.activeArenas[iso3]; ok {
		return arena, nil
	}

	// Check concurrent arena limit
	if len(wm.activeArenas) >= wm.config.MaxConcurrentArenas {
		// Try to reclaim idle arenas
		wm.reclaimIdleArenasLocked()
		if len(wm.activeArenas) >= wm.config.MaxConcurrentArenas {
			return nil, fmt.Errorf("max concurrent arenas reached (%d)", wm.config.MaxConcurrentArenas)
		}
	}

	// Try to reuse from pool
	var arena *CountryArena
	if len(wm.arenaPool) > 0 {
		arena = wm.arenaPool[len(wm.arenaPool)-1]
		wm.arenaPool = wm.arenaPool[:len(wm.arenaPool)-1]
		arena.Reinitialize(iso3, state.Name, state.Tier, wm.buildRoomConfig(state))
	} else {
		// Create a new CountryArena using the room config from v10
		arena = NewCountryArena(iso3, state.Name, state.Tier, wm.buildRoomConfig(state))
	}

	arena.OnEvents = wm.handleArenaEvents
	arena.SovereignFaction = state.SovereignFaction
	arena.SovereigntyLevel = state.SovereigntyLevel
	arena.DefenseBonus = calculateDefenseBonus(state.Tier, state.SovereigntyLevel)

	wm.activeArenas[iso3] = arena

	// Start the arena
	arena.Start(context.Background())

	slog.Info("arena created on-demand",
		"country", iso3,
		"tier", state.Tier,
		"arenaRadius", state.ArenaRadius,
		"poolSize", len(wm.arenaPool),
	)

	return arena, nil
}

// returnArenaToPool stops an arena and returns it to the pool for reuse.
func (wm *WorldManager) returnArenaToPool(iso3 string) {
	arena, ok := wm.activeArenas[iso3]
	if !ok {
		return
	}

	arena.Stop()
	delete(wm.activeArenas, iso3)

	// Only pool if under capacity
	if len(wm.arenaPool) < 10 {
		wm.arenaPool = append(wm.arenaPool, arena)
	}

	slog.Info("arena returned to pool",
		"country", iso3,
		"poolSize", len(wm.arenaPool),
		"activeArenas", len(wm.activeArenas),
	)
}

// reclaimIdleArenasLocked returns arenas with no players/agents to the pool.
// Caller must hold wm.mu write lock.
func (wm *WorldManager) reclaimIdleArenasLocked() {
	for iso, arena := range wm.activeArenas {
		state := wm.countries[iso]
		if state == nil {
			continue
		}
		if arena.PlayerCount() == 0 && state.BattleStatus == "idle" && state.ActiveAgents == 0 {
			wm.returnArenaToPool(iso)
		}
	}
}

// buildRoomConfig creates a RoomConfig from country state.
func (wm *WorldManager) buildRoomConfig(state *CountryState) game.RoomConfig {
	// Reserve ~60% of slots for bots, but always allow at least 2 humans
	bots := state.MaxAgents * 60 / 100
	humans := state.MaxAgents - bots
	if humans < 2 {
		humans = 2
		bots = state.MaxAgents - humans
		if bots < 0 {
			bots = 0
		}
	}
	// Ensure at least 5 bots for every arena (auto-NPC)
	if bots < 5 {
		bots = 5
	}
	return game.RoomConfig{
		MaxRooms:          1,
		MaxPlayersPerRoom: state.MaxAgents,
		MaxHumansPerRoom:  humans,
		MaxBotsPerRoom:    bots,
		RoundDurationSec:  wm.config.BattleDurationSec,
		CountdownSec:      wm.config.CountdownSec,
		EndingSec:         wm.config.EndingSec,
		CooldownSec:       wm.config.BattleCooldownSec,
		MinPlayersToStart: 0, // auto-start immediately with bots (no waiting)
		TerrainTheme:      state.TerrainTheme,
		// v19: Enable arena combat mode for all country arenas
		CombatMode:  game.CombatModeArena,
		CountryTier: string(state.Tier),
		CountryISO3: state.ISO3,
		CountryName: state.Name,
	}
}

// calculateDefenseBonus computes terrain defense bonus based on tier and sovereignty.
func calculateDefenseBonus(tier CountryTier, sovereigntyLevel int) float64 {
	var base float64
	switch tier {
	case TierS:
		base = 0.10
	case TierA:
		base = 0.15
	case TierB:
		base = 0.20
	case TierC:
		base = 0.25
	case TierD:
		base = 0.30
	default:
		base = 0.15
	}
	// Sovereignty level adds +5% per level
	return base + float64(sovereigntyLevel)*0.05
}

// --- Event handling ---

// handleArenaEvents bridges CountryArena events to WorldManager events.
func (wm *WorldManager) handleArenaEvents(events []game.RoomEvent) {
	if wm.OnEvents == nil {
		return
	}
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

// emitEvents sends world events to the callback.
func (wm *WorldManager) emitEvents(events []WorldEvent) {
	if wm.OnEvents != nil && len(events) > 0 {
		wm.OnEvents(events)
	}
}

// --- Auto-Battle Scheduling (v17) ---

// autoStartBattles selects random countries and starts bot-only battles.
// Battles are staggered over the first 3 minutes so they don't all start at once.
func (wm *WorldManager) autoStartBattles(ctx context.Context) {
	// Wait a bit for all systems to initialize
	select {
	case <-ctx.Done():
		return
	case <-time.After(2 * time.Second):
	}

	wm.mu.RLock()
	// Collect all country ISO codes
	isos := make([]string, 0, len(wm.countries))
	for iso := range wm.countries {
		isos = append(isos, iso)
	}
	wm.mu.RUnlock()

	// Shuffle and pick up to AutoBattleCount
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(len(isos), func(i, j int) { isos[i], isos[j] = isos[j], isos[i] })

	count := wm.config.AutoBattleCount
	if count > len(isos) {
		count = len(isos)
	}
	if count > wm.config.MaxConcurrentArenas {
		count = wm.config.MaxConcurrentArenas
	}

	// Register auto-battle countries
	wm.mu.Lock()
	for i := 0; i < count; i++ {
		wm.autoBattleCountries[isos[i]] = true
	}
	wm.mu.Unlock()

	slog.Info("v17 auto-battle scheduling", "count", count, "pool", len(isos))

	for i := 0; i < count; i++ {
		iso := isos[i]

		// Stagger: random delay 0~180 seconds
		delay := time.Duration(rng.Intn(180)) * time.Second

		go func(countryISO string, d time.Duration) {
			select {
			case <-ctx.Done():
				return
			case <-time.After(d):
			}

			wm.ScheduleBattle(countryISO)
			slog.Info("v17 auto-battle started", "country", countryISO, "delay", d)
		}(iso, delay)
	}
}

// --- Broadcasting (1Hz) ---

// broadcastLoop sends country state updates at 1Hz.
func (wm *WorldManager) broadcastLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			wm.broadcastCountriesState()
		}
	}
}

// broadcastCountriesState compiles and broadcasts all 195 country states.
func (wm *WorldManager) broadcastCountriesState() {
	wm.mu.Lock()

	// Update active agent counts from arenas
	for iso, arena := range wm.activeArenas {
		if state, ok := wm.countries[iso]; ok {
			state.ActiveAgents = arena.PlayerCount()
		}
	}

	// Build compact broadcast
	states := make([]CountryBroadcastState, 0, len(wm.countries))
	for _, state := range wm.countries {
		// Only include countries with activity
		if state.BattleStatus != "idle" || state.ActiveAgents > 0 ||
			state.SovereignFaction != "" || state.SpectatorCount > 0 {
			states = append(states, CountryBroadcastState{
				ISO3:             state.ISO3,
				BattleStatus:     state.BattleStatus,
				SovereignFaction: state.SovereignFaction,
				SovereigntyLevel: state.SovereigntyLevel,
				ActiveAgents:     state.ActiveAgents,
				SpectatorCount:   state.SpectatorCount,
				MaxAgents:        state.MaxAgents,
				Population:       state.Population,
			})
		}
	}

	wm.mu.Unlock()

	// Emit as world event (will be broadcast to all connected clients)
	if len(states) > 0 {
		wm.emitEvents([]WorldEvent{{
			Type: WorldEvtCountriesState,
			Data: states,
		}})
	}
}

// --- Redis sync ---

// redisSyncLoop periodically syncs country state to Redis.
func (wm *WorldManager) redisSyncLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			wm.syncAllToRedis()
		}
	}
}

// syncAllToRedis saves all country states to Redis using pipelined writes.
// S39 Optimization: replaces 195 individual SET commands with a single pipeline (~1 RTT).
func (wm *WorldManager) syncAllToRedis() {
	if wm.redis == nil {
		return
	}

	wm.mu.RLock()
	states := make(map[string]interface{}, len(wm.countries))
	for k, v := range wm.countries {
		states[k] = v
	}
	wm.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// S39: Use pipeline for batch writes (195 SETs in 1 RTT instead of 195 RTTs)
	pipeline := cache.NewPipelineWriter(wm.redis)
	if err := pipeline.BatchSetCountryStates(ctx, states, 30*time.Second); err != nil {
		slog.Warn("redis pipeline sync failed", "error", err)
	}

	// Also store a world summary
	if err := wm.redis.Set(ctx, cache.WorldStateKey, map[string]interface{}{
		"activeArenas": wm.GetActiveArenaCount(),
		"totalPlayers": wm.TotalPlayers(),
		"updatedAt":    time.Now().UnixMilli(),
	}, 30*time.Second); err != nil {
		slog.Warn("redis world state sync failed", "error", err)
	}
}

// restoreFromRedis restores country state from Redis on startup.
// S39 Optimization: uses pipeline BatchGet for 195 keys in 1 RTT.
func (wm *WorldManager) restoreFromRedis(ctx context.Context) {
	if wm.redis == nil || !wm.config.RedisSyncEnabled {
		return
	}

	wm.mu.Lock()
	defer wm.mu.Unlock()

	restoreCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// S39: Batch-read all country keys in a single pipeline
	keys := make([]string, 0, len(wm.countries))
	for iso := range wm.countries {
		keys = append(keys, cache.CountryStateKey(iso))
	}

	pipeline := cache.NewPipelineWriter(wm.redis)
	results, err := pipeline.BatchGet(restoreCtx, keys)
	if err != nil {
		slog.Warn("redis pipeline restore failed", "error", err)
		return
	}

	restored := 0
	for iso := range wm.countries {
		key := cache.CountryStateKey(iso)
		data, ok := results[key]
		if !ok {
			continue
		}
		var cached CountryState
		if err := json.Unmarshal(data, &cached); err != nil {
			continue
		}
		// Only restore persistent fields (sovereignty, GDP)
		state := wm.countries[iso]
		state.SovereignFaction = cached.SovereignFaction
		state.SovereigntyLevel = cached.SovereigntyLevel
		state.SovereigntyStreak = cached.SovereigntyStreak
		state.GDP = cached.GDP
		restored++
	}

	if restored > 0 {
		slog.Info("restored country states from Redis", "count", restored)
	}
}

// publishBattleEvent publishes a battle event to Redis pub/sub.
func (wm *WorldManager) publishBattleEvent(countryISO, eventType string, data interface{}) {
	if wm.redis == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	payload := map[string]interface{}{
		"event":   eventType,
		"country": countryISO,
		"time":    time.Now().UnixMilli(),
	}
	if data != nil {
		if encoded, err := json.Marshal(data); err == nil {
			payload["data"] = json.RawMessage(encoded)
		}
	}

	channel := cache.BattleChannel(countryISO)
	if err := wm.redis.Publish(ctx, channel, payload); err != nil {
		slog.Warn("redis publish failed",
			"channel", channel,
			"event", eventType,
			"error", err,
		)
	}
}

// --- Country state mutations ---

// UpdateSovereignty updates a country's sovereignty state.
func (wm *WorldManager) UpdateSovereignty(iso3, factionID string, level, streak int) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	state, ok := wm.countries[iso3]
	if !ok {
		return
	}

	oldFaction := state.SovereignFaction
	state.SovereignFaction = factionID
	state.SovereigntyLevel = level
	state.SovereigntyStreak = streak

	// Update active arena if exists
	if arena, aOk := wm.activeArenas[iso3]; aOk {
		arena.SovereignFaction = factionID
		arena.SovereigntyLevel = level
		arena.DefenseBonus = calculateDefenseBonus(state.Tier, level)
	}

	if oldFaction != factionID {
		slog.Info("sovereignty changed",
			"country", iso3,
			"from", oldFaction,
			"to", factionID,
			"level", level,
		)
	}
}

// UpdateCountryGDP updates a country's GDP.
func (wm *WorldManager) UpdateCountryGDP(iso3 string, gdp int64) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if state, ok := wm.countries[iso3]; ok {
		state.GDP = gdp
	}
}

// BattleResult holds the outcome of a country battle.
type BattleResult struct {
	CountryISO         string         `json:"country_iso"`
	WinnerFaction      string         `json:"winner_faction"`
	WinnerScore        int            `json:"winner_score"`
	FactionScores      map[string]int `json:"faction_scores"`
	FactionAgentCounts map[string]int `json:"faction_agent_counts"` // v12 S21: 팩션별 참여 에이전트 수
	BattledAt          time.Time      `json:"battled_at"`
}
