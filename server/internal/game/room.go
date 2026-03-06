package game

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// RoomEventType classifies room lifecycle events.
type RoomEventType string

const (
	RoomEvtDeath         RoomEventType = "death"
	RoomEvtKill          RoomEventType = "kill"
	RoomEvtLevelUp       RoomEventType = "level_up"
	RoomEvtAgentLevelUp  RoomEventType = "agent_level_up"
	RoomEvtSynergy       RoomEventType = "synergy"
	RoomEvtShrinkWarn    RoomEventType = "shrink_warn"
	RoomEvtRoundStart    RoomEventType = "round_start"
	RoomEvtRoundEnd      RoomEventType = "round_end"
	RoomEvtRoundReset    RoomEventType = "round_reset"
	RoomEvtState         RoomEventType = "state"
	RoomEvtMinimap       RoomEventType = "minimap"
	RoomEvtArenaShrink   RoomEventType = "arena_shrink"
	RoomEvtCoachMessage  RoomEventType = "coach_message"
	RoomEvtRoundAnalysis RoomEventType = "round_analysis"
)

// RoomEvent is a lifecycle event emitted by a Room.
type RoomEvent struct {
	RoomID    string
	Type      RoomEventType
	TargetID  string      // specific client (death/kill/level_up), empty = broadcast to room
	Data      interface{} // event-specific payload
}

// RoomEventCallback is called when a Room emits events.
// Implemented by main.go to bridge game→ws packages without circular imports.
type RoomEventCallback func(events []RoomEvent)

// PlayerInfo holds metadata about a human player in a room.
type PlayerInfo struct {
	ID     string
	Name   string
	SkinID int
}

// Room wraps an Arena with a state machine for round lifecycle management.
type Room struct {
	mu sync.RWMutex

	ID     string
	Name   string
	Config RoomConfig

	state       domain.RoomState
	arena       *Arena
	botManager  *BotManager
	serializer  *StateSerializer

	// Players: human players in this room
	players map[string]*PlayerInfo

	// Round tracking
	round         int
	stateTicksLeft int // ticks remaining in current state
	roundStartTick uint64

	// Recent winners for lobby display
	recentWinners []domain.WinnerInfo

	// Coach Agent (S57) - generates real-time coaching advice
	coachAgent *CoachAgent

	// Analyst Agent (S58) - generates post-round analysis
	analystAgent *AnalystAgent

	// Event callback (set by main.go)
	OnEvents RoomEventCallback

	// Arena cancel func (to stop arena loop)
	arenaCancel context.CancelFunc
}

// NewRoom creates a new Room with the given configuration.
func NewRoom(id, name string, cfg RoomConfig) *Room {
	return &Room{
		ID:            id,
		Name:          name,
		Config:        cfg,
		state:         domain.RoomStateWaiting,
		arena:         NewArena(),
		botManager:    NewBotManager(cfg.MaxBotsPerRoom),
		serializer:    NewStateSerializer(),
		players:       make(map[string]*PlayerInfo),
		round:         0,
		stateTicksLeft: 0,
		recentWinners: make([]domain.WinnerInfo, 0, 5),
		coachAgent:    NewCoachAgent(),
		analystAgent:  NewAnalystAgent(),
	}
}

// Run starts the room state machine tick loop. Blocks until ctx is cancelled.
func (r *Room) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(TickInterval) * time.Millisecond)
	defer ticker.Stop()

	slog.Info("room started", "roomId", r.ID, "name", r.Name)

	for {
		select {
		case <-ctx.Done():
			r.stopArena()
			slog.Info("room stopped", "roomId", r.ID)
			return
		case <-ticker.C:
			r.tick()
		}
	}
}

// tick processes one room tick (state machine + broadcasting).
func (r *Room) tick() {
	r.mu.Lock()
	defer r.mu.Unlock()

	switch r.state {
	case domain.RoomStateWaiting:
		r.tickWaiting()
	case domain.RoomStateCountdown:
		r.tickCountdown()
	case domain.RoomStatePlaying:
		r.tickPlaying()
	case domain.RoomStateEnding:
		r.tickEnding()
	case domain.RoomStateCooldown:
		r.tickCooldown()
	}
}

// --- State tick handlers ---

func (r *Room) tickWaiting() {
	// Transition when enough human players join
	if len(r.players) >= r.Config.MinPlayersToStart {
		if r.Config.CountdownSec <= 0 {
			// Skip countdown, start immediately
			r.startRound()
		} else {
			r.transitionTo(domain.RoomStateCountdown)
		}
	}
}

