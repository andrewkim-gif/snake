# PLAN: v20 — 3D Globe Landmark System

> 세계 주요 도시의 대표 건축물/조형물을 3D 지구본 위에 표시하는 시스템

## 1. 개요

### 배경
현재 지구본(GlobeView)은 국가 폴리곤, 분쟁 인디케이터, 무역 루트, 전쟁 이펙트 등의 2D 오버레이 중심으로 구성되어 있어 시각적으로 밋밋한 느낌을 준다. 세계 주요 도시의 아이코닉한 랜드마크(에펠탑, 피라미드, 자유의 여신상 등)를 로우폴리 3D 오브젝트로 지구본 표면에 배치하면, 게임의 "AI World War" 테마에 걸맞은 시각적 풍부함과 지리적 맥락을 제공할 수 있다.

### 핵심 목표
- 30~50개의 세계적 랜드마크를 3D 지구본 위에 프로시저럴 로우폴리로 표시
- 3단계 LOD (Level of Detail)로 모바일~데스크탑 모두 60fps 유지
- 기존 GlobeView 렌더링 파이프라인(~60-100 draw calls, 상태 의존)에 **+2~12 draw calls 추가** (최적: 2, 폴백: 12)
- 국가 전쟁/지배 상태와 연동 가능한 인터랙티브 시스템

## 2. 요구사항

### 기능 요구사항
- [FR-1] 42개 세계 랜드마크를 지구본 표면에 정확한 위도/경도 위치에 배치
- [FR-2] 줌 레벨에 따라 3단계 LOD 전환 (Far: 스프라이트, Mid: 로우폴리, Close: 디테일)
- [FR-3] 지구본 뒷면 랜드마크 자동 컬링 (backface dot product)
- [FR-4] 랜드마크에 마우스 호버 시 이름/도시/국가 정보 표시
- [FR-5] 국가 지배 상태에 따른 랜드마크 색상 틴팅 (점령국 색상 반영)
- [FR-6] 줌아웃 시 밀집 지역 자동 디클러터링 (중요도 기반)
- [FR-7] 기존 useGlobeLOD 디바이스 설정과 통합 (모바일: 축소 표시)

### 비기능 요구사항
- [NFR-1] 성능: 추가 draw calls ≤ 13 (WEBGL_multi_draw 지원 시 ≤ 3), 추가 삼각형 ≤ 5,000
- [NFR-2] 메모리: 추가 텍스처/지오메트리 ≤ 500KB
- [NFR-3] 로드 타임: GlobeView 초기 로드에 +200ms 이내
- [NFR-4] 모바일: iPhone 12+ 기준 30fps 이상 유지
- [NFR-5] 접근성: 랜드마크 호버 정보는 스크린 리더 호환

## 3. 기술 방향

### 렌더링 전략: Hybrid LOD (3-Tier)

```
┌─────────────────────────────────────────────────────────┐
│              3-Tier LOD Rendering Pipeline               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Camera Distance > 300  ──→  [Far]  Billboard Sprites   │
│  (zoomed out, 전체 지구)      InstancedMesh + PlaneGeo  │
│                               텍스처 아틀라스 (1 draw)   │
│                               Tier1만 15개 표시          │
│                               삼각형: 30 (2 tri × 15)   │
│                                                         │
│  Camera Distance 150~300 ──→ [Mid]  Low-Poly 3D Shapes  │
│  (대륙 수준 줌)               InstancedMesh ×12 (기본)   │
│                               BatchedMesh 1개 (최적화)   │
│                               12종 Archetype 형상        │
│                               Tier1+2, ~30개 표시        │
│                               삼각형: ~1,500 (50 × 30)  │
│                                                         │
│  Camera Distance < 150  ──→  [Close] Detailed Procedural│
│  (국가 수준 줌)               InstancedMesh ×12 (기본)   │
│                               BatchedMesh 1개 (최적화)   │
│                               복합 지오메트리 (그룹)      │
│                               전체 42개 표시             │
│                               삼각형: ~4,200 (100 × 42) │
│                                                         │
│  ★ Backface Culling: dot(normal, camDir) < 0.05 → hide │
│  ★ Screen Declutter: 중요도 기반 겹침 제거              │
│  ★ Hysteresis Band: ±20 units 플리커 방지               │
└─────────────────────────────────────────────────────────┘
```

