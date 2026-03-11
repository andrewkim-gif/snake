# V38 — 인게임 Canvas 2D → Three.js 3D Voxel 변환 연구 보고서

> **AI World War** 실시간 자동전투 서바이벌 로그라이크의 3D 변환 가능성 분석 및 전체 구현 로드맵
> **연구일**: 2026-03-11
> **참조 프로젝트**: TicTac (threejs-tactics-game) — FFT-style Isometric Tactics

---

## Executive Summary

현재 AI World War 인게임은 Canvas 2D + Isometric Transform 기반으로 구현되어 있으며, **게임 로직(update)과 렌더링(draw)이 깔끔하게 분리**되어 있어 3D 변환에 유리한 구조입니다. 핵심 게임 시스템(전투, 이동, 무기, 스폰, 충돌, AI)은 순수 월드 좌표 기반이므로 **변경 없이 재사용 가능**하며, `MatrixCanvas.tsx`의 `draw()` 함수(~2,160줄)와 `rendering/` 디렉토리(60+ 파일, 50,000+ 줄)만 Three.js로 교체하면 됩니다.

**핵심 결론:**
- **변환 가능성**: ★★★★☆ (높음) — 로직/렌더링 분리 아키텍처 덕분
- **예상 규모**: 8 Phase, 48 태스크, ~50,000줄 렌더링 코드 교체
- **기술 스택**: R3F (React Three Fiber) + InstancedMesh + Voxel Models (.glb)
- **최대 리스크**: 166개 적 타입의 3D 에셋 제작, 40+ 무기 이펙트 3D 변환
- **TicTac에서 차용**: Billboard sprite 패턴, LOD 시스템, DOM overlay HUD, Asset Registry

---

## 1. 연구 배경 및 목표

### 1.1 연구 동기
- 현재 인게임은 Canvas 2D 기반 isometric 뷰로, 시각적 임팩트에 한계가 있음
- `threejs-tactics-game` (TicTac) 프로젝트가 Three.js로 FFT-style 전술게임을 구현한 사례를 발견
- TicTac의 Three.js 패턴/스킬을 학습하여 AI World War 인게임을 Voxel 3D로 업그레이드하는 로드맵 수립

### 1.2 변환 방향 결정
| 항목 | 결정 |
|------|------|
| **게임 로직** | 실시간 자동전투 서바이벌 **그대로 유지** (턴제 전환 X) |
| **아트 스타일** | Voxel 복셀 스타일 (MagicaVoxel, 다크 전술 테마와 조화) |
| **산출물** | 전체 변환 로드맵 (da:plan 입력용 기획서) |
| **변환 범위** | 렌더링만 교체, 게임 로직 100% 보존 |

### 1.3 연구 범위
1. TicTac 프로젝트의 Three.js 패턴/스킬 분석 (plans, skills, learnings)
2. 현재 AI World War 인게임 아키텍처 전수 분석 (139+ 파일)
3. 시스템별 3D 변환 가능성 및 복잡도 평가
4. Voxel + Three.js 기술 스택 리서치
5. 2D→3D 전환 선례 조사 (Risk of Rain 2, Megabonk 등)
6. Phase별 상세 구현 로드맵 설계

---

## 2. 현재 아키텍처 분석

### 2.1 게임 루프 이중 구조 (Dual-Loop)

```
[Web Worker]                    [Main Thread]
game-timer.worker.ts            MatrixCanvas.tsx
setInterval(16ms)  ─→ postMessage ─→  update(deltaTime)   ← 순수 로직
                                      ↕ (refs)
                                requestAnimationFrame ─→  draw(ctx)  ← Canvas 2D
```

- **Logic Loop**: Web Worker에서 60fps로 `update()` 호출 (탭 비활성화에도 유지)
- **Render Loop**: `requestAnimationFrame`으로 `draw()` 호출 (Canvas 2D)
- **상태 공유**: `useGameRefs()` 훅의 MutableRefObject (React state 아님 → re-render 없음)

### 2.2 핵심 파일 구조

```
apps/web/
  components/game/matrix/
    MatrixApp.tsx          ← 오케스트레이터 (68 props 전달)
    MatrixCanvas.tsx       ← 게임 루프 + 렌더링 (5,215줄) ⚠️ 변환 핵심
  lib/matrix/
    systems/               ← 25개 순수 로직 모듈 ✅ 재사용
    rendering/             ← 60+ 파일, 50,000줄+ ⚠️ 전체 교체
    hooks/                 ← 상태 관리 ✅ 재사용
    config/                ← 밸런스/데이터 ✅ 재사용
    collision/             ← 충돌 감지 ✅ 재사용
    sprites/               ← 스프라이트 시스템 ⚠️ 3D로 교체
    tiles/                 ← 타일맵 ⚠️ 3D 지형으로 교체
    workers/               ← Web Worker ✅ 재사용
```

### 2.3 좌표계

| 좌표 | 용도 | 변환 시 |
|------|------|---------|
| **World (x, y)** | 게임 로직, 충돌, AI | **그대로 유지** (x, z 매핑) |
| **Isometric Screen** | `ctx.transform(1,0.5,-1,0.5,0,0)` | Three.js 카메라로 대체 |
| **Canvas Screen** | 카메라 follow + zoom | Three.js 카메라 position/zoom |

**핵심**: 게임 로직은 flat (x, y) 월드 좌표만 사용. Isometric은 순수 렌더링 concern.

### 2.4 재사용 가능 시스템 (변경 0줄)

