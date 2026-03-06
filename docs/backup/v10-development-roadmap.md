# Agent Survivor v10 — Development Roadmap

> **Parent**: [v10-survival-roguelike-plan.md](v10-survival-roguelike-plan.md) §12 + 구현 로드맵
> **Mode**: da:work roadmap 모드 (자동 파싱 대상)
> **Version**: v1.0
> **Date**: 2026-03-06
> **Total Steps**: S01 ~ S59
> **Total Duration**: ~13주 (병렬화 시 ~11주)

---

## DAG 의존관계 개요

```
Phase 0 (S01~S12) ─── Go 서버 인프라
  │
  ▼
Phase 1 (S13~S21) ─── Go 게임 시스템 포팅
  │
  ▼
Phase 1a (S22~S26) ── Room & Bot System
  │
  ▼
Phase 2 (S27~S32) ─── Abilities + 밸런스 + 배포
  │
  ▼
Phase 3 (S33~S45) ─── Client 통합 + Rendering + Lobby
  │
  ▼
Phase 4 (S46~S52) ─── Agent Integration + Training
  │
  ▼
Phase 5 (S53~S59) ─── Meta + Coach/Analyst + Polish
```

### 병렬화 가능 구간

```
S33~S35 (WS 어댑터) ──┐
                      ├── Phase 2 완료 후 동시 착수 가능
S36~S38 (렌더러)  ────┘

S40~S42 (인게임 UI) ──┐
                      ├── S36 완료 후 동시 착수 가능
S43~S44 (이펙트)  ────┘

S53~S56 (메타 시스템) ──┐
                        ├── Phase 4 완료 후 동시 착수 가능
S57~S58 (AI Agents) ────┘
```

---

## Phase 0 — Go 서버 코어 인프라 (2주)

### S01: Go 프로젝트 초기화
- **file**: `server/go.mod`, `server/cmd/server/main.go`
- **ref**: `v10-go-server-plan.md` §3 Directory Structure
- **blocked_by**: none
- **do**:
  1. `server/` 디렉토리 생성 + `go mod init`
  2. 디렉토리 구조: `cmd/server/`, `internal/game/`, `internal/ws/`, `internal/domain/`, `config/`
  3. `.gitignore` 에 Go 바이너리 추가
- **verify**: `cd server && go build ./...` 성공

### S02: Config + Main + Graceful Shutdown
- **file**: `server/cmd/server/main.go`, `server/config/config.go`
- **ref**: `v10-go-server-plan.md` §3
- **blocked_by**: S01
- **do**:
  1. envconfig 기반 Config 구조체 (PORT, CORS_ORIGIN, TICK_RATE 등)
  2. main.go — HTTP 서버 시작 + signal 핸들링
  3. errgroup 기반 graceful shutdown (context cancel → 15s 타임아웃)
- **verify**: `go run ./cmd/server` 시작/종료 정상, SIGTERM → 로그 확인

### S03: HTTP Router + Middleware
- **file**: `server/cmd/server/router.go`
- **ref**: `v10-go-server-plan.md` §3
- **blocked_by**: S02
- **do**:
  1. chi/v5 라우터 초기화
  2. CORS 미들웨어 (configurable origins)
  3. `GET /health` → `{"status":"ok","rooms":0,"players":0}`
  4. `GET /ws` → WebSocket 업그레이드 핸들러 (S04에서 구현)
- **verify**: `curl localhost:PORT/health` → 200 + JSON 응답

### S04: WebSocket Hub (channel-based)
- **file**: `server/internal/ws/hub.go`
- **ref**: `v10-go-server-plan.md` §4 Concurrency Model, §6 WS Protocol
- **blocked_by**: S03
- **do**:
  1. Hub 구조체 — `register`, `unregister`, `broadcast` 채널
  2. `Hub.Run()` goroutine — select loop
  3. `clients map[string]*Client` 관리
  4. Room별 브로드캐스트 지원 (`BroadcastToRoom(roomId, msg)`)
- **verify**: 2개 WS 클라이언트 연결 → Hub에 등록 → 연결 해제 시 정리 확인

### S05: Client ReadPump + WritePump
- **file**: `server/internal/ws/client.go`
- **ref**: `v10-go-server-plan.md` §4
- **blocked_by**: S04
- **do**:
  1. Client 구조체 — conn, send 채널, hub 참조
  2. `ReadPump()` goroutine — 메시지 읽기 → Hub로 라우팅
  3. `WritePump()` goroutine — send 채널 → conn 쓰기 (배치 flush)
  4. Ping/Pong 핸들링 (30s 타임아웃)
  5. 연결 종료 시 Hub.unregister 호출
- **verify**: WS 클라이언트 메시지 송수신, 연결 끊기 시 정리, ping/pong 동작

### S06: WS Protocol
- **file**: `server/internal/ws/protocol.go`
- **ref**: `v10-go-server-plan.md` §6 WS Protocol
- **blocked_by**: S05
- **do**:
  1. JSON 프레임 구조: `{"e":"event_name","d":{...}}`
  2. 이벤트 라우터 — event name → handler 함수 매핑
  3. 클라이언트→서버: `join_room`, `leave_room`, `input`, `respawn`, `ping`
  4. 서버→클라이언트: `joined`, `state`, `death`, `kill`, `pong` 등 정의
  5. Socket.IO 이벤트명과 1:1 호환 매핑 테이블
- **verify**: JSON 프레임 파싱/직렬화 테스트, 알 수 없는 이벤트 무시 처리

### S07: Domain Types (Agent, Orb, Position)
- **file**: `server/internal/domain/types.go`
- **ref**: `v10-survival-roguelike-plan.md` §5B.2, `types/game.ts`
- **blocked_by**: S01
- **do**:
  1. `Agent` 구조체 — Position, Heading, Speed, Mass, Level, XP, Build
  2. `Orb` 구조체 — Position, Value, Type
  3. `Position` 구조체 — X, Y float64
  4. `PlayerBuild` — Tomes map, AbilitySlots slice
  5. `AgentSkin` — 30+ 필드 (Tier 1~6)
  6. JSON 태그 모두 camelCase (클라이언트 호환)
- **verify**: JSON marshal/unmarshal 라운드트립 테스트, TS 타입과 필드명 일치 확인

