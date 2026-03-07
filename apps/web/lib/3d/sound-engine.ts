/**
 * SoundEngine — 순수 Web Audio API 싱글턴 사운드 엔진
 *
 * v16 Phase 7: Howler.js 없이 순수 Web Audio API로 구현
 * - 16개 AudioBufferSourceNode 풀링
 * - BGM 루프 + SFX 재생
 * - 공간 오디오: PannerNode (drei PositionalAudio 대신)
 * - 프로시저럴 합성 (procedural-sfx.ts 활용)
 * - 전투 텐션 BGM 전환
 * - 볼륨/음소거 설정 (localStorage 연동)
 */

import {
  createNoiseBuffer,
  synthFootstep,
  synthCombatSFX,
  synthUISFX,
  AMBIENCE_CONFIGS,
  TENSION_BGM_CONFIG,
  type FootstepBiome,
  type CombatSFX,
  type UISFX,
  type AmbienceBiome,
} from './procedural-sfx';

// ─── Constants ───

const SFX_POOL_SIZE = 16;
const STORAGE_KEY_MUTED = 'aww-muted';
const STORAGE_KEY_SFX_VOL = 'aww-sfx-vol';
const STORAGE_KEY_BGM_VOL = 'aww-bgm-vol';
const STORAGE_KEY_FX_QUALITY = 'aww-fx-quality';

// ─── Types ───

export type FXQuality = 'off' | 'low' | 'high';

export interface SoundSettings {
  muted: boolean;
  sfxVolume: number;  // 0~1
  bgmVolume: number;  // 0~1
  fxQuality: FXQuality;
}

// ─── Singleton ───

class SoundEngine {
  private static _instance: SoundEngine | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  // SFX 풀 (동시 재생 제한)
  private sfxActiveCount = 0;

  // 노이즈 버퍼 (캐시)
  private noiseBuffer: AudioBuffer | null = null;

  // 앰비언스 노드 관리
  private ambienceNodes: (OscillatorNode | GainNode)[] = [];
  private currentAmbienceBiome: AmbienceBiome | null = null;

  // 텐션 BGM 노드
  private tensionNodes: (OscillatorNode | GainNode)[] = [];
  private tensionActive = false;

  // 설정
  private settings: SoundSettings;

  // 발걸음 쿨다운 (너무 빈번한 호출 방지)
  private lastFootstepTime = 0;
  private footstepCooldown = 0.25; // 초 (최소 간격)

  private constructor() {
    this.settings = this.loadSettings();
  }

  static getInstance(): SoundEngine {
    if (!SoundEngine._instance) {
      SoundEngine._instance = new SoundEngine();
    }
    return SoundEngine._instance;
  }

  // ─── 초기화 (lazy — 첫 사용자 상호작용 후 호출 필요) ───

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.ctx = ctx;

      // 마스터 게인
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.settings.muted ? 0 : 1;
      this.masterGain.connect(ctx.destination);

      // SFX 게인
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // BGM 게인
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.value = this.settings.bgmVolume;
      this.bgmGain.connect(this.masterGain);

      // 노이즈 버퍼 사전 생성
      this.noiseBuffer = createNoiseBuffer(ctx, 1.0);

