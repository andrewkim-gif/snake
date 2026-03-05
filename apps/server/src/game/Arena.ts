/**
 * Arena v10 — Agent Survivor 게임 루프 (20Hz)
 * Snake→Agent 전환: snakes Map → agents Map
 * 새 시스템: 오라 전투, 대시 충돌, 아레나 수축, 레벨업
 */

import type {
  ArenaConfig, Position, StatePayload, MinimapPayload,
  OrbType, EffectType, Agent,
} from '@snake-arena/shared';
import { EFFECT_CONFIG, XP_SOURCE } from '@snake-arena/shared';
import { ARENA_CONFIG, NETWORK } from '@snake-arena/shared';
import { AgentEntity } from './AgentEntity';
import { OrbManager } from './OrbManager';
import { SpatialHash } from './SpatialHash';
import { CollisionSystem, type DeathEvent } from './CollisionSystem';
import { LeaderboardManager } from './LeaderboardManager';
import { StateSerializer } from './StateSerializer';
import { BotManager } from './BotManager';
import { ArenaShrink } from './ArenaShrink';
import {
  generateUpgradeChoices, applyUpgrade, applyRandomUpgrade, checkSynergies,
} from './UpgradeSystem';
import { MapObjects, type MapObjectEvent } from './MapObjects';
import { AbilityProcessor } from './AbilityProcessor';

export class Arena {
  private config: ArenaConfig;
  private agents: Map<string, AgentEntity> = new Map();
  private orbManager: OrbManager;
  private spatialHash: SpatialHash;
  private collisionSystem: CollisionSystem;
  private leaderboardManager: LeaderboardManager;
  private serializer: StateSerializer;
  private botManager: BotManager;
  private arenaShrink: ArenaShrink;
  private mapObjects: MapObjects;
  private abilityProcessor: AbilityProcessor;
  private tick = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private tickDuration = 0;
  private lastTickDeaths: DeathEvent[] = [];
  /** 이번 틱에 레벨업한 에이전트 목록 */
  private lastTickLevelUps: Array<{ agentId: string; level: number }> = [];

