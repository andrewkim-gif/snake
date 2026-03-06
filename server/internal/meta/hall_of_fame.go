package meta

import (
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// --- Hall of Fame Categories ---

// HallOfFameCategory identifies the 7 award categories.
type HallOfFameCategory string

const (
	HOFWorldDominator    HallOfFameCategory = "world_dominator"
	HOFEconomicSuperpower HallOfFameCategory = "economic_superpower"
	HOFWarMachine        HallOfFameCategory = "war_machine"
	HOFPeacekeeper       HallOfFameCategory = "peacekeeper"
	HOFEmperor           HallOfFameCategory = "emperor"
	HOFBestAgent         HallOfFameCategory = "best_agent"
	HOFHistorian         HallOfFameCategory = "historian"
)

// AllHOFCategories lists all Hall of Fame categories.
var AllHOFCategories = []HallOfFameCategory{
	HOFWorldDominator, HOFEconomicSuperpower, HOFWarMachine,
	HOFPeacekeeper, HOFEmperor, HOFBestAgent, HOFHistorian,
}

// HOFCategoryInfo provides display metadata for a category.
type HOFCategoryInfo struct {
	Category    HallOfFameCategory `json:"category"`
	DisplayName string             `json:"display_name"`
	Icon        string             `json:"icon"`
	Description string             `json:"description"`
}

// HOFCategoryDetails maps each category to its display metadata.
var HOFCategoryDetails = map[HallOfFameCategory]HOFCategoryInfo{
	HOFWorldDominator: {
		Category:    HOFWorldDominator,
		DisplayName: "World Dominator",
		Icon:        "trophy",
		Description: "Most countries controlled at season end",
	},
	HOFEconomicSuperpower: {
		Category:    HOFEconomicSuperpower,
		DisplayName: "Economic Superpower",
		Icon:        "coin",
		Description: "Highest total GDP at season end",
	},
	HOFWarMachine: {
		Category:    HOFWarMachine,
		DisplayName: "War Machine",
		Icon:        "sword",
		Description: "Most siege victories in the season",
	},
	HOFPeacekeeper: {
		Category:    HOFPeacekeeper,
		DisplayName: "Peacekeeper",
		Icon:        "shield",
		Description: "Longest consecutive period without war while holding territory",
	},
	HOFEmperor: {
		Category:    HOFEmperor,
		DisplayName: "Emperor",
		Icon:        "crown",
		Description: "Most S-tier countries controlled simultaneously",
	},
	HOFBestAgent: {
		Category:    HOFBestAgent,
		DisplayName: "Best Agent",
		Icon:        "star",
		Description: "Top individual agent by kills and survival",
	},
	HOFHistorian: {
		Category:    HOFHistorian,
		DisplayName: "Historian",
		Icon:        "book",
		Description: "Most country names changed (cultural influence)",
	},
}

// --- Hall of Fame Entry ---

// HallOfFameEntry records a winner in a specific category for a season.
type HallOfFameEntry struct {
	ID           string             `json:"id"`
	SeasonID     string             `json:"season_id"`
	SeasonNumber int                `json:"season_number"`
	SeasonName   string             `json:"season_name"`
	Category     HallOfFameCategory `json:"category"`

	// Winner info
	WinnerID     string `json:"winner_id"`   // Faction ID or User ID
	WinnerName   string `json:"winner_name"`
	WinnerType   string `json:"winner_type"` // "faction" or "player"
	LeaderName   string `json:"leader_name,omitempty"` // For faction winners

	// Achievement data
	RecordValue  int64  `json:"record_value"`      // The numerical record (countries, GDP, etc.)
	RecordLabel  string `json:"record_label"`       // Human-readable label

	// Trophy & badge
	TrophyType   string `json:"trophy_type"`        // "gold", "silver", "bronze"
	BadgeKey     string `json:"badge_key"`           // Permanent badge identifier

	// Timestamps
	AwardedAt    time.Time `json:"awarded_at"`
}

// --- Hall of Fame Engine ---

// HallOfFameEngine manages the permanent hall of fame records.
type HallOfFameEngine struct {
	mu sync.RWMutex

	// All entries, keyed by seasonID for efficient lookup
	entries     map[string][]HallOfFameEntry // seasonID → entries
	allEntries  []HallOfFameEntry            // Flat list for cross-season queries

	// External references
	seasonResetEngine *SeasonResetEngine
}

// NewHallOfFameEngine creates a new HallOfFameEngine.
func NewHallOfFameEngine(sre *SeasonResetEngine) *HallOfFameEngine {
	return &HallOfFameEngine{
		entries:           make(map[string][]HallOfFameEntry),
		allEntries:        make([]HallOfFameEntry, 0),
		seasonResetEngine: sre,
	}
}

// RecordSeasonWinners extracts winners from a season snapshot and records them.
// This should be called after ExecuteSeasonReset.
func (hof *HallOfFameEngine) RecordSeasonWinners(snapshot *SeasonSnapshot) error {
	if snapshot == nil {
		return fmt.Errorf("nil snapshot")
	}

	hof.mu.Lock()
	defer hof.mu.Unlock()

	now := time.Now()
	var entries []HallOfFameEntry

	// 1. World Dominator — most countries controlled
	if winner := hof.findWorldDominator(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFWorldDominator, *winner, now))
	}

	// 2. Economic Superpower — highest GDP
	if winner := hof.findEconomicSuperpower(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFEconomicSuperpower, *winner, now))
	}

	// 3. War Machine — most siege wins (from faction ranking scores)
	if winner := hof.findWarMachine(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFWarMachine, *winner, now))
	}

	// 4. Peacekeeper — faction with most territory held without war
	if winner := hof.findPeacekeeper(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFPeacekeeper, *winner, now))
	}

	// 5. Emperor — most S-tier countries
	if winner := hof.findEmperor(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFEmperor, *winner, now))
	}

	// 6. Best Agent — top individual player
	if winner := hof.findBestAgent(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFBestAgent, *winner, now))
	}

	// 7. Historian — most country name changes (tracked as prestige-equivalent)
	if winner := hof.findHistorian(snapshot); winner != nil {
		entries = append(entries, hof.buildEntry(snapshot, HOFHistorian, *winner, now))
	}

	hof.entries[snapshot.SeasonID] = entries
	hof.allEntries = append(hof.allEntries, entries...)

	slog.Info("hall of fame recorded",
		"season", snapshot.SeasonName,
		"entries", len(entries),
	)

	return nil
}

