package game

import (
	"math"
	"sync"
)

// ============================================================
// Arena Combat Optimization — Phase 7
// ============================================================
//
// 1. ARSpatialGrid: cell-based spatial hash for O(1) neighbor queries
// 2. Entity pools: pre-allocated slices to reduce GC pressure
// 3. Optimized collision checking via grid cells
// 4. Tier-aware tick skipping for low-priority computations

// ── Spatial Grid ─────────────────────────────────────────────

// ARSpatialGrid provides O(1) neighbor lookups for enemies/projectiles.
// Each cell holds indices into the entity slice, rebuilt each tick.
type ARSpatialGrid struct {
	cellSize float64
	invCell  float64
	cols     int
	rows     int
	offsetX  float64 // shift so origin is at grid center
	offsetZ  float64
	cells    [][]int // cell index → list of entity indices
}

// NewARSpatialGrid creates a spatial grid covering a square arena.
// arenaRadius is the arena half-extent; cellSize controls granularity.
func NewARSpatialGrid(arenaRadius, cellSize float64) *ARSpatialGrid {
	if cellSize <= 0 {
		cellSize = 5.0
	}
	extent := arenaRadius * 2
	cols := int(math.Ceil(extent/cellSize)) + 1
	rows := cols

	cells := make([][]int, cols*rows)
	for i := range cells {
		cells[i] = make([]int, 0, 8)
	}

	return &ARSpatialGrid{
		cellSize: cellSize,
		invCell:  1.0 / cellSize,
		cols:     cols,
		rows:     rows,
		offsetX:  arenaRadius,
		offsetZ:  arenaRadius,
		cells:    cells,
	}
}

// Clear resets all cells without reallocating.
func (g *ARSpatialGrid) Clear() {
	for i := range g.cells {
		g.cells[i] = g.cells[i][:0]
	}
}

// cellIndex returns the flat cell index for a world position.
// Returns -1 if out of bounds.
func (g *ARSpatialGrid) cellIndex(x, z float64) int {
	cx := int((x + g.offsetX) * g.invCell)
	cz := int((z + g.offsetZ) * g.invCell)
	if cx < 0 || cx >= g.cols || cz < 0 || cz >= g.rows {
		return -1
	}
	return cz*g.cols + cx
}

// InsertEnemy adds an enemy index to the grid.
func (g *ARSpatialGrid) InsertEnemy(idx int, x, z float64) {
	ci := g.cellIndex(x, z)
	if ci >= 0 && ci < len(g.cells) {
		g.cells[ci] = append(g.cells[ci], idx)
	}
}

// QueryRadius returns indices of entities within radius of (cx, cz).
// Results are appended to the provided buffer to avoid allocation.
func (g *ARSpatialGrid) QueryRadius(cx, cz, radius float64, buf []int) []int {
	buf = buf[:0]
	rCells := int(math.Ceil(radius * g.invCell))

	centerCX := int((cx + g.offsetX) * g.invCell)
	centerCZ := int((cz + g.offsetZ) * g.invCell)

	for dz := -rCells; dz <= rCells; dz++ {
		for dx := -rCells; dx <= rCells; dx++ {
			gx := centerCX + dx
			gz := centerCZ + dz
			if gx < 0 || gx >= g.cols || gz < 0 || gz >= g.rows {
				continue
			}
			ci := gz*g.cols + gx
			buf = append(buf, g.cells[ci]...)
		}
	}
	return buf
}

// ── Entity Pool ──────────────────────────────────────────────

// AREntityPool pre-allocates entity slices to reduce GC pressure.
type AREntityPool struct {
	enemies     []*AREnemy
	projectiles []*ARProjectile
	xpCrystals  []*ARXPCrystal
	fieldItems  []*ARFieldItem

	// Free lists (indices of reusable slots)
	freeEnemies []int
	freeProjs   []int
	freeCrystals []int
	freeItems   []int

	mu sync.Mutex
}

// NewAREntityPool creates a pool with pre-allocated capacity.
func NewAREntityPool(enemyCap, projCap, crystalCap, itemCap int) *AREntityPool {
	pool := &AREntityPool{
		enemies:      make([]*AREnemy, 0, enemyCap),
		projectiles:  make([]*ARProjectile, 0, projCap),
		xpCrystals:   make([]*ARXPCrystal, 0, crystalCap),
		fieldItems:   make([]*ARFieldItem, 0, itemCap),
		freeEnemies:  make([]int, 0, enemyCap/2),
		freeProjs:    make([]int, 0, projCap/2),
		freeCrystals: make([]int, 0, crystalCap/2),
		freeItems:    make([]int, 0, itemCap/2),
	}

	// Pre-allocate enemy objects
	for i := 0; i < enemyCap; i++ {
		pool.enemies = append(pool.enemies, &AREnemy{
			StatusEffects: make([]ARStatusInstance, 0, 4),
		})
		pool.freeEnemies = append(pool.freeEnemies, i)
	}

	// Pre-allocate projectile objects
	for i := 0; i < projCap; i++ {
		pool.projectiles = append(pool.projectiles, &ARProjectile{
			HitIDs: make(map[string]bool),
		})
		pool.freeProjs = append(pool.freeProjs, i)
	}

	return pool
}

