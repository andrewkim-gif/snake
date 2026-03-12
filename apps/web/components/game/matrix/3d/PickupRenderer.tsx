'use client';

/**
 * PickupRenderer.tsx — 3D Pickup 아이템 렌더링 (v44 Phase 3 개선)
 *
 * v44 Phase 3 변경사항:
 * 1. 아이템 고유 지오메트리 — 타입별 머지드 복셀 형태
 *    - chicken: 미니 복셀 닭다리 (3개 박스 조합)
 *    - chest: 보물상자 (2개 박스)
 *    - bomb: 구체 (SphereGeometry)
 *    - magnet: U자형 (3개 박스)
 *    - upgrade_material: 기본 큐브
 * 2. 아이템 크기 축소 — 1.5 → 0.6 기본, 타입별 차등
 * 3. XP 오브 크기 축소 — radius 0.8→0.35, 스케일 0.4~0.8
 * 4. XP 수집 팝 이펙트 — 스케일 1.5배 팽창 → 0 축소 (0.15초)
 * 5. XP 흡수 곡선 궤적 — 사인파 곡선 + 가속
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, terrainHeight, y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Gem, Pickup, Player } from '@/lib/matrix/types';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';
import { getItemTexture } from '@/lib/3d/item-textures';

// ============================================
// Constants
// ============================================

/** XP Orb InstancedMesh 용량 */
const XP_ORB_CAPACITY = 200;

/** Pickup Item InstancedMesh 용량 (타입별) */
const PICKUP_CAPACITY_PER_TYPE = 20;

/** LOD 전환 거리 (이 이상은 point sprite) */
const LOD_DISTANCE = 1200;

/** v44: XP Orb 축소된 반경 (0.8→0.35) */
const ORB_RADIUS = 0.35;

/** v44: 아이템 기본 크기 (1.5→0.6) */
const PICKUP_BASE_SIZE = 0.6;

/** 부유 애니메이션 진폭 */
const FLOAT_AMPLITUDE = 0.5;

/** 부유 애니메이션 주기 */
const FLOAT_FREQUENCY = 2;

/** Vacuum 효과 최소 거리 */
const VACUUM_RANGE = 150;

/** v44: 수집 팝 이펙트 지속 시간 (초) */
const POP_DURATION = 0.15;

/** v44: 수집 팝 최대 스케일 배율 */
const POP_SCALE_MAX = 1.5;

// ============================================
// v44: 타입별 크기 매핑 (축소)
// ============================================

/** 타입별 크기 (BoxGeometry 기준) */
const PICKUP_TYPE_SIZES: Record<string, number> = {
  chicken: 0.6,
  chest: 0.8,
  bomb: 0.5,
  magnet: 0.6,
  upgrade_material: 0.7,
};

// ============================================
// Pickup 색상 매핑
// ============================================

/** XP orb 색상 (가치별, 사전 할당 — GC 방지) */
const GEM_COLORS = {
  legendary: new THREE.Color('#ff6600'),
  epic: new THREE.Color('#aa44ff'),
  rare: new THREE.Color('#4488ff'),
  magic: new THREE.Color('#44ddff'),
  common: new THREE.Color('#44ff88'),
} as const;

function getGemColor(value: number): THREE.Color {
  if (value >= 50) return GEM_COLORS.legendary;
  if (value >= 20) return GEM_COLORS.epic;
  if (value >= 10) return GEM_COLORS.rare;
  if (value >= 5) return GEM_COLORS.magic;
  return GEM_COLORS.common;
}

/** Pickup 타입별 색상 */
const PICKUP_COLORS: Record<string, THREE.Color> = {
  chicken: new THREE.Color('#ff4444'),       // 빨강 (체력)
  chest: new THREE.Color('#ffd700'),         // 골드 (상자)
  bomb: new THREE.Color('#ff6600'),          // 오렌지 (폭탄)
  magnet: new THREE.Color('#8844ff'),        // 보라 (자석)
  upgrade_material: new THREE.Color('#00ffaa'), // 청록 (재료)
};

/** 임시 행렬 (useFrame 내 재사용 — GC 방지) */
const _tempRotMatrix = new THREE.Matrix4();
const _tempScaleMatrix = new THREE.Matrix4();
const _tempFallbackColor = new THREE.Color('#ffffff');

// ============================================
// v44: 타입별 고유 지오메트리 생성
// ============================================