### S08: Event Types
- **file**: `server/internal/domain/events.go`
- **ref**: `types/events.ts`
- **blocked_by**: S07
- **do**:
  1. 서버→클라이언트 이벤트: `StateUpdate`, `DeathEvent`, `KillEvent`, `LevelUpEvent` 등
  2. 클라이언트→서버 이벤트: `JoinRoomPayload`, `InputPayload`, `ChooseUpgradePayload`
  3. Room 이벤트: `RoomInfo`, `RoundStartEvent`, `RoundEndEvent`
  4. 새 이벤트: `SynergyActivated`, `ArenaShrinkWarning`, `MapObjectEvent`
- **verify**: 각 이벤트 JSON 직렬화 테스트

### S09: Skin + Upgrade 정의 테이블
- **file**: `server/internal/domain/skins.go`, `server/internal/domain/upgrades.go`
- **ref**: `v10-survival-roguelike-plan.md` §4 (Tome/Ability), §5B.4 (AgentSkin), `constants/`
- **blocked_by**: S07
- **do**:
  1. 34종 프리셋 AgentSkin 정의 (ID 00~33)
  2. 8종 Tome 정의 (효과, 최대 스택, 티어)
  3. 6종 Ability 정의 (효과, 쿨다운, 자동발동 조건)
  4. 10종 시너지 정의 (6 공개 + 4 히든, 조건, 보너스)
  5. XP 레벨업 곡선 (Lv1~12, Required XP)
- **verify**: 전체 Tome/Ability/Synergy 정의 누락 없음, 프리셋 34종 ID 유니크

### S10: Game Constants
- **file**: `server/internal/game/constants.go`
- **ref**: `v10-survival-roguelike-plan.md` §5.5 (파생 상수), `constants/game.ts`
- **blocked_by**: S07
- **do**:
  1. TICK_RATE, ARENA_RADIUS, BASE_SPEED, BOOST_SPEED 등 게임 상수
  2. 파생 상수: BASE_SPEED_PER_TICK, BASE_AURA_DPS_PER_TICK, SHRINK_RATE 등
  3. ROOM_CONFIG (최대 Room 수, 라운드 시간, 카운트다운 등)
  4. MAP_OBJECT_CONFIG (Shrine/Spring/Altar/Gate 쿨다운, 효과 수치)
- **verify**: 상수값이 기획서 §5.5 테이블과 정확히 일치

### S11: Rate Limiter
- **file**: `server/internal/ws/client.go` (Client 구조체 내장)
- **ref**: `network/RateLimiter.ts`
- **blocked_by**: S05
- **do**:
  1. input 이벤트: 30Hz 제한 (33ms 간격)
  2. respawn 이벤트: 0.5Hz 제한 (2초 간격)
  3. Token bucket 또는 sliding window 방식
  4. 초과 시 이벤트 무시 (에러 메시지 없음)
- **verify**: 30Hz 초과 input → 드롭 확인, 정상 빈도 → 통과 확인

### S12: Dockerfile + Railway 배포 설정
- **file**: `server/Dockerfile`, `server/.dockerignore`
- **ref**: `v10-go-server-plan.md`, 기존 `railway.json`
- **blocked_by**: S03
- **do**:
  1. Multi-stage Dockerfile (builder → scratch/alpine)
  2. 단일 바이너리 빌드 (`CGO_ENABLED=0`)
  3. Railway 환경변수 매핑 (PORT, CORS_ORIGIN)
  4. `.dockerignore` (소스, 테스트 파일 제외)
  5. railway.json 업데이트 (Go 서버 경로)
- **verify**: `docker build` 성공, 로컬 Docker 실행 → health 200

---

## Phase 1 — Go 게임 시스템 포팅 (2주)

### S13: Agent Entity
- **file**: `server/internal/game/agent.go`
- **ref**: `apps/server/src/game/AgentEntity.ts` ✅, `v10-survival-roguelike-plan.md` §5B.2-3
- **blocked_by**: S07, S10
- **do**:
  1. Agent 구조체 메서드: `Update(dt)`, `ApplyInput(angle, boost)`, `TakeDamage(amount)`, `Die()`
  2. 이동 로직 — heading→targetAngle 회전 + position 이동 (세그먼트 없음)
  3. 대시(부스트) — mass 소비, 300px/s 속도
  4. Mass→HP 시스템: mass 0 → 사망, mass<15 → 대시 불가
  5. 히트박스 반경: mass 기반 동적 (16~22px)
  6. Level/XP 관리: AddXP(), LevelUp(), ApplyUpgrade()
- **verify**: Agent 이동 정확도 테스트, 대시 mass 소비 검증, 사망 조건 테스트

### S14: SpatialHash
- **file**: `server/internal/game/spatial_hash.go`
- **ref**: `apps/server/src/game/SpatialHash.ts` ✅
- **blocked_by**: S07
- **do**:
  1. Grid 기반 공간 해시 (cellSize 200px)
  2. `Insert(id, x, y)`, `Remove(id)`, `Update(id, x, y)`
  3. `QueryRadius(x, y, radius)` → 근처 엔티티 ID 리스트
  4. Agent 위치만 관리 (세그먼트 완전 제거 — 대폭 단순화)
- **verify**: 1000 에이전트 삽입/쿼리 성능 < 1ms, 반경 쿼리 정확도

### S15: CollisionSystem
- **file**: `server/internal/game/collision.go`
- **ref**: `apps/server/src/game/CollisionSystem.ts` ✅, `v10-survival-roguelike-plan.md` §5.1-6
- **blocked_by**: S13, S14
- **do**:
  1. **경계 충돌**: 아레나 반경 + 수축 경계 밖 → mass 패널티
  2. **오라-오라 충돌**: 60px 오라 반경 내 → 양방향 DPS 교환 (2.0 mass/tick 기본)
  3. **대시 충돌**: 부스트 상태 히트박스 겹침 → 상대 mass 30% 버스트 데미지
  4. 킬 크레딧: 마지막 가해자 추적 (`lastDamagedBy`)
  5. DeathEvent 생성: damageSource ('aura' | 'dash' | 'boundary')
  6. SpatialHash 쿼리 기반 후보 필터링
- **verify**: 오라 DPS 정확도, 대시 킬 30% 데미지 검증, 동시 양방향 피해 테스트

### S16: OrbManager
- **file**: `server/internal/game/orb.go`
- **ref**: `apps/server/src/game/OrbManager.ts` ✅, `v10-survival-roguelike-plan.md` §3.1
- **blocked_by**: S07, S14
- **do**:
  1. Natural Orb 스폰 (1~2 XP), Death Orb 분해 (mass 80% → XP Orbs)
  2. 수집 로직: collectRadius(50px) 내 오브 → mass + XP 증가
  3. 오브 밀도 관리: 존별 밀도 (Edge 낮음, Core 높음)
  4. SpatialHash 연동 (오브 위치 등록/제거)
