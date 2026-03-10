package game

import (
	"fmt"
	"runtime"
	"testing"
	"time"
)

// ============================================================
// v33 Phase 8 — Server Load Test
//
// Simulates 50 players per arena × 10 arenas to verify:
//   - Tick rate stability (20Hz under load)
//   - Memory usage per arena/player
//   - Concurrent kill validation throughput
//   - State serialization performance
//   - Epoch end reward computation time
// ============================================================

// --- 50 Players/Arena Tick Performance ---

func TestLoadTest_50PlayersTick(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Add 50 players (mix of nations)
	nations := []string{"KOR", "USA", "JPN", "CHN", "GBR", "DEU", "FRA", "RUS", "BRA", "IND"}
	for i := 0; i < 50; i++ {
		nation := nations[i%len(nations)]
		engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:     fmt.Sprintf("player_%d", i),
			Name:         fmt.Sprintf("Player%d", i),
			Nationality:  nation,
			IsAgent:      i%5 == 0, // 20% agents
			IsDirectPlay: i%5 != 0,
			TokenBalance: float64(i * 100),
		})
	}

	// Verify 50 players joined
	if engine.GetPlayerCount() != 50 {
		t.Fatalf("expected 50 players, got %d", engine.GetPlayerCount())
	}

	// Set war phase for full-load testing
	engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)

	// Simulate 600 ticks (30 seconds of gameplay at 20Hz)
	// Each tick: update all positions + check for seed resync
	tickCount := 600
	start := time.Now()

	for tick := uint64(1); tick <= uint64(tickCount); tick++ {
		// Simulate all 50 players sending input
		for i := 0; i < 50; i++ {
			engine.OnPlayerInput(
				fmt.Sprintf("player_%d", i),
				MatrixInputData{
					X:     float64(100 + i*10) + float64(tick)*2,
					Y:     float64(200 + i*5) + float64(tick),
					Angle: float64(tick) * 0.1,
					Boost: tick%20 == 0,
					Tick:  tick,
				},
			)
		}

		// Tick the engine
		engine.Tick(tick)
	}

	elapsed := time.Since(start)
	perTick := elapsed / time.Duration(tickCount)

	t.Logf("50 players, %d ticks: total=%v, per-tick=%v", tickCount, elapsed, perTick)

	// At 20Hz, each tick budget is 50ms. We should be well under.
	if perTick > 10*time.Millisecond {
		t.Errorf("per-tick time %v exceeds 10ms budget (20Hz target is 50ms)", perTick)
	}
}

// --- State Serialization Performance ---

func TestLoadTest_StateSerialization(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()

	// Add 50 players
	for i := 0; i < 50; i++ {
		engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:     fmt.Sprintf("player_%d", i),
			Name:         fmt.Sprintf("Player%d", i),
			Nationality:  "KOR",
			TokenBalance: float64(i * 50),
		})
		engine.OnPlayerInput(fmt.Sprintf("player_%d", i), MatrixInputData{
			X: float64(i * 100), Y: float64(i * 50), Tick: 1,
		})
	}

	// Measure GetWorldState() performance (called 20Hz per arena)
	const iterations = 1000
	start := time.Now()

	for i := 0; i < iterations; i++ {
		state := engine.GetWorldState()
		if state == nil {
			t.Fatal("state should not be nil")
		}
		if len(state.Players) != 50 {
			t.Fatalf("expected 50 players in state, got %d", len(state.Players))
		}
	}

	elapsed := time.Since(start)
	perCall := elapsed / iterations

	t.Logf("GetWorldState (50 players): %d calls in %v, per-call=%v", iterations, elapsed, perCall)

	// Should be under 1ms per call
	if perCall > 1*time.Millisecond {
		t.Errorf("GetWorldState takes %v, should be under 1ms", perCall)
	}
}

// --- Kill Validation Throughput ---

