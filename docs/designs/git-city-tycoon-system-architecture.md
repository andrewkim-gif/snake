# Git City Tycoon — System Architecture Document

> **Status**: Proposed | **Version**: 1.0 | **Date**: 2026-03-20
> **Input**: PLAN.md, PRD-git-city-tycoon-2026-03-20.md, git-city-tycoon-roadmap.md
> **Handoff**: /da:design (UI/UX) → /da:dev (Backend 구현)

---

## 1. Overview

Git City Tycoon은 기존 app_ingame의 Vampire Survivors 액션 게임을 **완전 대체**하는 실시간 부동산 타이쿤 게임이다.
git-city의 Three.js 3D 복셀 도시 렌더링 엔진을 포팅하여, 플레이어가 실제 랜드마크 건물을 경매로 구매하고, 합병/재개발하며, 패시브 수익(Market Cap)을 얻는 경제 시뮬레이션을 제공한다.

### Goals
- 장르 전환: 액션 → Idle + Event Hybrid 부동산 타이쿤
- 핵심 루프: 경매 입찰 → 건물 소유 → 패시브 수익 → 합병/재개발 → 재투자
- 3D 비주얼: git-city InstancedMesh + GLSL 셰이더 + 테마 시스템 포팅
- 재화 연속성: 기존 Market Cap(크레딧) 시스템 그대로 활용

### Non-Goals
- 전투 시스템 유지 (완전 제거)
- PvP 직접 대전 (경매 경쟁만 존재)
- 실시간 멀티플레이어 도시 동시 편집

---

## 2. Architecture Decisions (ADR Summary)

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | 전투 시스템 완전 제거 | 장르 완전 전환, 클린 컷이 유지보수 비용 절감 |
| ADR-002 | git-city 3D 엔진 직접 포팅 | npm 패키지화 대비 빠른 포팅 + 커스터마이징 자유도 |
| ADR-003 | 경매 서버 사이드 (Edge Functions) | 경쟁 시스템 클라이언트 신뢰 불가, 조작 방지 |
| ADR-004 | Market Cap 단일 재화 유지 | 복잡도 최소화, 기존 유저 재화 연속성 보장 |
| ADR-005 | 단계별 지역 확장 | 데이터 큐레이션 부담 분산, 핵심 메카닉 검증 후 확장 |
| ADR-006 | RPC for 원자적 트랜잭션 | 입찰/합병/정산은 다중 테이블 원자적 업데이트 필수 |
| ADR-007 | 이중 영속성 유지 | localStorage(오프라인) + Supabase(동기화), cloud > local 정책 |
| ADR-008 | Phase 1 폴링 → Phase 5 Realtime | 초기 복잡도 최소화, Realtime은 경매 고도화 시 도입 |

---

## 3. C4 Level 2 — Container Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AWW Platform (Browser)                       │
│                                                                     │
│  ┌────────────────┐  ┌───────────────────────────┐                  │
│  │   Globe View   │──│    Git City Tycoon SPA    │                  │
│  │  (나라 선택)    │  │    (React 19 + Vite 6)    │                  │
│  └────────────────┘  │                           │                  │
│                      │  ┌─────────┐ ┌─────────┐  │                  │
│                      │  │ city3d/ │ │tycoon/  │  │                  │
│                      │  │ R3F     │ │ engine/ │  │                  │
│                      │  │ Three.js│ │ data/   │  │                  │
│                      │  │ GLSL    │ │ config/ │  │                  │
│                      │  └────┬────┘ └────┬────┘  │                  │
│                      │       │           │        │                  │
│                      │  ┌────┴───────────┴────┐  │                  │
│                      │  │  hooks/ + api/       │  │                  │
│                      │  │  (State + Data Layer)│  │                  │
│                      │  └──────────┬──────────┘  │                  │
│                      └─────────────┼─────────────┘                  │
└────────────────────────────────────┼────────────────────────────────┘
                                     │ HTTPS / WSS
                    ┌────────────────┼────────────────────┐
                    │          Supabase Cloud              │
                    │                                      │
                    │  ┌──────────┐  ┌──────────────────┐  │
                    │  │   Auth   │  │   PostgreSQL DB   │  │
                    │  │ (Google  │  │  8 tycoon_ tables │  │
                    │  │  OAuth)  │  │  + game_saves     │  │
                    │  └──────────┘  │  + user_profiles  │  │
                    │                │  + RLS policies   │  │
                    │  ┌──────────┐  └──────────────────┘  │
                    │  │  Edge    │  ┌──────────────────┐  │
                    │  │Functions │  │   Realtime       │  │
                    │  │ -auction │  │ (Phase 5: 경매   │  │
                    │  │ -income  │  │  입찰 알림)      │  │
                    │  │ -npc-bid │  └──────────────────┘  │
                    │  └──────────┘                        │
                    │  ┌──────────┐                        │
                    │  │ pg_cron  │                        │
                    │  │ -4h 경매 │                        │
                    │  │ -1h 정산 │                        │
                    │  └──────────┘                        │
                    └─────────────────────────────────────┘
