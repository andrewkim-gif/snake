'use client';

/**
 * AgentInstances — 큐블링(Cubeling) 캐릭터 InstancedMesh 일괄 렌더링
 *
 * Phase 4A: AnimationStateMachine 통합
 * - IDLE: 호흡, 좌우 둘러보기, 무게중심 이동, 팔 흔들림
 * - WALK: 교차 스윙, Y 바운스(cos 곡선), Z 힙스웨이
 * - BOOST: 전방 기울임, 팔 잠금, 2배속 다리, body 찌그러짐
 *
 * Phase 4B: 전투/이벤트 애니메이션 통합
 * - ATTACK: 팔R 휘두르기, body 트위스트
 * - HIT: 넉백 + 찌그러짐 + 흰색 플래시 (setColorAt)
 * - DEATH: 720° 스핀 + 포물선 + 축소 소멸
 * - SPAWN: 스케일 바운스 + 아래서 솟아오름
 * - LEVELUP: 점프 + 만세 포즈
 * - VICTORY: 제자리 춤 루프
 * - COLLECT: 짧은 팔 뻗기
 *
 * Phase 2 유지: Color-Tint 머티리얼 시스템
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
import { getCachedNetworkAppearance } from '@/lib/3d/appearance-cache';
import { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import { HeadGroupManager } from './HeadGroupManager';
import { EyeInstances } from './EyeInstances';
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
const _whiteColor = new THREE.Color(0xffffff);

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

const skinAppearanceCache = new Map<number, CubelingAppearance>();

/**
 * agentId + skinId → CubelingAppearance 해석
 * 1. 네트워크 캐시 (서버에서 받은 실제 유저 appearance) 우선
 * 2. 캐시 미스 시 skinId 기반 레거시 변환 (봇 또는 구 클라이언트)
 */
function getCachedAppearance(skinId: number, agentId?: string): CubelingAppearance {
  // Phase 2: 네트워크 appearance 캐시에서 실제 유저 설정 확인
  if (agentId) {
    const networkCached = getCachedNetworkAppearance(agentId);
    if (networkCached) return networkCached;
  }

  // Fallback: skinId 기반 결정적 변환 (봇, 구 클라이언트)
  let cached = skinAppearanceCache.get(skinId);
  if (cached) return cached;
  cached = resolveAppearance(skinId);
  skinAppearanceCache.set(skinId, cached);
  return cached;
}

// ─── Props ───

interface AgentInstancesProps {
  /** 보간된 Agent 배열 (GameLoop에서 업데이트) */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 경과 시간 ref (초 단위 누적) */
  elapsedRef: React.MutableRefObject<number>;
  /** 애니메이션 상태 머신 ref (외부 공유용 — Phase 5: EquipmentInstances에서 참조) */
  stateMachineRef: React.MutableRefObject<AnimationStateMachine | null>;
  /** 에이전트 ID → 상태 머신 인덱스 매핑 (외부 공유용) */
  agentIndexMapRef: React.MutableRefObject<Map<string, number>>;
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
  /** v16 Phase 4: 지형 높이에 의한 수직 오프셋 */
  agentWorldY = 0,
): void {
  _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, headingRotY);

  // 오프셋 + 애니메이션 위치를 에이전트 로컬 좌표로 계산
  _pos.set(
    (offsetX + animPosX) * scale,
    (offsetY + animPosY) * scale,
    (offsetZ + animPosZ) * scale,
  );
  _pos.applyQuaternion(_qAgent);

  _obj.position.set(agentWorldX + _pos.x, agentWorldY + _pos.y, agentWorldZ + _pos.z);

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

