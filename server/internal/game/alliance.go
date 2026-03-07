package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 7 — S33: Alliance Manager
// Max 5 nations per alliance.
// Requirements: hegemony or sovereignty to form alliance.
// Allied nations treated as friendly in war arenas.
// Alliance betrayal: -50 international reputation.
// ============================================================

// Alliance system constants
const (
	// AllianceMaxMembers is the maximum nations in a single alliance.
	AllianceMaxMembers = 5

	// AllianceBetrayalRepPenalty is the reputation cost of betraying an alliance.
	AllianceBetrayalRepPenalty = -50.0

	// AllianceMaxPerNation is the max alliances a single nation can be in.
	AllianceMaxPerNation = 1
)

// AllianceEventType classifies alliance lifecycle events.
type AllianceEventType string

const (
	AlliEvtFormed     AllianceEventType = "alliance_formed"
	AlliEvtJoined     AllianceEventType = "alliance_joined"
	AlliEvtLeft       AllianceEventType = "alliance_left"
	AlliEvtBetrayed   AllianceEventType = "alliance_betrayed"
	AlliEvtDissolved  AllianceEventType = "alliance_dissolved"
	AlliEvtWarJoined  AllianceEventType = "alliance_war_joined"
)

// AllianceEvent is emitted when alliance state changes.
type AllianceEvent struct {
	Type        AllianceEventType `json:"type"`
	AllianceID  string            `json:"allianceId"`
	Nation      string            `json:"nation"`
	Members     []string          `json:"members,omitempty"`
	Timestamp   time.Time         `json:"timestamp"`
}

// Alliance represents a group of allied nations.
type Alliance struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Leader    string    `json:"leader"`    // founding nation
	Members   []string  `json:"members"`   // all member nations (including leader)
	FormedAt  time.Time `json:"formedAt"`
}

// IsMember returns true if the nation is a member of this alliance.
func (a *Alliance) IsMember(nationality string) bool {
	for _, m := range a.Members {
		if m == nationality {
			return true
		}
	}
	return false
}

// MemberCount returns the number of members.
func (a *Alliance) MemberCount() int {
	return len(a.Members)
}

// AllianceManager manages alliances between nations.
type AllianceManager struct {
	mu sync.RWMutex

	// All alliances: allianceID → Alliance
	alliances map[string]*Alliance

	// Nation → alliance ID mapping (fast lookup)
	nationAlliance map[string]string

	// Alliance counter for unique IDs
	counter int

	// Dependency: sovereignty check
	getSovereignty func(string) *SovereigntyTracker

	// Dependency: nation stats (for betrayal penalty)
	getNationStats func(string) *NationStatsEngine

	// Event callback
	OnEvent func(event AllianceEvent)
}

// NewAllianceManager creates a new alliance management system.
func NewAllianceManager(
	getSovereignty func(string) *SovereigntyTracker,
	getNationStats func(string) *NationStatsEngine,
) *AllianceManager {
	return &AllianceManager{
		alliances:      make(map[string]*Alliance),
		nationAlliance: make(map[string]string),
		getSovereignty: getSovereignty,
		getNationStats: getNationStats,
	}
}

// FormAlliance creates a new alliance between two or more nations.
// The founder must have hegemony or sovereignty.
func (am *AllianceManager) FormAlliance(founder string, allies []string, name string) (string, error) {
	am.mu.Lock()
	defer am.mu.Unlock()

	now := time.Now()

	// Validate founder has hegemony or sovereignty
	if err := am.validateAllianceEligibility(founder); err != nil {
		return "", fmt.Errorf("founder %s: %w", founder, err)
	}

	// Check founder isn't already in an alliance
	if _, exists := am.nationAlliance[founder]; exists {
		return "", fmt.Errorf("nation %s is already in an alliance", founder)
	}

	// Validate all allies
	allMembers := []string{founder}
	for _, ally := range allies {
		if ally == founder {
			continue
		}
		if _, exists := am.nationAlliance[ally]; exists {
			return "", fmt.Errorf("nation %s is already in an alliance", ally)
		}
		if err := am.validateAllianceEligibility(ally); err != nil {
			return "", fmt.Errorf("ally %s: %w", ally, err)
		}
		allMembers = append(allMembers, ally)
	}

	// Check member count
	if len(allMembers) > AllianceMaxMembers {
		return "", fmt.Errorf("alliance exceeds max members (%d > %d)", len(allMembers), AllianceMaxMembers)
	}
	if len(allMembers) < 2 {
		return "", fmt.Errorf("alliance requires at least 2 members")
	}

	// Create alliance
	am.counter++
	allianceID := fmt.Sprintf("alliance_%d_%s", am.counter, founder)

	alliance := &Alliance{
		ID:       allianceID,
		Name:     name,
		Leader:   founder,
		Members:  allMembers,
		FormedAt: now,
	}

	am.alliances[allianceID] = alliance

	// Map all members
	for _, member := range allMembers {
		am.nationAlliance[member] = allianceID
	}

	slog.Info("alliance formed",
		"allianceId", allianceID,
		"name", name,
		"leader", founder,
		"members", allMembers,
	)

	am.emitEvent(AllianceEvent{
		Type:       AlliEvtFormed,
		AllianceID: allianceID,
		Nation:     founder,
		Members:    allMembers,
		Timestamp:  now,
	})

	return allianceID, nil
}

