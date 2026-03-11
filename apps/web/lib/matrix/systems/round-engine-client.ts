/**
 * round-engine-client.ts — v39 라운드 엔진 클라이언트 시스템
 *
 * 서버에서 수신한 라운드 상태(round_state, matrix_epoch)를 파싱하여
 * UI 컴포넌트가 소비할 수 있는 IRoundHUDState로 변환한다.
 *
 * 기존 EpochUIBridge를 확장하여 3-Phase 라운드 사이클을 지원:
 *   PvE (600s) → BR Countdown (10s) → BR (300s) → Settlement (15s)
 *
 * BR SubPhases:
 *   Skirmish (0~90s) → Engagement (90~210s) → FinalBattle (210~300s)
 *
 * 세이프존 시각화 데이터:
 *   서버 세이프존 상태 → 클라이언트 렌더링용 SafeZoneVisual로 변환
 */

import type {
  RoundPhase,
  BRSubPhase,
  IRoundHUDState,
  IFactionPresence,
  IRoundState,
} from '@/lib/matrix/types/region';

import type { MatrixEpochPayload, MatrixEpochPhase } from '@/hooks/useMatrixSocket';

// ── 라운드 페이즈 설정 ──

/** 페이즈별 UI 설정 */
export interface RoundPhaseUIConfig {
  /** 페이즈 표시 이름 */
  displayName: string;
  /** 서브 표시 이름 (BR SubPhase용) */
  subDisplayName?: string;
  /** 페이즈 색상 (HUD) */
  color: string;
  /** 보조 색상 (그라디언트, 이펙트) */
  secondaryColor: string;
  /** PvP 활성 여부 */
  pvpEnabled: boolean;
  /** 몬스터/자원 스폰 배율 */
  spawnMultiplier: number;
  /** 세이프존 DPS (HP%/초) — 존 밖 */
  zoneDpsPercent: number;
  /** 긴장감 레벨 (0~1, UI 이펙트 강도) */
  tensionLevel: number;
}

/** BR 서브페이즈별 UI 설정 */
export interface BRSubPhaseUIConfig {
  /** 서브 페이즈 표시 이름 */
  displayName: string;
  /** 색상 */
  color: string;
  /** Gold 배율 */
  goldMultiplier: number;
  /** Score 배율 */
  scoreMultiplier: number;
  /** 긴장감 레벨 */
  tensionLevel: number;
}

// ── 페이즈별 상수 ──

const ROUND_PHASE_CONFIGS: Record<RoundPhase, RoundPhaseUIConfig> = {
  pve: {
    displayName: 'PvE FARMING',
    color: '#4ADE80',      // green-400
    secondaryColor: '#22C55E',
    pvpEnabled: false,
    spawnMultiplier: 2.0,
    zoneDpsPercent: 0,
    tensionLevel: 0.1,
  },
  br_countdown: {
    displayName: 'BATTLE INCOMING',
    color: '#FBBF24',      // amber-400
    secondaryColor: '#F59E0B',
    pvpEnabled: false,
    spawnMultiplier: 1.0,
    zoneDpsPercent: 0,
    tensionLevel: 0.7,
  },
  br: {
    displayName: 'BATTLE ROYALE',
    color: '#EF4444',      // red-500
    secondaryColor: '#DC2626',
    pvpEnabled: true,
    spawnMultiplier: 1.0,
    zoneDpsPercent: 5,
    tensionLevel: 0.9,
  },
  settlement: {
    displayName: 'SETTLEMENT',
    color: '#8B5CF6',      // violet-500
    secondaryColor: '#7C3AED',
    pvpEnabled: false,
    spawnMultiplier: 0,
    zoneDpsPercent: 0,
    tensionLevel: 0.2,
  },
};

const BR_SUBPHASE_CONFIGS: Record<BRSubPhase, BRSubPhaseUIConfig> = {
  skirmish: {
    displayName: 'SKIRMISH',
    color: '#F97316',       // orange-500
    goldMultiplier: 1.0,
    scoreMultiplier: 1.0,
    tensionLevel: 0.6,
  },
  engagement: {
    displayName: 'ENGAGEMENT',
    color: '#EF4444',       // red-500
    goldMultiplier: 1.5,
    scoreMultiplier: 1.5,
    tensionLevel: 0.8,
  },
  final_battle: {
    displayName: 'FINAL BATTLE',
    color: '#DC2626',       // red-600
    goldMultiplier: 2.5,
    scoreMultiplier: 3.0,
    tensionLevel: 1.0,
  },
};

// ── 세이프존 시각화 데이터 ──