// --- Winner Detection ---

type winnerCandidate struct {
	id         string
	name       string
	winnerType string // "faction" or "player"
	leaderName string
	value      int64
	label      string
}

func (hof *HallOfFameEngine) findWorldDominator(snapshot *SeasonSnapshot) *winnerCandidate {
	if len(snapshot.FactionRanking) == 0 {
		return nil
	}
	top := snapshot.FactionRanking[0]
	return &winnerCandidate{
		id:         top.FactionID,
		name:       top.FactionName,
		winnerType: "faction",
		value:      int64(top.Countries),
		label:      fmt.Sprintf("%d countries", top.Countries),
	}
}

func (hof *HallOfFameEngine) findEconomicSuperpower(snapshot *SeasonSnapshot) *winnerCandidate {
	var best *SeasonLeaderboardEntry
	for i := range snapshot.FactionRanking {
		if best == nil || snapshot.FactionRanking[i].TotalGDP > best.TotalGDP {
			best = &snapshot.FactionRanking[i]
		}
	}
	if best == nil {
		return nil
	}
	return &winnerCandidate{
		id:         best.FactionID,
		name:       best.FactionName,
		winnerType: "faction",
		value:      best.TotalGDP,
		label:      fmt.Sprintf("GDP %d", best.TotalGDP),
	}
}

func (hof *HallOfFameEngine) findWarMachine(snapshot *SeasonSnapshot) *winnerCandidate {
	var best *SeasonLeaderboardEntry
	for i := range snapshot.FactionRanking {
		entry := &snapshot.FactionRanking[i]
		if best == nil || entry.SiegeWins > best.SiegeWins {
			best = entry
		}
	}
	if best == nil || best.SiegeWins == 0 {
		return nil
	}
	return &winnerCandidate{
		id:         best.FactionID,
		name:       best.FactionName,
		winnerType: "faction",
		value:      int64(best.SiegeWins),
		label:      fmt.Sprintf("%d siege victories", best.SiegeWins),
	}
}

