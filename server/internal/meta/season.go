package meta

import (
	"context"
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

// --- Era & Season Constants ---

// Era represents the four phases of a season.
type Era string

const (
	EraDiscovery  Era = "discovery"  // Week 1: Age of Discovery — no wars, diplomacy only
	EraExpansion  Era = "expansion"  // Week 2: Age of Expansion — border skirmishes, war cost x2
	EraEmpires    Era = "empires"    // Week 3: Age of Empires — normal war costs, capital siege
	EraReckoning  Era = "reckoning"  // Week 4: Age of Reckoning — final rush, 3min battle cycle
)

// SeasonStatus tracks the lifecycle state of a season.
type SeasonStatus string

const (
	SeasonStatusScheduled SeasonStatus = "scheduled"
	SeasonStatusActive    SeasonStatus = "active"
	SeasonStatusEnding    SeasonStatus = "ending"
	SeasonStatusEnded     SeasonStatus = "ended"
	SeasonStatusArchived  SeasonStatus = "archived"
)

// EraRule defines gameplay rules that change per era.
type EraRule struct {
	Era              Era     `json:"era"`
	DisplayName      string  `json:"display_name"`
	Description      string  `json:"description"`
	WarAllowed       bool    `json:"war_allowed"`
	WarCostMult      float64 `json:"war_cost_multiplier"`    // Multiplier for war declaration cost
	BorderSkirmish   bool    `json:"border_skirmish_enabled"`
	CapitalSiege     bool    `json:"capital_siege_enabled"`
	BattleCycleSec   int     `json:"battle_cycle_seconds"`   // Battle cycle duration in seconds
	ResourceMult     float64 `json:"resource_multiplier"`    // Bonus/penalty on resource production
	UNCouncilActive  bool    `json:"un_council_active"`
	FinalRush        bool    `json:"final_rush"`             // Whether final rush mode is on
}

// EraSequence defines the order eras progress through.
var EraSequence = []Era{
	EraDiscovery, EraExpansion, EraEmpires, EraReckoning,
}

// DefaultEraRules returns the standard era rules per the v11 design.
func DefaultEraRules() map[Era]EraRule {
	return map[Era]EraRule{
		EraDiscovery: {
			Era:             EraDiscovery,
			DisplayName:     "Age of Discovery",
			Description:     "Explore and claim unclaimed countries. No wars allowed — diplomacy only.",
			WarAllowed:      false,
			WarCostMult:     0, // N/A
			BorderSkirmish:  false,
			CapitalSiege:    false,
			BattleCycleSec:  300, // 5 minutes
			ResourceMult:    1.0,
			UNCouncilActive: false,
			FinalRush:       false,
		},
		EraExpansion: {
			Era:             EraExpansion,
			DisplayName:     "Age of Expansion",
			Description:     "Border skirmishes begin. War declarations cost double.",
			WarAllowed:      true,
			WarCostMult:     2.0,
			BorderSkirmish:  true,
			CapitalSiege:    false,
			BattleCycleSec:  300,
			ResourceMult:    1.0,
			UNCouncilActive: false,
			FinalRush:       false,
		},
		EraEmpires: {
			Era:             EraEmpires,
			DisplayName:     "Age of Empires",
			Description:     "Full warfare enabled. Capital sieges unlocked. UN Council votes begin.",
			WarAllowed:      true,
			WarCostMult:     1.0,
			BorderSkirmish:  true,
			CapitalSiege:    true,
			BattleCycleSec:  300,
			ResourceMult:    1.0,
			UNCouncilActive: true,
			FinalRush:       false,
		},
		EraReckoning: {
			Era:             EraReckoning,
			DisplayName:     "Age of Reckoning",
			Description:     "Final rankings race. Last 72 hours: Final Rush — battle cycle shortened to 3 minutes.",
			WarAllowed:      true,
			WarCostMult:     0.5, // Cheaper wars to encourage conflict
			BorderSkirmish:  true,
			CapitalSiege:    true,
			BattleCycleSec:  300, // Becomes 180 during Final Rush
			ResourceMult:    1.2, // Slightly boosted resources for finale
			UNCouncilActive: true,
			FinalRush:       false, // Activated in last 72h only
		},
	}
}

// --- Season ---

// Season represents a monthly game season.
type Season struct {
	ID          string       `json:"id"`
	Number      int          `json:"number"`          // Season number (1, 2, 3...)
	Name        string       `json:"name"`            // e.g. "Era of Steel"
	Theme       string       `json:"theme"`           // Theme identifier
	Status      SeasonStatus `json:"status"`
	CurrentEra  Era          `json:"current_era"`

	// Timing
	StartAt     time.Time    `json:"start_at"`
	EndAt       time.Time    `json:"end_at"`
	EraStartAt  time.Time    `json:"era_start_at"`     // When current era started
	FinalRushAt time.Time    `json:"final_rush_at"`    // When Final Rush begins (72h before end)

	// Era schedule (computed from start/end)
	EraSchedule map[Era]EraWindow `json:"era_schedule"`

	// Metadata
	CreatedAt   time.Time    `json:"created_at"`
}

// EraWindow defines the start and end time for an era within a season.
type EraWindow struct {
	Era     Era       `json:"era"`
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
}

// SeasonConfig holds configuration for the season engine.
type SeasonConfig struct {
	SeasonDuration   time.Duration // Total season duration (default: 4 weeks / 28 days)
	FinalRushHours   int           // Hours before season end to start Final Rush (default: 72)
	FinalRushCycleSec int          // Battle cycle during Final Rush in seconds (default: 180 = 3 min)
	CheckInterval    time.Duration // How often to check for era transitions (default: 1 minute)
}

// DefaultSeasonConfig returns the default season configuration.
func DefaultSeasonConfig() SeasonConfig {
	return SeasonConfig{
		SeasonDuration:    28 * 24 * time.Hour, // 4 weeks
		FinalRushHours:    72,
		FinalRushCycleSec: 180, // 3 minutes
		CheckInterval:     time.Minute,
	}
}

// SeasonDBRow is a DB-loaded season record (decoupled from db package).
type SeasonDBRow struct {
	ID         string
	Name       string
	Number     int
	Phase      string
	Status     string
	StartAt    time.Time
	EndAt      time.Time
	ConfigJSON []byte
	CreatedAt  time.Time
}

// SeasonStore is the persistence interface for seasons.
type SeasonStore interface {
	UpsertSeason(id, name string, number int, phase, status string, startAt, endAt time.Time, configJSON []byte, createdAt time.Time) error
	LoadActiveSeason() (*SeasonDBRow, error)
	LoadAllSeasons() ([]SeasonDBRow, error)
}

// --- Season Engine ---

// SeasonEngine manages season lifecycle, era transitions, and rule enforcement.
type SeasonEngine struct {
	mu sync.RWMutex

	config   SeasonConfig
	eraRules map[Era]EraRule

	// Current season
	current *Season

	// Historical seasons
	history []*Season

	// Active era rules (copy of eraRules[current.CurrentEra] with Final Rush adjustments)
	activeRules EraRule

	// Season number counter
	seasonCounter int

	// Callbacks
	OnEraChange     func(season *Season, oldEra, newEra Era)
	OnSeasonEnd     func(season *Season)
	OnFinalRush     func(season *Season)

	// Persistence
	store SeasonStore

	// Lifecycle
	cancel context.CancelFunc
}

// NewSeasonEngine creates a new SeasonEngine.
func NewSeasonEngine(cfg SeasonConfig) *SeasonEngine {
	return &SeasonEngine{
		config:   cfg,
		eraRules: DefaultEraRules(),
		history:  make([]*Season, 0),
	}
}

// --- Season Creation ---

// CreateSeason creates and activates a new season.
// If a season is already active, it returns an error.
func (se *SeasonEngine) CreateSeason(name, theme string) (*Season, error) {
	se.mu.Lock()
	defer se.mu.Unlock()

	if se.current != nil && se.current.Status == SeasonStatusActive {
		return nil, fmt.Errorf("cannot create season: season %q is already active", se.current.Name)
	}

	se.seasonCounter++
	now := time.Now()
	endAt := now.Add(se.config.SeasonDuration)
	finalRushAt := endAt.Add(-time.Duration(se.config.FinalRushHours) * time.Hour)

	season := &Season{
		ID:          uuid.New().String(),
		Number:      se.seasonCounter,
		Name:        name,
		Theme:       theme,
		Status:      SeasonStatusActive,
		CurrentEra:  EraDiscovery,
		StartAt:     now,
		EndAt:       endAt,
		EraStartAt:  now,
		FinalRushAt: finalRushAt,
		EraSchedule: se.computeEraSchedule(now, endAt),
		CreatedAt:   now,
	}

	se.current = season
	se.activeRules = se.eraRules[EraDiscovery]

	slog.Info("season created",
		"id", season.ID,
		"number", season.Number,
		"name", season.Name,
		"theme", season.Theme,
		"start", season.StartAt.Format(time.RFC3339),
		"end", season.EndAt.Format(time.RFC3339),
		"finalRush", season.FinalRushAt.Format(time.RFC3339),
	)

	// Write-through to DB
	go se.persistSeasonAsync()

	return season, nil
}

// computeEraSchedule calculates the start/end times for each era.
// Each era gets approximately 1/4 of the season duration.
func (se *SeasonEngine) computeEraSchedule(start, end time.Time) map[Era]EraWindow {
	total := end.Sub(start)
	eraDuration := total / time.Duration(len(EraSequence))

	schedule := make(map[Era]EraWindow, len(EraSequence))
	cursor := start

	for _, era := range EraSequence {
		eraEnd := cursor.Add(eraDuration)
		// Last era extends to the exact season end
		if era == EraReckoning {
			eraEnd = end
		}
		schedule[era] = EraWindow{
			Era:     era,
			StartAt: cursor,
			EndAt:   eraEnd,
		}
		cursor = eraEnd
	}

	return schedule
}

// --- Era Transition ---

// checkAndTransitionEra checks if the current era should transition.
// Must be called with write lock held.
func (se *SeasonEngine) checkAndTransitionEra(now time.Time) bool {
	if se.current == nil || se.current.Status != SeasonStatusActive {
		return false
	}

	// Check if season has ended
	if now.After(se.current.EndAt) || now.Equal(se.current.EndAt) {
		se.endSeason(now)
		return true
	}

	// Check era transition
	currentEra := se.current.CurrentEra
	for _, era := range EraSequence {
		window, ok := se.current.EraSchedule[era]
		if !ok {
			continue
		}
		if (now.After(window.StartAt) || now.Equal(window.StartAt)) &&
			now.Before(window.EndAt) &&
			era != currentEra {

			oldEra := currentEra
			se.current.CurrentEra = era
			se.current.EraStartAt = now
			se.activeRules = se.eraRules[era]

			slog.Info("era transitioned",
				"season", se.current.Name,
				"from", string(oldEra),
				"to", string(era),
			)

			if se.OnEraChange != nil {
				go se.OnEraChange(se.current, oldEra, era)
			}
			go se.persistSeasonAsync()
			return true
		}
	}

	// Check Final Rush activation (last 72 hours of Reckoning)
	if currentEra == EraReckoning && !se.activeRules.FinalRush {
		if now.After(se.current.FinalRushAt) || now.Equal(se.current.FinalRushAt) {
			se.activateFinalRush()
			return true
		}
	}

	return false
}

// activateFinalRush enables Final Rush mode: battle cycle shortened to 3 minutes.
func (se *SeasonEngine) activateFinalRush() {
	se.activeRules.FinalRush = true
	se.activeRules.BattleCycleSec = se.config.FinalRushCycleSec

	slog.Info("FINAL RUSH activated",
		"season", se.current.Name,
		"battleCycle", se.activeRules.BattleCycleSec,
		"endsAt", se.current.EndAt.Format(time.RFC3339),
	)

	if se.OnFinalRush != nil {
		go se.OnFinalRush(se.current)
	}
}

// endSeason marks the current season as ended.
func (se *SeasonEngine) endSeason(now time.Time) {
	if se.current == nil {
		return
	}

	se.current.Status = SeasonStatusEnded
	slog.Info("season ended",
		"id", se.current.ID,
		"name", se.current.Name,
		"number", se.current.Number,
	)

	// Archive to history
	se.history = append(se.history, se.current)

	if se.OnSeasonEnd != nil {
		go se.OnSeasonEnd(se.current)
	}
	go se.persistSeasonAsync()
}

// --- Background Worker ---

// Start begins the season lifecycle background worker.
func (se *SeasonEngine) Start(ctx context.Context) {
	workerCtx, cancel := context.WithCancel(ctx)
	se.cancel = cancel

	go se.tickLoop(workerCtx)
	slog.Info("season engine started", "checkInterval", se.config.CheckInterval)
}

// Stop stops the season lifecycle background worker.
func (se *SeasonEngine) Stop() {
	if se.cancel != nil {
		se.cancel()
		se.cancel = nil
	}
	slog.Info("season engine stopped")
}

// tickLoop periodically checks for era transitions and season end.
func (se *SeasonEngine) tickLoop(ctx context.Context) {
	ticker := time.NewTicker(se.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			se.mu.Lock()
			se.checkAndTransitionEra(now)
			se.mu.Unlock()
		}
	}
}

