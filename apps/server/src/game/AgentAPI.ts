/**
 * AgentAPI.ts — 외부 AI 에이전트용 서버 API
 *
 * 외부 에이전트가 게임 상태를 관찰하고 명령을 실행할 수 있는 인터페이스 제공.
 * Commander Mode: go_to, hunt, gather, flee 등 고수준 전략 명령 지원.
 */

import type { Arena } from './Arena';
import type { Room } from './Room';
import type { RoomManager } from './RoomManager';
import type { AgentEntity } from './AgentEntity';
import type { Position, TomeType, Agent } from '@snake-arena/shared';
import { normalizeAngle } from '@snake-arena/shared';
import { applyUpgrade } from './UpgradeSystem';

// ─── Types ───

/** 관찰 데이터 — AI 에이전트가 의사결정에 사용 */
export interface ObserveGameResponse {
  // 기본 상태
  position: { x: number; y: number };
  heading: number;
  mass: number;
  level: number;
  xp: number;
  xpToNext: number;
  alive: boolean;

  // 빌드 상태
  build: {
    tomes: Record<string, number>;
    abilities: Array<{ type: string; level: number }>;
    activeSynergies: string[];
  };

  // 환경
  arenaRadius: number;
  zone: 'center' | 'mid' | 'edge' | 'danger';
  timeRemaining: number;
  myRank: number;
  myMass: number;

  // 근처 엔티티
  nearbyAgents: Array<{
    id: string;
    x: number;
    y: number;
    mass: number;
    distance: number;
    isBot: boolean;
  }>;
  nearbyOrbs: Array<{
    x: number;
    y: number;
    value: number;
    type: string;
    distance: number;
  }>;
  nearbyThreats: number;

  // 보류 중인 결정
  pendingUpgrade: {
    choices: Array<{
      id: string;
      type: string;
      name: string;
      description: string;
      tomeType?: string;
      abilityType?: string;
    }>;
    deadline: number;
  } | null;
}

/** Commander Mode 명령 타입 */
export type AgentCommand =
  | { cmd: 'go_to'; x: number; y: number }
  | { cmd: 'go_center' }
  | { cmd: 'flee' }
  | { cmd: 'hunt'; targetId: string }
  | { cmd: 'hunt_nearest' }
  | { cmd: 'gather' }
  | { cmd: 'set_boost'; enabled: boolean }
  | { cmd: 'engage_weak' }
  | { cmd: 'avoid_strong' }
  | { cmd: 'farm_orbs'; zone: 'safe' | 'center' | 'edge' }
  | { cmd: 'kite'; targetId: string }
  | { cmd: 'camp_shrinkage' }
  | { cmd: 'set_combat_style'; style: 'aggressive' | 'defensive' | 'balanced' }
  | { cmd: 'choose_upgrade'; choiceIndex: 0 | 1 | 2 };

/** 등록된 외부 에이전트 정보 */
export interface RegisteredAgent {
  agentId: string;
  apiKey: string;
  roomId: string;
  playerId: string;       // 에이전트가 제어하는 플레이어 ID
  combatStyle: 'aggressive' | 'defensive' | 'balanced';
  currentCommand: AgentCommand | null;
  lastCommandAt: number;
}

// ─── AgentAPI 클래스 ───

export class AgentAPI {
  private agents = new Map<string, RegisteredAgent>();
  private apiKeyToAgent = new Map<string, string>(); // apiKey → agentId 역매핑
  private roomManager: RoomManager;

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  // ─── 에이전트 등록/해제 ───

