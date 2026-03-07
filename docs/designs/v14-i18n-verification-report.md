# Verification Report: v15 i18n Plan

> **Date**: 2026-03-07
> **Target**: `docs/designs/v15-i18n-plan.md`
> **Type**: Architecture + Completeness + Feasibility
> **Confidence**: High (코드 대조 + next-intl 공식 문서 검증)

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| Architecture | 3 | **1** | 2 | 0 | 0 |
| Completeness | 3 | 0 | **1** | **2** | 0 |
| Feasibility | 2 | 0 | **1** | **1** | 0 |
| Quality | 2 | 0 | 0 | **1** | **1** |
| **Total** | **10** | **1** | **4** | **4** | **1** |

---

## Critical Issues (즉시 수정 필요)

### C-1: `router.refresh()` WebSocket 파괴 문제

- **Location**: 기획서 §4 아키텍처 개요 — 언어 전환 플로우
- **Category**: Architecture
- **Evidence**: next-intl GitHub Issue #496 — `router.refresh()`는 Server Component 전체 재평가 → Client Component 트리 언마운트/재마운트 → **SocketProvider의 WebSocket 연결 파괴**
- **Impact**: 언어 전환 시 게임 연결 끊김, 진행 중인 게임 상태 유실
- **현재 기획**:
  ```
  사용자 클릭 [🌐 EN/KO]
    → setCookie('locale', 'en')
    → router.refresh()  ← ❌ WebSocket 파괴!
  ```
- **수정안**: Client-side locale context 패턴으로 변경
  ```
  사용자 클릭 [🌐 EN/KO]
    → setState(locale) → NextIntlClientProvider messages 교체 (즉시)
    → setCookie('locale', 'en') → 다음 서버 렌더에 반영
    → document.documentElement.lang = 'en'
    → ❌ router.refresh() 호출 안 함
  ```
  구현 방식:
  - layout.tsx에서 **모든 로케일 메시지를 사전 로드** (2언어: ko.json + en.json)
  - Client wrapper (`I18nClientWrapper`)가 locale state 관리
  - `NextIntlClientProvider`의 `messages` prop만 교체 → 리렌더만, 언마운트 없음
  - Cookie는 다음 방문 시 서버 초기 로케일 결정용

  **트레이드오프**: 2개 언어 JSON 동시 로드 (~10-20KB) — Three.js 600KB 대비 무시 가능

---

## High Priority Issues

### H-1: 허브 페이지 언어 전환 UI 누락

- **Location**: 기획서 Phase 3 — "LobbyHeader에 🌐 EN/KO 토글 버튼 추가"
- **Category**: Completeness
- **Evidence**: `apps/web/app/(hub)/layout.tsx`는 별도 헤더 (`<header>`)를 갖고 있으며 LobbyHeader를 사용하지 않음. Hub 페이지(`/economy`, `/governance`, `/factions`, `/profile`)에서는 LobbyHeader가 보이지 않음.
- **Impact**: 허브 페이지 방문 시 언어 전환 불가
- **수정안**:
  - `(hub)/layout.tsx` 헤더에도 언어 전환 버튼 추가
  - 또는 공용 `LanguageSwitcher` 컴포넌트를 만들어 양쪽 헤더에 삽입

### H-2: `export const metadata` 정적 → 동적 전환 필요

- **Location**: 기획서 Phase 6 "metadata 번역" / `apps/web/app/layout.tsx:7`
- **Category**: Feasibility
- **Evidence**: 현재 `export const metadata: Metadata`는 정적 export. 로케일별 title/description 변경하려면 `generateMetadata()` 함수로 전환 필요.
- **Impact**: Phase 6의 metadata 번역이 단순 텍스트 교체가 아닌 구조 변경 필요
- **수정안**:
  ```tsx
  // 현재: export const metadata = { title: 'AI World War' };
  // 변경: export async function generateMetadata() {
  //   const locale = (await cookies()).get('locale')?.value ?? 'ko';
  //   return { title: locale === 'ko' ? 'AI 월드워' : 'AI World War', ... };
  // }
  ```
  Phase 1에서 인프라 설정 시 함께 처리해야 함

### H-3: Accept-Language 파싱에 추가 의존성 필요

- **Location**: 기획서 §2 FR-3 "브라우저 Accept-Language 기반 자동 감지"
- **Category**: Feasibility
- **Evidence**: `getRequestConfig`에서 `headers()`로 `Accept-Language` 읽기는 가능하나, 표준 파싱 (`en-US,en;q=0.9,ko;q=0.8`)에는 `negotiator` + `@formatjs/intl-localematcher` 패키지 필요.
- **Impact**: Phase 6 브라우저 자동감지 구현 시 추가 패키지 설치 필요
- **수정안**: Phase 1 설치 목록에 추가
  ```
  npm install next-intl negotiator @formatjs/intl-localematcher
  npm install -D @types/negotiator
  ```
  또는 2언어만이므로 간단한 수동 파싱으로 대체 가능:
  ```ts
  const lang = acceptLang.includes('ko') ? 'ko' : 'en';
  ```

