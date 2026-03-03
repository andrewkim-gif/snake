/**
 * Broadcaster — Multi-Room state/minimap/death/kill + 로비 브로드캐스팅
 */

import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents,
} from '@snake-arena/shared';
import { NETWORK, ROOM_CONFIG } from '@snake-arena/shared';
import type { RoomManager } from '../game/RoomManager';
import type { RoomStateTransition } from '../game/Room';

type GameIO = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const DEFAULT_VIEWPORT_W = 1920;
const DEFAULT_VIEWPORT_H = 1080;

export class Broadcaster {
  private stateInterval: ReturnType<typeof setInterval> | null = null;
  private lobbyInterval: ReturnType<typeof setInterval> | null = null;

  /** 게임 루프 (20Hz) + 로비 루프 (1Hz) */
  start(io: GameIO, roomManager: RoomManager, tickMs: number): void {
    // 룸 참조 캐시 (변하지 않음)
    const rooms = roomManager.getAllRooms();

    // 게임 루프: 각 룸의 state/death/kill/minimap 브로드캐스트
    this.stateInterval = setInterval(() => {
      for (const room of rooms) {
        const arena = room.getArena();
        const tick = arena.getTick();

        // death/kill 이벤트 처리
        const deaths = arena.consumeLastTickDeaths();
        for (const death of deaths) {
          const deadSocket = io.sockets.sockets.get(death.snakeId) as GameSocket | undefined;
          if (deadSocket) {
            const info = arena.getDeathInfo(death.snakeId);
            if (info) {
              const killerName = death.killerId ? arena.getSnakeName(death.killerId) : undefined;
              deadSocket.emit('death', {
                score: info.score,
                length: info.length,
                kills: info.kills,
                duration: info.duration,
                rank: info.rank,
                killer: killerName ?? undefined,
              });
            }
          }

          if (death.killerId) {
            const killerSocket = io.sockets.sockets.get(death.killerId) as GameSocket | undefined;
            if (killerSocket) {
              const victimName = arena.getSnakeName(death.snakeId) ?? 'Unknown';
              const victimMass = arena.getSnakeMass(death.snakeId);
              killerSocket.emit('kill', { victim: victimName, victimMass });
            }
          }
        }

        // state 브로드캐스팅 — arena에 등록된 플레이어만
        for (const playerId of arena.getPlayerIds()) {
          const socket = io.sockets.sockets.get(playerId) as GameSocket | undefined;
          if (!socket) continue;

          const state = arena.getStateForPlayer(playerId, DEFAULT_VIEWPORT_W, DEFAULT_VIEWPORT_H);
          if (state) {
            socket.emit('state', state);
          }

          // minimap (1Hz)
          if (tick % NETWORK.MINIMAP_INTERVAL === 0) {
            const minimap = arena.getMinimapForPlayer(playerId);
            socket.emit('minimap', minimap);
          }
        }
      }
    }, tickMs);

    // 로비 루프: 1Hz rooms_update 전체 브로드캐스트
    this.lobbyInterval = setInterval(() => {
      io.emit('rooms_update', {
        rooms: roomManager.getRoomsInfo(),
        recentWinners: roomManager.getRecentWinners(),
      });
    }, ROOM_CONFIG.LOBBY_UPDATE_INTERVAL);
  }

  /** 상태 전환 이벤트 처리 */
  handleStateTransition(io: GameIO, transition: RoomStateTransition, roomManager: RoomManager): void {
    const { roomId, to, winner, finalLeaderboard } = transition;
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    switch (to) {
      case 'countdown':
        io.to(roomId).emit('round_start', { countdown: ROOM_CONFIG.COUNTDOWN_DURATION });
        break;

      case 'playing':
        io.to(roomId).emit('round_start', { countdown: 0 });
        break;

      case 'ending': {
        // 개별 플레이어에게 개인화된 round_end 전송
        const arena = room.getArena();
        const leaderboard = finalLeaderboard || arena.getLeaderboardEntries();

        // Socket.IO room의 소켓 목록
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const socket = io.sockets.sockets.get(socketId) as GameSocket | undefined;
            if (!socket) continue;

            const rank = leaderboard.findIndex(e => e.id === socketId);
            const entry = rank >= 0 ? leaderboard[rank] : null;

            socket.emit('round_end', {
              winner: winner ?? null,
              finalLeaderboard: leaderboard.slice(0, 10),
              yourRank: rank >= 0 ? rank + 1 : leaderboard.length + 1,
              yourScore: entry?.score ?? 0,
            });
          }
        }
        break;
      }

      case 'cooldown':
        io.to(roomId).emit('round_reset', { roomState: 'cooldown' });
        break;

      case 'waiting':
        io.to(roomId).emit('round_reset', { roomState: 'waiting' });
        break;
    }
  }

  stop(): void {
    if (this.stateInterval) {
      clearInterval(this.stateInterval);
      this.stateInterval = null;
    }
    if (this.lobbyInterval) {
      clearInterval(this.lobbyInterval);
      this.lobbyInterval = null;
    }
  }
}