// --- Queries ---

// GetCurrentSeason returns the current active season (or nil).
func (se *SeasonEngine) GetCurrentSeason() *Season {
	se.mu.RLock()
	defer se.mu.RUnlock()

	if se.current == nil {
		return nil
	}
	copy := *se.current
	return &copy
}

// GetActiveRules returns the currently active era rules (with Final Rush adjustments).
func (se *SeasonEngine) GetActiveRules() EraRule {
	se.mu.RLock()
	defer se.mu.RUnlock()
	return se.activeRules
}

// GetEraRules returns the rules for a specific era.
func (se *SeasonEngine) GetEraRules(era Era) (EraRule, bool) {
	se.mu.RLock()
	defer se.mu.RUnlock()
	rule, ok := se.eraRules[era]
	return rule, ok
}

// IsWarAllowed checks if war declarations are currently allowed.
func (se *SeasonEngine) IsWarAllowed() bool {
	se.mu.RLock()
	defer se.mu.RUnlock()
	return se.activeRules.WarAllowed
}

// GetWarCostMultiplier returns the current war cost multiplier.
func (se *SeasonEngine) GetWarCostMultiplier() float64 {
	se.mu.RLock()
	defer se.mu.RUnlock()
	return se.activeRules.WarCostMult
}

// IsFinalRush returns true if Final Rush is currently active.
func (se *SeasonEngine) IsFinalRush() bool {
	se.mu.RLock()
	defer se.mu.RUnlock()
	return se.activeRules.FinalRush
}

