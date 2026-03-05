package game

import (
	"math"

	"github.com/to-nexus/snake-server/internal/domain"
)

// InputMsg represents a player input to be processed.
type InputMsg struct {
	AgentID string
	Angle   float64
	Boost   int
	Seq     int
}

// LevelUpEvent records a level-up that occurred this tick.
type LevelUpEvent struct {
	AgentID string
	Level   int
}

// Arena is the 20Hz game loop orchestrator containing all game subsystems.
type Arena struct {
	Config      ArenaConfig
	agents      map[string]*Agent
	orbManager  *OrbManager
	spatialHash *SpatialHash
	collision   *CollisionSystem
	leaderboard *Leaderboard
	shrink      *ArenaShrink
	upgrade     *UpgradeSystem
	serializer  *StateSerializer
	mapObjects  *MapObjectManager
	tick        uint64

	// Per-tick event accumulators (reset each tick)
	deathEvents []DeathEvent
	levelUps    []LevelUpEvent
}

// NewArena creates and initializes a new Arena with all subsystems.
func NewArena(cfg ArenaConfig) *Arena {
	a := &Arena{
		Config:      cfg,
		agents:      make(map[string]*Agent, 64),
		orbManager:  NewOrbManager(cfg),
		spatialHash: NewSpatialHash(cfg.ArenaRadius, 200),
		collision:   NewCollisionSystem(),
		leaderboard: NewLeaderboard(10),
		shrink:      NewArenaShrink(cfg),
		upgrade:     NewUpgradeSystem(),
		serializer:  NewStateSerializer(),
		mapObjects:  NewMapObjectManager(cfg.ArenaRadius),
		tick:        0,
		deathEvents: make([]DeathEvent, 0, 16),
		levelUps:    make([]LevelUpEvent, 0, 8),
	}

	// Initialize orbs
	a.orbManager.Initialize()

	return a
}

// Tick executes one game loop iteration (called at 20Hz from Room goroutine).
func (a *Arena) Tick() {
	a.tick++
	a.deathEvents = a.deathEvents[:0]
	a.levelUps = a.levelUps[:0]

	// 0. Bot AI — BotManager is nil initially (connected in S24)
	// (BotManager.Update is called externally before Tick if available)

	// 1. Agent physics update
	for _, agent := range a.agents {
		if agent.Alive {
			agent.Update(a.Config)
		}
	}

	// 2. Arena shrink
	a.shrink.Update(a.agents)

	// 3. Spatial Hash rebuild
	a.spatialHash.Clear()
	for id, agent := range a.agents {
		if agent.Alive {
			a.spatialHash.InsertAgent(id, agent.Position)
		}
	}
	a.orbManager.InsertAllToHash(a.spatialHash)

	// 4. Aura combat (DPS exchange)
	a.collision.ProcessAura(a.agents, a.spatialHash, a.Config, a.tick)

	// 5. Dash collisions
	a.collision.ProcessDash(a.agents, a.spatialHash, a.Config)

	// 6. Death detection + processing
	currentRadius := a.shrink.CurrentRadius()
	deaths := a.collision.DetectDeaths(a.agents, currentRadius)
	a.collision.ProcessDeaths(deaths, a.agents, a.orbManager, a.tick)
	a.deathEvents = append(a.deathEvents, deaths...)

	// 7. Kill XP rewards
	a.processKillRewards(deaths)

	// 8. Effect processing (magnet pull, etc.)
	a.processEffects()

	// 9. Orb collection + XP
	a.processOrbCollection()

	// 10. Upgrade timeout
	a.upgrade.ProcessTimeouts(a.agents, a.tick)

	// 11. Leaderboard update (every LeaderboardInterval ticks)
	if a.tick%uint64(LeaderboardInterval) == 0 {
		a.leaderboard.Update(a.agents)
	}

	// 12. Natural orb maintenance
	a.orbManager.Maintain(a.tick)

	// 13. Expired orb cleanup (every 20 ticks = 1s)
	if a.tick%20 == 0 {
		a.orbManager.CleanExpired(a.tick)
	}

	// 14. Map object tick (cooldown recovery)
	a.mapObjects.Tick(a.tick)

	// 15. Map object interactions (agent proximity checks)
	a.mapObjects.ProcessInteractions(a.agents, a)
}

