package game

import (
	"fmt"
	"math"
	"time"
)

// ============================================================
// Arena 195-Country Benchmark — Phase 7
// ============================================================
//
// Estimates server load for running 195 simultaneous country arenas.
// Not a real load test — this is a calculation utility that predicts
// CPU/memory usage based on entity counts and tick complexity.

// ── Tier Distribution (195 countries) ────────────────────────

// CountryTierDistribution holds the count of countries per tier.
var CountryTierDistribution = map[string]int{
	"S": 5,   // USA, CHN, RUS, JPN, KOR
	"A": 15,  // FRA, SAU, AUS, TUR, IDN, etc.
	"B": 35,  // THA, ARG, SGP, NZL, CHE, etc.
	"C": 80,  // SVK, HRV, GEO, ARM, EST, etc.
	"D": 60,  // Small island/micro nations
}

// ── Benchmark Result ─────────────────────────────────────────

// ARBenchmarkResult holds the estimated load for a configuration.
type ARBenchmarkResult struct {
	// Configuration
	TotalCountries  int `json:"totalCountries"`
	ActiveArenas    int `json:"activeArenas"`    // arenas with physics simulation
	InactiveArenas  int `json:"inactiveArenas"`  // statistical-only arenas

	// Per-tier breakdown
	TierBreakdown []ARTierBenchmark `json:"tierBreakdown"`

	// Totals
	TotalPlayers      int     `json:"totalPlayers"`
	TotalEnemies      int     `json:"totalEnemies"`
	TotalProjectiles  int     `json:"totalProjectiles"`
	TotalEntities     int     `json:"totalEntities"`

	// Estimated performance
	EstTickTimeMs     float64 `json:"estTickTimeMs"`     // per-tick processing time (ms)
	EstMemoryMB       float64 `json:"estMemoryMb"`       // estimated memory usage (MB)
	EstBandwidthKBps  float64 `json:"estBandwidthKbps"`  // estimated bandwidth (KB/s)
	TickBudgetMs      float64 `json:"tickBudgetMs"`      // available budget (50ms for 20Hz)
	TickBudgetUsedPct float64 `json:"tickBudgetUsedPct"` // percentage of budget used

	// Warnings
	Warnings []string `json:"warnings,omitempty"`
}

// ARTierBenchmark holds per-tier estimated load.
type ARTierBenchmark struct {
	Tier            string  `json:"tier"`
	CountryCount    int     `json:"countryCount"`
	ActiveCount     int     `json:"activeCount"`
	MaxAgentsPerArena int   `json:"maxAgentsPerArena"`
	AvgEnemiesPerArena int  `json:"avgEnemiesPerArena"`
	AvgProjPerArena int     `json:"avgProjPerArena"`
	TotalPlayers    int     `json:"totalPlayers"`
	TotalEnemies    int     `json:"totalEnemies"`
	EstTickTimeMs   float64 `json:"estTickTimeMs"`
	EstMemoryMB     float64 `json:"estMemoryMb"`
}

// ── Benchmark Computation ────────────────────────────────────

// RunBenchmark195 estimates the server load for 195 simultaneous arenas.
// maxActiveArenas limits how many arenas run full physics (rest use statistical).
func RunBenchmark195(maxActiveArenas int) *ARBenchmarkResult {
	if maxActiveArenas <= 0 {
		maxActiveArenas = 50 // default: WorldManager pool size
	}

	result := &ARBenchmarkResult{
		TotalCountries: 195,
		TierBreakdown:  make([]ARTierBenchmark, 0, 5),
		TickBudgetMs:   50.0, // 20Hz = 50ms per tick
	}

	// Calculate how many arenas of each tier can be active
	// Priority: S > A > B > C > D
	remaining := maxActiveArenas
	tiers := []string{"S", "A", "B", "C", "D"}

	for _, tier := range tiers {
		count := CountryTierDistribution[tier]
		active := count
		if active > remaining {
			active = remaining
		}
		remaining -= active

		tb := computeTierBenchmark(tier, count, active)
		result.TierBreakdown = append(result.TierBreakdown, tb)

		result.ActiveArenas += active
		result.InactiveArenas += count - active
		result.TotalPlayers += tb.TotalPlayers
		result.TotalEnemies += tb.TotalEnemies
		result.EstTickTimeMs += tb.EstTickTimeMs
		result.EstMemoryMB += tb.EstMemoryMB
	}

	// Projectile estimate (avg 2 per player)
	result.TotalProjectiles = result.TotalPlayers * 2
	result.TotalEntities = result.TotalPlayers + result.TotalEnemies + result.TotalProjectiles

	// Bandwidth estimate: ~200 bytes per entity at 20Hz
	bytesPerTick := float64(result.TotalEntities) * 200.0
	result.EstBandwidthKBps = bytesPerTick * 20.0 / 1024.0

	// Add overhead for inactive arenas (statistical sim is cheap)
	result.EstTickTimeMs += float64(result.InactiveArenas) * 0.01 // 0.01ms per statistical arena

	// Calculate budget usage
	result.TickBudgetUsedPct = (result.EstTickTimeMs / result.TickBudgetMs) * 100.0

	// Generate warnings
	if result.TickBudgetUsedPct > 80 {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Tick budget usage %.1f%% exceeds 80%% threshold", result.TickBudgetUsedPct))
	}
	if result.EstMemoryMB > 2048 {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Estimated memory %.0fMB exceeds 2GB threshold", result.EstMemoryMB))
	}
	if result.EstBandwidthKBps > 100000 {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Estimated bandwidth %.0f KB/s may be excessive", result.EstBandwidthKBps))
	}

	return result
}

