# Agent Survivor v10 — UI/UX 상세 기획서

> **메인 기획서**: [v10-survival-roguelike-plan.md](./v10-survival-roguelike-plan.md)
> **3D Graphics**: [v10-3d-graphics-plan.md](./v10-3d-graphics-plan.md)
> **Development Roadmap**: [v10-development-roadmap.md](./v10-development-roadmap.md)
> **Go Server**: [v10-go-server-plan.md](./v10-go-server-plan.md)

---

## 목차

1. [Design Philosophy](#1-design-philosophy)
2. [Design System](#2-design-system)
3. [Screen Flow](#3-screen-flow)
4. [Lobby Screens](#4-lobby-screens)
5. [Game HUD](#5-game-hud)
6. [Game Overlays](#6-game-overlays)
7. [End-Game Screens](#7-end-game-screens)
8. [Agent Training Screens](#8-agent-training-screens)
9. [Visual Feedback System](#9-visual-feedback-system)
10. [Atmosphere & Mood](#10-atmosphere--mood)
11. [Mobile Responsive](#11-mobile-responsive)
12. [Accessibility](#12-accessibility)
13. [Component Implementation Map](#13-component-implementation-map)

---

## 1. Design Philosophy

### 1.1 Core Principles

| Principle | 설명 | 적용 |
|-----------|------|------|
| **MC-First** | 모든 UI가 Minecraft 인벤토리/메뉴 스타일 | 다크 패널, 엠보스 보더, 픽셀 폰트 |
| **Information Density** | .io 게임 특성상 화면 점유 최소화 | HUD 요소 화면 5% 이하 점유 |
| **Zero-Click Play** | 첫 방문자 3초 내 게임 시작 가능 | Quick Join 버튼 최상단, 로비 기본 노출 |
| **Progressive Disclosure** | 복잡한 기능은 단계적 노출 | 트레이닝 콘솔 = 접이식, 캐릭터 커스텀 = 탭 |
| **Feedback-Rich** | 모든 상호작용에 시각 피드백 | 파티클, 텍스트 팝업, 바 애니메이션 |

### 1.2 Target User Persona

| Persona | 행동 패턴 | UI 최적화 |
|---------|----------|----------|
| **캐주얼 플레이어** | Quick Join → 즉시 플레이 | 로비 최소 UI, 원클릭 참여 |
| **빌드 연구자** | 캐릭터 커스텀 + 빌드 실험 | Character Creator + Build Stats 상세 |
| **AI 트레이너** | Agent 규칙 편집 + 관전 | Training Console + Watch Live |
| **경쟁 플레이어** | 리더보드 + 랭킹 | Round Result + Synergy 분석 |

### 1.3 Design Token Summary

```
Font Primary:    "Press Start 2P"  — 제목, 버튼, 라벨
Font Body:       "Inter"           — 수치, 본문, 입력
Border Radius:   0px               — MC 스타일 직각
Spacing Unit:    4px               — 4px 그리드 시스템
Animation Base:  150ms ease-out    — UI 전환 기본
Panel Opacity:   0.75-0.85         — 반투명 다크 패널
Pixel Scale:     2x-4x             — 16px 텍스처 → 32-64px 렌더
```

---

## 2. Design System

### 2.1 Color Palette

#### UI Colors (`lib/minecraft-ui.ts` 확장)

| Token | Hex | 용도 |
|-------|-----|------|
| `panelBg` | `rgba(0,0,0,0.75)` | 모든 패널 배경 |
| `panelBgSolid` | `#1A1A1A` | 불투명 필요 시 |
| `panelBorder` | `#3F3F3F` | 패널 보더 (엠보스 하단/우측) |
| `panelBorderLight` | `#5A5A5A` | 패널 보더 (엠보스 상단/좌측) |
| `btnStone` | `#7F7F7F` | 기본 버튼 배경 |
| `btnGreen` | `#5DAA34` | 확인/시작 버튼 |
| `btnRed` | `#AA3434` | 취소/위험 버튼 |
| `btnHover` | `+10% brightness` | 호버 상태 |
| `btnActive` | `-5% brightness` | 클릭 상태 |
| `textWhite` | `#FFFFFF` | 기본 텍스트 |
| `textGray` | `#AAAAAA` | 비활성 텍스트 |
| `textGold` | `#FFD700` | 강조/골드 텍스트 |
| `textRed` | `#FF3333` | 경고/위험 텍스트 |
| `textGreen` | `#55FF55` | 성공/회복 텍스트 |

#### Game Bar Colors

| Token | Hex | 용도 |
|-------|-----|------|
| `barHP` | `#FF3333` | HP 바 (MC 하트 빨강) |
| `barHPBg` | `#550000` | HP 바 배경 |
| `barXP` | `#7FFF00` | XP 바 (MC 경험치 녹색) |
| `barXPBg` | `#003300` | XP 바 배경 |
| `barCooldown` | `#AAAAAA` | 쿨다운 오버레이 |
| `barSynergy` | `#FFD700` | 시너지 골드 |

#### Zone Terrain Colors

| Zone | Primary | Secondary | 분위기 |
|------|---------|-----------|--------|
| Edge | `#5D9B47` 잔디 | `#8B6A3E` 흙 | 안전한 평원 |
| Mid | `#7F7F7F` 돌 | `#5F5F5F` 조약돌 | 전투 지대 |
| Core | `#6B3030` 네더랙 | `#CF4E0A` 용암 | 고위험 |

#### Rarity Colors

| Rarity | Color | Hex |
|--------|-------|-----|
| Common | White | `#FFFFFF` |
| Uncommon | Green | `#55FF55` |
| Rare | Blue | `#5555FF` |
| Epic | Purple | `#AA00FF` |
| Legendary | Gold | `#FFD700` |
| Mythic | Red | `#FF5555` |

### 2.2 Typography

```
Title (H1):     "Press Start 2P", 24px, #FFFFFF, letter-spacing: 2px
Subtitle (H2):  "Press Start 2P", 16px, #FFFFFF
Label:           "Press Start 2P", 10px, #AAAAAA, text-transform: uppercase
Body:            "Inter", 14px, #FFFFFF, line-height: 1.5
Numeric:         "Inter", 16px, #FFFFFF, font-variant-numeric: tabular-nums
Small:           "Inter", 12px, #AAAAAA
Toast:           "Press Start 2P", 12px, #FFD700, text-shadow: 2px 2px #000
```

### 2.3 Core Components

#### McPanel (기존 유지)
```
Background:     rgba(0,0,0,0.75)
Border:         3px solid
  Top/Left:     #5A5A5A (하이라이트)
  Bottom/Right: #3F3F3F (그림자)
Effect:         MC 인벤토리 3D 엠보스
Padding:        16px (desktop) / 12px (mobile)
```

#### McButton (기존 유지, 3변형)
```
Stone:   bg #7F7F7F, hover #8F8F8F, active #6F6F6F
Green:   bg #5DAA34, hover #6DBA44, active #4D9A24
Red:     bg #AA3434, hover #BA4444, active #9A2424
Border:  2px 3D emboss (lighter top-left, darker bottom-right)
Font:    "Press Start 2P", 12px
Height:  40px (desktop) / 36px (mobile)
```

#### McInput (기존 유지)
```
Background:     #1A1A1A
Border:         2px solid #3F3F3F
Focus Border:   #5A5A5A
Font:           "Inter", 14px
Placeholder:    #555555
Height:         40px
```

#### McTab (신규)
```
Inactive:       bg transparent, text #AAAAAA, border-bottom 2px #3F3F3F
Active:         bg rgba(255,255,255,0.05), text #FFFFFF, border-bottom 2px #FFD700
Hover:          text #FFFFFF
Font:           "Press Start 2P", 10px
Height:         36px
```

#### McTooltip (신규)
```
Background:     #1A0A2E (MC 보라 다크)
Border:         2px solid #5A2D82
Font:           "Inter", 12px
Max-width:      200px
Arrow:          4px CSS triangle
Delay:          300ms show, 0ms hide
```

#### McBadge (신규)
```
[Rarity Color] 배경 pill 형태
Font:           "Press Start 2P", 8px
Padding:        2px 6px
Border-radius:  0px (MC 직각)
```

#### McProgressBar (신규)
```
Track:          [barBg color], height 12px
Fill:           [bar color], transition width 200ms
Label:          "Inter" 10px, 바 내부 중앙 정렬
Notch:          2px 간격으로 MC 스타일 세그먼트 표시 (선택)
```

### 2.4 Icon System

```
Size:           16x16 px (base) → 32x32 px (display, 2x scale)
Style:          MC 아이템 스프라이트 (Canvas 2D procedural 생성)
Filter:         image-rendering: pixelated (NearestFilter)
Categories:
  Tome Icons:   Sword(공격), Shield(방어), Boot(속도), Book(XP), Clover(행운), Skull(저주)
  Ability Icons: Lightning, Venom(독병), Dash(화살), Regen(하트), Shield(방패)
  Build Icons:   Sword(데미지빌드), Shield(탱크빌드), Boot(스피드빌드), Crystal(매직빌드)
  Status Icons:  Heart(HP), Star(XP), Clock(타이머), Trophy(랭킹)
```

---

## 3. Screen Flow

### 3.1 State Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION                              │
│                                                                 │
│  ┌──────────┐   joinRoom    ┌──────────┐                       │
│  │  LOBBY   │──────────────▶│  GAME    │                       │
│  │          │◀──────────────│          │                        │
│  │ • Rooms  │   leaveRoom   │ • HUD    │                       │
│  │ • Create │               │ • 3D     │                       │
│  │ • Train  │               │ • Overlay│                       │
│  └──────────┘               └────┬─────┘                       │
│       │                          │                              │
│       │                     death event                         │
│       │                          ▼                              │
│       │                    ┌──────────┐                         │
│       │                    │  DEATH   │                         │
│       │                    │ Overlay  │──── respawn ───┐        │
│       │                    └────┬─────┘                │        │
│       │                         │                      ▼        │
│       │                    round_end            ┌──────────┐   │
│       │                         ▼               │  GAME    │   │
│       │                    ┌──────────┐         │ (respawn)│   │
│       │◀── Back to Lobby ──│  RESULT  │         └──────────┘   │
│       │                    │ • Stats  │                         │
│       │                    │ • AI     │── Play Again ──▶ GAME  │
│       │                    └──────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Screen Transition Specs

| From | To | Trigger | Animation | Duration |
|------|----|---------|-----------|----------|
| Lobby | Game | `joinRoom` → `joined` | Opacity fade 1→0→1 | 300ms |
| Game | Death | `death` event | Screen grayscale + Agent death anim | 800ms |
| Death | Game | Respawn click | Pop-in scale 0→1 | 300ms |
| Game | Result | `round_end` event | Slide-up overlay | 400ms |
| Result | Game | "Play Again" click | Overlay slide-down + new round | 400ms |
| Result | Lobby | "Back to Lobby" click | Opacity fade | 300ms |
| Any | LevelUp | `level_up` event | Cards fly-in from bottom | 250ms |
| LevelUp | Game | Card select / timeout | Cards fly-out | 200ms |
| Any | Synergy | Synergy activated | Gold text float-up | 1500ms auto |
| Any | Shrink | 10s before shrink | Red vignette fade-in | 500ms |

### 3.3 URL Routes

```
/                — Lobby (default)
/test-3d         — 3D 테스트 (개발용, Phase 1 이후 제거)
```

모든 게임 화면은 SPA 내 state 전환 (URL 변경 없음). `page.tsx`의 `mode: 'lobby' | 'playing'` 상태로 관리.

### 3.4 Sub-Screen 계층

```
LOBBY
├── RoomList              — 항상 표시
├── CharacterCreator      — 탭 전환 또는 모달
├── RecentWinnersPanel    — 항상 표시 (우측)
├── TrainingConsole       — 접이식 패널 (RoomList 하단)
└── WelcomeTutorial       — 첫 방문 시 모달 (1회)

GAME
├── GameCanvas3D          — 전체 화면 3D
├── HUD Layer (HTML)      — position: absolute overlay
│   ├── TopBar            — HP + XP + Level
│   ├── BuildHUD          — 좌하단 Tome + Ability
│   ├── TimerHUD          — 상단 중앙 타이머
│   ├── Minimap           — 우하단 미니맵
│   └── Killfeed          — 우상단 킬피드
├── LevelUpOverlay        — 레벨업 시 3장 카드
├── SynergyPopup          — 시너지 활성 시 골드 텍스트
├── ShrinkWarning         — 축소 10초 전 경고
├── CoachBubble           — AI 코치 말풍선
├── DeathOverlay          — 사망 시 오버레이
└── RoundResultOverlay    — 라운드 종료 시 결과
```

---

## 4. Lobby Screens

### 4.1 Lobby 전체 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  [3D Background: LobbyScene3D — R3F Canvas, z-index:0]  │
│                                                          │
│  ┌─── Left Column (60%) ──┐  ┌─── Right Column (40%) ──┐│
│  │                        │  │                          ││
│  │  ┌──────────────────┐  │  │  ┌────────────────────┐  ││
│  │  │  AGENT SURVIVOR  │  │  │  │ Character Creator  │  ││
│  │  │  (Logo + Title)  │  │  │  │  ┌─────┐ [Body]    │  ││
│  │  └──────────────────┘  │  │  │  │Agent│ [Color]   │  ││
│  │                        │  │  │  │ 3D  │ [Face]    │  ││
│  │  ┌──────────────────┐  │  │  │  │Prev │ [Equip]   │  ││
│  │  │  Name Input      │  │  │  │  └─────┘           │  ││
│  │  │  [Quick Join]    │  │  │  │  (option grids)    │  ││
│  │  └──────────────────┘  │  │  │  [Save]            │  ││
│  │                        │  │  │  ────────────────   │  ││
│  │  ┌──────────────────┐  │  │  │  Recent Winners    │  ││
│  │  │  Room List       │  │  │  │  #1 PlayerA 🏆     │  ││
│  │  │  Arena #1 12/18  │  │  │  │  #2 PlayerB        │  ││
│  │  │  Arena #2  8/18  │  │  │  │  #3 BotAlpha       │  ││
│  │  │  Arena #3  3/18  │  │  │  └────────────────────┘  ││
│  │  └──────────────────┘  │  │                          ││
│  │                        │  │                          ││
│  │  ┌──────────────────┐  │  │                          ││
│  │  │ Training Console │  │  │                          ││
│  │  │ (접이식 ▼)       │  │  │                          ││
│  │  └──────────────────┘  │  │                          ││
│  └────────────────────────┘  └──────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Layout Specs**:
- 전체: `max-width: 1200px`, `margin: auto`, `padding: 24px`
- Left/Right: CSS Grid `grid-template-columns: 1.5fr 1fr`, `gap: 24px`
- 3D 배경: `position: fixed`, `inset: 0`, `z-index: 0`
- UI 패널: `position: relative`, `z-index: 10`
- 모바일 (< 768px): 단일 컬럼, Right Column이 Left 위로 이동

### 4.2 Character Creator

#### 4.2.1 전체 구조

```
┌─── CharacterCreator.tsx (McPanel) ──────────────────────┐
│  "Character Customization"              [Preset ▼]       │
├─────────────┬───────────────────────────────────────────┤
│             │  [Body] [Color] [Face] [Equip]             │
│  ┌───────┐  │  ─────────────────────────────────         │
│  │ Agent │  │                                            │
│  │  3D   │  │  (Tab Content Area)                        │
│  │Preview│  │                                            │
│  │130x130│  │  예: Body Tab                              │
│  └───────┘  │  Type: [Default] [Slim]                    │
│  [◀ 회전 ▶] │  Skin Tone:                                │
│             │  [■][■][■][■][■]                            │
│             │  [■][■][■][■][■]                            │
│             │  [■][■][■][■][■]                            │
├─────────────┴───────────────────────────────────────────┤
│  12/30 unlocked ████████░░░░                    [Save]   │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.2 Tab 별 상세

**Tab 1: Body**
| 항목 | UI 형태 | 옵션 수 | 배치 |
|------|--------|--------|------|
| bodyType | 2개 큰 토글 버튼 | 2 (Default, Slim) | 가로 2열 |
| bodySize | 3개 토글 버튼 | 3 (S, M, L) | 가로 3열 |
| skinTone | 색상 팔레트 그리드 | 15 | 5×3 그리드 |

**Tab 2: Color**
| 항목 | UI 형태 | 옵션 수 | 배치 |
|------|--------|--------|------|
| bodyColor | MC 양모 색상 팔레트 | 12 | 4×3 그리드 |
| legColor | MC 양모 색상 팔레트 | 12 | 4×3 그리드 |
| pattern | 토글 버튼 + 미니 미리보기 | 4 (Solid/Stripe/Check/Dot) | 가로 4열 |
| patternColor | 조건부 팔레트 (pattern≠solid) | 12 | 4×3 그리드 |

**Tab 3: Face**
| 항목 | UI 형태 | 옵션 수 | 배치 |
|------|--------|--------|------|
| eyeStyle | 16x16 미니 프리뷰 그리드 | 8 | 4×2 그리드 |
| eyeColor | 색상 원 | 8 | 가로 8열 |
| mouthStyle | 16x16 미니 프리뷰 그리드 | 6 | 3×2 그리드 |
| markings | 16x16 미니 프리뷰 그리드 | 8 | 4×2 그리드 |

**Tab 4: Equipment** (Phase 1 — 잠금 해제된 것만 표시)
| 항목 | UI 형태 | 옵션 수 | 배치 |
|------|--------|--------|------|
| headwear | 32x32 썸네일 + 이름 | 6 (none+5) | 3×2 그리드 |
| accessory | 32x32 썸네일 + 이름 | 4 (none+3) | 2×2 그리드 |
| handItem | 32x32 썸네일 + 이름 | 4 (none+3) | 2×2 그리드 |

**잠금 아이템 표시**: 어둡게 + 자물쇠 아이콘 + 호버 시 McTooltip (해제 조건)

#### 4.2.3 Preset Dropdown

34종 프리셋 캐릭터 (§5B.4 참조):
- 드롭다운 메뉴, Rarity 색상 태그 포함
- 선택 시 모든 탭 옵션 자동 채움
- 커스텀 수정 가능 (프리셋 위에 덮어쓰기)

#### 4.2.4 3D Preview (LobbyAgentPreview)

- R3F Canvas `130×130px`, 독립 씬
- MC Agent 모델 (§A1 6-part), 선택한 장비 착용 상태
- Y축 자동 회전: `0.5 rad/s`
- [◀] [▶] 버튼: ±45° 스냅 회전
- 조명: AmbientLight(0.6) + DirectionalLight(0.8, 위 45°)
- 배경: `#2A2A2A` 솔리드 (투명 X, 미니 씬에서 불필요)

#### 4.2.5 저장 로직

- `localStorage` key: `agent-character-config`
- JSON: `{ bodyType, skinTone, bodyColor, ..., preset?: string }`
- [Save] 클릭 → localStorage 저장 + 3D Preview 업데이트 + 서버 전송 (join 시 포함)
- 변경 감지: 저장 전까지 preview만 실시간 반영, 서버 미전송

### 4.3 Room List

#### 4.3.1 레이아웃

```
┌─── RoomList.tsx (McPanel) ──────────────────────────────┐
│  "Rooms"                                                 │
├──────────────────────────────────────────────────────────┤
│  ┌───┬──────────┬────────┬─────────┬──────────┬──────┐  │
│  │ ● │ Arena #1 │ 12/18  │ Playing │ ⚔️🛡️⚡  │ [→]  │  │
│  │   │          │        │  3:24   │          │      │  │
│  ├───┼──────────┼────────┼─────────┼──────────┼──────┤  │
│  │ ● │ Arena #2 │  8/18  │ Waiting │          │ [→]  │  │
│  ├───┼──────────┼────────┼─────────┼──────────┼──────┤  │
│  │ ○ │ Arena #3 │  3/18  │ Playing │ ⚔️      │ [→]  │  │
│  ├───┼──────────┼────────┼─────────┼──────────┼──────┤  │
│  │ ○ │ Arena #4 │  0/18  │ Waiting │          │ [→]  │  │
│  ├───┼──────────┼────────┼─────────┼──────────┼──────┤  │
│  │ ○ │ Arena #5 │  1/18  │Countdown│          │ [→]  │  │
│  │   │          │        │   7s    │          │      │  │
│  └───┴──────────┴────────┴─────────┴──────────┴──────┘  │
└──────────────────────────────────────────────────────────┘
```

#### 4.3.2 Row 상세

| Column | Width | 내용 |
|--------|-------|------|
| Status Dot | 16px | ● Green(6+명) / ● Yellow(1-5명) / ○ Gray(0명) |
| Room Name | flex | "Arena #N" |
| Players | 60px | `{current}/{max}` |
| State | 80px | waiting/countdown(Ns)/playing(M:SS)/ending/cooldown |
| Build Icons | 60px | Top 3 인기 빌드 아이콘 (16×16, 데미지/탱크/스피드/매직) |
| Join Button | 40px | McButton(green) [→] 화살표 |

**State 색상**: waiting=#AAAAAA, countdown=#FFD700, playing=#55FF55, ending=#FF3333, cooldown=#AAAAAA

**Build Icons** (rooms_update 1Hz 데이터):
- ⚔️ = Damage 빌드 (Damage x3+ 에이전트 수)
- 🛡️ = Tank 빌드 (Armor x3+)
- ⚡ = Speed 빌드 (Speed x3+)
- 💎 = Magic 빌드 (Synergy 1+ active)
- 인기 순 Top 3만 표시

### 4.4 Recent Winners Panel

```
┌─── RecentWinnersPanel.tsx (McPanel) ────────────────────┐
│  "Recent Winners"                                        │
├──────────────────────────────────────────────────────────┤
│  🏆 #1  PlayerAlpha        Lv12  8kills                  │
│         Build: ⚔️x5 + Venom Lv3   Synergy: Glass Cannon │
│  ────────────────────────────────────────                │
│  🥈 #2  claude-agent       Lv11  6kills                  │
│         Build: 📖x3 + 🍀x2        Synergy: Holy Trinity │
│  ────────────────────────────────────────                │
│  🥉 #3  PlayerBeta         Lv10  5kills                  │
│         Build: 🛡️x4 + ❤️x3        Synergy: Iron Fortress│
└──────────────────────────────────────────────────────────┘
```

**v10 추가 정보**: 빌드 아이콘 + 시너지 배지 (기존 이름+점수만 표시에서 확장)

### 4.5 Welcome Tutorial Modal

**트리거**: 첫 방문 시 1회 (localStorage `tutorial-seen` 체크)

```
┌─── WelcomeTutorial.tsx (McPanel, 모달) ─────────────────┐
│                                                          │
│  "Welcome to Agent Survivor!"                            │
│                                                          │
│  Step 1/3:  ● ○ ○                                        │
│  ┌────────────────────────────────────────┐               │
│  │  (일러스트: MC Agent + Tome 아이콘)    │               │
│  │                                        │               │
│  │  "Survive 5 minutes by collecting      │               │
│  │   XP orbs and choosing upgrades!"      │               │
│  └────────────────────────────────────────┘               │
│                                                          │
│  [Skip]                              [Next →]            │
└──────────────────────────────────────────────────────────┘
```

**3 Steps**:
1. "수집 & 성장" — XP 오브 수집 → 레벨업 → 업그레이드 선택
2. "빌드 & 시너지" — Tome 스택 + 시너지 조합
3. "전투 & 생존" — 오라 전투 + 축소 맵 생존

각 스텝: 간단 일러스트(MC 스타일 도트) + 1-2문장 설명
- [Skip]: 즉시 닫기, [Next]: 다음 스텝, 마지막 스텝에서 [Play!]

### 4.6 Agent Personality Selection

로비 Name Input 하단에 위치하는 간단한 드롭다운:

```
Agent Type: [▼ Manual Play        ]
            ├── Manual Play (직접 조작)
            ├── Scholar Bot (XP 우선)
            ├── Berserker Bot (공격 우선)
            ├── Tank Bot (방어 우선)
            └── Custom Bot (Training Console)
```

- "Manual Play" 기본값 (플레이어 직접 조작)
- Bot 선택 시 자동 플레이 (Agent API 사용)
- "Custom Bot" 선택 시 Training Console 자동 펼침

---

## 5. Game HUD

### 5.1 HUD 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ [HP ██████████░░] 78/100        Lv.7        [XP ████████░░] │ ← TopBar
│                                  ↑                           │
│                              Level Badge                     │
│                                                              │
│                                                              │
│                           ⏱ 3:24                             │ ← TimerHUD
│                         Trophy #4/18                         │
│                                                              │
│                                                              │
│                                                              │
│                        [3D Game World]                        │
│                                                              │
│                                                              │
│                                              ┌─ Killfeed ──┐│
│                                              │ A → B       ││
│                                              │ C → D       ││
│                                              └─────────────┘│
│                                                              │
│ ┌─ BuildHUD ──────────────┐                  ┌─ Minimap ──┐ │
│ │ ⚔️x4  🛡️x2  📖x3       │                  │    ·  ·    │ │
│ │ ⚡Lightning Lv2 [CD:3s] │                  │  · [You] · │ │
│ └──────────────────────────┘                  │    ·  ·    │ │
│                                              └────────────┘ │
│ ⚠️ Arena shrink 8s                                    4:12   │ ← ShrinkWarning
└──────────────────────────────────────────────────────────────┘
```

**구현 방식**: HTML div overlay (`position: absolute`, `pointer-events: none`)
- 각 HUD 컴포넌트는 독립 React 컴포넌트
- 3D Canvas 외부 렌더 → Canvas 리렌더 영향 없음 (성능 무관)
- `pointer-events: none` 기본, 클릭 필요한 요소만 `pointer-events: auto`

### 5.2 TopBar (HP + XP + Level)

```
┌──────────────────────────────────────────────────────────────┐
│  ❤️❤️❤️❤️❤️ 78    mass:85         Lv.7 (65%)    ████████░░  │
│  HP Bar (좌측)                     Level Badge    XP Bar (우측) │
└──────────────────────────────────────────────────────────────┘
```

#### HP Bar
- 위치: 좌상단
- 스타일: MC 하트 아이콘 × N (현재 HP / maxHP 비율)
  - Full heart: `#FF3333`
  - Half heart: `#FF3333` 절반 + `#550000` 절반
  - Empty heart: `#550000`
- 대안 (간소화): 수평 바 `width: (hp/maxHp)*100%`, `background: #FF3333`
- Mass 표시: HP 옆 `"mass:85"` Inter 12px gray
- 피격 시: 바 flash 빨강 150ms

#### XP Bar
- 위치: 우상단
- 스타일: MC 경험치 바
  - Track: `#003300` 12px height
  - Fill: `#7FFF00` (현재 XP / 다음 레벨 XP)
  - 텍스트: `"340/500"` Inter 10px 바 위 우측 정렬
- 오브 수집 시: 바 fill 부드러운 전환 200ms + 초록 flash

#### Level Badge
- 위치: 상단 중앙
- 스타일: 원형 배지 `"Lv.7"`, Press Start 2P 14px, `#FFD700`
- 레벨업 시: 1초 scale pulse(1.0→1.3→1.0) + 골드 glow

### 5.3 BuildHUD (Tome + Ability)

```
┌─── BuildHUD.tsx ─────────────────────────────────┐
│  Tome Stacks:                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │
│  │⚔️x4│ │🛡️x2│ │📖x3│ │💀x1│  ← MC 아이템 슬롯  │
│  └────┘ └────┘ └────┘ └────┘                     │
│                                                   │
│  Ability:                                         │
│  ┌────────────────────────────┐                   │
│  │ ⚡ Lightning Lv2  [CD:3s] │  ← 어빌리티 슬롯   │
│  └────────────────────────────┘                   │
│                                                   │
│  Synergy: 🏅 Glass Cannon (Active)                │
└───────────────────────────────────────────────────┘
```

- 위치: 좌하단
- Tome 슬롯: 32×32 MC 아이템 슬롯 (다크 배경 + 밝은 보더)
  - 아이콘: 16×16 Canvas procedural 아이콘 (2x 스케일)
  - 스택 수: 우하단 작은 숫자 (Inter Bold 10px, 흰색)
  - 최대 표시: 6슬롯 (화면 공간 제한)
- Ability 슬롯: MC 핫바 스타일 (48×48)
  - 활성: 밝은 보더 + 아이콘 풀컬러
  - 쿨다운: 회색 오버레이 (위에서 아래로 sweep) + 남은 초
  - 미보유: 빈 슬롯 (다크)
- Synergy 배지: 골드 텍스트, 활성 시너지 이름
  - 비활성: 숨김
  - 활성: `#FFD700` 텍스트 + 작은 아이콘

### 5.4 TimerHUD

```
     ⏱ 3:24
   Trophy #4/18
```

- 위치: 상단 중앙 (Level Badge 아래)
- 타이머: `"M:SS"` Press Start 2P 16px, `#FFFFFF`
  - < 60초: `#FF3333` 빨강 + 깜박 (0.5Hz)
  - < 30초: 깜박 빠르게 (1Hz)
- 랭킹: `"#4/18"` Inter 12px, `#AAAAAA`
  - Top 3: 골드/은/동 색상
  - 등수 변동 시: ▲ 녹색 / ▼ 빨강 애니메이션

### 5.5 Minimap

```
┌─── Minimap (128×128px) ──────┐
│  ┌────────────────────────┐  │
│  │     Edge (green bg)    │  │
│  │   ┌──────────────┐    │  │
│  │   │  Mid (gray bg)│    │  │
│  │   │ ┌──────────┐ │    │  │
│  │   │ │Core (red)│ │    │  │
│  │   │ └──────────┘ │    │  │
│  │   └──────────────┘    │  │
│  │                        │  │
│  │  ● = 나 (흰색, 큰 점)  │  │
│  │  · = 다른 에이전트 (작은)│  │
│  │  ★ = 성소/힐링          │  │
│  │  --- = 축소 경계선 (빨강)│  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

- 위치: 우하단
- 크기: 128×128px (데스크톱) / 96×96px (모바일)
- 배경: 3-zone 동심원 (Edge 초록, Mid 회색, Core 빨강, 각각 반투명)
- 자신: 큰 흰색 점 (4px)
- 다른 에이전트: 작은 점 (2px, 에이전트 색상)
- 오브젝트: ★ 아이콘 (성소=보라, 힐링=청록)
- 축소 경계: 빨간 점선 원 (현재 + 10초 후 예상)
- 업데이트: 서버 `minimap` 1Hz 브로드캐스트

### 5.6 Killfeed

```
┌─── Killfeed (우상단) ──────────────┐
│  PlayerA ⚡ eliminated BotGamma    │  ← 최신
│  BotAlpha 🗡️ eliminated PlayerC   │
│  PlayerB ☠️ out of bounds          │
└────────────────────────────────────┘
```

- 위치: 우상단
- 최대 표시: 5줄 (FIFO, 5초 후 페이드 아웃)
- 포맷: `"{killer} {weapon_icon} eliminated {victim}"`
- 자신 관련: 흰색 Bold + 골드 하이라이트
- 타인: `#AAAAAA` 회색
- 경계 사망: `"{name} ☠️ out of bounds"` 빨강
- 자살: `"{name} ☠️ self-destructed"` 회색
- Font: Inter 11px
- 애니메이션: 새 항목 우측에서 슬라이드인 200ms

---

## 6. Game Overlays

### 6.1 Level-Up Card Selection (LevelUpOverlay)

```
┌──────────────────────────────────────────────────────────────┐
│                     LEVEL UP!  Lv.5                          │
│                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│   │  Green    │    │   Red    │    │   Blue   │              │
│   │  ┌────┐  │    │  ┌────┐  │    │  ┌────┐  │              │
│   │  │ 🏃 │  │    │  │ 🧪 │  │    │  │ 📖 │  │              │
│   │  └────┘  │    │  └────┘  │    │  └────┘  │              │
│   │  Speed   │    │  Venom   │    │  XP      │              │
│   │  Tome    │    │  Ability │    │  Tome    │              │
│   │          │    │          │    │          │              │
│   │  +15%    │    │  Melee   │    │  XP +20% │              │
│   │  Move    │    │  Poison  │    │  Gain    │              │
│   │  Speed   │    │  Damage  │    │          │              │
│   │          │    │          │    │          │              │
│   │   [1]    │    │   [2]    │    │   [3]    │              │
│   └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
│              ⏱ 5s (auto-select on timeout)                   │
└──────────────────────────────────────────────────────────────┘
```

**카드 디자인**:
- 크기: 160×240px (데스크톱) / 120×180px (모바일)
- 카드 배경: McPanel 스타일 (다크 + 엠보스)
- 카드 헤더 색상: 업그레이드 타입별
  - Tome: 해당 Tome 색상 (`Speed=#55FFFF`, `Damage=#FF3333`, `XP=#7FFF00`, `Armor=#3388FF`, `Luck=#FFD700`, `Cursed=#8800FF`)
  - Ability: 빨강 (`#FF4444`)
- 아이콘: 32×32 MC 스타일 (Canvas procedural)
- 이름: Press Start 2P 10px
- 설명: Inter 12px, 최대 3줄
- 키 힌트: `[1]` `[2]` `[3]` 원형 배지 (하단)

**인터랙션**:
- 키보드: 1, 2, 3 키
- 마우스: 카드 클릭
- 호버: 카드 scale 1.05 + 밝기 +10%
- 선택: 선택된 카드 scale 1.1 + glow → 200ms 후 닫힘
- 타임아웃: 5초 카운트다운 바 (하단), 시간 초과 시 랜덤 선택

**배경**: 게임 일시정지 아님 (게임 계속 진행), 반투명 배경 `rgba(0,0,0,0.4)`
- `pointer-events: auto` (카드 영역만)
- 게임 월드는 계속 렌더링

### 6.2 Synergy Activation Popup (SynergyPopup)

```
    ╔═══════════════════════════════╗
    ║  ✨ GLASS CANNON ACTIVATED ✨  ║
    ║     DPS +50%  |  HP -30%      ║
    ╚═══════════════════════════════╝
```

- 위치: 화면 중앙 상단 (타이머 아래)
- 스타일: 골드 텍스트 `#FFD700`, Press Start 2P 14px
- 배경: `rgba(0,0,0,0.6)` pill 형태
- 보더: 2px `#FFD700` 골드 glow (`box-shadow: 0 0 10px #FFD700`)
- 효과 텍스트: Inter 12px, 버프 `#55FF55` / 디버프 `#FF3333`
- 애니메이션: 아래→위 float (translateY 20→0) + opacity 0→1 (300ms)
- 지속: 2초 표시 → opacity 1→0 (500ms)
- 파티클: 12개 골드 별 파티클 동시 발생 (3D 씬 내)

### 6.3 Shrink Warning (ShrinkWarning)

**10초 전 경고**:
```
┌──────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────┐   │
│ │  ⚠️ WARNING: Arena Shrink in 8s                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│  (화면 가장자리: 빨간 비네트 효과)                             │
│                                                              │
│  (미니맵: 빨간 점선 원 = 10초 후 경계)                        │
└──────────────────────────────────────────────────────────────┘
```

- 텍스트: 하단 중앙, `"⚠️ WARNING: Arena Shrink in {N}s"`
  - Press Start 2P 12px, `#FF3333`
  - 깜박: 0.5Hz (500ms on/off)
- 비네트: CSS `box-shadow: inset 0 0 100px rgba(255,0,0,0.3)`
  - 남은 시간 비례 강도 증가 (10s=0.1 → 0s=0.4)
- 미니맵: 현재 경계(실선) + 10초 후 경계(빨간 점선)

**경계 밖 경고**:
```
  ⚠️ OUT OF BOUNDS! Mass decreasing...
```
- 화면 전체 빨간 비네트 (`rgba(255,0,0,0.25)`)
- 텍스트: 빨강 대형, 깜박 1Hz
- Mass 감소 표시: HP 바 지속 감소 애니메이션

### 6.4 Coach Chat Bubble (CoachBubble)

```
                                    ┌─────────────────────┐
                                    │ 💡 "적이 가까워요!   │
                                    │  중앙으로 이동       │
                                    │  추천합니다"         │
                                    │         ──  Coach AI │
                                    └──────────┬──────────┘
                                               ▽
```

- 위치: 화면 좌하단 (BuildHUD 위)
- 스타일: 작은 말풍선 McPanel + 꼬리
- 아이콘: 트리거별 (💡추천, ⚠️경고, 🎯기회, 🔄전략전환)
- 텍스트: Inter 12px, 최대 2줄
- 표시: slide-up 200ms → 3초 유지 → fade-out 300ms
- 빈도: 0.5-1Hz (스팸 방지)
- 닫기: 클릭 시 즉시 닫힘

**트리거 타입**:
| 아이콘 | 상황 | 예시 메시지 |
|--------|------|-----------|
| ⚠️ | 위험 접근 | "큰 적 접근! 회피 추천" |
| 💡 | 레벨업 추천 | "XP Tome 선택으로 시너지 가능" |
| 🔄 | 전략 전환 | "후반부 진입 — 중앙 이동 추천" |
| 🎯 | 킬 기회 | "약한 적 발견, 공격 기회!" |

---

## 7. End-Game Screens

### 7.1 Death Overlay (DeathOverlay)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│              (배경: 게임 화면 grayscale + darken)              │
│                                                              │
│                    ☠️ YOU DIED                                │
│                                                              │
│              Eliminated by: PlayerAlpha                       │
│              Survived: 2:34  |  Level: 8                     │
│              Kills: 3  |  Max Mass: 125                      │
│                                                              │
│              Build Summary:                                   │
│              ⚔️x3  🛡️x2  📖x2  |  ⚡Lightning Lv2           │
│                                                              │
│         [Respawn]              [Spectate]                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**트리거**: `death` 이벤트 수신 시
**배경 처리**:
1. 에이전트 death 애니메이션 (0.8초: 눕기 + 파티클 폭발)
2. 화면 서서히 grayscale (CSS `filter: grayscale(0.7) brightness(0.5)`)
3. 오버레이 fade-in (300ms)

**컴포넌트 구조**:
- 제목: `"YOU DIED"` Press Start 2P 24px, `#FF3333`, text-shadow
- 킬러 정보: `"Eliminated by: {killer}"` Inter 16px (킬러 이름 = 킬러 색상)
  - 경계 사망: `"Eliminated by: Arena Shrink"` 빨강
  - 자살: `"Self-destructed"` 회색
- 생존 통계: Inter 14px, `#AAAAAA`
- 빌드 요약: Tome 아이콘 + Ability 아이콘 (BuildHUD와 동일 스타일)
- [Respawn]: McButton(green), 클릭 시 `respawn` 이벤트
- [Spectate]: McButton(stone), 클릭 시 관전 모드 (카메라 = 가장 큰 에이전트 추적)

**관전 모드**:
- 카메라가 Top-1 에이전트 추적
- HUD: 타이머 + 미니맵만 표시
- `[◀ Prev] [Next ▶]` 관전 대상 전환 버튼
- 하단: `"Spectating: {name}"` 텍스트
- Respawn 버튼 상시 표시

### 7.2 Round Result (RoundResultOverlay)

```
┌──────────────────────────────────────────────────────────────┐
│                     🏆 ROUND RESULT                          │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  🥇 #1  PlayerAlpha        Lv.12   8 kills                  │
│        Build: ⚔️x5 + Venom Lv3                              │
│        Synergy: Glass Cannon ✨                              │
│                                                              │
│  🥈 #2  claude-agent       Lv.11   6 kills                  │
│        Build: 📖x3 + 🍀x2 + 💀x1                           │
│        Synergy: Holy Trinity ✨                              │
│                                                              │
│  🥉 #3  PlayerBeta         Lv.10   5 kills                  │
│        Build: 🛡️x4 + ❤️x3                                   │
│        Synergy: Iron Fortress ✨                             │
│                                                              │
│  ─── 4-10위 축소 표시 ───                                    │
│  #4  BotGamma   Lv.9  3kills   #5  PlayerDelta  Lv.8  2k   │
│                                                              │
│  ┌─ Hidden Synergy Hint ──────────────────────────────────┐  │
│  │  💡 "Venom + Gravity 조합의 비밀이..."                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Play Again]     [View Build Stats]     [Back to Lobby]     │
└──────────────────────────────────────────────────────────────┘
```

**트리거**: `round_end` 이벤트 수신 시
**애니메이션**: 하단→상단 slide-up (400ms)

**Top 3 표시**:
- 메달 아이콘: 🥇 골드 / 🥈 실버 / 🥉 동
- 이름: Press Start 2P 14px, 해당 에이전트 색상
- 레벨 + 킬 수: Inter 12px
- 빌드: Tome 아이콘 + Ability 아이콘 (16×16)
- 시너지: 골드 텍스트 + ✨ (활성 시너지만)

**4-10위**: 축소 1줄 표시 (이름, 레벨, 킬)

**Hidden Synergy Hint**:
- McPanel 작은 박스, 💡 아이콘
- 아직 발견하지 못한 시너지 힌트 (모호한 문장)
- 모든 시너지 발견 시 숨김

**버튼**:
- [Play Again]: McButton(green) — 같은 방에서 다음 라운드
- [View Build Stats]: McButton(stone) — 상세 통계 모달
- [Back to Lobby]: McButton(stone) — 로비 복귀

### 7.3 Build Stats Viewer (BuildStatsModal)

```
┌─── BuildStatsModal (모달, McPanel) ─────────────────────────┐
│  "Build Stats"                                       [X]     │
├──────────────────────────────────────────────────────────────┤
│  [Build Timeline]  [Kill Log]  [Damage Chart]                │
│  ────────────────────────────────────────────                │
│                                                              │
│  === Build Timeline Tab ===                                  │
│  0:15  Lv.1 → 📖 XP Tome                                    │
│  0:30  Lv.2 → 🏃 Speed Tome                                 │
│  0:50  Lv.3 → 📖 XP Tome (x2)                               │
│  1:15  Lv.4 → 🧪 Venom Ability    ← "시너지 근접!"          │
│  1:45  Lv.5 → ⚔️ Damage Tome                                │
│  2:10  Lv.6 → ⚔️ Damage Tome (x2)                           │
│  2:40  Lv.7 → ⚔️ Damage Tome (x3) ← "Glass Cannon! ✨"     │
│  ...                                                         │
│                                                              │
│  === Kill Log Tab ===                                        │
│  1:32  ⚡ BotAlpha (Lv.3, mass 45)  → +150 XP               │
│  2:05  ⚡ PlayerC (Lv.5, mass 78)   → +280 XP (2-streak)    │
│  3:11  ⚡ BotGamma (Lv.4, mass 52)  → +180 XP               │
│                                                              │
│  === Damage Chart Tab ===                                    │
│  Total Damage Dealt:  1,250                                  │
│  Total Damage Taken:  890                                    │
│  Total Healing:       340                                    │
│  ──────────────────                                          │
│  Aura DPS Kills:   5  |  Dash Kills:     3                  │
│  Ability Kills:    2  |  Boundary Kills: 0                   │
│  Synergy Activations: 2 (Glass Cannon, Holy Trinity)         │
│                                                              │
│  [Close]                                                     │
└──────────────────────────────────────────────────────────────┘
```

**3 Tabs** (McTab 컴포넌트 사용):
1. **Build Timeline**: 시간순 업그레이드 선택 로그
   - 시너지 근접 시 골드 마커
   - 시너지 활성 시 골드 텍스트 + ✨
2. **Kill Log**: 킬 시간, 대상, XP 획득량, 스트릭 보너스
3. **Damage Chart**: 총 데미지/힐링 통계 + 킬 타입 분류

데이터 소스: `round_end` 이벤트의 `RoundSummary` 페이로드

### 7.4 AI Analyst Panel (AnalystPanel)

Round Result 하단 확장 패널 (접이식):

```
┌─── "🤖 AI Analysis" (접이식 ▼) ────────────────────────────┐
│                                                              │
│  Overall Rating: ⭐⭐⭐☆☆ (3/5)                              │
│                                                              │
│  📊 Build Analysis:                                          │
│  "XP Tome 선택이 빨라 레벨 우위를 확보했지만,                  │
│   후반 방어 Tome 부재로 생존력이 낮았습니다."                  │
│                                                              │
│  ⚔️ Combat Analysis:                                        │
│  "Aura 전투 효율이 높았으나, 큰 적과의 교전 회피가             │
│   늦어 2번의 불필요한 사망이 있었습니다."                      │
│                                                              │
│  📍 Positioning Analysis:                                    │
│  "초반 Edge 파밍이 효율적이었으나, 2분 이후                    │
│   중앙 이동이 15초 늦었습니다."                               │
│                                                              │
│  💡 Improvement Suggestions:                                 │
│  1. "Lv.4에서 Armor Tome 1개 추가 시 생존율 +40% 예상"       │
│  2. "2:00 시점 중앙 이동으로 Core 보상 선점 가능"             │
│  3. "Venom + Damage 조합 시 Glass Cannon 시너지 가능"         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 트리거: `round_end` 후 서버에서 `analyst_result` 이벤트
- 1 LLM 호출 (라운드 종료 시, 비실시간)
- 접이식: 기본 접힘, 클릭 시 펼침
- 로딩: "🤖 Analyzing..." + spinner (LLM 응답 대기)
- 포맷: 4개 카테고리 (빌드/전투/포지셔닝/개선)
- 별점: 1-5 (LLM 판단)
- Font: Inter 13px, 카테고리 제목 = Press Start 2P 10px

---

## 8. Agent Training Screens

### 8.1 Training Console 전체 구조

로비 RoomList 하단 접이식 McPanel:

```
┌─── TrainingConsole.tsx (접이식 McPanel) ──────────────────────┐
│  "🤖 Agent Training"  [▲ 접기/펼치기]                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ TrainingHeader ────────────────────────────────────────┐ │
│  │  Agent: "my-claude-01"   Status: 🟢 Online              │ │
│  │  Win Rate: 34%  |  Avg Level: 9  |  Games: 47           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ BuildProfileEditor ───────────────────────────────────┐  │
│  │  (Section 8.2)                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ CombatRulesEditor ────────────────────────────────────┐  │
│  │  (Section 8.3)                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ StrategyPhaseEditor ──────────────────────────────────┐  │
│  │  Early (0-2min): [▼ Farm Orbs        ]                  │  │
│  │  Mid   (2-4min): [▼ Balanced          ]                  │  │
│  │  Late  (4-5min): [▼ Go Center + Defend]                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ LearningLog ──────────────────────────────────────────┐  │
│  │  (Section 8.4)                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Save Profile]    [Reset]    [Watch Live]                    │
└──────────────────────────────────────────────────────────────┘
```

**접이식 동작**:
- 기본: 접힌 상태 (헤더만 표시)
- 클릭: 300ms slide-down 애니메이션
- 저장: 펼침/접힘 상태 localStorage 유지

### 8.2 Build Profile Editor

```
┌─── BuildProfileEditor ─────────────────────────────────────┐
│  Primary Path:   [▼ Scholar (XP Rush)    ]                  │
│  Fallback Path:  [▼ Tank (if Lv < 5 at 2min)]              │
│                                                              │
│  Priority Upgrades (항상 선택):                               │
│  ┌────┐ ┌────┐ ┌────┐                                       │
│  │ 📖 │ │ 🍀 │ │ +  │  ← 드래그 또는 클릭으로 추가           │
│  │ XP │ │Luck│ │Add │                                       │
│  └────┘ └────┘ └────┘                                       │
│                                                              │
│  Banned Upgrades (절대 비선택):                               │
│  ┌────┐ ┌────┐                                               │
│  │ 💀 │ │ +  │  ← 드래그 또는 클릭으로 추가                   │
│  │Curse│ │Add │                                               │
│  └────┘ └────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

**Path Dropdown**:
- Scholar: XP Tome → Luck Tome → 시너지 우선
- Berserker: Damage Tome → Ability → 공격 우선
- Tank: Armor Tome → Regen → HP 우선
- Balanced: 균형 잡힌 스탯 분배
- Custom: Priority/Banned 직접 설정

**Priority/Banned 아이템 추가**:
- [+] 클릭 → 드롭다운 (모든 Tome + Ability 목록)
- 최대 Priority 5개, Banned 3개
- 아이콘 위 [x] 클릭으로 제거

### 8.3 Combat Rules Editor (If/Then)

```
┌─── CombatRulesEditor ──────────────────────────────────────┐
│  Combat Rules:                                               │
│                                                              │
│  Rule 1: IF [▼ mass_ratio ] [▼ > ] [  2.0  ]               │
│          THEN [▼ engage      ]                [🗑️]          │
│                                                              │
│  Rule 2: IF [▼ mass_ratio ] [▼ < ] [  0.5  ]               │
│          THEN [▼ retreat     ]                [🗑️]          │
│                                                              │
│  Rule 3: IF [▼ round_time  ] [▼ < ] [  60   ]              │
│          THEN [▼ go_center   ]                [🗑️]          │
│                                                              │
│  Rule 4: IF [▼ health_%    ] [▼ < ] [  30   ]              │
│          THEN [▼ seek_healing]                [🗑️]          │
│                                                              │
│  [+ Add Rule]                                                │
└──────────────────────────────────────────────────────────────┘
```

**Condition Dropdown 옵션**:
| 조건 | 설명 | 값 범위 |
|------|------|---------|
| `mass_ratio` | 내 mass / 적 mass | 0.1 ~ 10.0 |
| `health_percent` | HP % | 0 ~ 100 |
| `nearby_enemies` | 오라 범위 내 적 수 | 0 ~ 10 |
| `zone` | 현재 위치 존 | edge / mid / core |
| `round_time` | 남은 시간 (초) | 0 ~ 300 |
| `my_level` | 내 레벨 | 1 ~ 20 |
| `kill_streak` | 연속 킬 수 | 0 ~ 20 |

**Operator**: `>`, `<`, `>=`, `<=`, `==`

**Action Dropdown 옵션**:
| 액션 | 설명 |
|------|------|
| `retreat` | 가장 가까운 적 반대 방향 이동 |
| `engage` | 가장 가까운 적 방향 이동 + 부스트 |
| `farm_orbs` | 가장 가까운 오브 방향 이동 |
| `seek_shrine` | 가장 가까운 성소로 이동 |
| `seek_healing` | 가장 가까운 힐링 스프링으로 이동 |
| `go_center` | 맵 중앙으로 이동 |
| `go_edge` | 맵 가장자리로 이동 |

**규칙 우선순위**: 위에서 아래 (먼저 매칭되는 규칙 실행)
- 드래그 앤 드롭 순서 변경
- 최대 10개 규칙
- 저장: `localStorage` key `agent-rules-{agentId}`
- Auto-save: 0.5초 debounce

### 8.4 Learning Log

```
┌─── LearningLog ────────────────────────────────────────────┐
│  Recent Rounds:                                              │
│  ┌─────┬──────┬───────┬──────┬──────────────────────────┐   │
│  │ # │ Lv  │ Kills │ Rank │ Build Path              │   │
│  ├─────┼──────┼───────┼──────┼──────────────────────────┤   │
│  │ 47  │ 11   │ 4     │ #2   │ Berserker              │   │
│  │ 46  │ 9    │ 2     │ #5   │ Scholar                │   │
│  │ 45  │ 7    │ 0     │ #12  │ Scholar                │   │
│  │ 44  │ 10   │ 3     │ #3   │ Tank                   │   │
│  │ 43  │ 8    │ 1     │ #7   │ Scholar                │   │
│  └─────┴──────┴───────┴──────┴──────────────────────────┘   │
│                                                              │
│  💡 Insight: Scholar 빌드 후반 약세 → 전환 전략 추천          │
│                                                              │
│  [Show More]                                                 │
└──────────────────────────────────────────────────────────────┘
```

- 최근 10라운드 표시
- 테이블: MC 인벤토리 스타일 (다크 행 교대)
- 색상: Rank Top 3 = 골드/실버/동, 나머지 = 흰색
- Insight: 3라운드 데이터 기반 자동 생성 (간단 규칙 엔진)
  - "Scholar 빌드 3연패 → 전환 추천"
  - "Berserker 빌드 승률 65% (최고)"
- [Show More]: 전체 기록 스크롤

---

## 9. Visual Feedback System

### 9.1 Visual Feedback Matrix

| Event | Visual (3D Scene) | Visual (HUD) | Duration |
|-------|--------------------|--------------|----------|
| Orb collect | 8 녹색 파티클 분출 | XP 바 fill 애니메이션 | 0.5s |
| Level-up | 12 골드 별 파티클 + Agent bounce | Level 배지 pulse + LevelUp 카드 | 0.8s + 5s 카드 |
| Kill | 적 death 폭발 20 파티클 | Killfeed 텍스트 슬라이드인 | 1.0s |
| Death (나) | Agent 눕기 + 폭발 + grayscale | DeathOverlay fade-in | 0.8s + overlay |
| Boost | 3-frame 잔상 + emissive glow | - | 부스트 중 지속 |
| Aura DPS | 스파크 파티클 2/tick + aura 강조 | - | 전투 중 지속 |
| Shrink warning | 경계 빨간 벽 출현 | 비네트 + 경고 텍스트 | 10s |
| Synergy 활성 | 골드 파티클 폭발 12개 | SynergyPopup 골드 텍스트 | 2s |
| Healing spring | 5 하트 파티클 + 청록 물결 | HP 바 fill 애니메이션 | 0.6s |
| Shrine 효과 | 녹색 기둥 파티클 + 텍스트 | "XP x1.5" 작은 텍스트 팝업 | 1.0s |
| Kill streak (3) | 불 아이콘 이름 위 | "3-KILL STREAK x1.5" 골드 텍스트 | 1.5s |
| Kill streak (5) | 골드 아웃라인 전신 | "5-KILL STREAK x2.0" 골드 텍스트 | 1.5s |
| Kill streak (10) | 번개 파티클 주변 | "10-KILL STREAK x3.0" 골드+빨강 | 1.5s |
| Respawn | pop-in 스케일 0→1 | DeathOverlay 닫힘 | 0.3s |

### 9.2 Particle Type Specs (3D Scene 내)

| Type | Color | Count/Event | Lifetime | Gravity | 용도 |
|------|-------|-------------|----------|---------|------|
| `XP_COLLECT` | `#7FFF00` | 8 | 0.5s | -40 | 오브 수집 |
| `DEATH_BURST` | Agent color | 20 | 1.0s | -98 | 사망 폭발 |
| `LEVELUP_STAR` | `#FFD700` | 12 | 0.8s | -20 | 레벨업 별 |
| `HEAL_HEART` | `#FF3333` | 5 | 0.6s | -30 | 힐링 |
| `AURA_SPARK` | Build color | 2/tick | 0.3s | 0 | 오라 전투 |
| `BOUNDARY_RED` | `#FF0000` | 3/tick | 0.5s | -40 | 경계 레드스톤 |
| `DASH_TRAIL` | Agent color | 4/tick | 0.2s | 0 | 대시 잔상 |
| `SHRINE_AMB` | `#7FFF00` | 1/tick | 1.0s | -10 | 성소 부유 |
| `SYNERGY_GOLD` | `#FFD700` | 12 | 0.8s | -20 | 시너지 활성 |
| `STREAK_FIRE` | `#FF6600` | 2/tick | 0.4s | -30 | 킬 스트릭 불 |

**파티클 엔진**: InstancedMesh 기반, `MAX_PARTICLES = 500`, 4×4 MC 스타일 사각 파티클
**구현**: `ParticleSystem.tsx` — 풀링, InstancedMesh, 매 프레임 position/opacity 업데이트

### 9.3 Build Visual Indicators (3D Scene 내)

| 조건 | 이펙트 | 렌더링 방식 |
|------|--------|------------|
| Damage x3+ | 빨간 전투 오라 | aura ring `#FF3333`, opacity 0.08-0.16 |
| Armor x3+ | 파란 보호 glow | body emissive `#3388FF`, intensity 0.2 |
| Speed x3+ | 상시 잔상 | DASH_TRAIL 2/tick (부스트 안 해도) |
| XP x3+ | 녹색 XP 오라 | aura ring `#7FFF00`, opacity 0.10 |
| Luck x3+ | 골드 반짝임 | particles 1/2tick `#FFD700`, 0.4s |
| Cursed x3+ | 보라 안개 | particles 1/tick `#8800FF`, 0.6s, gravity=0 |

**스택 강도 스케일**:
| Stacks | Opacity/Intensity | 파티클 빈도 |
|--------|-------------------|------------|
| 0-2 | 없음 | 없음 |
| 3 | base (0.08) | 1/tick |
| 4 | ×1.25 (0.10) | 1/tick |
| 5 | ×1.5 (0.12) | 2/tick |
| 6 | ×1.75 (0.14) | 2/tick |
| 7+ | ×2.0 (0.16, max) | 3/tick |

복수 이펙트 동시 렌더: aura ring → particles → glow (z-fighting 없음, 레이어 분리)

### 9.4 Enchant Glow System

Tome 3+ 스택 시 해당 장비 부위에 MC 인챈트 glow:

| Tome | 대상 부위 | Emissive Color |
|------|----------|----------------|
| Damage x3+ | 팔/손 아이템 | Red `#FF3333` |
| Armor x3+ | 몸통 | Blue `#3388FF` |
| Speed x3+ | 다리/신발 | Cyan `#55FFFF` |
| XP x3+ | 머리 | Green `#7FFF00` |
| Luck x3+ | 액세서리 | Gold `#FFD700` |
| Cursed x3+ | 전신 (저강도) | Purple `#8800FF` |

**구현**:
- 별도 "glow layer" InstancedMesh (같은 geometry, scale 1.05)
- MeshBasicMaterial, transparent, opacity=0.15
- 펄스: `sin(elapsed * 2) * 0.05` opacity 변동
- Draw Call: +1 (glow 전용 InstancedMesh)

### 9.5 Kill Streak Visual Escalation

| Streak | 캐릭터 이펙트 | HUD 텍스트 |
|--------|--------------|-----------|
| 3 kills | 이름 위 불 아이콘 | `"3-KILL STREAK x1.5"` 골드 1.5s |
| 5 kills | 전신 골드 아웃라인 | `"5-KILL STREAK x2.0"` 골드 1.5s |
| 10 kills | 번개 파티클 주변 | `"10-KILL STREAK x3.0"` 골드+빨강 1.5s |

- 사망 시 리셋
- XP 보너스는 해당 킬 XP에만 적용 (오브 XP 제외)
- 텍스트: 화면 중앙, float-up + fade-out

---

## 10. Atmosphere & Mood

### 10.1 Fog Progression (분위기 변화)

라운드 시간에 따른 시각 분위기 변화:

| 시간 구간 | Fog Color | Fog Near | Fog Far | 분위기 |
|-----------|-----------|----------|---------|--------|
| 0-2분 | `#87CEEB` (맑은 하늘) | 400 | 1200 | 평화로운 파밍 |
| 2-3분 | → `#6B8CC4` (흐림) | 350 | 1100 | 긴장 시작 |
| 3-4분 | → `#5566AA` (어두움) | 300 | 1000 | 전투 고조 |
| 4-5분 | → `#332244` (보라 어둠) | 250 | 900 | 극도 긴장 |

```typescript
function updateAtmosphere(roundTimeRemaining: number) {
  const t = 1 - roundTimeRemaining / 300  // 0→1 (5분 동안)
  const skyColor = lerpColor('#87CEEB', '#332244', Math.pow(t, 1.5))
  scene.fog!.color.set(skyColor)
  scene.fog!.near = 400 - t * 150   // 400→250
  scene.background = new THREE.Color(skyColor)
}
```

**HUD 연동**: 타이머 색상도 동기화
- 5-2분: `#FFFFFF` 흰색
- 2-1분: `#FFAA00` 주황
- 1-0분: `#FF3333` 빨강 + 깜박

### 10.2 Zone Visual Themes

| Zone | 바닥 텍스처 | 장식물 | 분위기 |
|------|-----------|--------|--------|
| **Edge** (외곽) | 잔디 `#5D9B47` + 흙 `#8B6A3E` | 참나무 8-12, 꽃/덤불 20-30 | 안전한 평원 |
| **Mid** (중간) | 돌 `#7F7F7F` + 금 | 횃불 12-16, 돌벽 조각 6-8 | 전장 |
| **Core** (중앙) | 네더랙 `#6B3030` + 금맥 | 용암 풀 3-5, 흑요석 기둥 4-6 | 고위험 지옥 |

**Zone 전환 시각 효과**:
- 바닥 텍스처 점진적 변화 (존 경계에서 블렌딩)
- 장식물 밀도 변화
- Core 진입 시: 미세한 빨간 비네트 (위험 암시)

### 10.3 Arena Shrink Visuals

**축소 경고 (10초 전)**:
- 미니맵: 빨간 점선 원 (새 경계)
- HUD: `"⚠️ Arena Shrink in Xs"` 빨강 깜박
- 3D: 현재 경계에 약한 빨간 벽 (opacity 0.1)

**축소 진행 중**:
- 3D: MC 월드 보더 이펙트 — 빨간 반투명 벽 (opacity 0.3)
- 파티클: 경계선을 따라 빨간 레드스톤 파티클
- 경계 밖: 화면 가장자리 빨간 비네트 + mass 감소 표시

**축소 완료**:
- 새 경계 안정화, 벽 opacity 0.3 → 0.15 (fade)

### 10.4 Sound Design Direction (Phase 4+ Future)

| Event | Sound Type | 톤 |
|-------|-----------|-----|
| Orb collect | Pop (짧고 경쾌) | MC 경험치 수집음 참고 |
| Level-up | Chime (상승 멜로디) | MC 레벨업 참고 |
| Kill | Ding (짧은 타격음) | MC 엔더맨 히트 참고 |
| Death | Whomp (둔탁한 폭발) | MC 플레이어 사망 참고 |
| Boost | Whoosh (바람) | MC 엘리트라 활공 참고 |
| Shrink warning | Alarm (경고 비프) | MC 위더 소환 참고 |
| Synergy | Fanfare (짧은 팡파레) | MC 인챈트 완료 참고 |
| UI click | Click (MC 버튼 클릭) | MC 메뉴 클릭음 |

구현 우선순위: Phase 4 이후 (Core gameplay 안정 후)

---

## 11. Mobile Responsive

### 11.1 Breakpoints

| Breakpoint | Width | 레이아웃 |
|-----------|-------|---------|
| **Desktop** | ≥ 1024px | 2-column lobby, 전체 HUD |
| **Tablet** | 768-1023px | 2-column (좁은), 축소 HUD |
| **Mobile** | < 768px | 1-column, 최소 HUD |

### 11.2 Touch Controls

```
┌─── Mobile Game Screen ────────────────────┐
│  [HP] [Lv] [XP]                     ⏱3:24│ ← 축소 TopBar
│                                           │
│                                           │
│                                           │
│              [3D Game World]              │
│                                           │
│                                           │
│                                           │
│  ⚔️x4 🛡️x2                        [Map] │ ← 축소 BuildHUD + 미니맵
│                                           │
│        (Touch Area: 이동 방향)             │
│   ┌─────────────────────────────┐         │
│   │   터치한 방향으로 Agent 이동  │         │
│   │   더블탭 = Boost             │         │
│   └─────────────────────────────┘         │
└───────────────────────────────────────────┘
```

**터치 입력**:
- 이동: 화면 터치 위치 방향으로 Agent 이동 (조이스틱 X, 직접 방향 지정)
- Boost: 더블탭 (200ms 이내 2번 탭)
- Level-up: 카드 탭 (1/2/3 키 대신)
- 미니맵: 작은 크기 (96×96), 탭 시 확대 토글

### 11.3 Layout Adaptations

#### Lobby — Mobile (< 768px)

```
┌─── Mobile Lobby ──────────────────┐
│  AGENT SURVIVOR (로고, 작게)       │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  [Agent Preview 96x96]       │  │
│  │  Name: [___________]        │  │
│  │  Type: [▼ Manual Play ]     │  │
│  │  [Quick Join] [Customize]   │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Room List                   │  │
│  │  Arena #1  12/18  Playing    │  │
│  │  Arena #2   8/18  Waiting    │  │
│  │  Arena #3   3/18  Playing    │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Recent Winners (축소)       │  │
│  │  🏆 PlayerA  |  🥈 Bot  ...  │  │
│  └──────────────────────────────┘  │
│                                    │
│  [🤖 Training ▼] (접이식)         │
└────────────────────────────────────┘
```

**모바일 변경사항**:
- 2-column → 1-column 세로 스택
- Character Creator → [Customize] 버튼 탭 시 전체화면 모달
- Recent Winners → 1줄 축소 (Top 3 이름만)
- Training Console → 접이식 유지, 내부 레이아웃 세로 전환
- 3D 배경: 유지 (성능 충분 시) 또는 CSS gradient 대체
- Agent Preview: 96×96px (130→96 축소)

#### Game HUD — Mobile (< 768px)

| 요소 | Desktop | Mobile |
|------|---------|--------|
| HP Bar | 좌상단, 긴 바 | 좌상단, 짧은 바 (숫자 숨김) |
| XP Bar | 우상단, 긴 바 | 우상단, 짧은 바 |
| Level Badge | 상단 중앙, 큰 | 상단 중앙, 작은 |
| Timer | 상단 중앙 아래 | 우상단 코너 |
| BuildHUD | 좌하단, 전체 표시 | 좌하단, 아이콘만 (텍스트 숨김) |
| Minimap | 우하단 128×128 | 우하단 96×96, 탭 시 확대 |
| Killfeed | 우상단 5줄 | 우상단 3줄, 폰트 축소 |

#### Level-Up Cards — Mobile

- 카드 크기: 160×240 → 100×160px
- 3장 가로 배치 유지 (화면 너비 충분)
- 터치 탭으로 선택
- 키보드 힌트 [1][2][3] 숨김

#### Death Overlay — Mobile

- 전체 레이아웃 동일, 폰트 크기 축소
- [Respawn] 버튼 크기 확대 (터치 편의)

#### Round Result — Mobile

- Top 3만 표시 (4-10위 숨김)
- Build Stats: 전체화면 모달
- 버튼 세로 스택

---

## 12. Accessibility

### 12.1 Keyboard Navigation

| 영역 | 키 | 액션 |
|------|-----|------|
| Game | Mouse | Agent 이동 방향 |
| Game | Space / Left Click | Boost |
| Level-Up | 1, 2, 3 | 카드 선택 |
| Level-Up | Enter | 호버된 카드 선택 |
| Death | Enter / Space | Respawn |
| Lobby | Tab | 포커스 이동 |
| Lobby | Enter | 버튼 활성화 |
| All | Escape | 모달 닫기 / 로비 복귀 |

### 12.2 Screen Reader

- 모든 아이콘: `aria-label` 필수 (예: `aria-label="Damage Tome level 4"`)
- 바 요소: `role="progressbar"` + `aria-valuenow` + `aria-valuemax`
- 모달: `role="dialog"` + `aria-modal="true"` + 포커스 트랩
- 킬피드: `aria-live="polite"` (새 항목 자동 읽기)
- 게임 캔버스: `aria-label="Game canvas"` (시각적 게임이므로 제한적)

### 12.3 Color Contrast

- 텍스트/배경: WCAG AA 최소 4.5:1 준수
  - `#FFFFFF` on `rgba(0,0,0,0.75)` = ✅ (15:1)
  - `#AAAAAA` on `rgba(0,0,0,0.75)` = ✅ (8:1)
  - `#FFD700` on `rgba(0,0,0,0.75)` = ✅ (10:1)
- HP/XP 바: 색상 + 숫자 이중 표시 (색맹 대응)
- Zone 구분: 색상 + 텍스처 패턴 이중 표시

### 12.4 Motion Sensitivity

- `prefers-reduced-motion` 미디어 쿼리 존중:
  - 파티클 효과 비활성화 (또는 최소화)
  - 화면 전환 애니메이션 즉시 전환으로 변경
  - 깜박임 효과 제거 (타이머, 경고)
  - 카메라 lerp 즉시 스냅으로 변경

---

## 13. Component Implementation Map

### 13.1 신규 컴포넌트 목록

| Component | Type | Phase | Roadmap Step |
|-----------|------|-------|-------------|
| `LevelUpOverlay.tsx` | Game Overlay | Phase 1 | S35 |
| `BuildHUD.tsx` | Game HUD | Phase 1 | S35 |
| `XPBar.tsx` | Game HUD | Phase 1 | S35 |
| `HPBar.tsx` | Game HUD | Phase 1 | S35 |
| `TimerHUD.tsx` | Game HUD | Phase 1 | S35 |
| `Minimap.tsx` | Game HUD | Phase 1 | S36 |
| `Killfeed.tsx` | Game HUD | Phase 2 | S36 |
| `ShrinkWarning.tsx` | Game Overlay | Phase 2 | S36 |
| `SynergyPopup.tsx` | Game Overlay | Phase 2 | S44 |
| `RoundResultOverlay.tsx` | End-Game | Phase 2 | S44 |
| `BuildStatsModal.tsx` | End-Game | Phase 3 | S44 |
| `DeathOverlay.tsx` | End-Game (수정) | Phase 1 | S35 |
| `CharacterCreator.tsx` | Lobby | Phase 3 | S40 |
| `LobbyAgentPreview.tsx` | Lobby | Phase 3 | S40 |
| `TrainingConsole.tsx` | Lobby | Phase 3 | S47 |
| `BuildProfileEditor.tsx` | Training Sub | Phase 3 | S47 |
| `CombatRulesEditor.tsx` | Training Sub | Phase 3 | S47 |
| `LearningLog.tsx` | Training Sub | Phase 3 | S47 |
| `WelcomeTutorial.tsx` | Lobby Modal | Phase 3 | S46 |
| `CoachBubble.tsx` | Game Overlay | Phase 4 | S55 |
| `AnalystPanel.tsx` | End-Game | Phase 4 | S55 |

### 13.2 기존 수정 컴포넌트

| Component | 변경 내용 | Phase |
|-----------|----------|-------|
| `RoomList.tsx` | Build Icons + Agent 아이콘 추가 | Phase 3 |
| `RecentWinnersPanel.tsx` | 빌드 아이콘 + 시너지 배지 추가 | Phase 3 |
| `LobbyScene3D.tsx` | IdleSnakes → IdleAgents 교체 | Phase 3 |
| `page.tsx` | mode 전환 + 새 overlay 통합 | Phase 1-2 |
| `GameCanvas3D.tsx` | Agent 렌더링 + 파티클 시스템 | Phase 1 |
| `CountdownOverlay.tsx` | 디자인 MC 스타일로 변경 | Phase 2 |
| `RoundTimerHUD.tsx` | TimerHUD로 통합/대체 | Phase 1 |

### 13.3 Design System 컴포넌트

| Component | 상태 | 비고 |
|-----------|------|------|
| `McPanel.tsx` | ✅ 기존 | 변경 없음 |
| `McButton.tsx` | ✅ 기존 | 변경 없음 |
| `McInput.tsx` | ✅ 기존 | 변경 없음 |
| `McTab.tsx` | 🆕 신규 | Character Creator용 |
| `McTooltip.tsx` | 🆕 신규 | 잠금 아이템 설명용 |
| `McBadge.tsx` | 🆕 신규 | Rarity 표시용 |
| `McProgressBar.tsx` | 🆕 신규 | HP/XP 바 통일 컴포넌트 |

### 13.4 Phase별 UI 구현 순서

```
Phase 0 (Go Server):     UI 변경 없음 (서버만)
Phase 1 (Core Gameplay):  TopBar + BuildHUD + TimerHUD + DeathOverlay + LevelUpOverlay
Phase 2 (Full Gameplay):  Minimap + Killfeed + ShrinkWarning + SynergyPopup + RoundResult
Phase 3 (Polish):         CharacterCreator + TrainingConsole + RoomList 개선 + 튜토리얼
Phase 4 (AI Integration): CoachBubble + AnalystPanel
Phase 5 (Meta):           RP 시스템 UI, 업적 UI, 시즌 UI (본 문서 범위 밖)
```

### 13.5 데이터 흐름 (Socket Events → UI)

| Socket Event | 방향 | UI Component | 데이터 |
|-------------|------|-------------|--------|
| `state` (20Hz) | S→C | GameCanvas3D, HUD | 에이전트 위치, HP, mass, 오브 |
| `death` | S→C | DeathOverlay | killer, stats |
| `kill` | S→C | Killfeed | killer, victim, weapon |
| `level_up` | S→C | LevelUpOverlay | 3 upgrade choices |
| `choose_upgrade` | C→S | LevelUpOverlay | selected index |
| `round_start` | S→C | TimerHUD | roundDuration |
| `round_end` | S→C | RoundResultOverlay | RoundSummary |
| `shrink_update` | S→C | ShrinkWarning, Minimap | currentRadius, nextRadius |
| `synergy_activated` | S→C | SynergyPopup | synergyName, effects |
| `rooms_update` (1Hz) | S→C | RoomList | rooms[], buildDistribution |
| `minimap` (1Hz) | S→C | Minimap | agent positions, objects |
| `coach_message` | S→C | CoachBubble | type, message |
| `analyst_result` | S→C | AnalystPanel | rating, analysis |
| `training_update` | S→C | LearningLog | round result |
