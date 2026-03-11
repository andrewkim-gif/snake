/**
 * faction-visual.ts — v39 Phase 3: 팩션 시각 식별 시스템
 *
 * 팩션 컬러 링, 네임플레이트 배지, 미니맵 색상 구분,
 * 8가지 팩션 컬러 팔레트를 정의한다.
 *
 * 서버에서 수신한 팩션 정보를 기반으로 각 플레이어의
 * 시각적 구분 요소(아군/적군/동맹)를 계산한다.
 */

import type { IFactionPresence } from '@/lib/matrix/types/region';

// ── 8가지 팩션 컬러 팔레트 ──

/** 8가지 팩션 식별 컬러 (서버 FactionColors와 동기화) */
export const FACTION_COLORS = [
  '#EF4444', // Red — 레드
  '#3B82F6', // Blue — 블루
  '#22C55E', // Green — 그린
  '#F59E0B', // Amber — 앰버
  '#8B5CF6', // Violet — 바이올렛
  '#EC4899', // Pink — 핑크
  '#06B6D4', // Cyan — 시안
  '#F97316', // Orange — 오렌지
] as const;

/** 팩션 컬러 인덱스로 색상 반환 */
export function getFactionColor(index: number): string {
  return FACTION_COLORS[index % FACTION_COLORS.length];
}

// ── 팩션 관계 타입 ──

/** 두 플레이어 간 팩션 관계 */
export type FactionRelation = 'self' | 'ally' | 'allied' | 'enemy' | 'neutral';

// ── 미니맵 색상 ──

/** 미니맵 도트 색상 (관계별) */
export const MINIMAP_COLORS: Record<FactionRelation, string> = {
  self: '#FFFFFF',    // 흰색 — 나 자신
  ally: '#22C55E',    // 초록 — 아군 (같은 팩션)
  allied: '#3B82F6',  // 파랑 — 동맹 팩션
  enemy: '#EF4444',   // 빨강 — 적군
  neutral: '#9CA3AF',  // 회색 — 중립/무소속
};

// ── HP바 색상 ──

/** HP바 색상 (관계별) */
export const HP_BAR_COLORS: Record<FactionRelation, string> = {
  self: '#22C55E',    // 초록 — 나 자신
  ally: '#22C55E',    // 초록 — 아군
  allied: '#60A5FA',  // 하늘 — 동맹
  enemy: '#EF4444',   // 빨강 — 적군
  neutral: '#9CA3AF',  // 회색 — 중립
};

// ── 팩션 컬러 링 설정 ──

/** 팩션 컬러 링 렌더링 설정 */
export interface IFactionRingConfig {
  /** 링 반경 (캐릭터 발 아래) */
  radius: number;
  /** 링 두께 (px) */
  thickness: number;
  /** 링 색상 (팩션 컬러) */
  color: string;
  /** 투명도 (0~1) */
  alpha: number;
  /** 펄스 애니메이션 활성화 여부 (적군만) */
  pulse: boolean;
}

/** 기본 팩션 링 설정 */
export const DEFAULT_RING_CONFIG: Omit<IFactionRingConfig, 'color'> = {
  radius: 1.2,
  thickness: 3,
  alpha: 0.8,
  pulse: false,
};

// ── 팩션 배지 (네임플레이트) ──

/** 네임플레이트 팩션 배지 데이터 */
export interface IFactionBadge {
  /** 팩션 태그 (예: "[AWW]") */
  tag: string;
  /** 팩션 컬러 */
  color: string;
  /** 배지 아이콘 (팩션 엠블럼 키) */
  iconKey: string;
  /** 관계별 배경색 */
  bgColor: string;
}

// ── 팩션 배너/깃발 아이콘 매핑 ──

/** 팩션 배너 아이콘 키 → 이모지/아이콘 매핑 */
export const FACTION_BANNER_ICONS: Record<string, string> = {
  sword: '⚔️',
  shield: '🛡️',
  crown: '👑',
  skull: '💀',
  fire: '🔥',
  star: '⭐',
  lightning: '⚡',
  dragon: '🐉',
  eagle: '🦅',
  wolf: '🐺',
  lion: '🦁',
  phoenix: '🔮',
  default: '🏴',
};

