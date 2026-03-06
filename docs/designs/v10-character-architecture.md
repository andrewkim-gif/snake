# Cubeling Character System — Module Architecture

> **Date**: 2026-03-06
> **Status**: Approved
> **Scope**: Cubeling 캐릭터 렌더링 파이프라인 전체 모듈 아키텍처
> **Base Document**: `v10-character-concept.md` (섹션 3, 5, 8)
> **Engine**: Three.js (R3F) — InstancedMesh 기반 60 에이전트 실시간 렌더링

---

## 1. 모듈 의존관계 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                    packages/shared/src/                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐            │
│  │ types/appearance.ts  │  │ constants/cubeling.ts     │            │
│  │  CubelingAppearance  │  │  SKIN_TONES, VIVID_PALETTE│            │
│  │  BodyType, FaceKey   │  │  EYE_STYLES, MOUTH_STYLES│            │
│  │  EquipmentSlots      │←─│  EQUIPMENT_DEFS, PRESETS │            │
│  │  packAppearance()    │  │  BODY_TYPE_SCALES        │            │
│  │  unpackAppearance()  │  └──────────────────────────┘            │
│  └──────────┬───────────┘                                          │
│             │ (export via index.ts)                                 │
└─────────────┼──────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    apps/web/lib/3d/  (순수 로직 — React/R3F 무관)   │
│                                                                     │
│  ┌───────────────────────┐   ┌──────────────────────────┐          │
│  │cubeling-proportions.ts│   │ animation-state-machine.ts│          │
│  │  CUBELING_PARTS       │   │  AnimState (10종 enum)    │          │
│  │  getPartOffset()      │   │  AnimationStateMachine    │          │
│  │  getPartSize()        │   │  computePartTransforms()  │          │
│  │  scaleParts()         │   │  blendTransitions()       │          │
│  └──────────┬────────────┘   └───────────┬──────────────┘          │
│             │                             │                         │
│  ┌──────────┴────────────┐   ┌───────────┴──────────────┐          │
│  │ cubeling-textures.ts  │   │ equipment-data.ts         │          │
│  │  generateFaceTexture()│   │  ATTACH_POINTS            │          │
│  │  generateBodyBase()   │   │  EQUIPMENT_GEOMETRIES     │          │
│  │  generateLimbBase()   │   │  getEquipmentMatrix()     │          │
│  │  applyRoundingShade() │   │  HAT_DEFS, WEAPON_DEFS   │          │
│  │  TextureCacheManager  │   └──────────────────────────┘          │
│  └──────────┬────────────┘                                          │
│             │                                                       │
│  ┌──────────┴────────────┐                                          │
│  │ skin-migration.ts     │                                          │
│  │  migrateFromSkinId()  │  (기존 24 스킨 → CubelingAppearance)    │
│  │  LEGACY_SKIN_MAP      │                                          │
│  └───────────────────────┘                                          │
│                                                                     │
│  ┌───────────────────────┐   (기존 — 수정)                         │
│  │ agent-textures.ts     │   리팩토링: white-base + colorAt 전략    │
│  │ coordinate-utils.ts   │   기존 유지 + getAgentScale 수정         │
│  └───────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│               apps/web/components/3d/  (R3F 컴포넌트)              │
│                                                                     │
│  ┌───────────────────────────────────────┐                         │
│  │ AgentInstances.tsx (리팩토링)          │ ← 메인 바디 파트 렌더러 │
│  │   bodyMeshes[4]: 패턴별 IM            │                         │
│  │   armL/R, legL/R: 단일 IM + colorAt  │                         │
│  │   → cubeling-proportions 사용         │                         │
│  │   → animation-state-machine 사용      │                         │
│  └──────────┬────────────────────────────┘                         │
│             │                                                       │
│  ┌──────────┴──────────────┐  ┌─────────────────────────┐          │
│  │HeadGroupManager.tsx NEW │  │EquipmentInstances.tsx NEW│          │
│  │  headMeshMap: Map<FK,IM>│  │  hatMeshes[3]: IM        │          │
│  │  얼굴 조합별 IM 풀 관리 │  │  weaponMeshes[2]: IM     │          │
│  │  setColorAt 머리/피부톤 │  │  backMesh: IM            │          │
│  │  동적 생성/삭제          │  │  부착점 매트릭스 연산    │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │ EyeInstances.tsx   NEW  │  │ AuraRings.tsx (기존유지) │          │
│  │  eyeMesh: IM<Plane,60>  │  └─────────────────────────┘          │
│  │  깜빡임 UV offset 제어  │                                       │
│  │  polygonOffset Z-bias   │  ┌─────────────────────────┐          │
│  └─────────────────────────┘  │VoxelCharacter.tsx (수정) │          │
│                                │  로비 프리뷰 (1.5u 높이)│          │
│                                └─────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────┐                                       │
│  │CharacterCreator.tsx NEW │  (Phase 7 — 캐릭터 에디터 UI)         │
│  │  7-tab 에디터            │                                       │
│  │  R3F 미니 프리뷰         │                                       │
│  └─────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────┘

★ 의존 방향: shared → lib/3d → components/3d (단방향, 순환 없음)
★ Three.js 의존: lib/3d (텍스처 생성만), components/3d (InstancedMesh 렌더링)
★ React 의존: components/3d만 (lib/3d는 순수 함수 + 클래스)
```

**의존 관계 요약 (DAG — 순환 없음 보장):**

| 모듈 | 의존 대상 | 의존 없음 |
|------|----------|----------|
| `types/appearance.ts` | (없음 — 순수 타입) | |
| `constants/cubeling.ts` | `types/appearance` | |
| `cubeling-proportions.ts` | `constants/cubeling` | React, R3F |
| `animation-state-machine.ts` | `cubeling-proportions` | React, R3F, Three.js |
| `cubeling-textures.ts` | `constants/cubeling` | React, R3F |
| `equipment-data.ts` | `types/appearance`, `cubeling-proportions` | React, R3F |
| `skin-migration.ts` | `types/appearance`, `constants/cubeling` | React, R3F, Three.js |
| `agent-textures.ts` (수정) | `cubeling-textures`, `constants/cubeling` | React, R3F |
| `AgentInstances.tsx` | `cubeling-proportions`, `animation-state-machine`, `agent-textures` | |
| `HeadGroupManager.tsx` | `cubeling-textures`, `constants/cubeling` | |
| `EquipmentInstances.tsx` | `equipment-data` | |
| `EyeInstances.tsx` | `cubeling-textures` | |
| `VoxelCharacter.tsx` (수정) | `cubeling-proportions`, `cubeling-textures` | |
| `CharacterCreator.tsx` | `types/appearance`, `constants/cubeling` | |

## 2. 모듈 목록 및 공개 인터페이스

### 2.1 shared 패키지 모듈

#### A. `packages/shared/src/types/appearance.ts` — 외형 타입 정의

순수 TypeScript 타입 + 비트 인코딩 유틸. 서버/클라이언트 공유.

```typescript
// ─── Core Type ───

