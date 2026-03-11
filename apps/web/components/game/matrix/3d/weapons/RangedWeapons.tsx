/**
 * 3d/weapons/RangedWeapons.tsx - 원거리 무기 3D 렌더러
 * v38 Phase 4 (S29): knife, bow, ping, shard, airdrop, fork
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
const _zeroScale = new THREE.Matrix4().makeScale(0, 0, 0);

interface RangedWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
}

export default function RangedWeapons({ projectilesRef }: RangedWeaponsProps) {
  // ===== Refs =====
  const knifeRef = useRef<THREE.InstancedMesh>(null);
  const bowRef = useRef<THREE.InstancedMesh>(null);
  const pingRef = useRef<THREE.InstancedMesh>(null);
  const pingInnerRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const airdropRef = useRef<THREE.InstancedMesh>(null);
  const airdropMarkerRef = useRef<THREE.InstancedMesh>(null);
  const forkRef = useRef<THREE.InstancedMesh>(null);
  const forkHeadRef = useRef<THREE.InstancedMesh>(null);

  // ===== Geometries =====
  const geometries = useMemo(() => ({
    // knife: 날카로운 작은 큐브
    knife: new THREE.BoxGeometry(0.25, 0.08, 0.04),
    // bow: 길쭉한 콘 (화살)
    bow: new THREE.ConeGeometry(0.04, 0.4, 6),
    // ping: 토러스 (동심원 링)
    ping: new THREE.TorusGeometry(0.3, 0.02, 8, 32),
    // ping inner: 더 작은 링
    pingInner: new THREE.TorusGeometry(0.15, 0.015, 8, 24),
    // shard: 다면체 (포탄)
    shard: new THREE.DodecahedronGeometry(0.15, 0),
    // airdrop: 타원 (미사일 본체)
    airdrop: new THREE.CylinderGeometry(0.06, 0.04, 0.3, 8),
    // airdrop marker: 링 (착탄 마커)
    airdropMarker: new THREE.RingGeometry(0.2, 0.25, 32),
    // fork: 구체 (에너지 노드)
    fork: new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6),
    // fork head: 구체
    forkHead: new THREE.SphereGeometry(0.08, 8, 8),
  }), []);

  // ===== Materials =====
  const materials = useMemo(() => ({
    // STEEL 레드
    knife: new THREE.MeshStandardMaterial({
      color: '#7F1D1D',
      emissive: '#EF4444',
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.3,
    }),
    // TERRITORY 블루
    bow: new THREE.MeshStandardMaterial({
      color: '#1E3A8A',
      emissive: '#3B82F6',
      emissiveIntensity: 0.5,
    }),
    // ALLIANCE 퍼플
    ping: new THREE.MeshStandardMaterial({
      color: '#8B5CF6',
      emissive: '#8B5CF6',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    }),
    pingInner: new THREE.MeshStandardMaterial({
      color: '#C4B5FD',
      emissive: '#8B5CF6',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
    // TERRITORY 블루
    shard: new THREE.MeshStandardMaterial({
      color: '#1E3A8A',
      emissive: '#3B82F6',
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.3,
    }),
    // MORALE 시안
    airdrop: new THREE.MeshStandardMaterial({
      color: '#164E63',
      emissive: '#06B6D4',
      emissiveIntensity: 0.5,
    }),
    airdropMarker: new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#06B6D4',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    }),
    // ALLIANCE 퍼플
    fork: new THREE.MeshStandardMaterial({
      color: '#8B5CF6',
      emissive: '#8B5CF6',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.8,
    }),
    forkHead: new THREE.MeshStandardMaterial({
      color: '#C4B5FD',
      emissive: '#8B5CF6',
      emissiveIntensity: 0.7,
    }),
  }), []);

  useFrame(() => {
    const projectiles = projectilesRef.current;
    if (!projectiles) return;

    const time = performance.now();

    let knifeCount = 0;
    let bowCount = 0;
    let pingCount = 0;
    let pingInnerCount = 0;
    let shardCount = 0;
    let airdropCount = 0;
    let airdropMarkerCount = 0;
    let forkCount = 0;
    let forkHeadCount = 0;

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
        // ===== KNIFE: 작은 큐브 투사체 =====
        case 'knife': {
          if (!knifeRef.current || knifeCount >= CAPACITY) break;
          const knifeRot = p.currentRotation ?? angle;
          const knifeScale = Math.max(0.5, radius * 2);

          _pos.set(px, Y_OFFSET, -py);
          _euler.set(0, -knifeRot, 0);
          _quat.setFromEuler(_euler);
          _scale.set(knifeScale, knifeScale, knifeScale);
          _mat4.compose(_pos, _quat, _scale);
          knifeRef.current.setMatrixAt(knifeCount, _mat4);
          knifeCount++;
          break;
        }

        // ===== BOW: 화살 (elongated cone) =====
        case 'bow': {
          if (!bowRef.current || bowCount >= CAPACITY) break;
          const bowScale = Math.max(0.5, radius * 2);

          _pos.set(px, Y_OFFSET, -py);
          // 콘은 기본 위 방향이므로 Z축으로 기울이고 Y축으로 방향 회전
          _euler.set(0, -angle, -Math.PI / 2);
          _quat.setFromEuler(_euler);
          _scale.set(bowScale, bowScale, bowScale);
          _mat4.compose(_pos, _quat, _scale);
          bowRef.current.setMatrixAt(bowCount, _mat4);
          bowCount++;
          break;
        }

        // ===== PING: 동심원 파동 링 =====
        case 'ping': {
          const pulseSize = Math.max(0.3, radius * 2.5);
          const expandPhase = ((time / 300) % 1);

          // 외곽 링 (확장)
          if (pingRef.current && pingCount < CAPACITY) {
            const ringScale = pulseSize * (1 + expandPhase * 0.8);
            _pos.set(px, Y_OFFSET, -py);
            _euler.set(Math.PI / 2, 0, 0); // 수평 눕힘
            _quat.setFromEuler(_euler);
            _scale.set(ringScale, ringScale, ringScale);
            _mat4.compose(_pos, _quat, _scale);
            pingRef.current.setMatrixAt(pingCount, _mat4);

            const alpha = (1 - expandPhase) * 0.7;
            _color.setRGB(0.55 * alpha + 0.3, 0.36 * alpha + 0.1, 0.96 * alpha + 0.04);
            pingRef.current.setColorAt(pingCount, _color);
            pingCount++;
          }

          // 내부 링 (지연 확장)
          if (pingInnerRef.current && pingInnerCount < CAPACITY) {
            const innerPhase = ((time / 300 + 0.33) % 1);
            const innerScale = pulseSize * (0.8 + innerPhase * 0.5);
            _pos.set(px, Y_OFFSET, -py);
            _euler.set(Math.PI / 2, 0, 0);
            _quat.setFromEuler(_euler);
            _scale.set(innerScale, innerScale, innerScale);
            _mat4.compose(_pos, _quat, _scale);
            pingInnerRef.current.setMatrixAt(pingInnerCount, _mat4);
            pingInnerCount++;
          }
          break;
        }

        // ===== SHARD: 대형 포탄 + 회전 =====
        case 'shard': {
          if (!shardRef.current || shardCount >= CAPACITY) break;
          const spinProgress = 1 - lifeRatio;
          const spin = spinProgress * Math.PI * 4;
          const shardScale = Math.max(0.5, radius * 1.3);

          _pos.set(px, Y_OFFSET, -py);
          _euler.set(spin * 0.3, spin, spin * 0.5);
          _quat.setFromEuler(_euler);
          _scale.set(shardScale, shardScale, shardScale);
          _mat4.compose(_pos, _quat, _scale);
          shardRef.current.setMatrixAt(shardCount, _mat4);
          shardCount++;
          break;
        }

        // ===== AIRDROP: 낙하 미사일 + 타겟 마커 =====
        case 'airdrop': {
          const z = p.z ?? 0;
          const heightOffset = z * WORLD_SCALE;

          // 미사일 본체
          if (airdropRef.current && airdropCount < CAPACITY) {
            const swing = Math.sin(time / 160 * Math.PI * 2) * 0.08;
            _pos.set(px, Y_OFFSET + heightOffset + 0.2, -py);
            _euler.set(0, swing, 0);
            _quat.setFromEuler(_euler);
            _scale.set(1, 1, 1);
            _mat4.compose(_pos, _quat, _scale);
            airdropRef.current.setMatrixAt(airdropCount, _mat4);
            airdropCount++;
          }

          // 착탄 마커 (지면)
          if (airdropMarkerRef.current && airdropMarkerCount < CAPACITY) {
            const markerPulse = 0.8 + Math.sin(time / 150) * 0.2;
            _pos.set(px, 0.02, -py);
            _euler.set(-Math.PI / 2, 0, 0);
            _quat.setFromEuler(_euler);
            _scale.set(markerPulse, markerPulse, 1);
            _mat4.compose(_pos, _quat, _scale);
            airdropMarkerRef.current.setMatrixAt(airdropMarkerCount, _mat4);
            airdropMarkerCount++;
          }
          break;
        }

        // ===== FORK: 분기 에너지 볼트 =====
        case 'fork': {
          const boltLength = Math.max(0.25, radius * 3);

          // 메인 볼트 (실린더)
          if (forkRef.current && forkCount < CAPACITY) {
            const boltX = px + Math.cos(angle) * boltLength * 0.3;
            const boltY = py + Math.sin(angle) * boltLength * 0.3;

            _pos.set(boltX, Y_OFFSET, -boltY);
            _euler.set(0, -angle, Math.PI / 2);
            _quat.setFromEuler(_euler);
            _scale.set(1, boltLength, 1);
            _mat4.compose(_pos, _quat, _scale);
            forkRef.current.setMatrixAt(forkCount, _mat4);
            forkCount++;
          }

          // 선두 노드 (구체)
          if (forkHeadRef.current && forkHeadCount < CAPACITY) {
            const headX = px + Math.cos(angle) * boltLength;
            const headY = py + Math.sin(angle) * boltLength;
            const headPulse = 0.85 + Math.sin(time / 40) * 0.15;

            _pos.set(headX, Y_OFFSET, -headY);
            _quat.identity();
            _scale.set(headPulse, headPulse, headPulse);
            _mat4.compose(_pos, _quat, _scale);
            forkHeadRef.current.setMatrixAt(forkHeadCount, _mat4);
            forkHeadCount++;
          }
          break;
        }
      }
    }

    // 카운트 설정 + flush
    setCountAndFlush(knifeRef.current, knifeCount);
    setCountAndFlush(bowRef.current, bowCount);
    setCountAndFlush(pingRef.current, pingCount);
    setCountAndFlush(pingInnerRef.current, pingInnerCount);
    setCountAndFlush(shardRef.current, shardCount);
    setCountAndFlush(airdropRef.current, airdropCount);
    setCountAndFlush(airdropMarkerRef.current, airdropMarkerCount);
    setCountAndFlush(forkRef.current, forkCount);
    setCountAndFlush(forkHeadRef.current, forkHeadCount);
  });

  return (
    <group>
      <instancedMesh ref={knifeRef} args={[geometries.knife, materials.knife, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={bowRef} args={[geometries.bow, materials.bow, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={pingRef} args={[geometries.ping, materials.ping, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={pingInnerRef} args={[geometries.pingInner, materials.pingInner, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={shardRef} args={[geometries.shard, materials.shard, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={airdropRef} args={[geometries.airdrop, materials.airdrop, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={airdropMarkerRef} args={[geometries.airdropMarker, materials.airdropMarker, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={forkRef} args={[geometries.fork, materials.fork, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={forkHeadRef} args={[geometries.forkHead, materials.forkHead, CAPACITY]} frustumCulled={false} />
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
