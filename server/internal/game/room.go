package game

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/to-nexus/snake-server/internal/domain"
)

// RoomState represents the current phase of a room.
type RoomState int

const (
	StateWaiting   RoomState = iota
	StateCountdown
	StatePlaying
	StateEnding
	StateCooldown
)

// String returns the RoomStatus string for this state.
func (s RoomState) String() string {
	switch s {
	case StateWaiting:
		return string(domain.RoomWaiting)
	case StateCountdown:
		return string(domain.RoomCountdown)
	case StatePlaying:
		return string(domain.RoomPlaying)
	case StateEnding:
		return string(domain.RoomEnding)
	case StateCooldown:
		return string(domain.RoomCooldown)
	default:
		return "unknown"
	}
}

// ToDomainStatus converts RoomState to domain.RoomStatus.
func (s RoomState) ToDomainStatus() domain.RoomStatus {
	switch s {
	case StateWaiting:
		return domain.RoomWaiting
	case StateCountdown:
		return domain.RoomCountdown
	case StatePlaying:
		return domain.RoomPlaying
	case StateEnding:
		return domain.RoomEnding
	case StateCooldown:
		return domain.RoomCooldown
	default:
		return domain.RoomWaiting
	}
}

// HumanMeta stores per-player metadata for round persistence.
type HumanMeta struct {
	Name   string
	SkinID int
}

// JoinRequest is sent to the Room's joinChan.
type JoinRequest struct {
	ClientID string
	Name     string
	SkinID   int
	Response chan JoinResponse
}

// JoinResponse is sent back to the caller after a join attempt.
type JoinResponse struct {
	AgentID  string
	Spawn    domain.Position
	Err      error
}

// RespawnRequest is sent to request a respawn.
type RespawnRequest struct {
	ClientID string
	Name     string
	SkinID   int
}

// UpgradeRequest is sent to choose an upgrade.
type UpgradeRequest struct {
	ClientID string
	ChoiceID string
}

// Broadcaster is the interface the Room uses to send messages.
// This avoids importing the ws package directly from game.
type Broadcaster interface {
	// RegisterClient moves a client to a room.
	RegisterClient(clientID, roomID string)
	// UnregisterClient removes a client from its current room (back to lobby).
	UnregisterToLobby(clientID string)
	// SendToClient sends an event to a specific client.
	SendToClient(clientID string, data []byte)
	// SendToRoom sends data to all clients in a room.
	SendToRoom(roomID string, data []byte, excludeID string)
	// BroadcastAll sends data to all connected clients.
	BroadcastAll(data []byte)
}

// Room wraps an Arena with a state machine and manages the game lifecycle.
type Room struct {
	ID         string
	roomConfig RoomConfig

	state RoomState
	timer int // remaining seconds for current state

	arena      *Arena
	botManager *BotManager
	coach      *CoachEngine

	// Human players tracked across rounds (clientID → meta)
	humans map[string]*HumanMeta
	mu     sync.RWMutex // protects humans map

	lastWinner *domain.WinnerInfo

	// Meta systems (set via SetMetaSystems)
	rpStore      *RPStore
	questTracker *QuestTracker

	// Channels for communication from external goroutines
	InputChan   chan InputMsg
	JoinChan    chan JoinRequest
	LeaveChan   chan string // clientID
	RespawnChan chan RespawnRequest
	UpgradeChan chan UpgradeRequest

	// Minimap tick counter
	minimapCounter uint64
}

// NewRoom creates a new Room with a fresh Arena and BotManager.
func NewRoom(id string, arenaConfig ArenaConfig, roomConfig RoomConfig) *Room {
	arena := NewArena(arenaConfig)
	bm := NewBotManager(roomConfig.BotsPerRoom)

	r := &Room{
		ID:         id,
		roomConfig: roomConfig,
		state:      StateWaiting,
		timer:      0,
		arena:      arena,
		botManager: bm,
		coach:      NewCoachEngine(),
		humans:     make(map[string]*HumanMeta, roomConfig.MaxPlayersPerRoom),
		lastWinner: nil,
		InputChan:   make(chan InputMsg, 256),
		JoinChan:    make(chan JoinRequest, 16),
		LeaveChan:   make(chan string, 16),
		RespawnChan: make(chan RespawnRequest, 16),
		UpgradeChan: make(chan UpgradeRequest, 16),
	}

	// Spawn initial bots
	bm.SpawnBots(arena)

	return r
}