func (hof *HallOfFameEngine) findPeacekeeper(snapshot *SeasonSnapshot) *winnerCandidate {
	// Peacekeeper: faction with most territory + lowest war involvement
	// Approximated by: territory_count * prestige / (siege_wins + 1)
	var best *FactionSeasonState
	var bestScore float64

	for i := range snapshot.FactionStates {
		fs := &snapshot.FactionStates[i]
		if fs.TerritoryCount == 0 {
			continue
		}
		// Find this faction's siege wins
		siegeWins := 0
		for _, entry := range snapshot.FactionRanking {
			if entry.FactionID == fs.FactionID {
				siegeWins = entry.SiegeWins
				break
			}
		}
		score := float64(fs.TerritoryCount) * float64(fs.Prestige+1) / float64(siegeWins+1)
		if best == nil || score > bestScore {
			best = fs
			bestScore = score
		}
	}
	if best == nil {
		return nil
	}
	return &winnerCandidate{
		id:         best.FactionID,
		name:       best.FactionName,
		winnerType: "faction",
		value:      int64(best.TerritoryCount),
		label:      fmt.Sprintf("%d territories held peacefully", best.TerritoryCount),
	}
}

func (hof *HallOfFameEngine) findEmperor(snapshot *SeasonSnapshot) *winnerCandidate {
	// Count S-tier countries per faction
	// We check sovereignty level via CountryStates; S-tier identified by tier
	// Since CountrySeasonState doesn't store tier, we use the ranking data.
	// For now, use the faction with most countries as proxy.
	if len(snapshot.FactionRanking) == 0 {
		return nil
	}
	// Emperor is different from World Dominator: focused on S-tier countries.
	// Without explicit tier data in the snapshot, we give this to the
	// faction with the highest score (which heavily weights country count + GDP).
	top := snapshot.FactionRanking[0]
	return &winnerCandidate{
		id:         top.FactionID,
		name:       top.FactionName,
		winnerType: "faction",
		value:      top.Score,
		label:      fmt.Sprintf("Score %d", top.Score),
	}
}

func (hof *HallOfFameEngine) findBestAgent(snapshot *SeasonSnapshot) *winnerCandidate {
	if len(snapshot.TopPlayers) == 0 {
		return nil
	}
	top := snapshot.TopPlayers[0]
	return &winnerCandidate{
		id:         top.UserID,
		name:       top.Username,
		winnerType: "player",
		value:      int64(top.TotalKills),
		label:      fmt.Sprintf("%d kills, %d survived", top.TotalKills, top.SurvivedCount),
	}
}

func (hof *HallOfFameEngine) findHistorian(snapshot *SeasonSnapshot) *winnerCandidate {
	// Historian: most cultural influence.
	// Approximated by prestige * territory_count for now.
	var best *FactionSeasonState
	var bestScore int64

	for i := range snapshot.FactionStates {
		fs := &snapshot.FactionStates[i]
		score := int64(fs.Prestige) * int64(fs.TerritoryCount+1)
		if best == nil || score > bestScore {
			best = fs
			bestScore = score
		}
	}
	if best == nil {
		return nil
	}
	return &winnerCandidate{
		id:         best.FactionID,
		name:       best.FactionName,
		winnerType: "faction",
		value:      bestScore,
		label:      fmt.Sprintf("Cultural score %d", bestScore),
	}
}

// buildEntry constructs a HallOfFameEntry from a winner candidate.
func (hof *HallOfFameEngine) buildEntry(snapshot *SeasonSnapshot, category HallOfFameCategory, winner winnerCandidate, now time.Time) HallOfFameEntry {
	return HallOfFameEntry{
		ID:           uuid.New().String(),
		SeasonID:     snapshot.SeasonID,
		SeasonNumber: snapshot.SeasonNum,
		SeasonName:   snapshot.SeasonName,
		Category:     category,
		WinnerID:     winner.id,
		WinnerName:   winner.name,
		WinnerType:   winner.winnerType,
		LeaderName:   winner.leaderName,
		RecordValue:  winner.value,
		RecordLabel:  winner.label,
		TrophyType:   "gold",
		BadgeKey:     fmt.Sprintf("hof_%s_s%d", category, snapshot.SeasonNum),
		AwardedAt:    now,
	}
}

// --- Queries ---

// GetSeasonEntries returns all Hall of Fame entries for a specific season.
func (hof *HallOfFameEngine) GetSeasonEntries(seasonID string) []HallOfFameEntry {
	hof.mu.RLock()
	defer hof.mu.RUnlock()

	entries, ok := hof.entries[seasonID]
	if !ok {
		return nil
	}
	result := make([]HallOfFameEntry, len(entries))
	copy(result, entries)
	return result
}

// GetCategoryHistory returns all winners for a specific category across all seasons.
func (hof *HallOfFameEngine) GetCategoryHistory(category HallOfFameCategory) []HallOfFameEntry {
	hof.mu.RLock()
	defer hof.mu.RUnlock()

	var result []HallOfFameEntry
	for _, entry := range hof.allEntries {
		if entry.Category == category {
			result = append(result, entry)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].SeasonNumber > result[j].SeasonNumber // Most recent first
	})
	return result
}

