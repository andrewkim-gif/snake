/**
 * AnalystSystem.ts — 라운드 후 분석 시스템
 *
 * 라운드 종료 시 각 플레이어에 대한 분석 리포트 생성:
 * - Build Efficiency (0-100)
 * - Combat Score (0-100)
 * - Positioning Score (0-100)
 * - XP Efficiency (0-100)
 * - Suggestions (3-5개)
 * - MVP Stats
 */

import type { AgentEntity } from './AgentEntity';

// ── 분석 결과 ──
export interface RoundAnalysis {
  buildEfficiency: number;      // 0-100: 빌드 성능
  combatScore: number;          // 0-100: 킬 비율, 대미지
  positioningScore: number;     // 0-100: 안전 지대 점유, 경계 회피
  xpEfficiency: number;         // 0-100: XP 효율
  overallScore: number;         // 0-100: 종합 점수
  suggestions: string[];        // 3-5개 개선 제안
  mvpStats: {
    highestDPS: boolean;
    mostKills: boolean;
    longestSurvivor: boolean;
    bestBuilder: boolean;
    mostXP: boolean;
  };
}

// ── 라운드 통계 (분석용) ──
export interface PlayerRoundStats {
  playerId: string;
  kills: number;
  deaths: number;               // 0 or 1 (1 Life)
  level: number;
  xp: number;
  mass: number;
  survivalTime: number;         // 틱 수
  synergiesActivated: number;
  possibleSynergies: number;    // 이론상 활성 가능한 시너지 수
  orbsCollected: number;
  damageDealt: number;          // 추적이 안되면 추정
  boundaryDeath: boolean;       // 경계 밖 사망?
}

// ── 분석 상수 ──
const MAX_LEVEL = 12;
const MAX_POSSIBLE_SYNERGIES = 6;      // 공개 시너지 6종
const THEORETICAL_MAX_XP_PER_MIN = 200; // 이론적 최대 XP/분

export class AnalystSystem {

  /**
   * 라운드 종료 시 모든 플레이어 분석 생성
   */
  generateAnalysis(
    agents: Map<string, AgentEntity>,
    roundDurationTicks: number,
    humanPlayerIds: Set<string>,
  ): Map<string, RoundAnalysis> {
    const results = new Map<string, RoundAnalysis>();

    // 1. 전체 에이전트 통계 수집
    const allStats: PlayerRoundStats[] = [];
    for (const agent of agents.values()) {
      allStats.push(this.collectStats(agent, roundDurationTicks));
    }

    // 2. MVP 판정을 위한 최대값 수집
    const maxKills = Math.max(...allStats.map(s => s.kills), 1);
    const maxLevel = Math.max(...allStats.map(s => s.level), 1);
    const maxSurvival = Math.max(...allStats.map(s => s.survivalTime), 1);
    const maxSynergies = Math.max(...allStats.map(s => s.synergiesActivated), 0);
    const maxXP = Math.max(...allStats.map(s => s.xp), 1);

    // 킬 기반 "DPS" 추정
    const playerDPS = allStats.map(s => ({
      id: s.playerId,
      dps: s.kills / Math.max(s.survivalTime / 20, 1), // 킬/초
    }));
    const maxDPS = Math.max(...playerDPS.map(p => p.dps), 0.001);

    // 3. 인간 플레이어에 대해서만 분석
    for (const stats of allStats) {
      if (!humanPlayerIds.has(stats.playerId)) continue;

      const analysis = this.analyzePlayer(
        stats, roundDurationTicks,
        { maxKills, maxLevel, maxSurvival, maxSynergies, maxXP, maxDPS },
        playerDPS.find(p => p.id === stats.playerId)?.dps ?? 0,
      );

      results.set(stats.playerId, analysis);
    }

    return results;
  }

  /** 에이전트에서 통계 수집 */
  private collectStats(agent: AgentEntity, roundDurationTicks: number): PlayerRoundStats {
    const data = agent.data;
    const survivalTime = data.alive
      ? roundDurationTicks
      : roundDurationTicks; // 사망 시점 추적이 없으면 근사

    return {
      playerId: data.id,
      kills: data.kills,
      deaths: data.alive ? 0 : 1,
      level: data.level,
      xp: data.xp,
      mass: data.mass,
      survivalTime,
      synergiesActivated: data.activeSynergies.length,
      possibleSynergies: MAX_POSSIBLE_SYNERGIES,
      orbsCollected: 0, // 직접 추적 필요 (근사치 사용)
      damageDealt: data.kills * 50, // 킬당 ~50 대미지 추정
      boundaryDeath: false,
    };
  }

