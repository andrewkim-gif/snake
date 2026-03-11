'use client';

/**
 * VoxelCharacter.tsx — 인게임 캐릭터 (로비 VoxelCharacter 래핑)
 *
 * 로비 VoxelCharacter 컴포넌트를 직접 재사용하되,
 * 인게임 전용 로직만 래퍼에서 처리:
 * - playerRef → position/velocity 동기화
 * - terrain height 동기화
 * - 8방향 facing (카메라 3/4뷰 보정)
 * - hit flash (emissive pulse)
 * - death 상태 처리
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, terrainH, -y)
 * useFrame priority=0 필수
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player, PlayerClass } from '@/lib/matrix/types';
import { getClassScale } from '@/lib/matrix/rendering3d/character-config';
import { getTerrainHeight } from '@/lib/matrix/rendering3d/terrain';
import { VoxelCharacter as LobbyVoxelCharacter } from '@/components/3d/VoxelCharacter';

// ============================================
// 게임 상수
// ============================================

/** Hit flash 지속 시간 (초) */
const HIT_FLASH_DURATION = 0.15;
/** 이동 속도 임계값 (이하면 idle) */
const MOVE_THRESHOLD = 0.5;
/** position LERP 속도 (delta-time 기반, 높을수록 빠름) */
const POSITION_LERP_SPEED = 18;
/** facing angle LERP 속도 (delta-time 기반) */
const FACING_LERP_SPEED = 12;

/**
 * 아이소메트릭 카메라 방향 보정 각도
 * 카메라가 (800,800,800)에서 원점을 바라봄 → XZ 평면에서 45도
 * 캐릭터가 velocity 방향으로 회전하면 얼굴(+Z)이 카메라 반대편을 향할 수 있음
 * 해결: facing 각도를 velocity 방향 대신, velocity 방향 + 카메라 보정으로 설정
 * → 캐릭터가 이동 방향으로 약간 기울되, 얼굴이 카메라 쪽으로 보이도록
 *
 * Math.atan2(800, 800) = PI/4 (45도)
 * 캐릭터 기본 +Z가 정면이므로, 카메라를 향하려면 PI + PI/4 = 5PI/4 회전 필요
 * 하지만 우리는 이동 방향도 반영하므로, velocity 각도에 약간의 보정만 추가
 */
const CAMERA_FACING_OFFSET = Math.PI; // +Z를 카메라 방향으로 반전

// ============================================
// RenderOrder 상수 (S18: Split Rendering)
// ============================================

export const RENDER_ORDER_LOWER = 1;
export const RENDER_ORDER_EFFECTS = 2;
export const RENDER_ORDER_UPPER = 3;

// ============================================
// 클래스별 appearance 매핑
// ============================================

/** 클래스 → skinId + appearance 매핑 (로비 VoxelCharacter가 사용) */
const CLASS_SKIN_MAP: Record<string, number> = {
  neo: 0,
  cipher: 1,
  phantom: 2,
  sentinel: 3,
  berserker: 4,
  oracle: 5,
  architect: 6,
  virus: 7,
  glitch: 8,
};

// ============================================
// Props
// ============================================

export interface VoxelCharacterProps {
  playerRef: React.MutableRefObject<Player>;
  playerClass?: PlayerClass;
  visible?: boolean;
}

// ============================================
// VoxelCharacter Component (Lobby Wrapper)
// ============================================

