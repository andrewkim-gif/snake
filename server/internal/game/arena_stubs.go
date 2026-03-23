package game

// arena_stubs.go — Minimal stubs for symbols that were defined in
// the deleted Arena/agar.io PvP files but are still referenced by
// the surviving shared infrastructure (leveling, synergy, leaderboard,
// token_rewards, main.go, router.go, world package, etc.).
//
// These stubs are intentionally no-ops so that the tycoon engine
// can compile cleanly. They should be removed once the referencing
// code is fully migrated to tycoon-only logic.

import (
	"context"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// PlayerEpochStats — used by token_rewards.go / main.go
// ============================================================

// PlayerEpochStats holds per-player stats for a single epoch.
type PlayerEpochStats struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Nationality string `json:"nationality"`
	Kills       int    `json:"kills"`
	Deaths      int    `json:"deaths"`
	Assists     int    `json:"assists"`
	Level       int    `json:"level"`
	NationScore int    `json:"nationScore"`
}

// ============================================================
// PassiveDef — used by leveling.go / synergy.go
// ============================================================

// PassiveDef describes a passive ability definition.
type PassiveDef struct {
	Name        string
	Description string
	MaxStack    int
}

// GetPassiveDef returns the passive definition for the given type.
// Stub: always returns nil (no passives in tycoon mode).
func GetPassiveDef(_ domain.PassiveType) *PassiveDef {
	return nil
}

// ============================================================
// Combat stubs — used by leveling.go
// ============================================================

// OnLevelUpCombat adjusts combat stats on level up. Stub: no-op.
func OnLevelUpCombat(_ *domain.Agent) {}

// HasWeapon checks whether an agent has a weapon of the given type.
// Stub: always returns false.
func HasWeapon(_ *domain.Agent, _ domain.WeaponType) bool {
	return false
}

// AddWeapon adds a weapon to an agent's slots. Stub: no-op.
func AddWeapon(_ *domain.Agent, _ domain.WeaponType) {}

// RecalcPassiveEffects recalculates agent stats from passives. Stub: no-op.
func RecalcPassiveEffects(_ *domain.Agent) {}

// InitAgentCombatStats initialises combat-related fields on an agent. Stub: no-op.
func InitAgentCombatStats(_ *domain.Agent) {}

// ============================================================
// BuildPath — used by global_leaderboard.go / router.go
// ============================================================

// BuildPath represents a named weapon/passive build path.
type BuildPath struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// GetBuildPath returns a build path by ID. Stub: returns nil.
func GetBuildPath(_ string) *BuildPath { return nil }

// AllBuildPathIDs returns all known build path IDs. Stub: empty.
func AllBuildPathIDs() []string { return nil }

// AllBuildPaths returns all build paths. Stub: empty.
func AllBuildPaths() []*BuildPath { return nil }

// BotBuildPath represents a bot's build path. Stub.
type BotBuildPath struct {
	ID   string
	Name string
}

// ============================================================
// Nation Score constants — used by nation_score.go
// ============================================================

const (
	NationScorePerKill   = 10
	NationScorePerAssist = 5
	NationScorePerLevel  = 2
)

// ============================================================
// Weapon helpers — used by synergy.go
// ============================================================

// GetWeaponLevel returns the level of a weapon type on an agent.
func GetWeaponLevel(a *domain.Agent, wt domain.WeaponType) int {
	for _, slot := range a.WeaponSlots {
		if slot.Type == wt {
			return slot.Level
		}
	}
	return 0
}

// ============================================================
// Room — used by world/country_arena.go
// ============================================================

// RoomEventType classifies room events.
type RoomEventType string

