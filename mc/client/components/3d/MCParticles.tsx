'use client';

/**
 * MCParticles — MC 스타일 파티클 엔진
 * 단일 InstancedMesh로 모든 파티클 렌더링 (MAX_PARTICLES=500)
 * BoxGeometry(1,1,1) + MeshBasicMaterial + instanceColor
 *
 * 파티클 풀 패턴: dead 파티클 재사용 (할당 없는 emit)
 * 물리: position += velocity * dt, velocity.y += gravity * dt
 * 수명: life -= dt, 만료 시 비활성화
 * 스케일: size * (life / maxLife) — 수명에 따라 축소
 *
 * emit API: forwardRef + useImperativeHandle로 외부에서 호출
 *   emitParticles(type, worldPos, count?)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Constants ───

const MAX_PARTICLES = 500;

// ─── Particle Types ───

export type ParticleType =
  | 'XP_COLLECT'
  | 'DEATH_BURST'
  | 'LEVELUP_STAR'
  | 'HEAL_HEART'
  | 'AURA_SPARK'
  | 'DASH_TRAIL'
  | 'STEP_GRASS'
  | 'STEP_SAND'
  | 'STEP_STONE'
  | 'STEP_SNOW';

/** 파티클 타입별 스펙 */
interface ParticleSpec {
  color: THREE.Color;
  count: number;
  life: number;       // 수명 (초)
  gravity: number;    // Y축 가속도
  size: number;       // 기본 크기 (units)
  speedMin: number;   // 초기 속도 범위 (최소)
  speedMax: number;   // 초기 속도 범위 (최대)
}

const PARTICLE_SPECS: Record<ParticleType, ParticleSpec> = {
  XP_COLLECT: {
    color: new THREE.Color('#7FFF00'),
    count: 8,
    life: 0.5,
    gravity: -40,
    size: 4,
    speedMin: 20,
    speedMax: 60,
  },
  DEATH_BURST: {
    color: new THREE.Color('#FF6B6B'), // 기본색, 실제론 agent색상으로 대체
    count: 20,
    life: 1.0,
    gravity: -98,
    size: 6,
    speedMin: 30,
    speedMax: 100,
  },
  LEVELUP_STAR: {
    color: new THREE.Color('#FFD700'),
    count: 12,
    life: 0.8,
    gravity: -20,
    size: 5,
    speedMin: 15,
    speedMax: 50,
  },
  HEAL_HEART: {
    color: new THREE.Color('#FF3333'),
    count: 5,
    life: 0.6,
    gravity: -30,
    size: 5,
    speedMin: 10,
    speedMax: 40,
  },
  AURA_SPARK: {
    color: new THREE.Color('#FFFFFF'), // 빌드색상으로 대체
    count: 2,
    life: 0.3,
    gravity: 0,
    size: 3,
    speedMin: 5,
    speedMax: 20,
  },
  DASH_TRAIL: {
    color: new THREE.Color('#FFFFFF'), // agent색상으로 대체
    count: 4,
    life: 0.2,
    gravity: 0,
    size: 8, // agent크기 * 0.8 근사값
    speedMin: 2,
    speedMax: 10,
  },
  // v16 Phase 6: Biome footstep particles
  STEP_GRASS: {
    color: new THREE.Color('#4A9E4A'),
    count: 2,
    life: 0.4,
    gravity: -30,
    size: 2,
    speedMin: 5,
    speedMax: 15,
  },
  STEP_SAND: {
    color: new THREE.Color('#D4A86A'),
    count: 3,
    life: 0.5,
    gravity: -15,
    size: 2.5,
    speedMin: 3,
    speedMax: 12,
  },
  STEP_STONE: {
    color: new THREE.Color('#888888'),
    count: 2,
    life: 0.3,
    gravity: -50,
    size: 1.5,
    speedMin: 8,
    speedMax: 20,
  },
  STEP_SNOW: {
    color: new THREE.Color('#FFFFFF'),
    count: 3,
    life: 0.6,
    gravity: -8,
    size: 2,
    speedMin: 2,
    speedMax: 8,
  },
};

