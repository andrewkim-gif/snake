'use client';

/**
 * PickupRenderer.tsx — 3D Pickup 아이템 렌더링
 *
 * S11b: Pickup 3D Rendering
 * 1. XP orb: glowing SphereGeometry (InstancedMesh, capacity: 200)
 * 2. Item drops: small voxel cube + floating animation (y-axis sine wave) + color glow
 * 3. Gem/chest: larger cube with emissive + particle trail
 * 4. Vacuum effect: lerp toward player + scale-down on collect
 * 5. LOD: 거리 >1200px 시 point sprite로 대체
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Gem, Pickup, Player } from '@/lib/matrix/types';

// ============================================
// Constants
// ============================================

/** XP Orb InstancedMesh 용량 */
const XP_ORB_CAPACITY = 200;

/** Pickup Item InstancedMesh 용량 */
const PICKUP_CAPACITY = 50;

/** LOD 전환 거리 (이 이상은 point sprite) */
const LOD_DISTANCE = 1200;

/** Orb 기본 반경 */
const ORB_RADIUS = 0.8;

/** Pickup 아이템 기본 크기 */
const PICKUP_SIZE = 1.5;

/** 부유 애니메이션 진폭 */
const FLOAT_AMPLITUDE = 0.5;

/** 부유 애니메이션 주기 */
const FLOAT_FREQUENCY = 2;

/** Vacuum 효과 최소 거리 */
const VACUUM_RANGE = 150;

/** vacuum lerp 속도 */
const VACUUM_LERP = 0.15;

// ============================================
// Pickup 색상 매핑
// ============================================

/** XP orb 색상 (가치별, 사전 할당 — GC 방지) */
const GEM_COLORS = {
  legendary: new THREE.Color('#ff6600'),
  epic: new THREE.Color('#aa44ff'),
  rare: new THREE.Color('#4488ff'),
  magic: new THREE.Color('#44ddff'),
  common: new THREE.Color('#44ff88'),
} as const;

function getGemColor(value: number): THREE.Color {
  if (value >= 50) return GEM_COLORS.legendary;
  if (value >= 20) return GEM_COLORS.epic;
  if (value >= 10) return GEM_COLORS.rare;
  if (value >= 5) return GEM_COLORS.magic;
  return GEM_COLORS.common;
}

/** Pickup 타입별 색상 */
const PICKUP_COLORS: Record<string, THREE.Color> = {
  chicken: new THREE.Color('#ff4444'),       // 빨강 (체력)
  chest: new THREE.Color('#ffd700'),         // 골드 (상자)
  bomb: new THREE.Color('#ff6600'),          // 오렌지 (폭탄)
  magnet: new THREE.Color('#8844ff'),        // 보라 (자석)
  upgrade_material: new THREE.Color('#00ffaa'), // 청록 (재료)
};

/** Pickup 타입별 크기 배율 */
const PICKUP_SCALES: Record<string, number> = {
  chicken: 1.0,
  chest: 1.5,
  bomb: 1.2,
  magnet: 1.0,
  upgrade_material: 1.3,
};

/** 임시 행렬 (useFrame 내 재사용 — GC 방지) */
const _tempRotMatrix = new THREE.Matrix4();
const _tempScaleMatrix = new THREE.Matrix4();
const _tempFallbackColor = new THREE.Color('#ffffff');

// ============================================
// XP Orb Renderer (InstancedMesh)
// ============================================

interface XpOrbRendererProps {
  gemsRef: React.MutableRefObject<Gem[]>;
  playerRef: React.MutableRefObject<Player>;
}

function XpOrbRenderer({ gemsRef, playerRef }: XpOrbRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointsRef = useRef<THREE.Points>(null);

  // 공유 geometry/material
  const geometry = useMemo(() => new THREE.SphereGeometry(ORB_RADIUS, 8, 6), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        emissive: new THREE.Color('#44ff88'),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
        metalness: 0.3,
      }),
    []
  );

  // LOD: point sprite용
  const pointGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  const pointMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
      }),
    []
  );

  // 임시 객체 (재사용)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const gems = gemsRef.current;
    const player = playerRef.current;
    const playerX = player.position.x;
    const playerZ = -player.position.y;
    const time = clock.getElapsedTime();

    let nearCount = 0;
    const farPositions: number[] = [];
    const farColors: number[] = [];

    for (let i = 0; i < gems.length && nearCount < XP_ORB_CAPACITY; i++) {
      const gem = gems[i];
      if (gem.isCollected) continue;

      // 2D → 3D 좌표
      const gx = gem.position.x;
      const gz = -gem.position.y;

      // 거리 계산
      const dx = gx - playerX;
      const dz = gz - playerZ;
      const distSq = dx * dx + dz * dz;

      // LOD: 먼 거리는 point sprite
      if (distSq > LOD_DISTANCE * LOD_DISTANCE) {
        farPositions.push(gx, 1, gz);
        const color = getGemColor(gem.value);
        farColors.push(color.r, color.g, color.b);
        continue;
      }

      // 부유 애니메이션 (sine wave)
      const floatY = Math.sin(time * FLOAT_FREQUENCY + i * 0.7) * FLOAT_AMPLITUDE;
      const baseY = ORB_RADIUS + 0.5;

      // Vacuum 효과 (가까우면 플레이어 쪽으로 이동)
      let finalX = gx;
      let finalZ = gz;
      if (distSq < VACUUM_RANGE * VACUUM_RANGE && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const vacuumStrength = 1 - dist / VACUUM_RANGE;
        finalX = THREE.MathUtils.lerp(gx, playerX, vacuumStrength * VACUUM_LERP);
        finalZ = THREE.MathUtils.lerp(gz, playerZ, vacuumStrength * VACUUM_LERP);
      }

      // 크기 (가치에 따라)
      const scale = 0.6 + Math.min(gem.value / 20, 1) * 0.6;

      tempMatrix.makeScale(scale, scale, scale);
      tempMatrix.setPosition(finalX, baseY + floatY, finalZ);

      mesh.setMatrixAt(nearCount, tempMatrix);

      // 가치별 색상
      const gemColor = getGemColor(gem.value);
      mesh.setColorAt(nearCount, gemColor);

      nearCount++;
    }

    mesh.count = nearCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // far point sprite 업데이트
    const points = pointsRef.current;
    if (points && farPositions.length > 0) {
      pointGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(farPositions, 3)
      );
      pointGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(farColors, 3)
      );
      points.visible = true;
    } else if (points) {
      points.visible = false;
    }

    // 글로우 펄스 (emissive intensity)
    const pulse = 0.6 + Math.sin(time * 3) * 0.3;
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, XP_ORB_CAPACITY]}
        frustumCulled={false}
      />
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry ref={() => pointGeometry} />
        <pointsMaterial
          size={3}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation
        />
      </points>
    </>
  );
}

