/**
 * Arena — 영구 게임 루프 (20Hz)
 * 순수 오케스트레이터: 틱 루프 + 서브시스템 위임
 */

import type {
  ArenaConfig, Position, StatePayload, MinimapPayload,
  OrbType, EffectType,
} from '@snake-arena/shared';
import { EFFECT_CONFIG } from '@snake-arena/shared';
import { ARENA_CONFIG, NETWORK } from '@snake-arena/shared';
import { SnakeEntity } from './Snake';
import { OrbManager } from './OrbManager';
import { SpatialHash } from './SpatialHash';
import { CollisionSystem, type DeathEvent } from './CollisionSystem';
import { LeaderboardManager } from './LeaderboardManager';
import { StateSerializer } from './StateSerializer';
import { BotManager } from './BotManager';

export class Arena {
  private config: ArenaConfig;
  private snakes: Map<string, SnakeEntity> = new Map();
  private orbManager: OrbManager;
  private spatialHash: SpatialHash;
  private collisionSystem: CollisionSystem;
  private leaderboardManager: LeaderboardManager;
  private serializer: StateSerializer;
  private botManager: BotManager;
  private tick = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private tickDuration = 0;
  private lastTickDeaths: DeathEvent[] = [];

  constructor(config: ArenaConfig = ARENA_CONFIG, botCount = 20) {
    this.config = config;
    this.orbManager = new OrbManager(config);
    this.spatialHash = new SpatialHash(config.radius);
    this.collisionSystem = new CollisionSystem();
    this.leaderboardManager = new LeaderboardManager();
    this.serializer = new StateSerializer();
    this.botManager = new BotManager(botCount);
  }

  start(): void {
    this.orbManager.initialize();
    this.botManager.initialize(this);
    const tickMs = 1000 / this.config.tickRate;
    this.interval = setInterval(() => this.gameLoop(), tickMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.botManager.removeAll(this);
  }

  // ─── Player Management ───

  addPlayer(id: string, name: string, skinId: number): SnakeEntity {
    const snake = new SnakeEntity(id, name, this.config, skinId);
    this.snakes.set(id, snake);
    return snake;
  }

  removePlayer(id: string): void {
    const snake = this.snakes.get(id);
    if (snake && snake.isAlive) {
      this.orbManager.decomposeSnake(snake.data.segments, snake.data.mass, this.tick);
    }
    this.snakes.delete(id);
  }

  respawnPlayer(id: string, name?: string, skinId?: number): Position | null {
    const snake = this.snakes.get(id);
    if (!snake) return null;
    snake.respawn(this.config, name, skinId);
    return snake.head;
  }

  applyInput(id: string, angle: number, boost: boolean, seq: number): void {
    const snake = this.snakes.get(id);
    if (snake?.isAlive) {
      snake.applyInput(angle, boost, seq);
    }
  }

  getPlayerCount(): number { return this.snakes.size; }
  /** 실제 사람 플레이어 수 (봇 제외) */
  getHumanPlayerCount(): number {
    let count = 0;
    for (const id of this.snakes.keys()) {
      if (!this.botManager.isBot(id)) count++;
    }
    return count;
  }
  getOrbCount(): number { return this.orbManager.getCount(); }
  getTick(): number { return this.tick; }
  getTickDuration(): number { return this.tickDuration; }

  // ─── Game Loop ───

  private gameLoop(): void {
    const start = performance.now();
    this.tick++;

    // 0. Bot AI — movement 전에 입력 결정
    this.botManager.update(this);

    // 1-2. Movement
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive) continue;
      snake.update(this.config);
      // speed 효과 중에는 trail orb 미생성
      if (snake.data.boosting && !snake.hasEffect('speed') &&
          snake.trailCounter % this.config.trailOrbInterval === 0) {
        const tail = snake.data.segments[snake.data.segments.length - 1];
        this.orbManager.spawnTrailOrb(tail, this.tick);
      }
    }

