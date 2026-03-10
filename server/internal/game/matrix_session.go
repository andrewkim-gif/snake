package game

import (
	"sync"
	"time"
)

// ============================================================
// v33 Phase 1 — PlayerSession: Per-player state tracking for
// Online Matrix arena. Tracks HP, level, weapons, position,
// kills, damage, and alive status on the server side.
// ============================================================

// MatrixPlayerState represents the serializable state of a player session.
type MatrixPlayerState struct {
	ClientID     string   `json:"id"`
	Name         string   `json:"name"`
	Nationality  string   `json:"nation"`
	X            float64  `json:"x"`
	Y            float64  `json:"y"`
	Angle        float64  `json:"angle"`
	HP           int      `json:"hp"`
	MaxHP        int      `json:"maxHp"`
	Level        int      `json:"level"`
	Kills        int      `json:"kills"`
	Deaths       int      `json:"deaths"`
	TotalDamage  float64  `json:"totalDamage"`
	Weapons      []string `json:"weapons"`
	StatusEffects []string `json:"status"`
	Alive        bool     `json:"alive"`
	IsAlly       bool     `json:"isAlly"` // computed per-viewer
}

// PlayerSession manages per-player state within an OnlineMatrixEngine.
// Thread-safe via the engine's mutex — individual sessions are accessed
// under the engine lock.
type PlayerSession struct {
	// Identity
	ClientID    string
	Name        string
	Nationality string

	// Position & orientation
	X     float64
	Y     float64
	Angle float64

	// Health
	HP    int
	MaxHP int

	// Progression
	Level   int
	XP      int
	Kills   int
	Deaths  int
	Assists int

	// Combat
	TotalDamage   float64
	Weapons       []string
	StatusEffects []string

	// State
	Alive        bool
	IsAgent      bool
	IsDirectPlay bool

	// Token economy
	TokenBalance float64
	Buffs        TokenBuffs

	// Timing
	JoinedAt  time.Time
	LastTick  uint64
	LastInput time.Time

	// Anti-cheat: last known position for speed validation
	LastX float64
	LastY float64
}

// NewPlayerSession creates a new player session with default starting state.
func NewPlayerSession(clientID, name, nationality string, isAgent, isDirectPlay bool) *PlayerSession {
	now := time.Now()
	return &PlayerSession{
		ClientID:      clientID,
		Name:          name,
		Nationality:   nationality,
		X:             0,
		Y:             0,
		HP:            100,
		MaxHP:         100,
		Level:         1,
		Kills:         0,
		Deaths:        0,
		TotalDamage:   0,
		Weapons:       make([]string, 0, 4),
		StatusEffects: make([]string, 0, 4),
		Alive:         true,
		IsAgent:       isAgent,
		IsDirectPlay:  isDirectPlay,
		JoinedAt:      now,
		LastInput:     now,
		Buffs:         NoTokenBuff(),
	}
}

// UpdatePosition updates the player's position from client input.
// Returns the distance moved for speed validation.
func (ps *PlayerSession) UpdatePosition(x, y, angle float64, tick uint64) float64 {
	dx := x - ps.LastX
	dy := y - ps.LastY
	dist := dx*dx + dy*dy // squared distance (avoid sqrt for perf)

	ps.LastX = ps.X
	ps.LastY = ps.Y
	ps.X = x
	ps.Y = y
	ps.Angle = angle
	ps.LastTick = tick
	ps.LastInput = time.Now()

	return dist
}

// RecordKill increments the kill counter.
func (ps *PlayerSession) RecordKill() {
	ps.Kills++
}

// RecordDeath marks the player as dead and increments deaths.
func (ps *PlayerSession) RecordDeath() {
	ps.Alive = false
	ps.Deaths++
}

// RecordDamage adds dealt damage to the total.
func (ps *PlayerSession) RecordDamage(amount float64) {
	if amount > 0 {
		ps.TotalDamage += amount
	}
}

// AddWeapon adds a weapon to the player's loadout.
func (ps *PlayerSession) AddWeapon(weaponID string) {
	ps.Weapons = append(ps.Weapons, weaponID)
}

// AddStatusEffect adds a status effect.
func (ps *PlayerSession) AddStatusEffect(effect string) {
	ps.StatusEffects = append(ps.StatusEffects, effect)
}

// RemoveStatusEffect removes a status effect.
func (ps *PlayerSession) RemoveStatusEffect(effect string) {
	for i, e := range ps.StatusEffects {
		if e == effect {
			ps.StatusEffects = append(ps.StatusEffects[:i], ps.StatusEffects[i+1:]...)
			return
		}
	}
}

