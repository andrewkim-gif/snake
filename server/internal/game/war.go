package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 7 — S31: War System (State Machine)
// Declaration → 24h preparation → Active (max 72h) → Ended
// Conditions: hegemony nation OR 3+ nation coalition
// Target: adjacent country or same continent
// Cooldown: 24h after war ends
// Events: declare_war C→S, war_declared/war_ended S→C
// ============================================================

// War system timing constants
const (
	// WarPreparationHours is the preparation period after declaration (24h).
	WarPreparationHours = 24

	// WarMaxActiveHours is the maximum duration of active warfare (72h).
	WarMaxActiveHours = 72

	// WarCooldownHours is the cooldown after war ends before re-declaration (24h).
	WarCooldownHours = 24

	// WarFatigueThresholdHours is when fatigue starts reducing DPS (72h).
	WarFatigueThresholdHours = 72

	// WarFatigueDPSPenaltyPerDay is the DPS penalty per day of fatigue (-5%).
	WarFatigueDPSPenaltyPerDay = 0.05

	// WarAutoSurrenderScoreRatio is the score gap for automatic surrender (3x).
	WarAutoSurrenderScoreRatio = 3.0

	// WarMinCoalitionSize is the minimum nations for a coalition declaration.
	WarMinCoalitionSize = 3

	// WarScoreKillPoints is the war score per kill (×15).
	WarScoreKillPoints = 15

	// WarScoreCapturePoints is the war score per capture (×30).
	WarScoreCapturePoints = 30

	// WarScoreDefensePoints is the war score per defense (×10).
	WarScoreDefensePoints = 10

	// WarCapacityBonus is the extra capacity during war (+20 players).
	WarCapacityBonus = 20
)

// WarEvent is emitted when war state changes.
type WarEvent struct {
	Type         WarEventType `json:"type"`
	WarID        string       `json:"warId"`
	Attacker     string       `json:"attacker"`     // ISO3 of attacking nation/primary
	Defender     string       `json:"defender"`      // ISO3 of defending nation
	Coalition    []string     `json:"coalition,omitempty"`
	DeclType     WarDeclarationType `json:"declType,omitempty"`
	State        WarState     `json:"state"`
	Outcome      WarOutcome   `json:"outcome,omitempty"`
	AttackerScore int         `json:"attackerScore,omitempty"`
	DefenderScore int         `json:"defenderScore,omitempty"`
	Timestamp    time.Time    `json:"timestamp"`
}

// War represents a single war instance between two sides.
type War struct {
	ID             string             `json:"id"`
	State          WarState           `json:"state"`
	DeclType       WarDeclarationType `json:"declType"`
	Attacker       string             `json:"attacker"`       // primary attacking nation
	Defender       string             `json:"defender"`       // primary defending nation
	AttackerAllies []string           `json:"attackerAllies"` // nations fighting with attacker
	DefenderAllies []string           `json:"defenderAllies"` // nations fighting with defender
	AttackerScore  int                `json:"attackerScore"`
	DefenderScore  int                `json:"defenderScore"`
	Outcome        WarOutcome         `json:"outcome"`
	DeclaredAt     time.Time          `json:"declaredAt"`
	ActivatedAt    time.Time          `json:"activatedAt"`
	EndedAt        time.Time          `json:"endedAt"`
}

// GetSide returns which side a nation is on in this war.
func (w *War) GetSide(nationality string) WarSide {
	if nationality == w.Attacker {
		return WarSideAttacker
	}
	for _, ally := range w.AttackerAllies {
		if nationality == ally {
			return WarSideAttacker
		}
	}
	if nationality == w.Defender {
		return WarSideDefender
	}
	for _, ally := range w.DefenderAllies {
		if nationality == ally {
			return WarSideDefender
		}
	}
	return WarSideNeutral
}

// IsParticipant returns true if the nation is involved in this war.
func (w *War) IsParticipant(nationality string) bool {
	return w.GetSide(nationality) != WarSideNeutral
}

// GetActiveDurationHours returns hours since war became active.
func (w *War) GetActiveDurationHours() float64 {
	if w.State != WarStateActive || w.ActivatedAt.IsZero() {
		return 0
	}
	return time.Since(w.ActivatedAt).Hours()
}

// GetFatiguePenalty returns the DPS penalty from war fatigue (0.0 to 1.0).
func (w *War) GetFatiguePenalty() float64 {
	hours := w.GetActiveDurationHours()
	if hours <= WarFatigueThresholdHours {
		return 0
	}
	daysOverThreshold := (hours - WarFatigueThresholdHours) / 24.0
	penalty := daysOverThreshold * WarFatigueDPSPenaltyPerDay
	if penalty > 0.5 { // cap at 50%
		return 0.5
	}
	return penalty
}

