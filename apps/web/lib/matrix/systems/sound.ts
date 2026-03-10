/**
 * SoundManager.ts - v37 Phase 9: 사운드 이펙트 시스템
 *
 * Web Audio API 기반 싱글톤 사운드 매니저.
 * 오디오 풀링으로 동시 재생 시 겹침 방지.
 * 마스터 볼륨 + 카테고리별 볼륨 제어.
 *
 * NOTE: 실제 오디오 파일은 아직 없으므로,
 * SoundManager API만 구현하고 실제 재생은 placeholder 처리.
 * 나중에 오디오 파일 추가 시 바로 작동하도록 인터페이스 설계.
 *
 * 사용법:
 *   import { SoundManager } from './sound';
 *   const sm = SoundManager.getInstance();
 *   sm.play('weapon_fire', 'whip');
 *   sm.setMasterVolume(0.8);
 *   sm.setCategoryVolume('weapon_fire', 0.6);
 */

// ============================================
// 타입 정의
// ============================================

/** 사운드 카테고리 */
export type SoundCategory =
  | 'weapon_fire'    // 무기 발사
  | 'hit'            // 적 피격
  | 'kill'           // 적 처치
  | 'levelup'        // 레벨업
  | 'gold_collect'   // Gold 수집
  | 'shop_purchase'  // 상점 구매
  | 'combo_tier'     // 콤보 티어 달성
  | 'evolution'      // 진화 (Tier 3)
  | 'ultimate'       // 궁극 (Tier 4)
  | 'ui';            // UI 사운드 (버튼 클릭 등)

/** 사운드 에셋 정의 */
export interface SoundAsset {
  /** 에셋 ID (카테고리 + 변형 조합) */
  id: string;
  /** 카테고리 */
  category: SoundCategory;
  /** 오디오 파일 경로 (추후 설정) */
  src: string;
  /** 기본 볼륨 (0~1) */
  baseVolume: number;
  /** 동시 재생 최대 수 (풀 크기) */
  maxConcurrent: number;
  /** 재생 속도 범위 [min, max] (랜덤 변형) */
  playbackRateRange: [number, number];
}

/** 사운드 매니저 설정 */
export interface SoundManagerConfig {
  /** 마스터 볼륨 (0~1) */
  masterVolume: number;
  /** 카테고리별 볼륨 (0~1) */
  categoryVolumes: Record<SoundCategory, number>;
  /** 사운드 활성화 여부 */
  enabled: boolean;
}

// ============================================
// 기본 사운드 에셋 레지스트리 (placeholder)
// ============================================

/**
 * 사운드 에셋 레지스트리.
 * src 필드에 실제 경로를 넣으면 바로 작동합니다.
 * 현재는 빈 문자열 (placeholder).
 */
const DEFAULT_SOUND_ASSETS: SoundAsset[] = [
  // ─── 무기 발사 ───
  { id: 'weapon_fire_melee',     category: 'weapon_fire', src: '', baseVolume: 0.4, maxConcurrent: 3, playbackRateRange: [0.9, 1.1] },
  { id: 'weapon_fire_ranged',    category: 'weapon_fire', src: '', baseVolume: 0.5, maxConcurrent: 4, playbackRateRange: [0.95, 1.05] },
  { id: 'weapon_fire_beam',      category: 'weapon_fire', src: '', baseVolume: 0.5, maxConcurrent: 2, playbackRateRange: [1.0, 1.0] },
  { id: 'weapon_fire_explosion', category: 'weapon_fire', src: '', baseVolume: 0.6, maxConcurrent: 3, playbackRateRange: [0.9, 1.1] },
  { id: 'weapon_fire_shield',    category: 'weapon_fire', src: '', baseVolume: 0.3, maxConcurrent: 2, playbackRateRange: [0.95, 1.05] },

  // ─── 피격 ───
  { id: 'hit_normal',            category: 'hit',         src: '', baseVolume: 0.3, maxConcurrent: 5, playbackRateRange: [0.8, 1.2] },
  { id: 'hit_critical',          category: 'hit',         src: '', baseVolume: 0.5, maxConcurrent: 3, playbackRateRange: [0.9, 1.1] },

  // ─── 처치 ───
  { id: 'kill_normal',           category: 'kill',        src: '', baseVolume: 0.4, maxConcurrent: 4, playbackRateRange: [0.9, 1.1] },
  { id: 'kill_combo',            category: 'kill',        src: '', baseVolume: 0.5, maxConcurrent: 3, playbackRateRange: [0.95, 1.05] },
  { id: 'kill_ultimate',         category: 'kill',        src: '', baseVolume: 0.7, maxConcurrent: 2, playbackRateRange: [1.0, 1.0] },

  // ─── 레벨업 ───
  { id: 'levelup',               category: 'levelup',     src: '', baseVolume: 0.6, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },

  // ─── Gold 수집 ───
  { id: 'gold_collect',          category: 'gold_collect', src: '', baseVolume: 0.3, maxConcurrent: 6, playbackRateRange: [0.8, 1.3] },

  // ─── 상점 구매 ───
  { id: 'shop_purchase',         category: 'shop_purchase', src: '', baseVolume: 0.5, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },
  { id: 'shop_denied',           category: 'shop_purchase', src: '', baseVolume: 0.3, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },

  // ─── 콤보 티어 ───
  { id: 'combo_tier_5',          category: 'combo_tier',  src: '', baseVolume: 0.4, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },
  { id: 'combo_tier_10',         category: 'combo_tier',  src: '', baseVolume: 0.5, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },
  { id: 'combo_tier_20',         category: 'combo_tier',  src: '', baseVolume: 0.6, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },

  // ─── 진화 ───
  { id: 'evolution_charge',      category: 'evolution',   src: '', baseVolume: 0.6, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },
  { id: 'evolution_burst',       category: 'evolution',   src: '', baseVolume: 0.7, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },

  // ─── 궁극 ───
  { id: 'ultimate_flash',        category: 'ultimate',    src: '', baseVolume: 0.8, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },
  { id: 'ultimate_title',        category: 'ultimate',    src: '', baseVolume: 0.7, maxConcurrent: 1, playbackRateRange: [1.0, 1.0] },

  // ─── UI ───
  { id: 'ui_click',              category: 'ui',          src: '', baseVolume: 0.3, maxConcurrent: 2, playbackRateRange: [1.0, 1.0] },
  { id: 'ui_hover',              category: 'ui',          src: '', baseVolume: 0.15, maxConcurrent: 2, playbackRateRange: [1.0, 1.0] },
];

