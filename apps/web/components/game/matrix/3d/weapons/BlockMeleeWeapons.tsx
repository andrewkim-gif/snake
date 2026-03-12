/**
 * 3d/weapons/BlockMeleeWeapons.tsx — 블록 좌표 근접 무기 3D 렌더러
 * v42 Phase 2: MeleeWeapons.tsx 복사 → 블록 좌표 네이티브 변환
 *
 * 핵심 변경 (기존 MeleeWeapons.tsx 대비):
 *   - WORLD_SCALE = 1 (기존 1/50)
 *   - Z축 반전 제거: pz 직접 사용 (기존 -py)
 *   - Y 높이: getMCTerrainHeight(px, pz) + 1.5 (지형 위 플레이어 가슴 높이)
 *   - radius 스케일링 제거 (이미 블록 단위)
 *
 * 근접 무기: whip(체인 트레일), punch(충격파), axe(회전 큐브), sword(참격 호)
 */

'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Projectile } from '@/lib/matrix/types';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';

// ===== 공통 상수 =====
const PROJECTILE_Y_OFFSET = 1.5; // 지형 위 플레이어 가슴 높이

// 임시 연산용 (GC 방지)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();
const _zeroScale = new THREE.Matrix4().makeScale(0, 0, 0);

// ===== 인터페이스 =====
interface BlockMeleeWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
}

// ===== 용량 상수 =====
const WHIP_CAPACITY = 200;
const WHIP_SEGMENTS = 6;
const PUNCH_CAPACITY = 200;
const AXE_CAPACITY = 200;
const SWORD_CAPACITY = 200;

