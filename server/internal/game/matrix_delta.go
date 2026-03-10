package game

import (
	"sync"
)

// ============================================================
// v33 Phase 8 — Delta Compression for matrix_state packets
//
// Tracks per-arena previous player states and only sends
// changed fields. Full snapshots every 5 seconds (100 ticks).
//
// Delta encoding:
//   - If player position/hp/level/weapons changed → include in delta
//   - If player is new → include with "new" flag
//   - If player disconnected → include with "removed" flag
//   - Unchanged players are omitted from the delta packet
//
// Client-side (online-sync.ts) applies delta merge:
//   - New players: add to local state
//   - Updated players: merge changed fields
//   - Removed players: delete from local state
//   - Full snapshot: replace entire state
// ============================================================

// DeltaPlayerState is the delta-compressed per-player state.
// Only changed fields are non-zero. The client merges deltas
// onto its last known state.
type DeltaPlayerState struct {
	ClientID string  `json:"id"`
	X        float64 `json:"x,omitempty"`
	Y        float64 `json:"y,omitempty"`
	Angle    float64 `json:"a,omitempty"`
	HP       int     `json:"hp,omitempty"`
	MaxHP    int     `json:"mhp,omitempty"`
	Level    int     `json:"lv,omitempty"`
	Kills    int     `json:"k,omitempty"`
	Alive    bool    `json:"al,omitempty"`

	// Flags
	IsNew     bool `json:"new,omitempty"`
	IsRemoved bool `json:"rm,omitempty"`
	HasChange bool `json:"-"` // internal; not serialized
}

// DeltaWorldState is the delta-compressed world state packet.
// Sent at 20Hz instead of the full MatrixWorldState when possible.
type DeltaWorldState struct {
	Tick           uint64                `json:"tick"`
	Phase          EpochPhase            `json:"phase"`
	Timer          int                   `json:"timer"`
	Players        []DeltaPlayerState    `json:"players,omitempty"`
	NationScores   map[string]int        `json:"ns,omitempty"`
	SafeZoneRadius float64              `json:"szr,omitempty"`
	FullSnapshot   bool                  `json:"full,omitempty"`
}

// DeltaCompressor tracks previous player states per arena
// and computes delta packets for bandwidth optimization.
type DeltaCompressor struct {
	mu sync.Mutex

	// Previous snapshot per arena: countryCode → playerID → state
	prevStates map[string]map[string]MatrixPlayerState

	// Previous nation scores per arena
	prevNationScores map[string]map[string]int

	// Previous safe zone radius per arena
	prevRadius map[string]float64
}

// NewDeltaCompressor creates a new delta compressor.
func NewDeltaCompressor() *DeltaCompressor {
	return &DeltaCompressor{
		prevStates:       make(map[string]map[string]MatrixPlayerState),
		prevNationScores: make(map[string]map[string]int),
		prevRadius:       make(map[string]float64),
	}
}

