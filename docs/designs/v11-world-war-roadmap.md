# AI World War — 상세 구현 로드맵 (v11)

> 이 파일은 da:work의 roadmap 모드에서 자동 파싱됩니다.
> 각 Step은 `### SNN: [이름]` 형식이며, file/ref/blocked_by/do/verify 필드를 포함합니다.
> **총 Step**: S01~S53 (10 Phase — 블록체인 포함)

---

## Phase 0 — 기반 인프라

### S01: PostgreSQL 스키마 설계 + 마이그레이션
- **file**: server/internal/db/schema.sql, server/internal/db/migrations/
- **ref**: v11-world-war-plan.md §12.3
- **blocked_by**: none
- **do**:
  1. users 테이블 (id, email, username, api_keys[], created_at)
  2. factions 테이블 (id, name, leader_id, treasury, prestige, created_at)
  3. faction_members 테이블 (faction_id, user_id, role, joined_at)
  4. countries 테이블 (iso3, name_original, name_custom, tier, resources_json, sovereign_faction_id, sovereignty_level, gdp)
  5. seasons 테이블 (id, name, start_at, end_at, phase, status)
  6. battles 테이블 (id, country_iso, season_id, started_at, ended_at, results_json)
  7. diplomacy 테이블 (id, type, faction_a, faction_b, status, expires_at)
  8. achievements 테이블 (id, user_id, achievement_key, unlocked_at)
- **verify**: `psql` 연결 성공, 마이그레이션 실행, seed 데이터 확인

### S02: Redis 설정 + pub/sub 채널 구조
- **file**: server/internal/cache/redis.go, server/internal/cache/channels.go
- **ref**: v11-world-war-plan.md §12.3
- **blocked_by**: none
- **do**:
  1. Redis 연결 설정 (go-redis/v9)
  2. 채널 정의: game:{iso}, sovereignty:{iso}, battle:{iso}, global:events
  3. pub/sub 래퍼 (Publish/Subscribe helper)
  4. 세션 관리 (user session TTL)
- **verify**: Redis PING/PONG, pub/sub 메시지 수신 확인

### S03: Auth 시스템 (JWT + API Key)
- **file**: server/internal/auth/jwt.go, server/internal/auth/apikey.go, server/internal/auth/middleware.go
- **ref**: v11-world-war-plan.md §8.1
- **blocked_by**: S01
- **do**:
  1. JWT 발급/검증 (유저 로그인)
  2. API Key 생성/관리 (에이전트 인증)
  3. Auth 미들웨어 (chi middleware)
  4. Rate Limiter (API Key당 30 req/min)
- **verify**: JWT 발급→검증 라운드트립, API Key 인증, Rate Limit 동작

### S04: GeoJSON 데이터 준비 + 국가 시드
- **file**: server/data/countries.geojson, server/internal/world/countries_seed.go
- **ref**: v11-world-war-plan.md §3.2, §3.3
- **blocked_by**: S01
- **do**:
  1. Natural Earth 110m GeoJSON 다운로드 + 정제
  2. 195국 등급(S/A/B/C/D) 분류 데이터
  3. 국가별 자원 프로필 (oil, minerals, food, tech, manpower) 매핑
  4. 인접 국가 관계 계산 (TopoJSON adjacency)
  5. DB seed 스크립트 (countries 테이블 초기 데이터)
- **verify**: 195국 GeoJSON 파싱, DB seed 완료, 인접 관계 검증

### S05: 프로젝트 구조 리팩토링
- **file**: server/internal/game/, server/internal/world/, server/internal/meta/
- **ref**: v11-world-war-plan.md §12.2
- **blocked_by**: S01, S02
- **do**:
  1. game/ 디렉토리: 기존 v10 전투 로직 유지 (arena.go, agent.go, collision.go 등)
  2. world/ 디렉토리: WorldManager, CountryArena (Room 확장)
  3. meta/ 디렉토리: FactionManager, EconomyEngine, DiplomacyEngine
  4. 기존 RoomManager → WorldManager 리팩토링
  5. 기존 Room → CountryArena 리팩토링 (국가 속성 추가)
- **verify**: 빌드 성공, 기존 테스트 통과

---

