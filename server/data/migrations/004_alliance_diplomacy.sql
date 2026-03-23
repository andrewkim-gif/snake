-- Migration 004: Alliance diplomacy enhancements for Tycoon mode
-- Adds left_at column to alliance_members for betrayal cooldown tracking (72h)

ALTER TABLE alliance_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_alliance_members_player ON alliance_members(player_id);
CREATE INDEX IF NOT EXISTS idx_alliance_members_left ON alliance_members(player_id, left_at);
CREATE INDEX IF NOT EXISTS idx_wars_state ON wars(state);