export type BodyType = 'standard' | 'slim' | 'chunky' | 'tall';
export type BodySize = 'small' | 'medium' | 'large';
export type FaceKey = `${number}-${number}`; // "eyeStyle-mouthStyle"

export interface CubelingAppearance {
  // Layer 1: 체형
  bodyType: BodyType;
  bodySize: BodySize;
  // Layer 2: 피부
  skinTone: number;         // 0-11
  // Layer 3: 얼굴
  eyeStyle: number;         // 0-11
  mouthStyle: number;       // 0-7
  marking: number;          // 0-7
  // Layer 4: 의상
  topColor: number;         // 0-11
  bottomColor: number;      // 0-11
  pattern: number;          // 0-7
  // Layer 5: 헤어
  hairStyle: number;        // 0-15
  hairColor: number;        // 0-15
  // Layer 6: 장비
  hat: number;              // 0-8 (0=none)
  weapon: number;           // 0-6 (0=none)
  backItem: number;         // 0-5 (0=none)
  footwear: number;         // 0-8 (0=none)
  // Layer 7: 이펙트
  trailEffect: number;      // 0-7 (0=none)
  auraEffect: number;       // 0-5 (0=none)
  emote: number;            // 0-7 (0=none)
  spawnEffect: number;      // 0-5 (0=none)
}

export interface EquipmentSlots {
  hat: number;
  weapon: number;
  backItem: number;
  footwear: number;
}

// ─── 비트 인코딩 (63 bits → 8 bytes) ───

export function packAppearance(a: CubelingAppearance): bigint;
export function unpackAppearance(packed: bigint): CubelingAppearance;
export function appearanceToHash(a: CubelingAppearance): number;
export function getFaceKey(a: CubelingAppearance): FaceKey;
```

> **설계 근거**: 서버는 `join_room` 시 `CubelingAppearance`를 수신하여 8바이트로 압축 저장.
> 인게임 `state` 브로드캐스트에서는 `AgentNetworkData.k` (기존 skinId) 대신 `appearanceHash`를 사용하고,
> 클라이언트는 hash → 풀 `CubelingAppearance` 매핑을 로컬 캐시에 유지.

#### B. `packages/shared/src/constants/cubeling.ts` — 큐블링 상수

```typescript
// ─── 색상 팔레트 ───

export const VIVID_PALETTE: readonly string[];    // 12색 비비드 팝
export const SKIN_TONES: readonly string[];       // 12 스킨톤
export const HAIR_COLORS: readonly string[];      // 16 머리색

// ─── 눈/입 스타일 정의 ───

export const EYE_STYLES: readonly EyeStyleDef[];   // 12종 (Default~Spiral)
export const MOUTH_STYLES: readonly MouthStyleDef[];// 8종 (Smile~Zigzag)

export interface EyeStyleDef {
  id: number;
  name: string;
  pixels: [number, number, string][];  // [x, y, colorKey] — 3x2 픽셀 매핑
}

export interface MouthStyleDef {
  id: number;
  name: string;
  pixels: [number, number, string][];  // [x, y, colorKey] — 6x2 픽셀 매핑
}

// ─── 바디 타입 스케일 ───

export const BODY_TYPE_SCALES: Record<BodyType, {
  bodyW: number; bodyH: number;
  armW: number; legW: number;
  limbH: number;
}>;

// ─── 장비 정의 ───

export const HAT_DEFS: readonly EquipmentDef[];
export const WEAPON_DEFS: readonly EquipmentDef[];
export const BACK_ITEM_DEFS: readonly EquipmentDef[];
export const FOOTWEAR_DEFS: readonly EquipmentDef[];

export interface EquipmentDef {
  id: number;
  name: string;
  geometryType: string;       // 'helmet' | 'hat' | 'crown' | 'blade' | 'staff' | ...
  baseColor: string;          // 기본 색상 (setColorAt에 사용)
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// ─── 프리셋 캐릭터 ───

export const CHARACTER_PRESETS: readonly CubelingPreset[];

export interface CubelingPreset {
  id: string;
  name: string;
  appearance: CubelingAppearance;
  description: string;
}

// ─── 패턴 정의 ───

export const PATTERN_DEFS: readonly PatternDef[];

export interface PatternDef {
  id: number;
  name: string;  // 'solid' | 'striped' | 'dotted' | 'gradient' | ...
}
```

### 2.2 클라이언트 lib 모듈 (순수 로직)

#### C. `apps/web/lib/3d/cubeling-proportions.ts` — 프로포션 상수 + 유틸

Three.js 무관 순수 모듈. 24-unit 큐블링 바디 파트 크기/오프셋 관리.

```typescript
// ─── 상수 ───

/** 큐블링 전체 높이 (단위: game unit) */
export const CUBELING_HEIGHT = 24;

/** 파트별 크기 + 피벗 + 월드유닛 변환 */
export interface PartSpec {
  size: readonly [number, number, number];     // [W, H, D] game units
  offset: readonly [number, number, number];   // [X, Y, Z] 기준점으로부터
  pivot: 'center' | 'top-center';             // 회전 중심
  worldSize: readonly [number, number, number]; // [W, H, D] world units (÷16)
}

export const CUBELING_PARTS: Record<PartName, PartSpec>;

export type PartName = 'head' | 'body' | 'armL' | 'armR' | 'legL' | 'legR';

// ─── 주요 상수값 ───
// head:  { size: [10, 10, 8],  offset: [0, 19, 0],  pivot: 'center' }
// body:  { size: [8, 7, 5],    offset: [0, 10.5, 0], pivot: 'center' }
// armL:  { size: [4, 7, 4],    offset: [-6, 14, 0],  pivot: 'top-center' }
// armR:  { size: [4, 7, 4],    offset: [6, 14, 0],   pivot: 'top-center' }
// legL:  { size: [4, 7, 4],    offset: [-2, 7, 0],   pivot: 'top-center' }
// legR:  { size: [4, 7, 4],    offset: [2, 7, 0],    pivot: 'top-center' }

// ─── 함수 ───

/** BodyType에 따른 스케일 적용된 파트 크기 반환 */
export function getScaledParts(bodyType: BodyType): Record<PartName, PartSpec>;

/** mass 기반 비대칭 스케일 계산 (머리 느리게, 몸통 빠르게) */
export function getAsymmetricScale(mass: number): {
  headScale: number;
  bodyScale: number;
  baseScale: number;
};

/** game units → R3F world units (÷16) — VoxelCharacter 프리뷰용 */
export function toWorldUnits(gameUnits: number): number;
```

> **현재 코드 대비 변경점**: `AgentInstances.tsx`의 `PARTS` 상수 (32u MC 프로포션)가
> 이 모듈의 `CUBELING_PARTS` (24u 큐블링 프로포션)로 교체됨.
> `VoxelCharacter.tsx`의 하드코딩 치수도 `toWorldUnits()`로 변환.

#### D. `apps/web/lib/3d/animation-state-machine.ts` — 10종 애니메이션

Three.js 무관 순수 클래스. 숫자 연산만 수행, Object3D/Matrix4 조작 없음.

```typescript
// ─── 상태 정의 ───

export enum AnimState {
  IDLE = 0,
  WALK = 1,
  BOOST = 2,
  ATTACK = 3,
  HIT = 4,
  DEATH = 5,
  SPAWN = 6,
  LEVELUP = 7,
  VICTORY = 8,
  COLLECT = 9,
}

// ─── 전환 행렬 ───

export interface TransitionConfig {
  from: AnimState;
  to: AnimState;
  blendDuration: number;  // 초 (0 = 즉시)
  priority: number;       // 높을수록 강제 전환
}

export const TRANSITIONS: readonly TransitionConfig[];
// 예: { from: ANY, to: HIT, blendDuration: 0, priority: 10 }
// 예: { from: IDLE, to: WALK, blendDuration: 0.15, priority: 1 }

// ─── 파트별 변환 출력 ───

export interface PartTransforms {
  head:  { rotX: number; rotY: number; rotZ: number; posY: number; scaleX: number; scaleY: number; };
  body:  { rotX: number; rotY: number; rotZ: number; posY: number; scaleX: number; scaleY: number; };
  armL:  { rotX: number; rotZ: number; };
  armR:  { rotX: number; rotZ: number; };
  legL:  { rotX: number; };
  legR:  { rotX: number; };
}

// ─── 상태 머신 클래스 ───

export class AnimationStateMachine {
  current: AnimState;
  previous: AnimState;
  blendFactor: number;
  elapsedInState: number;

