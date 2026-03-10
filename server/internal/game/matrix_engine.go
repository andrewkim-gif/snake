package game

import (
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v33 Phase 1 — OnlineMatrixEngine: Server-side orchestrator
// for Online Matrix arena play. Wires together:
//   - PlayerSessionManager (per-player state)
//   - MonsterSeedSync (deterministic PvE spawning)
//   - KillValidator (anti-cheat validation)
//   - ScoreAggregator (independent epoch scoring)
//   - EpochRewardCalculator (token reward computation)
//   - TokenBuffApplier (balance → in-game buffs)
//
// Called by CountryArenaWrapper at 20Hz via the existing
// EpochManager tick loop. Integrates with existing domination,
// sovereignty, and token reward systems without modifying them.
// ============================================================

// MatrixEngineConfig holds configuration for the Online Matrix engine.
type MatrixEngineConfig struct {
	CountryCode    string
	MaxPlayers     int
	TickRate       int
}

// DefaultMatrixEngineConfig returns the default configuration.
func DefaultMatrixEngineConfig() MatrixEngineConfig {
	return MatrixEngineConfig{
		MaxPlayers: 50,
		TickRate:   TickRate,
	}
}

// MatrixJoinInfo holds the information needed to join a Matrix arena.
type MatrixJoinInfo struct {
	ClientID     string  `json:"clientId"`
	Name         string  `json:"name"`
	Nationality  string  `json:"nationality"`
	IsAgent      bool    `json:"isAgent"`
	IsDirectPlay bool    `json:"isDirectPlay"`
	TokenBalance float64 `json:"tokenBalance"`
	Build        string  `json:"build,omitempty"` // optional build preset
}

// MatrixInputData holds client input data (10Hz uplink).
type MatrixInputData struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Angle float64 `json:"angle"`
	Boost bool    `json:"boost"`
	Tick  uint64  `json:"tick"`
}

// MatrixWorldState holds the full world state for 20Hz downlink.
type MatrixWorldState struct {
	Tick           uint64              `json:"tick"`
	Phase          EpochPhase          `json:"phase"`
	Timer          int                 `json:"timer"`
	Players        []MatrixPlayerState `json:"players"`
	NationScores   map[string]int      `json:"nationScores"`
	SafeZoneRadius float64             `json:"safeZoneRadius"`
	FullSnapshot   bool                `json:"fullSnapshot"`
}

// MatrixEpochChangeEvent holds data sent to clients on phase change.
type MatrixEpochChangeEvent struct {
	Phase    EpochPhase `json:"phase"`
	Countdown int       `json:"countdown"`
	Config   struct {
		PvPEnabled    bool    `json:"pvpEnabled"`
		OrbMultiplier float64 `json:"orbMultiplier"`
		ShrinkRadius  float64 `json:"shrinkRadius,omitempty"`
	} `json:"config"`
}

// MatrixResultEvent holds the epoch result for all clients.
type MatrixResultEvent struct {
	Rankings []NationRanking      `json:"rankings"`
	Rewards  []MatrixPlayerReward `json:"rewards"`
	MVP      *MatrixPlayerReward  `json:"mvp"`
}

// OnlineMatrixEngine is the server-side orchestrator for Matrix online play.
type OnlineMatrixEngine struct {
	mu sync.RWMutex

	// Identity
	countryCode string
	config      MatrixEngineConfig

	// Sub-systems
	sessions    *PlayerSessionManager
	seedSync    *MonsterSeedSync
	validator   *KillValidator
	scorer      *ScoreAggregator
	rewarder    *EpochRewardCalculator
	buffApplier *TokenBuffApplier

	// State
	currentTick uint64
	pvpEnabled  bool
	running     bool

	// Current epoch phase (synced from EpochManager)
	currentPhase EpochPhase

	// Current safe zone radius (synced from EpochManager)
	currentRadius float64

	// Full snapshot interval (every 5 seconds = 100 ticks)
	lastFullSnapshot uint64

	// Event buffers (consumed by broadcaster each tick)
	pendingKillConfirms  []KillConfirmEvent
	pendingKillRejects   []KillRejectEvent
	pendingPhaseChanges  []MatrixEpochChangeEvent
	pendingSeedEvents    []SpawnSeedEvent
	pendingResults       []MatrixResultEvent
	pendingBuffUpdates   map[string]TokenBuffs // clientID → buffs

	// Callbacks for external integration
	OnResult func(result *MatrixResultEvent)
	OnBan    func(clientID, reason string)
}

