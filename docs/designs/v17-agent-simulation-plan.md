# v17: LLM 에이전트 시뮬레이션 — 경량 설계

> **Version**: v17.0 (Agent Simulation)
> **Date**: 2026-03-07
> **Status**: DRAFT
> **Core Vision**: LLM 기반 에이전트 여러 개를 로컬에서 실행하여, 기존 게임 서버에서 사회 구축 / 외교 / 전쟁 / 경제 운영을 자율적으로 수행하는지 시뮬레이션

---

## 1. 핵심 컨셉

### 1.1 한 줄 요약

> **"LLM 에이전트 5~10개를 로컬에서 실행하여, 기존 AI World War 서버에 접속시키고, 각 에이전트가 팩션을 만들고 국가를 운영하며 서로 외교/전쟁/무역하는 모습을 관찰한다."**

### 1.2 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **기존 서버 그대로** | 게임 서버 코드를 수정하지 않는다. 이미 95개 API가 있다. |
| **SDK 확장만** | aww-agent-skill SDK에 meta API 래핑 추가 |
| **LLM이 결정** | 에이전트는 게임 상태를 관찰 → LLM에 질의 → API로 결정 실행 |
| **최소 구현** | ~2,500줄 이내, 3 Phase |

### 1.3 시뮬레이션 플로우

```
┌─────────────────────────────────────────────────────────┐
│  기존 게임 서버 (game.sh — 변경 없음)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 95개 REST API (/api/v11/*)                       │   │
│  │ WebSocket 실시간 전투 (/ws)                       │   │
│  │ 에이전트 인증 (API Key)                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP / WS
                  ▼
┌─────────────────────────────────────────────────────────┐
│  로컬 시뮬레이션 러너 (node sim-runner.ts)                │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │Agent #1 │ │Agent #2 │ │Agent #3 │ │Agent #N │      │
│  │ (Claude) │ │  (GPT)  │ │(Claude) │ │(Llama)  │      │
│  │ 🇰🇷 한국  │ │ 🇺🇸 미국  │ │ 🇯🇵 일본  │ │ 🇨🇳 중국  │      │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘      │
│       │           │           │           │            │
│       ▼           ▼           ▼           ▼            │
│  ┌──────────────────────────────────────────────┐      │
│  │ SDK v2 (MetaClient + 전략 도메인)              │      │
│  │ - FactionDomain (팩션 생성/가입/관리)           │      │
│  │ - DiplomacyDomain (조약/동맹/제재)             │      │
│  │ - WarDomain (선전포고/항복/휴전)               │      │
│  │ - EconomyDomain (정책/무역/기술투자)           │      │
│  │ - CombatDomain (전투 — 기존 v1)               │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기존 시스템 현황 (변경 없음)

### 2.1 이미 구현된 API (95개)

| 카테고리 | 엔드포인트 수 | 인증 | 핵심 기능 |
|----------|-------------|------|----------|
| Factions | 9 | JWT | 팩션 생성/가입/탈퇴/킥/승급/자금 |
| Diplomacy | 6 | JWT | 조약 제안/수락/거절/파기 (5종: 불가침/무역/동맹/제재/조공) |
| War | 6 | JWT | 선전포고/항복/휴전/공성전 |
| Trade | 8 | JWT/Public | 주문장 매매 (6자원: Oil/Minerals/Food/Tech/Manpower/Influence) |
| Policy | 6 | JWT | 4 정책 슬라이더 (세율/무역개방/군비/기술투자) |
| GDP | 8 | Public | GDP 순위/요약/이력/분석 |
| Tech Tree | 3 | JWT | 3 브랜치 × 4 레벨 기술 연구 |
| Intel | 3 | JWT | 정찰/사보타주/방첩 미션 |
| Events | 3 | Public | 월드 이벤트 |
| Council | 5 | JWT | UN 위원회 결의안 |
| Mercenary | 6 | JWT | 용병 고용/배치 |
| Season | 12 | Public | 시즌/명예의전당/업적 |
| Agent REST | 6 | DualAuth | 에이전트 등록/배치/전략 |
| World | 4 | Public | 국가 목록/상태 |
| **합계** | **95** | | |

**인증 방식**: JWT (웹 로그인) 또는 DualAuth (JWT + API Key)
**서버 URL**: `http://localhost:9000` (로컬) / `https://snake-production-3b4e.up.railway.app` (프로덕션)

