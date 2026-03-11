/**
 * 3d/weapons/MeleeWeapons.tsx - 근접 무기 3D 렌더러
 * v38 Phase 4 (S28): whip, punch, axe, sword
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
const WORLD_SCALE = 1 / 50; // 2D 픽셀 → 3D 유닛 변환
const Y_OFFSET = 0.4; // 지면 위 높이

// 임시 연산용 (GC 방지)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();
const _zeroScale = new THREE.Matrix4().makeScale(0, 0, 0);

// ===== 인터페이스 =====
interface MeleeWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
}

// ===== whip: Trail mesh (라인 기반 체인 path) =====
// TubeGeometry 기반 체인 → InstancedMesh로 여러 세그먼트 렌더링
const WHIP_CAPACITY = 200;
const WHIP_SEGMENTS = 6; // 체인 세그먼트 수

// ===== punch: Shockwave ring (RingGeometry expand + fade) =====
const PUNCH_CAPACITY = 200;

// ===== axe: Scatter projectile (instanced small cubes) =====
const AXE_CAPACITY = 200;

// ===== sword: Arc slash (custom arc shape) =====
const SWORD_CAPACITY = 200;

export default function MeleeWeapons({ projectilesRef }: MeleeWeaponsProps) {
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

  // ===== Geometries (한 번만 생성) =====
  const geometries = useMemo(() => ({
    // whip: 작은 박스로 체인 세그먼트
    whipLink: new THREE.BoxGeometry(0.15, 0.06, 0.06),
    // punch: 링 지오메트리 (충격파)
    punchRing: new THREE.RingGeometry(0.3, 0.5, 32),
    // punch: 코어 구체
    punchCore: new THREE.SphereGeometry(0.15, 8, 8),
    // axe: 작은 큐브 파편
    axeCube: new THREE.BoxGeometry(0.12, 0.12, 0.12),
    // sword: 얇은 박스 (칼날)
    swordBlade: new THREE.BoxGeometry(0.6, 0.04, 0.08),
    // sword: 호 슬래시 (Torus arc)
    swordArc: new THREE.TorusGeometry(0.5, 0.03, 4, 16, Math.PI * 0.6),
  }), []);

  // ===== Materials (한 번만 생성) =====
  const materials = useMemo(() => ({
    // STEEL 컬러 (레드 계열)
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
    // TERRITORY 컬러 (블루 계열)
    axe: new THREE.MeshStandardMaterial({
      color: '#3B82F6',
      emissive: '#3B82F6',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    }),
    // STEEL 컬러 (레드 계열)
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
      const px = (p.position?.x ?? p.x ?? 0) * WORLD_SCALE;
      const py = (p.position?.y ?? p.y ?? 0) * WORLD_SCALE;
      const angle = p.angle || 0;
      const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
      const radius = (p.radius || 10) * WORLD_SCALE;

      switch (weaponType) {
        // ===== WHIP: 체인 트레일 =====
        case 'whip': {
          if (!whipRef.current) break;
          const whipLength = Math.max(0.6, radius * 3.6);
          const swingProgress = 1 - lifeRatio;
          const swingAngle = (-Math.PI * 0.33) + swingProgress * (Math.PI * 0.77);

          for (let seg = 0; seg < WHIP_SEGMENTS && whipCount < WHIP_CAPACITY; seg++) {
            const t = seg / WHIP_SEGMENTS;
            const segDist = whipLength * t;
            const curvature = Math.sin(t * Math.PI) * 0.3;
            const wobble = Math.sin(time / 40 + seg * 0.8) * 0.02 * (1 - t * 0.5);

            const totalAngle = angle + swingAngle;
            const segX = px + Math.cos(totalAngle) * segDist + Math.sin(totalAngle) * curvature;
            const segY = py + Math.sin(totalAngle) * segDist - Math.cos(totalAngle) * curvature;
            const segScale = 1 - t * 0.35;

            _pos.set(segX, Y_OFFSET + wobble, -segY);
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

          // 링 (확장)
          if (punchRingRef.current && punchRingCount < PUNCH_CAPACITY) {
            _pos.set(px, 0.05, -py); // 지면 가까이
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
            _pos.set(px, Y_OFFSET, -py);
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
            _pos.set(px, Y_OFFSET, -py);
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
          const bladeLength = Math.max(0.4, radius * 0.9);

          // 칼날
          if (swordRef.current && swordCount < SWORD_CAPACITY) {
            const bladeX = px + Math.cos(totalAngle2) * bladeLength * 0.5;
            const bladeY = py + Math.sin(totalAngle2) * bladeLength * 0.5;

            _pos.set(bladeX, Y_OFFSET + 0.1, -bladeY);
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

            _pos.set(px, Y_OFFSET + 0.15, -py);
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
  // 이전 프레임에서 사용했던 것 중 이번에 미사용된 것만 숨김
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
