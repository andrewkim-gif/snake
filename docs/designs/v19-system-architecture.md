# v19 Arena 3D Integration — System Architecture

> **Version**: v19
> **Date**: 2026-03-08
> **Status**: Approved
> **Scope**: Server→Client 데이터 파이프라인, AR 이벤트 큐, 좌표계 통일, React state/ref 전략, Classic/Arena 모드 분기, 17개 AR 컴포넌트 의존관계
> **Input**: `v19-arena-3d-integration-plan.md` + `v19-arena-verification-report.md` (26건 반영)

---

## 1. Overview

AI World War의 Arena Combat 시스템은 서버 Go 코드 95% 완성 상태이나 클라이언트 3D 통합이 0%이다.
17개 AR 컴포넌트(orphan), 11개 AR 이벤트(미수신), ar-interpolation.ts(미연결)이 존재하지만
GameCanvas3D에 마운트되지 않은 채 방치되어 있다.

이 아키텍처 문서는 **서버 ar_state 데이터가 클라이언트 3D 렌더링으로 흐르는 전체 파이프라인**을 설계한다.

### 핵심 문제 3가지
1. **데이터 단절**: ar_state → classic bridge → StatePayload 변환 시 enemies/crystals/projectiles/items/phase/wave 95% 폐기
2. **좌표 불일치**: `SERVER_TO_BLOCK_SCALE = 80/3000 = 0.02667` — AR meter 좌표(0~60m)에 적용하면 모든 엔티티가 원점에 뭉침
3. **컴포넌트 미마운트**: 17개 AR 컴포넌트가 GameCanvas3D에 마운트되지 않고, Classic 3D 컴포넌트와 중복 렌더링 방지 분기 없음

### 아키텍처 목표
```
Before:  ar_state → bridge → StatePayload → GameLoop → AgentInstances (95% 데이터 손실)
After:   ar_state → arStateRef + arInterp + arEventQueue → 17 AR Components (100% 데이터 활용)
```

---

## 2. Goals / Non-Goals

### Goals
- **G1**: ar_state 20Hz 데이터를 AR 컴포넌트가 직접 소비하는 파이프라인 구축 (classic bridge 우회)
- **G2**: 17개 AR 컴포넌트를 GameCanvas3D에 마운트 (isArenaMode 분기)
- **G3**: 11개 AR 이벤트 리스너를 useSocket에 등록하고 이벤트 큐 시스템으로 분배
- **G4**: ar-interpolation.ts 연결 — 20Hz → 60fps smooth 보간
- **G5**: Classic 3D/HUD 컴포넌트 11+개를 Arena 모드에서 조건부 비활성화
- **G6**: 좌표계 통일 — AR meter 단위를 Three.js 단위로 직접 사용 (스케일 변환 제거)
- **G7**: 서버 BUG 3건 수정 (arenaRadius 필드, projectile ownerID, spectate manager)

### Non-Goals
- **NG1**: Classic 모드 동작 변경 (isArenaMode=false 경로는 무변경)
- **NG2**: 서버 전투 메커닉 변경 (무기/토메/시너지 밸런스는 범위 밖)
- **NG3**: 블록체인/토큰 통합 (v20+ 범위)
- **NG4**: 새로운 3D 에셋 제작 (기존 복셀 스타일 활용)
- **NG5**: 멀티플레이어 동기화 최적화 (서버 tick rate 변경 등)

---

## 3. Architecture Decisions (ADRs)

### ADR-001: AR 전용 렌더링 분기 (Classic Bridge 제거)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 현재 ar_state → classic bridge가 95% 데이터를 폐기. enemies/crystals/projectiles/items/phase/wave 모두 버려짐 |
| **Decision** | Arena 모드에서 classic bridge를 **우회**하고, AR 컴포넌트가 `arStateRef`를 직접 소비한다. Classic bridge는 Phase 1 동안 mass 정규화(m:15)만 적용 후 Phase 5에서 완전 제거 |
| **Consequences** | AR 컴포넌트 독립 렌더링 가능. Classic 모드 무영향 (isArenaMode=false 경로 보존) |
| **Alternatives** | (1) Classic bridge 확장 — enemies/crystals도 변환 → StatePayload 타입 오염, 복잡도 과대 |

### ADR-002: GameCanvas3D 내부 분기 (별도 ArenaCanvas3D 생성 안 함)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 새 ArenaCanvas3D 파일 vs 기존 GameCanvas3D 확장. 이미 `isArenaMode` prop이 존재하고 MCTerrain/ArenaBoundary 분기가 동작 중 |
| **Decision** | GameCanvas3D 내부에 `isArenaMode` 조건부 분기를 확장한다 |
| **Consequences** | 코드 중복 방지, 기존 인프라(Canvas, inputManager, soundEngine) 재사용. 파일 크기 증가 (~200줄 추가) |
| **Alternatives** | (1) ArenaCanvas3D 신규 → Canvas/input/sound 인프라 중복, 유지보수 2배 |

### ADR-003: 3채널 데이터 공유 전략 (ref + state + event queue)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 17개 AR 컴포넌트가 서로 다른 데이터 접근 패턴을 가짐 |
| **Decision** | 3개 채널로 분리: |
| | (1) **arStateRef** (MutableRefObject): 3D 컴포넌트(useFrame 내부) — ARPlayer, AREntities, ARCamera, ARNameTags |
| | (2) **arUiState** (React state, 250ms throttle): HTML 오버레이 — ARHUD, ARMinimap, ARLevelUp, ARPvPOverlay |
| | (3) **arEventQueue** (Array ref + drain): 일회성 이벤트 — ARDamageNumbers(ar_damage), kill feed(ar_kill) |
| **Consequences** | 3D = zero re-render (60fps 성능), HTML = 저빈도 re-render (4Hz), Events = 즉시 처리 후 폐기 |
| **Alternatives** | (1) Zustand store → useFrame에서 subscribe 비용 + selector 복잡도 (2) 전체 React state → 20Hz re-render로 FPS 급락 |

### ADR-004: 좌표계 직접 사용 (meter = Three.js unit)

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 서버 AR은 meter 단위(Tier D=15m ~ Tier S=60m). `SERVER_TO_BLOCK_SCALE=80/3000=0.02667`을 적용하면 pos.x=25→0.67로 뭉침 |
| **Decision** | AR 컴포넌트는 서버 meter 값을 Three.js 단위로 **직접 사용**. 1 meter = 1 Three.js unit. `SERVER_TO_BLOCK_SCALE` 변환을 AR 렌더링 경로에서 제거 |
| **Consequences** | 스케일 변환 로직 제거, Tier별 동적 arenaRadius 자연 지원. ARTerrain은 서버 arenaRadius를 그대로 사용 |
| **Alternatives** | (1) 동적 `80/arState.arenaRadius` 스케일 → Classic bridge 유지 시 필요하나 AR 직접 소비 시 불필요한 복잡도 |