### 기술 스택
- **3D 엔진**: Three.js r175 + React Three Fiber v9 (기존 스택 유지)
- **지오메트리 (기본)**: Archetype별 InstancedMesh ×12 (모든 브라우저 호환)
- **지오메트리 (최적화)**: THREE.BatchedMesh (WEBGL_multi_draw 지원 시 progressive enhancement → 1 draw call)
- **R3F 연동**: imperative 패턴 (`useRef` + `useEffect`, 기존 GlobeDominationLayer 패턴) — R3F v9에 BatchedMesh JSX 타입 미지원
- **텍스처**: CanvasTexture 아틀라스 (스프라이트용, 기존 GlobeCountryLabels 패턴)
- **좌표계**: 기존 `latLngToVector3()` 유틸리티 재사용 (7곳 3가지 변형 → 공통 유틸로 통합)
- **LOD 제어**: 기존 `useGlobeLOD` 훅 확장

### Firefox 호환성 전략
```
WEBGL_multi_draw 지원 여부 감지
  ├─ 지원 (Chrome/Safari/Edge 92%+): BatchedMesh → 1 draw call
  └─ 미지원 (Firefox ~4%): InstancedMesh ×12 → 12 draw calls
                            (Archetype당 1개, 여전히 충분히 가벼움)

감지 코드:
  const gl = renderer.getContext();
  const supportsMultiDraw = !!gl.getExtension('WEBGL_multi_draw');
```

## 4. 아키텍처 개요

### C4 Level 1: 시스템 컨텍스트

```
┌──────────────────────────────────────────────────┐
│                  GlobeView.tsx                    │
│  (기존 지구본 씬 — Canvas + R3F)                  │
│                                                  │
│  ┌────────────┐  ┌─────────────────────────┐     │
│  │ EarthSphere│  │ GlobeConflictIndicators │     │
│  │ CountryBdr │  │ GlobeDominationLayer    │     │
│  │ Starfield  │  │ GlobeWarEffects         │     │
│  │ Atmosphere │  │ GlobeMissileEffect      │     │
│  └────────────┘  │ GlobeTradeRoutes        │     │
│                  │ GlobeEventPulse         │     │
│                  │ GlobeCountryLabels      │     │
│                  └─────────────────────────┘     │
│                                                  │
│  ┌─────────────────────────────┐  ← ★ NEW       │
│  │     GlobeLandmarks.tsx      │                 │
│  │  ┌───────────────────────┐  │                 │
│  │  │ LandmarkSprites      │  │ Far LOD         │
│  │  │ (InstancedMesh+Atlas) │  │ 1 draw call     │
│  │  └───────────────────────┘  │                 │
│  │  ┌───────────────────────┐  │                 │
│  │  │ LandmarkMeshes       │  │ Mid/Close LOD   │
│  │  │ (BatchedMesh)        │  │ 1 draw call     │
│  │  └───────────────────────┘  │                 │
│  │  ┌───────────────────────┐  │                 │
│  │  │ LandmarkLabels       │  │ 호버 라벨       │
│  │  │ (HTML Overlay)       │  │ CSS only        │
│  │  └───────────────────────┘  │                 │
│  └─────────────────────────────┘                 │
└──────────────────────────────────────────────────┘
```

### 파일 구조 (신규)

```
apps/web/
├── components/3d/
│   ├── GlobeLandmarks.tsx          # 메인 컴포넌트 (LOD 매니저)
│   ├── LandmarkSprites.tsx         # Far LOD: 빌보드 스프라이트 레이어
│   └── LandmarkMeshes.tsx          # Mid/Close LOD: BatchedMesh 3D 형상
├── lib/
│   ├── globe-utils.ts              # ★ latLngToVector3 공통화 (7곳 3가지 변형 통합)
│   └── landmark-data.ts            # 42개 랜드마크 정의 (좌표, 형상, 티어, ISO3)
└── hooks/
    └── useGlobeLOD.ts              # 기존 훅에 landmark 설정 추가
```

### 데이터 흐름

```
landmark-data.ts (42개 정적 데이터)
       │
       ▼
GlobeLandmarks.tsx (LOD 스위칭 로직)
       │
       ├─ Far (>300): LandmarkSprites.tsx
       │   └─ InstancedMesh + PlaneGeometry + CanvasTexture Atlas
       │
       ├─ Mid (150~300): LandmarkMeshes.tsx (lowPoly mode)
       │   └─ InstancedMesh ×12 (기본) 또는 BatchedMesh (최적화)
       │
       └─ Close (<150): LandmarkMeshes.tsx (detail mode)
           └─ InstancedMesh ×12 (기본) 또는 BatchedMesh (최적화)
```

