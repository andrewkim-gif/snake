package game

import (
	"log/slog"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// Arena Combat — Room Integration (v18 Phase 4)
// ============================================================
//
// This file extends Room to support ArenaCombat mode alongside
// ClassicCombat mode. Room checks its Config.CombatMode to decide
// which path to take during startRound, tickPlaying, etc.

// ── ArenaCombat state on Room ──────────────────────────────

// ARRoomState holds ArenaCombat-specific state within a Room.
type ARRoomState struct {
	Combat *ArenaCombat

	// AI bot states
	AIBots []*ARBotState

	// Cached player list for GetState
	playerList []*ARPlayer
}

// ARBotState holds per-bot AI state.
type ARBotState struct {
	PlayerID string
	Profile  *ARBuildProfile
	Tactical ARTacticalState
	Reflexive ARReflexiveState
}

// IsArenaCombat returns true if this room uses ArenaCombat mode.
func (r *Room) IsArenaCombat() bool {
	return r.Config.CombatMode == CombatModeArena
}

// InitArenaCombat initializes the ArenaCombat state for a room.
// Called from startRound when CombatMode == "arena".
func (r *Room) InitArenaCombat() {
	ac := NewArenaCombat()
	maxAgents := CalcMaxAgentsByTier(r.Config.CountryTier)

	ac.Init(CombatModeConfig{
		ArenaRadius:  TierArenaRadius(r.Config.CountryTier),
		Tier:         r.Config.CountryTier,
		TerrainTheme: r.Config.TerrainTheme,
		MaxAgents:    maxAgents,
		BattleMode:   "standard",
	})

	// Create AI bots (60% of max agents)
	botCount := maxAgents * 60 / 100
	if botCount < 2 {
		botCount = 2
	}

	bots := make([]*ARBotState, 0, botCount)
	charTypes := []ARCharacterType{
		ARCharStriker, ARCharGuardian, ARCharPyro, ARCharFrostMage,
		ARCharSniper, ARCharGambler, ARCharBerserker, ARCharShadow,
	}
	botNames := []string{
		"Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot",
		"Golf", "Hotel", "India", "Juliet", "Kilo", "Lima",
		"Mike", "November", "Oscar", "Papa", "Quebec", "Romeo",
		"Sierra", "Tango", "Uniform", "Victor", "Whiskey", "Xray",
		"Yankee", "Zulu", "Apex", "Blitz", "Cipher", "Dart",
	}

	for i := 0; i < botCount; i++ {
		charType := charTypes[rand.Intn(len(charTypes))]
		profile := ProfileForCharacter(charType)
		name := "Bot"
		if i < len(botNames) {
			name = botNames[i]
		}

		botID := generateBotID(i)
		info := &PlayerInfo{
			ID:        botID,
			Name:      name,
			Character: string(charType),
		}
		ac.OnPlayerJoin(info)

		// Set faction for bot
		if p, ok := ac.players[botID]; ok {
			p.FactionID = r.Config.CountryISO3
		}

		bots = append(bots, &ARBotState{
			PlayerID:  botID,
			Profile:   profile,
			Tactical:  ARTacticalState{Goal: ARGoalFarm},
			Reflexive: ARReflexiveState{},
		})
	}

	r.arState = &ARRoomState{
		Combat: ac,
		AIBots: bots,
	}

	slog.Info("arena combat initialized",
		"roomId", r.ID,
		"tier", r.Config.CountryTier,
		"maxAgents", maxAgents,
		"bots", botCount,
	)
}

// generateBotID creates a unique bot ID.
func generateBotID(index int) string {
	return "bot_" + string(rune('a'+index/26)) + string(rune('a'+index%26))
}

// TickArenaCombat processes one tick of arena combat.
// Called from Room.tickPlaying() when in arena mode.
func (r *Room) TickArenaCombat(delta float64, tick uint64) {
	if r.arState == nil || r.arState.Combat == nil {
		return
	}

	ac := r.arState.Combat

	// 1. Tick AI bots
	r.tickAIBots(delta)

	// 2. Tick combat
	events := ac.OnTick(delta, tick)

	// 3. Forward combat events to room event system
	if len(events) > 0 {
		var roomEvents []RoomEvent
		for _, evt := range events {
			roomEvents = append(roomEvents, RoomEvent{
				RoomID:   r.ID,
				Type:     combatEventToRoomType(evt.Type),
				TargetID: evt.TargetID,
				Data:     evt.Data,
			})
		}
		r.emitEvents(roomEvents)
	}

	// 4. Broadcast ar_state at 20Hz
	state := ac.GetState()
	r.emitEvents([]RoomEvent{{
		RoomID: r.ID,
		Type:   RoomEvtARState,
		Data:   state,
	}})
}

// tickAIBots runs the AI decision layers for all bots.
func (r *Room) tickAIBots(delta float64) {
	if r.arState == nil || r.arState.Combat == nil {
		return
	}

	ac := r.arState.Combat

	// Collect player list and enemy list for AI
	playerList := make([]*ARPlayer, 0, len(ac.players))
	for _, p := range ac.players {
		playerList = append(playerList, p)
	}

	for _, bot := range r.arState.AIBots {
		player, ok := ac.players[bot.PlayerID]
		if !ok || !player.Alive {
			continue
		}

		// Tactical layer: runs at 2Hz
		bot.Tactical.RecalcTimer -= delta
		if bot.Tactical.RecalcTimer <= 0 {
			bot.Tactical.RecalcTimer = ARTacticalInterval
			TacticalUpdate(
				player, &bot.Tactical, bot.Profile,
				ac.enemies, playerList,
				ac.fieldItems, ac.xpCrystals,
				ac.phase,
			)
		}

		// Reflexive layer: runs every tick (20Hz)
		ReflexiveUpdate(player, &bot.Reflexive, &bot.Tactical, ac.enemies, delta)

		// Apply AI movement
		ApplyAIInput(player, &bot.Reflexive)

		// AI auto-choose tome during level-up
		if player.PendingLevelUp && len(player.LevelUpChoices) > 0 {
			choiceIdx := TacticalChooseTome(player, player.LevelUpChoices, bot.Profile)
			offer := player.LevelUpChoices[choiceIdx]
			ac.OnChoose(bot.PlayerID, ARChoice{TomeID: string(offer.TomeID)})
		}
	}
}

// combatEventToRoomType maps CombatEvent types to RoomEventType.
func combatEventToRoomType(evtType string) RoomEventType {
	switch evtType {
	case "death":
		return RoomEvtDeath
	case "ar_damage":
		return RoomEvtARDamage
	case "ar_level_up":
		return RoomEvtARLevelUp
	case "enemy_kill":
		return RoomEvtARKill
	case "phase_change":
		return RoomEvtARPhaseChange
	case "miniboss_death":
		return RoomEvtARMinibossDeath
	case "elite_explosion":
		return RoomEvtAREliteExplosion
	case "battle_end":
		return RoomEvtARBattleEnd
	default:
		return RoomEvtARState
	}
}

// HandleARInput forwards player input to ArenaCombat.
func (r *Room) HandleARInput(clientID string, input ARInput) {
	r.mu.RLock()
	state := r.state
	r.mu.RUnlock()

	if state != domain.RoomStatePlaying {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if r.arState != nil && r.arState.Combat != nil {
		r.arState.Combat.OnInput(clientID, input)
	}
}

// HandleARChoose forwards tome/weapon choice to ArenaCombat.
func (r *Room) HandleARChoose(clientID string, choice ARChoice) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.arState != nil && r.arState.Combat != nil {
		r.arState.Combat.OnChoose(clientID, choice)
	}
}

// AddARPlayer adds a player to the arena combat.
func (r *Room) AddARPlayer(info *PlayerInfo) {
	if r.arState != nil && r.arState.Combat != nil {
		r.arState.Combat.OnPlayerJoin(info)
		// Set faction
		if p, ok := r.arState.Combat.players[info.ID]; ok {
			p.FactionID = r.Config.CountryISO3
		}
	}
}

// RemoveARPlayer removes a player from the arena combat.
func (r *Room) RemoveARPlayer(clientID string) {
	if r.arState != nil && r.arState.Combat != nil {
		r.arState.Combat.OnPlayerLeave(clientID)
	}
}

// CleanupArenaCombat releases arena combat resources.
func (r *Room) CleanupArenaCombat() {
	if r.arState != nil && r.arState.Combat != nil {
		r.arState.Combat.Cleanup()
	}
	r.arState = nil
}

// ============================================================
// Tier-based Configuration
// ============================================================

// CalcMaxAgentsByTier returns the maximum number of agents for a tier.
func CalcMaxAgentsByTier(tier string) int {
	switch tier {
	case "S":
		return 50
	case "A":
		return 35
	case "B":
		return 25
	case "C":
		return 15
	case "D":
		return 8
	default:
		return 25 // B-tier default
	}
}

// TierArenaRadius returns the arena radius for a tier (in meters).
func TierArenaRadius(tier string) float64 {
	switch tier {
	case "S":
		return 60.0
	case "A":
		return 45.0
	case "B":
		return 35.0
	case "C":
		return 25.0
	case "D":
		return 15.0
	default:
		return 35.0
	}
}

// TierMaxHumans returns the max human slots (40% of max agents).
func TierMaxHumans(tier string) int {
	max := CalcMaxAgentsByTier(tier)
	humans := max * 40 / 100
	if humans < 3 {
		humans = 3
	}
	return humans
}