// Run is the main Room goroutine. It runs the 20Hz game loop and 1Hz state tick.
func (r *Room) Run(ctx context.Context, bc Broadcaster) {
	gameTicker := time.NewTicker(50 * time.Millisecond) // 20Hz
	stateTicker := time.NewTicker(1 * time.Second)      // 1Hz
	defer gameTicker.Stop()
	defer stateTicker.Stop()

	slog.Info("room started", "roomID", r.ID)

	for {
		select {
		case <-ctx.Done():
			slog.Info("room stopping", "roomID", r.ID)
			return

		case input := <-r.InputChan:
			r.arena.ApplyInput(input)

		case join := <-r.JoinChan:
			r.handleJoin(join, bc)

		case clientID := <-r.LeaveChan:
			r.handleLeave(clientID, bc)

		case req := <-r.RespawnChan:
			r.handleRespawn(req, bc)

		case req := <-r.UpgradeChan:
			r.handleUpgrade(req)

		case <-gameTicker.C:
			r.gameTick(bc)

		case <-stateTicker.C:
			r.stateTick(bc)
		}
	}
}

// gameTick runs one 20Hz game tick: bot AI, arena tick, broadcast state.
func (r *Room) gameTick(bc Broadcaster) {
	if r.state != StatePlaying && r.state != StateCountdown {
		// Still tick in waiting/cooldown for bots to move around (visual)
		if r.state == StateWaiting || r.state == StateCooldown {
			r.botManager.Update(r.arena)
			r.arena.Tick()
		}
		return
	}

	// Bot AI
	r.botManager.Update(r.arena)

	// Arena game tick
	r.arena.Tick()

	// Process death events — send death/kill notifications
	r.processDeathEvents(bc)

	// Process level-up events
	r.processLevelUpEvents(bc)

	// Broadcast state to each human player (viewport-culled)
	r.broadcastState(bc)

	// Minimap (1Hz = every 20 ticks)
	r.minimapCounter++
	if r.minimapCounter%uint64(MinimapInterval) == 0 {
		r.broadcastMinimap(bc)
	}

	// Coach messages (only during playing)
	if r.state == StatePlaying && r.coach.ShouldCheck(r.arena.GetTick()) {
		r.processCoachMessages(bc)
	}

	// Replace dead bots
	r.botManager.ReplaceDead(r.arena)

	// Check if round should end early (all humans dead in playing state)
	if r.state == StatePlaying {
		r.checkEarlyRoundEnd(bc)
	}
}

// stateTick handles 1Hz state transitions.
func (r *Room) stateTick(bc Broadcaster) {
	switch r.state {
	case StateWaiting:
		r.mu.RLock()
		humanCount := len(r.humans)
		r.mu.RUnlock()

		if humanCount >= r.roomConfig.MinPlayersToStart {
			r.transitionTo(StateCountdown, bc)
		}

	case StateCountdown:
		r.timer--
		if r.timer <= 0 {
			r.transitionTo(StatePlaying, bc)
		}

	case StatePlaying:
		r.timer--
		if r.timer <= 0 {
			r.transitionTo(StateEnding, bc)
		}

	case StateEnding:
		r.timer--
		if r.timer <= 0 {
			r.transitionTo(StateCooldown, bc)
		}

	case StateCooldown:
		r.timer--
		if r.timer <= 0 {
			r.resetRound(bc)
			r.transitionTo(StateWaiting, bc)
		}
	}
}

