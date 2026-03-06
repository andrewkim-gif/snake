package meta

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// NewsEventType classifies global news events.
type NewsEventType string

const (
	NewsSovereigntyChange NewsEventType = "sovereignty_change"
	NewsBattleStart       NewsEventType = "battle_start"
	NewsBattleEnd         NewsEventType = "battle_end"
	NewsWarDeclared       NewsEventType = "war_declared"
	NewsTreatySigned      NewsEventType = "treaty_signed"
	NewsEconomyEvent      NewsEventType = "economy_event"
	NewsSeasonEvent       NewsEventType = "season_event"
	NewsGlobalEvent       NewsEventType = "global_event"
)

// NewsItem represents a single news event in the global feed.
type NewsItem struct {
	ID          string        `json:"id"`
	Type        NewsEventType `json:"type"`
	Headline    string        `json:"headline"`
	Detail      string        `json:"detail,omitempty"`
	CountryISO  string        `json:"countryISO,omitempty"`
	FactionName string        `json:"factionName,omitempty"`
	Timestamp   int64         `json:"timestamp"` // Unix milliseconds
}

// NewsCallback is called when new news is generated.
type NewsCallback func(item NewsItem)

// NewsManager generates and manages event-based news items.
// It maintains a 24-hour rolling archive and pushes new items via callback.
type NewsManager struct {
	mu      sync.RWMutex
	archive []NewsItem
	maxAge  time.Duration // Default 24 hours
	nextID  int64

	// Callback for real-time push to WebSocket clients
	OnNews NewsCallback
}

// NewNewsManager creates a NewsManager with default 24-hour archive.
func NewNewsManager() *NewsManager {
	return &NewsManager{
		archive: make([]NewsItem, 0, 256),
		maxAge:  24 * time.Hour,
		nextID:  1,
	}
}

// generateID creates a unique news ID.
func (nm *NewsManager) generateID() string {
	nm.nextID++
	return fmt.Sprintf("news-%d-%d", time.Now().UnixMilli(), nm.nextID)
}

// Publish creates and stores a news item, then pushes it to subscribers.
func (nm *NewsManager) Publish(eventType NewsEventType, headline string, opts ...NewsOption) {
	nm.mu.Lock()

	item := NewsItem{
		ID:        nm.generateID(),
		Type:      eventType,
		Headline:  headline,
		Timestamp: time.Now().UnixMilli(),
	}

	// Apply options
	for _, opt := range opts {
		opt(&item)
	}

	nm.archive = append(nm.archive, item)
	nm.mu.Unlock()

	slog.Info("news published",
		"type", eventType,
		"headline", headline,
	)

	// Push to subscribers
	if nm.OnNews != nil {
		nm.OnNews(item)
	}
}

// NewsOption configures optional fields on a NewsItem.
type NewsOption func(*NewsItem)

// WithDetail sets the detail text.
func WithDetail(detail string) NewsOption {
	return func(n *NewsItem) { n.Detail = detail }
}

// WithCountry sets the country ISO code.
func WithCountry(iso string) NewsOption {
	return func(n *NewsItem) { n.CountryISO = iso }
}

// WithFaction sets the faction name.
func WithFaction(name string) NewsOption {
	return func(n *NewsItem) { n.FactionName = name }
}

// GetRecent returns the most recent N news items (newest first).
func (nm *NewsManager) GetRecent(limit int) []NewsItem {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	n := len(nm.archive)
	if limit <= 0 || limit > n {
		limit = n
	}

	// Return newest first
	result := make([]NewsItem, limit)
	for i := 0; i < limit; i++ {
		result[i] = nm.archive[n-1-i]
	}
	return result
}

// GetArchive returns all news items within the archive window (24h by default).
func (nm *NewsManager) GetArchive() []NewsItem {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	cutoff := time.Now().Add(-nm.maxAge).UnixMilli()
	var result []NewsItem
	for _, item := range nm.archive {
		if item.Timestamp >= cutoff {
			result = append(result, item)
		}
	}
	return result
}

// Cleanup removes expired news items older than maxAge.
func (nm *NewsManager) Cleanup() int {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	cutoff := time.Now().Add(-nm.maxAge).UnixMilli()
	newArchive := make([]NewsItem, 0, len(nm.archive))
	removed := 0

	for _, item := range nm.archive {
		if item.Timestamp >= cutoff {
			newArchive = append(newArchive, item)
		} else {
			removed++
		}
	}

	nm.archive = newArchive

	if removed > 0 {
		slog.Info("news cleanup", "removed", removed, "remaining", len(nm.archive))
	}
	return removed
}

// Count returns the number of items in the archive.
func (nm *NewsManager) Count() int {
	nm.mu.RLock()
	defer nm.mu.RUnlock()
	return len(nm.archive)
}

// --- Convenience methods for common event types ---

// PublishSovereigntyChange publishes a sovereignty change news item.
func (nm *NewsManager) PublishSovereigntyChange(countryISO, factionName string) {
	nm.Publish(
		NewsSovereigntyChange,
		fmt.Sprintf("%s claims sovereignty over %s", factionName, countryISO),
		WithCountry(countryISO),
		WithFaction(factionName),
	)
}

// PublishBattleStart publishes a battle start news item.
func (nm *NewsManager) PublishBattleStart(countryISO string, agentCount int) {
	nm.Publish(
		NewsBattleStart,
		fmt.Sprintf("Battle erupting in %s — %d agents deployed", countryISO, agentCount),
		WithCountry(countryISO),
	)
}

// PublishBattleEnd publishes a battle end (victory) news item.
func (nm *NewsManager) PublishBattleEnd(countryISO, winnerFaction string) {
	nm.Publish(
		NewsBattleEnd,
		fmt.Sprintf("%s wins decisive battle in %s", winnerFaction, countryISO),
		WithCountry(countryISO),
		WithFaction(winnerFaction),
	)
}

// PublishWarDeclared publishes a war declaration news item.
func (nm *NewsManager) PublishWarDeclared(attackerFaction, defenderFaction string) {
	nm.Publish(
		NewsWarDeclared,
		fmt.Sprintf("%s declares war on %s", attackerFaction, defenderFaction),
		WithFaction(attackerFaction),
	)
}

// PublishTreatySigned publishes a treaty/agreement news item.
func (nm *NewsManager) PublishTreatySigned(faction1, faction2, treatyType string) {
	nm.Publish(
		NewsTreatySigned,
		fmt.Sprintf("%s signed between %s and %s", treatyType, faction1, faction2),
	)
}

// PublishEconomyEvent publishes an economy event news item.
func (nm *NewsManager) PublishEconomyEvent(headline string, countryISO string) {
	nm.Publish(
		NewsEconomyEvent,
		headline,
		WithCountry(countryISO),
	)
}

// PublishGlobalEvent publishes a global event news item.
func (nm *NewsManager) PublishGlobalEvent(headline string) {
	nm.Publish(NewsGlobalEvent, headline)
}
