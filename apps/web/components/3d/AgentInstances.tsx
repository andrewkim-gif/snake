'use client';

/**
 * AgentInstances — 큐블링(Cubeling) 캐릭터 InstancedMesh 일괄 렌더링
 *
 * Phase 4A 변경사항: AnimationStateMachine 통합
 * - computePartRotations() → AnimationStateMachine.getTransforms()
 * - 파트별 multi-axis rotation + positional offset + scale 지원
 * - IDLE: 호흡, 좌우 둘러보기, 무게중심 이동, 팔 흔들림
 * - WALK: 교차 스윙, Y 바운스(cos 곡선), Z 힙스웨이
 * - BOOST: 전방 기울임, 팔 잠금, 2배속 다리, body 찌그러짐
 * - 상태 전환: smoothstep 블렌딩 (0.1~0.2초)
 *
 * Phase 2 유지: Color-Tint 머티리얼 시스템
 * - body: 패턴별 4 InstancedMesh 그룹핑
 * - arm/leg: 단일 IM + setColorAt
 * - head: HeadGroupManager 담당
 *
 * 총 IM: body 4 + armL 1 + armR 1 + legL 1 + legR 1 = 8 draw calls
 * (head는 HeadGroupManager가 담당)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { textureCacheManager } from '@/lib/3d/cubeling-textures';
import { toWorld, headingToRotY, getAgentScale } from '@/lib/3d/coordinate-utils';
import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions';
import { resolveAppearance } from '@/lib/3d/skin-migration';
import { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import { HeadGroupManager } from './HeadGroupManager';
import { VIVID_PALETTE } from '@agent-survivor/shared';
import type { AgentNetworkData, CubelingAppearance } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_AGENTS = 60;

/** body 패턴 그룹 수 (solid, striped, dotted, gradient) — 첫 4종만 body IM 분리 */
const BODY_PATTERN_COUNT = 4;

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _qAgent = new THREE.Quaternion();
const _qPart = new THREE.Quaternion();
const _qCombined = new THREE.Quaternion();
const _color = new THREE.Color();

// ─── 속도 추정용 이전 위치 캐시 ───

interface AgentMotionState {
  prevX: number;
  prevY: number;
  velocity: number;
  deathTime: number;
  wasAlive: boolean;
}

const motionCache = new Map<string, AgentMotionState>();

// ─── appearance 캐시 (skinId → CubelingAppearance) ───

const appearanceCache = new Map<number, CubelingAppearance>();

/** skinId → CubelingAppearance 해석 (캐시 포함) */
function getCachedAppearance(skinId: number): CubelingAppearance {
  let cached = appearanceCache.get(skinId);
  if (cached) return cached;
  cached = resolveAppearance(skinId);
  appearanceCache.set(skinId, cached);
  return cached;
}

// ─── Props ───

interface AgentInstancesProps {
  /** 보간된 Agent 배열 (GameLoop에서 업데이트) */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 경과 시간 ref (초 단위 누적) */
  elapsedRef: React.MutableRefObject<number>;
}

// ─── 애니메이션 헬퍼 ───

/**
 * 파트별 월드 위치 + 회전을 Object3D에 설정하고 matrix 업데이트
 * Phase 4A: multi-axis rotation + positional offset + per-axis scale 지원
 *
 * @param partRotX - X축 회전 (팔/다리 스윙, body 전방 기울임)
 * @param partRotY - Y축 회전 (head 좌우 둘러보기)
 * @param partRotZ - Z축 회전 (body 힙스웨이)
 * @param animPosX - 애니메이션 X 오프셋 (무게중심 이동)
 * @param animPosY - 애니메이션 Y 오프셋 (바운스, 호흡)
 * @param animPosZ - 애니메이션 Z 오프셋
 * @param scaleX   - X축 스케일 배율 (부스트 찌그러짐)
 * @param scaleY   - Y축 스케일 배율 (호흡)
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
  partRotY = 0,
  partRotZ = 0,
  animPosX = 0,
  animPosY = 0,
  animPosZ = 0,
  scaleX = 1,
  scaleY = 1,
): void {
  _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, headingRotY);

  // 오프셋 + 애니메이션 위치를 에이전트 로컬 좌표로 계산
  _pos.set(
    (offsetX + animPosX) * scale,
    (offsetY + animPosY) * scale,
    (offsetZ + animPosZ) * scale,
  );
  _pos.applyQuaternion(_qAgent);

  _obj.position.set(agentWorldX + _pos.x, _pos.y, agentWorldZ + _pos.z);

  // 파트 로컬 회전 (X → Y → Z 순서: Euler XYZ)
  _qPart.setFromEuler(_euler.set(partRotX, partRotY, partRotZ));
  _qCombined.copy(_qAgent).multiply(_qPart);
  _obj.quaternion.copy(_qCombined);

  // per-axis 스케일 적용
  _obj.scale.set(scale * scaleX, scale * scaleY, scale);
  _obj.updateMatrix();
  mesh.setMatrixAt(idx, _obj.matrix);
}

/**
 * 비활성 인스턴스를 scale 0으로 숨김
 */