## Phase 1 — 세계지도 + 3D 지구본

### S06: MapLibre GL 2D 세계지도 기본
- **file**: apps/web/components/world/WorldMap.tsx, apps/web/lib/map-style.ts
- **ref**: v11-world-war-plan.md §3.4
- **blocked_by**: S04
- **do**:
  1. MapLibre GL JS 설치 + Next.js 통합
  2. GeoJSON 국가 경계 렌더링 (다크 테마)
  3. 국가별 fill 색상 (sovereignty_colors)
  4. 호버 이펙트 (국가 하이라이트)
  5. 클릭 이벤트 (국가 선택)
- **verify**: 맵 렌더링, 195국 경계 표시, 클릭/호버 반응

### S07: three-globe 3D 지구본
- **file**: apps/web/components/lobby/GlobeView.tsx, apps/web/lib/globe-data.ts
- **ref**: v11-world-war-plan.md §9.1
- **blocked_by**: S04
- **do**:
  1. three-globe 설치 + R3F 통합
  2. GeoJSON 국가 폴리곤 렌더링
  3. 팩션 색상 채색
  4. 국기 마커 (3D 깃발 스프라이트)
  5. 자동 회전 + 마우스 드래그/줌
  6. 대기 글로우 이펙트
- **verify**: 지구본 렌더링, 국가 색상, 마커 표시, 인터랙션

### S08: 국가 상세 패널
- **file**: apps/web/components/world/CountryPanel.tsx
- **ref**: v11-world-war-plan.md §3.4
- **blocked_by**: S06
- **do**:
  1. 슬라이드 패널 UI (국가 클릭 시)
  2. 국가 정보 표시 (지배 팩션, GDP, 자원, 에이전트 수)
  3. "Enter Arena" 버튼 (전투 진입)
  4. "Spectate" 버튼 (관전 진입)
  5. 전투 상태 인디케이터
- **verify**: 패널 슬라이드 동작, 데이터 표시, 버튼 네비게이션

### S09: Globe ↔ Map 전환
- **file**: apps/web/components/world/WorldView.tsx
- **ref**: v11-world-war-plan.md §9.1
- **blocked_by**: S06, S07
- **do**:
  1. 줌 레벨 임계값 설정 (Globe → 2D Map 전환점)
  2. 스무스 전환 애니메이션 (fade + zoom)
  3. 상태 동기화 (선택된 국가, 카메라 위치)
  4. 뒤로가기: 2D Map → Globe 복귀
- **verify**: 전환 스무스, 상태 유지, 양방향 네비게이션

### S10: 글로벌 뉴스 피드
- **file**: apps/web/components/lobby/NewsFeed.tsx, server/internal/meta/news.go
- **ref**: v11-world-war-plan.md §9.3
- **blocked_by**: S02
- **do**:
  1. 서버: 이벤트 기반 뉴스 생성 (점령, 전쟁, 경제)
  2. 클라이언트: 하단 티커 UI (스크롤 애니메이션)
  3. WebSocket 실시간 푸시
  4. 뉴스 아카이브 (최근 24시간)
- **verify**: 뉴스 생성, 실시간 표시, 티커 애니메이션

---

## Phase 2 — 국가 아레나 전투

### S11: WorldManager (195국 관리)
- **file**: server/internal/world/world_manager.go
- **ref**: v11-world-war-plan.md §13.1
- **blocked_by**: S05
- **do**:
  1. 195국 상태 관리 (in-memory + Redis sync)
  2. On-demand 아레나 생성 (전투 필요 시만)
  3. 아레나 풀링 (사용 후 반환)
  4. 5분 전투 사이클 스케줄러
  5. 국가 상태 브로드캐스트 (1Hz)
- **verify**: 아레나 생성/해제, 전투 스케줄링, 메모리 효율

### S12: CountryArena (국가별 아레나)
- **file**: server/internal/world/country_arena.go
- **ref**: v11-world-war-plan.md §4.1
- **blocked_by**: S05, S11
- **do**:
  1. 기존 Room/Arena → CountryArena 확장
  2. 국가 속성 반영 (아레나 크기, 최대 에이전트, 지형 테마)
  3. 전투 결과 집계 (팩션별 점수 합산)
  4. 지배권 결정 로직 (방어 20% 우위)
  5. 전투 결과 Redis pub/sub 전송
