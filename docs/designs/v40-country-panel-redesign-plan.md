# PLAN: v40 — 국가 패널 UI/UX 리디자인 (Wide Panel + Region Map)

## 1. 개요

글로브에서 국가를 클릭했을 때 나오는 **CountryPanel**을 가로로 넓은 2-column 레이아웃으로 리디자인한다.

**현재 UX 문제점:**
- CountryPanel (520px 세로 팝업) → 별도 RegionSelector (380px 사이드 패널) → 게임 진입 = **3단계**
- 지역(Region) 정보가 텍스트 리스트만으로 표시되어 공간감 부족
- 팩션 지배 현황을 한눈에 파악 불가

**목표 UX:**
- 국가 클릭 → **와이드 패널 1개** (좌: 국가 정보, 우: 지역 지도) → 지역 클릭 → 즉시 입장 = **1단계**

### 핵심 변경 사항
1. CountryPanel 가로 폭: 520px → **900px** (좌 400px + 우 500px)
2. 좌측: 기존 국가 정보 (OVERVIEW 탭 핵심 콘텐츠 압축)
3. 우측: **인터랙티브 지역 지도** (SVG 기반, 도시별 분할)
4. 각 지역에 점령 팩션 컬러 표시
5. 지역 클릭 → 소켓 joinRegion → 즉시 게임 진입
6. RegionSelector 별도 패널 제거 (기능이 우측 지도에 통합)

## 2. 요구사항

### 기능 요구사항
- [FR-1] 와이드 패널 레이아웃 (데스크탑 900px, 모바일 풀스크린)
- [FR-2] 좌측: 국가명, 티어, 주요 통계 (GDP, 인구, 군사력), 팩션 주권 정보
- [FR-3] 우측: SVG 기반 지역 지도 — 지역별 영역 클릭 가능
- [FR-4] 지역별 팩션 컬러 오버레이 (점령 중인 팩션의 색상)
- [FR-5] 지역 호버 → 툴팁 (지역명, 유형, 자원, 접속인원, 지배 팩션)
- [FR-6] 지역 클릭 → WebSocket joinRegion → 게임 입장
- [FR-7] 지역 상태 뱃지: OPEN(초록)/FULL(주황)/LOCKED(회색)
- [FR-8] 모바일: 좌우 2-column → 상하 스택 (국가 정보 상단, 지역 지도 하단)

### 비기능 요구사항
- [NFR-1] 패널 열림/닫힘 애니메이션 300ms ease
- [NFR-2] 지역 지도 SVG 렌더링 60fps (hover/click 반응)
- [NFR-3] 기존 CountryPanel의 TOKEN/VOTE/FACTION/CIVILIZATION 탭은 보존 (단, 와이드 패널 좌측에서 접근)

## 3. 기술 방향

- **프레임워크**: Next.js 15 + React 19 (기존 스택)
- **지도 렌더링**: SVG inline 기반 — 국가별 지역 영역을 Voronoi 다이어그램/그리드로 자동 생성
- **좌표 전략**: IRegionDef에 좌표가 없으므로, **지도는 개념적/추상적 다이어그램** (실제 지리 좌표 불필요)
  - 국가 형상을 단순화한 바운딩 박스 안에 지역을 타일 배치
  - 각 지역은 유형 아이콘 + 이름 + 팩션 컬러 fill
- **소켓 통신**: 기존 useMatrixSocket 훅 재사용 (requestRegionList, joinRegion)
- **스타일**: 기존 SK 디자인 토큰 + overlay-tokens 활용 (다크 전술 테마)

## 4. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│              CountryWidePanel (900px, 새 컴포넌트)              │
│  ┌──────────────────┐  ┌────────────────────────────────┐   │
│  │  LEFT (400px)     │  │  RIGHT (500px)                 │   │
│  │                   │  │                                │   │
│  │  국가 헤더        │  │  CountryRegionMap (SVG)         │   │
│  │  (이름, 티어,     │  │  ┌──────────────────────────┐  │   │
│  │   주권 팩션)      │  │  │  ┌────┐ ┌────┐ ┌────┐  │  │   │
│  │                   │  │  │  │수도│ │항구│ │산업│  │  │   │
│  │  핵심 통계 4종    │  │  │  │🏛️ │ │⚓ │ │🏭│  │  │   │
│  │  (GDP/인구/군사/  │  │  │  └────┘ └────┘ └────┘  │  │   │
│  │   행복도)         │  │  │  ┌────┐ ┌────┐         │  │   │
│  │                   │  │  │  │농업│ │군사│         │  │   │
│  │  자원 목록        │  │  │  │🌾 │ │🎖️│         │  │   │
│  │                   │  │  │  └────┘ └────┘         │  │   │
│  │  탭: TOKEN|VOTE|  │  │  └──────────────────────────┘  │   │
│  │  FACTION|CIVIL    │  │                                │   │
│  │  (축소 탭 콘텐츠) │  │  지역 호버 툴팁                 │   │
│  │                   │  │  [접속 인원] [상태] [팩션]      │   │
│  ├──────────────────┤  ├────────────────────────────────┤   │
│  │  BACK 버튼       │  │  선택된 지역: "서울 수도권"      │   │
│  │                   │  │  [ENTER REGION] 버튼            │   │
│  └──────────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 5. 핵심 설계 결정

### ADR-001: 지역 지도 — 추상적 타일 맵 vs 실제 지리 지도
- **결정**: 추상적 타일 맵 (Voronoi/그리드)
- **근거**: IRegionDef에 lat/lng 좌표가 없음. 실제 지리 정보 추가는 195개국×3~7지역 = 800+ 좌표 작업량. 게임적 정보 전달에는 추상 맵이 더 효과적.
- **구현**: 국가별 지역 수(3~7)에 맞는 Grid 레이아웃 자동 생성. 각 셀 = 지역 1개.