// processKillRewards grants XP to killers.
func (a *Arena) processKillRewards(deaths []DeathEvent) {
	for _, death := range deaths {
		if death.KillerID == "" {
			continue
		}
		killer, ok := a.agents[death.KillerID]
		if !ok || !killer.Alive {
			continue
		}

		// Calculate base XP from kill
		var baseXP int
		if death.DamageSource == domain.DamageSourceDash {
			baseXP = domain.XPDashKillBase + death.VictimLevel*domain.XPDashKillPerLevel
		} else {
			baseXP = domain.XPAuraKillBase + death.VictimLevel*domain.XPAuraKillPerLevel
		}

		streakMult := killer.GetKillStreakMultiplier()
		didLevelUp := killer.AddXP(int(float64(baseXP) * streakMult))
		if didLevelUp {
			a.processLevelUp(killer)
		}
	}
}

// processLevelUp generates upgrade choices for a leveled-up agent.
func (a *Arena) processLevelUp(agent *Agent) {
	choices := a.upgrade.GenerateChoices(agent)
	agent.PendingChoices = choices
	agent.UpgradeDeadline = a.tick + uint64(a.Config.UpgradeChoiceTimeout)

	a.levelUps = append(a.levelUps, LevelUpEvent{
		AgentID: agent.ID,
		Level:   agent.Level,
	})
}

// processEffects handles active effects: magnet pull, expired effects.
func (a *Arena) processEffects() {
	for _, agent := range a.agents {
		if !agent.Alive {
			continue
		}
		agent.RemoveExpiredEffects(a.tick)

		// Magnet effect: pull nearby orbs toward agent
		if agent.HasEffect(domain.EffectMagnet) {
			nearbyOrbs := a.spatialHash.QueryOrbs(agent.Position, MagnetPullRadius)
			for _, orbEntry := range nearbyOrbs {
				a.orbManager.PullOrbToward(orbEntry.OrbID, agent.Position, MagnetPullSpeed)
			}
		}
	}
}

// processOrbCollection checks all agents for orb collection.
func (a *Arena) processOrbCollection() {
	for _, agent := range a.agents {
		if !agent.Alive {
			continue
		}

		magnetActive := agent.HasEffect(domain.EffectMagnet)
		baseR := agent.GetCollectRadius(a.Config)
		r := baseR
		if magnetActive {
			r += MagnetPullRadius
		}

		nearbyOrbs := a.spatialHash.QueryOrbs(agent.Position, r)

		for _, orbEntry := range nearbyOrbs {
			dx := agent.Position.X - orbEntry.X
			dy := agent.Position.Y - orbEntry.Y
			distSq := dx*dx + dy*dy

			if distSq < r*r {
				orb, ok := a.orbManager.GetOrb(orbEntry.OrbID)
				if !ok {
					continue
				}
				a.collectOrb(agent, orb)
			}
		}
	}
}

// collectOrb processes a single orb collection by an agent.
func (a *Arena) collectOrb(agent *Agent, orb *domain.Orb) {
	// Effect orbs
	switch orb.Type {
	case domain.OrbMagnet:
		if agent.CanPickupEffect(domain.EffectMagnet, a.tick) {
			agent.AddEffect(domain.EffectMagnet, MagnetDurationTicks, a.tick)
		}
		a.orbManager.RemoveOrb(orb.ID)
		return
	case domain.OrbSpeed:
		if agent.CanPickupEffect(domain.EffectSpeed, a.tick) {
			agent.AddEffect(domain.EffectSpeed, SpeedDurationTicks, a.tick)
		}
		a.orbManager.RemoveOrb(orb.ID)
		return
	case domain.OrbGhost:
		if agent.CanPickupEffect(domain.EffectGhost, a.tick) {
			agent.AddEffect(domain.EffectGhost, GhostDurationTicks, a.tick)
		}
		a.orbManager.RemoveOrb(orb.ID)
		return
	}

	// Mass + XP orbs
	agent.AddMass(orb.Value)

	var xpAmount int
	switch orb.Type {
	case domain.OrbDeath:
		xpAmount = domain.XPDeathOrb
	case domain.OrbMega:
		xpAmount = domain.XPPowerUpOrb
	default:
		xpAmount = domain.XPNaturalOrb
	}

	// Pacifist synergy: orb value x3
	if agent.HasSynergy("pacifist") {
		xpAmount *= 3
	}

	didLevelUp := agent.AddXP(xpAmount)
	if didLevelUp {
		a.processLevelUp(agent)
	}

	a.orbManager.RemoveOrb(orb.ID)
}