### 기존 코드와의 통합 포인트
1. **GlobeView.tsx**: `<GlobeLandmarks />` 컴포넌트를 GlobeCountryLabels 바로 아래에 마운트. **renderOrder: 3D 메시 = 95, 스프라이트 = 98** (라벨 100, 인디케이터 109/110 아래)
2. **globe-utils.ts**: **7곳 3가지 변형** 통합 — `latLngToVector3(lat,lng,r)` (4곳), `latLngToXYZ(lat,lng,r)` (2곳), `geoToXYZ(lon,lat,r,out,offset)` (1곳, Float32Array 성능용). 모두 동일 수학, 시그니처만 상이.
3. **useGlobeLOD.ts**: `maxLandmarks`, `landmarkDetail` 설정 추가 (desktop: 42/high, mobile: 15/low). ⚠️ 참고: useGlobeLOD(2-tier)와 performance.ts(3-tier AdaptiveQuality)는 **완전 별개 시스템**. 랜드마크는 useGlobeLOD만 사용하고, AdaptiveQuality 연동은 Phase 5에서 별도 브리지.
4. **countryCentroids**: 기존 GlobeView에서 계산된 centroid Map을 prop으로 전달 (이미 패턴 있음)
5. **dominationStates**: GlobeDominationLayer와 동일한 데이터 소스에서 색상 틴팅 적용
6. **imperative 패턴**: R3F v9에 BatchedMesh JSX 타입 미지원 → `useRef` + `useEffect`로 수동 생성/정리 (기존 GlobeDominationLayer가 동일 패턴 사용)

## 5. 랜드마크 데이터셋

### 42개 랜드마크 목록

> Tier 1 (15개): 줌아웃 시에도 항상 표시 — 대륙별 최고 아이콘
> Tier 2 (15개): 중간 줌부터 표시 — 주요 도시 대표
> Tier 3 (12개): 근접 줌에서만 표시 — 보조 랜드마크

#### Asia (12)

| # | 랜드마크 | 도시, 국가 | ISO3 | Lat, Lng | Tier | Archetype | 로우폴리 형상 설명 |
|---|---------|-----------|------|----------|------|-----------|------------------|
| 1 | 도쿄 타워 | 도쿄, 일본 | JPN | 35.66, 139.75 | 1 | TOWER | 격자 원뿔 (ConeGeo + wireframe 느낌) |
| 2 | 타지마할 | 아그라, 인도 | IND | 27.17, 78.04 | 1 | DOME | 돔 + 4 미나렛 (SphereHalf + 4 CylinderGeo) |
| 3 | 만리장성 | 바다링, 중국 | CHN | 40.43, 116.57 | 1 | WALL | 지그재그 성벽 세그먼트 (BoxGeo 체인) |
| 4 | 부르즈 할리파 | 두바이, UAE | ARE | 25.20, 55.27 | 2 | NEEDLE | 단계적 첨탑 (stacked BoxGeo, 테이퍼) |
| 5 | 페트로나스 타워 | 쿠알라룸푸르 | MYS | 3.16, 101.71 | 2 | TWIN_TOWER | 쌍둥이 실린더 + 스카이 브릿지 |
| 6 | 후지산 | 시즈오카, 일본 | JPN | 35.36, 138.73 | 2 | MOUNTAIN | 원뿔 + 백색 정상 캡 |
| 7 | 앙코르 와트 | 시엠레아프, 캄보디아 | KHM | 13.41, 103.87 | 3 | PYRAMID | 단계식 피라미드 + 5 첨탑 |
| 8 | 자금성 | 베이징, 중국 | CHN | 39.92, 116.39 | 3 | PAGODA | 중층 파고다 (stacked BoxGeo) |
| 9 | 마리나 베이 샌즈 | 싱가포르 | SGP | 1.28, 103.86 | 2 | BRIDGE_TOP | 3 타워 + 상판 (BoxGeo ×3 + 평판) |
| 10 | 타이페이 101 | 타이베이, 대만 | TWN | 25.03, 121.56 | 3 | TOWER | 적층 팔각 타워 |
| 11 | 경복궁 | 서울, 한국 | KOR | 37.58, 126.98 | 2 | PAGODA | 기와지붕 전각 (BoxGeo + 경사 면) |
| 12 | **왓아룬** | **방콕, 태국** | **THA** | **13.74, 100.49** | 3 | **SPIRE_CLUSTER** | **프랑 첨탑 클러스터 (ConeGeo ×5)** |

> ★ 변경: #12 멀라이언(싱가포르 중복) → 왓아룬(방콕) — 동남아 본토 커버리지 확보

#### Europe (11) + Middle East (1)

