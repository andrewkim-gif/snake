# [SYSTEM] V38 — Canvas 2D → Three.js 3D Voxel System Architecture

> **Project**: AI World War — 실시간 자동전투 서바이벌 로그라이크
> **Scope**: 인게임 렌더링 엔진 Canvas 2D → Three.js Voxel 3D 변환의 상세 시스템 아키텍처
> **Date**: 2026-03-11
> **Plan Reference**: `docs/designs/v38-3d-voxel-plan.md`
> **Research Reference**: `docs/designs/v38-3d-conversion-research.md`
> **Roadmap Reference**: `docs/designs/v38-3d-voxel-roadmap.md`

---

## 1. Overview

이 문서는 `/da:plan`(v38-3d-voxel-plan.md)에서 정의한 **Canvas 2D → Three.js Voxel 3D 변환**의 High-Level Blueprint를 받아, C4 Level 2-3 상세 아키텍처, 컴포넌트 설계, 인터페이스 스펙, 렌더링 최적화 전략, 성능 예산을 구체화합니다.

**핵심 아키텍처 원칙:**
1. **Logic/Render 완전 분리**: `update()` (게임 로직)는 변경 0줄. `draw()` (렌더링)만 R3F Scene Graph로 교체
2. **Ref-based 상태 공유**: React state 대신 `MutableRefObject`로 60fps 무re-render 데이터 흐름 유지
3. **InstancedMesh-first**: 모든 동적 엔티티는 InstancedMesh 기반 batch 렌더링 (draw call < 50)
4. **Progressive Enhancement**: Canvas 2D 모드 유지, 3D는 opt-in, WebGL 미지원 시 자동 fallback
5. **Zero-Balance-Impact**: 게임 밸런스 영향 0. 좌표 매핑(x,y→x,0,-y)만 적용, 모든 combat/movement/collision 로직 불변

**변환 규모:**
- 보존: `systems/` 24개 + `hooks/` 12개 + `collision/` 3개 + `config/` + `workers/` = **~100 파일, 변경 0줄**
- 교체: `rendering/` 77개 파일 (~41,000줄) + `MatrixCanvas.draw()` (~2,160줄) = **~50,000줄 교체**
- 신규: `rendering3d/` + `3d/` 컴포넌트 + 에셋 파이프라인 = **~15,000줄 신규**

## 2. Goals / Non-Goals

### Goals
1. **[G-1] 렌더링 엔진 교체**: Canvas 2D `draw()` → R3F Scene Graph로 완전 교체 (Voxel 3D 비주얼)
2. **[G-2] 60fps@200+ 엔티티**: Desktop mid-tier에서 Arena 모드 200 적 + 100 투사체 + 9 에이전트 = 60fps 유지
3. **[G-3] 게임 로직 불변**: `update()`, `systems/`, `collision/`, `hooks/` 변경 0줄. 기존 밸런스 100% 보존
4. **[G-4] 2D/3D 듀얼 모드**: Classic(Canvas 2D) / Enhanced(Three.js 3D) 런타임 스위칭, localStorage persist
5. **[G-5] 모바일 지원**: iOS Safari + Android Chrome에서 30fps+, touch input 유지
6. **[G-6] Draw Call 최소화**: Normal <20, Arena <40, Stress <60 (InstancedMesh/BatchedMesh 활용)
7. **[G-7] Adaptive Quality**: FPS 기반 3-tier 자동 품질 조절 (Quality Ladder)

### Non-Goals
1. **게임 로직 변경**: 전투, 이동, 충돌, AI, 스폰 시스템 수정 (→ 별도 밸런스 패치)
2. **PerspectiveCamera 도입**: 이번 버전은 OrthographicCamera만. Perspective는 v39+
3. **지형 높이맵**: 평면 지형 유지. 높이 변화(hill, cliff)는 v39+
4. **새 게임 메카닉**: 환경 파괴, 수직 이동 등 3D 전용 기능은 v39+
5. **에셋 프로시저럴 생성**: 이번은 수동 MagicaVoxel + Blender. AI 자동 생성은 v39+
6. **서버 변경**: Go 서버는 2D 좌표 기반 유지. 3D 좌표는 클라이언트-only concern
7. **WebGPU 렌더러**: WebGLRenderer만 사용. WebGPU는 브라우저 지원 성숙 시 전환

## 3. Architecture — C4 Level 2 (Container Diagram)

plan에서 정의한 C4 Level 1(System Context)을 서비스/컨테이너 경계로 구체화합니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        User Browser (Client)                            │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  Next.js 15 App (apps/web)                                         │ │
│ │ ┌───────────────┐ ┌──────────────────────────────────────────────┐ │ │
│ │ │ Lobby/UI      │ │ Game Container (MatrixApp.tsx)               │ │ │
│ │ │ (pages, HUD,  │ │ ┌──────────────┐ ┌────────────────────────┐│ │ │
│ │ │  overlays)    │ │ │ useGameLoop  │ │ Render Engine          ││ │ │
│ │ │               │ │ │ (logic only) │ │ ┌────────────────────┐ ││ │ │
│ │ │               │ │ │ systems/ 24  │ │ │  MODE A: Canvas 2D │ ││ │ │
│ │ │               │ │ │ hooks/ 12    │ │ │  MatrixCanvas.tsx   │ ││ │ │
│ │ │               │ │ │ collision/ 3 │ │ │  rendering/ 77 file │ ││ │ │
│ │ │               │ │ │ config/      │ │ ├────────────────────┤ ││ │ │
│ │ │               │ │ │ workers/     │ │ │  MODE B: R3F 3D    │ ││ │ │
│ │ │               │ │ │              │ │ │  MatrixScene.tsx    │ ││ │ │
│ │ │               │ │ │ ──refs──→    │ │ │  rendering3d/ NEW  │ ││ │ │
│ │ │               │ │ │              │ │ │  3d/ components    │ ││ │ │
│ │ └───────────────┘ │ └──────────────┘ │ └────────────────────┘ ││ │ │
│ │                    │                  └────────────────────────┘│ │ │
│ │                    └──────────────────────────────────────────────┘ │ │
│ │ ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────────┐ │ │
│ │ │ Web Worker   │ │ Asset Loader │ │ React HUD Overlay            │ │ │
│ │ │ game-timer   │ │ useGLTF/     │ │ MatrixHUD, ArenaHUD,         │ │ │
│ │ │ (16ms tick)  │ │ AssetRegistry│ │ KillFeed, etc. (기존 유지)    │ │ │
│ │ └─────────────┘ └──────────────┘ └──────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                          ↕ WebSocket (state sync)                       │
└─────────────────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                    Game Server (Go) — 변경 없음                          │
│  RoomManager → Room[5] → Arena[5] → Broadcaster (20Hz state)           │
│  2D 좌표 기반 상태 직렬화. 3D는 클라이언트-only concern                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Container 경계 설명

| Container | 기술 | 역할 | 변경 범위 |
|-----------|------|------|----------|
| **Game Container** | React + R3F | MatrixApp 오케스트레이터, 게임 상태 관리 | renderMode 분기 추가 |
| **useGameLoop** | TypeScript | 기존 update() 추출, 순수 게임 로직 | 변경 0줄 (추출만) |
| **Render Engine (2D)** | Canvas 2D | 기존 MatrixCanvas + rendering/ | 유지 (Classic 모드) |
| **Render Engine (3D)** | R3F + Three.js | **신규** MatrixScene + rendering3d/ + 3d/ | 전체 신규 |
| **Web Worker** | Worker API | 60fps game timer (탭 비활성화 유지) | 변경 없음 |
| **Asset Loader** | drei useGLTF | .glb 모델 로딩 + 캐싱 | 신규 |
| **React HUD Overlay** | React + CSS | 게임 UI 컴포넌트 (absolute positioned) | 변경 없음 |
| **Game Server** | Go + WebSocket | 룸 관리, 상태 동기화 | 변경 없음 |

### 핵심 통신 프로토콜

| From → To | Protocol | 빈도 | Payload |
|-----------|----------|------|---------|
| Worker → useGameLoop | postMessage | 60Hz | `{ type: 'tick', deltaTime }` |
| useGameLoop → Refs | MutableRef write | 60Hz | gameRefs (enemies, projectiles, player, etc.) |
| Refs → useFrame | MutableRef read | ~60Hz | 3D mesh matrix/color 업데이트 |
| Server → Client | WebSocket | 20Hz | state (enemies, players, projectiles) |
| Client → Server | WebSocket | 30Hz | input (direction, abilities) |
| MatrixApp → MatrixScene | React props | On change | 53 props (config, callbacks, refs) |

## 4. Architecture — C4 Level 3 (Component Diagram)

plan에서 정의한 MatrixScene 내부를 각 R3F 컴포넌트와 유틸리티 모듈 수준으로 구체화합니다.

```
MatrixScene.tsx (R3F <Canvas> Orchestrator)
│
├── useGameLoop()                    ← 기존 update() 추출 (lib/matrix/hooks/useGameLoop.ts)
│   ├── systems/movement.ts          ← 이동 + AI (1,800줄, 변경 없음)
│   ├── systems/combat.ts            ← 전투 계산 (변경 없음)
│   ├── systems/weapons.ts           ← 무기 발사 (변경 없음)
│   ├── systems/projectile.ts        ← 투사체 업데이트 (변경 없음)
│   ├── systems/spawning.ts          ← 적 스폰 (변경 없음)
│   ├── systems/pickup.ts            ← 아이템 수집 (변경 없음)
│   ├── systems/agent-combat.ts      ← PvP (변경 없음)
│   ├── collision/                   ← AABB 충돌 (변경 없음)
│   └── (20+ more systems)
│
├── <SceneGraph>                     ← R3F JSX Tree (렌더링)
│   │
│   ├── <GameCamera />               ← 3d/GameCamera.tsx
│   │   └── OrthographicCamera + LERP follow + zoom + shake
│   │
│   ├── <GameLighting />             ← 3d/GameLighting.tsx
│   │   ├── AmbientLight(0.4)
│   │   ├── DirectionalLight(1.0, shadow)
│   │   └── DirectionalLight(0.5, fill)
│   │
│   ├── <VoxelTerrain />             ← 3d/VoxelTerrain.tsx
│   │   ├── ChunkManager             ← rendering3d/terrain.ts
│   │   │   ├── GroundChunk[]         (Merged PlaneGeometry, biome vertex color)
│   │   │   └── BiomeResolver         (noise.ts 재사용)
│   │   └── <TerrainObjects />        ← 3d/TerrainObjects.tsx
│   │       └── InstancedMesh per terrain type (desk, locker, table...)
│   │
│   ├── <EntityRenderer />            ← 3d/EntityRenderer.tsx (Orchestrator)
│   │   ├── <VoxelCharacter />        ← 3d/VoxelCharacter.tsx (Player)
│   │   │   ├── FrameSwapController   ← rendering3d/frame-swap.ts
│   │   │   ├── SkinColorSystem       ← rendering3d/skin-system.ts
│   │   │   └── SplitRenderer (upper/lower body)
│   │   ├── <EnemyRenderer />         ← 3d/EnemyRenderer.tsx
│   │   │   ├── InstancedMesh per template (10-15 pools)
│   │   │   ├── ColorMappingSystem    ← rendering3d/enemy-colors.ts
│   │   │   ├── LODController         ← rendering3d/lod-controller.ts
│   │   │   └── <EliteEffects />      ← 3d/EliteEffects.tsx
│   │   ├── <RemotePlayer3D />        ← 3d/RemotePlayer3D.tsx
│   │   │   └── VoxelCharacter reuse + nation color + LOD
│   │   └── <PickupRenderer />        ← 3d/PickupRenderer.tsx
│   │       └── InstancedMesh (XP orbs, item drops, gems)
│   │
│   ├── <ProjectileRenderer />        ← 3d/ProjectileRenderer.tsx (Orchestrator)
│   │   ├── ProjectilePool            ← rendering3d/projectile-pool.ts
│   │   ├── <MeleeWeapons />          ← 3d/weapons/MeleeWeapons.tsx
│   │   ├── <RangedWeapons />         ← 3d/weapons/RangedWeapons.tsx
│   │   ├── <MagicWeapons />          ← 3d/weapons/MagicWeapons.tsx
│   │   ├── <SpecialWeapons />        ← 3d/weapons/SpecialWeapons.tsx
│   │   ├── <SkillWeapons />          ← 3d/weapons/SkillWeapons.tsx
│   │   └── <TurretWeapon />          ← 3d/weapons/TurretWeapon.tsx
│   │
│   ├── <EffectsRenderer />           ← 3d/EffectsRenderer.tsx
│   │   ├── <ParticleSystem />        ← 3d/ParticleSystem.tsx
│   │   │   └── InstancedMesh particles (capacity: 500)
│   │   ├── <PvpEffects3D />          ← 3d/PvpEffects3D.tsx
│   │   │   └── Ring geometry + particle burst
│   │   └── <PostProcessing />        ← 3d/PostProcessing.tsx
│   │       ├── EffectComposer
│   │       ├── UnrealBloomPass (selective)
│   │       ├── Vignette
│   │       └── ScreenFlash (custom)
│   │
│   ├── <SafeZone3D />                ← 3d/SafeZone3D.tsx
│   │   ├── CylinderGeometry (반투명 경계)
│   │   ├── Fog shader (바깥 영역)
│   │   └── Direction arrow (billboard)
│   │
│   └── <WorldUI />                   ← 3d/WorldUI.tsx (drei <Html>)
│       ├── <DamageNumbers />         ← 3d/DamageNumbers.tsx (CSS pool)
│       ├── <EntityUI />              ← 3d/EntityUI.tsx (HP bar, nametag)
│       ├── <ChatBubble3D />          ← 3d/ChatBubble3D.tsx
│       └── <ArenaOverlays />         ← 3d/ArenaOverlays.tsx
│
└── <HUD Overlay />                   ← 기존 React 컴포넌트 (변경 없음)
    ├── MatrixHUD.tsx
    ├── ArenaHUD.tsx
    ├── KillFeed.tsx
    ├── EpochHUD.tsx
    ├── ComboCounter.tsx
    ├── FieldShop.tsx
    ├── BattleStats.tsx
    ├── SpectateMode.tsx
    └── (+ 10 more overlays)
```

