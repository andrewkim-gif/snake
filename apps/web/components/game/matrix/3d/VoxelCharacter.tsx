'use client';

/**
 * VoxelCharacter.tsx — 인게임 전용 캐릭터 (로비 분리, 직접 렌더링)
 *
 * 로비 VoxelCharacter 의존 제거 → 직접 body parts 렌더링
 * - MeshStandardMaterial (PBR) — 지형과 시각적 차별화
 * - 스케일 5x — 지형 위에서 명확히 보임
 * - velocity 기반 walk animation (팔/다리 swing)
 * - Drop shadow (발 아래 반투명 원형)
 * - Emissive rim (약한 자체발광)
 * - Death: 절대값 Y 설정 (무한 하강 버그 수정)
 * - 부활 시 자동 리셋
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, terrainH, -y)
 * useFrame priority=0 필수
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player, PlayerClass } from '@/lib/matrix/types';
import { getClassScale } from '@/lib/matrix/rendering3d/character-config';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';
import { getAgentTextures, getHeadMaterials } from '@/lib/3d/agent-textures';
import { LOBBY_DIMENSIONS, LOBBY_OFFSETS } from '@/lib/3d/cubeling-proportions';

// ============================================
// 게임 상수
// ============================================

/** Hit flash 지속 시간 (초) */
const HIT_FLASH_DURATION = 0.15;
/** 이동 속도 임계값 (이하면 idle) */
const MOVE_THRESHOLD = 0.5;
/** facing angle LERP 속도 */
const FACING_LERP_SPEED = 15;
/** 캐릭터 외부 스케일 (MC 블록 스케일: 1 block = 1 unit) */
const CHARACTER_SCALE = 1.0;

/**
 * 카메라 facing 보정 각도
 * FPS 모드: 보정 없음 (PointerLockControls 기준)
 */
const CAMERA_FACING_OFFSET = 0;

// ============================================
// RenderOrder 상수
// ============================================

export const RENDER_ORDER_LOWER = 1;
export const RENDER_ORDER_EFFECTS = 2;
export const RENDER_ORDER_UPPER = 3;

// ============================================
// 클래스별 skinId 매핑
// ============================================

const CLASS_SKIN_MAP: Record<string, number> = {
  neo: 0, cipher: 1, phantom: 2, sentinel: 3,
  berserker: 4, oracle: 5, architect: 6, virus: 7, glitch: 8,
};

// ============================================
// 큐블링 치수 (cubeling-proportions에서 가져옴)
// ============================================

const HEAD = LOBBY_DIMENSIONS.head;
const BODY = LOBBY_DIMENSIONS.body;
const ARM = LOBBY_DIMENSIONS.arm;
const LEG = LOBBY_DIMENSIONS.leg;

const LEG_TOP = LOBBY_OFFSETS.legTop;
const BODY_CENTER = LOBBY_OFFSETS.bodyCenter;
const SHOULDER_Y = LOBBY_OFFSETS.shoulderY;
const HEAD_CENTER = LOBBY_OFFSETS.headCenter;

// ============================================
// Props
// ============================================

export interface VoxelCharacterProps {
  playerRef: React.MutableRefObject<Player>;
  playerClass?: PlayerClass;
  visible?: boolean;
}

// ============================================
// VoxelCharacter Component (인게임 전용)
// ============================================

