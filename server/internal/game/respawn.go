package game

import (
	"log/slog"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// Respawn system constants
const (
	// RespawnDelayTicks is the wait time after death before respawning (3 seconds).
	RespawnDelayTicks = 3 * TickRate // 60 ticks

	// RespawnInvincibilityTicks is invincibility duration after respawn (5 seconds).
	RespawnInvincibilityTicks = 5 * TickRate // 100 ticks

	// RespawnSpeedPenaltyTicks is the duration of speed penalty after respawn (2 seconds).
	RespawnSpeedPenaltyTicks = 2 * TickRate // 40 ticks

	// RespawnSpeedPenaltyMult is the speed multiplier during penalty period (30% slower).
	RespawnSpeedPenaltyMult = 0.70
)

// RespawnRequest represents a pending respawn for a dead agent.
type RespawnRequest struct {
	AgentID     string
	DeathTick   uint64
	RespawnTick uint64 // DeathTick + RespawnDelayTicks
	Processed   bool
}

// RespawnEvent is emitted when an agent respawns.
type RespawnEvent struct {
	AgentID          string          `json:"agentId"`
	Position         domain.Position `json:"position"`
	InvincibleUntil  uint64          `json:"invincibleUntil"`  // tick when invincibility ends
	SpeedPenaltyEnd  uint64          `json:"speedPenaltyEnd"`  // tick when speed penalty ends
	CountdownSec     int             `json:"countdownSec"`     // 3s countdown for client display
}

// RespawnManager handles death-to-respawn flow with invincibility and speed penalty.
type RespawnManager struct {
	mu sync.Mutex

	// Pending respawn requests (agentID → request)
	pending map[string]*RespawnRequest

	// Active respawn effects (agentID → effect)
	activeEffects map[string]*RespawnEffect
}

// RespawnEffect tracks post-respawn temporary effects.
type RespawnEffect struct {
	AgentID           string
	InvincibleUntil   uint64
	SpeedPenaltyUntil uint64
}

// NewRespawnManager creates a new respawn manager.
func NewRespawnManager() *RespawnManager {
	return &RespawnManager{
		pending:       make(map[string]*RespawnRequest),
		activeEffects: make(map[string]*RespawnEffect),
	}
}

// RequestRespawn queues an agent for respawn after the delay period.
// Called when an agent dies. Level and build are preserved.
func (rm *RespawnManager) RequestRespawn(agentID string, currentTick uint64) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	rm.pending[agentID] = &RespawnRequest{
		AgentID:     agentID,
		DeathTick:   currentTick,
		RespawnTick: currentTick + RespawnDelayTicks,
		Processed:   false,
	}

	slog.Debug("respawn requested",
		"agentId", agentID,
		"deathTick", currentTick,
		"respawnTick", currentTick+RespawnDelayTicks,
	)
}

// CancelRespawn cancels a pending respawn (e.g., player disconnected).
func (rm *RespawnManager) CancelRespawn(agentID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.pending, agentID)
	delete(rm.activeEffects, agentID)
}

// ProcessTick checks pending respawns and returns agents ready to respawn.
// Returns a list of agent IDs that should be respawned this tick.
func (rm *RespawnManager) ProcessTick(currentTick uint64) []string {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	var readyToRespawn []string

	for agentID, req := range rm.pending {
		if req.Processed {
			continue
		}
		if currentTick >= req.RespawnTick {
			readyToRespawn = append(readyToRespawn, agentID)
			req.Processed = true

			// Set up post-respawn effects
			rm.activeEffects[agentID] = &RespawnEffect{
				AgentID:           agentID,
				InvincibleUntil:   currentTick + RespawnInvincibilityTicks,
				SpeedPenaltyUntil: currentTick + RespawnSpeedPenaltyTicks,
			}

			// Clean up pending
			delete(rm.pending, agentID)
		}
	}

	return readyToRespawn
}

// RespawnAgent performs the actual respawn of an agent:
// - Resets HP (mass) to 100% of initial
// - Preserves level and build
// - Sets invincibility flag
// - Sets speed penalty
// - Places at random position
func (rm *RespawnManager) RespawnAgent(agent *domain.Agent, spawnPos domain.Position, currentTick uint64) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Revive the agent
	agent.Alive = true
	agent.Mass = InitialMass // 100% HP recovery
	agent.Position = spawnPos
	agent.Heading = 0
	agent.TargetAngle = 0
	agent.Speed = BaseSpeed
	agent.Boosting = false
	agent.LastDamagedBy = ""
	agent.KillStreak = 0

	// Set invincibility via grace period (reuses existing system)
	agent.GracePeriodEnd = currentTick + RespawnInvincibilityTicks

	// Level and build are intentionally NOT reset
	// agent.Level, agent.XP, agent.Build, agent.ActiveSynergies — preserved

	// Clear pending upgrade choices (if any were active at death)
	agent.PendingChoices = nil
	agent.UpgradeDeadline = 0

	slog.Debug("agent respawned",
		"agentId", agent.ID,
		"position", spawnPos,
		"level", agent.Level,
		"invincibleUntil", currentTick+RespawnInvincibilityTicks,
	)
}

// IsInvincible returns whether an agent has respawn invincibility.
func (rm *RespawnManager) IsInvincible(agentID string, currentTick uint64) bool {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	effect, ok := rm.activeEffects[agentID]
	if !ok {
		return false
	}

	if currentTick >= effect.InvincibleUntil {
		return false
	}
	return true
}

// GetSpeedMultiplier returns the speed multiplier for an agent
// (accounts for respawn speed penalty).
func (rm *RespawnManager) GetSpeedMultiplier(agentID string, currentTick uint64) float64 {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	effect, ok := rm.activeEffects[agentID]
	if !ok {
		return 1.0
	}

	if currentTick < effect.SpeedPenaltyUntil {
		return RespawnSpeedPenaltyMult
	}

	// Clean up expired effects
	if currentTick >= effect.InvincibleUntil && currentTick >= effect.SpeedPenaltyUntil {
		delete(rm.activeEffects, agentID)
	}

	return 1.0
}

// HasPendingRespawn checks if an agent has a pending respawn.
func (rm *RespawnManager) HasPendingRespawn(agentID string) bool {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	_, ok := rm.pending[agentID]
	return ok
}

// GetRespawnCountdown returns the seconds remaining until respawn, or 0 if not pending.
func (rm *RespawnManager) GetRespawnCountdown(agentID string, currentTick uint64) int {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	req, ok := rm.pending[agentID]
	if !ok || req.Processed {
		return 0
	}

	if currentTick >= req.RespawnTick {
		return 0
	}

	ticksLeft := req.RespawnTick - currentTick
	seconds := int(ticksLeft / uint64(TickRate))
	if ticksLeft%uint64(TickRate) > 0 {
		seconds++ // Round up
	}
	return seconds
}

// GetActiveEffects returns the post-respawn effects for an agent, or nil.
func (rm *RespawnManager) GetActiveEffects(agentID string) *RespawnEffect {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	return rm.activeEffects[agentID]
}

// Reset clears all pending respawns and active effects.
func (rm *RespawnManager) Reset() {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.pending = make(map[string]*RespawnRequest)
	rm.activeEffects = make(map[string]*RespawnEffect)
}

// PendingCount returns the number of agents waiting to respawn.
func (rm *RespawnManager) PendingCount() int {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	return len(rm.pending)
}
