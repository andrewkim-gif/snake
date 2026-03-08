# ARCHITECTURE: v24 Globe Effects Overhaul — Unified Design System

> System architecture for the "Holographic War Room" unified effect system.
> Covers shared infrastructure, camera controller, arc effects, surface effects,
> 2D overlay tokens, LOD system, and file structure changes.

## 1. System Overview

### 1.1 Current State (AS-IS)

The globe currently renders **13 independent 3D effect components** and **7 2D overlays**,
each developed at different times with inconsistent conventions:

```
GlobeView.tsx (orchestrator)
  +-- GlobeDominationLayer      (shader overlay, renderOrder 10)
  +-- GlobeWarEffects           (arc + particles + CameraShake, renderOrder 3-7)
  +-- GlobeMissileEffect        (InstancedMesh, renderOrder implicit)
  +-- GlobeShockwave            (pool of 5 rings, renderOrder implicit)
  +-- GlobeTradeRoutes          (shader lines + cargo meshes, renderOrder 3-4)
  +-- GlobeEventPulse           (ring/X pool, renderOrder 5)
  +-- GlobeAllianceBeam         (line + InstancedMesh particles, renderOrder 5-6)
  +-- GlobeSanctionBarrier      (X marks + ring + dashed line, renderOrder 4-5)
  +-- GlobeResourceGlow         (shader ring + InstancedMesh particles, renderOrder 4-5)
  +-- GlobeSpyTrail             (dashed line + eye sprite, renderOrder 3-5)
  +-- GlobeNukeEffect           (shockwave + pillar + cloud particles, renderOrder 5-7)
  +-- GlobeConflictIndicators   (2x InstancedMesh + shaders, renderOrder 109-110)
  +-- GlobeLandmarks / LandmarkMeshes / LandmarkSprites (3 systems, renderOrder 95-98)
```

**Key problems identified in code audit:**

| Problem | Files Affected | Severity |
|---------|---------------|----------|
| Arc creation function duplicated 5x | TradeRoutes, AllianceBeam, SpyTrail, SanctionBarrier, WarEffects | High |
| `centroidsMap` vs `countryCentroids` prop inconsistency | Alliance, Sanction, Resource, Spy, Nuke use `centroidsMap`; War, Missile, Trade, EventPulse, Labels, Landmarks use `countryCentroids` | High |
| Surface altitude ranges from +0.3 to +2.0 across 7 different values | All surface effects | High |
| `ARC_HEIGHT_FACTOR` ranges from 0.15 to 0.35 across 5 different values | All arc effects | Medium |
| `renderOrder` non-systematic (3-110 range) | All effect components | Medium |
| CameraShake inside GlobeWarEffects conflicts with CameraAutoFocus | GlobeWarEffects, CameraAutoFocus | Critical |
| 13 independent `useFrame` callbacks | All effect components | Medium |
| Per-event Material clone in multiple components | SanctionBarrier (xMaterial.clone()), ResourceGlow (ringMaterial per event), NukeEffect (3 materials per event) | Medium |
| NewsFeed color system independent from 3D effect colors | NewsFeed.tsx vs all 3D effects | Low |
| 2D overlay blur/bg/transition values inconsistent | NewsFeed, GlobeHoverPanel, and other overlay panels | Low |

### 1.2 Target State (TO-BE)

```
lib/
  effect-constants.ts          [NEW] Unified color, altitude, renderOrder, timing constants
  effect-utils.ts              [NEW] Shared arc creation, surface coordinate, easing functions
  overlay-tokens.ts            [NEW] 2D overlay design tokens (bg, blur, border, transition)
  globe-utils.ts               [EXISTING] latLngToVector3, latLngToXYZ, geoToXYZ

components/3d/
  CameraController.tsx         [NEW] Merged CameraAutoFocus + CameraShake + priority queue
  GlobeWarEffects.tsx          [MODIFIED] Remove internal CameraShake, use effect-constants
  GlobeTradeRoutes.tsx         [MODIFIED] Use shared arc util, effect-constants
  GlobeAllianceBeam.tsx        [MODIFIED] Use shared arc util, effect-constants, prop rename
  GlobeSanctionBarrier.tsx     [MODIFIED] Use shared arc util, effect-constants, prop rename
  GlobeSpyTrail.tsx            [MODIFIED] Use shared arc util, effect-constants, prop rename
  GlobeResourceGlow.tsx        [MODIFIED] Use effect-constants, prop rename, material pooling
  GlobeNukeEffect.tsx          [MODIFIED] Use effect-constants, prop rename, material pooling
  GlobeEventPulse.tsx          [MODIFIED] Use effect-constants
  GlobeConflictIndicators.tsx  [MODIFIED] Use effect-constants
  GlobeMissileEffect.tsx       [MODIFIED] Use effect-constants
  GlobeShockwave.tsx           [MODIFIED] Use effect-constants
  GlobeDominationLayer.tsx     [MODIFIED] renderOrder alignment only
  LandmarkMeshes.tsx           [MODIFIED] Altitude to Ground level
  LandmarkSprites.tsx          [MODIFIED] Kept for LOD far

components/lobby/
  GlobeView.tsx                [MODIFIED] Swap CameraAutoFocus -> CameraController, prop unify
  NewsFeed.tsx                 [MODIFIED] Import colors from effect-constants

hooks/
  useGlobeLOD.ts               [MODIFIED] Extend to 3-tier (close/mid/far)
```

---

## 2. Shared Infrastructure

### 2.1 `lib/effect-constants.ts` — Unified Design Tokens

This file becomes the **single source of truth** for all visual parameters across
13 3D effects and 7 2D overlays.

