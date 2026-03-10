# [SYSTEM] v33 — Online Matrix: System Architecture Document

## Overview

이 문서는 v33 Online Matrix의 **상세 시스템 아키텍처**를 정의합니다.
`v33-online-matrix-plan.md`(기획서)의 High-Level Blueprint를 받아, C4 Level 2-3, API 스펙, 데이터 모델, 보안 위협 모델, 인프라 설계로 심화합니다.

**핵심 목표**: 싱글플레이어 Matrix 게임(`apps/web/lib/matrix/`, Canvas 2D, 5200줄)을 기존 Go 서버의 195-국가 에폭 시스템(`server/internal/game/`)과 실시간 연결하여 Play-to-Earn 멀티플레이어 아레나를 구현합니다.

**아키텍처 핵심**: 서버 권위적 하이브리드 모델 — 클라이언트가 자기 캐릭터를 로컬 시뮬레이션하고, 서버가 결과를 검증(KillValidator)하여 치팅 방지와 성능의 균형을 달성합니다.

| 항목 | 값 |
|------|-----|
| Plan 문서 | `docs/designs/v33-online-matrix-plan.md` |
| 서버 코드베이스 | `server/internal/game/` (Go, 20Hz 틱, gorilla/websocket) |
| 클라이언트 코드베이스 | `apps/web/lib/matrix/` (TypeScript, Canvas 2D, 60fps) |
| Agent SDK | `aww-agent-skill/src/` (Node.js, WS + REST) |
| WS 프레임 포맷 | `{e: string, d: any}` (커스텀 JSON, Socket.IO 아님) |
| 배포 | Vercel (FE) + Railway (BE) + CROSS Mainnet (블록체인) |

## Goals / Non-Goals

### Goals
1. **Matrix-Server 통합**: 기존 EpochManager, DominationEngine, TokenRewardManager, DefenseOracle를 수정 없이 재사용하면서 Matrix 게임과 연결
2. **서버 권위적 검증**: KillValidator로 치팅 방지 (거리/쿨다운/데미지/상태 4단계 검증)
3. **결정론적 동기화**: 시드 기반 몬스터 스폰으로 모든 클라이언트가 동일한 PvE 환경 공유
4. **토큰 경제 루프**: Play → Earn → Hold/Spend → Play 순환, Net Deflationary 유지
5. **에이전트 SDK 확장**: Layer 1에 MatrixGameClient 추가, Layer 2 REST API 100% 하위 호환
6. **성능 목표**: 아레나당 50명, 서버 20Hz, 클라이언트 60fps, 상태 전송 <50ms

### Non-Goals
1. **서버 사이드 물리 시뮬레이션**: 55개 스킬 × 50명분 물리/충돌을 서버에서 돌리지 않음 (하이브리드 모델)
2. **기존 API 변경**: `/api/v11/*` REST API는 그대로, WS 프로토콜은 `matrix_*` 접두사로 확장만
3. **3D 렌더링**: Matrix는 Canvas 2D 유지, R3F/Three.js 전환은 v33 범위 밖
4. **새 토큰 발행**: 기존 $AWW + 195 국가 토큰 재사용, 신규 토큰 발행 없음
5. **서버 인프라 변경**: Railway 단일 인스턴스 유지, K8s 전환은 v33 범위 밖

## Architecture

