'use client';

/**
 * AREntities — 하이브리드 LOD 적 + XP 크리스탈 렌더링 (Phase 2 Visual Overhaul)
 *
 * 하이브리드 LOD 시스템:
 * - 근거리 (≤20m): 최대 MAX_DETAIL_ENEMIES=30개 → AREnemyModel multi-part group (pre-mount pool)
 * - 원거리 (20-60m): InstancedMesh box 렌더링
 * - 60m+: 렌더링 스킵
 *
 * 성능 최적화:
 * - 근거리 적 pool은 항상 30개 마운트, useFrame에서 visibility + transform 직접 제어
 * - nearEnemySlots ref로 매 프레임 업데이트 (setState 없음)
 * - 1Hz 카운터 state로 리렌더 트리거 (슬롯 데이터 갱신용)
 *
 * useFrame priority=0
 */

import { useRef, useMemo, useState, useCallback, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AREnemyNet, ARCrystalNet, ARState, AREnemyType, ARMinibossType, AREliteAffix } from '@/lib/3d/ar-types';
import { ENEMY_COLORS } from '@/lib/3d/ar-types';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';
import { AREnemyModel } from './AREnemyModel';

const MAX_ENEMIES = 200;
const MAX_CRYSTALS = 300;
const MAX_DETAIL_ENEMIES = 30;

// LOD 거리 임계값 (미터)
const LOD_NEAR = 20;    // 근거리: 멀티파트 모델
const LOD_FAR = 40;     // 원거리: 최소 디테일 (빌보드)
const LOD_CULL = 60;    // 이 거리 이상: 렌더링 스킵

const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();

// 적 타입별 색상
const ENEMY_COLOR_MAP: Record<string, THREE.Color> = {
  zombie: new THREE.Color(ENEMY_COLORS.zombie),
  skeleton: new THREE.Color(ENEMY_COLORS.skeleton),
  slime: new THREE.Color(ENEMY_COLORS.slime),
  spider: new THREE.Color(ENEMY_COLORS.spider),
  creeper: new THREE.Color(ENEMY_COLORS.creeper),
};

const CRYSTAL_COLOR = new THREE.Color(0.3, 0.8, 1.0);
const ELITE_GLOW_COLOR = new THREE.Color(1.0, 0.5, 0.0);

// ============================================================
// 근거리 적 슬롯 타입
// ============================================================

interface NearEnemySlot {
  visible: boolean;
  type: AREnemyType;
  x: number;
  y: number;
  z: number;
  scale: number;
  isElite: boolean;
  isMiniboss: boolean;
  minibossType: ARMinibossType | undefined;
  eliteAffix: AREliteAffix | undefined;
}

function createEmptySlot(): NearEnemySlot {
  return {
    visible: false,
    type: 'zombie',
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    isElite: false,
    isMiniboss: false,
    minibossType: undefined,
    eliteAffix: undefined,
  };
}

// ============================================================
// 거리 제곱 기반 정렬용 임시 배열
// ============================================================

interface EnemyWithDist {
  enemy: AREnemyNet;
  distSq: number;
  terrainLocalY: number;
}

// ============================================================
// AREntities Props
// ============================================================

interface AREntitiesProps {
  /** AR state ref (useFrame에서 직접 읽기 — prop 배열 대신 ref 사용으로 memo 유효) */
  arStateRef: React.MutableRefObject<ARState | null>;
  /** 플레이어 위치 (LOD 계산용) */
  playerPos?: { x: number; z: number };
  /** 아레나 시드 (지형 높이 쿼리용) */
  arenaSeed: number;
  /** 지형 높이 편차 (기본 3) */
  flattenVariance?: number;
}

// ============================================================
// Pre-mount pool 슬롯 컴포넌트
// ============================================================

interface EnemySlotProps {
  slotRef: React.MutableRefObject<NearEnemySlot>;
  groupRef: React.MutableRefObject<THREE.Group | null>;
}

/** 단일 근거리 적 슬롯 — 항상 마운트, visibility로 제어 */
function EnemySlotInner({ slotRef, groupRef }: EnemySlotProps) {
  const s = slotRef.current;
  return (
    <group ref={groupRef} visible={s.visible}>
      <AREnemyModel
        type={s.type}
        position={[s.x, s.y, s.z]}
        scale={s.scale}
        isElite={s.isElite}
        isMiniboss={s.isMiniboss}
        minibossType={s.minibossType}
        eliteAffix={s.eliteAffix}
      />
    </group>
  );
}

const EnemySlot = memo(EnemySlotInner);

// ============================================================
// AREntities 메인 컴포넌트
// ============================================================