export function AgentInstances({ agentsRef, elapsedRef, stateMachineRef, agentIndexMapRef }: AgentInstancesProps) {
  // ─── Body 패턴별 IM refs (4 IM) ───
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null]);

  // ─── Arm/Leg 단일 IM refs ───
  const armLRef = useRef<THREE.InstancedMesh>(null!);
  const armRRef = useRef<THREE.InstancedMesh>(null!);
  const legLRef = useRef<THREE.InstancedMesh>(null!);
  const legRRef = useRef<THREE.InstancedMesh>(null!);

  // ─── 애니메이션 상태 머신 초기화 (외부 ref 사용 — Phase 5: EquipmentInstances와 공유) ───
  if (!stateMachineRef.current) {
    stateMachineRef.current = new AnimationStateMachine(MAX_AGENTS);
  }

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
      skinAppearanceCache.clear();
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

    // ─── 모바일 성능 최적화: 에이전트 수에 따른 애니메이션 축소 ───
    // 20명 이하: full animation, 40명 이상: 간소화 (속도 추정 간격 축소)
    const agentCount = agents.length;
    const isHighLoad = agentCount > 40;

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

      const { x, y, h, f, m, b: boosting, k: skinId, i: id } = agent;
      // v16: facing = aim direction (f), fallback to movement heading (h)
      const facing = f ?? h;
      activeIds.add(id);

      // ─── appearance 해석 (네트워크 캐시 우선, fallback: skinId 레거시 변환) ───
      const appearance = getCachedAppearance(skinId, id);

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
      // 고부하(40+ 에이전트) 시: 2프레임 중 1프레임만 상태 머신 업데이트
      // v16: moveAngle(h), aimAngle(f), agentId 전달
      if (!isHighLoad || (limbIdx % 2 === 0)) {
        sm.updateAgent(smIdx, {
          velocity: motion.velocity,
          boosting,
          moveAngle: h,
          aimAngle: facing,
          agentId: id,
        }, isHighLoad ? delta * 2 : delta);
      }

      // ─── 월드 좌표 + 스케일 ───
      // v16 Phase 4: agent z (서버 높이) → Three.js Y 좌표
      const agentZ = agent.z ?? 0;
      const [worldX, worldY, worldZ] = toWorld(x, y, agentZ);
      // v16: character faces aim direction (facing), not movement heading
      const rotY = headingToRotY(facing);
      const scale = getAgentScale(m);

      // ─── 애니메이션 변환 가져오기 ───
      // v16: moveAngle(h), aimAngle(facing) 전달 (상/하체 분리)
      const anim = sm.getTransforms(smIdx, motion.velocity, boosting, h, facing);

      // ─── HIT 플래시: 흰색으로 일시 오버라이드 ───
      const isFlashing = sm.getHitFlashRemaining(smIdx) > 0;

      // ─── v16: DODGE_ROLL X축 회전 (body/head에 추가) ───
      const rollX = anim.rollRotX || 0;
      // v16: 상/하체 분리 — 하체 Y 회전 오프셋
      const lowerTwist = anim.lowerBodyRotY || 0;

      // ─── Body: 패턴별 IM에 할당 ───
      const patternGroup = appearance.pattern < BODY_PATTERN_COUNT ? appearance.pattern : 0;
      const bodyMesh = bodyMeshes[patternGroup];
      if (bodyMesh) {
        const bodyIdx = bodyIndices[patternGroup];
        setPartMatrix(bodyMesh, bodyIdx, worldX, worldZ, rotY, scale,
          P.body.offset[0], P.body.offset[1], P.body.offset[2],
          anim.body.rotX + rollX, anim.body.rotY, anim.body.rotZ,
          anim.body.posX, anim.body.posY, anim.body.posZ,
          anim.body.scaleX, anim.body.scaleY,
          worldY);

        // body 색상 = topColor (HIT 플래시 시 흰색)
        if (isFlashing) {
          bodyMesh.setColorAt(bodyIdx, _whiteColor);
        } else {
          const topColorHex = VIVID_PALETTE[appearance.topColor % VIVID_PALETTE.length];
          _color.set(topColorHex);
          bodyMesh.setColorAt(bodyIdx, _color);
        }

        bodyIndices[patternGroup] = bodyIdx + 1;
      }

      // ─── 팔/다리 색상 결정 (HIT 플래시 대응) ───
      const topColorHex = VIVID_PALETTE[appearance.topColor % VIVID_PALETTE.length];
      const bottomColorHex = VIVID_PALETTE[appearance.bottomColor % VIVID_PALETTE.length];

      // ─── ArmL (상체: rotY = facing) ───
      setPartMatrix(armLMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.armL.offset[0], P.armL.offset[1], P.armL.offset[2],
        anim.armL.rotX + rollX, 0, anim.armL.rotZ,
        0, 0, 0, 1, 1, worldY);
      armLMesh.setColorAt(limbIdx, isFlashing ? _whiteColor : _color.set(topColorHex));

      // ─── ArmR (상체: rotY = facing) ───
      setPartMatrix(armRMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.armR.offset[0], P.armR.offset[1], P.armR.offset[2],
        anim.armR.rotX + rollX, 0, anim.armR.rotZ,
        0, 0, 0, 1, 1, worldY);
      armRMesh.setColorAt(limbIdx, isFlashing ? _whiteColor : _color.set(topColorHex));

      // ─── LegL (하체: rotY = facing + lowerTwist) ───
      setPartMatrix(legLMesh, limbIdx, worldX, worldZ, rotY + lowerTwist, scale,
        P.legL.offset[0], P.legL.offset[1], P.legL.offset[2],
        anim.legL.rotX + rollX, 0, 0,
        0, 0, 0, 1, 1, worldY);
      legLMesh.setColorAt(limbIdx, isFlashing ? _whiteColor : _color.set(bottomColorHex));

      // ─── LegR (하체: rotY = facing + lowerTwist) ───
      setPartMatrix(legRMesh, limbIdx, worldX, worldZ, rotY + lowerTwist, scale,
        P.legR.offset[0], P.legR.offset[1], P.legR.offset[2],
        anim.legR.rotX + rollX, 0, 0,
        0, 0, 0, 1, 1, worldY);
      legRMesh.setColorAt(limbIdx, isFlashing ? _whiteColor : _color.set(bottomColorHex));

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

      {/* Eyes: EyeInstances (눈 깜빡임 & 표정 오버레이 — Phase 6) */}
      <EyeInstances
        agentsRef={agentsRef}
        stateMachineRef={stateMachineRef}
        agentIndexMapRef={agentIndexMapRef}
      />
    </group>
  );
}