func (r *Room) tickCountdown() {
	r.stateTicksLeft--

	if r.stateTicksLeft <= 0 {
		r.startRound()
		return
	}

	// Broadcast countdown every second (every TickRate ticks)
	if r.stateTicksLeft%TickRate == 0 {
		secondsLeft := r.stateTicksLeft / TickRate
		r.emitEvents([]RoomEvent{{
			RoomID: r.ID,
			Type:   RoomEvtRoundStart,
			Data: domain.RoundStartEvent{
				Countdown: secondsLeft,
			},
		}})
	}
}

func (r *Room) tickPlaying() {
	r.stateTicksLeft--

	arenaTick := r.arena.GetTick()

	// Check round end conditions:
	// 1. Time expired
	if r.stateTicksLeft <= 0 {
		r.endRound()
		return
	}

	// 2. All human players dead (1-life)
	if r.aliveHumanCountLocked() == 0 && len(r.players) > 0 {
		r.endRound()
		return
	}

	// Broadcast state update every tick (20Hz)
	r.broadcastState(arenaTick)

	// Broadcast minimap at 1Hz
	if arenaTick > 0 && arenaTick%MinimapUpdateInterval == 0 {
		r.broadcastMinimap()
	}

	// Broadcast arena shrink at 1Hz
	if arenaTick > 0 && arenaTick%ShrinkUpdateInterval == 0 {
		r.broadcastShrinkInfo()
	}

	// Coach Agent advice (S57) — check every 20 ticks (1Hz)
	if arenaTick > 0 && arenaTick%uint64(TickRate) == 0 {
		r.broadcastCoachAdvice(arenaTick)
	}
}

func (r *Room) tickEnding() {
	r.stateTicksLeft--
	if r.stateTicksLeft <= 0 {
		r.transitionTo(domain.RoomStateCooldown)
	}
}

func (r *Room) tickCooldown() {
	r.stateTicksLeft--
	if r.stateTicksLeft <= 0 {
		// Stop arena, reset for next round
		r.stopArena()
		r.transitionTo(domain.RoomStateWaiting)

		r.emitEvents([]RoomEvent{{
			RoomID: r.ID,
			Type:   RoomEvtRoundReset,
			Data: domain.RoundResetEvent{
				RoomState: domain.RoomStateWaiting,
			},
		}})
	}
}

// --- State transitions ---

func (r *Room) transitionTo(newState domain.RoomState) {
	oldState := r.state
	r.state = newState

	switch newState {
	case domain.RoomStateCountdown:
		r.stateTicksLeft = r.Config.CountdownSec * TickRate
		// Emit initial countdown event
		r.emitEvents([]RoomEvent{{
			RoomID: r.ID,
			Type:   RoomEvtRoundStart,
			Data: domain.RoundStartEvent{
				Countdown: r.Config.CountdownSec,
			},
		}})
	case domain.RoomStatePlaying:
		r.stateTicksLeft = r.Config.RoundDurationSec * TickRate
	case domain.RoomStateEnding:
		r.stateTicksLeft = r.Config.EndingSec * TickRate
	case domain.RoomStateCooldown:
		r.stateTicksLeft = r.Config.CooldownSec * TickRate
	case domain.RoomStateWaiting:
		r.stateTicksLeft = 0
	}

	slog.Info("room state transition",
		"roomId", r.ID,
		"from", oldState,
		"to", newState,
	)
}

// --- Round lifecycle ---

func (r *Room) startRound() {
	r.round++
	r.arena.Reset()

	// Setup arena event handler to forward events
	r.arena.EventHandler = r.handleArenaEvents

	// Start arena game loop in a new goroutine
	arenaCtx, arenaCancel := context.WithCancel(context.Background())
	r.arenaCancel = arenaCancel
	go r.arena.Run(arenaCtx)

	// Spawn bots
	r.botManager.SetArena(r.arena)
	r.botManager.SpawnBots(r.Config.MaxBotsPerRoom)

	// Spawn all current human players as agents
	for _, p := range r.players {
		r.spawnPlayerAgent(p)
	}

	// Transition to playing
	r.transitionTo(domain.RoomStatePlaying)
	r.roundStartTick = 0

	slog.Info("round started", "roomId", r.ID, "round", r.round, "players", len(r.players))
}