/** 치킨 닭다리: 3개 박스 조합 (뼈대 + 살 + 살) */
function createChickenGeometry(): THREE.BufferGeometry {
  const s = PICKUP_TYPE_SIZES.chicken;
  // 뼈대 (가늘고 긴 막대)
  const bone = new THREE.BoxGeometry(s * 0.15, s * 0.8, s * 0.15);
  bone.translate(0, s * 0.2, 0);
  // 살 덩어리 (위쪽 타원형 볼록)
  const meat1 = new THREE.BoxGeometry(s * 0.5, s * 0.5, s * 0.45);
  meat1.translate(0, s * -0.15, 0);
  // 살 덩어리 2 (약간 작게, 아래)
  const meat2 = new THREE.BoxGeometry(s * 0.35, s * 0.35, s * 0.35);
  meat2.translate(0, s * -0.4, 0);

  const merged = mergeGeometries([bone, meat1, meat2]);
  return merged || new THREE.BoxGeometry(s, s, s);
}

/** 보물 상자: 2개 박스 (본체 + 뚜껑) */
function createChestGeometry(): THREE.BufferGeometry {
  const s = PICKUP_TYPE_SIZES.chest;
  // 본체 (넓고 낮은 박스)
  const body = new THREE.BoxGeometry(s * 0.9, s * 0.5, s * 0.6);
  body.translate(0, -s * 0.1, 0);
  // 뚜껑 (약간 작고, 위쪽에 위치)
  const lid = new THREE.BoxGeometry(s * 0.95, s * 0.25, s * 0.65);
  lid.translate(0, s * 0.25, 0);

  const merged = mergeGeometries([body, lid]);
  return merged || new THREE.BoxGeometry(s, s, s);
}

/** 폭탄: 구체 */
function createBombGeometry(): THREE.BufferGeometry {
  const s = PICKUP_TYPE_SIZES.bomb;
  return new THREE.SphereGeometry(s * 0.5, 8, 6);
}

/** 자석: U자형 (3개 박스) */
function createMagnetGeometry(): THREE.BufferGeometry {
  const s = PICKUP_TYPE_SIZES.magnet;
  // 바닥 (수평 바)
  const base = new THREE.BoxGeometry(s * 0.7, s * 0.2, s * 0.25);
  base.translate(0, -s * 0.2, 0);
  // 왼쪽 기둥
  const leftPole = new THREE.BoxGeometry(s * 0.2, s * 0.5, s * 0.25);
  leftPole.translate(-s * 0.25, s * 0.05, 0);
  // 오른쪽 기둥
  const rightPole = new THREE.BoxGeometry(s * 0.2, s * 0.5, s * 0.25);
  rightPole.translate(s * 0.25, s * 0.05, 0);

  const merged = mergeGeometries([base, leftPole, rightPole]);
  return merged || new THREE.BoxGeometry(s, s, s);
}

/** 기본 큐브 (upgrade_material 등) */
function createDefaultPickupGeometry(): THREE.BufferGeometry {
  const s = PICKUP_TYPE_SIZES.upgrade_material;
  return new THREE.BoxGeometry(s, s, s);
}

// ============================================
// v44: XP 수집 팝 이펙트 상태 추적
// ============================================

interface PopEffect {
  /** 팝 이펙트 시작 시간 */
  startTime: number;
  /** 팝 위치 (3D) */
  x: number;
  y: number;
  z: number;
  /** 원래 스케일 */
  baseScale: number;
  /** XP 색상 */
  color: THREE.Color;
}

// ============================================
// XP Orb Renderer (InstancedMesh) — v44 개선
// ============================================

interface XpOrbRendererProps {
  gemsRef: React.MutableRefObject<Gem[]>;
  playerRef: React.MutableRefObject<Player>;
}

