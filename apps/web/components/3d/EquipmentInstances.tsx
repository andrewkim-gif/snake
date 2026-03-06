'use client';

/**
 * EquipmentInstances — 장비(모자/무기/등) InstancedMesh 렌더링
 *
 * Phase 5: 장비 & 액세서리 시스템
 *
 * 장비 형태별 InstancedMesh 관리:
 *   모자 3 IM: helmet, hat, crown (형태가 다르므로 별도 geometry)
 *   무기 2 IM: blade, staff
 *   등   3 IM: cape, wings, pack
 *   총 8 IM (draw call +8)
 *
 * 부착점 연산:
 *   부모 파트의 월드 위치/회전 + 로컬 오프셋 = 장비 월드 위치
 *   매 프레임 업데이트 (부모 파트 애니메이션 추종)
 *
 * 미착용 에이전트: scale = (0,0,0) 매트릭스로 숨김 처리
 * IM.count = MAX_AGENTS 고정 (동적 count 변경보다 성능 안정)
 *
 * 등 아이템 물리:
 *   cape  — 속도 기반 X축 회전 (펄럭임)
 *   wings — 사인 웨이브 날갯짓
 *   pack  — 고정 (회전 없음)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  generateHatTexture,
  generateWeaponTexture,
  generateBackItemTexture,
} from '@/lib/3d/cubeling-textures';
import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions';
import { toWorld, headingToRotY, getAgentScale } from '@/lib/3d/coordinate-utils';
import { resolveAppearance } from '@/lib/3d/skin-migration';
import {
  EQUIPMENT_GEOMETRIES,
  ATTACH_POINTS,
  AttachPointName,
  getHatDef,
  getWeaponDef,
  getBackItemDef,
  BACK_ITEM_PHYSICS,
} from '@/lib/3d/equipment-data';
import type { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import type { AgentNetworkData, CubelingAppearance } from '@agent-survivor/shared';

// ─── 상수 ───

const MAX_AGENTS = 60;

/** 장비 형태 ID 목록 (IM 1개씩 생성) */
const HAT_GEOMETRY_TYPES = ['helmet', 'hat', 'crown'] as const;
const WEAPON_GEOMETRY_TYPES = ['blade', 'staff'] as const;
const BACK_GEOMETRY_TYPES = ['cape', 'wings', 'pack'] as const;

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _qAgent = new THREE.Quaternion();
const _qPart = new THREE.Quaternion();
const _qCombined = new THREE.Quaternion();
const _color = new THREE.Color();

// ─── 속도 캐시 (AgentInstances에서 관리하지만 여기서도 참조) ───
const velocityCache = new Map<string, { prevX: number; prevY: number; velocity: number }>();

// ─── appearance 캐시 ───
const eqAppearanceCache = new Map<number, CubelingAppearance>();
function getCachedAppearance(skinId: number): CubelingAppearance {
  let cached = eqAppearanceCache.get(skinId);
  if (cached) return cached;
  cached = resolveAppearance(skinId);
  eqAppearanceCache.set(skinId, cached);
  return cached;
}

// ─── Props ───

interface EquipmentInstancesProps {
  /** 보간된 Agent 배열 (GameLoop에서 업데이트) */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 경과 시간 ref (초 단위 누적) */
  elapsedRef: React.MutableRefObject<number>;
  /** 애니메이션 상태 머신 ref (파트 변환 참조) */
  stateMachineRef: React.MutableRefObject<AnimationStateMachine | null>;
  /** 에이전트 ID → 상태 머신 인덱스 매핑 */
  agentIndexMapRef: React.MutableRefObject<Map<string, number>>;
}

// ─── 파트 매트릭스 계산 헬퍼 ───

/**
 * 부모 파트의 월드 위치 + 로컬 오프셋 → 장비 월드 위치/회전 계산
 * AgentInstances의 setPartMatrix와 동일한 방식으로 부모 파트 위치를 재계산
 */
