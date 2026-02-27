# In-Game HUD Design — Snake Arena

> **작성일**: 2026-02-27
> **상태**: Draft → Plan Approval Pending
> **디자인 시스템**: Headspace-Inspired (Inter font, warm palette)

---

## 1. 현황 분석

### 현재 구현
- `drawHUD`: Score/Length 텍스트 한 줄 (하단 좌측) + RTT/FPS 디버그 (상단 좌측)
- `drawLeaderboard`: Top 10 리스트 (우측 상단, 반투명 박스)
- `drawMinimap`: 원형 미니맵 (우측 하단, 150px)
- **Kill Feed, Boost Gauge, 순위 표시, 킬 수, 성장 피드백 — 모두 미구현**

### 문제점
1. 정보 밀도 부족 — 플레이어가 현재 상태를 직관적으로 파악하기 어려움
2. 시각적 피드백 부재 — 성장, 킬, 부스트 상태에 대한 반응 없음
3. 디자인 일관성 부재 — Headspace 디자인 시스템 미적용 (sans-serif 기본 폰트)
4. 모바일 고려 없음 — 고정 px 사이즈, 작은 화면 대응 불가

---

## 2. HUD 레이아웃 설계

### 2.1 화면 영역 배치도

```
┌─────────────────────────────────────────────────────┐
│ [A] 상단 좌측          [B] 상단 중앙   [C] 상단 우측│
│  · RTT/FPS (디버그)     · Kill Feed     · Leaderboard│
│  · 내 순위 (#3/25)      · (위→아래 페이드)           │
│                                                      │
│                                                      │
│                    [GAME AREA]                        │
│                                                      │
│                                                      │
│ [D] 하단 좌측                          [E] 하단 우측│
│  · Score bar                            · Minimap    │
│  · Boost gauge                                       │
│  · Length / Kill count                               │
└─────────────────────────────────────────────────────┘
```

### 2.2 영역별 상세

#### [A] 상단 좌측 — 플레이어 상태
```yaml
Contents:
  - 내 순위: "#3 / 25" (순위/총인원)
  - 네트워크: "32ms" (RTT, 디버그 모드에서만 FPS 추가)
Position: top: 16px, left: 16px
Style:
  - font: Inter 13px, color: UI_TEXT_SECONDARY
  - 순위 숫자: Inter Bold 16px, color: LEADERBOARD_SELF (#FFCE00)
  - opacity: 0.7 (게임 방해 최소화)
```

#### [B] 상단 중앙 — Kill Feed
```yaml
Contents:
  - 최근 킬/사망 이벤트 3개
  - "Viper ate Noodle" / "You ate Spark!"
  - 5초 후 페이드아웃
Position: top: 16px, centerX
Style:
  - font: Inter 12px
  - 내가 관련된 이벤트: color: LEADERBOARD_SELF (#FFCE00)
  - 타인 이벤트: color: UI_TEXT_SECONDARY (#C6C1B9)
  - 배경: none (텍스트만, 그림자로 가독성)
  - text-shadow: 0 1px 3px rgba(0,0,0,0.8)
Animation:
  - 새 이벤트: 위에서 슬라이드인 (200ms ease-out)
  - 만료: 아래로 페이드아웃 (alpha 0, 300ms)
  - 최대 3개, FIFO
```

#### [C] 상단 우측 — Leaderboard (개선)
```yaml
Contents:
  - "Leaderboard" 타이틀
  - Top 5 (축소: 기존 10 → 5, 공간 절약)
  - 각 항목: "1. Slinky  ···  1,234"
  - 내 이름: 하이라이트 (#FFCE00)
Position: top: 16px, right: 16px
Style:
  - 배경: rgba(20, 19, 19, 0.7) + border-radius: 12px
  - 패딩: 12px 16px
  - 폰트: Inter 12px, 탭스톱 정렬
  - 타이틀: Inter Bold 13px, UI_TEXT
  - 줄간격: 22px
Size: 190px × auto
```

#### [D] 하단 좌측 — Score Panel + Boost Gauge
```yaml
Contents:
  Score_Bar:
    - 점수 숫자: "1,234" (대형, Inter Bold 28px)
    - 레이블: "SCORE" (Inter 10px, UI_TEXT_SECONDARY)
    - 길이: "Length: 47" (Inter 12px)
    - 킬 수: "Kills: 3" (Inter 12px)

  Boost_Gauge:
    - 수평 바 (width: 160px, height: 6px)
    - 채움: mass 비율 (현재 mass / peak mass 또는 고정 스케일)
    - 부스트 가능: bar color = Headspace blue (#0061EF)
    - 부스트 불가 (mass < minBoostMass): bar color = dim gray
    - 부스트 중: 바 감소 애니메이션 + 펄스 글로우
    - 레이블: "BOOST" (Inter 10px, 좌측)

Position: bottom: 16px, left: 16px
Style:
  - 배경: rgba(20, 19, 19, 0.7) + border-radius: 12px
  - 패딩: 12px 16px
  - 전체 너비: 200px
Layout:
  ┌─────────────────────────┐
  │  1,234          Kills: 3│
  │  SCORE       Length: 47 │
  │                         │
  │  ████████░░░░░  BOOST   │
  └─────────────────────────┘
```

#### [E] 하단 우측 — Minimap (개선)
```yaml
기존 유지 + 개선:
  - 크기: 130px (모바일: 100px)
  - 배경: rgba(20, 19, 19, 0.7)
  - 테두리: rgba(226, 222, 217, 0.3)
  - 내 위치: Headspace blue dot (#0061EF) + 방향 화살표
  - 타인: 크기 비례 dot (mass 반영)
  - 경계: 원형 테두리 (기존 유지)
```

