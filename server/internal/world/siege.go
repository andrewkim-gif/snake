package world

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// SiegeConfig holds configuration for siege battle mechanics.
type SiegeConfig struct {
	// DefenseBonus is the defender's advantage (0.30 = +30%)
	DefenseBonus float64

	// TimerSec is the total siege duration in seconds (default: 900 = 15 min)
	TimerSec int

	// Phases is the number of gate phases (default: 3)
	Phases int

	// PhaseThresholds defines the score needed to breach each gate
	// as a fraction of the total phase score pool.
	PhaseThresholds [3]float64

	// CapitalSovereigntyPenalty is the sovereignty level reduction when a capital falls
	CapitalSovereigntyPenalty int
}

// DefaultSiegeConfig returns default siege configuration.
func DefaultSiegeConfig() SiegeConfig {
	return SiegeConfig{
		DefenseBonus:              0.30,
		TimerSec:                  900,
		Phases:                    3,
		PhaseThresholds:           [3]float64{0.60, 0.65, 0.70},
		CapitalSovereigntyPenalty: 2,
	}
}

// SiegePhase represents one of three defense gates in a siege.
type SiegePhase struct {
	Number       int     `json:"number"`     // 1, 2, or 3
	Status       string  `json:"status"`     // "locked", "active", "breached", "held"
	AttackerPts  int     `json:"attacker_pts"`
	DefenderPts  int     `json:"defender_pts"`
	Threshold    float64 `json:"threshold"`  // Points fraction attacker needs
}

// SiegeBattle is the real-time siege battle state for a country arena.
// It extends the normal battle with three-phase gate mechanics
// and defender advantage.
type SiegeBattle struct {
	mu sync.RWMutex

	ID             string       `json:"id"`
	WarID          string       `json:"war_id"`
	CountryISO     string       `json:"country_iso"`
	AttackerFaction string      `json:"attacker_faction"`
	DefenderFaction string      `json:"defender_faction"`
	IsCapitalSiege bool         `json:"is_capital_siege"`

	// Battle state
	Status         string       `json:"status"` // "waiting", "active", "completed"
	CurrentPhase   int          `json:"current_phase"`
	Phases         [3]SiegePhase `json:"phases"`
	StartedAt      time.Time    `json:"started_at"`
	EndsAt         time.Time    `json:"ends_at"`
	WinnerFaction  string       `json:"winner_faction,omitempty"`

	// Config
	config SiegeConfig
}

// NewSiegeBattle creates a new siege battle for a country.
func NewSiegeBattle(id, warID, countryISO, attacker, defender string, isCapital bool, cfg SiegeConfig) *SiegeBattle {
	sb := &SiegeBattle{
		ID:              id,
		WarID:           warID,
		CountryISO:      countryISO,
		AttackerFaction: attacker,
		DefenderFaction: defender,
		IsCapitalSiege:  isCapital,
		Status:          "waiting",
		CurrentPhase:    1,
		config:          cfg,
	}

	// Initialize phases
	for i := 0; i < 3; i++ {
		sb.Phases[i] = SiegePhase{
			Number:    i + 1,
			Status:    "locked",
			Threshold: cfg.PhaseThresholds[i],
		}
	}
	// First phase is active
	sb.Phases[0].Status = "active"

	return sb
}

// Start begins the siege timer.
func (sb *SiegeBattle) Start() {
	sb.mu.Lock()
	defer sb.mu.Unlock()

	sb.Status = "active"
	sb.StartedAt = time.Now()
	sb.EndsAt = sb.StartedAt.Add(time.Duration(sb.config.TimerSec) * time.Second)

	slog.Info("siege battle started",
		"id", sb.ID,
		"country", sb.CountryISO,
		"endsAt", sb.EndsAt,
	)
}

// AddScore adds combat score for a faction during the siege.
// The defender's score is boosted by the defense bonus.
func (sb *SiegeBattle) AddScore(factionID string, rawScore int) {
	sb.mu.Lock()
	defer sb.mu.Unlock()

	if sb.Status != "active" || sb.CurrentPhase < 1 || sb.CurrentPhase > 3 {
		return
	}

	phase := &sb.Phases[sb.CurrentPhase-1]
	if phase.Status != "active" {
		return
	}

	if factionID == sb.DefenderFaction {
		// Apply defense bonus
		boosted := int(float64(rawScore) * (1.0 + sb.config.DefenseBonus))
		phase.DefenderPts += boosted
	} else if factionID == sb.AttackerFaction {
		phase.AttackerPts += rawScore
	}
}

// CheckPhaseProgress checks if the current phase has been breached or held.
// Returns true if the siege state changed.
func (sb *SiegeBattle) CheckPhaseProgress() bool {
	sb.mu.Lock()
	defer sb.mu.Unlock()

	if sb.Status != "active" || sb.CurrentPhase < 1 || sb.CurrentPhase > 3 {
		return false
	}

	phase := &sb.Phases[sb.CurrentPhase-1]
	totalPts := phase.AttackerPts + phase.DefenderPts
	if totalPts == 0 {
		return false
	}

	attackerFraction := float64(phase.AttackerPts) / float64(totalPts)

	if attackerFraction >= phase.Threshold {
		// Gate breached!
		phase.Status = "breached"

		slog.Info("siege gate breached",
			"siegeId", sb.ID,
			"phase", sb.CurrentPhase,
			"attackerPct", fmt.Sprintf("%.1f%%", attackerFraction*100),
		)

		if sb.CurrentPhase >= 3 {
			// All three gates breached — attacker wins
			sb.Status = "completed"
			sb.WinnerFaction = sb.AttackerFaction
			slog.Info("siege completed — attacker wins", "id", sb.ID)
		} else {
			// Advance to next phase
			sb.CurrentPhase++
			sb.Phases[sb.CurrentPhase-1].Status = "active"
		}
		return true
	}

	return false
}