| # | 랜드마크 | 도시, 국가 | ISO3 | Lat, Lng | Tier | Archetype | 로우폴리 형상 설명 |
|---|---------|-----------|------|----------|------|-----------|------------------|
| 13 | 에펠탑 | 파리, 프랑스 | FRA | 48.86, 2.29 | 1 | TOWER | 격자 테이퍼드 타워 (4면 와이어프레임풍) |
| 14 | 빅 벤 | 런던, 영국 | GBR | 51.50, -0.12 | 1 | CLOCK_TOWER | 시계탑 (BoxGeo + 피라미드 캡) |
| 15 | 콜로세움 | 로마, 이탈리아 | ITA | 41.89, 12.49 | 1 | ARENA | 타원 링 (TorusGeo, 반높이) |
| 16 | 피사의 사탑 | 피사, 이탈리아 | ITA | 43.72, 10.40 | 3 | TILTED_TOWER | 기울어진 실린더 + 링 티어 |
| 17 | 사그라다 파밀리아 | 바르셀로나, 스페인 | ESP | 41.40, 2.17 | 2 | SPIRE_CLUSTER | 다중 첨탑 (ConeGeo 클러스터) |
| 18 | 파르테논 | 아테네, 그리스 | GRC | 37.97, 23.73 | 2 | TEMPLE | 열주 직사각형 (BoxGeo + CylGeo 기둥) |
| 19 | 브란덴부르크 문 | 베를린, 독일 | DEU | 52.52, 13.38 | 2 | GATE | 기둥 열 + 상부 블록 |
| 20 | 성 바실리 성당 | 모스크바, 러시아 | RUS | 55.75, 37.62 | 1 | ONION_DOME | 다색 양파돔 (SphereGeo 스택) |
| 21 | 풍차 | 암스테르담, 네덜란드 | NLD | 52.37, 4.89 | 3 | WINDMILL | 원통 + 4블레이드 (CylGeo + PlaneGeo) |
| 22 | 노이슈반슈타인 성 | 바이에른, 독일 | DEU | 47.56, 10.75 | 3 | CASTLE | 성 타워 (CylGeo + ConeGeo 캡) |
| 23 | 스톤헨지 | 윌트셔, 영국 | GBR | 51.18, -1.83 | 3 | STONE_RING | 석판 링 (BoxGeo 원형 배치) |
| 24 | **페트라 (알카즈네)** | **페트라, 요르단** | **JOR** | **30.33, 35.44** | 3 | **TEMPLE** | **암벽 파사드 (BoxGeo + 기둥 CylGeo)** |

> ★ 변경: #24 빅토리아노(로마 중복, 인지도 낮음) → 페트라(요르단) — 중동 커버리지 확보

#### Americas (10)

| # | 랜드마크 | 도시, 국가 | ISO3 | Lat, Lng | Tier | Archetype | 로우폴리 형상 설명 |
|---|---------|-----------|------|----------|------|-----------|------------------|
| 25 | 자유의 여신상 | 뉴욕, 미국 | USA | 40.69, -74.04 | 1 | STATUE | 페데스탈 + 인체형 + 횃불 |
| 26 | 구세주 그리스도상 | 리오, 브라질 | BRA | -22.95, -43.21 | 1 | STATUE | 십자형 인체 + 산 정상 |
| 27 | CN 타워 | 토론토, 캐나다 | CAN | 43.64, -79.39 | 2 | NEEDLE | 니들 타워 (CylGeo + 도넛 관측대) |
| 28 | 엠파이어 스테이트 | 뉴욕, 미국 | USA | 40.75, -73.99 | 2 | SKYSCRAPER | 아르데코 단계식 타워 |
| 29 | 골든 게이트 브릿지 | SF, 미국 | USA | 37.82, -122.48 | 1 | BRIDGE | 두 타워 + 현수 케이블 |
| 30 | 치첸 이트사 | 유카탄, 멕시코 | MEX | 20.68, -88.57 | 2 | PYRAMID | 단계식 피라미드 (stacked BoxGeo) |
| 31 | 마추픽추 | 쿠스코, 페루 | PER | -13.16, -72.55 | 3 | TERRACE | 산악 계단식 (BoxGeo on slope) |
| 32 | 워싱턴 기념탑 | DC, 미국 | USA | 38.89, -77.04 | 3 | OBELISK | 오벨리스크 (elongated 피라미드) |
| 33 | 스페이스 니들 | 시애틀, 미국 | USA | 47.62, -122.35 | 3 | NEEDLE | 디스크 + 스템 (CylGeo + CircleGeo) |
| 34 | 국회의사당 | DC, 미국 | USA | 38.89, -77.01 | 3 | DOME | 돔 + 윙 (SphereGeo + BoxGeo) |