### 신규 파일 구조

```
apps/web/
├── components/game/matrix/
│   ├── MatrixScene.tsx              ← NEW: R3F Canvas 래퍼
│   ├── 3d/                          ← NEW: 3D R3F 컴포넌트
│   │   ├── GameCamera.tsx
│   │   ├── GameLighting.tsx
│   │   ├── VoxelTerrain.tsx
│   │   ├── TerrainObjects.tsx
│   │   ├── EntityRenderer.tsx
│   │   ├── VoxelCharacter.tsx
│   │   ├── EnemyRenderer.tsx
│   │   ├── EliteEffects.tsx
│   │   ├── PickupRenderer.tsx
│   │   ├── RemotePlayer3D.tsx
│   │   ├── ProjectileRenderer.tsx
│   │   ├── EffectsRenderer.tsx
│   │   ├── ParticleSystem.tsx
│   │   ├── PvpEffects3D.tsx
│   │   ├── PostProcessing.tsx
│   │   ├── SafeZone3D.tsx
│   │   ├── WorldUI.tsx
│   │   ├── DamageNumbers.tsx
│   │   ├── EntityUI.tsx
│   │   ├── ChatBubble3D.tsx
│   │   ├── ArenaOverlays.tsx
│   │   ├── MobileOptimizer.tsx
│   │   └── weapons/
│   │       ├── MeleeWeapons.tsx
│   │       ├── RangedWeapons.tsx
│   │       ├── MagicWeapons.tsx
│   │       ├── SpecialWeapons.tsx
│   │       ├── SkillWeapons.tsx
│   │       └── TurretWeapon.tsx
│   └── (기존 파일 유지)
│
├── lib/matrix/
│   ├── hooks/
│   │   └── useGameLoop.ts           ← NEW: update() 추출
│   ├── rendering3d/                  ← NEW: 3D 렌더링 유틸리티
│   │   ├── terrain.ts               ← chunk 관리, biome 매핑
│   │   ├── frame-swap.ts            ← Frame Swap 애니메이션 컨트롤러
│   │   ├── skin-system.ts           ← 24종 skin palette 매핑
│   │   ├── enemy-templates.ts       ← 10-15 template 레지스트리
│   │   ├── enemy-colors.ts          ← CYBER_PALETTE → Three.js Color
│   │   ├── lod-controller.ts        ← LOD 3단계 거리 판정
│   │   ├── projectile-pool.ts       ← InstancedMesh 기반 오브젝트 풀
│   │   ├── quality-ladder.ts        ← 3-tier 적응형 품질
│   │   ├── character-config.ts      ← 9 클래스별 모델/색상 설정
│   │   ├── asset-registry.ts        ← .glb 에셋 경로 레지스트리
│   │   ├── coordinate-mapper.ts     ← 2D(x,y) → 3D(x,0,-y) 변환 유틸
│   │   └── instanced-updater.ts     ← InstancedMesh matrix/color 일괄 업데이트
│   └── (기존 디렉토리 유지)
│
└── public/assets/3d/                 ← NEW: Voxel 3D 에셋
    ├── characters/
    │   ├── base-character.glb
    │   ├── neo.glb, tank.glb, ...    (9 클래스)
    │   └── anims/
    │       ├── idle-0.glb, idle-1.glb
    │       ├── walk-0.glb ... walk-3.glb
    │       ├── hit-0.glb, hit-1.glb
    │       └── death-0.glb ... death-2.glb
    ├── enemies/
    │   ├── humanoid-small.glb
    │   ├── humanoid-medium.glb
    │   ├── humanoid-large.glb
    │   ├── flying.glb
    │   ├── crawler.glb
    │   ├── sphere.glb
    │   ├── quadruped.glb
    │   └── boss-*.glb              (3 boss 크기)
    ├── terrain/
    │   ├── classroom/*.glb
    │   ├── cafeteria/*.glb
    │   └── ...                     (7 biome)
    ├── weapons/
    │   └── turret-base.glb
    └── biome-atlas.png              (7 biome texture atlas)

## 5. Core Component Deep Design

### 5.1 Game Loop Extraction — useGameLoop

plan에서 "update() 추출 (변경 0줄)"로 정의한 것을 구체적인 함수 시그니처와 의존성으로 상세화합니다.

**추출 전략**: MatrixCanvas.tsx의 `update()` 함수 (line ~1760-2916, ~1,150줄)를 독립 훅으로 이동합니다. 내부 로직은 한 줄도 변경하지 않으며, 외부 의존성(refs, callbacks)만 파라미터로 전달합니다.

```typescript
// apps/web/lib/matrix/hooks/useGameLoop.ts

interface GameLoopDeps {
  // --- Refs (MutableRefObject) ---
  gameRefs: ReturnType<typeof useGameRefs>;  // 모든 게임 상태 refs
  arenaRefs: ArenaRefs;                       // 아레나 모드 refs

  // --- Callbacks (MatrixApp에서 전달) ---
  onLevelUp: (choices: SkillChoice[]) => void;
  onDeath: (stats: DeathStats) => void;
  onEpochComplete: (result: EpochResult) => void;
  onKill: (kill: KillEvent) => void;
  // ... (기존 MatrixCanvas에서 사용하는 모든 콜백)

  // --- Config (읽기 전용) ---
  gameConfig: GameConfig;
  difficultyLevel: number;
}

export function useGameLoop(deps: GameLoopDeps): void {
  // Web Worker 메시지 수신 → update(deltaTime) 호출
  // 내부: 기존 update() 함수 로직 그대로
  // 호출하는 systems: movement, combat, weapons, projectile,
  //   spawning, pickup, agent-combat, elite-monster, etc.

  useEffect(() => {
    const worker = new Worker('/workers/game-timer.worker.ts');
    worker.onmessage = (e) => {
      if (e.data.type === 'tick') {
        update(e.data.deltaTime, deps);
      }
    };
    worker.postMessage({ type: 'start', interval: 16 });
    return () => worker.terminate();
  }, []);
}
```

**핵심 결정**: useGameLoop은 R3F `useFrame` 과 **독립적**으로 실행됩니다. Worker 기반 60Hz 로직 루프는 렌더링 프레임과 분리되어 탭 비활성화 시에도 동작합니다. useFrame은 refs 읽기 + mesh 업데이트만 담당합니다.

**검증 전략**: 추출 후 기존 MatrixCanvas에서 `useGameLoop(deps)`를 import하여 2D 모드에서 리그레션 0 확인 후, MatrixScene에서도 동일 훅을 사용합니다.

### 5.2 MatrixScene — R3F Canvas Orchestrator

MatrixScene은 기존 MatrixCanvas를 3D로 대체하는 R3F Canvas 래퍼입니다. 기존 MatrixCanvasProps 인터페이스를 그대로 수신하여 하위 3D 컴포넌트에 분배합니다.

```typescript
// apps/web/components/game/matrix/MatrixScene.tsx

export function MatrixScene(props: MatrixCanvasProps) {
  const refs = useGameRefs();
  const arenaRefs = useArena(props);
  const qualityRef = useRef<QualityTier>('high');

  // 게임 로직 — 기존 update() 그대로
  useGameLoop({ gameRefs: refs, arenaRefs, ...props.callbacks, gameConfig: props.config });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* R3F 3D Scene */}
      <Canvas
        orthographic
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        style={{ position: 'absolute', inset: 0 }}
        frameloop="always"
      >
        <GameLighting qualityRef={qualityRef} />
        <GameCamera playerRef={refs.playerRef} zoomRef={refs.zoomRef} shakeRef={refs.shakeRef} />

        <VoxelTerrain playerRef={refs.playerRef} biomeConfigRef={refs.biomeConfigRef} />
        <PickupRenderer pickupsRef={refs.pickupsRef} playerRef={refs.playerRef} />

        <EntityRenderer
          playerRef={refs.playerRef}
          enemiesRef={refs.enemiesRef}
          agentsRef={refs.agentsRef}
          remotePlayers={refs.remotePlayers}
          qualityRef={qualityRef}
        />

        <ProjectileRenderer projectilesRef={refs.projectilesRef} qualityRef={qualityRef} />
        <EffectsRenderer particlesRef={refs.particlesRef} effectsRef={refs.effectsRef} qualityRef={qualityRef} />
        <SafeZone3D arenaRefs={arenaRefs} playerRef={refs.playerRef} />

        <WorldUI
          damageNumbersRef={refs.damageNumbersRef}
          enemiesRef={refs.enemiesRef}
          agentsRef={refs.agentsRef}
          playerRef={refs.playerRef}
        />

        <PostProcessing qualityRef={qualityRef} effectsRef={refs.effectsRef} />
        <PerformanceMonitor onDecline={() => lowerQuality(qualityRef)} onIncline={() => raiseQuality(qualityRef)} />
      </Canvas>

      {/* React HUD Overlay — 기존 그대로 */}
      <MatrixHUD {...props.hudProps} />
      <ArenaHUD {...props.arenaHudProps} />
      <KillFeed {...props.killFeedProps} />
      {/* ... 기타 HUD 컴포넌트 */}
    </div>
  );
}
```

**R3F Canvas 설정 결정사항:**

| 설정 | 값 | 근거 |
|------|-----|------|
| `orthographic` | `true` | 기존 isometric 뷰 재현 |
| `antialias` | `true` | Voxel 경계 부드러움 (Tier3에서 off) |
| `alpha` | `false` | 불투명 배경, 성능 |
| `powerPreference` | `high-performance` | 디스크리트 GPU 우선 |
| `dpr` | `[1, 2]` | Retina 지원, 최대 2x |
| `frameloop` | `always` | 항시 렌더 (게임이므로) |

**Critical Gotcha — useFrame priority**: 모든 useFrame 호출은 priority=0 (기본값)을 사용합니다. R3F v9에서 priority != 0이면 자동 렌더가 비활성화되므로, 수동 gl.render() 호출이 필요해집니다. 이를 방지하기 위해 모든 컴포넌트가 default priority를 사용하고, JSX 마운트 순서로 실행 순서를 결정합니다.

### 5.3 GameCamera — Isometric Camera System

기존 Canvas 2D의 `ctx.transform(1,0.5,-1,0.5,0,0)` isometric 변환을 OrthographicCamera로 재현합니다.

```typescript
// apps/web/components/game/matrix/3d/GameCamera.tsx

interface GameCameraProps {
  playerRef: MutableRefObject<PlayerState>;
  zoomRef: MutableRefObject<number>;       // 0.6 ~ 1.1
  shakeRef: MutableRefObject<ShakeState>;  // { intensity, decay }
}

