# PLAN: v41 — 국가 패널 통합 (CountryPanel + RegionMap 원스텝 진입)

## 1. 개요

글로브에서 국가를 클릭했을 때 **기존 CountryPanel(520px)을 확장**하여, 국가 정보 + 지역 지도를 **하나의 와이드 패널**에 통합한다.

### 현재 문제점 (3단계 플로우)
```
국가 클릭 → CountryPanel(520px, 5탭) → "ENTER {COUNTRY}" 버튼 클릭 → CountryWidePanel(900px, 국가정보+지역맵) → 지역 클릭 → 게임
```
- CountryPanel과 CountryWidePanel이 **동일한 국가 정보를 중복 표시**
- "ENTER {COUNTRY}" 버튼이 불필요한 중간 단계
- 사용자가 국가를 클릭한 후 **2번 더 클릭**해야 게임에 들어감

### 목표 UX (1단계 통합)
```
국가 클릭 → 와이드 패널 (좌: 기존 CountryPanel 탭 콘텐츠, 우: 지역 지도) → 지역 클릭 → 즉시 게임 입장
```
- **기존 CountryPanel을 직접 수정** — 폭을 520px → 960px로 확장
- 좌측: 기존 5개 탭(OVERVIEW/TOKEN/VOTE/FACTION/CIVILIZATION) 그대로 유지
- 우측: SVG 지역 지도 통합 (현재 CountryRegionMap 컴포넌트 재사용)
- "ENTER {COUNTRY}" 버튼 제거 → 지역 클릭이 곧 입장
- **CountryWidePanel.tsx 제거** (기능이 CountryPanel에 통합됨)

## 2. 요구사항

### 기능 요구사항
- [FR-1] CountryPanel 확장: 520px → 960px (좌 480px + 우 480px)
- [FR-2] 좌측: 기존 5개 탭 콘텐츠 100% 보존 (OVERVIEW/TOKEN/VOTE/FACTION/CIVILIZATION)
- [FR-3] 우측: CountryRegionMap(SVG 타일 지도) 항상 표시
- [FR-4] 지역 타일에 팩션 컬러 오버레이 + 접속인원/상태 뱃지 표시
- [FR-5] 지역 호버 → 툴팁 (지역명, 유형, 자원, 접속인원, 지배 팩션)
- [FR-6] 지역 클릭 → WebSocket joinRegion → 즉시 게임 입장
- [FR-7] "ENTER {COUNTRY}" 버튼 → 제거 (지역 클릭으로 대체)
- [FR-8] 모바일: 좌우 → 상하 스택 (국가 탭 상단, 지역 맵 하단)
- [FR-9] CountryWidePanel.tsx 제거 (중복 컴포넌트)

### 비기능 요구사항
- [NFR-1] 패널 열림/닫힘 애니메이션 300ms ease (기존 유지)
- [NFR-2] 소켓 연결: 패널 open 시 connect → requestRegionList
- [NFR-3] 기존 CountryPanel의 탭 전환/API 호출/지갑 연동 100% 유지

## 3. 기술 방향

- **접근법**: 기존 CountryPanel.tsx를 직접 수정 (새 컴포넌트 생성 X)
- **우측 지도**: CountryRegionMap.tsx 재사용 (이미 구현됨)
- **소켓**: useMatrixSocket 훅 — CountryPanel 내부에서 직접 관리
- **흐름 변경**: WorldView에서 CountryPanel에 `onRegionSelect` prop 추가
- **page.tsx**: mode='region-select' 분기 제거, CountryPanel의 onRegionSelect가 직접 matrix 진입 트리거

## 4. 아키텍처 개요

### 변경 전 흐름
```
Globe click
  → WorldView.handleCountryClick → selectedCountry + panelOpen
    → CountryPanel(520px, 5탭, "ENTER" 버튼)
      → onManageCountry(iso3)
        → page.tsx handleManageCountry → mode='region-select'
          → CountryWidePanel(900px, 국가정보+지역맵)
            → onRegionSelect(regionId)
              → page.tsx handleRegionSelected → mode='matrix'
```

