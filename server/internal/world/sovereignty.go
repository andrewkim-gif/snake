package world

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/cache"
)

// SovereigntyConfig holds configuration for the sovereignty system.
type SovereigntyConfig struct {
	// Defense bonus per sovereignty level (default: 5% per level)
	DefenseBonusPerLevel float64

	// GDP bonus per sovereignty level (default: 10% per level)
	GDPBonusPerLevel float64

	// Max sovereignty level
	MaxLevel int

	// Capital unlock level (consecutive defenses needed)
	CapitalUnlockLevel int
}

// DefaultSovereigntyConfig returns default sovereignty configuration.
func DefaultSovereigntyConfig() SovereigntyConfig {
	return SovereigntyConfig{
		DefenseBonusPerLevel: 0.05,
		GDPBonusPerLevel:     0.10,
		MaxLevel:             10,
		CapitalUnlockLevel:   5,
	}
}

// SovereigntyRecord holds the sovereignty state for a single country.
type SovereigntyRecord struct {
	CountryISO       string    `json:"country_iso"`
	FactionID        string    `json:"faction_id"`
	Level            int       `json:"level"`
	ConsecutiveWins  int       `json:"consecutive_wins"`
	TotalDefenses    int       `json:"total_defenses"`
	LastBattleAt     time.Time `json:"last_battle_at"`
	SovereignSince   time.Time `json:"sovereign_since"`
	CapitalName      string    `json:"capital_name,omitempty"`
	IsCapital        bool      `json:"is_capital"`
	DefenseBonus     float64   `json:"defense_bonus"`
	GDPBonus         float64   `json:"gdp_bonus"`
}

// SovereigntyChangeEvent is emitted when sovereignty changes hands.
type SovereigntyChangeEvent struct {
	CountryISO   string `json:"country_iso"`
	CountryName  string `json:"country_name"`
	OldFaction   string `json:"old_faction"`
	NewFaction   string `json:"new_faction"`
	NewLevel     int    `json:"new_level"`
	IsConquest   bool   `json:"is_conquest"` // true if taken from another faction
	Timestamp    int64  `json:"timestamp"`
}

// SovereigntyEngine manages sovereignty state for all countries.
// It receives battle results and updates sovereignty accordingly,
// tracks consecutive defense streaks, and applies bonuses.
type SovereigntyEngine struct {
	mu sync.RWMutex

	config  SovereigntyConfig
	records map[string]*SovereigntyRecord // countryISO → record

	// Reference to WorldManager for state updates
	worldManager *WorldManager

	// Redis client for persistence and pub/sub notifications
	redis *cache.RedisClient

	// Callback for sovereignty change notifications
	OnSovereigntyChange func(event SovereigntyChangeEvent)
}

// NewSovereigntyEngine creates a new sovereignty engine.
func NewSovereigntyEngine(cfg SovereigntyConfig, wm *WorldManager, redisClient *cache.RedisClient) *SovereigntyEngine {
	se := &SovereigntyEngine{
		config:       cfg,
		records:      make(map[string]*SovereigntyRecord, len(AllCountries)),
		worldManager: wm,
		redis:        redisClient,
	}

	// Initialize empty records for all countries
	for _, seed := range AllCountries {
		se.records[seed.ISO3] = &SovereigntyRecord{
			CountryISO: seed.ISO3,
		}
	}

	return se
}

