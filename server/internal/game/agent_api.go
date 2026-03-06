package game

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// Commander Mode — Agent API (S47)
// v9 compatible commands + v10 survival extensions
// ============================================================

// CombatStyle defines the agent's overall combat behavior.
type CombatStyle string

const (
	CombatStyleAggressive CombatStyle = "aggressive"
	CombatStyleDefensive  CombatStyle = "defensive"
	CombatStyleBalanced   CombatStyle = "balanced"
	CombatStyleXPRush     CombatStyle = "xp_rush"
	CombatStyleEndgame    CombatStyle = "endgame"
)

// AgentState tracks an AI agent's commander mode state within a room.
type AgentState struct {
	AgentID       string
	CombatStyle   CombatStyle
	ActiveCommand string           // current active command (e.g., "hunt", "farm_orbs")
	CommandData   json.RawMessage  // command-specific data
	AbilityOrder  []int            // ability auto-trigger priority (slot indices)
}

// CommandHandler processes a single commander mode command.
type CommandHandler func(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error

// AgentCommandRouter routes commander mode commands to handlers.
type AgentCommandRouter struct {
	handlers map[string]CommandHandler
	states   map[string]*AgentState // agentClientID -> state
}

// NewAgentCommandRouter creates a new command router with all registered commands.
func NewAgentCommandRouter() *AgentCommandRouter {
	r := &AgentCommandRouter{
		handlers: make(map[string]CommandHandler),
		states:   make(map[string]*AgentState),
	}
	r.registerCommands()
	return r
}

// GetOrCreateState returns the agent state, creating one if needed.
func (r *AgentCommandRouter) GetOrCreateState(clientID, agentID string) *AgentState {
	state, ok := r.states[clientID]
	if !ok {
		state = &AgentState{
			AgentID:     agentID,
			CombatStyle: CombatStyleBalanced,
		}
		r.states[clientID] = state
	}
	return state
}

// RemoveState cleans up agent state on disconnect.
func (r *AgentCommandRouter) RemoveState(clientID string) {
	delete(r.states, clientID)
}

// ExecuteCommand parses and executes a commander mode command.
func (r *AgentCommandRouter) ExecuteCommand(clientID string, agent *domain.Agent, arena *Arena, cmd string, data json.RawMessage) error {
	handler, ok := r.handlers[cmd]
	if !ok {
		// Check if this is a deprecated v9 command
		if replacement, deprecated := deprecatedCommands[cmd]; deprecated {
			return fmt.Errorf("command '%s' removed in v10; use '%s' instead", cmd, replacement)
		}
		return fmt.Errorf("unknown command: %s", cmd)
	}

	state := r.GetOrCreateState(clientID, agent.AgentID)
	return handler(state, agent, arena, data)
}

// --- Deprecated v9 commands (S47: migration guide) ---

var deprecatedCommands = map[string]string{
	"ambush":         "kite or camp_shrinkage",
	"gather_near":    "farm_orbs",
	"gather_powerup": "choose_upgrade (abilities are auto-acquired via level-up)",
	"set_mode":       "set_combat_style",
}

// --- Command registration ---

func (r *AgentCommandRouter) registerCommands() {
	// === v9 retained commands ===
	r.handlers["go_to"] = cmdGoTo
	r.handlers["go_center"] = cmdGoCenter
	r.handlers["flee"] = cmdFlee
	r.handlers["hunt"] = cmdHunt
	r.handlers["hunt_nearest"] = cmdHuntNearest
	r.handlers["gather"] = cmdGather
	r.handlers["set_boost"] = cmdSetBoost

	// === v10 new survival commands ===
	r.handlers["engage_weak"] = cmdEngageWeak
	r.handlers["avoid_strong"] = cmdAvoidStrong
	r.handlers["farm_orbs"] = cmdFarmOrbs
	r.handlers["kite"] = cmdKite
	r.handlers["camp_shrinkage"] = cmdCampShrinkage
	r.handlers["priority_target"] = cmdPriorityTarget
	r.handlers["set_combat_style"] = cmdSetCombatStyle
	r.handlers["set_ability_priority"] = cmdSetAbilityPriority
}

// ============================================================
// v9 Retained Commands
// ============================================================

// go_to: Move to a specific coordinate
func cmdGoTo(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("go_to: invalid params: %w", err)
	}

	angle := math.Atan2(params.Y-agent.Position.Y, params.X-agent.Position.X)
	arena.HandleInput(agent.ID, angle, false)

	state.ActiveCommand = "go_to"
	state.CommandData = data
	return nil
}