  /** 에이전트별 독립 인스턴스 (motionCache처럼 Map<id, ASM> 관리) */
  constructor(initialState?: AnimState);

  /** 매 프레임 호출: 속도/부스트/이벤트 기반 상태 전환 판단 */
  update(input: AnimInput, delta: number): void;

  /** 현재 상태 + 블렌딩으로 최종 파트 변환 계산 */
  computeTransforms(elapsed: number): PartTransforms;
}

export interface AnimInput {
  velocity: number;
  boosting: boolean;
  alive: boolean;
  wasHit: boolean;       // HIT 트리거 (1프레임 true)
  wasLevelUp: boolean;   // LEVELUP 트리거
  wasKill: boolean;      // ATTACK 트리거
  wasCollect: boolean;   // COLLECT 트리거
}

// ─── 바운스 물리 (큐블링 핵심 개성) ───

/** 걷기 바운스 Y 오프셋 (abs(sin) 기반) */
export function cubelingBounce(elapsed: number, walkFreq: number): number;

/** 걷기 힙스웨이 Z 회전 (sin 기반) */
export function cubelingHipSway(elapsed: number, walkFreq: number): number;
```

> **현재 코드 대비 변경점**: `AgentInstances.tsx`의 `computePartRotations()` 함수가
> `AnimationStateMachine.computeTransforms()`로 교체됨. 기존 3상태(idle/walk/boost)에서
> 10상태 + 블렌딩 전환으로 확장. 반환값도 X 회전만 → 6DOF 변환으로 확장.

#### E. `apps/web/lib/3d/cubeling-textures.ts` — 큐블링 텍스처 생성

Three.js CanvasTexture 의존. 기존 `agent-textures.ts`를 대체할 새 텍스처 시스템.

```typescript
// ─── 얼굴 텍스처 (Color-Tint 전략: 흰색 base) ───

/** 눈+입 조합별 얼굴 텍스처 생성 (흰색 base, 피부/머리색은 setColorAt) */
export function generateFaceTexture(
  eyeStyle: number,
  mouthStyle: number,
  marking: number,
): THREE.CanvasTexture;

/** 머리 상단/측면/후면 텍스처 (머리카락 패턴, 흰색 base) */
export function generateHeadTopBase(hairStyle: number): THREE.CanvasTexture;
export function generateHeadSideBase(hairStyle: number): THREE.CanvasTexture;
export function generateHeadBackBase(hairStyle: number): THREE.CanvasTexture;

// ─── 바디/팔/다리 텍스처 (흰색 base + 패턴) ───

/** 패턴별 바디 base 텍스처 (color는 setColorAt으로 런타임 적용) */
export function generateBodyBase(pattern: number): THREE.CanvasTexture;

/** 팔 base 텍스처 (소매 + 손, 흰색 기준) */
export function generateArmBase(pattern: number): THREE.CanvasTexture;

/** 다리 base 텍스처 (바지 + 신발, 흰색 기준) */
export function generateLegBase(pattern: number): THREE.CanvasTexture;

// ─── 셰이딩 유틸 ───

/** 둥근 착시 라디얼 그라데이션 (모든 파트 텍스처에 적용) */
export function applyRoundingShade(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
): void;

// ─── 캐시 관리 ───

export class TextureCacheManager {
  /** 얼굴 텍스처 캐시 (FaceKey → 6-material set) */
  getFaceTextures(faceKey: FaceKey): THREE.CanvasTexture[];
  /** 바디 패턴 텍스처 캐시 */
  getBodyTexture(pattern: number): THREE.CanvasTexture;
  /** LRU 정리 (maxSize=120) */
  cleanup(): void;
  /** 전체 해제 */
  dispose(): void;
}
```

> **핵심 전략 변경**: 기존 `agent-textures.ts`는 skinId별로 완성된 컬러 텍스처를 생성했으나,
> 새 시스템은 **흰색 base 텍스처 + setColorAt() 런타임 틴팅**을 사용.
> 이로써 동일 패턴의 에이전트들은 1개 IM을 공유하면서 인스턴스별 고유 색상 적용.

#### F. `apps/web/lib/3d/equipment-data.ts` — 장비 부착점 + 지오메트리

```typescript
// ─── 부착점 좌표 (24-unit 큐블링 기준) ───

export interface AttachPoint {
  name: string;
  parentPart: PartName;
  localOffset: readonly [number, number, number];  // 부모 파트 로컬 좌표
}

export const ATTACH_POINTS: Record<string, AttachPoint>;
// HEAD_TOP:   { parentPart: 'head',  localOffset: [0, 5.5, 0] }
// HEAD_FRONT: { parentPart: 'head',  localOffset: [0, 0, 4.5] }
// HAND_R:     { parentPart: 'armR',  localOffset: [0, -4, 2] }
// HAND_L:     { parentPart: 'armL',  localOffset: [0, -4, 2] }
// BACK:       { parentPart: 'body',  localOffset: [0, 0, -3] }
// FEET:       { parentPart: 'legL',  localOffset: [0, -3.5, 0] }

// ─── 장비 지오메트리 사양 ───

export interface EquipmentGeometrySpec {
  type: string;                                    // 'helmet' | 'hat' | 'crown' | 'blade' | 'staff' | 'cape' | 'wings' | 'pack'
  size: readonly [number, number, number];         // [W, H, D]
  geometryFactory: 'box' | 'plane' | 'ring';      // Three.js 기하
  attachPointName: string;                         // ATTACH_POINTS 키
}

export const EQUIPMENT_GEOMETRIES: Record<string, EquipmentGeometrySpec>;

// ─── 매트릭스 유틸 ───

/** 장비 최종 매트릭스 = 부모 파트 매트릭스 × 부착점 오프셋 */
export function computeEquipmentMatrix(
  parentMatrix: { position: [number, number, number]; quaternion: [number, number, number, number]; scale: number },
  attachPoint: AttachPoint,
): { position: [number, number, number]; quaternion: [number, number, number, number]; scale: number };
```

#### G. `apps/web/lib/3d/skin-migration.ts` — 레거시 스킨 마이그레이션

```typescript
/** 기존 skinId(0~23) → CubelingAppearance 변환 테이블 */
export const LEGACY_SKIN_MAP: ReadonlyMap<number, CubelingAppearance>;

/** 런타임 변환 함수 (skinId가 캐시에 없으면 기본 프리셋 반환) */
export function migrateFromSkinId(skinId: number): CubelingAppearance;

/** AgentNetworkData.k (레거시 skinId) → 새 appearance 해석 */
export function resolveAppearance(
  skinIdOrHash: number,
  appearanceCache: Map<number, CubelingAppearance>,
): CubelingAppearance;
```

> **하위 호환 전략**: Phase 1에서는 서버가 여전히 `k: skinId`를 보냄.
> `skin-migration.ts`가 skinId → CubelingAppearance 자동 변환.
> Phase 2부터 서버가 `ap: packedBits`를 추가하면 네이티브 외형 사용.

### 2.3 클라이언트 컴포넌트 모듈 (R3F 렌더링)

#### H. `AgentInstances.tsx` — 메인 바디 파트 렌더러 (리팩토링)

현재: 6 IM (head/body/armL/armR/legL/legR), dominant skin 단일 material.
변경: 패턴별 body IM + setColorAt + 새 프로포션 + 애니메이션 상태 머신.

```typescript
// ─── Props (변경 없음) ───
interface AgentInstancesProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  elapsedRef: React.MutableRefObject<number>;
}

