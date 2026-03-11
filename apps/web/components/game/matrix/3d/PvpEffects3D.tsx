'use client';

/**
 * PvpEffects3D.tsx — PvP 전투 3D 시각효과 (S41)
 *
 * Phase 7: Multiplayer 3D
 * 1. Hit effect: TorusGeometry expanding ring + emissive
 * 2. Kill effect: Double ring + radial particle burst
 * 3. Critical effect: ring + particles + screen shake trigger
 * 4. 최대 30 hit effects, 40 damage numbers
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================
// Constants
// ============================================

/** 히트 이펙트 최대 동시 수 */
const MAX_HIT_EFFECTS = 30;

/** 히트 이펙트 지속 시간 (초) */
const HIT_EFFECT_DURATION = 0.4;
const KILL_EFFECT_DURATION = 0.8;
const CRITICAL_EFFECT_DURATION = 0.6;

/** 히트 링 최대 반경 */
const HIT_RING_MAX_RADIUS = 3.0;
const KILL_RING_MAX_RADIUS = 5.0;

/** 파티클 버스트 개수 */
const KILL_PARTICLE_COUNT = 8;
const CRITICAL_PARTICLE_COUNT = 4;

/** 이펙트 색상 */
const HIT_COLOR = new THREE.Color('#EF4444');
const KILL_COLOR = new THREE.Color('#CC9933');
const CRITICAL_COLOR = new THREE.Color('#FFD700');

/** 영점 매트릭스 */
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

// 임시 객체 (GC 방지)
const _tempMatrix = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();
const _tempScale = new THREE.Vector3();
const _tempColor = new THREE.Color();

// ============================================
// Types
// ============================================

/** PvP 이펙트 데이터 */
export interface PvpEffect3DData {
  /** 이펙트 타입 */
  type: 'hit' | 'kill' | 'critical';
  /** 2D 월드 좌표 X */
  x: number;
  /** 2D 월드 좌표 Y */
  y: number;
  /** 생성 시간 (초 기반, elapsed) */
  startTime: number;
  /** 활성 여부 */
  active: boolean;
  /** 슬롯 인덱스 */
  slot: number;
}

export interface PvpEffects3DProps {
  /** 이펙트 큐 ref (외부에서 push) */
  effectsQueueRef: React.MutableRefObject<Array<{
    type: 'hit' | 'kill' | 'critical';
    x: number;
    y: number;
  }>>;
  /** 스크린 쉐이크 트리거 ref (critical에서 사용) */
  screenShakeRef?: React.MutableRefObject<{ intensity: number; decay: number }>;
}

// ============================================
// PvpEffects3D 컴포넌트
// ============================================

/**
 * PvpEffects3D — PvP 전투 3D 시각효과 시스템
 *
 * TorusGeometry 링 이펙트 + InstancedMesh 파티클 버스트
 */