// ============================================
// 무기 타입 → 사운드 ID 매핑
// ============================================

/** 무기 타입을 사운드 에셋 ID에 매핑 (fireWeapon 시 자동 사운드 선택) */
const WEAPON_SOUND_MAP: Record<string, string> = {
  // STEEL (근접)
  whip: 'weapon_fire_melee',
  punch: 'weapon_fire_melee',
  knife: 'weapon_fire_ranged',
  // TERRITORY (원거리)
  wand: 'weapon_fire_ranged',
  bow: 'weapon_fire_ranged',
  axe: 'weapon_fire_ranged',
  shard: 'weapon_fire_ranged',
  // ALLIANCE (체인/광역)
  lightning: 'weapon_fire_beam',
  ping: 'weapon_fire_ranged',
  bridge: 'weapon_fire_explosion',
  fork: 'weapon_fire_ranged',
  // SOVEREIGNTY (방어)
  garlic: 'weapon_fire_shield',
  bible: 'weapon_fire_shield',
  pool: 'weapon_fire_explosion',
  stablecoin: 'weapon_fire_shield',
  // MORALE (특수)
  beam: 'weapon_fire_beam',
  laser: 'weapon_fire_beam',
  airdrop: 'weapon_fire_explosion',
  phishing: 'weapon_fire_explosion',
  genesis: 'weapon_fire_explosion',
};

// ============================================
// 기본 카테고리 볼륨
// ============================================

const DEFAULT_CATEGORY_VOLUMES: Record<SoundCategory, number> = {
  weapon_fire: 0.7,
  hit: 0.6,
  kill: 0.7,
  levelup: 0.8,
  gold_collect: 0.5,
  shop_purchase: 0.7,
  combo_tier: 0.8,
  evolution: 0.9,
  ultimate: 1.0,
  ui: 0.5,
};

// ============================================
// SoundManager 싱글톤 클래스
// ============================================

export class SoundManager {
  private static _instance: SoundManager | null = null;

  // ─── Web Audio API ───
  private _context: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _categoryGains: Map<SoundCategory, GainNode> = new Map();

  // ─── 에셋 ───
  private _assets: Map<string, SoundAsset> = new Map();
  private _buffers: Map<string, AudioBuffer> = new Map();
  // _pools 삭제됨 (사용되지 않던 dead code)

  // ─── 설정 ───
  private _config: SoundManagerConfig = {
    masterVolume: 0.7,
    categoryVolumes: { ...DEFAULT_CATEGORY_VOLUMES },
    enabled: true,
  };

  // ─── 쿨다운 (같은 소리 연속 재생 방지) ───
  private _lastPlayTimes: Map<string, number> = new Map();
  private static readonly MIN_REPLAY_INTERVAL = 50; // ms

  // ============================================
  // 싱글톤
  // ============================================

