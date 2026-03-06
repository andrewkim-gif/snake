package cache

import "fmt"

// ============================================================
// Redis Channel Definitions for AI World War v11
// ============================================================
//
// Channel naming convention:
//   {domain}:{identifier}
//
// Pub/Sub channels carry real-time events between Game Server,
// Meta Server, and Background Workers via Redis pub/sub.
// Cache keys use the same prefix convention for organized storage.

// --- Pub/Sub Channels ---

// GameChannel returns the channel for a specific country's game events.
// Published: battle state updates, round start/end
// Subscribers: spectators, meta server
func GameChannel(countryISO string) string {
	return fmt.Sprintf("game:%s", countryISO)
}

// SovereigntyChannel returns the channel for sovereignty change events.
// Published: when a country's sovereignty changes
// Subscribers: world map clients, meta server
func SovereigntyChannel(countryISO string) string {
	return fmt.Sprintf("sovereignty:%s", countryISO)
}

// BattleChannel returns the channel for battle result events.
// Published: when a battle completes with results
// Subscribers: meta server (for sovereignty processing)
func BattleChannel(countryISO string) string {
	return fmt.Sprintf("battle:%s", countryISO)
}

// GlobalEventsChannel is the channel for global game events.
// Published: war declarations, faction changes, season transitions
// Subscribers: all connected clients, news feed
const GlobalEventsChannel = "global:events"

// EconomyChannel is the channel for economy tick updates.
// Published: hourly by background worker
// Subscribers: meta server, economy dashboards
const EconomyChannel = "economy:tick"

// DiplomacyChannel is the channel for diplomacy events.
// Published: treaty changes, war declarations
// Subscribers: faction dashboards
const DiplomacyChannel = "diplomacy:events"

// NewsChannel is the channel for news feed items.
// Published: by event generators
// Subscribers: news feed UI
const NewsChannel = "news:feed"

// --- Cache Key Prefixes ---

// SessionKey returns the Redis key for a user session.
func SessionKey(userID string) string {
	return fmt.Sprintf("session:%s", userID)
}

// CountryStateKey returns the Redis key for a country's cached state.
func CountryStateKey(countryISO string) string {
	return fmt.Sprintf("country:state:%s", countryISO)
}

// BattleStateKey returns the Redis key for an active battle's state.
func BattleStateKey(countryISO string) string {
	return fmt.Sprintf("battle:state:%s", countryISO)
}

// FactionCacheKey returns the Redis key for faction cached data.
func FactionCacheKey(factionID string) string {
	return fmt.Sprintf("faction:%s", factionID)
}

// LeaderboardKey returns the Redis key for a leaderboard.
func LeaderboardKey(leaderboardType string) string {
	return fmt.Sprintf("leaderboard:%s", leaderboardType)
}

// RateLimitKey returns the Redis key for API rate limiting.
func RateLimitKey(apiKeyPrefix string) string {
	return fmt.Sprintf("ratelimit:%s", apiKeyPrefix)
}

// AgentStateKey returns the Redis key for an agent's cached state.
func AgentStateKey(agentID string) string {
	return fmt.Sprintf("agent:state:%s", agentID)
}

// WorldStateKey is the Redis key for the cached world map state.
const WorldStateKey = "world:state"

// SeasonKey returns the Redis key for the current season state.
const SeasonKey = "season:current"

// --- Channel Patterns (for pattern subscriptions) ---

// AllGameChannels matches all game:* channels.
const AllGameChannels = "game:*"

// AllSovereigntyChannels matches all sovereignty:* channels.
const AllSovereigntyChannels = "sovereignty:*"

// AllBattleChannels matches all battle:* channels.
const AllBattleChannels = "battle:*"

// --- Session TTLs ---

const (
	// SessionTTL is the default session duration (24 hours).
	SessionTTL = 24 * 60 * 60 // seconds

	// RefreshSessionTTL is the session duration after refresh (30 days).
	RefreshSessionTTL = 30 * 24 * 60 * 60 // seconds

	// CountryCacheTTL is how long country state is cached (5 seconds).
	CountryCacheTTL = 5

	// LeaderboardCacheTTL is how long leaderboards are cached (10 seconds).
	LeaderboardCacheTTL = 10
)
