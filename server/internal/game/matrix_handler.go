package game

import (
	"log/slog"
)

// ============================================================
// v33 Phase 2 — Matrix Handler: WebSocket event routing for
// Online Matrix arena play. Provides methods on
// CountryArenaManager that handle matrix_* uplink events
// and produce downlink broadcasts.
//
// Uplink events (client → server):
//   matrix_join, matrix_leave, matrix_input (10Hz),
//   matrix_kill, matrix_damage, matrix_capture, matrix_level_up
//
// Downlink events (server → client):
//   matrix_state (20Hz, delta), matrix_epoch, matrix_spawn_seed,
//   matrix_kill_confirmed, matrix_kill_rejected, matrix_score,
//   matrix_result, matrix_level_up_choices, matrix_buff
//
// Integration: Wired into registerEventHandlers() in main.go.
// CountryArenaWrapper.MatrixEngine is the per-arena orchestrator.
// ============================================================

// MatrixJoinRequest contains the parsed data for a matrix_join event.
type MatrixJoinRequest struct {
	ClientID    string
	Name        string
	Nationality string
	CountryCode string
	Build       string
	AgentID     string
	IsAgent     bool
	IsDirectPlay bool
	TokenBalance float64
}

// MatrixJoinResult is the response after joining a Matrix arena.
type MatrixJoinResult struct {
	Success      bool       `json:"success"`
	CountryCode  string     `json:"countryCode"`
	Phase        EpochPhase `json:"phase"`
	Tick         uint64     `json:"tick"`
	Seed         string     `json:"seed"`
	WaveID       int        `json:"waveId"`
	SafeZoneRadius float64 `json:"safeZoneRadius"`
	Error        string     `json:"error,omitempty"`
}

// MatrixScoreUpdate is the payload for matrix_score downlink events.
type MatrixScoreUpdate struct {
	NationScores  map[string]int `json:"nationScores"`
	PersonalScore int            `json:"personalScore"`
	Rank          int            `json:"rank"`
}

// --- Matrix Uplink Handlers ---

// MatrixJoin handles a player joining a Matrix arena.
// Returns the join result for sending back to the client.
func (cam *CountryArenaManager) MatrixJoin(req MatrixJoinRequest) *MatrixJoinResult {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	arena, ok := cam.arenas[req.CountryCode]
	if !ok {
		// Lazy-create the arena (without adding to legacy Room)
		arena = cam.createArenaLocked(req.CountryCode, req.CountryCode)
	}

	if arena.MatrixEngine == nil {
		return &MatrixJoinResult{
			Success: false,
			Error:   "matrix engine not initialized for " + req.CountryCode,
		}
	}

	info := MatrixJoinInfo{
		ClientID:     req.ClientID,
		Name:         req.Name,
		Nationality:  req.Nationality,
		IsAgent:      req.IsAgent,
		IsDirectPlay: req.IsDirectPlay,
		TokenBalance: req.TokenBalance,
		Build:        req.Build,
	}

	session, buffs := arena.MatrixEngine.OnPlayerJoin(info)
	if session == nil {
		return &MatrixJoinResult{
			Success: false,
			Error:   "arena full or player banned",
		}
	}

	// Track player → country mapping for matrix routing
	cam.matrixPlayerCountry[req.ClientID] = req.CountryCode

	// Get current seed for initial sync
	seedHex := arena.MatrixEngine.GetSeedSync().GetCurrentSeed()
	waveID := arena.MatrixEngine.GetSeedSync().GetWaveID()

	_ = buffs // buffs are already queued in pendingBuffUpdates by OnPlayerJoin

	slog.Info("matrix player joined via handler",
		"clientId", req.ClientID,
		"country", req.CountryCode,
		"nationality", req.Nationality,
	)

	return &MatrixJoinResult{
		Success:        true,
		CountryCode:    req.CountryCode,
		Phase:          arena.MatrixEngine.GetCurrentPhase(),
		Tick:           arena.MatrixEngine.GetCurrentTick(),
		Seed:           seedHex,
		WaveID:         waveID,
		SafeZoneRadius: arena.MatrixEngine.currentRadius,
	}
}

