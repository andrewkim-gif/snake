package game

import (
	"fmt"
	"log/slog"
	"sync"
)

// CountryArenaManager manages 195 country arenas with lazy initialization.
// Only active arenas (with players or ongoing epochs) consume resources.
// This provides a compatibility layer over the existing RoomManager for
// gradual migration from the v11 5-room system to v14's per-country arenas.
type CountryArenaManager struct {
	mu sync.RWMutex

	// Active country arenas (lazy-created on demand)
	arenas map[string]*CountryArenaWrapper

	// Player routing: clientID → countryCode
	playerCountry map[string]string

	// v33: Matrix player routing: clientID → countryCode (separate from legacy playerCountry)
	matrixPlayerCountry map[string]string

	// Queue per country: when arena is full (50 cap)
	queues map[string][]QueueEntry

	// Configuration
	maxPlayersPerArena int
	defaultConfig      RoomConfig

	// Event callback (bridges to ws layer)
	OnEvents RoomEventCallback

	// Epoch event callback (bridges epoch events to ws layer)
	OnEpochEvents func(events []EpochEvent)

	// Capture point event callback (bridges capture events to ws layer)
	OnCaptureEvent func(event CapturePointEvent)

	// v15: Domination event callback (bridges domination events to ws layer)
	OnDominationEvent func(event DominationEvent)

	// v33: Matrix epoch event callback for broadcasting phase changes
	OnMatrixEpochChange func(countryCode string, event MatrixEpochChangeEvent)
}

// QueueEntry represents a player waiting to join a full arena.
type QueueEntry struct {
	ClientID   string
	Name       string
	SkinID     int
	Appearance string
	Nationality string
}

// CountryArenaWrapper wraps a Room with country-specific metadata for v14.
// This lives in the game package to allow direct Room access without
// the world package dependency cycle.
type CountryArenaWrapper struct {
	CountryCode    string
	CountryName    string
	Room           *Room
	Epoch          *EpochManager
	Respawn        *RespawnManager
	CapturePoints  *CapturePointSystem
	Domination     *DominationEngine
	NationScore    *NationScoreTracker
	MatrixEngine   *OnlineMatrixEngine // v33: Online Matrix engine (per-arena)
	PlayerCount    int
}

// NewCountryArenaManager creates a manager for 195 country arenas.
func NewCountryArenaManager(cfg RoomConfig) *CountryArenaManager {
	return &CountryArenaManager{
		arenas:              make(map[string]*CountryArenaWrapper),
		playerCountry:       make(map[string]string),
		matrixPlayerCountry: make(map[string]string),
		queues:              make(map[string][]QueueEntry),
		maxPlayersPerArena:  50,
		defaultConfig:       cfg,
	}
}