func TestLoadTest_KillValidationThroughput(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()
	engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)

	// Add 50 players from different nations
	nations := []string{"KOR", "USA", "JPN", "CHN", "GBR"}
	for i := 0; i < 50; i++ {
		nation := nations[i%len(nations)]
		engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:    fmt.Sprintf("player_%d", i),
			Name:        fmt.Sprintf("Player%d", i),
			Nationality: nation,
		})
		// Position players close together for valid kills
		engine.OnPlayerInput(fmt.Sprintf("player_%d", i), MatrixInputData{
			X: float64(100 + (i%10)*20), Y: float64(100 + (i/10)*20), Tick: 100,
		})
	}
	engine.Tick(100)

	// Generate 1000 kill reports
	const killReports = 1000
	start := time.Now()
	validCount := 0

	for i := 0; i < killReports; i++ {
		killerIdx := i % 50
		targetIdx := (i + 1) % 50
		if nations[killerIdx%5] == nations[targetIdx%5] {
			targetIdx = (targetIdx + 1) % 50
		}

		report := KillReport{
			KillerID: fmt.Sprintf("player_%d", killerIdx),
			TargetID: fmt.Sprintf("player_%d", targetIdx),
			WeaponID: "cannon",
			Damage:   40,
			Tick:     100 + uint64(i),
		}

		// Advance engine tick so cooldowns pass
		engine.Tick(100 + uint64(i))

		result := engine.OnKillReport(report)
		if result.Valid {
			validCount++
		}
	}

	elapsed := time.Since(start)
	perReport := elapsed / killReports

	t.Logf("Kill validation: %d reports in %v, per-report=%v, valid=%d",
		killReports, elapsed, perReport, validCount)

	// Each validation should be under 100us
	if perReport > 100*time.Microsecond {
		t.Errorf("kill validation takes %v per report, should be under 100us", perReport)
	}
}

// --- Epoch End Reward Computation ---

func TestLoadTest_EpochEndRewardComputation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()
	engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)

	// Add 50 players with varied scores
	nations := []string{"KOR", "USA", "JPN", "CHN", "GBR", "DEU", "FRA", "RUS", "BRA", "IND"}
	for i := 0; i < 50; i++ {
		nation := nations[i%len(nations)]
		engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:     fmt.Sprintf("player_%d", i),
			Name:         fmt.Sprintf("Player%d", i),
			Nationality:  nation,
			IsDirectPlay: i%3 == 0,
			TokenBalance: float64(i * 200),
		})

		// Generate scores
		engine.OnLevelUp(fmt.Sprintf("player_%d", i), i+1)
	}

	// Measure epoch end computation
	const iterations = 100
	start := time.Now()

	for i := 0; i < iterations; i++ {
		// Re-add scores since SnapshotAndReset clears them
		for j := 0; j < 50; j++ {
			engine.GetScoreAggregator().AddKill(
				fmt.Sprintf("player_%d", j), fmt.Sprintf("Player%d", j),
				nations[j%len(nations)], j%5 == 0, j%3 == 0,
			)
		}

		result := engine.OnEpochEnd(i+1, "KOR", i%3 == 0, i%5 == 0)
		if result == nil {
			t.Fatal("expected result")
		}
	}

	elapsed := time.Since(start)
	perEpoch := elapsed / iterations

	t.Logf("Epoch end (50 players): %d iterations in %v, per-epoch=%v",
		iterations, elapsed, perEpoch)

	// Should be under 5ms per epoch end
	if perEpoch > 5*time.Millisecond {
		t.Errorf("epoch end takes %v, should be under 5ms", perEpoch)
	}
}

// --- Memory Profiling ---

func TestLoadTest_MemoryProfile(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	var memBefore, memAfter runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&memBefore)

	// Create 10 arenas with 50 players each
	engines := make([]*OnlineMatrixEngine, 10)
	countries := []string{"KOR", "USA", "JPN", "CHN", "GBR", "DEU", "FRA", "RUS", "BRA", "IND"}

	for a := 0; a < 10; a++ {
		engines[a] = NewOnlineMatrixEngine(countries[a])
		engines[a].Start()

		for i := 0; i < 50; i++ {
			engines[a].OnPlayerJoin(MatrixJoinInfo{
				ClientID:     fmt.Sprintf("a%d_p%d", a, i),
				Name:         fmt.Sprintf("Player%d", i),
				Nationality:  countries[i%10],
				TokenBalance: float64(i * 100),
			})
		}
	}

	runtime.GC()
	runtime.ReadMemStats(&memAfter)

	// Use TotalAlloc delta (monotonically increasing) to avoid underflow
	// when GC frees more memory than was allocated between measurements.
	allocMB := float64(memAfter.TotalAlloc-memBefore.TotalAlloc) / (1024 * 1024)
	perArena := allocMB / 10
	perPlayer := allocMB / 500

	t.Logf("Memory: 10 arenas × 50 players = %d players", 500)
	t.Logf("  Total alloc: %.2f MB", allocMB)
	t.Logf("  Per arena: %.2f MB", perArena)
	t.Logf("  Per player: %.4f MB (%.0f KB)", perPlayer, perPlayer*1024)

	// Each arena with 50 players should use < 10 MB total allocation
	if perArena > 10 {
		t.Errorf("per-arena memory %.2f MB exceeds 10 MB budget", perArena)
	}
}

