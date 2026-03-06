# AI World War — AI 에이전트 국가 전쟁 (v11)

> **Version**: v11.0 (World War Redesign)
> **Date**: 2026-03-06
> **Status**: DRAFT — Strategic Plan
> **Based on**: v10 AI World War + SuperPower 2/Politics and War/CitiesWar/Territorial.io 참고
> **Game Name**: **AI World War** (구 AI World War → 리브랜딩)
> **Core Shift**: Room-based Arena → **Real World Map + Country Arenas + Geopolitical Meta-Game**
> **Tech Stack**: Go 1.24 (서버) / Next.js 15 + MapLibre GL + R3F (클라이언트) / PostgreSQL + Redis (영속성) / **CROSS Mainnet + CROSSx SDK + CROSS GameToken DEX (블록체인)**
> **Roadmap**: [`docs/designs/v11-world-war-roadmap.md`](v11-world-war-roadmap.md)

---

## 1. Vision & Core Concept

### 1.1 한 줄 요약

> **"AI World War" — AI 에이전트가 실제 세계지도 위에서 국가를 정복하고, 경제를 운영하며, 역사를 쓰는 멀티플레이어 전략 서바이벌**

### 1.2 핵심 컨셉

기존 v10의 "룸 기반 아레나 전투"를 **세계지도 기반 국가 전쟁**으로 확장.
각 국가가 하나의 전투 아레나이며, 5분 전투 사이클의 결과가 세계 정세를 바꾼다.

```
기존 v10:  [Room 1] [Room 2] ... [Room 5]  ← 독립된 룸, 의미 없는 결과
v11:       [🌍 World Map] → [🇰🇷 Korea Arena] → [전투 결과] → [영토 지배권 변경] → [경제/정치 영향]
                         → [🇯🇵 Japan Arena]  → [전투 결과] → [영토 지배권 변경]
                         → [🇺🇸 USA Arena]    → ...
```

### 1.3 게임 아이덴티티: 왜 독보적인가?

| 참고 게임 | 그 게임의 핵심 | AI World War가 다른 점 |
|-----------|---------------|------------------------|
| **SuperPower 2** | 193국 정치/경제/군사 시뮬레이션 | 우리는 **실시간 액션 전투**가 있음 (메뉴 클릭 X) |
| **Politics and War** | 브라우저 국가 경영 MMO | 우리는 **AI 에이전트가 자율 전투** + 유저 개입 가능 |
| **CitiesWar** | Google Maps 기반 영토 전쟁 | 우리는 **로그라이크 빌드 시스템**이 전투 결과 좌우 |
| **Territorial.io** | 실시간 영토 확장 | 우리는 **영속 경제/외교 시스템** + 월간 시즌 |
| **Ages of Conflict** | AI 국가 시뮬레이션 | 우리는 **멀티플레이어** + 유저 직접 참전 가능 |

**Unique Selling Point**:
> "AI 에이전트가 로그라이크 전투로 국가를 정복하고, 유저는 전략가/관전자/전사 중 선택.
> 월간 시즌마다 세계가 리셋되어, 당신의 에이전트가 역사에 이름을 남긴다."

### 1.4 "Agent"의 삼중 의미 (v11 확장)

1. **게임 캐릭터**: MC 스타일 전투 유닛 — 아레나에서 싸우는 캐릭터
2. **AI 에이전트**: Claude/GPT/커스텀 LLM — API로 전략을 실행하는 자율 플레이어
3. **국가 대리인**: 유저의 의지를 대행하는 대리인 — 국가를 정복하고 통치하는 존재

### 1.5 v10 → v11 핵심 변화

| 항목 | v10 (AI World War) | v11 (World Domination) |
|------|---------------------|----------------------|
| **맵 구조** | 5개 독립 Room | **195개 국가 = 195개 Arena** |
| **게임 목표** | 5분 라운드 생존 | **국가 정복 → 세계 지배** |
| **결과 의미** | 라운드 우승 (일회성) | **영토 지배권 + 경제/정치 영향** |
| **경제** | 없음 | **국가별 GDP/자원/무역** |
| **외교** | 없음 | **동맹/조약/제재/전쟁 선포** |
| **영속성** | 인메모리 (리셋) | **PostgreSQL + Redis (시즌 단위 영속)** |
| **메타 게임** | 없음 | **세계지도 + 팩션 경쟁 + 시즌 랭킹** |
| **유저 역할** | 플레이어/관전자 | **전략가/관전자/직접 전투/외교관** |
| **AI 역할** | 전투 AI | **전투 + 경제 정책 + 외교 판단** |

### 1.6 Success Metrics

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| DAU (일일 활성 유저) | 1,000+ | 로그인 + 1회 이상 액션 |
| 동시접속 에이전트 | 10,000+ (봇 포함) | 전체 아레나 내 활성 에이전트 |
| 평균 세션 시간 | 15분+ | 맵 탐험 + 전투 관전 + 전략 설정 |
| 시즌 완주율 | 40%+ | 시즌 시작~종료까지 활동 유지 |
| 팩션 참여율 | 70%+ | 팩션 소속 유저 비율 |
| Agent API 사용률 | 30%+ | API 키 발급 + 1회 이상 에이전트 배치 |
| 국가 지배 다양성 | 10+ 팩션 | 시즌 중 5개국 이상 지배한 팩션 수 |

## 2. Game Design Overview — 게임 구조 3레이어

게임은 3개의 레이어로 구성된다. 각 레이어는 독립적이면서 상호 영향을 주고받는다.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: META GAME (세계 전략)                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🌍 World Map  →  팩션 경쟁  →  외교/동맹  →  시즌 랭킹     │    │
│  │  영토 지배권  →  경제 운영  →  전쟁 선포  →  역사 기록       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       ▲ 전투 결과가 메타 게임에 영향                    │ 전략이 전투에 영향│
│       │                                               ▼            │
│  Layer 2: BATTLE (국가 아레나 전투)                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🏟️ Country Arena (5분)  →  자동전투  →  XP/레벨업  →  빌드  │    │
│  │  → 아레나 수축  →  최후 생존  →  지배권 결정                  │    │
│  │  [v10 코어 루프 유지: 이동→전투→XP→레벨업→Tome/Ability→시너지] │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       ▲ 에이전트 배치                               │ 전투 결과       │
│       │                                               ▼            │
│  Layer 1: AGENT (에이전트 관리)                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🤖 Agent Training  →  빌드 프로필  →  전략 설정  →  배치    │    │
│  │  API 인증  →  LLM 연동  →  Commander Mode  →  보상 수령     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 유저 역할 (4가지 플레이 스타일)

| 역할 | 설명 | 핵심 활동 |
|------|------|----------|
| **🎖️ Strategist (전략가)** | 에이전트를 훈련하고 배치하는 코치 | 빌드 프로필 설정, 국가 선택, 전쟁 타이밍 |
| **👁️ Observer (관전자)** | 세계를 탐험하고 전투를 관전 | 맵 탐험, 라이브 전투 관전, 통계 분석 |
| **⚔️ Warrior (전사)** | 직접 전투에 참여하는 플레이어 | 마우스/키보드로 실시간 전투 개입 |
| **🏛️ Governor (총독)** | 지배한 국가의 정치/경제 운영 | 세율 설정, 무역 정책, 외교 협상 |

> 한 유저가 모든 역할을 동시에 수행 가능. 핵심은 **"에이전트를 배치하고 결과를 지켜보는"** 루프.

### 2.2 시간 루프

```
매 5분:  [전투 사이클] → 국가별 아레나 전투 → 생존자 결정 → 지배권 업데이트
매 1시간: [경제 틱] → 국가별 자원 생성 → 무역 정산 → GDP 업데이트
매 24시간: [외교 틱] → 조약 갱신 → 제재 효과 → 인구 변동
매 1주:   [에라 전환] → 시즌 페이즈 변경 (개척→확장→전쟁→결산)
매 1개월: [시즌 리셋] → 세계 초기화 → 명예의 전당 기록 → 새 시즌 시작
```

## 3. World Map System — 실제 세계지도

### 3.1 맵 데이터 소스

실제 세계지도를 GeoJSON으로 구현. Natural Earth Data 기반 195개국 경계선 + 주요 지형.

```yaml
Data_Source:
  Countries: Natural Earth 110m (simplified GeoJSON, ~195 countries)
  Detail: Natural Earth 50m (zoom-in 시 상세 경계)
  Capitals: 각 국가 수도 좌표 (아레나 진입점)
  Neighbors: TopoJSON adjacency (인접 국가 자동 계산)

Rendering:
  Library: MapLibre GL JS (오픈소스, Mapbox 호환)
  Style: Custom dark theme (게임 테마 맞춤)
  Projection: Web Mercator (표준)
  Interaction: 클릭/호버/줌 → 국가 선택 → 아레나 진입
```

### 3.2 국가 등급 시스템

195개국을 모두 동등하게 취급하면 밸런스 붕괴. **5개 등급**으로 분류:

| 등급 | 국가 수 | 아레나 크기 | 최대 에이전트 | 자원 배율 | 전략적 가치 | 예시 |
|------|---------|-----------|-------------|----------|-----------|------|
| **S (Superpower)** | 8 | 6000×6000 | 50 | ×3.0 | 최고 — 쟁탈전 핵심 | 미국, 중국, 러시아, 인도, 브라질, 일본, 독일, 영국 |
| **A (Major)** | 20 | 4500×4500 | 35 | ×2.0 | 높음 — 강력한 거점 | 한국, 프랑스, 캐나다, 호주, 사우디, 터키 등 |
| **B (Regional)** | 40 | 3500×3500 | 25 | ×1.5 | 중간 — 지역 패권 | 이집트, 태국, 폴란드, 멕시코, 인도네시아 등 |
| **C (Standard)** | 80 | 2500×2500 | 15 | ×1.0 | 보통 — 일반 영토 | 대부분의 국가 |
| **D (Minor)** | ~47 | 1500×1500 | 8 | ×0.5 | 낮음 — 전략적 완충지대 | 소국, 도서국 |