function XpOrbRenderer({ gemsRef, playerRef }: XpOrbRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointsRef = useRef<THREE.Points>(null);

  // v44: 수집 팝 이펙트 상태 배열
  const popEffectsRef = useRef<PopEffect[]>([]);

  // 공유 geometry/material (v44: 축소된 ORB_RADIUS 0.35, v45: CanvasTexture 추가)
  const geometry = useMemo(() => new THREE.SphereGeometry(ORB_RADIUS, 8, 6), []);
  const material = useMemo(
    () => {
      const xpTex = getItemTexture('xp_orb');
      return new THREE.MeshStandardMaterial({
        map: xpTex,
        emissive: new THREE.Color('#44ff88'),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
        metalness: 0.3,
      });
    },
    []
  );

  // LOD: point sprite용
  const pointGeometry = useMemo(() => new THREE.BufferGeometry(), []);

  // 임시 객체 (재사용)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

  // v44: 이전 프레임 gem ID 추적 (수집 감지용)
  const prevGemIdsRef = useRef<Set<string>>(new Set());

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const gems = gemsRef.current;
    const player = playerRef.current;
    const playerX = player.position.x;
    const playerZ = player.position.y;
    const time = clock.getElapsedTime();

    // v44: 수집된 gem 감지 → 팝 이펙트 생성
    // gems 배열에서 제거되면 수집된 것 (filter로 제거됨)
    const currentGemIds = new Set<string>();
    for (let i = 0; i < gems.length; i++) {
      if (!gems[i].isCollected) currentGemIds.add(gems[i].id);
    }
    // 이전에 있었으나 현재 없는 gem 수 = 수집 수
    let collectedCount = 0;
    if (prevGemIdsRef.current.size > 0) {
      prevGemIdsRef.current.forEach(id => {
        if (!currentGemIds.has(id)) collectedCount++;
      });
    }
    // 최대 5개 팝 이펙트 (동시 다수 수집 시 성능 보호)
    if (collectedCount > 0) {
      const popCount = Math.min(collectedCount, 5);
      const terrainY = getMCTerrainHeight(playerX, playerZ);
      for (let p = 0; p < popCount; p++) {
        // 약간의 오프셋으로 겹침 방지
        const offsetAngle = (p / popCount) * Math.PI * 2;
        const offsetR = 0.3;
        popEffectsRef.current.push({
          startTime: time + p * 0.02, // 시간차 연출
          x: playerX + Math.cos(offsetAngle) * offsetR,
          y: terrainY + 1.5 + ORB_RADIUS,
          z: playerZ + Math.sin(offsetAngle) * offsetR,
          baseScale: 0.5 + (collectedCount > 3 ? 0.2 : 0),
          color: getGemColor(collectedCount > 3 ? 10 : 5),
        });
      }
    }
    prevGemIdsRef.current = currentGemIds;

    let nearCount = 0;
    const farPositions: number[] = [];
    const farColors: number[] = [];

    for (let i = 0; i < gems.length && nearCount < XP_ORB_CAPACITY; i++) {
      const gem = gems[i];
      if (gem.isCollected) continue;

      // 2D → 3D 좌표
      const gx = gem.position.x;
      const gz = gem.position.y;

      // 거리 계산
      const dx = gx - playerX;
      const dz = gz - playerZ;
      const distSq = dx * dx + dz * dz;

      // LOD: 먼 거리는 point sprite
      if (distSq > LOD_DISTANCE * LOD_DISTANCE) {
        const farTerrainY = getMCTerrainHeight(gx, gz) + 1.5;
        farPositions.push(gx, farTerrainY, gz);
        const color = getGemColor(gem.value);
        farColors.push(color.r, color.g, color.b);
        continue;
      }

      // v44: 곡선 vacuum 궤적 (사인파 + 가속)
      let finalX = gx;
      let finalZ = gz;
      if (distSq < VACUUM_RANGE * VACUUM_RANGE && distSq > 1) {
        const dist = Math.sqrt(distSq);
        // 가속 곡선: 가까울수록 더 빠르게 빨려감
        const vacuumStrength = 1 - dist / VACUUM_RANGE;
        const acceleratedStrength = vacuumStrength * vacuumStrength; // 제곱 가속

        // v44: 사인파 곡선 궤적 (직선 lerp 대신)
        const sineOffset = Math.sin(time * 8 + i * 2.5) * dist * 0.08 * vacuumStrength;
        // 플레이어 방향 단위 벡터
        const dirX = (playerX - gx) / dist;
        const dirZ = (playerZ - gz) / dist;
        // 수직 방향 (곡선 오프셋용)
        const perpX = -dirZ;
        const perpZ = dirX;

        finalX = THREE.MathUtils.lerp(gx, playerX, acceleratedStrength * 0.2) + perpX * sineOffset;
        finalZ = THREE.MathUtils.lerp(gz, playerZ, acceleratedStrength * 0.2) + perpZ * sineOffset;
      }

      // 부유 애니메이션 (sine wave) — 지형 높이 기반
      const floatY = Math.sin(time * FLOAT_FREQUENCY + i * 0.7) * FLOAT_AMPLITUDE;
      const terrainY = getMCTerrainHeight(finalX, finalZ);
      const baseY = terrainY + 1 + ORB_RADIUS;

      // v44: 크기 축소 (0.4~0.8 범위)
      const scale = 0.4 + Math.min(gem.value / 20, 1) * 0.4;

      tempMatrix.makeScale(scale, scale, scale);
      tempMatrix.setPosition(finalX, baseY + floatY, finalZ);

      mesh.setMatrixAt(nearCount, tempMatrix);

      // 가치별 색상
      const gemColor = getGemColor(gem.value);
      mesh.setColorAt(nearCount, gemColor);

      nearCount++;
    }

    // v44: 팝 이펙트 렌더링 (InstancedMesh 슬롯 사용)
    const pops = popEffectsRef.current;
    for (let p = pops.length - 1; p >= 0; p--) {
      const pop = pops[p];
      const elapsed = time - pop.startTime;
      if (elapsed > POP_DURATION) {
        pops.splice(p, 1);
        continue;
      }
      if (nearCount >= XP_ORB_CAPACITY) continue;

      // 팽창 → 소멸: 0~0.3 팽창, 0.3~1.0 축소
      const t = elapsed / POP_DURATION;
      let popScale: number;
      if (t < 0.3) {
        // 빠른 팽창
        popScale = pop.baseScale * THREE.MathUtils.lerp(1, POP_SCALE_MAX, t / 0.3);
      } else {
        // 축소 → 0
        popScale = pop.baseScale * POP_SCALE_MAX * THREE.MathUtils.lerp(1, 0, (t - 0.3) / 0.7);
      }

      tempMatrix.makeScale(popScale, popScale, popScale);
      tempMatrix.setPosition(pop.x, pop.y, pop.z);
      mesh.setMatrixAt(nearCount, tempMatrix);
      mesh.setColorAt(nearCount, pop.color);
      nearCount++;
    }

    mesh.count = nearCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // far point sprite 업데이트
    const points = pointsRef.current;
    if (points && farPositions.length > 0) {
      pointGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(farPositions, 3)
      );
      pointGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(farColors, 3)
      );
      points.visible = true;
    } else if (points) {
      points.visible = false;
    }

    // v44: 글로우 펄스 강화 (emissive intensity 범위 확대)
    const pulse = 0.7 + Math.sin(time * 4) * 0.4;
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, XP_ORB_CAPACITY]}
        frustumCulled={false}
      />
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry ref={() => pointGeometry} />
        <pointsMaterial
          size={3}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation
        />
      </points>
    </>
  );
}