### System Context (C4 Level 1)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          SYSTEM CONTEXT (C4 L1)                          │
│                                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │  Human      │   │  AI Agent    │   │  CROSSx      │                 │
│  │  Player     │   │  (SDK)       │   │  Wallet App  │                 │
│  │  [Browser]  │   │  [Node.js]   │   │  [Mobile]    │                 │
│  └──────┬──────┘   └──────┬───────┘   └──────┬───────┘                 │
│         │ WS+HTTP         │ WS+HTTP          │ Deep Link               │
│         │                 │                   │                          │
│  ┌──────┴─────────────────┴───────────────────┴──────────────────────┐  │
│  │              AI WORLD WAR — Go Game Server                         │  │
│  │              (Railway, single instance, port 9000)                 │  │
│  │                                                                    │  │
│  │  ┌────────────────────┐  ┌────────────────┐  ┌────────────────┐   │  │
│  │  │ WS Hub (gorilla)   │  │ REST API (chi) │  │ Meta Engines   │   │  │
│  │  │ ├─ CountryArena×195│  │ /api/v11/*     │  │ Faction/War/   │   │  │
│  │  │ │  w/ OnlineMatrix │  │ /api/matrix/*  │  │ Economy/Gov    │   │  │
│  │  │ └─ AgentStream     │  └────────────────┘  └────────────────┘   │  │
│  │  └────────────────────┘                                            │  │
│  └──────────────────────────┬────────────────────────────────────────┘  │
│                              │ RPC / HTTP                               │
│  ┌───────────────────────────┴───────────────────────────────────────┐  │
│  │  PostgreSQL (Railway)  │  Redis (Railway)  │  CROSS Mainnet      │  │
│  │  유저/팩션/시즌/보상     │  실시간 캐시       │  $AWW + 195 토큰     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**핵심 변경**: 기존 CountryArenaWrapper에 `OnlineMatrixEngine`을 내장. 새 컨테이너/서비스 추가 없이 기존 Go 서버에 모듈만 확장.

### Container Diagram (C4 Level 2)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       GO GAME SERVER (Container Level)                      │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  ws.Hub (gorilla/websocket)                                         │  │
│  │  ├─ Client registry (clientID → *ws.Client)                         │  │
│  │  ├─ Room registry (roomID → []clientID)                             │  │
│  │  ├─ Unicast / Roomcast / Broadcast channels                         │  │
│  │  └─ ★ MatrixHandler (matrix_* event routing) ◄─── NEW              │  │
│  └────────────────────────┬────────────────────────────────────────────┘  │
│                           │ events                                         │
│  ┌────────────────────────┴────────────────────────────────────────────┐  │
│  │  game.CountryArenaManager                                           │  │
│  │  ├─ arenas map[string]*CountryArenaWrapper (lazy init, 195 max)     │  │
│  │  ├─ playerCountry map[string]string                                 │  │
│  │  └─ queues map[string][]QueueEntry                                  │  │
│  │                                                                      │  │
│  │  CountryArenaWrapper (per-country, 1 of 195)                        │  │
│  │  ├─ Room           *Room            (state machine)                 │  │
│  │  ├─ Epoch          *EpochManager    (10m15s cycle, 6 phases)        │  │
│  │  ├─ Respawn        *RespawnManager                                  │  │
│  │  ├─ CapturePoints  *CapturePointSystem (3 points/arena)             │  │
│  │  ├─ Domination     *DominationEngine (1hr eval, 6-epoch cycle)      │  │
│  │  ├─ NationScore    *NationScoreTracker (epoch-level accumulation)    │  │
│  │  ├─ ★ Sovereignty  *SovereigntyTracker ◄─── 추가 (v33 확장)         │  │
│  │  └─ ★ MatrixEngine *OnlineMatrixEngine ◄─── NEW (핵심 신규 모듈)     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐    │
│  │ meta.* (기존 유지)      │  │ blockchain.* (기존 유지)              │    │
│  │ FactionManager         │  │ TokenRewardManager                    │    │
│  │ WarManager             │  │ DefenseOracle                         │    │
│  │ EconomyEngine          │  │ BuybackEngine                         │    │
│  │ DiplomacyEngine        │  │ StakingManager                        │    │
│  │ PolicyEngine           │  │ AuctionManager                        │    │
│  │ GovernanceEngine       │  │ BlockchainClient (CROSS RPC)          │    │
│  └───────────────────────┘  └────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     WEB CLIENT (Container Level)                            │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App (apps/web/)                                         │  │
│  │  ├─ app/(hub)/ — Globe Lobby, Faction, Economy, Governance pages    │  │
│  │  ├─ app/(game)/ — Matrix Arena entry page                           │  │
│  │  └─ components/game/matrix/ — MatrixApp.tsx (5200줄, Canvas 2D)     │  │
│  │                                                                      │  │
│  │  lib/matrix/ (게임 엔진 — 기존)                                       │  │
│  │  ├─ systems/ — spawning, combat, movement, weapons, projectile ...  │  │
│  │  ├─ rendering/ — Canvas 2D renderer                                  │  │
│  │  ├─ managers/ — game loop, input                                     │  │
│  │  └─ workers/ — Web Worker tick                                       │  │
│  │                                                                      │  │
│  │  ★ NEW: Online Layer (lib/matrix/online/)                            │  │
│  │  ├─ online-sync.ts      — 서버 상태 → 로컬 상태 동기화               │  │
│  │  ├─ client-prediction.ts — 자기 캐릭터 예측 + 서버 보정               │  │
│  │  ├─ seeded-spawning.ts   — 시드 RNG 기반 결정론적 몬스터 스폰         │  │
│  │  ├─ kill-reporter.ts     — 킬 리포트 + confirm/reject 처리           │  │
│  │  └─ epoch-ui-bridge.ts   — 에폭 페이즈 → UI 상태 연결                │  │
│  │                                                                      │  │
│  │  ★ NEW: hooks/useMatrixSocket.ts                                     │  │
│  │  — matrix_* WS 이벤트 전송/수신, GameSocket 래핑                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     AGENT SDK (Container Level)                             │
│                                                                            │
│  aww-agent-skill/src/                                                      │
│  ├─ client.ts          — GameClient (기존 Layer 1, heading-only input)     │
│  ├─ ★ matrix-client.ts — MatrixGameClient (NEW Layer 1, position+heading)  │
│  ├─ ★ matrix-strategy.ts — MatrixStrategy interface (에폭 페이즈 인식)     │
│  ├─ meta-client.ts     — MetaClient (기존 Layer 2, REST 100% 호환)        │
│  ├─ strategy.ts        — Strategy interface (기존)                         │
│  └─ types.ts           — ★ MatrixAgentState, MatrixAgentInput 타입 추가    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Design (C4 Level 3) — OnlineMatrixEngine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   OnlineMatrixEngine (C4 Level 3)                           │
│                   server/internal/game/matrix_*.go                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    OnlineMatrixEngine (orchestrator)                  │ │
│  │                    matrix_engine.go                                   │ │
│  │                                                                      │ │
│  │  Fields:                                                             │ │
│  │    countryCode  string                                               │ │
│  │    sessions     map[string]*PlayerSession    // clientID → session   │ │
│  │    seedSync     *MonsterSeedSync                                     │ │
│  │    validator    *KillValidator                                       │ │
│  │    scorer       *ScoreAggregator                                     │ │
│  │    rewarder     *EpochRewardCalculator                               │ │
│  │    buffApplier  *TokenBuffApplier                                    │ │
│  │    currentTick  uint64                                               │ │
│  │    pvpEnabled   bool                                                 │ │
│  │    mu           sync.RWMutex                                         │ │
│  │                                                                      │ │
│  │  Methods:                                                            │ │
│  │    Tick()                        // 20Hz: 위치 검증, 시드 갱신, 스코어 │ │
│  │    OnPlayerJoin(clientID, info)  // 세션 생성, 버프 적용               │ │
│  │    OnPlayerLeave(clientID)       // 세션 정리, 스코어 보존             │ │
│  │    OnPlayerInput(clientID, input)// 위치 수신+검증                    │ │
│  │    OnKillReport(clientID, kill)  // KillValidator → confirm/reject    │ │
│  │    OnDamageReport(clientID, dmg) // PvP 데미지 검증                   │ │
│  │    OnCapture(clientID, pointID)  // CapturePointSystem 연동           │ │
│  │    OnLevelUp(clientID, choice)   // 레벨업 선택 기록                   │ │
│  │    OnEpochPhaseChange(phase)     // pvpEnabled 토글, 시드 재배포       │ │
│  │    OnEpochEnd(epochNum)          // 스코어 스냅샷 → 보상 계산 → 리셋  │ │
│  │    GetWorldState()               // 20Hz downlink용 전체 상태 수집     │ │
│  │    GetDeltaState(lastTick)       // delta compression 상태            │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │  PlayerSession      │  │  MonsterSeedSync    │  │  KillValidator   │  │
│  │  matrix_session.go  │  │  matrix_seed.go     │  │  matrix_valid.go │  │
│  │                     │  │                     │  │                  │  │
│  │  clientID  string   │  │  currentSeed uint64 │  │  weaponRanges    │  │
│  │  name      string   │  │  waveId      int    │  │  weaponCooldowns │  │
│  │  nationality string │  │  epochId     int    │  │  suspicionMap    │  │
│  │  x, y      float64  │  │  lastSeedTick uint64│  │  banThreshold=10 │  │
│  │  angle     float64  │  │  countryCode string │  │                  │  │
│  │  hp, maxHp int      │  │                     │  │  Validate(kill)  │  │
│  │  level     int      │  │  GenerateSeed()     │  │   → (bool, str) │  │
│  │  kills     int      │  │  NextWave()         │  │  CheckSpeed(pos) │  │
│  │  damage    float64  │  │  GetCurrentSeed()   │  │   → (bool, str) │  │
│  │  weapons   []string │  │  ShouldReseed(tick) │  │  GetSuspicion()  │  │
│  │  alive     bool     │  │   → bool (30초마다)  │  │   → int          │  │
│  │  lastTick  uint64   │  └─────────────────────┘  └──────────────────┘  │
│  │  isAgent   bool     │                                                  │
│  │  isDirectPlay bool  │  ┌─────────────────────┐  ┌──────────────────┐  │
│  │  joinedAt  time.Time│  │  ScoreAggregator   │  │  EpochReward-    │  │
│  │  tokenBalance float │  │  matrix_score.go   │  │  Calculator      │  │
│  │  buffs     TokenBuf │  │                    │  │  matrix_reward.go│  │
│  │                     │  │  epochScores       │  │                  │  │
│  │  UpdatePosition()   │  │    map[nation]int  │  │  Calculate(      │  │
│  │  RecordKill()       │  │  playerScores      │  │    scores,       │  │
│  │  RecordDamage()     │  │    map[pid]Score   │  │    sovereignty,  │  │
│  │  ApplyBuffs(buffs)  │  │  history []Snap    │  │    mvp, etc)     │  │
│  │  GetScore() Score   │  │                    │  │   → []Reward     │  │
│  │  Reset()            │  │  AddKill(pid,nat)  │  │                  │  │
│  └─────────────────────┘  │  AddLevel(pid,nat) │  │  Dependencies:   │  │
│                            │  AddDamage(pid,d)  │  │   TokenReward-   │  │
│  ┌─────────────────────┐  │  AddSurvival(pid)  │  │   Manager (기존) │  │
│  │  TokenBuffApplier   │  │  SnapshotAndReset()│  │   DefenseOracle  │  │
│  │  matrix_buff.go     │  │  GetNationScores() │  │    (기존)        │  │
│  │                     │  └────────────────────┘  └──────────────────┘  │
│  │  tiers []BuffTier   │                                                  │
│  │   100: +10% XP      │  **콜백 연결 (wiring)**:                         │
│  │   1K:  +5% stats    │  EpochManager.OnEvents → engine.OnEpochPhaseChg │
│  │   10K: +15%XP+Rally │  EpochManager.epoch_end → engine.OnEpochEnd      │
│  │   100K:+20%+Inspire │  DominationEngine.OnEvent → scorer (optional)    │
│  │                     │  engine.OnEpochEnd → scorer.SnapshotAndReset()   │
│  │  GetBuffs(balance)  │  engine.OnEpochEnd → rewarder.Calculate()        │
│  │   → TokenBuffs      │  rewarder → TokenRewardManager.QueueReward()     │
│  └─────────────────────┘                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

**설계 결정 — 독립 ScoreAggregator**: 기획서 주의사항에 명시된 대로, `NationScoreTracker.Reset()`이 에폭마다 호출되므로 `ScoreAggregator`는 별도 히스토리를 유지합니다. `OnEpochEnd` 시점에 `GetScores()` 스냅샷 저장 후 `Reset()` 호출하여 데이터 손실을 방지합니다.

### Component Design (C4 Level 3) — Client Online Layer

```
┌────────────────────────────────────────────────────────────────────────────┐
│               Client Online Layer (C4 Level 3)                              │
│               apps/web/lib/matrix/online/ + hooks/                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  hooks/useMatrixSocket.ts                                            │ │
│  │  — GameSocket (useWebSocket.ts의 GameSocket 클래스) 래핑             │ │
│  │  — matrix_* 이벤트 전용 인터페이스                                    │ │
│  │                                                                      │ │
│  │  Uplink Methods:                                                     │ │
│  │    joinArena(countryCode, build?, agentId?)                          │ │
│  │    leaveArena()                                                      │ │
│  │    sendInput(x, y, angle, boost, tick)  // 10Hz throttled            │ │
│  │    reportKill(targetId, weaponId, damage, distance, tick)            │ │
│  │    reportDamage(targetId, weaponId, damage, tick)                    │ │
│  │    capturePoint(pointId)                                             │ │
│  │    chooseLevelUp(choiceId)                                           │ │
│  │                                                                      │ │
│  │  Downlink Listeners (on):                                            │ │
│  │    matrix_state     → OnlineSyncSystem.applyState()                  │ │
│  │    matrix_epoch     → EpochUIBridge.onPhaseChange()                  │ │
│  │    matrix_spawn_seed → SeededSpawning.onSeed()                       │ │
│  │    matrix_kill_confirmed → KillReporter.onConfirmed()                │ │
│  │    matrix_kill_rejected  → KillReporter.onRejected()                 │ │
│  │    matrix_score     → scoreboard state update                        │ │
│  │    matrix_result    → result overlay state update                    │ │
│  │    matrix_capture_state → capture point UI update                    │ │
│  │    matrix_buff      → buff display update                            │ │
│  │    matrix_level_up_choices → level up selection UI                   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌───────────────────────┐  ┌───────────────────────┐                    │
│  │  OnlineSyncSystem     │  │  ClientPrediction     │                    │
│  │  online-sync.ts       │  │  client-prediction.ts │                    │
│  │                       │  │                       │                    │
│  │  applyState(ws_state) │  │  localState: Player   │                    │
│  │  — players[] → 보간큐  │  │  serverState: Player  │                    │
│  │  — epochPhase 반영     │  │  pendingInputs[]      │                    │
│  │  — scores 업데이트     │  │                       │                    │
│  │  — capture points     │  │  applyInput(input)     │                    │
│  │  — safeZoneRadius     │  │  reconcile(serverPos)  │                    │
│  │                       │  │  — snap if Δ > 100px   │                    │
│  │  interpolatePlayers() │  │  — lerp if Δ 50~100px  │                    │
│  │  — 100ms buffer       │  │  — ignore if Δ < 50px  │                    │
│  │  — lerp(prev, next, t)│  │                       │                    │
│  └───────────────────────┘  └───────────────────────┘                    │
│                                                                            │
│  ┌───────────────────────┐  ┌───────────────────────┐                    │
│  │  SeededSpawning       │  │  KillReporter         │                    │
│  │  seeded-spawning.ts   │  │  kill-reporter.ts     │                    │
│  │                       │  │                       │                    │
│  │  rng: SeededRNG       │  │  pendingKills[]       │                    │
│  │  (xoshiro256 또는     │  │  confirmedKills[]     │                    │
│  │   seedrandom lib)     │  │  rejectedCount: int   │                    │
│  │                       │  │                       │                    │
│  │  onSeed(seed, wave)   │  │  reportKill(target)   │                    │
│  │  spawnWave()          │  │  onConfirmed(kill)    │                    │
│  │  — 결정론적 enemy type │  │  onRejected(reason)  │                    │
│  │  — 결정론적 position   │  │  — UI: 킬 롤백        │                    │
│  │  — 결정론적 entity ID  │  │  — suspicion display  │                    │
│  │    (seed+wave+index)  │  │                       │                    │
│  │                       │  │                       │                    │
│  │  기존 spawning.ts를    │  │                       │                    │
│  │  래핑 (Math.random →   │  │                       │                    │
│  │  seeded RNG로 교체)   │  │                       │                    │
│  └───────────────────────┘  └───────────────────────┘                    │
│                                                                            │
│  ┌───────────────────────┐                                                │
│  │  EpochUIBridge        │                                                │
│  │  epoch-ui-bridge.ts   │                                                │
│  │                       │                                                │
│  │  currentPhase: Phase  │   **MatrixApp.tsx 분기 (5200줄 기존 파일)**    │
│  │  countdown: number    │   — mode: 'offline' | 'online'                 │
│  │  pvpEnabled: boolean  │   — online 모드 시:                             │
│  │  warSiren: boolean    │     게임 루프에 OnlineSyncSystem.tick() 추가    │
│  │                       │     입력 → useMatrixSocket.sendInput() 연결     │
│  │  onPhaseChange(evt)   │     킬 → KillReporter.reportKill() 연결        │
│  │  getTimerDisplay()    │     스폰 → SeededSpawning 사용                  │
│  │  getPhaseConfig()     │     렌더러에 remotePlayers[] 추가               │
│  │  — PvP/orbMult/shrink │                                                │
│  └───────────────────────┘                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Design (C4 Level 3) — Agent SDK Extension

```
┌────────────────────────────────────────────────────────────────────────────┐
│               Agent SDK Extension (C4 Level 3)                              │
│               aww-agent-skill/src/                                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  MatrixGameClient (NEW — matrix-client.ts)                           │ │
│  │  — GameClient과 병렬 (교체 아님)                                     │ │
│  │  — 동일 wire format: {e: string, d: any}                            │ │
│  │                                                                      │ │
│  │  Input model:                                                        │ │
│  │    기존 GameClient: { angle: number, boost: boolean }                │ │
│  │    ★ MatrixGameClient: { x, y, angle, boost, tick }                 │ │
│  │    — 위치(x,y) 보고 필수 (클라이언트 시뮬이므로)                      │ │
│  │                                                                      │ │
│  │  Kill reporting:                                                     │ │
│  │    기존 GameClient: 서버가 킬 감지 → death/kill 이벤트               │ │
│  │    ★ MatrixGameClient: 클라이언트가 보고 → 서버 검증 → confirmed     │ │
│  │                                                                      │ │
│  │  State event:                                                        │ │
│  │    기존: agent_state {tick, self:{x,y,mass,level,...}, nearby_*}     │ │
│  │    ★ NEW: matrix_agent_state (MatrixAgentState 타입, 10Hz)          │ │
│  │      { tick, self:{x,y,hp,maxHp,level,weapons,status[]},            │ │
│  │        nearbyPlayers[], nearbyEnemies[], epochPhase, pvpEnabled,     │ │
│  │        capturePoints[], nationScores }                               │ │
│  │                                                                      │ │
│  │  Methods:                                                            │ │
│  │    connect(url) → WS 연결                                            │ │
│  │    joinArena(countryCode)                                            │ │
│  │    setStrategy(MatrixStrategy)                                       │ │
│  │    startAutoPlay() → 10Hz input loop                                 │ │
│  │    reportKill(targetId, weaponId, damage, distance)                  │ │
│  │    chooseLevelUp(choiceId) → matrix_level_up                         │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  MatrixStrategy (NEW — matrix-strategy.ts)                           │ │
│  │  — Strategy 인터페이스와 별개                                         │ │
│  │  — 에폭 페이즈 인식 콜백 구조                                         │ │
│  │                                                                      │ │
│  │  interface MatrixStrategy {                                          │ │
│  │    onPeace(state: MatrixAgentState): MatrixAgentInput;               │ │
│  │    onWar(state: MatrixAgentState): MatrixAgentInput;                 │ │
│  │    onShrink(state: MatrixAgentState): MatrixAgentInput;              │ │
│  │    onLevelUp(choices: LevelUpChoice[]): string; // choiceId          │ │
│  │  }                                                                   │ │
│  │                                                                      │ │
│  │  기존 3 전략에서 어댑터 생성:                                          │ │
│  │    AggressiveMatrixStrategy → onWar: 가장 가까운 적 추적              │ │
│  │    BalancedMatrixStrategy   → onPeace: 파밍, onWar: 조건부 PvP       │ │
│  │    DefensiveMatrixStrategy  → onShrink: 세이프존 이동 우선             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  MetaClient (기존 100% 호환 — meta-client.ts)                        │ │
│  │  — Layer 2 REST API: /api/v11/* 전체 유지                            │ │
│  │  — strategicTick 확장: "어느 국가에 배치할지" 판단 로직 추가           │ │
│  │    (인구, 보상률, 경쟁도 기반 — LLM 판단)                             │ │
│  │  — 에이전트 배치 비용: 50 Oil/에이전트, 최대 3마리 동시                │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow — Epoch Lifecycle

```
에폭 라이프사이클 시퀀스 (10분 15초, 12,300 ticks @ 20Hz)

┌──────────┐  ┌───────────┐  ┌───────────────────┐  ┌────────────┐  ┌────────┐
│  Client  │  │  WS Hub   │  │  OnlineMatrixEng  │  │  Epoch     │  │ TokenRw│
│ (Browser)│  │ (gorilla) │  │  (per-arena)      │  │  Manager   │  │ Manager│
└────┬─────┘  └─────┬─────┘  └─────────┬─────────┘  └─────┬──────┘  └───┬────┘
     │               │                  │                   │             │
     │  matrix_join  │                  │                   │             │
     │──────────────►│  OnPlayerJoin()  │                   │             │
     │               │─────────────────►│  session create   │             │
     │               │                  │  TokenBuffApplier  │             │
     │               │                  │  .GetBuffs(balance)│             │
     │  matrix_buff  │                  │                   │             │
     │◄──────────────│◄─────────────────│                   │             │
     │               │                  │                   │             │
     │               │                  │    ══ PEACE (5min) ══           │
     │               │                  │                   │ Tick()      │
     │               │                  │◄──────────────────│ phase=peace │
     │  matrix_epoch │                  │                   │             │
     │  {peace}      │                  │                   │             │
     │◄──────────────│◄─────────────────│                   │             │
     │               │                  │                   │             │
     │ matrix_spawn_ │  onSeed()        │                   │             │
     │ seed          │                  │ GenerateSeed()    │             │
     │◄──────────────│◄─────────────────│                   │             │
     │               │                  │                   │             │
     │ 로컬 시뮬     │                  │                   │             │
     │ (60fps: 몬스터│                  │                   │             │
     │  킬, 레벨업)  │                  │                   │             │
     │               │                  │                   │             │
     │ matrix_input  │  10Hz            │                   │             │
     │ {x,y,angle}   │                  │                   │             │
     │──────────────►│ OnPlayerInput()  │                   │             │
     │               │─────────────────►│ 위치 검증         │             │
     │               │                  │ (speed check)     │             │
     │               │                  │                   │             │
     │ matrix_state  │  20Hz            │                   │             │
     │ {players[]}   │                  │                   │             │
     │◄──────────────│◄─────────────────│ GetWorldState()   │             │
     │               │                  │                   │             │
     │               │                  │    ══ WAR_COUNTDOWN (10s) ══    │
     │               │                  │                   │ Tick()      │
     │  matrix_epoch │                  │◄──────────────────│ war_ctdown  │
     │  {war_ctdown} │                  │                   │             │
     │◄──────────────│◄─────────────────│ pvpEnabled=false  │             │
     │               │                  │ (아직 PvP OFF)     │             │
     │               │                  │                   │             │
     │               │                  │    ══ WAR (3min) ══             │
     │               │                  │◄──────────────────│ phase=war   │
     │  matrix_epoch │                  │                   │             │
     │  {war}        │                  │ pvpEnabled=true    │             │
     │◄──────────────│◄─────────────────│                   │             │
     │               │                  │                   │             │
     │ 적 플레이어   │                  │                   │             │
     │ 공격 (로컬)   │                  │                   │             │
     │               │                  │                   │             │
     │ matrix_kill   │                  │                   │             │
     │ {target,wpn,  │  OnKillReport()  │                   │             │
     │  dmg,dist,tick}│                 │                   │             │
     │──────────────►│─────────────────►│ KillValidator     │             │
     │               │                  │ .Validate(kill)   │             │
     │               │                  │ ├─ tick Δ < 5     │             │
     │               │                  │ ├─ distance check │             │
     │               │                  │ ├─ cooldown check │             │
     │               │                  │ ├─ damage cap     │             │
     │               │                  │ └─ alive check    │             │
     │               │                  │                   │             │
     │ matrix_kill_  │                  │                   │             │
     │ confirmed     │                  │                   │             │
     │ {score:15}    │                  │ ScoreAggregator   │             │
     │◄──────────────│◄─────────────────│ .AddKill(pid,nat) │             │
     │               │                  │                   │             │
     │               │                  │    ══ SHRINK (2min) ══          │
     │               │                  │◄──────────────────│ phase=shrink│
     │  matrix_epoch │                  │ radius 3000→1000  │             │
     │  {shrink}     │                  │ zone damage 5%/s  │             │
     │◄──────────────│◄─────────────────│                   │             │
     │               │                  │                   │             │
     │               │                  │    ══ END (5s) ══               │
     │               │                  │◄──────────────────│ phase=end   │
     │               │                  │                   │             │
     │               │                  │ OnEpochEnd():     │             │
     │               │                  │ 1. scorer.Snapshot()            │
     │               │                  │ 2. rewarder.Calculate()         │
     │               │                  │    ├─ 기본: 0.01tok/점          │
     │               │                  │    ├─ 전쟁승리: 2x              │
     │               │                  │    ├─ MVP: 1.5x                │
     │               │                  │    ├─ 직접플레이: 1.5x          │
     │               │                  │    └─ 주권/패권 보너스           │
     │               │                  │ 3. TokenRewardMgr │             │
     │               │                  │────────────────────────────────►│
     │               │                  │    .QueueReward() │             │
     │               │                  │ 4. scorer.Reset() │             │
     │               │                  │ 5. sessions.Reset()             │
     │               │                  │                   │             │
     │ matrix_result │                  │                   │             │
     │ {rankings,    │                  │                   │             │
     │  rewards,mvp} │                  │                   │             │
     │◄──────────────│◄─────────────────│                   │             │
     │               │                  │                   │             │
     │               │                  │    ══ TRANSITION (10s) ══       │
     │               │                  │◄──────────────────│ transition  │
     │               │                  │ 새 에폭 준비       │             │
     │               │                  │ 시드 재생성         │             │
     │               │                  │                   │             │
     │               │                  │    ══ 다음 PEACE ══             │
```

### Data Flow — Kill Validation Pipeline

```
킬 검증 파이프라인 (상세)

Client (로컬 시뮬)                    Server (KillValidator)
─────────────────                    ─────────────────────
1. 무기 발사 (로컬)
2. 히트 감지 (로컬 충돌)
3. 데미지 적용 (로컬)
4. HP ≤ 0 → 킬 판정 (로컬)
   │
   │ matrix_kill {
   │   targetId: "p2",
   │   weaponId: "cannon",
   │   damage: 45,
   │   distance: 150,
   │   tick: 12345
   │ }
   │──────────────────────────────►│
   │                                │ Step 1: Tick Validation
   │                                │   |server_tick - 12345| < 5?
   │                                │   (250ms 허용 오차)
   │                                │   FAIL → reject("tick_mismatch")
   │                                │
   │                                │ Step 2: Distance Validation
   │                                │   dist(killer.pos, target.pos)
   │                                │   < weaponRanges["cannon"] × 1.2?
   │                                │   (20% 네트워크 지연 허용)
   │                                │   FAIL → reject("distance")
   │                                │
   │                                │ Step 3: Cooldown Validation
   │                                │   lastFire["cannon"] + cooldownTicks
   │                                │   < server_tick?
   │                                │   FAIL → reject("cooldown")
   │                                │
   │                                │ Step 4: Damage Cap Validation
   │                                │   damage ≤ maxDamage["cannon"] × 1.1?
   │                                │   (10% 정밀도 허용 오차)
   │                                │   FAIL → reject("damage_exceeded")
   │                                │
   │                                │ Step 5: State Validation
   │                                │   killer.alive && target.alive?
   │                                │   (서버 세션 기준)
   │                                │   FAIL → reject("invalid_state")
   │                                │
   │                                │ Step 6: PvP Phase Validation
   │                                │   pvpEnabled == true?
   │                                │   killer.nation != target.nation?
   │                                │   NOT allies?
   │                                │   FAIL → reject("pvp_disabled")
   │                                │
   │  ┌─── 모두 통과 ──────────────│
   │  │                             │ scorer.AddKill(killerId, nation, 15)
   │  │                             │ target.session.alive = false
   │  │                             │
   │  │ matrix_kill_confirmed       │
   │  │ { killerId, targetId,       │
   │  │   score: 15, totalKills }   │
   │◄─┤────────────────────────────│
   │  │                             │
   │  │  ┌─── 하나라도 실패 ───────│
   │  │  │                          │ suspicion[killer] += 1
   │  │  │                          │ if suspicion >= 10:
   │  │  │                          │   autoKick(killer)
   │  │  │                          │   ban(killer, 24h)
   │  │  │                          │
   │  │  │ matrix_kill_rejected     │
   │  │  │ { reason: "distance" }   │
   │◄─┤──┤─────────────────────────│
   │  │  │                          │
   │  ▼  ▼                          │
   │  Client 처리:                   │
   │  - confirmed: 킬피드 표시,      │
   │    UI 업데이트                   │
   │  - rejected: 킬 롤백 (타겟      │
   │    HP 복원), suspicion 표시      │

Weapon Range Table (서버 권위적):
  cannon:  range=200px, cooldown=30ticks(1.5s), maxDmg=45
  laser:   range=300px, cooldown=40ticks(2s),   maxDmg=30
  orb:     range=120px, cooldown=10ticks(0.5s), maxDmg=20
  melee:   range=60px,  cooldown=5ticks(0.25s), maxDmg=55
  ...추가 무기는 matrix constants에서 import
```

### Data Flow — Token Reward Pipeline

```
토큰 보상 파이프라인 (에폭 종료 시)

OnlineMatrixEngine.OnEpochEnd(epochNum)
  │
  │ 1. ScoreAggregator.SnapshotAndReset()
  │    ├─ nationScores: { "KOR": 4500, "USA": 3200, "JPN": 2800 }
  │    ├─ playerScores: { "p1": {kills:5, level:12, damage:3400, survived:true}, ... }
  │    └─ snapshot → history[] (6-epoch ring buffer 유지)
  │
  │ 2. MVP 판정: playerScores 내 최고 득점자
  │
  │ 3. EpochRewardCalculator.Calculate(snapshot, sovereignty, epochPhase)
  │    │
  │    │ Per-player reward:
  │    │   rawScore = kills×15 + level×10 + damage×0.5 + (survived ? 100 : 0)
  │    │   baseReward = rawScore × 0.01  (DominationTokenBaseRate)
  │    │
  │    │ Multipliers (곱연산):
  │    │   × 2.0  if 전쟁 승리 국적 (지배 국적)
  │    │   × 1.5  if 에폭 MVP (1위)
  │    │   × 1.5  if 직접 플레이 (isDirectPlay && !isAgent)
  │    │   × 1.25 if top 3 (TopThreeBonusMultiplier)
  │    │
  │    │ Sovereignty/Hegemony bonus (덧연산):
  │    │   + 20%  if 주권 보유 국적
  │    │   + 50%  if 패권 보유 국적
  │    │
  │    │ Population adjustment:
  │    │   adjustedReward = reward / sqrt(nationPlayerCount)
  │    │   if nationPlayerCount <= 5: ×1.3 (언더독 보너스)
  │    │
  │    │ Caps:
  │    │   min(reward, DominationTokenMaxPayout=1000.0)
  │    │   dailyTotal + reward <= DailyPlayerRewardCap=5000.0
  │    │
  │    └─ []TokenRewardEvent
  │
  │ 4. TokenRewardManager.QueueRewards(events)
  │    ├─ FIFO 큐 추가 (MaxPendingRewards=1000, 초과 시 oldest evict)
  │    ├─ DB batch INSERT (에폭당 1회 벌크)
  │    └─ 온체인 전송 큐 (DefenseOracle.GetIssuanceMod() 적용)
  │
  │ 5. DefenseOracle 연동:
  │    issuanceMod = 1.0 - defBuff × 0.5  (최소 0.5)
  │    actualReward = reward × issuanceMod
  │    → 시가총액↑ → defBuff↑ → issuanceMod↓ → 발행량↓ (Anti-Inflation)
  │
  │ 6. 클라이언트 알림:
  │    matrix_result {
  │      rankings: [{nation,score,rank}...],
  │      rewards: [{playerId,tokenType,amount}...],
  │      mvp: {playerId,name,score}
  │    }

  DB 기록 (PostgreSQL):
  ┌─────────────────────────────────────────────────┐
  │ matrix_epoch_rewards                             │
  │ ├─ id (uuid)                                     │
  │ ├─ epoch_number (int)                            │
  │ ├─ country_code (varchar(3))                     │
  │ ├─ player_id (varchar)                           │
  │ ├─ nationality (varchar(3))                      │
  │ ├─ raw_score (int)                               │
  │ ├─ token_type (varchar) — "country" | "aww"      │
  │ ├─ token_amount (decimal)                        │
  │ ├─ multipliers (jsonb)                           │
  │ ├─ is_mvp (boolean)                              │
  │ ├─ created_at (timestamp)                        │
  │ └─ INDEX: (player_id, created_at DESC)           │
  └─────────────────────────────────────────────────┘
```

## API Design

### WebSocket Protocol Extension

기존 `ws.protocol.go`에 새 이벤트 상수를 추가합니다. 기존 이벤트는 일절 수정하지 않습니다.

#### 신규 WS 이벤트 상수 (server/internal/ws/protocol.go 추가)

```go
// --- Matrix events (client → server) ---
const (
    EventMatrixJoin      = "matrix_join"       // 국가 아레나 입장
    EventMatrixLeave     = "matrix_leave"      // 아레나 퇴장
    EventMatrixInput     = "matrix_input"      // 위치+입력 (10Hz)
    EventMatrixKill      = "matrix_kill"       // 킬 리포트
    EventMatrixDamage    = "matrix_damage"     // PvP 데미지 리포트
    EventMatrixCapture   = "matrix_capture"    // 캡처 포인트 진입
    EventMatrixLevelUp   = "matrix_level_up"   // 레벨업 스킬 선택
)

// --- Matrix events (server → client) ---
const (
    EventMatrixState         = "matrix_state"          // 월드 상태 (20Hz)
    EventMatrixEpoch         = "matrix_epoch"          // 에폭 전환 알림
    EventMatrixSpawnSeed     = "matrix_spawn_seed"     // 몬스터 스폰 시드
    EventMatrixKillConfirmed = "matrix_kill_confirmed" // 킬 확정
    EventMatrixKillRejected  = "matrix_kill_rejected"  // 킬 거부
    EventMatrixScore         = "matrix_score"          // 실시간 스코어
    EventMatrixResult        = "matrix_result"         // 에폭 결과
    EventMatrixCaptureState  = "matrix_capture_state"  // 캡처 포인트 상태
    EventMatrixBuff          = "matrix_buff"           // 활성 버프 목록
    EventMatrixLevelUpChoices = "matrix_level_up_choices" // 레벨업 선택지
    EventMatrixAgentState    = "matrix_agent_state"    // 에이전트 전용 상태
)
```

#### Uplink 페이로드 스키마 (Client → Server)

```typescript
// matrix_join
{ countryCode: string; build?: string; agentId?: string }

// matrix_leave
{}  // empty payload

// matrix_input (10Hz)
{ x: number; y: number; angle: number; boost: boolean; tick: number }

// matrix_kill
{ targetId: string; weaponId: string; damage: number; distance: number; tick: number }

// matrix_damage
{ targetId: string; weaponId: string; damage: number; tick: number }

// matrix_capture
{ pointId: string }  // "resource" | "buff" | "healing"

// matrix_level_up
{ choiceId: string }  // 서버에서 제공한 선택지 중 1개
```

#### Downlink 페이로드 스키마 (Server → Client)

```typescript
// matrix_state (20Hz, delta 가능)
{
  tick: number;
  phase: "peace" | "war_countdown" | "war" | "shrink" | "end" | "transition";
  timer: number;        // 현재 페이즈 남은 시간 (초)
  players: {
    id: string; x: number; y: number;
    hp: number; maxHp: number; level: number;
    nation: string; isAlly: boolean;
    weapons: string[]; status: string[];
  }[];
  captures: { id: string; owner: string | null; progress: number }[];
  nationScores: Record<string, number>;
  safeZoneRadius: number;
  fullSnapshot: boolean;  // true = 풀 스테이트, false = delta
}

// matrix_epoch
{ phase: EpochPhase; countdown: number; config: { pvpEnabled: boolean; orbMultiplier: number; shrinkRadius?: number } }

// matrix_spawn_seed
{ seed: string; waveId: number; tick: number }  // seed는 hex string

// matrix_kill_confirmed
{ killerId: string; targetId: string; score: number; totalKills: number }

// matrix_kill_rejected
{ reason: string }  // "tick_mismatch" | "distance" | "cooldown" | "damage_exceeded" | "invalid_state" | "pvp_disabled"

// matrix_score (5초마다)
{ nationScores: Record<string, number>; personalScore: number; rank: number; totalPlayers: number }

// matrix_result (에폭 종료)
{ rankings: { nation: string; score: number; rank: number }[]; rewards: { playerId: string; tokenType: string; amount: number }[]; mvp: { playerId: string; name: string; score: number } | null }

// matrix_capture_state
{ points: { id: string; owner: string | null; progress: number; buff?: string }[] }

// matrix_buff
{ tokenBuffs: { xpBoost: number; statBoost: number; specialSkills: string[] }; captureBuffs: { resource: boolean; buff: boolean; healing: boolean } }

// matrix_level_up_choices (서버 생성, 공정성 보장)
{ choices: { id: string; type: "skill" | "weapon"; name: string; description: string; tier: number }[] }

// matrix_agent_state (에이전트 전용, 10Hz)
{ tick: number; self: { x: number; y: number; hp: number; maxHp: number; level: number; weapons: string[]; status: string[] }; nearbyPlayers: { id: string; x: number; y: number; hp: number; nation: string; isAlly: boolean }[]; nearbyEnemies: { id: string; type: string; x: number; y: number; hp: number }[]; epochPhase: string; pvpEnabled: boolean; capturePoints: { id: string; owner: string | null; progress: number }[]; nationScores: Record<string, number> }
```

#### 대역폭 예산

| 이벤트 | 주기 | 예상 크기 | 50명 아레나 대역폭 |
|--------|------|----------|------------------|
| matrix_state (full) | 5초마다 | ~2KB | 2KB/5s |
| matrix_state (delta) | 20Hz | ~200B | 200KB/s |
| matrix_input (uplink) | 10Hz | ~60B | 30KB/s (50명) |
| matrix_score | 5초마다 | ~200B | trivial |
| matrix_spawn_seed | 30초마다 | ~50B | trivial |
| **총 아레나당** | | | **~250KB/s** |
| **10 활성 아레나** | | | **~2.5MB/s** |

Phase 8에서 MessagePack 적용 시 ~50% 절감 → ~1.25MB/s.

### REST API Extensions

기존 `/api/v11/*` REST API는 **100% 유지**. 새 API는 `/api/matrix/*` 네임스페이스 아래에 추가합니다.

#### 신규 REST 엔드포인트

```
GET /api/matrix/arenas
  Response: { arenas: { countryCode: string; playerCount: number; epochPhase: string; timer: number }[] }
  설명: 활성 아레나 목록 (Globe 로비에서 표시)

GET /api/matrix/arenas/{countryCode}
  Response: { countryCode: string; playerCount: number; epochPhase: string;
              nationScores: Record<string, number>; sovereignty: { nation: string; days: number } | null;
              capturePoints: { id: string; owner: string | null }[] }
  설명: 특정 아레나 상세 정보

GET /api/matrix/buffs?playerId={id}
  Response: { tokenBalance: number; buffs: { xpBoost: number; statBoost: number; specialSkills: string[] } }
  설명: 플레이어 토큰 버프 조회

GET /api/matrix/rewards?playerId={id}&period=day|week|season
  Response: { rewards: { epochNumber: number; tokenType: string; amount: number; createdAt: string }[];
              total: number; dailyRemaining: number }
  설명: 보상 히스토리 조회

GET /api/matrix/leaderboard?countryCode={cc}&period=epoch|day|season
  Response: { entries: { playerId: string; name: string; nation: string; score: number; kills: number }[] }
  설명: 아레나/국적별 리더보드

POST /api/matrix/deploy-agent
  Auth: Bearer {api_key}
  Body: { agentId: string; countryCode: string }
  Response: { success: boolean; cost: number; remainingOil: number }
  설명: 에이전트 아레나 배치 (50 Oil/에이전트, 최대 3마리)

DELETE /api/matrix/deploy-agent/{agentId}
  Auth: Bearer {api_key}
  Response: { success: boolean }
  설명: 에이전트 아레나 철수
```

#### router.go 수정 범위

기존 `newRouter()` 함수에 `/api/matrix` 라우트 그룹 추가:

```go
// v33: Matrix Online API routes
r.Route("/api/matrix", func(r chi.Router) {
    r.Get("/arenas", deps.MatrixHandler.ListArenas)
    r.Get("/arenas/{countryCode}", deps.MatrixHandler.GetArena)
    r.Get("/buffs", deps.MatrixHandler.GetBuffs)
    r.Get("/rewards", deps.MatrixHandler.GetRewards)
    r.Get("/leaderboard", deps.MatrixHandler.GetLeaderboard)
    r.With(deps.AgentAuthMiddleware).Post("/deploy-agent", deps.MatrixHandler.DeployAgent)
    r.With(deps.AgentAuthMiddleware).Delete("/deploy-agent/{agentId}", deps.MatrixHandler.WithdrawAgent)
})
```

#### RouterDeps 확장

```go
type RouterDeps struct {
    // ... 기존 필드 ...

    // v33: Matrix Online
    MatrixHandler *api.MatrixHandler  // ★ NEW
}
```

## Data Model

### Server-Side State Structures (Go)

#### Go 구조체 설계 (server/internal/game/)

```go
// ============== matrix_engine.go ==============

// OnlineMatrixEngine is the core server-side module for Online Matrix.
// Embedded in CountryArenaWrapper, one per active arena.
type OnlineMatrixEngine struct {
    mu           sync.RWMutex
    countryCode  string
    sessions     map[string]*PlayerSession  // clientID → session
    seedSync     *MonsterSeedSync
    validator    *KillValidator
    scorer       *ScoreAggregator
    rewarder     *EpochRewardCalculator
    buffApplier  *TokenBuffApplier
    currentTick  uint64
    pvpEnabled   bool
    shrinkRadius float64  // 3000 → 1000 during shrink phase

    // Callbacks (wired by CountryArenaManager)
    OnKillConfirmed func(arenaCode string, event MatrixKillConfirmed)
    OnKillRejected  func(clientID string, event MatrixKillRejected)
    OnStateUpdate   func(arenaCode string, state MatrixWorldState)
}

// ============== matrix_session.go ==============

// PlayerSession tracks per-player state in a Matrix arena.
type PlayerSession struct {
    ClientID     string    `json:"clientId"`
    Name         string    `json:"name"`
    Nationality  string    `json:"nationality"`
    X            float64   `json:"x"`
    Y            float64   `json:"y"`
    Angle        float64   `json:"angle"`
    HP           int       `json:"hp"`
    MaxHP        int       `json:"maxHp"`
    Level        int       `json:"level"`
    Kills        int       `json:"kills"`
    Deaths       int       `json:"deaths"`
    TotalDamage  float64   `json:"totalDamage"`
    Weapons      []string  `json:"weapons"`
    StatusEffects []string `json:"status"`
    Alive        bool      `json:"alive"`
    IsAgent      bool      `json:"isAgent"`
    IsDirectPlay bool      `json:"isDirectPlay"`
    TokenBalance float64   `json:"tokenBalance"`
    Buffs        TokenBuffs `json:"buffs"`
    JoinedAt     time.Time `json:"joinedAt"`
    LastInputTick uint64   `json:"lastInputTick"`
    LastFireTick  map[string]uint64 `json:"-"` // weaponId → last fire tick
}

// ============== matrix_seed.go ==============

// MonsterSeedSync manages deterministic monster spawning.
type MonsterSeedSync struct {
    currentSeed  uint64
    waveId       int
    epochId      int
    countryCode  string
    lastSeedTick uint64
    reseedInterval uint64 // 30초 = 600 ticks
}

// ============== matrix_validator.go ==============

// KillValidation is the result of a kill validation.
type KillValidation struct {
    Valid   bool   `json:"valid"`
    Reason  string `json:"reason,omitempty"`
}

// KillValidator validates kill/damage reports from clients.
type KillValidator struct {
    weaponRanges    map[string]float64   // weaponId → max range (px)
    weaponCooldowns map[string]uint64    // weaponId → cooldown (ticks)
    weaponMaxDamage map[string]float64   // weaponId → max damage
    suspicionScore  map[string]int       // clientID → suspicion count
    banThreshold    int                  // default 10
    maxSpeedPerTick float64              // MaxSpeedPerTick × 1.2 (tolerance)
    tickTolerance   uint64               // 5 ticks = 250ms
}

// ============== matrix_score.go ==============

// PlayerScore holds an individual's score breakdown.
type PlayerScore struct {
    PlayerID    string  `json:"playerId"`
    Name        string  `json:"playerName"`
    Nationality string  `json:"nationality"`
    Kills       int     `json:"kills"`
    Level       int     `json:"level"`
    Damage      float64 `json:"damage"`
    Survived    bool    `json:"survived"`
    RawScore    int     `json:"rawScore"`  // kills×15 + level×10 + damage×0.5 + survived×100
}

// ScoreSnapshot holds the frozen state at epoch end.
type ScoreSnapshot struct {
    EpochNumber  int                `json:"epochNumber"`
    NationScores map[string]int     `json:"nationScores"`
    PlayerScores []PlayerScore      `json:"playerScores"`
    MVP          *PlayerScore       `json:"mvp,omitempty"`
    Timestamp    time.Time          `json:"timestamp"`
}

// ScoreAggregator accumulates scores independently from NationScoreTracker.
type ScoreAggregator struct {
    mu            sync.RWMutex
    countryCode   string
    epochScores   map[string]int          // nationality → total score
    playerScores  map[string]*PlayerScore // clientID → score breakdown
    history       []ScoreSnapshot         // ring buffer, max 6
}

// ============== matrix_reward.go ==============

// MatrixReward represents a calculated reward for one player.
type MatrixReward struct {
    PlayerID     string  `json:"playerId"`
    PlayerName   string  `json:"playerName"`
    Nationality  string  `json:"nationality"`
    TokenType    string  `json:"tokenType"`  // "country" or "aww"
    Amount       float64 `json:"amount"`
    RawScore     int     `json:"rawScore"`
    Multipliers  RewardMultipliers `json:"multipliers"`
    IsMVP        bool    `json:"isMvp"`
}

// RewardMultipliers breaks down all multipliers applied.
type RewardMultipliers struct {
    WarVictory    float64 `json:"warVictory"`    // 2.0 or 1.0
    MVP           float64 `json:"mvp"`           // 1.5 or 1.0
    DirectPlay    float64 `json:"directPlay"`    // 1.5 or 1.0
    TopThree      float64 `json:"topThree"`      // 1.25 or 1.0
    Sovereignty   float64 `json:"sovereignty"`   // 1.2 or 1.0
    Hegemony      float64 `json:"hegemony"`      // 1.5 or 1.0
    PopAdjust     float64 `json:"popAdjust"`     // 1/sqrt(n) or 1.3 (underdog)
    IssuanceMod   float64 `json:"issuanceMod"`   // DefenseOracle (0.5~1.0)
}

// ============== matrix_buff.go ==============

// TokenBuffs represents active in-game buffs from token holdings.
type TokenBuffs struct {
    XPBoost       float64  `json:"xpBoost"`       // 0.10 ~ 0.20
    StatBoost     float64  `json:"statBoost"`      // 0.0 ~ 0.10
    SpecialSkills []string `json:"specialSkills"`  // "rally", "inspire"
}

// BuffTier defines a token holding tier and its buffs.
type BuffTier struct {
    MinBalance    float64  `json:"minBalance"`
    XPBoost       float64  `json:"xpBoost"`
    StatBoost     float64  `json:"statBoost"`
    SpecialSkills []string `json:"specialSkills"`
}
```

#### CountryArenaWrapper 확장 (country_arena.go)

```go
type CountryArenaWrapper struct {
    CountryCode    string
    CountryName    string
    Room           *Room
    Epoch          *EpochManager
    Respawn        *RespawnManager
    CapturePoints  *CapturePointSystem
    Domination     *DominationEngine
    NationScore    *NationScoreTracker
    Sovereignty    *SovereigntyTracker   // ★ v33 추가
    MatrixEngine   *OnlineMatrixEngine   // ★ v33 추가
    PlayerCount    int
}
```

### Client-Side State Structures (TypeScript)

#### TypeScript 타입 설계

```typescript
// ============== apps/web/lib/matrix/online/types.ts ==============

/** 온라인 모드에서의 리모트 플레이어 */
export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  prevX: number;    // 보간용 이전 위치
  prevY: number;
  hp: number;
  maxHp: number;
  level: number;
  nation: string;
  isAlly: boolean;
  weapons: string[];
  status: string[];
  lastUpdateTick: number;
}

