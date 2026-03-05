# Agent Survivor — System Architecture v10

> **Project**: Agent Survivor (Multiplayer Auto-Combat Survival Roguelike)
> **Stack**: TypeScript (Node.js + Socket.IO) / Next.js 15 + R3F / Railway + Vercel
> **Design**: `docs/designs/v10-survival-roguelike-plan.md`

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT                              │
│                                                             │
│   Vercel (Frontend)              Railway (Backend)          │
│   ┌──────────────┐              ┌──────────────────┐       │
│   │ Next.js 15   │  WebSocket   │ Node.js + Socket │       │
│   │ + React 19   │◄────────────►│ .IO Server       │       │
│   │ + R3F (3D)   │  (20Hz)      │ (20Hz tick rate) │       │
│   └──────────────┘              └──────────────────┘       │
│          │                              │                   │
│   apps/web/                     apps/server/                │
│                                                             │
│              packages/shared/ (types + constants)            │
└─────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
snake/
├── apps/
│   ├── server/          # Game server (Node.js + Socket.IO)
│   │   └── src/
│   │       ├── index.ts           # Entry point
│   │       ├── game/              # Core game systems
│   │       │   ├── Arena.ts       # Game loop orchestrator (20Hz)
│   │       │   ├── AgentEntity.ts # v10 Agent (single position, build system)
│   │       │   ├── CollisionSystem.ts  # Aura DPS + Dash combat
│   │       │   ├── UpgradeSystem.ts    # Tome/Ability/Synergy
│   │       │   ├── ArenaShrink.ts      # Arena shrink + boundary penalty
│   │       │   ├── OrbManager.ts       # Orb spawn/collection
│   │       │   ├── SpatialHash.ts      # Spatial indexing
│   │       │   ├── StateSerializer.ts  # Viewport culling + serialization
│   │       │   ├── LeaderboardManager.ts
│   │       │   ├── BotManager.ts       # Bot lifecycle
│   │       │   ├── BotBehaviors.ts     # Bot AI strategies
│   │       │   ├── Room.ts            # Room state machine
│   │       │   └── MapObjects.ts      # TODO: Shrine/Spring/Altar/Gate
│   │       └── network/
│   │           ├── SocketHandler.ts   # Event routing
│   │           ├── Broadcaster.ts     # Multi-room broadcasting
│   │           └── RateLimiter.ts     # Rate limiting
│   │
│   └── web/             # Next.js 15 client
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx           # Main: lobby/playing mode switching
│       ├── components/
│       │   ├── game/              # In-game components
│       │   │   ├── GameCanvas.tsx      # 2D Canvas renderer
│       │   │   ├── DeathOverlay.tsx
│       │   │   ├── RoundTimerHUD.tsx
│       │   │   ├── CountdownOverlay.tsx
│       │   │   └── RoundResultOverlay.tsx
│       │   ├── lobby/             # Lobby components (MC style)
│       │   │   ├── McPanel.tsx
│       │   │   ├── McButton.tsx
│       │   │   ├── McInput.tsx
│       │   │   ├── RoomList.tsx
│       │   │   ├── RecentWinnersPanel.tsx
│       │   │   ├── LobbyScene3D.tsx
│       │   │   └── LobbySnakePreview.tsx
│       │   └── 3d/                # R3F 3D components
│       │       └── LobbyCamera.tsx
│       ├── hooks/
│       │   └── useSocket.ts       # Socket.IO connection + events
│       └── lib/
│           ├── camera.ts          # Camera tracking + zoom
│           ├── interpolation.ts   # Client-side interpolation
│           ├── minecraft-ui.ts    # MC design system tokens
│           └── renderer/          # 2D Canvas rendering pipeline
│               ├── index.ts
│               ├── types.ts
│               ├── background.ts
│               ├── entities.ts    # Snake/Agent sprite rendering
│               └── ui.ts          # HUD overlay rendering
│
└── packages/
    └── shared/              # Shared types + constants
        └── src/
            ├── types/
            │   ├── game.ts        # Agent, PlayerBuild, UpgradeChoice, etc.
            │   └── events.ts      # Socket.IO event types + payloads
            ├── constants/
            │   ├── game.ts        # ARENA_CONFIG, ROOM_CONFIG, NETWORK
            │   ├── upgrades.ts    # XP_TABLE, TOME_DEFS, ABILITY_DEFS, SYNERGIES
            │   ├── colors.ts      # Color palettes
            │   └── index.ts       # Re-exports
            └── utils/             # Shared utility functions
