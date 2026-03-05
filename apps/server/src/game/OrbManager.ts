/**
 * OrbManager — Orb 생성/관리/수집
 * natural orb 유지, death orb 분해, boost trail
 */

import type { Orb, OrbType, Position, ArenaConfig } from '@snake-arena/shared';
import { randomPositionInCircle } from '@snake-arena/shared';
import { ORB, EFFECT_CONFIG } from '@snake-arena/shared';

export class OrbManager {
  private orbs: Map<number, Orb> = new Map();
  private nextId = 0;
  private config: ArenaConfig;

  constructor(config: ArenaConfig) {
    this.config = config;
  }

  /** 초기 orb 스폰 */
  initialize(): void {
    for (let i = 0; i < this.config.naturalOrbTarget; i++) {
      this.spawnOrb();
    }
  }

  /** 오브 생성 (확률적 특수 오브 포함) */
  private spawnOrb(): Orb {
    const roll = Math.random();
    let type: OrbType = 'natural';
    if (roll < EFFECT_CONFIG.mega.spawnChance) {
      type = 'mega';
    } else if (roll < EFFECT_CONFIG.mega.spawnChance + EFFECT_CONFIG.ghost.spawnChance) {
      type = 'ghost';
    } else if (roll < EFFECT_CONFIG.mega.spawnChance + EFFECT_CONFIG.ghost.spawnChance + EFFECT_CONFIG.magnet.spawnChance) {
      type = 'magnet';
    } else if (roll < EFFECT_CONFIG.mega.spawnChance + EFFECT_CONFIG.ghost.spawnChance + EFFECT_CONFIG.magnet.spawnChance + EFFECT_CONFIG.speed.spawnChance) {
      type = 'speed';
    }

    const isSpecial = type !== 'natural';
    const orb: Orb = {
      id: this.nextId++,
      position: this.weightedRandomPosition(),
      value: this.getOrbValue(type),
      color: this.getOrbColor(type),
      type,
      createdAt: 0,
      lifetime: isSpecial ? (EFFECT_CONFIG as Record<string, { lifetime?: number }>)[type]?.lifetime ?? 600 : undefined,
    };
    this.orbs.set(orb.id, orb);
    return orb;
  }

  private getOrbValue(type: OrbType): number {
    if (type === 'mega') return EFFECT_CONFIG.mega.value;
    if (type === 'magnet' || type === 'speed' || type === 'ghost') return 0;
    return ORB.NATURAL_VALUE_MIN + Math.floor(Math.random() * (ORB.NATURAL_VALUE_MAX - ORB.NATURAL_VALUE_MIN + 1));
  }

  private getOrbColor(type: OrbType): number {
    if (type === 'magnet') return EFFECT_CONFIG.magnet.orbColor;
    if (type === 'speed') return EFFECT_CONFIG.speed.orbColor;
    if (type === 'ghost') return EFFECT_CONFIG.ghost.orbColor;
    if (type === 'mega') return EFFECT_CONFIG.mega.orbColor;
    return Math.floor(Math.random() * ORB.COLOR_COUNT);
  }

  /** 존 기반 가중 랜덤 위치 (외곽에 더 많은 오브) */
  private weightedRandomPosition(): Position {
    const roll = Math.random();
    let radius: number;
    if (roll < 0.2) {
      radius = Math.random() * this.config.radius * 0.35;
    } else if (roll < 0.6) {
      radius = this.config.radius * 0.35 + Math.random() * this.config.radius * 0.4;
    } else {
      radius = this.config.radius * 0.75 + Math.random() * this.config.radius * 0.25;
    }
    radius = Math.max(0, radius - ORB.SPAWN_PADDING);
    const angle = Math.random() * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  /** orb 수 유지 (매 틱) */
  maintainNaturalOrbs(currentTick: number): void {
    const naturalCount = this.countByType('natural');
    const deficit = this.config.naturalOrbTarget - naturalCount;
    for (let i = 0; i < Math.min(deficit, 10); i++) {
      const orb = this.spawnOrb();
      orb.createdAt = currentTick;
    }
  }

  /** 뱀 사망 시 body → death orbs 분해 */
  decomposeSnake(segments: Position[], mass: number, currentTick: number): void {
    const orbMass = mass * this.config.deathOrbRatio;
    const orbCount = Math.max(1, Math.floor(segments.length * 0.5));
    const valuePerOrb = orbMass / orbCount;

    for (let i = 0; i < orbCount; i++) {
      const segIdx = Math.floor((i / orbCount) * segments.length);
      const seg = segments[segIdx];
      // 약간의 랜덤 오프셋
      const orb: Orb = {
        id: this.nextId++,
        position: {
          x: seg.x + (Math.random() - 0.5) * 20,
          y: seg.y + (Math.random() - 0.5) * 20,
        },
        value: Math.max(1, Math.round(valuePerOrb)),
        color: Math.floor(Math.random() * ORB.COLOR_COUNT),
        type: 'death',
        createdAt: currentTick,
      };
      this.orbs.set(orb.id, orb);
    }
  }

  /** v10: 에이전트 사망 시 position 기반 death orbs 생성 */
  decomposeAgent(position: Position, mass: number, currentTick: number): void {
    const orbMass = mass * this.config.deathOrbRatio;
    // 세그먼트 없으므로 mass 기반 오브 수 (5~15개)
    const orbCount = Math.max(5, Math.min(15, Math.floor(mass / 3)));
    const valuePerOrb = orbMass / orbCount;

    for (let i = 0; i < orbCount; i++) {
      // position 주위 원형 산포
      const angle = (i / orbCount) * Math.PI * 2;
      const spread = 20 + Math.random() * 30;
      const orb: Orb = {
        id: this.nextId++,
        position: {
          x: position.x + Math.cos(angle) * spread,
          y: position.y + Math.sin(angle) * spread,
        },
        value: Math.max(1, Math.round(valuePerOrb)),
        color: Math.floor(Math.random() * ORB.COLOR_COUNT),
        type: 'death',
        createdAt: currentTick,
      };
      this.orbs.set(orb.id, orb);
    }
  }

  /** boost trail orb 생성 */
  spawnTrailOrb(position: Position, currentTick: number): void {
    const orb: Orb = {
      id: this.nextId++,
      position: { x: position.x, y: position.y },
      value: this.config.trailOrbValue,
      color: Math.floor(Math.random() * ORB.COLOR_COUNT),
      type: 'boost_trail',
      createdAt: currentTick,
      lifetime: this.config.trailOrbLifetime,
    };
    this.orbs.set(orb.id, orb);
  }

  /** trail orb 만료 처리 */
  removeExpiredOrbs(currentTick: number): void {
    for (const [id, orb] of this.orbs) {
      if (orb.lifetime !== undefined) {
        if (currentTick - orb.createdAt >= orb.lifetime) {
          this.orbs.delete(id);
        }
      }
    }
  }

  /** orb 제거 (수집됨) */
  removeOrb(id: number): boolean {
    return this.orbs.delete(id);
  }

  getAll(): IterableIterator<Orb> {
    return this.orbs.values();
  }

  getCount(): number {
    return this.orbs.size;
  }

  private countByType(type: OrbType): number {
    let count = 0;
    for (const orb of this.orbs.values()) {
      if (orb.type === type) count++;
    }
    return count;
  }
}
