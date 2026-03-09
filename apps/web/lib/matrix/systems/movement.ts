/**
 * movement.ts - 이동 시스템
 * Auto Hunt AI, 플레이어 이동, 충돌 감지 로직
 *
 * v2.0 개선: 관성 기반 경로 추종 시스템
 * - 방향 플래너: 목표 방향을 자주 바꾸지 않음
 * - 모션 필터: 관성 + 급격한 변화 흡수
 * - 위협 감쇠: 위협이 사라져도 즉시 모드 전환하지 않음
 */

import React from 'react';
import { Player, Enemy, Gem, Pickup, Vector2, WeaponType, EnemyProjectile } from '../types';
import { normalize, distance, lerp, distanceSquared } from '../utils/math';
import { isObstacleAt } from '../helpers';
import { getObstacleAtGrid } from '../helpers';
import { GAME_CONFIG } from '../constants';

// ==============================
// v2.0 새로운 타입 정의
// ==============================

/**
 * 방향 계획 타입
 */
export type PlanType = 'dodge' | 'evade' | 'collect' | 'idle';

/**
 * 방향 계획 상태
 */
export interface DirectionPlan {
  targetDir: Vector2;        // 목표 방향
  planType: PlanType;        // 계획 유형
  confidence: number;        // 0-1, 현재 계획의 확신도
  timestamp: number;         // 계획 설정 시간
  minDuration: number;       // 최소 유지 시간 (ms)
}

/**
 * 위협 기억 상태 (감쇠 적용)
 */
export interface ThreatMemory {
  projectileLevel: number;   // 0-1, 투사체 위협 레벨
  enemyLevel: number;        // 0-1, 적 충돌 위협 레벨
  lastDodgeDir: Vector2;     // 마지막 투사체 회피 방향
  lastEvadeDir: Vector2;     // 마지막 적 회피 방향
  lastUpdateTime: number;    // 마지막 업데이트 시간
}

/**
 * 모션 상태 (관성 추적)
 */
export interface MotionState {
  currentAngle: number;      // 현재 이동 각도 (rad)
  angularVelocity: number;   // 회전 속도 (rad/s)
  speed: number;             // 현재 속도 (0-1)
}

// 계획 유형별 최소 유지 시간 (ms)
const PLAN_MIN_DURATION: Record<PlanType, number> = {
  dodge: 100,    // 투사체 회피 - 빠른 반응 필요
  evade: 250,    // 적 회피 - 안정적 이동
  collect: 400,  // 아이템 수집 - 목표 고정
  idle: 150,     // 정지 - 급정지 방지
};

// 우선순위 맵
const PLAN_PRIORITY: Record<PlanType, number> = {
  idle: 1,
  collect: 2,
  evade: 3,
  dodge: 4,
};

/**
 * Auto Hunt 상태 계산 결과
 */
export interface AutoHuntResult {
  move: Vector2;
  aim: Vector2;
}

/**
 * Auto Hunt에 필요한 refs
 */
export interface AutoHuntContext {
  enemies: Enemy[];
  enemyProjectiles: EnemyProjectile[];
  gems: Gem[];
  pickups: Pickup[];
  lastFacing: Vector2;
  /** 플레이어의 최대 무기 범위 (근접 무기 접근 모드용) */
  maxWeaponRange?: number;
  /** 원거리 무기 보유 여부 */
  hasRangedWeapon?: boolean;
}

/**
 * 이동 시스템에 필요한 refs
 */
export interface MovementRefs {
  smoothedAutoHuntDir: React.MutableRefObject<Vector2>;
  lastAutoHuntPos: React.MutableRefObject<Vector2>;
  stuckFrameCount: React.MutableRefObject<number>;
  escapeDir: React.MutableRefObject<Vector2 | null>;
  lastFacing: React.MutableRefObject<Vector2>;  // 공격/조준 방향
  lastMoveFacing: React.MutableRefObject<Vector2>;  // 이동 방향 (캐릭터 렌더링용)
  // v2.0 추가
  directionPlan: React.MutableRefObject<DirectionPlan>;
  threatMemory: React.MutableRefObject<ThreatMemory>;
  motionState: React.MutableRefObject<MotionState>;
}

// v2.0 기본값 생성 함수들
export const createDefaultDirectionPlan = (): DirectionPlan => ({
  targetDir: { x: 0, y: 0 },
  planType: 'idle',
  confidence: 0,
  timestamp: Date.now(),
  minDuration: PLAN_MIN_DURATION.idle,
});

export const createDefaultThreatMemory = (): ThreatMemory => ({
  projectileLevel: 0,
  enemyLevel: 0,
  lastDodgeDir: { x: 0, y: 1 },
  lastEvadeDir: { x: 0, y: 1 },
  lastUpdateTime: Date.now(),
});

export const createDefaultMotionState = (): MotionState => ({
  currentAngle: Math.PI / 2,  // 아래 방향
  angularVelocity: 0,
  speed: 0,
});

// 타겟 고정용 캐시 (떨림 방지)
let cachedTargetPos: Vector2 | null = null;
let cachedTargetTime: number = 0;
const TARGET_LOCK_DURATION = 300; // 300ms 동안 타겟 유지

/**
 * 입력 상태
 */
export interface InputState {
  keysPressed: Set<string>;
  joystick: {
    active: boolean;
    origin: Vector2;
    current: Vector2;
  };
}

/**
 * 특정 방향에 적이 있는지 확인 (위협 점수 반환)
 * playerRadius를 충분히 고려하여 충돌 방지
 */
const checkDirectionThreat = (
  playerPos: Vector2,
  direction: Vector2,
  checkDist: number,
  enemies: Enemy[],
  playerRadius: number
): number => {
  let threat = 0;
  const checkPos = {
    x: playerPos.x + direction.x * checkDist,
    y: playerPos.y + direction.y * checkDist,
  };

  enemies.forEach((e) => {
    if (e.state === 'dying') return;
    const d = distance(checkPos, e.position);
    // 충돌 반경 = 적 반경 + 플레이어 반경 + 안전 버퍼(60)
    const dangerRadius = e.radius + playerRadius + 60;
    if (d < dangerRadius) {
      // 가까울수록 더 위험, 보스는 3배 위험
      const proximity = (dangerRadius - d) / dangerRadius;
      threat += proximity * proximity * (e.isBoss ? 3 : 1); // 제곱으로 가까울수록 급격히 증가
    }
  });

  return threat;
};

/**
 * 8방향 중 가장 안전한 방향 찾기
 * 더 넓은 범위에서 위협 체크
 */
const findSafestDirection = (
  playerPos: Vector2,
  enemies: Enemy[],
  playerRadius: number,
  preferredDir?: Vector2
): Vector2 => {
  const directions: Vector2[] = [];
  // 16방향으로 더 정밀하게
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }

  let bestDir = { x: 0, y: 0 };
  let lowestThreat = Infinity;

  directions.forEach((dir) => {
    // 여러 거리에서 위협 체크 (더 가까운 거리도 체크)
    const threat =
      checkDirectionThreat(playerPos, dir, 30, enemies, playerRadius) * 4 +  // 아주 가까움 - 최우선
      checkDirectionThreat(playerPos, dir, 60, enemies, playerRadius) * 2 +  // 가까움
      checkDirectionThreat(playerPos, dir, 100, enemies, playerRadius) * 1 + // 중간
      checkDirectionThreat(playerPos, dir, 150, enemies, playerRadius) * 0.5; // 먼 거리

    // 선호 방향 보너스
    let score = threat;
    if (preferredDir) {
      const alignment = dir.x * preferredDir.x + dir.y * preferredDir.y;
      score -= alignment * 0.5; // 선호 방향과 비슷하면 점수 낮춤 (낮을수록 좋음)
    }

    if (score < lowestThreat) {
      lowestThreat = score;
      bestDir = dir;
    }
  });

  return bestDir;
};

