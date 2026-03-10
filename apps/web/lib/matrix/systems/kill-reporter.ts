/**
 * kill-reporter.ts — 킬 리포트 + 확인/거부 시스템
 *
 * v33 Phase 3: 하이브리드 모델에서 킬은 클라이언트가 감지하고
 * 서버가 검증한다.
 *
 * 플로우:
 *   1. 로컬 전투 시스템에서 적 HP ≤ 0 감지
 *   2. 즉시 킬 이펙트 로컬 표시 (낙관적 업데이트)
 *   3. matrix_kill 이벤트로 서버에 리포트
 *   4. 서버 검증 결과 수신:
 *      - confirmed → 스코어 적립, 낙관적 업데이트 확정
 *      - rejected → 킬 롤백, suspicion 카운터 증가
 *
 * 롤백 시 스코어/킬 카운트를 원복하되, 시각 이펙트(파티클 등)는
 * 이미 표시된 것이므로 롤백하지 않는다 (UX 우선).
 */

import type { UseMatrixSocketReturn } from '@/hooks/useMatrixSocket';
import type { WeaponType } from '../types';

// ─── 타입 ───

/** 대기 중인 킬 (서버 확인 전) */
export interface PendingKill {
  /** 킬 고유 ID (로컬) */
  localId: string;
  /** 타겟 플레이어 ID */
  targetId: string;
  /** 사용 무기 */
  weaponId: string;
  /** 데미지량 */
  damage: number;
  /** 거리 */
  distance: number;
  /** 리포트 시 서버 틱 */
  tick: number;
  /** 리포트 시간 (ms) */
  timestamp: number;
  /** 낙관적으로 적용한 스코어 */
  optimisticScore: number;
}

/** 확정된 킬 */
export interface ConfirmedKill {
  targetId: string;
  score: number;
  confirmedAt: number;
}

/** 킬 리포터 상태 (UI 표시용) */
export interface KillReporterState {
  /** 대기 중인 킬 수 */
  pendingCount: number;
  /** 확정된 킬 총 수 */
  confirmedCount: number;
  /** 거부된 킬 총 수 */
  rejectedCount: number;
  /** 서버 의심 레벨 (rejected가 쌓이면 증가) */
  suspicionLevel: number;
  /** 최근 확정된 킬 (UI 알림용) */
  lastConfirmed: ConfirmedKill | null;
  /** 최근 거부 사유 */
  lastRejectedReason: string | null;
}

// ─── 콜백 타입 ───

export interface KillReporterCallbacks {
  /** 킬 확정 시 호출 (스코어 표시 등) */
  onConfirmed?: (kill: ConfirmedKill) => void;
  /** 킬 거부 시 호출 (롤백 처리) */
  onRejected?: (targetId: string, reason: string) => void;
  /** suspicion 레벨 변경 시 호출 */
  onSuspicionChange?: (level: number) => void;
}

// ─── 상수 ───

/** 킬 확인 대기 타임아웃 (ms) — 이 시간 내에 confirmed/rejected 없으면 자동 확정 */
const KILL_CONFIRM_TIMEOUT_MS = 3000;
/** 최대 대기 킬 수 */
const MAX_PENDING_KILLS = 20;
/** PvP 킬 기본 스코어 */
const PVP_KILL_SCORE = 15;

// ─── 클래스 구현 ───

export class KillReporter {
  /** 대기 중인 킬 목록 */
  private pending: PendingKill[] = [];
  /** 확정된 킬 목록 (최근 50개) */
  private confirmed: ConfirmedKill[] = [];
  /** 거부 카운트 */
  private _rejectedCount = 0;
  /** 의심 레벨 */
  private _suspicionLevel = 0;
  /** 콜백 */
  private callbacks: KillReporterCallbacks = {};
  /** 마지막 거부 사유 */
  private _lastRejectedReason: string | null = null;
  /** 킬 ID 카운터 */
  private idCounter = 0;

  /** 현재 상태 조회 */
  get state(): KillReporterState {
    return {
      pendingCount: this.pending.length,
      confirmedCount: this.confirmed.length,
      rejectedCount: this._rejectedCount,
      suspicionLevel: this._suspicionLevel,
      lastConfirmed: this.confirmed.length > 0 ? this.confirmed[this.confirmed.length - 1] : null,
      lastRejectedReason: this._lastRejectedReason,
    };
  }

