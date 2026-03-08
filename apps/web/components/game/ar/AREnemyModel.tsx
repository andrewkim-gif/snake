'use client';

/**
 * AREnemyModel — 근거리 적 멀티파트 복셀 모델 (하이브리드 LOD Phase 2)
 *
 * VoxelMob.tsx 패턴 기반, 5종 적 타입 + 미니보스/엘리트 시각 효과
 * - zombie: 4파트 녹색 계열
 * - skeleton: 4파트 뼈 색
 * - slime: 4파트 반투명 녹색
 * - spider: 5파트 갈색
 * - creeper: 4파트 밝은 녹색
 *
 * 미니보스: 스케일 + 색상 오버라이드 + emissive
 * 엘리트 어픽스: metalness / emissive / 추가 shield mesh
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AREnemyType, ARMinibossType, AREliteAffix } from '@/lib/3d/ar-types';
import { arenaTextureCache } from '@/lib/3d/ar-texture-loader';
import type { MobTextureType, MinibossTextureType } from '@/lib/3d/ar-texture-loader';

// ============================================================
// 타입 정의
// ============================================================

type V3 = [number, number, number];

interface MobPart {
  pos: V3;
  size: V3;
  color: string;
  transparent?: boolean;
  opacity?: number;
}

interface MobDef {
  body: MobPart;
  head?: MobPart;
  extras: MobPart[];
  legs: MobPart[];
}

// ============================================================
// 5종 적 모델 정의
// ============================================================

const ENEMY_MOBS: Record<AREnemyType, MobDef> = {
  zombie: {
    body: { pos: [0, 0.55, 0], size: [0.6, 0.8, 0.4], color: '#4CAF50' },
    head: { pos: [0, 1.05, 0], size: [0.5, 0.5, 0.5], color: '#4a8c3f' },
    extras: [],
    legs: [
      { pos: [-0.15, 0.1, 0], size: [0.2, 0.3, 0.25], color: '#388E3C' },
      { pos: [0.15, 0.1, 0], size: [0.2, 0.3, 0.25], color: '#388E3C' },
    ],
  },
  skeleton: {
    body: { pos: [0, 0.55, 0], size: [0.3, 0.9, 0.25], color: '#E0E0E0' },
    head: { pos: [0, 1.15, 0], size: [0.35, 0.35, 0.35], color: '#d4c8b0' },
    extras: [
      // 양 팔
      { pos: [-0.3, 0.7, 0], size: [0.12, 0.7, 0.12], color: '#BDBDBD' },
      { pos: [0.3, 0.7, 0], size: [0.12, 0.7, 0.12], color: '#BDBDBD' },
    ],
    legs: [],
  },
  slime: {
    // outer body (반투명)
    body: { pos: [0, 0.45, 0], size: [0.9, 0.9, 0.9], color: '#8BC34A', transparent: true, opacity: 0.5 },
    head: undefined,
    extras: [
      // 코어
      { pos: [0, 0.4, 0], size: [0.4, 0.4, 0.4], color: '#558B2F' },
      // 눈 2개
      { pos: [-0.15, 0.55, 0.35], size: [0.1, 0.1, 0.1], color: '#1a1a1a' },
      { pos: [0.15, 0.55, 0.35], size: [0.1, 0.1, 0.1], color: '#1a1a1a' },
    ],
    legs: [],
  },
  spider: {
    body: { pos: [0, 0.3, 0], size: [0.7, 0.3, 0.5], color: '#795548' },
    head: undefined,
    extras: [],
    legs: [
      // 좌측 2쌍
      { pos: [-0.45, 0.15, 0.2], size: [0.35, 0.08, 0.08], color: '#5D4037' },
      { pos: [-0.45, 0.15, -0.2], size: [0.35, 0.08, 0.08], color: '#5D4037' },
      // 우측 2쌍
      { pos: [0.45, 0.15, 0.2], size: [0.35, 0.08, 0.08], color: '#5D4037' },
      { pos: [0.45, 0.15, -0.2], size: [0.35, 0.08, 0.08], color: '#5D4037' },
    ],
  },
  creeper: {
    body: { pos: [0, 0.6, 0], size: [0.5, 1.0, 0.35], color: '#76FF03' },
    head: { pos: [0, 1.2, 0], size: [0.5, 0.5, 0.5], color: '#66BB6A' },
    extras: [],
    legs: [
      { pos: [-0.12, 0.05, 0], size: [0.18, 0.2, 0.25], color: '#558B2F' },
      { pos: [0.12, 0.05, 0], size: [0.18, 0.2, 0.25], color: '#558B2F' },
    ],
  },
};

// ============================================================
// 미니보스 오버라이드
// ============================================================

interface MinibossOverride {
  scale: number;
  colorOverride?: string;
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

const MINIBOSS_OVERRIDES: Record<ARMinibossType, MinibossOverride> = {
  golem: { scale: 2.0, colorOverride: '#795548' },
  wraith: { scale: 1.0, transparent: true, opacity: 0.6, emissive: '#9C27B0', emissiveIntensity: 0.6 },
  dragon_whelp: { scale: 1.5, colorOverride: '#FF5722' },
  lich_king: { scale: 1.5, emissive: '#3F51B5', emissiveIntensity: 0.5 },
  the_arena: { scale: 3.0, emissive: '#FFD700', emissiveIntensity: 0.8 },
};

// ============================================================
// Props
// ============================================================

export interface AREnemyModelProps {
  type: AREnemyType;
  position: [number, number, number];
  scale?: number;
  isElite?: boolean;
  isMiniboss?: boolean;
  minibossType?: ARMinibossType;
  eliteAffix?: AREliteAffix;
}

// ============================================================
// 머티리얼 속성 계산 헬퍼
// ============================================================

interface MatProps {
  color: string;
  transparent: boolean;
  opacity: number;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
}

function computeMatProps(
  baseColor: string,
  baseTrans: boolean,
  baseOpacity: number,
  isMiniboss: boolean,
  minibossType: ARMinibossType | undefined,
  isElite: boolean,
  eliteAffix: AREliteAffix | undefined,
  colorOverride: string | undefined,
): MatProps {
  let color = colorOverride ?? baseColor;
  let transparent = baseTrans;
  let opacity = baseOpacity;
  let metalness = 0;
  let roughness = 0.8;
  let emissive = '#000000';
  let emissiveIntensity = 0;

  // 미니보스 오버라이드
  if (isMiniboss && minibossType) {
    const ovr = MINIBOSS_OVERRIDES[minibossType];
    if (ovr.colorOverride) color = ovr.colorOverride;
    if (ovr.transparent) { transparent = true; opacity = ovr.opacity ?? 0.6; }
    if (ovr.emissive) { emissive = ovr.emissive; emissiveIntensity = ovr.emissiveIntensity ?? 0.5; }
  }

  // 엘리트 어픽스 시각
  if (isElite && eliteAffix) {
    switch (eliteAffix) {
      case 'armored':
        metalness = 0.8;
        roughness = 0.2;
        break;
      case 'vampiric':
        emissive = '#880E4F';
        emissiveIntensity = 0.4;
        break;
      case 'explosive':
        emissive = '#FF5722';
        emissiveIntensity = 0.4;
        break;
      // swift: 스킵 (코드 복잡도)
      // shielded: 별도 shield mesh로 처리
    }
  }

  return { color, transparent, opacity, metalness, roughness, emissive, emissiveIntensity };
}

// ============================================================
// 단일 파트 렌더러
// ============================================================

function EnemyPart({ pos, size, color, transparent, opacity, metalness, roughness, emissive, emissiveIntensity, map }: MobPart & Partial<MatProps> & { map?: THREE.Texture | null }) {
  const needsStandard = (metalness ?? 0) > 0; // armored 어픽스: MeshStandardMaterial 필요
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      {needsStandard ? (
        <meshStandardMaterial
          map={map ?? undefined}
          alphaTest={map ? 0.5 : undefined}
          color={color}
          transparent={transparent ?? false}
          opacity={opacity ?? 1}
          metalness={metalness ?? 0}
          roughness={roughness ?? 0.8}
          emissive={emissive ?? '#000000'}
          emissiveIntensity={emissiveIntensity ?? 0}
        />
      ) : map ? (
        <meshLambertMaterial
          map={map}
          alphaTest={0.5}
          color={color}
          transparent={transparent ?? false}
          opacity={opacity ?? 1}
          emissive={emissive ?? '#000000'}
          emissiveIntensity={emissiveIntensity ?? 0}
        />
      ) : (
        <meshLambertMaterial
          color={color}
          transparent={transparent ?? false}
          opacity={opacity ?? 1}
          emissive={emissive ?? '#000000'}
          emissiveIntensity={emissiveIntensity ?? 0}
        />
      )}
    </mesh>
  );
}

// ============================================================
// AREnemyModel 본체
// ============================================================

export function AREnemyModel({
  type,
  position,
  scale: scaleProp = 1.0,
  isElite = false,
  isMiniboss = false,
  minibossType,
  eliteAffix,
}: AREnemyModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);

  const def = ENEMY_MOBS[type];

  // 몬스터 텍스처 (프로시저럴 픽셀아트)
  const faceTex = useMemo(() => {
    if (isMiniboss && minibossType) {
      return arenaTextureCache.getMiniboss(minibossType as MinibossTextureType);
    }
    return arenaTextureCache.getMobFace(type as MobTextureType);
  }, [type, isMiniboss, minibossType]);

  const bodyTex = useMemo(() => {
    if (isMiniboss && minibossType) {
      return arenaTextureCache.getMiniboss(minibossType as MinibossTextureType);
    }
    return arenaTextureCache.getMobBody(type as MobTextureType);
  }, [type, isMiniboss, minibossType]);

  // 미니보스 스케일 오버라이드
  const finalScale = useMemo(() => {
    if (isMiniboss && minibossType) {
      return scaleProp * MINIBOSS_OVERRIDES[minibossType].scale;
    }
    if (isElite) return scaleProp * 1.5;
    return scaleProp;
  }, [scaleProp, isMiniboss, minibossType, isElite]);

  // 미니보스 색상 오버라이드
  const colorOverride = useMemo(() => {
    if (isMiniboss && minibossType) return MINIBOSS_OVERRIDES[minibossType].colorOverride;
    return undefined;
  }, [isMiniboss, minibossType]);

  // head idle 애니메이션
  useFrame((state) => {
    if (!headRef.current) return;
    const t = state.clock.elapsedTime;
    headRef.current.rotation.x = Math.sin(t * 1.5) * 0.06;
    headRef.current.rotation.y = Math.sin(t * 0.7) * 0.2;
  });

  // shielded 어픽스: 펄스 애니메이션
  useFrame((state) => {
    if (!shieldRef.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 1.0 + Math.sin(t * 2) * 0.05;
    shieldRef.current.scale.set(pulse, pulse, pulse);
  });

  // 공통 머티리얼 속성
  const matBase = useMemo(
    () =>
      computeMatProps(
        def.body.color,
        def.body.transparent ?? false,
        def.body.opacity ?? 1,
        isMiniboss,
        minibossType,
        isElite,
        eliteAffix,
        colorOverride,
      ),
    [def.body.color, def.body.transparent, def.body.opacity, isMiniboss, minibossType, isElite, eliteAffix, colorOverride],
  );

  const showShield = isElite && eliteAffix === 'shielded';

  return (
    <group ref={groupRef} position={position} scale={[finalScale, finalScale, finalScale]}>
      {/* Body — 텍스처 적용 */}
      <EnemyPart {...def.body} {...matBase} map={bodyTex} />

      {/* Head (with idle animation) — 얼굴 텍스처 적용 */}
      {def.head && (
        <mesh ref={headRef} position={def.head.pos}>
          <boxGeometry args={def.head.size} />
          <meshLambertMaterial
            map={faceTex}
            alphaTest={0.5}
            color={colorOverride ?? def.head.color}
            transparent={matBase.transparent}
            opacity={matBase.opacity}
            emissive={matBase.emissive}
            emissiveIntensity={matBase.emissiveIntensity}
          />
        </mesh>
      )}

      {/* Extras (arms, core, eyes 등) — 몸통 텍스처 */}
      {def.extras.map((e, i) => (
        <EnemyPart
          key={`e${i}`}
          {...e}
          emissive={matBase.emissive}
          emissiveIntensity={matBase.emissiveIntensity}
          map={bodyTex}
        />
      ))}

      {/* Legs — 몸통 텍스처 */}
      {def.legs.map((l, i) => (
        <EnemyPart
          key={`l${i}`}
          {...l}
          emissive={matBase.emissive}
          emissiveIntensity={matBase.emissiveIntensity}
          map={bodyTex}
        />
      ))}

      {/* Shielded 어픽스: 추가 반투명 파란 구체 */}
      {showShield && (
        <mesh ref={shieldRef} position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.8, 12, 8]} />
          <meshBasicMaterial
            color="#2196F3"
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
