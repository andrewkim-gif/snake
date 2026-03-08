# PLAN: v26 — Isometric Nation Simulation (Tropico-style In-Game)

> **Version**: v26.0
> **Date**: 2026-03-09
> **Status**: DRAFT — Strategic Plan
> **Based on**: tropico.md + v11 World War + v16 Simulation System
> **Core Shift**: Arena Combat (MC 3D) → **Isometric Nation Simulation** (Tropico-style city/economy/politics)
> **Architecture**: 상세 국가 시뮬레이션 (에이전트 기반, 아이소메트릭) → 전세계 시뮬레이션 (지구본)

---

## 1. 개요

### 1.1 비전

> **"지구본에서 국가를 클릭하면, 그 나라의 도시·경제·정치를 직접 운영하는 아이소메트릭 시뮬레이션이 펼쳐진다. 195개국 각각이 Tropico 스타일의 독립 시뮬레이션이며, 그 결과가 다시 지구본 위의 세계 정세를 바꾼다."**

기존 v11~v25의 Arena Combat(MC 스타일 3D 전투)을 **아이소메트릭 국가 경영 시뮬레이션**으로 전면 교체한다. Tropico 5/6의 경제·정치·도시건설 메카닉을 차용하되, **AI 에이전트 기반 시민**이 자율적으로 행동하는 점이 핵심 차별점이다.

### 1.2 핵심 컨셉 변화

```
기존 (v11~v25):
  [🌍 Globe] → 국가 클릭 → [⚔️ Arena Combat] (5분 서바이벌 전투)
                              → 전투 결과 → 지배권 변경

v26:
  [🌍 Globe] → 국가 클릭 → [🏗️ Isometric City] (실시간 경영 시뮬레이션)
                              → 경제·군사·외교 성과 → 국력 변동 → 세계 정세 변화
```

### 1.3 왜 독보적인가?

| 참고 게임 | 핵심 | v26이 다른 점 |
|-----------|------|-------------|
| **Tropico 6** | 단일 섬 경제/정치 시뮬 | 195개국 동시 시뮬 + AI 에이전트 시민 |
| **Victoria 3** | 그랜드 전략 경제/정치 | 아이소메트릭 도시 직접 건설 + 실시간 시민 AI |
| **SimCity** | 도시 건설 | 국제 정치·외교·전쟁이 경제에 직접 영향 |
| **Civilization** | 4X 전략 | 브라우저 기반 + AI 에이전트 자율 운영 |
| **Ages of Conflict** | AI 국가 시뮬 | 도시 레벨까지 내려가는 상세 시뮬 |

### 1.4 핵심 수치

| 항목 | 값 |
|------|-----|
| 국가 수 | 195 |
| 국가당 최대 건물 | 100~500 (tier별) |
| 국가당 AI 시민 | 50~500 (인구 비례) |
| 생산 체인 종류 | 26 원자재 + 17 가공품 |
| 파벌 수 | 4 대립축 (8 파벌) |
| 행복도 요소 | 8개 (식량/의료/오락/신앙/주거/직업/자유/안전) |
| 시대 | 4 (개척/산업화/냉전/현대) = v11 시즌 Era와 매핑 |

## 2. 현재 시스템 분석

### 2.1 Out-Game (Globe) — 유지

현재 지구본 시스템은 그대로 유지하며 v26의 "바깥 세계"가 된다.

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| `WorldView` | `components/world/WorldView.tsx` | 지구본 + 국가 패널 오케스트레이터 |
| `GlobeView` | `components/lobby/GlobeView.tsx` | R3F three-globe 3D 지구본 |
| `GlobeHoverPanel` | `components/3d/GlobeHoverPanel.tsx` | 국가 호버 정보 패널 |
| `CountryPanel` | `components/world/CountryPanel.tsx` | 국가 상세 + 진입 버튼 |
| Globe Effect 레이어 | `components/3d/Globe*.tsx` (12종) | 전쟁/무역/동맹/핵 이펙트 |

**변경점**: CountryPanel의 "Enter Arena" 버튼 → **"Manage Country"** 버튼으로 변경. 클릭 시 아이소메트릭 뷰로 전환.

### 2.2 In-Game (Arena) — 교체 대상

현재 Arena 시스템 (29개 AR* 컴포넌트)은 **아이소메트릭 시뮬레이션**으로 교체된다.

| 현재 | v26 | 비고 |
|------|-----|------|
| `ARCamera` (TPS 카메라) | `IsoCamera` (탑뷰 아이소) | 45° 고정 시점 |
| `ARTerrain` (원형 지형) | `IsoTerrain` (타일맵 그리드) | 2D 타일 기반 |
| `AREnemyModel` (적 3D) | `CitizenAgent` (시민 AI 스프라이트) | 에이전트 기반 |
| `ARPlayer` (플레이어) | `BuildingPlacer` (건물 배치 UI) | 건설 인터페이스 |
| `ARProjectiles` (투사체) | `ProductionChain` (생산 라인 시각화) | 경제 시각화 |

### 2.3 서버 (Go) — 확장 대상

| 기존 모듈 | 재사용 | 확장/신규 |
|-----------|--------|----------|
| `internal/meta/EconomyEngine` | ✅ GDP·무역 기반 | 건물별 생산·소비·고용 |
| `internal/meta/DiplomacyEngine` | ✅ 조약·제재 | 파벌 외교 연동 |
| `internal/meta/WarManager` | ✅ 전쟁 선포/진행 | 군사 건물 생산력 연동 |
| `internal/meta/FactionManager` | ✅ 팩션 관리 | Tropico 4대립축 파벌 |
| `internal/world/WorldManager` | ✅ 195국 관리 | 건물·시민 상태 추가 |
| `internal/sim/` | ✅ 시뮬레이션 엔진 | 도시 시뮬 레이어 추가 |
| **NEW**: `internal/city/` | — | 건물·생산·시민 시뮬 |
| **NEW**: `internal/politics/` | — | 파벌·선거·헌법 |

## 3. 핵심 설계: 2-Layer 게임 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI World War v26                                    │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗   │
│  ║  LAYER 2: OUT-GAME (Globe — 세계 시뮬레이션)                           ║   │
│  ║  ┌─────────────────────────────────────────────────────────────────┐ ║   │
│  ║  │  🌍 Globe View (three-globe)                                   │ ║   │
│  ║  │  → 195국 상태 시각화 (GDP, 군사력, 외교, 팩션 색상)              │ ║   │
│  ║  │  → 전쟁/무역/동맹 이펙트 (기존 Globe* 레이어 유지)              │ ║   │
│  ║  │  → 국가 클릭 → LAYER 1 진입                                    │ ║   │
│  ║  └─────────────────────────────────────────────────────────────────┘ ║   │
│  ║       ▲ 국력·외교·경제 결과가 Globe 시각화에 반영                     ║   │
│  ╚═══════╪═══════════════════════════════════════════════════════════════╝   │
│          │                                                                  │
│  ╔═══════╪═══════════════════════════════════════════════════════════════╗   │
│  ║  LAYER 1: IN-GAME (Isometric — 국가 시뮬레이션)              ▼      ║   │
│  ║  ┌─────────────────────────────────────────────────────────────────┐ ║   │
│  ║  │  🏗️ Isometric City View (PixiJS / R3F isometric)              │ ║   │
│  ║  │  → 건물 배치 & 건설 (Tropico-style 건설 UI)                   │ ║   │
│  ║  │  → 생산 체인 시각화 (원자재→가공→수출)                         │ ║   │
│  ║  │  → AI 시민 에이전트 (출퇴근, 소비, 투표)                       │ ║   │
│  ║  │  → 파벌 정치 (4대립축, 선거, 최후통첩)                         │ ║   │
│  ║  │  → 외교·무역·전쟁 (Globe와 양방향 동기화)                      │ ║   │
│  ║  └─────────────────────────────────────────────────────────────────┘ ║   │
│  ╚═══════════════════════════════════════════════════════════════════════╝   │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗   │
│  ║  SERVER (Go)                                                         ║   │
│  ║  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐ ║   │
│  ║  │ WorldManager │ │ Meta Engines │ │ NEW: CitySimEngine           │ ║   │
│  ║  │ (195국 상태)  │ │ (경제/외교/  │ │ (건물/생산/시민/파벌/선거)     │ ║   │
│  ║  │              │ │  전쟁/팩션)  │ │                               │ ║   │
│  ║  └──────┬───────┘ └──────┬───────┘ └──────────────┬───────────────┘ ║   │
│  ║         └────────────────┴────────────────────────┘                  ║   │
│  ║                          │                                           ║   │
│  ║                    WebSocket Hub                                      ║   │
│  ║              (globe_state / city_state / events)                      ║   │
│  ╚═══════════════════════════════════════════════════════════════════════╝   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 데이터 흐름