### 2.2 SDK v1 현황

| 파일 | 역할 |
|------|------|
| `agent.ts` | AWWAgent 클래스 — start/stop, 전략 설정, 자동 라운드 반복 |
| `client.ts` | GameClient — WebSocket 연결, 10Hz 입력 루프, 이벤트 핸들링 |
| `api.ts` | AWWApi — REST 10개 (register, profile, stats, matches, settings, countries, leaderboard) |
| `types.ts` | 타입 정의 (AgentState, Strategy, AgentInput, UpgradeChoice 등) |
| `strategy.ts` | 전략 유틸 (angleTo, findClosestOrb, distanceTo) |
| `strategies/` | aggressive.ts, balanced.ts, defensive.ts — 내장 전략 3종 |

**SDK가 현재 못하는 것**: 85개 meta API (팩션/외교/전쟁/무역/정책 등) 호출 불가 → **v2에서 추가**

### 2.3 서버 사이드 LLM Bridge (기존)

`server/internal/agent/llm_bridge.go` (588줄) — 이미 구현됨:
- Claude, GPT, Llama 3대 프로바이더 API 호출
- 2초 타임아웃 + 실패 시 rule-based 폴백
- 용도: 레벨업 시 업그레이드 선택 (전투 전용)
- **재사용 계획**: SDK v2에서 TypeScript LLM Bridge를 새로 구현 (클라이언트 사이드에서 호출)

> 서버 LLM Bridge는 전투 전용이고 서버에 묶여 있으므로, 에이전트 시뮬은 **SDK 쪽에서 직접 LLM 호출**하는 방식이 더 유연하다.

---

## 3. SDK v2 확장 설계

### 3.1 새로운 도메인 클래스

기존 AWWAgent에 meta 도메인을 추가한다. **서버 변경 없이** 기존 REST API를 래핑.

```typescript
// aww-agent-skill/src/agent.ts — v2 확장
class AWWAgent {
  // v1 기존 (전투)
  combat: CombatDomain;      // 전술 전투 (WebSocket 10Hz)

  // v2 NEW (전략 — REST API 래핑)
  faction: FactionDomain;    // 팩션 생성/관리
  diplomacy: DiplomacyDomain; // 조약/동맹/제재
  war: WarDomain;            // 선전포고/항복/휴전
  economy: EconomyDomain;    // 정책/무역/기술투자
  intel: IntelDomain;        // 정찰/사보타주
  world: WorldDomain;        // 월드 상태 관찰

  // v2 NEW (LLM 연동)
  llm?: LLMBridge;           // Claude/GPT/Llama 호출
  memory: AgentMemory;       // 과거 결정/결과 기록
}
```

각 도메인이 래핑하는 API:

