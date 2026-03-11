'use client';

/**
 * ParticleSystem.tsx — InstancedMesh 기반 3D 파티클 시스템 (S34)
 *
 * 1. InstancedMesh 기반 particle system (capacity: 500)
 * 2. 기존 ExtendedParticle 속성 매핑: easing, trail, fade, glow
 * 3. Burst styles: data, pixel, slime, spark, smoke, shatter, electric, gold
 * 4. LOD 연동: LOW에서 파티클 수 50% 감소
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EASING, type EasingType, applyEasing } from '@/lib/matrix/rendering/effects/easing';
import type { QualityTier } from '@/hooks/useAdaptiveQuality';

// ============================================
// Constants
// ============================================

/** 파티클 기본 geometry 크기 */
const PARTICLE_SIZE = 0.5;

/** capacity별 설정 */
const CAPACITY_BY_QUALITY: Record<QualityTier, number> = {
  HIGH: 500,
  MEDIUM: 250,
  LOW: 100,
};

/** 영점 스케일 매트릭스 (비활성 숨김) */
const ZERO_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

// 임시 연산용 오브젝트 (GC 방지)
const _tempMatrix = new THREE.Matrix4();
const _tempRotMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempScale = new THREE.Vector3();
const _tempColor = new THREE.Color();
const _tempBurstColor = new THREE.Color();

// ============================================
// Burst Style 정의
// ============================================

/**
 * 버스트 스타일 — 기존 2D 파티클 효과를 3D로 매핑
 */
export type BurstStyle =
  | 'data'      // Small cube, cyan — 데이터 효과
  | 'pixel'     // Small cube, random color — 픽셀 파편
  | 'slime'     // Sphere + gravity + bounce — 슬라임
  | 'spark'     // Elongated cube + emissive — 불꽃
  | 'smoke'     // Sphere + scale up + fade — 연기
  | 'shatter'   // Cube fragments + rotation — 파편
  | 'electric'  // Emissive jitter — 전기
  | 'gold';     // Flat cylinder spin + emissive — 골드

/**
 * 버스트 스타일별 기본 설정
 */
interface BurstStyleConfig {
  /** 파티클 색상 */
  color: string;
  /** 초기 속도 배율 */
  speedMultiplier: number;
  /** 크기 배율 */
  scaleMultiplier: number;
  /** 수명 (초) */
  lifetime: number;
  /** 이징 타입 */
  easing: EasingType;
  /** 중력 적용 여부 */
  gravity: boolean;
  /** emissive 여부 (bloom 연동) */
  glow: boolean;
  /** 드래그 계수 */
  drag: number;
}

const BURST_CONFIGS: Record<BurstStyle, BurstStyleConfig> = {
  data: {
    color: '#00ffff',
    speedMultiplier: 1.2,
    scaleMultiplier: 0.6,
    lifetime: 0.6,
    easing: 'easeOutQuad',
    gravity: false,
    glow: true,
    drag: 0.02,
  },
  pixel: {
    color: '#ffffff',
    speedMultiplier: 1.0,
    scaleMultiplier: 0.8,
    lifetime: 0.5,
    easing: 'easeOutCubic',
    gravity: false,
    glow: false,
    drag: 0.03,
  },
  slime: {
    color: '#44ff44',
    speedMultiplier: 0.8,
    scaleMultiplier: 1.0,
    lifetime: 0.8,
    easing: 'easeOutBounce',
    gravity: true,
    glow: false,
    drag: 0.01,
  },
  spark: {
    color: '#ffaa00',
    speedMultiplier: 2.0,
    scaleMultiplier: 0.4,
    lifetime: 0.3,
    easing: 'easeOutExpo',
    gravity: false,
    glow: true,
    drag: 0.05,
  },
  smoke: {
    color: '#888888',
    speedMultiplier: 0.4,
    scaleMultiplier: 1.5,
    lifetime: 1.2,
    easing: 'easeInQuad',
    gravity: false,
    glow: false,
    drag: 0.04,
  },
  shatter: {
    color: '#cccccc',
    speedMultiplier: 1.5,
    scaleMultiplier: 0.7,
    lifetime: 0.7,
    easing: 'easeOutQuart',
    gravity: true,
    glow: false,
    drag: 0.01,
  },
  electric: {
    color: '#88ccff',
    speedMultiplier: 1.8,
    scaleMultiplier: 0.3,
    lifetime: 0.25,
    easing: 'easeOutElastic',
    gravity: false,
    glow: true,
    drag: 0.08,
  },
  gold: {
    color: '#ffd700',
    speedMultiplier: 1.0,
    scaleMultiplier: 0.9,
    lifetime: 0.9,
    easing: 'easeOutSine',
    gravity: true,
    glow: true,
    drag: 0.02,
  },
};

