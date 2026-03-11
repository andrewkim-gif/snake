/**
 * quality-ladder.ts — 3-tier 적응형 품질 시스템 (S45)
 *
 * Phase 8: Optimization
 * 1. 3-tier 품질: Tier1(Full), Tier2(Reduced), Tier3(Minimal)
 * 2. drei PerformanceMonitor 연동 (FPS <30 5초 지속 → 자동 하향)
 * 3. 수동 설정 override
 *
 * Tier1 (Full):
 *   - bloom + shadows + full particles + HIGH LOD
 *   - antialias: true, dpr: [1, 2]
 *
 * Tier2 (Reduced):
 *   - reduced bloom + no shadows + fewer particles + MID LOD 확장
 *   - antialias: true, dpr: [1, 1.5]
 *
 * Tier3 (Minimal):
 *   - no post-processing + minimal particles + LOW LOD only
 *   - antialias: false, dpr: [1, 1]
 */

// ============================================
// Types
// ============================================

/** 품질 티어 */
export type QualityTierLevel = 'tier1' | 'tier2' | 'tier3';

/** 품질 프리셋 설정 */
export interface QualityLadderPreset {
  /** 티어 이름 */
  tier: QualityTierLevel;
  /** 표시 이름 */
  displayName: string;

  // --- 렌더링 설정 ---
  /** Bloom 활성화 */
  enableBloom: boolean;
  /** Bloom strength (0=비활성화) */
  bloomStrength: number;
  /** Bloom threshold */
  bloomThreshold: number;
  /** Shadow 활성화 */
  enableShadows: boolean;
  /** Shadow map 해상도 */
  shadowMapSize: number;
  /** Vignette 활성화 */
  enableVignette: boolean;
  /** Anti-aliasing */
  antialias: boolean;
  /** Device Pixel Ratio 최대값 */
  maxDpr: number;

  // --- 엔티티 설정 ---
  /** 파티클 최대 수 */
  maxParticles: number;
  /** 파티클 수 배율 (burst 시) */
  particleMultiplier: number;
  /** LOD HIGH 거리 임계값 */
  lodHighDistance: number;
  /** LOD MID 거리 임계값 */
  lodMidDistance: number;
  /** LOD CULL 거리 임계값 */
  lodCullDistance: number;
  /** 지형 오브젝트 표시 거리 */
  terrainObjectDistance: number;
  /** 엘리트 이펙트 활성화 */
  enableEliteEffects: boolean;
  /** 데미지 넘버 최대 수 */
  maxDamageNumbers: number;
}

// ============================================
// 프리셋 정의
// ============================================

/** Tier1: Full Quality */
const TIER1_FULL: QualityLadderPreset = {
  tier: 'tier1',
  displayName: 'Full',

  enableBloom: true,
  bloomStrength: 0.5,
  bloomThreshold: 0.85,
  enableShadows: true,
  shadowMapSize: 2048,
  enableVignette: true,
  antialias: true,
  maxDpr: 2,

  maxParticles: 500,
  particleMultiplier: 1.0,
  lodHighDistance: 800,
  lodMidDistance: 1400,
  lodCullDistance: 2200,
  terrainObjectDistance: 1500,
  enableEliteEffects: true,
  maxDamageNumbers: 40,
};

/** Tier2: Reduced Quality */
const TIER2_REDUCED: QualityLadderPreset = {
  tier: 'tier2',
  displayName: 'Reduced',

  enableBloom: true,
  bloomStrength: 0.25,
  bloomThreshold: 0.9,
  enableShadows: false,
  shadowMapSize: 1024,
  enableVignette: true,
  antialias: true,
  maxDpr: 1.5,

  maxParticles: 250,
  particleMultiplier: 0.6,
  lodHighDistance: 600,
  lodMidDistance: 1000,
  lodCullDistance: 1600,
  terrainObjectDistance: 1000,
  enableEliteEffects: true,
  maxDamageNumbers: 25,
};

/** Tier3: Minimal Quality */
const TIER3_MINIMAL: QualityLadderPreset = {
  tier: 'tier3',
  displayName: 'Minimal',

  enableBloom: false,
  bloomStrength: 0,
  bloomThreshold: 1.0,
  enableShadows: false,
  shadowMapSize: 512,
  enableVignette: false,
  antialias: false,
  maxDpr: 1,

  maxParticles: 100,
  particleMultiplier: 0.3,
  lodHighDistance: 400,
  lodMidDistance: 700,
  lodCullDistance: 1200,
  terrainObjectDistance: 600,
  enableEliteEffects: false,
  maxDamageNumbers: 15,
};

/** 모든 프리셋 */
export const QUALITY_PRESETS: Record<QualityTierLevel, QualityLadderPreset> = {
  tier1: TIER1_FULL,
  tier2: TIER2_REDUCED,
  tier3: TIER3_MINIMAL,
};

// ============================================
// Quality Ladder 매니저
// ============================================

/**
 * QualityLadderManager — 적응형 품질 조절 매니저
 *
 * drei PerformanceMonitor의 onDecline/onIncline 콜백과 연동.
 * FPS 기반 자동 tier 전환 + 수동 override.
 */
