/**
 * game/rendering/characters/animation.ts - 캐릭터 애니메이션
 */

import type { AnimationState } from './types';
import { WALK_PERIOD, IDLE_PERIOD, BREATHE_PERIOD } from './constants';
import { easeInOutCubic, easeInOutQuad } from './utils';

export interface AnimationInput {
  isMoving: boolean;
  time: number;
  dir: number;
  speedMult?: number;
}

/**
 * 걷기 애니메이션 계산 (3등신 김도하/김도연 스타일)
 * - 다리 스윙: 25° (3등신 적합)
 * - 팔 스윙: 15° (다리와 반대로)
 * - 바운스: 0.8 (탄탄한 느낌)
 * - 걸음 주기: 600ms
 */
export function calculateWalkAnimation(time: number, speedMult: number = 1): Partial<AnimationState> {
  const walkProgress = (time % WALK_PERIOD) / WALK_PERIOD;
  const easedProgress = easeInOutCubic(walkProgress);
  const walkAngle = easedProgress * Math.PI * 2;

  // 다리: 3등신 비율 (25°)
  const legAngleL = Math.sin(walkAngle) * 25;
  const legAngleR = Math.sin(walkAngle + Math.PI) * 25;

  // 팔: 다리와 반대로, 더 작은 움직임 (15°)
  const armAngleL = Math.sin(walkAngle + Math.PI) * 15;
  const armAngleR = Math.sin(walkAngle) * 15;

  // 몸통: 미세한 기울임
  const bodyRotate = Math.sin(walkAngle) * 2;

  // 바운스: 3등신에 맞게 (0.8)
  const bounceY = Math.abs(Math.sin(walkAngle)) * 0.8;

  // Speed Boost Visual
  let scaleX = 1;
  let scaleY = 1;
  if (speedMult > 1.0) {
    const boostLevel = Math.min((speedMult - 1) / 0.5, 1);
    scaleX = 1 + boostLevel * 0.08;
    scaleY = 1 - boostLevel * 0.04;
  }

  return {
    bounceY,
    legAngleL,
    legAngleR,
    armAngleL,
    armAngleR,
    bodyRotate,
    scaleX,
    scaleY,
    eyeOffsetX: 0,
    headRotate: 0,
  };
}

/**
 * Idle 애니메이션 계산 (3등신 김도하/김도연 스타일)
 * - 호흡 진폭: 0.008 (자연스러운 정도)
 * - 바운스: 0.3 (미세한 움직임)
 */
export function calculateIdleAnimation(time: number): Partial<AnimationState> {
  const idleProgress = time % IDLE_PERIOD;
  const breatheCycle = (time / BREATHE_PERIOD) * Math.PI * 2;
  const breathe = Math.sin(breatheCycle);

  // 호흡: 3등신 진폭 (0.008)
  const scaleY = 1 + breathe * 0.008;
  const bounceY = breathe * 0.3;

  // 팔: 자연스럽게 내림
  const armAngleL = 2 + breathe * 0.5;
  const armAngleR = -2 - breathe * 0.5;

  // 다리: 미세한 체중 이동
  const weightShift = Math.sin(breatheCycle * 0.3) * 0.8;
  const legAngleL = weightShift;
  const legAngleR = -weightShift;

  // 몸통 회전 제거 (3등신은 idle에서 안 움직임)
  const bodyRotate = 0;

  // 8초 루프: 눈동자로 주변 둘러보기
  const maxEyeOffset = 0.6;
  const maxHeadRotate = 5;

  let eyeOffsetX = 0;
  let headRotate = 0;

  if (idleProgress < 4000) {
    // 0-4초: 정면
    eyeOffsetX = 0;
    headRotate = 0;
  } else if (idleProgress < 5000) {
    // 4-5초: 왼쪽으로
    const lookProgress = (idleProgress - 4000) / 1000;
    const easedLook = easeInOutQuad(lookProgress);
    eyeOffsetX = -easedLook * maxEyeOffset;
    headRotate = -easedLook * maxHeadRotate;
  } else if (idleProgress < 6000) {
    // 5-6초: 왼쪽 유지
    eyeOffsetX = -maxEyeOffset;
    headRotate = -maxHeadRotate;
  } else if (idleProgress < 7000) {
    // 6-7초: 오른쪽으로
    const lookProgress = (idleProgress - 6000) / 1000;
    const easedLook = easeInOutQuad(lookProgress);
    eyeOffsetX = -maxEyeOffset + easedLook * maxEyeOffset * 2;
    headRotate = -maxHeadRotate + easedLook * maxHeadRotate * 2;
  } else if (idleProgress < 7500) {
    // 7-7.5초: 오른쪽 유지
    eyeOffsetX = maxEyeOffset;
    headRotate = maxHeadRotate;
  } else {
    // 7.5-8초: 정면 복귀
    const returnProgress = (idleProgress - 7500) / 500;
    const easedReturn = easeInOutQuad(returnProgress);
    eyeOffsetX = maxEyeOffset * (1 - easedReturn);
    headRotate = maxHeadRotate * (1 - easedReturn);
  }

  return {
    bounceY,
    legAngleL,
    legAngleR,
    armAngleL,
    armAngleR,
    bodyRotate,
    scaleX: 1,
    scaleY,
    eyeOffsetX,
    headRotate,
  };
}

/**
 * 애니메이션 상태 계산
 */
export function calculateAnimationState(input: AnimationInput): AnimationState {
  const baseState: AnimationState = {
    isMoving: input.isMoving,
    time: input.time,
    dir: input.dir,
    bounceY: 0,
    legAngleL: 0,
    legAngleR: 0,
    armAngleL: 0,
    armAngleR: 0,
    bodyRotate: 0,
    scaleX: 1,
    scaleY: 1,
    eyeOffsetX: 0,
    headRotate: 0,
  };

  if (input.isMoving) {
    return { ...baseState, ...calculateWalkAnimation(input.time, input.speedMult) };
  } else {
    return { ...baseState, ...calculateIdleAnimation(input.time) };
  }
}
