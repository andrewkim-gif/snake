/**
 * Interpolation — 서버 상태 보간 + 클라이언트 예측
 * v10: Snake 세그먼트 → Agent 단일 위치 보간
 */

import { ARENA_CONFIG } from '@snake-arena/shared';
import { normalizeAngle, angleDiff, angleToVector } from '@snake-arena/shared';
import type { AgentNetworkData } from '@snake-arena/shared';

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

    // mass 보간 (부드러운 HP 변화)
    const m = prev.m + (cur.m - prev.m) * t;

    return { ...cur, x, y, h, m };
  });
}

/**
 * 클라이언트 예측: 서버 state 기반으로 마우스 방향을 즉시 반영
 * 서버 확인 전까지 로컬에서 Agent를 회전시켜 조작감 개선
 */
export function applyClientPrediction(
  serverAgent: AgentNetworkData,
  targetAngle: number,
  dt: number,
): AgentNetworkData {
  // 서버 turnRate는 tick 기반(20Hz), 클라이언트는 frame 기반(60fps)
  const turnRate = ARENA_CONFIG.turnRate * 20; // rad/tick → rad/sec
  const speed = serverAgent.b ? ARENA_CONFIG.boostSpeed : ARENA_CONFIG.baseSpeed;

  // 1. heading을 targetAngle 쪽으로 dt 기반 회전
  let heading = serverAgent.h;
  const diff = angleDiff(heading, targetAngle);
  const maxTurn = turnRate * dt;
  if (Math.abs(diff) <= maxTurn) {
    heading = targetAngle;
  } else {
    heading = normalizeAngle(heading + Math.sign(diff) * maxTurn);
  }

  // 2. 위치 예측 (dt 기반)
  const moveDistance = speed * dt;
  const dir = angleToVector(heading);
  const x = serverAgent.x + dir.x * moveDistance;
  const y = serverAgent.y + dir.y * moveDistance;

  return {
    ...serverAgent,
    h: heading,
    x,
    y,
  };
}

// ─── 하위 호환: 기존 이름으로도 export ───
export const interpolateSnakes = interpolateAgents;
