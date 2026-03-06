package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// --- Season Snapshot & Archive ---

// SeasonSnapshot captures the full world state at season end for archival.
type SeasonSnapshot struct {
	ID         string       `json:"id"`
	SeasonID   string       `json:"season_id"`
	SeasonNum  int          `json:"season_number"`
	SeasonName string       `json:"season_name"`
	CreatedAt  time.Time    `json:"created_at"`

	// Final rankings
	FactionRanking  []SeasonLeaderboardEntry `json:"faction_ranking"`
	TopPlayers      []PlayerSeasonStats      `json:"top_players"`

	// World state at season end
	CountryStates   []CountrySeasonState     `json:"country_states"`
	FactionStates   []FactionSeasonState     `json:"faction_states"`

	// Economy summary
	TotalWorldGDP   int64                    `json:"total_world_gdp"`
	ResourcePrices  map[ResourceType]float64 `json:"resource_prices"`

	// War & diplomacy stats
	TotalWars       int                      `json:"total_wars"`
	TotalSieges     int                      `json:"total_sieges"`
	TotalBattles    int                      `json:"total_battles"`

	// Map timeline data (used for 30s timelapse replay)
	MapTimeline     []MapTimelineFrame       `json:"map_timeline"`
}

// CountrySeasonState is the state of a country at season end.
type CountrySeasonState struct {
	CountryISO       string `json:"country_iso"`
	SovereignFaction string `json:"sovereign_faction"`
	SovereigntyLevel int    `json:"sovereignty_level"`
	GDP              int64  `json:"gdp"`
	IsCapital        bool   `json:"is_capital"`
}

// FactionSeasonState is the state of a faction at season end.
type FactionSeasonState struct {
	FactionID     string `json:"faction_id"`
	FactionName   string `json:"faction_name"`
	MemberCount   int    `json:"member_count"`
	TerritoryCount int   `json:"territory_count"`
	TotalGDP      int64  `json:"total_gdp"`
	Prestige      int    `json:"prestige"`
	TreasuryGold  int64  `json:"treasury_gold"`
}

// PlayerSeasonStats records a player's performance for the season.
type PlayerSeasonStats struct {
	UserID       string `json:"user_id"`
	Username     string `json:"username"`
	FactionID    string `json:"faction_id"`
	FactionName  string `json:"faction_name"`
	TotalKills   int    `json:"total_kills"`
	TotalDeaths  int    `json:"total_deaths"`
	BattleCount  int    `json:"battle_count"`
	SurvivedCount int   `json:"survived_count"`
	GoldEarned   int64  `json:"gold_earned"`
	Rank         int    `json:"rank"`
}

// MapTimelineFrame records the world sovereignty state at a point in time.
// Used to reconstruct the 30-second timelapse replay.
type MapTimelineFrame struct {
	Timestamp   int64             `json:"t"`       // Unix ms
	Sovereigns  map[string]string `json:"s"`       // countryISO → factionID
	BattleISOs  []string          `json:"b,omitempty"` // Countries with active battles
}

// --- Season Reward ---

// SeasonReward defines a reward distributed at season end.
type SeasonReward struct {
	ID          string       `json:"id"`
	SeasonID    string       `json:"season_id"`
	RecipientID string       `json:"recipient_id"` // User or Faction ID
	Type        RewardType   `json:"type"`
	Category    string       `json:"category"`      // e.g. "world_dominator", "top_10"
	Title       string       `json:"title"`          // Display name
	Description string       `json:"description"`
	Resources   ResourceBundle `json:"resources,omitempty"`
	BadgeKey    string       `json:"badge_key,omitempty"` // Permanent badge identifier
	GrantedAt   time.Time    `json:"granted_at"`
}

// RewardType categorizes season rewards.
type RewardType string

const (
	RewardTrophy   RewardType = "trophy"
	RewardTitle    RewardType = "title"
	RewardBadge    RewardType = "badge"
	RewardResource RewardType = "resource"
	RewardCosmetic RewardType = "cosmetic"
)

// --- Season Reset Engine ---

