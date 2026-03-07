# PLAN: v16 Apex-Style UI Redesign

## 1. 개요

전체 UI를 에이펙스 레전드 스타일로 통일:
- **플랫 + 직각** — 모든 border-radius → 0 (완전한 직사각형)
- **가로 라인 포인트** — 수평 레드 악센트 라인이 패널/카드의 시각적 구분자
- **삼각형 컷 버튼** — 한쪽 코너가 대각선 clip-path로 잘린 에이펙스 버튼
- **포인트 컬러: 레드** — `#EF4444` 계열을 주요 악센트로 통일
- **i18n 에러 수정** — 키 불일치 근본 해결

## 2. 디자인 방향

### 2.1 Apex Legends UI 핵심 요소

```
┌──────────────────────────────────────────────────────┐
│▌ RED ACCENT LINE                                     │
│                                                      │
│  PANEL TITLE                     SECONDARY INFO      │
│  ──────────────────────────────────────────────       │
│                                                      │
│  Content area — flat, no rounded corners             │
│                                                      │
│  ┌────────────────┐  ┌────────────────┐              │
│  │ STAT VALUE     │  │ STAT VALUE     │              │
│  │ label          │  │ label          │              │
│  └────────────────┘  └────────────────┘              │
│                                                      │
│  ┌─────────────────────────┐                         │
│  │ BUTTON TEXT          ◤ │  ← 삼각형 컷             │
│  └─────────────────────────┘                         │
└──────────────────────────────────────────────────────┘
```

### 2.2 버튼 스타일 (Apex Cut)

```
일반:     ┌──────────────────◤│    클립패스로 우상단 삼각 컷
          │  DEPLOY NOW       │
          └───────────────────┘

작은버튼: ┌────────◤│
          │ ACTION  │
          └─────────┘

비활성:   동일 형태 + 40% opacity
```

clip-path: `polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)`

### 2.3 컬러 시스템 변경

| 용도 | 현재 | 변경 |
|------|------|------|
| 주요 악센트 | 다양 (blue, green, gold) | `#EF4444` (Red) 통일 |
| 보조 악센트 | — | `#DC2626` (Dark Red) |
| 가로 라인 | 없음 | `#EF4444` 2px solid |
| 탭 활성 | 각 탭별 색상 | `#EF4444` 통일 |
| 버튼 기본 | left stripe 다색 | Red border + 삼각 컷 |
| 카드 상단 | gradient accent | 좌측 `3px solid #EF4444` |
| 경제 악센트 | SK.green | 유지 (데이터 색상은 의미 기반) |
| 팩션 악센트 | SK.red | 유지 |
| 거버넌스 | SK.blue | 유지 |
| UI 크롬 | 다양 | `#EF4444` 통일 |

> **원칙**: UI 크롬(버튼, 탭, 패널 장식)은 레드 통일. 데이터 시각화(차트, 상태) 색상은 의미 기반 유지.

### 2.4 라디우스 변경

| 요소 | 현재 | 변경 |
|------|------|------|
| 패널/카드 | 8-12px | 0 |
| 버튼 | 4-6px | 0 (+ clip-path) |
| 인풋 | 8px | 0 |
| 모달 | 12px | 0 |
| 팝업 | 12px | 0 |
| 배지/필 | pill (9999px) | 0 |
| 드롭다운 | 8px | 0 |

## 3. i18n 에러 근본 원인 + 수정

### 3.1 원인 분석

PopupTabNav에서 `tNav(tab.key)` 호출:
- `tab.key = 'governance'` → `tNav('governance')` 호출
- 메시지 파일의 nav 키: `"govern": "거버넌스"` (governance가 아님)
- **키 불일치**: 컴포넌트 키 `governance` ≠ 메시지 키 `govern`

### 3.2 수정 방안

**메시지 파일에 `governance` 키 추가** (기존 `govern` 유지 — 하위 호환):

```json
"nav": {
  "world": "WORLD",
  "economy": "ECONOMY",
  "govern": "GOVERN",
  "governance": "GOVERNANCE",  // ← 추가
  "factions": "FACTIONS",
  "more": "MORE",
  "hallOfFame": "HALL OF FAME",
  "profile": "PROFILE",
  "dashboard": "DASHBOARD",
  "settings": "SETTINGS"
}
```

en.json과 ko.json 모두 동일하게 추가.

### 3.3 추가 점검

MoreMenu.tsx에서도 `tNav()` 사용 — 해당 파일에서 `govern` 키 사용 중이면 유지.
PopupTabNav는 `governance` 키 사용 → 추가로 해결.