| 시스템 | 파일 | 근거 |
|--------|------|------|
| 이동/AI | `movement.ts` (1,800줄) | 순수 월드 좌표 연산 |
| 전투 | `combat.ts` | 데미지, 크리티컬, 상태이상 계산 |
| 무기 발사 | `weapons.ts` | 쿨다운, 타겟팅, Projectile 생성 |
| 투사체 업데이트 | `projectile.ts` | 위치 업데이트 + Spatial Hash 충돌 |
| 공간 해시 | `spatial-hash.ts` | O(n+m) 충돌 감지 |
| 스폰 | `spawning.ts`, `spawn-controller.ts` | 적/아이템 생성 |
| PvP | `agent-combat.ts` | 에이전트 간 전투 |
| 엘리트 | `elite-monster.ts` | 엘리트 변환, 드롭 |
| 수집 | `pickup.ts` | 아이템 수집 |
| 아레나 | `useArena.ts` (hook) | 안전지대, AI 에이전트 상태 |
| 게임 상태 | `useGameState.ts` (hook) | 상태 머신 |
| 입력 | `useInput.ts` (hook) | 키보드/조이스틱 |
| 충돌 | `collision/` | AABB, 월드 좌표 전용 (명시적 주석) |
| 설정 | `config/` 전체 | 밸런스, 적 스탯, 무기 데이터 |
| 타이머 | `game-timer.worker.ts` | 렌더러 무관 |
| 이펙트 수학 | `effects/easing.ts` | 26개 이징 + 7개 펄스 패턴 |

### 2.5 교체 필요 시스템

| 시스템 | 파일 수 | 줄 수(추정) | 복잡도 |
|--------|---------|-------------|--------|
| **캐릭터 렌더링** | 12 | 3,000+ | COMPLEX |
| **적 렌더링** | 20+ | 15,000+ | COMPLEX (166타입) |
| **투사체/무기 렌더링** | 6 | 8,000+ | COMPLEX (40+무기) |
| **이펙트/글로우** | 3 | 650 | SIMPLE |
| **안전지대** | 1 | 220 | SIMPLE-MEDIUM |
| **지형** | 8 | 2,000+ | MEDIUM (7타입) |
| **맵 오브젝트** | 4 | 500 | SIMPLE (z-buffer 대체) |
| **멀티플레이어** | 8 | 4,000+ | COMPLEX |
| **터렛** | 1 | 960 | MEDIUM |
| **MatrixCanvas draw()** | 1 | 2,160 | COMPLEX |
| **타일맵** | 5 | 2,000+ | MEDIUM |
| **스프라이트** | 8 | 2,500+ | 교체 (3D 모델) |
| **합계** | **~77** | **~41,000+** | — |

---

## 3. TicTac 프로젝트 분석 — Three.js 패턴 추출

### 3.1 TicTac 프로젝트 개요

| 항목 | 설명 |
|------|------|
| **이름** | TicTac — Isometric Tactics Prototype |
| **장르** | FFT-style 턴제 전술 RPG |
| **기술** | Three.js + TypeScript + Vite |
| **렌더링** | Orthographic Isometric Camera + Sprite Billboard |
| **소스** | 비공개 (BuilderPack.ai), plans/skills/docs만 공개 |

### 3.2 차용 가능한 Three.js 패턴 (from TicTac Skills)

#### A. Scene Graph 기반 구조
```
Scene
 ├── Board Group (지형)
 │    ├── Tile meshes (InstancedMesh)
 │    └── Terrain props
 ├── Entity Group (엔티티)
 │    ├── Player characters
 │    ├── Enemies (InstancedMesh)
 │    └── Projectiles (Object Pool)
 ├── Effects Group
 │    ├── Particles (InstancedMesh)
 │    └── Projectile trails
 └── Lights
      ├── AmbientLight (0.4)
      ├── DirectionalLight main (1.0)
      └── DirectionalLight fill (0.5)
```

#### B. 게임 루프 + 상태 머신
- `renderer.setAnimationLoop()` 대신 기존 Web Worker + rAF 유지 가능
- `THREE.Clock`의 `getDelta()` + `Math.min(dt, 0.1)` cap (탭 전환 방지)
- `timeScale` 프로퍼티로 슬로우모션 지원

#### C. 모델 캐싱 + 복제
```typescript
// TicTac의 ModelCache 패턴
const cache = new Map<string, { scene, animations }>();
// 중요: 스킨 애니메이션 모델은 반드시 SkeletonUtils.clone() 사용
const clone = SkeletonUtils.clone(cached.scene);
```

#### D. Billboard Sprite (캐릭터 렌더링)
- 3D 월드에 2D 스프라이트를 billboard로 세움
- 8방향 sprite sheet에서 카메라 각도에 맞는 방향 추출
- `direction.ts` — canonical-to-display facing remapping

#### E. DOM Overlay HUD
- 모든 HUD는 Three.js canvas 위의 HTML/CSS overlay
- 세계좌표 → 스크린좌표 프로젝션: `Vector3.project(camera)`
- Speech bubble tail 앵커링: 매 프레임 world-to-screen 재계산

#### F. 비주얼 피드백 패턴
| 패턴 | TicTac 구현 | AI World War 적용 |
|------|------------|-------------------|
| Camera Shake | Random offset + decay | 공격 임팩트, 피격 |
| Screen Flash | HTML overlay + opacity | 크리티컬, AOE |
| Zoom Pulse | camera.zoom interpolation | 레벨업, 보스 등장 |
| Squash & Stretch | scale.set() 3-phase | 점프/착지 (미래) |
| Floating Text | CSS animation DOM | 데미지 넘버 |
| Slow Motion | timeScale ramp | 처치 연출 |

