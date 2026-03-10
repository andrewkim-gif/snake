package game

import (
	"fmt"
	"log/slog"
	"math"
	"sync"
)

// ============================================================
// v33 Phase 1 — KillValidator: Server-authoritative anti-cheat
// validation for kill and damage reports from Matrix clients.
//
// 6-step validation pipeline:
//   1. Tick validation (client/server tick within 250ms)
//   2. Distance validation (weapon range × 1.2 tolerance)
//   3. Cooldown validation (weapon fire rate)
//   4. Damage cap validation (weapon max damage × 1.1 tolerance)
//   5. State validation (both players alive)
//   6. PvP phase validation (war/shrink phase, different nations)
//
// Suspicion score accumulates on rejected kills.
// At threshold (10), player is auto-kicked and banned 24h.
// ============================================================

// Kill validation constants
const (
	// MaxTickDelta is the max allowed tick difference between client and server (250ms @ 20Hz).
	MaxTickDelta = 5

	// DistanceTolerance is the multiplier on weapon range for network latency tolerance.
	DistanceTolerance = 1.2

	// DamageTolerance is the multiplier on weapon max damage for floating-point tolerance.
	DamageTolerance = 1.1

	// SuspicionBanThreshold is the suspicion score at which a player is auto-banned.
	SuspicionBanThreshold = 10

	// SuspicionKickThreshold is the suspicion score at which a player gets a warning.
	SuspicionKickThreshold = 5
)

// KillRejectReason classifies why a kill was rejected.
type KillRejectReason string

const (
	RejectTickMismatch  KillRejectReason = "tick_mismatch"
	RejectDistance       KillRejectReason = "distance"
	RejectCooldown      KillRejectReason = "cooldown"
	RejectDamageExceeded KillRejectReason = "damage_exceeded"
	RejectInvalidState  KillRejectReason = "invalid_state"
	RejectPvPDisabled   KillRejectReason = "pvp_disabled"
	RejectSameNation    KillRejectReason = "same_nation"
	RejectUnknownWeapon KillRejectReason = "unknown_weapon"
	RejectUnknownTarget KillRejectReason = "unknown_target"
)

// KillReport is the payload received from a client reporting a kill.
type KillReport struct {
	KillerID string  `json:"killerId"`
	TargetID string  `json:"targetId"`
	WeaponID string  `json:"weaponId"`
	Damage   float64 `json:"damage"`
	Distance float64 `json:"distance"`
	Tick     uint64  `json:"tick"`
}

// DamageReport is the payload received from a client reporting PvP damage.
type DamageReport struct {
	AttackerID string  `json:"attackerId"`
	TargetID   string  `json:"targetId"`
	WeaponID   string  `json:"weaponId"`
	Damage     float64 `json:"damage"`
	Tick       uint64  `json:"tick"`
}

// KillValidationResult holds the result of a kill validation.
type KillValidationResult struct {
	Valid       bool             `json:"valid"`
	Reason      KillRejectReason `json:"reason,omitempty"`
	Score       int              `json:"score,omitempty"`
	Suspicion   int              `json:"suspicion,omitempty"`
	ShouldBan   bool             `json:"shouldBan,omitempty"`
	ShouldKick  bool             `json:"shouldKick,omitempty"`
}

// WeaponSpec defines server-authoritative weapon properties for validation.
type WeaponSpec struct {
	ID           string  `json:"id"`
	Range        float64 `json:"range"`        // max range in pixels
	CooldownTick int     `json:"cooldownTick"` // cooldown in ticks (20Hz)
	MaxDamage    float64 `json:"maxDamage"`    // maximum damage per hit
}

// DefaultWeaponSpecs returns the server-authoritative weapon specifications.
// These are the source of truth for kill validation.
func DefaultWeaponSpecs() map[string]WeaponSpec {
	return map[string]WeaponSpec{
		"cannon": {ID: "cannon", Range: 200, CooldownTick: 30, MaxDamage: 45},
		"laser":  {ID: "laser", Range: 300, CooldownTick: 40, MaxDamage: 30},
		"orb":    {ID: "orb", Range: 120, CooldownTick: 10, MaxDamage: 20},
		"melee":  {ID: "melee", Range: 60, CooldownTick: 5, MaxDamage: 55},
		"rocket": {ID: "rocket", Range: 250, CooldownTick: 60, MaxDamage: 80},
		"chain":  {ID: "chain", Range: 150, CooldownTick: 20, MaxDamage: 25},
		"aura":   {ID: "aura", Range: 80, CooldownTick: 3, MaxDamage: 15},
		"sniper": {ID: "sniper", Range: 400, CooldownTick: 80, MaxDamage: 100},
		"shotgun": {ID: "shotgun", Range: 100, CooldownTick: 25, MaxDamage: 60},
		"flame":  {ID: "flame", Range: 90, CooldownTick: 2, MaxDamage: 10},
	}
}

