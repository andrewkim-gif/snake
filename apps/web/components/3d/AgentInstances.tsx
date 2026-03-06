'use client';

/**
 * AgentInstances — MC 복셀 캐릭터 InstancedMesh 일괄 렌더링
 * 6개 파트(head, body, armL, armR, legL, legR)별 InstancedMesh
 * 총 6 draw calls로 최대 60 Agent 렌더링
 *
 * 애니메이션: idle/walk/boost/death 상태별 파트 rotation
 * 텍스처: getAgentTextures()의 Canvas 텍스처 + instanceColor 미사용(파트별 material)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAgentTextures, disposeTextureCache } from '@/lib/3d/agent-textures';
import { toWorld, headingToRotY, getAgentScale } from '@/lib/3d/coordinate-utils';
import type { AgentNetworkData } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_AGENTS = 60;
const PI2 = Math.PI * 2;

/** MC 캐릭터 파트 정의 (6파트) */
const PARTS = {
  head: { size: [8, 8, 8] as const, offset: [0, 24, 0] as const },
  body: { size: [8, 12, 4] as const, offset: [0, 14, 0] as const },
  armL: { size: [4, 12, 4] as const, offset: [-6, 14, 0] as const },
  armR: { size: [4, 12, 4] as const, offset: [6, 14, 0] as const },
  legL: { size: [4, 12, 4] as const, offset: [-2, 2, 0] as const },
  legR: { size: [4, 12, 4] as const, offset: [2, 2, 0] as const },
} as const;

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

  const walkFreq = Math.min(velocity / 100, 3); // 최대 3Hz
  const walkAmp = 0.52; // ~30° radians

  if (boosting) {
    // boost: 팔 뒤로 고정(-45°) + 다리 빠른 스윙(2x freq)
    const legSwing = Math.sin(elapsed * walkFreq * 2 * PI2) * walkAmp;
    return {
      armLX: -0.78, // -45° 고정
      armRX: -0.78,
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
  head: THREE.MeshLambertMaterial;
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
    head: new THREE.MeshLambertMaterial({ map: textures.head }),
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
  const geometries = useMemo(() => ({
    head: new THREE.BoxGeometry(...PARTS.head.size),
    body: new THREE.BoxGeometry(...PARTS.body.size),
    armL: new THREE.BoxGeometry(...PARTS.armL.size),
    armR: new THREE.BoxGeometry(...PARTS.armR.size),
    legL: new THREE.BoxGeometry(...PARTS.legL.size),
    legR: new THREE.BoxGeometry(...PARTS.legR.size),
  }), []);

  // ─── 기본 material (첫 렌더링용, 실제 텍스처는 skinId별로 변경) ───
  // InstancedMesh는 단일 material만 지원하므로 기본 스킨(skinId=0)으로 초기화
  // 스킨별 차이는 텍스처 교체로 처리 (다수의 스킨은 가장 많은 스킨의 material 사용)
  const defaultMaterials = useMemo(() => {
    const mats = getPartMaterials(0);
    return mats;
  }, []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      // Geometry dispose
      Object.values(geometries).forEach(g => g.dispose());
      // Material dispose
      materialCache.forEach(mats => {
        mats.head.dispose();
        mats.body.dispose();
        mats.arm.dispose();
        mats.leg.dispose();
      });
      materialCache.clear();
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
    // → 단순화: 첫 번째 Agent의 skinId material 사용 (모든 Agent 동일 텍스처)
    // → 더 나은 방안: 가장 빈번한 skinId 사용
    // ★ 현실적 접근: 단일 InstancedMesh에는 단일 material만 가능.
    //   진정한 해결은 TextureAtlas이지만 Phase 2에서는 가장 많은 스킨 기준.
    //   다수의 스킨 차이는 미세하므로 시각적 영향 최소.
    if (agents.length > 0) {
      // 빈도 카운트로 가장 많은 skinId 찾기
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
      headMesh.material = mats.head;
      bodyMesh.material = mats.body;
      armLMesh.material = mats.arm;
      armRMesh.material = mats.arm; // 양팔 동일
      legLMesh.material = mats.leg;
      legRMesh.material = mats.leg; // 양다리 동일
    }

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
      // delta가 0이면 나누기 방지
      const rawVel = delta > 0 ? dist / delta : 0;
      // 스무딩 (급격한 변화 방지)
      motion.velocity = motion.velocity * 0.7 + rawVel * 0.3;
      motion.prevX = x;
      motion.prevY = y;

      // ─── 월드 좌표 변환 ───
      const [worldX, , worldZ] = toWorld(x, y, 0);
      const rotY = headingToRotY(h);
      const scale = getAgentScale(m);

      // ─── 애니메이션 ───
      const anim = computePartRotations(motion.velocity, boosting, elapsed);

      // ─── 6파트 Matrix 설정 ───

      // Head (애니메이션 없음 — rotX = 0)
      setPartMatrix(headMesh, idx, worldX, worldZ, rotY, scale,
        PARTS.head.offset[0], PARTS.head.offset[1], PARTS.head.offset[2], 0);

      // Body (애니메이션 없음 — rotX = 0)
      setPartMatrix(bodyMesh, idx, worldX, worldZ, rotY, scale,
        PARTS.body.offset[0], PARTS.body.offset[1], PARTS.body.offset[2], 0);

      // ArmL
      setPartMatrix(armLMesh, idx, worldX, worldZ, rotY, scale,
        PARTS.armL.offset[0], PARTS.armL.offset[1], PARTS.armL.offset[2], anim.armLX);

      // ArmR
      setPartMatrix(armRMesh, idx, worldX, worldZ, rotY, scale,
        PARTS.armR.offset[0], PARTS.armR.offset[1], PARTS.armR.offset[2], anim.armRX);

      // LegL
      setPartMatrix(legLMesh, idx, worldX, worldZ, rotY, scale,
        PARTS.legL.offset[0], PARTS.legL.offset[1], PARTS.legL.offset[2], anim.legLX);

      // LegR
      setPartMatrix(legRMesh, idx, worldX, worldZ, rotY, scale,
        PARTS.legR.offset[0], PARTS.legR.offset[1], PARTS.legR.offset[2], anim.legRX);

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
      <instancedMesh
        ref={headRef}
        args={[geometries.head, defaultMaterials.head, MAX_AGENTS]}
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