### ADR-002: CountryPanel 대체 vs 확장
- **결정**: 새 컴포넌트 `CountryWidePanel` 생성, 기존 CountryPanel 유지 (점진적 교체)
- **근거**: CountryPanel이 990줄+ 복잡한 컴포넌트. 무리한 수정보다 새 컴포넌트 생성 후 WorldView에서 교체가 안전.
- **탭 통합**: 기존 5개 탭(OVERVIEW/TOKEN/VOTE/FACTION/CIVILIZATION) 중 OVERVIEW는 좌측 기본 표시, 나머지 4개는 좌측 하단에 축소된 탭 형태로 유지.

### ADR-003: 소켓 통합 — 패널 내부 관리
- **결정**: CountryWidePanel 내부에서 useMatrixSocket 직접 관리 (RegionSelector 패턴 재사용)
- **근거**: 패널이 열릴 때 소켓 연결 → 지역 목록 요청 → 실시간 상태 수신 → 패널 닫을 때 소켓 해제. 자체 완결형.

### ADR-004: 모바일 대응
- **결정**: 모바일에서는 좌우 → 상하 스택 (국가 정보 상단 컴팩트, 지역 맵 하단)
- **근거**: 900px 와이드 패널은 모바일에서 불가. 풀스크린 바텀시트로 전환.

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 지역 맵 SVG 복잡도 | Medium | 단순 그리드/Voronoi로 제한, 복잡한 지리 형상 배제 |
| 기존 탭 콘텐츠 이식 | Low | 탭 컴포넌트는 이미 분리됨 (CountryTokenInfo, ProposalList 등), import만 옮기면 됨 |
| 소켓 이중 연결 | Medium | CountryWidePanel 마운트 시에만 연결, RegionSelector는 제거하여 충돌 방지 |
| 모바일 UX 저하 | Low | 상하 스택 + 스크롤로 대응, 지역 맵은 터치 탭 지원 |

## 구현 로드맵

### Phase 1: CountryWidePanel 컴포넌트 골격 생성
| Task | 설명 |
|------|------|
| 컴포넌트 생성 | `components/world/CountryWidePanel.tsx` — 900px 2-column 레이아웃 골격 |
| 좌측 패널 | 국가 헤더(이름, 티어, 주권), 핵심 통계 4종, 자원 바 — CountryPanel OVERVIEW에서 추출 |
| Props 인터페이스 | CountryPanel과 동일 props + onRegionSelect 콜백 추가 |
| WorldView 연결 | WorldView에서 CountryPanel → CountryWidePanel으로 교체 |

- **design**: Y (와이드 패널 레이아웃, 좌측 정보 배치)
- **verify**: 빌드 성공, 글로브에서 국가 클릭 시 와이드 패널 표시

### Phase 2: CountryRegionMap SVG 지역 지도
| Task | 설명 |
|------|------|
| RegionMap 컴포넌트 | `components/world/CountryRegionMap.tsx` — SVG 기반 지역 타일 맵 |
| 그리드 레이아웃 생성기 | 지역 수(3~7)에 맞는 타일 배치 알고리즘 (2×2, 2×3, 3×3 등) |
| 지역 타일 렌더링 | 각 타일: 지역명 + 유형 아이콘 + 팩션 컬러 fill + 상태 뱃지 |
| 호버 툴팁 | 지역 호버 시 상세 정보 툴팁 (이름, 유형, 자원, 인원, 팩션) |
| 클릭 핸들러 | 지역 클릭 → onRegionSelect(regionId) 콜백 |

- **design**: Y (SVG 타일 디자인, 호버/액티브 상태, 팩션 컬러 오버레이)
- **verify**: SVG 렌더링, 호버 툴팁 표시, 클릭 이벤트 전파

### Phase 3: 소켓 통합 + 게임 진입 플로우
| Task | 설명 |
|------|------|
| useMatrixSocket 통합 | CountryWidePanel 내부에서 소켓 연결 관리 (RegionSelector 패턴) |
| 지역 목록 실시간 수신 | 연결 시 requestRegionList → 지역별 접속 인원, 상태, 지배 팩션 실시간 반영 |
| 지역 진입 플로우 | 지역 클릭 → joinRegion → "JOINING..." → 성공 시 mode='matrix' 전환 |
| RegionSelector 제거 | 기존 RegionSelector + 'region-select' 모드 분기 제거 |
| page.tsx 플로우 수정 | onManageCountry → 직접 CountryWidePanel에서 지역 선택 → onRegionSelected → matrix |

- **design**: N
- **verify**: 소켓 연결 성공, 지역 목록 수신, 지역 클릭 → 게임 진입 완전 동작

### Phase 4: 탭 통합 + 모바일 대응
| Task | 설명 |
|------|------|
| 축소 탭 시스템 | 좌측 하단에 TOKEN/VOTE/FACTION/CIVILIZATION 탭 (기존 컴포넌트 재사용) |
| 모바일 레이아웃 | 768px 미만: 상하 스택 (국가 정보 → 지역 맵), 풀스크린 바텀시트 |
| 애니메이션 | 패널 열림/닫힘 300ms ease, 탭 전환 200ms |
| 빌드 검증 | tsc 0 errors, 글로브 → 와이드 패널 → 지역 선택 → 게임 진입 전체 플로우 |

- **design**: Y (모바일 스택 레이아웃, 탭 축소 디자인)
- **verify**: 모바일/데스크탑 반응형, 탭 전환, 전체 UX 플로우 정상
