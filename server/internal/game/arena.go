package game

import (
	"context"
	"log/slog"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ArenaEventType classifies arena events emitted during a tick.
type ArenaEventType string

const (
	EventDeath         ArenaEventType = "death"
	EventKill          ArenaEventType = "kill"
	EventLevelUp       ArenaEventType = "level_up"
	EventAgentLevelUp  ArenaEventType = "agent_level_up"
	EventSynergy       ArenaEventType = "synergy"
	EventShrinkWarn    ArenaEventType = "shrink_warn"
	EventMapObjectUse  ArenaEventType = "map_object_use"
)

// ArenaEvent is a game event generated during a tick.
type ArenaEvent struct {
	Type      ArenaEventType
	AgentID   string
	AgentName string
	Data      interface{} // event-specific payload
}

// Arena is the 20Hz game loop orchestrator.
type Arena struct {
	mu              sync.RWMutex
	agents          map[string]*domain.Agent
	orbManager      *OrbManager
	collisionSystem *CollisionSystem
	arenaShrink     *ArenaShrink
	upgradeSystem   *UpgradeSystem
	spatialHash     *SpatialHash
	leaderboard     *Leaderboard
	mapObjects      *MapObjectManager

	tick         uint64
	running      bool
	eventBuffer  []ArenaEvent
	EventHandler func(events []ArenaEvent) // called at end of each tick with buffered events
}

// NewArena creates a new Arena with all subsystems initialized.
func NewArena() *Arena {
	sh := NewSpatialHash()
	return &Arena{
		agents:          make(map[string]*domain.Agent),
		orbManager:      NewOrbManager(ArenaRadius),
		collisionSystem: NewCollisionSystem(sh),
		arenaShrink:     NewArenaShrink(),
		upgradeSystem:   NewUpgradeSystem(),
		spatialHash:     sh,
		leaderboard:     NewLeaderboard(),
		mapObjects:      NewMapObjectManager(),
		tick:            0,
		running:         false,
		eventBuffer:     make([]ArenaEvent, 0, 64),
	}
}

// Run starts the 20Hz game loop. Blocks until ctx is cancelled.
func (a *Arena) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(TickInterval) * time.Millisecond)
	defer ticker.Stop()

	a.mu.Lock()
	a.running = true
	// Spawn initial natural orbs
	a.orbManager.SpawnNaturalOrbs(a.tick)
	a.mu.Unlock()

	for {
		select {
		case <-ctx.Done():
			a.mu.Lock()
			a.running = false
			a.mu.Unlock()
			return
		case <-ticker.C:
			a.safeProcessTick()
		}
	}
}

// safeProcessTick wraps processTick with panic recovery to prevent goroutine death.
func (a *Arena) safeProcessTick() {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("arena processTick panic recovered", "error", r, "tick", a.tick)
		}
	}()
	a.processTick()
}

