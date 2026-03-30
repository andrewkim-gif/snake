# Git City Tycoon — Requirements Brief

## Executive Summary

기존 app_ingame의 Vampire Survivors 스타일 액션 게임을 **완전 대체**하여, git-city의 3D 엔진/비주얼을 차용한 **실시간 부동산 타이쿤 게임**으로 전환한다. 플레이어는 지구본에서 나라를 선택 → 해당 지역의 실제 랜드마크 건물(없으면 가상 건물)을 경매로 구매하고, 합병/재개발하며, 패시브 수익(Market Cap)을 얻는 경제 시뮬레이션 게임이다.

---

## 1. Core Concept

### Game Identity
- **장르**: 실시간 + 타이머 기반 부동산 타이쿤 (Idle + Event Hybrid)
- **핵심 루프**: 건물 탐색 → 경매 입찰 → 소유 → 수익 수집 → 합병/재개발 → 매각/재투자
- **시각적 정체성**: git-city의 Three.js 3D 복셀 도시 렌더링 차용
- **재화**: 기존 app_ingame의 Market Cap 시스템 활용
- **세계관**: AWW 지구본 → 나라 선택 → 해당 지역 도시 진입 흐름 유지

### What It Replaces
- app_ingame의 Arena Mode, Survival Mode, 모든 전투 시스템 **완전 제거**
- 24+ 무기, 9 캐릭터, 전투 AI, 스폰 시스템, 콤보/퀴즈 등 **모두 사라짐**
- 유지되는 것: React + Vite 프레임워크, Supabase 인증, Market Cap 재화, 기본 UI 프레임워크

---

## 2. Game Loop (Detail)

### 실시간 레이어 (Idle)
```
건물 소유 → 시간당 Market Cap 자동 생성 (패시브 수익)
수익률 = 건물 레벨 × 지역 보정 × 합병 보너스 × 시너지 보너스
```

### 이벤트 레이어 (Timer-Based)
```
정기 경매 (매 N시간/N일) → 새 건물 또는 플레이어 매각 건물 경매
특별 경매 (이벤트) → 한정 건물, 시즌 건물
합병 윈도우 → 특정 시간대에만 합병/재개발 가능 (선택적)
```

### Player Progression
```
Phase 1: 신규 → 첫 건물 구매 (저렴한 가상건물 NPC 경매)
Phase 2: 중급 → 지역 내 건물 수집, 합병 시작
Phase 3: 고급 → 다국적 포트폴리오, 랜드마크 경쟁, 리더보드 상위권
Phase 4: 엔드게임 → 지역 독점, 특별 건물 해금, 타이쿤 칭호
```

---

## 3. Building System

### 건물 분류

| 등급 | 설명 | 예시 | 기본 수익률 |
|------|------|------|-------------|
| **Common** | 가상 건물 (자동 생성) | 아파트, 편의점, 카페 | 1x |
| **Uncommon** | 지역 특색 건물 | 전통 시장, 로컬 식당 | 1.5x |
| **Rare** | 실제 유명 건물 | 명동거리 상가, 신사동 빌딩 | 2.5x |
| **Epic** | 도시 랜드마크 | 롯데타워, 63빌딩, 남산타워 | 5x |
| **Legendary** | 세계 랜드마크 | 에펠탑, 자유의여신상, 부르즈할리파 | 10x |

### 건물 속성
```yaml
Building:
  id: unique identifier
  name: "롯데월드타워"
  region: "kr-seoul-songpa"     # 지구본→나라→도시→구역
  rarity: "epic"
  level: 1-5                    # 합병으로만 레벨업
  base_income: 500              # 시간당 Market Cap
  visual:                       # git-city 3D 렌더링 파라미터
    height: 450
    width: 80
    depth: 80
    theme: "neon"               # Midnight/Sunset/Neon/Emerald
    window_lit_pct: 0.85
  owner_id: player_id | null
  auction_history: [...]
  merge_target: boolean         # 합병 대상 여부
```

### 합병/재개발 시스템
```
합병 규칙:
- 같은 지역(region) 내 2~4개 건물 합병 가능
- 합병 시 새로운 상위 등급 건물 생성 (또는 레벨업)
- 합병 비용: Market Cap (건물 가치의 20%)
- 합병 결과 건물의 수익률 = 원본들의 합 × 1.3 (30% 시너지 보너스)
- 재개발: 건물 철거 → 빈 땅 → 더 높은 등급 건물 건설 (확률 기반)

시각적 효과:
- 합병 시 git-city의 building rise animation 활용
- 레벨업 시 건물 높이/너비 증가 + 윈도우 점등률 증가
- Epic 이상 건물은 특수 이펙트 (네온 트림, 스포트라이트 등)
```