// SeasonResetEngine handles the season reset process:
//   1. Snapshot the full world state
//   2. Compute final rankings
//   3. Distribute rewards
//   4. Reset world (sovereignty, resources)
//   5. Preserve persistent data (accounts, factions, cosmetics, achievements)
type SeasonResetEngine struct {
	mu sync.RWMutex

	// External references
	seasonEngine    *SeasonEngine
	factionManager  *FactionManager
	economyEngine   *EconomyEngine

	// Archives
	snapshots       map[string]*SeasonSnapshot // seasonID → snapshot
	rewards         []SeasonReward

	// Timeline buffer: collects frames during the season for replay
	timelineBuffer  []MapTimelineFrame
	timelineMaxLen  int // Max frames to keep (default: 672 = 4 weeks * 7 days * 24 ticks/day)

	// Player stats (aggregated during the season)
	playerStats     map[string]*PlayerSeasonStats // userID → stats
}

// NewSeasonResetEngine creates a new SeasonResetEngine.
func NewSeasonResetEngine(se *SeasonEngine, fm *FactionManager, ee *EconomyEngine) *SeasonResetEngine {
	return &SeasonResetEngine{
		seasonEngine:   se,
		factionManager: fm,
		economyEngine:  ee,
		snapshots:      make(map[string]*SeasonSnapshot),
		rewards:        make([]SeasonReward, 0),
		timelineBuffer: make([]MapTimelineFrame, 0, 672),
		timelineMaxLen: 672,
		playerStats:    make(map[string]*PlayerSeasonStats),
	}
}

// --- Timeline Recording ---

// RecordTimelineFrame adds a sovereignty snapshot to the timeline buffer.
// Should be called periodically (e.g. every hour) to build the replay data.
func (sre *SeasonResetEngine) RecordTimelineFrame(sovereigns map[string]string, battleISOs []string) {
	sre.mu.Lock()
	defer sre.mu.Unlock()

	frame := MapTimelineFrame{
		Timestamp:  time.Now().UnixMilli(),
		Sovereigns: make(map[string]string, len(sovereigns)),
		BattleISOs: battleISOs,
	}
	for k, v := range sovereigns {
		frame.Sovereigns[k] = v
	}

	sre.timelineBuffer = append(sre.timelineBuffer, frame)

	// Trim if too long
	if len(sre.timelineBuffer) > sre.timelineMaxLen {
		sre.timelineBuffer = sre.timelineBuffer[len(sre.timelineBuffer)-sre.timelineMaxLen:]
	}
}

// --- Player Stat Tracking ---

// RecordPlayerBattle updates a player's season stats after a battle.
func (sre *SeasonResetEngine) RecordPlayerBattle(userID, username, factionID, factionName string, kills, deaths int, survived bool, goldEarned int64) {
	sre.mu.Lock()
	defer sre.mu.Unlock()

	stats, ok := sre.playerStats[userID]
	if !ok {
		stats = &PlayerSeasonStats{
			UserID:      userID,
			Username:    username,
			FactionID:   factionID,
			FactionName: factionName,
		}
		sre.playerStats[userID] = stats
	}

	stats.TotalKills += kills
	stats.TotalDeaths += deaths
	stats.BattleCount++
	if survived {
		stats.SurvivedCount++
	}
	stats.GoldEarned += goldEarned
	// Update faction info (player might switch factions during season)
	stats.FactionID = factionID
	stats.FactionName = factionName
}

// --- Season End Process ---

// ExecuteSeasonReset performs the full season reset process.
// This is the main entry point called when a season ends.
func (sre *SeasonResetEngine) ExecuteSeasonReset(season *Season) (*SeasonSnapshot, error) {
	sre.mu.Lock()
	defer sre.mu.Unlock()

	if season == nil {
		return nil, fmt.Errorf("no season provided")
	}

	slog.Info("executing season reset", "season", season.Name, "number", season.Number)

	// Step 1: Create snapshot
	snapshot := sre.createSnapshotLocked(season)

	// Step 2: Compute final rankings
	sre.computeFinalRankingsLocked(snapshot)

	// Step 3: Distribute rewards
	sre.distributeRewardsLocked(snapshot)

	// Step 4: Archive the snapshot
	sre.snapshots[season.ID] = snapshot

	// Step 5: Reset world state (sovereignty, resources, economy)
	sre.resetWorldStateLocked()

	// Step 6: Clear season-specific tracking data
	sre.clearSeasonDataLocked()

	slog.Info("season reset complete",
		"season", season.Name,
		"factions_ranked", len(snapshot.FactionRanking),
		"rewards_granted", len(sre.rewards),
		"timeline_frames", len(snapshot.MapTimeline),
	)

	return snapshot, nil
}

