package game

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ============================================================
// v14 Phase 7 — S32: Cross-Arena Invasion
// During war, enemy arena entry allowed (capacity +20).
// War-specific scoring: kill×15, capture×30, defense×10.
// Attacker/defender color distinction (red/blue).
// Supply lines: capture point → respawn point change.
// War fatigue: -5% DPS/day after 72h.
// ============================================================

// CrossArenaRole defines a player's role in a cross-arena invasion.
type CrossArenaRole string

const (
	CrossArenaRoleNative   CrossArenaRole = "native"   // belongs to this country
	CrossArenaRoleInvader  CrossArenaRole = "invader"   // attacking from another country
	CrossArenaRoleDefender CrossArenaRole = "defender"   // ally defending this country
)

// CrossArenaPlayer tracks a player's war role in an arena.
type CrossArenaPlayer struct {
	ClientID    string         `json:"clientId"`
	Nationality string         `json:"nationality"`
	Role        CrossArenaRole `json:"role"`
	WarSide     WarSide        `json:"warSide"`
	WarID       string         `json:"warId"`
	JoinedAt    time.Time      `json:"joinedAt"`
}

// CrossArenaWarState tracks war-specific state for a country arena.
type CrossArenaWarState struct {
	Active         bool                `json:"active"`
	WarID          string              `json:"warId"`
	CountryCode    string              `json:"countryCode"`
	AttackerNation string              `json:"attackerNation"` // which nation is invading
	DefenderNation string              `json:"defenderNation"` // which nation is defending
	AttackerScore  int                 `json:"attackerScore"`
	DefenderScore  int                 `json:"defenderScore"`
	InvaderCount   int                 `json:"invaderCount"`
	DefenderCount  int                 `json:"defenderCount"`
	CapturedPoints []string            `json:"capturedPoints"` // IDs of captured strategic points
	FatiguePenalty float64             `json:"fatiguePenalty"`  // 0.0-0.5 DPS penalty
}

// CrossArenaManager manages cross-arena invasion during wars.
type CrossArenaManager struct {
	mu sync.RWMutex

	// War players per arena: countryCode → clientID → player info
	warPlayers map[string]map[string]*CrossArenaPlayer

	// War state per arena: countryCode → war state
	arenaWarState map[string]*CrossArenaWarState

	// Reference to the war system
	warSystem *WarSystem

	// Reference to the country arena manager
	arenaManager *CountryArenaManager

	// Event callback
	OnEvent func(event CrossArenaEvent)
}

// CrossArenaEvent describes cross-arena invasion events.
type CrossArenaEvent struct {
	Type        CrossArenaEventType `json:"type"`
	WarID       string              `json:"warId"`
	CountryCode string              `json:"countryCode"`
	ClientID    string              `json:"clientId,omitempty"`
	Nationality string              `json:"nationality,omitempty"`
	Role        CrossArenaRole      `json:"role,omitempty"`
	Score       int                 `json:"score,omitempty"`
	ScoreType   string              `json:"scoreType,omitempty"`
	Timestamp   time.Time           `json:"timestamp"`
}

// CrossArenaEventType classifies cross-arena events.
type CrossArenaEventType string

const (
	CrossEvtInvasionStarted  CrossArenaEventType = "invasion_started"
	CrossEvtInvasionEnded    CrossArenaEventType = "invasion_ended"
	CrossEvtInvaderJoined    CrossArenaEventType = "invader_joined"
	CrossEvtInvaderLeft      CrossArenaEventType = "invader_left"
	CrossEvtWarScoreChanged  CrossArenaEventType = "war_score_changed"
	CrossEvtPointCaptured    CrossArenaEventType = "point_captured"
	CrossEvtSupplyLineChange CrossArenaEventType = "supply_line_changed"
)

// NewCrossArenaManager creates a new cross-arena invasion manager.
func NewCrossArenaManager(warSystem *WarSystem, arenaManager *CountryArenaManager) *CrossArenaManager {
	return &CrossArenaManager{
		warPlayers:    make(map[string]map[string]*CrossArenaPlayer),
		arenaWarState: make(map[string]*CrossArenaWarState),
		warSystem:     warSystem,
		arenaManager:  arenaManager,
	}
}

