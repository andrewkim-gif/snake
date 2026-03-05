package game

import (
	"github.com/to-nexus/snake-server/internal/domain"
)

// AgentEntry represents an agent's position in the spatial hash.
type AgentEntry struct {
	AgentID string
	X, Y    float64
}

// OrbEntry represents an orb's position in the spatial hash.
type OrbEntry struct {
	OrbID uint64
	X, Y  float64
	Value float64
	Color int
	Type  domain.OrbType
}

// SpatialHash provides O(1) spatial queries using a grid-based hash.
type SpatialHash struct {
	cellSize   float64
	halfSize   float64 // arena radius (offset)
	gridDim    int
	agentCells map[int][]AgentEntry
	orbCells   map[int][]OrbEntry

	// Track active keys for efficient Clear()
	activeAgentKeys []int
	activeOrbKeys   []int
}

// NewSpatialHash creates a new spatial hash grid.
func NewSpatialHash(arenaRadius float64, cellSize float64) *SpatialHash {
	if cellSize <= 0 {
		cellSize = 200
	}
	gridDim := int((arenaRadius * 2) / cellSize)
	if gridDim < 1 {
		gridDim = 1
	}
	return &SpatialHash{
		cellSize:        cellSize,
		halfSize:        arenaRadius,
		gridDim:         gridDim,
		agentCells:      make(map[int][]AgentEntry, 256),
		orbCells:        make(map[int][]OrbEntry, 1024),
		activeAgentKeys: make([]int, 0, 128),
		activeOrbKeys:   make([]int, 0, 512),
	}
}

// getKey computes a cell key from world coordinates.
func (h *SpatialHash) getKey(x, y float64) int {
	cx := int((x + h.halfSize) / h.cellSize)
	cy := int((y + h.halfSize) / h.cellSize)
	return cy*h.gridDim + cx
}

// Clear resets all cells for the next tick rebuild.
func (h *SpatialHash) Clear() {
	for _, key := range h.activeAgentKeys {
		if cell, ok := h.agentCells[key]; ok {
			h.agentCells[key] = cell[:0]
		}
	}
	h.activeAgentKeys = h.activeAgentKeys[:0]

	for _, key := range h.activeOrbKeys {
		if cell, ok := h.orbCells[key]; ok {
			h.orbCells[key] = cell[:0]
		}
	}
	h.activeOrbKeys = h.activeOrbKeys[:0]
}

// InsertAgent adds an agent to the spatial hash.
func (h *SpatialHash) InsertAgent(id string, pos domain.Position) {
	key := h.getKey(pos.X, pos.Y)
	cell := h.agentCells[key]
	if len(cell) == 0 {
		h.activeAgentKeys = append(h.activeAgentKeys, key)
	}
	h.agentCells[key] = append(cell, AgentEntry{AgentID: id, X: pos.X, Y: pos.Y})
}

// InsertOrb adds an orb to the spatial hash.
func (h *SpatialHash) InsertOrb(orb *domain.Orb) {
	key := h.getKey(orb.Position.X, orb.Position.Y)
	cell := h.orbCells[key]
	if len(cell) == 0 {
		h.activeOrbKeys = append(h.activeOrbKeys, key)
	}
	h.orbCells[key] = append(cell, OrbEntry{
		OrbID: orb.ID,
		X:     orb.Position.X,
		Y:     orb.Position.Y,
		Value: orb.Value,
		Color: orb.Color,
		Type:  orb.Type,
	})
}

// QueryAgents returns all agent entries within the given radius of center.
func (h *SpatialHash) QueryAgents(center domain.Position, radius float64) []AgentEntry {
	cellRadius := int(radius/h.cellSize) + 1
	cx := int((center.X + h.halfSize) / h.cellSize)
	cy := int((center.Y + h.halfSize) / h.cellSize)

	var result []AgentEntry
	for dy := -cellRadius; dy <= cellRadius; dy++ {
		for dx := -cellRadius; dx <= cellRadius; dx++ {
			key := (cy+dy)*h.gridDim + (cx + dx)
			if cell, ok := h.agentCells[key]; ok {
				result = append(result, cell...)
			}
		}
	}
	return result
}

// QueryOrbs returns all orb entries within the given radius of center.
func (h *SpatialHash) QueryOrbs(center domain.Position, radius float64) []OrbEntry {
	cellRadius := int(radius/h.cellSize) + 1
	cx := int((center.X + h.halfSize) / h.cellSize)
	cy := int((center.Y + h.halfSize) / h.cellSize)

	var result []OrbEntry
	for dy := -cellRadius; dy <= cellRadius; dy++ {
		for dx := -cellRadius; dx <= cellRadius; dx++ {
			key := (cy+dy)*h.gridDim + (cx + dx)
			if cell, ok := h.orbCells[key]; ok {
				result = append(result, cell...)
			}
		}
	}
	return result
}