// ProcessBattleResult processes a battle result and updates sovereignty.
// This is the main entry point called by WorldManager when a battle ends.
func (se *SovereigntyEngine) ProcessBattleResult(result BattleResult) {
	se.mu.Lock()

	record, ok := se.records[result.CountryISO]
	if !ok {
		se.mu.Unlock()
		slog.Warn("sovereignty: unknown country", "iso", result.CountryISO)
		return
	}

	oldFaction := record.FactionID
	winnerFaction := result.WinnerFaction

	// No winner (no factions participated)
	if winnerFaction == "" {
		se.mu.Unlock()
		return
	}

	record.LastBattleAt = result.BattledAt

	var changeEvent *SovereigntyChangeEvent

	if winnerFaction == oldFaction {
		// Successful defense: increment streak and possibly level up
		record.ConsecutiveWins++
		record.TotalDefenses++

		if record.Level < se.config.MaxLevel {
			record.Level++
		}

		// Recalculate bonuses
		record.DefenseBonus = float64(record.Level) * se.config.DefenseBonusPerLevel
		record.GDPBonus = float64(record.Level) * se.config.GDPBonusPerLevel

		// Check capital unlock
		if record.ConsecutiveWins >= se.config.CapitalUnlockLevel && !record.IsCapital {
			record.IsCapital = true
			// Capital name from country data
			if wm := se.worldManager; wm != nil {
				if cs := wm.GetCountry(result.CountryISO); cs != nil {
					record.CapitalName = cs.CapitalName
				}
			}
			slog.Info("capital unlocked",
				"country", result.CountryISO,
				"faction", winnerFaction,
				"consecutiveWins", record.ConsecutiveWins,
			)
		}

		slog.Info("sovereignty defended",
			"country", result.CountryISO,
			"faction", winnerFaction,
			"level", record.Level,
			"streak", record.ConsecutiveWins,
		)
	} else {
		// Sovereignty change! New faction takes over
		isConquest := oldFaction != ""

		record.FactionID = winnerFaction
		record.Level = 1
		record.ConsecutiveWins = 1
		record.TotalDefenses = 0
		record.SovereignSince = time.Now()
		record.IsCapital = false
		record.CapitalName = ""
		record.DefenseBonus = se.config.DefenseBonusPerLevel
		record.GDPBonus = se.config.GDPBonusPerLevel

		countryName := result.CountryISO
		if wm := se.worldManager; wm != nil {
			if cs := wm.GetCountry(result.CountryISO); cs != nil {
				countryName = cs.Name
			}
		}

		changeEvent = &SovereigntyChangeEvent{
			CountryISO:  result.CountryISO,
			CountryName: countryName,
			OldFaction:  oldFaction,
			NewFaction:  winnerFaction,
			NewLevel:    1,
			IsConquest:  isConquest,
			Timestamp:   time.Now().UnixMilli(),
		}

		slog.Info("sovereignty changed",
			"country", result.CountryISO,
			"from", oldFaction,
			"to", winnerFaction,
			"isConquest", isConquest,
		)
	}

	// Snapshot values for updates outside the lock
	newFaction := record.FactionID
	newLevel := record.Level
	newStreak := record.ConsecutiveWins

	se.mu.Unlock()

	// Update WorldManager (cross-component update)
	if se.worldManager != nil {
		se.worldManager.UpdateSovereignty(result.CountryISO, newFaction, newLevel, newStreak)
	}

	// Persist to Redis
	se.persistToRedis(result.CountryISO)

	// Publish sovereignty change notification
	if changeEvent != nil {
		se.publishSovereigntyChange(*changeEvent)

		// Notify callback
		if se.OnSovereigntyChange != nil {
			se.OnSovereigntyChange(*changeEvent)
		}
	}
}

// --- Getters ---

// GetRecord returns the sovereignty record for a country.
func (se *SovereigntyEngine) GetRecord(countryISO string) *SovereigntyRecord {
	se.mu.RLock()
	defer se.mu.RUnlock()

	r, ok := se.records[countryISO]
	if !ok {
		return nil
	}
	// Return a copy
	copy := *r
	return &copy
}

// GetFactionTerritories returns all countries controlled by a faction.
func (se *SovereigntyEngine) GetFactionTerritories(factionID string) []SovereigntyRecord {
	se.mu.RLock()
	defer se.mu.RUnlock()

	var territories []SovereigntyRecord
	for _, r := range se.records {
		if r.FactionID == factionID {
			territories = append(territories, *r)
		}
	}
	return territories
}

// GetFactionTerritoryCount returns the number of countries a faction controls.
func (se *SovereigntyEngine) GetFactionTerritoryCount(factionID string) int {
	se.mu.RLock()
	defer se.mu.RUnlock()

	count := 0
	for _, r := range se.records {
		if r.FactionID == factionID {
			count++
		}
	}
	return count
}

// GetCapitals returns all countries designated as capitals.
func (se *SovereigntyEngine) GetCapitals() []SovereigntyRecord {
	se.mu.RLock()
	defer se.mu.RUnlock()

	var capitals []SovereigntyRecord
	for _, r := range se.records {
		if r.IsCapital {
			capitals = append(capitals, *r)
		}
	}
	return capitals
}

// GetDefenseBonus returns the total defense bonus for a country.
// Includes base terrain bonus + sovereignty level bonus.
func (se *SovereigntyEngine) GetDefenseBonus(countryISO string) float64 {
	se.mu.RLock()
	defer se.mu.RUnlock()

	r, ok := se.records[countryISO]
	if !ok {
		return 0
	}
	return r.DefenseBonus
}

// GetGDPBonus returns the GDP multiplier bonus from sovereignty level.
func (se *SovereigntyEngine) GetGDPBonus(countryISO string) float64 {
	se.mu.RLock()
	defer se.mu.RUnlock()

	r, ok := se.records[countryISO]
	if !ok {
		return 0
	}
	return r.GDPBonus
}