// OnWarActivated is called when a war transitions to active state.
// Sets up cross-arena invasion for both countries.
func (cam *CrossArenaManager) OnWarActivated(warID, attacker, defender string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	now := time.Now()

	// Set up invasion state for the defender's arena (primary invasion target)
	cam.arenaWarState[defender] = &CrossArenaWarState{
		Active:         true,
		WarID:          warID,
		CountryCode:    defender,
		AttackerNation: attacker,
		DefenderNation: defender,
	}

	// Set up invasion state for the attacker's arena (counter-invasion possible)
	cam.arenaWarState[attacker] = &CrossArenaWarState{
		Active:         true,
		WarID:          warID,
		CountryCode:    attacker,
		AttackerNation: defender, // roles reversed in attacker's arena
		DefenderNation: attacker,
	}

	// Initialize war player maps
	if cam.warPlayers[defender] == nil {
		cam.warPlayers[defender] = make(map[string]*CrossArenaPlayer)
	}
	if cam.warPlayers[attacker] == nil {
		cam.warPlayers[attacker] = make(map[string]*CrossArenaPlayer)
	}

	slog.Info("cross-arena invasion activated",
		"warId", warID,
		"attacker", attacker,
		"defender", defender,
	)

	cam.emitEvent(CrossArenaEvent{
		Type:        CrossEvtInvasionStarted,
		WarID:       warID,
		CountryCode: defender,
		Timestamp:   now,
	})
	cam.emitEvent(CrossArenaEvent{
		Type:        CrossEvtInvasionStarted,
		WarID:       warID,
		CountryCode: attacker,
		Timestamp:   now,
	})
}

// OnWarEnded is called when a war ends. Removes all invaders from foreign arenas.
func (cam *CrossArenaManager) OnWarEnded(warID string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	now := time.Now()

	// Find and clean up all arenas involved in this war
	for countryCode, state := range cam.arenaWarState {
		if state.WarID != warID {
			continue
		}

		// Remove all invaders from this arena
		if players, ok := cam.warPlayers[countryCode]; ok {
			for clientID, player := range players {
				if player.Role == CrossArenaRoleInvader {
					slog.Info("removing invader on war end",
						"clientId", clientID,
						"country", countryCode,
					)
					delete(players, clientID)
				}
			}
		}

		// Clear war state
		state.Active = false

		cam.emitEvent(CrossArenaEvent{
			Type:        CrossEvtInvasionEnded,
			WarID:       warID,
			CountryCode: countryCode,
			Timestamp:   now,
		})
	}
}

// CanInvade checks if a player can enter an enemy arena during war.
func (cam *CrossArenaManager) CanInvade(clientNationality, targetCountry string) (bool, string, error) {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	state, ok := cam.arenaWarState[targetCountry]
	if !ok || !state.Active {
		return false, "", fmt.Errorf("no active war in %s", targetCountry)
	}

	// Check if the player's nation is an attacker in this arena's war
	war := cam.warSystem.GetWar(state.WarID)
	if war == nil {
		return false, "", fmt.Errorf("war %s not found", state.WarID)
	}

	side := war.GetSide(clientNationality)
	if side == WarSideNeutral {
		return false, "", fmt.Errorf("nation %s is not part of war %s", clientNationality, state.WarID)
	}

	// Check capacity with war bonus
	arena := cam.arenaManager.GetArena(targetCountry)
	if arena == nil {
		return false, "", fmt.Errorf("arena %s not found", targetCountry)
	}

	maxCapacity := 50 + WarCapacityBonus // 70 during war
	if arena.PlayerCount >= maxCapacity {
		return false, "", fmt.Errorf("arena %s at war capacity (%d/%d)", targetCountry, arena.PlayerCount, maxCapacity)
	}

	return true, state.WarID, nil
}

// RegisterInvader registers a player as an invader in an enemy arena.
func (cam *CrossArenaManager) RegisterInvader(clientID, nationality, targetCountry, warID string) error {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	state, ok := cam.arenaWarState[targetCountry]
	if !ok || !state.Active {
		return fmt.Errorf("no active war in %s", targetCountry)
	}

	if state.WarID != warID {
		return fmt.Errorf("war ID mismatch: expected %s, got %s", state.WarID, warID)
	}

	war := cam.warSystem.GetWar(warID)
	if war == nil {
		return fmt.Errorf("war %s not found", warID)
	}

	warSide := war.GetSide(nationality)
	role := CrossArenaRoleInvader

	// Determine if this is an invader or an allied defender
	if nationality == targetCountry {
		role = CrossArenaRoleNative
	} else if warSide == WarSideDefender && nationality != state.AttackerNation {
		role = CrossArenaRoleDefender
	}

	player := &CrossArenaPlayer{
		ClientID:    clientID,
		Nationality: nationality,
		Role:        role,
		WarSide:     warSide,
		WarID:       warID,
		JoinedAt:    time.Now(),
	}

	if cam.warPlayers[targetCountry] == nil {
		cam.warPlayers[targetCountry] = make(map[string]*CrossArenaPlayer)
	}
	cam.warPlayers[targetCountry][clientID] = player

	// Update counts
	switch role {
	case CrossArenaRoleInvader:
		state.InvaderCount++
	case CrossArenaRoleDefender:
		state.DefenderCount++
	}

	cam.emitEvent(CrossArenaEvent{
		Type:        CrossEvtInvaderJoined,
		WarID:       warID,
		CountryCode: targetCountry,
		ClientID:    clientID,
		Nationality: nationality,
		Role:        role,
		Timestamp:   time.Now(),
	})

	slog.Info("invader registered",
		"clientId", clientID,
		"nationality", nationality,
		"target", targetCountry,
		"role", role,
		"warSide", warSide,
	)

	return nil
}

