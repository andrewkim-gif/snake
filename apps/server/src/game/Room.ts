/**
 * Room — Arena를 감싸는 상태 머신 + 타이머 + 승자 결정
 * waiting → countdown(10s) → playing(300s) → ending(5s) → cooldown(15s) → waiting
 */

import type { RoomStatus, RoomInfo, WinnerInfo, LeaderboardEntry } from '@snake-arena/shared';
import { ARENA_CONFIG, ROOM_CONFIG } from '@snake-arena/shared';
import { Arena } from './Arena';

export interface RoomStateTransition {
  roomId: string;
  from: RoomStatus;
  to: RoomStatus;
  winner?: WinnerInfo | null;
  finalLeaderboard?: LeaderboardEntry[];
}

export class Room {
  readonly id: string;
  private arena: Arena;
  private state: RoomStatus = 'waiting';
  private timer = 0; // 남은 시간 (초)
  private humanPlayers: Set<string> = new Set();
  private lastWinner: WinnerInfo | null = null;
  private maxPlayers: number;

  constructor(id: string) {
    this.id = id;
    this.maxPlayers = ROOM_CONFIG.MAX_PLAYERS_PER_ROOM;
    this.arena = this.createArena();
  }

  private createArena(): Arena {
    const config = { ...ARENA_CONFIG, naturalOrbTarget: ROOM_CONFIG.ROOM_ORB_TARGET };
    return new Arena(config, ROOM_CONFIG.BOTS_PER_ROOM);
  }

  getArena(): Arena { return this.arena; }
  getState(): RoomStatus { return this.state; }
  getTimeRemaining(): number { return this.timer; }
  getWinner(): WinnerInfo | null { return this.lastWinner; }
  getHumanPlayerCount(): number { return this.humanPlayers.size; }

  /** 시작 — arena game loop 시작 */
  start(): void {
    this.arena.start();
  }

  /** 매 1초 호출 — 상태 전환 반환 */
  tick(): RoomStateTransition | null {
    if (this.state === 'waiting') {
      // 인간 플레이어 MIN_PLAYERS_TO_START 이상이면 카운트다운 시작
      if (this.humanPlayers.size >= ROOM_CONFIG.MIN_PLAYERS_TO_START) {
        return this.transitionTo('countdown');
      }
      return null;
    }

    this.timer--;

    if (this.timer <= 0) {
      switch (this.state) {
        case 'countdown':
          return this.transitionTo('playing');
        case 'playing':
          return this.transitionTo('ending');
        case 'ending':
          return this.transitionTo('cooldown');
        case 'cooldown':
          this.resetRound();
          return this.transitionTo('waiting');
      }
    }

    return null;
  }

  private transitionTo(to: RoomStatus): RoomStateTransition {
    const from = this.state;
    this.state = to;

    let winner: WinnerInfo | null = null;
    let finalLeaderboard: LeaderboardEntry[] | undefined;

    switch (to) {
      case 'countdown':
        this.timer = ROOM_CONFIG.COUNTDOWN_DURATION;
        break;
      case 'playing':
        this.timer = ROOM_CONFIG.ROUND_DURATION;
        break;
      case 'ending':
        this.timer = ROOM_CONFIG.ENDING_DURATION;
        winner = this.determineWinner();
        finalLeaderboard = this.arena.getLeaderboardEntries();
        this.lastWinner = winner;
        break;
      case 'cooldown':
        this.timer = ROOM_CONFIG.COOLDOWN_DURATION;
        break;
      case 'waiting':
        this.timer = 0;
        this.lastWinner = null;
        // waiting 전환 시 인원 충분하면 즉시 countdown으로 다시 진입
        break;
    }

    return { roomId: this.id, from, to, winner, finalLeaderboard };
  }

  private determineWinner(): WinnerInfo | null {
    const entries = this.arena.getLeaderboardEntries();
    // 인간 플레이어 중 1위 찾기
    for (const entry of entries) {
      if (this.humanPlayers.has(entry.id)) {
        return {
          name: entry.name,
          score: entry.score,
          kills: entry.kills,
          skinId: this.arena.getSnakeById(entry.id)?.data.skin.id ?? 0,
        };
      }
    }
    // 인간 없으면 봇 1위
    if (entries.length > 0) {
      const top = entries[0];
      return {
        name: top.name,
        score: top.score,
        kills: top.kills,
        skinId: this.arena.getSnakeById(top.id)?.data.skin.id ?? 0,
      };
    }
    return null;
  }

  private resetRound(): void {
    // 기존 인간 플레이어 ID 보존
    const humanIds = [...this.humanPlayers];

    // 기존 arena 중단
    this.arena.stop();

    // 새 arena 생성 + 시작
    this.arena = this.createArena();
    this.arena.start();

    // 인간 플레이어 새 arena에 재등록하지 않음 — SocketHandler에서 round_reset 수신 후 클라이언트가 다시 join
    // humanPlayers set은 유지 (소켓 연결은 유지되므로)
    // 실제 arena에 addPlayer는 클라이언트가 respawn/rejoin할 때 수행
  }

  addHumanPlayer(socketId: string, name: string, skinId: number): ReturnType<Arena['addPlayer']> {
    this.humanPlayers.add(socketId);
    return this.arena.addPlayer(socketId, name, skinId);
  }

  removeHumanPlayer(socketId: string): void {
    this.humanPlayers.delete(socketId);
    this.arena.removePlayer(socketId);
  }

  isJoinable(): boolean {
    const joinableStates: RoomStatus[] = ['waiting', 'countdown', 'playing'];
    return joinableStates.includes(this.state) &&
      this.humanPlayers.size < this.maxPlayers;
  }

  toRoomInfo(): RoomInfo {
    return {
      id: this.id,
      state: this.state,
      playerCount: this.arena.getPlayerCount(),
      maxPlayers: this.maxPlayers + ROOM_CONFIG.BOTS_PER_ROOM,
      timeRemaining: this.timer,
      winner: this.lastWinner,
    };
  }
}
