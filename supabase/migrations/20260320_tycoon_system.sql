-- ============================================
-- Git City Tycoon - Database Migration
-- 8 tables + RLS + Indexes
-- Date: 2026-03-20
-- ============================================

-- 1. tycoon_buildings (건물 카탈로그)
CREATE TABLE tycoon_buildings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  name_en       TEXT,
  region_code   TEXT        NOT NULL,
  country_code  CHAR(2)    NOT NULL,
  city_code     TEXT        NOT NULL,
  district_code TEXT        NOT NULL,
  rarity        TEXT        NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  level         SMALLINT   NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  max_level     SMALLINT   NOT NULL DEFAULT 5,
  base_income   INTEGER    NOT NULL,
  visual_height REAL       NOT NULL DEFAULT 100,
  visual_width  REAL       NOT NULL DEFAULT 30,
  visual_depth  REAL       NOT NULL DEFAULT 30,
  visual_theme  TEXT       NOT NULL DEFAULT 'midnight',
  window_lit_pct REAL      NOT NULL DEFAULT 0.6,
  grid_x        REAL       NOT NULL DEFAULT 0,
  grid_z        REAL       NOT NULL DEFAULT 0,
  is_landmark   BOOLEAN    NOT NULL DEFAULT false,
  is_active     BOOLEAN    NOT NULL DEFAULT true,
  merge_target  BOOLEAN    NOT NULL DEFAULT false,
  description   TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buildings_region ON tycoon_buildings (region_code) WHERE is_active = true;
CREATE INDEX idx_buildings_rarity ON tycoon_buildings (rarity) WHERE is_active = true;
CREATE INDEX idx_buildings_city   ON tycoon_buildings (country_code, city_code) WHERE is_active = true;
CREATE INDEX idx_buildings_active ON tycoon_buildings (is_active, rarity);

-- 2. tycoon_ownership (소유권)
CREATE TABLE tycoon_ownership (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   UUID        NOT NULL REFERENCES tycoon_buildings(id),
  owner_id      UUID        NOT NULL REFERENCES auth.users(id),
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchase_price BIGINT     NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_upgrade_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  depreciation_pct REAL     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ownership_active ON tycoon_ownership (building_id) WHERE is_active = true;
CREATE INDEX idx_ownership_owner ON tycoon_ownership (owner_id) WHERE is_active = true;
CREATE INDEX idx_ownership_building ON tycoon_ownership (building_id, is_active);

-- 3. tycoon_auctions (경매)
CREATE TABLE tycoon_auctions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   UUID        NOT NULL REFERENCES tycoon_buildings(id),
  auction_type  TEXT        NOT NULL CHECK (auction_type IN (
    'regular','premium','legendary','player_sell','flash_sale'
  )),
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','active','ended','cancelled','failed'
  )),
  starting_bid  BIGINT      NOT NULL,
  current_bid   BIGINT      NOT NULL DEFAULT 0,
  bid_increment BIGINT      NOT NULL,
  winner_id     UUID        REFERENCES auth.users(id),
  seller_id     UUID        REFERENCES auth.users(id),
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  original_end  TIMESTAMPTZ NOT NULL,
  snipe_extended BOOLEAN    NOT NULL DEFAULT false,
  snipe_count   SMALLINT   NOT NULL DEFAULT 0,
  bid_count     INTEGER    NOT NULL DEFAULT 0,
  npc_bid_count INTEGER    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auctions_status_end ON tycoon_auctions (status, end_at) WHERE status = 'active';
CREATE INDEX idx_auctions_building ON tycoon_auctions (building_id, status);
CREATE INDEX idx_auctions_type ON tycoon_auctions (auction_type, status);
CREATE INDEX idx_auctions_winner ON tycoon_auctions (winner_id) WHERE status = 'ended';

-- 4. tycoon_bids (입찰)
CREATE TABLE tycoon_bids (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id    UUID        NOT NULL REFERENCES tycoon_auctions(id),
  bidder_id     UUID        NOT NULL REFERENCES auth.users(id),
  amount        BIGINT      NOT NULL,
  is_npc        BOOLEAN     NOT NULL DEFAULT false,
  npc_name      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_auction ON tycoon_bids (auction_id, amount DESC);
CREATE INDEX idx_bids_bidder  ON tycoon_bids (bidder_id, created_at DESC);
CREATE INDEX idx_bids_auction_time ON tycoon_bids (auction_id, created_at DESC);

-- 5. tycoon_transactions (거래 이력)
CREATE TABLE tycoon_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id),
  transaction_type TEXT       NOT NULL CHECK (transaction_type IN (
    'auction_buy','auction_sell','merge_cost','income','maintenance',
    'depreciation','decoration_buy','daily_bonus','achievement_reward',
    'event_reward','refund'
  )),
  amount          BIGINT      NOT NULL,
  fee             BIGINT      NOT NULL DEFAULT 0,
  balance_before  BIGINT      NOT NULL,
  balance_after   BIGINT      NOT NULL,
  ref_type        TEXT,
  ref_id          UUID,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user ON tycoon_transactions (user_id, created_at DESC);
