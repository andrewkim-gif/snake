# v10 — 3D Graphics Architecture & Gameplay Detail Spec

> **Status**: Draft
> **Parent**: [v10-survival-roguelike-plan.md](v10-survival-roguelike-plan.md) §1.6, §5B, §9
> **Scope**: MC 복셀 3D 렌더링 아키텍처 + 플레이 가능한 게임플레이 상세 + 애매한 기획 구체화
> **Tech**: Three.js 0.175 + React Three Fiber 9.5 + Drei 10.7 (기존 스택 유지)
> **기존 자산 활용**: VoxelSnake, VoxelTerrain, VoxelOrbs, PlayCamera, InstancedMesh 파이프라인 전부 재사용

---

## 목차

- [Part A: 3D Graphics Architecture](#part-a-3d-graphics-architecture)
  - [A1. MC Agent 3D 모델 시스템](#a1-mc-agent-3d-모델-시스템)
  - [A2. 3D 맵/지형 시스템](#a2-3d-맵지형-시스템)
  - [A3. 카메라 시스템](#a3-카메라-시스템)
  - [A4. 렌더 파이프라인 & Scene Graph](#a4-렌더-파이프라인--scene-graph)
  - [A5. 애니메이션 시스템](#a5-애니메이션-시스템)
  - [A6. 이펙트 & 파티클 시스템](#a6-이펙트--파티클-시스템)
  - [A7. 라이팅 & 분위기](#a7-라이팅--분위기)
  - [A8. 텍스처 파이프라인](#a8-텍스처-파이프라인)
  - [A9. 성능 예산 & 최적화](#a9-성능-예산--최적화)
  - [A10. 플레이어빌리티 — 조작/피드백/게임필](#a10-플레이어빌리티--조작피드백게임필)
- [Part B: 애매한 기획 구체화 (25개 항목)](#part-b-애매한-기획-구체화)
  - [B1~B7: 전투/밸런스 수치](#b1-b7-전투밸런스-수치)
  - [B8~B14: 맵/존/스폰 로직](#b8-b14-맵존스폰-로직)
  - [B15~B20: UI/UX/렌더링 상세](#b15-b20-uiux렌더링-상세)
  - [B21~B25: 콘텐츠/메타/마이그레이션](#b21-b25-콘텐츠메타마이그레이션)

---

## Part A: 3D Graphics Architecture

### A1. MC Agent 3D 모델 시스템

> **기존 자산**: `VoxelSnake.tsx` — InstancedMesh 몸통 + Mesh 머리 + 16×16 Canvas 텍스처
> **전환**: 뱀 세그먼트 연결체 → MC 휴머노이드 단일 캐릭터

#### A1.1 Agent 3D 모델 구조 — `VoxelAgent.tsx`

```
MC 캐릭터 복셀 구조 (Steve 비율 축소):

         ┌───┐
         │ ● │  ← Head (8×8×8 units)
         └─┬─┘
       ┌───┼───┐
       │   │   │  ← Arms (4×12×4 units each, 양쪽)
       │ ┌─┴─┐ │
       │ │   │ │  ← Body/Torso (8×12×4 units)
       │ └───┘ │
       └───┬───┘
         ┌─┴─┐
         │   │    ← Legs (4×12×4 units each, 양쪽)
         └───┘

총 6개 파트: Head, Body, ArmL, ArmR, LegL, LegR
스케일: 1 unit = 1px (16×16 텍스처에서 1px = 게임 내 1unit)
전체 높이: 32 units (Head 8 + Body 12 + Legs 12)
```

#### A1.2 Geometry & Mesh 구성

```typescript
// VoxelAgent.tsx — 단일 Agent 렌더링 컴포넌트
// 기존 VoxelSnake의 InstancedMesh 패턴 재사용

const PARTS = {
  head:  { size: [8, 8, 8],   offset: [0, 24, 0] },
  body:  { size: [8, 12, 4],  offset: [0, 14, 0] },
  armL:  { size: [4, 12, 4],  offset: [-6, 14, 0] },
  armR:  { size: [4, 12, 4],  offset: [6, 14, 0] },
  legL:  { size: [4, 12, 4],  offset: [-2, 2, 0] },
  legR:  { size: [4, 12, 4],  offset: [2, 2, 0] },
} as const

// 렌더링 방식: Group + 6 Mesh (파트별 독립 변환 가능)
<group ref={agentRef} position={toWorld(x, y, 0)}>
  <mesh geometry={boxGeo} material={headMat} position={PARTS.head.offset} />
  <mesh geometry={boxGeo} material={bodyMat} position={PARTS.body.offset} />
  <mesh geometry={boxGeo} material={armMat}  position={PARTS.armL.offset} />
  <mesh geometry={boxGeo} material={armMat}  position={PARTS.armR.offset} />
  <mesh geometry={boxGeo} material={legMat}  position={PARTS.legL.offset} />
  <mesh geometry={boxGeo} material={legMat}  position={PARTS.legR.offset} />
</group>
```

#### A1.3 대량 Agent 렌더링 — InstancedMesh 전략

```
전략: 파트별 InstancedMesh (6개)

InstancedMesh × 6:
  headMesh:  maxCount=MAX_AGENTS (60)
  bodyMesh:  maxCount=MAX_AGENTS
  armLMesh:  maxCount=MAX_AGENTS
  armRMesh:  maxCount=MAX_AGENTS
  legLMesh:  maxCount=MAX_AGENTS
  legRMesh:  maxCount=MAX_AGENTS

총 Draw Calls: 6 (파트 수) — 에이전트 수와 무관
비교: 기존 VoxelSnake는 body(1) + head(N) = N+1 draw calls
```

```typescript
// AgentInstances.tsx — 전체 Agent 일괄 렌더링
const MAX_AGENTS = 60 // 18 플레이어 + 봇 15~20 + 여유

// 파트별 InstancedMesh
const headRef = useRef<THREE.InstancedMesh>(null!)
const bodyRef = useRef<THREE.InstancedMesh>(null!)
// ... armL, armR, legL, legR

useFrame(() => {
  const agents = agentsRef.current
  let idx = 0
  for (const agent of agents) {
    if (!agent.alive) continue
    const { x, y, heading, mass } = agent
    const scale = getAgentScale(mass) // A1.4 참조
    const rotY = headingToRotY(heading)

    // Head
    _obj.position.set(x, PARTS.head.offset[1] * scale, y)
    _obj.rotation.set(0, rotY, 0)
    _obj.scale.setScalar(scale)
    _obj.updateMatrix()
    headRef.current.setMatrixAt(idx, _obj.matrix)

    // Body, Arms, Legs — 동일 패턴 (offset만 다름)
    // ... (각 파트별 offset 적용)

    idx++
  }
  headRef.current.count = idx
  bodyRef.current.count = idx
  // ...
  headRef.current.instanceMatrix.needsUpdate = true
  // ...
})
```

#### A1.4 Mass 기반 스케일링

```typescript
// mass → 시각적 크기 매핑
function getAgentScale(mass: number): number {
  // mass 10(초기) → scale 1.0
  // mass 50 → scale 1.3
  // mass 100(최대) → scale 1.6
  // 로그 스케일 — 차이가 극단적이지 않게
  return 1.0 + Math.log2(mass / 10) * 0.3
}

// 히트박스 반경 (서버 동기화)
function getHitboxRadius(mass: number): number {
  // 기본 16 + mass 비례 증가 (최대 28)
  return 16 + Math.min(12, (mass - 10) * 0.133)
}
```

#### A1.5 Agent 텍스처 시스템

```
기존 voxel-textures.ts 패턴 확장:

Canvas 16×16 → THREE.CanvasTexture (NearestFilter)

파트별 텍스처:
  head:  얼굴(정면) + 머리색(측면/상단) + 모자(오버레이)
  body:  의상 색상 + 패턴 (solid/striped/checkered/dotted)
  arms:  피부톤 또는 의상 연장
  legs:  바지 색상 + 신발(하단 4px)

커스터마이징 반영:
  Tier 1 (체형): scale 조정 (slim=0.85, default=1.0)
  Tier 2 (색상): bodyColor → body/arms 텍스처, legColor → legs 텍스처
  Tier 3 (얼굴): eyeStyle + mouthStyle → head 정면 텍스처
  Tier 4 (장비): hat → head 위 추가 Mesh, accessory → body 오버레이

텍스처 캐시:
  skinCache: Map<skinHash, { head, body, arm, leg: THREE.CanvasTexture }>
  skinHash = `${bodyType}-${skinTone}-${bodyColor}-${legColor}-${pattern}-${eye}-${mouth}`
  동일 조합 재사용 → 텍스처 생성 1회만
```

#### A1.6 장비(Tier 4) 추가 Mesh

```
장비는 별도 InstancedMesh가 아닌 Agent Group 내 추가 Mesh:

모자 (6종 Phase 1):
  none / helmet(철 투구) / crown(금관) / wizard(마법사 모자) / hood(두건) / cap(야구모자)
  → Head 위에 BoxGeometry 추가 (모자별 크기/형태 다름)
  → 모자용 InstancedMesh 1개 (모자 착용 Agent만)

악세서리 (4종 Phase 1):
  none / scarf(목도리) / goggles(고글) / cape_mini(미니 망토)
  → Body에 부착되는 추가 Geometry
  → 악세서리용 InstancedMesh 1개

총 추가 Draw Calls: +2 (모자, 악세서리) = 전체 8 draw calls
```

---

### A2. 3D 맵/지형 시스템

> **기존 자산**: `VoxelTerrain.tsx` (CircleGeometry 바닥) + `LobbyHills.tsx` (InstancedMesh 지형)
> **전환**: 단순 원형 바닥 → 존별 텍스처 + 데코 오브젝트 + 맵 구조물

#### A2.1 지형 바닥 — 존별 텍스처 렌더링

```
아레나 구조 (동심원 3개 존):

  ┌─────────────────────────────────┐
  │  Edge Zone (외곽 40%)            │  잔디 + 참나무 + 꽃
  │    ┌───────────────────────┐    │
  │    │  Mid Zone (중간 35%)    │    │  돌 + 횃불 + 석재벽 파편
  │    │    ┌─────────────┐    │    │
  │    │    │  Core (25%)  │    │    │  네더랙 + 용암 + 레드스톤
  │    │    └─────────────┘    │    │
  │    └───────────────────────┘    │
  └─────────────────────────────────┘

arenaRadius = 6000 (서버 ARENA_SIZE)
  Edge: r > arenaRadius × 0.60 (= 3600~6000)
  Mid:  r > arenaRadius × 0.25 (= 1500~3600)
  Core: r ≤ arenaRadius × 0.25 (= 0~1500)
```

#### A2.2 바닥 렌더링 방식

```typescript
// 방식: 3개 동심원 CircleGeometry (기존 VoxelTerrain 확장)
// 각 존별 다른 텍스처 + 색상

<group>
  {/* Core — 네더랙 */}
  <mesh rotation-x={-Math.PI/2} position-y={-0.1}>
    <circleGeometry args={[1500, 64]} />
    <meshLambertMaterial map={netherrackTex} />
  </mesh>

  {/* Mid — 돌 */}
  <mesh rotation-x={-Math.PI/2} position-y={-0.2}>
    <ringGeometry args={[1500, 3600, 64]} />
    <meshLambertMaterial map={stoneTex} />
  </mesh>

  {/* Edge — 잔디 */}
  <mesh rotation-x={-Math.PI/2} position-y={-0.3}>
    <ringGeometry args={[3600, 6000, 64]} />
    <meshLambertMaterial map={grassTex} />
  </mesh>
</group>

// 텍스처: 16×16 Canvas 프로시저럴 (기존 패턴)
// grassTex:      #5D9B47 상단 + #8B6A3E 흙
// stoneTex:      #808080 + #666666 노이즈
// netherrackTex: #6B2020 + #8B3030 불규칙
```

#### A2.3 환경 데코레이션 — InstancedMesh 배치

```
기존 LobbyTerrainObjects.tsx 패턴 그대로 재사용:

Edge Zone 데코:
  참나무:  trunk InstancedMesh(20) + canopy InstancedMesh(20)
           크기: trunk 4×16×4, canopy 12×12×12
           배치: Edge 존 내 랜덤 (agent 충돌 없음, 데코 전용)
  꽃/덤불: stem InstancedMesh(30) + petal InstancedMesh(30)
           크기: 4×6×4

Mid Zone 데코:
  횃불:    InstancedMesh(16), 크기 2×8×2
           이펙트: emissive orange (#FF6600), intensity 0.3
           애니메이션: Y 스케일 0.9~1.1 (2fps 느낌으로 0.5Hz sin)
  석재벽:  InstancedMesh(8), 크기 16×12×4 (부서진 벽 느낌)

Core Zone 데코:
  용암 풀: InstancedMesh(6), 크기 20×1×20 (납작한 박스)
           material: emissive #FF4400, opacity 0.8
  레드스톤 파티클: §A6 파티클 시스템으로 처리

총 데코 Draw Calls: ~12 (InstancedMesh 종류 수)
배치: 라운드 시작 시 시드 기반 랜덤 (서버에서 시드 전달, 클라이언트 동일 배치)
```

#### A2.4 맵 구조물 (Shrine/Shop/Altar) — 3D 복셀 모델

```
구조물은 사전 정의된 복셀 블록 조합:

XP Shrine (경험치 성소):
  ┌───┐
  │ ◆ │ ← 상단: 초록 크리스탈 (emissive, 회전)
  ├───┤
  │   │ ← 기둥: 석재 블록 3단 (8×24×8)
  └───┘
  ■■■■■ ← 받침대: 석재 플랫폼 (16×4×16)
  draw calls: 3 (기둥 + 받침대 + 크리스탈)

Healing Spring (회복 샘):
  ~~~~~  ← 수면: 반투명 파랑 (opacity 0.5, 물결 애니메이션)
  ┌───┐  ← 테두리: 이끼 낀 돌 (12×4×12 ring)
  └───┘
  draw calls: 2 (테두리 + 수면)

Upgrade Altar (업그레이드 제단):
  ╔═══╗
  ║ ✦ ║ ← 부유 마법서 (회전 + 부유 bob)
  ╚═══╝
  ■■■■■ ← 옵시디언 제단 (12×8×12)
  draw calls: 2 (제단 + 마법서)

구조물 총 수: 3(XP) + 2(Healing) + 2(Altar) = 7개
구조물 총 draw calls: ~20 (구조물당 2-3)
```

#### A2.5 아레나 경계 — 수축 시각화

```
기존 VoxelBoundary.tsx 재사용 + 수축 애니메이션:

경계벽: CylinderGeometry (open-ended)
  material: MeshBasicMaterial, color #FF3333, opacity 0.25, transparent
  높이: 24 units (agent가 넘어갈 수 없는 벽 느낌)

수축 시:
  1. radius를 서버 값으로 lerp (posSmooth = 0.1)
  2. 수축 10초 전: 빨간 점선 원 표시 (새 경계선 미리보기)
     → RingGeometry + dashed material (MeshBasicMaterial, dashSize 20, gapSize 20)
  3. 수축 중: 경계벽 색상 intensity 증가 (0.25 → 0.5)
  4. 레드스톤 파티클: 경계선 따라 흩뿌림 (§A6)
```

---

### A3. 카메라 시스템

> **기존 자산**: `PlayCamera.tsx` (mass 기반 동적 줌 + lerp 추적)
> **전환**: 2D 탑다운 → 3/4 뷰 (45° 경사 탑뷰)

#### A3.1 게임플레이 카메라 — 3/4 뷰 (쿼터뷰)

```
카메라 배치:

          카메라 ●
              ╲  (45° 아래로)
               ╲
                ╲
    ─────────────●──────── 지면
               Agent

수치:
  FOV:       50° (기존 유지)
  Near:      1
  Far:       1500
  Height:    300 / zoom (기존 PlayCamera 유지)
  Behind:    180 / zoom (기존 PlayCamera 유지)
  Angle:     ~59° (atan2(300, 180) ≈ 59°) — 실질적으로 기존과 동일

기존 PlayCamera.tsx의 공식:
  desiredX = targetX
  desiredY = height     = 300 / targetZoom
  desiredZ = targetZ + behind = targetZ + 180 / targetZoom
  camera.lookAt(targetX, 0, targetZ)

→ 이미 3/4 뷰! 기존 카메라 그대로 사용 가능.
```

#### A3.2 동적 줌 — Mass 기반

```typescript
// 기존 PlayCamera 공식 유지
const targetZoom = Math.max(0.35, Math.min(1.0,
  1.0 - Math.pow(mass, 0.4) * 0.03
))

// mass=10  → zoom=0.94 (가까이)
// mass=50  → zoom=0.78 (중간)
// mass=100 → zoom=0.65 (멀리)

// Lerp 보간 (frame-independent)
const posSmooth  = 1 - Math.pow(1 - 0.15, delta * 60)  // 위치 15%/frame
const zoomSmooth = 1 - Math.pow(1 - 0.08, delta * 60)  // 줌 8%/frame
```

#### A3.3 카메라 전환 (로비 → 게임)

```
로비:  LobbyCamera (공전 0.05 rad/s, height 180, radius 350)
게임:  PlayCamera (Agent 추적, 동적 줌)

전환 방식:
  1. 로비에서 "Play" 클릭
  2. 300ms opacity fade (기존 CSS transition)
  3. 게임 Canvas 마운트 → PlayCamera 즉시 Agent 위치로 스냅
  4. 카메라 shake 없음 (lerp가 1프레임 내 수렴)

→ 기존 page.tsx의 lobby/playing 모드 전환 그대로 유지
```

---

### A4. 렌더 파이프라인 & Scene Graph

> **기존 자산**: `GameCanvas3D.tsx` — Canvas → Scene → GameLoop → SnakeGroup → VoxelSnake

#### A4.1 Scene Graph 구조

```
<Canvas dpr={[1,1]} gl={{ antialias: true }}>
  │
  ├── <Scene />                    // ambientLight + directionalLight
  ├── <SkyBox />                   // 하늘 돔 + 구름
  │
  ├── <ZoneTerrain />              // §A2 — 3존 바닥 + 데코
  │   ├── <EdgeFloor />            // 잔디 CircleGeometry
  │   ├── <MidFloor />             // 돌 RingGeometry
  │   ├── <CoreFloor />            // 네더랙 CircleGeometry
  │   ├── <TreeInstances />        // InstancedMesh ×2
  │   ├── <RockInstances />        // InstancedMesh ×1
  │   ├── <TorchInstances />       // InstancedMesh ×1
  │   └── <LavaPoolInstances />    // InstancedMesh ×1
  │
  ├── <MapStructures />            // §A2.4 — Shrine/Shop/Altar
  │   ├── <XPShrine position={[...]} /> ×3
  │   ├── <HealingSpring position={[...]} /> ×2
  │   └── <UpgradeAltar position={[...]} /> ×2
  │
  ├── <ArenaBoundary />            // §A2.5 — 수축 경계벽
  │
  ├── <AgentInstances />           // §A1.3 — 전체 Agent 일괄 렌더링
  │   ├── headMesh (InstancedMesh, count=MAX_AGENTS)
  │   ├── bodyMesh (InstancedMesh)
  │   ├── armLMesh, armRMesh (InstancedMesh)
  │   ├── legLMesh, legRMesh (InstancedMesh)
  │   ├── hatMesh  (InstancedMesh, 모자 착용자만)
  │   └── accMesh  (InstancedMesh, 악세서리 착용자만)
  │
  ├── <OrbInstances />             // 기존 VoxelOrbs 유지
  │
  ├── <EffectsLayer />             // §A6 — 이펙트/파티클
  │   ├── <AuraRings />            // 오라 범위 원
  │   ├── <DashTrails />           // 대시 잔상
  │   └── <Particles />            // MC 파티클
  │
  ├── <GameLoop />                 // 상태 업데이트 (priority -1)
  └── <PlayCamera />               // 카메라 추적 (priority 1)
</Canvas>
```

#### A4.2 렌더 순서 & useFrame Priority

```
priority -1: GameLoop       — 서버 상태 보간, ref 업데이트
priority  0: AgentInstances — InstancedMesh matrix 업데이트
priority  0: OrbInstances   — Orb matrix + color 업데이트
priority  0: EffectsLayer   — 파티클 물리
priority  0: MapStructures  — 크리스탈 회전, 물결 등
priority  1: PlayCamera     — 카메라 위치 lerp (모든 위치 확정 후)
```

#### A4.3 Draw Call 예산

```
Category                    Draw Calls
─────────────────────────────────────
Sky (dome + clouds 15)          2
Terrain (3 zone floors)         3
Deco (trees, rocks, etc.)      12
Map Structures (7 objects)     ~20
Arena Boundary                  2
Agent Parts (6 + hat + acc)     8
Orbs                            1
Effects (aura + trails)         3
─────────────────────────────────────
Total                         ~51

목표: 50~60 draw calls (Three.js 권장: <100)
```

---

### A5. 애니메이션 시스템

> **기존 자산**: useFrame 기반 수동 애니메이션 (VoxelSnake tail taper, LobbyIdleSnakes 5가지 패턴)
> **방식**: Skeletal Animation 없음 — MC처럼 파트별 rotation 애니메이션 (저비용, 복셀 미학)

#### A5.1 Agent 애니메이션 상태

```
상태               트리거             파트 동작
────────────────────────────────────────────────────
idle               velocity ≈ 0       팔/다리 미세 흔들림 (±3°, 0.8Hz)
walk               velocity > 0       팔/다리 교차 스윙 (±30°, speed 비례)
boost              boosting=true      팔 뒤로 고정(-45°) + 다리 빠른 스윙(2x freq)
death              alive=false        전체 Y축 90° 눕기 + 0.5s fade out
spawn              respawn 직후       Y축 아래→위 pop (0→1 scale, 0.3s ease-out)
levelup            levelUp=true       전체 0.2s Y bounce (y += 8) + 별 파티클
```

#### A5.2 파트별 Rotation 공식

```typescript
// walk 애니메이션
const walkFreq = Math.min(velocity / 100, 3) // 속도 비례, 최대 3Hz
const walkAmp = 0.52 // ~30° in radians

const armSwing = Math.sin(elapsed * walkFreq * Math.PI * 2) * walkAmp
const legSwing = -armSwing // 팔-다리 반대

// InstancedMesh에 적용
armLMatrix: rotation.x = armSwing
armRMatrix: rotation.x = -armSwing
legLMatrix: rotation.x = legSwing
legRMatrix: rotation.x = -legSwing

// idle (미세 흔들림)
const idleSwing = Math.sin(elapsed * 0.8 * Math.PI * 2) * 0.05 // ±3°

// boost (팔 뒤로 고정 + 빠른 다리)
armL/R: rotation.x = -0.78 // -45° 고정
legL/R: rotation.x = Math.sin(elapsed * walkFreq * 2 * Math.PI * 2) * walkAmp
```

#### A5.3 InstancedMesh 애니메이션 전략

```
문제: InstancedMesh는 인스턴스별 다른 rotation 불가?
해결: Matrix4에 rotation 포함!

setMatrixAt(idx, matrix) 호출 시:
  matrix = TRS (Translation × Rotation × Scale)
  → 파트별로 "글로벌 위치 + 파트 오프셋 + 파트 rotation" 조합

각 Agent의 각 파트:
  T = agentWorldPos + partOffset (rotated by heading)
  R = heading rotation × partAnimation rotation
  S = agentScale

compose로 합성:
  _obj.position.copy(T)
  _obj.quaternion.setFromEuler(R)
  _obj.scale.setScalar(S)
  _obj.updateMatrix()
  mesh.setMatrixAt(idx, _obj.matrix)

CPU 부하: 60 agents × 6 parts × 1 matrix compose/frame = 360 matrix ops
→ 충분히 빠름 (ms 단위 이하)
```

---

### A6. 이펙트 & 파티클 시스템

> MC 스타일: 4×4 정사각형 픽셀 파티클, 단색, 중력 영향

#### A6.1 파티클 엔진 — InstancedMesh 기반

```typescript
// MCParticles.tsx
// 단일 InstancedMesh로 모든 파티클 렌더링

const MAX_PARTICLES = 500
const particlePool: Particle[] = []

interface Particle {
  x, y, z: number
  vx, vy, vz: number    // 속도
  life: number           // 남은 수명 (초)
  maxLife: number
  color: THREE.Color
  size: number           // 4~8 units
  gravity: number        // 0 = 부유, -98 = 낙하
}

// InstancedMesh: BoxGeometry(1,1,1) + MeshBasicMaterial(vertexColors)
// 파티클별: position + scale(size) + color
```

#### A6.2 파티클 타입별 스펙

```
타입              색상           수량/이벤트  수명   중력    용도
──────────────────────────────────────────────────────────────────
XP_COLLECT        #7FFF00 초록   8개         0.5s   -40     오브 수집 시
DEATH_BURST       에이전트 색상   20개        1.0s   -98     사망 시 폭발
LEVELUP_STAR      #FFD700 금     12개        0.8s   -20     레벨업 시 별
HEAL_HEART        #FF3333 빨강   5개         0.6s   -30     회복 샘 치유
AURA_SPARK        빌드 색상      2/tick      0.3s    0      오라 범위 내 스파크
BOUNDARY_REDSTONE #FF0000 빨강   3/tick      0.5s   -40     경계선 레드스톤
DASH_TRAIL        에이전트 색상   4/tick      0.2s    0      대시 궤적
SHRINE_AMBIENT    #7FFF00 초록   1/tick      1.0s   -10     성소 주변 부유
```

#### A6.3 오라 범위 시각화

```
오라 = Agent 주변 반투명 원

렌더링: RingGeometry (innerR=0, outerR=auraRadius)
  material: MeshBasicMaterial, transparent, opacity=0.08
  color: Agent의 primaryColor
  position: Agent 발 아래 (y=0.5)
  rotation-x: -π/2 (수평)

펄스 애니메이션:
  const pulse = 1 + Math.sin(elapsed * 3) * 0.05
  ring.scale.setScalar(pulse)

DPS 전투 중 (다른 Agent 오라 겹침):
  opacity 0.08 → 0.15 (강조)
  스파크 파티클 발생 (AURA_SPARK)

InstancedMesh 사용:
  auraRingMesh: InstancedMesh(MAX_AGENTS)
  alive + oura 가진 Agent만 렌더
```

#### A6.4 대시(Boost) 이펙트

```
대시 중 Agent 뒤에 잔상:

방식: Agent의 이전 3프레임 위치에 반투명 복제
  ghost[0]: opacity 0.3, scale 0.95 (1프레임 전)
  ghost[1]: opacity 0.15, scale 0.9 (2프레임 전)
  ghost[2]: opacity 0.05, scale 0.85 (3프레임 전)

구현: 별도 InstancedMesh가 아닌 DASH_TRAIL 파티클로 대체
  → 파티클 4개/tick, 수명 0.2s, Agent 색상, 크기=Agent 크기의 80%
  → 자연스러운 잔상 효과 (MC 스타일)
```

#### A6.5 빌드 시각 이펙트

```
Tome ×3+ 이상 시 시각 이펙트 발동:

| Tome       | 이펙트                    | 렌더링                           |
|------------|--------------------------|----------------------------------|
| Damage ×3+ | 빨간 전투 오라 테두리       | 오라 링 color=#FF3333, opacity 0.12 |
| Armor ×3+  | 파란 보호막 글로우         | body emissive=#3388FF, intensity=0.2 |
| Speed ×3+  | 잔상 이펙트 (항시)         | DASH_TRAIL 파티클 2/tick (부스트 아닐 때도) |
| XP ×3+     | 초록 XP 아우라            | 오라 링 color=#7FFF00, opacity 0.10 |
| Luck ×3+   | 금빛 반짝임               | 파티클 1/2tick, #FFD700, 수명 0.4s |
| Cursed ×3+ | 보라 안개                 | 파티클 1/tick, #8800FF, 수명 0.6s, gravity=0 |

스택 강도 스케일:
  3 stacks: base intensity (위 표의 값)
  5 stacks: intensity × 1.5
  7+ stacks: intensity × 2.0 (최대)

다중 이펙트 동시 발동 시: 모든 이펙트 중첩 렌더링 (우선순위 없음)
```

---

### A7. 라이팅 & 분위기

> **기존 자산**: Scene.tsx — ambientLight 0.55 + directionalLight 0.85
> **원칙**: MC 플랫 셰이딩 유지 — 그림자 없음, MeshLambertMaterial 통일

#### A7.1 라이팅 셋업

```typescript
// 기존 Scene.tsx 그대로 유지 — 이미 MC 미학에 최적화

<ambientLight intensity={0.55} />
<directionalLight
  position={[100, 150, 80]}
  intensity={0.85}
  castShadow={false}  // 성능 + MC 미학 (플랫 셰이딩)
/>

// Shadow casting 안 함 = GPU 부하 대폭 절감
// MeshLambertMaterial = diffuse only, no specular
// → 전형적인 Minecraft 조명 느낌
```

#### A7.2 안개(Fog) — 분위기 + 성능

```typescript
// 기존 LobbyCamera 패턴 확장

scene.fog = new THREE.Fog('#87CEEB', 400, 1200)

// Near=400: Agent 주변 400u까지 선명
// Far=1200: 1200u 이후 완전히 안개에 묻힘
// → 먼 데코/구조물 자연스럽게 페이드 = draw call 절약 불필요 (GPU가 알아서 discard)

// 라운드 진행에 따른 분위기 변화:
// 0~2분: fog color #87CEEB (맑은 하늘)
// 2~4분: fog color lerp → #5566AA (어두워짐)
// 4~5분: fog color lerp → #332244 (긴박한 보라)
// fog near: 400 → 250 (시야 좁아짐)

function updateAtmosphere(roundTimeRemaining: number) {
  const t = 1 - roundTimeRemaining / 300 // 0→1 over 5 min
  const skyColor = lerpColor('#87CEEB', '#332244', Math.pow(t, 1.5))
  scene.fog!.color.set(skyColor)
  scene.fog!.near = 400 - t * 150    // 400→250
  scene.background = new THREE.Color(skyColor)
}
```

#### A7.3 존별 분위기 차이

```
Core Zone 추가 이펙트:
  - 바닥 emissive: netherrack 텍스처에 emissive #331111, intensity 0.1
  - 용암 풀: emissive #FF4400, intensity 0.4
  → Core에 들어가면 바닥이 미세하게 빛남 (위험 분위기)

Mid Zone:
  - 횃불 emissive: #FF6600, intensity 0.3
  - 주변 타일에 미세한 따뜻한 톤 (모든 material의 ambient가 자연스럽게 반영)

Edge Zone:
  - 기본 라이팅 (추가 이펙트 없음)
  - 나무 그림자 대신 바닥에 어두운 원형 데칼 (InstancedMesh, opacity 0.15)
```

---

### A8. 텍스처 파이프라인

> **기존 자산**: `voxel-textures.ts` — Canvas 16×16 프로시저럴 생성 + skinCache/faceCache

#### A8.1 에셋 전략 — 100% 프로시저럴

```
외부 이미지 파일 0개. 모든 텍스처는 Canvas 2D로 생성.

이유:
  1. 번들 사이즈 0 (이미지 없음)
  2. 커스터마이징 무한 조합 가능 (런타임 색상 변경)
  3. NearestFilter로 MC 픽셀 아트 자연스러움
  4. 기존 패턴 검증 완료 (voxel-textures.ts)
```

#### A8.2 텍스처 생성 파이프라인

```typescript
// agent-textures.ts

interface AgentSkinConfig {
  bodyType: 'default' | 'slim'
  skinTone: number     // 0-14 (15종)
  bodyColor: number    // 0-11 (12 팔레트)
  legColor: number     // 0-11
  pattern: 'solid' | 'striped' | 'checkered' | 'dotted'
  eyeStyle: number     // 0-7 (8종)
  mouthStyle: number   // 0-5 (6종)
  hat: number          // 0-5 (6종, 0=none)
  accessory: number    // 0-3 (4종, 0=none)
}

function generateAgentTextures(config: AgentSkinConfig): AgentTextures {
  return {
    head:  generateHeadTexture(config),   // 16×16: 얼굴+머리색
    body:  generateBodyTexture(config),   // 16×16: 의상+패턴
    arm:   generateArmTexture(config),    // 8×16: 피부톤/의상
    leg:   generateLegTexture(config),    // 8×16: 바지+신발
  }
}

// 캐시 키: config의 모든 필드를 연결한 해시 문자열
const textureCache = new Map<string, AgentTextures>()

function getAgentTextures(config: AgentSkinConfig): AgentTextures {
  const key = JSON.stringify(config)
  if (!textureCache.has(key)) {
    textureCache.set(key, generateAgentTextures(config))
  }
  return textureCache.get(key)!
}
```

#### A8.3 Head 텍스처 (16×16) 상세

```
16×16 Canvas 레이아웃 (정면):

Row 0-3:   머리 상단 (skinTone 색상)
Row 4-5:   눈 라인
  Col 3-5:   왼쪽 눈 (eyeStyle별 패턴)
  Col 10-12: 오른쪽 눈
Row 6-7:   코 (skinTone)
Row 8-9:   입 (mouthStyle별 패턴)
Row 10-15: 머리 하단 (skinTone)

eyeStyle 8종:
  0: dot (1px 검정)
  1: line (2px 검정 수평)
  2: anime (2×2 검정 + 1px 하이라이트)
  3: sleepy (2px 수평, 반 감김)
  4: angry (V자 눈썹 + dot)
  5: happy (아치형)
  6: cross (X자)
  7: star (★ 형태, 2×2)

mouthStyle 6종:
  0: line (2px 수평)
  1: smile (아치)
  2: open (2×2 검정)
  3: tongue (아치 + 빨강 1px)
  4: fangs (V V 형태)
  5: none (비어있음)
```

#### A8.4 Body/Leg 텍스처 패턴

```
pattern 4종 (16×16 Canvas에 적용):

solid:      단색 채움
striped:    4px 간격 수평 줄무늬 (bodyColor + bodyColor 밝은 변형)
checkered:  4×4 체커보드 (bodyColor + bodyColor 어두운 변형)
dotted:     4px 간격 2×2 도트 (bodyColor 위에 밝은 도트)

Leg 텍스처 (8×16):
  Row 0-11:  legColor + pattern
  Row 12-15: 신발 (legColor보다 어두운 톤)
```

---

### A9. 성능 예산 & 최적화

#### A9.1 성능 목표

```
Target:  60fps @ 1080p, integrated GPU (MacBook Air M1 기준)
Agents:  최대 40 동시 (18 플레이어 + 15 봇 + 여유)
Orbs:    최대 2000 (기존 VoxelOrbs 유지)
Particles: 최대 500 동시

Browser: Chrome 120+ / Safari 17+ / Firefox 120+
WebGL:   2.0 (fallback 불필요 — R3F 9.5 기본)
```

#### A9.2 Draw Call 분석

```
Component               Instances   Draw Calls   Triangles
────────────────────────────────────────────────────────────
Sky dome + clouds           16          2         ~1K
Terrain floors              3           3         ~0.5K
Deco InstancedMesh          ~7          7         ~3K
Map structures              7          ~15        ~2K
Arena boundary              1           1         ~0.2K
Agent parts (6 IM)          40×6        6         ~3K
Agent hat/acc (2 IM)        ~20         2         ~0.5K
Orbs (1 IM)                 2000        1         24K
Aura rings (1 IM)           40          1         ~2K
Particles (1 IM)            500         1         ~6K
────────────────────────────────────────────────────────────
Total                                 ~39        ~42K triangles

42K triangles @ 60fps = 2.5M tri/sec
→ integrated GPU에서 매우 가벼움 (보통 50M+ tri/sec 처리)
```

#### A9.3 핵심 최적화 전략

```
1. InstancedMesh 일괄 렌더링 (기존 검증됨)
   - Agent 40명 = 8 draw calls (파트별 IM)
   - Orb 2000개 = 1 draw call
   - 데코 100개+ = 7 draw calls

2. 프로시저럴 텍스처 캐싱 (기존 검증됨)
   - 동일 스킨 = 캐시 히트
   - Canvas 16×16 = 텍스처 메모리 ~1KB/개
   - 40 Agent × 4 parts = 160 텍스처 = ~160KB

3. Ref 기반 업데이트 (기존 검증됨)
   - React re-render 0회/frame
   - useFrame 내 직접 mutation
   - React state 변경 = Agent 추가/제거 시에만

4. Frustum Culling
   - Three.js 기본 frustum culling 활성
   - 화면 밖 Agent의 InstancedMesh는 count 제외
   - 서버 측 viewport culling도 유지 (전송 데이터 절감)

5. 안개(Fog) 자연스러운 LOD
   - far=1200 너머 오브젝트 = fog에 묻혀 보이지 않음
   - 별도 LOD 시스템 불필요

6. 텍스처 필터링
   - NearestFilter = GPU 보간 없음 (가장 빠른 필터)
   - Mipmaps 비활성 = VRAM 절약
```

#### A9.4 메모리 예산

```
Category          Estimate
────────────────────────────
Geometry buffers   ~2MB (InstancedMesh matrices)
Textures           ~1MB (프로시저럴 16×16 × ~200개)
Three.js scene     ~5MB (Scene Graph overhead)
WebGL context      ~10MB (buffers, shaders)
────────────────────────────
Total GPU memory   ~18MB

비교: 일반 3D 게임 100-500MB → 매우 가벼움
```

---

### A10. 플레이어빌리티 — 조작/피드백/게임필

#### A10.1 조작 스킴

```
마우스 + 키보드:

이동:     마우스 위치 → Agent 방향 (기존 input 30Hz 유지)
부스트:   Space 또는 마우스 좌클릭 (기존 유지)
레벨업:   1/2/3 키 또는 카드 클릭 (3택 선택)

서버 전송:
  { "e": "input", "d": { "angle": float, "boost": bool, "seq": int } }
  30Hz (33ms 간격) — 기존 유지

새로운 입력:
  능력 수동 발동: 없음 (모든 능력 = 자동 트리거)
  → 조작 단순함 유지 = .io 게임 핵심 (마우스+스페이스만)
```

#### A10.2 시각적 피드백 매트릭스

```
이벤트               시각 피드백                            사운드(향후)
──────────────────────────────────────────────────────────────────────
오브 수집            초록 파티클 8개 + XP 바 채움 애니메이션    pop
레벨업              금별 파티클 12개 + Agent bounce + 카드 UI    levelup chime
킬                  상대 사망 폭발 + 킬피드 텍스트              kill ding
사망                Agent 눕기 + 폭발 파티클 + 화면 회색화      death whomp
부스트              잔상 이펙트 + emissive glow                 whoosh
오라 DPS            스파크 파티클 + 오라 강조                    sizzle
수축 경고           화면 가장자리 빨간 비네팅 + HUD 텍스트      alarm
시너지 발동         황금 텍스트 팝업 + 별 파티클 폭발           fanfare
회복 샘             하트 파티클 5개 + HP 바 채움                 heal
성소 효과           초록 기둥 파티클 + "XP ×1.5" 텍스트         shrine chime
```

#### A10.3 HUD 레이아웃 (HTML 오버레이)

```
┌──────────────────────────────────────────────────────┐
│  [HP ██████████░░░░] 78/100   [XP ████████░░] 340/500│  ← 상단 바
│                                                        │
│                        Lv.7                            │  ← 레벨 배지
│                                                        │
│                                                        │
│                                                        │
│                                                        │
│                     [Agent]                             │  ← 3D 게임
│                                                        │
│                                                        │
│                                                        │
│                                                        │
│  [Tome: DMG×4 SPD×2 XP×3]  [Ability: Lightning Lv2]  │  ← 빌드 HUD
│                                                        │
│  ⚠️ 아레나 수축 8초                          4:12      │  ← 경고 + 타이머
│                                          [미니맵]      │  ← 우하단 미니맵
└──────────────────────────────────────────────────────┘

구현: HTML div 오버레이 (기존 패턴)
  position: absolute, top/bottom, pointer-events: none
  각 HUD 컴포넌트는 React 컴포넌트 (3D Canvas 밖)
  → Canvas re-render와 독립적 (성능 영향 0)
```

#### A10.4 게임필 수치

```
응답성:
  입력 → 서버 → 상태 반영: ~50ms (로컬) / ~100ms (원격)
  클라이언트 예측: 즉시 방향 전환 (서버 보정은 부드러운 lerp)
  부스트 시작: 0프레임 딜레이 (클라이언트 즉시 emissive 활성화)

보간:
  서버 20Hz (50ms 간격) → 클라이언트 60fps 보간
  보간 공식: 기존 interpolateAgents 유지
  예측: heading만 클라이언트 예측 (위치는 서버 권위)

카메라 반응:
  위치 lerp: 15%/frame (~150ms 수렴)
  줌 lerp: 8%/frame (~250ms 수렴)
  → 부드럽지만 반응적 (추격/도주 시 직관적)

사망 → 리스폰:
  사망 연출: 0.8s (눕기 + 파티클)
  DeathOverlay: 즉시 표시
  리스폰 대기: 사용자 클릭 시 (기존 유지)
  리스폰 연출: 0.3s (pop-in)
```

---

## Part B: 애매한 기획 구체화

### B1~B7: 전투/밸런스 수치

#### B1. Hitbox-Mass 공식 (§5B.2 보완)

```typescript
// 히트박스 반경 = 기본 16 + mass 비례 (최대 28)
function getHitboxRadius(mass: number): number {
  return 16 + Math.min(12, (mass - 10) * 0.133)
}

// mass=10  → radius=16
// mass=50  → radius=21.3
// mass=100 → radius=28
```

#### B2. 3+ Agent 오라 겹침 DPS (§5.2 보완)

```
규칙: 각 쌍(pair)마다 독립적으로 DPS 적용

Agent A, B, C가 모두 오라 겹침 시:
  A ← B의 DPS (2.0/tick)
  A ← C의 DPS (2.0/tick)
  B ← A의 DPS
  B ← C의 DPS
  C ← A의 DPS
  C ← B의 DPS

→ 3중 겹침 시 각 Agent는 2 × 2.0 = 4.0 DPS/tick 받음
→ N중 겹침 시 (N-1) × 2.0 DPS/tick

레벨 보너스 (Lv8+):
  baseDPS = 2.0
  levelBonus = level >= 8 ? 0.2 : 0  // +20% (곱셈)
  tomeDmgBonus = damageTomeStacks * 0.15 // Damage Tome 15%/stack
  finalDPS = baseDPS × (1 + levelBonus) × (1 + tomeDmgBonus)

  예: Lv10 + Damage×4 = 2.0 × 1.2 × 1.6 = 3.84 DPS/tick
```

#### B3. 능력 자동 트리거 로직 (§7.2 보완)

```
Shield Burst (방어):
  조건: mass < maxMass × 0.30 AND cooldown=0
  효과: 3초 무적 + 반경 80 내 적 밀침(knockback 200)
  쿨다운: 15초
  재트리거: 무적 종료 후에도 mass < 30%이면 쿨다운 후 재발동

Lightning Strike (공격):
  조건: 오라 반경 × 1.5 내 적 존재 AND cooldown=0
  타겟: 가장 가까운 적 1명
  데미지: mass × 0.15 (최대 15)
  쿨다운: 8초
  동일 타겟 제한: 없음 (8초마다 다시 타격 가능)

Speed Dash (기동):
  조건: (가장 가까운 적 거리 < 오라반경 × 2 AND mass < 적.mass × 0.8)  ← 도주
        OR (가장 가까운 적 거리 < 오라반경 × 3 AND mass > 적.mass × 1.2) ← 추격
  효과: 2초간 speed × 3 + 충돌 면역
  쿨다운: 12초
  우선순위: 도주 > 추격 (둘 다 만족 시 도주 방향으로 발동)

전체 우선순위 (같은 tick에 복수 조건 충족 시):
  1. Shield Burst (생존 최우선)
  2. Speed Dash (포지셔닝)
  3. Lightning Strike (공격)
```

#### B4. Kill Streak 보너스 적용 대상 (§3.1 보완)

```
Kill Streak: 한 라운드 내 연속 킬 (사망 시 리셋)

3연속:  ×1.5 XP 보너스 → 다음 킬 1회에만 적용
5연속:  ×2.0 XP 보너스 → 다음 킬 1회에만 적용
10연속: ×3.0 XP 보너스 → 다음 킬 1회에만 적용

적용 대상: 해당 킬의 XP 보상에만 곱셈 (오브 수집 XP에는 미적용)
리셋: 사망 시 streak=0
UI: 킬 시 "3-KILL STREAK ×1.5" 텍스트 팝업 (금색, 1.5초 페이드)
```

#### B5. Speed Tome 캡 로직 (§4.1 보완)

```
Speed Tome:
  스택당: +10% 이동속도 (150 → +15 px/s per stack)
  최대 스택: 5 (총 +50%, 225 px/s)
  6번째 이상: 레벨업 선택지에서 제외 (선택 불가)

이유: 225 px/s에서 회피/추격이 과도하게 유리 → 밸런스 붕괴
     다른 Tome은 스택 제한 없음 (효과가 선형 누적이므로 자연 밸런싱)
```

#### B6. 경계 밖 패널티 상세 (§5.5 보완)

```
경계 밖 진입 시:
  tick당 mass 감소: currentMass × 0.0025 (= 5%/초 ÷ 20 ticks/초)

  mass=100 → -0.25/tick = 5/초 → 20초에 사망
  mass=50  → -0.125/tick = 2.5/초 → 20초에 사망
  → mass 비례이므로 항상 20초 생존 (기하급수적 감소)

  실제: 아레나 수축 속도 > 이동속도이므로 10~15초 내 사망
  시각: 화면 가장자리 빨간 비네팅 + "경계 밖!" HUD 경고
```

#### B7. 수축 방식 — 연속적 (§8.1 보완)

```
수축 타이밍 (5분 라운드):
  0:00~1:00  반경 6000 유지 (평화 시간)
  1:00~5:00  연속 수축: 6000 → 600 (240초간 선형 감소)

공식:
  if elapsed < 60: radius = 6000
  else: radius = 6000 - (elapsed - 60) / 240 * 5400

  → 초당 22.5 unit 감소 (부드러운 연속 수축)
  → 이산적(step-wise) 아님

10초 경고:
  매 초 서버가 현재 radius + 10초 후 radius 전송
  클라이언트: 미니맵에 빨간 점선 원 (10초 후 경계선)
```

---

### B8~B14: 맵/존/스폰 로직

#### B8. 존 경계 수학 공식 (§9.2 보완)

```typescript
// 존 판별: 중심으로부터 거리 기반 동심원
function getZone(x: number, y: number, arenaRadius: number): 'core' | 'mid' | 'edge' {
  const dist = Math.hypot(x, y) // 중심이 (0,0)
  const coreR = arenaRadius * 0.25  // 1500
  const midR  = arenaRadius * 0.60  // 3600

  if (dist <= coreR) return 'core'
  if (dist <= midR) return 'mid'
  return 'edge'
}

// 수축 시: arenaRadius가 줄어들면 존 경계도 비례 축소
// arenaRadius=3000 → core=750, mid=1800
// → 자연스럽게 Core만 남음 (후반 전투 집중)
```

#### B9. 맵 오브젝트 스폰 위치 (§9.1 보완)

```
스폰 규칙:

XP Shrine (3개):
  위치: Mid Zone 내, 중심에서 120° 간격 (0°, 120°, 240°)
  거리: arenaRadius × 0.40 (= 2400)
  → 정삼각형 배치 (대칭, 공정)
  수축 시: 반경 < 2400이면 Shrine 제거 (파괴 파티클)

Healing Spring (2개):
  위치: Edge Zone 내, 중심에서 180° 간격 (90°, 270°)
  거리: arenaRadius × 0.75 (= 4500)
  → 좌우 대칭 배치
  수축 시: 반경 < 4500이면 제거

Upgrade Altar (2개):
  위치: Mid~Core 경계, 중심에서 180° 간격 (0°, 180°)
  거리: arenaRadius × 0.30 (= 1800)
  수축 시: 반경 < 1800이면 제거

최소 거리 제약: 오브젝트 간 최소 600 units (겹침 방지)
데코와 겹침: 데코는 비충돌이므로 겹쳐도 OK (시각적으로만)
라운드 시드: 각 라운드의 시드(roomId + roundNumber)로 결정적 배치
  → 같은 라운드 = 같은 배치 (클라이언트/서버 동일)
```

#### B10. orbDensity 단위 정의 (§9.3 보완)

```
orbDensity = 해당 존 내 오브 수 / 존 면적(1000px² 당)

계산 (서버 측, 1Hz 업데이트):
  edgeArea = π × (6000² - 3600²) = ~7.2M px²
  midArea  = π × (3600² - 1500²) = ~3.4M px²
  coreArea = π × 1500²           = ~0.7M px²

  edgeDensity = orbsInEdge / (edgeArea / 1000) // 오브/1000px²
  midDensity  = orbsInMid / (midArea / 1000)
  coreDensity = orbsInCore / (coreArea / 1000)

observe_game에 전달:
  orbDensity: { edge: 0.8, mid: 1.2, core: 2.5 }
  → "Core에 오브가 밀집" 같은 AI 판단 가능
```

#### B11. 레벨업 3택 생성 규칙 (§6.1 보완)

```
3택 생성 알고리즘:

1. 후보 풀 구성:
   - 전체 Tome 8종 + Ability 6종 = 14종
   - 이미 max stack인 Tome 제외 (Speed ×5 = 제외)
   - 이미 보유한 Ability는 "레벨업" 버전으로 표시

2. 3택 구성 규칙:
   - 선택지 1: Tome (가중 랜덤, 빌드 방향 고려)
   - 선택지 2: Tome 또는 Ability (50/50)
   - 선택지 3: "nearbySynergy" 관련 선택지 (있으면) 또는 랜덤

3. nearbySynergies 정의:
   "1개 더 모으면 발동" = 시너지 요구사항 중 정확히 1개만 부족
   예: Holy Trinity = XP×3 + Luck×2 + Cursed×1
       Agent가 XP×3 + Luck×2 보유 → Cursed가 "1개 더"
   → 선택지 3에 Cursed Tome 보장

4. 가중치:
   - 현재 빌드와 시너지 가능한 Tome: weight × 2
   - 이미 3+ 스택인 Tome: weight × 0.5 (중복 줄임)
   - 기본: weight = 1
```

#### B12. 히든 시너지 4종 정의 (§4.3 보완) — ★ CRITICAL

```
공개 시너지 6종은 §4.2에 정의됨. 히든 시너지 4종:

Hidden Synergy 1: "Immortal" (불멸)
  요구: Armor×5 + Shield Burst Lv3 + HP Tome×3
  효과: 사망 시 1회 부활 (HP 30%로, 라운드당 1회)
  힌트: "방어의 극한을 달성하면..."

Hidden Synergy 2: "Meteor" (유성)
  요구: Damage×5 + Lightning Strike Lv3 + Cursed×3
  효과: Lightning Strike가 범위 공격으로 변환 (반경 120, 50% 감소 데미지)
  힌트: "파괴의 극한과 저주가 만나면..."

Hidden Synergy 3: "Phantom" (환영)
  요구: Speed×5 + Speed Dash Lv3 + Luck×3
  효과: Dash 종료 시 현재 위치에 3초간 미끼 분신 생성 (적 AI 혼란)
  힌트: "속도의 극한에서 그림자가..."

Hidden Synergy 4: "Alchemist" (연금술사)
  요구: XP×5 + Luck×5 + 아무 시너지 1개 이상 활성
  효과: 오브 수집 시 5% 확률로 즉시 레벨업 (XP 바 풀 채움)
  힌트: "행운과 지식의 극한에서..."

근접 판정:
  "근접" = 요구사항 중 1~2개 부족
  → 라운드 결과 화면: "???에 근접한 조합 발견! (2개 부족)"
  → 정확한 요구사항은 밝히지 않음 (탐색 재미)
```

#### B13. 봇 레벨업 선택 로직 (§11 보완)

```typescript
// 봇 업그레이드 선택 알고리즘
function botChooseUpgrade(
  choices: UpgradeChoice[],
  bot: Agent,
  roundTimeRemaining: number
): number {
  // 시간대별 우선순위
  if (roundTimeRemaining > 180) {
    // 초반(>3분): XP > Luck > Speed > 기타 Tome
    return pickByPriority(choices, ['xp_tome', 'luck_tome', 'speed_tome'])
  } else if (roundTimeRemaining > 60) {
    // 중반(1~3분): Damage > Ability > 시너지 Tome
    return pickByPriority(choices, ['damage_tome', 'ability', 'synergy_related'])
  } else {
    // 후반(<1분): Armor > Shield > HP
    return pickByPriority(choices, ['armor_tome', 'shield_burst', 'hp_tome'])
  }
}

function pickByPriority(choices: UpgradeChoice[], priority: string[]): number {
  for (const pref of priority) {
    const idx = choices.findIndex(c => c.category === pref || c.id === pref)
    if (idx >= 0) return idx
  }
  return Math.floor(Math.random() * choices.length) // fallback 랜덤
}
```

#### B14. 봇 수축 인식 (§11 보완)

```
봇 이동 로직에 수축 인식 추가:

경계까지 거리 = arenaRadius - Math.hypot(bot.x, bot.y)

if (경계까지 거리 < 200) {
  // 긴급: 중심 방향으로 이동 (다른 목표 무시)
  targetAngle = Math.atan2(-bot.y, -bot.x) // 중심 방향
} else if (경계까지 거리 < 500) {
  // 경고: 중심 쪽으로 편향 (기존 목표 유지하되 안쪽으로)
  targetAngle = blend(currentTarget, centerDirection, 0.3)
}

10초 수축 예고 시:
  futureRadius = currentRadius - shrinkRate * 10
  if (futureDistance > futureRadius - 200) {
    // 미리 안쪽으로 이동
  }
```

---

### B15~B20: UI/UX/렌더링 상세

#### B15. 캐릭터 텍스처 합성 방식 (§5B.4.5 보완)

```
방식: Option C — 런타임 Canvas 레이어 합성 (프로시저럴)

파이프라인:
  1. Base Layer: skinTone 색상으로 16×16 채움
  2. Body Layer: bodyColor + pattern 오버레이
  3. Face Layer: eyeStyle + mouthStyle 픽셀 그리기
  4. Equip Layer: hat + accessory 오버레이 (해당 위치에)
  5. → CanvasTexture 생성 (NearestFilter, no mipmaps)
  6. → skinCache에 저장 (키: config hash)

왜 이 방식:
  - 138K 사전 렌더링 불필요 (디스크 0)
  - 런타임 CPU 비용: ~0.5ms/텍스처 (Canvas 2D 드로잉)
  - 캐시 후 0ms (Map 조회)
  - 기존 voxel-textures.ts 패턴과 동일
```

#### B16. 인챈트 글로우 시스템 (§5B.4.4 보완)

```
Tome→장비 매핑:
  Damage ×3+ → 손 아이템/팔 (armMaterial emissive red)
  Armor ×3+  → 몸통 (bodyMaterial emissive blue)
  Speed ×3+  → 다리/신발 (legMaterial emissive cyan)
  XP ×3+     → 머리 (headMaterial emissive green)
  Luck ×3+   → 악세서리 (accMaterial emissive gold)
  Cursed ×3+ → 전체 (모든 material emissive purple, low intensity)

구현:
  InstancedMesh는 인스턴스별 emissive 불가
  → 글로우 Agent만 별도 "글로우 레이어" InstancedMesh로 렌더
  → 글로우 IM: same geometry, MeshBasicMaterial, transparent, opacity=0.15
  → 스케일 1.05 (약간 크게 = 외곽 글로우 효과)

애니메이션: sin(elapsed * 2) * 0.05 opacity 변동 (미세 펄스)
동시 글로우: 복수 Tome 3+ 시 각 파트별로 독립 글로우 (중첩 OK)
Draw Call: +1 (글로우 전용 InstancedMesh)
```

#### B17. 빌드 시각 이펙트 강도 스케일 (§5B.6 보완)

```
Tome Stack → 시각 강도:

Stacks    Opacity/Intensity    파티클 빈도
───────────────────────────────────────────
  0~2      없음                 없음
  3        base (0.08)          1/tick
  4        × 1.25 (0.10)       1/tick
  5        × 1.5 (0.12)        2/tick
  6        × 1.75 (0.14)       2/tick
  7+       × 2.0 (0.16, 최대)  3/tick

다중 이펙트:
  Damage×4 + Speed×3 = 빨간 오라(0.10) + 잔상(base) 동시
  렌더 순서: 오라 링 → 파티클 → 글로우 (z-fighting 없음, 각각 다른 레이어)
```

#### B18. Character Creator UI 상세 (§12.3a 보완)

```
Phase 1 탭 구성 — 4탭 (이펙트 탭은 Phase 2):

Tab 1 "체형":
  bodyType: [Default] [Slim]        ← 2개 큰 버튼
  skinTone: 15색 팔레트 그리드      ← 5×3 그리드

Tab 2 "색상":
  bodyColor: 12색 팔레트 그리드     ← 4×3 그리드
  legColor:  12색 팔레트 그리드     ← 4×3 그리드
  pattern:   [Solid][Striped][Check][Dotted] ← 4개 토글

Tab 3 "얼굴":
  eyeStyle:   8종 미니 프리뷰 그리드 ← 4×2 그리드
  mouthStyle: 6종 미니 프리뷰 그리드 ← 3×2 그리드

Tab 4 "장비":
  hat:       6종 (none + 5) 썸네일  ← 3×2 그리드
  accessory: 4종 (none + 3) 썸네일  ← 2×2 그리드

레이아웃 (총 너비 500px):
  좌측 200px: 3D 프리뷰 (LobbyAgentPreview, Y축 회전)
    하단: [◀ 회전 ▶] 버튼 (클릭 시 ±45° 스냅 회전)
    자동 회전: 0.5 rad/s (버튼 미사용 시)
  우측 300px: 탭 + 옵션 그리드
    각 탭: 세로 스크롤 (콘텐츠가 넘칠 경우)
  하단 full-width: [저장] 버튼 + 해금 진행도 바

모바일 (width < 768px):
  프리뷰: 상단 130×130
  탭/옵션: 하단 전체 폭
```

#### B19. 로비 Agent 아이들 애니메이션 (§12.3b 보완)

```
LobbyIdleAgents — 3개 MC Agent (기존 LobbyIdleSnakes 패턴):

Agent 1: "Warrior" (빨강)
  position: 원형 궤도 (radius=80, speed=0.3 rad/s)
  animation: walk cycle (팔다리 스윙)
  장비: helmet + cape_mini

Agent 2: "Mage" (보라)
  position: figure-8 궤도 (기존 figure8 패턴)
  animation: idle (팔 미세 흔들림) + 가끔 360° 회전 (5초마다)
  장비: wizard hat + scarf

Agent 3: "Scout" (초록)
  position: zigzag 궤도 (빠른 속도 0.5 rad/s)
  animation: walk cycle (빠른 빈도) + 가끔 점프 (y bounce 3초마다)
  장비: cap + goggles

구현: 기존 LobbyIdleSnakes의 5가지 motion 패턴 코드 재사용
파트별 animation: §A5 walk/idle rotation 적용
```

#### B20. RoomList Agent 아이콘 + 빌드 표시 (§12.3b 보완)

```
RoomList 각 Room 행 레이아웃:

┌─[Room Icon]─[Room Name]──[Players]──[Status]──[Build Icons]──[Join]─┐
│  🟢          Arena #1      12/18     Playing   ⚔️🛡️⚡           [→]  │
└────────────────────────────────────────────────────────────────────────┘

Build Icons = 해당 Room의 상위 3개 인기 빌드 타입:
  ⚔️ = Damage 빌드 (Damage ×3+ 에이전트 수)
  🛡️ = Tank 빌드 (Armor ×3+)
  ⚡ = Speed 빌드 (Speed ×3+)
  🔮 = Magic 빌드 (시너지 1+ 활성)

표시: 인기순 상위 3개 아이콘 (16×16 MC 스타일 아이콘)
데이터: rooms_update 1Hz에 buildDistribution 필드 추가
  buildDistribution: { damage: 5, tank: 3, speed: 2, magic: 1 }
```

---

### B21~B25: 콘텐츠/메타/마이그레이션

#### B21. observe_game buildType 계산 (§12.4c 보완)

```typescript
// buildType = Agent의 가장 높은 Tome 카테고리
function getBuildType(build: PlayerBuild): string {
  const tomes = build.tomes // Map<TomeId, stackCount>
  const categories = {
    berserker: (tomes.get('damage') || 0) + (tomes.get('cursed') || 0),
    tank:      (tomes.get('armor') || 0) + (tomes.get('hp') || 0),
    speedster: (tomes.get('speed') || 0) + (tomes.get('cooldown') || 0),
    farmer:    (tomes.get('xp') || 0) + (tomes.get('luck') || 0),
  }
  // 가장 높은 카테고리 반환
  return Object.entries(categories)
    .sort(([,a], [,b]) => b - a)[0][0]
}

// 결과: "berserker" | "tank" | "speedster" | "farmer" | "balanced"
// balanced = 모든 카테고리 동률 시

// observe_game 업데이트 빈도: 1Hz (rooms_update와 동일)
```

#### B22. Training Console — if/then 규칙 에디터 UI (§12.4b 보완)

```
규칙 형식:
  IF [condition_dropdown] [operator] [value_input]
  THEN [action_dropdown] [parameter]

Condition Dropdown:
  - mass_ratio (내 mass / 적 mass)
  - health_percent (HP %)
  - nearby_enemies (오라 내 적 수)
  - zone (edge / mid / core)
  - round_time (남은 시간 초)
  - my_level
  - kill_streak

Operator:
  - > / < / >= / <= / ==

Action Dropdown:
  - retreat (도주)
  - engage (전투)
  - farm_orbs (오브 수집)
  - seek_shrine (성소 이동)
  - seek_healing (회복 샘 이동)

UI: 드롭다운 + 숫자 입력 (텍스트 자유입력 아님)
검증: 클라이언트 측 즉시 검증 (유효한 조합만 저장)
저장: localStorage (key: agent-rules-{agentId})
자동저장: 규칙 변경 시 0.5초 debounce 후 자동 저장
```

#### B23. v9→v10 Commander 명령어 마이그레이션 (§12.4a 보완)

```
삭제 명령어 → 대체 방법:

1. ambush → 삭제 (대체: engage 전략으로 적 접근)
   이유: v10은 세그먼트 경로 차단 없음 (단일 캐릭터)

2. coil → 삭제 (대체: 없음)
   이유: 세그먼트 감싸기 불가

3. gather_near {x,y} → farm_orbs {zone}
   마이그레이션: 좌표를 존으로 변환
   if dist(x,y, center) < arenaRadius * 0.25: zone = "core"
   elif dist < arenaRadius * 0.60: zone = "mid"
   else: zone = "edge"

4. avoid_heads → engage_weaker
   이유: head 충돌 → aura DPS 전투 전환

5. maximize_length → farm_xp
   이유: segments → XP/레벨 전환

자동 마이그레이션:
  기존 Agent 프로필 로드 시 v9 명령어 감지
  → "이 프로필에 v9 명령어가 있습니다. 자동 변환하시겠습니까?" 알림
  → [자동 변환] 클릭 시 위 매핑 적용
```

#### B24. RP 해금 상세 데이터 (§10.2 보완)

```
빌드 히스토리 (100 RP 해금):
  데이터 구조:
    recentGames: Array<{
      roundId: string
      build: { tomes: Map, abilities: string[], synergies: string[] }
      result: { rank: number, kills: number, survivalTime: number }
      timestamp: number
    }> // 최근 50 라운드

  UI:
    테이블 뷰: 라운드별 빌드 + 결과
    통계 탭: 빌드 타입별 승률 파이 차트 (Canvas 2D)
    필터: 기간 (최근 10/25/50), 빌드 타입

카운터 인텔 (500 RP 해금):
  데이터: 현재 Room에 있는 Agent들의 최근 5라운드 빌드 경향
    opponents: Array<{
      name: string
      recentBuildType: string    // 최근 가장 많이 한 빌드
      preferredTomes: string[]   // 상위 2개 Tome
      winRate: number            // 최근 5판 승률
    }>

  UI: Room 입장 전 팝업 또는 로비 패널 확장
  업데이트: Room 입장 시 1회 조회 (실시간 아님)
```

#### B25. 봇 AI Adaptive 성격 (§13.3 보완)

```
Personality Preset 중 "Adaptive" 구현:

초기 상태: "farmer" (XP 수집 중심)

적응 로직 (매 레벨업 시 평가):
  if (deaths > 2 AND kills < 1) {
    // 자꾸 죽음 → 방어로 전환
    personality = "cautious"
    → Armor/HP Tome 우선 선택
  }
  else if (kills > 3 AND deaths == 0) {
    // 잘 죽이고 안 죽음 → 공격 유지
    personality = "aggressive"
    → Damage/Cursed Tome 우선 선택
  }
  else if (level < averageLevel - 2) {
    // 레벨 뒤처짐 → 성장 가속
    personality = "farmer"
    → XP/Luck Tome 우선 선택
  }
  else {
    // 균형 → 상황별 최적
    personality = "balanced"
    → 시간대별 기본 로직 (§B13)
  }

리셋: 매 라운드 시작 시 "farmer"로 초기화
학습 범위: 라운드 내에서만 (크로스 라운드 학습 없음)
```

---

## 부록: 로드맵 통합

이 문서의 모든 스펙은 `v10-development-roadmap.md`의 기존 Step에 매핑됩니다:

| 이 문서 | 로드맵 Step | 내용 |
|---------|-----------|------|
| §A1 Agent 3D 모델 | S37 | entities.ts 전면 리라이트 |
| §A1.5 텍스처 | S38 | AgentSkin 스프라이트 제작 |
| §A2 맵/지형 | S37 + S46 | 지형 렌더링 + 로비 리디자인 |
| §A3 카메라 | 기존 PlayCamera 유지 | 변경 불필요 |
| §A5 애니메이션 | S37 | entities.ts에 포함 |
| §A6 이펙트 | S45 | Effects 단계 |
| §A8 텍스처 파이프라인 | S38 | 스프라이트 제작 단계 |
| §A10 HUD | S42 | BuildHUD + 기존 HUD |
| §B3 능력 트리거 | S15 (서버) | CollisionSystem에 통합 |
| §B8-B9 존/스폰 | S28 (서버) | MapObjects 단계 |
| §B11 레벨업 3택 | S18 (서버) | UpgradeSystem에 통합 |
| §B12 히든 시너지 | S18 (서버) | UpgradeSystem에 통합 |