/** 기본 배너 아이콘 */
export function getFactionBannerIcon(iconKey: string): string {
  return FACTION_BANNER_ICONS[iconKey] ?? FACTION_BANNER_ICONS.default;
}

// ── FactionVisualSystem 메인 클래스 ──

/**
 * FactionVisualSystem — 팩션 시각 식별 관리자
 *
 * 서버에서 수신한 팩션 정보를 기반으로 각 플레이어의
 * 시각 구분 요소를 계산한다.
 */
export class FactionVisualSystem {
  /** 내 팩션 ID */
  private myFactionId: string = '';
  /** 내 플레이어 ID */
  private myPlayerId: string = '';
  /** 동맹 팩션 ID 목록 */
  private alliedFactionIds: Set<string> = new Set();
  /** 팩션 ID → 컬러 매핑 */
  private factionColorMap: Map<string, string> = new Map();
  /** 팩션 ID → 이름 매핑 */
  private factionNameMap: Map<string, string> = new Map();
  /** 팩션 ID → 배너 아이콘 키 */
  private factionIconMap: Map<string, string> = new Map();
  /** 팩션 ID → 생존 멤버 수 */
  private factionAliveCount: Map<string, number> = new Map();
  /** 팩션 ID → 전체 멤버 수 */
  private factionTotalCount: Map<string, number> = new Map();
  /** 플레이어 ID → 팩션 ID */
  private playerFactionMap: Map<string, string> = new Map();

  // ── 초기화 ──

  /** 내 플레이어/팩션 정보 설정 */
  setMyInfo(playerId: string, factionId: string): void {
    this.myPlayerId = playerId;
    this.myFactionId = factionId;
  }

  /** 동맹 팩션 목록 설정 */
  setAlliedFactions(alliedIds: string[]): void {
    this.alliedFactionIds = new Set(alliedIds);
  }

  /** 플레이어-팩션 매핑 등록 */
  registerPlayer(playerId: string, factionId: string): void {
    this.playerFactionMap.set(playerId, factionId);
  }

  /** 플레이어 등록 해제 */
  unregisterPlayer(playerId: string): void {
    this.playerFactionMap.delete(playerId);
  }

  // ── 팩션 현황 업데이트 ──

  /** 서버에서 수신한 팩션 현황으로 갱신 */
  updateFactionPresences(presences: IFactionPresence[]): void {
    this.factionColorMap.clear();
    this.factionNameMap.clear();
    this.factionAliveCount.clear();
    this.factionTotalCount.clear();

    for (const p of presences) {
      this.factionColorMap.set(p.factionId, p.color);
      this.factionNameMap.set(p.factionId, p.factionName);
      this.factionAliveCount.set(p.factionId, p.aliveCount);
      this.factionTotalCount.set(p.factionId, p.memberCount);
    }
  }

  /** 팩션 배너 아이콘 설정 */
  setFactionIcon(factionId: string, iconKey: string): void {
    this.factionIconMap.set(factionId, iconKey);
  }

  // ── 관계 판정 ──

  /** 두 플레이어 간 관계 판정 */
  getRelation(playerId: string): FactionRelation {
    if (playerId === this.myPlayerId) return 'self';

    const targetFaction = this.playerFactionMap.get(playerId);
    if (!targetFaction) return 'neutral';

    if (targetFaction === this.myFactionId) return 'ally';
    if (this.alliedFactionIds.has(targetFaction)) return 'allied';
    return 'enemy';
  }

  /** 팩션 ID 기준 관계 판정 */
  getFactionRelation(factionId: string): FactionRelation {
    if (factionId === this.myFactionId) return 'ally';
    if (this.alliedFactionIds.has(factionId)) return 'allied';
    return 'enemy';
  }

  // ── 시각 요소 계산 ──