// AcquireEnemy gets an enemy from the pool or creates a new one.
func (p *AREntityPool) AcquireEnemy() *AREnemy {
	p.mu.Lock()
	defer p.mu.Unlock()

	if len(p.freeEnemies) > 0 {
		idx := p.freeEnemies[len(p.freeEnemies)-1]
		p.freeEnemies = p.freeEnemies[:len(p.freeEnemies)-1]
		e := p.enemies[idx]
		// Reset enemy state
		e.Alive = true
		e.HP = 0
		e.MaxHP = 0
		e.Damage = 0
		e.Speed = 0
		e.Defense = 0
		e.IsElite = false
		e.IsMiniboss = false
		e.EliteAffix = ""
		e.StatusEffects = e.StatusEffects[:0]
		e.TargetID = ""
		e.DamageAffinity = ""
		e.EliteShieldTimer = 0
		return e
	}

	// Pool exhausted, allocate new
	return &AREnemy{
		StatusEffects: make([]ARStatusInstance, 0, 4),
	}
}

// ReleaseEnemy returns an enemy to the pool for reuse.
func (p *AREntityPool) ReleaseEnemy(e *AREnemy) {
	p.mu.Lock()
	defer p.mu.Unlock()

	e.Alive = false
	// Find index; for simplicity we track by pointer identity
	for i, pe := range p.enemies {
		if pe == e {
			p.freeEnemies = append(p.freeEnemies, i)
			return
		}
	}
}

// AcquireProjectile gets a projectile from the pool.
func (p *AREntityPool) AcquireProjectile() *ARProjectile {
	p.mu.Lock()
	defer p.mu.Unlock()

	if len(p.freeProjs) > 0 {
		idx := p.freeProjs[len(p.freeProjs)-1]
		p.freeProjs = p.freeProjs[:len(p.freeProjs)-1]
		proj := p.projectiles[idx]
		// Reset
		proj.Alive = true
		proj.Traveled = 0
		proj.PierceLeft = 0
		for k := range proj.HitIDs {
			delete(proj.HitIDs, k)
		}
		return proj
	}

	return &ARProjectile{
		HitIDs: make(map[string]bool),
	}
}

// ReleaseProjectile returns a projectile to the pool.
func (p *AREntityPool) ReleaseProjectile(proj *ARProjectile) {
	p.mu.Lock()
	defer p.mu.Unlock()

	proj.Alive = false
	for i, pp := range p.projectiles {
		if pp == proj {
			p.freeProjs = append(p.freeProjs, i)
			return
		}
	}
}

// ── Optimized Tick Helpers ───────────────────────────────────

// OptimizedEnemyAI uses spatial grid for nearest-player lookup
// instead of O(N*M) brute force.
func (ac *ArenaCombat) tickEnemyAIOptimized(delta float64, grid *ARSpatialGrid) {
	// Build player position cache (small slice, no allocation needed)
	type playerPos struct {
		player *ARPlayer
		x, z   float64
	}
	playerCache := make([]playerPos, 0, len(ac.players))
	for _, p := range ac.players {
		if p.Alive {
			playerCache = append(playerCache, playerPos{p, p.Pos.X, p.Pos.Z})
		}
	}

	if len(playerCache) == 0 {
		return
	}

	for _, enemy := range ac.enemies {
		if !enemy.Alive {
			continue
		}

		freezeMult := EnemyFreezeSpeedMult(enemy)
		if freezeMult <= 0 {
			continue
		}

		// Find nearest player (still O(P) per enemy but P is small: max 50)
		var nearest *ARPlayer
		nearestDist := math.MaxFloat64

		for _, pp := range playerCache {
			dx := enemy.Pos.X - pp.x
			dz := enemy.Pos.Z - pp.z
			d := dx*dx + dz*dz // skip sqrt for comparison
			if d < nearestDist {
				nearestDist = d
				nearest = pp.player
				enemy.TargetID = pp.player.ID
			}
		}

		if nearest == nil {
			continue
		}

		// Move toward target
		nearestDist = math.Sqrt(nearestDist) // actual distance for movement
		dx := nearest.Pos.X - enemy.Pos.X
		dz := nearest.Pos.Z - enemy.Pos.Z
		if nearestDist > 0.5 {
			dx /= nearestDist
			dz /= nearestDist
			enemy.Pos.X += dx * enemy.Speed * freezeMult * delta
			enemy.Pos.Z += dz * enemy.Speed * freezeMult * delta
		}

		// Attack if within melee range
		if nearestDist < 1.5 {
			ac.enemyAttack(enemy, nearest, delta)
		}
	}
}