// GetBattleCycleSeconds returns the current battle cycle duration in seconds.
func (se *SeasonEngine) GetBattleCycleSeconds() int {
	se.mu.RLock()
	defer se.mu.RUnlock()
	return se.activeRules.BattleCycleSec
}

// GetSeasonHistory returns all past seasons.
func (se *SeasonEngine) GetSeasonHistory() []*Season {
	se.mu.RLock()
	defer se.mu.RUnlock()

	result := make([]*Season, len(se.history))
	for i, s := range se.history {
		copy := *s
		result[i] = &copy
	}
	return result
}

// GetSeasonByID returns a season by its ID (current or historical).
func (se *SeasonEngine) GetSeasonByID(id string) *Season {
	se.mu.RLock()
	defer se.mu.RUnlock()

	if se.current != nil && se.current.ID == id {
		copy := *se.current
		return &copy
	}

	for _, s := range se.history {
		if s.ID == id {
			copy := *s
			return &copy
		}
	}
	return nil
}

// GetTimeUntilEraChange returns the duration until the next era transition.
func (se *SeasonEngine) GetTimeUntilEraChange() time.Duration {
	se.mu.RLock()
	defer se.mu.RUnlock()

	if se.current == nil {
		return 0
	}

	window, ok := se.current.EraSchedule[se.current.CurrentEra]
	if !ok {
		return 0
	}

	remaining := time.Until(window.EndAt)
	if remaining < 0 {
		return 0
	}
	return remaining
}