export function GameCamera({ playerRef, zoomRef, shakeRef }: GameCameraProps) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const player = playerRef.current;
    const { x, y } = player;

    // 2D → 3D 좌표 매핑
    const targetX = x;
    const targetZ = -y;  // y 부호 반전

    // LERP 카메라 위치 (isometric 45° offset)
    const ISO_DISTANCE = 800;
    camera.position.x += (targetX + ISO_DISTANCE - camera.position.x) * 0.08;
    camera.position.z += (targetZ + ISO_DISTANCE - camera.position.z) * 0.08;
    camera.position.y = ISO_DISTANCE;  // 고정 높이

    // Screen Shake
    if (shakeRef.current.intensity > 0.01) {
      const { intensity } = shakeRef.current;
      camera.position.x += (Math.random() - 0.5) * intensity * 2;
      camera.position.z += (Math.random() - 0.5) * intensity * 2;
      shakeRef.current.intensity *= shakeRef.current.decay;
    }

    // Dynamic Zoom (LERP)
    const targetZoom = zoomRef.current;
    camera.zoom += (targetZoom - camera.zoom) * 0.008;

    camera.lookAt(targetX, 0, targetZ);
    camera.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[800, 800, 800]}
      zoom={1.0}
      near={0.1}
      far={5000}
    />
  );
}
```

**카메라 매개변수 상세:**

| 파라미터 | 값 | 근거 |
|----------|-----|------|
| **Projection** | Orthographic | 기존 isometric 뷰 재현, 2D 좌표 정확성 |
| **Position offset** | (D, D, D) where D=800 | isometric 45° 각도 (arctan(1) = 45°) |
| **Zoom range** | 0.6 ~ 1.1 | 기존 camera.ts dynamic zoom 범위 |
| **LERP factor (position)** | 0.08 | 기존 camera.ts 추적 부드러움과 동일 |
| **LERP factor (zoom)** | 0.008 | 기존 smooth zoom과 동일 |
| **Shake decay** | 0.85 | 기존 screen shake decay 재사용 |
| **near/far** | 0.1 / 5000 | 넓은 월드(2000x2000) 커버 |

### 5.4 VoxelTerrain — Chunked Terrain System

plan의 "Chunked ground plane + biome"을 메모리 관리, chunk lifecycle, 렌더링 전략까지 구체화합니다.

**Chunk 시스템 설계:**

```
World Space (2000 x 2000 units)
 ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
 │ C0,0 │ C1,0 │ C2,0 │ C3,0 │ C4,0 │ C5,0 │ C6,0 │ C7,0 │ C8,0 │ C9,0 │
 ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
 │ C0,1 │      │      │ LOAD │ LOAD │ LOAD │      │      │      │      │
 ├──────┼──────┼──────┤ ZONE ┤ ZONE ┤ ZONE ├──────┼──────┼──────┼──────┤
 │      │      │ LOAD │ VIEW │ VIEW │ VIEW │ LOAD │      │      │      │
 ├──────┼──────┤ ZONE ┤ PORT ┤ ★   ┤ PORT ┤ ZONE ├──────┼──────┼──────┤
 │      │      │      │      │player│      │      │      │      │      │
 └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
 Chunk size: 200x200 units = 100 chunks for 2000x2000 world
 View distance: 3x3 chunks (600x600 visible area)
 Load distance: 5x5 chunks (preload buffer)
```

```typescript
// apps/web/lib/matrix/rendering3d/terrain.ts

interface ChunkState {
  key: string;              // "cx,cy" 형식
  mesh: THREE.Mesh;         // Merged PlaneGeometry
  objects: THREE.InstancedMesh[];  // terrain props
  biomeData: Uint8Array;    // biome type per tile
  loaded: boolean;
}

class ChunkManager {
  private chunks = new Map<string, ChunkState>();
  private readonly CHUNK_SIZE = 200;
  private readonly VIEW_DISTANCE = 3;    // chunks (600 units)
  private readonly LOAD_DISTANCE = 5;    // chunks (1000 units, preload)
  private readonly UNLOAD_DISTANCE = 7;  // chunks (1400 units, cleanup)

  update(playerX: number, playerZ: number): void {
    const cx = Math.floor(playerX / this.CHUNK_SIZE);
    const cz = Math.floor(playerZ / this.CHUNK_SIZE);

    // Load new chunks within LOAD_DISTANCE
    for (let dx = -this.LOAD_DISTANCE; dx <= this.LOAD_DISTANCE; dx++) {
      for (let dz = -this.LOAD_DISTANCE; dz <= this.LOAD_DISTANCE; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        if (!this.chunks.has(key)) {
          this.createChunk(cx + dx, cz + dz);
        }
      }
    }

    // Unload distant chunks (>UNLOAD_DISTANCE)
    for (const [key, chunk] of this.chunks) {
      const [chunkX, chunkZ] = key.split(',').map(Number);
      if (Math.abs(chunkX - cx) > this.UNLOAD_DISTANCE ||
          Math.abs(chunkZ - cz) > this.UNLOAD_DISTANCE) {
        this.disposeChunk(key);
      }
    }
  }

  private createChunk(cx: number, cz: number): ChunkState {
    // 1. Biome 결정: noise.ts 재사용 → 각 타일의 biome 타입
    // 2. Ground mesh: PlaneGeometry + biome별 vertex color
    // 3. Terrain objects: hash-based placement → InstancedMesh per type
    // 4. Merged Geometry: chunk 내 모든 ground 타일 → 1 draw call
  }

  private disposeChunk(key: string): void {
    // geometry.dispose(), material.dispose(), scene에서 제거
    // InstancedMesh dispose
    this.chunks.delete(key);
  }
}
```

**Ground Mesh 렌더링 전략:**
- 각 chunk = 1개 Merged PlaneGeometry (200x200 = 40,000 tiles → merge → 1 draw call)
- Biome 색상 = Vertex Color (texture 불필요, 성능 우수)
- Biome atlas texture는 디테일 추가 시 사용 (UV 매핑)
- 총 visible chunks: 9 (3x3) = **9 draw calls for ground**

**Terrain Object Instancing:**
- 7 biome type × 3-5 variation = 25-35 prop 종류
- 같은 종류 prop → InstancedMesh (모든 chunk 통합)
- Hash-based placement: `hash(chunkX, chunkZ, tileX, tileZ) % probability`
- Frustum + distance culling: >1500px → 숨김
- 예상 draw calls: **7-10 (prop 종류 수)**

### 5.5 EntityRenderer — Character & Enemy Rendering

plan의 "EntityRenderer = InstancedMesh/BatchedMesh"를 플레이어, 적, 에이전트, 원격 플레이어 각각의 렌더링 전략으로 구체화합니다.

#### 5.5.1 VoxelCharacter (Player)

**Frame Swap 아키텍처:**

```typescript
// apps/web/lib/matrix/rendering3d/frame-swap.ts

interface FrameSwapConfig {
  actions: {
    idle:  { frames: THREE.BufferGeometry[]; duration: 800 };  // 2 frames
    walk:  { frames: THREE.BufferGeometry[]; duration: 600 };  // 4 frames
    hit:   { frames: THREE.BufferGeometry[]; duration: 300 };  // 2 frames
    death: { frames: THREE.BufferGeometry[]; duration: 500 };  // 3 frames
  };
}

class FrameSwapController {
  private currentAction: string = 'idle';
  private currentFrame: number = 0;
  private elapsed: number = 0;
  private meshRef: THREE.Mesh;

  update(deltaTime: number, velocity: number, isHit: boolean, isDead: boolean): void {
    // 1. Action 결정: isDead > isHit > velocity > idle
    const nextAction = isDead ? 'death' : isHit ? 'hit' : velocity > 0.5 ? 'walk' : 'idle';

    // 2. Action 변경 시 프레임 리셋
    if (nextAction !== this.currentAction) {
      this.currentAction = nextAction;
      this.currentFrame = 0;
      this.elapsed = 0;
    }

    // 3. 프레임 진행
    const config = this.actions[this.currentAction];
    this.elapsed += deltaTime;
    const frameDuration = config.duration / config.frames.length;
    if (this.elapsed >= frameDuration) {
      this.elapsed = 0;
      this.currentFrame = (this.currentFrame + 1) % config.frames.length;
      this.meshRef.geometry = config.frames[this.currentFrame];  // geometry swap
    }
  }
}
```

**8방향 Facing:**
```
velocity(vx, vy) → angle = atan2(-vy, vx) → 8-direction snap
→ model.rotation.y = direction * (PI/4)

Direction mapping:
  0: East  (0°)    4: West  (180°)
  1: NE    (45°)   5: SW    (225°)
  2: North (90°)   6: South (270°)
  3: NW    (135°)  7: SE    (315°)
```

**Upper/Lower Split Rendering:**
```
Render Order (useFrame, priority=0, JSX mount order):
  1. Lower body mesh (position.y = 0)
  2. Skill effects (position.y = 0, garlic/pool/beam 등)
  3. Upper body mesh (position.y = body_height)

구현: Three.js renderOrder 속성으로 정밀 제어
  lower.renderOrder = 0
  effects.renderOrder = 1
  upper.renderOrder = 2
```

#### 5.5.2 EnemyRenderer (InstancedMesh Pool)

**핵심 전략**: 10-15 base template별로 각각 InstancedMesh를 생성합니다. 173개 적 타입은 template + color 조합으로 커버합니다.

```typescript
// apps/web/components/game/matrix/3d/EnemyRenderer.tsx

// Template별 InstancedMesh Pool
interface EnemyPool {
  templateId: string;          // e.g., 'humanoid_medium'
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  instancedMesh: THREE.InstancedMesh;
  maxCount: number;            // capacity (e.g., 100)
  activeCount: number;         // 현재 활성 수
  indexMap: Map<string, number>;  // enemyId → instance index
}

// useFrame에서 매 프레임 업데이트
useFrame(() => {
  const enemies = enemiesRef.current;
  const cameraPos = camera.position;

  for (const pool of pools) {
    let idx = 0;
    for (const enemy of enemies) {
      if (enemy.templateId !== pool.templateId) continue;

      // LOD 판정
      const dist = distance2D(enemy.x, enemy.y, playerRef.current.x, playerRef.current.y);
      const lod = lodController.getLOD(dist, totalEnemyCount);

      if (lod === 'CULL') continue;

      // 2D → 3D 좌표 매핑
      tempMatrix.makeTranslation(enemy.x, 0, -enemy.y);
      tempMatrix.multiply(tempScaleMatrix.makeScale(enemy.scale, enemy.scale, enemy.scale));

      pool.instancedMesh.setMatrixAt(idx, tempMatrix);
      pool.instancedMesh.setColorAt(idx, enemyColors.getColor(enemy.type));
      idx++;
    }

    pool.instancedMesh.count = idx;  // visible count만 렌더
    pool.instancedMesh.instanceMatrix.needsUpdate = true;
    if (pool.instancedMesh.instanceColor) {
      pool.instancedMesh.instanceColor.needsUpdate = true;
    }
  }
});
```

**Draw Call 계산:**
- 10-15 templates × 1 InstancedMesh each = **10-15 draw calls for enemies**
- LOD LOW는 별도 InstancedMesh (colored cube) = **+1 draw call**
- Elite effects = **+3 draw calls** (silver/gold/diamond glow meshes)
- **총 적 렌더링: ~18 draw calls (200 적 기준)**

#### 5.5.3 LOD Controller

```typescript
// apps/web/lib/matrix/rendering3d/lod-controller.ts

interface LODThresholds {
  high: number;    // < 800px: full model + animation + effects
  mid: number;     // 800-1400px: simplified model + color
  low: number;     // > 1400px: colored cube (1 voxel)
  cull: number;    // > 2200px: render 안 함
}

class LODController {
  private thresholds: LODThresholds = { high: 800, mid: 1400, low: 2200, cull: 2200 };

  // 적응형: 엔티티 수 > 150이면 threshold 축소 (20-35%)
  adaptThresholds(totalCount: number): void {
    if (totalCount > 150) {
      const factor = Math.max(0.65, 1 - (totalCount - 150) / 500);
      this.thresholds.high = 800 * factor;
      this.thresholds.mid = 1400 * factor;
    }
  }

  getLOD(distance: number, totalCount: number): 'HIGH' | 'MID' | 'LOW' | 'CULL' {
    this.adaptThresholds(totalCount);
    if (distance > this.thresholds.cull) return 'CULL';
    if (distance > this.thresholds.mid) return 'LOW';
    if (distance > this.thresholds.high) return 'MID';
    return 'HIGH';
  }
}
```

### 5.6 ProjectileRenderer — Weapon & Projectile System

plan의 "투사체 InstancedMesh Pool + 40+ 무기"를 Object Pool 아키텍처, 무기 카테고리별 렌더러, 메모리 전략으로 구체화합니다.

**Object Pool 아키텍처:**

```typescript
// apps/web/lib/matrix/rendering3d/projectile-pool.ts

class ProjectilePool {
  private instancedMesh: THREE.InstancedMesh;
  private readonly maxCapacity: number;
  private activeIndices: Set<number> = new Set();
  private freeIndices: number[] = [];

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    this.maxCapacity = capacity;
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.instancedMesh.count = 0;  // 초기 visible 0

    // 모든 인덱스를 free pool에 등록
    for (let i = capacity - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }

    // 초기 상태: scale(0,0,0)으로 숨김
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) {
      this.instancedMesh.setMatrixAt(i, zeroMatrix);
    }
  }

  spawn(): number | null {
    if (this.freeIndices.length === 0) return null;
    const idx = this.freeIndices.pop()!;
    this.activeIndices.add(idx);
    this.instancedMesh.count = Math.max(this.instancedMesh.count, idx + 1);
    return idx;
  }

  despawn(idx: number): void {
    // scale(0,0,0)으로 숨김
    this.instancedMesh.setMatrixAt(idx, ZERO_SCALE_MATRIX);
    this.activeIndices.delete(idx);
    this.freeIndices.push(idx);

    // count 재계산 (가장 높은 active index + 1)
    if (this.activeIndices.size === 0) {
      this.instancedMesh.count = 0;
    }
  }

  updateInstance(idx: number, matrix: THREE.Matrix4, color?: THREE.Color): void {
    this.instancedMesh.setMatrixAt(idx, matrix);
    if (color) this.instancedMesh.setColorAt(idx, color);
  }

  flush(): void {
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }
}
```

**무기 카테고리별 Pool 배분:**

| Pool ID | 카테고리 | Geometry | Capacity | 주요 무기 |
|---------|---------|----------|----------|----------|
| 0 | Melee | Custom (trail/ring/arc) | 50 | whip, punch, axe, sword |
| 1 | Ranged | BoxGeometry(small) | 200 | knife, bow, shard, fork |
| 2 | Magic-Orb | SphereGeometry(small) | 100 | wand, energy bolt |
| 3 | Magic-Orbit | PlaneGeometry | 50 | bible pages |
| 4 | Magic-AOE | CircleGeometry | 30 | garlic, pool, ground decal |
| 5 | Special-Beam | CylinderGeometry | 20 | beam, laser, bridge |
| 6 | Skill-CODE | SphereGeometry | 100 | green 계열 스킬 |
| 7 | Skill-DATA | SphereGeometry | 100 | cyan 계열 스킬 |
| 8 | Skill-NETWORK | SphereGeometry | 100 | purple 계열 스킬 |
| 9 | Skill-OTHER | SphereGeometry | 100 | red/amber/pink 스킬 |

**Total: 10 pools = 10 draw calls for projectiles**, capacity 850 총 인스턴스

**무기별 3D 비주얼 매핑 (상세):**

```
Melee:
  whip  → TubeGeometry chain path (bezier curve → tube)
  punch → TorusGeometry expanding ring + opacity fade
  axe   → 4-6 small BoxGeometry scatter + rotation
  sword → Custom ShapeGeometry arc + bloom emissive