---

## 3. 킬 피드 시스템 (신규)

### 3.1 이벤트 타입

| 이벤트 | 표시 형식 | 색상 |
|---|---|---|
| 내가 킬 | "You ate **Noodle**!" | #FFCE00 (yellow) |
| 내가 사망 | "**Viper** ate you!" | #F47D31 (orange) |
| 타인 킬 | "**Dash** ate Spark" | #C6C1B9 (gray) |

### 3.2 데이터 소스
- 서버에서 `kill` 이벤트 수신 → `killFeed` 배열에 push
- 현재 `useSocket.ts`에서 `killFeed`를 ref로 관리 중 (최대 5개)
- **문제**: 킬 피드가 현재 렌더러에 전달되지 않음 → RenderState에 추가 필요

---

## 4. 부스트 게이지 (신규)

### 4.1 동작 로직
```yaml
Gauge_Value:
  - 표시값 = 현재 mass
  - 최대값 = max(100, peak_mass_this_life)
  - 비율 = mass / maxValue → 바 채움
  - minBoostMass(15) 미만: 게이지 dim + "LOW" 표시

Visual_States:
  idle: 정적 바, Headspace blue
  boosting: 바 감소 + 펄스 글로우 (rgba(0,97,239,0.5))
  low: 바 dim gray + 경고
  growing: 먹이 먹을 때 바 증가 flash (white → blue, 200ms)
```

---

## 5. 성장 피드백 (신규)

### 5.1 점수 팝업
```yaml
Trigger: 먹이 먹을 때 (mass 변화 감지)
Effect:
  - "+1" ~ "+5" 텍스트가 머리 위에 떠오름
  - 위로 20px 이동 + fade out (600ms)
  - 색상: 작은 orb = UI_TEXT_SECONDARY, 큰 orb/death orb = LEADERBOARD_SELF
  - font: Inter Bold 14px
```

### 5.2 킬 스코어 팝업
```yaml
Trigger: kill 이벤트 수신
Effect:
  - "KILL!" 대형 텍스트 (머리 위)
  - scale: 1.0 → 1.3 → 1.0 (bounce, 400ms)
  - color: #FFCE00
  - font: Inter Black 24px
```

---

## 6. 반응형 & 모바일 대응

### 6.1 브레이크포인트
```yaml
Desktop (w > 768px):
  - 전체 HUD 표시
  - Leaderboard: Top 5
  - Minimap: 130px
  - Score panel: 200px

Mobile (w <= 768px):
  - Leaderboard: 숨김 (탭으로 토글)
  - Minimap: 90px
  - Score panel: 축소 (160px)
  - Kill Feed: 2개만
  - 폰트 사이즈: 80%
  - 부스트 게이지: 하단 중앙으로 이동
```

### 6.2 DPI 대응
- Canvas DPI 스케일링은 이미 구현 (GameCanvas.tsx)
- HUD 좌표/사이즈를 CSS 픽셀 기준으로 유지 (DPR 자동 적용)

---

## 7. 구현 계획

### 7.1 수정 대상 파일

| 파일 | 변경 사항 |
|---|---|
| `packages/shared/src/constants/colors.ts` | HUD 관련 색상 추가 (BOOST_BAR, KILL_POPUP 등) |
| `apps/web/lib/renderer/types.ts` | RenderState에 killFeed, peakMass 추가 |
| `apps/web/lib/renderer/ui.ts` | drawHUD 전면 재작성, drawKillFeed/drawBoostGauge/drawScorePopup 추가 |
| `apps/web/lib/renderer/index.ts` | render()에 새 draw 함수 호출 추가 |
| `apps/web/components/game/GameCanvas.tsx` | RenderState에 killFeed, peakMass 전달 |
| `apps/web/hooks/useSocket.ts` | killFeed에 타임스탬프 추가 (페이드아웃용) |

### 7.2 우선순위

| 순서 | 기능 | 난이도 | 영향도 |
|---|---|---|---|
| 1 | Score Panel 리디자인 (점수/길이/킬) | Low | High |
| 2 | Boost Gauge | Medium | High |
| 3 | Kill Feed | Medium | High |
| 4 | Leaderboard 개선 | Low | Medium |
| 5 | 순위 표시 (#N / Total) | Low | Medium |
| 6 | 성장/킬 팝업 | Medium | Medium |
| 7 | 모바일 반응형 | Medium | Medium |

---

## 8. Headspace 디자인 규칙 적용

```yaml
Typography:
  - 모든 HUD 텍스트: Inter (Google Fonts) — 이미 로드됨
  - 숫자: Inter Bold/Black (모노스페이스 느낌)
  - 레이블: Inter Regular, 대문자, letter-spacing: 1px

Colors:
  - 주요 수치: #F9F4F2 (cream)
  - 강조/내 순위: #FFCE00 (yellow)
  - 보조 텍스트: #C6C1B9 (warm gray)
  - 위험/사망: #F47D31 (orange)
  - 부스트 바: #0061EF (blue)
  - 패널 배경: rgba(20, 19, 19, 0.7)
  - 패널 라운딩: 12px

Principles:
  - 비침투적: 게임 영역을 최대한 가리지 않음
  - 정보 계층: 점수 > 순위 > 킬피드 > 네트워크
  - 반투명 패널: 배경이 비침 → 게임 몰입감 유지
  - 애니메이션: 부드럽고 미묘 (200-400ms ease)
```

---

*Generated by DAVINCI /da:plan*
*Snake Arena In-Game HUD Design v1.0*
