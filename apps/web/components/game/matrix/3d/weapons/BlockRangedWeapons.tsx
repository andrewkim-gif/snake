/**
 * 3d/weapons/BlockRangedWeapons.tsx — 블록 좌표 원거리 무기 3D 렌더러
 * v42 Phase 2: RangedWeapons.tsx 복사 → 블록 좌표 네이티브 변환
 *
 * 핵심 변경 (기존 RangedWeapons.tsx 대비):
 *   - WORLD_SCALE = 1 (기존 1/50)
 *   - Z축 반전 제거: pz 직접 사용 (기존 -py)
 *   - Y 높이: getMCTerrainHeight(px, pz) + 1.5 (지형 위 플레이어 가슴 높이)
 *   - radius 스케일링 제거 (이미 블록 단위)
 *
 * 원거리 무기: knife(투척), bow(화살), wand(구체 유도탄),
 *   bible(토러스 공전), garlic(반투명 구체 AOE)
 *
 * v42 6종 기본 무기 중 원거리 5종을 렌더링:
 *   wand  → 구체 (에너지 볼트)
 *   knife → 사면체 (회전 투척)
 *   bow   → 실린더 (화살)
 *   bible → 토러스 (공전 궤도)
 *   garlic → 반투명 구체 (AOE 오라)
 */

'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Projectile } from '@/lib/matrix/types';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';

// ===== 공통 상수 =====
const CAPACITY = 200;
const PROJECTILE_Y_OFFSET = 1.5; // 지형 위 플레이어 가슴 높이

// 임시 연산용 (GC 방지)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

interface BlockRangedWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
}