- **verify**: 국가별 아레나 생성, 전투 진행, 결과 집계

### S13: 지배권 연동 시스템
- **file**: server/internal/world/sovereignty.go
- **ref**: v11-world-war-plan.md §5.1, §5.2
- **blocked_by**: S12
- **do**:
  1. 전투 결과 수신 → 지배권 업데이트 (DB)
  2. Sovereignty Level 연속 유지 카운터
  3. 지배 등급 보너스 적용
  4. 지배권 변경 알림 (전 서버 브로드캐스트)
  5. 수도 시스템 기초 (Lv.5 달성 시)
- **verify**: 지배권 전이, 레벨 업, 보너스 적용

### S14: 에이전트 배치 시스템
- **file**: server/internal/world/deployment.go, server/internal/meta/agent_manager.go
- **ref**: v11-world-war-plan.md §4.3
- **blocked_by**: S03, S11
- **do**:
  1. 에이전트 배치 API (POST /api/agents/deploy)
  2. 배치 비용 계산 (거리 비례 Oil 소모)
  3. 유저당 3국 동시 배치 제한
  4. 에이전트 소환 API (POST /api/agents/recall)
  5. 자동 재배치 옵션 (사망 후 동일 국가 재배치)
- **verify**: 배치/소환 API, 비용 계산, 제한 검증

### S15: 관전 모드
- **file**: apps/web/components/spectator/SpectatorView.tsx
- **ref**: v11-world-war-plan.md §9.2
- **blocked_by**: S12, S08
- **do**:
  1. 국가 클릭 → 전투 관전 진입
  2. 카메라 자유 이동 (팬/줌/회전)
  3. 관전자 수 표시
  4. 에이전트 클릭 → 정보 팝업
  5. 내 에이전트 추적 카메라
- **verify**: 관전 진입, 카메라 조작, 에이전트 정보

---

## Phase 3 — 팩션 + 외교

### S16: 팩션 CRUD
- **file**: server/internal/meta/faction.go, apps/web/components/faction/
- **ref**: v11-world-war-plan.md §7.1
- **blocked_by**: S03
- **do**:
  1. 팩션 생성 (1000 Gold, 이름/색상/배너)
  2. 팩션 가입/탈퇴/추방
  3. 계층 구조 (Supreme Leader → Council → Commander → Member)
  4. 팩션 목록 + 상세 페이지
  5. 팩션 재정 관리 (공동 자원풀)
- **verify**: CRUD 동작, 계층 권한, 재정 관리

### S17: 외교 행동
- **file**: server/internal/meta/diplomacy.go
- **ref**: v11-world-war-plan.md §7.2
- **blocked_by**: S16
- **do**:
  1. Non-Aggression Pact (비침공 조약)
  2. Trade Agreement (무역 협정)
  3. Military Alliance (군사 동맹)
  4. Economic Sanction (경제 제재)
  5. Tribute (조공)
  6. 조약 만료/파기 로직
- **verify**: 각 외교 행동 생성/효과/만료

### S18: 전쟁 시스템 + Siege Battle
- **file**: server/internal/meta/war.go, server/internal/world/siege.go
- **ref**: v11-world-war-plan.md §7.3
- **blocked_by**: S12, S17
- **do**:
  1. 전쟁 선포 (Influence 300 + Oil 500)
  2. 48시간 준비 기간
  3. Siege Battle 트리거 + 특수 규칙 (방어 +30%)
  4. 수도 함락 로직
  5. 항복/휴전 로직
  6. 전쟁 종결 처리
- **verify**: 전쟁 선포→준비→Siege→종결 플로우

### S19: 팩션 대시보드 UI
- **file**: apps/web/components/faction/FactionDashboard.tsx
- **ref**: v11-world-war-plan.md §7
- **blocked_by**: S16, S17
- **do**:
  1. 멤버 관리 패널
  2. 영토 현황 (지도 위 팩션 영토 하이라이트)
  3. 외교 상태 (조약/전쟁 목록)
  4. 팩션 재정 (자원/Gold)
  5. 전쟁 관리 (선포/항복)
