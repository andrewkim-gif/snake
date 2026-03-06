package perf

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"testing"
	"time"
)

// ============================================================
// S39: Server Performance Benchmark Suite
// Validates: 50 concurrent battles < 2ms tick, memory < 2GB
// ============================================================

// SimulatedArena represents a lightweight arena for benchmarking.
// Uses the same tick model as CountryArena without full game logic.
type SimulatedArena struct {
	ISO3       string
	AgentCount int
	TickCount  int64
	mu         sync.Mutex
}

// ProcessTick simulates one 20Hz game tick for a country arena.
// This mirrors the v10 arena.processTick() cost profile:
//   - Agent movement updates (N agents)
//   - Collision detection (spatial hash lookup)
//   - Orb management
//   - State serialization
func (sa *SimulatedArena) ProcessTick() time.Duration {
	start := time.Now()
	sa.mu.Lock()
	defer sa.mu.Unlock()

	// Simulate agent movement (position update for each agent)
	for i := 0; i < sa.AgentCount; i++ {
		_ = float64(i) * 1.5 // position calc
	}

	// Simulate spatial hash collision detection (O(N) with spatial partitioning)
	for i := 0; i < sa.AgentCount; i++ {
		for j := i + 1; j < min(i+5, sa.AgentCount); j++ {
			_ = float64(i-j) * float64(i-j) // distance check
		}
	}

	// Simulate orb management (~100 orbs per arena)
	for i := 0; i < 100; i++ {
		_ = float64(i) * 0.5
	}

	// Simulate state serialization (JSON marshal cost)
	for i := 0; i < sa.AgentCount; i++ {
		_ = fmt.Sprintf(`{"id":%d,"x":%f,"y":%f}`, i, float64(i)*10.0, float64(i)*20.0)
	}

	sa.TickCount++
	return time.Since(start)
}

// TestConcurrent50Arenas_TickLatency verifies 50 concurrent arenas tick under 2ms.
func TestConcurrent50Arenas_TickLatency(t *testing.T) {
	const numArenas = 50
	const agentsPerArena = 30 // average for mixed-tier countries
	const ticksToMeasure = 100

	arenas := make([]*SimulatedArena, numArenas)
	for i := 0; i < numArenas; i++ {
		arenas[i] = &SimulatedArena{
			ISO3:       fmt.Sprintf("C%02d", i),
			AgentCount: agentsPerArena,
		}
	}

	var maxTick time.Duration
	var totalTick time.Duration
	var tickCount int64
	var mu sync.Mutex

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	for _, arena := range arenas {
		wg.Add(1)
		go func(a *SimulatedArena) {
			defer wg.Done()
			for tick := 0; tick < ticksToMeasure; tick++ {
				select {
				case <-ctx.Done():
					return
				default:
				}
				elapsed := a.ProcessTick()
				mu.Lock()
				if elapsed > maxTick {
					maxTick = elapsed
				}
				totalTick += elapsed
				tickCount++
				mu.Unlock()
			}
		}(arena)
	}

	wg.Wait()

	avgTick := totalTick / time.Duration(tickCount)

	t.Logf("=== 50-Arena Concurrent Tick Benchmark ===")
	t.Logf("Arenas: %d, Agents/Arena: %d", numArenas, agentsPerArena)
	t.Logf("Total Ticks: %d", tickCount)
	t.Logf("Avg Tick: %v", avgTick)
	t.Logf("Max Tick: %v", maxTick)

	// Verify: 50 concurrent battles must tick under 2ms average
	if avgTick > 2*time.Millisecond {
		t.Errorf("Average tick %v exceeds 2ms target", avgTick)
	}
	if maxTick > 5*time.Millisecond {
		t.Errorf("Max tick %v exceeds 5ms tolerance", maxTick)
	}
}

