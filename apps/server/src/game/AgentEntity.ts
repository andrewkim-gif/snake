/**
 * Agent Entity — v10 서버 사이드 에이전트 관리
 * Snake→Agent: segments 제거, position 단일화, level/xp/build 추가
 */

import type {
  Agent, AgentSkin, Position, ArenaConfig, EffectType,
  PlayerBuild, TomeType, AbilityType, UpgradeChoice,
} from '@snake-arena/shared';
import {
  normalizeAngle, angleDiff, angleToVector,
  randomPositionInCircle, clamp,
} from '@snake-arena/shared';
import { DEFAULT_SKINS, XP_TABLE, MAX_LEVEL, TOME_DEFS, COMBAT_CONFIG } from '@snake-arena/shared';

/** 빈 빌드 생성 */
function createEmptyBuild(): PlayerBuild {
  return {
    tomes: {
      xp: 0, speed: 0, damage: 0, armor: 0,
      magnet: 0, luck: 0, regen: 0, cursed: 0,
    },
    abilities: [],
  };
}

/** mass 기반 히트박스 반경 계산 */
function calcHitboxRadius(mass: number, config: ArenaConfig): number {
  // mass 10 → 16px, mass 100+ → 22px (선형 보간)
  const t = clamp((mass - 10) / 90, 0, 1);
  return config.hitboxBaseRadius + t * (config.hitboxMaxRadius - config.hitboxBaseRadius);
}

/** SnakeSkin에서 AgentSkin 변환 (하위 호환) */
function toAgentSkin(skinId: number): AgentSkin {
  const snake = DEFAULT_SKINS[clamp(skinId, 0, DEFAULT_SKINS.length - 1)];
  return {
    id: snake.id,
    primaryColor: snake.primaryColor,
    secondaryColor: snake.secondaryColor,
    pattern: snake.pattern,
    eyeStyle: snake.eyeStyle,
    accentColor: snake.accentColor,
  };
}

export class AgentEntity {
  data: Agent;

  constructor(id: string, name: string, config: ArenaConfig, skinId: number = 0) {
    const spawn = randomPositionInCircle(config.radius * 0.6);
    const heading = normalizeAngle(Math.random() * Math.PI * 2);

    this.data = {
      id,
      name,
      position: spawn,
      heading,
      targetAngle: heading,
      speed: config.baseSpeed,
      mass: config.initialMass,
      level: 1,
      xp: 0,
      xpToNext: XP_TABLE[1],
      boosting: false,
      alive: true,
      build: createEmptyBuild(),
      activeSynergies: [],
      skin: toAgentSkin(skinId),
      activeEffects: [],
      effectCooldowns: [],
      score: 0,
      kills: 0,
      bestScore: 0,
      joinedAt: Date.now(),
      lastInputSeq: 0,
      hitboxRadius: calcHitboxRadius(config.initialMass, config),
      lastDamagedBy: null,
      killStreak: 0,
      pendingUpgradeChoices: null,
      upgradeDeadlineTick: 0,
    };
  }

  /** position 편의 getter */
  get position(): Position {
    return this.data.position;
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

  /** 물리 업데이트 (매 틱) — segments 없이 단순화 */
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

    // 2. 부스트 처리
    // Speed Tome 적용: 기본 속도 증가
    const speedTomeBonus = 1 + this.data.build.tomes.speed * (TOME_DEFS.speed.effectPerStack);
    const effectiveBaseSpeed = config.baseSpeed * speedTomeBonus;

    const hasSpeedEffect = this.hasEffect('speed');
    if (this.data.boosting && (this.data.mass > config.minBoostMass || hasSpeedEffect)) {
      this.data.speed = config.boostSpeed;
      if (!hasSpeedEffect) {
        // Speedster 시너지: 부스트 비용 감소
        let boostCost = config.boostCostPerTick;
        if (this.data.activeSynergies.includes('speedster')) {
          boostCost *= 0.5;
        }
        this.data.mass -= boostCost;
      }
    } else {
      this.data.speed = effectiveBaseSpeed;
      this.data.boosting = false;
    }

    // 3. 위치 이동 (세그먼트 추적 없음)
    const moveDistance = this.data.speed / config.tickRate;
    const dir = angleToVector(this.data.heading);
    this.data.position = {
      x: this.data.position.x + dir.x * moveDistance,
      y: this.data.position.y + dir.y * moveDistance,
    };

    // 4. 히트박스 업데이트
    this.data.hitboxRadius = calcHitboxRadius(this.data.mass, config);

    // 5. Regen Tome 회복
    const regenStacks = this.data.build.tomes.regen;
    if (regenStacks > 0) {
      this.data.mass += regenStacks * TOME_DEFS.regen.effectPerStack;
    }

    // 6. 점수 = 현재 mass
    this.data.score = Math.floor(this.data.mass);
    if (this.data.score > this.data.bestScore) {
      this.data.bestScore = this.data.score;
    }
  }

  /** mass 추가 (orb 수집) */
  addMass(value: number): void {
    this.data.mass += value;
  }