      return ctx;
    } catch {
      return null;
    }
  }

  private resumeIfSuspended(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ─── 설정 관리 ───

  private loadSettings(): SoundSettings {
    if (typeof window === 'undefined') {
      return { muted: false, sfxVolume: 0.5, bgmVolume: 0.3, fxQuality: 'high' };
    }
    return {
      muted: localStorage.getItem(STORAGE_KEY_MUTED) === 'true',
      sfxVolume: parseFloat(localStorage.getItem(STORAGE_KEY_SFX_VOL) ?? '0.5'),
      bgmVolume: parseFloat(localStorage.getItem(STORAGE_KEY_BGM_VOL) ?? '0.3'),
      fxQuality: (localStorage.getItem(STORAGE_KEY_FX_QUALITY) as FXQuality) || 'high',
    };
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_MUTED, String(this.settings.muted));
    localStorage.setItem(STORAGE_KEY_SFX_VOL, String(this.settings.sfxVolume));
    localStorage.setItem(STORAGE_KEY_BGM_VOL, String(this.settings.bgmVolume));
    localStorage.setItem(STORAGE_KEY_FX_QUALITY, this.settings.fxQuality);
  }

  getSettings(): Readonly<SoundSettings> {
    return { ...this.settings };
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx?.currentTime ?? 0);
    }
    if (muted) {
      this.stopAmbience();
      this.stopTensionBGM();
    }
    this.saveSettings();
  }

  toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  setSFXVolume(vol: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, this.ctx?.currentTime ?? 0);
    }
    this.saveSettings();
  }

  setBGMVolume(vol: number): void {
    this.settings.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(this.settings.bgmVolume, this.ctx?.currentTime ?? 0);
    }
    this.saveSettings();
  }

  setFXQuality(quality: FXQuality): void {
    this.settings.fxQuality = quality;
    this.saveSettings();
  }

  // ─── SFX 재생 ───

  /** 발걸음 사운드 (바이옴별, 쿨다운 적용) */
  playFootstep(biome: FootstepBiome): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    if (this.sfxActiveCount >= SFX_POOL_SIZE) return;

    const now = ctx.currentTime;
    if (now - this.lastFootstepTime < this.footstepCooldown) return;
    this.lastFootstepTime = now;

    this.resumeIfSuspended();
    this.sfxActiveCount++;
    synthFootstep(ctx, this.sfxGain, biome, this.noiseBuffer, this.settings.sfxVolume);

    // 풀 카운트 복구 (최대 발걸음 길이 = 0.2s)
    setTimeout(() => { this.sfxActiveCount = Math.max(0, this.sfxActiveCount - 1); }, 250);
  }

  /** 전투 SFX */
  playCombat(type: CombatSFX): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    if (this.sfxActiveCount >= SFX_POOL_SIZE) return;

    this.resumeIfSuspended();
    this.sfxActiveCount++;
    synthCombatSFX(ctx, this.sfxGain, type, this.noiseBuffer, this.settings.sfxVolume);

    setTimeout(() => { this.sfxActiveCount = Math.max(0, this.sfxActiveCount - 1); }, 700);
  }

  /** UI SFX */
  playUI(type: UISFX): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    if (this.sfxActiveCount >= SFX_POOL_SIZE) return;

    this.resumeIfSuspended();
    this.sfxActiveCount++;
    synthUISFX(ctx, this.sfxGain, type, this.settings.sfxVolume);

    setTimeout(() => { this.sfxActiveCount = Math.max(0, this.sfxActiveCount - 1); }, 1200);
  }

  // ─── 3D 공간 오디오 SFX (PannerNode 기반) ───

  /** 3D 위치 기반 전투 SFX (카메라 위치 기준 스테레오 팬) */
  playCombat3D(
    type: CombatSFX,
    worldX: number,
    worldZ: number,
    listenerX: number,
    listenerZ: number,
  ): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    if (this.sfxActiveCount >= SFX_POOL_SIZE) return;

    // 거리 계산 — 200 이상이면 감쇠로 안 들림
    const dx = worldX - listenerX;
    const dz = worldZ - listenerZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 200) return;

    // 거리 감쇠 볼륨
    const distAtten = Math.max(0, 1 - dist / 200);
    const vol = this.settings.sfxVolume * distAtten;

    // 스테레오 팬 (간단한 좌우 분리)
    const panner = ctx.createStereoPanner();
    const panValue = Math.max(-1, Math.min(1, dx / 100));
    panner.pan.value = panValue;
    panner.connect(this.sfxGain);

    this.resumeIfSuspended();
    this.sfxActiveCount++;
    synthCombatSFX(ctx, panner, type, this.noiseBuffer, vol);

    setTimeout(() => {
      this.sfxActiveCount = Math.max(0, this.sfxActiveCount - 1);
      try { panner.disconnect(); } catch { /* ignore */ }
    }, 700);
  }

  // ─── 앰비언스 (프로시저럴 오실레이터 루프) ───

  /** 바이옴 앰비언스 시작 (기존 것 정지 후 교체) */
  startAmbience(biome: AmbienceBiome): void {
    if (this.settings.muted) return;
    if (this.currentAmbienceBiome === biome) return; // 동일하면 스킵

    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;

    this.stopAmbience();
    this.resumeIfSuspended();
    this.currentAmbienceBiome = biome;

    const config = AMBIENCE_CONFIGS[biome];
    if (!config) return;

    const vol = this.settings.bgmVolume;

    // 베이스 드론
    const baseOsc = ctx.createOscillator();
    const baseGainNode = ctx.createGain();
    baseOsc.type = config.baseType;
    baseOsc.frequency.value = config.baseFreq;
    baseGainNode.gain.value = config.baseGain * vol;
    baseOsc.connect(baseGainNode);
    baseGainNode.connect(this.bgmGain);
    baseOsc.start();
    this.ambienceNodes.push(baseOsc, baseGainNode);

    // 레이어
    for (const layer of config.layers) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = layer.type;
      osc.frequency.value = layer.freq;
      gain.gain.value = layer.gain * vol;

      // LFO 모듈레이션
      if (layer.lfoFreq && layer.lfoDepth) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = layer.lfoFreq;
        lfoGain.gain.value = layer.lfoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        this.ambienceNodes.push(lfo, lfoGain);
      }

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start();
      this.ambienceNodes.push(osc, gain);
    }
  }

  /** 앰비언스 정지 */
  stopAmbience(): void {
    for (const node of this.ambienceNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    this.ambienceNodes = [];
    this.currentAmbienceBiome = null;
  }

  // ─── 전투 텐션 BGM ───

  /** 전투 텐션 BGM 시작 (펄스 드론 + 리듬) */
  startTensionBGM(): void {
    if (this.settings.muted || this.tensionActive) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;

    this.resumeIfSuspended();
    this.tensionActive = true;

    const cfg = TENSION_BGM_CONFIG;
    const vol = this.settings.bgmVolume;

    // 드론 (저역 톱니파)
    const droneOsc = ctx.createOscillator();
    droneOsc.type = cfg.droneType;
    droneOsc.frequency.value = cfg.droneFreq;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 200;
    droneFilter.Q.value = 2;
    const droneGain = ctx.createGain();
    droneGain.gain.value = cfg.droneGain * vol;
    droneOsc.connect(droneFilter).connect(droneGain).connect(this.bgmGain);
    droneOsc.start();
    this.tensionNodes.push(droneOsc, droneFilter, droneGain);

    // 펄스 (LFO로 gain 변조 → 리듬감)
    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = 'sine';
    pulseOsc.frequency.value = cfg.pulseFreq;
    const pulseLFO = ctx.createOscillator();
    pulseLFO.type = 'square';
    pulseLFO.frequency.value = cfg.pulseRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cfg.pulseGain * vol;
    pulseLFO.connect(lfoGain.gain);
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = cfg.pulseGain * vol;
    pulseOsc.connect(pulseGain).connect(this.bgmGain);
    pulseLFO.start();
    pulseOsc.start();
    this.tensionNodes.push(pulseOsc, pulseLFO, lfoGain, pulseGain);
  }

  /** 전투 텐션 BGM 정지 */
  stopTensionBGM(): void {
    for (const node of this.tensionNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    this.tensionNodes = [];
    this.tensionActive = false;
  }

  // ─── 클린업 ───

  dispose(): void {
    this.stopAmbience();
    this.stopTensionBGM();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.noiseBuffer = null;
    SoundEngine._instance = null;
  }
}

// ─── Export ───

export function getSoundEngine(): SoundEngine {
  return SoundEngine.getInstance();
}

export type { SoundEngine };