    // 3. Spatial Hash 재구성
    this.spatialHash.clear();
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive) continue;
      for (let i = 0; i < snake.data.segments.length; i++) {
        this.spatialHash.insertSegment(snake.data.id, i, snake.data.segments[i]);
      }
    }
    for (const orb of this.orbManager.getAll()) {
      this.spatialHash.insertOrb(orb);
    }

    // 4-5. Collision — 위임 (death events 저장 → Broadcaster에서 소비)
    const deaths = this.collisionSystem.detectAll(this.snakes, this.spatialHash, this.config);
    this.lastTickDeaths = deaths;
    this.collisionSystem.processDeaths(deaths, this.snakes, this.orbManager, this.tick);

    // 5.5 효과 처리 (magnet pull + 효과 만료)
    this.processEffects();

    // 6. Orb 수집
    this.collectOrbs();

    // 7. Leaderboard — 위임
    if (this.tick % NETWORK.LEADERBOARD_INTERVAL === 0) {
      this.leaderboardManager.update(this.snakes);
    }

    // 8. Orb 유지
    this.orbManager.maintainNaturalOrbs(this.tick);
    if (this.tick % 20 === 0) {
      this.orbManager.removeExpiredOrbs(this.tick);
    }

    this.tickDuration = performance.now() - start;
  }

  private collectOrbs(): void {
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive) continue;
      const magnetActive = snake.hasEffect('magnet');
      const r = magnetActive
        ? this.config.collectRadius + EFFECT_CONFIG.magnet.pullRadius
        : this.config.collectRadius;
      const nearbyOrbs = this.spatialHash.queryOrbs(snake.head, r);
      for (const orb of nearbyOrbs) {
        const dx = snake.head.x - orb.position.x;
        const dy = snake.head.y - orb.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < r * r) {
          this.processOrbCollection(snake, orb);
        }
      }
    }
  }

  private processOrbCollection(snake: SnakeEntity, orb: import('@snake-arena/shared').Orb): void {
    const effectTypes: Record<string, EffectType> = { magnet: 'magnet', speed: 'speed', ghost: 'ghost' };
    const effectType = effectTypes[orb.type];
    if (effectType) {
      if (snake.canPickupEffect(effectType, this.tick)) {
        const cfg = EFFECT_CONFIG[effectType];
        snake.addEffect(effectType, cfg.durationTicks, this.tick);
      }
    } else {
      snake.addMass(orb.value);
    }
    this.orbManager.removeOrb(orb.id);
  }

  private processEffects(): void {
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive) continue;
      snake.removeExpiredEffects(this.tick);

      if (snake.hasEffect('magnet')) {
        const nearbyOrbs = this.spatialHash.queryOrbs(snake.head, EFFECT_CONFIG.magnet.pullRadius);
        for (const orb of nearbyOrbs) {
          const dx = snake.head.x - orb.position.x;
          const dy = snake.head.y - orb.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            orb.position.x += (dx / dist) * EFFECT_CONFIG.magnet.pullSpeed;
            orb.position.y += (dy / dist) * EFFECT_CONFIG.magnet.pullSpeed;
          }
        }
      }
    }
  }

  // ─── State Broadcasting (위임) ───

  getStateForPlayer(playerId: string, viewportWidth: number, viewportHeight: number): StatePayload | null {
    return this.serializer.getStateForPlayer(
      playerId, viewportWidth, viewportHeight,
      this.snakes, this.orbManager,
      this.leaderboardManager.getEntries(), this.tick,
    );
  }

  getMinimapForPlayer(playerId: string): MinimapPayload {
    return this.serializer.getMinimapForPlayer(playerId, this.snakes, this.config.radius);
  }

  getDeathInfo(playerId: string): { score: number; length: number; kills: number; duration: number; rank: number } | null {
    return this.serializer.getDeathInfo(playerId, this.snakes, this.leaderboardManager.getEntries());
  }

  /** 이번 틱 사망 이벤트 소비 (한 번 읽으면 비움) */
  consumeLastTickDeaths(): DeathEvent[] {
    const deaths = this.lastTickDeaths;
    this.lastTickDeaths = [];
    return deaths;
  }

  /** 뱀 이름 조회 (kill 이벤트용) */
  getSnakeName(id: string): string | null {
    return this.snakes.get(id)?.data.name ?? null;
  }

  /** 뱀 mass 조회 (kill 이벤트용) */
  getSnakeMass(id: string): number {
    return this.snakes.get(id)?.data.mass ?? 0;
  }

  /** 봇 AI용: 스네이크 엔티티 조회 */
  getSnakeById(id: string): SnakeEntity | undefined {
    return this.snakes.get(id);
  }

  /** 봇 AI용: 아레나 설정 조회 */
  getConfig(): ArenaConfig {
    return this.config;
  }

  /** 봇 AI용: 가장 가까운 orb 위치 반환 */
  findNearestOrb(pos: Position, searchRadius: number): Position | null {
    const orbs = this.spatialHash.queryOrbs(pos, searchRadius);
    if (orbs.length === 0) return null;

    let nearest = orbs[0];
    let minDist = Infinity;
    for (const orb of orbs) {
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = orb;
      }
    }
    return nearest.position;
  }

  /** 봇 AI용: 근처 다른 뱀 머리 검색 (위협 회피) */
  findNearbySnakeHead(excludeId: string, pos: Position, radius: number): Position | null {
    const rSq = radius * radius;
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive || snake.data.id === excludeId) continue;
      const h = snake.head;
      const dx = h.x - pos.x;
      const dy = h.y - pos.y;
      if (dx * dx + dy * dy < rSq) {
        return h;
      }
    }
    return null;
  }

  /** 봇 AI용: 근처 뱀 데이터 배열 반환 */
  getNearbySnakes(excludeId: string, pos: Position, radius: number): import('@snake-arena/shared').Snake[] {
    const rSq = radius * radius;
    const result: import('@snake-arena/shared').Snake[] = [];
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive || snake.data.id === excludeId) continue;
      const h = snake.head;
      const dx = h.x - pos.x;
      const dy = h.y - pos.y;
      if (dx * dx + dy * dy < rSq) {
        result.push(snake.data);
      }
    }
    return result;
  }

  /** 봇 AI용: 가장 가까운 파워업 오브 위치 */
  findNearestPowerUpOrb(pos: Position, searchRadius: number): Position | null {
    const orbs = this.spatialHash.queryOrbs(pos, searchRadius);
    let nearest: Position | null = null;
    let minDist = Infinity;
    for (const orb of orbs) {
      if (orb.type !== 'magnet' && orb.type !== 'speed' && orb.type !== 'ghost' && orb.type !== 'mega') continue;
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = orb.position;
      }
    }
    return nearest;
  }

  /** 봇 AI용: 특정 타입의 가장 가까운 오브 */
  findNearestOrbByType(pos: Position, searchRadius: number, type: OrbType): Position | null {
    const orbs = this.spatialHash.queryOrbs(pos, searchRadius);
    let nearest: Position | null = null;
    let minDist = Infinity;
    for (const orb of orbs) {
      if (orb.type !== type) continue;
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = orb.position;
      }
    }
    return nearest;
  }
}