// WarSystem manages all active wars in the game world.
type WarSystem struct {
	mu sync.RWMutex

	// Active and recent wars
	wars map[string]*War // warID → War

	// Per-country cooldown tracking (countryCode → cooldown end time)
	cooldowns map[string]time.Time

	// War counter for unique IDs
	warCounter int

	// Dependency: sovereignty tracker lookup (countryCode → tracker)
	getSovereignty func(countryCode string) *SovereigntyTracker

	// Dependency: get continent for a country
	getContinent func(countryCode string) ContinentCode

	// Dependency: check adjacency between two countries
	isAdjacent func(a, b string) bool

	// Event callback
	OnEvent func(event WarEvent)
}

// NewWarSystem creates a new war management system.
func NewWarSystem(
	getSovereignty func(string) *SovereigntyTracker,
	getContinent func(string) ContinentCode,
	isAdjacent func(string, string) bool,
) *WarSystem {
	return &WarSystem{
		wars:           make(map[string]*War),
		cooldowns:      make(map[string]time.Time),
		getSovereignty: getSovereignty,
		getContinent:   getContinent,
		isAdjacent:     isAdjacent,
	}
}

// DeclareWar attempts to declare war by a nation or coalition against a target.
// Returns the war ID if successful, or an error describing why it failed.
func (ws *WarSystem) DeclareWar(attacker, defender string, coalition []string) (string, error) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	now := time.Now()

	// 1. Validate declaration type
	declType, err := ws.validateDeclarationConditions(attacker, defender, coalition, now)
	if err != nil {
		return "", err
	}

	// 2. Check target validity (adjacent or same continent)
	if err := ws.validateTarget(attacker, defender); err != nil {
		return "", err
	}

	// 3. Check for existing wars involving these nations
	if err := ws.checkExistingWars(attacker, defender); err != nil {
		return "", err
	}

	// 4. Create the war
	ws.warCounter++
	warID := fmt.Sprintf("war_%d_%s_vs_%s", ws.warCounter, attacker, defender)

	war := &War{
		ID:         warID,
		State:      WarStatePreparation,
		DeclType:   declType,
		Attacker:   attacker,
		Defender:   defender,
		Outcome:    WarOutcomeNone,
		DeclaredAt: now,
	}

	// Add coalition allies to attacker side
	if declType == WarDeclCoalition && len(coalition) > 0 {
		for _, nation := range coalition {
			if nation != attacker {
				war.AttackerAllies = append(war.AttackerAllies, nation)
			}
		}
	}

	ws.wars[warID] = war

	slog.Info("war declared",
		"warId", warID,
		"attacker", attacker,
		"defender", defender,
		"declType", declType,
		"coalition", coalition,
	)

	ws.emitEvent(WarEvent{
		Type:      WarEvtDeclared,
		WarID:     warID,
		Attacker:  attacker,
		Defender:  defender,
		Coalition: coalition,
		DeclType:  declType,
		State:     WarStatePreparation,
		Timestamp: now,
	})

	ws.emitEvent(WarEvent{
		Type:      WarEvtPrepStarted,
		WarID:     warID,
		Attacker:  attacker,
		Defender:  defender,
		State:     WarStatePreparation,
		Timestamp: now,
	})

	return warID, nil
}

// validateDeclarationConditions checks if the declaring side meets requirements.
func (ws *WarSystem) validateDeclarationConditions(attacker, defender string, coalition []string, now time.Time) (WarDeclarationType, error) {
	// Check cooldown for attacker
	if cooldownEnd, ok := ws.cooldowns[attacker]; ok && now.Before(cooldownEnd) {
		remaining := cooldownEnd.Sub(now).Hours()
		return "", fmt.Errorf("nation %s is on cooldown (%.1f hours remaining)", attacker, remaining)
	}

	// Check cooldown for defender
	if cooldownEnd, ok := ws.cooldowns[defender]; ok && now.Before(cooldownEnd) {
		remaining := cooldownEnd.Sub(now).Hours()
		return "", fmt.Errorf("target %s is on cooldown (%.1f hours remaining)", defender, remaining)
	}

	// Option 1: Hegemony declaration
	if ws.getSovereignty != nil {
		tracker := ws.getSovereignty(attacker)
		if tracker != nil && tracker.HasHegemony() && tracker.GetDominantNation() == attacker {
			return WarDeclHegemony, nil
		}
	}

	// Option 2: Coalition declaration (3+ nations)
	if len(coalition) >= WarMinCoalitionSize {
		// Verify all coalition members have at least sovereignty
		for _, nation := range coalition {
			if ws.getSovereignty != nil {
				tracker := ws.getSovereignty(nation)
				if tracker == nil || !tracker.HasSovereignty() {
					return "", fmt.Errorf("coalition member %s does not have sovereignty", nation)
				}
			}
			// Check cooldown for coalition members
			if cooldownEnd, ok := ws.cooldowns[nation]; ok && now.Before(cooldownEnd) {
				return "", fmt.Errorf("coalition member %s is on cooldown", nation)
			}
		}
		return WarDeclCoalition, nil
	}

	return "", fmt.Errorf("declaration requires hegemony status or coalition of %d+ nations (got %d)", WarMinCoalitionSize, len(coalition))
}

