# PLAN: v15 — 3D 글로브 이벤트 이펙트 시스템

## 1. 개요

3D 지구본 위에서 전쟁, 무역, 점령, 국가 이벤트를 다양하고 다채롭게 시각화하는 이펙트 시스템입니다.

**핵심 목표:**
- 전쟁 선포/진행/종료 시 미사일, 충격파, 폭발, 승리 불꽃놀이 등 역동적 애니메이션
- 무역 루트를 글로브 위에 화물선/항공 라인으로 시각화
- 점령 국가에 점유국의 국기 이미지를 오버레이로 표시
- 각 국가 아래에 현재 참여 중인 에이전트 수를 실시간 표시
- 국가별 최대 에이전트 수를 실제 인구(POP_EST) 기반으로 기존 Tier 시스템 내에서 미세 조정
- 이미지 리소스(국기 PNG, 이펙트 텍스처)는 da:asset을 적극 활용

**배경:**
- 기존 GlobeWarEffects(아크 라인 + 깜빡임 + 폭발 파티클 + 불꽃놀이) 존재하나 단조로움
- GlobeDominationLayer(색상 오버레이 셰이더) 존재하나 국기 표시 없음
- 에이전트 수 표시, 인구 기반 제한, 무역 루트 시각화는 미구현 상태

## 2. 요구사항

### 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-1 | **전쟁 이펙트 강화** — 미사일 궤적, 충격파 링, 전장 안개, 승리 불꽃놀이 확대 | Critical |
| FR-2 | **국기 오버레이** — 점유국의 실제 국기 이미지(PNG)를 해당 국가 위에 표시 | Critical |
| FR-3 | **에이전트 수 라벨** — 각 국가 centroid 아래에 현재/최대 에이전트 수 표시 | Critical |
| FR-4 | **인구 비례 에이전트 제한** — 기존 TierConfigs + Population 하이브리드 공식으로 Tier 범위 내 미세 조정 | Critical |
| FR-5 | **점령 이펙트** — 점령 진행 중 영토 색상 변화, 분쟁 해칭, 점령 완료 시 펄스 | High |
| FR-6 | **무역 루트 시각화** — 교역국 간 화물선/항공 라인 애니메이션 | Medium |
| FR-7 | **글로벌 이벤트 이펙트** — 동맹 체결(파란 링), 정책 변경(보라 파동), 에포크 완료(골드 웨이브) | Medium |
| FR-8 | **카메라 자동 포커스** — 주요 이벤트 발생 시 해당 국가로 카메라 자동 회전 | Low |

### 비기능 요구사항

| ID | 요구사항 |
|----|----------|
| NFR-1 | 성능: 60fps 유지 (InstancedMesh, GPU 파티클 사용, 195개국 동시 라벨) |
| NFR-2 | 메모리: 국기 텍스처 아틀라스 1장(2048×2048)으로 통합 |
| NFR-3 | 번들: 국기 이미지는 CDN 로드 또는 da:asset 생성 (번들 미포함) |
| NFR-4 | 모바일: 이펙트 LOD — 모바일은 파티클 수 50% 감소, 라벨 간소화 |

## 3. 기술 방향

### 렌더링 스택
- **3D 엔진**: React Three Fiber (R3F) v9 + Three.js r170 (기존 유지)
- **파티클 시스템**: InstancedMesh + useFrame (기존 패턴 유지)
- **라벨 렌더링**: CanvasTexture 아틀라스 + InstancedMesh Billboard (FlagSprite 패턴 재사용)
- **국기 이미지**: flagcdn.com CDN (`https://flagcdn.com/w80/{iso2}.png`) → CanvasTexture 아틀라스 합성
- **셰이더**: GLSL custom ShaderMaterial (기존 GlobeDominationLayer 패턴 확장)

### 서버 데이터
- **기존 에이전트 제한 (AS-IS)**: `country_data.go`의 `TierConfigs`가 Tier별 MaxAgents 고정값 관리 (S:50, A:35, B:25, C:15, D:8). `GetMaxAgents()` 메서드 존재. `countries_state` S2C에 `activeAgents` 필드 이미 포함
- **인구 데이터 (AS-IS)**: `countries_seed.go`에 195개국 `Population int64` 필드 존재하나 maxAgents 계산에 미사용. 클라이언트 GeoJSON에도 `POP_EST` 있으나 미파싱
- **에이전트 제한 확장 (TO-BE)**: `CountrySeed.Population` + `TierConfigs`를 결합한 하이브리드 공식으로 Tier 범위 내 미세 조정. `countries_state`에 `maxAgents`, `population` 필드 추가
- **무역 WS 이벤트 (신규)**: `trade_route_update` S2C 이벤트 추가 (기존 `meta/trade.go`는 REST only)
- **점령 WS 이벤트 (신규)**: `domination_update` S2C 이벤트 추가 (기존 `game/domination.go`의 `OnEvent` 콜백이 nil 상태)