// createSnapshotLocked creates a full world state snapshot. Must hold write lock.
func (sre *SeasonResetEngine) createSnapshotLocked(season *Season) *SeasonSnapshot {
	snapshot := &SeasonSnapshot{
		ID:         uuid.New().String(),
		SeasonID:   season.ID,
		SeasonNum:  season.Number,
		SeasonName: season.Name,
		CreatedAt:  time.Now(),
	}

	// Capture country states from economy engine
	if sre.economyEngine != nil {
		economies := sre.economyEngine.GetAllEconomies()
		snapshot.CountryStates = make([]CountrySeasonState, 0, len(economies))
		var totalGDP int64
		for iso, econ := range economies {
			snapshot.CountryStates = append(snapshot.CountryStates, CountrySeasonState{
				CountryISO:       iso,
				SovereignFaction: econ.SovereignFaction,
				SovereigntyLevel: econ.SovereigntyLevel,
				GDP:              econ.GDP,
			})
			totalGDP += econ.GDP
		}
		snapshot.TotalWorldGDP = totalGDP
		snapshot.ResourcePrices = sre.economyEngine.GetMarketPrices()
	}

	// Capture faction states
	if sre.factionManager != nil {
		factions := sre.factionManager.GetAllFactions()
		snapshot.FactionStates = make([]FactionSeasonState, 0, len(factions))
		for _, f := range factions {
			snapshot.FactionStates = append(snapshot.FactionStates, FactionSeasonState{
				FactionID:      f.ID,
				FactionName:    f.Name,
				MemberCount:    f.MemberCount,
				TerritoryCount: f.TerritoryCount,
				TotalGDP:       f.TotalGDP,
				Prestige:       f.Prestige,
				TreasuryGold:   f.Treasury.Gold,
			})
		}
	}

	// Capture player stats (top 100)
	snapshot.TopPlayers = sre.getTopPlayersLocked(100)

	// Capture map timeline
	snapshot.MapTimeline = make([]MapTimelineFrame, len(sre.timelineBuffer))
	copy(snapshot.MapTimeline, sre.timelineBuffer)

	return snapshot
}

// getTopPlayersLocked returns top N players sorted by gold earned. Must hold lock.
func (sre *SeasonResetEngine) getTopPlayersLocked(limit int) []PlayerSeasonStats {
	players := make([]PlayerSeasonStats, 0, len(sre.playerStats))
	for _, stats := range sre.playerStats {
		players = append(players, *stats)
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].GoldEarned > players[j].GoldEarned
	})

	for i := range players {
		players[i].Rank = i + 1
	}

	if len(players) > limit {
		players = players[:limit]
	}
	return players
}

// computeFinalRankingsLocked computes faction rankings from the snapshot data.
func (sre *SeasonResetEngine) computeFinalRankingsLocked(snapshot *SeasonSnapshot) {
	// Aggregate faction data from snapshot
	factionGDPs := make(map[string]int64)
	factionCountries := make(map[string]int)

	for _, cs := range snapshot.CountryStates {
		if cs.SovereignFaction != "" {
			factionGDPs[cs.SovereignFaction] += cs.GDP
			factionCountries[cs.SovereignFaction]++
		}
	}

	// Build entries from faction states
	entries := make([]SeasonLeaderboardEntry, 0, len(snapshot.FactionStates))
	for _, fs := range snapshot.FactionStates {
		entry := SeasonLeaderboardEntry{
			FactionID:   fs.FactionID,
			FactionName: fs.FactionName,
			Countries:   factionCountries[fs.FactionID],
			TotalGDP:    factionGDPs[fs.FactionID],
		}
		// Score formula: (countries * 100) + (GDP / 1000) + (prestige * 10)
		entry.Score = int64(entry.Countries)*100 +
			entry.TotalGDP/1000 +
			int64(fs.Prestige)*10

		entries = append(entries, entry)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Score > entries[j].Score
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}

	snapshot.FactionRanking = entries
}

