// Package game — Commander Mode (Phase 5, S26).
// Allows players to switch between AI auto-pilot and manual control.
// Features: AI→manual transition (1s invincibility), manual input handling,
// 30s idle auto-return to AI, take-command/release-command API.
package game

import (
	"encoding/json"
	"log/slog"
	"math"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// Commander mode constants.
const (
	// CommanderInvincibilityTicks is 1 second of invincibility on mode switch (20 ticks at 20Hz).
	CommanderInvincibilityTicks = 20

	// CommanderIdleTimeoutSec is the idle timeout before auto-returning to AI (30 seconds).
	CommanderIdleTimeoutSec = 30

	// CommanderIdleTimeoutTicks = 30 * 20 = 600 ticks at 20Hz.
	CommanderIdleTimeoutTicks = 600
)

// CommanderControlMode defines whether an agent is AI-controlled or manually controlled.
type CommanderControlMode string

const (
	ControlModeAI     CommanderControlMode = "ai"
	ControlModeManual CommanderControlMode = "manual"
)

// CommanderState tracks the commander mode state for a single agent.
type CommanderState struct {
	AgentID     string
	UserID      string
	Mode        CommanderControlMode
	SwitchedAt  time.Time // when the mode was last switched
	LastInputAt time.Time // when the last manual input was received
	LastInputTick uint64  // tick of last manual input

	// Invincibility period after mode switch
	InvincibleUntilTick uint64

	// Manual control input state
	ManualAngle float64
	ManualBoost bool
}

// CommanderManager manages commander mode states for all agents.
type CommanderManager struct {
	mu     sync.RWMutex
	states map[string]*CommanderState // agentID → state
}

// NewCommanderManager creates a new CommanderManager.
func NewCommanderManager() *CommanderManager {
	return &CommanderManager{
		states: make(map[string]*CommanderState),
	}
}

// TakeCommand switches an agent from AI to manual control.
// Returns the commander state and an error if the switch is invalid.
func (cm *CommanderManager) TakeCommand(agentID, userID string, currentTick uint64) (*CommanderState, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	state, ok := cm.states[agentID]
	if !ok {
		// Create new state
		state = &CommanderState{
			AgentID: agentID,
			UserID:  userID,
			Mode:    ControlModeAI,
		}
		cm.states[agentID] = state
	}

	// Already in manual mode
	if state.Mode == ControlModeManual {
		return state, nil
	}

	// Switch to manual
	now := time.Now()
	state.Mode = ControlModeManual
	state.SwitchedAt = now
	state.LastInputAt = now
	state.LastInputTick = currentTick
	state.InvincibleUntilTick = currentTick + CommanderInvincibilityTicks

	slog.Info("commander: take command",
		"agentId", agentID,
		"userId", userID,
		"invincibleUntil", state.InvincibleUntilTick,
	)

	return state, nil
}

// ReleaseCommand switches an agent from manual back to AI control.
func (cm *CommanderManager) ReleaseCommand(agentID, userID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	state, ok := cm.states[agentID]
	if !ok {
		return
	}

	if state.Mode == ControlModeAI {
		return // Already in AI mode
	}

	state.Mode = ControlModeAI
	state.SwitchedAt = time.Now()

	slog.Info("commander: release command",
		"agentId", agentID,
		"userId", userID,
	)
}

// HandleManualInput processes manual control input from a commander.
// Returns true if the input was accepted (agent is in manual mode).
func (cm *CommanderManager) HandleManualInput(agentID string, angle float64, boost bool, currentTick uint64) bool {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	state, ok := cm.states[agentID]
	if !ok || state.Mode != ControlModeManual {
		return false
	}

	state.ManualAngle = angle
	state.ManualBoost = boost
	state.LastInputAt = time.Now()
	state.LastInputTick = currentTick

	return true
}

// GetMode returns the current control mode for an agent.
func (cm *CommanderManager) GetMode(agentID string) CommanderControlMode {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	state, ok := cm.states[agentID]
	if !ok {
		return ControlModeAI
	}
	return state.Mode
}

// GetState returns the full commander state for an agent.
func (cm *CommanderManager) GetState(agentID string) *CommanderState {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.states[agentID]
}

// IsInvincible checks if the agent has commander mode invincibility.
func (cm *CommanderManager) IsInvincible(agentID string, currentTick uint64) bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	state, ok := cm.states[agentID]
	if !ok {
		return false
	}
	return currentTick < state.InvincibleUntilTick
}

// TickIdleCheck checks all manual-mode agents for idle timeout.
// Agents with no input for CommanderIdleTimeoutTicks are auto-returned to AI.
// Returns list of agent IDs that were auto-returned.
func (cm *CommanderManager) TickIdleCheck(currentTick uint64) []string {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	var autoReturned []string

	for agentID, state := range cm.states {
		if state.Mode != ControlModeManual {
			continue
		}

		ticksSinceInput := currentTick - state.LastInputTick
		if ticksSinceInput >= CommanderIdleTimeoutTicks {
			state.Mode = ControlModeAI
			state.SwitchedAt = time.Now()
			autoReturned = append(autoReturned, agentID)

			slog.Info("commander: idle auto-return",
				"agentId", agentID,
				"idleTicks", ticksSinceInput,
			)
		}
	}

	return autoReturned
}

