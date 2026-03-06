'use client';

/**
 * AgentInstances — 큐블링(Cubeling) 캐릭터 InstancedMesh 일괄 렌더링
 * 6개 파트(head, body, armL, armR, legL, legR)별 InstancedMesh
 * 총 6 draw calls로 최대 60 Agent 렌더링
 *
 * Phase 1 변경사항:
 * - 32u MC 프로포션 → 24u 큐블링 프로포션 (cubeling-proportions.ts 사용)
 * - head [8,8,8] → [10,10,8], body [8,12,4] → [8,7,5], arm/leg [4,12,4] → [4,7,4]
 * - 오프셋 전체 변경 (큐블링 비율)
 * - 기존 idle/walk/boost 애니메이션 로직 유지
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAgentTextures, getHeadMaterials, disposeTextureCache, disposeMaterialCache } from '@/lib/3d/agent-textures';
import { toWorld, headingToRotY, getAgentScale } from '@/lib/3d/coordinate-utils';
import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions';
import type { AgentNetworkData } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_AGENTS = 60;
const PI2 = Math.PI * 2;

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _qAgent = new THREE.Quaternion();
const _qPart = new THREE.Quaternion();
const _qCombined = new THREE.Quaternion();

// ─── 속도 추정용 이전 위치 캐시 ───

interface AgentMotionState {
  prevX: number;
  prevY: number;
  velocity: number;
  // 사망 시 timestamp (death 애니메이션용)
  deathTime: number;
  // 마지막으로 살아있었는지
  wasAlive: boolean;
}

const motionCache = new Map<string, AgentMotionState>();

// ─── Props ───

interface AgentInstancesProps {
  /** 보간된 Agent 배열 (GameLoop에서 업데이트) */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 경과 시간 ref (초 단위 누적) */
  elapsedRef: React.MutableRefObject<number>;
}

// ─── 애니메이션 헬퍼 ───

/**
 * Agent의 속도 기반 애니메이션 상태에서 팔/다리 rotation 계산
 * Phase 1: 기존 로직 유지 (큐블링 프로포션에서는 시각적으로 더 귀여운 바운스)
 */
function computePartRotations(
  velocity: number,
  boosting: boolean,
  elapsed: number,
): { armLX: number; armRX: number; legLX: number; legRX: number } {
  // idle: 미세 흔들림 (±3°, 0.8Hz)
  if (velocity < 5 && !boosting) {
    const idleSwing = Math.sin(elapsed * 0.8 * PI2) * 0.05; // ~3° radians
    return {
      armLX: idleSwing,
      armRX: -idleSwing,
      legLX: -idleSwing,
      legRX: idleSwing,
    };
  }

  // 큐블링은 짧은 팔/다리 → 스윙 진폭 조금 더 크게 (0.52→0.44 rad ≈ 25°)
  const walkFreq = Math.min(velocity / 80, 3.5); // 조금 더 빠른 걸음
  const walkAmp = 0.44; // ~25° radians (큐블링 짧은 다리에 맞춤)

  if (boosting) {
    // boost: 팔 뒤로 고정(-60°) + 다리 빠른 스윙(2x freq, 1.3배 진폭)
    const legSwing = Math.sin(elapsed * walkFreq * 2 * PI2) * walkAmp * 1.3;
    return {
      armLX: -1.05, // -60° 고정 (큐블링 대시 포즈)
      armRX: -1.05,
      legLX: legSwing,
      legRX: -legSwing,
    };
  }

  // walk: 팔/다리 교차 스윙
  const armSwing = Math.sin(elapsed * walkFreq * PI2) * walkAmp;
  return {
    armLX: armSwing,
    armRX: -armSwing,
    legLX: -armSwing,
    legRX: armSwing,
  };
}

/**
 * 파트별 월드 위치 + 회전을 Object3D에 설정하고 matrix 업데이트
 * T = agentWorldPos + partOffset(rotated by heading)
 * R = heading × partAnimation
 * S = agentScale
 */
function setPartMatrix(
  mesh: THREE.InstancedMesh,
  idx: number,
  agentWorldX: number,
  agentWorldZ: number,
  headingRotY: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  partRotX: number,
): void {
  // Agent heading quaternion (Y축 회전)
  _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, headingRotY);

  // 파트 오프셋을 heading으로 회전
  _pos.set(offsetX * scale, offsetY * scale, offsetZ * scale);
  _pos.applyQuaternion(_qAgent);

  // 최종 위치 = Agent 월드 위치 + 회전된 파트 오프셋
  _obj.position.set(
    agentWorldX + _pos.x,
    _pos.y,
    agentWorldZ + _pos.z,
  );

  // 회전: heading(Y) + 파트 애니메이션(X)
  _qPart.setFromEuler(_euler.set(partRotX, 0, 0));
  _qCombined.copy(_qAgent).multiply(_qPart);
  _obj.quaternion.copy(_qCombined);

  // 스케일
  _obj.scale.setScalar(scale);

  _obj.updateMatrix();
  mesh.setMatrixAt(idx, _obj.matrix);
}

