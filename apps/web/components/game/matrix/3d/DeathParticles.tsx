'use client';

/**
 * DeathParticles.tsx — 적 사망 시 폭발 파티클 이펙트 (Phase 3)
 *
 * InstancedMesh 기반 작은 큐브들이 폭발하듯 퍼지는 효과.
 * - 사망 위치에서 방사형으로 8~15개 큐브 파편 발사
 * - 중력 적용 + 바닥 바운스
 * - 0.5~1.0초 후 fade out
 * - 적 색상 기반 파편 색상
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================
// 상수
// ============================================

/** 최대 동시 파티클 수 */
const MAX_PARTICLES = 200;

/** 파티클 큐브 크기 */
const PARTICLE_SIZE = 0.4;

/** 중력 가속도 */
const GRAVITY = -40;

/** 영점 스케일 매트릭스 */
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

// 임시 연산 객체 (GC 방지)
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

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
}

// ============================================
// Props
// ============================================

export interface DeathParticlesProps {
  /** 사망 이벤트 큐 ref */
  deathEventsRef: React.MutableRefObject<DeathEvent[]>;
}

// ============================================
// DeathParticles Component
// ============================================

export function DeathParticles({ deathEventsRef }: DeathParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // 파티클 상태 풀
  const particlesRef = useRef<DeathParticle[]>([]);
  const freeIndicesRef = useRef<number[]>([]);

  // geometry & material
  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.2,
      transparent: true,
      flatShading: true,
    });
  }, []);

  // 초기화
  useEffect(() => {
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

      // instanceColor 초기화
      const colorArray = new Float32Array(MAX_PARTICLES * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // useFrame: 이벤트 소비 + 파티클 업데이트
  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(delta, 0.05);
    const particles = particlesRef.current;
    const freeIndices = freeIndicesRef.current;

    // 사망 이벤트 처리 → 파티클 스폰
    const events = deathEventsRef.current;
    while (events.length > 0) {
      const event = events.shift()!;

      // 보스는 15개, 일반 적은 8개 파편
      const count = event.isBoss ? 15 : 8;
      const baseColor = _color.set(event.color);

      for (let i = 0; i < count; i++) {
        if (freeIndices.length === 0) break;

        const idx = freeIndices.pop()!;
        const p = particles[idx];

        // 방사형 분포
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
        const speed = 3 + Math.random() * 8;

        p.active = true;
        p.x = event.position.x + (Math.random() - 0.5) * 2;
        p.y = 1 + Math.random() * 2; // 지면 약간 위에서 시작
        p.z = -event.position.y + (Math.random() - 0.5) * 2; // 2D→3D
        p.vx = Math.cos(angle) * speed;
        p.vy = 5 + Math.random() * 10; // 위로 발사
        p.vz = Math.sin(angle) * speed;
        p.life = 0.5 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.scale = 0.5 + Math.random() * 0.8;

        // 색상 약간 변형
        const hslOffset = (Math.random() - 0.5) * 0.15;
        const pColor = baseColor.clone().offsetHSL(hslOffset, 0, (Math.random() - 0.5) * 0.2);
        p.r = pColor.r;
        p.g = pColor.g;
        p.b = pColor.b;
      }
    }

    // 파티클 업데이트
    let maxActiveIndex = -1;
    let needsUpdate = false;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        mesh.setMatrixAt(i, ZERO_MATRIX);
        freeIndices.push(i);
        needsUpdate = true;
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

      // 스케일 (수명에 따라 축소)
      const lifeRatio = p.life / p.maxLife;
      const s = p.scale * lifeRatio;

      // InstancedMesh matrix 업데이트
      _pos.set(p.x, p.y, p.z);
      _scale.set(s, s, s);
      _matrix.makeTranslation(p.x, p.y, p.z);
      _matrix.scale(_scale);
      mesh.setMatrixAt(i, _matrix);

      // 색상 업데이트 (수명에 따라 약간 어두워짐)
      _color.setRGB(p.r * (0.5 + lifeRatio * 0.5), p.g * (0.5 + lifeRatio * 0.5), p.b * (0.5 + lifeRatio * 0.5));
      mesh.setColorAt(i, _color);

      if (i > maxActiveIndex) maxActiveIndex = i;
      needsUpdate = true;
    }

    if (needsUpdate) {
      mesh.count = maxActiveIndex + 1;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_PARTICLES]}
      frustumCulled={false}
    />
  );
}

export default DeathParticles;
