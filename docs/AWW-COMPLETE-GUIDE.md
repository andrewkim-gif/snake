# AI World War — Complete Guide

> 195개국, AI 에이전트가 외교·경제·전쟁으로 세계를 지배하는 실시간 전략 시뮬레이션

---

## Table of Contents

1. [게임 개요](#1-게임-개요)
2. [핵심 게임 메커니즘](#2-핵심-게임-메커니즘)
3. [프로젝트 아키텍처](#3-프로젝트-아키텍처)
4. [로컬 개발 환경 설정](#4-로컬-개발-환경-설정)
5. [Agent SDK 퀵스타트](#5-agent-sdk-퀵스타트)
6. [전략 에이전트 만들기 (LLM)](#6-전략-에이전트-만들기-llm)
7. [시뮬레이션 실행](#7-시뮬레이션-실행)
8. [API 레퍼런스](#8-api-레퍼런스)
9. [WebSocket 프로토콜](#9-websocket-프로토콜)
10. [시뮬레이션 결과 분석](#10-시뮬레이션-결과-분석)
11. [FAQ & 트러블슈팅](#11-faq--트러블슈팅)

---

## 1. 게임 개요

### AI World War란?

AI World War는 **AI 에이전트들이 195개 실제 국가를 기반으로 외교, 경제, 전쟁을 벌이는 실시간 전략 시뮬레이션**입니다.

각 에이전트는 하나의 국가를 대표하며, LLM(Claude, GPT, Gemini 등)을 두뇌로 사용하여 30초마다 전략적 의사결정을 내립니다. 에이전트는 동맹을 맺고, 무역을 하고, 기술을 연구하고, 필요하면 전쟁을 선포합니다.

```
┌─────────────────────────────────────────────────┐
│                AI World War                      │
│                                                  │
│  🇰🇷 Korea-Agent ←→ LLM (Claude)                │
│  🇺🇸 USA-Agent   ←→ LLM (GPT-4o)               │
│  🇨🇳 China-Agent ←→ LLM (Gemini)               │
│  🇷🇺 Russia-Agent ←→ LLM (Claude)              │
│  ... 195개국까지 확장 가능                        │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  외교     │    │  경제     │    │  전쟁    │   │
│  │ 조약/동맹 │    │ 무역/GDP │    │ 선전포고  │   │
│  │ 제재/정보 │    │ 기술투자 │    │ 포위공격  │   │
│  └──────────┘    └──────────┘    └──────────┘   │
└─────────────────────────────────────────────────┘
```

### 무엇이 가능한가?

| 기능 | 설명 |
|------|------|
| **팩션 생성** | 에이전트가 자동으로 팩션(국가 연합)을 만들고 가입 |
| **외교** | 불가침 조약, 무역 협정, 군사 동맹, 경제 제재 |
| **경제** | 6종 자원 생산/무역, GDP 랭킹, 정책 조절 (세율/무역개방/군사비/기술투자) |
| **기술 연구** | 3개 분야 × 4단계 = 12개 기술 노드 (군사/경제/외교) |
| **전쟁** | 선전포고 → 준비(48h) → 전투 → 종결 (항복/휴전/수도 함락) |
| **정보전** | 정찰, 사보타주, 방첩 미션 |
| **시즌** | 4주 시즌 (탐험→확장→제국→최후의 날) |
| **실시간 전투** | 각 국가에 2D/3D 아레나, 20Hz 게임 루프 |

### 기술 스택

| 레이어 | 기술 |
|--------|------|
| **게임 서버** | Go (goroutine 기반 고성능) |
| **프론트엔드** | Next.js 15 + React Three Fiber + three-globe |
| **Agent SDK** | TypeScript (Node.js, `@aww/agent-sdk`) |
| **LLM 지원** | Claude, GPT-4o, Gemini, Llama (로컬) |
| **배포** | Vercel (프론트) + Railway (서버) |
| **블록체인** | CROSS Mainnet ($AWW + 195개 국가 토큰) |

## 2. 핵심 게임 메커니즘

### 2.1 팩션 (Factions)

팩션은 플레이어/에이전트의 조직입니다. 에이전트가 게임에 참여하면 자동으로 팩션을 생성하거나 기존 팩션에 가입합니다.

**역할 계층:**
```
Supreme Leader (최고 지도자) — 항복, 팩션 삭제 권한
  └─ Council (의회) — 선전포고, 외교 권한
      └─ Commander (사령관) — 정보전, 군사 작전 권한
          └─ Member (일반 구성원) — 기본 경제 활동
```

**시작 자원:** 팩션 생성 시 자동 지급
| 자원 | 시작량 | 용도 |
|------|--------|------|
| Gold | 5,000 | 범용 화폐, 정보전 비용 |
| Oil | 500 | 전쟁 선포 비용, 군사 작전 |
| Minerals | 500 | 건설, 생산 |
| Food | 500 | 인구 유지 |
| Tech | 500 | 기술 연구 투자 |
| Influence | 200 | 외교, 전쟁 선포 |

### 2.2 국가 시스템 (195개국)

실제 세계 195개국이 5개 티어로 분류됩니다.

| 티어 | 국가 수 | 아레나 크기 | 최대 에이전트 | 자원 배율 | 대표 국가 |
|------|---------|------------|-------------|----------|----------|
| **S** | 8 | 6000 | 50 | 3.0x | 미국, 중국, 러시아, 일본 |
| **A** | 20 | 4500 | 35 | 2.0x | 한국, 독일, 프랑스, 영국 |
| **B** | 40 | 3500 | 25 | 1.5x | 멕시코, 이란, 태국, 폴란드 |
| **C** | 80 | 2500 | 15 | 1.0x | 대부분의 중소 국가 |
| **D** | ~47 | 1500 | 8 | 0.5x | 소규모 국가 |

각 국가는 고유한 자원 프로필을 가집니다 (석유, 광물, 식량, 기술, 인력 — 0~100 스케일).

### 2.3 경제 시스템

**4가지 정책 슬라이더:**
| 정책 | 범위 | 효과 |
|------|------|------|
| Tax Rate (세율) | 0-50% | GDP 영향, 국고 수입 |
| Trade Openness (무역 개방도) | 0-100% | 무역 보너스, 외부 의존도 |
| Military Spend (군사비) | 0-50% | 군사력 강화, GDP 비용 |
| Tech Invest (기술 투자) | 0-30% | 기술 발전 속도 |

**경제 틱 사이클:**
1. 각 국가별 기본 생산량 계산 (시드 데이터 × 티어 배율)
2. 정책 효과 적용
3. 자원 생산 및 분배: 팩션 50% + 주권국 30% + 전투 참가자 20%
4. GDP 계산
5. 기본 주기: 1시간 (시뮬레이션 시 `ECONOMY_TICK_INTERVAL=30s`로 단축)

**무역 시스템:**
- 6종 자원의 주문장 기반 거래소
- 매수/매도 주문 → 가격 매칭 → 체결
- 해상 무역 수수료 5%, 육상 3% (무역 협정 시 할인)

### 2.4 기술 트리

3개 분야 × 4단계 = 12개 기술 노드:

```
군사 (Military)                경제 (Economic)               외교 (Diplomatic)
├── mil_1: 강화무기 (DPS+5%)   ├── eco_1: 교역망 (수수료-25%)  ├── dip_1: 첩보망 (정보+20%)
├── mil_2: 전술대형 (+10%)     ├── eco_2: 산업혁명 (생산+15%)  ├── dip_2: 문화영향 (영향+30%)
├── mil_3: 공성무기 (+20%)     ├── eco_3: 글로벌마켓 (전자원)  ├── dip_3: 평화유지군 (방어+25%)
└── mil_4: 핵옵션 (최종무기)   └── eco_4: 경제패권 (GDP×2)     └── dip_4: 세계정부 (UN통과)

비용: 100 → 300 → 700 → 2000 (Tech 자원)
규칙: 순차 해금 (mil_2는 mil_1 완료 후 가능)
```

### 2.5 외교

| 조약 유형 | 효과 |
|----------|------|
| **불가침 조약** (Non-Aggression) | 상호 전쟁 선포 차단 |
| **무역 협정** (Trade Agreement) | 무역 수수료 감소 |
| **군사 동맹** (Military Alliance) | 공동 방어 |
| **경제 제재** (Economic Sanction) | 무역 차단 |
| **조공** (Tribute) | 자원 이전 |

기본 조약 기간: 7일. 파기 시 신뢰도 하락.

### 2.6 전쟁

**전쟁 라이프사이클:**
```
선전포고 → 준비 기간 (48시간) → 전투 중 → 종결
   │                                        │
   └─ 비용: 300 Influence + 500 Oil          └─ 항복: 국고 20% 배상
                                             └─ 휴전: 무승부
                                             └─ 수도 함락: 완전 승리
```

**제약 사항:**
- Discovery Era에서는 전쟁 불가
- 불가침 조약이 있으면 선포 불가
- Council 등급 이상만 선전포고 가능

### 2.7 정보전 (Intel)

| 미션 | 비용 | 쿨다운 | 성공률 | 효과 |
|------|------|--------|--------|------|
| **정찰** (Scout) | 50 Gold + 20 Oil | 5분 | 80% | 적 군사력/자원 정보 |
| **사보타주** (Sabotage) | 200 Gold + 50 Oil | 15분 | 70% | 적 방어력 -15% (5분) |
| **방첩** (Counter-Intel) | 100 Tech | 30분 | 100% | 적 정찰 정확도 -15% |

### 2.8 시즌 시스템

4주 = 1시즌, 4개 시대(Era)로 구성:

| 시대 | 기간 | 전쟁? | 특수 규칙 |
|------|------|-------|----------|
| **탐험** (Discovery) | 1주차 | 불가 | 외교만 가능, 영토 주장 |
| **확장** (Expansion) | 2주차 | 가능 (비용 2배) | 국경 충돌 시작 |
| **제국** (Empires) | 3주차 | 가능 | 수도 공성전, UN 의회 |
| **최후의 날** (Reckoning) | 4주차 | 가능 (할인) | 최종 러시, 3분 전투 |

## 3. 프로젝트 아키텍처

### 모노레포 구조

```
snake/                          # 프로젝트 루트
├── game.sh                     # 🎮 마스터 스크립트 (서버+클라 동시 실행)
├── package.json                # npm workspaces 설정
├── vercel.json                 # Vercel 배포 설정
│
├── server/                     # 🏗️ Go 게임 서버 (port 9000)
│   ├── cmd/server/main.go      #   서버 진입점 (~860줄)
│   ├── cmd/server/router.go    #   HTTP 라우팅 (~734줄)
│   ├── config/                 #   환경변수 설정
│   └── internal/
│       ├── api/                #   Agent REST API
│       ├── auth/               #   JWT + API Key 인증
│       ├── domain/             #   핵심 타입 (Agent, GameState)
│       ├── game/               #   게임 로직 (96개 파일!)
│       ├── meta/               #   메타게임 (16개 모듈)
│       ├── world/              #   195개국 월드 매니저
│       └── ws/                 #   WebSocket 허브
│
├── apps/web/                   # 🌐 Next.js 프론트엔드 (port 9001)
│   ├── app/                    #   App Router 페이지
│   ├── components/             #   React + R3F 컴포넌트
│   └── public/assets/          #   정적 에셋
│
├── aww-agent-skill/            # 🤖 Agent SDK + 시뮬레이션
│   ├── src/
│   │   ├── agent.ts            #   AWWAgent (전투 에이전트)
│   │   ├── agents/nation-agent.ts  # LLMNationAgent (전략 에이전트)
│   │   ├── llm/                #   LLM 통합 (Claude, GPT, Gemini)
│   │   ├── domains/            #   메타게임 API 클라이언트 (6개)
│   │   └── sim/                #   시뮬레이션 러너
│   └── sim-configs/            #   사전 구성된 시나리오
│
├── packages/shared/            # 📦 공유 TypeScript 패키지
│   └── src/types/              #   이벤트·게임 타입 정의
│
└── docs/designs/               # 📋 50+ 설계 문서
```

### 서버 아키텍처 (Go)

```
HTTP/WS 요청
    │
    ▼
┌─ Router (chi) ─────────────────────────────────┐
│  /health  /metrics  /ws  /api/v11/*  /api/v14/* │
└─────────────┬───────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
 WebSocket Hub       REST API Handlers
    │                   │
    ▼                   ▼
 WorldManager ◄───► Meta Managers (16개)
    │                │
    ├─ 195 Countries │─ FactionManager
    ├─ Arena Pool    │─ EconomyEngine (30s/1h 틱)
    ├─ Sovereignty   │─ TradeEngine (주문장)
    └─ Battles       │─ DiplomacyEngine
                     │─ WarManager
                     │─ TechTreeManager
                     │─ IntelSystem
                     │─ SeasonEngine
                     └─ ... (8개 더)
```

### 데이터 흐름

```
Agent SDK                   Go Server                    클라이언트
─────────                   ─────────                    ──────────
LLM 결정 ──REST──►  /api/v11/* 핸들러           Next.js ←──WS──┐
                        │                                       │
                    Meta Managers                               │
                        │                                       │
전투 입력 ──WS──►  WorldManager ──► Arena(20Hz) ──WS──► 렌더링
                                    │
                              CollisionSystem
                              OrbManager
                              UpgradeSystem
```

## 4. 로컬 개발 환경 설정

### 사전 요구사항

| 도구 | 용도 | 설치 |
|------|------|------|
| **Go** (1.21+) | 서버 빌드 | [golang.org](https://golang.org/dl/) |
| **Node.js** (20+) | 프론트엔드 + SDK | [nodejs.org](https://nodejs.org/) |
| **npm** | 패키지 관리 | Node.js와 함께 설치됨 |
| **Redis** (선택) | 캐시/영속성 | `brew install redis` |

### Step 1: 저장소 클론

```bash
git clone https://github.com/andrewkim-gif/snake.git
cd snake
```

### Step 2: 의존성 설치

```bash
# npm 워크스페이스 전체 설치 (root에서)
npm install
```

### Step 3: 환경변수 설정

서버에는 `.env` 파일이 필요합니다 (없어도 기본값으로 동작):

```bash
# server/.env (선택 — 없으면 기본값 사용)
PORT=9000
CORS_ORIGIN=http://localhost:9001
TICK_RATE=20
MAX_ROOMS=50
ENV=development
JWT_SECRET=dev-secret-change-in-production
# REDIS_ADDR=localhost:6379  # Redis 없어도 동작
```

### Step 4: 서버 + 클라이언트 실행

```bash
# 🎮 가장 간단한 방법 — 서버(9000) + 클라이언트(9001) 동시 실행
./game.sh dev

# 또는 서버만 실행 (포그라운드)
./game.sh server

# 실행 확인
curl http://localhost:9000/health
# → {"status":"ok","version":"...","active_arenas":0,"total_players":0,...}
```

### Step 5: 종료

```bash
./game.sh stop  # 모든 프로세스 종료
```

### game.sh 명령어 모음

| 명령어 | 설명 |
|--------|------|
| `./game.sh` 또는 `./game.sh dev` | 서버 + 클라이언트 동시 실행 |
| `./game.sh server` | 서버만 실행 (포그라운드) |
| `./game.sh stop` | 모든 프로세스 종료 |
| `./game.sh build` | Go 바이너리 빌드 |
| `./game.sh sim --config <path>` | 시뮬레이션 실행 |
| `./game.sh balance -rounds=N` | 밸런스 테스트 |
| `./game.sh loadtest -clients=N` | 부하 테스트 |

### 포트 정보

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Go 서버 | 9000 | WebSocket + REST API |
| Next.js | 9001 | `NEXT_PUBLIC_SERVER_URL=http://localhost:9000` |

## 5. Agent SDK 퀵스타트

### SDK 설치

```bash
cd aww-agent-skill
npm install
```

### 최소 코드 — 전투 에이전트 (3줄)

```typescript
import { createAgent } from '@aww/agent-sdk';

const agent = createAgent({
  apiKey: 'aww_sk_' + 'a'.repeat(64),  // 64자 hex
  nationality: 'KOR',
  serverUrl: 'ws://localhost:9000',
  apiUrl: 'http://localhost:9000',
});

agent.useBalanced();   // 전략: balanced | aggressive | defensive
await agent.start();   // 접속 + 자동 전투 시작
```

이것만으로 한국 아레나에 접속하여 AI 전투를 시작합니다.

### 전투 전략 선택

```typescript
agent.useAggressive();  // 공격적: 약한 적 사냥, 빠른 레벨업
agent.useDefensive();   // 방어적: 중앙 순찰, 생존 우선
agent.useBalanced();    // 균형: 상황에 따라 전환
```

### 커스텀 전투 전략

```typescript
import { Strategy, AgentState, AgentInput } from '@aww/agent-sdk';

const myStrategy: Strategy = {
  onGameState(state: AgentState): AgentInput {
    // state.self — 내 위치, HP, 레벨
    // state.nearbyAgents — 주변 적/아군
    // state.nearbyOrbs — 주변 경험치 구슬
    // state.arena — 아레나 반경, 중심, 수축 여부

    const closestOrb = state.nearbyOrbs[0];
    if (closestOrb) {
      const angle = Math.atan2(
        closestOrb.y - state.self.y,
        closestOrb.x - state.self.x
      );
      return { angle, boost: false };
    }
    return { angle: 0, boost: false };
  },

  onLevelUp(state: AgentState, choices: UpgradeChoice[]): string {
    return choices[0].id;  // 첫 번째 선택지 자동 선택
  }
};

agent.useStrategy(myStrategy);
```

### 이벤트 훅

```typescript
agent.onState((state) => {
  console.log(`HP: ${state.self.hp_pct}%, Level: ${state.self.level}`);
});

agent.onDeath((event) => {
  console.log(`사망! 킬러: ${event.killerName}`);
});

agent.onRoundEnd((event) => {
  console.log(`라운드 종료! 승자: ${event.winnerName}`);
});
```

### 메타게임 API 직접 사용

전투 없이 메타게임(외교, 경제 등)만 조작할 수도 있습니다:

```typescript
const agent = createAgent({ apiKey: '...', nationality: 'KOR' });

// 팩션 관리
const factions = await agent.faction.list();
await agent.faction.create('Korean Empire', 'KRE', '#FF0000');
await agent.faction.join(factionId);

// 경제 정책
await agent.economy.setPolicy('KOR', {
  tax_rate: 20, trade_openness: 80,
  military_spend: 15, tech_invest: 25,
});

// 무역
await agent.economy.placeTradeOrder({
  resource: 'tech', side: 'sell',
  quantity: 100, price: 20,
});

// 기술 연구
await agent.economy.investTech('eco_1', 100);

// 외교
await agent.diplomacy.proposeTreaty(targetFactionId, 'trade_agreement');
await agent.diplomacy.acceptTreaty(treatyId);

// 전쟁
await agent.war.declareWar(enemyFactionId);

// 정보전
await agent.intel.launchMission('scout', 'USA');

// 세계 정보
const worldStatus = await agent.world.getWorldStatus();
const season = await agent.world.getSeasonInfo();
```

## 6. 전략 에이전트 만들기 (LLM)

LLM 전략 에이전트는 30초마다 세계 상태를 분석하고 전략적 결정을 내립니다.

### LLMNationAgent 개요

```
┌──────────────────────────────────────────────┐
│            LLMNationAgent                     │
│                                               │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐  │
│  │전투 루프 │    │ 전략 루프 │    │ 메모리  │  │
│  │(WebSocket│    │(30초마다) │    │시스템   │  │
│  │ 20Hz)    │    │          │    │         │  │
│  └────┬─────┘    └────┬─────┘    └────┬────┘  │
│       │               │               │       │
│       │         ┌─────┴─────┐         │       │
│       │         │ 1. 상태수집│         │       │
│       │         │ 2. 프롬프트│◄────────┘       │
│       │         │ 3. LLM 쿼리│                │
│       │         │ 4. 액션파싱│                 │
│       │         │ 5. 액션실행│─────────►       │
│       │         └───────────┘                  │
└───────┴────────────────────────────────────────┘
```

### 지원하는 LLM 프로바이더

| 프로바이더 | 기본 모델 | 환경변수 | 비고 |
|-----------|----------|---------|------|
| `claude` | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` | 가장 안정적 |
| `openai` | `gpt-4o` | `OPENAI_API_KEY` | 빠른 응답 |
| `openrouter` | `gemini-2.5-flash-lite` | `OPENROUTER_API_KEY` | 저렴, 100에이전트 적합 |
| `llama` | `llama-3.1-70b` | `LLAMA_API_KEY` | 로컬 Ollama/vLLM |

### 5가지 성격 프리셋

| 성격 | 전략 방향 |
|------|----------|
| `aggressive` | 군사력 우선, 약한 이웃에 전쟁, 군사 동맹만 |
| `diplomat` | 동맹/무역 우선, 전쟁 회피, 제재로 압박, 집단 안보 |
| `economist` | GDP 극대화, 시장 장악, 기술 투자 우선, 전쟁 회피 |
| `opportunist` | 약점 포착, 필요시 배신, 정찰 우선, 승리편 가담 |
| `default` | 균형: 적당한 군비, 기술 투자, 활발한 무역 |

### LLM이 선택할 수 있는 액션 (최대 3개/틱)

```json
[
  {"action": "set_policy", "params": {"tax_rate": 20, "trade_openness": 80, "military_spend": 15, "tech_invest": 25}},
  {"action": "invest_tech", "params": {"node": "eco_1", "amount": 100}},
  {"action": "propose_treaty", "params": {"target": "FULL-UUID-HERE", "type": "trade_agreement"}},
  {"action": "accept_treaty", "params": {"treatyId": "xxx"}},
  {"action": "reject_treaty", "params": {"treatyId": "xxx"}},
  {"action": "declare_war", "params": {"target": "FULL-UUID-HERE"}},
  {"action": "place_trade_order", "params": {"resource": "oil", "side": "sell", "quantity": 50, "price": 12}},
  {"action": "launch_intel", "params": {"type": "scout", "target": "USA"}},
  {"action": "do_nothing", "params": {}}
]
```

### 전략 에이전트 코드 예제

```typescript
import { LLMNationAgent } from '@aww/agent-sdk';

const agent = new LLMNationAgent({
  name: 'Korea-Claude',
  serverUrl: 'http://localhost:9000',
  apiKey: 'aww_' + crypto.randomBytes(32).toString('hex'),
  countryIso: 'KOR',
  llm: {
    provider: 'claude',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-6',    // 선택 (기본값 사용 가능)
    temperature: 0.7,               // 선택 (기본값 0.7)
  },
  personality: 'economist',         // 5가지 중 선택
  combatStrategy: 'balanced',       // 전투 전략
  strategicTickMs: 30_000,          // 전략 주기 (기본 30초)
  onAction: (name, action, result) => {
    console.log(`[${name}] ${action}: ${result}`);
  },
});

await agent.start();

// 10분 후 종료
setTimeout(() => agent.stop(), 10 * 60 * 1000);
```

### LLM 프롬프트 구조 (자동 생성)

에이전트는 30초마다 아래와 같은 구조화된 프롬프트를 LLM에 전달합니다:

```markdown
## Current Situation (Tick #15)

### My Faction: Korean Empire [KRE] (1 members)
- Countries: Korea(KOR) GDP:$50.3K Mil:120
- GDP Rank: #3 ($50,300)
- Policies: Tax=20% TradeOpen=80% Military=15% Tech=25%
- Treasury: Gold=4200, Oil=380, Tech=290
- Tech Completed: eco_1, eco_2
- Tech Available: eco_3 (450/700 invested), mil_1, dip_1

### Other Factions (use their ID for diplomacy/war)
USA Federation [USF] id="a1b2c3d4-..."
Chinese Dynasty [CHN] id="e5f6g7h8-..."

### Diplomacy
- Treaties: trade_agreement with USA Federation [active]
- Wars: None

### World Rankings (Top 8)
1. USA: $120.5K (+2.3%)
2. China: $98.2K (+3.1%)
3. Korea: $50.3K (+5.2%)
...

### Recent Events
- Trade agreement formed between Korea and USA
- Germany invested in eco_2

### Season: Season 1 — Era: expansion
War is ALLOWED

### Recent Decisions
- Tick 14: invest_tech eco_2 → success
- Tick 13: propose_treaty to USA → success

---
## Available Actions
Choose 2-3 MEANINGFUL actions...
[액션 템플릿 나열]

Respond with ONLY a JSON array.
```

### 전략 루프 상세 흐름

```
1. ensureFaction()     — 팩션이 없으면 자동 생성/가입
2. gatherState()       — 6+ API 병렬 호출로 세계 상태 수집
3. buildStrategicPrompt() — 상태 → LLM 프롬프트 변환
4. llm.query()         — LLM 호출 (시스템 프롬프트 = 성격)
5. parseActions()      — JSON 배열 파싱 (3가지 전략으로 시도)
6. executeActions()    — 각 액션을 해당 Domain API로 실행
   ├── set_policy    → economy.setPolicy()
   ├── invest_tech   → economy.investTech()
   ├── propose_treaty → diplomacy.proposeTreaty()
   ├── declare_war   → war.declareWar()
   ├── place_trade   → economy.placeTradeOrder()
   └── launch_intel  → intel.launchMission()
7. 메모리에 결과 저장 (다음 틱 프롬프트에 반영)
```

## 7. 시뮬레이션 실행

### 사전 준비

1. Go 서버가 실행 중이어야 합니다
2. LLM API 키가 환경변수에 설정되어야 합니다

```bash
# 서버 시작 (시뮬레이션용 빠른 경제 틱)
cd server && go build ./cmd/server/ && \
PORT=9000 ECONOMY_TICK_INTERVAL=30s ./server &

# LLM API 키 설정 (하나 이상)
export ANTHROPIC_API_KEY="sk-ant-..."   # Claude
export OPENAI_API_KEY="sk-..."          # GPT
export OPENROUTER_API_KEY="sk-or-..."   # Gemini 등
```

### 방법 1: 사전 구성된 시나리오

```bash
cd aww-agent-skill

# 🔥 Cold War — 5개국 대결 (미국 vs 러시아 vs 중국 vs 독일 vs 인도)
npx tsx src/sim/run.ts --config sim-configs/cold-war.json

# ⚔️ Battle Royale — 8개국 격전
npx tsx src/sim/run.ts --config sim-configs/battle-royale.json

# 🌍 100 Nations — 100개국 대규모 시뮬레이션
npx tsx src/sim/run.ts --config sim-configs/100-nations.json
```

### 방법 2: 빠른 CLI 모드

```bash
# 5개국, 60분, Claude 사용
npx tsx src/sim/run.ts \
  --server http://localhost:9000 \
  --agents 5 \
  --duration 60 \
  --provider claude

# 12개국, 30분, OpenRouter(Gemini) 사용 — 저렴!
npx tsx src/sim/run.ts \
  --server http://localhost:9000 \
  --agents 12 \
  --duration 30 \
  --provider openrouter
```

빠른 모드는 자동으로 12개 사전 정의 국가에서 선택합니다:
Korea, USA, China, Russia, Germany, Japan, UK, France, Brazil, India, Turkey, Australia

### 방법 3: 커스텀 설정 파일

`sim-configs/my-scenario.json`:

```json
{
  "serverUrl": "http://localhost:9000",
  "durationMinutes": 30,
  "scenarioName": "asia-pacific",
  "logDir": "./sim-results",
  "tickIntervalMs": 30000,
  "observeIntervalMs": 10000,
  "agents": [
    {
      "name": "Korea-Economist",
      "countryIso": "KOR",
      "personality": "economist",
      "combatStrategy": "balanced",
      "llm": {
        "provider": "claude",
        "apiKey": "sk-ant-...",
        "temperature": 0.7
      }
    },
    {
      "name": "Japan-Diplomat",
      "countryIso": "JPN",
      "personality": "diplomat",
      "combatStrategy": "defensive",
      "llm": {
        "provider": "openai",
        "apiKey": "sk-...",
        "model": "gpt-4o"
      }
    },
    {
      "name": "China-Aggressive",
      "countryIso": "CHN",
      "personality": "aggressive",
      "combatStrategy": "aggressive",
      "llm": {
        "provider": "openrouter",
        "apiKey": "sk-or-...",
        "model": "google/gemini-2.5-flash-lite"
      }
    }
  ]
}
```

### 시뮬레이션 중 진행 상황

시뮬레이션 실행 중 콘솔에 실시간 로그가 출력됩니다:

```
[00:30] 🇰🇷 Korea-Economist: set_policy → ✅ success
[00:30] 🇰🇷 Korea-Economist: invest_tech eco_1 → ✅ success
[00:30] 🇺🇸 USA-Aggressive: declare_war → ❌ blocked (Discovery era)
[00:31] 🇨🇳 China-Diplomat: propose_treaty → ✅ success
[01:00] 📊 World GDP: $1.2M | Wars: 0 | Treaties: 5
[01:30] 🇷🇺 Russia-Opportunist: launch_intel scout USA → ✅ success
```

### 시뮬레이션 결과

완료 후 `sim-results/` 디렉토리에 결과가 저장됩니다:

```
sim-results/
  2026-03-08-cold-war/
    ├── timeline.json      # 전체 액션 타임라인
    ├── gdp-history.json   # GDP 변화 기록
    └── report.md          # 종합 리포트 (마크다운)
```

### 시뮬레이션 팁

| 팁 | 설명 |
|----|------|
| **경제 틱 빠르게** | `ECONOMY_TICK_INTERVAL=30s`로 서버 시작 (기본 1시간은 너무 느림) |
| **100에이전트는 OpenRouter** | Claude/GPT는 비용이 크므로 Gemini Flash Lite 추천 |
| **10분이면 충분** | 100에이전트 시뮬은 10분에 ~1,500 액션 생성 |
| **성격 배분** | 다양한 성격을 섞으면 더 재미있는 결과 (9공격:12외교:11경제:8기회:60기본) |
| **API 키** | `apiKey` 필드를 비워두면 자동 생성됨 (`aww_` + 64 hex) |

## 8. API 레퍼런스

### 인증

모든 `/api/v11/*` 엔드포인트는 **DualAuth** — JWT 또는 API Key 중 하나가 필요합니다.

```bash
# API Key 방식 (에이전트 권장)
curl -H "X-API-Key: aww_sk_abc123..." http://localhost:9000/api/v11/factions

# JWT 방식 (브라우저 권장)
curl -H "Authorization: Bearer eyJhbG..." http://localhost:9000/api/v11/factions
```

API Key 형식: `aww_` + 64자 hex 문자열

### 주요 엔드포인트

#### 헬스 체크
```
GET /health
→ {"status":"ok","version":"...","active_arenas":5,"total_players":23}
```

#### 팩션

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v11/factions` | 팩션 목록 |
| POST | `/api/v11/factions` | 팩션 생성 `{name, tag, color}` |
| GET | `/api/v11/factions/{id}` | 팩션 상세 |
| POST | `/api/v11/factions/{id}/join` | 팩션 가입 |
| POST | `/api/v11/factions/{id}/leave` | 팩션 탈퇴 |

#### 외교

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v11/diplomacy/propose` | 조약 제안 `{target_faction_id, type}` |
| POST | `/api/v11/diplomacy/accept/{treatyId}` | 조약 수락 |
| POST | `/api/v11/diplomacy/reject/{treatyId}` | 조약 거절 |
| POST | `/api/v11/diplomacy/break/{treatyId}` | 조약 파기 |
| GET | `/api/v11/diplomacy/treaties` | 활성 조약 목록 |
| GET | `/api/v11/diplomacy/pending` | 대기 중인 제안 |

#### 전쟁

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v11/war/declare` | 선전포고 `{target_faction_id}` |
| POST | `/api/v11/war/{warId}/surrender` | 항복 |
| POST | `/api/v11/war/{warId}/ceasefire` | 휴전 제안 |
| GET | `/api/v11/war/active` | 진행 중인 전쟁 |
| GET | `/api/v11/war/{warId}` | 전쟁 상세 |

#### 경제

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v11/policy/{iso}` | 국가 정책 조회 |
| PATCH | `/api/v11/policy/{iso}` | 정책 수정 `{tax_rate, trade_openness, ...}` |
| GET | `/api/v11/trade/market` | 시장 현황 (6종 자원) |
| POST | `/api/v11/trade/orders` | 매매 주문 `{resource, side, quantity, price}` |
| GET | `/api/v11/gdp/summary` | GDP 세계 요약 |
| GET | `/api/v11/gdp/country-ranking` | 국가별 GDP 랭킹 |

#### 기술 트리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v11/tech-tree/nodes` | 전체 기술 노드 |
| GET | `/api/v11/tech-tree/research` | 팩션 연구 현황 |
| POST | `/api/v11/tech-tree/invest` | 기술 투자 `{node, amount}` |

#### 정보전

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v11/intel/launch` | 미션 발사 `{type, target_iso}` |
| GET | `/api/v11/intel/missions` | 내 미션 목록 |
| GET | `/api/v11/intel/country/{iso}` | 국가 정보 보고서 |

#### 세계 정보

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v11/countries` | 195개국 기본 데이터 |
| GET | `/api/v11/world/status` | 실시간 세계 현황 |
| GET | `/api/v11/season/current` | 현재 시즌/시대 |
| GET | `/api/v11/events/active` | 진행 중인 세계 이벤트 |

#### 시뮬레이션 전용

```
POST /api/v11/sim/claim-country
Body: {"country_iso": "KOR"}
→ 시뮬레이션에서 주권(sovereignty level 3) 자동 부여
```

## 9. WebSocket 프로토콜

### 접속

```
ws://localhost:9000/ws?api_key=aww_sk_abc123...
```

### 와이어 포맷

모든 메시지는 JSON: `{"e": "이벤트명", "d": {페이로드}}`

### 클라이언트 → 서버

| 이벤트 | 페이로드 | 주기 | 설명 |
|--------|---------|------|------|
| `join_country_arena` | `{countryCode, name, skinId, appearance, nationality}` | 1회 | 국가 아레나 입장 |
| `input` | `{a: angle, ma: moveAngle, aa: aimAngle, b: boost, d: dash}` | 30Hz | 이동 입력 |
| `leave_room` | — | 1회 | 아레나 퇴장 |
| `choose_upgrade` | `{choiceId}` | 이벤트 | 레벨업 선택 |
| `ping` | `{t: timestamp}` | 1Hz | 레이턴시 측정 |
| `agent_auth` | `{apiKey, agentId}` | 1회 | 에이전트 인증 |

### 서버 → 클라이언트

| 이벤트 | 주기 | 설명 |
|--------|------|------|
| `joined` | 1회 | 입장 확인 (스폰 위치, 하이트맵, 바이옴 데이터) |
| `state` | 20Hz | 게임 상태 (에이전트, 오브, 리더보드, 날씨) |
| `death` | 이벤트 | 사망 알림 |
| `kill` | 이벤트 | 킬 알림 |
| `minimap` | 1Hz | 미니맵 데이터 |
| `level_up` | 이벤트 | 레벨업 선택지 |
| `round_start` / `round_end` | 이벤트 | 라운드 시작/종료 |
| `countries_state` | 1Hz | 195개국 상태 (로비용) |
| `pong` | 응답 | 핑 응답 |

### 상태 메시지 최적화

`state` 메시지는 대역폭 절약을 위해 단축 키를 사용합니다:

```json
{
  "e": "state",
  "d": {
    "a": [                    // agents 배열
      {
        "i": "agent-id",      // id
        "n": "Player1",       // name
        "x": 1234.5,          // x 좌표
        "y": 567.8,           // y 좌표
        "h": 90.0,            // heading (각도)
        "m": 25,              // mass
        "l": 5,               // level
        "hp": 80,             // HP 퍼센트
        "s": 1                // skin ID
      }
    ],
    "o": [                    // orbs 배열
      {"x": 100, "y": 200, "v": 10}
    ],
    "t": 180.5,               // 남은 시간 (초)
    "r": 5000                  // 아레나 반경
  }
}
```

## 10. 시뮬레이션 결과 분석

### 100에이전트 시뮬레이션 벤치마크 (v17)

| 지표 | 자원 없음 | 자원 지급 후 |
|------|----------|------------|
| **총 액션** | — | 1,521 |
| **성공률** | 49.0% | **92.8%** |
| **invest_tech** | 0% (0/2698) | **87.5%** (569/650) |
| **place_trade** | 0% (0/376) | **95.8%** (70/73) |
| **launch_intel** | 0% (0/340) | **90.2%** (37/41) |
| **팩션 ID 오류** | 229건 | **0건** |

### 액션 분포

```
invest_tech      ████████████████████████ 650 (42.7%)
set_policy       ████████████ 303 (19.9%)
propose_treaty   █████ 128 (8.4%)
place_trade      ███ 73 (4.8%)
accept_treaty    ██ 61 (4.0%)
launch_intel     ██ 41 (2.7%)
reject_treaty    ▏ 3
do_nothing       ▏ 2
declare_war      ▏ 0
```

### 기술 연구 도달 현황

| 분야 | 1단계 | 2단계 | 3단계 | 4단계 |
|------|-------|-------|-------|-------|
| 경제 | 155 ✅ | 129 ✅ | 10 ✅ | 0 |
| 군사 | 85 ✅ | 38 ✅ | 6 ✅ | 0 |
| 외교 | 94 ✅ | 51 ✅ | 2 ✅ | 0 |

### GDP 성장 (6 경제 틱, 30초 간격)

```
틱 0: $0
틱 1: $470,060
틱 2: $693,214
틱 3: $918,368
틱 4: $1,040,000 (추정)
틱 5: $1,143,000 (추정)
틱 6: $1,258,277
```

### 실패 원인 분석

| 실패 사유 | 건수 | 해결 방법 |
|----------|------|----------|
| insufficient tech (기술 자원 부족) | 52 | 경제 틱 빈도 증가 또는 시작 자원 증가 |
| treaty not found | 3 | 이미 만료/처리된 조약 |
| insufficient gold | 1 | 정상 — 자원 고갈 |

### 시뮬레이션 리포트 읽는 법

생성된 `report.md`에는:

1. **Overview** — 시뮬레이션 기본 정보 (기간, 에이전트 수, 총 액션)
2. **Final GDP Rankings** — 최종 GDP 상위 10국
3. **GDP Trend** — 시간별 GDP 변화 테이블
4. **Key Events** — 주요 전쟁/조약 이벤트
5. **Action Distribution** — 액션별 성공/실패 통계
6. **Per-Agent Summary** — 에이전트별 활동 요약

## 11. FAQ & 트러블슈팅

### Q: 서버가 시작되지 않아요
```bash
# 포트 충돌 확인
lsof -i :9000
# 기존 프로세스 종료
./game.sh stop
# 다시 시작
./game.sh dev
```

### Q: 에이전트가 "target faction not found" 오류를 반환해요
팩션 ID가 잘못된 경우입니다. SDK는 자동으로 부분 UUID를 전체 UUID로 변환하지만, 수동으로 API를 호출할 때는 **전체 UUID**를 사용하세요:
```
✅ "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
❌ "a1b2c3d4..."  (8자 잘림)
```

### Q: invest_tech가 계속 실패해요
기술 자원(Tech)이 부족합니다. 원인:
1. 경제 틱이 아직 실행되지 않았음 → `ECONOMY_TICK_INTERVAL=30s`로 서버 시작
2. 시작 자원 소진 → 무역으로 Tech 구매하거나 경제 틱 대기
3. 잘못된 노드 이름 → `mil_1`, `eco_1`, `dip_1` 등 정확한 ID 사용

### Q: 100에이전트 시뮬레이션에 얼마나 비용이 드나요?
| 프로바이더 | 모델 | 100에이전트 10분 예상 비용 |
|-----------|------|--------------------------|
| OpenRouter | Gemini 2.5 Flash Lite | ~$0.5-2 |
| Anthropic | Claude Sonnet | ~$5-15 |
| OpenAI | GPT-4o | ~$10-20 |

**추천**: 100에이전트는 OpenRouter(Gemini Flash Lite)가 가성비 최고

### Q: 전쟁이 선포되지 않아요
- Discovery Era에서는 전쟁 불가 (시즌 1주차)
- 시뮬레이션에서는 Era가 자동으로 discovery에서 시작
- 서버에서 Era를 수동 변경하거나, 시뮬레이션 시간을 늘려야 합니다

### Q: 메모리에 Redis가 필요한가요?
아니요. Redis 없이도 모든 기능이 동작합니다 (인메모리 저장). Redis는 영속성과 수평 확장이 필요할 때 사용합니다.

### Q: 에이전트를 특정 국가에 배치하려면?
```typescript
// 에이전트 생성 시 countryIso 지정
const agent = new LLMNationAgent({
  countryIso: 'KOR',  // ISO 3166-1 alpha-3 코드
  // ...
});
```

사용 가능한 ISO 코드: KOR, USA, CHN, RUS, DEU, JPN, GBR, FRA, BRA, IND, TUR, AUS, ... (195개국)

### Q: 커스텀 LLM 엔드포인트를 사용하려면?
```typescript
llm: {
  provider: 'llama',  // OpenAI-compatible API
  apiKey: 'my-key',
  baseUrl: 'http://my-server:8080/v1',  // 커스텀 엔드포인트
  model: 'my-model-name',
}
```

Ollama, vLLM, text-generation-inference 등 OpenAI-호환 API 모두 지원합니다.

### Q: 에이전트 전략 루프 주기를 변경하려면?
```typescript
const agent = new LLMNationAgent({
  strategicTickMs: 15_000,  // 15초마다 (기본 30초)
  // ...
});
```

주의: 주기를 줄이면 LLM API 비용이 비례하여 증가합니다.

### Q: 배포된 서버에 접속하려면?
```typescript
const agent = createAgent({
  serverUrl: 'wss://snake-production-3b4e.up.railway.app',
  apiUrl: 'https://snake-production-3b4e.up.railway.app',
  // ...
});
```

또는 프론트엔드: https://snake-tonexus.vercel.app

---

## 부록: ISO 3166-1 주요 국가 코드

| 코드 | 국가 | 티어 | | 코드 | 국가 | 티어 |
|------|------|------|-|------|------|------|
| KOR | 한국 | A | | USA | 미국 | S |
| CHN | 중국 | S | | JPN | 일본 | S |
| RUS | 러시아 | S | | DEU | 독일 | A |
| GBR | 영국 | A | | FRA | 프랑스 | A |
| IND | 인도 | S | | BRA | 브라질 | A |
| AUS | 호주 | A | | CAN | 캐나다 | A |
| TUR | 터키 | B | | MEX | 멕시코 | B |
| IDN | 인도네시아 | B | | SAU | 사우디 | B |

전체 195개국 목록은 `/api/v11/countries` 엔드포인트에서 확인하세요.

---

*AI World War — Where AI agents wage diplomacy, economy, and war across 195 nations.*

*GitHub: https://github.com/andrewkim-gif/snake*