export function PvpEffects3D({
  effectsQueueRef,
  screenShakeRef,
}: PvpEffects3DProps) {
  // 링 이펙트 풀 (TorusGeometry 재사용)
  const ringMeshRefs = useRef<THREE.Mesh[]>([]);
  const effectsRef = useRef<PvpEffect3DData[]>([]);
  const freeSlots = useRef<number[]>([]);

  // 파티클 인스턴스
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const particlesRef = useRef<Array<{
    active: boolean;
    x: number; y: number; height: number;
    vx: number; vy: number; vh: number;
    life: number; maxLife: number;
    color: THREE.Color;
    index: number;
  }>>([]);
  const freeParticles = useRef<number[]>([]);

  // 최대 파티클 capacity
  const PARTICLE_CAPACITY = 80;

  // 링 geometry + material (공유)
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1, 0.08, 8, 32), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  }), []);

  // kill용 외부 링
  const outerRingGeo = useMemo(() => new THREE.TorusGeometry(1, 0.05, 8, 32), []);
  const outerRingMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }), []);

  // 파티클 geometry + material
  const particleGeo = useMemo(() => new THREE.BoxGeometry(0.3, 0.3, 0.3), []);
  const particleMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
  }), []);

  // 초기화
  useEffect(() => {
    // 이펙트 슬롯 초기화
    const effects: PvpEffect3DData[] = [];
    const free: number[] = [];
    for (let i = MAX_HIT_EFFECTS - 1; i >= 0; i--) {
      effects.push({
        type: 'hit',
        x: 0, y: 0,
        startTime: 0,
        active: false,
        slot: i,
      });
      free.push(i);
    }
    effectsRef.current = effects;
    freeSlots.current = free;

    // 파티클 풀 초기화
    const particles: typeof particlesRef.current = [];
    const freeP: number[] = [];
    for (let i = PARTICLE_CAPACITY - 1; i >= 0; i--) {
      particles.push({
        active: false,
        x: 0, y: 0, height: 0,
        vx: 0, vy: 0, vh: 0,
        life: 0, maxLife: 1,
        color: new THREE.Color('#ffffff'),
        index: i,
      });
      freeP.push(i);
    }
    particlesRef.current = particles;
    freeParticles.current = freeP;

    // InstancedMesh 초기화
    const pmesh = particleMeshRef.current;
    if (pmesh) {
      for (let i = 0; i < PARTICLE_CAPACITY; i++) {
        pmesh.setMatrixAt(i, ZERO_MATRIX);
      }
      pmesh.instanceMatrix.needsUpdate = true;
      pmesh.count = 0;
    }

    return () => {
      ringGeo.dispose();
      ringMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [ringGeo, ringMat, outerRingGeo, outerRingMat, particleGeo, particleMat]);

  // useFrame: 이펙트 큐 소비 + 업데이트
  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // --- 큐에서 새 이펙트 소비 ---
    const queue = effectsQueueRef.current;
    while (queue.length > 0 && freeSlots.current.length > 0) {
      const req = queue.shift()!;
      const slot = freeSlots.current.pop()!;
      const effect = effectsRef.current[slot];

      effect.type = req.type;
      effect.x = req.x;
      effect.y = req.y;
      effect.startTime = elapsed;
      effect.active = true;

      // kill/critical 시 파티클 버스트
      if (req.type === 'kill' || req.type === 'critical') {
        const count = req.type === 'kill' ? KILL_PARTICLE_COUNT : CRITICAL_PARTICLE_COUNT;
        const color = req.type === 'kill' ? KILL_COLOR : CRITICAL_COLOR;

        for (let i = 0; i < count; i++) {
          if (freeParticles.current.length === 0) break;
          const pIdx = freeParticles.current.pop()!;
          const p = particlesRef.current[pIdx];

          const angle = (Math.PI * 2 / count) * i;
          const speed = 3 + Math.random() * 4;

          p.active = true;
          p.x = req.x;
          p.y = req.y;
          p.height = 1.0 + Math.random() * 1.5;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.vh = 2 + Math.random() * 3;
          p.life = 1;
          p.maxLife = 0.5 + Math.random() * 0.3;
          p.color.copy(color);
          p.color.offsetHSL((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.2);
          p.index = pIdx;
        }

        // critical: screen shake
        if (req.type === 'critical' && screenShakeRef) {
          screenShakeRef.current.intensity = 5;
          screenShakeRef.current.decay = 0.85;
        }
      }
    }

    // --- 링 이펙트 업데이트 ---
    for (const effect of effectsRef.current) {
      if (!effect.active) continue;

      const duration = effect.type === 'kill' ? KILL_EFFECT_DURATION
        : effect.type === 'critical' ? CRITICAL_EFFECT_DURATION
        : HIT_EFFECT_DURATION;
      const age = elapsed - effect.startTime;
      const progress = age / duration;

      if (progress >= 1) {
        effect.active = false;
        freeSlots.current.push(effect.slot);
        // 링 메쉬 숨기기
        const ringMesh = ringMeshRefs.current[effect.slot];
        if (ringMesh) ringMesh.visible = false;
        continue;
      }

      const ringMesh = ringMeshRefs.current[effect.slot];
      if (!ringMesh) continue;

      ringMesh.visible = true;
      ringMesh.position.set(effect.x, 0.1, -effect.y);
      ringMesh.rotation.x = -Math.PI / 2;

      // 링 확장 + 페이드
      const maxR = effect.type === 'kill' ? KILL_RING_MAX_RADIUS : HIT_RING_MAX_RADIUS;
      const scale = 0.3 + progress * maxR;
      ringMesh.scale.setScalar(scale);

      const alpha = (1 - progress) * 0.8;
      const mat = ringMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = alpha;

      // 색상 설정
      if (effect.type === 'hit') mat.color.copy(HIT_COLOR);
      else if (effect.type === 'kill') mat.color.copy(KILL_COLOR);
      else mat.color.copy(CRITICAL_COLOR);
    }

    // --- 파티클 업데이트 ---
    const pmesh = particleMeshRef.current;
    if (!pmesh) return;

    let maxIdx = -1;
    let needsUpdate = false;

    for (const p of particlesRef.current) {
      if (!p.active) continue;

      p.life -= dt / p.maxLife;
      if (p.life <= 0) {
        p.active = false;
        pmesh.setMatrixAt(p.index, ZERO_MATRIX);
        freeParticles.current.push(p.index);
        needsUpdate = true;
        continue;
      }

      // 위치 업데이트
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vh -= 15 * dt;
      p.height += p.vh * dt;
      if (p.height < 0) { p.height = 0; p.vh = 0; }

      // 드래그
      p.vx *= 0.97;
      p.vy *= 0.97;

      // 스케일 (이징)
      const scale = p.life * 0.5;

      _tempPos.set(p.x, p.height + 0.15, -p.y);
      _tempMatrix.makeTranslation(_tempPos.x, _tempPos.y, _tempPos.z);
      _tempScale.set(scale, scale, scale);
      _tempMatrix.scale(_tempScale);

      pmesh.setMatrixAt(p.index, _tempMatrix);
      _tempColor.copy(p.color).multiplyScalar(1 + p.life * 2);
      pmesh.setColorAt(p.index, _tempColor);

      if (p.index > maxIdx) maxIdx = p.index;
      needsUpdate = true;
    }

    if (needsUpdate) {
      pmesh.count = maxIdx + 1;
      pmesh.instanceMatrix.needsUpdate = true;
      if (pmesh.instanceColor) pmesh.instanceColor.needsUpdate = true;
    }
  });

  // 링 메쉬 풀 렌더링
  const ringSlots = useMemo(() => {
    return Array.from({ length: MAX_HIT_EFFECTS }, (_, i) => i);
  }, []);

  return (
    <group name="pvp-effects-3d">
      {/* 링 이펙트 풀 */}
      {ringSlots.map((i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => {
            if (el) ringMeshRefs.current[i] = el;
          }}
          visible={false}
        >
          <primitive object={ringGeo} attach="geometry" />
          <meshBasicMaterial
            transparent
            opacity={0.8}
            depthWrite={false}
            color="#ffffff"
          />
        </mesh>
      ))}

      {/* 파티클 버스트 (InstancedMesh) */}
      <instancedMesh
        ref={particleMeshRef}
        args={[particleGeo, particleMat, PARTICLE_CAPACITY]}
        frustumCulled={false}
      />
    </group>
  );
}

// ============================================
// usePvpEffects — 이펙트 큐 훅
// ============================================

/**
 * usePvpEffects — PvP 이펙트 트리거 훅
 *
 * hit/kill/critical 이펙트를 큐에 추가합니다.
 */
export function usePvpEffects() {
  const queueRef = useRef<Array<{
    type: 'hit' | 'kill' | 'critical';
    x: number;
    y: number;
  }>>([]);

  const addHit = (x: number, y: number) => {
    queueRef.current.push({ type: 'hit', x, y });
  };

  const addKill = (x: number, y: number) => {
    queueRef.current.push({ type: 'kill', x, y });
  };

  const addCritical = (x: number, y: number) => {
    queueRef.current.push({ type: 'critical', x, y });
  };

  return { queueRef, addHit, addKill, addCritical };
}

export default PvpEffects3D;