// KillConfirmEvent is a confirmed kill notification.
type KillConfirmEvent struct {
	KillerID   string `json:"killerId"`
	TargetID   string `json:"targetId"`
	Score      int    `json:"score"`
	TotalKills int    `json:"totalKills"`
}

// KillRejectEvent is a rejected kill notification.
type KillRejectEvent struct {
	ClientID string           `json:"clientId"`
	Reason   KillRejectReason `json:"reason"`
}

// NewOnlineMatrixEngine creates a new Online Matrix engine for a country arena.
func NewOnlineMatrixEngine(countryCode string) *OnlineMatrixEngine {
	config := DefaultMatrixEngineConfig()
	config.CountryCode = countryCode

	return &OnlineMatrixEngine{
		countryCode:        countryCode,
		config:             config,
		sessions:           NewPlayerSessionManager(),
		seedSync:           NewMonsterSeedSync(countryCode),
		validator:          NewKillValidator(),
		scorer:             NewScoreAggregator(countryCode),
		rewarder:           NewEpochRewardCalculator(countryCode),
		buffApplier:        NewTokenBuffApplier(),
		currentPhase:       EpochPhasePeace,
		currentRadius:      EpochShrinkStartRadius,
		pendingBuffUpdates: make(map[string]TokenBuffs),
	}
}

// --- Player Lifecycle ---

// OnPlayerJoin handles a new player joining the Matrix arena.
func (e *OnlineMatrixEngine) OnPlayerJoin(info MatrixJoinInfo) (*PlayerSession, *TokenBuffs) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.sessions.Count() >= e.config.MaxPlayers {
		slog.Warn("matrix arena full, rejecting join",
			"country", e.countryCode,
			"clientId", info.ClientID,
			"current", e.sessions.Count(),
			"max", e.config.MaxPlayers,
		)
		return nil, nil
	}

	// Check if banned
	if e.validator.IsBanned(info.ClientID) {
		slog.Warn("banned player attempted to join",
			"country", e.countryCode,
			"clientId", info.ClientID,
		)
		return nil, nil
	}

	// Create session
	session := e.sessions.Add(info.ClientID, info.Name, info.Nationality, info.IsAgent, info.IsDirectPlay)
	session.TokenBalance = info.TokenBalance

	// Compute and apply token buffs
	buffs := e.buffApplier.GetBuffs(info.TokenBalance)
	session.ApplyBuffs(buffs)

	// Queue buff update for client
	e.pendingBuffUpdates[info.ClientID] = buffs

	slog.Info("player joined matrix arena",
		"country", e.countryCode,
		"clientId", info.ClientID,
		"name", info.Name,
		"nation", info.Nationality,
		"tokenBalance", info.TokenBalance,
		"buffTier", buffs.Tier,
	)

	return session, &buffs
}

// OnPlayerLeave handles a player leaving the Matrix arena.
// Preserves their score for the current epoch before removal.
func (e *OnlineMatrixEngine) OnPlayerLeave(clientID string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	session := e.sessions.Get(clientID)
	if session == nil {
		return
	}

	// Score is already tracked in ScoreAggregator — no data loss on leave
	e.sessions.Remove(clientID)
	e.validator.ClearPlayer(clientID)
	delete(e.pendingBuffUpdates, clientID)

	slog.Info("player left matrix arena",
		"country", e.countryCode,
		"clientId", clientID,
		"kills", session.Kills,
		"level", session.Level,
	)
}

// --- Input Processing ---

// OnPlayerInput processes a client's position/input update (10Hz).
func (e *OnlineMatrixEngine) OnPlayerInput(clientID string, input MatrixInputData) {
	e.mu.Lock()
	defer e.mu.Unlock()

	session := e.sessions.Get(clientID)
	if session == nil || !session.Alive {
		return
	}

	// Speed validation
	if session.LastTick > 0 {
		tickDelta := input.Tick - session.LastTick
		if tickDelta > 0 {
			valid, _ := e.validator.CheckSpeed(session, input.X, input.Y, tickDelta)
			if !valid {
				// Don't reject the input — just flag suspicion (position correction is client-side)
				return
			}
		}
	}

	session.UpdatePosition(input.X, input.Y, input.Angle, input.Tick)
}

// --- Kill/Damage Processing ---

