/**
 * CoachSystem.ts — 실시간 코칭 시스템
 *
 * 매 60틱(3초)마다 게임 상태를 분석하고 플레이어에게 팁을 제공
 * 레이트 리밋: 최대 5초에 1메시지, 각 타입 15초 쿨다운
 */

import type { AgentEntity } from './AgentEntity';
import type { Position } from '@snake-arena/shared';
import { ALL_SYNERGIES } from '@snake-arena/shared';
import type { SynergyDef, TomeType, AbilityType } from '@snake-arena/shared';

// ── 코치 메시지 타입 ──
export type CoachMessageType = 'warning' | 'tip' | 'opportunity' | 'strategy' | 'efficiency';

export interface CoachMessage {
  type: CoachMessageType;
  message: string;
  priority: number;  // 1=high, 3=low
}

// ── 코치 상수 ──
const COACH_CHECK_INTERVAL = 60;          // 60틱 = 3초
const COACH_MIN_MESSAGE_GAP = 100;        // 5초(100틱) 최소 간격
const COACH_TYPE_COOLDOWN = 300;          // 15초(300틱) 타입별 쿨다운

// ── 플레이어 코치 상태 ──
interface PlayerCoachState {
  lastMessageTick: number;
  typeCooldowns: Map<CoachMessageType, number>;  // 타입 → 쿨다운 만료 틱
  lastXP: number;               // 이전 체크 시 XP (XP 효율 추적)
  lastXPCheckTick: number;      // 이전 XP 체크 틱
}

export class CoachSystem {
  private playerStates: Map<string, PlayerCoachState> = new Map();

  /** 플레이어 코치 상태 조회 (없으면 생성) */
  private getOrCreate(playerId: string): PlayerCoachState {
    let state = this.playerStates.get(playerId);
    if (!state) {
      state = {
        lastMessageTick: 0,
        typeCooldowns: new Map(),
        lastXP: 0,
        lastXPCheckTick: 0,
      };
      this.playerStates.set(playerId, state);
    }
    return state;
  }

  /** 코치 체크 인터벌 확인 */
  shouldCheck(tick: number): boolean {
    return tick % COACH_CHECK_INTERVAL === 0;
  }

  /**
   * 에이전트에 대한 코칭 메시지 생성
   * @returns 가장 우선순위 높은 메시지 1개 (null = 메시지 없음)
   */
  generateCoachMessages(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    arenaRadius: number,
    timeRemaining: number,
    tick: number,
    mapObjectPositions?: Array<{ type: string; position: Position; active: boolean }>,
  ): CoachMessage | null {
    const state = this.getOrCreate(agent.data.id);

    // 레이트 리밋 체크: 최소 5초 간격
    if (tick - state.lastMessageTick < COACH_MIN_MESSAGE_GAP) {
      return null;
    }

    const candidates: CoachMessage[] = [];

    // 1. Warning: Low HP
    if (this.canSendType(state, 'warning', tick)) {
      const hpRatio = agent.data.mass / 100;  // initialMass 기준
      if (hpRatio < 0.2) {
        candidates.push({
          type: 'warning',
          message: 'Low HP! Consider fleeing to safety',
          priority: 1,
        });
      }
    }

    // 2. Warning: Arena shrinking + near boundary
    if (this.canSendType(state, 'warning', tick)) {
      const distFromCenter = Math.sqrt(
        agent.position.x * agent.position.x +
        agent.position.y * agent.position.y,
      );
      const marginRatio = distFromCenter / arenaRadius;
      if (marginRatio > 0.85) {
        candidates.push({
          type: 'warning',
          message: 'Arena shrinking! Move to center',
          priority: 1,
        });
      }
    }

    // 3. Tip: XP Shrine nearby
    if (this.canSendType(state, 'tip', tick) && mapObjectPositions) {
      for (const obj of mapObjectPositions) {
        if (obj.type === 'shrine' && obj.active) {
          const dx = agent.position.x - obj.position.x;
          const dy = agent.position.y - obj.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            candidates.push({
              type: 'tip',
              message: 'XP Shrine nearby! +15 XP boost',
              priority: 2,
            });
            break;
          }
        }
      }
    }