// go_center: Move to arena center (0,0)
func cmdGoCenter(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	angle := math.Atan2(-agent.Position.Y, -agent.Position.X)
	arena.HandleInput(agent.ID, angle, false)

	state.ActiveCommand = "go_center"
	return nil
}

// flee: Run away from the nearest threat
func cmdFlee(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	agents := arena.GetAgents()
	closestDist := math.MaxFloat64
	var closestPos *domain.Position

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		dist := DistanceSq(agent.Position, other.Position)
		if dist < closestDist {
			closestDist = dist
			p := other.Position
			closestPos = &p
		}
	}

	if closestPos != nil {
		fleeAngle := math.Atan2(agent.Position.Y-closestPos.Y, agent.Position.X-closestPos.X)
		arena.HandleInput(agent.ID, fleeAngle, true)
	}

	state.ActiveCommand = "flee"
	return nil
}

// hunt: Chase a specific target by ID
func cmdHunt(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		TargetID string `json:"targetId"`
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("hunt: invalid params: %w", err)
	}

	target, ok := arena.GetAgent(params.TargetID)
	if !ok || !target.Alive {
		return fmt.Errorf("hunt: target %s not found or dead", params.TargetID)
	}

	angle := math.Atan2(target.Position.Y-agent.Position.Y, target.Position.X-agent.Position.X)
	arena.HandleInput(agent.ID, angle, true)

	state.ActiveCommand = "hunt"
	state.CommandData = data
	return nil
}

// hunt_nearest: Chase the nearest enemy
func cmdHuntNearest(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	agents := arena.GetAgents()
	closestDist := math.MaxFloat64
	var targetPos *domain.Position

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		dist := DistanceSq(agent.Position, other.Position)
		if dist < closestDist {
			closestDist = dist
			p := other.Position
			targetPos = &p
		}
	}

	if targetPos == nil {
		return fmt.Errorf("hunt_nearest: no enemies found")
	}

	angle := math.Atan2(targetPos.Y-agent.Position.Y, targetPos.X-agent.Position.X)
	arena.HandleInput(agent.ID, angle, true)

	state.ActiveCommand = "hunt_nearest"
	return nil
}

// gather: Move toward the nearest orb cluster
func cmdGather(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	orbs := arena.GetOrbManager().GetOrbs()
	if len(orbs) == 0 {
		return nil
	}

	// Find nearest orb
	closestDist := math.MaxFloat64
	var closestPos *domain.Position

	for _, orb := range orbs {
		dist := DistanceSq(agent.Position, orb.Position)
		if dist < closestDist {
			closestDist = dist
			p := orb.Position
			closestPos = &p
		}
	}

	if closestPos != nil {
		angle := math.Atan2(closestPos.Y-agent.Position.Y, closestPos.X-agent.Position.X)
		arena.HandleInput(agent.ID, angle, false)
	}

	state.ActiveCommand = "gather"
	return nil
}

// set_boost: Enable/disable boost
func cmdSetBoost(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("set_boost: invalid params: %w", err)
	}

	arena.HandleInput(agent.ID, agent.Heading, params.Enabled)

	state.ActiveCommand = "set_boost"
	return nil
}

// ============================================================
// v10 New Survival Commands
// ============================================================

// engage_weak: Attack enemies weaker than self
func cmdEngageWeak(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	agents := arena.GetAgents()
	closestDist := math.MaxFloat64
	var targetPos *domain.Position

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		if other.Mass >= agent.Mass*0.8 {
			continue // only engage weaker
		}
		dist := DistanceSq(agent.Position, other.Position)
		huntRange := AuraRadius * 4.0
		if dist < closestDist && dist < huntRange*huntRange {
			closestDist = dist
			p := other.Position
			targetPos = &p
		}
	}

	if targetPos == nil {
		// No weak targets — wander
		return nil
	}

	angle := math.Atan2(targetPos.Y-agent.Position.Y, targetPos.X-agent.Position.X)
	arena.HandleInput(agent.ID, angle, true)

	state.ActiveCommand = "engage_weak"
	return nil
}

// avoid_strong: Flee from enemies stronger than self
func cmdAvoidStrong(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	agents := arena.GetAgents()
	closestDist := math.MaxFloat64
	var threatPos *domain.Position

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		if other.Mass <= agent.Mass {
			continue // only avoid stronger
		}
		dist := DistanceSq(agent.Position, other.Position)
		avoidRange := AuraRadius * 3.0
		if dist < closestDist && dist < avoidRange*avoidRange {
			closestDist = dist
			p := other.Position
			threatPos = &p
		}
	}

	if threatPos == nil {
		return nil // no threats
	}

	fleeAngle := math.Atan2(agent.Position.Y-threatPos.Y, agent.Position.X-threatPos.X)
	arena.HandleInput(agent.ID, fleeAngle, true)

	state.ActiveCommand = "avoid_strong"
	return nil
}