// CheckTimeout checks if the siege timer has expired (defender wins by holding).
func (sb *SiegeBattle) CheckTimeout() bool {
	sb.mu.Lock()
	defer sb.mu.Unlock()

	if sb.Status != "active" {
		return false
	}

	if time.Now().After(sb.EndsAt) {
		// Time expired — defender successfully held
		sb.Status = "completed"
		sb.WinnerFaction = sb.DefenderFaction

		// Mark current phase as held
		if sb.CurrentPhase >= 1 && sb.CurrentPhase <= 3 {
			sb.Phases[sb.CurrentPhase-1].Status = "held"
		}

		slog.Info("siege completed — defender holds (timeout)",
			"id", sb.ID,
			"country", sb.CountryISO,
		)
		return true
	}

	return false
}

// GetState returns a snapshot of the siege state.
func (sb *SiegeBattle) GetState() SiegeBattleState {
	sb.mu.RLock()
	defer sb.mu.RUnlock()

	remaining := time.Until(sb.EndsAt)
	if remaining < 0 {
		remaining = 0
	}

	return SiegeBattleState{
		ID:              sb.ID,
		WarID:           sb.WarID,
		CountryISO:      sb.CountryISO,
		AttackerFaction: sb.AttackerFaction,
		DefenderFaction: sb.DefenderFaction,
		IsCapitalSiege:  sb.IsCapitalSiege,
		Status:          sb.Status,
		CurrentPhase:    sb.CurrentPhase,
		Phases:          sb.Phases,
		RemainingSec:    int(remaining.Seconds()),
		WinnerFaction:   sb.WinnerFaction,
		DefenseBonus:    sb.config.DefenseBonus,
	}
}

// IsCompleted returns true if the siege is finished.
func (sb *SiegeBattle) IsCompleted() bool {
	sb.mu.RLock()
	defer sb.mu.RUnlock()
	return sb.Status == "completed"
}

// SiegeBattleState is a serializable snapshot of a siege for clients.
type SiegeBattleState struct {
	ID              string       `json:"id"`
	WarID           string       `json:"war_id"`
	CountryISO      string       `json:"country_iso"`
	AttackerFaction string       `json:"attacker_faction"`
	DefenderFaction string       `json:"defender_faction"`
	IsCapitalSiege  bool         `json:"is_capital_siege"`
	Status          string       `json:"status"`
	CurrentPhase    int          `json:"current_phase"`
	Phases          [3]SiegePhase `json:"phases"`
	RemainingSec    int          `json:"remaining_sec"`
	WinnerFaction   string       `json:"winner_faction,omitempty"`
	DefenseBonus    float64      `json:"defense_bonus"`
}

// --- Siege Manager (per-WorldManager) ---

// SiegeManager tracks active siege battles across all countries.
type SiegeManager struct {
	mu     sync.RWMutex
	sieges map[string]*SiegeBattle // countryISO → active siege
	config SiegeConfig
}

// NewSiegeManager creates a new SiegeManager.
func NewSiegeManager(cfg SiegeConfig) *SiegeManager {
	return &SiegeManager{
		sieges: make(map[string]*SiegeBattle),
		config: cfg,
	}
}

// GetActiveSiege returns the active siege for a country, if any.
func (sm *SiegeManager) GetActiveSiege(countryISO string) *SiegeBattle {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.sieges[countryISO]
}

// StartSiege creates and starts a siege battle on a country.
func (sm *SiegeManager) StartSiege(id, warID, countryISO, attacker, defender string, isCapital bool) (*SiegeBattle, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if _, exists := sm.sieges[countryISO]; exists {
		return nil, fmt.Errorf("siege already active in %s", countryISO)
	}

	siege := NewSiegeBattle(id, warID, countryISO, attacker, defender, isCapital, sm.config)
	siege.Start()
	sm.sieges[countryISO] = siege

	return siege, nil
}

// RemoveSiege removes a completed siege.
func (sm *SiegeManager) RemoveSiege(countryISO string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sieges, countryISO)
}

// TickAll checks timeout for all active sieges.
func (sm *SiegeManager) TickAll() {
	sm.mu.RLock()
	var isos []string
	for iso := range sm.sieges {
		isos = append(isos, iso)
	}
	sm.mu.RUnlock()

	for _, iso := range isos {
		sm.mu.RLock()
		siege, ok := sm.sieges[iso]
		sm.mu.RUnlock()

		if !ok {
			continue
		}

		siege.CheckTimeout()
		siege.CheckPhaseProgress()

		if siege.IsCompleted() {
			sm.RemoveSiege(iso)
		}
	}
}

// GetAllActiveStates returns snapshots of all active sieges.
func (sm *SiegeManager) GetAllActiveStates() []SiegeBattleState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	states := make([]SiegeBattleState, 0, len(sm.sieges))
	for _, siege := range sm.sieges {
		states = append(states, siege.GetState())
	}
	return states
}