function AREntitiesInner({ arStateRef, playerPos, arenaSeed, flattenVariance = 3 }: AREntitiesProps) {
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null);
  const crystalMeshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // 근거리 적 슬롯 refs (pre-mount pool)
  const slotsDataRef = useRef<NearEnemySlot[]>(
    Array.from({ length: MAX_DETAIL_ENEMIES }, () => createEmptySlot()),
  );
  const slotRefsArray = useRef<React.MutableRefObject<NearEnemySlot>[]>(
    slotsDataRef.current.map((slot) => ({ current: slot })),
  );
  const slotGroupRefs = useRef<React.MutableRefObject<THREE.Group | null>[]>(
    Array.from({ length: MAX_DETAIL_ENEMIES }, () => ({ current: null })),
  );

  // 1Hz 리렌더 트리거 (슬롯 JSX 업데이트용)
  const [tick, setTick] = useState(0);
  const lastTickRef = useRef(0);

  // 적/근거리 정렬용 재사용 배열
  const sortBufferRef = useRef<EnemyWithDist[]>([]);

  // 근거리 적 ID 세트 (InstancedMesh에서 제외할 적)
  const nearEnemyIdsRef = useRef<Set<string>>(new Set());

  // 적 머티리얼 (InstancedMesh에서 instanceColor 사용)
  const enemyMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: false,
      }),
    [],
  );

  // 크리스탈 머티리얼
  const crystalMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: CRYSTAL_COLOR,
        transparent: true,
        opacity: 0.8,
      }),
    [],
  );

  // PERF: 단일 useFrame으로 통합 (적 LOD 분류 + InstancedMesh + 크리스탈)
  useFrame(() => {
    const arState = arStateRef.current;
    if (!arState) return;

    const enemies = arState.enemies;
    const xpCrystals = arState.xpCrystals;
    const px = playerPos?.x ?? camera.position.x;
    const pz = playerPos?.z ?? camera.position.z;
    const now = performance.now();

    // ── 적 거리 계산 + 정렬 ──
    const maxCount = Math.min(enemies.length, MAX_ENEMIES);
    const sortBuf = sortBufferRef.current;

    // 버퍼 재사용 (길이 조절)
    if (sortBuf.length < maxCount) {
      for (let i = sortBuf.length; i < maxCount; i++) {
        sortBuf.push({ enemy: enemies[i], distSq: 0, terrainLocalY: 0 });
      }
    }

    let validCount = 0;
    for (let i = 0; i < maxCount; i++) {
      const e = enemies[i];
      const dx = e.x - px;
      const dz = e.z - pz;
      const distSq = dx * dx + dz * dz;

      if (distSq > LOD_CULL * LOD_CULL) continue;

      const terrainY = getArenaTerrainHeight(e.x, e.z, arenaSeed, flattenVariance);

      const entry = sortBuf[validCount];
      entry.enemy = e;
      entry.distSq = distSq;
      entry.terrainLocalY = terrainY - MC_BASE_Y;
      validCount++;
    }

    // 거리순 정렬 (가까운 순)
    // 부분 정렬: MAX_DETAIL_ENEMIES개만 정확하면 됨
    // 간단한 전체 정렬 (validCount 보통 50-100 미만이므로 O(n log n) 충분)
    const validSlice = sortBuf.slice(0, validCount);
    validSlice.sort((a, b) => a.distSq - b.distSq);

    // ── 근거리 적 슬롯 업데이트 (ref 직접 제어) ──
    const nearIds = nearEnemyIdsRef.current;
    nearIds.clear();

    const slotsData = slotsDataRef.current;
    const slotGroups = slotGroupRefs.current;
    const nearCount = Math.min(validCount, MAX_DETAIL_ENEMIES);

    for (let i = 0; i < MAX_DETAIL_ENEMIES; i++) {
      if (i < nearCount) {
        const entry = validSlice[i];
        const e = entry.enemy;
        const dist = Math.sqrt(entry.distSq);

        // 근거리 기준 내인지 확인
        if (dist <= LOD_NEAR || e.isElite || e.isMiniboss) {
          const slot = slotsData[i];
          const slotRef = slotRefsArray.current[i];

          slot.visible = true;
          slot.type = e.type;
          slot.x = e.x;
          slot.y = entry.terrainLocalY;
          slot.z = e.z;
          slot.scale = e.isMiniboss ? 1.0 : e.isElite ? 1.0 : 1.0; // 스케일은 AREnemyModel이 처리
          slot.isElite = e.isElite;
          slot.isMiniboss = e.isMiniboss ?? false;
          slot.minibossType = e.minibossType;
          slot.eliteAffix = e.eliteAffix;

          slotRef.current = slot;
          nearIds.add(e.id);

          // Group visibility + position 직접 제어
          const grp = slotGroups[i].current;
          if (grp) {
            grp.visible = true;
            grp.position.set(e.x, entry.terrainLocalY, e.z);
          }
        } else {
          // 근거리 밖: 슬롯 숨김
          slotsData[i].visible = false;
          const grp = slotGroups[i].current;
          if (grp) grp.visible = false;
        }
      } else {
        // 빈 슬롯: 숨김
        slotsData[i].visible = false;
        const grp = slotGroups[i].current;
        if (grp) grp.visible = false;
      }
    }

    // ── 1Hz 리렌더 트리거 (슬롯 타입/속성 변경 반영) ──
    if (now - lastTickRef.current > 1000) {
      lastTickRef.current = now;
      setTick((t) => t + 1);
    }

    // ── 원거리 적 InstancedMesh 업데이트 (근거리 적 제외) ──
    if (enemyMeshRef.current) {
      const mesh = enemyMeshRef.current;
      let visibleCount = 0;

      for (let i = 0; i < validCount; i++) {
        const entry = validSlice[i];
        const e = entry.enemy;

        // 근거리 적은 AREnemyModel이 렌더링 → InstancedMesh 스킵
        if (nearIds.has(e.id)) continue;

        const dist = Math.sqrt(entry.distSq);
        const isElite = e.isElite || e.isMiniboss;

        let lodScale: number;
        if (dist < LOD_NEAR || isElite) lodScale = 1.0;
        else if (dist < LOD_FAR) lodScale = 0.7;
        else lodScale = 0.4;

        const baseScale = e.type === 'slime' ? 0.8 : e.type === 'spider' ? 0.6 : 1.0;
        const finalScale = baseScale * (isElite ? 1.5 : 1.0) * lodScale;

        const localY = entry.terrainLocalY + finalScale * 0.5;

        dummy.position.set(e.x, localY, e.z);
        dummy.scale.set(finalScale, finalScale, finalScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(visibleCount, dummy.matrix);

        const color = ENEMY_COLOR_MAP[e.type] || ENEMY_COLOR_MAP.zombie;
        if (isElite) {
          tempColor.copy(ELITE_GLOW_COLOR);
        } else {
          tempColor.copy(color);
          if (dist > LOD_FAR) tempColor.multiplyScalar(0.6);
        }
        mesh.setColorAt(visibleCount, tempColor);
        visibleCount++;
      }

      mesh.count = visibleCount;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── XP 크리스탈 업데이트 (LOD 적용 + 지형 높이) ──
    if (crystalMeshRef.current) {
      const mesh = crystalMeshRef.current;
      let visibleCount = 0;
      const crystalMax = Math.min(xpCrystals.length, MAX_CRYSTALS);
      const t = now * 0.003;

      for (let i = 0; i < crystalMax; i++) {
        const c = xpCrystals[i];
        const dx = c.x - px;
        const dz = c.z - pz;
        if (dx * dx + dz * dz > 900) continue;

        // 지형 높이 + 부유 애니메이션
        const terrainY = getArenaTerrainHeight(c.x, c.z, arenaSeed, flattenVariance);
        const localY = terrainY - MC_BASE_Y + 0.3 + Math.sin(t + i * 0.5) * 0.15;
        const rotY = t + i * 0.7;

        dummy.position.set(c.x, localY, c.z);
        dummy.rotation.set(0, rotY, Math.PI / 4);
        dummy.scale.set(0.3, 0.3, 0.3);
        dummy.updateMatrix();
        mesh.setMatrixAt(visibleCount, dummy.matrix);
        visibleCount++;
      }

      mesh.count = visibleCount;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // tick을 사용하여 슬롯 데이터 스냅샷 생성 (리렌더 시점에 현재 슬롯 상태 반영)
  const slotSnapshots = useMemo(() => {
    void tick; // 의존성 트리거
    return slotsDataRef.current.map((slot, i) => ({
      ...slot,
      key: i,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return (
    <>
      {/* 근거리 적: Pre-mount pool (MAX_DETAIL_ENEMIES 슬롯) */}
      {slotSnapshots.map((snap, i) => (
        <group
          key={i}
          ref={(el) => { slotGroupRefs.current[i].current = el; }}
          visible={snap.visible}
          position={[snap.x, snap.y, snap.z]}
        >
          {snap.visible && (
            <AREnemyModel
              type={snap.type}
              position={[0, 0, 0]}
              scale={snap.scale}
              isElite={snap.isElite}
              isMiniboss={snap.isMiniboss}
              minibossType={snap.minibossType}
              eliteAffix={snap.eliteAffix}
            />
          )}
        </group>
      ))}

      {/* 원거리 적 InstancedMesh */}
      <instancedMesh
        ref={enemyMeshRef}
        args={[undefined, undefined, MAX_ENEMIES]}
        material={enemyMat}
        frustumCulled={false}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
      </instancedMesh>

      {/* XP 크리스탈 InstancedMesh */}
      <instancedMesh
        ref={crystalMeshRef}
        args={[undefined, undefined, MAX_CRYSTALS]}
        material={crystalMat}
        frustumCulled={false}
      >
        <octahedronGeometry args={[0.2, 0]} />
      </instancedMesh>
    </>
  );
}

export const AREntities = memo(AREntitiesInner);
