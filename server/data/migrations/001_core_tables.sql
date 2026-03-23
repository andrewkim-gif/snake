-- Migration 001: Core tables for Git City Tycoon (Railway PostgreSQL)
-- Phase 0 — direct PG schema (parallel to Supabase REST)

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,           -- Supabase auth user ID
    name TEXT NOT NULL,
    nationality TEXT DEFAULT '',
    mc_balance BIGINT DEFAULT 0,   -- Market Cap
    level INT DEFAULT 1,
    xp BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ko TEXT DEFAULT '',
    region_code TEXT NOT NULL,      -- 'seoul-gangnam'
    rarity TEXT NOT NULL DEFAULT 'common',
    base_income INT DEFAULT 100,
    level INT DEFAULT 1,
    owner_id TEXT REFERENCES players(id),
    owner_name TEXT,
    is_auctioning BOOLEAN DEFAULT FALSE,
    defense_power INT DEFAULT 10,
    garrison_capacity INT DEFAULT 5,
    visual_height INT DEFAULT 100,
    visual_width INT DEFAULT 40,
    visual_depth INT DEFAULT 40,
    position_x FLOAT DEFAULT 0,
    position_z FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buildings_region ON buildings(region_code);
CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_id);

CREATE TABLE IF NOT EXISTS territories (
    region_code TEXT PRIMARY KEY,
    controller_id TEXT REFERENCES players(id),
    controller_name TEXT,
    control_pct FLOAT DEFAULT 0,
    sovereignty_level TEXT DEFAULT 'none',
    sovereignty_streak INT DEFAULT 0,
    last_settlement TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS armies (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES players(id),
    unit_type TEXT NOT NULL,        -- infantry, armor, air, special, hero
    count INT DEFAULT 0,
    level INT DEFAULT 1,
    stationed_region TEXT,
    status TEXT DEFAULT 'idle',     -- idle, marching, fighting, returning
    target_region TEXT,
    arrival_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_armies_owner ON armies(owner_id);
CREATE INDEX IF NOT EXISTS idx_armies_region ON armies(stationed_region);

CREATE TABLE IF NOT EXISTS battles (
    id TEXT PRIMARY KEY,
    attacker_id TEXT NOT NULL REFERENCES players(id),
    defender_id TEXT REFERENCES players(id),
    target_region TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, marching, fighting, completed
    result TEXT,                    -- attacker_win, defender_win, draw
    attacker_units JSONB,
    defender_units JSONB,
    replay_data JSONB,
    mc_looted BIGINT DEFAULT 0,
    buildings_captured TEXT[],
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auctions (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id),
    auction_type TEXT DEFAULT 'regular',
    status TEXT DEFAULT 'active',
    starting_bid BIGINT NOT NULL,
    current_bid BIGINT DEFAULT 0,
    bid_increment BIGINT DEFAULT 0,
    winner_id TEXT REFERENCES players(id),
    winner_name TEXT,
    seller_id TEXT REFERENCES players(id),
    start_at TIMESTAMPTZ DEFAULT NOW(),
    end_at TIMESTAMPTZ NOT NULL,
    snipe_extensions INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_building ON auctions(building_id);

CREATE TABLE IF NOT EXISTS auction_bids (
    id TEXT PRIMARY KEY,
    auction_id TEXT NOT NULL REFERENCES auctions(id),
    bidder_id TEXT NOT NULL REFERENCES players(id),
    bidder_name TEXT,
    amount BIGINT NOT NULL,
    is_npc BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alliances (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    leader_id TEXT NOT NULL REFERENCES players(id),
    formed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alliance_members (
    alliance_id TEXT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (alliance_id, player_id)
);

CREATE TABLE IF NOT EXISTS wars (
    id TEXT PRIMARY KEY,
    state TEXT DEFAULT 'preparation',
    declaration_type TEXT DEFAULT 'hegemony',
    attacker_id TEXT NOT NULL,
    defender_id TEXT NOT NULL,
    attacker_score INT DEFAULT 0,
    defender_score INT DEFAULT 0,
    declared_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    outcome TEXT
);

CREATE TABLE IF NOT EXISTS income_log (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id),
    building_id TEXT REFERENCES buildings(id),
    amount BIGINT NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount BIGINT NOT NULL,
    balance_before BIGINT,
    balance_after BIGINT,
    ref_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id);