### 3.3 국가 고유 속성 (실제 데이터 기반)

각 국가는 실제 데이터를 기반으로 고유 속성을 가짐:

```typescript
interface CountryData {
  id: string;              // ISO 3166-1 alpha-3 (e.g. "KOR")
  name: string;            // 한국
  tier: "S" | "A" | "B" | "C" | "D";
  capital: [number, number]; // [lat, lng] 수도 좌표
  neighbors: string[];     // 인접 국가 ID (육지/해상 경계)

  // 자원 프로필 (실제 데이터 기반, 0~100 정규화)
  resources: {
    oil: number;           // 석유 (사우디 100, 한국 5)
    minerals: number;      // 광물 (호주 90, 일본 10)
    food: number;          // 식량 (미국 95, 싱가포르 10)
    tech: number;          // 기술 (한국 95, 에티오피아 15)
    manpower: number;      // 인력 (인도 100, 룩셈부르크 5)
  };

  // 지형 보너스 (아레나 전투에 영향)
  terrain: {
    defense_bonus: number; // 산악/섬 = 높음, 평지 = 낮음
    arena_theme: string;   // "urban" | "desert" | "forest" | "arctic" | "island" | "mountain"
  };

  // 전략적 위치
  strategic: {
    trade_routes: number;  // 무역 루트 수 (해상/육상 교차점)
    chokepoint: boolean;   // 전략적 요충지 (파나마, 수에즈, 말라카 등)
  };
}
```

### 3.4 세계지도 UI/UX

```
┌──────────────────────────────────────────────────────────────┐
│  🌍 AI WORLD WAR          Season 3, Week 2│
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │              [MapLibre GL World Map]                    │  │
│  │                                                        │  │
│  │   🟢 내 팩션 영토   🔴 적 팩션 영토   ⬜ 미점령        │  │
│  │   🔥 전투 중        ⚡ 전투 대기       🛡️ 방어 중       │  │
│  │                                                        │  │
│  │   [국가 클릭] → 국가 정보 패널 + 아레나 진입 버튼       │  │
│  │   [국가 호버] → 툴팁 (소유 팩션, GDP, 활성 에이전트)    │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ My Agents │ │ Factions │ │ Economy  │ │ History  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 국가 색상 체계

```yaml
Sovereignty_Colors:
  unclaimed: "#4A4A4A"     # 미점령 — 회색
  my_faction: "#22C55E"    # 내 팩션 — 초록
  ally_faction: "#3B82F6"  # 동맹 팩션 — 파랑
  neutral: "#F59E0B"       # 중립 — 노랑
  enemy: "#EF4444"         # 적대 — 빨강
  at_war: "#FF0000"        # 전쟁 중 — 강조 빨강 (깜빡 애니메이션)

Battle_Status_Overlay:
  idle: 없음
  preparing: "⚡ 황색 펄스 (5초 전)"
  in_battle: "🔥 불꽃 파티클 + 경계 깜빡"
  cooldown: "🛡️ 반투명 실드"
```

## 4. Battle System — 국가 아레나 전투 (5분 사이클)

v10의 코어 전투 루프를 **그대로 유지**하면서, 국가 아레나 컨텍스트를 추가.

### 4.1 전투 사이클 (5분)

```
시간축:  0:00 ─────── 1:00 ─────── 2:00 ─────── 3:00 ─────── 4:00 ─────── 5:00
         │             │             │             │             │             │
         ▼             ▼             ▼             ▼             ▼             ▼
      [배치 페이즈]  [수축 1차]    [수축 2차]    [수축 3차]    [수축 4차]    [결산]
       10초 준비     -600px        -600px        -600px        -600px       승자 결정
       에이전트      자원 생성      중간 보상     전투 격화     최종 수축     지배권 전이
       스폰         1차 충돌       빌드 분화     고레벨 대전    서든데스

전투 결과 → 점수 산정:
  생존 = Base 100점 + (킬 × 15) + (레벨 × 10) + (데미지 × 0.5)
  사망 = (킬 × 15) + (레벨 × 10) + (데미지 × 0.5) + (생존시간 × 2)
```

### 4.2 전투 유형 (5종)

| 전투 유형 | 트리거 | 참가자 | 특수 규칙 | 지배권 변동 |
|----------|--------|--------|----------|-----------|
| **🏟️ Arena Battle** | 자동 (5분마다) | 국가 내 배치된 에이전트 | 표준 v10 룰 | 1위 팩션이 지배 |
| **⚔️ Border Skirmish** | 인접국 긴장도 50%+ | 양측 국가 에이전트 각 10명 | 작은 아레나, 3분 | 승리국이 패배국 자원 약탈 |
| **🏰 Siege Battle** | 전쟁 선포 후 24시간 | 공격 팩션 vs 방어 팩션 | 방어 보너스 +30% | 승리 시 국가 소유권 전이 |
| **🌍 World War Event** | 주간 이벤트 (주말) | 전 팩션 참여 가능 | 대규모 아레나, 100명 | 특별 보상 + 시즌 점수 |
| **👑 Capital Siege** | 수도 공격 | 팩션 전체 동원 | 최대 규모, 7분 | 수도 함락 = 팩션 영토 30% 상실 |

### 4.3 전투 참가 방식

```yaml
Agent_Deployment (에이전트 배치):
  - 유저는 에이전트를 특정 국가에 "배치"
  - 배치된 에이전트는 해당 국가의 다음 전투에 자동 참전
  - 배치 비용: 거리에 비례 (본국 = 무료, 원거리 = Oil 소모)
  - 배치 제한: 유저당 최대 3개 국가에 동시 배치

Human_Intervention (유저 직접 참전):
  - 전투 시작 후 30초 이내에 "Join Battle" 가능
  - 유저가 마우스/키보드로 직접 에이전트 조종
  - AI 자동전투 → 수동 전환 (Commander Mode)
  - 직접 참전 시 보상 ×1.5 배율

Pure_AI (완전 자동):
  - 에이전트가 설정된 빌드 프로필에 따라 자동 전투
  - OpenClaw/MoltBot 방식: API 키로 인증, 전투 로그 실시간 스트리밍
  - LLM이 레벨업 선택, 타겟팅, 포지셔닝 결정
```

### 4.4 전투 아레나 테마 (국가별 지형)

v10의 MC 비주얼 스타일을 유지하면서, 국가 지형에 따라 아레나 테마 변경:

| 테마 | 지형 블록 | 특수 효과 | 적용 국가 |
|------|----------|----------|----------|
| **🌲 Forest** | 잔디+참나무+이끼석 | 은폐 보너스: 나무 뒤 데미지 -20% | 한국, 일본, 독일, 캐나다 |
| **🏜️ Desert** | 모래+사암+선인장 | 이동속도 -10%, 시야 +20% | 사우디, 이집트, 호주 내륙 |
| **🏔️ Mountain** | 돌+설원+빙하 | 고지대 보너스: DPS +15%, 이동 -15% | 스위스, 네팔, 칠레 |
| **🏙️ Urban** | 콘크리트+강철+유리 | 벽 엄폐: 원거리 데미지 -30% | 미국, 영국, 프랑스, 한국 |
| **❄️ Arctic** | 눈+얼음+빙하 | 이동속도 -20%, 오브 생성 -30% | 러시아, 캐나다 북부, 노르웨이 |
| **🌴 Island** | 모래+야자수+산호 | 아레나 작음, 수축 빠름 | 일본, 인도네시아, 필리핀 |

### 4.5 전투 보상 시스템

```yaml
Individual_Rewards (개인 보상):
  survival_bonus: 100 Gold (생존)
  kill_bonus: 15 Gold per kill
  level_bonus: 10 Gold per level reached
  mvp_bonus: 200 Gold (최다 킬 or 최고 데미지)
  streak_bonus: 50/100/300 Gold (3/5/10 연승)

Faction_Rewards (팩션 보상):
  territory_control: 해당 국가 지배권 (5분간)
  resource_income: 국가 자원 배율 × 시간
  prestige_points: 시즌 랭킹 점수

Special_Conditions:
  underdog_bonus: "×2.0 보상" (하위 50% 팩션이 S급 국가 점령)
  defense_bonus: "×1.5 보상" (본국 방어 성공)
  first_blood: "100 Gold" (시즌 첫 점령)

## 5. Territory & Sovereignty — 영토 지배권

### 5.1 지배권 결정 메커니즘

```
전투 종료 → 점수 집계 → 팩션별 합산 → 최고 팩션이 지배권 획득

팩션 점수 = Σ (소속 에이전트의 개인 점수)

지배권 전이 조건:
  1. 기존 지배 팩션의 점수보다 20% 이상 높아야 전이 (방어 우위)
  2. 무주지(미점령)는 1위 팩션이 무조건 획득
  3. 동점 시 기존 지배 팩션 유지 (방어 우위)
  4. 단일 에이전트로 점령 불가 — 최소 3명의 에이전트 필요
```

### 5.2 지배 등급 (Sovereignty Level)

지배권을 연속 유지하면 등급 상승 → 보너스 증가:

| 등급 | 연속 유지 | 보너스 | 특권 |
|------|----------|--------|------|
| **Lv.1 Occupied** | 1회 | +0% | 자원 수집만 가능 |
| **Lv.2 Controlled** | 3회 (15분) | +10% 자원 | 국가 이름 변경 가능 |
| **Lv.3 Governed** | 12회 (1시간) | +25% 자원 | 경제 정책 설정 가능 |
| **Lv.4 Established** | 48회 (4시간) | +50% 자원 | 방어 시설 건설 가능 |
| **Lv.5 Capital** | 144회 (12시간) | +100% 자원 | 수도 지정 가능, 팩션 특수 능력 해금 |

### 5.3 수도(Capital) 시스템

