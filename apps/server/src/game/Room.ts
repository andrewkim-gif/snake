/**
 * Room v10 — Arena를 감싸는 상태 머신 + 타이머 + 승자 결정
 * waiting → countdown(10s) → playing(300s) → ending(5s) → cooldown(15s) → waiting
 * v10: 1 Life 정책 — playing 중 리스폰 불가
 * v10 Phase 4: RPSystem, QuestSystem, AnalystSystem 통합
 */

import type { RoomStatus, RoomInfo, WinnerInfo, LeaderboardEntry } from '@snake-arena/shared';
import { ARENA_CONFIG, ROOM_CONFIG } from '@snake-arena/shared';
import { Arena } from './Arena';
import { RPSystem, type RPAwardResult, type RoundPerformance } from './RPSystem';
import { QuestSystem, type QuestUpdateResult } from './QuestSystem';
import { AnalystSystem, type RoundAnalysis } from './AnalystSystem';

export interface RoomStateTransition {
  roomId: string;
  from: RoomStatus;
  to: RoomStatus;
  winner?: WinnerInfo | null;
  finalLeaderboard?: LeaderboardEntry[];
  // v10 Phase 4: 라운드 종료 시 메타 데이터
  rpResults?: RPAwardResult[];
  analysisResults?: Map<string, RoundAnalysis>;
  questResults?: Map<string, QuestUpdateResult>;
}

interface PlayerMeta {
  name: string;
  skinId: number;
}

export class Room {
  readonly id: string;
  private arena: Arena;
  private state: RoomStatus = 'waiting';
  private timer = 0;
  private humanPlayers: Map<string, PlayerMeta> = new Map();
  private lastWinner: WinnerInfo | null = null;
  private maxPlayers: number;

  // v10 Phase 4: 메타 시스템 (라운드 간 유지)
  readonly rpSystem: RPSystem;
  readonly questSystem: QuestSystem;
  readonly analystSystem: AnalystSystem;

