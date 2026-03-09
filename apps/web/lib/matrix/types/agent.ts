// v29: PlacedAgent type stub (에이전트를 터렛처럼 배치하는 시스템용)
import type { PlacedTurret } from '../types';

/** 배치된 에이전트 (PlacedTurret 확장) */
export interface PlacedAgent extends PlacedTurret {
  agentId?: string;
  personality?: string;
  abilities?: Array<{
    type: string;
    cooldown: number;
    lastUsed: number;
    damage: number;
    range: number;
  }>;
}