    // 4. Opportunity: Weak enemy nearby
    if (this.canSendType(state, 'opportunity', tick)) {
      const myMass = agent.data.mass;
      for (const other of agents.values()) {
        if (other.data.id === agent.data.id) continue;
        if (!other.isAlive) continue;

        const dx = agent.position.x - other.position.x;
        const dy = agent.position.y - other.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 300px 범위 내, 상대 mass < 내 mass의 50%
        if (dist < 300 && other.data.mass < myMass * 0.5) {
          candidates.push({
            type: 'opportunity',
            message: `Weak enemy nearby (${other.data.name}: ${Math.floor(other.data.mass)} HP)`,
            priority: 2,
          });
          break;
        }
      }
    }

    // 5. Strategy: Late game defense
    if (this.canSendType(state, 'strategy', tick)) {
      if (timeRemaining > 0 && timeRemaining <= 60) {
        candidates.push({
          type: 'strategy',
          message: `Consider going defensive — only ${timeRemaining}s remaining`,
          priority: 2,
        });
      }
    }

    // 6. Efficiency: Slow XP rate
    if (this.canSendType(state, 'efficiency', tick)) {
      if (state.lastXPCheckTick > 0) {
        const ticksSinceCheck = tick - state.lastXPCheckTick;
        if (ticksSinceCheck >= COACH_CHECK_INTERVAL * 2) {
          const xpGained = agent.data.xp - state.lastXP + (agent.data.level - 1) * 100; // 근사치
          const xpPerTick = xpGained / ticksSinceCheck;
          // 평균적으로 0.5 XP/tick 이하면 느림
          if (xpPerTick < 0.3 && agent.data.level < 8) {
            candidates.push({
              type: 'efficiency',
              message: 'Your XP rate is slow. Try collecting more orbs',
              priority: 3,
            });
          }
        }
      }
      state.lastXP = agent.data.xp;
      state.lastXPCheckTick = tick;
    }

    // 7. Tip: 1 tome away from synergy
    if (this.canSendType(state, 'tip', tick)) {
      const suggestion = this.findNearSynergyTip(agent);
      if (suggestion) {
        candidates.push({
          type: 'tip',
          message: suggestion,
          priority: 2,
        });
      }
    }

    // 우선순위 정렬 (낮은 숫자 = 높은 우선순위)
    candidates.sort((a, b) => a.priority - b.priority);

    // 가장 높은 우선순위 메시지 반환
    if (candidates.length > 0) {
      const best = candidates[0];
      state.lastMessageTick = tick;
      state.typeCooldowns.set(best.type, tick + COACH_TYPE_COOLDOWN);
      return best;
    }

    return null;
  }

  /** 타입별 쿨다운 체크 */
  private canSendType(state: PlayerCoachState, type: CoachMessageType, tick: number): boolean {
    const cooldown = state.typeCooldowns.get(type) ?? 0;
    return tick >= cooldown;
  }

  /** 시너지에 1 tome만 부족한 경우 팁 생성 */
  private findNearSynergyTip(agent: AgentEntity): string | null {
    const build = agent.data.build;
    const activeSynergies = new Set(agent.data.activeSynergies);

    for (const synergy of ALL_SYNERGIES) {
      if (activeSynergies.has(synergy.id)) continue;
      if (synergy.hidden) continue;

      const { tomes, abilities } = synergy.requirements;
      let missingTomes = 0;
      let missingTomeName = '';

      // Tome 요구사항 체크
      if (tomes) {
        for (const [tomeType, minStacks] of Object.entries(tomes)) {
          const current = build.tomes[tomeType as TomeType] || 0;
          const deficit = (minStacks as number) - current;
          if (deficit > 0) {
            missingTomes += deficit;
            missingTomeName = tomeType;
          }
        }
      }

      // Ability 요구사항 체크
      let missingAbilities = 0;
      if (abilities) {
        for (const [abilityType, minLevel] of Object.entries(abilities)) {
          const slot = build.abilities.find(a => a.type === (abilityType as AbilityType));
          if (!slot || slot.level < (minLevel as number)) {
            missingAbilities++;
          }
        }
      }

      // 정확히 1개 tome만 부족하고 ability는 충족
      if (missingTomes === 1 && missingAbilities === 0) {
        return `You could activate ${synergy.name} by picking ${missingTomeName} tome`;
      }
    }

    return null;
  }

  /** 플레이어 데이터 정리 */
  removePlayer(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /** 라운드 리셋 */
  resetAll(): void {
    this.playerStates.clear();
  }
}