// ============================================
// Particle 데이터 구조
// ============================================

/**
 * 단일 파티클 상태 (내부용)
 */
interface Particle3DState {
  /** InstancedMesh 인스턴스 인덱스 */
  index: number;
  /** 활성 여부 */
  active: boolean;
  /** 2D 월드 좌표 X */
  x: number;
  /** 2D 월드 좌표 Y */
  y: number;
  /** 3D 높이 (지면 위) */
  height: number;
  /** X 속도 */
  vx: number;
  /** Y 속도 */
  vy: number;
  /** 높이 속도 (중력용) */
  vh: number;
  /** 남은 수명 (0-1, 0=사망) */
  life: number;
  /** 최대 수명 (초) */
  maxLife: number;
  /** 기본 스케일 */
  baseScale: number;
  /** 이징 함수 타입 */
  easing: EasingType;
  /** 드래그 계수 */
  drag: number;
  /** 중력 적용 여부 */
  gravity: boolean;
  /** emissive 여부 */
  glow: boolean;
  /** 파티클 색상 */
  color: THREE.Color;
  /** 회전 속도 (shatter용) */
  rotationSpeed: number;
  /** 현재 회전 */
  rotation: number;
}

// ============================================
// ParticleSystem 컴포넌트
// ============================================

export interface ParticleSystemProps {
  /** 품질 티어 */
  qualityTier?: QualityTier;
}

/**
 * ParticleSystem — InstancedMesh 기반 3D 파티클 시스템
 *
 * capacity: 500 (HIGH), 250 (MEDIUM), 100 (LOW)
 * 기존 ExtendedParticle의 easing, glow, drag 속성 매핑
 */
