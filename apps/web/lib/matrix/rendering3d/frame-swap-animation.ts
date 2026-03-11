/**
 * frame-swap-animation.ts — Frame Swap 애니메이션 시스템 (S15)
 *
 * BoxGeometry 기반 voxel 캐릭터의 프레임별 파트 위치/스케일/회전 변형으로
 * 4가지 액션 애니메이션을 시뮬레이션합니다.
 *
 * 4 Actions:
 * - idle: 2프레임 — 미세한 상하 bobbing
 * - walk: 4프레임 — 다리/팔 교차 swing + 몸통 살짝 기울기
 * - hit:  2프레임 — 빠른 수축 + 복귀 (피격 반응)
 * - death: 3프레임 — 넘어지는 모션 (회전 + 스케일 다운)
 *
 * Frame Swap 방식: 각 프레임마다 파트의 position/rotation/scale을 직접 설정
 * (skeleton animation 대신 discrete pose 전환)
 */

import * as THREE from 'three';
import type { CharacterParts } from './character-models';
import {
  LEG_HEIGHT,
  BODY_HEIGHT,
  HEAD_SIZE,
  BODY_WIDTH,
  ARM_WIDTH,
  LEG_WIDTH,
  LEG_GAP,
} from './character-models';

// ============================================
// 애니메이션 타입 정의
// ============================================

/** 애니메이션 액션 타입 */
export type AnimationAction = 'idle' | 'walk' | 'hit' | 'death';

/** 파트별 트랜스폼 오프셋 (기본 포즈 대비 delta) */
export interface PartTransform {
  /** 위치 오프셋 (기본 포즈 대비) */
  positionOffset: THREE.Vector3;
  /** 회전 (absolute, 라디안) */
  rotation: THREE.Euler;
  /** 스케일 (absolute) */
  scale: THREE.Vector3;
}

/** 단일 프레임의 전체 파트 포즈 */
export interface AnimationFrame {
  head: PartTransform;
  body: PartTransform;
  leftLeg: PartTransform;
  rightLeg: PartTransform;
  leftArm: PartTransform;
  rightArm: PartTransform;
}

/** 애니메이션 클립 정의 */
export interface AnimationClip {
  /** 액션 이름 */
  action: AnimationAction;
  /** 프레임 배열 */
  frames: AnimationFrame[];
  /** 프레임당 지속 시간 (ms) */
  frameDuration: number;
  /** 반복 여부 */
  loop: boolean;
}

// ============================================
// 기본 포즈 위치 (createBaseCharacterGeometry 기준)
// ============================================

const legCenterY = LEG_HEIGHT / 2;
const bodyCenterY = LEG_HEIGHT + BODY_HEIGHT / 2;
const headCenterY = LEG_HEIGHT + BODY_HEIGHT + HEAD_SIZE / 2;
const leftLegX = -(LEG_WIDTH / 2 + LEG_GAP / 2);
const rightLegX = LEG_WIDTH / 2 + LEG_GAP / 2;
const leftArmX = -(BODY_WIDTH / 2 + ARM_WIDTH / 2);
const rightArmX = BODY_WIDTH / 2 + ARM_WIDTH / 2;

// ============================================
// 기본 트랜스폼 헬퍼
// ============================================

/** 변형 없는 기본 파트 트랜스폼 */
function defaultTransform(): PartTransform {
  return {
    positionOffset: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
  };
}

/** 기본 포즈 프레임 (모든 파트가 기본 위치) */
function defaultFrame(): AnimationFrame {
  return {
    head: defaultTransform(),
    body: defaultTransform(),
    leftLeg: defaultTransform(),
    rightLeg: defaultTransform(),
    leftArm: defaultTransform(),
    rightArm: defaultTransform(),
  };
}

// ============================================
// Idle 애니메이션 (2프레임, ~1200ms)
// ============================================

function createIdleFrames(): AnimationFrame[] {
  // 프레임 0: 약간 위로
  const f0 = defaultFrame();
  f0.head.positionOffset.y = 0.04;
  f0.body.positionOffset.y = 0.02;
  f0.leftArm.positionOffset.y = 0.01;
  f0.rightArm.positionOffset.y = 0.01;

  // 프레임 1: 약간 아래로 (breathing effect)
  const f1 = defaultFrame();
  f1.head.positionOffset.y = -0.02;
  f1.body.positionOffset.y = -0.01;
  f1.leftArm.positionOffset.y = -0.01;
  f1.rightArm.positionOffset.y = -0.01;

  return [f0, f1];
}

// ============================================
// Walk 애니메이션 (4프레임, ~600ms)
// ============================================