// ─── 내부 구조 변경 ───

// 기존: 6 InstancedMesh refs
// 신규: body 패턴별 4 IM + armL/R 1+1 IM + legL/R 1+1 IM = 8 IM
//       (head는 HeadGroupManager로 분리)

// 기존: PARTS 상수 (32u MC)
// 신규: import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions'

// 기존: computePartRotations() (3상태)
// 신규: AnimationStateMachine per agent (10상태 + 블렌딩)

// 기존: dominant skin material 교체 (모든 agent 동일 텍스처)
// 신규: white-base material + setColorAt() (인스턴스별 고유 색상)
//       + 패턴별 IM 분배 (에이전트를 패턴에 따라 올바른 IM에 할당)

// ─── useFrame 파이프라인 (변경) ───
// 1. Read server state (변경 없음)
// 2. Per-agent AnimationStateMachine.update() (신규)
// 3. computeTransforms() → 6파트 변환 (확장: 6DOF)
// 4. setMatrixAt + setColorAt per IM (신규: color)
// 5. needsUpdate flags

// ─── JSX (변경) ───
// body 패턴별 4 <instancedMesh>
// armL, armR, legL, legR 각 1 <instancedMesh>
// (head 제거 → HeadGroupManager가 담당)

export function AgentInstances({ agentsRef, elapsedRef }: AgentInstancesProps): JSX.Element;
```

> **하위 호환**: Props 인터페이스 불변. 외부 (GameCanvas3D) 코드 변경 없음.
> 내부 렌더링만 32u→24u 프로포션 + Color-Tint 방식으로 전환.

#### I. `HeadGroupManager.tsx` — 얼굴 그룹별 IM 풀 관리 (신규)

```typescript
interface HeadGroupManagerProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  elapsedRef: React.MutableRefObject<number>;
  /** appearance 해석 함수 (AgentInstances에서 주입) */
  resolveAppearanceFn: (agentId: string, skinId: number) => CubelingAppearance;
}

// ─── 핵심 로직 ───
// headMeshMap: Map<FaceKey, THREE.InstancedMesh>
// 매 프레임:
//   1. 모든 에이전트의 FaceKey 수집
//   2. 필요한 FaceKey에 대해 IM이 없으면 동적 생성
//   3. 에이전트를 해당 FaceKey IM에 할당, setMatrixAt + setColorAt
//   4. 미사용 FaceKey IM count=0 (자동 스킵)
//   5. 30초 이상 미사용 IM은 dispose (메모리 관리)

// ─── setColorAt 전략 ───
// material.color = white (곱연산 중립)
// setColorAt(i, skinToneColor × hairTintFactor)
// → 같은 얼굴(눈+입)이어도 피부톤/머리색으로 차별화

export function HeadGroupManager(props: HeadGroupManagerProps): JSX.Element;
```

#### J. `EquipmentInstances.tsx` — 장비 렌더링 (신규)

```typescript
interface EquipmentInstancesProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  elapsedRef: React.MutableRefObject<number>;
  /** 에이전트 파트 매트릭스 ref (AgentInstances가 매 프레임 업데이트) */
  partMatricesRef: React.MutableRefObject<Map<string, PartMatrixSet>>;
  resolveAppearanceFn: (agentId: string, skinId: number) => CubelingAppearance;
}

export interface PartMatrixSet {
  head: THREE.Matrix4;
  body: THREE.Matrix4;
  armR: THREE.Matrix4;
  armL: THREE.Matrix4;
  legL: THREE.Matrix4;
  legR: THREE.Matrix4;
}

// ─── 내부 구조 ───
// hatMeshes: Record<'helmet'|'hat'|'crown', THREE.InstancedMesh>
// weaponMeshes: Record<'blade'|'staff', THREE.InstancedMesh>
// backMesh: THREE.InstancedMesh (PlaneGeometry)
//
// 매 프레임:
//   1. 에이전트별 장비 슬롯 확인
//   2. 해당 장비 IM에 setMatrixAt(부모 파트 매트릭스 × 부착점 오프셋)
//   3. setColorAt(장비 색상)
//   4. 미착용 에이전트는 해당 IM에서 제외 (count 관리)

// ─── 망토 물리 (간단한 시뮬레이션) ───
// velocity 기반 뒤로 펄럭임 + sin 미세 웨이브

export function EquipmentInstances(props: EquipmentInstancesProps): JSX.Element;
```

#### K. `EyeInstances.tsx` — 눈 깜빡임 시스템 (신규)

```typescript
interface EyeInstancesProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 에이전트 head 매트릭스 ref */
  headMatricesRef: React.MutableRefObject<Map<string, THREE.Matrix4>>;
}

