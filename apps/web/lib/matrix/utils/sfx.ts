/**
 * sfx.ts - SFX Manager (Web Audio 합성)
 * gem_pickup 등 경량 사운드 이펙트
 * 2개 파일에서 import (App.tsx, pickup.ts)
 */

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try { _ctx = new AudioContext(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

// 쿨다운 (너무 빠른 연속 재생 방지)
let _lastPlay = 0;

/** 젬 수집 사운드: 짧은 상승 틱 */
function synthGemPickup(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // 랜덤 피치 변화로 반복 재생 시 단조롭지 않게
  const basePitch = 1200 + Math.random() * 400;
  osc.frequency.setValueAtTime(basePitch, now);
  osc.frequency.exponentialRampToValueAtTime(basePitch * 1.5, now + 0.04);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.06);
}

class SfxManager {
  private enabled = true;

  play(name: string, _options?: { volume?: number; pitch?: number }): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - _lastPlay < 30) return; // 30ms 쿨다운
    _lastPlay = now;

    if (name === 'gem_pickup') {
      synthGemPickup(_options?.volume ?? 0.8);
    }
  }

  preload(_names: string[]): Promise<void> {
    getCtx(); // 컨텍스트 초기화만
    return Promise.resolve();
  }

  preloadFile(_path: string): void {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {}
}

/** 글로벌 싱글톤 */
export const sfxManager = new SfxManager();