// UnregisterInvader removes a player from cross-arena tracking.
func (cam *CrossArenaManager) UnregisterInvader(clientID, countryCode string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	players, ok := cam.warPlayers[countryCode]
	if !ok {
		return
	}

	player, exists := players[clientID]
	if !exists {
		return
	}

	// Update counts
	if state, ok := cam.arenaWarState[countryCode]; ok {
		switch player.Role {
		case CrossArenaRoleInvader:
			state.InvaderCount--
		case CrossArenaRoleDefender:
			state.DefenderCount--
		}
	}

	delete(players, clientID)

	cam.emitEvent(CrossArenaEvent{
		Type:        CrossEvtInvaderLeft,
		WarID:       player.WarID,
		CountryCode: countryCode,
		ClientID:    clientID,
		Nationality: player.Nationality,
		Role:        player.Role,
		Timestamp:   time.Now(),
	})
}

// OnWarKill processes a kill that happened in a war arena.
// Awards war-specific scoring points.
func (cam *CrossArenaManager) OnWarKill(countryCode, killerNationality, victimNationality string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	state, ok := cam.arenaWarState[countryCode]
	if !ok || !state.Active {
		return
	}

	war := cam.warSystem.GetWar(state.WarID)
	if war == nil {
		return
	}

	killerSide := war.GetSide(killerNationality)
	victimSide := war.GetSide(victimNationality)

	// Only count if they're on opposite sides
	if killerSide == victimSide || killerSide == WarSideNeutral || victimSide == WarSideNeutral {
		return
	}

	// Award kill points
	cam.warSystem.AddWarScore(state.WarID, killerNationality, "kill")

	// Update local arena war scores
	switch killerSide {
	case WarSideAttacker:
		state.AttackerScore += WarScoreKillPoints
	case WarSideDefender:
		state.DefenderScore += WarScoreKillPoints
	}

	cam.emitEvent(CrossArenaEvent{
		Type:        CrossEvtWarScoreChanged,
		WarID:       state.WarID,
		CountryCode: countryCode,
		Nationality: killerNationality,
		Score:       WarScoreKillPoints,
		ScoreType:   "kill",
		Timestamp:   time.Now(),
	})
}

// OnCapturePoint processes a strategic point capture during war.
func (cam *CrossArenaManager) OnCapturePoint(countryCode, capturerNationality, pointID string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	state, ok := cam.arenaWarState[countryCode]
	if !ok || !state.Active {
		return
	}

	war := cam.warSystem.GetWar(state.WarID)
	if war == nil {
		return
	}

	capturerSide := war.GetSide(capturerNationality)
	if capturerSide == WarSideNeutral {
		return
	}

	// Award capture points
	cam.warSystem.AddWarScore(state.WarID, capturerNationality, "capture")

	// Track captured point
	state.CapturedPoints = append(state.CapturedPoints, pointID)

	// Update local arena war scores
	switch capturerSide {
	case WarSideAttacker:
		state.AttackerScore += WarScoreCapturePoints
	case WarSideDefender:
		state.DefenderScore += WarScoreCapturePoints
	}

	cam.emitEvent(CrossArenaEvent{
		Type:        CrossEvtPointCaptured,
		WarID:       state.WarID,
		CountryCode: countryCode,
		Nationality: capturerNationality,
		Score:       WarScoreCapturePoints,
		ScoreType:   "capture",
		Timestamp:   time.Now(),
	})

	slog.Info("war point captured",
		"warId", state.WarID,
		"country", countryCode,
		"capturer", capturerNationality,
		"side", capturerSide,
		"pointId", pointID,
	)
}