### 이미지 리소스 전략
- **국기 PNG**: flagcdn.com CDN 활용 (80×60px, 195개국)
- **이펙트 텍스처**: da:asset으로 생성 (폭발 스프라이트시트, 충격파 링, 미사일 궤적)
- **텍스처 아틀라스**: 국기 195장 → 2048×2048 아틀라스 1장으로 런타임 합성

## 4. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    GlobeView (R3F Canvas)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ GlobeScene   │  │ 기존 컴포넌트 │  │  신규 컴포넌트      │ │
│  │  (공유 상태)  │  │              │  │                    │ │
│  │ • geoJSON    │  │ • EarthSphere│  │ • GlobeCountryLabels│ │
│  │ • geoMap     │  │ • Starfield  │  │   (에이전트수+국기) │ │
│  │ • centroids  │  │ • Atmosphere │  │ • GlobeMissileEffect│ │
│  │ • popMap     │  │ • Borders    │  │   (미사일 궤적)     │ │
│  └──────┬───────┘  │ • Polygons   │  │ • GlobeShockwave   │ │
│         │          │ • Interaction│  │   (충격파 링)       │ │
│         ▼          └──────────────┘  │ • GlobeTradeRoutes  │ │
│  ┌──────────────┐                    │   (무역 라인)       │ │
│  │ 기존 v14     │                    │ • GlobeEventPulse   │ │
│  │ • Domination │◄── countryGeoMap   │   (이벤트 파동)     │ │
│  │ • WarEffects │◄── centroids       └────────────────────┘ │
│  │ • HoverPanel │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
         ▲ props (useSocket → uiState)
         │