```typescript
// ─── Event Color Language (Section 3.1 of plan) ───

import * as THREE from 'three';

/** HDR multiplier creates bloom-compatible glow */
export const EFFECT_COLORS = {
  war:       { hex: '#FF3333', hdr: 2.5, css: '#FF3333' },
  alliance:  { hex: '#3388FF', hdr: 2.5, css: '#3388FF' },
  trade:     { hex: '#33CC66', hdr: 2.0, css: '#33CC66' },
  resource:  { hex: '#CCAA33', hdr: 2.5, css: '#CCAA33' },
  spy:       { hex: '#9955CC', hdr: 2.0, css: '#9955CC' },
  sanction:  { hex: '#CC6633', hdr: 2.0, css: '#CC6633' },
  nuke:      { hex: '#FFAA33', hdr: 3.0, css: '#FFAA33' },
  nukeDecay: { hex: '#666666', hdr: 1.0, css: '#666666' },
  epoch:     { hex: '#FFCC44', hdr: 2.5, css: '#FFCC44' },
} as const;

/** Pre-constructed THREE.Color instances (module scope, no GC) */
export const COLORS_3D = {
  war:      new THREE.Color(EFFECT_COLORS.war.hex).multiplyScalar(EFFECT_COLORS.war.hdr),
  alliance: new THREE.Color(EFFECT_COLORS.alliance.hex).multiplyScalar(EFFECT_COLORS.alliance.hdr),
  trade:    new THREE.Color(EFFECT_COLORS.trade.hex).multiplyScalar(EFFECT_COLORS.trade.hdr),
  resource: new THREE.Color(EFFECT_COLORS.resource.hex).multiplyScalar(EFFECT_COLORS.resource.hdr),
  spy:      new THREE.Color(EFFECT_COLORS.spy.hex).multiplyScalar(EFFECT_COLORS.spy.hdr),
  sanction: new THREE.Color(EFFECT_COLORS.sanction.hex).multiplyScalar(EFFECT_COLORS.sanction.hdr),
  nuke:     new THREE.Color(EFFECT_COLORS.nuke.hex).multiplyScalar(EFFECT_COLORS.nuke.hdr),
  epoch:    new THREE.Color(EFFECT_COLORS.epoch.hex).multiplyScalar(EFFECT_COLORS.epoch.hdr),
} as const;

// ─── Unified Arc Heights (Section 3.2 of plan) ───

export const ARC_HEIGHT = {
  trade:    0.35,   // was 0.15 — raised for visibility
  spy:      0.25,   // was 0.20 — subtle raise
  sanction: 0.30,   // was 0.25 — low and heavy
  war:      0.45,   // was 0.25 — aggressive height
  alliance: 0.50,   // was 0.30 — tallest, elegant
  missile:  0.60,   // was 0.35 — most dramatic parabola
} as const;

// ─── Unified Surface Altitude (Section 3.3 of plan) ───

export const SURFACE_ALT = {
  GROUND: 0.5,     // Surface-attached: glow rings, shockwave, domination overlay
  LOW:    1.0,     // Low-altitude: trade cargo, spy dashes, sanction X marks
  HIGH:   1.5,     // High-altitude: conflict icons, event pulse, arc endpoints
} as const;

// ─── Unified renderOrder (Section 3.4 of plan) ───

export const RENDER_ORDER = {
  // Layer 1: Domination (1-9)
  DOMINATION:        5,

  // Layer 2: Surface effects (10-19)
  SURFACE_GLOW:     10,   // ResourceGlow ring, Shockwave
  SURFACE_RING:     12,   // SanctionBarrier ring

  // Layer 3: Arc lines (20-29)
  ARC_TRADE:        20,
  ARC_SPY:          21,
  ARC_SANCTION:     22,
  ARC_WAR:          23,
  ARC_ALLIANCE:     24,

  // Layer 4: Flying objects (30-39)
  CARGO:            30,   // Trade cargo meshes
  MISSILE_SMOKE:    31,
  MISSILE_HEAD:     32,
  PARTICLES:        33,   // Alliance particles, ResourceGlow particles

  // Layer 5: Explosions (40-49)
  NUKE_SHOCKWAVE:   40,
  NUKE_PILLAR:      41,
  NUKE_CLOUD:       42,
  WAR_FIREWORKS:    43,

  // Layer 6: Icons (50-59)
  SANCTION_XMARK:   50,
  SPY_EYE:          51,
  CONFLICT_RING:    52,
  CONFLICT_ICON:    53,
  EVENT_PULSE:      55,

  // Layer 7: Landmarks (90-99)
  LANDMARK_MESH:    95,
  LANDMARK_SPRITE:  98,

  // Layer 8: Labels (100)
  COUNTRY_LABEL:   100,
} as const;

// ─── Unified Animation Timing (Section 3.5 of plan) ───

export const TIMING = {
  PULSE_LOOP:       { min: 1.5, max: 3.0 },  // seconds, sin wave
  EVENT_ENTER:      0.300,   // seconds, easeOutCubic
  EVENT_EXIT:       0.500,   // seconds, easeInQuad
  ARC_CREATE:       0.800,   // seconds, easeOutQuart
  CAMERA_MOVE:      2.000,   // seconds, easeInOutCubic
  CAMERA_SHAKE:     0.400,   // seconds, linear decay
} as const;

// ─── Camera Event Priority (Section FR-2) ───

export const CAMERA_PRIORITY = {
  nuke:     5,
  war:      4,
  epoch:    3,
  alliance: 2,
  trade:    1,
} as const;

export type CameraEventType = keyof typeof CAMERA_PRIORITY;

// ─── Arc Segments ───

export const ARC_SEGMENTS = {
  HIGH:    64,   // close LOD
  MEDIUM:  32,   // mid LOD
  LOW:     16,   // far LOD
} as const;
```

**Design decision**: Constants use `as const` for literal types. `THREE.Color` instances
are pre-allocated at module scope to avoid GC pressure during animation frames.

**Color mapping to existing systems**:

| Existing palette (source) | Existing color | New unified color | Change |
|---------------------------|---------------|-------------------|--------|
| `sketch-ui.ts` SK.red | `#EF4444` | `#FF3333` (war) | Brighter, HDR-compatible |
| `sketch-ui.ts` SK.blue | `#6366F1` | `#3388FF` (alliance) | More saturated cyan-blue |
| `sketch-ui.ts` SK.green | `#10B981` | `#33CC66` (trade) | Brighter emerald |
| `sketch-ui.ts` SK.gold | `#F59E0B` | `#CCAA33` (resource) | Warmer amber |
| `GlobeAllianceBeam` BEAM_HDR | `#4488ff` | `#3388FF` | Slight shift |
| `GlobeSpyTrail` SPY_COLOR | `#9966cc` | `#9955CC` | Minor shift |
| `GlobeSanctionBarrier` SANCTION_COLOR | `#cc3333` | `#CC6633` | Red -> Orange (differentiated from war) |
| `NewsFeed` war_declared | `#FF0000` | `#FF3333` | Aligned with 3D |
| `NewsFeed` treaty_signed | `#3B82F6` | `#3388FF` | Aligned with 3D |
| `NewsFeed` economy_event | `#CC9933` | `#CCAA33` | Aligned with 3D |