func (r *Room) endRound() {
	// Generate final leaderboard
	agents := r.arena.GetAgents()
	lb := r.arena.GetLeaderboard()
	finalRanking := lb.GetFinalRanking(agents)

	// Determine winner
	var winner *domain.WinnerInfo
	if len(finalRanking) > 0 {
		topAgent, ok := agents[finalRanking[0].ID]
		if ok {
			w := domain.WinnerInfo{
				ID:        topAgent.ID,
				Name:      topAgent.Name,
				Score:     finalRanking[0].Score,
				Kills:     topAgent.Kills,
				Level:     topAgent.Level,
				Build:     topAgent.Build,
				Synergies: topAgent.ActiveSynergies,
				Skin:      topAgent.Skin,
				RoomID:    r.ID,
				Timestamp: time.Now().UnixMilli(),
			}
			winner = &w

			// Track recent winners (keep last 5)
			r.recentWinners = append(r.recentWinners, w)
			if len(r.recentWinners) > 5 {
				r.recentWinners = r.recentWinners[len(r.recentWinners)-5:]
			}
		}
	}

	// Emit round_end to each player with their personal rank
	var events []RoomEvent
	for pid := range r.players {
		rank := 0
		score := 0
		for i, entry := range finalRanking {
			if entry.ID == pid {
				rank = i + 1
				score = entry.Score
				break
			}
		}
		events = append(events, RoomEvent{
			RoomID:   r.ID,
			Type:     RoomEvtRoundEnd,
			TargetID: pid,
			Data: domain.RoundEndEvent{
				Winner:           winner,
				FinalLeaderboard: finalRanking,
				YourRank:         rank,
				YourScore:        score,
			},
		})
	}
	r.emitEvents(events)

	// Analyst Agent (S58): generate post-round analysis for each human player
	if r.analystAgent != nil {
		var analysisEvents []RoomEvent
		roundDuration := r.Config.RoundDurationSec
		for pid := range r.players {
			agent, ok := agents[pid]
			if !ok {
				continue
			}
			rank := 0
			for i, entry := range finalRanking {
				if entry.ID == pid {
					rank = i + 1
					break
				}
			}
			survivalTime := roundDuration // survived the whole round if alive
			if !agent.Alive {
				survivalTime = int(time.Since(time.UnixMilli(agent.JoinedAt)).Seconds())
				if survivalTime > roundDuration {
					survivalTime = roundDuration
				}
			}
			analysis := r.analystAgent.AnalyzeRound(agent, rank, len(finalRanking), survivalTime, roundDuration)
			if analysis != nil {
				analysisEvents = append(analysisEvents, RoomEvent{
					RoomID:   r.ID,
					Type:     RoomEvtRoundAnalysis,
					TargetID: pid,
					Data:     analysis,
				})
			}
		}
		if len(analysisEvents) > 0 {
			r.emitEvents(analysisEvents)
		}
	}

	r.transitionTo(domain.RoomStateEnding)

	slog.Info("round ended", "roomId", r.ID, "round", r.round)
}

func (r *Room) stopArena() {
	if r.arenaCancel != nil {
		r.arenaCancel()
		r.arenaCancel = nil
	}
	r.botManager.Clear()
}

// --- Player management ---

// AddPlayer adds a human player to the room.
func (r *Room) AddPlayer(id, name string, skinID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.players) >= r.Config.MaxHumansPerRoom {
		return fmt.Errorf("room %s is full", r.ID)
	}

	p := &PlayerInfo{
		ID:     id,
		Name:   name,
		SkinID: skinID,
	}
	r.players[id] = p

	// If round is in progress, spawn the agent immediately
	if r.state == domain.RoomStatePlaying {
		r.spawnPlayerAgent(p)
	}

	slog.Info("player added to room",
		"roomId", r.ID,
		"playerId", id,
		"name", name,
		"state", r.state,
	)

	return nil
}

// RemovePlayer removes a human player from the room.
func (r *Room) RemovePlayer(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.players, id)

	// Remove agent from arena if playing
	if r.state == domain.RoomStatePlaying || r.state == domain.RoomStateCountdown {
		r.arena.RemoveAgent(id)
	}

	slog.Info("player removed from room", "roomId", r.ID, "playerId", id)
}

// HasPlayer returns true if the player is in this room.
func (r *Room) HasPlayer(id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.players[id]
	return ok
}

