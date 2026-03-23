-- Migration 003: P2P Trade Exchange (오더북 기반 플레이어 거래소)

CREATE TABLE IF NOT EXISTS trade_orders (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id),
    order_type TEXT NOT NULL,          -- 'sell' | 'buy'
    player_id TEXT NOT NULL REFERENCES players(id),
    player_name TEXT,
    price BIGINT NOT NULL,
    status TEXT DEFAULT 'active',      -- active, matched, cancelled, expired
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    matched_with TEXT REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_trade_orders_building ON trade_orders(building_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_orders_player ON trade_orders(player_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_orders_status ON trade_orders(status, expires_at);