- **verify**: 오브 스폰/수집/소멸 정상, death orb XP 값 정확

### S17: ArenaShrink
- **file**: `server/internal/game/shrink.go`
- **ref**: `apps/server/src/game/ArenaShrink.ts` ✅, `v10-survival-roguelike-plan.md` §8.1-2
- **blocked_by**: S10
- **do**:
  1. 수축 타이머: 1:00부터 시작, 1분마다 반경 -600px
  2. 경계 밖 패널티: 초당 mass 5% 감소
  3. 수축 경고 이벤트: 10초 전 `arena_shrink_warning`
  4. 현재 반경 트래킹: `GetCurrentRadius(elapsedTime)`
- **verify**: 시간별 반경 값 검증 (기획서 §8.1 테이블과 일치), 경계 밖 패널티 적용

### S18: UpgradeSystem
- **file**: `server/internal/game/upgrade.go`
- **ref**: `apps/server/src/game/UpgradeSystem.ts` ✅, `v10-survival-roguelike-plan.md` §4
- **blocked_by**: S09
- **do**:
  1. `GenerateChoices(level, currentBuild)` → 3개 랜덤 업그레이드 (중복 방지)
  2. `ApplyUpgrade(agent, choice)` → Tome 스택 증가 또는 Ability 추가/강화
  3. `CheckSynergies(build)` → 시너지 조건 충족 여부 반환
  4. Tome 스택 공식: `기본값 × (1 + Σ stack × effect)`
  5. Ability 강화: 같은 Ability 재선택 → Lv2~4 (데미지 +30%, 쿨다운 -20%)
  6. Ability 슬롯 제한: 기본 2, RP 해금 3
- **verify**: 레벨업 3택 중복 없음, Tome 스택 계산 정확, 시너지 조건 판정 정확

### S19: Arena (20Hz Game Loop)
- **file**: `server/internal/game/arena.go`
- **ref**: `apps/server/src/game/Arena.ts` ✅, `v10-go-server-plan.md` §5
- **blocked_by**: S13, S14, S15, S16, S17, S18
- **do**:
  1. 20Hz ticker 기반 game loop (`time.Ticker`)
  2. 틱 순서: Input → Move → Orb Collect → Aura Combat → Dash Check → Shrink → Level Up → Ability Trigger → Death Process
  3. agents map 관리 (Add/Remove/Get)
  4. OrbManager, CollisionSystem, ArenaShrink, UpgradeSystem 오케스트레이션
  5. 이벤트 버퍼: death/kill/level_up/synergy → 틱 끝에 일괄 전송
- **verify**: 20Hz 안정 (< 2ms/tick), 100 에이전트 시뮬레이션 정상

### S20: StateSerializer
- **file**: `server/internal/game/serializer.go`
- **ref**: `apps/server/src/game/StateSerializer.ts` ✅
- **blocked_by**: S13, S16
- **do**:
  1. 뷰포트 컬링: 플레이어 시야 범위 내 에이전트/오브만 직렬화
  2. Agent 직렬화: position(단일), heading, mass, level, build, skin, boosting, alive
  3. 미니맵 데이터: 전체 에이전트 위치 (1Hz)
  4. 사망 정보: killer, deathPosition, damageSource
  5. 리더보드 엔트리: top 10
- **verify**: 직렬화 크기 < 5KB/클라이언트/tick (100 에이전트 기준)

### S21: Leaderboard
- **file**: `server/internal/game/leaderboard.go`
- **ref**: `apps/server/src/game/LeaderboardManager.ts` ✅
- **blocked_by**: S13
- **do**:
  1. mass 기반 정렬 (내림차순)
  2. Top 10 캐싱 (1Hz 업데이트)
  3. Agent 순위 조회: `GetRank(agentId)`
  4. 라운드 결과용 최종 순위: `GetFinalRanking()`
- **verify**: 정렬 정확도, 실시간 순위 변동 반영

---

## Phase 1a — Go Room & Bot System (1주)

### S22: Room State Machine
- **file**: `server/internal/game/room.go`
- **ref**: `apps/server/src/game/Room.ts` ✅, `v10-survival-roguelike-plan.md` §8.3
- **blocked_by**: S19
- **do**:
  1. 상태 전이: waiting → countdown(10s) → playing(5min+수축) → ending(10s) → cooldown(15s) → waiting
  2. 각 상태에서 허용되는 액션 정의 (e.g., playing에서만 input 처리)
  3. 라운드 시작 시 Arena 초기화 + 봇 배치
  4. 라운드 종료 조건: 5분 경과 또는 인간 플레이어 1명 이하 생존
  5. ending 상태: RoundResult 생성 (빌드+시너지+킬 통계)
  6. 1 Life 정책: 인간 플레이어 리스폰 금지 (grace period 30초 내 1회만)
- **verify**: 상태 전이 시퀀스 테스트, 라운드 타이머 정확도, 1 Life 적용 확인

### S23: RoomManager
- **file**: `server/internal/game/room_manager.go`
- **ref**: `apps/server/src/game/RoomManager.ts` ✅
- **blocked_by**: S22
- **do**:
  1. Room 5개 생성/관리
  2. Quick Join: 가장 적절한 Room 자동 배정 (인원/상태 기반)
  3. 플레이어-룸 매핑: `JoinRoom(clientId, roomId)`, `LeaveRoom(clientId)`
  4. Room 목록 조회: `GetRoomList()` → RoomInfo[] (이름, 상태, 인원)
  5. Hub 연동: 입력 이벤트 → 올바른 Room으로 라우팅
- **verify**: 5개 Room 동시 운영, Quick Join 분산 확인, 플레이어 이동(Room간)

### S24: BotManager + BotBehaviors
- **file**: `server/internal/game/bot.go`
- **ref**: `apps/server/src/game/BotManager.ts` + `BotBehaviors.ts` ✅, `v10-survival-roguelike-plan.md` §12.1a
- **blocked_by**: S19, S18
- **do**:
  1. Room당 최대 15봇 자동 생성 (인간 플레이어 수에 따라 조절)
  2. 행동 트리: survive → hunt → gather → wander (기존 유지)
  3. v10 확장: `behaviorKite()`, `behaviorCamp()` (수축 경계 캠핑)
  4. 봇 레벨업 자동 선택: 빌드 패스 기반 (5종 프리셋)
  5. 봇 빌드 패스 랜덤 할당: Berserker/Tank/Speedster/Vampire/Scholar
  6. 1 Life 교체 정책: 사망 봇 → 새 봇으로 교체 (이름 유지, 빌드 리셋)
  7. 수축 인식: 새 경계 기준으로 회피 행동