// GetTimeUntilSeasonEnd returns the duration until the season ends.
func (se *SeasonEngine) GetTimeUntilSeasonEnd() time.Duration {
	se.mu.RLock()
	defer se.mu.RUnlock()

	if se.current == nil {
		return 0
	}
	remaining := time.Until(se.current.EndAt)
	if remaining < 0 {
		return 0
	}
	return remaining
}

// GetSeasonProgress returns the season progress as a percentage (0.0 - 1.0).
func (se *SeasonEngine) GetSeasonProgress() float64 {
	se.mu.RLock()
	defer se.mu.RUnlock()

	if se.current == nil {
		return 0
	}

	total := se.current.EndAt.Sub(se.current.StartAt)
	elapsed := time.Since(se.current.StartAt)
	if total <= 0 {
		return 0
	}

	progress := float64(elapsed) / float64(total)
	if progress > 1.0 {
		return 1.0
	}
	return progress
}

// SeasonSummary provides a compact season overview for the client.
type SeasonSummary struct {
	ID              string       `json:"id"`
	Number          int          `json:"number"`
	Name            string       `json:"name"`
	Theme           string       `json:"theme"`
	Status          SeasonStatus `json:"status"`
	CurrentEra      Era          `json:"current_era"`
	EraDisplayName  string       `json:"era_display_name"`
	Progress        float64      `json:"progress"`
	TimeRemainingMs int64        `json:"time_remaining_ms"`
	EraTimeLeftMs   int64        `json:"era_time_left_ms"`
	IsFinalRush     bool         `json:"is_final_rush"`
	BattleCycleSec  int          `json:"battle_cycle_sec"`
	StartAt         int64        `json:"start_at"`
	EndAt           int64        `json:"end_at"`
}