#### G. Raycasting (마우스 피킹)
- `Raycaster.setFromCamera()` + `intersectObjects()`
- TicTac: 타일 선택 / AI World War: 미래 인터랙션용

#### H. Object Pooling
```typescript
class ObjectPool<T> {
  pool: T[] = [];     // 비활성
  active: T[] = [];   // 활성
  spawn(x,y,z): T {}  // pool에서 꺼내 active로
  despawn(obj): void {} // active에서 pool로
}
```
- 투사체, 파티클, 데미지 넘버에 필수

### 3.3 TicTac vs AI World War 차이점

| 측면 | TicTac | AI World War |
|------|--------|--------------|
| **엔티티 수** | ~5 유닛 | 100~500+ (적 + 투사체) |
| **전투** | 턴제 (1 at a time) | 실시간 (동시 다수) |
| **카메라** | 고정 isometric + 90° 회전 | 플레이어 팔로우 + 동적 줌 |
| **성능 요구** | 낮음 | 높음 (InstancedMesh 필수) |
| **UI 복잡도** | 배틀메뉴, 턴 타임라인 | HUD, 킬피드, 스킬 아이콘 |
| **에셋** | 3 캐릭터 sprite sheet | 166 적 타입 + 9 클래스 + 40 무기 |

---

## 4. 3D 변환 전략

### 4.1 변환 원칙

1. **로직 보존**: `update()` 함수와 모든 systems/ 모듈은 변경하지 않음
2. **렌더링 교체**: `draw()` 함수와 rendering/ 전체를 Three.js로 대체
3. **점진적 전환**: OrthographicCamera (top-down)로 시작 → PerspectiveCamera로 진화
4. **병렬 유지**: 2D 엔진과 3D 엔진을 모드 스위칭으로 공존 (페이드 인/아웃)
5. **에셋 자동화**: 166개 적 타입을 수동 제작하지 않고 procedural/batch 생성

### 4.2 아키텍처 전환 설계

```
[Before — Canvas 2D]
MatrixApp.tsx → MatrixCanvas.tsx (5,215줄)
                  ├── update()  ← logic (1,150줄)
                  └── draw()    ← Canvas 2D (2,160줄)

[After — Three.js R3F]
MatrixApp.tsx → MatrixScene.tsx (R3F <Canvas>)
                  ├── useGameLoop()     ← update() 추출 (변경 없음)
                  ├── <GameWorld />     ← 3D Scene Graph
                  │    ├── <VoxelTerrain />
                  │    ├── <EntityRenderer />  ← InstancedMesh
                  │    ├── <ProjectileRenderer />
                  │    ├── <EffectsRenderer />
                  │    └── <SafeZoneRenderer />
                  ├── <GameCamera />    ← Three.js 카메라
                  └── <GameHUD />       ← HTML overlay (기존 유지)
```

### 4.3 좌표 매핑

현재 2D 월드 좌표를 3D로 매핑하는 규칙:

```
2D World → 3D World
  x      →  x  (좌우)
  y      →  z  (전후, 부호 반전)
  없음    →  y  (높이, 0 = 지면)

2D Isometric Transform → Three.js Camera
  ctx.transform(1, 0.5, -1, 0.5, 0, 0) → OrthographicCamera at 45° rotation
```

### 4.4 2D→3D 전환 선례에서 배운 교훈

**Risk of Rain 2** (2D→3D 성공작):
- ✅ 핵심 루프(아이템 빌드, 시간 압박)를 100% 보존
- ✅ 3D에서만 가능한 새 메카닉 추가 (환경 상호작용)
- ✅ 깔끔한 레트로 아트 스타일로 가독성 유지
- ⚠️ "2D의 모든 것을 3D에 그대로 옮기면 안 된다 — 3D에 맞게 재설계 필요"

**Megabonk** (3D Vampire Survivors):
- ✅ VS 핵심(빌드 메이킹, 호드 서바이벌) 유지
- ✅ 3D 공간감이 "extra fun factor" 제공
- ⚠️ 출시 시 콘텐츠 부족 문제

**핵심 교훈 for AI World War:**
1. 자동전투 + 빌드 루프를 반드시 보존
2. 100+ 적이 화면에 있을 때 가독성이 3D에서 급락 → Voxel 스타일의 깔끔함이 해결책
3. 성능이 최대 병목 → InstancedMesh + LOD 공격적 적용 필수
4. 단순 비주얼 업그레이드가 아닌, 3D 전용 가치(지형 높이, 환경 파괴, 수직 이동) 추가 고려

---

## 5. Voxel 기술 스택 선정

### 5.1 렌더링 프레임워크

| 선택 | 기술 | 근거 |
|------|------|------|
| **3D Engine** | React Three Fiber (R3F) | 기존 React/Next.js 스택과 통합, drei 헬퍼 |
| **물리** | 불필요 | 기존 collision/ 시스템 재사용 |
| **캐릭터 컨트롤러** | 불필요 | 기존 movement.ts 재사용 |
| **포스트 프로세싱** | @react-three/postprocessing | Bloom, Vignette, Screen Flash |
| **UI Overlay** | CSS2DRenderer (drei) | 데미지 넘버, 네임태그, HP바 |

### 5.2 Voxel 렌더링 기법 비교

| 기법 | Draw Calls | 100+ 엔티티 | 개별 조작 | 추천 용도 |
|------|-----------|-------------|----------|----------|
| **InstancedMesh** | 1 per type | ✅ 60fps | ✅ per-instance matrix/color | 동적 엔티티 (적, 투사체) |
| **BatchedMesh** (r156+) | 1 total | ✅ 60fps | ✅ 서로 다른 geometry | 다양한 적 타입 혼합 |
| **Merged Geometry** | 1 | ✅ | ❌ 불가 | 정적 지형 |
| **Individual Mesh** | N | ❌ 40fps@100 | ✅ | 소수 엔티티만 |

