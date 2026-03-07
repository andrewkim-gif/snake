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

### 6.1 SimulationEngine 상태 머신

```
INIT → SEEDING → RUNNING → PAUSED → RUNNING → ... → SEASON_END → REPORT
```

| 상태 | 동작 |
|------|------|
| `INIT` | 설정 로딩, 195국 데이터 시드 |
| `SEEDING` | 팩션 형성, 초기 에이전트 배치, 경제 초기화 |
| `RUNNING` | 게임 루프 실행 (틱 처리) |
| `PAUSED` | 일시정지 (관전자 분석용) |
| `SEASON_END` | 시즌 종료 처리, 명예의 전당, 보상 |
| `REPORT` | 최종 리포트 생성 |

### 6.2 메인 루프

```go
func (e *SimulationEngine) Run(ctx context.Context) error {
    e.state.Phase = PhaseSeeding
    e.seedWorld()

    e.state.Phase = PhaseRunning
    e.running.Store(true)

    ticker := e.clock.NewTicker(TickInterval) // 50ms (실시간)
    defer ticker.Stop()

    strategicTicker := e.clock.NewTicker(StrategicInterval) // 1시간
    defer strategicTicker.Stop()

    for {
        select {
        case <-ctx.Done():
            return ctx.Err()

        case <-ticker.C:
            if !e.running.Load() { continue }

            // 1) 활성 아레나 게임 틱
            e.world.TickActiveArenas()

            // 2) 에포크 종료 처리 (자동 감지)
            e.processEpochTransitions()

            // 3) 이벤트 수집 & 기록
            e.recorder.FlushEvents()

            // 4) 시즌 종료 체크
            if e.clock.ElapsedSeason() >= e.config.SeasonDuration {
                e.endSeason()
                return nil
            }

        case <-strategicTicker.C:
            if !e.running.Load() { continue }

            // 전략 AI 의사결정 (1시간마다)
            e.strategy.MakeDecisions(e.buildWorldSnapshot())

            // 경제 틱
            e.world.EconomyTick()

            // 외교 틱 (조약 만료 등)
            e.world.DiplomacyTick()
        }
    }
}
```

### 6.3 시드 프로세스 (SEEDING)

```go
func (e *SimulationEngine) seedWorld() {
    // 1. 195국 초기화 (기존 WorldManager 활용)
    e.world = world.NewWorldManager(e.config.toWorldConfig())

    // 2. 팩션 자동 형성
    factions := e.strategy.factionAI.FormFactions(world.AllCountries)
    for _, f := range factions {
        e.world.Factions().CreateFaction(f.Name, f.LeaderID, f.Tag, f.Color)
        for _, member := range f.Members {
            e.world.Factions().JoinFaction(f.ID, member.UserID)
        }
    }

    // 3. AI 에이전트 생성 & 초기 배치
    for _, country := range world.AllCountries {
        agentCount := calcAgentCount(country.Tier, e.config.AgentScale)
        nationalAI := e.strategy.nationalAIs[country.ISO3]

        for i := 0; i < agentCount; i++ {
            agent := e.createSimAgent(country, i, nationalAI.GetPersonality())
            deployment := nationalAI.InitialDeployment(agent.ID)
            e.world.DeployAgent(agent.ID, deployment.TargetCountry)
        }
    }

    // 4. 초기 경제 설정
    e.world.Economy().InitializeAll()

    // 5. 초기 스냅샷
    e.recorder.TakeSnapshot("seed_complete")

    log.Printf("[SimEngine] Seeding complete: %d factions, %d agents",
        len(factions), e.state.TotalAgents)
}
```

### 6.4 아레나 활성화 전략

195국을 동시에 전부 실행할 수 없으므로 (max 50 active), 우선순위 기반 라운드 로빈:

```go
type ArenaScheduler struct {
    activeSlots   int              // 동시 활성 슬롯 (기본 50)
    priorityQueue *heap.Interface  // 우선순위 큐
}

// 우선순위 점수 계산
func (s *ArenaScheduler) CalcPriority(country *CountryState) float64 {
    score := 0.0

    // 1. 배치된 에이전트 수 (최우선)
    score += float64(country.DeployedAgents) * 10.0

    // 2. 전쟁 상태 (활성 전쟁 > 평시)
    if country.HasActiveWar { score += 50.0 }

    // 3. 경쟁 열기 (다팩션 배치)
    score += float64(country.FactionCount) * 8.0

    // 4. 주권 분쟁 (소유자 외 팩션 에이전트)
    if country.IsContested { score += 30.0 }

    // 5. 최근 미실행 보정 (공정성)
    score += float64(country.TicksSinceLastActive) * 0.01

    return score
}
```

**라운드 로빈 정책**:
- 매 에포크(10분)마다 50개 슬롯 재평가
- 에이전트가 0인 국가는 자동 비활성
- 전쟁 중인 국가는 강제 활성 (슬롯 보장)
- 나머지는 우선순위 큐에서 상위 N개 선택
- 비활성 국가의 전투 결과는 **통계적 시뮬레이션**으로 근사

