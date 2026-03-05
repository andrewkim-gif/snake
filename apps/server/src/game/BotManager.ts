/**
 * BotManager v10 — AI 봇 (행동 트리 + 빌드 패스 기반 레벨업)
 * Snake→Agent: 봇 사망 시 새 봇으로 교체 (리셋 XP/빌드)
 */

import { normalizeAngle } from '@snake-arena/shared';
import type { BotBuildPath } from '@snake-arena/shared';
import { BOT_BUILD_PREFERENCES } from '@snake-arena/shared';
import type { Arena } from './Arena';
import { botChooseUpgrade } from './UpgradeSystem';
import {
  type BotDifficulty, type BotAction,
  behaveSurvive, behaveHunt, behaveGather, behaveWander,
} from './BotBehaviors';

const BOT_NAMES = [
  'Slinky', 'Nibbler', 'Zigzag', 'Viper', 'Comet',
  'Noodle', 'Blitz', 'Shadow', 'Spark', 'Twister',
  'Dash', 'Fang', 'Ripple', 'Echo', 'Bolt',
  'Pixel', 'Ghost', 'Flash', 'Storm', 'Orbit',
];

const BUILD_PATHS: BotBuildPath[] = ['aggressive', 'tank', 'xp_rush', 'balanced', 'glass_cannon'];

interface BotState {
  id: string;
  difficulty: BotDifficulty;
  buildPath: BotBuildPath;
  wanderAngle: number;
  wanderTimer: number;
  boostTimer: number;
  stuckTimer: number;
  lastPosition: { x: number; y: number };
}

export class BotManager {
  private bots: Map<string, BotState> = new Map();
  private botCounter = 0;
  private readonly targetBotCount: number;

  constructor(targetBotCount = 20) {
    this.targetBotCount = targetBotCount;
  }

  initialize(arena: Arena): void {
    for (let i = 0; i < this.targetBotCount; i++) {
      this.spawnBot(arena);
    }
  }

  update(arena: Arena): void {
    // v10: 봇 사망 시 새 봇으로 교체 (기존 봇 제거 + 새 봇 생성)
    const deadBots: string[] = [];
    for (const [botId, bot] of this.bots) {
      const agent = arena.getSnakeById(botId);
      if (!agent || !agent.isAlive) {
        deadBots.push(botId);
      }
    }

    // 사망한 봇 제거 + 새 봇 스폰
    for (const botId of deadBots) {
      this.bots.delete(botId);
      arena.removePlayer(botId);
    }

    while (this.bots.size < this.targetBotCount) {
      this.spawnBot(arena);
    }

    // AI 업데이트 + 레벨업 자동 선택
    for (const [botId, bot] of this.bots) {
      const agent = arena.getSnakeById(botId);
      if (!agent || !agent.isAlive) continue;

      // 레벨업 대기 중이면 빌드 패스 기반 자동 선택
      if (agent.data.pendingUpgradeChoices) {
        const prefs = BOT_BUILD_PREFERENCES[bot.buildPath];
        botChooseUpgrade(agent, prefs.tomePriority, prefs.abilityPriority);
      }

      this.updateBotAI(botId, bot, arena);
    }
  }

  isBot(id: string): boolean {
    return this.bots.has(id);
  }

  removeAll(arena: Arena): void {
    for (const botId of this.bots.keys()) {
      arena.removePlayer(botId);
    }
    this.bots.clear();
  }

  private pickDifficulty(): BotDifficulty {
    const roll = Math.random();
    if (roll < 0.4) return 'easy';
    if (roll < 0.8) return 'medium';
    return 'hard';
  }

  private pickBuildPath(): BotBuildPath {
    return BUILD_PATHS[Math.floor(Math.random() * BUILD_PATHS.length)];
  }

  private spawnBot(arena: Arena): void {
    const id = `bot_${++this.botCounter}`;
    const nameIndex = this.botCounter % BOT_NAMES.length;
    const skinId = Math.floor(Math.random() * 24);
    arena.addPlayer(id, BOT_NAMES[nameIndex], skinId);

    this.bots.set(id, {
      id,
      difficulty: this.pickDifficulty(),
      buildPath: this.pickBuildPath(),
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 0,
      boostTimer: 0,
      stuckTimer: 0,
      lastPosition: { x: 0, y: 0 },
    });
  }

  private updateBotAI(botId: string, bot: BotState, arena: Arena): void {
    const agent = arena.getSnakeById(botId);
    if (!agent || !agent.isAlive) return;

    const pos = agent.position;
    const config = arena.getConfig();

    // v10: getNearbySnakes는 Agent[] 반환하지만 BotBehaviors는 아직 Snake 타입 기대
    // 호환성: agent.data는 Agent 타입이지만 필요한 필드가 동일 구조
    const nearbyAgents = arena.getNearbySnakes(botId, pos, 400);
    const nearestOrb = arena.findNearestOrb(pos, 300);
    const nearestPowerUp = arena.findNearestPowerUpOrb(pos, 500);
    const nearestDeathOrb = arena.findNearestOrbByType(pos, 400, 'death');

    // 우선순위 기반 행동 트리
    let action: BotAction;
    const surviveAction = behaveSurvive(agent.data as any, config, nearbyAgents as any);
    if (surviveAction) {
      action = surviveAction;
    } else {
      const huntAction = behaveHunt(agent.data as any, bot.difficulty, nearbyAgents as any, config);
      if (huntAction) {
        action = huntAction;
      } else {
        const gatherAction = behaveGather(
          agent.data as any, bot.difficulty,
          nearestOrb, nearestPowerUp, nearestDeathOrb,
          config.radius,
        );
        if (gatherAction) {
          action = gatherAction;
        } else {
          const wander = behaveWander(bot.wanderAngle, bot.wanderTimer, pos, config.radius);
          action = wander.action;
          bot.wanderAngle = wander.newAngle;
          bot.wanderTimer = wander.newTimer;
        }
      }
    }

    // stuck 감지
    const dx = pos.x - bot.lastPosition.x;
    const dy = pos.y - bot.lastPosition.y;
    if (dx * dx + dy * dy < 4) {
      bot.stuckTimer++;
      if (bot.stuckTimer > 60) {
        action.targetAngle = Math.random() * Math.PI * 2;
        bot.stuckTimer = 0;
      }
    } else {
      bot.stuckTimer = 0;
      bot.lastPosition = { x: pos.x, y: pos.y };
    }

    arena.applyInput(botId, normalizeAngle(action.targetAngle), action.boost, 0);
  }
}