```

---

## 2. Core Game Architecture

### 2.1 Entity Model — Agent (v10)

```
Snake (v7, deprecated)          Agent (v10, current)
─────────────────────          ─────────────────────
segments: Position[]    →      position: Position (단일 좌표)
mass = segment count    →      mass = HP (히트포인트)
                               level, xp, xpToNext
                               build: PlayerBuild (Tome + Ability)
                               activeSynergies: string[]
                               hitboxRadius (mass 기반 동적)
```

**Key**: Agent는 단일 위치의 자동전투 캐릭터. 세그먼트 없음.

### 2.2 Game Loop (Arena.ts — 20Hz)

```
매 tick (50ms):
  1. Bot AI          → BotBehaviors: 봇 입력 결정
  2. Movement         → AgentEntity.update(): 조향 + 이동 + 히트박스 갱신
  3. Arena Shrink     → ArenaShrink.update(): 반경 축소 + 경계 패널티
  4. Spatial Hash     → SpatialHash 재구축 (에이전트 + 오브)
  5. Aura Combat      → CollisionSystem.processAuraCombat(): DPS 교환
  6. Dash Collisions  → CollisionSystem.processDashCollisions(): 대시 버스트
  7. Death Detection  → CollisionSystem.detectDeaths(): mass≤0 또는 경계 사망
  8. Death Processing → CollisionSystem.processDeaths(): 오브 분해 + 킬 보상
  9. Kill XP Rewards  → addXp() for killer (kill streak bonus)
  10. Effects         → removeExpiredEffects()
  11. Orb Collection  → processOrbCollection(): mass + XP + 레벨업 체크
  12. Upgrade Timeout → processUpgradeTimeouts(): 5초 미선택 시 랜덤
  13. Leaderboard     → 정렬/캐싱 (매 5틱)
  14. Orb Maintenance → OrbManager: 오브 스폰/정리
```

### 2.3 Combat System

```
┌─────────────────────────────────────────────┐
│           Auto-Combat (Aura DPS)             │
│                                             │
│   Agent A ←── 60px 오라 ──→ Agent B         │
│   DPS = 2.0 × DamageTome × CursedTome       │
│   × HighLevelBonus × GlassCannonSynergy     │
│                                             │
│   받는 피해 = DPS × (1 - ArmorReduction)     │
│   ArmorReduction = ArmorTome - CursedPenalty  │
│                 + IronFortress + GlassCannon  │
├─────────────────────────────────────────────┤
│           Dash Kill (Burst Damage)           │
│                                             │
│   부스트 상태 + 히트박스 충돌                  │
│   → 상대 mass × 30% 즉시 피해               │
│   + Berserker 시너지: ×3 대시 데미지          │
├─────────────────────────────────────────────┤
│           Death Condition                    │
│                                             │
│   mass ≤ 0 → 사망 (마지막 가해자에게 킬)     │
│   경계 110%+ → 즉사 (boundary death)         │
└─────────────────────────────────────────────┘
```

### 2.4 XP & Level-Up System

```
Orb Collection → +XP (1~5 base × XP Tome × Holy Trinity)
Kill → +XP (10~15 base + enemy level × 3 × Kill Streak)