```

---

## 4. C4 Level 3 — Component Diagram

### 4.1 Client-Side Component Architecture

```
app_ingame/
│
├── index.tsx ─────────────────── 진입점 (React root mount)
├── App.tsx ───────────────────── 라우팅 + Auth 게이트 + 전역 Provider
│
├── city3d/ ───────────────────── [3D Rendering Layer] ── git-city 포팅
│   ├── CityCanvas.tsx ────────── R3F Canvas, PerspectiveCamera(fov:55), OrbitControls
│   │                             PerformanceMonitor(적응형 DPR 0.75~1.25)
│   │                             EffectComposer + Bloom
│   ├── CityScene.tsx ─────────── 씬 조합: InstancedBuildings + Labels + Effects
│   │                             SpatialGrid(CELL=200) for LOD/컬링
│   │                             FocusInfo projection (건물 선택 좌표)
│   ├── InstancedBuildings.tsx ── InstancedMesh + BoxGeometry(1,1,1)
│   │                             5 InstancedBufferAttributes:
│   │                               aUvFront(vec4), aUvSide(vec4), aRise(float),
│   │                               aTint(vec4), aLive(float)
│   │                             ShaderMaterial(custom GLSL)
│   │                             레이캐스팅 건물 클릭/호버(~8Hz 쓰로틀)
│   │                             Rise animation(staggered 0.85s ease-out cubic)
│   ├── InstancedLabels.tsx ───── 소유자 이름 빌보드 셰이더 라벨
│   ├── BuildingEffects.tsx ───── 합병/구매/레벨업 이펙트
│   ├── AuctionBeacon.tsx ─────── 경매 건물 빛기둥 (DropBeacon 포팅)
│   ├── shaders/
│   │   ├── building.vert.glsl ── Rise animation + instance transform + face UV
│   │   └── building.frag.glsl ── 아틀라스 UV, 테마 컬러, Bayer dithering, fog
│   ├── themes.ts ─────────────── 4종 CityTheme 정의 (sky gradient, fog, lighting)
│   │                             Midnight(dark blue), Sunset(warm orange),
│   │                             Neon(cyberpunk), Emerald(green)
│   └── atlas.ts ──────────────── createWindowAtlas() 2048x2048 CanvasTexture
│                                  ATLAS_SIZE=2048, ATLAS_CELL=8, 6개 점등 밴드
│
├── tycoon/ ───────────────────── [Game Logic Layer] ── 신규 개발
│   ├── engine/
│   │   ├── AuctionEngine.ts ──── 경매 CRUD, 입찰 검증, anti-snipe, NPC AI
│   │   │                         영국식 경매, 5종 경매 유형 관리
│   │   ├── BuildingManager.ts ── 건물 CRUD, 소유권 관리, 가치 계산
│   │   │                         fetch/getById/getByRegion/getByOwner
│   │   ├── IncomeCalculator.ts ─ 수익 공식: base × level × region × synergy
│   │   │                         유지비(10%), 감가상각(주간 -2%)
│   │   ├── MergeSystem.ts ────── 합병 규칙 검증, 비용 계산, 결과 생성
│   │   │                         같은 지역 2~4개, 비용 20%, 시너지 ×1.3
│   │   └── RegionManager.ts ──── 지역 계층(Country→City→District)
│   │                             시너지 보너스, 지역 보정 계수
│   ├── data/
│   │   ├── buildings-seoul.ts ── 서울 50건물 카탈로그 (Phase 1)
│   │   ├── buildings-tokyo.ts ── 도쿄 50건물 카탈로그 (Phase 6)
│   │   ├── buildings-newyork.ts  뉴욕 50건물 카탈로그 (Phase 6)
│   │   └── regions.ts ────────── 지역 계층 구조 + 보정 계수
│   └── config/
│       ├── economy.config.ts ─── rarity별 base_income, level 배수, 수수료율
│       ├── auction.config.ts ─── 경매 주기/NPC 전략/증분/anti-snipe 상수
│       └── merge.config.ts ───── 합병 규칙/비용/시너지 배수
│
├── components/tycoon/ ────────── [UI Presentation Layer]
│   ├── CityTycoonView.tsx ────── 메인 뷰 (3D Canvas + UI 오버레이)
│   ├── AuctionPanel.tsx ──────── 경매 목록 (등급 필터, 시간순 정렬)
│   ├── AuctionTimer.tsx ──────── 카운트다운 (초 단위, anti-snipe 표시)
│   ├── BuildingDetail.tsx ────── 건물 상세 모달 (수익률, 이력, 입찰)
│   ├── PortfolioPanel.tsx ────── 소유 건물 목록, 가치, 수익 요약
│   ├── MergePanel.tsx ────────── 합병 UI (선택→미리보기→확인)
│   ├── IncomeToast.tsx ───────── 수익 정산 토스트 알림
│   └── RegionNav.tsx ─────────── 지구본→나라→도시 네비게이션
│
├── hooks/ ────────────────────── [State Management Layer]
│   ├── useAuth.ts ────────────── Google OAuth (유지)
│   ├── useSupabase.ts ────────── Supabase 클라이언트 (유지)
│   ├── usePersistence.ts ─────── Market Cap + 타이쿤 데이터 이중 영속성 (리팩토링)
│   ├── useTycoon.ts ──────────── 타이쿤 메인 상태 (현재 도시, 선택 건물)
│   ├── useAuction.ts ─────────── 경매 상태/액션 (목록, 입찰, 결과)
│   ├── usePortfolio.ts ───────── 포트폴리오 상태 (소유 건물, 가치, 수익)
│   ├── useMerge.ts ───────────── 합병 상태/액션 (선택, 미리보기, 실행)
│   ├── useIncome.ts ──────────── 수익 추적 (정산 알림, 수익 이력)
│   └── useBuilding3D.ts ─────── 3D 건물 인터랙션 (클릭, 호버, 카메라)
│
├── api/ ──────────────────────── [Data Access Layer]
│   ├── buildings.ts ──────────── Supabase 건물 쿼리 (select + join ownership)
│   ├── auctions.ts ───────────── 경매 쿼리 + RPC 호출 (place_bid, settle_auction)
│   ├── ownership.ts ──────────── 소유권 쿼리 (by user, by building)
│   └── income.ts ─────────────── 수익 정산 RPC + 이력 조회
│
└── i18n/ ─────────────────────── 다국어 (유지, 타이쿤 키 추가)
```

### 4.2 Server-Side Component Architecture

```
Supabase Edge Functions/
│
├── auction-scheduler/ ────────── pg_cron 트리거 → 경매 자동 생성
│   │                             4시간마다 일반 경매 5~10건
│   │                             매일 1회 프리미엄 경매 (Epic)
│   │                             매주 1회 레전더리 경매 (Legendary)
│   └── handler.ts ────────────── SELECT unowned → INSERT tycoon_auctions
│
├── auction-settler/ ──────────── 경매 종료 처리
│   └── handler.ts ────────────── 낙찰 판정 → 소유권 이전 → 수수료 차감
│                                  유찰 시 시작가 -10% 재등록
│
├── npc-bidder/ ───────────────── NPC 입찰 AI
│   └── handler.ts ────────────── 2~5 NPC per 경매
│                                  Fair value의 60~80% 범위 점진적 입찰
│                                  입찰 타이밍: 경매 시간의 30~80% 시점
│
├── income-settlement/ ────────── 수익 정산
│   └── handler.ts ────────────── 1시간마다 모든 소유 건물 수익 계산
│                                  유지비 차감 → 순수익 Market Cap 가산
│                                  tycoon_income_log + player_stats 업데이트
│                                  game_saves.total_market_cap 동기화
│
└── Supabase RPC Functions (PostgreSQL)/
    ├── rpc_place_bid() ───────── 입찰 원자적 처리 (잔액 검증 + 입찰 기록)
    ├── rpc_settle_auction() ──── 경매 정산 (소유권 이전 + 수수료 + 거래 기록)
    ├── rpc_merge_buildings() ─── 합병 원자적 처리 (비용 차감 + 건물 생성)
    ├── rpc_settle_income() ───── 수익 정산 (계산 + 기록 + Market Cap 가산)
    └── rpc_sell_building() ───── 플레이어 매각 등록 (경매 생성 + 소유권 잠금)
```

---

## 5. Database Schema (Detailed)

### 5.1 Entity Relationship Overview

```
                         ┌──────────────────┐
                         │  user_profiles   │
                         │  (기존 테이블)     │
                         └────────┬─────────┘
                                  │ user_id (FK)
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌────────▼────────┐  ┌────────▼────────┐  ┌─────────▼────────┐
   │tycoon_player_   │  │tycoon_ownership │  │tycoon_transactions│
   │stats            │  │                 │  │                   │
   └─────────────────┘  └───────┬─────────┘  └──────────────────┘
                                │ building_id (FK)
                       ┌────────▼────────┐
                       │tycoon_buildings  │◄──────┐
                       │                 │       │ building_id
                       └───────┬─────────┘  ┌────┴──────────┐
                               │             │tycoon_merges   │
                    ┌──────────┤             └───────────────┘
                    │          │
           ┌────────▼──────┐   │
           │tycoon_auctions│   │
           └───────┬───────┘   │
                   │            │
           ┌───────▼───────┐   │
           │ tycoon_bids   │   │
           └───────────────┘   │
                               │
                    ┌──────────▼──────┐
                    │tycoon_income_log│
                    └─────────────────┘