// JoinAlliance adds a nation to an existing alliance.
func (am *AllianceManager) JoinAlliance(allianceID, nation string) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	alliance, ok := am.alliances[allianceID]
	if !ok {
		return fmt.Errorf("alliance %s not found", allianceID)
	}

	if alliance.MemberCount() >= AllianceMaxMembers {
		return fmt.Errorf("alliance %s is full (%d/%d)", allianceID, alliance.MemberCount(), AllianceMaxMembers)
	}

	if alliance.IsMember(nation) {
		return fmt.Errorf("nation %s already in alliance %s", nation, allianceID)
	}

	if _, exists := am.nationAlliance[nation]; exists {
		return fmt.Errorf("nation %s already in another alliance", nation)
	}

	if err := am.validateAllianceEligibility(nation); err != nil {
		return fmt.Errorf("nation %s: %w", nation, err)
	}

	alliance.Members = append(alliance.Members, nation)
	am.nationAlliance[nation] = allianceID

	slog.Info("nation joined alliance",
		"allianceId", allianceID,
		"nation", nation,
		"memberCount", alliance.MemberCount(),
	)

	am.emitEvent(AllianceEvent{
		Type:       AlliEvtJoined,
		AllianceID: allianceID,
		Nation:     nation,
		Members:    alliance.Members,
		Timestamp:  time.Now(),
	})

	return nil
}

// LeaveAlliance removes a nation from their alliance.
// If the nation is at war with an alliance partner, this is considered betrayal.
func (am *AllianceManager) LeaveAlliance(nation string, isBetrayal bool) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	allianceID, ok := am.nationAlliance[nation]
	if !ok {
		return fmt.Errorf("nation %s is not in any alliance", nation)
	}

	alliance, ok := am.alliances[allianceID]
	if !ok {
		return fmt.Errorf("alliance %s not found", allianceID)
	}

	// Remove nation from members
	newMembers := make([]string, 0, len(alliance.Members)-1)
	for _, m := range alliance.Members {
		if m != nation {
			newMembers = append(newMembers, m)
		}
	}
	alliance.Members = newMembers
	delete(am.nationAlliance, nation)

	evtType := AlliEvtLeft
	if isBetrayal {
		evtType = AlliEvtBetrayed
		// Apply betrayal reputation penalty
		am.applyBetrayalPenalty(nation)
	}

	slog.Info("nation left alliance",
		"allianceId", allianceID,
		"nation", nation,
		"betrayal", isBetrayal,
		"remainingMembers", len(alliance.Members),
	)

	am.emitEvent(AllianceEvent{
		Type:       evtType,
		AllianceID: allianceID,
		Nation:     nation,
		Members:    alliance.Members,
		Timestamp:  time.Now(),
	})

	// Dissolve alliance if fewer than 2 members
	if len(alliance.Members) < 2 {
		am.dissolveAllianceLocked(allianceID)
	} else if nation == alliance.Leader && len(alliance.Members) > 0 {
		// Transfer leadership to next member
		alliance.Leader = alliance.Members[0]
	}

	return nil
}

// dissolveAllianceLocked removes an alliance entirely (caller must hold mu).
func (am *AllianceManager) dissolveAllianceLocked(allianceID string) {
	alliance, ok := am.alliances[allianceID]
	if !ok {
		return
	}

	for _, member := range alliance.Members {
		delete(am.nationAlliance, member)
	}
	delete(am.alliances, allianceID)

	slog.Info("alliance dissolved",
		"allianceId", allianceID,
	)

	am.emitEvent(AllianceEvent{
		Type:       AlliEvtDissolved,
		AllianceID: allianceID,
		Members:    alliance.Members,
		Timestamp:  time.Now(),
	})
}