export function VoxelCharacter({
  playerRef,
  playerClass = 'neo',
  visible = true,
}: VoxelCharacterProps) {
  // refs
  const outerGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  // 상태 refs
  const hitFlashTimerRef = useRef(0);
  const prevHitFlashRef = useRef(0);
  const currentFacingRef = useRef(CAMERA_FACING_OFFSET);
  const deathTimerRef = useRef(0);
  const isDeadRef = useRef(false);

  const skinId = CLASS_SKIN_MAP[playerClass] ?? 0;
  const classScale = getClassScale(playerClass);

  // 텍스처 생성 (한 번만)
  const textures = useMemo(() => getAgentTextures(skinId), [skinId]);
  const headMats = useMemo(() => getHeadMaterials(skinId), [skinId]);

  // MeshStandardMaterial — PBR, 지형과 시각적 차별화
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: textures.body, roughness: 0.6, metalness: 0.05,
    emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.08,
  }), [textures]);
  const armMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: textures.arm, roughness: 0.6, metalness: 0.05,
    emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.08,
  }), [textures]);
  const legMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: textures.leg, roughness: 0.6, metalness: 0.05,
    emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.08,
  }), [textures]);

  // head materials에 emissive rim 추가
  const headStdMats = useMemo(() => {
    for (const mat of headMats) {
      mat.emissive = new THREE.Color('#ffffff');
      mat.emissiveIntensity = 0.08;
    }
    return headMats;
  }, [headMats]);

  // 피벗 조정 geometry (어깨/엉덩이 기준 회전)
  const armGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(ARM.w, ARM.h, ARM.d);
    geo.translate(0, -ARM.h / 2, 0);
    return geo;
  }, []);

  const legGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(LEG.w, LEG.h, LEG.d);
    geo.translate(0, -LEG.h / 2, 0);
    return geo;
  }, []);

  // 전체 MeshStandardMaterial 배열 (hit flash 용)
  const allMats = useMemo(() => [bodyMat, armMat, legMat, ...headStdMats], [bodyMat, armMat, legMat, headStdMats]);

  // ============================================
  // useFrame — 매 프레임 업데이트
  // ============================================

  useFrame((_state, delta) => {
    const outer = outerGroupRef.current;
    if (!outer) return;
    const player = playerRef.current;

    // --- 1. Position: 직접 복사 + 보간 (MC FPS: y→z 직접 매핑) ---
    const targetX = player.position.x;
    const targetZ = player.position.y;
    const posFactor = 1 - Math.exp(-25 * delta);
    outer.position.x += (targetX - outer.position.x) * posFactor;
    outer.position.z += (targetZ - outer.position.z) * posFactor;

    // height3d가 있으면 점프/비행 높이 사용, 없으면 지형 높이 fallback
    const targetY = player.height3d != null
      ? player.height3d
      : getMCTerrainHeight(outer.position.x, outer.position.z) + 1;
    outer.position.y += (targetY - outer.position.y) * posFactor;

    // --- 2. 스케일 (5x * classScale) ---
    outer.scale.setScalar(CHARACTER_SCALE * classScale);

    // --- 3. Facing (velocity 기반 + 카메라 보정) ---
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > MOVE_THRESHOLD) {
      const velocityAngle = Math.atan2(vx, vy);
      const targetAngle = velocityAngle + CAMERA_FACING_OFFSET;
      let diff = targetAngle - currentFacingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const facingFactor = 1 - Math.exp(-FACING_LERP_SPEED * delta);
      currentFacingRef.current += diff * facingFactor;
    }
    outer.rotation.y = currentFacingRef.current;

    // --- 4. Walk Animation (velocity 기반) ---
    const inner = innerGroupRef.current;
    if (inner && speed > MOVE_THRESHOLD) {
      // 걷기: 팔/다리 교차 swing + bounce
      const walkFreq = 8.0; // 빠른 걷기 주기
      const t = _state.clock.elapsedTime * walkFreq;
      const swingArm = Math.sin(t) * 0.5;
      const swingLeg = Math.sin(t) * 0.4;

      if (leftArmRef.current) leftArmRef.current.rotation.x = swingArm;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -swingArm;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -swingLeg;
      if (rightLegRef.current) rightLegRef.current.rotation.x = swingLeg;

      // 바운스 (살짝 위아래)
      inner.position.y = Math.abs(Math.cos(t)) * 0.015;
    } else if (inner) {
      // idle: 호흡 애니메이션
      const t = _state.clock.elapsedTime;
      const armSwing = Math.sin(t * 1.5) * 0.25;
      if (leftArmRef.current) leftArmRef.current.rotation.x = armSwing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -armSwing;
      const legSwing = Math.sin(t * 1.5) * 0.18;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -legSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = legSwing;
      inner.position.y = 0;
    }

    // head look around (idle 전용)
    if (headRef.current) {
      const t = _state.clock.elapsedTime;
      if (speed <= MOVE_THRESHOLD) {
        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.2;
        headRef.current.position.y = HEAD_CENTER + Math.sin(t * 0.8) * 0.02;
      } else {
        headRef.current.rotation.y = 0;
        headRef.current.position.y = HEAD_CENTER;
      }
    }

    // --- 5. Death 처리 (절대값 Y — 무한 하강 버그 수정) ---
    const isAlive = player.health > 0;
    if (!isAlive && !isDeadRef.current) {
      isDeadRef.current = true;
      deathTimerRef.current = 0;
    }
    if (isDeadRef.current) {
      if (isAlive) {
        // 부활: 즉시 리셋
        isDeadRef.current = false;
        deathTimerRef.current = 0;
        outer.rotation.x = 0;
      } else {
        deathTimerRef.current += delta;
        const p = Math.min(deathTimerRef.current / 0.8, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        // 기울기 (쓰러짐)
        outer.rotation.x = (Math.PI / 2.5) * eased;
        // 절대값 Y: 현재 높이 - 오프셋 (누적 감산 아님!)
        const deathBaseY = getMCTerrainHeight(outer.position.x, outer.position.z) + 1;
        outer.position.y = deathBaseY - 0.5 * eased;
      }
    } else {
      outer.rotation.x = 0;
    }

    // --- 6. Hit Flash Effect ---
    const isNewHit = player.hitFlashTimer > 0 && prevHitFlashRef.current <= 0;
    prevHitFlashRef.current = player.hitFlashTimer;

    if (isNewHit) {
      hitFlashTimerRef.current = HIT_FLASH_DURATION;
    }

    if (hitFlashTimerRef.current > 0) {
      hitFlashTimerRef.current -= delta;
      const flashT = Math.max(0, hitFlashTimerRef.current / HIT_FLASH_DURATION);
      for (const mat of allMats) {
        mat.emissive.set('#ff4444');
        mat.emissiveIntensity = flashT * 2.0;
      }
    } else {
      for (const mat of allMats) {
        if (mat.emissiveIntensity > 0.08 + 0.01) {
          // 기본 emissive rim으로 복귀
          mat.emissive.set('#ffffff');
          mat.emissiveIntensity = 0.08;
        }
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={outerGroupRef}>
      {/* Drop Shadow — 발 아래 반투명 원형 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* 캐릭터 본체 (inner group — walk bounce용) */}
      <group ref={innerGroupRef}>
        {/* Body */}
        <mesh position={[0, BODY_CENTER, 0]} material={bodyMat}>
          <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
        </mesh>

        {/* Head — 6-face MeshStandardMaterial */}
        <mesh ref={headRef} position={[0, HEAD_CENTER, 0]} material={headStdMats}>
          <boxGeometry args={[HEAD.w, HEAD.h, HEAD.d]} />
        </mesh>

        {/* Left Arm — 어깨 피벗 */}
        <mesh
          ref={leftArmRef}
          position={[-(BODY.w / 2 + ARM.w / 2), SHOULDER_Y, 0]}
          geometry={armGeo}
          material={armMat}
        />

        {/* Right Arm — 어깨 피벗 */}
        <mesh
          ref={rightArmRef}
          position={[BODY.w / 2 + ARM.w / 2, SHOULDER_Y, 0]}
          geometry={armGeo}
          material={armMat}
        />

        {/* Left Leg — 엉덩이 피벗 */}
        <mesh
          ref={leftLegRef}
          position={[-LEG.w / 2, LEG_TOP, 0]}
          geometry={legGeo}
          material={legMat}
        />

        {/* Right Leg — 엉덩이 피벗 */}
        <mesh
          ref={rightLegRef}
          position={[LEG.w / 2, LEG_TOP, 0]}
          geometry={legGeo}
          material={legMat}
        />
      </group>
    </group>
  );
}

export default VoxelCharacter;