  /**
   * 외부 에이전트 등록
   * @returns 성공 시 agentId, 실패 시 에러 메시지
   */
  registerAgent(
    agentId: string,
    apiKey: string,
    config: { roomId: string; playerId: string },
  ): { success: true; agentId: string } | { success: false; error: string } {
    // API 키 중복 체크
    if (this.apiKeyToAgent.has(apiKey)) {
      return { success: false, error: 'API key already registered' };
    }

    // 룸 존재 확인
    const room = this.roomManager.getRoom(config.roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // 플레이어가 해당 룸에 존재하는지 확인
    const arena = room.getArena();
    const agent = arena.getAgentById(config.playerId);
    if (!agent) {
      return { success: false, error: 'Player not found in room' };
    }

    const registered: RegisteredAgent = {
      agentId,
      apiKey,
      roomId: config.roomId,
      playerId: config.playerId,
      combatStyle: 'balanced',
      currentCommand: null,
      lastCommandAt: 0,
    };

    this.agents.set(agentId, registered);
    this.apiKeyToAgent.set(apiKey, agentId);

    return { success: true, agentId };
  }

  /** 에이전트 해제 */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.apiKeyToAgent.delete(agent.apiKey);
    this.agents.delete(agentId);
    return true;
  }

  /** API 키로 에이전트 조회 */
  getAgentByApiKey(apiKey: string): RegisteredAgent | undefined {
    const agentId = this.apiKeyToAgent.get(apiKey);
    if (!agentId) return undefined;
    return this.agents.get(agentId);
  }

  /** agentId로 에이전트 조회 */
  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  // ─── 게임 상태 관찰 ───

  /**
   * 에이전트의 관찰 데이터 생성
   * AI 의사결정에 필요한 전체 컨텍스트 반환
   */
  getObserveData(agentId: string): ObserveGameResponse | { error: string } {
    const registered = this.agents.get(agentId);
    if (!registered) return { error: 'Agent not registered' };

    const room = this.roomManager.getRoom(registered.roomId);
    if (!room) return { error: 'Room not found' };

    const arena = room.getArena();
    const entity = arena.getAgentById(registered.playerId);
    if (!entity) return { error: 'Player entity not found' };

    const data = entity.data;
    const pos = entity.position;
    const currentRadius = arena.getCurrentRadius();

    // 존 계산 (center < 30%, mid < 60%, edge < 85%, danger >= 85%)
    const distFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
    const radiusRatio = distFromCenter / currentRadius;
    const zone: ObserveGameResponse['zone'] =
      radiusRatio < 0.30 ? 'center' :
      radiusRatio < 0.60 ? 'mid' :
      radiusRatio < 0.85 ? 'edge' : 'danger';

    // 리더보드에서 내 순위 찾기
    const leaderboard = arena.getLeaderboardEntries();
    const myRank = leaderboard.findIndex(e => e.id === registered.playerId) + 1;

    // 근처 에이전트 (반경 500px)
    const nearbyRaw = arena.getNearbySnakes(registered.playerId, pos, 500);
    const botManager = (arena as any).botManager;
    const nearbyAgents = nearbyRaw.map((a: Agent) => {
      const dx = a.position.x - pos.x;
      const dy = a.position.y - pos.y;
      return {
        id: a.id,
        x: a.position.x,
        y: a.position.y,
        mass: a.mass,
        distance: Math.sqrt(dx * dx + dy * dy),
        isBot: botManager ? botManager.isBot(a.id) : false,
      };
    }).sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

    // 근처 오브 (반경 400px) — SpatialHash 쿼리
    const spatialHash = (arena as any).spatialHash;
    const rawOrbs = spatialHash ? spatialHash.queryOrbs(pos, 400) : [];
    const nearbyOrbs = rawOrbs.map((orb: any) => {
      const dx = orb.position.x - pos.x;
      const dy = orb.position.y - pos.y;
      return {
        x: orb.position.x,
        y: orb.position.y,
        value: orb.value,
        type: orb.type || 'natural',
        distance: Math.sqrt(dx * dx + dy * dy),
      };
    }).sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance)
      .slice(0, 20); // 최대 20개

    // 위협 수 (내 mass보다 1.5배 이상 큰 근처 에이전트)
    const nearbyThreats = nearbyAgents.filter(
      (a: { mass: number }) => a.mass > data.mass * 1.5,
    ).length;