// transitionTo changes the room state and broadcasts the transition.
func (r *Room) transitionTo(newState RoomState, bc Broadcaster) {
	oldState := r.state
	r.state = newState

	slog.Info("room state transition",
		"roomID", r.ID,
		"from", oldState.String(),
		"to", newState.String(),
	)

	switch newState {
	case StateCountdown:
		r.timer = r.roomConfig.CountdownDuration
		// Broadcast round_start countdown
		r.broadcastToRoom(bc, "round_start", domain.RoundStartPayload{
			Countdown: r.timer,
		})

	case StatePlaying:
		r.timer = r.roomConfig.RoundDuration
		// Enable arena shrink
		r.arena.GetShrink().Start()
		// Broadcast round_start with 0 countdown (round begins)
		r.broadcastToRoom(bc, "round_start", domain.RoundStartPayload{
			Countdown: 0,
		})

	case StateEnding:
		r.timer = r.roomConfig.EndingDuration
		// Determine winner
		winner := r.determineWinner()
		r.lastWinner = winner
		// Broadcast round_end with final leaderboard
		r.broadcastRoundEnd(bc, winner)
		// Record RP + check quests
		r.processRoundEndMeta()
		// Send round analysis to each player
		r.sendRoundAnalysis(bc)

	case StateCooldown:
		r.timer = r.roomConfig.CooldownDuration
		// Broadcast round_reset
		r.broadcastToRoom(bc, "round_reset", domain.RoundResetPayload{
			RoomState: newState.ToDomainStatus(),
		})

	case StateWaiting:
		r.timer = 0
	}
}

// handleJoin processes a join request.
func (r *Room) handleJoin(join JoinRequest, bc Broadcaster) {
	r.mu.Lock()
	if len(r.humans) >= r.roomConfig.MaxPlayersPerRoom {
		r.mu.Unlock()
		join.Response <- JoinResponse{Err: fmt.Errorf("room full")}
		return
	}

	// Check joinable states
	if r.state == StateEnding || r.state == StateCooldown {
		r.mu.Unlock()
		join.Response <- JoinResponse{Err: fmt.Errorf("room not joinable")}
		return
	}

	r.humans[join.ClientID] = &HumanMeta{
		Name:   join.Name,
		SkinID: join.SkinID,
	}
	r.mu.Unlock()

	// Add agent to arena
	pos := RandomPositionInCircle(r.arena.Config.ArenaRadius * 0.6)
	r.arena.AddAgent(join.ClientID, join.Name, join.SkinID, pos)

	// Register client to this room in the hub
	bc.RegisterClient(join.ClientID, r.ID)

	// Send joined response
	join.Response <- JoinResponse{
		AgentID: join.ClientID,
		Spawn:   pos,
	}

	// Send joined event to client
	joinedPayload := domain.JoinedPayload{
		RoomID: r.ID,
		ID:     join.ClientID,
		Spawn:  pos,
		Arena: domain.ArenaInfo{
			Radius:   r.arena.GetCurrentRadius(),
			OrbCount: r.arena.GetOrbCount(),
		},
		Tick:          r.arena.GetTick(),
		RoomState:     r.state.ToDomainStatus(),
		TimeRemaining: r.timer,
	}
	r.sendToClient(bc, join.ClientID, "joined", joinedPayload)

	slog.Info("player joined room",
		"clientID", join.ClientID,
		"roomID", r.ID,
		"name", join.Name,
		"humanCount", len(r.humans),
	)
}

// handleLeave processes a leave request.
func (r *Room) handleLeave(clientID string, bc Broadcaster) {
	r.mu.Lock()
	_, ok := r.humans[clientID]
	if !ok {
		r.mu.Unlock()
		return
	}
	delete(r.humans, clientID)
	r.mu.Unlock()

	// Remove agent from arena
	r.arena.RemoveAgent(clientID)

	// Move client back to lobby
	bc.UnregisterToLobby(clientID)

	slog.Info("player left room",
		"clientID", clientID,
		"roomID", r.ID,
	)
}

// handleRespawn processes a respawn request.
func (r *Room) handleRespawn(req RespawnRequest, bc Broadcaster) {
	// 1 Life policy: no respawn during playing/ending
	if r.state == StatePlaying || r.state == StateEnding {
		r.sendToClient(bc, req.ClientID, "error", domain.ErrorPayload{
			Code:    "RESPAWN_DENIED",
			Message: "Cannot respawn during active round (1-life policy)",
		})
		return
	}

	r.mu.Lock()
	meta, ok := r.humans[req.ClientID]
	if ok {
		if req.Name != "" {
			meta.Name = req.Name
		}
		if req.SkinID >= 0 {
			meta.SkinID = req.SkinID
		}
	}
	r.mu.Unlock()

	if !ok {
		return
	}

	agent := r.arena.RespawnAgent(req.ClientID)
	if agent == nil {
		return
	}

	// Update name/skin if changed
	if req.Name != "" {
		agent.Name = req.Name
	}
	agent.Skin = domain.GetSkinByID(req.SkinID)
}

