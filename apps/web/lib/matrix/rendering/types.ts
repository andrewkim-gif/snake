/**
 * game/rendering/types.ts - 렌더링 모듈 공통 타입 정의
 */

// ===== 기본 렌더링 컨텍스트 =====

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  t: number; // 타임스탬프 (밀리초)
}

// ===== 보스 렌더링 =====

export interface BossRenderParams extends RenderContext {
  bossId: number;
  isHit: boolean;
  hover: number; // 호버 애니메이션 오프셋
}

// ===== 적 렌더링 =====

export type EnemyType =
  | 'glitch' | 'bot' | 'malware' | 'whale'
  | 'sniper' | 'caster' | 'artillery'
  | 'bitling' | 'spammer' | 'crypter' | 'ransomer'
  | 'trojan' | 'worm' | 'rootkit' | 'keylogger'
  | 'adware' | 'spyware' | 'botnet' | 'zeroday'
  | 'skynet';

export interface EnemyRenderParams extends RenderContext {
  type: EnemyType;
  x: number;
  y: number;
  size: number;
  isHit: boolean;
  angle?: number;
  variant?: number;
}

// ===== 투사체 렌더링 =====

export type ProjectileType =
  | 'knife' | 'wand' | 'whip' | 'axe' | 'bible' | 'garlic'
  | 'bow' | 'lightning' | 'beam' | 'laser' | 'pool'
  | 'ping' | 'punch' | 'phishing' | 'stablecoin'
  | 'fork' | 'shard' | 'bridge' | 'commit';

export interface ProjectileRenderParams extends RenderContext {
  type: ProjectileType;
  x: number;
  y: number;
  radius: number;
  angle?: number;
  progress?: number;
  color?: string;
}

// ===== 캐릭터 렌더링 =====

export type CharacterId =
  | 'neo' | 'tank' | 'cypher' | 'morpheus'
  | 'niobe' | 'oracle' | 'trinity' | 'mouse' | 'dozer';

export interface CharacterStyle {
  hair: string;
  acc?: string;
  eye?: string;
}

export interface CharacterColors {
  skin: string;
  hair: string;
  top: string;
  pants: string;
  shoes: string;
  acc?: string;
  acc2?: string;
}

export interface CharacterRenderParams extends RenderContext {
  characterId: CharacterId;
  x: number;
  y: number;
  direction: number; // -1 left, 1 right
  isMoving: boolean;
  isHit?: boolean;
  skinId?: string;
}

// ===== 환경 렌더링 =====

export interface FloorTileParams extends RenderContext {
  x: number;
  y: number;
  size: number;
  variant?: number;
}

export interface ObstacleParams extends RenderContext {
  x: number;
  y: number;
  type: string;
  size: number;
}

// ===== 유틸리티 타입 =====

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