// distributeRewardsLocked creates and distributes season rewards.
func (sre *SeasonResetEngine) distributeRewardsLocked(snapshot *SeasonSnapshot) {
	seasonID := snapshot.SeasonID
	now := time.Now()

	// 1st place faction — Golden Globe
	if len(snapshot.FactionRanking) >= 1 {
		first := snapshot.FactionRanking[0]
		sre.rewards = append(sre.rewards, SeasonReward{
			ID:          uuid.New().String(),
			SeasonID:    seasonID,
			RecipientID: first.FactionID,
			Type:        RewardTrophy,
			Category:    "world_dominator",
			Title:       "Golden Globe",
			Description: fmt.Sprintf("Season %d Champion — %s", snapshot.SeasonNum, first.FactionName),
			Resources:   ResourceBundle{Gold: 50000},
			BadgeKey:    fmt.Sprintf("golden_globe_s%d", snapshot.SeasonNum),
			GrantedAt:   now,
		})
	}

	// 2nd place faction — Silver Globe
	if len(snapshot.FactionRanking) >= 2 {
		second := snapshot.FactionRanking[1]
		sre.rewards = append(sre.rewards, SeasonReward{
			ID:          uuid.New().String(),
			SeasonID:    seasonID,
			RecipientID: second.FactionID,
			Type:        RewardTrophy,
			Category:    "runner_up",
			Title:       "Silver Globe",
			Description: fmt.Sprintf("Season %d Runner-up — %s", snapshot.SeasonNum, second.FactionName),
			Resources:   ResourceBundle{Gold: 25000},
			BadgeKey:    fmt.Sprintf("silver_globe_s%d", snapshot.SeasonNum),
			GrantedAt:   now,
		})
	}

	// 3rd place faction — Bronze Globe
	if len(snapshot.FactionRanking) >= 3 {
		third := snapshot.FactionRanking[2]
		sre.rewards = append(sre.rewards, SeasonReward{
			ID:          uuid.New().String(),
			SeasonID:    seasonID,
			RecipientID: third.FactionID,
			Type:        RewardTrophy,
			Category:    "third_place",
			Title:       "Bronze Globe",
			Description: fmt.Sprintf("Season %d Third — %s", snapshot.SeasonNum, third.FactionName),
			Resources:   ResourceBundle{Gold: 10000},
			BadgeKey:    fmt.Sprintf("bronze_globe_s%d", snapshot.SeasonNum),
			GrantedAt:   now,
		})
	}

	// Top players get title badges
	for _, player := range snapshot.TopPlayers {
		if player.Rank > 10 {
			break
		}
		sre.rewards = append(sre.rewards, SeasonReward{
			ID:          uuid.New().String(),
			SeasonID:    seasonID,
			RecipientID: player.UserID,
			Type:        RewardBadge,
			Category:    fmt.Sprintf("top_%d", player.Rank),
			Title:       fmt.Sprintf("Season %d Top %d", snapshot.SeasonNum, player.Rank),
			Description: fmt.Sprintf("Ranked #%d in Season %d", player.Rank, snapshot.SeasonNum),
			BadgeKey:    fmt.Sprintf("top%d_s%d", player.Rank, snapshot.SeasonNum),
			GrantedAt:   now,
		})
	}

	// Economy superpower — highest GDP faction
	if len(snapshot.FactionRanking) > 0 {
		// Find the faction with highest GDP (not necessarily same as rank 1)
		bestGDP := snapshot.FactionRanking[0]
		for _, entry := range snapshot.FactionRanking {
			if entry.TotalGDP > bestGDP.TotalGDP {
				bestGDP = entry
			}
		}
		sre.rewards = append(sre.rewards, SeasonReward{
			ID:          uuid.New().String(),
			SeasonID:    seasonID,
			RecipientID: bestGDP.FactionID,
			Type:        RewardTitle,
			Category:    "economic_superpower",
			Title:       "Economic Superpower",
			Description: fmt.Sprintf("Highest GDP in Season %d — %s", snapshot.SeasonNum, bestGDP.FactionName),
			BadgeKey:    fmt.Sprintf("econ_superpower_s%d", snapshot.SeasonNum),
			GrantedAt:   now,
		})
	}

	slog.Info("season rewards distributed", "count", len(sre.rewards), "season", snapshot.SeasonName)
}

// resetWorldStateLocked resets transient world state for new season.
// Preserved: accounts, factions (structure), cosmetics, achievements.
// Reset: sovereignty, resources, GDP, economy policies, diplomacy.
func (sre *SeasonResetEngine) resetWorldStateLocked() {
	// Reset economy: clear stockpiles, GDP, reset policies to defaults
	if sre.economyEngine != nil {
		economies := sre.economyEngine.GetAllEconomies()
		for iso := range economies {
			// Reset sovereignty on each country (clears faction ownership)
			sre.economyEngine.UpdateSovereignty(iso, "", 0)

			// Reset stockpile and GDP via re-initialization will be handled
			// by the next season's economy engine restart
		}
		slog.Info("economy state reset", "countries", len(economies))
	}

	// Reset faction treasury and prestige (structure preserved)
	if sre.factionManager != nil {
		factions := sre.factionManager.GetAllFactions()
		for _, f := range factions {
			sre.factionManager.ResetFactionForNewSeason(f.ID)
		}
		slog.Info("faction treasuries reset", "factions", len(factions))
	}
}

