/**
 * Arena Shrink — v10 아레나 수축 시스템
 * 선형 수축: -600px/min (6000→1200px over ~8min, 5분 라운드에서는 ~3000px까지)
 * 경계 밖 에이전트는 mass 패널티
 */

import type { ArenaConfig } from '@snake-arena/shared';
import { SHRINK_CONFIG } from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';

export class ArenaShrink {
  private currentRadius: number;
  private readonly minRadius: number;
  private readonly shrinkPerTick: number;
  private readonly boundaryPenaltyPerTick: number;
  private enabled: boolean;

  constructor(config: ArenaConfig) {
    this.currentRadius = config.radius;
    this.minRadius = config.shrinkMinRadius;
    this.shrinkPerTick = SHRINK_CONFIG.SHRINK_PER_TICK;
    this.boundaryPenaltyPerTick = config.boundaryPenaltyPerTick;
    this.enabled = config.shrinkEnabled;
  }

  /** 매 틱 호출: 아레나 수축 + 경계 밖 패널티 */
  update(agents: Map<string, AgentEntity>): void {
    if (!this.enabled) return;

    // 수축
    if (this.currentRadius > this.minRadius) {
      this.currentRadius = Math.max(
        this.minRadius,
        this.currentRadius - this.shrinkPerTick
      );
    }

    // 경계 밖 에이전트 패널티
    for (const agent of agents.values()) {
      if (!agent.isAlive) continue;

      const { x, y } = agent.position;
      const dist = Math.sqrt(x * x + y * y);

      if (dist > this.currentRadius) {
        // mass의 0.25%/tick 감소
        const penalty = agent.data.mass * this.boundaryPenaltyPerTick;
        agent.data.mass -= penalty;

        // 경계 밖에서 약간 안쪽으로 밀기 (부드러운 피드백)
        if (dist > 0) {
          const pushRatio = this.currentRadius / dist;
          agent.data.position = {
            x: x * pushRatio * 0.99, // 99%만 밀어서 반복 충돌 방지
            y: y * pushRatio * 0.99,
          };
        }

        if (agent.data.mass <= 0) {
          agent.data.mass = 0;
        }
      }
    }
  }

  getCurrentRadius(): number {
    return this.currentRadius;
  }

  /** 수축 리셋 (라운드 리셋 시) */
  reset(config: ArenaConfig): void {
    this.currentRadius = config.radius;
  }

  /** 수축 활성/비활성 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