// GetAllEntries returns all Hall of Fame entries, sorted by season number descending.
func (hof *HallOfFameEngine) GetAllEntries() []HallOfFameEntry {
	hof.mu.RLock()
	defer hof.mu.RUnlock()

	result := make([]HallOfFameEntry, len(hof.allEntries))
	copy(result, hof.allEntries)

	sort.Slice(result, func(i, j int) bool {
		if result[i].SeasonNumber != result[j].SeasonNumber {
			return result[i].SeasonNumber > result[j].SeasonNumber
		}
		return result[i].Category < result[j].Category
	})
	return result
}

// GetWinnerEntries returns all entries where a specific faction or player won.
func (hof *HallOfFameEngine) GetWinnerEntries(winnerID string) []HallOfFameEntry {
	hof.mu.RLock()
	defer hof.mu.RUnlock()

	var result []HallOfFameEntry
	for _, entry := range hof.allEntries {
		if entry.WinnerID == winnerID {
			result = append(result, entry)
		}
	}
	return result
}

// GetSeasonNumbers returns all season numbers that have entries.
func (hof *HallOfFameEngine) GetSeasonNumbers() []int {
	hof.mu.RLock()
	defer hof.mu.RUnlock()

	seen := make(map[int]bool)
	for _, entry := range hof.allEntries {
		seen[entry.SeasonNumber] = true
	}

	numbers := make([]int, 0, len(seen))
	for n := range seen {
		numbers = append(numbers, n)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(numbers)))
	return numbers
}

// --- HTTP API ---

// HallOfFameRoutes returns a chi.Router with Hall of Fame HTTP endpoints.
func (hof *HallOfFameEngine) HallOfFameRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", hof.handleGetAll)
	r.Get("/categories", hof.handleGetCategories)
	r.Get("/season/{seasonID}", hof.handleGetBySeason)
	r.Get("/category/{category}", hof.handleGetByCategory)
	r.Get("/winner/{winnerID}", hof.handleGetByWinner)
	r.Get("/seasons", hof.handleGetSeasonList)

	return r
}

// handleGetAll — GET /api/hall-of-fame
func (hof *HallOfFameEngine) handleGetAll(w http.ResponseWriter, r *http.Request) {
	entries := hof.GetAllEntries()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"entries": entries,
		"count":   len(entries),
	})
}

// handleGetCategories — GET /api/hall-of-fame/categories
func (hof *HallOfFameEngine) handleGetCategories(w http.ResponseWriter, r *http.Request) {
	categories := make([]HOFCategoryInfo, 0, len(AllHOFCategories))
	for _, cat := range AllHOFCategories {
		if info, ok := HOFCategoryDetails[cat]; ok {
			categories = append(categories, info)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"categories": categories,
	})
}

// handleGetBySeason — GET /api/hall-of-fame/season/{seasonID}
func (hof *HallOfFameEngine) handleGetBySeason(w http.ResponseWriter, r *http.Request) {
	seasonID := chi.URLParam(r, "seasonID")
	entries := hof.GetSeasonEntries(seasonID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"season_id": seasonID,
		"entries":   entries,
		"count":     len(entries),
	})
}

// handleGetByCategory — GET /api/hall-of-fame/category/{category}
func (hof *HallOfFameEngine) handleGetByCategory(w http.ResponseWriter, r *http.Request) {
	category := HallOfFameCategory(chi.URLParam(r, "category"))
	entries := hof.GetCategoryHistory(category)

	info, ok := HOFCategoryDetails[category]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown category"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"category": info,
		"entries":  entries,
		"count":    len(entries),
	})
}

// handleGetByWinner — GET /api/hall-of-fame/winner/{winnerID}
func (hof *HallOfFameEngine) handleGetByWinner(w http.ResponseWriter, r *http.Request) {
	winnerID := chi.URLParam(r, "winnerID")
	entries := hof.GetWinnerEntries(winnerID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"winner_id": winnerID,
		"entries":   entries,
		"count":     len(entries),
	})
}

// handleGetSeasonList — GET /api/hall-of-fame/seasons
func (hof *HallOfFameEngine) handleGetSeasonList(w http.ResponseWriter, r *http.Request) {
	seasons := hof.GetSeasonNumbers()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"seasons": seasons,
		"count":   len(seasons),
	})
}
