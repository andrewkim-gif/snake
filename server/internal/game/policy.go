package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 6 — S27: Policy System Server
// PolicyManager manages country policies.
// Only hegemony nations can change policies.
// Changes limited to 1/week (Monday 00:00 UTC).
// 6-hour grace period before effects apply.
// ============================================================

// Policy timing constants
const (
	// PolicyGraceHours is the delay before a policy change takes effect.
	PolicyGraceHours = 6

	// PolicyChangeDay is the day of week when policy changes reset (Monday = 1).
	PolicyChangeDay = time.Monday
)

// PolicyChangeError codes
const (
	PolicyErrNotHegemony    = "not_hegemony"
	PolicyErrCooldown       = "cooldown_active"
	PolicyErrGracePending   = "grace_pending"
	PolicyErrInvalidCategory = "invalid_category"
	PolicyErrInvalidLevel   = "invalid_level"
	PolicyErrSameLevel      = "same_level"
)

// PolicyManager manages policies for a single country.
type PolicyManager struct {
	mu sync.RWMutex

	countryCode string
	policies    *domain.CountryPolicies

	// Sovereignty tracker for permission check
	sovereigntyTracker *SovereigntyTracker

	// Pending change (in grace period)
	pendingChange *pendingPolicyChange

	// Event callback
	OnPolicyChanged func(event domain.PolicyChangedEvent)
}

// pendingPolicyChange represents a policy change in the 6-hour grace period.
type pendingPolicyChange struct {
	Category    domain.PolicyCategory
	OldLevel    domain.PolicyLevel
	NewLevel    domain.PolicyLevel
	ChangedBy   string
	ChangeTime  time.Time
	EffectiveAt time.Time
}

// NewPolicyManager creates a policy manager for a country.
func NewPolicyManager(countryCode string, st *SovereigntyTracker) *PolicyManager {
	return &PolicyManager{
		countryCode:        countryCode,
		policies:           domain.NewDefaultPolicies(countryCode),
		sovereigntyTracker: st,
	}
}

// SetPolicy attempts to change a policy. Returns error string or empty on success.
func (pm *PolicyManager) SetPolicy(agentID string, agentNationality string, req domain.SetPolicyRequest) (string, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	now := time.Now()

	// 1. Validate category
	def := domain.GetPolicyDefinition(req.Category)
	if def == nil {
		return PolicyErrInvalidCategory, fmt.Errorf("invalid policy category: %s", req.Category)
	}

	// 2. Validate level (0, 1, 2)
	if req.Level < 0 || req.Level > 2 {
		return PolicyErrInvalidLevel, fmt.Errorf("invalid policy level: %d", req.Level)
	}

	// 3. Check same level
	currentLevel := pm.policies.Policies[req.Category]
	if currentLevel == req.Level {
		return PolicyErrSameLevel, fmt.Errorf("policy already at level %d", req.Level)
	}

	// 4. Check hegemony permission
	if pm.sovereigntyTracker != nil && !pm.sovereigntyTracker.CanSetPolicy(agentNationality) {
		return PolicyErrNotHegemony, fmt.Errorf("nation %s does not have hegemony for %s", agentNationality, pm.countryCode)
	}

	// 5. Check weekly cooldown (1 change per week, resets Monday 00:00 UTC)
	if pm.policies.LastChanged > 0 {
		lastChanged := time.Unix(pm.policies.LastChanged, 0)
		nextMondayUTC := getNextMondayUTC(lastChanged)
		if now.Before(nextMondayUTC) {
			return PolicyErrCooldown, fmt.Errorf("policy change on cooldown until %s", nextMondayUTC.Format(time.RFC3339))
		}
	}

	// 6. Check no pending grace period
	if pm.pendingChange != nil && now.Before(pm.pendingChange.EffectiveAt) {
		return PolicyErrGracePending, fmt.Errorf("pending policy change in grace period until %s",
			pm.pendingChange.EffectiveAt.Format(time.RFC3339))
	}

	// All checks passed — create pending change
	effectiveAt := now.Add(PolicyGraceHours * time.Hour)

	pm.pendingChange = &pendingPolicyChange{
		Category:    req.Category,
		OldLevel:    currentLevel,
		NewLevel:    req.Level,
		ChangedBy:   agentID,
		ChangeTime:  now,
		EffectiveAt: effectiveAt,
	}

	pm.policies.LastChanged = now.Unix()
	pm.policies.ChangedBy = agentID
	pm.policies.GraceEnd = effectiveAt.Unix()

	// Emit event
	event := domain.PolicyChangedEvent{
		CountryCode: pm.countryCode,
		Category:    req.Category,
		OldLevel:    currentLevel,
		NewLevel:    req.Level,
		ChangedBy:   agentID,
		EffectiveAt: effectiveAt.Unix(),
	}

	if pm.OnPolicyChanged != nil {
		pm.OnPolicyChanged(event)
	}

	slog.Info("policy change initiated",
		"country", pm.countryCode,
		"category", req.Category,
		"old_level", currentLevel,
		"new_level", req.Level,
		"changed_by", agentID,
		"effective_at", effectiveAt.Format(time.RFC3339),
	)

	return "", nil
}