```yaml
Capital_Rules:
  - 각 팩션은 1개의 수도를 지정 가능
  - 수도 지정 조건: Lv.5 Established 달성 국가
  - 수도 보너스:
    - 방어 보너스 +50%
    - 자원 생산 ×2
    - 팩션 전체 에이전트 +5% 스탯 버프
    - 수도 함락 시 팩션 영토 30% 자동 상실 (사기 붕괴)

Capital_Siege:
  - 수도 공격은 특수 전투 (7분, 확대 아레나)
  - 공격 팩션: 48시간 전 전쟁 선포 필요
  - 방어 팩션: 전체 소속 에이전트 자동 방어 소집
  - 수도 함락 = 게임 내 최대 이벤트 (전 서버 알림)
```

### 5.4 국가 커스터마이징 (지배자 특권)

Lv.2+ 지배 팩션은 국가를 커스터마이징 가능:

| 커스텀 항목 | Lv.2 | Lv.3 | Lv.4 | Lv.5 |
|------------|------|------|------|------|
| 국가 이름 변경 | ✅ | ✅ | ✅ | ✅ |
| 국기(배너) 설정 | ❌ | ✅ | ✅ | ✅ |
| 세율 설정 | ❌ | ✅ | ✅ | ✅ |
| 무역 정책 | ❌ | ❌ | ✅ | ✅ |
| 방어 시설 건설 | ❌ | ❌ | ✅ | ✅ |
| 아레나 테마 변경 | ❌ | ❌ | ❌ | ✅ |
| 수도 지정 | ❌ | ❌ | ❌ | ✅ |

## 6. Economy System — 국가 경제

SuperPower 2의 경제 시뮬레이션 + CitiesWar의 자원 시스템을 참고한 **간소화된 국가 경제**.

### 6.1 자원 체계 (6종)

| 자원 | 아이콘 | 용도 | 주요 생산국 |
|------|--------|------|-----------|
| **Food** | 🌾 | 에이전트 HP 회복, 인구 유지 | 미국, 브라질, 인도, 프랑스 |
| **Oil** | 🛢️ | 에이전트 이동/배치, 전쟁 비용 | 사우디, 러시아, 미국, 이라크 |
| **Steel** | ⚙️ | 장비 제작, 방어 시설 건설 | 중국, 인도, 일본, 한국 |
| **Tech** | 💡 | 에이전트 업그레이드, 연구 | 한국, 미국, 일본, 독일, 이스라엘 |
| **Gold** | 💰 | 범용 화폐, 무역, 팩션 재정 | 전투 보상, 국가 세수, 무역 |
| **Influence** | ⭐ | 외교, 동맹, 글로벌 이벤트 투표 | 지배 국가 수 × 등급 기반 |

### 6.2 자원 생성 공식

```
국가 자원 생산 (1시간당) = base_resource[country] × tier_multiplier × sovereignty_level_bonus

예시: 한국 (A등급, Tech 95, Lv.3 지배)
  Tech 생산 = 95 × 2.0 (A등급) × 1.25 (Lv.3) = 237.5 Tech/hour

자원 분배:
  팩션 재정: 50% (팩션 공동 자원)
  지배자 수익: 30% (지배 팩션 리더)
  전투 참가자: 20% (해당 국가 전투 참가 에이전트에 분배)
```

### 6.3 경제 정책 (지배자 설정)

Lv.3+ 지배자가 설정 가능한 경제 정책:

| 정책 | 범위 | 효과 | 트레이드오프 |
|------|------|------|------------|
| **세율** | 0%~50% | 팩션 Gold 수입 증가 | 높으면 에이전트 이탈 (타국 이동) |
| **무역 개방도** | 0%~100% | 자원 수출입 허용 | 높으면 제재에 취약 |
| **군비 지출** | 0%~50% | 방어 보너스 증가 | GDP 감소 (자원 생산 하락) |
| **기술 투자** | 0%~30% | Tech 생산 보너스 | 단기 자원 감소 |
| **외교 비용** | 0%~20% | Influence 생산 증가 | Gold 소모 |

### 6.4 무역 시스템

```yaml
Trade_Market:
  - 글로벌 자원 거래소 (팩션 간)
  - 실시간 수요/공급 기반 가격 변동
  - 자원별 교환 비율 (Oil ↔ Tech = 시장 가격)
  - 무역 제재: 적대 팩션은 거래 차단 가능

Trade_Routes:
  - 해상 무역로 (수에즈, 말라카, 파나마)를 점령한 팩션: 무역 수수료 징수
  - 육상 무역: 인접 국가만 직접 무역 가능
  - 원거리 무역: Oil 비용 증가

Example:
  한국(Tech 풍부) ↔ 사우디(Oil 풍부):
  → 한국이 Tech 50을 수출하고 Oil 30을 수입
  → 말라카 해협 경유 시 해협 지배 팩션에 수수료 5% 지불
```

### 6.5 국가 GDP 산정

```
GDP = Σ(resource_production × market_price) + trade_income - military_cost

GDP Ranking → 시즌 점수에 반영
  경제 승리 조건: 시즌 종료 시 GDP 1위 = "Economic Superpower" 칭호
```

## 7. Faction & Diplomacy — 팩션 · 외교 · 동맹

### 7.1 팩션 (Faction) 시스템

Politics and War의 동맹 시스템 + SuperPower 2의 외교를 참고.

```yaml
Faction_Structure:
  creation_cost: 1000 Gold
  min_members: 3
  max_members: 50
  hierarchy:
    - Supreme Leader (1명): 팩션 최고 권한, 외교 결정
    - Council (최대 5명): 경제/군사/외교 담당 장관
    - Commander (최대 10명): 전투 지휘, 에이전트 배치 권한
    - Member: 일반 팩션원, 전투 참여

Faction_Stats:
  territory_count: 지배 국가 수
  total_gdp: 팩션 전체 GDP
  military_power: 활성 에이전트 전투력 합산
  prestige: 시즌 누적 업적 점수
  influence: 외교/투표 영향력
```

### 7.2 외교 행동 (Diplomatic Actions)

| 외교 행동 | 비용 | 효과 | 지속 | 해지 조건 |
|----------|------|------|------|----------|
| **🤝 Non-Aggression Pact** | 100 Influence | 상호 공격 불가 | 72시간 | 쌍방 합의 or 만료 |
| **📜 Trade Agreement** | 50 Influence | 무역 수수료 -50% | 168시간 | 일방 파기 가능 (패널티) |
| **⚔️ Military Alliance** | 200 Influence | 공동 방어, 정보 공유 | 무기한 | 투표 해산 or 배신 |
| **🚫 Economic Sanction** | 150 Influence | 대상 무역 차단 | 48시간 | 발동 팩션 결정 |
| **📢 War Declaration** | 300 Influence + 500 Oil | 상대 영토 Siege 가능 | 전쟁 종결까지 | 항복 or 수도 함락 |
| **🏳️ Surrender** | 영토 20% 양도 | 전쟁 즉시 종결 | - | - |
| **💰 Tribute** | 자원 X개 | 전쟁 회피 | 48시간 | 자동 만료 |

### 7.3 전쟁 시스템

```
전쟁 선포 조건:
  1. Influence 300 + Oil 500 소모
  2. 48시간 "준비 기간" (양측에 알림)
  3. 준비 기간 중 외교 협상 / 동맹 소집 가능
  4. 준비 기간 종료 후 → 인접 국가 Siege Battle 가능

전쟁 진행:
  - Siege Battle은 24시간마다 1회 가능 (공격 쿨다운)
  - 한 번에 1개 국가만 Siege 가능
  - Siege 승리 → 해당 국가 지배권 즉시 전이
  - Siege 패배 → 24시간 재공격 불가

전쟁 종결:
  A) 항복: 패배 팩션이 영토 20% + 자원 양도
  B) 수도 함락: 패배 팩션 영토 30% 자동 상실 + 팩션 해체 위기
  C) 휴전 협정: 양측 합의, 현 상태 유지 (Influence 100 소모)
  D) 시간 만료: 7일 후 자동 휴전
```

### 7.4 UN 위원회 (Global Council)

```yaml
Council_Composition:
  - S등급 국가 지배 팩션: 상임이사국 (거부권 보유)
  - A등급 국가 지배 팩션: 비상임이사국
  - 기타: 옵저버 (투표 불가)

Votable_Resolutions:
  - "핵 사용 금지": 시즌 내 Capital Siege 비활성화
  - "자유 무역 협정": 전체 무역 수수료 -50%
  - "평화 유지": 48시간 전쟁 선포 금지
  - "경제 제재": 특정 팩션 전체 무역 차단
  - "기후 협약": 자원 생산 -10%, Tech 생산 +20%

Voting_Rules:
  - 과반수 찬성 시 발효
  - 상임이사국 1개 이상 거부 시 부결
  - 결의안 효과: 48~168시간 지속
```

## 8. Agent API & Commander Mode — AI 에이전트 플랫폼

OpenClaw/MoltBot 스타일의 AI 에이전트 플랫폼. 유저가 API 키로 에이전트를 배치하고 관전.

### 8.1 Agent API 개요

```yaml
Authentication:
  - 유저 회원가입 → API 키 발급 (1인당 최대 5개)
  - API 키 = 에이전트 1개 (키 1개 = 에이전트 1기)
  - Rate Limit: 30 req/min per key

API_Endpoints:
  POST /api/agents/deploy          # 에이전트를 국가에 배치
  POST /api/agents/recall           # 에이전트 소환 (배치 해제)
  GET  /api/agents/{id}/status      # 에이전트 상태 (위치, HP, 레벨, 빌드)
  GET  /api/agents/{id}/battle-log  # 최근 전투 로그
  POST /api/agents/{id}/strategy    # 빌드 프로필 + 전략 설정
  WS   /ws/agents/{id}/live         # 실시간 전투 스트림 (WebSocket)

  GET  /api/world/map               # 세계 지도 현황 (지배권, 전투 상태)
  GET  /api/world/countries/{iso}    # 국가 상세 정보
  GET  /api/factions                 # 팩션 목록
  GET  /api/factions/{id}/members    # 팩션원 목록
  GET  /api/seasons/current          # 현재 시즌 정보 + 랭킹
```

### 8.2 에이전트 전략 설정 (Build Profile)