// KillValidator validates kill and damage reports from Matrix clients.
type KillValidator struct {
	mu sync.RWMutex

	// Weapon specifications (server-authoritative)
	weaponSpecs map[string]WeaponSpec

	// Per-player suspicion scores
	suspicionScores map[string]int

	// Per-player weapon cooldown tracking: playerID → weaponID → lastFireTick
	lastFireTicks map[string]map[string]uint64

	// Banned players (playerID → ban reason)
	bannedPlayers map[string]string

	// Stats
	totalValidated int
	totalAccepted  int
	totalRejected  int
}

// NewKillValidator creates a new kill validator with default weapon specs.
func NewKillValidator() *KillValidator {
	return &KillValidator{
		weaponSpecs:     DefaultWeaponSpecs(),
		suspicionScores: make(map[string]int),
		lastFireTicks:   make(map[string]map[string]uint64),
		bannedPlayers:   make(map[string]string),
	}
}

// ValidateKill runs the 6-step validation pipeline on a kill report.
func (kv *KillValidator) ValidateKill(
	report KillReport,
	serverTick uint64,
	killer *PlayerSession,
	target *PlayerSession,
	pvpEnabled bool,
	allyNations map[string]bool, // nations allied with the killer
) KillValidationResult {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	kv.totalValidated++

	// Pre-check: is killer banned?
	if _, banned := kv.bannedPlayers[report.KillerID]; banned {
		return KillValidationResult{Valid: false, Reason: RejectInvalidState}
	}

	// Step 1: Tick validation — |server_tick - client_tick| < MaxTickDelta
	if serverTick > report.Tick && serverTick-report.Tick > MaxTickDelta {
		return kv.reject(report.KillerID, RejectTickMismatch)
	}
	if report.Tick > serverTick && report.Tick-serverTick > MaxTickDelta {
		return kv.reject(report.KillerID, RejectTickMismatch)
	}

	// Step 2: Weapon lookup
	weapon, ok := kv.weaponSpecs[report.WeaponID]
	if !ok {
		return kv.reject(report.KillerID, RejectUnknownWeapon)
	}

	// Step 3: Distance validation
	// Compute actual server-side distance between killer and target positions
	dx := killer.X - target.X
	dy := killer.Y - target.Y
	serverDist := math.Sqrt(dx*dx + dy*dy)
	maxAllowedDist := weapon.Range * DistanceTolerance
	if serverDist > maxAllowedDist {
		return kv.reject(report.KillerID, RejectDistance)
	}

	// Step 4: Cooldown validation
	playerCooldowns, exists := kv.lastFireTicks[report.KillerID]
	if exists {
		if lastFire, fired := playerCooldowns[report.WeaponID]; fired {
			if serverTick-lastFire < uint64(weapon.CooldownTick) {
				return kv.reject(report.KillerID, RejectCooldown)
			}
		}
	}

	// Step 5: Damage cap validation
	maxAllowedDmg := weapon.MaxDamage * DamageTolerance
	if report.Damage > maxAllowedDmg {
		return kv.reject(report.KillerID, RejectDamageExceeded)
	}

	// Step 6a: State validation — both must be alive
	if killer == nil || target == nil {
		return kv.reject(report.KillerID, RejectUnknownTarget)
	}
	if !killer.Alive || !target.Alive {
		return kv.reject(report.KillerID, RejectInvalidState)
	}

	// Step 6b: PvP phase validation
	if !pvpEnabled {
		return kv.reject(report.KillerID, RejectPvPDisabled)
	}

	// Step 6c: Nation check — cannot kill same nation or allies
	if killer.Nationality == target.Nationality {
		return kv.reject(report.KillerID, RejectSameNation)
	}
	if allyNations != nil && allyNations[target.Nationality] {
		return kv.reject(report.KillerID, RejectSameNation)
	}

	// All checks passed — record fire tick and accept
	if playerCooldowns == nil {
		playerCooldowns = make(map[string]uint64)
		kv.lastFireTicks[report.KillerID] = playerCooldowns
	}
	playerCooldowns[report.WeaponID] = serverTick

	kv.totalAccepted++

	return KillValidationResult{
		Valid: true,
		Score: MatrixScorePerKill,
	}
}

