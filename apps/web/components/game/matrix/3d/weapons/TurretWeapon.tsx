/**
 * 3d/weapons/TurretWeapon.tsx - 터렛 3D 렌더러
 * v38 Phase 4 (S32b): Turret base + barrel + auto-rotation + muzzle flash
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
const CAPACITY = 100; // 터렛은 투사체보다 적게 존재

// 임시 연산용 (GC 방지)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

interface TurretWeaponProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
  enemiesRef: React.MutableRefObject<any[]>;
}

export default function TurretWeapon({
  projectilesRef,
  enemiesRef,
}: TurretWeaponProps) {
  // ===== Refs =====
  // 터렛 베이스 (고정 부분)
  const baseRef = useRef<THREE.InstancedMesh>(null);
  // 터렛 배럴 (회전 부분)
  const barrelRef = useRef<THREE.InstancedMesh>(null);
  // 머즐 플래시 (발사 이펙트)
  const flashRef = useRef<THREE.InstancedMesh>(null);
  // 사거리 인디케이터
  const rangeRef = useRef<THREE.InstancedMesh>(null);

  // 터렛별 마지막 발사 시간 (플래시 애니메이션용)
  const lastFireTimeRef = useRef<Map<number, number>>(new Map());

  // ===== Geometries =====
  const geometries = useMemo(() => ({
    // 베이스: 넓적한 박스 (포탑 기반)
    base: new THREE.BoxGeometry(0.4, 0.15, 0.4),
    // 배럴: 긴 실린더 (포신)
    barrel: new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8),
    // 머즐 플래시: 구체
    flash: new THREE.SphereGeometry(0.08, 8, 8),
    // 사거리: 링
    range: new THREE.RingGeometry(0.95, 1.0, 32),
  }), []);

  // ===== Materials =====
  const materials = useMemo(() => ({
    base: new THREE.MeshStandardMaterial({
      color: '#374151',
      emissive: '#1F2937',
      emissiveIntensity: 0.1,
      metalness: 0.8,
      roughness: 0.3,
    }),
    barrel: new THREE.MeshStandardMaterial({
      color: '#4B5563',
      emissive: '#374151',
      emissiveIntensity: 0.1,
      metalness: 0.9,
      roughness: 0.2,
    }),
    flash: new THREE.MeshStandardMaterial({
      color: '#FCD34D',
      emissive: '#FCD34D',
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.9,
    }),
    range: new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#06B6D4',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    }),
  }), []);

  useFrame(() => {
    const projectiles = projectilesRef.current;
    const enemies = enemiesRef.current;
    if (!projectiles) return;

    const time = performance.now();

    let baseCount = 0;
    let barrelCount = 0;
    let flashCount = 0;
    let rangeCount = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i] as any;
      if (!p || p.life <= 0) continue;

      const weaponType = p.weaponType || p.type;
      if (weaponType !== 'turret') continue;

      const px = (p.position?.x ?? p.x ?? 0) * WORLD_SCALE;
      const py = (p.position?.y ?? p.y ?? 0) * WORLD_SCALE;
      const turretRange = (p.radius || 150) * WORLD_SCALE;

      // ===== 가장 가까운 적 방향 계산 =====
      let targetAngle = p.angle || 0;
      let hasTarget = false;

      if (enemies && enemies.length > 0) {
        let closestDist = Infinity;
        const turretX = p.position?.x ?? p.x ?? 0;
        const turretY = p.position?.y ?? p.y ?? 0;

        for (let e = 0; e < enemies.length; e++) {
          const enemy = enemies[e] as any;
          if (!enemy || (enemy.hp !== undefined && enemy.hp <= 0)) continue;

          const ex = enemy.position?.x ?? enemy.x ?? 0;
          const ey = enemy.position?.y ?? enemy.y ?? 0;
          const dx = ex - turretX;
          const dy = ey - turretY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < closestDist && dist < (p.radius || 150)) {
            closestDist = dist;
            targetAngle = Math.atan2(dy, dx);
            hasTarget = true;
          }
        }
      }

      // 부드러운 회전 보간 (lerp)
      const currentAngle = p._turretAngle ?? targetAngle;
      const angleDiff = ((targetAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const smoothAngle = currentAngle + angleDiff * 0.08; // 부드러운 추적
      p._turretAngle = smoothAngle;

      // ===== 베이스 (고정) =====
      if (baseRef.current && baseCount < CAPACITY) {
        _pos.set(px, 0.08, -py);
        _quat.identity();
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        baseRef.current.setMatrixAt(baseCount, _mat4);

        // 타겟 있으면 살짝 밝게
        if (hasTarget) {
          _color.setRGB(0.3, 0.35, 0.4);
        } else {
          _color.setRGB(0.22, 0.25, 0.32);
        }
        baseRef.current.setColorAt(baseCount, _color);
        baseCount++;
      }

      // ===== 배럴 (회전) =====
      if (barrelRef.current && barrelCount < CAPACITY) {
        // 배럴 중심점: 베이스 위 + 전방으로 오프셋
        const barrelOffset = 0.18; // 배럴 길이의 절반
        const barrelX = px + Math.cos(smoothAngle) * barrelOffset * 0.5;
        const barrelY = py + Math.sin(smoothAngle) * barrelOffset * 0.5;

        _pos.set(barrelX, 0.18, -barrelY);
        // 실린더를 수평으로 눕히고 목표 방향으로 회전
        _euler.set(0, -smoothAngle, Math.PI / 2);
        _quat.setFromEuler(_euler);
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        barrelRef.current.setMatrixAt(barrelCount, _mat4);
        barrelCount++;
      }

      // ===== 머즐 플래시 (발사 이펙트) =====
      if (flashRef.current && flashCount < CAPACITY) {
        // 발사 주기 체크 (약 0.5초마다 플래시)
        const lastFire = lastFireTimeRef.current.get(i) || 0;
        const fireInterval = 500; // ms
        const timeSinceFire = time - lastFire;

        // 타겟이 있고 발사 간격 경과 시 새 플래시
        if (hasTarget && timeSinceFire > fireInterval) {
          lastFireTimeRef.current.set(i, time);
        }

        const flashProgress = Math.min(1, timeSinceFire / 150); // 150ms 플래시 지속
        if (flashProgress < 1 && hasTarget) {
          const muzzleX = px + Math.cos(smoothAngle) * 0.22;
          const muzzleY = py + Math.sin(smoothAngle) * 0.22;
          const flashScale = (1 - flashProgress) * 1.5;

          _pos.set(muzzleX, 0.18, -muzzleY);
          _quat.identity();
          _scale.set(flashScale, flashScale, flashScale);
          _mat4.compose(_pos, _quat, _scale);
          flashRef.current.setMatrixAt(flashCount, _mat4);

          // 플래시 색상: 밝은 노란색 → 주황색 페이드
          _color.setRGB(
            1.0,
            0.85 - flashProgress * 0.3,
            0.2 - flashProgress * 0.2
          );
          flashRef.current.setColorAt(flashCount, _color);
          flashCount++;
        }
      }

      // ===== 사거리 인디케이터 (지면 링) =====
      if (rangeRef.current && rangeCount < CAPACITY) {
        const rangePulse = 0.98 + Math.sin(time / 1000) * 0.02;

        _pos.set(px, 0.02, -py);
        _euler.set(-Math.PI / 2, 0, 0);
        _quat.setFromEuler(_euler);
        const r = turretRange * rangePulse;
        _scale.set(r, r, 1);
        _mat4.compose(_pos, _quat, _scale);
        rangeRef.current.setMatrixAt(rangeCount, _mat4);
        rangeCount++;
      }
    }

    // count 설정 + flush
    setCountAndFlush(baseRef.current, baseCount);
    setCountAndFlush(barrelRef.current, barrelCount);
    setCountAndFlush(flashRef.current, flashCount);
    setCountAndFlush(rangeRef.current, rangeCount);
  });

  return (
    <group>
      {/* 터렛 베이스 */}
      <instancedMesh
        ref={baseRef}
        args={[geometries.base, materials.base, CAPACITY]}
        frustumCulled={false}
        castShadow
      />
      {/* 터렛 배럴 */}
      <instancedMesh
        ref={barrelRef}
        args={[geometries.barrel, materials.barrel, CAPACITY]}
        frustumCulled={false}
        castShadow
      />
      {/* 머즐 플래시 */}
      <instancedMesh
        ref={flashRef}
        args={[geometries.flash, materials.flash, CAPACITY]}
        frustumCulled={false}
      />
      {/* 사거리 인디케이터 */}
      <instancedMesh
        ref={rangeRef}
        args={[geometries.range, materials.range, CAPACITY]}
        frustumCulled={false}
      />
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