### 2.2 `lib/effect-utils.ts` — Shared Arc & Surface Utilities

```typescript
import * as THREE from 'three';
import { ARC_SEGMENTS } from './effect-constants';

// ─── GC-prevention temp objects (module scope) ───

const _mid = new THREE.Vector3();
const _control = new THREE.Vector3();
const _p = new THREE.Vector3();

// ─── Shared Quadratic Bezier Arc ───

/**
 * Creates a quadratic bezier arc between two points on a sphere.
 * Replaces 5 duplicate implementations across:
 *   - GlobeTradeRoutes.createBezierArcPoints
 *   - GlobeAllianceBeam.createArcCurve
 *   - GlobeSpyTrail.createArcPoints
 *   - GlobeSanctionBarrier.createArcPoints
 *   - GlobeWarEffects (inline arc logic)
 *
 * @param start     Start point on sphere surface
 * @param end       End point on sphere surface
 * @param radius    Globe radius (for control point calculation)
 * @param arcHeight Height factor (0.25 = low, 0.60 = dramatic)
 * @param segments  Number of arc segments (LOD-dependent)
 * @returns Array of Vector3 points along the arc
 */
export function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  arcHeight: number,
  segments: number = ARC_SEGMENTS.HIGH,
): THREE.Vector3[] {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  const control = _mid.clone().normalize().multiplyScalar(radius + dist * arcHeight);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const invT = 1 - t;
    points.push(
      new THREE.Vector3()
        .addScaledVector(start, invT * invT)
        .addScaledVector(control, 2 * invT * t)
        .addScaledVector(end, t * t)
    );
  }
  return points;
}

/**
 * Creates a THREE.QuadraticBezierCurve3 for continuous sampling.
 * Used by components that need getPointAt() (e.g. alliance particle flow).
 */
export function createArcCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  arcHeight: number,
): THREE.QuadraticBezierCurve3 {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  const control = _mid.clone().normalize().multiplyScalar(radius + dist * arcHeight);
  return new THREE.QuadraticBezierCurve3(start.clone(), control, end.clone());
}

// Additional GC-prevention temp for getArcPointGCFree
const _normal = new THREE.Vector3();

/**
 * GC-free arc point interpolation for useFrame loops.
 * Used by GlobeMissileEffect for per-frame position updates.
 *
 * Note: Uses module-scope _mid, _normal, _control to avoid allocations.
 * NOT thread-safe (single useFrame context only).
 */
export function getArcPointGCFree(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number,
  arcHeight: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  _normal.copy(_mid).normalize();
  _control.copy(_mid).addScaledVector(_normal, arcHeight);

  const invT = 1 - t;
  out.set(
    invT * invT * start.x + 2 * invT * t * _control.x + t * t * end.x,
    invT * invT * start.y + 2 * invT * t * _control.y + t * t * end.y,
    invT * invT * start.z + 2 * invT * t * _control.z + t * t * end.z,
  );
  return out;
}

// ─── Easing Functions (Section 3.5 of plan) ───

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Surface Orientation ───

const _upDefault = new THREE.Vector3(0, 1, 0);
const _quatTemp = new THREE.Quaternion();

/**
 * Orients a mesh to face outward from the globe surface at a given position.
 * Applies quaternion rotation + rotateX(-PI/2) for flat-on-surface placement.
 * Replaces duplicate lookAt/quaternion logic in ~6 components.
 */
export function orientToSurface(
  mesh: THREE.Object3D,
  position: THREE.Vector3,
  normal: THREE.Vector3,
): void {
  mesh.position.copy(position);
  _quatTemp.setFromUnitVectors(_upDefault, normal);
  mesh.quaternion.copy(_quatTemp);
  mesh.rotateX(-Math.PI / 2);
}
```

**Deduplication impact**: The `createArcPoints` function consolidates 5 near-identical
implementations (diff: only `arcHeight` and `segments` parameters varied).

### 2.3 `lib/overlay-tokens.ts` — 2D Overlay Design Tokens

```typescript
/**
 * Unified 2D overlay design tokens (Section 3.6 of plan).
 * Applied to: NewsFeed, GlobeHoverPanel, AgentSetup, LeftBar, etc.
 */

import { EFFECT_COLORS } from './effect-constants';

// ─── Background & Glass ───

export const OVERLAY = {
  /** Standard panel background */
  bg: 'rgba(9, 9, 11, 0.90)',
  /** Standard backdrop blur */
  blur: 'blur(12px)',
  /** Standard border */
  border: '1px solid rgba(255, 255, 255, 0.08)',
  /** Standard transition */
  transition: '300ms ease',
  /** Standard border-radius (0 for tactical) */
  borderRadius: '0px',
} as const;

// ─── News Event Tag Colors (synced with 3D) ───

export const NEWS_TYPE_COLORS: Record<string, string> = {
  sovereignty_change: EFFECT_COLORS.trade.css,    // green — territory change
  battle_start:       EFFECT_COLORS.war.css,       // red
  battle_end:         EFFECT_COLORS.resource.css,   // gold/amber
  war_declared:       EFFECT_COLORS.war.css,        // red
  treaty_signed:      EFFECT_COLORS.alliance.css,   // blue
  economy_event:      EFFECT_COLORS.resource.css,   // gold
  season_event:       EFFECT_COLORS.epoch.css,      // gold accent
  global_event:       EFFECT_COLORS.spy.css,        // purple
};

// ─── CSS Animation Keyframes (deduplicated) ───

/** Single pulse keyframe definition (replaces 2 duplicates) */
export const KEYFRAMES_PULSE = `
  @keyframes effectPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

/** Single fadeIn keyframe definition (replaces 3 duplicates) */
export const KEYFRAMES_FADE_IN = `
  @keyframes effectFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
```

### 2.4 Centroid Prop Unification

**Decision**: Unify all prop names to `countryCentroids` (used by 7 components)
instead of `centroidsMap` (used by 5 components).

