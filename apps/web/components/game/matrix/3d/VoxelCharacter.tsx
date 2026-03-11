'use client';

/**
 * VoxelCharacter.tsx — 3D Voxel 캐릭터 렌더러 (S16 + S18)
 *
 * R3F 컴포넌트: BoxGeometry 기반 3-head chibi 캐릭터 렌더링
 * - position 동기화 (gameRefs.player → mesh.position)
 * - Frame swap animation controller (useFrame에서 프레임 전환)
 * - 8방향 facing: velocity 기반 model.rotation.y 계산
 * - Hit flash effect (material emissive 변경)
 * - Upper/Lower body 분리 렌더링 (renderOrder 활용, S18)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player, PlayerClass } from '@/lib/matrix/types';
import {
  createBaseCharacterGeometry,
  updateCharacterColors,
  disposeCharacter,
  type CharacterParts,
  type CharacterColors,
} from '@/lib/matrix/rendering3d/character-models';
import { getClassColors, getClassScale } from '@/lib/matrix/rendering3d/character-config';
import { AnimationController } from '@/lib/matrix/rendering3d/frame-swap-animation';
import type { SkinColorOverride } from '@/lib/matrix/rendering3d/skin-system';

// ============================================
// Constants
// ============================================

/** Hit flash 지속 시간 (초) */
const HIT_FLASH_DURATION = 0.15;

/** Hit flash emissive 색상 */
const HIT_FLASH_COLOR = new THREE.Color('#ff4444');

/** Hit flash emissive 강도 */
const HIT_FLASH_INTENSITY = 2.0;

/** 이동 속도 임계값 (이하면 idle 상태) */
const MOVE_THRESHOLD = 0.5;

/** facing angle LERP 속도 (0-1, 클수록 빠름) */
const FACING_LERP = 0.15;

// ============================================
// RenderOrder 상수 (S18: Split Rendering)
// ============================================

/** 하체 renderOrder (스킬 이펙트 아래) */
export const RENDER_ORDER_LOWER = 1;

/** 스킬 이펙트 renderOrder (하체와 상체 사이) */
export const RENDER_ORDER_EFFECTS = 2;

/** 상체 renderOrder (스킬 이펙트 위) */
export const RENDER_ORDER_UPPER = 3;

// ============================================
// Props
// ============================================

export interface VoxelCharacterProps {
  /** 플레이어 상태 ref */
  playerRef: React.MutableRefObject<Player>;
  /** 현재 클래스 (색상 결정) */
  playerClass?: PlayerClass;
  /** 스킨 색상 오버라이드 (skin-system에서 제공) */
  skinOverride?: SkinColorOverride | null;
  /** 캐릭터 표시 여부 */
  visible?: boolean;
}

// ============================================
// VoxelCharacter Component
// ============================================