### 6.5 통계적 전투 근사 (비활성 아레나)

활성 슬롯에 들어가지 못한 국가는 "헤드리스 전투"로 결과만 산출:

```go
func (e *SimulationEngine) SimulateBattleStatistical(country *CountryState) *BattleResult {
    factionPowers := map[string]float64{}

    for _, agent := range country.DeployedAgents {
        faction := agent.FactionID
        // 에이전트 전투력 = level × buildMultiplier × tierBuff
        power := agent.CombatPower()
        factionPowers[faction] += power
    }

    // 노이즈 추가 (±15%) — 실제 전투의 불확실성 반영
    for k := range factionPowers {
        noise := 0.85 + rand.Float64()*0.30
        factionPowers[k] *= noise
    }

    // 방어 보너스 적용
    if sovereign, ok := country.SovereignFaction; ok {
        factionPowers[sovereign] *= 1.20
    }

    // 승자 결정
    winner := maxKey(factionPowers)

    return &BattleResult{
        CountryISO: country.ISO3,
        Winner:     winner,
        Scores:     factionPowers,
        Simulated:  true, // 실제 전투 아님 마킹
    }
}
```

---

<!-- SECTION_7 -->

## 7. 전략 AI 의사결정

### 7.1 의사결정 파이프라인

매 1시간(가속 시 조정) 전략 AI가 실행하는 의사결정 순서:

```
1. 월드 스냅샷 수집
   └── 모든 국가 상태, 팩션 영토, 경제, 전쟁, 외교 정보

2. 상황 평가 (SituationAssessment)
   ├── 자팩션 전력 분석
   ├── 적팩션 위협도 평가
   ├── 경제 건전성 체크
   ├── 외교 관계 분석
   └── 확장 기회 탐색

3. 의사결정 (순서대로, 선행 결정이 후행에 영향)
   ├── 3a. 외교 결정 (조약 제안/수락/파기)
   ├── 3b. 전쟁 결정 (선포/항복/휴전)
   ├── 3c. 배치 결정 (에이전트 이동/집중/분산)
   ├── 3d. 경제 결정 (세율/무역/투자)
   └── 3e. 전술 지시 갱신 (빌드/스타일 변경)

4. 실행 (기존 시스템 API 호출)
5. 결과 기록 (SimRecorder)
```

### 7.2 상황 평가 (SituationAssessment)

```go
type SituationAssessment struct {
    // 자팩션 상태
    MyFaction         string
    MyTerritories     []string         // 보유 국가 ISO 리스트
    MyTotalPower      float64          // 총 군사력
    MyGDP             float64          // 총 GDP
    MyAgentCount      int              // 총 에이전트 수
    MyCapital         string           // 수도 국가

    // 위협 분석
    Threats           []ThreatEntry    // 적 팩션별 위협도
    ActiveWars        []WarStatus      // 현재 전쟁 상태
    BorderTensions    []BorderTension  // 국경 긴장도

    // 기회 분석
    WeakTargets       []TargetOpportunity // 약한 적국
    UnclaimedCountries []string          // 미점령 국가
    AllianceCandidates []string          // 동맹 후보 팩션

    // 경제 분석
    ResourceBalance   ResourceBundle    // 자원 잉여/부족
    TradePartners     []string          // 무역 파트너
    EconomicRank      int               // GDP 순위

    // 전략 진행도
    GrandStrategy     *GrandStrategy    // 장기 목표 달성도
    SeasonProgress    float64           // 시즌 진행률 (0~1)
    EraPhase          string            // 현재 Era
}

type ThreatEntry struct {
    FactionID    string
    ThreatLevel  float64  // 0.0 ~ 1.0
    PowerRatio   float64  // 상대 전력비 (>1 = 적이 더 강함)
    BorderLength int      // 인접 국경 수
    Hostility    float64  // 적대감 (외교 기반)
    IsAtWar      bool     // 현재 전쟁 중
}
```

### 7.3 배치 의사결정 (DeploymentOptimizer)

에이전트를 어느 국가에 배치할지 결정하는 최적화 알고리즘:

```go
type DeploymentOptimizer struct {
    weights DeploymentWeights
}

type DeploymentWeights struct {
    DefendHomeland  float64 // 본국 방어 가중치 (기본 3.0)
    DefendCapital   float64 // 수도 방어 가중치 (기본 5.0)
    AttackTarget    float64 // 공격 목표 가중치 (기본 2.0)
    ContestControl  float64 // 분쟁 국가 가중치 (기본 2.5)
    FarmResources   float64 // 자원 수집 가중치 (기본 1.0)
    ReinforceBattle float64 // 전쟁 중 증원 가중치 (기본 4.0)
}

func (d *DeploymentOptimizer) Optimize(
    agents []*SimAgent,
    assessment *SituationAssessment,
    personality *NationalPersonality,
) []DeploymentOrder {
    // 국가별 배치 매력도 계산
    countryScores := map[string]float64{}

    for _, country := range assessment.MyTerritories {
        score := d.weights.DefendHomeland

        if country == assessment.MyCapital {
            score = d.weights.DefendCapital
        }
        if isUnderAttack(country, assessment) {
            score += d.weights.ReinforceBattle
        }

        // 성격 보정
        score *= (1.0 + personality.Aggression * 0.2)

        countryScores[country] = score
    }

    // 공격 목표 국가
    for _, target := range assessment.WeakTargets {
        score := d.weights.AttackTarget * target.Vulnerability
        score *= personality.Expansion
        countryScores[target.CountryISO] = score
    }

    // 미점령 국가 (자원 파밍)
    for _, country := range assessment.UnclaimedCountries {
        if isAdjacent(country, assessment.MyTerritories) {
            score := d.weights.FarmResources
            score *= personality.Expansion
            countryScores[country] = score
        }
    }

    // 최적 배치 계산 (탐욕적 할당)
    return greedyAssign(agents, countryScores)
}
```

### 7.4 전쟁 의사결정 (WarStrategyAI)

```go
func (w *WarStrategyAI) EvaluateWarOpportunities(
    assessment *SituationAssessment,
    personality *NationalPersonality,
) *WarDecision {

    // 1. 현재 전쟁 중이면 추가 선포 제한
    if len(assessment.ActiveWars) >= 2 {
        return &WarDecision{Action: "hold"}
    }

    // 2. Era 제한 (Week 1 = 전쟁 불가, Week 2 = 비용 2배)
    if assessment.EraPhase == "discovery" {
        return &WarDecision{Action: "hold"}
    }

    // 3. 약한 타겟 탐색
    for _, target := range assessment.WeakTargets {
        warScore := 0.0

        // 군사적 우위
        if target.PowerRatio < 0.6 { warScore += 30 }
        if target.PowerRatio < 0.4 { warScore += 20 }

        // 전략적 가치 (자원, 위치)
        warScore += target.StrategicValue * 20

        // 성격 보정
        warScore *= personality.Aggression
        warScore *= personality.Expansion

        // 경제적 여유 (전쟁 비용 감당 가능?)
        if assessment.ResourceBalance.Oil < 500 ||
           assessment.ResourceBalance.Influence < 300 {
            warScore *= 0.3  // 자원 부족 시 억제
        }

        // 동맹 지원 기대
        allySupportCount := countAlliesWillingToHelp(target.FactionID, assessment)
        warScore += float64(allySupportCount) * 10

        if warScore > 50 {
            return &WarDecision{
                Action:   "declare",
                TargetFaction: target.FactionID,
                Reason:   fmt.Sprintf("military advantage (ratio %.2f), strategic value %.1f",
                    target.PowerRatio, target.StrategicValue),
                WarScore: warScore,
            }
        }
    }

    // 4. 현재 전쟁 평가 (항복/휴전)
    for _, war := range assessment.ActiveWars {
        if war.MyWarScore < -500 && war.DurationHours > 48 {
            return &WarDecision{
                Action: "surrender",
                WarID:  war.ID,
                Reason: "losing war badly, cut losses",
            }
        }
        if war.DurationHours > 120 && math.Abs(war.ScoreDiff) < 100 {
            return &WarDecision{
                Action: "ceasefire",
                WarID:  war.ID,
                Reason: "prolonged stalemate, seek peace",
            }
        }
    }

    return &WarDecision{Action: "hold"}
}
```

### 7.5 외교 의사결정 (DiplomacyAI)

```go
func (d *DiplomacyAI) EvaluateTreaties(
    assessment *SituationAssessment,
    personality *NationalPersonality,
) []DiplomacyAction {

    actions := []DiplomacyAction{}

    // 1. 불가침 조약 — 위협적이지만 즉시 전쟁할 수 없는 적
    for _, threat := range assessment.Threats {
        if threat.ThreatLevel > 0.6 && threat.PowerRatio > 0.8 &&
           !threat.IsAtWar && personality.Cooperation > 0.4 {
            actions = append(actions, DiplomacyAction{
                Type:   "propose_non_aggression",
                Target: threat.FactionID,
                Reason: "buy time against strong neighbor",
            })
        }
    }

    // 2. 군사 동맹 — 공동 적이 있는 팩션
    for _, candidate := range assessment.AllianceCandidates {
        if hasCommonEnemy(candidate, assessment) &&
           personality.Cooperation > 0.6 {
            actions = append(actions, DiplomacyAction{
                Type:   "propose_military_alliance",
                Target: candidate,
                Reason: "common enemy, mutual defense",
            })
        }
    }

    // 3. 무역 협정 — 자원 보완 팩션
    for _, partner := range assessment.TradePartners {
        if isResourceComplementary(partner, assessment) &&
           personality.Economy > 0.5 {
            actions = append(actions, DiplomacyAction{
                Type:   "propose_trade_agreement",
                Target: partner,
                Reason: "resource complementarity",
            })
        }
    }

    // 4. 경제 제재 — 적대 팩션에 무역 차단
    for _, enemy := range assessment.ActiveWars {
        actions = append(actions, DiplomacyAction{
            Type:   "impose_sanction",
            Target: enemy.EnemyFactionID,
            Reason: "wartime trade embargo",
        })
    }

    return actions
}
```