// farm_orbs: Collect orbs in a specified zone
func cmdFarmOrbs(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		Zone string `json:"zone"` // "safe", "center", "edge"
	}
	if data != nil {
		json.Unmarshal(data, &params)
	}
	if params.Zone == "" {
		params.Zone = "safe"
	}

	currentRadius := arena.GetCurrentRadius()
	orbs := arena.GetOrbManager().GetOrbs()

	// Filter orbs by zone
	closestDist := math.MaxFloat64
	var bestPos *domain.Position

	for _, orb := range orbs {
		orbDist := math.Sqrt(orb.Position.X*orb.Position.X + orb.Position.Y*orb.Position.Y)

		switch params.Zone {
		case "center":
			if orbDist > currentRadius*0.3 {
				continue
			}
		case "edge":
			if orbDist < currentRadius*0.6 {
				continue
			}
		case "safe":
			// Avoid areas near strong enemies
			if orbDist > currentRadius*0.7 {
				continue
			}
		}

		dist := DistanceSq(agent.Position, orb.Position)
		if dist < closestDist {
			closestDist = dist
			p := orb.Position
			bestPos = &p
		}
	}

	if bestPos != nil {
		angle := math.Atan2(bestPos.Y-agent.Position.Y, bestPos.X-agent.Position.X)
		arena.HandleInput(agent.ID, angle, false)
	}

	state.ActiveCommand = "farm_orbs"
	state.CommandData = data
	return nil
}

// kite: Orbit target at aura edge for sustained DPS
func cmdKite(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		TargetID string `json:"targetId"`
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("kite: invalid params: %w", err)
	}

	target, ok := arena.GetAgent(params.TargetID)
	if !ok || !target.Alive {
		return fmt.Errorf("kite: target %s not found or dead", params.TargetID)
	}

	dist := DistanceBetween(agent.Position, target.Position)
	toTarget := math.Atan2(target.Position.Y-agent.Position.Y, target.Position.X-agent.Position.X)

	if dist > AuraRadius*1.5 {
		// Too far — move closer
		arena.HandleInput(agent.ID, toTarget, false)
	} else if dist < AuraRadius*0.5 {
		// Too close — move away
		arena.HandleInput(agent.ID, toTarget+math.Pi, true)
	} else {
		// Sweet spot — orbit tangentially
		arena.HandleInput(agent.ID, toTarget+math.Pi/2, false)
	}

	state.ActiveCommand = "kite"
	state.CommandData = data
	return nil
}

// camp_shrinkage: Position near the shrink boundary edge
func cmdCampShrinkage(state *AgentState, agent *domain.Agent, arena *Arena, _ json.RawMessage) error {
	currentRadius := arena.GetCurrentRadius()
	distFromCenter := math.Sqrt(agent.Position.X*agent.Position.X + agent.Position.Y*agent.Position.Y)
	targetDist := currentRadius * 0.75

	if distFromCenter < targetDist*0.9 {
		// Move outward
		angle := math.Atan2(agent.Position.Y, agent.Position.X)
		arena.HandleInput(agent.ID, angle, false)
	} else if distFromCenter > targetDist*1.1 {
		// Move inward
		angle := math.Atan2(-agent.Position.Y, -agent.Position.X)
		arena.HandleInput(agent.ID, angle, false)
	} else {
		// Orbit at boundary
		angle := math.Atan2(agent.Position.Y, agent.Position.X) + math.Pi/2
		arena.HandleInput(agent.ID, angle, false)
	}

	state.ActiveCommand = "camp_shrinkage"
	return nil
}

// priority_target: Hunt based on priority criteria
func cmdPriorityTarget(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		TargetType string `json:"targetType"` // "weakest", "highest_xp", "lowest_hp"
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("priority_target: invalid params: %w", err)
	}

	agents := arena.GetAgents()
	var bestTarget *domain.Agent
	bestScore := math.MaxFloat64

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		dist := DistanceSq(agent.Position, other.Position)
		huntRange := AuraRadius * 6.0
		if dist > huntRange*huntRange {
			continue
		}

		var score float64
		switch params.TargetType {
		case "weakest":
			score = other.Mass // lower mass = better target
		case "highest_xp":
			score = -float64(other.XP) // higher XP = better target (negative for min)
		case "lowest_hp":
			score = other.Mass // same as weakest for mass-based HP
		default:
			score = other.Mass
		}

		if score < bestScore {
			bestScore = score
			bestTarget = other
		}
	}

	if bestTarget == nil {
		return fmt.Errorf("priority_target: no targets found")
	}

	angle := math.Atan2(bestTarget.Position.Y-agent.Position.Y, bestTarget.Position.X-agent.Position.X)
	arena.HandleInput(agent.ID, angle, true)

	state.ActiveCommand = "priority_target"
	state.CommandData = data
	return nil
}

