'use client';

/**
 * EyeInstances — 눈 깜빡임 & 표정 시스템 (Phase 6)
 *
 * 전략: "오버레이" 방식
 * - 기본 상태: HeadGroupManager의 얼굴 텍스처에 그려진 눈이 표시됨
 * - 깜빡임/표정 변화 시: EyeInstances가 머리 앞면 위에 오버레이
 *   → closedEyesMesh: 닫힌 눈 (깜빡임 중 표시)
 *   → 표정별 IM (5종): HIT/DEATH/LEVELUP/VICTORY/BOOST 각각 별도 IM
 *
 * 구현:
 * - PlaneGeometry로 머리 앞면(+X) 바로 앞에 배치
 * - polygonOffset + 미세 Z-offset으로 Z-fighting 방지
 * - 에이전트별 비동기 깜빡임 (3~5초 랜덤 간격, 0.15초 duration)
 * - AnimState에 따른 표정 오버라이드 (표정 중에는 깜빡임 억제)
 *
 * draw call: +6 (closedEyes + 5 expression types)
 * ※ 미사용 IM은 count=0 → GPU 스킵으로 실질 비용 없음
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CUBELING_PARTS } from '@/lib/3d/cubeling-proportions';
import { toWorld, headingToRotY, getAgentScale } from '@/lib/3d/coordinate-utils';
import {
  generateClosedEyeTexture,
  generateExpressionEyeTexture,
} from '@/lib/3d/cubeling-textures';
import { AnimState } from '@agent-survivor/shared';
import type { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import type { AgentNetworkData } from '@agent-survivor/shared';

// ─── 상수 ───

const MAX_AGENTS = 60;

/** 깜빡임 duration (초) */
const BLINK_DURATION = 0.15;
/** 깜빡임 최소 간격 (초) */
const BLINK_MIN_INTERVAL = 3.0;
/** 깜빡임 랜덤 추가 범위 (초) — 총 간격: 3~5초 */
const BLINK_RANDOM_RANGE = 2.0;

/**
 * 눈 플레인 크기 (게임 유닛)
 * 머리 앞면은 10(H) x 8(D)
 * 전체 머리 앞면과 동일 크기로 매핑 (텍스처 좌표로 눈 위치 결정)
 */
const EYE_PLANE_WIDTH = 8;   // 머리 앞면 너비 (Z축, depth=8)
const EYE_PLANE_HEIGHT = 10; // 머리 앞면 높이 (Y축, height=10)

/**
 * 눈 플레인 오프셋 (머리 앞면에서 살짝 앞으로)
 * 머리 BoxGeometry(10, 10, 8)에서 +X 면은 local x=+5
 * → 0.05 유닛 앞으로 offset하여 Z-fighting 최소화
 */
const EYE_FORWARD_OFFSET = 0.05;

/** 5종 표정 키 (순서 고정) */
const EXPRESSION_KEYS = ['hit', 'death', 'levelup', 'victory', 'boost'] as const;
type ExpressionKey = (typeof EXPRESSION_KEYS)[number];

// ─── 재사용 임시 객체 ───

const _obj = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _qAgent = new THREE.Quaternion();
const _qPart = new THREE.Quaternion();
const _qCombined = new THREE.Quaternion();

// ─── 깜빡임 상태 ───

interface BlinkState {
  /** 다음 깜빡임 시작까지 남은 시간 (초) */
  nextBlinkTime: number;
  /** 현재 깜빡이는 중 */
  isBlinking: boolean;
  /** 현재 깜빡임 경과 시간 (초) */
  blinkElapsed: number;
}

// ─── AnimState → 표정 키 매핑 ───

/** AnimState에 대응하는 표정 오버라이드 (null이면 기본 눈 유지) */
function getExpressionForState(state: AnimState): ExpressionKey | null {
  switch (state) {
    case AnimState.HIT: return 'hit';
    case AnimState.DEATH: return 'death';
    case AnimState.LEVELUP: return 'levelup';
    case AnimState.VICTORY: return 'victory';
    case AnimState.BOOST: return 'boost';
    default: return null;
  }
}

