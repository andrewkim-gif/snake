/**
 * SocketHandler v3 — Multi-Room Tournament 이벤트 라우팅
 * join → join_room/leave_room 으로 변경
 */

import type { Server, Socket } from 'socket.io';
import type { Logger } from 'pino';
import type {
  ClientToServerEvents, ServerToClientEvents,
  InputPayload, JoinRoomPayload, RespawnPayload,
} from '@snake-arena/shared';
import {
  isValidAngle, isValidBoost, isValidSequence,
  isValidPlayerName, isValidSkinId, sanitizeName,
} from '@snake-arena/shared';
import { ARENA_CONFIG, ROOM_CONFIG } from '@snake-arena/shared';
import { RoomManager } from '../game/RoomManager';
import { RateLimiter } from './RateLimiter';
import { Broadcaster } from './Broadcaster';

type GameIO = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: GameIO, logger: Logger): RoomManager {
  const roomManager = new RoomManager();
  const rateLimiter = new RateLimiter();
  const broadcaster = new Broadcaster();

  // Broadcaster에 상태 전환 콜백 연결
  roomManager.setOnStateTransition((transition) => {
    broadcaster.handleStateTransition(io, transition, roomManager);
    logger.info({ roomId: transition.roomId, from: transition.from, to: transition.to },
      'Room state transition');
  });

  // 모든 룸 시작
  roomManager.start();
  logger.info(`${ROOM_CONFIG.ROOM_COUNT} rooms started`);

  // 브로드캐스터 시작
  const tickMs = 1000 / ARENA_CONFIG.tickRate;
  broadcaster.start(io, roomManager, tickMs);

  io.on('connection', (socket: GameSocket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    // 연결 즉시 rooms_update 전송
    socket.emit('rooms_update', {
      rooms: roomManager.getRoomsInfo(),
      recentWinners: roomManager.getRecentWinners(),
    });

    socket.on('join_room', (data: JoinRoomPayload) => {
      const name = data.name ? sanitizeName(data.name) : `Snake${Math.floor(Math.random() * 9999)}`;
      if (!isValidPlayerName(name)) {
        socket.emit('error', { code: 'INVALID_NAME', message: 'Invalid name' });
        return;
      }

      const skinId = isValidSkinId(data.skinId) ? data.skinId : 0;
      const result = roomManager.joinRoom(socket.id, data.roomId, name, skinId);

      if ('error' in result) {
        socket.emit('error', { code: result.error as any, message: result.error });
        return;
      }

      const { room, snake } = result;
      socket.join(room.id);

      socket.emit('joined', {
        roomId: room.id,
        id: socket.id,
        spawn: snake.head,
        arena: { radius: ARENA_CONFIG.radius, orbCount: room.getArena().getOrbCount() },
        tick: room.getArena().getTick(),
        roomState: room.getState(),
        timeRemaining: room.getTimeRemaining(),
      });

      logger.info({ socketId: socket.id, name, roomId: room.id }, 'Player joined room');
    });

    socket.on('leave_room', () => {
      const roomId = roomManager.leaveRoom(socket.id);
      if (roomId) {
        socket.leave(roomId);
        logger.info({ socketId: socket.id, roomId }, 'Player left room');
      }
    });

    socket.on('input', (data: InputPayload) => {
      if (!rateLimiter.checkInputRate(socket.id)) return;
      if (!isValidAngle(data.a) || !isValidBoost(data.b) || !isValidSequence(data.s)) return;

      const room = roomManager.getPlayerRoom(socket.id);
      if (!room) return;
      room.getArena().applyInput(socket.id, data.a, data.b === 1, data.s);
    });

    socket.on('respawn', (data: RespawnPayload) => {
      if (!rateLimiter.checkRespawnCooldown(socket.id)) return;

      const room = roomManager.getPlayerRoom(socket.id);
      if (!room) return;

      // playing 상태일 때만 리스폰 허용
      if (room.getState() !== 'playing' && room.getState() !== 'waiting' && room.getState() !== 'countdown') return;

      const name = data.name ? sanitizeName(data.name) : undefined;
      const skinId = isValidSkinId(data.skinId) ? data.skinId : undefined;
      const spawn = room.getArena().respawnPlayer(socket.id, name, skinId);

      if (spawn) {
        socket.emit('respawned', { spawn, tick: room.getArena().getTick() });
      }
    });

    socket.on('ping', (data) => {
      socket.emit('pong', { t: data.t, st: Date.now() });
    });

    socket.on('disconnect', () => {
      const roomId = roomManager.leaveRoom(socket.id);
      if (roomId) {
        socket.leave(roomId);
      }
      rateLimiter.cleanup(socket.id);
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  return roomManager;
}
