# PLAN: V38 — Canvas 2D → Three.js 3D Voxel 인게임 변환

> **AI World War** 실시간 자동전투 서바이벌의 렌더링 엔진을 Canvas 2D에서 Three.js Voxel 3D로 변환
> **기획일**: 2026-03-11
> **연구 보고서**: `docs/designs/v38-3d-conversion-research.md`

---

## 1. 개요

### 배경
현재 인게임은 Canvas 2D + Isometric Transform 기반으로, 시각적 임팩트에 한계가 있음. 게임 로직(update)과 렌더링(draw)이 깔끔하게 분리된 아키텍처를 활용하여, **게임 로직은 100% 보존**하면서 렌더링만 Three.js 3D Voxel로 교체.

### 핵심 목표
1. 실시간 자동전투 서바이벌 게임플레이를 **그대로 유지**
2. Canvas 2D 렌더링을 **Voxel 스타일 3D**로 전면 교체
3. **60fps@200+ 엔티티** 성능 목표 달성
4. 2D/3D 모드 스위칭 지원 (사용자 선택)

### 변환 범위
- **보존** (변경 0줄): `systems/` 24개 모듈, `hooks/`, `config/`, `collision/` (2D 좌표 기반 유지, 변경 불필요), `workers/`
- **유지** (2D fallback): `sprites/`, `tiles/` — 3D 모드에서 미사용이나, 2D Classic 모드 유지를 위해 삭제하지 않음
- **교체** (~50,000줄): `rendering/` 60+ 파일, `MatrixCanvas.tsx` draw(), `sprites/`, `tiles/`

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] MatrixCanvas의 `update()` 로직을 `useGameLoop()` 훅으로 추출 (변경 0줄)
- [FR-2] R3F `<Canvas>` 기반 `MatrixScene` 컴포넌트로 3D 렌더링 교체
- [FR-3] OrthographicCamera 기반 isometric 뷰 + LERP follow + dynamic zoom
- [FR-4] 9개 플레이어 클래스의 Voxel 3D 캐릭터 (Frame Swap 애니메이션)
- [FR-5] 173개 적 타입을 10-15 base template + color/size 변형으로 3D 렌더링
- [FR-6] 40+ 무기 투사체의 3D 비주얼 (InstancedMesh Object Pool)
- [FR-7] Post-processing 이펙트 (Bloom, Vignette, Screen Flash)
- [FR-8] drei `<Html>` 기반 데미지 넘버, HP바, 네임태그 (world-to-screen projection)
- [FR-9] 안전지대 3D 시각화 (반투명 실린더 + warning)
- [FR-10] Remote player 3D 렌더링 + PvP 이펙트
- [FR-11] 2D/3D 모드 스위칭 (Settings, localStorage 저장)
- [FR-12] 기존 React HUD 컴포넌트 (MatrixHUD, ArenaHUD 등) 그대로 사용

### 비기능 요구사항
- [NFR-1] 성능: Normal 60fps (50적+30투사체), Arena 60fps (200적+100투사체), Mobile 30fps+
- [NFR-2] Draw Calls: Normal <20, Arena <40, Stress <60
- [NFR-3] 호환성: Chrome/Safari/Firefox, iOS Safari, Android Chrome
- [NFR-4] 적응형 품질: Quality Ladder 3-tier (고/중/저), FPS 기반 자동 하향
- [NFR-5] 모바일: Touch input 유지, 저해상도 fallback
- [NFR-6] 번들 크기: 3D 에셋 lazy loading, 초기 로딩 시간 3초 이내
- [NFR-7] 후방 호환: 2D 모드 유지, 기존 게임 밸런스 변경 없음

---

## 3. 기술 방향