// computeTierBenchmark estimates load for a single tier.
func computeTierBenchmark(tier string, totalCount, activeCount int) ARTierBenchmark {
	maxAgents := CalcMaxAgentsByTier(tier)

	// Average enemies alive at any point (wave-dependent)
	avgEnemies := estimateAvgEnemies(tier)
	avgProj := maxAgents * 2

	// Tick time estimation per arena (microseconds → milliseconds)
	// Based on complexity of operations:
	//   - Movement: O(N) where N = players + enemies
	//   - Enemy AI: O(E * P) where E = enemies, P = players
	//   - Projectile collision: O(Proj * E) or O(Proj) with spatial grid
	//   - Status effects: O(E + P)
	//   - Wave spawning: O(1) amortized

	entityCount := maxAgents + avgEnemies + avgProj
	moveTimeUs := float64(entityCount) * 0.5 // 0.5μs per entity
	aiTimeUs := float64(avgEnemies) * float64(maxAgents) * 0.1 // 0.1μs per enemy-player pair
	projTimeUs := float64(avgProj) * 2.0 // 2μs per projectile (with spatial grid)
	statusTimeUs := float64(entityCount) * 0.3
	otherTimeUs := 50.0 // wave spawning, cleanup, etc.

	// Use spatial grid for S/A/B tiers
	optCfg := DefaultOptConfig(tier)
	if optCfg.UseSpatialGrid {
		// Spatial grid reduces AI from O(E*P) to O(E + grid overhead)
		aiTimeUs = float64(avgEnemies)*1.0 + float64(maxAgents)*0.5
		projTimeUs = float64(avgProj) * 0.5
	}

	totalTimeUs := moveTimeUs + aiTimeUs + projTimeUs + statusTimeUs + otherTimeUs
	tickTimeMs := totalTimeUs / 1000.0 * float64(activeCount)

	// Memory estimation per arena
	// Enemy: ~512 bytes, Player: ~2KB, Projectile: ~256 bytes
	memPerArena := float64(avgEnemies)*0.5 + float64(maxAgents)*2.0 + float64(avgProj)*0.25
	memPerArena += 50.0 // spatial grid, buffers, etc.
	totalMemMB := memPerArena * float64(activeCount) / 1024.0

	return ARTierBenchmark{
		Tier:               tier,
		CountryCount:       totalCount,
		ActiveCount:        activeCount,
		MaxAgentsPerArena:  maxAgents,
		AvgEnemiesPerArena: avgEnemies,
		AvgProjPerArena:    avgProj,
		TotalPlayers:       maxAgents * activeCount,
		TotalEnemies:       avgEnemies * activeCount,
		EstTickTimeMs:      tickTimeMs,
		EstMemoryMB:        totalMemMB,
	}
}

// estimateAvgEnemies returns the average number of enemies alive
// at any point during a standard 5-minute battle for a given tier.
func estimateAvgEnemies(tier string) int {
	// Based on wave spawning rate and enemy lifetime
	basePerWave := ARBaseEnemiesPerWave
	avgWaveNum := 5 // middle of battle
	tierMult := 1.0

	switch tier {
	case "S":
		tierMult = 1.0
	case "A":
		tierMult = 0.75
	case "B":
		tierMult = 0.55
	case "C":
		tierMult = 0.35
	case "D":
		tierMult = 0.2
	}

	perWave := float64(basePerWave+avgWaveNum*2) * tierMult
	// Assume ~3 waves alive at once (3s interval, ~9s avg enemy lifetime)
	avgAlive := int(perWave * 3)

	// Cap by tier max
	optCfg := DefaultOptConfig(tier)
	if avgAlive > optCfg.MaxEnemiesAlive {
		avgAlive = optCfg.MaxEnemiesAlive
	}

	return avgAlive
}

// ── Benchmark Report ─────────────────────────────────────────

