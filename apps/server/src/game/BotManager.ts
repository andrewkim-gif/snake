/**
 * BotManager — AI 봇 스네이크 생성 및 자동 조종
 */

import type { ArenaConfig, Position } from '@snake-arena/shared';
import { normalizeAngle } from '@snake-arena/shared';
import type { Arena } from './Arena';

const BOT_NAMES = [
  'Slinky', 'Nibbler', 'Zigzag', 'Viper', 'Comet',
  'Noodle', 'Blitz', 'Shadow', 'Spark', 'Twister',
  'Dash', 'Fang', 'Ripple', 'Echo', 'Bolt',
  'Pixel', 'Ghost', 'Flash', 'Storm', 'Orbit',
];

interface BotState {
  id: string;
  wanderAngle: number;
  wanderTimer: number;
  boostTimer: number;
}

export class BotManager {
  private bots: Map<string, BotState> = new Map();
  private botCounter = 0;
  private readonly targetBotCount: number;

  constructor(targetBotCount = 20) {
    this.targetBotCount = targetBotCount;
  }

  /** Arena.start() 후 호출 — 초기 봇 스폰 */
  initialize(arena: Arena): void {
    for (let i = 0; i < this.targetBotCount; i++) {
      this.spawnBot(arena);
    }
  }

  /** 매 틱 호출 — 봇 AI 업데이트 + 죽은 봇 리스폰 */
  update(arena: Arena): void {
    // 죽은 봇 리스폰
    for (const [botId, bot] of this.bots) {
      const snake = arena.getSnakeById(botId);
      if (!snake || !snake.isAlive) {
        arena.respawnPlayer(botId);
        bot.wanderAngle = Math.random() * Math.PI * 2;
        bot.wanderTimer = 0;
      }
    }

    // 봇 수 유지 (플레이어가 나가도 봇 수 유지)
    while (this.bots.size < this.targetBotCount) {
      this.spawnBot(arena);
    }

    // AI 로직
    for (const [botId, bot] of this.bots) {
      this.updateBotAI(botId, bot, arena);
    }
  }

  /** 봇인지 확인 */
  isBot(id: string): boolean {
    return this.bots.has(id);
  }

  /** 봇 제거 (서버 종료 시) */
  removeAll(arena: Arena): void {
    for (const botId of this.bots.keys()) {
      arena.removePlayer(botId);
    }
    this.bots.clear();
  }

  private spawnBot(arena: Arena): void {
    const id = `bot_${++this.botCounter}`;
    const nameIndex = this.botCounter % BOT_NAMES.length;
    const skinId = Math.floor(Math.random() * 12);
    arena.addPlayer(id, BOT_NAMES[nameIndex], skinId);

    this.bots.set(id, {
      id,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 0,
      boostTimer: 0,
    });
  }

  private updateBotAI(botId: string, bot: BotState, arena: Arena): void {
    const snake = arena.getSnakeById(botId);
    if (!snake || !snake.isAlive) return;

    const head = snake.head;
    const config = arena.getConfig();
    let targetAngle = bot.wanderAngle;
    let boost = false;

    // 1. 경계 회피 — 아레나 가장자리에 가까우면 중앙을 향해
    const distFromCenter = Math.sqrt(head.x * head.x + head.y * head.y);
    const edgeThreshold = config.radius * 0.75;
    if (distFromCenter > edgeThreshold) {
      targetAngle = Math.atan2(-head.y, -head.x);
    } else {
      // 2. 가장 가까운 먹이를 향해 이동
      const nearestOrb = arena.findNearestOrb(head, 300);
      if (nearestOrb) {
        targetAngle = Math.atan2(
          nearestOrb.y - head.y,
          nearestOrb.x - head.x,
        );
      } else {
        // 3. 랜덤 배회
        bot.wanderTimer++;
        if (bot.wanderTimer > 40 + Math.random() * 60) {
          bot.wanderAngle = normalizeAngle(
            bot.wanderAngle + (Math.random() - 0.5) * Math.PI * 0.8,
          );
          bot.wanderTimer = 0;
        }
        targetAngle = bot.wanderAngle;
      }

      // 4. 다른 뱀 머리 회피
      const nearbyThreat = arena.findNearbySnakeHead(botId, head, 100);
      if (nearbyThreat) {
        const awayAngle = Math.atan2(
          head.y - nearbyThreat.y,
          head.x - nearbyThreat.x,
        );
        targetAngle = awayAngle;
        boost = snake.data.mass > config.minBoostMass + 5;
      }
    }

    // 5. 가끔 부스트 (큰 먹이 근처)
    bot.boostTimer++;
    if (bot.boostTimer > 100 && snake.data.mass > config.minBoostMass + 10) {
      boost = true;
      if (bot.boostTimer > 120) {
        bot.boostTimer = 0;
      }
    }

    arena.applyInput(botId, normalizeAngle(targetAngle), boost, 0);
  }
}
