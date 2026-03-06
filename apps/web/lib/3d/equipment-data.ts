/**
 * equipment-data.ts — 장비 부착점 + 지오메트리 데이터 모듈
 *
 * Phase 5: 장비 & 액세서리 시스템
 * Three.js 의존 없음 (순수 숫자/타입 — Matrix4/Vector3 사용 안함)
 *
 * 6개 부착점:
 *   HEAD_TOP   — 모자/왕관 (head 매트릭스 기준)
 *   HEAD_FRONT — 안경/마스크 (head 매트릭스 기준)
 *   HAND_R     — 무기 (armR 매트릭스 기준)
 *   HAND_L     — 보조/방패 (armL 매트릭스 기준)
 *   BACK       — 망토/날개/배낭 (body 매트릭스 기준)
 *   FEET       — 신발 (leg 매트릭스 기준, 텍스처 오버레이)
 *
 * 장비 지오메트리:
 *   모자 3종: helmet(11x6x9), hat(12x4x12), crown(10x3x10)
 *   무기 2종: blade(2x14x1), staff(1x14x1)
 *   등 3종: cape(6x8x0.5), wings(10x8x0.5), pack(4x5x3)
 */

import type { PartName } from '@/lib/3d/cubeling-proportions';
import {
  HAT_DEFS,
  WEAPON_DEFS,
  BACK_ITEM_DEFS,
} from '@agent-survivor/shared';
import type { EquipmentDef } from '@agent-survivor/shared';

// ─── 부착점 열거 ───

export enum AttachPointName {
  HEAD_TOP = 'HEAD_TOP',
  HEAD_FRONT = 'HEAD_FRONT',
  HAND_R = 'HAND_R',
  HAND_L = 'HAND_L',
  BACK = 'BACK',
  FEET = 'FEET',
}

// ─── 부착점 인터페이스 ───

export interface AttachPoint {
  /** 부착점 이름 */
  name: AttachPointName;
  /** 부모 파트 (head/body/armR/armL/legL/legR) */
  parentPart: PartName;
  /** 부모 파트 로컬 좌표 기준 오프셋 [X, Y, Z] (게임 유닛) */
  localOffset: readonly [number, number, number];
}

// ─── 부착점 정의 (24-unit 큐블링 기준) ───

export const ATTACH_POINTS: Record<AttachPointName, AttachPoint> = {
  [AttachPointName.HEAD_TOP]: {
    name: AttachPointName.HEAD_TOP,
    parentPart: 'head',
    localOffset: [0, 5.5, 0],   // head 윗면
  },
  [AttachPointName.HEAD_FRONT]: {
    name: AttachPointName.HEAD_FRONT,
    parentPart: 'head',
    localOffset: [0, 0, 4.5],   // head 앞면
  },
  [AttachPointName.HAND_R]: {
    name: AttachPointName.HAND_R,
    parentPart: 'armR',
    localOffset: [0, -4, 2],    // 팔 끝 (손)
  },
  [AttachPointName.HAND_L]: {
    name: AttachPointName.HAND_L,
    parentPart: 'armL',
    localOffset: [0, -4, 2],    // 팔 끝 (손)
  },
  [AttachPointName.BACK]: {
    name: AttachPointName.BACK,
    parentPart: 'body',
    localOffset: [0, 0, -3],    // 몸통 뒷면
  },
  [AttachPointName.FEET]: {
    name: AttachPointName.FEET,
    parentPart: 'legL',
    localOffset: [0, -3.5, 0],  // 다리 끝 (발)
  },
} as const;

// ─── 장비 지오메트리 타입 ───

/**
 * 지오메트리 타입별 크기 사양
 * Three.js BoxGeometry / PlaneGeometry에 전달할 [W, H, D]
 */
export interface EquipmentGeometrySpec {
  /** 지오메트리 타입 식별자 */
  type: string;
  /** [Width, Height, Depth] 게임 유닛 */
  size: readonly [number, number, number];
  /** Three.js 기하 종류: box / plane */
  geometryFactory: 'box' | 'plane';
  /** 부착점 이름 */
  attachPointName: AttachPointName;
}

// ─── 장비 지오메트리 레지스트리 ───