---

<!-- SECTION_8 -->

## 8. 경제·외교·전쟁 자동화

### 8.1 경제 자동화 (EconomyAI)

기존 `EconomyEngine`의 정책을 AI가 자동으로 설정:

```go
type EconomyAI struct {
    personalityMap map[string]*NationalPersonality
}

func (e *EconomyAI) DecidePolicy(
    country string,
    assessment *SituationAssessment,
    personality *NationalPersonality,
) *EconomicPolicy {

    policy := &EconomicPolicy{
        CountryISO: country,
    }

    // 세율: 경제 중심 → 낮은 세율, 군사 중심 → 높은 세율
    policy.TaxRate = 0.10 + (1.0 - personality.Economy) * 0.30
    // 범위: 10% ~ 40%

    // 무역 개방도: 협력적 → 높은 개방, 고립적 → 낮은 개방
    policy.TradeOpenness = 0.3 + personality.Cooperation * 0.6
    // 범위: 30% ~ 90%

    // 군비 지출: 전쟁 중 → 높음, 평시 → 성격에 따라
    if assessment.HasActiveWar(country) {
        policy.MilitarySpend = 0.5 + personality.Aggression * 0.3
    } else {
        policy.MilitarySpend = 0.1 + (1.0 - personality.Economy) * 0.3
    }
    // 범위: 10% ~ 80%

    // 기술 투자: 경제 중심 + 높은 Tech 자원 국가 → 높은 투자
    baseTech := personality.Economy * 0.4
    if getCountryResource(country, "Tech") > 70 {
        baseTech += 0.2
    }
    policy.TechInvest = baseTech
    // 범위: 0% ~ 60%

    return policy
}
```

### 8.2 외교 자동 응답

다른 팩션의 외교 제안에 대한 자동 수락/거절:

```go
func (d *DiplomacyAI) RespondToProposal(
    proposal *Treaty,
    assessment *SituationAssessment,
    personality *NationalPersonality,
) bool { // true = accept

    proposer := proposal.FactionA
    myFaction := assessment.MyFaction

    // 1. 적대 팩션의 제안 → 기본 거부 (Cooperation이 매우 높으면 예외)
    if isHostile(proposer, assessment) {
        return personality.Cooperation > 0.8 && personality.Adaptability > 0.7
    }

    // 2. 제안 유형별 평가
    switch proposal.Type {
    case "non_aggression":
        // 약한 팩션의 제안 → 수락 (공격 옵션 열어둠? 아니면 안전?)
        threat := getThreatLevel(proposer, assessment)
        if threat > 0.5 {
            return true // 강한 적과 불가침 = 좋음
        }
        return personality.Cooperation > 0.5

    case "trade_agreement":
        // 경제 중심 → 거의 항상 수락
        return personality.Economy > 0.3

    case "military_alliance":
        // 공동 적이 있으면 수락, 아니면 Cooperation 기반
        if hasCommonEnemy(proposer, assessment) {
            return true
        }
        return personality.Cooperation > 0.7

    case "tribute":
        // 자기가 내는 건 거부 (강요가 아니면)
        return false
    }

    return personality.Cooperation > 0.5
}
```

### 8.3 전쟁 자동 수행

전쟁 선포 후 공격/방어 행동 자동화:

```go
type WarExecutor struct {
    warAI *WarStrategyAI
}

func (w *WarExecutor) ExecuteWarActions(
    war *WarRecord,
    assessment *SituationAssessment,
    personality *NationalPersonality,
) []WarAction {

    actions := []WarAction{}

    if war.Status != "active" { return actions }

    isAttacker := war.AttackerID == assessment.MyFaction

    if isAttacker {
        // 공격 측: 약한 국가부터 순차 공략
        targets := findWeakestEnemyCountries(war.DefenderID, assessment)
        for _, target := range targets[:min(2, len(targets))] {
            if canSiege(target, assessment) {
                actions = append(actions, WarAction{
                    Type:    "siege",
                    Target:  target,
                    Force:   calcOptimalForce(target, assessment),
                })
            }
        }

        // 에이전트 공격 국가에 집중 배치
        actions = append(actions, WarAction{
            Type:   "redeploy",
            Reason: "concentrate forces on siege targets",
        })

    } else {
        // 방어 측: 수도 방어 최우선, 반격 기회 탐색
        actions = append(actions, WarAction{
            Type:   "fortify_capital",
            Target: assessment.MyCapital,
        })

        // 반격 가능 시 (전력 우위)
        if assessment.MilitaryAdvantage > 1.3 && personality.Aggression > 0.5 {
            weakSpot := findWeakestAttackerCountry(war.AttackerID, assessment)
            if weakSpot != "" {
                actions = append(actions, WarAction{
                    Type:   "counter_siege",
                    Target: weakSpot,
                })
            }
        }

        // 항복 판단: 영토 50% 이상 상실 + 수도 위험
        if assessment.TerritoryLossRatio > 0.5 && personality.Aggression < 0.7 {
            actions = append(actions, WarAction{
                Type:   "surrender",
                Reason: "heavy losses, preserving faction",
            })
        }
    }

    return actions
}
```