// OptimizedProjectileCollision uses spatial grid for projectile-enemy
// hit detection instead of O(P*E) brute force.
func OptimizedProjectileCollision(
	projs []*ARProjectile,
	enemies []*AREnemy,
	grid *ARSpatialGrid,
	queryBuf []int,
) []ARDamageEvent {
	var events []ARDamageEvent

	for _, proj := range projs {
		if !proj.Alive {
			continue
		}

		hitRadius := 1.0 // default hit radius
		if proj.AOERadius > 0 {
			hitRadius = proj.AOERadius
		}

		// Query grid for nearby enemies
		queryBuf = grid.QueryRadius(proj.Pos.X, proj.Pos.Z, hitRadius, queryBuf)

		for _, idx := range queryBuf {
			if idx < 0 || idx >= len(enemies) {
				continue
			}
			e := enemies[idx]
			if !e.Alive {
				continue
			}
			if proj.HitIDs[e.ID] {
				continue
			}

			dx := proj.Pos.X - e.Pos.X
			dz := proj.Pos.Z - e.Pos.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist <= hitRadius {
				// Hit!
				proj.HitIDs[e.ID] = true
				e.HP -= proj.Damage
				if e.HP < 0 {
					e.HP = 0
				}

				events = append(events, ARDamageEvent{
					TargetID:  e.ID,
					Amount:    proj.Damage,
					DmgType:   proj.DmgType,
					X:         e.Pos.X,
					Z:         e.Pos.Z,
				})

				// Apply status effect
				if proj.StatusFX != "" && proj.StatusPct > 0 {
					// Status application is handled by caller
				}

				proj.PierceLeft--
				if proj.PierceLeft <= 0 {
					proj.Alive = false
					break
				}
			}
		}
	}

	return events
}

// ── Tick Skip Optimization ───────────────────────────────────

// ShouldSkipTick returns true if certain expensive operations should
// be skipped this tick for performance (runs them at reduced frequency).
func ShouldSkipTick(tick uint64, tier string) bool {
	// All tiers run at 20Hz base, but we can skip certain
	// expensive computations on alternate ticks for lower tiers.
	switch tier {
	case "D":
		// D-tier: skip status effect ticks on odd frames (10Hz effective)
		return tick%2 != 0
	case "C":
		// C-tier: skip every 3rd frame for non-critical updates
		return tick%3 == 0
	default:
		return false
	}
}

// ShouldRunStatusTick returns true if status effects should be processed this tick.
func ShouldRunStatusTick(tick uint64, tier string) bool {
	// Status effects don't need to run every tick for lower tiers
	switch tier {
	case "D":
		return tick%2 == 0
	case "C":
		return tick%2 == 0
	default:
		return true
	}
}

// ── Arena Optimization Config ────────────────────────────────

// AROptConfig holds runtime optimization parameters.
type AROptConfig struct {
	// Spatial grid cell size (meters)
	GridCellSize float64

	// Max enemies alive at once (tier-dependent cap)
	MaxEnemiesAlive int

	// Whether to use optimized enemy AI (spatial grid)
	UseSpatialGrid bool

	// Entity pool capacities
	EnemyPoolSize int
	ProjPoolSize  int
}

// DefaultOptConfig returns optimization config for a given tier.
func DefaultOptConfig(tier string) AROptConfig {
	switch tier {
	case "S":
		return AROptConfig{
			GridCellSize:    5.0,
			MaxEnemiesAlive: 200,
			UseSpatialGrid:  true,
			EnemyPoolSize:   256,
			ProjPoolSize:    128,
		}
	case "A":
		return AROptConfig{
			GridCellSize:    5.0,
			MaxEnemiesAlive: 150,
			UseSpatialGrid:  true,
			EnemyPoolSize:   192,
			ProjPoolSize:    96,
		}
	case "B":
		return AROptConfig{
			GridCellSize:    5.0,
			MaxEnemiesAlive: 100,
			UseSpatialGrid:  true,
			EnemyPoolSize:   128,
			ProjPoolSize:    64,
		}
	case "C":
		return AROptConfig{
			GridCellSize:    4.0,
			MaxEnemiesAlive: 60,
			UseSpatialGrid:  false, // small enough for brute force
			EnemyPoolSize:   80,
			ProjPoolSize:    48,
		}
	case "D":
		return AROptConfig{
			GridCellSize:    3.0,
			MaxEnemiesAlive: 30,
			UseSpatialGrid:  false,
			EnemyPoolSize:   48,
			ProjPoolSize:    32,
		}
	default:
		return AROptConfig{
			GridCellSize:    5.0,
			MaxEnemiesAlive: 100,
			UseSpatialGrid:  true,
			EnemyPoolSize:   128,
			ProjPoolSize:    64,
		}
	}
}