```

### 5.2 Table Definitions

#### tycoon_buildings — 건물 카탈로그

```sql
CREATE TABLE tycoon_buildings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,                          -- "롯데월드타워"
  name_en       TEXT,                                         -- "Lotte World Tower"
  region_code   TEXT        NOT NULL,                          -- "kr-seoul-songpa"
  country_code  CHAR(2)    NOT NULL,                          -- "kr"
  city_code     TEXT        NOT NULL,                          -- "seoul"
  district_code TEXT        NOT NULL,                          -- "songpa"
  rarity        TEXT        NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  level         SMALLINT   NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  max_level     SMALLINT   NOT NULL DEFAULT 5,
  base_income   INTEGER    NOT NULL,                          -- 시간당 Market Cap
  -- 3D Visual Parameters (git-city 포팅)
  visual_height REAL       NOT NULL DEFAULT 100,              -- Three.js scale Y
  visual_width  REAL       NOT NULL DEFAULT 30,               -- Three.js scale X
  visual_depth  REAL       NOT NULL DEFAULT 30,               -- Three.js scale Z
  visual_theme  TEXT       NOT NULL DEFAULT 'midnight',       -- midnight/sunset/neon/emerald
  window_lit_pct REAL      NOT NULL DEFAULT 0.6,              -- 0.0~1.0 (수익률 비례)
  -- Grid Position (city3d layout)
  grid_x        REAL       NOT NULL DEFAULT 0,                -- 도시 내 X 좌표
  grid_z        REAL       NOT NULL DEFAULT 0,                -- 도시 내 Z 좌표
  -- Metadata
  is_landmark   BOOLEAN    NOT NULL DEFAULT false,            -- 실제 랜드마크 여부
  is_active     BOOLEAN    NOT NULL DEFAULT true,             -- 합병 소프트삭제
  merge_target  BOOLEAN    NOT NULL DEFAULT false,            -- 합병 대상 여부
  description   TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_buildings_region ON tycoon_buildings (region_code) WHERE is_active = true;
CREATE INDEX idx_buildings_rarity ON tycoon_buildings (rarity) WHERE is_active = true;
CREATE INDEX idx_buildings_city   ON tycoon_buildings (country_code, city_code) WHERE is_active = true;
CREATE INDEX idx_buildings_active ON tycoon_buildings (is_active, rarity);
```

#### tycoon_ownership — 소유권

```sql
CREATE TABLE tycoon_ownership (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   UUID        NOT NULL REFERENCES tycoon_buildings(id),
  owner_id      UUID        NOT NULL REFERENCES auth.users(id),
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchase_price BIGINT     NOT NULL,                         -- 구매가
  is_active     BOOLEAN     NOT NULL DEFAULT true,            -- 매각/합병 시 false
  -- Depreciation tracking
  last_upgrade_at TIMESTAMPTZ NOT NULL DEFAULT now(),         -- 감가상각 기준
  depreciation_pct REAL     NOT NULL DEFAULT 0,               -- 누적 감가율
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 건물당 활성 소유자는 1명
CREATE UNIQUE INDEX idx_ownership_active ON tycoon_ownership (building_id) WHERE is_active = true;
CREATE INDEX idx_ownership_owner ON tycoon_ownership (owner_id) WHERE is_active = true;
CREATE INDEX idx_ownership_building ON tycoon_ownership (building_id, is_active);
```

#### tycoon_auctions — 경매

```sql
CREATE TABLE tycoon_auctions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   UUID        NOT NULL REFERENCES tycoon_buildings(id),
  auction_type  TEXT        NOT NULL CHECK (auction_type IN (
    'regular','premium','legendary','player_sell','flash_sale'
  )),
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','active','ended','cancelled','failed'
  )),
  -- Pricing
  starting_bid  BIGINT      NOT NULL,                         -- 시작가
  current_bid   BIGINT      NOT NULL DEFAULT 0,               -- 현재 최고 입찰가
  bid_increment BIGINT      NOT NULL,                         -- 최소 증분
  winner_id     UUID        REFERENCES auth.users(id),        -- 현재 최고 입찰자
  -- Seller (player_sell 유형만)
  seller_id     UUID        REFERENCES auth.users(id),
  -- Timing
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  original_end  TIMESTAMPTZ NOT NULL,                         -- anti-snipe 이전 원래 종료 시간
  -- Anti-snipe
  snipe_extended BOOLEAN    NOT NULL DEFAULT false,
  snipe_count   SMALLINT   NOT NULL DEFAULT 0,                -- anti-snipe 연장 횟수
  -- Metadata
  bid_count     INTEGER    NOT NULL DEFAULT 0,
  npc_bid_count INTEGER    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auctions_status_end ON tycoon_auctions (status, end_at) WHERE status = 'active';
CREATE INDEX idx_auctions_building ON tycoon_auctions (building_id, status);
CREATE INDEX idx_auctions_type ON tycoon_auctions (auction_type, status);
CREATE INDEX idx_auctions_winner ON tycoon_auctions (winner_id) WHERE status = 'ended';
```

#### tycoon_bids — 입찰

```sql
CREATE TABLE tycoon_bids (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id    UUID        NOT NULL REFERENCES tycoon_auctions(id),
  bidder_id     UUID        NOT NULL REFERENCES auth.users(id),
  amount        BIGINT      NOT NULL,
  is_npc        BOOLEAN     NOT NULL DEFAULT false,           -- NPC 입찰 표시
  npc_name      TEXT,                                         -- NPC 표시명
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bids_auction ON tycoon_bids (auction_id, amount DESC);
CREATE INDEX idx_bids_bidder  ON tycoon_bids (bidder_id, created_at DESC);
CREATE INDEX idx_bids_auction_time ON tycoon_bids (auction_id, created_at DESC);
```

#### tycoon_transactions — 거래 이력

```sql
CREATE TABLE tycoon_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id),
  transaction_type TEXT       NOT NULL CHECK (transaction_type IN (
    'auction_buy','auction_sell','merge_cost','income','maintenance',
    'depreciation','decoration_buy','daily_bonus','achievement_reward',
    'event_reward','refund'
  )),
  amount          BIGINT      NOT NULL,                       -- 양수=유입, 음수=유출
  fee             BIGINT      NOT NULL DEFAULT 0,             -- 수수료 (항상 양수)
  balance_before  BIGINT      NOT NULL,
  balance_after   BIGINT      NOT NULL,
  ref_type        TEXT,                                       -- 'auction', 'building', 'merge'
  ref_id          UUID,                                       -- 참조 엔티티 ID
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_transactions_user ON tycoon_transactions (user_id, created_at DESC);
CREATE INDEX idx_transactions_type ON tycoon_transactions (user_id, transaction_type);
CREATE INDEX idx_transactions_ref  ON tycoon_transactions (ref_type, ref_id);
```

#### tycoon_merges — 합병 이력

```sql
CREATE TABLE tycoon_merges (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id),
  source_building_ids UUID[]    NOT NULL,                     -- 원본 건물 ID 배열 (2~4개)
  result_building_id  UUID      NOT NULL REFERENCES tycoon_buildings(id),
  merge_cost        BIGINT      NOT NULL,                     -- 합병 비용 (Market Cap)
  -- 결과 스탯
  income_before     BIGINT      NOT NULL,                     -- 원본 합산 수익
  income_after      BIGINT      NOT NULL,                     -- 결과 건물 수익 (×1.3)
  level_before      SMALLINT    NOT NULL,
  level_after       SMALLINT    NOT NULL,
  rarity_before     TEXT        NOT NULL,
  rarity_after      TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merges_user ON tycoon_merges (user_id, created_at DESC);
```

#### tycoon_income_log — 수익 정산 기록

```sql
CREATE TABLE tycoon_income_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  building_id   UUID        NOT NULL REFERENCES tycoon_buildings(id),
  gross_income  BIGINT      NOT NULL,                         -- 총 수익
  maintenance   BIGINT      NOT NULL DEFAULT 0,               -- 유지비
  net_income    BIGINT      NOT NULL,                         -- 순수익
  -- 계산 파라미터 스냅샷
  base_income   INTEGER     NOT NULL,
  level_mult    REAL        NOT NULL,
  region_mult   REAL        NOT NULL,
  synergy_mult  REAL        NOT NULL,
  depreciation  REAL        NOT NULL DEFAULT 0,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (파티셔닝 고려: 월별)