| Component | Current Prop | New Prop | Change |
|-----------|-------------|----------|--------|
| GlobeWarEffects | `countryCentroids` | `countryCentroids` | No change |
| GlobeMissileEffect | `countryCentroids` | `countryCentroids` | No change |
| GlobeTradeRoutes | `countryCentroids` | `countryCentroids` | No change |
| GlobeEventPulse | `countryCentroids` | `countryCentroids` | No change |
| GlobeCountryLabels | `countryCentroids` | `countryCentroids` | No change |
| GlobeConflictIndicators | `countryCentroids` | `countryCentroids` | No change |
| GlobeLandmarks | `countryCentroids` | `countryCentroids` | No change |
| **GlobeAllianceBeam** | `centroidsMap` | `countryCentroids` | **Rename** |
| **GlobeSanctionBarrier** | `centroidsMap` | `countryCentroids` | **Rename** |
| **GlobeResourceGlow** | `centroidsMap` | `countryCentroids` | **Rename** |
| **GlobeSpyTrail** | `centroidsMap` | `countryCentroids` | **Rename** |
| **GlobeNukeEffect** | `centroidsMap` | `countryCentroids` | **Rename** |

**GlobeView.tsx impact**: All 5 call sites in lines 1799, 1808, 1817, 1826, 1835
change from `centroidsMap={centroidsMap}` to `countryCentroids={centroidsMap}`.

---

## 3. Camera Controller Integration

### 3.1 Problem Statement

Currently two independent camera systems compete for `camera.position`:

1. **CameraAutoFocus** (`components/3d/CameraAutoFocus.tsx`)
   - Spherical interpolation (slerp) to target position over 3 seconds
   - Disables OrbitControls during animation
   - User gesture cancellation support

2. **CameraShake** (inside `components/3d/GlobeWarEffects.tsx`, lines 1259-1296)
   - Sin-wave offset `sin(t*40)*0.3` for 0.5 seconds
   - Stores `origPos` on activation, restores on completion
   - **Race condition**: If CameraAutoFocus is animating when CameraShake activates,
     `origPos` captures mid-animation position, and restore snaps to wrong location

3. **GlobeIntroCamera** (`components/3d/GlobeIntroCamera.tsx`)
   - Start-to-end linear interpolation over 2.8 seconds
   - Events during intro are ignored (no queuing)

### 3.2 `CameraController.tsx` — Unified Camera Component

```
CameraController
  |
  +-- State Machine: IDLE -> FOCUSING -> SHAKING -> IDLE
  |                  IDLE -> INTRO_ACTIVE -> IDLE
  |
  +-- Priority Queue (useRef, no rerender)
  |     nuke(5) > war(4) > epoch(3) > alliance(2) > trade(1)
  |
  +-- OrbitControls sync
  |     controls.target = origin after focus
  |     controls.update() after any camera mutation
  |
  +-- Intro deferral
        introActive=true -> queue events, execute top-1 on intro complete
```

**Architecture**:

```typescript
interface CameraControllerProps {
  /** Ref set by parent when an event wants camera focus */
  targetRef: React.RefObject<THREE.Vector3 | null>;
  /** Priority of the current target event */
  priorityRef: React.RefObject<number>;
  /** Whether intro camera animation is active */
  introActive: boolean;
  /** Globe radius for distance calculations */
  globeRadius?: number;
  /** Focus duration in seconds */
  focusDuration?: number;
  /** Shake duration in seconds */
  shakeDuration?: number;
}

// Internal state machine
type CameraState = 'idle' | 'focusing' | 'shaking' | 'intro';

// Priority queue entry
interface QueuedEvent {
  position: THREE.Vector3;
  priority: number;
  timestamp: number;
  shake: boolean;  // whether to shake after focus
}
```

**State transitions**:

```
                     [new event, priority > current]
IDLE ──────────────────────> FOCUSING
  ^                              |
  |                              | [focus complete, shake=true]
  |                              v
  +──── [shake complete] ── SHAKING
  ^
  |  [focus complete, shake=false]
  +──────────────────────────────+

INTRO ──[intro complete]──> IDLE (dequeue top-1 if any)
```

**Key implementation details**:

1. **Focus + Shake sequencing**: Shake only starts after focus animation completes.
   `origPos` is captured at focus-completion position (guaranteed correct).

2. **Priority preemption**: If a higher-priority event arrives during focus,
   the current animation is cancelled and the new target replaces it.
   Lower-priority events during animation are silently dropped.

3. **OrbitControls sync**: After focus completes, explicitly set:
   ```typescript
   controls.target.set(0, 0, 0);
   controls.update();
   ```
   This prevents the snap-back bug (FR-11).

4. **Intro deferral** (FR-12): When `introActive=true`, incoming camera events
   are stored in the priority queue. On intro completion, only the highest-priority
   event is executed; others are discarded to avoid a cascade of camera movements.

5. **User gesture cancellation**: Preserved from CameraAutoFocus. Any
   `pointerdown`, `wheel`, or `touchstart` during focus/shake immediately
   cancels the animation and restores OrbitControls.

### 3.3 Migration Plan

| Step | Action |
|------|--------|
| 1 | Create `CameraController.tsx` with combined logic |
| 2 | Remove `CameraShake` function from `GlobeWarEffects.tsx` (lines 1259-1296, 1403) |
| 3 | Update `GlobeWarEffects` to set `priorityRef.current = CAMERA_PRIORITY.war` instead of activating internal shake |
| 4 | Replace `<CameraAutoFocus>` in `GlobeView.tsx` (line 1704) with `<CameraController>` |
| 5 | Update `GlobeEventPulse.onCameraTarget` to also set priority |
| 6 | Delete `CameraAutoFocus.tsx` (fully replaced) |

---

## 4. Arc Effect Unification

### 4.1 Current Arc Implementation Matrix

| Component | Arc Function | ARC_HEIGHT | Segments | Color | Surface Alt | renderOrder |
|-----------|-------------|------------|----------|-------|-------------|-------------|
| GlobeTradeRoutes | `createBezierArcPoints` (local) | 0.15 | 48 | `#3399ff`/`#33cc66` | +0.5 | 3-4 |
| GlobeAllianceBeam | `createArcCurve` (local) | 0.30 | 64 | `#4488ff` HDR 2.5 | +1.0 | 5-6 |
| GlobeWarEffects | inline bezier | 0.25 | - | `#cc2222` | +0.5 | 3-7 |
| GlobeSanctionBarrier | `createArcPoints` (local) | 0.25 | 48 | `#cc3333` | +1.0/+1.5 | 4-5 |
| GlobeSpyTrail | `createArcPoints` (local) | 0.20 | 48 | `#9966cc` | +0.8 | 3-5 |
| GlobeMissileEffect | `getArcPoint` (GC-free) | 0.35 | N/A | vertex colors | *1.02 | - |

### 4.2 Unified Arc Architecture