- **verify**: 봇 15마리 라운드 완주, 빌드 패스별 업그레이드 선택 로그 확인, 교체 정책 동작

### S25: Lobby Broadcasting
- **file**: `server/internal/game/room_manager.go` (BroadcastLobby 메서드)
- **ref**: `apps/server/src/network/Broadcaster.ts` ✅
- **blocked_by**: S23
- **do**:
  1. 1Hz `rooms_update` 브로드캐스트 (로비 클라이언트에게)
  2. 데이터: Room별 상태, 인원, 타이머, 최근 우승자
  3. Hub를 통한 로비 전용 브로드캐스트 (Room에 미참여 클라이언트)
- **verify**: 로비 클라이언트 rooms_update 수신, 1Hz 주기 확인

### S26: 로컬 통합 테스트
- **file**: —
- **ref**: 기존 클라이언트 (`apps/web/`)
- **blocked_by**: S22, S23, S24, S25
- **do**:
  1. Go 서버 로컬 실행 + 기존 Next.js 클라이언트 연결 테스트
  2. 임시 Socket.IO↔WebSocket 브릿지 스크립트 (또는 클라이언트에 임시 WS 모드)
  3. 기본 플로우 확인: 룸 목록 → 참여 → 게임 시작 → 이동 → 사망 → 결과
  4. 봇 움직임 + 전투 시각적 확인
  5. 성능 기본 측정: 50 에이전트 Room 틱 타이밍
- **verify**: 기본 게임 플로우 E2E 동작, 크리티컬 에러 없음, 틱 < 5ms

---

## Phase 2 — Abilities + 밸런스 + 배포 (1주)

### S27: 맵 오브젝트
- **file**: `server/internal/game/map_objects.go`
- **ref**: `v10-survival-roguelike-plan.md` §9.1
- **blocked_by**: S19
- **do**:
  1. MapObject 구조체: type, position, active, cooldownTimer, respawnTime
  2. 4종 오브젝트: XP Shrine (XP+50% 10초), Healing Spring (mass+20%), Upgrade Altar (즉시 레벨업), Speed Gate (×2 속도 5초)
  3. 위치 배정: Shrine 랜덤3곳, Spring 가장자리2곳, Altar 정중앙, Gate 4방향
  4. 쿨다운 관리: Shrine 60초, Spring 45초, Gate 30초, Altar 라운드당1회
  5. 에이전트 접촉 감지 (collectRadius 기반) + 효과 적용
  6. `GetNearbyMapObjects(x, y, radius)` — 에이전트 observation용
- **verify**: 오브젝트 스폰 위치 정상, 효과 적용 확인 (XP 버프, mass 회복 등), 쿨다운 리스폰

### S28: Tome vs Ability 의사결정 로직
- **file**: `server/internal/game/upgrade.go` (chooseUpgrade 함수 확장)
- **ref**: `v10-survival-roguelike-plan.md` §12.2a
- **blocked_by**: S18, S24
- **do**:
  1. 봇 의사결정 알고리즘 구현 (§12.2a 의사결정 트리)
  2. 시너지 완성 최우선 → 빌드 패스 우선순위 → Ability 슬롯 체크 → 게임 상황 폴백
  3. synergyScore vs tomeValue 비교 로직 (×1.5 임계값)
  4. 후반(< 1분) 방어 편향 적용
- **verify**: 봇 업그레이드 로그 분석 — 시너지 근접 시 올바른 선택, 빌드 패스 순수

### S29: 밸런스 1차 튜닝
- **file**: `server/internal/game/constants.go` (수치 조정)
- **ref**: `v10-survival-roguelike-plan.md` §5.4 (전투 밸런스), `v10-3d-graphics-plan.md` Part B (밸런스 수치)
- **blocked_by**: S27, S28
- **do**:
  1. 100+ 봇 자동 시뮬레이션 스크립트 작성
  2. 메트릭 수집: 평균 레벨, 시너지 발동률, 킬/라운드, 라운드 생존 시간
  3. 성공 기준 대비 조정: 평균 Lv 8~12, 시너지 30%+ 발동, 3+ kills/round
  4. DPS/HP/XP 커브 미세 조정
  5. Cursed Tome 리스크/리워드 밸런스 확인
- **verify**: 성공 지표 §1.5 기준 달성, 특정 빌드 압도적 우위 없음

### S30: 부하 테스트
- **file**: `server/cmd/loadtest/main.go` (테스트 도구)
- **ref**: `v10-go-server-plan.md` §9 성능 예산
- **blocked_by**: S26
- **do**:
  1. 가짜 WS 클라이언트 100~500개 동시 접속 스크립트
  2. 메트릭: 틱 처리 시간, 메모리 사용량, GC 빈도, WS 메시지 지연
  3. 성능 예산 확인: Room당 < 2ms/tick, 전체 < 200MB RAM
  4. 핫스팟 프로파일링 (`pprof`)
- **verify**: 100 클라이언트/Room × 5 Room = 500 동시접속 안정, 틱 < 5ms

### S31: game.sh 업데이트
- **file**: `game.sh`
- **ref**: —
- **blocked_by**: S02
- **do**:
  1. Go 서버 빌드 + 실행 명령 추가
  2. `./game.sh dev` → Go 서버 + Next.js 클라이언트 동시 실행
  3. `./game.sh server` → Go 서버만 실행
  4. `./game.sh build` → Go 바이너리 빌드
- **verify**: `./game.sh dev` 로 양쪽 서버 시작 확인

### S32: Railway Go 서버 배포
- **file**: `server/Dockerfile`, `railway.json`
- **ref**: S12
- **blocked_by**: S12, S29
- **do**:
  1. Railway 프로젝트에 Go 서버 서비스 추가 (기존 TS 서버 교체)
  2. 환경변수: PORT, CORS_ORIGIN (Vercel 도메인)
  3. 배포 후 health 엔드포인트 확인
  4. Vercel 클라이언트 `NEXT_PUBLIC_SERVER_URL` 업데이트
  5. Production 연동 E2E 확인
- **verify**: Railway 배포 성공, Vercel↔Railway WS 연결, 게임 기본 플로우 동작

---

## Phase 3 — Client 통합 + Rendering + Lobby (3.5주)