/**
 * 광선 캐스트로 경로 충돌 체크 (다중 포인트)
 * 플레이어 폭을 고려한 "두꺼운" 레이캐스트
 */
const isPathBlocked = (
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  maxDist: number,
  playerRadius: number
): { blocked: boolean; blockedAt: number } => {
  const stepSize = 12; // 12px 간격으로 촘촘히 체크
  const buffer = playerRadius + 4;

  // 수직 방향 (좌우 오프셋용)
  const perpX = -dirY;
  const perpY = dirX;

  for (let dist = stepSize; dist <= maxDist; dist += stepSize) {
    const centerX = startX + dirX * dist;
    const centerY = startY + dirY * dist;

    // 중심 + 좌우 3점 체크 (플레이어 폭 고려)
    const offsets = [0, playerRadius * 0.7, -playerRadius * 0.7];
    for (const offset of offsets) {
      const checkX = centerX + perpX * offset;
      const checkY = centerY + perpY * offset;

      if (isObstacleAt(checkX, checkY, buffer)) {
        return { blocked: true, blockedAt: dist };
      }
    }
  }

  return { blocked: false, blockedAt: -1 };
};

/**
 * 장애물 회피 적용 헬퍼 함수 (개선된 버전)
 * - 다중 포인트 레이캐스트로 뭉친 장애물 감지
 * - 넓은 각도 탐색 (180도까지)
 * - 플레이어 폭 고려
 */
const applyObstacleAvoidance = (player: Player, moveDir: Vector2): Vector2 => {
  if (moveDir.x === 0 && moveDir.y === 0) return moveDir;

  const playerRadius = player.radius;
  const buffer = playerRadius + 8;
  let result = { ...moveDir };

  // === 1. 현재 위치가 장애물 안이면 즉시 탈출 (최우선) ===
  if (isObstacleAt(player.position.x, player.position.y, buffer * 0.3)) {
    // 16방향 중 빈 공간 찾기
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const escX = Math.cos(angle);
      const escY = Math.sin(angle);
      // 더 가까운 거리부터 체크
      for (const escDist of [20, 40, 60]) {
        if (!isObstacleAt(
          player.position.x + escX * escDist,
          player.position.y + escY * escDist,
          buffer * 0.5
        )) {
          return { x: escX, y: escY };
        }
      }
    }
    // 모든 방향 막힘 - 원래 방향 반대로
    return { x: -moveDir.x, y: -moveDir.y };
  }

  // === 2. 경로 충돌 체크 (다중 포인트 레이캐스트) ===
  const checkDist = 80; // 80px 앞까지 체크
  const { blocked, blockedAt } = isPathBlocked(
    player.position.x,
    player.position.y,
    result.x,
    result.y,
    checkDist,
    playerRadius
  );

  if (!blocked) {
    return result; // 경로 깨끗함
  }

  // === 3. 대체 경로 탐색 (넓은 각도, 양방향 동시) ===
  const baseAngle = Math.atan2(result.y, result.x);
  let bestAngle = baseAngle;
  let bestScore = -Infinity;
  let found = false;

  // 10도씩, 최대 170도까지 탐색 (양쪽 동시)
  for (let angleDeg = 10; angleDeg <= 170; angleDeg += 10) {
    for (const sign of [1, -1]) {
      const checkAngle = baseAngle + (angleDeg * sign * Math.PI) / 180;
      const dx = Math.cos(checkAngle);
      const dy = Math.sin(checkAngle);

      // 해당 방향 경로 체크
      const { blocked: pathBlocked } = isPathBlocked(
        player.position.x,
        player.position.y,
        dx,
        dy,
        checkDist,
        playerRadius
      );

      if (!pathBlocked) {
        // 점수: 원래 방향과 가까울수록 높음
        const angleScore = 180 - angleDeg;

        if (angleScore > bestScore) {
          bestScore = angleScore;
          bestAngle = checkAngle;
          found = true;
        }

        // 첫 번째 열린 경로 찾으면 바로 사용 (성능)
        if (angleDeg <= 30) {
          return { x: dx, y: dy };
        }
      }
    }
  }

  if (found) {
    return { x: Math.cos(bestAngle), y: Math.sin(bestAngle) };
  }

  // === 4. 모든 전방 경로 막힘 - 후퇴 시도 ===
  // 후퇴 방향들 체크
  for (const backAngle of [150, -150, 170, -170, 180]) {
    const checkAngle = baseAngle + (backAngle * Math.PI) / 180;
    const dx = Math.cos(checkAngle);
    const dy = Math.sin(checkAngle);

    const { blocked: pathBlocked } = isPathBlocked(
      player.position.x,
      player.position.y,
      dx,
      dy,
      40, // 후퇴는 짧게 체크
      playerRadius
    );

    if (!pathBlocked) {
      return { x: dx, y: dy };
    }
  }

  // 완전히 막힘 - 반대 방향
  return { x: -result.x, y: -result.y };
};

/**
 * 회피 방향에 다른 투사체 위협이 있는지 확인
 */
const checkThreatInDirection = (
  dir: Vector2,
  threats: { dodgeDir: Vector2; projPos: Vector2 }[],
  excludeIndex: number
): boolean => {
  for (let i = 0; i < threats.length; i++) {
    if (i === excludeIndex) continue;
    // 회피 방향과 다른 투사체의 회피 방향이 반대면 위험
    const dot = dir.x * threats[i].dodgeDir.x + dir.y * threats[i].dodgeDir.y;
    if (dot < -0.5) return true; // 반대 방향이면 위험
  }
  return false;
};

// ==============================
// v2.0 새로운 핵심 함수들
// ==============================

/**
 * 방향 계획 업데이트 여부 결정
 * 핵심: 목표 방향을 자주 바꾸지 않음
 */
const shouldUpdatePlan = (
  current: DirectionPlan,
  newPlanType: PlanType,
  newDir: Vector2,
  newConfidence: number
): boolean => {
  const now = Date.now();
  const elapsed = now - current.timestamp;

  // 1. 새 방향이 (0,0)이면 idle로 전환 (최소 유지 시간 후)
  if (newDir.x === 0 && newDir.y === 0) {
    return elapsed > current.minDuration;
  }

  // 2. 더 급한 상황이면 즉시 변경 (우선순위 차이가 1 이상)
  const priorityDiff = PLAN_PRIORITY[newPlanType] - PLAN_PRIORITY[current.planType];
  if (priorityDiff >= 2) {
    return true;  // 훨씬 급한 상황 (예: collect → dodge)
  }

  // 3. 최소 유지 시간 체크 (급한 상황 제외)
  if (elapsed < current.minDuration && newPlanType !== 'dodge') {
    return false;
  }

  // 4. 같은 우선순위거나 낮아지는 경우, 방향이 크게 다르면 변경
  const dot = current.targetDir.x * newDir.x + current.targetDir.y * newDir.y;
  if (dot < 0.3 && elapsed > 200) {
    // 방향이 약 70도 이상 다르고 200ms 이상 경과
    return true;
  }

  // 5. 확신도가 훨씬 높으면 변경
  if (newConfidence > current.confidence + 0.25) {
    return true;
  }

  // 6. 같은 타입이고 시간이 많이 지났으면 갱신
  if (current.planType === newPlanType && elapsed > current.minDuration * 2) {
    return true;
  }

  return false;
};

