-- AI World War v11 — PostgreSQL Schema
-- Version: 1.0.0
-- Date: 2026-03-06
--
-- This schema defines the persistent data model for the geopolitical meta-game layer.
-- The real-time combat state remains in-memory (Go) and Redis; only meta-game data is persisted.

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM Types
-- ============================================================

CREATE TYPE country_tier AS ENUM ('S', 'A', 'B', 'C', 'D');
CREATE TYPE season_phase AS ENUM ('discovery', 'expansion', 'empires', 'reckoning');
CREATE TYPE season_status AS ENUM ('upcoming', 'active', 'final_rush', 'ended');
CREATE TYPE faction_role AS ENUM ('supreme_leader', 'council', 'commander', 'member');
CREATE TYPE diplomacy_type AS ENUM ('non_aggression', 'trade_agreement', 'military_alliance', 'economic_sanction', 'tribute');
CREATE TYPE diplomacy_status AS ENUM ('proposed', 'active', 'expired', 'broken');
CREATE TYPE battle_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- ============================================================
-- 1. users — Player accounts
-- ============================================================

CREATE TABLE users (
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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_faction ON users(faction_id);

-- ============================================================
-- 2. factions — Player organizations
-- ============================================================

CREATE TABLE factions (
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

CREATE INDEX idx_factions_name ON factions(name);
CREATE INDEX idx_factions_prestige ON factions(prestige DESC);

-- ============================================================
-- 3. faction_members — Faction membership
-- ============================================================

CREATE TABLE faction_members (
    faction_id  UUID         NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        faction_role NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (faction_id, user_id)
);

CREATE INDEX idx_faction_members_user ON faction_members(user_id);

-- ============================================================
-- 4. countries — 195 real-world countries
-- ============================================================

CREATE TABLE countries (
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

CREATE INDEX idx_countries_tier ON countries(tier);
CREATE INDEX idx_countries_sovereign ON countries(sovereign_faction_id);
CREATE INDEX idx_countries_continent ON countries(continent);
CREATE INDEX idx_countries_gdp ON countries(gdp DESC);

-- ============================================================
-- 5. seasons — Monthly competitive seasons
-- ============================================================

CREATE TABLE seasons (
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

CREATE INDEX idx_seasons_status ON seasons(status);
CREATE INDEX idx_seasons_number ON seasons(number DESC);

-- ============================================================
-- 6. battles — Country arena battle records
-- ============================================================

CREATE TABLE battles (
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

CREATE INDEX idx_battles_country ON battles(country_iso);
CREATE INDEX idx_battles_season ON battles(season_id);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_started ON battles(started_at DESC);

-- ============================================================
-- 7. diplomacy — Inter-faction relations
-- ============================================================

CREATE TABLE diplomacy (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            diplomacy_type   NOT NULL,
    faction_a       UUID             NOT NULL REFERENCES factions(id),
    faction_b       UUID             NOT NULL REFERENCES factions(id),
    status          diplomacy_status NOT NULL DEFAULT 'proposed',
    proposed_by     UUID             NOT NULL REFERENCES users(id),
    terms_json      JSONB,
    started_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    broken_at       TIMESTAMPTZ,
    broken_by       UUID,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diplomacy_factions ON diplomacy(faction_a, faction_b);
CREATE INDEX idx_diplomacy_status ON diplomacy(status);
CREATE INDEX idx_diplomacy_expires ON diplomacy(expires_at);

-- ============================================================
-- 8. achievements — Player achievements
-- ============================================================

CREATE TABLE achievements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_key VARCHAR(64)  NOT NULL,
    progress        INTEGER      DEFAULT 0,
    unlocked_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_key)
);

CREATE INDEX idx_achievements_user ON achievements(user_id);
CREATE INDEX idx_achievements_key ON achievements(achievement_key);

-- ============================================================
-- 9. wars — Formal war declarations between factions
-- ============================================================

CREATE TABLE wars (
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

CREATE INDEX idx_wars_factions ON wars(attacker_id, defender_id);
CREATE INDEX idx_wars_status ON wars(status);

-- ============================================================
-- 10. sovereignty_history — Track country ownership over time
-- ============================================================

CREATE TABLE sovereignty_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_iso     VARCHAR(3)   NOT NULL REFERENCES countries(iso3),
    faction_id      UUID         REFERENCES factions(id),
    season_id       UUID         REFERENCES seasons(id),
    gained_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    lost_at         TIMESTAMPTZ,
    peak_level      INTEGER      DEFAULT 1,
    peak_gdp        BIGINT       DEFAULT 0
);

CREATE INDEX idx_sovereignty_history_country ON sovereignty_history(country_iso);
CREATE INDEX idx_sovereignty_history_faction ON sovereignty_history(faction_id);

-- ============================================================
-- 11. api_keys — API key management for agent authentication
-- ============================================================

CREATE TABLE api_keys (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash    VARCHAR(128) NOT NULL UNIQUE,
    name        VARCHAR(64)  NOT NULL,
    prefix      VARCHAR(8)   NOT NULL,
    last_used   TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);

-- ============================================================
-- Foreign Key: users.faction_id → factions.id (deferred)
-- ============================================================

ALTER TABLE users
    ADD CONSTRAINT fk_users_faction
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL;

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_factions_updated_at
    BEFORE UPDATE ON factions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_countries_updated_at
    BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
