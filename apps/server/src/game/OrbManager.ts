/**
 * OrbManager — Orb 생성/관리/수집
 * natural orb 유지, death orb 분해, boost trail
 */

import type { Orb, OrbType, Position, ArenaConfig } from '@snake-arena/shared';
import { randomPositionInCircle } from '@snake-arena/shared';
import { ORB } from '@snake-arena/shared';

export class OrbManager {
  private orbs: Map<number, Orb> = new Map();
  private nextId = 0;
  private config: ArenaConfig;

  constructor(config: ArenaConfig) {
    this.config = config;
  }

  /** 초기 natural orb 스폰 */
  initialize(): void {
    for (let i = 0; i < this.config.naturalOrbTarget; i++) {
      this.spawnNaturalOrb();
    }
  }

  /** natural orb 하나 생성 */
  private spawnNaturalOrb(): Orb {
    const orb: Orb = {
      id: this.nextId++,
      position: randomPositionInCircle(this.config.radius, ORB.SPAWN_PADDING),
      value: ORB.NATURAL_VALUE_MIN + Math.floor(Math.random() * (ORB.NATURAL_VALUE_MAX - ORB.NATURAL_VALUE_MIN + 1)),
      color: Math.floor(Math.random() * ORB.COLOR_COUNT),
      type: 'natural',
      createdAt: 0,
    };
    this.orbs.set(orb.id, orb);
    return orb;
  }

  /** natural orb 수 유지 (매 틱) */
  maintainNaturalOrbs(currentTick: number): void {
    const naturalCount = this.countByType('natural');
    const deficit = this.config.naturalOrbTarget - naturalCount;
    for (let i = 0; i < Math.min(deficit, 10); i++) {
      const orb = this.spawnNaturalOrb();
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