### 변경 후 흐름
```
Globe click
  → WorldView.handleCountryClick → selectedCountry + panelOpen
    → CountryPanel(960px, 좌: 5탭, 우: 지역맵)
      → 지역 클릭 → onRegionSelect(regionId)
        → WorldView → page.tsx → mode='matrix'
```

### 컴포넌트 변경 요약
```
CountryPanel.tsx   — 수정 (520→960px, 우측 지역맵 추가, ENTER 버튼 제거, 소켓 통합)
WorldView.tsx      — 수정 (CountryPanel에 onRegionSelect prop 전달)
page.tsx           — 수정 (mode='region-select' 제거, CountryWidePanel import 제거)
CountryWidePanel.tsx — 삭제 (기능이 CountryPanel에 통합)
CountryRegionMap.tsx — 유지 (그대로 재사용)
```

## 5. 핵심 설계 결정

### ADR-001: CountryPanel 수정 vs 새 컴포넌트
- **결정**: 기존 CountryPanel.tsx를 직접 수정
- **근거**: 사용자가 명시적으로 "기존 팝업을 수정하라"고 요청. 5개 탭 콘텐츠와 API 호출 로직이 이미 CountryPanel에 있으므로, 이를 새 컴포넌트에 복사하면 코드 중복.

### ADR-002: 소켓 연결 시점
- **결정**: CountryPanel이 열릴 때 소켓 연결 시작
- **근거**: 국가 클릭 즉시 지역 정보를 보여줘야 하므로, 패널 open 시 바로 connect → requestRegionList. 별도 단계(ENTER 버튼) 없이 바로 표시.

### ADR-003: "ENTER {COUNTRY}" 버튼 처리
- **결정**: 제거
- **근거**: 지역 지도가 바로 보이므로, 별도 진입 버튼 불필요. 사용자가 지역 타일을 클릭하면 곧바로 joinRegion.

### ADR-004: page.tsx mode='region-select' 처리
- **결정**: 제거
- **근거**: CountryPanel 내에서 직접 소켓 연결 + joinRegion → 성공 시 onRegionSelect 콜백 → page.tsx에서 직접 mode='matrix' 전환. 중간 mode가 불필요.

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| CountryPanel 990줄 수정 복잡도 | Medium | 변경 부분 명확히 한정 (레이아웃 확장 + 우측 패널 추가 + 소켓 통합) |
| 기존 탭 API 호출 깨짐 | Low | 탭 로직은 좌측에 그대로 유지, 우측은 독립적 |
| 모바일 UX | Low | 기존 바텀시트 패턴 유지 + 지역맵은 하단에 스택 |
| 소켓 이중 연결 | Low | CountryWidePanel 제거로 충돌 원천 차단 |

## 구현 로드맵

### Phase 1: CountryPanel 레이아웃 확장 + 지역 맵 통합
| Task | 설명 |
|------|------|
| 레이아웃 확장 | CountryPanel 폭 520px → 960px, 2-column (좌 480px 탭 + 우 480px 지역맵) |
| CountryRegionMap 통합 | 우측에 CountryRegionMap import + 렌더링 |
| 소켓 통합 | useMatrixSocket 훅 추가 (connect/requestRegionList/joinRegion) |
| Props 확장 | onRegionSelect 콜백 prop 추가 |
| ENTER 버튼 제거 | Footer의 "ENTER {COUNTRY}" 버튼 제거 |
| 모바일 대응 | 768px 미만: 좌우 → 상하 스택 |

- **design**: Y
- **verify**: 빌드 성공, 글로브에서 국가 클릭 시 960px 와이드 패널 표시, 우측에 지역 맵 렌더링

### Phase 2: WorldView + page.tsx 플로우 수정
| Task | 설명 |
|------|------|
| WorldView 수정 | CountryPanel에 onRegionSelect prop 전달 |
| page.tsx 수정 | mode='region-select' 분기 제거, CountryWidePanel import 제거 |
| page.tsx 콜백 | WorldView의 onRegionSelect → 직접 mode='matrix' 전환 |
| CountryWidePanel 삭제 | 중복 컴포넌트 삭제 |
| 빌드 검증 | tsc 0 에러, 전체 플로우 동작 확인 |

- **design**: N
- **verify**: 국가 클릭 → 와이드 패널 → 지역 클릭 → 게임 진입 전체 플로우 정상, tsc 0 에러
