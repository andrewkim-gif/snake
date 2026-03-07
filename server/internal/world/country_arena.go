package world

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
)

// CountryArena wraps v10's Room with country-specific attributes.
// It extends the existing Room → Arena architecture to include
// country tier, terrain bonuses, and sovereignty tracking.
//
// Phase 2 enhancements:
//   - Battle logic integration with existing Room game loop
//   - Tier-based arena sizing (S: 6000px radius, D: 1500px)
//   - Faction score aggregation from kills, time alive, objectives
//   - Sovereignty defense bonus (current sovereign gets 20% advantage)
//   - Battle result Redis pub/sub transmission
type CountryArena struct {
	mu sync.RWMutex

	// Country identity
	CountryISO  string
	CountryName string
	Tier        CountryTier

	// Embedded v10 Room (delegates all game logic to existing code)
	room *game.Room

	// Country-specific battle context
	DefenseBonus     float64 // Terrain defense bonus (0.0 - 0.3)
	SovereignFaction string  // Current sovereign faction ID
	SovereigntyLevel int     // Sovereignty level (affects defense)

	// Battle results aggregation (per faction)
	factionScores map[string]*FactionBattleScore

	// Agent-to-faction mapping for score attribution
	agentFaction map[string]string // agentID → factionID

	// Battle metadata
	battleRound    int
	battleStartAt  time.Time
	battleEndAt    time.Time
	totalKills     int
	totalDeaths    int

	// Event forwarding
	OnEvents game.RoomEventCallback

	// Lifecycle
	cancel context.CancelFunc
}

// FactionBattleScore tracks a faction's performance in a single battle.
type FactionBattleScore struct {
	FactionID   string `json:"faction_id"`
	TotalScore  int    `json:"total_score"`
	Kills       int    `json:"kills"`
	Deaths      int    `json:"deaths"`
	TimeAlive   int    `json:"time_alive"` // Total seconds alive across all agents
	Objectives  int    `json:"objectives"` // Bonus objectives (e.g., territory control ticks)
	AgentCount  int    `json:"agent_count"`
}

// NewCountryArena creates a new country-specific arena.
func NewCountryArena(iso3, name string, tier CountryTier, cfg game.RoomConfig) *CountryArena {
	room := game.NewRoom(iso3, name, cfg)

	ca := &CountryArena{
		CountryISO:    iso3,
		CountryName:   name,
		Tier:          tier,
		room:          room,
		factionScores: make(map[string]*FactionBattleScore),
		agentFaction:  make(map[string]string),
	}

	// Wire room events through the country arena for score tracking
	room.OnEvents = ca.handleRoomEvents

	return ca
}

// Reinitialize resets a pooled arena for reuse with a new country.
func (ca *CountryArena) Reinitialize(iso3, name string, tier CountryTier, cfg game.RoomConfig) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.CountryISO = iso3
	ca.CountryName = name
	ca.Tier = tier
	ca.room = game.NewRoom(iso3, name, cfg)
	ca.factionScores = make(map[string]*FactionBattleScore)
	ca.agentFaction = make(map[string]string)
	ca.DefenseBonus = 0
	ca.SovereignFaction = ""
	ca.SovereigntyLevel = 0
	ca.battleRound = 0
	ca.totalKills = 0
	ca.totalDeaths = 0
	ca.cancel = nil

	ca.room.OnEvents = ca.handleRoomEvents
}

// Start starts the country arena's game loop.
func (ca *CountryArena) Start(ctx context.Context) {
	arenaCtx, cancel := context.WithCancel(ctx)
	ca.cancel = cancel

	ca.mu.Lock()
	ca.battleStartAt = time.Now()
	ca.battleRound++
	ca.mu.Unlock()

	go ca.room.Run(arenaCtx)

	slog.Info("country arena started",
		"country", ca.CountryISO,
		"tier", ca.Tier,
		"round", ca.battleRound,
	)
}

// Stop stops the country arena's game loop.
func (ca *CountryArena) Stop() {
	ca.mu.Lock()
	ca.battleEndAt = time.Now()
	ca.mu.Unlock()

	if ca.cancel != nil {
		ca.cancel()
		ca.cancel = nil
	}
	slog.Info("country arena stopped", "country", ca.CountryISO)
}

