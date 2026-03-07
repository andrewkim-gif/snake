package main

import (
	"context"
	"flag"
	"fmt"
	"math"
	"math/rand"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
	"github.com/andrewkim-gif/snake/server/internal/game"
)

// ============================================================
// v14 Phase 10 — S42: Weapon Balance Simulation
// 1000-round bot-vs-bot auto-combat with per-weapon/synergy stats
// ============================================================

// --- Result Types ---

// RoundResult holds statistics collected from a single simulated round.
type RoundResult struct {
	FinalLevels    []int
	Kills          []int
	Deaths         []int
	SurvivalTicks  []int
	SynergyCount   int
	BuildPathWins  map[game.BotBuildPath]int
	WinnerBuild    game.BotBuildPath
	TotalAgents    int
	// v14: Per-weapon stats
	WeaponKills   map[domain.WeaponType]int
	WeaponPicks   map[domain.WeaponType]int
	WeaponDamage  map[domain.WeaponType]float64
	// v14: Per-synergy activation count
	SynergyActivations map[domain.V14SynergyType]int
	// v14: Build composition of winner
	WinnerWeapons  []domain.WeaponType
	WinnerPassives map[domain.PassiveType]int
	WinnerSynergies []domain.V14SynergyType
}

// BuildProfile tracks a specific weapon+passive combination and its performance.
type BuildProfile struct {
	Weapons    string // sorted weapon list as key
	Passives   string // sorted passive list as key
	Wins       int
	Plays      int
	TotalKills int
}

// weaponStat holds per-weapon aggregate stats.
type weaponStat struct {
	wt     domain.WeaponType
	name   string
	picks  int
	kills  int
	damage float64
}

// weaponWR holds per-weapon win rate data.
type weaponWR struct {
	wt      domain.WeaponType
	name    string
	wins    int
	total   int
	winRate float64
}

// synStat holds per-synergy activation stats.
type synStat struct {
	st    domain.V14SynergyType
	name  string
	count int
	rate  float64
}