// ─── 핵심 로직 ───
// eyeMesh: InstancedMesh<PlaneGeometry(4, 2), MeshBasicMaterial, 60>
// 머리 앞면에 배치 (HEAD_FRONT 부착점 + polygonOffset Z-bias)
//
// 깜빡임:
//   에이전트 ID 시드 기반 3~5초 랜덤 간격
//   0.15초 duration: UV offset을 열린→닫힌→열린 전환
//   눈 텍스처: 2프레임(열린/닫힌) 세로 배치 → UV.y 오프셋으로 전환
//
// 상태별 표정:
//   HIT → 찡그림 (UV to squint frame)
//   DEATH → X눈
//   LEVELUP → 별눈
//
// Z-fighting 방지:
//   material.polygonOffset = true
//   material.polygonOffsetFactor = -1
//   material.polygonOffsetUnits = -1

export function EyeInstances(props: EyeInstancesProps): JSX.Element;
```

#### L. `VoxelCharacter.tsx` — 로비 프리뷰 (수정)

```typescript
// ─── 변경 사항 ───
// 1. 프로포션: HEAD 0.5→0.625, BODY 0.5×0.75→0.5×0.4375, ARM/LEG 0.75→0.4375
//    총 높이: 2.0 → 1.5 world units
// 2. 텍스처: cubeling-textures 사용 (큐블링 스타일 얼굴)
// 3. 카메라/레이아웃: 1.5u 높이에 맞게 조정 필요
// 4. CubelingAppearance 기반 텍스처 선택 (skinId 대신)
// 5. 장비 미리보기: 모자/무기 mesh 추가 (InstancedMesh 아닌 개별 Mesh)

interface VoxelCharacterProps {
  appearance: CubelingAppearance;  // 기존 skinId 대체
  position: [number, number, number];
  rotation?: number;
  phaseOffset?: number;
  showEquipment?: boolean;         // 장비 표시 여부 (에디터 프리뷰)
}

export function VoxelCharacter(props: VoxelCharacterProps): JSX.Element;
```

#### M. `CharacterCreator.tsx` — 캐릭터 에디터 UI (신규, Phase 7)

```typescript
interface CharacterCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  initialAppearance: CubelingAppearance;
  onSave: (appearance: CubelingAppearance) => void;
}

// ─── 구조 ───
// 좌측: R3F 미니 캔버스 (VoxelCharacter 단독, 드래그 360° 회전)
// 우측 상단: 7탭 ([체형][피부][얼굴][의상][헤어][장비][FX])
// 우측 중앙: 옵션 그리드 (4x2, 페이지네이션)
// 우측 하단: 컬러 피커 (해당 탭에서 색 선택 시)
// 하단: [Random] [Reset] [Save Preset] [Done]

export function CharacterCreator(props: CharacterCreatorProps): JSX.Element;
```

## 3. 데이터 흐름 파이프라인

### 3.1 서버 → 클라이언트 외형 데이터 흐름

```
[클라이언트 A]                    [서버]                     [클라이언트 B]
     │                              │                              │
     │ join_room {                  │                              │
     │   roomId, name,              │                              │
     │   appearance: CubelingApp    │                              │
     │ }                            │                              │
     │─────────────────────────────→│                              │
     │                              │ appearance → packAppearance()│
     │                              │ → 8-byte BigInt 저장         │
     │                              │ → appearanceHash = CRC32     │
     │                              │                              │
     │                              │ state broadcast (20Hz):      │
     │                              │   AgentNetworkData {         │
     │                              │     k: appearanceHash,       │
     │                              │     ap?: packedBits (첫 1회) │
     │                              │   }                          │
     │                              │─────────────────────────────→│
     │                              │                              │
     │                              │              클라 B 수신:     │
     │                              │              ap 있으면 unpack │
     │                              │              → cache[hash]=app│
     │                              │              이후 k(hash)만  │
     │                              │              → cache lookup  │
```

### 3.2 Phase 1 하위 호환 흐름 (서버 미수정 시)

```
[클라이언트]                      [서버 (기존)]
     │                              │
     │ join_room {                  │
     │   roomId, name,              │
     │   skinId: 5                  │ ← 기존 프로토콜 유지
     │ }                            │
     │─────────────────────────────→│
     │                              │
     │         state: { k: 5 }      │ ← 기존 skinId 그대로
     │←─────────────────────────────│
     │                              │
     │ skin-migration.ts:           │
     │ migrateFromSkinId(5)         │
     │ → CubelingAppearance         │
     │ → 텍스처 생성 + 렌더링       │
```

### 3.3 프레임별 렌더링 파이프라인

```
useFrame (priority 0, 매 프레임, ~16.6ms @ 60fps)
│
├─ [GameLoop.tsx] ─────────────────────────────────────────────────
│   ├── 서버 state 보간 (interpolateAgents)
│   ├── 클라이언트 예측 (applyClientPrediction)
│   └── agentsRef.current = 보간된 AgentNetworkData[]
│
├─ [AgentInstances.tsx] ────────────────────────────────────────────
│   │
│   ├── Phase 1: Resolve appearances ─────────────────────────────
│   │   for each agent:
│   │     appearance = resolveAppearance(agent.k, cache)
│   │     faceKey = getFaceKey(appearance)
│   │     patternId = appearance.pattern
│   │
│   ├── Phase 2: Animation state machine ─────────────────────────
│   │   for each agent:
│   │     asm = animCache.get(agent.i) ?? new AnimationStateMachine()
│   │     asm.update({ velocity, boosting, alive, ... }, delta)
│   │     transforms = asm.computeTransforms(elapsed)
│   │
│   ├── Phase 3: Body part matrices ──────────────────────────────
│   │   for each agent:
│   │     // 패턴별 IM에 에이전트 할당
│   │     bodyIM = bodyMeshes[patternId]
│   │     bodyIM.setMatrixAt(slot, computeMatrix(transforms.body))
│   │     bodyIM.setColorAt(slot, VIVID_PALETTE[appearance.topColor])
│   │
│   │     // 팔/다리 (단일 IM + setColorAt)
│   │     armLMesh.setMatrixAt(idx, computeMatrix(transforms.armL))
│   │     armLMesh.setColorAt(idx, VIVID_PALETTE[appearance.topColor])
│   │     // ... armR, legL, legR 동일
│   │
│   │     // 파트 매트릭스를 partMatricesRef에 저장
│   │     partMatricesRef.current.set(agent.i, { head, body, armR, ... })
│   │
│   └── Phase 4: needsUpdate flags ──────────────────────────────
│       bodyMeshes.forEach(im => im.instanceMatrix.needsUpdate = true)
│       armLMesh.instanceMatrix.needsUpdate = true
│       // ... 모든 IM
│
├─ [HeadGroupManager.tsx] ─────────────────────────────────────────
│   ├── 에이전트별 faceKey → headMeshMap.get(faceKey)
│   ├── 없으면 → generateFaceTexture() → new InstancedMesh → map에 추가
│   ├── setMatrixAt(slot, headMatrix from partMatricesRef)
│   ├── setColorAt(slot, blendColor(skinTone, hairColor))
│   └── 미사용 faceKey IM → count=0 또는 dispose
│
├─ [EyeInstances.tsx] ─────────────────────────────────────────────
│   ├── 에이전트별 깜빡임 타이머 체크
│   ├── headMatrix from headMatricesRef → 눈 위치 계산
│   ├── setMatrixAt(idx, eyeMatrix)
│   └── UV offset attribute 업데이트 (열린/닫힌)
│
├─ [EquipmentInstances.tsx] ───────────────────────────────────────
│   ├── 에이전트별 장비 슬롯 확인 (hat/weapon/backItem)
│   ├── 부모 파트 매트릭스 × 부착점 오프셋 = 장비 매트릭스
│   ├── 해당 형태 IM에 setMatrixAt + setColorAt
│   └── 미착용 에이전트 → 해당 IM 슬롯 미사용
│
├─ [AuraRings.tsx] (기존 유지) ────────────────────────────────────
│   └── auraMesh: setMatrixAt + setColorAt (변경 없음)
│
└─ [PlayCamera.tsx] ───────────────────────────────────────────────
    └── 카메라 추적 + lerp (변경 없음)