### S33: WebSocket 어댑터
- **file**: `apps/web/hooks/useWebSocket.ts` (NEW ~80줄)
- **ref**: `v10-go-server-plan.md` §7 Client Adaptation
- **blocked_by**: S32
- **do**:
  1. native WebSocket 래퍼: connect, disconnect, send, onMessage
  2. 자동 재연결 (exponential backoff, 최대 5회)
  3. JSON 프레임 `{e, d}` 파싱 → Socket.IO 호환 인터페이스
  4. `emit(event, data)` / `on(event, handler)` 인터페이스 유지
  5. ping/pong 핸들링 (latency 측정)
- **verify**: WS 연결/해제/재연결 테스트, 이벤트 송수신 정상

### S34: useSocket.ts 수정
- **file**: `apps/web/hooks/useSocket.ts`
- **ref**: 기존 useSocket.ts (Socket.IO 사용 중)
- **blocked_by**: S33
- **do**:
  1. socket.io-client → useWebSocket 어댑터로 교체
  2. `snake` → `agent` 변수명 리네이밍 전체
  3. 새 이벤트 핸들러: `level_up`, `synergy_activated`, `arena_shrink_warning`
  4. `chooseUpgrade(index)` emit 함수 추가
  5. 기존 이벤트(state, death, kill, joined, rooms_update) 호환 유지
- **verify**: 기존 모든 이벤트 정상 수신, 새 이벤트 수신 확인

### S35: socket.io-client 제거
- **file**: `apps/web/package.json`
- **ref**: —
- **blocked_by**: S34
- **do**:
  1. `npm uninstall socket.io-client`
  2. socket.io-client import 전체 검색 → 0건 확인
  3. 전체 연동 회귀 테스트 (로비 → 룸 참여 → 게임 → 사망 → 결과)
- **verify**: `npm run build` 성공, socket.io 관련 import 0건, E2E 플로우 정상

### S36: Agent 캐릭터 렌더링 (2D 스프라이트)
- **file**: `apps/web/lib/renderer/entities.ts` (전면 리라이트 ~764줄)
- **ref**: `v10-survival-roguelike-plan.md` §5B.5, `v10-3d-graphics-plan.md` A1, `v10-ui-ux-plan.md` §9
- **blocked_by**: S34
- **do**:
  1. 뱀 세그먼트 렌더링 코드 완전 제거
  2. MC 스타일 16×16 캐릭터 스프라이트 렌더러
  3. 탑다운 뷰: 머리+몸통+다리 구분 가능한 사각 실루엣
  4. AgentSkin 적용: bodyColor, legColor, pattern, eyeStyle, hat, bodyOverlay
  5. 방향 표시: heading 기반 캐릭터 회전
  6. mass 기반 스케일링: 1.0x ~ 1.4x
  7. 이름표 렌더링: 에이전트 이름 + 레벨 표시
  8. 봇 아이콘 구분: 🤖 prefix
- **verify**: 에이전트 렌더링 정상, 스킨 적용 시각 확인, 방향 회전 정확

### S37: AgentSkin 스프라이트 제작
- **file**: `apps/web/public/sprites/agents/` (NEW 에셋 폴더)
- **ref**: `v10-survival-roguelike-plan.md` §5B.4.3 (34종 프리셋)
- **blocked_by**: S36
- **do**:
  1. 12 Common 기본 캐릭터 스프라이트 (16×16 × 4방향 = 768px 스프라이트시트)
  2. 장비 오버레이 스프라이트: hat 6종, accessory 4종 (Phase 1 MVP)
  3. 스프라이트시트 레이아웃: base + overlay 레이어 합성
  4. Canvas 2D 동적 합성 또는 사전 렌더링
  5. 색상 팔레트 12색 (MC 양털 기반) 적용
- **verify**: 12종 기본 캐릭터 시각 확인, 장비 오버레이 정상 표시

### S38: interpolateAgents
- **file**: `apps/web/lib/interpolation.ts`
- **ref**: 기존 interpolateSnakes()
- **blocked_by**: S34
- **do**:
  1. `interpolateSnakes()` → `interpolateAgents()` 리네이밍
  2. 세그먼트 보간 코드 완전 제거
  3. position(단일 좌표) 선형 보간만 유지
  4. heading 각도 보간 (최단 경로)
  5. mass/level 등 정수값은 보간 없이 즉시 반영
- **verify**: 에이전트 이동 부드러움 확인 (20Hz → 60fps 보간), 텔레포트 없음

### S39: 캐릭터 커스터마이저 UI
- **file**: `apps/web/components/lobby/CharacterCreator.tsx` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §12.3a, `v10-ui-ux-plan.md` §4 Lobby Screens
- **blocked_by**: S36, S37
- **do**:
  1. McPanel 기반 탭 UI: [체형] [색상] [얼굴] [장비]
  2. 왼쪽: LobbyAgentPreview (R3F or 2D Canvas 130×130, Y축 회전)
  3. 오른쪽: 탭별 옵션 그리드 (아이콘 + 라벨)
  4. 프리셋 드롭다운: 12 Common 프리셋 빠른 선택
  5. 실시간 프리뷰 업데이트 (선택 즉시 반영)
  6. 저장: localStorage + 서버 join 시 skin 전송
  7. 해금 진행도 표시 (Phase 1: 전부 해금 상태)
- **verify**: 커스터마이저 렌더링 정상, 탭 전환, 프리뷰 실시간 반영, 저장/복원

### S40: LevelUpOverlay (3택 카드)
- **file**: `apps/web/components/game/LevelUpOverlay.tsx` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §3.3, `v10-ui-ux-plan.md` §6 Game Overlays
- **blocked_by**: S34
- **do**:
  1. 3택 카드 UI: Tome/Ability 이름 + 아이콘 + 효과 설명
  2. 카드 색상: Tome=파랑, Ability=초록, 강화=금색
  3. 키보드 선택: [1][2][3] 키
  4. 5초 타이머 바 (타임아웃 시 랜덤 선택)
  5. 시너지 근접 힌트: "시너지 1개 부족!" 뱃지
  6. 선택 후 축하 파티클 + 카드 사라짐 애니메이션
- **verify**: level_up 이벤트 수신 → 오버레이 표시, 선택 → choose_upgrade emit, 5초 타임아웃

### S41: BuildHUD + XPBar
- **file**: `apps/web/components/game/BuildHUD.tsx`, `apps/web/components/game/XPBar.tsx` (NEW ×2)
- **ref**: `v10-survival-roguelike-plan.md` §1.6.6, `v10-ui-ux-plan.md` §5 Game HUD
- **blocked_by**: S34
- **do**:
  1. **BuildHUD**: Tome 스택 아이콘 (MC 아이템 슬롯 스타일) + Ability 슬롯 (쿨다운 오버레이)
  2. **XPBar**: MC 경험치 바 스타일 (초록 바 + 레벨 숫자)
  3. HP 바: MC 하트 스타일 또는 바 형태
  4. 위치: XP 상단 중앙, Build 좌하단, Ability 우하단
  5. 시너지 배지: 활성 시너지 금색 아이콘
