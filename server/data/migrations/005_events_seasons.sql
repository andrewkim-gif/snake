-- 005_events_seasons.sql
-- Phase 6-7: 글로벌 이벤트 + 시즌/리더보드 테이블

-- ── 글로벌 이벤트 ──
CREATE TABLE IF NOT EXISTS tycoon_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tycoon_events_created ON tycoon_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tycoon_events_type ON tycoon_events(type);

-- ── 시즌 ──
CREATE TABLE IF NOT EXISTS tycoon_seasons (
  id TEXT PRIMARY KEY,
  number INT NOT NULL UNIQUE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_tycoon_seasons_active ON tycoon_seasons(is_active) WHERE is_active = TRUE;
