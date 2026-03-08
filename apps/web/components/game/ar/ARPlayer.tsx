'use client';

/**
 * ARPlayer — 로컬 플레이어 캐릭터 렌더링
 *
 * v19 PERF-2 리팩토링: position/rotation/moving을 props 대신 interpRef에서 useFrame 내 직접 읽음
 * → IIFE 제거, memo 유효, zero-alloc per frame
 *
 * useFrame priority=0 (auto-render 유지)
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';
import type { ARInterpolationState } from '@/lib/3d/ar-interpolation';

// 큐블링 프로포션 (24u -> 1.5 world units)
const HEAD_SIZE = 0.625;
const BODY_W = 0.5;
const BODY_H = 0.4375;
const ARM_W = 0.25;
const ARM_H = 0.4375;
const LEG_W = 0.25;
const LEG_H = 0.4375;

const LEG_TOP_Y = LEG_H;
const BODY_CENTER_Y = LEG_TOP_Y + BODY_H / 2;
const SHOULDER_Y = LEG_TOP_Y + BODY_H;
const HEAD_CENTER_Y = SHOULDER_Y + HEAD_SIZE / 2;

// 자동 공격 오라 색상
const AURA_COLOR = new THREE.Color(0.2, 0.8, 1.0);

// 이동 감지 임계값 (제곱 거리)
const MOVE_THRESHOLD_SQ = 0.001;

interface ARPlayerProps {
  /** 보간 상태 ref */
  interpRef: React.MutableRefObject<ARInterpolationState>;
  /** 플레이어 ID */
  playerId: string;
  /** 공격 범위 (m) */
  attackRange: number;
  /** HP 비율 (0~1) */
  hpRatio: number;
  /** 플레이어 위치 ref (카메라용) */
  posRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  /** 아레나 시드 (지형 높이 쿼리용) */
  arenaSeed: number;
  /** 지형 높이 편차 (기본 3) */
  flattenVariance?: number;
}

