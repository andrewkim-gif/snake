'use client';

/**
 * HeadGroupManager — 얼굴(눈+입) 조합별 동적 InstancedMesh 관리
 *
 * 전략:
 * - 같은 얼굴 조합(eyeStyle + mouthStyle)을 공유하는 에이전트를 1개 InstancedMesh에 그룹핑
 * - 머리카락/피부톤은 setColorAt()으로 인스턴스별 차별화
 * - 새 얼굴 조합 등장 시 IM 동적 생성, 미사용 30초 후 dispose
 * - 최대 ~12 활성 그룹 예상 (60명 중 다수가 같은 얼굴 공유)
 *
 * 6-face material array: [+X=right, -X=left, +Y=top, -Y=bottom, +Z=front(얼굴), -Z=back]
 * material.color = white → setColorAt()이 최종 색상 결정
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { textureCacheManager } from '@/lib/3d/cubeling-textures';
import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions';
import { toWorld, headingToRotY, getAgentScale } from '@/lib/3d/coordinate-utils';
import type { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import { SKIN_TONES, HAIR_COLORS } from '@agent-survivor/shared';
import type { AgentNetworkData, CubelingAppearance, FaceKey } from '@agent-survivor/shared';

// ─── 상수 ───

const MAX_AGENTS = 60;
/** 미사용 그룹 dispose 대기 시간 (ms) */
const DISPOSE_TIMEOUT = 30_000;

// ─── 재사용 임시 객체 ───

const _obj = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _qAgent = new THREE.Quaternion();
const _qPart = new THREE.Quaternion();
const _qCombined = new THREE.Quaternion();
const _color = new THREE.Color();
const _hairColor = new THREE.Color();

// ─── 얼굴 그룹 데이터 ───

interface FaceGroup {
  /** 이 얼굴 조합의 InstancedMesh */
  mesh: THREE.InstancedMesh;
  /** 6-material 배열 (각 face) */
  materials: THREE.MeshLambertMaterial[];
  /** 마지막으로 이 그룹에 에이전트가 할당된 시각 */
  lastUsedTime: number;
  /** 이 프레임에서 할당된 에이전트 수 */
  count: number;
}

// ─── Props ───

interface HeadGroupManagerProps {
  /** 보간된 Agent 배열 (GameLoop에서 업데이트) */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 경과 시간 ref (초 단위 누적) */
  elapsedRef: React.MutableRefObject<number>;
  /** appearance 해석 함수 (skinId, agentId?) */
  resolveAppearanceFn: (skinId: number, agentId?: string) => CubelingAppearance;
  /** 애니메이션 상태 머신 ref (head 변환 적용) */
  stateMachineRef: React.MutableRefObject<AnimationStateMachine | null>;
  /** 에이전트 ID → 상태 머신 인덱스 매핑 */
  agentIndexMapRef: React.MutableRefObject<Map<string, number>>;
}

// ─── Component ───

