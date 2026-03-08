'use client';

/**
 * ARFieldItems — 필드 아이템 InstancedMesh 렌더링 (Phase 4 전투 이펙트)
 *
 * ARState.items → InstancedMesh 일괄 렌더:
 * - 아이템별 희귀도 색상 (instanceColor)
 * - 부유 + 회전 애니메이션
 * - MAX_FIELD_ITEMS=50 cap
 *
 * 성능: count 가변으로 미사용 인스턴스 자동 스킵 (숨기기 불필요)
 * useFrame priority=0
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';
import { ITEM_INFO, RARITY_COLORS } from '@/lib/3d/ar-types';
import type { ARState, ARItemID } from '@/lib/3d/ar-types';

const MAX_FIELD_ITEMS = 50;
const ITEM_SIZE = 0.35;
const FLOAT_AMP = 0.15;    // 부유 진폭
const FLOAT_SPEED = 2.0;   // 부유 속도
const ROTATE_SPEED = 1.5;  // 회전 속도

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// ============================================================
// 아이템 색상 헬퍼
// ============================================================

function getItemColor(itemId: ARItemID): string {
  const info = ITEM_INFO[itemId];
  if (!info) return '#CCCCCC';
  return RARITY_COLORS[info.rarity] ?? '#CCCCCC';
}

// ============================================================
// Props
// ============================================================

interface ARFieldItemsProps {
  arStateRef: React.MutableRefObject<ARState | null>;
  arenaSeed: number;
  flattenVariance?: number;
}

// ============================================================
// ARFieldItems 컴포넌트
// ============================================================

function ARFieldItemsInner({ arStateRef, arenaSeed, flattenVariance = 3 }: ARFieldItemsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE), []);
  const mat = useMemo(
    () => new THREE.MeshLambertMaterial({ emissive: new THREE.Color(0x222222) }),
    [],
  );

  // Dispose on unmount
  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame(() => {
    const mesh = meshRef.current;
    const arState = arStateRef.current;
    if (!mesh || !arState) return;

    const items = arState.items;
    const count = Math.min(items.length, MAX_FIELD_ITEMS);
    const t = performance.now() * 0.001;

    for (let i = 0; i < count; i++) {
      const item = items[i];

      // 지형 높이 + 부유 효과
      const terrainY = getArenaTerrainHeight(item.x, item.z, arenaSeed, flattenVariance);
      const localY = terrainY - MC_BASE_Y + 0.5;
      const floatY = localY + Math.sin(t * FLOAT_SPEED + i * 1.7) * FLOAT_AMP;

      _dummy.position.set(item.x, floatY, item.z);
      _dummy.rotation.set(0, t * ROTATE_SPEED + i * 0.5, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      // 아이템 희귀도별 색상
      _color.set(getItemColor(item.itemId));
      mesh.setColorAt(i, _color);
    }

    // count 가변으로 미사용 인스턴스 자동 제외 (position 숨기기 불필요)
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_FIELD_ITEMS]}
      frustumCulled={false}
    />
  );
}

export const ARFieldItems = memo(ARFieldItemsInner);
