package game

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"math"
	"math/rand"
)

// ============================================================
// Heightmap — Perlin Noise 기반 지형 생성 (v16 Phase 4)
// ============================================================

// HeightmapCellSize is the world units per heightmap cell.
const HeightmapCellSize = 50.0

// HeightmapMaxHeight is the maximum terrain height in game units.
const HeightmapMaxHeight = 30.0

// Gravity is the gravitational acceleration for jump/fall physics (game units/tick²).
const Gravity = 0.04

// JumpVelocity is the initial upward velocity when jumping (game units/tick).
const JumpVelocity = 0.8

// JumpCooldownTicks is the minimum ticks between jumps (20 ticks = 1 second at 20Hz).
const JumpCooldownTicks = 20

// HighGroundDPSBonus is the DPS multiplier bonus for attacking from higher ground (+10%).
const HighGroundDPSBonus = 0.10

// HighGroundMinDelta is the minimum height difference to qualify for high ground bonus.
const HighGroundMinDelta = 3.0

// ClimbMaxDelta is the max height difference an agent can climb per move.
const ClimbMaxDelta = 10.0

// SlopeThreshold is the slope above which speed is reduced.
const SlopeThreshold = 0.3

// Heightmap stores a 2D grid of height values with gzip-compressed data for client transfer.
type Heightmap struct {
	Data       []float32 // row-major grid [y * Width + x]
	Width      int       // grid cells X
	Height     int       // grid cells Y (== Width for square)
	CellSize   float64   // world units per cell (50)
	MaxHeight  float64   // max height used during generation
	OriginX    float64   // world X of grid[0][0] (top-left corner)
	OriginY    float64   // world Y of grid[0][0]
	Compressed []byte    // gzip(float32 array) → base64 for client
}

// GenerateHeightmap creates a heightmap for a given arena using Perlin Noise.
// The grid covers the full arena bounding box: [-radius, radius] x [-radius, radius].
// 3-layer octave: base terrain + hills + micro detail.
// Center is smooth/low, edges are higher (natural boundary).
// If biomeMap is non-nil, applies per-biome height modifiers.
func GenerateHeightmap(seed int64, radius float64, biomeMap ...*BiomeMap) *Heightmap {
	gridSize := int(math.Ceil(radius*2 / HeightmapCellSize))
	if gridSize < 4 {
		gridSize = 4
	}

	hm := &Heightmap{
		Data:      make([]float32, gridSize*gridSize),
		Width:     gridSize,
		Height:    gridSize,
		CellSize:  HeightmapCellSize,
		MaxHeight: HeightmapMaxHeight,
		OriginX:   -radius,
		OriginY:   -radius,
	}

	pn := newPerlinNoise(seed)

	for gy := 0; gy < gridSize; gy++ {
		for gx := 0; gx < gridSize; gx++ {
			// World coordinates of this cell center
			wx := -radius + (float64(gx)+0.5)*HeightmapCellSize
			wy := -radius + (float64(gy)+0.5)*HeightmapCellSize

			// 3-layer octave noise
			// Layer 1: base terrain (large features)
			n1 := pn.noise2D(wx*0.005, wy*0.005) * 15.0
			// Layer 2: hills (medium features)
			n2 := pn.noise2D(wx*0.02, wy*0.02) * 6.0
			// Layer 3: micro detail
			n3 := pn.noise2D(wx*0.08, wy*0.08) * 1.5

			height := n1 + n2 + n3

			// Edge elevation: distance from center → edges are higher
			dist := math.Sqrt(wx*wx + wy*wy)
			normalizedDist := dist / radius
			if normalizedDist > 1.0 {
				normalizedDist = 1.0
			}

			// Center is lowered, edges raised
			// smoothstep-like falloff: center flat, edge steep
			edgeFactor := normalizedDist * normalizedDist * (3.0 - 2.0*normalizedDist) // smoothstep(0,1,nd)
			edgeElevation := edgeFactor * HeightmapMaxHeight * 0.8

			// Center depression: push center down
			centerDepression := (1.0 - edgeFactor) * 3.0

			height = height + edgeElevation - centerDepression

			// v16 Phase 5: Apply biome height modifier if biome map provided
			if len(biomeMap) > 0 && biomeMap[0] != nil {
				biome := biomeMap[0].GetBiome(wx, wy)
				height = BiomeHeightModifier(biome, height)
			}

			// Clamp to reasonable range
			if height < 0 {
				height = 0
			}
			if height > HeightmapMaxHeight {
				height = HeightmapMaxHeight
			}

			hm.Data[gy*gridSize+gx] = float32(height)
		}
	}

	// Generate gzip-compressed binary data for client transfer
	hm.Compressed = hm.compressData()

	return hm
}