export class QualityLadderManager {
  /** 현재 티어 */
  private _currentTier: QualityTierLevel = 'tier1';

  /** 현재 프리셋 */
  private _preset: QualityLadderPreset = TIER1_FULL;

  /** 수동 override 활성 여부 */
  private _manualOverride: boolean = false;

  /** 다운그레이드 연속 카운트 (PerformanceMonitor onDecline) */
  private _declineCount: number = 0;

  /** 다운그레이드 임계값 (연속 N회 decline → 다운그레이드) */
  private readonly DECLINE_THRESHOLD = 2;

  /** 업그레이드 연속 카운트 (PerformanceMonitor onIncline) */
  private _inclineCount: number = 0;

  /** 업그레이드 임계값 */
  private readonly INCLINE_THRESHOLD = 3;

  /** 최근 티어 변경 시간 */
  private _lastChangeTime: number = 0;

  /** 티어 변경 쿨다운 (ms) */
  private readonly CHANGE_COOLDOWN = 5000;

  /** 변경 콜백 */
  private _onChangeCb: ((preset: QualityLadderPreset) => void) | null = null;

  // --- Getters ---

  get currentTier(): QualityTierLevel {
    return this._currentTier;
  }

  get preset(): QualityLadderPreset {
    return this._preset;
  }

  get isManualOverride(): boolean {
    return this._manualOverride;
  }

  // --- 콜백 등록 ---

  onChange(cb: (preset: QualityLadderPreset) => void): void {
    this._onChangeCb = cb;
  }

  // --- PerformanceMonitor 연동 ---

  /**
   * onDecline — FPS 하락 시 호출 (PerformanceMonitor)
   * 연속 DECLINE_THRESHOLD 회 호출 시 한 단계 다운그레이드
   */
  onDecline(): void {
    if (this._manualOverride) return;

    this._inclineCount = 0;
    this._declineCount++;

    if (this._declineCount >= this.DECLINE_THRESHOLD) {
      this._declineCount = 0;
      this.downgrade();
    }
  }

  /**
   * onIncline — FPS 회복 시 호출 (PerformanceMonitor)
   * 연속 INCLINE_THRESHOLD 회 호출 시 한 단계 업그레이드
   */
  onIncline(): void {
    if (this._manualOverride) return;

    this._declineCount = 0;
    this._inclineCount++;

    if (this._inclineCount >= this.INCLINE_THRESHOLD) {
      this._inclineCount = 0;
      this.upgrade();
    }
  }

  // --- 수동 제어 ---

  /**
   * setTier — 수동 티어 설정 (override 활성화)
   */
  setTier(tier: QualityTierLevel): void {
    this._manualOverride = true;
    this._applyTier(tier);
  }

  /**
   * setAutoMode — 자동 모드 복귀
   */
  setAutoMode(): void {
    this._manualOverride = false;
    this._declineCount = 0;
    this._inclineCount = 0;
  }

  // --- 내부 로직 ---

  private downgrade(): void {
    const now = Date.now();
    if (now - this._lastChangeTime < this.CHANGE_COOLDOWN) return;

    const nextTier: QualityTierLevel =
      this._currentTier === 'tier1' ? 'tier2' :
      this._currentTier === 'tier2' ? 'tier3' :
      'tier3'; // 이미 최하위

    if (nextTier === this._currentTier) return;
    this._applyTier(nextTier);
  }

  private upgrade(): void {
    const now = Date.now();
    if (now - this._lastChangeTime < this.CHANGE_COOLDOWN) return;

    const nextTier: QualityTierLevel =
      this._currentTier === 'tier3' ? 'tier2' :
      this._currentTier === 'tier2' ? 'tier1' :
      'tier1'; // 이미 최상위

    if (nextTier === this._currentTier) return;
    this._applyTier(nextTier);
  }

  private _applyTier(tier: QualityTierLevel): void {
    this._currentTier = tier;
    this._preset = QUALITY_PRESETS[tier];
    this._lastChangeTime = Date.now();
    this._onChangeCb?.(this._preset);
  }

  // --- 리셋 ---

  reset(): void {
    this._currentTier = 'tier1';
    this._preset = TIER1_FULL;
    this._manualOverride = false;
    this._declineCount = 0;
    this._inclineCount = 0;
    this._lastChangeTime = 0;
  }
}

// ============================================
// localStorage 유틸리티
// ============================================

const STORAGE_KEY = 'matrix-quality-tier';

/**
 * loadSavedQualityTier — localStorage에서 저장된 품질 설정 로드
 */
export function loadSavedQualityTier(): QualityTierLevel | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (saved === 'tier1' || saved === 'tier2' || saved === 'tier3')) {
    return saved as QualityTierLevel;
  }
  return null;
}

/**
 * saveQualityTier — localStorage에 품질 설정 저장
 */
export function saveQualityTier(tier: QualityTierLevel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, tier);
}

// ============================================
// 싱글턴 인스턴스
// ============================================

/** 전역 Quality Ladder 매니저 (싱글턴) */
export const qualityLadder = new QualityLadderManager();

export default QualityLadderManager;
