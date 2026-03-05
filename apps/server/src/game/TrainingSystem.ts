/**
 * TrainingSystem.ts — 에이전트 트레이닝 프로필 관리
 *
 * 에이전트별 빌드 전략, 전투 규칙, 페이즈별 전략을 저장/평가.
 * 트레이닝 프로필을 통해 봇/AI의 행동을 커스터마이즈.
 */

import type { Agent, PlayerBuild, Position } from '@snake-arena/shared';
import {
  type BuildPath,
  PRESET_BUILD_PATHS,
  chooseBestUpgrade,
  type GameContext,
} from './BuildPathSystem';

// ─── Types ───

/** 전투 규칙 조건 연산자 */
export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/** 전투 규칙 */
export interface CombatRule {
  /** 조건 표현식 (e.g., "mass_ratio > 2.0") */
  condition: string;
  /** 실행 동작 (e.g., "engage", "flee", "kite") */
  action: string;
  /** 규칙 우선순위 (낮을수록 우선) */
  priority?: number;
}

/** 전략 페이즈 */
export type StrategyPhase = 'early' | 'mid' | 'late';

/** 트레이닝 프로필 */
export interface TrainingProfile {
  agentId: string;
  buildProfile: {
    primaryPath: string;         // 빌드 패스 ID
    fallbackPath?: string;       // 폴백 빌드 패스
    fallbackCondition?: {
      levelBelow: number;        // 이 레벨 이하이면 폴백
      timeElapsed: number;       // 이 시간(초) 이후
    };
    bannedUpgrades: string[];    // 절대 선택 안 할 업그레이드
    alwaysPick: string[];        // 항상 선택할 업그레이드
  };
  combatRules: CombatRule[];
  strategyPhases: {
    early: string;               // 0-2분 전략
    mid: string;                 // 2-4분 전략
    late: string;                // 4-5분 전략
  };
  /** 프로필 생성/수정 시각 */
  updatedAt: number;
}

/** 라운드 결과 기록 */
export interface RoundResult {
  timestamp: number;
  buildPath: string;
  finalLevel: number;
  kills: number;
  rank: number;
  score: number;
  survivalTimeSec: number;
  synergies: string[];
}

/** 전투 규칙 평가 컨텍스트 */
export interface CombatContext {
  myMass: number;
  nearestEnemyMass: number;
  nearestEnemyDistance: number;
  nearbyEnemyCount: number;
  nearbyThreats: number;   // mass > 내 1.5배
  myLevel: number;
  healthRatio: number;      // 현재 mass / 최대 보유 mass
  arenaRadiusRatio: number; // 내 위치 / 아레나 반경
  timeRatio: number;        // 남은 시간 / 전체 시간
}

// ─── 기본 프로필 ───

const DEFAULT_PROFILE: Omit<TrainingProfile, 'agentId'> = {
  buildProfile: {
    primaryPath: 'berserker',
    bannedUpgrades: [],
    alwaysPick: [],
  },
  combatRules: [
    { condition: 'mass_ratio > 2.0', action: 'engage', priority: 1 },
    { condition: 'mass_ratio < 0.5', action: 'flee', priority: 0 },
    { condition: 'nearby_threats >= 2', action: 'flee', priority: 0 },
    { condition: 'health_ratio < 0.3', action: 'flee', priority: 0 },
    { condition: 'arena_radius_ratio > 0.85', action: 'go_center', priority: 1 },
  ],
  strategyPhases: {
    early: 'gather',
    mid: 'farm',
    late: 'fight',
  },
  updatedAt: Date.now(),
};

// ─── TrainingSystem 클래스 ───

export class TrainingSystem {
  private profiles = new Map<string, TrainingProfile>();
  private roundHistory = new Map<string, RoundResult[]>();
  private readonly MAX_HISTORY_PER_AGENT = 50;

  // ─── 프로필 CRUD ───

  /** 프로필 조회 (없으면 기본값 반환) */
  getProfile(agentId: string): TrainingProfile {
    const existing = this.profiles.get(agentId);
    if (existing) return existing;

    // 기본 프로필 생성
    const defaultProfile: TrainingProfile = {
      agentId,
      ...DEFAULT_PROFILE,
      updatedAt: Date.now(),
    };
    return defaultProfile;
  }

