# Roadmap: Git City Tycoon

> 이 파일은 da:work의 roadmap 모드에서 자동 파싱됩니다.
> 각 Step은 `### SNN: [이름]` 형식이며, file/ref/blocked_by/do/verify 필드를 포함합니다.

## Phase 0 — 프로젝트 정리 및 기반 인프라

### S01: 전투 코드 대량 삭제
- **file**: game/*, config/weapons.config.ts, config/enemies.config.ts, config/arena.config.ts, config/combo.config.ts, config/breaktime.config.ts, config/quiz.config.ts, config/obstacles.config.ts, config/turrets.config.ts, config/agents.config.ts, config/arena-agents.config.ts, config/skins.config.ts, config/skills/*
- **ref**: docs/prd/PRD-git-city-tycoon-2026-03-20.md §9
- **blocked_by**: none
- **do**:
  1. game/ 디렉토리 전체 삭제 (13 시스템, 40+ 렌더러, 스프라이트, 맵, 충돌)
  2. 전투 관련 config 파일 삭제 (28개)
  3. 전투 관련 hooks 삭제 (33개: useGameState, useArena, useBoss, useCombo, useBreakTime, useQuizChallenge, useChest, useV3Systems, useSingularity, useAgentPlacement, useTurretPlacement, useTileMap, useSpriteAnimation, useSkillMap, useSkillBuild, useProgressiveSkill, useEventLog, useTutorial, useSkins, useWittyMessages 등)
  4. 전투 관련 components 삭제 (71개: GameCanvas, UIOverlay, LevelUpModal, BossCutscene, StageBossIntro, StageClearModal, RouletteModal, arena/*, game/*, skill/*, tutorial/* 등)
  5. 남은 import 오류 수정
- **verify**: `npm run build` 성공 (빈 앱), 0개 전투 관련 import

### S02: 의존성 업그레이드
- **file**: package.json
- **ref**: —
- **blocked_by**: S01
- **do**:
  1. three.js 0.175.0 → ^0.183.0 업그레이드
  2. @types/three 0.175.0 → ^0.183.0 업그레이드
  3. @react-three/fiber 9.4.2 → ^9.5.0 업그레이드
  4. @react-three/postprocessing ^3.0.4 추가
  5. postprocessing ^6.38.3 추가
  6. 전투 전용 패키지 제거 (해당 시 확인)
  7. npm install + 빌드 검증
  8. git-city CityCanvas 임시 렌더링으로 GLSL 셰이더 호환성 검증
- **verify**: `npm run build` 성공, three.js 0.183+ 확인, R3F 9.5+ 확인, git-city 셰이더 렌더링 정상

### S03: App.tsx 리팩토링
- **file**: App.tsx
- **ref**: —
- **blocked_by**: S01
- **do**:
  1. 전투 관련 import/state/effect/render 모두 제거
  2. 타이쿤 진입점 스캐폴딩 (CityTycoonView placeholder)
  3. 기존 IntroScreen → 타이쿤 테마로 리팩토링
  4. usePersistence에서 Market Cap만 유지
- **verify**: 앱 실행 → IntroScreen → CityTycoonView placeholder 렌더링

### S04: usePersistence 리팩토링
- **file**: hooks/usePersistence.ts
- **ref**: —
- **blocked_by**: S01, S02
- **do**:
  1. 전투 데이터 필드 제거 (unlockedClasses, clearedStages, weapons, combos 등)
  2. Market Cap (totalMarketCap) 관련 로직 100% 유지
  3. 타이쿤 데이터 필드 추가 준비 (portfolio_value, building_count)
  4. GameSaveData 인터페이스 업데이트
  5. Supabase 동기화 로직 유지 (debounced 3s)
- **verify**: Market Cap 로드/저장/동기화 동작 확인, localStorage + Supabase

### S05: Supabase 타이쿤 테이블 생성
- **file**: supabase/migrations/XXX_tycoon_system.sql
- **ref**: docs/prd/PRD-git-city-tycoon-2026-03-20.md §9
- **blocked_by**: none
- **do**:
  1. tycoon_buildings 테이블 (id, name, region_code, rarity, base_income, visual_height/width/depth, theme, level, max_level)
  2. tycoon_ownership 테이블 (id, building_id FK, owner_id FK, purchased_at, purchase_price, is_active)
  3. tycoon_auctions 테이블 (id, building_id FK, type, status, starting_bid, current_bid, winner_id, start_at, end_at)
  4. tycoon_bids 테이블 (id, auction_id FK, bidder_id FK, amount, is_npc, created_at)
  5. tycoon_transactions 테이블 (id, user_id, type, amount, fee, balance_before, balance_after, ref_id)
  6. tycoon_merges 테이블 (id, user_id, source_building_ids, result_building_id, cost, created_at)
  7. tycoon_income_log 테이블 (id, user_id, building_id, amount, period_start, period_end)
  8. tycoon_player_stats 테이블 (user_id PK, portfolio_value, total_income, building_count, highest_rarity)
  9. RLS 정책: 자신의 소유/입찰만 수정 가능, 건물/경매는 모두 읽기 가능
  10. 인덱스: building region_code, auction status+end_at, ownership owner_id
- **verify**: Supabase 마이그레이션 성공, 테이블 생성 확인, RLS 정책 테스트

### S06: 타이쿤 디렉토리 구조 생성
- **file**: tycoon/*, city3d/*, components/tycoon/*, api/*
- **ref**: PLAN.md §4 아키텍처
- **blocked_by**: S01
- **do**:
  1. tycoon/engine/ — AuctionEngine, BuildingManager, IncomeCalculator, MergeSystem, RegionManager 스텁
  2. tycoon/data/ — regions.ts 스텁
  3. tycoon/config/ — economy.config.ts, auction.config.ts, merge.config.ts 스텁
  4. city3d/ — CityCanvas, CityScene, InstancedBuildings 스텁
  5. components/tycoon/ — CityTycoonView, AuctionPanel, BuildingDetail, PortfolioPanel 스텁
  6. hooks/ — useTycoon, useAuction, usePortfolio, useMerge, useIncome, useBuilding3D 스텁
  7. api/ — buildings.ts, auctions.ts, ownership.ts, income.ts 스텁
- **verify**: 모든 스텁 파일 import 가능, `npm run build` 성공

## Phase 1 — 3D 도시 렌더링 엔진 포팅

### S07: git-city CityCanvas 포팅
- **file**: city3d/CityCanvas.tsx, city3d/themes.ts
- **ref**: git-city/src/components/CityCanvas.tsx
- **blocked_by**: S02, S06
- **do**:
  1. R3F Canvas 설정 복사 (PerspectiveCamera fov:55, near:0.5, far:4000)
  2. OrbitControls 설정 (damping, distance limits, polar angle)
  3. 4종 테마 정의 (Midnight/Sunset/Neon/Emerald → themes.ts)
  4. PerformanceMonitor + 적응형 DPR (0.75~1.25)
  5. Fog 시스템 + toneMappingExposure
  6. 타이쿤용 수정: 카메라 초기 위치/타겟 조정 (도시 중앙 기준)
- **verify**: 빈 3D 씬 렌더링, 카메라 조작, 테마 전환 동작

### S08: GLSL 셰이더 + 윈도우 아틀라스 포팅
- **file**: city3d/shaders/building.vert.glsl, city3d/shaders/building.frag.glsl, city3d/atlas.ts
- **ref**: git-city/src/components/InstancedBuildings.tsx (인라인 셰이더)
- **blocked_by**: S07
- **do**:
  1. 버텍스 셰이더 추출 (instance transform, rise animation, face UV)
  2. 프래그먼트 셰이더 추출 (아틀라스 UV, 테마 컬러, Bayer dithering, fog)
  3. createWindowAtlas() 함수 포팅 (2048x2048 CanvasTexture, 6개 점등 밴드)
  4. 셰이더 uniform 인터페이스 정의
- **verify**: 셰이더 컴파일 성공, 아틀라스 텍스처 생성 확인

### S09: InstancedBuildings 포팅
- **file**: city3d/InstancedBuildings.tsx
- **ref**: git-city/src/components/InstancedBuildings.tsx
- **blocked_by**: S08
- **do**:
  1. InstancedMesh + BoxGeometry(1,1,1) 설정
  2. 5개 InstancedBufferAttribute (aUvFront, aUvSide, aRise, aTint, aLive)
  3. ShaderMaterial with ported shaders
  4. Instance matrix 설정 (position, scale → width/height/depth)
  5. Rise animation (staggered ease-out cubic, 0.85s)
  6. 건물 클릭 레이캐스팅 (수동 intersectObject)
  7. 호버 효과 (throttled ~8Hz)
  8. Bounding sphere 수동 계산
  9. 타이쿤 수정: 소유자별 tint 색상, 경매 중 건물 깜빡임
- **verify**: 50+ 건물 단일 draw call 렌더링, 클릭/호버 동작, rise animation

### S10: InstancedLabels + CityScene 포팅
- **file**: city3d/InstancedLabels.tsx, city3d/CityScene.tsx
- **ref**: git-city/src/components/InstancedLabels.tsx, CityScene.tsx
- **blocked_by**: S09
- **do**:
  1. InstancedLabels: 빌보드 셰이더 라벨 (소유자 이름/건물 이름)
  2. CityScene: InstancedBuildings + InstancedLabels 조합
  3. 공간 그리드 (GRID_CELL_SIZE=200) for LOD/이펙트 컬링
  4. 기본 ground plane + grid 렌더링
- **verify**: 건물 + 라벨 동시 렌더링, 카메라 이동 시 라벨 빌보드 동작

### S11: 건물 데이터 → 3D 매핑 연동
- **file**: tycoon/data/buildings-seoul.ts, api/buildings.ts, city3d/CityScene.tsx
- **ref**: —
- **blocked_by**: S05, S10
- **do**:
  1. 서울 건물 카탈로그 50개 하드코딩 (이름, 등급, 좌표, 비주얼)
  2. api/buildings.ts: Supabase에서 건물 목록 fetch
  3. 건물 데이터 → InstancedBuildings 매핑 (height/width/depth → scale, rarity → tint)
  4. 소유자 정보 → InstancedLabels 매핑
  5. CityTycoonView에 3D 뷰 마운트
- **verify**: 서울 50개 건물 3D 도시 렌더링, 등급별 크기 차이, 소유자 라벨

## Phase 2 — 건물 카탈로그 + 기본 경매

### S12: BuildingManager 구현
- **file**: tycoon/engine/BuildingManager.ts, hooks/useTycoon.ts
- **ref**: —
- **blocked_by**: S05, S06
- **do**:
  1. 건물 CRUD (fetch, getById, getByRegion, getByOwner)
  2. 소유권 관리 (assign, release, transfer)
  3. 건물 가치 계산 (base_income × level × rarity_multiplier)
  4. useTycoon hook: 타이쿤 메인 상태 관리 (현재 도시, 선택 건물)
- **verify**: 건물 목록 로드, 소유권 변경, 가치 계산 정확

### S13: AuctionEngine 기본 구현
- **file**: tycoon/engine/AuctionEngine.ts, tycoon/config/auction.config.ts
- **ref**: docs/prd/PRD-git-city-tycoon-2026-03-20.md §4
- **blocked_by**: S05
- **do**:
  1. 경매 생성 (building_id, type, starting_bid, duration)
  2. 입찰 (auction_id, bidder_id, amount) — 최소 증분 검증
  3. Anti-snipe: 마지막 30초 입찰 시 +30초 연장
  4. 경매 종료 처리 (낙찰자 결정, 소유권 이전 RPC)
  5. 수수료 차감 (buyer 5%, seller 10%)
  6. auction.config.ts: 일반 경매 상수 (4시간 주기, 5~10건)
- **verify**: 경매 생성 → 입찰 → anti-snipe → 종료 → 소유권 이전 전체 플로우

### S14: NPC 입찰자 AI
- **file**: tycoon/engine/AuctionEngine.ts (NPC 로직 추가)
- **ref**: —
- **blocked_by**: S13
- **do**:
  1. NPC 2~5명 자동 생성 (경매당)
  2. 입찰 전략: fair value의 60~80% 범위에서 점진적 입찰
  3. 입찰 타이밍: 경매 시간의 30~80% 시점에 랜덤 배치
  4. NPC는 서로 경쟁하지 않음 (개별 상한선)
  5. tycoon_bids에 is_npc=true로 기록
- **verify**: NPC 입찰 자동 실행, fair value 근처에서 가격 형성

### S15: 경매 스케줄러 (Supabase Edge Function)
- **file**: supabase/functions/auction-scheduler/*
- **ref**: —
- **blocked_by**: S13
- **do**:
  1. Edge Function: 소유자 없는 건물 중 5~10개 랜덤 선택
  2. 일반 경매 생성 (4시간 주기)
  3. 경매 종료 처리 (낙찰/유찰 판정)
  4. pg_cron 또는 Vercel cron으로 스케줄링
  5. 유찰 시 시작가 -10% 후 재등록
- **verify**: 자동 경매 생성, 종료 시 정산, 유찰 처리

### S16: AuctionPanel + BuildingDetail UI
- **file**: components/tycoon/AuctionPanel.tsx, components/tycoon/AuctionTimer.tsx, components/tycoon/BuildingDetail.tsx
- **ref**: —
- **blocked_by**: S12, S13
- **do**:
  1. AuctionPanel: 활성 경매 목록 (등급 필터, 시간순 정렬)
  2. AuctionTimer: 카운트다운 (초 단위, anti-snipe 표시)
  3. 입찰 UI: 현재 최고가 + 입찰 금액 입력 + 입찰 버튼
  4. BuildingDetail: 건물 상세 모달 (이름, 등급, 수익률, 소유자, 경매 이력)
  5. 건물 3D 클릭 → BuildingDetail 연결
- **verify**: 경매 목록 표시, 입찰 동작, 카운트다운, 건물 상세

## Phase 3 — 패시브 수익 + 포트폴리오

### S17: IncomeCalculator 구현
- **file**: tycoon/engine/IncomeCalculator.ts, tycoon/config/economy.config.ts
- **ref**: docs/prd/PRD-git-city-tycoon-2026-03-20.md §5
- **blocked_by**: S12
- **do**:
  1. 수익 공식: base_income × level_mult × region_modifier × synergy_bonus
  2. economy.config.ts: rarity별 base_income, level 배수 (1.0/1.3/1.7/2.2/3.0)
  3. 유지비 계산: 총 수익의 10% (건물 수 비례 증가)
  4. 감가상각: 미업그레이드 건물 주간 -2%
  5. 지역 포화: 같은 지역 건물 과다 보유 시 체감
- **verify**: 수익 계산 정확, 유지비 차감, 감가상각 적용

### S18: 수익 정산 Edge Function
- **file**: supabase/functions/income-settlement/*
- **ref**: —
- **blocked_by**: S17
- **do**:
  1. 1시간마다 모든 소유 건물 수익 계산
  2. 유지비 차감 후 순수익을 Market Cap에 가산
  3. tycoon_income_log에 기록
  4. tycoon_player_stats 업데이트 (total_income, portfolio_value)
  5. game_saves.total_market_cap 동기화
- **verify**: 정산 실행 → Market Cap 증가 → 로그 기록 → 동기화

### S19: PortfolioPanel UI
- **file**: components/tycoon/PortfolioPanel.tsx, hooks/usePortfolio.ts
- **ref**: —
- **blocked_by**: S17
- **do**:
  1. usePortfolio: 소유 건물 목록, 총 가치, 총 수익, 건물 수
  2. PortfolioPanel: 건물 카드 (이름, 등급, 수익률, 레벨)
  3. 수익 요약 (시간당, 일간, 주간 수익)
  4. 포트폴리오 가치 추이 (간단한 차트)
  5. 건물 정렬 (가치순, 수익순, 등급순)
- **verify**: 포트폴리오 목록, 가치 합산, 수익 요약 정확

## Phase 4 — 합병/재개발 시스템

### S20: MergeSystem 구현
- **file**: tycoon/engine/MergeSystem.ts, tycoon/config/merge.config.ts
- **ref**: docs/prd/PRD-git-city-tycoon-2026-03-20.md §3
- **blocked_by**: S12
- **do**:
  1. 합병 가능 여부 검증 (같은 지역, 2~4개, 소유자 동일)
  2. 합병 비용 계산 (원본 가치 합계의 20%)
  3. 결과 건물 생성 (수익 = 원본 합 × 1.3, 레벨 +1 or 등급 업)
  4. 원본 건물 비활성화 (소프트 삭제)
  5. merge.config.ts: 합병 규칙 상수
- **verify**: 합병 로직 (선택→검증→비용→결과→삭제), 시너지 보너스

### S21: MergePanel UI + 3D 이펙트
- **file**: components/tycoon/MergePanel.tsx, hooks/useMerge.ts, city3d/BuildingEffects.tsx
- **ref**: —
- **blocked_by**: S20
- **do**:
  1. useMerge: 합병 상태 관리 (선택 건물, 미리보기, 실행)
  2. MergePanel: 건물 선택 UI → 미리보기 (결과 스탯) → 확인/취소
  3. BuildingEffects: 합병 시 rise animation 변형 (원본 축소 → 결과 상승)
  4. 재개발: 건물 철거 + 확률 기반 상위 건물 건설 UI
- **verify**: 합병 UI 플로우, 3D 이펙트, 재개발 동작

### S22: District 시너지 구현
- **file**: tycoon/engine/RegionManager.ts (부분), tycoon/engine/IncomeCalculator.ts (수정)
- **ref**: —
- **blocked_by**: S17, S20
- **do**:
  1. 같은 구역 3개+ 소유 → +20% 수익률 (District Synergy)
  2. 도시 내 10개+ 소유 → +30% + "도시 대부호" 칭호 (City Domination)
  3. IncomeCalculator에 시너지 보너스 반영
  4. 포트폴리오에서 시너지 상태 표시
- **verify**: 시너지 조건 충족 시 수익률 증가, 칭호 부여

## Phase 5 — 고급 경매 + 플레이어 매각

### S23: 프리미엄/레전더리 경매
- **file**: tycoon/engine/AuctionEngine.ts (확장), supabase/functions/auction-scheduler/*
- **ref**: —
- **blocked_by**: S15
- **do**:
  1. 프리미엄 경매: 매일 1회, Epic 건물, 12시간 경매
  2. 레전더리 경매: 매주 1회, Legendary 건물, 24시간 경매
  3. 경매 유형별 NPC 전략 차별화 (프리미엄: 90%, 레전더리: 95% fair value)
  4. 경매 스케줄러 업데이트
- **verify**: 3종 경매 자동 생성, 등급별 타이밍/NPC 차이

### S24: 플레이어 매각 + 긴급 매각
- **file**: tycoon/engine/AuctionEngine.ts (확장), components/tycoon/SellPanel.tsx
- **ref**: —
- **blocked_by**: S13
- **do**:
  1. 플레이어 매각: 소유 건물 → 경매 등록 (최소 입찰가 설정)
  2. 매각 수수료 10% 안내
  3. 긴급 매각: NPC 급매물 랜덤 이벤트 (fair value의 60~70%, 1시간 제한)
  4. SellPanel UI: 매각 등록 폼 + 수수료 미리보기
- **verify**: 플레이어 매각 등록 → 낙찰 → 수수료 차감, 긴급 매각 이벤트

### S25: AuctionBeacon 3D + Realtime
- **file**: city3d/AuctionBeacon.tsx, api/auctions.ts (Realtime 추가)
- **ref**: git-city/src/components/DropBeacon.tsx
- **blocked_by**: S09
- **do**:
  1. AuctionBeacon: 경매 진행 중인 건물에 빛기둥 이펙트
  2. 등급별 비콘 색상 (Common: white, Rare: blue, Epic: purple, Legendary: gold)
  3. 카운트다운 floating text
  4. Supabase Realtime: 경매 채널 구독 → 실시간 입찰 업데이트
- **verify**: 비콘 렌더링, 실시간 입찰 반영, 카운트다운 동기화

## Phase 6 — 지역 확장 + 리더보드

### S26: RegionManager 구현
- **file**: tycoon/engine/RegionManager.ts, tycoon/data/regions.ts
- **ref**: —
- **blocked_by**: S06
- **do**:
  1. 지역 계층 구조 (Country → City → District)
  2. regions.ts: 한국/미국/일본 도시+구역 데이터
  3. 지역별 보정 계수 (인기 지역 = 높은 보정)
  4. Country Collection 로직 (나라 내 모든 랜드마크 소유 감지)
- **verify**: 지역 계층 조회, 보정 계수 적용

### S27: 2번째/3번째 도시 추가
- **file**: tycoon/data/buildings-tokyo.ts, tycoon/data/buildings-newyork.ts
- **ref**: —
- **blocked_by**: S26
- **do**:
  1. 도쿄 건물 카탈로그 50개 (Tokyo Tower, Skytree, Shibuya Crossing 등)
  2. 뉴욕 건물 카탈로그 50개 (Empire State, Statue of Liberty 등)
  3. 도시별 테마 매핑 (도쿄: Neon, 뉴욕: Midnight)
  4. CityScene에서 도시 전환 지원
- **verify**: 3개 도시 전환, 각 도시 50개 건물 렌더링

### S28: RegionNav + 리더보드 UI
- **file**: components/tycoon/RegionNav.tsx, components/tycoon/Leaderboard.tsx
- **ref**: —
- **blocked_by**: S26, S27
- **do**:
  1. RegionNav: 지구본 → 나라 → 도시 네비게이션 (기존 AWW 흐름 연동)
  2. Leaderboard: 포트폴리오 가치 기준 글로벌 랭킹
  3. 타이쿤 칭호 (초보 투자자 → 부동산 왕 → 글로벌 타이쿤)
  4. 글로벌 타이쿤: 3개국+ 건물 보유 시 별도 카테고리
- **verify**: 도시 네비게이션, 리더보드 정렬, 칭호 부여

## Phase 7 — 건물 장식 + 이벤트 + 수익화

### S29: 건물 장식 시스템
- **file**: city3d/BuildingEffects.tsx (확장), components/tycoon/DecorationShop.tsx
- **ref**: git-city/src/lib/zones.ts (crown/roof/aura 개념)
- **blocked_by**: S09
- **do**:
  1. 장식 카탈로그 (crown: 깃발/첨탑, roof: 정원/수영장, aura: 네온/파티클)
  2. 장식별 Market Cap 가격
  3. BuildingEffects에 장식 렌더링 추가
  4. DecorationShop UI: 장식 목록 + 구매 + 미리보기
- **verify**: 장식 구매 → 건물 3D 반영, 카탈로그 표시

### S30: 이벤트 + 업적 + 수익화
- **file**: components/tycoon/EventCalendar.tsx, components/tycoon/AchievementPanel.tsx
- **ref**: —
- **blocked_by**: S23
- **do**:
  1. 시즌 이벤트: 시즌 한정 건물 경매 (설날, 크리스마스 등)
  2. 업적: 첫 건물, 첫 합병, 첫 Epic, District 정복 등 + Market Cap 보상
  3. 일일 출석 보너스 (연속 출석 스케일링)
  4. EventCalendar: 예정 경매/이벤트 일정
  5. 알림 시스템 (경매 종료 5분 전, 수익 정산, 합병 가능)
  6. Stripe 결제: Market Cap 직접 구매 또는 프리미엄 건물 팩
- **verify**: 이벤트 경매 동작, 업적 해금, 출석 보너스, 결제 플로우