/**
 * RoomManager — 5개 Room 생성/관리, 플레이어-룸 매핑, Quick Join
 */

import type { RoomInfo, RecentWinner, RoomStatus } from '@snake-arena/shared';
import { ROOM_CONFIG } from '@snake-arena/shared';
import { Room, type RoomStateTransition } from './Room';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map(); // socketId → roomId
  private recentWinners: RecentWinner[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onStateTransition: ((transition: RoomStateTransition) => void) | null = null;

  constructor() {
    for (let i = 1; i <= ROOM_CONFIG.ROOM_COUNT; i++) {
      const id = `room-${i}`;
      this.rooms.set(id, new Room(id));
    }
  }

  setOnStateTransition(cb: (transition: RoomStateTransition) => void): void {
    this.onStateTransition = cb;
  }

  /** 모든 룸 시작 + 1초 간격 tick */
  start(): void {
    for (const room of this.rooms.values()) {
      room.start();
    }
    this.tickInterval = setInterval(() => this.tickAll(), 1000);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const room of this.rooms.values()) {
      room.getArena().stop();
    }
  }

  private tickAll(): void {
    for (const room of this.rooms.values()) {
      const transition = room.tick();
      if (transition && this.onStateTransition) {
        // 승자 기록
        if (transition.to === 'ending' && transition.winner) {
          this.recentWinners.unshift({
            ...transition.winner,
            roomId: transition.roomId,
            timestamp: Date.now(),
          });
          if (this.recentWinners.length > ROOM_CONFIG.RECENT_WINNERS_COUNT) {
            this.recentWinners = this.recentWinners.slice(0, ROOM_CONFIG.RECENT_WINNERS_COUNT);
          }
        }

        this.onStateTransition(transition);
      }
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): Room[] {
    return [...this.rooms.values()];
  }

  getPlayerRoom(socketId: string): Room | undefined {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  getPlayerRoomId(socketId: string): string | undefined {
    return this.playerToRoom.get(socketId);
  }

  /** 룸 입장 — roomId='quick'이면 자동 매칭 */
  joinRoom(socketId: string, roomId: string, name: string, skinId: number): {
    room: Room; snake: ReturnType<Room['addHumanPlayer']>;
  } | { error: string } {
    if (this.playerToRoom.has(socketId)) {
      return { error: 'ALREADY_IN_ROOM' };
    }

    let targetRoom: Room | undefined;

    if (roomId === 'quick') {
      targetRoom = this.findBestRoom();
      if (!targetRoom) {
        return { error: 'ROOM_FULL' };
      }
    } else {
      targetRoom = this.rooms.get(roomId);
      if (!targetRoom) {
        return { error: 'ROOM_NOT_FOUND' };
      }
      if (!targetRoom.isJoinable()) {
        return { error: 'ROOM_NOT_JOINABLE' };
      }
    }

    const snake = targetRoom.addHumanPlayer(socketId, name, skinId);
    this.playerToRoom.set(socketId, targetRoom.id);

    return { room: targetRoom, snake };
  }

  /** 룸 퇴장 */
  leaveRoom(socketId: string): string | null {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removeHumanPlayer(socketId);
    }
    this.playerToRoom.delete(socketId);
    return roomId;
  }

  /** Quick Join 최적 룸 찾기: playing > countdown > waiting 우선, 인원 많은 순 */
  private findBestRoom(): Room | undefined {
    const statePriority: Record<RoomStatus, number> = {
      playing: 0,
      countdown: 1,
      waiting: 2,
      ending: 3,
      cooldown: 4,
    };

    const joinable = [...this.rooms.values()]
      .filter(r => r.isJoinable())
      .sort((a, b) => {
        const pa = statePriority[a.getState()];
        const pb = statePriority[b.getState()];
        if (pa !== pb) return pa - pb;
        // 같은 상태면 인원 많은 순
        return b.getHumanPlayerCount() - a.getHumanPlayerCount();
      });

    return joinable[0];
  }

  getRoomsInfo(): RoomInfo[] {
    return [...this.rooms.values()].map(r => r.toRoomInfo());
  }

  getRecentWinners(): RecentWinner[] {
    return this.recentWinners;
  }

  /** 전체 룸 통계 */
  getStats(): { totalPlayers: number; totalRooms: number; rooms: Array<{ id: string; players: number; humans: number; state: string }> } {
    const rooms = [...this.rooms.values()].map(r => ({
      id: r.id,
      players: r.getArena().getPlayerCount(),
      humans: r.getHumanPlayerCount(),
      state: r.getState(),
    }));
    return {
      totalPlayers: this.playerToRoom.size,
      totalRooms: this.rooms.size,
      rooms,
    };
  }
}
