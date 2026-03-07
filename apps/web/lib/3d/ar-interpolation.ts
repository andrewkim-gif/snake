/**
 * ar-interpolation.ts — Arena Combat 클라이언트 보간 시스템 (v18 Phase 4)
 *
 * 서버 20Hz → 클라이언트 60fps 보간을 수행한다.
 * 각 엔티티(플레이어, 적, 투사체)의 이전/현재 서버 위치를 저장하고
 * 프레임마다 lerp하여 부드러운 움직임을 만든다.
 */

import type {
  ARPlayerNet,
  AREnemyNet,
  ARProjectileNet,
  ARCrystalNet,
  ARFieldItemNet,
  ARState,
} from './ar-types';

// ============================================================
// Interpolation State
// ============================================================

/** 엔티티별 보간 상태를 저장 */
export interface InterpolatedEntity {
  /** 서버에서 받은 이전 위치 */
  prevX: number;
  prevZ: number;
  prevRot: number;

  /** 서버에서 받은 현재(최신) 위치 */
  currX: number;
  currZ: number;
  currRot: number;

  /** 렌더링에 사용할 보간된 위치 */
  renderX: number;
  renderZ: number;
  renderRot: number;

  /** 서버 상태 수신 타임스탬프 */
  lastUpdateTime: number;
}

/** 전체 Arena 보간 상태 */
export interface ARInterpolationState {
  /** 엔티티 ID → 보간 상태 매핑 */
  entities: Map<string, InterpolatedEntity>;

  /** 서버 틱 간격 (ms). 20Hz = 50ms */
  serverTickMs: number;

  /** 마지막 서버 상태 수신 시각 */
  lastServerTime: number;

  /** 현재 보간 비율 (0~1, 매 프레임 갱신) */
  alpha: number;
}

// ============================================================
// Constants
// ============================================================

/** 서버 틱 간격: 20Hz = 50ms */
const SERVER_TICK_MS = 50;

/** 보간 지연 버퍼: 1 서버 틱 뒤 (50ms) */
const INTERP_DELAY_MS = 50;

/** Dead reckoning 최대 시간 (ms). 이후에는 snap */
const MAX_DEAD_RECKONING_MS = 200;

/** 위치 차이가 이 값보다 크면 lerp 대신 snap */
const SNAP_THRESHOLD = 20.0;

// ============================================================
// Factory
// ============================================================

/** 보간 상태 초기화 */
export function createARInterpolation(): ARInterpolationState {
  return {
    entities: new Map(),
    serverTickMs: SERVER_TICK_MS,
    lastServerTime: 0,
    alpha: 0,
  };
}

// ============================================================
// Server State Update
// ============================================================

/**
 * 서버 ar_state 수신 시 호출.
 * 이전 상태를 prev로 밀고, 새 상태를 curr에 저장한다.
 */
export function onARStateReceived(
  interp: ARInterpolationState,
  state: ARState,
): void {
  const now = performance.now();
  interp.lastServerTime = now;

  // Track active entity IDs to clean up stale entries
  const activeIds = new Set<string>();

  // Update players
  for (const player of state.players) {
    activeIds.add(player.id);
    updateEntity(interp, player.id, player.pos.x, player.pos.z, player.rot, now);
  }

  // Update enemies
  for (const enemy of state.enemies) {
    activeIds.add(enemy.id);
    updateEntity(interp, enemy.id, enemy.x, enemy.z, 0, now);
  }

  // Update projectiles
  for (const proj of state.projectiles) {
    activeIds.add(proj.id);
    updateEntity(interp, proj.id, proj.x, proj.z, 0, now);
  }

  // Update XP crystals
  for (const crystal of state.xpCrystals) {
    activeIds.add(crystal.id);
    updateEntity(interp, crystal.id, crystal.x, crystal.z, 0, now);
  }

  // Update field items
  for (const item of state.items) {
    activeIds.add(item.id);
    updateEntity(interp, item.id, item.x, item.z, 0, now);
  }

  // Remove stale entries (entities that no longer exist)
  for (const id of interp.entities.keys()) {
    if (!activeIds.has(id)) {
      interp.entities.delete(id);
    }
  }
}

/** 단일 엔티티의 보간 상태 갱신 */
function updateEntity(
  interp: ARInterpolationState,
  id: string,
  x: number,
  z: number,
  rot: number,
  now: number,
): void {
  let entity = interp.entities.get(id);

  if (!entity) {
    // 새 엔티티: snap으로 시작
    entity = {
      prevX: x,
      prevZ: z,
      prevRot: rot,
      currX: x,
      currZ: z,
      currRot: rot,
      renderX: x,
      renderZ: z,
      renderRot: rot,
      lastUpdateTime: now,
    };
    interp.entities.set(id, entity);
    return;
  }

  // 너무 먼 거리면 snap
  const dx = x - entity.currX;
  const dz = z - entity.currZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > SNAP_THRESHOLD) {
    entity.prevX = x;
    entity.prevZ = z;
    entity.prevRot = rot;
    entity.currX = x;
    entity.currZ = z;
    entity.currRot = rot;
    entity.renderX = x;
    entity.renderZ = z;
    entity.renderRot = rot;
  } else {
    // 이전 curr을 prev로 밀기
    entity.prevX = entity.currX;
    entity.prevZ = entity.currZ;
    entity.prevRot = entity.currRot;
    entity.currX = x;
    entity.currZ = z;
    entity.currRot = rot;
  }

  entity.lastUpdateTime = now;
}

// ============================================================
// Per-Frame Interpolation
// ============================================================

/**
 * 매 프레임 호출. 모든 엔티티의 렌더 위치를 보간 갱신한다.
 * useFrame()에서 호출하면 된다.
 */
export function tickARInterpolation(interp: ARInterpolationState): void {
  const now = performance.now();
  const elapsed = now - interp.lastServerTime;

  // alpha = elapsed / serverTickMs (0~1, clamped)
  interp.alpha = Math.min(elapsed / interp.serverTickMs, 1.0);

  for (const entity of interp.entities.values()) {
    const timeSinceUpdate = now - entity.lastUpdateTime;

    if (timeSinceUpdate > MAX_DEAD_RECKONING_MS) {
      // Dead reckoning timeout: snap to current
      entity.renderX = entity.currX;
      entity.renderZ = entity.currZ;
      entity.renderRot = entity.currRot;
      continue;
    }

    // Lerp between prev and curr
    entity.renderX = lerp(entity.prevX, entity.currX, interp.alpha);
    entity.renderZ = lerp(entity.prevZ, entity.currZ, interp.alpha);
    entity.renderRot = lerpAngle(entity.prevRot, entity.currRot, interp.alpha);
  }
}

/**
 * 특정 엔티티의 보간된 렌더 위치를 가져온다.
 * 없으면 null 반환.
 */
export function getInterpolatedPos(
  interp: ARInterpolationState,
  id: string,
): { x: number; z: number; rot: number } | null {
  const entity = interp.entities.get(id);
  if (!entity) return null;
  return {
    x: entity.renderX,
    z: entity.renderZ,
    rot: entity.renderRot,
  };
}

// ============================================================
// Helpers
// ============================================================

/** 선형 보간 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 각도 보간 (최단 경로) */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Wrap to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