```
유저 행동 (In-Game):
  건물 배치 → CitySimEngine → 생산량/고용/GDP 변동
    → EconomyEngine 반영 → WorldManager 국력 업데이트
    → Globe View에 실시간 반영

세계 이벤트 (Out-Game):
  다른 국가가 전쟁 선포 → WarManager
    → 해당 국가 CitySimEngine에 "전시 체제" 트리거
    → 군사 건물 생산 부스트, 민간 생산 감소
    → In-Game 시민 행복도 "안전" 항목 하락

AI 에이전트 (자율):
  NationalAI → 전략 결정 (건물 우선순위, 외교 방향)
    → CitySimEngine에 건설 명령 발행
    → 시민 AI 에이전트가 출퇴근·소비·투표 자율 행동
```

### 3.2 View 전환 (Globe ↔ Isometric)

| 트리거 | 전환 | 애니메이션 |
|--------|------|-----------|
| Globe에서 국가 클릭 → "Manage" | Globe → Iso | 카메라 줌인 → 수도 위치 → 아이소 뷰 fade-in |
| Iso에서 "Back to Globe" | Iso → Globe | 아이소 fade-out → 카메라 줌아웃 → Globe 복귀 |
| Iso에서 이웃 국가 클릭 | Iso → Iso | 맵 경계에서 슬라이드 전환 |
| Globe에서 전쟁 이벤트 클릭 | Globe → Iso (전장) | 전쟁 대상국 아이소 뷰 + 전투 오버레이 |

## 4. In-Game: 아이소메트릭 국가 시뮬레이션

### 4.1 렌더링 방식: 2D 아이소메트릭 (PixiJS)

기존 Arena는 R3F(Three.js) 기반 3D였으나, 아이소메트릭 국가 시뮬은 **PixiJS 기반 2D 타일맵**이 적합하다.

**이유**:
- 195국 각각의 도시를 3D로 렌더링하면 성능 부담 과중
- Tropico/SimCity 스타일 건물은 2D 스프라이트가 시각적으로 충분
- AI 생성 아이소메트릭 스프라이트(Gemini)로 건물 에셋 제작 가능
- PixiJS 2D는 모바일에서도 60fps 유지 용이

**대안**: Three.js orthographic camera로 2.5D도 가능하나, 건물 에셋 제작 비용이 높고 PixiJS 대비 이점이 적음.

### 4.2 타일맵 시스템

```
타일 크기: 64x32px (아이소메트릭 다이아몬드)
맵 크기 (국가 tier별):
  S (미국 등): 80x80 타일 (6,400 셀)
  A (한국 등): 60x60 타일 (3,600 셀)
  B (지역강국): 40x40 타일 (1,600 셀)
  C (일반국가): 30x30 타일 (900 셀)
  D (소국):     20x20 타일 (400 셀)

타일 타입:
  - 평지 (buildable)
  - 물 (not buildable, 항구만)
  - 산 (not buildable, 광산만)
  - 숲 (벌목장)
  - 사막 (석유/태양광)
  - 해안 (어업/관광)
  - 도로 (자동 연결)
```

### 4.3 건물 시스템 (Tropico 기반 간소화)

195국 규모에 맞게 Tropico 188개 → **60~80개 건물**로 간소화:

| 카테고리 | 건물 수 | 예시 |
|----------|---------|------|
| **자원 채취** | 10 | 농장, 목장, 어항, 광산, 유전, 벌목장 |
| **가공·산업** | 12 | 제재소, 제철소, 공장, 식품가공, 정유소, 전자공장 |
| **주거** | 6 | 판잣집, 아파트, 빌라, 고급아파트, 군막사, 외국인주거 |
| **상업·오락** | 8 | 시장, 레스토랑, 술집, 극장, 카지노, 쇼핑몰 |
| **공공서비스** | 10 | 진료소, 병원, 학교, 대학, 경찰서, 소방서, 교회 |
| **정부** | 6 | 대통령궁, 은행, 세관, 대사관, 국회, 법원 |
| **군사** | 5 | 병영, 무기고, 군항, 공군기지, 방공시설 |
| **인프라** | 6 | 발전소, 변전소, 항구, 공항, 고속도로, 지하철역 |
| **관광** | 5 | 호텔, 해변리조트, 문화유적, 카지노, 공원 |

### 4.4 건물 데이터 구조

```typescript
interface Building {
  id: string;
  type: BuildingType;
  tileX: number;
  tileY: number;
  size: [number, number];     // 타일 점유 크기 (예: 2x2)
  level: 1 | 2 | 3;          // 업그레이드 단계
  workMode: string;           // Tropico 작업 모드 (예: "dark_chocolate" / "sweet_chocolate")

  // 운영 상태
  workers: number;            // 현재 출근 노동자
  maxWorkers: number;         // 최대 고용
  efficiency: number;         // 0~1 (노동자 비율 + 행복도 + 인접 보너스)
  powered: boolean;           // 전력 연결 여부

  // 생산
  produces: { resource: string; amount: number }[];
  consumes: { resource: string; amount: number }[];

  // 경제
  constructionCost: number;
  maintenanceCost: number;    // 월간 유지비
  workerWage: number;         // 임금 수준 (1~5단계)
}
```

### 4.5 UI 레이아웃

```
┌────────────────────────────────────────────────────────────────────┐
│  [🌍 Globe] [📊 Economy] [🏛️ Politics] [⚔️ Military] [📋 Edicts]│  ← 탑 메뉴
├────────────────────────────────────────────────────────┬───────────┤
│                                                        │ 우측 패널 │
│                                                        │           │
│              아이소메트릭 맵 뷰                          │ 선택 건물  │
│              (PixiJS Canvas)                           │ 상세 정보  │
│                                                        │           │
│              - 건물 렌더링                               │ 생산현황  │
│              - 시민 이동 애니메이션                       │ 노동자수  │
│              - 도로·전력망 표시                          │ 효율     │
│              - 선택 하이라이트                           │           │
│                                                        │ 업그레이드 │
│                                                        │ 철거 버튼 │
├────────────────────────────────────────────────────────┴───────────┤
│  [건물 카테고리 탭] ← 하단 건설 패널                                │
│  [🏠 주거] [🏭 산업] [🏥 공공] [🏛️ 정부] [⚔️ 군사] [🌴 관광]      │
│  └→ 스크롤 가능한 건물 목록 (아이콘 + 이름 + 비용)                  │
└────────────────────────────────────────────────────────────────────┘
```

### 4.6 카메라

- **기본**: 아이소메트릭 45° 탑다운 (orthographic)
- **줌**: 3단계 (도시 전경 / 구역 / 건물 상세)
- **팬**: 마우스 드래그 / WASD / 맵 미니맵 클릭
- **회전**: 없음 (전통적 아이소메트릭 고정 시점)
- **전환**: Globe에서 진입 시 줌인 애니메이션 → 아이소 뷰

## 5. Out-Game → In-Game 통합 (Globe ↔ Isometric)

Globe(Out-Game)과 Isometric(In-Game) 사이의 양방향 데이터 동기화가 v26의 핵심 기술 과제다.

### 5.1 Globe → Isometric (세계가 국가에 영향)

| 세계 이벤트 | In-Game 영향 |
|------------|-------------|
| 전쟁 선포 (WarManager) | 전시 체제: 군사 건물 +50% 생산, 민간 -20%, 시민 안전 행복도 ↓ |
| 경제 제재 (DiplomacyEngine) | 무역 수입 -30%, 특정 자원 수입 차단 |
| 동맹 체결 | 동맹국 무역 보너스 +15%, 군사 지원 |
| 팩션 이벤트 | 글로벌 팩션 정책이 국내 파벌 호감도에 영향 |
| 시대 전환 (Era) | 새 건물 해금, 새 파벌 등장, 규칙 변경 |
| 자원 가격 변동 | 수출 수익 변동, 생산 우선순위 재조정 필요 |

### 5.2 Isometric → Globe (국가가 세계에 영향)

| In-Game 성과 | Globe 반영 |
|-------------|-----------|
| GDP 증가 | 국가 색상 변경 (부유→금색), 영향력 확대 |
| 군사력 증강 | 군사 아이콘 크기, 전쟁 능력치 |
| 행복도 변화 | 국가 안정도 (낮으면 혁명 위험 → Globe에 반란 이펙트) |
| 무역 노선 개설 | Globe에 무역 경로 아크 추가 |
| 외교 행동 | 동맹/제재/전쟁 선포 → Globe 이펙트 |
| 시민 이민/유출 | 인접국 인구 변동 |

