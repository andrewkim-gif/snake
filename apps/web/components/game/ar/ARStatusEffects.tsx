'use client';

/**
 * ARStatusEffects — 상태이상 비주얼 오버레이 (Phase 3 Task 8)
 *
 * 적 및 플레이어에게 상태이상이 걸렸을 때
 * 색상 링/오라 이펙트를 표시한다.
 *
 * freeze(파랑) / burn(빨강) / poison(초록) / bleed(진홍) / shock(노랑) / mark(보라)
 *
 * arStateRef에서 적 데이터를 읽고, ar_damage 이벤트의 statusFx 필드를 추적한다.
 */

import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ARState, ARStatusEffect } from '@/lib/3d/ar-types';
import type { AREvent } from '@/hooks/useSocket';
import { drainAREvents } from '@/hooks/useSocket';

const MAX_EFFECTS = 100;

// 상태이상 색상
const STATUS_COLORS: Record<ARStatusEffect, THREE.Color> = {
  freeze: new THREE.Color(0.3, 0.6, 1.0),
  burn: new THREE.Color(1.0, 0.3, 0.1),
  poison: new THREE.Color(0.3, 0.9, 0.3),
  bleed: new THREE.Color(0.8, 0.1, 0.1),
  shock: new THREE.Color(1.0, 0.9, 0.3),
  mark: new THREE.Color(0.7, 0.3, 0.9),
};

interface StatusEffectInstance {
  id: string; // targetId
  x: number;
  z: number;
  effect: ARStatusEffect;
  age: number;
  duration: number;
}

interface ARStatusEffectsProps {
  arStateRef: React.MutableRefObject<ARState | null>;
  arEventQueueRef: React.MutableRefObject<AREvent[]>;
}

const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();

function ARStatusEffectsInner({ arStateRef, arEventQueueRef }: ARStatusEffectsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const effectsRef = useRef<StatusEffectInstance[]>([]);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  useFrame((_, delta) => {
    // 이벤트 큐에서 damage 이벤트의 statusFx를 탐지
    // NOTE: drain은 ARDamageNumbers가 하므로, 여기서는 queue를 peek만 한다
    const queue = arEventQueueRef.current;
    for (const evt of queue) {
      if (evt.type === 'damage' && evt.data.statusFx) {
        const fx = evt.data.statusFx as ARStatusEffect;
        if (STATUS_COLORS[fx]) {
          // 이미 같은 대상에 같은 이펙트가 있으면 갱신
          const existing = effectsRef.current.find(
            (e) => e.id === evt.data.targetId && e.effect === fx
          );
          if (existing) {
            existing.age = 0;
            existing.x = evt.data.x;
            existing.z = evt.data.z;
          } else {
            effectsRef.current.push({
              id: evt.data.targetId,
              x: evt.data.x,
              z: evt.data.z,
              effect: fx,
              age: 0,
              duration: 2.0, // 2초간 표시
            });
          }
        }
      }
    }

    // 에이징 + 만료 제거
    for (const eff of effectsRef.current) {
      eff.age += delta;
    }
    effectsRef.current = effectsRef.current
      .filter((e) => e.age < e.duration)
      .slice(0, MAX_EFFECTS);

    // 현재 arState에서 적 위치 업데이트 (위치 동기화)
    const arState = arStateRef.current;
    if (arState) {
      for (const eff of effectsRef.current) {
        const enemy = arState.enemies.find((e) => e.id === eff.id);
        if (enemy) {
          eff.x = enemy.x;
          eff.z = enemy.z;
        }
        const player = arState.players.find((p) => p.id === eff.id);
        if (player) {
          eff.x = player.pos.x;
          eff.z = player.pos.z;
        }
      }
    }

    // InstancedMesh 업데이트
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const effects = effectsRef.current;

    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i];
      const pulse = 0.8 + Math.sin(performance.now() * 0.008 + i) * 0.2;
      const ageRatio = eff.age / eff.duration;
      const fadeAlpha = ageRatio > 0.7 ? 1.0 - (ageRatio - 0.7) / 0.3 : 1.0;

      dummy.position.set(eff.x, 0.1, eff.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1.5 * pulse, 1.5 * pulse, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const col = STATUS_COLORS[eff.effect] || STATUS_COLORS.burn;
      tempColor.copy(col).multiplyScalar(fadeAlpha);
      mesh.setColorAt(i, tempColor);
    }

    mesh.count = effects.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_EFFECTS]}
      material={mat}
      frustumCulled={false}
    >
      <ringGeometry args={[0.5, 1.2, 16]} />
    </instancedMesh>
  );
}

export const ARStatusEffects = memo(ARStatusEffectsInner);