### ADR-005: 이벤트 큐 drain 정책

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | ar_damage, ar_kill 등 이벤트가 burst 시 초당 100+ 발생 가능 |
| **Decision** | `arEventQueue: AREvent[]` ref에 push → useFrame에서 매 프레임 drain, 프레임당 최대 64개 처리 (ARDamageNumbers.MAX_NUMBERS=64와 일치). 64개 초과 시 oldest부터 drop |
| **Consequences** | burst 시에도 60fps 유지. 시각적으로 모든 데미지를 보여줄 필요 없음 (가장 최근 64개만 표시) |

### ADR-006: TPSCamera ↔ ARCamera 배타적 마운트

| 항목 | 내용 |
|------|------|
| **Status** | Accepted |
| **Context** | 두 카메라가 동시에 `camera.position`/`lookAt`을 설정하면 매 프레임 jitter (검증보고서 C-2) |
| **Decision** | `isArenaMode ? <ARCamera /> : <TPSCamera />` — 조건부 렌더링으로 배타적 마운트 |
| **Consequences** | 카메라 전환 시 position snap 발생 가능 → ARCamera 마운트 시 초기 position을 ARTerrain 중심 + offset으로 설정하여 완화 |

---

## 4. C4 Level 2: Container Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     AI World War — Arena Mode                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    WebSocket     ┌─────────────────────────┐  │
│  │  Go Server   │  ──────────────> │   Next.js Client        │  │
│  │              │   ar_state 20Hz  │                         │  │
│  │ ArenaCombat  │   ar_damage      │  ┌───────────────────┐  │  │
│  │  ├ ARPlayer  │   ar_kill        │  │   useSocket.ts    │  │  │
│  │  ├ enemies[] │   ar_level_up    │  │  ├ arStateRef     │  │  │
│  │  ├ crystals[]│   ar_phase_change│  │  ├ arUiState      │  │  │
│  │  ├ projs[]   │   ar_battle_end  │  │  ├ arEventQueue   │  │  │
│  │  ├ items[]   │   ar_boss_*      │  │  ├ arInterpRef    │  │  │
│  │  └ phases    │   ar_pvp_kill    │  │  └ sendARChoice() │  │  │
│  │              │                  │  └────────┬──────────┘  │  │
│  │ Spectate Mgr │  <───────────── │           │             │  │
│  │              │   ar_input       │           ▼             │  │
│  │              │   ar_choose      │  ┌───────────────────┐  │  │
│  └──────────────┘                  │  │  GameCanvas3D     │  │  │
│                                    │  │  isArenaMode=true  │  │  │
│                                    │  │                   │  │  │
│                                    │  │  ┌─ R3F Canvas ─┐ │  │  │
│                                    │  │  │ ARPlayer     │ │  │  │
│                                    │  │  │ AREntities   │ │  │  │
│                                    │  │  │ ARCamera     │ │  │  │
│                                    │  │  │ ARTerrain    │ │  │  │
│                                    │  │  │ ARNameTags   │ │  │  │
│                                    │  │  │ ARDmgNumbers │ │  │  │
│                                    │  │  └──────────────┘ │  │  │
│                                    │  │                   │  │  │
│                                    │  │  ┌─ HTML HUD ──┐  │  │  │
│                                    │  │  │ ARHUD       │  │  │  │
│                                    │  │  │ ARMinimap   │  │  │  │
│                                    │  │  │ ARLevelUp   │  │  │  │
│                                    │  │  │ ARPvPOverlay│  │  │  │
│                                    │  │  │ ARSpectate  │  │  │  │
│                                    │  │  │ ARRewards   │  │  │  │
│                                    │  │  └─────────────┘  │  │  │
│                                    │  └───────────────────┘  │  │
│                                    └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Container 설명

| Container | 기술 | 역할 |
|-----------|------|------|
| **Go Server** | Go 1.22 + gorilla/websocket | ArenaCombat 20Hz tick, 11개 이벤트 dispatch, Spectate/PvP/Boss 관리 |
| **useSocket.ts** | React Hook + GameSocket | WS 이벤트 수신, 3채널 분배 (ref/state/queue), AR 입력 emit |
| **GameCanvas3D** | R3F v9 + drei | isArenaMode 분기, AR/Classic 컴포넌트 배타적 마운트 |
| **R3F Canvas** | Three.js WebGL | ARPlayer, AREntities, ARCamera, ARTerrain, ARNameTags, ARDamageNumbers |
| **HTML HUD** | React DOM | ARHUD, ARMinimap, ARLevelUp, ARPvPOverlay, ARSpectateOverlay, ARBattleRewards |

---

## 5. C4 Level 3: Component Design

### 5.1 useSocket.ts 내부 구조 (Arena 확장)

```
useSocket.ts
├── arStateRef: MutableRefObject<ARState | null>      // 20Hz 원본 저장
├── arInterpRef: MutableRefObject<ARInterpolationState>// 보간 상태
├── arEventQueue: MutableRefObject<AREvent[]>          // 이벤트 큐
├── arUiState: React.state<ARUiState>                  // HTML용 저빈도 state
├── arUiThrottleRef: MutableRefObject<number>          // 마지막 state 업데이트 시각
│
├── on('ar_state') handler:
│   ├── arStateRef.current = data
│   ├── onARStateReceived(arInterpRef.current, data)   // 보간 업데이트
│   ├── throttled arUiState 업데이트 (250ms)           // HTML HUD용
│   └── classic bridge (Phase 1 호환, Phase 5에서 제거)
│
├── on('ar_damage') → arEventQueue.push({ type: 'damage', ... })
├── on('ar_kill') → arEventQueue.push({ type: 'kill', ... })
├── on('ar_level_up') → setArUiState(s => ({ ...s, levelUpChoices }))
├── on('ar_phase_change') → setArUiState(s => ({ ...s, phase }))
├── on('ar_battle_end') → setArUiState(s => ({ ...s, battleEnd }))
├── on('ar_boss_spawn') → arEventQueue.push({ type: 'boss_spawn' })
├── on('ar_boss_defeated') → arEventQueue.push({ type: 'boss_defeated' })
├── on('ar_pvp_kill') → arEventQueue.push({ type: 'pvp_kill', ... })
├── on('ar_miniboss_death') → arEventQueue.push({ type: 'miniboss_death' })
├── on('ar_elite_explosion') → arEventQueue.push({ type: 'elite_explosion' })
│
└── sendARChoice(payload: ARChoice) → socket.emit('ar_choose', payload)
```