// handleUpgrade processes an upgrade choice.
func (r *Room) handleUpgrade(req UpgradeRequest) {
	r.arena.ChooseUpgrade(req.ClientID, req.ChoiceID)
}

// processDeathEvents sends death/kill notifications for this tick's events.
func (r *Room) processDeathEvents(bc Broadcaster) {
	deaths := r.arena.ConsumeDeathEvents()
	for _, death := range deaths {
		// Send death event to the dead player (if human)
		r.mu.RLock()
		_, isHuman := r.humans[death.AgentID]
		r.mu.RUnlock()

		if isHuman {
			deathInfo := r.arena.SerializeDeathInfo(death.AgentID)
			if deathInfo != nil {
				if death.DamageSource != "" {
					deathInfo.DamageSource = death.DamageSource
				}
				r.sendToClient(bc, death.AgentID, "death", deathInfo)
			}
		}

		// Send kill event to killer (if human)
		if death.KillerID != "" {
			r.mu.RLock()
			_, killerIsHuman := r.humans[death.KillerID]
			r.mu.RUnlock()

			if killerIsHuman {
				killer, ok := r.arena.GetAgent(death.KillerID)
				if ok {
					_ = killer // killer stats already updated in collision
				}
				victim, _ := r.arena.GetAgent(death.AgentID)
				victimName := ""
				if victim != nil {
					victimName = victim.Name
				}
				r.sendToClient(bc, death.KillerID, "kill", domain.KillPayload{
					Victim:     victimName,
					VictimMass: death.VictimMass,
				})
			}
		}
	}
}

// processLevelUpEvents sends level-up notifications for this tick's events.
func (r *Room) processLevelUpEvents(bc Broadcaster) {
	levelUps := r.arena.ConsumeLevelUps()
	for _, lu := range levelUps {
		r.mu.RLock()
		_, isHuman := r.humans[lu.AgentID]
		r.mu.RUnlock()

		if !isHuman {
			continue
		}

		agent, ok := r.arena.GetAgent(lu.AgentID)
		if !ok {
			continue
		}

		if agent.PendingChoices != nil {
			r.sendToClient(bc, lu.AgentID, "level_up", domain.LevelUpPayload{
				Level:        lu.Level,
				Choices:      agent.PendingChoices,
				TimeoutTicks: r.arena.Config.UpgradeChoiceTimeout,
			})
		}
	}
}

// broadcastState sends viewport-culled state to each human player.
func (r *Room) broadcastState(bc Broadcaster) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for clientID := range r.humans {
		state := r.arena.SerializeForPlayer(clientID)
		if state == nil {
			continue
		}
		data, err := makeFrameBytes("state", state)
		if err != nil {
			continue
		}
		bc.SendToClient(clientID, data)
	}
}

// broadcastMinimap sends minimap data to each human player.
func (r *Room) broadcastMinimap(bc Broadcaster) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for clientID := range r.humans {
		minimap := r.arena.SerializeMinimap(clientID)
		if minimap == nil {
			continue
		}
		data, err := makeFrameBytes("minimap", minimap)
		if err != nil {
			continue
		}
		bc.SendToClient(clientID, data)
	}
}

// broadcastRoundEnd sends round_end to all human players with personalized data.
func (r *Room) broadcastRoundEnd(bc Broadcaster, winner *domain.WinnerInfo) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	leaderboard := r.arena.GetLeaderboard()

	for clientID := range r.humans {
		agent, _ := r.arena.GetAgent(clientID)
		yourScore := 0
		yourRank := len(r.humans)
		if agent != nil {
			yourScore = agent.Score
			yourRank = r.arena.GetLeaderboardRank(clientID)
		}

		r.sendToClient(bc, clientID, "round_end", domain.RoundEndPayload{
			Winner:           winner,
			FinalLeaderboard: leaderboard,
			YourRank:         yourRank,
			YourScore:        yourScore,
		})
	}
}