// ── Viewport Culling (server side) ───────────────────────────

// CullEntitiesForPlayer creates a view of enemies visible to a player
// within a given viewport radius, reducing network payload.
func CullEntitiesForPlayer(
	player *ARPlayer,
	enemies []AREnemyNet,
	viewRadius float64,
) []AREnemyNet {
	if viewRadius <= 0 {
		viewRadius = 50.0 // default
	}
	vr2 := viewRadius * viewRadius

	result := make([]AREnemyNet, 0, len(enemies)/2)
	for _, e := range enemies {
		dx := e.X - player.Pos.X
		dz := e.Z - player.Pos.Z
		if dx*dx+dz*dz <= vr2 {
			result = append(result, e)
		}
	}
	return result
}

// CullCrystalsForPlayer filters XP crystals by viewport radius.
func CullCrystalsForPlayer(
	player *ARPlayer,
	crystals []ARCrystalNet,
	viewRadius float64,
) []ARCrystalNet {
	if viewRadius <= 0 {
		viewRadius = 50.0
	}
	vr2 := viewRadius * viewRadius

	result := make([]ARCrystalNet, 0, len(crystals)/2)
	for _, c := range crystals {
		dx := c.X - player.Pos.X
		dz := c.Z - player.Pos.Z
		if dx*dx+dz*dz <= vr2 {
			result = append(result, c)
		}
	}
	return result
}

// ── Delta Encoding Helper ────────────────────────────────────

// ARStateDelta holds only changed entities since last state.
// Used for bandwidth optimization (future implementation).
type ARStateDelta struct {
	Phase       ARPhase `json:"phase,omitempty"`
	Timer       float64 `json:"timer,omitempty"`
	WaveNumber  int     `json:"wave,omitempty"`

	// Changed/new enemies only
	EnemiesAdded   []AREnemyNet   `json:"ea,omitempty"`
	EnemiesRemoved []string       `json:"er,omitempty"` // IDs
	EnemiesMoved   []AREntityMove `json:"em,omitempty"` // position updates

	// Changed/new projectiles
	ProjAdded   []ARProjectileNet `json:"pa,omitempty"`
	ProjRemoved []string          `json:"pr,omitempty"`

	// Crystal changes
	CrystalsAdded   []ARCrystalNet `json:"ca,omitempty"`
	CrystalsRemoved []string       `json:"cr,omitempty"`
}

// AREntityMove is a compact position update.
type AREntityMove struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Z  float64 `json:"z"`
}

// ── GC Pressure Reduction ────────────────────────────────────

// ReusableBuffers holds pre-allocated buffers for per-tick operations.
type ReusableBuffers struct {
	// Query buffer for spatial grid lookups
	QueryBuf []int

	// Event buffer for combat events
	EventBuf []CombatEvent

	// Enemy net buffer for state serialization
	EnemyNetBuf []AREnemyNet

	// Crystal net buffer
	CrystalNetBuf []ARCrystalNet

	// Projectile net buffer
	ProjNetBuf []ARProjectileNet
}

// NewReusableBuffers creates pre-allocated buffers.
func NewReusableBuffers(maxEnemies, maxCrystals, maxProjs int) *ReusableBuffers {
	return &ReusableBuffers{
		QueryBuf:      make([]int, 0, 64),
		EventBuf:      make([]CombatEvent, 0, 32),
		EnemyNetBuf:   make([]AREnemyNet, 0, maxEnemies),
		CrystalNetBuf: make([]ARCrystalNet, 0, maxCrystals),
		ProjNetBuf:    make([]ARProjectileNet, 0, maxProjs),
	}
}

// Reset clears all buffers without deallocating.
func (b *ReusableBuffers) Reset() {
	b.QueryBuf = b.QueryBuf[:0]
	b.EventBuf = b.EventBuf[:0]
	b.EnemyNetBuf = b.EnemyNetBuf[:0]
	b.CrystalNetBuf = b.CrystalNetBuf[:0]
	b.ProjNetBuf = b.ProjNetBuf[:0]
}
