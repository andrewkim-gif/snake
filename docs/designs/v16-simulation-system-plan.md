# AI World War — 195국 전체 시뮬레이션 시스템 기획서

> **문서 버전**: 1.0
> **작성일**: 2026-03-07
> **기반**: GAME-SYSTEM-ANALYSIS.md + 서버 코드 분석 (v10~v16)
> **목표**: 195개국 AI 에이전트가 자율적으로 전투·외교·경제를 운영하는 완전 자동 월드 시뮬레이션

---

## 목차

1. [시뮬레이션 개요](#1-시뮬레이션-개요)
2. [아키텍처 설계](#2-아키텍처-설계)
3. [AI 에이전트 계층 구조](#3-ai-에이전트-계층-구조)
4. [국가별 AI 성격 시스템](#4-국가별-ai-성격-시스템)
5. [팩션 자동 형성 시스템](#5-팩션-자동-형성-시스템)
6. [시뮬레이션 실행 엔진](#6-시뮬레이션-실행-엔진)
7. [전략 AI 의사결정](#7-전략-ai-의사결정)
8. [경제·외교·전쟁 자동화](#8-경제외교전쟁-자동화)
9. [시간 가속 & 스케일링](#9-시간-가속--스케일링)
10. [관전 & 분석 시스템](#10-관전--분석-시스템)
11. [구현 로드맵](#11-구현-로드맵)

---

<!-- SECTION_1 -->

## 1. 시뮬레이션 개요

### 1.1 비전

> **"195개국 AI 에이전트가 24/7 자율적으로 전투하고, 동맹을 맺고, 경제를 운영하며, 세계를 정복하는 완전 자동화 지정학 시뮬레이션"**

인간 개입 없이 AI 에이전트들이 한 시즌(4주)을 처음부터 끝까지 스스로 플레이한다. 유저는 관전자/분석가로서 세계 역사의 전개를 지켜본다.

### 1.2 시뮬레이션 목적

| 목적 | 설명 |
|------|------|
| **게임 밸런스 검증** | 195국 tier·자원·지형 밸런스를 대규모로 테스트 |
| **컨텐츠 생성** | AI 간 전쟁·동맹·반전 드라마 → 관전 콘텐츠/리플레이 |
| **토큰 이코노미 시뮬** | GDP·바이백·소각 경제 순환 시뮬레이션 |
| **AI 에이전트 쇼케이스** | 다양한 AI 성격·전략이 경쟁하는 "AI 올림픽" |
| **시스템 스트레스 테스트** | 195개 아레나 동시 운영 성능 검증 |

### 1.3 시뮬레이션 모드

| 모드 | 시간 배율 | 용도 | 1시즌 소요 |
|------|----------|------|-----------|
| **Realtime** | ×1 | 라이브 관전, 실제 운영 | 4주 |
| **Accelerated** | ×10 | 밸런스 테스트, 데모 | 2.8일 |
| **Turbo** | ×100 | 통계적 분석, 대규모 시뮬 | 6.7시간 |
| **Headless** | ×1000+ | CI/CD 밸런스 검증, 몬테카를로 | ~40분 |

### 1.4 핵심 수치

| 항목 | 값 |
|------|-----|
| 국가 수 | 195 |
| 총 AI 에이전트 | ~3,200 (tier별 차등) |
| 동시 활성 아레나 | 최대 50 (on-demand) |
| 자동 생성 팩션 | 20~40 (지역 기반) |
| 에포크 / 시즌 | ~40,320 (10분 × 4주) |
| 전략 결정 / 시간 | ~3,200 (에이전트당 1회/h) |

### 1.5 기존 시스템과의 관계

```
기존 AI World War 서버
├── WorldManager (195국 관리) ← 재사용
├── CountryArena (아레나 전투) ← 재사용
├── BotManager (봇 AI) ← 전술 레벨 재사용
├── EpochManager (에포크 사이클) ← 재사용
├── EconomyEngine (경제) ← 재사용
├── DiplomacyEngine (외교) ← 재사용
├── WarManager (전쟁) ← 재사용
├── SovereigntyEngine (주권) ← 재사용
└── FactionManager (팩션) ← 재사용

NEW: 시뮬레이션 전용 레이어
├── SimulationEngine (시뮬레이션 오케스트레이터)
├── NationalAI (국가별 전략 AI)
├── FactionFormationAI (팩션 자동 형성)
├── StrategicDecisionEngine (전략 의사결정)
├── DeploymentOptimizer (에이전트 배치 최적화)
├── SimulationClock (시간 가속 관리)
├── SimulationRecorder (기록/리플레이)
└── AnalyticsDashboard (분석 대시보드)
```

---

<!-- SECTION_2 -->

## 2. 아키텍처 설계

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SimulationEngine (오케스트레이터)                    │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ SimClock      │  │ SimRecorder   │  │ AnalyticsDashboard    │   │
│  │ (시간 가속)    │  │ (기록/리플레이) │  │ (실시간 분석/WebUI)    │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘   │
│          │                  │                      │               │
│  ════════╪══════════════════╪══════════════════════╪═══════════    │
│          │          STRATEGY LAYER (NEW)            │               │
│  ┌───────┴───────────────────────────────────────┐ │               │
│  │  StrategicDecisionEngine                       │ │               │
│  │  ├── NationalAI[195] (국가별 전략 AI)          │ │               │
│  │  ├── FactionFormationAI (팩션 자동 형성)        │ │               │
│  │  ├── DiplomacyAI (외교 자동화)                 │ │               │
│  │  ├── WarStrategyAI (전쟁 전략)                 │ │               │
│  │  └── DeploymentOptimizer (배치 최적화)          │ │               │
│  └───────┬───────────────────────────────────────┘ │               │
│          │                                         │               │
│  ════════╪═════════════════════════════════════════╪═══════════    │
│          │          EXISTING GAME LAYER (재사용)     │               │
│  ┌───────┴───────────────────────────────────────────┴───────────┐ │
│  │  WorldManager                                                 │ │
│  │  ├── CountryArena[195] (on-demand, max 50 active)             │ │
│  │  │   ├── Arena (20Hz game loop)                               │ │
│  │  │   ├── EpochManager (10분 사이클)                            │ │
│  │  │   ├── BotManager (전술 AI)                                  │ │
│  │  │   ├── WeaponSystem, CollisionSystem, OrbManager            │ │
│  │  │   └── NationScoreTracker                                   │ │
│  │  ├── SovereigntyEngine                                        │ │
│  │  ├── EconomyEngine                                            │ │
│  │  ├── DiplomacyEngine                                          │ │
│  │  ├── WarManager                                               │ │
│  │  └── FactionManager                                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ════════════════════════════════════════════════════════════════    │
│                        DATA LAYER                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ SimState │  │ EventLog │  │ Snapshot  │  │ AnalyticsStore   │   │
│  │ (메모리)  │  │ (파일/DB) │  │ (주기적)  │  │ (시계열 DB)      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 모듈 구조 (Go 패키지)

```
server/
├── cmd/
│   ├── server/          # 기존 게임 서버
│   ├── simulate/        # NEW: 시뮬레이션 CLI 엔트리포인트
│   │   └── main.go      # 설정 로딩, 시뮬레이션 실행
│   └── simweb/          # NEW: 관전 웹서버 (선택사항)
│       └── main.go
│
├── internal/
│   ├── game/            # 기존 게임 로직 (재사용)
│   ├── world/           # 기존 월드 관리 (재사용)
│   ├── meta/            # 기존 메타 시스템 (재사용)
│   │
│   ├── sim/             # NEW: 시뮬레이션 전용
│   │   ├── engine.go        # SimulationEngine — 메인 오케스트레이터
│   │   ├── clock.go         # SimClock — 시간 가속 제어
│   │   ├── config.go        # SimConfig — 시뮬레이션 설정
│   │   ├── state.go         # SimState — 글로벌 시뮬레이션 상태
│   │   ├── recorder.go      # SimRecorder — 이벤트/상태 기록
│   │   ├── snapshot.go      # 주기적 스냅샷 저장/복원
│   │   └── analytics.go     # 통계 수집/분석
│   │
│   ├── strategy/        # NEW: 전략 AI
│   │   ├── national_ai.go       # NationalAI — 국가별 전략 인격
│   │   ├── personality.go       # 국가 성격 유형 정의
│   │   ├── faction_formation.go # 팩션 자동 형성 알고리즘
│   │   ├── diplomacy_ai.go      # 외교 의사결정 AI
│   │   ├── war_strategy.go      # 전쟁 선포/수행/협상 AI
│   │   ├── deployment.go        # 에이전트 배치 최적화
│   │   ├── economy_ai.go       # 경제 정책 AI
│   │   └── evaluation.go       # 상황 평가 유틸리티
│   │
│   └── simws/           # NEW: 시뮬레이션 관전 WebSocket
│       ├── hub.go
│       └── protocol.go
```

### 2.3 데이터 흐름

```
SimClock (시간 틱)
    │
    ▼
SimulationEngine.Tick()
    │
    ├──→ [매 50ms/가속] WorldManager.TickActiveArenas()
    │       └── Arena.processTick() × N (활성 아레나)
    │           ├── Agent 이동/전투/오브
    │           ├── WeaponSystem.ProcessWeapons()
    │           └── EpochManager.Tick()
    │
    ├──→ [매 10분/가속] EpochManager.OnEpochEnd()
    │       ├── NationScoreTracker.FinalizeEpoch()
    │       ├── DominationEngine.OnEpochEnd()
    │       └── SimRecorder.RecordEpochResult()
    │
    ├──→ [매 1시간/가속] StrategicDecisionEngine.MakeDecisions()
    │       ├── NationalAI[195].EvaluateSituation()
    │       ├── NationalAI[195].DecideDeployment()
    │       ├── DiplomacyAI.EvaluateTreaties()
    │       ├── WarStrategyAI.EvaluateWarOpportunities()
    │       └── DeploymentOptimizer.Optimize()
    │
    ├──→ [매 1시간/가속] EconomyEngine.Tick()
    │       ├── GDP 산정, 자원 생산
    │       └── 바이백/소각 시뮬
    │
    ├──→ [매 24시간/가속] FactionFormationAI.Evaluate()
    │       ├── 팩션 해체/합병 판단
    │       └── 신규 팩션 제안
    │
    └──→ [매 1주/가속] SeasonManager.EraTransition()
            ├── Era 전환
            └── 패권 평가

SimRecorder ←── 모든 이벤트 수집 ──→ EventLog (파일/DB)
AnalyticsDashboard ←── 실시간 집계 ──→ WebSocket → 관전 클라이언트
```

### 2.4 핵심 인터페이스

```go
// SimulationEngine — 메인 오케스트레이터
type SimulationEngine struct {
    config      *SimConfig
    clock       *SimClock
    world       *world.WorldManager
    strategy    *StrategicDecisionEngine
    recorder    *SimRecorder
    analytics   *AnalyticsCollector
    state       *SimState
    running     atomic.Bool
}

// SimConfig — 시뮬레이션 설정
type SimConfig struct {
    TimeScale       float64       // 시간 가속 배율 (1.0 = 실시간)
    SeasonDuration  time.Duration // 시즌 길이 (기본 4주)
    MaxActiveArenas int           // 동시 활성 아레나 제한 (기본 50)
    AgentScale      float64       // 에이전트 수 스케일 (1.0 = 풀, 0.5 = 반)
    EnableRecording bool          // 이벤트 기록 활성화
    SnapshotInterval time.Duration // 스냅샷 주기
    Seed            int64         // 랜덤 시드 (재현성)
    HeadlessMode    bool          // UI 없이 실행
    EnableEconomy   bool          // 경제 시뮬 활성화
    EnableDiplomacy bool          // 외교 시뮬 활성화
    EnableWar       bool          // 전쟁 시뮬 활성화
}

// NationalAI — 국가별 전략 AI 인터페이스
type NationalAI interface {
    GetCountryCode() string
    GetPersonality() NationalPersonality
    EvaluateSituation(worldState *WorldSnapshot) *SituationAssessment
    DecideDeployment(assessment *SituationAssessment) []DeploymentOrder
    DecideDiplomacy(assessment *SituationAssessment) []DiplomacyAction
    DecideWar(assessment *SituationAssessment) *WarDecision
    DecideEconomicPolicy(assessment *SituationAssessment) *EconomicPolicy
    OnBattleResult(result *BattleResult)
    OnWarEvent(event *WarEvent)
}

// StrategicDecisionEngine — 전략 결정 조율
type StrategicDecisionEngine struct {
    nationalAIs  map[string]NationalAI   // ISO → AI
    factionAI    *FactionFormationAI
    diplomacyAI  *DiplomacyAI
    warAI        *WarStrategyAI
    deployOptim  *DeploymentOptimizer
    economyAI    *EconomyAI
}
```

---

<!-- SECTION_3 -->

## 3. AI 에이전트 계층 구조

AI 에이전트의 의사결정은 **4개 계층**으로 분리되며, 각 계층은 독립적 주기로 작동한다.

### 3.1 계층 구조 개요

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: GRAND STRATEGY (대전략)                                │
│  주기: 24시간 | 주체: NationalAI (국가당 1개)                     │
│  결정: 장기 목표 설정, 동맹 전략, 세계 패권 계획                   │
│  예시: "아시아 10국 지배 → Lord of the East 칭호 달성"            │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: OPERATIONAL (작전)                                     │
│  주기: 1시간 | 주체: StrategicDecisionEngine                     │
│  결정: 에이전트 배치, 전쟁 선포, 외교 조약, 경제 정책              │
│  예시: "KOR에 에이전트 5기 집중 배치, JPN과 불가침 조약"           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: TACTICAL (전술)                                        │
│  주기: 매 에포크 (10분) | 주체: BotManager (기존)                │
│  결정: 빌드 선택, 전투 스타일, 타겟 우선순위                      │
│  예시: "berserker 빌드, aggressive 스타일, lowest_hp 타겟"        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: REFLEXIVE (반사)                                       │
│  주기: 매 틱 (50ms) | 주체: BotManager.decideBehavior() (기존)   │
│  결정: 이동 방향, 대시 사용, 도주/추격, 오브 수집                  │
│  예시: "적 3시 방향 접근, HP 30% → 11시 방향 도주 + 대시"         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 계층별 상세

#### Layer 1: Reflexive (기존 BotManager 재사용)

이미 구현된 `BotManager.decideBehavior()` 그대로 사용:
- 5단계 우선순위 체인: boundary escape → survive → hunt → kite → wander
- 5가지 빌드 패스: Berserker, Tank, Speedster, Vampire, Scholar
- `BotDecideUpgrade()`: 시너지 완성 > 빌드패스 선호 > 어빌리티 활용 > 후반 방어

**시뮬레이션 확장**: 상위 레이어(Layer 2)에서 설정한 `TrainingProfile`에 따라 빌드패스와 전투 스타일이 결정됨.

#### Layer 2: Tactical (기존 TrainingProfile 확장)

기존 `training.go`의 `TrainingProfile`을 활용하되, 상위 레이어에서 동적으로 설정:

```go
// 전략 AI가 전술 레이어에 내리는 지시
type TacticalDirective struct {
    BuildPath      string       // "berserker", "tank", "speedster", "vampire", "scholar"
    CombatStyle    string       // "aggressive", "defensive", "balanced", "xp_rush", "endgame"
    TargetPriority string       // "lowest_hp", "highest_level", "nearest", "same_faction"
    Aggression     float64      // 0.0 ~ 1.0
    RetreatHP      float64      // HP% 이하 시 후퇴
    CooperateWith  []string     // 아군 에이전트 ID (그룹 전투)
}
```

#### Layer 3: Operational (NEW — 핵심 신규 개발)

에이전트 배치, 전쟁 결정, 외교 행위를 1시간 주기로 결정:

```go
type OperationalDecision struct {
    Deployments     []DeploymentOrder    // 에이전트 → 국가 배치
    WarDecisions    []WarDecision        // 전쟁 선포/항복/휴전
    DiplomacyActs   []DiplomacyAction    // 조약 제안/파기
    EconomicPolicy  *EconomicPolicy      // 세율/무역/군비/기술투자
    TacticalUpdates []TacticalDirective  // 전술 레이어 지시 갱신
}

type DeploymentOrder struct {
    AgentID     string
    TargetCountry string  // 배치할 국가 ISO
    Priority    int       // 배치 우선순위
    Reason      string    // "defend_homeland", "attack_target", "farm_resources"
}
```

#### Layer 4: Grand Strategy (NEW — 장기 목표)

24시간 주기로 세계 정세를 분석하고 장기 목표를 재설정:

```go
type GrandStrategy struct {
    PrimaryGoal     StrategicGoal   // 현재 최우선 목표
    SecondaryGoals  []StrategicGoal // 보조 목표
    ThreatAssessment map[string]float64 // 팩션별 위협도 (0~1)
    AlliancePolicy  AlliancePolicy  // 동맹 전략
    ExpansionTargets []string       // 확장 대상 국가 ISO 리스트
    DefensePriority []string        // 방어 우선순위 국가
}

type StrategicGoal struct {
    Type     string  // "continental_domination", "economic_superpower",
                     // "military_hegemon", "diplomatic_leader", "survival"
    Target   string  // 대륙 or 국가 or 팩션
    Progress float64 // 0.0 ~ 1.0 달성도
    Deadline int     // 남은 에포크 수
}
```

### 3.3 에이전트 인구 분배

195개국에 총 ~3,200개 AI 에이전트 배치:

| 등급 | 국가 수 | 국가당 에이전트 | 소계 |
|------|---------|---------------|------|
| S (8국) | 8 | 40~50 | ~360 |
| A (20국) | 20 | 25~35 | ~600 |
| B (40국) | 40 | 15~25 | ~800 |
| C (80국) | 80 | 8~15 | ~920 |
| D (47국) | 47 | 5~8 | ~305 |
| **합계** | **195** | | **~2,985** |

- 에이전트는 **출신 국가** 소속이지만, 팩션 전략에 따라 다른 국가에 원정 배치 가능
- 각 에이전트는 최대 **1개 국가 아레나**에만 동시 참가
- 유휴 에이전트는 "대기" 상태 → 배치 명령 시 즉시 투입

### 3.4 에이전트 능력 차등

국가 tier에 따라 에이전트 기본 능력치에 보정 적용:

```go
// 국가 tier별 에이전트 버프
var TierAgentBuffs = map[CountryTier]AgentBuff{
    "S": {HPMult: 1.10, DPSMult: 1.08, SpeedMult: 1.05, XPMult: 1.15},
    "A": {HPMult: 1.05, DPSMult: 1.04, SpeedMult: 1.03, XPMult: 1.10},
    "B": {HPMult: 1.02, DPSMult: 1.02, SpeedMult: 1.01, XPMult: 1.05},
    "C": {HPMult: 1.00, DPSMult: 1.00, SpeedMult: 1.00, XPMult: 1.00},
    "D": {HPMult: 0.95, DPSMult: 0.95, SpeedMult: 0.98, XPMult: 0.90},
}
```

이를 통해 S-tier 국가 에이전트가 평균적으로 더 강하지만, 빌드/전략 차이로 역전 가능.

---

<!-- SECTION_4 -->

## 4. 국가별 AI 성격 시스템

각 국가의 전략 AI는 실제 지정학적 특성을 반영한 **고유 성격(Personality)**을 갖는다.

### 4.1 성격 축 (5차원)

| 축 | 범위 | 설명 |
|----|------|------|
| **Aggression** | 0.0 (평화주의) ~ 1.0 (호전적) | 전쟁 선포 성향 |
| **Expansion** | 0.0 (고립주의) ~ 1.0 (팽창주의) | 영토 확장 욕구 |
| **Cooperation** | 0.0 (단독주의) ~ 1.0 (협력주의) | 동맹/조약 성향 |
| **Economy** | 0.0 (군사 중심) ~ 1.0 (경제 중심) | 자원 vs 군사 투자 비중 |
| **Adaptability** | 0.0 (고집) ~ 1.0 (유연) | 상황 변화 대응 속도 |

```go
type NationalPersonality struct {
    Aggression   float64 // 전쟁 선포 경향
    Expansion    float64 // 영토 확장 욕구
    Cooperation  float64 // 동맹/외교 성향
    Economy      float64 // 경제 vs 군사 투자 비중
    Adaptability float64 // 상황 변화 대응 속도
}
```

### 4.2 8대 성격 아키타입

| 아키타입 | Agg | Exp | Coop | Eco | Adapt | 대표 국가 |
|----------|-----|-----|------|-----|-------|----------|
| **Superpower Hawk** | 0.8 | 0.9 | 0.3 | 0.4 | 0.6 | USA, CHN, RUS |
| **Economic Giant** | 0.3 | 0.5 | 0.7 | 0.9 | 0.7 | JPN, DEU, KOR |
| **Regional Fortress** | 0.5 | 0.3 | 0.6 | 0.5 | 0.4 | ISR, CHE, SGP |
| **Alliance Builder** | 0.4 | 0.6 | 0.9 | 0.6 | 0.8 | FRA, GBR, CAN |
| **Resource Empire** | 0.6 | 0.7 | 0.4 | 0.8 | 0.5 | SAU, AUS, BRA |
| **Guerrilla State** | 0.7 | 0.4 | 0.5 | 0.3 | 0.9 | VNM, AFG, CUB |
| **Diplomatic Broker** | 0.2 | 0.3 | 0.9 | 0.7 | 0.8 | SWE, NOR, AUT |
| **Survivalist** | 0.3 | 0.2 | 0.6 | 0.5 | 0.7 | D-tier 다수 |

### 4.3 국가별 성격 할당 (195국)

```go
// S-tier 국가 성격 (실제 지정학 반영)
var STierPersonalities = map[string]NationalPersonality{
    "USA": {0.8, 0.9, 0.5, 0.6, 0.7},  // 글로벌 패권 + 동맹 네트워크
    "CHN": {0.7, 0.9, 0.3, 0.8, 0.6},  // 경제적 팽창 + 독자 노선
    "RUS": {0.9, 0.8, 0.2, 0.3, 0.5},  // 군사적 호전 + 고립
    "IND": {0.4, 0.6, 0.5, 0.7, 0.6},  // 비동맹 + 경제 성장
    "BRA": {0.3, 0.5, 0.6, 0.7, 0.7},  // 지역 리더 + 자원
    "JPN": {0.2, 0.3, 0.8, 0.9, 0.8},  // 경제 대국 + 동맹 의존
    "DEU": {0.3, 0.5, 0.9, 0.9, 0.7},  // EU 핵심 + 경제
    "GBR": {0.5, 0.6, 0.7, 0.6, 0.8},  // 글로벌 동맹 + 균형
}

// A-tier 성격 (한국 예시)
"KOR": {0.4, 0.5, 0.8, 0.9, 0.9},  // 기술 경제 + 동맹 중시 + 높은 적응력
```

### 4.4 성격 기반 의사결정

성격 값이 의사결정에 미치는 영향:

```go
func (ai *NationalAIImpl) ShouldDeclareWar(target string, assessment *SituationAssessment) bool {
    personality := ai.personality

    // 기본 전쟁 의지 = Aggression × Expansion
    warWill := personality.Aggression * personality.Expansion

    // 상황 보정
    if assessment.MilitaryAdvantage > 1.5 {
        warWill *= 1.3  // 군사적 우위 시 공격 성향 증가
    }
    if assessment.EconomicPressure > 0.7 {
        warWill *= 1.2  // 경제적 압박 시 자원 약탈 동기
    }
    if assessment.AllyCount >= 3 {
        warWill *= (1 + personality.Cooperation * 0.3) // 동맹이 많으면 자신감
    }

    // 경제 중심 국가는 전쟁 기피
    warWill *= (1.0 - personality.Economy * 0.4)

    // 임계값: 0.5 이상이면 전쟁 선포 고려
    return warWill > 0.5 && rand.Float64() < warWill
}
```

### 4.5 성격 진화 (Adaptive 요소)

시뮬레이션 진행 중 성격이 소폭 변화 가능:

```go
type PersonalityEvolution struct {
    BasePersonality    NationalPersonality  // 초기 성격 (불변)
    CurrentPersonality NationalPersonality  // 현재 성격 (변화)
    MaxDrift           float64              // 최대 변화폭 (기본 ±0.2)
}

// 전쟁 패배 시 → Aggression 소폭 감소, Cooperation 소폭 증가
// 경제 성공 시 → Economy 소폭 증가
// 동맹 배신당할 시 → Cooperation 감소, Aggression 증가
```

- 변화폭은 `Adaptability` 값에 비례 (높을수록 빠르게 적응)
- 기본 성격에서 최대 ±0.2까지만 변화 (정체성 유지)
- Era 전환 시 `BasePersonality`로 50% 회귀 (리셋 효과)

---

<!-- SECTION_5 -->

## 5. 팩션 자동 형성 시스템

인간 없이 AI가 자율적으로 팩션을 구성하는 시스템.

### 5.1 팩션 형성 알고리즘 개요

시즌 시작 시 195개국 AI가 **3단계**를 거쳐 팩션을 형성:

```
Phase 1: 핵심 시드 (Core Seeding)
  → S/A-tier 국가가 팩션 리더 후보 (최대 20~30개 팩션)

Phase 2: 지역 응집 (Regional Clustering)
  → 인접국 + 성격 유사도 기반으로 합류 요청/수락

Phase 3: 약소국 편입 (Minor Absorption)
  → D/C-tier 국가가 가장 유리한 팩션에 합류
```

### 5.2 Phase 1: 핵심 시드

```go
func (f *FactionFormationAI) SeedCoreFactions() []*ProtoFaction {
    // S-tier 8국 → 자동 팩션 리더 후보
    // A-tier 20국 중 Cooperation < 0.5인 국가 → 독립 팩션 리더
    // 나머지 A-tier → Phase 2에서 합류 결정

    candidates := []string{}
    for _, country := range AllCountries {
        if country.Tier == "S" {
            candidates = append(candidates, country.ISO3)
        }
        if country.Tier == "A" && GetPersonality(country.ISO3).Cooperation < 0.5 {
            candidates = append(candidates, country.ISO3)
        }
    }
    // ~12-15개 초기 팩션 생성
}
```

### 5.3 Phase 2: 지역 응집

국가 간 "친화도 점수"를 계산하여 팩션 합류를 결정:

```go
type AffinityScore struct {
    GeographicProximity float64  // 인접국 보너스 (0~30)
    PersonalitySimilar  float64  // 성격 유사도 (0~25)
    ResourceComplementary float64 // 자원 보완성 (0~20)
    ContinentBonus     float64   // 같은 대륙 (0~15)
    TierBalance        float64   // 등급 균형 기여도 (0~10)
    Total              float64
}

// 계산 예시: KOR → JPN 팩션 합류 친화도
// Geographic: KOR-JPN 인접 → +25
// Personality: Economy 유사(0.9, 0.9) → +22
// Resources: KOR(Tech=95)+JPN(Tech=92) → 중복, 보완↓ → +8
// Continent: 같은 아시아 → +15
// TierBalance: A-tier + S-tier → 균형 좋음 → +9
// Total: 79 (높은 친화도)
```

**합류 규칙**:
- 친화도 60 이상: 자동 합류 요청
- 친화도 40~60: 팩션 리더의 Cooperation 값에 따라 결정
- 친화도 40 미만: 합류 안 함 (다른 팩션 탐색)
- 1개 팩션 최대 15국 (50명 에이전트 상한 고려)

### 5.4 Phase 3: 약소국 편입

D/C-tier 국가 중 Phase 2에서 배정되지 않은 국가:

```go
func (f *FactionFormationAI) AbsorbMinors(protos []*ProtoFaction) {
    for _, country := range unassignedCountries {
        bestFaction := nil
        bestScore := 0.0

        for _, faction := range protos {
            if faction.MemberCount >= 15 { continue } // 풀방 스킵

            score := calcAffinityScore(country, faction)

            // 약소국 보정: 강한 팩션 선호 (+safety)
            score += faction.TotalPower * 0.1

            // 지리적 고립 방지: 팩션 영토에 인접해야 함
            if !faction.HasAdjacentTerritory(country.ISO3) {
                score *= 0.3  // 고립 페널티
            }

            if score > bestScore {
                bestScore = score
                bestFaction = faction
            }
        }

        if bestFaction != nil && bestScore > 30 {
            bestFaction.AddMember(country)
        } else {
            // 독립 잔류 (약소국 독립 팩션)
            createSoloFaction(country)
        }
    }
}
```

### 5.5 예상 팩션 구성 (시뮬레이션 결과 예시)

| # | 팩션명 (자동생성) | 리더 | 핵심 멤버 | 규모 | 성격 |
|---|-----------------|------|----------|------|------|
| 1 | **Eagle Alliance** | USA | CAN, GBR, AUS, FRA, DEU | ~12국 | 동맹 확장, 균형 |
| 2 | **Dragon Pact** | CHN | PRK, MMR, PAK, LAO, KHM | ~10국 | 팽창, 경제 |
| 3 | **Bear Dominion** | RUS | BLR, KAZ, ARM, SRB, SYR | ~8국 | 군사, 호전 |
| 4 | **Tiger Coalition** | IND | BGD, LKA, NPL, BTN, MDV | ~7국 | 비동맹, 경제 |
| 5 | **Pacific Union** | JPN | KOR, TWN, SGP, NZL, PHL | ~8국 | 기술, 동맹 |
| 6 | **Samba Federation** | BRA | ARG, COL, CHL, PER, URY | ~10국 | 자원, 협력 |
| 7 | **Crescent League** | TUR | SAU, ARE, QAT, EGY, IRQ | ~9국 | 자원, 지역 |
| 8 | **Nordic Shield** | SWE | NOR, FIN, DNK, ISL, EST | ~6국 | 외교, 방어 |
| ... | ... | ... | ... | ... | ... |

### 5.6 팩션 동적 변화

시뮬레이션 진행 중 팩션은 변화할 수 있음:

| 이벤트 | 트리거 | 결과 |
|--------|--------|------|
| **탈퇴** | 3연패 or 리더 불신 | 멤버 국가 독립/다른 팩션 합류 |
| **합병** | 양측 리더 협력 > 0.7 + 공동 적 | 소규모 팩션이 대규모에 흡수 |
| **분열** | 내부 성격 갈등 > 임계값 | 팩션 2분할 |
| **쿠데타** | 리더 연패 + 2인자 군사력 우세 | 리더 교체 |
| **해체** | 영토 0국 + 3일 연속 | 멤버 전원 무소속 |

---

<!-- SECTION_6 -->

## 6. 시뮬레이션 실행 엔진

<!-- PLACEHOLDER_6 -->

---

<!-- SECTION_7 -->

## 7. 전략 AI 의사결정

<!-- PLACEHOLDER_7 -->

---

<!-- SECTION_8 -->

## 8. 경제·외교·전쟁 자동화

<!-- PLACEHOLDER_8 -->

---

<!-- SECTION_9 -->

## 9. 시간 가속 & 스케일링

<!-- PLACEHOLDER_9 -->

---

<!-- SECTION_10 -->

## 10. 관전 & 분석 시스템

<!-- PLACEHOLDER_10 -->

---

<!-- SECTION_11 -->

## 11. 구현 로드맵

<!-- PLACEHOLDER_11 -->