- **verify**: HUD 요소 표시 정상, 실시간 업데이트 (XP 증가, Tome 추가, Ability 쿨다운)

### S42: ShrinkWarning + SynergyPopup
- **file**: `apps/web/components/game/ShrinkWarning.tsx`, `apps/web/components/game/SynergyPopup.tsx` (NEW ×2)
- **ref**: `v10-survival-roguelike-plan.md` §1.6.5, §4.3, `v10-ui-ux-plan.md` §5
- **blocked_by**: S34
- **do**:
  1. **ShrinkWarning**: "⚠️ 아레나 수축 10초" MC 레드스톤 텍스트 + 미니맵 빨간 점선
  2. **SynergyPopup**: "⚡ Glass Cannon 시너지 발동!" 금색 텍스트 팝업 + 인챈트 글로우
  3. 3초 후 자동 사라짐 (fadeOut 애니메이션)
  4. 수축 시 화면 가장자리 빨간 비네팅
- **verify**: arena_shrink_warning → ShrinkWarning 표시, synergy_activated → SynergyPopup 표시

### S43: RoundResult 확장
- **file**: `apps/web/components/game/RoundResultOverlay.tsx` (기존 수정)
- **ref**: `v10-survival-roguelike-plan.md` §8.5, `v10-ui-ux-plan.md` §7 End-Game Screens
- **blocked_by**: S34
- **do**:
  1. 빌드 정보 추가: 각 플레이어의 Tome 스택 + Ability 목록
  2. 시너지 배지 표시: 발동 시너지명 + 아이콘
  3. 히든 시너지 힌트: "???에 근접한 조합 발견!"
  4. Build Stats Viewer: 빌드 타임라인 + 킬 로그 + 데미지 차트 (접이식)
  5. 에이전트 분석 표시 자리 (Phase 5에서 채움)
- **verify**: round_end 이벤트 → 빌드/시너지 정보 표시, Build Stats 접이식 동작

### S44: 오라/이펙트 + 맵 오브젝트 시각화
- **file**: `apps/web/lib/renderer/entities.ts`, `apps/web/lib/renderer/ui.ts`
- **ref**: `v10-survival-roguelike-plan.md` §5B.6, §9.4, `v10-3d-graphics-plan.md` A6
- **blocked_by**: S36
- **do**:
  1. **전투 오라**: 에이전트 주위 반투명 원 (60px), 빌드에 따라 색상 변화
  2. **빌드 비주얼**: Damage=빨간, Armor=파란, Speed=잔상, Venom=초록 독안개
  3. **맵 오브젝트 렌더링**: MC 블록 구조물 스프라이트 (Shrine, Spring, Altar, Gate)
  4. **존 경계**: 바닥 타일 색상 변화 (잔디→돌→네더랙)
  5. **수축 경계선**: 빨간 반투명 원 + 레드스톤 파티클
  6. **대시 이펙트**: 부스트 시 잔상 + 속도선
- **verify**: 전투 중 오라 표시, 빌드별 시각 효과 구분, 맵 오브젝트 렌더링 정상

### S45: 로비 전체 재설계
- **file**: `apps/web/components/lobby/*.tsx`, `apps/web/app/page.tsx`
- **ref**: `v10-survival-roguelike-plan.md` §12.3b, `v10-ui-ux-plan.md` §4 Lobby Screens
- **blocked_by**: S39
- **do**:
  1. **LobbyIdleSnakes→LobbyIdleAgents**: 3 MC 에이전트 아이들 모션
  2. **LobbySnakePreview→LobbyAgentPreview**: R3F MC 캐릭터 회전+장비 표시
  3. **SkinGrid→CharacterCreator**: S39에서 구현 완료 → 통합
  4. **RoomList 테마**: 에이전트 아이콘 + 빌드 표시 추가
  5. **RecentWinnersPanel**: 승리 빌드 아이콘 + 시너지 배지
  6. **로고**: "CROSNAKE" SVG → "Agent Survivor" MC 스타일 SVG
  7. **Welcome 튜토리얼**: 첫 방문 시 3단계 가이드 모달
  8. **텍스트 리브랜딩**: "뱀"/"Snake Arena" → "에이전트"/"Agent Survivor"
  9. **page.tsx 리팩토링**: snake→agent 참조, useSocket lift 유지
  10. **전환 애니메이션**: lobby→game 300ms opacity fade 유지
- **verify**: 로비 렌더링 정상, 캐릭터 크리에이터 통합, 리브랜딩 텍스트 0건 누락, 로비→게임 전환

---

## Phase 4 — Agent Integration + Training UI (1.5주)

### S46: Agent level_up + choose_upgrade 프로토콜
- **file**: `server/internal/ws/protocol.go`, `server/internal/game/arena.go`
- **ref**: `v10-survival-roguelike-plan.md` §6.1
- **blocked_by**: S32
- **do**:
  1. 서버→에이전트: `level_up` 이벤트 (choices[], currentBuild, gameContext, deadline)
  2. 에이전트→서버: `choose_upgrade` 이벤트 (choiceIndex, reasoning?)
  3. 5초 타임아웃: 미응답 시 서버 랜덤 선택 + 봇 폴백 로직
  4. 에이전트 인증: API key 기반 (v9 Agent API 재사용)
  5. WebSocket 에이전트 전용 이벤트 라우팅
- **verify**: 에이전트 WS 접속 → level_up 수신 → choose_upgrade 응답 → 업그레이드 적용

### S47: Commander Mode 확장
- **file**: `server/internal/game/agent_api.go` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §6.2, §12.4a (마이그레이션 가이드)
- **blocked_by**: S46
- **do**:
  1. v9 유지 명령: go_to, go_center, flee, hunt, hunt_nearest, gather, set_boost
  2. v9 삭제 명령: ambush, gather_near, gather_powerup → 대체 안내
  3. v10 신규: engage_weak, avoid_strong, farm_orbs, kite, camp_shrinkage
  4. v10 신규: priority_target, set_combat_style, set_ability_priority
  5. 명령 파싱 + Arena 내 실행 매핑
  6. set_combat_style → 행동 가중치 변경 (aggressive=hunt 80%)
- **verify**: 각 명령 실행 확인, v9 호환 명령 동작, 새 명령 동작

