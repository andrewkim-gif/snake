package game

import (
	"fmt"
	"math"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// Coach Agent (S57)
// Rule-based real-time coaching for human players.
// Generates advice based on observe_game data.
// Phase 5+ will integrate LLM for richer advice.
// ============================================================

// CoachMessageType classifies the type of coaching advice.
type CoachMessageType string

const (
	CoachWarning    CoachMessageType = "warning"    // danger approaching
	CoachTip        CoachMessageType = "tip"        // level-up recommendation
	CoachStrategy   CoachMessageType = "strategy"   // strategic suggestion
	CoachOpportunity CoachMessageType = "opportunity" // kill/orb opportunity
)

// CoachMessage is a single coaching message sent to a player.
type CoachMessage struct {
	Type    CoachMessageType `json:"type"`
	Message string           `json:"message"`
	Icon    string           `json:"icon"` // emoji icon for the UI
}

// CoachAgent generates coaching advice for human players.
type CoachAgent struct {
	// Rate limiting: track last advice tick per player
	lastAdviceTick map[string]uint64

	// Minimum ticks between advice messages (0.5~1Hz at 20Hz = 20-40 ticks)
	minAdviceInterval uint64
}

// NewCoachAgent creates a new coach agent.
func NewCoachAgent() *CoachAgent {
	return &CoachAgent{
		lastAdviceTick:    make(map[string]uint64),
		minAdviceInterval: 30, // ~1.5 seconds at 20Hz (between 0.5Hz and 1Hz)
	}
}

// GenerateAdvice analyzes the current game state for a player and returns
// coaching advice if appropriate. Returns nil if no advice needed or rate limited.
func (c *CoachAgent) GenerateAdvice(agent *domain.Agent, arena *Arena, tick uint64) *CoachMessage {
	if agent == nil || arena == nil || !agent.Alive {
		return nil
	}

	// Rate limit check
	lastTick, ok := c.lastAdviceTick[agent.ID]
	if ok && tick-lastTick < c.minAdviceInterval {
		return nil
	}

	// Generate advice based on priority (highest priority first)
	var msg *CoachMessage

	// Priority 1: Danger warning (enemy approaching)
	msg = c.checkDangerWarning(agent, arena)
	if msg != nil {
		c.lastAdviceTick[agent.ID] = tick
		return msg
	}

	// Priority 2: Boundary warning
	msg = c.checkBoundaryWarning(agent, arena)
	if msg != nil {
		c.lastAdviceTick[agent.ID] = tick
		return msg
	}

	// Priority 3: Level-up recommendation
	msg = c.checkLevelUpTip(agent)
	if msg != nil {
		c.lastAdviceTick[agent.ID] = tick
		return msg
	}

	// Priority 4: Strategy suggestion (phase-based)
	msg = c.checkStrategySuggestion(agent, arena, tick)
	if msg != nil {
		c.lastAdviceTick[agent.ID] = tick
		return msg
	}

	// Priority 5: Kill opportunity
	msg = c.checkKillOpportunity(agent, arena)
	if msg != nil {
		c.lastAdviceTick[agent.ID] = tick
		return msg
	}

	return nil
}

// checkDangerWarning detects approaching strong enemies.
func (c *CoachAgent) checkDangerWarning(agent *domain.Agent, arena *Arena) *CoachMessage {
	agents := arena.GetAgents()
	dangerRadius := AuraRadius * 3.0

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		dist := math.Sqrt(DistanceSq(agent.Position, other.Position))
		if dist > dangerRadius {
			continue
		}

		// Strong enemy approaching
		if other.Mass > agent.Mass*1.3 {
			return &CoachMessage{
				Type:    CoachWarning,
				Message: fmt.Sprintf("Watch out! %s (Lv%d) is nearby and stronger!", other.Name, other.Level),
				Icon:    "warning",
			}
		}

		// Dasher approaching (boosting enemy)
		if other.Boosting && dist < AuraRadius*2.0 {
			return &CoachMessage{
				Type:    CoachWarning,
				Message: fmt.Sprintf("%s is dashing toward you! Dodge!", other.Name),
				Icon:    "warning",
			}
		}
	}

	return nil
}

