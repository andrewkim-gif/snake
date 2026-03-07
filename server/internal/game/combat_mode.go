package game

// CombatMode defines the interface for pluggable combat systems.
// Room delegates tick processing, player lifecycle, and state serialization
// to whatever CombatMode is currently active.
// This enables ArenaCombat (v18) and ClassicCombat (v10-v17) to coexist
// without modifying Room's state machine.
type CombatMode interface {
	// Init is called once when the Room transitions to Playing state.
	// Receives the arena config (radius, tier, terrain, biome).
	Init(cfg CombatModeConfig)

	// OnTick is called every server tick (20Hz, 50ms interval).
	// Returns events to be emitted to connected clients.
	OnTick(delta float64, tick uint64) []CombatEvent

	// OnPlayerJoin handles a new player entering the arena mid-battle.
	OnPlayerJoin(info *PlayerInfo)

	// OnPlayerLeave handles a player disconnecting or leaving.
	OnPlayerLeave(clientID string)

	// OnInput processes player input (movement direction, slide, jump).
	OnInput(clientID string, input ARInput)

	// OnChoose handles Tome/weapon selection during level-up.
	OnChoose(clientID string, choice ARChoice)

	// GetState returns the full game state for serialization (20Hz broadcast).
	GetState() interface{}

	// Cleanup releases resources when the round ends.
	Cleanup()
}

// CombatEvent is an event emitted by a CombatMode during a tick.
type CombatEvent struct {
	Type     string
	TargetID string      // specific client (empty = broadcast to room)
	Data     interface{} // event-specific payload
}

// CombatModeConfig holds initialization parameters passed from Room/CountryArena.
type CombatModeConfig struct {
	ArenaRadius  float64
	Tier         string // "S", "A", "B", "C", "D"
	TerrainTheme string // "urban", "desert", "mountain", "forest", "arctic", "island"
	MaxAgents    int
	BattleMode   string // "standard" (5min) or "marathon" (1hr)
}

// ---------------------------------------------------------------------------
// ClassicCombat — backward-compatible wrapper for the existing Arena (v10-v17)
// ---------------------------------------------------------------------------

// ClassicCombat wraps the existing Arena as a CombatMode.
// Zero behavioral changes — purely structural adapter.
type ClassicCombat struct {
	arena *Arena
}

// NewClassicCombat wraps an existing Arena instance.
func NewClassicCombat(arena *Arena) *ClassicCombat {
	return &ClassicCombat{arena: arena}
}

func (c *ClassicCombat) Init(_ CombatModeConfig) {
	// Arena is already initialised by Room; nothing extra to do.
}

func (c *ClassicCombat) OnTick(_ float64, _ uint64) []CombatEvent {
	// Classic arena processes ticks through its own loop; no CombatEvents emitted.
	return nil
}

func (c *ClassicCombat) OnPlayerJoin(_ *PlayerInfo) {
	// Player join is handled directly by Arena.AddAgent via Room.
}

func (c *ClassicCombat) OnPlayerLeave(_ string) {
	// Player leave is handled directly by Arena.RemoveAgent via Room.
}

func (c *ClassicCombat) OnInput(_ string, _ ARInput) {
	// Classic mode doesn't use ARInput; Room handles input differently.
}

func (c *ClassicCombat) OnChoose(_ string, _ ARChoice) {
	// Classic mode doesn't have Tome/weapon choices in this interface.
}

func (c *ClassicCombat) GetState() interface{} {
	// Classic mode state is serialized by StateSerializer, not CombatMode.
	return nil
}

func (c *ClassicCombat) Cleanup() {
	// Arena cleanup is managed by Room.
}