**선정**:
- **적/에이전트**: BatchedMesh (166 다른 geometry) 또는 InstancedMesh + Texture Atlas
- **지형 타일**: Merged Geometry (정적, face culling)
- **투사체**: InstancedMesh + Object Pool
- **파티클**: InstancedMesh (Points보다 안정적)

### 5.3 Voxel 캐릭터 애니메이션 방식

| 방식 | 파일 크기 | CPU | 복셀 느낌 | 100+ 동시 | 선정 |
|------|----------|-----|----------|----------|------|
| **Frame Swap** | 큼 (N프레임) | 낮음 | ✅ 완벽 | BatchedMesh | **1순위** |
| **Shader Bone** | 작음 | 매우 낮음 | 커스텀 | 1 draw call | 2순위 (고급) |
| **Skeletal** | 작음 | 높음 | 부드러움(비복셀) | ❌ CPU 병목 | 제외 |
| **Morph Target** | 큼 | 낮음 | 보간시 비복셀 | 가능 | 제외 |

**선정**: **Frame Swap** — 복셀 미학 유지 + 구현 단순 + MagicaVoxel 프레임 애니메이션과 자연스럽게 호환

### 5.4 에셋 파이프라인

```
[에셋 생성]
MagicaVoxel (.vox) 또는 AI 생성 (VoxAI/Gemini)
    ↓ Export
.glb (glTF Binary) — 단일 파일, 머티리얼 포함
    ↓ Optimize
gltfpack / gltf-transform — 압축, Draco
    ↓ Load
useGLTF() (drei) → ModelCache (SkeletonUtils.clone)
    ↓ Render
InstancedMesh / BatchedMesh
```

**적 타입 자동화 전략**:
- 166개 적 타입을 수동 제작은 비현실적
- **전략 1**: 기본 복셀 body 템플릿 5-10개 + 색상/크기 변형으로 커버
- **전략 2**: 기존 pixel art renderer의 색상/형태 데이터를 추출하여 procedural voxel 생성
- **전략 3**: AI 생성 (VoxAI) + 수동 검수

### 5.5 Performance Budget

| 지표 | 목표 | 근거 |
|------|------|------|
| **Draw Calls** | < 50 | InstancedMesh/BatchedMesh 활용 |
| **Triangle Count** | < 500K | 복셀 캐릭터 12-36 tri, 100개 = 3,600 |
| **FPS (mid-tier)** | 60fps | Chromebook/iPad 포함 |
| **엔티티 수** | 200+ | Arena 모드 기준 |
| **LOD 단계** | 3 (HIGH/MID/LOW) | 기존 LOD 시스템 포팅 |
| **Culling** | Frustum + Distance | Three.js 내장 + 커스텀 distance |

---

## 6. 시스템별 변환 상세 분석

### 6.1 MatrixCanvas → MatrixScene 전환

**현재 `MatrixCanvas.tsx` (5,215줄) 분해:**

| 부분 | 줄 수 | 3D 전환 | 방법 |
|------|-------|---------|------|
| Props/Refs 선언 | ~500 | 그대로 | MatrixScene에 동일 props |
| `initGame()` | ~200 | 그대로 | 순수 데이터 초기화 |
| `update()` | ~1,150 | **추출** | `useGameLoop()` 커스텀 훅 |
| `draw()` | ~2,160 | **교체** | R3F Scene Graph |
| useEffects/handlers | ~1,200 | 부분 수정 | Worker 유지, rAF→useFrame |

**추출 아키텍처:**
```typescript
// useGameLoop.ts — update() 로직 추출 (변경 없음)
export function useGameLoop(refs: GameRefs, callbacks: GameCallbacks) {
  // 기존 update() 내용 그대로
}

// MatrixScene.tsx — R3F 기반 렌더링
export function MatrixScene(props: MatrixCanvasProps) {
  const refs = useGameRefs();
  useGameLoop(refs, callbacks);

  return (
    <Canvas>
      <GameCamera refs={refs} />
      <VoxelTerrain refs={refs} />
      <EntityRenderer refs={refs} />
      <ProjectileRenderer refs={refs} />
      <EffectsRenderer refs={refs} />
      <SafeZone refs={refs} />
    </Canvas>
  );
}
```

### 6.2 카메라 시스템

**현재 (Canvas 2D):**
```typescript
ctx.translate(width/2, height/2);
ctx.scale(zoom, zoom);
ctx.transform(1, 0.5, -1, 0.5, 0, 0); // isometric
ctx.translate(-player.x, -player.y);
```

**변환 (Three.js):**
```typescript
// OrthographicCamera — isometric 45°
const camera = new THREE.OrthographicCamera(
  -frustum * aspect, frustum * aspect,
  frustum, -frustum, 0.1, 2000
);
camera.position.set(player.x + 10, 15, player.z + 10);
camera.lookAt(player.x, 0, player.z);
camera.zoom = currentZoom;
camera.updateProjectionMatrix();
```

- Dynamic zoom (0.6-1.1) → `camera.zoom` LERP
- Screen shake → `camera.position` random offset + decay
- Player follow → `camera.position` LERP to player

### 6.3 캐릭터 렌더링 (characters/)

**현재**: 12개 파일, Canvas 2D procedural (머리/몸/팔/다리 ellipse/rect)
**변환 전략**: Modular Voxel Character System