// OnDefenseAction processes a successful defense action during war.
func (cam *CrossArenaManager) OnDefenseAction(countryCode, defenderNationality string) {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	state, ok := cam.arenaWarState[countryCode]
	if !ok || !state.Active {
		return
	}

	cam.warSystem.AddWarScore(state.WarID, defenderNationality, "defense")

	war := cam.warSystem.GetWar(state.WarID)
	if war == nil {
		return
	}

	side := war.GetSide(defenderNationality)
	switch side {
	case WarSideAttacker:
		state.AttackerScore += WarScoreDefensePoints
	case WarSideDefender:
		state.DefenderScore += WarScoreDefensePoints
	}
}

// GetPlayerWarRole returns the cross-arena role for a player in a given arena.
func (cam *CrossArenaManager) GetPlayerWarRole(clientID, countryCode string) (CrossArenaRole, WarSide) {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	players, ok := cam.warPlayers[countryCode]
	if !ok {
		return CrossArenaRoleNative, WarSideNeutral
	}

	player, exists := players[clientID]
	if !exists {
		return CrossArenaRoleNative, WarSideNeutral
	}

	return player.Role, player.WarSide
}

// GetArenaWarState returns the war state for a specific arena.
func (cam *CrossArenaManager) GetArenaWarState(countryCode string) *CrossArenaWarState {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	state, ok := cam.arenaWarState[countryCode]
	if !ok {
		return nil
	}
	// Return a copy
	stateCopy := *state
	return &stateCopy
}

// IsArenaAtWar returns true if the arena has an active invasion.
func (cam *CrossArenaManager) IsArenaAtWar(countryCode string) bool {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	state, ok := cam.arenaWarState[countryCode]
	return ok && state.Active
}

// GetFatiguePenaltyForArena returns the DPS fatigue penalty for an arena's war.
func (cam *CrossArenaManager) GetFatiguePenaltyForArena(countryCode string) float64 {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	state, ok := cam.arenaWarState[countryCode]
	if !ok || !state.Active {
		return 0
	}

	war := cam.warSystem.GetWar(state.WarID)
	if war == nil {
		return 0
	}

	return war.GetFatiguePenalty()
}

// UpdateFatigue updates the fatigue penalty for all active war arenas.
func (cam *CrossArenaManager) UpdateFatigue() {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	for _, state := range cam.arenaWarState {
		if !state.Active {
			continue
		}
		war := cam.warSystem.GetWar(state.WarID)
		if war != nil {
			state.FatiguePenalty = war.GetFatiguePenalty()
		}
	}
}

// GetWarArenaSnapshot returns a serializable snapshot for client transmission.
func (cam *CrossArenaManager) GetWarArenaSnapshot(countryCode string) *CrossArenaWarSnapshot {
	cam.mu.RLock()
	defer cam.mu.RUnlock()

	state, ok := cam.arenaWarState[countryCode]
	if !ok || !state.Active {
		return nil
	}

	return &CrossArenaWarSnapshot{
		Active:         state.Active,
		WarID:          state.WarID,
		CountryCode:    state.CountryCode,
		AttackerNation: state.AttackerNation,
		DefenderNation: state.DefenderNation,
		AttackerScore:  state.AttackerScore,
		DefenderScore:  state.DefenderScore,
		InvaderCount:   state.InvaderCount,
		DefenderCount:  state.DefenderCount,
		CapturedPoints: state.CapturedPoints,
		FatiguePenalty: state.FatiguePenalty,
	}
}

// CrossArenaWarSnapshot is a serializable snapshot for clients.
type CrossArenaWarSnapshot struct {
	Active         bool     `json:"active"`
	WarID          string   `json:"warId"`
	CountryCode    string   `json:"countryCode"`
	AttackerNation string   `json:"attackerNation"`
	DefenderNation string   `json:"defenderNation"`
	AttackerScore  int      `json:"attackerScore"`
	DefenderScore  int      `json:"defenderScore"`
	InvaderCount   int      `json:"invaderCount"`
	DefenderCount  int      `json:"defenderCount"`
	CapturedPoints []string `json:"capturedPoints,omitempty"`
	FatiguePenalty float64  `json:"fatiguePenalty"`
}

// Reset clears all cross-arena state.
func (cam *CrossArenaManager) Reset() {
	cam.mu.Lock()
	defer cam.mu.Unlock()

	cam.warPlayers = make(map[string]map[string]*CrossArenaPlayer)
	cam.arenaWarState = make(map[string]*CrossArenaWarState)
}

func (cam *CrossArenaManager) emitEvent(event CrossArenaEvent) {
	if cam.OnEvent != nil {
		cam.OnEvent(event)
	}
}