/**
 * 위협 기억 업데이트 (감쇠 적용)
 * 핵심: 위협이 사라져도 즉시 모드 전환하지 않음
 */
const updateThreatMemory = (
  memory: ThreatMemory,
  currentProjectileThreat: number,
  currentEnemyThreat: number,
  dodgeDir: Vector2 | null,
  evadeDir: Vector2 | null,
  deltaTimeMs: number
): void => {
  const dt = deltaTimeMs / 1000;  // 초 단위

  // 위협 증가는 빠르게, 감소는 느리게 (히스테리시스)
  const RISE_RATE = 8;   // 초당 8배 증가
  const FALL_RATE = 1.5;  // 초당 1.5배 감소

  // 투사체 위협
  if (currentProjectileThreat > memory.projectileLevel) {
    memory.projectileLevel = lerp(memory.projectileLevel, currentProjectileThreat, Math.min(1, RISE_RATE * dt));
  } else {
    memory.projectileLevel = lerp(memory.projectileLevel, currentProjectileThreat, Math.min(1, FALL_RATE * dt));
  }

  // 적 위협
  if (currentEnemyThreat > memory.enemyLevel) {
    memory.enemyLevel = lerp(memory.enemyLevel, currentEnemyThreat, Math.min(1, RISE_RATE * dt));
  } else {
    memory.enemyLevel = lerp(memory.enemyLevel, currentEnemyThreat, Math.min(1, FALL_RATE * dt));
  }

  // 회피 방향 저장 (유효한 경우에만)
  if (dodgeDir && (dodgeDir.x !== 0 || dodgeDir.y !== 0)) {
    memory.lastDodgeDir = { ...dodgeDir };
  }
  if (evadeDir && (evadeDir.x !== 0 || evadeDir.y !== 0)) {
    memory.lastEvadeDir = { ...evadeDir };
  }

  memory.lastUpdateTime = Date.now();
};

/**
 * 모션 필터 적용 (관성 + 회전 속도 제한)
 * 핵심: 급격한 방향 전환 흡수
 * v5.9.1: 아이템 수집 시 관성 대폭 감소 (뱅글뱅글 방지)
 */
const applyMotionFilter = (
  state: MotionState,
  targetDir: Vector2,
  urgency: number,  // 0-1, 급한 정도
  deltaTimeMs: number,
  isNearTarget: boolean = false  // v5.9.1: 타겟에 가까운지 여부
): Vector2 => {
  const dt = deltaTimeMs / 1000;

  // 목표가 없으면 감속 (v5.9.1: 타겟 근처면 빠르게 정지)
  if (targetDir.x === 0 && targetDir.y === 0) {
    const stopRate = isNearTarget ? 8 : 3; // 타겟 근처면 빠르게 정지
    state.speed = lerp(state.speed, 0, Math.min(1, stopRate * dt));
    state.angularVelocity *= isNearTarget ? 0.5 : 0.9;
    if (state.speed < 0.05) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.cos(state.currentAngle) * state.speed,
      y: Math.sin(state.currentAngle) * state.speed
    };
  }

  // v5.9.1: 타겟에 가까우면 관성 최소화 - 직접 방향으로 이동
  if (isNearTarget) {
    // 목표 방향으로 직접 이동 (관성 무시)
    const targetAngle = Math.atan2(targetDir.y, targetDir.x);
    state.currentAngle = targetAngle; // 즉시 방향 전환
    state.angularVelocity = 0;
    const targetSpeed = Math.sqrt(targetDir.x * targetDir.x + targetDir.y * targetDir.y);
    state.speed = lerp(state.speed, targetSpeed, 0.5); // 속도만 약간 스무딩
    return { ...targetDir };
  }

  // 1. 최대 회전 속도 제한 (급격한 방향 전환 방지)
  // urgency 0: 초당 180도, urgency 1: 초당 720도
  const MAX_ANGULAR_VEL_BASE = Math.PI;      // 180도/초
  const MAX_ANGULAR_VEL_URGENT = Math.PI * 4; // 720도/초
  const maxAngularVel = lerp(MAX_ANGULAR_VEL_BASE, MAX_ANGULAR_VEL_URGENT, urgency);

  // 2. 현재 방향과 목표 방향 사이 각도
  const targetAngle = Math.atan2(targetDir.y, targetDir.x);
  let angleDiff = targetAngle - state.currentAngle;

  // 각도 정규화 (-PI ~ PI)
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // 3. 목표 각속도 계산 (스무딩)
  const desiredAngularVel = angleDiff / Math.max(0.1, dt * 3); // 0.3초 안에 도달 목표
  const targetAngularVel = Math.max(-maxAngularVel, Math.min(maxAngularVel, desiredAngularVel));

  // 4. 각속도 스무딩 (관성)
  const angularSmoothing = lerp(0.15, 0.4, urgency);
  state.angularVelocity = lerp(state.angularVelocity, targetAngularVel, angularSmoothing);

  // 5. 새 각도 계산
  state.currentAngle += state.angularVelocity * dt;

  // 각도 정규화
  while (state.currentAngle > Math.PI) state.currentAngle -= Math.PI * 2;
  while (state.currentAngle < -Math.PI) state.currentAngle += Math.PI * 2;

  // 6. 속도 스무딩
  const targetSpeed = Math.sqrt(targetDir.x * targetDir.x + targetDir.y * targetDir.y);
  const speedSmoothing = lerp(0.1, 0.3, urgency);
  state.speed = lerp(state.speed, targetSpeed, speedSmoothing);

  return {
    x: Math.cos(state.currentAngle) * state.speed,
    y: Math.sin(state.currentAngle) * state.speed
  };
};

/**
 * 동적 스무딩 팩터 계산
 */
const calculateDynamicSmoothing = (
  planType: PlanType,
  urgency: number
): number => {
  // 기본 스무딩 (타입별)
  const baseSmoothingByType: Record<PlanType, number> = {
    dodge: 0.35,   // 투사체 회피는 빠르게
    evade: 0.2,    // 적 회피는 적당히
    collect: 0.12, // 수집은 느리게 (안정적)
    idle: 0.08,    // 정지는 아주 느리게
  };

  let smoothing = baseSmoothingByType[planType];

  // 급한 정도에 따라 조절
  smoothing = lerp(smoothing, 0.45, urgency);

  // 최소값 보장 (너무 느리면 반응 안함)
  return Math.max(0.08, Math.min(0.5, smoothing));
};

/**
 * Auto Hunt AI 상태 계산
 * 순수 터렛 전략: 기본적으로 정지, 회피/수집만 이동
 *
 * 핵심 철학:
 * - 적을 찾아가지 않음 (근접 무기만 있어도!)
 * - 적이 다가오면 자동 공격 (무기 시스템이 처리)
 * - 이동은 오직 회피/수집 목적
 *
 * 우선순위:
 * 1. 투사체 회피 (최우선, 가장 급한 것 1개 집중)
 * 2. HP 절박 시 치킨 (생존)
 * 3. 적 충돌 회피 (접촉 직전에만)
 * 4. 젬/아이템 수집 (위협 없을 때만)
 * 5. 정지 (기본 - 터렛)
 */