export default function BlockRangedWeapons({ projectilesRef }: BlockRangedWeaponsProps) {
  // ===== Refs =====
  // wand: 구체 (에너지 볼트)
  const wandRef = useRef<THREE.InstancedMesh>(null);
  const wandCoreRef = useRef<THREE.InstancedMesh>(null);
  // knife: 사면체 (회전 투척)
  const knifeRef = useRef<THREE.InstancedMesh>(null);
  // bow: 콘/실린더 (화살)
  const bowRef = useRef<THREE.InstancedMesh>(null);
  // bible: 토러스 (공전 궤도)
  const bibleRef = useRef<THREE.InstancedMesh>(null);
  const bibleCoreRef = useRef<THREE.InstancedMesh>(null);
  // garlic: 반투명 구체 (AOE 오라)
  const garlicRef = useRef<THREE.InstancedMesh>(null);
  const garlicCoreRef = useRef<THREE.InstancedMesh>(null);

  // ===== Geometries (블록 스케일) =====
  const geometries = useMemo(() => ({
    // wand: 구체 (에너지 볼트) — 기획서: 구체
    wandOuter: new THREE.SphereGeometry(0.25, 12, 12),
    wandCore: new THREE.SphereGeometry(0.1, 8, 8),
    // knife: 사면체 (날카로운 투척) — 기획서: 사면체
    knife: new THREE.TetrahedronGeometry(0.2, 0),
    // bow: 콘 (화살) — 기획서: 실린더
    bow: new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
    // bible: 토러스 (공전 궤도) — 기획서: 토러스
    bibleOuter: new THREE.TorusGeometry(0.3, 0.08, 8, 16),
    bibleCore: new THREE.SphereGeometry(0.12, 8, 8),
    // garlic: 반투명 구체 (AOE) — 기획서: 반투명 구체
    garlicOuter: new THREE.SphereGeometry(1.0, 16, 16),
    garlicCore: new THREE.SphereGeometry(0.3, 8, 8),
  }), []);

  // ===== Materials =====
  const materials = useMemo(() => ({
    // wand: 블루 에너지
    wandOuter: new THREE.MeshStandardMaterial({
      color: '#1E3A8A',
      emissive: '#3B82F6',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.8,
    }),
    wandCore: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#93C5FD',
      emissiveIntensity: 0.9,
    }),
    // knife: 레드 스틸
    knife: new THREE.MeshStandardMaterial({
      color: '#7F1D1D',
      emissive: '#EF4444',
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.3,
    }),
    // bow: 시안 화살
    bow: new THREE.MeshStandardMaterial({
      color: '#164E63',
      emissive: '#22D3EE',
      emissiveIntensity: 0.5,
    }),
    // bible: 그린 에너지
    bibleOuter: new THREE.MeshStandardMaterial({
      color: '#14532D',
      emissive: '#4ADE80',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7,
    }),
    bibleCore: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#4ADE80',
      emissiveIntensity: 0.8,
    }),
    // garlic: 반투명 그린 오라
    garlicOuter: new THREE.MeshStandardMaterial({
      color: '#22C55E',
      emissive: '#22C55E',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    }),
    garlicCore: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#22C55E',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.4,
    }),
  }), []);

  useFrame(() => {
    const projectiles = projectilesRef.current;
    if (!projectiles) return;

    const time = performance.now();

    let wandCount = 0;
    let wandCoreCount = 0;
    let knifeCount = 0;
    let bowCount = 0;
    let bibleCount = 0;
    let bibleCoreCount = 0;
    let garlicCount = 0;
    let garlicCoreCount = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i] as any;
      if (!p || p.life <= 0) continue;

      const weaponType = p.weaponType || p.type;

      // 블록 좌표 네이티브 — WORLD_SCALE=1, Z 반전 없음
      const px = p.position?.x ?? p.x ?? 0;
      const pz = p.position?.y ?? p.y ?? 0; // 2D y → 3D z
      const terrainY = getMCTerrainHeight(px, pz) + PROJECTILE_Y_OFFSET;
      const angle = p.angle || 0;
      const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
      const radius = p.radius || 0.4; // 블록 단위

      switch (weaponType) {
        // ===== WAND: 구체 유도탄 =====
        case 'wand': {
          const wandScale = Math.max(0.5, radius * 2);
          const pulse = 1 + Math.sin(time / 150 + i * 0.7) * 0.15;

          // 외곽 구체
          if (wandRef.current && wandCount < CAPACITY) {
            _pos.set(px, terrainY, pz);
            _euler.set(
              time / (800 + i * 10) * 0.5,
              -angle + time / (600 + i * 5),
              0
            );
            _quat.setFromEuler(_euler);
            const s = wandScale * pulse;
            _scale.set(s, s, s);
            _mat4.compose(_pos, _quat, _scale);
            wandRef.current.setMatrixAt(wandCount, _mat4);

            // 유도탄 색상 (파란 계열)
            _color.setRGB(0.23, 0.51, 0.96);
            wandRef.current.setColorAt(wandCount, _color);
            wandCount++;
          }

          // 코어
          if (wandCoreRef.current && wandCoreCount < CAPACITY) {
            const corePulse = 0.85 + Math.sin(time / 50 + i * 0.5) * 0.15;
            const coreSize = wandScale * 0.4 * corePulse;
            _pos.set(px, terrainY, pz);
            _quat.identity();
            _scale.set(coreSize, coreSize, coreSize);
            _mat4.compose(_pos, _quat, _scale);
            wandCoreRef.current.setMatrixAt(wandCoreCount, _mat4);
            wandCoreCount++;
          }
          break;
        }

        // ===== KNIFE: 사면체 투척 =====
        case 'knife': {
          if (!knifeRef.current || knifeCount >= CAPACITY) break;
          const knifeRot = p.currentRotation ?? angle;
          const knifeScale = Math.max(0.5, radius * 2);

          _pos.set(px, terrainY, pz);
          // 사면체 회전 (던지면서 회전)
          _euler.set(knifeRot * 0.5, -knifeRot, knifeRot * 0.3);
          _quat.setFromEuler(_euler);
          _scale.set(knifeScale, knifeScale, knifeScale);
          _mat4.compose(_pos, _quat, _scale);
          knifeRef.current.setMatrixAt(knifeCount, _mat4);

          _color.setRGB(0.94, 0.27, 0.27); // 레드
          knifeRef.current.setColorAt(knifeCount, _color);
          knifeCount++;
          break;
        }

        // ===== BOW: 실린더 화살 =====
        case 'bow': {
          if (!bowRef.current || bowCount >= CAPACITY) break;
          const bowScale = Math.max(0.5, radius * 2);

          _pos.set(px, terrainY, pz);
          // 실린더: 기본 Y축 → 화살 비행 방향으로 회전
          _euler.set(0, -angle, -Math.PI / 2);
          _quat.setFromEuler(_euler);
          _scale.set(bowScale, bowScale, bowScale);
          _mat4.compose(_pos, _quat, _scale);
          bowRef.current.setMatrixAt(bowCount, _mat4);

          _color.setRGB(0.13, 0.83, 0.93); // 시안
          bowRef.current.setColorAt(bowCount, _color);
          bowCount++;
          break;
        }

        // ===== BIBLE: 토러스 공전 =====
        case 'bible': {
          // 토러스 외곽
          if (bibleRef.current && bibleCount < CAPACITY) {
            const orbitPulse = 1 + Math.sin(time / 200 + i * 1.5) * 0.1;
            const bibleScale = Math.max(0.5, radius * 2) * orbitPulse;

            _pos.set(px, terrainY, pz);
            // 토러스 수평 배치 + 궤도 각도에 따라 약간 기울어짐
            const orbitAngle = p.orbitAngle ?? 0;
            _euler.set(
              Math.sin(orbitAngle) * 0.3, // 약간의 좌우 기울기
              orbitAngle,
              Math.PI / 2 // 수평 눕힘
            );
            _quat.setFromEuler(_euler);
            _scale.set(bibleScale, bibleScale, bibleScale);
            _mat4.compose(_pos, _quat, _scale);
            bibleRef.current.setMatrixAt(bibleCount, _mat4);

            _color.setRGB(0.29, 0.87, 0.5); // 그린
            bibleRef.current.setColorAt(bibleCount, _color);
            bibleCount++;
          }

          // 코어
          if (bibleCoreRef.current && bibleCoreCount < CAPACITY) {
            const corePulse = 0.85 + Math.sin(time / 60 + i * 0.7) * 0.15;
            const coreSize = radius * corePulse;
            _pos.set(px, terrainY, pz);
            _euler.set(time / 500, time / 300, 0);
            _quat.setFromEuler(_euler);
            _scale.set(coreSize, coreSize, coreSize);
            _mat4.compose(_pos, _quat, _scale);
            bibleCoreRef.current.setMatrixAt(bibleCoreCount, _mat4);
            bibleCoreCount++;
          }
          break;
        }

        // ===== GARLIC: 반투명 구체 AOE =====
        case 'garlic': {
          const garlicPulse = 1 + Math.sin(time / 300 + i * 0.5) * 0.08;
          const aoeRadius = radius * garlicPulse;

          // 외곽 반투명 구체 (AOE 범위)
          if (garlicRef.current && garlicCount < CAPACITY) {
            _pos.set(px, terrainY - 0.5, pz); // 약간 아래로 (플레이어 중심)
            _quat.identity();
            _scale.set(aoeRadius, aoeRadius * 0.6, aoeRadius); // 약간 납작하게
            _mat4.compose(_pos, _quat, _scale);
            garlicRef.current.setMatrixAt(garlicCount, _mat4);

            // 히트 시 밝아지는 효과
            const flashAmount = Math.sin(time / 100) * 0.03;
            _color.setRGB(0.13 + flashAmount, 0.77 + flashAmount, 0.37 + flashAmount);
            garlicRef.current.setColorAt(garlicCount, _color);
            garlicCount++;
          }

          // 코어 (중심부 빛)
          if (garlicCoreRef.current && garlicCoreCount < CAPACITY) {
            const corePulse = 0.8 + Math.sin(time / 80 + i) * 0.2;
            const coreSize = 0.3 * corePulse;
            _pos.set(px, terrainY, pz);
            _euler.set(time / 700, time / 500, 0);
            _quat.setFromEuler(_euler);
            _scale.set(coreSize, coreSize, coreSize);
            _mat4.compose(_pos, _quat, _scale);
            garlicCoreRef.current.setMatrixAt(garlicCoreCount, _mat4);
            garlicCoreCount++;
          }
          break;
        }
      }
    }

    // count 설정 + flush
    setCountAndFlush(wandRef.current, wandCount);
    setCountAndFlush(wandCoreRef.current, wandCoreCount);
    setCountAndFlush(knifeRef.current, knifeCount);
    setCountAndFlush(bowRef.current, bowCount);
    setCountAndFlush(bibleRef.current, bibleCount);
    setCountAndFlush(bibleCoreRef.current, bibleCoreCount);
    setCountAndFlush(garlicRef.current, garlicCount);
    setCountAndFlush(garlicCoreRef.current, garlicCoreCount);
  });

  return (
    <group>
      {/* wand: 구체 유도탄 */}
      <instancedMesh ref={wandRef} args={[geometries.wandOuter, materials.wandOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={wandCoreRef} args={[geometries.wandCore, materials.wandCore, CAPACITY]} frustumCulled={false} />

      {/* knife: 사면체 투척 */}
      <instancedMesh ref={knifeRef} args={[geometries.knife, materials.knife, CAPACITY]} frustumCulled={false} />

      {/* bow: 실린더 화살 */}
      <instancedMesh ref={bowRef} args={[geometries.bow, materials.bow, CAPACITY]} frustumCulled={false} />

      {/* bible: 토러스 공전 */}
      <instancedMesh ref={bibleRef} args={[geometries.bibleOuter, materials.bibleOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={bibleCoreRef} args={[geometries.bibleCore, materials.bibleCore, CAPACITY]} frustumCulled={false} />

      {/* garlic: 반투명 구체 AOE */}
      <instancedMesh ref={garlicRef} args={[geometries.garlicOuter, materials.garlicOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={garlicCoreRef} args={[geometries.garlicCore, materials.garlicCore, CAPACITY]} frustumCulled={false} />
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
