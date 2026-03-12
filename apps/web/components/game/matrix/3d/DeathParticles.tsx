'use client';

/**
 * DeathParticles.tsx — 적 사망 시 폭발 파티클 이펙트 (V44 Phase 1 업그레이드)
 *
 * InstancedMesh 기반 큐브 파편 + Points 기반 스파크 레이어.
 * - 일반 적: 20개 큐브 파편 (크기 0.2~0.6, 색상 그라디언트 밝→어둡)
 * - 보스: 50개 대형 파티클 + 시간에 따른 폭발 확산
 * - 엘리트: 50개 + 티어별 색상 (silver/gold/diamond)
 * - 스파크 Points 레이어: 모든 사망에 작은 불꽃 점 파티클 추가
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, y) — MC FPS 좌표
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EliteTier } from '@/lib/matrix/types';
import { getEffectTexture } from '@/lib/3d/effect-textures';

// ============================================
// 상수
// ============================================

/** 최대 동시 큐브 파티클 수 (풀 확장: 200→500) */
const MAX_PARTICLES = 500;

/** 최대 스파크(점) 파티클 수 */
const MAX_SPARKS = 300;

/** 중력 가속도 */
const GRAVITY = -40;

/** 영점 스케일 매트릭스 */
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

// 임시 연산 객체 (GC 방지)
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

// 엘리트 티어별 색상
const ELITE_TIER_COLORS: Record<string, string[]> = {
  silver: ['#C0C0C0', '#E8E8E8', '#A0A0A0', '#D4D4D4'],
  gold: ['#FFD700', '#FFA500', '#FFE44D', '#DAA520'],
  diamond: ['#00FFFF', '#7DF9FF', '#40E0D0', '#E0FFFF'],
};

// ============================================
// 파티클 상태
// ============================================

interface DeathParticle {
  active: boolean;
  x: number;      // 3D X
  y: number;      // 3D Y (높이)
  z: number;      // 3D Z
  vx: number;     // X 속도
  vy: number;     // Y 속도 (높이)
  vz: number;     // Z 속도
  life: number;   // 남은 수명 (초)
  maxLife: number; // 최대 수명
  scale: number;   // 기본 스케일
  r: number;       // 색상 R
  g: number;       // 색상 G
  b: number;       // 색상 B
  /** 밝기 그라디언트 (1.0=밝음 → 0.3=어두움, life에 따라 감쇠) */
  brightnessStart: number;
}

/** 스파크(점) 파티클 상태 */
interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
  size: number;
}

// ============================================
// 사망 이벤트 구조
// ============================================

/** 적 사망 이벤트 (MatrixScene에서 발행) */
export interface DeathEvent {
  /** 사망 위치 2D 좌표 */
  position: { x: number; y: number };
  /** 적 색상 */
  color: string;
  /** 보스 여부 (보스면 파편 더 많이) */
  isBoss: boolean;
  /** v44: 엘리트 여부 */
  isElite?: boolean;
  /** v44: 엘리트 티어 */
  eliteTier?: EliteTier;
}

// ============================================
// Props
// ============================================

export interface DeathParticlesProps {
  /** 사망 이벤트 큐 ref */
  deathEventsRef: React.MutableRefObject<DeathEvent[]>;
  /** v44: 게임 속도 ref (슬로모 적용) */
  gameSpeedRef?: React.MutableRefObject<number>;
}

// ============================================
// DeathParticles Component
// ============================================

