/**
 * game/rendering/projectiles/types.ts - 투사체 렌더링 타입 정의
 */

export interface ProjectileRenderData {
  id: string;
  x: number;
  y: number;
  velocity: { x: number; y: number };
  damage: number;
  skillType: string;
  angle?: number;
  radius?: number;
  createdAt?: number;
  duration?: number;
  pierceCount?: number;
  chainCount?: number;
  // 스킬별 추가 속성
  forkCount?: number;
  initialDamage?: number;
  returnPhase?: boolean;
  orbitAngle?: number;
  controlPoints?: Array<{ x: number; y: number }>;
  sourceId?: string;
  bossSpecial?: boolean;
}

export type ProjectileRenderer = (
  ctx: CanvasRenderingContext2D,
  projectile: ProjectileRenderData,
  t: number
) => void;

// 스킬 타입 상수
export const SKILL_TYPES = {
  KNIFE: 'knife',
  WAND: 'wand',
  BOW: 'bow',
  AXE: 'axe',
  BIBLE: 'bible',
  GARLIC: 'garlic',
  CROSS: 'cross',
  PUNCH: 'punch',
  LIGHTNING: 'lightning',
  BEAM: 'beam',
  LASER: 'laser',
  POOL: 'pool',
  PING: 'ping',
  SHARD: 'shard',
  FORK: 'fork',
  BRIDGE: 'bridge',
  ANCHOR: 'anchor',
} as const;