// processTick executes one game tick with the correct ordering.
func (a *Arena) processTick() {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.tick++
	a.eventBuffer = a.eventBuffer[:0]

	// 1. Apply inputs (already applied via HandleInput)

	// 2. Move agents
	for _, agent := range a.agents {
		if !agent.Alive {
			continue
		}
		UpdateAgent(agent, a.tick)
		// Update spatial hash with new position
		a.spatialHash.Update(agent.ID, agent.Position.X, agent.Position.Y)
	}

	// 3. Collect orbs
	for _, agent := range a.agents {
		if !agent.Alive {
			continue
		}
		xp, mass := a.orbManager.CollectOrbs(agent, a.tick)
		if mass > 0 {
			AddMass(agent, mass)
		}
		if xp > 0 {
			leveled := AddXP(agent, xp)
			if leveled {
				a.handleLevelUp(agent)
			}
		}
	}

	// 4. Arena shrink
	radius, shouldWarn := a.arenaShrink.Update()
	a.orbManager.SetArenaRadius(radius)
	if shouldWarn {
		a.eventBuffer = append(a.eventBuffer, ArenaEvent{
			Type: EventShrinkWarn,
			Data: domain.ArenaShrinkWarning{
				SecondsUntilShrink: a.arenaShrink.GetSecondsUntilShrink(),
				NewRadius:          radius,
			},
		})
	}

	// 5. Collision processing (boundary, aura, dash)
	collisionEvents := a.collisionSystem.ProcessAll(a.agents, radius, a.tick)
	for _, ce := range collisionEvents {
		// Emit death event
		a.eventBuffer = append(a.eventBuffer, ArenaEvent{
			Type:      EventDeath,
			AgentID:   ce.VictimID,
			AgentName: ce.VictimName,
			Data:      ce,
		})

		// Emit kill event and credit
		if ce.KillerID != "" {
			if killer, ok := a.agents[ce.KillerID]; ok && killer.Alive {
				AddKill(killer)
				a.eventBuffer = append(a.eventBuffer, ArenaEvent{
					Type:      EventKill,
					AgentID:   ce.KillerID,
					AgentName: ce.KillerName,
					Data:      ce,
				})
			}
		}

		// Spawn death orbs
		if victim, ok := a.agents[ce.VictimID]; ok {
			a.orbManager.SpawnDeathOrbs(victim.Position, ce.VictimMass, a.tick)
		}
	}

	// 5b. Map object interactions
	a.mapObjects.Update(a.tick)
	activations := a.mapObjects.CheckCollisions(a.agents, a.tick)
	for _, act := range activations {
		agent, ok := a.agents[act.AgentID]
		if !ok || !agent.Alive {
			continue
		}
		effect := ApplyMapObjectEffect(agent, act.Object, a.mapObjects.config)
		a.eventBuffer = append(a.eventBuffer, ArenaEvent{
			Type:      EventMapObjectUse,
			AgentID:   act.AgentID,
			AgentName: agent.Name,
			Data: domain.MapObjectActivatedEvent{
				ObjectID:  act.Object.ID,
				Type:      string(act.Object.Type),
				AgentID:   act.AgentID,
				AgentName: agent.Name,
				Effect:    effect,
			},
		})
		// If altar caused a level-up, generate upgrade choices
		if act.Object.Type == MapObjUpgradeAltar && len(agent.PendingChoices) == 0 {
			a.handleLevelUp(agent)
		}
	}

	// 6. Check level-ups for agents that may have gained XP from kills
	for _, agent := range a.agents {
		if !agent.Alive {
			continue
		}
		if agent.XP >= agent.XPToNext && agent.Level < domain.MaxLevel && len(agent.PendingChoices) == 0 {
			a.handleLevelUp(agent)
		}
	}

	// 7. Remove expired orbs and replenish natural orbs
	a.orbManager.RemoveExpired(a.tick)
	a.orbManager.SpawnNaturalOrbs(a.tick)

	// 8. Process upgrade timeouts
	a.processUpgradeTimeouts()

	// 9. Update leaderboard periodically
	if a.tick%LeaderboardUpdateInterval == 0 {
		a.leaderboard.Update(a.agents)
	}

	// 10. Flush event buffer (with panic protection)
	if a.EventHandler != nil && len(a.eventBuffer) > 0 {
		events := make([]ArenaEvent, len(a.eventBuffer))
		copy(events, a.eventBuffer)
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("arena event handler panic", "error", r, "eventCount", len(events))
				}
			}()
			a.EventHandler(events)
		}()
	}
}