const (
	RoomEvtKill         RoomEventType = "kill"
	RoomEvtDeath        RoomEventType = "death"
	RoomEvtARBattleEnd  RoomEventType = "ar_battle_end"
	RoomEvtArenaShrink  RoomEventType = "arena_shrink"
	RoomEvtStateUpdate  RoomEventType = "state_update"
	RoomEvtLevelUp      RoomEventType = "level_up"
	RoomEvtUpgradeReady RoomEventType = "upgrade_ready"
	RoomEvtRoundEnd     RoomEventType = "round_end"
	RoomEvtRoundStart   RoomEventType = "round_start"
	RoomEvtSpawn        RoomEventType = "spawn"
	RoomEvtLeaderboard  RoomEventType = "leaderboard"
	RoomEvtAREvent          RoomEventType = "ar_event"
	RoomEvtState            RoomEventType = "state"
	RoomEvtMinimap          RoomEventType = "minimap"
	RoomEvtSynergy          RoomEventType = "synergy"
	RoomEvtAgentLevelUp     RoomEventType = "agent_level_up"
	RoomEvtShrinkWarn       RoomEventType = "shrink_warn"
	RoomEvtRoundReset       RoomEventType = "round_reset"
	RoomEvtCoachMessage     RoomEventType = "coach_message"
	RoomEvtRoundAnalysis    RoomEventType = "round_analysis"
	RoomEvtBattleComplete   RoomEventType = "battle_complete"
	RoomEvtAbilityTriggered RoomEventType = "ability_triggered"
	RoomEvtARState          RoomEventType = "ar_state"
	RoomEvtARDamage         RoomEventType = "ar_damage"
	RoomEvtARLevelUp        RoomEventType = "ar_level_up"
	RoomEvtARKill           RoomEventType = "ar_kill"
	RoomEvtARPhaseChange    RoomEventType = "ar_phase_change"
	RoomEvtARMinibossDeath  RoomEventType = "ar_miniboss_death"
	RoomEvtAREliteExplosion RoomEventType = "ar_elite_explosion"
	RoomEvtARPvPKill        RoomEventType = "ar_pvp_kill"
	RoomEvtARBossSpawn      RoomEventType = "ar_boss_spawn"
	RoomEvtARBossDefeated   RoomEventType = "ar_boss_defeated"
)

// RoomEvent is a single event emitted by a Room during its tick loop.
type RoomEvent struct {
	Type        RoomEventType `json:"type"`
	RoomID      string        `json:"roomId,omitempty"`
	TargetID    string        `json:"targetId,omitempty"`
	Data        interface{}   `json:"data,omitempty"`
	CountryCode string        `json:"countryCode,omitempty"`
}

// RoomEventCallback is a function called with a batch of room events.
type RoomEventCallback func(events []RoomEvent)

// Room is the game room that manages a single arena session.
// Stub: provides the interface expected by the world package.
type Room struct {
	OnEvents RoomEventCallback
	config   RoomConfig
	id       string
	name     string
	mu       sync.RWMutex
	players  map[string]bool
}

// NewRoom creates a new game room. Stub implementation.
func NewRoom(id, name string, cfg RoomConfig) *Room {
	return &Room{
		config:  cfg,
		id:      id,
		name:    name,
		players: make(map[string]bool),
	}
}

// Run starts the room's game loop. Stub: blocks until context is cancelled.
func (r *Room) Run(ctx context.Context) {
	<-ctx.Done()
}

// AddPlayer adds a player to the room. Stub.
func (r *Room) AddPlayer(clientID, name string, skinID int, appearance string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.players[clientID] = true
	return nil
}

// RemovePlayer removes a player from the room. Stub.
func (r *Room) RemovePlayer(clientID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.players, clientID)
}

// HasPlayer checks if a player is in this room. Stub.
func (r *Room) HasPlayer(clientID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.players[clientID]
}

// PlayerCount returns the number of players. Stub.
func (r *Room) PlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.players)
}

// HandleInput handles legacy single-angle input. Stub: no-op.
func (r *Room) HandleInput(_ string, _ float64, _ bool, _ bool) {}

// HandleInputSplit handles split move/aim input. Stub: no-op.
func (r *Room) HandleInputSplit(_ string, _ float64, _ float64, _ bool, _ bool, _ bool) {}

// HandleChooseUpgrade handles upgrade choice. Stub: no-op.
func (r *Room) HandleChooseUpgrade(_ string, _ int) {}

// HandleARInput handles arena combat input. Stub: no-op.
func (r *Room) HandleARInput(_ string, _ ARInput) {}

// HandleARChoose handles arena tome/weapon choice. Stub: no-op.
func (r *Room) HandleARChoose(_ string, _ ARChoice) {}

