/**
 * cubeling-proportions.ts — 큐블링 프로포션 상수 + 유틸
 *
 * 24-unit 큐블링 바디 파트 크기/오프셋/피벗 정의
 * Three.js 무관 순수 모듈 (숫자 연산만)
 *
 * 전체 높이: 24 units (MC 32u → 큐블링 24u)
 * 머리 비율: 42% (10/24) — MC 25% (8/32) 대비 치비 비율
 */

import { BODY_TYPE_SCALES } from '@agent-survivor/shared';
import type { BodyType } from '@agent-survivor/shared';

// ─── 파트 이름 ───

export type PartName = 'head' | 'body' | 'armL' | 'armR' | 'legL' | 'legR';

// ─── 파트 스펙 인터페이스 ───

export interface PartSpec {
  /** [W, H, D] 게임 유닛 */
  readonly size: readonly [number, number, number];
  /** [X, Y, Z] 발바닥(ground=0) 기준 오프셋 */
  readonly offset: readonly [number, number, number];
  /** 회전 피벗: center(머리/몸통) 또는 top-center(팔/다리 — 어깨/엉덩이) */
  readonly pivot: 'center' | 'top-center';
}

// ─── 핵심 상수 ───

/** 큐블링 전체 높이 (게임 유닛) */
export const CUBELING_HEIGHT = 24;

/** 큐블링 전체 너비 — 팔 포함 (게임 유닛) */
export const CUBELING_WIDTH = 16;

/**
 * 큐블링 6파트 기본 프로포션
 *
 * head:  10×10×8  @ (0, 19, 0)   — 전체의 42%, 정체성 핵심
 * body:   8×7×5   @ (0, 10.5, 0) — 의상/장비 표시
 * armL:   4×7×4   @ (-6, 14, 0)  — 어깨 피벗 (top-center)
 * armR:   4×7×4   @ (6, 14, 0)   — 어깨 피벗
 * legL:   4×7×4   @ (-2, 7, 0)   — 엉덩이 피벗 (top-center)
 * legR:   4×7×4   @ (2, 7, 0)    — 엉덩이 피벗
 */
export const CUBELING_PARTS: Record<PartName, PartSpec> = {
  head: { size: [10, 10, 8], offset: [0, 19, 0], pivot: 'center' },
  body: { size: [8, 7, 5],   offset: [0, 10.5, 0], pivot: 'center' },
  armL: { size: [4, 7, 4],   offset: [-6, 14, 0], pivot: 'top-center' },
  armR: { size: [4, 7, 4],   offset: [6, 14, 0],  pivot: 'top-center' },
  legL: { size: [4, 7, 4],   offset: [-2, 7, 0],  pivot: 'top-center' },
  legR: { size: [4, 7, 4],   offset: [2, 7, 0],   pivot: 'top-center' },
} as const;

// ─── VoxelCharacter 월드유닛 변환 (로비 프리뷰) ───

/**
 * 게임 유닛 → R3F 월드 유닛 변환 비율
 * 16 게임유닛 = 1 월드유닛 (기존 코드 유지)
 * 24u 큐블링 = 1.5 월드유닛
 */
export const GAME_TO_WORLD_RATIO = 1 / 16;

/** 게임 유닛 → R3F 월드 유닛 변환 */
export function toWorldUnits(gameUnits: number): number {
  return gameUnits * GAME_TO_WORLD_RATIO;
}

/**
 * 로비 프리뷰용 월드유닛 치수 테이블
 * VoxelCharacter에서 직접 사용
 */
export const LOBBY_DIMENSIONS = {
  head: {
    w: toWorldUnits(10),  // 0.625
    h: toWorldUnits(10),  // 0.625
    d: toWorldUnits(8),   // 0.5
  },
  body: {
    w: toWorldUnits(8),   // 0.5
    h: toWorldUnits(7),   // 0.4375
    d: toWorldUnits(5),   // 0.3125
  },
  arm: {
    w: toWorldUnits(4),   // 0.25
    h: toWorldUnits(7),   // 0.4375
    d: toWorldUnits(4),   // 0.25
  },
  leg: {
    w: toWorldUnits(4),   // 0.25
    h: toWorldUnits(7),   // 0.4375
    d: toWorldUnits(4),   // 0.25
  },
} as const;

/**
 * 로비 프리뷰 Y 오프셋 (발바닥=0 기준, 월드유닛)
 * VoxelCharacter에서 각 파트 position.y에 사용
 */