```typescript
interface AgentStrategy {
  // 빌드 우선순위 (v10의 Tome/Ability 선택 AI)
  build_priority: {
    preferred_tomes: ("Blade" | "Aegis" | "Venom" | ...)[];
    preferred_abilities: ("DashStrike" | "ShieldBash" | ...)[];
    synergy_target: string | null;     // 목표 시너지 (e.g. "Glass Cannon")
  };

  // 전투 행동
  combat_behavior: {
    aggression: number;       // 0.0 (수비적) ~ 1.0 (공격적)
    target_priority: "lowest_hp" | "highest_level" | "nearest" | "strongest";
    retreat_threshold: number; // HP% 이하 시 후퇴 (0.1 ~ 0.5)
    use_dash: boolean;        // 대시 킬 시도 여부
  };

  // 배치 전략
  deployment: {
    preferred_countries: string[];  // ISO 코드 우선 국가
    auto_redeploy: boolean;        // 사망 시 자동 재배치
    avoid_s_tier: boolean;         // S급 국가 회피 (초보 보호)
  };
}
```

### 8.3 Commander Mode (유저 직접 개입)

```yaml
Activation:
  - 전투 중 "Take Command" 버튼 (또는 API: POST /api/agents/{id}/command)
  - AI 자동 조종 → 유저 수동 조종으로 전환
  - 전환 시 1초 무적 (전환 딜레이 보호)

Controls (수동 모드):
  - 마우스: 이동 방향 지정
  - Space: 대시 (부스트)
  - 레벨업 시: 3택 카드 직접 선택 (AI 선택 대신)
  - Ability 수동 발동 (쿨다운 관리)

Auto_Return:
  - 유저가 30초간 입력 없으면 → AI 자동 모드 복귀
  - 유저가 명시적으로 "Release Command" 시 복귀
```

### 8.4 LLM 에이전트 연동

```yaml
LLM_Integration:
  - 유저가 LLM API 키를 등록 (Claude, GPT, Llama 등)
  - 레벨업 시 게임 상태를 LLM에 전달 → 업그레이드 선택 응답 수신
  - LLM이 전투 상황 판단하여 전략 동적 조정

LLM_Decision_Points:
  1. 레벨업 선택: "현재 빌드: [Blade×2, Aegis×1]. 선택지: [A, B, C]. 추천?"
  2. 포지셔닝: "적 3명 근접, HP 40%. 후퇴/공격/대시?"
  3. 전략 전환: "남은 시간 1분, 순위 3위. 공격적/수비적?"

LLM_Protocol:
  Request:  { game_state, available_actions, context }
  Response: { chosen_action, reasoning }
  Timeout:  2초 (초과 시 기본 AI 결정)
  Fallback: LLM 실패 시 build_profile 기반 자동 선택
```

## 9. Spectator & Observer Mode — 관전 · 탐험

### 9.1 로비 3D 지구본 (Globe View) ★ NEW

로비 메인 화면에 **실시간 3D 지구본**을 배치. R3F(React Three Fiber) + Three.js Globe로 구현.

```
┌──────────────────────────────────────────────────────────────────┐
│  AI WORLD WAR                 Season 3       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                    [3D 회전 지구본]                         │  │
│  │                                                            │  │
│  │         🇰🇷 ← 내 팩션 국기 꽂힘                             │  │
│  │              🔥 전투 중 이펙트                               │  │
│  │                   🇺🇸 ← 적 팩션 국기                       │  │
│  │                                                            │  │
│  │   [마우스 드래그: 지구본 회전]                                │  │
│  │   [스크롤: 줌인/아웃]                                        │  │
│  │   [국가 클릭: 해당 서버 진입]                                 │  │
│  │   [국기 호버: 팩션 정보 툴팁]                                 │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [내 에이전트] [팩션 관리] [전쟁 현황] [랭킹] [설정]               │
└──────────────────────────────────────────────────────────────────┘
```

**지구본 상세 스펙**:

```yaml
Globe_Rendering:
  library: "three-globe" (Three.js 기반 3D 지구본)
  texture: Natural Earth dark theme (게임 분위기)
  resolution: 110m GeoJSON (국가 경계 표시)
  rotation: 자동 회전 (0.001 rad/frame) + 마우스 드래그 수동 회전
  atmosphere: 푸른 대기 글로우 이펙트

Country_Visualization:
  colors: 팩션 색상으로 국가 영역 채색 (sovereignty_colors 사용)
  borders: 국가 경계선 밝은 선 (팩션 구분)
  height: GDP 기반 국가 높이 extrusion (부유한 국가 = 높이 솟음)

Flag_Markers:
  - 지배 팩션의 국기(커스텀 배너)가 국가 중심에 3D로 꽂힘
  - 원래 국가 국기는 작게 우측 하단에 표시
  - 미점령 국가: 회색 깃발 (물음표)
  - 깃발 애니메이션: 바람에 펄럭이는 효과 (vertex shader)

Battle_Effects:
  - 전투 중 국가: 🔥 불꽃 파티클 + 적색 글로우
  - 전쟁 선포 중: ⚡ 번개 이펙트 (두 국가 사이)
  - 수도: ★ 금색 별 마커 (크게 빛남)
  - 신규 점령: 색상 전환 애니메이션 (2초 스무스)

Interaction:
  hover: 국가 위 마우스 → 팝업 카드 (팩션명, GDP, 에이전트 수, 전투 상태)
  click: 국가 클릭 → 줌인 애니메이션 → 국가 상세 패널 슬라이드
  double_click: 해당 국가 아레나로 직접 진입
  scroll: 지구본 줌인/아웃 (줌인 시 MapLibre 2D 맵으로 전환)
```

### 9.2 관전 모드 (Observer Mode)

```yaml
World_Exploration:
  - 지구본/맵에서 아무 국가나 클릭하여 탐험
  - 해당 국가의 현재 전투를 실시간으로 관전
  - 카메라 자유 이동 (팬/줌/회전)
  - 관전자 수 표시 (인기 전투일수록 관전자 많음)

My_Agent_Tracking:
  - "내 에이전트" 패널에서 전투 중인 에이전트 1클릭 관전
  - 에이전트 시점 고정 카메라 (에이전트 추적)
  - 에이전트 상태 HUD: HP, 레벨, 빌드, 현재 행동
  - 전투 로그 실시간 스트리밍 (사이드 패널)

Live_Battle_Feed:
  - 로비에서 현재 진행 중인 "핫 배틀" 목록 표시
  - 정렬 기준: 참가자 수, 관전자 수, 지배권 변동 임박
  - 미니 프리뷰 (PiP 스타일): 여러 전투 동시 미리보기
  - "Follow" 기능: 특정 에이전트/팩션 팔로우 → 전투 시 알림

Replay_System:
  - 최근 24시간 전투 리플레이 저장
  - 주요 전투 (수도 함락, 시즌 결산) 영구 아카이브
  - 리플레이 속도 조절 (0.5x, 1x, 2x, 4x)
  - 하이라이트 자동 생성 (킬 모음, 역전 장면)
```

### 9.3 글로벌 뉴스 피드

```yaml
News_Feed:
  location: 로비 하단 또는 사이드바 (스크롤 티커)
  content:
    - "🔥 [Dragon Faction]이 일본을 점령! 아시아 지배 확대"
    - "⚔️ [Eagle Alliance] vs [Bear Union] 전쟁 선포! 유럽 긴장"
    - "💰 한국 GDP 1위 달성! [TechLords] 경제 패권"
    - "👑 [CryptoKings] 수도를 미국으로 이전"
    - "🏆 Season 2 종료까지 168시간 — 현재 1위: [Phoenix Order]"

  generation: 서버에서 자동 생성 (이벤트 기반)
  frequency: 중요 이벤트 발생 시 즉시 + 1분마다 정기 업데이트
```

## 10. Seasons & Monthly Reset — 시즌 · 역사

### 10.1 시즌 구조 (1개월 = 1 Era)

```
Season N: "Era of [테마명]" (예: "Era of Steel", "Era of Shadows")
│
├── Week 1: 🌅 Age of Discovery (개척의 시대)
│   ├── 모든 국가 미점령 상태로 시작
│   ├── 팩션 결성 + 초기 국가 러시
│   ├── 전쟁 선포 불가 (평화 기간)
│   ├── 외교 조약만 가능
│   └── 🎯 목표: 최대한 많은 국가 확보
│
├── Week 2: ⚔️ Age of Expansion (확장의 시대)
│   ├── Border Skirmish 활성화
│   ├── 전쟁 선포 가능 (비용 ×2)
│   ├── 첫 번째 World War Event (주말)
│   └── 🎯 목표: 거점 강화 + 인접 확장
│
├── Week 3: 🔥 Age of Empires (제국의 시대)
│   ├── 전쟁 비용 정상화
│   ├── Capital Siege 활성화
│   ├── UN 위원회 결의안 투표 시작
│   ├── 핵심 전쟁 집중 기간
│   └── 🎯 목표: 주요 국가 쟁탈 + 동맹 전쟁
│
└── Week 4: 👑 Age of Reckoning (결산의 시대)
    ├── 최종 순위 경쟁 격화
    ├── 특수 이벤트: "최후의 전투" (S급 국가 동시 전투)
    ├── 시즌 보상 미리보기
    ├── 마지막 72시간: "Final Rush" (전투 주기 3분으로 단축)
    └── 🎯 목표: 최종 순위 확정
```

### 10.2 시즌 리셋 (Monthly Reset)

```yaml
Reset_Process:
  1. 시즌 종료 스냅샷 (전체 세계 상태 영구 저장)
  2. 최종 랭킹 확정 (팩션/개인/에이전트)
  3. 명예의 전당 기록 (영구 보존)
  4. 보상 분배 (골드, 칭호, 코스메틱)
  5. 전체 세계 초기화 (모든 국가 미점령)
  6. 팩션 유지 (멤버/구조 유지, 자원만 리셋)
  7. 에이전트 유지 (장비/스킨 유지, 레벨/빌드 리셋)
  8. 새 시즌 테마 발표 (특수 규칙, 이벤트 예고)

Preserved_Across_Seasons:
  ✅ 유저 계정, API 키
  ✅ 팩션 구조 (리더/멤버)
  ✅ 에이전트 코스메틱 (스킨, 배너)
  ✅ 업적/칭호 (영구)
  ✅ 명예의 전당 기록
  ❌ 국가 지배권 (리셋)
  ❌ 자원/Gold (리셋)
  ❌ 에이전트 레벨/빌드 (리셋)
  ❌ 외교 조약 (리셋)
```