export function ParticleSystem({ qualityTier = 'HIGH' }: ParticleSystemProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const capacity = CAPACITY_BY_QUALITY[qualityTier];

  // 파티클 상태 배열
  const particlesRef = useRef<Particle3DState[]>([]);
  const freeIndicesRef = useRef<number[]>([]);

  // geometry & material (메모이즈)
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
    });
  }, []);

  // 초기화: 파티클 풀 생성
  useEffect(() => {
    const particles: Particle3DState[] = [];
    const freeIndices: number[] = [];

    for (let i = capacity - 1; i >= 0; i--) {
      particles.push({
        index: i,
        active: false,
        x: 0, y: 0, height: 0,
        vx: 0, vy: 0, vh: 0,
        life: 0,
        maxLife: 1,
        baseScale: 1,
        easing: 'linear',
        drag: 0,
        gravity: false,
        glow: false,
        color: new THREE.Color('#ffffff'),
        rotationSpeed: 0,
        rotation: 0,
      });
      freeIndices.push(i);
    }

    particlesRef.current = particles;
    freeIndicesRef.current = freeIndices;

    // 모든 인스턴스를 scale(0,0,0)으로 초기화
    const mesh = meshRef.current;
    if (mesh) {
      for (let i = 0; i < capacity; i++) {
        mesh.setMatrixAt(i, ZERO_SCALE_MATRIX);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = 0;
    }

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [capacity, geometry, material]);

  // useFrame: 파티클 업데이트 (priority=0)
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(delta, 0.05); // 프레임 스파이크 방지
    const particles = particlesRef.current;
    let maxActiveIndex = -1;
    let needsUpdate = false;

    for (const p of particles) {
      if (!p.active) continue;

      // 수명 감소
      p.life -= dt / p.maxLife;

      if (p.life <= 0) {
        // 사망: scale(0,0,0)으로 숨기고 free pool에 반환
        p.active = false;
        mesh.setMatrixAt(p.index, ZERO_SCALE_MATRIX);
        freeIndicesRef.current.push(p.index);
        needsUpdate = true;
        continue;
      }

      // 위치 업데이트
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 중력 적용
      if (p.gravity) {
        p.vh -= 30 * dt; // 중력 가속도
        p.height += p.vh * dt;
        // 바닥 바운스
        if (p.height < 0) {
          p.height = 0;
          p.vh = Math.abs(p.vh) * 0.3; // 반발 계수
          if (Math.abs(p.vh) < 0.5) p.vh = 0;
        }
      }

      // 드래그 적용
      if (p.drag > 0) {
        const dragFactor = 1 - p.drag;
        p.vx *= dragFactor;
        p.vy *= dragFactor;
      }

      // 회전
      p.rotation += p.rotationSpeed * dt;

      // 이징 적용 스케일
      const easedLife = applyEasing(p.life, p.easing);
      const scale = easedLife * p.baseScale;

      // InstancedMesh matrix 업데이트 (2D→3D 좌표 매핑)
      _tempPosition.set(p.x, p.height + PARTICLE_SIZE * 0.5, -p.y);
      _tempScale.set(scale, scale, scale);

      _tempMatrix.makeTranslation(_tempPosition.x, _tempPosition.y, _tempPosition.z);
      if (p.rotationSpeed !== 0) {
        _tempRotMatrix.makeRotationY(p.rotation);
        _tempMatrix.multiply(_tempRotMatrix);
      }
      _tempMatrix.scale(_tempScale);

      mesh.setMatrixAt(p.index, _tempMatrix);

      // 색상 업데이트 (emissive glow)
      if (p.glow) {
        _tempColor.copy(p.color).multiplyScalar(1 + easedLife * 2);
      } else {
        _tempColor.copy(p.color);
      }
      mesh.setColorAt(p.index, _tempColor);

      if (p.index > maxActiveIndex) maxActiveIndex = p.index;
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
      args={[geometry, material, capacity]}
      frustumCulled={false}
    />
  );
}

// ============================================
// Burst API (외부에서 파티클 방출)
// ============================================

/**
 * Burst 요청 인터페이스
 */
export interface BurstRequest {
  /** 2D 월드 좌표 */
  x: number;
  y: number;
  /** 파티클 수 */
  count: number;
  /** 버스트 스타일 */
  style: BurstStyle;
  /** 색상 오버라이드 (optional) */
  color?: string;
  /** 속도 배율 오버라이드 (optional) */
  speedMultiplier?: number;
}

/**
 * useParticleBurst — 파티클 버스트 트리거 훅
 *
 * ParticleSystem 컴포넌트에 burst 요청을 전달합니다.
 * burst queue를 ref로 관리하여 React re-render 없이 동작.
 */
export function useParticleBurst() {
  const burstQueueRef = useRef<BurstRequest[]>([]);

  /** 버스트 요청 추가 */
  const emit = (request: BurstRequest) => {
    burstQueueRef.current.push(request);
  };

  /** 큐에서 모든 요청 소비 (ParticleSystem에서 호출) */
  const consumeQueue = (): BurstRequest[] => {
    if (burstQueueRef.current.length === 0) return [];
    const queue = burstQueueRef.current;
    burstQueueRef.current = [];
    return queue;
  };

  return { emit, consumeQueue, burstQueueRef };
}

/**
 * spawnBurst — 파티클 시스템에 burst 발사 (직접 호출용)
 *
 * ParticleSystem의 내부 상태에 직접 파티클 추가.
 * useFrame에서 자동으로 업데이트됨.
 */
export function spawnBurst(
  particles: Particle3DState[],
  freeIndices: number[],
  mesh: THREE.InstancedMesh,
  request: BurstRequest,
  qualityTier: QualityTier = 'HIGH'
): void {
  const config = BURST_CONFIGS[request.style];
  const actualCount =
    qualityTier === 'LOW'
      ? Math.ceil(request.count * 0.5) // LOW: 50% 감소
      : qualityTier === 'MEDIUM'
        ? Math.ceil(request.count * 0.75)
        : request.count;

  const speedMult = request.speedMultiplier ?? config.speedMultiplier;
  const baseColor = _tempBurstColor.set(request.color ?? config.color);

  for (let i = 0; i < actualCount; i++) {
    if (freeIndices.length === 0) break;

    const idx = freeIndices.pop()!;
    const p = particles[idx];

    // 방사형 분포 각도
    const angle = (Math.PI * 2 * i) / actualCount + (Math.random() - 0.5) * 0.5;
    const speed = (2 + Math.random() * 4) * speedMult;

    p.index = idx;
    p.active = true;
    p.x = request.x + (Math.random() - 0.5) * 2;
    p.y = request.y + (Math.random() - 0.5) * 2;
    p.height = 0.5 + Math.random() * 1.5;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.vh = config.gravity ? (1 + Math.random() * 3) : 0;
    p.life = 1;
    p.maxLife = config.lifetime * (0.8 + Math.random() * 0.4);
    p.baseScale = config.scaleMultiplier * (0.5 + Math.random() * 0.5);
    p.easing = config.easing;
    p.drag = config.drag;
    p.gravity = config.gravity;
    p.glow = config.glow;
    p.rotationSpeed = request.style === 'shatter' ? (Math.random() - 0.5) * 10 : 0;
    p.rotation = Math.random() * Math.PI * 2;

    // 색상: pixel 스타일은 랜덤, 나머지는 config
    if (request.style === 'pixel') {
      p.color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6); // burst 시 1회만 — 허용
    } else {
      p.color = baseColor.clone(); // burst 시 1회만 — 허용
      // 약간의 색상 변형
      p.color.offsetHSL(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      );
    }

    // InstancedMesh 초기 위치 설정
    mesh.count = Math.max(mesh.count, idx + 1);
  }

  mesh.instanceMatrix.needsUpdate = true;
}

export default ParticleSystem;