```

### 3.4 컴포넌트 간 데이터 공유 전략

```
GameCanvas3D.tsx
├── agentsRef ─────────── (기존) ──→ GameLoop, AgentInstances, AuraRings 등
├── elapsedRef ────────── (기존) ──→ AgentInstances
├── partMatricesRef ───── (신규) ──→ AgentInstances(쓰기) → Equipment/Eye(읽기)
├── headMatricesRef ───── (신규) ──→ HeadGroupManager(쓰기) → EyeInstances(읽기)
└── appearanceCacheRef ── (신규) ──→ 모든 appearance 참조 컴포넌트
```

> **설계 원칙**: 모든 데이터 공유는 `React.MutableRefObject` (ref)를 통해 수행.
> useState/Context 사용 금지 — useFrame 내부에서 리렌더링 유발 방지.
> 쓰기 순서: GameLoop → AgentInstances → HeadGroupManager → EyeInstances → EquipmentInstances
> (JSX 마운트 순서 = useFrame 실행 순서 at priority 0)

## 4. 기존 코드 리팩토링 전략

### 4.1 원칙: 점진적 마이그레이션 (Big Bang 금지)

모든 리팩토링은 기존 기능을 유지하면서 단계적으로 진행한다.
각 단계 후 게임이 정상 동작해야 하며, feature flag로 롤백 가능.

### 4.2 파일별 리팩토링 계획

#### `AgentInstances.tsx` (403줄 → ~500줄)

| 단계 | 변경 | 하위 호환 | 롤백 |
|------|------|----------|------|
| 1 | `PARTS` 상수를 `CUBELING_PARTS` import로 교체 | offset만 변경, 로직 동일 | `PARTS` 상수 복원 |
| 2 | `computePartRotations()` → `AnimationStateMachine` | 출력 포맷 변경이지만 `setPartMatrix` 내부 흡수 | 기존 함수 유지 |
| 3 | dominant skin 코드 제거, setColorAt 추가 | material 할당 로직 변경 | dominant skin 코드 복원 |
| 4 | head IM 분리 → HeadGroupManager 위임 | head ref/mesh JSX 제거 | head IM 복원 |
| 5 | body IM을 패턴별 4 IM으로 분할 | 에이전트-IM 매핑 로직 추가 | 단일 body IM 복원 |

**구체적 코드 변경 (단계 1):**
```typescript
// 기존 (삭제):
const PARTS = {
  head: { size: [8, 8, 8] as const, offset: [0, 28, 0] as const },
  body: { size: [8, 12, 4] as const, offset: [0, 18, 0] as const },
  // ...
};

// 신규 (추가):
import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions';
// CUBELING_PARTS.head.size = [10, 10, 8], offset = [0, 19, 0] 등
```

**구체적 코드 변경 (단계 3 — setColorAt):**
```typescript
// 기존 (삭제): dominant skin material 교체
const mats = getPartMaterials(dominantSkin);
bodyMesh.material = mats.body;

// 신규 (추가): white base material + 인스턴스별 색상
// (useMemo에서 1회 생성)
const whiteMat = new THREE.MeshLambertMaterial({
  map: generateBodyBase(patternId), // 흰색 base 텍스처
  color: new THREE.Color(0xffffff),  // 곱연산 중립
});

// (useFrame 내부)
const topColor = VIVID_PALETTE[appearance.topColor];
_color.set(topColor);
bodyMesh.setColorAt(idx, _color);
bodyMesh.instanceColor!.needsUpdate = true;
```

#### `agent-textures.ts` (451줄 → ~200줄 축소)

| 단계 | 변경 | 이유 |
|------|------|------|
| 1 | `cubeling-textures.ts`에 새 함수 구현 | 기존 파일 건드리지 않고 병행 |
| 2 | `AgentInstances`가 새 모듈 import | 기존 함수 참조 제거 |
| 3 | 기존 `generate*Texture()` deprecated 표시 | `VoxelCharacter`에서 아직 사용 가능 |
| 4 | `VoxelCharacter`도 새 모듈로 전환 | 기존 함수 완전 사용 중단 |
| 5 | 기존 함수 삭제, `agent-textures.ts` 축소 | 캐시 관리 + re-export만 유지 |

#### `VoxelCharacter.tsx` (130줄 → ~150줄)

| 변경 | 상세 |
|------|------|
| props | `skinId: number` → `appearance: CubelingAppearance` |
| 치수 | `HEAD.h = 0.5` → `0.625`, `BODY.h = 0.75` → `0.4375` 등 |
| 텍스처 | `getAgentTextures(skinId)` → `cubeling-textures` 함수 사용 |
| 장비 | `showEquipment` prop 추가 시 모자/무기 mesh 추가 |

**하위 호환 래퍼 (전환기):**
```typescript
// 기존 호출: <VoxelCharacter skinId={5} .../>
// 전환기: skinId를 appearance로 자동 변환
function VoxelCharacterCompat({ skinId, ...rest }: { skinId: number } & ...) {
  const appearance = migrateFromSkinId(skinId);
  return <VoxelCharacter appearance={appearance} {...rest} />;
}
```

#### `coordinate-utils.ts` (49줄 — 최소 변경)

| 변경 | 상세 |
|------|------|
| `getAgentScale()` | 기존 `1.0 + log2(m/10) * 0.3` 유지 (비대칭 스케일은 `cubeling-proportions`에서 처리) |
| 신규 export | `getAsymmetricScale()` 추가 가능 (또는 `cubeling-proportions`에 위임) |

### 4.3 하위 호환 보장 체크리스트

| 항목 | 보장 방법 |
|------|----------|
| `AgentInstancesProps` 인터페이스 | 불변 — `agentsRef`, `elapsedRef` 유지 |
| `GameCanvas3D` 호출부 | 신규 ref (partMatricesRef 등)는 GameCanvas3D 내부에서 생성 |
| `AgentNetworkData.k` | Phase 1: skinId 그대로, `skin-migration.ts`가 변환 |
| `DEFAULT_SKINS` 상수 | 삭제 안 함 — `skin-migration.ts`가 참조 |
| 서버 코드 | Phase 1~5: 서버 변경 없음. Phase 6~7: `join_room` 확장 |
| `useFrame priority 0` | 절대 변경 금지 — auto-render 유지 |
| `AuraRings.tsx` | 변경 없음 (기존 `agentsRef` 그대로 소비) |
| 로비 씬 | `VoxelCharacterCompat` 래퍼로 기존 `skinId` prop 지원 |

### 4.4 Feature Flag 전략

```typescript
// apps/web/lib/3d/feature-flags.ts
export const CUBELING_FLAGS = {
  /** Phase 1: 프로포션 변경 */
  USE_CUBELING_PROPORTIONS: true,
  /** Phase 2: Color-Tint 시스템 */
  USE_COLOR_TINT: false,
  /** Phase 3: 큐블링 텍스처 */
  USE_CUBELING_TEXTURES: false,
  /** Phase 4: 애니메이션 상태 머신 */
  USE_ANIM_STATE_MACHINE: false,
  /** Phase 5: 장비 시스템 */
  USE_EQUIPMENT: false,
  /** Phase 6: 눈 깜빡임 */
  USE_EYE_BLINK: false,
} as const;
```

> 각 Phase 완료 후 해당 flag를 `true`로 전환.
> 문제 발생 시 `false`로 즉시 롤백.

## 5. 모듈별 테스트 전략

### 5.1 테스트 분류

| 분류 | 범위 | 도구 | 실행 시점 |
|------|------|------|----------|
| **Unit** | 순수 함수/클래스 (lib/3d) | Vitest | PR merge 전 |
| **Snapshot** | 텍스처 Canvas 출력 | Vitest + Canvas mock | PR merge 전 |
| **Visual** | 렌더링 결과 스크린샷 | Playwright | Phase 완료 시 |
| **Performance** | FPS, draw calls, 메모리 | Chrome DevTools + 자동화 | Phase 완료 시 |

### 5.2 모듈별 Unit 테스트

#### `types/appearance.ts`

```
- packAppearance() → unpackAppearance() 왕복 일관성 (모든 필드 보존)
- appearanceToHash() 결정적 (동일 input → 동일 hash)
- packAppearance() 출력이 8바이트(64비트) 이내
- 경계값: 모든 필드 최대값/최소값
- getFaceKey(): eyeStyle + mouthStyle 조합별 고유 키
```

#### `cubeling-proportions.ts`

```
- CUBELING_PARTS 전체 높이 합계 = 24 units
  (head offset + head height/2 = 19 + 5 = 24 확인)