### H-4: FR-2 "localStorage 영속" vs Cookie 아키텍처 모순

- **Location**: 기획서 §2 FR-2 vs §4 아키텍처
- **Category**: Architecture
- **Evidence**: FR-2는 "선택 언어 localStorage 영속"이라고 명시하나, 아키텍처는 cookie 기반. Cookie도 영속적이므로 localStorage는 불필요.
- **수정안**: FR-2를 "선택 언어 **cookie** 영속 (max-age=1년)"으로 수정. localStorage는 제거.

---

## Medium Priority Issues

### M-1: 누락된 컴포넌트 ~15개

- **Location**: 기획서 구현 로드맵 Phase 4, 5
- **Category**: Completeness
- **Evidence**: 코드 검색 결과 다음 컴포넌트에 하드코딩 텍스트가 있으나 기획서에 미포함:

  **Phase 4 (게임) 누락:**
  | 컴포넌트 | 주요 텍스트 |
  |----------|-----------|
  | `SpectatorMode.tsx` | "SPECTATING", "FREE CAM", "FOLLOW", "FREE CAMERA", "{N} watching" |
  | `LevelUpOverlay.tsx` | "LEVEL UP! Lv.{N}", "Choose an upgrade [1][2][3]" |
  | `AnalystPanel.tsx` | 분석 패널 UI 텍스트 |
  | `FactionScoreboard.tsx` | 팩션 점수판 라벨 |
  | `GameMinimap.tsx` | 미니맵 라벨 (있는 경우) |
  | `SynergyPopup.tsx` | 시너지 팝업 텍스트 |

  **Phase 5 (허브) 누락:**
  | 컴포넌트 | 주요 텍스트 |
  |----------|-----------|
  | `FactionDetail.tsx` | 팩션 상세 정보 텍스트 |
  | `FactionList.tsx` | 팩션 목록 라벨 |
  | `TechTree.tsx` | 테크 트리 노드 이름/설명 |
  | `UNCouncil.tsx` | UN 의회 UI 텍스트 |
  | `WorldMap.tsx` | 지도 UI 라벨 |
  | `CountryTokenInfo.tsx` | 토큰 정보 라벨 |
  | `SeasonTimeline.tsx` | 시즌 타임라인 라벨 |

  **Phase 3 (로비) 누락:**
  | 컴포넌트 | 주요 텍스트 |
  |----------|-----------|
  | `TrainingConsole.tsx` | 훈련 콘솔 UI 텍스트 |
  | `PixelLogo.tsx` | 로고 alt 텍스트 |

- **수정안**: 각 Phase의 Task 테이블에 누락 컴포넌트 추가

### M-2: 서버 생성 동적 텍스트 처리 미흡

- **Location**: 기획서 §3 "동적 게임 텍스트 패턴"
- **Category**: Completeness
- **Evidence**:
  - `LevelUpOverlay`: 업그레이드 이름/설명이 `@agent-survivor/shared`의 `UpgradeChoice` 타입에서 옴 — 서버가 영어 문자열 전송
  - `CoachBubble`: AI 코치 메시지가 서버에서 자연어 문장으로 전송 — 번역 불가
  - `AnalystPanel`: 라운드 분석 텍스트가 서버 생성
- **Impact**: 이들 텍스트는 static 번역 키로 처리 불가. 별도 전략 필요.
- **수정안**:
  - 업그레이드 이름/설명: shared 패키지에 ID만 정의, 클라이언트에서 ID → 번역 키 매핑
  - 코치/분석 메시지: v1에서는 영어 유지, 향후 서버에서 locale 파라미터 받아 생성 고려
  - 기획서에 "번역 제외 텍스트" 섹션 추가

### M-3: `(hub)/layout.tsx` 내 하드코딩 텍스트

- **Location**: `apps/web/app/(hub)/layout.tsx:127, 145, 232`
- **Category**: Completeness
- **Evidence**: Hub 레이아웃에 "AI WORLD WAR" (로고 폴백), "ALPHA" (뱃지), "TOKEN HOLDINGS" (드롭다운 헤더) 등 하드코딩 텍스트 존재. 기획서의 어느 Phase에도 `(hub)/layout.tsx` 명시적 언급 없음.
- **수정안**: Phase 2 "공통 + 네비게이션" 또는 Phase 5에 허브 레이아웃 번역 태스크 추가

### M-4: Korean 텍스트 길이 미검증

