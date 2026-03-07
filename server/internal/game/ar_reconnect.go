package game

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// ============================================================
// Arena Reconnect System — Phase 7
// ============================================================
//
// Allows players to reconnect within 30 seconds of disconnection.
// Server preserves player state (HP, level, build, position) and
// issues a reconnect token for identity verification.

// ── Constants ────────────────────────────────────────────────

const (
	// ReconnectWindowSec is the maximum time a player can be disconnected
	// before their state is purged.
	ReconnectWindowSec = 30

	// ReconnectTokenLen is the byte length of the reconnect token.
	ReconnectTokenLen = 16

	// ReconnectCleanupInterval is how often expired entries are swept.
	ReconnectCleanupInterval = 5 * time.Second
)

// ── Reconnect Entry ──────────────────────────────────────────

// ARReconnectEntry stores a disconnected player's state.
type ARReconnectEntry struct {
	// Identity
	PlayerID     string `json:"playerId"`
	Token        string `json:"token"`        // hex-encoded reconnect token
	RoomID       string `json:"roomId"`
	CountryISO3  string `json:"countryIso3"`

	// Preserved player state (snapshot at disconnect)
	PlayerState *ARPlayer `json:"-"`

	// Timing
	DisconnectAt time.Time `json:"disconnectAt"`
	ExpiresAt    time.Time `json:"expiresAt"`

	// Whether the entry has been consumed (player reconnected)
	Consumed bool `json:"-"`
}

// IsExpired returns true if the reconnect window has elapsed.
func (e *ARReconnectEntry) IsExpired() bool {
	return time.Now().After(e.ExpiresAt)
}

// ── Reconnect Manager ────────────────────────────────────────

// ARReconnectManager manages disconnected player states.
type ARReconnectManager struct {
	mu      sync.RWMutex
	entries map[string]*ARReconnectEntry // keyed by playerID

	// Token → playerID lookup for fast validation
	tokenIndex map[string]string

	// Cleanup
	stopCh chan struct{}
}

// NewARReconnectManager creates a new reconnect manager.
func NewARReconnectManager() *ARReconnectManager {
	rm := &ARReconnectManager{
		entries:    make(map[string]*ARReconnectEntry),
		tokenIndex: make(map[string]string),
		stopCh:     make(chan struct{}),
	}

	go rm.cleanupLoop()
	return rm
}

// Stop terminates the cleanup goroutine.
func (rm *ARReconnectManager) Stop() {
	close(rm.stopCh)
}

// cleanupLoop periodically removes expired entries.
func (rm *ARReconnectManager) cleanupLoop() {
	ticker := time.NewTicker(ReconnectCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-rm.stopCh:
			return
		case <-ticker.C:
			rm.cleanup()
		}
	}
}

func (rm *ARReconnectManager) cleanup() {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for pid, entry := range rm.entries {
		if entry.IsExpired() || entry.Consumed {
			delete(rm.tokenIndex, entry.Token)
			delete(rm.entries, pid)
		}
	}
}

// ── Public API ───────────────────────────────────────────────

// OnDisconnect preserves a player's state for potential reconnection.
// Returns the reconnect token that the client should use to reconnect.
func (rm *ARReconnectManager) OnDisconnect(
	playerID string,
	roomID string,
	countryISO3 string,
	player *ARPlayer,
) string {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Generate reconnect token
	token := generateReconnectToken()
	now := time.Now()

	// Deep copy player state to prevent mutations
	snapshot := snapshotPlayer(player)

	entry := &ARReconnectEntry{
		PlayerID:     playerID,
		Token:        token,
		RoomID:       roomID,
		CountryISO3:  countryISO3,
		PlayerState:  snapshot,
		DisconnectAt: now,
		ExpiresAt:    now.Add(ReconnectWindowSec * time.Second),
	}

	// Remove any existing entry for this player
	if old, ok := rm.entries[playerID]; ok {
		delete(rm.tokenIndex, old.Token)
	}

	rm.entries[playerID] = entry
	rm.tokenIndex[token] = playerID

	return token
}

// ValidateReconnect checks if a reconnect token is valid and returns
// the preserved player state. Returns nil if invalid or expired.
func (rm *ARReconnectManager) ValidateReconnect(token string) *ARReconnectEntry {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	playerID, ok := rm.tokenIndex[token]
	if !ok {
		return nil
	}

	entry, ok := rm.entries[playerID]
	if !ok || entry.IsExpired() || entry.Consumed {
		return nil
	}

	return entry
}

// ConsumeReconnect marks a reconnect entry as consumed and returns
// the preserved player state. The entry is removed from the manager.
func (rm *ARReconnectManager) ConsumeReconnect(token string) *ARReconnectEntry {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	playerID, ok := rm.tokenIndex[token]
	if !ok {
		return nil
	}

	entry, ok := rm.entries[playerID]
	if !ok || entry.IsExpired() || entry.Consumed {
		return nil
	}

	entry.Consumed = true
	delete(rm.tokenIndex, token)
	delete(rm.entries, playerID)

	return entry
}

// HasPendingReconnect checks if a player has a valid reconnect entry.
func (rm *ARReconnectManager) HasPendingReconnect(playerID string) bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	entry, ok := rm.entries[playerID]
	return ok && !entry.IsExpired() && !entry.Consumed
}