### 5.3 WebSocket 프로토콜 확장

```typescript
// 기존 globe_state (Out-Game용, 1Hz)
interface GlobeStateUpdate {
  countries: Map<string, CountryClientState>;  // 기존 유지
  wars: WarEffectData[];
  tradeRoutes: TradeRouteData[];
  // ...
}

// NEW: city_state (In-Game용, 2Hz — 관리 중인 국가만)
interface CityStateUpdate {
  iso3: string;
  buildings: BuildingSnapshot[];    // 전체 건물 상태
  citizens: CitizenSnapshot[];      // 이동 중인 시민 위치 (LOD: 줌 레벨에 따라)
  resources: ResourceStockpile;     // 자원 재고
  economy: EconomySummary;          // GDP, 수입/지출
  politics: PoliticsSummary;        // 파벌 호감도, 선거 예측
  events: CityEvent[];              // 최근 이벤트 (건설 완료, 재해, 선거 등)
}

// NEW: city_command (클라이언트 → 서버)
type CityCommand =
  | { type: 'build'; buildingType: string; tileX: number; tileY: number }
  | { type: 'demolish'; buildingId: string }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'set_work_mode'; buildingId: string; mode: string }
  | { type: 'set_wage'; buildingId: string; level: 1|2|3|4|5 }
  | { type: 'enact_edict'; edictId: string }
  | { type: 'set_trade_route'; partnerId: string; resource: string; amount: number }
  | { type: 'diplomatic_action'; action: string; targetIso3: string };
```

### 5.4 상태 동기화 전략

```
Globe 관전 중 (In-Game 미진입):
  - CitySimEngine은 서버에서 자동 진행 (AI NationalAI가 건설/정책 결정)
  - Globe는 1Hz로 요약 데이터만 수신

In-Game 진입 시:
  - 해당 국가 city_state 구독 시작 (2Hz 상세 데이터)
  - 유저 명령 → city_command → 서버 CitySimEngine 반영
  - AI NationalAI는 유저가 관리 중인 국가에서는 보조 역할로 전환
    (유저 미조작 건물/정책만 AI가 자동 처리)

In-Game 이탈 시:
  - city_state 구독 해제
  - AI NationalAI가 다시 전체 관리 모드로 전환

## 6. 경제 시스템 (Tropico 기반)

Tropico의 계층형 생산 체인을 v26에 맞게 적용한다.

### 6.1 자원 계층

```
Tier 1 (원자재, 15종):
  농업: 곡물, 사탕수수, 담배, 목화, 커피, 과일
  축산: 가축
  수산: 어류
  임업: 원목
  광업: 철, 석탄, 금, 우라늄
  에너지: 석유, 천연가스

Tier 2 (가공품, 12종):
  식품: 통조림, 럼, 시가, 초콜릿
  소재: 판자, 강철, 플라스틱
  섬유: 의류
  정유: 연료
  기계: 부품

Tier 3 (고급 가공품, 6종):
  자동차, 전자제품, 보석, 의약품, 무기, 선박
```

### 6.2 생산 체인 예시

```
사탕수수(농장) → 럼(증류소) → 수출 $9,200/단위
철(광산) + 석탄(광산) → 강철(제철소) → 자동차(차량공장) → 수출 $28,000/단위
원목(벌목장) → 판자(제재소) → 선박(조선소) → 수출 $32,000/단위
목화(농장) → 의류(방직공장) → 수출 $5,600/단위
```

### 6.3 경제 틱 (서버)

```go
// 매 10초 (게임 내 1개월)
func (c *CitySimEngine) EconomyTick() {
    // 1. 생산: 가동 중인 건물의 output 생성 (효율 * 기본 생산량)
    // 2. 소비: 가공 건물이 원자재 소비
    // 3. 시민 소비: 식량, 오락, 주거 등 자원 소비
    // 4. 임금 지출: 고용된 시민에게 급여 (국고 → 시민)
    // 5. 건물 유지비: 국고에서 차감
    // 6. 무역 정산: 수출 수입, 수입 지출 (항구 건물 기준)
    // 7. 세금 징수: 시민 소득 기반 세율 적용
    // 8. GDP 계산: 생산량 + 무역 + 관광 - 수입 비용
    // 9. EconomyEngine 동기화: GDP/무역 데이터를 글로벌 엔진에 반영
}
```

### 6.4 국가별 자원 분포

기존 v11의 `resources` 프로필(oil/minerals/food/tech/manpower)을 **Tier 1 자원 분포**로 확장:

```typescript
interface CountryResourceProfile {
  // 기존 (v11, 0~100 정규화)
  oil: number;       // → 석유/천연가스 매장량
  minerals: number;  // → 철/석탄/금/우라늄 매장량
  food: number;      // → 곡물/가축/어류 생산 잠재력
  tech: number;      // → 전자/의약품 가공 효율 보너스
  manpower: number;  // → 초기 인구 + 노동자 공급

  // v26 신규
  farmland: number;    // 농지 비율 (타일맵에서 평지 비율)
  forest: number;      // 산림 비율 (원목)
  coastline: number;   // 해안선 (어업 + 항구 + 관광)
  climate: 'tropical' | 'temperate' | 'arid' | 'cold' | 'continental';
}
```

### 6.5 무역 시스템

Tropico의 무역 노선 계약 기반:

```typescript
interface TradeRoute {
  id: string;
  partnerIso3: string;        // 거래 상대국
  resource: string;            // 거래 자원
  direction: 'export' | 'import';
  contractAmount: number;      // 계약 물량
  deliveredAmount: number;     // 이행된 물량
  priceBonus: number;          // 외교 관계 기반 가격 보너스 (5~20%)
  status: 'active' | 'completed' | 'cancelled';
}
```

- 무역 슬롯: 항구 1개당 2개 노선, 공항 1개당 1개 노선
- 외교 관계 좋을수록 가격 보너스 증가
- 제재 시 해당국 무역 차단

## 7. 정치·파벌 시스템

### 7.1 4 대립축 파벌 (Tropico 기반)

```
축 1: 자본가 ⟷ 공산주의자   (경제 이념)
축 2: 환경주의자 ⟷ 산업주의자  (환경 vs 개발)
축 3: 종교인 ⟷ 군국주의자    (가치관)
축 4: 보수주의자 ⟷ 진보주의자  (사회 변화)
```

시민은 최대 4개 파벌(축당 1개)에 동시 소속 가능. 같은 축의 대립 파벌에는 동시 가입 불가.

### 7.2 파벌 호감도 시스템

| 파벌 | 호감도 증가 | 호감도 감소 |
|------|-----------|-----------|
| 자본가 | 세금 인하, 사유화, 무역 확대 | 국영화, 높은 세율 |
| 공산주의 | 평등 임금, 국영 기업, 무상 의료 | 사유화, 고급 주거 |
| 환경 | 풍력/태양광, 공원, 유기농 | 공장, 광산, 석유 |
| 산업 | 공장 건설, 광업 확대, 수출 | 환경 규제, 생산 제한 |
| 종교 | 교회 건설, 종교 교육 | 무신론 정책, 카지노 |
| 군사 | 병영, 무기고, 군비 확대 | 평화주의, 군축 |
| 보수 | 전통 유지, 이민 제한 | 급진적 개혁, 개방 정책 |
| 진보 | 교육 투자, 연구, 개방 | 검열, 전통 강제 |

### 7.3 최후통첩 (Tropico 스타일)

파벌 호감도 < 25 → 최후통첩 발동:

| 파벌 | 실패 시 제재 (1년간) |
|------|-------------------|
| 공산주의자 | 전체 노동자 파업 → 생산 정지 |
| 군국주의자 | 쿠데타 시도 → 군 절반 반란 |
| 자본가 | 금융 위기 → 모든 비용 2배 |
| 진보주의자 | 해킹 공격 → 연구 포인트 초기화 |
| 종교인 | 대규모 시위 → 관광 수입 0 |
| 환경주의자 | 국제 고발 → 외교 관계 전체 -20 |
| 산업주의자 | 자본 도피 → GDP -30% |
| 보수주의자 | 사보타주 → 건설 속도 -50% |

### 7.4 선거

- 시즌 Era당 1회 선거 (4주 시즌 → 주당 1 Era → 4회 선거)
- 시민 투표: 개인 행복도 + 파벌 호감도 종합
- 선거 연설: 6단계 (서문 → 문제 인정 → 파벌 칭찬 → 약속 → 결어)
- 부정 선거: 가능 (지식인/진보 반발)
- 패배 시: 게임 오버 (해당 국가 관리 권한 상실 → Globe로 퇴출)

### 7.5 칙령 (Edicts)

시대별 해금되는 정책. 국고 비용 + 파벌 호감도 영향:

```typescript
interface Edict {
  id: string;
  name: string;
  era: 1 | 2 | 3 | 4;
  cost: number;
  monthlyCost: number;
  effects: {
    factionEffects: Map<FactionId, number>;  // 호감도 변동
    economyEffect: Partial<EconomyModifiers>;
    happinessEffect: Partial<HappinessModifiers>;
  };
}