### 10.3 명예의 전당 (Hall of Fame)

```yaml
Hall_of_Fame_Categories:
  - 🏆 World Dominator: 시즌 종료 시 최다 국가 지배 팩션
  - 💰 Economic Superpower: 시즌 최고 GDP 기록 팩션
  - ⚔️ War Machine: 시즌 최다 Siege 승리 팩션
  - 🕊️ Peacekeeper: 시즌 동안 가장 오래 전쟁 없이 영토 유지
  - 👑 Emperor: 시즌 최다 S급 국가 지배
  - 🤖 Best Agent: 시즌 최고 개인 에이전트 (킬/생존 종합)
  - 📜 Historian: 국가 이름을 가장 많이 변경한 팩션 (문화적 영향)

Display:
  - 로비 지구본 옆 "명예의 전당" 패널
  - 시즌별 아카이브 탭 (Season 1, 2, 3...)
  - 각 카테고리 우승자: 팩션명 + 리더명 + 기록 수치
  - 세계 지도 타임라인 리플레이 (시즌 1개월 → 30초 타임랩스)
```

### 10.4 시즌 보상

| 순위 | 보상 | 설명 |
|------|------|------|
| 🥇 1위 팩션 | Golden Globe 트로피 + 다음 시즌 시작 보너스 | 에이전트 금색 이펙트 (1시즌) |
| 🥈 2위 팩션 | Silver Globe + 시작 보너스 (소) | 에이전트 은색 이펙트 |
| 🥉 3위 팩션 | Bronze Globe | 에이전트 동색 이펙트 |
| Top 10% 유저 | 시즌 한정 칭호 | 프로필 배지 |
| 전 참가자 | 시즌 참여 배지 | 프로필 장식 |

## 11. Additional Game Mechanics — 확장 메카닉

유저가 생각하지 못했을 추가 메카닉. 참고 게임들의 장점을 결합.

### 11.1 정보전 & 스파이 시스템

```yaml
Intel_System:
  scout_mission: "해당 국가의 에이전트 수, 평균 레벨, 방어 병력 정보 획득"
  cost: 50 Gold + 20 Oil
  cooldown: 1시간
  accuracy: 80% (가끔 잘못된 정보)

  sabotage_mission: "해당 국가의 방어 보너스를 다음 전투에서 -15%"
  cost: 200 Gold + 50 Oil
  cooldown: 4시간
  detection_chance: 30% (발각 시 외교 관계 -50)

  counter_intel: "내 국가에 대한 스파이 활동 탐지 확률 +50%"
  cost: 100 Tech
  duration: 24시간
```

### 11.2 자연 재해 & 글로벌 이벤트

```yaml
Random_Events (매일 1~3개 발생):
  earthquake:
    effect: "해당 국가 아레나 지형 변화 + 자원 생산 -30% (24시간)"
    probability: 5%/day per country

  pandemic:
    effect: "해당 대륙 전체 에이전트 HP -10% (48시간)"
    probability: 2%/week per continent

  gold_rush:
    effect: "해당 국가 Gold 생산 ×5 (12시간)"
    probability: 3%/day per country

  tech_boom:
    effect: "해당 국가 Tech 생산 ×3 (24시간)"
    probability: 3%/day per country

  volcanic_eruption:
    effect: "해당 국가 아레나 용암 지형 추가, DPS 존 생성"
    probability: 1%/day per country

  solar_flare:
    effect: "전 세계 LLM 에이전트 통신 장애 (1시간 기본 AI만 작동)"
    probability: 1%/week (글로벌)
```

### 11.3 기술 연구 트리 (Tech Tree)

팩션이 Tech 자원을 투자하여 글로벌 보너스를 해금:

```
연구 트리 (3갈래):

⚔️ Military Path:
  Lv.1: Enhanced Weapons (에이전트 DPS +5%)     — 100 Tech
  Lv.2: Tactical Formations (팀 시너지 +10%)   — 300 Tech
  Lv.3: Siege Engines (Siege 공격 보너스 +20%) — 700 Tech
  Lv.4: Nuclear Option (수도 공격 시 특수 무기) — 2000 Tech

💰 Economic Path:
  Lv.1: Trade Networks (무역 수수료 -25%)       — 100 Tech
  Lv.2: Industrial Revolution (자원 생산 +15%) — 300 Tech
  Lv.3: Global Markets (전 자원 무역 가능)     — 700 Tech
  Lv.4: Economic Hegemony (GDP ×2)             — 2000 Tech

🛡️ Diplomatic Path:
  Lv.1: Spy Network (정보전 성공률 +20%)        — 100 Tech
  Lv.2: Cultural Influence (Influence +30%)    — 300 Tech
  Lv.3: Peacekeeping Force (동맹 방어 +25%)    — 700 Tech
  Lv.4: World Government (UN 결의안 자동 통과)  — 2000 Tech
```

### 11.4 용병 시장 (Mercenary Market)

```yaml
Mercenary_System:
  - NPC 에이전트를 Gold로 고용하여 국가 방어에 배치
  - 용병 등급: Bronze / Silver / Gold / Legendary
  - 용병은 오프라인 시 자동 방어 (유저 부재 시 영토 보호)
  - 고용 비용: Bronze 50G / Silver 150G / Gold 500G / Legendary 2000G
  - 용병 계약: 24시간 (만료 시 재고용 필요)

Mercenary_Market_UI:
  - 로비 내 "용병 길드" 탭
  - 용병 스탯 미리보기 (DPS, HP, 빌드)
  - 경매 시스템: 인기 용병은 입찰 경쟁
```

### 11.5 영토 보너스 & 대륙 지배

```yaml
Continental_Bonuses:
  asia_domination (10+ 아시아 국가 지배):
    bonus: "Tech 생산 ×1.5 전 영토"
    title: "Lord of the East"

  europe_domination (15+ 유럽 국가 지배):
    bonus: "Influence 생산 ×1.5 전 영토"
    title: "Emperor of Europe"

  americas_domination (8+ 아메리카 국가 지배):
    bonus: "Food + Oil 생산 ×1.5 전 영토"
    title: "King of the New World"

  africa_domination (15+ 아프리카 국가 지배):
    bonus: "Steel + Minerals 생산 ×2 전 영토"
    title: "Heart of Africa"

  world_domination (100+ 국가 지배):
    bonus: "전 자원 ×2, 전투 스탯 +10%"
    title: "World Emperor" ★ 최고 칭호

Strategic_Chokepoints:
  panama_canal: "아메리카 ↔ 아시아 무역 수수료 10% 징수"
  suez_canal: "유럽 ↔ 아시아 무역 수수료 10% 징수"
  strait_of_malacca: "동남아 ↔ 동아시아 무역 수수료 10% 징수"
  strait_of_hormuz: "중동 Oil 수출 수수료 15% 징수"
```

### 11.6 업적 시스템 (Achievements)

```yaml
Personal_Achievements:
  - "First Blood": 첫 킬
  - "Centurion": 100 킬 누적
  - "World Traveler": 50개국 방문
  - "Undying": 10연속 전투 생존
  - "Kingmaker": 수도 함락 참여
  - "Economist": 10,000 Gold 벌기
  - "Diplomat": 5개 팩션과 조약 체결

Faction_Achievements:
  - "Rising Power": 첫 S급 국가 점령
  - "Empire Builder": 20개국 동시 지배
  - "Trade Empire": GDP 전체 1위
  - "Peacekeeper": 1주일 전쟁 없이 영토 유지
  - "Legacy": 3시즌 연속 Top 5
```

## 12. Technical Direction — 기술 방향

### 12.1 기술 스택

| 레이어 | 기술 | 근거 |
|--------|------|------|
| **Game Server** | Go 1.24 + gorilla/websocket + chi | v10 서버 확장, 고성능 동시성 |
| **Meta Server** | Go 1.24 + PostgreSQL + Redis | 영속 데이터 (경제/외교/시즌) |
| **Frontend** | Next.js 15 + React 19 + TypeScript | 기존 스택 유지 |
| **World Map** | MapLibre GL JS | 오픈소스, GeoJSON 렌더링, Mapbox 호환 |
| **3D Globe** | three-globe (Three.js) + R3F | 로비 3D 지구본 |
| **Battle View** | R3F (React Three Fiber) | v10 MC 스타일 전투 렌더링 유지 |
| **Data** | PostgreSQL 16 | 시즌/유저/팩션/경제 영속 데이터 |
| **Cache/RT** | Redis 7 | 실시간 게임 상태, 세션, pub/sub |
| **Auth** | JWT + API Key | 유저 인증 + 에이전트 API 인증 |
| **Deploy** | Railway (서버) + Vercel (프론트) | 기존 인프라 유지 |
| **GeoData** | Natural Earth GeoJSON | 195개국 경계 데이터 |
| **Blockchain** | CROSS Mainnet (CrossToken.io) | 게임 특화 체인, 저가스비, EVM 호환 |
| **Token Deploy** | CROSS Ramp Console + `forge_token_deploy` 스킬 | 코드리스 ERC-20 배포, 195국 일괄 |
| **Web3 Client** | CROSSx SDK (JS v1.14+) | CROSSx 지갑 Deep Linking, 토큰 전송 |
| **DEX** | CROSS GameToken DEX | 게임 토큰 전문 DEX, 국가 토큰 거래 |

### 12.2 v10 → v11 기술 변화