After refactoring, all arc effects use shared functions from `lib/effect-utils.ts`:

| Component | Shared Function | ARC_HEIGHT (new) | Segments | Color (new) | Surface Alt (new) | renderOrder (new) |
|-----------|----------------|-----------------|----------|-------------|-------------------|-------------------|
| GlobeTradeRoutes | `createArcPoints` | **0.35** | LOD-dependent | `COLORS_3D.trade` | `SURFACE_ALT.GROUND` (+0.5) | `RENDER_ORDER.ARC_TRADE` (20) |
| GlobeAllianceBeam | `createArcCurve` | **0.50** | 64 | `COLORS_3D.alliance` | `SURFACE_ALT.LOW` (+1.0) | `RENDER_ORDER.ARC_ALLIANCE` (24) |
| GlobeWarEffects | `createArcPoints` | **0.45** | LOD-dependent | `COLORS_3D.war` | `SURFACE_ALT.GROUND` (+0.5) | `RENDER_ORDER.ARC_WAR` (23) |
| GlobeSanctionBarrier | `createArcPoints` | **0.30** | 48 | `COLORS_3D.sanction` | `SURFACE_ALT.LOW` (+1.0) | `RENDER_ORDER.ARC_SANCTION` (22) |
| GlobeSpyTrail | `createArcPoints` | **0.25** | 48 | `COLORS_3D.spy` | `SURFACE_ALT.LOW` (+1.0) | `RENDER_ORDER.ARC_SPY` (21) |
| GlobeMissileEffect | `getArcPointGCFree` | **0.60** | N/A (continuous) | vertex colors (keep) | `SURFACE_ALT.LOW` (+1.0) | `RENDER_ORDER.MISSILE_HEAD` (32) |

### 4.3 Visual Differentiation Strategy

With increased and systematically ordered arc heights, arcs are now distinguishable
by both color and vertical profile:

```
Height profile (side view of globe):

  0.60 ─── Missile ~~~ (red, fast, dramatic parabola)
  0.50 ─── Alliance === (blue, smooth, highest sustained arc)
  0.45 ─── War - - - (red dashed, aggressive)
  0.35 ─── Trade ~~~ (green, gentle curve)
  0.30 ─── Sanction --- (orange dashed, low and heavy)
  0.25 ─── Spy . . . (purple dotted, subtle)
  ──────── Globe surface ────────────────────────
```

---

## 5. Surface Effect Unification

### 5.1 Current Surface Effect Matrix

| Component | Current Alt | Current renderOrder | Material Strategy |
|-----------|-----------|-------------------|-------------------|
| GlobeDominationLayer | 0 (overlay) | 10 | Per-country ShaderMaterial (necessary for per-country uniforms) |
| GlobeResourceGlow (ring) | +0.5 | 4 | Per-event ShaderMaterial (uTime, uColor, uOpacity) |
| GlobeResourceGlow (particles) | +0.5 upward | 5 | Per-event MeshBasicMaterial (clone for opacity) |
| GlobeNukeEffect (shockwave) | +0.5 | 6 | Per-event MeshBasicMaterial |
| GlobeNukeEffect (pillar) | +0.5 upward | 5 | Per-event MeshBasicMaterial |
| GlobeNukeEffect (cloud) | +0.5 upward | 7 | Per-event MeshBasicMaterial |
| GlobeShockwave | impact point | - | Pooled (5 rings, shared material) |
| GlobeConflictIndicators | +1.5 | 109-110 | Shared ShaderMaterial per layer |
| GlobeEventPulse | +0.8 | 5 | Pooled (3 rings, shared material) |
| GlobeSanctionBarrier (X mark) | +1.5 | 5 | `xMaterial.clone()` per event |
| GlobeSanctionBarrier (ring) | +1.5 | 4 | `ringMaterial.clone()` per event |
| LandmarkMeshes | +0.3 | 95 | Shared ShaderMaterial per archetype |
| LandmarkSprites | +2.0 | 98 | Shared ShaderMaterial (single draw call) |

### 5.2 Unified Surface Architecture

| Component | New Alt | New renderOrder | Material Change |
|-----------|---------|-----------------|-----------------|
| GlobeDominationLayer | 0 (overlay) | `RENDER_ORDER.DOMINATION` (5) | No change (per-country uniforms required) |
| GlobeResourceGlow (ring) | `SURFACE_ALT.GROUND` (+0.5) | `RENDER_ORDER.SURFACE_GLOW` (10) | Keep per-event (shader needs per-event uTime phase) |
| GlobeResourceGlow (particles) | +0.5 upward | `RENDER_ORDER.PARTICLES` (33) | Keep per-event (opacity varies per particle) |
| GlobeNukeEffect (shockwave) | `SURFACE_ALT.GROUND` (+0.5) | `RENDER_ORDER.NUKE_SHOCKWAVE` (40) | Pool materials (max 3 concurrent nukes) |
| GlobeNukeEffect (pillar) | +0.5 upward | `RENDER_ORDER.NUKE_PILLAR` (41) | Pool materials |
| GlobeNukeEffect (cloud) | +0.5 upward | `RENDER_ORDER.NUKE_CLOUD` (42) | Pool materials |
| GlobeShockwave | impact point | `RENDER_ORDER.SURFACE_GLOW` (10) | No change (already pooled) |
| GlobeConflictIndicators | `SURFACE_ALT.HIGH` (+1.5) | `RENDER_ORDER.CONFLICT_RING/ICON` (52-53) | No change (already shared) |
| GlobeEventPulse | `SURFACE_ALT.HIGH` (+1.5) | `RENDER_ORDER.EVENT_PULSE` (55) | No change (already pooled) |
| GlobeSanctionBarrier (X) | `SURFACE_ALT.HIGH` (+1.5) | `RENDER_ORDER.SANCTION_XMARK` (50) | **Stop cloning** xMaterial; share single material, control opacity via uniform |
| GlobeSanctionBarrier (ring) | `SURFACE_ALT.HIGH` (+1.5) | `RENDER_ORDER.SURFACE_RING` (12) | **Stop cloning** ringMaterial; share single material |
| LandmarkMeshes | `SURFACE_ALT.GROUND` (+0.5) | `RENDER_ORDER.LANDMARK_MESH` (95) | No change |
| LandmarkSprites | `SURFACE_ALT.HIGH` (+1.5) | `RENDER_ORDER.LANDMARK_SPRITE` (98) | No change |

### 5.3 Material Pooling Strategy