// handleLevelUp triggers a level-up and generates upgrade choices.
func (a *Arena) handleLevelUp(agent *domain.Agent) {
	PerformLevelUp(agent)

	choices := a.upgradeSystem.GenerateChoices(agent.Level, agent.Build)
	if choices == nil || len(choices) == 0 {
		return
	}

	agent.PendingChoices = choices
	agent.UpgradeDeadline = a.tick + UpgradeTimeoutTicks

	// Standard level_up event for human players
	a.eventBuffer = append(a.eventBuffer, ArenaEvent{
		Type:      EventLevelUp,
		AgentID:   agent.ID,
		AgentName: agent.Name,
		Data: domain.LevelUpEvent{
			Level:        agent.Level,
			Choices:      choices,
			TimeoutTicks: UpgradeTimeoutTicks,
			CurrentBuild: agent.Build,
		},
	})

	// Enriched agent_level_up event for AI agents (S46)
	if agent.IsAgent {
		a.eventBuffer = append(a.eventBuffer, ArenaEvent{
			Type:      EventAgentLevelUp,
			AgentID:   agent.ID,
			AgentName: agent.Name,
			Data:      a.buildAgentLevelUpEvent(agent, choices),
		})
	}
}

// buildAgentLevelUpEvent creates an enriched level_up event for AI agents.
func (a *Arena) buildAgentLevelUpEvent(agent *domain.Agent, choices []domain.UpgradeChoice) domain.AgentLevelUpEvent {
	// Compute nearby synergies (synergies that are 1 upgrade away)
	nearbySynergies := computeNearbySynergies(agent)

	// Compute nearby threats
	nearbyThreats := 0
	threatRadius := AuraRadius * 4.0
	for _, other := range a.agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		dist := DistanceSq(agent.Position, other.Position)
		if dist < threatRadius*threatRadius {
			nearbyThreats++
		}
	}

	// Compute rank
	rank := a.leaderboard.GetAgentRankInFinal(a.agents, agent.ID)

	// Compute time remaining (approximate from tick)
	roundDuration := uint64(DefaultRoomConfig().RoundDurationSec * TickRate)
	timeRemainingSec := 0
	if roundDuration > a.tick {
		timeRemainingSec = int((roundDuration - a.tick) / uint64(TickRate))
	}

	return domain.AgentLevelUpEvent{
		Level:   agent.Level,
		Choices: choices,
		CurrentBuild: domain.AgentBuildInfo{
			Tomes:           agent.Build.Tomes,
			Abilities:       agent.Build.AbilitySlots,
			ActiveSynergies: agent.ActiveSynergies,
			NearbySynergies: nearbySynergies,
		},
		GameContext: domain.AgentGameContext{
			TimeRemaining: timeRemainingSec,
			MyRank:        rank,
			MyMass:        agent.Mass,
			NearbyThreats: nearbyThreats,
			ArenaRadius:   a.arenaShrink.GetCurrentRadius(),
		},
		Deadline: 5000, // 5 seconds in milliseconds
	}
}

// computeNearbySynergies returns synergy IDs that are 1 upgrade away from completion.
func computeNearbySynergies(agent *domain.Agent) []string {
	var nearby []string
	for _, synergy := range domain.AllSynergies {
		// Skip already active
		alreadyActive := false
		for _, active := range agent.ActiveSynergies {
			if active == synergy.ID {
				alreadyActive = true
				break
			}
		}
		if alreadyActive {
			continue
		}

		// Count remaining requirements
		remaining := 0
		for tome, required := range synergy.TomeReqs {
			if agent.Build.Tomes[tome] < required {
				remaining += required - agent.Build.Tomes[tome]
			}
		}
		for ability, requiredLevel := range synergy.AbilityReqs {
			found := false
			for _, slot := range agent.Build.AbilitySlots {
				if slot.Type == ability && slot.Level >= requiredLevel {
					found = true
					break
				}
			}
			if !found {
				remaining++
			}
		}

		if remaining == 1 {
			nearby = append(nearby, synergy.ID)
		}
	}
	return nearby
}