export function VoxelCharacter({
  playerRef,
  playerClass = 'neo',
  skinOverride = null,
  visible = true,
}: VoxelCharacterProps) {
  // 전체 그룹 ref
  const groupRef = useRef<THREE.Group>(null);

  // 캐릭터 파트 ref
  const partsRef = useRef<CharacterParts | null>(null);

  // 애니메이션 컨트롤러
  const animController = useRef(new AnimationController());

  // 이전 상태 추적
  const prevClassRef = useRef<PlayerClass>(playerClass);
  const prevHitFlashRef = useRef(0);
  const currentFacingRef = useRef(0); // 현재 보간된 facing angle

  // Hit flash 타이머
  const hitFlashTimerRef = useRef(0);

  // ============================================
  // 캐릭터 파트 생성/업데이트
  // ============================================

  // 캐릭터 파트 초기 생성
  const characterParts = useMemo(() => {
    const colors = skinOverride
      ? skinOverrideToCharacterColors(skinOverride, playerClass)
      : getClassColors(playerClass);
    return createBaseCharacterGeometry(colors);
  }, []); // 초기 생성만, 이후 업데이트는 useEffect에서

  // 파트 ref 동기화
  useEffect(() => {
    partsRef.current = characterParts;

    // S18: renderOrder 설정 (Split Rendering)
    // 하체 파트: leftLeg, rightLeg
    characterParts.leftLeg.renderOrder = RENDER_ORDER_LOWER;
    characterParts.rightLeg.renderOrder = RENDER_ORDER_LOWER;

    // 상체 파트: head, body, leftArm, rightArm
    characterParts.head.renderOrder = RENDER_ORDER_UPPER;
    characterParts.body.renderOrder = RENDER_ORDER_UPPER;
    characterParts.leftArm.renderOrder = RENDER_ORDER_UPPER;
    characterParts.rightArm.renderOrder = RENDER_ORDER_UPPER;

    return () => {
      disposeCharacter(characterParts);
    };
  }, [characterParts]);

  // 클래스 변경 시 색상 업데이트
  useEffect(() => {
    if (!partsRef.current) return;
    if (prevClassRef.current === playerClass && !skinOverride) return;

    const colors = skinOverride
      ? skinOverrideToCharacterColors(skinOverride, playerClass)
      : getClassColors(playerClass);
    updateCharacterColors(partsRef.current, colors);
    prevClassRef.current = playerClass;
  }, [playerClass, skinOverride]);

  // ============================================
  // useFrame — 매 프레임 업데이트 (priority=0 필수)
  // ============================================

  useFrame((_, delta) => {
    if (!groupRef.current || !partsRef.current) return;

    const player = playerRef.current;
    const parts = partsRef.current;
    const deltaMs = delta * 1000;

    // --- 1. Position 동기화 (2D→3D 좌표 매핑) ---
    groupRef.current.position.x = player.position.x;
    groupRef.current.position.y = 0; // 지면
    groupRef.current.position.z = -player.position.y;

    // --- 2. 클래스 스케일 적용 ---
    const scale = getClassScale(playerClass);
    groupRef.current.scale.setScalar(scale);

    // --- 3. 8방향 Facing (velocity 기반 rotation.y) ---
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > MOVE_THRESHOLD) {
      // 2D velocity → 3D facing angle
      // 2D에서 (vx, vy), 3D에서 (vx, 0, -vy)
      const targetAngle = Math.atan2(vx, -vy);

      // 부드러운 회전 보간
      let diff = targetAngle - currentFacingRef.current;
      // -PI ~ PI 범위로 정규화
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      currentFacingRef.current += diff * FACING_LERP;

      groupRef.current.rotation.y = currentFacingRef.current;
    }

    // --- 4. 애니메이션 상태 결정 ---
    const isAlive = player.health > 0;
    const isHit = player.hitFlashTimer > 0 && prevHitFlashRef.current <= 0;

    if (!isAlive) {
      animController.current.play('death');
    } else if (isHit) {
      animController.current.play('hit', true);
      hitFlashTimerRef.current = HIT_FLASH_DURATION;
    } else if (animController.current.action === 'hit' && animController.current.isFinished) {
      // hit 완료 후 이전 상태로 복귀
      if (speed > MOVE_THRESHOLD) {
        animController.current.play('walk');
      } else {
        animController.current.play('idle');
      }
    } else if (animController.current.action !== 'hit' && animController.current.action !== 'death') {
      if (speed > MOVE_THRESHOLD) {
        animController.current.play('walk');
      } else {
        animController.current.play('idle');
      }
    }

    prevHitFlashRef.current = player.hitFlashTimer;

    // --- 5. 애니메이션 업데이트 + 포즈 적용 ---
    animController.current.update(deltaMs);
    animController.current.applyPose(parts);

    // --- 6. Hit Flash Effect ---
    if (hitFlashTimerRef.current > 0) {
      hitFlashTimerRef.current -= delta;
      const flashT = Math.max(0, hitFlashTimerRef.current / HIT_FLASH_DURATION);

      for (const mesh of parts.allMeshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.copy(HIT_FLASH_COLOR);
        mat.emissiveIntensity = flashT * HIT_FLASH_INTENSITY;
      }
    } else {
      // emissive 리셋
      for (const mesh of parts.allMeshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity > 0) {
          mat.emissiveIntensity = 0;
          mat.emissive.setScalar(0);
        }
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      <primitive object={characterParts.group} />
    </group>
  );
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * skinOverrideToCharacterColors — SkinColorOverride를 CharacterColors로 변환
 */
function skinOverrideToCharacterColors(
  override: SkinColorOverride,
  playerClass: PlayerClass
): CharacterColors {
  const base = getClassColors(playerClass);
  return {
    head: override.hair ?? base.head,
    body: override.body ?? base.body,
    legs: override.pants ?? base.legs,
    arms: override.body ?? base.arms,
    accent: override.accent ?? base.accent,
  };
}

export default VoxelCharacter;