```
VoxelCharacterFactory
  ├── Base Templates (9 클래스)
  │    ├── neo.glb
  │    ├── tank.glb
  │    └── ... (7 more)
  ├── Part Variations
  │    ├── hair/ (10 types)
  │    ├── accessories/ (10 types)
  │    └── eyes/ (7 types — texture swap)
  └── Color Customization
       └── per-instance color via uniform/vertex color
```

- **9 base .glb models** × 색상 변형 = InstancedMesh로 렌더링
- **Animation**: 3-4 프레임 Frame Swap (idle, walk, hit, death)
- **기존 재사용**: `calculateWalkAnimation()`, `calculateIdleAnimation()` 수학 → bone rotation에 적용 가능
- **Skin system**: per-instance vertex color 또는 texture atlas UV offset

### 6.4 적 렌더링 (enemies/)

**현재**: 20+ 파일, 166개 고유 적 타입, pixel art + vector 이중 렌더러
**변환 전략**: Tiered Voxel Enemy System

```
Tier 1 — Base Body Templates (10-15개)
  ├── humanoid_small (glitch, bot 계열)
  ├── humanoid_medium (ninja, soldier 계열)
  ├── humanoid_large (tank, whale 계열)
  ├── flying (drone, caster 계열)
  ├── crawler (bug, malware 계열)
  ├── sphere (orb, core 계열)
  └── boss_large (chapter boss)

Tier 2 — Color/Texture Variations (166개)
  ├── CYBER_PALETTE 30색 매핑
  ├── Per-type: primary + secondary color
  └── Size scale factor

Tier 3 — Elite Effects (Shader/Particle)
  ├── Silver: subtle glow
  ├── Gold: bright glow + particles
  └── Diamond: intense glow + trail
```

**핵심 인사이트**: 현재 166개 적의 대부분은 색상/크기 변형일 뿐. 실제 고유 형태는 10-15개로 수렴.

### 6.5 투사체/무기 렌더링 (projectiles/)

**현재**: 6개 파일 (melee/ranged/magic/special/skills + effects), 40+ 고유 무기
**변환 전략**: 3D Projectile System

| 무기 유형 | 2D 구현 | 3D 변환 |
|----------|---------|---------|
| 근접 (whip, punch, axe, sword) | Bezier path, arc slash | Trail mesh + custom shader |
| 원거리 (knife, bow, shard) | 회전 스프라이트 + 충격파 | InstancedMesh bullet + ring effect |
| 마법 (wand, bible, garlic, pool) | Orbit, AOE circle | 3D orbit mesh, ground decal |
| 특수 (bridge, beam, laser) | 직선 glow | Cylinder + bloom shader |
| 스킬 (30+ types) | 카테고리별 색상 + 텍스트 | InstancedMesh + color |

**최적화**: 투사체는 동시 100+ 가능 → **InstancedMesh + Object Pool** 필수

### 6.6 이펙트 시스템

| 이펙트 | 현재 | 3D 변환 |
|--------|------|---------|
| **Glow** | `ctx.shadowBlur` | UnrealBloomPass (selective bloom) |
| **Screen Flash** | Canvas 전체 overlay | Post-processing overlay pass |
| **Screen Shake** | CSS transform | Camera position jitter |
| **Particles** | ExtendedParticle array | InstancedMesh particle system |
| **Damage Numbers** | Canvas fillText | CSS2DRenderer DOM elements |
| **Critical Effects** | Canvas scaled text | CSS2DRenderer + CSS animation |
| **Trail** | Position history array | Custom trail geometry |
| **Vignette** | Radial gradient | Post-processing vignette pass |

### 6.7 지형/맵

**현재**: Simplex noise biome + diamond tile sprite + terrain objects (7 types)
**변환 전략**:

```
VoxelTerrain
  ├── Ground Plane
  │    ├── Chunked grid mesh (Merged Geometry)
  │    ├── Texture Atlas for biome variation
  │    └── Optional height variation (future)
  ├── Terrain Objects (7 types × variations)
  │    ├── classroom/ → desk.glb, locker.glb, chalkboard.glb
  │    ├── cafeteria/ → table.glb, chair.glb
  │    └── ... (5 more terrain types)
  └── Biome Transitions
       └── Simplex noise → texture blend (reuse existing noise.ts)
```

### 6.8 안전지대 (Safe Zone)

**현재**: Canvas composite operation (`destination-out`) + circle
**변환 전략**:
- 3D 반투명 실린더 메시 (바깥 = 적색 fog/overlay)
- Shader-based: 플레이어 거리 기반 vignette 강도
- 미니맵: 기존 HTML 기반 유지
- Warning UI: CSS overlay 유지

### 6.9 멀티플레이어

| 기능 | 현재 | 3D 변환 |
|------|------|---------|
| Remote Player Body | Canvas circles + procedural | 3D voxel character (LOD 3단계) |
| Nametag | Canvas fillText | CSS2DRenderer DOM |
| HP Bar | Canvas rect | CSS2DRenderer or 3D billboard |
| PvP Hit Effect | Shockwave ring | Three.js ring geometry + bloom |
| Kill Effect | Burst particles | InstancedMesh particles |
| Kill Feed | Canvas UI | HTML overlay (기존 유지) |
| Viewport Culling | AABB + distance | Three.js frustum + distance LOD |

---

## 7. 성능 예산 및 최적화 전략

### 7.1 성능 목표

| 시나리오 | 엔티티 수 | Draw Calls | 목표 FPS |
|----------|----------|-----------|---------|
| **Normal Play** | 50 적 + 30 투사체 | < 20 | 60fps |
| **Arena Mode** | 200 적 + 9 에이전트 + 100 투사체 | < 40 | 60fps |
| **Stress Test** | 500 적 + 200 투사체 | < 60 | 45fps+ |
| **Mobile (mid-tier)** | 100 적 + 50 투사체 | < 30 | 30fps+ |