export const calculateAutoHuntState = (
  player: Player,
  ctx: AutoHuntContext
): AutoHuntResult => {
  // lastFacing이 (0,0)이면 기본 방향 사용
  let aimVector = (ctx.lastFacing.x === 0 && ctx.lastFacing.y === 0)
    ? { x: 0, y: 1 }  // 기본: 아래 방향
    : { ...ctx.lastFacing };
  let nearestEnemy: Enemy | null = null;
  let minEnemyDist = 99999;

  // 가장 가까운 적 찾기 (조준용) - v5.7: distanceSquared로 최적화
  let minEnemyDistSq = 99999 * 99999;
  for (let i = 0; i < ctx.enemies.length; i++) {
    const e = ctx.enemies[i];
    if (e.state === 'dying') continue;
    const dSq = distanceSquared(player.position, e.position);
    if (dSq < minEnemyDistSq) {
      minEnemyDistSq = dSq;
      nearestEnemy = e;
      minEnemyDist = Math.sqrt(dSq); // 최종 거리만 sqrt
    }
  }

  if (nearestEnemy) {
    const dx = nearestEnemy.position.x - player.position.x;
    const dy = nearestEnemy.position.y - player.position.y;
    // 적과 플레이어가 거의 같은 위치면 (0,0) 방지
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      aimVector = normalize({ x: dx, y: dy });
    }
    // 그 외에는 이전 aimVector(lastFacing) 유지
  }

  // === HP 상태 ===
  const hpPercent = player.health / player.maxHealth;
  const isCriticalHp = hpPercent < 0.3;
  const isLowHp = hpPercent < 0.5;
  const isDesperate = hpPercent < 0.2;  // 20% 미만: 절박 모드

  // === 1. 투사체 위협 분석 (최우선) - 대폭 강화된 회피 로직 ===
  // 핵심 개선: 먼 거리 투사체도 미리 감지, 더 넓은 hitRadius, 더 빠른 반응
  let projectileThreats: { dodgeDir: Vector2; urgency: number; timeToHit: number; projPos: Vector2 }[] = [];

  // v5.7: forEach → for loop, sqrt 최적화
  for (let pi = 0; pi < ctx.enemyProjectiles.length; pi++) {
    const p = ctx.enemyProjectiles[pi];
    const dx = player.position.x - p.position.x;
    const dy = player.position.y - p.position.y;
    const dSq = dx * dx + dy * dy;
    const projSpeedSq = p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y;
    if (projSpeedSq < 100) continue; // 정지한 투사체 무시 (10^2)
    const projSpeed = Math.sqrt(projSpeedSq); // 속도 정규화용 (필수)

    // 감지 범위: 대폭 확대 (기본 400 + 속도 보정 1.5배)
    // 보스 투사체(속도 200~400)는 700~1000px 범위에서 감지
    const detectRange = 400 + projSpeed * 1.5;
    const detectRangeSq = detectRange * detectRange;

    if (dSq < detectRangeSq) {
      const d = Math.sqrt(dSq); // 범위 내일 때만 실제 거리 계산
      // 투사체 방향 (정규화)
      const projDirX = p.velocity.x / projSpeed;
      const projDirY = p.velocity.y / projSpeed;

      // 투사체에서 플레이어까지의 벡터를 투사체 방향에 투영
      const dot = dx * projDirX + dy * projDirY;

      // 투사체가 플레이어 방향으로 오고 있는지 (더 관대하게)
      // 가까우면 무조건 감지 (150px), 멀어도 방향이 맞으면 감지
      if (dot > -20 || d < 150) {
        // 플레이어까지의 수직 거리
        const cross = dx * projDirY - dy * projDirX;
        const perpDist = Math.abs(cross);

        // 충돌 판정 반경: 대폭 확대
        // - 기본 안전 마진: 120px (기존 80)
        // - 원거리일수록 더 넓은 마진 (예측 오차 보정)
        const distanceBonus = Math.min(60, d * 0.15); // 최대 60px 추가
        const hitRadius = (p.radius || 8) + player.radius + 120 + distanceBonus;

        // 더 관대한 감지 조건: perpDist가 hitRadius보다 작거나 거리가 가까우면
        if (perpDist < hitRadius || d < 180) {
          // 충돌까지 예상 시간 (최소 0.05초)
          const timeToHit = Math.max(0.05, Math.max(dot, 0) / projSpeed);

          // 회피 방향 계산 (개선: 측면 + 후방 혼합)
          const sideSign = cross > 0 ? 1 : -1;
          let perpX = -projDirY * sideSign;
          let perpY = projDirX * sideSign;

          // 거리에 따른 후방 회피 혼합
          // - 가까울수록 후방으로 (피하면서 거리 벌리기)
          // - 멀면 측면으로 (최소 이동으로 회피)
          if (d < 250) {
            const backwardWeight = Math.min(0.8, (250 - d) / 250);
            perpX = perpX * (1 - backwardWeight) + (-projDirX) * backwardWeight;
            perpY = perpY * (1 - backwardWeight) + (-projDirY) * backwardWeight;
          }

          const dodgeLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

          // 긴급도: 훨씬 더 일찍 반응
          let urgency = 1;
          if (timeToHit < 0.15) urgency = 5;      // 극도로 긴급 (즉시 회피!)
          else if (timeToHit < 0.3) urgency = 4;  // 매우 긴급
          else if (timeToHit < 0.5) urgency = 3;  // 긴급
          else if (timeToHit < 0.8) urgency = 2;  // 주의
          // 1초 이상이어도 urgency 1로 회피 시작

          projectileThreats.push({
            dodgeDir: { x: perpX / dodgeLen, y: perpY / dodgeLen },
            urgency,
            timeToHit,
            projPos: { x: p.position.x, y: p.position.y },
          });
        }
      }
    }
  } // v5.7: for loop 종료

  // === 2. 적 충돌 위협 분석 (개선: 보스/다수 적 대응) ===
  let immediateThreats: { pos: Vector2; urgency: number; isBoss: boolean; radius: number }[] = [];

  // 근접 무기만 있을 때는 회피 거리를 무기 범위에 맞게 줄임 (핵심 수정!)
  // 원거리 무기가 없으면 적에게 가까이 붙어야 공격 가능
  const hasMeleeOnly = ctx.hasRangedWeapon === false;
  const weaponRange = ctx.maxWeaponRange || 50;

  // 충돌 회피 거리: 무기 범위 기반 동적 조절
  // - 원거리 무기 있음: 기존 50px
  // - 근접 무기만: 무기 범위의 60% (공격 가능 거리 확보)
  const COLLISION_AVOID_DIST_NORMAL = hasMeleeOnly
    ? Math.max(10, weaponRange * 0.6) // 최소 10px, 무기 범위의 60%
    : 50;
  const COLLISION_AVOID_DIST_BOSS = hasMeleeOnly
    ? Math.max(30, weaponRange * 0.8) // 보스는 조금 더 여유
    : 100;

  // 적 밀집도 체크 (80px 내 적 수) - v5.7: for loop + distanceSquared
  let nearbyEnemyCount = 0;
  const NEARBY_RANGE_SQ = 80 * 80; // 6400
  for (let ei = 0; ei < ctx.enemies.length; ei++) {
    const e = ctx.enemies[ei];
    if (e.state === 'dying') continue;
    const dSq = distanceSquared(player.position, e.position);
    if (dSq < NEARBY_RANGE_SQ) nearbyEnemyCount++;
  }
  const isCrowded = nearbyEnemyCount >= 3; // 3마리 이상 밀집

  // 근접 무기만 있고 밀집 상황이면 회피보다 공격 우선 (30px 보너스 제거)
  const crowdBonus = (isCrowded && !hasMeleeOnly) ? 30 : 0;

  // v5.7: forEach → for loop + distanceSquared
  for (let ei = 0; ei < ctx.enemies.length; ei++) {
    const e = ctx.enemies[ei];
    if (e.state === 'dying') continue;

    // 보스는 더 넓은 범위에서 회피
    const avoidDist = e.isBoss ? COLLISION_AVOID_DIST_BOSS : COLLISION_AVOID_DIST_NORMAL;
    const collisionDist = player.radius + e.radius + avoidDist + crowdBonus;
    const collisionDistSq = collisionDist * collisionDist;
    const dSq = distanceSquared(player.position, e.position);

    if (dSq < collisionDistSq) {
      const d = Math.sqrt(dSq); // 충돌 범위 내일 때만 sqrt
      // 긴급도: 가까울수록, 보스면 더 높음
      const baseUrgency = (collisionDist - d) / collisionDist;
      const urgency = e.isBoss ? baseUrgency * 2.5 : baseUrgency;
      immediateThreats.push({ pos: e.position, urgency, isBoss: !!e.isBoss, radius: e.radius });
    }
  }

  // === 3. 아이템/젬 분석 (강화된 적극 수집) ===
  let targetLoot: Vector2 | null = null;
  let targetPriority = 0;
  let isChickenTarget = false;
  let chickenPosition: Vector2 | null = null;
  let nearestChickenDist = Infinity;

  // 위협 여부 (투사체 or 적 충돌 임박)
  const hasThreats = projectileThreats.length > 0 || immediateThreats.length > 0;

  // 수집 범위: 대폭 확대 (적극 수집 전략)
  const PICKUP_RANGE = hasThreats ? 150 : 350;           // 100/250 → 150/350
  const GEM_RANGE = hasThreats ? 180 : 400;              // 120/300 → 180/400
  const CRITICAL_PICKUP_RANGE = 80;                      // NEW: 위협 중에도 수집
  const CHICKEN_RANGE_DESPERATE = 400;
  const CHICKEN_RANGE_CRITICAL = 250;
  const CHICKEN_RANGE_LOW = 150;

  // 고가치 픽업 타입 (위협 중에도 근거리면 수집)
  const HIGH_VALUE_PICKUPS = ['bomb', 'magnet', 'chest', 'upgrade_material', 'chicken', 'heal'];

  // v5.7: forEach → for loop + distanceSquared
  for (let pi = 0; pi < ctx.pickups.length; pi++) {
    const p = ctx.pickups[pi];
    const dSq = distanceSquared(player.position, p.position);
    let priority = 0;
    let maxRange = PICKUP_RANGE;

    // v6.0: 모든 픽업 타입 처리 (기본 우선순위 + 넓은 범위)
    // v5.7: 거리 비교를 제곱으로, 필요한 경우만 sqrt
    const d = Math.sqrt(dSq); // 픽업 범위 조건에서 필요
    if (p.type === 'chicken' || (p.type as string) === 'heal') {
      // HP 회복 아이템
      if (d < nearestChickenDist) {
        nearestChickenDist = d;
        chickenPosition = p.position;
      }

      if (isDesperate) {
        priority = 100;
        maxRange = CHICKEN_RANGE_DESPERATE;
      } else if (isCriticalHp) {
        priority = 15;
        maxRange = CHICKEN_RANGE_CRITICAL;
      } else if (isLowHp) {
        priority = 10;      // 8 → 10
        maxRange = 200;     // 150 → 200
      } else if (hpPercent < 0.8) {
        priority = 7;       // 6 → 7
        maxRange = 180;     // 120 → 180
      } else {
        priority = 5;       // 4 → 5 (기본도 수집)
        maxRange = 150;     // 80 → 150 (대폭 확대!)
      }
    } else if (p.type === 'bomb') {
      priority = 12;
      maxRange = hasThreats ? 250 : 400;  // 200/350 → 250/400
    } else if (p.type === 'magnet') {
      priority = 11;
      maxRange = hasThreats ? 250 : 400;  // 200/350 → 250/400
    } else if (p.type === 'chest') {
      priority = 10;
      maxRange = hasThreats ? 200 : 350;  // 180/300 → 200/350
    } else if (p.type === 'upgrade_material') {
      priority = 13;
      maxRange = hasThreats ? 250 : 450;  // 220/400 → 250/450
    } else if (p.type === 'score') {
      // 점수 아이템
      priority = 6;
      maxRange = hasThreats ? 150 : 300;
    } else {
      // 기타 모든 픽업 (기본 처리)
      priority = 5;
      maxRange = hasThreats ? 120 : 250;
    }

    // P3.5: 고가치 픽업은 위협 중에도 근거리면 수집 (80px 내)
    if (hasThreats && HIGH_VALUE_PICKUPS.includes(p.type) && d < CRITICAL_PICKUP_RANGE) {
      priority += 5;  // 우선순위 부스트
      maxRange = CRITICAL_PICKUP_RANGE;
    }

    if (d <= maxRange && priority > targetPriority) {
      targetPriority = priority;
      targetLoot = p.position;
      isChickenTarget = p.type === 'chicken';
    }
  } // v5.7: for loop 종료

  // 젬 수집 - 레벨업을 위해 매우 적극적으로!
  // 위협이 있어도 젬이 가까우면 수집 (targetPriority < 10으로 완화 - 폭탄/마그넷보다 낮을 때)
  if (!hasThreats || targetPriority < 10) {
    let bestGemPosition: Vector2 | null = null;
    let bestGemScore = 0;
    let bestGemPriority = 0;

    // v5.7: forEach → for loop + distanceSquared
    const GEM_RANGE_SQ = GEM_RANGE * GEM_RANGE;
    for (let gi = 0; gi < ctx.gems.length; gi++) {
      const g = ctx.gems[gi];
      if (g.isCollected) continue;
      const dSq = distanceSquared(player.position, g.position);
      if (dSq > GEM_RANGE_SQ) continue;
      const d = Math.sqrt(dSq); // 범위 내 젬만 sqrt

      const distScore = 1 - (d / GEM_RANGE);
      const valueScore = g.value >= 10 ? 2.5 : 1.0;  // 보라젬 가치 2.0 → 2.5
      const score = distScore * valueScore;

      if (score > bestGemScore) {
        bestGemScore = score;
        bestGemPosition = g.position;
        // 우선순위 대폭 상승 (기존 4-7 → 5-9)
        if (d < 80) bestGemPriority = 9;        // 매우 가까움 (60→80)
        else if (d < 150) bestGemPriority = 8;  // 가까움 (120→150)
        else if (d < 250) bestGemPriority = 6;  // 중간 (200→250)
        else if (d < 350) bestGemPriority = 5;  // 약간 멀음
        else bestGemPriority = 4;
      }
    } // v5.7: for loop 종료

    // 젬 수집 조건: 고가치 픽업(폭탄/마그넷/상자)이 아닌 한 젬 우선
    const isHighValuePickup = targetPriority >= 10;
    if (bestGemPosition && bestGemPriority > targetPriority && !isChickenTarget && !isHighValuePickup) {
      targetLoot = bestGemPosition;
      targetPriority = bestGemPriority;
    } else if (bestGemPosition && !targetLoot) {
      targetLoot = bestGemPosition;
      targetPriority = bestGemPriority;
    }
  }

  // 타겟 캐시 (떨림 방지)
  const now = Date.now();
  if (targetLoot && targetPriority >= 2) {
    cachedTargetPos = { ...targetLoot };
    cachedTargetTime = now;
  } else if (cachedTargetPos && (now - cachedTargetTime < TARGET_LOCK_DURATION)) {
    const cachedDist = distance(player.position, cachedTargetPos);
    if (cachedDist > 15 && cachedDist < 300) {
      targetLoot = cachedTargetPos;
    }
  }

  // === 4. 이동 방향 결정 (순수 터렛 전략) ===
  let finalMove = { x: 0, y: 0 };

  // Priority 1: 투사체 회피 (최우선, 다중 투사체 대응)
  if (projectileThreats.length > 0) {
    // timeToHit 기준 정렬
    projectileThreats.sort((a, b) => a.timeToHit - b.timeToHit);

    let dodgeDir: Vector2;

    if (projectileThreats.length === 1) {
      // 단일 투사체: 직접 회피
      dodgeDir = { ...projectileThreats[0].dodgeDir };
    } else {
      // 다중 투사체: 가중 평균 회피 방향 계산
      let avgX = 0, avgY = 0;
      let totalWeight = 0;

      // 가장 급한 3개까지만 고려 (성능 + 합리적 판단)
      const topThreats = projectileThreats.slice(0, 3);

      // v5.7: forEach → for loop
      for (let ti = 0; ti < topThreats.length; ti++) {
        const t = topThreats[ti];
        // 긴급도에 따른 가중치 (첫 번째가 가장 중요)
        const weight = (3 - ti) * t.urgency;
        avgX += t.dodgeDir.x * weight;
        avgY += t.dodgeDir.y * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        avgX /= totalWeight;
        avgY /= totalWeight;
      }

      const avgLen = Math.sqrt(avgX * avgX + avgY * avgY) || 1;
      dodgeDir = { x: avgX / avgLen, y: avgY / avgLen };

      // 평균 방향이 모든 투사체에 대해 안전한지 확인
      let isSafe = true;
      // v5.7: forEach → for loop
      for (let ti = 0; ti < topThreats.length; ti++) {
        const t = topThreats[ti];
        // 회피 방향과 투사체 회피 방향의 내적
        const dot = dodgeDir.x * t.dodgeDir.x + dodgeDir.y * t.dodgeDir.y;
        if (dot < -0.3) { isSafe = false; break; } // 반대 방향이면 위험 - break로 조기 탈출
      }

      // 안전하지 않으면 가장 급한 투사체 기준으로 회피
      if (!isSafe) {
        const primary = projectileThreats[0];
        dodgeDir = { ...primary.dodgeDir };

        // 그래도 다른 투사체와 충돌하면 후방으로
        if (checkThreatInDirection(dodgeDir, projectileThreats, 0)) {
          dodgeDir = { x: -dodgeDir.x, y: -dodgeDir.y };
          if (checkThreatInDirection(dodgeDir, projectileThreats, 0)) {
            // 최후의 수단: 투사체 반대 방향
            const projDir = normalize({
              x: primary.projPos.x - player.position.x,
              y: primary.projPos.y - player.position.y,
            });
            dodgeDir = { x: -projDir.x, y: -projDir.y };
          }
        }
      }
    }

    finalMove.x = dodgeDir.x;
    finalMove.y = dodgeDir.y;

    return { move: applyObstacleAvoidance(player, normalize(finalMove)), aim: aimVector };
  }

  // Priority 2: HP 절박 시 치킨 (생존 최우선)
  if (isDesperate && chickenPosition) {
    const dx = chickenPosition.x - player.position.x;
    const dy = chickenPosition.y - player.position.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    finalMove.x = dx / len;
    finalMove.y = dy / len;
    return { move: applyObstacleAvoidance(player, normalize(finalMove)), aim: aimVector };
  }

  // Priority 3: 적 충돌 회피 (강화: 보스/다수 적 대응)
  if (immediateThreats.length > 0) {
    // 보스가 있는지 체크
    const hasBossThreat = immediateThreats.some(t => t.isBoss);
    const threatCount = immediateThreats.length;

    // 가장 급한 위협 방향에서 벗어나기 (가중 평균)
    let avoidX = 0, avoidY = 0;
    let totalUrgency = 0;

    // v5.7: forEach → for loop
    for (let ti = 0; ti < immediateThreats.length; ti++) {
      const t = immediateThreats[ti];
      const dx = player.position.x - t.pos.x;
      const dy = player.position.y - t.pos.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1; // 정규화 용도 (필수)

      // 보스는 가중치 3배
      const weight = t.isBoss ? t.urgency * 3 : t.urgency;
      avoidX += (dx / len) * weight;
      avoidY += (dy / len) * weight;
      totalUrgency += weight;
    }

    if (totalUrgency > 0) {
      avoidX /= totalUrgency;
      avoidY /= totalUrgency;
    }

    const avoidLen = Math.sqrt(avoidX * avoidX + avoidY * avoidY) || 1;

    // 회피 속도: 상황에 따라 조절
    // - 기본: 0.8
    // - 보스 있으면: 1.0 (전력 회피)
    // - 다수 적 (3+): 0.9
    // - 보스 + 다수 적: 1.0 (전력 회피)
    let avoidSpeed = 0.8;
    if (hasBossThreat) avoidSpeed = 1.0;
    else if (threatCount >= 3) avoidSpeed = 0.9;

    finalMove.x = (avoidX / avoidLen) * avoidSpeed;
    finalMove.y = (avoidY / avoidLen) * avoidSpeed;

    // 회피 중이면 다른 행동 스킵 (즉시 반환)
    if (hasBossThreat || threatCount >= 2) {
      return { move: applyObstacleAvoidance(player, normalize(finalMove)), aim: aimVector };
    }
  }

  // Priority 4: 젬/아이템 수집
  // v7.8.7: 위협이 있어도 고가치 픽업이면 수집 시도 (방황 버그 수정)
  // - 위협 없음: 항상 수집
  // - 적 1마리 이하 + 우선순위 6+: 수집 (젬, 치킨 등)
  // - 우선순위 10+: 적이 많아도 수집 (폭탄, 마그넷, 상자 등 고가치)
  const canCollect = !hasThreats ||
                     (immediateThreats.length <= 1 && targetPriority >= 6) ||
                     targetPriority >= 10;

  if (canCollect && targetLoot && targetPriority >= 2) {
    const dx = targetLoot.x - player.position.x;
    const dy = targetLoot.y - player.position.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // v5.9.1: 아이템 수집 반경 = 플레이어 반경 + 아이템 반경 (약 25px)
    // 수집 반경 안에 들어오면 정지, 그 전까지는 직진
    const collectRadius = player.radius + 12; // 약 27px

    if (len > collectRadius) {
      // 수집 속도: 상황에 따라 조절
      let moveSpeed = 0.6;
      if (targetPriority >= 15) moveSpeed = 1.0;   // HP 위급 치킨
      else if (targetPriority >= 10) moveSpeed = 0.85; // 고가치 픽업
      else if (targetPriority >= 6) moveSpeed = 0.75;  // 중요 픽업/젬
      else moveSpeed = 0.6;  // 일반

      // v5.9.1: 아이템에 가까워지면 (50px 이내) 속도 줄이고 직진
      // 뱅글뱅글 도는 현상 방지 - 관성 무시하고 정확히 타겟으로
      if (len < 50) {
        // 가까울수록 느리게, 하지만 방향은 정확하게
        const proximityFactor = len / 50; // 0~1
        moveSpeed *= (0.5 + proximityFactor * 0.5); // 50~100% 속도
      }

      finalMove.x = (dx / len) * moveSpeed;
      finalMove.y = (dy / len) * moveSpeed;
    }
  }

  // Priority 4.5: 근접/오라 무기 접근 모드 (적극적 접근!)
  // 원거리 무기가 없으면 적에게 적극적으로 접근해야 공격 가능
  if (ctx.hasRangedWeapon === false && ctx.maxWeaponRange && ctx.maxWeaponRange > 0 && nearestEnemy) {
    const targetRange = ctx.maxWeaponRange * 0.8; // 무기 범위의 80%까지 접근

    // 적이 무기 범위 밖에 있으면 접근 (위협이 있어도 접근 시도)
    if (minEnemyDist > targetRange) {
      const dx = nearestEnemy.position.x - player.position.x;
      const dy = nearestEnemy.position.y - player.position.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // 접근 속도: 거리에 따라 조절 (멀면 빠르게)
      // 위협이 없으면 더 빠르게 접근
      const distRatio = Math.min(1, (minEnemyDist - targetRange) / 80);
      const baseSpeed = projectileThreats.length > 0 ? 0.3 : 0.6; // 투사체 있으면 조심
      const approachSpeed = baseSpeed + distRatio * 0.4;

      // 기존 이동 방향과 혼합 (회피 + 접근 동시 처리)
      if (finalMove.x === 0 && finalMove.y === 0) {
        // 정지 상태면 적극 접근
        finalMove.x = (dx / len) * approachSpeed;
        finalMove.y = (dy / len) * approachSpeed;
      } else {
        // 회피 중이면 50% 비율로 접근 방향 혼합
        finalMove.x = finalMove.x * 0.5 + (dx / len) * approachSpeed * 0.5;
        finalMove.y = finalMove.y * 0.5 + (dy / len) * approachSpeed * 0.5;
      }
    }
  }

  // Priority 5: 기본 - 정지 (터렛)
  // 원거리 무기가 있으면 적을 찾아가지 않음. 근접 무기만 있으면 위에서 접근 처리

  // 장애물 회피 적용
  if (finalMove.x !== 0 || finalMove.y !== 0) {
    finalMove = applyObstacleAvoidance(player, normalize(finalMove));
  }

  return { move: finalMove, aim: aimVector };
};

