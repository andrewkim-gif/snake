/**
 * 3d/weapons/BlockSkillWeapons.tsx — 블록 좌표 스킬 무기 3D 통합 렌더러
 * v42 Phase 2: SkillWeapons.tsx 복사 → 블록 좌표 네이티브 변환
 *
 * 핵심 변경 (기존 SkillWeapons.tsx 대비):
 *   - WORLD_SCALE = 1 (기존 1/50)
 *   - Z축 반전 제거: py 직접 사용 (기존 -py)
 *   - Y 높이: getMCTerrainHeight(px, pz) + 1.5 (지형 위 플레이어 가슴 높이)
 *   - radius 스케일링 제거 (이미 블록 단위)
 *
 * 카테고리별 base shape + color 변형:
 *   CODE(green) / DATA(cyan) / NETWORK(purple) /
 *   SECURITY(red) / AI(amber) / SYSTEM(pink)
 */

'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Projectile } from '@/lib/matrix/types';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';

// ===== 공통 상수 =====
const CAPACITY = 200;
const PROJECTILE_Y_OFFSET = 1.5; // 지형 위 플레이어 가슴 높이

// 임시 연산용 (GC 방지)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

// ===== 카테고리 색상 팔레트 =====
const SKILL_COLORS = {
  CODE: { main: '#00FF41', emissive: '#00FF41', dark: '#003300', r: 0, g: 1, b: 0.25 },
  DATA: { main: '#06b6d4', emissive: '#06b6d4', dark: '#001a20', r: 0.02, g: 0.71, b: 0.83 },
  NETWORK: { main: '#8b5cf6', emissive: '#8b5cf6', dark: '#1a0033', r: 0.55, g: 0.36, b: 0.96 },
  SECURITY: { main: '#ef4444', emissive: '#ef4444', dark: '#1a0000', r: 0.94, g: 0.27, b: 0.27 },
  AI: { main: '#f59e0b', emissive: '#f59e0b', dark: '#1a1000', r: 0.96, g: 0.62, b: 0.04 },
  SYSTEM: { main: '#ec4899', emissive: '#ec4899', dark: '#1a0010', r: 0.93, g: 0.28, b: 0.6 },
} as const;

type SkillCategory = keyof typeof SKILL_COLORS;

// ===== 스킬 타입 → 카테고리 매핑 =====
const SKILL_CATEGORY_MAP: Record<string, SkillCategory> = {
  // CODE (4)
  syntax_error: 'CODE',
  compiler: 'CODE',
  debugger_skill: 'CODE',
  hotfix: 'CODE',
  runtime: 'CODE',
  garbage_collector: 'CODE',
  // DATA (4)
  json_bomb: 'DATA',
  csv_spray: 'DATA',
  binary: 'DATA',
  big_data: 'DATA',
  regex: 'DATA',
  query: 'DATA',
  // NETWORK (5)
  websocket: 'NETWORK',
  tcp_flood: 'NETWORK',
  dns_spoof: 'NETWORK',
  packet_loss: 'NETWORK',
  vpn_tunnel: 'NETWORK',
  ddos: 'NETWORK',
  proxy: 'NETWORK',
  // SECURITY (5)
  antivirus: 'SECURITY',
  sandbox: 'SECURITY',
  zero_trust: 'SECURITY',
  honeypot: 'SECURITY',
  incident_response: 'SECURITY',
  firewall: 'SECURITY',
  encryption: 'SECURITY',
  // AI (4)
  neural_net: 'AI',
  chatgpt: 'AI',
  deepfake: 'AI',
  singularity_core: 'AI',
  machine_learning: 'AI',
  gpt: 'AI',
  // SYSTEM (기타)
  kernel: 'SYSTEM',
  process: 'SYSTEM',
  thread: 'SYSTEM',
  memory: 'SYSTEM',
};

// 알려진 기본 무기 타입 목록 (스킬이 아닌 것들 필터링용)
const NON_SKILL_TYPES = new Set([
  'whip', 'punch', 'axe', 'sword',
  'knife', 'bow', 'ping', 'shard', 'airdrop', 'fork',
  'wand', 'bible', 'garlic', 'pool',
  'bridge', 'beam', 'laser',
  'turret',
]);

interface BlockSkillWeaponsProps {
  projectilesRef: React.MutableRefObject<Projectile[]>;
}

