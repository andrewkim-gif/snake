package main

import (
	"context"
	"flag"
	"fmt"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
)

// RoundResult holds statistics collected from a single simulated round.
type RoundResult struct {
	FinalLevels    []int
	Kills          []int
	SurvivalTicks  []int
	SynergyCount   int
	BuildPathWins  map[game.BotBuildPath]int
	WinnerBuild    game.BotBuildPath
	TotalAgents    int
}

func main() {
	rounds := flag.Int("rounds", 10, "number of rounds to simulate")
	bots := flag.Int("bots", 30, "number of bots per round")
	tickLimit := flag.Int("ticks", 6000, "max ticks per round (default: 300s * 20Hz = 6000)")
	flag.Parse()

	fmt.Println("=== Agent Survivor Balance Simulation ===")
	fmt.Printf("Rounds: %d | Bots: %d | Max ticks: %d\n\n", *rounds, *bots, *tickLimit)

	start := time.Now()

	// Aggregate metrics
	var allLevels []int
	var allKills []int
	var allSurvivalTicks []int
	totalSynergies := 0
	totalAgents := 0
	buildPathWins := make(map[game.BotBuildPath]int)

	for r := 0; r < *rounds; r++ {
		result := simulateRound(*bots, *tickLimit)
		allLevels = append(allLevels, result.FinalLevels...)
		allKills = append(allKills, result.Kills...)
		allSurvivalTicks = append(allSurvivalTicks, result.SurvivalTicks...)
		totalSynergies += result.SynergyCount
		totalAgents += result.TotalAgents
		for bp, count := range result.BuildPathWins {
			buildPathWins[bp] += count
		}
		fmt.Printf("  Round %d/%d complete (winner: %s, agents: %d)\n", r+1, *rounds, result.WinnerBuild, result.TotalAgents)
	}

	elapsed := time.Since(start)

	// --- Print results ---
	fmt.Println()
	fmt.Println("============================================")
	fmt.Println("          BALANCE SIMULATION RESULTS")
	fmt.Println("============================================")
	fmt.Println()

	// Average final level
	avgLevel := avg(allLevels)
	fmt.Printf("Average Final Level:     %.1f  (target: 8-12)\n", avgLevel)

	// Synergy activation rate
	synergyRate := 0.0
	if totalAgents > 0 {
		synergyRate = float64(totalSynergies) / float64(totalAgents) * 100
	}
	fmt.Printf("Synergy Activation Rate: %.1f%%  (target: 30%%+)\n", synergyRate)

	// Average kills per agent
	avgKills := avgFloat(allKills)
	fmt.Printf("Average Kills/Agent:     %.1f  (target: 3+)\n", avgKills)

	// Average survival time
	avgSurvival := avgFloat(allSurvivalTicks) / float64(game.TickRate)
	fmt.Printf("Average Survival Time:   %.0fs\n", avgSurvival)

	fmt.Println()
	fmt.Println("--- Build Path Win Distribution ---")

	// Sort build paths for consistent output
	type bpWin struct {
		path  game.BotBuildPath
		count int
	}
	var bpWins []bpWin
	totalWins := 0
	for bp, count := range buildPathWins {
		bpWins = append(bpWins, bpWin{bp, count})
		totalWins += count
	}
	sort.Slice(bpWins, func(i, j int) bool {
		return bpWins[i].count > bpWins[j].count
	})
	for _, bw := range bpWins {
		pct := 0.0
		if totalWins > 0 {
			pct = float64(bw.count) / float64(totalWins) * 100
		}
		bar := strings.Repeat("#", int(pct/2))
		fmt.Printf("  %-12s %3d wins (%5.1f%%) %s\n", bw.path, bw.count, pct, bar)
	}

	fmt.Println()
	fmt.Printf("Simulation completed in %s\n", elapsed.Truncate(time.Millisecond))

	// Exit code based on balance targets
	ok := true
	if avgLevel < 4 || avgLevel > 20 {
		fmt.Fprintf(os.Stderr, "WARNING: average level %.1f is outside expected range\n", avgLevel)
		ok = false
	}
	if avgKills < 1 {
		fmt.Fprintf(os.Stderr, "WARNING: average kills %.1f is below expected minimum\n", avgKills)
		ok = false
	}
	if !ok {
		os.Exit(1)
	}
}

// simulateRound runs a single headless game round with bots only.
func simulateRound(botCount, tickLimit int) RoundResult {
	arena := game.NewArena()

	// Track synergy events
	synergyCount := 0
	arena.EventHandler = func(events []game.ArenaEvent) {
		for _, e := range events {
			if e.Type == game.EventSynergy {
				synergyCount++
			}
		}
	}

	// Create bot manager and spawn bots
	bm := game.NewBotManager(botCount)
	bm.SetArena(arena)

	// Start the arena in a goroutine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go arena.Run(ctx)

	// Wait for arena to start running
	for !arena.IsRunning() {
		time.Sleep(time.Millisecond)
	}

	// Spawn bots and record their build paths
	bm.SpawnBots(botCount)
	buildPaths := bm.GetAllBotBuildPaths()

	// Run simulation ticks
	for tick := 0; tick < tickLimit; tick++ {
		// Bot AI updates (every tick)
		bm.UpdateBots()

		// Check if only 1 or 0 agents alive
		if arena.AliveCount() <= 1 {
			break
		}

		// Small sleep to yield CPU (not real-time, just for goroutine scheduling)
		if tick%100 == 0 {
			time.Sleep(time.Microsecond)
		}
	}

	// Cancel arena loop
	cancel()
	time.Sleep(5 * time.Millisecond) // brief wait for cleanup

	// Collect results
	agents := arena.GetAgents()
	result := RoundResult{
		TotalAgents:   len(agents),
		SynergyCount:  synergyCount,
		BuildPathWins: make(map[game.BotBuildPath]int),
	}

	// Find the winner (highest mass among alive, or highest score)
	var winnerID string
	var bestMass float64
	for _, a := range agents {
		result.FinalLevels = append(result.FinalLevels, a.Level)
		result.Kills = append(result.Kills, a.Kills)
		// Estimate survival ticks from join time
		survivalTicks := int(arena.GetTick())
		if !a.Alive {
			// Approximate: dead agents survived some fraction
			survivalTicks = survivalTicks / 2 // rough estimate
		}
		result.SurvivalTicks = append(result.SurvivalTicks, survivalTicks)

		if a.Alive && a.Mass > bestMass {
			bestMass = a.Mass
			winnerID = a.ID
		}
	}

	// Determine winner build path
	if bp, ok := buildPaths[winnerID]; ok {
		result.WinnerBuild = bp
		result.BuildPathWins[bp]++
	} else if len(game.AllBuildPaths) > 0 {
		result.WinnerBuild = game.AllBuildPaths[0]
		result.BuildPathWins[result.WinnerBuild]++
	}

	return result
}

// avg computes the mean of an int slice.
func avg(vals []int) float64 {
	if len(vals) == 0 {
		return 0
	}
	sum := 0
	for _, v := range vals {
		sum += v
	}
	return float64(sum) / float64(len(vals))
}

// avgFloat computes the mean of an int slice as float64.
func avgFloat(vals []int) float64 {
	if len(vals) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range vals {
		sum += float64(v)
	}
	return sum / float64(len(vals))
}

// Ensure imports are used.
var _ = math.Pi
var _ = domain.MaxLevel