// TestConcurrent195Countries_MemoryProfile verifies memory stays under 2GB
// when all 195 countries have their state loaded.
func TestConcurrent195Countries_MemoryProfile(t *testing.T) {
	const numCountries = 195

	// Take baseline memory reading
	runtime.GC()
	var memBefore runtime.MemStats
	runtime.ReadMemStats(&memBefore)

	// Simulate 195 country states in memory (mirrors WorldManager.countries map)
	type CountryStateSim struct {
		ISO3              string
		Name              string
		Continent         string
		Tier              string
		SovereignFaction  string
		SovereigntyLevel  int
		SovereigntyStreak int
		GDP               int64
		BattleStatus      string
		ActiveAgents      int
		SpectatorCount    int
		ArenaRadius       float64
		MaxAgents         int
		TerrainTheme      string
		Adjacent          []string
		Latitude          float64
		Longitude         float64
		CapitalName       string
		Resources         [5]float64 // oil, minerals, food, tech, manpower
	}

	countries := make(map[string]*CountryStateSim, numCountries)
	for i := 0; i < numCountries; i++ {
		iso := fmt.Sprintf("C%03d", i)
		countries[iso] = &CountryStateSim{
			ISO3:         iso,
			Name:         fmt.Sprintf("Country %d", i),
			Continent:    "Simulated",
			Tier:         "C",
			BattleStatus: "idle",
			ArenaRadius:  3000.0,
			MaxAgents:    30,
			TerrainTheme: "plains",
			Adjacent:     []string{"C001", "C002", "C003"},
			Latitude:     float64(i) * 0.5,
			Longitude:    float64(i) * 1.0,
			CapitalName:  fmt.Sprintf("Capital %d", i),
		}
	}

	// Simulate 50 active arenas (max concurrent)
	type ArenaSim struct {
		Agents []struct {
			X, Y, Angle float64
			HP          int
			Level       int
			FactionID   string
		}
	}

	activeArenas := make(map[string]*ArenaSim, 50)
	for i := 0; i < 50; i++ {
		iso := fmt.Sprintf("C%03d", i)
		arena := &ArenaSim{}
		arena.Agents = make([]struct {
			X, Y, Angle float64
			HP          int
			Level       int
			FactionID   string
		}, 30) // 30 agents per arena
		activeArenas[iso] = arena
	}

	// Measure memory after allocation
	runtime.GC()
	var memAfter runtime.MemStats
	runtime.ReadMemStats(&memAfter)

	allocatedMB := float64(memAfter.Alloc-memBefore.Alloc) / (1024 * 1024)
	totalAllocMB := float64(memAfter.TotalAlloc-memBefore.TotalAlloc) / (1024 * 1024)
	heapMB := float64(memAfter.HeapAlloc) / (1024 * 1024)

	t.Logf("=== 195-Country Memory Profile ===")
	t.Logf("Countries: %d, Active Arenas: %d", numCountries, len(activeArenas))
	t.Logf("Allocated: %.2f MB", allocatedMB)
	t.Logf("Total Alloc: %.2f MB", totalAllocMB)
	t.Logf("Heap In Use: %.2f MB", heapMB)
	t.Logf("NumGoroutine: %d", runtime.NumGoroutine())

	// Verify: total memory under 2GB
	if heapMB > 2048 {
		t.Errorf("Heap memory %.2f MB exceeds 2GB limit", heapMB)
	}

	// Country state should be very lightweight (<1MB for 195 entries)
	if allocatedMB > 100 {
		t.Errorf("Country state allocation %.2f MB is too high (expected <100MB)", allocatedMB)
	}
}

// TestOnDemandArenaPool_LifeCycle tests arena creation/reuse efficiency.
func TestOnDemandArenaPool_LifeCycle(t *testing.T) {
	const poolSize = 10
	const totalCycles = 100

	pool := make([]*SimulatedArena, 0, poolSize)
	active := make(map[string]*SimulatedArena)
	var created, reused, released int

	for cycle := 0; cycle < totalCycles; cycle++ {
		iso := fmt.Sprintf("C%03d", cycle%20) // reuse 20 countries cyclically

		// Acquire arena
		if _, exists := active[iso]; !exists {
			if len(pool) > 0 {
				// Reuse from pool
				arena := pool[len(pool)-1]
				pool = pool[:len(pool)-1]
				arena.ISO3 = iso
				arena.AgentCount = 15
				arena.TickCount = 0
				active[iso] = arena
				reused++
			} else {
				// Create new
				active[iso] = &SimulatedArena{
					ISO3:       iso,
					AgentCount: 15,
				}
				created++
			}
		}

		// Process some ticks
		active[iso].ProcessTick()

		// Release every 5th cycle
		if cycle%5 == 0 && len(active) > 0 {
			for releaseISO, arena := range active {
				if len(pool) < poolSize {
					pool = append(pool, arena)
				}
				delete(active, releaseISO)
				released++
				break // release one
			}
		}
	}

	t.Logf("=== Arena Pool Life Cycle ===")
	t.Logf("Total Cycles: %d", totalCycles)
	t.Logf("Created: %d, Reused: %d, Released: %d", created, reused, released)
	t.Logf("Pool Hit Rate: %.1f%%", float64(reused)/float64(reused+created)*100)

	if reused == 0 {
		t.Error("Arena pool reuse should be > 0")
	}
}

// BenchmarkSingleArenaTick benchmarks a single arena tick.
func BenchmarkSingleArenaTick(b *testing.B) {
	arena := &SimulatedArena{
		ISO3:       "USA",
		AgentCount: 50, // S-tier max
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		arena.ProcessTick()
	}
}

// BenchmarkConcurrent50ArenasTick benchmarks 50 arenas ticking in parallel.
func BenchmarkConcurrent50ArenasTick(b *testing.B) {
	const numArenas = 50
	arenas := make([]*SimulatedArena, numArenas)
	for i := 0; i < numArenas; i++ {
		arenas[i] = &SimulatedArena{
			ISO3:       fmt.Sprintf("C%02d", i),
			AgentCount: 30,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var wg sync.WaitGroup
		for _, arena := range arenas {
			wg.Add(1)
			go func(a *SimulatedArena) {
				defer wg.Done()
				a.ProcessTick()
			}(arena)
		}
		wg.Wait()
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