func main() {
	rounds := flag.Int("rounds", 1000, "number of rounds to simulate (default 1000)")
	bots := flag.Int("bots", 30, "number of bots per round")
	tickLimit := flag.Int("ticks", 12000, "max ticks per round (default: 600s * 20Hz = 12000 for 10min epoch)")
	verbose := flag.Bool("v", false, "verbose: print per-round details")
	opThreshold := flag.Float64("op", 60.0, "OP threshold percentage for build win rate")
	flag.Parse()

	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║       v14 WEAPON BALANCE SIMULATION — AI World War          ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Printf("\nRounds: %d | Bots: %d | Max ticks: %d | OP threshold: %.0f%%\n\n", *rounds, *bots, *tickLimit, *opThreshold)

	start := time.Now()

	// Aggregate metrics
	var allLevels []int
	var allKills []int
	var allDeaths []int
	var allSurvivalTicks []int
	totalSynergies := 0
	totalAgents := 0
	buildPathWins := make(map[game.BotBuildPath]int)

	// v14: Weapon-level aggregates
	globalWeaponKills := make(map[domain.WeaponType]int)
	globalWeaponPicks := make(map[domain.WeaponType]int)
	globalWeaponDamage := make(map[domain.WeaponType]float64)
	globalSynergyActivations := make(map[domain.V14SynergyType]int)

	// v14: Build profile tracking
	buildProfiles := make(map[string]*BuildProfile)

	for r := 0; r < *rounds; r++ {
		result := simulateRound(*bots, *tickLimit)
		allLevels = append(allLevels, result.FinalLevels...)
		allKills = append(allKills, result.Kills...)
		allDeaths = append(allDeaths, result.Deaths...)
		allSurvivalTicks = append(allSurvivalTicks, result.SurvivalTicks...)
		totalSynergies += result.SynergyCount
		totalAgents += result.TotalAgents
		for bp, count := range result.BuildPathWins {
			buildPathWins[bp] += count
		}

		// Aggregate weapon stats
		for wt, kills := range result.WeaponKills {
			globalWeaponKills[wt] += kills
		}
		for wt, picks := range result.WeaponPicks {
			globalWeaponPicks[wt] += picks
		}
		for wt, dmg := range result.WeaponDamage {
			globalWeaponDamage[wt] += dmg
		}
		for st, count := range result.SynergyActivations {
			globalSynergyActivations[st] += count
		}

		// Track build profiles
		if len(result.WinnerWeapons) > 0 {
			key := buildProfileKey(result.WinnerWeapons, result.WinnerPassives)
			bp, exists := buildProfiles[key]
			if !exists {
				bp = &BuildProfile{Weapons: weaponsToString(result.WinnerWeapons), Passives: passivesToString(result.WinnerPassives)}
				buildProfiles[key] = bp
			}
			bp.Wins++
			bp.Plays++
		}

		if *verbose {
			fmt.Printf("  Round %d/%d complete (winner: %s, agents: %d, synergies: %d)\n",
				r+1, *rounds, result.WinnerBuild, result.TotalAgents, result.SynergyCount)
		} else if (r+1)%100 == 0 {
			fmt.Printf("  Progress: %d/%d rounds completed...\n", r+1, *rounds)
		}
	}

	elapsed := time.Since(start)

	// ============================================================
	// REPORT: Section 1 — Overall Stats
	// ============================================================
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║                  BALANCE SIMULATION RESULTS                 ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()

	avgLevel := avg(allLevels)
	maxLevel := maxInt(allLevels)
	fmt.Printf("  Average Final Level:     %.1f  (target: 8-12, max seen: %d)\n", avgLevel, maxLevel)

	synergyRate := 0.0
	if totalAgents > 0 {
		synergyRate = float64(totalSynergies) / float64(totalAgents) * 100
	}
	fmt.Printf("  Synergy Activation Rate: %.1f%%  (target: 30%%+)\n", synergyRate)

	avgKills := avgFloat(allKills)
	avgDeaths := avgFloat(allDeaths)
	fmt.Printf("  Average Kills/Agent:     %.1f  (target: 3+)\n", avgKills)
	fmt.Printf("  Average Deaths/Agent:    %.1f\n", avgDeaths)
	fmt.Printf("  Average K/D Ratio:       %.2f\n", safeDiv(avgKills, avgDeaths))

	avgSurvival := avgFloat(allSurvivalTicks) / float64(game.TickRate)
	fmt.Printf("  Average Survival Time:   %.0fs (%.1f min)\n", avgSurvival, avgSurvival/60)

	// ============================================================
	// REPORT: Section 2 — Build Path Win Distribution
	// ============================================================
	fmt.Println()
	fmt.Println("── Build Path Win Distribution ──────────────────────────────")
	fmt.Println()

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
		bar := strings.Repeat("█", int(pct/2))
		status := "  "
		if pct >= *opThreshold {
			status = "⚠ OP"
		}
		fmt.Printf("  %-12s %4d wins (%5.1f%%) %s %s\n", bw.path, bw.count, pct, bar, status)
	}

	// ============================================================
	// REPORT: Section 3 — Per-Weapon Win/Pick/Damage Stats
	// ============================================================
	fmt.Println()
	fmt.Println("── Per-Weapon Statistics ─────────────────────────────────────")
	fmt.Println()
	fmt.Printf("  %-18s %6s %6s %10s %8s\n", "WEAPON", "PICKS", "KILLS", "DAMAGE", "K/PICK")
	fmt.Println("  " + strings.Repeat("─", 58))

	var wStats []weaponStat
	for _, wt := range domain.AllWeaponTypes {
		wd := domain.GetWeaponData(wt)
		name := string(wt)
		if wd != nil {
			name = wd.Name
		}
		wStats = append(wStats, weaponStat{
			wt:     wt,
			name:   name,
			picks:  globalWeaponPicks[wt],
			kills:  globalWeaponKills[wt],
			damage: globalWeaponDamage[wt],
		})
	}
	sort.Slice(wStats, func(i, j int) bool {
		return wStats[i].kills > wStats[j].kills
	})
	for _, ws := range wStats {
		kPerPick := safeDiv(float64(ws.kills), float64(ws.picks))
		fmt.Printf("  %-18s %6d %6d %10.0f %8.2f\n", ws.name, ws.picks, ws.kills, ws.damage, kPerPick)
	}

	// ============================================================
	// REPORT: Section 4 — Per-Weapon Win Rate (OP Detection)
	// ============================================================
	fmt.Println()
	fmt.Println("── Per-Weapon Win Rate (Winner had weapon) ──────────────────")
	fmt.Println()

	// Calculate per-weapon win rates from build profiles
	weaponWinCount := make(map[domain.WeaponType]int)
	weaponPlayCount := make(map[domain.WeaponType]int)
	for _, bp := range buildProfiles {
		weapons := parseWeaponsFromString(bp.Weapons)
		for _, wt := range weapons {
			weaponWinCount[wt] += bp.Wins
			weaponPlayCount[wt] += bp.Plays
		}
	}

	var wWRs []weaponWR
	for _, wt := range domain.AllWeaponTypes {
		wd := domain.GetWeaponData(wt)
		name := string(wt)
		if wd != nil {
			name = wd.Name
		}
		wins := weaponWinCount[wt]
		wr := safeDiv(float64(wins), float64(totalWins)) * 100
		wWRs = append(wWRs, weaponWR{wt: wt, name: name, wins: wins, total: totalWins, winRate: wr})
	}
	sort.Slice(wWRs, func(i, j int) bool {
		return wWRs[i].winRate > wWRs[j].winRate
	})
	fmt.Printf("  %-18s %6s %8s %s\n", "WEAPON", "WINS", "WIN RATE", "STATUS")
	fmt.Println("  " + strings.Repeat("─", 50))
	for _, wr := range wWRs {
		status := "OK"
		if wr.winRate >= *opThreshold {
			status = "⚠ OVERPOWERED"
		} else if wr.winRate <= 5 {
			status = "⚠ UNDERPOWERED"
		}
		fmt.Printf("  %-18s %6d %7.1f%%  %s\n", wr.name, wr.wins, wr.winRate, status)
	}

	// ============================================================
	// REPORT: Section 5 — Per-Synergy Activation Stats
	// ============================================================
	fmt.Println()
	fmt.Println("── Per-Synergy Activation Stats ─────────────────────────────")
	fmt.Println()

	var sStats []synStat
	for _, def := range game.AllV14Synergies {
		count := globalSynergyActivations[def.Type]
		rate := safeDiv(float64(count), float64(totalAgents)) * 100
		sStats = append(sStats, synStat{st: def.Type, name: def.Name, count: count, rate: rate})
	}
	sort.Slice(sStats, func(i, j int) bool {
		return sStats[i].count > sStats[j].count
	})
	fmt.Printf("  %-20s %6s %8s\n", "SYNERGY", "COUNT", "RATE")
	fmt.Println("  " + strings.Repeat("─", 40))
	for _, ss := range sStats {
		fmt.Printf("  %-20s %6d %7.1f%%\n", ss.name, ss.count, ss.rate)
	}

	// ============================================================
	// REPORT: Section 6 — OP Build Detection
	// ============================================================
	fmt.Println()
	fmt.Printf("── OP Build Detection (Win Rate >= %.0f%%) ─────────────────────\n", *opThreshold)
	fmt.Println()

	type buildWR struct {
		weapons string
		passives string
		wins    int
		plays   int
		winRate float64
	}
	var opBuilds []buildWR
	for _, bp := range buildProfiles {
		if bp.Wins < 3 { // minimum sample size
			continue
		}
		wr := safeDiv(float64(bp.Wins), float64(*rounds)) * 100
		if wr >= *opThreshold {
			opBuilds = append(opBuilds, buildWR{
				weapons: bp.Weapons, passives: bp.Passives,
				wins: bp.Wins, plays: bp.Plays, winRate: wr,
			})
		}
	}

	if len(opBuilds) == 0 {
		fmt.Println("  No OP builds detected. Balance appears healthy.")
	} else {
		sort.Slice(opBuilds, func(i, j int) bool {
			return opBuilds[i].winRate > opBuilds[j].winRate
		})
		for _, ob := range opBuilds {
			fmt.Printf("  ⚠ WIN RATE: %.1f%% (%d/%d)\n", ob.winRate, ob.wins, ob.plays)
			fmt.Printf("    Weapons:  %s\n", ob.weapons)
			fmt.Printf("    Passives: %s\n", ob.passives)
			fmt.Println()
		}
	}

	// ============================================================
	// REPORT: Section 7 — Balance Recommendations
	// ============================================================
	fmt.Println()
	fmt.Println("── Balance Adjustment Recommendations ───────────────────────")
	fmt.Println()

	recommendations := generateRecommendations(wStats, wWRs, sStats, avgLevel, avgKills, synergyRate, *opThreshold)
	if len(recommendations) == 0 {
		fmt.Println("  ✓ All metrics within acceptable ranges. No changes recommended.")
	} else {
		for i, rec := range recommendations {
			fmt.Printf("  %d. %s\n", i+1, rec)
		}
	}

	// ============================================================
	// Summary
	// ============================================================
	fmt.Println()
	fmt.Printf("Simulation completed in %s (%d total agents across %d rounds)\n", elapsed.Truncate(time.Millisecond), totalAgents, *rounds)

	// Exit code based on balance targets
	ok := true
	if avgLevel < 4 || avgLevel > 20 {
		fmt.Fprintf(os.Stderr, "WARNING: average level %.1f is outside expected range [4, 20]\n", avgLevel)
		ok = false
	}
	if avgKills < 1 {
		fmt.Fprintf(os.Stderr, "WARNING: average kills %.1f is below expected minimum 1\n", avgKills)
		ok = false
	}
	if len(opBuilds) > 0 {
		fmt.Fprintf(os.Stderr, "WARNING: %d OP build(s) detected with win rate >= %.0f%%\n", len(opBuilds), *opThreshold)
		ok = false
	}
	if !ok {
		os.Exit(1)
	}
}