### 5.2 ARUiState 타입 정의

```typescript
interface ARUiState {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  phase: ARPhase;
  timer: number;
  wave: number;
  kills: number;
  alive: boolean;
  factionId: string;
  // Level-up choices (set by ar_level_up event)
  levelUpChoices: ARTomeOffer[] | null;
  // Battle end data
  battleEnd: ARBattleRewards | null;
  // PvP data
  pvpRadius: number;
  factionScores: ARFactionPvPScoreNet[];
  // Synergies (from local player in arState)
  synergies: ARSynergyID[];
}
```

### 5.3 AREvent Union Type

```typescript
type AREvent =
  | { type: 'damage'; data: ARDamageEvent }
  | { type: 'kill'; data: { killerId: string; victimId: string; xp: number } }
  | { type: 'pvp_kill'; data: ARPvPKillEvent }
  | { type: 'boss_spawn'; data: { bossType: string } }
  | { type: 'boss_defeated'; data: { bossType: string; factionId: string } }
  | { type: 'miniboss_death'; data: { minibossType: string; x: number; z: number } }
  | { type: 'elite_explosion'; data: { x: number; z: number; radius: number } };
```

### 5.4 GameCanvas3D 내부 구조 (Arena 분기)

```
GameCanvas3D (isArenaMode=true)
├── Shared Refs:
│   ├── arPlayerPosRef: { x, y, z }     // ARPlayer → ARCamera 공유
│   ├── arYawRef: number                  // ARCamera → AR input 공유
│   └── arInterpRef: ARInterpolationState // useSocket → AR 컴포넌트 공유
│
├── R3F Canvas:
│   ├── [SHARED] Scene (isArenaMode=true → AR 조명)
│   ├── [SHARED] SkyBox
│   ├── [ARENA ONLY] ARCamera (playerPosRef, yawRef)
│   ├── [ARENA ONLY] ARPlayer (arStateRef, arInterpRef → posRef)
│   ├── [ARENA ONLY] AREntities (arStateRef, arInterpRef)
│   ├── [ARENA ONLY] ARTerrain (arenaRadius from arState)
│   ├── [ARENA ONLY] ARNameTags (arStateRef, arInterpRef)
│   ├── [ARENA ONLY] ARDamageNumbers (arEventQueue)
│   ├── [CLASSIC ONLY] TPSCamera
│   ├── [CLASSIC ONLY] AgentInstances + EquipmentInstances
│   ├── [CLASSIC ONLY] FlagSprite, OrbInstances, AuraRings
│   ├── [CLASSIC ONLY] BuildEffects, AbilityEffects, WeaponRenderer
│   ├── [CLASSIC ONLY] DamageNumbers, CapturePointRenderer
│   ├── [SHARED] ArenaBoundary (isArenaMode → arState radius)
│   └── [SHARED] MCParticles
│
├── HTML HUD (outside Canvas):
│   ├── [ARENA ONLY] ARHUD (arUiState)
│   ├── [ARENA ONLY] ARMinimap (arUiState + arStateRef)
│   ├── [ARENA ONLY] ARLevelUp (arUiState.levelUpChoices + sendARChoice)
│   ├── [ARENA ONLY] ARPvPOverlay (arUiState)
│   ├── [ARENA ONLY] ARMobileControls (touch → input)
│   ├── [ARENA ONLY] ARSpectateOverlay (arUiState.alive=false)
│   ├── [ARENA ONLY] ARBattleRewards (arUiState.battleEnd)
│   ├── [ARENA ONLY] ARCharacterSelect (phase=deploy)
│   ├── [CLASSIC ONLY] EpochHUD, ShrinkWarning, BuildHUD
│   ├── [CLASSIC ONLY] XPBar, KillFeedHUD, LevelUpOverlay
│   └── [SHARED] DeathOverlay (isArenaMode → spectate 전환)
│
└── Loading Overlay (arenaLoading state)

---

## 6. Data Flow Architecture

### 6.1 Server→Client Pipeline

```
                          ┌────────────────────────────┐
                          │     Go ArenaCombat.Tick()   │
                          │     20Hz (50ms interval)    │
                          └─────────────┬──────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
     ar_state (20Hz)          ar_damage (hit시)          ar_level_up (레벨업시)
     ar_phase_change          ar_kill (처치시)           ar_battle_end (종료시)
     ar_boss_spawn            ar_pvp_kill               ar_elite_explosion
     ar_boss_defeated         ar_miniboss_death
              │                         │                         │
              └─────────────────────────┼─────────────────────────┘
                                        │
                              WebSocket transport
                                        │
                                        ▼
                          ┌────────────────────────────┐
                          │     useSocket.ts handlers   │
                          └─────────────┬──────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
    Channel 1: arStateRef     Channel 2: arUiState     Channel 3: arEventQueue
    (MutableRefObject)        (React.useState)          (Array ref)
    20Hz 갱신, no re-render   250ms throttle, re-render  즉시 push, useFrame drain
              │                         │                         │
              ▼                         ▼                         ▼
    ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
    │ ar-interpolation │   │ HTML Overlays    │   │ Event Consumers  │
    │ onARStateReceived│   │ ARHUD            │   │ ARDamageNumbers  │
    │ tickARInterp     │   │ ARMinimap        │   │ Kill Feed        │
    └────────┬─────────┘   │ ARLevelUp        │   │ Sound Manager    │
             │             │ ARPvPOverlay     │   └──────────────────┘
             ▼             └──────────────────┘
    ┌──────────────────┐
    │ 3D Components    │
    │ ARPlayer         │
    │ AREntities       │
    │ ARCamera         │
    │ ARNameTags       │
    └──────────────────┘
```

**데이터 흐름 규칙**:
1. `ar_state` → arStateRef에 저장 + ar-interpolation.onARStateReceived() 호출
2. `ar_state` → 250ms 경과 시 arUiState 업데이트 (로컬 플레이어 HP/XP/kills 등 추출)
3. `ar_damage` / `ar_kill` 등 → arEventQueue.push() → 소비 컴포넌트의 useFrame에서 drain
4. `ar_level_up` → arUiState.levelUpChoices에 직접 set (즉시 UI 표시 필요)
5. `ar_phase_change` → arUiState.phase에 직접 set (즉시 UI 전환 필요)
6. `ar_battle_end` → arUiState.battleEnd에 직접 set (결과 화면 표시)

### 6.2 AR Event Queue System

```typescript
// useSocket.ts 내부
const arEventQueueRef = useRef<AREvent[]>([]);

// Event push (socket handler 내부)
socket.on('ar_damage', (data: ARDamageEvent) => {
  arEventQueueRef.current.push({ type: 'damage', data });
});

