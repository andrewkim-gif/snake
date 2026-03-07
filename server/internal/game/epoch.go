package game

import (
	"log/slog"
	"sync"
)

// EpochPhase represents the current phase within a 10-minute epoch cycle.
type EpochPhase string

const (
	EpochPhasePeace        EpochPhase = "peace"         // 0:00~5:00 — PvP OFF, orb spawn enhanced
	EpochPhaseWarCountdown EpochPhase = "war_countdown"  // 4:50~5:00 — 10s warning before war
	EpochPhaseWar          EpochPhase = "war"            // 5:00~8:00 — PvP ON, siren event
	EpochPhaseShrink       EpochPhase = "shrink"         // 8:00~10:00 — Arena shrinks 3000→1000px
	EpochPhaseEnd          EpochPhase = "end"            // 10:00 — Score tallying, 5s
	EpochPhaseTransition   EpochPhase = "transition"     // Result 5s + Prep 5s between epochs
)

// Epoch timing constants (in ticks at 20Hz)
const (
	EpochTotalDurationTicks     = 10 * 60 * TickRate  // 10 minutes = 12000 ticks
	EpochPeaceDurationTicks     = 5 * 60 * TickRate   // 5 minutes = 6000 ticks
	EpochWarCountdownTicks      = 10 * TickRate       // 10 seconds = 200 ticks
	EpochWarDurationTicks       = 3 * 60 * TickRate   // 3 minutes = 3600 ticks
	EpochShrinkDurationTicks    = 2 * 60 * TickRate   // 2 minutes = 2400 ticks
	EpochEndDurationTicks       = 5 * TickRate        // 5 seconds = 100 ticks
	EpochTransitionDurationTicks = 10 * TickRate      // 10 seconds = 200 ticks

	// War countdown starts 10s before peace ends
	EpochWarCountdownStartTick = EpochPeaceDurationTicks - EpochWarCountdownTicks

	// Shrink phase starts at 8 minutes
	EpochShrinkStartTick = EpochPeaceDurationTicks + EpochWarDurationTicks

	// Shrink parameters
	EpochShrinkStartRadius = 3000.0
	EpochShrinkEndRadius   = 1000.0

	// Orb spawn multiplier during peace phase
	EpochPeaceOrbMultiplier = 1.5
)

// EpochEvent represents an event emitted by the epoch system.
type EpochEvent struct {
	Type        EpochEventType
	CountryCode string
	Data        interface{}
}

// EpochEventType classifies epoch events.
type EpochEventType string

const (
	EpochEvtPhaseChange   EpochEventType = "epoch_phase_change"
	EpochEvtWarCountdown  EpochEventType = "epoch_war_countdown"
	EpochEvtEpochStart    EpochEventType = "epoch_start"
	EpochEvtEpochEnd      EpochEventType = "epoch_end"
	EpochEvtWarPhaseStart EpochEventType = "war_phase_start"
	EpochEvtWarPhaseEnd   EpochEventType = "war_phase_end"
	EpochEvtShrinkUpdate  EpochEventType = "epoch_shrink_update"
)

// EpochStartData is the payload for epoch_start events.
type EpochStartData struct {
	EpochNumber    int        `json:"epochNumber"`
	Phase          EpochPhase `json:"phase"`
	DurationSec    int        `json:"durationSec"`
	PeaceDuration  int        `json:"peaceDurationSec"`
	WarDuration    int        `json:"warDurationSec"`
	ShrinkDuration int        `json:"shrinkDurationSec"`
}

// EpochEndData is the payload for epoch_end events.
type EpochEndData struct {
	EpochNumber    int                `json:"epochNumber"`
	CountryCode    string             `json:"countryCode"`
	NationScores   map[string]int     `json:"nationScores"`   // nationality → score
	TopPlayers     []EpochTopPlayer   `json:"topPlayers"`
	PvPEnabled     bool               `json:"pvpEnabled"`
}

// EpochTopPlayer represents a top player in epoch results.
type EpochTopPlayer struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Nationality string `json:"nationality"`
	Score       int    `json:"score"`
	Kills       int    `json:"kills"`
}

// WarPhaseData is the payload for war_phase_start/end events.
type WarPhaseData struct {
	EpochNumber int `json:"epochNumber"`
	WarDuration int `json:"warDurationSec"` // seconds
}