```typescript
// FactionDomain — /api/v11/factions/*
interface FactionDomain {
  list(): Promise<Faction[]>;
  get(factionId: string): Promise<FactionDetail>;
  create(name: string, tag: string): Promise<Faction>;
  join(factionId: string): Promise<void>;
  leave(): Promise<void>;
  kick(memberId: string): Promise<void>;
  promote(memberId: string): Promise<void>;
  deposit(resource: string, amount: number): Promise<void>;
  withdraw(resource: string, amount: number): Promise<void>;
  getMyFaction(): Promise<FactionDetail | null>;
}

// DiplomacyDomain — /api/v11/diplomacy/*
interface DiplomacyDomain {
  proposeTreaty(targetFactionId: string, type: TreatyType): Promise<void>;
  acceptTreaty(treatyId: string): Promise<void>;
  rejectTreaty(treatyId: string): Promise<void>;
  breakTreaty(treatyId: string): Promise<void>;
  getActiveTreaties(factionId: string): Promise<Treaty[]>;
  getPendingProposals(factionId: string): Promise<Treaty[]>;
}

// WarDomain — /api/v11/war/*
interface WarDomain {
  declareWar(targetFactionId: string): Promise<War>;
  surrender(warId: string): Promise<void>;
  proposeCeasefire(warId: string): Promise<void>;
  getActiveWars(factionId: string): Promise<War[]>;
  getWarDetail(warId: string): Promise<WarDetail>;
  getSieges(warId: string): Promise<Siege[]>;
}

// EconomyDomain — /api/v11/policy/* + /api/v11/trade/* + /api/v11/gdp/* + /api/v11/tech-tree/*
interface EconomyDomain {
  // 정책 (4 슬라이더)
  getPolicy(countryIso: string): Promise<PolicyState>;
  setPolicy(countryIso: string, policies: Partial<PolicySliders>): Promise<void>;

  // 무역 (6자원 주문장)
  getMarket(): Promise<MarketSnapshot[]>;
  getOrderBook(resource: string): Promise<OrderBook>;
  placeOrder(order: TradeOrder): Promise<void>;
  cancelOrder(orderId: string): Promise<void>;
  getMyOrders(): Promise<Order[]>;

  // GDP
  getGDPRanking(): Promise<GDPRanking[]>;
  getCountryGDP(countryIso: string): Promise<GDPBreakdown>;
  getWorldSummary(): Promise<WorldEconomySummary>;

  // 기술 연구
  getTechTree(): Promise<TechNode[]>;
  getResearch(factionId: string): Promise<ResearchProgress>;
  investTech(nodeId: string, amount: number): Promise<void>;
}

// IntelDomain — /api/v11/intel/*
interface IntelDomain {
  launchMission(type: 'scout' | 'sabotage' | 'counter_intel', target: string): Promise<void>;
  getMissions(factionId: string): Promise<Mission[]>;
  getCountryIntel(countryIso: string): Promise<IntelStatus>;
}

// WorldDomain — /api/v11/* (읽기 전용 관찰)
interface WorldDomain {
  getCountries(): Promise<Country[]>;
  getWorldStatus(): Promise<WorldStatus>;
  getActiveEvents(): Promise<WorldEvent[]>;
  getSeasonInfo(): Promise<SeasonInfo>;
  getCouncilResolutions(): Promise<Resolution[]>;
  getMercenaries(): Promise<Mercenary[]>;
}
```

### 3.2 MetaClient (REST 래퍼)

기존 `AWWApi`를 확장하여 `/api/v11/*` 엔드포인트를 래핑하는 MetaClient 추가.

```typescript
// aww-agent-skill/src/meta-client.ts
class MetaClient {
  private baseUrl: string;
  private jwt: string;         // 웹 로그인 토큰 (meta API 인증용)
  private apiKey: string;      // 에이전트 API Key (agent API 인증용)

  constructor(config: { serverUrl: string; jwt: string; apiKey?: string });

  // JWT 인증이 필요한 meta API 호출
  async post(path: string, body?: any): Promise<any>;
  async get(path: string): Promise<any>;
  async put(path: string, body: any): Promise<any>;
  async delete(path: string): Promise<any>;
}
```

**인증 이슈**: 현재 meta API는 JWT 인증이 필요하다 (웹 로그인용). 에이전트가 JWT를 어떻게 얻는가?

**해결 방안 (서버 변경 최소화)**:
1. **Option A (서버 변경 0)**: 시뮬 러너가 미리 JWT를 발급받아 에이전트에 주입
2. **Option B (서버 소규모 변경)**: API Key로도 meta API 인증 가능하도록 DualAuth 미들웨어 확장 — `agent_routes.go`에 이미 DualAuth 패턴이 있으므로 이를 meta 라우트에도 적용
3. **선택**: Option B 권장 — 서버 변경 ~30줄 (미들웨어 1개 확장)

```go
// server/cmd/server/router.go — 변경
// 기존: r.Route("/api/v11", func(r chi.Router) { r.Use(jwtAuth) ... })
// 변경: r.Route("/api/v11", func(r chi.Router) { r.Use(dualAuth) ... })
// dualAuth = JWT 또는 API Key 둘 다 허용 (agent_routes.go의 DualAuth 재사용)
```

### 3.3 LLM Strategy 인터페이스

기존 `Strategy` 인터페이스(전투 전용)를 확장하여 전략적 의사결정도 LLM에 위임.

