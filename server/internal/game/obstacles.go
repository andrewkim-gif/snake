package game

import (
	"math"
	"math/rand"
)

// ============================================================
// Obstacle Grid — v16 Phase 5
// 2D grid of collidable/passable obstacle types
// ============================================================

// ObstacleType represents the kind of obstacle in a grid cell.
type ObstacleType uint8

const (
	ObstEmpty   ObstacleType = 0
	ObstRock    ObstacleType = 1 // impassable, indestructible
	ObstTree    ObstacleType = 2 // impassable, destructible by dash
	ObstWall    ObstacleType = 3 // impassable, indestructible
	ObstWater   ObstacleType = 4 // passable (slow), depth-based effects
	ObstShrine  ObstacleType = 5 // passable, XP Shrine (existing MapObject)
	ObstSpring  ObstacleType = 6 // passable, Healing Spring (existing MapObject)
	ObstAltar   ObstacleType = 7 // passable, Upgrade Altar (existing MapObject)
)

// ObstacleGrid stores a 2D grid of obstacle types for collision queries.
type ObstacleGrid struct {
	Cells      []uint8 // row-major: cells[y * Width + x]
	Width      int
	Height     int
	CellSize   float64 // world units per cell (same as heightmap)
	OriginX    float64 // world X of cell [0][0]
	OriginY    float64 // world Y of cell [0][0]
	Compressed []byte  // gzip for client transfer
}

// ObstacleCellSize matches heightmap resolution for aligned grids.
const ObstacleCellSize = HeightmapCellSize

// GenerateObstacleGrid creates an obstacle grid based on biome layout.
// Integrates existing MapStructures (shrine, spring, altar) as passable markers.
func GenerateObstacleGrid(seed int64, radius float64, biomeMap *BiomeMap, heightmap *Heightmap) *ObstacleGrid {
	gridW := heightmap.Width
	gridH := heightmap.Height

	grid := &ObstacleGrid{
		Cells:    make([]uint8, gridW*gridH),
		Width:    gridW,
		Height:   gridH,
		CellSize: ObstacleCellSize,
		OriginX:  -radius,
		OriginY:  -radius,
	}

	rng := rand.New(rand.NewSource(seed + 13337))

	// Water level threshold: cells below this height become water
	const waterLevel = 3.0

	for gy := 0; gy < gridH; gy++ {
		for gx := 0; gx < gridW; gx++ {
			// World position of cell center
			wx := -radius + (float64(gx)+0.5)*ObstacleCellSize
			wy := -radius + (float64(gy)+0.5)*ObstacleCellSize

			// Skip cells outside arena circle (+ small margin)
			dist := math.Sqrt(wx*wx + wy*wy)
			if dist > radius*0.95 {
				continue // edge cells are empty
			}

			// Get height at this cell
			h := float64(heightmap.Data[gy*gridW+gx])

			// Water: low-lying areas
			if h < waterLevel {
				grid.Cells[gy*gridW+gx] = uint8(ObstWater)
				continue
			}

			// Get biome type
			biome := BiomePlains
			if biomeMap != nil {
				biome = biomeMap.GetBiome(wx, wy)
			}

			// Skip center area (50px radius) — keep spawn area clear
			if dist < 100 {
				continue
			}

			// Biome-based obstacle placement probabilities
			obstacle := placeObstacleForBiome(biome, h, rng)
			if obstacle != ObstEmpty {
				grid.Cells[gy*gridW+gx] = uint8(obstacle)
			}
		}
	}

	grid.Compressed = compressBytesGzip(grid.Cells)
	return grid
}

// placeObstacleForBiome returns an obstacle type based on biome + height + RNG.
func placeObstacleForBiome(biome BiomeType, height float64, rng *rand.Rand) ObstacleType {
	roll := rng.Float64()

	switch biome {
	case BiomePlains:
		// Sparse trees and rocks
		if roll < 0.02 {
			return ObstTree
		}
		if roll < 0.03 {
			return ObstRock
		}

	case BiomeForest:
		// Dense trees, some rocks
		if roll < 0.10 {
			return ObstTree
		}
		if roll < 0.13 {
			return ObstRock
		}

	case BiomeDesert:
		// Rocks (boulders), rare walls (ruins)
		if roll < 0.04 {
			return ObstRock
		}
		if roll < 0.05 {
			return ObstWall
		}

	case BiomeSnow:
		// Ice rocks, sparse trees
		if roll < 0.04 {
			return ObstRock
		}
		if roll < 0.06 {
			return ObstTree
		}

	case BiomeSwamp:
		// Water patches and trees
		if roll < 0.08 {
			return ObstTree
		}
		// Extra water in swamp
		if roll < 0.15 {
			return ObstWater
		}

	case BiomeVolcanic:
		// Many rocks, some walls (lava formations)
		if roll < 0.08 {
			return ObstRock
		}
		if roll < 0.11 {
			return ObstWall
		}
	}

	return ObstEmpty
}

// Query returns the obstacle type at world position (x, y).
func (og *ObstacleGrid) Query(x, y float64) ObstacleType {
	gx := int((x - og.OriginX) / og.CellSize)
	gy := int((y - og.OriginY) / og.CellSize)

	if gx < 0 || gx >= og.Width || gy < 0 || gy >= og.Height {
		return ObstEmpty // out of bounds = empty
	}

	return ObstacleType(og.Cells[gy*og.Width+gx])
}

// IsBlocking returns true if the obstacle type blocks movement.
func IsBlocking(ot ObstacleType) bool {
	switch ot {
	case ObstRock, ObstTree, ObstWall:
		return true
	default:
		return false
	}
}

// IsWater returns true if the cell is a water obstacle.
func IsWater(ot ObstacleType) bool {
	return ot == ObstWater
}

// IsDestructible returns true if the obstacle can be destroyed by dash.
func IsDestructible(ot ObstacleType) bool {
	return ot == ObstTree
}

// DestroyObstacle removes a destructible obstacle at the given world position.
// Returns true if an obstacle was destroyed.
func (og *ObstacleGrid) DestroyObstacle(x, y float64) bool {
	gx := int((x - og.OriginX) / og.CellSize)
	gy := int((y - og.OriginY) / og.CellSize)

	if gx < 0 || gx >= og.Width || gy < 0 || gy >= og.Height {
		return false
	}

	idx := gy*og.Width + gx
	ot := ObstacleType(og.Cells[idx])
	if IsDestructible(ot) {
		og.Cells[idx] = uint8(ObstEmpty)
		return true
	}
	return false
}