  static getInstance(): SoundManager {
    if (!SoundManager._instance) {
      SoundManager._instance = new SoundManager();
    }
    return SoundManager._instance;
  }

  private constructor() {
    // 에셋 레지스트리 초기화
    for (const asset of DEFAULT_SOUND_ASSETS) {
      this._assets.set(asset.id, asset);
    }
  }

  // ============================================
  // 초기화 (사용자 인터랙션 후 호출 필수)
  // ============================================

  /**
   * AudioContext 초기화.
   * 브라우저 정책상 사용자 인터랙션(클릭/탭) 후 호출해야 합니다.
   */
  init(): void {
    if (this._context) return;

    try {
      this._context = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 마스터 게인 노드
      this._masterGain = this._context.createGain();
      this._masterGain.gain.value = this._config.masterVolume;
      this._masterGain.connect(this._context.destination);

      // 카테고리별 게인 노드
      const categories: SoundCategory[] = [
        'weapon_fire', 'hit', 'kill', 'levelup', 'gold_collect',
        'shop_purchase', 'combo_tier', 'evolution', 'ultimate', 'ui',
      ];

      for (const cat of categories) {
        const gain = this._context.createGain();
        gain.gain.value = this._config.categoryVolumes[cat];
        gain.connect(this._masterGain);
        this._categoryGains.set(cat, gain);
      }

    } catch {
      // Web Audio API 미지원 환경 — 조용히 실패
      this._context = null;
    }
  }

  /**
   * AudioContext가 suspended 상태이면 resume.
   * 사용자 인터랙션 핸들러에서 호출.
   */
  async resume(): Promise<void> {
    if (this._context?.state === 'suspended') {
      await this._context.resume();
    }
  }

  // ============================================
  // 에셋 관리
  // ============================================

  /**
   * 오디오 에셋 등록 (커스텀 사운드 추가용)
   */
  registerAsset(asset: SoundAsset): void {
    this._assets.set(asset.id, asset);
  }