// OnKillReport processes a client's kill report.
// Returns the validation result.
func (e *OnlineMatrixEngine) OnKillReport(report KillReport) KillValidationResult {
	e.mu.Lock()
	defer e.mu.Unlock()

	killer := e.sessions.Get(report.KillerID)
	target := e.sessions.Get(report.TargetID)

	result := e.validator.ValidateKill(report, e.currentTick, killer, target, e.pvpEnabled, nil)

	if result.Valid {
		// Record kill in session
		killer.RecordKill()
		target.RecordDeath()
		killer.RecordDamage(report.Damage)

		// Record in score aggregator
		e.scorer.AddKill(killer.ClientID, killer.Name, killer.Nationality, killer.IsAgent, killer.IsDirectPlay)

		// Queue confirmation
		e.pendingKillConfirms = append(e.pendingKillConfirms, KillConfirmEvent{
			KillerID:   report.KillerID,
			TargetID:   report.TargetID,
			Score:      MatrixScorePerKill,
			TotalKills: killer.Kills,
		})

		slog.Debug("matrix kill confirmed",
			"killer", report.KillerID,
			"target", report.TargetID,
			"weapon", report.WeaponID,
		)
	} else {
		// Queue rejection
		e.pendingKillRejects = append(e.pendingKillRejects, KillRejectEvent{
			ClientID: report.KillerID,
			Reason:   result.Reason,
		})

		// Check if we should ban
		if result.ShouldBan && e.OnBan != nil {
			e.OnBan(report.KillerID, string(result.Reason))
		}
	}

	return result
}

// OnDamageReport processes a client's PvP damage report.
func (e *OnlineMatrixEngine) OnDamageReport(report DamageReport) KillValidationResult {
	e.mu.Lock()
	defer e.mu.Unlock()

	attacker := e.sessions.Get(report.AttackerID)
	target := e.sessions.Get(report.TargetID)

	result := e.validator.ValidateDamage(report, e.currentTick, attacker, target, e.pvpEnabled)

	if result.Valid && attacker != nil {
		attacker.RecordDamage(report.Damage)
		e.scorer.AddDamage(attacker.ClientID, attacker.Name, attacker.Nationality, report.Damage, attacker.IsAgent, attacker.IsDirectPlay)
	}

	return result
}

// --- Level Up ---

// OnLevelUp records a player's level-up.
func (e *OnlineMatrixEngine) OnLevelUp(clientID string, newLevel int) {
	e.mu.Lock()
	defer e.mu.Unlock()

	session := e.sessions.Get(clientID)
	if session == nil {
		return
	}

	session.Level = newLevel
	e.scorer.AddLevel(clientID, session.Name, session.Nationality, newLevel, session.IsAgent, session.IsDirectPlay)
}

// --- Epoch Lifecycle ---

// OnEpochPhaseChange is called when the epoch phase changes.
// Updates pvpEnabled and triggers seed regeneration as needed.
func (e *OnlineMatrixEngine) OnEpochPhaseChange(phase EpochPhase, epochNumber int, radius float64) {
	e.mu.Lock()
	defer e.mu.Unlock()

	prevPhase := e.currentPhase
	e.currentPhase = phase
	e.currentRadius = radius

	switch phase {
	case EpochPhasePeace:
		e.pvpEnabled = false
		// Generate initial seed for new epoch
		event := e.seedSync.OnEpochStart(epochNumber, e.currentTick)
		e.pendingSeedEvents = append(e.pendingSeedEvents, event)

	case EpochPhaseWarCountdown:
		e.pvpEnabled = false // PvP not yet enabled during countdown

	case EpochPhaseWar:
		e.pvpEnabled = true

	case EpochPhaseShrink:
		e.pvpEnabled = true // PvP continues during shrink

	case EpochPhaseEnd:
		e.pvpEnabled = false

	case EpochPhaseTransition:
		e.pvpEnabled = false
	}

	// Queue phase change event for clients
	changeEvent := MatrixEpochChangeEvent{
		Phase: phase,
	}
	changeEvent.Config.PvPEnabled = e.pvpEnabled
	changeEvent.Config.OrbMultiplier = 1.0
	if phase == EpochPhasePeace {
		changeEvent.Config.OrbMultiplier = EpochPeaceOrbMultiplier
	}
	if phase == EpochPhaseShrink {
		changeEvent.Config.ShrinkRadius = radius
	}

	e.pendingPhaseChanges = append(e.pendingPhaseChanges, changeEvent)

	slog.Info("matrix epoch phase changed",
		"country", e.countryCode,
		"from", prevPhase,
		"to", phase,
		"pvpEnabled", e.pvpEnabled,
	)
}