┌────────┴────────────────────────────────────────────────────┐
│ Server (Go)                                                  │
│ • country_data.go: TierConfigs + Population 하이브리드 공식  │
│ • countries_state S2C: { activeAgents(기존), maxAgents(신규) │
│ • domination_update S2C: { iso3, nation, level, color }     │
│ • trade_route_update S2C: { from, to, type, volume }        │
│ • war_declared/war_ended S2C: (기존 유지 + 강화)             │
└─────────────────────────────────────────────────────────────┘
```

### 핵심 데이터 흐름
1. **에이전트 수**: Server `countries_state` (1Hz, 기존 `activeAgents` + 신규 `maxAgents`) → useSocket.countryStates → GlobeCountryLabels
2. **국기 오버레이**: flagcdn.com CDN 로드 → FlagAtlasLoader → CanvasTexture 아틀라스 → GlobeCountryLabels (점유국 국기+숫자 통합 표시, 단일 책임)
3. **전쟁 이펙트**: Server `war_declared` → useSocket.wars → GlobeWarEffects (강화) + GlobeMissileEffect + GlobeShockwave
4. **점령 이펙트**: Server `domination_update` (신규 WS) → useSocket.dominationStates → GlobeDominationLayer (**색상 오버레이만**) + GlobeCountryLabels (국기 전환)
5. **무역 루트**: Server `trade_route_update` (신규 WS) → useSocket.tradeRoutes (신규 필드) → GlobeTradeRoutes (신규)
6. **인구 제한**: 서버 `CountrySeed.Population` + `TierConfigs` 하이브리드 공식 → arena maxAgents → join 거부/허용

## 5. 현재 상태 분석 (AS-IS)

### 존재하는 컴포넌트 (수정/확장 대상)

| 컴포넌트 | 상태 | 설명 |
|----------|------|------|
| `GlobeDominationLayer` | ✅ 동작 | 국가별 색상 오버레이 셰이더, sovereignty 펄스, hegemony 글로우 |
| `GlobeWarEffects` | ✅ 동작 | 아크 라인 + 영토 깜빡임 + 폭발 파티클 + 승리 불꽃놀이 |
| `GlobeHoverPanel` | ✅ 동작 | 마우스 호버 시 국가 정보 패널 (에이전트 수, 상태 뱃지) |
| `GlobeScene` | ✅ 동작 | R3F 씬 래퍼, GeoJSON 로드, countryGeoMap/centroids 계산 |
| `FlagSprite` | ✅ 동작 | 인게임 에이전트 위 국기+이름 Billboard (아레나 전용) |
| `country-data.ts` | ✅ 동작 | 195개국 iso3/iso2/name, `iso2ToFlag()` 이모지 |
| `globe-data.ts` | ✅ 동작 | GeoJSON 로더, CountryClientState, GDP 파싱 |

### 미구현 항목 (신규 개발 대상)

| 항목 | 현재 상태 | 필요 작업 |
|------|----------|----------|
| 국기 PNG 텍스처 아틀라스 | 미존재 | CDN 로드 → Canvas 합성 → Three.js CanvasTexture |
| 에이전트 수 라벨 (글로브) | 미존재 | GlobeCountryLabels 신규 컴포넌트 |
| 인구 비례 maxAgents | Tier 기반 존재 (인구 미연동) | Population 데이터를 Tier 범위 내 미세 조정에 활용 |
| 미사일 궤적 이펙트 | 미존재 | GlobeMissileEffect 신규 컴포넌트 |
| 충격파 링 이펙트 | 미존재 | GlobeShockwave 신규 컴포넌트 |
| 무역 루트 시각화 | 미존재 | GlobeTradeRoutes + WS 이벤트 신규 |
| 이벤트 파동 이펙트 | 미존재 | GlobeEventPulse 신규 컴포넌트 |
| `domination_update` S2C | 미정의 | protocol.go에 이벤트 추가 |
| `trade_route_update` S2C | 미정의 | protocol.go에 이벤트 추가 |
| 카메라 자동 포커스 | 미연결 | onCameraTarget 콜백 연결 |

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 195개국 국기 동시 로드 → 메모리 폭발 | High | 단일 2048×2048 아틀라스로 합성, 가시 영역만 렌더 |
| 국기 CDN 로드 실패 | Medium | 이모지 국기(iso2ToFlag) 폴백, 로드 실패 시 색상 사각형 |
| 195개 라벨 동시 렌더 → fps 하락 | High | InstancedMesh + LOD (줌아웃 시 상위 50개국만 표시) |
| GeoJSON POP_EST 누락 국가 | Low | 하드코딩 폴백 테이블 (주요 195개국 인구 데이터) |
| 미사일/폭발 이펙트 과다 → GPU 부하 | Medium | 동시 활성 전쟁 최대 5개 제한, 파티클 풀 재사용 |
| flagcdn.com CDN 접근 불가 | Low | da:asset으로 국기 이미지 자체 생성하여 public/ 배치 |

## 구현 로드맵

### Phase 1: 인구 기반 에이전트 제한 + 서버/클라이언트 데이터 파이프라인

> **의존성**: 없음 (첫 번째 Phase)

| Task | 설명 |
|------|------|
| POP_EST 클라이언트 파싱 | `globe-data.ts`의 `featureToCountryState()`에서 GeoJSON `POP_EST` 필드를 `CountryClientState.population`에 매핑. 인터페이스에 `population: number` 필드 추가 |
| maxAgents 하이브리드 공식 | `country_data.go`의 기존 `TierConfigs` MaxAgents를 기반으로, `CountrySeed.Population`을 활용한 Tier 범위 내 미세 조정 공식 적용. 공식: `tierMax * clamp(log10(population/1e6) / log10(tierRefPop/1e6), 0.3, 1.0)`. 예: TierS(50) 한국(5200만) → 50*0.86=43, 바티칸 → TierD(8)*0.3=3(최소5 적용) |
| Join 거부 로직 + 클라이언트 UX | `JoinCountryArena`에서 현재 에이전트 수 ≥ maxAgents 시 `arena_full` 에러 응답. **클라이언트에서 에러 토스트 UI 표시** |
| countries_state 확장 | `CountryBroadcastState` 구조체에 `MaxAgents int`, `Population int64` 필드 추가 (기존 `ActiveAgents`는 이미 존재) |
| WS 프로토콜 정의 (일괄) | `protocol.go`에 `domination_update`, `trade_route_update` S2C 이벤트 상수 + 메시지 구조체 정의 (broadcast 로직은 Phase 3, 5에서 구현) |
| domination broadcast 연결 | `game/domination.go`의 `OnEvent` 콜백(현재 nil)을 `country_arena.go`에서 설정하여 `domination_update` WS broadcast 연결 |
| useSocket 데이터 확장 | `useSocket.ts` UiState에 `tradeRoutes: TradeRouteData[]` 필드 추가 + `trade_route_update`, `domination_update` 이벤트 핸들러 등록 |

- **design**: N (서버 로직 + 데이터 파이프라인)
- **verify**: Go 빌드 성공, maxAgents 하이브리드 계산 검증 (TierS~D 5개국 샘플), arena_full 에러 토스트 UI 확인, Next.js 빌드 성공

### Phase 2: 국기 텍스처 아틀라스 + 에이전트 수 라벨 (국기 표시의 단일 책임)

> **의존성**: Phase 1 (maxAgents 데이터, countries_state 확장)

| Task | 설명 |
|------|------|
| FlagAtlasLoader 유틸 | flagcdn.com에서 195개국 국기 PNG 비동기 로드 (`https://flagcdn.com/w80/{iso2}.png`) → 2048×2048 Canvas 아틀라스 합성 → Three.js CanvasTexture 반환. 로딩 상태 UI (프로그레스 인디케이터) 포함 |
| 이모지 폴백 | CDN 로드 실패 시 `iso2ToFlag()` 이모지를 Canvas에 drawText로 렌더 |
| GlobeCountryLabels 컴포넌트 | InstancedMesh Billboard — 각 국가 centroid에 **점유국 국기 + "12/50" 에이전트 수** 통합 표시. **이 컴포넌트가 글로브 위 국기 표시의 유일한 책임** (GlobeDominationLayer는 색상 오버레이만 담당) |
| LOD 시스템 | 카메라 거리 기반: 근거리(국기+숫자+국명), 중거리(국기+숫자), 원거리(숫자만) |
| GlobeScene 통합 | `GlobeView.tsx`의 GlobeScene에 FlagAtlas 로드 + GlobeCountryLabels 마운트. countryStates/dominationStates props를 GlobeCountryLabels에 전달 |

- **design**: Y (라벨 레이아웃, 국기 크기, 폰트 스타일)
- **verify**: 글로브에서 195개국 라벨 렌더링 확인, 점유국 국기 정확 표시, 60fps 유지, LOD 전환 동작

### Phase 3: 점령 이펙트 강화 (색상 오버레이 + 셰이더 전문)

> **의존성**: Phase 2 (FlagAtlasLoader), Phase 1 (domination_update WS 연결)
> **역할 분리**: 국기 Billboard는 Phase 2 GlobeCountryLabels가 전담. 이 Phase는 **영토 색상 오버레이 + 셰이더 이펙트**만 담당

| Task | 설명 |
|------|------|
| GlobeDominationLayer 셰이더 강화 | sovereignty→hegemony 전환 시 골드 펄스 웨이브 (기존 GLSL 셰이더에 `uTransitionWave` uniform 추가) |
| 분쟁 영토 해칭 | 2개국 이상 경합 중인 국가에 대각선 해칭 패턴 셰이더 (fragment shader에 `fract(uv * 20.0)` 스트라이프) |
| 점령 완료 플래시 | hegemony 달성 시 3초간 해당 국가 영역 밝은 플래시 (opacity 1.0→0.0 감쇠) |
| GlobeCountryLabels 국기 연동 | domination 변경 시 GlobeCountryLabels의 해당 국가 국기를 점유국 국기로 전환 (아틀라스 UV 업데이트) |
| GlobeScene 통합 | GlobeView.tsx에서 domination_update 데이터를 GlobeDominationLayer + GlobeCountryLabels에 동시 전달 |

- **design**: Y (해칭 패턴 밀도, 플래시 색상, 전환 애니메이션 속도)
- **verify**: 점령 시 색상 변화 + 해칭 렌더링 + 플래시 트리거 + 국기 전환 동작

### Phase 4: 전쟁 이펙트 대폭 강화

> **의존성**: Phase 1 (war_declared WS 이벤트), Phase 2 (centroids 데이터)

| Task | 설명 |
|------|------|
| da:asset 이펙트 텍스처 생성 | **구체적 에셋 목록**: (1) `explosion-spritesheet.png` 512×512 4×4 프레임, 오렌지/빨강 폭발 시퀀스 (2) `shockwave-ring.png` 256×256 투명 배경 + 백색 링 (3) `missile-glow.png` 128×32 가로형 글로우 트레일 (4) `war-fog.png` 256×256 반투명 붉은 안개 노이즈 텍스처 |
| GlobeMissileEffect | 공격국→방어국 미사일 궤적 (포물선, 꼬리 파티클, 발광 헤드) — InstancedMesh로 최대 10발 동시. missile-glow.png 텍스처 사용 |
| GlobeShockwave | 미사일 착탄 시 충격파 링 확산 (RingGeometry + shockwave-ring.png + 투명도 감쇠 0.8초) |
| 전장 안개 | 전쟁 중인 양국 centroid 사이 중간점에 war-fog.png 기반 붉은 안개 파티클 (InstancedMesh 20개, 천천히 회전) |
| 전쟁 선포 연출 | war_declared 수신 시: (1) 카메라 자동 회전 (`onCameraTarget` 연결) (2) 화면 진동 — useFrame에서 camera.position에 sin(t*40)*0.3 오프셋 0.5초간 적용 (3) **기존 `useAudio.ts` 훅**을 사용하여 경고 사이렌 사운드 트리거 |
| 승리 이펙트 강화 | 기존 VictoryFireworks 확대: 파티클 100→300, 골드+점유국 색상, 3단계 분출 (0s, 0.5s, 1.0s) |
| GlobeScene 통합 | GlobeView.tsx GlobeScene에 GlobeMissileEffect + GlobeShockwave 마운트, wars prop 전달 |

- **design**: Y (미사일 디자인, 충격파 색상, 안개 밀도)
- **verify**: 전쟁 선포→미사일→충격파→승리 전체 플로우 동작, da:asset 텍스처 로드 확인, 60fps 유지

### Phase 5: 무역 루트 시각화 + 글로벌 이벤트 파동

> **의존성**: Phase 1 (trade_route_update 프로토콜 정의 + useSocket tradeRoutes 필드)

| Task | 설명 |
|------|------|
| TradeEngine WS broadcast 추가 | `meta/trade.go`에 Hub 참조 추가 + 거래 체결 시 `trade_route_update` S2C broadcast (기존 REST 유지 + WS 실시간 push 병행) |
| GlobeTradeRoutes 컴포넌트 | 교역국 간 베지어 곡선 라인 — 해상(`sea`)=파란 점선, 육상(`land`)=초록 실선 + 라인 위를 이동하는 화물 스프라이트 점 애니메이션. `uiState.tradeRoutes` 데이터 사용 |
| 무역량 시각화 | 라인 두께 = trade volume (lineWidth: 1~4), 밝기 = 거래 빈도 (opacity: 0.3~1.0) |
| GlobeEventPulse 컴포넌트 | 동맹(파란 링), 정책(보라 파동), 에포크(골드 웨이브), 휴전(백색 올리브 링), 무역 금수(적색 X) — centroid에서 확산하는 링 이펙트 (RingGeometry, 2초 확산→소멸) |
| 이벤트 큐 시스템 | 동시 다수 이벤트 시 순차 재생 (최대 3개 동시, 나머지 대기열). `uiState.globalEvents` 배열에서 소비 |
| GlobeScene 통합 | GlobeView.tsx GlobeScene에 GlobeTradeRoutes + GlobeEventPulse 마운트. tradeRoutes/globalEvents props 전달 |

- **design**: N (서버 이벤트 + 렌더링 로직)
- **verify**: 무역 루트 라인 렌더링 (해상/육상 구분), 이벤트 파동 5종 트리거 동작, useSocket tradeRoutes 데이터 수신 확인

### Phase 6: 카메라 포커스 + 성능 최적화 + 모바일 LOD + 최종 통합

> **의존성**: Phase 1~5 전체

| Task | 설명 |
|------|------|
| 카메라 자동 포커스 | 전쟁 선포, hegemony 달성 등 주요 이벤트 시 해당 국가로 smooth 회전 (3초, `OrbitControls.target` lerp) |
| onCameraTarget 연결 | GlobeScene에서 `const cameraTargetRef = useRef()` → GlobeWarEffects + GlobeEventPulse에 `onCameraTarget` 콜백 전달 |
| 모바일 LOD | `navigator.hardwareConcurrency` + 화면 크기 감지 → 파티클 수 50%, 라벨 상위 30개국만, 무역 라인 숨김, 안개/충격파 비활성화 |
| 이펙트 풀링 | 미사일, 충격파, 파티클 오브젝트 재사용 풀 (GC 방지). `useRef<THREE.Object3D[]>()` 풀 패턴 |
| GlobeScene 최종 통합 검증 | GlobeView.tsx에서 Phase 1~5의 모든 신규 컴포넌트가 올바르게 마운트되어 있는지 확인. props 체인 검증 (page.tsx → WorldView → GlobeView → GlobeScene → 각 하위 컴포넌트) |
| 벤치마크 | 195개국 라벨 + 전쟁 5개 + 무역 10개 + 점령 20개 동시 시나리오에서 60fps 확인 |

- **design**: N (성능 최적화 + 통합 검증)
- **verify**: 모바일 LOD 동작, 카메라 포커스 smooth 전환, props 체인 완전성, 벤치마크 60fps 통과