// GetHeight returns the interpolated height at world position (x, y) using bilinear interpolation.
func (h *Heightmap) GetHeight(x, y float64) float64 {
	// Convert world coordinates to grid coordinates (floating point)
	gx := (x - h.OriginX) / h.CellSize
	gy := (y - h.OriginY) / h.CellSize

	// Grid cell indices
	ix := int(math.Floor(gx))
	iy := int(math.Floor(gy))

	// Fractional part for interpolation
	fx := gx - float64(ix)
	fy := gy - float64(iy)

	// Clamp indices to grid bounds
	ix0 := clampInt(ix, 0, h.Width-1)
	iy0 := clampInt(iy, 0, h.Height-1)
	ix1 := clampInt(ix+1, 0, h.Width-1)
	iy1 := clampInt(iy+1, 0, h.Height-1)

	// Get four corner heights
	h00 := float64(h.Data[iy0*h.Width+ix0])
	h10 := float64(h.Data[iy0*h.Width+ix1])
	h01 := float64(h.Data[iy1*h.Width+ix0])
	h11 := float64(h.Data[iy1*h.Width+ix1])

	// Bilinear interpolation
	top := h00*(1-fx) + h10*fx
	bot := h01*(1-fx) + h11*fx
	return top*(1-fy) + bot*fy
}

// GetSlope returns the terrain slope magnitude at position (x, y).
// Returns a value roughly in [0, 1+] where 0 = flat, >0.3 = steep.
func (h *Heightmap) GetSlope(x, y float64) float64 {
	delta := h.CellSize * 0.5
	hL := h.GetHeight(x-delta, y)
	hR := h.GetHeight(x+delta, y)
	hU := h.GetHeight(x, y-delta)
	hD := h.GetHeight(x, y+delta)

	dx := (hR - hL) / (2 * delta)
	dy := (hD - hU) / (2 * delta)

	return math.Sqrt(dx*dx + dy*dy)
}

// compressData converts float32 grid to gzip-compressed binary.
func (h *Heightmap) compressData() []byte {
	// Write float32 array as little-endian binary
	var buf bytes.Buffer
	for _, val := range h.Data {
		if err := binary.Write(&buf, binary.LittleEndian, val); err != nil {
			return nil
		}
	}

	// gzip compress
	var gzBuf bytes.Buffer
	gzWriter := gzip.NewWriter(&gzBuf)
	if _, err := gzWriter.Write(buf.Bytes()); err != nil {
		return nil
	}
	if err := gzWriter.Close(); err != nil {
		return nil
	}

	return gzBuf.Bytes()
}

// compressBytesGzip compresses a byte slice with gzip.
func compressBytesGzip(data []byte) []byte {
	var gzBuf bytes.Buffer
	gzWriter := gzip.NewWriter(&gzBuf)
	if _, err := gzWriter.Write(data); err != nil {
		return nil
	}
	if err := gzWriter.Close(); err != nil {
		return nil
	}
	return gzBuf.Bytes()
}

// clampInt clamps an integer to [min, max].
func clampInt(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

// ============================================================
// Perlin Noise — Pure Go implementation (standard library only)
// ============================================================

// perlinNoise is a simple 2D Perlin noise generator.
type perlinNoise struct {
	perm [512]int
}

// newPerlinNoise creates a Perlin noise generator with the given seed.
func newPerlinNoise(seed int64) *perlinNoise {
	pn := &perlinNoise{}
	rng := rand.New(rand.NewSource(seed))

	// Initialize permutation table
	p := make([]int, 256)
	for i := range p {
		p[i] = i
	}
	// Fisher-Yates shuffle
	for i := 255; i > 0; i-- {
		j := rng.Intn(i + 1)
		p[i], p[j] = p[j], p[i]
	}
	// Double the permutation table
	for i := 0; i < 256; i++ {
		pn.perm[i] = p[i]
		pn.perm[256+i] = p[i]
	}

	return pn
}

// noise2D returns Perlin noise value in approximately [-1, 1] for given (x, y).
func (pn *perlinNoise) noise2D(x, y float64) float64 {
	// Find unit grid cell containing point
	xi := int(math.Floor(x)) & 255
	yi := int(math.Floor(y)) & 255

	// Relative position in cell
	xf := x - math.Floor(x)
	yf := y - math.Floor(y)

	// Fade curves for smoother interpolation
	u := fade(xf)
	v := fade(yf)

	// Hash coordinates of the 4 corners
	aa := pn.perm[pn.perm[xi]+yi]
	ab := pn.perm[pn.perm[xi]+yi+1]
	ba := pn.perm[pn.perm[xi+1]+yi]
	bb := pn.perm[pn.perm[xi+1]+yi+1]

	// Gradient dot products at corners
	gaa := grad2D(aa, xf, yf)
	gba := grad2D(ba, xf-1, yf)
	gab := grad2D(ab, xf, yf-1)
	gbb := grad2D(bb, xf-1, yf-1)

	// Bilinear interpolation
	x1 := lerp(gaa, gba, u)
	x2 := lerp(gab, gbb, u)
	return lerp(x1, x2, v)
}

// fade is the improved Perlin fade function: 6t^5 - 15t^4 + 10t^3.
func fade(t float64) float64 {
	return t * t * t * (t*(t*6-15) + 10)
}

// lerp performs linear interpolation.
func lerp(a, b, t float64) float64 {
	return a + t*(b-a)
}

// grad2D returns the dot product of a pseudo-random gradient vector with (x, y).
func grad2D(hash int, x, y float64) float64 {
	switch hash & 3 {
	case 0:
		return x + y
	case 1:
		return -x + y
	case 2:
		return x - y
	case 3:
		return -x - y
	default:
		return 0
	}
}