// createArenaLocked creates a new arena and stores it. Caller must hold mu.
func (cam *CountryArenaManager) createArenaLocked(countryCode, countryName string) *CountryArenaWrapper {
	cfg := cam.defaultConfig
	cfg.MaxPlayersPerRoom = cam.maxPlayersPerArena

	room := NewRoom(countryCode, countryName, cfg)
	room.OnEvents = cam.forwardEvents

	epoch := NewEpochManager(countryCode)
	epoch.OnEvents = cam.forwardEpochEvents
	respawn := NewRespawnManager()

	capturePoints := NewCapturePointSystem(countryCode, ArenaRadius)
	domination := NewDominationEngine(countryCode)
	nationScore := NewNationScoreTracker(countryCode)

	// v33: Create OnlineMatrixEngine for this arena
	matrixEngine := NewOnlineMatrixEngine(countryCode)

	wrapper := &CountryArenaWrapper{
		CountryCode:   countryCode,
		CountryName:   countryName,
		Room:          room,
		Epoch:         epoch,
		Respawn:       respawn,
		CapturePoints: capturePoints,
		Domination:    domination,
		NationScore:   nationScore,
		MatrixEngine:  matrixEngine,
	}

	// Wire CapturePoints.OnEvent callback to forward capture events
	capturePoints.OnEvent = cam.forwardCaptureEvent

	// v15: Wire DominationEngine.OnEvent callback to forward domination events
	domination.OnEvent = cam.forwardDominationEvent

	// v33: Wire EpochManager phase changes → MatrixEngine
	origOnEvents := epoch.OnEvents
	epoch.OnEvents = func(events []EpochEvent) {
		// Forward to original handler
		if origOnEvents != nil {
			origOnEvents(events)
		}
		// Forward epoch events to MatrixEngine
		for _, evt := range events {
			if matrixEngine.GetPlayerCount() == 0 {
				continue
			}
			switch evt.Type {
			case EpochEvtEpochStart:
				if data, ok := evt.Data.(EpochStartData); ok {
					matrixEngine.OnEpochPhaseChange(data.Phase, data.EpochNumber, EpochShrinkStartRadius)
				}
			case EpochEvtWarPhaseStart:
				if data, ok := evt.Data.(WarPhaseData); ok {
					matrixEngine.OnEpochPhaseChange(EpochPhaseWar, data.EpochNumber, epoch.GetCurrentRadius())
				}
			case EpochEvtWarPhaseEnd:
				matrixEngine.OnEpochPhaseChange(EpochPhaseEnd, epoch.GetEpochNumber(), epoch.GetCurrentRadius())
			case EpochEvtPhaseChange:
				if data, ok := evt.Data.(map[string]interface{}); ok {
					if phase, ok := data["phase"].(string); ok {
						matrixEngine.OnEpochPhaseChange(EpochPhase(phase), epoch.GetEpochNumber(), epoch.GetCurrentRadius())
					}
				}
			case EpochEvtWarCountdown:
				matrixEngine.OnEpochPhaseChange(EpochPhaseWarCountdown, epoch.GetEpochNumber(), epoch.GetCurrentRadius())
			case EpochEvtEpochEnd:
				if data, ok := evt.Data.(EpochEndData); ok {
					// Find dominant nation from matrix scores
					dominant := ""
					nationScores := matrixEngine.GetScoreAggregator().GetNationScores()
					maxScore := 0
					for nat, score := range nationScores {
						if score > maxScore {
							maxScore = score
							dominant = nat
						}
					}
					matrixEngine.OnEpochEnd(data.EpochNumber, dominant, false, false)
				}
			}
		}
	}

	// v33: Wire MatrixEngine ban callback
	matrixEngine.OnBan = func(clientID, reason string) {
		slog.Warn("matrix player banned",
			"clientId", clientID,
			"country", countryCode,
			"reason", reason,
		)
	}

	// Start the epoch cycle so Tick() processes phase transitions
	epoch.Start()

	// Start the matrix engine
	matrixEngine.Start()

	cam.arenas[countryCode] = wrapper

	slog.Info("country arena created (lazy) with matrix engine",
		"countryCode", countryCode,
		"countryName", countryName,
	)

	return wrapper
}

// GetOrCreateArena lazily initializes a country arena on first access.
func (cam *CountryArenaManager) GetOrCreateArena(countryCode, countryName string) *CountryArenaWrapper {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	if arena, ok := cam.arenas[countryCode]; ok {
		return arena
	}

	return cam.createArenaLocked(countryCode, countryName)
}