### S48: 빌드 패스 시스템
- **file**: `server/internal/game/build_path.go` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §6.3
- **blocked_by**: S18, S47
- **do**:
  1. BuildPath 구조체: id, name, priority[], synergyTarget, phaseStrategy
  2. 5종 프리셋: Berserker, Tank, Speedster, Vampire, Scholar
  3. `ChooseUpgradeFromPath(choices, buildPath, gameContext)` 알고리즘
  4. 시너지 완성 최우선 → 빌드 패스 우선순위 → 상황 폴백
  5. 에이전트 커스텀 빌드 패스 등록 API (PUT /agent/:id/build-path)
- **verify**: 5종 빌드 패스별 업그레이드 선택 시뮬레이션, 시너지 목표 도달률

### S49: 에이전트 훈련 API
- **file**: `server/cmd/server/router.go`, `server/internal/game/training.go` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §7
- **blocked_by**: S47, S48
- **do**:
  1. `PUT /api/agent/:id/training` — 빌드 프로필 설정
  2. `GET /api/agent/:id/training` — 현재 훈련 설정 조회
  3. 빌드 프로필: 우선순위 Tome/Ability 목록, 금지 업그레이드, 필수 업그레이드
  4. 전투 규칙: if/then 조건부 규칙 리스트 (e.g., "HP < 30% → Shield 우선")
  5. 전략 페이즈: early/mid/late 각각 전투 스타일 설정
  6. 에이전트 성격 프리셋 연동 (6종 → 훈련 초기값)
- **verify**: 훈련 설정 CRUD, 빌드 프로필 적용 후 봇 행동 변화 확인

### S50: 메모리/학습 데이터 저장
- **file**: `server/internal/game/training.go` (확장)
- **ref**: `v10-survival-roguelike-plan.md` §7.2
- **blocked_by**: S49
- **do**:
  1. 에이전트별 JSON 파일 저장 (`data/agents/{id}.json`)
  2. 라운드 결과 기록: 빌드, 순위, 킬, 시너지, 사망 원인
  3. 상대 분석 메모리: 자주 만나는 상대의 빌드 패턴 기억
  4. 시너지 시도 결과: 어떤 조합을 시도했고 성공/실패 기록
  5. 학습 데이터 조회 API: `GET /api/agent/:id/memory`
- **verify**: 라운드 후 데이터 파일 생성, 누적 데이터 정확, API 조회 정상

### S51: Training Console UI
- **file**: `apps/web/components/lobby/TrainingConsole.tsx` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §12.4b, `v10-ui-ux-plan.md` §8 Agent Training Screens
- **blocked_by**: S49, S45
- **do**:
  1. McPanel 기반 접이식 패널 (RoomList 아래)
  2. **TrainingHeader**: 에이전트 상태 (온라인/승률/평균레벨)
  3. **BuildProfileEditor**: 빌드 패스 선택 + 금지/필수 업그레이드 토글
  4. **CombatRulesEditor**: if/then 규칙 리스트 + 추가/삭제
  5. **StrategyPhaseEditor**: early/mid/late 드롭다운 (Aggressive/Defensive/Balanced/XP Rush/Endgame)
  6. **LearningLog**: 최근 10라운드 결과 테이블
  7. WebSocket `training_update` 이벤트로 실시간 반영
  8. 모바일: 전체 화면 모달로 전환
- **verify**: Training Console 렌더링, CRUD 동작, 실시간 업데이트, 모바일 반응형

### S52: observe_game 확장
- **file**: `server/internal/game/agent_api.go` (확장)
- **ref**: `v10-survival-roguelike-plan.md` §12.4c
- **blocked_by**: S47
- **do**:
  1. v10 확장 필드: level, xp, xpToNext, build (tomes+abilities+synergies)
  2. arenaRadius, zone (center/mid/edge/danger)
  3. nearbyThreats: [{id, mass, distance, buildType}]
  4. nearbyMapObjects: [{type, x, y, distance}]
  5. 기존 v9 필드와 하위 호환 유지
- **verify**: observe_game 응답에 v10 필드 포함, v9 에이전트 하위 호환

---

## Phase 5 — Meta + Coach/Analyst + Polish (1.5주)

### S53: RP 시스템 + 잠금 해제
- **file**: `server/internal/game/progression.go` (NEW), `server/internal/domain/types.go` (확장)
- **ref**: `v10-survival-roguelike-plan.md` §10
- **blocked_by**: S32
- **do**:
  1. Reputation Points (RP) 누적: 라운드 순위/킬/시너지 기반 보상
  2. 해금 항목: 3번째 Ability 슬롯 (RP 50), 추가 빌드 프로필 슬롯 등
  3. 업적 기반 캐릭터 프리셋 해금 (§5B.4.2)
  4. RP 저장: 플레이어별 JSON 파일 (`data/players/{id}.json`)
  5. RP 잔액 + 해금 상태 API: `GET /api/player/:id/progression`
- **verify**: RP 누적 정확, 해금 조건 충족 시 아이템 해금, API 응답

### S54: 퀘스트 시스템 (8종)
- **file**: `server/internal/game/quests.go` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §10.4
- **blocked_by**: S53
- **do**:
  1. 8종 기본 퀘스트: "3킬 달성", "시너지 발동", "Lv10 도달", "Speed Gate 3회 이용" 등
  2. 데일리 퀘스트: 매일 3개 랜덤 활성화
  3. 완료 조건 트래킹 (라운드 중 이벤트 기반)
  4. RP 보상 지급
  5. 퀘스트 상태 API: `GET /api/player/:id/quests`
- **verify**: 퀘스트 진행 트래킹, 완료 시 RP 보상, 데일리 리셋

### S55: 글로벌 리더보드 확장
- **file**: `server/internal/game/leaderboard.go` (확장)
- **ref**: `v10-survival-roguelike-plan.md` §10
- **blocked_by**: S53
- **do**:
  1. 빌드 승률 리더보드: 빌드 패스별 승률 집계
  2. 시너지 발견 리더보드: 가장 많은 시너지 발동 에이전트
  3. 에이전트 순위: 총 RP 기반 랭킹
  4. 리더보드 API: `GET /api/leaderboard?type=build|synergy|agent`
  5. 로비에서 리더보드 표시 (RecentWinnersPanel 확장)
- **verify**: 리더보드 데이터 정확, 정렬 정상, API 응답 구조