  constructor(config: ArenaConfig = ARENA_CONFIG, botCount = 20) {
    this.config = config;
    this.orbManager = new OrbManager(config);
    this.spatialHash = new SpatialHash(config.radius);
    this.collisionSystem = new CollisionSystem();
    this.leaderboardManager = new LeaderboardManager();
    this.serializer = new StateSerializer();
    this.botManager = new BotManager(botCount);
    this.arenaShrink = new ArenaShrink(config);
    this.mapObjects = new MapObjects(config.radius);
    this.abilityProcessor = new AbilityProcessor();
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

  addPlayer(id: string, name: string, skinId: number): AgentEntity {
    const agent = new AgentEntity(id, name, this.config, skinId);
    this.agents.set(id, agent);
    return agent;
  }

  removePlayer(id: string): void {
    const agent = this.agents.get(id);
    if (agent && agent.isAlive) {
      this.orbManager.decomposeAgent(agent.position, agent.data.mass, this.tick);
    }
    this.agents.delete(id);
  }

  respawnPlayer(id: string, name?: string, skinId?: number): Position | null {
    const agent = this.agents.get(id);
    if (!agent) return null;
    agent.respawn(this.config, name, skinId);
    return agent.position;
  }

  applyInput(id: string, angle: number, boost: boolean, seq: number): void {
    const agent = this.agents.get(id);
    if (agent?.isAlive) {
      agent.applyInput(angle, boost, seq);
    }
  }

  /** v10: 업그레이드 선택 처리 */
  chooseUpgrade(id: string, choiceId: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    const success = applyUpgrade(agent, choiceId);
    if (success) {
      // 시너지 체크
      const synergies = checkSynergies(agent.data.build);
      const newSynergyIds = synergies.map(s => s.id);
      agent.data.activeSynergies = newSynergyIds;
    }
    return success;
  }

  getPlayerCount(): number { return this.agents.size; }
  getPlayerIds(): IterableIterator<string> { return this.agents.keys(); }

  getHumanPlayerCount(): number {
    let count = 0;
    for (const id of this.agents.keys()) {
      if (!this.botManager.isBot(id)) count++;
    }
    return count;
  }

  getOrbCount(): number { return this.orbManager.getCount(); }

  getLeaderboardEntries(): import('@snake-arena/shared').LeaderboardEntry[] {
    return this.leaderboardManager.getEntries();
  }

  getTick(): number { return this.tick; }
  getTickDuration(): number { return this.tickDuration; }
  getCurrentRadius(): number { return this.arenaShrink.getCurrentRadius(); }

  /** 이번 틱 레벨업 이벤트 소비 */
  consumeLastTickLevelUps(): Array<{ agentId: string; level: number }> {
    const ups = this.lastTickLevelUps;
    this.lastTickLevelUps = [];
    return ups;
  }

  // ─── Game Loop ───

  private gameLoop(): void {
    const start = performance.now();
    this.tick++;
    this.lastTickLevelUps = [];

    // 0. Bot AI
    this.botManager.update(this);

    // 1. Movement
    for (const agent of this.agents.values()) {
      if (!agent.isAlive) continue;
      agent.update(this.config);
    }

    // 2. Arena Shrink
    this.arenaShrink.update(this.agents);

    // 3. Spatial Hash 재구성 (에이전트 위치만)
    this.spatialHash.clear();
    for (const agent of this.agents.values()) {
      if (!agent.isAlive) continue;
      this.spatialHash.insertAgent(agent.data.id, agent.position);
    }
    for (const orb of this.orbManager.getAll()) {
      this.spatialHash.insertOrb(orb);
    }

    // 4. Aura Combat (DPS 교환)
    this.collisionSystem.processAuraCombat(
      this.agents, this.spatialHash, this.config,
      this.tick, this.config.gracePeriodTicks,
    );

    // 5. Dash Collisions
    this.collisionSystem.processDashCollisions(
      this.agents, this.spatialHash, this.config,
    );

    // 5.5 Ability 자동발동 처리 (오라 전투 후, 사망 감지 전)
    this.abilityProcessor.processAbilities(
      this.agents, this.spatialHash, this.orbManager,
      this.tick, this.config,
    );

    // 5.6 Map Objects 업데이트
    const mapEvents = this.mapObjects.update(this.agents, this.tick);
    for (const evt of mapEvents) {
      if (evt.type === 'level_up') {
        const agent = this.agents.get(evt.agentId);
        if (agent?.isAlive) {
          // Altar 즉시 레벨업: XP를 가득 채워서 레벨업 트리거
          const didLevelUp = agent.addXp(agent.data.xpToNext - agent.data.xp);
          if (didLevelUp) {
            this.processLevelUp(agent);
          }
        }
      }
    }

    // 6. Death Detection + Processing
    const currentRadius = this.arenaShrink.getCurrentRadius();
    const deaths = this.collisionSystem.detectDeaths(this.agents, currentRadius);
    this.lastTickDeaths = deaths;
    this.collisionSystem.processDeaths(deaths, this.agents, this.orbManager, this.tick);

    // 6.5 킬러에게 XP 보상
    for (const death of deaths) {
      if (death.killerId) {
        const killer = this.agents.get(death.killerId);
        const victim = this.agents.get(death.snakeId);
        if (killer?.isAlive && victim) {
          const victimLevel = victim.data.level;
          const baseXp = death.damageSource === 'dash'
            ? XP_SOURCE.DASH_KILL_BASE + victimLevel * XP_SOURCE.DASH_KILL_PER_LEVEL
            : XP_SOURCE.AURA_KILL_BASE + victimLevel * XP_SOURCE.AURA_KILL_PER_LEVEL;
          const streakMult = killer.getKillStreakMultiplier();
          const didLevelUp = killer.addXp(Math.floor(baseXp * streakMult));
          if (didLevelUp) {
            this.processLevelUp(killer);
          }
        }
      }
    }

    // 7. Effects
    this.processEffects();

    // 8. Orb 수집 + XP
    this.collectOrbs();

    // 9. Upgrade Timeout 처리
    this.processUpgradeTimeouts();

    // 10. Leaderboard
    if (this.tick % NETWORK.LEADERBOARD_INTERVAL === 0) {
      this.leaderboardManager.updateFromAgents(this.agents);
    }

    // 11. Orb 유지
    this.orbManager.maintainNaturalOrbs(this.tick);
    if (this.tick % 20 === 0) {
      this.orbManager.removeExpiredOrbs(this.tick);
    }

    this.tickDuration = performance.now() - start;
  }

  /** v10: 레벨업 처리 — 선택지 생성 */
  private processLevelUp(agent: AgentEntity): void {
    const choices = generateUpgradeChoices(agent);
    agent.data.pendingUpgradeChoices = choices;
    agent.data.upgradeDeadlineTick = this.tick + this.config.upgradeChoiceTimeout;

    this.lastTickLevelUps.push({
      agentId: agent.data.id,
      level: agent.data.level,
    });
  }

  /** v10: 업그레이드 타임아웃 자동 선택 */
  private processUpgradeTimeouts(): void {
    for (const agent of this.agents.values()) {
      if (!agent.isAlive) continue;
      if (agent.data.pendingUpgradeChoices &&
          this.tick >= agent.data.upgradeDeadlineTick) {
        applyRandomUpgrade(agent);
        // 시너지 체크
        const synergies = checkSynergies(agent.data.build);
        agent.data.activeSynergies = synergies.map(s => s.id);
      }
    }
  }

  private collectOrbs(): void {
    for (const agent of this.agents.values()) {
      if (!agent.isAlive) continue;
      const magnetActive = agent.hasEffect('magnet');
      const baseR = agent.getCollectRadius(this.config);
      const r = magnetActive
        ? baseR + EFFECT_CONFIG.magnet.pullRadius
        : baseR;
      const nearbyOrbs = this.spatialHash.queryOrbs(agent.position, r);
      for (const orb of nearbyOrbs) {
        const dx = agent.position.x - orb.position.x;
        const dy = agent.position.y - orb.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < r * r) {
          this.processOrbCollection(agent, orb);
        }
      }
    }
  }