```typescript
// aww-agent-skill/src/llm/llm-bridge.ts
interface LLMConfig {
  provider: 'claude' | 'openai' | 'llama';
  apiKey: string;
  model?: string;              // default: claude-sonnet-4-6 / gpt-4o / llama-3.1-70b
  baseUrl?: string;            // Llama 커스텀 엔드포인트
  maxTokens?: number;          // default: 1024
  temperature?: number;        // default: 0.7
}

class LLMBridge {
  constructor(config: LLMConfig);

  // 범용 LLM 호출
  async query(systemPrompt: string, userMessage: string): Promise<string>;

  // 구조화된 결정 요청
  async decide(context: GameContext, options: Action[]): Promise<Action>;
}

// 전략적 의사결정 인터페이스
interface MetaStrategy {
  name: string;

  // 매 전략 틱마다 호출 (30초~1분 간격)
  onStrategicTick(state: StrategicState): Promise<StrategicAction[]>;

  // 외교 이벤트 반응 (조약 제안 수신 등)
  onDiplomaticEvent(event: DiplomaticEvent): Promise<DiplomaticResponse>;

  // 전쟁 이벤트 반응
  onWarEvent(event: WarEvent): Promise<WarResponse>;
}

// 게임 상태 집약 (LLM 프롬프트에 사용)
interface StrategicState {
  myFaction: FactionDetail;
  myCountries: CountryStatus[];
  myEconomy: { gdp: number; resources: ResourceStockpile; policies: PolicySliders };
  treaties: Treaty[];
  activeWars: War[];
  worldRanking: GDPRanking[];
  recentEvents: WorldEvent[];
  season: SeasonInfo;
  memory: PastDecision[];       // 최근 결정과 결과
}
```

---

## 4. LLM 에이전트 설계

### 4.1 에이전트 아키텍처

```
┌──────────────────────────────────────────────────┐
│  LLMNationAgent (하나의 에이전트 인스턴스)          │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  AWWAgent v2  │  │  LLMBridge   │              │
│  │  (SDK)        │  │  (Claude/GPT)│              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                      │
│         ▼                  ▼                      │
│  ┌─────────────────────────────────────┐         │
│  │  Strategic Loop (30초 간격)           │         │
│  │                                     │         │
│  │  1. 월드 상태 수집 (world.getAll)    │         │
│  │  2. 상태 요약 생성 (context builder) │         │
│  │  3. LLM에 전략 질의 (decide)         │         │
│  │  4. 결정 실행 (domain.action)        │         │
│  │  5. 결과 기록 (memory.log)           │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│  ┌─────────────────────────────────────┐         │
│  │  Combat Loop (기존 v1, 10Hz)         │         │
│  │  → 전투 전략은 LLM 또는 룰 기반      │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│  ┌─────────────────────────────────────┐         │
│  │  Memory (에이전트 기억)               │         │
│  │  - 과거 결정 + 결과 (최근 50개)       │         │
│  │  - 외교 관계 메모 (누구와 동맹/적대)   │         │
│  │  - 전략 목표 (장기 계획)              │         │
│  └─────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
```

```typescript
// aww-agent-skill/src/agents/nation-agent.ts
class LLMNationAgent {
  private agent: AWWAgent;
  private llm: LLMBridge;
  private memory: AgentMemory;
  private personality: string;     // LLM 시스템 프롬프트 (성격/전략 성향)
  private strategicInterval: number; // 전략 틱 간격 (ms, default 30000)

  constructor(config: {
    serverUrl: string;
    apiKey: string;
    jwt: string;
    countryIso: string;
    llmConfig: LLMConfig;
    personality?: string;
    strategicTickMs?: number;
  });

  async start(): Promise<void>;    // 접속 + 전투 루프 + 전략 루프 시작
  async stop(): Promise<void>;     // 정리

  // 전략 루프 (내부)
  private async strategicTick(): Promise<void>;
  private async gatherState(): Promise<StrategicState>;
  private async askLLM(state: StrategicState): Promise<StrategicAction[]>;
  private async executeActions(actions: StrategicAction[]): Promise<void>;
}
```

### 4.2 LLM 프롬프트 설계

LLM에게 보내는 시스템 프롬프트 + 상태 컨텍스트 설계.