  /** 개별 플레이어 분석 */
  private analyzePlayer(
    stats: PlayerRoundStats,
    roundDurationTicks: number,
    globals: {
      maxKills: number;
      maxLevel: number;
      maxSurvival: number;
      maxSynergies: number;
      maxXP: number;
      maxDPS: number;
    },
    playerDPS: number,
  ): RoundAnalysis {
    // Build Efficiency: 시너지 활성화 비율 × 50 + 레벨/12 × 50
    const synergyRatio = globals.maxSynergies > 0
      ? stats.synergiesActivated / stats.possibleSynergies
      : 0;
    const levelRatio = stats.level / MAX_LEVEL;
    const buildEfficiency = Math.min(100, Math.round(synergyRatio * 50 + levelRatio * 50));

    // Combat Score: 킬 × 15 + (킬/deaths > 0) × 20 + DPS 랭크
    const killScore = Math.min(60, stats.kills * 15);
    const kdBonus = stats.deaths === 0 && stats.kills > 0 ? 20 : (stats.kills > 0 ? 10 : 0);
    const dpsRank = globals.maxDPS > 0 ? (playerDPS / globals.maxDPS) * 20 : 0;
    const combatScore = Math.min(100, Math.round(killScore + kdBonus + dpsRank));

    // Positioning Score: 생존 시간/라운드 시간 × 60 + 비경계사망 × 40
    const survivalRatio = roundDurationTicks > 0
      ? stats.survivalTime / roundDurationTicks
      : 0;
    const boundaryPenalty = stats.boundaryDeath ? 0 : 40;
    const positioningScore = Math.min(100, Math.round(survivalRatio * 60 + boundaryPenalty));

    // XP Efficiency: 실제 XP / 이론 최대 XP
    const roundMinutes = roundDurationTicks / (20 * 60); // 20 tps
    const theoreticalMaxXP = THEORETICAL_MAX_XP_PER_MIN * roundMinutes;
    const totalXPEarned = (stats.level - 1) * 100 + stats.xp; // 근사치
    const xpEfficiency = Math.min(100, Math.round((totalXPEarned / Math.max(theoreticalMaxXP, 1)) * 100));

    // 종합 점수 (가중 평균)
    const overallScore = Math.round(
      buildEfficiency * 0.25 +
      combatScore * 0.30 +
      positioningScore * 0.25 +
      xpEfficiency * 0.20,
    );

    // MVP 판정
    const mvpStats = {
      highestDPS: playerDPS >= globals.maxDPS && playerDPS > 0,
      mostKills: stats.kills >= globals.maxKills && stats.kills > 0,
      longestSurvivor: stats.survivalTime >= globals.maxSurvival && stats.deaths === 0,
      bestBuilder: stats.synergiesActivated >= globals.maxSynergies && stats.synergiesActivated > 0,
      mostXP: stats.xp >= globals.maxXP,
    };

    // 개선 제안 생성 (가장 약한 영역 기반)
    const suggestions = this.generateSuggestions(
      buildEfficiency, combatScore, positioningScore, xpEfficiency, stats,
    );

    return {
      buildEfficiency,
      combatScore,
      positioningScore,
      xpEfficiency,
      overallScore,
      suggestions,
      mvpStats,
    };
  }

  /** 개선 제안 생성 (가장 약한 영역 기반) */
  private generateSuggestions(
    buildEff: number,
    combat: number,
    positioning: number,
    xpEff: number,
    stats: PlayerRoundStats,
  ): string[] {
    const suggestions: string[] = [];

    // 점수별 약점 찾기
    const scores = [
      { area: 'build', score: buildEff },
      { area: 'combat', score: combat },
      { area: 'positioning', score: positioning },
      { area: 'xp', score: xpEff },
    ].sort((a, b) => a.score - b.score);

    for (const { area, score } of scores) {
      if (suggestions.length >= 5) break;

      if (area === 'build' && score < 60) {
        if (stats.synergiesActivated === 0) {
          suggestions.push('Try to activate at least one synergy by focusing your tome picks');
        }
        if (stats.level < 6) {
          suggestions.push('Focus on leveling up faster — collect XP orbs and visit shrines');
        }
        if (stats.level >= 6 && stats.synergiesActivated < 2) {
          suggestions.push('You reached a good level but missed synergies. Plan your build path');
        }
      }

      if (area === 'combat' && score < 50) {
        if (stats.kills === 0) {
          suggestions.push('Try to get at least one kill — engage weak enemies');
        }
        if (stats.deaths > 0 && stats.kills < 3) {
          suggestions.push('Improve your kill-to-death ratio — pick fights you can win');
        }
        suggestions.push('Use dash attacks on weakened enemies for efficient kills');
      }

      if (area === 'positioning' && score < 60) {
        if (stats.boundaryDeath) {
          suggestions.push('Avoid staying near the arena boundary — the shrink zone is deadly');
        }
        suggestions.push('Stay near the center of the arena for better positioning');
        if (stats.deaths > 0) {
          suggestions.push('Surviving longer increases your positioning score significantly');
        }
      }

      if (area === 'xp' && score < 50) {
        suggestions.push('Collect more orbs to increase your XP rate');
        if (stats.level < 5) {
          suggestions.push('Visit XP Shrines and Upgrade Altars to boost your progression');
        }
      }
    }

    // 최소 3개 보장
    while (suggestions.length < 3) {
      if (!suggestions.some(s => s.includes('orbs'))) {
        suggestions.push('Collecting orbs consistently helps maintain momentum');
      } else if (!suggestions.some(s => s.includes('synergy'))) {
        suggestions.push('Experiment with different build paths to find powerful synergies');
      } else {
        suggestions.push('Keep practicing — every round teaches you something new');
        break;
      }
    }

    return suggestions.slice(0, 5);
  }
}