Ranged:
  knife   → BoxGeometry(0.3,0.1,0.05) + rotation + trail particles
  bow     → ConeGeometry(0.05,0.5) elongated arrow
  ping    → TorusGeometry expanding concentric rings (2-3)
  shard   → Large SphereGeometry + impact ring
  airdrop → RingGeometry ground marker + falling box + shockwave
  fork    → LineGeometry branching bolts + emissive glow

Magic:
  wand    → SphereGeometry(0.2) + emissive + point light
  bible   → PlaneGeometry pages orbiting player (instanced)
  garlic  → CircleGeometry ground decal + semi-transparent + pulse
  pool    → CircleGeometry ground decal + animated shader wave

Special:
  bridge  → BoxGeometry wall segment (ice/fire barrier)
  beam    → CylinderGeometry stretched + bloom + real-time endpoint
  laser   → CylinderGeometry thin + intense bloom + recursive bounce
```

### 5.7 EffectsRenderer — Particle & Post-Processing

plan의 "Post-Processing + Particle System"을 구체적인 파이프라인, 파티클 풀 설계, Canvas 2D → 3D 이펙트 매핑으로 구체화합니다.

#### 5.7.1 Post-Processing Pipeline

```typescript
// apps/web/components/game/matrix/3d/PostProcessing.tsx

// Quality Tier별 후처리 설정
const POST_PROCESSING_CONFIG = {
  high: {
    bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.85 },
    vignette: { enabled: true, darkness: 0.4, offset: 0.5 },
    screenFlash: { enabled: true },
  },
  medium: {
    bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.9 },
    vignette: { enabled: true, darkness: 0.3, offset: 0.6 },
    screenFlash: { enabled: true },
  },
  low: {
    bloom: { enabled: false },
    vignette: { enabled: false },
    screenFlash: { enabled: true },  // 최소한의 피드백 유지
  },
};
```

**Canvas 2D → Post-Processing 매핑:**

| Canvas 2D 이펙트 | 3D 후처리 | 구현 |
|------------------|----------|------|
| `ctx.shadowBlur` glow | UnrealBloomPass | emissive material → selective bloom |
| Screen flash (white overlay) | Custom ShaderPass | uniform opacity + decay |
| Color invert | Custom ShaderPass | invert fragment shader |
| Radial gradient vignette | Vignette effect | @react-three/postprocessing |
| Slow-mo visual | Global time scale | `THREE.Clock` custom |
| Screen edge red glow | Vignette color override | vignette darkness → red |

#### 5.7.2 Particle System

```typescript
// apps/web/components/game/matrix/3d/ParticleSystem.tsx

interface ParticleConfig {
  maxCapacity: number;       // 500 (high), 250 (medium), 100 (low)
  geometry: THREE.BufferGeometry;  // Small BoxGeometry(0.5, 0.5, 0.5)
  material: THREE.MeshBasicMaterial;
}

// 기존 ExtendedParticle 데이터 구조 재사용
interface Particle3D {
  index: number;             // InstancedMesh instance index
  x: number; y: number;     // 2D world position
  vx: number; vy: number;   // velocity
  life: number;              // 0-1 (0=dead)
  maxLife: number;
  color: THREE.Color;
  scale: number;
  easing: EasingType;        // 기존 26개 이징 함수 재사용
  drag: number;
  bounce: boolean;
  glow: boolean;             // emissive 여부 (bloom과 연동)
}
```

**Burst 스타일 매핑 (기존 → 3D):**

| Burst Style | 2D 구현 | 3D 구현 |
|-------------|---------|---------|
| data | Pixel scatter | Small cube InstancedMesh, cyan color |
| pixel | Rectangle scatter | Small cube, randomColor |
| slime | Dripping droplets | Sphere + gravity + bounce |
| spark | Fast radial lines | Elongated cube + emissive + trail |
| smoke | Expanding circles | Sphere + scale up + opacity fade |
| shatter | Fragment scatter | Cube fragments + rotation + gravity |
| electric | Jagged lines | LineGeometry + jitter + emissive |
| gold | Coin-like scatter | Flat cylinder + spin + emissive gold |

**파티클 업데이트 (useFrame):**
```
매 프레임:
  1. 활성 파티클 순회
  2. 위치 업데이트: p.x += p.vx * dt, p.y += p.vy * dt (2D 좌표)
  3. 물리: drag, gravity, bounce 적용
  4. 생명 감소: p.life -= dt / p.maxLife
  5. 이징 적용: scale = easing(p.life) * p.baseScale
  6. InstancedMesh 업데이트: setMatrixAt(p.index, matrix)
  7. 죽은 파티클: scale(0,0,0) → despawn
```

### 5.8 WorldUI — drei Html World-Space UI

plan의 "drei `<Html>` 기반 데미지 넘버, HP바, 네임태그"를 DOM 풀링, 성능 전략, LOD 연동까지 구체화합니다.

**drei `<Html>` 아키텍처:**

```typescript
// apps/web/components/game/matrix/3d/WorldUI.tsx

// drei <Html>은 3D 위치를 DOM 요소에 자동 매핑합니다.
// 핵심: 과도한 DOM 요소 생성 방지를 위해 Object Pool 패턴 적용

export function WorldUI({ damageNumbersRef, enemiesRef, agentsRef, playerRef }: WorldUIProps) {
  return (
    <group>
      {/* 데미지 넘버: DOM Pool (max 40개) */}
      <DamageNumbers ref={damageNumbersRef} maxCount={40} />

      {/* 엔티티 UI: LOD 연동으로 가시 범위 내만 렌더 */}
      <EntityUI
        enemiesRef={enemiesRef}
        agentsRef={agentsRef}
        playerRef={playerRef}
        maxVisibleHP={30}        // 동시 HP바 최대 30개
        maxVisibleNames={15}     // 동시 네임태그 최대 15개
      />

      {/* 채팅 버블: 최대 3개 동시 */}
      <ChatBubble3D agentsRef={agentsRef} maxBubbles={3} />
    </group>
  );
}
```

**DamageNumbers DOM Pool:**

```typescript
// apps/web/components/game/matrix/3d/DamageNumbers.tsx

// Object Pool: 40개 <Html> 요소를 pre-create하고 재사용
// 비활성: opacity=0, pointer-events=none
// 활성: CSS animation (float-up 0.8s + fade-out)

interface DamageNumberSlot {
  active: boolean;
  position: THREE.Vector3;
  text: string;
  color: string;           // white(일반), red(적 피격), green(힐), gold(크리)
  scale: number;           // 크리티컬 시 1.5x
  startTime: number;
  duration: number;         // 800ms
}

// CSS Animation (GPU-accelerated):
// @keyframes damage-float {
//   0%   { transform: translateY(0) scale(1); opacity: 1; }
//   100% { transform: translateY(-40px) scale(0.6); opacity: 0; }
// }
```

**EntityUI LOD 전략:**

| LOD | HP Bar | Nametag | Detail |
|-----|--------|---------|--------|
| HIGH (<800px) | Full bar (width 40px) | Name + Level + Nation color | animated smooth |
| MID (800-1400px) | Mini bar (width 20px) | None | step (10% increments) |
| LOW (>1400px) | Dot (4px circle) | None | color only (green/red) |
| CULL (>2200px) | None | None | — |

**성능 최적화:**
- drei `<Html>` 의 `occlude` prop 사용 → 카메라 뒤 요소 자동 숨김
- `distanceFactor` prop으로 거리별 자동 스케일링
- `zIndexRange={[0, 0]}` 으로 HUD overlay 아래에 유지
- 총 동시 DOM 요소: 데미지 40 + HP 30 + 이름 15 + 채팅 3 = **88 DOM 요소 (max)**

### 5.9 SafeZone3D — Arena Safe Zone Visualization

plan의 "반투명 실린더 + shader fog + warning"을 메시 구성, 셰이더, 4-phase shrink 애니메이션까지 구체화합니다.

```typescript
// apps/web/components/game/matrix/3d/SafeZone3D.tsx

interface SafeZone3DProps {
  arenaRefs: ArenaRefs;     // { center, radius, targetRadius, phase }
  playerRef: MutableRefObject<PlayerState>;
}

export function SafeZone3D({ arenaRefs, playerRef }: SafeZone3DProps) {
  const wallRef = useRef<THREE.Mesh>(null);
  const dangerPlaneRef = useRef<THREE.Mesh>(null);
  const targetRingRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { center, radius, targetRadius, phase } = arenaRefs.current;
    const player = playerRef.current;

    // 1. 안전지대 벽 (반투명 실린더)
    if (wallRef.current) {
      wallRef.current.position.set(center.x, 50, -center.y);
      wallRef.current.scale.set(radius / 100, 1, radius / 100);
      // 페이즈에 따라 색상 변경
      const wallColor = phase <= 1 ? 0x00ff88 : phase <= 2 ? 0xffaa00 : 0xff3333;
      (wallRef.current.material as THREE.MeshBasicMaterial).color.setHex(wallColor);
    }

    // 2. 위험 영역 (바깥 = red fog plane)
    // ShaderMaterial: 안전지대 원 밖을 semi-transparent red로 채움
    if (dangerPlaneRef.current) {
      const mat = dangerPlaneRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uCenter.value.set(center.x, -center.y);
      mat.uniforms.uRadius.value = radius;
    }

    // 3. 목표 반경 표시 (점선 링)
    if (targetRingRef.current && targetRadius < radius) {
      targetRingRef.current.position.set(center.x, 0.1, -center.y);
      targetRingRef.current.scale.set(targetRadius / 100, 1, targetRadius / 100);
      targetRingRef.current.visible = true;
    }

    // 4. Warning vignette: 플레이어가 안전지대 밖이면 post-processing vignette 강화
    const playerDist = Math.hypot(player.x - center.x, player.y - center.y);
    const isOutside = playerDist > radius;
    // → PostProcessing 컴포넌트에 warningIntensity ref로 전달
  });

  return (
    <group>
      {/* 안전지대 벽 — 반투명 실린더 */}
      <mesh ref={wallRef}>
        <cylinderGeometry args={[100, 100, 100, 64, 1, true]} />
        <meshBasicMaterial color={0x00ff88} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* 위험 영역 — 전체 월드 커버 평면 + 원형 hole 셰이더 */}
      <mesh ref={dangerPlaneRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <shaderMaterial
          transparent
          uniforms={{
            uCenter: { value: new THREE.Vector2(0, 0) },
            uRadius: { value: 1000 },
            uColor: { value: new THREE.Color(0.6, 0.0, 0.0) },
          }}
          vertexShader={SAFE_ZONE_VERT}
          fragmentShader={SAFE_ZONE_FRAG}
          // fragmentShader: discard if inside circle, else alpha 0.3 red
        />
      </mesh>

      {/* 목표 반경 — 점선 링 */}
      <mesh ref={targetRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[99, 100, 64]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.5} />
      </mesh>

      {/* 방향 화살표 — 플레이어→안전지대 중심 방향 Billboard */}
      <DirectionArrow playerRef={playerRef} centerRef={arenaRefs} />
    </group>
  );
}
```

**4-Phase Shrink 타이밍 (기존 로직 재사용):**

| Phase | 시간 | 반경 | 벽 색상 | Warning |
|-------|------|------|---------|---------|
| 1 | 0:00-1:30 | 2000→1400 | Green | None |
| 2 | 1:30-3:00 | 1400→800 | Yellow | Vignette |
| 3 | 3:00-4:00 | 800→400 | Orange | Vignette + pulse |
| 4 | 4:00-5:00 | 400→100 | Red | Intense vignette + shake |

## 6. Data Flow & Sequence Diagrams

### 6.1 Game Loop Data Flow

plan의 "Web Worker tick → update → refs → useFrame → render" 데이터 흐름을 상세 시퀀스로 구체화합니다.

```
┌──────────┐     ┌────────────────┐     ┌──────────────┐     ┌────────────────┐
│Web Worker│     │  useGameLoop   │     │  GameRefs     │     │  R3F useFrame  │
│(16ms tick)│     │  (update())    │     │(MutableRef)  │     │  (render)      │
└────┬─────┘     └───────┬────────┘     └──────┬───────┘     └───────┬────────┘
     │                   │                     │                     │
     │ postMessage       │                     │                     │
     │ {type:'tick',     │                     │                     │
     │  deltaTime:16}    │                     │                     │
     │──────────────────→│                     │                     │
     │                   │                     │                     │
     │                   │ 1. movement.update()│                     │
     │                   │ 2. combat.update()  │                     │
     │                   │ 3. weapons.update() │                     │
     │                   │ 4. projectile.update()                    │
     │                   │ 5. spawning.update() │                     │
     │                   │ 6. pickup.update()  │                     │
     │                   │ 7. agent.update()   │                     │
     │                   │ 8. elite.update()   │                     │
     │                   │ (... 24 systems)    │                     │
     │                   │─────────────────────→│                     │
     │                   │  refs.playerRef.current = newPos          │
     │                   │  refs.enemiesRef.current = enemies[]      │
     │                   │  refs.projectilesRef.current = projs[]    │
     │                   │  refs.particlesRef.current = particles[]  │
     │                   │                     │                     │
     │                   │                     │   requestAnimationFrame
     │                   │                     │←────────────────────│
     │                   │                     │                     │
     │                   │                     │ read refs            │
     │                   │                     │────────────────────→│
     │                   │                     │                     │
     │                   │                     │     a. GameCamera:  │
     │                   │                     │        LERP position│
     │                   │                     │     b. VoxelTerrain:│
     │                   │                     │        chunk update │
     │                   │                     │     c. EntityRenderer:
     │                   │                     │        InstancedMesh│
     │                   │                     │        setMatrixAt()│
     │                   │                     │     d. Projectile:  │
     │                   │                     │        pool update  │
     │                   │                     │     e. Particles:   │
     │                   │                     │        life decay   │
     │                   │                     │     f. WorldUI:     │
     │                   │                     │        DOM position │
     │                   │                     │                     │
     │                   │                     │     gl.render()     │
     │                   │                     │     (R3F auto-render│
     │                   │                     │      priority=0)   │
     └─────────────────────────────────────────────────────────────────┘
