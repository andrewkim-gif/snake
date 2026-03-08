package game

import (
	"fmt"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 8 — S35: Event Log & News System
// Records domination changes, war declarations/endings, hegemony
// achievements for global broadcast to lobby clients.
// ============================================================

// GlobalEventType classifies global events for the news ticker.
type GlobalEventType string

const (
	GEvtDominationChange  GlobalEventType = "domination_change"
	GEvtWarDeclared       GlobalEventType = "war_declared"
	GEvtWarEnded          GlobalEventType = "war_ended"
	GEvtHegemonyAchieved  GlobalEventType = "hegemony_achieved"
	GEvtSovereignty       GlobalEventType = "sovereignty_achieved"
	GEvtAllianceFormed    GlobalEventType = "alliance_formed"
	GEvtPolicyChanged     GlobalEventType = "policy_changed"
	GEvtEpochComplete     GlobalEventType = "epoch_complete"
	GEvtCapturePointTaken GlobalEventType = "capture_point_taken"
	GEvtFactionCreated    GlobalEventType = "faction_created"
	GEvtTechCompleted     GlobalEventType = "tech_completed"
	GEvtTreatySigned      GlobalEventType = "treaty_signed"
	GEvtTreatyBroken      GlobalEventType = "treaty_broken"
)

// GlobalEvent represents a single global news event for the ticker.
type GlobalEvent struct {
	ID          string          `json:"id"`
	Type        GlobalEventType `json:"type"`
	Message     string          `json:"message"`
	CountryCode string          `json:"countryCode,omitempty"`
	CountryName string          `json:"countryName,omitempty"`
	TargetCode  string          `json:"targetCode,omitempty"`
	TargetName  string          `json:"targetName,omitempty"`
	Nation      string          `json:"nation,omitempty"`
	Score       int             `json:"score,omitempty"`
	Timestamp   int64           `json:"timestamp"` // unix ms
}

// EventLog maintains a rolling log of global events and broadcasts them.
type EventLog struct {
	mu sync.RWMutex

	// Rolling event buffer (most recent first)
	events []GlobalEvent

	// Max events to keep
	maxEvents int

	// Event counter for unique IDs
	counter int

	// Broadcast callback (sends to all lobby clients)
	OnBroadcast func(event GlobalEvent)
}

// NewEventLog creates a new event log with a default capacity of 100 events.
func NewEventLog() *EventLog {
	return &EventLog{
		events:    make([]GlobalEvent, 0, 100),
		maxEvents: 100,
	}
}

// LogDominationChange records a domination change event.
func (el *EventLog) LogDominationChange(countryCode, countryName, newDominant, previousDominant string, score int) {
	msg := fmt.Sprintf("%s now dominates %s", newDominant, countryName)
	if previousDominant != "" {
		msg = fmt.Sprintf("%s takes %s from %s", newDominant, countryName, previousDominant)
	}

	el.addEvent(GlobalEvent{
		Type:        GEvtDominationChange,
		Message:     msg,
		CountryCode: countryCode,
		CountryName: countryName,
		Nation:      newDominant,
	})
}

// LogWarDeclared records a war declaration event.
func (el *EventLog) LogWarDeclared(attackerCode, attackerName, defenderCode, defenderName string) {
	el.addEvent(GlobalEvent{
		Type:        GEvtWarDeclared,
		Message:     fmt.Sprintf("%s declared war on %s", attackerName, defenderName),
		CountryCode: attackerCode,
		CountryName: attackerName,
		TargetCode:  defenderCode,
		TargetName:  defenderName,
	})
}

// LogWarEnded records a war ending event.
func (el *EventLog) LogWarEnded(winnerCode, winnerName, loserCode, loserName string, outcome WarOutcome) {
	msg := fmt.Sprintf("War between %s and %s ended", winnerName, loserName)
	if outcome == WarOutcomeAttackerWin || outcome == WarOutcomeDefenderWin {
		msg = fmt.Sprintf("%s wins war against %s", winnerName, loserName)
	} else if outcome == WarOutcomeTruce {
		msg = fmt.Sprintf("%s and %s signed a truce", winnerName, loserName)
	}

	el.addEvent(GlobalEvent{
		Type:        GEvtWarEnded,
		Message:     msg,
		CountryCode: winnerCode,
		CountryName: winnerName,
		TargetCode:  loserCode,
		TargetName:  loserName,
	})
}

// LogHegemonyAchieved records a hegemony achievement event.
func (el *EventLog) LogHegemonyAchieved(countryCode, countryName, nation string) {
	el.addEvent(GlobalEvent{
		Type:        GEvtHegemonyAchieved,
		Message:     fmt.Sprintf("%s achieved HEGEMONY over %s", nation, countryName),
		CountryCode: countryCode,
		CountryName: countryName,
		Nation:      nation,
	})
}

// LogSovereigntyAchieved records a sovereignty achievement event.
func (el *EventLog) LogSovereigntyAchieved(countryCode, countryName, nation string) {
	el.addEvent(GlobalEvent{
		Type:        GEvtSovereignty,
		Message:     fmt.Sprintf("%s achieved SOVEREIGNTY over %s", nation, countryName),
		CountryCode: countryCode,
		CountryName: countryName,
		Nation:      nation,
	})
}

// LogAllianceFormed records an alliance formation event.
func (el *EventLog) LogAllianceFormed(nation1, nation2 string) {
	el.addEvent(GlobalEvent{
		Type:    GEvtAllianceFormed,
		Message: fmt.Sprintf("Alliance formed between %s and %s", nation1, nation2),
		Nation:  nation1,
	})
}

// LogPolicyChanged records a policy change event.
func (el *EventLog) LogPolicyChanged(countryCode, countryName, nation, policyCategory, policyChoice string) {
	el.addEvent(GlobalEvent{
		Type:        GEvtPolicyChanged,
		Message:     fmt.Sprintf("%s changed %s policy to %s in %s", nation, policyCategory, policyChoice, countryName),
		CountryCode: countryCode,
		CountryName: countryName,
		Nation:      nation,
	})
}

// LogCapturePointTaken records a capture point event.
func (el *EventLog) LogCapturePointTaken(countryCode, countryName, nation, pointType string) {
	el.addEvent(GlobalEvent{
		Type:        GEvtCapturePointTaken,
		Message:     fmt.Sprintf("%s captured %s point in %s", nation, pointType, countryName),
		CountryCode: countryCode,
		CountryName: countryName,
		Nation:      nation,
	})
}

// LogFactionCreated records a faction creation event.
func (el *EventLog) LogFactionCreated(factionName, tag, countryCode string) {
	el.addEvent(GlobalEvent{
		Type:        GEvtFactionCreated,
		Message:     fmt.Sprintf("[%s] %s faction established in %s", tag, factionName, countryCode),
		CountryCode: countryCode,
		Nation:      factionName,
	})
}

// LogTechCompleted records a tech tree research completion event.
func (el *EventLog) LogTechCompleted(factionName, techName, nodeID string) {
	el.addEvent(GlobalEvent{
		Type:    GEvtTechCompleted,
		Message: fmt.Sprintf("%s completed research: %s", factionName, techName),
		Nation:  factionName,
	})
}

// LogTreatySigned records a treaty acceptance event.
func (el *EventLog) LogTreatySigned(factionA, factionB, treatyType string) {
	el.addEvent(GlobalEvent{
		Type:    GEvtTreatySigned,
		Message: fmt.Sprintf("%s signed %s treaty with %s", factionA, treatyType, factionB),
		Nation:  factionA,
	})
}

// LogTreatyBroken records a treaty violation event.
func (el *EventLog) LogTreatyBroken(breaker, otherFaction, treatyType string) {
	el.addEvent(GlobalEvent{
		Type:    GEvtTreatyBroken,
		Message: fmt.Sprintf("%s broke %s treaty with %s!", breaker, treatyType, otherFaction),
		Nation:  breaker,
	})
}

// addEvent adds an event to the log and triggers broadcast.
func (el *EventLog) addEvent(event GlobalEvent) {
	el.mu.Lock()
	defer el.mu.Unlock()

	el.counter++
	event.ID = fmt.Sprintf("evt_%d", el.counter)
	event.Timestamp = time.Now().UnixMilli()

	// Prepend (most recent first)
	el.events = append([]GlobalEvent{event}, el.events...)

	// Trim to max
	if len(el.events) > el.maxEvents {
		el.events = el.events[:el.maxEvents]
	}

	// Broadcast
	if el.OnBroadcast != nil {
		el.OnBroadcast(event)
	}
}

// GetRecentEvents returns the N most recent events.
func (el *EventLog) GetRecentEvents(n int) []GlobalEvent {
	el.mu.RLock()
	defer el.mu.RUnlock()

	if n <= 0 || n > len(el.events) {
		n = len(el.events)
	}

	result := make([]GlobalEvent, n)
	copy(result, el.events[:n])
	return result
}

// GetEventsSince returns events after the given timestamp (unix ms).
func (el *EventLog) GetEventsSince(sinceMs int64) []GlobalEvent {
	el.mu.RLock()
	defer el.mu.RUnlock()

	var result []GlobalEvent
	for _, evt := range el.events {
		if evt.Timestamp > sinceMs {
			result = append(result, evt)
		}
	}
	return result
}

// GetAllEvents returns all buffered events.
func (el *EventLog) GetAllEvents() []GlobalEvent {
	el.mu.RLock()
	defer el.mu.RUnlock()

	result := make([]GlobalEvent, len(el.events))
	copy(result, el.events)
	return result
}

// Reset clears all events.
func (el *EventLog) Reset() {
	el.mu.Lock()
	defer el.mu.Unlock()

	el.events = el.events[:0]
	el.counter = 0
}