// MatrixLeave handles a player leaving a Matrix arena.
func (cam *CountryArenaManager) MatrixLeave(clientID string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		return
	}

	arena, exists := cam.arenas[countryCode]
	if exists && arena.MatrixEngine != nil {
		arena.MatrixEngine.OnPlayerLeave(clientID)
	}

	delete(cam.matrixPlayerCountry, clientID)
}

// MatrixInput handles player input (10Hz position + angle + boost).
func (cam *CountryArenaManager) MatrixInput(clientID string, input MatrixInputData) {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return
	}

	arena.MatrixEngine.OnPlayerInput(clientID, input)
}

// MatrixKill handles a kill report from a client.
// Returns the validation result for sending confirm/reject.
func (cam *CountryArenaManager) MatrixKill(clientID string, report KillReport) KillValidationResult {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return KillValidationResult{Valid: false, Reason: RejectInvalidState}
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return KillValidationResult{Valid: false, Reason: RejectInvalidState}
	}

	return arena.MatrixEngine.OnKillReport(report)
}

// MatrixDamage handles a PvP damage report from a client.
func (cam *CountryArenaManager) MatrixDamage(clientID string, report DamageReport) KillValidationResult {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return KillValidationResult{Valid: false, Reason: RejectInvalidState}
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return KillValidationResult{Valid: false, Reason: RejectInvalidState}
	}

	return arena.MatrixEngine.OnDamageReport(report)
}

// MatrixCapture handles a capture point entry.
func (cam *CountryArenaManager) MatrixCapture(clientID, pointID string) {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return
	}

	session := arena.MatrixEngine.GetSession(clientID)
	if session == nil {
		return
	}

	// Record capture in score aggregator
	arena.MatrixEngine.GetScoreAggregator().AddCapture(
		clientID, session.Name, session.Nationality, session.IsAgent, session.IsDirectPlay,
	)

	slog.Debug("matrix capture recorded",
		"clientId", clientID,
		"pointId", pointID,
		"country", countryCode,
	)
}

// MatrixLevelUp handles a player's level-up choice.
func (cam *CountryArenaManager) MatrixLevelUp(clientID string, newLevel int) {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return
	}

	arena.MatrixEngine.OnLevelUp(clientID, newLevel)
}

// GetMatrixPlayerCountry returns the country code a matrix player is in.
func (cam *CountryArenaManager) GetMatrixPlayerCountry(clientID string) (string, bool) {
	cam.mu.RLock()
	defer cam.mu.RUnlock()
	cc, ok := cam.matrixPlayerCountry[clientID]
	return cc, ok
}

// --- Matrix Downlink Collection ---

// MatrixDownlinkBatch collects all pending downlink events from a single arena.
type MatrixDownlinkBatch struct {
	CountryCode    string
	WorldState     *MatrixWorldState
	KillConfirms   []KillConfirmEvent
	KillRejects    []KillRejectEvent
	PhaseChanges   []MatrixEpochChangeEvent
	SeedEvents     []SpawnSeedEvent
	Results        []MatrixResultEvent
	BuffUpdates    map[string]TokenBuffs
	ScoreUpdates   map[string]MatrixScoreUpdate // clientID → personal score
}