export default function BlockSkillWeapons({ projectilesRef }: BlockSkillWeaponsProps) {
  // 카테고리별 InstancedMesh refs
  const codeRef = useRef<THREE.InstancedMesh>(null);
  const codeCoreRef = useRef<THREE.InstancedMesh>(null);
  const dataRef = useRef<THREE.InstancedMesh>(null);
  const dataCoreRef = useRef<THREE.InstancedMesh>(null);
  const networkRef = useRef<THREE.InstancedMesh>(null);
  const networkCoreRef = useRef<THREE.InstancedMesh>(null);
  const securityRef = useRef<THREE.InstancedMesh>(null);
  const securityCoreRef = useRef<THREE.InstancedMesh>(null);
  const aiRef = useRef<THREE.InstancedMesh>(null);
  const aiCoreRef = useRef<THREE.InstancedMesh>(null);
  const systemRef = useRef<THREE.InstancedMesh>(null);
  const systemCoreRef = useRef<THREE.InstancedMesh>(null);

  // ===== Geometries: 카테고리별 차별화된 shape =====
  const geometries = useMemo(() => ({
    // CODE: 큐브 (디지털 / 코드 블록)
    codeOuter: new THREE.BoxGeometry(0.4, 0.4, 0.4),
    codeCore: new THREE.BoxGeometry(0.16, 0.16, 0.16),
    // DATA: 팔면체 (데이터 결정)
    dataOuter: new THREE.OctahedronGeometry(0.28, 0),
    dataCore: new THREE.OctahedronGeometry(0.12, 0),
    // NETWORK: 이십면체 (네트워크 노드)
    networkOuter: new THREE.IcosahedronGeometry(0.28, 0),
    networkCore: new THREE.IcosahedronGeometry(0.12, 0),
    // SECURITY: 십이면체 (방어 다면체)
    securityOuter: new THREE.DodecahedronGeometry(0.28, 0),
    securityCore: new THREE.DodecahedronGeometry(0.12, 0),
    // AI: 구체 (뉴럴 노드)
    aiOuter: new THREE.SphereGeometry(0.28, 12, 12),
    aiCore: new THREE.SphereGeometry(0.12, 8, 8),
    // SYSTEM: 정사각뿔 (시스템 프로세스)
    systemOuter: new THREE.TetrahedronGeometry(0.32, 0),
    systemCore: new THREE.TetrahedronGeometry(0.14, 0),
  }), []);

  // ===== Materials: 카테고리별 color =====
  const materials = useMemo(() => {
    const createMat = (cat: SkillCategory, isCore: boolean) => {
      const c = SKILL_COLORS[cat];
      if (isCore) {
        return new THREE.MeshStandardMaterial({
          color: '#FFFFFF',
          emissive: c.emissive,
          emissiveIntensity: 0.9,
        });
      }
      return new THREE.MeshStandardMaterial({
        color: c.dark,
        emissive: c.emissive,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85,
      });
    };

    return {
      codeOuter: createMat('CODE', false),
      codeCore: createMat('CODE', true),
      dataOuter: createMat('DATA', false),
      dataCore: createMat('DATA', true),
      networkOuter: createMat('NETWORK', false),
      networkCore: createMat('NETWORK', true),
      securityOuter: createMat('SECURITY', false),
      securityCore: createMat('SECURITY', true),
      aiOuter: createMat('AI', false),
      aiCore: createMat('AI', true),
      systemOuter: createMat('SYSTEM', false),
      systemCore: createMat('SYSTEM', true),
    };
  }, []);

  useFrame(() => {
    const projectiles = projectilesRef.current;
    if (!projectiles) return;

    const time = performance.now();

    // 카테고리별 카운터
    const counts = {
      CODE: 0,
      DATA: 0,
      NETWORK: 0,
      SECURITY: 0,
      AI: 0,
      SYSTEM: 0,
    };
    const coreCounts = { ...counts };

    // 카테고리별 mesh 매핑
    const outerRefs: Record<SkillCategory, React.RefObject<THREE.InstancedMesh | null>> = {
      CODE: codeRef,
      DATA: dataRef,
      NETWORK: networkRef,
      SECURITY: securityRef,
      AI: aiRef,
      SYSTEM: systemRef,
    };
    const coreRefs: Record<SkillCategory, React.RefObject<THREE.InstancedMesh | null>> = {
      CODE: codeCoreRef,
      DATA: dataCoreRef,
      NETWORK: networkCoreRef,
      SECURITY: securityCoreRef,
      AI: aiCoreRef,
      SYSTEM: systemCoreRef,
    };

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i] as any;
      if (!p || p.life <= 0) continue;

      const weaponType = p.weaponType || p.type;

      // 기본 무기 타입이면 스킵 (스킬 전용 렌더러)
      if (NON_SKILL_TYPES.has(weaponType)) continue;

      // 카테고리 결정
      const category: SkillCategory = SKILL_CATEGORY_MAP[weaponType] || 'SYSTEM';
      const colors = SKILL_COLORS[category];

      // 블록 좌표 네이티브 — WORLD_SCALE=1, Z 반전 없음
      const px = p.position?.x ?? p.x ?? 0;
      const pz = p.position?.y ?? p.y ?? 0; // 2D y → 3D z
      const terrainY = getMCTerrainHeight(px, pz) + PROJECTILE_Y_OFFSET;
      const angle = p.angle || 0;
      const radius = p.radius || 0.4; // 블록 단위 (스케일링 불필요)
      const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));

      // 스폰 바운스
      const age = p.age || 0;
      const bounceScale = age < 0.3
        ? easeOutBack(Math.min(1, age / 0.3))
        : 1;

      const baseScale = Math.max(0.5, radius * 2.5) * bounceScale;

      // ===== 외곽 오브 =====
      const outerMesh = outerRefs[category]?.current;
      if (outerMesh && counts[category] < CAPACITY) {
        const pulseScale = baseScale * (1 + Math.sin(time / 200 + i * 0.7) * 0.1);
        const rotSpeed = getCategoryRotSpeed(category);

        _pos.set(px, terrainY, pz);
        _euler.set(
          time / (1000 + i * 10) * rotSpeed,
          -angle + time / (800 + i * 5) * rotSpeed,
          time / (1200 + i * 8) * rotSpeed * 0.5
        );
        _quat.setFromEuler(_euler);
        _scale.set(pulseScale, pulseScale, pulseScale);
        _mat4.compose(_pos, _quat, _scale);
        outerMesh.setMatrixAt(counts[category], _mat4);

        // 진화/궁극 시 색상 변형
        if (p.isUltimate) {
          _color.setRGB(0.99, 0.8, 0.08); // Gold
        } else if (p.isEvolved) {
          _color.setRGB(
            Math.min(1, colors.r * 1.4),
            Math.min(1, colors.g * 1.4),
            Math.min(1, colors.b * 1.4)
          );
        } else {
          _color.setRGB(colors.r, colors.g, colors.b);
        }
        outerMesh.setColorAt(counts[category], _color);
        counts[category]++;
      }

      // ===== 내부 코어 =====
      const coreMesh = coreRefs[category]?.current;
      if (coreMesh && coreCounts[category] < CAPACITY) {
        const corePulse = 0.85 + Math.sin(time / 50 + i * 0.5) * 0.15;
        const coreSize = baseScale * 0.5 * corePulse;

        _pos.set(px, terrainY, pz);
        _euler.set(
          -time / 600,
          time / 400,
          0
        );
        _quat.setFromEuler(_euler);
        _scale.set(coreSize, coreSize, coreSize);
        _mat4.compose(_pos, _quat, _scale);
        coreMesh.setMatrixAt(coreCounts[category], _mat4);
        coreCounts[category]++;
      }
    }

    // count 설정 + flush
    for (const cat of Object.keys(counts) as SkillCategory[]) {
      setCountAndFlush(outerRefs[cat]?.current, counts[cat]);
      setCountAndFlush(coreRefs[cat]?.current, coreCounts[cat]);
    }
  });

  return (
    <group>
      {/* CODE — 큐브 (Matrix green) */}
      <instancedMesh ref={codeRef} args={[geometries.codeOuter, materials.codeOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={codeCoreRef} args={[geometries.codeCore, materials.codeCore, CAPACITY]} frustumCulled={false} />

      {/* DATA — 팔면체 (cyan) */}
      <instancedMesh ref={dataRef} args={[geometries.dataOuter, materials.dataOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={dataCoreRef} args={[geometries.dataCore, materials.dataCore, CAPACITY]} frustumCulled={false} />

      {/* NETWORK — 이십면체 (purple) */}
      <instancedMesh ref={networkRef} args={[geometries.networkOuter, materials.networkOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={networkCoreRef} args={[geometries.networkCore, materials.networkCore, CAPACITY]} frustumCulled={false} />

      {/* SECURITY — 십이면체 (red) */}
      <instancedMesh ref={securityRef} args={[geometries.securityOuter, materials.securityOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={securityCoreRef} args={[geometries.securityCore, materials.securityCore, CAPACITY]} frustumCulled={false} />

      {/* AI — 구체 (amber) */}
      <instancedMesh ref={aiRef} args={[geometries.aiOuter, materials.aiOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={aiCoreRef} args={[geometries.aiCore, materials.aiCore, CAPACITY]} frustumCulled={false} />

      {/* SYSTEM — 사면체 (pink) */}
      <instancedMesh ref={systemRef} args={[geometries.systemOuter, materials.systemOuter, CAPACITY]} frustumCulled={false} />
      <instancedMesh ref={systemCoreRef} args={[geometries.systemCore, materials.systemCore, CAPACITY]} frustumCulled={false} />
    </group>
  );
}

// ===== 유틸리티 =====

/** 카테고리별 회전 속도 차별화 */
function getCategoryRotSpeed(cat: SkillCategory): number {
  switch (cat) {
    case 'CODE': return 1.0;      // 안정적 회전
    case 'DATA': return 1.5;      // 빠른 결정 회전
    case 'NETWORK': return 0.8;   // 느린 노드 회전
    case 'SECURITY': return 1.2;  // 중간 방어 회전
    case 'AI': return 0.5;        // 느리고 부드러운 회전
    case 'SYSTEM': return 2.0;    // 빠른 프로세스 회전
    default: return 1.0;
  }
}

/** easeOutBack 이징 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(Math.max(0, Math.min(1, t)) - 1, 3) + c1 * Math.pow(Math.max(0, Math.min(1, t)) - 1, 2);
}

/** count 설정 + GPU flush */
function setCountAndFlush(mesh: THREE.InstancedMesh | null, count: number): void {
  if (!mesh) return;
  mesh.count = count;
  if (count > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
