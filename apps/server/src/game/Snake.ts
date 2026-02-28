/**
 * Snake Entity — 서버 사이드 뱀 관리
 * 연속 이동, 각도 기반, mass 시스템
 */

import type { Snake, Position, SnakeSkin, ArenaConfig, EffectType } from '@snake-arena/shared';
import {
  normalizeAngle, angleDiff, angleToVector,
  randomPositionInCircle, clamp, getDynamicSpacing,
} from '@snake-arena/shared';
import { DEFAULT_SKINS } from '@snake-arena/shared';

export class SnakeEntity {
  data: Snake;
  /** boost trail 생성 카운터 */
  trailCounter = 0;

  constructor(id: string, name: string, config: ArenaConfig, skinId: number = 0) {
    const spawn = randomPositionInCircle(config.radius * 0.6);
    const heading = normalizeAngle(Math.random() * Math.PI * 2);
    const skin: SnakeSkin = DEFAULT_SKINS[clamp(skinId, 0, DEFAULT_SKINS.length - 1)];

    // 초기 세그먼트 생성 (머리 뒤로 일직선, 동적 간격)
    const segments: Position[] = [];
    const backDir = angleToVector(heading + Math.PI); // 머리 반대 방향
    const initSpacing = getDynamicSpacing(config.segmentSpacing, config.initialMass);
    for (let i = 0; i < config.initialMass; i++) {
      segments.push({
        x: spawn.x + backDir.x * initSpacing * i,
        y: spawn.y + backDir.y * initSpacing * i,
      });
    }

    this.data = {
      id,
      name,
      segments,
      heading,
      targetAngle: heading,
      speed: config.baseSpeed,
      mass: config.initialMass,
      boosting: false,
      alive: true,
      skin,
      activeEffects: [],
      effectCooldowns: [],
      score: 0,
      kills: 0,
      bestScore: 0,
      joinedAt: Date.now(),
      lastInputSeq: 0,
    };
  }

  get head(): Position {
    return this.data.segments[0];
  }

  get isAlive(): boolean {
    return this.data.alive;
  }

  /** 클라이언트 입력 적용 */
  applyInput(targetAngle: number, boost: boolean, seq: number): void {
    this.data.targetAngle = normalizeAngle(targetAngle);
    this.data.boosting = boost;
    this.data.lastInputSeq = seq;
  }

  /** 물리 업데이트 (매 틱) */
  update(config: ArenaConfig): void {
    if (!this.data.alive) return;

    // 1. 각도 조향 (turn rate 제한)
    const diff = angleDiff(this.data.heading, this.data.targetAngle);
    const maxTurn = config.turnRate;
    if (Math.abs(diff) <= maxTurn) {
      this.data.heading = this.data.targetAngle;
    } else {
      this.data.heading = normalizeAngle(
        this.data.heading + Math.sign(diff) * maxTurn
      );
    }

    // 2. 부스트 처리 (speed 효과: mass 소모 없이 부스트)
    const hasSpeedEffect = this.hasEffect('speed');
    if (this.data.boosting && (this.data.mass > config.minBoostMass || hasSpeedEffect)) {
      this.data.speed = config.boostSpeed;
      if (!hasSpeedEffect) {
        this.data.mass -= config.boostCostPerTick;
      }
      this.trailCounter++;
    } else {
      this.data.speed = config.baseSpeed;
      this.data.boosting = false;
      this.trailCounter = 0;
    }

    // 3. 머리 이동
    const moveDistance = this.data.speed / config.tickRate;
    const dir = angleToVector(this.data.heading);
    const newHead: Position = {
      x: this.data.segments[0].x + dir.x * moveDistance,
      y: this.data.segments[0].y + dir.y * moveDistance,
    };

    // 4. 세그먼트 follow (앞 세그먼트를 추적)
    this.data.segments.unshift(newHead);

    // 세그먼트 수 = mass에 비례
    const targetSegments = Math.max(3, Math.floor(this.data.mass));
    while (this.data.segments.length > targetSegments) {
      this.data.segments.pop();
    }

    // 5. 세그먼트 간격 정규화 (mass 기반 동적 간격)
    const dynamicSpacing = getDynamicSpacing(config.segmentSpacing, this.data.mass);
    for (let i = 1; i < this.data.segments.length; i++) {
      const prev = this.data.segments[i - 1];
      const curr = this.data.segments[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > dynamicSpacing) {
        const ratio = dynamicSpacing / dist;
        this.data.segments[i] = {
          x: prev.x + dx * ratio,
          y: prev.y + dy * ratio,
        };
      }
    }

    // 점수 = 현재 mass
    this.data.score = Math.floor(this.data.mass);
    if (this.data.score > this.data.bestScore) {
      this.data.bestScore = this.data.score;
    }
  }

  /** mass 추가 (orb 수집) */
  addMass(value: number): void {
    this.data.mass += value;
  }

  // ─── 효과 시스템 ───

  addEffect(type: EffectType, durationTicks: number, currentTick: number): void {
    this.data.activeEffects = this.data.activeEffects.filter(e => e.type !== type);
    this.data.activeEffects.push({ type, expiresAt: currentTick + durationTicks });
  }

  removeExpiredEffects(currentTick: number): void {
    const expired = this.data.activeEffects.filter(e => e.expiresAt <= currentTick);
    for (const e of expired) {
      const cooldownMap: Record<EffectType, number> = { magnet: 0, speed: 0, ghost: 200 };
      const cd = cooldownMap[e.type];
      if (cd > 0) {
        this.data.effectCooldowns = this.data.effectCooldowns.filter(c => c.type !== e.type);
        this.data.effectCooldowns.push({ type: e.type, availableAt: currentTick + cd });
      }
    }
    this.data.activeEffects = this.data.activeEffects.filter(e => e.expiresAt > currentTick);
    this.data.effectCooldowns = this.data.effectCooldowns.filter(c => c.availableAt > currentTick);
  }

  hasEffect(type: EffectType): boolean {
    return this.data.activeEffects.some(e => e.type === type);
  }

  canPickupEffect(type: EffectType, currentTick: number): boolean {
    return !this.data.effectCooldowns.some(c => c.type === type && c.availableAt > currentTick);
  }

  /** 사망 처리 */
  die(): void {
    this.data.alive = false;
  }

  /** 리스폰 */
  respawn(config: ArenaConfig, name?: string, skinId?: number): void {
    const spawn = randomPositionInCircle(config.radius * 0.6);
    const heading = normalizeAngle(Math.random() * Math.PI * 2);

    if (name) this.data.name = name;
    if (skinId !== undefined) {
      this.data.skin = DEFAULT_SKINS[clamp(skinId, 0, DEFAULT_SKINS.length - 1)];
    }

    const backDir = angleToVector(heading + Math.PI);
    const segments: Position[] = [];
    const initSpacing = getDynamicSpacing(config.segmentSpacing, config.initialMass);
    for (let i = 0; i < config.initialMass; i++) {
      segments.push({
        x: spawn.x + backDir.x * initSpacing * i,
        y: spawn.y + backDir.y * initSpacing * i,
      });
    }

    this.data.segments = segments;
    this.data.heading = heading;
    this.data.targetAngle = heading;
    this.data.speed = config.baseSpeed;
    this.data.mass = config.initialMass;
    this.data.boosting = false;
    this.data.alive = true;
    this.data.activeEffects = [];
    this.data.effectCooldowns = [];
    this.data.score = 0;
    this.data.kills = 0;
    this.trailCounter = 0;
  }
}
