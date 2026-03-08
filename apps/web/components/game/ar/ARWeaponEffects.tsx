'use client';

/**
 * ARWeaponEffects — 근접 공격 슬래시 VFX (Phase 4 전투 이펙트)
 *
 * ARDamageEvent 기반 slash 트리거:
 * - 로컬 플레이어 공격 범위 내 데미지 이벤트 → 반원 아크 메쉬
 * - 0.2초 페이드 아웃 + 회전 확대 애니메이션
 * - MAX_SLASHES=8 슬롯 순환 (오브젝트 풀)
 *
 * 각 slash는 개별 material clone → 독립 opacity 페이드
 * useFrame priority=0
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';
import type { AREvent } from '@/hooks/useSocket';
import type { ARDamageEvent } from '@/lib/3d/ar-types';

const MAX_SLASHES = 8;
const SLASH_DURATION = 0.2; // 초

// ============================================================
// Slash 이펙트 데이터
// ============================================================

interface SlashEffect {
  x: number;
  z: number;
  rot: number;       // 방향 (라디안)
  startTime: number;  // performance.now()
  active: boolean;
}

// ============================================================
// Props
// ============================================================

interface ARWeaponEffectsProps {
  arEventQueueRef: React.MutableRefObject<AREvent[]>;
  playerId: string;
  playerPos: React.MutableRefObject<{ x: number; y: number; z: number }>;
  arenaSeed: number;
  flattenVariance?: number;
}

// ============================================================
// ARWeaponEffects 컴포넌트
// ============================================================

function ARWeaponEffectsInner({
  arEventQueueRef,
  playerId,
  playerPos,
  arenaSeed,
  flattenVariance = 3,
}: ARWeaponEffectsProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 슬래시 데이터 풀
  const slashesRef = useRef<SlashEffect[]>(
    Array.from({ length: MAX_SLASHES }, () => ({
      x: 0, z: 0, rot: 0, startTime: 0, active: false,
    })),
  );
  const nextSlashIdx = useRef(0);

  // mesh refs
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_SLASHES).fill(null));

  // 반원 아크 지오메트리 (slash 모양)
  const slashGeo = useMemo(() => new THREE.CircleGeometry(1.5, 16, 0, Math.PI), []);

  // 개별 material 배열 (각 slash가 독립 opacity를 가지도록 clone)
  const slashMats = useMemo(
    () =>
      Array.from({ length: MAX_SLASHES }, () =>
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    [],
  );

  // Dispose on unmount
  useEffect(() => {
    return () => {
      slashGeo.dispose();
      for (const mat of slashMats) mat.dispose();
    };
  }, [slashGeo, slashMats]);

  useFrame(() => {
    const queue = arEventQueueRef.current;
    const now = performance.now();
    const px = playerPos.current.x;
    const pz = playerPos.current.z;

    // 1. damage 이벤트 소비 — 로컬 플레이어 공격 범위(4m) 내 데미지 → slash 생성
    //    NOTE: queue를 제거하지 않음 (ARDamageNumbersBridge 등 다른 소비자와 공유)
    for (let i = 0; i < queue.length; i++) {
      const evt = queue[i];
      if (evt.type !== 'damage') continue;
      const dmg = evt.data as ARDamageEvent;

      // 플레이어 공격 범위 내 데미지만 slash 표시
      const dx = dmg.x - px;
      const dz = dmg.z - pz;
      const distSq = dx * dx + dz * dz;

      // 4m 범위 밖이면 스킵
      if (distSq > 16) continue;

      const rot = Math.atan2(dx, dz);
      const idx = nextSlashIdx.current % MAX_SLASHES;
      const slash = slashesRef.current[idx];
      slash.x = px + dx * 0.5; // 플레이어-대상 중간 지점
      slash.z = pz + dz * 0.5;
      slash.rot = rot;
      slash.startTime = now;
      slash.active = true;
      nextSlashIdx.current++;
    }

    // 2. 활성 slash 애니메이션 업데이트
    for (let i = 0; i < MAX_SLASHES; i++) {
      const slash = slashesRef.current[i];
      const mesh = meshRefs.current[i];
      const mat = slashMats[i];
      if (!mesh) continue;

      if (!slash.active) {
        mesh.visible = false;
        continue;
      }

      const elapsed = (now - slash.startTime) / 1000;
      if (elapsed >= SLASH_DURATION) {
        slash.active = false;
        mesh.visible = false;
        mat.opacity = 0;
        continue;
      }

      const progress = elapsed / SLASH_DURATION; // 0→1

      // 지형 높이
      const terrainY = getArenaTerrainHeight(slash.x, slash.z, arenaSeed, flattenVariance);
      const localY = terrainY - MC_BASE_Y + 1.0;

      mesh.visible = true;
      mesh.position.set(slash.x, localY, slash.z);
      // 수평 배치 + 방향 회전 + 진행에 따라 약간 회전 추가
      mesh.rotation.set(-Math.PI / 2, 0, slash.rot + Math.PI * progress * 0.3);
      // 확대 애니메이션 (50% → 130% 크기)
      mesh.scale.setScalar(0.5 + progress * 0.8);

      // 독립 opacity 페이드 아웃 (0.6 → 0)
      mat.opacity = 0.6 * (1 - progress);
    }
  });

  return (
    <group ref={groupRef}>
      {slashMats.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
          geometry={slashGeo}
          material={mat}
        />
      ))}
    </group>
  );
}

export const ARWeaponEffects = memo(ARWeaponEffectsInner);