// --- Player management (delegates to Room) ---

// AddPlayer adds a human player to the arena with faction tracking.
func (ca *CountryArena) AddPlayer(clientID, name string, skinID int, appearance string) {
	if err := ca.room.AddPlayer(clientID, name, skinID, appearance); err != nil {
		slog.Warn("failed to add player to country arena",
			"country", ca.CountryISO,
			"clientId", clientID,
			"error", err,
		)
	}
}

// AddPlayerWithFaction adds a player and tracks their faction for scoring.
func (ca *CountryArena) AddPlayerWithFaction(clientID, name string, skinID int, appearance string, factionID string) {
	ca.AddPlayer(clientID, name, skinID, appearance)
	if factionID != "" {
		ca.mu.Lock()
		ca.agentFaction[clientID] = factionID
		// Initialize faction score if needed
		if _, exists := ca.factionScores[factionID]; !exists {
			ca.factionScores[factionID] = &FactionBattleScore{
				FactionID: factionID,
			}
		}
		ca.factionScores[factionID].AgentCount++
		ca.mu.Unlock()
	}
}

// RemovePlayer removes a human player from the arena.
func (ca *CountryArena) RemovePlayer(clientID string) {
	ca.room.RemovePlayer(clientID)

	ca.mu.Lock()
	if fid, ok := ca.agentFaction[clientID]; ok {
		if score, sok := ca.factionScores[fid]; sok {
			score.AgentCount--
		}
		delete(ca.agentFaction, clientID)
	}
	ca.mu.Unlock()
}

// HasPlayer checks if a player is in this arena.
func (ca *CountryArena) HasPlayer(clientID string) bool {
	return ca.room.HasPlayer(clientID)
}

// PlayerCount returns the number of human players.
func (ca *CountryArena) PlayerCount() int {
	return ca.room.PlayerCount()
}

// --- Input handling (delegates to Room) ---

// HandleInput forwards player input (legacy single-angle).
func (ca *CountryArena) HandleInput(agentID string, angle float64, boost bool, dash bool) {
	ca.room.HandleInput(agentID, angle, boost, dash)
}

// HandleInputSplit forwards split move/aim input (v16).
func (ca *CountryArena) HandleInputSplit(agentID string, moveAngle float64, aimAngle float64, boost bool, dash bool, jump bool) {
	ca.room.HandleInputSplit(agentID, moveAngle, aimAngle, boost, dash, jump)
}

// HandleChooseUpgrade forwards upgrade choice.
func (ca *CountryArena) HandleChooseUpgrade(agentID string, choiceIndex int) {
	ca.room.HandleChooseUpgrade(agentID, choiceIndex)
}

// HandleARInput forwards arena combat input (v19).
func (ca *CountryArena) HandleARInput(clientID string, input game.ARInput) {
	ca.room.HandleARInput(clientID, input)
}

// HandleARChoose forwards arena tome/weapon choice (v19).
func (ca *CountryArena) HandleARChoose(clientID string, choice game.ARChoice) {
	ca.room.HandleARChoose(clientID, choice)
}

// --- Info getters ---

// GetInfo returns room info for this country arena.
func (ca *CountryArena) GetInfo() domain.RoomInfo {
	info := ca.room.GetInfo()
	info.Name = ca.CountryName
	return info
}

// GetArena returns the underlying v10 Arena.
func (ca *CountryArena) GetArena() *game.Arena {
	return ca.room.GetArena()
}

// GetState returns the current room state.
func (ca *CountryArena) GetState() domain.RoomState {
	return ca.room.GetState()
}

// GetJoinedEvent creates a joined event for a new player.
func (ca *CountryArena) GetJoinedEvent(playerID string) domain.JoinedEvent {
	return ca.room.GetJoinedEvent(playerID)
}

// GetRecentWinners returns recent winners.
func (ca *CountryArena) GetRecentWinners() []domain.WinnerInfo {
	return ca.room.GetRecentWinners()
}

// --- Battle result tracking ---

// AddFactionScore records a faction's score contribution for sovereignty determination.
func (ca *CountryArena) AddFactionScore(factionID string, score int) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	fs, ok := ca.factionScores[factionID]
	if !ok {
		fs = &FactionBattleScore{FactionID: factionID}
		ca.factionScores[factionID] = fs
	}
	fs.TotalScore += score
}