export default function BlockMeleeWeapons({ projectilesRef }: BlockMeleeWeaponsProps) {
  // ===== whip refs =====
  const whipRef = useRef<THREE.InstancedMesh>(null);

  // ===== punch refs =====
  const punchRingRef = useRef<THREE.InstancedMesh>(null);
  const punchCoreRef = useRef<THREE.InstancedMesh>(null);

  // ===== axe refs =====
  const axeRef = useRef<THREE.InstancedMesh>(null);

  // ===== sword refs =====
  const swordRef = useRef<THREE.InstancedMesh>(null);
  const swordArcRef = useRef<THREE.InstancedMesh>(null);

  // ===== Geometries (한 번만 생성) — 블록 스케일 (2x 기존) =====
  const geometries = useMemo(() => ({
    // whip: 체인 세그먼트 (블록 스케일)
    whipLink: new THREE.BoxGeometry(0.3, 0.12, 0.12),
    // punch: 링 지오메트리 (충격파)
    punchRing: new THREE.RingGeometry(0.6, 1.0, 32),
    // punch: 코어 구체
    punchCore: new THREE.SphereGeometry(0.3, 8, 8),
    // axe: 큐브 파편 (블록 스케일)
    axeCube: new THREE.BoxGeometry(0.24, 0.24, 0.24),
    // sword: 칼날 (블록 스케일)
    swordBlade: new THREE.BoxGeometry(1.2, 0.08, 0.16),
    // sword: 호 슬래시 (Torus arc, 블록 스케일)
    swordArc: new THREE.TorusGeometry(1.0, 0.06, 4, 16, Math.PI * 0.6),
  }), []);

  // ===== Materials (한 번만 생성) =====
  const materials = useMemo(() => ({
    whip: new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#EF4444',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.9,
    }),
    punchRing: new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#EF4444',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }),
    punchCore: new THREE.MeshStandardMaterial({
      color: '#FCA5A5',
      emissive: '#EF4444',
      emissiveIntensity: 0.6,
    }),
    axe: new THREE.MeshStandardMaterial({
      color: '#3B82F6',
      emissive: '#3B82F6',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    }),
    sword: new THREE.MeshStandardMaterial({
      color: '#374151',
      emissive: '#EF4444',
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    }),
    swordArc: new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#EF4444',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    }),
  }), []);

  // ===== useFrame (priority=0) =====
  useFrame((_state, _delta) => {
    const projectiles = projectilesRef.current;
    if (!projectiles) return;

    const time = performance.now();

    let whipCount = 0;
    let punchRingCount = 0;
    let punchCoreCount = 0;
    let axeCount = 0;
    let swordCount = 0;
    let swordArcCount = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i] as any;
      if (!p || p.life <= 0) continue;

      const weaponType = p.weaponType || p.type;

      // 블록 좌표 네이티브 — WORLD_SCALE=1, Z 반전 없음
      const px = p.position?.x ?? p.x ?? 0;
      const pz = p.position?.y ?? p.y ?? 0; // 2D y → 3D z
      const terrainY = getMCTerrainHeight(px, pz);
      const angle = p.angle || 0;
      const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
      const radius = p.radius || 1; // 블록 단위 (스케일링 불필요)

      switch (weaponType) {
        // ===== WHIP: 체인 트레일 =====
        case 'whip': {
          if (!whipRef.current) break;
          const whipLength = Math.max(1.2, radius * 1.8);
          const swingProgress = 1 - lifeRatio;
          const swingAngle = (-Math.PI * 0.33) + swingProgress * (Math.PI * 0.77);

          for (let seg = 0; seg < WHIP_SEGMENTS && whipCount < WHIP_CAPACITY; seg++) {
            const t = seg / WHIP_SEGMENTS;
            const segDist = whipLength * t;
            const curvature = Math.sin(t * Math.PI) * 0.3;
            const wobble = Math.sin(time / 40 + seg * 0.8) * 0.02 * (1 - t * 0.5);

            const totalAngle = angle + swingAngle;
            const segX = px + Math.cos(totalAngle) * segDist + Math.sin(totalAngle) * curvature;
            const segZ = pz + Math.sin(totalAngle) * segDist - Math.cos(totalAngle) * curvature;
            const segScale = 1 - t * 0.35;

            const segTerrainY = terrainY + PROJECTILE_Y_OFFSET + wobble;

            _pos.set(segX, segTerrainY, segZ);
            _euler.set(0, -totalAngle, 0);
            _quat.setFromEuler(_euler);
            _scale.set(segScale * 1.5, segScale, segScale);
            _mat4.compose(_pos, _quat, _scale);
            whipRef.current.setMatrixAt(whipCount, _mat4);

            // 선두 세그먼트는 더 밝게
            const brightness = 0.3 + (1 - t) * 0.7;
            _color.setRGB(brightness, brightness * 0.3, brightness * 0.3);
            whipRef.current.setColorAt(whipCount, _color);

            whipCount++;
          }
          break;
        }

        // ===== PUNCH: 충격파 링 + 코어 =====
        case 'punch': {
          const impactProgress = 1 - lifeRatio;
          const ringScale = 0.5 + impactProgress * 2.5;
          const ringOpacity = Math.max(0, 1 - impactProgress);

          // 링 (확장) — 지면 가까이
          if (punchRingRef.current && punchRingCount < PUNCH_CAPACITY) {
            _pos.set(px, terrainY + 0.1, pz);
            _euler.set(-Math.PI / 2, 0, 0); // 수평으로 눕힘
            _quat.setFromEuler(_euler);
            _scale.set(ringScale * radius * 2, ringScale * radius * 2, 1);
            _mat4.compose(_pos, _quat, _scale);
            punchRingRef.current.setMatrixAt(punchRingCount, _mat4);

            _color.setRGB(0.94 * ringOpacity, 0.27 * ringOpacity, 0.27 * ringOpacity);
            punchRingRef.current.setColorAt(punchRingCount, _color);
            punchRingCount++;
          }

          // 코어 (펀치 중심)
          if (punchCoreRef.current && punchCoreCount < PUNCH_CAPACITY) {
            const coreScale = radius * (1 + impactProgress * 0.5);
            _pos.set(px, terrainY + PROJECTILE_Y_OFFSET, pz);
            _quat.identity();
            _scale.set(coreScale, coreScale, coreScale);
            _mat4.compose(_pos, _quat, _scale);
            punchCoreRef.current.setMatrixAt(punchCoreCount, _mat4);
            punchCoreCount++;
          }
          break;
        }

        // ===== AXE: 산개 큐브 투사체 =====
        case 'axe': {
          if (!axeRef.current) break;
          const rotation = p.currentRotation ?? (time / 100 + angle);
          const axeScale = radius * 1.5;

          if (axeCount < AXE_CAPACITY) {
            _pos.set(px, terrainY + PROJECTILE_Y_OFFSET, pz);
            _euler.set(rotation * 0.5, rotation, rotation * 0.3);
            _quat.setFromEuler(_euler);
            _scale.set(axeScale, axeScale, axeScale);
            _mat4.compose(_pos, _quat, _scale);
            axeRef.current.setMatrixAt(axeCount, _mat4);

            // TERRITORY 블루
            _color.setRGB(0.23, 0.51, 0.96);
            axeRef.current.setColorAt(axeCount, _color);
            axeCount++;
          }
          break;
        }

        // ===== SWORD: 호형 참격파 =====
        case 'sword': {
          const swingProgress2 = 1 - lifeRatio;
          const swingEase = easeOutElastic(swingProgress2);
          const swingAngle2 = swingEase * Math.PI - Math.PI / 2;
          const totalAngle2 = angle + swingAngle2;
          const bladeLength = Math.max(0.8, radius * 0.9);

          // 칼날
          if (swordRef.current && swordCount < SWORD_CAPACITY) {
            const bladeX = px + Math.cos(totalAngle2) * bladeLength * 0.5;
            const bladeZ = pz + Math.sin(totalAngle2) * bladeLength * 0.5;

            _pos.set(bladeX, terrainY + PROJECTILE_Y_OFFSET + 0.2, bladeZ);
            _euler.set(0, -totalAngle2, 0);
            _quat.setFromEuler(_euler);
            _scale.set(bladeLength * 2, 1, 1);
            _mat4.compose(_pos, _quat, _scale);
            swordRef.current.setMatrixAt(swordCount, _mat4);
            swordCount++;
          }

          // 참격파 호 (슬래시 궤적)
          if (swordArcRef.current && swordArcCount < SWORD_CAPACITY && swingProgress2 > 0.3) {
            const arcScale = radius * 1.8;
            const arcAlpha = Math.max(0, (1 - swingProgress2) * 2);

            _pos.set(px, terrainY + PROJECTILE_Y_OFFSET + 0.3, pz);
            _euler.set(-Math.PI / 2, -totalAngle2, 0);
            _quat.setFromEuler(_euler);
            _scale.set(arcScale, arcScale, arcScale);
            _mat4.compose(_pos, _quat, _scale);
            swordArcRef.current.setMatrixAt(swordArcCount, _mat4);

            _color.setRGB(0.94 * arcAlpha, 0.27 * arcAlpha, 0.27 * arcAlpha);
            swordArcRef.current.setColorAt(swordArcCount, _color);
            swordArcCount++;
          }
          break;
        }
      }
    }

    // 남은 인스턴스 숨기기 + flush
    hideRemaining(whipRef.current, whipCount, WHIP_CAPACITY);
    hideRemaining(punchRingRef.current, punchRingCount, PUNCH_CAPACITY);
    hideRemaining(punchCoreRef.current, punchCoreCount, PUNCH_CAPACITY);
    hideRemaining(axeRef.current, axeCount, AXE_CAPACITY);
    hideRemaining(swordRef.current, swordCount, SWORD_CAPACITY);
    hideRemaining(swordArcRef.current, swordArcCount, SWORD_CAPACITY);

    flushMesh(whipRef.current, whipCount);
    flushMesh(punchRingRef.current, punchRingCount);
    flushMesh(punchCoreRef.current, punchCoreCount);
    flushMesh(axeRef.current, axeCount);
    flushMesh(swordRef.current, swordCount);
    flushMesh(swordArcRef.current, swordArcCount);
  });

  return (
    <group>
      {/* whip: 체인 세그먼트 */}
      <instancedMesh
        ref={whipRef}
        args={[geometries.whipLink, materials.whip, WHIP_CAPACITY]}
        frustumCulled={false}
      />
      {/* punch: 충격파 링 */}
      <instancedMesh
        ref={punchRingRef}
        args={[geometries.punchRing, materials.punchRing, PUNCH_CAPACITY]}
        frustumCulled={false}
      />
      {/* punch: 코어 */}
      <instancedMesh
        ref={punchCoreRef}
        args={[geometries.punchCore, materials.punchCore, PUNCH_CAPACITY]}
        frustumCulled={false}
      />
      {/* axe: 큐브 파편 */}
      <instancedMesh
        ref={axeRef}
        args={[geometries.axeCube, materials.axe, AXE_CAPACITY]}
        frustumCulled={false}
      />
      {/* sword: 칼날 */}
      <instancedMesh
        ref={swordRef}
        args={[geometries.swordBlade, materials.sword, SWORD_CAPACITY]}
        frustumCulled={false}
      />
      {/* sword: 참격 호 */}
      <instancedMesh
        ref={swordArcRef}
        args={[geometries.swordArc, materials.swordArc, SWORD_CAPACITY]}
        frustumCulled={false}
      />
    </group>
  );
}

// ===== 유틸리티 =====

/** easeOutElastic 이징 함수 */
function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

/** 사용 안 된 인스턴스 숨기기 */
function hideRemaining(
  mesh: THREE.InstancedMesh | null,
  usedCount: number,
  prevCount: number
): void {
  if (!mesh) return;
  for (let i = usedCount; i < Math.min(prevCount, mesh.count); i++) {
    mesh.setMatrixAt(i, _zeroScale);
  }
}

/** GPU flush */
function flushMesh(mesh: THREE.InstancedMesh | null, count: number): void {
  if (!mesh) return;
  mesh.count = count;
  if (count > 0 || mesh.instanceMatrix.needsUpdate) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