**시스템 프롬프트 (에이전트 성격별)**:

```typescript
const PERSONALITIES = {
  aggressive: `You are an aggressive military leader in AI World War.
Your priorities: 1) Build military power 2) Declare war on weak neighbors 3) Expand territory.
You prefer military alliances and despise sanctions. You invest heavily in military spending.`,

  diplomat: `You are a skilled diplomat in AI World War.
Your priorities: 1) Form alliances 2) Negotiate trade agreements 3) Avoid war when possible.
You use sanctions strategically and invest in technology. You prefer peaceful GDP growth.`,

  economist: `You are an economic mastermind in AI World War.
Your priorities: 1) Maximize GDP 2) Control resource markets 3) Use economic leverage.
You set optimal tax rates, dominate trade, and use economic sanctions as weapons.`,

  opportunist: `You are a cunning opportunist in AI World War.
Your priorities: 1) Exploit others' weaknesses 2) Betray allies when profitable 3) Maximize power.
You form alliances only to break them. You declare war when the enemy is distracted.`,

  default: `You are a balanced national leader in AI World War.
Consider military, economic, and diplomatic options. Form alliances but be prepared for war.
Invest wisely across all areas. Adapt your strategy based on the changing world situation.`
};
```

**전략 틱 프롬프트 템플릿**:

```typescript
function buildStrategicPrompt(state: StrategicState): string {
  return `
## Current Situation (Tick ${state.season.currentTick})

### My Faction: ${state.myFaction.name} (${state.myFaction.memberCount} members)
- Countries: ${state.myCountries.map(c => c.name).join(', ')}
- GDP Rank: #${state.myEconomy.gdpRank} ($${state.myEconomy.gdp.toLocaleString()})
- Resources: Oil=${state.myEconomy.resources.oil}, Minerals=${state.myEconomy.resources.minerals}, ...
- Policies: Tax=${state.myEconomy.policies.tax_rate}%, Military=${state.myEconomy.policies.military_spend}%

### Diplomacy
- Active Treaties: ${state.treaties.map(t => `${t.type} with ${t.otherFaction}`).join(', ') || 'None'}
- Active Wars: ${state.activeWars.map(w => `vs ${w.enemyFaction} (${w.status})`).join(', ') || 'None'}

### World Rankings (Top 5)
${state.worldRanking.slice(0, 5).map((r, i) => `${i+1}. ${r.name}: $${r.gdp.toLocaleString()}`).join('\n')}

### Recent Events
${state.recentEvents.slice(0, 3).map(e => `- ${e.description}`).join('\n')}

### Season: ${state.season.name} — Era: ${state.season.currentEra}
${state.season.currentEra === 'discovery' ? '⚠️ War is NOT allowed yet' : 'War is allowed'}

### Memory (Recent Decisions)
${state.memory.slice(-5).map(m => `- ${m.action}: ${m.result}`).join('\n') || 'No previous decisions'}

---

## Available Actions
Choose 1-3 actions to take this tick. Respond as JSON array:

[
  {"action": "set_policy", "params": {"tax_rate": 15, "military_spend": 20}},
  {"action": "propose_treaty", "params": {"target": "faction_id", "type": "trade_agreement"}},
  {"action": "place_trade_order", "params": {"resource": "oil", "side": "buy", "quantity": 100, "price": 9}},
  {"action": "declare_war", "params": {"target": "faction_id"}},
  {"action": "invest_tech", "params": {"node": "military_1", "amount": 500}},
  {"action": "launch_intel", "params": {"type": "scout", "target": "KOR"}},
  {"action": "hire_mercenary", "params": {"tier": 2}},
  {"action": "do_nothing"}
]

Think step by step about the best strategy, then output ONLY the JSON array.
`;
}
```

### 4.3 의사결정 루프