  /**
   * 오디오 파일 로드 (비동기)
   * @param assetId 에셋 ID
   * @param url 오디오 파일 URL (asset.src를 오버라이드)
   */
  async loadSound(assetId: string, url?: string): Promise<void> {
    const asset = this._assets.get(assetId);
    if (!asset) return;

    const src = url || asset.src;
    if (!src) return; // placeholder — src 없으면 스킵

    if (!this._context) this.init();
    if (!this._context) return;

    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this._context.decodeAudioData(arrayBuffer);
      this._buffers.set(assetId, audioBuffer);
    } catch {
      // 로드 실패 — 조용히 스킵
    }
  }

  /**
   * 모든 등록된 에셋 중 src가 있는 것만 프리로드
   */
  async preloadAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [id, asset] of this._assets) {
      if (asset.src) {
        promises.push(this.loadSound(id));
      }
    }
    await Promise.allSettled(promises);
  }

  // ============================================
  // 재생
  // ============================================

  /**
   * 사운드 재생
   * @param category 사운드 카테고리
   * @param variant 변형 키 (무기 타입 등). 없으면 카테고리 기본 사운드.
   * @param options 추가 옵션
   */
  play(
    category: SoundCategory,
    variant?: string,
    options?: {
      volume?: number;      // 0~1, 추가 볼륨 조절
      playbackRate?: number; // 재생 속도 오버라이드
      detune?: number;       // 피치 조절 (센트 단위)
    },
  ): void {
    if (!this._config.enabled) return;

    // 에셋 ID 결정
    let assetId: string;
    if (variant && category === 'weapon_fire') {
      assetId = WEAPON_SOUND_MAP[variant] || `${category}_${variant}`;
    } else if (variant) {
      assetId = `${category}_${variant}`;
    } else {
      assetId = category;
    }

    // 에셋 조회
    const asset = this._assets.get(assetId);
    if (!asset) return;

    // 동일 사운드 연속 재생 쿨다운
    const now = performance.now();
    const lastPlay = this._lastPlayTimes.get(assetId) || 0;
    if (now - lastPlay < SoundManager.MIN_REPLAY_INTERVAL) return;
    this._lastPlayTimes.set(assetId, now);

    // AudioBuffer 없으면 (아직 미로드 / placeholder) 스킵
    const buffer = this._buffers.get(assetId);
    if (!buffer || !this._context || !this._masterGain) return;

    // 카테고리 게인 노드
    const categoryGain = this._categoryGains.get(asset.category);
    if (!categoryGain) return;

    try {
      // 소스 노드 생성 (매번 새로 — Web Audio 정책)
      const source = this._context.createBufferSource();
      source.buffer = buffer;

      // 재생 속도 (랜덤 범위 or 오버라이드)
      if (options?.playbackRate) {
        source.playbackRate.value = options.playbackRate;
      } else {
        const [min, max] = asset.playbackRateRange;
        source.playbackRate.value = min + Math.random() * (max - min);
      }

      // 디튠
      if (options?.detune) {
        source.detune.value = options.detune;
      }

      // 인스턴스 게인 (에셋 기본 볼륨 × 옵션 볼륨)
      const instanceGain = this._context.createGain();
      instanceGain.gain.value = asset.baseVolume * (options?.volume ?? 1.0);

      // 연결: source → instanceGain → categoryGain → masterGain → destination
      source.connect(instanceGain);
      instanceGain.connect(categoryGain);

      source.start(0);

      // 재생 완료 시 자동 정리
      source.onended = () => {
        try {
          source.disconnect();
          instanceGain.disconnect();
        } catch {
          // 이미 해제된 경우 무시
        }
      };
    } catch {
      // 재생 실패 — 조용히 스킵
    }
  }

  /**
   * 무기 발사 사운드 편의 메서드
   * @param weaponType 무기 타입 키 (whip, wand, beam 등)
   */
  playWeaponFire(weaponType: string): void {
    this.play('weapon_fire', weaponType);
  }

  /**
   * 킬 사운드 편의 메서드
   * @param killType normal / combo / ultimate
   */
  playKill(killType: 'normal' | 'combo' | 'ultimate' = 'normal'): void {
    this.play('kill', killType);
  }

  /**
   * 히트 사운드 편의 메서드
   * @param isCritical 크리티컬 여부
   */
  playHit(isCritical: boolean = false): void {
    this.play('hit', isCritical ? 'critical' : 'normal');
  }

  /**
   * 콤보 티어 사운드
   * @param comboCount 콤보 카운트
   */
  playComboTier(comboCount: number): void {
    if (comboCount >= 20) {
      this.play('combo_tier', '20');
    } else if (comboCount >= 10) {
      this.play('combo_tier', '10');
    } else if (comboCount >= 5) {
      this.play('combo_tier', '5');
    }
  }

  /**
   * 진화 사운드 (2단계: charge → burst)
   * @param phase 'charge' | 'burst'
   */
  playEvolution(phase: 'charge' | 'burst' = 'burst'): void {
    this.play('evolution', phase);
  }

  /**
   * 궁극 사운드
   * @param phase 'flash' | 'title'
   */
  playUltimate(phase: 'flash' | 'title' = 'flash'): void {
    this.play('ultimate', phase);
  }

  // ============================================
  // 볼륨 제어
  // ============================================

  /**
   * 마스터 볼륨 설정 (0~1)
   */
  setMasterVolume(volume: number): void {
    this._config.masterVolume = Math.max(0, Math.min(1, volume));
    if (this._masterGain) {
      this._masterGain.gain.value = this._config.masterVolume;
    }
  }

  /**
   * 카테고리별 볼륨 설정 (0~1)
   */
  setCategoryVolume(category: SoundCategory, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._config.categoryVolumes[category] = clamped;
    const gain = this._categoryGains.get(category);
    if (gain) {
      gain.gain.value = clamped;
    }
  }

  /**
   * 사운드 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this._config.enabled = enabled;
    if (!enabled && this._masterGain) {
      this._masterGain.gain.value = 0;
    } else if (enabled && this._masterGain) {
      this._masterGain.gain.value = this._config.masterVolume;
    }
  }

  /**
   * 모든 사운드 음소거 토글
   */
  toggleMute(): boolean {
    this._config.enabled = !this._config.enabled;
    this.setEnabled(this._config.enabled);
    return this._config.enabled;
  }

  // ============================================
  // Getters
  // ============================================

  get masterVolume(): number { return this._config.masterVolume; }
  get enabled(): boolean { return this._config.enabled; }
  get isInitialized(): boolean { return this._context !== null; }

  getCategoryVolume(category: SoundCategory): number {
    return this._config.categoryVolumes[category];
  }

  getConfig(): Readonly<SoundManagerConfig> {
    return { ...this._config, categoryVolumes: { ...this._config.categoryVolumes } };
  }

  // ============================================
  // 정리
  // ============================================

  /**
   * 리소스 해제 (매치 종료 / 페이지 언마운트 시)
   */
  dispose(): void {
    if (this._context) {
      this._context.close().catch(() => {});
      this._context = null;
    }
    this._masterGain = null;
    this._categoryGains.clear();
    this._buffers.clear();
    // _pools 삭제됨
    this._lastPlayTimes.clear();
  }

  /**
   * 싱글톤 인스턴스 해제 (테스트용)
   */
  static resetInstance(): void {
    if (SoundManager._instance) {
      SoundManager._instance.dispose();
      SoundManager._instance = null;
    }
  }
}