  /** 콜백 설정 */
  setCallbacks(callbacks: KillReporterCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * PvP 킬 리포트 — 로컬 전투 시스템에서 호출
   *
   * @param targetId 킬 대상 플레이어 ID
   * @param weaponId 사용 무기 타입
   * @param damage 최종 데미지
   * @param distance 킬 시 거리 (px)
   * @param socket 소켓 훅 (서버 전송용)
   * @returns 로컬 킬 ID (롤백 추적용)
   */
  reportKill(
    targetId: string,
    weaponId: string,
    damage: number,
    distance: number,
    socket: Pick<UseMatrixSocketReturn, 'reportKill' | 'serverTick'>,
  ): string {
    const localId = `kill_${this.idCounter++}`;

    const pendingKill: PendingKill = {
      localId,
      targetId,
      weaponId,
      damage,
      distance,
      tick: socket.serverTick,
      timestamp: Date.now(),
      optimisticScore: PVP_KILL_SCORE,
    };

    this.pending.push(pendingKill);

    // 대기 큐 크기 제한
    if (this.pending.length > MAX_PENDING_KILLS) {
      // 가장 오래된 킬 자동 확정 (타임아웃)
      const oldest = this.pending.shift()!;
      this.autoConfirm(oldest);
    }

    // 서버에 킬 리포트 전송
    socket.reportKill(targetId, weaponId, damage, distance);

    return localId;
  }

  /**
   * 서버 확정 수신 — matrix_kill_confirmed 콜백
   */
  onConfirmed(data: { killerId: string; targetId: string; score: number }): void {
    // 대기 목록에서 해당 킬 찾기
    const idx = this.pending.findIndex(k => k.targetId === data.targetId);
    if (idx >= 0) {
      this.pending.splice(idx, 1);
    }

    const confirmed: ConfirmedKill = {
      targetId: data.targetId,
      score: data.score,
      confirmedAt: Date.now(),
    };

    this.confirmed.push(confirmed);

    // 히스토리 크기 제한
    if (this.confirmed.length > 50) {
      this.confirmed.shift();
    }

    this.callbacks.onConfirmed?.(confirmed);
  }

  /**
   * 서버 거부 수신 — matrix_kill_rejected 콜백
   */
  onRejected(data: { reason: string; targetId?: string }): void {
    this._rejectedCount++;
    this._suspicionLevel++;
    this._lastRejectedReason = data.reason;

    // 대기 목록에서 제거
    if (data.targetId) {
      const idx = this.pending.findIndex(k => k.targetId === data.targetId);
      if (idx >= 0) {
        this.pending.splice(idx, 1);
      }
    }

    // 콜백 호출 (롤백 처리)
    this.callbacks.onRejected?.(data.targetId ?? '', data.reason);
    this.callbacks.onSuspicionChange?.(this._suspicionLevel);
  }

  /**
   * 주기적 틱 — 타임아웃된 대기 킬 자동 확정
   * 게임 루프에서 매초 1회 호출 권장
   */
  tick(): void {
    const now = Date.now();
    const timedOut: PendingKill[] = [];

    this.pending = this.pending.filter(kill => {
      if (now - kill.timestamp > KILL_CONFIRM_TIMEOUT_MS) {
        timedOut.push(kill);
        return false;
      }
      return true;
    });

    for (const kill of timedOut) {
      this.autoConfirm(kill);
    }
  }

  /** 타임아웃 킬 자동 확정 */
  private autoConfirm(kill: PendingKill): void {
    const confirmed: ConfirmedKill = {
      targetId: kill.targetId,
      score: kill.optimisticScore,
      confirmedAt: Date.now(),
    };
    this.confirmed.push(confirmed);
    if (this.confirmed.length > 50) {
      this.confirmed.shift();
    }
    this.callbacks.onConfirmed?.(confirmed);
  }

  /** 전체 리셋 */
  reset(): void {
    this.pending = [];
    this.confirmed = [];
    this._rejectedCount = 0;
    this._suspicionLevel = 0;
    this._lastRejectedReason = null;
    this.idCounter = 0;
  }
}