// GetInfo returns room info. Stub.
func (r *Room) GetInfo() domain.RoomInfo {
	return domain.RoomInfo{ID: r.id, Name: r.name}
}

// GetArena returns the underlying Arena. Stub.
func (r *Room) GetArena() *Arena {
	return &Arena{}
}

// GetState returns the current room state. Stub.
func (r *Room) GetState() domain.RoomState {
	return domain.RoomStateWaiting
}

// GetJoinedEvent creates a joined event for a new player. Stub.
func (r *Room) GetJoinedEvent(_ string) domain.JoinedEvent {
	return domain.JoinedEvent{}
}

// GetRecentWinners returns recent winners. Stub.
func (r *Room) GetRecentWinners() []domain.WinnerInfo {
	return nil
}

// IsArenaCombat returns whether this room uses arena combat mode. Stub.
func (r *Room) IsArenaCombat() bool {
	return false
}

// ============================================================
// Arena — used by world/country_arena.go, main.go
// ============================================================

// Arena represents the in-game arena. Stub.
type Arena struct{}

// GetAgent returns an agent by ID. Stub.
func (a *Arena) GetAgent(id string) (*domain.Agent, bool) {
	return nil, false
}

// GetAgents returns all agents. Stub.
func (a *Arena) GetAgents() []*domain.Agent {
	return nil
}

// ============================================================
// ARInput / ARChoice — used by world package
// ============================================================

// ARInput represents arena combat movement input.
type ARInput struct {
	MoveAngle  float64 `json:"moveAngle"`
	AimAngle   float64 `json:"aimAngle"`
	Boost      bool    `json:"boost"`
	Dash       bool    `json:"dash"`
	UseAbility int     `json:"useAbility"`
	DirX       float64 `json:"dirX"`
	DirZ       float64 `json:"dirZ"`
	Jump       bool    `json:"jump"`
	Slide      bool    `json:"slide"`
	AimY       float64 `json:"aimY"`
}

// ARChoice represents arena tome/weapon selection.
type ARChoice struct {
	ChoiceIndex int    `json:"choiceIndex"`
	TomeID      string `json:"tomeId,omitempty"`
	WeaponID    string `json:"weaponId,omitempty"`
}

// ============================================================
// CountryArenaManager — used by main.go / router.go
// ============================================================

// CountryArenaEntry holds arena data for a country.
type CountryArenaEntry struct {
	Room        *Room
	NationScore *NationScoreTracker
	Domination  *DominationEngine
}

// CountryArenaManager manages per-country arenas.
type CountryArenaManager struct {
	mu     sync.RWMutex
	arenas map[string]*CountryArenaEntry
	config RoomConfig

	OnEvents          RoomEventCallback
	OnEpochEvents     func(events []EpochEvent)
	OnCaptureEvent    func(event CapturePointEvent)
	OnDominationEvent func(event DominationEvent)
}

// NewCountryArenaManager creates a new manager. Stub.
func NewCountryArenaManager(cfg RoomConfig) *CountryArenaManager {
	return &CountryArenaManager{
		arenas: make(map[string]*CountryArenaEntry),
		config: cfg,
	}
}

// GetArena returns the arena entry for a country code. Stub.
func (cam *CountryArenaManager) GetArena(countryCode string) *CountryArenaEntry {
	cam.mu.RLock()
	defer cam.mu.RUnlock()
	return cam.arenas[countryCode]
}

// TickActiveArenas ticks all active arenas. Stub: no-op.
func (cam *CountryArenaManager) TickActiveArenas(_ uint64) {}

// ============================================================
// CapturePointEvent — used by main.go
// ============================================================

// CapturePointEvent represents a capture point state change.
type CapturePointEvent struct {
	CountryCode string `json:"countryCode"`
	PointID     string `json:"pointId"`
	NewOwner    string `json:"newOwner"`
}

// ============================================================
// InactiveArenaReaper — used by main.go
// ============================================================

// InactiveArenaReaper monitors and cleans up idle arenas.
type InactiveArenaReaper struct{}

// NewInactiveArenaReaper creates a new reaper. Stub.
func NewInactiveArenaReaper() *InactiveArenaReaper {
	return &InactiveArenaReaper{}
}