  /** 프로필 저장/업데이트 */
  setProfile(agentId: string, profile: Partial<TrainingProfile>): TrainingProfile {
    const current = this.getProfile(agentId);
    const updated: TrainingProfile = {
      ...current,
      ...profile,
      agentId, // 항상 유지
      buildProfile: {
        ...current.buildProfile,
        ...(profile.buildProfile ?? {}),
      },
      strategyPhases: {
        ...current.strategyPhases,
        ...(profile.strategyPhases ?? {}),
      },
      combatRules: profile.combatRules ?? current.combatRules,
      updatedAt: Date.now(),
    };
    this.profiles.set(agentId, updated);
    return updated;
  }

  /** 프로필 삭제 */
  deleteProfile(agentId: string): boolean {
    return this.profiles.delete(agentId);
  }

  /** 프로필 존재 여부 */
  hasProfile(agentId: string): boolean {
    return this.profiles.has(agentId);
  }

  // ─── 전투 규칙 평가 ───

  /**
   * 전투 규칙 평가 — 현재 상황에 맞는 최우선 동작 반환
   *
   * 지원 조건 변수:
   * - mass_ratio: 내 mass / 가장 가까운 적 mass
   * - nearby_threats: 위협 수 (내 1.5배 이상)
   * - nearby_enemies: 근처 적 수
   * - health_ratio: 현재 mass 비율
   * - arena_radius_ratio: 아레나 경계 대비 내 위치
   * - time_ratio: 남은 시간 비율
   * - level: 내 레벨
   * - distance: 가장 가까운 적까지 거리
   */
  evaluateCombatRules(agentId: string, ctx: CombatContext): string | null {
    const profile = this.getProfile(agentId);
    if (profile.combatRules.length === 0) return null;

    // 우선순위 정렬 (낮은 우선순위 = 더 중요)
    const sorted = [...profile.combatRules].sort(
      (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
    );

    for (const rule of sorted) {
      if (this.evaluateCondition(rule.condition, ctx)) {
        return rule.action;
      }
    }

    return null;
  }

  /**
   * 조건 문자열 평가
   * 형식: "variable operator value" (e.g., "mass_ratio > 2.0")
   */
  private evaluateCondition(condition: string, ctx: CombatContext): boolean {
    const parts = condition.trim().split(/\s+/);
    if (parts.length !== 3) return false;

    const [variable, operator, valueStr] = parts;
    const value = parseFloat(valueStr);
    if (isNaN(value)) return false;

    const actual = this.getContextVariable(variable, ctx);
    if (actual === null) return false;

    switch (operator) {
      case '>':  return actual > value;
      case '<':  return actual < value;
      case '>=': return actual >= value;
      case '<=': return actual <= value;
      case '==': return Math.abs(actual - value) < 0.001;
      case '!=': return Math.abs(actual - value) >= 0.001;
      default:   return false;
    }
  }

  /** 컨텍스트 변수 매핑 */
  private getContextVariable(name: string, ctx: CombatContext): number | null {
    switch (name) {
      case 'mass_ratio':
        return ctx.nearestEnemyMass > 0 ? ctx.myMass / ctx.nearestEnemyMass : 999;
      case 'nearby_threats':    return ctx.nearbyThreats;
      case 'nearby_enemies':    return ctx.nearbyEnemyCount;
      case 'health_ratio':      return ctx.healthRatio;
      case 'arena_radius_ratio': return ctx.arenaRadiusRatio;
      case 'time_ratio':        return ctx.timeRatio;
      case 'level':             return ctx.myLevel;
      case 'distance':          return ctx.nearestEnemyDistance;
      default:                  return null;
    }
  }

  // ─── 페이즈 전략 ───

  /**
   * 현재 시간 기준 전략 페이즈 반환
   * - early: 0~40% 경과 (0-2분)
   * - mid: 40~80% 경과 (2-4분)
   * - late: 80~100% 경과 (4-5분)
   */
  getStrategyForPhase(
    agentId: string,
    timeRemaining: number,
    roundDuration: number,
  ): { phase: StrategyPhase; strategy: string } {
    const profile = this.getProfile(agentId);
    const elapsed = roundDuration - timeRemaining;
    const ratio = elapsed / roundDuration;

    let phase: StrategyPhase;
    if (ratio < 0.4) {
      phase = 'early';
    } else if (ratio < 0.8) {
      phase = 'mid';
    } else {
      phase = 'late';
    }

    return {
      phase,
      strategy: profile.strategyPhases[phase],
    };
  }

  /**
   * 빌드 패스 결정 (폴백 조건 고려)
   * 폴백 조건 충족 시 폴백 패스로 전환
   */
  getActiveBuildPath(
    agentId: string,
    level: number,
    timeElapsed: number,
  ): BuildPath {
    const profile = this.getProfile(agentId);
    const primary = profile.buildProfile.primaryPath;
    const fallback = profile.buildProfile.fallbackPath;
    const condition = profile.buildProfile.fallbackCondition;

    // 폴백 조건 체크
    if (fallback && condition) {
      if (level <= condition.levelBelow && timeElapsed >= condition.timeElapsed) {
        const fallbackPath = PRESET_BUILD_PATHS[fallback];
        if (fallbackPath) return fallbackPath;
      }
    }

    // 기본 패스 반환
    return PRESET_BUILD_PATHS[primary] ?? PRESET_BUILD_PATHS['berserker']!;
  }

  // ─── 라운드 히스토리 ───

  /** 라운드 결과 기록 */
  recordRoundResult(agentId: string, result: RoundResult): void {
    if (!this.roundHistory.has(agentId)) {
      this.roundHistory.set(agentId, []);
    }
    const history = this.roundHistory.get(agentId)!;
    history.push(result);

    // 최대 기록 수 제한
    if (history.length > this.MAX_HISTORY_PER_AGENT) {
      history.splice(0, history.length - this.MAX_HISTORY_PER_AGENT);
    }
  }

  /** 라운드 히스토리 조회 */
  getRoundHistory(agentId: string, limit = 20): RoundResult[] {
    const history = this.roundHistory.get(agentId) ?? [];
    return history.slice(-limit);
  }

  /** 최근 성과 통계 */
  getPerformanceStats(agentId: string, recentN = 10): {
    avgRank: number;
    avgLevel: number;
    avgKills: number;
    avgScore: number;
    avgSurvival: number;
    winRate: number;
    topSynergies: string[];
  } {
    const history = this.getRoundHistory(agentId, recentN);
    if (history.length === 0) {
      return {
        avgRank: 0, avgLevel: 0, avgKills: 0, avgScore: 0,
        avgSurvival: 0, winRate: 0, topSynergies: [],
      };
    }

    const n = history.length;
    const sum = history.reduce(
      (acc, r) => ({
        rank: acc.rank + r.rank,
        level: acc.level + r.finalLevel,
        kills: acc.kills + r.kills,
        score: acc.score + r.score,
        survival: acc.survival + r.survivalTimeSec,
        wins: acc.wins + (r.rank === 1 ? 1 : 0),
      }),
      { rank: 0, level: 0, kills: 0, score: 0, survival: 0, wins: 0 },
    );

    // 시너지 빈도 계산
    const synergyCounts = new Map<string, number>();
    for (const r of history) {
      for (const s of r.synergies) {
        synergyCounts.set(s, (synergyCounts.get(s) ?? 0) + 1);
      }
    }
    const topSynergies = [...synergyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return {
      avgRank: Math.round(sum.rank / n * 10) / 10,
      avgLevel: Math.round(sum.level / n * 10) / 10,
      avgKills: Math.round(sum.kills / n * 10) / 10,
      avgScore: Math.round(sum.score / n),
      avgSurvival: Math.round(sum.survival / n),
      winRate: Math.round(sum.wins / n * 100),
      topSynergies,
    };
  }

  // ─── 유틸리티 ───

  /** 등록된 프로필 수 */
  getProfileCount(): number {
    return this.profiles.size;
  }

  /** 모든 프로필 ID */
  getAllProfileIds(): string[] {
    return Array.from(this.profiles.keys());
  }

  /** 전체 정리 */
  clear(): void {
    this.profiles.clear();
    this.roundHistory.clear();
  }
}