  constructor(id: string) {
    this.id = id;
    this.maxPlayers = ROOM_CONFIG.MAX_PLAYERS_PER_ROOM;
    this.arena = this.createArena();
    this.rpSystem = new RPSystem();
    this.questSystem = new QuestSystem();
    this.analystSystem = new AnalystSystem();
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
  getHumanPlayerIds(): Set<string> { return new Set(this.humanPlayers.keys()); }

  start(): void {
    this.arena.start();
  }

  /** 매 1초 호출 — 상태 전환 반환 */
  tick(): RoomStateTransition | null {
    if (this.state === 'waiting') {
      if (this.humanPlayers.size >= ROOM_CONFIG.MIN_PLAYERS_TO_START) {
        // 카운트다운 없이 즉시 시작
        return this.transitionTo('playing');
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
    let rpResults: RPAwardResult[] | undefined;
    let analysisResults: Map<string, RoundAnalysis> | undefined;
    let questResults: Map<string, QuestUpdateResult> | undefined;

    switch (to) {
      case 'countdown':
        this.timer = ROOM_CONFIG.COUNTDOWN_DURATION;
        break;
      case 'playing':
        this.timer = ROOM_CONFIG.ROUND_DURATION;
        // 퀘스트 갱신 (일일/주간 로테이션)
        for (const playerId of this.humanPlayers.keys()) {
          this.questSystem.refreshQuests(playerId);
        }
        break;
      case 'ending':
        this.timer = ROOM_CONFIG.ENDING_DURATION;
        winner = this.determineWinner();
        finalLeaderboard = this.arena.getLeaderboardEntries();
        this.lastWinner = winner;

        // v10 Phase 4: 라운드 종료 처리
        ({ rpResults, analysisResults, questResults } =
          this.processRoundEnd(winner, finalLeaderboard));
        break;
      case 'cooldown':
        this.timer = ROOM_CONFIG.COOLDOWN_DURATION;
        break;
      case 'waiting':
        this.timer = 0;
        this.lastWinner = null;
        break;
    }

    return { roomId: this.id, from, to, winner, finalLeaderboard, rpResults, analysisResults, questResults };
  }

  /** v10 Phase 4: 라운드 종료 시 RP/퀘스트/분석 처리 */
  private processRoundEnd(
    winner: WinnerInfo | null,
    leaderboard: LeaderboardEntry[],
  ): {
    rpResults: RPAwardResult[];
    analysisResults: Map<string, RoundAnalysis>;
    questResults: Map<string, QuestUpdateResult>;
  } {
    const agents = this.arena.getAgents();
    const humanIds = this.getHumanPlayerIds();

    // 1. RP 성과 수집 + 정산
    const performances: RoundPerformance[] = [];
    const winnerName = winner?.name;

    for (const playerId of humanIds) {
      const agent = agents.get(playerId);
      if (!agent) continue;

      const isWinner = leaderboard.length > 0 && leaderboard[0].id === playerId;

      performances.push({
        playerId,
        kills: agent.data.kills,
        level: agent.data.level,
        isAlive: agent.data.alive,
        isWinner,
        synergiesActivated: [...agent.data.activeSynergies],
      });

      // 퀘스트 추적: 라운드 생존
      if (agent.data.alive) {
        this.questSystem.trackSurvive(playerId);
      }
      // 퀘스트 추적: 라운드 우승
      if (isWinner) {
        this.questSystem.trackWin(playerId);
      }
      // 퀘스트 추적: 레벨
      this.questSystem.trackLevel(playerId, agent.data.level);
    }

    const rpResults = this.rpSystem.awardRoundEnd(performances);

    // 2. 퀘스트 정산 → RP 추가
    const questResults = new Map<string, QuestUpdateResult>();
    for (const playerId of humanIds) {
      const settlement = this.questSystem.settleRoundEnd(playerId);
      if (settlement.rpEarned > 0) {
        // 퀘스트 RP를 RPSystem에 추가
        const rpData = this.rpSystem.getOrCreate(playerId);
        rpData.totalRP += settlement.rpEarned;
      }

      const questUpdate = this.questSystem.getQuestUpdate(playerId);
      questUpdate.rpEarned = settlement.rpEarned;
      questUpdate.completedQuests = settlement.completedQuests;
      questResults.set(playerId, questUpdate);
    }

    // 3. 분석 생성
    const roundDurationTicks = ROOM_CONFIG.ROUND_DURATION * ARENA_CONFIG.tickRate;
    const analysisResults = this.analystSystem.generateAnalysis(
      agents, roundDurationTicks, humanIds,
    );

    return { rpResults, analysisResults, questResults };
  }

  private determineWinner(): WinnerInfo | null {
    const entries = this.arena.getLeaderboardEntries();
    for (const entry of entries) {
      if (this.humanPlayers.has(entry.id)) {
        return {
          name: entry.name,
          score: entry.score,
          kills: entry.kills,
          skinId: this.arena.getAgentById(entry.id)?.data.skin.id ?? 0,
        };
      }
    }
    if (entries.length > 0) {
      const top = entries[0];
      return {
        name: top.name,
        score: top.score,
        kills: top.kills,
        skinId: this.arena.getAgentById(top.id)?.data.skin.id ?? 0,
      };
    }
    return null;
  }

  /** v10: playing 중 리스폰 허용 여부 */
  canRespawn(): boolean {
    // 1 Life 정책: playing 중에는 리스폰 불가
    return this.state !== 'playing' && this.state !== 'ending';
  }

  private resetRound(): void {
    this.arena.stop();

    this.arena = this.createArena();
    this.arena.start();

    // 인간 플레이어를 새 arena에 자동 재등록 (이름/스킨 보존)
    for (const [socketId, meta] of this.humanPlayers) {
      this.arena.addPlayer(socketId, meta.name, meta.skinId);
    }
  }

  addHumanPlayer(socketId: string, name: string, skinId: number): ReturnType<Arena['addPlayer']> {
    this.humanPlayers.set(socketId, { name, skinId });
    // 퀘스트 초기화
    this.questSystem.refreshQuests(socketId);
    return this.arena.addPlayer(socketId, name, skinId);
  }

  removeHumanPlayer(socketId: string): void {
    this.humanPlayers.delete(socketId);
    this.arena.removePlayer(socketId);
  }

  /** 리스폰 시 메타 업데이트 (이름/스킨 변경 가능) */
  updatePlayerMeta(socketId: string, name?: string, skinId?: number): void {
    const meta = this.humanPlayers.get(socketId);
    if (meta) {
      if (name) meta.name = name;
      if (skinId !== undefined) meta.skinId = skinId;
    }
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