function computeEquipmentMatrix(
  mesh: THREE.InstancedMesh,
  idx: number,
  agentWorldX: number,
  agentWorldZ: number,
  headingRotY: number,
  agentScale: number,
  // 부모 파트 기본 오프셋
  parentOffsetX: number,
  parentOffsetY: number,
  parentOffsetZ: number,
  // 부모 파트 애니메이션 회전
  parentRotX: number,
  parentRotY: number,
  parentRotZ: number,
  // 부모 파트 애니메이션 위치 오프셋
  parentAnimPosX: number,
  parentAnimPosY: number,
  parentAnimPosZ: number,
  // 장비 로컬 오프셋 (부착점)
  attachLocalX: number,
  attachLocalY: number,
  attachLocalZ: number,
  // 장비 추가 회전 (등 아이템 물리 등)
  equipRotX: number,
  equipRotY: number,
  equipRotZ: number,
): void {
  // 에이전트 heading 쿼터니언
  _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, headingRotY);

  // 1단계: 부모 파트의 에이전트-로컬 위치 계산
  _pos.set(
    (parentOffsetX + parentAnimPosX) * agentScale,
    (parentOffsetY + parentAnimPosY) * agentScale,
    (parentOffsetZ + parentAnimPosZ) * agentScale,
  );
  _pos.applyQuaternion(_qAgent);

  const parentWorldX = agentWorldX + _pos.x;
  const parentWorldY = _pos.y;
  const parentWorldZ = agentWorldZ + _pos.z;

  // 2단계: 부모 파트 회전 쿼터니언
  _qPart.setFromEuler(_euler.set(parentRotX, parentRotY, parentRotZ));
  const parentWorldQ = _qCombined.copy(_qAgent).multiply(_qPart);

  // 3단계: 장비 로컬 오프셋을 부모 파트 회전에 적용
  _pos.set(
    attachLocalX * agentScale,
    attachLocalY * agentScale,
    attachLocalZ * agentScale,
  );
  _pos.applyQuaternion(parentWorldQ);

  // 4단계: 최종 장비 위치
  _obj.position.set(
    parentWorldX + _pos.x,
    parentWorldY + _pos.y,
    parentWorldZ + _pos.z,
  );

  // 5단계: 장비 자체 회전 (부모 회전 + 장비 로컬 회전)
  // NOTE: _qPart를 재사용하여 GC 방지 (parentWorldQ는 이미 _qCombined에 저장됨)
  _qPart.setFromEuler(_euler.set(equipRotX, equipRotY, equipRotZ));
  _obj.quaternion.copy(parentWorldQ).multiply(_qPart);

  _obj.scale.setScalar(agentScale);
  _obj.updateMatrix();
  mesh.setMatrixAt(idx, _obj.matrix);
}

// ─── Component ───

