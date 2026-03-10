/**
 * EconomyManager.ts - v37 Phase 7: 전장 경제 시스템
 *
 * 순수 TypeScript 클래스 (React 의존 없음).
 * Gold/Score 관리, 배율 계산, 이력 추적, 인플레이션 관리.
 *
 * 사용처:
 *  - MatrixApp.tsx에서 인스턴스 생성 → useRef로 보관
 *  - 킬/오브 수집 시 addGold() 호출 → HUD/FieldShop에 상태 전달
 *  - FieldShop 구매 시 spendGold() 호출
 */

// ============================================
// 타입 정의
// ============================================

/** Gold 획득 소스 */
export type GoldSource =
  | 'kill'
  | 'critical_kill'
  | 'combo_kill'
  | 'evolved_kill'
  | 'ultimate_kill'
  | 'orb_collect'
  | 'milestone_bonus'
  | 'evolution_bonus'
  | 'phase_bonus';

/** Gold 이력 항목 */
export interface GoldHistoryEntry {
  amount: number;
  source: GoldSource;
  timestamp: number;
  multiplier: number;
}

/** 배율 수정자 */
export interface EconomyModifiers {
  /** 기본 Gold 배율 (패시브 등) */
  baseMultiplier: number;
  /** 콤보 보너스 배율 */
  comboMultiplier: number;
  /** 매치 페이즈 배율 */
  phaseMultiplier: number;
  /** 상점 아이템 Gold 배율 보너스 */
  shopGoldBonus: number;
  /** 상점 아이템 킬 보상 보너스 */
  shopKillBonus: number;
  /** 상점 아이템 Score 배율 보너스 */
  shopScoreBonus: number;
}

/** Gold 상태 (외부 전달용) */
export interface GoldState {
  current: number;
  totalEarned: number;
  totalSpent: number;
  perMinute: number;
}

/** Score 상태 */
export interface ScoreState {
  current: number;
  total: number;
  perMinute: number;
}

/** 상점 구매 이력 */
export interface PurchaseRecord {
  itemId: string;
  count: number;
  lastPrice: number;
}

/** EconomyManager 스냅샷 (React 상태 전달용) */
export interface EconomySnapshot {
  gold: GoldState;
  score: ScoreState;
  modifiers: EconomyModifiers;
  purchases: Record<string, PurchaseRecord>;
}

// ============================================
// 상수
// ============================================

/** 킬 유형별 기본 Gold 보상 */
const BASE_KILL_GOLD: Record<string, number> = {
  kill: 25,
  critical_kill: 38,
  combo_kill: 25,
  evolved_kill: 30,
  ultimate_kill: 50,
  orb_collect: 5,
  milestone_bonus: 0,
  evolution_bonus: 500,
  phase_bonus: 0,
};

/** 킬 유형별 기본 배율 */
const KILL_TYPE_MULTIPLIER: Record<string, number> = {
  kill: 1.0,
  critical_kill: 1.5,
  combo_kill: 1.0,  // 콤보 배율은 comboMultiplier로 별도 적용
  evolved_kill: 1.25,
  ultimate_kill: 2.0,
  orb_collect: 1.0,
  milestone_bonus: 1.0,
  evolution_bonus: 1.0,
  phase_bonus: 1.0,
};

/** 매치 페이즈별 Gold 배율 */
const PHASE_GOLD_MULTIPLIER: Record<string, number> = {
  skirmish: 1.0,     // 0:00 ~ 1:30
  engagement: 1.5,   // 1:30 ~ 3:30
  showdown: 2.5,     // 3:30 ~ 5:00
};

/** Gold/분 계산 윈도우 (초) */
const GPM_WINDOW = 30;

/** 인플레이션 계수: 구매 횟수당 가격 증가율 */
const PURCHASE_INFLATION_RATE = 0.20;

// ============================================
// EconomyManager 클래스
// ============================================

export class EconomyManager {
  // ─── Gold 상태 ───
  private _gold = 0;
  private _totalEarned = 0;
  private _totalSpent = 0;
  private _goldHistory: GoldHistoryEntry[] = [];

  // ─── Score 상태 ───
  private _score = 0;
  private _totalScore = 0;

