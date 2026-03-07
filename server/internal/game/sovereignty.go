package game

import (
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 5 — S25: Sovereignty & Hegemony
// 24h continuous domination → Sovereignty flag + buffs
// 7-day continuous sovereignty → Hegemony flag + policy API
// Hegemony loss → 2-week policy grace period
// ============================================================

// Sovereignty/Hegemony timing thresholds
const (
	// SovereigntyThresholdHours is the continuous domination required for sovereignty.
	SovereigntyThresholdHours = 24

	// HegemonyThresholdDays is the continuous sovereignty required for hegemony.
	HegemonyThresholdDays = 7

	// HegemonyPolicyGraceDays is how long policies persist after hegemony loss.
	HegemonyPolicyGraceDays = 14
)

// Sovereignty buff constants
const (
	// SovereigntyXPBonus is the XP bonus for sovereignty (+10%).
	SovereigntyXPBonus = 0.10

	// SovereigntySpeedBonus is the movement speed bonus for sovereignty (+5%).
	SovereigntySpeedBonus = 0.05

	// SovereigntyCaptureBonus is the capture speed bonus for sovereignty (+20%).
	SovereigntyCaptureBonus = 0.20
)

// SovereigntyEvent is emitted when sovereignty/hegemony state changes.
type SovereigntyEvent struct {
	Type           SovereigntyEventType `json:"type"`
	CountryCode    string               `json:"countryCode"`
	Nation         string               `json:"nation"`
	Timestamp      time.Time            `json:"timestamp"`
	DominationDays float64              `json:"dominationDays,omitempty"`
	SovereignDays  float64              `json:"sovereignDays,omitempty"`
}

// SovereigntyEventType classifies sovereignty events.
type SovereigntyEventType string

const (
	SovEvtSovereigntyAchieved  SovereigntyEventType = "sovereignty_achieved"
	SovEvtSovereigntyLost      SovereigntyEventType = "sovereignty_lost"
	SovEvtHegemonyAchieved     SovereigntyEventType = "hegemony_achieved"
	SovEvtHegemonyLost         SovereigntyEventType = "hegemony_lost"
	SovEvtPolicyGraceStarted   SovereigntyEventType = "policy_grace_started"
	SovEvtPolicyGraceExpired   SovereigntyEventType = "policy_grace_expired"
)

// SovereigntyBuffs holds the active buffs from sovereignty status.
type SovereigntyBuffs struct {
	XPMultiplier      float64 `json:"xpMultiplier"`      // 1.0 + bonus
	SpeedMultiplier   float64 `json:"speedMultiplier"`    // 1.0 + bonus
	CaptureMultiplier float64 `json:"captureMultiplier"`  // 1.0 + bonus
}

// NoBuff returns buffs with no bonus (all 1.0).
func NoBuff() SovereigntyBuffs {
	return SovereigntyBuffs{
		XPMultiplier:      1.0,
		SpeedMultiplier:   1.0,
		CaptureMultiplier: 1.0,
	}
}

// SovereigntyTracker monitors continuous domination to detect sovereignty and hegemony.
type SovereigntyTracker struct {
	mu sync.RWMutex

	countryCode string

	// The nation currently dominating this country
	dominantNation string

	// Domination timeline
	dominationStart time.Time // when current nation started dominating (from DominationEngine)

	// Sovereignty state
	hasSovereignty  bool
	sovereigntyTime time.Time // when sovereignty was achieved

	// Hegemony state
	hasHegemony  bool
	hegemonyTime time.Time // when hegemony was achieved

	// Policy grace: when hegemony is lost, policies persist for 2 weeks
	policyGraceEnd time.Time
	policyNation   string // the nation whose policies are in grace period

	// Event callback
	OnEvent func(event SovereigntyEvent)
}

// NewSovereigntyTracker creates a new sovereignty tracker for a country.
func NewSovereigntyTracker(countryCode string) *SovereigntyTracker {
	return &SovereigntyTracker{
		countryCode: countryCode,
	}
}

// OnDominationUpdate is called after each domination evaluation.
// It checks if sovereignty or hegemony conditions are met.
func (st *SovereigntyTracker) OnDominationUpdate(dominantNation string, dominationStart time.Time) {
	st.mu.Lock()
	defer st.mu.Unlock()

	now := time.Now()
	previousDominant := st.dominantNation

	if dominantNation == "" {
		// No dominant nation — lose everything
		if st.hasSovereignty || st.hasHegemony {
			st.handleLoss(previousDominant, now)
		}
		st.dominantNation = ""
		st.dominationStart = time.Time{}
		st.hasSovereignty = false
		st.hasHegemony = false
		st.sovereigntyTime = time.Time{}
		st.hegemonyTime = time.Time{}
		return
	}

	if dominantNation != previousDominant {
		// Domination changed hands — previous loses sovereignty/hegemony
		if st.hasSovereignty || st.hasHegemony {
			st.handleLoss(previousDominant, now)
		}
		st.dominantNation = dominantNation
		st.dominationStart = dominationStart
		st.hasSovereignty = false
		st.hasHegemony = false
		st.sovereigntyTime = time.Time{}
		st.hegemonyTime = time.Time{}
		return
	}

	// Same nation continues to dominate — check thresholds
	st.dominantNation = dominantNation
	st.dominationStart = dominationStart

	dominationHours := now.Sub(dominationStart).Hours()

	// Check sovereignty (24h continuous domination)
	if !st.hasSovereignty && dominationHours >= float64(SovereigntyThresholdHours) {
		st.hasSovereignty = true
		st.sovereigntyTime = now

		st.emitEvent(SovereigntyEvent{
			Type:           SovEvtSovereigntyAchieved,
			CountryCode:    st.countryCode,
			Nation:         dominantNation,
			Timestamp:      now,
			DominationDays: dominationHours / 24.0,
		})

		slog.Info("sovereignty achieved",
			"country", st.countryCode,
			"nation", dominantNation,
			"domination_hours", int(dominationHours),
		)
	}

	// Check hegemony (7 days of continuous sovereignty)
	if st.hasSovereignty && !st.hasHegemony {
		sovereignDays := now.Sub(st.sovereigntyTime).Hours() / 24.0
		if sovereignDays >= float64(HegemonyThresholdDays) {
			st.hasHegemony = true
			st.hegemonyTime = now

			st.emitEvent(SovereigntyEvent{
				Type:           SovEvtHegemonyAchieved,
				CountryCode:    st.countryCode,
				Nation:         dominantNation,
				Timestamp:      now,
				SovereignDays:  sovereignDays,
				DominationDays: dominationHours / 24.0,
			})

			slog.Info("hegemony achieved",
				"country", st.countryCode,
				"nation", dominantNation,
				"sovereign_days", int(sovereignDays),
			)
		}
	}
}

// handleLoss processes the loss of sovereignty/hegemony when domination changes.
func (st *SovereigntyTracker) handleLoss(losingNation string, now time.Time) {
	if st.hasHegemony {
		// Start policy grace period (2 weeks)
		st.policyGraceEnd = now.Add(time.Duration(HegemonyPolicyGraceDays) * 24 * time.Hour)
		st.policyNation = losingNation

		st.emitEvent(SovereigntyEvent{
			Type:        SovEvtHegemonyLost,
			CountryCode: st.countryCode,
			Nation:      losingNation,
			Timestamp:   now,
		})

		st.emitEvent(SovereigntyEvent{
			Type:        SovEvtPolicyGraceStarted,
			CountryCode: st.countryCode,
			Nation:      losingNation,
			Timestamp:   now,
		})

		slog.Info("hegemony lost, policy grace started",
			"country", st.countryCode,
			"nation", losingNation,
			"grace_until", st.policyGraceEnd.Format(time.RFC3339),
		)
	} else if st.hasSovereignty {
		st.emitEvent(SovereigntyEvent{
			Type:        SovEvtSovereigntyLost,
			CountryCode: st.countryCode,
			Nation:      losingNation,
			Timestamp:   now,
		})

		slog.Info("sovereignty lost",
			"country", st.countryCode,
			"nation", losingNation,
		)
	}
}

func (st *SovereigntyTracker) emitEvent(event SovereigntyEvent) {
	if st.OnEvent != nil {
		st.OnEvent(event)
	}
}

// --- Public Getters (thread-safe) ---

// GetDominantNation returns the current dominant nation.
func (st *SovereigntyTracker) GetDominantNation() string {
	st.mu.RLock()
	defer st.mu.RUnlock()
	return st.dominantNation
}

// HasSovereignty returns whether the current dominant nation has sovereignty.
func (st *SovereigntyTracker) HasSovereignty() bool {
	st.mu.RLock()
	defer st.mu.RUnlock()
	return st.hasSovereignty
}

// HasHegemony returns whether the current dominant nation has hegemony.
func (st *SovereigntyTracker) HasHegemony() bool {
	st.mu.RLock()
	defer st.mu.RUnlock()
	return st.hasHegemony
}

// GetBuffs returns the active sovereignty buffs for the dominant nation.
// Returns NoBuff if no sovereignty.
func (st *SovereigntyTracker) GetBuffs() SovereigntyBuffs {
	st.mu.RLock()
	defer st.mu.RUnlock()

	if !st.hasSovereignty {
		return NoBuff()
	}

	return SovereigntyBuffs{
		XPMultiplier:      1.0 + SovereigntyXPBonus,
		SpeedMultiplier:   1.0 + SovereigntySpeedBonus,
		CaptureMultiplier: 1.0 + SovereigntyCaptureBonus,
	}
}

// GetBuffsForNation returns the buffs for a specific nation.
// Only the dominant nation gets sovereignty buffs.
func (st *SovereigntyTracker) GetBuffsForNation(nationality string) SovereigntyBuffs {
	st.mu.RLock()
	defer st.mu.RUnlock()

	if !st.hasSovereignty || nationality != st.dominantNation {
		return NoBuff()
	}

	return SovereigntyBuffs{
		XPMultiplier:      1.0 + SovereigntyXPBonus,
		SpeedMultiplier:   1.0 + SovereigntySpeedBonus,
		CaptureMultiplier: 1.0 + SovereigntyCaptureBonus,
	}
}

// CanSetPolicy returns true if the given nation is allowed to change policies.
// Only hegemony nations or nations within the policy grace period can set policies.
func (st *SovereigntyTracker) CanSetPolicy(nationality string) bool {
	st.mu.RLock()
	defer st.mu.RUnlock()

	// Current hegemony nation can always set policy
	if st.hasHegemony && nationality == st.dominantNation {
		return true
	}

	// Grace period: former hegemony nation retains policy access for 2 weeks
	if st.policyNation == nationality && time.Now().Before(st.policyGraceEnd) {
		return true
	}

	return false
}

// IsPolicyGraceActive returns true if the policy grace period is active for any nation.
func (st *SovereigntyTracker) IsPolicyGraceActive() bool {
	st.mu.RLock()
	defer st.mu.RUnlock()
	return st.policyNation != "" && time.Now().Before(st.policyGraceEnd)
}

// GetPolicyGraceNation returns the nation in the policy grace period (empty if none).
func (st *SovereigntyTracker) GetPolicyGraceNation() string {
	st.mu.RLock()
	defer st.mu.RUnlock()

	if st.policyNation != "" && time.Now().Before(st.policyGraceEnd) {
		return st.policyNation
	}
	return ""
}

// CheckPolicyGraceExpiry checks if the grace period has expired and emits event if so.
// Call this periodically (e.g., every domination cycle).
func (st *SovereigntyTracker) CheckPolicyGraceExpiry() {
	st.mu.Lock()
	defer st.mu.Unlock()

	if st.policyNation == "" {
		return
	}

	now := time.Now()
	if now.After(st.policyGraceEnd) {
		nation := st.policyNation
		st.policyNation = ""
		st.policyGraceEnd = time.Time{}

		st.emitEvent(SovereigntyEvent{
			Type:        SovEvtPolicyGraceExpired,
			CountryCode: st.countryCode,
			Nation:      nation,
			Timestamp:   now,
		})

		slog.Info("policy grace expired",
			"country", st.countryCode,
			"nation", nation,
		)
	}
}

// GetDominationStatus returns the current domination status for display.
func (st *SovereigntyTracker) GetDominationStatus() DominationStatus {
	st.mu.RLock()
	defer st.mu.RUnlock()

	if st.hasHegemony {
		return DominationHegemony
	}
	if st.hasSovereignty {
		return DominationSovereignty
	}
	if st.dominantNation != "" {
		return DominationActive
	}
	return DominationNone
}

// SovereigntySnapshot is a serializable snapshot of sovereignty/hegemony state.
type SovereigntySnapshot struct {
	CountryCode     string           `json:"countryCode"`
	DominantNation  string           `json:"dominantNation"`
	Status          DominationStatus `json:"status"`
	HasSovereignty  bool             `json:"hasSovereignty"`
	HasHegemony     bool             `json:"hasHegemony"`
	DominationHours float64          `json:"dominationHours"`
	SovereignDays   float64          `json:"sovereignDays"`
	HegemonyDays    float64          `json:"hegemonyDays"`
	PolicyGrace     bool             `json:"policyGrace"`
	PolicyNation    string           `json:"policyNation,omitempty"`
	Buffs           SovereigntyBuffs `json:"buffs"`
}

// GetSnapshot returns a serializable snapshot for client transmission.
func (st *SovereigntyTracker) GetSnapshot() SovereigntySnapshot {
	st.mu.RLock()
	defer st.mu.RUnlock()

	now := time.Now()
	snap := SovereigntySnapshot{
		CountryCode:    st.countryCode,
		DominantNation: st.dominantNation,
		HasSovereignty: st.hasSovereignty,
		HasHegemony:    st.hasHegemony,
		Buffs:          NoBuff(),
	}

	if st.hasHegemony {
		snap.Status = DominationHegemony
	} else if st.hasSovereignty {
		snap.Status = DominationSovereignty
	} else if st.dominantNation != "" {
		snap.Status = DominationActive
	} else {
		snap.Status = DominationNone
	}

	if st.dominantNation != "" && !st.dominationStart.IsZero() {
		snap.DominationHours = now.Sub(st.dominationStart).Hours()
	}

	if st.hasSovereignty && !st.sovereigntyTime.IsZero() {
		snap.SovereignDays = now.Sub(st.sovereigntyTime).Hours() / 24.0
	}

	if st.hasHegemony && !st.hegemonyTime.IsZero() {
		snap.HegemonyDays = now.Sub(st.hegemonyTime).Hours() / 24.0
	}

	if st.policyNation != "" && now.Before(st.policyGraceEnd) {
		snap.PolicyGrace = true
		snap.PolicyNation = st.policyNation
	}

	if st.hasSovereignty {
		snap.Buffs = SovereigntyBuffs{
			XPMultiplier:      1.0 + SovereigntyXPBonus,
			SpeedMultiplier:   1.0 + SovereigntySpeedBonus,
			CaptureMultiplier: 1.0 + SovereigntyCaptureBonus,
		}
	}

	return snap
}

// Reset clears all sovereignty/hegemony state.
func (st *SovereigntyTracker) Reset() {
	st.mu.Lock()
	defer st.mu.Unlock()

	st.dominantNation = ""
	st.dominationStart = time.Time{}
	st.hasSovereignty = false
	st.sovereigntyTime = time.Time{}
	st.hasHegemony = false
	st.hegemonyTime = time.Time{}
	st.policyGraceEnd = time.Time{}
	st.policyNation = ""
}