// ─── 텍스처 Material 캐시 ───

/** skinId → 파트별 MeshLambertMaterial 캐시 */
interface PartMaterials {
  /** 6-material array for head faces: [+X front, -X back, +Y top, -Y bottom, +Z left, -Z right] */
  headMats: THREE.MeshLambertMaterial[];
  body: THREE.MeshLambertMaterial;
  arm: THREE.MeshLambertMaterial;
  leg: THREE.MeshLambertMaterial;
}

const materialCache = new Map<number, PartMaterials>();

function getPartMaterials(skinId: number): PartMaterials {
  const cached = materialCache.get(skinId);
  if (cached) return cached;

  const textures = getAgentTextures(skinId);
  const mats: PartMaterials = {
    headMats: getHeadMaterials(skinId),
    body: new THREE.MeshLambertMaterial({ map: textures.body }),
    arm: new THREE.MeshLambertMaterial({ map: textures.arm }),
    leg: new THREE.MeshLambertMaterial({ map: textures.leg }),
  };

  materialCache.set(skinId, mats);
  return mats;
}

// ─── Component ───

export function AgentInstances({ agentsRef, elapsedRef }: AgentInstancesProps) {
  // ─── Refs for 6 InstancedMesh ───
  const headRef = useRef<THREE.InstancedMesh>(null!);
  const bodyRef = useRef<THREE.InstancedMesh>(null!);
  const armLRef = useRef<THREE.InstancedMesh>(null!);
  const armRRef = useRef<THREE.InstancedMesh>(null!);
  const legLRef = useRef<THREE.InstancedMesh>(null!);
  const legRRef = useRef<THREE.InstancedMesh>(null!);

  // ─── 파트별 Geometry (useMemo — 한 번만 생성) ───
  // 큐블링 24u 프로포션 사용
  // Arms/Legs: geometry.translate()로 피벗을 상단(어깨/엉덩이)에 배치
  // → rotation 적용 시 어깨/엉덩이에서 자연스럽게 스윙
  const geometries = useMemo(() => {
    const P = CUBELING_PARTS;

    const armLGeo = new THREE.BoxGeometry(...P.armL.size);
    armLGeo.translate(0, -P.armL.size[1] / 2, 0); // 피벗 → 어깨
    const armRGeo = new THREE.BoxGeometry(...P.armR.size);
    armRGeo.translate(0, -P.armR.size[1] / 2, 0);
    const legLGeo = new THREE.BoxGeometry(...P.legL.size);
    legLGeo.translate(0, -P.legL.size[1] / 2, 0); // 피벗 → 엉덩이
    const legRGeo = new THREE.BoxGeometry(...P.legR.size);
    legRGeo.translate(0, -P.legR.size[1] / 2, 0);

    return {
      head: new THREE.BoxGeometry(...P.head.size),
      body: new THREE.BoxGeometry(...P.body.size),
      armL: armLGeo,
      armR: armRGeo,
      legL: legLGeo,
      legR: legRGeo,
    };
  }, []);

  // ─── 기본 material (첫 렌더링용) ───
  // Head: 6-material array (face on +X front only)
  // Body/Arm/Leg: single material (dominant skin 교체)
  const defaultMaterials = useMemo(() => getPartMaterials(0), []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(g => g.dispose());
      materialCache.forEach(mats => {
        mats.headMats.forEach(m => m.dispose());
        mats.body.dispose();
        mats.arm.dispose();
        mats.leg.dispose();
      });
      materialCache.clear();
      disposeMaterialCache();
      disposeTextureCache();
      motionCache.clear();
    };
  }, [geometries]);

  // ─── useFrame: 매 프레임 모든 Agent의 6파트 matrix 업데이트 ───
  // priority 0 (기본값) — GameLoop 이후 마운트 순서로 실행
  useFrame((_, delta) => {
    const agents = agentsRef.current;
    const elapsed = elapsedRef.current;

    const headMesh = headRef.current;
    const bodyMesh = bodyRef.current;
    const armLMesh = armLRef.current;
    const armRMesh = armRRef.current;
    const legLMesh = legLRef.current;
    const legRMesh = legRRef.current;

    if (!headMesh || !bodyMesh || !armLMesh || !armRMesh || !legLMesh || !legRMesh) return;

    // 가장 많은 Agent가 사용하는 skinId를 찾아 각 mesh의 material 교체
    // ★ Phase 2에서 setColorAt 기반으로 전환 예정
    if (agents.length > 0) {
      const skinCounts = new Map<number, number>();
      for (const a of agents) {
        skinCounts.set(a.k, (skinCounts.get(a.k) ?? 0) + 1);
      }
      let dominantSkin = 0;
      let maxCount = 0;
      skinCounts.forEach((count, skinId) => {
        if (count > maxCount) { maxCount = count; dominantSkin = skinId; }
      });

      const mats = getPartMaterials(dominantSkin);
      headMesh.material = mats.headMats; // 6-material array
      bodyMesh.material = mats.body;
      armLMesh.material = mats.arm;
      armRMesh.material = mats.arm; // 양팔 동일
      legLMesh.material = mats.leg;
      legRMesh.material = mats.leg; // 양다리 동일
    }

    const P = CUBELING_PARTS;
    let idx = 0;

    for (const agent of agents) {
      if (idx >= MAX_AGENTS) break;

      const { x, y, h, m, b: boosting, k: skinId, i: id } = agent;

      // ─── 속도 추정 ───
      let motion = motionCache.get(id);
      if (!motion) {
        motion = { prevX: x, prevY: y, velocity: 0, deathTime: 0, wasAlive: true };
        motionCache.set(id, motion);
      }

      // 속도 계산 (이전 프레임 위치 차이)
      const dx = x - motion.prevX;
      const dy = y - motion.prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rawVel = delta > 0 ? dist / delta : 0;
      motion.velocity = motion.velocity * 0.7 + rawVel * 0.3;
      motion.prevX = x;
      motion.prevY = y;

      // ─── 월드 좌표 변환 ───
      const [worldX, , worldZ] = toWorld(x, y, 0);
      const rotY = headingToRotY(h);
      const scale = getAgentScale(m);

      // ─── 애니메이션 ───
      const anim = computePartRotations(motion.velocity, boosting, elapsed);

      // ─── 6파트 Matrix 설정 (큐블링 24u 오프셋) ───

      // Head (애니메이션 없음 — rotX = 0)
      setPartMatrix(headMesh, idx, worldX, worldZ, rotY, scale,
        P.head.offset[0], P.head.offset[1], P.head.offset[2], 0);

      // Body (애니메이션 없음 — rotX = 0)
      setPartMatrix(bodyMesh, idx, worldX, worldZ, rotY, scale,
        P.body.offset[0], P.body.offset[1], P.body.offset[2], 0);

      // ArmL
      setPartMatrix(armLMesh, idx, worldX, worldZ, rotY, scale,
        P.armL.offset[0], P.armL.offset[1], P.armL.offset[2], anim.armLX);

      // ArmR
      setPartMatrix(armRMesh, idx, worldX, worldZ, rotY, scale,
        P.armR.offset[0], P.armR.offset[1], P.armR.offset[2], anim.armRX);

      // LegL
      setPartMatrix(legLMesh, idx, worldX, worldZ, rotY, scale,
        P.legL.offset[0], P.legL.offset[1], P.legL.offset[2], anim.legLX);

      // LegR
      setPartMatrix(legRMesh, idx, worldX, worldZ, rotY, scale,
        P.legR.offset[0], P.legR.offset[1], P.legR.offset[2], anim.legRX);

      idx++;
    }

    // ─── Instance count + needsUpdate ───
    headMesh.count = idx;
    bodyMesh.count = idx;
    armLMesh.count = idx;
    armRMesh.count = idx;
    legLMesh.count = idx;
    legRMesh.count = idx;

    headMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.instanceMatrix.needsUpdate = true;
    armLMesh.instanceMatrix.needsUpdate = true;
    armRMesh.instanceMatrix.needsUpdate = true;
    legLMesh.instanceMatrix.needsUpdate = true;
    legRMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 파트별 InstancedMesh — 6 draw calls */}
      {/* Head: 6-material array → face only on front (+X) */}
      <instancedMesh
        ref={headRef}
        args={[geometries.head, defaultMaterials.headMats, MAX_AGENTS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={bodyRef}
        args={[geometries.body, defaultMaterials.body, MAX_AGENTS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={armLRef}
        args={[geometries.armL, defaultMaterials.arm, MAX_AGENTS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={armRRef}
        args={[geometries.armR, defaultMaterials.arm, MAX_AGENTS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={legLRef}
        args={[geometries.legL, defaultMaterials.leg, MAX_AGENTS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={legRRef}
        args={[geometries.legR, defaultMaterials.leg, MAX_AGENTS]}
        frustumCulled={false}
      />
    </group>
  );
}