Level up → 3 Random Choices (Tome or Ability, 35% ability chance)
         → 5초 내 선택 (타임아웃 시 랜덤)
         → Synergy 체크 (10종: 6 public + 4 hidden)

XP Table: [0, 20, 30, 45, 65, 90, 120, 155, 195, 240, 290, 345]
Max Level: 12
```

### 2.5 Build System

**8 Tomes (패시브 스택)**:
| Tome | 효과/스택 | 최대 |
|------|----------|------|
| XP | +20% XP | 10 |
| Speed | +10% 이동속도 | 5 |
| Damage | +15% 오라 DPS | 10 |
| Armor | -10% 받는 피해 | 8 |
| Magnet | +25% 수집 범위 | 6 |
| Luck | +15% 레어 확률 | 6 |
| Regen | +0.5 mass/s | 5 |
| Cursed | +25% DPS, +20% 받는 피해 | 5 |

**6 Abilities (자동 발동)**:
Venom Aura, Shield Burst, Lightning Strike, Speed Dash, Mass Drain, Gravity Well

**10 Synergies**: Holy Trinity, Glass Cannon, Iron Fortress, Speedster, Vampire, Storm + 4 hidden

---

## 3. Network Architecture

### 3.1 Room System

```
SocketHandler → RoomManager → Room[5] → Arena[5]
                                 │
                            State Machine:
                  waiting → countdown(10s) → playing(5min)
                     ↑      → ending(5s) → cooldown(15s) →┘