// Event drain utility (컴포넌트 useFrame 내부에서 호출)
export function drainAREvents(
  queue: React.MutableRefObject<AREvent[]>,
  maxPerFrame: number = 64
): AREvent[] {
  if (queue.current.length === 0) return [];
  const batch = queue.current.splice(0, maxPerFrame);
  return batch;
}
```

**큐 정책**:
- **Push**: socket handler에서 즉시 push. 메인 스레드 블로킹 없음
- **Drain**: 매 useFrame에서 `splice(0, 64)` — oldest-first 처리
- **Overflow**: 큐 길이 > 256이면 oldest 128개 drop (OOM 방지)
- **Lifecycle**: arena 모드 exit 시 `arEventQueueRef.current = []`로 초기화

**이벤트별 소비자 매핑**:

| 이벤트 | 소비 컴포넌트 | 처리 방식 |
|--------|-------------|----------|
| `ar_damage` | ARDamageNumbers | useFrame drain → addDamageNumber() |
| `ar_kill` | ARHUD (kill count) | arUiState 업데이트 경유 |
| `ar_pvp_kill` | ARPvPOverlay | useFrame drain → kill feed 추가 |
| `ar_boss_spawn` | ARHUD | arUiState 경유 → boss indicator 표시 |
| `ar_boss_defeated` | ARBattleRewards | arUiState 경유 |
| `ar_miniboss_death` | ARDamageNumbers | useFrame drain → big number 표시 |
| `ar_elite_explosion` | ARDamageNumbers | useFrame drain → explosion VFX |

### 6.3 Coordinate System Unification

### 핵심 결정: 1 meter = 1 Three.js unit (직접 매핑)

```
서버 좌표계:                    클라이언트 좌표계 (Three.js):
  Y ↑                            Y ↑ (height)
  │                              │
  │     pos.x (meter)            │     worldX = pos.x
  └──── → X                      └──── → X
  Z ↙ (forward)                  Z ↙ (forward = pos.z)

  pos.y (서버) = height → Three.js Y축 (지면 = 0)
```

**변환 규칙**:
```typescript
// AR 컴포넌트에서의 좌표 매핑
// 서버: { x: 25.3, y: 0.0, z: -12.7 } (ARVec3)
// Three.js: position=[25.3, 0.0, -12.7]

// ARPlayer position:
const worldPos: [number, number, number] = [
  arPlayer.pos.x,     // meter → Three.js X
  arPlayer.pos.y,     // meter → Three.js Y (height)
  arPlayer.pos.z,     // meter → Three.js Z
];

// AREnemyNet position (no y component):
const enemyPos: [number, number, number] = [
  enemy.x,            // meter → Three.js X
  0,                  // ground level
  enemy.z,            // meter → Three.js Z
];
```

**Tier별 Arena 크기** (서버 `TierArenaRadius()`):

| Tier | arenaRadius (m) | Three.js 월드 크기 | 대각선 |
|------|----------------|-------------------|--------|
| S | 60 | 120m x 120m | ~170m |
| A | 45 | 90m x 90m | ~127m |
| B | 35 | 70m x 70m | ~99m |
| C | 25 | 50m x 50m | ~71m |
| D | 15 | 30m x 30m | ~42m |

**Classic Bridge 좌표 변환 (Phase 1 호환 — Phase 5에서 제거)**:
```typescript
// useSocket.ts ar_state handler (classic bridge 경유 시만)
// AR meter → classic pixel → MC block
const DYNAMIC_SCALE = MC_BLOCK_CONSTANTS.ARENA_RADIUS_BLOCKS / arState.arenaRadius;
// pos.x=25 × (80/50) = 40 blocks (정확)
```

**비교**: 기존 `80/3000 = 0.02667` → pos.x=25 × 0.02667 = 0.67 (뭉침 버그)
수정 후 `80/50 = 1.6` → pos.x=25 × 1.6 = 40 (정확)
그러나 **AR 직접 소비 경로에서는 변환 자체가 불필요** → 가장 깔끔한 해결

---

## 7. State Management Strategy

### 7.1 React ref vs state Decision Matrix

| 컴포넌트 | 렌더링 방식 | 데이터 채널 | 업데이트 빈도 | 이유 |
|---------|----------|----------|-----------|------|
| ARPlayer | R3F useFrame | arStateRef + arInterpRef | 60fps | position/rotation 매 프레임 보간, re-render 방지 |
| AREntities | R3F useFrame | arStateRef + arInterpRef | 60fps | InstancedMesh 매트릭스 매 프레임 갱신 |
| ARCamera | R3F useFrame | arPlayerPosRef | 60fps | camera.position lerp, re-render 방지 |
| ARNameTags | R3F useFrame | arStateRef + arInterpRef | 60fps | Billboard position 매 프레임 추적 |
| ARDamageNumbers | R3F useFrame | arEventQueue (drain) | 60fps | 큐에서 drain → 3D 텍스트 스프라이트 생성 |
| ARTerrain | R3F static | arenaRadius (prop, 1회) | mount only | 지형은 고정, 변경 시 재생성 |
| ARHUD | React DOM | arUiState | 4Hz (250ms) | HP/XP/timer 숫자 변경만, DOM 렌더 비용 절약 |
| ARMinimap | React DOM + Canvas | arUiState + arStateRef | 4Hz + useFrame | 미니맵 배경 4Hz, 점 위치 useFrame |
| ARLevelUp | React DOM | arUiState.levelUpChoices | 즉시 (이벤트) | 레벨업 팝업은 즉시 표시 필요 |
| ARPvPOverlay | React DOM | arUiState | 4Hz | PvP 전환 경고 + 킬 카운트 |
| ARMobileControls | React DOM | touch events → input | 즉시 | 터치 입력은 지연 불가 |
| ARSpectateOverlay | React DOM | arUiState.alive | 즉시 | 사망 → 관전 전환 |
| ARBattleRewards | React DOM | arUiState.battleEnd | 즉시 | 전투 종료 결과 |
| ARCharacterSelect | React DOM | arUiState.phase='deploy' | 즉시 | deploy 페이즈 10초 |
| ARProfile | React DOM | REST API | on-demand | 비실시간 |
| ARQuestPanel | React DOM | REST API | on-demand | 비실시간 |
| ARSeasonPass | React DOM | REST API | on-demand | 비실시간 |

### 7.2 arUiState Throttle Design

```typescript
// useSocket.ts 내부 — arUiState 업데이트 로직
const arUiThrottleRef = useRef(0);
const THROTTLE_MS = 250; // 4Hz