export function HeadGroupManager({
  agentsRef,
  elapsedRef,
  resolveAppearanceFn,
  stateMachineRef,
  agentIndexMapRef,
}: HeadGroupManagerProps) {
  const groupRef = useRef<THREE.Group>(null!);

  // ─── 얼굴 그룹 풀 (동적 관리) ───
  const faceGroupsRef = useRef<Map<string, FaceGroup>>(new Map());

  // ─── Head Geometry (한 번만 생성) ───
  const headGeo = useMemo(() => {
    return new THREE.BoxGeometry(...CUBELING_PARTS.head.size);
  }, []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      faceGroupsRef.current.forEach(group => {
        group.mesh.dispose();
        group.materials.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      });
      faceGroupsRef.current.clear();
      headGeo.dispose();
      textureCacheManager.dispose();
    };
  }, [headGeo]);

  // ─── useFrame: 매 프레임 head 그룹 업데이트 ───
  useFrame(() => {
    const agents = agentsRef.current;
    const parentGroup = groupRef.current;
    if (!parentGroup) return;

    const faceGroups = faceGroupsRef.current;
    const now = performance.now();

    // Phase 1: 모든 그룹 count를 0으로 리셋
    faceGroups.forEach(g => { g.count = 0; });

    // Phase 2: 에이전트별 faceKey 수집 및 그룹 할당
    // headGroupKey → 에이전트 인덱스 목록
    // Phase 3: hairStyle 포함한 확장 키 (눈+입+헤어스타일 조합별 IM 그룹핑)
    const faceKeyAgents = new Map<string, Array<{ agent: AgentNetworkData; appearance: CubelingAppearance }>>();

    let agentCount = 0;
    for (const agent of agents) {
      if (agentCount >= MAX_AGENTS) break;
      const appearance = resolveAppearanceFn(agent.k, agent.i);
      // Phase 3: faceKey에 hairStyle 포함 (같은 얼굴+헤어만 같은 IM 공유)
      const headGroupKey = `${appearance.eyeStyle}-${appearance.mouthStyle}-h${appearance.hairStyle}`;

      let list = faceKeyAgents.get(headGroupKey);
      if (!list) {
        list = [];
        faceKeyAgents.set(headGroupKey, list);
      }
      list.push({ agent, appearance });
      agentCount++;
    }

    // Phase 3: 얼굴 그룹별 InstancedMesh 업데이트
    for (const [faceKey, agentList] of faceKeyAgents) {
      let group = faceGroups.get(faceKey);

      // 새 얼굴+헤어 조합 → IM 동적 생성
      if (!group) {
        const firstAppearance = agentList[0].appearance;
        // Phase 3: faceKey는 캐시 내부에서 확장키 사용, hairStyle 전달
        const baseFaceKey: FaceKey = `${firstAppearance.eyeStyle}-${firstAppearance.mouthStyle}`;
        const materials = textureCacheManager.getFaceMaterials(
          baseFaceKey,
          firstAppearance.eyeStyle,
          firstAppearance.mouthStyle,
          firstAppearance.marking,
          firstAppearance.hairStyle,
        );
        const mesh = new THREE.InstancedMesh(headGeo, materials, MAX_AGENTS);
        mesh.frustumCulled = false;
        // instanceColor를 초기화
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(MAX_AGENTS * 3), 3,
        );
        parentGroup.add(mesh);

        group = {
          mesh,
          materials,
          lastUsedTime: now,
          count: 0,
        };
        faceGroups.set(faceKey, group);
      }

      // 에이전트 매트릭스 + 색상 설정
      let idx = 0;
      const sm = stateMachineRef.current;
      const indexMap = agentIndexMapRef.current;

      for (const { agent, appearance } of agentList) {
        if (idx >= MAX_AGENTS) break;

        const { x, y, h, f, m, i: id } = agent;
        // v16: character faces aim direction (f), fallback to heading (h)
        const facing = f ?? h;

        const [worldX, , worldZ] = toWorld(x, y, 0);
        const rotY = headingToRotY(facing);
        const scale = getAgentScale(m);
        const P = CUBELING_PARTS.head;

        // ─── head 애니메이션 변환 조회 ───
        let headRotX = 0;
        let headRotY = 0;
        let headRotZ = 0;
        let headPosX = 0;
        let headPosY = 0;
        let headPosZ = 0;
        let headScaleX = 1;
        let headScaleY = 1;

        if (sm && indexMap) {
          const smIdx = indexMap.get(id);
          if (smIdx !== undefined && sm.isActive(smIdx)) {
            const transforms = sm.getTransforms(smIdx, 0, false);
            headRotX = transforms.head.rotX;
            headRotY = transforms.head.rotY;
            headRotZ = transforms.head.rotZ;
            headPosX = transforms.head.posX;
            headPosY = transforms.head.posY;
            headPosZ = transforms.head.posZ;
            headScaleX = transforms.head.scaleX;
            headScaleY = transforms.head.scaleY;
          }
        }

        // heading quaternion
        _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY);

        // head 오프셋 + 애니메이션 위치를 에이전트 로컬 좌표로
        _pos.set(
          (P.offset[0] + headPosX) * scale,
          (P.offset[1] + headPosY) * scale,
          (P.offset[2] + headPosZ) * scale,
        );
        _pos.applyQuaternion(_qAgent);

        _obj.position.set(worldX + _pos.x, _pos.y, worldZ + _pos.z);

        // head 로컬 회전 (X → Y → Z)
        _qPart.setFromEuler(_euler.set(headRotX, headRotY, headRotZ));
        _qCombined.copy(_qAgent).multiply(_qPart);
        _obj.quaternion.copy(_qCombined);

        _obj.scale.set(scale * headScaleX, scale * headScaleY, scale);
        _obj.updateMatrix();

        group.mesh.setMatrixAt(idx, _obj.matrix);

        // 색상: 피부톤 + 머리색 블렌딩
        // _qPart를 재사용하지 않으므로 여기서 _color2(임시)를 사용
        const skinToneHex = SKIN_TONES[appearance.skinTone % SKIN_TONES.length];
        const hairColorHex = HAIR_COLORS[appearance.hairColor % HAIR_COLORS.length];
        // 피부톤 70% + 머리색 30% (자연스러운 블렌딩)
        _color.set(skinToneHex);
        _color.lerp(_hairColor.set(hairColorHex), 0.3);
        group.mesh.setColorAt(idx, _color);

        idx++;
      }

      group.count = idx;
      group.mesh.count = idx;
      group.lastUsedTime = now;
      group.mesh.instanceMatrix.needsUpdate = true;
      if (group.mesh.instanceColor) {
        group.mesh.instanceColor.needsUpdate = true;
      }
    }

    // Phase 4: 미사용 그룹 처리
    // count=0인 그룹 → IM 숨김 (count=0으로 draw skip)
    // 30초 이상 미사용 → dispose
    const toDelete: string[] = [];
    faceGroups.forEach((group, key) => {
      if (!faceKeyAgents.has(key)) {
        group.mesh.count = 0;
        if (now - group.lastUsedTime > DISPOSE_TIMEOUT) {
          parentGroup.remove(group.mesh);
          group.mesh.dispose();
          group.materials.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
          toDelete.push(key);
        }
      }
    });
    for (const key of toDelete) {
      faceGroups.delete(key);
    }

    // Phase 5: 주기적 텍스처 캐시 정리 (매 300프레임)
    if (Math.random() < 0.003) {
      textureCacheManager.cleanup();
    }
  });

  return <group ref={groupRef} />;
}