// CollectMatrixDownlinks gathers all pending downlink events from all active
// matrix arenas. Called by the broadcaster goroutine at 20Hz.
func (cam *CountryArenaManager) CollectMatrixDownlinks() []MatrixDownlinkBatch {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	var batches []MatrixDownlinkBatch

	for code, arena := range cam.arenas {
		if arena.MatrixEngine == nil || arena.MatrixEngine.GetPlayerCount() == 0 {
			continue
		}

		engine := arena.MatrixEngine

		batch := MatrixDownlinkBatch{
			CountryCode:  code,
			WorldState:   engine.GetWorldState(),
			KillConfirms: engine.ConsumePendingKillConfirms(),
			KillRejects:  engine.ConsumePendingKillRejects(),
			PhaseChanges: engine.ConsumePendingPhaseChanges(),
			SeedEvents:   engine.ConsumePendingSeedEvents(),
			Results:      engine.ConsumePendingResults(),
			BuffUpdates:  engine.ConsumePendingBuffUpdates(),
		}

		// Build per-player score updates
		scoreUpdates := make(map[string]MatrixScoreUpdate)
		scorer := engine.GetScoreAggregator()
		for clientID := range cam.matrixPlayerCountry {
			if cam.matrixPlayerCountry[clientID] != code {
				continue
			}
			personalScore, _ := scorer.GetPlayerScore(clientID)
			rank := scorer.GetPlayerRank(clientID)
			scoreUpdates[clientID] = MatrixScoreUpdate{
				NationScores:  scorer.GetNationScores(),
				PersonalScore: personalScore,
				Rank:          rank,
			}
		}
		batch.ScoreUpdates = scoreUpdates

		// Mark full snapshot if applicable
		if batch.WorldState != nil && batch.WorldState.FullSnapshot {
			engine.MarkFullSnapshotSent()
		}

		batches = append(batches, batch)
	}

	return batches
}

// TickMatrixEngines ticks all active matrix engines. Called at 20Hz
// alongside TickActiveArenas.
func (cam *CountryArenaManager) TickMatrixEngines(tick uint64) {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	for _, arena := range cam.arenas {
		if arena.MatrixEngine != nil && arena.MatrixEngine.GetPlayerCount() > 0 {
			arena.MatrixEngine.Tick(tick)
		}
	}
}

// ============================================================
// v33 Phase 7 — Agent-Specific Matrix Handlers
//
// matrix_agent_input: Separate from matrix_input, routes agent
//   positional input through the same OnPlayerInput + KillValidator.
// matrix_agent_state: 10Hz agent-specific state event with
//   HP, level, weapons, nearby enemies, coordinates.
// Agent deployment: max 3 agents per owner, 50 Oil per agent.
// ============================================================

// MatrixAgentInputData holds agent-specific input data.
// Identical to MatrixInputData but routed through the agent handler
// for separate rate-limiting and logging.
type MatrixAgentInputData struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Angle float64 `json:"angle"`
	Boost bool    `json:"boost"`
	Tick  uint64  `json:"tick"`
}

// MatrixAgentStateEvent is the agent-specific state payload (10Hz).
// Contains richer information than the regular matrix_state:
// self HP/level/weapons, nearby enemies with HP, captures, scores.
type MatrixAgentStateEvent struct {
	Tick           uint64                   `json:"tick"`
	Phase          EpochPhase               `json:"phase"`
	Timer          int                      `json:"timer"`
	Self           MatrixAgentSelfState     `json:"self"`
	NearbyEnemies  []MatrixAgentNearbyPlayer `json:"nearby_enemies"`
	NearbyAllies   []MatrixAgentNearbyPlayer `json:"nearby_allies"`
	Captures       []MatrixAgentCapture     `json:"captures"`
	NationScores   map[string]int           `json:"nation_scores"`
	SafeZoneRadius float64                  `json:"safe_zone_radius"`
	PersonalScore  int                      `json:"personal_score"`
	Rank           int                      `json:"rank"`
}

// MatrixAgentSelfState is the agent's own state in matrix_agent_state.
type MatrixAgentSelfState struct {
	X             float64  `json:"x"`
	Y             float64  `json:"y"`
	Angle         float64  `json:"angle"`
	HP            int      `json:"hp"`
	MaxHP         int      `json:"max_hp"`
	Level         int      `json:"level"`
	Kills         int      `json:"kills"`
	Deaths        int      `json:"deaths"`
	TotalDamage   float64  `json:"total_damage"`
	Weapons       []string `json:"weapons"`
	StatusEffects []string `json:"status_effects"`
	Alive         bool     `json:"alive"`
	XPBoost       float64  `json:"xp_boost"`
	StatBoost     float64  `json:"stat_boost"`
}