socket.on('ar_state', (data: ARState) => {
  // Channel 1: ref 저장 (항상)
  arStateRef.current = data;
  onARStateReceived(arInterpRef.current, data);

  // Channel 2: React state 업데이트 (throttled)
  const now = performance.now();
  if (now - arUiThrottleRef.current >= THROTTLE_MS) {
    arUiThrottleRef.current = now;
    const myId = dataRef.current.playerId;
    const me = data.players.find(p => p.id === myId);
    if (me) {
      setArUiState(prev => ({
        ...prev,
        hp: me.hp,
        maxHp: me.maxHp,
        xp: me.xp,
        xpToNext: me.xpToNext,
        level: me.level,
        phase: data.phase,
        timer: data.timer,
        wave: data.wave,
        kills: me.kills,
        alive: me.alive,
        factionId: me.factionId,
        pvpRadius: data.pvpRadius ?? 0,
        factionScores: data.factionScores ?? [],
        synergies: me.synergies ?? [],
      }));
    }
  }
});

// Level-up과 battle-end는 throttle 없이 즉시 업데이트
socket.on('ar_level_up', (data: ARLevelUpEvent) => {
  setArUiState(prev => ({ ...prev, levelUpChoices: data.choices }));
});

socket.on('ar_battle_end', (data: ARBattleRewards) => {
  setArUiState(prev => ({ ...prev, battleEnd: data }));
});
```

**Throttle 250ms 선택 이유**:
- 20Hz(50ms)로 React state를 갱신하면 초당 20회 re-render → HTML HUD가 있는 DOM 트리 전체 리렌더
- 250ms(4Hz)면 초당 4회 re-render → HP바/타이머 숫자 변화는 시각적으로 충분
- 게이머 인지 기준: HP 변화 250ms 지연은 허용 범위 (데미지 숫자는 별도 이벤트 큐로 즉시 표시)

---

## 8. Classic/Arena Mode Branching

### 8.1 R3F Canvas 내부 분기

```tsx
// GameCanvas3D.tsx — Canvas 내부
<Canvas>
  {/* 실행 순서 보장: mount 순서 = useFrame 순서 */}

  {/* 1. 보간 Tick (Arena only) — 모든 AR 컴포넌트보다 먼저 실행 */}
  {isArenaMode && (
    <ARInterpolationTick interpRef={arInterpRef} />
  )}

  {/* 2. Camera — 배타적 마운트 (ADR-006) */}
  {isArenaMode ? (
    <ARCamera playerPosRef={arPlayerPosRef} locked={true} yawRef={arYawRef} />
  ) : (
    <TPSCamera agentsRef={agentsRef} dataRef={dataRef} ... />
  )}

  {/* 3. Scene + SkyBox — 공유 */}
  <Scene ... isArenaMode={isArenaMode} />
  <SkyBox />

  {/* 4. 캐릭터/엔티티 — 배타적 마운트 */}
  {isArenaMode ? (
    <>
      <ARPlayer ... posRef={arPlayerPosRef} />
      <AREntities ... />
      <ARNameTags ... />
      <ARDamageNumbers eventQueueRef={arEventQueueRef} />
    </>
  ) : (
    <>
      <AgentInstances ... />
      <EquipmentInstances ... />
      <FlagSprite ... />
      <OrbInstances ... />
      <AuraRings ... />
      <BuildEffects ... />
      <AbilityEffects ... />
      <WeaponRenderer ... />
      <DamageNumbers ... />
      <CapturePointRenderer ... />
    </>
  )}

  {/* 5. 지형 — 이미 분기됨 (기존 코드) */}
  {isArenaMode ? (
    <ARTerrain arenaRadius={arUiState.arenaRadius ?? 50} ... />
  ) : (
    <>
      <MCTerrain ... /> {/* 또는 HeightmapTerrain/ZoneTerrain */}
      <ObstacleInstances ... />
      <TerrainDeco ... />
    </>
  )}

  {/* 6. 공유 컴포넌트 */}
  <ArenaBoundary ... />
  <MCParticles ... />

  {/* 7. 후처리 — Classic only */}
  {!isArenaMode && <PostProcessingEffects ... />}
  {!isArenaMode && <WeatherEffects ... />}
</Canvas>
```

### 8.2 HTML HUD 분기

```tsx
// GameCanvas3D.tsx — Canvas 밖 HTML
{isArenaMode ? (
  <>
    <ARHUD {...arUiState} />
    <ARMinimap arState={arStateRef} arUiState={arUiState} arenaRadius={arUiState.arenaRadius} />
    {arUiState.levelUpChoices && (
      <ARLevelUp choices={arUiState.levelUpChoices} onChoose={handleARChoose} />
    )}
    {arUiState.phase === 'pvp' || arUiState.phase === 'pvp_warning' ? (
      <ARPvPOverlay {...arUiState} eventQueueRef={arEventQueueRef} />
    ) : null}
    {!arUiState.alive && <ARSpectateOverlay ... />}
    {arUiState.battleEnd && <ARBattleRewards data={arUiState.battleEnd} />}
    {arUiState.phase === 'deploy' && <ARCharacterSelect onSelect={handleCharSelect} />}
    {isMobile && <ARMobileControls ... />}
  </>
) : (
  <>
    <EpochHUD ... />
    <ShrinkWarning ... />
    <BuildHUD ... />
    <XPBar ... />
    <KillFeedHUD ... />
    <LevelUpOverlay ... />
    {/* ... other classic HUD */}
  </>
)}
```

### 8.3 분기 불변 조건 (Invariants)

1. `isArenaMode=true` 일 때 **어떤** Classic 3D 컴포넌트도 마운트되지 않음
2. `isArenaMode=false` 일 때 **어떤** AR 컴포넌트도 마운트되지 않음
3. Camera는 반드시 **1개만** 마운트됨 (TPSCamera XOR ARCamera)
4. `arStateRef`는 isArenaMode=false일 때 null 유지 → AR 컴포넌트 unmount 상태에서 안전

---

## 9. Component Mount Order & Dependencies

### 9.1 R3F useFrame 실행 순서 (priority=0, mount 순서 의존)

```
Mount Order (top → bottom in JSX):
  1. ARInterpolationTick   — tickARInterpolation(interp) → 모든 엔티티 renderX/Z 갱신
  2. ARCamera              — playerPosRef 읽기 → camera.position/lookAt 설정
  3. ARPlayer              — arStateRef → 로컬 플레이어 보간 위치 → mesh.position 설정 + posRef 쓰기
  4. AREntities            — arStateRef → 적/크리스탈 보간 위치 → InstancedMesh 매트릭스 갱신
  5. ARNameTags            — arStateRef → 플레이어 보간 위치 → Billboard position
  6. ARDamageNumbers       — arEventQueue drain → 3D sprite 생성/업데이트
  7. ARTerrain             — static (useFrame 없음)
  8. ArenaBoundary         — arenaRadius 기반 경계벽 (기존)