## 4. 영향 범위

### 4.1 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/sketch-ui.ts` | radius 전부 0, accent 레드 추가, clip-path 헬퍼 |
| `components/lobby/McButton.tsx` | 삼각 컷 clip-path + 레드 악센트 |
| `components/lobby/McPanel.tsx` | radius 0 + 좌측 레드 라인 |
| `components/lobby/McInput.tsx` | radius 0 + 레드 포커스 링 |
| `components/hub/GameSystemPopup.tsx` | radius 0 + 레드 악센트 라인 |
| `components/hub/PopupTabNav.tsx` | radius 0 + 레드 활성 탭 |
| `components/hub/PageHeader.tsx` | radius 0 + 레드 악센트 라인 |
| `components/hub/DashPanel.tsx` | radius 0 + 좌측 레드 라인 |
| `components/hub/StatCard.tsx` | radius 0 |
| `components/hub/FilterBar.tsx` | radius 0 + 레드 활성 |
| `components/hub/DetailModal.tsx` | radius 0 |
| `components/hub/SubTabNav.tsx` | radius 0 + 레드 활성 |
| `components/hub/LoadingSkeleton.tsx` | radius 0 |
| `components/hub/SettingsContent.tsx` | 새 디자인 적용 |
| `components/navigation/LanguageSwitcher.tsx` | radius 0 |
| `components/navigation/MoreMenu.tsx` | radius 0 |
| `components/lobby/RoomList.tsx` | radius 0 + 레드 포인트 |
| `components/lobby/RecentWinnersPanel.tsx` | radius 0 |
| `components/lobby/LobbyHeader.tsx` | 레드 악센트 라인 |
| `app/page.tsx` | 에이전트 설정 패널 디자인 |
| `messages/en.json` | nav.governance 키 추가 |
| `messages/ko.json` | nav.governance 키 추가 |
| **허브 페이지들** | 각 page.tsx 스타일 업데이트 |

### 4.2 허브 페이지 현황

| 페이지 | 파일 | 상태 | 비고 |
|--------|------|------|------|
| Economy/Tokens | `economy/tokens/page.tsx` | 정상 | DashboardPage 래퍼 |
| Economy/Trade | `economy/trade/page.tsx` | 동적 import | 서버 의존 |
| Economy/Policy | `economy/policy/page.tsx` | 동적 import | 서버 의존 |
| Factions | `factions/page.tsx` | 정상 | 목 데이터 + DetailModal |
| Factions/Market | `factions/market/page.tsx` | 동적 import | 서버 의존 |
| Governance | `governance/page.tsx` | 정상 | FilterBar + DetailModal |
| Governance/New | `governance/new/page.tsx` | 동적 import | 서버 의존 |
| Governance/History | `governance/history/page.tsx` | 동적 import | 서버 의존 |
| Hall of Fame | `hall-of-fame/page.tsx` | 정상 | 시즌 타임라인 |
| Profile | `profile/page.tsx` | 정상 | 2컬럼 + 업적 |
| Dashboard | — | Coming soon | 플레이스홀더 |
| Settings | `SettingsContent.tsx` | 정상 | 기본 설정 |

## 5. 구현 로드맵

### Phase 1: i18n 에러 수정 + 디자인 토큰 업데이트
| Task | 설명 |
|------|------|
| i18n 키 추가 | en.json, ko.json에 `nav.governance` 키 추가 |
| sketch-ui.ts 업데이트 | radius 전부 0으로 변경, `accentRed` 토큰 추가, `apexClip` clip-path 헬퍼 추가 |
| 빌드 검증 | i18n 에러 해결 + 토큰 변경 빌드 확인 |

- **design**: N (토큰 + 에러 수정)
- **verify**: 빌드 성공, PopupTabNav i18n 에러 없음

### Phase 2: 기본 컴포넌트 재설계 (Button, Panel, Input)
| Task | 설명 |
|------|------|
| McButton → Apex 버튼 | clip-path 삼각 컷 + 레드 악센트 보더 + radius 0 |
| McPanel 업데이트 | radius 0 + 좌측 3px 레드 라인 |
| McInput 업데이트 | radius 0 + 레드 포커스 링 (`#EF4444` 대체) |

- **design**: Y (컴포넌트 UI)
- **verify**: 로비 화면에서 버튼/패널/인풋 렌더링 정상