function ARPlayerInner({
  interpRef,
  playerId,
  attackRange,
  hpRatio,
  posRef,
  arenaSeed,
  flattenVariance = 3,
}: ARPlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const hpBarRef = useRef<THREE.Mesh>(null);
  const hpBgRef = useRef<THREE.Group>(null);

  // HP 바 색상 캐시
  const lastHpColorRef = useRef(-1);

  // 머티리얼
  const headMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0xffe0bd }), []);
  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x3366cc }), []);
  const limbMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x2244aa }), []);
  const legMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x444444 }), []);
  const auraMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: AURA_COLOR,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // HP 바 머티리얼 (ref-based 업데이트용)
  const hpMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x4caf50 }),
    []
  );

  // 오라 지오메트리
  const auraGeo = useMemo(() => new THREE.RingGeometry(0, attackRange, 64), [attackRange]);

  // v19: Dispose geometry/material on unmount
  useEffect(() => {
    return () => {
      headMat.dispose();
      bodyMat.dispose();
      limbMat.dispose();
      legMat.dispose();
      auraMat.dispose();
      hpMat.dispose();
      auraGeo.dispose();
    };
  }, [headMat, bodyMat, limbMat, legMat, auraMat, hpMat, auraGeo]);

  // 애니메이션 + 위치 업데이트 (zero-alloc)
  useFrame(() => {
    if (!groupRef.current || !playerId) return;

    // interpRef에서 보간된 렌더 위치 읽기 (v19 fix: currX → renderX — 60fps 보간)
    const entity = interpRef.current.entities.get(playerId);
    const px = entity ? entity.renderX : 0;
    const pz = entity ? entity.renderZ : 0;
    const rot = entity ? entity.renderRot : 0;

    // 이동 감지 (보간 전후 위치 비교)
    const moving = entity
      ? (entity.renderX - entity.prevX) ** 2 + (entity.renderZ - entity.prevZ) ** 2 > MOVE_THRESHOLD_SQ
      : false;

    // 지형 높이 쿼리 — 그룹은 MC_BASE_Y에 배치되므로 로컬 Y = terrainY - MC_BASE_Y + 캐릭터 오프셋
    const terrainY = getArenaTerrainHeight(px, pz, arenaSeed, flattenVariance);
    const localY = terrainY - MC_BASE_Y + 1;

    // 위치/회전 (그룹 내 로컬 좌표)
    groupRef.current.position.set(px, localY, pz);
    groupRef.current.rotation.y = rot;

    // posRef 업데이트 (카메라 추적용 — 월드 좌표)
    posRef.current.x = px;
    posRef.current.y = terrainY + 1;
    posRef.current.z = pz;

    // 걷기 애니메이션
    const t = performance.now() * 0.006;
    const swingAmp = moving ? 0.6 : 0.1;
    const swingSpeed = moving ? 1.0 : 0.3;

    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * swingSpeed) * swingAmp;
      rightArmRef.current.rotation.x = -Math.sin(t * swingSpeed) * swingAmp;
    }
    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = -Math.sin(t * swingSpeed) * swingAmp * 0.8;
      rightLegRef.current.rotation.x = Math.sin(t * swingSpeed) * swingAmp * 0.8;
    }

    // 오라 펄스
    if (auraRef.current) {
      const pulse = 0.1 + Math.sin(t * 0.5) * 0.05;
      (auraRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }

    // HP 바 ref-based 업데이트 (PERF-2: 인라인 JSX 제거)
    if (hpBarRef.current && hpBgRef.current) {
      hpBarRef.current.position.x = (hpRatio - 1) * 0.4;
      hpBarRef.current.scale.x = Math.max(0.001, hpRatio);

      // 색상 업데이트 (변경 시만)
      const colorBucket = hpRatio > 0.5 ? 2 : hpRatio > 0.25 ? 1 : 0;
      if (colorBucket !== lastHpColorRef.current) {
        lastHpColorRef.current = colorBucket;
        const c = colorBucket === 2 ? 0x4caf50 : colorBucket === 1 ? 0xff9800 : 0xf44336;
        hpMat.color.setHex(c);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* 머리 */}
      <mesh position={[0, HEAD_CENTER_Y, 0]} material={headMat}>
        <boxGeometry args={[HEAD_SIZE, HEAD_SIZE, HEAD_SIZE]} />
      </mesh>

      {/* 몸통 */}
      <mesh position={[0, BODY_CENTER_Y, 0]} material={bodyMat}>
        <boxGeometry args={[BODY_W, BODY_H, BODY_W * 0.6]} />
      </mesh>

      {/* 왼팔 */}
      <mesh ref={leftArmRef} position={[-(BODY_W / 2 + ARM_W / 2), SHOULDER_Y, 0]} material={limbMat}>
        <boxGeometry args={[ARM_W, ARM_H, ARM_W]} />
      </mesh>

      {/* 오른팔 */}
      <mesh ref={rightArmRef} position={[BODY_W / 2 + ARM_W / 2, SHOULDER_Y, 0]} material={limbMat}>
        <boxGeometry args={[ARM_W, ARM_H, ARM_W]} />
      </mesh>

      {/* 왼다리 */}
      <mesh ref={leftLegRef} position={[-LEG_W / 2 - 0.02, LEG_H / 2, 0]} material={legMat}>
        <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
      </mesh>

      {/* 오른다리 */}
      <mesh ref={rightLegRef} position={[LEG_W / 2 + 0.02, LEG_H / 2, 0]} material={legMat}>
        <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
      </mesh>

      {/* 공격 오라 링 */}
      <mesh ref={auraRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} geometry={auraGeo} material={auraMat} />

      {/* HP 바 (ref-based 업데이트) */}
      <group ref={hpBgRef} position={[0, HEAD_CENTER_Y + HEAD_SIZE / 2 + 0.3, 0]}>
        <mesh>
          <planeGeometry args={[0.8, 0.08]} />
          <meshBasicMaterial color={0x333333} transparent opacity={0.7} />
        </mesh>
        <mesh ref={hpBarRef} position={[0, 0, 0.001]}>
          <planeGeometry args={[0.8, 0.06]} />
          <primitive object={hpMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export const ARPlayer = memo(ARPlayerInner);