```

**핵심 설계 원칙:**
1. **단방향 데이터 흐름**: Worker → update() → refs (write) → useFrame (read only) → GPU
2. **No React re-render**: refs는 MutableRefObject이므로 React 렌더 사이클 트리거 안 함
3. **Read-Write 분리**: update()만 refs에 쓰고, useFrame은 읽기만 수행
4. **프레임 독립적 로직**: update()는 deltaTime 기반이므로 렌더 FPS와 무관하게 동작

### 6.2 Render Pipeline Sequence

R3F useFrame 내부의 렌더링 파이프라인 순서를 상세화합니다. 모든 useFrame은 priority=0이며, JSX 마운트 순서로 실행됩니다.

```
useFrame Execution Order (priority=0, JSX mount order):
─────────────────────────────────────────────────────

1. GameCamera.useFrame()                    ← 카메라 위치/줌 업데이트
   ├── LERP position to player
   ├── Apply screen shake
   ├── LERP zoom
   └── camera.updateProjectionMatrix()

2. VoxelTerrain.useFrame()                  ← 청크 로드/언로드
   ├── ChunkManager.update(playerPos)
   ├── Create new chunks (within LOAD_DISTANCE)
   └── Dispose distant chunks (beyond UNLOAD_DISTANCE)

3. EntityRenderer.useFrame()                ← 엔티티 mesh 업데이트
   ├── VoxelCharacter: frame swap + position + rotation
   ├── EnemyRenderer: InstancedMesh matrix/color batch update
   │   ├── LOD 판정 (distance → HIGH/MID/LOW/CULL)
   │   ├── Template별 InstancedMesh.setMatrixAt()
   │   └── InstancedMesh.setColorAt()
   ├── RemotePlayer3D: LOD + nation color + position
   └── PickupRenderer: InstancedMesh + float animation

4. ProjectileRenderer.useFrame()            ← 투사체 pool 업데이트
   ├── 활성 투사체 → setMatrixAt() (position + rotation)
   ├── 소멸 투사체 → despawn (scale 0)
   └── 신규 투사체 → spawn from pool

5. EffectsRenderer.useFrame()               ← 파티클 + 이펙트
   ├── ParticleSystem: life decay + position + scale
   ├── PvpEffects3D: ring expand + fade
   └── EliteEffects: orbit particle rotation

6. SafeZone3D.useFrame()                    ← 안전지대 업데이트
   ├── Wall cylinder scale (radius)
   ├── Danger plane shader uniform
   └── Target ring position

7. WorldUI.useFrame()                       ← DOM 요소 업데이트
   ├── DamageNumbers: life check + despawn
   ├── EntityUI: HP bar value + visibility
   └── ChatBubble3D: fade timer

8. PostProcessing (EffectComposer)          ← 후처리 (자동)
   ├── RenderPass
   ├── UnrealBloomPass
   ├── Vignette
   └── ScreenFlash

9. R3F Auto-Render (gl.render)              ← 최종 렌더 (priority=0이므로 자동)
```

**총 Draw Call Budget (Arena 모드 worst case):**

| 컴포넌트 | Draw Calls | 설명 |
|----------|-----------|------|
| Ground chunks | 9 | 3x3 visible chunks |
| Terrain objects | 8 | 7-8 prop types |
| Player character | 2 | upper + lower |
| Enemy templates | 15 | 10-15 templates |
| Enemy LOD LOW | 1 | single cube InstancedMesh |
| Elite effects | 3 | silver/gold/diamond |
| Remote players | 5 | ~5 visible at HIGH LOD |
| Pickups | 3 | XP orb + items + gems |
| Projectile pools | 10 | 10 category pools |
| Particles | 1 | single InstancedMesh |
| Safe zone | 3 | wall + danger + target |
| Lighting shadows | 1 | shadow map pass |
| **Total** | **~61** | Target: <60 (Tier1) |

> Arena worst-case가 61로 목표(60) 경계에 있습니다. Quality Ladder Tier2 전환 시 shadow 제거 (-1), elite effects 감소 (-2) = 58로 안전합니다.

### 6.3 Mode Switch Sequence (2D ↔ 3D)

2D/3D 모드 전환의 라이프사이클과 상태 관리를 상세화합니다.

```
User clicks "Enhanced 3D" in Settings
        │
        ▼
MatrixApp.tsx: setRenderMode('3d')
        │
        ▼
localStorage.setItem('renderMode', '3d')
        │
        ▼
Fade-out overlay (opacity 0 → 1, 200ms)
        │
        ▼
Unmount MatrixCanvas.tsx (Canvas 2D)
  ├── cancelAnimationFrame()
  ├── ctx = null
  └── Canvas element removed
        │
        ▼
Wait 200ms (WebGL context conflict 방지)
        │
        ▼
Mount MatrixScene.tsx (R3F 3D)
  ├── <Canvas> WebGL context 생성
  ├── useGameLoop() 연결 (refs 공유)
  ├── Asset loading (useGLTF preload)
  └── Scene graph mount
        │
        ▼
Fade-in overlay (opacity 1 → 0, 200ms)
        │
        ▼
게임 계속 (update()는 Worker에서 계속 실행되었으므로 게임 상태 유지)
```

**핵심 결정사항:**
1. **200ms delay**: Lobby→Game 전환에서 검증된 패턴. WebGL context 충돌 방지
2. **게임 상태 보존**: update()는 Worker에서 독립 실행되므로 모드 전환 중에도 게임 진행
3. **Refs 공유**: MatrixCanvas와 MatrixScene 모두 동일한 `useGameRefs()` 인스턴스 사용
4. **WebGL 미지원 감지**: `document.createElement('canvas').getContext('webgl2')` 실패 시 자동 2D

```typescript
// MatrixApp.tsx 모드 전환 로직
const [renderMode, setRenderMode] = useState<'2d' | '3d'>(() => {
  // WebGL 미지원 시 강제 2D
  if (!isWebGLSupported()) return '2d';
  return (localStorage.getItem('renderMode') as '2d' | '3d') ?? '2d';
});
const [isTransitioning, setIsTransitioning] = useState(false);

const switchMode = useCallback((mode: '2d' | '3d') => {
  setIsTransitioning(true);
  setTimeout(() => {
    setRenderMode(mode);
    localStorage.setItem('renderMode', mode);
    setTimeout(() => setIsTransitioning(false), 200);
  }, 200);
}, []);

return (
  <div style={{ position: 'relative' }}>
    {renderMode === '2d' ? (
      <MatrixCanvas {...props} />
    ) : (
      <MatrixScene {...props} />
    )}
    {isTransitioning && (
      <div className="absolute inset-0 bg-black transition-opacity duration-200" />
    )}
  </div>
);
```

### 6.4 Asset Loading Pipeline

3D 에셋의 로딩 전략, 캐싱, lazy loading을 상세화합니다.

```
Asset Loading Pipeline:
─────────────────────