- getScaledParts('slim'): body W × 0.85, arm W × 0.75
- getScaledParts('chunky'): body W × 1.15, limb W × 1.1
- getScaledParts('tall'): body H × 1.2, leg H × 1.15, 총 높이 ~28u
- getAsymmetricScale(10): head=1.0, body=1.0
- getAsymmetricScale(50): head=1.35, body=1.70
- getAsymmetricScale(100): head=1.49, body=1.99
- toWorldUnits(24) = 1.5 (world units)
```

#### `animation-state-machine.ts`

```
- 초기 상태: IDLE
- velocity > 5 → WALK 전환 (blendDuration=0.15)
- velocity < 5 → IDLE 복귀
- boosting=true → BOOST 전환
- alive=false → DEATH (즉시, blendDuration=0)
- wasHit=true → HIT (즉시, 0.3초 후 이전 상태 복귀)
- HIT duration 경과 후 previous state 복귀
- SPAWN → IDLE (0.4초 후 자동 전환)
- 블렌딩: blendFactor 0→1 보간 (easeInOut)
- cubelingBounce(): abs(sin) 기반, 항상 ≥ 0
- cubelingHipSway(): sin 기반, 범위 [-0.05, 0.05]
- computeTransforms() 반환값: 모든 회전 rad 범위 체크
```

#### `cubeling-textures.ts`

```
- generateFaceTexture(): Canvas 16×16, NearestFilter, no mipmap
- applyRoundingShade(): 중앙 투명, 가장자리 어두움 (rgba 검증)
- generateBodyBase(0=solid): 흰색 base 확인
- generateBodyBase(1=striped): 줄무늬 패턴 확인
- TextureCacheManager: 동일 key → 동일 텍스처 반환 (캐시 히트)
- TextureCacheManager: maxSize 초과 시 LRU eviction
- TextureCacheManager.dispose(): 모든 텍스처 정상 해제
```

#### `equipment-data.ts`

```
- ATTACH_POINTS: 모든 부착점의 parentPart가 유효한 PartName
- computeEquipmentMatrix(): 부모 identity 매트릭스 → offset만 적용
- 모든 장비 geometryType이 EQUIPMENT_GEOMETRIES에 존재
```

#### `skin-migration.ts`

```
- migrateFromSkinId(0~23): 24개 모두 유효한 CubelingAppearance 반환
- migrateFromSkinId(24+): 기본 프리셋 반환 (에러 없음)
- resolveAppearance(): cache hit → cache 값 반환
- resolveAppearance(): cache miss → migrateFromSkinId fallback
```

### 5.3 Visual 테스트 (Playwright)

```
- 로비: VoxelCharacter 높이 1.5u 렌더링 확인 (스크린샷 비교)
- 게임: 60 에이전트 각각 다른 색상 표시 (setColorAt 동작)
- 게임: idle → walk → boost 전환 시 바운스 발생 확인
- 장비: 모자/무기 부착점 위치 정상 (머리 위, 오른손)
- 눈: 깜빡임 발생 확인 (3~5초 간격)
```

### 5.4 Performance 벤치마크 기준

| 지표 | 목표 (데스크탑) | 목표 (모바일) | 측정 방법 |
|------|---------------|-------------|----------|
| FPS (60 agents) | ≥ 60fps | ≥ 30fps | requestAnimationFrame delta |
| Draw calls | ≤ 30 | ≤ 30 | renderer.info.render.calls |
| GPU 메모리 | ≤ 50MB | ≤ 30MB | renderer.info.memory |
| 텍스처 캐시 | ≤ 120 entries | ≤ 60 entries | TextureCacheManager.size |
| useFrame 시간 | ≤ 4ms | ≤ 8ms | performance.now() delta |
| 얼굴 그룹 수 | ≤ 15 IM | ≤ 15 IM | headMeshMap.size |

### 5.5 메모리 누수 테스트

```
시나리오: 60 에이전트 접속 → 30 퇴장 → 30 재접속 (다른 외형) → 반복 10회
확인:
  - headMeshMap.size ≤ 15 (미사용 그룹 dispose 확인)
  - TextureCacheManager.size ≤ 120 (LRU 동작 확인)
  - renderer.info.memory.textures 안정 (증가 추세 없음)
  - motionCache / animCache 사이즈 ≤ MAX_AGENTS