export const LOBBY_OFFSETS = {
  /** 다리 상단 Y (= leg.h = 0.4375) */
  legTop: toWorldUnits(7),
  /** 몸통 중심 Y (= legTop + body.h/2) */
  bodyCenter: toWorldUnits(7) + toWorldUnits(7) / 2,
  /** 어깨 Y (= legTop + body.h) */
  shoulderY: toWorldUnits(7) + toWorldUnits(7),
  /** 머리 중심 Y (= shoulderY + head.h/2) */
  headCenter: toWorldUnits(7) + toWorldUnits(7) + toWorldUnits(10) / 2,
} as const;

// ─── BodyType별 스케일 적용 ───

/**
 * BodyType에 따른 스케일 적용된 파트 크기/오프셋 반환
 * 히트박스와 무관 (순수 코스메틱)
 */
export function getScaledParts(bodyType: BodyType): Record<PartName, PartSpec> {
  const scale = BODY_TYPE_SCALES[bodyType];
  const base = CUBELING_PARTS;

  // tall 타입은 body/leg 높이가 변해서 오프셋도 재계산 필요
  const bodyH = base.body.size[1] * scale.bodyH;
  const limbH = base.legL.size[1] * scale.limbH;

  // 오프셋 재계산: 발바닥 기준
  const legTopY = limbH;                   // 다리 top-center 피벗 Y
  const bodyCenterY = limbH + bodyH / 2;   // 몸통 center Y
  const shoulderY = limbH + bodyH;         // 어깨 Y
  const headCenterY = shoulderY + base.head.size[1] / 2; // 머리 center Y

  return {
    head: {
      size: [...base.head.size] as unknown as readonly [number, number, number],
      offset: [0, headCenterY, 0] as const,
      pivot: 'center',
    },
    body: {
      size: [
        base.body.size[0] * scale.bodyW,
        bodyH,
        base.body.size[2],
      ] as unknown as readonly [number, number, number],
      offset: [0, bodyCenterY, 0] as const,
      pivot: 'center',
    },
    armL: {
      size: [
        base.armL.size[0] * scale.armW,
        limbH,
        base.armL.size[2],
      ] as unknown as readonly [number, number, number],
      offset: [
        -(base.body.size[0] * scale.bodyW / 2 + base.armL.size[0] * scale.armW / 2),
        shoulderY,
        0,
      ] as const,
      pivot: 'top-center',
    },
    armR: {
      size: [
        base.armR.size[0] * scale.armW,
        limbH,
        base.armR.size[2],
      ] as unknown as readonly [number, number, number],
      offset: [
        base.body.size[0] * scale.bodyW / 2 + base.armR.size[0] * scale.armW / 2,
        shoulderY,
        0,
      ] as const,
      pivot: 'top-center',
    },
    legL: {
      size: [
        base.legL.size[0] * scale.legW,
        limbH,
        base.legL.size[2],
      ] as unknown as readonly [number, number, number],
      offset: [
        -(base.legL.size[0] * scale.legW / 2),
        legTopY,
        0,
      ] as const,
      pivot: 'top-center',
    },
    legR: {
      size: [
        base.legR.size[0] * scale.legW,
        limbH,
        base.legR.size[2],
      ] as unknown as readonly [number, number, number],
      offset: [
        base.legR.size[0] * scale.legW / 2,
        legTopY,
        0,
      ] as const,
      pivot: 'top-center',
    },
  };
}

// ─── Mass 기반 비대칭 스케일 ───

/**
 * mass 기반 비대칭 스케일 계산
 * 머리는 천천히, 몸통은 빠르게 성장 → "통통한 전사" 느낌
 *
 * mass=10  → head 1.0,  body 1.0
 * mass=50  → head 1.35, body 1.70
 * mass=100 → head 1.49, body 1.99
 */
export function getAsymmetricScale(mass: number): {
  headScale: number;
  bodyScale: number;
  baseScale: number;
} {
  if (mass <= 0) {
    return { headScale: 1.0, bodyScale: 1.0, baseScale: 1.0 };
  }
  const log = Math.log2(Math.max(1, mass / 10));
  return {
    baseScale: 1.0 + log * 0.25,
    headScale: 1.0 + log * 0.15,
    bodyScale: 1.0 + log * 0.30,
  };
}