    // 빌드 상태
    const tomes: Record<string, number> = {};
    for (const [key, val] of Object.entries(data.build.tomes)) {
      if (val > 0) tomes[key] = val;
    }

    // 보류 중인 업그레이드
    let pendingUpgrade: ObserveGameResponse['pendingUpgrade'] = null;
    if (data.pendingUpgradeChoices && data.pendingUpgradeChoices.length > 0) {
      const ticksLeft = data.upgradeDeadlineTick - arena.getTick();
      pendingUpgrade = {
        choices: data.pendingUpgradeChoices.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          description: c.description,
          tomeType: c.tomeType,
          abilityType: c.abilityType,
        })),
        deadline: Math.max(0, ticksLeft),
      };
    }

    return {
      position: { x: pos.x, y: pos.y },
      heading: data.heading,
      mass: data.mass,
      level: data.level,
      xp: data.xp,
      xpToNext: data.xpToNext,
      alive: data.alive,

      build: {
        tomes,
        abilities: data.build.abilities.map(a => ({
          type: a.type,
          level: a.level,
        })),
        activeSynergies: data.activeSynergies,
      },

      arenaRadius: currentRadius,
      zone,
      timeRemaining: room.getTimeRemaining(),
      myRank: myRank || leaderboard.length + 1,
      myMass: data.mass,

      nearbyAgents,
      nearbyOrbs,
      nearbyThreats,

      pendingUpgrade,
    };
  }

  // ─── 명령 실행 ───

  /**
   * Commander Mode 명령 실행
   * 고수준 전략 명령을 저수준 게임 입력으로 변환
   */
  executeCommand(
    agentId: string,
    command: AgentCommand,
  ): { success: true } | { success: false; error: string } {
    const registered = this.agents.get(agentId);
    if (!registered) return { success: false, error: 'Agent not registered' };

    const room = this.roomManager.getRoom(registered.roomId);
    if (!room) return { success: false, error: 'Room not found' };

    const arena = room.getArena();
    const entity = arena.getAgentById(registered.playerId);
    if (!entity) return { success: false, error: 'Player entity not found' };

    if (!entity.isAlive) return { success: false, error: 'Agent is dead' };

    const pos = entity.position;

    switch (command.cmd) {
      case 'go_to': {
        const angle = Math.atan2(command.y - pos.y, command.x - pos.x);
        arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        break;
      }

      case 'go_center': {
        const angle = Math.atan2(-pos.y, -pos.x);
        arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        break;
      }

      case 'flee': {
        // 가장 가까운 위협으로부터 반대 방향으로 도주
        const nearby = arena.getNearbySnakes(registered.playerId, pos, 400);
        if (nearby.length > 0) {
          // 가장 가까운 적
          let closestDist = Infinity;
          let closestPos: Position | null = null;
          for (const a of nearby) {
            const dx = a.position.x - pos.x;
            const dy = a.position.y - pos.y;
            const dist = dx * dx + dy * dy;
            if (dist < closestDist) {
              closestDist = dist;
              closestPos = a.position;
            }
          }
          if (closestPos) {
            // 반대 방향
            const fleeAngle = Math.atan2(pos.y - closestPos.y, pos.x - closestPos.x);
            arena.applyInput(registered.playerId, normalizeAngle(fleeAngle), true, 0);
          }
        } else {
          // 적이 없으면 중심으로
          const angle = Math.atan2(-pos.y, -pos.x);
          arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        }
        break;
      }

      case 'hunt': {
        const target = arena.getAgentById(command.targetId);
        if (!target || !target.isAlive) {
          return { success: false, error: 'Target not found or dead' };
        }
        const tPos = target.position;
        const angle = Math.atan2(tPos.y - pos.y, tPos.x - pos.x);
        const dist = Math.sqrt((tPos.x - pos.x) ** 2 + (tPos.y - pos.y) ** 2);
        // 가까우면 대시(부스트)
        arena.applyInput(registered.playerId, normalizeAngle(angle), dist < 150, 0);
        break;
      }

      case 'hunt_nearest': {
        const nearby = arena.getNearbySnakes(registered.playerId, pos, 500);
        if (nearby.length === 0) {
          return { success: false, error: 'No nearby targets' };
        }
        // 가장 가까운 적 추적
        let closestDist = Infinity;
        let closestAgent: Agent | null = null;
        for (const a of nearby) {
          const dx = a.position.x - pos.x;
          const dy = a.position.y - pos.y;
          const dist = dx * dx + dy * dy;
          if (dist < closestDist) {
            closestDist = dist;
            closestAgent = a;
          }
        }
        if (closestAgent) {
          const angle = Math.atan2(
            closestAgent.position.y - pos.y,
            closestAgent.position.x - pos.x,
          );
          const dist = Math.sqrt(closestDist);
          arena.applyInput(registered.playerId, normalizeAngle(angle), dist < 150, 0);
        }
        break;
      }

      case 'gather': {
        // 가장 가까운 오브로 이동
        const orbPos = arena.findNearestOrb(pos, 400);
        if (orbPos) {
          const angle = Math.atan2(orbPos.y - pos.y, orbPos.x - pos.x);
          arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        }
        break;
      }

      case 'set_boost': {
        arena.applyInput(registered.playerId, entity.data.heading, command.enabled, 0);
        break;
      }

      case 'engage_weak': {
        // mass가 나보다 작은 가장 가까운 적 추적
        const nearby = arena.getNearbySnakes(registered.playerId, pos, 500);
        const weakTargets = nearby.filter(a => a.mass < entity.data.mass * 0.8);
        if (weakTargets.length === 0) {
          return { success: false, error: 'No weak targets nearby' };
        }
        let closest = weakTargets[0];
        let minDist = Infinity;
        for (const a of weakTargets) {
          const dx = a.position.x - pos.x;
          const dy = a.position.y - pos.y;
          const d = dx * dx + dy * dy;
          if (d < minDist) { minDist = d; closest = a; }
        }
        const angle = Math.atan2(closest.position.y - pos.y, closest.position.x - pos.x);
        arena.applyInput(registered.playerId, normalizeAngle(angle), Math.sqrt(minDist) < 150, 0);
        break;
      }

      case 'avoid_strong': {
        // mass가 나보다 1.5배 이상 큰 적에서 도주
        const nearby = arena.getNearbySnakes(registered.playerId, pos, 400);
        const threats = nearby.filter(a => a.mass > entity.data.mass * 1.5);
        if (threats.length === 0) break; // 위협 없음

        // 위협들의 평균 위치에서 도주
        let avgX = 0, avgY = 0;
        for (const t of threats) { avgX += t.position.x; avgY += t.position.y; }
        avgX /= threats.length;
        avgY /= threats.length;
        const fleeAngle = Math.atan2(pos.y - avgY, pos.x - avgX);
        arena.applyInput(registered.playerId, normalizeAngle(fleeAngle), true, 0);
        break;
      }

      case 'farm_orbs': {
        // 지정 존에서 오브 파밍
        const radius = arena.getCurrentRadius();
        let targetZone: { minR: number; maxR: number };
        switch (command.zone) {
          case 'safe':   targetZone = { minR: 0, maxR: radius * 0.4 }; break;
          case 'center': targetZone = { minR: 0, maxR: radius * 0.3 }; break;
          case 'edge':   targetZone = { minR: radius * 0.5, maxR: radius * 0.85 }; break;
        }
        // 해당 존 내 가장 가까운 오브로 이동
        const orbPos = arena.findNearestOrb(pos, 500);
        if (orbPos) {
          const orbDist = Math.sqrt(orbPos.x * orbPos.x + orbPos.y * orbPos.y);
          if (orbDist >= targetZone.minR && orbDist <= targetZone.maxR) {
            const angle = Math.atan2(orbPos.y - pos.y, orbPos.x - pos.x);
            arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
          } else {
            // 존 내 적절한 위치로 이동
            const targetR = (targetZone.minR + targetZone.maxR) / 2;
            const currentDist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
            if (currentDist < targetZone.minR) {
              // 바깥으로
              const angle = Math.atan2(pos.y, pos.x);
              arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
            } else if (currentDist > targetZone.maxR) {
              // 안쪽으로
              const angle = Math.atan2(-pos.y, -pos.x);
              arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
            }
          }
        }
        break;
      }

      case 'kite': {
        // 타겟 주위를 원형으로 회피하며 공격
        const target = arena.getAgentById(command.targetId);
        if (!target || !target.isAlive) {
          return { success: false, error: 'Target not found or dead' };
        }
        const tPos = target.position;
        const dx = tPos.x - pos.x;
        const dy = tPos.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 적당한 거리 유지 (aura 범위 + alpha)
        const idealDist = 80;
        if (dist < idealDist * 0.7) {
          // 너무 가까우면 후퇴
          const fleeAngle = Math.atan2(-dy, -dx);
          arena.applyInput(registered.playerId, normalizeAngle(fleeAngle), true, 0);
        } else if (dist > idealDist * 1.5) {
          // 너무 멀면 접근
          const angle = Math.atan2(dy, dx);
          arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        } else {
          // 적정 거리: 접선 방향 (원형 이동)
          const tangent = Math.atan2(dy, dx) + Math.PI / 2;
          arena.applyInput(registered.playerId, normalizeAngle(tangent), false, 0);
        }
        break;
      }

      case 'camp_shrinkage': {
        // 축소 경계선 근처에서 캠핑 (쫓겨오는 적 노림)
        const radius = arena.getCurrentRadius();
        const idealDist = radius * 0.75;
        const currentDist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
        if (currentDist < idealDist - 50) {
          // 경계로 이동
          const angle = Math.atan2(pos.y, pos.x);
          arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        } else if (currentDist > idealDist + 50) {
          // 안쪽으로
          const angle = Math.atan2(-pos.y, -pos.x);
          arena.applyInput(registered.playerId, normalizeAngle(angle), false, 0);
        } else {
          // 원형 순찰
          const tangent = Math.atan2(pos.y, pos.x) + Math.PI / 2;
          arena.applyInput(registered.playerId, normalizeAngle(tangent), false, 0);
        }
        break;
      }

      case 'set_combat_style': {
        registered.combatStyle = command.style;
        break;
      }

      case 'choose_upgrade': {
        const choices = entity.data.pendingUpgradeChoices;
        if (!choices || choices.length === 0) {
          return { success: false, error: 'No pending upgrade choices' };
        }
        const idx = command.choiceIndex;
        if (idx < 0 || idx >= choices.length) {
          return { success: false, error: 'Invalid choice index' };
        }
        arena.chooseUpgrade(registered.playerId, choices[idx].id);
        break;
      }

      default: {
        return { success: false, error: `Unknown command: ${(command as any).cmd}` };
      }
    }

    registered.currentCommand = command;
    registered.lastCommandAt = Date.now();
    return { success: true };
  }

  // ─── 유틸리티 ───

  /** 등록된 에이전트 수 */
  getAgentCount(): number {
    return this.agents.size;
  }

  /** 특정 플레이어를 제어하는 에이전트 찾기 */
  getAgentForPlayer(playerId: string): RegisteredAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.playerId === playerId) return agent;
    }
    return undefined;
  }

  /** 모든 등록 에이전트 ID 목록 */
  getRegisteredAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /** 에이전트 정리 (룸 리셋 시) */
  cleanupRoom(roomId: string): void {
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.roomId === roomId) {
        this.apiKeyToAgent.delete(agent.apiKey);
        this.agents.delete(agentId);
      }
    }
  }
}
