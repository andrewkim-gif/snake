-- ============================================================
-- S39: PostgreSQL Performance Indexes
-- Migration: 002_performance_indexes.sql
-- Date: 2026-03-06
--
-- Adds composite and partial indexes for hot query paths:
--   1. Battle queries (active battles by country/season)
--   2. Sovereignty lookups (faction territories)
--   3. Leaderboard/ranking queries
--   4. Economy tick batch updates
--   5. Diplomacy active relations
-- ============================================================

-- ============================================================
-- 1. Battle Query Optimization
-- Hot path: "Get active battles for a country in current season"
-- ============================================================

-- Composite index: active battles per country
-- Used by: WorldManager battle scheduling, result lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_country_status_active
    ON battles(country_iso, status)
    WHERE status IN ('scheduled', 'in_progress');

-- Composite index: completed battles by time (for battle history)
-- Used by: Agent battle log API, season stats
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_completed_time
    ON battles(country_iso, ended_at DESC)
    WHERE status = 'completed';

-- Season-scoped battle lookup
-- Used by: Season stats aggregation, hall of fame
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_season_country
    ON battles(season_id, country_iso, started_at DESC);

-- Winner faction analysis
-- Used by: Faction rankings, sovereignty history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battles_winner
    ON battles(winner_faction_id, ended_at DESC)
    WHERE winner_faction_id IS NOT NULL;

-- ============================================================
-- 2. Sovereignty & Territory Optimization
-- Hot path: "Get all countries owned by a faction"
-- ============================================================

-- Faction territory lookup (with sovereignty level for sorting)
-- Used by: Faction dashboard, territory count, continental bonuses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_countries_faction_sov
    ON countries(sovereign_faction_id, sovereignty_level DESC)
    WHERE sovereign_faction_id IS NOT NULL;

-- Active sovereignty history (not yet lost)
-- Used by: Real-time territory tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sovereignty_active
    ON sovereignty_history(country_iso, faction_id)
    WHERE lost_at IS NULL;

-- Faction sovereignty history
-- Used by: Faction analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sovereignty_faction_time
    ON sovereignty_history(faction_id, gained_at DESC);

-- ============================================================
-- 3. Economy & GDP Optimization
-- Hot path: "Get top countries by GDP for leaderboard"
-- ============================================================

-- GDP ranking with tier filter
-- Used by: Economy dashboard, GDP leaderboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_countries_tier_gdp
    ON countries(tier, gdp DESC);

-- Continent-scoped GDP (for continental bonus calculation)
-- Used by: Continental bonus background worker
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_countries_continent_faction
    ON countries(continent, sovereign_faction_id)
    WHERE sovereign_faction_id IS NOT NULL;

-- ============================================================
-- 4. Diplomacy Optimization
-- Hot path: "Get all active treaties for a faction"
-- ============================================================

-- Active diplomacy lookup for faction A
-- Used by: Faction dashboard, diplomacy engine
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diplomacy_faction_a_active
    ON diplomacy(faction_a, type)
    WHERE status = 'active';

-- Active diplomacy lookup for faction B
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diplomacy_faction_b_active
    ON diplomacy(faction_b, type)
    WHERE status = 'active';

-- Expiring treaties (for DiplomacyTicker worker)
-- Used by: Background worker to process treaty expirations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diplomacy_expiring
    ON diplomacy(expires_at)
    WHERE status = 'active' AND expires_at IS NOT NULL;

-- ============================================================
-- 5. Wars Optimization
-- Hot path: "Get active wars for a faction"
-- ============================================================

-- Active wars lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wars_active
    ON wars(status)
    WHERE status IN ('preparing', 'active');

-- Faction wars (both attacker and defender)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wars_attacker_active
    ON wars(attacker_id, status)
    WHERE status IN ('preparing', 'active');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wars_defender_active
    ON wars(defender_id, status)
    WHERE status IN ('preparing', 'active');

-- ============================================================
-- 6. User & Faction Member Optimization
-- Hot path: "Get faction members with roles"
-- ============================================================

-- Faction member listing by role
-- Used by: Faction management, permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_faction_members_role
    ON faction_members(faction_id, role);

-- User faction lookup (quick faction check)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_faction_active
    ON users(faction_id)
    WHERE faction_id IS NOT NULL;

-- ============================================================
-- 7. API Key Optimization
-- Hot path: "Validate API key on every request"
-- ============================================================

-- API key hash lookup with expiration check
-- Used by: Auth middleware on every API request
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_hash_valid
    ON api_keys(key_hash)
    WHERE expires_at IS NULL OR expires_at > NOW();

-- ============================================================
-- 8. Achievement Optimization
-- Hot path: "Get user achievements for profile"
-- ============================================================

-- Unlocked achievements per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_achievements_user_unlocked
    ON achievements(user_id, unlocked_at DESC)
    WHERE unlocked_at IS NOT NULL;

-- ============================================================
-- 9. Season Optimization
-- ============================================================

-- Current active season (should always be 0 or 1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seasons_active
    ON seasons(status)
    WHERE status IN ('active', 'final_rush');

-- ============================================================
-- ANALYZE tables for updated query plans
-- ============================================================

ANALYZE battles;
ANALYZE countries;
ANALYZE sovereignty_history;
ANALYZE diplomacy;
ANALYZE wars;
ANALYZE faction_members;
ANALYZE users;
ANALYZE api_keys;
ANALYZE achievements;
ANALYZE seasons;