/**
 * Stuck 감지 및 탈출 방향 계산
 */
export const handleStuckDetection = (
  player: Player,
  frameCount: number,
  refs: MovementRefs
): Vector2 | null => {
  if (frameCount % 15 === 0) {
    const dist = distance(player.position, refs.lastAutoHuntPos.current);
    if (dist < 10) {
      refs.stuckFrameCount.current++;
    } else {
      refs.stuckFrameCount.current = 0;
      refs.escapeDir.current = null;
    }
    refs.lastAutoHuntPos.current = { ...player.position };
  }

  // Stuck 탈출 로직 (0.5-1초 이상 갇힌 경우)
  if (refs.stuckFrameCount.current > 4) {
    if (!refs.escapeDir.current) {
      const angle = Math.random() * Math.PI * 2;
      refs.escapeDir.current = { x: Math.cos(angle), y: Math.sin(angle) };
    }

    // 너무 오래 탈출 시도 시 새 방향
    if (refs.stuckFrameCount.current > 20) {
      refs.stuckFrameCount.current = 5;
      refs.escapeDir.current = null;
    }

    return refs.escapeDir.current;
  }

  return null;
};

/**
 * Auto Hunt 이동 방향 계산 (v2.0 - 관성 기반 경로 추종)
 *
 * v2.0 개선:
 * - 방향 플래너: 목표 방향을 자주 바꾸지 않음
 * - 모션 필터: 관성 + 급격한 변화 흡수
 * - 위협 감쇠: 위협이 사라져도 즉시 모드 전환하지 않음
 */