export const EQUIPMENT_GEOMETRIES: Record<string, EquipmentGeometrySpec> = {
  // 모자 3종
  helmet: {
    type: 'helmet',
    size: [11, 6, 9],
    geometryFactory: 'box',
    attachPointName: AttachPointName.HEAD_TOP,
  },
  hat: {
    type: 'hat',
    size: [12, 4, 12],
    geometryFactory: 'box',
    attachPointName: AttachPointName.HEAD_TOP,
  },
  crown: {
    type: 'crown',
    size: [10, 3, 10],
    geometryFactory: 'box',
    attachPointName: AttachPointName.HEAD_TOP,
  },

  // 무기 2종
  blade: {
    type: 'blade',
    size: [2, 14, 1],
    geometryFactory: 'box',
    attachPointName: AttachPointName.HAND_R,
  },
  staff: {
    type: 'staff',
    size: [1, 14, 1],
    geometryFactory: 'box',
    attachPointName: AttachPointName.HAND_R,
  },

  // 등 3종
  cape: {
    type: 'cape',
    size: [6, 8, 0.5],
    geometryFactory: 'box',
    attachPointName: AttachPointName.BACK,
  },
  wings: {
    type: 'wings',
    size: [10, 8, 0.5],
    geometryFactory: 'box',
    attachPointName: AttachPointName.BACK,
  },
  pack: {
    type: 'pack',
    size: [4, 5, 3],
    geometryFactory: 'box',
    attachPointName: AttachPointName.BACK,
  },
} as const;

// ─── 장비 조회 유틸 ───

/**
 * hat ID → EquipmentDef 조회 (0=없음)
 */
export function getHatDef(hatId: number): EquipmentDef | null {
  if (hatId <= 0) return null;
  return HAT_DEFS.find(d => d.id === hatId) ?? null;
}

/**
 * weapon ID → EquipmentDef 조회 (0=없음)
 */
export function getWeaponDef(weaponId: number): EquipmentDef | null {
  if (weaponId <= 0) return null;
  return WEAPON_DEFS.find(d => d.id === weaponId) ?? null;
}

/**
 * backItem ID → EquipmentDef 조회 (0=없음)
 */
export function getBackItemDef(backItemId: number): EquipmentDef | null {
  if (backItemId <= 0) return null;
  return BACK_ITEM_DEFS.find(d => d.id === backItemId) ?? null;
}

/**
 * geometryType → EquipmentGeometrySpec 조회
 */
export function getEquipmentGeometry(geometryType: string): EquipmentGeometrySpec | null {
  return EQUIPMENT_GEOMETRIES[geometryType] ?? null;
}

// ─── 등 아이템 물리 파라미터 ───

/**
 * 등 장비 타입별 물리/애니메이션 파라미터
 * EquipmentInstances에서 backItem 애니메이션에 사용
 */
export interface BackItemPhysics {
  /** 속도 기반 X축 회전 계수 (망토 펄럭임) */
  velocityRotXFactor: number;
  /** 최대 X축 회전 (rad) */
  maxRotX: number;
  /** 사인 웨이브 진폭 (미세 움직임) */
  waveAmplitude: number;
  /** 사인 웨이브 주파수 */
  waveFrequency: number;
  /** 부스트 시 스케일 증가 배율 */
  boostScaleFactor: number;
}

export const BACK_ITEM_PHYSICS: Record<string, BackItemPhysics> = {
  /** 망토: 속도 기반 뒤로 펄럭임 + 미세 웨이브 */
  cape: {
    velocityRotXFactor: 0.01,
    maxRotX: 0.5,
    waveAmplitude: 0.05,
    waveFrequency: 3.0,
    boostScaleFactor: 1.0,
  },
  /** 날개: 좌우 대칭 + 미세 날갯짓 (sin wave) */
  wings: {
    velocityRotXFactor: 0.005,
    maxRotX: 0.3,
    waveAmplitude: 0.08,
    waveFrequency: 4.0,
    boostScaleFactor: 1.0,
  },
  /** 배낭: 고정 (거의 회전 없음) */
  pack: {
    velocityRotXFactor: 0.0,
    maxRotX: 0.0,
    waveAmplitude: 0.0,
    waveFrequency: 0.0,
    boostScaleFactor: 1.0,
  },
} as const;