// FormatBenchmarkReport creates a human-readable report string.
func FormatBenchmarkReport(r *ARBenchmarkResult) string {
	report := "=== Arena 195-Country Load Estimate ===\n\n"
	report += fmt.Sprintf("Total Countries: %d\n", r.TotalCountries)
	report += fmt.Sprintf("Active Arenas:   %d (physics simulation)\n", r.ActiveArenas)
	report += fmt.Sprintf("Inactive Arenas: %d (statistical only)\n", r.InactiveArenas)
	report += "\n"

	report += "── Per-Tier Breakdown ──\n"
	for _, tb := range r.TierBreakdown {
		report += fmt.Sprintf(
			"  %s-Tier: %d countries (%d active) | %d agents | ~%d enemies | tick: %.2fms | mem: %.1fMB\n",
			tb.Tier, tb.CountryCount, tb.ActiveCount,
			tb.MaxAgentsPerArena, tb.AvgEnemiesPerArena,
			tb.EstTickTimeMs, tb.EstMemoryMB,
		)
	}
	report += "\n"

	report += "── Totals ──\n"
	report += fmt.Sprintf("  Players:      %d\n", r.TotalPlayers)
	report += fmt.Sprintf("  Enemies:      %d\n", r.TotalEnemies)
	report += fmt.Sprintf("  Projectiles:  %d\n", r.TotalProjectiles)
	report += fmt.Sprintf("  Total Entity: %d\n", r.TotalEntities)
	report += "\n"

	report += "── Performance Estimates ──\n"
	report += fmt.Sprintf("  Tick Time:    %.2f ms (budget: %.0f ms)\n", r.EstTickTimeMs, r.TickBudgetMs)
	report += fmt.Sprintf("  Budget Used:  %.1f%%\n", r.TickBudgetUsedPct)
	report += fmt.Sprintf("  Memory:       %.1f MB\n", r.EstMemoryMB)
	report += fmt.Sprintf("  Bandwidth:    %.0f KB/s\n", r.EstBandwidthKBps)
	report += "\n"

	if len(r.Warnings) > 0 {
		report += "── Warnings ──\n"
		for _, w := range r.Warnings {
			report += fmt.Sprintf("  ⚠ %s\n", w)
		}
	} else {
		report += "── Status: OK — Within all performance budgets ──\n"
	}

	return report
}

// ── Single Arena Benchmark ───────────────────────────────────

// BenchmarkSingleArena measures the actual tick time for a single arena
// with the given tier configuration. Uses a mock arena with bots only.
func BenchmarkSingleArena(tier string, durationSec float64) *ARSingleBenchmark {
	ac := NewArenaCombat()
	maxAgents := CalcMaxAgentsByTier(tier)

	ac.Init(CombatModeConfig{
		ArenaRadius:  TierArenaRadius(tier),
		Tier:         tier,
		TerrainTheme: "urban",
		MaxAgents:    maxAgents,
		BattleMode:   "standard",
	})

	// Add bots
	charTypes := []ARCharacterType{
		ARCharStriker, ARCharGuardian, ARCharPyro, ARCharFrostMage,
	}
	for i := 0; i < maxAgents; i++ {
		info := &PlayerInfo{
			ID:        fmt.Sprintf("bench_%d", i),
			Name:      fmt.Sprintf("Bot%d", i),
			Character: string(charTypes[i%len(charTypes)]),
		}
		ac.OnPlayerJoin(info)
	}

	// Run ticks
	delta := 0.05 // 20Hz
	tickCount := int(durationSec / delta)
	if tickCount < 1 {
		tickCount = 1
	}

	var totalTimeNs int64
	var maxTickNs int64
	var totalEnemies int64
	var totalEvents int

	for t := 0; t < tickCount; t++ {
		start := time.Now()
		events := ac.OnTick(delta, uint64(t))
		elapsed := time.Since(start).Nanoseconds()

		totalTimeNs += elapsed
		if elapsed > maxTickNs {
			maxTickNs = elapsed
		}
		totalEnemies += int64(len(ac.enemies))
		totalEvents += len(events)
	}

	avgTickMs := float64(totalTimeNs) / float64(tickCount) / 1e6
	maxTickMs := float64(maxTickNs) / 1e6
	avgEnemies := float64(totalEnemies) / float64(tickCount)

	return &ARSingleBenchmark{
		Tier:          tier,
		MaxAgents:     maxAgents,
		TickCount:     tickCount,
		DurationSec:   durationSec,
		AvgTickMs:     math.Round(avgTickMs*100) / 100,
		MaxTickMs:     math.Round(maxTickMs*100) / 100,
		AvgEnemies:    math.Round(avgEnemies*10) / 10,
		TotalEvents:   totalEvents,
		WithinBudget:  avgTickMs < 50.0,
	}
}

// ARSingleBenchmark holds results for a single arena benchmark.
type ARSingleBenchmark struct {
	Tier         string  `json:"tier"`
	MaxAgents    int     `json:"maxAgents"`
	TickCount    int     `json:"tickCount"`
	DurationSec  float64 `json:"durationSec"`
	AvgTickMs    float64 `json:"avgTickMs"`
	MaxTickMs    float64 `json:"maxTickMs"`
	AvgEnemies   float64 `json:"avgEnemies"`
	TotalEvents  int     `json:"totalEvents"`
	WithinBudget bool    `json:"withinBudget"`
}