// ============================================
// v44: 타입별 Pickup Item Renderer
// ============================================

interface PickupItemRendererProps {
  pickupsRef: React.MutableRefObject<Pickup[]>;
  playerRef: React.MutableRefObject<Player>;
}

/** v44: 타입별 InstancedMesh 렌더러 */
const PICKUP_TYPES = ['chicken', 'chest', 'bomb', 'magnet', 'upgrade_material'] as const;

/** 타입별 지오메트리 생성 함수 매핑 */
const GEOMETRY_CREATORS: Record<string, () => THREE.BufferGeometry> = {
  chicken: createChickenGeometry,
  chest: createChestGeometry,
  bomb: createBombGeometry,
  magnet: createMagnetGeometry,
  upgrade_material: createDefaultPickupGeometry,
};

function PickupItemRenderer({ pickupsRef, playerRef }: PickupItemRendererProps) {
  // v44: 타입별 InstancedMesh refs
  const meshRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});

  // v44: 타입별 고유 지오메트리 + 공유 머티리얼
  const geometries = useMemo(() => {
    const geos: Record<string, THREE.BufferGeometry> = {};
    for (const type of PICKUP_TYPES) {
      const creator = GEOMETRY_CREATORS[type];
      geos[type] = creator ? creator() : createDefaultPickupGeometry();
    }
    return geos;
  }, []);

  // 타입별 재질 (v45: CanvasTexture map + emissive 블렌딩)
  const materials = useMemo(() => {
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    for (const type of PICKUP_TYPES) {
      const color = PICKUP_COLORS[type] || _tempFallbackColor;
      const tex = getItemTexture(type);
      mats[type] = new THREE.MeshStandardMaterial({
        map: tex,
        color: tex ? new THREE.Color('#ffffff') : color.clone().multiplyScalar(0.6),
        emissive: color,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: 0.9,
      });
    }
    return mats;
  }, []);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    const pickups = pickupsRef.current;
    const player = playerRef.current;
    const playerX = player.position.x;
    const playerZ = player.position.y;
    const time = clock.getElapsedTime();

    // 타입별 카운터 초기화
    const counts: Record<string, number> = {};
    for (const type of PICKUP_TYPES) counts[type] = 0;

    for (let i = 0; i < pickups.length; i++) {
      const pickup = pickups[i];
      const type = pickup.type;

      // 지원하지 않는 타입은 upgrade_material로 폴백
      const meshType = PICKUP_TYPES.includes(type as typeof PICKUP_TYPES[number]) ? type : 'upgrade_material';
      const mesh = meshRefs.current[meshType];
      if (!mesh) continue;

      const count = counts[meshType] ?? 0;
      if (count >= PICKUP_CAPACITY_PER_TYPE) continue;

      // 2D → 3D
      const px = pickup.position.x;
      const pz = pickup.position.y;

      // 거리 체크
      const dx = px - playerX;
      const dz = pz - playerZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > LOD_DISTANCE * LOD_DISTANCE) continue;

      // 부유 + 회전 애니메이션 — 지형 높이 기반
      const floatY = Math.sin(time * FLOAT_FREQUENCY * 0.8 + i * 1.3) * FLOAT_AMPLITUDE * 0.8;
      const rotY = time * 1.5 + i * 0.5;
      const terrainY = getMCTerrainHeight(px, pz);
      const typeSize = PICKUP_TYPE_SIZES[meshType] || PICKUP_BASE_SIZE;
      const baseY = terrainY + 1 + typeSize * 0.5;

      // 수명에 따른 페이드 (깜빡임)
      const lifeRatio = pickup.life / 10;
      const blink = lifeRatio < 0.3 ? (Math.sin(time * 10) > 0 ? 1 : 0.3) : 1;

      // matrix 구성 (사전 할당 행렬 재사용 — GC 방지)
      _tempRotMatrix.makeRotationY(rotY);
      _tempScaleMatrix.makeScale(blink, blink, blink);
      tempMatrix.multiplyMatrices(_tempRotMatrix, _tempScaleMatrix);
      tempMatrix.setPosition(px, baseY + floatY, pz);

      mesh.setMatrixAt(count, tempMatrix);
      counts[meshType] = count + 1;
    }

    // 타입별 count 업데이트
    for (const type of PICKUP_TYPES) {
      const mesh = meshRefs.current[type];
      if (!mesh) continue;
      mesh.count = counts[type] ?? 0;
      mesh.instanceMatrix.needsUpdate = true;

      // emissive 펄스
      const pulse = 0.3 + Math.sin(time * 2 + PICKUP_TYPES.indexOf(type) * 0.5) * 0.2;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  return (
    <group>
      {PICKUP_TYPES.map(type => (
        <instancedMesh
          key={type}
          ref={(ref) => { meshRefs.current[type] = ref; }}
          args={[geometries[type], materials[type], PICKUP_CAPACITY_PER_TYPE]}
          castShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

// ============================================
// PickupRenderer (Orchestrator)
// ============================================

export interface PickupRendererProps {
  /** XP 젬 ref */
  gemsRef: React.MutableRefObject<Gem[]>;
  /** 픽업 아이템 ref */
  pickupsRef: React.MutableRefObject<Pickup[]>;
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
}

/**
 * PickupRenderer — XP Orb + Item Drop 3D 렌더링 (v44 Phase 3)
 *
 * 구성:
 * - XpOrbRenderer: Gem[] → SphereGeometry InstancedMesh (200개)
 *   - v44: 크기 축소, 팝 이펙트, 곡선 vacuum 궤적
 * - PickupItemRenderer: Pickup[] → 타입별 고유 InstancedMesh
 *   - v44: 치킨/상자/폭탄/자석 고유 형태, 크기 축소
 */
export function PickupRenderer({
  gemsRef,
  pickupsRef,
  playerRef,
}: PickupRendererProps) {
  return (
    <group>
      {/* XP Orb — v44: 축소 + 팝 이펙트 + 곡선 궤적 */}
      <XpOrbRenderer gemsRef={gemsRef} playerRef={playerRef} />

      {/* Item Drops — v44: 타입별 고유 형태 */}
      <PickupItemRenderer pickupsRef={pickupsRef} playerRef={playerRef} />
    </group>
  );
}

export default PickupRenderer;
