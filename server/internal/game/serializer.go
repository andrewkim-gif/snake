package game

import (
	"math"

	"github.com/to-nexus/snake-server/internal/domain"
)

// OrbTypeMap maps domain OrbType to network int.
var OrbTypeMap = map[domain.OrbType]int{
	domain.OrbNatural:    0,
	domain.OrbDeath:      1,
	domain.OrbBoostTrail: 2,
	domain.OrbMagnet:     3,
	domain.OrbSpeed:      4,
	domain.OrbGhost:      5,
	domain.OrbMega:       6,
}

// EffectTypeMap maps domain EffectType to network int.
var EffectTypeMap = map[domain.EffectType]int{
	domain.EffectMagnet: 0,
	domain.EffectSpeed:  1,
	domain.EffectGhost:  2,
}

// StateSerializer handles viewport culling and state serialization.
type StateSerializer struct{}

// NewStateSerializer creates a new serializer.
func NewStateSerializer() *StateSerializer {
	return &StateSerializer{}
}

// SerializeForPlayer creates a StatePayload with viewport-culled data for a specific player.
func (s *StateSerializer) SerializeForPlayer(
	playerID string,
	agents map[string]*Agent,
	orbs map[uint64]*domain.Orb,
	leaderboard []domain.LeaderEntry,
	tick uint64,
	arenaRadius float64,
	mapObjectStates ...[]MapObjectState,
) *domain.StatePayload {
	player, ok := agents[playerID]
	if !ok {
		return nil
	}

	// Determine viewport center
	var center domain.Position
	if player.Alive {
		center = player.Position
	} else {
		center = domain.Position{X: 0, Y: 0}
	}

	// Calculate viewport size based on mass (zoom out as mass increases)
	viewportHalfW := s.calcViewportHalf(player.Mass) + float64(ViewportMargin)
	viewportHalfH := viewportHalfW * 0.75 // 4:3 aspect

	// Serialize visible agents
	visibleAgents := make([]domain.AgentNetworkData, 0, 32)
	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		dx := math.Abs(agent.Position.X - center.X)
		dy := math.Abs(agent.Position.Y - center.Y)
		if dx < viewportHalfW+500 && dy < viewportHalfH+500 {
			visibleAgents = append(visibleAgents, s.serializeAgent(agent, tick))
		}
	}

	// Serialize visible orbs
	visibleOrbs := make([]domain.OrbNetworkData, 0, 128)
	for _, orb := range orbs {
		dx := math.Abs(orb.Position.X - center.X)
		dy := math.Abs(orb.Position.Y - center.Y)
		if dx < viewportHalfW && dy < viewportHalfH {
			visibleOrbs = append(visibleOrbs, domain.OrbNetworkData{
				X: math.Round(orb.Position.X),
				Y: math.Round(orb.Position.Y),
				V: orb.Value,
				C: orb.Color,
				T: OrbTypeMap[orb.Type],
			})
		}
	}

	payload := &domain.StatePayload{
		T: tick,
		S: visibleAgents,
		O: visibleOrbs,
	}

	// Include leaderboard periodically
	if tick%uint64(LeaderboardInterval) == 0 {
		payload.L = leaderboard
	}

	// Include map objects periodically (every 20 ticks = 1Hz)
	if tick%20 == 0 && len(mapObjectStates) > 0 && len(mapObjectStates[0]) > 0 {
		moData := make([]domain.MapObjectNetworkData, len(mapObjectStates[0]))
		for i, mo := range mapObjectStates[0] {
			moData[i] = domain.MapObjectNetworkData{
				ID:     mo.ID,
				Type:   string(mo.Type),
				X:      mo.X,
				Y:      mo.Y,
				R:      mo.Radius,
				Active: mo.Active,
			}
		}
		payload.MO = moData
	}

	return payload
}

// calcViewportHalf calculates the viewport half-width based on mass (zoom level).
func (s *StateSerializer) calcViewportHalf(mass float64) float64 {
	// Base viewport: 960px half-width
	// Zoom out as mass increases: mass 10 → 960, mass 200 → 1920
	base := 960.0
	zoomFactor := 1.0 + (mass-10)/190
	if zoomFactor < 1.0 {
		zoomFactor = 1.0
	}
	if zoomFactor > 3.0 {
		zoomFactor = 3.0
	}
	return base * zoomFactor
}

// SerializeMinimap creates a minimap payload with all alive agents.
func (s *StateSerializer) SerializeMinimap(
	playerID string,
	agents map[string]*Agent,
	arenaRadius float64,
) *domain.MinimapPayload {
	entries := make([]domain.MinimapAgent, 0, len(agents))
	for _, agent := range agents {
		if !agent.Alive {
			continue
		}
		entries = append(entries, domain.MinimapAgent{
			X:  math.Round(agent.Position.X),
			Y:  math.Round(agent.Position.Y),
			M:  agent.Mass,
			Me: agent.ID == playerID,
		})
	}
	return &domain.MinimapPayload{
		Snakes:   entries,
		Boundary: arenaRadius,
	}
}

// SerializeDeathInfo creates death information for a player.
func (s *StateSerializer) SerializeDeathInfo(
	playerID string,
	agents map[string]*Agent,
	leaderboard []domain.LeaderEntry,
	tick uint64,
) *domain.DeathPayload {
	agent, ok := agents[playerID]
	if !ok {
		return nil
	}

	// Calculate duration in seconds
	var duration float64
	if tick > agent.JoinedAt {
		duration = float64(tick-agent.JoinedAt) / 20.0 // 20Hz
	}

	// Find rank
	rank := len(agents) // default: last
	for _, entry := range leaderboard {
		if entry.ID == playerID {
			rank = entry.Rank
			break
		}
	}

	return &domain.DeathPayload{
		Score:    agent.Score,
		Kills:    agent.Kills,
		Duration: duration,
		Rank:     rank,
		Killer:   agent.LastDamagedBy,
		Level:    agent.Level,
	}
}

// serializeAgent converts an agent to network data.
func (s *StateSerializer) serializeAgent(agent *Agent, tick uint64) domain.AgentNetworkData {
	pos := agent.Position
	point := []float64{
		math.Round(pos.X*10) / 10,
		math.Round(pos.Y*10) / 10,
	}

	data := domain.AgentNetworkData{
		I:  agent.ID,
		N:  agent.Name,
		X:  pos.X,
		Y:  pos.Y,
		H:  math.Round(agent.Heading*100) / 100,
		M:  agent.Mass,
		B:  agent.Boosting,
		K:  agent.Skin.ID,
		LV: agent.Level,
		P:  [][]float64{point}, // Single position as segment compat
	}

	// Serialize active effects
	if len(agent.ActiveEffects) > 0 {
		effects := make([]int, 0, len(agent.ActiveEffects)*2)
		for _, e := range agent.ActiveEffects {
			typeInt, ok := EffectTypeMap[e.Type]
			if !ok {
				continue
			}
			remaining := 0
			if e.ExpiresAt > tick {
				remaining = int(e.ExpiresAt - tick)
			}
			effects = append(effects, typeInt, remaining)
		}
		data.E = effects
	}

	return data
}