func (r *Room) spawnPlayerAgent(p *PlayerInfo) {
	pos := r.arena.RandomSpawnPosition()
	skin := domain.GetSkinByID(p.SkinID)
	agent := NewAgent(p.ID, p.Name, pos, skin, false, r.arena.GetTick())
	r.arena.AddAgent(agent)
}

// --- Input handling ---

// HandleInput forwards player input to the arena. Only allowed in playing state.
func (r *Room) HandleInput(agentID string, angle float64, boost bool) {
	r.mu.RLock()
	state := r.state
	r.mu.RUnlock()

	if state != domain.RoomStatePlaying {
		return
	}
	r.arena.HandleInput(agentID, angle, boost)
}

// HandleChooseUpgrade forwards upgrade choice to the arena.
func (r *Room) HandleChooseUpgrade(agentID string, choiceIndex int) {
	r.mu.RLock()
	state := r.state
	r.mu.RUnlock()

	if state != domain.RoomStatePlaying {
		return
	}
	r.arena.ChooseUpgrade(agentID, choiceIndex)
}

// --- Arena event forwarding ---

func (r *Room) handleArenaEvents(arenaEvents []ArenaEvent) {
	var roomEvents []RoomEvent

	for _, ae := range arenaEvents {
		switch ae.Type {
		case EventDeath:
			ce, ok := ae.Data.(CollisionEvent)
			if !ok {
				continue
			}
			agent, agentOk := r.arena.GetAgent(ce.VictimID)
			duration := 0
			rank := 0
			if agentOk {
				duration = int(time.Since(time.UnixMilli(agent.JoinedAt)).Seconds())
				rank = r.arena.GetLeaderboard().GetAgentRankInFinal(r.arena.GetAgents(), ce.VictimID)
			}
			deathEvt := r.serializer.SerializeDeathEvent(
				agent, ce.KillerID, ce.KillerName, ce.DamageSource, duration, rank,
			)
			roomEvents = append(roomEvents, RoomEvent{
				RoomID:   r.ID,
				Type:     RoomEvtDeath,
				TargetID: ce.VictimID,
				Data:     deathEvt,
			})

			// Bot replacement: dead bot → remove + spawn new
			if agent != nil && agent.IsBot {
				r.botManager.ReplaceBot(ce.VictimID)
			}

		case EventKill:
			ce, ok := ae.Data.(CollisionEvent)
			if !ok {
				continue
			}
			killEvt := r.serializer.SerializeKillEvent(ce.VictimID, ce.VictimName, ce.VictimMass)
			roomEvents = append(roomEvents, RoomEvent{
				RoomID:   r.ID,
				Type:     RoomEvtKill,
				TargetID: ce.KillerID,
				Data:     killEvt,
			})

		case EventLevelUp:
			roomEvents = append(roomEvents, RoomEvent{
				RoomID:   r.ID,
				Type:     RoomEvtLevelUp,
				TargetID: ae.AgentID,
				Data:     ae.Data,
			})

		case EventSynergy:
			roomEvents = append(roomEvents, RoomEvent{
				RoomID:   r.ID,
				Type:     RoomEvtSynergy,
				TargetID: ae.AgentID,
				Data:     ae.Data,
			})

		case EventAgentLevelUp:
			roomEvents = append(roomEvents, RoomEvent{
				RoomID:   r.ID,
				Type:     RoomEvtAgentLevelUp,
				TargetID: ae.AgentID,
				Data:     ae.Data,
			})

		case EventShrinkWarn:
			roomEvents = append(roomEvents, RoomEvent{
				RoomID: r.ID,
				Type:   RoomEvtShrinkWarn,
				Data:   ae.Data,
			})
		}
	}

	if len(roomEvents) > 0 {
		r.emitEvents(roomEvents)
	}
}

// --- Broadcasting helpers ---

func (r *Room) broadcastState(tick uint64) {
	agents := r.arena.GetAgents()
	orbs := r.arena.GetOrbManager().GetOrbs()
	leaderboard := r.arena.GetLeaderboard().GetTop()

	// For each human player, send viewport-culled state
	for pid := range r.players {
		viewer, ok := agents[pid]
		if !ok || !viewer.Alive {
			continue
		}
		stateUpdate := r.serializer.SerializeState(viewer, agents, orbs, leaderboard, tick)
		r.emitEvents([]RoomEvent{{
			RoomID:   r.ID,
			Type:     RoomEvtState,
			TargetID: pid,
			Data:     stateUpdate,
		}})
	}
}