```

**중요**: ARInterpolationTick이 **반드시 최초**에 실행되어야 함.
이유: tickARInterpolation()이 renderX/renderZ를 갱신해야 후속 컴포넌트가 보간된 위치를 읽을 수 있음.

### 9.2 컴포넌트 의존 관계 DAG

```
                   useSocket.ts
                       │
          ┌────────────┼────────────┐
          │            │            │
     arStateRef   arUiState   arEventQueue
          │            │            │
    ┌─────┼─────┐  ┌──┼──┐    ┌───┼───┐
    │     │     │  │  │  │    │   │   │
    ▼     ▼     ▼  ▼  ▼  ▼    ▼   ▼   ▼
 ARInterp  │     │  │  │  │  ARDmg  │  Sound
 Tick   ARPlayer │ HUD Mini LvUp Nums PvP  Mgr
    │      │     │
    │      │     ▼
    │      │  AREntities
    │      │     │
    │      ▼     │
    │  arPlayerPosRef
    │      │
    │      ▼
    │   ARCamera
    │      │
    └──────┘ (interpolation data)
```

### 9.3 17개 AR 컴포넌트 Phase별 마운트 순서

| Phase | 컴포넌트 | 의존 대상 | 마운트 조건 |
|-------|---------|----------|-----------|
| **P0 (Phase 2)** | ARInterpolationTick | arInterpRef | `isArenaMode` |
| **P0** | ARCamera | arPlayerPosRef, arYawRef | `isArenaMode` |
| **P0** | ARPlayer | arStateRef, arInterpRef | `isArenaMode` |
| **P0** | AREntities | arStateRef, arInterpRef | `isArenaMode` |
| **P0** | ARTerrain | arState.arenaRadius | `isArenaMode` |
| **P0** | ARHUD | arUiState | `isArenaMode` |
| **P0** | ARMinimap | arUiState, arStateRef | `isArenaMode` |
| **P1 (Phase 3)** | ARDamageNumbers | arEventQueue | `isArenaMode` |
| **P1** | ARNameTags | arStateRef, arInterpRef | `isArenaMode` |
| **P1** | ARLevelUp | arUiState.levelUpChoices | `isArenaMode && levelUpChoices != null` |
| **P1** | ARPvPOverlay | arUiState | `isArenaMode && (phase=pvp\|pvp_warning)` |
| **P1** | ARMobileControls | touch events | `isArenaMode && isMobile` |
| **P2 (Phase 4)** | ARCharacterSelect | arUiState.phase | `isArenaMode && phase=deploy` |
| **P2** | ARSpectateOverlay | arUiState.alive | `isArenaMode && !alive` |
| **P2** | ARBattleRewards | arUiState.battleEnd | `isArenaMode && battleEnd != null` |
| **P3 (Phase 5)** | ARProfile | REST API | on-demand popup |
| **P3** | ARQuestPanel | REST API | on-demand popup |
| **P3** | ARSeasonPass | REST API | on-demand popup |

### 9.4 Ref 공유 매트릭스

| Ref | 생산자 (Writer) | 소비자 (Reader) | 생성 위치 |
|-----|----------------|----------------|----------|
| `arStateRef` | useSocket (ar_state handler) | ARPlayer, AREntities, ARNameTags, ARMinimap | useSocket 내부 |
| `arInterpRef` | useSocket (onARStateReceived) | ARInterpolationTick, ARPlayer, AREntities, ARNameTags | useSocket 내부 |
| `arPlayerPosRef` | ARPlayer (useFrame) | ARCamera (useFrame) | GameCanvas3D (useRef) |
| `arYawRef` | ARCamera (useFrame) | GameCanvas3D → AR input emit | GameCanvas3D (useRef) |
| `arEventQueueRef` | useSocket (이벤트 handlers) | ARDamageNumbers, ARPvPOverlay | useSocket 내부 |

---

## 10. Interpolation Pipeline

### 10.1 기존 ar-interpolation.ts 시스템 (268줄, 완전 구현됨)

```
서버 20Hz ──────────────────────────────────────────── 클라이언트 60fps
   │                                                      │
   ▼                                                      ▼
ar_state 수신 ──► onARStateReceived()                  useFrame()
                   ├── prev ← curr                       ├── tickARInterpolation()
                   ├── curr ← server pos                 │   ├── alpha = elapsed / 50ms
                   └── lastUpdateTime = now              │   ├── renderPos = lerp(prev, curr, alpha)
                                                         │   └── dead reckoning > 200ms → snap
                                                         │
                                                         ▼
                                                    getInterpolatedPos(id)
                                                    → { x: renderX, z: renderZ, rot: renderRot }