// GetSeasonSummary returns a compact summary for client consumption.
func (se *SeasonEngine) GetSeasonSummary() *SeasonSummary {
	se.mu.RLock()
	defer se.mu.RUnlock()

	if se.current == nil {
		return nil
	}

	return &SeasonSummary{
		ID:              se.current.ID,
		Number:          se.current.Number,
		Name:            se.current.Name,
		Theme:           se.current.Theme,
		Status:          se.current.Status,
		CurrentEra:      se.current.CurrentEra,
		EraDisplayName:  se.activeRules.DisplayName,
		Progress:        se.seasonProgressLocked(),
		TimeRemainingMs: time.Until(se.current.EndAt).Milliseconds(),
		EraTimeLeftMs:   se.eraTimeLeftLocked().Milliseconds(),
		IsFinalRush:     se.activeRules.FinalRush,
		BattleCycleSec:  se.activeRules.BattleCycleSec,
		StartAt:         se.current.StartAt.UnixMilli(),
		EndAt:           se.current.EndAt.UnixMilli(),
	}
}

// seasonProgressLocked computes progress (must hold read lock).
func (se *SeasonEngine) seasonProgressLocked() float64 {
	if se.current == nil {
		return 0
	}
	total := se.current.EndAt.Sub(se.current.StartAt)
	elapsed := time.Since(se.current.StartAt)
	if total <= 0 {
		return 0
	}
	p := float64(elapsed) / float64(total)
	if p > 1.0 {
		return 1.0
	}
	return p
}