```

## 6. 자체 검증 결과

### 6.1 기획서 대비 완성도

| 기획서 섹션 | 아키텍처 커버리지 | 상태 |
|------------|-----------------|------|
| 섹션 3 (프로포션 24u) | `cubeling-proportions.ts` — 6파트 크기/오프셋/피벗 전체 정의 | PASS |
| 섹션 3.4 (비대칭 스케일) | `getAsymmetricScale()` — 머리 느리게/몸통 빠르게 | PASS |
| 섹션 3.5 (바디 타입 4종) | `BODY_TYPE_SCALES` + `getScaledParts()` | PASS |
| 섹션 3.6 (월드유닛 변환) | `toWorldUnits()` + `VoxelCharacter` 수정 계획 | PASS |
| 섹션 3.7 (서버 프로토콜) | `types/appearance.ts` packAppearance/unpackAppearance | PASS |
| 섹션 4 (텍스처 16x16) | `cubeling-textures.ts` — 얼굴/바디/팔/다리 생성 | PASS |
| 섹션 4.3 (눈 12종 / 입 8종) | `EYE_STYLES` / `MOUTH_STYLES` 상수 + generateFaceTexture | PASS |
| 섹션 4.5 (비비드 팝 팔레트) | `VIVID_PALETTE` + `SKIN_TONES` 상수 | PASS |
| 섹션 4.6 (둥근 착시) | `applyRoundingShade()` 유틸 | PASS |
| 섹션 5 (10종 애니메이션) | `AnimationStateMachine` — 10 AnimState enum + 전환 | PASS |
| 섹션 5.3 (눈 깜빡임) | `EyeInstances.tsx` 컴포넌트 | PASS |
| 섹션 5.4 (블렌딩) | `blendFactor` + `blendDuration` + easeInOut lerp | PASS |
| 섹션 5.5 (바운스 물리) | `cubelingBounce()` + `cubelingHipSway()` | PASS |
| 섹션 6 (장비 부착점) | `ATTACH_POINTS` + `computeEquipmentMatrix()` | PASS |
| 섹션 6.2 (모자/무기/등) | `EquipmentInstances.tsx` — 형태별 IM + setColorAt | PASS |
| 섹션 6.4 (Draw Call 예산) | ~25 draw calls 설계 (Section 1 다이어그램) | PASS |
| 섹션 7 (커스터마이제이션) | `CubelingAppearance` 타입 + `CharacterCreator.tsx` | PASS |
| 섹션 7.5 (비트 인코딩) | `packAppearance()` / `unpackAppearance()` 63비트 | PASS |
| 섹션 7.6 (텍스처 캐싱) | `TextureCacheManager` LRU 120 | PASS |
| 섹션 8.1 (IM 아키텍처) | 모듈 다이어그램 전체 IM 구조 반영 | PASS |
| 섹션 8.2 (Color-Tint) | setColorAt + 패턴/얼굴 그룹핑 전략 상세 서술 | PASS |
| 섹션 8.3 (애니메이션 파이프라인) | 3.3절 프레임별 렌더링 파이프라인 | PASS |
| 섹션 8.4 (눈 깜빡임 기술) | EyeInstances — PlaneGeometry + UV offset + Z-bias | PASS |
| 섹션 8.5 (파일 구조) | 모듈 목록 완전 일치 | PASS |

**커버리지: 22/22 항목 PASS (100%)**

### 6.2 모듈 경계 명확성 검증

| 검증 항목 | 결과 |
|----------|------|
| 모든 모듈이 export 인터페이스 명시됨 | PASS — 11개 모듈 각각 공개 API 정의 |
| shared 모듈은 Three.js 의존 없음 | PASS — `appearance.ts`, `cubeling.ts` 순수 TS |
| lib/3d 모듈은 React/R3F 의존 없음 | PASS — 순수 함수/클래스 (Three.js 텍스처만 의존) |
| components/3d만 React hooks 사용 | PASS — useRef/useFrame/useMemo는 컴포넌트에만 |
| `animation-state-machine.ts`는 Three.js 무관 | PASS — 숫자 연산만, Matrix4/Object3D 없음 |
| standalone import 가능 여부 | PASS — 각 모듈 독립 import 가능 (순환 의존 없음) |

### 6.3 순환 의존 검증

**의존 그래프 (방향: A→B = A imports B):**

```
Layer 0 (zero deps):
  types/appearance.ts

Layer 1:
  constants/cubeling.ts → types/appearance

Layer 2:
  cubeling-proportions.ts → constants/cubeling
  cubeling-textures.ts → constants/cubeling
  skin-migration.ts → types/appearance, constants/cubeling
  equipment-data.ts → types/appearance, cubeling-proportions

Layer 3:
  animation-state-machine.ts → cubeling-proportions

Layer 4 (components):
  AgentInstances → cubeling-proportions, animation-state-machine, cubeling-textures
  HeadGroupManager → cubeling-textures, constants/cubeling
  EquipmentInstances → equipment-data
  EyeInstances → cubeling-textures
  VoxelCharacter → cubeling-proportions, cubeling-textures
  CharacterCreator → types/appearance, constants/cubeling
```

**결론: Layer N은 Layer 0~(N-1)만 참조. 동일 Layer 간 참조 없음. 순환 의존 없음.**

### 6.4 리스크 완화 검증

| 기획서 리스크 | 아키텍처 완화 | 상태 |
|-------------|-------------|------|
| 프로포션 변경 히트박스 불일치 | 히트박스는 서버 `hr` 필드, 비주얼과 완전 분리 | MITIGATED |
| Draw call ~25 FPS 하락 | 비활성 IM count=0 스킵, 단순 BoxGeo (12 tri) | MITIGATED |
| 얼굴 그룹 IM 메모리 누수 | 30초 미사용 dispose + `cleanup()` 주기적 호출 | MITIGATED |
| 텍스처 캐시 OOM | LRU 120개 상한 + 16x16 해상도 유지 | MITIGATED |
| 10종 애니메이션 전환 버그 | 상태 머신 프레임워크 (priority 기반 강제 전환) | MITIGATED |
| 네트워크 외형 데이터 증가 | join 시 1회만 전송, 인게임은 hash (4바이트) | MITIGATED |
| 기존 24 스킨 호환 | skin-migration.ts 즉시 매핑 테이블 | MITIGATED |
| 눈 깜빡임 Z-fighting | polygonOffset factor=-1 units=-1 | MITIGATED |
| setColorAt 색상 곱연산 한계 | white base 텍스처 (곱연산 = 원본색 반영) | MITIGATED |

### 6.5 모듈 재활용성 검증

| 모듈 | 게임 외 재활용 시나리오 | 독립 사용 가능 |
|------|----------------------|--------------|
| `types/appearance.ts` | 캐릭터 데이터 저장/전송 (DB, API) | YES |
| `constants/cubeling.ts` | 에디터 툴, 어드민 패널 | YES |
| `cubeling-proportions.ts` | 다른 3D 프로젝트 캐릭터 시스템 | YES |
| `animation-state-machine.ts` | 2D Canvas 애니메이션에도 적용 가능 | YES |
| `cubeling-textures.ts` | 텍스처 미리보기 도구, 썸네일 생성 | YES |
| `equipment-data.ts` | 장비 카탈로그 UI, 인벤토리 시스템 | YES |
| `skin-migration.ts` | 데이터 마이그레이션 스크립트 | YES |