// ============================================
// Pickup Item Renderer (InstancedMesh)
// ============================================

interface PickupItemRendererProps {
  pickupsRef: React.MutableRefObject<Pickup[]>;
  playerRef: React.MutableRefObject<Player>;
}

function PickupItemRenderer({ pickupsRef, playerRef }: PickupItemRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // voxel cube geometry + material
  const geometry = useMemo(() => new THREE.BoxGeometry(PICKUP_SIZE, PICKUP_SIZE, PICKUP_SIZE), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        emissive: new THREE.Color('#ffd700'),
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const pickups = pickupsRef.current;
    const player = playerRef.current;
    const playerX = player.position.x;
    const playerZ = -player.position.y;
    const time = clock.getElapsedTime();

    let count = 0;

    for (let i = 0; i < pickups.length && count < PICKUP_CAPACITY; i++) {
      const pickup = pickups[i];

      // 2D → 3D
      const px = pickup.position.x;
      const pz = -pickup.position.y;

      // 거리 체크
      const dx = px - playerX;
      const dz = pz - playerZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > LOD_DISTANCE * LOD_DISTANCE) continue;

      // 부유 + 회전 애니메이션
      const floatY = Math.sin(time * FLOAT_FREQUENCY * 0.8 + i * 1.3) * FLOAT_AMPLITUDE * 0.8;
      const rotY = time * 1.5 + i * 0.5;
      const baseY = PICKUP_SIZE * 0.5 + 0.8;

      // 스케일
      const typeScale = PICKUP_SCALES[pickup.type] || 1.0;

      // chest/gem은 더 크게
      const isBig = pickup.type === 'chest' || pickup.type === 'upgrade_material';
      const finalScale = typeScale * (isBig ? 1.3 : 1.0);

      // 수명에 따른 페이드 (깜빡임)
      const lifeRatio = pickup.life / 10; // 10초 기준
      const blink = lifeRatio < 0.3 ? (Math.sin(time * 10) > 0 ? 1 : 0.3) : 1;

      // matrix 구성 (사전 할당 행렬 재사용 — GC 방지)
      _tempRotMatrix.makeRotationY(rotY);
      _tempScaleMatrix.makeScale(
        finalScale * blink,
        finalScale * blink,
        finalScale * blink
      );
      tempMatrix.multiplyMatrices(_tempRotMatrix, _tempScaleMatrix);
      tempMatrix.setPosition(px, baseY + floatY, pz);

      mesh.setMatrixAt(count, tempMatrix);

      // 타입별 색상
      const color = PICKUP_COLORS[pickup.type] || _tempFallbackColor;
      mesh.setColorAt(count, color);

      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // emissive 펄스
    const pulse = 0.3 + Math.sin(time * 2) * 0.2;
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PICKUP_CAPACITY]}
      castShadow
      frustumCulled={false}
    />
  );
}

// ============================================
// PickupRenderer (Orchestrator)
// ============================================

export interface PickupRendererProps {
  /** XP 젬 ref */
  gemsRef: React.MutableRefObject<Gem[]>;
  /** 픽업 아이템 ref */
  pickupsRef: React.MutableRefObject<Pickup[]>;
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
}

/**
 * PickupRenderer — XP Orb + Item Drop 3D 렌더링
 *
 * 구성:
 * - XpOrbRenderer: Gem[] → SphereGeometry InstancedMesh (200개)
 * - PickupItemRenderer: Pickup[] → BoxGeometry InstancedMesh (50개)
 * - LOD: >1200px → point sprite 대체
 * - Vacuum: 가까이 오면 플레이어 쪽으로 lerp
 */
export function PickupRenderer({
  gemsRef,
  pickupsRef,
  playerRef,
}: PickupRendererProps) {
  return (
    <group>
      {/* XP Orb — glowing spheres with vacuum effect */}
      <XpOrbRenderer gemsRef={gemsRef} playerRef={playerRef} />

      {/* Item Drops — voxel cubes with float + rotate */}
      <PickupItemRenderer pickupsRef={pickupsRef} playerRef={playerRef} />
    </group>
  );
}

export default PickupRenderer;
