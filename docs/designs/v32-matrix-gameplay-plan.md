# PLAN: v32 — Matrix 인게임 완성 (스킬 시스템 + HUD 리디자인)

## 1. 개요

v29 faithful port로 app_ingame의 게임 엔진(57개 스킬, 25개 무기, 콤보/브레이크타임/퀴즈 시스템)을
Matrix 모드로 이식 완료했으나, 두 가지 핵심 미완성 영역이 존재합니다:

1. **v3 시스템 시각 UI 미이식**: 브레이크타임/콤보/퀴즈의 **로직은 게임 루프에 연결됨** (`useV3Systems` → `v3.updateAll()` 매 프레임 호출), 그러나 **시각적 피드백 컴포넌트**(`BreakTimeOverlay`, `ComboCounter`, `QuizChallengeCard`)가 미이식. 또한 spawn/XP multiplier가 실제 적용되는지 검증 필요
2. **HUD가 Apex 디자인 시스템 미적용**: 모든 인게임 UI(5개 컴포넌트)가 `monospace` + `#00FF41` 사용, SK 토큰 import 0개, 하드코딩 ~90개 색상값

## 2. 이식 상태 검증 결과 (현재)

### 완전 이식 (18/22 항목 — MATCH)
| 영역 | 파일 | 상태 |
|------|------|------|
| 스킬 정의 | definitions.ts (55개 스킬) | MATCH |
| 카테고리 | categories.ts (6개 카테고리) | MATCH |
| 브랜치 | branches.ts (14개 분기 스킬) | MATCH |
| 시너지 | synergies.ts (28개 시너지) | MATCH |
| 프리셋 | presets.ts (12개 빌드) | MATCH |
| 프로그레시브 트리 | progressive-tree.config.ts | MATCH |
| 무기 데이터 | weapons.config.ts (25개 무기) | MATCH |
| 무기 시스템 | weapons.ts (1,463줄) | MATCH |
| 전투 시스템 | combat.ts (2,478줄) | MATCH |
| 스폰 컨트롤러 | spawn-controller.ts (579줄) | MATCH |
| 스킬 렌더링 | skills.ts (2,661줄) | MATCH |
| 근접 렌더링 | melee.ts (1,043줄) — 동일 | MATCH |
| 원거리 렌더링 | ranged.ts (981줄) — 동일 | MATCH |
| 마법 렌더링 | magic.ts (826줄) — 동일 | MATCH |
| 특수 렌더링 | special.ts (865줄) — 동일 | MATCH |
| 콤보 캔버스 | comboCanvas.ts (156줄) | MATCH |
| 스킬 빌드 훅 | useSkillBuild.ts (585줄) | MATCH |
| 메인 캔버스 | MatrixCanvas.tsx (5,202줄) | MATCH |

### 부분 이식 (5/22 — PARTIAL)
| 영역 | 원본 | 이식 | 차이 |
|------|------|------|------|
| 레벨업 모달 | LevelUpModal.tsx (502줄) | MatrixLevelUp.tsx (724줄) | 스킬 선택 로직 동일, UI 확장됨 |
| 아레나 HUD | ArenaHUD.tsx (189줄) | ArenaHUD.tsx (342줄) | 리더보드 확장됨 |
| **브레이크타임** | useBreakTime + BreakTimeOverlay | useBreakTime (로직 연결됨) | **시각 UI 미이식** — BreakTimeOverlay.tsx 없음. spawn/XP multiplier 실적용 미확인 |
| **콤보 카운터** | useCombo + ComboCounter.tsx | useCombo (로직 연결됨) | **시각 UI 미이식** — ComboCounter.tsx 없음 (comboCanvas.ts만 존재) |
| **퀴즈 미션** | useQuizChallenge + QuizChallengeCard.tsx | useQuizChallenge (로직 연결됨) | **시각 UI 미이식** — QuizChallengeCard.tsx 없음 |

