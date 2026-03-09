/**
 * arena-mode.ts - 배틀로얄 아레나 모드 시스템 (v28 Phase 6)
 *
 * 세이프존 축소, 존 밖 데미지, 5분 타이머,
 * 생존자 판정, 배틀 결과 산출을 담당.
 */

import type { Vector2, SafeZone } from '../types';
import {
  ARENA_CONFIG,
  SAFE_ZONE_PHASES,
  calculateSafeZoneState,
} from '../config/arena.config';
import type { Agent as ArenaAgent } from '../types';

// ============================================
// Arena 상태 인터페이스
// ============================================

export type ArenaGameState = 'waiting' | 'playing' | 'ended';

export interface ArenaState {
  /** 게임 경과 시간 (초) */
  gameTime: number;
  /** 게임 상태 */
  gameState: ArenaGameState;
  /** 세이프존 상태 */
  safeZone: SafeZone;
  /** 생존 에이전트 수 (플레이어 포함) */
  aliveCount: number;
  /** 총 참가자 수 */
  totalCount: number;
  /** 승자 ID (null이면 미결) */
  winnerId: string | null;
  /** 승자 이름 */
  winnerName: string | null;
  /** 세이프존 현재 페이즈 */
  currentPhase: number;
  /** 존 밖 DPS */
  zoneDps: number;
  /** 존 축소 경고 중인지 */
  zoneWarning: boolean;
  /** 남은 시간 (초) */
  timeRemaining: number;
}

// ============================================
// Arena 초기화
// ============================================

/**
 * 아레나 초기 상태 생성
 */
export function createArenaState(totalParticipants: number): ArenaState {
  const worldSize = ARENA_CONFIG.WORLD_SIZE;
  return {
    gameTime: 0,
    gameState: 'playing',
    safeZone: {
      currentRadius: worldSize / 2,
      targetRadius: worldSize / 2,
      isWarning: false,
      isShrinking: false,
      damagePerSecond: 0,
      center: { x: 0, y: 0 },
      phase: 1,
      shrinkSpeed: 0,
      nextShrinkTime: 0,
    },
    aliveCount: totalParticipants,
    totalCount: totalParticipants,
    winnerId: null,
    winnerName: null,
    currentPhase: 0,
    zoneDps: 0,
    zoneWarning: false,
    timeRemaining: ARENA_CONFIG.GAME_DURATION,
  };
}

// ============================================
// Arena 업데이트
// ============================================

/**
 * 아레나 상태 매 프레임 업데이트
 *
 * @returns 게임 종료 여부
 */
export function updateArenaState(
  state: ArenaState,
  agents: ArenaAgent[],
  playerAlive: boolean,
  deltaTime: number,
): boolean {
  if (state.gameState === 'ended') return true;

  // 시간 업데이트
  state.gameTime += deltaTime;
  state.timeRemaining = Math.max(0, ARENA_CONFIG.GAME_DURATION - state.gameTime);

  // 세이프존 업데이트
  updateSafeZone(state);

  // 생존자 카운트
  let aliveAgents = 0;
  for (const agent of agents) {
    if (agent.state !== 'dead') aliveAgents++;
  }
  state.aliveCount = aliveAgents + (playerAlive ? 1 : 0);

  // 게임 종료 조건 체크
  const ended = checkGameEnd(state, agents, playerAlive);
  if (ended) {
    state.gameState = 'ended';
    return true;
  }

  return false;
}

// ============================================
// 세이프존 업데이트
// ============================================

function updateSafeZone(state: ArenaState): void {
  const worldSize = ARENA_CONFIG.WORLD_SIZE;
  const zoneState = calculateSafeZoneState(state.gameTime, worldSize);

  // SafeZone 상태 갱신
  if (zoneState.currentRadius !== undefined) {
    state.safeZone.currentRadius = zoneState.currentRadius;
  }
  if (zoneState.targetRadius !== undefined) {
    state.safeZone.targetRadius = zoneState.targetRadius;
  }
  if (zoneState.isWarning !== undefined) {
    state.safeZone.isWarning = zoneState.isWarning;
  }
  if (zoneState.isShrinking !== undefined) {
    state.safeZone.isShrinking = zoneState.isShrinking;
  }
  if (zoneState.damagePerSecond !== undefined) {
    state.safeZone.damagePerSecond = zoneState.damagePerSecond;
    state.zoneDps = zoneState.damagePerSecond;
  }

  // 중심점 고정
  if (!state.safeZone.center) {
    state.safeZone.center = { x: 0, y: 0 };
  }

  // 현재 페이즈 계산
  let phaseNum = 0;
  for (const phase of SAFE_ZONE_PHASES) {
    if (state.gameTime >= phase.startTime) {
      phaseNum = phase.phase;
    }
  }
  state.currentPhase = phaseNum;
  state.safeZone.phase = phaseNum;

  // 경고 상태
  state.zoneWarning = state.safeZone.isWarning || state.safeZone.isShrinking;
}