export function DeathParticles({ deathEventsRef, gameSpeedRef }: DeathParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.Points>(null);

  // 파티클 상태 풀
  const particlesRef = useRef<DeathParticle[]>([]);
  const freeIndicesRef = useRef<number[]>([]);

  // 스파크 상태 풀
  const sparksRef = useRef<SparkParticle[]>([]);
  const freeSparkIndicesRef = useRef<number[]>([]);

  // 큐브 geometry & material
  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(1, 1, 1); // 스케일로 크기 제어
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.3,
      transparent: true,
      flatShading: true,
    });
  }, []);

  // 스파크 geometry & material (Points)
  const sparkGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_SPARKS * 3);
    const colors = new Float32Array(MAX_SPARKS * 3);
    const sizes = new Float32Array(MAX_SPARKS);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const sparkMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      map: getEffectTexture('spark'),
      alphaTest: 0.01,
    });
  }, []);

  // 초기화
  useEffect(() => {
    // 큐브 파티클 풀
    const particles: DeathParticle[] = [];
    const freeIndices: number[] = [];
    for (let i = MAX_PARTICLES - 1; i >= 0; i--) {
      particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        scale: 1,
        r: 1, g: 1, b: 1,
        brightnessStart: 1.0,
      });
      freeIndices.push(i);
    }
    particlesRef.current = particles;
    freeIndicesRef.current = freeIndices;

    const mesh = meshRef.current;
    if (mesh) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        mesh.setMatrixAt(i, ZERO_MATRIX);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = 0;
      const colorArray = new Float32Array(MAX_PARTICLES * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }

    // 스파크 파티클 풀
    const sparks: SparkParticle[] = [];
    const freeSparks: number[] = [];
    for (let i = MAX_SPARKS - 1; i >= 0; i--) {
      sparks.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        r: 1, g: 1, b: 1,
        size: 0.2,
      });
      freeSparks.push(i);
    }
    sparksRef.current = sparks;
    freeSparkIndicesRef.current = freeSparks;

    return () => {
      geometry.dispose();
      material.dispose();
      sparkGeometry.dispose();
      sparkMaterial.dispose();
    };
  }, [geometry, material, sparkGeometry, sparkMaterial]);

  // useFrame: 이벤트 소비 + 파티클 업데이트
  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const gameSpeed = gameSpeedRef?.current ?? 1.0;
    const dt = Math.min(delta, 0.05) * gameSpeed;
    const particles = particlesRef.current;
    const freeIndices = freeIndicesRef.current;
    const sparks = sparksRef.current;
    const freeSparks = freeSparkIndicesRef.current;

    // === 사망 이벤트 처리 → 파티클 + 스파크 스폰 ===
    const events = deathEventsRef.current;
    while (events.length > 0) {
      const event = events.shift()!;

      const isBossOrElite = event.isBoss || event.isElite;
      // 일반 적: 20개, 보스/엘리트: 50개
      const cubeCount = isBossOrElite ? 50 : 20;
      // 스파크: 일반 10개, 보스/엘리트 25개
      const sparkCount = isBossOrElite ? 25 : 10;

      // 엘리트 티어 색상 결정
      const tierColors = event.isElite && event.eliteTier
        ? ELITE_TIER_COLORS[event.eliteTier] ?? null
        : null;

      const baseColor = _color.set(event.color);

      // --- 큐브 파편 스폰 ---
      for (let i = 0; i < cubeCount; i++) {
        if (freeIndices.length === 0) break;

        const idx = freeIndices.pop()!;
        const p = particles[idx];

        // 방사형 분포 + 랜덤 분산
        const angle = (Math.PI * 2 * i) / cubeCount + (Math.random() - 0.5) * 0.8;
        const speedBase = isBossOrElite ? 5 : 3;
        const speedRange = isBossOrElite ? 12 : 8;
        const speed = speedBase + Math.random() * speedRange;

        p.active = true;
        // 보스/엘리트는 더 넓게 분산 시작
        const spread = isBossOrElite ? 3 : 2;
        p.x = event.position.x + (Math.random() - 0.5) * spread;
        p.y = 1 + Math.random() * (isBossOrElite ? 3 : 2);
        p.z = event.position.y + (Math.random() - 0.5) * spread;
        p.vx = Math.cos(angle) * speed;
        p.vy = 5 + Math.random() * (isBossOrElite ? 15 : 10);
        p.vz = Math.sin(angle) * speed;
        p.life = isBossOrElite ? (0.6 + Math.random() * 0.8) : (0.5 + Math.random() * 0.5);
        p.maxLife = p.life;

        // 크기 다양화: 0.2~0.6 (보스/엘리트는 0.3~0.9)
        if (isBossOrElite) {
          p.scale = 0.3 + Math.random() * 0.6;
        } else {
          p.scale = 0.2 + Math.random() * 0.4;
        }

        // 밝기 그라디언트 시작값 (밝은 것과 어두운 것 혼합)
        p.brightnessStart = 0.6 + Math.random() * 0.4; // 0.6~1.0

        // 색상: 엘리트는 티어 색상 사용
        if (tierColors) {
          const tc = _color.set(tierColors[i % tierColors.length]);
          const hslOffset = (Math.random() - 0.5) * 0.1;
          tc.offsetHSL(hslOffset, 0, (Math.random() - 0.5) * 0.15);
          p.r = tc.r;
          p.g = tc.g;
          p.b = tc.b;
        } else {
          // 일반/보스: 기본 색상에서 변형
          const hslOffset = (Math.random() - 0.5) * 0.2;
          const pColor = baseColor.clone().offsetHSL(hslOffset, 0, (Math.random() - 0.5) * 0.25);
          p.r = pColor.r;
          p.g = pColor.g;
          p.b = pColor.b;
        }
      }

      // --- 스파크(점) 파티클 스폰 ---
      for (let i = 0; i < sparkCount; i++) {
        if (freeSparks.length === 0) break;

        const idx = freeSparks.pop()!;
        const s = sparks[idx];

        const angle = Math.random() * Math.PI * 2;
        const elevAngle = Math.random() * Math.PI * 0.5; // 위쪽 반구
        const speed = 4 + Math.random() * 12;

        s.active = true;
        s.x = event.position.x + (Math.random() - 0.5) * 1.5;
        s.y = 1 + Math.random() * 1.5;
        s.z = event.position.y + (Math.random() - 0.5) * 1.5;
        s.vx = Math.cos(angle) * Math.cos(elevAngle) * speed;
        s.vy = Math.sin(elevAngle) * speed * 1.5; // 위로 더 빠르게
        s.vz = Math.sin(angle) * Math.cos(elevAngle) * speed;
        s.life = 0.3 + Math.random() * 0.4;
        s.maxLife = s.life;
        s.size = isBossOrElite ? (0.15 + Math.random() * 0.25) : (0.1 + Math.random() * 0.2);

        // 스파크 색상: 밝은 흰색~노란색 (불꽃 효과)
        if (tierColors) {
          const tc = _color.set(tierColors[i % tierColors.length]);
          // 스파크는 더 밝게
          tc.offsetHSL(0, -0.3, 0.3);
          s.r = Math.min(1, tc.r + 0.3);
          s.g = Math.min(1, tc.g + 0.3);
          s.b = Math.min(1, tc.b + 0.3);
        } else {
          // 일반: 밝은 노란~흰색 불꽃
          s.r = 1.0;
          s.g = 0.8 + Math.random() * 0.2;
          s.b = 0.3 + Math.random() * 0.4;
        }
      }
    }

    // === 큐브 파티클 업데이트 ===
    let maxActiveIndex = -1;
    let cubeNeedsUpdate = false;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        mesh.setMatrixAt(i, ZERO_MATRIX);
        freeIndices.push(i);
        cubeNeedsUpdate = true;
        continue;
      }

      // 물리 업데이트
      p.x += p.vx * dt;
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // 바닥 바운스
      if (p.y < 0) {
        p.y = 0;
        p.vy = Math.abs(p.vy) * 0.3;
        if (Math.abs(p.vy) < 0.5) p.vy = 0;
      }

      // 드래그
      p.vx *= 0.98;
      p.vz *= 0.98;

      // 수명 비율
      const lifeRatio = p.life / p.maxLife;

      // 스케일 (수명에 따라 축소)
      const s = p.scale * lifeRatio;

      // InstancedMesh matrix 업데이트
      _pos.set(p.x, p.y, p.z);
      _scale.set(s, s, s);
      _matrix.makeTranslation(p.x, p.y, p.z);
      _matrix.scale(_scale);
      mesh.setMatrixAt(i, _matrix);

      // 색상: 밝기 그라디언트 (life에 따라 밝은색→어두운색)
      const brightness = p.brightnessStart * (0.3 + lifeRatio * 0.7);
      _color.setRGB(
        p.r * brightness,
        p.g * brightness,
        p.b * brightness,
      );
      mesh.setColorAt(i, _color);

      if (i > maxActiveIndex) maxActiveIndex = i;
      cubeNeedsUpdate = true;
    }

    if (cubeNeedsUpdate) {
      mesh.count = maxActiveIndex + 1;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }

    // === 스파크(점) 파티클 업데이트 ===
    const sparkPositions = sparkGeometry.attributes.position as THREE.BufferAttribute;
    const sparkColors = sparkGeometry.attributes.color as THREE.BufferAttribute;
    const sparkSizes = sparkGeometry.attributes.size as THREE.BufferAttribute;
    let sparkActiveCount = 0;

    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      if (!s.active) continue;

      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        freeSparks.push(i);
        continue;
      }

      // 물리: 중력 약하게 (점 파티클은 공중에 오래 체류)
      s.x += s.vx * dt;
      s.vy += GRAVITY * 0.3 * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      // 드래그 (강하게 — 빠르게 감속)
      s.vx *= 0.95;
      s.vz *= 0.95;

      const lifeRatio = s.life / s.maxLife;

      // 위치 업데이트 — sparkActiveCount 인덱스에 패킹
      const si = sparkActiveCount * 3;
      sparkPositions.array[si] = s.x;
      sparkPositions.array[si + 1] = s.y;
      sparkPositions.array[si + 2] = s.z;

      // 색상 (페이드아웃)
      sparkColors.array[si] = s.r * lifeRatio;
      sparkColors.array[si + 1] = s.g * lifeRatio;
      sparkColors.array[si + 2] = s.b * lifeRatio;

      // 크기 (수명에 따라 축소)
      sparkSizes.array[sparkActiveCount] = s.size * lifeRatio;

      sparkActiveCount++;
    }

    sparkGeometry.setDrawRange(0, sparkActiveCount);
    sparkPositions.needsUpdate = true;
    sparkColors.needsUpdate = true;
    sparkSizes.needsUpdate = true;
  });

  return (
    <group>
      {/* 큐브 파편 파티클 */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, MAX_PARTICLES]}
        frustumCulled={false}
      />
      {/* 스파크(점) 파티클 — Additive Blending */}
      <points ref={sparkRef} geometry={sparkGeometry} material={sparkMaterial} frustumCulled={false} />
    </group>
  );
}

export default DeathParticles;