// CompressDelta computes a delta between the current world state
// and the previous state for the given arena.
// Returns the delta state. If fullSnapshot is true, all players are included.
func (dc *DeltaCompressor) CompressDelta(
	countryCode string,
	state *MatrixWorldState,
) *DeltaWorldState {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	delta := &DeltaWorldState{
		Tick:         state.Tick,
		Phase:        state.Phase,
		Timer:        state.Timer,
		FullSnapshot: state.FullSnapshot,
	}

	prevPlayers := dc.prevStates[countryCode]
	if prevPlayers == nil {
		prevPlayers = make(map[string]MatrixPlayerState)
	}

	// Build current player map
	currentPlayers := make(map[string]MatrixPlayerState, len(state.Players))
	for _, p := range state.Players {
		currentPlayers[p.ClientID] = p
	}

	if state.FullSnapshot {
		// Full snapshot: send all players
		delta.Players = make([]DeltaPlayerState, 0, len(state.Players))
		for _, p := range state.Players {
			delta.Players = append(delta.Players, DeltaPlayerState{
				ClientID: p.ClientID,
				X:        p.X,
				Y:        p.Y,
				Angle:    p.Angle,
				HP:       p.HP,
				MaxHP:    p.MaxHP,
				Level:    p.Level,
				Kills:    p.Kills,
				Alive:    p.Alive,
				IsNew:    false,
			})
		}
		delta.NationScores = state.NationScores
		delta.SafeZoneRadius = state.SafeZoneRadius
	} else {
		// Delta: only changed players
		deltaPlayers := make([]DeltaPlayerState, 0, len(state.Players)/2)

		for _, current := range state.Players {
			prev, existed := prevPlayers[current.ClientID]

			if !existed {
				// New player
				deltaPlayers = append(deltaPlayers, DeltaPlayerState{
					ClientID: current.ClientID,
					X:        current.X,
					Y:        current.Y,
					Angle:    current.Angle,
					HP:       current.HP,
					MaxHP:    current.MaxHP,
					Level:    current.Level,
					Kills:    current.Kills,
					Alive:    current.Alive,
					IsNew:    true,
					HasChange: true,
				})
				continue
			}

			// Check for changes
			dp := DeltaPlayerState{ClientID: current.ClientID}
			changed := false

			// Position always included if moved (most common change)
			if current.X != prev.X || current.Y != prev.Y {
				dp.X = current.X
				dp.Y = current.Y
				changed = true
			}
			if current.Angle != prev.Angle {
				dp.Angle = current.Angle
				changed = true
			}
			if current.HP != prev.HP {
				dp.HP = current.HP
				changed = true
			}
			if current.MaxHP != prev.MaxHP {
				dp.MaxHP = current.MaxHP
				changed = true
			}
			if current.Level != prev.Level {
				dp.Level = current.Level
				changed = true
			}
			if current.Kills != prev.Kills {
				dp.Kills = current.Kills
				changed = true
			}
			if current.Alive != prev.Alive {
				dp.Alive = current.Alive
				changed = true
			}

			if changed {
				dp.HasChange = true
				deltaPlayers = append(deltaPlayers, dp)
			}
		}

		// Detect removed players
		for prevID := range prevPlayers {
			if _, stillHere := currentPlayers[prevID]; !stillHere {
				deltaPlayers = append(deltaPlayers, DeltaPlayerState{
					ClientID:  prevID,
					IsRemoved: true,
					HasChange: true,
				})
			}
		}

		delta.Players = deltaPlayers

		// Delta nation scores: only include if changed
		prevNS := dc.prevNationScores[countryCode]
		if dc.nationScoresChanged(state.NationScores, prevNS) {
			delta.NationScores = state.NationScores
		}

		// Delta safe zone: only if changed
		prevR := dc.prevRadius[countryCode]
		if state.SafeZoneRadius != prevR {
			delta.SafeZoneRadius = state.SafeZoneRadius
		}
	}

	// Update previous state
	dc.prevStates[countryCode] = currentPlayers
	dc.prevNationScores[countryCode] = copyIntMap(state.NationScores)
	dc.prevRadius[countryCode] = state.SafeZoneRadius

	return delta
}

// nationScoresChanged checks if nation scores have changed from previous.
func (dc *DeltaCompressor) nationScoresChanged(current, prev map[string]int) bool {
	if len(current) != len(prev) {
		return true
	}
	for k, v := range current {
		if prev[k] != v {
			return true
		}
	}
	return false
}

// ClearArena removes cached state for an arena (on full reset).
func (dc *DeltaCompressor) ClearArena(countryCode string) {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	delete(dc.prevStates, countryCode)
	delete(dc.prevNationScores, countryCode)
	delete(dc.prevRadius, countryCode)
}

// Reset clears all cached states.
func (dc *DeltaCompressor) Reset() {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	dc.prevStates = make(map[string]map[string]MatrixPlayerState)
	dc.prevNationScores = make(map[string]map[string]int)
	dc.prevRadius = make(map[string]float64)
}

// GetCompressionStats returns compression statistics for monitoring.
func (dc *DeltaCompressor) GetCompressionStats() (arenas int, cachedPlayers int) {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	arenas = len(dc.prevStates)
	for _, players := range dc.prevStates {
		cachedPlayers += len(players)
	}
	return
}

// copyIntMap creates a shallow copy of a map[string]int.
func copyIntMap(m map[string]int) map[string]int {
	if m == nil {
		return nil
	}
	result := make(map[string]int, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}