// ============================================
// 게임 종료 판정
// ============================================

function checkGameEnd(
  state: ArenaState,
  agents: ArenaAgent[],
  playerAlive: boolean,
): boolean {
  // 1. 시간 초과
  if (state.gameTime >= ARENA_CONFIG.GAME_DURATION) {
    determineWinner(state, agents, playerAlive);
    return true;
  }

  // 2. 마지막 1인 생존 (플레이어 사망 포함)
  if (state.aliveCount <= 1) {
    if (playerAlive) {
      state.winnerId = 'player';
      state.winnerName = 'YOU';
    } else {
      // 생존 에이전트가 승자
      const survivor = agents.find(a => a.state !== 'dead');
      if (survivor) {
        state.winnerId = survivor.agentId;
        state.winnerName = survivor.displayName || survivor.agentId;
      }
    }
    return true;
  }

  // 3. 플레이어 사망 (게임 오버)
  if (!playerAlive) {
    // 플레이어가 죽으면 바로 종료 (관전 모드 미구현)
    determineWinner(state, agents, false);
    return true;
  }

  return false;
}

/**
 * 승자 결정 (시간 초과 or 플레이어 사망 시)
 * 최고 점수 기준
 */
function determineWinner(
  state: ArenaState,
  agents: ArenaAgent[],
  playerAlive: boolean,
): void {
  let bestScore = -1;
  let bestId = '';
  let bestName = '';

  // 플레이어 점수 (playerAlive 여부 무관하게 점수 비교)
  // 플레이어 점수는 외부에서 설정해야 하므로 여기서는 에이전트만 비교

  for (const agent of agents) {
    if (agent.score > bestScore) {
      bestScore = agent.score;
      bestId = agent.agentId;
      bestName = agent.displayName || agent.agentId;
    }
  }

  // 플레이어가 살아있으면 플레이어 우선
  if (playerAlive) {
    state.winnerId = 'player';
    state.winnerName = 'YOU';
  } else {
    state.winnerId = bestId;
    state.winnerName = bestName;
  }
}

// ============================================
// 유틸리티
// ============================================

/**
 * 플레이어가 안전지대 밖인지 체크
 */
export function isOutsideSafeZone(
  position: Vector2,
  safeZone: SafeZone,
): boolean {
  if (!safeZone.center) return false;
  const dx = position.x - safeZone.center.x;
  const dy = position.y - safeZone.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist > safeZone.currentRadius;
}

/**
 * 안전지대 밖 데미지 계산 (플레이어용)
 */
export function getZoneDamage(
  position: Vector2,
  safeZone: SafeZone,
  deltaTime: number,
): number {
  if (!safeZone.center) return 0;
  const dx = position.x - safeZone.center.x;
  const dy = position.y - safeZone.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > safeZone.currentRadius) {
    const dps = safeZone.damagePerSecond ?? 5;
    const overDistance = dist - safeZone.currentRadius;
    const multiplier = 1 + (overDistance / 100) * 0.5;
    return dps * deltaTime * multiplier;
  }

  return 0;
}

/**
 * 시간을 MM:SS 포맷으로 변환
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 남은 시간을 포맷
 */
export function formatTimeRemaining(state: ArenaState): string {
  return formatTime(state.timeRemaining);
}

/**
 * 현재 페이즈 정보 문자열
 */
export function getPhaseInfo(state: ArenaState): string {
  if (state.currentPhase === 0) return 'SAFE ZONE ACTIVE';
  return `PHASE ${state.currentPhase} / ${SAFE_ZONE_PHASES.length}`;
}