// ─── Props ───

interface EyeInstancesProps {
  /** 보간된 Agent 배열 */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  /** 애니메이션 상태 머신 ref */
  stateMachineRef: React.MutableRefObject<AnimationStateMachine | null>;
  /** 에이전트 ID → 상태 머신 인덱스 매핑 */
  agentIndexMapRef: React.MutableRefObject<Map<string, number>>;
}

// ─── Component ───

export function EyeInstances({
  agentsRef,
  stateMachineRef,
  agentIndexMapRef,
}: EyeInstancesProps) {
  // ─── Refs ───
  const closedRef = useRef<THREE.InstancedMesh>(null!);
  // 표정별 IM refs (5종: hit, death, levelup, victory, boost)
  const exprRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null, null, null]);

  // ─── 깜빡임 상태 배열 (에이전트별) ───
  const blinkStates = useRef<BlinkState[]>([]);

  // 초기화: MAX_AGENTS개 BlinkState
  if (blinkStates.current.length === 0) {
    for (let i = 0; i < MAX_AGENTS; i++) {
      blinkStates.current.push({
        // 에이전트별 랜덤 초기 간격 (0~5초 분산 → 동시 깜빡임 방지)
        nextBlinkTime: Math.random() * (BLINK_MIN_INTERVAL + BLINK_RANDOM_RANGE),
        isBlinking: false,
        blinkElapsed: 0,
      });
    }
  }

  // ─── Geometry: 머리 앞면 크기의 PlaneGeometry ───
  const eyePlaneGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(EYE_PLANE_WIDTH, EYE_PLANE_HEIGHT);
    // rotateY(-PI/2): 법선이 +X를 향함 (머리 앞면 방향)
    geo.rotateY(-Math.PI / 2);

    // UV 수평 반전: BoxGeometry +X face와 UV 방향 매칭
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;

    return geo;
  }, []);

  // ─── Materials ───
  const closedEyeMat = useMemo(() => {
    const tex = generateClosedEyeTexture();
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.FrontSide,
    });
  }, []);

  // 표정별 material (5종, 순서 = EXPRESSION_KEYS)
  const expressionMats = useMemo(() => {
    return EXPRESSION_KEYS.map(key => {
      const tex = generateExpressionEyeTexture(key);
      return new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.FrontSide,
      });
    });
  }, []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      eyePlaneGeo.dispose();
      closedEyeMat.dispose();
      if (closedEyeMat.map) closedEyeMat.map.dispose();
      for (const mat of expressionMats) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    };
  }, [eyePlaneGeo, closedEyeMat, expressionMats]);

  // ─── useFrame: 깜빡임 + 표정 업데이트 ───
  useFrame((_, delta) => {
    const agents = agentsRef.current;
    const sm = stateMachineRef.current;
    const indexMap = agentIndexMapRef.current;
    const closedMesh = closedRef.current;

    if (!closedMesh || !sm) return;

    const blinks = blinkStates.current;
    const P = CUBELING_PARTS.head;
    const headHalfW = P.size[0] / 2; // 5

    let closedCount = 0;
    // 표정별 인스턴스 카운트 (5종)
    const exprCounts = [0, 0, 0, 0, 0];

    let agentIdx = 0;
    for (const agent of agents) {
      if (agentIdx >= MAX_AGENTS) break;

      const { x, y, h, m, i: id } = agent;
      const smIdx = indexMap.get(id);

      // 월드 좌표
      const [worldX, , worldZ] = toWorld(x, y, 0);
      const rotY = headingToRotY(h);
      const scale = getAgentScale(m);

      // ─── head 애니메이션 변환 조회 ───
      let headRotX = 0;
      let headRotY = 0;
      let headRotZ = 0;
      let headPosX = 0;
      let headPosY = 0;
      let headPosZ = 0;
      let headScaleX = 1;
      let headScaleY = 1;

      let animState = AnimState.IDLE;

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

        const stateInfo = sm.getState(smIdx);
        if (stateInfo) {
          animState = stateInfo.state;
        }
      }

      // ─── 표정 오버라이드 판정 ───
      const exprKey = getExpressionForState(animState);
      // 표정 인덱스 (-1이면 표정 없음)
      const exprIdx = exprKey !== null ? EXPRESSION_KEYS.indexOf(exprKey) : -1;
      const hasExpression = exprIdx >= 0;

      // ─── 깜빡임 로직 (표정 오버라이드 없을 때만) ───
      const blink = blinks[agentIdx];
      let showClosed = false;

      if (!hasExpression && blink) {
        blink.nextBlinkTime -= delta;

        if (blink.isBlinking) {
          blink.blinkElapsed += delta;
          if (blink.blinkElapsed >= BLINK_DURATION) {
            // 깜빡임 완료
            blink.isBlinking = false;
            blink.blinkElapsed = 0;
            blink.nextBlinkTime = BLINK_MIN_INTERVAL + Math.random() * BLINK_RANDOM_RANGE;
          } else {
            showClosed = true;
          }
        } else if (blink.nextBlinkTime <= 0) {
          // 깜빡임 시작
          blink.isBlinking = true;
          blink.blinkElapsed = 0;
          showClosed = true;
        }
      } else if (blink) {
        // 표정 오버라이드 중: 깜빡임 타이머 일시정지
        blink.isBlinking = false;
        blink.blinkElapsed = 0;
        if (blink.nextBlinkTime < 1.0) {
          blink.nextBlinkTime = 1.0 + Math.random() * BLINK_RANDOM_RANGE;
        }
      }

      // ─── 오버레이 배치: 머리 앞면 위치 계산 ───
      if (showClosed || hasExpression) {
        // 에이전트 heading quaternion
        _qAgent.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY);

        // 눈 플레인 위치: 머리 중심 + 앞면 half + 미세 offset
        _pos.set(
          (P.offset[0] + headPosX + headHalfW + EYE_FORWARD_OFFSET) * scale,
          (P.offset[1] + headPosY) * scale,
          (P.offset[2] + headPosZ) * scale,
        );
        _pos.applyQuaternion(_qAgent);

        _obj.position.set(worldX + _pos.x, _pos.y, worldZ + _pos.z);

        // head 로컬 회전 적용
        _qPart.setFromEuler(_euler.set(headRotX, headRotY, headRotZ));
        _qCombined.copy(_qAgent).multiply(_qPart);
        _obj.quaternion.copy(_qCombined);

        _obj.scale.set(scale * headScaleX, scale * headScaleY, scale);
        _obj.updateMatrix();

        if (showClosed) {
          closedMesh.setMatrixAt(closedCount, _obj.matrix);
          closedCount++;
        }

        if (hasExpression) {
          const mesh = exprRefs.current[exprIdx];
          if (mesh) {
            mesh.setMatrixAt(exprCounts[exprIdx], _obj.matrix);
            exprCounts[exprIdx]++;
          }
        }
      }

      agentIdx++;
    }

    // ─── 카운트 업데이트 + needsUpdate ───
    closedMesh.count = closedCount;
    if (closedCount > 0) {
      closedMesh.instanceMatrix.needsUpdate = true;
    }

    for (let i = 0; i < EXPRESSION_KEYS.length; i++) {
      const mesh = exprRefs.current[i];
      if (mesh) {
        mesh.count = exprCounts[i];
        if (exprCounts[i] > 0) {
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  });

  return (
    <group>
      {/* 닫힌 눈 오버레이 (깜빡임 시 활성화) */}
      <instancedMesh
        ref={closedRef}
        args={[eyePlaneGeo, closedEyeMat, MAX_AGENTS]}
        frustumCulled={false}
      />
      {/* 표정별 눈 오버레이 (5종 — count=0이면 GPU 스킵) */}
      {EXPRESSION_KEYS.map((key, idx) => (
        <instancedMesh
          key={`eye-expr-${key}`}
          ref={(el: THREE.InstancedMesh | null) => { exprRefs.current[idx] = el; }}
          args={[eyePlaneGeo, expressionMats[idx], MAX_AGENTS]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
