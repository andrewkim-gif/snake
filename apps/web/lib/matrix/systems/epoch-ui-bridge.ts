/**
 * epoch-ui-bridge.ts — 에폭 페이즈 → UI 상태 연결
 *
 * v33 Phase 3: 서버에서 수신한 matrix_epoch 이벤트를 파싱하여
 * MatrixApp UI 컴포넌트가 소비할 수 있는 형태로 변환한다.
 *
 * 6개 에폭 페이즈:
 *   peace (5분) → war_countdown (10초) → war (3분) → shrink (2분) → end (5초) → transition (10초)
 *
 * 각 페이즈에서 UI에 반영해야 할 것:
 *   - 현재 페이즈 이름 + 색상
 *   - 남은 시간 카운트다운
 *   - PvP ON/OFF 상태
 *   - orbMultiplier (평화 2x, 전쟁 1x)
 *   - 전쟁 사이렌 (war_countdown 마지막 3초)
 *   - 수축 타겟 반경 (shrink 페이즈)
 *   - 결과 화면 트리거 (end 페이즈)
 */

import type {
  MatrixEpochPayload,
  MatrixEpochPhase,
} from '@/hooks/useMatrixSocket';

// ─── 타입 ───

/** 페이즈별 설정 */
export interface PhaseConfig {
  /** 페이즈 표시 이름 */
  displayName: string;
  /** 페이즈 색상 (HUD 표시용) */
  color: string;
  /** PvP 활성 여부 */
  pvpEnabled: boolean;
  /** 몬스터 스폰 배율 */
  orbMultiplier: number;
  /** 수축 타겟 반경 (shrink 페이즈에서만 유효) */
  shrinkTarget: number | null;
  /** 안전 구역 밖 초당 대미지 (HP 비율) */
  zoneDpsPercent: number;
}

/** UI 표시용 에폭 상태 */
export interface EpochUIState {
  /** 현재 에폭 페이즈 */
  phase: MatrixEpochPhase;
  /** 현재 페이즈 설정 */
  config: PhaseConfig;
  /** 남은 시간 (초) */
  countdown: number;
  /** 타이머 표시 문자열 (MM:SS) */
  timerDisplay: string;
  /** 전쟁 사이렌 활성 (war_countdown 마지막 3초) */
  warSiren: boolean;
  /** 전쟁 카운트다운 숫자 (10~1, war_countdown 페이즈에서만) */
  warCountdownNumber: number | null;
  /** 결과 화면 표시 여부 (end 페이즈) */
  showResult: boolean;
  /** 전환 중 여부 (transition 페이즈) */
  isTransitioning: boolean;
}

/** 에폭 이벤트 콜백 */
export interface EpochUICallbacks {
  /** 페이즈 전환 시 호출 */
  onPhaseChange?: (phase: MatrixEpochPhase, config: PhaseConfig) => void;
  /** 전쟁 사이렌 시작 시 호출 */
  onWarSiren?: () => void;
  /** 에폭 종료 (결과 표시) 시 호출 */
  onEpochEnd?: () => void;
  /** 새 에폭 시작 시 호출 (transition → peace) */
  onNewEpoch?: () => void;
}

// ─── 상수: 페이즈별 설정 ───

const PHASE_CONFIGS: Record<MatrixEpochPhase, PhaseConfig> = {
  peace: {
    displayName: 'PEACE',
    color: '#4ADE80',     // green-400
    pvpEnabled: false,
    orbMultiplier: 2.0,
    shrinkTarget: null,
    zoneDpsPercent: 0,
  },
  war_countdown: {
    displayName: 'WAR INCOMING',
    color: '#FBBF24',     // amber-400
    pvpEnabled: false,
    orbMultiplier: 1.5,
    shrinkTarget: null,
    zoneDpsPercent: 0,
  },
  war: {
    displayName: 'WAR',
    color: '#EF4444',     // red-500
    pvpEnabled: true,
    orbMultiplier: 1.0,
    shrinkTarget: null,
    zoneDpsPercent: 0,
  },
  shrink: {
    displayName: 'SHRINK',
    color: '#F97316',     // orange-500
    pvpEnabled: true,
    orbMultiplier: 1.0,
    shrinkTarget: 1000,
    zoneDpsPercent: 5,
  },
  end: {
    displayName: 'EPOCH END',
    color: '#8B5CF6',     // violet-500
    pvpEnabled: false,
    orbMultiplier: 0,
    shrinkTarget: null,
    zoneDpsPercent: 0,
  },
  transition: {
    displayName: 'NEXT EPOCH',
    color: '#6366F1',     // indigo-500
    pvpEnabled: false,
    orbMultiplier: 0,
    shrinkTarget: null,
    zoneDpsPercent: 0,
  },
};

