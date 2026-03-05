/**
 * MapObjects v10 — 맵 오브젝트 시스템
 * XP Shrine, Healing Spring, Upgrade Altar, Speed Gate
 * 아레나 내 고정 위치 상호작용 오브젝트
 */

import type {
  ArenaConfig, Position, MapObjectType, MapObjectNetworkData,
} from '@snake-arena/shared';
import { MAP_OBJECT_CONFIGS } from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';

// ─── Internal Types ───

interface MapObject {
  id: string;
  type: MapObjectType;
  position: Position;
  radius: number;
  active: boolean;
  /** 쿨다운 종료 틱 (0 = 항상 활성) */
  cooldownUntil: number;
  /** 재사용 쿨다운 틱 수 */
  respawnTicks: number;
}

/** 맵 오브젝트 효과 적용 결과 (레벨업 이벤트 전달용) */
export interface MapObjectEvent {
  type: 'level_up';
  agentId: string;
}

// ─── MapObjects Manager ───

export class MapObjects {
  private objects: MapObject[] = [];
  /** Speed Gate 효과를 받은 에이전트 추적 (중복 적용 방지) */
  private speedGateTracker: Map<string, number> = new Map(); // agentId → cooldownUntil tick
  /** Altar 사용한 에이전트 추적 (라운드당 1회) */
  private altarUsed: Set<string> = new Set();

  constructor(arenaRadius: number) {
    this.spawnAll(arenaRadius);
  }

  /** 모든 맵 오브젝트 스폰 */
  private spawnAll(arenaRadius: number): void {
    this.objects = [];
    let idCounter = 0;

    for (const config of Object.values(MAP_OBJECT_CONFIGS)) {
      for (let i = 0; i < config.count; i++) {
        const pos = this.randomObjectPosition(arenaRadius);
        this.objects.push({
          id: `mo_${config.type}_${idCounter++}`,
          type: config.type,
          position: pos,
          radius: config.radius,
          active: true,
          cooldownUntil: 0,
          respawnTicks: config.respawnTicks,
        });
      }
    }
  }

  /** 아레나 내 랜덤 위치 생성 (중심/가장자리 회피) */
  private randomObjectPosition(arenaRadius: number): Position {
    // 중심에서 30~70% 반경 사이에 배치
    const minR = arenaRadius * 0.30;
    const maxR = arenaRadius * 0.70;

    const angle = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);

    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    };
  }

  /**
   * 매 틱 업데이트: 에이전트 근접 체크 + 효과 적용
   * @returns 레벨업 등 Arena에서 처리해야 할 이벤트 목록
   */
  update(agents: Map<string, AgentEntity>, currentTick: number): MapObjectEvent[] {
    const events: MapObjectEvent[] = [];

    for (const obj of this.objects) {
      // 쿨다운 체크 → 재활성화
      if (!obj.active && obj.cooldownUntil > 0 && currentTick >= obj.cooldownUntil) {
        obj.active = true;
        obj.cooldownUntil = 0;
      }

      if (!obj.active) continue;

      // 에이전트 근접 체크
      for (const agent of agents.values()) {
        if (!agent.isAlive) continue;

        const dx = agent.position.x - obj.position.x;
        const dy = agent.position.y - obj.position.y;
        const distSq = dx * dx + dy * dy;
        const rSq = obj.radius * obj.radius;

        if (distSq >= rSq) continue;

        // 범위 내 → 타입별 효과 적용
        switch (obj.type) {
          case 'shrine':
            this.applyShrine(agent, obj, currentTick);
            break;
          case 'spring':
            this.applySpring(agent);
            break;
          case 'altar':
            if (this.applyAltar(agent, obj, currentTick)) {
              events.push({ type: 'level_up', agentId: agent.data.id });
            }
            break;
          case 'gate':
            this.applyGate(agent, obj, currentTick);
            break;
        }
      }
    }

    return events;
  }

  /** XP Shrine: +15 XP 즉시, 쿨다운 적용 */
  private applyShrine(agent: AgentEntity, obj: MapObject, currentTick: number): void {
    // XP 추가 (레벨업 여부는 Arena에서 addXp로 처리하므로 직접 호출)
    agent.addXp(15);
    obj.active = false;
    obj.cooldownUntil = currentTick + obj.respawnTicks;
  }

  /** Healing Spring: +5 mass/tick (항상 활성, 범위 내에 있는 동안 매틱 적용) */
  private applySpring(agent: AgentEntity): void {
    agent.addMass(5);
  }

  /**
   * Upgrade Altar: 즉시 레벨업 (1회용, 긴 쿨다운)
   * @returns 레벨업 발생 여부
   */
  private applyAltar(agent: AgentEntity, obj: MapObject, currentTick: number): boolean {
    // 이미 사용한 에이전트는 재사용 불가
    if (this.altarUsed.has(agent.data.id)) return false;

    this.altarUsed.add(agent.data.id);
    obj.active = false;
    obj.cooldownUntil = currentTick + obj.respawnTicks;

    // 강제 레벨업 (addXp 대신 직접 레벨업 트리거)
    return true;
  }

  /** Speed Gate: 3초 스피드 부스트 (통과 시) */
  private applyGate(agent: AgentEntity, obj: MapObject, currentTick: number): void {
    // 동일 에이전트 중복 적용 방지
    const lastUsed = this.speedGateTracker.get(agent.data.id);
    if (lastUsed !== undefined && currentTick < lastUsed) return;

    // 3초 (60틱) 스피드 효과 부여
    agent.addEffect('speed', 60, currentTick);
    this.speedGateTracker.set(agent.data.id, currentTick + 60);

    obj.active = false;
    obj.cooldownUntil = currentTick + obj.respawnTicks;
  }

  /** 네트워크 직렬화 데이터 반환 */
  getNetworkData(): MapObjectNetworkData[] {
    return this.objects.map(obj => ({
      id: obj.id,
      type: obj.type,
      x: Math.round(obj.position.x),
      y: Math.round(obj.position.y),
      r: obj.radius,
      active: obj.active,
    }));
  }

  /** 라운드 리셋 */
  reset(arenaRadius: number): void {
    this.objects = [];
    this.speedGateTracker.clear();
    this.altarUsed.clear();
    this.spawnAll(arenaRadius);
  }
}