- **verify**: 대시보드 렌더링, 데이터 연동, 액션 실행

---

## Phase 4 — 경제 시스템

### S20: 자원 생산 엔진
- **file**: server/internal/meta/economy.go
- **ref**: v11-world-war-plan.md §6.2
- **blocked_by**: S13
- **do**:
  1. 1시간마다 경제 틱 (Background Worker)
  2. 국가별 6종 자원 생산 계산
  3. 등급/지배레벨 배율 적용
  4. 자원 분배 (팩션 50% + 지배자 30% + 전투참가 20%)
  5. 자원 상한 (저장 한도)
- **verify**: 자원 생산 정확성, 분배 로직, 상한 동작

### S21: 경제 정책 시스템
- **file**: server/internal/meta/policy.go, apps/web/components/economy/PolicyPanel.tsx
- **ref**: v11-world-war-plan.md §6.3
- **blocked_by**: S20
- **do**:
  1. 세율 설정 (0~50%)
  2. 무역 개방도 (0~100%)
  3. 군비 지출 (0~50%)
  4. 기술 투자 (0~30%)
  5. 정책 효과 반영 + UI
- **verify**: 정책 설정, 효과 반영, 트레이드오프 검증

### S22: 무역 시스템
- **file**: server/internal/meta/trade.go, apps/web/components/economy/TradeMarket.tsx
- **ref**: v11-world-war-plan.md §6.4
- **blocked_by**: S20
- **do**:
  1. 글로벌 자원 거래소 (주문서 매칭)
  2. 수요/공급 기반 가격 변동
  3. 무역 루트 (해상/육상 수수료)
  4. 경제 제재 적용 (차단)
  5. 거래소 UI
- **verify**: 매매 주문, 가격 변동, 수수료 계산

### S23: GDP 산정 + 경제 랭킹
- **file**: server/internal/meta/gdp.go
- **ref**: v11-world-war-plan.md §6.5
- **blocked_by**: S20, S22
- **do**:
  1. GDP 계산 공식 구현
  2. 실시간 GDP 업데이트
  3. 경제 랭킹 (팩션별 GDP)
  4. 경제 히스토리 그래프 데이터
- **verify**: GDP 계산, 랭킹 정렬, 히스토리 기록

---

## Phase 5 — Agent API + Commander Mode

### S24: Agent REST API
- **file**: server/internal/api/agent_routes.go
- **ref**: v11-world-war-plan.md §8.1
- **blocked_by**: S03, S14
- **do**:
  1. POST /api/agents/deploy
  2. POST /api/agents/recall
  3. GET /api/agents/{id}/status
  4. GET /api/agents/{id}/battle-log
  5. POST /api/agents/{id}/strategy
  6. OpenAPI 스펙 문서
- **verify**: 모든 엔드포인트 CRUD 테스트

### S25: Agent WebSocket 라이브 스트림
- **file**: server/internal/ws/agent_stream.go
- **ref**: v11-world-war-plan.md §8.1
- **blocked_by**: S24
- **do**:
  1. WS /ws/agents/{id}/live 엔드포인트
  2. 전투 상태 실시간 스트리밍 (위치, HP, 행동)
  3. 인증 (API Key via query param)
  4. 다중 구독 (여러 에이전트 동시 관전)
- **verify**: WS 연결, 실시간 데이터 수신

### S26: Commander Mode (수동 전환)
- **file**: server/internal/game/commander.go, apps/web/components/game/CommanderHUD.tsx
- **ref**: v11-world-war-plan.md §8.3
- **blocked_by**: S12
- **do**:
  1. AI→수동 전환 로직 (1초 무적)
  2. 수동 조종 입력 처리 (마우스/키보드)
  3. 30초 무입력 → AI 자동 복귀
  4. Commander HUD (수동 모드 전용 UI)
- **verify**: 전환 동작, 입력 반영, 자동 복귀

### S27: LLM 에이전트 연동
- **file**: server/internal/agent/llm_bridge.go
- **ref**: v11-world-war-plan.md §8.4
- **blocked_by**: S24
- **do**:
  1. LLM API 키 등록 (유저 설정)
  2. 레벨업 시 LLM 호출 (game_state → chosen_action)
  3. 2초 타임아웃 + 폴백 (기본 AI)
  4. 지원 LLM: Claude, GPT, Llama (HTTP API)