### 7.2 최적화 전략

**A. Instancing (Draw Call 최소화)**
- 같은 적 타입은 InstancedMesh로 1 draw call
- 다른 적 타입은 BatchedMesh로 그룹핑
- 투사체는 무기 카테고리별 InstancedMesh (6-10개)
- 파티클은 단일 InstancedMesh

**B. LOD (Level of Detail)**
기존 3단계 LOD 시스템을 Three.js에 맞게 포팅:

| LOD | 거리 | 캐릭터 | 이펙트 |
|-----|------|--------|--------|
| HIGH | < 800px | Full voxel model + animation | Glow + particles |
| MID | 800-1400px | Simplified model (fewer voxels) | No glow |
| LOW | > 1400px | Colored cube (1 voxel) | None |

**C. Frustum Culling**
- Three.js 내장 frustum culling (자동)
- 추가: 거리 기반 culling (>2200px는 숨김, 기존 로직 재사용)

**D. 지형 Chunking**
- 월드를 chunk 단위로 분할 (200x200 world units)
- 보이는 chunk만 렌더링
- 정적 지형은 Merged Geometry + face culling

**E. Texture Atlas**
- 적 타입별 개별 texture 대신 atlas 1장으로 통합
- 캐릭터 skin 색상도 vertex color로 처리 (texture 불필요)

**F. Quality Ladder (적응형 품질)**
```
Tier 1 (고사양): Full bloom, particles, shadows, high LOD
Tier 2 (중사양): Reduced bloom, fewer particles, no shadows
Tier 3 (저사양): No post-processing, LOD LOW only, minimal particles
```
- `renderer.info.render.calls`로 실시간 모니터링
- FPS < 30이면 자동으로 tier 하향

---

## 8. 리스크 분석 및 완화 전략

### 8.1 리스크 매트릭스

| ID | 리스크 | 심각도 | 확률 | 완화 전략 |
|----|--------|--------|------|----------|
| R1 | 166개 적 타입 에셋 제작 불가 | Critical | 중 | 10-15개 base template + 색상/크기 변형으로 커버 |
| R2 | 성능 목표 미달 (100+ 엔티티) | Critical | 중 | InstancedMesh/BatchedMesh + 공격적 LOD + Quality Ladder |
| R3 | R3F useFrame priority=0 제약 | High | 높 | 기존 Web Worker 루프 유지, useFrame은 렌더링만 |
| R4 | 2D↔3D 전환 시 게임밸런스 변화 | High | 낮 | 게임 로직 변경 0줄, 좌표 매핑만 |
| R5 | 모바일 WebGL 호환성 | Medium | 중 | Quality Ladder + fallback to Canvas 2D |
| R6 | MagicaVoxel VOX v200 로더 문제 | Low | 높 | .glb export 사용 (.vox는 편집용만) |
| R7 | 기존 2D HUD 깨짐 | Medium | 중 | CSS2DRenderer + 기존 React 컴포넌트 유지 |
| R8 | 멀티플레이어 동기화 영향 | High | 낮 | 상태 직렬화는 좌표 기반, 렌더링 무관 |

### 8.2 최대 리스크 상세 분석

**R1 — 에셋 제작 (Critical)**

166개 적 타입을 각각 voxel 모델로 만드는 것은 수백 시간 작업. 완화:

1. **Base Template 전략**: 실제 고유 형태는 10-15개 (humanoid_small, humanoid_medium, humanoid_large, flying, crawler, sphere, boss 등)
2. **자동 변형**: per-instance color (primary/secondary) + scale로 166개 커버
3. **Chapter 단위 롤아웃**: Phase별로 1 chapter씩 에셋 추가
4. **Fallback**: 미구현 적은 colored cube로 표시 (LOD LOW와 동일)

**R2 — 성능 (Critical)**

Canvas 2D에서 500+ 적을 60fps로 렌더하던 것을 3D에서 유지하려면:

1. **벤치마크 근거**: Three.js InstancedMesh로 10,000개 큐브 = 60fps (검증됨)
2. **우리 케이스**: 200 적 × 36 tri = 7,200 tri (매우 가벼움)
3. **병목은 draw call**: InstancedMesh 사용 시 1-5 draw calls로 커버
4. **Stress test 필수**: Phase 2 이후 매 Phase마다 성능 벤치마크

---

## 9. 전체 변환 로드맵 (Phase 1-8)

### Phase 개요

```
Phase 1: Foundation (기반)
  ├── R3F 환경 세팅 + 게임 루프 추출
  ├── 기본 카메라 + 조명
  └── 빈 3D 씬에서 update() 동작 확인

Phase 2: Terrain (지형)
  ├── Chunked ground plane
  ├── Biome texture atlas
  └── 기본 지형 오브젝트

Phase 3: Characters (캐릭터)
  ├── Voxel player character (9 클래스)
  ├── Frame Swap animation (walk, idle, hit)
  └── 8방향 facing

Phase 4: Enemies (적)
  ├── 10-15 base templates
  ├── Color/size 변형 (166 타입)
  ├── InstancedMesh/BatchedMesh
  └── LOD 3단계

Phase 5: Projectiles & Effects (투사체/이펙트)
  ├── 투사체 InstancedMesh Pool
  ├── 40+ 무기 비주얼 포팅
  ├── Bloom post-processing
  └── Particle system

Phase 6: UI & HUD (인터페이스)
  ├── CSS2DRenderer (데미지넘버, 네임태그)
  ├── 안전지대 3D 시각화
  └── 기존 React HUD 통합

Phase 7: Multiplayer & Arena (멀티플레이어)
  ├── Remote player 3D 렌더링
  ├── PvP 이펙트 3D 변환
  └── Nation system 시각화

Phase 8: Polish & Optimization (최적화)
  ├── Quality Ladder 구현
  ├── 모바일 최적화
  ├── 2D/3D 모드 스위칭
  └── 성능 벤치마크
```