// set_combat_style: Change the agent's overall combat behavior weighting
func cmdSetCombatStyle(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		Style string `json:"style"` // "aggressive", "defensive", "balanced", "xp_rush", "endgame"
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("set_combat_style: invalid params: %w", err)
	}

	switch CombatStyle(params.Style) {
	case CombatStyleAggressive, CombatStyleDefensive, CombatStyleBalanced,
		CombatStyleXPRush, CombatStyleEndgame:
		state.CombatStyle = CombatStyle(params.Style)
	default:
		return fmt.Errorf("set_combat_style: unknown style '%s'", params.Style)
	}

	slog.Info("agent combat style changed",
		"agentId", state.AgentID,
		"style", params.Style,
	)

	state.ActiveCommand = "set_combat_style"
	return nil
}

// set_ability_priority: Set ability auto-trigger order
func cmdSetAbilityPriority(state *AgentState, agent *domain.Agent, arena *Arena, data json.RawMessage) error {
	var params struct {
		Order []int `json:"order"` // ability slot indices in priority order
	}
	if err := json.Unmarshal(data, &params); err != nil {
		return fmt.Errorf("set_ability_priority: invalid params: %w", err)
	}

	state.AbilityOrder = params.Order
	state.ActiveCommand = "set_ability_priority"
	return nil
}

// ============================================================
// observe_game — Full Game Observation for AI Agents (S52)
// v9 backward compatible + v10 extended fields
// ============================================================

// ObserveGameRadius is the visibility radius for nearby agents/orbs/objects.
const ObserveGameRadius = 600.0

// BuildObserveGameResponse creates the full game observation response for an AI agent.
// This provides all information an agent needs to make strategic decisions.
func BuildObserveGameResponse(agent *domain.Agent, arena *Arena) *domain.ObserveGameResponse {
	if agent == nil || arena == nil {
		return nil
	}

	currentRadius := arena.GetCurrentRadius()
	agents := arena.GetAgents()
	tick := arena.GetTick()

	// Compute zone based on distance from center relative to arena radius
	zone := computeZone(agent.Position, currentRadius)

	// Compute rank
	rank := arena.GetLeaderboard().GetAgentRankInFinal(agents, agent.ID)

	// Compute time remaining (approximate from tick)
	roundDuration := uint64(DefaultRoomConfig().RoundDurationSec * TickRate)
	timeRemainingSec := 0
	if roundDuration > tick {
		timeRemainingSec = int((roundDuration - tick) / uint64(TickRate))
	}

	// Compute alive count
	aliveCount := 0
	for _, a := range agents {
		if a.Alive {
			aliveCount++
		}
	}

	// Build nearby agents, threats
	var nearbyAgents []domain.ObserveNearbyAgent
	var nearbyThreats []domain.ObserveNearbyThreat
	observeRadiusSq := ObserveGameRadius * ObserveGameRadius

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		distSq := DistanceSq(agent.Position, other.Position)
		if distSq > observeRadiusSq {
			continue
		}
		dist := math.Sqrt(distSq)

		// v9 compat: nearby agent
		nearbyAgents = append(nearbyAgents, domain.ObserveNearbyAgent{
			ID:       other.ID,
			X:        other.Position.X,
			Y:        other.Position.Y,
			Mass:     other.Mass,
			Heading:  other.Heading,
			Boosting: other.Boosting,
			Name:     other.Name,
			Level:    other.Level,
		})

		// v10: threat with build type classification
		nearbyThreats = append(nearbyThreats, domain.ObserveNearbyThreat{
			ID:        other.ID,
			Mass:      other.Mass,
			Distance:  math.Round(dist*10) / 10, // round to 1 decimal
			BuildType: classifyBuildType(other.Build),
		})
	}

	// Build nearby orbs (v9 compat)
	var nearbyOrbs []domain.ObserveNearbyOrb
	orbs := arena.GetOrbManager().GetOrbs()
	for _, orb := range orbs {
		distSq := DistanceSq(agent.Position, orb.Position)
		if distSq > observeRadiusSq {
			continue
		}
		nearbyOrbs = append(nearbyOrbs, domain.ObserveNearbyOrb{
			X:     orb.Position.X,
			Y:     orb.Position.Y,
			Value: orb.Value,
			Type:  orb.Type,
		})
	}

	// v10: nearby map objects
	var nearbyMapObjs []domain.ObserveNearbyMapObj
	mapObjs := arena.GetMapObjects().GetNearbyMapObjects(
		agent.Position.X, agent.Position.Y, ObserveGameRadius,
	)
	for _, obj := range mapObjs {
		dx := obj.Position.X - agent.Position.X
		dy := obj.Position.Y - agent.Position.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		nearbyMapObjs = append(nearbyMapObjs, domain.ObserveNearbyMapObj{
			Type:     string(obj.Type),
			X:        obj.Position.X,
			Y:        obj.Position.Y,
			Distance: math.Round(dist*10) / 10,
		})
	}

	return &domain.ObserveGameResponse{
		// v9 compatible fields
		ID:       agent.ID,
		X:        agent.Position.X,
		Y:        agent.Position.Y,
		Heading:  agent.Heading,
		Speed:    agent.Speed,
		Mass:     agent.Mass,
		Alive:    agent.Alive,
		Score:    agent.Score,
		Kills:    agent.Kills,
		Boosting: agent.Boosting,

		NearbyAgents: nearbyAgents,
		NearbyOrbs:   nearbyOrbs,

		// v10 extended fields
		Level:    agent.Level,
		XP:       agent.XP,
		XPToNext: agent.XPToNext,
		Build: domain.ObserveBuildInfo{
			Tomes:           agent.Build.Tomes,
			Abilities:       agent.Build.AbilitySlots,
			ActiveSynergies: agent.ActiveSynergies,
		},
		ArenaRadius:   currentRadius,
		Zone:          zone,
		NearbyThreats: nearbyThreats,
		NearbyMapObjs: nearbyMapObjs,
		TimeRemaining: timeRemainingSec,
		MyRank:        rank,
		AliveCount:    aliveCount,
		Tick:          tick,
	}
}

