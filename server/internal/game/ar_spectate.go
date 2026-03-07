package game

// ============================================================
// Arena Spectate System — Phase 6 (v18)
// ============================================================
//
// After death, players enter spectator mode:
//   - Camera follows another alive player
//   - Left/Right arrow keys to switch spectate target
//   - Auto-switches if target dies
//   - Returns to lobby after battle ends

// ── Spectate Types ──────────────────────────────────────────

// ARSpectateInput is the spectator's input for switching targets.
type ARSpectateInput struct {
	Direction int `json:"direction"` // -1 = prev, +1 = next
}

// ARSpectateState tracks a dead player's spectator state.
type ARSpectateState struct {
	PlayerID    string `json:"playerId"`    // the dead player
	TargetID    string `json:"targetId"`    // who they're watching
	TargetIndex int    `json:"-"`           // index in alive list
}

// ARSpectateManager manages spectator states for a battle.
type ARSpectateManager struct {
	spectators map[string]*ARSpectateState // playerID → state
}

// NewARSpectateManager creates a new spectate manager.
func NewARSpectateManager() *ARSpectateManager {
	return &ARSpectateManager{
		spectators: make(map[string]*ARSpectateState),
	}
}

// OnPlayerDeath adds a player to spectator mode.
// Automatically assigns the nearest alive player as target.
func (sm *ARSpectateManager) OnPlayerDeath(deadPlayerID string, players map[string]*ARPlayer) {
	// Find first alive player to spectate
	target := sm.findFirstAlive(players, deadPlayerID)
	if target == "" {
		return // no one to spectate
	}

	sm.spectators[deadPlayerID] = &ARSpectateState{
		PlayerID:    deadPlayerID,
		TargetID:    target,
		TargetIndex: 0,
	}
}

// OnSpectateInput handles left/right spectator target switching.
func (sm *ARSpectateManager) OnSpectateInput(playerID string, input ARSpectateInput, players map[string]*ARPlayer) {
	state, ok := sm.spectators[playerID]
	if !ok {
		return
	}

	aliveList := sm.getAliveList(players, playerID)
	if len(aliveList) == 0 {
		return
	}

	// Move index
	state.TargetIndex += input.Direction
	if state.TargetIndex < 0 {
		state.TargetIndex = len(aliveList) - 1
	} else if state.TargetIndex >= len(aliveList) {
		state.TargetIndex = 0
	}

	state.TargetID = aliveList[state.TargetIndex]
}

// ValidateTargets ensures all spectators are watching alive players.
// Should be called after cleanup/death events.
func (sm *ARSpectateManager) ValidateTargets(players map[string]*ARPlayer) {
	for specID, state := range sm.spectators {
		target, ok := players[state.TargetID]
		if !ok || !target.Alive {
			// Target died, switch to next alive player
			newTarget := sm.findFirstAlive(players, specID)
			if newTarget == "" {
				// No one left to spectate
				delete(sm.spectators, specID)
				continue
			}
			state.TargetID = newTarget
			state.TargetIndex = 0
		}
	}
}

// GetSpectateTarget returns the current spectate target for a player.
// Returns empty string if not spectating.
func (sm *ARSpectateManager) GetSpectateTarget(playerID string) string {
	state, ok := sm.spectators[playerID]
	if !ok {
		return ""
	}
	return state.TargetID
}

// IsSpectating returns true if the player is in spectator mode.
func (sm *ARSpectateManager) IsSpectating(playerID string) bool {
	_, ok := sm.spectators[playerID]
	return ok
}

// RemoveSpectator removes a player from spectator mode (e.g., on disconnect).
func (sm *ARSpectateManager) RemoveSpectator(playerID string) {
	delete(sm.spectators, playerID)
}

// GetAllSpectateStates returns all active spectator states for broadcasting.
func (sm *ARSpectateManager) GetAllSpectateStates() map[string]*ARSpectateState {
	return sm.spectators
}

// ── Internal Helpers ────────────────────────────────────────

// findFirstAlive finds the first alive player to spectate (excluding self).
func (sm *ARSpectateManager) findFirstAlive(players map[string]*ARPlayer, excludeID string) string {
	for id, p := range players {
		if id != excludeID && p.Alive {
			return id
		}
	}
	return ""
}

// getAliveList returns a stable-sorted list of alive player IDs (excluding self).
func (sm *ARSpectateManager) getAliveList(players map[string]*ARPlayer, excludeID string) []string {
	alive := make([]string, 0, len(players))
	for id, p := range players {
		if id != excludeID && p.Alive {
			alive = append(alive, id)
		}
	}
	// Simple sort for stable ordering
	for i := 0; i < len(alive); i++ {
		for j := i + 1; j < len(alive); j++ {
			if alive[j] < alive[i] {
				alive[i], alive[j] = alive[j], alive[i]
			}
		}
	}
	return alive
}

// ── Death Screen Data ───────────────────────────────────────

// ARDeathScreenData is sent to the client when a player dies.
type ARDeathScreenData struct {
	KillerID   string  `json:"killerId,omitempty"`   // who killed them (if PvP)
	KillerName string  `json:"killerName,omitempty"` // killer display name
	SurvivalTime float64 `json:"survivalTime"`        // how long they survived
	FinalLevel int     `json:"finalLevel"`
	Kills      int     `json:"kills"`
	PvPKills   int     `json:"pvpKills"`
	DamageDealt float64 `json:"damageDealt"`
	Rank       int     `json:"rank"`                 // current rank at time of death
	CanSpectate bool   `json:"canSpectate"`          // whether spectating is available
}

// BuildDeathScreenData creates death screen data for a player.
func BuildDeathScreenData(player *ARPlayer, killerID string, players map[string]*ARPlayer, totalTime float64) *ARDeathScreenData {
	data := &ARDeathScreenData{
		SurvivalTime: totalTime,
		FinalLevel:   player.Level,
		Kills:        player.Kills,
		PvPKills:     player.PvPKills,
		CanSpectate:  true,
	}

	if killerID != "" {
		data.KillerID = killerID
		if killer, ok := players[killerID]; ok {
			data.KillerName = killer.Name
		}
	}

	// Calculate rank (alive players + 1)
	aliveCount := 0
	for _, p := range players {
		if p.Alive {
			aliveCount++
		}
	}
	data.Rank = aliveCount + 1

	return data
}
