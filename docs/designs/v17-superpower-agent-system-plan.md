# AI World War — SuperPower 지정학 시뮬레이션 AI 에이전트 시스템 (v17)

> **Version**: v17.0 (SuperPower Agent Intelligence)
> **Date**: 2026-03-07
> **Status**: DRAFT — Strategic Plan
> **Based on**: v11 World War Plan + v14 System Architecture + v16 Simulation System + SuperPower 2 Analysis + aww-agent-skill SDK
> **Core Vision**: SuperPower 2의 27개 자원 경제 · 외교 DR · 군사 유닛 상성 · 정치 이념 시스템을 AI 에이전트가 **자율적으로 학습하고 실행**할 수 있도록 aww-agent-skill SDK를 확장
> **Goal**: 외부 AI 에이전트(LLM/커스텀 봇)가 단순 전투뿐 아니라 **경제 정책 수립 · 외교 협상 · 전쟁 전략 · 정치 체제 운영**까지 수행하는 "진짜 세계 시뮬레이터"

---

## 목차

1. [비전 & 핵심 컨셉](#1-비전--핵심-컨셉)
2. [SuperPower 시스템 매핑 분석](#2-superpower-시스템-매핑-분석)
3. [Agent Skill Layer Architecture](#3-agent-skill-layer-architecture)
4. [경제 에이전트 시스템](#4-경제-에이전트-시스템)
5. [외교 에이전트 시스템](#5-외교-에이전트-시스템)
6. [군사 전략 에이전트 시스템](#6-군사-전략-에이전트-시스템)
7. [정치 · 거버넌스 에이전트 시스템](#7-정치--거버넌스-에이전트-시스템)
8. [aww-agent-skill SDK v2 확장](#8-aww-agent-skill-sdk-v2-확장)
9. [서버 확장 설계](#9-서버-확장-설계)
10. [AI 학습 & 메모리 시스템](#10-ai-학습--메모리-시스템)
11. [리스크 분석](#11-리스크-분석)
12. [구현 로드맵](#12-구현-로드맵)

---

<!-- SECTION_1 -->

## 1. 비전 & 핵심 컨셉

### 1.1 한 줄 요약

> **"외부 AI 에이전트가 SuperPower 2 수준의 27개 자원 경제 · 다자 외교 · 유닛 상성 군사 · 정치 이념 시스템을 학습하고 자율 운영하는 멀티플레이어 지정학 시뮬레이션 플랫폼"**

### 1.2 현재 vs 목표 비교

| 영역 | 현재 (v14~v16) | 목표 (v17 SuperPower) |
|------|---------------|----------------------|
| **전투** | 10종 무기 + 20종 시너지, 봇 5종 빌드패스 | 유지 + **유닛 클래스 상성** + 지형 전술 |
| **경제** | 6종 자원, 단순 GDP, 세율 슬라이더 | **27종 자원** (SP2), 수출입 GDP, 국유화/민영화, 부패, 10종 예산 |
| **외교** | 양자 조약 7종, Influence 비용 | **다자 조약** (SP2), 관계값 DR(-100~+100), 문화/종교 보너스 |
| **군사** | 에이전트 = 단일 유닛, 자동전투 | **5종 유닛 클래스** + 기술 레벨 + 훈련 등급, 유닛 상성 |
| **정치** | 없음 | **6종 정부 형태** (SP2), 이념 → 경제/군사/외교 수정자 |
| **Agent SDK** | 전투 전용 (angle + boost) | **전투 + 경제 + 외교 + 군사 + 정치** 5개 도메인 에이전트 |
| **AI 학습** | memory.go (전투 기록) | **WorldMemory** (전투 + 경제 + 외교 + 정치 이력 통합) |

### 1.3 왜 SuperPower 2 시스템인가?

SuperPower 2의 핵심 교훈: **시스템 간 상호연결성**

```
핵 연구 시작 → 전 세계 DR -55 → 무역 파트너 이탈 → GDP 하락 → 군비 축소 → 취약
아동 노동 합법화 → 전 자원 생산 +10% → GDP 상승 → BUT DR 하락 → 고립 → 전쟁 취약
민주주의 → 최고 생산력 → BUT 선거 → 지지율 관리 필요 → 인기 없는 정책 불가
```

이 **"모든 결정이 파급 효과를 만드는"** 구조가 AI 에이전트에게 학습시킬 최적의 환경:
- LLM 에이전트는 이런 복잡한 인과관계를 자연어로 추론 가능
- 커스텀 봇은 수치 최적화로 최적 전략을 탐색 가능
- 인간 유저는 AI의 결정을 관전하며 드라마를 즐김

### 1.4 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **SP2 충실 재현** | SP2의 검증된 공식을 최대한 그대로 구현 (SP3 실패 교훈) |
| **AI-First 설계** | 모든 시스템이 API로 제어 가능, 인간 UI는 AI API의 래퍼 |
| **시스템 상호연결** | 경제↔외교↔군사↔정치 모든 결정이 다른 영역에 파급 |
| **학습 가능** | 에이전트가 과거 시즌 데이터를 학습하여 진화 |
| **관전 가치** | 복잡한 시스템이 만들어내는 "예측 불가 드라마" |

---

<!-- SECTION_2 -->

## 2. SuperPower 시스템 매핑 분석

### 2.1 SP2 → AWW 시스템 매핑 총괄

| SP2 시스템 | SP2 상세 | AWW 현재 (v14~v16) | AWW v17 목표 | 구현 난이도 |
|-----------|---------|-------------------|-------------|-----------|
| **27개 자원** | 6카테고리 × 4~5종, 생산/소비/무역 | 6종 자원 (Food/Oil/Steel/Tech/Gold/Influence) | **12종 자원** (SP2 핵심 축약) + 생산/소비 순환 | 중 |
| **GDP = 생산 합계** | 수출 +GDP, 수입 -GDP | 단순 GDP = Σ(자원×시장가) | SP2식 GDP + 무역수지 반영 | 중 |
| **세금 3층** | PIT + 부문세 + GTM | 세율 슬라이더 1개 (0~50%) | **PIT + 자원세 + GTM** 3층 구조 | 중 |
| **예산 10종** | 인프라/통신/교육/의료/국방 등 | 3종 (군비/기술/외교) | **8종 예산 슬라이더** | 중 |
| **국유화/민영화** | 민간 +40% 성장, 통제 상실 | 없음 | **국유화/민영화 선택** + 성장/통제 트레이드오프 | 하 |
| **부패** | 예산 손실, 정부지출로 감소 | 없음 | **부패 메커니즘** (정부 형태 연동) | 하 |
| **경제 건강도** | 0~100%, 성장률 배율 | 없음 | **EconomicHealth** (인프라+통신 기반) | 하 |
| **DR -100~+100** | 관계 수치, AI 결정 지배 | Influence 기반 조약 비용 | **DR 시스템** + 모든 외교결정 DR 기반 | 고 |
| **다자 조약** | 수십국 참여 복합 조약 | 양자 조약 7종 | **다자 조약** (최대 20국 참여) | 고 |
| **문화/종교/언어 DR보너스** | 공유 시 자동 DR 상승 | 없음 | **문화 친화도** (종교/언어/정부형태 보너스) | 중 |
| **5종 유닛 클래스** | 보병/장갑/전투기/함선/핵 | 단일 에이전트 유닛 | **5종 유닛 클래스** + 상성 시스템 | 고 |
| **기술 레벨** | 유닛별 총기/미사일/스텔스/속도 | 무기 Lv1-5 진화 | **국가 기술 레벨** → 유닛 스탯 수정자 | 중 |
| **훈련 등급** | 신병→정규→베테랑→엘리트 | 없음 | **훈련 등급** (전투 경험 기반 자동 승급) | 하 |
| **6종 정부 형태** | 다당제/일당제/공산/독재/왕정/신정 | 없음 | **6종 정부 형태** + 경제/군사/외교 수정자 | 중 |
| **국내법** | 표현자유/아동노동 등 | 없음 | **5종 핵심 정책** + DR/경제 연동 | 하 |
| **핵무기** | 10레벨, AMDS, SSBN | 없음 | **핵 연구 트리** (3레벨 간소화) + 외교 패널티 | 중 |
| **선거** | 지지율 50% 미만 = 게임 오버 | 없음 | **지지율 시스템** + 정부형태별 선거/쿠데타 | 중 |
| **비밀작전** | 스파이/사보타주/쿠데타 | Intel System (v11) | v11 스파이 시스템 확장 + **쿠데타 지원** | 하 |

### 2.2 구현 우선순위 판단

SP2의 모든 시스템을 100% 재현할 필요 없음. **에이전트가 학습할 수 있는 "결정 공간"의 풍부함**이 핵심.

```
Priority 1 (Core — 시스템 상호연결의 뼈대):
  ├── 12종 자원 + GDP 공식          ← 경제의 기반
  ├── DR 관계 시스템 + 다자 조약     ← 외교의 기반
  ├── 6종 정부 형태 + 수정자         ← 정치의 기반
  └── 5종 유닛 클래스 + 상성         ← 군사의 기반

Priority 2 (Depth — 의사결정 깊이 추가):
  ├── 세금 3층 + 예산 8종           ← 경제 정책 깊이
  ├── 문화/종교 DR 보너스           ← 외교 자동화
  ├── 기술 레벨 + 훈련 등급         ← 군사 투자 가치
  └── 국내법 + 지지율              ← 정치 트레이드오프

Priority 3 (Polish — 완성도):
  ├── 국유화/민영화, 부패, 경제건강도
  ├── 핵무기 연구 + 외교 패널티
  ├── 비밀작전 확장 (쿠데타 지원)
  └── 선거 + 쿠데타 메커니즘
```

---

<!-- SECTION_3 -->

## 3. Agent Skill Layer Architecture

### 3.1 현재 에이전트 아키텍처 (v14~v16)

```
현재 aww-agent-skill SDK v1:
┌───────────────────────────────────────────┐
│  AWWAgent                                  │
│  ├── GameClient (WebSocket)                │
│  │   ├── joinCountryArena(iso)             │
│  │   ├── agent_input { angle, boost }      │  ← 전투 입력만
│  │   └── agent_state (100ms 수신)          │
│  ├── Strategy (전투 AI만)                   │
│  │   ├── AggressiveStrategy                │
│  │   ├── DefensiveStrategy                 │
│  │   └── BalancedStrategy                  │
│  └── AWWApi (REST)                          │
│      ├── POST /agents/register              │
│      ├── GET /countries                     │
│      └── GET /leaderboard                  │
└───────────────────────────────────────────┘

서버 에이전트 시스템 (Go):
├── agent.go (전투 물리)
├── agent_api.go (Commander Mode — 16개 전투 명령)
├── commander.go (AI↔수동 전환)
├── training.go (6종 Personality, BuildProfile)
├── memory.go (전투 기록 학습)
└── bot.go (내장 봇 AI)
```

**한계**: 에이전트는 **전투만** 할 수 있음. 경제 정책, 외교 협상, 군사 배치, 정치 결정은 모두 서버 내부 AI(v16 NationalAI)가 처리하거나 유저가 UI에서 직접 수행. 외부 AI 에이전트가 "진짜 세계 운영"을 할 수 없음.

### 3.2 목표 에이전트 아키텍처 (v17)

```
v17 aww-agent-skill SDK v2:
┌──────────────────────────────────────────────────────────────────────┐
│  AWWAgent v2                                                          │
│                                                                       │
│  ┌── CombatDomain (전투 — 기존 확장) ──────────────────────────────┐ │
│  │   ├── Strategy (전투 AI): Aggressive/Defensive/Balanced/Custom    │ │
│  │   ├── UnitCommander: 5종 유닛 클래스 배치/전술 명령               │ │
│  │   └── BattleObserver: 전투 상태 + 유닛 상성 분석                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── EconomyDomain (경제 — NEW) ───────────────────────────────────┐ │
│  │   ├── ResourceManager: 12종 자원 생산/소비 모니터링               │ │
│  │   ├── TaxPolicy: 3층 세금 설정 (PIT/자원세/GTM)                  │ │
│  │   ├── BudgetAllocator: 8종 예산 배분 결정                        │ │
│  │   ├── TradeEngine: 자원 수출입 주문, 무역 협정                    │ │
│  │   └── Privatization: 국유화/민영화 결정                          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── DiplomacyDomain (외교 — NEW) ─────────────────────────────────┐ │
│  │   ├── RelationTracker: DR(-100~+100) 추적, 변화 예측             │ │
│  │   ├── TreatyNegotiator: 다자 조약 제안/수락/파기                  │ │
│  │   ├── AllianceManager: 동맹 관리, 집단 안보 구축                  │ │
│  │   ├── SanctionEngine: 경제 제재 발동/해제                        │ │
│  │   └── WarDeclarator: 전쟁 선포/항복/휴전 결정                    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── MilitaryDomain (군사전략 — NEW) ──────────────────────────────┐ │
│  │   ├── ForceComposition: 유닛 클래스별 생산/해산 결정              │ │
│  │   ├── DeploymentPlanner: 국가별 병력 배치 최적화                  │ │
│  │   ├── TechResearch: 기술 레벨 투자 방향 결정                     │ │
│  │   ├── NukeStrategy: 핵 연구/사용 결정 (외교 패널티 고려)         │ │
│  │   └── IntelOps: 정보전/사보타주/방첩 명령                        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── PoliticsDomain (정치 — NEW) ──────────────────────────────────┐ │
│  │   ├── GovernmentType: 정부 형태 전환 결정                        │ │
│  │   ├── DomesticPolicy: 5종 국내법 결정 (DR/경제 트레이드오프)     │ │
│  │   ├── ApprovalManager: 지지율 모니터링, 선전/선거 전략           │ │
│  │   ├── CoupDefense: 쿠데타 방어/도발                             │ │
│  │   └── UNVoting: UN 위원회 결의안 투표 결정                       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── WorldState (통합 세계 상태) ──────────────────────────────────┐ │
│  │   ├── WorldSnapshot: 전체 세계 상태 (1시간마다 갱신)              │ │
│  │   ├── CountryDetail: 개별 국가 상세 (자원/DR/군사/정치)          │ │
│  │   ├── FactionIntel: 팩션 정보 (영토/군사력/경제력/동맹)          │ │
│  │   └── EventFeed: 글로벌 이벤트 실시간 스트림                     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── AgentMemory (학습 시스템) ────────────────────────────────────┐ │
│  │   ├── SeasonHistory: 시즌별 전체 이력 (경제/외교/군사/정치)      │ │
│  │   ├── DecisionLog: 의사결정 이력 + 결과 피드백                   │ │
│  │   ├── StrategyEval: 전략 성과 평가 (GDP 변화, 영토 변동)         │ │
│  │   └── OpponentModel: 타 팩션/국가 행동 패턴 추적                 │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌── Transport Layer ─────────────────────────────────────────────┐  │
│  │   ├── GameWS: 전투 실시간 (20Hz)                                │  │
│  │   ├── MetaWS: 경제/외교/정치 이벤트 실시간 (1Hz)                │  │
│  │   └── MetaREST: 정책 결정 API (요청-응답)                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 에이전트 도메인 분리 (5 Domain Agent)

핵심 설계: 각 도메인은 **독립적인 의사결정 주기**와 **고유 API**를 가짐.

```
Domain       │ 의사결정 주기  │ 프로토콜    │ 입력                │ 출력
─────────────┼───────────────┼───────────┼────────────────────┼──────────────────
Combat       │ 50ms (틱)     │ GameWS    │ agent_state         │ {angle,boost,cmd}
Economy      │ 1시간 (경제틱) │ MetaREST  │ EconomySnapshot     │ PolicyDecision
Diplomacy    │ 1시간         │ MetaREST  │ DiplomacySnapshot   │ DiplomacyAction[]
Military     │ 1시간         │ MetaREST  │ MilitarySnapshot    │ MilitaryOrder[]
Politics     │ 24시간        │ MetaREST  │ PoliticsSnapshot    │ PoliticsDecision
```

**LLM 에이전트를 위한 자연어 인터페이스**:

```json
// 서버 → LLM 에이전트 (EconomySnapshot)
{
  "prompt": "You are the economic advisor of South Korea (KOR).",
  "context": {
    "gdp": 2850000,
    "resources": {"food": 45, "oil": 5, "steel": 70, "tech": 95, ...},
    "tax_rate": {"pit": 25, "resource": 10, "gtm": 0},
    "budget": {"infrastructure": 20, "education": 15, "military": 25, ...},
    "trade_balance": -150000,
    "economic_health": 72,
    "corruption": 12,
    "threats": ["CHN expanding into East Asia", "Oil shortage expected"],
    "opportunities": ["JPN trade agreement possible", "Tech export demand high"]
  },
  "available_actions": [
    "set_tax(pit, resource, gtm)",
    "set_budget(category, percentage)",
    "propose_trade(partner_iso, offer_resource, request_resource, amounts)",
    "nationalize(sector) | privatize(sector)",
    "set_trade_policy(open|restricted|embargo, target_iso)"
  ],
  "request": "Decide your economic policy for the next hour. Return JSON."
}
```

**커스텀 봇을 위한 수치 인터페이스**:

```typescript
// SDK v2 — 커스텀 봇 코드
const agent = createAgent({...});

agent.economy.onSnapshot((snap: EconomySnapshot) => {
  // GDP 성장 최적화
  if (snap.economicHealth < 50) {
    agent.economy.setBudget('infrastructure', 30); // 인프라 투자
    agent.economy.setBudget('telecommunications', 20);
  }

  // 자원 부족 시 무역
  if (snap.resources.oil < 20) {
    agent.economy.proposeTrade('SAU', { offer: { tech: 50 }, request: { oil: 30 } });
  }

  // 세금 최적화 (성장률과 수입의 균형)
  agent.economy.setTax({ pit: 20, resource: 8, gtm: 5 });
});
```

---

<!-- SECTION_4 -->

## 4. 경제 에이전트 시스템

SP2의 27개 자원을 AI 에이전트가 관리 가능하도록 **12종으로 축약** + 핵심 공식 보존.

### 4.1 자원 체계 (12종 — SP2 축약)

| # | 자원 | 카테고리 | 기본 성장률 | SP2 원본 | 핵심 용도 |
|---|------|---------|-----------|---------|----------|
| 1 | **Grain** 🌾 | 식량 | 1%/h | 곡물+채소+육류+유제품 | 인구 유지, 안정도 |
| 2 | **Energy** ⚡ | 에너지 | 2%/h | 전기+화석연료 | 모든 생산의 기반 |
| 3 | **Oil** 🛢️ | 에너지 | 1.5%/h | 석유 (분리) | 군사 운영, 원거리 배치 |
| 4 | **Minerals** ⛏️ | 원자재 | 1%/h | 광물+보석 | 무기 생산, 건설 |
| 5 | **Steel** ⚙️ | 원자재 | 1.5%/h | 철강+목재 | 유닛 생산, 인프라 |
| 6 | **Chemicals** 🧪 | 산업재 | 10%/h | 화학+제약+플라스틱 | 기술 연구, 의료 |
| 7 | **Machinery** 🏭 | 산업재 | 10%/h | 기계 | 생산력 증폭 |
| 8 | **Electronics** 💻 | 완제품 | 13%/h | 전자기기+가전 | 기술 레벨, 통신 |
| 9 | **Vehicles** 🚗 | 완제품 | 13%/h | 차량 | 군사 기동력 |
| 10 | **Services** 🏢 | 서비스 | 16%/h | 건설+소매+관광 등 | GDP 핵심, 고용 |
| 11 | **Tech** 💡 | 서비스 | 16%/h | 엔지니어링+의료+교육 | 연구, 유닛 강화 |
| 12 | **Gold** 💰 | 화폐 | - | 세수 | 범용 화폐 (세수 기반) |

### 4.2 GDP 공식 (SP2 충실 재현)

```
국가 GDP = Σ (resource[i].production × resource[i].market_price) + trade_income - trade_expense

where:
  resource[i].production = base_production × tier_mult × health_mult × policy_mult
  health_mult = economic_health / 100 × 2  (SP2: 100%일 때 2배, 0%면 0)
  policy_mult = government_type_modifier × privatization_bonus × corruption_penalty

trade_income = Σ (export_resource[j] × export_price[j])  ← GDP 증가
trade_expense = Σ (import_resource[k] × import_price[k])  ← GDP 감소
```

### 4.3 세금 3층 구조 (SP2 재현)

```go
type TaxSystem struct {
    PIT           float64 // 개인소득세 (0~60%) — 주요 재원, GDP × PIT
    ResourceTax   map[ResourceType]float64 // 자원별 세금 (0~30%)
    GTM           float64 // 글로벌 세금 수정치 (-50% ~ +100%) — 전체 세율에 곱
}

// 세수 계산
func (t *TaxSystem) CalculateRevenue(gdp float64, resources map[ResourceType]*ResourceState) float64 {
    revenue := gdp * t.PIT / 100  // PIT 세수

    for rType, rState := range resources {
        effectiveRate := t.ResourceTax[rType] * (1 + t.GTM/100)
        revenue += rState.Production * rState.MarketPrice * effectiveRate / 100
    }

    return revenue
}

// ⚠️ SP2 트레이드오프: 높은 세율 → 단기 수입↑, 장기 성장률↓
func (t *TaxSystem) GetGrowthPenalty() float64 {
    avgRate := (t.PIT + averageResourceTax(t.ResourceTax)) / 2
    if avgRate > 40 { return 0.7 }  // 고세율 → 성장률 30% 감소
    if avgRate > 25 { return 0.85 }
    return 1.0  // 저세율 → 성장률 유지
}
```

### 4.4 예산 배분 (8종 슬라이더)

| 예산 항목 | SP2 원본 | 효과 | 트레이드오프 |
|----------|---------|------|------------|
| **Infrastructure** | 인프라 | 경제 건강도 +, 생산 기반 | 장기 투자 |
| **Telecommunications** | 통신 | 경제 건강도 +, Tech 보너스 | 장기 투자 |
| **Education** | 교육 | Services/Tech 성장률 +, 인력 품질↑ | 3-5 에포크 후 효과 |
| **Healthcare** | 의료 | 인구 유지, 안정도 + | 생존 필수 |
| **Military** | 국방 | 유닛 생산/유지, 기술 연구 | 경제 감소 |
| **Government** | 정부 | 부패 감소, 안정도 + | 비효율적 소비 |
| **Propaganda** | 선전 | 국내 지지율 +, 글로벌 DR - | 외교 악화 |
| **ForeignAid** | 외국원조 | 글로벌 DR +, 특정 국가 DR++ | 자금 유출 |

```go
type BudgetAllocation struct {
    Infrastructure     float64 // 0~30%
    Telecommunications float64 // 0~20%
    Education          float64 // 0~20%
    Healthcare         float64 // 0~15%
    Military           float64 // 0~40%
    Government         float64 // 0~15%
    Propaganda         float64 // 0~10%
    ForeignAid         float64 // 0~10%
    // 합계 = 100%
}

// 경제 건강도 계산 (SP2 핵심 — 인프라+통신이 핵심)
func CalculateEconomicHealth(budget BudgetAllocation, corruption float64) float64 {
    base := budget.Infrastructure*2.5 + budget.Telecommunications*2.0
    educationBonus := budget.Education * 0.5
    corruptionPenalty := corruption * 0.8
    return clamp(base + educationBonus - corruptionPenalty, 0, 100)
}
```

### 4.5 국유화/민영화 (SP2 재현)

```go
type OwnershipPolicy struct {
    PublicSector  float64 // 0~100% (국유화 비율)
    PrivateSector float64 // 100 - PublicSector
}

// SP2: 민간 부문은 정부 부문 대비 40% 더 빠르게 성장
func (o *OwnershipPolicy) GetGrowthModifier() float64 {
    privateGrowth := o.PrivateSector / 100 * 1.4  // 민간 140% 성장
    publicGrowth := o.PublicSector / 100 * 1.0     // 국영 100% 성장
    return privateGrowth + publicGrowth
}

// 트레이드오프: 민영화 → 빠른 성장, 자원 직접 통제 불가
// 국유화 → 느린 성장, 자원 배분 통제 가능
```

### 4.6 에이전트 경제 API (SDK v2)

```typescript
interface EconomyAPI {
  // 읽기 — 매 경제틱(1시간)마다 자동 수신
  onEconomySnapshot(handler: (snap: EconomySnapshot) => void): void;
  getResourceProduction(): Record<ResourceType, ResourceState>;
  getTradeOffers(): TradeOffer[];
  getGDPHistory(periods: number): GDPDataPoint[];

  // 쓰기 — 정책 결정 (1시간마다 제출 가능)
  setTaxPolicy(tax: TaxPolicy): Promise<void>;
  setBudgetAllocation(budget: BudgetAllocation): Promise<void>;
  proposeTrade(offer: TradeProposal): Promise<TradeResult>;
  acceptTrade(tradeId: string): Promise<void>;
  rejectTrade(tradeId: string): Promise<void>;
  setOwnership(sector: ResourceType, policy: 'nationalize' | 'privatize'): Promise<void>;

  // 분석 — 에이전트 판단 지원
  simulatePolicy(policy: EconomicPolicy): PolicySimulation;  // "만약 세율을 올리면?"
  getTradeRecommendations(): TradeRecommendation[];  // 수출입 최적화 제안
}

interface EconomySnapshot {
  gdp: number;
  gdpGrowthRate: number;
  economicHealth: number;
  corruption: number;
  resources: Record<ResourceType, ResourceState>;
  taxPolicy: TaxPolicy;
  budget: BudgetAllocation;
  tradeBalance: number;
  debtToGdpRatio: number;
  governmentRevenue: number;
  governmentExpense: number;
}
```

---

<!-- SECTION_5 -->

## 5. 외교 에이전트 시스템

SP2의 DR 시스템 + 다자 조약을 AI 에이전트가 자율 운영 가능하도록 재현.

### 5.1 외교 관계 (DR) 시스템

SP2의 핵심: **모든 외교 판단은 DR 수치가 지배**한다.

```go
type DiplomaticRelation struct {
    CountryA    string   // ISO3
    CountryB    string   // ISO3
    DR          float64  // -100 ~ +100
    LastChanged time.Time
}

// DR 자동 보정 요소 (SP2 재현)
type DRModifiers struct {
    SameGovernment      float64 // 같은 정부 형태: +10
    SimilarLaws         float64 // 유사 국내법 (항목당 +2, 최대 +10)
    SharedLanguage      float64 // 공유 언어: +5
    SharedReligion      float64 // 공유 종교: +5
    TradePartner        float64 // 무역 관계: +0.1/hour per active trade
    NukeResearch        float64 // 핵 연구: -55 (전 세계)
    MissileDefense      float64 // 미사일 방어: -35 (전 세계)
    Propaganda          float64 // 선전 예산: -0.5 per % of budget (글로벌)
    ForeignAid          float64 // 외국원조: +0.3 per % of budget (글로벌)
    NobleCause          float64 // 조약 멤버: +1/day, 비멤버: -2/day
    WarHistory          float64 // 전쟁 이력: -30 (점진적 회복)
    TreatyBreach        float64 // 조약 위반: -50 (6개월 지속)
}

// DR 계산 (1시간마다)
func CalculateDR(base float64, mods DRModifiers) float64 {
    dr := base
    dr += mods.SameGovernment + mods.SimilarLaws
    dr += mods.SharedLanguage + mods.SharedReligion
    dr += mods.TradePartner + mods.ForeignAid
    dr -= mods.NukeResearch + mods.MissileDefense
    dr -= mods.Propaganda
    dr += mods.NobleCause
    dr -= mods.WarHistory + mods.TreatyBreach
    return clamp(dr, -100, 100)
}
```

### 5.2 조약 시스템 (양자 + 다자)

SP2의 **다자 조약**을 복원 — SP3가 삭제하여 비판받은 핵심 기능.

| 조약 유형 | DR 요건 | 효과 | 다자 가능 | SP2 원본 |
|----------|---------|------|----------|---------|
| **Cultural Exchange** | DR ≥ 10 | DR +0.5/day | ✅ (최대 50국) | ✅ 동일 |
| **Noble Cause** | DR ≥ 20 | 멤버 +1 DR/day, 비멤버 -2/day | ✅ (최대 30국) | ✅ 동일 |
| **Trade Agreement** | DR ≥ 30 | 자원 무역 수수료 -50% | ✅ (최대 20국) | 경제 동반자 관계 변형 |
| **Common Market** | DR ≥ 50 | 자원 잉여 자동 공유 (★ 최강) | ✅ (최대 10국) | ✅ 동일 |
| **Non-Aggression Pact** | DR ≥ 30 | 상호 공격 불가 (72h) | ❌ 양자 | ✅ 동일 |
| **Military Alliance** | DR ≥ 60 | 공동 방어, 유닛 위치 공유 | ✅ (최대 10국) | ✅ 동일 |
| **Debt Assumption** | DR ≥ 80 | 상대국 부채 전체 이전 | ❌ 양자 | ✅ 동일 |
| **War Declaration Request** | DR ≥ 70 | 타국에게 제3국 공격 강요 | ❌ 양자 | ✅ 동일 |
| **Economic Sanction** | - | 대상 무역 차단 | ✅ (최대 50국) | 글로벌 금수 |
| **Peaceful Annexation** | DR ≥ 95 | 국가 흡수 (매우 어려움) | ❌ 양자 | SP2 Steam Ed. |

**Common Market**이 SP2의 가장 강력한 조약 — 에이전트에게도 핵심 전략 도구:

```go
// Common Market: 멤버 간 자원 잉여를 자동 재분배
func (cm *CommonMarket) DistributeSurplus() {
    for _, resource := range AllResourceTypes {
        surplus := map[string]float64{}  // ISO → 잉여량
        deficit := map[string]float64{}  // ISO → 부족량

        for _, member := range cm.Members {
            balance := member.Production[resource] - member.Consumption[resource]
            if balance > 0 { surplus[member.ISO3] = balance }
            if balance < 0 { deficit[member.ISO3] = -balance }
        }

        // 잉여 → 부족 국가에 자동 전달 (무료, 무역수수료 없음)
        totalSurplus := sum(surplus)
        totalDeficit := sum(deficit)
        transferRate := min(totalSurplus, totalDeficit) / max(totalDeficit, 1)

        for iso, need := range deficit {
            transfer := need * transferRate
            // 잉여국에서 차감, 부족국에 추가
        }
    }
}
```

### 5.3 다자 조약 시스템 (SP2 복원)

```go
type MultilateralTreaty struct {
    ID          string
    Type        TreatyType
    Name        string           // 에이전트가 이름 지정 (e.g. "Pacific Trade Alliance")
    Founder     string           // ISO3
    Members     []string         // 참여국 ISO3 리스트
    MaxMembers  int
    DRThreshold float64          // 가입 최소 DR (설립국 대비)
    CreatedAt   time.Time
    ExpiresAt   time.Time        // 0 = 무기한
    Conditions  []TreatyCondition // 특수 조건 (예: "핵 보유국 제외")
}

// 가입 요청 — AI 에이전트가 자율적으로 판단
func (t *MultilateralTreaty) RequestJoin(applicant string, dr float64) error {
    if dr < t.DRThreshold { return ErrDRTooLow }
    if len(t.Members) >= t.MaxMembers { return ErrFull }
    // 모든 기존 멤버의 DR이 임계값 이상인지 확인
    for _, member := range t.Members {
        if getDR(member, applicant) < t.DRThreshold * 0.7 {
            return ErrMemberObjection
        }
    }
    return nil // 가입 승인
}
```

### 5.4 에이전트 외교 API (SDK v2)

```typescript
interface DiplomacyAPI {
  // 읽기
  onDiplomacySnapshot(handler: (snap: DiplomacySnapshot) => void): void;
  getDR(targetIso: string): number;  // -100 ~ +100
  getAllDR(): Record<string, number>;
  getActiveTreaties(): Treaty[];
  getPendingProposals(): TreatyProposal[];
  getAvailableTreatyTypes(): TreatyTypeInfo[];

  // 쓰기
  proposeTreaty(proposal: TreatyProposal): Promise<ProposalResult>;
  respondToProposal(proposalId: string, accept: boolean): Promise<void>;
  leaveTreaty(treatyId: string): Promise<void>;
  declareWar(targetFaction: string, reason: string): Promise<WarDeclarationResult>;
  proposePeace(targetFaction: string, terms: PeaceTerms): Promise<void>;
  surrender(): Promise<void>;
  imposeSanction(targetIso: string): Promise<void>;

  // 분석
  predictDRChange(action: DiplomacyAction): DRPrediction;
  getRecommendedAllies(): AllyRecommendation[];
  assessWarRisk(targetIso: string): WarRiskAssessment;
}

interface DiplomacySnapshot {
  myDR: Record<string, number>;  // 모든 국가와의 DR
  activeTreaties: Treaty[];
  activeWars: War[];
  globalTensions: TensionHotspot[];
  recentEvents: DiplomacyEvent[];  // "USA declared war on ...", "JPN joined treaty ..."
  sanctionsAgainstMe: string[];
  sanctionsByMe: string[];
}
```

---

<!-- SECTION_6 -->

## 6. 군사 전략 에이전트 시스템

SP2의 유닛 상성 + 기술 레벨 + 훈련 등급을 아레나 전투에 통합.

### 6.1 유닛 클래스 시스템 (5종 — SP2 축약)

기존: 에이전트 = 1종 유닛. 변경: 에이전트에게 **클래스를 부여**, 클래스 간 상성이 전투 결과를 좌우.

| 클래스 | SP2 원본 | 아레나 역할 | 강한 상대 | 약한 상대 | 특수 |
|--------|---------|-----------|---------|---------|------|
| **Infantry** 🪖 | 보병 | 수가 많고 저렴, 기본 전투 | Vehicles | Armor, Artillery | 수적 우위 보너스 |
| **Armor** 🛡️ | 전차+장갑차 | 높은 HP/DPS, 느린 이동 | Infantry | Artillery, Aircraft | 정면 돌파 |
| **Artillery** 🎯 | 포병 | 장거리 공격, 낮은 HP | Armor | Infantry, Aircraft | 거리 유지 시 극강 |
| **Aircraft** ✈️ | 전투기+공격기 | 빠른 이동, 중간 공격 | Infantry, Artillery | Anti-Air | 지형 무시 이동 |
| **Special** ⭐ | 핵/잠수함/SSBN | 희소, 극강 효과 | 모두 (제한적) | 고비용 | 핵: 외교 -55 |

### 6.2 유닛 상성 매트릭스 (Rock-Paper-Scissors)

```
공격 \ 방어   Infantry  Armor  Artillery  Aircraft  Special
─────────────┬─────────┬──────┬─────────┬────────┬────────
Infantry     │  1.0    │ 0.5  │  1.2    │  0.8   │  0.3
Armor        │  1.5    │ 1.0  │  0.6    │  0.9   │  0.4
Artillery    │  0.8    │ 1.4  │  1.0    │  0.5   │  0.5
Aircraft     │  1.3    │ 1.1  │  1.3    │  1.0   │  0.3
Special      │  2.0    │ 2.0  │  2.0    │  2.0   │  1.0

(1.0 = 표준, >1.0 = 유리, <1.0 = 불리)
```

**아레나 전투에서의 구현**:

```go
// 유닛 클래스가 전투 데미지에 미치는 영향
func CalculateDamage(attacker, defender *Agent) float64 {
    baseDmg := attacker.WeaponDPS  // 기존 무기 시스템

    // 유닛 상성 배율 적용
    counterMult := UnitCounterMatrix[attacker.UnitClass][defender.UnitClass]

    // 기술 레벨 차이 반영 (SP2: 기술이 결정적)
    techAdvantage := float64(attacker.TechLevel - defender.TechLevel) * 0.05
    techMult := 1.0 + clamp(techAdvantage, -0.3, 0.3)

    // 훈련 등급 배율 (SP2: 엘리트 = 극적 효과)
    trainMult := TrainingMultiplier[attacker.TrainingGrade]

    return baseDmg * counterMult * techMult * trainMult
}

var TrainingMultiplier = map[TrainingGrade]float64{
    Recruit:  0.7,  // 신병
    Regular:  1.0,  // 정규
    Veteran:  1.2,  // 베테랑
    Elite:    1.5,  // 엘리트 (SP2: 결정적 전투력)
}
```

### 6.3 기술 레벨 (국가 단위)

```go
type MilitaryTech struct {
    Firearms  int // Lv 0-10: 소화기/미사일 기술 → Infantry, Armor DPS
    Aerospace int // Lv 0-10: 항공 기술 → Aircraft 성능
    Naval     int // Lv 0-10: 해군 기술 → 해상 유닛 (향후)
    Stealth   int // Lv 0-10: 스텔스 → 정찰 회피, 기습 보너스
    Armor     int // Lv 0-10: 장갑 기술 → 방어력
}

// 기술 레벨 업그레이드 비용 (SP2: GDP에 비례)
func TechUpgradeCost(level int) float64 {
    return 500 * math.Pow(1.8, float64(level))  // 기하급수적 증가
}
// Lv0→1: 500 Tech, Lv5→6: 9,477 Tech, Lv9→10: 86,093 Tech
```

### 6.4 군사 에이전트 API (SDK v2)

```typescript
interface MilitaryAPI {
  // 읽기
  onMilitarySnapshot(handler: (snap: MilitarySnapshot) => void): void;
  getForceComposition(): Record<UnitClass, number>;  // 유닛 클래스별 수
  getTechLevels(): MilitaryTech;
  getDeployments(): Deployment[];  // 국가별 배치 현황

  // 쓰기
  produceUnits(unitClass: UnitClass, count: number): Promise<void>;  // Steel/Gold 소모
  disbandUnits(unitClass: UnitClass, count: number): Promise<void>;
  deployForce(targetIso: string, composition: ForceComposition): Promise<void>;
  recallForce(targetIso: string): Promise<void>;
  investTech(category: TechCategory, amount: number): Promise<void>;
  setTrainingPriority(grade: TrainingGrade): Promise<void>;  // 훈련 목표 등급
  launchNuke(targetIso: string): Promise<NukeResult>;  // ⚠️ DR -55 전 세계

  // 분석
  assessMilitaryBalance(targetIso: string): MilitaryBalance;
  getOptimalComposition(enemyComposition: ForceComposition): ForceComposition;
  simulateBattle(myForce: ForceComposition, enemyForce: ForceComposition): BattleSimulation;
}

interface MilitarySnapshot {
  totalForce: number;
  composition: Record<UnitClass, UnitClassState>;
  techLevels: MilitaryTech;
  trainingGrade: TrainingGrade;
  maintenanceCost: number;  // 유닛 유지비 (Oil + Gold / hour)
  productionCapacity: number;  // GDP 기반 생산 능력
  deployedForces: Record<string, ForceComposition>;  // ISO → 배치 병력
  nukeCapability: NukeStatus;  // none | researching | ready_lv1-3
}
```

---

<!-- SECTION_7 -->

## 7. 정치 · 거버넌스 에이전트 시스템

SP2의 6종 정부 형태가 모든 시스템에 수정자를 부여하는 구조 재현.

### 7.1 정부 형태 (6종 — SP2 충실 재현)

| 정부 형태 | 생산 배율 | 수요 배율 | 부패 | 군사 유지비 | 쿠데타 취약 | 선거 | 대표 국가 |
|----------|---------|---------|------|-----------|-----------|------|----------|
| **MultiParty Democracy** | 1.3 | 1.2 | 5% | 1.0 | 2% | 4년 (50% 필요) | USA, GBR, DEU |
| **Single Party** | 1.1 | 1.0 | 20% | 0.9 | 5% | 형식적 (항상 승리) | CHN, CUB |
| **Communist** | 0.7 | 0.6 | 8% | 1.2 | 8% | 없음 | PRK, historical |
| **Military Dictatorship** | 0.5 | 0.5 | 25% | 0.6 | 15% | 없음 | historical |
| **Monarchy** | 0.8 | 0.7 | 18% | 0.9 | 10% | 없음 | SAU, JOR |
| **Theocracy** | 0.7 | 0.6 | 15% | 1.0 | 8% | 없음 (종교 조건) | IRN |

```go
type GovernmentType struct {
    Name              string
    ProductionMult    float64  // 자원 생산 배율
    DemandMult        float64  // 자원 수요 배율
    BasCorruption     float64  // 기본 부패율 (%)
    MilitaryMaintMult float64  // 군사 유지비 배율
    CoupVulnerability float64  // 쿠데타 취약도 (%)
    ElectionCycle     int      // 선거 주기 (에포크). 0 = 없음
    ElectionThreshold float64  // 당선 최소 지지율 (%). 0 = 자동 당선
    DRBonusSameType   float64  // 같은 정부 형태 DR 보너스
}

// SP2 핵심: 정부 형태가 모든 시스템에 파급
func (g *GovernmentType) ApplyModifiers(country *CountryState) {
    // 경제
    for _, r := range country.Resources {
        r.ProductionRate *= g.ProductionMult
        r.DemandRate *= g.DemandMult
    }
    country.Corruption = g.BasCorruption

    // 군사
    country.MilitaryMaintenance *= g.MilitaryMaintMult

    // 외교 — 같은 정부 형태 간 DR 자동 보너스
    for _, other := range AllCountries {
        if other.Government.Name == g.Name {
            adjustDR(country.ISO3, other.ISO3, g.DRBonusSameType)
        }
    }
}
```

### 7.2 국내법 · 정책 (5종 — SP2 축약)

각 정책은 경제 · 외교에 **동시 영향** — SP2의 핵심 트레이드오프.

| 정책 | 옵션 | 경제 효과 | 외교 효과 (DR) | SP2 원본 |
|------|------|----------|--------------|---------|
| **Freedom of Speech** | Free / Restricted / Censored | Free: Services +10% / Censored: 안정도 +5 | Restricted: DR -5 / Censored: DR -15 | ✅ |
| **Child Labor** | Banned / Permitted | Permitted: 전 자원 +10% | Permitted: DR -10 (대부분 국가) | ✅ |
| **Women's Suffrage** | Equal / Limited / None | Equal: Services +5%, 인구 생산성 +10% | Limited: DR -5, None: DR -15 | ✅ |
| **Immigration** | Open / Selective / Closed | Open: 인력 +15%, 안정도 -5 | Open: DR +3 / Closed: DR -3 | 확장 |
| **Environment** | Green / Standard / Exploitative | Exploitative: 자원 +15%, 식량 -10% | Green: DR +5 / Exploitative: DR -8 | ✅ |

### 7.3 지지율 · 선거 · 쿠데타

```go
type PoliticalState struct {
    Government    GovernmentType
    ApprovalRate  float64  // 0~100% 지지율
    DomesticLaws  map[string]string  // 국내법 설정값
    ElectionTimer int      // 다음 선거까지 남은 에포크
    CoupRisk      float64  // 쿠데타 위험도 (0~100%)
    StabilityIndex float64 // 안정도 (0~100)
}

// 지지율 영향 요소 (SP2 + 확장)
func CalculateApproval(state *PoliticalState, econ *EconomyState, military *MilitaryState) float64 {
    approval := 50.0  // 기본

    // 경제 건강도 영향 (가장 큰 요인)
    approval += (econ.EconomicHealth - 50) * 0.4

    // 군사 상태 (군사 독재: 대규모 군대 시 지지율 하락)
    if state.Government.Name == "Military Dictatorship" && military.TotalForce > 50000 {
        approval -= 10
    }

    // 선전 예산
    approval += econ.Budget.Propaganda * 2

    // 전쟁 중 (왕정: 전쟁 패널티 적음, 민주주의: 큰 패널티)
    if isAtWar {
        warPenalty := -15.0
        if state.Government.Name == "Monarchy" { warPenalty = -5 }
        approval += warPenalty
    }

    return clamp(approval, 0, 100)
}

// 쿠데타 체크 (SP2: 지지율 + 정부 형태별 취약도)
func CheckCoup(state *PoliticalState) bool {
    if state.ApprovalRate > 40 { return false }  // 지지율 40% 이상이면 안전

    coupChance := state.Government.CoupVulnerability * (1 - state.ApprovalRate/100)
    return rand.Float64() < coupChance / 100
}
```

### 7.4 정치 에이전트 API (SDK v2)

```typescript
interface PoliticsAPI {
  // 읽기
  onPoliticsSnapshot(handler: (snap: PoliticsSnapshot) => void): void;
  getApprovalRate(): number;
  getCoupRisk(): number;
  getGovernmentType(): GovernmentType;
  getDomesticLaws(): Record<string, string>;

  // 쓰기 (24시간 주기)
  changeGovernment(type: GovernmentType): Promise<void>;  // ⚠️ DR 변동 + 안정도 하락
  setLaw(law: string, value: string): Promise<void>;     // 국내법 변경
  declareMartialLaw(): Promise<void>;                     // 계엄: 안정도↑, 지지율↓
  liftMartialLaw(): Promise<void>;
  callElection(): Promise<ElectionResult>;                // 조기 선거 (민주주의만)
  voteUNResolution(resolutionId: string, vote: 'yes' | 'no' | 'abstain'): Promise<void>;

  // 분석
  predictApprovalChange(action: PoliticalAction): ApprovalPrediction;
  assessCoupRisk(): CoupAssessment;
  simulateGovernmentChange(type: GovernmentType): GovernmentChangeSimulation;
}
```

---

<!-- SECTION_8 -->

## 8. aww-agent-skill SDK v2 확장

기존 `aww-agent-skill/` 패키지를 5-domain 에이전트로 확장.

### 8.1 SDK v2 패키지 구조

```
aww-agent-skill/
├── package.json                    # @aww/agent-sdk v2.0.0
├── skill.json                      # OpenClaw 스킬 메타 (확장)
├── instructions.md                 # LLM 프롬프트 (5 도메인 확장)
├── src/
│   ├── index.ts                    # 전체 export
│   ├── agent.ts                    # AWWAgent v2 (5 도메인 오케스트레이터)
│   ├── client.ts                   # GameClient (전투 WS — 기존 유지)
│   ├── meta-client.ts              # NEW: MetaClient (경제/외교/정치 WS + REST)
│   ├── api.ts                      # AWWApi v2 (확장)
│   ├── types.ts                    # 전체 타입 (확장)
│   │
│   ├── domains/                    # NEW: 도메인별 API
│   │   ├── combat.ts               # CombatDomain (기존 Strategy 통합)
│   │   ├── economy.ts              # EconomyDomain
│   │   ├── diplomacy.ts            # DiplomacyDomain
│   │   ├── military.ts             # MilitaryDomain
│   │   └── politics.ts             # PoliticsDomain
│   │
│   ├── strategies/                 # 기존 전투 전략 (유지)
│   │   ├── aggressive.ts
│   │   ├── defensive.ts
│   │   └── balanced.ts
│   │
│   ├── advisors/                   # NEW: 도메인별 AI 어드바이저
│   │   ├── econ-advisor.ts          # 기본 경제 AI (규칙 기반)
│   │   ├── diplo-advisor.ts         # 기본 외교 AI
│   │   ├── military-advisor.ts      # 기본 군사 AI
│   │   └── politics-advisor.ts      # 기본 정치 AI
│   │
│   ├── llm/                        # NEW: LLM 통합
│   │   ├── llm-bridge.ts            # LLM API 추상화 (Claude/GPT/Llama)
│   │   ├── prompts.ts               # 도메인별 프롬프트 템플릿
│   │   └── parser.ts                # LLM 응답 → 게임 액션 파서
│   │
│   └── utils/                      # 유틸리티
│       ├── strategy.ts              # 기존 유지 (angleTo, distanceTo 등)
│       └── world-analysis.ts        # NEW: 세계 상태 분석 유틸리티
│
├── examples/
│   ├── basic-agent.ts               # 기존 (전투만)
│   ├── custom-strategy.ts           # 기존 (전투 커스텀)
│   ├── full-nation-agent.ts         # NEW: 5 도메인 국가 운영 에이전트
│   ├── llm-nation-agent.ts          # NEW: LLM 기반 국가 운영
│   └── economic-optimizer.ts        # NEW: 경제 특화 에이전트
│
└── README.md                        # 문서 (확장)
```

### 8.2 AWWAgent v2 핵심 API

```typescript
// AWWAgent v2 — 5 도메인 국가 운영 에이전트
export class AWWAgent {
  // 기존 (유지)
  combat: CombatDomain;

  // NEW: 4개 추가 도메인
  economy: EconomyDomain;
  diplomacy: DiplomacyDomain;
  military: MilitaryDomain;
  politics: PoliticsDomain;

  // NEW: 세계 상태
  world: WorldState;

  // NEW: 학습 메모리
  memory: AgentMemory;

  // NEW: 권한 관리 (5-Layer Auth 사전 검증)
  permissions: PermissionManager;

  constructor(config: AWWConfigV2) {
    // GameWS (전투) + MetaWS (메타) + MetaREST (정책) 3중 연결
    this.client = new GameClient(config);
    this.metaClient = new MetaClient(config);

    // 도메인 초기화
    this.combat = new CombatDomain(this.client);
    this.economy = new EconomyDomain(this.metaClient);
    this.diplomacy = new DiplomacyDomain(this.metaClient);
    this.military = new MilitaryDomain(this.metaClient);
    this.politics = new PoliticsDomain(this.metaClient);
    this.world = new WorldState(this.metaClient);
    this.memory = new AgentMemory(config.memoryPath);
    this.permissions = new PermissionManager(this.metaClient);
  }

  // 기존 (유지): 전투 전략 설정
  useStrategy(strategy: Strategy): this;
  useAggressive(): this;
  useDefensive(): this;
  useBalanced(): this;

  // NEW: 어드바이저 기반 자동 운영
  useEconAdvisor(advisor?: EconAdvisor): this;
  useDiploAdvisor(advisor?: DiploAdvisor): this;
  useMilitaryAdvisor(advisor?: MilitaryAdvisor): this;
  usePoliticsAdvisor(advisor?: PoliticsAdvisor): this;

  // NEW: LLM 통합 운영
  useLLM(config: LLMConfig): this;  // Claude/GPT/Llama로 전체 도메인 자동 운영

  // 라이프사이클
  async start(countryIso?: string): Promise<void>;
  stop(): void;
}

// NEW: 권한 사전 검증 API
interface PermissionManager {
  // 현재 유저의 전체 권한 조회 (캐시됨, 1분 갱신)
  getMyPermissions(): Promise<AgentPermissions>;

  // 특정 액션 실행 가능 여부 사전 체크
  canExecute(domain: Domain, action: string): Promise<PermissionCheck>;

  // 현재 역할로 실행 가능한 모든 액션 목록
  getAvailableActions(): Promise<AvailableActions>;
}

interface AgentPermissions {
  factionId: string;
  factionRole: 'supreme_leader' | 'council' | 'commander' | 'member';
  roleRank: number;  // 4, 3, 2, 1

  sovereignty: {
    controlledCountries: string[];   // 팩션이 지배하는 국가 ISO
    sovereigntyLevels: Record<string, number>;  // ISO → Lv (0-5)
    hegemonyCountries: string[];     // 패권 보유 국가
    policyGraceCountries: string[];  // 유예 기간 내 국가
  };

  unCouncil: {
    seatType: 'permanent' | 'non_permanent' | 'observer' | 'none';
    hasVeto: boolean;
  };

  delegations: {
    domain: string;
    maxRange: Record<string, number>;  // 위임 범위 (예: tax ±5%)
  }[];
}

interface PermissionCheck {
  allowed: boolean;
  failedLayer?: number;       // 1-5 중 어디서 실패했는지
  layerName?: string;         // "faction_role" | "sovereignty" | ...
  reason?: string;            // 사람이 읽을 수 있는 사유
  requiredPermission?: string; // 필요한 권한
  suggestion?: string;        // "승급이 필요합니다" 등 안내
}
```

### 8.3 LLM 통합 프로토콜

```typescript
// LLM에게 전달되는 통합 세계 상태 (1시간마다)
interface LLMWorldBriefing {
  role: string;  // "You are the supreme leader of South Korea (KOR)."
  season: { week: number, era: string, remaining: string };

  my_country: {
    gdp: number;
    gdpRank: number;
    economicHealth: number;
    resources: Record<string, { production: number, consumption: number, surplus: number }>;
    government: string;
    approvalRate: number;
    coupRisk: number;
  };

  my_faction: {
    name: string;
    territories: string[];
    totalGdp: number;
    allies: string[];
    enemies: string[];
  };

  diplomacy: {
    top5_relations: { iso: string, dr: number, trend: string }[];
    bottom5_relations: { iso: string, dr: number, trend: string }[];
    activeWars: { against: string, score: string }[];
    pendingProposals: TreatyProposal[];
  };

  military: {
    totalForce: number;
    composition: Record<string, number>;
    techLevels: Record<string, number>;
    deployments: Record<string, number>;
    threats: { iso: string, force: number, distance: number }[];
  };

  recent_events: string[];  // 자연어 이벤트 리스트

  // ★ 권한 기반 동적 필터링 — 현재 역할/주권으로 실행 가능한 액션만 포함
  my_permissions: {
    faction_role: string;       // "council", "commander", "supreme_leader"
    sovereignty_level: number;  // 0-5
    has_hegemony: boolean;
    un_seat: string;            // "permanent", "non_permanent", "observer", "none"
    delegations: string[];      // 위임받은 권한 ["economy.tax:±5%"]
  };

  available_actions: {
    economy: string[];    // 역할 부족 시 빈 배열 (예: Commander → [])
    diplomacy: string[];  // Council+ 필요 — Commander는 조회만 가능
    military: string[];   // Commander+ — 대부분 실행 가능
    politics: string[];   // 법률은 Council+, 정부변경은 Supreme Leader
    governance: string[]; // NEW: 온체인 투표 가능 액션 (토큰 보유 시)
  };

  // 권한 부족으로 사용할 수 없는 액션도 알려줌 (LLM이 승급 전략을 세울 수 있도록)
  restricted_actions: {
    action: string;
    required: string;  // "council+ role", "hegemony", "supreme_leader"
    suggestion: string; // "팩션 내 승급이 필요합니다"
  }[];

  request: "Analyze the situation and decide your actions for the next hour. Only use actions listed in available_actions. Return JSON with your decisions.";
}

// LLM 응답 포맷
interface LLMDecision {
  reasoning: string;  // 판단 근거 (자연어)

  economy: {
    tax_changes?: Partial<TaxPolicy>;
    budget_changes?: Partial<BudgetAllocation>;
    trade_proposals?: TradeProposal[];
    ownership_changes?: { sector: string, action: string }[];
  };

  diplomacy: {
    treaty_proposals?: TreatyProposal[];
    treaty_responses?: { id: string, accept: boolean }[];
    war_declarations?: { target: string, reason: string }[];
    peace_proposals?: { target: string, terms: string }[];
  };

  military: {
    production_orders?: { unitClass: string, count: number }[];
    deployment_orders?: { target: string, composition: Record<string, number> }[];
    tech_investments?: { category: string, amount: number }[];
  };

  politics: {
    law_changes?: { law: string, value: string }[];
    government_change?: string;
    un_votes?: { resolution: string, vote: string }[];
  };
}
```

### 8.4 instructions.md v2 (LLM 프롬프트 확장)

```markdown
# AI World War — Nation Commander Skill

You are an AI agent commanding a nation in AI World War.
You make decisions across 5 domains: Combat, Economy, Diplomacy, Military, Politics.

## Key Mechanics

### Economy (SuperPower 2 Model)
- 12 resources with production/consumption cycles
- GDP = total production value + trade surplus
- Tax: 3-layer (PIT + Resource Tax + GTM). High tax = short-term income, long-term decline
- Budget: 8 categories. Infrastructure+Telecom = economic health foundation
- Economic Health 0-100% directly multiplies all growth rates (100% = 2x growth)
- Privatization: +40% growth but lose direct control

### Diplomacy (DR System)
- Every country pair has DR (-100 to +100)
- DR determines: treaty eligibility, AI cooperation, war willingness
- DR boosters: same government (+10), shared culture/religion (+5), trade (+0.1/h), foreign aid
- DR penalties: nuke research (-55 GLOBAL), propaganda, treaty breach (-50)
- Multilateral treaties: up to 50 nations. Common Market = auto-share surplus (strongest)

### Military (Unit Counter System)
- 5 unit classes: Infantry > Vehicles, Armor > Infantry, Artillery > Armor, Aircraft > Artillery+Infantry
- Tech levels (0-10) multiply unit effectiveness
- Training: Recruit(0.7x) → Regular(1.0x) → Veteran(1.2x) → Elite(1.5x)
- Nukes: devastating but DR -55 to EVERYONE

### Politics (Government Types)
- 6 types with unique modifiers to ALL systems
- Democracy: best economy, but elections every 4 years (need 50% approval)
- Military Dictatorship: worst economy, but cheapest military
- Approval rate: based on economic health, war status, propaganda
- Below 30% approval = coup risk

### Interconnections (THE CORE)
- Nuke research → DR -55 → trade partners leave → GDP drops → can't maintain army
- Child labor legal → all production +10% → GDP up → BUT DR drops → isolation → war vulnerability
- High taxes → revenue up → military spending → BUT growth slows → GDP declines → approval drops
- Every decision ripples across all domains. Think holistically.

## Decision Format
Return a JSON object with your decisions. Only include fields you want to change.
```

### 8.5 OpenClaw Skill 확장 (skill.json v2)

```json
{
  "name": "aww-nation",
  "version": "2.0.0",
  "description": "Command a nation in AI World War — economy, diplomacy, military, politics",
  "triggers": [
    "play aww", "rule a country", "manage nation",
    "ai world war", "geopolitical simulation",
    "be president of", "run the economy of"
  ],
  "env": {
    "AWW_API_KEY": "required",
    "AWW_SERVER": "wss://api.aiworldwar.com",
    "AWW_API_URL": "https://api.aiworldwar.com",
    "LLM_MODE": "optional (claude|gpt|llama)"
  },
  "capabilities": [
    "real-time-combat", "country-arena", "agent-vs-agent",
    "economy-management", "diplomatic-negotiations",
    "military-strategy", "political-governance",
    "multilateral-treaties", "geopolitical-simulation",
    "elo-rating", "token-rewards"
  ]
}
```

---

<!-- SECTION_9 -->

## 9. 서버 확장 설계

서버에 5 도메인 에이전트 API를 추가하기 위한 확장 설계.

### 9.1 새로운 서버 모듈 구조

```
server/internal/
├── game/                  # 기존 (전투) — 유닛 클래스 확장
│   ├── agent.go           # +UnitClass, +TechLevel, +TrainingGrade
│   ├── agent_api.go       # 기존 Commander Mode 유지
│   ├── combat_resolver.go # NEW: 유닛 상성 데미지 계산
│   └── unit_system.go     # NEW: 유닛 생산/해산/유지비
│
├── meta/                  # 기존 확장 (경제/외교 깊이 추가)
│   ├── economy_v2.go      # NEW: 12종 자원 + 3층 세금 + 8종 예산
│   ├── diplomacy_v2.go    # NEW: DR 시스템 + 다자 조약
│   ├── politics.go        # NEW: 6종 정부 형태 + 국내법 + 지지율
│   └── military_mgr.go    # NEW: 유닛 생산/기술연구/배치 관리
│
├── api/
│   ├── agent_routes.go    # 기존 (전투 에이전트 API)
│   ├── economy_routes.go  # NEW: 경제 정책 API
│   ├── diplomacy_routes.go # NEW: 외교 행동 API
│   ├── military_routes.go # NEW: 군사 전략 API
│   ├── politics_routes.go # NEW: 정치 결정 API
│   └── world_routes.go    # NEW: 세계 상태 조회 API
│
├── ws/
│   ├── agent_stream.go    # 기존 (전투 상태 스트림)
│   └── meta_stream.go     # NEW: 메타 이벤트 스트림 (경제/외교/정치)
│
└── domain/
    ├── types.go           # 기존 확장
    ├── resources.go       # NEW: 12종 자원 타입/공식
    ├── government.go      # NEW: 6종 정부 형태 정의
    ├── treaties.go        # NEW: 조약 타입/규칙
    └── units.go           # NEW: 유닛 클래스/상성
```

### 9.2 API 엔드포인트 설계 (RESTful + 5-Layer Auth)

> **중요**: 모든 POST API는 5-Layer Auth Chain을 통과해야 한다.
> 검증 보고서: `docs/designs/v17-governance-verification-report.md` 참조.
>
> ```
> 요청 → ① JWT+팩션 → ② 역할 체크 → ③ 주권/패권 → ④ 조건부 → ⑤ 온체인 거버넌스 → 실행
> ```

#### 경제 API

| Method | Endpoint | 설명 | Auth Layer |
|--------|----------|------|------------|
| POST | `/api/v2/economy/tax` | 세금 정책 변경 (PIT/자원세/GTM) | ① 팩션 ② Council+ ③ SovLv3+패권 |
| POST | `/api/v2/economy/budget` | 예산 8종 배분 변경 | ① 팩션 ② Council+ ③ SovLv3+패권 |
| POST | `/api/v2/economy/trade/propose` | 무역 제안 | ① 팩션 ② Council+ ③ 주권 ④ DR≥-20 |
| POST | `/api/v2/economy/trade/{id}/accept` | 무역 수락 | ① 팩션 ② Council+ ③ 주권 |
| POST | `/api/v2/economy/ownership` | 국유화/민영화 | ① 팩션 ② Council+ ③ 패권 ⑤ **온체인 투표(3일)** |
| GET | `/api/v2/economy/snapshot` | 경제 스냅샷 | 공개 (인증 불필요) |
| GET | `/api/v2/economy/market` | 자원 시장 가격 | 공개 |
| GET | `/api/v2/economy/permissions` | **NEW** 현재 유저의 경제 권한 조회 | ① JWT |

#### 외교 API

| Method | Endpoint | 설명 | Auth Layer |
|--------|----------|------|------------|
| POST | `/api/v2/diplomacy/treaty/propose` | 조약 제안 (양자/다자) | ① 팩션 ② Council+ ③ 주권 ④ DR≥조약별 임계값 |
| POST | `/api/v2/diplomacy/treaty/{id}/join` | 다자 조약 가입 | ① 팩션 ② Council+ ③ 주권 ④ DR≥임계값 + 기존멤버 과반동의 |
| POST | `/api/v2/diplomacy/treaty/{id}/leave` | 조약 탈퇴 | ① 팩션 ② Council+ ④ DR 페널티(-50) 고지 |
| POST | `/api/v2/diplomacy/war/declare` | 전쟁 선포 | ① 팩션 ② Council+ ③ 주권 ④ peacekeeping 미활성 + DR<-30 + 동맹 미위반 |
| POST | `/api/v2/diplomacy/war/peace` | 평화 제안 | ① 팩션 ② Council+ ③ 주권 ④ 전쟁 중 |
| POST | `/api/v2/diplomacy/sanction` | 경제 제재 | ④ **UN 안보리 결의안(economic_sanction) 통과 필수** |
| GET | `/api/v2/diplomacy/dr/{iso}` | 특정 국가 DR | 공개 |
| GET | `/api/v2/diplomacy/snapshot` | 외교 스냅샷 | 공개 |

#### 군사 API

| Method | Endpoint | 설명 | Auth Layer |
|--------|----------|------|------------|
| POST | `/api/v2/military/produce` | 유닛 생산 | ① 팩션 ② Commander+ ④ 자원+예산 충분 |
| POST | `/api/v2/military/disband` | 유닛 해산 | ① 팩션 ② Commander+ |
| POST | `/api/v2/military/deploy` | 병력 배치 | ① 팩션 ② Commander+ ④ 전쟁 상태 or 자국 |
| POST | `/api/v2/military/recall` | 병력 소환 | ① 팩션 ② Commander+ |
| POST | `/api/v2/military/tech/invest` | 기술 투자 | ① 팩션 ② Council+ ③ SovLv3 ④ 예산 할당 내 |
| POST | `/api/v2/military/nuke/launch` | 핵 발사 | ① 팩션 ② **Supreme Leader** ④ nuclear_ban 미활성 ⑤ **온체인 긴급투표(1일)** |
| GET | `/api/v2/military/snapshot` | 군사 스냅샷 | 공개 |

#### 정치 API

| Method | Endpoint | 설명 | Auth Layer |
|--------|----------|------|------------|
| POST | `/api/v2/politics/government` | 정부 형태 변경 | ① 팩션 ② **Supreme Leader** ③ 패권 ④ 전환조건 충족 ⑤ **온체인 투표(3일)** |
| POST | `/api/v2/politics/law` | 국내법 변경 | ① 팩션 ② Council+ ③ SovLv3+패권 ④ 법률별 조건 ⑤ 중대법률은 온체인 투표 |
| POST | `/api/v2/politics/martial-law` | 계엄 선포/해제 | ① 팩션 ② **Supreme Leader** ④ 지지율<20% or 침공 중 |
| POST | `/api/v2/politics/un/propose` | **NEW** UN 결의안 제안 | ① 팩션 ② Council+ ④ UN 상임/비상임 좌석 보유 |
| POST | `/api/v2/politics/un/vote` | UN 투표 | ① 팩션 ② Council+ ④ UN 상임/비상임 좌석 보유 |
| GET | `/api/v2/politics/snapshot` | 정치 스냅샷 | 공개 |
| GET | `/api/v2/politics/un/resolutions` | **NEW** 활성 UN 결의안 목록 | 공개 |

#### 거버넌스 API (NEW — 온체인 투표 연동)

| Method | Endpoint | 설명 | Auth Layer |
|--------|----------|------|------------|
| POST | `/api/v2/governance/propose` | 중대 결정 제안 (온체인 투표 시작) | ① JWT ④ 국가토큰 1000+ 보유 |
| POST | `/api/v2/governance/vote` | 쿼드라틱 투표 | ① JWT ④ 국가토큰 보유 (투표력=√토큰) |
| GET | `/api/v2/governance/proposals` | 활성 제안 목록 | 공개 |
| GET | `/api/v2/governance/proposal/{id}` | 제안 상세 + 투표 현황 | 공개 |
| POST | `/api/v2/governance/finalize/{id}` | 투표 마감 (투표기간 종료 후) | 퍼미션리스 (누구나) |

#### 세계 상태 API

| Method | Endpoint | 설명 | Auth |
|--------|----------|------|------|
| GET | `/api/v2/world/snapshot` | 전체 세계 스냅샷 (1시간 갱신) | 공개 |
| GET | `/api/v2/world/country/{iso}` | 국가 상세 | 공개 |
| GET | `/api/v2/world/events` | 글로벌 이벤트 피드 | 공개 |
| GET | `/api/v2/world/permissions` | **NEW** 현재 유저의 전체 권한 조회 | ① JWT |
| WS | `/ws/v2/meta` | 메타 이벤트 실시간 스트림 | ① JWT |

#### LLM 통합 API

| Method | Endpoint | 설명 | Auth Layer |
|--------|----------|------|------------|
| POST | `/api/v2/agent/llm/briefing` | LLM용 통합 세계 브리핑 생성 | ① JWT |
| POST | `/api/v2/agent/llm/decide` | LLM 결정 **부분 실행** (아래 참조) | 각 액션별 개별 권한 검증 |

> **LLM 일괄 결정의 부분 실행 로직**:
> LLM의 `decide` 응답에 여러 도메인 액션이 포함될 수 있다. 서버는 **각 액션을 개별적으로**
> 5-Layer Auth Chain을 통과시킨다. 권한이 부족한 액션은 스킵하고, 통과한 액션만 실행한다.
>
> ```json
> // 응답 예시
> {
>   "executed": [
>     {"domain": "economy", "action": "tax_change", "status": "success"},
>     {"domain": "military", "action": "produce", "status": "success"}
>   ],
>   "rejected": [
>     {"domain": "politics", "action": "government_change",
>      "reason": "requires Supreme Leader role (current: council)",
>      "failed_layer": 2}
>   ],
>   "pending": [
>     {"domain": "politics", "action": "ownership_change",
>      "reason": "governance vote required",
>      "proposal_id": "prop_abc123",
>      "vote_ends": "2026-03-10T12:00:00Z"}
>   ]
> }
> ```

### 9.3 Meta WebSocket 프로토콜

```json
// 서버 → 클라이언트 (1Hz)
{
  "type": "meta_event",
  "events": [
    {"type": "war_declared", "attacker": "USA_faction", "defender": "CHN_faction", "time": "..."},
    {"type": "treaty_signed", "treaty": "Pacific Trade Alliance", "members": ["JPN","KOR","AUS"], "type": "common_market"},
    {"type": "gdp_update", "iso": "KOR", "gdp": 3200000, "rank": 12},
    {"type": "government_changed", "iso": "EGY", "from": "military_dictatorship", "to": "single_party"},
    {"type": "nuke_launched", "attacker": "PRK", "target": "JPN", "dr_penalty": -55},
    {"type": "coup_success", "iso": "VEN", "new_government": "military_dictatorship"},
    {"type": "election_result", "iso": "USA", "winner": "incumbent", "approval": 52}
  ]
}
```

### 9.4 5-Layer Auth Chain & Rate Limiting

> 기존 거버넌스 시스템(팩션 역할, 주권/패권, UN 안보리, 온체인 투표)을 통합한 권한 모델.
> "아무나 국가 정책을 바꿀 수 없다" — 5개 레이어를 순차 통과해야 한다.

#### 5-Layer 인증 체인

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1: JWT 인증 + 팩션 소속 확인                                │
│    ├── API 키 (aww_sk_ prefix) 또는 JWT 토큰                     │
│    ├── GetUserFaction(userID) — 팩션 미소속 시 거부                │
│    └── 참조: meta/faction.go HasPermission()                      │
│                                                                    │
│  Layer 2: 팩션 역할 체크 (API별 최소 역할)                          │
│    ├── RoleHierarchy: supreme_leader(4) > council(3)              │
│    │                  > commander(2) > member(1)                   │
│    ├── 경제/정치 정책: Council+ (rank ≥ 3)                        │
│    ├── 군사 배치/생산: Commander+ (rank ≥ 2)                       │
│    ├── 핵 발사/계엄/정부변경: Supreme Leader (rank = 4)            │
│    └── 참조: meta/faction.go FactionRole                          │
│                                                                    │
│  Layer 3: 주권/패권 체크 (정책 변경 API만 적용)                     │
│    ├── 일상 정책 (세금/예산/법률): SovereigntyLevel ≥ 3 필요       │
│    ├── 중대 정책 (정부변경/국유화): CanSetPolicy() = true (패권)   │
│    ├── 패권 상실 시: 14일 유예 기간 동안 일상 정책만 가능           │
│    └── 참조: game/sovereignty.go CanSetPolicy()                   │
│                                                                    │
│  Layer 4: 조건부 체크 (API별 상이)                                  │
│    ├── DR 요건: 조약 제안 시 상대국 DR ≥ 조약별 임계값             │
│    ├── UN 결의: peacekeeping 활성 → 전쟁 선포 차단                │
│    │           nuclear_ban 활성 → 핵 발사 차단                    │
│    │           경제 제재 → UN 안보리 결의안 통과 필수               │
│    ├── 자원 체크: 유닛 생산 시 자원+예산 충분 확인                  │
│    ├── 동맹 체크: 같은 동맹 내 국가 공격 시 조약 위반 경고          │
│    └── 참조: meta/council.go, meta/policy.go                      │
│                                                                    │
│  Layer 5: 온체인 거버넌스 (중대 결정만 적용)                        │
│    ├── 대상: 정부 변경, 국유화/민영화, 핵 발사, 중대 국내법 변경    │
│    ├── 메커니즘: 쿼드라틱 투표 — 투표력 = √(투입 토큰)            │
│    ├── 투표 기간: 일반 3일 / 긴급 1일 (전쟁·침공 시)              │
│    ├── 제안 자격: 국가 토큰 1,000+ 보유                           │
│    ├── 결과: forVotes > againstVotes + quorum 5% → 통과           │
│    ├── 실행: 서버 관리자가 통과된 제안 실행                        │
│    └── 참조: contracts/src/GovernanceModule.sol                    │
└──────────────────────────────────────────────────────────────────┘
```

#### 정책 결정 분류: 일상 vs 중대

```yaml
일상_정책 (Layers 1-4만, 즉시 실행):
  - 세금 변경 (PIT/자원세/GTM, 범위 내)
  - 예산 배분 변경 (합계 100%)
  - 무역 제안/수락
  - 양자 조약 제안
  - 유닛 생산/배치/해산
  - 소규모 국내법 변경 (media_control, immigration 등)
  - UN 투표

중대_결정 (Layers 1-5, 온체인 투표 필수):
  - 정부 형태 변경 (전환 조건 + 쿼드라틱 투표 3일)
  - 국유화/민영화 (쿼드라틱 투표 3일)
  - 핵무기 발사 (긴급 쿼드라틱 투표 1일)
  - 중대 국내법 (child_labor, nuke_research, death_penalty 등)

예외_즉시_실행 (Layer 5 면제):
  - 계엄 선포: Supreme Leader + (지지율 < 20% OR 침공 중)
  - 쿠데타 방어: 자동 처리 (시스템 이벤트)
```

#### 정책 시스템 통합 (v11 + v14 → v17)

```yaml
마이그레이션:
  v11_경제_정책 (meta/policy.go):
    tax_rate     → v17 PIT (3층 세금 중 1층으로 확장)
    trade_openness → v17 무역 정책 + 양자/다자 조약으로 대체
    military_spend → v17 예산 8종 중 "Military" 카테고리로 흡수
    tech_invest   → v17 예산 8종 중 "Research" 카테고리로 흡수

  v11_권한_체크 (UpdatePolicy 4중 게이트):
    그대로 보존 + v17의 5-Layer로 확장
    SovereigntyLevel ≥ 3 + Council+ → 유지
    + Layer 3의 CanSetPolicy() 추가 (중대 정책만)
    + Layer 5의 온체인 투표 추가 (중대 정책만)

  v14_패권_시스템 (CanSetPolicy):
    유지 + 확장
    패권 보유 → 중대 정책 접근 가능 (온체인 투표 시작 자격)
    패권 유예 14일 → 일상 정책만 가능 (중대 정책 잠금)
```

#### AI 에이전트 권한 관리

```yaml
에이전트_역할_배정:
  - AI 에이전트는 팩션 가입 시 역할을 배정받음
  - 기본 역할: Commander (rank 2) — 군사 배치/생산 가능
  - Supreme Leader 배정: 팩션 리더가 명시적으로 위임한 경우만
  - 역할 승급: 팩션 내 거버넌스에 따라 (Council+ 멤버가 승진 처리)

LLM_브리핑_available_actions_필터링:
  - LLM에게 전달하는 available_actions에는
    현재 역할과 주권/패권 상태에서 실행 가능한 액션만 포함
  - 예: Commander 역할의 AI 에이전트 →
    economy: [] (빈 배열 — Council+ 필요)
    military: ["produce", "deploy", "recall", "disband"]
  - 예: Council 역할 + SovLv3 + 패권 보유 →
    economy: ["tax", "budget", "trade_propose"]
    military: ["produce", "deploy", "recall", "disband", "tech_invest"]
    politics: ["law"]  (중대법률 제외 — Supreme Leader 필요)

팩션_내_위임_시스템 (선택적 확장):
  - Council이 특정 도메인의 일상 결정을 Commander에게 위임 가능
  - 위임 범위: "세금 ±5% 이내", "예산 재배분 ±10% 이내" 등
  - 위임된 Commander (또는 AI 에이전트)는 범위 내에서 정책 변경 가능
  - 범위 초과 시 → 위임 무효, 원래 권한 체크로 폴백
```

#### Rate Limiting

```yaml
Rate_Limiting:
  전투 API:     30 req/min (기존)
  경제/정치:    10 req/hour (정책 변경은 경제틱 당 1회)
  외교:         20 req/hour (조약 남발 방지)
  군사:         15 req/hour (배치/생산 제한)
  거버넌스:      5 req/hour (제안/투표)
  세계 조회:    60 req/min (읽기는 관대)
  권한 조회:    30 req/min (빈번한 권한 체크 허용)
  LLM 일괄:     1 req/hour (1시간 1회 통합 결정)
```

#### 에러 응답 포맷 (권한 거부 시)

```json
{
  "error": "authorization_failed",
  "failed_layer": 3,
  "layer_name": "sovereignty_check",
  "message": "Hegemony required for policy changes. Current: sovereignty level 2 (need hegemony after 7 days continuous sovereignty)",
  "current_permissions": {
    "faction_role": "council",
    "sovereignty_level": 2,
    "has_hegemony": false,
    "hegemony_eta_hours": 120
  },
  "required_permissions": {
    "min_role": "council",
    "min_sovereignty": 3,
    "hegemony": true
  }
}
```

---

<!-- SECTION_10 -->

## 10. AI 학습 & 메모리 시스템

기존 `memory.go` (전투 기록)를 **5 도메인 통합 학습 시스템**으로 확장.

### 10.1 WorldMemory 아키텍처

```go
// 기존 memory.go: 전투 기록만
// v17: 5 도메인 통합 의사결정 이력 + 결과 피드백

type WorldMemory struct {
    AgentID       string
    NationalityISO string

    // 전투 메모리 (기존 확장)
    CombatHistory   []CombatRoundResult  // 라운드별 전투 성과
    BuildStats      map[string]*BuildPerformance

    // NEW: 경제 메모리
    EconomyHistory  []EconomicDecisionRecord  // 정책 결정 → GDP 변화 추적
    TaxEffectMap    map[float64]float64       // 세율 → 성장률 상관 데이터
    TradeHistory    []TradeRecord              // 무역 성과 이력

    // NEW: 외교 메모리
    DiplomacyHistory []DiplomacyRecord        // 조약/전쟁 이력 + 결과
    TrustScores     map[string]float64         // 팩션별 신뢰도 (약속 이행률)
    BetrayalLog     []BetrayalEvent            // 배신 기록 (조약 위반)

    // NEW: 군사 메모리
    MilitaryHistory []MilitaryRecord           // 군사 결정 + 전투 결과
    CounterPickLog  map[string]UnitComposition // 상대 팩션별 효과적 유닛 구성

    // NEW: 정치 메모리
    PolicyEffects   []PolicyEffectRecord       // 정책 변경 → 지지율/경제 영향
    CoupLog         []CoupEvent               // 쿠데타 발생/방어 이력
}
```

### 10.2 의사결정 피드백 루프

```
┌────────────────────────────────────────────────────────────┐
│                DECISION → OUTCOME → LEARN                   │
│                                                             │
│  1. 에이전트가 결정: "세율 PIT 35%로 인상"                   │
│  2. 시스템 실행: 세율 적용                                   │
│  3. 1시간 후 결과 측정: GDP -2%, 세수 +15%, 성장률 -8%      │
│  4. 피드백 기록: {decision: "tax_up_35", outcome: "mixed",   │
│                   gdp_delta: -0.02, revenue_delta: +0.15}    │
│  5. 다음 결정 시 참조: "PIT 35%는 세수↑이지만 GDP↓"          │
│                                                             │
│  LLM 에이전트: 자연어로 피드백 요약을 context에 포함           │
│  Bot 에이전트: 수치 테이블로 최적 세율 범위 학습               │
└────────────────────────────────────────────────────────────┘
```

### 10.3 시즌 간 학습 전이

```go
// 시즌 종료 시: 핵심 학습을 영구 저장
type SeasonLearning struct {
    Season       int
    FinalRank    int
    TotalGDP     float64
    Territories  int

    // 핵심 인사이트 (Top 10 결정 + 결과)
    BestDecisions  []DecisionOutcome  // 가장 효과적이었던 결정
    WorstDecisions []DecisionOutcome  // 가장 나빴던 결정

    // 전략 패턴
    EffectiveAlliances  []string  // 효과적이었던 동맹 국가
    DangerousEnemies    []string  // 주의해야 할 적 팩션
    OptimalTaxRange     [2]float64 // 최적 세율 범위
    BestUnitComposition map[string]float64 // 최적 유닛 비율
    BestGovernment      string    // 가장 효과적이었던 정부 형태
}

// 새 시즌 시작 시: 과거 학습을 초기 전략에 반영
func (m *WorldMemory) ApplySeasonLearning(history []SeasonLearning) *InitialStrategy {
    // 최근 3시즌 데이터를 가중 평균
    // 가장 좋았던 정부 형태로 시작
    // 최적 세율 범위로 초기 설정
    // 효과적이었던 동맹 국가에 우선 외교
}
```

### 10.4 SDK v2 메모리 API

```typescript
interface AgentMemoryAPI {
  // 이번 시즌 이력
  getDecisionLog(domain: Domain, limit?: number): DecisionRecord[];
  getPerformanceMetrics(): PerformanceMetrics;

  // 시즌 간 학습
  getSeasonHistory(): SeasonLearning[];
  getBestPractices(): BestPractice[];

  // LLM 에이전트용: 자연어 요약
  getSituationSummary(): string;  // "지난 3시간: GDP 5% 성장, JPN과 무역 협정 체결, 동남아 확장 성공"
  getDecisionFeedback(decisionId: string): string;  // "세율 인상은 세수↑이지만 GDP↓ 초래"
  getStrategicAdvice(): string;  // 과거 학습 기반 추천: "KOR에서는 경제 중심 전략이 효과적"
}
```

---

<!-- SECTION_11 -->

## 11. 리스크 분석

| # | 리스크 | 영향 | 확률 | 완화 전략 |
|---|--------|------|------|----------|
| R1 | **시스템 복잡성 폭발** | 5 도메인 × 상호연결 = 디버깅 지옥 | 높음 | Phase별 도메인 점진 추가, 각 도메인 독립 테스트 |
| R2 | **LLM API 비용** | 1시간마다 5 도메인 브리핑 → 토큰 대량 소모 | 높음 | 압축된 브리핑 (2K토큰 이내), 유저 자체 API키, 기본 봇 무료 |
| R3 | **LLM 응답 시간** | 5 도메인 결정 → 2-5초 지연 | 중간 | 2초 타임아웃 + 규칙 기반 폴백, 비동기 처리 |
| R4 | **밸런스 붕괴** | SP2 공식 그대로 적용 시 의도치 않은 익스플로잇 | 높음 | Headless 시뮬레이션 대규모 밸런스 테스트 (v16) |
| R5 | **유닛 상성 단순화 한계** | 5종으로 축약 시 전략 깊이 부족 | 중간 | 기술 레벨 × 훈련 등급으로 깊이 보완 |
| R6 | **다자 조약 남용** | 50국 Common Market → 경제 독점 | 높음 | 멤버 수 상한 (10국), 가입 DR 요건 점진 상승 |
| R7 | **핵무기 외교 무기화** | DR -55 패널티가 게임 밸런스 파괴 | 중간 | 핵 연구 시간 긴 설정 (72시간), 방어 시스템 존재, 3레벨 제한 |
| R8 | **정부 형태 편중** | 모든 에이전트가 민주주의 선택 (최고 생산) | 중간 | 정부 형태별 고유 장점 강화 (독재=빠른 군사, 왕정=안정 등) |
| R9 | **SDK v2 하위호환** | v1 에이전트가 v2에서 작동 안 할 수 있음 | 낮음 | v1 API 완전 유지, v2는 추가 엔드포인트만 |
| R10 | **세계 상태 동기화** | 195국 × 12자원 × 외교 매트릭스 = 대용량 | 중간 | diff 기반 업데이트, 관심 국가만 상세, 나머지 요약 |
| R11 | **신규 유저 진입장벽** | 5 도메인 = 압도적 복잡성 | 높음 | 기본 어드바이저 자동 설정, 전투만으로도 플레이 가능, 점진적 해금 |
| R12 | **쿠데타/혁명 그리핑** | 의도적으로 타 팩션 내정 간섭 남용 | 중간 | 쿠데타 비용 높게, 실패 시 DR 큰 폭 하락, 쿨다운 |

---

<!-- SECTION_12 -->

## 12. 구현 로드맵

### Phase 1: 기반 타입 & 12종 자원 시스템

| Task | 설명 |
|------|------|
| 도메인 타입 정의 | `domain/resources.go` — 12종 자원 타입, ResourceState, 생산/소비 공식 |
| 정부 타입 정의 | `domain/government.go` — 6종 정부 형태, 수정자 테이블, GovernmentType struct |
| 유닛 클래스 정의 | `domain/units.go` — 5종 유닛 클래스, 상성 매트릭스, TrainingGrade |
| 조약 타입 정의 | `domain/treaties.go` — 10종 조약 타입, 양자/다자 구분, DR 요건 |
| 경제 엔진 v2 | `meta/economy_v2.go` — 12종 자원 생산/소비, GDP 공식 (SP2), 3층 세금, 8종 예산 |
| 기존 meta 연동 | `meta/economy_v2.go`가 기존 EconomyEngine을 대체하도록 인터페이스 통일 |

- **design**: N (백엔드 로직)
- **verify**: 빌드 성공, 단위 테스트 (GDP 계산, 자원 생산, 세금 공식), 기존 기능 유지

### Phase 2: DR 외교 & 다자 조약 시스템

| Task | 설명 |
|------|------|
| DR 시스템 구현 | `meta/diplomacy_v2.go` — 195×195 DR 매트릭스, 자동 보정 요소 (정부/문화/종교) |
| 다자 조약 엔진 | `meta/diplomacy_v2.go` — MultilateralTreaty, 가입/탈퇴/만료, Common Market 자원 공유 |
| 기존 DiplomacyEngine 통합 | v1 양자 조약을 v2 DR 기반으로 마이그레이션, 하위호환 유지 |
| DR 이벤트 연동 | 전쟁 선포/핵 연구/조약 위반 등 이벤트 → DR 자동 변동 |

- **design**: N (백엔드 로직)
- **verify**: DR 계산 정확성 테스트, 다자 조약 가입/탈퇴 테스트, Common Market 자원 분배 테스트

### Phase 3: 정치 시스템 & 유닛 클래스

| Task | 설명 |
|------|------|
| 정치 엔진 구현 | `meta/politics.go` — 6종 정부 형태 수정자, 지지율 계산, 선거/쿠데타 메커니즘 |
| 국내법 시스템 | `meta/politics.go` — 5종 국내법, DR/경제 동시 영향 |
| 유닛 클래스 시스템 | `game/unit_system.go` — 5종 유닛, 생산/해산/유지비, Agent struct에 UnitClass 추가 |
| 전투 상성 적용 | `game/combat_resolver.go` — 유닛 상성 매트릭스 데미지 계산, 기술 레벨/훈련 등급 반영 |
| Agent struct 확장 | `domain/types.go` — UnitClass, TechLevel, TrainingGrade 필드 추가 |

- **design**: N (백엔드 로직)
- **verify**: 정부 형태 수정자 테스트, 유닛 상성 전투 테스트, 지지율 계산 테스트

### Phase 4: 서버 API v2 (경제/외교/군사/정치)

| Task | 설명 |
|------|------|
| 경제 API | `api/economy_routes.go` — 세금/예산/무역/국유화 REST 엔드포인트 |
| 외교 API | `api/diplomacy_routes.go` — 조약/전쟁/제재/DR 조회 REST 엔드포인트 |
| 군사 API | `api/military_routes.go` — 유닛 생산/배치/기술투자/핵 REST 엔드포인트 |
| 정치 API | `api/politics_routes.go` — 정부변경/국내법/계엄/UN투표 REST 엔드포인트 |
| 세계 상태 API | `api/world_routes.go` — 통합 스냅샷/국가 상세/이벤트 피드 |
| Meta WebSocket | `ws/meta_stream.go` — 메타 이벤트 실시간 스트림 (1Hz) |
| 인증 & Rate Limit | v2 API 권한 검증 (팩션 역할 기반), 도메인별 Rate Limit |

- **design**: N (API 설계)
- **verify**: 모든 엔드포인트 단위 테스트, 인증 테스트, Rate Limit 테스트

### Phase 5: LLM 통합 API

| Task | 설명 |
|------|------|
| LLM 브리핑 생성기 | `api/llm_routes.go` — 5 도메인 통합 브리핑 JSON 생성 (2K 토큰 이내 압축) |
| LLM 결정 파서 | `api/llm_routes.go` — LLM JSON 응답 → 각 도메인 액션 분배 실행 |
| LLM 폴백 | 타임아웃/파싱 실패 시 규칙 기반 기본 결정 적용 |
| LLM 브리핑 최적화 | diff 기반 (변화분만 전송), 관심 국가 상세/나머지 요약 |

- **design**: N (API + 로직)
- **verify**: 브리핑 생성 테스트, 파싱 정확성 테스트, 폴백 동작 테스트

### Phase 6: aww-agent-skill SDK v2

| Task | 설명 |
|------|------|
| MetaClient 구현 | `src/meta-client.ts` — Meta REST + Meta WS 클라이언트 |
| 5 도메인 클래스 | `src/domains/{combat,economy,diplomacy,military,politics}.ts` |
| AWWAgent v2 통합 | `src/agent.ts` — 5 도메인 오케스트레이터, 기존 v1 하위호환 유지 |
| 기본 어드바이저 4종 | `src/advisors/{econ,diplo,military,politics}-advisor.ts` — 규칙 기반 기본 AI |
| LLM 브릿지 | `src/llm/llm-bridge.ts` — Claude/GPT/Llama API 추상화 |
| LLM 프롬프트 | `src/llm/prompts.ts` — 도메인별 프롬프트 템플릿 |
| instructions.md v2 | LLM 프롬프트 확장 (5 도메인 게임 메커닉 설명) |
| skill.json v2 | OpenClaw 스킬 메타 확장 (nation-commander 역할) |
| 타입 정의 확장 | `src/types.ts` — 5 도메인 전체 TypeScript 타입 |

- **design**: N (SDK 코드)
- **verify**: SDK 빌드 성공, 타입 검사 통과, 기본 어드바이저 동작 테스트

### Phase 7: 예제 & 문서

| Task | 설명 |
|------|------|
| full-nation-agent 예제 | `examples/full-nation-agent.ts` — 5 도메인 기본 어드바이저 활용 |
| llm-nation-agent 예제 | `examples/llm-nation-agent.ts` — Claude API로 국가 운영 |
| economic-optimizer 예제 | `examples/economic-optimizer.ts` — GDP 최대화 특화 봇 |
| README v2 | SDK v2 전체 API 문서, 퀵스타트, 도메인별 가이드 |
| OpenAPI spec v2 | 서버 v2 API 전체 OpenAPI 3.0 스펙 생성 |

- **design**: N (문서 + 예제)
- **verify**: 예제 실행 성공, README 링크 검증

### Phase 8: v16 SimEngine 통합 & 밸런스 검증

| Task | 설명 |
|------|------|
| SimEngine v17 연동 | v16 SimulationEngine이 v17 경제/외교/정치 시스템 사용하도록 업데이트 |
| NationalAI v17 확장 | `strategy/national_ai.go` — 12종 자원 + DR + 정부형태 활용 의사결정 |
| Headless 밸런스 테스트 | ×1000 배속 시뮬레이션 100회 → 정부형태/자원/조약 밸런스 검증 |
| 수치 조정 | 밸런스 테스트 결과에 따라 공식 파라미터 튜닝 |
| 시스템 상호연결 검증 | 핵 연구→DR→무역→GDP→군사 파급 체인 동작 확인 |

- **design**: N (통합 + 밸런스)
- **verify**: 시뮬레이션 100회 완주, 정부형태 다양성 (6종 모두 생존), GDP 분포 합리적

### Phase 9: 프론트엔드 UI (선택적)

| Task | 설명 |
|------|------|
| Economy Dashboard | 12종 자원 생산/소비 차트, 세금/예산 슬라이더, 무역 시장 |
| Diplomacy Panel | DR 히트맵, 조약 관리, 전쟁 선포 UI |
| Military Panel | 유닛 구성 차트, 배치 맵, 기술 트리 |
| Politics Panel | 정부 형태 선택, 국내법 토글, 지지율 게이지 |
| World State Panel | 통합 세계 현황 대시보드, 이벤트 타임라인 |

- **design**: Y (UI 중심)
- **verify**: 페이지 렌더링, 반응형 확인, API 연동 테스트
