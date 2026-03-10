/**
 * client-prediction.ts — 클라이언트 예측 + 서버 보정 시스템
 *
 * v33 Phase 3: 하이브리드 서버 권위적 모델의 핵심.
 * 자기 캐릭터는 로컬에서 즉시 시뮬레이션하고 (60fps 반응성),
 * 서버에서 수신한 위치와 비교하여 보정한다.
 *
 * 보정 정책:
 *   Δ < 50px  → 무시 (네트워크 지연 허용 범위)
 *   50 ≤ Δ < 100px → lerp (부드러운 보정, 200ms)
 *   Δ ≥ 100px → snap (즉시 보정, 치팅/텔레포트)
 *
 * 추가로 킬 confirm/reject 콜백도 관리한다.
 */

import type { Vector2 } from '../types';

// ─── 타입 ───

/** 예측 입력 기록 (reconciliation용) */
export interface PredictionInput {
  tick: number;
  x: number;
  y: number;
  angle: number;
  boost: boolean;
  timestamp: number;
}

/** 보정 상태 */
export type ReconciliationMode = 'idle' | 'lerping' | 'snapped';

/** 보정 결과 (디버그/UI 표시용) */
export interface ReconciliationResult {
  mode: ReconciliationMode;
  deltaDistance: number;
  correctedX: number;
  correctedY: number;
}

// ─── 상수 ───

/** lerp 시작 임계값 (px) */
const LERP_THRESHOLD = 50;
/** snap 임계값 (px) */
const SNAP_THRESHOLD = 100;
/** lerp 보정 속도 (0~1, 높을수록 빠르게 보정) */
const LERP_SPEED = 0.15;
/** 최대 저장 입력 수 */
const MAX_PENDING_INPUTS = 120; // 2초 @ 60fps

// ─── 클래스 구현 ───

export class ClientPrediction {
  /** 로컬 예측 위치 */
  private localX = 0;
  private localY = 0;

  /** 서버에서 마지막으로 확인된 위치 */
  private serverX = 0;
  private serverY = 0;

  /** 보정 타겟 (lerp 모드에서 사용) */
  private targetX = 0;
  private targetY = 0;

  /** 현재 보정 모드 */
  private _mode: ReconciliationMode = 'idle';

  /** 입력 히스토리 (서버 확인 전) */
  private pendingInputs: PredictionInput[] = [];

  /** 마지막 서버 확인 틱 */
  private lastServerTick = 0;

  /** 보정 모드 */
  get mode(): ReconciliationMode {
    return this._mode;
  }

  /** 현재 표시 위치 */
  get displayX(): number {
    return this.localX;
  }

  get displayY(): number {
    return this.localY;
  }

  /**
   * 로컬 입력 적용 — 즉각적 위치 업데이트
   * 매 프레임 (60fps) 호출
   */
  applyInput(input: PredictionInput): void {
    this.localX = input.x;
    this.localY = input.y;

    // 입력 히스토리에 추가
    this.pendingInputs.push(input);

    // 히스토리 크기 제한
    if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs.splice(0, this.pendingInputs.length - MAX_PENDING_INPUTS);
    }
  }

  /**
   * 서버 위치 보정 — 서버 상태 수신 시 호출
   * 서버의 권위적 위치와 로컬 예측 위치를 비교하여 보정한다.
   *
   * @param serverX 서버가 인정한 X 좌표
   * @param serverY 서버가 인정한 Y 좌표
   * @param serverTick 서버 틱
   * @returns 보정 결과
   */
  reconcile(serverX: number, serverY: number, serverTick: number): ReconciliationResult {
    this.serverX = serverX;
    this.serverY = serverY;
    this.lastServerTick = serverTick;

    // 서버 확인 완료된 입력 제거
    this.pendingInputs = this.pendingInputs.filter(input => input.tick > serverTick);

    // 로컬 vs 서버 위치 차이 계산
    const dx = this.localX - serverX;
    const dy = this.localY - serverY;
    const delta = Math.sqrt(dx * dx + dy * dy);

    let correctedX = this.localX;
    let correctedY = this.localY;

    if (delta >= SNAP_THRESHOLD) {
      // 100px 이상: 즉시 보정 (치팅 또는 심각한 동기화 오류)
      this.localX = serverX;
      this.localY = serverY;
      correctedX = serverX;
      correctedY = serverY;
      this._mode = 'snapped';
    } else if (delta >= LERP_THRESHOLD) {
      // 50~100px: 부드러운 보정
      this.targetX = serverX;
      this.targetY = serverY;
      this._mode = 'lerping';
      // 실제 lerp는 tick()에서 수행
    } else {
      // 50px 미만: 무시 (정상 범위)
      this._mode = 'idle';
    }

    return {
      mode: this._mode,
      deltaDistance: delta,
      correctedX,
      correctedY,
    };
  }

  /**
   * 매 프레임 업데이트 — lerp 보정 진행
   * 게임 루프에서 매 프레임 호출해야 한다.
   */
  tick(): void {
    if (this._mode === 'lerping') {
      this.localX += (this.targetX - this.localX) * LERP_SPEED;
      this.localY += (this.targetY - this.localY) * LERP_SPEED;

      // 보정 완료 확인
      const dx = this.localX - this.targetX;
      const dy = this.localY - this.targetY;
      if (Math.sqrt(dx * dx + dy * dy) < 1) {
        this.localX = this.targetX;
        this.localY = this.targetY;
        this._mode = 'idle';
      }
    }
  }

  /**
   * 초기 위치 설정 (아레나 입장 시)
   */
  setInitialPosition(x: number, y: number): void {
    this.localX = x;
    this.localY = y;
    this.serverX = x;
    this.serverY = y;
    this.targetX = x;
    this.targetY = y;
    this._mode = 'idle';
    this.pendingInputs = [];
  }

  /** 전체 리셋 */
  reset(): void {
    this.localX = 0;
    this.localY = 0;
    this.serverX = 0;
    this.serverY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this._mode = 'idle';
    this.pendingInputs = [];
    this.lastServerTick = 0;
  }
}