// validateTarget checks if the target is a valid war target (adjacent or same continent).
func (ws *WarSystem) validateTarget(attacker, defender string) error {
	if attacker == defender {
		return fmt.Errorf("cannot declare war on yourself")
	}

	// Check adjacency
	if ws.isAdjacent != nil && ws.isAdjacent(attacker, defender) {
		return nil
	}

	// Check same continent
	if ws.getContinent != nil {
		attackerContinent := ws.getContinent(attacker)
		defenderContinent := ws.getContinent(defender)
		if attackerContinent == defenderContinent && attackerContinent != "" {
			return nil
		}
	}

	return fmt.Errorf("target %s is not adjacent to or on the same continent as %s", defender, attacker)
}

// checkExistingWars ensures neither nation is already in an active war.
func (ws *WarSystem) checkExistingWars(attacker, defender string) error {
	for _, war := range ws.wars {
		if war.State == WarStateNone || war.State == WarStateEnded {
			continue
		}
		if war.IsParticipant(attacker) {
			return fmt.Errorf("nation %s is already in war %s", attacker, war.ID)
		}
		if war.IsParticipant(defender) {
			return fmt.Errorf("nation %s is already in war %s", defender, war.ID)
		}
	}
	return nil
}

// Tick advances all active wars (call from main game loop, every second or so).
func (ws *WarSystem) Tick() {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	now := time.Now()

	for _, war := range ws.wars {
		switch war.State {
		case WarStatePreparation:
			// Check if preparation period is over
			prepEnd := war.DeclaredAt.Add(time.Duration(WarPreparationHours) * time.Hour)
			if now.After(prepEnd) {
				war.State = WarStateActive
				war.ActivatedAt = now

				slog.Info("war activated",
					"warId", war.ID,
					"attacker", war.Attacker,
					"defender", war.Defender,
				)

				ws.emitEvent(WarEvent{
					Type:      WarEvtActivated,
					WarID:     war.ID,
					Attacker:  war.Attacker,
					Defender:  war.Defender,
					State:     WarStateActive,
					Timestamp: now,
				})
			}

		case WarStateActive:
			// Check max duration (72h)
			activeHours := now.Sub(war.ActivatedAt).Hours()
			if activeHours >= float64(WarMaxActiveHours) {
				ws.endWarLocked(war, WarOutcomeFatigueEnd, now)
				continue
			}

			// Check auto-surrender (3x score gap)
			ws.checkAutoSurrender(war, now)

		case WarStateEnded:
			// Clean up wars that ended more than 24h ago
			if !war.EndedAt.IsZero() && now.Sub(war.EndedAt) > 48*time.Hour {
				delete(ws.wars, war.ID)
			}
		}
	}
}

// checkAutoSurrender checks if the score gap triggers automatic surrender.
func (ws *WarSystem) checkAutoSurrender(war *War, now time.Time) {
	if war.AttackerScore == 0 && war.DefenderScore == 0 {
		return
	}

	var outcome WarOutcome
	if war.AttackerScore > 0 && war.DefenderScore > 0 {
		ratio := float64(war.AttackerScore) / float64(war.DefenderScore)
		if ratio >= WarAutoSurrenderScoreRatio {
			outcome = WarOutcomeAttackerWin
		} else if 1.0/ratio >= WarAutoSurrenderScoreRatio {
			outcome = WarOutcomeDefenderWin
		}
	} else if war.AttackerScore >= 100 && war.DefenderScore == 0 {
		outcome = WarOutcomeAttackerWin
	} else if war.DefenderScore >= 100 && war.AttackerScore == 0 {
		outcome = WarOutcomeDefenderWin
	}

	if outcome != "" {
		slog.Info("auto-surrender triggered",
			"warId", war.ID,
			"attackerScore", war.AttackerScore,
			"defenderScore", war.DefenderScore,
		)

		ws.emitEvent(WarEvent{
			Type:          WarEvtAutoSurrender,
			WarID:         war.ID,
			Attacker:      war.Attacker,
			Defender:      war.Defender,
			State:         WarStateActive,
			AttackerScore: war.AttackerScore,
			DefenderScore: war.DefenderScore,
			Timestamp:     now,
		})

		ws.endWarLocked(war, outcome, now)
	}
}