// ============================================================
// Simulation Engine
// ============================================================

// simulateRound runs a single headless game round with bots only.
func simulateRound(botCount, tickLimit int) RoundResult {
	arena := game.NewArena()

	// Track events
	synergyCount := 0
	synergyActivations := make(map[domain.V14SynergyType]int)

	arena.EventHandler = func(events []game.ArenaEvent) {
		for _, e := range events {
			if e.Type == game.EventSynergy {
				synergyCount++
				// Track specific synergy type if available
				if sa, ok := e.Data.(game.SynergyActivation); ok {
					synergyActivations[sa.Type]++
				}
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

	// Spawn bots with diverse nationalities for proper weapon system engagement
	bm.SpawnBots(botCount)
	buildPaths := bm.GetAllBotBuildPaths()

	// Run simulation ticks
	for tick := 0; tick < tickLimit; tick++ {
		bm.UpdateBots()

		// Check if only 1 or 0 agents alive
		if arena.AliveCount() <= 1 {
			break
		}

		// Yield CPU periodically
		if tick%100 == 0 {
			time.Sleep(time.Microsecond)
		}
	}

	// Cancel arena loop
	cancel()
	time.Sleep(5 * time.Millisecond)

	// Collect results
	agents := arena.GetAgents()
	result := RoundResult{
		TotalAgents:        len(agents),
		SynergyCount:       synergyCount,
		BuildPathWins:      make(map[game.BotBuildPath]int),
		WeaponKills:        make(map[domain.WeaponType]int),
		WeaponPicks:        make(map[domain.WeaponType]int),
		WeaponDamage:       make(map[domain.WeaponType]float64),
		SynergyActivations: synergyActivations,
	}

	// Find the winner (highest score among alive, or highest score overall)
	var winnerID string
	var bestScore int
	for _, a := range agents {
		result.FinalLevels = append(result.FinalLevels, a.Level)
		result.Kills = append(result.Kills, a.Kills)
		result.Deaths = append(result.Deaths, a.Deaths)

		survivalTicks := int(arena.GetTick())
		if !a.Alive {
			survivalTicks = survivalTicks / 2 // rough estimate
		}
		result.SurvivalTicks = append(result.SurvivalTicks, survivalTicks)

		// Track per-weapon picks
		for _, slot := range a.WeaponSlots {
			result.WeaponPicks[slot.Type]++
		}

		// Determine winner
		score := a.Kills*100 + a.Level*10
		if a.Alive {
			score += 500 // alive bonus
		}
		if score > bestScore {
			bestScore = score
			winnerID = a.ID
		}
	}

	// Winner build analysis
	if winner, ok := agents[winnerID]; ok {
		result.WinnerWeapons = make([]domain.WeaponType, 0, len(winner.WeaponSlots))
		for _, slot := range winner.WeaponSlots {
			result.WinnerWeapons = append(result.WinnerWeapons, slot.Type)
		}
		if winner.Passives != nil {
			result.WinnerPassives = make(map[domain.PassiveType]int)
			for pt, stacks := range winner.Passives {
				result.WinnerPassives[pt] = stacks
			}
		}
		result.WinnerSynergies = winner.V14Synergies
	}

	// Determine winner build path
	if bp, ok := buildPaths[winnerID]; ok {
		result.WinnerBuild = bp
		result.BuildPathWins[bp]++
	} else if len(game.AllBuildPaths) > 0 {
		result.WinnerBuild = game.AllBuildPaths[0]
		result.BuildPathWins[result.WinnerBuild]++
	}

	// Aggregate weapon kills from agent kill attribution
	// (In the full system, kills are tracked per-weapon; here we estimate
	// by distributing kills proportionally across equipped weapons)
	for _, a := range agents {
		if a.Kills > 0 && len(a.WeaponSlots) > 0 {
			killsPerWeapon := float64(a.Kills) / float64(len(a.WeaponSlots))
			for _, slot := range a.WeaponSlots {
				result.WeaponKills[slot.Type] += int(math.Round(killsPerWeapon))
			}
		}
	}

	return result
}

// ============================================================
// Balance Recommendation Engine
// ============================================================

func generateRecommendations(
	wStats []weaponStat,
	wWRs []weaponWR,
	sStats []synStat,
	avgLevel, avgKills, synergyRate, opThreshold float64,
) []string {
	var recs []string

	// Check overall level balance
	if avgLevel < 6 {
		recs = append(recs, "LEVEL PROGRESSION TOO SLOW: Consider increasing XP from orbs/NPCs or reducing XP curve")
	} else if avgLevel > 16 {
		recs = append(recs, "LEVEL PROGRESSION TOO FAST: Consider reducing XP gain or steepening the XP curve")
	}

	// Check kill rate
	if avgKills < 2 {
		recs = append(recs, "LOW KILL RATE: Consider reducing base HP or increasing weapon DPS to encourage more combat")
	}

	// Check synergy rate
	if synergyRate < 15 {
		recs = append(recs, "LOW SYNERGY ACTIVATION: Consider relaxing synergy requirements or adding more synergy hints in level-up choices")
	}

	// Check for OP weapons (by kills)
	if len(wStats) > 0 {
		totalKills := 0
		for _, ws := range wStats {
			totalKills += ws.kills
		}
		for _, ws := range wStats {
			if totalKills > 0 {
				pct := float64(ws.kills) / float64(totalKills) * 100
				expected := 100.0 / float64(len(wStats))
				if pct > expected*2.5 {
					recs = append(recs, fmt.Sprintf("WEAPON OP [%s]: %.1f%% of all kills (expected ~%.0f%%). Consider reducing DPS or range", ws.name, pct, expected))
				}
				if pct < expected*0.2 && ws.picks > 0 {
					recs = append(recs, fmt.Sprintf("WEAPON WEAK [%s]: %.1f%% of all kills despite %d picks. Consider buffing DPS or adding utility", ws.name, pct, ws.picks))
				}
			}
		}
	}

	// Check for OP weapon win rates
	for _, wr := range wWRs {
		if wr.winRate >= opThreshold {
			recs = append(recs, fmt.Sprintf("WEAPON HIGH WIN RATE [%s]: %.1f%% winners had this weapon. Consider nerfing", wr.name, wr.winRate))
		}
	}

	// Check synergy balance
	for _, ss := range sStats {
		if ss.rate > 40 {
			recs = append(recs, fmt.Sprintf("SYNERGY TOO COMMON [%s]: %.1f%% activation rate. Consider tightening requirements", ss.name, ss.rate))
		}
	}

	return recs
}

// ============================================================
// Utility Functions
// ============================================================

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

func maxInt(vals []int) int {
	if len(vals) == 0 {
		return 0
	}
	m := vals[0]
	for _, v := range vals {
		if v > m {
			m = v
		}
	}
	return m
}

func safeDiv(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

func buildProfileKey(weapons []domain.WeaponType, passives map[domain.PassiveType]int) string {
	wKey := weaponsToString(weapons)
	pKey := passivesToString(passives)
	return wKey + "|" + pKey
}

func weaponsToString(weapons []domain.WeaponType) string {
	if len(weapons) == 0 {
		return "none"
	}
	strs := make([]string, len(weapons))
	for i, wt := range weapons {
		strs[i] = string(wt)
	}
	sort.Strings(strs)
	return strings.Join(strs, "+")
}

func passivesToString(passives map[domain.PassiveType]int) string {
	if len(passives) == 0 {
		return "none"
	}
	var parts []string
	for pt, stacks := range passives {
		if stacks > 0 {
			parts = append(parts, fmt.Sprintf("%s:%d", string(pt), stacks))
		}
	}
	sort.Strings(parts)
	return strings.Join(parts, "+")
}

func parseWeaponsFromString(s string) []domain.WeaponType {
	if s == "none" {
		return nil
	}
	parts := strings.Split(s, "+")
	var weapons []domain.WeaponType
	for _, p := range parts {
		weapons = append(weapons, domain.WeaponType(p))
	}
	return weapons
}

// Ensure imports are used.
var _ = math.Pi
var _ = domain.MaxLevel
var _ = rand.Intn
