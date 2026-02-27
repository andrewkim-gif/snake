-- ============================================================
-- Snake Arena - Supabase Database Schema v2.0
-- ============================================================
-- Version: 2.0 (Revised for snake.io style — arena-based)
-- Date: 2026-02-27
-- Changes: Removed room tables, added arena stats, updated scoring
-- ============================================================

-- ============================================================
-- 1. Player Profiles (Anonymous First + Progressive Auth)
-- ============================================================

CREATE TABLE player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Display
  display_name VARCHAR(16) NOT NULL DEFAULT 'Snake',
  skin_id INTEGER NOT NULL DEFAULT 0,

  -- Lifetime Stats
  total_games INTEGER NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  total_deaths INTEGER NOT NULL DEFAULT 0,
  total_orbs_collected BIGINT NOT NULL DEFAULT 0,
  total_playtime_seconds BIGINT NOT NULL DEFAULT 0,

  -- Records
  best_score INTEGER NOT NULL DEFAULT 0,
  best_length INTEGER NOT NULL DEFAULT 0,
  best_kills_in_game INTEGER NOT NULL DEFAULT 0,
  best_survival_seconds INTEGER NOT NULL DEFAULT 0,

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ
);

-- Index for leaderboard queries
CREATE INDEX idx_profiles_best_score ON player_profiles(best_score DESC);
CREATE INDEX idx_profiles_auth_id ON player_profiles(auth_id) WHERE auth_id IS NOT NULL;

-- ============================================================
-- 2. Game Sessions (Per-Life Records)
-- ============================================================

CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,

  -- Session Data
  score INTEGER NOT NULL DEFAULT 0,
  max_length INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  orbs_collected INTEGER NOT NULL DEFAULT 0,

  -- Timing
  duration_seconds INTEGER NOT NULL DEFAULT 0,

  -- Death Info
  death_cause VARCHAR(20) NOT NULL DEFAULT 'collision',
  -- 'collision' = hit another snake body
  -- 'boundary'  = hit arena edge
  -- 'disconnect' = player left
  killed_by_name VARCHAR(16),

  -- Arena Info
  arena_server_id VARCHAR(64),
  final_rank INTEGER,           -- leaderboard rank at death
  peak_rank INTEGER,            -- highest rank reached this life

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for leaderboard and stats
CREATE INDEX idx_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_sessions_score ON game_sessions(score DESC);
CREATE INDEX idx_sessions_started ON game_sessions(started_at DESC);
CREATE INDEX idx_sessions_daily ON game_sessions(started_at DESC, score DESC);

-- ============================================================
-- 3. Daily Leaderboard (Materialized View)
-- ============================================================

CREATE MATERIALIZED VIEW daily_leaderboard AS
SELECT
  pp.id AS player_id,
  pp.display_name,
  pp.skin_id,
  MAX(gs.score) AS best_score,
  SUM(gs.kills) AS total_kills,
  COUNT(gs.id) AS games_played,
  MAX(gs.max_length) AS best_length
FROM game_sessions gs
JOIN player_profiles pp ON gs.player_id = pp.id
WHERE gs.started_at >= CURRENT_DATE
GROUP BY pp.id, pp.display_name, pp.skin_id
ORDER BY best_score DESC
LIMIT 100;

-- Refresh every 5 minutes via cron
CREATE INDEX idx_daily_lb_score ON daily_leaderboard(best_score DESC);

-- ============================================================
-- 4. All-Time Leaderboard View
-- ============================================================

CREATE VIEW alltime_leaderboard AS
SELECT
  id AS player_id,
  display_name,
  skin_id,
  best_score,
  total_kills,
  total_games,
  best_kills_in_game,
  best_survival_seconds
FROM player_profiles
ORDER BY best_score DESC
LIMIT 100;

-- ============================================================
-- 5. Skins Registry
-- ============================================================

CREATE TABLE skins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(32) NOT NULL,
  primary_color VARCHAR(7) NOT NULL,    -- hex
  secondary_color VARCHAR(7) NOT NULL,  -- hex
  pattern VARCHAR(16) NOT NULL DEFAULT 'solid',
  eye_style VARCHAR(16) NOT NULL DEFAULT 'default',
  unlock_condition VARCHAR(64),          -- NULL = free
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default skins
INSERT INTO skins (name, primary_color, secondary_color, pattern, eye_style) VALUES
  ('Neon Green',  '#00ff41', '#00cc33', 'solid',    'default'),
  ('Cyber Cyan',  '#00d4ff', '#0099cc', 'striped',  'cool'),
  ('Flame',       '#ff6b35', '#cc4400', 'gradient', 'angry'),
  ('Purple Haze', '#a855f7', '#7c3aed', 'solid',    'default'),
  ('Rose',        '#f43f5e', '#dc2626', 'striped',  'cute'),
  ('Gold Rush',   '#fbbf24', '#d97706', 'gradient', 'cool'),
  ('Emerald',     '#34d399', '#059669', 'solid',    'default'),
  ('Sakura',      '#f472b6', '#ec4899', 'dotted',   'cute'),
  ('Arctic',      '#67e8f9', '#22d3ee', 'striped',  'cool'),
  ('Lava',        '#ef4444', '#ff6b00', 'gradient', 'angry'),
  ('Shadow',      '#6b7280', '#374151', 'solid',    'cool'),
  ('Rainbow',     '#f59e0b', '#8b5cf6', 'striped',  'default');

-- ============================================================
-- 6. Row Level Security (RLS)
-- ============================================================

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Players can read all profiles (for leaderboard)
CREATE POLICY "Public read profiles" ON player_profiles
  FOR SELECT USING (true);

-- Players can only update their own profile
CREATE POLICY "Update own profile" ON player_profiles
  FOR UPDATE USING (auth.uid() = auth_id);

-- Game sessions: public read, server-only insert
CREATE POLICY "Public read sessions" ON game_sessions
  FOR SELECT USING (true);

-- Server uses service_role key to insert sessions
CREATE POLICY "Server insert sessions" ON game_sessions
  FOR INSERT WITH CHECK (true);

-- Skins: public read
ALTER TABLE skins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read skins" ON skins
  FOR SELECT USING (true);

-- ============================================================
-- 7. Triggers & Functions
-- ============================================================

-- Auto-update player_profiles stats on game_session insert
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE player_profiles SET
    total_games = total_games + 1,
    total_kills = total_kills + NEW.kills,
    total_deaths = total_deaths + 1,
    total_orbs_collected = total_orbs_collected + NEW.orbs_collected,
    total_playtime_seconds = total_playtime_seconds + NEW.duration_seconds,
    best_score = GREATEST(best_score, NEW.score),
    best_length = GREATEST(best_length, NEW.max_length),
    best_kills_in_game = GREATEST(best_kills_in_game, NEW.kills),
    best_survival_seconds = GREATEST(best_survival_seconds, NEW.duration_seconds),
    last_played_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.player_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_player_stats
  AFTER INSERT ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_player_stats();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON player_profiles
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
