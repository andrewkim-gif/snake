# PLAN: Country Panel UI 리팩토링 — ENTER [COUNTRY] 통합 버튼

## 1. 개요

### 배경
현재 국가를 클릭하면 CountryPanel 하단에 3개 버튼이 나타남:
- **ENTER ARENA** (녹색) — 해당 국가 아레나 입장
- **SPECTATE** (기본) — 관전 모드 (실제로는 ENTER ARENA와 동일 구현)
- **MANAGE** (골드) — Isometric 도시 관리 전환

또한 GlobeHoverPanel(마우스 호버)에는 2개 버튼:
- **ENTER ARENA** (파란색)
- **MANAGE** (골드)

### 목표
- **ENTER ARENA / SPECTATE 버튼 삭제**
- **MANAGE 위치에 `ENTER [COUNTRY_NAME]` 버튼**을 하단 가로 풀와이드로 배치
- 기존 Manage 기능(Isometric 입장)을 이 버튼에 통합
- 아레나 관련 코드는 **아직 삭제하지 않음** (UI에서만 제거)

### 예시
국가 "Korea" 클릭 시 하단에:
```
┌──────────────────────────────────────────┐
│           ENTER KOREA                    │
└──────────────────────────────────────────┘
```

## 2. 요구사항

### 기능 요구사항
- [FR-1] CountryPanel 하단 footer에서 ENTER ARENA, SPECTATE 버튼 제거
- [FR-2] MANAGE 버튼을 `ENTER {country.name.toUpperCase()}` 텍스트로 변경
- [FR-3] 버튼은 가로 100% 풀와이드 (flex: 1이 아닌 width: 100%)
- [FR-4] GlobeHoverPanel에서도 ENTER ARENA 버튼 제거, MANAGE → `ENTER {countryName}` 변경
- [FR-5] 클릭 시 기존 `onManageCountry` 핸들러 호출 (Isometric 입장)
- [FR-6] CountryPanelProps에서 `onEnterArena`, `onSpectate` prop은 유지 (아직 삭제 안 함)

### 비기능 요구사항
- [NFR-1] 기존 다크 택티컬 디자인 시스템 유지
- [NFR-2] 모바일/데스크탑 양쪽 반응형 유지
- [NFR-3] 기존 코드 최소 변경 (버튼 UI만 교체)

## 3. 기술 방향
- **프레임워크**: Next.js + React (기존 유지)
- **스타일**: 인라인 스타일 + SK 디자인 토큰 (기존 패턴)
- **컴포넌트**: McButton 또는 커스텀 button (기존 패턴 유지)

## 4. 아키텍처 개요

### 영향 범위 (2 파일만 수정)

| 파일 | 변경 내용 |
|------|----------|
| `components/world/CountryPanel.tsx` | footer 영역: 3버튼 → 1버튼 (`ENTER {NAME}`) |
| `components/3d/GlobeHoverPanel.tsx` | 하단 2버튼 → 1버튼 (`ENTER {NAME}`) |

### 변경 상세

#### CountryPanel.tsx — footer 변경
**Before:**
```tsx
<McButton variant="green">ENTER ARENA</McButton>
<McButton variant="default">SPECTATE</McButton>
<McButton variant="default" style={{ color: '#CC9933' }}>MANAGE</McButton>
```

**After:**
```tsx
<McButton
  variant="green"
  onClick={() => country?.iso3 && onManageCountry?.(country.iso3)}
  style={{ width: '100%', fontSize: SKFont.body, padding: '14px 20px' }}
>
  ENTER {country?.name?.toUpperCase()}
</McButton>
```

#### GlobeHoverPanel.tsx — 하단 버튼 변경
**Before:**
```tsx
<button>ENTER ARENA</button>
<button>MANAGE</button>
```

**After:**
```tsx
<button style={{ width: '100%' }}>
  ENTER {data.countryName.toUpperCase()}
</button>
```
- `onClick` → 기존 `onClickManage` 핸들러 사용

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| arena 코드가 아직 남아있어 혼란 | 낮음 | UI만 제거, 코드 정리는 후속 작업 |
| MANAGE → ENTER 전환 시 사용자 혼란 | 낮음 | 버튼 텍스트가 명확하게 국가명 표시 |
| Props 인터페이스 불일치 | 없음 | onEnterArena/onSpectate prop 유지 (unused) |

## 구현 로드맵

### Phase 1: CountryPanel 하단 버튼 통합
| Task | 설명 |
|------|------|
| footer 영역 수정 | 3버튼 → ENTER {NAME} 풀와이드 1버튼으로 교체 |
| 스타일 조정 | McButton variant="green", 가로 풀와이드, 패딩 강화 |
| 핸들러 연결 | onManageCountry 콜백 유지 |

- **design**: N (기존 디자인 시스템 내 변경)
- **verify**: CountryPanel 열었을 때 하단에 ENTER {NAME} 버튼 1개만 표시

### Phase 2: GlobeHoverPanel 버튼 통합
| Task | 설명 |
|------|------|
| 하단 버튼 수정 | 2버튼 → ENTER {NAME} 풀와이드 1버튼으로 교체 |
| 핸들러 연결 | onClickManage 콜백 유지 |
| 패널 높이 조정 | 버튼 1개로 줄어든 만큼 PANEL_HEIGHT 조정 |

- **design**: N (기존 디자인 시스템 내 변경)
- **verify**: 호버 패널에서 ENTER {NAME} 버튼 1개만 표시, 클릭 시 Isometric 입장