// ValidateDamage validates a PvP damage report (less strict than kill).
func (kv *KillValidator) ValidateDamage(
	report DamageReport,
	serverTick uint64,
	attacker *PlayerSession,
	target *PlayerSession,
	pvpEnabled bool,
) KillValidationResult {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	// Basic checks
	if attacker == nil || target == nil {
		return KillValidationResult{Valid: false, Reason: RejectUnknownTarget}
	}
	if !attacker.Alive || !target.Alive {
		return KillValidationResult{Valid: false, Reason: RejectInvalidState}
	}
	if !pvpEnabled {
		return KillValidationResult{Valid: false, Reason: RejectPvPDisabled}
	}
	if attacker.Nationality == target.Nationality {
		return KillValidationResult{Valid: false, Reason: RejectSameNation}
	}

	// Weapon validation
	weapon, ok := kv.weaponSpecs[report.WeaponID]
	if !ok {
		return KillValidationResult{Valid: false, Reason: RejectUnknownWeapon}
	}

	// Damage cap
	if report.Damage > weapon.MaxDamage*DamageTolerance {
		return kv.reject(report.AttackerID, RejectDamageExceeded)
	}

	return KillValidationResult{Valid: true}
}

// CheckSpeed validates a player's movement speed against the server tick rate.
// Returns (valid, reason). Invalid if moved too fast.
func (kv *KillValidator) CheckSpeed(session *PlayerSession, newX, newY float64, tickDelta uint64) (bool, string) {
	if tickDelta == 0 {
		return true, ""
	}

	dx := newX - session.X
	dy := newY - session.Y
	dist := math.Sqrt(dx*dx + dy*dy)

	// Max allowed distance = BoostSpeedPerTick × tickDelta × 1.5 (tolerance)
	maxDist := BoostSpeedPerTick * float64(tickDelta) * 1.5
	if dist > maxDist {
		kv.mu.Lock()
		kv.suspicionScores[session.ClientID]++
		suspicion := kv.suspicionScores[session.ClientID]
		kv.mu.Unlock()

		slog.Warn("speed hack suspected",
			"playerId", session.ClientID,
			"distance", dist,
			"maxAllowed", maxDist,
			"ticks", tickDelta,
			"suspicion", suspicion,
		)

		return false, fmt.Sprintf("speed_violation: moved %.1f in %d ticks (max %.1f)", dist, tickDelta, maxDist)
	}

	return true, ""
}

// reject records a rejected kill and updates suspicion score.
// Must be called with kv.mu held.
func (kv *KillValidator) reject(killerID string, reason KillRejectReason) KillValidationResult {
	kv.totalRejected++
	kv.suspicionScores[killerID]++
	suspicion := kv.suspicionScores[killerID]

	shouldKick := suspicion >= SuspicionKickThreshold
	shouldBan := suspicion >= SuspicionBanThreshold

	if shouldBan {
		kv.bannedPlayers[killerID] = string(reason)
		slog.Warn("player auto-banned for kill validation failures",
			"playerId", killerID,
			"reason", reason,
			"suspicion", suspicion,
		)
	} else if shouldKick {
		slog.Warn("player suspicion high",
			"playerId", killerID,
			"reason", reason,
			"suspicion", suspicion,
		)
	}

	return KillValidationResult{
		Valid:      false,
		Reason:     reason,
		Suspicion:  suspicion,
		ShouldBan:  shouldBan,
		ShouldKick: shouldKick,
	}
}

// GetSuspicion returns the suspicion score for a player.
func (kv *KillValidator) GetSuspicion(playerID string) int {
	kv.mu.RLock()
	defer kv.mu.RUnlock()
	return kv.suspicionScores[playerID]
}

// IsBanned returns whether a player is banned.
func (kv *KillValidator) IsBanned(playerID string) bool {
	kv.mu.RLock()
	defer kv.mu.RUnlock()
	_, banned := kv.bannedPlayers[playerID]
	return banned
}

// ClearPlayer removes all tracking data for a disconnected player.
func (kv *KillValidator) ClearPlayer(playerID string) {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	delete(kv.suspicionScores, playerID)
	delete(kv.lastFireTicks, playerID)
	// Note: bans persist (not cleared on disconnect)
}

// GetStats returns validation statistics.
func (kv *KillValidator) GetStats() (total, accepted, rejected int) {
	kv.mu.RLock()
	defer kv.mu.RUnlock()
	return kv.totalValidated, kv.totalAccepted, kv.totalRejected
}

// Reset clears all validation state (used for full arena reset).
func (kv *KillValidator) Reset() {
	kv.mu.Lock()
	defer kv.mu.Unlock()

	kv.suspicionScores = make(map[string]int)
	kv.lastFireTicks = make(map[string]map[string]uint64)
	// Note: bans persist across resets
	kv.totalValidated = 0
	kv.totalAccepted = 0
	kv.totalRejected = 0
}
