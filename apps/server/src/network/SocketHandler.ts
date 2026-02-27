/**
 * SocketHandler v2 — 이벤트 라우팅만 담당
 * rate limiting → RateLimiter, broadcasting → Broadcaster
 */

import type { Server, Socket } from 'socket.io';
import type { Logger } from 'pino';
import type {
  ClientToServerEvents, ServerToClientEvents,
  InputPayload, JoinPayload, RespawnPayload,
} from '@snake-arena/shared';
import {
  isValidAngle, isValidBoost, isValidSequence,
  isValidPlayerName, isValidSkinId, sanitizeName,
} from '@snake-arena/shared';
import { ARENA_CONFIG } from '@snake-arena/shared';
import { Arena } from '../game/Arena';
import { RateLimiter } from './RateLimiter';
import { Broadcaster } from './Broadcaster';

type GameIO = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: GameIO, logger: Logger): Arena {
  const arena = new Arena();
  arena.start();
  logger.info('Arena started (20Hz tick loop)');

  const rateLimiter = new RateLimiter();
  const broadcaster = new Broadcaster();
  const tickMs = 1000 / ARENA_CONFIG.tickRate;
  broadcaster.start(io, arena, tickMs);

  io.on('connection', (socket: GameSocket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on('join', (data: JoinPayload) => {
      if (arena.getHumanPlayerCount() >= ARENA_CONFIG.maxPlayers) {
        socket.emit('error', { code: 'ARENA_FULL', message: 'Arena is full' });
        return;
      }

      const name = data.name ? sanitizeName(data.name) : `Snake${Math.floor(Math.random() * 9999)}`;
      if (!isValidPlayerName(name)) {
        socket.emit('error', { code: 'INVALID_NAME', message: 'Invalid name' });
        return;
      }

      const skinId = isValidSkinId(data.skinId) ? data.skinId : 0;
      const snake = arena.addPlayer(socket.id, name, skinId);

      socket.emit('joined', {
        id: socket.id,
        spawn: snake.head,
        arena: { radius: ARENA_CONFIG.radius, orbCount: arena.getOrbCount() },
        tick: arena.getTick(),
      });

      logger.info({ socketId: socket.id, name }, 'Player joined');
    });

    socket.on('input', (data: InputPayload) => {
      if (!rateLimiter.checkInputRate(socket.id)) return;
      if (!isValidAngle(data.a) || !isValidBoost(data.b) || !isValidSequence(data.s)) return;
      arena.applyInput(socket.id, data.a, data.b === 1, data.s);
    });

    socket.on('respawn', (data: RespawnPayload) => {
      if (!rateLimiter.checkRespawnCooldown(socket.id)) return;

      const name = data.name ? sanitizeName(data.name) : undefined;
      const skinId = isValidSkinId(data.skinId) ? data.skinId : undefined;
      const spawn = arena.respawnPlayer(socket.id, name, skinId);

      if (spawn) {
        socket.emit('respawned', { spawn, tick: arena.getTick() });
      }
    });

    socket.on('ping', (data) => {
      socket.emit('pong', { t: data.t, st: Date.now() });
    });

    socket.on('disconnect', () => {
      arena.removePlayer(socket.id);
      rateLimiter.cleanup(socket.id);
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  return arena;
}