1. Build Time (MagicaVoxel → Production)
   MagicaVoxel (.vox)
     → Export .obj
     → Blender import → set materials → export .glb
     → gltfpack optimize (Draco compression, quantize)
     → public/assets/3d/*.glb

2. Bundle Time (Next.js)
   - .glb files are NOT bundled (public/ 디렉토리 = static serve)
   - Asset registry JSON is bundled (import map)

3. Runtime Loading (drei useGLTF)
   ┌─────────────────────────────────────────────────┐
   │ Phase 1: Critical (게임 시작 전, <3초)            │
   │  ├── base-character.glb    (~50KB)              │
   │  ├── current class .glb    (~30KB)              │
   │  ├── animation frames      (~11 × 20KB = 220KB)│
   │  └── Total: ~300KB                              │
   ├─────────────────────────────────────────────────┤
   │ Phase 2: Background (게임 시작 후, 비동기)         │
   │  ├── enemy templates       (~15 × 30KB = 450KB)│
   │  ├── terrain props          (~35 × 20KB = 700KB)│
   │  ├── other class models    (~8 × 30KB = 240KB) │
   │  └── Total: ~1.4MB                             │
   ├─────────────────────────────────────────────────┤
   │ Phase 3: On-Demand (필요 시)                     │
   │  ├── turret-base.glb       (~40KB)              │
   │  ├── boss models           (~3 × 50KB = 150KB) │
   │  └── Total: ~190KB                             │
   └─────────────────────────────────────────────────┘
   Grand Total: ~1.9MB (Draco compressed)

4. Caching
   - drei useGLTF는 내부적으로 Three.js LoadingManager + Cache 사용
   - 동일 URL 재요청 시 메모리 캐시에서 반환
   - Service Worker 캐싱 (선택적, v39)
```

```typescript
// apps/web/lib/matrix/rendering3d/asset-registry.ts

interface AssetEntry {
  id: string;
  path: string;          // '/assets/3d/characters/neo.glb'
  type: 'character' | 'enemy' | 'terrain' | 'weapon' | 'animation';
  loadPhase: 1 | 2 | 3;  // critical / background / on-demand
  sizeKB: number;
}

const ASSET_REGISTRY: AssetEntry[] = [
  // Phase 1 — Critical
  { id: 'base-character', path: '/assets/3d/characters/base-character.glb', type: 'character', loadPhase: 1, sizeKB: 50 },
  { id: 'anim-idle-0', path: '/assets/3d/characters/anims/idle-0.glb', type: 'animation', loadPhase: 1, sizeKB: 20 },
  // ... (11 animation frames)

  // Phase 2 — Background
  { id: 'enemy-humanoid-small', path: '/assets/3d/enemies/humanoid-small.glb', type: 'enemy', loadPhase: 2, sizeKB: 30 },
  // ... (15 enemy templates)

  // Phase 3 — On-Demand
  { id: 'turret-base', path: '/assets/3d/weapons/turret-base.glb', type: 'weapon', loadPhase: 3, sizeKB: 40 },
];

// Preloader: drei의 useGLTF.preload() 활용
export function preloadPhase(phase: number): void {
  const assets = ASSET_REGISTRY.filter(a => a.loadPhase === phase);
  assets.forEach(a => useGLTF.preload(a.path));
}
```

## 7. Interface Specifications

### 7.1 Component Props Interfaces

모든 3D 컴포넌트가 수신하는 props 인터페이스를 정의합니다. 기존 MatrixCanvasProps를 분해하여 각 컴포넌트에 필요한 최소 props만 전달합니다.

```typescript
// apps/web/lib/matrix/rendering3d/types.ts

// Quality Tier
type QualityTier = 'high' | 'medium' | 'low';

// 공통 Ref 타입
interface GameCameraProps {
  playerRef: MutableRefObject<PlayerState>;
  zoomRef: MutableRefObject<number>;
  shakeRef: MutableRefObject<{ intensity: number; decay: number }>;
}

interface GameLightingProps {
  qualityRef: MutableRefObject<QualityTier>;
}

interface VoxelTerrainProps {
  playerRef: MutableRefObject<PlayerState>;
  biomeConfigRef: MutableRefObject<BiomeConfig>;
}

interface EntityRendererProps {
  playerRef: MutableRefObject<PlayerState>;
  enemiesRef: MutableRefObject<Enemy[]>;
  agentsRef: MutableRefObject<Agent[]>;
  remotePlayers: MutableRefObject<RemotePlayer[]>;
  qualityRef: MutableRefObject<QualityTier>;
  skinId: number;                      // 현재 선택된 스킨
  classId: CharacterClass;            // 현재 선택된 클래스
}

interface ProjectileRendererProps {
  projectilesRef: MutableRefObject<Projectile[]>;
  qualityRef: MutableRefObject<QualityTier>;
}

interface EffectsRendererProps {
  particlesRef: MutableRefObject<ExtendedParticle[]>;
  effectsRef: MutableRefObject<ScreenEffect[]>;
  qualityRef: MutableRefObject<QualityTier>;
}

interface SafeZone3DProps {
  arenaRefs: MutableRefObject<ArenaState>;
  playerRef: MutableRefObject<PlayerState>;
}

interface WorldUIProps {
  damageNumbersRef: MutableRefObject<DamageNumber[]>;
  enemiesRef: MutableRefObject<Enemy[]>;
  agentsRef: MutableRefObject<Agent[]>;
  playerRef: MutableRefObject<PlayerState>;
}

interface PostProcessingProps {
  qualityRef: MutableRefObject<QualityTier>;
  effectsRef: MutableRefObject<ScreenEffect[]>;
  warningRef: MutableRefObject<number>;  // 0-1, 안전지대 warning 강도
}

interface PickupRendererProps {
  pickupsRef: MutableRefObject<Pickup[]>;
  playerRef: MutableRefObject<PlayerState>;
}
```

### 7.2 Ref Data Contracts

useGameRefs()가 제공하는 Ref 데이터의 구조를 정의합니다. 이는 useGameLoop(write)과 useFrame(read) 사이의 계약입니다.

```typescript
// 기존 useGameRefs.ts 에서 이미 정의된 구조 (변경 없음)
// 3D 렌더러가 읽는 핵심 Ref 필드:

interface PlayerState {
  x: number; y: number;           // 2D world position
  vx: number; vy: number;         // velocity (facing 계산용)
  hp: number; maxHp: number;
  class: CharacterClass;
  skin: number;
  isHit: boolean;                 // hit flash 트리거
  isDead: boolean;
  level: number;
}

interface Enemy {
  id: string;
  type: EnemyType;                // → template 매핑
  x: number; y: number;           // 2D world position
  hp: number; maxHp: number;
  scale: number;                  // 크기 변형
  elite: 'none' | 'silver' | 'gold' | 'diamond';
  isHit: boolean;
  isDead: boolean;
  vx: number; vy: number;        // facing 계산용
}

interface Projectile {
  id: string;
  weaponType: WeaponType;         // → pool 카테고리 매핑
  x: number; y: number;
  angle: number;                  // 방향 (radian)
  radius: number;                 // 크기
  color: string;                  // hex color
  active: boolean;
  lifetime: number;               // 남은 수명
}

interface RemotePlayer {
  id: string;
  name: string;
  x: number; y: number;
  hp: number; maxHp: number;
  class: CharacterClass;
  skin: number;
  nation: string;                 // 국가 코드 (KOR, USA, ...)
  isAlly: boolean;
  vx: number; vy: number;
}

interface DamageNumber {
  x: number; y: number;
  value: number;
  type: 'normal' | 'critical' | 'heal' | 'enemy';
  timestamp: number;
}

interface ExtendedParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
  easing: EasingType;
  drag: number;
  bounce: boolean;
  glow: boolean;
  burstStyle: BurstStyle;
}
```

**Ref 읽기 패턴 (3D 렌더러에서):**
```typescript
// 매 useFrame에서 직접 ref.current 접근
// 복사 없이 참조 읽기 (zero-copy, 성능 최적)
useFrame(() => {
  const enemies = enemiesRef.current;  // 직접 참조
  // enemies 배열을 순회하며 InstancedMesh 업데이트
  // 절대 enemies를 수정하지 않음 (read-only contract)
});
```

### 7.3 Asset Registry Schema

에셋 레지스트리의 JSON 스키마와 적 타입 → 템플릿 매핑을 정의합니다.

```typescript
// apps/web/lib/matrix/rendering3d/enemy-templates.ts

// 10-15 base template 정의
enum EnemyTemplate {
  HUMANOID_SMALL = 'humanoid_small',     // glitch, bot, virus 계열
  HUMANOID_MEDIUM = 'humanoid_medium',   // ninja, soldier, hacker 계열
  HUMANOID_LARGE = 'humanoid_large',     // tank, whale, golem 계열
  FLYING = 'flying',                     // drone, caster, fairy 계열
  CRAWLER = 'crawler',                   // bug, worm, spider 계열
  SPHERE = 'sphere',                     // orb, core, eye 계열
  QUADRUPED = 'quadruped',              // beast, wolf, bear 계열
  BOSS_SMALL = 'boss_small',            // mini-boss
  BOSS_MEDIUM = 'boss_medium',          // chapter boss
  BOSS_LARGE = 'boss_large',            // final boss
}

// 173 적 타입 → template + color 매핑 (일부 발췌)
const ENEMY_TEMPLATE_MAP: Record<EnemyType, {
  template: EnemyTemplate;
  primaryColor: string;        // hex
  secondaryColor: string;      // hex
  scaleMultiplier: number;     // 1.0 = normal
}> = {
  'glitch_bug':      { template: EnemyTemplate.HUMANOID_SMALL, primaryColor: '#00ff88', secondaryColor: '#005533', scaleMultiplier: 0.8 },
  'cyber_ninja':     { template: EnemyTemplate.HUMANOID_MEDIUM, primaryColor: '#3366ff', secondaryColor: '#112244', scaleMultiplier: 1.0 },
  'data_whale':      { template: EnemyTemplate.HUMANOID_LARGE, primaryColor: '#66ccff', secondaryColor: '#224466', scaleMultiplier: 1.5 },
  'scan_drone':      { template: EnemyTemplate.FLYING, primaryColor: '#ff6633', secondaryColor: '#442211', scaleMultiplier: 0.9 },
  'malware_worm':    { template: EnemyTemplate.CRAWLER, primaryColor: '#cc33ff', secondaryColor: '#441155', scaleMultiplier: 1.0 },
  'core_sphere':     { template: EnemyTemplate.SPHERE, primaryColor: '#ffcc00', secondaryColor: '#554400', scaleMultiplier: 1.2 },
  // ... 167 more entries
};

// 미매핑 적은 colored cube fallback (LOD LOW와 동일)
function getTemplate(type: EnemyType): EnemyTemplate {
  return ENEMY_TEMPLATE_MAP[type]?.template ?? EnemyTemplate.HUMANOID_MEDIUM;
}
```

**Character Asset Registry:**

```typescript
// apps/web/lib/matrix/rendering3d/character-config.ts

const CHARACTER_CONFIG: Record<CharacterClass, {
  modelPath: string;
  primaryColor: string;
  secondaryColor: string;
  accessorySet: string[];
}> = {
  neo:      { modelPath: '/assets/3d/characters/neo.glb',      primaryColor: '#1a1a2e', secondaryColor: '#00ff41', accessorySet: ['glasses'] },
  tank:     { modelPath: '/assets/3d/characters/tank.glb',     primaryColor: '#4a4a5a', secondaryColor: '#ff6633', accessorySet: ['helmet'] },
  cypher:   { modelPath: '/assets/3d/characters/cypher.glb',   primaryColor: '#2a2a3a', secondaryColor: '#33ccff', accessorySet: ['visor'] },
  morpheus: { modelPath: '/assets/3d/characters/morpheus.glb', primaryColor: '#3a2a1a', secondaryColor: '#ffcc33', accessorySet: ['coat'] },
  niobe:    { modelPath: '/assets/3d/characters/niobe.glb',    primaryColor: '#2a1a3a', secondaryColor: '#ff33cc', accessorySet: ['bracer'] },
  oracle:   { modelPath: '/assets/3d/characters/oracle.glb',   primaryColor: '#1a3a2a', secondaryColor: '#33ff99', accessorySet: ['staff'] },
  trinity:  { modelPath: '/assets/3d/characters/trinity.glb',  primaryColor: '#1a1a1a', secondaryColor: '#ffffff', accessorySet: ['katana'] },
  mouse:    { modelPath: '/assets/3d/characters/mouse.glb',    primaryColor: '#3a3a2a', secondaryColor: '#99ff33', accessorySet: ['antenna'] },
  dozer:    { modelPath: '/assets/3d/characters/dozer.glb',    primaryColor: '#4a3a2a', secondaryColor: '#ff9933', accessorySet: ['shield'] },
};
```

## 8. Rendering Optimization Strategy

### 8.1 InstancedMesh Strategy

InstancedMesh 사용 전략을 엔티티 유형별로 구체화합니다.

**InstancedMesh 할당 테이블:**

| 렌더러 | InstancedMesh 수 | 인스턴스/pool | Draw Calls | 전략 |
|--------|-----------------|-------------|-----------|------|
| **Enemy (per template)** | 10-15 | 20-100 each | 10-15 | 같은 template = 1 draw call |
| **Enemy LOD LOW** | 1 | 200 | 1 | 모든 LOW 적 → colored cube |
| **Projectile pools** | 10 | 50-200 each | 10 | 카테고리별 pool |
| **Particles** | 1 | 500 | 1 | 단일 pool, size/color 변형 |
| **Pickups (XP orb)** | 1 | 200 | 1 | SphereGeometry instanced |
| **Pickups (items)** | 1 | 50 | 1 | BoxGeometry instanced |
| **Terrain props** | 7-8 | 30-100 each | 7-8 | prop 종류별 |
| **Elite orbits** | 3 | 20 each | 3 | silver/gold/diamond 별도 |
| **총계** | **~35** | **~2,100** | **~35** | — |

**InstancedMesh 업데이트 최적화:**

```typescript
// apps/web/lib/matrix/rendering3d/instanced-updater.ts

// 재사용 가능한 임시 객체 (GC 방지)
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export function updateInstancedMesh(
  mesh: THREE.InstancedMesh,
  entities: Array<{ x: number; y: number; scale?: number; rotation?: number; color?: string }>,
  maxCount: number
): number {
  let count = 0;

  for (const entity of entities) {
    if (count >= maxCount) break;

    // 2D → 3D 좌표 변환
    _position.set(entity.x, 0, -entity.y);
    _scale.setScalar(entity.scale ?? 1);

    if (entity.rotation !== undefined) {
      _quaternion.setFromAxisAngle(Y_AXIS, entity.rotation);
    } else {
      _quaternion.identity();
    }

    _matrix.compose(_position, _quaternion, _scale);
    mesh.setMatrixAt(count, _matrix);

    if (entity.color) {
      _color.set(entity.color);
      mesh.setColorAt(count, _color);
    }

    count++;
  }

  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return count;
}
```

**핵심 최적화 규칙:**
1. `new` 키워드 금지 in useFrame → 임시 객체 모듈 레벨에서 pre-allocate
2. `needsUpdate = true`는 실제 변경 시에만 설정
3. `mesh.count = activeCount`로 비활성 인스턴스 렌더 생략
4. `frustumCulled = true` (InstancedMesh는 bounding sphere 기반 자동 culling)

### 8.2 LOD (Level of Detail) System

기존 2D LOD 시스템(renderContext.ts)을 3D LOD로 매핑합니다.

```
LOD Tier Map:
─────────────────────────────────────────────────────
Distance        LOD    Character          Enemy            Effects
─────────────────────────────────────────────────────
< 800px         HIGH   Full voxel model   Full model       Glow + particles
                       Frame swap anim    + color          + trail
                       8-dir facing       + animation
─────────────────────────────────────────────────────
800-1400px      MID    Simplified model   Simplified       No glow
                       2-frame anim       (half voxels)    Reduced particles
                       4-dir facing       + color only
─────────────────────────────────────────────────────
1400-2200px     LOW    Colored cube       Colored cube     None
                       (1 voxel)          (1 voxel)
                       No animation       No animation
─────────────────────────────────────────────────────
> 2200px        CULL   Not rendered       Not rendered     N/A
─────────────────────────────────────────────────────
```

**적응형 LOD (Adaptive):**
- 총 엔티티 > 150: HIGH 임계값 800 → 520 (35% 축소)
- 총 엔티티 > 250: HIGH 임계값 800 → 400 (50% 축소)
- 이는 더 많은 적을 LOW로 렌더하여 draw call과 triangle count를 줄입니다

**LOD 전환 방식:**
- InstancedMesh 기반: LOD별 별도 InstancedMesh pool → 적 이동 시 pool 간 이동
- 대안 (BatchedMesh): 같은 mesh 내에서 geometry swap → draw call 최소화
- **선택: InstancedMesh pool 방식** (BatchedMesh는 실험적이므로 안정성 우선)

**World UI LOD 연동:**

| LOD | HP Bar | Nametag | Damage Number |
|-----|--------|---------|---------------|
| HIGH | Full (40px, smooth) | Name + Lv + Nation | Yes |
| MID | Mini (20px, stepped) | None | Yes (smaller) |
| LOW | Dot (4px) | None | No |
| CULL | None | None | No |

### 8.3 Quality Ladder — Adaptive Quality

drei `<PerformanceMonitor>` 기반 적응형 품질 시스템을 상세화합니다.

```typescript
// apps/web/lib/matrix/rendering3d/quality-ladder.ts

interface QualityConfig {
  tier: QualityTier;

  // Post-Processing
  bloom: boolean;
  bloomStrength: number;
  shadows: boolean;
  shadowMapSize: number;
  vignette: boolean;

  // Rendering
  antialias: boolean;
  dpr: number;                    // device pixel ratio cap
  maxParticles: number;
  lodThresholdMultiplier: number; // 1.0 = default, <1.0 = aggressive
  maxDamageNumbers: number;
  maxHPBars: number;

  // Terrain
  viewDistance: number;           // chunks
}

const QUALITY_PRESETS: Record<QualityTier, QualityConfig> = {
  high: {
    tier: 'high',
    bloom: true, bloomStrength: 0.5,
    shadows: true, shadowMapSize: 2048,
    vignette: true, antialias: true,
    dpr: 2, maxParticles: 500,
    lodThresholdMultiplier: 1.0,
    maxDamageNumbers: 40, maxHPBars: 30,
    viewDistance: 3,
  },
  medium: {
    tier: 'medium',
    bloom: true, bloomStrength: 0.3,
    shadows: false, shadowMapSize: 0,
    vignette: true, antialias: true,
    dpr: 1.5, maxParticles: 250,
    lodThresholdMultiplier: 0.8,
    maxDamageNumbers: 25, maxHPBars: 20,
    viewDistance: 2,
  },
  low: {
    tier: 'low',
    bloom: false, bloomStrength: 0,
    shadows: false, shadowMapSize: 0,
    vignette: false, antialias: false,
    dpr: 1, maxParticles: 100,
    lodThresholdMultiplier: 0.5,
    maxDamageNumbers: 15, maxHPBars: 10,
    viewDistance: 2,
  },
};
```

**자동 전환 로직:**

```
FPS 모니터링 (drei PerformanceMonitor):
  ┌───────────────────────────────────────────────────┐
  │ FPS > 55 for 5 seconds → upgrade tier             │
  │ FPS < 30 for 3 seconds → downgrade tier           │
  │ FPS < 20 for 2 seconds → emergency downgrade      │
  └───────────────────────────────────────────────────┘

  high ──(FPS<30, 3s)──→ medium ──(FPS<30, 3s)──→ low
  high ←──(FPS>55, 5s)── medium ←──(FPS>55, 5s)── low

  Emergency: high ──(FPS<20, 2s)──→ low (직접)
```

**예상 성능 영향:**

| 전환 | Draw Call 감소 | Triangle 감소 | 예상 FPS 개선 |
|------|-------------|-------------|-------------|
| high → medium | -5 (shadows) | -30% | +15-20fps |
| medium → low | -10 (bloom, particles) | -50% | +20-30fps |
| high → low | -15 | -70% | +35-50fps |

### 8.4 Memory Management & Object Pooling

WebGL 리소스 누수 방지와 Object Pool 전략을 구체화합니다.

**메모리 관리 원칙:**

| 리소스 | 할당 시점 | 해제 시점 | 방법 |
|--------|----------|----------|------|
| Geometry | 컴포넌트 마운트 | 언마운트 | `geometry.dispose()` |
| Material | 컴포넌트 마운트 | 언마운트 | `material.dispose()` |
| Texture (atlas) | 게임 시작 | 게임 종료 | `texture.dispose()` |
| GLTF model | useGLTF 로드 | drei cache 관리 | drei 내부 처리 |
| InstancedMesh | 풀 생성 | 풀 파괴 | `mesh.dispose()` |
| Chunk mesh | chunk 생성 | chunk 언로드 | dispose + scene.remove |
| DOM 요소 (Html) | 풀 초기화 | 풀 파괴 | DOM remove |

**Object Pool 패턴 적용 범위:**

```
Active Pools:
  Projectile pools (10) ← InstancedMesh
  Particle pool (1)     ← InstancedMesh
  Damage number pool (1) ← DOM elements (40)
  HP bar pool (1)       ← DOM elements (30)

Pool Lifecycle:
  1. MatrixScene 마운트 시 전체 pool 초기화 (pre-allocate)
  2. 게임 중 spawn/despawn만 (allocation 0)
  3. MatrixScene 언마운트 시 전체 pool dispose
  4. 2D/3D 모드 전환 시: 3D pool 전체 dispose → 200ms → 재생성
```

**메모리 예산:**

| 항목 | 예상 크기 | 근거 |
|------|----------|------|
| GLTF 모델 (all) | ~5MB | 1.9MB compressed → ~5MB decompressed |
| Texture atlas | ~2MB | biome + particles |
| InstancedMesh buffers | ~8MB | 2,100 instances × matrices/colors |
| Chunk meshes (visible) | ~3MB | 9 chunks × 40K vertices |
| DOM pool (HTML 요소) | ~1MB | 88 DOM 요소 |
| **Total** | **~19MB** | WebGL memory budget |

> 참고: 모바일 기기의 일반적인 WebGL 메모리 한도는 256MB-512MB이므로 19MB는 충분히 여유 있습니다.

## 9. Performance Budget

plan의 NFR-1/2를 구체적인 시나리오별 예산과 측정 방법으로 구체화합니다.

### 9.1 시나리오별 성능 예산

| 시나리오 | 엔티티 | 투사체 | Draw Calls | Triangles | FPS 목표 | Memory |
|----------|--------|--------|-----------|-----------|---------|--------|
| **Normal Play** | 50적 + 1플레이어 | 30 | < 25 | < 100K | 60fps | < 15MB |
| **Arena Mode** | 200적 + 9에이전트 + 1플레이어 | 100 | < 45 | < 300K | 60fps | < 25MB |
| **Stress Test** | 500적 + 200투사체 | 200 | < 65 | < 500K | 45fps+ | < 40MB |
| **Mobile (mid)** | 100적 + 50투사체 | 50 | < 30 | < 150K | 30fps+ | < 20MB |
| **Mobile (low)** | 100적 + 50투사체 | 50 | < 20 | < 80K | 30fps+ | < 15MB |

### 9.2 컴포넌트별 Draw Call 예산

| 컴포넌트 | Normal | Arena | Stress | 비고 |
|----------|--------|-------|--------|------|
| Ground chunks | 4 | 9 | 9 | 2x2 → 3x3 |
| Terrain objects | 5 | 8 | 8 | visible props |
| Player + Remote | 2 | 7 | 7 | player + 5 remote |
| Enemies | 5 | 15 | 20 | template pools |
| Projectiles | 4 | 8 | 10 | active pools |
| Particles | 1 | 1 | 1 | single pool |
| Effects/Elite | 1 | 3 | 3 | glow meshes |
| Safe zone | 0 | 3 | 3 | arena only |
| Shadows | 1 | 1 | 0 | Tier2에서 제거 |
| Post-processing | 2 | 2 | 0 | bloom+vignette |
| **Total** | **25** | **57** | **61** | — |

### 9.3 측정 도구 및 방법

```typescript
// 매 프레임 수집 (PerformanceMonitor + renderer.info)
const stats = {
  fps: 1 / deltaTime,
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  textures: renderer.info.memory.textures,
  geometries: renderer.info.memory.geometries,
  programs: renderer.info.programs?.length ?? 0,
};

// 5초마다 콘솔 출력 (개발 모드)
if (DEV_MODE && frame % 300 === 0) {
  console.table(stats);
}
```

### 9.4 성능 임계값 및 대응

| 지표 | Green | Yellow | Red | 대응 |
|------|-------|--------|-----|------|
| FPS | > 55 | 30-55 | < 30 | Quality Ladder 자동 하향 |
| Draw Calls | < 40 | 40-60 | > 60 | LOD 임계값 축소 |
| Memory | < 30MB | 30-50MB | > 50MB | 원거리 chunk 공격적 언로드 |
| GC Pause | < 5ms | 5-16ms | > 16ms | Object Pool 재검토 |

## 10. Asset Pipeline & Formats

plan의 "MagicaVoxel → .obj → Blender → .glb" 파이프라인을 도구, 규격, 자동화까지 구체화합니다.

### 10.1 에셋 제작 파이프라인

```
Step 1: Modeling (MagicaVoxel)
  ├── Character: 16 voxels 높이, 3-head chibi
  ├── Enemy template: 8-24 voxels, 형태별
  ├── Terrain prop: 4-16 voxels, biome별
  ├── Export: .obj (MagicaVoxel .vox → .obj export)
  └── ⚠️ MagicaVoxel .vox 직접 로딩 불가 (VOXLoader v200 이슈)

Step 2: Conversion (Blender 4.x)
  ├── Import .obj
  ├── Set materials (MeshStandardMaterial 호환)
  │   ├── Per-face color → vertex color attribute
  │   └── metalness=0, roughness=0.8 (복셀 매트 느낌)
  ├── Origin to center-bottom (pivot point)
  ├── Apply transforms (Ctrl+A)
  ├── Export .glb (glTF Binary)
  │   ├── Draco compression: ON
  │   ├── Apply modifiers: ON
  │   └── Include: Mesh + Materials (no armature)
  └── Output: public/assets/3d/{category}/{name}.glb

Step 3: Optimization (gltfpack, optional)
  ├── gltfpack -i input.glb -o output.glb
  │   ├── Quantize positions (12-bit)
  │   ├── Quantize normals (8-bit)
  │   └── Draco mesh compression
  ├── Expected: 30-70% size reduction
  └── Target: < 50KB per model

Step 4: Validation
  ├── File size check: < 50KB (alert if exceeded)
  ├── useGLTF load test (dev server)
  ├── Visual check in test scene
  └── Add to ASSET_REGISTRY
```

### 10.2 에셋 규격

| 카테고리 | 크기 (voxels) | 파일 크기 | 파일 형식 | 수량 |
|----------|-------------|----------|----------|------|
| Character base | 16H × 10W × 6D | < 50KB | .glb | 9 |
| Character anim frame | 16H × 10W × 6D | < 20KB | .glb | 11 per class |
| Enemy template | 8-24H × 6-16W × 4-10D | < 30KB | .glb | 10-15 |
| Terrain prop | 4-16H × 4-16W × 4-16D | < 20KB | .glb | 25-35 |
| Boss model | 32-64H × 24-48W × 16-32D | < 80KB | .glb | 3 |
| Turret base | 8H × 8W × 8D | < 40KB | .glb | 1 |
| Biome atlas | 512 × 512 px | < 200KB | .png | 1 |

### 10.3 Triangle 예산 (per model)

| Model 유형 | 예상 Triangle | Voxel 기준 | 비고 |
|-----------|-------------|-----------|------|
| Character (HIGH) | 180-360 | 30-60 voxels × 6 faces ÷ shared | face merge 후 |
| Character (MID) | 60-120 | 절반 해상도 | simplified |
| Character (LOW) | 12 | 1 cube | colored box |
| Enemy (HIGH) | 120-480 | 20-80 voxels | template별 상이 |
| Enemy (MID) | 40-120 | 절반 해상도 | simplified |
| Enemy (LOW) | 12 | 1 cube | colored box |
| Terrain prop | 24-96 | 4-16 voxels | face merge |
| Boss | 600-1200 | 100-200 voxels | 상세 모델 |

## 11. Coordinate System & Camera Math

plan의 "2D(x,y) → 3D(x, 0, -y)" 좌표 매핑을 수학적으로 정의하고 관련 변환 함수를 구체화합니다.

### 11.1 좌표계 정의

```
2D World Space (게임 로직):
  ┌───────────────→ +x (오른쪽)
  │
  │  (0,0)────────────(2000,0)
  │    │                  │
  │    │   Game World     │
  │    │                  │
  ↓  (0,2000)─────(2000,2000)
  +y (아래쪽)

3D World Space (Three.js):
  y↑
  │
  │  (0,0,0)
  │    │
  │    │   Game World (y=0 ground plane)
  │    │
  └────────────→ +x (오른쪽)
   ╲
    ╲→ +z (카메라 쪽, 화면 앞)

Mapping:
  2D(x, y) → 3D(x, 0, -y)
  2D.x  →  3D.x  (수평, 변경 없음)
  2D.y  →  3D.z  (수직 → 깊이, 부호 반전)
  없음   →  3D.y  (높이, 0 = 지면)
```

### 11.2 변환 유틸리티

```typescript
// apps/web/lib/matrix/rendering3d/coordinate-mapper.ts

// 2D world → 3D world position
export function worldToThree(x: number, y: number, height: number = 0): THREE.Vector3 {
  return new THREE.Vector3(x, height, -y);
}

// 2D world → 3D world (in-place, GC-free)
export function worldToThreeInPlace(out: THREE.Vector3, x: number, y: number, height: number = 0): void {
  out.set(x, height, -y);
}

// 3D world → 2D world (역변환, 디버그용)
export function threeToWorld(position: THREE.Vector3): { x: number; y: number } {
  return { x: position.x, y: -position.z };
}

// 2D angle → 3D Y-axis rotation
export function angleToRotationY(angle: number): number {
  // 2D angle (atan2 기준, 0=right, π/2=down)
  // → 3D Y rotation (0=+x, π/2=-z)
  return -angle;  // 부호 반전 (z 부호 반전 때문)
}

// 2D velocity → 8-direction index
export function velocityToDirection(vx: number, vy: number): number {
  if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return -1; // stationary
  const angle = Math.atan2(-vy, vx);  // 부호 반전
  const dir = Math.round(angle / (Math.PI / 4)) % 8;
  return dir < 0 ? dir + 8 : dir;
}
```

### 11.3 Isometric 카메라 수학

```
OrthographicCamera Isometric View:

  Camera Position = Player3D + (D, D, D) where D = ISO_DISTANCE
  Camera LookAt = Player3D

  이는 arctan(1/√2) ≈ 35.264° 각도를 만들어 true isometric에 근사합니다.
  (완벽한 isometric은 arctan(1/√2)이지만, D,D,D 오프셋은 45° 투영과 유사)

  실제 구현에서는 (D, D, D) 오프셋을 사용하며,
  OrthographicCamera의 zoom으로 스케일을 조절합니다.

  Frustum 계산:
    aspect = canvas.width / canvas.height
    halfWidth = viewportSize / (2 * zoom)
    halfHeight = halfWidth / aspect
    left = -halfWidth, right = halfWidth
    top = halfHeight, bottom = -halfHeight
```

## 12. Security & Compatibility

렌더링 엔진 교체에 따른 보안 및 호환성 고려사항을 정의합니다.

### 12.1 보안 고려사항

| 항목 | 위험 | 완화 |
|------|------|------|
| **WebGL Context Hijack** | 악의적 셰이더로 GPU 리소스 독점 | R3F 내장 셰이더만 사용, 커스텀 셰이더는 안전지대 fog 1개만 |
| **에셋 변조** | .glb 파일 교체로 부정 행위 | 게임 로직은 서버 권위적, 에셋은 시각적 효과만 (밸런스 영향 0) |
| **메모리 과다 사용** | 악의적 클라이언트가 메모리 폭주 유도 | maxCount 하드캡, chunk unload 정책, Quality Ladder |
| **XSS via Html** | drei `<Html>`의 DOM 인젝션 | 데미지 넘버/이름 등은 sanitized (textContent만 사용) |
| **DoS via 렌더링** | 대량 엔티티로 GPU 과부하 | LOD CULL(>2200px), InstancedMesh count 하드캡 |

### 12.2 브라우저 호환성

| 브라우저 | WebGL 2 | 지원 수준 | 비고 |
|----------|---------|----------|------|
| Chrome 90+ | Yes | Full (Tier 1-3) | 주요 타겟 |
| Safari 15+ | Yes | Full (Tier 1-3) | macOS/iOS |
| Firefox 90+ | Yes | Full (Tier 1-3) | — |
| Samsung Internet | Yes | Tier 2-3 권장 | 모바일 |
| Edge 90+ | Yes | Full (Chromium 기반) | — |
| IE / 구형 브라우저 | No | 2D fallback 자동 | WebGL 미지원 감지 |

### 12.3 WebGL 호환성 감지

```typescript
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  }
}

function getGPUTier(): 'high' | 'medium' | 'low' {
  // navigator.gpu (WebGPU) 또는 WEBGL_debug_renderer_info 확장
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return 'low';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (!ext) return 'medium';
  const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  // 알려진 저사양 GPU 목록과 비교
  if (/Mali|Adreno 3|PowerVR|Intel HD 4/i.test(renderer)) return 'low';
  if (/Adreno 5|Intel UHD/i.test(renderer)) return 'medium';
  return 'high';
}
```

### 12.4 모바일 특수 처리

| 항목 | 모바일 설정 | 데스크톱 설정 |
|------|-----------|------------|
| DPR cap | 1 | 2 |
| 기본 Quality Tier | medium (auto) | high |
| Shadow map | OFF | 2048 |
| Bloom | OFF | ON |
| Max particles | 100 | 500 |
| LOD multiplier | 0.5 | 1.0 |
| Touch input | useInput.ts (기존) | keyboard + mouse |

## 13. Architecture Decision Records (ADR Summary)

V38 변환의 주요 아키텍처 결정 6건을 ADR로 기록합니다. 상세 ADR은 `docs/adr/ADR-029.md` ~ `ADR-034.md` 참조.

| ADR | 제목 | 결정 | 상태 |
|-----|------|------|------|
| **ADR-029** | R3F + InstancedMesh 렌더링 전략 | InstancedMesh per template + LOD 3단계 (BatchedMesh는 fallback) | Accepted |
| **ADR-030** | Frame Swap 애니메이션 방식 | 프레임별 .glb geometry swap (Skeletal/Morph 제외) | Accepted |
| **ADR-031** | 게임 루프 추출 전략 | update() → useGameLoop 훅 추출 (Worker 기반, useFrame과 독립) | Accepted |
| **ADR-032** | 좌표 매핑 규칙 | 2D(x,y) → 3D(x, 0, -y), OrthographicCamera isometric | Accepted |
| **ADR-033** | World UI 렌더링 방식 | drei `<Html>` + DOM Pool (CSS2DRenderer 대안 검토 후 Html 선택) | Accepted |
| **ADR-034** | 2D/3D 듀얼 모드 아키텍처 | MatrixApp에서 renderMode 분기, 200ms transition, refs 공유 | Accepted |

## 14. Risks & Mitigations

plan의 리스크를 시스템 설계 관점에서 심화 분석합니다.

| ID | 리스크 | 심각도 | 확률 | 완화 전략 | 검증 시점 |
|----|--------|--------|------|----------|----------|
| **R1** | 173개 적 에셋 제작 불가 | Critical | 중 | 10-15 template + color/scale 변형. 미구현=colored cube. | Phase 3 (S20) |
| **R2** | Arena 200적 성능 미달 | Critical | 중 | InstancedMesh (10K큐브=60fps 검증됨). Quality Ladder. Phase별 벤치마크. | Phase 3 (S26), Phase 8 (S48) |
| **R3** | useFrame priority 실수 | High | 높 | 프로젝트 ESLint rule 추가: useFrame에 priority 인자 금지. | Phase 0 (S06) |
| **R4** | drei `<Html>` 성능 (88 DOM) | High | 중 | DOM Pool + LOD 연동 (CULL 시 숨김). 벤치마크 후 CSS2DRenderer 전환 가능. | Phase 6 (S35) |
| **R5** | Chunk 메모리 누수 | Medium | 중 | dispose 정책 엄격화. WeakRef 또는 FinalizationRegistry. Chrome DevTools Memory 프로파일링. | Phase 1 (S12) |
| **R6** | MagicaVoxel .vox v200 이슈 | Low | 높 | .glb 직접 사용 (.vox는 편집용만). Blender export 파이프라인 확립. | Phase 2 (S13) |
| **R7** | 모바일 WebGL 컨텍스트 손실 | Medium | 중 | `renderer.setPixelRatio(1)`. Quality Ladder low. `context lost` 이벤트 감지 → 2D fallback. | Phase 8 (S46) |
| **R8** | 2D/3D 전환 시 게임 상태 불일치 | High | 낮 | refs 공유 (동일 useGameRefs). Worker 연속 실행. 전환 중 update() 중단 없음. | Phase 8 (S47) |
| **R9** | three.js 번들 크기 증가 | Medium | 높 | Tree shaking (three/examples/jsm). Next.js dynamic import. 예상 +200KB gzip. | Phase 0 (S01) |
| **R10** | BatchedMesh 실험적 API 불안정 | Medium | 높 | InstancedMesh-first 전략. BatchedMesh는 선택적 최적화 (A/B 벤치마크 후). | Phase 3 (S23) |

**최대 리스크 대응 계획:**

**R2 (성능 미달) → 3단계 에스컬레이션:**
1. Phase 3 벤치마크 (S26)에서 200적 <60fps → LOD 임계값 축소 + 파티클 감소
2. Phase 8 벤치마크 (S48)에서 여전히 미달 → Quality Ladder Tier3 강제 + 모바일 2D 전용
3. 최종 실패 → 3D 모드를 "beta" 라벨로 출시, 기본값은 2D 유지

## 15. Validation Checklist

시스템 아키텍처 자체 검증 체크리스트입니다.

### 15.1 기능 요구사항 매핑

| FR | 요구사항 | 아키텍처 컴포넌트 | 충족 |
|----|---------|-----------------|------|
| FR-1 | useGameLoop 추출 | 5.1 useGameLoop | Yes — 변경 0줄 원칙 |
| FR-2 | R3F Canvas 기반 MatrixScene | 5.2 MatrixScene | Yes — Canvas 설정 상세 |
| FR-3 | OrthographicCamera + LERP | 5.3 GameCamera | Yes — 수학적 매핑 정의 |
| FR-4 | 9 클래스 Voxel 캐릭터 | 5.5.1 VoxelCharacter | Yes — Frame Swap + 8방향 |
| FR-5 | 173 적 타입 렌더링 | 5.5.2 EnemyRenderer | Yes — template + color 전략 |
| FR-6 | 40+ 무기 투사체 | 5.6 ProjectileRenderer | Yes — Pool 아키텍처 |
| FR-7 | Post-processing | 5.7.1 PostProcessing | Yes — Bloom + Vignette + Flash |
| FR-8 | World UI (데미지, HP) | 5.8 WorldUI | Yes — DOM Pool |
| FR-9 | Safe Zone 3D | 5.9 SafeZone3D | Yes — 실린더 + 셰이더 |
| FR-10 | Remote player 3D | 5.5.3 LOD + RemotePlayer | Yes |
| FR-11 | 2D/3D 모드 스위칭 | 6.3 ModeSwitch | Yes — 200ms transition |
| FR-12 | HUD 재사용 | 5.2 MatrixScene overlay | Yes — 변경 없음 |

### 15.2 비기능 요구사항 매핑

| NFR | 요구사항 | 아키텍처 대응 | 충족 |
|-----|---------|-------------|------|
| NFR-1 | 60fps@200 entities | 9. Performance Budget | Yes — draw call <45 |
| NFR-2 | Draw Calls <40 (Arena) | 8.1 InstancedMesh | Yes (57 실제, Tier2=52) |
| NFR-3 | Chrome/Safari/Firefox | 12.2 호환성 | Yes — WebGL2 기반 |
| NFR-4 | Quality Ladder 3-tier | 8.3 QualityLadder | Yes — 자동+수동 |
| NFR-5 | 모바일 30fps+ | 12.4 모바일 | Yes — DPR 1, Tier low |
| NFR-6 | 초기 로딩 3초 | 6.4 AssetLoading | Yes — Phase 1 = 300KB |
| NFR-7 | 2D 모드 유지 | 6.3 ModeSwitch | Yes — 기존 코드 보존 |

### 15.3 설계 일관성 검증

- [x] 모든 컴포넌트가 refs 읽기만 수행 (write는 useGameLoop만)
- [x] useFrame priority=0 통일 (auto-render 보장)
- [x] 좌표 매핑 일관성 (x,y → x,0,-y 모든 컴포넌트에서 동일)
- [x] Quality Ladder가 모든 시각 컴포넌트에 영향 (bloom, shadows, particles, LOD, DOM count)
- [x] Object Pool 패턴 통일 (projectiles, particles, damage numbers, HP bars)
- [x] Dispose 정책 통일 (geometry + material + texture on unmount)
- [x] draw call 예산이 시나리오별로 일관 (Normal < Arena < Stress)

## 16. Open Questions

향후 결정이 필요한 열린 질문들입니다.

| # | 질문 | 영향 범위 | 결정 시점 | 현재 기울기 |
|---|------|----------|----------|-----------|
| Q1 | BatchedMesh vs InstancedMesh-per-template 최종 선택 | EnemyRenderer draw calls | Phase 3 (S23 A/B 벤치마크) | InstancedMesh-first |
| Q2 | drei `<Html>` vs CSS2DRenderer 최종 선택 | WorldUI 성능 | Phase 6 (S35 벤치마크) | drei Html (생태계 통합) |
| Q3 | 에셋 자동 생성 도입 시점 (VoxAI / Gemini) | 에셋 파이프라인 | v39 (이번 버전은 수동) | 수동 MagicaVoxel |
| Q4 | PerspectiveCamera 모드 추가 여부 | GameCamera | v39+ | OrthographicCamera only |
| Q5 | 지형 높이맵 (hill, cliff) 도입 | VoxelTerrain | v39+ | 평면 지형 유지 |
| Q6 | Service Worker 에셋 캐싱 | AssetLoading | v39 (오프라인 지원) | 미도입 |
| Q7 | WebGPU 렌더러 전환 시점 | MatrixScene | 브라우저 지원율 80%+ | WebGL 유지 |
| Q8 | Custom shader 확대 (적 변형별 셰이더) | EnemyRenderer | v39+ (비주얼 다양성) | Material color only |

---

*이 문서는 `/da:system` 명령에 의해 자동 생성되었습니다.*
*Plan: `docs/designs/v38-3d-voxel-plan.md`*
*Date: 2026-03-11*