// EpochManager manages the 10-minute epoch cycle for a country arena.
type EpochManager struct {
	mu sync.RWMutex

	countryCode  string
	epochNumber  int
	currentPhase EpochPhase
	phaseTick    uint64  // ticks elapsed in current epoch
	running      bool

	// PvP state
	pvpEnabled bool

	// Orb spawn multiplier
	orbMultiplier float64

	// Shrink state
	currentRadius float64

	// Score tracking per nationality
	nationScores map[string]int

	// Event buffer
	events []EpochEvent

	// Event callback
	OnEvents func(events []EpochEvent)
}

// NewEpochManager creates a new epoch manager for a country.
func NewEpochManager(countryCode string) *EpochManager {
	return &EpochManager{
		countryCode:   countryCode,
		epochNumber:   0,
		currentPhase:  EpochPhasePeace,
		phaseTick:     0,
		running:       false,
		pvpEnabled:    false,
		orbMultiplier: 1.0,
		currentRadius: EpochShrinkStartRadius,
		nationScores:  make(map[string]int),
		events:        make([]EpochEvent, 0, 8),
	}
}

// Start begins a new epoch cycle.
func (em *EpochManager) Start() {
	em.mu.Lock()
	defer em.mu.Unlock()

	em.epochNumber++
	em.currentPhase = EpochPhasePeace
	em.phaseTick = 0
	em.running = true
	em.pvpEnabled = false
	em.orbMultiplier = EpochPeaceOrbMultiplier
	em.currentRadius = EpochShrinkStartRadius
	em.nationScores = make(map[string]int)

	em.emitEvent(EpochEvent{
		Type:        EpochEvtEpochStart,
		CountryCode: em.countryCode,
		Data: EpochStartData{
			EpochNumber:    em.epochNumber,
			Phase:          EpochPhasePeace,
			DurationSec:    EpochTotalDurationTicks / TickRate,
			PeaceDuration:  EpochPeaceDurationTicks / TickRate,
			WarDuration:    EpochWarDurationTicks / TickRate,
			ShrinkDuration: EpochShrinkDurationTicks / TickRate,
		},
	})

	slog.Info("epoch started",
		"country", em.countryCode,
		"epoch", em.epochNumber,
	)
}

// Tick advances the epoch by one tick (called at 20Hz).
func (em *EpochManager) Tick(tick uint64) {
	em.mu.Lock()
	defer em.mu.Unlock()

	if !em.running {
		return
	}

	em.phaseTick++
	em.events = em.events[:0]

	switch em.currentPhase {
	case EpochPhasePeace:
		em.tickPeace()
	case EpochPhaseWarCountdown:
		em.tickWarCountdown()
	case EpochPhaseWar:
		em.tickWar()
	case EpochPhaseShrink:
		em.tickShrink()
	case EpochPhaseEnd:
		em.tickEnd()
	case EpochPhaseTransition:
		em.tickTransition()
	}

	// Flush events
	if em.OnEvents != nil && len(em.events) > 0 {
		eventsCopy := make([]EpochEvent, len(em.events))
		copy(eventsCopy, em.events)
		em.OnEvents(eventsCopy)
	}
}

func (em *EpochManager) tickPeace() {
	// Check for war countdown start (10s before peace ends)
	if em.phaseTick >= EpochWarCountdownStartTick && em.currentPhase == EpochPhasePeace {
		em.transitionTo(EpochPhaseWarCountdown)
		return
	}
}

func (em *EpochManager) tickWarCountdown() {
	// Countdown seconds remaining
	ticksLeft := EpochPeaceDurationTicks - em.phaseTick
	if ticksLeft <= 0 {
		// Transition to war
		em.transitionTo(EpochPhaseWar)
		return
	}

	// Emit countdown every second
	if ticksLeft%uint64(TickRate) == 0 {
		secondsLeft := int(ticksLeft / uint64(TickRate))
		em.emitEvent(EpochEvent{
			Type:        EpochEvtWarCountdown,
			CountryCode: em.countryCode,
			Data:        map[string]interface{}{"countdown": secondsLeft},
		})
	}
}

func (em *EpochManager) tickWar() {
	warTicks := em.phaseTick - EpochPeaceDurationTicks
	if warTicks >= EpochWarDurationTicks {
		em.transitionTo(EpochPhaseShrink)
		return
	}
}