### Phase 3: 허브 시스템 재설계 (Popup + TabNav + Header)
| Task | 설명 |
|------|------|
| GameSystemPopup 리디자인 | radius 0, 상단 레드 악센트 라인, backdrop 유지 |
| PopupTabNav 리디자인 | 직사각 탭 + 레드 하단 라인 활성 + 가로 구분선 |
| PageHeader 리디자인 | radius 0, 상단 레드 가로 라인 2px |
| DashPanel 리디자인 | radius 0, 좌측 레드 스트라이프 3px |
| StatCard 리디자인 | radius 0 |
| FilterBar 리디자인 | radius 0 + 레드 활성 배경 |
| DetailModal 리디자인 | radius 0 + 상단 레드 라인 |
| SubTabNav 리디자인 | radius 0 + 레드 활성 |
| LoadingSkeleton | radius 0 |

- **design**: Y (허브 UI 전체)
- **verify**: 팝업 열기/닫기, 탭 전환, 모든 허브 컴포넌트 렌더링

### Phase 4: 에이전트 설정 패널 재설계
| Task | 설명 |
|------|------|
| 설정 패널 리디자인 | 직사각 플랫 패널 + 상단 레드 라인 + 가로 구분자 |
| 토글 버튼 리디자인 | 접기/펼치기 → Apex 스타일 삼각 컷 |
| NationalitySelector | radius 0 적용 |
| CharacterCreator | radius 0 적용 |

- **design**: Y (에이전트 설정 UI)
- **verify**: 에이전트 설정 패널 열기/닫기, 입력/선택 정상

### Phase 5: 허브 페이지 스타일 적용
| Task | 설명 |
|------|------|
| Economy 페이지들 | tokens/trade/policy — DashPanel 레드 라인 적용 |
| Factions 페이지 | 카드 radius 0 + 레드 선택 보더 |
| Governance 페이지 | FilterBar 레드 + VoteInterface 스타일 |
| Hall of Fame | 시즌 타임라인 + 카드 radius 0 |
| Profile | 2컬럼 카드 radius 0 + 배지 스타일 |
| Settings | 전체 radius 0 + 레드 악센트 |

- **design**: Y (페이지별 UI)
- **verify**: 모든 7개 탭 렌더링 정상, 동적 import 에러 없음

### Phase 6: 네비게이션 + 헤더 + 모바일 폴리시
| Task | 설명 |
|------|------|
| LobbyHeader | 하단 레드 악센트 라인 |
| LanguageSwitcher | radius 0 |
| MoreMenu | dropdown/bottomSheet radius 0 |
| RoomList | 직사각 카드 + 레드 상태 포인트 |
| RecentWinnersPanel | radius 0 |
| 모바일 팝업 | 풀스크린 + radius 0 |
| 에러 토스트 | radius 0 + 레드 배경 |

- **design**: N (폴리시)
- **verify**: 빌드 성공, 모바일 반응형, 모든 페이지 에러 없음

## 6. 디자인 토큰 변경 상세 (sketch-ui.ts)

### 6.1 radius 변경
```typescript
// BEFORE
radius = { sm: '4px', md: '8px', lg: '12px', xl: '16px', pill: '9999px' }

// AFTER (Apex — 전부 0)
radius = { sm: '0', md: '0', lg: '0', xl: '0', pill: '0' }
```

### 6.2 신규 토큰
```typescript
// Apex 악센트
accentPrimary: '#EF4444'      // 주요 악센트 (레드)
accentPrimaryDark: '#DC2626'  // 다크 레드
accentPrimaryLight: '#F87171' // 라이트 레드 (호버)
accentLine: '2px solid #EF4444' // 가로 포인트 라인

// Apex 버튼 clip-path
apexClipSm: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)'
apexClipMd: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)'
apexClipLg: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)'
```

### 6.3 McButton 변경 요약
```
BEFORE: 좌측 3px 컬러 스트라이프 + 6px radius + 다색 variants
AFTER:  clip-path 우상단 삼각 컷 + 0 radius + 레드 보더 1px + 레드 hover glow
```

## 7. Verification

- `cd apps/web && npx next build` — TypeScript 빌드 성공
- 팝업 열기 → 7개 탭 전환 → 서브탭 전환 → i18n 에러 없음
- 에이전트 설정 패널 열기/닫기 → 입력 → 국적 선택
- 모든 radius가 0 (직사각형) 확인
- 레드 악센트 라인이 패널/헤더/탭에 적용
- 버튼에 삼각 컷 clip-path 적용
- 모바일 (<768px) 팝업 풀스크린 + 레이아웃 정상
