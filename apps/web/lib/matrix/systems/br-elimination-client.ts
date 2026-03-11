/**
 * br-elimination-client.ts — v39 Phase 6: 팩션 전멸/승리 클라이언트 시스템
 *
 * 서버에서 수신한 전멸 이벤트와 승리 결과를 관리하고
 * UI 컴포넌트가 소비할 수 있는 데이터를 제공한다.
 *
 * - 팩션 전멸 알림 관리
 * - 관전 모드 전환 지원
 * - 승리 결과 저장
 * - 팩션 생존 현황 추적
 */

import type {
  IBRVictoryResult,
  IFactionEliminationRecord,
  IEliminationEvent,
  IFactionPresence,
  EliminationEventType,
} from '@/lib/matrix/types/region';

// ── 전멸 알림 ──

/** 전멸 알림 데이터 */
export interface EliminationNotification {
  /** 전멸된 팩션명 */
  factionName: string;
  /** 팩션 컬러 */
  color: string;
  /** 알림 시각 (ms) */
  timestamp: number;
  /** 남은 팩션 수 */
  remainingFactions: number;
  /** 내 팩션 전멸 여부 */
  isMyFaction: boolean;
}

/** 관전 모드 상태 */
export interface SpectateState {
  /** 관전 모드 활성화 여부 */
  active: boolean;
  /** 관전 대상 플레이어 ID */
  targetPlayerId: string;
  /** 관전 대상 팩션 ID */
  targetFactionId: string;
}

/** 전멸 시스템 콜백 */
export interface EliminationClientCallbacks {
  /** 팩션 전멸 시 */
  onFactionEliminated?: (notification: EliminationNotification) => void;
  /** 승리 결과 수신 시 */
  onVictory?: (result: IBRVictoryResult) => void;
  /** 관전 모드 전환 시 */
  onSpectateStart?: (state: SpectateState) => void;
  /** 라운드 조기 종료 시 */
  onEarlyRoundEnd?: () => void;
}

// ── BREliminationClientSystem ──

/**
 * BREliminationClientSystem — 전멸/승리 클라이언트 관리자
 */
export class BREliminationClientSystem {
  /** 내 팩션 ID */
  private myFactionId: string = '';
  /** 내 플레이어 ID */
  private myPlayerId: string = '';

  /** 전멸 기록 목록 */
  private eliminations: IFactionEliminationRecord[] = [];

  /** 전멸 알림 대기열 (최근 5개) */
  private notifications: EliminationNotification[] = [];

  /** 승리 결과 */
  private victoryResult: IBRVictoryResult | null = null;

  /** 관전 모드 상태 */
  private spectateState: SpectateState = {
    active: false,
    targetPlayerId: '',
    targetFactionId: '',
  };

  /** 팩션 현황 (최신) */
  private factionPresences: IFactionPresence[] = [];

  /** 콜백 */
  private callbacks: EliminationClientCallbacks = {};

  // ── 초기화 ──

  /** 내 정보 설정 */
  setMyInfo(playerId: string, factionId: string): void {
    this.myPlayerId = playerId;
    this.myFactionId = factionId;
  }

  /** 콜백 설정 */
  setCallbacks(callbacks: EliminationClientCallbacks): void {
    this.callbacks = callbacks;
  }

  // ── 서버 이벤트 수신 ──

  /**
   * 서버 전멸 이벤트 처리
   */
  onEliminationEvent(event: IEliminationEvent): void {
    switch (event.type) {
      case 'faction_eliminated': {
        const record = event.data as IFactionEliminationRecord;
        this.eliminations.push(record);

        // 생존 팩션 수 계산
        const aliveFactions = this.factionPresences.filter(f => !f.isEliminated).length;

        const notification: EliminationNotification = {
          factionName: record.factionName,
          color: record.color,
          timestamp: Date.now(),
          remainingFactions: Math.max(0, aliveFactions - 1),
          isMyFaction: record.factionId === this.myFactionId,
        };
        this.notifications.push(notification);

        // 최근 5개만 유지
        if (this.notifications.length > 5) {
          this.notifications = this.notifications.slice(-5);
        }

        // 내 팩션 전멸 → 관전 모드
        if (notification.isMyFaction) {
          this.spectateState.active = true;
        }

        this.callbacks.onFactionEliminated?.(notification);
        break;
      }

      case 'br_victory': {
        this.victoryResult = event.data as IBRVictoryResult;
        this.callbacks.onVictory?.(this.victoryResult);
        break;
      }

      case 'round_end_early': {
        this.callbacks.onEarlyRoundEnd?.();
        break;
      }

      case 'spectate_switch': {
        const data = event.data as Record<string, unknown>;
        this.spectateState = {
          active: true,
          targetPlayerId: (data.targetPlayerId as string) ?? '',
          targetFactionId: (data.targetFactionId as string) ?? '',
        };
        this.callbacks.onSpectateStart?.(this.spectateState);
        break;
      }
    }
  }

  /**
   * 팩션 현황 업데이트 (서버에서 수신)
   */
  updateFactionPresences(presences: IFactionPresence[]): void {
    this.factionPresences = presences;
  }

  // ── 조회 ──

  /** 전멸 기록 목록 */
  getEliminations(): IFactionEliminationRecord[] {
    return [...this.eliminations];
  }

  /** 최근 전멸 알림 (표시 중인 것) */
  getActiveNotifications(maxAge: number = 5000): EliminationNotification[] {
    const cutoff = Date.now() - maxAge;
    return this.notifications.filter(n => n.timestamp > cutoff);
  }

  /** 승리 결과 */
  getVictoryResult(): IBRVictoryResult | null {
    return this.victoryResult;
  }

  /** 관전 모드 상태 */
  getSpectateState(): SpectateState {
    return { ...this.spectateState };
  }

  /** 내 팩션 전멸 여부 */
  isMyFactionEliminated(): boolean {
    return this.eliminations.some(e => e.factionId === this.myFactionId);
  }

  /** 생존 팩션 수 */
  getAliveFactionCount(): number {
    return this.factionPresences.filter(f => !f.isEliminated).length;
  }

  // ── 관전 모드 조작 ──

  /** 관전 대상 변경 (다음 생존 플레이어) */
  cycleSpectateTarget(alivePlayers: Array<{ playerId: string; factionId: string }>): void {
    if (!this.spectateState.active || alivePlayers.length === 0) return;

    const currentIdx = alivePlayers.findIndex(
      p => p.playerId === this.spectateState.targetPlayerId,
    );
    const nextIdx = (currentIdx + 1) % alivePlayers.length;
    const next = alivePlayers[nextIdx];

    this.spectateState.targetPlayerId = next.playerId;
    this.spectateState.targetFactionId = next.factionId;
  }

  // ── 리셋 ──

  /** 전체 리셋 */
  reset(): void {
    this.eliminations = [];
    this.notifications = [];
    this.victoryResult = null;
    this.spectateState = {
      active: false,
      targetPlayerId: '',
      targetFactionId: '',
    };
    this.factionPresences = [];
  }
}

// ── 싱글톤 인스턴스 ──

/** 전역 전멸 클라이언트 인스턴스 */
export const brEliminationClient = new BREliminationClientSystem();