export const processAutoHuntMovement = (
  player: Player,
  ctx: AutoHuntContext,
  refs: MovementRefs,
  frameCount: number,
  deltaTimeMs: number = 16  // 기본 16ms (60fps)
): Vector2 => {
  // 안전장치: 유효하지 않은 입력 체크
  if (!player || !ctx || !refs) {
    console.warn('[AutoHunt] Invalid input detected');
    return { x: 0, y: 0 };
  }

  // ctx 배열 안전 체크
  if (!Array.isArray(ctx.enemies)) ctx.enemies = [];
  if (!Array.isArray(ctx.enemyProjectiles)) ctx.enemyProjectiles = [];
  if (!Array.isArray(ctx.gems)) ctx.gems = [];
  if (!Array.isArray(ctx.pickups)) ctx.pickups = [];

  // Stuck 감지 - 탈출 방향만 변경, aim은 여전히 계산 필요
  const escapeDir = handleStuckDetection(player, frameCount, refs);

  // 일반 Auto Hunt 로직 - Stuck 상태여도 aim 계산을 위해 실행
  let result: AutoHuntResult;
  try {
    result = calculateAutoHuntState(player, ctx);
  } catch (err) {
    console.error('[AutoHunt] Error in calculateAutoHuntState:', err);
    return { x: 0, y: 0 };
  }
  const { move, aim } = result;

  // lastFacing 업데이트 - aim(조준) 방향 (무기 발사용)
  if (aim.x !== 0 || aim.y !== 0) {
    refs.lastFacing.current = { ...aim };
  }

  // lastMoveFacing 업데이트 - move(이동) 방향 (캐릭터 렌더링용)
  if (move.x !== 0 || move.y !== 0) {
    refs.lastMoveFacing.current = { ...move };
  }

  // Stuck 탈출 중이면 탈출 방향 사용
  if (escapeDir) {
    return escapeDir;
  }

  // ===== v2.0: 관성 기반 경로 추종 시스템 =====
  // v2.0 refs가 있으면 새 시스템 사용
  if (refs.directionPlan && refs.threatMemory && refs.motionState) {
    const plan = refs.directionPlan.current;
    const memory = refs.threatMemory.current;
    const motion = refs.motionState.current;

    // 1. 새 계획 타입 및 방향 결정
    let newPlanType: PlanType = 'idle';
    let newDir = { ...move };
    let confidence = 0;
    let urgency = 0;

    // 현재 위협 레벨 계산
    const projectileThreat = ctx.enemyProjectiles.length > 0
      ? Math.min(1, ctx.enemyProjectiles.length / 5)
      : 0;
    const enemyThreat = ctx.enemies.filter(e =>
      e.state !== 'dying' && distance(player.position, e.position) < 80
    ).length > 0 ? 0.5 : 0;

    // 위협 기억 업데이트
    updateThreatMemory(
      memory,
      projectileThreat,
      enemyThreat,
      move.x !== 0 || move.y !== 0 ? move : null,
      null,
      deltaTimeMs
    );

    // 계획 타입 결정 (move 방향 기반)
    if (move.x === 0 && move.y === 0) {
      newPlanType = 'idle';
      confidence = 1;
      urgency = 0;
    } else if (memory.projectileLevel > 0.3 || projectileThreat > 0.5) {
      // 투사체 회피 모드
      newPlanType = 'dodge';
      confidence = Math.min(1, memory.projectileLevel + 0.3);
      urgency = memory.projectileLevel;
      // 투사체 위협 중이면 마지막 회피 방향 사용 (안정성)
      if (memory.projectileLevel > 0.5 && plan.planType === 'dodge') {
        const dot = move.x * plan.targetDir.x + move.y * plan.targetDir.y;
        if (dot > 0.3) {
          // 같은 방향이면 기존 방향 유지 (떨림 방지)
          newDir = { ...plan.targetDir };
        }
      }
    } else if (memory.enemyLevel > 0.3 || enemyThreat > 0.3) {
      // 적 회피 모드
      newPlanType = 'evade';
      confidence = Math.min(1, memory.enemyLevel + 0.2);
      urgency = memory.enemyLevel * 0.7;
    } else {
      // 아이템 수집 모드
      newPlanType = 'collect';
      confidence = 0.6;
      urgency = 0.1;
    }

    // 2. 계획 업데이트 여부 결정
    if (shouldUpdatePlan(plan, newPlanType, newDir, confidence)) {
      refs.directionPlan.current = {
        targetDir: { ...newDir },
        planType: newPlanType,
        confidence,
        timestamp: Date.now(),
        minDuration: PLAN_MIN_DURATION[newPlanType],
      };
    }

    // 3. 모션 필터 적용 (관성 + 회전 속도 제한)
    const targetDir = refs.directionPlan.current.targetDir;
    // v5.9.1: collect 모드에서는 관성 비활성화 (아이템 주변 뱅글뱅글 도는 버그 수정)
    const isNearTarget = newPlanType === 'collect';
    const filteredMove = applyMotionFilter(motion, targetDir, urgency, deltaTimeMs, isNearTarget);

    // 4. 스무딩된 방향 저장 (기존 호환성)
    refs.smoothedAutoHuntDir.current = { ...filteredMove };

    return filteredMove;
  }

  // ===== Legacy: v1.x 호환 모드 (v2.0 refs가 없을 때) =====
  // 목표가 없으면 (move가 0,0) 부드럽게 정지
  if (move.x === 0 && move.y === 0) {
    // 급정지 대신 부드럽게 감속
    refs.smoothedAutoHuntDir.current.x *= 0.7;
    refs.smoothedAutoHuntDir.current.y *= 0.7;
    // 충분히 작으면 완전 정지
    if (Math.abs(refs.smoothedAutoHuntDir.current.x) < 0.05) refs.smoothedAutoHuntDir.current.x = 0;
    if (Math.abs(refs.smoothedAutoHuntDir.current.y) < 0.05) refs.smoothedAutoHuntDir.current.y = 0;
  } else {
    // 스무딩 적용
    const dotProduct = refs.smoothedAutoHuntDir.current.x * move.x + refs.smoothedAutoHuntDir.current.y * move.y;
    const isOppositeDir = dotProduct < -0.3;
    const SMOOTHING = isOppositeDir ? 0.5 : 0.35;

    refs.smoothedAutoHuntDir.current.x = lerp(refs.smoothedAutoHuntDir.current.x, move.x, SMOOTHING);
    refs.smoothedAutoHuntDir.current.y = lerp(refs.smoothedAutoHuntDir.current.y, move.y, SMOOTHING);
  }

  return { ...refs.smoothedAutoHuntDir.current };
};