```yaml
Keep (유지):
  ✅ Go 게임 서버 아키텍처 (room.go, arena.go, agent.go)
  ✅ 전투 코어 루프 (collision, upgrade, orb, shrink)
  ✅ WebSocket 프로토콜 (클라이언트-서버 통신)
  ✅ MC 비주얼 스타일 + R3F 렌더링
  ✅ Next.js 프론트엔드 프레임워크

Add (추가):
  ➕ PostgreSQL (영속 데이터 — 시즌, 유저, 팩션, 경제)
  ➕ Redis (실시간 상태 캐싱 + pub/sub)
  ➕ MapLibre GL JS (세계지도 2D 렌더링)
  ➕ three-globe (3D 지구본)
  ➕ REST API 서버 (메타 게임 — 외교, 경제, 에이전트 관리)
  ➕ Auth 시스템 (JWT + API Key)
  ➕ Background Workers (경제 틱, 이벤트 생성, 시즌 관리)
  ➕ Solidity Smart Contracts (NationalTokenFactory, Treasury, Oracle, Governance)
  ➕ CROSSx SDK (CROSSx 지갑 Deep Linking, 토큰 전송, crossx:// 스킴)
  ➕ Blockchain Worker (바이백 실행, Oracle 업데이트, 토큰 소각)

Modify (변경):
  🔄 RoomManager → WorldManager (195국 관리)
  🔄 Room → CountryArena (국가별 아레나, on-demand 생성)
  🔄 SocketHandler → 게임 WS + 메타 WS 분리
  🔄 Broadcaster → 국가별 채널 + 글로벌 채널 분리

Remove (제거):
  ❌ 고정 5룸 구조 (→ 동적 국가 아레나)
  ❌ 인메모리 전용 (→ DB 영속화)
```

### 12.3 데이터베이스 방향

```yaml
PostgreSQL (영속 데이터):
  - users: 유저 계정, API 키, 프로필
  - factions: 팩션 정보, 멤버십, 계층
  - countries: 국가 상태, 지배권, 경제 데이터
  - seasons: 시즌 메타, 랭킹, 명예의 전당
  - battles: 전투 로그, 결과, 보상 기록
  - diplomacy: 조약, 전쟁, 제재 기록
  - economy: 자원, 무역, GDP 히스토리
  - achievements: 업적 달성 기록

Redis (실시간 상태):
  - game:{country_iso}: 실시간 아레나 상태 (에이전트 위치/HP)
  - sovereignty:{country_iso}: 현재 지배 팩션
  - battle:{country_iso}: 전투 진행 상태
  - session:{user_id}: 유저 세션
  - pubsub: 글로벌 이벤트 브로드캐스팅
```

### 12.4 API 아키텍처 방향

```yaml
Two_Server_Architecture:
  Game_Server (Go, WebSocket):
    - 실시간 전투 (20Hz 게임 루프)
    - 에이전트 이동/전투/레벨업
    - 기존 v10 게임 서버 확장

  Meta_Server (Go, REST + WebSocket):
    - 유저 인증/관리
    - 팩션/외교/경제 관리
    - 세계 상태 관리 (지배권, 자원)
    - Agent API 엔드포인트
    - 글로벌 이벤트/뉴스 피드

Communication:
  Meta ↔ Game: Redis pub/sub (전투 결과 → 지배권 업데이트)
  Client ↔ Game: WebSocket (실시간 전투)
  Client ↔ Meta: REST + WebSocket (메타 게임 + 실시간 알림)
```

## 13. Architecture Overview — 아키텍처 개요

C4 Level 1 — System Context

```
                        ┌──────────────────┐
                        │   Web Browser     │
                        │   (Player)        │
                        └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            │  Next.js  │ │ MapLibre │ │  R3F     │
            │  App      │ │ World Map│ │ Globe +  │
            │  (Vercel) │ │          │ │ Battle   │
            └─────┬────┘ └────┬─────┘ └────┬─────┘
                  │           │            │
                  ▼           ▼            ▼
            ┌─────────────────────────────────────┐
            │        API Gateway (Go chi)          │
            │     REST + WebSocket Routing          │
            └──────────┬──────────┬───────────────┘
                       │          │
              ┌────────▼──┐  ┌───▼──────────┐
              │ Meta Server│  │ Game Server   │
              │ (REST API) │  │ (WS, 20Hz)   │
              │            │  │              │
              │ - Auth     │  │ - Arenas     │
              │ - Factions │  │ - Combat     │
              │ - Economy  │  │ - Agents     │
              │ - Diplomacy│  │ - Matchmaking│
              └──────┬─────┘  └──────┬───────┘
                     │               │
                     ▼               ▼
              ┌──────────┐    ┌──────────┐
              │PostgreSQL │    │  Redis    │
              │(영속)     │◄──►│(실시간)   │
              └──────────┘    └──────────┘
                     │
                     ▼
              ┌──────────────┐    ┌──────────────────┐
              │ Background   │    │ CROSS Mainnet    │
              │ Workers      │───►│ (Blockchain)     │
              │ - Economy Tick│   │                  │
              │ - Events     │    │ - Token Factory  │
              │ - Season Mgmt│   │ - Treasury ×195  │
              │ - Buyback    │    │ - Defense Oracle │
              │ - Token Burn │    │ - Governance     │
              └──────────────┘    │ - DEX Pools      │
                                  └──────────────────┘
```

### 13.1 핵심 컴포넌트

```yaml
Frontend_Components:
  LobbyGlobe:     "3D 지구본 (three-globe + R3F) — 메인 로비"
  WorldMap2D:      "MapLibre GL 2D 맵 — 상세 지역 탐색"
  BattleView:      "R3F 3D 전투 뷰 — v10 아레나 렌더링 확장"
  DashboardUI:     "에이전트 관리/팩션/경제 대시보드"
  SpectatorView:   "관전 모드 (카메라 자유 이동)"

Backend_Components:
  WorldManager:    "195국 상태 관리, on-demand 아레나 생성"
  CountryArena:    "국가별 전투 아레나 (기존 Room 확장)"
  EconomyEngine:   "자원 생산/무역/GDP 시뮬레이션"
  DiplomacyEngine: "외교 행동 처리, 전쟁 상태 관리"
  FactionManager:  "팩션 CRUD, 멤버십, 계층"
  SeasonManager:   "시즌 라이프사이클, 리셋, 명예의 전당"
  EventGenerator:  "자연재해/글로벌 이벤트 랜덤 생성"
  AgentAPI:        "외부 Agent API 엔드포인트"
  AuthService:     "JWT + API Key 인증"
```

### 13.2 데이터 흐름

```
유저 액션 → 전투 결과 → 지배권 변경 → 경제 영향 → 외교 변동 → 시즌 점수

상세:
1. 유저가 에이전트를 한국에 배치 (Meta API)
2. 한국 아레나 전투 시작 (Game Server, 5분)
3. 전투 종료 → 점수 집계 (Game Server)
4. 결과를 Redis pub/sub으로 Meta Server에 전달
5. Meta Server: 지배권 업데이트 (PostgreSQL)
6. Meta Server: 자원 재계산, GDP 업데이트
7. Meta Server: 외교 상태 체크 (전쟁/조약 영향)
8. Client: 세계지도 업데이트 (WebSocket push)
9. Client: 뉴스 피드 업데이트
```

### 13.3 스케일링 전략

```yaml
Phase_1 (MVP):
  - 단일 서버 (Game + Meta 같은 프로세스)
  - PostgreSQL 1대 + Redis 1대
  - 195국 중 활성 국가만 아레나 인스턴스 생성
  - 예상: ~500 CCU, ~20개 동시 전투

Phase_2 (Growth):
  - Game Server와 Meta Server 분리
  - Game Server: 지역별 인스턴스 (Asia/EU/US)
  - 예상: ~5,000 CCU, ~50개 동시 전투

Phase_3 (Scale):
  - Game Server 수평 스케일링 (국가 그룹별 샤딩)
  - Redis Cluster
  - PostgreSQL Read Replica
  - 예상: ~50,000 CCU, ~195개 동시 전투
```

## 14. Risk Analysis — 리스크 분석

| # | 리스크 | 영향 | 확률 | 완화 전략 |
|---|--------|------|------|----------|
| R1 | **과도한 복잡성** | 개발 기간 폭발 | 높음 | Phase 기반 점진 구현 — MVP는 전투+지배권만 |
| R2 | **195국 동시 운영 부하** | 서버 과부하 | 중간 | On-demand 아레나 (활성 국가만 인스턴스 생성) |
| R3 | **경제 밸런스 붕괴** | 유저 이탈 | 중간 | 수치 시뮬레이션 + 시즌 리셋으로 빠른 조정 |
| R4 | **소수 팩션 독점** | 신규 유저 진입장벽 | 높음 | 언더독 보너스, 방어 우위, 팩션 인원 상한 |
| R5 | **봇/어뷰징** | 게임 건전성 훼손 | 중간 | API Rate Limit + 행동 패턴 분석 + 리포트 |
| R6 | **DB 마이그레이션** | 인메모리→영속 전환 비용 | 낮음 | PostgreSQL 단순 스키마 → 점진 확장 |
| R7 | **세계지도 저작권** | 법적 리스크 | 낮음 | Natural Earth (Public Domain) 사용 |
| R8 | **LLM API 비용** | 유저 비용 부담 | 중간 | 유저 자체 API 키 + 기본 무료 봇 AI 제공 |
| R9 | **시즌 리셋 피로감** | 장기 플레이어 이탈 | 중간 | 영구 업적/칭호 + 코스메틱 유지 + 시즌 테마 변화 |
| R10 | **GeoJSON 렌더링 성능** | 맵 로딩 느림 | 낮음 | 줌 레벨별 LOD + 타일 기반 렌더링 |
| R11 | **토큰 규제 리스크** | 증권법 위반 가능 | 높음 | 유틸리티 토큰 설계 + 법률 자문 + 이익 약속 금지 |
| R12 | **토큰 가격 조작** | 게임 밸런스 파괴 | 중간 | 방어 버프 상한 +30%, 쿼드라틱 보팅, 월렛 캡 |
| R13 | **크립토 시장 변동성** | 유저 자산 손실 | 높음 | 인게임 효과는 상대적 비율 기반, 절대 가격 무관 |