// JoinCountryArena adds a player to a country arena, or queues them if full.
func (cam *CountryArenaManager) JoinCountryArena(clientID, countryCode, countryName, name string, skinID int, appearance, nationality string) error {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	// Leave current country if any
	if current, exists := cam.playerCountry[clientID]; exists {
		if arena, ok := cam.arenas[current]; ok {
			arena.Room.RemovePlayer(clientID)
			arena.PlayerCount--
		}
		delete(cam.playerCountry, clientID)
	}

	// Get or create arena
	arena, ok := cam.arenas[countryCode]
	if !ok {
		arena = cam.createArenaLocked(countryCode, countryName)
	}

	// Check capacity
	if arena.PlayerCount >= cam.maxPlayersPerArena {
		// Add to queue
		cam.queues[countryCode] = append(cam.queues[countryCode], QueueEntry{
			ClientID:    clientID,
			Name:        name,
			SkinID:      skinID,
			Appearance:  appearance,
			Nationality: nationality,
		})
		return fmt.Errorf("arena %s is full (cap %d), added to queue (position %d)",
			countryCode, cam.maxPlayersPerArena, len(cam.queues[countryCode]))
	}

	// Add player
	if err := arena.Room.AddPlayer(clientID, name, skinID, appearance); err != nil {
		return fmt.Errorf("failed to add player to arena %s: %w", countryCode, err)
	}

	arena.PlayerCount++
	cam.playerCountry[clientID] = countryCode

	slog.Info("player joined country arena",
		"clientId", clientID,
		"country", countryCode,
		"nationality", nationality,
		"arenaPlayers", arena.PlayerCount,
	)

	return nil
}

// LeaveCountryArena removes a player from their current country arena.
func (cam *CountryArenaManager) LeaveCountryArena(clientID string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	countryCode, ok := cam.playerCountry[clientID]
	if !ok {
		// v33: Also check matrix players
		if cc, mok := cam.matrixPlayerCountry[clientID]; mok {
			if arena, exists := cam.arenas[cc]; exists && arena.MatrixEngine != nil {
				arena.MatrixEngine.OnPlayerLeave(clientID)
			}
			delete(cam.matrixPlayerCountry, clientID)
		}
		return
	}

	if arena, exists := cam.arenas[countryCode]; exists {
		arena.Room.RemovePlayer(clientID)
		arena.PlayerCount--

		// Process queue if someone is waiting
		cam.processQueueLocked(countryCode)
	}

	delete(cam.playerCountry, clientID)
}

// processQueueLocked admits the next queued player (caller must hold mu).
func (cam *CountryArenaManager) processQueueLocked(countryCode string) {
	queue, ok := cam.queues[countryCode]
	if !ok || len(queue) == 0 {
		return
	}

	arena, exists := cam.arenas[countryCode]
	if !exists || arena.PlayerCount >= cam.maxPlayersPerArena {
		return
	}

	// Admit first in queue
	entry := queue[0]
	cam.queues[countryCode] = queue[1:]

	if err := arena.Room.AddPlayer(entry.ClientID, entry.Name, entry.SkinID, entry.Appearance); err != nil {
		slog.Warn("failed to admit queued player",
			"clientId", entry.ClientID,
			"country", countryCode,
			"error", err,
		)
		return
	}

	arena.PlayerCount++
	cam.playerCountry[entry.ClientID] = countryCode

	slog.Info("queued player admitted to arena",
		"clientId", entry.ClientID,
		"country", countryCode,
	)
}

// RouteInput forwards player input to the correct country arena (legacy single-angle).
func (cam *CountryArenaManager) RouteInput(clientID string, angle float64, boost bool, dash bool) {
	cam.mu.RLock()
	countryCode, ok := cam.playerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists {
		return
	}
	arena.Room.HandleInput(clientID, angle, boost, dash)
}

// RouteInputSplit forwards split move/aim input to the correct country arena (v16).
func (cam *CountryArenaManager) RouteInputSplit(clientID string, moveAngle float64, aimAngle float64, boost bool, dash bool, jump bool) {
	cam.mu.RLock()
	countryCode, ok := cam.playerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists {
		return
	}
	arena.Room.HandleInputSplit(clientID, moveAngle, aimAngle, boost, dash, jump)
}

// RouteChooseUpgrade forwards upgrade choice to the correct arena.
func (cam *CountryArenaManager) RouteChooseUpgrade(clientID string, choiceIndex int) {
	cam.mu.RLock()
	countryCode, ok := cam.playerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists {
		return
	}
	arena.Room.HandleChooseUpgrade(clientID, choiceIndex)
}

// RouteARInput forwards Arena combat input to the correct country arena.
func (cam *CountryArenaManager) RouteARInput(clientID string, input ARInput) {
	cam.mu.RLock()
	countryCode, ok := cam.playerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists {
		return
	}
	arena.Room.HandleARInput(clientID, input)
}