// processUpgradeTimeouts auto-selects for agents who didn't choose in time.
func (a *Arena) processUpgradeTimeouts() {
	for _, agent := range a.agents {
		if !agent.Alive || len(agent.PendingChoices) == 0 {
			continue
		}
		if a.tick >= agent.UpgradeDeadline {
			// Auto-select first choice
			a.upgradeSystem.ApplyUpgrade(agent, agent.PendingChoices[0])
			agent.PendingChoices = nil
			agent.UpgradeDeadline = 0

			// Check synergies after auto-upgrade
			newSynergies := a.upgradeSystem.CheckSynergies(agent)
			for _, synID := range newSynergies {
				synDef := domain.GetSynergyDef(synID)
				if synDef != nil {
					a.eventBuffer = append(a.eventBuffer, ArenaEvent{
						Type:      EventSynergy,
						AgentID:   agent.ID,
						AgentName: agent.Name,
						Data: domain.SynergyActivatedEvent{
							SynergyID:   synDef.ID,
							Name:        synDef.Name,
							Description: synDef.Description,
						},
					})
				}
			}
		}
	}
}

// --- Public API (thread-safe via mutex) ---

// HandleInput processes a player input.
func (a *Arena) HandleInput(agentID string, angle float64, boost bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	agent, ok := a.agents[agentID]
	if !ok || !agent.Alive {
		return
	}
	ApplyInput(agent, angle, boost)
}

// ChooseUpgrade applies a chosen upgrade for an agent.
func (a *Arena) ChooseUpgrade(agentID string, choiceIndex int) {
	a.mu.Lock()
	defer a.mu.Unlock()

	agent, ok := a.agents[agentID]
	if !ok || !agent.Alive {
		return
	}
	if len(agent.PendingChoices) == 0 {
		return
	}
	if choiceIndex < 0 || choiceIndex >= len(agent.PendingChoices) {
		return
	}

	choice := agent.PendingChoices[choiceIndex]
	a.upgradeSystem.ApplyUpgrade(agent, choice)
	agent.PendingChoices = nil
	agent.UpgradeDeadline = 0

	// Check synergies after upgrade
	newSynergies := a.upgradeSystem.CheckSynergies(agent)
	for _, synID := range newSynergies {
		synDef := domain.GetSynergyDef(synID)
		if synDef != nil {
			a.eventBuffer = append(a.eventBuffer, ArenaEvent{
				Type:      EventSynergy,
				AgentID:   agent.ID,
				AgentName: agent.Name,
				Data: domain.SynergyActivatedEvent{
					SynergyID:   synDef.ID,
					Name:        synDef.Name,
					Description: synDef.Description,
				},
			})
		}
	}
}

// AddAgent adds a new agent to the arena.
func (a *Arena) AddAgent(agent *domain.Agent) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.agents[agent.ID] = agent
	a.spatialHash.Insert(agent.ID, agent.Position.X, agent.Position.Y)
}

// RemoveAgent removes an agent from the arena.
func (a *Arena) RemoveAgent(agentID string) {
	a.mu.Lock()
	defer a.mu.Unlock()

	delete(a.agents, agentID)
	a.spatialHash.Remove(agentID)
}

// GetAgent returns an agent by ID (read-locked).
func (a *Arena) GetAgent(agentID string) (*domain.Agent, bool) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	agent, ok := a.agents[agentID]
	return agent, ok
}

// GetAgents returns a snapshot copy of all agents (safe for concurrent iteration).
func (a *Arena) GetAgents() map[string]*domain.Agent {
	a.mu.RLock()
	defer a.mu.RUnlock()
	snapshot := make(map[string]*domain.Agent, len(a.agents))
	for k, v := range a.agents {
		snapshot[k] = v
	}
	return snapshot
}

// GetTick returns the current tick count.
func (a *Arena) GetTick() uint64 {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.tick
}

// GetCurrentRadius returns the current arena boundary radius.
func (a *Arena) GetCurrentRadius() float64 {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.arenaShrink.GetCurrentRadius()
}

// BroadcastSnapshot holds a thread-safe copy of all state needed for broadcasting.
type BroadcastSnapshot struct {
	Agents      map[string]*domain.Agent
	Orbs        map[string]*domain.Orb
	Leaderboard []domain.LeaderboardEntry
	Tick        uint64
	Radius      float64
}