/** 클라이언트 세이프존 렌더링용 데이터 */
export interface SafeZoneVisual {
  /** 중심 X */
  centerX: number;
  /** 중심 Y */
  centerY: number;
  /** 현재 반경 (px) */
  currentRadius: number;
  /** 목표 반경 (px) — 수축 애니메이션 타겟 */
  targetRadius: number;
  /** 세이프존 수축 단계 (1~4) */
  phase: number;
  /** 존 밖 DPS */
  dps: number;
  /** 수축 중 여부 */
  isShrinking: boolean;
  /** 경고 표시 중 여부 (수축 전 경고) */
  isWarning: boolean;
  /** 존 경계 색상 (경고/수축 상태별) */
  borderColor: string;
  /** 존 밖 오버레이 투명도 (0~0.5) */
  outsideAlpha: number;
}

// ── 라운드 엔진 콜백 ──

/** 라운드 이벤트 콜백 */
export interface RoundEngineCallbacks {
  /** 페이즈 전환 시 호출 */
  onPhaseChange?: (phase: RoundPhase, config: RoundPhaseUIConfig) => void;
  /** BR 서브 페이즈 전환 시 호출 */
  onSubPhaseChange?: (subPhase: BRSubPhase, config: BRSubPhaseUIConfig) => void;
  /** BR 카운트다운 (10→1) */
  onBRCountdown?: (secondsLeft: number) => void;
  /** 전쟁 경고 (9분 시점) */
  onWarWarning?: () => void;
  /** 라운드 종료 (정산 진입) */
  onRoundEnd?: (roundNumber: number) => void;
  /** 새 라운드 시작 */
  onNewRound?: (roundNumber: number) => void;
  /** 세이프존 업데이트 */
  onSafeZoneUpdate?: (visual: SafeZoneVisual) => void;
}

// ── EpochPhase → RoundPhase 매핑 ──

/** EpochManager 페이즈를 v39 RoundPhase로 변환 */
function epochPhaseToRoundPhase(epochPhase: MatrixEpochPhase): RoundPhase {
  switch (epochPhase) {
    case 'peace':
      return 'pve';
    case 'war_countdown':
      return 'br_countdown';
    case 'war':
    case 'shrink':
      return 'br';
    case 'end':
    case 'transition':
      return 'settlement';
    default:
      return 'pve';
  }
}

// ── 메인 클래스 ──

/**
 * RoundEngineClient — v39 라운드 엔진 클라이언트
 *
 * 서버에서 수신한 라운드 상태를 파싱하여 HUD 표시용 데이터로 변환한다.
 * EpochUIBridge를 대체하며, 기존 matrix_epoch 이벤트도 호환 처리한다.
 */
export class RoundEngineClient {
  // 현재 HUD 상태
  private _hudState: IRoundHUDState = {
    phase: 'pve',
    brSubPhase: null,
    countdown: 600,
    timerDisplay: '10:00',
    roundNumber: 0,
    pvpEnabled: false,
    factions: [],
    myFactionRP: 0,
    brCountdown: null,
  };

  // 세이프존 시각화 상태
  private _safeZone: SafeZoneVisual = {
    centerX: 0,
    centerY: 0,
    currentRadius: 3000,
    targetRadius: 3000,
    phase: 0,
    dps: 0,
    isShrinking: false,
    isWarning: false,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    outsideAlpha: 0,
  };

  // 페이즈 설정
  private _phaseConfig: RoundPhaseUIConfig = ROUND_PHASE_CONFIGS.pve;
  private _subPhaseConfig: BRSubPhaseUIConfig | null = null;

  // 콜백
  private callbacks: RoundEngineCallbacks = {};

  // 이전 상태 (변경 감지용)
  private previousPhase: RoundPhase = 'pve';
  private previousSubPhase: BRSubPhase | null = null;

  // 아레나 크기 (세이프존 비율 계산용)
  private arenaSize: number = 6000;

  /** 현재 HUD 상태 (읽기 전용) */
  get hudState(): IRoundHUDState {
    return this._hudState;
  }

  /** 현재 페이즈 설정 */
  get phaseConfig(): RoundPhaseUIConfig {
    return this._phaseConfig;
  }

  /** 현재 서브페이즈 설정 (BR 중에만 유효) */
  get subPhaseConfig(): BRSubPhaseUIConfig | null {
    return this._subPhaseConfig;
  }

  /** 세이프존 시각화 데이터 */
  get safeZone(): SafeZoneVisual {
    return this._safeZone;
  }

  /** 현재 긴장감 레벨 (0~1) — 음악/이펙트 강도용 */
  get tensionLevel(): number {
    if (this._subPhaseConfig) {
      return this._subPhaseConfig.tensionLevel;
    }
    return this._phaseConfig.tensionLevel;
  }

