/**
 * Interpolation — 서버 상태 보간 + 클라이언트 예측
 * v10: Snake 세그먼트 → Agent 단일 위치 보간
 */

import { ARENA_CONFIG } from '@agent-survivor/shared';
import { normalizeAngle, angleDiff, angleToVector } from '@agent-survivor/shared';
import type { AgentNetworkData } from '@agent-survivor/shared';

// 모듈 레벨 Map 재사용 — 매 프레임 new Map 생성 방지
const _prevMap = new Map<string, AgentNetworkData>();

/**
 * 서버 상태 보간: prevState와 latestState 사이의 Agent 위치를 보간
 * t: 0 = prevState, 1 = latestState, >1 = latestState 이후 외삽
 */
export function interpolateAgents(
  prevAgents: AgentNetworkData[] | null,
  curAgents: AgentNetworkData[],
  t: number,
): AgentNetworkData[] {
  if (!prevAgents || t >= 1) return curAgents;

  // Map 기반 O(1) lookup — 재사용
  _prevMap.clear();
  for (const a of prevAgents) _prevMap.set(a.i, a);

  return curAgents.map(cur => {
    const prev = _prevMap.get(cur.i);
    if (!prev) return cur; // 새 Agent → fade-in (현재값 그대로)

    // 위치 lerp 보간
    const x = prev.x + (cur.x - prev.x) * t;
    const y = prev.y + (cur.y - prev.y) * t;

    // heading 보간 (각도 lerp — 최단 경로)
    const headingDiff = angleDiff(prev.h, cur.h);
    const h = normalizeAngle(prev.h + headingDiff * t);

    // v16: facing 보간 (aim direction, f 필드)
    const prevFacing = prev.f ?? prev.h;
    const curFacing = cur.f ?? cur.h;
    const facingDiff = angleDiff(prevFacing, curFacing);
    const f = normalizeAngle(prevFacing + facingDiff * t);

    // mass 보간 (부드러운 HP 변화)
    const m = prev.m + (cur.m - prev.m) * t;

    // v16 Phase 4: z (높이) 보간
    const prevZ = prev.z ?? 0;
    const curZ = cur.z ?? 0;
    const z = prevZ + (curZ - prevZ) * t;

    return { ...cur, x, y, h, f, m, z };
  });
}

/**
 * 클라이언트 예측: 서버 state 기반으로 입력 방향을 즉시 반영
 * 서버 확인 전까지 로컬에서 Agent를 이동/회전시켜 조작감 개선
 *
 * v16: moveAngle과 aimAngle 분리
 * - moveAngle: WASD 기반 이동 방향 (null = 정지)
 * - aimAngle: 마우스 기반 조준 방향 (facing)
 */
export function applyClientPrediction(
  serverAgent: AgentNetworkData,
  targetAngle: number,
  dt: number,
  /** v16: 이동 방향 (null이면 targetAngle 사용 — 하위 호환) */
  moveAngle?: number | null,
  /** v16: 조준 방향 (undefined이면 targetAngle 사용 — 하위 호환) */
  aimAngle?: number,
): AgentNetworkData {
  // 서버 turnRate는 tick 기반(20Hz), 클라이언트는 frame 기반(60fps)
  const turnRate = ARENA_CONFIG.turnRate * 20; // rad/tick → rad/sec
  const speed = serverAgent.b ? ARENA_CONFIG.boostSpeed : ARENA_CONFIG.baseSpeed;

  // v16: moveAngle이 명시되면 이동/조준 분리
  const effectiveMoveAngle = moveAngle !== undefined ? moveAngle : targetAngle;
  const effectiveAimAngle = aimAngle !== undefined ? aimAngle : targetAngle;

  // 1. heading(이동 방향)을 moveAngle 쪽으로 dt 기반 회전
  let heading = serverAgent.h;
  if (effectiveMoveAngle !== null) {
    const diff = angleDiff(heading, effectiveMoveAngle);
    const maxTurn = turnRate * dt;
    if (Math.abs(diff) <= maxTurn) {
      heading = effectiveMoveAngle;
    } else {
      heading = normalizeAngle(heading + Math.sign(diff) * maxTurn);
    }
  }
  // effectiveMoveAngle === null → 정지, heading 유지

  // 2. 위치 예측 (moveAngle이 null이면 이동 안 함)
  let x = serverAgent.x;
  let y = serverAgent.y;
  if (effectiveMoveAngle !== null) {
    const moveDistance = speed * dt;
    const dir = angleToVector(heading);
    x += dir.x * moveDistance;
    y += dir.y * moveDistance;
  }

  // 3. facing 예측 (aimAngle은 클라이언트 드리븐 → 즉시 반영)
  const facing = effectiveAimAngle;

  return {
    ...serverAgent,
    h: heading,
    f: facing,
    x,
    y,
  };
}

// ─── 하위 호환: 기존 이름으로도 export ───
export const interpolateSnakes = interpolateAgents;