**Components with per-event Material clone (wasteful)**:

1. **GlobeSanctionBarrier**: `xMaterial.clone()` and `ringMaterial.clone()` per sanction
   - Fix: Use ShaderMaterial with per-instance `opacity` uniform, or accept shared opacity
     (all X marks pulse together, which is visually acceptable for sanctions)

2. **GlobeNukeEffect**: 3 new Materials per nuke event
   - Fix: Pre-allocate material pool for max 3 concurrent nukes (worst case: 9 materials
     instead of unbounded). Recycle on nuke completion.

3. **GlobeResourceGlow**: `ShaderMaterial` per resource event (necessary for per-event
   `uTime` phase offset)
   - Assessment: Acceptable. ShaderMaterial has per-event uniform state that cannot be shared.
     Alternative would require converting to InstancedMesh with custom attribute, which is
     Phase 6 optimization scope.

**Already optimized** (no change needed):
- GlobeShockwave: Object pool of 5 rings
- GlobeEventPulse: Material pool of 3
- GlobeConflictIndicators: 2 InstancedMesh (2 draw calls total)
- LandmarkMeshes: InstancedMesh per archetype
- GlobeMissileEffect: 2 InstancedMesh

---

## 6. 2D Overlay Token System

### 6.1 Current Inconsistencies (from code audit)

| Property | NewsFeed (ticker) | NewsFeed (expanded) | GlobeHoverPanel | Standard |
|----------|-----------------|-------------------|----------------|----------|
| Background | `rgba(14,14,18, 0.90)` | `rgba(14,14,18, 0.95)` | `SK.glassBg` | `rgba(9,9,11, 0.90)` |
| Blur | `blur(8px)` | `blur(16px)` | `blur(16px)` | `blur(12px)` |
| Border | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.06)` | varies | `rgba(255,255,255,0.08)` |
| Transition | varies | varies | varies | `300ms ease` |

### 6.2 Token Application Plan

All overlay components import from `lib/overlay-tokens.ts`:

```typescript
// Before (NewsFeed.tsx line 374-378):
background: 'rgba(14, 14, 18, 0.90)',
backdropFilter: 'blur(8px)',
borderTop: '1px solid rgba(255, 255, 255, 0.06)',

// After:
background: OVERLAY.bg,
backdropFilter: OVERLAY.blur,
borderTop: OVERLAY.border,
```

### 6.3 NewsFeed Color Synchronization

The `newsTypeColors` map in `NewsFeed.tsx` (line 38-47) is replaced with
`NEWS_TYPE_COLORS` from `overlay-tokens.ts`, which derives colors from
`EFFECT_COLORS` in `effect-constants.ts`.

Current vs. New mapping:

| News Type | Current Color | New Color (from 3D) | Source |
|-----------|-------------|-------------------|--------|
| sovereignty_change | `#22C55E` | `#33CC66` | `EFFECT_COLORS.trade` |
| battle_start | `#EF4444` | `#FF3333` | `EFFECT_COLORS.war` |
| battle_end | `#F59E0B` | `#CCAA33` | `EFFECT_COLORS.resource` |
| war_declared | `#FF0000` | `#FF3333` | `EFFECT_COLORS.war` |
| treaty_signed | `#3B82F6` | `#3388FF` | `EFFECT_COLORS.alliance` |
| economy_event | `#CC9933` | `#CCAA33` | `EFFECT_COLORS.resource` |
| season_event | `#8B5CF6` | `#FFCC44` | `EFFECT_COLORS.epoch` |
| global_event | `#EC4899` | `#9955CC` | `EFFECT_COLORS.spy` |

### 6.4 CSS Keyframe Deduplication

The `pulse` keyframe is defined in at least 2 locations (NewsFeed LIVE badge,
and implicitly in CSS). The `fadeIn` keyframe in at least 3 locations.

Solution: Export canonical keyframe strings from `overlay-tokens.ts`. Components
inject these via `<style>` tag or global CSS module. Each keyframe gets a prefixed
name (`effectPulse`, `effectFadeIn`) to avoid conflicts with existing unprefixed versions.

---

## 7. LOD System Design

### 7.1 Current LOD System

`useGlobeLOD.ts` provides a **2-tier** system:

| Tier | Detection | Features |
|------|-----------|----------|
| `desktop` | cores > 4 AND screen >= 768px | All effects enabled |
| `mobile` | cores <= 4 OR screen < 768px | NukeEffect off, TradeRoutes off, WarFog off, Shockwave off, particles 50% |

### 7.2 Extended 3-Tier LOD System

The plan requires a **3-tier camera-distance-based LOD** (NFR-4):

| Tier | Camera Distance | Feature Level |
|------|----------------|---------------|
| `close` | < 200 | Full detail: all particles, 64-segment arcs, all icons |
| `mid` | 200-350 | Reduced: 50% particles, 32-segment arcs, no cargo meshes |
| `far` | > 350 | Minimal: arcs only (static lines), no particles, no icons |

**Implementation**: Extend `useGlobeLOD` to return both device-tier AND a reactive
`distanceTier` computed in a `useFrame` hook:

```typescript
export interface GlobeLODConfig {
  // Existing device-tier fields...
  isMobile: boolean;
  tier: 'desktop' | 'mobile';

  // NEW: Camera-distance LOD tier
  distanceTier: 'close' | 'mid' | 'far';
  arcSegments: number;           // 64 / 32 / 16
  particleMultiplier: number;    // 1.0 / 0.5 / 0.0
  showCargo: boolean;            // true / true / false
  showParticles: boolean;        // true / true / false
  showIcons: boolean;            // true / true / false
}
```

**Hysteresis**: To prevent rapid tier switching when camera is near a boundary,
apply a 20-unit hysteresis buffer:
- `close -> mid` at distance 210 (not 200)
- `mid -> close` at distance 190 (not 200)
- `mid -> far` at distance 360 (not 350)
- `far -> mid` at distance 340 (not 350)

### 7.3 Landmark LOD Bridge

Current landmark system has 3 coexisting components:

| Component | Type | Usage | Planned Action |
|-----------|------|-------|---------------|
| `GlobeLandmarks.tsx` | Legacy wrapper | Renders LandmarkMeshes + LandmarkSprites | Keep as orchestrator |
| `LandmarkMeshes.tsx` | MC voxel 3D meshes | `close` + `mid` LOD | Primary — keep |
| `LandmarkSprites.tsx` | Billboard sprites | `far` LOD | Secondary — keep for far |