// EndWar forcefully ends a war with a given outcome (public API, thread-safe).
func (ws *WarSystem) EndWar(warID string, outcome WarOutcome) error {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	war, ok := ws.wars[warID]
	if !ok {
		return fmt.Errorf("war %s not found", warID)
	}

	if war.State == WarStateEnded {
		return fmt.Errorf("war %s already ended", warID)
	}

	ws.endWarLocked(war, outcome, time.Now())
	return nil
}

// endWarLocked ends a war (caller must hold ws.mu).
func (ws *WarSystem) endWarLocked(war *War, outcome WarOutcome, now time.Time) {
	war.State = WarStateEnded
	war.Outcome = outcome
	war.EndedAt = now

	// Set cooldowns for all participants
	cooldownEnd := now.Add(time.Duration(WarCooldownHours) * time.Hour)
	ws.cooldowns[war.Attacker] = cooldownEnd
	ws.cooldowns[war.Defender] = cooldownEnd
	for _, ally := range war.AttackerAllies {
		ws.cooldowns[ally] = cooldownEnd
	}
	for _, ally := range war.DefenderAllies {
		ws.cooldowns[ally] = cooldownEnd
	}

	slog.Info("war ended",
		"warId", war.ID,
		"outcome", outcome,
		"attackerScore", war.AttackerScore,
		"defenderScore", war.DefenderScore,
	)

	ws.emitEvent(WarEvent{
		Type:          WarEvtEnded,
		WarID:         war.ID,
		Attacker:      war.Attacker,
		Defender:      war.Defender,
		State:         WarStateEnded,
		Outcome:       outcome,
		AttackerScore: war.AttackerScore,
		DefenderScore: war.DefenderScore,
		Timestamp:     now,
	})
}

// AddWarScore adds war points to a side. scoreType: "kill", "capture", "defense".
func (ws *WarSystem) AddWarScore(warID string, nationality string, scoreType string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	war, ok := ws.wars[warID]
	if !ok || war.State != WarStateActive {
		return
	}

	var points int
	switch scoreType {
	case "kill":
		points = WarScoreKillPoints
	case "capture":
		points = WarScoreCapturePoints
	case "defense":
		points = WarScoreDefensePoints
	default:
		return
	}

	side := war.GetSide(nationality)
	switch side {
	case WarSideAttacker:
		war.AttackerScore += points
	case WarSideDefender:
		war.DefenderScore += points
	}

	ws.emitEvent(WarEvent{
		Type:          WarEvtScoreUpdate,
		WarID:         war.ID,
		Attacker:      war.Attacker,
		Defender:      war.Defender,
		State:         war.State,
		AttackerScore: war.AttackerScore,
		DefenderScore: war.DefenderScore,
		Timestamp:     time.Now(),
	})
}

// AddAlly adds an ally to the defender's side.
func (ws *WarSystem) AddAlly(warID string, ally string, side WarSide) error {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	war, ok := ws.wars[warID]
	if !ok {
		return fmt.Errorf("war %s not found", warID)
	}

	if war.State != WarStatePreparation && war.State != WarStateActive {
		return fmt.Errorf("cannot join war %s in state %s", warID, war.State)
	}

	// Check if already participating
	if war.IsParticipant(ally) {
		return fmt.Errorf("nation %s already in war %s", ally, warID)
	}

	switch side {
	case WarSideAttacker:
		war.AttackerAllies = append(war.AttackerAllies, ally)
	case WarSideDefender:
		war.DefenderAllies = append(war.DefenderAllies, ally)
	default:
		return fmt.Errorf("invalid side: %s", side)
	}

	ws.emitEvent(WarEvent{
		Type:      WarEvtAllyJoined,
		WarID:     war.ID,
		Attacker:  war.Attacker,
		Defender:  war.Defender,
		Coalition: []string{ally},
		State:     war.State,
		Timestamp: time.Now(),
	})

	slog.Info("ally joined war",
		"warId", war.ID,
		"ally", ally,
		"side", side,
	)

	return nil
}