### Phase 의존성 DAG

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                         ↘       ↓
                      Phase 5 → Phase 6 → Phase 7 → Phase 8
```

- Phase 1-2: 기반 (순차)
- Phase 3-4: 엔티티 (순차, 플레이어 먼저)
- Phase 5: 이펙트 (Phase 3 이후)
- Phase 6: UI (Phase 4-5 이후)
- Phase 7: 멀티 (Phase 6 이후)
- Phase 8: 최적화 (최종)

---

## 10. 상세 태스크 로드맵 (S01-S48)

### Phase 1: Foundation (S01-S06)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S01 | R3F 환경 세팅 | — | `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` 설치, Canvas 마운트 |
| S02 | useGameLoop 훅 추출 | S01 | MatrixCanvas의 `update()` 함수를 독립 훅으로 추출 (변경 0줄) |
| S03 | MatrixScene 컴포넌트 생성 | S01 | R3F `<Canvas>` 래퍼 + props 인터페이스 (MatrixCanvasProps 재사용) |
| S04 | GameCamera 컴포넌트 | S03 | OrthographicCamera + LERP follow + dynamic zoom + screen shake |
| S05 | 기본 조명 | S03 | 3-light rig (ambient 0.4 + directional 1.0 + fill 0.5) + shadow map |
| S06 | 통합 테스트 | S02,S04,S05 | 빈 3D 씬에서 update() 실행, 카메라 플레이어 추적 확인 |

### Phase 2: Terrain (S07-S12)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S07 | Ground Plane Mesh | S06 | Chunked grid mesh (200×200 units per chunk) + biome color |
| S08 | Texture Atlas 생성 | S07 | 7 biome 타일 → 단일 texture atlas |
| S09 | Simplex Noise 통합 | S07 | 기존 `noise.ts` 재사용, chunk별 biome 결정 |
| S10 | Terrain Object Templates | S07 | 7 terrain type × 3-5 variation = 25-35개 기본 voxel prop (.glb) |
| S11 | Object Instancing | S10 | hash-based placement + InstancedMesh 렌더링 |
| S12 | Terrain 성능 벤치마크 | S11 | 2000×2000 월드, 100+ prop, FPS 측정 |

### Phase 3: Characters (S13-S19)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S13 | Base Voxel Character Model | S06 | MagicaVoxel로 기본 캐릭터 .glb (3-head chibi proportions) |
| S14 | 9 Class Variations | S13 | neo/tank/cypher/morpheus/niobe/oracle/trinity/mouse/dozer 색상+장비 |
| S15 | Frame Swap Animation | S13 | idle(2f), walk(4f), hit(2f), death(3f) — .glb per frame |
| S16 | VoxelCharacterRenderer | S14,S15 | R3F 컴포넌트, frame swap + 8방향 facing (model rotation) |
| S17 | Skin Color System | S16 | per-instance vertex color 또는 material color override |
| S18 | Player Upper/Lower Split | S16 | 기존 split rendering (lower body + skills + upper body) 재현 |
| S19 | 캐릭터 통합 테스트 | S18,S12 | 지형 위 플레이어 이동, 8방향, animation, skin 변경 |

### Phase 4: Enemies (S20-S26)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S20 | Enemy Base Templates | S13 | 10-15개 base body .glb (humanoid_s/m/l, flying, crawler, sphere, boss) |
| S21 | Color Mapping System | S20 | CYBER_PALETTE 30색 → material color, per-type primary/secondary |
| S22 | InstancedMesh Enemy Renderer | S21 | 같은 template의 적을 InstancedMesh로 batch 렌더링 |
| S23 | BatchedMesh Integration | S22 | 서로 다른 template의 적을 BatchedMesh로 1 draw call |
| S24 | LOD 3-Tier System | S22 | HIGH(full model) / MID(simplified) / LOW(colored cube) |
| S25 | Elite Effects | S22 | Shader-based glow (silver/gold/diamond) + orbiting particles |
| S26 | Enemy 성능 벤치마크 | S24 | 200 적, 166 타입 혼합, FPS 측정 |

### Phase 5: Projectiles & Effects (S27-S34)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S27 | Projectile Object Pool | S06 | InstancedMesh 기반 object pool (spawn/despawn) |
| S28 | Melee Weapons (4) | S27 | whip(trail mesh), punch(shockwave ring), axe(scatter), sword(arc) |
| S29 | Ranged Weapons (6) | S27 | knife/bow/ping/shard/airdrop/fork — instanced bullets |
| S30 | Magic Weapons (4) | S27 | wand/bible(orbit)/garlic(AOE decal)/pool(ground decal) |
| S31 | Special Weapons (3) | S27 | bridge/beam/laser — cylinder + bloom |
| S32 | Skill Weapons (30+) | S27 | 카테고리별 색상 + instanced projectile (단순화) |
| S33 | Post-Processing Pipeline | S06 | UnrealBloomPass + Vignette + ScreenFlash |
| S34 | Particle System | S27 | InstancedMesh particles with easing, trail, fade, glow |

### Phase 6: UI & HUD (S35-S39)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S35 | CSS2DRenderer 통합 | S19 | drei의 Html 컴포넌트 활용, world-to-screen 앵커링 |
| S36 | Damage Numbers | S35 | CSS animation float-up, 색상/크기 by type |
| S37 | Health Bars & Nametags | S35 | 적/에이전트 머리 위 HP바 + 이름 (LOD 연동) |
| S38 | Safe Zone 3D | S33 | 반투명 실린더 mesh + shader fog + warning vignette |
| S39 | HUD 통합 | S35 | 기존 React HUD 컴포넌트 (MatrixHUD, ArenaHUD 등) 그대로 사용 |

### Phase 7: Multiplayer & Arena (S40-S44)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S40 | Remote Player 3D Rendering | S16,S24 | Voxel character + LOD 3단계 + nation color |
| S41 | PvP Visual Effects | S34 | Hit shockwave (ring geometry + bloom), kill burst (instanced particles) |
| S42 | Agent Chat Bubbles | S35 | CSS2DRenderer speech bubbles with fade |
| S43 | Kill Feed & War Border | S39 | HTML overlay (기존 로직 재사용, 렌더링만 DOM) |
| S44 | Arena 통합 테스트 | S40-S43 | 9 에이전트 + safe zone + PvP full flow |

### Phase 8: Polish & Optimization (S45-S48)

| ID | 태스크 | 의존 | 설명 |
|----|--------|------|------|
| S45 | Quality Ladder | S44 | 3-tier 자동 품질 조절 (bloom/particles/shadows/LOD) |
| S46 | Mobile Optimization | S45 | Touch input, 저해상도 fallback, reduced particle count |
| S47 | 2D/3D Mode Switch | S45 | Settings에서 Classic(2D)/Enhanced(3D) 전환, localStorage 저장 |
| S48 | Final Benchmark & Report | S47 | 성능 리포트, 잔여 이슈, v39 계획 |

---

## 11. Clarity Breakdown & Confidence

### Clarity Breakdown

| Dimension | Score | Status |
|-----------|-------|--------|
| Goal Clarity | 0.95 | ✅ Clear — 실시간 자동전투 유지 + Voxel 3D 변환 |
| Constraint Clarity | 0.90 | ✅ Clear — R3F + Voxel, 기존 로직 보존 |
| Success Criteria | 0.85 | ✅ Clear — 60fps@200 entities, 기존 기능 100% 동작 |
| **Ambiguity Score** | **0.10** | **✅ Ready (< 0.20)** |

### Interview Summary
- Rounds completed: 1
- Challenge agents used: none
- 결정사항: 실시간 자동전투→3D, Voxel 스타일, 전체 로드맵

### Confidence Level: **High**

변환 가능성에 대한 확신이 높은 근거:
1. 게임 로직/렌더링 분리 아키텍처가 이미 구현되어 있음
2. Three.js InstancedMesh로 10,000+ 엔티티 60fps 벤치마크가 검증됨
3. 기존 collision, movement, combat 시스템이 월드 좌표 기반으로 3D 직접 이식 가능
4. TicTac 프로젝트에서 검증된 패턴들이 그대로 적용 가능
5. Risk of Rain 2 등 2D→3D 성공 선례가 존재

---

## Sources

### 프로젝트 내부
- `threejs-tactics-game/` — TicTac 프로젝트 (plans, skills, learnings)
- `apps/web/lib/matrix/` — AI World War 인게임 엔진 (139+ 파일)
- `apps/web/components/game/matrix/MatrixCanvas.tsx` — 게임 루프 + 렌더링 (5,215줄)

### 기술 레퍼런스
- Three.js InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
- Three.js BatchedMesh + WebGPU: https://tympanus.net/codrops/2024/10/30/interactive-3d-with-three-js-batchedmesh-and-webgpurenderer/
- One Draw Call Massive Crowd: https://discourse.threejs.org/t/one-draw-call-massive-crowd/89928
- Voxel Performance (Instancing vs Chunking): https://medium.com/@claygarrett/voxel-performance-instancing-vs-chunking
- Browser Voxel Engine on Vanilla Three.js: https://reddit.com/r/threejs/comments/1r2walj/
- 100 Three.js Tips (2026): https://www.utsubo.com/blog/threejs-best-practices-100-tips
- VOXLoader Version Issue: https://github.com/mrdoob/three.js/issues/27803
- Turning 3D Models to Voxel Art: https://tympanus.net/codrops/2023/03/28/turning-3d-models-to-voxel-art-with-three-js/

### R3F 생태계
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- drei helpers: https://github.com/pmndrs/drei
- ecctrl character controller: https://github.com/pmndrs/ecctrl
- r3f-voxels: https://github.com/danielesteban/r3f-voxels

### 2D→3D 전환 사례
- Risk of Rain 2 — 2D to 3D Design: https://www.gamedeveloper.com/design/how-moving-from-2d-to-3d-shaped-the-design-of-i-risk-of-rain-2-i-
- Risk of Rain 2 Challenges: https://au.pcmag.com/gaming-4/68039
- Deep Rock Galactic Survivor: https://www.pcgamer.com/games/roguelike/deep-rock-galactic-survivor-review/
- Eidolon Browser Isometric RPG: https://dev.to/mendolatech/how-i-built-a-browser-based-isometric-rpg-with-threejs

### Voxel 도구
- MagicaVoxel: https://ephtracy.github.io/
- VoxAI (AI voxel generation): https://voxelai.ai
- Smooth Voxels (SVOX): https://www.smoothdev.nl/smoothvoxels/
- CodingKiwi VOX Rendering: https://blog.coding.kiwi/rendering-vox-files/