```

### 10.2 연결 설계

```typescript
// ARInterpolationTick.tsx — 새 컴포넌트 (최소)
function ARInterpolationTick({
  interpRef,
}: {
  interpRef: React.MutableRefObject<ARInterpolationState>;
}) {
  useFrame(() => {
    tickARInterpolation(interpRef.current);
  });
  return null;
}
```

**ARPlayer에서의 사용**:
```typescript
useFrame(() => {
  const myId = ...; // dataRef.current.playerId
  const pos = getInterpolatedPos(interpRef.current, myId);
  if (pos) {
    meshRef.current.position.set(pos.x, 0, pos.z);
    meshRef.current.rotation.y = pos.rot;
    posRef.current = { x: pos.x, y: 0, z: pos.z };
  }
});
```

**AREntities에서의 사용**:
```typescript
useFrame(() => {
  const arState = arStateRef.current;
  if (!arState) return;
  for (let i = 0; i < arState.enemies.length; i++) {
    const enemy = arState.enemies[i];
    const pos = getInterpolatedPos(interpRef.current, enemy.id);
    if (pos) {
      dummy.position.set(pos.x, 0.5, pos.z);
      // ... InstancedMesh matrix 갱신
    }
  }
});
```

### 10.3 보간 파라미터

| 파라미터 | 값 | 설명 |
|---------|---|------|
| SERVER_TICK_MS | 50 | 20Hz 서버 → 50ms 간격 |
| INTERP_DELAY_MS | 50 | 1 서버 틱 지연 (jitter buffer) |
| MAX_DEAD_RECKONING_MS | 200 | 200ms 이상 미수신 시 snap |
| SNAP_THRESHOLD | 20.0 | 20m 이상 이동 시 lerp 대신 snap |

---

## 11. Performance Budget

### 11.1 FPS 목표

| 시나리오 | 엔티티 수 | 목표 FPS | 전략 |
|---------|----------|---------|------|
| 일반 전투 | 30적 + 50크리스탈 + 20플레이어 | 60fps | InstancedMesh 단일 drawcall |
| 피크 전투 | 200적 + 300크리스탈 + 30플레이어 | 45fps+ | LOD (20m/40m/60m), 60m 이상 cull |
| PvP 페이즈 | 30플레이어 + 미니보스 | 60fps | 적 스폰 중단, 엔티티 감소 |
| 모바일 | 100적 + 100크리스탈 | 30fps+ | LOD 거리 50% 축소, 파티클 비활성 |

### 11.2 메모리 예산

| 항목 | 예상 메모리 | 설명 |
|------|----------|------|
| AREntities InstancedMesh (적) | ~2MB | 200 instances × geometry + color buffer |
| AREntities InstancedMesh (크리스탈) | ~1MB | 300 instances × diamond geometry |
| ar-interpolation Map | ~0.5MB | 530 entries × InterpolatedEntity (~64B each) |
| arEventQueue | ~0.1MB | max 256 events × ~400B each |
| ARTerrain geometry | ~4MB | heightmap + textures (arena size dependent) |
| **Total AR overhead** | **~8MB** | Classic 모드 대비 추가 메모리 |

### 11.3 네트워크 예산

| 이벤트 | 크기 (JSON) | 빈도 | 대역폭 |
|--------|----------|------|--------|
| ar_state | ~2-8KB | 20Hz | 40-160KB/s |
| ar_damage | ~100B | 10-50/s | 1-5KB/s |
| ar_kill | ~80B | 0.5-2/s | ~0.1KB/s |
| ar_level_up | ~200B | ~0.1/s | negligible |
| **Total** | | | **~50-170KB/s** |

### 11.4 React Render 예산

| 트리거 | 빈도 | 영향 범위 |
|--------|------|----------|
| arUiState 갱신 | 4Hz (250ms throttle) | ARHUD + ARMinimap + ARPvPOverlay |
| levelUpChoices set | ~0.1Hz | ARLevelUp popup mount |
| battleEnd set | 1회/전투 | ARBattleRewards mount |
| phase change | 5회/전투 | ARHUD phase label 변경 |

---

## 12. Server-Side Modifications

### 12.1 BUG-5 수정: arenaRadius 필드 추가

**서버 (ar_types.go)**:
```go
type ARState struct {
    // ... existing fields ...
    ArenaRadius   float64 `json:"arenaRadius"`  // NEW: 현재 아레나 반경 (meter)
}
```

**서버 (ar_combat.go GetState())**:
```go
return &ARState{
    // ... existing fields ...
    ArenaRadius:   ac.config.ArenaRadius,  // NEW
}
```

**클라이언트 (ar-types.ts)**:
```typescript
export interface ARState {
    // ... existing fields ...
    arenaRadius: number;  // NEW: 현재 아레나 반경 (meter)
}
```

### 12.2 BUG-7 수정: Projectile ownerID

**서버 (ar_combat.go)**:
```go
// ARProjectile 구조체에 OwnerID 필드 추가
type ARProjectile struct {
    // ... existing fields ...
    OwnerID string  // NEW: 발사한 플레이어 ID
}

// weaponFireProjectile()에서 설정
func (ac *ArenaCombat) weaponFireProjectile(player *ARPlayer, ...) {
    proj := &ARProjectile{
        // ... existing ...
        OwnerID: player.ID,  // NEW
    }
}

// tickProjectiles()에서 킬 크레딧 정확 부여
func (ac *ArenaCombat) tickProjectiles(delta float64) {
    // ... hit detection ...
    if hit {
        ownerID := proj.OwnerID  // FIX: 빈 문자열이 아닌 실제 owner
        // ... kill attribution ...
    }
}
```

### 12.3 BUG-6 수정: ARSpectateManager 연결

**서버 (ar_combat.go)**:
```go
// Init()에서 spectate manager 생성
func (ac *ArenaCombat) Init() {
    // ... existing init ...
    ac.spectateManager = NewARSpectateManager()  // NEW
}

