/**
 * 3d/weapons/SpecialWeapons.tsx - 특수 무기 3D 렌더러
 * v38 Phase 4 (S31): bridge, beam, laser
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

interface SpecialWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
}

export default function SpecialWeapons({ projectilesRef }: SpecialWeaponsProps) {
  // ===== Refs =====
  // bridge: 배리어/냉각 세그먼트
  const bridgeSegRef = useRef<THREE.InstancedMesh>(null);
  const bridgeNodeRef = useRef<THREE.InstancedMesh>(null);

  // beam: 직선 에너지 빔 (실린더)
  const beamBodyRef = useRef<THREE.InstancedMesh>(null);
  const beamCoreRef = useRef<THREE.InstancedMesh>(null);
  const beamEmitterRef = useRef<THREE.InstancedMesh>(null);
  const beamImpactRef = useRef<THREE.InstancedMesh>(null);

  // laser: 회전 레이저 (실린더)
  const laserBodyRef = useRef<THREE.InstancedMesh>(null);
  const laserCoreRef = useRef<THREE.InstancedMesh>(null);
  const laserOriginRef = useRef<THREE.InstancedMesh>(null);

  // ===== Geometries =====
  const geometries = useMemo(() => ({
    // bridge: 체인 세그먼트 (작은 박스)
    bridgeSeg: new THREE.BoxGeometry(0.2, 0.08, 0.06),
    // bridge: 결정 노드 (팔면체)
    bridgeNode: new THREE.OctahedronGeometry(0.1, 0),
    // beam: 빔 본체 (실린더 — 길이 조절)
    beamBody: new THREE.CylinderGeometry(0.04, 0.04, 1, 8),
    // beam: 코어 (더 얇은 실린더)
    beamCore: new THREE.CylinderGeometry(0.015, 0.015, 1, 6),
    // beam: 이미터 (구체)
    beamEmitter: new THREE.SphereGeometry(0.1, 12, 12),
    // beam: 임팩트 (구체)
    beamImpact: new THREE.SphereGeometry(0.15, 8, 8),
    // laser: 빔 본체 (실린더)
    laserBody: new THREE.CylinderGeometry(0.035, 0.035, 1, 8),
    // laser: 코어
    laserCore: new THREE.CylinderGeometry(0.012, 0.012, 1, 6),
    // laser: 원점 구체
    laserOrigin: new THREE.SphereGeometry(0.12, 12, 12),
  }), []);

  // ===== Materials =====
  const materials = useMemo(() => ({
    // ALLIANCE 퍼플 (bridge)
    bridgeSeg: new THREE.MeshStandardMaterial({
      color: '#8B5CF6',
      emissive: '#8B5CF6',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.8,
    }),
    bridgeNode: new THREE.MeshStandardMaterial({
      color: '#1A103D',
      emissive: '#8B5CF6',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9,
    }),
    // MORALE 시안 (beam)
    beamBody: new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#06B6D4',
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85,
    }),
    beamCore: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#22D3EE',
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.9,
    }),
    beamEmitter: new THREE.MeshStandardMaterial({
      color: '#164E63',
      emissive: '#06B6D4',
      emissiveIntensity: 0.6,
    }),
    beamImpact: new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#06B6D4',
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
    }),
    // MORALE 시안 (laser)
    laserBody: new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#06B6D4',
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.9,
    }),
    laserCore: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#22D3EE',
      emissiveIntensity: 0.9,
    }),
    laserOrigin: new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#06B6D4',
      emissiveIntensity: 0.8,
    }),
  }), []);

  useFrame(() => {
    const projectiles = projectilesRef.current;
    if (!projectiles) return;

    const time = performance.now();

    let bridgeSegCount = 0;
    let bridgeNodeCount = 0;
    let beamBodyCount = 0;
    let beamCoreCount = 0;
    let beamEmitterCount = 0;
    let beamImpactCount = 0;
    let laserBodyCount = 0;
    let laserCoreCount = 0;
    let laserOriginCount = 0;

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
        // ===== BRIDGE: 배리어/냉각 체인 =====
        case 'bridge': {
          const progress = 1 - lifeRatio;
          const bridgeScale = Math.max(0.4, radius / 0.2);
          const totalLength = 1.6 * bridgeScale;
          const segCount = 8;

          // 체인 세그먼트
          if (bridgeSegRef.current) {
            for (let seg = 0; seg < segCount && bridgeSegCount < CAPACITY; seg++) {
              const t = seg / segCount;
              const segX = px + Math.cos(angle) * totalLength * t;
              const segY = py + Math.sin(angle) * totalLength * t;
              const waveAmplitude = 0.08 * bridgeScale;
              const wave = Math.sin(time / 90 + t * Math.PI * 4) * waveAmplitude;

              _pos.set(segX, Y_OFFSET + wave, -segY);
              _euler.set(0, -angle, 0);
              _quat.setFromEuler(_euler);
              const s = Math.max(0.3, bridgeScale * (1 - progress * 0.3));
              _scale.set(s, s, s);
              _mat4.compose(_pos, _quat, _scale);
              bridgeSegRef.current.setMatrixAt(bridgeSegCount, _mat4);

              // 퍼플 + 아이스 톤 혼합
              const blueBlend = 0.5 + Math.sin(time / 200 + seg) * 0.3;
              _color.setRGB(
                0.55 * (1 - blueBlend) + 0.6 * blueBlend,
                0.36 * (1 - blueBlend) + 0.8 * blueBlend,
                0.96 * (1 - blueBlend) + 1.0 * blueBlend
              );
              bridgeSegRef.current.setColorAt(bridgeSegCount, _color);
              bridgeSegCount++;
            }
          }

          // 결정 노드 (양 끝 + 중간)
          if (bridgeNodeRef.current) {
            const nodePositions = [0.15, 0.5, 0.85];
            for (const nodeT of nodePositions) {
              if (bridgeNodeCount >= CAPACITY) break;
              const nodeX = px + Math.cos(angle) * totalLength * nodeT;
              const nodeY = py + Math.sin(angle) * totalLength * nodeT;
              const wave = Math.sin(time / 90 + nodeT * Math.PI * 4) * 0.08 * bridgeScale;
              const bounceScale2 = 1.1 + Math.sin(time / 500 + nodeT * 3) * 0.12;

              _pos.set(nodeX, Y_OFFSET + wave, -nodeY);
              _euler.set(time / 400, time / 300, 0);
              _quat.setFromEuler(_euler);
              const ns = bridgeScale * bounceScale2 * 0.8;
              _scale.set(ns, ns, ns);
              _mat4.compose(_pos, _quat, _scale);
              bridgeNodeRef.current.setMatrixAt(bridgeNodeCount, _mat4);
              bridgeNodeCount++;
            }
          }
          break;
        }

        // ===== BEAM: 직선 에너지 빔 =====
        case 'beam': {
          const beamWidth = ((p.width || 20) * 0.45) * WORLD_SCALE;
          const beamLength = (p.height || 600) * WORLD_SCALE;
          const progress = 1 - lifeRatio;

          let beamScale2 = 1;
          if (progress < 0.15) {
            beamScale2 = easeOutBack(progress / 0.15);
          } else if (progress > 0.85) {
            beamScale2 = 1 - (progress - 0.85) / 0.15 * 0.5;
          }
          beamScale2 = Math.max(0.1, beamScale2);

          const actualLength = beamLength * beamScale2;
          const flicker = 0.88 + Math.sin(time / 18) * 0.12;

          // 이미터 (원점 구체)
          if (beamEmitterRef.current && beamEmitterCount < CAPACITY) {
            _pos.set(px, Y_OFFSET, -py);
            _quat.identity();
            _scale.set(flicker, flicker, flicker);
            _mat4.compose(_pos, _quat, _scale);
            beamEmitterRef.current.setMatrixAt(beamEmitterCount, _mat4);
            beamEmitterCount++;
          }

          // 빔 본체 (실린더 — 눕혀서 방향 맞춤)
          if (beamBodyRef.current && beamBodyCount < CAPACITY) {
            const midX = px + Math.cos(angle) * actualLength * 0.5;
            const midY = py + Math.sin(angle) * actualLength * 0.5;

            _pos.set(midX, Y_OFFSET, -midY);
            _euler.set(0, -angle, Math.PI / 2); // 실린더를 수평으로 눕힘
            _quat.setFromEuler(_euler);
            // 실린더의 height를 actualLength로 스케일
            _scale.set(beamWidth * 2 * flicker, actualLength, beamWidth * 2 * flicker);
            _mat4.compose(_pos, _quat, _scale);
            beamBodyRef.current.setMatrixAt(beamBodyCount, _mat4);
            beamBodyCount++;
          }

          // 코어 빔 (더 얇고 밝은)
          if (beamCoreRef.current && beamCoreCount < CAPACITY) {
            const corePulse = 0.85 + Math.sin(time / 30) * 0.15;
            const midX = px + Math.cos(angle) * actualLength * 0.375;
            const midY = py + Math.sin(angle) * actualLength * 0.375;

            _pos.set(midX, Y_OFFSET, -midY);
            _euler.set(0, -angle, Math.PI / 2);
            _quat.setFromEuler(_euler);
            _scale.set(beamWidth * corePulse, actualLength * 0.75, beamWidth * corePulse);
            _mat4.compose(_pos, _quat, _scale);
            beamCoreRef.current.setMatrixAt(beamCoreCount, _mat4);
            beamCoreCount++;
          }

          // 임팩트 (빔 끝)
          if (beamImpactRef.current && beamImpactCount < CAPACITY && beamScale2 > 0.5) {
            const endX = px + Math.cos(angle) * actualLength;
            const endY = py + Math.sin(angle) * actualLength;
            const impactPulse = 0.8 + Math.sin(time / 50) * 0.2;

            _pos.set(endX, Y_OFFSET, -endY);
            _quat.identity();
            _scale.set(impactPulse, impactPulse, impactPulse);
            _mat4.compose(_pos, _quat, _scale);
            beamImpactRef.current.setMatrixAt(beamImpactCount, _mat4);
            beamImpactCount++;
          }
          break;
        }

        // ===== LASER: 회전 레이저 =====
        case 'laser': {
          const laserLength = (p.radius || 100) * WORLD_SCALE;
          const laserAngle = p.angle || 0;
          const progress = 1 - lifeRatio;

          let beamAlpha2 = 1;
          if (progress < 0.1) {
            beamAlpha2 = progress / 0.1;
          } else if (progress > 0.9) {
            beamAlpha2 = 1 - (progress - 0.9) / 0.1;
          }
          beamAlpha2 = Math.max(0.1, beamAlpha2);

          const flicker = 0.92 + Math.sin(time / 12) * 0.08;

          // 원점 구체
          if (laserOriginRef.current && laserOriginCount < CAPACITY) {
            _pos.set(px, Y_OFFSET, -py);
            _quat.identity();
            _scale.set(flicker, flicker, flicker);
            _mat4.compose(_pos, _quat, _scale);
            laserOriginRef.current.setMatrixAt(laserOriginCount, _mat4);
            laserOriginCount++;
          }

          // 레이저 빔 본체
          if (laserBodyRef.current && laserBodyCount < CAPACITY) {
            const midX = px + Math.cos(laserAngle) * laserLength * 0.5;
            const midY = py + Math.sin(laserAngle) * laserLength * 0.5;

            _pos.set(midX, Y_OFFSET, -midY);
            _euler.set(0, -laserAngle, Math.PI / 2);
            _quat.setFromEuler(_euler);
            _scale.set(beamAlpha2 * flicker, laserLength, beamAlpha2 * flicker);
            _mat4.compose(_pos, _quat, _scale);
            laserBodyRef.current.setMatrixAt(laserBodyCount, _mat4);
            laserBodyCount++;
          }

          // 레이저 코어
          if (laserCoreRef.current && laserCoreCount < CAPACITY) {
            const corePulse = 0.88 + Math.sin(time / 20) * 0.12;
            const midX = px + Math.cos(laserAngle) * laserLength * 0.375;
            const midY = py + Math.sin(laserAngle) * laserLength * 0.375;

            _pos.set(midX, Y_OFFSET, -midY);
            _euler.set(0, -laserAngle, Math.PI / 2);
            _quat.setFromEuler(_euler);
            _scale.set(corePulse * beamAlpha2, laserLength * 0.75, corePulse * beamAlpha2);
            _mat4.compose(_pos, _quat, _scale);
            laserCoreRef.current.setMatrixAt(laserCoreCount, _mat4);
            laserCoreCount++;
          }
          break;
        }
      }
    }

    // count 설정 + flush
    setCountAndFlush(bridgeSegRef.current, bridgeSegCount);
    setCountAndFlush(bridgeNodeRef.current, bridgeNodeCount);
    setCountAndFlush(beamBodyRef.current, beamBodyCount);
    setCountAndFlush(beamCoreRef.current, beamCoreCount);
    setCountAndFlush(beamEmitterRef.current, beamEmitterCount);
    setCountAndFlush(beamImpactRef.current, beamImpactCount);
    setCountAndFlush(laserBodyRef.current, laserBodyCount);
    setCountAndFlush(laserCoreRef.current, laserCoreCount);
    setCountAndFlush(laserOriginRef.current, laserOriginCount);
  });

  return (
    <group>
      {/* bridge */}
      <instancedMesh ref={bridgeSegRef} args={[geometries.bridgeSeg, materials.bridgeSeg, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={bridgeNodeRef} args={[geometries.bridgeNode, materials.bridgeNode, CAPACITY]} frustumCulled={false} />

      {/* beam */}
      <instancedMesh ref={beamBodyRef} args={[geometries.beamBody, materials.beamBody, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={beamCoreRef} args={[geometries.beamCore, materials.beamCore, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={beamEmitterRef} args={[geometries.beamEmitter, materials.beamEmitter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={beamImpactRef} args={[geometries.beamImpact, materials.beamImpact, CAPACITY]} frustumCulled={false} />

      {/* laser */}
      <instancedMesh ref={laserBodyRef} args={[geometries.laserBody, materials.laserBody, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={laserCoreRef} args={[geometries.laserCore, materials.laserCore, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={laserOriginRef} args={[geometries.laserOrigin, materials.laserOrigin, CAPACITY]} frustumCulled={false} />
    </group>
  );
}

/** easeOutBack 이징 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(Math.max(0, Math.min(1, t)) - 1, 3) + c1 * Math.pow(Math.max(0, Math.min(1, t)) - 1, 2);
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