// 예시: "무상 의료" → 의료 행복도 +20, 공산주의자 +15, 자본가 -10, 월 유지비 $5,000
```

## 8. AI 에이전트 기반 시민 시뮬레이션

v26의 핵심 차별점: Tropico의 시민이 **AI 에이전트**로서 자율적으로 행동한다.

### 8.1 시민 에이전트 구조

```typescript
interface CitizenAgent {
  id: string;
  name: string;

  // 인구통계
  age: number;
  education: 'uneducated' | 'highschool' | 'college';
  wealthClass: 'poor' | 'working' | 'comfortable' | 'rich' | 'elite';

  // 파벌 소속 (4개 축 중 최대 4개)
  factions: FactionId[];
  factionLoyalty: Map<FactionId, 'normal' | 'loyal' | 'zealot'>;

  // 행복도 (8개 요소)
  happiness: {
    food: number;       // 식량
    healthcare: number; // 의료
    entertainment: number; // 오락
    faith: number;      // 신앙
    housing: number;    // 주거
    job: number;        // 직업
    liberty: number;    // 자유
    safety: number;     // 안전
  };
  overallHappiness: number;  // 8개 평균

  // 고용
  workplace: string | null;  // building ID
  home: string | null;       // building ID
  salary: number;
  savings: number;

  // 위치 & 행동
  tileX: number;
  tileY: number;
  currentAction: 'working' | 'commuting' | 'shopping' | 'resting' | 'protesting' | 'idle';
  actionTarget: string | null;  // 목적지 building ID
}
```

### 8.2 시민 AI 행동 루프

```
매 경제 틱 (10초):
  1. 출근: home → workplace 이동 (도로 경로)
  2. 생산: workplace에서 근무 (건물 효율에 기여)
  3. 퇴근: workplace → home (또는 오락/상업 시설 경유)
  4. 소비: 식료품점(식량), 병원(의료), 오락시설(오락) 방문
  5. 투표 의향: 행복도 기반 지지율 계산
  6. 이민 판단: 전체 행복도 < 30 → 이민 확률 증가

특수 행동:
  - 실업 시: 빈둥거림(idle) + 범죄율 기여
  - 파업 시: 직장 앞 시위 (공산당 최후통첩 실패)
  - 반란 시: 자유 행복도 < 20 → 반란군 합류 확률