### 8.4 시즌 Era별 행동 변화

| Era | 주요 행동 | AI 보정 |
|-----|----------|---------|
| **Discovery (1주차)** | 빠른 영토 확보, 팩션 형성 | Expansion ×1.5, 전쟁 불가 |
| **Expansion (2주차)** | 영토 분쟁 시작, 첫 전쟁 | Aggression ×1.2, 전쟁 비용 ×2 |
| **Empires (3주차)** | 대규모 전쟁, 동맹 재편 | 모든 수치 정상, Capital Siege 활성화 |
| **Reckoning (4주차)** | 최종 순위 경쟁, 올인 | Aggression ×1.5, 전투 시간 단축 |

```go
func (ai *NationalAIImpl) GetEraModifiedPersonality(era string) NationalPersonality {
    p := ai.personality

    switch era {
    case "discovery":
        p.Expansion *= 1.5
        p.Aggression *= 0.3  // 전쟁 억제
        p.Cooperation *= 1.3 // 동맹 형성 촉진
    case "expansion":
        p.Aggression *= 1.2
        p.Expansion *= 1.2
    case "empires":
        // 정상
    case "reckoning":
        p.Aggression *= 1.5
        p.Expansion *= 1.3
        p.Cooperation *= 0.7 // 배신 증가
    }

    return p.Clamp() // 모든 값 0~1로 클램프
}
```

---

<!-- SECTION_9 -->

## 9. 시간 가속 & 스케일링

### 9.1 SimClock — 가상 시간 제어

```go
type SimClock struct {
    mu           sync.RWMutex
    timeScale    float64        // 가속 배율
    simTime      time.Duration  // 시뮬레이션 내 경과 시간
    wallStart    time.Time      // 실제 시작 시각
    paused       bool
    epoch        int            // 현재 에포크 번호
    era          int            // 현재 Era 번호 (0~3)
    seasonStart  time.Time      // 시즌 시작 시각
}

func (c *SimClock) NewTicker(interval time.Duration) *SimTicker {
    // 실제 interval = interval / timeScale
    realInterval := time.Duration(float64(interval) / c.timeScale)
    return &SimTicker{ticker: time.NewTicker(realInterval)}
}

func (c *SimClock) ElapsedSeason() time.Duration {
    return c.simTime // 시뮬레이션 내 경과 시간
}

func (c *SimClock) AdvanceTick() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.simTime += TickInterval * time.Duration(c.timeScale)
}
```

### 9.2 가속 모드별 전투 처리

| 배율 | 전투 처리 | 전략 처리 | 경제 처리 |
|------|----------|----------|----------|
| ×1 | Full simulation (20Hz) | 1시간 실시간 | 1시간 실시간 |
| ×10 | Full simulation (20Hz 유지, 틱 10배속) | 6분마다 | 6분마다 |
| ×100 | Simplified (5Hz, 핵심 이벤트만) | 36초마다 | 36초마다 |
| ×1000 | Statistical approximation | 3.6초마다 | 3.6초마다 |

### 9.3 Turbo/Headless 모드 최적화

×100 이상 가속 시 성능을 위한 간소화:

```go
type SimplifiedArena struct {
    agents      []*SimAgentLite  // 경량 에이전트 (위치, HP, DPS만)
    factionScores map[string]float64
    epochPhase  string
    tick        uint64
}

// SimplifiedTick — 5Hz (200ms 간격)
func (a *SimplifiedArena) SimplifiedTick() {
    for _, agent := range a.agents {
        if !agent.Alive { continue }

        // 간소화된 전투: DPS × 접촉 시간 (물리 시뮬 없이)
        for _, enemy := range a.findNearbyEnemies(agent, CombatRange) {
            damage := agent.EffectiveDPS * 0.2 // 200ms 틱
            enemy.HP -= damage
            if enemy.HP <= 0 {
                enemy.Alive = false
                agent.Kills++
                a.factionScores[agent.Faction] += NationScorePerKill
            }
        }

        // 간소화된 이동: 목표 방향으로 직선 이동
        agent.MoveToward(agent.Target, agent.Speed * 0.2)

        // 레벨업: XP 축적 → 자동 빌드패스 적용
        if agent.ShouldLevelUp() {
            agent.AutoUpgrade()
        }
    }
}
```

### 9.4 메모리 & CPU 예산

