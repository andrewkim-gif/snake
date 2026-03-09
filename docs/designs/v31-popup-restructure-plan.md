# PLAN: 게임 시스템 팝업 재구성 (v31)

## 1. 개요

현재 단일 `GameSystemPopup`에 7개 탭이 모두 포함된 구조를 해체하여,
기능별로 독립된 팝업 시스템으로 분리합니다.

**목적**: 사용자가 원하는 기능에 직접 접근할 수 있도록 UX를 개선하고,
각 시스템의 독립성을 높여 유지보수성을 향상시킵니다.

## 2. 현재 구조 (AS-IS)

```
좌하단: [AGENT SETUP] [GAME SYSTEM] [ENTER MATRIX] [Lang]
우상단: [ONLINE 인디케이터]
우하단: [BGM Player]

GAME SYSTEM 클릭 → GameSystemPopup (단일 팝업)
  ├─ 상단 탭: economy | factions | governance | hallOfFame | profile | dashboard | settings
  ├─ 서브탭: economy(tokens/trade/policy), factions(overview/market), governance(proposals/new/history)
  └─ 콘텐츠 영역 (dynamic import)
```

## 3. 목표 구조 (TO-BE)

```
좌하단 버튼 (수직 스택):
  [AGENT SETUP]        — 기존 유지
  [ECONOMY]            — 경제 전용 팝업
  [FACTIONS]           — 팩션 전용 팝업
  [GOVERNANCE]         — 거버넌스 전용 팝업
  [ENTER MATRIX]       — 기존 유지
  [Lang]               — 기존 유지

우상단 버튼 (수평 배치):
  [ONLINE 인디케이터]   — 기존 유지
  [🏆 명예의전당]       — 명예의전당 팝업
  [⚙️ 설정]            — 프로필+대시보드+설정 통합 팝업
```

## 4. 팝업 상세 설계

### 4-1. 경제 팝업 (EconomyPopup)

| 항목 | 설명 |
|------|------|
| 트리거 | 좌하단 ECONOMY 버튼 |
| 가로 | 화면 풀폭 (100vw - 좌우 패딩 16px) |
| 세로 | 컨텐츠 적응형, max-height: 90vh |
| 탭 구조 | **상단 탭 없음** — 서브탭만 수평 필터로 표시 |
| 서브섹션 | tokens(기본) · trade · policy |
| 서브 전환 | 상단 pill 형태 서브 필터 바 (PopupTabNav 제거, FilterBar 스타일) |
| URL | `?popup=economy&section=tokens` |
| 닫기 | ESC / backdrop / X 버튼 |
| 애니메이션 | 하단에서 슬라이드 업 (좌하단 버튼에서 올라오는 느낌) |

### 4-2. 팩션 팝업 (FactionPopup)

| 항목 | 설명 |
|------|------|
| 트리거 | 좌하단 FACTIONS 버튼 |
| 가로 | 화면 풀폭 |
| 서브섹션 | overview(기본) · market |
| 서브 전환 | 상단 pill 필터 바 |
| URL | `?popup=factions&section=overview` |
| 나머지 | EconomyPopup과 동일 패턴 |

### 4-3. 거버넌스 팝업 (GovernancePopup)

| 항목 | 설명 |
|------|------|
| 트리거 | 좌하단 GOVERNANCE 버튼 |
| 가로 | 화면 풀폭 |
| 서브섹션 | proposals(기본) · new · history |
| 서브 전환 | 상단 pill 필터 바 |
| URL | `?popup=governance&section=proposals` |
| 나머지 | EconomyPopup과 동일 패턴 |

### 4-4. 명예의전당 팝업 (HallOfFamePopup)

| 항목 | 설명 |
|------|------|
| 트리거 | 우상단 트로피 아이콘 버튼 |
| 가로 | 화면 풀폭 |
| 탭/서브 | 없음 (단일 페이지) |
| URL | `?popup=hallOfFame` |
| 애니메이션 | 상단에서 슬라이드 다운 (우상단 버튼에서 내려오는 느낌) |
| 나머지 | 동일 |

### 4-5. 설정 통합 팝업 (SettingsPopup)

| 항목 | 설명 |
|------|------|
| 트리거 | 우상단 기어 아이콘 버튼 |
| 가로 | 화면 풀폭 |
| 내부 탭 | profile · dashboard · settings |
| 탭 스타일 | 좌측 세로 사이드바 (아이콘 + 라벨) — 우측 콘텐츠 |
| 기본 탭 | profile |
| URL | `?popup=settings&tab=profile` |
| 애니메이션 | 우측에서 슬라이드 인 (설정 패널 느낌) |

**설정 팝업 내부 레이아웃:**
```
┌─────────────────────────────────────────────────────┐
│  [X]                                        설정 통합 │
├──────────┬──────────────────────────────────────────┤
│ 👤 프로필  │                                          │
│ 📊 대시보드 │        선택된 탭의 콘텐츠 영역              │
│ ⚙️ 설정   │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

## 5. 버튼 디자인

### 좌하단 버튼 스택

```
기존 clipPath 다각형 스타일 유지 (SK.accent 배경)
아이콘 + 라벨 구성:

[⚙️ AGENT SETUP ]  — 기존
[💰 ECONOMY     ]  — NEW (TrendingUp 아이콘, SK.green 액센트)
[⚔️ FACTIONS    ]  — NEW (Swords 아이콘, SK.red 액센트)
[🏛️ GOVERNANCE  ]  — NEW (Landmark 아이콘, SK.blue 액센트)
[▶  ENTER MATRIX]  — 기존
[🌐 Lang        ]  — 기존
```

- 각 버튼에 해당 시스템의 액센트 컬러를 좌측 스트라이프로 표시
- hover 시 해당 색상으로 배경 하이라이트
- 활성(팝업 열린 상태) 시 배경색 유지 + 아이콘 pulse 애니메이션

### 우상단 버튼

```
아이콘 버튼 (원형, 36px, 반투명 배경):

[ONLINE ●]  [🏆]  [⚙️]
                ↑     ↑
           명예전당  설정통합
```

- 미니멀 원형 아이콘 버튼
- hover 시 툴팁 (HALL OF FAME / SETTINGS)
- 활성 시 링 하이라이트

## 6. 팝업 공통 사양

| 항목 | 값 |
|------|-----|
| z-index | 90 (기존 GameSystemPopup과 동일) |
| 배경 딤 | rgba(10,11,16,0.85) + backdrop-filter: blur(4px) |
| 동시 열기 | 불가 — 하나 열면 다른 것 자동 닫힘 |
| 모바일 | 완전 풀스크린 (border-radius: 0) |
| 스크롤 | 콘텐츠 영역 내부 스크롤 (body 스크롤 잠금) |
| ESC 닫기 | 지원 |
| Backdrop 클릭 | 닫기 |

## 7. URL 스키마 변경

```
AS-IS: ?panel=economy&tab=tokens
TO-BE: ?popup=economy&section=tokens

AS-IS: ?panel=hallOfFame
TO-BE: ?popup=hallOfFame

AS-IS: ?panel=profile
TO-BE: ?popup=settings&tab=profile

AS-IS: ?panel=dashboard
TO-BE: ?popup=settings&tab=dashboard

AS-IS: ?panel=settings
TO-BE: ?popup=settings&tab=settings
```

- `panel` → `popup` (파라미터명 변경)
- `tab` → `section` (시스템 팝업 서브섹션) 또는 `tab` (설정 팝업 내부 탭)
- 하위 호환: 기존 `?panel=` URL은 새 `?popup=` URL로 리디렉트

## 8. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 좌하단 버튼 6개로 공간 부족 | 모바일에서 겹침 | 모바일에서는 햄버거 메뉴로 축소 |
| (hub)/layout.tsx 리디렉트 깨짐 | 외부 링크 404 | 리디렉트 맵 업데이트 |
| GameSystemPopup 제거 시 참조 누락 | 빌드 에러 | find_referencing_symbols로 전수 검사 |
| DetailModal z-index 충돌 | 모달 겹침 | z-index 계층 재정의 |

## 구현 로드맵

### Phase 1: 공통 팝업 인프라 구축
| Task | 설명 |
|------|------|
| SystemPopup 공통 컴포넌트 | 풀폭 팝업 오버레이 (ESC/backdrop/X/딤/애니메이션) |
| SectionNav 컴포넌트 | pill 형태 서브섹션 전환 바 (PopupTabNav 대체) |
| usePopup 훅 | URL 상태 동기화 (?popup=&section=), 동시열기 방지 |
| 레거시 URL 리디렉트 | ?panel= → ?popup= 매핑 |

- **design**: Y (팝업 공통 UI)
- **verify**: SystemPopup 렌더링, ESC/backdrop 닫기, URL 동기화 작동

### Phase 2: 경제 / 팩션 / 거버넌스 독립 팝업
| Task | 설명 |
|------|------|
| EconomyPopup | 경제 전용 팝업 + SectionNav(tokens/trade/policy) |
| FactionPopup | 팩션 전용 팝업 + SectionNav(overview/market) |
| GovernancePopup | 거버넌스 전용 팝업 + SectionNav(proposals/new/history) |
| 좌하단 버튼 3개 추가 | ECONOMY / FACTIONS / GOVERNANCE 버튼 + 색상 스트라이프 |
| 기존 GAME SYSTEM 버튼 제거 | 불필요한 통합 버튼 삭제 |

- **design**: Y (3개 팝업 + 버튼 UI)
- **verify**: 각 팝업 정상 렌더링, 서브섹션 전환, 기존 콘텐츠 동일 표시

### Phase 3: 명예의전당 + 설정 통합 팝업
| Task | 설명 |
|------|------|
| HallOfFamePopup | 명예의전당 전용 팝업 (상단 슬라이드다운) |
| SettingsPopup | 프로필+대시보드+설정 통합 팝업 (좌측 사이드바 탭) |
| 우상단 버튼 2개 추가 | 트로피 아이콘 + 기어 아이콘 |

- **design**: Y (2개 팝업 + 우상단 버튼)
- **verify**: 명예의전당/설정 팝업 정상 작동, 내부 탭 전환

### Phase 4: 정리 및 통합
| Task | 설명 |
|------|------|
| GameSystemPopup 제거 | 기존 통합 팝업 + PopupTabNav 삭제 |
| (hub)/layout.tsx 리디렉트 업데이트 | 새 URL 스키마에 맞게 수정 |
| 모바일 반응형 | 좌하단 버튼 축소/햄버거, 팝업 풀스크린 |
| 빌드 검증 | 미참조 import 정리, 타입 에러 수정 |

- **design**: N (정리 중심)
- **verify**: 빌드 성공, 모든 팝업 정상, 레거시 URL 리디렉트 작동, 모바일 대응