/** 서버에서 수신하는 월드 상태 */
export interface MatrixWorldState {
  tick: number;
  phase: EpochPhase;
  timer: number;
  players: RemotePlayerState[];
  captures: CapturePointState[];
  nationScores: Record<string, number>;
  safeZoneRadius: number;
  fullSnapshot: boolean;
}

export type EpochPhase = 'peace' | 'war_countdown' | 'war' | 'shrink' | 'end' | 'transition';

export interface RemotePlayerState {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  nation: string;
  isAlly: boolean;
  weapons: string[];
  status: string[];
}

export interface CapturePointState {
  id: string;           // "resource" | "buff" | "healing"
  owner: string | null;
  progress: number;     // 0.0 ~ 1.0
  buff?: string;
}

/** 에폭 결과 */
export interface MatrixResult {
  rankings: { nation: string; score: number; rank: number }[];
  rewards: { playerId: string; tokenType: string; amount: number }[];
  mvp: { playerId: string; name: string; score: number } | null;
}

/** 킬 리포트 (uplink) */
export interface MatrixKillReport {
  targetId: string;
  weaponId: string;
  damage: number;
  distance: number;
  tick: number;
}

/** 레벨업 선택지 (downlink) */
export interface LevelUpChoice {
  id: string;
  type: 'skill' | 'weapon';
  name: string;
  description: string;
  tier: number;
}