// broadcastToRoom sends an event to all clients in this room via the hub.
func (r *Room) broadcastToRoom(bc Broadcaster, event string, payload interface{}) {
	data, err := makeFrameBytes(event, payload)
	if err != nil {
		slog.Error("failed to serialize room broadcast", "event", event, "error", err)
		return
	}
	bc.SendToRoom(r.ID, data, "")
}

// sendToClient sends an event to a specific client.
func (r *Room) sendToClient(bc Broadcaster, clientID, event string, payload interface{}) {
	data, err := makeFrameBytes(event, payload)
	if err != nil {
		slog.Error("failed to serialize client message", "event", event, "error", err)
		return
	}
	bc.SendToClient(clientID, data)
}

// determineWinner finds the highest-scoring human player, or the top player overall.
func (r *Room) determineWinner() *domain.WinnerInfo {
	entries := r.arena.GetLeaderboard()

	r.mu.RLock()
	defer r.mu.RUnlock()

	// Prefer human winner
	for _, entry := range entries {
		if _, ok := r.humans[entry.ID]; ok {
			agent, _ := r.arena.GetAgent(entry.ID)
			skinID := 0
			if agent != nil {
				skinID = agent.Skin.ID
			}
			return &domain.WinnerInfo{
				Name:   entry.Name,
				Score:  entry.Score,
				Kills:  entry.Kills,
				SkinID: skinID,
			}
		}
	}

	// Fallback: top overall
	if len(entries) > 0 {
		top := entries[0]
		agent, _ := r.arena.GetAgent(top.ID)
		skinID := 0
		if agent != nil {
			skinID = agent.Skin.ID
		}
		return &domain.WinnerInfo{
			Name:   top.Name,
			Score:  top.Score,
			Kills:  top.Kills,
			SkinID: skinID,
		}
	}

	return nil
}

// resetRound creates a fresh arena and re-adds all human players.
func (r *Room) resetRound(bc Broadcaster) {
	r.mu.RLock()
	humansCopy := make(map[string]*HumanMeta, len(r.humans))
	for k, v := range r.humans {
		humansCopy[k] = &HumanMeta{Name: v.Name, SkinID: v.SkinID}
	}
	r.mu.RUnlock()

	// Reset arena
	r.arena.ResetForNewRound()

	// Re-spawn bots
	r.botManager.RemoveAll()
	r.botManager.SpawnBots(r.arena)

	// Re-add human players
	for clientID, meta := range humansCopy {
		pos := RandomPositionInCircle(r.arena.Config.ArenaRadius * 0.6)
		r.arena.AddAgent(clientID, meta.Name, meta.SkinID, pos)
	}

	r.lastWinner = nil
	r.minimapCounter = 0
	r.coach.Reset()
}

// checkEarlyRoundEnd checks if all humans are dead (trigger early round end).
func (r *Room) checkEarlyRoundEnd(bc Broadcaster) {
	r.mu.RLock()
	allDead := true
	for clientID := range r.humans {
		agent, ok := r.arena.GetAgent(clientID)
		if ok && agent.Alive {
			allDead = false
			break
		}
	}
	humanCount := len(r.humans)
	r.mu.RUnlock()

	// Only trigger if there are humans and all are dead
	if humanCount > 0 && allDead {
		r.transitionTo(StateEnding, bc)
	}
}

// SetMetaSystems sets the RP store and quest tracker for round-end processing.
func (r *Room) SetMetaSystems(rpStore *RPStore, qt *QuestTracker) {
	r.rpStore = rpStore
	r.questTracker = qt
}

// processCoachMessages generates and sends coaching messages to human players.
func (r *Room) processCoachMessages(bc Broadcaster) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for clientID := range r.humans {
		agent, ok := r.arena.GetAgent(clientID)
		if !ok || !agent.Alive {
			continue
		}

		msg := r.coach.Analyze(clientID, agent, r.arena, r.arena.GetTick())
		if msg != nil {
			r.sendToClient(bc, clientID, "coach_message", msg)
		}
	}
}