// clearSeasonDataLocked resets tracking data for the next season. Must hold lock.
func (sre *SeasonResetEngine) clearSeasonDataLocked() {
	sre.timelineBuffer = sre.timelineBuffer[:0]
	sre.playerStats = make(map[string]*PlayerSeasonStats)
}

// --- Queries ---

// GetSnapshot returns the snapshot for a season.
func (sre *SeasonResetEngine) GetSnapshot(seasonID string) *SeasonSnapshot {
	sre.mu.RLock()
	defer sre.mu.RUnlock()

	snapshot, ok := sre.snapshots[seasonID]
	if !ok {
		return nil
	}
	return snapshot
}

// GetAllSnapshots returns all archived season snapshots.
func (sre *SeasonResetEngine) GetAllSnapshots() []*SeasonSnapshot {
	sre.mu.RLock()
	defer sre.mu.RUnlock()

	result := make([]*SeasonSnapshot, 0, len(sre.snapshots))
	for _, s := range sre.snapshots {
		result = append(result, s)
	}

	// Sort by season number
	sort.Slice(result, func(i, j int) bool {
		return result[i].SeasonNum < result[j].SeasonNum
	})
	return result
}

// GetRewards returns all rewards for a season.
func (sre *SeasonResetEngine) GetRewards(seasonID string) []SeasonReward {
	sre.mu.RLock()
	defer sre.mu.RUnlock()

	var result []SeasonReward
	for _, r := range sre.rewards {
		if r.SeasonID == seasonID {
			result = append(result, r)
		}
	}
	return result
}

// GetUserRewards returns all rewards for a specific user across all seasons.
func (sre *SeasonResetEngine) GetUserRewards(userID string) []SeasonReward {
	sre.mu.RLock()
	defer sre.mu.RUnlock()

	var result []SeasonReward
	for _, r := range sre.rewards {
		if r.RecipientID == userID {
			result = append(result, r)
		}
	}
	return result
}

// GetTimeline returns the current season's timeline buffer.
func (sre *SeasonResetEngine) GetTimeline() []MapTimelineFrame {
	sre.mu.RLock()
	defer sre.mu.RUnlock()

	result := make([]MapTimelineFrame, len(sre.timelineBuffer))
	copy(result, sre.timelineBuffer)
	return result
}

// --- HTTP API ---

// SeasonResetRoutes returns a chi.Router with season reset/archive HTTP endpoints.
func (sre *SeasonResetEngine) SeasonResetRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/snapshots", sre.handleListSnapshots)
	r.Get("/snapshots/{seasonID}", sre.handleGetSnapshot)
	r.Get("/snapshots/{seasonID}/ranking", sre.handleGetRanking)
	r.Get("/snapshots/{seasonID}/rewards", sre.handleGetRewards)
	r.Get("/snapshots/{seasonID}/timeline", sre.handleGetTimeline)
	r.Get("/rewards/user/{userID}", sre.handleGetUserRewards)

	return r
}