```typescript
// 30초마다 실행되는 전략 루프
async strategicTick(): Promise<void> {
  // 1. 상태 수집 (REST API 호출 5~8개)
  const state = await this.gatherState();

  // 2. LLM에 전략 질의
  const prompt = buildStrategicPrompt(state);
  const response = await this.llm.query(this.personality, prompt);

  // 3. JSON 파싱
  const actions = parseActions(response);

  // 4. 액션 실행
  for (const action of actions) {
    try {
      await this.executeAction(action);
      this.memory.log({ action: action.action, params: action.params, result: 'success', tick: state.season.currentTick });
    } catch (err) {
      this.memory.log({ action: action.action, params: action.params, result: `failed: ${err.message}`, tick: state.season.currentTick });
    }
  }
}

// 액션 실행 라우터
async executeAction(action: StrategicAction): Promise<void> {
  switch (action.action) {
    case 'set_policy':
      await this.agent.economy.setPolicy(this.countryIso, action.params);
      break;
    case 'propose_treaty':
      await this.agent.diplomacy.proposeTreaty(action.params.target, action.params.type);
      break;
    case 'declare_war':
      await this.agent.war.declareWar(action.params.target);
      break;
    case 'place_trade_order':
      await this.agent.economy.placeOrder(action.params);
      break;
    case 'invest_tech':
      await this.agent.economy.investTech(action.params.node, action.params.amount);
      break;
    case 'launch_intel':
      await this.agent.intel.launchMission(action.params.type, action.params.target);
      break;
    case 'accept_treaty':
      await this.agent.diplomacy.acceptTreaty(action.params.treatyId);
      break;
    case 'surrender':
      await this.agent.war.surrender(action.params.warId);
      break;
    case 'do_nothing':
      break;
    default:
      console.warn(`Unknown action: ${action.action}`);
  }
}
```

**Rate Limiting**: 전략 틱 30초 간격이므로 API 호출은 ~10회/30초 = 0.33 req/s — 서버 부하 무시 가능
**LLM 비용**: Claude Sonnet 기준 ~$0.003/틱 × 에이전트 5개 × 120틱/시간 = ~$1.8/시간 (매우 저렴)

---

## 5. 시뮬레이션 러너

### 5.1 sim-runner.ts 설계

여러 에이전트를 동시에 실행하고 관찰하는 시뮬레이션 러너.

```typescript
// aww-agent-skill/src/sim/sim-runner.ts
interface SimConfig {
  serverUrl: string;          // http://localhost:9000
  agents: AgentConfig[];      // 에이전트 목록
  durationMinutes: number;    // 시뮬 시간 (default: 60)
  logDir: string;             // 로그 출력 디렉토리
  tickIntervalMs: number;     // 전략 틱 간격 (default: 30000)
}

interface AgentConfig {
  name: string;               // "Korea-Claude"
  countryIso: string;         // "KOR"
  apiKey: string;             // aww_xxx
  jwt: string;                // 미리 발급된 JWT (Option A) 또는 자동 발급 (Option B)
  llm: LLMConfig;             // { provider: 'claude', apiKey: 'sk-xxx' }
  personality?: string;       // 'aggressive' | 'diplomat' | 'economist' | 'opportunist'
  combatStrategy?: string;    // 'aggressive' | 'defensive' | 'balanced'
}

class SimRunner {
  private agents: LLMNationAgent[] = [];
  private logger: SimLogger;

  constructor(config: SimConfig);

  async start(): Promise<void> {
    // 1. 각 에이전트 초기화 + 서버 접속
    for (const cfg of this.config.agents) {
      const agent = new LLMNationAgent(cfg);
      await agent.start();
      this.agents.push(agent);
    }

    // 2. 관찰 루프 시작 (10초마다 월드 상태 로깅)
    this.startObserverLoop();

    // 3. 지정 시간 후 자동 종료
    setTimeout(() => this.stop(), this.config.durationMinutes * 60000);
  }

  async stop(): Promise<void> {
    for (const agent of this.agents) {
      await agent.stop();
    }
    await this.logger.generateReport();
  }

  private startObserverLoop(): void {
    setInterval(async () => {
      const worldStatus = await fetch(`${this.config.serverUrl}/api/v11/world/status`).then(r => r.json());
      const gdpRanking = await fetch(`${this.config.serverUrl}/api/v11/gdp/ranking/factions`).then(r => r.json());
      this.logger.logWorldState(worldStatus, gdpRanking);
    }, 10000);
  }
}
```

**실행 방법**:

```bash
# 1. 게임 서버 시작
./game.sh

# 2. 시뮬레이션 실행
cd aww-agent-skill
npx tsx src/sim/run.ts --config sim-config.json

# 3. 또는 간단 실행
npx tsx src/sim/run.ts \
  --server http://localhost:9000 \
  --agents 5 \
  --duration 60 \
  --provider claude
```

### 5.2 시뮬레이션 시나리오

미리 준비된 시뮬레이션 시나리오 프리셋.

```json
// sim-configs/cold-war.json — 냉전 시나리오
{
  "serverUrl": "http://localhost:9000",
  "durationMinutes": 120,
  "tickIntervalMs": 30000,
  "agents": [
    { "name": "USA-Hawk", "countryIso": "USA", "personality": "aggressive", "llm": { "provider": "claude" } },
    { "name": "Russia-Bear", "countryIso": "RUS", "personality": "aggressive", "llm": { "provider": "openai" } },
    { "name": "China-Dragon", "countryIso": "CHN", "personality": "economist", "llm": { "provider": "claude" } },
    { "name": "EU-Diplomat", "countryIso": "DEU", "personality": "diplomat", "llm": { "provider": "claude" } },
    { "name": "India-Neutral", "countryIso": "IND", "personality": "default", "llm": { "provider": "openai" } }
  ]
}

// sim-configs/battle-royale.json — 전면전 시나리오
{
  "agents": [
    { "name": "Korea-Warrior", "countryIso": "KOR", "personality": "aggressive" },
    { "name": "Japan-Tech", "countryIso": "JPN", "personality": "economist" },
    { "name": "USA-Eagle", "countryIso": "USA", "personality": "opportunist" },
    { "name": "Russia-Tsar", "countryIso": "RUS", "personality": "aggressive" },
    { "name": "Brazil-Samba", "countryIso": "BRA", "personality": "diplomat" },
    { "name": "UK-Empire", "countryIso": "GBR", "personality": "opportunist" },
    { "name": "France-Napoleon", "countryIso": "FRA", "personality": "aggressive" },
    { "name": "China-Master", "countryIso": "CHN", "personality": "economist" }
  ]
}
```

### 5.3 관찰 & 로깅

시뮬 진행 관찰용 로깅 시스템.

```typescript
// aww-agent-skill/src/sim/logger.ts
class SimLogger {
  private logDir: string;

  // 실시간 콘솔 출력
  logAction(agentName: string, action: string, result: string): void {
    // [00:05:23] 🇰🇷 Korea-Claude: declare_war → Russia-Bear ✅
    // [00:05:45] 🇷🇺 Russia-Bear: propose_treaty(alliance) → China-Dragon ✅
    // [00:06:00] 🇨🇳 China-Dragon: accept_treaty ✅
  }

  logWorldState(status: WorldStatus, ranking: GDPRanking[]): void {
    // [00:10:00] 🌍 World Status — GDP #1: USA($45M) #2: China($38M) #3: Korea($22M)
    //           Wars: Korea↔Russia | Treaties: China-Russia(alliance)
  }

  // 시뮬 종료 후 리포트 생성
  async generateReport(): Promise<void> {
    // sim-results/2026-03-07-cold-war/
    //   ├── timeline.json        — 전체 이벤트 타임라인
    //   ├── gdp-history.json     — GDP 추이 데이터
    //   ├── decisions.json       — 에이전트별 결정 로그
    //   ├── wars.json            — 전쟁 이력
    //   ├── treaties.json        — 조약 이력
    //   └── report.md            — 인간 읽기용 요약 리포트
  }
}
```

**리포트 예시** (`report.md`):
```markdown
# Simulation Report: Cold War Scenario
- Duration: 2 hours (240 strategic ticks)
- Agents: 5 (USA, Russia, China, Germany, India)

## Key Events
- Tick 12: USA formed alliance with Germany
- Tick 24: Russia declared war on India
- Tick 36: China imposed sanctions on Russia
- Tick 48: India surrendered to Russia
- Tick 60: USA declared war on Russia (defending ally)
...

## Final Rankings
1. China: $58M GDP (peaceful economic growth)
2. USA: $45M GDP (military victory over Russia)
3. Germany: $32M GDP (EU diplomat, avoided war)
...

## LLM Decision Analysis
- Most common action: set_policy (45%)
- Wars declared: 3
- Treaties formed: 8
- Average LLM response time: 1.2s
```