---

## 15. Blockchain National Currency — 국가 화폐 토큰 시스템 ★ NEW

> **핵심 메카닉**: 195개 국가마다 고유한 ERC-20 토큰을 **실제 블록체인(CROSS Mainnet)**에 `forge_token_deploy` 스킬로 발행.
> 국가의 인게임 성과(GDP, 안정성, 방어)가 토큰 가치에 반영되고,
> 유저가 토큰을 매수하면 해당 국가의 **방어력/에이전트 버프가 강화**되어 정복이 어려워지는
> **게임↔블록체인 양방향 경제 루프**.

### 15.1 토큰 아키텍처 (Dual Token Model)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI WORLD WAR Token Economy                    │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │  $AWW             │         │  National Tokens (195종)      │  │
│  │  Master Token     │◄──────►│  $KOR $USA $JPN $DEU ...     │  │
│  │  (거버넌스+범용)    │  교환   │  (국가별 유틸리티)            │  │
│  └──────────────────┘         └──────────────────────────────┘  │
│         │                              │                         │
│         ▼                              ▼                         │
│  ┌──────────────┐              ┌──────────────────┐             │
│  │ Governance   │              │ In-Game Effects   │             │
│  │ - 시즌 규칙  │              │ - 방어 버프       │             │
│  │ - 글로벌 정책│              │ - 에이전트 강화   │             │
│  │ - 프로토콜   │              │ - 경제 부스트     │             │
│  └──────────────┘              │ - 거버넌스 투표   │             │
│                                └──────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**$AWW (AI World War Token)** — 마스터 토큰:

| 항목 | 값 |
|------|-----|
| 체인 | Base (Ethereum L2) |
| 표준 | ERC-20 |
| 총 발행량 | 1,000,000,000 (10억, 고정) |
| 용도 | 거버넌스, 크로스-국가 무역, 스테이킹, 프리미엄 |
| 배포 | CROSS Ramp Console + `forge_token_deploy` 스킬 — CROSS Mainnet |

**National Tokens ($KOR, $USA 등)** — 국가별 화폐:

| 국가 등급 | 토큰 심볼 예시 | 초기 발행량 | 비고 |
|----------|--------------|-----------|------|
| S (Superpower) | $USA, $CHN, $RUS | 100,000,000 | 최대 유동성 |
| A (Major) | $KOR, $FRA, $CAN | 50,000,000 | 높은 유동성 |
| B (Regional) | $EGY, $THA, $POL | 20,000,000 | 중간 유동성 |
| C (Standard) | $BGD, $CMR | 10,000,000 | 낮은 유동성 |
| D (Minor) | $MCO, $TUV | 5,000,000 | 최소 유동성 |

### 15.2 토큰 배포 (forge_token_deploy)

```yaml
Smart_Contracts:
  NationalTokenFactory.sol:
    - 단일 Factory 컨트랙트에서 195개 토큰 일괄 생성
    - OpenZeppelin ERC20 기반
    - 각 토큰: name=국가명, symbol=ISO3 코드
    - Admin: 게임 서버 멀티시그 월렛

  NationalTreasury.sol:
    - 국가별 재무부 컨트랙트 (195개 인스턴스)
    - GDP 세수 수신 → DEX에서 자국 토큰 바이백
    - 전쟁 승리 시 토큰 소각 (디플레이션)
    - 스테이킹 보상 분배

  DefenseOracle.sol:
    - DEX 풀에서 토큰 시가총액 읽기
    - 방어 배율 계산 → 게임 서버에 제공
    - 5분마다 업데이트 (전투 사이클과 동기화)

  GovernanceModule.sol:
    - 쿼드라틱 보팅 (sqrt(토큰) = 투표 가중치)
    - 정책 제안 → 투표 → 시간잠금 실행

Deployment_Script:
  tool: "forge script script/DeployAll.s.sol --broadcast --rpc-url $BASE_RPC"
  chain: Base Mainnet (chainId: 8453)
  gas: ~0.001 ETH per token deploy (~$0.003)
  total_cost: ~0.2 ETH for 195 tokens (~$0.60)
```

### 15.3 핵심 루프: 인게임 성과 → 토큰 가치 → 인게임 강화

```
                    ┌─────────────────────────┐
                    │   VIRTUOUS CYCLE (선순환) │
                    └─────────────────────────┘

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ 국가 성과 │───►│ 토큰 수요 │───►│ 토큰 가격 │───►│ 방어 강화 │
  │ (GDP↑     │    │ (바이백↑  │    │ (시총↑    │    │ (버프↑    │
  │  안정성↑  │    │  관심↑)   │    │  유저매수↑)│   │  정복 어려움)│
  │  승리↑)   │    │          │    │          │    │          │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
       ▲                                              │
       │              ◄───── 방어 성공 ────────────────┘
       │              ◄───── 투자자 신뢰 ────────────────
       └──────────────── GDP 세수로 바이백 ──────────────
```

**가치 상승 메커니즘 (Token Value Drivers)**:

| # | 메커니즘 | 설명 | 효과 |
|---|---------|------|------|
| 1 | **GDP 세수 바이백** | 국가 내 Gold 거래의 5% → 재무부가 DEX에서 자국 토큰 매수 | 매수 압력 ↑ |
| 2 | **전쟁 승리 소각** | Siege 방어 성공 시 재무부 토큰의 1% 소각 | 공급 감소 (디플레이션) |
| 3 | **안정성 프리미엄** | 연속 지배 Lv.4+ 유지 → 스테이킹 APY 증가 | 장기 홀딩 유인 |
| 4 | **수출 결제** | 자원 수출 시 대금의 20%를 수출국 토큰으로 결제 | 수요 확산 |
| 5 | **유저 직접 매수** | 유저가 DEX에서 국가 토큰 매수 → 방어 버프 기여 | 직접 투자 |

### 15.4 토큰 → 인게임 효과 (핵심 ★)

**A) National Defense Shield (국가 방어막)**

유저들이 해당 국가 토큰을 매수하면 → 시가총액 증가 → 국가 방어력 강화:

```
방어 배율 = f(token_market_cap)

시가총액 구간        방어 보너스      추가 효과
─────────────────   ────────────    ──────────────────
< $1,000             +0%           없음
$1,000 ~ $10,000     +5%           에이전트 HP +3%
$10,000 ~ $50,000    +10%          에이전트 HP +5%, DPS +3%
$50,000 ~ $200,000   +15%          에이전트 HP +8%, DPS +5%, 이동속도 +3%
$200,000 ~ $1,000,000 +20%         에이전트 HP +10%, DPS +8%, 이동속도 +5%
> $1,000,000          +25%          모든 스탯 +10% (★ 상한)
                      MAX +30%      Lv.5 수도 추가 보너스 시 최대

⚠️ 상한(CAP): +30% — 토큰만으로 무적이 될 수 없음.
   실력(전투)과 투자(토큰)의 균형이 핵심.
```

**B) Agent Enhancement (에이전트 개별 강화)**

토큰 보유량에 따라 개인 에이전트에 특수 능력 부여:

| 보유량 | 칭호 | 인게임 효과 |
|--------|------|-----------|
| 100+ 토큰 | Supporter | 해당 국가 전투 시 XP +10% |
| 1,000+ 토큰 | Patriot | 해당 국가 전투 시 전 스탯 +5% |
| 10,000+ 토큰 | National Hero | 고유 스킬 해금: "Rally" (주변 아군 DPS +10%, 10초) |
| 100,000+ 토큰 | Founding Father | 거버넌스 투표 가중치 ×2 + "Inspire" 스킬 (아군 전체 HP +15%, 15초) |

**C) Economic Boost (경제 부스트)**

토큰 스테이킹 → 자원 생산 직접 증가:

```
스테이킹 풀 총량      자원 생산 보너스
────────────────     ────────────────
< 1% of supply       +0%
1% ~ 5%              +5%
5% ~ 15%             +10%
15% ~ 30%            +15%
> 30%                +20% (상한)

예시: $KOR 총 발행 50M, 스테이킹 풀 10M (20%)
→ 한국의 모든 자원 생산 +15%
→ GDP 상승 → 바이백 증가 → 토큰 가격 상승 → 양의 피드백 루프
```

**D) Governance (정책 투표)**

토큰 보유자가 국가 정책에 직접 투표:

```yaml
Votable_Policies:
  - 세율 변경 (0~50%)
  - 전쟁 선포 승인 (51% 이상 찬성 필요)
  - 경제 정책 변경
  - 팩션 가입/탈퇴 승인
  - 국가 이름 변경

Voting_System:
  weight: sqrt(tokens_held)  # 쿼드라틱: 웨일 지배 방지
  quorum: 10% of circulating supply 참여 시 유효
  duration: 24시간 투표 기간
  execution: 12시간 타임락 후 자동 실행
```

### 15.5 토큰 분배 모델

```yaml
$AWW_Distribution:
  game_ecosystem: 40%    # 게임 보상, 에어드롭, 이벤트
  community: 25%         # 초기 참여자, 베타 테스터
  team: 15%              # 4년 베스팅 (1년 클리프)
  liquidity: 10%         # DEX 초기 유동성 (CROSS GameToken DEX)
  treasury: 10%          # DAO 재무부 (긴급 자금)

National_Token_Distribution:
  game_treasury: 50%     # 전투 보상, GDP 바이백 재원
  liquidity_pool: 30%    # DEX 초기 유동성 (AWW 페어)
  community_airdrop: 15% # 시즌 보상, 이벤트
  reserve: 5%            # 비상 준비금
```

### 15.6 DEX 유동성 + 거래

