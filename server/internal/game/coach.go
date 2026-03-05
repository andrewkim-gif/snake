package game

// ─── Coach Engine ───

// CoachMessageType categorizes coaching messages.
type CoachMessageType string

const (
	CoachWarning     CoachMessageType = "warning"
	CoachTip         CoachMessageType = "tip"
	CoachOpportunity CoachMessageType = "opportunity"
	CoachStrategy    CoachMessageType = "strategy"
	CoachEfficiency  CoachMessageType = "efficiency"
)

// CoachMessage is a coaching message to be sent to a player.
type CoachMessage struct {
	Type    CoachMessageType `json:"type"`
	Message string           `json:"message"`
}

// CoachEngine runs periodic analysis and generates coaching messages.
type CoachEngine struct {
	// Last message tick per player (for debounce)
	lastMessageTick map[string]uint64
	// Interval in ticks between checks (40 ticks = 2s at 20Hz)
	checkInterval uint64
	// Minimum ticks between messages per player (100 ticks = 5s at 20Hz)
	debounceInterval uint64
}

// NewCoachEngine creates a new CoachEngine.
func NewCoachEngine() *CoachEngine {
	return &CoachEngine{
		lastMessageTick:  make(map[string]uint64),
		checkInterval:    40,  // 2 seconds at 20Hz
		debounceInterval: 100, // 5 seconds at 20Hz
	}
}

// ShouldCheck returns true if the coach should run analysis this tick.
func (ce *CoachEngine) ShouldCheck(tick uint64) bool {
	return tick%ce.checkInterval == 0
}

// Analyze generates coaching messages for a player based on their current state.
// Returns nil if no message should be sent (debounce or no relevant advice).
func (ce *CoachEngine) Analyze(playerID string, agent *Agent, arena *Arena, tick uint64) *CoachMessage {
	// Debounce: only 1 message per 5 seconds per player
	if lastTick, ok := ce.lastMessageTick[playerID]; ok {
		if tick-lastTick < ce.debounceInterval {
			return nil
		}
	}

	if agent == nil || !agent.Alive {
		return nil
	}

	pos := agent.Position
	currentRadius := arena.GetCurrentRadius()
	distFromCenter := distanceFromOrigin(pos)
	edgeRatio := distFromCenter / currentRadius

	// Rule 1: Near edge warning (>80% radius)
	if edgeRatio > 0.80 {
		ce.lastMessageTick[playerID] = tick
		return &CoachMessage{
			Type:    CoachWarning,
			Message: "Move toward center! Arena edge is dangerous.",
		}
	}

	// Rule 2: High level but no synergy
	if agent.Level > 5 && len(agent.ActiveSynergies) == 0 {
		ce.lastMessageTick[playerID] = tick
		return &CoachMessage{
			Type:    CoachTip,
			Message: "Try to complete a synergy combo for bonus power!",
		}
	}

	// Rule 3: Nearby weak opponent
	nearby := arena.FindNearbyAgent(playerID, pos, 200)
	if nearby != nil && nearby.Alive && nearby.Mass < agent.Mass*0.6 {
		ce.lastMessageTick[playerID] = tick
		return &CoachMessage{
			Type:    CoachOpportunity,
			Message: "Weak opponent nearby — engage!",
		}
	}

	// Rule 4: Low mass compared to average
	avgMass := arena.getAverageMass()
	if avgMass > 0 && agent.Mass < avgMass*0.5 {
		ce.lastMessageTick[playerID] = tick
		return &CoachMessage{
			Type:    CoachStrategy,
			Message: "Farm orbs to grow stronger before fighting.",
		}
	}

	// Rule 5: Boosting with low mass
	if agent.Boosting && agent.Mass < 30 {
		ce.lastMessageTick[playerID] = tick
		return &CoachMessage{
			Type:    CoachEfficiency,
			Message: "Save your boost for kills — mass is low.",
		}
	}

	return nil
}

// Reset clears the debounce state (call on round reset).
func (ce *CoachEngine) Reset() {
	ce.lastMessageTick = make(map[string]uint64)
}

// ─── Arena helper ───

// getAverageMass returns the average mass of alive agents.
func (a *Arena) getAverageMass() float64 {
	total := 0.0
	count := 0
	for _, agent := range a.agents {
		if agent.Alive {
			total += agent.Mass
			count++
		}
	}
	if count == 0 {
		return 0
	}
	return total / float64(count)
}
