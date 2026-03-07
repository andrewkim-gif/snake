# AI World War — v17 통합 설계: 외부 에이전트 × 자율 시뮬레이션

> **Version**: v17.1 (Integrated Agent-Simulation Platform)
> **Date**: 2026-03-07
> **Status**: DRAFT — Strategic Plan
> **Based on**: v15 Agent Arena API + v16 Simulation System + v17 SuperPower Agent System + 실제 코드베이스 (5,460줄 에이전트 코드)
> **Core Vision**: 외부 AI 에이전트(aww-agent-skill SDK v2)가 195국 자율 시뮬레이션에 **실제 참여자**로 들어와 경제/외교/군사/정치를 직접 운영하는 통합 플랫폼

---

## 목차

1. [통합 비전](#1-통합-비전)
2. [기존 시스템 분석 (현황)](#2-기존-시스템-분석)
3. [통합 아키텍처](#3-통합-아키텍처)
4. [하이브리드 에이전트 모델](#4-하이브리드-에이전트-모델)
5. [5-Domain SDK v2 확장](#5-5-domain-sdk-v2-확장)
6. [서버 API v2 설계](#6-서버-api-v2-설계)
7. [시뮬레이션 엔진 통합](#7-시뮬레이션-엔진-통합)
8. [경제 시스템 (SuperPower 기반)](#8-경제-시스템)
9. [외교 시스템 (DR 기반)](#9-외교-시스템)
10. [군사 시스템 (유닛 상성)](#10-군사-시스템)
11. [정치 시스템 (정부 형태)](#11-정치-시스템)
12. [AI 학습 & 메모리 통합](#12-ai-학습--메모리)
13. [리스크 분석](#13-리스크-분석)
14. [구현 로드맵](#14-구현-로드맵)

---

## 1. 통합 비전

### 1.1 한 줄 요약

> **"외부 AI 에이전트가 195국 자율 시뮬레이션에 실제 참여자로 들어와 전투/경제/외교/군사/정치를 직접 운영하고, NationalAI와 경쟁/협력하는 통합 지정학 AI 플랫폼"**

### 1.2 핵심 문제: v15/v16/v17이 분리되어 있다

| 문서 | 하는 일 | 문제 |
|------|---------|------|
| **v15** (Agent Arena API) | 외부 AI가 전투 참여 | 전투만 가능, 전략 결정 불가 |
| **v16** (Simulation System) | 내부 NationalAI가 195국 운영 | 외부 참여 메커니즘 없음 |
| **v17** (SuperPower Agent) | SDK를 5도메인으로 확장 | v16 시뮬과 연결 방법 미정의 |

### 1.3 통합 비전: 하이브리드 에이전트 모델

```
┌─────────────────────────────────────────────────────┐
│              195국 시뮬레이션 월드                      │
│                                                     │
│  국가 운영자 (Country Operator) — 195국 각각 할당:    │
│                                                     │
│  🤖 NationalAI (기본) — v16 내부 AI                  │
│     └── 외부 에이전트 없으면 자동으로 담당              │
│                                                     │
│  🔌 External Agent — aww-agent-skill SDK v2          │
│     └── API Key로 접속, 국가 운영권 획득               │
│     └── 5 도메인 전부 또는 일부 직접 운영              │
│                                                     │
│  👤 Human Player — WebUI                             │
│     └── UI에서 직접 결정 (SDK와 동일 API)             │
│                                                     │
│  🔀 Hybrid — 도메인별 분할 운영                       │
│     └── 전투: External Agent                         │
│     └── 경제: NationalAI (자동)                      │
│     └── 외교: Human Player                          │
│     └── 나머지: NationalAI (기본)                    │
│                                                     │
│  SimulationEngine (오케스트레이터)                     │
│  └── 모든 운영자가 동일 API를 통해 결정 제출            │
│  └── 미결정 시 NationalAI가 대행 (타임아웃 폴백)       │
│  └── 결정은 SimClock 기준으로 처리 (시간 가속 호환)     │
└─────────────────────────────────────────────────────┘
```

### 1.4 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **운영자 교체 가능** | 어떤 국가든 NationalAI ↔ External Agent ↔ Human을 런타임에 교체 가능 |
| **도메인별 분할** | 5 도메인(전투/경제/외교/군사/정치)을 독립 운영, 도메인별 다른 운영자 할당 가능 |
| **NationalAI = 폴백** | 외부 에이전트 없거나 타임아웃 시 NationalAI가 자동 대행 (시뮬레이션 중단 없음) |
| **단일 Decision API** | External Agent, Human, NationalAI 모두 동일한 API로 결정 제출 |
| **시간 가속 호환** | 외부 에이전트도 SimClock 가속을 따름 (×1~×1000) |
| **SP2 충실 재현** | 경제/외교/군사/정치는 SuperPower 2의 검증된 공식 기반 |

### 1.5 기존 코드베이스 활용

| 기존 구현 | 파일 수 | LOC | 역할 |
|----------|--------|-----|------|
| Go 에이전트 코드 (agent, commander, training, memory, llm) | 12 | 5,394 | v15 전투 도메인 기반 |
| aww-agent-skill SDK v1 | 9 | 1,198 | CombatDomain 기반 확장 |
| meta 시스템 (Economy/Diplomacy/War/Faction) | 18 | 10,797 | 5도메인 백엔드 |
| game 엔진 (Arena/Bot/Weapon/Epoch) | 65 | 25,011 | 전투 재사용 |
| world 시스템 (195국/주권) | 8 | 3,667 | 월드 인프라 |
| **합계** | **112** | **~46,070** | |

---

## 2. 기존 시스템 분석

### 2.1 기존 에이전트 인프라 (이미 구현됨, 5,460줄)

**서버 Go 코드:**

| 파일 | LOC | 역할 |
|------|-----|------|
| `game/agent.go` | 589 | Agent 물리, 입력 처리, nationality |
| `game/agent_api.go` | 771 | Commander Mode — 17개 전투 명령 (hunt, farm_orbs, kite 등) |
| `game/commander.go` | 354 | AI↔수동 전환, 1s 무적, 30s idle 자동복귀 |
| `game/training.go` | 557 | TrainingProfile (BuildProfile, CombatRules, StrategyPhases), 6 Personality |
| `game/memory.go` | 351 | AgentMemory (전투 기록, 빌드 성능, 시너지 발견, 상대 프로필) |
| `ws/agent_stream.go` | 391 | WebSocket 실시간 스트림 (AgentBattleState @20Hz, AgentBattleEvent) |
| `api/agent_routes.go` | 581 | REST API (deploy, recall, status, battle-log, strategy) |
| `meta/agent_manager.go` | 211 | HTTP↔World 브릿지 |
| `agent/llm_bridge.go` | 588 | Claude/GPT/Llama LLM 연동 (2s timeout, heuristic fallback, multi-provider) |

**TypeScript SDK (aww-agent-skill/, 9파일 1,198줄):**

| 파일 | LOC | 역할 |
|------|-----|------|
| `src/agent.ts` | 150 | AWWAgent 클래스 (lifecycle, auto-reconnect, round rejoin) |
| `src/api.ts` | 144 | REST client (AWWApi) |
| `src/client.ts` | 283 | GameClient WebSocket 핸들링 |
| `src/types.ts` | 219 | 타입 정의 (AgentProfile, AgentState 등) |
| `src/strategy.ts` | 114 | Strategy 인터페이스 + 유틸 |
| `src/index.ts` | 70 | Barrel exports |
| `src/strategies/*.ts` | 218 | 3 내장 전략 (Aggressive, Defensive, Balanced) |
| `skill.json` | — | OpenClaw 스킬 메타데이터 |

### 2.2 기존 v15 프로토콜 (전투 전용)

**WS Client→Server:**
- `agent_auth` — API Key 인증 (`aww_` + 64hex)
- `agent_command` — 17개 전투 명령
- `agent_choose_upgrade` — 레벨업 선택
- `observe_game` — 전체 관전 데이터

**WS Server→Client:**
- `agent_auth_result` — 인증 결과
- `agent_state` — 실시간 전투 상태 (@20Hz)
- `agent_event` — 이벤트 (kill, death, level_up, synergy)
- `agent_level_up` — 레벨업 이벤트 + 선택지
- `coach_message` — 실시간 코칭
- `round_analysis` — 라운드 분석

**REST:**
- `POST /api/agents/deploy` — 배치
- `POST /api/agents/recall` — 회수
- `GET /api/agents/{id}/status` — 상태
- `GET /api/agents/{id}/battle-log` — 전투 로그
- `POST /api/agents/{id}/strategy` — 빌드/전투 전략

### 2.3 기존 meta 시스템 (v16 시뮬 백엔드)

| 시스템 | 주요 API | 상태 |
|--------|---------|------|
| **EconomyEngine** | `InitializeCountry()`, `ManualTick()`, GDP/세율/무역 | 구현됨, auto-tick goroutine |
| **DiplomacyEngine** | `ProposeTreaty()`, `AreAllied()`, `HasSanction()` | 구현됨, 5종 조약 (non_aggression, trade, alliance, sanction, tribute) |
| **WarManager** | `DeclareWar()`, `AdvancePhase()` | 구현됨, time.Sleep 단계전환 |
| **FactionManager** | `CreateFaction()`, `JoinFaction()` | 구현됨, 시그니처 100% 일치 |
| **SovereigntyEngine** | `ProcessBattleResult()` | 구현됨, 주권 이전 |
| **EpochManager** | `Tick(tick)` 외부주입 | 구현됨, 시뮬 친화적 |

### 2.4 마이그레이션 노트: 팩션 기반 → 국가 기반

기존 DiplomacyEngine/WarManager는 **팩션 ID** 기반 (`factionA`, `factionB`).
v17은 **국가 ISO3** 기반. 마이그레이션 전략:

1. 팩션 = 국가 연합(다수 국가). 외교 관계(DR)는 **국가 단위**, 조약/전쟁은 **팩션 단위** 유지
2. 기존 `DiplomacyEngine`은 래퍼를 통해 ISO3 → factionID 변환
3. v17 `diplomacy_v2.go`가 국가 단위 DR + 다자 조약을 새로 구현, 기존 엔진과 공존
4. Phase 2에서 마이그레이션 수행 (하위 호환 유지)

### 2.5 핵심 갭: 외부 에이전트 → meta 시스템 브릿지 없음

```
현재:
  External Agent → [WS] → agent_command → Arena (전투만)
                        → agent_choose_upgrade → Arena (빌드만)

  meta 시스템 (Economy/Diplomacy/War) → 내부 AI 또는 UI에서만 제어

갭:
  ❌ External Agent → Economy API (세율, 예산, 무역)
  ❌ External Agent → Diplomacy API (조약, 제재, 동맹)
  ❌ External Agent → War API (선전포고, 항복, 휴전)
  ❌ External Agent → Politics API (정부형태, 정책, 선거)
  ❌ External Agent → Military API (유닛 생산, 배치, 기술)
```

**이 갭을 메우는 것이 v17 통합 설계의 핵심 목표.**

---

## 3. 통합 아키텍처

### 3.1 시스템 컨텍스트 (C4 Level 1)

```
                    ┌──────────────┐
                    │ Human Player │
                    │  (WebUI)     │
                    └──────┬───────┘
                           │ HTTPS/WS
    ┌──────────────┐       │       ┌──────────────────┐
    │ External AI  │       │       │ SimWatch         │
    │ Agent (SDK)  ├───────┼───────┤ (Spectator UI)   │
    └──────┬───────┘       │       └──────────────────┘
           │ WS/REST       │
    ═══════╪═══════════════╪═══════════════════════════
    │      ▼               ▼                          │
    │  ┌────────────────────────────────────┐         │
    │  │       API Gateway (Go HTTP/WS)     │         │
    │  │  ├── /api/v2/decisions/*  (NEW)    │         │
    │  │  ├── /api/v2/observe/*    (NEW)    │         │
    │  │  ├── /api/agents/*        (v15)    │         │
    │  │  └── /ws/game, /ws/agents (v15)    │         │
    │  └────────────┬───────────────────────┘         │
    │               │                                 │
    │  ┌────────────▼───────────────────────┐         │
    │  │      DecisionRouter (NEW)          │         │
    │  │  "모든 결정의 단일 진입점"            │         │
    │  │  ├── 인증 + 권한 (어떤 국가, 도메인) │         │
    │  │  ├── 타임아웃 감시 (SimClock 기준)   │         │
    │  │  └── NationalAI 폴백 트리거         │         │
    │  └────────────┬───────────────────────┘         │
    │               │                                 │
    │  ┌────────────▼───────────────────────────────┐ │
    │  │         SimulationEngine (v16 확장)         │ │
    │  │  ├── SimClock (논리 틱)                     │ │
    │  │  ├── ArenaScheduler (195국 전투)            │ │
    │  │  ├── OperatorRegistry (국가별 운영자 매핑)   │ │
    │  │  └── DecisionQueue (도메인별 결정 큐)       │ │
    │  └────────────┬───────────────────────────────┘ │
    │               │                                 │
    │  ┌────────────▼───────────────────────────────┐ │
    │  │         Domain Engines (5개)                │ │
    │  │  ├── CombatEngine (game/arena.go 확장)     │ │
    │  │  ├── EconomyEngine (meta/economy.go 확장)  │ │
    │  │  ├── DiplomacyEngine (meta/diplomacy.go)   │ │
    │  │  ├── MilitaryEngine (NEW)                  │ │
    │  │  └── PoliticsEngine (NEW)                  │ │
    │  └────────────────────────────────────────────┘ │
    │                                                 │
    │  ┌────────────────────────────────────────────┐ │
    │  │         NationalAI[195] (v16 확장)         │ │
    │  │  └── 외부 미제어 도메인 자동 운영            │ │
    │  │  └── 타임아웃 시 즉시 대행                  │ │
    │  └────────────────────────────────────────────┘ │
    ═══════════════════════════════════════════════════
```

### 3.2 Go 패키지 구조 (신규/확장)

```
server/
├── cmd/
│   ├── server/main.go          # 기존 게임 서버
│   └── simulate/main.go        # NEW: 시뮬레이션 CLI (v16)
│
├── internal/
│   ├── game/                   # 기존 (25K LOC) — CombatEngine 역할
│   ├── world/                  # 기존 (3.7K LOC) — 195국 관리
│   ├── meta/                   # 기존 (10.8K LOC) — Economy/Diplomacy/War/Faction
│   ├── domain/                 # 기존 (~2.5K LOC) — 공유 타입
│   ├── ws/                     # 기존 — WebSocket (agent_stream 확장)
│   ├── api/                    # 기존 — REST API (v2 엔드포인트 추가)
│   ├── agent/                  # 기존 — LLM bridge
│   │
│   ├── sim/                    # NEW (v16): 시뮬레이션 엔진
│   │   ├── engine.go           # SimulationEngine (v16 + v17 통합)
│   │   ├── clock.go            # SimClock (논리 틱)
│   │   ├── operator.go         # NEW: OperatorRegistry (국가별 운영자 매핑)
│   │   ├── decision.go         # NEW: DecisionRouter + DecisionQueue
│   │   ├── config.go, state.go, recorder.go, snapshot.go
│   │   └── analytics.go
│   │
│   ├── strategy/               # NEW (v16): NationalAI (폴백 AI)
│   │   ├── national_ai.go
│   │   ├── personality.go      # 195국 NationalPersonality
│   │   ├── faction_formation.go
│   │   ├── diplomacy_ai.go, war_strategy.go, economy_ai.go
│   │   └── deployment.go
│   │
│   ├── military/               # NEW (v17): 군사 시스템
│   │   ├── unit_classes.go     # 5종 유닛 클래스 + 상성
│   │   ├── tech_tree.go        # 기술 연구
│   │   ├── deployment.go       # 병력 배치
│   │   └── nuclear.go          # 핵무기 (3단계)
│   │
│   └── politics/               # NEW (v17): 정치 시스템
│       ├── government.go       # 6종 정부 형태
│       ├── policies.go         # 국내 정책
│       └── elections.go        # 선거/쿠데타
│
├── aww-agent-skill/            # TypeScript SDK v2 (확장)
│   ├── src/
│   │   ├── agent.ts            # AWWAgent v2 (5 도메인 지원)
│   │   ├── api.ts              # REST client v2
│   │   ├── domains/            # NEW: 도메인별 클래스
│   │   │   ├── combat.ts       # CombatDomain (기존 확장)
│   │   │   ├── economy.ts      # EconomyDomain (NEW)
│   │   │   ├── diplomacy.ts    # DiplomacyDomain (NEW)
│   │   │   ├── military.ts     # MilitaryDomain (NEW)
│   │   │   └── politics.ts     # PoliticsDomain (NEW)
│   │   ├── advisors/           # NEW: 도메인별 AI 어드바이저
│   │   └── llm/                # NEW: LLM 자연어 인터페이스
│   └── package.json            # @aww/agent-sdk v2.0.0
```

---

## 4. 하이브리드 에이전트 모델

### 4.1 OperatorRegistry — 국가별 운영자 매핑

```go
// 각 국가의 각 도메인을 누가 운영하는지 추적
type OperatorRegistry struct {
    mu        sync.RWMutex
    operators map[string]*CountryOperators // ISO3 → operators
}

type CountryOperators struct {
    Combat    OperatorInfo // 전투 도메인 운영자
    Economy   OperatorInfo // 경제 도메인 운영자
    Diplomacy OperatorInfo // 외교 도메인 운영자
    Military  OperatorInfo // 군사 도메인 운영자
    Politics  OperatorInfo // 정치 도메인 운영자
}

type OperatorType int
const (
    OperatorNationalAI OperatorType = iota // 기본값: v16 내부 AI
    OperatorExternal                       // 외부 에이전트 (SDK v2)
    OperatorHuman                          // 인간 플레이어 (WebUI)
)

type OperatorInfo struct {
    Type      OperatorType
    AgentID   string        // External: API Key 기반 ID
    UserID    string        // Human: 웹 세션 ID
    ConnectedAt time.Time
    LastDecisionAt time.Time
    TimeoutDuration time.Duration // 미결정 시 폴백까지 대기시간
}
```

### 4.2 운영자 전환 프로토콜

```
1. 외부 에이전트 접속:
   POST /api/v2/countries/{iso3}/claim
   Body: { "api_key": "aww_xxx", "domains": ["combat", "economy", "diplomacy"] }
   → OperatorRegistry에 해당 도메인만 External로 전환
   → 미지정 도메인은 NationalAI 유지

2. 접속 해제:
   POST /api/v2/countries/{iso3}/release
   → 모든 도메인이 NationalAI로 자동 복귀

3. 타임아웃 폴백:
   - 각 도메인의 결정 요청 후 TimeoutDuration 내 응답 없으면
   - NationalAI가 해당 결정을 대행
   - 에이전트 연결은 유지 (다음 결정부터 다시 제어)

4. 런타임 전환:
   POST /api/v2/countries/{iso3}/transfer
   Body: { "domain": "economy", "to": "national_ai" }
   → 특정 도메인만 NationalAI에 위임 (에이전트 부분 위임)
```

### 4.3 Decision API — 통합 결정 인터페이스

```go
// 모든 운영자가 동일한 형식으로 결정을 제출
type Decision struct {
    CountryISO string          // 어느 국가의 결정인가
    Domain     DomainType      // combat|economy|diplomacy|military|politics
    Action     string          // 도메인별 액션 이름
    Params     json.RawMessage // 액션별 파라미터
    Reasoning  string          // 선택적: 왜 이 결정인지 (LLM 에이전트용)
    Tick       uint64          // SimClock 기준 틱
}

type DomainType string
const (
    DomainCombat    DomainType = "combat"
    DomainEconomy   DomainType = "economy"
    DomainDiplomacy DomainType = "diplomacy"
    DomainMilitary  DomainType = "military"
    DomainPolitics  DomainType = "politics"
)

// DecisionRouter — 결정 라우팅 + 폴백
type DecisionRouter struct {
    registry  *OperatorRegistry
    nationalAI map[string]*NationalAI  // ISO3 → AI
    queue     *DecisionQueue
}

func (r *DecisionRouter) SubmitDecision(d *Decision) error {
    // 1. 권한 확인: 이 운영자가 이 국가의 이 도메인을 제어하는가?
    // 2. 유효성 검증: 액션이 현재 게임 상태에서 가능한가?
    // 3. DecisionQueue에 추가 (SimClock 틱 기준 처리)
}

func (r *DecisionRouter) RequestDecision(iso3 string, domain DomainType) *Decision {
    // 1. 현재 운영자 확인
    // 2. External/Human → WS/REST로 결정 요청 + 타임아웃 대기
    // 3. 타임아웃 → NationalAI에 폴백
    // 4. Decision 반환
}
```

### 4.4 시간 가속과 외부 에이전트의 양립

| 가속 배율 | 외부 에이전트 처리 | 전략 결정 대기시간 | 전투 처리 |
|----------|-------------------|------------------|----------|
| ×1 (실시간) | 정상 응답 대기 | 1시간 실시간 | Full Arena (20Hz) |
| ×10 | 응답 대기 6분 실시간 | 6분 실시간 | Full Arena |
| ×100 | 응답 대기 36초 실시간 | 36초 실시간 | SimplifiedArena (5Hz) |
| ×1000+ | **외부 에이전트 비활성** | 3.6초 (NationalAI만) | Statistical |

> **핵심**: ×100 이상에서는 외부 에이전트 응답 대기가 비현실적 → NationalAI 전환 강제.
> ×10 이하에서만 External Agent 참여 가능.

---

## 5. 5-Domain SDK v2 확장

### 5.1 SDK v2 아키텍처 (TypeScript)

```typescript
// aww-agent-skill/src/agent.ts — AWWAgent v2
class AWWAgent {
  // v1 기존
  combat: CombatDomain;

  // v2 NEW: 5 도메인
  economy: EconomyDomain;
  diplomacy: DiplomacyDomain;
  military: MilitaryDomain;
  politics: PoliticsDomain;

  // 통합 기능
  observe: WorldObserver;     // 전체 월드 상태 관찰
  memory: AgentMemory;        // 5도메인 통합 메모리
  llm?: LLMBridge;            // 선택적 LLM 연동

  // 국가 운영
  async claimCountry(iso3: string, domains?: DomainType[]): Promise<void>;
  async releaseCountry(): Promise<void>;
  async delegateDomain(domain: DomainType): Promise<void>;

  // 결정 제출 (통합 API)
  async submitDecision(decision: Decision): Promise<DecisionResult>;

  // 브리핑 수신 (각 도메인별 의사결정 요청)
  onBriefing(handler: (briefing: Briefing) => Decision | Promise<Decision>): void;
}

// WorldObserver — 월드 상태 관찰 (SimWatch 스펙터이터와 동일 데이터)
interface WorldObserver {
  getWorldSnapshot(): WorldSnapshot;                    // 전체 월드 스냅샷
  getCountryDetail(iso3: string): CountryDetail;       // 국가별 상세
  getDomainState(iso3: string, domain: DomainType): any; // 도메인별 상세
  onWorldUpdate(handler: (state: WorldSnapshot) => void): void;  // 1Hz 업데이트
  onDomainEvent(handler: (event: DomainEvent) => void): void;    // 이벤트 구독
}
```

### 5.2 도메인별 인터페이스

```typescript
// CombatDomain (v1 확장 — 전술 전투 전용)
interface CombatDomain {
  // v1 기존
  setStrategy(strategy: Strategy): void;
  sendCommand(cmd: AgentCommand): void;
  chooseUpgrade(index: number): void;
  observe(): BattleObservation;
  // 유닛 배치/편성은 MilitaryDomain에서 관리 (중복 방지)
}

// EconomyDomain (NEW)
interface EconomyDomain {
  getEconomyState(): CountryEconomy;
  setTaxPolicy(tax: TaxPolicy): void;           // PIT, 자원세, GTM
  setBudgetAllocation(budget: BudgetPlan): void; // 8종 예산
  proposeTradeOrder(order: TradeOrder): void;    // 수출입
  setNationalization(sector: string, level: number): void;
}

// DiplomacyDomain (NEW)
interface DiplomacyDomain {
  getRelations(): DiplomaticRelations;           // DR -100~+100
  proposeTreaty(treaty: TreatyProposal): void;   // 다자 조약
  respondTreaty(id: string, accept: boolean): void;
  imposeSanction(target: string): void;
  declareWar(target: string, reason: string): void;
  proposeCeasefire(warId: string): void;
}

// MilitaryDomain (NEW)
interface MilitaryDomain {
  getForceStatus(): MilitaryStatus;
  produceUnits(orders: ProductionOrder[]): void; // 유닛 생산
  deployForces(plan: DeploymentPlan): void;      // 배치
  investTech(area: TechArea, amount: number): void;
  initiateNukeResearch(): void;                  // 핵 연구 (DR 패널티 주의)
}

// PoliticsDomain (NEW)
interface PoliticsDomain {
  getGovernment(): GovernmentState;
  setPolicy(policy: Policy): void;               // 국내 정책
  changeGovernment(type: GovernmentType): void;   // 정부 형태 변경 (쿠데타/선거)
  callElection(): void;
  setIdeology(axis: IdeologyAxis, value: number): void;
}
```

### 5.3 Briefing 시스템 — 의사결정 요청

```typescript
// 서버가 에이전트에게 결정을 요청하는 구조
interface Briefing {
  domain: DomainType;
  tick: number;
  deadline: number;           // 이 틱까지 결정해야 함 (이후 NationalAI 폴백)
  context: WorldSnapshot;     // 현재 월드 상태
  availableActions: Action[]; // 가능한 액션 목록
  urgency: 'low' | 'medium' | 'high' | 'critical';
  aiSuggestion?: Decision;    // NationalAI의 추천 (참고용)
}

// 사용 예시
agent.onBriefing(async (briefing) => {
  if (briefing.domain === 'economy') {
    const state = agent.economy.getEconomyState();
    // 분석 후 결정
    return { action: 'set_tax_rate', params: { pit: 0.15, resource: 0.10 } };
  }
  // 미결정 시 NationalAI 추천 사용
  return briefing.aiSuggestion;
});
```

---

## 6. 서버 API v2 설계

### 6.0 인증 (v2)

v1 인증(`agent_auth` + `aww_` 키)을 v2에서 확장:

```
# API Key 발급 (기존)
POST   /api/v2/auth/register     # API Key 발급 (aww_ + 64hex)
POST   /api/v2/auth/verify       # API Key 유효성 확인

# 인증 방식
REST:  Authorization: Bearer aww_xxx (모든 v2 엔드포인트에 필수)
WS:    v2_auth 메시지로 연결 직후 인증 (아래 §6.2 참조)

# 권한 모델: API Key → AgentID → 운영 국가 + 도메인 확인
# DecisionRouter.SubmitDecision()에서 권한 검증 수행
```

### 6.1 REST API v2 엔드포인트

```
# 인증 (NEW)
POST   /api/v2/auth/register              # API Key 발급
POST   /api/v2/auth/verify                # Key 유효성 확인

# 국가 운영 (NEW)
GET    /api/v2/countries                   # 가용 국가 목록 (운영자 상태 포함)
POST   /api/v2/countries/{iso3}/claim     # 국가 운영권 획득
POST   /api/v2/countries/{iso3}/release   # 운영권 반환
POST   /api/v2/countries/{iso3}/transfer  # 도메인별 위임
GET    /api/v2/countries/{iso3}/operators # 현재 운영자 조회

# 결정 API (NEW — 통합 진입점)
POST   /api/v2/decisions                  # 결정 제출 (모든 도메인 공통)
GET    /api/v2/decisions/pending          # 대기 중 결정 요청 목록

# 관찰 API (NEW)
GET    /api/v2/observe/world              # 전체 월드 스냅샷
GET    /api/v2/observe/{iso3}             # 국가별 상세
GET    /api/v2/observe/{iso3}/{domain}    # 도메인별 상세

# 경제 (NEW)
GET    /api/v2/economy/{iso3}             # 경제 상태
POST   /api/v2/economy/{iso3}/tax         # 세율 설정
POST   /api/v2/economy/{iso3}/budget      # 예산 배분
POST   /api/v2/economy/{iso3}/trade       # 무역 주문
POST   /api/v2/economy/{iso3}/ownership   # 국유화/민영화

# 외교 (NEW)
GET    /api/v2/diplomacy/{iso3}/relations # 외교 관계
POST   /api/v2/diplomacy/treaties         # 조약 제안
PUT    /api/v2/diplomacy/treaties/{id}    # 조약 응답 (수락/거절)
DELETE /api/v2/diplomacy/treaties/{id}    # 조약 탈퇴
POST   /api/v2/diplomacy/sanctions        # 제재
POST   /api/v2/diplomacy/war              # 선전포고
POST   /api/v2/diplomacy/war/{id}/peace   # 휴전 제안
POST   /api/v2/diplomacy/war/{id}/surrender # 항복

# 군사 (NEW)
GET    /api/v2/military/{iso3}            # 군사 상태
POST   /api/v2/military/{iso3}/produce    # 유닛 생산
DELETE /api/v2/military/{iso3}/units      # 유닛 해산
POST   /api/v2/military/{iso3}/deploy     # 병력 배치
DELETE /api/v2/military/{iso3}/deploy     # 병력 회수
POST   /api/v2/military/{iso3}/tech       # 기술 투자
POST   /api/v2/military/{iso3}/training   # 훈련 우선순위
POST   /api/v2/military/{iso3}/nuke       # 핵 발사

# 정치 (NEW)
GET    /api/v2/politics/{iso3}            # 정치 상태
POST   /api/v2/politics/{iso3}/policy     # 정책 설정
POST   /api/v2/politics/{iso3}/government # 정부 변경
POST   /api/v2/politics/{iso3}/election   # 선거 소집
POST   /api/v2/politics/{iso3}/martial-law # 계엄령 선포/해제

# v1 호환 (기존 유지)
POST   /api/agents/deploy                 # v1 전투 배치
GET    /api/agents/{id}/status            # v1 상태
```

> **총 45개 엔드포인트** (v2 NEW 43 + v1 호환 2). 모든 §8-§11 도메인 액션이 REST 엔드포인트를 가짐.

### 6.2 WebSocket v2 프로토콜 (기존 확장)

```
# 접속 URL: /ws/v2?api_key=aww_xxx

# Client → Server (NEW)
v2_auth                  # 연결 직후 인증 { api_key: "aww_xxx" }
decision_submit          # 결정 제출 (모든 도메인)
claim_country            # 국가 운영권 획득
release_country          # 운영권 반환
observe_world            # 월드 관찰 요청

# Server → Client (NEW)
v2_auth_result           # 인증 결과 { success, agent_id }
briefing                 # 의사결정 요청 (도메인별)
decision_result          # 결정 처리 결과
decision_rejected        # 결정 거부 (유효하지 않은 액션 등)
world_update             # 월드 상태 변경 알림 (1Hz)
domain_event             # 도메인별 이벤트 (전쟁선포, 조약체결, 쿠데타 등)
operator_change          # 운영자 변경 알림

# v1 기존 유지 (/ws/agents/{id}/live 경로)
agent_auth, agent_command, agent_state, agent_event, ...
```

---

## 7. 시뮬레이션 엔진 통합

### 7.1 핵심 타입 정의 (§4 보완)

```go
// OperatorRegistry의 도메인 접근 메서드
func (r *OperatorRegistry) Get(iso3 string, domain DomainType) OperatorInfo {
    r.mu.RLock()
    defer r.mu.RUnlock()
    co := r.operators[iso3]
    if co == nil { return OperatorInfo{Type: OperatorNationalAI} }
    switch domain {
    case DomainCombat:    return co.Combat
    case DomainEconomy:   return co.Economy
    case DomainDiplomacy: return co.Diplomacy
    case DomainMilitary:  return co.Military
    case DomainPolitics:  return co.Politics
    default:              return OperatorInfo{Type: OperatorNationalAI}
    }
}

// NationalAI — v16 내부 AI의 v17 확장 (strategy/national_ai.go)
type NationalAI struct {
    ISO3        string
    Personality *NationalPersonality  // 195국 고유 성격
    Memory      *WorldMemory          // 학습 메모리
}

// Decide — 주어진 도메인에 대해 AI 결정 생성
func (ai *NationalAI) Decide(domain DomainType, snapshot *WorldSnapshot) *Decision {
    switch domain {
    case DomainCombat:    return ai.decideCombat(snapshot)
    case DomainEconomy:   return ai.decideEconomy(snapshot)
    case DomainDiplomacy: return ai.decideDiplomacy(snapshot)
    case DomainMilitary:  return ai.decideMilitary(snapshot)
    case DomainPolitics:  return ai.decidePolitics(snapshot)
    default:              return nil
    }
}

// StrategicDecisionEngine — 195국 NationalAI 관리자
type StrategicDecisionEngine struct {
    ais map[string]*NationalAI // ISO3 → NationalAI
}
func (s *StrategicDecisionEngine) GetAI(iso3 string) *NationalAI {
    return s.ais[iso3]
}

// BriefingHub — 외부 에이전트에 Briefing WS 전송
type BriefingHub struct {
    subscribers map[string]chan *Briefing  // AgentID → 브리핑 채널
    mu          sync.RWMutex
}
func (h *BriefingHub) Send(agentID string, briefing *Briefing) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    if ch, ok := h.subscribers[agentID]; ok {
        select {
        case ch <- briefing:
        default: // 채널 풀 → 드롭 (에이전트 느림)
        }
    }
}

// DecisionQueue — 틱 기반 결정 큐
type DecisionQueue struct {
    mu      sync.Mutex
    pending map[uint64][]*Decision // tick → 해당 틱에 실행할 결정 목록
}
func (q *DecisionQueue) Enqueue(d *Decision)
func (q *DecisionQueue) DrainTick(tick uint64) []*Decision

// 195국 ISO3 코드 리스트 (world 패키지)
var AllCountryCodes = []string{"AFG", "ALB", "DZA", /* ... 195국 ... */ "ZWE"}
```

### 7.2 v16 SimulationEngine 확장

v16의 순수 자율 시뮬레이션을 v17에서 하이브리드로 확장:

```go
type SimulationEngine struct {
    // v16 기존
    config      *SimConfig
    clock       *SimClock
    world       *world.WorldManager
    factions    *meta.FactionManager
    economy     *meta.EconomyEngine
    diplomacy   *meta.DiplomacyEngine
    wars        *meta.WarManager
    strategy    *StrategicDecisionEngine  // NationalAI[195] — §7.1에서 정의
    recorder    *SimRecorder
    state       *SimState
    running     atomic.Bool

    // v17 NEW: 하이브리드 에이전트 지원
    operators   *OperatorRegistry          // 국가별 운영자 매핑 — §4.1에서 정의
    decisions   *DecisionRouter            // 결정 라우팅 + 폴백 — §4.3에서 정의
    military    *military.MilitaryEngine   // 군사 시스템
    politics    *politics.PoliticsEngine   // 정치 시스템
    briefingHub *BriefingHub               // 외부 에이전트에 브리핑 전송 — §7.1에서 정의
}
```

### 7.3 메인 루프 변경 (v16→v17)

```go
// v16: NationalAI만 결정
// v17: OperatorRegistry 확인 → External이면 브리핑 전송 → 타임아웃 시 NationalAI 폴백

func (e *SimulationEngine) processStrategicTick(gameTick uint64) {
    for _, iso3 := range AllCountryCodes {  // world 패키지의 195국 리스트
        for _, domain := range AllDomains {
            operator := e.operators.Get(iso3, domain)  // §7.1 Get() 메서드

            switch operator.Type {
            case OperatorNationalAI:
                // v16 방식: NationalAI가 즉시 결정
                decision := e.strategy.GetAI(iso3).Decide(domain, e.buildSnapshot(iso3))
                e.decisions.Execute(decision)

            case OperatorExternal:
                // v17 NEW: 외부 에이전트에 브리핑 전송 + 대기
                briefing := e.buildBriefing(iso3, domain)
                e.briefingHub.Send(operator.AgentID, briefing)

                // 타임아웃 대기 (SimClock 기준)
                deadline := e.clock.CurrentTick() + e.clock.TicksPerDuration(operator.TimeoutDuration)
                e.decisions.WaitOrFallback(iso3, domain, deadline, func() *Decision {
                    // 폴백: NationalAI 대행
                    return e.strategy.GetAI(iso3).Decide(domain, e.buildSnapshot(iso3))
                })

            case OperatorHuman:
                // Human: WebUI에서 결정 대기 (동일 폴백 메커니즘)
                briefing := e.buildBriefing(iso3, domain)
                e.briefingHub.Send(operator.UserID, briefing)
                deadline := e.clock.CurrentTick() + e.clock.TicksPerDuration(operator.TimeoutDuration)
                e.decisions.WaitOrFallback(iso3, domain, deadline, func() *Decision {
                    return e.strategy.GetAI(iso3).Decide(domain, e.buildSnapshot(iso3))
                })
            }
        }
    }
}
```

### 7.3 SimWatch (관전 시스템)

외부 관전자(SimWatch)는 SDK의 `WorldObserver`와 동일한 데이터를 WebUI로 수신:
- `/ws/v2?mode=spectate` — 읽기 전용 WS 연결 (인증 불필요)
- `world_update` (1Hz) + `domain_event` 수신
- Phase 10 프론트엔드에서 대시보드 UI 구현

### 7.4 운영 모드 3종

| 모드 | 외부 에이전트 | NationalAI | 용도 |
|------|-------------|-----------|------|
| **Pure Simulation** | 0국 | 195국 | v16 호환 — 순수 자율 시뮬 |
| **Hybrid** | 1~194국 | 나머지 | **v17 핵심** — AI vs AI vs Human |
| **Full Agent** | 195국 | 0국 (폴백만) | 에이전트 토너먼트 |

모드는 `SimConfig.Mode`로 설정. 런타임에 에이전트가 접속/이탈하면 자동 전환.

### 7.5 시뮬레이션 실행 방법

**바이너리: `server/cmd/simulate/main.go`**

```bash
# 빌드
cd server && go build -o bin/simulate ./cmd/simulate/

# Pure Simulation (NationalAI 195국 자율 시뮬)
./bin/simulate --mode=pure --speed=10 --season-length=4w --seed=42

# Hybrid (외부 에이전트 수용 — 기본)
./bin/simulate --mode=hybrid --speed=1 --port=9002 --api-port=9003

# Headless (밸런스 테스트용)
./bin/simulate --mode=pure --speed=1000 --headless --runs=100 --output=results.json
```

**CLI 플래그:**

| 플래그 | 기본값 | 설명 |
|--------|--------|------|
| `--mode` | `hybrid` | `pure` / `hybrid` / `full-agent` |
| `--speed` | `1` | 시간 가속 배율 (1~1000) |
| `--port` | `9002` | WS v2 포트 |
| `--api-port` | `9003` | REST v2 API 포트 |
| `--season-length` | `4w` | 시즌 길이 |
| `--seed` | random | 시뮬 랜덤 시드 |
| `--headless` | false | UI 없이 실행 |
| `--runs` | 1 | headless 반복 횟수 |
| `--output` | stdout | 결과 출력 파일 |

**외부 에이전트 접속 플로우 (Hybrid 모드):**

```
1. 시뮬레이션 서버 시작:
   ./bin/simulate --mode=hybrid --speed=1 --port=9002

2. SDK v2로 접속:
   const agent = new AWWAgent({ url: "ws://localhost:9002", apiKey: "aww_xxx" });
   await agent.connect();

3. 국가 운영권 획득:
   await agent.claimCountry("KOR", ["combat", "economy", "diplomacy"]);

4. 브리핑 수신 → 결정 제출:
   agent.onBriefing(async (briefing) => {
     if (briefing.domain === 'economy') {
       return { action: 'set_tax_policy', params: { pit: 0.20 } };
     }
     return briefing.aiSuggestion;  // NationalAI 추천 사용
   });

5. 결과 관찰:
   agent.observe.onWorldUpdate((state) => console.log(state));
```

**기존 `game.sh` 통합:**
```bash
# game.sh에 simulate 커맨드 추가
./game.sh simulate              # Hybrid 모드 기본 실행
./game.sh simulate --speed=100  # 가속 시뮬
./game.sh simulate --headless   # Headless 밸런스 테스트
```

---

## 8. 경제 시스템 (SuperPower 기반)

### 8.1 자원 체계 (12종 — SP2의 27종 축약)

| # | 자원 | 카테고리 | 기본 성장 | SP2 원본 매핑 | 용도 |
|---|------|---------|----------|-------------|------|
| 1 | **Grain** | 식량 | 1%/h | 곡물+채소+육류+유제품 | 인구 유지, 안정도 |
| 2 | **Energy** | 에너지 | 2%/h | 전기+화석연료 | 모든 생산의 기반 |
| 3 | **Oil** | 에너지 | 1.5%/h | 석유 (분리) | 군사 운영, 원거리 배치 |
| 4 | **Minerals** | 원자재 | 1%/h | 광물+보석 | 무기 생산, 건설 |
| 5 | **Steel** | 원자재 | 1.5%/h | 철강+목재 | 유닛 생산, 인프라 |
| 6 | **Chemicals** | 산업재 | 10%/h | 화학+제약+플라스틱 | 기술 연구, 의료 |
| 7 | **Machinery** | 산업재 | 10%/h | 기계 | 생산력 증폭 |
| 8 | **Electronics** | 완제품 | 13%/h | 전자기기+가전 | 기술 레벨, 통신 |
| 9 | **Vehicles** | 완제품 | 13%/h | 차량 | 군사 기동력 |
| 10 | **Services** | 서비스 | 16%/h | 건설+소매+관광 등 | GDP 핵심, 고용 |
| 11 | **Tech** | 서비스 | 16%/h | 엔지니어링+의료+교육 | 연구, 유닛 강화 |
| 12 | **Gold** | 화폐 | — | 세수 기반 | 범용 화폐 |

### 8.2 GDP 공식 (SP2 충실 재현)

```
국가 GDP = Σ (resource[i].production × resource[i].market_price) + trade_income - trade_expense

where:
  resource[i].production = base_production × tier_mult × health_mult × policy_mult
  health_mult = economic_health / 100 × 2  (SP2: 100%일 때 2배, 0%면 0)
  policy_mult = government_type_modifier × privatization_bonus × corruption_penalty

  trade_income  = Σ (export_resource[j] × export_price[j])   ← GDP 증가
  trade_expense = Σ (import_resource[k] × import_price[k])   ← GDP 감소
```

### 8.3 세금 3층 구조

```go
type TaxSystem struct {
    PIT           float64                    // 개인소득세 (0~60%) — 주요 재원
    ResourceTax   map[ResourceType]float64   // 자원별 세금 (0~30%)
    GTM           float64                    // 글로벌 세금 수정치 (-50% ~ +100%)
}

func (t *TaxSystem) CalculateRevenue(gdp float64, resources map[ResourceType]*ResourceState) float64 {
    revenue := gdp * t.PIT / 100
    for rType, state := range resources {
        effectiveRate := t.ResourceTax[rType] * (1 + t.GTM/100)
        revenue += state.Production * state.MarketPrice * effectiveRate / 100
    }
    return revenue
}

// SP2 트레이드오프: 높은 세율 → 성장 페널티
func (t *TaxSystem) GetGrowthPenalty() float64 {
    avgRate := (t.PIT + average(t.ResourceTax)) / 2
    switch {
    case avgRate > 40: return 0.7   // 30% 성장 페널티
    case avgRate > 25: return 0.85  // 15% 성장 페널티
    default:           return 1.0   // 페널티 없음
    }
}
```

### 8.4 예산 배분 (8종 슬라이더, 합계 100%)

| 예산 항목 | 효과 | 트레이드오프 | 범위 |
|----------|------|-----------|------|
| **Infrastructure** | 경제 건강도+, 생산 기반 | 장기 투자 (3-5 에포크) | 0~30% |
| **Telecom** | 경제 건강도+, Tech 보너스 | 장기 투자 | 0~20% |
| **Education** | Services/Tech 성장률+ | 3-5 에포크 후 효과 | 0~20% |
| **Healthcare** | 인구 유지, 안정도+ | 생존 필수 | 0~15% |
| **Military** | 유닛 생산/유지, 기술 연구 | 경제 성장 감소 | 0~40% |
| **Government** | 부패 감소, 안정도+ | 비효율적 소비 | 0~15% |
| **Propaganda** | 국내 지지율+ | 글로벌 DR 하락 | 0~10% |
| **ForeignAid** | 글로벌 DR+, 특정 국가 DR++ | 자금 유출 | 0~10% |

```go
func CalculateEconomicHealth(budget BudgetAllocation, corruption float64) float64 {
    base := budget.Infrastructure*2.5 + budget.Telecommunications*2.0
    educationBonus := budget.Education * 0.5
    corruptionPenalty := corruption * 0.8
    return clamp(base + educationBonus - corruptionPenalty, 0, 100)
}
```

### 8.5 국유화/민영화

```go
type OwnershipPolicy struct {
    PublicSector  float64 // 0~100% (국유화 비율)
    PrivateSector float64 // 100 - PublicSector
}

// SP2 규칙: 민간 섹터가 40% 더 빠르게 성장
func (o *OwnershipPolicy) GetGrowthModifier() float64 {
    return o.PrivateSector/100*1.4 + o.PublicSector/100*1.0
}
// 트레이드오프: 민영화 = 빠른 성장 but 자원 직접 통제 불가
//             국유화 = 느린 성장 but 자원 배분 완전 제어
```

### 8.6 외부 에이전트 경제 API (Decision API 매핑)

| Action | Params | 효과 |
|--------|--------|------|
| `set_tax_policy` | `{pit, resource_tax, gtm}` | 세율 변경 → 수입/성장 조절 |
| `set_budget` | `{infra, telecom, edu, health, military, govt, propaganda, aid}` | 예산 배분 (합 100%) |
| `propose_trade` | `{resource, amount, price, target_iso}` | 무역 주문 제출 |
| `accept_trade` | `{trade_id}` | 무역 제안 수락 |
| `set_ownership` | `{sector, action: nationalize|privatize}` | 국유화/민영화 |

> **Decision 주기**: 경제 결정은 1시간(게임 내) 단위. 외부 에이전트는 Briefing으로 경제 스냅샷 수신 → Decision 제출.

---

## 9. 외교 시스템 (DR 기반)

### 9.1 Diplomatic Relation (DR) 시스템

모든 외교 결정은 **DR 값 (-100 ~ +100)** 에 의해 제어됨 (SP2 핵심 원칙).

```go
type DiplomaticRelation struct {
    CountryA    string  // ISO3
    CountryB    string  // ISO3
    DR          float64 // -100 ~ +100
    LastChanged time.Time
}
```

**DR 수정자 상수:**

| 수정자 | 값 | 적용 범위 |
|--------|-----|----------|
| SameGovernment | +10 | 양자 (같은 정부형태) |
| SimilarLaws | +2/항목, max +10 | 양자 |
| SharedLanguage | +5 | 양자 |
| SharedReligion | +5 | 양자 |
| TradePartner | +0.1/h (활성 무역) | 양자 |
| NukeResearch | **-55** | 글로벌 (전체 국가) |
| MissileDefense | -35 | 글로벌 |
| Propaganda | -0.5/예산% | 글로벌 |
| ForeignAid | +0.3/예산% | 글로벌 |
| NobleCause 조약 | 멤버 +1/day, 비멤버 -2/day | 조약 기반 |
| WarHistory | -30 (점진 회복) | 양자 |
| TreatyBreach | -50 (6개월 지속) | 양자 |

> **시스템 상호연결 핵심**: 핵 연구 시작 → 전 세계 DR -55 → 무역 파트너 이탈 → GDP 하락 → 군비 축소 → 취약

### 9.2 조약 시스템 (10종 — 양자 + 다자)

| 조약 | DR 필요 | 효과 | 다자? | Max |
|------|--------|------|-------|-----|
| **Cultural Exchange** | ≥10 | DR +0.5/day | Yes | 50 |
| **Noble Cause** | ≥20 | 멤버 +1 DR/day, 비멤버 -2/day | Yes | 30 |
| **Trade Agreement** | ≥30 | 무역 수수료 -50% | Yes | 20 |
| **Common Market** | ≥50 | 잉여 자원 자동 공유 (최강) | Yes | 10 |
| **Non-Aggression** | ≥30 | 상호 공격 불가 (72h) | No | — |
| **Military Alliance** | ≥60 | 공동 방어, 유닛 위치 공유 | Yes | 10 |
| **Debt Assumption** | ≥80 | 대상국 부채 인수 | No | — |
| **War Declaration Request** | ≥70 | 동맹 강제 참전 | No | — |
| **Economic Sanction** | — | 대상과 전체 무역 차단 | Yes | 50 |
| **Peaceful Annexation** | ≥95 | 국가 흡수 (극히 어려움) | No | — |

### 9.3 다자 조약 엔진

```go
type MultilateralTreaty struct {
    ID          string
    Type        TreatyType
    Name        string             // 에이전트가 이름 부여 (예: "Pacific Trade Alliance")
    Founder     string             // ISO3
    Members     []string
    MaxMembers  int
    DRThreshold float64            // 가입 최소 DR (설립국 기준)
    CreatedAt   time.Time
    Conditions  []TreatyCondition  // 특수 조건 (예: "핵 보유국 불가")
}

// 가입 로직: 신청국 DR ≥ threshold AND 모든 기존 멤버 DR ≥ threshold × 0.7
func (t *MultilateralTreaty) RequestJoin(applicant string, drMatrix map[string]map[string]float64) error
```

**Common Market** 특수 능력: `DistributeSurplus()` — 잉여 자원을 가진 국가에서 부족 국가로 무료 자동 재분배.

### 9.4 외부 에이전트 외교 API (Decision API 매핑)

| Action | Params | 효과 |
|--------|--------|------|
| `propose_treaty` | `{type, target_isos, name, conditions}` | 조약 제안 |
| `respond_treaty` | `{treaty_id, accept: bool}` | 조약 응답 |
| `leave_treaty` | `{treaty_id}` | 조약 탈퇴 |
| `declare_war` | `{target_faction, reason}` | 선전포고 (DR 필요조건 확인) |
| `propose_peace` | `{war_id, terms}` | 휴전 제안 |
| `impose_sanction` | `{target_iso}` | 경제 제재 |
| `surrender` | `{}` | 항복 |

> **Briefing 포함 정보**: DR 현황 (관찰 국가 상세, 나머지 요약), 활성 조약, 진행 중 전쟁, 긴장 핫스팟, 최근 이벤트.

---

## 10. 군사 시스템 (유닛 상성)

### 10.1 유닛 클래스 (5종 — SP2 축약)

| 클래스 | 역할 | Strong vs | Weak vs | 특수 |
|--------|------|-----------|---------|------|
| **Infantry** | 다수, 저렴, 기본 | Vehicles | Armor, Artillery | 수적 우위 보너스 |
| **Armor** | 고HP/DPS, 느림 | Infantry | Artillery, Aircraft | 정면 돌파 |
| **Artillery** | 장거리, 저HP | Armor | Infantry, Aircraft | 사거리 극대화 |
| **Aircraft** | 빠름, 중공격 | Infantry, Artillery | Anti-Air | 지형 무시 |
| **Special** | 희귀, 극한 효과 | All (제한적) | 고비용 | 핵: DR -55 글로벌 |

### 10.2 상성 매트릭스 (Rock-Paper-Scissors)

```
Attack\Defend  Infantry  Armor  Artillery  Aircraft  Special
Infantry        1.0      0.5     1.2        0.8       0.3
Armor           1.5      1.0     0.6        0.9       0.4
Artillery       0.8      1.4     1.0        0.5       0.5
Aircraft        1.3      1.1     1.3        1.0       0.3
Special         2.0      2.0     2.0        2.0       1.0
```

> 1.0 = 기준, >1.0 = 유리, <1.0 = 불리

### 10.3 데미지 계산

```go
func CalculateDamage(attacker, defender *Agent) float64 {
    baseDmg := attacker.WeaponDPS
    counterMult := UnitCounterMatrix[attacker.UnitClass][defender.UnitClass]
    techAdvantage := float64(attacker.TechLevel-defender.TechLevel) * 0.05
    techMult := 1.0 + clamp(techAdvantage, -0.3, 0.3)
    trainMult := TrainingMultiplier[attacker.TrainingGrade]
    return baseDmg * counterMult * techMult * trainMult
}
```

**훈련 등급 배수:**

| 등급 | 배수 |
|------|------|
| Recruit | 0.7 |
| Regular | 1.0 |
| Veteran | 1.2 |
| Elite | 1.5 |

### 10.4 기술 레벨 (국가 단위)

```go
type MilitaryTech struct {
    Firearms  int // Lv 0-10: 소형무기/미사일 → Infantry, Armor DPS
    Aerospace int // Lv 0-10: 항공 기술 → Aircraft 성능
    Naval     int // Lv 0-10: 해군 기술 → 해상 유닛 (미래)
    Stealth   int // Lv 0-10: 스텔스 → 정찰 회피, 기습 보너스
    ArmorTech int // Lv 0-10: 방어구 → 방어력
}

// 업그레이드 비용 (지수적): 500 × 1.8^level
// Lv0→1: 500 Tech  |  Lv5→6: 9,477 Tech  |  Lv9→10: 86,093 Tech
```

### 10.5 핵무기 (3단계)

| 단계 | 연구 시간 | 효과 | DR 패널티 |
|------|----------|------|----------|
| Lv1 (전술핵) | 72h | 한정 지역 파괴 | -55 글로벌 |
| Lv2 (전략핵) | +48h | 도시 파괴 | 추가 -20 |
| Lv3 (ICBM) | +72h | 대륙간 타격 | 추가 -30 |

> **미사일 방어**: MissileDefense 연구로 핵 방어 가능 (DR -35 글로벌 페널티)

### 10.6 외부 에이전트 군사 API (Decision API 매핑)

| Action | Params | 효과 |
|--------|--------|------|
| `produce_units` | `{class, count}` | 유닛 생산 (Steel + Gold 소비) |
| `disband_units` | `{class, count}` | 유닛 해산 (유지비 절감) |
| `deploy_force` | `{target_iso, composition}` | 병력 배치 |
| `recall_force` | `{target_iso}` | 병력 회수 |
| `invest_tech` | `{category, amount}` | 기술 투자 (Tech 자원 소비) |
| `set_training` | `{priority_grade}` | 훈련 우선순위 |
| `launch_nuke` | `{target_iso}` | 핵 발사 (**DR -55 글로벌**) |

> **유지비**: 전체 병력 × Oil + Gold / 시간. Military 예산이 유지비 미달 시 유닛 자동 해산.

---

## 11. 정치 시스템 (정부 형태)

### 11.1 정부 형태 (6종 — SP2 충실 재현)

| 정부 | 생산배수 | 수요배수 | 부패% | 군유지배수 | 쿠데타% | 선거 | 예시 |
|------|---------|---------|-------|----------|--------|------|------|
| **MultiParty Democracy** | 1.3 | 1.2 | 5% | 1.0 | 2% | 4yr (50% 필요) | USA, DEU |
| **Single Party** | 1.1 | 1.0 | 20% | 0.9 | 5% | 형식적 (항상 승리) | CHN, CUB |
| **Communist** | 0.7 | 0.6 | 8% | 1.2 | 8% | 없음 | PRK |
| **Military Dictatorship** | 0.5 | 0.5 | 25% | 0.6 | 15% | 없음 | — |
| **Monarchy** | 0.8 | 0.7 | 18% | 0.9 | 10% | 없음 | SAU, JOR |
| **Theocracy** | 0.7 | 0.6 | 15% | 1.0 | 8% | 없음 (종교 조건) | IRN |

```go
type GovernmentType struct {
    Name              string
    ProductionMult    float64 // 자원 생산 배수
    DemandMult        float64 // 자원 소비 배수
    BaseCorruption    float64 // 기본 부패율 (%)
    MilitaryMaintMult float64 // 군사 유지비 배수
    CoupVulnerability float64 // 쿠데타 취약도 (%)
    ElectionCycle     int     // 에포크 기준 선거 주기 (0=없음)
    ElectionThreshold float64 // 당선 필요 지지율 (%) (0=자동 당선)
    DRBonusSameType   float64 // 동일 정부형태 간 DR 보너스
}

// 모든 시스템에 정부형태 수정자 적용
func (g *GovernmentType) ApplyModifiers(country *Country) {
    // 경제: ProductionRate *= ProductionMult, DemandRate *= DemandMult
    // 부패: Corruption = BaseCorruption
    // 군사: MilitaryMaintenance *= MilitaryMaintMult
    // 외교: 동일 정부형태 국가 간 DR += DRBonusSameType
}
```

### 11.2 국내법 / 정책 (5종)

| 정책 | 옵션 | 경제 효과 | DR 효과 |
|------|------|----------|--------|
| **Freedom of Speech** | Free / Restricted / Censored | Free: Services +10% / Censored: stability +5 | Restricted: -5 / Censored: -15 |
| **Child Labor** | Banned / Permitted | Permitted: 전 자원 +10% | Permitted: DR -10 |
| **Women's Suffrage** | Equal / Limited / None | Equal: Services +5%, 생산성 +10% | Limited: -5 / None: -15 |
| **Immigration** | Open / Selective / Closed | Open: 노동력 +15%, 안정도 -5 | Open: +3 / Closed: -3 |
| **Environment** | Green / Standard / Exploitative | Exploit: 자원 +15%, 식량 -10% | Green: +5 / Exploit: -8 |

> **핵심 트레이드오프**: 경제적 이득이 큰 정책은 DR 하락 → 고립 → 무역 손실. 모든 결정이 파급 효과.

### 11.3 지지율 / 선거 / 쿠데타

```go
type PoliticalState struct {
    Government     GovernmentType
    ApprovalRate   float64           // 0~100%
    DomesticLaws   map[string]string
    ElectionTimer  int               // 다음 선거까지 에포크
    CoupRisk       float64           // 0~100%
    StabilityIndex float64           // 0~100
}

// 지지율 계산
func CalculateApproval(state *PoliticalState, economy *EconomyState, military float64) float64 {
    base := 50.0
    base += (economy.EconomicHealth - 50) * 0.4  // 경제가 최대 영향
    if state.Government.Name == "MilitaryDictatorship" && military > 50000 {
        base -= 10 // 군사독재 대규모 병력 → 민심 하락
    }
    base += state.Budget.Propaganda * 2 // 선전 예산 → 지지율+
    if len(state.ActiveWars) > 0 {
        base -= 15 // 전쟁 중 → 지지율 하락 (왕정은 -5만)
    }
    return clamp(base, 0, 100)
}

// 쿠데타 체크 (매 에포크)
func CheckCoup(state *PoliticalState) bool {
    if state.ApprovalRate > 40 { return false } // 안전 임계값
    coupChance := state.Government.CoupVulnerability * (1 - state.ApprovalRate/100)
    return rand.Float64() < coupChance/100
}
```

### 11.4 외부 에이전트 정치 API (Decision API 매핑)

| Action | Params | 효과 |
|--------|--------|------|
| `change_government` | `{type}` | 정부 형태 변경 (DR + 안정도 변동) |
| `set_law` | `{law, value}` | 국내법 변경 |
| `call_election` | `{}` | 선거 소집 (민주주의만) |
| `declare_martial_law` | `{}` | 계엄령 (안정도+, DR-) |
| `lift_martial_law` | `{}` | 계엄령 해제 |

> **결정 주기**: 정치 결정은 24시간(게임 내) 단위. 정부 변경은 쿠데타/혁명 시에만 가능 (쿨다운 있음).

---

## 12. AI 학습 & 메모리 통합

기존 `memory.go` (전투 전용, 351줄) → **5도메인 통합 WorldMemory** 로 확장.

### 12.1 WorldMemory 구조

```go
type WorldMemory struct {
    AgentID        string
    NationalityISO string

    // 전투 메모리 (기존 확장)
    CombatHistory  []CombatRoundResult
    BuildStats     map[string]*BuildPerformance

    // 경제 메모리 (NEW)
    EconomyHistory []EconomicDecisionRecord  // 정책 결정 → GDP 변화 추적
    TaxEffectMap   map[float64]float64       // 세율 → 성장률 상관관계
    TradeHistory   []TradeRecord

    // 외교 메모리 (NEW)
    DiplomacyHistory []DiplomacyRecord       // 조약/전쟁 이력 + 결과
    TrustScores     map[string]float64        // 팩션별 신뢰도 (약속 이행률)
    BetrayalLog     []BetrayalEvent           // 배신 기록 (조약 위반)

    // 군사 메모리 (NEW)
    MilitaryHistory []MilitaryRecord          // 전투 결과 + 유닛 효과
    CounterPickLog  map[string]UnitComposition // 적 팩션별 최적 유닛 편성

    // 정치 메모리 (NEW)
    PolicyEffects   []PolicyEffectRecord      // 정책 변경 → 지지율/경제 영향
    CoupLog         []CoupEvent               // 쿠데타 발생/방어 이력
}
```

### 12.2 의사결정 피드백 루프

```
1. 에이전트 결정: "PIT를 35%로 인상"
2. 시스템 실행: 세율 적용
3. 1시간 후 결과 측정: GDP -2%, 세수 +15%, 성장률 -8%
4. 피드백 기록: {decision: "tax_up_35", outcome: "mixed", gdp_delta: -0.02, revenue_delta: +0.15}
5. 다음 결정 참조: "PIT 35%는 세수를 올리지만 GDP를 낮춘다"
```

- **LLM 에이전트**: 자연어 피드백 요약 → 컨텍스트에 포함
- **커스텀 봇**: 수치 테이블 → 최적 범위 학습

### 12.3 시즌 간 학습 전이

```go
type SeasonLearning struct {
    Season       int
    FinalRank    int
    TotalGDP     float64
    Territories  int

    BestDecisions       []DecisionOutcome  // 상위 10개 결정
    WorstDecisions      []DecisionOutcome  // 하위 10개 결정
    EffectiveAlliances  []string           // 효과적 동맹국
    DangerousEnemies    []string           // 위험 적국
    OptimalTaxRange     [2]float64         // 최적 세율 범위
    BestUnitComposition map[string]float64 // 최적 유닛 비율
    BestGovernment      string             // 최효율 정부형태
}
```

새 시즌 시작 시 최근 3시즌 가중 평균으로 초기 설정:
- 초기 정부형태 (최고 성과)
- 초기 세율 (최적 범위)
- 우선 외교 대상 (역대 효과적 동맹)

### 12.4 SDK v2 메모리 API

```typescript
// 이번 시즌 이력
getDecisionLog(domain: DomainType, limit?: number): DecisionRecord[];
getPerformanceMetrics(): PerformanceMetrics;

// 시즌 간 학습
getSeasonHistory(): SeasonLearning[];
getBestPractices(): BestPractice[];

// LLM 에이전트 헬퍼 (자연어)
getSituationSummary(): string;
// → "최근 3시간: GDP 5% 성장, JPN과 무역 협정 체결, 동남아 확장 성공"
getDecisionFeedback(decisionId: string): string;
// → "세금 인상으로 세수 증가했지만 GDP 하락"
getStrategicAdvice(): string;
// → "KOR에게는 경제 우선 전략이 효과적이었음"
```

---

## 13. 리스크 분석

| # | 리스크 | 영향 | 확률 | 완화 전략 |
|---|--------|------|------|----------|
| R1 | **시스템 복잡도 폭발** | 5도메인 × 상호연결 = 디버깅 지옥 | 높음 | 도메인별 단계 추가, 독립 테스트 |
| R2 | **LLM API 비용** | 5도메인 브리핑/시간 = 대량 토큰 소비 | 높음 | 압축 브리핑 (<2K 토큰), 사용자 API키, 무료 기본 봇 |
| R3 | **LLM 응답 지연** | 5도메인 결정 = 2-5초 지연 | 중간 | 2초 타임아웃 + rule-based 폴백, 비동기 처리 |
| R4 | **밸런스 붕괴** | SP2 공식 직접 적용 시 의도치 않은 익스플로잇 | 높음 | Headless 시뮬 대량 밸런스 테스트 (v16) |
| R5 | **유닛 상성 단순화** | 5종으로는 전략 깊이 부족 | 중간 | Tech Level × Training Grade로 깊이 추가 |
| R6 | **다자 조약 악용** | 50국 Common Market = 경제 독점 | 높음 | 멤버 캡 (10), DR 가입 요건 점진 상승 |
| R7 | **핵 외교 무기화** | DR -55 페널티가 게임 밸런스 파괴 | 중간 | 긴 연구 시간 (72h), 미사일 방어 존재, 3단계 제한 |
| R8 | **정부형태 수렴** | 모든 에이전트가 민주주의 선택 (최고 생산) | 중간 | 각 형태의 고유 장점 강화 (독재=빠른 군사, 왕정=안정성) |
| R9 | **SDK v2 하위 호환** | v1 에이전트가 v2에서 깨질 수 있음 | 낮음 | v1 API 완전 유지, v2는 엔드포인트 추가만 |
| R10 | **월드 상태 동기화** | 195국 × 12자원 × DR 매트릭스 = 거대 데이터 | 중간 | diff 기반 업데이트, 관찰 국가만 상세, 나머지 요약 |
| R11 | **신규 진입 장벽** | 5도메인 = 압도적 복잡성 | 높음 | 기본 어드바이저 자동 설정, 전투만으로도 플레이 가능, 점진 해금 |
| R12 | **쿠데타/혁명 그리핑** | 의도적 내정 간섭 남용 | 중간 | 높은 쿠데타 비용, 실패 시 큰 DR 패널티, 쿨다운 |
| R13 | **하이브리드 모드 복잡성** | External + NationalAI 혼재 시 동기화 이슈 | 높음 | OperatorRegistry 단일 진입점, 폴백 자동화 |
| R14 | **시간 가속 × 외부 에이전트** | ×100+에서 외부 응답 불가능 | 중간 | ×10 이하만 외부 허용, ×100+는 NationalAI 전환 강제 |

---

## 14. 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: 기반 타입 & 12종 자원 시스템

| Task | 설명 |
|------|------|
| 도메인 타입 정의 | `domain/resources.go` — 12 resource types, ResourceState, production/consumption 공식 |
| 정부 타입 정의 | `domain/government.go` — 6 government types, modifier tables, GovernmentType struct |
| 유닛 클래스 정의 | `domain/units.go` — 5 unit classes, counter matrix, TrainingGrade |
| 조약 타입 정의 | `domain/treaties.go` — 10 treaty types, bilateral/multilateral, DR 요건 |
| 경제 엔진 v2 | `meta/economy_v2.go` — 12자원 production/consumption, GDP 공식 (SP2), 3층 세금, 8종 예산 |
| 기존 meta 연동 | economy_v2.go가 기존 EconomyEngine을 통합 인터페이스로 대체 |

- **design**: N (백엔드 로직)
- **verify**: 빌드 성공, 단위 테스트 (GDP 계산, 자원 생산, 세금 공식), 기존 기능 보존

### Phase 2: DR 외교 & 다자 조약 시스템

| Task | 설명 |
|------|------|
| DR 시스템 구현 | `meta/diplomacy_v2.go` — 195×195 DR 매트릭스, 자동 보정 (정부/문화/종교) |
| 다자 조약 엔진 | MultilateralTreaty, join/leave/expire, Common Market 자원 공유 |
| 기존 DiplomacyEngine 통합 | v1 양자 조약 → v2 DR 기반 시스템 마이그레이션, 하위 호환 |
| DR 이벤트 연동 | 선전포고/핵연구/조약위반 → 자동 DR 변경 |

- **design**: N (백엔드 로직)
- **verify**: DR 계산 정확성 테스트, 다자 조약 가입/탈퇴 테스트, Common Market 분배 테스트

### Phase 3: 정치 시스템 & 유닛 클래스

| Task | 설명 |
|------|------|
| 정치 엔진 구현 | `politics/government.go` — 6 정부형태 수정자, 지지율 계산, 선거/쿠데타 |
| 국내법 시스템 | `politics/policies.go` — 5종 국내법, DR/경제 동시 효과 |
| 유닛 클래스 시스템 | `military/unit_classes.go` — 5 유닛 타입, 생산/해산/유지, UnitClass 필드 |
| 전투 상성 적용 | `military/combat_resolver.go` — Counter matrix 데미지 계산, tech/training 적용 |
| Agent struct 확장 | `domain/types.go` — UnitClass, TechLevel, TrainingGrade 필드 추가 |

- **design**: N (백엔드 로직)
- **verify**: 정부 수정자 테스트, 유닛 상성 전투 테스트, 지지율 계산 테스트

### Phase 4: OperatorRegistry & DecisionRouter (v17 핵심)

| Task | 설명 |
|------|------|
| OperatorRegistry 구현 | `sim/operator.go` — 195국 × 5도메인 운영자 매핑, Get() 메서드, 런타임 전환 |
| DecisionRouter 구현 | `sim/decision.go` — 통합 결정 진입점, 권한 확인, 타임아웃 폴백 |
| DecisionQueue 구현 | `sim/queue.go` — 틱 기반 결정 큐, Enqueue/DrainTick |
| BriefingHub 구현 | `sim/briefing.go` — 외부 에이전트에 도메인별 브리핑 WS 전송 |
| NationalAI 기본 스텁 | `strategy/national_ai.go` — Decide() 인터페이스 + 기본 rule-based 폴백 (Phase 8에서 확장) |
| StrategicDecisionEngine | `strategy/engine.go` — 195국 NationalAI 관리자, GetAI() |
| AllCountryCodes 정의 | `world/country_codes.go` — 195국 ISO3 코드 리스트 변수 |
| SimEngine v17 확장 | `sim/engine.go` — processStrategicTick()에 operator 분기 추가 |
| simulate CLI 바이너리 | `cmd/simulate/main.go` — CLI 플래그, SimEngine 초기화, 실행 |
| 3종 운영 모드 | Pure Simulation / Hybrid / Full Agent 모드 전환 |

- **design**: N (핵심 인프라)
- **verify**: OperatorRegistry CRUD 테스트, 폴백 타임아웃 테스트, 3모드 전환 테스트, `go build ./cmd/simulate/` 성공

### Phase 5: 서버 API v2 엔드포인트

| Task | 설명 |
|------|------|
| 인증 API | `api/v2/auth_routes.go` — register/verify, Bearer 토큰 미들웨어 |
| 국가 운영 API | `api/v2/country_routes.go` — list/claim/release/transfer/operators |
| 결정 API | `api/v2/decision_routes.go` — submit/pending |
| 경제 API | `api/v2/economy_routes.go` — tax/budget/trade/ownership 엔드포인트 |
| 외교 API | `api/v2/diplomacy_routes.go` — treaty/war/peace/surrender/sanction/DR 조회 |
| 군사 API | `api/v2/military_routes.go` — produce/disband/deploy/recall/tech/training/nuke |
| 정치 API | `api/v2/politics_routes.go` — government/law/election/martial-law |
| 관찰 API | `api/v2/observe_routes.go` — world snapshot/country detail/domain detail |
| WS v2 프로토콜 | `ws/v2_stream.go` — v2_auth, briefing, decision_result/rejected, world_update, domain_event |
| 인증 & Rate Limit | v2 API 인증 (API Key → AgentID → 국가/도메인 권한), 도메인별 rate limit |

- **design**: N (API 레이어)
- **verify**: 전체 엔드포인트 단위 테스트, 인증 테스트, rate limit 테스트

### Phase 6: aww-agent-skill SDK v2

| Task | 설명 |
|------|------|
| MetaClient 구현 | `src/meta-client.ts` — Meta REST + Meta WS 클라이언트 |
| 5 도메인 클래스 | `src/domains/{combat,economy,diplomacy,military,politics}.ts` |
| WorldObserver 구현 | `src/observer.ts` — 월드 관찰, 1Hz 업데이트, 이벤트 구독 |
| AWWAgent v2 통합 | `src/agent.ts` — 5도메인 오케스트레이터, v1 하위 호환 |
| 기본 어드바이저 4종 | `src/advisors/{econ,diplo,military,politics}-advisor.ts` — rule-based 기본 AI |
| LLM 브릿지 | `src/llm/llm-bridge.ts` — Claude/GPT/Llama API 추상화 |
| LLM 프롬프트 | `src/llm/prompts.ts` — 도메인별 프롬프트 템플릿 |
| 타입 정의 확장 | `src/types.ts` — 5도메인 TypeScript 타입 전체 |

- **design**: N (SDK)
- **verify**: SDK 빌드 성공, 타입 체크 통과, 기본 어드바이저 동작 테스트

### Phase 7: AI 학습 & WorldMemory

| Task | 설명 |
|------|------|
| WorldMemory 구현 | `agent/world_memory.go` — 5도메인 통합 메모리 (기존 memory.go 확장) |
| 피드백 루프 | 결정 → 결과 측정 → 피드백 기록 → 다음 결정 참조 |
| 시즌 간 학습 | `agent/season_learning.go` — 최근 3시즌 가중 평균, 초기 설정 자동화 |
| SDK 메모리 API | `src/memory.ts` — getDecisionLog, getSituationSummary, getStrategicAdvice |

- **design**: N (백엔드 + SDK)
- **verify**: 메모리 저장/조회 테스트, 시즌 학습 전이 테스트

### Phase 8: v16 SimEngine 통합 & 밸런스 검증

| Task | 설명 |
|------|------|
| SimEngine v17 연동 | v16 SimulationEngine이 v17 economy/diplomacy/politics 시스템 사용 |
| NationalAI v17 확장 | `strategy/national_ai.go` — 12자원 + DR + 정부형태 기반 의사결정 |
| Headless 밸런스 테스트 | ×1000 속도 시뮬, 100회 — 정부형태/자원/조약 밸런스 검증 |
| 수치 조정 | 밸런스 테스트 결과 기반 파라미터 튜닝 |
| 상호연결 검증 | 파급 체인 검증: 핵연구 → DR → 무역 → GDP → 군사 |

- **design**: N (시뮬레이션)
- **verify**: 100회 시뮬 완료, 6종 정부 모두 생존, GDP 분포 합리적

### Phase 9: 예제 & 문서

| Task | 설명 |
|------|------|
| full-nation-agent 예제 | `examples/full-nation-agent.ts` — 5도메인 기본 어드바이저 사용 |
| llm-nation-agent 예제 | `examples/llm-nation-agent.ts` — Claude API로 국가 운영 |
| economic-optimizer 예제 | `examples/economic-optimizer.ts` — GDP 최대화 특화 봇 |
| README v2 | SDK v2 API 문서, 퀵스타트, 도메인별 가이드 |
| OpenAPI spec v2 | 서버 v2 API 전체 OpenAPI 3.0 스펙 |

- **design**: N (문서/예제)
- **verify**: 예제 실행 성공, README 링크 검증

### Phase 10: 프론트엔드 UI (선택적)

| Task | 설명 |
|------|------|
| Economy Dashboard | 12자원 생산/소비 차트, 세금/예산 슬라이더, 무역 마켓 |
| Diplomacy Panel | DR 히트맵, 조약 관리, 선전포고 UI |
| Military Panel | 유닛 편성 차트, 배치 지도, 기술 트리 |
| Politics Panel | 정부형태 선택, 국내법 토글, 지지율 게이지 |
| World State Panel | 통합 세계 상태 대시보드, 이벤트 타임라인 |

- **design**: Y (UI 중심)
- **verify**: 페이지 렌더링, 반응형 확인, 접근성 기본 검사