// applyBetrayalPenalty applies -50 international reputation for alliance betrayal.
func (am *AllianceManager) applyBetrayalPenalty(nation string) {
	if am.getNationStats == nil {
		return
	}

	stats := am.getNationStats(nation)
	if stats == nil {
		return
	}

	stats.ApplyWarResult(0, 0, 0, AllianceBetrayalRepPenalty)

	slog.Info("betrayal penalty applied",
		"nation", nation,
		"repPenalty", AllianceBetrayalRepPenalty,
	)
}

// validateAllianceEligibility checks if a nation can form/join alliances.
func (am *AllianceManager) validateAllianceEligibility(nation string) error {
	if am.getSovereignty == nil {
		return nil // no sovereignty check available
	}

	tracker := am.getSovereignty(nation)
	if tracker == nil {
		return fmt.Errorf("no sovereignty data available")
	}

	if !tracker.HasSovereignty() && !tracker.HasHegemony() {
		return fmt.Errorf("requires sovereignty or hegemony")
	}

	return nil
}

// --- Public Getters (thread-safe) ---

// GetAlliance returns an alliance by ID.
func (am *AllianceManager) GetAlliance(allianceID string) *Alliance {
	am.mu.RLock()
	defer am.mu.RUnlock()

	alliance, ok := am.alliances[allianceID]
	if !ok {
		return nil
	}
	// Return copy
	allianceCopy := *alliance
	members := make([]string, len(alliance.Members))
	copy(members, alliance.Members)
	allianceCopy.Members = members
	return &allianceCopy
}

// GetNationAlliance returns the alliance ID for a nation, or empty string.
func (am *AllianceManager) GetNationAlliance(nationality string) string {
	am.mu.RLock()
	defer am.mu.RUnlock()
	return am.nationAlliance[nationality]
}

// AreAllied returns true if two nations are in the same alliance.
func (am *AllianceManager) AreAllied(nationA, nationB string) bool {
	am.mu.RLock()
	defer am.mu.RUnlock()

	allianceA, okA := am.nationAlliance[nationA]
	allianceB, okB := am.nationAlliance[nationB]

	return okA && okB && allianceA == allianceB
}

// GetAllAlliances returns all active alliances.
func (am *AllianceManager) GetAllAlliances() []*Alliance {
	am.mu.RLock()
	defer am.mu.RUnlock()

	var result []*Alliance
	for _, alliance := range am.alliances {
		allianceCopy := *alliance
		members := make([]string, len(alliance.Members))
		copy(members, alliance.Members)
		allianceCopy.Members = members
		result = append(result, &allianceCopy)
	}
	return result
}

// GetAllianceMembers returns the members of a nation's alliance, excluding the nation itself.
func (am *AllianceManager) GetAllianceMembers(nationality string) []string {
	am.mu.RLock()
	defer am.mu.RUnlock()

	allianceID, ok := am.nationAlliance[nationality]
	if !ok {
		return nil
	}

	alliance, ok := am.alliances[allianceID]
	if !ok {
		return nil
	}

	var members []string
	for _, m := range alliance.Members {
		if m != nationality {
			members = append(members, m)
		}
	}
	return members
}

// GetAllianceSnapshot returns a serializable snapshot for clients.
func (am *AllianceManager) GetAllianceSnapshot() []AllianceSnapshot {
	am.mu.RLock()
	defer am.mu.RUnlock()

	var snapshots []AllianceSnapshot
	for _, alliance := range am.alliances {
		snapshots = append(snapshots, AllianceSnapshot{
			AllianceID: alliance.ID,
			Name:       alliance.Name,
			Leader:     alliance.Leader,
			Members:    alliance.Members,
			FormedAt:   alliance.FormedAt.Unix(),
		})
	}
	return snapshots
}

// AllianceSnapshot is a serializable snapshot for client transmission.
type AllianceSnapshot struct {
	AllianceID string   `json:"allianceId"`
	Name       string   `json:"name"`
	Leader     string   `json:"leader"`
	Members    []string `json:"members"`
	FormedAt   int64    `json:"formedAt"`
}

// Reset clears all alliance state.
func (am *AllianceManager) Reset() {
	am.mu.Lock()
	defer am.mu.Unlock()

	am.alliances = make(map[string]*Alliance)
	am.nationAlliance = make(map[string]string)
	am.counter = 0
}

func (am *AllianceManager) emitEvent(event AllianceEvent) {
	if am.OnEvent != nil {
		am.OnEvent(event)
	}
}