#### Africa & Oceania (8)

| # | 랜드마크 | 도시, 국가 | ISO3 | Lat, Lng | Tier | Archetype | 로우폴리 형상 설명 |
|---|---------|-----------|------|----------|------|-----------|------------------|
| 35 | 기자 대피라미드 | 기자, 이집트 | EGY | 29.98, 31.13 | 1 | PYRAMID | 정사면체 (ConeGeo, segments:4) |
| 36 | 시드니 오페라하우스 | 시드니, 호주 | AUS | -33.86, 151.21 | 1 | SHELLS | 조개 돛 (커스텀 아크 지오메트리) |
| 37 | 테이블 마운틴 | 케이프타운, 남아공 | ZAF | -33.96, 18.40 | 2 | MESA | 평탄 정상 (BoxGeo) |
| 38 | 스핑크스 | 기자, 이집트 | EGY | 29.97, 31.14 | 3 | STATUE | 사자 몸체 (로우폴리 커스텀) |
| 39 | 울루루 | NT, 호주 | AUS | -25.34, 131.04 | 3 | MONOLITH | 반구체 모노리스 |
| 40 | 스카이 타워 | 오클랜드, 뉴질랜드 | NZL | -36.85, 174.76 | 3 | NEEDLE | 니들 타워 변형 |
| 41 | 킬리만자로 | 킬리만자로, 탄자니아 | TZA | -3.07, 37.35 | 2 | MOUNTAIN | 눈덮인 원뿔 |
| 42 | 모아이 석상 | 이스터 섬, 칠레 | CHL | -27.12, -109.35 | 3 | STATUE | 직사각 머리 + 페데스탈 |

### Archetype 형상 분류 (10+α 종)

| Archetype | 대표 형상 | 기본 지오메트리 | Mid 삼각형 | Close 삼각형 |
|-----------|----------|---------------|-----------|------------|
| TOWER | 에펠탑, 도쿄타워 | ConeGeo(4seg) + 4 CylGeo 다리 | ~24 | ~80 |
| PYRAMID | 기자, 치첸이트사 | ConeGeo(4seg) 또는 stacked BoxGeo | ~8 | ~48 |
| DOME | 타지마할, 국회의사당 | SphereHalfGeo + CylGeo 미나렛 | ~40 | ~120 |
| NEEDLE | 부르즈, CN타워, 스페이스니들 | CylGeo(4seg) + TorusGeo 관측대 | ~16 | ~50 |
| STATUE | 자유의 여신, 구세주상 | BoxGeo 페데스탈 + 십자형 상체 | ~20 | ~60 |
| WALL | 만리장성 | BoxGeo ×3~5 지그재그 | ~30 | ~60 |
| ARENA | 콜로세움 | TorusGeo(12seg) | ~24 | ~96 |
| BRIDGE | 골든게이트 | 2 BoxGeo 타워 + CylGeo 케이블 | ~28 | ~72 |
| PAGODA | 경복궁, 자금성 | stacked BoxGeo + 경사 플레인 | ~32 | ~80 |
| SHELLS | 시드니 오페라 | 커스텀 아크 조각 ×4 | ~32 | ~96 |
| ONION_DOME | 성 바실리 | SphereGeo ×5 다색 | ~40 | ~120 |
| MOUNTAIN | 후지산, 킬리만자로 | ConeGeo(8seg) + 백색 캡 | ~16 | ~32 |

## 6. 렌더링 최적화 전략

### 6.1 Draw Call 최소화

| 전략 | 적용 대상 | 효과 |
|------|----------|------|
| **InstancedMesh ×12** (기본) | Mid/Close LOD 3D 형상 | Archetype당 1개 = **12 draw calls** (모든 브라우저 호환) |
| **BatchedMesh** (최적화) | Mid/Close LOD 3D 형상 | WEBGL_multi_draw 지원 시 12 → **1 draw call** (Chrome/Safari/Edge) |
| **InstancedMesh + Atlas** | Far LOD 스프라이트 | PlaneGeo + 텍스처 아틀라스 = **1 draw call** |
| **HTML Overlay** | 호버 라벨 | 0 draw calls (CSS 렌더링) |
| **합계** | 전체 시스템 | **+2~13 draw calls** (기존 ~60-100에서 ~62-113으로) |