- **verify**: LLM 호출, 타임아웃 폴백, 선택 반영

### S28: API 대시보드 UI
- **file**: apps/web/app/dashboard/
- **ref**: v11-world-war-plan.md §8
- **blocked_by**: S24, S25
- **do**:
  1. API 키 관리 (생성/삭제/조회)
  2. 에이전트 현황 대시보드
  3. 전투 로그 뷰어
  4. 전략 설정 폼
  5. 실시간 전투 미니 뷰
- **verify**: 대시보드 렌더링, API 키 CRUD, 실시간 데이터

---

## Phase 6 — 시즌 + 명예의 전당

### S29: 시즌 라이프사이클
- **file**: server/internal/meta/season.go
- **ref**: v11-world-war-plan.md §10.1
- **blocked_by**: S13
- **do**:
  1. 시즌 생성 (4주, 이름, 테마)
  2. 에라 자동 전환 (Discovery→Expansion→Empires→Reckoning)
  3. 에라별 규칙 적용 (전쟁 불가, 비용 변동 등)
  4. Final Rush (마지막 72시간 전투 주기 3분)
- **verify**: 시즌 전환, 에라 규칙, Final Rush

### S30: 시즌 리셋 + 데이터 보존
- **file**: server/internal/meta/season_reset.go
- **ref**: v11-world-war-plan.md §10.2
- **blocked_by**: S29
- **do**:
  1. 시즌 종료 스냅샷 (전체 세계 상태 아카이브)
  2. 최종 랭킹 확정
  3. 보상 분배 로직
  4. 세계 초기화 (지배권/자원 리셋)
  5. 보존 항목 유지 (계정/팩션/코스메틱/업적)
- **verify**: 리셋 정상 동작, 데이터 보존 확인

### S31: 명예의 전당
- **file**: apps/web/components/hall-of-fame/, server/internal/meta/hall_of_fame.go
- **ref**: v11-world-war-plan.md §10.3
- **blocked_by**: S30
- **do**:
  1. 7개 카테고리 우승자 기록 (DB)
  2. 시즌 아카이브 UI (탭 네비게이션)
  3. 세계 지도 타임라인 리플레이 (30초 타임랩스)
  4. 우승 팩션 트로피/배지 표시
- **verify**: 기록 저장, UI 표시, 리플레이 재생

### S32: 업적 시스템
- **file**: server/internal/meta/achievement.go, apps/web/components/profile/Achievements.tsx
- **ref**: v11-world-war-plan.md §11.6
- **blocked_by**: S03
- **do**:
  1. 개인/팩션 업적 정의 (20+종)
  2. 업적 달성 트래커 (이벤트 리스너)
  3. 업적 알림 (인게임 팝업)
  4. 프로필 페이지 업적 배지 표시
- **verify**: 업적 달성 트리거, 알림 표시

---

## Phase 7 — 확장 메카닉

### S33: 기술 연구 트리
- **file**: server/internal/meta/tech_tree.go, apps/web/components/faction/TechTree.tsx
- **ref**: v11-world-war-plan.md §11.3
- **blocked_by**: S16, S20
- **do**:
  1. 3갈래 연구 트리 (Military/Economic/Diplomatic)
  2. Tech 자원 투자 → 연구 진행
  3. 연구 완료 → 팩션 보너스 해금
  4. 연구 트리 UI (시각적 트리 다이어그램)
- **verify**: 연구 투자, 진행률, 보너스 적용

### S34: 정보전 시스템
- **file**: server/internal/meta/intel.go
- **ref**: v11-world-war-plan.md §11.1
- **blocked_by**: S16
- **do**:
  1. 스카우트 미션 (정보 수집)
  2. 사보타지 미션 (방어 약화)
  3. 방첩 (탐지 확률 증가)
  4. 정보 정확도 시스템 (80% + 노이즈)
- **verify**: 미션 실행, 결과 생성, 발각 확률