  /** 팩션 컬러 링 설정 반환 */
  getRingConfig(playerId: string): IFactionRingConfig {
    const relation = this.getRelation(playerId);
    const factionId = this.playerFactionMap.get(playerId) ?? '';
    const factionColor = this.factionColorMap.get(factionId) ?? '#9CA3AF';

    return {
      ...DEFAULT_RING_CONFIG,
      color: factionColor,
      alpha: relation === 'self' ? 1.0 : relation === 'ally' ? 0.8 : 0.6,
      pulse: relation === 'enemy',
    };
  }

  /** 미니맵 도트 색상 반환 */
  getMinimapColor(playerId: string): string {
    const relation = this.getRelation(playerId);
    return MINIMAP_COLORS[relation];
  }

  /** HP바 색상 반환 */
  getHPBarColor(playerId: string): string {
    const relation = this.getRelation(playerId);
    return HP_BAR_COLORS[relation];
  }

  /** 네임플레이트 배지 데이터 반환 */
  getNameplateBadge(playerId: string): IFactionBadge | null {
    const factionId = this.playerFactionMap.get(playerId);
    if (!factionId) return null;

    const name = this.factionNameMap.get(factionId) ?? 'Unknown';
    const color = this.factionColorMap.get(factionId) ?? '#9CA3AF';
    const iconKey = this.factionIconMap.get(factionId) ?? 'default';

    // 팩션 태그: 이름 앞 3글자 (대문자)
    const tag = `[${name.substring(0, 3).toUpperCase()}]`;

    const relation = this.getRelation(playerId);
    let bgColor: string;
    switch (relation) {
      case 'self':
      case 'ally':
        bgColor = 'rgba(34, 197, 94, 0.3)'; // 초록 배경
        break;
      case 'allied':
        bgColor = 'rgba(59, 130, 246, 0.3)'; // 파랑 배경
        break;
      case 'enemy':
        bgColor = 'rgba(239, 68, 68, 0.3)'; // 빨강 배경
        break;
      default:
        bgColor = 'rgba(156, 163, 175, 0.3)'; // 회색 배경
    }

    return { tag, color, iconKey, bgColor };
  }

  // ── 팩션 생존 현황 ──

  /** 팩션별 생존 멤버 카운트 반환 */
  getFactionAliveCount(factionId: string): number {
    return this.factionAliveCount.get(factionId) ?? 0;
  }

  /** 팩션별 전체 멤버 카운트 반환 */
  getFactionTotalCount(factionId: string): number {
    return this.factionTotalCount.get(factionId) ?? 0;
  }

  /** 팩션 전멸 여부 확인 */
  isFactionEliminated(factionId: string): boolean {
    return this.getFactionAliveCount(factionId) === 0;
  }

  /** 내 팩션 생존 멤버 수 */
  getMyFactionAliveCount(): number {
    return this.getFactionAliveCount(this.myFactionId);
  }

  // ── HUD 데이터 ──

  /** HUD용 정렬된 팩션 목록 반환 (내 팩션 → 동맹 → 적군 순) */
  getSortedFactions(): IFactionHUDEntry[] {
    const entries: IFactionHUDEntry[] = [];
    const allFactionIds = Array.from(this.factionColorMap.keys());

    for (const fid of allFactionIds) {
      const relation = this.getFactionRelation(fid);
      entries.push({
        factionId: fid,
        factionName: this.factionNameMap.get(fid) ?? 'Unknown',
        color: this.factionColorMap.get(fid) ?? '#9CA3AF',
        iconKey: this.factionIconMap.get(fid) ?? 'default',
        bannerIcon: getFactionBannerIcon(this.factionIconMap.get(fid) ?? 'default'),
        aliveCount: this.factionAliveCount.get(fid) ?? 0,
        totalCount: this.factionTotalCount.get(fid) ?? 0,
        relation,
        isEliminated: this.isFactionEliminated(fid),
        isMyFaction: fid === this.myFactionId,
      });
    }

    // 정렬: 내 팩션 → 동맹 → 적군 (생존자 많은 순)
    entries.sort((a, b) => {
      const priority: Record<FactionRelation, number> = {
        self: 0,
        ally: 1,
        allied: 2,
        enemy: 3,
        neutral: 4,
      };
      const pa = a.isMyFaction ? 0 : priority[a.relation];
      const pb = b.isMyFaction ? 0 : priority[b.relation];
      if (pa !== pb) return pa - pb;
      return b.aliveCount - a.aliveCount;
    });

    return entries;
  }