### 의도적 생략 (1/22 — SKIPPED)
| 영역 | 상태 | 사유 |
|------|------|------|
| useSkillMap | 로비 전용 | AI World War에서 별도 시스템으로 처리 |

### 연결 체인 확인 (v3 시스템)
```
MatrixCanvas.tsx:474  → const v3 = useV3Systems()
MatrixCanvas.tsx:1846 → v3.updateAll(scaledDelta, gameTime, level)  ← 매 프레임 호출
MatrixCanvas.tsx:2939 → v3.onKill()  ← 적 처치 시 콤보/브레이크타임 게이지 증가

useV3Systems 내부:
  → useBreakTime() — Data Burst 60초 주기, Kernel Panic 게이지
  → useCombo() — 10티어 콤보 (Bronze~Transcendent)
  → useQuizChallenge() — 30-60초 주기 미션 도전
```

## 3. Critical Files

### 수정 대상
- `apps/web/components/game/matrix/MatrixCanvas.tsx` — spawn/XP multiplier 적용 검증
- `apps/web/components/game/matrix/MatrixApp.tsx` — v3 시각 UI 오버레이 렌더링 추가
- `apps/web/components/game/matrix/MatrixHUD.tsx` — Apex 디자인 리디자인 (~20 하드코딩 색상)
- `apps/web/components/game/matrix/ArenaHUD.tsx` — Apex 디자인 리디자인 (~18 하드코딩 색상)
- `apps/web/components/game/matrix/MatrixLevelUp.tsx` — Apex 디자인 리디자인 (~25 하드코딩 색상)
- `apps/web/components/game/matrix/MatrixResult.tsx` — Apex 디자인 리디자인 (~20 하드코딩 색상)
- `apps/web/components/game/matrix/MatrixPause.tsx` — Apex 디자인 리디자인 (~7 하드코딩 색상)

### 신규 생성
- `apps/web/components/game/matrix/BreakTimeOverlay.tsx` — Data Burst 경고 + 게이지 (Apex 스타일)
- `apps/web/components/game/matrix/ComboCounter.tsx` — 콤보 티어 + 멀티플라이어 (Apex 스타일)
- `apps/web/components/game/matrix/QuizChallengeCard.tsx` — 미션 카드 (Apex 스타일)

### 삭제 대상
- `apps/web/components/game/matrix/MatrixIntro.tsx` — 사용 중지됨 (로딩바로 대체)
- `apps/web/components/game/matrix/MatrixCanvas.v28.tsx.bak` — 백업 파일

### 참조 (디자인 토큰)
- `apps/web/lib/sketch-ui.ts` — SK 팔레트, headingFont, bodyFont, apexClip, SKFont
- `apps/web/lib/overlay-tokens.ts` — OVERLAY 토큰, overlayPanelStyle()
- `apps/web/components/lobby/GlobeLoadingScreen.tsx` — Apex 스타일 참조 구현

## 4. 기술 방향

### 4-1. v3 시스템 시각 UI 이식 + Multiplier 검증
**로직 연결은 완료됨** — `useV3Systems`가 `useBreakTime`/`useCombo`/`useQuizChallenge`를 내부 호출하며, `v3.updateAll()`이 매 프레임 실행됨. 남은 작업:

1. **Multiplier 실적용 검증/수정**:
   - `v3.getSpawnMultiplier()` → MatrixCanvas 스폰 로직에서 실제 곱해지는지 확인
   - `v3.getXpMultiplier()` → XP 계산에서 실제 곱해지는지 확인
   - 미적용 시 스폰/XP 계산 코드에 multiplier 적용 추가

2. **BreakTimeOverlay 이식** (원본 `app_ingame/components/game/BreakTimeOverlay.tsx` 참조):
   - Data Burst 경고 보더 (3초 카운트다운) → Apex 스타일
   - Burst 활성 중 게이지 바 (10초 타이머) → SK.accent 프로그레스
   - Kernel Panic 게이지 (0-100%) → SK.gold 프로그레스
   - 게이지 100% 시 자동 발동 → 9999 데미지 + 1.5초 슬로우 + 0.5초 무적 + 화면 플래시