  /** XP 추가 (XP Tome 보너스 적용) — 레벨업 여부 반환 */
  addXp(baseXp: number): boolean {
    if (this.data.level >= MAX_LEVEL) return false;

    // XP Tome 보너스
    let xpMultiplier = 1 + this.data.build.tomes.xp * TOME_DEFS.xp.effectPerStack;
    // Holy Trinity 시너지
    if (this.data.activeSynergies.includes('holy_trinity')) {
      xpMultiplier *= 1.5;
    }

    this.data.xp += Math.floor(baseXp * xpMultiplier);

    // 레벨업 체크
    if (this.data.xp >= this.data.xpToNext) {
      this.data.xp -= this.data.xpToNext;
      this.data.level++;
      this.data.xpToNext = this.data.level < XP_TABLE.length
        ? XP_TABLE[this.data.level]
        : 999999;
      return true;
    }
    return false;
  }

  /** 오라 DPS 계산 (Tome + 시너지 적용) */
  getAuraDps(config: ArenaConfig): number {
    let dps = config.auraDpsPerTick;

    // Damage Tome
    dps *= (1 + this.data.build.tomes.damage * TOME_DEFS.damage.effectPerStack);
    // Cursed Tome DPS 보너스
    dps *= (1 + this.data.build.tomes.cursed * TOME_DEFS.cursed.effectPerStack);
    // 고레벨 보너스
    if (this.data.level >= COMBAT_CONFIG.HIGH_LEVEL_THRESHOLD) {
      dps *= (1 + COMBAT_CONFIG.HIGH_LEVEL_DPS_BONUS);
    }
    // Glass Cannon 시너지
    if (this.data.activeSynergies.includes('glass_cannon')) {
      dps *= 2.0;
    }

    return dps;
  }

  /** 받는 데미지 감소율 계산 */
  getDamageReduction(): number {
    let reduction = this.data.build.tomes.armor * TOME_DEFS.armor.effectPerStack;
    // Iron Fortress 시너지
    if (this.data.activeSynergies.includes('iron_fortress')) {
      reduction += 0.30;
    }
    // Cursed Tome 피해 증가 (감소를 상쇄)
    const cursedPenalty = this.data.build.tomes.cursed * 0.20;
    // Glass Cannon 시너지
    if (this.data.activeSynergies.includes('glass_cannon')) {
      return Math.max(0, reduction - cursedPenalty - 1.0); // ×2 피해 = -100% 감소
    }
    return Math.max(0, Math.min(0.90, reduction - cursedPenalty)); // 최대 90% 감소
  }

  /** 데미지 적용 (armor 계산 포함) */
  takeDamage(rawDamage: number, attackerId: string | null): void {
    const reduction = this.getDamageReduction();
    const actualDamage = rawDamage * (1 - reduction);
    this.data.mass -= actualDamage;
    if (attackerId) {
      this.data.lastDamagedBy = attackerId;
    }
    if (this.data.mass <= 0) {
      this.data.mass = 0;
    }
  }

  /** Shield Burst 보유 여부 */
  hasShield(): boolean {
    return this.data.build.abilities.some(a => a.type === 'shield_burst');
  }

  // ─── 효과 시스템 (기존 유지) ───

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
    this.data.killStreak = 0;
  }

  /** 리스폰 (v10: 빌드/XP 초기화) */
  respawn(config: ArenaConfig, name?: string, skinId?: number): void {
    const spawn = randomPositionInCircle(config.radius * 0.6);
    const heading = normalizeAngle(Math.random() * Math.PI * 2);

    if (name) this.data.name = name;
    if (skinId !== undefined) {
      this.data.skin = toAgentSkin(skinId);
    }

    this.data.position = spawn;
    this.data.heading = heading;
    this.data.targetAngle = heading;
    this.data.speed = config.baseSpeed;
    this.data.mass = config.initialMass;
    this.data.level = 1;
    this.data.xp = 0;
    this.data.xpToNext = XP_TABLE[1];
    this.data.boosting = false;
    this.data.alive = true;
    this.data.build = createEmptyBuild();
    this.data.activeSynergies = [];
    this.data.activeEffects = [];
    this.data.effectCooldowns = [];
    this.data.score = 0;
    this.data.kills = 0;
    this.data.hitboxRadius = calcHitboxRadius(config.initialMass, config);
    this.data.lastDamagedBy = null;
    this.data.killStreak = 0;
    this.data.pendingUpgradeChoices = null;
    this.data.upgradeDeadlineTick = 0;
  }

  /** Orb 수집 범위 (Magnet Tome 적용) */
  getCollectRadius(config: ArenaConfig): number {
    const magnetBonus = 1 + this.data.build.tomes.magnet * TOME_DEFS.magnet.effectPerStack;
    return config.collectRadius * magnetBonus;
  }

  /** Kill Streak XP 배율 계산 */
  getKillStreakMultiplier(): number {
    if (this.data.killStreak >= 10) return 3.0;
    if (this.data.killStreak >= 5) return 2.0;
    if (this.data.killStreak >= 3) return 1.5;
    return 1.0;
  }
}