### S35: 자연재해 + 글로벌 이벤트
- **file**: server/internal/meta/events.go
- **ref**: v11-world-war-plan.md §11.2
- **blocked_by**: S11
- **do**:
  1. 이벤트 엔진 (확률 기반 랜덤 생성)
  2. 이벤트 효과 적용 (자원/전투/경제 영향)
  3. 이벤트 알림 (글로벌 뉴스 + 국가 알림)
  4. 이벤트 지속 시간 관리
- **verify**: 이벤트 발생, 효과 적용, 만료 처리

### S36: UN 위원회
- **file**: server/internal/meta/council.go, apps/web/components/world/UNCouncil.tsx
- **ref**: v11-world-war-plan.md §7.4
- **blocked_by**: S17
- **do**:
  1. 상임이사국 자동 선정 (S급 국가 지배 팩션)
  2. 결의안 제출 + 투표 시스템
  3. 거부권 로직
  4. 결의안 효과 적용
  5. UN 위원회 UI
- **verify**: 투표, 거부권, 결의 효과

### S37: 용병 시장
- **file**: server/internal/meta/mercenary.go, apps/web/components/market/MercenaryMarket.tsx
- **ref**: v11-world-war-plan.md §11.4
- **blocked_by**: S14
- **do**:
  1. NPC 에이전트 등급별 생성 (Bronze~Legendary)
  2. 고용/배치/만료 로직
  3. 자동 방어 AI (오프라인 보호)
  4. 용병 시장 UI (카드 형태)
- **verify**: 고용, 배치, 자동 방어 동작

### S38: 대륙 보너스 + 요충지
- **file**: server/internal/world/continental.go
- **ref**: v11-world-war-plan.md §11.5
- **blocked_by**: S13
- **do**:
  1. 대륙별 지배 국가 수 추적
  2. 보너스 조건 달성 시 자동 적용
  3. 요충지 무역 수수료 징수
  4. 칭호 부여
- **verify**: 대륙 보너스 트리거, 수수료 계산

---

## Phase 8 — 성능 + 테스트 + 보안

### S39: 서버 성능 최적화
- **file**: server/
- **ref**: v11-world-war-plan.md §13.3
- **blocked_by**: S11, S12
- **do**:
  1. 195국 동시 운영 시뮬레이션
  2. On-demand 아레나 메모리 프로파일링
  3. Redis 최적화 (파이프라인, 배치)
  4. PostgreSQL 쿼리 최적화 (인덱스)
  5. 부하 테스트 (k6 or hey)
- **verify**: 50개 동시 전투 < 2ms 틱, 메모리 < 2GB

### S40: 프론트엔드 성능 최적화
- **file**: apps/web/
- **ref**: v11-world-war-plan.md §14
- **blocked_by**: S06, S07
- **do**:
  1. GeoJSON LOD (줌 레벨별 상세도)
  2. 지구본 FPS 최적화 (인스턴스 메시)
  3. 코드 스플리팅 (맵/전투/대시보드 lazy load)
  4. 이미지/텍스처 최적화
  5. 모바일 대응 (터치, 뷰포트)
- **verify**: 지구본 60 FPS, 맵 로딩 < 2초, LCP < 2.5초

### S41: E2E 테스트
- **file**: apps/web/e2e/
- **blocked_by**: S15, S19, S28
- **do**:
  1. 로비 → 지구본/맵 탐색 플로우
  2. 에이전트 배치 → 전투 관전 플로우
  3. 팩션 생성 → 외교 → 전쟁 플로우
  4. 경제 정책 → 무역 플로우
  5. 시즌 리셋 플로우
- **verify**: 전 시나리오 Playwright 통과

### S42: 보안 감사
- **file**: server/
- **blocked_by**: S03, S24
- **do**:
  1. Auth 취약점 점검 (JWT 만료, API Key 노출)
  2. SQL Injection 점검 (prepared statements)
  3. Rate Limit 스트레스 테스트
  4. WebSocket 인증 검증
  5. CORS 설정 검증
- **verify**: OWASP Top 10 클린, 취약점 0건

---

## Phase 9 — 배포 + 런칭