// computeZone determines the agent's zone based on distance from center.
// Returns "center" (0-25%), "mid" (25-60%), "edge" (60-85%), "danger" (85%+).
func computeZone(pos domain.Position, arenaRadius float64) string {
	distFromCenter := math.Sqrt(pos.X*pos.X + pos.Y*pos.Y)
	ratio := distFromCenter / arenaRadius

	switch {
	case ratio < 0.25:
		return "center"
	case ratio < 0.60:
		return "mid"
	case ratio < 0.85:
		return "edge"
	default:
		return "danger"
	}
}

// classifyBuildType determines the dominant build type from the agent's tomes.
// Returns "berserker", "tank", "speedster", "farmer", or "balanced".
func classifyBuildType(build domain.PlayerBuild) string {
	if build.Tomes == nil {
		return "balanced"
	}

	berserker := build.Tomes[domain.TomeDamage] + build.Tomes[domain.TomeCursed]
	tank := build.Tomes[domain.TomeArmor] + build.Tomes[domain.TomeRegen]
	speedster := build.Tomes[domain.TomeSpeed] + build.Tomes[domain.TomeMagnet]
	farmer := build.Tomes[domain.TomeXP] + build.Tomes[domain.TomeLuck]

	maxVal := berserker
	maxType := "berserker"

	if tank > maxVal {
		maxVal = tank
		maxType = "tank"
	}
	if speedster > maxVal {
		maxVal = speedster
		maxType = "speedster"
	}
	if farmer > maxVal {
		maxVal = farmer
		maxType = "farmer"
	}

	// If all equal (including 0), return balanced
	if berserker == tank && tank == speedster && speedster == farmer {
		return "balanced"
	}

	return maxType
}

// ============================================================
// Combat Style → Bot Behavior Mapping
// ============================================================

// GetCombatStyleWeights returns behavior weights for a combat style.
// Returns: hunt%, survive%, gather%, wander%
func GetCombatStyleWeights(style CombatStyle) (hunt, survive, gather, wander float64) {
	switch style {
	case CombatStyleAggressive:
		return 0.80, 0.05, 0.10, 0.05
	case CombatStyleDefensive:
		return 0.10, 0.60, 0.20, 0.10
	case CombatStyleBalanced:
		return 0.35, 0.25, 0.25, 0.15
	case CombatStyleXPRush:
		return 0.05, 0.20, 0.65, 0.10
	case CombatStyleEndgame:
		return 0.30, 0.40, 0.15, 0.15
	default:
		return 0.35, 0.25, 0.25, 0.15 // balanced fallback
	}
}