CREATE INDEX idx_income_user_period ON tycoon_income_log (user_id, period_end DESC);
CREATE INDEX idx_income_building    ON tycoon_income_log (building_id, period_end DESC);
```

#### tycoon_player_stats — 플레이어 통계

```sql
CREATE TABLE tycoon_player_stats (
  user_id          UUID       PRIMARY KEY REFERENCES auth.users(id),
  portfolio_value  BIGINT     NOT NULL DEFAULT 0,             -- 총 포트폴리오 가치
  total_income     BIGINT     NOT NULL DEFAULT 0,             -- 누적 총 수익
  total_spent      BIGINT     NOT NULL DEFAULT 0,             -- 누적 총 지출
  building_count   INTEGER    NOT NULL DEFAULT 0,             -- 소유 건물 수
  highest_rarity   TEXT       NOT NULL DEFAULT 'common',      -- 최고 등급 건물
  merge_count      INTEGER    NOT NULL DEFAULT 0,             -- 합병 횟수
  auction_wins     INTEGER    NOT NULL DEFAULT 0,             -- 낙찰 횟수
  -- Titles
  title            TEXT       NOT NULL DEFAULT 'beginner',    -- beginner/investor/mogul/tycoon/global
  -- Synergy
  district_synergies INTEGER  NOT NULL DEFAULT 0,             -- 활성 District Synergy 수
  city_dominations   INTEGER  NOT NULL DEFAULT 0,             -- City Domination 달성 수
  -- Timestamps
  first_building_at  TIMESTAMPTZ,
  last_income_at     TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard index
CREATE INDEX idx_stats_portfolio ON tycoon_player_stats (portfolio_value DESC);
CREATE INDEX idx_stats_income    ON tycoon_player_stats (total_income DESC);
```

### 5.3 RLS (Row Level Security) Policies

```sql
-- tycoon_buildings: 모두 읽기 가능, 서버만 수정
ALTER TABLE tycoon_buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buildings_read_all" ON tycoon_buildings FOR SELECT USING (true);
CREATE POLICY "buildings_service_only" ON tycoon_buildings FOR ALL
  USING (auth.role() = 'service_role');

-- tycoon_ownership: 모두 읽기 가능, 자신의 소유만 확인
ALTER TABLE tycoon_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ownership_read_all" ON tycoon_ownership FOR SELECT USING (true);
CREATE POLICY "ownership_service_only" ON tycoon_ownership FOR ALL
  USING (auth.role() = 'service_role');

-- tycoon_auctions: 모두 읽기 가능, 서버만 수정
ALTER TABLE tycoon_auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auctions_read_all" ON tycoon_auctions FOR SELECT USING (true);
CREATE POLICY "auctions_service_only" ON tycoon_auctions FOR ALL
  USING (auth.role() = 'service_role');

-- tycoon_bids: 모두 읽기, 자신의 입찰만 INSERT (RPC 통해)
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

-- tycoon_player_stats: 모두 읽기 (리더보드)
ALTER TABLE tycoon_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_read_all" ON tycoon_player_stats FOR SELECT USING (true);
CREATE POLICY "stats_service_only" ON tycoon_player_stats FOR ALL
  USING (auth.role() = 'service_role');
```

---

## 6. API Specification

### 6.1 Client Direct Queries (Supabase JS SDK)

읽기 위주 쿼리는 클라이언트에서 RLS를 통해 직접 실행한다.

| Operation | Table | Method | Filter | Use Case |
|-----------|-------|--------|--------|----------|
| 건물 목록 | tycoon_buildings | SELECT | `city_code, is_active=true` | 도시 진입 시 건물 로드 |
| 건물 상세 | tycoon_buildings + ownership | SELECT + JOIN | `building_id` | 건물 클릭 상세 |
| 경매 목록 | tycoon_auctions | SELECT | `status='active', auction_type` | 경매 패널 |
| 경매 입찰 이력 | tycoon_bids | SELECT | `auction_id` | 경매 상세 입찰 이력 |
| 내 포트폴리오 | tycoon_ownership + buildings | SELECT + JOIN | `owner_id=auth.uid(), is_active=true` | 포트폴리오 패널 |
| 내 거래 이력 | tycoon_transactions | SELECT | `user_id=auth.uid()` | 거래 이력 |
| 수익 이력 | tycoon_income_log | SELECT | `user_id=auth.uid()` | 수익 차트 |
| 리더보드 | tycoon_player_stats | SELECT | `ORDER BY portfolio_value DESC LIMIT 100` | 글로벌 랭킹 |
| 내 통계 | tycoon_player_stats | SELECT | `user_id=auth.uid()` | 프로필 |

### 6.2 RPC Functions (원자적 트랜잭션)

#### rpc_place_bid

```yaml
Function: rpc_place_bid
Description: 경매 입찰 원자적 처리
Auth: Required (auth.uid())
Parameters:
  p_auction_id: UUID      -- 경매 ID
  p_amount: BIGINT        -- 입찰 금액
Returns: { success: boolean, new_bid_id: UUID, error?: string }
Logic:
  1. SELECT auction (status = 'active', end_at > now())
  2. VERIFY p_amount >= current_bid + bid_increment
  3. VERIFY user balance (game_saves.total_market_cap) >= p_amount
  4. INSERT INTO tycoon_bids (auction_id, bidder_id, amount)
  5. UPDATE tycoon_auctions SET current_bid, winner_id, bid_count
  6. Anti-snipe: IF end_at - now() < 30s THEN SET end_at += 30s, snipe_extended=true
  7. RETURN success
Error Codes:
  - AUCTION_NOT_ACTIVE: 경매 종료/취소
  - BID_TOO_LOW: 최소 증분 미달
  - INSUFFICIENT_FUNDS: 잔액 부족
  - SELF_OUTBID: 본인이 이미 최고 입찰자
```

#### rpc_settle_auction

```yaml
Function: rpc_settle_auction
Description: 경매 종료 정산 (Edge Function에서 호출)
Auth: Service Role Only
Parameters:
  p_auction_id: UUID
Returns: { settled: boolean, winner_id?: UUID, final_price?: BIGINT }
Logic:
  1. SELECT auction WHERE status = 'active' AND end_at <= now()
  2. IF bid_count = 0 THEN
       status = 'failed', 시작가 -10% 후 재등록 (유찰)
  3. ELSE
       a. winner_id = 최고 입찰자
       b. buyer_fee = final_price × 0.05
       c. UPDATE game_saves SET total_market_cap -= (final_price + buyer_fee) WHERE user_id = winner
       d. INSERT tycoon_ownership (building_id, owner_id, purchase_price)
       e. INSERT tycoon_transactions (auction_buy, -final_price, fee=buyer_fee)
       f. IF player_sell THEN
            seller_fee = final_price × 0.10
            seller_receives = final_price - seller_fee
            UPDATE game_saves SET total_market_cap += seller_receives WHERE user_id = seller
            INSERT tycoon_transactions (auction_sell, +seller_receives, fee=seller_fee)
       g. UPDATE tycoon_player_stats (building_count++, auction_wins++, portfolio_value)
       h. UPDATE tycoon_auctions SET status = 'ended'
```

#### rpc_merge_buildings

```yaml
Function: rpc_merge_buildings
Description: 건물 합병 원자적 처리
Auth: Required (auth.uid())
Parameters:
  p_building_ids: UUID[]  -- 원본 건물 ID 배열 (2~4개)
Returns: { success: boolean, result_building_id: UUID, error?: string }
Logic:
  1. VERIFY 2 <= array_length(p_building_ids) <= 4
  2. VERIFY all buildings owned by auth.uid() AND is_active = true
  3. VERIFY all buildings in same region_code
  4. CALCULATE merge_cost = SUM(purchase_price) × 0.20
  5. VERIFY user balance >= merge_cost
  6. CALCULATE result:
       income = SUM(base_income) × 1.3
       level = MAX(levels) + 1 (cap at max_level)
       rarity = upgrade if level > max for current rarity
  7. INSERT new building (result)
  8. UPDATE source buildings SET is_active = false
  9. UPDATE source ownerships SET is_active = false
  10. INSERT tycoon_ownership for result building
  11. INSERT tycoon_merges record
  12. INSERT tycoon_transactions (merge_cost)
  13. UPDATE game_saves SET total_market_cap -= merge_cost
  14. UPDATE tycoon_player_stats
Error Codes:
  - INVALID_COUNT: 2~4개 범위 초과
  - NOT_OWNER: 소유하지 않은 건물 포함
  - DIFFERENT_REGION: 다른 지역 건물 포함
  - INSUFFICIENT_FUNDS: 잔액 부족
  - MAX_LEVEL: 이미 최대 레벨
```

#### rpc_settle_income

```yaml
Function: rpc_settle_income
Description: 시간당 수익 정산 (Edge Function에서 호출)
Auth: Service Role Only
Parameters: none (배치 처리)
Returns: { processed_count: integer, total_distributed: BIGINT }
Logic:
  1. SELECT all active ownerships + buildings + player_stats
  2. FOR EACH ownership:
       a. gross = base_income × level_mult × region_mult × synergy_mult
       b. depreciation_adj = gross × (1 - depreciation_pct)
       c. maintenance = depreciation_adj × 0.10
       d. net_income = depreciation_adj - maintenance
       e. INSERT tycoon_income_log
       f. UPDATE game_saves.total_market_cap += net_income
       g. UPDATE tycoon_player_stats (total_income += net_income, portfolio_value)
  3. UPDATE depreciation:
       IF last_upgrade_at < now() - interval '7 days'
       THEN depreciation_pct = MIN(depreciation_pct + 0.02, 0.50)
```

#### rpc_sell_building

```yaml
Function: rpc_sell_building
Description: 플레이어 매각 경매 등록
Auth: Required (auth.uid())
Parameters:
  p_building_id: UUID
  p_min_bid: BIGINT       -- 최소 입찰가
Returns: { success: boolean, auction_id: UUID }
Logic:
  1. VERIFY ownership by auth.uid()
  2. VERIFY no active auction for this building
  3. INSERT tycoon_auctions (type='player_sell', seller_id, starting_bid=p_min_bid)
  4. UPDATE tycoon_ownership SET is_active = false (잠금)
  5. RETURN auction_id
```

### 6.3 Edge Functions (Scheduled)

| Function | Trigger | Schedule | Description |
|----------|---------|----------|-------------|
| `auction-scheduler` | pg_cron | `0 */4 * * *` (4시간) | 일반 경매 5~10건 자동 생성 |
| `premium-auction` | pg_cron | `0 12 * * *` (매일 정오) | 프리미엄 경매 1~2건 (Epic) |
| `legendary-auction` | pg_cron | `0 12 * * 1` (매주 월요일) | 레전더리 경매 1건 |
| `auction-settler` | pg_cron | `* * * * *` (매분) | 종료된 경매 정산 (end_at <= now()) |
| `npc-bidder` | pg_cron | `*/5 * * * *` (5분) | 활성 경매에 NPC 입찰 |
| `income-settlement` | pg_cron | `0 * * * *` (매시) | 소유 건물 수익 정산 |

### 6.4 Realtime Channels (Phase 5)

```yaml
Channel: auction:{auction_id}
  Events:
    - new_bid: { bidder_name, amount, is_npc, timestamp }
    - time_extended: { new_end_at, snipe_count }
    - auction_ended: { winner_name, final_price }
  Subscribe: 경매 상세 뷰 진입 시
  Unsubscribe: 경매 상세 뷰 이탈 시

Channel: city:{city_code}
  Events:
    - building_sold: { building_id, new_owner_name }
    - new_auction: { auction_id, building_name, starting_bid }
    - merge_complete: { building_name, new_level }
  Subscribe: 도시 뷰 진입 시

Channel: user:{user_id}
  Events:
    - income_settled: { total_income, building_count }
    - auction_outbid: { auction_id, new_amount }
    - auction_won: { building_name, final_price }
  Subscribe: 앱 시작 시 (인증 후)
```

---

## 7. 3D Engine Porting Architecture (git-city → city3d/)

### 7.1 Source → Target Mapping

| git-city Source | city3d/ Target | 변경 사항 |
|----------------|----------------|----------|
| `components/CityCanvas.tsx` | `CityCanvas.tsx` | Raid/Sponsor/Ads 제거, 타이쿤 오버레이 추가 |
| `components/CityScene.tsx` | `CityScene.tsx` | LiveDots/DropBeacon → AuctionBeacon 교체, 소유자 데이터 바인딩 |
| `components/InstancedBuildings.tsx` | `InstancedBuildings.tsx` | CityBuilding → TycoonBuilding 타입, 소유자 tint/경매 깜빡임 추가 |
| `components/InstancedLabels.tsx` | `InstancedLabels.tsx` | GitHub login → 소유자 이름, 등급 아이콘 추가 |
| `components/Building3D.tsx` | `atlas.ts` | createWindowAtlas() 함수만 추출, 독립 모듈화 |
| `components/BuildingEffects.tsx` | `BuildingEffects.tsx` | 레벨업/구매/합병 이펙트 추가 |
| `components/DropBeacon.tsx` | `AuctionBeacon.tsx` | Drop → Auction 빛기둥, 등급별 색상 변경 |
| `components/ThemeSkyFX.tsx` | `themes.ts` (통합) | CityTheme 타입 + 4종 테마 데이터 |
| `components/CelebrationEffect.tsx` | `BuildingEffects.tsx` (통합) | 건물 구매 시 축하 이펙트 |
| `lib/zones.ts` | `tycoon/config/decoration.config.ts` | crown/roof/aura → 장식 시스템 (Phase 7) |

### 7.2 Type Migration

```typescript
// git-city 원본 타입 (CityBuilding from lib/github.ts)
interface CityBuilding {
  login: string;           // GitHub 유저네임
  position: [number, number, number];
  height: number;          // contributions 기반
  width: number;           // repos 기반
  depth: number;
  litPct: number;          // 최근 활동률
  districtIndex: number;
  color?: string;          // 커스텀 컬러
  // ... 기타 GitHub 메타데이터
}

// ──────────────────────────────────────────────────

// 타이쿤 변환 타입 (city3d/types.ts)
interface TycoonBuilding3D {
  id: string;              // tycoon_buildings.id (UUID)
  name: string;            // 건물 이름
  position: [number, number, number]; // grid_x, 0, grid_z
  height: number;          // visual_height (등급 + 레벨 기반)
  width: number;           // visual_width
  depth: number;           // visual_depth
  litPct: number;          // window_lit_pct (수익률 비례)
  districtIndex: number;   // district 인덱스
  // 타이쿤 전용 필드
  rarity: Rarity;          // 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  level: number;           // 1~5
  ownerId: string | null;  // 소유자 UUID
  ownerName: string | null;// 소유자 표시명
  isAuctionActive: boolean;// 경매 진행 중 여부
  auctionEndAt: Date | null;
  tintColor?: string;      // 소유자별 고유 색상 또는 등급별 색상
}

// 등급 → 비주얼 매핑 상수
const RARITY_VISUAL: Record<Rarity, {
  heightRange: [number, number];
  widthRange: [number, number];
  litPctBase: number;
  tintColor: string;
  hasSpecialEffect: boolean;
}> = {
  common:    { heightRange: [40, 80],   widthRange: [20, 30], litPctBase: 0.4, tintColor: '#888888', hasSpecialEffect: false },
  uncommon:  { heightRange: [60, 120],  widthRange: [25, 35], litPctBase: 0.5, tintColor: '#2ecc71', hasSpecialEffect: false },
  rare:      { heightRange: [100, 180], widthRange: [30, 45], litPctBase: 0.65, tintColor: '#3498db', hasSpecialEffect: false },
  epic:      { heightRange: [180, 320], widthRange: [40, 60], litPctBase: 0.80, tintColor: '#9b59b6', hasSpecialEffect: true },
  legendary: { heightRange: [300, 500], widthRange: [60, 90], litPctBase: 0.95, tintColor: '#f1c40f', hasSpecialEffect: true },
};
```

### 7.3 Shader Modifications

```
git-city 셰이더 (그대로 복사) + 타이쿤 확장:

Vertex Shader 변경:
  - 기존: aRise(float) — rise animation
  + 추가: aAuction(float) — 경매 건물 깜빡임 (sin wave)
  + 추가: aMerging(float) — 합병 중 건물 축소 animation

Fragment Shader 변경:
  - 기존: uFocusedId — 단일 건물 포커스
  + 추가: uOwnedMask(float) — 소유 건물 밝기 부스트
  + 추가: uAuctionPulse(float) — 경매 건물 pulse glow
  + 추가: uRarityGlow(vec3) — 등급별 아웃라인 글로우

Uniform 추가:
  uAuctionTime: float    // 경매 pulse animation 시간
  uPlayerColor: vec3     // 플레이어 고유 색상
```

### 7.4 Performance Budget

| Metric | Target | git-city Baseline | Strategy |
|--------|--------|-------------------|----------|
| 건물 렌더링 | 100+ @ 60fps | 1000+ @ 60fps | InstancedMesh 단일 draw call |
| 초기 로딩 | < 3s | ~2s | Code splitting, lazy Three.js import |
| 메모리 | < 100MB | ~80MB | 아틀라스 2048x2048 단일 텍스처 |
| Draw calls | < 10 | 5~8 | Buildings(1) + Labels(1) + Effects(2~3) + Ground(1) |
| DPR | 0.75~1.25 | 0.75~1.25 | PerformanceMonitor 적응형 |
| 모바일 FPS | 30+ | 30+ | LOD 컬링 + 적응형 DPR |

---

## 8. Auction System Sequence Diagrams

### 8.1 일반 경매 생명주기

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  pg_cron │    │ Edge Fn  │    │PostgreSQL│    │  Client  │
│ Scheduler│    │  (NPC)   │    │    DB    │    │  (SPA)   │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │              │               │
     │──[4시간마다]──►│              │               │
     │  auction-     │              │               │
     │  scheduler    │              │               │
     │               │              │               │
     │    SELECT unowned buildings  │               │
     │──────────────────────────────►               │
     │    INSERT tycoon_auctions (5~10건)           │
     │◄─────────────────────────────│               │
     │               │              │               │
     │               │──[5분마다]──►│               │
     │               │  npc-bidder  │               │
     │               │              │               │
     │               │  SELECT active auctions      │
     │               │─────────────►│               │
     │               │  INSERT bids (NPC)           │
     │               │─────────────►│               │
     │               │              │               │
     │               │              │    ┌──────────┤
     │               │              │    │ 경매 목록 │
     │               │              │    │ polling  │
     │               │              │◄───┤ SELECT   │
     │               │              │───►│ auctions │
     │               │              │    └──────────┤
     │               │              │               │
     │               │              │    ┌──────────┤
     │               │              │    │ 입찰     │
     │               │              │◄───┤rpc_place │
     │               │              │    │ _bid()   │
     │               │              │───►│ result   │
     │               │              │    └──────────┤
     │               │              │               │
     │──[매분]──────►│              │               │
     │ auction-      │              │               │
     │ settler       │              │               │
     │               │              │               │
     │  SELECT ended auctions       │               │
     │──────────────────────────────►               │
     │  rpc_settle_auction()        │               │
     │──────────────────────────────►               │
     │  - 소유권 이전               │               │
     │  - 수수료 차감               │               │
     │  - Market Cap 정산           │               │
     │◄─────────────────────────────│               │
     │               │              │               │
```

### 8.2 입찰 + Anti-Snipe 상세 플로우

```
  Player                    rpc_place_bid()                     DB
    │                            │                              │
    │── bid(auction_id, 1500) ──►│                              │
    │                            │── SELECT auction ───────────►│
    │                            │◄── { status:'active',        │
    │                            │     current_bid: 1000,       │
    │                            │     bid_increment: 50,       │
    │                            │     end_at: T+2min } ────────│
    │                            │                              │
    │                            │── VERIFY 1500 >= 1000+50 ✓   │
    │                            │── VERIFY balance >= 1500 ✓   │
    │                            │                              │
    │                            │── CHECK anti-snipe:          │
    │                            │   end_at - now() = 120s      │
    │                            │   120s > 30s → NO extension  │
    │                            │                              │
    │                            │── BEGIN TRANSACTION ────────►│
    │                            │   INSERT tycoon_bids          │
    │                            │   UPDATE tycoon_auctions      │
    │                            │     current_bid = 1500        │
    │                            │     winner_id = player        │
    │                            │     bid_count++               │
    │                            │── COMMIT ───────────────────►│
    │◄── { success: true } ──────│                              │
    │                            │                              │

  -- Anti-Snipe 시나리오 (마지막 30초 이내 입찰) --

  Player                    rpc_place_bid()                     DB
    │                            │                              │
    │── bid(auction_id, 2000) ──►│                              │
    │                            │── SELECT auction ───────────►│
    │                            │◄── { end_at: T+20s } ────────│
    │                            │                              │
    │                            │── CHECK anti-snipe:          │
    │                            │   end_at - now() = 20s       │
    │                            │   20s < 30s → EXTEND!        │
    │                            │   new_end_at = now() + 30s   │
    │                            │                              │
    │                            │── BEGIN TRANSACTION ────────►│
    │                            │   INSERT tycoon_bids          │
    │                            │   UPDATE tycoon_auctions      │
    │                            │     end_at = new_end_at       │
    │                            │     snipe_extended = true      │
    │                            │     snipe_count++             │
    │                            │── COMMIT ───────────────────►│
    │◄── { success: true,        │                              │
    │      time_extended: true }──│                              │
```

### 8.3 NPC 입찰 AI 알고리즘

```
NPC Bidder Edge Function (5분마다 실행):

FOR EACH active_auction:
  fair_value = building.base_income × rarity_mult × 100  // 100시간 수익 기준

  npc_count = RANDOM(2, 5)
  FOR EACH npc IN range(npc_count):
    max_bid = fair_value × RANDOM(0.60, 0.80)             // 각 NPC의 상한

    IF current_bid >= max_bid:
      SKIP  // 이미 상한 초과

    // 입찰 타이밍: 경매 진행률 30~80% 시점
    elapsed_ratio = (now - start_at) / (end_at - start_at)
    npc_timing = RANDOM(0.30, 0.80)

    IF elapsed_ratio >= npc_timing:
      bid_amount = current_bid + bid_increment × RANDOM(1, 3)
      bid_amount = MIN(bid_amount, max_bid)

      INSERT INTO tycoon_bids (is_npc=true, npc_name=random_name())
      UPDATE tycoon_auctions (current_bid, bid_count, npc_bid_count)
```

---

## 9. Economy Balance Parameters (Detailed)

### 9.1 Income Formula

```
gross_income = base_income × level_mult × region_mult × synergy_mult × (1 - depreciation_pct)
maintenance  = gross_income × MAINTENANCE_RATE
net_income   = gross_income - maintenance
```

### 9.2 Base Income by Rarity

| Rarity | base_income/hr | Fair Value (100hr) | Starting Bid (50%) | Bid Increment (5%) |
|--------|---------------|-------------------|--------------------|--------------------|
| Common | 10 MC | 1,000 MC | 500 MC | 50 MC |
| Uncommon | 25 MC | 2,500 MC | 1,250 MC | 125 MC |
| Rare | 75 MC | 7,500 MC | 3,750 MC | 375 MC |
| Epic | 250 MC | 25,000 MC | 12,500 MC | 1,250 MC |
| Legendary | 1,000 MC | 100,000 MC | 50,000 MC | 5,000 MC |

### 9.3 Level Multipliers

| Level | Multiplier | 달성 방법 | Common 기준 수익 |
|-------|-----------|----------|-----------------|
| 1 | 1.0x | 초기 상태 | 10 MC/hr |
| 2 | 1.3x | 합병 (2개) | 13 MC/hr |
| 3 | 1.7x | 합병 (3개) | 17 MC/hr |
| 4 | 2.2x | 합병 (4개) | 22 MC/hr |
| 5 | 3.0x | 합병 (최대) | 30 MC/hr |

### 9.4 Region Multipliers

| Region Tier | Modifier | 예시 |
|-------------|----------|------|
| S-Tier (글로벌 랜드마크) | 1.5x | 강남, 마포, Manhattan |
| A-Tier (도시 중심부) | 1.2x | 종로, 송파, Brooklyn |
| B-Tier (주거 지역) | 1.0x | 외곽 구역 |
| C-Tier (개발 지역) | 0.8x | 신규 개발 구역 |

### 9.5 Synergy Bonuses

| Synergy | 조건 | 보너스 | 적용 범위 |
|---------|------|--------|----------|
| District Synergy | 같은 구역 3개+ | +20% | 해당 구역 건물만 |
| City Domination | 도시 내 10개+ | +30% | 해당 도시 건물 전체 |
| Country Collection | 나라 내 모든 랜드마크 | 특별 건물 해금 | 해당 나라 |
| Global Tycoon | 3개국+ 건물 보유 | 글로벌 리더보드 진입 | 전체 |

### 9.6 Sink Mechanisms (인플레이션 방지)

| Sink | Rate | 설명 | 예상 비중 |
|------|------|------|----------|
| 경매 구매 수수료 | 5% | buyer_fee | 핵심 sink (40%) |
| 매각 수수료 | 10% | seller_fee | 보조 sink (15%) |
| 합병 비용 | 20% of 가치합 | merge_cost | 성장 sink (20%) |
| 건물 유지비 | 10% of 수익 | maintenance | 패시브 sink (15%) |
| 감가상각 | 주간 -2% (최대 -50%) | depreciation | 활동 유도 (5%) |
| 장식 구매 | 가변 | decoration | 선택적 sink (5%) |

### 9.7 Faucet Mechanisms (재화 유입)

| Faucet | Amount | 주기 | 예상 비중 |
|--------|--------|------|----------|
| 건물 패시브 수익 | base × mult | 매시간 | 핵심 faucet (70%) |
| 일일 출석 보너스 | 50~500 MC | 매일 | 보조 (10%) |
| 업적 보상 | 100~10,000 MC | 일회성 | 초반 부스트 (10%) |
| 이벤트 보상 | 가변 | 이벤트 시 | 보조 (5%) |
| 신규 유저 시드 | 1,000 MC | 가입 시 | 온보딩 (5%) |

### 9.8 Progression Timeline

| 마일스톤 | 예상 시간 | 필요 Market Cap | 경로 |
|---------|----------|----------------|------|
| 첫 건물 (Common) | ~30분 | 500 MC | 시드 1000 + 출석 보너스 |
| 3개 건물 | ~6시간 | ~2,500 MC | 일반 경매 3회 |
| 첫 합병 | ~2일 | ~5,000 MC (합병비 포함) | 같은 구역 2개 |
| District Synergy | ~5일 | ~10,000 MC | 같은 구역 3개 |
| 첫 Rare 건물 | ~1주 | ~5,000 MC | 일반 경매 Rare |
| 첫 Epic 건물 | ~2주 | ~15,000 MC | 프리미엄 경매 |
| City Domination | ~3주 | ~50,000 MC | 도시 10개+ |
| Legendary 경쟁 | ~1달 | ~60,000 MC | 레전더리 경매 |

### 9.9 Balance Safeguards

```yaml
Hard Caps:
  max_buildings_per_player: 50          # 서버 부하 방지
  max_bids_per_auction: 100             # 스팸 방지
  max_merges_per_day: 5                 # 급격한 성장 억제
  max_sell_listings_per_day: 3          # 시장 조작 방지
  min_ownership_duration: 1h            # 즉시 재판매 방지
  depreciation_cap: 50%                 # 건물 가치 최저선

Dynamic Adjustments:
  # NPC가 가격 앵커 역할: fair value 근처에서 자동 형성
  npc_bid_ceiling: fair_value × 0.80
  # 유찰 시 자동 할인 → 건물 유동성 보장
  fail_discount: -10% per 유찰 (최소 fair_value × 0.30)
  # 과열 감지: 평균 낙찰가가 fair_value × 2 초과 시 경매 수량 증가
  auction_supply_increase: +50% if avg_price > fair_value × 2
```

---

## 10. Security Considerations

### 10.1 Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| 경매 입찰 조작 | High | 서버 사이드 RPC로 검증, 클라이언트 입찰 불가 |
| Market Cap 변조 | Critical | game_saves RLS + 서버만 수정, 클라이언트 캐시는 읽기 전용 |
| NPC 입찰 예측 | Medium | NPC 타이밍/금액 랜덤화, 서버 사이드 실행 |
| 합병 규칙 우회 | High | rpc_merge_buildings에서 서버 사이드 검증 |
| 수익 정산 이중 처리 | High | idempotency key (period_start + building_id), SELECT FOR UPDATE |
| API 남용 (DoS) | Medium | Supabase rate limiting + 입찰 쿨다운 (5초) |
| 세션 탈취 | High | Google OAuth + Supabase Auth (JWT), httpOnly cookies |

### 10.2 Data Integrity

```yaml
Transaction Safety:
  - 모든 재화 변동은 RPC (PostgreSQL TRANSACTION) 내에서 실행
  - balance_before/after 기록으로 감사 추적
  - CHECK constraints: balance_after >= 0

Idempotency:
  - income_settlement: UNIQUE(user_id, building_id, period_start) 으로 이중 정산 방지
  - auction_settler: status = 'active' → 'ended' 원자적 전환

Race Conditions:
  - 입찰: SELECT ... FOR UPDATE on tycoon_auctions (동시 입찰 직렬화)
  - 합병: SELECT ... FOR UPDATE on tycoon_ownership (동시 합병 방지)
```

---

## 11. State Management Architecture

### 11.1 Client State Layers

```
┌─────────────────────────────────────────────────┐
│                 React Component Tree              │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Server State (Supabase via React Query)      │ │
│  │ - buildings, auctions, ownership, income     │ │
│  │ - Stale time: 30s (경매), 5min (건물)        │ │
│  │ - Invalidation: mutation 후 자동             │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Client State (React hooks + Context)         │ │
│  │ - 현재 도시, 선택 건물, UI 모드              │ │
│  │ - 3D 카메라 상태, 테마, 호버 건물            │ │
│  │ - 합병 선택 목록, 입찰 금액 입력             │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Persistent State (usePersistence)            │ │
│  │ - total_market_cap (이중 영속성)             │ │
│  │ - last_city, theme_preference                │ │
│  │ - localStorage (즉시) + Supabase (3s debounce)│ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 11.2 Data Flow: 경매 입찰

```
User clicks "입찰"
  │
  ▼
useAuction.placeBid(auctionId, amount)
  │
  ├── Optimistic UI update (입찰 금액 표시)
  │
  ├── supabase.rpc('rpc_place_bid', { p_auction_id, p_amount })
  │     │
  │     ├── Success → invalidate(['auctions'], ['bids', auctionId])
  │     │            → toast("입찰 성공!")
  │     │            → IncomeToast if anti-snipe
  │     │
  │     └── Error → revert optimistic update
  │              → toast(error.message)
  │
  └── usePersistence: Market Cap 캐시 업데이트 (서버 응답 반영)
```

---

## 12. Deployment Architecture

```yaml
Client:
  Host: Vercel (기존 AWW SPA)
  Build: Vite 6 (React 19 + TypeScript strict)
  CDN: Vercel Edge Network (static assets)
  Bundle Split:
    - main.js: App shell, routing, auth
    - city3d.js: Three.js + R3F + GLSL (lazy loaded)
    - tycoon.js: 경매/합병/수익 로직 (lazy loaded)

Backend:
  Host: Supabase Cloud
  DB: PostgreSQL 15+ (Supabase managed)
  Auth: Supabase Auth (Google OAuth)
  Edge Functions: Deno-based (auction-scheduler, income-settlement, npc-bidder)
  Cron: pg_cron extension (Supabase Dashboard 설정)
  Realtime: Supabase Realtime (WebSocket, Phase 5)

Monitoring:
  - Supabase Dashboard: DB 성능, 쿼리 통계, Auth 로그
  - Vercel Analytics: Core Web Vitals, 에러 추적
  - 커스텀 로그: tycoon_transactions 기반 경제 대시보드
```

---

## 13. Migration Strategy

### game_saves 테이블 하위호환

```sql
-- 기존 game_saves 컬럼 유지 (읽기 전용)
-- 신규 타이쿤 컬럼 추가
ALTER TABLE game_saves
  ADD COLUMN IF NOT EXISTS tycoon_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_tycoon_sync TIMESTAMPTZ;

-- 기존 전투 데이터는 보존 (삭제하지 않음)
-- usePersistence에서 전투 필드 접근만 제거
```

### Phase 0 마이그레이션 순서

```
1. tycoon_buildings 생성 + 서울 50건물 시드
2. tycoon_ownership 생성
3. tycoon_auctions + tycoon_bids 생성
4. tycoon_transactions 생성
5. tycoon_merges 생성
6. tycoon_income_log 생성
7. tycoon_player_stats 생성
8. RLS 정책 적용
9. RPC 함수 배포
10. game_saves 타이쿤 컬럼 추가
```

---

## 14. Cross-Cutting Concerns

### 14.1 Dual Persistence (usePersistence 리팩토링)

```
Market Cap 변동 발생 시:
  1. localStorage.setItem('tycoon_data', JSON.stringify({ totalMarketCap, lastCity, ... }))
     → 즉시 반영 (오프라인 지원)
  2. debounce(3000ms) → supabase.from('game_saves').upsert({ total_market_cap, tycoon_data })
     → 클라우드 동기화
  3. 앱 시작 시: cloud > local 정책
     → supabase에서 먼저 로드, 실패 시 localStorage 폴백
     → cloud.total_market_cap > local.total_market_cap ? cloud : local
```

### 14.2 i18n Key Structure

```yaml
# 타이쿤 전용 i18n 키 네임스페이스
tycoon:
  auction:
    title: "경매"
    place_bid: "입찰하기"
    current_bid: "현재 최고가"
    time_remaining: "남은 시간"
    anti_snipe: "시간 연장됨"
    won: "낙찰!"
    outbid: "더 높은 입찰이 있습니다"
  building:
    detail: "건물 상세"
    income_per_hour: "시간당 수익"
    owner: "소유자"
    rarity: { common: "일반", uncommon: "고급", rare: "희귀", epic: "영웅", legendary: "전설" }
    level: "레벨"
  portfolio:
    title: "포트폴리오"
    total_value: "총 가치"
    hourly_income: "시간당 수익"
    building_count: "건물 수"
  merge:
    title: "합병"
    preview: "합병 미리보기"
    cost: "합병 비용"
    result: "결과 건물"
    synergy_bonus: "시너지 보너스"
  region:
    select_country: "나라 선택"
    select_city: "도시 선택"
    district_synergy: "구역 시너지"
    city_domination: "도시 지배"
```

### 14.3 Error Handling Strategy

```yaml
Client-Side:
  - React Error Boundaries: city3d/ 전체 (3D 렌더링 실패 시 2D 폴백)
  - RPC 실패: toast 알림 + 재시도 버튼
  - 네트워크 오프라인: localStorage 캐시 표시 + "오프라인 모드" 배너

Server-Side:
  - Edge Function 실패: pg_cron 다음 주기에 자동 재실행
  - RPC 트랜잭션 실패: 자동 롤백 (PostgreSQL SAVEPOINT)
  - 정산 이중 실행: idempotency key로 무시
```

---

## 15. Open Questions

| # | Question | Impact | Proposed Resolution |
|---|----------|--------|-------------------|
| 1 | 모바일에서 3D 건물 터치 정밀도 | Medium | 건물 히트박스 확대(1.5x) + 줌 레벨별 조정 |
| 2 | 대규모 경매 동시 입찰 (100+ users) | High | SELECT FOR UPDATE + connection pooling |
| 3 | 감가상각 복구 메커니즘 필요 여부 | Medium | 업그레이드(합병) 시 감가상각 리셋으로 해결 |
| 4 | 기존 유저의 전투 Market Cap 이전 | Low | 자동 이전 (기존 balance 그대로 유지) |
| 5 | 시즌 이벤트 건물의 영구성 | Medium | Phase 7에서 결정 (시즌 종료 후 거래 가능 여부) |
| 6 | NPC 건물 소유 허용 여부 | Low | Phase 1은 무소유, Phase 3+에서 NPC 도시 소유 검토 |
| 7 | three.js 0.175→0.183 셰이더 호환성 | High | Phase 0 S02에서 GLSL 컴파일 테스트 선행 |
| 8 | Supabase pg_cron 주기 최소 단위 | Low | 1분 단위 지원 확인 (auction-settler 매분 실행) |

---

## Appendix A: git-city 3D Engine Key Constants

```typescript
// From git-city/src/components/InstancedBuildings.tsx
const ATLAS_SIZE = 2048;        // Window atlas texture size
const ATLAS_CELL = 8;           // Pixels per atlas cell
const ATLAS_COLS = 256;         // ATLAS_SIZE / ATLAS_CELL
const ATLAS_BAND_ROWS = 42;    // Rows per lit band

const RISE_DURATION = 0.85;    // Rise animation duration (seconds)
const MAX_RISE_TOTAL = 4;      // Max stagger total (seconds)

// From git-city/src/components/CityScene.tsx
const GRID_CELL_SIZE = 200;    // Spatial grid cell size for culling

// From git-city/src/components/CityCanvas.tsx
const CAMERA_FOV = 55;
const CAMERA_NEAR = 0.5;
const CAMERA_FAR = 4000;
const DPR_RANGE = [0.75, 1.25]; // Adaptive device pixel ratio

// Theme count
const THEME_COUNT = 4;          // Midnight, Sunset, Neon, Emerald
```

## Appendix B: Rarity Distribution per City (50 buildings)

| Rarity | Count | Percentage | 예시 (서울) |
|--------|-------|-----------|------------|
| Common | 30 | 60% | 아파트, 편의점, 카페, 식당 |
| Uncommon | 10 | 20% | 전통시장, 로컬 맛집, 대학교 |
| Rare | 7 | 14% | 명동거리, 신사동 가로수길, 이태원 |
| Epic | 2 | 4% | 롯데월드타워, 63빌딩 |
| Legendary | 1 | 2% | 남산타워 |