/** 토큰 버프 */
export interface TokenBuffState {
  tokenBuffs: {
    xpBoost: number;
    statBoost: number;
    specialSkills: string[];
  };
  captureBuffs: {
    resource: boolean;
    buff: boolean;
    healing: boolean;
  };
}

// ============== aww-agent-skill/src/types.ts 확장 ==============

/** Matrix 에이전트 상태 (10Hz, 기존 AgentState와 별개) */
export interface MatrixAgentState {
  tick: number;
  self: {
    x: number; y: number;
    hp: number; maxHp: number;
    level: number;
    weapons: string[];
    status: string[];
  };
  nearbyPlayers: {
    id: string; x: number; y: number;
    hp: number; nation: string; isAlly: boolean;
  }[];
  nearbyEnemies: {
    id: string; type: string;
    x: number; y: number; hp: number;
  }[];
  epochPhase: string;
  pvpEnabled: boolean;
  capturePoints: CapturePointState[];
  nationScores: Record<string, number>;
}

/** Matrix 에이전트 입력 (기존 AgentInput과 별개) */
export interface MatrixAgentInput {
  x: number;
  y: number;
  angle: number;
  boost: boolean;
}
```

### Database Schema Extensions

#### PostgreSQL 스키마 확장

```sql
-- ============================================================
-- v33: Matrix Online — New Tables
-- ============================================================