export function VoxelCharacter({
  playerRef,
  playerClass = 'neo',
  visible = true,
}: VoxelCharacterProps) {
  // 외부 그룹 ref (position/rotation/scale 제어)
  const outerGroupRef = useRef<THREE.Group>(null);
  // hit flash용 — 로비 캐릭터의 내부 mesh traversal
  const hitFlashTimerRef = useRef(0);
  const prevHitFlashRef = useRef(0);
  const currentFacingRef = useRef(CAMERA_FACING_OFFSET);
  // death 상태
  const deathTimerRef = useRef(0);
  const isDeadRef = useRef(false);
  // hit flash 대상 materials 캐시
  const flashMatsRef = useRef<THREE.MeshLambertMaterial[]>([]);
  const flashMatsCollected = useRef(false);

  const skinId = CLASS_SKIN_MAP[playerClass] ?? 0;
  const scale = getClassScale(playerClass);

  // ============================================
  // useFrame — 매 프레임 업데이트 (priority=0 필수)
  // ============================================

  useFrame((_state, delta) => {
    const outer = outerGroupRef.current;
    if (!outer) return;
    const player = playerRef.current;

    // --- 1. Position 보간 (lerp + velocity extrapolation) ---
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    // velocity extrapolation: tick 사이 예측 이동 (0.5 프레임 앞)
    const extraDt = Math.min(delta, 0.033); // 최대 2프레임 분량 clamp
    const targetX = player.position.x + vx * extraDt * 0.5;
    const targetZ = -(player.position.y + vy * extraDt * 0.5);
    // delta-time 기반 lerp factor: 1 - e^(-speed * dt)
    const posFactor = 1 - Math.exp(-POSITION_LERP_SPEED * delta);
    outer.position.x += (targetX - outer.position.x) * posFactor;
    outer.position.z += (targetZ - outer.position.z) * posFactor;
    outer.position.y = getTerrainHeight(outer.position.x, outer.position.z);

    // --- 2. 스케일 ---
    outer.scale.setScalar(scale);

    // --- 3. Facing (velocity 기반 + 카메라 보정, delta-time 보간) ---
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > MOVE_THRESHOLD) {
      // velocity 방향 각도 (2D에서 3D로 변환: y → -z)
      const velocityAngle = Math.atan2(vx, -vy);
      // 카메라 보정: +Z가 정면이므로 PI 회전
      const targetAngle = velocityAngle + CAMERA_FACING_OFFSET;
      let diff = targetAngle - currentFacingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // delta-time 기반 facing lerp: 프레임 독립적
      const facingFactor = 1 - Math.exp(-FACING_LERP_SPEED * delta);
      currentFacingRef.current += diff * facingFactor;
    }
    outer.rotation.y = currentFacingRef.current;

    // --- 4. Death 처리 ---
    const isAlive = player.health > 0;
    if (!isAlive && !isDeadRef.current) {
      isDeadRef.current = true;
      deathTimerRef.current = 0;
    }
    if (isDeadRef.current) {
      deathTimerRef.current += delta;
      const p = Math.min(deathTimerRef.current / 0.8, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      // 외부 그룹을 기울여서 쓰러지는 효과
      outer.rotation.x = (Math.PI / 2.5) * eased;
      outer.position.y -= 0.5 * eased;
    } else {
      outer.rotation.x = 0;
      isDeadRef.current = false;
    }

    // --- 5. Hit Flash Effect ---
    const isNewHit = player.hitFlashTimer > 0 && prevHitFlashRef.current <= 0;
    prevHitFlashRef.current = player.hitFlashTimer;

    if (isNewHit) {
      hitFlashTimerRef.current = HIT_FLASH_DURATION;
    }

    // materials 수집 (한 번만 — 로비 캐릭터가 마운트된 후)
    if (!flashMatsCollected.current && outer.children.length > 0) {
      const mats: THREE.MeshLambertMaterial[] = [];
      outer.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            for (const m of mesh.material) {
              if (m instanceof THREE.MeshLambertMaterial) mats.push(m);
            }
          } else if (mesh.material instanceof THREE.MeshLambertMaterial) {
            mats.push(mesh.material);
          }
        }
      });
      if (mats.length > 0) {
        flashMatsRef.current = mats;
        flashMatsCollected.current = true;
      }
    }

    // hit flash 적용/해제
    if (hitFlashTimerRef.current > 0) {
      hitFlashTimerRef.current -= delta;
      const flashT = Math.max(0, hitFlashTimerRef.current / HIT_FLASH_DURATION);
      for (const mat of flashMatsRef.current) {
        mat.emissive.set('#ff4444');
        mat.emissiveIntensity = flashT * 2.0;
      }
    } else {
      for (const mat of flashMatsRef.current) {
        if (mat.emissiveIntensity > 0) {
          mat.emissiveIntensity = 0;
          mat.emissive.setScalar(0);
        }
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={outerGroupRef}>
      <LobbyVoxelCharacter
        skinId={skinId}
        position={[0, 0, 0]}
        rotation={0}
        phaseOffset={Math.random() * 10}
      />
    </group>
  );
}

export default VoxelCharacter;