// GetIdleArenas returns country codes of idle arenas. Stub.
func (r *InactiveArenaReaper) GetIdleArenas() []string {
	return nil
}

// RemoveTracking stops tracking a country. Stub: no-op.
func (r *InactiveArenaReaper) RemoveTracking(_ string) {}

// ============================================================
// CrossArenaManager — used by main.go
// ============================================================

// CrossArenaEvent represents a cross-arena event.
type CrossArenaEvent struct {
	Type        string `json:"type"`
	CountryCode string `json:"countryCode,omitempty"`
	Message     string `json:"message,omitempty"`
}

// CrossArenaManager manages cross-arena invasions.
type CrossArenaManager struct {
	OnEvent func(event CrossArenaEvent)
}

// NewCrossArenaManager creates a new manager. Stub.
func NewCrossArenaManager(_ *WarSystem, _ *CountryArenaManager) *CrossArenaManager {
	return &CrossArenaManager{}
}

// OnWarKill tracks war kills. Stub: no-op.
func (cam *CrossArenaManager) OnWarKill(_, _, _ string) {}

// ============================================================
// TrainingStore — used by main.go / router.go
// ============================================================

// BuildProfile holds build configuration for an agent.
type BuildProfile struct {
	PrimaryPath string `json:"primaryPath"`
}

// SetTrainingRequest is the request to update training settings.
type SetTrainingRequest struct {
	AgentID     string `json:"agentId"`
	Profile     string `json:"profile"`
	Personality string `json:"personality"`
}

// Validate validates the request. Stub: always OK.
func (r *SetTrainingRequest) Validate() error { return nil }

// ApplyToProfile applies the request to a profile. Stub.
func (r *SetTrainingRequest) ApplyToProfile(agentID string, existing *TrainingProfile) *TrainingProfile {
	if existing == nil {
		existing = &TrainingProfile{AgentID: agentID}
	}
	existing.Profile = r.Profile
	existing.Personality = r.Personality
	return existing
}

// TrainingProfile holds training configuration.
type TrainingProfile struct {
	AgentID      string       `json:"agentId"`
	Profile      string       `json:"profile"`
	Personality  string       `json:"personality"`
	BuildProfile BuildProfile `json:"buildProfile"`
}

// TrainingStore manages agent training profiles.
type TrainingStore struct {
	mu       sync.RWMutex
	profiles map[string]*TrainingProfile
}

// NewTrainingStore creates a new training store. Stub.
func NewTrainingStore(_ string) *TrainingStore {
	return &TrainingStore{
		profiles: make(map[string]*TrainingProfile),
	}
}

// GetProfile returns a training profile by agent ID. Stub.
func (ts *TrainingStore) GetProfile(agentID string) (*TrainingProfile, bool) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	p, ok := ts.profiles[agentID]
	return p, ok
}

// SetProfile stores a training profile. Stub.
func (ts *TrainingStore) SetProfile(agentID string, prof *TrainingProfile) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	prof.AgentID = agentID
	ts.profiles[agentID] = prof
	return nil
}

// ============================================================
// MemoryStore — used by main.go / router.go
// ============================================================

// MemoryStore manages agent memory. Stub.
type MemoryStore struct{}

// NewMemoryStore creates a new memory store. Stub.
func NewMemoryStore(_ string) *MemoryStore {
	return &MemoryStore{}
}

// GetMemory returns agent memory data. Stub.
func (ms *MemoryStore) GetMemory(_ string) (interface{}, bool) {
	return nil, false
}

// GetMemoryStats returns memory statistics. Stub.
func GetMemoryStats() map[string]interface{} {
	return map[string]interface{}{
		"status": "arena_removed",
	}
}

// ============================================================
// TickProfiler — used by main.go / router.go
// ============================================================

// TickProfiler profiles game tick performance. Stub.
type TickProfiler struct{}

// NewTickProfiler creates a new profiler. Stub.
func NewTickProfiler() *TickProfiler {
	return &TickProfiler{}
}

// GetStats returns tick profiler statistics. Stub.
func (tp *TickProfiler) GetStats() interface{} {
	return nil
}

// ============================================================
// BandwidthMonitor — used by main.go / router.go
// ============================================================

// BandwidthMonitor monitors bandwidth usage. Stub.
type BandwidthMonitor struct{}

