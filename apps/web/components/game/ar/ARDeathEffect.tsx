'use client';

/**
 * ARDeathEffect — 적 사망 시 큐브 파편 폭발 이펙트
 *
 * InstancedMesh 기반 파편 시스템:
 * - 사망 좌표에서 8-12개 작은 큐브 방사형 확산
 * - 0.5초 페이드 (스케일 축소 + 위치 확산)
 * - MAX_DEATH_EFFECTS=20 cap + 순환 재활용
 * - 적 타입별 파편 색상
 *
 * useFrame priority=0
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ENEMY_COLORS } from '@/lib/3d/ar-types';
import type { AREnemyType } from '@/lib/3d/ar-types';

const MAX_DEATH_EFFECTS = 20;
const FRAGMENTS_PER_DEATH = 10;
const MAX_FRAGMENTS = MAX_DEATH_EFFECTS * FRAGMENTS_PER_DEATH; // 200
const DEATH_DURATION = 0.5; // 초

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// 파편 데이터
interface DeathEffect {
  active: boolean;
  startTime: number;
  x: number;
  y: number;
  z: number;
  color: string;
  // 파편별 속도 (방사형)
  vx: Float32Array; // FRAGMENTS_PER_DEATH
  vy: Float32Array;
  vz: Float32Array;
  scaleFactor: Float32Array; // 파편별 고정 랜덤 스케일
}

function createDeathEffect(): DeathEffect {
  return {
    active: false,
    startTime: 0,
    x: 0, y: 0, z: 0,
    color: '#ffffff',
    vx: new Float32Array(FRAGMENTS_PER_DEATH),
    vy: new Float32Array(FRAGMENTS_PER_DEATH),
    vz: new Float32Array(FRAGMENTS_PER_DEATH),
    scaleFactor: new Float32Array(FRAGMENTS_PER_DEATH),
  };
}

// ============================================================
// Props
// ============================================================

export interface DeathEventData {
  x: number;
  y: number;
  z: number;
  enemyType: AREnemyType;
}

interface ARDeathEffectProps {
  /** 외부에서 사망 이벤트를 push하는 큐 ref */
  deathQueueRef: React.MutableRefObject<DeathEventData[]>;
}

// ============================================================
// ARDeathEffect 컴포넌트
// ============================================================

function ARDeathEffectInner({ deathQueueRef }: ARDeathEffectProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // 사망 이펙트 풀
  const effectsRef = useRef<DeathEffect[]>(
    Array.from({ length: MAX_DEATH_EFFECTS }, () => createDeathEffect()),
  );
  const nextEffectIdx = useRef(0);

  // geometry + material
  const geo = useMemo(() => new THREE.BoxGeometry(0.08, 0.08, 0.08), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const now = performance.now() * 0.001;

    // 1. 사망 이벤트 소비
    const queue = deathQueueRef.current;
    while (queue.length > 0) {
      const evt = queue.pop()!;
      const idx = nextEffectIdx.current % MAX_DEATH_EFFECTS;
      const effect = effectsRef.current[idx];

      effect.active = true;
      effect.startTime = now;
      effect.x = evt.x;
      effect.y = evt.y;
      effect.z = evt.z;
      effect.color = ENEMY_COLORS[evt.enemyType] ?? '#888888';

      // 랜덤 방사형 속도 + 스케일 팩터 생성 (스폰 시 1회만)
      for (let f = 0; f < FRAGMENTS_PER_DEATH; f++) {
        const angle = (f / FRAGMENTS_PER_DEATH) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = 2 + Math.random() * 3;
        effect.vx[f] = Math.cos(angle) * speed;
        effect.vy[f] = 2 + Math.random() * 4; // 위로 튀어오름
        effect.vz[f] = Math.sin(angle) * speed;
        effect.scaleFactor[f] = 0.5 + Math.random() * 0.5; // 고정 랜덤 스케일
      }

      nextEffectIdx.current++;
    }

    // 2. 모든 활성 이펙트 업데이트
    let visibleCount = 0;

    for (let i = 0; i < MAX_DEATH_EFFECTS; i++) {
      const effect = effectsRef.current[i];
      if (!effect.active) continue;

      const elapsed = now - effect.startTime;
      if (elapsed >= DEATH_DURATION) {
        effect.active = false;
        continue;
      }

      const progress = elapsed / DEATH_DURATION; // 0→1
      const scale = 1 - progress; // 1→0 축소
      const gravity = -9.8;

      _color.set(effect.color);

      for (let f = 0; f < FRAGMENTS_PER_DEATH; f++) {
        const fx = effect.x + effect.vx[f] * elapsed;
        const fy = effect.y + effect.vy[f] * elapsed + 0.5 * gravity * elapsed * elapsed;
        const fz = effect.z + effect.vz[f] * elapsed;

        _dummy.position.set(fx, Math.max(0, fy), fz);
        _dummy.scale.setScalar(scale * effect.scaleFactor[f]);
        _dummy.rotation.set(
          elapsed * (f * 3 + 1),
          elapsed * (f * 2 + 0.5),
          elapsed * (f * 4 + 2),
        );
        _dummy.updateMatrix();
        mesh.setMatrixAt(visibleCount, _dummy.matrix);
        mesh.setColorAt(visibleCount, _color);
        visibleCount++;
      }
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_FRAGMENTS]}
      frustumCulled={false}
    />
  );
}

export const ARDeathEffect = memo(ARDeathEffectInner);