func (r *Room) broadcastMinimap() {
	agents := r.arena.GetAgents()
	boundary := r.arena.GetCurrentRadius()

	for pid := range r.players {
		minimap := r.serializer.SerializeMinimap(agents, pid, boundary)
		r.emitEvents([]RoomEvent{{
			RoomID:   r.ID,
			Type:     RoomEvtMinimap,
			TargetID: pid,
			Data:     minimap,
		}})
	}
}

func (r *Room) broadcastShrinkInfo() {
	shrinkInfo := r.arena.GetShrinkInfo()
	r.emitEvents([]RoomEvent{{
		RoomID: r.ID,
		Type:   RoomEvtArenaShrink,
		Data:   shrinkInfo,
	}})
}

// broadcastCoachAdvice sends coaching messages to human players (S57).
func (r *Room) broadcastCoachAdvice(tick uint64) {
	if r.coachAgent == nil {
		return
	}
	agents := r.arena.GetAgents()
	for pid := range r.players {
		agent, ok := agents[pid]
		if !ok || !agent.Alive {
			continue
		}
		msg := r.coachAgent.GenerateAdvice(agent, r.arena, tick)
		if msg != nil {
			r.emitEvents([]RoomEvent{{
				RoomID:   r.ID,
				Type:     RoomEvtCoachMessage,
				TargetID: pid,
				Data:     msg,
			}})
		}
	}
}

// --- Info getters ---

// GetInfo returns public room info for lobby display.
func (r *Room) GetInfo() domain.RoomInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	timeRemaining := 0
	switch r.state {
	case domain.RoomStateCountdown:
		timeRemaining = r.stateTicksLeft / TickRate
	case domain.RoomStatePlaying:
		timeRemaining = r.stateTicksLeft / TickRate
	case domain.RoomStateEnding:
		timeRemaining = r.stateTicksLeft / TickRate
	case domain.RoomStateCooldown:
		timeRemaining = r.stateTicksLeft / TickRate
	}

	return domain.RoomInfo{
		ID:            r.ID,
		Name:          r.Name,
		State:         r.state,
		Players:       len(r.players),
		MaxPlayers:    r.Config.MaxHumansPerRoom,
		TimeRemaining: timeRemaining,
		Round:         r.round,
	}
}

// GetArena returns the room's arena instance (for agent API access).
func (r *Room) GetArena() *Arena {
	return r.arena
}

// GetState returns the current room state.
func (r *Room) GetState() domain.RoomState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.state
}

// GetRecentWinners returns the recent winners list.
func (r *Room) GetRecentWinners() []domain.WinnerInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]domain.WinnerInfo, len(r.recentWinners))
	copy(result, r.recentWinners)
	return result
}

// PlayerCount returns the number of human players.
func (r *Room) PlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.players)
}

// GetJoinedEvent creates a JoinedEvent for a newly joined player.
func (r *Room) GetJoinedEvent(playerID string) domain.JoinedEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	tick := uint64(0)
	arenaRadius := ArenaRadius
	timeRemaining := 0

	if r.state == domain.RoomStatePlaying {
		tick = r.arena.GetTick()
		arenaRadius = r.arena.GetCurrentRadius()
		timeRemaining = r.stateTicksLeft / TickRate
	} else if r.state == domain.RoomStateCountdown {
		timeRemaining = r.stateTicksLeft / TickRate
	}

	spawn := domain.Position{X: 0, Y: 0}
	if agent, ok := r.arena.GetAgent(playerID); ok {
		spawn = agent.Position
	}

	return domain.JoinedEvent{
		RoomID:        r.ID,
		ID:            playerID,
		Spawn:         spawn,
		ArenaRadius:   arenaRadius,
		Tick:          tick,
		RoomState:     r.state,
		TimeRemaining: timeRemaining,
	}
}

// --- Internal helpers ---

func (r *Room) aliveHumanCountLocked() int {
	count := 0
	agents := r.arena.GetAgents()
	for pid := range r.players {
		if agent, ok := agents[pid]; ok && agent.Alive {
			count++
		}
	}
	return count
}

func (r *Room) emitEvents(events []RoomEvent) {
	if r.OnEvents != nil && len(events) > 0 {
		r.OnEvents(events)
	}
}