// RouteARChoose forwards Arena tome/weapon choice to the correct arena.
func (cam *CountryArenaManager) RouteARChoose(clientID string, choice ARChoice) {
	cam.mu.RLock()
	countryCode, ok := cam.playerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists {
		return
	}
	arena.Room.HandleARChoose(clientID, choice)
}

// GetPlayerCountry returns the country code a player is currently in.
func (cam *CountryArenaManager) GetPlayerCountry(clientID string) string {
	cam.mu.RLock()
	defer cam.mu.RUnlock()
	return cam.playerCountry[clientID]
}

// GetArena returns the arena wrapper for a country, or nil if not active.
func (cam *CountryArenaManager) GetArena(countryCode string) *CountryArenaWrapper {
	cam.mu.RLock()
	defer cam.mu.RUnlock()
	return cam.arenas[countryCode]
}

// GetActiveArenas returns all currently active (instantiated) arenas.
func (cam *CountryArenaManager) GetActiveArenas() map[string]*CountryArenaWrapper {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	snapshot := make(map[string]*CountryArenaWrapper, len(cam.arenas))
	for k, v := range cam.arenas {
		snapshot[k] = v
	}
	return snapshot
}

// GetQueueLength returns the queue length for a country arena.
func (cam *CountryArenaManager) GetQueueLength(countryCode string) int {
	cam.mu.RLock()
	defer cam.mu.RUnlock()
	return len(cam.queues[countryCode])
}

// TotalPlayers returns the total number of players across all arenas.
func (cam *CountryArenaManager) TotalPlayers() int {
	cam.mu.RLock()
	defer cam.mu.RUnlock()
	return len(cam.playerCountry)
}

// forwardEvents bridges room events to the external callback.
func (cam *CountryArenaManager) forwardEvents(events []RoomEvent) {
	if cam.OnEvents != nil {
		cam.OnEvents(events)
	}
}

// forwardEpochEvents bridges epoch events to the external callback.
func (cam *CountryArenaManager) forwardEpochEvents(events []EpochEvent) {
	if cam.OnEpochEvents != nil {
		cam.OnEpochEvents(events)
	}
}

// forwardCaptureEvent bridges capture point events to the external callback.
func (cam *CountryArenaManager) forwardCaptureEvent(event CapturePointEvent) {
	if cam.OnCaptureEvent != nil {
		cam.OnCaptureEvent(event)
	}
}

// forwardDominationEvent bridges domination events to the external callback.
func (cam *CountryArenaManager) forwardDominationEvent(event DominationEvent) {
	if cam.OnDominationEvent != nil {
		cam.OnDominationEvent(event)
	}
}

// TickActiveArenas ticks only active arenas' epoch managers and capture point systems.
// Called from the main game loop at 20Hz.
func (cam *CountryArenaManager) TickActiveArenas(tick uint64) {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	for _, arena := range cam.arenas {
		hasLegacyPlayers := arena.PlayerCount > 0
		hasMatrixPlayers := arena.MatrixEngine != nil && arena.MatrixEngine.GetPlayerCount() > 0

		if hasLegacyPlayers || hasMatrixPlayers {
			arena.Epoch.Tick(tick)

			// Tick capture points: build agent positions from arena agents
			if arena.Room != nil && arena.CapturePoints != nil {
				agents := arena.Room.GetArena().GetAgents()
				agentPositions := make([]AgentPosition, 0, len(agents))
				for _, a := range agents {
					if a.Alive {
						agentPositions = append(agentPositions, AgentPosition{
							ID:          a.ID,
							X:           a.Position.X,
							Y:           a.Position.Y,
							Nationality: a.Nationality,
							Alive:       true,
						})
					}
				}
				nearbyAgents := arena.CapturePoints.GetAgentsNearPoints(agentPositions)
				arena.CapturePoints.Tick(nearbyAgents)
			}

			// v33: Tick Matrix engine
			if hasMatrixPlayers {
				arena.MatrixEngine.Tick(tick)
			}
		}
	}
}