### S43: 인프라 설정
- **file**: Dockerfile, docker-compose.yml, railway.toml
- **blocked_by**: S39
- **do**:
  1. Docker 멀티 서비스 (Game + Meta + PostgreSQL + Redis)
  2. Railway 배포 설정 (환경변수)
  3. Vercel 프론트엔드 설정
  4. 도메인 + SSL 설정
- **verify**: 전체 서비스 Docker 기동, 외부 접속 성공

### S44: 모니터링 + 로깅
- **file**: server/internal/observability/
- **blocked_by**: S43
- **do**:
  1. Prometheus 메트릭 (전투 수, CCU, 틱 레이턴시)
  2. 구조화 로깅 (slog → JSON)
  3. 에러 알림 (Sentry or 자체)
  4. 대시보드 (Grafana or 자체)
- **verify**: 메트릭 수집, 로그 검색, 알림 수신

### S45: 베타 런칭 준비
- **file**: 전체
- **blocked_by**: S41, S42, S43, S44
- **do**:
  1. 시드 데이터 최종 검증 (195국 + 자원)
  2. 첫 시즌 설정 (Season 1: "Era of Dawn")
  3. 랜딩 페이지 (게임 소개 + 가입)
  4. 베타 유저 초대 (클로즈드 베타)
  5. 피드백 채널 설정 (Discord or GitHub Issues)
- **verify**: 전체 플로우 정상, 195국 데이터, 첫 시즌 시작

---

## Phase 10 — 블록체인 국가 화폐 시스템 ★

### S46: CROSS Mainnet 스마트 컨트랙트 개발
- **file**: contracts/src/NationalTokenFactory.sol, contracts/src/NationalTreasury.sol
- **ref**: v11-world-war-plan.md §15.2, https://docs.crosstoken.io/docs/overview
- **blocked_by**: S01, S04
- **do**:
  1. CROSS Ramp Console 프로젝트 설정 (CrossToken.io 대시보드)
  2. NationalTokenFactory — ERC-20 Factory (CROSS Ramp Console로 195개 토큰 일괄 생성)
  3. NationalTreasury.sol — 국가별 재무부 (바이백, 소각, 스테이킹)
  4. DefenseOracle — CROSS RPC(JSON-RPC:8545)로 DEX 시가총액 → 방어 배율 계산
  5. GovernanceModule — 쿼드라틱 보팅
  6. CROSS Testnet(`--crosstest`) 배포 및 테스트
  7. 스마트 컨트랙트 보안 감사 (외부 감사 또는 자체 검토)
- **verify**: Testnet 배포 성공, 기능 테스트 전 통과, 감사 리포트 확인

### S47: $AWW 마스터 토큰 배포 (forge_token_deploy)
- **file**: CROSS Ramp Console 대시보드, server/data/aww_token.json
- **ref**: v11-world-war-plan.md §15.1, https://docs.crosstoken.io/docs/dev_getting-started
- **blocked_by**: S46
- **do**:
  1. `forge_token_deploy` 스킬로 $AWW ERC-20 배포 (CROSS Testnet 먼저)
  2. 토큰 분배 (40% ecosystem, 25% community, 15% team, 10% liquidity, 10% treasury)
  3. CROSS GameToken DEX 유동성 풀 생성 ($AWW/CROSS)
  4. CROSS Mainnet 배포 (`forge_token_deploy` 스킬)
  5. CROSS Explorer 검증
- **verify**: 토큰 발행 확인 (CROSS Explorer), GameToken DEX 거래 가능

### S48: 195개 국가 토큰 일괄 배포 (forge_token_deploy)
- **file**: server/data/token_addresses.json, CROSS Ramp Console
- **ref**: v11-world-war-plan.md §15.2
- **blocked_by**: S47, S04
- **do**:
  1. `forge_token_deploy` 스킬로 195개 ERC-20 토큰 일괄 배포 (CROSS Mainnet)
  2. 각 토큰: name=국가명, symbol=ISO3, supply=등급별 (S:50M, A:30M, B:20M, C:10M, D:5M)
  3. 195개 토큰 컨트랙트 주소 → token_addresses.json 매핑
  4. CROSS GameToken DEX에 각 토큰별 $AWW 유동성 풀 생성
  5. 초기 유동성 제공 (게임 재무부에서)
  6. 단계적 출시: Phase 1 S등급 8국 → Phase 2 A등급 20국 → Phase 3 나머지