---

## 4. Auction System (경매)

### 경매 유형
| 유형 | 주기 | 설명 |
|------|------|------|
| **일반 경매** | 매 4시간 | Common~Rare 건물 5~10개 |
| **프리미엄 경매** | 매일 1회 | Epic 건물 1~2개 |
| **레전더리 경매** | 매주 1회 | Legendary 건물 1개 (서버 전체 경쟁) |
| **플레이어 매각** | 상시 | 플레이어가 등록한 건물 (최소 입찰가 설정) |
| **긴급 매각** | 랜덤 이벤트 | NPC가 급매물 출시 (할인가, 제한 시간) |

### 경매 메카닉
```yaml
Auction:
  type: "english"              # 영국식 경매 (가격 올리기)
  duration: 5min ~ 24hr        # 등급별 다름
  starting_bid: base_value × 0.5
  bid_increment: base_value × 0.05
  anti_snipe: true             # 마지막 30초 입찰 시 시간 연장
  max_bid: null                # 상한 없음

  # NPC 입찰자
  npc_bidders: 2-5             # 가격 발견을 위한 NPC 경쟁자
  npc_strategy: "gradually escalate to ~80% of fair value"

  # 수수료
  buyer_fee: 5%                # 거래 수수료 (Market Cap sink)
  seller_fee: 10%              # 매각 수수료 (인플레이션 방지)
```

---

## 5. Economy Design

### Market Cap Flow
```
유입 (Faucets):
  - 건물 패시브 수익 (메인 유입원)
  - 일일 출석 보너스
  - 업적/마일스톤 보상
  - 이벤트 보상

유출 (Sinks):
  - 경매 입찰 (핵심 유출원)
  - 합병/재개발 비용 (건물 가치의 20%)
  - 거래 수수료 (구매 5%, 매각 10%)
  - 건물 유지비 (시간당 수익의 10% — 방치 방지)
  - 프리미엄 장식 구매 (git-city의 crown/roof/aura 아이템)

밸런스 목표:
  - 신규 플레이어: 첫 건물까지 ~30분
  - 첫 합병까지: ~2일
  - 첫 Epic 건물까지: ~1주
  - Legendary 경쟁 가능: ~1달
```

### 인플레이션 방지 메커니즘
1. **건물 유지비**: 소유 건물이 많을수록 유지비 총액 증가
2. **거래 수수료**: 모든 거래에서 15% 소멸 (구매 5% + 매각 10%)
3. **합병 비용**: 성장하려면 지속적으로 Market Cap 소비
4. **감가상각**: 미업그레이드 건물의 수익률이 서서히 감소 (주간 -2%)
5. **지역 포화**: 한 지역 건물 과다 보유 시 수익률 체감 (diminishing returns)

---

## 6. Region System (지역 체계)

### 기존 AWW 흐름 연동
```
지구본 (Globe) → 나라 선택 (Country) → 도시 진입 (City) → 건물 경매/관리
```

### 지역 구조
```yaml
World:
  Countries:
    - Korea:
        Cities:
          - Seoul:
              Districts: [Gangnam, Jongno, Songpa, Mapo, ...]
              Landmarks: [롯데월드타워, 63빌딩, 남산타워, DDP, ...]
          - Busan:
              Districts: [Haeundae, Nampo, ...]
              Landmarks: [광안대교, 해운대...]
    - USA:
        Cities:
          - New York:
              Districts: [Manhattan, Brooklyn, ...]
              Landmarks: [Empire State, Statue of Liberty, ...]
          - San Francisco: ...
    - Japan:
        Cities:
          - Tokyo:
              Districts: [Shibuya, Shinjuku, ...]
              Landmarks: [Tokyo Tower, Skytree, ...]
```

### 지역 보너스
- **District Synergy**: 같은 구역 건물 3개 이상 소유 시 수익률 +20%
- **City Domination**: 도시 내 건물 10개 이상 소유 시 "도시 대부호" 칭호 + 수익률 +30%
- **Country Collection**: 나라 내 모든 랜드마크 소유 시 특별 건물 해금
- **Global Tycoon**: 3개국 이상 건물 보유 시 글로벌 리더보드 진입