// NewBandwidthMonitor creates a new monitor. Stub.
func NewBandwidthMonitor() *BandwidthMonitor {
	return &BandwidthMonitor{}
}

// ============================================================
// TokenBalanceCache — used by router.go / matrix handler
// ============================================================

// TokenBalanceCache caches token balances. Stub.
type TokenBalanceCache struct{}

// NewTokenBalanceCache creates a new cache. Stub.
func NewTokenBalanceCache(_ interface{}) *TokenBalanceCache {
	return &TokenBalanceCache{}
}

// ============================================================
// TokenBuffApplier — used by matrix handler / main.go
// ============================================================

// TokenBuffs lists all token buff types. Stub.
var TokenBuffs []string

// NoTokenBuff is the zero-value buff. Stub.
var NoTokenBuff = ""

// TokenBuffApplier applies token-based buffs. Stub.
type TokenBuffApplier struct{}

// NewTokenBuffApplier creates a new applier. Stub.
func NewTokenBuffApplier() *TokenBuffApplier {
	return &TokenBuffApplier{}
}

// ============================================================
// BuildObserveGameResponse — used by main.go
// ============================================================

// BuildObserveGameResponse creates an observation for the agent. Stub.
func BuildObserveGameResponse(_ *domain.Agent, _ *Arena) interface{} {
	return nil
}

// ============================================================
// PersonalityPresets — used by router.go
// ============================================================

// PersonalityPresets contains predefined agent personalities. Stub.
var PersonalityPresets = map[string]string{}

// ============================================================
// RewardHistoryEntry — used by matrix handler
// ============================================================

// RewardHistoryEntry represents a reward history item. Stub.
type RewardHistoryEntry struct {
	ID        string  `json:"id"`
	PlayerID  string  `json:"playerId"`
	Amount    float64 `json:"amount"`
	Reason    string  `json:"reason"`
	Timestamp int64   `json:"timestamp"`
}

// ArenaEvent represents an arena-specific event. Stub.
type ArenaEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
}

// EventSynergy is the synergy event type constant.
const EventSynergy = "synergy"

// ============================================================
// DailyChallengeManager — used by main.go / router.go
// ============================================================

// DailyChallengeManager manages daily challenges. Stub.
type DailyChallengeManager struct{}

// NewDailyChallengeManager creates a new manager. Stub.
func NewDailyChallengeManager(_ *AccountLevelManager) *DailyChallengeManager {
	return &DailyChallengeManager{}
}

// GetSnapshot returns daily challenge state for a player. Stub: returns nil.
func (d *DailyChallengeManager) GetSnapshot(_ string) interface{} {
	return nil
}

// ClaimReward claims a completed daily challenge reward. Stub.
func (d *DailyChallengeManager) ClaimReward(_ string, _ int) (string, error) {
	return "", nil
}

// GetTodayDefs returns today's challenge definitions. Stub.
func (d *DailyChallengeManager) GetTodayDefs() interface{} {
	return nil
}

// ============================================================
// ChallengeEpochProgress — used by main.go
// ============================================================

// ChallengeEpochProgress holds epoch progress for daily challenges.
type ChallengeEpochProgress struct {
	PlayerID       string `json:"playerId"`
	Kills          int    `json:"kills"`
	Assists        int    `json:"assists"`
	EpochsSurvived int    `json:"epochsSurvived"`
	LevelReached   int    `json:"levelReached"`
	TotalPlayers   int    `json:"totalPlayers"`
}

// ProcessEpochProgress processes epoch progress for challenges. Stub: no-op.
func (d *DailyChallengeManager) ProcessEpochProgress(_ *ChallengeEpochProgress) {}

// ============================================================
// TokenBalanceCache methods — used by main.go
// ============================================================

// StartPolling starts polling for token balances. Stub: no-op.
func (t *TokenBalanceCache) StartPolling() {}

// StopPolling stops polling for token balances. Stub: no-op.
func (t *TokenBalanceCache) StopPolling() {}

// ============================================================
// BandwidthMonitor methods
// ============================================================

// Reset resets the bandwidth monitor. Stub: no-op.
func (b *BandwidthMonitor) Reset() {}