// MatrixAgentNearbyPlayer is a nearby player in matrix_agent_state.
type MatrixAgentNearbyPlayer struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	X       float64  `json:"x"`
	Y       float64  `json:"y"`
	HP      int      `json:"hp"`
	MaxHP   int      `json:"max_hp"`
	Level   int      `json:"level"`
	Nation  string   `json:"nation"`
	Weapons []string `json:"weapons"`
	Alive   bool     `json:"alive"`
}

// MatrixAgentCapture is a capture point in matrix_agent_state.
type MatrixAgentCapture struct {
	ID       string  `json:"id"`
	Owner    string  `json:"owner"`
	Progress float64 `json:"progress"`
	Type     string  `json:"type"` // "resource", "buff", "healing"
}

// Agent deployment constants
const (
	// MatrixAgentDeployCostOil is the Oil cost per agent deployment.
	MatrixAgentDeployCostOil = 50

	// MatrixMaxAgentsPerOwner is the maximum number of agents per owner.
	MatrixMaxAgentsPerOwner = 3

	// MatrixAgentStateHz is the agent state broadcast frequency.
	// Every 2nd tick at 20Hz = 10Hz agent state updates.
	MatrixAgentStateTick = 2

	// MatrixAgentNearbyRadius is the detection radius for nearby players.
	MatrixAgentNearbyRadius = 500.0
)

// MatrixAgentInput handles agent-specific input (10Hz position + angle + boost).
// Uses the same validation pipeline as MatrixInput but tracks agent-specific metrics.
func (cam *CountryArenaManager) MatrixAgentInput(clientID string, input MatrixAgentInputData) {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return
	}

	// Convert to standard MatrixInputData and route through OnPlayerInput
	// Same KillValidator speed checks apply to agents
	stdInput := MatrixInputData{
		X:     input.X,
		Y:     input.Y,
		Angle: input.Angle,
		Boost: input.Boost,
		Tick:  input.Tick,
	}

	arena.MatrixEngine.OnPlayerInput(clientID, stdInput)
}

// BuildMatrixAgentState constructs the agent-specific state event
// for a given agent session. Called at 10Hz (every 2nd tick).
func (cam *CountryArenaManager) BuildMatrixAgentState(clientID string) *MatrixAgentStateEvent {
	cam.mu.RLock()
	countryCode, ok := cam.matrixPlayerCountry[clientID]
	if !ok {
		cam.mu.RUnlock()
		return nil
	}
	arena, exists := cam.arenas[countryCode]
	cam.mu.RUnlock()

	if !exists || arena.MatrixEngine == nil {
		return nil
	}

	engine := arena.MatrixEngine
	session := engine.GetSession(clientID)
	if session == nil {
		return nil
	}

	// Collect nearby players (within AgentNearbyRadius)
	allSessions := engine.sessions.GetAll()
	var nearbyEnemies []MatrixAgentNearbyPlayer
	var nearbyAllies []MatrixAgentNearbyPlayer

	for _, other := range allSessions {
		if other.ClientID == clientID || !other.Alive {
			continue
		}
		dx := other.X - session.X
		dy := other.Y - session.Y
		distSq := dx*dx + dy*dy
		if distSq > MatrixAgentNearbyRadius*MatrixAgentNearbyRadius {
			continue
		}

		weapons := make([]string, len(other.Weapons))
		copy(weapons, other.Weapons)
		nearby := MatrixAgentNearbyPlayer{
			ID:      other.ClientID,
			Name:    other.Name,
			X:       other.X,
			Y:       other.Y,
			HP:      other.HP,
			MaxHP:   other.MaxHP,
			Level:   other.Level,
			Nation:  other.Nationality,
			Weapons: weapons,
			Alive:   other.Alive,
		}

		if other.Nationality == session.Nationality {
			nearbyAllies = append(nearbyAllies, nearby)
		} else {
			nearbyEnemies = append(nearbyEnemies, nearby)
		}
	}

	// Build self state
	selfWeapons := make([]string, len(session.Weapons))
	copy(selfWeapons, session.Weapons)
	selfStatus := make([]string, len(session.StatusEffects))
	copy(selfStatus, session.StatusEffects)

	selfState := MatrixAgentSelfState{
		X:             session.X,
		Y:             session.Y,
		Angle:         session.Angle,
		HP:            session.HP,
		MaxHP:         session.MaxHP,
		Level:         session.Level,
		Kills:         session.Kills,
		Deaths:        session.Deaths,
		TotalDamage:   session.TotalDamage,
		Weapons:       selfWeapons,
		StatusEffects: selfStatus,
		Alive:         session.Alive,
		XPBoost:       session.Buffs.XPBoost,
		StatBoost:     session.Buffs.StatBoost,
	}

	// Get score info
	scorer := engine.GetScoreAggregator()
	personalScore, _ := scorer.GetPlayerScore(clientID)
	rank := scorer.GetPlayerRank(clientID)

	return &MatrixAgentStateEvent{
		Tick:           engine.GetCurrentTick(),
		Phase:          engine.GetCurrentPhase(),
		Timer:          engine.getPhaseTimerSeconds(),
		Self:           selfState,
		NearbyEnemies:  nearbyEnemies,
		NearbyAllies:   nearbyAllies,
		Captures:       []MatrixAgentCapture{}, // TODO: integrate CapturePointSystem
		NationScores:   scorer.GetNationScores(),
		SafeZoneRadius: engine.currentRadius,
		PersonalScore:  personalScore,
		Rank:           rank,
	}
}