---

## 7. Visual System (git-city 3D 엔진 차용)

### 차용 요소
```yaml
From_git-city:
  Rendering:
    - Three.js (R3F + drei)
    - InstancedMesh 대량 건물 렌더링
    - Custom GLSL 셰이더 (윈도우 조명, 안개, 디더링)
    - 2048x2048 텍스처 아틀라스
    - Building rise animation (staggered ease-out)

  Themes:
    - Midnight (dark blue — 기본)
    - Sunset (warm orange)
    - Neon (cyberpunk)
    - Emerald (green)

  Building Visuals:
    - 높이/너비/깊이 = 건물 등급 + 레벨에 따라 결정
    - 윈도우 점등률 = 건물 수익률에 비례
    - 레벨 5 건물: 특수 이펙트 (neon_trim, spotlight, hologram_ring)

  City Layout:
    - 4x4 city blocks, spiral coordinate system
    - 38x32 lot dimensions
    - 12-unit streets between blocks
    - LOD culling for performance

  Effects:
    - CelebrationEffect (건물 구매 시)
    - BuildingEffects (레벨업 시)
    - ThemeSkyFX (지역별 하늘 효과)
    - DropBeacon → AuctionBeacon (경매 건물 하이라이트)
```

### 신규 추가 비주얼
```yaml
New_Visuals:
  - 경매 카운트다운 UI (건물 위 floating timer)
  - 소유자 네임태그 (git-city의 InstancedLabels 활용)
  - 합병 이펙트 (건물 2개가 합쳐지는 3D 애니메이션)
  - 수익 파티클 (건물에서 Market Cap 코인이 떠오르는 효과)
  - 지역 맵 뷰 (도시 전체를 내려다보는 카메라)
  - 소유 건물 하이라이트 (내 건물은 특별 아웃라인)
```

---

## 8. Phased Delivery (단계별 릴리즈)

### Phase 1: Core Foundation (MVP) — 2~3주
```
기능:
  ✅ 전투 시스템 완전 제거 (Arena, Survival, 무기, 적, 콤보 등)
  ✅ git-city 3D 렌더링 엔진 통합 (R3F + InstancedMesh)
  ✅ 건물 카탈로그 (Common~Rare, 1개 도시 — 서울)
  ✅ NPC 경매 시스템 (일반 경매만)
  ✅ 건물 소유권 + 패시브 수익
  ✅ Market Cap 연동 (기존 재화)
  ✅ 기본 UI: 도시 뷰, 건물 상세, 경매 입찰, 포트폴리오
  ✅ Supabase 데이터 모델 (buildings, auctions, ownership, transactions)

화면:
  1. 도시 3D 뷰 (건물 배치 + 경매 하이라이트)
  2. 경매 목록 (시간순, 등급 필터)
  3. 건물 상세 (수익률, 역사, 입찰)
  4. 내 포트폴리오 (소유 건물 목록, 총 수익)
```

### Phase 2: Growth Systems — 2주
```
기능:
  ✅ 합병/재개발 시스템
  ✅ 건물 레벨 시스템 (1~5)
  ✅ District 시너지 보너스
  ✅ Epic/Legendary 건물 + 프리미엄/레전더리 경매
  ✅ 2번째 도시 추가 (도쿄 또는 뉴욕)
  ✅ 건물 장식 시스템 (git-city crown/roof/aura 차용)
  ✅ 일일 출석 보너스 + 업적 시스템

화면 추가:
  5. 합병 UI (건물 선택 → 합병 미리보기 → 확인)
  6. 장식 상점 (건물 커스터마이제이션)
```

### Phase 3: Social & Competition — 2주
```
기능:
  ✅ 플레이어 매각 경매 (P2P 거래)
  ✅ 리더보드 (포트폴리오 가치, 수익률, 건물 수)
  ✅ 이벤트 시스템 (시즌 건물, 특별 경매, 지역 이벤트)
  ✅ 알림 시스템 (경매 종료, 수익 정산, 합병 가능)
  ✅ 추가 도시 (3~5개 나라)
  ✅ 글로벌 타이쿤 칭호 시스템
  ✅ 실제 결제 연동 (프리미엄 건물 또는 Market Cap 구매)

화면 추가:
  7. 글로벌 리더보드
  8. 이벤트 캘린더
  9. 알림 센터
```

