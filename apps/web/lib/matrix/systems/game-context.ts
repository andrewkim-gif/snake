/**
 * GameContext.ts - 게임 시스템 간 공유되는 상태 컨텍스트
 *
 * 모든 게임 시스템이 참조하는 중앙화된 refs와 유틸리티
 */

import React from 'react';
import {
  Player,
  Enemy,
  Projectile,
  EnemyProjectile,
  Gem,
  Pickup,
  Blast,
  LightningBolt,
  DamageNumber,
  Vector2,
} from '../types';

// ExtendedParticle 타입 (useGameRefs에서 정의된 것을 re-export)
import type { ExtendedParticle } from '../hooks/useGameRefs';
export type { ExtendedParticle };

/**
 * 게임 전체에서 공유되는 상태 refs
 */
export interface GameRefs {
  // Canvas
  canvas: React.RefObject<HTMLCanvasElement>;

  // Entities
  player: React.MutableRefObject<Player>;
  enemies: React.MutableRefObject<Enemy[]>;
  projectiles: React.MutableRefObject<Projectile[]>;
  enemyProjectiles: React.MutableRefObject<EnemyProjectile[]>;
  gems: React.MutableRefObject<Gem[]>;
  pickups: React.MutableRefObject<Pickup[]>;
  blasts: React.MutableRefObject<Blast[]>;
  lightningBolts: React.MutableRefObject<LightningBolt[]>;

  // Effects
  particles: React.MutableRefObject<ExtendedParticle[]>;
  damageNumbers: React.MutableRefObject<DamageNumber[]>;

  // Input
  keysPressed: React.MutableRefObject<Set<string>>;
  joystick: React.MutableRefObject<{
    active: boolean;
    origin: Vector2;
    current: Vector2;
    pointerId: number | null;
  }>;

  // Direction & Timing
  lastFacing: React.MutableRefObject<Vector2>;
  smoothedAutoHuntDir: React.MutableRefObject<Vector2>;
  lastAttackTime: React.MutableRefObject<number>;
  lastDamageTime: React.MutableRefObject<number>;
  lastHitSfx: React.MutableRefObject<number>;
  lastCollectSfx: React.MutableRefObject<number>;

  // Game State Timing
  gameTime: React.MutableRefObject<number>;
  stageTime: React.MutableRefObject<number>;
  frameCount: React.MutableRefObject<number>;
  lastSpawnTime: React.MutableRefObject<number>;

  // Screen Effects
  screenFlash: React.MutableRefObject<number>;
  screenShakeTimer: React.MutableRefObject<number>;

  // Stage State
  currentStageId: React.MutableRefObject<number>;
  bossSpawned: React.MutableRefObject<boolean>;
  warningTriggered: React.MutableRefObject<boolean>;

  // Auto Hunt
  lastAutoHuntPos: React.MutableRefObject<Vector2>;
  stuckFrameCount: React.MutableRefObject<number>;
  escapeDir: React.MutableRefObject<Vector2 | null>;
}

/**
 * 시스템들이 GameCanvas에 결과를 알리기 위한 콜백
 */
export interface GameCallbacks {
  onScoreUpdate: (score: number) => void;
  onHealthUpdate: (hp: number) => void;
  onXpUpdate: (xp: number, nextXp: number, level: number) => void;
  onTimeUpdate: (time: number) => void;
  onLevelUp: () => void;
  onGameOver: (score: number) => void;
  onDamageTaken: () => void;
  onSpecialUpdate: (cooldown: number) => void;
  onBossSpawn: () => void;
  onBossUpdate: (boss: Enemy | null) => void;
  onBossDefeated: () => void;
  onBossWarning: (bossType: string) => void;
  onChestCollected: () => void;
}

/**
 * 게임 시스템에 전달되는 전체 컨텍스트
 */
export interface GameContext {
  refs: GameRefs;
  callbacks: GameCallbacks;
}

/**
 * 화면에 보이는 적들 가져오기
 */
export const getEnemiesOnScreen = (
  enemies: Enemy[],
  camX: number,
  camY: number,
  width: number,
  height: number
): Enemy[] => {
  return enemies.filter((e) => {
    if (e.state === 'dying') return false;
    const ex = e.position.x + camX;
    const ey = e.position.y + camY;
    return ex > 0 && ex < width && ey > 0 && ey < height;
  });
};

/**
 * 가장 가까운 적 찾기
 */
export const getNearestEnemy = (
  position: Vector2,
  enemies: Enemy[],
  maxRange: number = 1000
): Enemy | null => {
  let nearest: Enemy | null = null;
  let minDist = maxRange;

  for (const enemy of enemies) {
    if (enemy.state === 'dying') continue;
    const dx = enemy.position.x - position.x;
    const dy = enemy.position.y - position.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDist) {
      minDist = d;
      nearest = enemy;
    }
  }

  return nearest;
};

/**
 * 번개 경로 생성
 */
export const generateLightningPoints = (
  start: Vector2,
  end: Vector2,
  segments: number
): Vector2[] => {
  const points: Vector2[] = [start];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const spread = dist * 0.15;
    points.push({
      x: start.x + dx * t + (Math.random() - 0.5) * spread,
      y: start.y + dy * t + (Math.random() - 0.5) * spread,
    });
  }

  points.push(end);
  return points;
};