-- 에폭별 보상 기록 (에폭당 최대 50명 × 195 아레나 = 9,750 rows)
-- 배치 INSERT로 에폭당 1회 벌크 기록
CREATE TABLE matrix_epoch_rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epoch_number    INT NOT NULL,
    country_code    VARCHAR(3) NOT NULL,
    player_id       VARCHAR(64) NOT NULL,
    player_name     VARCHAR(64),
    nationality     VARCHAR(3) NOT NULL,
    raw_score       INT NOT NULL DEFAULT 0,
    token_type      VARCHAR(10) NOT NULL,   -- 'country' | 'aww'
    token_amount    DECIMAL(18,6) NOT NULL DEFAULT 0,
    multipliers     JSONB,                  -- RewardMultipliers JSON
    is_mvp          BOOLEAN NOT NULL DEFAULT FALSE,
    is_agent        BOOLEAN NOT NULL DEFAULT FALSE,
    is_direct_play  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matrix_rewards_player ON matrix_epoch_rewards(player_id, created_at DESC);
CREATE INDEX idx_matrix_rewards_country ON matrix_epoch_rewards(country_code, epoch_number);
CREATE INDEX idx_matrix_rewards_daily ON matrix_epoch_rewards(player_id, created_at)
    WHERE created_at > NOW() - INTERVAL '1 day';  -- 일일 상한 조회 최적화

-- 플레이어 일일 보상 합계 캐시 (DailyPlayerRewardCap 체크용)
CREATE TABLE matrix_daily_reward_totals (
    player_id   VARCHAR(64) NOT NULL,
    date        DATE NOT NULL,
    total_tokens DECIMAL(18,6) NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, date)
);

-- 에이전트 아레나 배치 기록
CREATE TABLE matrix_agent_deployments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    VARCHAR(64) NOT NULL,
    owner_id    VARCHAR(64) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    oil_cost    DECIMAL(18,6) NOT NULL DEFAULT 50.0,
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_agent_deploy_owner ON matrix_agent_deployments(owner_id, is_active);
CREATE INDEX idx_agent_deploy_country ON matrix_agent_deployments(country_code, is_active);

-- 안티치트 로그 (suspicion 이력)
CREATE TABLE matrix_anticheat_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   VARCHAR(64) NOT NULL,
    event_type  VARCHAR(32) NOT NULL,  -- 'kill_rejected', 'speed_violation', 'auto_ban'
    reason      VARCHAR(128),
    suspicion_score INT NOT NULL DEFAULT 0,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anticheat_player ON matrix_anticheat_log(player_id, created_at DESC);

