-- ============================================================
-- AI World War v18 — Supabase Setup Migration
-- ============================================================
-- Idempotent: 여러 번 실행해도 안전합니다.
-- Supabase Dashboard → SQL Editor에서 이 파일 전체를 붙여넣기 후 실행하세요.
-- ============================================================

-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. ENUM Types (idempotent)
-- ============================================================
DO $$ BEGIN CREATE TYPE country_tier AS ENUM ('S', 'A', 'B', 'C', 'D'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE season_phase AS ENUM ('discovery', 'expansion', 'empires', 'reckoning'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE season_status AS ENUM ('upcoming', 'active', 'final_rush', 'ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE faction_role AS ENUM ('supreme_leader', 'council', 'commander', 'member'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE diplomacy_type AS ENUM ('non_aggression', 'trade_agreement', 'military_alliance', 'economic_sanction', 'tribute'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE diplomacy_status AS ENUM ('proposed', 'active', 'expired', 'broken'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE battle_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3. Tables (CREATE TABLE IF NOT EXISTS)
-- ============================================================

-- 3.1 users
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(32)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    api_keys        TEXT[]       DEFAULT '{}',
    resources_json  JSONB        DEFAULT '{"gold": 1000, "oil": 0, "minerals": 0, "food": 0, "tech": 0, "influence": 0}'::jsonb,
    faction_id      UUID,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction_id);

-- 3.2 factions
CREATE TABLE IF NOT EXISTS factions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(64)  NOT NULL UNIQUE,
    tag             VARCHAR(8)   NOT NULL UNIQUE,
    color           VARCHAR(7)   NOT NULL DEFAULT '#FF0000',
    banner_url      TEXT,
    leader_id       UUID         NOT NULL,
    treasury        JSONB        DEFAULT '{"gold": 0, "oil": 0, "minerals": 0, "food": 0, "tech": 0, "influence": 0}'::jsonb,
    prestige        INTEGER      DEFAULT 0,
    member_count    INTEGER      DEFAULT 1,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factions_name ON factions(name);
CREATE INDEX IF NOT EXISTS idx_factions_prestige ON factions(prestige DESC);

-- 3.3 faction_members
CREATE TABLE IF NOT EXISTS faction_members (
    faction_id  UUID         NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        faction_role NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (faction_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_faction_members_user ON faction_members(user_id);

-- 3.4 countries
CREATE TABLE IF NOT EXISTS countries (
    iso3                VARCHAR(3)   PRIMARY KEY,
    name_original       VARCHAR(128) NOT NULL,
    name_custom         VARCHAR(128),
    continent           VARCHAR(32)  NOT NULL,
    tier                country_tier NOT NULL DEFAULT 'C',
    resources_json      JSONB        NOT NULL DEFAULT '{"oil": 0, "minerals": 0, "food": 0, "tech": 0, "manpower": 0}'::jsonb,
    sovereign_faction_id UUID,
    sovereignty_level   INTEGER      DEFAULT 0,
    sovereignty_streak  INTEGER      DEFAULT 0,
    gdp                 BIGINT       DEFAULT 0,
    arena_radius        FLOAT        DEFAULT 3000.0,
    max_agents          INTEGER      DEFAULT 100,
    terrain_theme       VARCHAR(32)  DEFAULT 'plains',
    adjacent_countries  TEXT[]       DEFAULT '{}',
    population          BIGINT       DEFAULT 0,
    capital_name        VARCHAR(128),
    latitude            FLOAT,
    longitude           FLOAT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_countries_tier ON countries(tier);
CREATE INDEX IF NOT EXISTS idx_countries_sovereign ON countries(sovereign_faction_id);
CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);
CREATE INDEX IF NOT EXISTS idx_countries_gdp ON countries(gdp DESC);

-- 3.5 seasons
CREATE TABLE IF NOT EXISTS seasons (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(128)  NOT NULL,
    number      INTEGER       NOT NULL UNIQUE,
    phase       season_phase  NOT NULL DEFAULT 'discovery',
    status      season_status NOT NULL DEFAULT 'upcoming',
    start_at    TIMESTAMPTZ   NOT NULL,
    end_at      TIMESTAMPTZ   NOT NULL,
    config_json JSONB         DEFAULT '{}'::jsonb,
    results_json JSONB,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_number ON seasons(number DESC);

-- 3.6 battles
CREATE TABLE IF NOT EXISTS battles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_iso     VARCHAR(3)    NOT NULL REFERENCES countries(iso3),
    season_id       UUID          REFERENCES seasons(id),
    battle_type     VARCHAR(32)   DEFAULT 'standard',
    status          battle_status NOT NULL DEFAULT 'scheduled',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_sec    INTEGER,
    participants    INTEGER       DEFAULT 0,
    results_json    JSONB,
    winner_faction_id UUID,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_battles_country ON battles(country_iso);
CREATE INDEX IF NOT EXISTS idx_battles_season ON battles(season_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_started ON battles(started_at DESC);

-- 3.7 diplomacy
CREATE TABLE IF NOT EXISTS diplomacy (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            diplomacy_type   NOT NULL,
    faction_a       UUID             NOT NULL REFERENCES factions(id),
    faction_b       UUID             NOT NULL REFERENCES factions(id),
    status          diplomacy_status NOT NULL DEFAULT 'proposed',
    proposed_by     UUID             NOT NULL,
    terms_json      JSONB,
    started_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    broken_at       TIMESTAMPTZ,
    broken_by       UUID,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diplomacy_factions ON diplomacy(faction_a, faction_b);
CREATE INDEX IF NOT EXISTS idx_diplomacy_status ON diplomacy(status);
CREATE INDEX IF NOT EXISTS idx_diplomacy_expires ON diplomacy(expires_at);

-- 3.8 achievements
CREATE TABLE IF NOT EXISTS achievements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL,
    achievement_key VARCHAR(64)  NOT NULL,
    progress        INTEGER      DEFAULT 0,
    unlocked_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_key)
);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_key ON achievements(achievement_key);

-- 3.9 wars
CREATE TABLE IF NOT EXISTS wars (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attacker_id     UUID         NOT NULL REFERENCES factions(id),
    defender_id     UUID         NOT NULL REFERENCES factions(id),
    season_id       UUID         REFERENCES seasons(id),
    status          VARCHAR(32)  NOT NULL DEFAULT 'preparing',
    declared_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    prep_ends_at    TIMESTAMPTZ  NOT NULL,
    ended_at        TIMESTAMPTZ,
    terms_json      JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wars_factions ON wars(attacker_id, defender_id);
CREATE INDEX IF NOT EXISTS idx_wars_status ON wars(status);

-- 3.10 sovereignty_history
CREATE TABLE IF NOT EXISTS sovereignty_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_iso     VARCHAR(3)   NOT NULL REFERENCES countries(iso3),
    faction_id      UUID         REFERENCES factions(id),
    season_id       UUID         REFERENCES seasons(id),
    gained_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    lost_at         TIMESTAMPTZ,
    peak_level      INTEGER      DEFAULT 1,
    peak_gdp        BIGINT       DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sovereignty_history_country ON sovereignty_history(country_iso);
CREATE INDEX IF NOT EXISTS idx_sovereignty_history_faction ON sovereignty_history(faction_id);

-- 3.11 api_keys
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL,
    key_hash    VARCHAR(128) NOT NULL UNIQUE,
    name        VARCHAR(64)  NOT NULL,
    prefix      VARCHAR(8)   NOT NULL,
    last_used   TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);

-- ============================================================
-- 4. Foreign Keys (deferred, idempotent)
-- ============================================================

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT fk_users_faction
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 5. Trigger: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_factions_updated_at BEFORE UPDATE ON factions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_countries_updated_at BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 6. Performance Indexes
-- ============================================================

-- Battles
CREATE INDEX IF NOT EXISTS idx_battles_country_status_active ON battles(country_iso, status) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_battles_completed_time ON battles(country_iso, ended_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_battles_season_country ON battles(season_id, country_iso, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_winner ON battles(winner_faction_id, ended_at DESC) WHERE winner_faction_id IS NOT NULL;

-- Countries / Sovereignty
CREATE INDEX IF NOT EXISTS idx_countries_faction_sov ON countries(sovereign_faction_id, sovereignty_level DESC) WHERE sovereign_faction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sovereignty_active ON sovereignty_history(country_iso, faction_id) WHERE lost_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sovereignty_faction_time ON sovereignty_history(faction_id, gained_at DESC);
CREATE INDEX IF NOT EXISTS idx_countries_tier_gdp ON countries(tier, gdp DESC);
CREATE INDEX IF NOT EXISTS idx_countries_continent_faction ON countries(continent, sovereign_faction_id) WHERE sovereign_faction_id IS NOT NULL;

-- Diplomacy
CREATE INDEX IF NOT EXISTS idx_diplomacy_faction_a_active ON diplomacy(faction_a, type) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_diplomacy_faction_b_active ON diplomacy(faction_b, type) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_diplomacy_expiring ON diplomacy(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

-- Wars
CREATE INDEX IF NOT EXISTS idx_wars_active ON wars(status) WHERE status IN ('preparing', 'active');
CREATE INDEX IF NOT EXISTS idx_wars_attacker_active ON wars(attacker_id, status) WHERE status IN ('preparing', 'active');
CREATE INDEX IF NOT EXISTS idx_wars_defender_active ON wars(defender_id, status) WHERE status IN ('preparing', 'active');

-- Users / Members
CREATE INDEX IF NOT EXISTS idx_faction_members_role ON faction_members(faction_id, role);
CREATE INDEX IF NOT EXISTS idx_users_faction_active ON users(faction_id) WHERE faction_id IS NOT NULL;

-- API Keys
-- Note: cannot use NOW() in index predicate (must be IMMUTABLE).
-- Instead, index all keys and filter at query time.
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_valid ON api_keys(key_hash, expires_at);

-- Achievements
CREATE INDEX IF NOT EXISTS idx_achievements_user_unlocked ON achievements(user_id, unlocked_at DESC) WHERE unlocked_at IS NOT NULL;

-- Seasons
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(status) WHERE status IN ('active', 'final_rush');

-- Update query planner stats
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

-- ============================================================
-- 7. PostgREST: Enable RLS but allow service_role full access
-- ============================================================

-- Enable RLS on all tables (Supabase requires this for security).
-- service_role key bypasses RLS automatically, so the Go server works as-is.
-- If you later add anon/authenticated access, add policies per table.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE faction_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diplomacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereignty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Done!
-- ============================================================
SELECT 'v18 Supabase setup complete — ' || COUNT(*)::text || ' tables' AS result
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