func (em *EpochManager) tickShrink() {
	shrinkTicks := em.phaseTick - EpochShrinkStartTick
	if shrinkTicks >= EpochShrinkDurationTicks {
		em.transitionTo(EpochPhaseEnd)
		return
	}

	// Linear interpolation: 3000 → 1000 over 2 minutes
	progress := float64(shrinkTicks) / float64(EpochShrinkDurationTicks)
	em.currentRadius = EpochShrinkStartRadius - (EpochShrinkStartRadius-EpochShrinkEndRadius)*progress

	// Emit shrink update every second (1Hz)
	if shrinkTicks%uint64(TickRate) == 0 {
		em.emitEvent(EpochEvent{
			Type:        EpochEvtShrinkUpdate,
			CountryCode: em.countryCode,
			Data: map[string]interface{}{
				"currentRadius": em.currentRadius,
				"minRadius":     EpochShrinkEndRadius,
			},
		})
	}
}

func (em *EpochManager) tickEnd() {
	endTicks := em.phaseTick - EpochShrinkStartTick - EpochShrinkDurationTicks
	if endTicks >= EpochEndDurationTicks {
		em.transitionTo(EpochPhaseTransition)
		return
	}
}

func (em *EpochManager) tickTransition() {
	transitionTicks := em.phaseTick - EpochTotalDurationTicks
	if transitionTicks >= EpochTransitionDurationTicks {
		// Start new epoch
		em.epochNumber++
		em.phaseTick = 0
		em.currentPhase = EpochPhasePeace
		em.pvpEnabled = false
		em.orbMultiplier = EpochPeaceOrbMultiplier
		em.currentRadius = EpochShrinkStartRadius
		em.nationScores = make(map[string]int)

		em.emitEvent(EpochEvent{
			Type:        EpochEvtEpochStart,
			CountryCode: em.countryCode,
			Data: EpochStartData{
				EpochNumber:    em.epochNumber,
				Phase:          EpochPhasePeace,
				DurationSec:    EpochTotalDurationTicks / TickRate,
				PeaceDuration:  EpochPeaceDurationTicks / TickRate,
				WarDuration:    EpochWarDurationTicks / TickRate,
				ShrinkDuration: EpochShrinkDurationTicks / TickRate,
			},
		})

		slog.Info("epoch restarted",
			"country", em.countryCode,
			"epoch", em.epochNumber,
		)
		return
	}
}

// transitionTo handles phase transitions and emits appropriate events.
func (em *EpochManager) transitionTo(newPhase EpochPhase) {
	oldPhase := em.currentPhase
	em.currentPhase = newPhase

	switch newPhase {
	case EpochPhaseWarCountdown:
		// War is coming soon - emit warning
		em.emitEvent(EpochEvent{
			Type:        EpochEvtWarCountdown,
			CountryCode: em.countryCode,
			Data:        map[string]interface{}{"countdown": EpochWarCountdownTicks / TickRate},
		})

	case EpochPhaseWar:
		em.pvpEnabled = true
		em.orbMultiplier = 1.0 // Reset orb multiplier
		em.emitEvent(EpochEvent{
			Type:        EpochEvtWarPhaseStart,
			CountryCode: em.countryCode,
			Data: WarPhaseData{
				EpochNumber: em.epochNumber,
				WarDuration: EpochWarDurationTicks / TickRate,
			},
		})

	case EpochPhaseShrink:
		// Shrink phase - PvP remains on
		em.emitEvent(EpochEvent{
			Type:        EpochEvtPhaseChange,
			CountryCode: em.countryCode,
			Data: map[string]interface{}{
				"phase":    string(EpochPhaseShrink),
				"duration": EpochShrinkDurationTicks / TickRate,
			},
		})

	case EpochPhaseEnd:
		em.pvpEnabled = false
		em.emitEvent(EpochEvent{
			Type:        EpochEvtWarPhaseEnd,
			CountryCode: em.countryCode,
			Data: WarPhaseData{
				EpochNumber: em.epochNumber,
			},
		})
		// Emit epoch end with scores
		em.emitEvent(EpochEvent{
			Type:        EpochEvtEpochEnd,
			CountryCode: em.countryCode,
			Data: EpochEndData{
				EpochNumber:  em.epochNumber,
				CountryCode:  em.countryCode,
				NationScores: em.nationScores,
				PvPEnabled:   false,
			},
		})

	case EpochPhaseTransition:
		// 10s between epochs (5s results + 5s prep)
		em.emitEvent(EpochEvent{
			Type:        EpochEvtPhaseChange,
			CountryCode: em.countryCode,
			Data: map[string]interface{}{
				"phase":    string(EpochPhaseTransition),
				"duration": EpochTransitionDurationTicks / TickRate,
			},
		})
	}

	slog.Info("epoch phase transition",
		"country", em.countryCode,
		"epoch", em.epochNumber,
		"from", oldPhase,
		"to", newPhase,
	)
}