| 영역 | 선택 | 근거 |
|------|------|------|
| **3D 엔진** | React Three Fiber (R3F) | 기존 React/Next.js 스택 통합, drei 헬퍼 |
| **렌더링 최적화** | InstancedMesh + BatchedMesh | Draw call 최소화 (<50) |
| **캐릭터 애니메이션** | Frame Swap | 복셀 미학 유지 + 구현 단순 |
| **에셋 포맷** | .glb (glTF Binary) | 단일 파일, 머티리얼 포함 |
| **에셋 제작** | MagicaVoxel → .obj → Blender → .glb | .vox 직접 export 불가, Blender 변환 필요 |
| **후처리** | @react-three/postprocessing | Bloom, Vignette, Flash |
| **World UI** | drei `<Html>` (world-to-screen projection) | 데미지넘버, 네임태그 |
| **물리** | 불필요 | 기존 collision/ 시스템 재사용 (2D 좌표 기반, 변경 불필요) |
| **카메라** | OrthographicCamera | 기존 isometric 뷰 재현 |
| **게임 루프** | 기존 Web Worker + useFrame(priority=0) | Worker=logic, useFrame=render |

### 좌표 매핑
```
2D World (x, y) → 3D World (x, 0, -y)
  x → x (좌우), y → z (전후, 부호반전), 없음 → y=0 (지면)
Isometric Transform → OrthographicCamera at (x+D, D, z+D), lookAt(x, 0, z)
```

---

## 4. 아키텍처 개요

### C4 Level 1 — System Context

```
[User Browser]
    ↓ WebSocket + HTTP
[Game Server] ← 기존 유지, 변경 없음
    ↓ state sync
[MatrixApp.tsx] ← 오케스트레이터, 변경 최소
    ↓ 53 props
[MatrixScene.tsx] ← NEW (MatrixCanvas.tsx 대체)
    ├── useGameLoop() ← update() 추출 (변경 0줄)
    ├── <R3F Canvas>
    │    ├── <GameCamera />
    │    ├── <VoxelTerrain />
    │    ├── <EntityRenderer />    ← InstancedMesh/BatchedMesh
    │    ├── <ProjectileRenderer />
    │    ├── <EffectsRenderer />
    │    └── <SafeZoneRenderer />
    └── <HUD Overlay /> ← 기존 React 컴포넌트 재사용
```

### 핵심 컴포넌트 역할

| 컴포넌트 | 역할 | 데이터 소스 |
|----------|------|-------------|
| `useGameLoop` | 기존 update() 그대로 — 순수 로직 | gameRefs, callbacks |
| `GameCamera` | Ortho 카메라 + follow + zoom + shake | playerRef, zoomRef |
| `VoxelTerrain` | Chunked ground + biome + terrain props | noise.ts, tileMap config |
| `EntityRenderer` | 플레이어 + 적 + 에이전트 3D 렌더링 | enemiesRef, playerRef |
| `ProjectileRenderer` | 투사체 InstancedMesh pool | projectilesRef |
| `EffectsRenderer` | 파티클 + bloom + screen effects | particlesRef, effectsRef |
| `SafeZoneRenderer` | 3D 안전지대 시각화 | arenaRefs |

### 데이터 흐름 (변경 없음)

```
Web Worker tick(16ms) → update(deltaTime) → refs 업데이트
useFrame(priority=0) → refs 읽기 → InstancedMesh matrix 업데이트 → 자동 렌더
```

---

## 5. 리스크

| ID | 리스크 | 심각도 | 완화 전략 |
|----|--------|--------|----------|
| R1 | 173개 적 에셋 제작 불가 | Critical | 10-15 base template + color/size 변형, 미구현은 colored cube |
| R2 | 성능 목표 미달 | Critical | InstancedMesh (10K큐브=60fps 검증), Quality Ladder, Phase별 벤치마크 |
| R3 | useFrame priority=0 제약 | High | Web Worker=logic, useFrame=render only (기존 패턴 유지) |
| R4 | 모바일 WebGL 호환성 | Medium | Quality Ladder + Canvas 2D fallback |
| R5 | 기존 HUD 깨짐 | Medium | CSS2DRenderer + React overlay 분리 |
| R6 | 멀티플레이어 동기화 | Low | 상태 직렬화는 좌표 기반, 렌더링 무관 |

---

## 구현 로드맵

> 8 Phase, 51 Tasks. 상세 연구 보고서: `docs/designs/v38-3d-conversion-research.md`
>
> **의존성 DAG**: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
> Phase 5는 Phase 3 이후 병렬 가능. Phase 6은 Phase 4+5 이후.