| 모드 | 동시 아레나 | 에이전트/아레나 | 메모리 | CPU 코어 |
|------|-----------|---------------|--------|---------|
| Realtime ×1 | 50 | ~30 | ~500MB | 4 |
| Accelerated ×10 | 50 | ~30 | ~500MB | 8 |
| Turbo ×100 | 195 (simplified) | ~16 | ~200MB | 4 |
| Headless ×1000 | 195 (statistical) | N/A | ~50MB | 2 |

### 9.5 스냅샷 & 복원

```go
type SimSnapshot struct {
    Timestamp     time.Time
    SimTime       time.Duration
    EpochNumber   int
    Era           int

    // 세계 상태
    Sovereignty   map[string]SovereigntyRecord  // 195국 주권
    FactionStates map[string]FactionSnapshot    // 팩션 상태
    Economies     map[string]CountryEconomy     // 경제 상태
    Wars          []WarRecord                   // 활성 전쟁
    Treaties      []Treaty                      // 활성 조약

    // 에이전트 상태
    Agents        map[string]AgentSnapshot      // 에이전트 위치/상태
    Deployments   map[string]string             // agentID → countryISO

    // AI 상태
    Strategies    map[string]GrandStrategy      // 국가별 전략
    Personalities map[string]NationalPersonality // 현재 성격 (진화 반영)

    // 통계
    Stats         SimStats
}

// 30분마다 자동 스냅샷 (Turbo에서는 시뮬 시간 30분마다)
// 파일: snapshots/sim_{timestamp}.json.gz
```

### 9.6 CLI 인터페이스

```bash
# 시뮬레이션 실행
./game.sh simulate                          # 기본 (×10, 1시즌)
./game.sh simulate -speed 100              # Turbo
./game.sh simulate -speed 1000 -headless   # Headless
./game.sh simulate -seed 42               # 재현 가능 시드
./game.sh simulate -duration 1w            # 1주만 시뮬

# 시뮬레이션 관전 (별도 터미널)
./game.sh simwatch                         # 관전 WebUI 실행
./game.sh simwatch -port 9002             # 포트 지정

# 스냅샷에서 복원
./game.sh simulate -restore snapshots/sim_20260307.json.gz

# 분석 리포트
./game.sh simreport -input snapshots/     # 전체 스냅샷 분석
./game.sh simreport -faction "Eagle Alliance"  # 팩션별 분석
```

---

<!-- SECTION_10 -->

## 10. 관전 & 분석 시스템

### 10.1 관전 모드 (SimWatch WebUI)

실시간 시뮬레이션 관전을 위한 웹 대시보드:

```
SimWatch WebUI (Next.js, port 9002)
├── 🌍 World Map View
│   ├── 195국 실시간 주권 색상
│   ├── 전쟁 화살표 애니메이션
│   ├── 팩션 영토 하이라이트
│   └── 국가 호버 → 상세 정보 팝업
│
├── ⚔️ Battle Focus View
│   ├── 선택한 국가의 실시간 전투 (20Hz)
│   ├── 에이전트 움직임 2D 렌더링
│   ├── 에포크 타이머 + 전투 통계
│   └── 팩션별 점수 실시간 차트
│
├── 📊 Analytics Dashboard
│   ├── 팩션 영토 변화 타임라인
│   ├── GDP 순위 실시간 차트
│   ├── 전쟁 히스토리 타임라인
│   ├── 에이전트 킬/데스 통계
│   └── 자원 흐름 산키 다이어그램
│
├── 📰 Event Feed
│   ├── 실시간 이벤트 스트림 (전쟁 선포, 조약, 정복 등)
│   ├── 심각도별 필터링
│   └── 이벤트 클릭 → 상세 + 맵 포커스
│
└── 🏆 Leaderboard
    ├── 팩션 순위 (영토/GDP/군사력)
    ├── 국가 순위
    ├── 에이전트 순위 (킬/생존)
    └── 명예의 전당 프리뷰
```

### 10.2 WebSocket 프로토콜 (SimWatch)

```go
// 서버 → 클라이언트 (SimWatch)
type SimWatchMessage struct {
    Type string      `json:"type"`
    Data interface{} `json:"data"`
}

// 메시지 타입:
// "world_state"    — 1Hz, 195국 주권/전쟁 상태
// "battle_state"   — 20Hz, 선택한 아레나의 전투 상태
// "event"          — 이벤트 시, 전쟁/조약/정복 알림
// "faction_update" — 10s, 팩션 영토/GDP/순위
// "analytics"      — 30s, 집계 통계
// "epoch_result"   — 에포크 종료 시 스코어보드
// "era_transition" — Era 전환 알림
// "season_end"     — 시즌 종료 결과

// 클라이언트 → 서버
// "subscribe_battle" {country_iso: "KOR"} — 특정 국가 전투 구독
// "unsubscribe_battle" — 전투 구독 해제
// "set_speed" {scale: 100} — 시간 가속 변경 (관리자만)
// "pause" / "resume" — 일시정지/재개
// "request_snapshot" — 현재 상태 스냅샷 요청
```

### 10.3 분석 리포트 생성

시뮬레이션 종료 후 자동 생성되는 리포트:

```go
type SimulationReport struct {
    // 메타
    SimID         string
    Duration      time.Duration
    TimeScale     float64
    TotalEpochs   int
    Seed          int64

    // 결과
    FinalRankings      []FactionRanking    // 최종 팩션 순위
    WorldDominator     string              // 최다 영토 팩션
    EconomicSuperpower string              // 최고 GDP 팩션
    WarMachine         string              // 최다 전쟁 승리 팩션
    Peacekeeper        string              // 최장 평화 유지

    // 타임라인
    TerritoryTimeline  []TimelineEntry     // 영토 변화 (1시간 단위)
    GDPTimeline        []TimelineEntry     // GDP 변화
    WarTimeline        []WarTimelineEntry  // 전쟁 타임라인
    AllianceTimeline   []AllianceEntry     // 동맹 변화

    // 통계
    TotalBattles       int
    TotalWars          int
    TotalTreaties      int
    TotalSieges        int
    TotalKills         int
    AverageEpochDuration time.Duration
    BusiestCountry     string              // 가장 많은 전투가 벌어진 국가
    MostContestedCountry string            // 가장 많은 주권 변경

    // 하이라이트
    MajorEvents        []MajorEvent        // 주요 이벤트 (수도 함락, 대전쟁 등)
    MVPAgents          []AgentMVP          // 시즌 MVP 에이전트
    SurpriseResults    []SurpriseEntry     // 의외의 결과 (D-tier 국가가 S-tier 정복 등)
}
```

### 10.4 리플레이 시스템

스냅샷 기반 시뮬레이션 리플레이:

```go
type ReplayPlayer struct {
    snapshots []SimSnapshot  // 시간순 정렬된 스냅샷
    current   int            // 현재 재생 인덱스
    speed     float64        // 재생 속도
}

// 리플레이 기능:
// - 타임라인 드래그로 시점 이동
// - 재생 속도 조절 (×0.5 ~ ×10)
// - 특정 국가/팩션 포커스 추적
// - 주요 이벤트 시점 북마크 자동 생성
```

### 10.5 타임랩스 비디오 생성 (선택)

```bash
# 시뮬레이션 결과를 30초 타임랩스 영상으로 렌더링
./game.sh simrender -input snapshots/ -output timelapse.mp4 -fps 30 -duration 30s

# 세계지도 위에 주권 색상 변화를 프레임 단위로 렌더링
# ffmpeg + headless canvas 활용
```

---

<!-- SECTION_11 -->

## 11. 구현 로드맵

### 11.1 구현 페이즈 (6단계)

```
Phase 0: 기반 준비 (2일)
Phase 1: 시뮬레이션 코어 엔진 (3일)
Phase 2: 전략 AI (4일)
Phase 3: 통합 & 자동화 (2일)
Phase 4: 관전 & 분석 (3일)
Phase 5: 최적화 & 가속 (2일)
──────────────────────────────
총 예상: ~16일
```

### 11.2 Phase 0: 기반 준비

| # | 태스크 | 파일 | 의존 |
|---|--------|------|------|
| S01 | `cmd/simulate/main.go` 엔트리포인트 | cmd/simulate/ | - |
| S02 | `SimConfig` 정의 + CLI 플래그 파싱 | sim/config.go | S01 |
| S03 | `SimClock` 구현 (가상 시간, 가속) | sim/clock.go | S02 |
| S04 | `game.sh simulate` 서브커맨드 추가 | game.sh | S01 |

### 11.3 Phase 1: 시뮬레이션 코어 엔진

| # | 태스크 | 파일 | 의존 |
|---|--------|------|------|
| S05 | `SimulationEngine` 상태 머신 | sim/engine.go | S03 |
| S06 | `SimState` 글로벌 상태 관리 | sim/state.go | S05 |
| S07 | `SimRecorder` 이벤트 기록 | sim/recorder.go | S06 |
| S08 | 시드 프로세스 (WorldManager 연결) | sim/engine.go | S05 |
| S09 | 메인 루프 (틱 + 전략 + 경제) | sim/engine.go | S08 |
| S10 | `ArenaScheduler` 우선순위 스케줄링 | sim/engine.go | S09 |
| S11 | 통계적 전투 근사 (비활성 아레나) | sim/engine.go | S10 |
| S12 | 스냅샷 저장/복원 | sim/snapshot.go | S07 |
| S13 | 시즌 종료 처리 + 리포트 뼈대 | sim/engine.go | S09 |

### 11.4 Phase 2: 전략 AI