func (em *EpochManager) emitEvent(evt EpochEvent) {
	em.events = append(em.events, evt)
}

// --- Public getters (thread-safe) ---

// GetPhase returns the current epoch phase.
func (em *EpochManager) GetPhase() EpochPhase {
	em.mu.RLock()
	defer em.mu.RUnlock()
	return em.currentPhase
}

// GetEpochNumber returns the current epoch number.
func (em *EpochManager) GetEpochNumber() int {
	em.mu.RLock()
	defer em.mu.RUnlock()
	return em.epochNumber
}

// IsPvPEnabled returns whether PvP damage is currently active.
func (em *EpochManager) IsPvPEnabled() bool {
	em.mu.RLock()
	defer em.mu.RUnlock()
	return em.pvpEnabled
}

// GetOrbMultiplier returns the current orb spawn multiplier.
func (em *EpochManager) GetOrbMultiplier() float64 {
	em.mu.RLock()
	defer em.mu.RUnlock()
	return em.orbMultiplier
}

// GetCurrentRadius returns the current arena radius (affected by shrink).
func (em *EpochManager) GetCurrentRadius() float64 {
	em.mu.RLock()
	defer em.mu.RUnlock()
	return em.currentRadius
}

// GetTimeRemaining returns seconds remaining in the current epoch.
func (em *EpochManager) GetTimeRemaining() int {
	em.mu.RLock()
	defer em.mu.RUnlock()

	totalTicks := uint64(EpochTotalDurationTicks + EpochTransitionDurationTicks)
	if em.phaseTick >= totalTicks {
		return 0
	}
	remaining := totalTicks - em.phaseTick
	return int(remaining / uint64(TickRate))
}

// GetPhaseTimeRemaining returns seconds remaining in the current phase.
func (em *EpochManager) GetPhaseTimeRemaining() int {
	em.mu.RLock()
	defer em.mu.RUnlock()

	var phaseEndTick uint64
	switch em.currentPhase {
	case EpochPhasePeace:
		phaseEndTick = EpochWarCountdownStartTick
	case EpochPhaseWarCountdown:
		phaseEndTick = EpochPeaceDurationTicks
	case EpochPhaseWar:
		phaseEndTick = EpochShrinkStartTick
	case EpochPhaseShrink:
		phaseEndTick = EpochShrinkStartTick + EpochShrinkDurationTicks
	case EpochPhaseEnd:
		phaseEndTick = EpochTotalDurationTicks
	case EpochPhaseTransition:
		phaseEndTick = uint64(EpochTotalDurationTicks + EpochTransitionDurationTicks)
	}

	if em.phaseTick >= phaseEndTick {
		return 0
	}
	return int((phaseEndTick - em.phaseTick) / uint64(TickRate))
}

// AddNationScore adds score for a nationality (used for epoch results).
func (em *EpochManager) AddNationScore(nationality string, score int) {
	em.mu.Lock()
	defer em.mu.Unlock()
	em.nationScores[nationality] += score
}

// GetNationScores returns a snapshot of nation scores.
func (em *EpochManager) GetNationScores() map[string]int {
	em.mu.RLock()
	defer em.mu.RUnlock()

	snapshot := make(map[string]int, len(em.nationScores))
	for k, v := range em.nationScores {
		snapshot[k] = v
	}
	return snapshot
}

// IsRunning returns whether the epoch system is active.
func (em *EpochManager) IsRunning() bool {
	em.mu.RLock()
	defer em.mu.RUnlock()
	return em.running
}

// Stop stops the epoch system.
func (em *EpochManager) Stop() {
	em.mu.Lock()
	defer em.mu.Unlock()
	em.running = false
}

// Reset resets the epoch manager for a new session.
func (em *EpochManager) Reset() {
	em.mu.Lock()
	defer em.mu.Unlock()

	em.epochNumber = 0
	em.currentPhase = EpochPhasePeace
	em.phaseTick = 0
	em.running = false
	em.pvpEnabled = false
	em.orbMultiplier = 1.0
	em.currentRadius = EpochShrinkStartRadius
	em.nationScores = make(map[string]int)
}