// GetBroadcastSnapshot atomically captures all state needed for broadcasting
// under a single read lock (prevents concurrent map access crashes).
func (a *Arena) GetBroadcastSnapshot() BroadcastSnapshot {
	a.mu.RLock()
	defer a.mu.RUnlock()

	agentsCopy := make(map[string]*domain.Agent, len(a.agents))
	for k, v := range a.agents {
		agentsCopy[k] = v
	}

	orbsCopy := make(map[string]*domain.Orb, len(a.orbManager.orbs))
	for k, v := range a.orbManager.orbs {
		orbsCopy[k] = v
	}

	lbEntries := a.leaderboard.entries
	lbCopy := make([]domain.LeaderboardEntry, len(lbEntries))
	copy(lbCopy, lbEntries)

	return BroadcastSnapshot{
		Agents:      agentsCopy,
		Orbs:        orbsCopy,
		Leaderboard: lbCopy,
		Tick:        a.tick,
		Radius:      a.arenaShrink.GetCurrentRadius(),
	}
}

// GetOrbManager returns the orb manager (for serialization).
func (a *Arena) GetOrbManager() *OrbManager {
	return a.orbManager
}

// GetLeaderboard returns the leaderboard.
func (a *Arena) GetLeaderboard() *Leaderboard {
	return a.leaderboard
}

// GetMapObjects returns the map object manager.
func (a *Arena) GetMapObjects() *MapObjectManager {
	return a.mapObjects
}

// GetShrinkInfo returns arena shrink status for broadcasting.
func (a *Arena) GetShrinkInfo() domain.ArenaShrinkEvent {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return domain.ArenaShrinkEvent{
		CurrentRadius: a.arenaShrink.GetCurrentRadius(),
		MinRadius:     ArenaMinRadius,
		ShrinkRate:    a.arenaShrink.GetShrinkRate(),
	}
}

// AliveCount returns the number of alive agents.
func (a *Arena) AliveCount() int {
	a.mu.RLock()
	defer a.mu.RUnlock()

	count := 0
	for _, agent := range a.agents {
		if agent.Alive {
			count++
		}
	}
	return count
}

// AliveHumanCount returns the number of alive human (non-bot) agents.
func (a *Arena) AliveHumanCount() int {
	a.mu.RLock()
	defer a.mu.RUnlock()

	count := 0
	for _, agent := range a.agents {
		if agent.Alive && !agent.IsBot {
			count++
		}
	}
	return count
}

// AgentCount returns the total number of agents (alive + dead).
func (a *Arena) AgentCount() int {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return len(a.agents)
}

// RandomSpawnPosition returns a random position within the spawn zone.
func (a *Arena) RandomSpawnPosition() domain.Position {
	a.mu.RLock()
	defer a.mu.RUnlock()

	maxR := a.arenaShrink.GetCurrentRadius() * SpawnMarginRatio
	angle := rand.Float64() * 2 * math.Pi
	r := maxR * math.Sqrt(rand.Float64())
	return domain.Position{
		X: math.Cos(angle) * r,
		Y: math.Sin(angle) * r,
	}
}

// Reset clears all agents/orbs and resets subsystems for a new round.
func (a *Arena) Reset() {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.agents = make(map[string]*domain.Agent)
	a.spatialHash.Clear()
	a.orbManager.Clear()
	a.arenaShrink.Reset()
	a.leaderboard.Reset()
	a.mapObjects.Reset()
	a.mapObjects.PlaceObjects(ArenaRadius)
	a.tick = 0
	a.eventBuffer = a.eventBuffer[:0]

	// Spawn initial orbs
	a.orbManager.SpawnNaturalOrbs(a.tick)
}

// IsRunning returns whether the game loop is active.
func (a *Arena) IsRunning() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.running
}
