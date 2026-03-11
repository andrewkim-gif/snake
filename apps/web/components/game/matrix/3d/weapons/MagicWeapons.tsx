/**
 * 3d/weapons/MagicWeapons.tsx - 마법/영역 무기 3D 렌더러
 * v38 Phase 4 (S30): wand, bible, garlic, pool
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Projectile } from '@/lib/matrix/types';

// ===== 공통 상수 =====
const WORLD_SCALE = 1 / 50;
const Y_OFFSET = 0.4;
const CAPACITY = 200;

// 임시 연산용 (GC 방지)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

interface MagicWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
  playerPosRef: React.MutableRefObject<{ x: number; y: number }>;
}

export default function MagicWeapons({
  projectilesRef,
  playerPosRef,
}: MagicWeaponsProps) {
  // ===== Refs =====
  // wand: 발광 구체 투사체
  const wandRef = useRef<THREE.InstancedMesh>(null);
  const wandCoreRef = useRef<THREE.InstancedMesh>(null);

  // bible: 궤도 페이지 (planes around player)
  const bibleRef = useRef<THREE.InstancedMesh>(null);

  // garlic: AOE 지면 데칼 (CircleGeometry)
  const garlicRef = useRef<THREE.InstancedMesh>(null);
  const garlicRingRef = useRef<THREE.InstancedMesh>(null);

  // pool: 데미지 존 지면 데칼
  const poolRef = useRef<THREE.InstancedMesh>(null);
  const poolBorderRef = useRef<THREE.InstancedMesh>(null);

  // ===== Geometries =====
  const geometries = useMemo(() => ({
    // wand: 발광 오브 외곽
    wandOrb: new THREE.SphereGeometry(0.2, 12, 12),
    // wand: 내부 코어
    wandCore: new THREE.SphereGeometry(0.08, 8, 8),
    // bible: 페이지 (평면)
    biblePage: new THREE.PlaneGeometry(0.35, 0.5),
    // garlic: AOE 원형 데칼
    garlicCircle: new THREE.CircleGeometry(1, 32),
    // garlic: 외곽 링
    garlicRing: new THREE.RingGeometry(0.9, 1.0, 32),
    // pool: 데미지 존
    poolCircle: new THREE.CircleGeometry(1, 32),
    // pool: 경계 링
    poolBorder: new THREE.RingGeometry(0.92, 1.0, 32),
  }), []);

  // ===== Materials =====
  const materials = useMemo(() => ({
    // TERRITORY 블루 (wand)
    wandOrb: new THREE.MeshStandardMaterial({
      color: '#3B82F6',
      emissive: '#3B82F6',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
    }),
    wandCore: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#DBEAFE',
      emissiveIntensity: 0.9,
    }),
    // SOVEREIGNTY 그린 (bible)
    biblePage: new THREE.MeshStandardMaterial({
      color: '#14532D',
      emissive: '#22C55E',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
    // SOVEREIGNTY 그린 (garlic)
    garlicCircle: new THREE.MeshStandardMaterial({
      color: '#22C55E',
      emissive: '#22C55E',
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    }),
    garlicRing: new THREE.MeshStandardMaterial({
      color: '#22C55E',
      emissive: '#22C55E',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
    // SOVEREIGNTY 그린 (pool)
    poolCircle: new THREE.MeshStandardMaterial({
      color: '#22C55E',
      emissive: '#22C55E',
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    }),
    poolBorder: new THREE.MeshStandardMaterial({
      color: '#22C55E',
      emissive: '#22C55E',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  }), []);

  useFrame(() => {
    const projectiles = projectilesRef.current;
    if (!projectiles) return;

    const time = performance.now();
    const playerPos = playerPosRef.current;

    let wandCount = 0;
    let wandCoreCount = 0;
    let bibleCount = 0;
    let garlicCount = 0;
    let garlicRingCount = 0;
    let poolCount = 0;
    let poolBorderCount = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i] as any;
      if (!p || p.life <= 0) continue;

      const weaponType = p.weaponType || p.type;
      const px = (p.position?.x ?? p.x ?? 0) * WORLD_SCALE;
      const py = (p.position?.y ?? p.y ?? 0) * WORLD_SCALE;
      const radius = (p.radius || 10) * WORLD_SCALE;
      const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));

      switch (weaponType) {
        // ===== WAND: 발광 오브 투사체 =====
        case 'wand': {
          const boltSize = Math.max(0.15, radius * 2.5);
          const corePulse = 0.8 + Math.sin(time / 35) * 0.2;

          // 외곽 오브
          if (wandRef.current && wandCount < CAPACITY) {
            _pos.set(px, Y_OFFSET, -py);
            _quat.identity();
            _scale.set(boltSize, boltSize, boltSize);
            _mat4.compose(_pos, _quat, _scale);
            wandRef.current.setMatrixAt(wandCount, _mat4);
            wandCount++;
          }

          // 내부 밝은 코어
          if (wandCoreRef.current && wandCoreCount < CAPACITY) {
            _pos.set(px, Y_OFFSET, -py);
            _quat.identity();
            const coreSize = boltSize * 0.5 * corePulse;
            _scale.set(coreSize, coreSize, coreSize);
            _mat4.compose(_pos, _quat, _scale);
            wandCoreRef.current.setMatrixAt(wandCoreCount, _mat4);
            wandCoreCount++;
          }
          break;
        }

        // ===== BIBLE: 플레이어 주변 궤도 페이지 =====
        case 'bible': {
          if (!bibleRef.current || bibleCount >= CAPACITY) break;

          const dx = (p.position?.x ?? 0) - (playerPos?.x ?? 0);
          const dy = (p.position?.y ?? 0) - (playerPos?.y ?? 0);
          const orbitAngle = Math.atan2(dy, dx);

          // 궤도 회전 + 살짝 기울임
          const spinProgress = (time / 3000) % 1;
          const satelliteSpin = spinProgress * Math.PI * 2;

          _pos.set(px, Y_OFFSET + 0.15, -py);
          _euler.set(
            Math.sin(satelliteSpin + orbitAngle) * 0.3, // 앞뒤 기울기
            -orbitAngle + Math.PI / 2, // 페이지 방향
            Math.cos(satelliteSpin) * 0.2 // 좌우 기울기
          );
          _quat.setFromEuler(_euler);
          _scale.set(1, 1, 1);
          _mat4.compose(_pos, _quat, _scale);
          bibleRef.current.setMatrixAt(bibleCount, _mat4);
          bibleCount++;
          break;
        }

        // ===== GARLIC: AOE 지면 방어 데칼 =====
        case 'garlic': {
          const shieldRadius = (p.radius || 60) * WORLD_SCALE;
          const pulse = 1 + Math.sin(time / 400) * 0.06;

          // 원형 데칼 (지면)
          if (garlicRef.current && garlicCount < CAPACITY) {
            _pos.set(px, 0.03, -py);
            _euler.set(-Math.PI / 2, 0, 0); // 수평 눕힘
            _quat.setFromEuler(_euler);
            const r = shieldRadius * pulse;
            _scale.set(r, r, 1);
            _mat4.compose(_pos, _quat, _scale);
            garlicRef.current.setMatrixAt(garlicCount, _mat4);
            garlicCount++;
          }

          // 외곽 링 (회전)
          if (garlicRingRef.current && garlicRingCount < CAPACITY) {
            _pos.set(px, 0.04, -py);
            _euler.set(-Math.PI / 2, time / 2000, 0);
            _quat.setFromEuler(_euler);
            const r = shieldRadius * pulse;
            _scale.set(r, r, 1);
            _mat4.compose(_pos, _quat, _scale);
            garlicRingRef.current.setMatrixAt(garlicRingCount, _mat4);
            garlicRingCount++;
          }
          break;
        }

        // ===== POOL: 데미지 존 지면 데칼 =====
        case 'pool': {
          const zoneRadius = (p.radius || 60) * WORLD_SCALE * 1.3;
          const defensePulse = 1 + Math.sin(time / 350) * 0.07;

          // 원형 데칼
          if (poolRef.current && poolCount < CAPACITY) {
            _pos.set(px, 0.02, -py);
            _euler.set(-Math.PI / 2, 0, 0);
            _quat.setFromEuler(_euler);
            const r = zoneRadius * defensePulse;
            _scale.set(r, r, 1);
            _mat4.compose(_pos, _quat, _scale);
            poolRef.current.setMatrixAt(poolCount, _mat4);
            poolCount++;
          }

          // 경계 링 (펄스)
          if (poolBorderRef.current && poolBorderCount < CAPACITY) {
            _pos.set(px, 0.03, -py);
            _euler.set(-Math.PI / 2, time / 1500, 0);
            _quat.setFromEuler(_euler);
            const r = zoneRadius * defensePulse * 0.95;
            _scale.set(r, r, 1);
            _mat4.compose(_pos, _quat, _scale);
            poolBorderRef.current.setMatrixAt(poolBorderCount, _mat4);
            poolBorderCount++;
          }
          break;
        }
      }
    }

    // count 설정 + flush
    setCountAndFlush(wandRef.current, wandCount);
    setCountAndFlush(wandCoreRef.current, wandCoreCount);
    setCountAndFlush(bibleRef.current, bibleCount);
    setCountAndFlush(garlicRef.current, garlicCount);
    setCountAndFlush(garlicRingRef.current, garlicRingCount);
    setCountAndFlush(poolRef.current, poolCount);
    setCountAndFlush(poolBorderRef.current, poolBorderCount);
  });

  return (
    <group>
      {/* wand */}
      <instancedMesh ref={wandRef} args={[geometries.wandOrb, materials.wandOrb, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={wandCoreRef} args={[geometries.wandCore, materials.wandCore, CAPACITY]} frustumCulled={false} />

      {/* bible */}
      <instancedMesh ref={bibleRef} args={[geometries.biblePage, materials.biblePage, CAPACITY]} frustumCulled={false} />

      {/* garlic */}
      <instancedMesh ref={garlicRef} args={[geometries.garlicCircle, materials.garlicCircle, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={garlicRingRef} args={[geometries.garlicRing, materials.garlicRing, CAPACITY]} frustumCulled={false} />

      {/* pool */}
      <instancedMesh ref={poolRef} args={[geometries.poolCircle, materials.poolCircle, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={poolBorderRef} args={[geometries.poolBorder, materials.poolBorder, CAPACITY]} frustumCulled={false} />
    </group>
  );
}

/** count 설정 + GPU flush */
function setCountAndFlush(mesh: THREE.InstancedMesh | null, count: number): void {
  if (!mesh) return;
  mesh.count = count;
  if (count > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