---

## 9. Technical Architecture

### 기존 코드 재활용 분석
```yaml
app_ingame 코드 유지:
  - React + Vite 프레임워크
  - Supabase 인증 (useAuth, useSupabase)
  - usePersistence (Market Cap, 영구 데이터)
  - UI 프레임워크 (ModalBase, Tooltip, IntroScreen 리팩토링)
  - i18n (다국어)
  - constants.ts (일부)
  - index.tsx (진입점)

app_ingame 코드 제거:
  - game/ 디렉토리 전체 (전투 엔진)
  - 전투 관련 components/ (GameCanvas, UIOverlay, LevelUpModal, BossCutscene 등)
  - 전투 관련 hooks/ (useGameState, useArena, useBoss, useCombo, useBreakTime 등)
  - 전투 관련 config/ (weapons, enemies, arena, combo, breaktime 등)
  - 캐릭터 시스템 (classes, skins, sprites)

git-city 코드 차용:
  - Three.js 렌더링 파이프라인 (CityCanvas, CityScene, InstancedBuildings)
  - Building3D 컴포넌트
  - InstancedLabels (소유자 태그)
  - BuildingEffects (이펙트)
  - ThemeSkyFX (하늘 효과)
  - 테마 시스템 (Midnight/Sunset/Neon/Emerald)
  - City block layout algorithm
```

### 신규 개발 필요
```yaml
New_Systems:
  - AuctionEngine (경매 로직 — 타이머, 입찰, NPC AI, anti-snipe)
  - BuildingManager (건물 CRUD, 소유권, 수익 계산)
  - MergeSystem (합병/재개발 로직)
  - IncomeCalculator (패시브 수익 정산)
  - RegionManager (지역 데이터, 시너지 계산)
  - LeaderboardService (포트폴리오 가치 랭킹)

New_UI:
  - CityTycoonView (3D 도시 + 경매 오버레이)
  - AuctionPanel (경매 목록 + 입찰 UI)
  - BuildingDetailModal (건물 정보 + 수익 차트)
  - PortfolioPanel (내 건물 관리)
  - MergeUI (합병 인터페이스)
  - RegionSelector (지구본 → 나라 → 도시 네비게이션)

New_DB_Tables:
  - tycoon_buildings (건물 카탈로그)
  - tycoon_ownership (소유 기록)
  - tycoon_auctions (경매 기록)
  - tycoon_bids (입찰 기록)
  - tycoon_transactions (거래/수수료 기록)
  - tycoon_merges (합병 이력)
  - tycoon_income_log (수익 정산 기록)
  - tycoon_regions (지역 데이터)
```

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| git-city 3D 엔진 통합 복잡도 | High | Phase 1에서 최소 건물만 렌더링, 점진적 이펙트 추가 |
| 경제 밸런스 붕괴 | High | NPC 경매로 가격 앵커링, 감가상각/유지비로 인플레이션 제어 |
| 실제 건물 데이터 수집 | Medium | Phase 1은 서울만, 수동 큐레이션. Phase 2부터 자동화 검토 |
| 경매 타이밍 문제 | Medium | 시간대별 경매 분산, 비동기 입찰(부재 입찰) 지원 |
| 기존 유저 이탈 | Medium | 전환 기간 중 양쪽 모드 유지 고려, 기존 Market Cap 보존 |

---

## Clarity Breakdown

| Dimension | Score | Status |
|-----------|-------|--------|
| Goal Clarity | 0.95 | 실시간 타이머 부동산 타이쿤, 경매, 합병, 지역 건물 |
| Constraint Clarity | 0.80 | 전투 제거, git-city 3D, Market Cap, 지구본 흐름 |
| Success Criteria | 0.75 | 재미+수익화 우선, 단계별 릴리즈 |
| **Ambiguity Score** | **0.14** | **Ready (< 0.20)** |

## Interview Summary
- Rounds completed: 4
- Challenge agents used: none (ambiguity resolved quickly)
- Weakest dimension at start: Criteria (0.15)
- Final weakest dimension: Criteria (0.75)

## Confidence Level: High

## Next Steps
1. `/da:plan` — 시스템 아키텍처 설계 (DB 스키마, API 설계, 컴포넌트 트리)
2. `/da:design` — UI/UX 디자인 (화면 플로우, 와이어프레임)
3. `/da:dev` — Phase 1 구현 시작