> 참고: 기존 GlobeView는 CountryLabels troika Text (~40-80 visible) + 고정 오브젝트 (~11) + 상태 의존 이펙트로 **~60-100 draw calls**. 랜드마크 추가 부하는 전체 대비 미미.

### 6.2 Backface Culling (지구 뒷면 숨김)

기존 GlobeConflictIndicators, GlobeCountryLabels의 검증된 패턴 재사용:

```typescript
// useFrame 내부
const camDir = camera.position.clone().normalize();
landmarks.forEach((lm, i) => {
  const normal = lm.position.clone().normalize();
  const dot = normal.dot(camDir);
  // dot < 0.05 → 뒷면, 0.05~0.35 구간에서 서서히 페이드 (기존 GlobeConflictIndicators와 동일)
  const alpha = THREE.MathUtils.clamp((dot - 0.05) / 0.3, 0, 1);
  mesh.setVisibleAt(i, alpha > 0);
});
```

→ 화면에 보이는 랜드마크만 렌더링 (보통 전체의 40~50%)

### 6.3 LOD Hysteresis (플리커 방지)

줌 경계에서 LOD가 빠르게 전환되는 플리커를 방지하기 위한 히스테리시스 밴드:

```
Far→Mid 전환: camDist < 280 (진입), camDist > 320 (복귀) — 40 unit 밴드
Mid→Close 전환: camDist < 130 (진입), camDist > 170 (복귀) — 40 unit 밴드
```

### 6.4 Tier-Based Visibility (줌별 표시 개수)

| 줌 레벨 | 표시 Tier | 최대 표시 수 | 삼각형 예산 |
|---------|----------|------------|-----------|
| Far (>300) | Tier 1만 | 15개 | 30 tris (스프라이트) |
| Mid (150~300) | Tier 1+2 | 30개 | ~1,500 tris |
| Close (<150) | All | 42개 | ~4,200 tris |
| Mobile Far | Tier 1 상위 8 | 8개 | 16 tris |
| Mobile Mid | Tier 1만 | 15개 | ~750 tris |
| Mobile Close | Tier 1+2 | 30개 | ~3,000 tris |

### 6.5 Screen-Space Decluttering

밀집 지역 5쌍 (실측 거리 기반):