// ─── Public API (called by Room) ───

// ApplyInput applies a player's input message.
func (a *Arena) ApplyInput(msg InputMsg) {
	agent, ok := a.agents[msg.AgentID]
	if ok && agent.Alive {
		agent.ApplyInput(msg.Angle, msg.Boost, msg.Seq)
	}
}

// AddAgent creates and adds an agent to the arena.
func (a *Arena) AddAgent(id, name string, skinID int, pos domain.Position) *Agent {
	agent := NewAgent(id, name, skinID, pos, a.tick)
	agent.InitWithConfig(a.Config, a.tick)
	a.agents[id] = agent
	return agent
}

// RemoveAgent removes an agent, decomposing its mass into orbs if alive.
func (a *Arena) RemoveAgent(id string) {
	agent, ok := a.agents[id]
	if !ok {
		return
	}
	if agent.Alive && agent.Mass > 0 {
		a.orbManager.SpawnDeathOrbs(agent.Position, agent.Mass, a.tick)
	}
	delete(a.agents, id)
}

// RespawnAgent respawns an existing agent at a new random position.
func (a *Arena) RespawnAgent(id string) *Agent {
	agent, ok := a.agents[id]
	if !ok {
		return nil
	}
	pos := RandomPositionInCircle(a.Config.ArenaRadius * 0.6)
	agent.Respawn(a.Config, pos, a.tick)
	return agent
}

// ChooseUpgrade applies a player's upgrade choice.
func (a *Arena) ChooseUpgrade(agentID, choiceID string) bool {
	agent, ok := a.agents[agentID]
	if !ok {
		return false
	}
	err := a.upgrade.ApplyChoice(agent, choiceID)
	if err != nil {
		return false
	}
	// Update synergies
	agent.ActiveSynergies = a.upgrade.CheckSynergies(agent.Build)
	return true
}

// ─── State Getters ───

// GetAgent returns an agent by ID.
func (a *Arena) GetAgent(id string) (*Agent, bool) {
	agent, ok := a.agents[id]
	return agent, ok
}

// GetAgents returns the agents map.
func (a *Arena) GetAgents() map[string]*Agent {
	return a.agents
}

// GetTick returns the current tick.
func (a *Arena) GetTick() uint64 {
	return a.tick
}

// GetCurrentRadius returns the current arena shrink radius.
func (a *Arena) GetCurrentRadius() float64 {
	return a.shrink.CurrentRadius()
}

// GetLeaderboard returns the current leaderboard entries.
func (a *Arena) GetLeaderboard() []domain.LeaderEntry {
	return a.leaderboard.GetEntries()
}

// GetLeaderboardRank returns the rank of a player.
func (a *Arena) GetLeaderboardRank(playerID string) int {
	return a.leaderboard.GetRank(playerID, len(a.agents))
}

// GetOrbCount returns the total number of orbs.
func (a *Arena) GetOrbCount() int {
	return a.orbManager.GetCount()
}

// GetOrbs returns all orbs (for serialization).
func (a *Arena) GetOrbs() map[uint64]*domain.Orb {
	return a.orbManager.GetAll()
}

// GetPlayerCount returns the total agent count.
func (a *Arena) GetPlayerCount() int {
	return len(a.agents)
}

