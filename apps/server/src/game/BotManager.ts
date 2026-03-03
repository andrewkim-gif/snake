/**
 * BotManager — AI 봇 (행동 트리 + 3단계 난이도)
 */

import { normalizeAngle } from '@snake-arena/shared';
import type { Arena } from './Arena';
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

interface BotState {
  id: string;
  difficulty: BotDifficulty;
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
    for (const [botId, bot] of this.bots) {
      const snake = arena.getSnakeById(botId);
      if (!snake || !snake.isAlive) {
        arena.respawnPlayer(botId);
        bot.wanderAngle = Math.random() * Math.PI * 2;
        bot.wanderTimer = 0;
        bot.stuckTimer = 0;
      }
    }

    while (this.bots.size < this.targetBotCount) {
      this.spawnBot(arena);
    }

    for (const [botId, bot] of this.bots) {
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

  private spawnBot(arena: Arena): void {
    const id = `bot_${++this.botCounter}`;
    const nameIndex = this.botCounter % BOT_NAMES.length;
    const skinId = Math.floor(Math.random() * 24);
    arena.addPlayer(id, BOT_NAMES[nameIndex], skinId);

    this.bots.set(id, {
      id,
      difficulty: this.pickDifficulty(),
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 0,
      boostTimer: 0,
      stuckTimer: 0,
      lastPosition: { x: 0, y: 0 },
    });
  }

  private updateBotAI(botId: string, bot: BotState, arena: Arena): void {
    const snake = arena.getSnakeById(botId);
    if (!snake || !snake.isAlive) return;

    const head = snake.head;
    const config = arena.getConfig();

    const nearbySnakes = arena.getNearbySnakes(botId, head, 400);
    const nearestOrb = arena.findNearestOrb(head, 300);
    const nearestPowerUp = arena.findNearestPowerUpOrb(head, 500);
    const nearestDeathOrb = arena.findNearestOrbByType(head, 400, 'death');

    // 우선순위 기반 행동 트리
    let action: BotAction;
    const surviveAction = behaveSurvive(snake.data, config, nearbySnakes);
    if (surviveAction) {
      action = surviveAction;
    } else {
      const huntAction = behaveHunt(snake.data, bot.difficulty, nearbySnakes, config);
      if (huntAction) {
        action = huntAction;
      } else {
        const gatherAction = behaveGather(
          snake.data, bot.difficulty,
          nearestOrb, nearestPowerUp, nearestDeathOrb,
          config.radius,
        );
        if (gatherAction) {
          action = gatherAction;
        } else {
          const wander = behaveWander(bot.wanderAngle, bot.wanderTimer, head, config.radius);
          action = wander.action;
          bot.wanderAngle = wander.newAngle;
          bot.wanderTimer = wander.newTimer;
        }
      }
    }

    // stuck 감지
    const dx = head.x - bot.lastPosition.x;
    const dy = head.y - bot.lastPosition.y;
    if (dx * dx + dy * dy < 4) {
      bot.stuckTimer++;
      if (bot.stuckTimer > 60) {
        action.targetAngle = Math.random() * Math.PI * 2;
        bot.stuckTimer = 0;
      }
    } else {
      bot.stuckTimer = 0;
      bot.lastPosition = { x: head.x, y: head.y };
    }

    arena.applyInput(botId, normalizeAngle(action.targetAngle), action.boost, 0);
  }
}