// ApplyManualInput applies stored manual input to an agent.
// Called during the arena tick for manual-mode agents.
func (cm *CommanderManager) ApplyManualInput(agent *domain.Agent, arena *Arena, currentTick uint64) {
	cm.mu.RLock()
	state, ok := cm.states[agent.ID]
	cm.mu.RUnlock()

	if !ok || state.Mode != ControlModeManual {
		return
	}

	// Apply the stored input
	angle := state.ManualAngle
	boost := state.ManualBoost
	arena.HandleInput(agent.ID, angle, boost)
}

// RemoveAgent cleans up commander state when an agent is removed.
func (cm *CommanderManager) RemoveAgent(agentID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	delete(cm.states, agentID)
}

// GetManualAgents returns all agents currently in manual mode.
func (cm *CommanderManager) GetManualAgents() []string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var ids []string
	for id, state := range cm.states {
		if state.Mode == ControlModeManual {
			ids = append(ids, id)
		}
	}
	return ids
}

// --- Commander HUD Data ---

// CommanderHUDData is the data sent to the client for the Commander HUD overlay.
type CommanderHUDData struct {
	Mode              string  `json:"mode"`                // "ai" or "manual"
	IdleTimeRemaining float64 `json:"idle_time_remaining"` // seconds until auto-return
	IsInvincible      bool    `json:"is_invincible"`
	InvincibleRemain  float64 `json:"invincible_remain"`   // seconds of invincibility left
	AgentHP           float64 `json:"agent_hp"`
	AgentLevel        int     `json:"agent_level"`
	AgentKills        int     `json:"agent_kills"`
	AgentScore        int     `json:"agent_score"`
	DashAvailable     bool    `json:"dash_available"`
}

// BuildHUDData creates the HUD data for a commander-controlled agent.
func (cm *CommanderManager) BuildHUDData(agent *domain.Agent, currentTick uint64) *CommanderHUDData {
	cm.mu.RLock()
	state, ok := cm.states[agent.ID]
	cm.mu.RUnlock()

	if !ok {
		return &CommanderHUDData{
			Mode:       string(ControlModeAI),
			AgentHP:    agent.Mass,
			AgentLevel: agent.Level,
			AgentKills: agent.Kills,
			AgentScore: agent.Score,
		}
	}

	// Calculate idle time remaining
	idleTimeRemaining := 0.0
	if state.Mode == ControlModeManual {
		ticksSinceInput := currentTick - state.LastInputTick
		remainingTicks := uint64(0)
		if CommanderIdleTimeoutTicks > ticksSinceInput {
			remainingTicks = CommanderIdleTimeoutTicks - ticksSinceInput
		}
		idleTimeRemaining = float64(remainingTicks) / float64(TickRate)
	}

	// Calculate invincibility remaining
	invincibleRemain := 0.0
	isInvincible := false
	if currentTick < state.InvincibleUntilTick {
		isInvincible = true
		remainTicks := state.InvincibleUntilTick - currentTick
		invincibleRemain = float64(remainTicks) / float64(TickRate)
	}

	// Check dash availability (not on cooldown)
	dashAvailable := !HasCooldown(agent, domain.AbilitySpeedDash)

	return &CommanderHUDData{
		Mode:              string(state.Mode),
		IdleTimeRemaining: math.Round(idleTimeRemaining*10) / 10,
		IsInvincible:      isInvincible,
		InvincibleRemain:  math.Round(invincibleRemain*10) / 10,
		AgentHP:           math.Round(agent.Mass*10) / 10,
		AgentLevel:        agent.Level,
		AgentKills:        agent.Kills,
		AgentScore:        agent.Score,
		DashAvailable:     dashAvailable,
	}
}

// --- Commander WS Event Payloads ---

// CommanderTakePayload is the client→server payload for taking command.
type CommanderTakePayload struct {
	AgentID string `json:"agent_id"`
}

// CommanderReleasePayload is the client→server payload for releasing command.
type CommanderReleasePayload struct {
	AgentID string `json:"agent_id"`
}

// CommanderInputPayload is the client→server payload for manual control input.
type CommanderInputPayload struct {
	AgentID string  `json:"agent_id"`
	Angle   float64 `json:"angle"`
	Boost   bool    `json:"boost"`
}

// CommanderModeChangedPayload is the server→client payload when mode changes.
type CommanderModeChangedPayload struct {
	AgentID       string `json:"agent_id"`
	Mode          string `json:"mode"`
	Reason        string `json:"reason"` // "user_take", "user_release", "idle_timeout"
	IsInvincible  bool   `json:"is_invincible"`
}

// CommanderUpgradeChoicePayload allows manual upgrade selection during commander mode.
type CommanderUpgradeChoicePayload struct {
	AgentID     string `json:"agent_id"`
	ChoiceIndex int    `json:"choice_index"` // 0, 1, or 2
}

// ParseCommanderPayload parses a raw JSON message into commander payloads.
func ParseCommanderPayload(data json.RawMessage) (*CommanderTakePayload, error) {
	var p CommanderTakePayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &p, nil
}