The LOD bridge:
- `close` (< 200): LandmarkMeshes visible, LandmarkSprites hidden
- `mid` (200-350): LandmarkMeshes visible (reduced count), LandmarkSprites hidden
- `far` (> 350): LandmarkMeshes hidden, LandmarkSprites visible (Tier 1 only, 15 sprites)

### 7.4 Reduced Motion Accessibility

```typescript
// In useGlobeLOD or a separate hook:
const prefersReducedMotion = useMemo(() => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}, []);

// When prefersReducedMotion is true:
// - Disable CameraShake
// - Disable pulse/glow animations (set static opacity)
// - Arcs render as static lines (no dash animation)
// - No particle flow on alliance beams
// - No ring rotation on sanctions
```

---

## 8. File Structure Changes Summary

### 8.1 New Files

| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/lib/effect-constants.ts` | Phase 1 | Unified colors, altitudes, renderOrder, timing, camera priority |
| `apps/web/lib/effect-utils.ts` | Phase 1 | Shared arc creation, surface orientation, easing functions |
| `apps/web/lib/overlay-tokens.ts` | Phase 1 | 2D overlay design tokens (bg, blur, border, transition, news colors) |
| `apps/web/components/3d/CameraController.tsx` | Phase 2 | Merged CameraAutoFocus + CameraShake + priority queue |

### 8.2 Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `components/3d/GlobeWarEffects.tsx` | Phase 2-3 | Remove CameraShake, use shared arc/colors/renderOrder |
| `components/3d/GlobeTradeRoutes.tsx` | Phase 3 | Use shared arc, effect-constants, new ARC_HEIGHT |
| `components/3d/GlobeAllianceBeam.tsx` | Phase 1+3 | Prop rename `centroidsMap` -> `countryCentroids`, shared arc/colors |
| `components/3d/GlobeSanctionBarrier.tsx` | Phase 1+3 | Prop rename, shared arc/colors, stop material clone |
| `components/3d/GlobeSpyTrail.tsx` | Phase 1+3 | Prop rename, shared arc/colors |
| `components/3d/GlobeResourceGlow.tsx` | Phase 1+4 | Prop rename, effect-constants colors |
| `components/3d/GlobeNukeEffect.tsx` | Phase 1+4 | Prop rename, effect-constants, material pooling |
| `components/3d/GlobeEventPulse.tsx` | Phase 4 | Effect-constants colors, renderOrder, altitude |
| `components/3d/GlobeConflictIndicators.tsx` | Phase 4 | Effect-constants colors, renderOrder |
| `components/3d/GlobeMissileEffect.tsx` | Phase 3 | Effect-constants ARC_HEIGHT, shared getArcPointGCFree |
| `components/3d/GlobeShockwave.tsx` | Phase 4 | renderOrder alignment |
| `components/3d/GlobeDominationLayer.tsx` | Phase 4 | renderOrder alignment only |
| `components/3d/LandmarkMeshes.tsx` | Phase 4 | Altitude from +0.3 to SURFACE_ALT.GROUND (+0.5) |
| `components/3d/LandmarkSprites.tsx` | Phase 4 | Altitude from +2.0 to SURFACE_ALT.HIGH (+1.5) |
| `components/lobby/GlobeView.tsx` | Phase 1-2 | CameraController swap, prop unification in JSX |
| `components/lobby/NewsFeed.tsx` | Phase 5 | Import colors from overlay-tokens, unified bg/blur |
| `components/3d/GlobeHoverPanel.tsx` | Phase 5 | Import overlay tokens for bg/blur/border |
| `components/lobby/GlobeView.tsx` (GlobeTitle) | Phase 5 | GlobeTitle internal component: align color/font to design tokens |
| `hooks/useGlobeLOD.ts` | Phase 6 | Extend to 3-tier (close/mid/far) + reduced motion + hysteresis |

### 8.3 Deleted Files

| File | Phase | Reason |
|------|-------|--------|
| `components/3d/CameraAutoFocus.tsx` | Phase 2 | Fully replaced by CameraController |

---

## 9. Self-Verification

### 9.1 Plan Coverage Matrix

| Plan Requirement | Architecture Section | Status |
|-----------------|---------------------|--------|
| **FR-1** Camera race condition fix | Section 3 (CameraController) | Covered: Shake executes only after focus completes |
| **FR-2** Camera priority queue | Section 3.2 (QueuedEvent, CAMERA_PRIORITY) | Covered: 5-level priority, preemption support |
| **FR-3** Arc height increase | Section 4.2 (ARC_HEIGHT constants) | Covered: All 6 arc types have new heights |
| **FR-4** Unified color system | Section 2.1 (EFFECT_COLORS, COLORS_3D) | Covered: 8 event types with hex, HDR, CSS variants |
| **FR-5** Shared arc utility | Section 2.2 (createArcPoints, createArcCurve, getArcPointGCFree) | Covered: 3 variants for different use cases |
| **FR-6** Surface altitude 3-tier | Section 2.1 (SURFACE_ALT) | Covered: GROUND/LOW/HIGH levels |
| **FR-7** renderOrder system | Section 2.1 (RENDER_ORDER) | Covered: 8 layers, 20+ specific values |
| **FR-8** centroid prop unification | Section 2.4 | Covered: 5 components renamed to `countryCentroids` |
| **FR-9** 2D overlay tokens | Section 2.3 (overlay-tokens.ts) | Covered: bg, blur, border, transition |
| **FR-10** NewsFeed color sync | Section 6.3 (NEWS_TYPE_COLORS) | Covered: All 8 news types mapped to 3D colors |
| **FR-11** OrbitControls sync | Section 3.2 (controls.target + controls.update) | Covered: Explicit sync after focus |
| **FR-12** Intro event queueing | Section 3.2 (intro deferral) | Covered: Queue during intro, execute top-1 after |
| **NFR-1** 60fps with 30 effects | Section 5.3 (material pooling), Section 7 (LOD) | Covered: Material reuse + 3-tier distance LOD |
| **NFR-2** 50% draw call reduction | Section 5.3 | Partially covered: Material pooling reduces clones, InstancedMesh consolidation in Phase 6 |
| **NFR-3** 30% GPU memory reduction | Section 5.3 | Covered: Material clone elimination for Sanction, Nuke |
| **NFR-4** 3-tier LOD | Section 7.2 | Covered: close/mid/far with hysteresis |
| **NFR-5** TypeScript strict build | N/A (implementation concern) | N/A for architecture doc |

### 9.2 Risk Coverage Matrix

| Plan Risk | Architecture Mitigation | Status |
|-----------|------------------------|--------|
| 13-effect simultaneous refactoring regression | Phase-by-phase approach (Section 8.2), effect-constants extracted first | Covered |
| InstancedMesh animation breakage | Only material pooling in architecture scope; InstancedMesh consolidation deferred to Phase 6 | Covered |
| Camera system intro breakage | CameraController state machine includes INTRO state (Section 3.2) | Covered |
| Arc height anti-podal artifacts | Not architecturally addressed — implementation-time cap (globeRadius * 0.3) | Deferred to implementation |
| 2D token UI layout breakage | Gradual application via overlay-tokens import, no structural CSS changes | Covered |
| 3 landmark systems coexisting | LOD bridge strategy (Section 7.3), GlobeLandmarks kept as orchestrator | Covered |
| GlobeTitle color/position | Included in Phase 5 overlay unification (Section 8.2) | Covered |
| Existing palette conflicts | Color mapping table (Section 2.1) with specific hex mappings | Covered |
| Bloom + HDR interaction | HDR multipliers defined in EFFECT_COLORS, Bloom settings noted for Phase 6 | Covered |
| prefers-reduced-motion | Section 7.4 with specific behavior per effect type | Covered |
| Sound/SFX hooks | Phase 7 scope (Section 8.2, plan line 294) — interface definition only | Covered in plan |

### 9.3 Gaps Identified and Addressed

**Gap 1**: Plan Section 6.1 mentions "추가 리스크" about `LOD 2단계->3단계 브릿지` but the
architecture initially only described the 3-tier extension without addressing how existing
`useGlobeLOD` consumers adapt.
- **Resolution**: Added Section 7.2 with explicit field additions to `GlobeLODConfig` interface,
  maintaining backward compatibility (existing fields unchanged, new fields added).

**Gap 2**: The plan mentions `useFrame` callback consolidation (Phase 6, line 277) but doesn't
specify which effects can share a frame callback.
- **Resolution**: Left as Phase 6 implementation decision. Architecture notes that effects with
  independent animation state (different elapsed times, different data) are poor candidates for
  merging. Best candidates: GlobeResourceGlow + GlobeNukeEffect (both iterate over event arrays
  with similar patterns).

**Gap 3**: The plan mentions `PostProcessingEffects` Bloom settings interaction (risk 6.1 line 192)
but the architecture should specify which HDR multipliers need Bloom threshold adjustment.
- **Resolution**: Added note in Section 2.1 color mapping table. The current Bloom settings
  (`luminanceThreshold: 0.4, intensity: 1.2`) were tuned for existing colors. The new HDR
  multipliers (2.0x-3.0x) are in the same range, so Bloom settings should remain compatible.
  Phase 6 includes explicit Bloom verification step.

**Gap 4**: Sound hook points (Phase 7, plan line 294) need interface definition in architecture.
- **Resolution**: This is a Phase 7 implementation task. The architecture acknowledges it but
  does not define the interface, as it has no structural impact on the effect system. A simple
  `onSoundCue?: (event: string) => void` callback pattern on CameraController and key effect
  components is sufficient.

---

## 10. Implementation Dependency Graph

```
Phase 1: effect-constants.ts + effect-utils.ts + overlay-tokens.ts + centroid prop rename
    |
    v