```

### 3.2 Protocol (Socket.IO)

**Client → Server**:
- `join_room` (roomId, name, skinId)
- `leave_room`
- `input` (angle, boost, seq) — 30Hz
- `respawn` (name, skinId)
- `choose_upgrade` (choiceId)
- `ping` (timestamp)

**Server → Client**:
- `joined` (roomId, id, spawn, arena, tick, roomState, timeRemaining)
- `state` (tick, agents[], orbs[], leaderboard?) — 20Hz
- `death` (score, length, kills, killer, duration, rank, damageSource, level)
- `level_up` (level, choices[], timeoutTicks)
- `synergy_activated` (synergyId, name, description)
- `arena_shrink` (currentRadius, minRadius, shrinkRate)
- `round_start/end/reset`
- `rooms_update` (1Hz lobby broadcast)
- `minimap` (1Hz)
- `kill`, `respawned`, `pong`, `error`

### 3.3 State Serialization

```
StatePayload = {
  t: tick,
  s: AgentNetworkData[],  // 뷰포트 내 에이전트 (x, y, h, m, b, k, lv, e?)
  o: OrbNetworkData[],    // 뷰포트 내 오브
  l?: LeaderboardEntry[], // 매 5틱
  mo?: MapObjectNetworkData[]  // 맵 오브젝트
}
```

Viewport culling: center ± (viewportWidth/2 + VIEWPORT_MARGIN + 500)

---

## 4. Implementation Status & Phases

### Current Status (v10 Server ~85% Complete)

| System | Status | File |
|--------|--------|------|
| AgentEntity | ✅ Done | `game/AgentEntity.ts` |
| CollisionSystem (Aura + Dash) | ✅ Done | `game/CollisionSystem.ts` |
| UpgradeSystem (Tome/Ability/Synergy) | ✅ Done | `game/UpgradeSystem.ts` |
| ArenaShrink | ✅ Done | `game/ArenaShrink.ts` |
| Arena game loop | ✅ Done | `game/Arena.ts` |
| StateSerializer (AgentNetworkData) | ✅ Done | `game/StateSerializer.ts` |
| BotManager + BotBehaviors | ✅ Done | `game/BotManager.ts`, `game/BotBehaviors.ts` |
| Room + RoomManager | ✅ Done | `game/Room.ts` |
| Shared types + constants | ✅ Done | `packages/shared/` |
| MapObjects (Shrine/Spring/Altar/Gate) | ❌ TODO | Phase 1 |
| Ability auto-trigger processing | ❌ TODO | Phase 1 |
| Client Agent rendering (2D) | ❌ TODO | Phase 2 |
| Level-Up UI + Build HUD | ❌ TODO | Phase 2 |
| Lobby redesign (Character Creator) | ❌ TODO | Phase 2 |
| Agent API + Training | ❌ TODO | Phase 3 |
| Meta progression | ❌ TODO | Phase 4 |

### Development Phases

**Phase 1 — Server Completion** (MapObjects + Ability auto-trigger + Balance)
- MapObjects system: XP Shrine (+15 XP), Healing Spring (+mass), Upgrade Altar (instant level-up), Speed Gate (3s speed boost)
- Ability auto-trigger in game loop (processAbilities)
- 1-Life mode: human players no respawn, bots replaced on death
- Balance tuning: combat timing, XP curve, synergy viability

**Phase 2 — Client Rendering + Game UI**
- Agent 2D sprite rendering (16×16 MC-style top-down)
- interpolateAgents (single position interpolation)
- LevelUpOverlay (3-choice card UI, 5s timer)
- BuildHUD (Tome stacks + Ability slots) + XPBar (MC experience bar)
- ShrinkWarning (boundary visual + minimap indicator)
- SynergyPopup (gold enchant glow notification)
- Aura/effect visualization + map object rendering

**Phase 3 — Lobby Redesign + Character Creator**
- Character Creator UI (5-tier MC customization)
- LobbyIdleAgents (replace snake 3D models)
- LobbyAgentPreview (R3F MC character rotation)
- "Agent Survivor" logo + text rebranding
- Welcome tutorial + personality selector
- RoundResult extension (build + synergy + AI analysis)

**Phase 4 — Agent Integration + Training**
- Agent level_up event + choose_upgrade command
- Commander Mode extension (combat style, zone movement)
- Build path system (5 preset paths)
- Training API (PUT /training) + Training Console UI
- Agent memory/learning system

**Phase 5 — Meta + Polish**
- RP system (unlock cosmetics)
- Quest system (daily/weekly/milestone)
- Coach/Analyst agents
- Balance iteration + performance optimization

---

## 5. Design System

**Theme**: Minecraft Inventory UI (dark panels + 3D emboss) + MC Voxel Art Direction

**Palette** (`lib/minecraft-ui.ts`):
- Panel: `rgba(0,0,0,0.75)` + 3D emboss border
- XP Bar: `#7FFF00` (MC experience green)
- HP Bar: `#FF3333` (MC heart red)
- Synergy: `#FFD700` (gold glow)

**Fonts**: "Press Start 2P" (titles/buttons) + "Inter" (body/numbers)

**Components**: McPanel, McButton (stone/green/red), McInput

**Camera**: Top-down orthographic, dynamic zoom (mass-based)

---

## 6. Key Constants

```typescript
TICK_RATE: 20          // Hz
BASE_SPEED: 150        // px/s
BOOST_SPEED: 300       // px/s
AURA_RADIUS: 60        // px (combat range)
AURA_DPS_PER_TICK: 2.0 // mass/tick (40 mass/s)
DASH_DAMAGE_RATIO: 0.3 // 30% of target mass
HITBOX_BASE_RADIUS: 16 // px
HITBOX_MAX_RADIUS: 22  // px
SHRINK_PER_TICK: 0.5   // px/tick (600px/min)
MIN_RADIUS: 1200       // px
BOUNDARY_PENALTY: 0.0025  // 0.25% mass/tick
COLLECT_RADIUS: 50     // px
INITIAL_MASS: 10
ROUND_DURATION: 300    // seconds (5 min)
MAX_LEVEL: 12
GRACE_PERIOD_TICKS: 600 // 30 seconds
UPGRADE_TIMEOUT_TICKS: 100 // 5 seconds
MAX_ABILITY_SLOTS: 2
```