/**
 * 수동 입력 처리
 */
export const processManualInput = (
  input: InputState,
  lastFacing: React.MutableRefObject<Vector2>,
  lastMoveFacing?: React.MutableRefObject<Vector2>
): Vector2 => {
  let moveDir = { x: 0, y: 0 };

  if (input.keysPressed.has('KeyW') || input.keysPressed.has('ArrowUp')) moveDir.y -= 1;
  if (input.keysPressed.has('KeyS') || input.keysPressed.has('ArrowDown')) moveDir.y += 1;
  if (input.keysPressed.has('KeyA') || input.keysPressed.has('ArrowLeft')) moveDir.x -= 1;
  if (input.keysPressed.has('KeyD') || input.keysPressed.has('ArrowRight')) moveDir.x += 1;

  // 조이스틱 입력
  if (input.joystick.active) {
    const dx = input.joystick.current.x - input.joystick.origin.x;
    const dy = input.joystick.current.y - input.joystick.origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      const maxRadius = 40;
      const power = Math.min(1, dist / maxRadius);
      moveDir.x += (dx / dist) * power;
      moveDir.y += (dy / dist) * power;
    }
  }

  // 정규화
  let length = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);
  if (length > 1) {
    moveDir.x /= length;
    moveDir.y /= length;
  }

  // Facing 업데이트 (수동 모드에서는 이동방향 = 공격방향)
  if (moveDir.x !== 0 || moveDir.y !== 0) {
    const facingDir = Math.abs(moveDir.x) > 0.1
      ? { x: moveDir.x > 0 ? 1 : -1, y: 0 }
      : { x: 0, y: moveDir.y > 0 ? 1 : -1 };
    lastFacing.current = facingDir;
    if (lastMoveFacing) {
      lastMoveFacing.current = facingDir;
    }
  }

  return moveDir;
};