---

## 6. 구현 로드맵

### Phase 1: SDK v2 Meta 도메인 래핑 (~800줄)

| Task | 설명 | 파일 |
|------|------|------|
| MetaClient | REST 래퍼 (JWT/API Key 인증) | `src/meta-client.ts` |
| FactionDomain | 팩션 CRUD (9 엔드포인트 래핑) | `src/domains/faction.ts` |
| DiplomacyDomain | 조약 제안/수락/거절/파기 (6 엔드포인트) | `src/domains/diplomacy.ts` |
| WarDomain | 선전포고/항복/휴전 (6 엔드포인트) | `src/domains/war.ts` |
| EconomyDomain | 정책+무역+GDP+기술 (25 엔드포인트) | `src/domains/economy.ts` |
| IntelDomain | 정찰/사보타주 (3 엔드포인트) | `src/domains/intel.ts` |
| WorldDomain | 월드 상태 관찰 (읽기 전용) | `src/domains/world.ts` |
| 타입 정의 확장 | Meta 도메인 TypeScript 타입 | `src/types.ts` 확장 |
| AWWAgent v2 통합 | agent.ts에 meta 도메인 연결 | `src/agent.ts` 수정 |

- **design**: N (SDK 코드)
- **verify**: `npx tsc --noEmit` 성공, 각 도메인 메서드가 올바른 엔드포인트 호출 확인

### Phase 2: LLM Bridge + Nation Agent (~1,000줄)

| Task | 설명 | 파일 |
|------|------|------|
| LLMBridge | Claude/GPT/Llama API 호출 추상화 | `src/llm/llm-bridge.ts` |
| 프롬프트 빌더 | 전략 상태 → LLM 프롬프트 변환 | `src/llm/prompts.ts` |
| AgentMemory | 결정/결과 기록 (인메모리) | `src/llm/memory.ts` |
| LLMNationAgent | 전략 루프 + 전투 루프 통합 에이전트 | `src/agents/nation-agent.ts` |
| 성격 프리셋 | aggressive/diplomat/economist/opportunist/default | `src/agents/personalities.ts` |
| 액션 파서 | LLM JSON 응답 → 실행 가능 액션 변환 | `src/llm/action-parser.ts` |

- **design**: N (SDK 코드)
- **verify**: LLMNationAgent 단독 실행 성공, LLM 호출 → 액션 실행 → 결과 로깅 확인

### Phase 3: Sim Runner + 시나리오 + 서버 인증 확장 (~700줄)

| Task | 설명 | 파일 |
|------|------|------|
| SimRunner | 다중 에이전트 동시 실행 오케스트레이터 | `src/sim/sim-runner.ts` |
| SimLogger | 실시간 로깅 + 최종 리포트 생성 | `src/sim/logger.ts` |
| CLI 엔트리 | `npx tsx src/sim/run.ts` 실행 진입점 | `src/sim/run.ts` |
| 시나리오 프리셋 | cold-war, battle-royale JSON 설정 | `sim-configs/*.json` |
| 서버 DualAuth 확장 | meta API에 API Key 인증 추가 (~30줄) | `server/cmd/server/router.go` 수정 |
| game.sh 통합 | `./game.sh sim` 커맨드 추가 | `game.sh` 수정 |

- **design**: N
- **verify**: `./game.sh` 시작 → `./game.sh sim --config cold-war.json` 실행 → 에이전트 5개 접속 → 30초 전략 틱 관찰 → 리포트 생성

---

## 파일 수 & LOC 추정

| Phase | 새 파일 | 수정 파일 | 신규 LOC |
|-------|---------|----------|---------|
| Phase 1 (SDK Meta) | 7 | 2 | ~800 |
| Phase 2 (LLM Agent) | 6 | 0 | ~1,000 |
| Phase 3 (Sim Runner) | 5 | 2 | ~700 |
| **합계** | **18** | **4** | **~2,500** |

기존 v17 기획(23,500줄, 60+ 파일)의 **약 1/10 규모**.
서버 변경: **~30줄** (DualAuth 미들웨어 확장 1곳).
