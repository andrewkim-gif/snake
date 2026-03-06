package game

import "math"

// cellKey is a 2D grid coordinate used as a map key.
type cellKey struct {
	X, Y int
}

// spatialEntry stores an entity's position for quick lookup.
type spatialEntry struct {
	X, Y float64
	Cell cellKey
}

// SpatialHash is a grid-based spatial index for fast proximity queries.
// Each cell is SpatialHashCellSize pixels wide.
type SpatialHash struct {
	cellSize float64
	cells    map[cellKey]map[string]struct{} // cell → set of entity IDs
	entries  map[string]*spatialEntry        // entity ID → position+cell
}

// NewSpatialHash creates a new SpatialHash with the configured cell size.
func NewSpatialHash() *SpatialHash {
	return &SpatialHash{
		cellSize: SpatialHashCellSize,
		cells:    make(map[cellKey]map[string]struct{}),
		entries:  make(map[string]*spatialEntry),
	}
}

// toCell converts world coordinates to a grid cell key.
func (sh *SpatialHash) toCell(x, y float64) cellKey {
	return cellKey{
		X: int(math.Floor(x / sh.cellSize)),
		Y: int(math.Floor(y / sh.cellSize)),
	}
}

// Insert adds an entity at the given position.
func (sh *SpatialHash) Insert(id string, x, y float64) {
	cell := sh.toCell(x, y)
	// Ensure cell bucket exists
	if sh.cells[cell] == nil {
		sh.cells[cell] = make(map[string]struct{})
	}
	sh.cells[cell][id] = struct{}{}
	sh.entries[id] = &spatialEntry{X: x, Y: y, Cell: cell}
}

// Remove deletes an entity from the spatial hash.
func (sh *SpatialHash) Remove(id string) {
	entry, ok := sh.entries[id]
	if !ok {
		return
	}
	// Remove from cell
	if bucket := sh.cells[entry.Cell]; bucket != nil {
		delete(bucket, id)
		if len(bucket) == 0 {
			delete(sh.cells, entry.Cell)
		}
	}
	delete(sh.entries, id)
}

// Update moves an entity to a new position, re-bucketing if the cell changed.
func (sh *SpatialHash) Update(id string, x, y float64) {
	entry, ok := sh.entries[id]
	if !ok {
		// Not tracked yet — insert instead
		sh.Insert(id, x, y)
		return
	}

	newCell := sh.toCell(x, y)
	if newCell != entry.Cell {
		// Remove from old cell
		if bucket := sh.cells[entry.Cell]; bucket != nil {
			delete(bucket, id)
			if len(bucket) == 0 {
				delete(sh.cells, entry.Cell)
			}
		}
		// Add to new cell
		if sh.cells[newCell] == nil {
			sh.cells[newCell] = make(map[string]struct{})
		}
		sh.cells[newCell][id] = struct{}{}
		entry.Cell = newCell
	}
	entry.X = x
	entry.Y = y
}

// QueryRadius returns the IDs of all entities within the given radius of (cx, cy).
// Uses the grid to limit candidate checks to nearby cells only.
func (sh *SpatialHash) QueryRadius(cx, cy, radius float64) []string {
	radiusSq := radius * radius

	// Calculate cell range to search
	minCellX := int(math.Floor((cx - radius) / sh.cellSize))
	maxCellX := int(math.Floor((cx + radius) / sh.cellSize))
	minCellY := int(math.Floor((cy - radius) / sh.cellSize))
	maxCellY := int(math.Floor((cy + radius) / sh.cellSize))

	var result []string

	for gx := minCellX; gx <= maxCellX; gx++ {
		for gy := minCellY; gy <= maxCellY; gy++ {
			bucket := sh.cells[cellKey{gx, gy}]
			if bucket == nil {
				continue
			}
			for id := range bucket {
				entry := sh.entries[id]
				if entry == nil {
					continue
				}
				dx := entry.X - cx
				dy := entry.Y - cy
				if dx*dx+dy*dy <= radiusSq {
					result = append(result, id)
				}
			}
		}
	}

	return result
}

// QueryRadiusExclude returns nearby IDs, excluding the given excludeID.
func (sh *SpatialHash) QueryRadiusExclude(cx, cy, radius float64, excludeID string) []string {
	all := sh.QueryRadius(cx, cy, radius)
	result := make([]string, 0, len(all))
	for _, id := range all {
		if id != excludeID {
			result = append(result, id)
		}
	}
	return result
}

// Clear removes all entities from the spatial hash.
func (sh *SpatialHash) Clear() {
	sh.cells = make(map[cellKey]map[string]struct{})
	sh.entries = make(map[string]*spatialEntry)
}

// Count returns the total number of entities tracked.
func (sh *SpatialHash) Count() int {
	return len(sh.entries)
}

// GetPosition returns the stored position for an entity, or (0,0, false) if not found.
func (sh *SpatialHash) GetPosition(id string) (float64, float64, bool) {
	entry, ok := sh.entries[id]
	if !ok {
		return 0, 0, false
	}
	return entry.X, entry.Y, true
}