```yaml
Trading_Venue:
  primary: CROSS GameToken DEX (CrossToken.io 내장 DEX)
  pairs: $KOR/$AWW, $USA/$AWW, ... (195 페어)
  initial_liquidity: 게임 재무부에서 제공
  wallet: CROSSx Super App (crossx:// Deep Linking)

Price_Discovery:
  AMM: CROSS GameToken DEX AMM
  oracle: CROSS RPC (JSON-RPC:8545) → 5분마다 TWAP 계산
  game_server: CROSS RPC에서 시가총액 읽어 → 방어 버프 적용

Anti_Manipulation:
  - TWAP (Time-Weighted Average Price) 사용 (순간 조작 방지)
  - 방어 버프 변경은 1시간 이동평균 (급격한 변동 완충)
  - 단일 거래 slippage > 10% 시 경고
```

### 15.7 시즌 리셋과 토큰

```yaml
Season_Reset_Token_Policy:
  tokens_preserved: ✅ # 토큰은 온체인이므로 시즌 리셋과 무관하게 보존
  staking_reset: ✅     # 스테이킹은 리셋 (새 시즌 시작 시 재스테이킹 필요)
  defense_buff_reset: ✅ # 방어 버프는 리셋 (시가총액 기반으로 재계산)
  governance_reset: ✅   # 투표 결과 리셋 (새 시즌 새 정책)

  # 핵심: 토큰 자체는 영구. 인게임 효과만 시즌 리셋.
  # 이유: 유저 자산 보호 + 매 시즌 새 기회 (다른 국가 투자 가능)

Cross_Season_Value:
  - 인기 국가 토큰은 시즌 넘어서도 가치 유지 (커뮤니티 애착)
  - 신규 시즌 시작 → 미점령 국가 = 토큰 매수 기회 (선점 이점)
  - "시즌 우승국" 토큰은 히스토리컬 프리미엄 (수집 가치)
```

### 15.8 안전장치 (Anti-Abuse)

```yaml
Whale_Protection:
  max_wallet: "총 발행량의 10% 이상 보유 불가"
  diminishing_returns: "보유량 ↑ → 추가 버프 효율 ↓ (로그 스케일)"
  quadratic_voting: "sqrt(tokens) = 투표 가중치 — 10000토큰 = 100표"

Balance_Mechanisms:
  defense_cap: "+30% 상한 — 토큰만으로 무적 불가"
  skill_matters: "방어 버프가 있어도 상대가 더 강하면 정복당함"
  siege_lockup: "Siege 전투 중 해당 국가 토큰 이체 불가 (48시간)"
  cooldown: "방어 버프 변경은 1시간 이동평균 (급매도로 즉시 약화 불가)"

Legal_Safety:
  token_type: "유틸리티 토큰 (증권 아님)"
  no_profit_promise: "이익 약속 절대 없음, 게임 유틸리티만"
  disclaimer: "토큰 가격은 게임 메카닉에 의해 변동, 투자 조언 아님"
  jurisdiction: "규제 우호 관할권 선택 (싱가포르, 스위스 등)"
```

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->
<!-- 상세 Step별 로드맵은 v11-world-war-roadmap.md 참조 -->

> **복잡도**: Phase > 5 → 별도 로드맵 파일 생성
> **상세 로드맵**: [`docs/designs/v11-world-war-roadmap.md`](v11-world-war-roadmap.md)

### Phase 1: 기반 인프라 + DB + Auth
| Task | 설명 |
|------|------|
| PostgreSQL 스키마 설계 | users, factions, countries, seasons, battles 테이블 |
| Redis 설정 | 실시간 상태 캐시 + pub/sub 채널 |
| Auth 시스템 | JWT 로그인 + API Key 발급 |
| GeoJSON 데이터 준비 | Natural Earth 195국 데이터 정제 + 등급/자원 매핑 |
| 프로젝트 구조 리팩토링 | RoomManager → WorldManager, Room → CountryArena |

- **design**: N (인프라 중심)
- **verify**: DB 연결 성공, Auth 플로우 테스트, GeoJSON 파싱 확인

### Phase 2: 세계지도 + 3D 지구본 (로비)
| Task | 설명 |
|------|------|
| MapLibre GL 2D 세계지도 | GeoJSON 렌더링, 국가 색상, 클릭/호버 인터랙션 |
| three-globe 3D 지구본 | 로비 메인 화면, 팩션 색상, 국기 마커 |
| 국가 상세 패널 | 클릭 시 슬라이드 패널 (지배 팩션, GDP, 에이전트 수) |
| Globe↔Map 전환 | 줌인 시 지구본→2D 맵 스무스 전환 |
| 뉴스 피드 UI | 하단 티커 (실시간 이벤트) |

- **design**: Y (UI 중심 — 3D 지구본 + 맵 디자인)
- **verify**: 지구본 렌더링, 국가 클릭 반응, 맵 전환 동작

### Phase 3: 국가 아레나 전투 (v10 코어 확장)
| Task | 설명 |
|------|------|
| WorldManager | 195국 관리, on-demand 아레나 생성/해제 |
| CountryArena | 국가별 전투 (기존 Room/Arena 확장), 지형 테마 |
| 전투 결과 → 지배권 연동 | 전투 종료 → Redis → Meta → DB 업데이트 |
| 에이전트 배치 시스템 | 특정 국가에 에이전트 배치/소환 |
| 관전 모드 | 아무 국가 전투를 실시간 관전 |

- **design**: N (로직 중심)
- **verify**: 전투 시작/종료, 지배권 변경 확인, 관전 기능

### Phase 4: 팩션 + 외교 시스템
| Task | 설명 |
|------|------|
| 팩션 CRUD | 생성/가입/탈퇴/해산, 계층 구조 |
| 외교 행동 | 조약, 전쟁 선포, 제재, 항복 |
| 전쟁 시스템 | Siege Battle, 준비 기간, 수도 함락 |
| 팩션 대시보드 | 멤버 관리, 영토 현황, 외교 상태 |

- **design**: Y (대시보드 UI)
- **verify**: 팩션 생성/가입, 전쟁 선포 플로우, Siege 전투

### Phase 5: 경제 시스템
| Task | 설명 |
|------|------|
| 자원 생산 엔진 | 국가별 6종 자원 시간당 생산 |
| 경제 정책 UI | 세율, 무역 개방도, 군비 지출 설정 |
| 무역 시스템 | 자원 거래소, 수수료, 무역 루트 |
| GDP 산정 | 실시간 GDP 계산 + 랭킹 |

- **design**: Y (경제 대시보드 UI)
- **verify**: 자원 생산 정확성, 무역 거래, GDP 계산

### Phase 6: Agent API + Commander Mode
| Task | 설명 |
|------|------|
| REST API 엔드포인트 | deploy, recall, status, strategy, battle-log |
| WebSocket 라이브 스트림 | 에이전트 전투 실시간 스트리밍 |
| Commander Mode | AI→수동 전환, 수동 조종 |
| LLM 연동 | 레벨업 선택 LLM 위임, 전략 동적 조정 |
| API 문서 + 대시보드 | Swagger/OpenAPI + API 키 관리 UI |

- **design**: Y (API 대시보드)
- **verify**: API CRUD 테스트, Commander Mode 전환, LLM 연동

### Phase 7: 시즌 + 명예의 전당
| Task | 설명 |
|------|------|
| 시즌 라이프사이클 | 4주 구조, 에라 전환, 리셋 로직 |
| 명예의 전당 | 시즌 우승자 영구 기록, 타임라인 리플레이 |
| 시즌 보상 | 칭호, 코스메틱, 트로피 |
| 업적 시스템 | 개인/팩션 업적 추적 + 보상 |

- **design**: Y (명예의 전당 UI)
- **verify**: 시즌 리셋 정상 동작, 데이터 보존 확인

### Phase 8: 고도화 + 확장 메카닉
| Task | 설명 |
|------|------|
| 기술 연구 트리 | 3갈래 연구, Tech 투자, 보너스 해금 |
| 정보전 시스템 | 스카우트, 사보타지, 방첩 |
| 자연재해 이벤트 | 랜덤 글로벌 이벤트 엔진 |
| UN 위원회 | 결의안 투표, 상임이사국 거부권 |
| 용병 시장 | NPC 에이전트 고용, 자동 방어 |
| 대륙 보너스 | 대륙 지배 달성 시 특수 보너스 |

- **design**: Y (연구트리 + 이벤트 UI)
- **verify**: 연구 해금, 이벤트 발생, 용병 배치

### Phase 9: 성능 최적화 + E2E 테스트
| Task | 설명 |
|------|------|
| 서버 성능 | 195국 동시 운영 스트레스 테스트 |
| 맵 성능 | GeoJSON LOD, 타일 최적화 |
| 지구본 성능 | 글로브 FPS 최적화, 모바일 대응 |
| E2E 테스트 | Playwright 전체 유저 플로우 |
| 보안 감사 | Auth, API Rate Limit, SQL Injection 점검 |

- **design**: N
- **verify**: 부하 테스트 통과, E2E 전 시나리오, 보안 스캔 클린

### Phase 10: 블록체인 국가 화폐 시스템 ★ NEW
| Task | 설명 |
|------|------|
| 스마트 컨트랙트 개발 | NationalTokenFactory, Treasury, DefenseOracle, Governance (CROSS Ramp Console + Solidity) |
| forge_token_deploy | 195개 국가 토큰 CROSS Mainnet 배포 (`forge_token_deploy` 스킬) |
| $AWW 마스터 토큰 배포 | 거버넌스/범용 토큰 발행 + DEX 유동성 풀 생성 |
| Defense Oracle 연동 | 토큰 시가총액 → 인게임 방어 버프 계산 파이프라인 |
| 토큰 월렛 UI | CROSSx 지갑 연결 (CROSSx SDK), 잔고 표시, 스테이킹 |
| GDP 바이백 엔진 | 인게임 GDP 세수 → 온체인 자동 바이백 |
| 거버넌스 투표 UI | 쿼드라틱 보팅 인터페이스, 정책 제안/투표 |
| 토큰 이코노미 대시보드 | 국가별 시가총액, 바이백 히스토리, 스테이킹 현황 |

- **design**: Y (월렛 UI + 거버넌스 + 대시보드)
- **verify**: 토큰 배포 성공, 방어 버프 연동, 스테이킹 동작, 거버넌스 투표