// --- Public Getters (thread-safe) ---

// GetWar returns a war by ID.
func (ws *WarSystem) GetWar(warID string) *War {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	war, ok := ws.wars[warID]
	if !ok {
		return nil
	}
	// Return a copy
	warCopy := *war
	return &warCopy
}

// GetActiveWars returns all wars that are in preparation or active state.
func (ws *WarSystem) GetActiveWars() []*War {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	var active []*War
	for _, war := range ws.wars {
		if war.State == WarStatePreparation || war.State == WarStateActive {
			warCopy := *war
			active = append(active, &warCopy)
		}
	}
	return active
}

// GetWarForCountry returns the active war involving a country, if any.
func (ws *WarSystem) GetWarForCountry(countryCode string) *War {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	for _, war := range ws.wars {
		if war.State != WarStatePreparation && war.State != WarStateActive {
			continue
		}
		if war.IsParticipant(countryCode) {
			warCopy := *war
			return &warCopy
		}
	}
	return nil
}

// IsAtWar returns true if the country is currently in an active or preparing war.
func (ws *WarSystem) IsAtWar(countryCode string) bool {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	for _, war := range ws.wars {
		if (war.State == WarStatePreparation || war.State == WarStateActive) &&
			war.IsParticipant(countryCode) {
			return true
		}
	}
	return false
}

// IsOnCooldown returns true if the country is on war declaration cooldown.
func (ws *WarSystem) IsOnCooldown(countryCode string) bool {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	if cooldownEnd, ok := ws.cooldowns[countryCode]; ok {
		return time.Now().Before(cooldownEnd)
	}
	return false
}

// GetCooldownRemaining returns the remaining cooldown duration for a country.
func (ws *WarSystem) GetCooldownRemaining(countryCode string) time.Duration {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	if cooldownEnd, ok := ws.cooldowns[countryCode]; ok {
		remaining := time.Until(cooldownEnd)
		if remaining > 0 {
			return remaining
		}
	}
	return 0
}

// GetWarSide returns which side a nation is on in the war involving them.
func (ws *WarSystem) GetWarSide(nationality string) WarSide {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	for _, war := range ws.wars {
		if war.State != WarStateActive {
			continue
		}
		side := war.GetSide(nationality)
		if side != WarSideNeutral {
			return side
		}
	}
	return WarSideNeutral
}

// GetWarSnapshot returns a serializable snapshot for client transmission.
func (ws *WarSystem) GetWarSnapshot() []WarSnapshot {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	var snapshots []WarSnapshot
	for _, war := range ws.wars {
		if war.State == WarStateNone || war.State == WarStateEnded {
			continue
		}
		snapshots = append(snapshots, WarSnapshot{
			WarID:          war.ID,
			State:          war.State,
			Attacker:       war.Attacker,
			Defender:       war.Defender,
			AttackerAllies: war.AttackerAllies,
			DefenderAllies: war.DefenderAllies,
			AttackerScore:  war.AttackerScore,
			DefenderScore:  war.DefenderScore,
			DeclaredAt:     war.DeclaredAt.Unix(),
			ActivatedAt:    war.ActivatedAt.Unix(),
			FatiguePenalty: war.GetFatiguePenalty(),
		})
	}
	return snapshots
}

// WarSnapshot is a serializable snapshot of a war for client transmission.
type WarSnapshot struct {
	WarID          string   `json:"warId"`
	State          WarState `json:"state"`
	Attacker       string   `json:"attacker"`
	Defender       string   `json:"defender"`
	AttackerAllies []string `json:"attackerAllies,omitempty"`
	DefenderAllies []string `json:"defenderAllies,omitempty"`
	AttackerScore  int      `json:"attackerScore"`
	DefenderScore  int      `json:"defenderScore"`
	DeclaredAt     int64    `json:"declaredAt"`
	ActivatedAt    int64    `json:"activatedAt"`
	FatiguePenalty float64  `json:"fatiguePenalty"`
}

// Reset clears all war state.
func (ws *WarSystem) Reset() {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	ws.wars = make(map[string]*War)
	ws.cooldowns = make(map[string]time.Time)
	ws.warCounter = 0
}

func (ws *WarSystem) emitEvent(event WarEvent) {
	if ws.OnEvent != nil {
		ws.OnEvent(event)
	}
}
