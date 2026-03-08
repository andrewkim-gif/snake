'use client';

/**
 * GlobeNukeEffect — v23 Phase 5 Task 5
 * 핵실험 버섯구름 이펙트:
 * - 거대 충격파 링 (RingGeometry, 빠르게 확장, scale 2배 크기)
 * - 버섯구름 파티클: InstancedMesh SphereGeometry 구체 10~15개, 중심에서 상승+확산
 * - 아래쪽 기둥: CylinderGeometry 하나 (먼지 기둥)
 * - 밝은 주황→회색 색상 전이
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';

// ─── Types ───

export interface NukeData {
  country: string;  // ISO3
  timestamp: number;
}

export interface GlobeNukeEffectProps {
  nukes: NukeData[];
  centroidsMap: Map<string, [number, number]>;
  globeRadius?: number;
  visible?: boolean;
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const MUSHROOM_PARTICLES = 12;     // 버섯구름 구체 수
const MUSHROOM_MAX_HEIGHT = 15.0;  // 최대 상승 높이
const MUSHROOM_SPREAD = 6.0;       // 최대 수평 확산
const MUSHROOM_DURATION = 5.0;     // 전체 이펙트 지속 (초)
const PILLAR_HEIGHT = 10.0;        // 먼지 기둥 높이
const PILLAR_RADIUS = 1.0;
const SHOCKWAVE_DURATION = 1.5;    // 충격파 지속 (초)
const SHOCKWAVE_MAX_SCALE = 25;    // 충격파 최대 스케일 (2배 크기)
const RING_INNER = 0.85;
const PARTICLE_RADIUS = 1.0;

// Colors
const FLASH_COLOR = new THREE.Color(0xffaa33).multiplyScalar(3.0); // 밝은 주황 HDR
const CLOUD_COLOR_HOT = new THREE.Color(0xff6622);
const CLOUD_COLOR_COOL = new THREE.Color(0x666666); // 회색
const SHOCKWAVE_COLOR = new THREE.Color(0xff8844).multiplyScalar(2.0);

// ─── GC-prevention ───

const _tempVec = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _tempColor = new THREE.Color();
const _scaleVec = new THREE.Vector3();
// v23 Phase 6: GC-prevention — reusable lateral vectors for mushroom cloud
const _lateral1 = new THREE.Vector3();
const _lateral2 = new THREE.Vector3();

// ─── Internal render data ───

interface NukeRenderData {
  // 충격파 링
  shockwaveRing: THREE.Mesh;
  shockwaveMaterial: THREE.MeshBasicMaterial;
  // 먼지 기둥
  pillar: THREE.Mesh;
  pillarMaterial: THREE.MeshBasicMaterial;
  // 버섯구름 파티클
  cloudParticles: THREE.InstancedMesh;
  cloudMaterial: THREE.MeshBasicMaterial;
  // 위치 정보
  position: THREE.Vector3;
  normal: THREE.Vector3;
  startTime: number;
  // 각 파티클의 랜덤 오프셋 (GC 방지: 생성 시 한번만)
  particleSeeds: Float32Array; // [angle, radiusRatio, heightRatio, phase] * MUSHROOM_PARTICLES
  key: string;
}

// ─── Component ───

export function GlobeNukeEffect({
  nukes,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
}: GlobeNukeEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dataRef = useRef<NukeRenderData[]>([]);
  const clockRef = useRef(0);

  // 공유 geometry
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(RING_INNER, 1, 32),
    [],
  );
  const cylinderGeo = useMemo(
    () => new THREE.CylinderGeometry(PILLAR_RADIUS, PILLAR_RADIUS * 1.5, PILLAR_HEIGHT, 8),
    [],
  );
  const sphereGeo = useMemo(
    () => new THREE.SphereGeometry(PARTICLE_RADIUS, 8, 8),
    [],
  );

  // nukes 변경 시 재구축
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 기존 정리
    for (const d of dataRef.current) {
      group.remove(d.shockwaveRing);
      group.remove(d.pillar);
      group.remove(d.cloudParticles);
      d.shockwaveMaterial.dispose();
      d.pillarMaterial.dispose();
      d.cloudMaterial.dispose();
      d.cloudParticles.dispose();
    }
    dataRef.current = [];

    for (const nuke of nukes) {
      const centroid = centroidsMap.get(nuke.country);
      if (!centroid) continue;

      const pos = latLngToVector3(centroid[0], centroid[1], globeRadius + 0.5);
      const normal = pos.clone().normalize();

      // ─── 충격파 링 ───
      const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: SHOCKWAVE_COLOR.clone(),
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });

      const shockwaveRing = new THREE.Mesh(ringGeo, shockwaveMaterial);
      shockwaveRing.position.copy(pos);
      _quat.setFromUnitVectors(_up, normal);
      shockwaveRing.quaternion.copy(_quat);
      shockwaveRing.rotateX(-Math.PI / 2);
      shockwaveRing.renderOrder = 6;

      // ─── 먼지 기둥 ───
      const pillarMaterial = new THREE.MeshBasicMaterial({
        color: CLOUD_COLOR_HOT.clone(),
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });

      const pillar = new THREE.Mesh(cylinderGeo, pillarMaterial);
      // 기둥은 표면에서 위로 솟아남
      const pillarPos = pos.clone().addScaledVector(normal, PILLAR_HEIGHT / 2);
      pillar.position.copy(pillarPos);
      _quat.setFromUnitVectors(_up, normal);
      pillar.quaternion.copy(_quat);
      pillar.renderOrder = 5;

      // ─── 버섯구름 파티클 ───
      const cloudMaterial = new THREE.MeshBasicMaterial({
        color: FLASH_COLOR.clone(),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const cloudParticles = new THREE.InstancedMesh(
        sphereGeo,
        cloudMaterial,
        MUSHROOM_PARTICLES,
      );
      cloudParticles.renderOrder = 7;

      // 각 파티클 랜덤 시드 (angle, radiusRatio, heightRatio, phase)
      const seeds = new Float32Array(MUSHROOM_PARTICLES * 4);
      for (let i = 0; i < MUSHROOM_PARTICLES; i++) {
        seeds[i * 4] = Math.random() * Math.PI * 2;      // angle
        seeds[i * 4 + 1] = 0.3 + Math.random() * 0.7;    // radiusRatio
        seeds[i * 4 + 2] = 0.5 + Math.random() * 0.5;    // heightRatio
        seeds[i * 4 + 3] = Math.random() * 0.3;           // phase delay
      }

      group.add(shockwaveRing);
      group.add(pillar);
      group.add(cloudParticles);

      dataRef.current.push({
        shockwaveRing,
        shockwaveMaterial,
        pillar,
        pillarMaterial,
        cloudParticles,
        cloudMaterial,
        position: pos.clone(),
        normal,
        startTime: clockRef.current,
        particleSeeds: seeds,
        key: `${nuke.country}_${nuke.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nukes, centroidsMap, globeRadius]);

  // 매 프레임: 이펙트 애니메이션
  useFrame((_, delta) => {
    if (!visible) return;
    clockRef.current += delta;
    const now = clockRef.current;

    for (const d of dataRef.current) {
      const elapsed = now - d.startTime;
      const cycleTime = elapsed % (MUSHROOM_DURATION + 2.0); // +2s 쿨다운

      // ─── 충격파 링: 빠르게 확장 + 페이드 ───
      const shockT = Math.min(cycleTime / SHOCKWAVE_DURATION, 1.0);
      if (shockT < 1.0) {
        d.shockwaveRing.visible = true;
        const easeOut = 1 - (1 - shockT) * (1 - shockT);
        const scale = 1 + (SHOCKWAVE_MAX_SCALE - 1) * easeOut;
        d.shockwaveRing.scale.setScalar(scale);
        d.shockwaveMaterial.opacity = (1.0 - easeOut) * 0.9;
      } else {
        d.shockwaveRing.visible = false;
      }

      // ─── 먼지 기둥: 상승 + 페이드 ───
      const pillarT = Math.min(cycleTime / MUSHROOM_DURATION, 1.0);
      if (pillarT < 1.0) {
        d.pillar.visible = true;
        const growT = Math.min(pillarT * 3, 1.0); // 처음 1/3에서 성장
        const pillarScale = growT;
        d.pillar.scale.set(1, pillarScale, 1);
        // 위치 재조정 (성장에 따라)
        const currentHeight = PILLAR_HEIGHT * pillarScale;
        _tempVec.copy(d.position).addScaledVector(d.normal, currentHeight / 2);
        d.pillar.position.copy(_tempVec);

        // 색상 전이: 주황 → 회색
        const colorT = pillarT;
        _tempColor.copy(CLOUD_COLOR_HOT).lerp(CLOUD_COLOR_COOL, colorT);
        d.pillarMaterial.color.copy(_tempColor);
        d.pillarMaterial.opacity = 0.6 * (1.0 - pillarT * 0.5);
      } else {
        d.pillar.visible = false;
      }

      // ─── 버섯구름 파티클: 상승 + 확산 ───
      if (cycleTime < MUSHROOM_DURATION) {
        d.cloudParticles.visible = true;

        // 법선에 수직인 두 축 (GC-free: 모듈 스코프 재사용)
        _lateral1.crossVectors(d.normal, _up).normalize();
        if (_lateral1.lengthSq() < 0.01) _lateral1.set(1, 0, 0);
        _lateral2.crossVectors(d.normal, _lateral1).normalize();

        for (let i = 0; i < MUSHROOM_PARTICLES; i++) {
          const angle = d.particleSeeds[i * 4];
          const radiusRatio = d.particleSeeds[i * 4 + 1];
          const heightRatio = d.particleSeeds[i * 4 + 2];
          const phaseDelay = d.particleSeeds[i * 4 + 3];

          const localT = Math.max(0, Math.min((cycleTime - phaseDelay) / MUSHROOM_DURATION, 1.0));

          // 버섯 모양: 초반에 빠르게 상승, 후반에 수평 확산
          const riseT = Math.pow(localT, 0.5); // 빠른 상승
          const height = riseT * MUSHROOM_MAX_HEIGHT * heightRatio;
          const spreadT = Math.max(0, (localT - 0.3) / 0.7); // 30% 이후 확산
          const spread = spreadT * MUSHROOM_SPREAD * radiusRatio;

          _tempVec.copy(d.position);
          _tempVec.addScaledVector(d.normal, height);
          _tempVec.addScaledVector(_lateral1, Math.cos(angle) * spread);
          _tempVec.addScaledVector(_lateral2, Math.sin(angle) * spread);

          // 크기: 상승하면서 커짐, 후반에 줄어듦
          const sizeT = localT < 0.5
            ? localT * 2 // 0→1
            : 1.0 - (localT - 0.5) * 0.5; // 1→0.75
          const scale = 0.3 + sizeT * 1.2;

          _scaleVec.set(scale, scale, scale);
          _tempMatrix.makeTranslation(_tempVec.x, _tempVec.y, _tempVec.z);
          _tempMatrix.scale(_scaleVec);

          d.cloudParticles.setMatrixAt(i, _tempMatrix);
        }
        d.cloudParticles.instanceMatrix.needsUpdate = true;

        // 색상 전이: 밝은 주황 → 회색
        const colorProgress = cycleTime / MUSHROOM_DURATION;
        _tempColor.copy(FLASH_COLOR).lerp(CLOUD_COLOR_COOL, colorProgress * 0.8);
        d.cloudMaterial.color.copy(_tempColor);
        d.cloudMaterial.opacity = 0.8 * (1.0 - colorProgress * 0.4);
      } else {
        d.cloudParticles.visible = false;
      }
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of dataRef.current) {
        d.shockwaveMaterial.dispose();
        d.pillarMaterial.dispose();
        d.cloudMaterial.dispose();
        d.cloudParticles.dispose();
      }
      ringGeo.dispose();
      cylinderGeo.dispose();
      sphereGeo.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