  // ── 리셋 ──

  /** 전체 리셋 (아레나 퇴장 시) */
  reset(): void {
    this.myFactionId = '';
    this.myPlayerId = '';
    this.alliedFactionIds.clear();
    this.factionColorMap.clear();
    this.factionNameMap.clear();
    this.factionIconMap.clear();
    this.factionAliveCount.clear();
    this.factionTotalCount.clear();
    this.playerFactionMap.clear();
  }
}

// ── HUD 데이터 인터페이스 ──

/** 팩션 HUD 항목 */
export interface IFactionHUDEntry {
  /** 팩션 ID */
  factionId: string;
  /** 팩션명 */
  factionName: string;
  /** 팩션 컬러 */
  color: string;
  /** 배너 아이콘 키 */
  iconKey: string;
  /** 배너 아이콘 (이모지) */
  bannerIcon: string;
  /** 생존 멤버 수 */
  aliveCount: number;
  /** 전체 멤버 수 */
  totalCount: number;
  /** 관계 */
  relation: FactionRelation;
  /** 전멸 여부 */
  isEliminated: boolean;
  /** 내 팩션 여부 */
  isMyFaction: boolean;
}

// ── 팩션 킬 포인트 데이터 ──

/** 서버에서 수신한 팩션 킬 이벤트 (PvP 킬 포인트 연동) */
export interface IFactionKillEvent {
  /** 킬러 ID */
  killerId: string;
  /** 킬러 팩션 ID */
  killerFaction: string;
  /** 타겟 ID */
  targetId: string;
  /** 타겟 팩션 ID */
  targetFaction: string;
  /** 획득 Gold */
  gold: number;
  /** 획득 Nation Score */
  nationScore: number;
  /** 기여 Region Point */
  regionPointRP: number;
  /** 팩션 전멸 킬 여부 */
  isWipeKill: boolean;
}

/** 서버에서 수신한 팩션 어시스트 이벤트 */
export interface IFactionAssistEvent {
  /** 어시스터 ID */
  assisterId: string;
  /** 어시스터 팩션 ID */
  assisterFaction: string;
  /** 타겟 ID */
  targetId: string;
  /** 타겟 팩션 ID */
  targetFaction: string;
  /** 획득 Gold */
  gold: number;
  /** 획득 Nation Score */
  nationScore: number;
  /** 기여 Region Point */
  regionPointRP: number;
}

/** 팩션 전투 점수 (라운드 내 누적) */
export interface IFactionCombatScore {
  /** 팩션 ID */
  factionId: string;
  /** PvP 킬 수 */
  kills: number;
  /** 어시스트 수 */
  assists: number;
  /** 팩션 전멸 횟수 */
  wipes: number;
  /** 킬 RP */
  killRP: number;
  /** 어시스트 RP */
  assistRP: number;
  /** 전멸 보너스 RP */
  wipeRP: number;
  /** 총 전투 RP */
  totalRP: number;
}

// ── 팩션 Underdog Boost 데이터 ──

/** Underdog 보정 데이터 (서버에서 수신) */
export interface IUnderdogBoost {
  /** HP 보정 배율 (1.0 ~ 1.3) */
  hpMultiplier: number;
  /** DMG 보정 배율 (1.0 ~ 1.2) */
  dmgMultiplier: number;
  /** NPC 지원 수 (0 ~ 3) */
  npcSupport: number;
}

// ── 싱글톤 인스턴스 ──

/** 전역 FactionVisualSystem 인스턴스 */
export const factionVisualSystem = new FactionVisualSystem();