| 도시 | 랜드마크 쌍 | 실거리 | 심각도 |
|------|-----------|--------|--------|
| **싱가포르** | 마리나베이(#9) + 왓아룬은 다른 도시 → 싱가포르는 1개로 축소됨 | — | 해소 |
| **기자** | 대피라미드(#35) + 스핑크스(#38) | ~1.5km | **높음** |
| **워싱턴 DC** | 워싱턴기념탑(#32) + 국회의사당(#34) | ~2.7km | **높음** |
| **뉴욕** | 자유의여신(#25) + 엠파이어스테이트(#28) | ~6.7km | 중간 |
| **로마** | 콜로세움(#15) — 단독 (빅토리아노 제거됨) | — | 해소 |

> 참고: 만리장성(바다링)과 자금성(베이징 도심)은 ~57km 떨어져 있어 디클러터 불필요.

```typescript
// 스크린 좌표로 투영 후 겹침 검사
const SCREEN_THRESHOLD = 0.03; // 화면 너비의 3%
// 중요도(Tier) 내림차순 정렬 → greedy 방식으로 겹치는 하위 항목 숨김
// 특히 기자(1.5km), DC(2.7km) 쌍은 줌인 시에도 겹칠 수 있음
```

### 6.6 GC 방지 (Reusable Objects)

기존 패턴 준수 — 모듈 스코프에 temp 객체 사전 할당:

```typescript
const _pos = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _quaternion = new THREE.Quaternion();
const _dummy = new THREE.Object3D();
```

### 6.7 지오메트리 공유

- 동일 Archetype의 모든 인스턴스는 하나의 지오메트리 정의를 공유 (BatchedMesh가 자동 처리)
- PlaneGeometry는 스프라이트 레이어에서 전체 공유 (1개 생성)
- Archetype별 BufferGeometry는 `useMemo`로 1회만 생성

### 6.8 Performance Budget 요약

```
┌──────────────────────────────────────────────────────────────┐
│                v20 Landmark System Budget                     │
├──────────────────┬───────────────────────────────────────────┤
│ 기존 베이스라인   │ ~60-100 draw calls (상태 의존)             │
│                  │ CountryLabels troika ~40-80 + 고정 ~11     │
│                  │ + 전쟁/지배 이펙트 (가변)                   │
├──────────────────┼───────────────────────────────────────────┤
│ Draw Calls 추가  │ +2~13 (BatchedMesh: +2, InstancedMesh: +13)│
│ Triangles (Far)  │ +30 (스프라이트)                           │
│ Triangles (Mid)  │ +1,500                                    │
│ Triangles (Close)│ +4,200                                    │
│ Texture Memory   │ +256KB (sprite atlas 1024²)               │
│ Geometry Memory  │ +100KB (InstancedMesh/BatchedMesh buffers) │
│ JS Heap          │ +50KB (landmark data + state)              │
│ Load Time Impact │ <100ms (프로시저럴, 로드 없음)             │
│ Mobile Impact    │ Tier 기반 축소로 최소 영향                 │
│ Firefox Impact   │ InstancedMesh ×12 폴백 (성능 동등)         │
└──────────────────┴───────────────────────────────────────────┘

⚠️ 참고: GlobeView Canvas에 DPR 미설정 (모바일에서 기본 2-3x).
   모바일 성능 마진이 생각보다 좁을 수 있으므로 Phase 5에서 DPR 제어 권장.
```

## 7. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| Firefox WEBGL_multi_draw 미지원 | BatchedMesh 성능 이점 소멸 | **InstancedMesh ×12를 기본으로**, WEBGL_multi_draw 감지 시 BatchedMesh progressive enhancement |
| BatchedMesh R3F v9 타입 미지원 | TypeScript 에러 | imperative 패턴 사용 (useRef + useEffect). 기존 GlobeDominationLayer 동일 패턴 |
| 42개 프로시저럴 형상 제작 공수 | 구현 시간 증가 | 10가지 Archetype으로 추상화, 파라미터만 변경하여 변형 |
| 스프라이트 아틀라스 시각적 퀄리티 | Far 줌에서 픽셀화 | 1024×1024 아틀라스 (256×256 per 슬롯) → 충분한 해상도 |
| 지구 뒷면 랜드마크 클리핑 아티팩트 | 경계에서 깜빡임 | dot product 페이드 구간 0.05~0.35 (기존 GlobeConflictIndicators와 동일한 0.30 범위) |
| 모바일 메모리 압박 | OOM 크래시 | useGlobeLOD 모바일 설정: 최대 15개, 스프라이트 전용 |
| GlobeView 초기 로드 시간 증가 | UX 저하 | 프로시저럴 생성이라 텍스처 로드 없음. 아틀라스만 CanvasTexture 동적 생성 |
| 랜드마크-국가 폴리곤 Z-fighting | 시각 결함 | renderOrder 설정 + depthOffset 적용 |
| latLngToVector3 공통화 리팩토링 | 기존 코드 영향 (7곳 3변형) | 시그니처별 래퍼 제공: latLngToVector3, latLngToXYZ (alias), geoToXYZ (Float32Array용). import만 변경 |
| Canvas DPR 미제어 | 모바일 3x 렌더링으로 성능 마진 축소 | v20 범위 밖이나 인지 필요. Phase 5에서 `dpr={[1, Math.min(dpr, 2)]}` 적용 권장 |
| useGlobeLOD-performance.ts 분리 | AdaptiveQuality 연동 불가 | 랜드마크는 useGlobeLOD만 사용. 전체 시스템 브리지는 별도 작업 |

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: 기반 인프라 — 공통 유틸 + 데이터 정의
| Task | 설명 |
|------|------|
| latLngToVector3 공통 유틸 추출 | `lib/globe-utils.ts` 생성 — **7곳 3가지 변형** 통합: latLngToVector3 (메인), latLngToXYZ (alias), geoToXYZ (Float32Array 성능용) |
| 기존 컴포넌트 import 경로 변경 | GlobeConflictIndicators, GlobeCountryLabels, GlobeWarEffects, GlobeMissileEffect, GlobeTradeRoutes, GlobeEventPulse, GlobeView **7개 파일**의 로컬 함수 제거 → globe-utils import |
| 랜드마크 데이터 정의 | `lib/landmark-data.ts` — 42개 랜드마크 (좌표, Archetype, Tier, **ISO3 국가코드**, 색상) |
| useGlobeLOD 확장 | 기존 훅에 landmark 설정 추가 (maxLandmarks, landmarkDetail). ⚠️ performance.ts와 별개 시스템임을 인지 |
| WEBGL_multi_draw 감지 유틸 | `lib/globe-utils.ts`에 `supportsMultiDraw()` 함수 추가 — BatchedMesh/InstancedMesh 분기 기준 |

- **design**: N (인프라/데이터 중심)
- **verify**: 빌드 성공, 기존 GlobeView 기능 정상 동작 (7개 파일 regression 없음)

### Phase 2: Far LOD — 스프라이트 레이어
| Task | 설명 |
|------|------|
| LandmarkSprites.tsx | InstancedMesh + PlaneGeometry + 커스텀 셰이더 (per-instance UV offset) |
| 스프라이트 아틀라스 생성 | CanvasTexture로 42개 랜드마크 실루엣 아이콘 동적 생성 (8×6 그리드) |
| Backface culling 적용 | dot product 기반 뒷면 숨김 + 알파 페이드 |
| GlobeLandmarks.tsx 생성 | LOD 매니저 컴포넌트, Far 모드만 우선 연결 |
| GlobeView에 마운트 | GlobeCountryLabels 아래에 `<GlobeLandmarks />` 추가 |

- **design**: N (로직 중심, 아이콘은 프로시저럴)
- **verify**: 지구본 줌아웃 시 Tier1 랜드마크 15개 스프라이트 표시, 뒷면 숨김 정상

### Phase 3: Mid/Close LOD — InstancedMesh 3D 형상 + BatchedMesh 최적화
| Task | 설명 |
|------|------|
| Archetype 지오메트리 팩토리 | 12종 Archetype별 프로시저럴 BufferGeometry 생성 함수 (TOWER, PYRAMID, DOME 등) |
| LandmarkMeshes.tsx (기본) | **InstancedMesh ×12** (Archetype당 1개) — imperative 패턴 (`useRef` + `useEffect`). 모든 브라우저 호환 |
| LandmarkMeshes.tsx (최적화) | **BatchedMesh** progressive enhancement — `supportsMultiDraw()` true 시 1 draw call로 통합 |
| 구면 정렬 (Normal Alignment) | Quaternion.setFromUnitVectors로 지구 표면 수직 배치 |
| LOD 전환 로직 | GlobeLandmarks에서 Far↔Mid↔Close 히스테리시스 스위칭 구현 |
| Tier 기반 가시성 관리 | 카메라 거리에 따른 Tier별 표시/숨김 로직 |
| renderOrder 설정 | 3D 메시 `renderOrder=95`, 스프라이트 `renderOrder=98` (GlobeCountryLabels=100 아래) |

- **design**: N (프로시저럴 지오메트리, 코드 기반)
- **verify**: 줌인 시 3D 랜드마크 형상 표시, LOD 전환 부드러운지 확인, Firefox에서 InstancedMesh 폴백 정상, 60fps 유지

### Phase 4: 인터랙션 + 국가 연동
| Task | 설명 |
|------|------|
| 랜드마크 호버 라벨 | HTML 오버레이 — 마우스 호버 시 랜드마크 이름/도시/국가 표시 |
| Raycasting 연동 | 기존 GlobeInteraction의 레이캐스팅에 랜드마크 히트 테스트 추가 |
| 국가 색상 틴팅 | dominationStates 데이터와 연동 — 점령국 색상으로 랜드마크 틴트 |
| Screen-space decluttering | 밀집 지역 자동 디클러터링 (중요도 기반 greedy 알고리즘) |
| 모바일 최적화 적용 | useGlobeLOD 모바일 설정에 따른 랜드마크 수/디테일 자동 조절 |

- **design**: Y (호버 UI 패널 디자인)
- **verify**: 호버 정보 표시, 국가 색상 연동, 모바일 30fps 이상, 디클러터링 정상

### Phase 5: 폴리시 + 최적화
| Task | 설명 |
|------|------|
| 랜드마크 등장 애니메이션 | 줌인 시 scale 0→1 이징 (easeOutBack) |
| 야간 조명 효과 | SunLight 기반 야간에 랜드마크 미니 라이트 (emissive glow) |
| 랜드마크 전용 Tier 축소 | useGlobeLOD 내 FPS 기반 간단한 축소 로직 (30fps 이하 → Tier1만 표시). ⚠️ performance.ts AdaptiveQuality와는 별개 — 전체 시스템 통합은 v20 범위 밖 |
| Canvas DPR 제어 (선택적) | GlobeView Canvas에 `dpr={[1, Math.min(window.devicePixelRatio, 2)]}` 적용 — 모바일 3x 렌더링 방지 |
| 최종 성능 프로파일링 | Chrome DevTools GPU 프로파일링, 모바일 실기기 테스트 (특히 Firefox 폴백 확인) |

- **design**: N (이펙트/최적화 중심)
- **verify**: 등장 애니메이션 부드러움, 야간 효과 확인, 저FPS 시 랜드마크 축소 정상, Firefox InstancedMesh 폴백 60fps, 모든 기기 정상
