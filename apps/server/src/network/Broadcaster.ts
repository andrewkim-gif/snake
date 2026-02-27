/**
 * Broadcaster — state/minimap/death/kill 브로드캐스팅
 * SocketHandler에서 추출
 */

import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@snake-arena/shared';
import { NETWORK } from '@snake-arena/shared';
import type { Arena } from '../game/Arena';

type GameIO = Server<ClientToServerEvents, ServerToClientEvents>;

const DEFAULT_VIEWPORT_W = 1920;
const DEFAULT_VIEWPORT_H = 1080;

export class Broadcaster {
  private stateInterval: ReturnType<typeof setInterval> | null = null;

  /** state (20Hz) + minimap (1Hz) + death/kill 이벤트 브로드캐스팅 */
  start(io: GameIO, arena: Arena, tickMs: number): void {
    this.stateInterval = setInterval(() => {
      const tick = arena.getTick();

      // death/kill 이벤트 처리 (매 틱)
      const deaths = arena.consumeLastTickDeaths();
      for (const death of deaths) {
        const deadSocket = io.sockets.sockets.get(death.snakeId);
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

        // killer에게 kill 이벤트
        if (death.killerId) {
          const killerSocket = io.sockets.sockets.get(death.killerId);
          if (killerSocket) {
            const victimName = arena.getSnakeName(death.snakeId) ?? 'Unknown';
            const victimMass = arena.getSnakeMass(death.snakeId);
            killerSocket.emit('kill', { victim: victimName, victimMass });
          }
        }
      }

      // state 브로드캐스팅 (20Hz)
      for (const [, socket] of io.sockets.sockets) {
        const state = arena.getStateForPlayer(socket.id, DEFAULT_VIEWPORT_W, DEFAULT_VIEWPORT_H);
        if (state) {
          socket.emit('state', state);
        }

        // minimap (1Hz)
        if (tick % NETWORK.MINIMAP_INTERVAL === 0) {
          const minimap = arena.getMinimapForPlayer(socket.id);
          socket.emit('minimap', minimap);
        }
      }
    }, tickMs);
  }

  stop(): void {
    if (this.stateInterval) {
      clearInterval(this.stateInterval);
      this.stateInterval = null;
    }
  }
}