// LevelUp increments the player's level.
func (ps *PlayerSession) LevelUp() {
	ps.Level++
}

// ApplyBuffs sets the token-based buffs for this player.
func (ps *PlayerSession) ApplyBuffs(buffs TokenBuffs) {
	ps.Buffs = buffs
}

// GetSurvivalSeconds returns the number of seconds the player has been alive.
func (ps *PlayerSession) GetSurvivalSeconds() float64 {
	return time.Since(ps.JoinedAt).Seconds()
}

// GetMatrixScore computes the player's Matrix score using the v33 formula:
// kills×15 + level×10 + damage×0.5 + (survived ? 100 : 0)
func (ps *PlayerSession) GetMatrixScore() int {
	score := ps.Kills*MatrixScorePerKill +
		ps.Level*MatrixScorePerLevel +
		int(ps.TotalDamage*MatrixScorePerDamage)
	if ps.Alive {
		score += MatrixScoreSurvivalBonus
	}
	return score
}

// ToState converts the session to a serializable MatrixPlayerState.
func (ps *PlayerSession) ToState() MatrixPlayerState {
	weapons := make([]string, len(ps.Weapons))
	copy(weapons, ps.Weapons)
	status := make([]string, len(ps.StatusEffects))
	copy(status, ps.StatusEffects)

	return MatrixPlayerState{
		ClientID:      ps.ClientID,
		Name:          ps.Name,
		Nationality:   ps.Nationality,
		X:             ps.X,
		Y:             ps.Y,
		Angle:         ps.Angle,
		HP:            ps.HP,
		MaxHP:         ps.MaxHP,
		Level:         ps.Level,
		Kills:         ps.Kills,
		Deaths:        ps.Deaths,
		TotalDamage:   ps.TotalDamage,
		Weapons:       weapons,
		StatusEffects: status,
		Alive:         ps.Alive,
	}
}

// Reset resets the player session for a new epoch while preserving identity.
func (ps *PlayerSession) Reset() {
	ps.X = 0
	ps.Y = 0
	ps.HP = ps.MaxHP
	ps.Level = 1
	ps.XP = 0
	ps.Kills = 0
	ps.Deaths = 0
	ps.Assists = 0
	ps.TotalDamage = 0
	ps.Weapons = ps.Weapons[:0]
	ps.StatusEffects = ps.StatusEffects[:0]
	ps.Alive = true
	ps.JoinedAt = time.Now()
}

// ============================================================
// PlayerSessionManager — manages all sessions for an arena
// ============================================================

// PlayerSessionManager manages all player sessions for a single arena.
type PlayerSessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*PlayerSession
}

// NewPlayerSessionManager creates a new session manager.
func NewPlayerSessionManager() *PlayerSessionManager {
	return &PlayerSessionManager{
		sessions: make(map[string]*PlayerSession),
	}
}

// Add creates and registers a new player session.
func (m *PlayerSessionManager) Add(clientID, name, nationality string, isAgent, isDirectPlay bool) *PlayerSession {
	m.mu.Lock()
	defer m.mu.Unlock()

	session := NewPlayerSession(clientID, name, nationality, isAgent, isDirectPlay)
	m.sessions[clientID] = session
	return session
}

// Remove removes a player session.
func (m *PlayerSessionManager) Remove(clientID string) *PlayerSession {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, ok := m.sessions[clientID]
	if !ok {
		return nil
	}
	delete(m.sessions, clientID)
	return session
}

// Get returns a player session by ID.
func (m *PlayerSessionManager) Get(clientID string) *PlayerSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[clientID]
}

// GetAll returns a snapshot of all sessions.
func (m *PlayerSessionManager) GetAll() map[string]*PlayerSession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	snapshot := make(map[string]*PlayerSession, len(m.sessions))
	for k, v := range m.sessions {
		snapshot[k] = v
	}
	return snapshot
}

// Count returns the number of active sessions.
func (m *PlayerSessionManager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// GetAllStates returns serializable states for all alive players.
func (m *PlayerSessionManager) GetAllStates() []MatrixPlayerState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	states := make([]MatrixPlayerState, 0, len(m.sessions))
	for _, s := range m.sessions {
		states = append(states, s.ToState())
	}
	return states
}

// ResetAll resets all sessions for a new epoch.
func (m *PlayerSessionManager) ResetAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, s := range m.sessions {
		s.Reset()
	}
}

// GetNationPlayerCounts returns the number of players per nationality.
func (m *PlayerSessionManager) GetNationPlayerCounts() map[string]int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	counts := make(map[string]int)
	for _, s := range m.sessions {
		if s.Nationality != "" {
			counts[s.Nationality]++
		}
	}
	return counts
}