  // ─── 배율 ───
  private _modifiers: EconomyModifiers = {
    baseMultiplier: 1.0,
    comboMultiplier: 1.0,
    phaseMultiplier: 1.0,
    shopGoldBonus: 0,
    shopKillBonus: 0,
    shopScoreBonus: 0,
  };

  // ─── 매치 페이즈 ───
  private _currentPhase: string = 'skirmish';

  // ─── 상점 구매 이력 ───
  private _purchases: Record<string, PurchaseRecord> = {};

  // ─── 타이밍 ───
  private _startTime = 0;
  private _gameTime = 0;

  // ============================================
  // 초기화 / 리셋
  // ============================================

  constructor() {
    this._startTime = Date.now();
  }

  reset(): void {
    this._gold = 0;
    this._totalEarned = 0;
    this._totalSpent = 0;
    this._goldHistory = [];
    this._score = 0;
    this._totalScore = 0;
    this._modifiers = {
      baseMultiplier: 1.0,
      comboMultiplier: 1.0,
      phaseMultiplier: 1.0,
      shopGoldBonus: 0,
      shopKillBonus: 0,
      shopScoreBonus: 0,
    };
    this._currentPhase = 'skirmish';
    this._purchases = {};
    this._startTime = Date.now();
    this._gameTime = 0;
  }

  // ============================================
  // Gold 관리
  // ============================================

  /**
   * Gold 획득 (배율 자동 적용)
   * @returns 실제 획득량 (배율 적용 후)
   */
  addGold(amount: number, source: GoldSource, comboCount: number = 0): number {
    // 배율 계산
    const killTypeMultiplier = KILL_TYPE_MULTIPLIER[source] ?? 1.0;
    const comboMult = source === 'combo_kill' && comboCount > 0
      ? 1 + comboCount / 10
      : this._modifiers.comboMultiplier;
    const phaseMult = PHASE_GOLD_MULTIPLIER[this._currentPhase] ?? 1.0;
    const shopBonus = 1 + this._modifiers.shopGoldBonus;
    const killBonus = (source === 'kill' || source === 'critical_kill' || source === 'combo_kill' || source === 'evolved_kill' || source === 'ultimate_kill')
      ? 1 + this._modifiers.shopKillBonus
      : 1;

    const totalMultiplier =
      this._modifiers.baseMultiplier *
      killTypeMultiplier *
      comboMult *
      phaseMult *
      shopBonus *
      killBonus;

    const finalAmount = Math.round(amount * totalMultiplier);

    this._gold += finalAmount;
    this._totalEarned += finalAmount;

    // 이력 기록
    this._goldHistory.push({
      amount: finalAmount,
      source,
      timestamp: Date.now(),
      multiplier: totalMultiplier,
    });

    // 이력 상한 (메모리 관리, 최근 300건만 유지)
    if (this._goldHistory.length > 300) {
      this._goldHistory = this._goldHistory.slice(-200);
    }

    return finalAmount;
  }

  /**
   * 기본 Gold 획득 (킬 소스에 따른 기본 보상 자동 결정)
   */
  addKillGold(source: GoldSource, comboCount: number = 0): number {
    const baseAmount = BASE_KILL_GOLD[source] ?? 25;
    return this.addGold(baseAmount, source, comboCount);
  }

  /**
   * Gold 소비 (상점 구매 등)
   * @returns 성공 여부
   */
  spendGold(amount: number): boolean {
    if (this._gold < amount) return false;
    this._gold -= amount;
    this._totalSpent += amount;
    return true;
  }

  /**
   * Gold/분 계산 (GPM_WINDOW 초 이동평균)
   */
  getGoldPerMinute(): number {
    const now = Date.now();
    const windowStart = now - GPM_WINDOW * 1000;

    let windowGold = 0;
    for (let i = this._goldHistory.length - 1; i >= 0; i--) {
      const entry = this._goldHistory[i];
      if (entry.timestamp < windowStart) break;
      windowGold += entry.amount;
    }

    // 30초 윈도우 → 분당으로 변환
    return Math.round(windowGold * (60 / GPM_WINDOW));
  }

  // ============================================
  // Score 관리
  // ============================================

  addScore(amount: number): number {
    const scoreBonus = 1 + this._modifiers.shopScoreBonus;
    const finalAmount = Math.round(amount * scoreBonus);
    this._score += finalAmount;
    this._totalScore += finalAmount;
    return finalAmount;
  }