-- 에폭 스냅샷 (DominationEngine 연동, 6-epoch history 보존)
CREATE TABLE matrix_epoch_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code    VARCHAR(3) NOT NULL,
    epoch_number    INT NOT NULL,
    nation_scores   JSONB NOT NULL,         -- Record<string, number>
    player_scores   JSONB NOT NULL,         -- PlayerScore[]
    mvp_player_id   VARCHAR(64),
    dominant_nation VARCHAR(3),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_code, epoch_number)
);
```

#### Redis 키 설계

```
# 실시간 아레나 상태 (TTL: 활성 아레나는 무제한, 비활성은 5분)
matrix:arena:{countryCode}:state       → JSON (MatrixWorldState)
matrix:arena:{countryCode}:players     → HASH (clientID → PlayerSession JSON)
matrix:arena:{countryCode}:scores      → HASH (nationality → score)

# 플레이어 토큰 보유량 캐시 (TTL: 5분)
matrix:player:{playerId}:tokens        → JSON { balance, buffs }

# 일일 보상 합계 (TTL: 26시간, 자정 리셋)
matrix:daily:{playerId}:{date}         → FLOAT (total tokens today)

# 에이전트 배치 현황 (TTL: 무제한)
matrix:deployments:{ownerId}           → SET (agentId:countryCode)

# 안티치트 suspicion (TTL: 1시간 — 자연 감소)
matrix:suspicion:{clientId}            → INT (suspicion count)