  /** 콜백 설정 */
  setCallbacks(callbacks: RoundEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  /** 아레나 크기 설정 (지역 진입 시 서버에서 받은 크기로 초기화) */
  setArenaSize(size: number): void {
    this.arenaSize = size;
    this._safeZone.currentRadius = size / 2;
    this._safeZone.targetRadius = size / 2;
    this._safeZone.centerX = size / 2;
    this._safeZone.centerY = size / 2;
  }

  /**
   * 서버 라운드 상태 수신 처리 (matrix_round_state or new v39 event)
   */
  onRoundState(state: IRoundState): void {
    const { phase, brSubPhase, countdown, roundNumber, pvpEnabled, brCountdown } = state;

    // 페이즈 변경 감지
    const phaseChanged = phase !== this.previousPhase;
    const subPhaseChanged = brSubPhase !== this.previousSubPhase;

    // 페이즈 설정 업데이트
    this._phaseConfig = ROUND_PHASE_CONFIGS[phase] ?? ROUND_PHASE_CONFIGS.pve;
    this._subPhaseConfig = brSubPhase ? (BR_SUBPHASE_CONFIGS[brSubPhase] ?? null) : null;

    // HUD 상태 업데이트
    this._hudState = {
      ...this._hudState,
      phase,
      brSubPhase: brSubPhase ?? null,
      countdown,
      timerDisplay: formatTimer(countdown),
      roundNumber,
      pvpEnabled,
      brCountdown: brCountdown ?? null,
    };

    // 콜백 발화
    if (phaseChanged) {
      this.previousPhase = phase;
      this.callbacks.onPhaseChange?.(phase, this._phaseConfig);

      if (phase === 'settlement') {
        this.callbacks.onRoundEnd?.(roundNumber);
      }
      if (phase === 'pve' && roundNumber > 0) {
        this.callbacks.onNewRound?.(roundNumber);
      }
    }

    if (subPhaseChanged && brSubPhase) {
      this.previousSubPhase = brSubPhase;
      if (this._subPhaseConfig) {
        this.callbacks.onSubPhaseChange?.(brSubPhase, this._subPhaseConfig);
      }
    }

    // BR 카운트다운 콜백
    if (phase === 'br_countdown' && brCountdown != null && brCountdown > 0) {
      this.callbacks.onBRCountdown?.(brCountdown);
    }
  }

  /**
   * 기존 matrix_epoch 이벤트 호환 처리
   * EpochUIBridge.onEpochEvent()와 동일한 시그니처를 유지한다.
   */
  onEpochEvent(payload: MatrixEpochPayload): void {
    const roundPhase = epochPhaseToRoundPhase(payload.phase);
    const countdown = payload.countdown ?? 0;

    // epoch payload를 IRoundState로 변환
    const syntheticState: IRoundState = {
      roundNumber: this._hudState.roundNumber,
      phase: roundPhase,
      brSubPhase: roundPhase === 'br' ? this.inferBRSubPhase(countdown) : null,
      countdown,
      timerDisplay: formatTimer(countdown),
      pvpEnabled: payload.config?.pvpEnabled ?? (roundPhase === 'br'),
      brCountdown: roundPhase === 'br_countdown' ? Math.ceil(countdown) : null,
      roundStartedAt: '',
    };

    this.onRoundState(syntheticState);
  }

  /**
   * 세이프존 상태 수신 (서버 round_safezone_update 이벤트)
   */
  onSafeZoneUpdate(data: {
    centerX: number;
    centerY: number;
    currentRadius: number;
    targetRadius: number;
    phase: number;
    dps: number;
    isShrinking: boolean;
    isWarning: boolean;
  }): void {
    this._safeZone = {
      centerX: data.centerX,
      centerY: data.centerY,
      currentRadius: data.currentRadius,
      targetRadius: data.targetRadius,
      phase: data.phase,
      dps: data.dps,
      isShrinking: data.isShrinking,
      isWarning: data.isWarning,
      borderColor: this.computeBorderColor(data.isShrinking, data.isWarning, data.phase),
      outsideAlpha: this.computeOutsideAlpha(data.dps),
    };

    this.callbacks.onSafeZoneUpdate?.(this._safeZone);
  }

  /**
   * matrix_state 패킷의 timer/phase 필드로 카운트다운 동기화
   * (EpochUIBridge.updateTimer() 호환)
   */
  updateTimer(timer: number, phase?: MatrixEpochPhase): void {
    if (phase) {
      const roundPhase = epochPhaseToRoundPhase(phase);
      this._hudState.phase = roundPhase;
      this._phaseConfig = ROUND_PHASE_CONFIGS[roundPhase] ?? ROUND_PHASE_CONFIGS.pve;
    }
    this._hudState.countdown = timer;
    this._hudState.timerDisplay = formatTimer(timer);

    // BR 카운트다운 재계산
    if (this._hudState.phase === 'br_countdown') {
      this._hudState.brCountdown = Math.ceil(timer);
    }
  }

  /**
   * 팩션 현황 업데이트 (아레나 내 팩션 목록)
   */
  updateFactions(factions: IFactionPresence[]): void {
    this._hudState.factions = factions;
  }

  /**
   * 내 팩션 RP 업데이트
   */
  updateMyFactionRP(rp: number): void {
    this._hudState.myFactionRP = rp;
  }

  /**
   * 전체 리셋 (아레나 퇴장 시)
   */
  reset(): void {
    this.previousPhase = 'pve';
    this.previousSubPhase = null;
    this._phaseConfig = ROUND_PHASE_CONFIGS.pve;
    this._subPhaseConfig = null;

    this._hudState = {
      phase: 'pve',
      brSubPhase: null,
      countdown: 600,
      timerDisplay: '10:00',
      roundNumber: 0,
      pvpEnabled: false,
      factions: [],
      myFactionRP: 0,
      brCountdown: null,
    };

    const half = this.arenaSize / 2;
    this._safeZone = {
      centerX: half,
      centerY: half,
      currentRadius: half,
      targetRadius: half,
      phase: 0,
      dps: 0,
      isShrinking: false,
      isWarning: false,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      outsideAlpha: 0,
    };
  }

  // ── Private Helpers ──

  /**
   * BR 남은 시간으로 서브 페이즈 추론 (epoch 호환 모드용)
   * BR 전체 300초 기준:
   *   Skirmish: 300~210초 남음 (0~90초 경과)
   *   Engagement: 210~90초 남음 (90~210초 경과)
   *   FinalBattle: 90~0초 남음 (210~300초 경과)
   */
  private inferBRSubPhase(countdown: number): BRSubPhase {
    const brDuration = 300;
    const elapsed = brDuration - countdown;

    if (elapsed < 90) return 'skirmish';
    if (elapsed < 210) return 'engagement';
    return 'final_battle';
  }

  /** 세이프존 경계 색상 계산 */
  private computeBorderColor(isShrinking: boolean, isWarning: boolean, phase: number): string {
    if (isShrinking) {
      // 수축 중: 빨간색 계열 (단계별 강도 증가)
      const intensity = Math.min(1.0, 0.4 + phase * 0.15);
      return `rgba(239, 68, 68, ${intensity})`; // red-500
    }
    if (isWarning) {
      // 경고: 노란색 펄스
      return 'rgba(251, 191, 36, 0.7)'; // amber-400
    }
    // 기본: 흰색 반투명
    return 'rgba(255, 255, 255, 0.3)';
  }

  /** 존 밖 오버레이 투명도 계산 (DPS 비례) */
  private computeOutsideAlpha(dps: number): number {
    if (dps <= 0) return 0;
    // DPS 5 → 0.15, DPS 10 → 0.25, DPS 20 → 0.35, DPS 40 → 0.45
    return Math.min(0.5, 0.1 + dps * 0.008);
  }
}

// ── 유틸리티 ──

/** 초 → MM:SS 포맷 변환 */
function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/** RoundPhase 표시용 색상 반환 */
export function getRoundPhaseColor(phase: RoundPhase): string {
  return ROUND_PHASE_CONFIGS[phase]?.color ?? '#4ADE80';
}

/** RoundPhase 표시용 이름 반환 */
export function getRoundPhaseDisplayName(phase: RoundPhase): string {
  return ROUND_PHASE_CONFIGS[phase]?.displayName ?? 'PvE FARMING';
}

/** BRSubPhase 표시용 이름 반환 */
export function getBRSubPhaseDisplayName(subPhase: BRSubPhase): string {
  return BR_SUBPHASE_CONFIGS[subPhase]?.displayName ?? '';
}

/** BRSubPhase 표시용 색상 반환 */
export function getBRSubPhaseColor(subPhase: BRSubPhase): string {
  return BR_SUBPHASE_CONFIGS[subPhase]?.color ?? '#EF4444';
}

/**
 * 세이프존 비율 → 실제 반경 계산 (티어별 아레나 크기 적용)
 * @param ratio 세이프존 비율 (0~1, 1 = 100%)
 * @param arenaSize 아레나 크기 (px)
 * @returns 실제 반경 (px)
 */
export function safeZoneRatioToRadius(ratio: number, arenaSize: number): number {
  return (ratio * arenaSize) / 2;
}

/**
 * ROUND_TIMING 상수 (서버와 동기화)
 * server/internal/game/region_types.go의 RoundPvEDuration 등과 일치.
 */
export const ROUND_TIMING_CLIENT = {
  PVE_DURATION: 600,
  BR_DURATION: 300,
  SETTLEMENT_DURATION: 15,
  TOTAL_DURATION: 915,
  BR_COUNTDOWN: 10,
  WAR_WARNING_AT: 540,
} as const;