- **verify**: 토큰 배포 확인 (CROSS Explorer), DEX 거래 가능, 주소 매핑 정확

### S49: Defense Oracle + 게임 서버 연동
- **file**: server/internal/blockchain/defense_oracle.go
- **ref**: v11-world-war-plan.md §15.4
- **blocked_by**: S48, S13
- **do**:
  1. CROSS RPC (JSON-RPC:8545) 연동 모듈 (Go `net/http` + JSON-RPC)
  2. CROSS GameToken DEX에서 TWAP 가격 조회
  3. 5분마다 195국 시가총액 일괄 조회 (최소 유동성 $10K 이상만 버프 적용)
  4. 방어 배율 계산 함수 (구간별 버프 매핑, 1시간 이동평균)
  5. CountryArena에 방어 버프 적용 로직
  6. 급격한 변동(>50%/1hr) 시 버프 동결 안전장치
- **verify**: CROSS RPC 데이터 정확, 방어 버프 인게임 반영, 5분 업데이트, 조작 방지

### S50: GDP 바이백 엔진
- **file**: server/internal/blockchain/buyback.go, contracts/src/NationalTreasury.sol
- **ref**: v11-world-war-plan.md §15.3
- **blocked_by**: S49, S20
- **do**:
  1. 경제 틱 시 GDP 세수 5% 계산
  2. 서버 → Treasury 컨트랙트 → CROSS GameToken DEX 자동 바이백 트랜잭션
  3. 전쟁 승리 시 1% 토큰 소각 트랜잭션
  4. 바이백/소각 히스토리 DB 기록
  5. 가스비 최적화 (배치 트랜잭션)
- **verify**: 바이백 실행 확인 (CROSS Explorer), 소각 이벤트, 가격 변동

### S51: CROSSx 지갑 UI + 스테이킹
- **file**: apps/web/components/blockchain/, apps/web/lib/crossx-config.ts
- **ref**: v11-world-war-plan.md §15.4, https://docs.crosstoken.io/docs/sdkjs_installation
- **blocked_by**: S48
- **do**:
  1. CROSSx SDK 설치 (`@crosstoken/sdk`) + CROSS Mainnet 설정
  2. CROSSx 지갑 연결 버튼 (crossx:// Deep Linking, 모바일+PC)
  3. 토큰 잔고 표시 (보유 국가 토큰 목록, CROSSx SDK Token Transfer API)
  4. 스테이킹 UI (스테이크/언스테이크/보상 클레임)
  5. 국가 패널에 토큰 정보 통합 (시가총액, 방어 버프, 스테이킹 APY)
- **verify**: CROSSx 지갑 연결, 잔고 표시, 스테이킹 동작

### S52: 거버넌스 투표 UI
- **file**: apps/web/components/governance/
- **ref**: v11-world-war-plan.md §15.4 (D항)
- **blocked_by**: S51
- **do**:
  1. 정책 제안 폼 (세율, 전쟁, 경제 정책)
  2. 투표 인터페이스 (찬성/반대, 쿼드라틱 가중치 표시)
  3. 제안 목록 + 진행 상태 (투표중/통과/거부/실행됨)
  4. 타임락 실행 상태 표시
  5. 투표 히스토리 아카이브
- **verify**: 제안 생성, 투표, 쿼럼 달성, 자동 실행

### S53: 토큰 이코노미 대시보드
- **file**: apps/web/app/economy/tokens/
- **ref**: v11-world-war-plan.md §15
- **blocked_by**: S49, S50, S51
- **do**:
  1. 국가별 토큰 시가총액 차트 (실시간)
  2. 바이백/소각 히스토리 그래프
  3. 스테이킹 현황 (국가별, 전체)
  4. 방어 버프 시각화 (시가총액 → 버프 매핑)
  5. 토큰 랭킹 (시총 Top 10, 상승률 Top 10)
  6. 지구본에 토큰 정보 오버레이 (시총 기반 국가 높이)
- **verify**: 대시보드 렌더링, 실시간 데이터 갱신, 차트 정확