/** 전쟁 사이렌 활성 임계값 (초) */
const WAR_SIREN_THRESHOLD = 3;

// ─── 클래스 구현 ───

export class EpochUIBridge {
  /** 현재 UI 상태 */
  private _state: EpochUIState = {
    phase: 'peace',
    config: PHASE_CONFIGS.peace,
    countdown: 0,
    timerDisplay: '05:00',
    warSiren: false,
    warCountdownNumber: null,
    showResult: false,
    isTransitioning: false,
  };

  /** 콜백 */
  private callbacks: EpochUICallbacks = {};

  /** 이전 페이즈 (변경 감지용) */
  private previousPhase: MatrixEpochPhase = 'peace';

  /** 현재 UI 상태 (읽기 전용) */
  get state(): EpochUIState {
    return this._state;
  }

  /** 콜백 설정 */
  setCallbacks(callbacks: EpochUICallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * matrix_epoch 이벤트 수신 시 호출
   * 서버에서 에폭 페이즈 전환 알림을 받아 UI 상태를 업데이트한다.
   */
  onEpochEvent(payload: MatrixEpochPayload): void {
    const { phase, countdown, config: serverConfig } = payload;

    // 페이즈 변경 감지
    const phaseChanged = phase !== this.previousPhase;

    // 페이즈 설정 결정 (서버 config 우선, 없으면 로컬 기본값)
    const baseConfig = PHASE_CONFIGS[phase] ?? PHASE_CONFIGS.peace;
    const config: PhaseConfig = {
      ...baseConfig,
      ...(serverConfig?.pvpEnabled !== undefined && { pvpEnabled: serverConfig.pvpEnabled }),
      ...(serverConfig?.orbMultiplier !== undefined && { orbMultiplier: serverConfig.orbMultiplier }),
      ...(serverConfig?.shrinkTarget !== undefined && { shrinkTarget: serverConfig.shrinkTarget }),
    };

    // 전쟁 사이렌: war_countdown 마지막 3초
    const warSiren = phase === 'war_countdown' && (countdown ?? 0) <= WAR_SIREN_THRESHOLD;

    // 전쟁 카운트다운 숫자 (10~1)
    const warCountdownNumber = phase === 'war_countdown' ? Math.ceil(countdown ?? 0) : null;

    // UI 상태 업데이트
    this._state = {
      phase,
      config,
      countdown: countdown ?? 0,
      timerDisplay: formatTimer(countdown ?? 0),
      warSiren,
      warCountdownNumber,
      showResult: phase === 'end',
      isTransitioning: phase === 'transition',
    };

    // 콜백 발화
    if (phaseChanged) {
      this.previousPhase = phase;
      this.callbacks.onPhaseChange?.(phase, config);

      if (phase === 'peace' && this.previousPhase !== 'peace') {
        this.callbacks.onNewEpoch?.();
      }
      if (phase === 'end') {
        this.callbacks.onEpochEnd?.();
      }
    }

    // 사이렌 콜백 (최초 진입 시 1회)
    if (warSiren && !this._state.warSiren) {
      this.callbacks.onWarSiren?.();
    }
  }

  /**
   * OnlineSyncSystem.state에서 타이머 업데이트
   * matrix_state의 timer 필드로 카운트다운 동기화
   */
  updateTimer(timer: number): void {
    this._state.countdown = timer;
    this._state.timerDisplay = formatTimer(timer);

    // war_countdown 사이렌 재계산
    if (this._state.phase === 'war_countdown') {
      this._state.warSiren = timer <= WAR_SIREN_THRESHOLD;
      this._state.warCountdownNumber = Math.ceil(timer);
    }
  }

  /**
   * 현재 페이즈에 맞는 설정 조회
   * (MatrixCanvas에서 orbMultiplier, pvp 등 참조용)
   */
  getPhaseConfig(): PhaseConfig {
    return this._state.config;
  }

  /** 전체 리셋 (아레나 퇴장 시) */
  reset(): void {
    this.previousPhase = 'peace';
    this._state = {
      phase: 'peace',
      config: PHASE_CONFIGS.peace,
      countdown: 0,
      timerDisplay: '05:00',
      warSiren: false,
      warCountdownNumber: null,
      showResult: false,
      isTransitioning: false,
    };
  }
}

// ─── 유틸리티 ───

/** 초 → MM:SS 포맷 변환 */
function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