// handleListSnapshots — GET /api/seasons/archive/snapshots
func (sre *SeasonResetEngine) handleListSnapshots(w http.ResponseWriter, r *http.Request) {
	snapshots := sre.GetAllSnapshots()

	// Return lightweight list (no full data)
	type snapshotListItem struct {
		ID         string `json:"id"`
		SeasonID   string `json:"season_id"`
		SeasonNum  int    `json:"season_number"`
		SeasonName string `json:"season_name"`
		CreatedAt  string `json:"created_at"`
		TotalGDP   int64  `json:"total_world_gdp"`
		Factions   int    `json:"faction_count"`
		Countries  int    `json:"country_count"`
	}

	items := make([]snapshotListItem, 0, len(snapshots))
	for _, s := range snapshots {
		items = append(items, snapshotListItem{
			ID:         s.ID,
			SeasonID:   s.SeasonID,
			SeasonNum:  s.SeasonNum,
			SeasonName: s.SeasonName,
			CreatedAt:  s.CreatedAt.Format(time.RFC3339),
			TotalGDP:   s.TotalWorldGDP,
			Factions:   len(s.FactionStates),
			Countries:  len(s.CountryStates),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"snapshots": items,
		"count":     len(items),
	})
}

// handleGetSnapshot — GET /api/seasons/archive/snapshots/{seasonID}
func (sre *SeasonResetEngine) handleGetSnapshot(w http.ResponseWriter, r *http.Request) {
	seasonID := chi.URLParam(r, "seasonID")
	snapshot := sre.GetSnapshot(seasonID)
	if snapshot == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "snapshot not found"})
		return
	}

	// Return without timeline data to save bandwidth (use /timeline endpoint)
	type snapshotResponse struct {
		ID              string                   `json:"id"`
		SeasonID        string                   `json:"season_id"`
		SeasonNum       int                      `json:"season_number"`
		SeasonName      string                   `json:"season_name"`
		CreatedAt       time.Time                `json:"created_at"`
		FactionRanking  []SeasonLeaderboardEntry `json:"faction_ranking"`
		TopPlayers      []PlayerSeasonStats      `json:"top_players"`
		CountryStates   []CountrySeasonState     `json:"country_states"`
		FactionStates   []FactionSeasonState     `json:"faction_states"`
		TotalWorldGDP   int64                    `json:"total_world_gdp"`
		TotalWars       int                      `json:"total_wars"`
		TotalSieges     int                      `json:"total_sieges"`
		TimelineFrames  int                      `json:"timeline_frames"`
	}

	resp := snapshotResponse{
		ID:             snapshot.ID,
		SeasonID:       snapshot.SeasonID,
		SeasonNum:      snapshot.SeasonNum,
		SeasonName:     snapshot.SeasonName,
		CreatedAt:      snapshot.CreatedAt,
		FactionRanking: snapshot.FactionRanking,
		TopPlayers:     snapshot.TopPlayers,
		CountryStates:  snapshot.CountryStates,
		FactionStates:  snapshot.FactionStates,
		TotalWorldGDP:  snapshot.TotalWorldGDP,
		TotalWars:      snapshot.TotalWars,
		TotalSieges:    snapshot.TotalSieges,
		TimelineFrames: len(snapshot.MapTimeline),
	}

	writeJSON(w, http.StatusOK, resp)
}

// handleGetRanking — GET /api/seasons/archive/snapshots/{seasonID}/ranking
func (sre *SeasonResetEngine) handleGetRanking(w http.ResponseWriter, r *http.Request) {
	seasonID := chi.URLParam(r, "seasonID")
	snapshot := sre.GetSnapshot(seasonID)
	if snapshot == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "snapshot not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"faction_ranking": snapshot.FactionRanking,
		"top_players":     snapshot.TopPlayers,
	})
}

// handleGetRewards — GET /api/seasons/archive/snapshots/{seasonID}/rewards
func (sre *SeasonResetEngine) handleGetRewards(w http.ResponseWriter, r *http.Request) {
	seasonID := chi.URLParam(r, "seasonID")
	rewards := sre.GetRewards(seasonID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rewards": rewards,
		"count":   len(rewards),
	})
}

// handleGetTimeline — GET /api/seasons/archive/snapshots/{seasonID}/timeline
func (sre *SeasonResetEngine) handleGetTimeline(w http.ResponseWriter, r *http.Request) {
	seasonID := chi.URLParam(r, "seasonID")
	snapshot := sre.GetSnapshot(seasonID)
	if snapshot == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "snapshot not found"})
		return
	}

	// Return compact timeline for the 30s timelapse replay
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"timeline": snapshot.MapTimeline,
		"frames":   len(snapshot.MapTimeline),
		"season":   snapshot.SeasonName,
	})
}

// handleGetUserRewards — GET /api/seasons/archive/rewards/user/{userID}
func (sre *SeasonResetEngine) handleGetUserRewards(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	rewards := sre.GetUserRewards(userID)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id": userID,
		"rewards": rewards,
		"count":   len(rewards),
	})
}

// --- Helpers for FactionManager ---

// We need to add ResetFactionForNewSeason to FactionManager (non-breaking addition).

// Ensure JSON encoding works for MapTimelineFrame.
var _ json.Marshaler // Just to ensure json package is used

// ResetFactionForNewSeason resets a faction's treasury and prestige for a new season.
// Preserves: membership, hierarchy, name, color, banner.
func (fm *FactionManager) ResetFactionForNewSeason(factionID string) {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	faction, ok := fm.factions[factionID]
	if !ok {
		return
	}

	faction.Treasury = ResourceBundle{}
	faction.Prestige = 0
	faction.TerritoryCount = 0
	faction.TotalGDP = 0

	slog.Info("faction reset for new season",
		"id", factionID,
		"name", faction.Name,
		"members_preserved", faction.MemberCount,
	)
}