  private processOrbCollection(agent: AgentEntity, orb: import('@snake-arena/shared').Orb): void {
    const effectTypes: Record<string, EffectType> = { magnet: 'magnet', speed: 'speed', ghost: 'ghost' };
    const effectType = effectTypes[orb.type];
    if (effectType) {
      if (agent.canPickupEffect(effectType, this.tick)) {
        const cfg = EFFECT_CONFIG[effectType];
        agent.addEffect(effectType, cfg.durationTicks, this.tick);
      }
    } else {
      agent.addMass(orb.value);

      // v10: XP도 추가
      let xpAmount: number = XP_SOURCE.NATURAL_ORB;
      if (orb.type === 'death') xpAmount = XP_SOURCE.DEATH_ORB;
      else if (orb.type === 'mega') xpAmount = XP_SOURCE.POWER_UP_ORB;

      // Pacifist 시너지: 오브 가치 ×3
      if (agent.data.activeSynergies.includes('pacifist')) {
        xpAmount *= 3;
      }

      const didLevelUp = agent.addXp(xpAmount);
      if (didLevelUp) {
        this.processLevelUp(agent);
      }
    }
    this.orbManager.removeOrb(orb.id);
  }

  private processEffects(): void {
    for (const agent of this.agents.values()) {
      if (!agent.isAlive) continue;
      agent.removeExpiredEffects(this.tick);

      if (agent.hasEffect('magnet')) {
        const nearbyOrbs = this.spatialHash.queryOrbs(agent.position, EFFECT_CONFIG.magnet.pullRadius);
        for (const orb of nearbyOrbs) {
          const dx = agent.position.x - orb.position.x;
          const dy = agent.position.y - orb.position.y;
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
    const payload = this.serializer.getStateForPlayer(
      playerId, viewportWidth, viewportHeight,
      this.agents, this.orbManager, this.spatialHash,
      this.leaderboardManager.getEntries(), this.tick,
    );
    if (payload) {
      // v10: Map Objects 데이터 추가 (매 5틱마다 — 변경 빈도 낮음)
      if (this.tick % 5 === 0) {
        payload.mo = this.mapObjects.getNetworkData();
      }
    }
    return payload;
  }

  getMinimapForPlayer(playerId: string): MinimapPayload {
    return this.serializer.getMinimapForPlayer(
      playerId, this.agents, this.arenaShrink.getCurrentRadius(),
    );
  }

  getDeathInfo(playerId: string): {
    score: number; length: number; kills: number;
    duration: number; rank: number; level: number;
  } | null {
    return this.serializer.getDeathInfo(
      playerId, this.agents, this.leaderboardManager.getEntries(),
    );
  }

  consumeLastTickDeaths(): DeathEvent[] {
    const deaths = this.lastTickDeaths;
    this.lastTickDeaths = [];
    return deaths;
  }

  // ─── 에이전트 조회 (봇 AI / 이벤트용) ───

  getAgentName(id: string): string | null {
    return this.agents.get(id)?.data.name ?? null;
  }

  getAgentMass(id: string): number {
    return this.agents.get(id)?.data.mass ?? 0;
  }

  getAgentLevel(id: string): number {
    return this.agents.get(id)?.data.level ?? 1;
  }

  getAgentById(id: string): AgentEntity | undefined {
    return this.agents.get(id);
  }

  /** @deprecated v10: getAgentName 사용 */
  getSnakeName(id: string): string | null { return this.getAgentName(id); }
  /** @deprecated v10: getAgentMass 사용 */
  getSnakeMass(id: string): number { return this.getAgentMass(id); }
  /** @deprecated v10: getAgentById 사용 */
  getSnakeById(id: string): AgentEntity | undefined { return this.getAgentById(id); }

  getConfig(): ArenaConfig { return this.config; }

  // ─── 봇 AI 헬퍼 ───

  findNearestOrb(pos: Position, searchRadius: number): Position | null {
    const orbs = this.spatialHash.queryOrbs(pos, searchRadius);
    if (orbs.length === 0) return null;
    let nearest = orbs[0];
    let minDist = Infinity;
    for (const orb of orbs) {
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = orb; }
    }
    return nearest.position;
  }

  findNearbySnakeHead(excludeId: string, pos: Position, radius: number): Position | null {
    const rSq = radius * radius;
    for (const agent of this.agents.values()) {
      if (!agent.isAlive || agent.data.id === excludeId) continue;
      const p = agent.position;
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      if (dx * dx + dy * dy < rSq) return p;
    }
    return null;
  }

  getNearbySnakes(excludeId: string, pos: Position, radius: number): Agent[] {
    const rSq = radius * radius;
    const result: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (!agent.isAlive || agent.data.id === excludeId) continue;
      const p = agent.position;
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      if (dx * dx + dy * dy < rSq) result.push(agent.data);
    }
    return result;
  }

  findNearestPowerUpOrb(pos: Position, searchRadius: number): Position | null {
    const orbs = this.spatialHash.queryOrbs(pos, searchRadius);
    let nearest: Position | null = null;
    let minDist = Infinity;
    for (const orb of orbs) {
      if (orb.type !== 'magnet' && orb.type !== 'speed' && orb.type !== 'ghost' && orb.type !== 'mega') continue;
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = orb.position; }
    }
    return nearest;
  }

  findNearestOrbByType(pos: Position, searchRadius: number, type: OrbType): Position | null {
    const orbs = this.spatialHash.queryOrbs(pos, searchRadius);
    let nearest: Position | null = null;
    let minDist = Infinity;
    for (const orb of orbs) {
      if (orb.type !== type) continue;
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = orb.position; }
    }
    return nearest;
  }
}