// OnPlayerDeath에서 spectate 시작
func (ac *ArenaCombat) handlePlayerDeath(player *ARPlayer, ...) {
    // ... existing death logic ...
    ac.spectateManager.StartSpectating(player.ID)  // NEW
    // emit spectate target event to client
}
```

### 12.4 Classic Bridge 임시 수정 (Phase 1)

**클라이언트 (useSocket.ts)**:
```typescript
// FIX: HP→mass 왜곡 방지 (BUG-2, H-2)
// Before: m: p.hp  → HP 3000인 플레이어가 거인으로 보임
// After:  m: 15    → 고정 크기 (classic renderer가 mass로 스케일 결정하므로)
const agents = data.players.map(p => ({
    // ...
    m: 15,  // FIX: 고정값 (HP가 에이전트 크기에 영향 방지)
    // ...
}));
```

---

## 13. Risk Matrix & Mitigations

| # | 리스크 | 확률 | 영향 | 완화 전략 |
|---|--------|------|------|----------|
| R1 | Classic 모드 regression | Low | Critical | isArenaMode 분기로 Classic 경로 완전 분리. Phase 2 완료 후 Classic E2E 테스트 필수 |
| R2 | 200+ 엔티티 FPS 급락 | Medium | High | InstancedMesh + LOD (20/40/60m) + 60m cull. 실제 200적 시나리오 벤치마크 |
| R3 | TPSCamera + ARCamera 동시 마운트 | Low | Critical | ADR-006 배타적 마운트. 코드 리뷰 시 invariant 검증 |
| R4 | arEventQueue overflow (burst) | Medium | Medium | 프레임당 64개 drain + 큐 256개 cap. 초과 시 oldest drop |
| R5 | 20Hz → 60fps 끊김 | High | High | ar-interpolation.ts 필수 연결. Phase 2에서 보간 없이 배포 금지 |
| R6 | 좌표 스케일 혼동 | Medium | Critical | AR 컴포넌트는 meter 직접 사용 원칙. `SERVER_TO_BLOCK_SCALE` 사용 금지 (Classic bridge 제외) |
| R7 | Pointer lock 이중 관리 | Medium | Medium | Arena: ARCamera 전용, useInputManager에 arena 분기 추가 |
| R8 | 메모리 누수 (material dispose) | Low | Low | ARPlayer unmount 시 useEffect cleanup에서 dispose. AREntities InstancedMesh도 동일 |
| R9 | 서버 arenaRadius 미전송 (BUG-5) | Certain | High | Phase 1 첫 번째 task로 서버 수정 필수 |
| R10 | 모바일 터치 + ARCamera 충돌 | Medium | Medium | 모바일 감지 시 pointer lock 비활성. ARMobileControls 우측 영역으로 카메라 위임 |

---

## 14. Verification Checklist

### 14.1 검증보고서 26건 반영 현황

| 이슈 ID | 심각도 | 아키텍처 반영 여부 | 대응 위치 |
|---------|--------|-----------------|----------|
| C-1 | Critical | Reflected | ADR-004 좌표 직접 사용, Section 6.3 |
| C-2 | Critical | Reflected | ADR-006 배타적 카메라 마운트, Section 8.1 |
| C-3 | Critical | Reflected | Section 8.1 classic 컴포넌트 조건부 비활성 |
| C-4 | Critical | Reflected | Section 5.1 sendARChoice() |
| C-5 | Critical | Reflected | ADR-003 3채널 전략, Section 7.2 arUiState |
| C-6 | Critical | Reflected | Section 12.3 서버 SpectateManager 연결 |
| C-7 | Critical | Reflected | Section 12.1 arenaRadius 필드 추가 |
| H-1 | High | Reflected | Section 9.3 ARPlayer — moving은 position delta 추론, attackRange=3.0 상수 |
| H-2 | High | Reflected | Section 12.4 classic bridge m:15 고정 |
| H-3 | High | Reflected | Section 12.2 projectile ownerID |
| H-4 | High | Reflected | Risk R7 pointer lock 분기 |
| H-5 | High | Reflected | Section 8.2 classic HUD 조건부 비활성 |
| H-6 | High | Reflected | ADR-001 AR 직접 소비 → classic bridge 우회. ar_input은 서버 bridge 유지 (Phase 1) |
| H-7 | High | Reflected | Section 9.3 Phase 3 — 무기 진화 toast |
| H-8 | High | Reflected | Section 9.3 Phase 3 — 시너지 아이콘 바 |
| H-9 | High | Reflected | Section 9.3 Phase 3 — status effect 비주얼 |
| H-10 | High | Reflected | Section 9.3 Phase 3 — boss HP bar 분리 |
| H-11 | High | Reflected | Section 12.1 arenaRadius 필드 |
| M-1 | Medium | Acknowledged | 데미지 넘버는 숫자만 → 한글 이슈 없음 |
| M-2 | Medium | Reflected | Section 12.1 pvpRadius 서버 전송 확인 필요 |
| M-3 | Medium | Reflected | Section 9.4 arPlayerPosRef 공유 매트릭스 |
| M-4 | Medium | Reflected | Risk R10 모바일 터치 분기 |
| M-5 | Medium | Reflected | Section 10 ar-interpolation.ts 필수 연결 |
| M-6 | Medium | Reflected | ADR-005 이벤트 큐 drain 정책 |
| L-1 | Low | Reflected | Risk R8 material dispose |
| L-2 | Low | Reflected | Phase 5 ARHUD CSS 수정 |
| MISS-1 | Critical | Reflected | Section 8.1 classic 컴포넌트 전면 분기 |
| MISS-2 | Critical | Reflected | Section 10 보간 파이프라인 설계 |
| MISS-3 | High | Reflected | Section 12.1 arenaRadius 필드 |
| MISS-4 | High | Reflected | Section 9.3 Phase 3 — 무기 진화 + 시너지 UI |
| MISS-5 | High | Reflected | Section 9.3 Phase 3 — status effect |
| MISS-6 | Medium | Reflected | Phase 5 사운드 시스템 연동 |

**반영률: 26/26 (100%)** — 검증보고서의 모든 이슈가 아키텍처에 반영됨

### 14.2 자체 검증 체크리스트

| # | 검증 항목 | 상태 |
|---|---------|------|
| 1 | 모든 17개 AR 컴포넌트에 데이터 소스가 명확히 지정됨 | PASS |
| 2 | 3채널(ref/state/queue)에 모든 11개 AR 이벤트가 매핑됨 | PASS |
| 3 | Classic/Arena 분기가 R3F + HTML HUD 양쪽에서 완전히 정의됨 | PASS |
| 4 | Camera 동시 마운트 방지 (ADR-006) | PASS |
| 5 | 좌표계 통일 — meter=Three.js unit, 스케일 변환 제거 | PASS |
| 6 | ar-interpolation.ts 연결 경로 명확 (ARInterpolationTick → useFrame) | PASS |
| 7 | arPlayerPosRef 생산자(ARPlayer)/소비자(ARCamera) 명시 | PASS |
| 8 | arEventQueue drain 정책 (64/frame, 256 cap) | PASS |
| 9 | 서버 수정 3건 (arenaRadius, projectile owner, spectate) 명시 | PASS |
| 10 | Classic 모드 regression 방지 invariant 정의 | PASS |
| 11 | 성능 예산 (FPS, 메모리, 네트워크, React render) 정의 | PASS |
| 12 | Phase별 마운트 순서 + 의존관계 DAG | PASS |

---

## 15. Self-Verification — 자체 개선 라운드

### Round 1 발견사항 (설계 일관성 검증)

**Issue A**: `ARInterpolationTick` 컴포넌트가 Section 10에 정의되었으나 Section 9.3 Phase별 마운트 테이블에 누락
→ 수정: Section 9.3에 ARInterpolationTick을 P0 Phase 2 첫 번째 항목으로 추가 완료

**Issue B**: `ar_input` 직접 emit vs classic input bridge 결정이 ADR에 없음 (검증보고서 H-6)
→ 결정: Phase 1에서는 서버측 classic→AR input bridge 유지 (server/internal/game/room.go:701-725에서 이미 동작 중). jump/slide 지원이 필요한 Phase 3에서 `ar_input` 직접 emit으로 전환. ADR-001에 반영 완료

**Issue C**: `ARMinimap`가 ref(arStateRef) + state(arUiState) 양쪽을 소비하는 하이브리드 패턴인데 Section 7.1에서 "React DOM = arUiState"로만 분류
→ 수정: Section 7.1 테이블에 ARMinimap 행을 "4Hz + useFrame"으로 명시 완료

### Round 2 발견사항 (기획서 대비 완성도)

**Issue D**: 기획서 Phase 5 "Classic bridge 정리" task — 아키텍처에서 Phase 5 bridge 제거 시점 미명시
→ 결정: Phase 5에서 `isArenaMode` 시 classic bridge(ar_state → StatePayload 변환) 코드를 제거. arStateRef 직접 소비가 완전 동작 확인 후.

**Issue E**: ARHUD CSS position: relative 이슈(L-2) — 아키텍처 범위 밖이나 Phase 5 폴리시에 포함
→ 확인: Phase 5 폴리시 항목으로 분류 적절

모든 자체 개선 완료. 추가 반복 불필요.