### Phase 1: Foundation — R3F 환경 + 게임 루프 추출

| Task | 설명 |
|------|------|
| R3F 패키지 설치 | `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `three` 설치 |
| useGameLoop 훅 추출 | MatrixCanvas의 `update()` 함수(1,150줄)를 독립 훅으로 추출 (로직 변경 0줄) |
| MatrixScene 컴포넌트 생성 | R3F `<Canvas>` 래퍼 + MatrixCanvasProps 인터페이스 재사용 |
| GameCamera 구현 | OrthographicCamera + LERP player follow + dynamic zoom(0.6-1.1) + screen shake |
| 기본 조명 세팅 | 3-light rig: AmbientLight(0.4) + DirectionalLight(1.0) + Fill(0.5) + shadow map |
| Foundation 통합 테스트 | 빈 3D 씬에서 update() 실행, 카메라 플레이어 추적 동작 확인 |

- **design**: N (엔진 기반 설정)
- **verify**: R3F Canvas 마운트 성공, update() 정상 실행, 카메라 LERP 추적 동작

### Phase 2: Terrain — Voxel 지형 시스템

| Task | 설명 |
|------|------|
| Ground Plane Mesh | Chunked grid mesh (200×200 units per chunk) + biome color mapping |
| Texture Atlas 생성 | 7 biome 타일 → 단일 texture atlas (Merged Geometry) |
| Simplex Noise 통합 | 기존 `noise.ts` 재사용, chunk별 biome 결정 |
| Terrain Object Templates | 7 terrain type × 3-5 variation = 25-35개 기본 voxel prop (.glb) |
| Object Instancing | hash-based placement + InstancedMesh 렌더링 |
| Pickup 3D Rendering | XP orb(glowing sphere) + item drops(voxel cube + float) + vacuum effect (InstancedMesh) |
| Terrain 성능 벤치마크 | 2000×2000 월드, 100+ prop, FPS ≥ 60 확인 |

- **design**: N (에셋 중심, 프로그래밍 지형)
- **verify**: 지형 렌더링 정상, biome 변화 확인, FPS ≥ 60fps

### Phase 3: Characters — Voxel 플레이어 캐릭터

| Task | 설명 |
|------|------|
| Base Voxel Character Model | MagicaVoxel로 기본 캐릭터 .glb (3-head chibi proportions) |
| 9 Class Variations | neo/tank/cypher/morpheus/niobe/oracle/trinity/mouse/dozer 색상+장비 변형 |
| Frame Swap Animation | idle(2f), walk(4f), hit(2f), death(3f) — .glb per frame |
| VoxelCharacterRenderer | R3F 컴포넌트, frame swap 애니메이션 + 8방향 facing (model Y rotation) |
| Skin Color System | per-instance vertex color 또는 material color override (24종 skin palette) |
| Player Upper/Lower Split | 기존 split rendering 재현 (lower body → skills → upper body) |
| 캐릭터 통합 테스트 | 지형 위 플레이어 이동, 8방향, animation 전환, skin 변경 확인 |

- **design**: N (에셋+로직 중심)
- **verify**: 9 클래스 전환, walk/idle/hit 애니메이션, 8방향 facing, skin 적용

### Phase 4: Enemies — Voxel 적 시스템

| Task | 설명 |
|------|------|
| Enemy Base Templates | 10-15개 base body .glb (humanoid_s/m/l, flying, crawler, sphere, boss) |
| Color Mapping System | CYBER_PALETTE 30색 → material color, 173 타입별 primary/secondary |
| InstancedMesh Enemy Renderer | 같은 template의 적을 InstancedMesh로 batch 렌더링 |
| BatchedMesh Integration | 서로 다른 template의 적을 BatchedMesh로 1 draw call 통합 |
| LOD 3-Tier System | HIGH(full model) / MID(simplified) / LOW(colored cube), 거리 기반 |
| Elite Effects | Shader-based glow (silver/gold/diamond) + orbiting particles (InstancedMesh) |
| Enemy 성능 벤치마크 | 200 적, 173 타입 혼합, FPS ≥ 60 확인 |

- **design**: N (에셋+렌더링 시스템)
- **verify**: 173 타입 렌더링, LOD 전환, elite glow, 200적 60fps

### Phase 5: Projectiles & Effects — 투사체 + 이펙트

| Task | 설명 |
|------|------|
| Projectile Object Pool | InstancedMesh 기반 object pool (spawn/despawn), 무기 카테고리별 6-10 pool |
| Melee Weapons (4) | whip(trail mesh), punch(shockwave ring), axe(scatter), sword(arc slash) |
| Ranged Weapons (6) | knife/bow/ping/shard/airdrop/fork — instanced bullet meshes |
| Magic Weapons (4) | wand(orb), bible(orbit ring), garlic(AOE ground decal), pool(ground decal) |
| Special Weapons (3) | bridge(barrier mesh), beam(cylinder+bloom), laser(cylinder+bloom) |
| Skill Weapons (30+) | 6 카테고리별 색상(CODE/DATA/NETWORK/SECURITY/AI/SYSTEM) + instanced projectile |
| Turret 3D Rendering | Turret base model(.glb) + 회전 애니메이션 + 자동 조준 + 발사 이펙트 |
| Post-Processing Pipeline | UnrealBloomPass(selective) + Vignette + ScreenFlash overlay |
| Particle System | InstancedMesh particles with easing, trail, fade, glow — 기존 ExtendedParticle 데이터 재사용 |

- **design**: N (이펙트 시스템 프로그래밍)
- **verify**: 17 기본 무기 비주얼, turret 3D 동작, bloom 동작, 파티클 burst, 100+ 투사체 60fps

### Phase 6: UI & HUD — 인터페이스 통합

| Task | 설명 |
|------|------|
| drei Html 통합 | drei `<Html>` 컴포넌트 활용, world-to-screen 앵커링 시스템 |
| Damage Numbers | CSS animation float-up, 색상/크기 by damage type (normal/crit/heal) |
| Health Bars & Nametags | 적/에이전트 머리 위 HP바 + 이름 (LOD 연동: HIGH=full, MID=bar, LOW=dot) |
| Safe Zone 3D | 반투명 실린더 mesh + shader fog + warning vignette + 방향 화살표 |
| HUD 통합 | 기존 React HUD 컴포넌트(MatrixHUD, ArenaHUD, KillFeed 등) 그대로 overlay |

- **design**: N (기존 UI 재사용 + 3D 앵커링)
- **verify**: 데미지넘버 표시, HP바 LOD 전환, 안전지대 3D 시각화, HUD 정상 overlay

### Phase 7: Multiplayer & Arena — 멀티플레이어 3D

| Task | 설명 |
|------|------|
| Remote Player 3D Rendering | Voxel character + LOD 3단계 + nation color (12개국 + 32 flags) |
| PvP Visual Effects | Hit shockwave (ring geometry + bloom), kill burst (instanced particles) |
| Agent Chat Bubbles | CSS2DRenderer speech bubbles with fade animation |
| Kill Feed & War Border | HTML overlay (기존 로직 재사용, 렌더링만 DOM 유지) |
| Arena 통합 테스트 | 9 에이전트 + safe zone shrink + PvP 전투 full flow 확인 |

- **design**: N (기존 시스템 3D 포팅)
- **verify**: 9 에이전트 렌더링, PvP hit/kill 이펙트, 채팅 버블, arena full flow

### Phase 8: Polish & Optimization — 최적화 + 마무리

| Task | 설명 |
|------|------|
| Quality Ladder | drei `<PerformanceMonitor>` + 3-tier 자동 품질: Tier1(full) → Tier2(reduced) → Tier3(minimal) |
| Mobile Optimization | Touch input 유지, 저해상도 fallback, particle count 감소 |
| 2D/3D Mode Switch | Settings에서 Classic(Canvas 2D)/Enhanced(Three.js 3D) 전환, localStorage 저장 |
| Final Benchmark & Report | 성능 리포트 (Normal/Arena/Stress/Mobile), 잔여 이슈, v39 계획 |

- **design**: N (시스템 최적화)
- **verify**: Quality Ladder 자동 전환, 모바일 30fps+, 2D/3D 스위칭 정상, 최종 벤치마크 통과