Phase 2: CameraController.tsx (depends on effect-constants for CAMERA_PRIORITY)
    |
    v
Phase 3: Arc effects (depends on effect-utils for createArcPoints, effect-constants for colors/heights)
    |
    v
Phase 4: Surface effects (depends on effect-constants for RENDER_ORDER, SURFACE_ALT)
    |
    v
Phase 5: 2D overlays (depends on overlay-tokens, effect-constants for NEWS_TYPE_COLORS)
    |
    v
Phase 6: LOD + Performance (depends on all prior phases being stable)
    |
    v
Phase 7: Coordinate verification + Integration testing + Sound hooks
```

Each phase must pass a build verification (`npx next build`) before proceeding to the next.
Phase 1 is pure additive (new files, no behavioral changes), making it a safe foundation.

---

## 11. Bloom Post-Processing Interaction

### 11.1 Current Bloom Settings

From `GlobeView.tsx` (lines 1842-1850):

```tsx
<Bloom
  luminanceThreshold={0.4}
  luminanceSmoothing={0.15}
  intensity={1.2}
  radius={0.75}
  mipmapBlur
/>
```

### 11.2 HDR Color Interaction Analysis

Bloom activates when pixel luminance exceeds `luminanceThreshold` (0.4).
With `toneMapped: false` on effect materials, HDR colors pass through to the
Bloom pass at their full multiplied intensity.

| Effect | HDR Multiplier | Base Luminance | Effective Luminance | Bloom? |
|--------|---------------|---------------|-------------------|--------|
| War `#FF3333` | 2.5x | 0.37 | 0.93 | Strong bloom |
| Alliance `#3388FF` | 2.5x | 0.45 | 1.13 | Strong bloom |
| Trade `#33CC66` | 2.0x | 0.52 | 1.04 | Moderate bloom |
| Resource `#CCAA33` | 2.5x | 0.56 | 1.40 | Strong bloom |
| Spy `#9955CC` | 2.0x | 0.37 | 0.74 | Moderate bloom |
| Sanction `#CC6633` | 2.0x | 0.45 | 0.90 | Moderate bloom |
| Nuke `#FFAA33` | 3.0x | 0.60 | 1.80 | Very strong bloom |
| Epoch `#FFCC44` | 2.5x | 0.68 | 1.70 | Very strong bloom |

All colors produce bloom effects. The key concern is **nuke and epoch** having
very high effective luminance (1.7-1.8x), which could produce excessive glow.

### 11.3 Recommendation

Current Bloom settings should work without changes for Phase 3 (arc effects).
For Phase 4 (surface effects with nuke/epoch), verify visually:
- If nuke explosion blooms excessively, reduce nuke HDR from 3.0x to 2.5x
- If epoch pulse is too bright, reduce epoch HDR from 2.5x to 2.0x
- Do NOT change Bloom threshold/intensity globally (affects all existing effects)

The HDR multipliers in `effect-constants.ts` are designed to be tuned during Phase 6
after all effects are unified, without requiring changes to the Bloom pass configuration.