CREATE INDEX idx_transactions_type ON tycoon_transactions (user_id, transaction_type);
CREATE INDEX idx_transactions_ref  ON tycoon_transactions (ref_type, ref_id);

-- 6. tycoon_merges (합병 이력)
CREATE TABLE tycoon_merges (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id),
  source_building_ids UUID[]    NOT NULL,
  result_building_id  UUID      NOT NULL REFERENCES tycoon_buildings(id),
  merge_cost        BIGINT      NOT NULL,
  income_before     BIGINT      NOT NULL,
  income_after      BIGINT      NOT NULL,
  level_before      SMALLINT    NOT NULL,
  level_after       SMALLINT    NOT NULL,
  rarity_before     TEXT        NOT NULL,
  rarity_after      TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merges_user ON tycoon_merges (user_id, created_at DESC);

-- 7. tycoon_income_log (수익 정산 기록)
CREATE TABLE tycoon_income_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  building_id   UUID        NOT NULL REFERENCES tycoon_buildings(id),
  gross_income  BIGINT      NOT NULL,
  maintenance   BIGINT      NOT NULL DEFAULT 0,
  net_income    BIGINT      NOT NULL,
  base_income   INTEGER     NOT NULL,
  level_mult    REAL        NOT NULL,
  region_mult   REAL        NOT NULL,
  synergy_mult  REAL        NOT NULL,
  depreciation  REAL        NOT NULL DEFAULT 0,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_user_period ON tycoon_income_log (user_id, period_end DESC);
CREATE INDEX idx_income_building    ON tycoon_income_log (building_id, period_end DESC);

-- 8. tycoon_player_stats (플레이어 통계)
CREATE TABLE tycoon_player_stats (
  user_id          UUID       PRIMARY KEY REFERENCES auth.users(id),
  portfolio_value  BIGINT     NOT NULL DEFAULT 0,
  total_income     BIGINT     NOT NULL DEFAULT 0,
  total_spent      BIGINT     NOT NULL DEFAULT 0,
  building_count   INTEGER    NOT NULL DEFAULT 0,
  highest_rarity   TEXT       NOT NULL DEFAULT 'common',
  merge_count      INTEGER    NOT NULL DEFAULT 0,
  auction_wins     INTEGER    NOT NULL DEFAULT 0,
  title            TEXT       NOT NULL DEFAULT 'beginner',
  district_synergies INTEGER  NOT NULL DEFAULT 0,
  city_dominations   INTEGER  NOT NULL DEFAULT 0,
  first_building_at  TIMESTAMPTZ,
  last_income_at     TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stats_portfolio ON tycoon_player_stats (portfolio_value DESC);
CREATE INDEX idx_stats_income    ON tycoon_player_stats (total_income DESC);

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- tycoon_buildings: 모두 읽기 가능, 서버만 수정
ALTER TABLE tycoon_buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buildings_read_all" ON tycoon_buildings FOR SELECT USING (true);
CREATE POLICY "buildings_service_only" ON tycoon_buildings FOR ALL
  USING (auth.role() = 'service_role');

-- tycoon_ownership: 모두 읽기 가능, 서버만 수정
ALTER TABLE tycoon_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ownership_read_all" ON tycoon_ownership FOR SELECT USING (true);
CREATE POLICY "ownership_service_only" ON tycoon_ownership FOR ALL
  USING (auth.role() = 'service_role');

-- tycoon_auctions: 모두 읽기 가능, 서버만 수정
ALTER TABLE tycoon_auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auctions_read_all" ON tycoon_auctions FOR SELECT USING (true);
CREATE POLICY "auctions_service_only" ON tycoon_auctions FOR ALL
  USING (auth.role() = 'service_role');

-- tycoon_bids: 모두 읽기, 자신의 입찰만 INSERT
ALTER TABLE tycoon_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids_read_all" ON tycoon_bids FOR SELECT USING (true);
CREATE POLICY "bids_insert_own" ON tycoon_bids FOR INSERT
  WITH CHECK (auth.uid() = bidder_id AND is_npc = false);

-- tycoon_transactions: 자신의 거래만 읽기
ALTER TABLE tycoon_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_read_own" ON tycoon_transactions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "tx_service_only" ON tycoon_transactions FOR INSERT
  USING (auth.role() = 'service_role');

-- tycoon_merges: 자신의 합병만 읽기
ALTER TABLE tycoon_merges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merges_read_own" ON tycoon_merges FOR SELECT
  USING (auth.uid() = user_id);

-- tycoon_income_log: 자신의 수익만 읽기
ALTER TABLE tycoon_income_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income_read_own" ON tycoon_income_log FOR SELECT
  USING (auth.uid() = user_id);

-- tycoon_player_stats: 모두 읽기 (리더보드), 서버만 수정
ALTER TABLE tycoon_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_read_all" ON tycoon_player_stats FOR SELECT USING (true);
CREATE POLICY "stats_service_only" ON tycoon_player_stats FOR ALL
  USING (auth.role() = 'service_role');