// OnEpochEnd is called at the end of an epoch.
// Takes score snapshot, calculates rewards, resets for next epoch.
func (e *OnlineMatrixEngine) OnEpochEnd(epochNumber int, dominantNation string, isSovereignty, isHegemony bool) *MatrixResultEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	// 1. Mark alive players as survived
	allSessions := e.sessions.GetAll()
	for _, s := range allSessions {
		if s.Alive {
			e.scorer.AddSurvival(s.ClientID, s.Name, s.Nationality, s.IsAgent, s.IsDirectPlay)
		}
	}

	// 2. Snapshot scores
	snapshot := e.scorer.SnapshotAndReset(epochNumber)

	// 3. Calculate rewards
	rewardInput := &MatrixRewardInput{
		Snapshot:           snapshot,
		CountryCode:        e.countryCode,
		EpochNumber:        epochNumber,
		DominantNation:     dominantNation,
		IsSovereignty:      isSovereignty,
		IsHegemony:         isHegemony,
		NationPlayerCounts: e.sessions.GetNationPlayerCounts(),
	}
	rewardResult := e.rewarder.Calculate(rewardInput)

	// 4. Build result event
	resultEvent := &MatrixResultEvent{
		Rankings: e.scorer.GetNationRankings(),
		Rewards:  rewardResult.Rewards,
		MVP:      rewardResult.MVP,
	}

	// Use rankings from snapshot since scorer was reset
	if snapshot != nil {
		rankings := make([]NationRanking, 0, len(snapshot.NationScores))
		rank := 1
		for nat, score := range snapshot.NationScores {
			rankings = append(rankings, NationRanking{
				Nationality: nat,
				Score:       score,
				Rank:        rank,
			})
			rank++
		}
		resultEvent.Rankings = rankings
	}

	e.pendingResults = append(e.pendingResults, *resultEvent)

	// 5. Reset sessions for next epoch
	e.sessions.ResetAll()

	// 6. Callback
	if e.OnResult != nil {
		e.OnResult(resultEvent)
	}

	slog.Info("matrix epoch ended",
		"country", e.countryCode,
		"epoch", epochNumber,
		"players", len(allSessions),
		"rewards", len(rewardResult.Rewards),
		"totalTokens", rewardResult.TotalPaid,
	)

	return resultEvent
}

// --- Tick ---

// Tick advances the engine by one tick (called at 20Hz by EpochManager).
func (e *OnlineMatrixEngine) Tick(tick uint64) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.currentTick = tick

	// Check if seed needs resyncing (every 30 seconds)
	if e.seedSync.ShouldReseed(tick) {
		event := e.seedSync.NextWave(tick)
		e.pendingSeedEvents = append(e.pendingSeedEvents, event)
	}
}

// --- State Retrieval ---

// GetWorldState returns the full world state for 20Hz downlink.
func (e *OnlineMatrixEngine) GetWorldState() *MatrixWorldState {
	e.mu.RLock()
	defer e.mu.RUnlock()

	isFullSnapshot := e.currentTick-e.lastFullSnapshot >= 100 // 5s at 20Hz
	if isFullSnapshot {
		// Advance through lock upgrade
	}

	state := &MatrixWorldState{
		Tick:           e.currentTick,
		Phase:          e.currentPhase,
		Timer:          e.getPhaseTimerSeconds(),
		Players:        e.sessions.GetAllStates(),
		NationScores:   e.scorer.GetNationScores(),
		SafeZoneRadius: e.currentRadius,
		FullSnapshot:   isFullSnapshot,
	}

	return state
}

// MarkFullSnapshotSent records that a full snapshot was sent.
func (e *OnlineMatrixEngine) MarkFullSnapshotSent() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.lastFullSnapshot = e.currentTick
}

// getPhaseTimerSeconds returns the remaining time in the current phase.
func (e *OnlineMatrixEngine) getPhaseTimerSeconds() int {
	// Approximate based on tick count within phase
	// The exact timer is managed by EpochManager — this is a best-effort estimate
	switch e.currentPhase {
	case EpochPhasePeace:
		return int(EpochPeaceDurationTicks-e.currentTick%EpochTotalDurationTicks) / TickRate
	case EpochPhaseWar:
		return int(EpochWarDurationTicks) / TickRate
	case EpochPhaseShrink:
		return int(EpochShrinkDurationTicks) / TickRate
	default:
		return 0
	}
}

// --- Event Consumption (for broadcaster) ---

// ConsumePendingKillConfirms returns and clears pending kill confirmations.
func (e *OnlineMatrixEngine) ConsumePendingKillConfirms() []KillConfirmEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	events := e.pendingKillConfirms
	e.pendingKillConfirms = nil
	return events
}