### S56: 에이전트 성격 프리셋 (6종)
- **file**: `server/internal/domain/upgrades.go` (확장), `server/internal/game/bot.go` (확장)
- **ref**: `v10-survival-roguelike-plan.md` §7.3
- **blocked_by**: S49
- **do**:
  1. 6종 성격: Aggro(공격적), Cautious(신중), Scholar(학구적), Gambler(도박), Balanced(균형), Adaptive(적응)
  2. 각 성격 → 빌드 패스 + 전투 스타일 + 리스크 허용치 매핑
  3. Adaptive: 직전 라운드 결과 기반 전략 자동 조정
  4. 로비에서 성격 선택 UI (드롭다운)
  5. 에이전트 훈련 초기값으로 성격 프리셋 적용
- **verify**: 6종 성격별 행동 패턴 차이 확인, Adaptive 자동 조정 동작

### S57: Coach Agent
- **file**: `server/internal/game/coach.go` (NEW), `apps/web/components/game/CoachBubble.tsx` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §12.5a, `v10-ui-ux-plan.md` §5
- **blocked_by**: S52
- **do**:
  1. 서버: observe_game 데이터 기반 조언 생성 로직
  2. 트리거: 위험 접근(⚠️), 레벨업 추천(💡), 전략 전환(🔄), 킬 기회(🎯)
  3. `coach_message` socket 이벤트로 전달 (0.5~1Hz, 스팸 방지)
  4. 클라이언트: 게임 화면 하단 작은 채팅 버블 UI
  5. 버블 3초 후 자동 사라짐, 최대 2개 동시 표시
  6. Phase 5+ LLM 호출 통합 (현재는 규칙 기반)
- **verify**: 위험 상황 → 경고 메시지 수신, 레벨업 시 → 추천 표시, 버블 UI 동작

### S58: Analyst Agent
- **file**: `server/internal/game/analyst.go` (NEW), `apps/web/components/game/AnalystPanel.tsx` (NEW)
- **ref**: `v10-survival-roguelike-plan.md` §12.5b, `v10-ui-ux-plan.md` §7
- **blocked_by**: S43, S52
- **do**:
  1. 서버: RoundSummary 데이터 기반 분석 생성
  2. 분석 항목: 빌드 효율, 전투 포지셔닝, 개선 제안 3개
  3. `round_analysis` socket 이벤트 (라운드 종료 시 1회)
  4. 클라이언트: RoundResult 내 "🤖 AI 분석" 확장 패널
  5. 접이식 UI: 기본 닫힘, 클릭 시 분석 표시
  6. Phase 5+ LLM 호출 통합 (현재는 규칙 기반 템플릿)
- **verify**: 라운드 종료 → 분석 데이터 수신, 패널 표시/접기 동작

### S59: 최종 밸런스 + 통합 테스트
- **file**: —
- **ref**: `v10-survival-roguelike-plan.md` §1.5 (성공 지표), §13.2 (리스크)
- **blocked_by**: S53, S54, S55, S56, S57, S58
- **do**:
  1. 전체 시스템 E2E 테스트: 로비→룸참여→게임→레벨업→시너지→사망→결과→재시작
  2. 멀티플레이어 QA: 인간 2명 + 봇 15마리 5분 라운드 3회
  3. 에이전트 QA: 외부 에이전트 접속 → level_up/choose_upgrade → 관전
  4. 성능 최종 확인: 500 CCU 부하 테스트
  5. 밸런스 최종 확인: 성공 지표 (§1.5) 달성 여부
  6. 모바일 반응형 최종 QA
  7. 크로스 브라우저 테스트 (Chrome, Safari, Firefox)
- **verify**: 전체 E2E 시나리오 통과, 성능 지표 충족, 밸런스 지표 충족, 크리티컬 버그 0건

---

## 요약 테이블

| Phase | Steps | 기간 | 핵심 산출물 | 참조 문서 |
|-------|-------|------|------------|----------|
| **Phase 0** | S01~S12 | 2주 | Go 프로젝트, Hub, WS Protocol, Domain Types | `v10-go-server-plan.md` |
| **Phase 1** | S13~S21 | 2주 | 9개 게임 시스템 Go 포팅 | `v10-go-server-plan.md` §5 |
| **Phase 1a** | S22~S26 | 1주 | Room/Bot + 로컬 통합 테스트 | TS 프로토타입 |
| **Phase 2** | S27~S32 | 1주 | 맵 오브젝트 + 밸런스 + Railway Go 배포 | `v10-survival-roguelike-plan.md` §9 |
| **Phase 3** | S33~S45 | 3.5주 | WS 어댑터 + MC 렌더러 + 로비 재설계 | `v10-3d-graphics-plan.md`, `v10-ui-ux-plan.md` |
| **Phase 4** | S46~S52 | 1.5주 | Agent API + Training Console | `v10-survival-roguelike-plan.md` §6-7 |
| **Phase 5** | S53~S59 | 1.5주 | Coach/Analyst + RP/퀘스트 + 최종 밸런스 | `v10-survival-roguelike-plan.md` §10 |
| **합계** | **59 Steps** | **~13주** | | **병렬화 시 ~11주** |

## 크리티컬 패스 (Critical Path)

```
S01 → S02 → S03 → S04 → S05 → S06 ─────────────────────────────────┐
                                                                      │
S07 → S13 → S15 → S19 → S22 → S23 → S26 → S29 → S32 ─────────────┤
                                                            │         │
                                                            ▼         │
                                          S33 → S34 → S36 → S39 → S45 ──→ S51 → S59
                                                                            │
                                                      S46 → S47 → S49 ─────┘
```

**크리티컬 패스 길이**: ~32 Steps (S01→...→S59)
**병렬화 효과**: Phase 3 내부 (렌더러+UI 동시 착수) + Phase 5 내부 (메타+AI 동시 착수)

## 설계 문서 교차 참조 맵

| Step 범위 | 메인 기획서 §N | Go 서버 | 3D Graphics | UI/UX |
|-----------|--------------|---------|-------------|-------|
| S01~S12 | §12.0 | §3-4, §6 전체 | — | — |
| S13~S21 | §5, §5B, §12.1 | §5 전체 | — | — |
| S22~S26 | §8, §12.1a | — | — | — |
| S27~S32 | §9, §12.2 | — | Part B (수치) | — |
| S33~S35 | §12.3 | §7 | — | — |
| S36~S38 | §5B.5, §12.3 | — | Part A (A1-A5) | §9 |
| S39~S45 | §5B.4, §12.3a-b | — | Part A (A6-A10) | §3-7 전체 |
| S46~S52 | §6-7, §12.4 | — | — | §8 |
| S53~S59 | §10, §12.5 | — | — | §5, §7 |
