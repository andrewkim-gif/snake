/**
 * Interpolation — 서버 상태 보간 + 클라이언트 예측
 * GameCanvas.tsx에서 추출. 순수 함수로 독립 테스트 가능.
 */

import { ARENA_CONFIG } from '@snake-arena/shared';
import { normalizeAngle, angleDiff, angleToVector, getDynamicSpacing } from '@snake-arena/shared';
import type { SnakeNetworkData } from '@snake-arena/shared';

// 모듈 레벨 Map 재사용 — 매 프레임 new Map 생성 방지
const _prevMap = new Map<string, SnakeNetworkData>();

/**
 * 서버 상태 보간: prevState와 latestState 사이의 뱀 위치를 보간
 * t: 0 = prevState, 1 = latestState, >1 = latestState 이후 외삽
 */
export function interpolateSnakes(
  prevSnakes: SnakeNetworkData[] | null,
  curSnakes: SnakeNetworkData[],
  t: number,
): SnakeNetworkData[] {
  if (!prevSnakes || t >= 1) return curSnakes;

  // Map 기반 O(1) lookup — 재사용
  _prevMap.clear();
  for (const s of prevSnakes) _prevMap.set(s.i, s);

  return curSnakes.map(cur => {
    const prev = _prevMap.get(cur.i);
    if (!prev) return cur;

    // 세그먼트 수가 달라도 보간 — 공통 길이만큼 보간, 나머지는 현재값 사용
    const minLen = Math.min(prev.p.length, cur.p.length);
    const segments: [number, number][] = [];

    for (let i = 0; i < cur.p.length; i++) {
      if (i < minLen) {
        const prevSeg = prev.p[i];
        const curSeg = cur.p[i];
        segments.push([
          prevSeg[0] + (curSeg[0] - prevSeg[0]) * t,
          prevSeg[1] + (curSeg[1] - prevSeg[1]) * t,
        ] as [number, number]);
      } else {
        // 새로 추가된 세그먼트는 현재 위치 그대로
        segments.push(cur.p[i]);
      }
    }

    // heading 보간
    const headingDiff = angleDiff(prev.h, cur.h);
    const heading = normalizeAngle(prev.h + headingDiff * t);

    return { ...cur, p: segments, h: heading };
  });
}

/**
 * 클라이언트 예측: 서버 state 기반으로 마우스 방향을 즉시 반영
 * 서버 확인 전까지 로컬에서 뱀 머리를 회전시켜 조작감 개선
 * + 세그먼트 follow로 몸통도 자연스럽게 따라오게
 */
export function applyClientPrediction(
  serverSnake: SnakeNetworkData,
  targetAngle: number,
  dt: number,
): SnakeNetworkData {
  // 서버 turnRate는 tick 기반(20Hz), 클라이언트는 frame 기반(60fps)
  const turnRate = ARENA_CONFIG.turnRate * 20; // rad/tick → rad/sec
  const speed = serverSnake.b ? ARENA_CONFIG.boostSpeed : ARENA_CONFIG.baseSpeed;

  // 1. heading을 targetAngle 쪽으로 dt 기반 회전
  let heading = serverSnake.h;
  const diff = angleDiff(heading, targetAngle);
  const maxTurn = turnRate * dt;
  if (Math.abs(diff) <= maxTurn) {
    heading = targetAngle;
  } else {
    heading = normalizeAngle(heading + Math.sign(diff) * maxTurn);
  }

  // 2. 머리 위치 예측 (dt 기반)
  const moveDistance = speed * dt;
  const dir = angleToVector(heading);
  const newHead: [number, number] = [
    serverSnake.p[0][0] + dir.x * moveDistance,
    serverSnake.p[0][1] + dir.y * moveDistance,
  ];

  // 3. 세그먼트 follow — 머리만 교체 대신, 각 세그먼트가 앞 세그먼트를 추적
  const dynamicSpacing = getDynamicSpacing(ARENA_CONFIG.segmentSpacing, serverSnake.m);
  const segments: [number, number][] = [newHead];
  for (let i = 1; i < serverSnake.p.length; i++) {
    const prev = segments[i - 1];
    const cur = serverSnake.p[i];
    const dx = cur[0] - prev[0];
    const dy = cur[1] - prev[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > dynamicSpacing) {
      const ratio = dynamicSpacing / dist;
      segments.push([prev[0] + dx * ratio, prev[1] + dy * ratio]);
    } else {
      segments.push(cur);
    }
  }

  return {
    ...serverSnake,
    h: heading,
    p: segments,
  };
}