// ConsumePendingKillRejects returns and clears pending kill rejections.
func (e *OnlineMatrixEngine) ConsumePendingKillRejects() []KillRejectEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	events := e.pendingKillRejects
	e.pendingKillRejects = nil
	return events
}

// ConsumePendingPhaseChanges returns and clears pending phase change events.
func (e *OnlineMatrixEngine) ConsumePendingPhaseChanges() []MatrixEpochChangeEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	events := e.pendingPhaseChanges
	e.pendingPhaseChanges = nil
	return events
}

// ConsumePendingSeedEvents returns and clears pending seed events.
func (e *OnlineMatrixEngine) ConsumePendingSeedEvents() []SpawnSeedEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	events := e.pendingSeedEvents
	e.pendingSeedEvents = nil
	return events
}

// ConsumePendingResults returns and clears pending epoch result events.
func (e *OnlineMatrixEngine) ConsumePendingResults() []MatrixResultEvent {
	e.mu.Lock()
	defer e.mu.Unlock()

	events := e.pendingResults
	e.pendingResults = nil
	return events
}

// ConsumePendingBuffUpdates returns and clears pending buff updates.
func (e *OnlineMatrixEngine) ConsumePendingBuffUpdates() map[string]TokenBuffs {
	e.mu.Lock()
	defer e.mu.Unlock()

	updates := e.pendingBuffUpdates
	e.pendingBuffUpdates = make(map[string]TokenBuffs)
	return updates
}

// --- Getters ---

// GetSession returns a player session by ID.
func (e *OnlineMatrixEngine) GetSession(clientID string) *PlayerSession {
	return e.sessions.Get(clientID)
}

// GetPlayerCount returns the number of active players.
func (e *OnlineMatrixEngine) GetPlayerCount() int {
	return e.sessions.Count()
}

// GetCurrentTick returns the current server tick.
func (e *OnlineMatrixEngine) GetCurrentTick() uint64 {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.currentTick
}

// IsPvPEnabled returns whether PvP is currently enabled.
func (e *OnlineMatrixEngine) IsPvPEnabled() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.pvpEnabled
}

// GetCurrentPhase returns the current epoch phase.
func (e *OnlineMatrixEngine) GetCurrentPhase() EpochPhase {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.currentPhase
}

// IsRunning returns whether the engine is actively running.
func (e *OnlineMatrixEngine) IsRunning() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.running
}

// Start begins the engine.
func (e *OnlineMatrixEngine) Start() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.running = true

	slog.Info("matrix engine started",
		"country", e.countryCode,
	)
}

// Stop halts the engine.
func (e *OnlineMatrixEngine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.running = false

	slog.Info("matrix engine stopped",
		"country", e.countryCode,
	)
}

// Reset clears all engine state for a full restart.
func (e *OnlineMatrixEngine) Reset() {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.currentTick = 0
	e.pvpEnabled = false
	e.currentPhase = EpochPhasePeace
	e.currentRadius = EpochShrinkStartRadius
	e.lastFullSnapshot = 0
	e.running = false

	e.seedSync.Reset()
	e.validator.Reset()
	e.scorer.Reset()
	e.rewarder.Reset()

	e.pendingKillConfirms = nil
	e.pendingKillRejects = nil
	e.pendingPhaseChanges = nil
	e.pendingSeedEvents = nil
	e.pendingResults = nil
	e.pendingBuffUpdates = make(map[string]TokenBuffs)

	slog.Info("matrix engine reset",
		"country", e.countryCode,
	)
}

// GetStartTime returns the engine start time (approximated from first tick).
func (e *OnlineMatrixEngine) GetStartTime() time.Time {
	e.mu.RLock()
	defer e.mu.RUnlock()
	// Approximate from tick count
	elapsed := time.Duration(e.currentTick) * time.Duration(TickInterval) * time.Millisecond
	return time.Now().Add(-elapsed)
}

// GetScoreAggregator returns the score aggregator (for external queries).
func (e *OnlineMatrixEngine) GetScoreAggregator() *ScoreAggregator {
	return e.scorer
}

// GetSeedSync returns the seed sync (for external queries).
func (e *OnlineMatrixEngine) GetSeedSync() *MonsterSeedSync {
	return e.seedSync
}

// GetValidator returns the kill validator (for external queries).
func (e *OnlineMatrixEngine) GetValidator() *KillValidator {
	return e.validator
}

// GetBuffApplier returns the buff applier (for external queries).
func (e *OnlineMatrixEngine) GetBuffApplier() *TokenBuffApplier {
	return e.buffApplier
}