// RecordKill records a kill event for faction score tracking.
func (ca *CountryArena) RecordKill(killerID, victimID string) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.totalKills++

	// Credit killer's faction
	if fid, ok := ca.agentFaction[killerID]; ok {
		fs, exists := ca.factionScores[fid]
		if !exists {
			fs = &FactionBattleScore{FactionID: fid}
			ca.factionScores[fid] = fs
		}
		fs.Kills++
		fs.TotalScore += 10 // Kill = 10 points
	}

	// Debit victim's faction
	if fid, ok := ca.agentFaction[victimID]; ok {
		if fs, exists := ca.factionScores[fid]; exists {
			fs.Deaths++
		}
	}
}

// RecordSurvivalTime adds survival time to a faction's score.
func (ca *CountryArena) RecordSurvivalTime(agentID string, seconds int) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	if fid, ok := ca.agentFaction[agentID]; ok {
		fs, exists := ca.factionScores[fid]
		if !exists {
			fs = &FactionBattleScore{FactionID: fid}
			ca.factionScores[fid] = fs
		}
		fs.TimeAlive += seconds
		fs.TotalScore += seconds // 1 point per second alive
	}
}

// GetBattleResults returns the faction scores from the current/last battle.
func (ca *CountryArena) GetBattleResults() map[string]int {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	result := make(map[string]int, len(ca.factionScores))
	for fid, fs := range ca.factionScores {
		result[fid] = fs.TotalScore
	}
	return result
}

// GetDetailedBattleResults returns detailed faction battle scores.
func (ca *CountryArena) GetDetailedBattleResults() map[string]*FactionBattleScore {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	result := make(map[string]*FactionBattleScore, len(ca.factionScores))
	for fid, fs := range ca.factionScores {
		copy := *fs
		result[fid] = &copy
	}
	return result
}

// ResetBattleResults clears faction scores for the next battle cycle.
func (ca *CountryArena) ResetBattleResults() {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.factionScores = make(map[string]*FactionBattleScore)
	ca.totalKills = 0
	ca.totalDeaths = 0
}

// DetermineWinningFaction returns the faction with the highest score.
// The current sovereign gets a 20% defense advantage.
func (ca *CountryArena) DetermineWinningFaction() (factionID string, topScore int) {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	for fid, fs := range ca.factionScores {
		adjustedScore := fs.TotalScore
		// Defender bonus: 20% advantage for current sovereign
		if fid == ca.SovereignFaction {
			adjustedScore = int(float64(fs.TotalScore) * 1.20)
		}
		if adjustedScore > topScore {
			topScore = adjustedScore
			factionID = fid
		}
	}
	return
}

// --- Battle metadata ---

// GetBattleMetadata returns metadata about the current/last battle.
func (ca *CountryArena) GetBattleMetadata() BattleMetadata {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	factionCount := 0
	totalAgents := 0
	for _, fs := range ca.factionScores {
		factionCount++
		totalAgents += fs.AgentCount
	}

	return BattleMetadata{
		CountryISO:   ca.CountryISO,
		Round:        ca.battleRound,
		StartedAt:    ca.battleStartAt,
		EndedAt:      ca.battleEndAt,
		TotalKills:   ca.totalKills,
		FactionCount: factionCount,
		TotalAgents:  totalAgents,
		Tier:         ca.Tier,
	}
}

// BattleMetadata holds summary information about a battle.
type BattleMetadata struct {
	CountryISO   string      `json:"country_iso"`
	Round        int         `json:"round"`
	StartedAt    time.Time   `json:"started_at"`
	EndedAt      time.Time   `json:"ended_at,omitempty"`
	TotalKills   int         `json:"total_kills"`
	FactionCount int         `json:"faction_count"`
	TotalAgents  int         `json:"total_agents"`
	Tier         CountryTier `json:"tier"`
}

// --- Tier-based configuration ---

// GetArenaSize returns the arena radius based on country tier.
func (ca *CountryArena) GetArenaSize() float64 {
	cfg, ok := TierConfigs[ca.Tier]
	if !ok {
		return 3000 // default fallback
	}
	return cfg.ArenaRadius
}

