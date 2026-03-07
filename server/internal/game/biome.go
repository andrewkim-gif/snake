package game

import (
	"math"
	"math/rand"
)

// ============================================================
// Biome System — v16 Phase 5
// Voronoi 기반 바이옴 분할 (6종)
// ============================================================

// BiomeType identifies a biome kind.
type BiomeType uint8

const (
	BiomePlains   BiomeType = 0
	BiomeForest   BiomeType = 1
	BiomeDesert   BiomeType = 2
	BiomeSnow     BiomeType = 3
	BiomeSwamp    BiomeType = 4
	BiomeVolcanic BiomeType = 5
)

// BiomeCount is the total number of biome types.
const BiomeCount = 6

// BiomeName returns a human-readable name for the biome.
func BiomeName(b BiomeType) string {
	switch b {
	case BiomePlains:
		return "plains"
	case BiomeForest:
		return "forest"
	case BiomeDesert:
		return "desert"
	case BiomeSnow:
		return "snow"
	case BiomeSwamp:
		return "swamp"
	case BiomeVolcanic:
		return "volcanic"
	default:
		return "plains"
	}
}

// BiomeModifiers holds per-biome gameplay modifiers.
type BiomeModifiers struct {
	SpeedMult  float64 // movement speed multiplier
	VisionMult float64 // fog/vision multiplier (lower = less vision)
}

// GetBiomeModifiers returns gameplay modifiers for a biome type.
func GetBiomeModifiers(b BiomeType) BiomeModifiers {
	switch b {
	case BiomePlains:
		return BiomeModifiers{SpeedMult: 1.0, VisionMult: 1.0}
	case BiomeForest:
		return BiomeModifiers{SpeedMult: 1.0, VisionMult: 0.7}
	case BiomeDesert:
		return BiomeModifiers{SpeedMult: 0.85, VisionMult: 1.0}
	case BiomeSnow:
		return BiomeModifiers{SpeedMult: 0.9, VisionMult: 1.0}
	case BiomeSwamp:
		return BiomeModifiers{SpeedMult: 0.7, VisionMult: 0.6}
	case BiomeVolcanic:
		return BiomeModifiers{SpeedMult: 0.8, VisionMult: 0.5}
	default:
		return BiomeModifiers{SpeedMult: 1.0, VisionMult: 1.0}
	}
}

// BiomeHeightModifier returns a heightmap modifier for a biome.
// Applied to the raw height during heightmap generation.
func BiomeHeightModifier(b BiomeType, baseHeight float64) float64 {
	switch b {
	case BiomePlains:
		// Mostly flat with gentle rolls
		return baseHeight * 0.5
	case BiomeForest:
		// Rolling hills
		return baseHeight * 1.2
	case BiomeDesert:
		// Flat with occasional dunes
		return baseHeight * 0.4
	case BiomeSnow:
		// High plateaus, relatively flat top
		return baseHeight*0.6 + HeightmapMaxHeight*0.3
	case BiomeSwamp:
		// Very low, near water level
		return baseHeight * 0.2
	case BiomeVolcanic:
		// Sharp peaks
		return baseHeight * 1.8
	default:
		return baseHeight
	}
}

// BiomeSeed is a Voronoi seed point for biome generation.
type BiomeSeed struct {
	X     float64
	Y     float64
	Biome BiomeType
}

// BiomeMap stores the Voronoi-based biome layout for an arena.
type BiomeMap struct {
	Seeds    []BiomeSeed
	Radius   float64
	CellSize float64
	Width    int
	Height   int
	// Grid stores the biome index for each cell (same resolution as heightmap)
	Grid       []uint8
	Compressed []byte // gzip for client transfer
}

// GenerateBiomeMap creates a Voronoi-based biome map for the arena.
// Uses 4-6 seed points, each assigned a random biome type.
func GenerateBiomeMap(seed int64, radius float64, cellSize float64, gridWidth, gridHeight int) *BiomeMap {
	rng := rand.New(rand.NewSource(seed + 7919)) // offset seed to differ from heightmap

	// 4-6 seed points distributed across the arena
	numSeeds := 4 + rng.Intn(3) // 4, 5, or 6
	seeds := make([]BiomeSeed, numSeeds)

	// All biome types available
	biomeTypes := []BiomeType{BiomePlains, BiomeForest, BiomeDesert, BiomeSnow, BiomeSwamp, BiomeVolcanic}

	for i := 0; i < numSeeds; i++ {
		// Place seeds within 80% of arena radius
		angle := rng.Float64() * 2 * math.Pi
		dist := radius * 0.3 * (0.3 + rng.Float64()*0.7) // 9%~30% radius from center => spread
		if i == 0 {
			// First seed near center
			dist = radius * 0.1 * rng.Float64()
		}
		seeds[i] = BiomeSeed{
			X:     math.Cos(angle) * dist,
			Y:     math.Sin(angle) * dist,
			Biome: biomeTypes[i%len(biomeTypes)],
		}
	}

	// Generate grid: for each cell, find nearest seed (Voronoi)
	grid := make([]uint8, gridWidth*gridHeight)

	for gy := 0; gy < gridHeight; gy++ {
		for gx := 0; gx < gridWidth; gx++ {
			// World coordinates of cell center
			wx := -radius + (float64(gx)+0.5)*cellSize
			wy := -radius + (float64(gy)+0.5)*cellSize

			// Find nearest seed
			minDist := math.MaxFloat64
			nearestBiome := BiomePlains

			for _, s := range seeds {
				dx := wx - s.X
				dy := wy - s.Y
				dist := dx*dx + dy*dy // squared is fine for comparison
				if dist < minDist {
					minDist = dist
					nearestBiome = s.Biome
				}
			}

			grid[gy*gridWidth+gx] = uint8(nearestBiome)
		}
	}

	bm := &BiomeMap{
		Seeds:    seeds,
		Radius:   radius,
		CellSize: cellSize,
		Width:    gridWidth,
		Height:   gridHeight,
		Grid:     grid,
	}

	// Compress for client transfer
	bm.Compressed = compressUint8Grid(grid)

	return bm
}

// GetBiome returns the biome type at world position (x, y).
func (bm *BiomeMap) GetBiome(x, y float64) BiomeType {
	gx := int((x + bm.Radius) / bm.CellSize)
	gy := int((y + bm.Radius) / bm.CellSize)

	if gx < 0 {
		gx = 0
	}
	if gx >= bm.Width {
		gx = bm.Width - 1
	}
	if gy < 0 {
		gy = 0
	}
	if gy >= bm.Height {
		gy = bm.Height - 1
	}

	return BiomeType(bm.Grid[gy*bm.Width+gx])
}

// GetBiomeIndex returns the biome index (0-5) at world position.
func (bm *BiomeMap) GetBiomeIndex(x, y float64) uint8 {
	return uint8(bm.GetBiome(x, y))
}

// compressUint8Grid compresses a uint8 slice with gzip.
func compressUint8Grid(data []uint8) []byte {
	return compressBytesGzip(data)
}