// Tick checks if any pending policy change has completed its grace period.
// Call this periodically (e.g., every epoch end or every minute).
func (pm *PolicyManager) Tick() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.pendingChange == nil {
		return
	}

	now := time.Now()
	if now.After(pm.pendingChange.EffectiveAt) || now.Equal(pm.pendingChange.EffectiveAt) {
		// Apply the pending change
		pm.policies.Policies[pm.pendingChange.Category] = pm.pendingChange.NewLevel

		slog.Info("policy change applied",
			"country", pm.countryCode,
			"category", pm.pendingChange.Category,
			"new_level", pm.pendingChange.NewLevel,
		)

		pm.pendingChange = nil
		pm.policies.GraceEnd = 0
	}
}

// GetPolicies returns a copy of the current policies.
func (pm *PolicyManager) GetPolicies() domain.CountryPolicies {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	cp := *pm.policies
	cp.Policies = make(map[domain.PolicyCategory]domain.PolicyLevel, len(pm.policies.Policies))
	for k, v := range pm.policies.Policies {
		cp.Policies[k] = v
	}
	return cp
}

// GetPolicyLevel returns the current level for a specific category.
func (pm *PolicyManager) GetPolicyLevel(cat domain.PolicyCategory) domain.PolicyLevel {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.policies.Policies[cat]
}

// GetEffects returns the aggregate stat effects of current policies.
func (pm *PolicyManager) GetEffects() map[string]float64 {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return domain.GetPolicyEffects(pm.policies.Policies)
}

// HasPendingChange returns true if a policy change is in the grace period.
func (pm *PolicyManager) HasPendingChange() bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.pendingChange != nil
}

// GetPendingChange returns info about the pending change, if any.
func (pm *PolicyManager) GetPendingChange() *pendingPolicyChange {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	if pm.pendingChange == nil {
		return nil
	}
	cp := *pm.pendingChange
	return &cp
}

// CanChangePolicy returns true if a policy change is currently allowed.
func (pm *PolicyManager) CanChangePolicy(nationality string) bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	// Check hegemony
	if pm.sovereigntyTracker != nil && !pm.sovereigntyTracker.CanSetPolicy(nationality) {
		return false
	}

	// Check cooldown
	now := time.Now()
	if pm.policies.LastChanged > 0 {
		lastChanged := time.Unix(pm.policies.LastChanged, 0)
		nextMonday := getNextMondayUTC(lastChanged)
		if now.Before(nextMonday) {
			return false
		}
	}

	// Check grace
	if pm.pendingChange != nil && now.Before(pm.pendingChange.EffectiveAt) {
		return false
	}

	return true
}

// ResetToDefaults resets all policies to default (mid-level).
// Called when hegemony grace period expires.
func (pm *PolicyManager) ResetToDefaults() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	for _, cat := range domain.AllPolicyCategories {
		pm.policies.Policies[cat] = domain.PolicyLevelMid
	}
	pm.policies.LastChanged = 0
	pm.policies.ChangedBy = ""
	pm.policies.GraceEnd = 0
	pm.pendingChange = nil

	slog.Info("policies reset to defaults", "country", pm.countryCode)
}

// Reset clears all policy state.
func (pm *PolicyManager) Reset() {
	pm.ResetToDefaults()
}

// getNextMondayUTC returns the next Monday 00:00 UTC after the given time.
func getNextMondayUTC(t time.Time) time.Time {
	t = t.UTC()
	// Move to next day until we hit Monday
	daysUntilMonday := (int(PolicyChangeDay) - int(t.Weekday()) + 7) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7 // If it's already Monday, next week
	}
	nextMonday := time.Date(t.Year(), t.Month(), t.Day()+daysUntilMonday, 0, 0, 0, 0, time.UTC)
	return nextMonday
}