| # | 태스크 | 파일 | 의존 |
|---|--------|------|------|
| S14 | `NationalPersonality` 5축 정의 | strategy/personality.go | - |
| S15 | 195국 성격 데이터 매핑 | strategy/personality.go | S14 |
| S16 | `NationalAI` 인터페이스 + 구현체 | strategy/national_ai.go | S15 |
| S17 | `SituationAssessment` 상황 평가 | strategy/evaluation.go | S16 |
| S18 | `FactionFormationAI` 3단계 형성 | strategy/faction_formation.go | S15 |
| S19 | `DeploymentOptimizer` 배치 최적화 | strategy/deployment.go | S17 |
| S20 | `WarStrategyAI` 전쟁 의사결정 | strategy/war_strategy.go | S17 |
| S21 | `DiplomacyAI` 외교 의사결정 + 자동 응답 | strategy/diplomacy_ai.go | S17 |
| S22 | `EconomyAI` 경제 정책 자동화 | strategy/economy_ai.go | S17 |
| S23 | `StrategicDecisionEngine` 통합 | strategy/ | S16~S22 |
| S24 | `GrandStrategy` 장기 목표 시스템 | strategy/national_ai.go | S23 |
| S25 | 성격 진화 (Adaptive) | strategy/personality.go | S24 |
| S26 | Era별 행동 보정 | strategy/national_ai.go | S24 |

### 11.5 Phase 3: 통합 & 자동화

| # | 태스크 | 파일 | 의존 |
|---|--------|------|------|
| S27 | SimEngine ↔ StrategicDecisionEngine 연결 | sim/engine.go | S13, S23 |
| S28 | 전쟁 자동 수행 (WarExecutor) | strategy/war_strategy.go | S27 |
| S29 | 팩션 동적 변화 (탈퇴/합병/분열) | strategy/faction_formation.go | S27 |
| S30 | 에이전트 전술 지시 동적 갱신 | sim/engine.go | S27 |
| S31 | 자연재해/글로벌 이벤트 자동 발생 | sim/engine.go | S27 |
| S32 | 통합 테스트 (1 Era 시뮬레이션) | sim/ | S27~S31 |

### 11.6 Phase 4: 관전 & 분석

| # | 태스크 | 파일 | 의존 |
|---|--------|------|------|
| S33 | `cmd/simweb/main.go` 관전 서버 | cmd/simweb/ | S27 |
| S34 | SimWatch WebSocket 프로토콜 | simws/ | S33 |
| S35 | World Map 실시간 주권 시각화 | apps/web (SimWatch) | S34 |
| S36 | Event Feed 실시간 스트림 | apps/web (SimWatch) | S34 |
| S37 | Analytics Dashboard 차트 | apps/web (SimWatch) | S34 |
| S38 | `SimulationReport` 자동 생성 | sim/analytics.go | S27 |
| S39 | 리플레이 시스템 (스냅샷 기반) | sim/snapshot.go | S12, S38 |

### 11.7 Phase 5: 최적화 & 가속

| # | 태스크 | 파일 | 의존 |
|---|--------|------|------|
| S40 | Turbo 모드 (×100) — SimplifiedArena | sim/engine.go | S32 |
| S41 | Headless 모드 (×1000) — 통계적 근사 | sim/engine.go | S40 |
| S42 | 메모리 프로파일링 & 최적화 | sim/ | S40 |
| S43 | 벤치마크 (1시즌 Headless < 1시간 목표) | sim/ | S41 |
| S44 | 몬테카를로 배치 실행 (N회 반복, 통계) | cmd/simulate/ | S43 |

### 11.8 우선순위 & MVP 범위

**MVP (Phase 0~2, ~9일)**:
- 195국 AI 에이전트 자동 전투
- 팩션 자동 형성
- 전략 AI 의사결정 (배치, 전쟁, 외교)
- ×10 가속 모드
- 콘솔 로그 기반 관전

**Full Version (Phase 3~5, ~7일 추가)**:
- 관전 WebUI
- 분석 대시보드
- Turbo/Headless 모드
- 리플레이 시스템
- 몬테카를로 배치 실행

---

## 부록: 핵심 수치 정리

| 항목 | 값 | 비고 |
|------|-----|------|
| 총 국가 | 195 | countries_seed.go 기반 |
| 총 AI 에이전트 | ~3,000 | tier별 차등 |
| 동시 활성 아레나 | 50 (최대) | on-demand |
| 자동 형성 팩션 | 12~30 | Phase 기반 형성 |
| 에포크 길이 | 10분 (가속 적용) | 6단계 상태 머신 |
| 전략 결정 주기 | 1시간 (가속 적용) | 4계층 AI |
| 시즌 길이 | 4주 (가속 적용) | 4 Era |
| 성격 축 | 5차원 | Agg/Exp/Coop/Eco/Adapt |
| 성격 아키타입 | 8종 | 국가별 매핑 |
| 전술 명령 | 16종 | 기존 AgentCommandRouter |
| 빌드 패스 | 5종 | 기존 BotManager |
| 스냅샷 주기 | 30분 (시뮬 시간) | 복원/리플레이용 |
| MVP 예상 기간 | ~9일 | Phase 0~2 |

---

> **이 문서는 AI World War 195국 전체 시뮬레이션 시스템의 종합 기획서입니다.**
> 기존 게임 서버 코드를 최대한 재사용하면서, 전략 AI 레이어를 추가하여 완전 자동화 시뮬레이션을 구현합니다.