function createWalkFrames(): AnimationFrame[] {
  const swingAngle = 0.5; // 다리 스윙 각도 (라디안)
  const armSwing = 0.4;   // 팔 스윙 각도
  const bobHeight = 0.06; // 상하 바운스 높이

  // 프레임 0: 왼발 앞, 오른발 뒤 (contact)
  const f0 = defaultFrame();
  f0.leftLeg.rotation.x = -swingAngle;
  f0.rightLeg.rotation.x = swingAngle;
  f0.leftArm.rotation.x = armSwing;
  f0.rightArm.rotation.x = -armSwing;
  f0.body.positionOffset.y = bobHeight;
  f0.head.positionOffset.y = bobHeight;

  // 프레임 1: 양발 모아짐 (passing, 위로)
  const f1 = defaultFrame();
  f1.leftLeg.rotation.x = 0;
  f1.rightLeg.rotation.x = 0;
  f1.leftArm.rotation.x = 0;
  f1.rightArm.rotation.x = 0;
  f1.body.positionOffset.y = bobHeight * 2;
  f1.head.positionOffset.y = bobHeight * 2;

  // 프레임 2: 오른발 앞, 왼발 뒤 (contact)
  const f2 = defaultFrame();
  f2.leftLeg.rotation.x = swingAngle;
  f2.rightLeg.rotation.x = -swingAngle;
  f2.leftArm.rotation.x = -armSwing;
  f2.rightArm.rotation.x = armSwing;
  f2.body.positionOffset.y = bobHeight;
  f2.head.positionOffset.y = bobHeight;

  // 프레임 3: 양발 모아짐 (passing, 위로)
  const f3 = defaultFrame();
  f3.leftLeg.rotation.x = 0;
  f3.rightLeg.rotation.x = 0;
  f3.leftArm.rotation.x = 0;
  f3.rightArm.rotation.x = 0;
  f3.body.positionOffset.y = bobHeight * 2;
  f3.head.positionOffset.y = bobHeight * 2;

  return [f0, f1, f2, f3];
}

// ============================================
// Hit 애니메이션 (2프레임, ~300ms)
// ============================================

function createHitFrames(): AnimationFrame[] {
  // 프레임 0: 피격 수축 (뒤로 살짝 밀리는 느낌)
  const f0 = defaultFrame();
  f0.body.positionOffset.z = 0.15;
  f0.head.positionOffset.z = 0.2;
  f0.body.scale.set(0.9, 1.05, 0.9);
  f0.head.scale.set(1.05, 0.95, 1.05);
  f0.leftArm.rotation.x = -0.3;
  f0.rightArm.rotation.x = -0.3;
  f0.leftArm.positionOffset.z = 0.1;
  f0.rightArm.positionOffset.z = 0.1;

  // 프레임 1: 복귀 (기본 포즈로)
  const f1 = defaultFrame();

  return [f0, f1];
}

// ============================================
// Death 애니메이션 (3프레임, ~600ms, 비반복)
// ============================================

function createDeathFrames(): AnimationFrame[] {
  // 프레임 0: 무릎 꿇기
  const f0 = defaultFrame();
  f0.body.positionOffset.y = -0.2;
  f0.head.positionOffset.y = -0.15;
  f0.leftLeg.rotation.x = -0.6;
  f0.rightLeg.rotation.x = -0.6;
  f0.leftArm.rotation.x = 0.3;
  f0.rightArm.rotation.x = 0.3;

  // 프레임 1: 앞으로 쓰러지기 시작
  const f1 = defaultFrame();
  f1.body.rotation.x = 0.8;
  f1.body.positionOffset.y = -0.5;
  f1.head.rotation.x = 0.6;
  f1.head.positionOffset.y = -0.4;
  f1.head.positionOffset.z = 0.3;
  f1.leftArm.rotation.x = 1.0;
  f1.rightArm.rotation.x = 1.0;
  f1.body.scale.set(1, 0.9, 1);

  // 프레임 2: 완전히 쓰러진 상태
  const f2 = defaultFrame();
  f2.body.rotation.x = Math.PI / 2;
  f2.body.positionOffset.y = -0.8;
  f2.body.positionOffset.z = 0.5;
  f2.head.rotation.x = Math.PI / 2;
  f2.head.positionOffset.y = -0.9;
  f2.head.positionOffset.z = 0.8;
  f2.leftArm.rotation.x = Math.PI / 2;
  f2.rightArm.rotation.x = Math.PI / 2;
  f2.leftLeg.rotation.x = 0;
  f2.rightLeg.rotation.x = 0;
  f2.body.scale.set(1, 0.8, 1);
  f2.head.scale.set(0.9, 0.9, 0.9);

  return [f0, f1, f2];
}

// ============================================
// 애니메이션 클립 레지스트리
// ============================================

/** 모든 애니메이션 클립 */
export const ANIMATION_CLIPS: Record<AnimationAction, AnimationClip> = {
  idle: {
    action: 'idle',
    frames: createIdleFrames(),
    frameDuration: 600, // 1200ms 주기 (2프레임)
    loop: true,
  },
  walk: {
    action: 'walk',
    frames: createWalkFrames(),
    frameDuration: 150, // 600ms 주기 (4프레임)
    loop: true,
  },
  hit: {
    action: 'hit',
    frames: createHitFrames(),
    frameDuration: 150, // 300ms (2프레임)
    loop: false,
  },
  death: {
    action: 'death',
    frames: createDeathFrames(),
    frameDuration: 200, // 600ms (3프레임)
    loop: false,
  },
};