// processRoundEndMeta records RP and checks quests for all human players.
func (r *Room) processRoundEndMeta() {
	if r.rpStore == nil {
		return
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	for clientID, meta := range r.humans {
		agent, ok := r.arena.GetAgent(clientID)
		if !ok {
			continue
		}

		survivalSec := float64(r.arena.GetTick()-agent.JoinedAt) / float64(r.arena.Config.TickRate)
		synCount := len(agent.ActiveSynergies)
		rank := r.arena.GetLeaderboardRank(clientID)

		// Record RP
		earned := CalculateRP(agent.Kills, survivalSec, synCount, rank)
		r.rpStore.RecordRP(meta.Name, earned)

		// Check quests
		if r.questTracker != nil {
			result := RoundResult{
				BuildPath:       "",
				FinalLevel:      agent.Level,
				Kills:           agent.Kills,
				SurvivalTimeSec: survivalSec,
				Rank:            rank,
				Score:           agent.Score,
				Synergies:       agent.ActiveSynergies,
				Tomes:           make(map[string]int),
				Abilities:       make([]string, 0),
			}
			for tomeType, stacks := range agent.Build.Tomes {
				result.Tomes[string(tomeType)] = stacks
			}
			for _, ab := range agent.Build.Abilities {
				result.Abilities = append(result.Abilities, string(ab.Type))
			}
			r.questTracker.CheckQuests(meta.Name, result)
		}
	}
}

// sendRoundAnalysis sends analysis to each human player after round end.
func (r *Room) sendRoundAnalysis(bc Broadcaster) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	roundDuration := float64(r.roomConfig.RoundDuration)

	for clientID := range r.humans {
		agent, ok := r.arena.GetAgent(clientID)
		if !ok {
			continue
		}

		survivalSec := float64(r.arena.GetTick()-agent.JoinedAt) / float64(r.arena.Config.TickRate)
		rank := r.arena.GetLeaderboardRank(clientID)

		result := RoundResult{
			FinalLevel:      agent.Level,
			Kills:           agent.Kills,
			SurvivalTimeSec: survivalSec,
			Rank:            rank,
			Score:           agent.Score,
			Synergies:       agent.ActiveSynergies,
			Tomes:           make(map[string]int),
			Abilities:       make([]string, 0),
		}
		for tomeType, stacks := range agent.Build.Tomes {
			result.Tomes[string(tomeType)] = stacks
		}
		for _, ab := range agent.Build.Abilities {
			result.Abilities = append(result.Abilities, string(ab.Type))
		}

		analysis := AnalyzeRound(result, roundDuration)
		r.sendToClient(bc, clientID, "round_analysis", analysis)
	}
}

// ─── Getters ───

// GetState returns the current room state.
func (r *Room) GetState() RoomState {
	return r.state
}

// GetTimeRemaining returns the time remaining in the current state.
func (r *Room) GetTimeRemaining() int {
	return r.timer
}

// GetHumanCount returns the number of human players.
func (r *Room) GetHumanCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.humans)
}

// GetPlayerCount returns the total player count (humans + bots).
func (r *Room) GetPlayerCount() int {
	return r.arena.GetPlayerCount()
}

// GetLastWinner returns the last round winner.
func (r *Room) GetLastWinner() *domain.WinnerInfo {
	return r.lastWinner
}

// GetArena returns the room's arena (for agent API observe).
func (r *Room) GetArena() *Arena {
	return r.arena
}

// IsJoinable returns whether this room can accept new players.
func (r *Room) IsJoinable() bool {
	if r.state == StateEnding || r.state == StateCooldown {
		return false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.humans) < r.roomConfig.MaxPlayersPerRoom
}

// ToRoomInfo creates a RoomInfo for lobby display.
func (r *Room) ToRoomInfo() domain.RoomInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return domain.RoomInfo{
		ID:            r.ID,
		State:         r.state.ToDomainStatus(),
		PlayerCount:   r.arena.GetPlayerCount(),
		MaxPlayers:    r.roomConfig.MaxPlayersPerRoom + r.roomConfig.BotsPerRoom,
		TimeRemaining: r.timer,
		Winner:        r.lastWinner,
	}
}

// ─── Frame helpers (avoid importing ws package) ───

type frame struct {
	E string          `json:"e"`
	D json.RawMessage `json:"d"`
}

func makeFrameBytes(event string, data interface{}) ([]byte, error) {
	d, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return json.Marshal(frame{E: event, D: json.RawMessage(d)})
}
