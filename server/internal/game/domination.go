package game

import (
	"log/slog"
	"sort"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 5 — S24: Domination Engine (1-Hour Evaluation)
// Every 6 epochs (1 hour), evaluate nation domination.
// DominationScore = sum of epoch1~6 NationScore.
// Determines dominant nation, handles transitions, defender bonus.
// ============================================================

// Domination constants
const (
	// EpochsPerDominationCycle is the number of epochs before a domination evaluation.
	EpochsPerDominationCycle = 6

	// MinDominationThreshold is the minimum score to be considered for domination.
	MinDominationThreshold = 100

	// DefenderBonusRatio is the bonus multiplier for the current dominant nation (+10%).
	DefenderBonusRatio = 0.10

	// TransitionDefenseBonusRatio is the extra defense bonus after a domination change (+20%).
	TransitionDefenseBonusRatio = 0.20

	// TransitionDefenseDurationMin is how long the transition defense bonus lasts (minutes).
	TransitionDefenseDurationMin = 15
)

// DominationStatus represents the domination state of a country.
type DominationStatus string

const (
	DominationNone        DominationStatus = "none"        // no dominant nation
	DominationActive      DominationStatus = "active"      // nation currently dominates
	DominationSovereignty DominationStatus = "sovereignty"  // 24h continuous domination
	DominationHegemony    DominationStatus = "hegemony"     // 7-day continuous sovereignty
)

// DominationRecord holds the result of a single domination evaluation.
type DominationRecord struct {
	EvaluationTime  time.Time        `json:"evaluationTime"`
	CycleNumber     int              `json:"cycleNumber"`
	DominantNation  string           `json:"dominantNation"`
	DominationScore int              `json:"dominationScore"`
	AllScores       map[string]int   `json:"allScores"`
	WasDefended     bool             `json:"wasDefended"`     // defender kept domination
	WasTransition   bool             `json:"wasTransition"`   // domination changed hands
	PreviousDominant string          `json:"previousDominant"`
}

// DominationEvent is emitted when domination state changes.
type DominationEvent struct {
	Type            DominationEventType `json:"type"`
	CountryCode     string              `json:"countryCode"`
	DominantNation  string              `json:"dominantNation"`
	PreviousNation  string              `json:"previousNation,omitempty"`
	Score           int                 `json:"score"`
	CycleNumber     int                 `json:"cycleNumber"`
	Timestamp       time.Time           `json:"timestamp"`
}

// DominationEventType classifies domination events.
type DominationEventType string

const (
	DomEvtEvaluated    DominationEventType = "domination_evaluated"
	DomEvtNewDominant  DominationEventType = "domination_new_dominant"
	DomEvtDefended     DominationEventType = "domination_defended"
	DomEvtLost         DominationEventType = "domination_lost"
	DomEvtReset        DominationEventType = "domination_reset"
	DomEvtNoDominant   DominationEventType = "domination_no_dominant"
)

// DominationEngine evaluates nation domination every 6 epochs (1 hour).
type DominationEngine struct {
	mu sync.RWMutex

	countryCode string

	// Current dominant nation (empty if none)
	dominantNation string

	// Current domination status
	status DominationStatus

	// Domination start time (when current nation first became dominant)
	dominationStartTime time.Time

	// Transition defense bonus: extra +20% defense for 15 min after change
	transitionBonusEnd time.Time

	// Evaluation history (last few cycles)
	history []DominationRecord

	// Cycle counter
	cycleNumber int

	// Epoch counter within current cycle
	epochsInCycle int

	// Event callback
	OnEvent func(event DominationEvent)
}

// NewDominationEngine creates a new domination engine for a country arena.
func NewDominationEngine(countryCode string) *DominationEngine {
	return &DominationEngine{
		countryCode:    countryCode,
		dominantNation: "",
		status:         DominationNone,
		history:        make([]DominationRecord, 0, 24), // ~24 hours of history
		cycleNumber:    0,
		epochsInCycle:  0,
	}
}

// OnEpochEnd is called after each epoch to check if a domination evaluation is needed.
// Returns true if a domination evaluation was triggered.
func (de *DominationEngine) OnEpochEnd(tracker *NationScoreTracker, epochNumber int) bool {
	de.mu.Lock()
	defer de.mu.Unlock()

	de.epochsInCycle++

	if de.epochsInCycle >= EpochsPerDominationCycle {
		de.evaluate(tracker, epochNumber)
		de.epochsInCycle = 0
		return true
	}
	return false
}

// evaluate performs the domination evaluation after 6 epochs.
func (de *DominationEngine) evaluate(tracker *NationScoreTracker, epochNumber int) {
	de.cycleNumber++
	now := time.Now()

	// Get domination scores (sum of 6-epoch history)
	rawScores := tracker.GetDominationScores()

	// Apply defender bonus (+10%) to current dominant nation
	scores := make(map[string]int, len(rawScores))
	for nat, score := range rawScores {
		if nat == de.dominantNation && de.dominantNation != "" {
			scores[nat] = int(float64(score) * (1.0 + DefenderBonusRatio))
		} else {
			scores[nat] = score
		}
	}

	// Sort nations by score (descending) with tiebreakers
	type nationEntry struct {
		Nationality string
		Score       int
		TotalKills  int
		TotalLevel  int
	}

	entries := make([]nationEntry, 0, len(scores))
	for nat, score := range scores {
		// Get kill/level totals from tracker history for tiebreaking
		history := tracker.GetNationHistory(nat)
		totalKills := 0
		totalLevel := 0
		for _, rec := range history {
			totalKills += rec.TotalKills
			totalLevel += rec.TotalLevel
		}
		entries = append(entries, nationEntry{
			Nationality: nat,
			Score:       score,
			TotalKills:  totalKills,
			TotalLevel:  totalLevel,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Score != entries[j].Score {
			return entries[i].Score > entries[j].Score
		}
		if entries[i].TotalKills != entries[j].TotalKills {
			return entries[i].TotalKills > entries[j].TotalKills
		}
		return entries[i].TotalLevel > entries[j].TotalLevel
	})

	// Determine winner
	previousDominant := de.dominantNation
	var winner string
	var winnerScore int

	if len(entries) > 0 && entries[0].Score >= MinDominationThreshold {
		winner = entries[0].Nationality
		winnerScore = entries[0].Score
	}

	// Build record
	record := DominationRecord{
		EvaluationTime:   now,
		CycleNumber:      de.cycleNumber,
		DominantNation:   winner,
		DominationScore:  winnerScore,
		AllScores:        scores,
		PreviousDominant: previousDominant,
	}

	// Handle transitions
	if winner == "" {
		// No nation meets threshold
		de.dominantNation = ""
		de.status = DominationNone
		de.dominationStartTime = time.Time{}
		record.WasTransition = previousDominant != ""

		de.emitEvent(DominationEvent{
			Type:           DomEvtNoDominant,
			CountryCode:    de.countryCode,
			PreviousNation: previousDominant,
			CycleNumber:    de.cycleNumber,
			Timestamp:      now,
		})

		slog.Info("domination evaluation: no dominant nation",
			"country", de.countryCode,
			"cycle", de.cycleNumber,
		)
	} else if winner == previousDominant {
		// Defender maintained domination
		record.WasDefended = true

		de.emitEvent(DominationEvent{
			Type:           DomEvtDefended,
			CountryCode:    de.countryCode,
			DominantNation: winner,
			Score:          winnerScore,
			CycleNumber:    de.cycleNumber,
			Timestamp:      now,
		})

		slog.Info("domination defended",
			"country", de.countryCode,
			"dominant", winner,
			"score", winnerScore,
			"cycle", de.cycleNumber,
		)
	} else {
		// New dominant nation!
		record.WasTransition = true
		de.dominantNation = winner
		de.status = DominationActive
		de.dominationStartTime = now
		de.transitionBonusEnd = now.Add(time.Duration(TransitionDefenseDurationMin) * time.Minute)

		de.emitEvent(DominationEvent{
			Type:           DomEvtNewDominant,
			CountryCode:    de.countryCode,
			DominantNation: winner,
			PreviousNation: previousDominant,
			Score:          winnerScore,
			CycleNumber:    de.cycleNumber,
			Timestamp:      now,
		})

		if previousDominant != "" {
			de.emitEvent(DominationEvent{
				Type:           DomEvtLost,
				CountryCode:    de.countryCode,
				DominantNation: winner,
				PreviousNation: previousDominant,
				Score:          winnerScore,
				CycleNumber:    de.cycleNumber,
				Timestamp:      now,
			})
		}

		slog.Info("domination transition",
			"country", de.countryCode,
			"new_dominant", winner,
			"previous", previousDominant,
			"score", winnerScore,
			"cycle", de.cycleNumber,
		)
	}

	// Emit general evaluation event
	de.emitEvent(DominationEvent{
		Type:           DomEvtEvaluated,
		CountryCode:    de.countryCode,
		DominantNation: winner,
		Score:          winnerScore,
		CycleNumber:    de.cycleNumber,
		Timestamp:      now,
	})

	// Store in history (cap at 24 records)
	if len(de.history) >= 24 {
		de.history = de.history[1:]
	}
	de.history = append(de.history, record)

	// Reset the nation score tracker for the next cycle
	tracker.Reset()
}

func (de *DominationEngine) emitEvent(event DominationEvent) {
	if de.OnEvent != nil {
		de.OnEvent(event)
	}
}

// --- Public Getters (thread-safe) ---

// GetDominantNation returns the current dominant nationality (empty if none).
func (de *DominationEngine) GetDominantNation() string {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.dominantNation
}

// GetStatus returns the current domination status.
func (de *DominationEngine) GetStatus() DominationStatus {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.status
}

// SetStatus updates the domination status (called by SovereigntyTracker).
func (de *DominationEngine) SetStatus(status DominationStatus) {
	de.mu.Lock()
	defer de.mu.Unlock()
	de.status = status
}

// GetDominationStartTime returns when the current dominant nation started dominating.
func (de *DominationEngine) GetDominationStartTime() time.Time {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.dominationStartTime
}

// GetDominationDuration returns how long the current nation has been dominant.
func (de *DominationEngine) GetDominationDuration() time.Duration {
	de.mu.RLock()
	defer de.mu.RUnlock()

	if de.dominantNation == "" {
		return 0
	}
	return time.Since(de.dominationStartTime)
}

// HasTransitionBonus returns true if the domination transition bonus is still active.
func (de *DominationEngine) HasTransitionBonus() bool {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return time.Now().Before(de.transitionBonusEnd)
}

// GetTransitionBonusRatio returns the active defense bonus ratio (0.0 or TransitionDefenseBonusRatio).
func (de *DominationEngine) GetTransitionBonusRatio() float64 {
	if de.HasTransitionBonus() {
		return TransitionDefenseBonusRatio
	}
	return 0.0
}

// GetCycleNumber returns the current domination cycle number.
func (de *DominationEngine) GetCycleNumber() int {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.cycleNumber
}

// GetEpochsInCycle returns how many epochs have passed in the current cycle (0~5).
func (de *DominationEngine) GetEpochsInCycle() int {
	de.mu.RLock()
	defer de.mu.RUnlock()
	return de.epochsInCycle
}

// GetHistory returns the domination evaluation history.
func (de *DominationEngine) GetHistory() []DominationRecord {
	de.mu.RLock()
	defer de.mu.RUnlock()

	hist := make([]DominationRecord, len(de.history))
	copy(hist, de.history)
	return hist
}

// GetLastRecord returns the most recent evaluation record, or nil.
func (de *DominationEngine) GetLastRecord() *DominationRecord {
	de.mu.RLock()
	defer de.mu.RUnlock()

	if len(de.history) == 0 {
		return nil
	}
	last := de.history[len(de.history)-1]
	return &last
}

// Reset clears all domination state (called on full session reset).
func (de *DominationEngine) Reset() {
	de.mu.Lock()
	defer de.mu.Unlock()

	de.dominantNation = ""
	de.status = DominationNone
	de.dominationStartTime = time.Time{}
	de.transitionBonusEnd = time.Time{}
	de.history = make([]DominationRecord, 0, 24)
	de.cycleNumber = 0
	de.epochsInCycle = 0
}

// DominationSnapshot is a serializable snapshot of domination state for clients.
type DominationSnapshot struct {
	CountryCode       string           `json:"countryCode"`
	DominantNation    string           `json:"dominantNation"`
	Status            DominationStatus `json:"status"`
	DominationDays    float64          `json:"dominationDays"`
	CycleNumber       int              `json:"cycleNumber"`
	EpochsInCycle     int              `json:"epochsInCycle"`
	TransitionBonus   bool             `json:"transitionBonus"`
	LastEvalScores    map[string]int   `json:"lastEvalScores,omitempty"`
}

// GetSnapshot returns a serializable snapshot of the domination state.
func (de *DominationEngine) GetSnapshot() DominationSnapshot {
	de.mu.RLock()
	defer de.mu.RUnlock()

	snap := DominationSnapshot{
		CountryCode:     de.countryCode,
		DominantNation:  de.dominantNation,
		Status:          de.status,
		CycleNumber:     de.cycleNumber,
		EpochsInCycle:   de.epochsInCycle,
		TransitionBonus: time.Now().Before(de.transitionBonusEnd),
	}

	if de.dominantNation != "" && !de.dominationStartTime.IsZero() {
		snap.DominationDays = time.Since(de.dominationStartTime).Hours() / 24.0
	}

	if len(de.history) > 0 {
		last := de.history[len(de.history)-1]
		snap.LastEvalScores = last.AllScores
	}

	return snap
}