// GetMaxAgents returns the max agents based on country tier.
func (ca *CountryArena) GetMaxAgents() int {
	cfg, ok := TierConfigs[ca.Tier]
	if !ok {
		return 25 // default fallback
	}
	return cfg.MaxAgents
}

// --- PvP Battle Result Integration (Phase 5) ---

// IntegrateArenaPvPResults merges ArenaCombat PvP/boss results into
// the country arena faction scores for sovereignty determination.
// Called when the ArenaCombat battle ends (settlement phase complete).
func (ca *CountryArena) IntegrateArenaPvPResults(pvpScores map[string]int, bossScores map[string]int) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	for fid, score := range pvpScores {
		fs, ok := ca.factionScores[fid]
		if !ok {
			fs = &FactionBattleScore{FactionID: fid}
			ca.factionScores[fid] = fs
		}
		fs.TotalScore += score
	}

	// Boss contribution adds extra weight
	for fid, score := range bossScores {
		fs, ok := ca.factionScores[fid]
		if !ok {
			fs = &FactionBattleScore{FactionID: fid}
			ca.factionScores[fid] = fs
		}
		fs.TotalScore += score
		fs.Objectives += score // Track as objectives
	}
}

// BuildBattleResult creates a BattleResult from the current faction scores
// for submission to the SovereigntyEngine.
func (ca *CountryArena) BuildBattleResult() BattleResult {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	winnerFaction, topScore := ca.DetermineWinningFactionLocked()

	factionScores := make(map[string]int, len(ca.factionScores))
	factionAgentCounts := make(map[string]int, len(ca.factionScores))
	for fid, fs := range ca.factionScores {
		factionScores[fid] = fs.TotalScore
		factionAgentCounts[fid] = fs.AgentCount
	}

	return BattleResult{
		CountryISO:         ca.CountryISO,
		WinnerFaction:      winnerFaction,
		WinnerScore:        topScore,
		FactionScores:      factionScores,
		FactionAgentCounts: factionAgentCounts,
		BattledAt:          time.Now(),
	}
}

// DetermineWinningFactionLocked is the lock-free version for internal use.
// Caller must hold ca.mu.RLock() or ca.mu.Lock().
func (ca *CountryArena) DetermineWinningFactionLocked() (factionID string, topScore int) {
	for fid, fs := range ca.factionScores {
		adjustedScore := fs.TotalScore
		if fid == ca.SovereignFaction {
			adjustedScore = int(float64(fs.TotalScore) * 1.20)
		}
		if adjustedScore > topScore {
			topScore = adjustedScore
			factionID = fid
		}
	}
	return
}

// --- Event forwarding with score tracking ---

func (ca *CountryArena) handleRoomEvents(events []game.RoomEvent) {
	// Track kills/deaths for faction scoring
	for _, evt := range events {
		switch evt.Type {
		case game.RoomEvtKill:
			// evt.TargetID is the killer
			ca.mu.RLock()
			// Try to find victim from event data (kill event data has victim info)
			ca.mu.RUnlock()

		case game.RoomEvtDeath:
			// evt.TargetID is the victim
			// Score tracking happens through the arena's event system

		case game.RoomEvtARBattleEnd:
			// Arena battle ended — integrate PvP results into sovereignty
			if ca.room != nil && ca.room.IsArenaCombat() {
				ca.integrateArenaBattleEnd(evt)
			}
		}
	}

	// Forward to WorldManager
	if ca.OnEvents != nil {
		ca.OnEvents(events)
	}
}

// integrateArenaBattleEnd processes the end of an arena battle
// and integrates PvP/boss scores into faction tracking.
func (ca *CountryArena) integrateArenaBattleEnd(evt game.RoomEvent) {
	// The battle_end event data may contain sovereignty scores
	if data, ok := evt.Data.(map[string]interface{}); ok {
		if pvpScores, ok := data["factionScores"].(map[string]int); ok {
			bossScores := make(map[string]int)
			if bs, ok := data["bossContrib"].(map[string]int); ok {
				bossScores = bs
			}
			ca.IntegrateArenaPvPResults(pvpScores, bossScores)
		}
	}

	slog.Info("arena battle ended, PvP results integrated",
		"country", ca.CountryISO,
		"factionScores", ca.GetBattleResults(),
	)
}