// ConsumeDeathEvents returns and clears the death events from the last tick.
func (a *Arena) ConsumeDeathEvents() []DeathEvent {
	events := make([]DeathEvent, len(a.deathEvents))
	copy(events, a.deathEvents)
	return events
}

// ConsumeLevelUps returns and clears the level-up events from the last tick.
func (a *Arena) ConsumeLevelUps() []LevelUpEvent {
	events := make([]LevelUpEvent, len(a.levelUps))
	copy(events, a.levelUps)
	return events
}

// SerializeForPlayer creates state payload for a specific player.
func (a *Arena) SerializeForPlayer(playerID string) *domain.StatePayload {
	return a.serializer.SerializeForPlayer(
		playerID,
		a.agents,
		a.orbManager.GetAll(),
		a.leaderboard.GetEntries(),
		a.tick,
		a.shrink.CurrentRadius(),
		a.mapObjects.GetStates(),
	)
}

// SerializeMinimap creates minimap data for a specific player.
func (a *Arena) SerializeMinimap(playerID string) *domain.MinimapPayload {
	return a.serializer.SerializeMinimap(
		playerID,
		a.agents,
		a.shrink.CurrentRadius(),
	)
}

// SerializeDeathInfo creates death info for a specific player.
func (a *Arena) SerializeDeathInfo(playerID string) *domain.DeathPayload {
	return a.serializer.SerializeDeathInfo(
		playerID,
		a.agents,
		a.leaderboard.GetEntries(),
		a.tick,
	)
}

// ResetForNewRound resets the arena for a new round.
func (a *Arena) ResetForNewRound() {
	// Clear all agents
	for id := range a.agents {
		delete(a.agents, id)
	}

	// Reset subsystems
	a.orbManager = NewOrbManager(a.Config)
	a.orbManager.Initialize()
	a.shrink.Reset(a.Config.ArenaRadius)
	a.leaderboard = NewLeaderboard(10)
	a.mapObjects.Reset(a.Config.ArenaRadius)
	a.tick = 0
	a.deathEvents = a.deathEvents[:0]
	a.levelUps = a.levelUps[:0]
}

// ─── Bot AI Helpers ───

// FindNearestOrb finds the nearest orb to the given position within searchRadius.
func (a *Arena) FindNearestOrb(pos domain.Position, searchRadius float64) *domain.Position {
	orbs := a.spatialHash.QueryOrbs(pos, searchRadius)
	if len(orbs) == 0 {
		return nil
	}

	var nearest *domain.Position
	minDist := math.MaxFloat64
	for _, o := range orbs {
		dx := o.X - pos.X
		dy := o.Y - pos.Y
		d := dx*dx + dy*dy
		if d < minDist {
			minDist = d
			p := domain.Position{X: o.X, Y: o.Y}
			nearest = &p
		}
	}
	return nearest
}

// FindNearbyAgent finds the nearest alive agent (excluding excludeID) within radius.
func (a *Arena) FindNearbyAgent(excludeID string, pos domain.Position, radius float64) *Agent {
	rSq := radius * radius
	var nearest *Agent
	minDist := math.MaxFloat64

	for _, agent := range a.agents {
		if !agent.Alive || agent.ID == excludeID {
			continue
		}
		dx := agent.Position.X - pos.X
		dy := agent.Position.Y - pos.Y
		d := dx*dx + dy*dy
		if d < rSq && d < minDist {
			minDist = d
			nearest = agent
		}
	}
	return nearest
}

// GetAliveCount returns the count of alive agents.
func (a *Arena) GetAliveCount() int {
	count := 0
	for _, agent := range a.agents {
		if agent.Alive {
			count++
		}
	}
	return count
}

// GetShrink returns the arena shrink system.
func (a *Arena) GetShrink() *ArenaShrink {
	return a.shrink
}

// GetMapObjects returns the map object manager.
func (a *Arena) GetMapObjects() *MapObjectManager {
	return a.mapObjects
}

// GetMapObjectStates returns serializable map object states.
func (a *Arena) GetMapObjectStates() []MapObjectState {
	return a.mapObjects.GetStates()
}