  getScorePerMinute(): number {
    const elapsed = this._gameTime;
    if (elapsed <= 0) return 0;
    return Math.round((this._totalScore / elapsed) * 60);
  }

  // ============================================
  // 배율 관리
  // ============================================

  setBaseMultiplier(value: number): void {
    this._modifiers.baseMultiplier = value;
  }

  setComboMultiplier(value: number): void {
    this._modifiers.comboMultiplier = value;
  }

  /**
   * 매치 페이즈 업데이트 (gameTime 기반)
   */
  updatePhase(gameTime: number): void {
    this._gameTime = gameTime;
    if (gameTime < 90) {
      this._currentPhase = 'skirmish';
      this._modifiers.phaseMultiplier = PHASE_GOLD_MULTIPLIER.skirmish;
    } else if (gameTime < 210) {
      this._currentPhase = 'engagement';
      this._modifiers.phaseMultiplier = PHASE_GOLD_MULTIPLIER.engagement;
    } else {
      this._currentPhase = 'showdown';
      this._modifiers.phaseMultiplier = PHASE_GOLD_MULTIPLIER.showdown;
    }
  }

  /**
   * 상점 아이템 배율 보너스 추가
   */
  addShopGoldBonus(percent: number): void {
    this._modifiers.shopGoldBonus += percent;
  }

  addShopKillBonus(percent: number): void {
    this._modifiers.shopKillBonus += percent;
  }

  addShopScoreBonus(percent: number): void {
    this._modifiers.shopScoreBonus += percent;
  }

  // ============================================
  // 상점 구매 이력 + 인플레이션
  // ============================================

  /**
   * 아이템 구매 기록 + 인플레이션 가격 계산
   */
  recordPurchase(itemId: string, basePrice: number): void {
    const record = this._purchases[itemId] ?? { itemId, count: 0, lastPrice: basePrice };
    record.count += 1;
    record.lastPrice = this.getInflatedPrice(itemId, basePrice);
    this._purchases[itemId] = record;
  }

  /**
   * 인플레이션 적용 가격 (구매 횟수에 따라 +20%)
   */
  getInflatedPrice(itemId: string, basePrice: number): number {
    const record = this._purchases[itemId];
    if (!record) return basePrice;
    return Math.round(basePrice * Math.pow(1 + PURCHASE_INFLATION_RATE, record.count));
  }

  /**
   * 아이템 구매 횟수 조회
   */
  getPurchaseCount(itemId: string): number {
    return this._purchases[itemId]?.count ?? 0;
  }

  // ============================================
  // 보상 예측
  // ============================================

  /**
   * 예상 RP 전환 (Gold → RP, 1000:1 비율)
   */
  getEstimatedRP(): number {
    return Math.floor(this._gold / 1000 * 100) / 100;
  }

  /**
   * 남은 시간 기반 예상 최종 Gold
   * @param remainingSeconds 남은 매치 시간 (초)
   */
  getEstimatedFinalGold(remainingSeconds: number): number {
    const gpm = this.getGoldPerMinute();
    const remainingMinutes = remainingSeconds / 60;
    return Math.round(this._gold + gpm * remainingMinutes);
  }

  // ============================================
  // 스냅샷 (React 상태 전달용)
  // ============================================

  getSnapshot(): EconomySnapshot {
    return {
      gold: {
        current: this._gold,
        totalEarned: this._totalEarned,
        totalSpent: this._totalSpent,
        perMinute: this.getGoldPerMinute(),
      },
      score: {
        current: this._score,
        total: this._totalScore,
        perMinute: this.getScorePerMinute(),
      },
      modifiers: { ...this._modifiers },
      purchases: { ...this._purchases },
    };
  }

  // ============================================
  // Getters
  // ============================================

  get gold(): number { return this._gold; }
  get totalEarned(): number { return this._totalEarned; }
  get totalSpent(): number { return this._totalSpent; }
  get score(): number { return this._score; }
  get currentPhase(): string { return this._currentPhase; }
  get modifiers(): Readonly<EconomyModifiers> { return this._modifiers; }
  get purchases(): Readonly<Record<string, PurchaseRecord>> { return this._purchases; }
}