// eraTimeLeftLocked computes time left in current era (must hold read lock).
func (se *SeasonEngine) eraTimeLeftLocked() time.Duration {
	if se.current == nil {
		return 0
	}
	window, ok := se.current.EraSchedule[se.current.CurrentEra]
	if !ok {
		return 0
	}
	remaining := time.Until(window.EndAt)
	if remaining < 0 {
		return 0
	}
	return remaining
}

// GetAllEraRules returns all era rules sorted by sequence.
func (se *SeasonEngine) GetAllEraRules() []EraRule {
	se.mu.RLock()
	defer se.mu.RUnlock()

	rules := make([]EraRule, 0, len(EraSequence))
	for _, era := range EraSequence {
		if rule, ok := se.eraRules[era]; ok {
			rules = append(rules, rule)
		}
	}
	return rules
}

// --- Leaderboard Integration ---

// SeasonLeaderboardEntry represents one entry in the season leaderboard.
type SeasonLeaderboardEntry struct {
	Rank         int    `json:"rank"`
	FactionID    string `json:"faction_id"`
	FactionName  string `json:"faction_name"`
	Score        int64  `json:"score"`
	Countries    int    `json:"countries"`
	TotalGDP     int64  `json:"total_gdp"`
	SiegeWins    int    `json:"siege_wins"`
	BattleWins   int    `json:"battle_wins"`
}

// ComputeSeasonLeaderboard computes the season leaderboard from faction data.
// Score = (countries * 100) + (GDP / 1000) + (siege_wins * 50) + (battle_wins * 10)
func ComputeSeasonLeaderboard(factions []*Faction, factionGDPs map[string]int64, factionCountries map[string]int, siegeWins, battleWins map[string]int) []SeasonLeaderboardEntry {
	entries := make([]SeasonLeaderboardEntry, 0, len(factions))

	for _, f := range factions {
		entry := SeasonLeaderboardEntry{
			FactionID:   f.ID,
			FactionName: f.Name,
			Countries:   factionCountries[f.ID],
			TotalGDP:    factionGDPs[f.ID],
			SiegeWins:   siegeWins[f.ID],
			BattleWins:  battleWins[f.ID],
		}

		entry.Score = int64(entry.Countries)*100 +
			entry.TotalGDP/1000 +
			int64(entry.SiegeWins)*50 +
			int64(entry.BattleWins)*10

		entries = append(entries, entry)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Score > entries[j].Score
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}

	return entries
}

// --- Persistence ---

// SetStore sets the optional persistence store.
func (se *SeasonEngine) SetStore(s SeasonStore) {
	se.mu.Lock()
	defer se.mu.Unlock()
	se.store = s
}

// LoadFromDB loads the active season from the database.
func (se *SeasonEngine) LoadFromDB() error {
	if se.store == nil {
		return nil
	}

	row, err := se.store.LoadActiveSeason()
	if err != nil {
		return fmt.Errorf("load active season from DB: %w", err)
	}
	if row == nil {
		slog.Info("no active season in DB")
		return nil
	}

	se.mu.Lock()
	defer se.mu.Unlock()

	season := &Season{
		ID:          row.ID,
		Number:      row.Number,
		Name:        row.Name,
		Status:      SeasonStatus(row.Status),
		CurrentEra:  Era(row.Phase),
		StartAt:     row.StartAt,
		EndAt:       row.EndAt,
		EraStartAt:  row.StartAt,
		FinalRushAt: row.EndAt.Add(-time.Duration(se.config.FinalRushHours) * time.Hour),
		EraSchedule: se.computeEraSchedule(row.StartAt, row.EndAt),
		CreatedAt:   row.CreatedAt,
	}

	se.current = season
	se.seasonCounter = row.Number
	if rule, ok := se.eraRules[Era(row.Phase)]; ok {
		se.activeRules = rule
	}

	slog.Info("season loaded from DB", "id", row.ID, "name", row.Name, "era", row.Phase)
	return nil
}