// checkBoundaryWarning detects if player is near the arena edge.
func (c *CoachAgent) checkBoundaryWarning(agent *domain.Agent, arena *Arena) *CoachMessage {
	currentRadius := arena.GetCurrentRadius()
	distFromCenter := math.Sqrt(agent.Position.X*agent.Position.X + agent.Position.Y*agent.Position.Y)
	ratio := distFromCenter / currentRadius

	if ratio > 0.85 {
		return &CoachMessage{
			Type:    CoachWarning,
			Message: "You're near the boundary! Move toward the center to avoid damage.",
			Icon:    "warning",
		}
	}

	return nil
}

// checkLevelUpTip provides level-up related advice.
func (c *CoachAgent) checkLevelUpTip(agent *domain.Agent) *CoachMessage {
	// If pending upgrade choice
	if len(agent.PendingChoices) > 0 {
		// Analyze choices and suggest
		for _, choice := range agent.PendingChoices {
			if choice.Type == "ability" && len(agent.Build.AbilitySlots) < agent.Build.MaxAbilities {
				return &CoachMessage{
					Type:    CoachTip,
					Message: fmt.Sprintf("New ability available: %s! Consider adding it to fill your slot.", choice.Name),
					Icon:    "tip",
				}
			}
		}

		// Check for synergy completion opportunity
		for _, choice := range agent.PendingChoices {
			if choice.Type == "tome" {
				synScore := synergyCompletionScore(agent, choice.TomeType)
				if synScore >= 9 { // very close to completing
					return &CoachMessage{
						Type:    CoachTip,
						Message: fmt.Sprintf("Picking %s could complete a synergy! Great choice!", choice.Name),
						Icon:    "tip",
					}
				}
			}
		}
	}

	return nil
}

// checkStrategySuggestion provides phase-based strategy tips.
func (c *CoachAgent) checkStrategySuggestion(agent *domain.Agent, arena *Arena, tick uint64) *CoachMessage {
	roundDuration := uint64(DefaultRoomConfig().RoundDurationSec * TickRate)
	elapsed := tick
	if elapsed > roundDuration {
		elapsed = roundDuration
	}

	elapsedSec := int(elapsed / uint64(TickRate))
	totalSec := DefaultRoomConfig().RoundDurationSec
	timeRemaining := totalSec - elapsedSec

	// Early game (first 60 seconds) — farm advice
	if elapsedSec < 60 && agent.Level <= 2 {
		if rand.Float64() < 0.3 { // don't spam
			return &CoachMessage{
				Type:    CoachStrategy,
				Message: "Early game! Focus on collecting orbs to level up quickly.",
				Icon:    "strategy",
			}
		}
	}

	// Mid game — build synergy advice
	if elapsedSec >= 120 && elapsedSec < 240 && len(agent.ActiveSynergies) == 0 {
		nearbySynergies := computeNearbySynergies(agent)
		if len(nearbySynergies) > 0 {
			return &CoachMessage{
				Type:    CoachStrategy,
				Message: fmt.Sprintf("You're close to completing a synergy! Focus your next upgrades on it."),
				Icon:    "strategy",
			}
		}
	}

	// Late game — survival advice
	if timeRemaining <= 60 && timeRemaining > 0 {
		rank := arena.GetLeaderboard().GetAgentRankInFinal(arena.GetAgents(), agent.ID)
		if rank <= 3 {
			return &CoachMessage{
				Type:    CoachStrategy,
				Message: fmt.Sprintf("You're rank #%d! Play safe — survival is key in the final minute.", rank),
				Icon:    "strategy",
			}
		} else {
			return &CoachMessage{
				Type:    CoachStrategy,
				Message: "Final minute! Hunt weaker enemies to boost your score.",
				Icon:    "strategy",
			}
		}
	}

	return nil
}

// checkKillOpportunity detects nearby weak enemies.
func (c *CoachAgent) checkKillOpportunity(agent *domain.Agent, arena *Arena) *CoachMessage {
	agents := arena.GetAgents()
	huntRadius := AuraRadius * 4.0

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		dist := math.Sqrt(DistanceSq(agent.Position, other.Position))
		if dist > huntRadius {
			continue
		}

		// Weak enemy nearby (less than 50% of our mass)
		if other.Mass < agent.Mass*0.5 && other.Level > 1 {
			return &CoachMessage{
				Type:    CoachOpportunity,
				Message: fmt.Sprintf("%s (Lv%d) is weak and nearby. Good kill opportunity!", other.Name, other.Level),
				Icon:    "opportunity",
			}
		}
	}

	return nil
}

// ClearPlayer removes coaching state for a player who left.
func (c *CoachAgent) ClearPlayer(playerID string) {
	delete(c.lastAdviceTick, playerID)
}