// --- Concurrent Access Safety ---

func TestLoadTest_ConcurrentAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	engine := NewOnlineMatrixEngine("KOR")
	engine.Start()
	engine.OnEpochPhaseChange(EpochPhaseWar, 1, 3000)

	// Add some players
	for i := 0; i < 10; i++ {
		engine.OnPlayerJoin(MatrixJoinInfo{
			ClientID:    fmt.Sprintf("p%d", i),
			Name:        fmt.Sprintf("Player%d", i),
			Nationality: "KOR",
		})
	}

	// Run concurrent operations for 1 second
	done := make(chan bool)

	// Concurrent input writers
	go func() {
		for i := 0; i < 1000; i++ {
			engine.OnPlayerInput(fmt.Sprintf("p%d", i%10), MatrixInputData{
				X: float64(i), Y: float64(i), Tick: uint64(i),
			})
		}
		done <- true
	}()

	// Concurrent state readers
	go func() {
		for i := 0; i < 1000; i++ {
			engine.GetWorldState()
		}
		done <- true
	}()

	// Concurrent tick
	go func() {
		for i := uint64(1); i <= 1000; i++ {
			engine.Tick(i)
		}
		done <- true
	}()

	// Wait for all goroutines
	for i := 0; i < 3; i++ {
		<-done
	}

	// If we get here without deadlock/panic, the test passes
	t.Log("concurrent access test passed without deadlock")
}

// --- Multi-Arena Tick Simulation ---

func TestLoadTest_MultiArenaTick(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	const numArenas = 10
	const playersPerArena = 50
	const tickDuration = 100 // 5 seconds at 20Hz

	countries := []string{"KOR", "USA", "JPN", "CHN", "GBR", "DEU", "FRA", "RUS", "BRA", "IND"}
	engines := make([]*OnlineMatrixEngine, numArenas)

	// Initialize arenas
	for a := 0; a < numArenas; a++ {
		engines[a] = NewOnlineMatrixEngine(countries[a])
		engines[a].Start()
		engines[a].OnEpochPhaseChange(EpochPhaseWar, 1, 3000)

		for i := 0; i < playersPerArena; i++ {
			engines[a].OnPlayerJoin(MatrixJoinInfo{
				ClientID:    fmt.Sprintf("a%d_p%d", a, i),
				Name:        fmt.Sprintf("Player%d", i),
				Nationality: countries[i%10],
			})
		}
	}

	start := time.Now()

	for tick := uint64(1); tick <= uint64(tickDuration); tick++ {
		for a := 0; a < numArenas; a++ {
			// Simulate all inputs
			for i := 0; i < playersPerArena; i++ {
				engines[a].OnPlayerInput(
					fmt.Sprintf("a%d_p%d", a, i),
					MatrixInputData{
						X: float64(i*10) + float64(tick),
						Y: float64(i*5) + float64(tick),
						Tick: tick,
					},
				)
			}
			engines[a].Tick(tick)

			// Collect state (simulating broadcaster)
			engines[a].GetWorldState()
		}
	}

	elapsed := time.Since(start)
	totalTicks := numArenas * tickDuration
	perTick := elapsed / time.Duration(totalTicks)

	t.Logf("Multi-arena: %d arenas × %d players × %d ticks", numArenas, playersPerArena, tickDuration)
	t.Logf("  Total: %v, per-arena-tick: %v", elapsed, perTick)

	// 10 arenas should still process all ticks well within budget
	// Total tick budget = 50ms * 100 ticks = 5 seconds
	if elapsed > 5*time.Second {
		t.Errorf("multi-arena simulation took %v, exceeds 5s budget", elapsed)
	}
}