// ============================================
// AnimationController
// ============================================

/** 애니메이션 컨트롤러 — 프레임 타이밍에 맞춰 pose 변경 */
export class AnimationController {
  /** 현재 재생 중인 액션 */
  private currentAction: AnimationAction = 'idle';
  /** 현재 프레임 인덱스 */
  private currentFrame = 0;
  /** 프레임 누적 시간 (ms) */
  private elapsed = 0;
  /** 애니메이션 완료 여부 (non-loop) */
  private finished = false;
  /** 이전 프레임 포즈 (보간용) */
  private prevFrameIndex = 0;
  /** 프레임 간 보간 진행도 (0-1) */
  private lerpFactor = 0;

  /** 현재 액션 가져오기 */
  get action(): AnimationAction {
    return this.currentAction;
  }

  /** 애니메이션 완료 여부 */
  get isFinished(): boolean {
    return this.finished;
  }

  /** 현재 프레임 인덱스 */
  get frameIndex(): number {
    return this.currentFrame;
  }

  /**
   * play — 새 애니메이션 재생 시작
   * 이미 같은 액션이면 무시 (리셋하려면 forceRestart=true)
   */
  play(action: AnimationAction, forceRestart = false): void {
    if (this.currentAction === action && !forceRestart && !this.finished) return;
    this.currentAction = action;
    this.currentFrame = 0;
    this.prevFrameIndex = 0;
    this.elapsed = 0;
    this.finished = false;
    this.lerpFactor = 0;
  }

  /**
   * update — 프레임 타이밍 업데이트
   * @param deltaMs 경과 시간 (밀리초)
   */
  update(deltaMs: number): void {
    if (this.finished) return;

    const clip = ANIMATION_CLIPS[this.currentAction];
    if (!clip) return;

    this.elapsed += deltaMs;
    const { frames, frameDuration, loop } = clip;

    // 프레임 간 보간 진행도 계산
    this.lerpFactor = Math.min(this.elapsed / frameDuration, 1);

    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      this.prevFrameIndex = this.currentFrame;
      this.currentFrame++;

      if (this.currentFrame >= frames.length) {
        if (loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = frames.length - 1;
          this.finished = true;
        }
      }
      this.lerpFactor = 0;
    }
  }

  /**
   * applyPose — 캐릭터 파트에 현재 프레임 포즈 적용
   * 부드러운 전환을 위해 이전 프레임과 현재 프레임 사이를 보간
   */
  applyPose(parts: CharacterParts): void {
    const clip = ANIMATION_CLIPS[this.currentAction];
    if (!clip) return;

    const { frames } = clip;
    const currFrame = frames[this.currentFrame];
    const prevFrame = frames[this.prevFrameIndex];

    if (!currFrame) return;

    const t = this.lerpFactor;

    // 각 파트에 보간된 트랜스폼 적용
    this.applyPartTransform(parts.head, prevFrame.head, currFrame.head, t, 0, headCenterY, 0);
    this.applyPartTransform(parts.body, prevFrame.body, currFrame.body, t, 0, bodyCenterY, 0);
    this.applyPartTransform(parts.leftLeg, prevFrame.leftLeg, currFrame.leftLeg, t, leftLegX, legCenterY, 0);
    this.applyPartTransform(parts.rightLeg, prevFrame.rightLeg, currFrame.rightLeg, t, rightLegX, legCenterY, 0);
    this.applyPartTransform(parts.leftArm, prevFrame.leftArm, currFrame.leftArm, t, leftArmX, bodyCenterY, 0);
    this.applyPartTransform(parts.rightArm, prevFrame.rightArm, currFrame.rightArm, t, rightArmX, bodyCenterY, 0);
  }

  /** 개별 파트에 보간된 트랜스폼 적용 */
  private applyPartTransform(
    mesh: THREE.Mesh,
    from: PartTransform,
    to: PartTransform,
    t: number,
    baseX: number,
    baseY: number,
    baseZ: number,
  ): void {
    // Position (기본 위치 + offset 보간)
    mesh.position.x = baseX + THREE.MathUtils.lerp(from.positionOffset.x, to.positionOffset.x, t);
    mesh.position.y = baseY + THREE.MathUtils.lerp(from.positionOffset.y, to.positionOffset.y, t);
    mesh.position.z = baseZ + THREE.MathUtils.lerp(from.positionOffset.z, to.positionOffset.z, t);

    // Rotation (보간)
    mesh.rotation.x = THREE.MathUtils.lerp(from.rotation.x, to.rotation.x, t);
    mesh.rotation.y = THREE.MathUtils.lerp(from.rotation.y, to.rotation.y, t);
    mesh.rotation.z = THREE.MathUtils.lerp(from.rotation.z, to.rotation.z, t);

    // Scale (보간)
    mesh.scale.x = THREE.MathUtils.lerp(from.scale.x, to.scale.x, t);
    mesh.scale.y = THREE.MathUtils.lerp(from.scale.y, to.scale.y, t);
    mesh.scale.z = THREE.MathUtils.lerp(from.scale.z, to.scale.z, t);
  }
}
