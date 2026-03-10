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