/**
 * 넉백 물리 처리
 */
export const processKnockback = (player: Player): void => {
  player.knockback.x *= 0.85;
  player.knockback.y *= 0.85;
  if (Math.abs(player.knockback.x) < 0.1) player.knockback.x = 0;
  if (Math.abs(player.knockback.y) < 0.1) player.knockback.y = 0;
};

/**
 * 플레이어 위치 업데이트 (다양한 크기 장애물 충돌 감지)
 * @param v3SpeedMultiplier v3 시스템 속도 배율 (콤보 보너스 + 쪽지시험 페널티)
 */
export const updatePlayerPosition = (
  player: Player,
  moveDir: Vector2,
  deltaTime: number,
  gridSize: number = 32,
  v3SpeedMultiplier: number = 1
): void => {
  // 넉백 처리
  processKnockback(player);

  // 속도 계산 (v3 배율 적용)
  const effectiveSpeed = player.speed * v3SpeedMultiplier;
  player.velocity.x = moveDir.x * effectiveSpeed + player.knockback.x;
  player.velocity.y = moveDir.y * effectiveSpeed + player.knockback.y;

  const nextX = player.position.x + player.velocity.x * deltaTime;
  const nextY = player.position.y + player.velocity.y * deltaTime;

  const checkRadius = 4;
  let collidedX = false;
  let collidedY = false;

  // X축 충돌 체크 (새 설정 시스템 사용)
  const pColX = Math.floor(nextX / gridSize);
  const pRowX = Math.floor(player.position.y / gridSize);
  for (let c = pColX - checkRadius; c <= pColX + checkRadius && !collidedX; c++) {
    for (let r = pRowX - checkRadius; r <= pRowX + checkRadius && !collidedX; r++) {
      const obstacle = getObstacleAtGrid(c, r);
      if (!obstacle) continue;

      const { config, x: ox, y: oy } = obstacle;
      const halfW = config.width / 2;
      const halfH = config.height / 2;

      if (
        nextX + player.radius > ox - halfW &&
        nextX - player.radius < ox + halfW &&
        player.position.y + player.radius > oy - halfH &&
        player.position.y - player.radius < oy + halfH
      ) {
        collidedX = true;
      }
    }
  }

  // Y축 충돌 체크
  const pColY = Math.floor(player.position.x / gridSize);
  const pRowY = Math.floor(nextY / gridSize);
  for (let c = pColY - checkRadius; c <= pColY + checkRadius && !collidedY; c++) {
    for (let r = pRowY - checkRadius; r <= pRowY + checkRadius && !collidedY; r++) {
      const obstacle = getObstacleAtGrid(c, r);
      if (!obstacle) continue;

      const { config, x: ox, y: oy } = obstacle;
      const halfW = config.width / 2;
      const halfH = config.height / 2;

      if (
        player.position.x + player.radius > ox - halfW &&
        player.position.x - player.radius < ox + halfW &&
        nextY + player.radius > oy - halfH &&
        nextY - player.radius < oy + halfH
      ) {
        collidedY = true;
      }
    }
  }

  // 충돌 없으면 이동
  if (!collidedX) player.position.x = nextX;
  if (!collidedY) player.position.y = nextY;
};