// CollectMatrixAgentStates gathers agent state events for all agent sessions.
// Called at 10Hz (every 2nd tick of the 20Hz loop) by the broadcaster.
// Returns a map of clientID → MatrixAgentStateEvent.
func (cam *CountryArenaManager) CollectMatrixAgentStates(tick uint64) map[string]*MatrixAgentStateEvent {
	// Only emit at 10Hz (every 2nd tick)
	if tick%MatrixAgentStateTick != 0 {
		return nil
	}

	cam.mu.RLock()
	defer cam.mu.RUnlock()

	states := make(map[string]*MatrixAgentStateEvent)

	for clientID, countryCode := range cam.matrixPlayerCountry {
		arena, exists := cam.arenas[countryCode]
		if !exists || arena.MatrixEngine == nil {
			continue
		}

		session := arena.MatrixEngine.GetSession(clientID)
		if session == nil || !session.IsAgent {
			continue // Only emit agent state for agent sessions
		}

		state := cam.BuildMatrixAgentState(clientID)
		if state != nil {
			states[clientID] = state
		}
	}

	return states
}

// GetMatrixAgentSessions returns all agent sessions across all arenas.
// Useful for monitoring and admin endpoints.
func (cam *CountryArenaManager) GetMatrixAgentSessions() map[string]*PlayerSession {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	agents := make(map[string]*PlayerSession)
	for clientID, countryCode := range cam.matrixPlayerCountry {
		arena, exists := cam.arenas[countryCode]
		if !exists || arena.MatrixEngine == nil {
			continue
		}
		session := arena.MatrixEngine.GetSession(clientID)
		if session != nil && session.IsAgent {
			agents[clientID] = session
		}
	}
	return agents
}

// CountMatrixAgentsByOwner returns the number of deployed agents for a given owner.
// Used for enforcing the max 3 agents per owner limit.
// Since we don't track owner in sessions currently, this counts by API key prefix.
func (cam *CountryArenaManager) CountMatrixAgentsByOwner(ownerPrefix string) int {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	count := 0
	for clientID, countryCode := range cam.matrixPlayerCountry {
		arena, exists := cam.arenas[countryCode]
		if !exists || arena.MatrixEngine == nil {
			continue
		}
		session := arena.MatrixEngine.GetSession(clientID)
		if session != nil && session.IsAgent {
			// Match by client ID prefix (owner-derived)
			if len(clientID) >= len(ownerPrefix) && clientID[:len(ownerPrefix)] == ownerPrefix {
				count++
			}
		}
	}
	return count
}