// GetPendingCount returns the number of pending reconnect entries.
func (rm *ARReconnectManager) GetPendingCount() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	count := 0
	for _, e := range rm.entries {
		if !e.IsExpired() && !e.Consumed {
			count++
		}
	}
	return count
}

// ── Helpers ──────────────────────────────────────────────────

// generateReconnectToken creates a cryptographically random token.
func generateReconnectToken() string {
	b := make([]byte, ReconnectTokenLen)
	_, err := rand.Read(b)
	if err != nil {
		// Fallback: use timestamp-based token (less secure but functional)
		return hex.EncodeToString([]byte(time.Now().String()[:ReconnectTokenLen]))
	}
	return hex.EncodeToString(b)
}

// snapshotPlayer creates a deep copy of player state for preservation.
func snapshotPlayer(p *ARPlayer) *ARPlayer {
	if p == nil {
		return nil
	}

	snap := &ARPlayer{
		ID:              p.ID,
		Name:            p.Name,
		Pos:             p.Pos,
		Rotation:        p.Rotation,
		HP:              p.HP,
		MaxHP:           p.MaxHP,
		Level:           p.Level,
		XP:              p.XP,
		XPToNext:        p.XPToNext,
		Alive:           p.Alive,
		Character:       p.Character,
		FactionID:       p.FactionID,
		Kills:           p.Kills,
		Stamina:         p.Stamina,
		MaxStamina:      p.MaxStamina,
		DamageMult:      p.DamageMult,
		AttackSpeedMult: p.AttackSpeedMult,
		CritChance:      p.CritChance,
		CritDamageMult:  p.CritDamageMult,
		AreaMult:        p.AreaMult,
		SpeedMult:       p.SpeedMult,
		DodgeChance:     p.DodgeChance,
		MagnetRange:     p.MagnetRange,
		XPMult:          p.XPMult,
		ProjectileExtra: p.ProjectileExtra,
		PierceExtra:     p.PierceExtra,
		KnockbackMult:   p.KnockbackMult,
		ThornsPct:       p.ThornsPct,
		LifestealPct:    p.LifestealPct,
		PvPKills:        p.PvPKills,
	}

	// Deep copy tomes
	snap.Tomes = make(map[ARTomeID]int, len(p.Tomes))
	for k, v := range p.Tomes {
		snap.Tomes[k] = v
	}

	// Deep copy weapon slots
	snap.WeaponSlots = make([]string, len(p.WeaponSlots))
	copy(snap.WeaponSlots, p.WeaponSlots)

	// Deep copy weapon instances
	snap.Weapons = make([]*ARWeaponInstance, len(p.Weapons))
	for i, w := range p.Weapons {
		snap.Weapons[i] = &ARWeaponInstance{
			WeaponID: w.WeaponID,
			Level:    w.Level,
			Cooldown: w.Cooldown,
		}
	}

	// Deep copy equipment
	snap.Equipment = make([]ARItemID, len(p.Equipment))
	copy(snap.Equipment, p.Equipment)

	// Deep copy status effects
	snap.StatusEffects = make([]ARStatusInstance, len(p.StatusEffects))
	copy(snap.StatusEffects, p.StatusEffects)

	// Deep copy synergies
	snap.ActiveSynergies = make([]ARSynergyID, len(p.ActiveSynergies))
	copy(snap.ActiveSynergies, p.ActiveSynergies)

	return snap
}

// RestorePlayerToArena restores a reconnected player's state into the
// arena combat instance. Returns true if successful.
func RestorePlayerToArena(ac *ArenaCombat, entry *ARReconnectEntry) bool {
	if ac == nil || entry == nil || entry.PlayerState == nil {
		return false
	}

	player := entry.PlayerState

	// Ensure the player is marked alive (they were alive when disconnected)
	// Add grace period for reconnect
	player.GraceTicks = int(5 * TickRate) // 5 seconds of invulnerability on reconnect

	// Clear velocity (player needs to send new input)
	player.Vel = ARVec3{}

	// Reset pending level-up (re-trigger if needed)
	player.PendingLevelUp = false
	player.LevelUpChoices = nil

	// Add back to arena
	ac.players[player.ID] = player

	return true
}

// ── Room Integration ─────────────────────────────────────────

// HandleARDisconnect preserves player state when they disconnect mid-battle.
// Called from Room when a player's WebSocket connection drops.
func (r *Room) HandleARDisconnect(clientID string, reconnectMgr *ARReconnectManager) string {
	if r.arState == nil || r.arState.Combat == nil || reconnectMgr == nil {
		return ""
	}

	ac := r.arState.Combat
	player, ok := ac.players[clientID]
	if !ok || !player.Alive {
		return ""
	}

	// Preserve state
	token := reconnectMgr.OnDisconnect(
		clientID,
		r.ID,
		r.Config.CountryISO3,
		player,
	)

	// Remove from active combat (will be restored on reconnect)
	ac.OnPlayerLeave(clientID)

	return token
}

// HandleARReconnect restores a player to their arena after reconnection.
func (r *Room) HandleARReconnect(reconnectMgr *ARReconnectManager, token string) bool {
	if r.arState == nil || r.arState.Combat == nil || reconnectMgr == nil {
		return false
	}

	entry := reconnectMgr.ConsumeReconnect(token)
	if entry == nil {
		return false
	}

	// Verify room matches
	if entry.RoomID != r.ID {
		return false
	}

	return RestorePlayerToArena(r.arState.Combat, entry)
}