// ─── Particle Pool ───

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
  gravity: number;
  active: boolean;
}

function createParticle(): Particle {
  return {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0, maxLife: 1,
    color: new THREE.Color(1, 1, 1),
    size: 4,
    gravity: 0,
    active: false,
  };
}

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _color = new THREE.Color();

// ─── v16 Phase 6: Biome → footstep particle mapping ───

/** Map biome index to footstep particle type (returns null for biomes without footsteps) */
export function biomeToStepParticle(biomeIndex: number): ParticleType | null {
  switch (biomeIndex) {
    case 0: return 'STEP_GRASS';   // plains
    case 1: return 'STEP_GRASS';   // forest
    case 2: return 'STEP_SAND';    // desert
    case 3: return 'STEP_SNOW';    // snow
    case 4: return null;           // swamp (water, no footsteps)
    case 5: return 'STEP_STONE';   // volcanic
    default: return null;
  }
}

// ─── Public API ───

export interface MCParticlesHandle {
  /** 파티클 방출 */
  emit: (type: ParticleType, worldPos: [number, number, number], count?: number, overrideColor?: THREE.Color) => void;
}

// ─── Component ───

export const MCParticles = forwardRef<MCParticlesHandle>(function MCParticles(_, ref) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // 파티클 풀 (한 번만 생성)
  const poolRef = useRef<Particle[]>([]);

  useEffect(() => {
    const pool: Particle[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      pool.push(createParticle());
    }
    poolRef.current = pool;
  }, []);

  // Geometry + Material (한 번만 생성)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial(),
    [],
  );

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // ─── emit API ───
  useImperativeHandle(ref, () => ({
    emit(type: ParticleType, worldPos: [number, number, number], count?: number, overrideColor?: THREE.Color) {
      const spec = PARTICLE_SPECS[type];
      const pool = poolRef.current;
      const emitCount = count ?? spec.count;

      let emitted = 0;
      for (let i = 0; i < pool.length && emitted < emitCount; i++) {
        const p = pool[i];
        if (p.active) continue;

        // 활성화
        p.active = true;
        p.x = worldPos[0];
        p.y = worldPos[1];
        p.z = worldPos[2];

        // 랜덤 방향 속도
        const speed = spec.speedMin + Math.random() * (spec.speedMax - spec.speedMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI - Math.PI / 2;
        const cosP = Math.cos(phi);
        p.vx = Math.cos(theta) * cosP * speed;
        p.vy = Math.abs(Math.sin(phi)) * speed; // 상향 편향
        p.vz = Math.sin(theta) * cosP * speed;

        p.life = spec.life;
        p.maxLife = spec.life;
        p.color.copy(overrideColor ?? spec.color);
        p.size = spec.size;
        p.gravity = spec.gravity;

        emitted++;
      }
    },
  }));

  // ─── useFrame: 물리 + 렌더링 ───
  // priority 0 (기본값)
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const pool = poolRef.current;
    // delta clamp (탭 전환 후 큰 delta 방지)
    const dt = Math.min(delta, 0.1);

    let activeCount = 0;

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;

      // 물리 업데이트
      p.x += p.vx * dt;
      p.vy += p.gravity * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // 수명 감소
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // 스케일: 수명 비례 축소
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      const s = p.size * lifeRatio;

      // Matrix 설정
      _obj.position.set(p.x, p.y, p.z);
      _obj.rotation.set(0, 0, 0);
      _obj.scale.set(s, s, s);
      _obj.updateMatrix();
      mesh.setMatrixAt(activeCount, _obj.matrix);

      // Color 설정
      _color.copy(p.color);
      mesh.setColorAt(activeCount, _color);

      activeCount++;
    }

    mesh.count = activeCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_PARTICLES]}
      frustumCulled={false}
    />
  );
});