// IsFactionCapital checks if a country is the capital of a specific faction.
func (se *SovereigntyEngine) IsFactionCapital(countryISO, factionID string) bool {
	se.mu.RLock()
	defer se.mu.RUnlock()

	r, ok := se.records[countryISO]
	if !ok {
		return false
	}
	return r.IsCapital && r.FactionID == factionID
}

// SetCapital manually designates a country as a faction's capital.
// Only allowed if sovereignty level >= CapitalUnlockLevel.
func (se *SovereigntyEngine) SetCapital(countryISO, factionID string) error {
	se.mu.Lock()
	defer se.mu.Unlock()

	r, ok := se.records[countryISO]
	if !ok {
		return fmt.Errorf("country %s not found", countryISO)
	}
	if r.FactionID != factionID {
		return fmt.Errorf("faction %s does not control %s", factionID, countryISO)
	}
	if r.Level < se.config.CapitalUnlockLevel {
		return fmt.Errorf("sovereignty level %d < required %d for capital", r.Level, se.config.CapitalUnlockLevel)
	}

	// Remove capital from other countries of this faction
	for _, other := range se.records {
		if other.FactionID == factionID && other.IsCapital {
			other.IsCapital = false
			other.CapitalName = ""
		}
	}

	r.IsCapital = true
	if se.worldManager != nil {
		if cs := se.worldManager.GetCountry(countryISO); cs != nil {
			r.CapitalName = cs.CapitalName
		}
	}

	return nil
}

// --- Persistence ---

// persistToRedis saves a sovereignty record to Redis.
func (se *SovereigntyEngine) persistToRedis(countryISO string) {
	if se.redis == nil {
		return
	}

	se.mu.RLock()
	record, ok := se.records[countryISO]
	if !ok {
		se.mu.RUnlock()
		return
	}
	recordCopy := *record
	se.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	key := fmt.Sprintf("sovereignty:%s", countryISO)
	if err := se.redis.Set(ctx, key, recordCopy, 0); err != nil {
		slog.Warn("sovereignty redis persist failed",
			"country", countryISO,
			"error", err,
		)
	}
}

// publishSovereigntyChange publishes a sovereignty change event to Redis pub/sub.
func (se *SovereigntyEngine) publishSovereigntyChange(event SovereigntyChangeEvent) {
	if se.redis == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Publish to country-specific channel
	channel := cache.SovereigntyChannel(event.CountryISO)
	if err := se.redis.Publish(ctx, channel, event); err != nil {
		slog.Warn("sovereignty change publish failed",
			"channel", channel,
			"error", err,
		)
	}

	// Also publish to global events channel
	if err := se.redis.Publish(ctx, cache.GlobalEventsChannel, map[string]interface{}{
		"type": "sovereignty_change",
		"data": event,
	}); err != nil {
		slog.Warn("global sovereignty event publish failed", "error", err)
	}
}

// RestoreFromRedis restores sovereignty records from Redis on startup.
func (se *SovereigntyEngine) RestoreFromRedis(ctx context.Context) {
	if se.redis == nil {
		return
	}

	se.mu.Lock()
	defer se.mu.Unlock()

	restoreCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	restored := 0
	for iso := range se.records {
		key := fmt.Sprintf("sovereignty:%s", iso)
		var cached SovereigntyRecord
		if err := se.redis.Get(restoreCtx, key, &cached); err != nil {
			continue
		}
		se.records[iso] = &cached
		restored++
	}

	if restored > 0 {
		slog.Info("restored sovereignty records from Redis", "count", restored)
	}
}

// --- Aggregate queries ---

// GetSovereigntyStats returns aggregate sovereignty statistics.
func (se *SovereigntyEngine) GetSovereigntyStats() SovereigntyStats {
	se.mu.RLock()
	defer se.mu.RUnlock()

	stats := SovereigntyStats{
		FactionTerritories: make(map[string]int),
		FactionCapitals:    make(map[string]string),
	}

	for _, r := range se.records {
		if r.FactionID != "" {
			stats.TotalControlled++
			stats.FactionTerritories[r.FactionID]++
			if r.IsCapital {
				stats.TotalCapitals++
				stats.FactionCapitals[r.FactionID] = r.CountryISO
			}
		} else {
			stats.TotalUncontrolled++
		}
	}

	return stats
}

// SovereigntyStats holds aggregate sovereignty information.
type SovereigntyStats struct {
	TotalControlled    int            `json:"total_controlled"`
	TotalUncontrolled  int            `json:"total_uncontrolled"`
	TotalCapitals      int            `json:"total_capitals"`
	FactionTerritories map[string]int `json:"faction_territories"` // factionID → count
	FactionCapitals    map[string]string `json:"faction_capitals"` // factionID → capital ISO
}