# 활성 아레나 목록 (Globe 로비용, 1Hz 갱신)
matrix:active_arenas                   → ZSET (countryCode → playerCount)
```

## Security Considerations

### 위협 모델 (STRIDE + 게임 특화)

| # | 위협 유형 | 공격 벡터 | 영향 | 대응 | 구현 위치 |
|---|----------|----------|------|------|----------|
| T1 | **Speed Hack** (Tampering) | 클라이언트 메모리 조작으로 이동속도 증가 | 부당한 위치 선점, 파밍 효율 증가 | `KillValidator.CheckSpeed()`: 서버가 `|pos_delta| / tick_delta > MaxSpeedPerTick × 1.2` 체크. 3회 연속 위반 → suspicion +3 | `matrix_validator.go` |
| T2 | **Kill Forge** (Tampering) | 위조된 matrix_kill 이벤트 전송 | 부당한 Nation Score + 토큰 보상 | `KillValidator.Validate()`: 6단계 검증 (tick/distance/cooldown/damage/state/pvp). 실패 → suspicion +1, ≥10 → 자동 밴 | `matrix_validator.go` |
| T3 | **Damage Hack** (Tampering) | 무기 데미지 값 조작 | PvP 원킬, 부당 킬 | `weaponMaxDamage` 테이블 기준 `damage ≤ max × 1.1` (10% 허용 오차) | `matrix_validator.go` |
| T4 | **Bot Farming** (Spoofing) | 자동 봇 계정으로 24/7 파밍 | 토큰 인플레이션 | 계정 레벨 3 필수, 주기적 CAPTCHA, 에이전트는 50 Oil 배치비 | `matrix_engine.go`, auth middleware |
| T5 | **Win Trading** (Tampering) | 같은 소유자의 복수 계정이 담합 킬 | Nation Score 조작 | 같은 IP/디바이스 동일 팩션 제한, 반복 킬 패턴 분석 (동일 쌍 3회/에폭 → 경고) | `matrix_validator.go` |
| T6 | **Replay Attack** (Spoofing) | 이전 에폭의 킬 이벤트 재전송 | 이중 보상 | tick 검증: `|server_tick - client_tick| < 5` (250ms), 에폭 전환 시 모든 pending kill 무효화 | `matrix_validator.go` |
| T7 | **Token Inflation** (Elevation) | 시스템적 과잉 보상 | 경제 붕괴 | DefenseOracle (시가총액↑→발행량↓), 일일 5,000 상한, FIFO 큐 1,000 상한 | `matrix_reward.go`, `token_rewards.go` |
| T8 | **WS Flood** (DoS) | 대량 matrix_input/kill 전송 | 서버 CPU 과부하 | 기존 `ws.ConnLimiter` 활용 + matrix_input 10Hz 상한 (초과 무시), matrix_kill 1Hz 상한 | `matrix_handler.go` |
| T9 | **State Desync** (Information Disclosure) | 의도적 입력 지연으로 서버/클라이언트 불일치 유도 | 유령 킬, 위치 오류 | 250ms 허용 오차 초과 시 kill reject, 풀 스냅샷 5초마다 강제 동기화 | `matrix_engine.go` |
| T10 | **Wash Trading** (Tampering) | 토큰 가격 조작을 위한 세탁 거래 | DEX 가격 왜곡 | TWAP 가격 (1시간 이동평균), 시즈 시 48시간 전송 잠금 | `blockchain/*` (기존) |

### Suspicion Score 시스템

```
suspicion 누적 규칙:
  - kill_rejected (거리/쿨다운/데미지): +1
  - speed_violation: +3
  - win_trading_pattern: +5
  - replay_attack: +5

임계값:
  - suspicion >= 5:  "WARNING" 경고 메시지 (matrix_buff 이벤트에 포함)
  - suspicion >= 10: 자동 킥 + 24시간 밴 + DB 기록
  - suspicion >= 20: 영구 밴 검토 (수동)

감소:
  - Redis TTL 1시간 → 자연 감소
  - 정상 에폭 완료 시: -1 (최소 0)
```

### 인증 흐름

```
[Human Player]
  1. Globe 로비에서 국가 클릭
  2. 기존 auth middleware (세션 쿠키 or JWT) 검증
  3. matrix_join WS 이벤트 → 서버 세션 검증
  4. AccountLevel >= 3 체크
  5. PlayerSession 생성

[AI Agent]
  1. MatrixGameClient.connect(url, apiKey)
  2. agent_auth WS 이벤트 (기존 인증 플로우)
  3. matrix_join { agentId: "...", countryCode: "..." }
  4. 배치 비용 차감 (50 Oil)
  5. PlayerSession 생성 (isAgent=true)
```

## Scalability

### 확장성 설계

#### 부하 프로파일 (최대 동시)

| 메트릭 | 값 | 계산 근거 |
|--------|-----|----------|
| 최대 동시 아레나 | 195 (이론) / 10~30 (실질 활성) | Lazy init, 비활성 아레나는 틱 다운그레이드 |
| 아레나당 최대 플레이어 | 50 | `maxPlayersPerArena` 제한 |
| 최대 동시 플레이어 | ~1,500 (30 아레나 × 50) | Railway 단일 인스턴스 한계 |
| 서버 틱 레이트 | 20Hz (활성), 1Hz (비활성) | 비활성 아레나 다운그레이드 |
| Uplink 빈도 | 10Hz/플레이어 | matrix_input 전송 주기 |
| Downlink 빈도 | 20Hz/아레나 | matrix_state 브로드캐스트 |

#### 확장 전략

**1. Lazy Arena Initialization (기존 구현 활용)**
```
GetOrCreateArena(countryCode) → 첫 플레이어 입장 시에만 초기화
  - 고루틴 할당: 활성 아레나만
  - 메모리: ~2MB/아레나 (50 세션 × ~40KB + 엔진 상태)
  - 비활성 전환: 5분간 0명 → 틱 1Hz로 다운그레이드
  - GC: 30분간 0명 → 아레나 해제 (메모리 회수)
```

**2. Tick Budget (20Hz, 50ms/tick)**
```
Per-tick budget allocation (50ms):
  - 위치 검증 (50 players):     ~2ms (단순 연산)
  - 킬 검증 (평균 2건/tick):     ~0.5ms
  - 스코어 집계:                 ~0.1ms
  - 상태 직렬화 (JSON):          ~3ms (50 players × 100B)
  - WS 브로드캐스트:             ~2ms (gorilla write)
  - 에폭 관리:                   ~0.1ms
  - 캡처 포인트:                 ~0.1ms
  ─────────────────────────────────
  Total:                         ~8ms/tick/arena
  Budget remaining:              42ms (충분한 여유)

  30 활성 아레나 시: ~240ms/tick → 1 코어로 처리 불가
  → 각 아레나 별도 고루틴 (Go 스케줄러 자동 분배)
```

**3. Delta Compression (Phase 2 기본 구현)**
```
Full snapshot: 5초마다 (50 players × ~100B = ~5KB)
Delta: 20Hz (변경된 필드만, 평균 ~200B)
  - 위치 변경: 이전 tick 대비 x,y 변경분 > 1px인 플레이어만
  - HP 변경: 데미지/힐 발생한 플레이어만
  - 상태 변경: status effect 변경된 플레이어만

절감: ~80% (5KB → ~1KB 평균)
Phase 8에서 MessagePack 적용 시 추가 ~50% 절감
```

**4. 뷰포트 컬링 (서버 사이드)**
```
matrix_state에 포함할 players[] 선정:
  - 요청 플레이어의 (x, y) 기준
  - 반경 2000px 이내 플레이어만 전송
  - 50명 중 시야 안: 평균 ~15명 (70% 절감)
  - 미니맵용 전체 위치는 matrix_score에 1Hz로 포함
```

**5. 수직 확장 한계 및 수평 확장 경로 (v33 범위 밖)**
```
현재 (Railway 단일 인스턴스):
  - CPU: 4 vCPU → 30 활성 아레나 안정 (Go 고루틴 효율)
  - RAM: 8GB → ~60MB (30 아레나 × 2MB)
  - Network: 1Gbps → 2.5MB/s (30 아레나, 충분)

미래 수평 확장 (필요 시):
  - 아레나 단위 샤딩: continent별 서버 분리
  - Redis Pub/Sub로 크로스 서버 이벤트
  - 기획서 R1 완화 전략 그대로 적용
```

## Reliability

### 신뢰성 설계

#### 장애 시나리오 및 복구

| 시나리오 | 영향 | 복구 전략 | RTO |
|----------|------|----------|-----|
| 서버 크래시 | 모든 아레나 중단, 진행 중 에폭 손실 | Railway 자동 재시작, 에폭 스냅샷에서 복구 불가 (ephemeral 게임 상태), 재접속 시 새 에폭부터 | <30s |
| WS 연결 끊김 (개별) | 1명 접속 해제 | 클라이언트 `GameSocket` 자동 재연결 (exponential backoff, 최대 5회), 세션 30초 유지 후 GC | <5s |
| Redis 다운 | 토큰 캐시 미스, 일일 상한 검증 실패 | Fallback: DB 직접 조회 (느리지만 동작), 보상 지급은 DB 기준 | <10s |
| DB 연결 풀 고갈 | 보상 기록 실패 | 보상 큐(FIFO 1000) 임시 저장, 연결 복구 후 일괄 flush | <60s |
| 에폭 타이머 드리프트 | 클라이언트/서버 시간 불일치 | 서버 권위적 타이머, 클라이언트는 matrix_epoch로 보정, NTP 의존 없음 | N/A |

#### 데이터 일관성 보장

```
에폭 보상 기록 트랜잭션:
  BEGIN;
    -- 1. 보상 기록 벌크 INSERT
    INSERT INTO matrix_epoch_rewards (epoch_number, ...) VALUES (...), (...), ...;
    -- 2. 일일 합계 업데이트
    INSERT INTO matrix_daily_reward_totals (player_id, date, total_tokens)
    VALUES ($1, $2, $3)
    ON CONFLICT (player_id, date)
    DO UPDATE SET total_tokens = matrix_daily_reward_totals.total_tokens + $3;
    -- 3. 에폭 스냅샷 기록
    INSERT INTO matrix_epoch_snapshots (...) VALUES (...);
  COMMIT;
  -- 실패 시: 에폭 보상 전체 롤백, 다음 에폭에서 재시도 불가 (손실 허용)
```

#### 세션 복구 (재접속)

```
플레이어 재접속 플로우:
  1. GameSocket 자동 재연결 (5회 시도)
  2. matrix_join 재전송 (동일 countryCode)
  3. 서버: 기존 세션 존재 확인
     - 있음 (30초 이내): 세션 복원, 현재 에폭 상태 전송
     - 없음 (30초 초과): 새 세션 생성, 진행 중 에폭 중간 합류
  4. 풀 스냅샷 즉시 전송 (matrix_state fullSnapshot=true)
  5. 시드 재전송 (matrix_spawn_seed)
```

#### Graceful Shutdown

```
서버 종료 시:
  1. 새 matrix_join 거부 (503)
  2. 진행 중 에폭의 현재 스코어 스냅샷 저장 (matrix_epoch_snapshots)
  3. 모든 클라이언트에 matrix_epoch { phase: "transition" } 전송
  4. 5초 대기 (drain period)
  5. WS 연결 종료
  6. Go 서버 shutdown
```

## Observability

### 관측성 설계

#### 메트릭 (Prometheus 호환, 기존 observability 패키지 확장)

```go
// server/internal/observability/matrix_metrics.go

// 아레나 메트릭
matrix_active_arenas_total          gauge    // 현재 활성 아레나 수
matrix_arena_players{country}       gauge    // 아레나별 플레이어 수
matrix_arena_tick_duration_ms{country} histogram // 틱 처리 시간

// 에폭 메트릭
matrix_epoch_total{country}         counter  // 완료된 에폭 수
matrix_epoch_duration_sec{country}  histogram // 실제 에폭 소요 시간

// 킬 검증 메트릭
matrix_kill_reports_total           counter  // 총 킬 리포트 수
matrix_kill_confirmed_total         counter  // 검증 통과
matrix_kill_rejected_total{reason}  counter  // 거부 (사유별)
matrix_kill_validation_latency_us   histogram // 검증 소요 시간

// 안티치트 메트릭
matrix_suspicion_events_total{type} counter  // suspicion 이벤트 (유형별)
matrix_auto_bans_total              counter  // 자동 밴 수

// 네트워크 메트릭
matrix_ws_messages_sent_total{event}   counter  // 전송 WS 메시지 (이벤트별)
matrix_ws_messages_recv_total{event}   counter  // 수신 WS 메시지 (이벤트별)
matrix_ws_bytes_sent_total             counter  // 전송 바이트
matrix_state_packet_size_bytes         histogram // matrix_state 패킷 크기

// 토큰 보상 메트릭
matrix_rewards_distributed_total{type}  counter  // 분배된 보상 (토큰 타입별)
matrix_rewards_amount_total{type}       counter  // 분배된 토큰량
matrix_daily_cap_hits_total             counter  // 일일 상한 도달 횟수
```

#### 로깅 (slog 기반, 기존 패턴 유지)

```go
// 구조화 로깅 필드
slog.With(
    "component", "matrix_engine",
    "country", countryCode,
    "epoch", epochNumber,
    "players", playerCount,
)

// 로그 레벨 가이드
INFO:  에폭 시작/종료, 플레이어 입장/퇴장, 보상 지급
WARN:  킬 거부, suspicion 증가, 속도 위반
ERROR: 보상 DB 기록 실패, WS 전송 실패, 시드 생성 오류
DEBUG: 틱별 상태 (20Hz — 프로덕션에서 비활성화)
```

#### 헬스체크 확장

기존 `GET /health` 응답에 Matrix 메트릭 추가:

```go
type healthResponse struct {
    // ... 기존 필드 ...
    MatrixArenas   int `json:"matrixArenas"`   // ★ 활성 Matrix 아레나 수
    MatrixPlayers  int `json:"matrixPlayers"`  // ★ Matrix 총 접속 플레이어
}
```

#### 알림 규칙 (권장)

```yaml
# 서버 부하 경고
- alert: MatrixHighTickLatency
  expr: matrix_arena_tick_duration_ms > 30  # 50ms 예산의 60%
  for: 2m
  severity: warning

# 안티치트 폭증
- alert: MatrixHighSuspicion
  expr: rate(matrix_suspicion_events_total[5m]) > 10
  for: 1m
  severity: critical

# 보상 파이프라인 장애
- alert: MatrixRewardBacklog
  expr: matrix_rewards_pending > 800  # 1000 한도의 80%
  for: 5m
  severity: warning
```

## Architecture Decision Records

### ADR-001: Hybrid Authority Model (서버 권위적 하이브리드)

**Status**: Accepted

**Context**: Matrix 게임의 55개 스킬, 20+ 무기, 150+ 적 타입, 물리/충돌 시스템을 서버에서 50명분 완전 시뮬레이션하면 Go 서버 부하가 극심합니다. 반면 완전 클라이언트 시뮬은 치팅에 취약합니다.

**Decision**: 클라이언트가 자기 캐릭터를 로컬 시뮬레이션하고, 서버가 결과(킬, 데미지, 위치)를 검증하는 하이브리드 모델을 채택합니다. 서버는 물리/충돌을 시뮬레이션하지 않고, KillValidator로 결과만 판정합니다.

**Consequences**:
- (+) 서버 부하 대폭 감소 (물리 시뮬 불필요)
- (+) 클라이언트 60fps 즉각 반응 유지
- (-) 완벽한 치팅 방지 불가 (메모리 조작 등)
- (-) 킬 확정에 ~100ms 지연 (서버 RTT)
- Mitigations: KillValidator 6단계 검증 + suspicion score 시스템

---

### ADR-002: Deterministic Seeded Spawning (시드 기반 결정론적 스폰)

**Status**: Accepted

**Context**: 50명의 클라이언트가 동일한 몬스터를 보려면 동기화가 필요합니다. 서버가 매 몬스터를 직접 스폰 명령으로 전송하면 대역폭이 폭증합니다.

**Decision**: 서버가 RNG 시드만 배포하고 (30초마다 `matrix_spawn_seed`), 모든 클라이언트가 동일 시드로 로컬 스폰합니다. 기존 `spawning.ts`의 `Math.random()` → 시드 RNG 라이브러리로 래핑합니다.

**Alternatives Considered**:
1. 서버 직접 스폰 명령: 확실하지만 대역폭 5x 증가
2. 클라이언트 독립 스폰: 불일치 문제 (PvE 공정성 깨짐)

**Consequences**:
- (+) 대역폭 최소화 (50B/30초 vs ~5KB/초)
- (+) 모든 클라이언트 동일한 PvE 환경
- (-) `spawning.ts` 리팩토링 필요 (Math.random → seeded)
- (-) 엔티티 ID 스키마 변경 (`Math.random().toString()` → `seed+wave+index`)
- (-) 고정소수점 RNG 필요 (부동소수점 불일치 방지)

---

### ADR-003: Independent ScoreAggregator (독립 스코어 집계)

**Status**: Accepted

**Context**: 기존 `NationScoreTracker.Reset()`이 에폭마다 호출됩니다. 에폭 종료 시 보상 계산에 필요한 스코어가 Reset과 동시에 사라질 수 있습니다.

**Decision**: `ScoreAggregator`를 `NationScoreTracker`와 독립적으로 운영합니다. `OnEpochEnd` 시점에 스냅샷 저장 후 별도 Reset을 호출하여 데이터 손실을 방지합니다.

**Consequences**:
- (+) 보상 계산 시 확실한 데이터 보장
- (+) 6-epoch 히스토리 독립 유지 (DominationEngine 영향 없음)
- (-) 메모리 약간 증가 (중복 저장)

---

### ADR-004: WS Event Namespace (matrix_ 접두사)

**Status**: Accepted

**Context**: 기존 WS 이벤트 (join_room, state, kill 등)와 Matrix 이벤트가 충돌하면 안 됩니다.

**Decision**: 모든 Matrix 이벤트에 `matrix_` 접두사를 붙여 네임스페이스를 분리합니다. 기존 이벤트는 일절 수정하지 않습니다.

**Consequences**:
- (+) 기존 시스템과 완전 격리 (하위 호환 100%)
- (+) 점진적 마이그레이션 가능
- (-) 이벤트 이름이 길어짐

---

### ADR-005: Server-Side Level Up Choices (서버 레벨업 선택지)

**Status**: Accepted

**Context**: 현재 `useSkillBuild` 훅이 `Math.random()`으로 레벨업 선택지를 클라이언트에서 생성합니다. 온라인에서는 공정성 문제가 됩니다.

**Decision**: 서버에서 `matrix_level_up_choices` 이벤트로 선택지를 전송하고, 클라이언트는 `matrix_level_up`으로 선택을 보고합니다.

**Consequences**:
- (+) 모든 플레이어 동등한 선택지 확률
- (+) 서버에서 빌드 밸런싱 가능 (동적 확률 조정)
- (-) 레벨업 시 ~100ms 지연 (서버 RTT)
- (-) 오프라인 모드와 온라인 모드 로직 분기 필요

## Implementation Mapping

기획서(plan) Phase 1~8 → 아키텍처 컴포넌트 매핑.

### Phase 1: 서버 OnlineMatrixEngine 코어
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| PlayerSession 구현 | `PlayerSession` struct | `server/internal/game/matrix_session.go` | — |
| MonsterSeedSync 구현 | `MonsterSeedSync` struct | `server/internal/game/matrix_seed.go` | — |
| KillValidator 구현 | `KillValidator` struct | `server/internal/game/matrix_validator.go` | PlayerSession |
| ScoreAggregator 구현 | `ScoreAggregator` struct | `server/internal/game/matrix_score.go` | PlayerSession |
| EpochRewardCalculator 구현 | `EpochRewardCalculator` struct | `server/internal/game/matrix_reward.go` | ScoreAggregator, TokenRewardManager, DefenseOracle |
| TokenBuffApplier 구현 | `TokenBuffApplier` struct + `BuffTier[]` | `server/internal/game/matrix_buff.go` | — |

### Phase 2: WebSocket 프로토콜 확장
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| matrix 이벤트 라우터 | `MatrixHandler` (ws 패키지) | `server/internal/ws/matrix_handler.go` | OnlineMatrixEngine |
| Uplink 처리 | MatrixHandler 메서드 | 위 파일 | KillValidator, PlayerSession |
| Downlink 브로드캐스터 | MatrixHandler + Hub.Roomcast | 위 파일 | OnlineMatrixEngine.GetWorldState() |
| CountryArena 통합 | CountryArenaWrapper 확장 | `server/internal/game/country_arena.go` 수정 | Phase 1 전체 |
| 에폭 연동 | EpochManager → MatrixEngine 콜백 | `country_arena.go` wiring | EpochManager (기존) |

### Phase 3: 클라이언트 온라인 연결 레이어
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| MatrixSocket 훅 | `useMatrixSocket` 커스텀 훅 | `apps/web/hooks/useMatrixSocket.ts` | GameSocket (기존) |
| 서버 상태 동기화 | `OnlineSyncSystem` 클래스 | `apps/web/lib/matrix/online/online-sync.ts` | useMatrixSocket |
| 시드 RNG 라이브러리 도입 | `SeededSpawning` 클래스 | `apps/web/lib/matrix/online/seeded-spawning.ts` | seedrandom npm |
| MatrixApp 온라인 모드 분기 | MatrixApp.tsx 수정 | `apps/web/components/game/matrix/MatrixApp.tsx` | Phase 3 전체 |
| 클라이언트 예측/보정 | `ClientPrediction` 클래스 | `apps/web/lib/matrix/online/client-prediction.ts` | OnlineSyncSystem |
| 킬 리포트 시스템 | `KillReporter` 클래스 | `apps/web/lib/matrix/online/kill-reporter.ts` | useMatrixSocket |
| 레벨업 서버화 | 서버 ↔ 클라이언트 이벤트 연결 | MatrixApp.tsx + useMatrixSocket | — |
| 에폭 UI 연동 | `EpochUIBridge` 클래스 | `apps/web/lib/matrix/online/epoch-ui-bridge.ts` | useMatrixSocket |

### Phase 4: 멀티플레이어 렌더링
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| 다른 플레이어 렌더링 | Canvas 2D renderer 확장 | `apps/web/lib/matrix/rendering/` 수정 | OnlineSyncSystem |
| 위치 보간 | OnlineSyncSystem.interpolatePlayers() | `online-sync.ts` | — |
| PvP 전투 시각효과 | 새 렌더러 모듈 | `apps/web/lib/matrix/rendering/pvp-effects.ts` | — |
| 네임태그 + 국적 | 렌더러 확장 | rendering 수정 | — |
| 뷰포트 컬링 최적화 | 서버 사이드 컬링 + 클라이언트 렌더 컬링 | 양쪽 수정 | — |

### Phase 5: 에폭 HUD + 스코어보드
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| EpochHUD 리디자인 | React 컴포넌트 | `apps/web/components/game/matrix/EpochHUD.tsx` | EpochUIBridge |
| 국가 스코어보드 | React 컴포넌트 | `apps/web/components/game/matrix/NationScoreboard.tsx` | OnlineSyncSystem |
| 캡처 포인트 UI | React 컴포넌트 | 미니맵 + 캡처 UI | OnlineSyncSystem |
| 에폭 결과 화면 | React 컴포넌트 | `apps/web/components/game/matrix/EpochResult.tsx` | useMatrixSocket |
| 토큰 버프 표시 | React 컴포넌트 | buff overlay | useMatrixSocket |

### Phase 6: 토큰 경제 연동
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| 보상 지급 플로우 | EpochRewardCalculator → TokenRewardManager | `matrix_reward.go`, `token_rewards.go` | Phase 1 |
| 토큰 버프 조회 API | `MatrixHandler.GetBuffs()` | `server/internal/api/matrix_handler.go` | TokenBuffApplier |
| 토큰 보유량 캐시 | Redis 키 `matrix:player:*:tokens` | DB + Redis 레이어 | Redis |
| 보상 히스토리 UI | React 페이지 | `apps/web/app/(hub)/economy/rewards/page.tsx` | REST API |
| 일일 상한 적용 | `matrix_daily_reward_totals` 테이블 | `matrix_reward.go` | DB |

### Phase 7: 에이전트 SDK 통합
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| MatrixGameClient | `MatrixGameClient` class | `aww-agent-skill/src/matrix-client.ts` | Phase 2 (WS 프로토콜) |
| MatrixStrategy | `MatrixStrategy` interface + 3 adapters | `aww-agent-skill/src/matrix-strategy.ts` | MatrixGameClient |
| matrix_agent_state | 서버 핸들러 + 타입 | `ws/matrix_handler.go`, `types.ts` | Phase 2 |
| LLM 국가 배치 | MetaClient 확장 (기존 REST 호환) | `aww-agent-skill/src/meta-client.ts` 수정 | — |
| 에이전트 배치 비용 | REST API + DB | `api/matrix_handler.go`, DB 테이블 | Phase 6 |
| 서버 에이전트 핸들러 | `MatrixHandler.OnAgentInput()` | `ws/matrix_handler.go` | KillValidator |

### Phase 8: 통합 테스트 + 성능 최적화
| Task | 아키텍처 컴포넌트 | 파일 | 의존성 |
|------|-----------------|------|--------|
| 멀티플레이어 통합 테스트 | E2E 테스트 | `server/internal/game/matrix_test.go` | Phase 1~7 전체 |
| 서버 부하 테스트 | 벤치마크 | `server/internal/game/matrix_bench_test.go` | Phase 1~2 |
| Delta compression | MessagePack 적용 | `ws/matrix_handler.go` 수정 | Phase 2 |
| 클라이언트 성능 | 렌더러 최적화 | rendering 수정 | Phase 4 |
| 안티치트 통합 테스트 | KillValidator 테스트 | `matrix_validator_test.go` | Phase 1 |
| 빌드 최종 검증 | CI/CD | — | Phase 1~7 |

### 신규 파일 목록 (전체)

```
서버 (Go):
  server/internal/game/matrix_engine.go       — OnlineMatrixEngine (오케스트레이터)
  server/internal/game/matrix_session.go      — PlayerSession
  server/internal/game/matrix_seed.go         — MonsterSeedSync
  server/internal/game/matrix_validator.go    — KillValidator
  server/internal/game/matrix_score.go        — ScoreAggregator
  server/internal/game/matrix_reward.go       — EpochRewardCalculator
  server/internal/game/matrix_buff.go         — TokenBuffApplier
  server/internal/ws/matrix_handler.go        — WS 이벤트 핸들러
  server/internal/api/matrix_handler.go       — REST API 핸들러

수정 파일 (Go):
  server/internal/game/country_arena.go       — CountryArenaWrapper 확장
  server/internal/ws/protocol.go              — matrix_* 이벤트 상수
  server/cmd/server/router.go                 — /api/matrix 라우트 + RouterDeps

클라이언트 (TypeScript):
  apps/web/lib/matrix/online/online-sync.ts         — OnlineSyncSystem
  apps/web/lib/matrix/online/client-prediction.ts   — ClientPrediction
  apps/web/lib/matrix/online/seeded-spawning.ts     — SeededSpawning
  apps/web/lib/matrix/online/kill-reporter.ts       — KillReporter
  apps/web/lib/matrix/online/epoch-ui-bridge.ts     — EpochUIBridge
  apps/web/lib/matrix/online/types.ts               — 온라인 타입 정의
  apps/web/hooks/useMatrixSocket.ts                 — MatrixSocket 훅

수정 파일 (TypeScript):
  apps/web/components/game/matrix/MatrixApp.tsx     — online 모드 분기
  apps/web/hooks/useWebSocket.ts                    — (변경 없음, 재사용)

Agent SDK:
  aww-agent-skill/src/matrix-client.ts              — MatrixGameClient
  aww-agent-skill/src/matrix-strategy.ts            — MatrixStrategy
  aww-agent-skill/src/types.ts                      — MatrixAgentState 타입 추가

DB 마이그레이션:
  server/migrations/v33_matrix_online.sql           — 4개 테이블 생성
```

## Self-Verification

### 자체 검증 결과 (기획서 v33-online-matrix-plan.md 대비)

#### Round 1: 완성도 체크

| # | 기획서 요구사항 | 아키텍처 커버리지 | 상태 |
|---|---------------|-----------------|------|
| FR-01 | 국가 아레나 진입 | matrix_join WS 이벤트 + CountryArenaManager.GetOrCreateArena() | OK |
| FR-02 | 에폭 사이클 통합 | EpochManager → OnlineMatrixEngine.OnEpochPhaseChange() 콜백 | OK |
| FR-03 | 멀티플레이어 전투 | PlayerSession + matrix_state 20Hz + 보간 시스템 | OK |
| FR-04 | Nation Score 기여 | ScoreAggregator (독립 히스토리, Reset 안전) | OK |
| FR-05 | 토큰 보상 | EpochRewardCalculator → TokenRewardManager 파이프라인 | OK |
| FR-06 | 토큰→게임효과 | TokenBuffApplier (4 tier) + matrix_buff 이벤트 | OK |
| FR-07 | 에이전트 참여 | MatrixGameClient + MatrixStrategy + 기존 Layer2 100% 호환 | OK |
| FR-08 | 캡처 포인트 | 기존 CapturePointSystem 재사용 + matrix_capture_state 이벤트 | OK |
| FR-09 | 주권/패권 | SovereigntyTracker 추가 (CountryArenaWrapper 확장) | OK |
| FR-10 | 시즌 리셋 | 기존 SeasonManager 재사용, DB 토큰 보존 설계 | OK |
| NFR-01 | 50명/60fps/20Hz | 틱 버짓 분석 ~8ms/arena, 뷰포트 컬링 | OK |
| NFR-02 | 195 아레나 동시 | Lazy init + 비활성 다운그레이드 + GC 설계 | OK |
| NFR-03 | <50ms 전송 | delta compression + 뷰포트 컬링 + 대역폭 예산 | OK |
| NFR-04 | 서버 권위적 | KillValidator 6단계 + suspicion score | OK |
| NFR-05 | SDK 하위 호환 | Layer 2 REST 100% 유지, Layer 1은 별도 MatrixGameClient | OK |

#### Round 1: 발견된 Gap

| # | Gap | 심각도 | 보완 |
|---|-----|--------|------|
| G1 | 기획서 §5의 "오토헌트" (기존 Auto Hunt AI) 온라인 모드 처리 방침 누락 | Medium | 아래 보완 |
| G2 | 기획서 §5의 "데이터 버스트 이벤트 (BreakTime)" 서버 동기화 설계 누락 | Medium | 아래 보완 |
| G3 | 기획서 §8의 R7 "인구 가중 스코어" `adjustedScore = rawScore / sqrt(n)` 반영 여부 | Low | EpochRewardCalculator의 PopAdjust에 이미 반영됨 |
| G4 | 기획서 §7.2의 MessagePack 언급 — Phase 2 기본 구현 vs Phase 8 고도화 명확화 | Low | 이미 명확함 (Phase 2: JSON delta, Phase 8: MessagePack) |
| G5 | WS 프로토콜의 `matrix_input` 주기가 기획서(10Hz)와 아키텍처 일치 확인 | Low | 일치 확인됨 |

#### Round 2: Gap 보완

**G1 보완 — 오토헌트 온라인 처리**:
오토헌트(Auto Hunt AI)는 클라이언트 로컬 AI로 유지합니다. 온라인 모드에서도 `matrix_input`의 x, y, angle, boost를 오토헌트 AI가 생성하여 10Hz로 서버에 전송합니다. 서버 입장에서는 인간 입력과 AI 입력의 구분이 없습니다 (클라이언트 사이드 오토파일럿). 이는 에이전트(SDK)의 자동 전투와 동일한 구조입니다.

**G2 보완 — 데이터 버스트(BreakTime) 서버 동기화**:
기획서 §5에서 "BreakTime: 서버 동기화 (에폭 타이머 기반, 모든 클라이언트 동시 발동)" 방침입니다. 아키텍처 설계:
- `OnlineMatrixEngine.Tick()`에서 수축 페이즈의 특정 틱 범위(예: shrink 시작 후 30초)에 데이터 버스트 발동
- `matrix_epoch` 이벤트의 config에 `{ dataBurst: true, spawnMultiplier: 3.0, xpMultiplier: 2.0 }` 추가
- 클라이언트 `EpochUIBridge.onPhaseChange()`에서 데이터 버스트 상태를 SeededSpawning에 전달

**G3 확인 — 인구 가중 스코어**:
`RewardMultipliers.PopAdjust` 필드와 EpochRewardCalculator 설계에 `1/sqrt(nationPlayerCount)` 및 5명 이하 `×1.3 언더독 보너스`가 포함되어 있습니다. 기획서 R7 대응 완료.

#### 최종 일관성 검증

| 검증 항목 | 결과 |
|----------|------|
| 서버 Go 코드 구조와 아키텍처 일치 | OK — `game.CountryArenaWrapper` 확장, `ws.protocol.go` 이벤트 추가 |
| 클라이언트 TypeScript 구조와 아키텍처 일치 | OK — `lib/matrix/online/` 새 디렉토리, `hooks/useMatrixSocket.ts` |
| Agent SDK 구조와 아키텍처 일치 | OK — `matrix-client.ts`, `matrix-strategy.ts` 신규, `types.ts` 확장 |
| WS 프레임 포맷 `{e, d}` 기존 프로토콜 호환 | OK — 기존 GameSocket 클래스 재사용 |
| 기존 에폭/점령/주권/보상 시스템 수정 없이 연동 | OK — 콜백 wiring으로 연결 |
| DB 스키마 기존 테이블 수정 없음 | OK — 신규 4개 테이블만 추가 |
| 기획서 8 Phase 로드맵과 아키텍처 컴포넌트 1:1 매핑 | OK — Implementation Mapping 섹션에서 확인 |
| 대역폭 예산 현실성 | OK — 250KB/s per arena, Railway 1Gbps 내 |
| 안티치트 커버리지 | OK — 기획서 §6 "Anti-Cheat 토큰 보호" 6개 위협 전부 대응 |
| 토큰 경제 Net Deflationary 유지 | OK — DefenseOracle issuanceMod + 5 sinks + 일일 5,000 상한 |