```

### 8.3 시민 수 스케일링

195국 전체의 AI 시민을 시뮬레이션하므로, 실제 인구 대신 **대리 비율**을 사용:

| 국가 Tier | 실제 인구 | 시뮬 시민 수 | 1 시민 = X만 명 |
|-----------|----------|-------------|---------------|
| S (미국) | 3.3억 | 300~500 | 66~110만 |
| A (한국) | 5천만 | 150~300 | 17~33만 |
| B (지역) | 1천만~1억 | 80~150 | 12~67만 |
| C (일반) | 100만~1천만 | 30~80 | 3~13만 |
| D (소국) | <100만 | 15~30 | ~3만 |

서버에서 195국 × 평균 100 시민 = ~19,500 에이전트 동시 시뮬레이션. 각 에이전트의 행동은 간단한 규칙 기반(FSM)이므로 CPU 부담은 제한적.

### 8.4 기존 v16 AI 시스템과의 관계

v16의 `NationalAI`(국가 전략 AI)는 **국가 차원의 의사결정**을 담당:
- 어떤 건물을 건설할지 (자원 분석 기반)
- 어떤 무역 노선을 개설할지
- 어떤 외교 행동을 취할지
- 어떤 칙령을 시행할지

v26의 시민 에이전트는 **개인 차원의 행동**을 담당:
- 어디서 일할지 (고용 시장)
- 어디에 살지 (주거 시장)
- 무엇을 소비할지
- 누구를 지지할지 (투표)

**계층 관계**: NationalAI (매크로) → CitySimEngine (도시 로직) → CitizenAgent (미크로)

## 9. 기술 방향

### 9.1 프론트엔드

| 기술 | 용도 | 이유 |
|------|------|------|
| **PixiJS 8** | 아이소메트릭 2D 렌더링 | 60fps 타일맵, 스프라이트 배치, 모바일 호환 |
| **@pixi/tilemap** | 효율적 타일맵 렌더링 | InstancedMesh 수준의 배치 최적화 |
| **Next.js 15** | 프레임워크 (기존) | 유지 |
| **R3F (Three.js)** | Globe 뷰 (기존) | 유지 — Iso 뷰와 공존 |
| **Zustand** | 클라이언트 상태 관리 | Iso 뷰의 건물/시민/경제 상태 |

**PixiJS ↔ R3F 공존**: Globe(R3F)와 Isometric(PixiJS)는 동시에 렌더링하지 않으므로 Canvas 전환으로 충분. Globe에서 국가 클릭 → R3F unmount → PixiJS mount.

### 9.2 백엔드 (Go)

| 패키지 | 용도 |
|--------|------|
| `internal/city/engine.go` | CitySimEngine — 도시 시뮬 오케스트레이터 |
| `internal/city/building.go` | 건물 타입 정의, 생산/소비 로직 |
| `internal/city/citizen.go` | 시민 에이전트 FSM, 행동 루프 |
| `internal/city/tilemap.go` | 타일맵 생성, 지형 배치, 경로 탐색 |
| `internal/city/production.go` | 생산 체인 실행, 자원 흐름 |
| `internal/city/trade.go` | 무역 노선, 수출/수입 정산 |
| `internal/politics/faction.go` | 4대립축 파벌 시스템 |
| `internal/politics/election.go` | 선거, 투표, 연설 |
| `internal/politics/edict.go` | 칙령 시스템 |

### 9.3 에셋 생성

| 에셋 | 방법 | 수량 |
|------|------|------|
| 건물 스프라이트 | Gemini AI (아이소메트릭 픽셀아트) | 80종 × 3 레벨 = 240 |
| 시민 스프라이트 | Gemini AI (8방향 걷기 애니) | 6종(교육/부) × 8방향 = 48 |
| 타일 텍스처 | Gemini AI + 수동 | 10종 (평지/물/산/숲/사막/도로 등) |
| UI 아이콘 | Gemini AI | 자원 33종 + 건물 80종 + 파벌 8종 |

### 9.4 성능 목표

| 항목 | 목표 |
|------|------|
| Iso 뷰 FPS | 60fps (S tier 500건물 + 500시민) |
| 서버 틱 | 100ms 이하 (195국 동시 시뮬) |
| Globe→Iso 전환 | 1초 이내 |
| 동시접속 | 1,000 유저 (각자 1국 관리) |
| 메모리 (서버) | ~2GB (195국 × 100시민 × 100건물) |

## 10. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 195국 동시 시뮬 성능 | 서버 과부하 | 비활성 국가는 10초→60초 틱으로 감소, 활성 국가만 상세 시뮬 |
| PixiJS 아이소 에셋 대량 생산 | 개발 시간 | Gemini AI 일괄 생성 + 템플릿 기반 변형 |
| 경제 밸런스 | 특정 생산 체인이 압도적 | v16 SimEngine Headless 모드로 몬테카를로 밸런스 테스트 |
| Globe↔Iso 전환 UX | 맥락 상실 | 전환 애니메이션 + Iso 뷰에 미니맵(Globe) 표시 |
| 기존 Arena 코드 대체 범위 | 호환성 파괴 | Arena 코드는 `components/game/ar/`에 격리됨, Iso는 `components/game/iso/`에 신규 |
| 파벌 정치의 복잡성 | 신규 유저 학습곡선 | 초기 Era(개척)는 2파벌만, Era 진행에 따라 점진적 해금 |
| AI 시민 pathfinding | 대규모 타일맵 성능 | A* 캐시 + 구역(zone) 기반 계층적 pathfinding |

## 구현 로드맵

### Phase 1: 아이소메트릭 렌더링 기반
| Task | 설명 |
|------|------|
| PixiJS 설치 | `npm install pixi.js @pixi/tilemap` + tsconfig paths 설정, R3F와 Canvas 전환 공존 검증 |
| PixiJS 통합 | Next.js에 PixiJS 8 동적 Canvas 마운트 (`dynamic(() => import(...), { ssr: false })`), WebGL context 관리 |
| 타일맵 렌더링 | 아이소메트릭 다이아몬드 타일맵 (64x32), 스크롤/줌/팬 카메라 |
| 타일 타입 시스템 | 지형 타입 (평지/물/산/숲/사막/해안) 정의, 색상 기반 렌더 |
| 건물 배치 UI | 클릭으로 건물 배치, 유효성 검사 (타일 점유, 자원 요건) |
| Globe↔Iso 전환 | WorldView에 `onManageCountry` prop 추가 (GlobeHoverPanel + CountryPanel 연동), R3F unmount → PixiJS mount |

- **design**: N (엔진 기반)
- **verify**: PixiJS 캔버스 렌더링, 타일맵 스크롤, 건물 배치 클릭 동작, Globe 전환

### Phase 2: 서버 CitySimEngine 코어
| Task | 설명 |
|------|------|
| CitySimEngine 구조체 | Go 패키지 `internal/city/`, 195국 도시 상태 관리 |
| EconomyEngine.ManualTick 래퍼 | 기존 `processCountryTick` (private) → `ManualTick(iso3 string)` public 래퍼 추가, CitySimEngine에서 개별 국가 틱 트리거용 |
| 건물 시스템 | 58종 건물 타입 정의 (§11.4~11.7 에셋 매니페스트 기준), 생산/소비/고용 데이터 |
| 자원·생산 체인 | Tier 1→2→3 생산 로직, 재고 관리, 효율 계산 |
| 경제 틱 루프 | 10초 주기 경제 시뮬: 생산→소비→임금→유지비→무역→세금→GDP |
| Shared Types city.ts | `packages/shared/src/types/city.ts` 생성 — CityClientState, CityCommand, Building, CitizenAgent 인터페이스 |
| WebSocket city_state | protocol.go에 EventCityState/EventCityCommand 상수 추가, city_state 2Hz 브로드캐스트, city_command 수신 처리 |

- **design**: N (서버 로직)
- **verify**: Go 빌드, 단일 국가 경제 틱 실행, city_state JSON 직렬화

### Phase 3: 시민 에이전트 시스템
| Task | 설명 |
|------|------|
| CitizenAgent 구조체 | 인구통계, 파벌, 행복도 8요소, 고용, 위치 |
| 시민 FSM | working/commuting/shopping/resting/protesting/idle 상태 전이 |
| 행복도 계산 | 8요소 평균 → 전체 행복도, 건물 접근성 기반 |
| 고용 시스템 | 건물별 고용 슬롯, 교육 요건 매칭, 임금 수준 |
| 시민 이동 렌더링 | PixiJS 스프라이트 시민 아이소 이동 (도로 경로) |

- **design**: N
- **verify**: 시민 생성, FSM 상태 전이, 행복도 계산, 화면에 시민 스프라이트 이동

### Phase 4: 경제 UI + 생산 시각화
| Task | 설명 |
|------|------|
| 자원 HUD | 상단 자원 바 (국고, 주요 자원 재고, 인구) |
| 건물 정보 패널 | 우측 패널: 선택 건물 상세 (생산량, 노동자, 효율, 업그레이드) |
| 생산 체인 오버레이 | 건물 간 자원 흐름 시각화 (화살표 연결선) |
| 건설 패널 | 하단 건물 카테고리 탭 + 건물 목록 (비용, 요건, 설명) |
| 경제 대시보드 | GDP 그래프, 수입/지출 파이차트, 무역 수지 |

- **design**: Y (UI 중심)
- **verify**: HUD 표시, 건물 선택→패널 표시, 건설 패널 동작

### Phase 5: 파벌·정치 시스템
| Task | 설명 |
|------|------|
| 파벌 데이터 | Go: 4대립축 8파벌 정의, 호감도 시스템 |
| 시민 파벌 소속 | 시민 생성 시 파벌 배정, 행동에 따른 변동 |
| 칙령 시스템 | 시대별 칙령 목록, 비용/효과/파벌 영향 |
| 최후통첩 | 호감도 < 25 → 최후통첩 발동, 실패 시 제재 |
| 정치 UI | 파벌 호감도 바, 칙령 목록, 최후통첩 경고 |

- **design**: Y (정치 UI)
- **verify**: 파벌 호감도 변동, 칙령 시행, 최후통첩 트리거

### Phase 6: 선거 + 외교 연동
| Task | 설명 |
|------|------|
| 선거 시스템 | Era당 1회 선거, 시민 투표 시뮬, 결과 반영 |
| 선거 연설 UI | 6단계 연설 미니게임 |
| 무역 노선 | 항구 기반 무역 개설, 자원 교환, 가격 보너스 |
| Globe 외교 연동 | DiplomacyEngine ↔ CitySimEngine 양방향 동기화 |
| 전쟁 영향 | WarManager 전쟁 상태 → 도시 전시체제 적용 |

- **design**: Y (선거/무역 UI)
- **verify**: 선거 실행, 무역 노선 개설, 전쟁 시 도시 영향 반영

### Phase 7: AI 에셋 생성 + 시각 고도화
| Task | 설명 |
|------|------|
| 건물 스프라이트 생성 | Gemini AI → 80종 아이소메트릭 건물 스프라이트 |
| 시민 스프라이트 생성 | Gemini AI → 6종 × 8방향 시민 걷기 스프라이트 |
| 타일 텍스처 | Gemini AI → 10종 지형 타일 |
| UI 아이콘 | Gemini AI → 자원/건물/파벌 아이콘 |
| 시각 폴리싱 | 그림자, 파티클, 건물 애니메이션, 시민 이모지 말풍선 |

- **design**: N (에셋 생성)
- **verify**: 모든 스프라이트 렌더링 확인, 빌드 성공

### Phase 8: Globe↔Iso 완전 통합 + 밸런스
| Task | 설명 |
|------|------|
| 양방향 데이터 동기화 | GDP/군사/행복도 → Globe 국력 반영, Globe 이벤트 → 도시 영향 |
| NationalAI 연동 | AI가 관리하지 않는 194국 자동 운영 |
| 관전 모드 | 다른 유저의 국가를 관전 (읽기 전용 Iso 뷰) |
| 밸런스 테스트 | Headless 시뮬로 195국 경제/정치 밸런스 검증 |
| 성능 최적화 | 비활성 국가 틱 감소, 타일맵 culling, 시민 LOD |

- **design**: N
- **verify**: 195국 동시 시뮬 가동, Globe↔Iso 전환 1초 이내, 서버 CPU 안정

## Key Technical Decisions

### PixiJS vs Three.js (Phase 1)
아이소메트릭 2D 타일맵은 PixiJS가 Three.js orthographic 카메라보다 성능·개발 속도 모두 우월. PixiJS의 `@pixi/tilemap`은 대규모 타일맵에 최적화된 batching을 제공하며, 2D 스프라이트 에셋은 AI 생성이 3D 모델보다 훨씬 빠르다.

### Tropico 188 → 60~80 건물 (Phase 2)
195국 규모에서 건물 다양성보다 **시스템 간 연결**이 더 중요. 각 건물이 경제·파벌·행복도에 명확한 영향을 미치는 것이 핵심.

### 시민 에이전트 규칙 기반 FSM (Phase 3)
LLM 기반 에이전트가 아닌 **규칙 기반 FSM**으로 시민 시뮬. 195국 × 100명 = 19,500 에이전트를 실시간으로 돌려야 하므로 LLM 호출은 비현실적. NationalAI(국가 전략)만 선택적 LLM 사용.

### 경제 틱 10초 (Phase 2)
Tropico의 실시간 시뮬을 웹 게임에 맞게 **10초 = 게임 내 1개월**로 시간 압축. 1 시즌(4주) = 4 Era × 12 틱/Era = 48 경제 틱 ≈ 8분.

### Arena 코드 보존 (전체)
기존 `components/game/ar/` 29개 컴포넌트는 삭제하지 않고 보존. v26 Iso 뷰는 `components/game/iso/`에 완전 별도 구현. 추후 Arena 전투를 특수 이벤트로 부활시킬 수 있음 (예: 전쟁 시 Arena 미니게임).

## Verification
1. `npx tsc --noEmit` — 0 errors
2. PixiJS 아이소 뷰 렌더링 (타일맵 + 건물 + 시민)
3. Globe ↔ Iso 전환 (1초 이내)
4. 건물 배치 → 서버 반영 → 생산 시작
5. 시민 출퇴근 경로 이동 시각화
6. 경제 틱 → GDP 변동 → Globe 국력 반영
7. 파벌 호감도 → 최후통첩 → 제재 적용
8. 선거 → 투표 → 결과 반영
9. 무역 노선 → 수출입 → 경제 효과
10. 195국 동시 시뮬 서버 안정성 (CPU < 80%)
11. 60fps (S tier 국가, 500건물 + 500시민)

## 11. 에셋 매니페스트 (da:asset 호환)

> Phase 7에서 Gemini AI (`gemini-3.1-flash-image-preview`)로 일괄 생성하는 전체 에셋 목록.
> 모든 프롬프트는 **스타일 일관성**을 위해 공통 프리픽스를 공유한다.

### 11.1 공통 스타일 프리픽스

모든 da:asset 프롬프트의 앞에 아래 프리픽스를 붙인다:

```
STYLE_PREFIX = "isometric pixel art, 2.5D perspective at 30-degree angle,
clean flat colors with subtle cel-shading, dark outlines 1px,
transparent background (PNG alpha), game asset sprite,
consistent lighting from top-left, tiny shadow on ground plane"
```

### 11.2 크기 표준

| 에셋 카테고리 | 크기 (px) | 비고 |
|-------------|----------|------|
| 타일 (지형) | 64×32 | 다이아몬드 아이소 표준 |
| 건물 (소형) | 64×64 | 1×1 타일 점유 |
| 건물 (중형) | 128×96 | 2×2 타일 점유 |
| 건물 (대형) | 128×128 | 3×3 타일 점유 |
| 시민 스프라이트 | 32×32 | 8방향 걷기 |
| UI 아이콘 | 32×32 | 자원/건물/파벌 |
| 파티클/이펙트 | 16×16 | 연기/불꽃/별 |

### 11.3 타일 텍스처 (10종)

| # | 에셋명 | 파일 경로 | da:asset 프롬프트 |
|---|--------|---------|-----------------|
| T01 | 평지(풀밭) | `public/textures/iso/tiles/grass.png` | `{PREFIX}, single isometric diamond tile 64x32, lush green grass terrain, tiny grass tufts detail, game tile seamless` |
| T02 | 농경지 | `public/textures/iso/tiles/farmland.png` | `{PREFIX}, single isometric diamond tile 64x32, brown plowed farmland with crop rows, fertile soil texture` |
| T03 | 사막/건조 | `public/textures/iso/tiles/desert.png` | `{PREFIX}, single isometric diamond tile 64x32, sandy desert terrain, warm beige dunes, tiny cactus detail` |
| T04 | 물/바다 | `public/textures/iso/tiles/water.png` | `{PREFIX}, single isometric diamond tile 64x32, deep blue ocean water, subtle wave pattern, semi-transparent` |
| T05 | 산/바위 | `public/textures/iso/tiles/mountain.png` | `{PREFIX}, single isometric diamond tile 64x32, rocky gray mountain terrain, snow-capped peak small detail` |
| T06 | 숲 | `public/textures/iso/tiles/forest.png` | `{PREFIX}, single isometric diamond tile 64x32, dense green forest canopy from above, tree top pattern` |
| T07 | 해안/모래 | `public/textures/iso/tiles/beach.png` | `{PREFIX}, single isometric diamond tile 64x32, light sandy beach, gentle wave edge, coastal terrain` |
| T08 | 도로 | `public/textures/iso/tiles/road.png` | `{PREFIX}, single isometric diamond tile 64x32, gray asphalt road, yellow center line, clean paved surface` |
| T09 | 동토/설원 | `public/textures/iso/tiles/tundra.png` | `{PREFIX}, single isometric diamond tile 64x32, white snowy tundra, ice patches, frozen ground` |
| T10 | 강/하천 | `public/textures/iso/tiles/river.png` | `{PREFIX}, single isometric diamond tile 64x32, flowing blue river through green banks, freshwater` |

### 11.4 건물 스프라이트 — Tier 1 원자재 (15종 × 3 레벨 = 45)

> 레벨별 변형: Lv1=기본, Lv2=확장+연기, Lv3=현대화+기계

| # | 건물명 | 크기 | da:asset 프롬프트 (Lv1 기본) |
|---|--------|------|---------------------------|
| B01 | 농장(곡물) | 128×96 | `{PREFIX}, isometric wheat farm building, golden crop field with small barn, wooden fence, farmer NPC tiny` |
| B02 | 사탕수수 농장 | 128×96 | `{PREFIX}, isometric sugarcane plantation, tall green cane stalks, tropical farm hut, harvest basket` |
| B03 | 담배 농장 | 128×96 | `{PREFIX}, isometric tobacco farm, rows of broad-leaf plants, drying shed, wooden structure` |
| B04 | 목화 농장 | 128×96 | `{PREFIX}, isometric cotton farm, white fluffy cotton plants, spinning wheel near shed` |
| B05 | 커피 농장 | 128×96 | `{PREFIX}, isometric coffee plantation, green bushes with red berries, tropical hillside farm` |
| B06 | 과일 농장 | 128×96 | `{PREFIX}, isometric fruit orchard, colorful fruit trees (orange apple), basket of fruits` |
| B07 | 목장(가축) | 128×96 | `{PREFIX}, isometric cattle ranch, cows grazing green pasture, red barn, wooden corral` |
| B08 | 어항(어업) | 128×96 | `{PREFIX}, isometric fishing dock, small fishing boats, wooden pier, fish barrels, ocean edge` |
| B09 | 벌목장 | 128×96 | `{PREFIX}, isometric lumber camp, log piles, tree stumps, sawing station, forest clearing` |
| B10 | 철 광산 | 128×96 | `{PREFIX}, isometric iron mine entrance, minecart tracks, gray rocky hill, pickaxe tools` |
| B11 | 석탄 광산 | 128×96 | `{PREFIX}, isometric coal mine, dark entrance, coal pile, conveyor belt, dusty atmosphere` |
| B12 | 금 광산 | 64×64 | `{PREFIX}, isometric gold mine, golden ore sparkle, reinforced tunnel entrance, small operation` |
| B13 | 우라늄 광산 | 128×96 | `{PREFIX}, isometric uranium mine, hazard warning signs, green glow, high-security fencing` |
| B14 | 유전(석유) | 128×96 | `{PREFIX}, isometric oil derrick pump, black crude barrel, pipeline, industrial desert setting` |
| B15 | 가스전 | 128×96 | `{PREFIX}, isometric natural gas extraction facility, flame stack, steel pipes, processing unit` |

**레벨 변형 프롬프트 접미사**:
- Lv2: `..., upgraded version with additional machinery, more workers, small chimney with smoke`
- Lv3: `..., modern high-tech version, automated machinery, steel and glass, LED lights, maximum production`

### 11.5 건물 스프라이트 — Tier 2 가공 (12종 × 3 레벨 = 36)

| # | 건물명 | 크기 | da:asset 프롬프트 (Lv1) |
|---|--------|------|----------------------|
| B16 | 통조림 공장 | 128×96 | `{PREFIX}, isometric cannery factory, conveyor belt with cans, steam vent, brick building` |
| B17 | 럼 증류소 | 128×96 | `{PREFIX}, isometric rum distillery, copper pot stills, oak barrels, tropical style building` |
| B18 | 시가 공장 | 64×64 | `{PREFIX}, isometric cigar factory, tobacco leaves drying, rolling tables, elegant building` |
| B19 | 초콜릿 공장 | 128×96 | `{PREFIX}, isometric chocolate factory, cocoa processing, sweet aroma steam, colorful building` |
| B20 | 제재소 | 128×96 | `{PREFIX}, isometric sawmill, circular saw blade, log feeding, lumber piles, wooden structure` |
| B21 | 제철소 | 128×128 | `{PREFIX}, isometric steel mill, glowing furnace, molten metal, heavy industrial, smoke stacks` |
| B22 | 플라스틱 공장 | 128×96 | `{PREFIX}, isometric plastics factory, chemical vats, extruder machine, modern industrial` |
| B23 | 방직 공장 | 128×96 | `{PREFIX}, isometric textile mill, spinning looms, fabric rolls, brick factory building` |
| B24 | 정유소 | 128×128 | `{PREFIX}, isometric oil refinery, distillation towers, pipeline maze, industrial complex` |
| B25 | 부품 공장 | 128×96 | `{PREFIX}, isometric parts factory, assembly line, metal gears, precision machinery` |
| B26 | 가구 공장 | 64×64 | `{PREFIX}, isometric furniture workshop, wooden chairs and tables, crafting tools` |
| B27 | 식품 가공 | 128×96 | `{PREFIX}, isometric food processing plant, clean white building, packaging line, refrigeration` |

### 11.6 건물 스프라이트 — Tier 3 고급 가공 (6종 × 3 레벨 = 18)

| # | 건물명 | 크기 | da:asset 프롬프트 (Lv1) |
|---|--------|------|----------------------|
| B28 | 차량 공장 | 128×128 | `{PREFIX}, isometric car factory, assembly robots, conveyor with cars, massive industrial hall` |
| B29 | 전자 공장 | 128×128 | `{PREFIX}, isometric electronics factory, clean room, circuit boards, blue LED glow, high-tech` |
| B30 | 보석 세공 | 64×64 | `{PREFIX}, isometric jeweler workshop, gem cutting station, display case, elegant small building` |
| B31 | 제약 공장 | 128×96 | `{PREFIX}, isometric pharmaceutical plant, lab equipment, medicine bottles, sterile white building` |
| B32 | 무기 공장 | 128×128 | `{PREFIX}, isometric arms factory, military crates, camouflage paint, security fencing, restricted` |
| B33 | 조선소 | 128×128 | `{PREFIX}, isometric shipyard, dry dock, ship hull under construction, cranes, harbor setting` |

### 11.7 건물 스프라이트 — 서비스/인프라 (25종 × 3 레벨 = 75)

| # | 건물명 | 크기 | da:asset 프롬프트 (Lv1) |
|---|--------|------|----------------------|
| B34 | 주거(오두막) | 64×64 | `{PREFIX}, isometric small wooden shack, humble poor housing, tin roof, clothesline` |
| B35 | 주거(아파트) | 128×96 | `{PREFIX}, isometric apartment block, multi-story concrete, balconies, working class housing` |
| B36 | 주거(맨션) | 128×128 | `{PREFIX}, isometric luxury mansion, pool, garden, rich elite villa, palm trees` |
| B37 | 식료품점 | 64×64 | `{PREFIX}, isometric grocery store, fruits display outside, small market, friendly storefront` |
| B38 | 병원 | 128×96 | `{PREFIX}, isometric hospital, red cross sign, ambulance parked, white clean building` |
| B39 | 교회 | 64×64 | `{PREFIX}, isometric church, bell tower, stained glass, cross on top, stone building` |
| B40 | 학교 | 128×96 | `{PREFIX}, isometric school building, playground, flag pole, yellow bus, brick building` |
| B41 | 대학 | 128×128 | `{PREFIX}, isometric university campus, clock tower, columns, academic grand building` |
| B42 | 경찰서 | 64×64 | `{PREFIX}, isometric police station, patrol car parked, blue and white building, siren light` |
| B43 | 소방서 | 64×64 | `{PREFIX}, isometric fire station, red fire truck visible, large garage door, red building` |
| B44 | 군 병영 | 128×96 | `{PREFIX}, isometric military barracks, camouflage design, barbed wire fence, watchtower` |
| B45 | 무기고 | 64×64 | `{PREFIX}, isometric armory depot, military crates, reinforced bunker style, camouflage` |
| B46 | 항구 | 128×128 | `{PREFIX}, isometric seaport, cargo ship docked, crane loading containers, warehouse` |
| B47 | 공항 | 128×128 | `{PREFIX}, isometric airport, runway with airplane, control tower, terminal building` |
| B48 | 발전소(석탄) | 128×96 | `{PREFIX}, isometric coal power plant, cooling towers, smoke stack, industrial grid` |
| B49 | 발전소(풍력) | 64×64 | `{PREFIX}, isometric wind turbine, tall white tower, spinning blades, green energy` |
| B50 | 발전소(태양광) | 128×96 | `{PREFIX}, isometric solar farm, rows of solar panels, blue reflective, clean energy` |
| B51 | 발전소(원자력) | 128×128 | `{PREFIX}, isometric nuclear power plant, dome reactor, cooling tower steam, high security` |
| B52 | 관광 호텔 | 128×128 | `{PREFIX}, isometric resort hotel, swimming pool, palm trees, beach access, luxury tourism` |
| B53 | 카지노 | 128×96 | `{PREFIX}, isometric casino, neon lights, grand entrance, flashy entertainment building` |
| B54 | 공원 | 128×96 | `{PREFIX}, isometric city park, fountain center, benches, flower beds, walking paths, trees` |
| B55 | 방송국 | 64×64 | `{PREFIX}, isometric TV station, satellite dish on roof, broadcast tower, media building` |
| B56 | 연구소 | 128×96 | `{PREFIX}, isometric research lab, satellite dish, observatory dome, scientific equipment` |
| B57 | 정부 청사 | 128×128 | `{PREFIX}, isometric government palace, grand columns, flag on top, steps, official building` |
| B58 | 도로(직선) | 64×32 | `{PREFIX}, isometric road segment, gray asphalt, white lane markings, connects buildings` |

### 11.8 시민 스프라이트 (6종 × 8방향 = 48)

> 각 시민 타입은 8방향(N/NE/E/SE/S/SW/W/NW) 걷기 프레임 2장씩 = 총 96장.
> 실제 생성은 4방향(SE/SW/NE/NW) + 수평 반전으로 8방향 커버.

| # | 시민 타입 | 외형 설명 | da:asset 프롬프트 |
|---|----------|---------|-----------------|
| C01 | 무학 노동자 | 작업복, 안전모 | `{PREFIX}, tiny isometric worker character 32x32, hard hat, blue coveralls, walking pose, side view SE direction` |
| C02 | 고졸 시민 | 캐주얼, 가방 | `{PREFIX}, tiny isometric citizen character 32x32, casual clothes, backpack, walking pose, side view SE direction` |
| C03 | 대졸 전문직 | 셔츠+넥타이, 서류가방 | `{PREFIX}, tiny isometric professional character 32x32, shirt and tie, briefcase, walking pose, side view SE direction` |
| C04 | 부유층 | 정장, 고급 | `{PREFIX}, tiny isometric wealthy character 32x32, luxury suit, cane, walking pose, side view SE direction` |
| C05 | 군인 | 군복, 헬멧 | `{PREFIX}, tiny isometric soldier character 32x32, camouflage uniform, helmet, rifle, walking pose, SE direction` |
| C06 | 시위대 | 피켓 들고 | `{PREFIX}, tiny isometric protester character 32x32, holding picket sign, angry expression, walking pose, SE direction` |

**방향 변형 접미사**:
- SE (기본), SW: `side view {direction} direction`
- NE, NW: `back view {direction} direction`
- 반대쪽은 수평 반전 처리 (코드에서)

### 11.9 UI 아이콘 (121종)

#### 자원 아이콘 (33종)

| # | 자원 | da:asset 프롬프트 |
|---|------|-----------------|
| I01 | 곡물 | `{PREFIX}, 32x32 icon, golden wheat sheaf, game resource icon, clean simple` |
| I02 | 사탕수수 | `{PREFIX}, 32x32 icon, green sugarcane stalks bundle, game resource icon` |
| I03 | 담배 | `{PREFIX}, 32x32 icon, dried tobacco leaves, game resource icon` |
| I04 | 목화 | `{PREFIX}, 32x32 icon, white cotton boll, game resource icon` |
| I05 | 커피 | `{PREFIX}, 32x32 icon, brown coffee beans pile, game resource icon` |
| I06 | 과일 | `{PREFIX}, 32x32 icon, colorful fruit basket (apple orange), game resource icon` |
| I07 | 가축 | `{PREFIX}, 32x32 icon, cute cow head, game resource icon` |
| I08 | 어류 | `{PREFIX}, 32x32 icon, silver fish, game resource icon` |
| I09 | 원목 | `{PREFIX}, 32x32 icon, brown wooden logs stack, game resource icon` |
| I10 | 철 | `{PREFIX}, 32x32 icon, gray iron ore chunk, metallic sheen, game resource icon` |
| I11 | 석탄 | `{PREFIX}, 32x32 icon, black coal rock pile, game resource icon` |
| I12 | 금 | `{PREFIX}, 32x32 icon, shiny gold nugget, sparkle effect, game resource icon` |
| I13 | 우라늄 | `{PREFIX}, 32x32 icon, glowing green uranium rod, hazard symbol, game resource icon` |
| I14 | 석유 | `{PREFIX}, 32x32 icon, black oil barrel, dripping crude, game resource icon` |
| I15 | 천연가스 | `{PREFIX}, 32x32 icon, blue gas flame, pipe fitting, game resource icon` |
| I16 | 통조림 | `{PREFIX}, 32x32 icon, silver tin can with label, game resource icon` |
| I17 | 럼 | `{PREFIX}, 32x32 icon, brown rum bottle, pirate style, game resource icon` |
| I18 | 시가 | `{PREFIX}, 32x32 icon, premium cigar, smoke wisp, game resource icon` |
| I19 | 초콜릿 | `{PREFIX}, 32x32 icon, chocolate bar pieces, game resource icon` |
| I20 | 판자 | `{PREFIX}, 32x32 icon, stacked wooden planks, game resource icon` |
| I21 | 강철 | `{PREFIX}, 32x32 icon, steel ingot bar, metallic blue-gray, game resource icon` |
| I22 | 플라스틱 | `{PREFIX}, 32x32 icon, white plastic pellets container, game resource icon` |
| I23 | 의류 | `{PREFIX}, 32x32 icon, folded shirt and pants, game resource icon` |
| I24 | 연료 | `{PREFIX}, 32x32 icon, red gas canister, fuel symbol, game resource icon` |
| I25 | 부품 | `{PREFIX}, 32x32 icon, metal gear and screw parts, mechanical, game resource icon` |
| I26 | 자동차 | `{PREFIX}, 32x32 icon, small car silhouette, game resource icon` |
| I27 | 전자제품 | `{PREFIX}, 32x32 icon, smartphone and circuit, game resource icon` |
| I28 | 보석 | `{PREFIX}, 32x32 icon, sparkling diamond gem, luxury, game resource icon` |
| I29 | 의약품 | `{PREFIX}, 32x32 icon, medicine bottle with pills, red cross, game resource icon` |
| I30 | 무기 | `{PREFIX}, 32x32 icon, military rifle silhouette, ammo box, game resource icon` |
| I31 | 선박 | `{PREFIX}, 32x32 icon, cargo ship miniature, game resource icon` |
| I32 | 국고(돈) | `{PREFIX}, 32x32 icon, gold coins stack with dollar sign, treasury, game resource icon` |
| I33 | 전력 | `{PREFIX}, 32x32 icon, yellow lightning bolt, energy symbol, game resource icon` |

#### 파벌 아이콘 (8종)

| # | 파벌 | da:asset 프롬프트 |
|---|------|-----------------|
| F01 | 자본가 | `{PREFIX}, 32x32 icon, golden dollar sign on blue shield, capitalist faction symbol` |
| F02 | 공산주의자 | `{PREFIX}, 32x32 icon, red hammer and sickle on star, communist faction symbol` |
| F03 | 환경주의자 | `{PREFIX}, 32x32 icon, green leaf on earth globe, environmentalist faction symbol` |
| F04 | 산업주의자 | `{PREFIX}, 32x32 icon, gray factory gear with smoke, industrialist faction symbol` |
| F05 | 종교인 | `{PREFIX}, 32x32 icon, golden cross with halo light, religious faction symbol` |
| F06 | 군국주의자 | `{PREFIX}, 32x32 icon, red shield with crossed swords, militarist faction symbol` |
| F07 | 보수주의자 | `{PREFIX}, 32x32 icon, blue castle tower, traditional, conservative faction symbol` |
| F08 | 진보주의자 | `{PREFIX}, 32x32 icon, purple torch of liberty, progressive faction symbol` |

#### 행복도 아이콘 (8종)

| # | 요소 | da:asset 프롬프트 |
|---|------|-----------------|
| H01 | 식량 | `{PREFIX}, 32x32 icon, bread loaf and apple, food happiness symbol` |
| H02 | 의료 | `{PREFIX}, 32x32 icon, red heart with medical cross, healthcare happiness symbol` |
| H03 | 오락 | `{PREFIX}, 32x32 icon, theater masks comedy tragedy, entertainment happiness symbol` |
| H04 | 신앙 | `{PREFIX}, 32x32 icon, praying hands with golden light, faith happiness symbol` |
| H05 | 주거 | `{PREFIX}, 32x32 icon, cozy house with heart, housing happiness symbol` |
| H06 | 직업 | `{PREFIX}, 32x32 icon, briefcase with green checkmark, job satisfaction happiness symbol` |
| H07 | 자유 | `{PREFIX}, 32x32 icon, dove bird flying free, liberty happiness symbol` |
| H08 | 안전 | `{PREFIX}, 32x32 icon, shield with lock, safety happiness symbol` |

#### 시스템 UI 아이콘 (8종)

| # | 기능 | da:asset 프롬프트 |
|---|------|-----------------|
| U01 | 건설 모드 | `{PREFIX}, 32x32 icon, construction crane with plus sign, build mode button` |
| U02 | 철거 | `{PREFIX}, 32x32 icon, red wrecking ball, demolish button` |
| U03 | 업그레이드 | `{PREFIX}, 32x32 icon, green upward arrow with star, upgrade button` |
| U04 | 칙령 | `{PREFIX}, 32x32 icon, royal decree scroll with seal, edict policy button` |
| U05 | 선거 | `{PREFIX}, 32x32 icon, ballot box with vote checkmark, election button` |
| U06 | 무역 | `{PREFIX}, 32x32 icon, two arrows exchange with gold, trade button` |
| U07 | 외교 | `{PREFIX}, 32x32 icon, handshake symbol with globe, diplomacy button` |
| U08 | Globe 복귀 | `{PREFIX}, 32x32 icon, earth globe with return arrow, back to world map button` |

### 11.10 이펙트/파티클 스프라이트 (8종)

| # | 이펙트 | 크기 | da:asset 프롬프트 |
|---|--------|------|-----------------|
| E01 | 건설 먼지 | 16×16 | `{PREFIX}, 16x16 tiny dust cloud particle, brown construction dust, animated feel` |
| E02 | 공장 연기 | 16×16 | `{PREFIX}, 16x16 tiny smoke puff particle, gray industrial smoke, wispy` |
| E03 | 불꽃(폭발) | 16×16 | `{PREFIX}, 16x16 tiny fire explosion particle, orange flame burst` |
| E04 | 금화(수입) | 16×16 | `{PREFIX}, 16x16 tiny gold coin particle, sparkle, income indicator` |
| E05 | 빨간화(지출) | 16×16 | `{PREFIX}, 16x16 tiny red minus coin particle, expense indicator` |
| E06 | 하트(행복) | 16×16 | `{PREFIX}, 16x16 tiny pink heart particle, floating happiness indicator` |
| E07 | 분노(불만) | 16×16 | `{PREFIX}, 16x16 tiny red angry symbol particle, displeasure indicator` |
| E08 | 별(레벨업) | 16×16 | `{PREFIX}, 16x16 tiny golden star particle, sparkle, level up celebration` |

### 11.11 에셋 생성 요약

| 카테고리 | 종류 수 | 변형 포함 총 수 | 생성 방법 |
|---------|--------|--------------|----------|
| 타일 | 10 | 10 | Gemini AI |
| 건물 Tier 1 | 15 | 45 (×3 Lv) | Gemini AI |
| 건물 Tier 2 | 12 | 36 (×3 Lv) | Gemini AI |
| 건물 Tier 3 | 6 | 18 (×3 Lv) | Gemini AI |
| 건물 서비스 | 25 | 75 (×3 Lv) | Gemini AI |
| 시민 | 6 | 48 (×8 dir) | Gemini AI + 코드 반전 |
| UI 자원 아이콘 | 33 | 33 | Gemini AI |
| UI 파벌 아이콘 | 8 | 8 | Gemini AI |
| UI 행복도 아이콘 | 8 | 8 | Gemini AI |
| UI 시스템 아이콘 | 8 | 8 | Gemini AI |
| 이펙트 파티클 | 8 | 8 | Gemini AI |
| **합계** | **139** | **297** | |

### 11.12 da:asset 실행 스크립트 레퍼런스

기존 `scripts/generate-logo.mjs` 패턴을 확장:

```javascript
// scripts/generate-iso-assets.mjs
// 사용법: GEMINI_API_KEY=xxx node scripts/generate-iso-assets.mjs --category tiles
//
// 카테고리: tiles | buildings-t1 | buildings-t2 | buildings-t3 | buildings-service
//           | citizens | icons-resource | icons-faction | icons-happiness | icons-ui | effects
//
// 각 카테고리의 STYLE_PREFIX + 개별 프롬프트를 Gemini API에 전송
// base64 응답 → sharp로 배경 제거 → PNG 저장
// NearestFilter 호환을 위해 리사이즈 시 nearestNeighbor interpolation
```

### 11.13 프로시저럴 폴백 전략

Gemini AI 생성 실패 또는 API 키 미설정 시, 기존 `ar-texture-loader.ts` 패턴의 프로시저럴 생성으로 폴백:

```typescript
// 예: 건물 폴백 — OffscreenCanvas로 색상 블록 생성
function generateBuildingFallback(type: string, level: number): HTMLCanvasElement {
  const canvas = new OffscreenCanvas(128, 96);
  const ctx = canvas.getContext('2d')!;
  // 건물 타입별 색상 팔레트로 간단한 블록 건물 그리기
  // level에 따라 크기/디테일 증가
  return canvas as unknown as HTMLCanvasElement;
}
```