3. **ComboCounter 이식** (원본 `app_ingame/components/game/ComboCounter.tsx` 참조):
   - 10단계 콤보 티어 (Bronze→Transcendent) 표시
   - 멀티플라이어 수치 (1.1x ~ 2.5x)
   - 마일스톤 스크린 셰이크 (1000단위=0.9, 100단위=0.5, 기타=0.25)

4. **QuizChallengeCard 이식** (원본 `app_ingame/components/game/QuizChallengeCard.tsx` 참조):
   - 미션 목표 카드 (Kill X, Survive X, Combo X 등)
   - 타이머 + 프로그레스 바
   - 성공 보상 / 실패 페널티 표시

### 4-2. HUD Apex 디자인 리디자인 원칙
**핵심**: `monospace` + `#00FF41` (Matrix green) → `headingFont/bodyFont` + `SK.*` 토큰

| 기존 | Apex 변환 |
|------|----------|
| `fontFamily: 'monospace'` | `fontFamily: bodyFont` (본문), `headingFont` (제목) |
| `#00FF41` (Matrix green) | `SK.accent` (#EF4444 red) 또는 `SK.green` (#10B981) |
| `border-radius: 8px` 등 | `borderRadius: 0` (전술적 샤프 엣지) |
| 둥근 pill 형태 | `clipPath: apexClip.sm/md` (대각선 컷) |
| 배경: `rgba(0,0,0,0.8)` | `SK.glassBg` + `backdrop-filter: blur()` |
| 보더: 수동 grey | `SK.border` 또는 `SK.accentBorder` |

## 5. HUD 리디자인 상세

### 5-1. MatrixHUD (메인 인게임 HUD)

**현재 문제**: Survivor.io 스타일 밝은 색감 (노란 레벨 배지, 흰 HP 바), monospace 폰트

**Apex 리디자인**:
```
┌─────────────── 상단 ────────────────┐
│ [XP BAR — SK.accent 그라데이션, apexClip.sm, 높이 4px]                  │
│ ┌─LV.15─┐  ═══HP BAR══  ⚡KILLS: 42  │
│ │Chakra │  (SK.red fill)  ⏱ 03:24    │
│ └───────┘  SK.glassBg                 │
│                                       │
│                                       │
│                                       │
│ ┌─WEAPON SLOTS─────────────────────┐ │
│ │ [🔪Lv3] [🪓Lv5] [⚡Lv2] [🛡Lv1] │ │
│ │ apexClip.sm, SK.cardBg, 쿨다운 빨간 오버레이  │ │
│ └──────────────────────────────────┘ │
│         [ESC — PAUSE]                │
└─────────────────────────────────────┘
```

- **XP 바**: `SK.accent` → `SK.accentDark` 그라데이션, `apexClip.sm` 클립, 4px 높이
- **레벨 배지**: `SK.accent` 배경, `headingFont`, 0 radius, apexClip.sm
- **HP 바**: `SK.red` fill + `SK.redDark` 트랙, 3px 높이, apexClip.sm
- **킬/타이머**: `bodyFont`, `SK.textSecondary`, 우측 정렬
- **무기 슬롯**: `SK.cardBg` 배경, `SK.border`, apexClip.sm, 쿨다운은 `SK.accent` 반투명 오버레이
- **전체**: `SK.glassBg` 패널, `backdrop-filter: blur(8px)`

### 5-2. ArenaHUD (아레나 전투 HUD)

**Apex 리디자인**:
```
┌──── 상단 중앙 ────┐
│  ⏱ 04:32          │
│  ALIVE: 12/50     │  ← SK.green (생존), SK.textMuted (사망)
│  PHASE: SAFE ZONE │  ← 상태별 색상 (SK.green/SK.orange/SK.red)
└───────────────────┘

┌── 좌상단 ──┐     ┌── 우상단 ──────────┐
│ ☠ 5 / 💀 0 │     │ LEADERBOARD        │
│ RANK #3    │     │ 1. 🟡 Player1  42  │
└────────────┘     │ 2. 🟢 Player2  38  │
                   │ 3. ★ YOU       35  │ ← SK.accent 하이라이트
                   └───────────────────┘

┌── 하단 (존 벗어남 시) ──┐
│ ⚠ OUTSIDE SAFE ZONE    │ ← SK.red bg + 빨간 보더
│ -15 HP/s               │
└─────────────────────────┘
```

- 모든 패널: `SK.glassBg`, `SK.border`, `borderRadius: 0`
- 타이머: `headingFont`, 24px, `SK.textPrimary` (정상), `SK.red` (잔여 60초 미만)
- 리더보드: `bodyFont`, `SK.textSecondary`, 본인은 `SK.accent` 하이라이트

### 5-3. MatrixLevelUp (레벨업 스킬 선택)

**Apex 리디자인**:
```
┌──────────── LEVEL UP ───────────────┐
│  Lv.16 — Choose Your Upgrade        │ ← headingFont, SK.accent
├──────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│ │ 🔪      │ │ ⚡       │ │ 🛡     │ │
│ │ knife   │ │ claude   │ │ debug  │ │  ← 4개 옵션 (스크롤 가능)
│ │ Lv.4→5  │ │ Lv.1 NEW│ │ Lv.3→4 │ │
│ │ +20%dmg │ │ chain   │ │ +area  │ │
│ │ apexClip│ │ SK.gold │ │        │ │
│ └─────────┘ └─────────┘ └────────┘ │
│                                      │
│ [AUTO SELECT — 5s]  [REROLL (2)]     │
│ ★ BRANCH CHOICE at Lv.11            │
└──────────────────────────────────────┘
```

- 배경 딤: `OVERLAY.bg` (rgba(9,9,11,0.90))
- 패널: `SK.bg`, `SK.border`, 전체 `backdrop-filter`
- 스킬 카드: `SK.cardBg` + `SK.border`, `apexClip.md`, hover 시 `SK.accentBorder`
- NEW 스킬: `SK.gold` 배지, 선택 시 `SK.accent` 보더 글로우
- 카테고리 컬러: 스킬 카테고리별 좌측 스트라이프 (CODE=#10B981, DATA=#06B6D4 등)
- 자동 선택 타이머: `SK.accent` 원형 프로그레스
- 리롤 버튼: `SK.textSecondary` outlined

### 5-4. MatrixResult (게임 오버)

**Apex 리디자인**:
```
┌──────────────────────────────────────┐
│           ☠ GAME OVER               │ ← headingFont, SK.red (사망) / SK.gold (생존)
│     CONNECTION TERMINATED            │ ← bodyFont, SK.textMuted
├──────────────────────────────────────┤
│  LV.18   KILLS: 42   TIME: 08:32   │ ← SK.textSecondary
│  SCORE: 12,450                      │ ← SK.gold, headingFont
├──────────────────────────────────────┤
│  WEAPONS ACQUIRED                   │
│  [knife Lv12] [wand Lv8] [garlic]  │ ← SK.cardBg 태그
├──────────────────────────────────────┤
│  REWARDS                            │
│  Base: 1,200  Kill: 840  Time: 500  │
│  ═══════════════════════════════════ │
│  TOTAL: 2,540 Credits               │ ← SK.gold
├──────────────────────────────────────┤
│  [EXIT TO LOBBY]    [RETRY]         │
│  SK.border outline  SK.accent solid │
└──────────────────────────────────────┘
```

### 5-5. MatrixPause (일시정지)

**Apex 리디자인**:
- 배경: `OVERLAY.bg` + blur
- 패널: `SK.bg`, `SK.border`, max-width 320px
- "PAUSED": `headingFont`, `SK.accent`, letter-spacing 0.15em
- RESUME: `SK.accent` bg, `SK.bg` text
- EXIT TO LOBBY: `SK.red` outlined
- "ESC to resume": `SK.textMuted`, bodyFont

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| spawn/XP multiplier 미적용 상태 | Data Burst가 시각적으로만 발동, 실제 3x/2x 효과 없음 | MatrixCanvas 스폰/XP 코드에서 v3.getSpawnMultiplier()/getXpMultiplier() 적용 확인 |
| v3 시각 UI 3개 신규 컴포넌트 | 성능 부하 (backdrop-filter, 애니메이션) | will-change 사용, 비활성 시 unmount, 렌더 최소화 |
| HUD 리디자인 시 게임 성능 저하 | FPS 드롭 | backdrop-filter 최소화, will-change 사용 |
| 레벨업 모달 스킬 카드 레이아웃 깨짐 | 모바일 터치 불가 | 스크롤 가능 그리드, 최소 터치 영역 48px |
| Apex 컬러가 게임 캔버스 위에서 가독성 부족 | UI 안 보임 | glassBg + blur로 배경 분리, 텍스트 그림자 강화 |

## 구현 로드맵

### Phase 1: v3 시스템 시각 UI 이식 + Multiplier 검증
| Task | 설명 |
|------|------|
| spawn/XP multiplier 적용 검증 | MatrixCanvas에서 `v3.getSpawnMultiplier()`와 `v3.getXpMultiplier()`가 실제 스폰율/XP 계산에 곱해지는지 확인. 미적용 시 코드 수정 |
| BreakTimeOverlay 이식 (Apex) | Data Burst 경고 보더(3초) + 활성 게이지(10초) + Kernel Panic 게이지(0-100%) — SK.accent/SK.gold 토큰 사용 |
| Kernel Panic 트리거 구현 | 게이지 100% 시 자동 발동 → `v3.triggerUltimate()` 호출 + 전체 화면 플래시 + 9999 데미지 이펙트 |
| ComboCounter 이식 (Apex) | 10단계 콤보 티어 표시 (Bronze~Transcendent) + 멀티플라이어 수치 — headingFont, SK.gold/SK.accent |
| QuizChallengeCard 이식 (Apex) | 미션 목표 카드 + 타이머 + 프로그레스 바 — SK.glassBg, apexClip.md |
| MatrixApp에 v3 오버레이 렌더링 | BreakTimeOverlay, ComboCounter, QuizChallengeCard를 MatrixApp에서 조건부 렌더링 |

- **design**: N (이 기획서의 4-1 섹션이 스펙, 신규 컴포넌트는 Apex 토큰으로 직접 구현)
- **verify**: Data Burst 시 스폰율 3배 확인 (multiplier 적용), 콤보 UI 표시, 퀴즈 카드 표시, Kernel Panic 게이지→울티메이트 발동. `next build` 성공.

### Phase 2: MatrixHUD Apex 리디자인
| Task | 설명 |
|------|------|
| XP 바 리디자인 | SK.accent 그라데이션, apexClip.sm, 4px 높이, 레벨 배지 연동 |
| HP 바 리디자인 | SK.red fill, SK.glassBg 트랙, apexClip.sm |
| 레벨/킬/타이머 UI | headingFont + bodyFont, SK 토큰, 우측 정렬 배치 |
| 무기 슬롯 리디자인 | SK.cardBg, apexClip.sm, 쿨다운 SK.accent 오버레이 |
| 오토헌트 버튼 | SK.green 활성, SK.border 비활성 |

- **design**: N (이 기획서의 5-1 섹션이 디자인 스펙)
- **verify**: 인게임 HUD 렌더링 확인 — XP바, HP바, 레벨, 킬, 타이머, 무기슬롯 모두 Apex 스타일. `next build` 성공.

### Phase 3: ArenaHUD + MatrixLevelUp Apex 리디자인
| Task | 설명 |
|------|------|
| ArenaHUD 리디자인 | 타이머/생존자/페이즈/리더보드/존경고 전체 Apex 스타일 |
| MatrixLevelUp 리디자인 | 스킬 카드 apexClip, 카테고리 컬러 스트라이프, 자동선택 타이머, 리롤 버튼 |
| 브랜치 선택 UI | Lv.11 브랜치 A/B 선택 모달 Apex 스타일 |
| 시너지 알림 UI | 시너지 활성화 시 화면 하단 알림 배너 |

- **design**: N (이 기획서의 5-2, 5-3 섹션이 디자인 스펙)
- **verify**: 아레나 HUD 정상 표시, 레벨업 시 스킬 선택 모달 정상, 브랜치/시너지 UI 동작. `next build` 성공.

### Phase 4: MatrixResult + MatrixPause Apex 리디자인
| Task | 설명 |
|------|------|
| MatrixResult 리디자인 | 게임 오버 화면 전체 Apex 스타일 (스탯, 무기, 보상, 버튼) |
| MatrixPause 리디자인 | 일시정지 화면 Apex 스타일 (RESUME, EXIT, ESC 안내) |
| 키보드 단축키 확인 | Enter=재시작, ESC=일시정지/해제 정상 동작 |

- **design**: N (이 기획서의 5-4, 5-5 섹션이 디자인 스펙)
- **verify**: 게임 오버 시 Result 화면 정상, ESC 일시정지 정상, Enter 재시작 정상. `next build` 성공.

### Phase 5: 통합 검증 및 정리
| Task | 설명 |
|------|------|
| 전체 게임 플로우 검증 | 국가 선택 → 로딩바 → 게임 시작 → 전투 → 레벨업 → 브레이크타임 → 게임 오버 → 로비 복귀 |
| 미사용 코드 정리 | MatrixIntro.tsx 삭제, MatrixCanvas.v28.tsx.bak 삭제, MATRIX_GREEN 상수 제거 (5개 파일), monospace 잔재 제거 |
| 모바일 반응형 검증 | 터치 조작, HUD 가독성, 레벨업 카드 터치 영역 |
| 빌드 최종 검증 | tsc 0 에러, next build 성공, 번들 크기 확인 |

- **design**: N
- **verify**: 전체 플로우 정상 동작, 미사용 import 0개, `next build` 성공, 모바일 HUD 가독성 확인.

## Verification
1. `next build` — 성공
2. 국가 선택 → 로딩바 → 게임 시작
3. 전투 시작 → HUD 정상 표시 (Apex 스타일: SK 토큰, headingFont/bodyFont, borderRadius:0)
4. 적 처치 → **콤보 카운터 UI 표시** (티어명 + 멀티플라이어 수치, Apex 스타일)
5. 콤보 1000+ → **스크린 셰이크** 발동 (강도 0.9)
6. 30-60초 경과 → **퀴즈 미션 카드** 표시 (목표 + 타이머 + 프로그레스, Apex 스타일)
7. 60초 경과 → **Data Burst 경고** (3초 카운트다운, BreakTimeOverlay)
8. Data Burst 활성 → **스폰율 실제 3배 증가** + **XP 실제 2배** (multiplier 적용 확인)
9. Data Burst 중 킬 → **Kernel Panic 게이지 증가** (UI 표시)
10. 게이지 100% → **Kernel Panic 울티메이트** 자동 발동 (9999 데미지 + 슬로우 + 플래시)
11. 레벨업 → **스킬 선택 모달** (4개 옵션, Apex 카드 스타일, apexClip.md)
12. Lv.11 → **브랜치 선택** 모달 표시
13. 시너지 조건 충족 → **시너지 알림** 배너
14. 아레나 시간 종료 → **게임 오버** (Apex 스타일 Result 화면)
15. ESC → **일시정지** (Apex 스타일 Pause 화면)
16. EXIT → 글로브 로비 복귀
17. 5개 HUD 컴포넌트에 `monospace` 0회, `#00FF41` 0회 (grep 검증)
18. 5개 HUD 컴포넌트에 `sketch-ui` import 존재 확인