function hideInstance(mesh: THREE.InstancedMesh, idx: number): void {
  _obj.position.set(0, -9999, 0);
  _obj.scale.setScalar(0);
  _obj.updateMatrix();
  mesh.setMatrixAt(idx, _obj.matrix);
}

// ─── Component ───

export function AgentInstances({ agentsRef, elapsedRef }: AgentInstancesProps) {
  // ─── Body 패턴별 IM refs (4 IM) ───
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);

  // ─── Arm/Leg 단일 IM refs ───
  const armLRef = useRef<THREE.InstancedMesh>(null!);
  const armRRef = useRef<THREE.InstancedMesh>(null!);
  const legLRef = useRef<THREE.InstancedMesh>(null!);
  const legRRef = useRef<THREE.InstancedMesh>(null!);

  // ─── 애니메이션 상태 머신 (60 에이전트 일괄 관리) ───
  const stateMachineRef = useRef<AnimationStateMachine | null>(null);
  if (!stateMachineRef.current) {
    stateMachineRef.current = new AnimationStateMachine(MAX_AGENTS);
  }

  // ─── 활성 에이전트 인덱스 매핑 (id → index) ───
  const agentIndexMapRef = useRef<Map<string, number>>(new Map());

  // ─── Geometry (한 번만 생성) ───
  const geometries = useMemo(() => {
    const P = CUBELING_PARTS;

    const armLGeo = new THREE.BoxGeometry(...P.armL.size);
    armLGeo.translate(0, -P.armL.size[1] / 2, 0);
    const armRGeo = new THREE.BoxGeometry(...P.armR.size);
    armRGeo.translate(0, -P.armR.size[1] / 2, 0);
    const legLGeo = new THREE.BoxGeometry(...P.legL.size);
    legLGeo.translate(0, -P.legL.size[1] / 2, 0);
    const legRGeo = new THREE.BoxGeometry(...P.legR.size);
    legRGeo.translate(0, -P.legR.size[1] / 2, 0);

    return {
      body: new THREE.BoxGeometry(...P.body.size),
      armL: armLGeo,
      armR: armRGeo,
      legL: legLGeo,
      legR: legRGeo,
    };
  }, []);

  // ─── 패턴별 Body Material (흰색 base — setColorAt으로 틴팅) ───
  const bodyMaterials = useMemo(() => {
    const mats: THREE.MeshLambertMaterial[] = [];
    for (let p = 0; p < BODY_PATTERN_COUNT; p++) {
      const tex = textureCacheManager.getBodyTexture(p);
      mats.push(new THREE.MeshLambertMaterial({
        map: tex,
        color: 0xffffff, // 곱연산 중립 → setColorAt이 100% 색상 결정
      }));
    }
    return mats;
  }, []);

  // ─── Arm/Leg Material (흰색 base) ───
  const limbMaterials = useMemo(() => {
    const armTex = textureCacheManager.getArmTexture(0);
    const legTex = textureCacheManager.getLegTexture(0);
    return {
      arm: new THREE.MeshLambertMaterial({ map: armTex, color: 0xffffff }),
      leg: new THREE.MeshLambertMaterial({ map: legTex, color: 0xffffff }),
    };
  }, []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(g => g.dispose());
      bodyMaterials.forEach(m => m.dispose());
      limbMaterials.arm.dispose();
      limbMaterials.leg.dispose();
      motionCache.clear();
      appearanceCache.clear();
      agentIndexMapRef.current.clear();
      stateMachineRef.current = null;
    };
  }, [geometries, bodyMaterials, limbMaterials]);

  // ─── useFrame: 매 프레임 상태 머신 업데이트 + body/arm/leg matrix + color ───
  useFrame((_, delta) => {
    const agents = agentsRef.current;
    const sm = stateMachineRef.current;

    const armLMesh = armLRef.current;
    const armRMesh = armRRef.current;
    const legLMesh = legLRef.current;
    const legRMesh = legRRef.current;

    if (!armLMesh || !armRMesh || !legLMesh || !legRMesh || !sm) return;

    // Body 패턴별 IM 참조 + 패턴별 에이전트 인덱스 추적
    const bodyMeshes: (THREE.InstancedMesh | null)[] = bodyRefs.current;
    const bodyIndices: number[] = new Array(BODY_PATTERN_COUNT).fill(0);

    const P = CUBELING_PARTS;
    const indexMap = agentIndexMapRef.current;
    let limbIdx = 0;

    // ─── 이번 프레임에 등장하는 에이전트 ID 세트 ───
    const activeIds = new Set<string>();

    for (const agent of agents) {
      if (limbIdx >= MAX_AGENTS) break;

      const { x, y, h, m, b: boosting, k: skinId, i: id } = agent;
      activeIds.add(id);

      // ─── appearance 해석 ───
      const appearance = getCachedAppearance(skinId);

      // ─── 속도 추정 ───
      let motion = motionCache.get(id);
      if (!motion) {
        motion = { prevX: x, prevY: y, velocity: 0, deathTime: 0, wasAlive: true };
        motionCache.set(id, motion);
      }
      const dx = x - motion.prevX;
      const dy = y - motion.prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rawVel = delta > 0 ? dist / delta : 0;
      motion.velocity = motion.velocity * 0.7 + rawVel * 0.3;
      motion.prevX = x;
      motion.prevY = y;

      // ─── 상태 머신: 에이전트 인덱스 매핑 + 활성화 ───
      let smIdx = indexMap.get(id);
      if (smIdx === undefined) {
        smIdx = limbIdx;
        indexMap.set(id, smIdx);
        sm.activate(smIdx);
      } else {
        // 인덱스가 변경된 경우 (다른 에이전트가 빠져서 밀린 경우)
        if (smIdx !== limbIdx) {
          sm.deactivate(smIdx);
          smIdx = limbIdx;
          indexMap.set(id, smIdx);
          sm.activate(smIdx);
        }
      }

      // ─── 상태 머신 업데이트: 입력 기반 전환 + 시간 진행 ───
      sm.updateAgent(smIdx, { velocity: motion.velocity, boosting }, delta);

      // ─── 월드 좌표 + 스케일 ───
      const [worldX, , worldZ] = toWorld(x, y, 0);
      const rotY = headingToRotY(h);
      const scale = getAgentScale(m);

      // ─── 애니메이션 변환 가져오기 ───
      const anim = sm.getTransforms(smIdx, motion.velocity, boosting);

      // ─── Body: 패턴별 IM에 할당 ───
      const patternGroup = appearance.pattern < BODY_PATTERN_COUNT ? appearance.pattern : 0;
      const bodyMesh = bodyMeshes[patternGroup];
      if (bodyMesh) {
        const bodyIdx = bodyIndices[patternGroup];
        setPartMatrix(bodyMesh, bodyIdx, worldX, worldZ, rotY, scale,
          P.body.offset[0], P.body.offset[1], P.body.offset[2],
          anim.body.rotX, anim.body.rotY, anim.body.rotZ,
          anim.body.posX, anim.body.posY, anim.body.posZ,
          anim.body.scaleX, anim.body.scaleY);

        // body 색상 = topColor
        const topColorHex = VIVID_PALETTE[appearance.topColor % VIVID_PALETTE.length];
        _color.set(topColorHex);
        bodyMesh.setColorAt(bodyIdx, _color);

        bodyIndices[patternGroup] = bodyIdx + 1;
      }

      // ─── ArmL ───
      setPartMatrix(armLMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.armL.offset[0], P.armL.offset[1], P.armL.offset[2],
        anim.armL.rotX, 0, anim.armL.rotZ);
      _color.set(VIVID_PALETTE[appearance.topColor % VIVID_PALETTE.length]);
      armLMesh.setColorAt(limbIdx, _color);

      // ─── ArmR ───
      setPartMatrix(armRMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.armR.offset[0], P.armR.offset[1], P.armR.offset[2],
        anim.armR.rotX, 0, anim.armR.rotZ);
      armRMesh.setColorAt(limbIdx, _color);

      // ─── LegL ───
      setPartMatrix(legLMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.legL.offset[0], P.legL.offset[1], P.legL.offset[2],
        anim.legL.rotX);
      _color.set(VIVID_PALETTE[appearance.bottomColor % VIVID_PALETTE.length]);
      legLMesh.setColorAt(limbIdx, _color);

      // ─── LegR ───
      setPartMatrix(legRMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.legR.offset[0], P.legR.offset[1], P.legR.offset[2],
        anim.legR.rotX);
      legRMesh.setColorAt(limbIdx, _color);

      limbIdx++;
    }

    // ─── 빠진 에이전트 비활성화 ───
    for (const [id, idx] of indexMap) {
      if (!activeIds.has(id)) {
        sm.deactivate(idx);
        indexMap.delete(id);
      }
    }

    // ─── Body 패턴별 IM count + needsUpdate ───
    for (let p = 0; p < BODY_PATTERN_COUNT; p++) {
      const mesh = bodyMeshes[p];
      if (mesh) {
        mesh.count = bodyIndices[p];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      }
    }

    // ─── Arm/Leg count + needsUpdate ───
    armLMesh.count = limbIdx;
    armRMesh.count = limbIdx;
    legLMesh.count = limbIdx;
    legRMesh.count = limbIdx;

    armLMesh.instanceMatrix.needsUpdate = true;
    armRMesh.instanceMatrix.needsUpdate = true;
    legLMesh.instanceMatrix.needsUpdate = true;
    legRMesh.instanceMatrix.needsUpdate = true;

    if (armLMesh.instanceColor) armLMesh.instanceColor.needsUpdate = true;
    if (armRMesh.instanceColor) armRMesh.instanceColor.needsUpdate = true;
    if (legLMesh.instanceColor) legLMesh.instanceColor.needsUpdate = true;
    if (legRMesh.instanceColor) legRMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Body: 패턴별 4 InstancedMesh */}
      {bodyMaterials.map((mat, patternIdx) => (
        <instancedMesh
          key={`body-pattern-${patternIdx}`}
          ref={(el: THREE.InstancedMesh | null) => { bodyRefs.current[patternIdx] = el; }}
          args={[geometries.body, mat, MAX_AGENTS]}
          frustumCulled={false}
        />
      ))}

      {/* ArmL: 단일 IM + setColorAt */}
      <instancedMesh
        ref={armLRef}
        args={[geometries.armL, limbMaterials.arm, MAX_AGENTS]}
        frustumCulled={false}
      />
      {/* ArmR */}
      <instancedMesh
        ref={armRRef}
        args={[geometries.armR, limbMaterials.arm, MAX_AGENTS]}
        frustumCulled={false}
      />
      {/* LegL */}
      <instancedMesh
        ref={legLRef}
        args={[geometries.legL, limbMaterials.leg, MAX_AGENTS]}
        frustumCulled={false}
      />
      {/* LegR */}
      <instancedMesh
        ref={legRRef}
        args={[geometries.legR, limbMaterials.leg, MAX_AGENTS]}
        frustumCulled={false}
      />

      {/* Head: HeadGroupManager (얼굴 조합별 동적 IM + 애니메이션 변환) */}
      <HeadGroupManager
        agentsRef={agentsRef}
        elapsedRef={elapsedRef}
        resolveAppearanceFn={getCachedAppearance}
        stateMachineRef={stateMachineRef}
        agentIndexMapRef={agentIndexMapRef}
      />
    </group>
  );
}