// persistSeasonAsync writes the current season to the database in the background.
func (se *SeasonEngine) persistSeasonAsync() {
	if se.store == nil {
		return
	}

	se.mu.RLock()
	s := se.current
	if s == nil {
		se.mu.RUnlock()
		return
	}
	sCopy := *s
	se.mu.RUnlock()

	go func() {
		if err := se.store.UpsertSeason(
			sCopy.ID, sCopy.Name, sCopy.Number,
			string(sCopy.CurrentEra), string(sCopy.Status),
			sCopy.StartAt, sCopy.EndAt, nil, sCopy.CreatedAt,
		); err != nil {
			slog.Warn("persist season failed", "id", sCopy.ID, "error", err)
		}
	}()
}

// --- HTTP API ---

// SeasonRoutes returns a chi.Router with season HTTP endpoints.
func (se *SeasonEngine) SeasonRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/current", se.handleGetCurrent)
	r.Get("/summary", se.handleGetSummary)
	r.Get("/rules", se.handleGetRules)
	r.Get("/rules/{era}", se.handleGetEraRule)
	r.Get("/history", se.handleGetHistory)
	r.Get("/{seasonID}", se.handleGetSeason)

	return r
}

// handleGetCurrent — GET /api/seasons/current
func (se *SeasonEngine) handleGetCurrent(w http.ResponseWriter, r *http.Request) {
	season := se.GetCurrentSeason()
	if season == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no active season"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"season":      season,
		"activeRules": se.GetActiveRules(),
	})
}

// handleGetSummary — GET /api/seasons/summary
func (se *SeasonEngine) handleGetSummary(w http.ResponseWriter, r *http.Request) {
	summary := se.GetSeasonSummary()
	if summary == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no active season"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// handleGetRules — GET /api/seasons/rules
func (se *SeasonEngine) handleGetRules(w http.ResponseWriter, r *http.Request) {
	rules := se.GetAllEraRules()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"eras":       rules,
		"active_era": se.GetActiveRules(),
	})
}

// handleGetEraRule — GET /api/seasons/rules/{era}
func (se *SeasonEngine) handleGetEraRule(w http.ResponseWriter, r *http.Request) {
	eraStr := chi.URLParam(r, "era")
	era := Era(eraStr)

	rule, ok := se.GetEraRules(era)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": fmt.Sprintf("unknown era: %s", eraStr),
		})
		return
	}

	writeJSON(w, http.StatusOK, rule)
}

// handleGetHistory — GET /api/seasons/history
func (se *SeasonEngine) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	history := se.GetSeasonHistory()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"seasons": history,
		"count":   len(history),
	})
}

// handleGetSeason — GET /api/seasons/{seasonID}
func (se *SeasonEngine) handleGetSeason(w http.ResponseWriter, r *http.Request) {
	seasonID := chi.URLParam(r, "seasonID")
	season := se.GetSeasonByID(seasonID)
	if season == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "season not found"})
		return
	}

	writeJSON(w, http.StatusOK, season)
}

// --- JSON marshaling for the Season struct with EraSchedule ---

// MarshalJSON custom marshals EraSchedule map[Era]EraWindow as a sorted array.
func (s Season) MarshalJSON() ([]byte, error) {
	type Alias Season

	// Convert EraSchedule map to sorted slice for consistent JSON output
	type eraWindowJSON struct {
		Era     Era       `json:"era"`
		StartAt time.Time `json:"start_at"`
		EndAt   time.Time `json:"end_at"`
	}

	schedule := make([]eraWindowJSON, 0, len(s.EraSchedule))
	for _, era := range EraSequence {
		if w, ok := s.EraSchedule[era]; ok {
			schedule = append(schedule, eraWindowJSON{
				Era:     w.Era,
				StartAt: w.StartAt,
				EndAt:   w.EndAt,
			})
		}
	}

	return json.Marshal(&struct {
		Alias
		EraScheduleList []eraWindowJSON `json:"era_schedule"`
	}{
		Alias:           Alias(s),
		EraScheduleList: schedule,
	})
}