- **Location**: 기획서 §5 리스크 "한국어 텍스트 길이 차이"
- **Category**: Quality
- **Evidence**: 대표적 길이 차이 예시:
  | English | Korean | 길이 비율 |
  |---------|--------|----------|
  | "PLAY AGAIN" | "다시 플레이" | +20% |
  | "DEPLOYING TO ARENA..." | "아레나에 배치 중..." | +10% |
  | "Choose an upgrade [1][2][3]" | "업그레이드를 선택하세요 [1][2][3]" | +40% |
  | "Click a country to deploy" | "국가를 클릭하여 배치하세요" | +30% |
  | "Eaten by Player1" | "Player1에게 처치되었습니다" | +50% |

  고정 폭 UI 요소(`min-width`, 패딩 고정)에서 한국어 텍스트가 넘칠 위험.
- **수정안**: Phase 6에 구체적인 레이아웃 검증 체크리스트 추가 (특히 버튼, 탭, 뱃지)

---

## Low Priority Issues

### L-1: 버전 넘버링 불일치

- **Location**: 기획서 §1 "Version: v15"
- **Category**: Quality
- **Evidence**: 현재 코드베이스는 v12-v13 범위 (page.tsx 주석: "v12", SocketProvider: "v13 Phase 0"). v15는 건너뛰기가 큼.
- **수정안**: 프로젝트 버전 관리 체계에 맞게 조정 (v14 또는 v13.x)

---

## Positive Findings (잘 된 점)

| 항목 | 평가 |
|------|------|
| next-intl 선정 | ✅ Next.js 15 App Router 최적, 번들 4KB, 공식 지원 |
| Cookie 기반 URL 전략 | ✅ 기존 라우트 변경 없음, 게임 앱에 적합 |
| 네임스페이스 분리 | ✅ 14개 기능별 분리는 적절한 수준 |
| Phase 분할 | ✅ 6단계 점진적 마이그레이션은 합리적 |
| 서버 locale-agnostic | ✅ Go 서버 변경 불필요한 설계 |
| `precompile: true` 사용 가능 | ✅ `t.raw()` 미사용 확인 — precompile 안전 |
| R3F + next-intl 충돌 없음 | ✅ HUD는 Canvas 밖 HTML — Provider 충돌 없음 |

---

## Recommended Plan Modifications

### 1. 아키텍처 변경: Client-side Locale Context (C-1 해결)

```
app/layout.tsx (Server Component)
  ├─ 모든 로케일 메시지 로드 (ko.json + en.json)
  ├─ cookie에서 초기 로케일 읽기
  └─ I18nClientWrapper (Client Component) ← NEW
       ├─ locale state 관리 + NextIntlClientProvider
       └─ SocketProvider (WebSocket 유지!)
            └─ children
```

핵심: `router.refresh()` 제거 → locale state 변경만으로 전환 → WebSocket 안전

### 2. Phase 1 태스크 추가

- `I18nClientWrapper` provider 생성 (locale state + cookie sync)
- `generateMetadata()` 전환 (H-2)
- `negotiator` 또는 간단 Accept-Language 파서 (H-3)

### 3. Phase 3 태스크 추가

- `(hub)/layout.tsx` 헤더 언어 전환 버튼 (H-1)
- `TrainingConsole.tsx`, `PixelLogo.tsx` 번역 (M-1)

### 4. Phase 4 태스크 추가

- `SpectatorMode.tsx` — "SPECTATING", "FREE CAM" 등 (M-1)
- `LevelUpOverlay.tsx` — "LEVEL UP!", "Choose an upgrade" (M-1)
- `AnalystPanel.tsx`, `FactionScoreboard.tsx`, `SynergyPopup.tsx` (M-1)
- "번역 제외" 명시: CoachBubble 메시지, AnalystPanel 분석 결과 (M-2)

### 5. Phase 5 태스크 추가

- `FactionDetail.tsx`, `FactionList.tsx`, `TechTree.tsx` (M-1)
- `UNCouncil.tsx`, `WorldMap.tsx`, `CountryTokenInfo.tsx`, `SeasonTimeline.tsx` (M-1)
- `(hub)/layout.tsx` 내 텍스트: "TOKEN HOLDINGS", 로고 폴백 등 (M-3)

### 6. FR-2 수정

- "localStorage 영속" → "cookie 영속 (max-age=1년)" (H-4)

---

## Match Rate: 72%

| 기준 | 점수 | 비고 |
|------|------|------|
| 기술 선정 | 95% | next-intl + cookie 전략 적절 |
| 아키텍처 설계 | 50% | ❌ router.refresh() WebSocket 파괴 치명적 |
| 컴포넌트 커버리지 | 65% | ~15개 컴포넌트 누락 |
| 요구사항 정합성 | 80% | FR-2 모순, metadata 구조 변경 미고려 |
| 리스크 식별 | 70% | WebSocket 리스크 미식별, 동적 텍스트 미흡 |
| 로드맵 실행성 | 85% | Phase 분할 합리적, 태스크 누락만 보완 필요 |
| **종합** | **72%** | Critical 1건 해결 필요 |