export function EquipmentInstances({
  agentsRef,
  elapsedRef,
  stateMachineRef,
  agentIndexMapRef,
}: EquipmentInstancesProps) {

  // ─── IM Refs: 모자 3 + 무기 2 + 등 3 = 8 IM ───
  const hatRefs = useRef<Record<string, THREE.InstancedMesh | null>>({
    helmet: null, hat: null, crown: null,
  });
  const weaponRefs = useRef<Record<string, THREE.InstancedMesh | null>>({
    blade: null, staff: null,
  });
  const backRefs = useRef<Record<string, THREE.InstancedMesh | null>>({
    cape: null, wings: null, pack: null,
  });

  // ─── Geometry (한 번만 생성) ───
  const geometries = useMemo(() => {
    const geos: Record<string, THREE.BoxGeometry> = {};
    for (const [key, spec] of Object.entries(EQUIPMENT_GEOMETRIES)) {
      geos[key] = new THREE.BoxGeometry(...spec.size);
    }
    return geos;
  }, []);

  // ─── Material (흰색 base — setColorAt으로 틴팅) ───
  const materials = useMemo(() => {
    const mats: Record<string, THREE.MeshLambertMaterial> = {};

    // 모자
    for (const geoType of HAT_GEOMETRY_TYPES) {
      const tex = generateHatTexture(geoType);
      mats[geoType] = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    }
    // 무기
    for (const geoType of WEAPON_GEOMETRY_TYPES) {
      const tex = generateWeaponTexture(geoType);
      mats[geoType] = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    }
    // 등
    for (const geoType of BACK_GEOMETRY_TYPES) {
      const tex = generateBackItemTexture(geoType);
      mats[geoType] = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    }

    return mats;
  }, []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(g => g.dispose());
      Object.values(materials).forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
      velocityCache.clear();
      eqAppearanceCache.clear();
    };
  }, [geometries, materials]);

  // ─── useFrame: 매 프레임 장비 매트릭스 + 색상 업데이트 ───
  useFrame((_, delta) => {
    const agents = agentsRef.current;
    const elapsed = elapsedRef.current;
    const sm = stateMachineRef.current;
    const indexMap = agentIndexMapRef.current;

    if (!sm || !indexMap) return;

    // ─── 모바일 성능: 40+ 에이전트 시 장비 렌더링 간소화 ───
    const agentCount = agents.length;
    const skipEquipment = agentCount > 50; // 50+ 에이전트: 장비 완전 스킵
    if (skipEquipment) {
      // 모든 장비 IM count=0으로 설정하여 GPU 스킵
      for (const geoType of HAT_GEOMETRY_TYPES) {
        const mesh = hatRefs.current[geoType];
        if (mesh) mesh.count = 0;
      }
      for (const geoType of WEAPON_GEOMETRY_TYPES) {
        const mesh = weaponRefs.current[geoType];
        if (mesh) mesh.count = 0;
      }
      for (const geoType of BACK_GEOMETRY_TYPES) {
        const mesh = backRefs.current[geoType];
        if (mesh) mesh.count = 0;
      }
      return;
    }

    const P = CUBELING_PARTS;

    // 형태별 인덱스 추적
    const hatIndices: Record<string, number> = { helmet: 0, hat: 0, crown: 0 };
    const weaponIndices: Record<string, number> = { blade: 0, staff: 0 };
    const backIndices: Record<string, number> = { cape: 0, wings: 0, pack: 0 };

    // NOTE: 이전에는 매 프레임 모든 인스턴스를 hideInstance()로 초기화했으나,
    // 이제 count 기반으로 실제 사용 인스턴스만 설정하고 나머지는 GPU가 스킵

    let agentIdx = 0;
    for (const agent of agents) {
      if (agentIdx >= MAX_AGENTS) break;

      const { x, y, h, m, b: boosting, k: skinId, i: id } = agent;
      const appearance = getCachedAppearance(skinId);

      // 속도 추정
      let vel = velocityCache.get(id);
      if (!vel) {
        vel = { prevX: x, prevY: y, velocity: 0 };
        velocityCache.set(id, vel);
      }
      const dx = x - vel.prevX;
      const dy = y - vel.prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rawVel = delta > 0 ? dist / delta : 0;
      vel.velocity = vel.velocity * 0.7 + rawVel * 0.3;
      vel.prevX = x;
      vel.prevY = y;

      const [worldX, , worldZ] = toWorld(x, y, 0);
      const rotY = headingToRotY(h);
      const scale = getAgentScale(m);

      // 상태 머신에서 파트 변환 가져오기
      const smIdx = indexMap.get(id);
      let headRotX = 0, headRotY = 0, headRotZ = 0;
      let headPosX = 0, headPosY = 0, headPosZ = 0;
      let bodyRotX = 0, bodyRotY = 0, bodyRotZ = 0;
      let bodyPosX = 0, bodyPosY = 0, bodyPosZ = 0;
      let armRRotX = 0, armRRotZ = 0;

      if (smIdx !== undefined && sm.isActive(smIdx)) {
        const transforms = sm.getTransforms(smIdx, vel.velocity, boosting);
        headRotX = transforms.head.rotX;
        headRotY = transforms.head.rotY;
        headRotZ = transforms.head.rotZ;
        headPosX = transforms.head.posX;
        headPosY = transforms.head.posY;
        headPosZ = transforms.head.posZ;
        bodyRotX = transforms.body.rotX;
        bodyRotY = transforms.body.rotY;
        bodyRotZ = transforms.body.rotZ;
        bodyPosX = transforms.body.posX;
        bodyPosY = transforms.body.posY;
        bodyPosZ = transforms.body.posZ;
        armRRotX = transforms.armR.rotX;
        armRRotZ = transforms.armR.rotZ;
      }

      // ─── 모자 ───
      if (appearance.hat > 0) {
        const hatDef = getHatDef(appearance.hat);
        if (hatDef) {
          const geoType = hatDef.geometryType;
          const mesh = hatRefs.current[geoType];
          if (mesh) {
            const idx = hatIndices[geoType];
            if (idx < MAX_AGENTS) {
              const attachPt = ATTACH_POINTS[AttachPointName.HEAD_TOP];

              computeEquipmentMatrix(
                mesh, idx, worldX, worldZ, rotY, scale,
                // 부모(head) 오프셋
                P.head.offset[0], P.head.offset[1], P.head.offset[2],
                // 부모(head) 애니메이션 회전
                headRotX, headRotY, headRotZ,
                // 부모(head) 애니메이션 위치
                headPosX, headPosY, headPosZ,
                // 장비 로컬 오프셋
                attachPt.localOffset[0], attachPt.localOffset[1], attachPt.localOffset[2],
                // 장비 추가 회전 (없음)
                0, 0, 0,
              );

              // 색상 설정
              _color.set(hatDef.baseColor);
              mesh.setColorAt(idx, _color);

              hatIndices[geoType] = idx + 1;
            }
          }
        }
      }

      // ─── 무기 ───
      if (appearance.weapon > 0) {
        const weaponDef = getWeaponDef(appearance.weapon);
        if (weaponDef) {
          const geoType = weaponDef.geometryType;
          const mesh = weaponRefs.current[geoType];
          if (mesh) {
            const idx = weaponIndices[geoType];
            if (idx < MAX_AGENTS) {
              const attachPt = ATTACH_POINTS[AttachPointName.HAND_R];

              computeEquipmentMatrix(
                mesh, idx, worldX, worldZ, rotY, scale,
                // 부모(armR) 오프셋
                P.armR.offset[0], P.armR.offset[1], P.armR.offset[2],
                // 부모(armR) 애니메이션 회전 (shoulder pivot)
                armRRotX, 0, armRRotZ,
                // 부모 위치 오프셋 (팔은 별도 pos 없음)
                0, 0, 0,
                // 장비 로컬 오프셋
                attachPt.localOffset[0], attachPt.localOffset[1], attachPt.localOffset[2],
                // 장비 추가 회전 (없음)
                0, 0, 0,
              );

              // 색상 설정
              _color.set(weaponDef.baseColor);
              mesh.setColorAt(idx, _color);

              weaponIndices[geoType] = idx + 1;
            }
          }
        }
      }

      // ─── 등 아이템 ───
      if (appearance.backItem > 0) {
        const backDef = getBackItemDef(appearance.backItem);
        if (backDef) {
          const geoType = backDef.geometryType;
          const mesh = backRefs.current[geoType];
          if (mesh) {
            const idx = backIndices[geoType];
            if (idx < MAX_AGENTS) {
              const attachPt = ATTACH_POINTS[AttachPointName.BACK];

              // 등 아이템 물리 계산
              const physics = BACK_ITEM_PHYSICS[geoType];
              let equipRotX = 0;

              if (physics) {
                // 속도 기반 회전 (망토/날개 펄럭임)
                const velFactor = Math.min(vel.velocity * physics.velocityRotXFactor, physics.maxRotX);
                // 사인 웨이브 (미세 움직임)
                const wave = Math.sin(elapsed * physics.waveFrequency) * physics.waveAmplitude;
                equipRotX = velFactor + wave;

                // 부스트 시 효과 강화
                if (boosting && physics.boostScaleFactor > 1.0) {
                  equipRotX *= physics.boostScaleFactor;
                }
              }

              computeEquipmentMatrix(
                mesh, idx, worldX, worldZ, rotY, scale,
                // 부모(body) 오프셋
                P.body.offset[0], P.body.offset[1], P.body.offset[2],
                // 부모(body) 애니메이션 회전
                bodyRotX, bodyRotY, bodyRotZ,
                // 부모(body) 애니메이션 위치
                bodyPosX, bodyPosY, bodyPosZ,
                // 장비 로컬 오프셋
                attachPt.localOffset[0], attachPt.localOffset[1], attachPt.localOffset[2],
                // 장비 추가 회전 (등 아이템 물리)
                equipRotX, 0, 0,
              );

              // 색상 설정
              _color.set(backDef.baseColor);
              mesh.setColorAt(idx, _color);

              backIndices[geoType] = idx + 1;
            }
          }
        }
      }

      agentIdx++;
    }

    // ─── count 기반 렌더링: 실제 사용된 인스턴스만 draw ───
    // count=0인 IM은 GPU에서 완전히 스킵됨
    for (const geoType of HAT_GEOMETRY_TYPES) {
      const mesh = hatRefs.current[geoType];
      if (mesh) {
        const count = hatIndices[geoType];
        mesh.count = count;
        if (count > 0) {
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }
    }
    for (const geoType of WEAPON_GEOMETRY_TYPES) {
      const mesh = weaponRefs.current[geoType];
      if (mesh) {
        const count = weaponIndices[geoType];
        mesh.count = count;
        if (count > 0) {
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }
    }
    for (const geoType of BACK_GEOMETRY_TYPES) {
      const mesh = backRefs.current[geoType];
      if (mesh) {
        const count = backIndices[geoType];
        mesh.count = count;
        if (count > 0) {
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }
    }

    // 비활성 에이전트 속도 캐시 정리 (저빈도)
    if (Math.random() < 0.01) {
      const activeIds = new Set(agents.slice(0, MAX_AGENTS).map(a => a.i));
      for (const id of velocityCache.keys()) {
        if (!activeIds.has(id)) velocityCache.delete(id);
      }
    }
  });

  return (
    <group>
      {/* ─── 모자 InstancedMesh (3종) ─── */}
      {HAT_GEOMETRY_TYPES.map(geoType => (
        <instancedMesh
          key={`hat-${geoType}`}
          ref={(el: THREE.InstancedMesh | null) => { hatRefs.current[geoType] = el; }}
          args={[geometries[geoType], materials[geoType], MAX_AGENTS]}
          frustumCulled={false}
        />
      ))}

      {/* ─── 무기 InstancedMesh (2종) ─── */}
      {WEAPON_GEOMETRY_TYPES.map(geoType => (
        <instancedMesh
          key={`weapon-${geoType}`}
          ref={(el: THREE.InstancedMesh | null) => { weaponRefs.current[geoType] = el; }}
          args={[geometries[geoType], materials[geoType], MAX_AGENTS]}
          frustumCulled={false}
        />
      ))}

      {/* ─── 등 아이템 InstancedMesh (3종) ─── */}
      {BACK_GEOMETRY_TYPES.map(geoType => (
        <instancedMesh
          key={`back-${geoType}`}
          ref={(el: THREE.InstancedMesh | null) => { backRefs.current[geoType] = el; }}
          args={[geometries[geoType], materials[geoType], MAX_AGENTS]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
