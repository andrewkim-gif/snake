'use client';

/**
 * AgentInstances — 큐블링(Cubeling) 캐릭터 InstancedMesh 일괄 렌더링
 *
 * Phase 2 변경사항: Color-Tint 머티리얼 시스템
 * - dominant skin 방식 → 인스턴스별 setColorAt() 고유 색상
 * - body: 패턴별 4 InstancedMesh 그룹핑 (solid/striped/dotted/gradient)
 * - arm/leg: 단일 IM + setColorAt (패턴 표현 불필요)
 * - head: HeadGroupManager로 분리 (얼굴 조합별 동적 IM)
 * - material.color = white(0xFFFFFF) → setColorAt이 100% 색상 결정
 * - skin-migration.ts의 resolveAppearance()로 기존 skinId 지원 유지
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
import { HeadGroupManager } from './HeadGroupManager';
import { VIVID_PALETTE } from '@agent-survivor/shared';
import type { AgentNetworkData, CubelingAppearance } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_AGENTS = 60;
const PI2 = Math.PI * 2;

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
 * Agent의 속도 기반 애니메이션 상태에서 팔/다리 rotation 계산
 * Phase 2: 기존 로직 유지 (큐블링 프로포션에서 시각적으로 더 귀여운 바운스)
 */
function computePartRotations(
  velocity: number,
  boosting: boolean,
  elapsed: number,
): { armLX: number; armRX: number; legLX: number; legRX: number } {
  // idle: 미세 흔들림 (±3°, 0.8Hz)
  if (velocity < 5 && !boosting) {
    const idleSwing = Math.sin(elapsed * 0.8 * PI2) * 0.05;
    return {
      armLX: idleSwing,
      armRX: -idleSwing,
      legLX: -idleSwing,
      legRX: idleSwing,
    };
  }

  // 큐블링 짧은 팔/다리 → 스윙 진폭 0.44 rad ≈ 25°
  const walkFreq = Math.min(velocity / 80, 3.5);
  const walkAmp = 0.44;

  if (boosting) {
    const legSwing = Math.sin(elapsed * walkFreq * 2 * PI2) * walkAmp * 1.3;
    return {
      armLX: -1.05,
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
  _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, headingRotY);
  _pos.set(offsetX * scale, offsetY * scale, offsetZ * scale);
  _pos.applyQuaternion(_qAgent);
  _obj.position.set(agentWorldX + _pos.x, _pos.y, agentWorldZ + _pos.z);
  _qPart.setFromEuler(_euler.set(partRotX, 0, 0));
  _qCombined.copy(_qAgent).multiply(_qPart);
  _obj.quaternion.copy(_qCombined);
  _obj.scale.setScalar(scale);
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
    };
  }, [geometries, bodyMaterials, limbMaterials]);

  // ─── useFrame: 매 프레임 body/arm/leg matrix + color 업데이트 ───
  useFrame((_, delta) => {
    const agents = agentsRef.current;
    const elapsed = elapsedRef.current;

    const armLMesh = armLRef.current;
    const armRMesh = armRRef.current;
    const legLMesh = legLRef.current;
    const legRMesh = legRRef.current;

    if (!armLMesh || !armRMesh || !legLMesh || !legRMesh) return;

    // Body 패턴별 IM 참조 + 패턴별 에이전트 인덱스 추적
    const bodyMeshes: (THREE.InstancedMesh | null)[] = bodyRefs.current;
    const bodyIndices: number[] = new Array(BODY_PATTERN_COUNT).fill(0); // 패턴별 현재 인덱스

    const P = CUBELING_PARTS;
    let limbIdx = 0;

    // ─── 색상 업데이트가 필요한지 추적 ───
    let anyColorUpdated = false;

    for (const agent of agents) {
      if (limbIdx >= MAX_AGENTS) break;

      const { x, y, h, m, b: boosting, k: skinId, i: id } = agent;

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

      // ─── 월드 좌표 + 스케일 ───
      const [worldX, , worldZ] = toWorld(x, y, 0);
      const rotY = headingToRotY(h);
      const scale = getAgentScale(m);

      // ─── 애니메이션 ───
      const anim = computePartRotations(motion.velocity, boosting, elapsed);

      // ─── Body: 패턴별 IM에 할당 ───
      // 패턴 0~3만 분리, 4~7은 solid(0)에 할당
      const patternGroup = appearance.pattern < BODY_PATTERN_COUNT ? appearance.pattern : 0;
      const bodyMesh = bodyMeshes[patternGroup];
      if (bodyMesh) {
        const bodyIdx = bodyIndices[patternGroup];
        setPartMatrix(bodyMesh, bodyIdx, worldX, worldZ, rotY, scale,
          P.body.offset[0], P.body.offset[1], P.body.offset[2], 0);

        // body 색상 = topColor
        const topColorHex = VIVID_PALETTE[appearance.topColor % VIVID_PALETTE.length];
        _color.set(topColorHex);
        bodyMesh.setColorAt(bodyIdx, _color);

        bodyIndices[patternGroup] = bodyIdx + 1;
        anyColorUpdated = true;
      }

      // ─── ArmL ───
      setPartMatrix(armLMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.armL.offset[0], P.armL.offset[1], P.armL.offset[2], anim.armLX);
      // arm 색상 = topColor (소매)
      _color.set(VIVID_PALETTE[appearance.topColor % VIVID_PALETTE.length]);
      armLMesh.setColorAt(limbIdx, _color);

      // ─── ArmR ───
      setPartMatrix(armRMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.armR.offset[0], P.armR.offset[1], P.armR.offset[2], anim.armRX);
      armRMesh.setColorAt(limbIdx, _color);

      // ─── LegL ───
      setPartMatrix(legLMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.legL.offset[0], P.legL.offset[1], P.legL.offset[2], anim.legLX);
      // leg 색상 = bottomColor
      _color.set(VIVID_PALETTE[appearance.bottomColor % VIVID_PALETTE.length]);
      legLMesh.setColorAt(limbIdx, _color);

      // ─── LegR ───
      setPartMatrix(legRMesh, limbIdx, worldX, worldZ, rotY, scale,
        P.legR.offset[0], P.legR.offset[1], P.legR.offset[2], anim.legRX);
      legRMesh.setColorAt(limbIdx, _color);

      limbIdx++;
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

      {/* Head: HeadGroupManager (얼굴 조합별 동적 IM) */}
      <HeadGroupManager
        agentsRef={agentsRef}
        elapsedRef={elapsedRef}
        resolveAppearanceFn={getCachedAppearance}
      />
    </group>
  );
}
