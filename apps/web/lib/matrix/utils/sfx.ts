/**
 * sfx.ts - SFX Manager stub
 * app_ingame의 sfxManager를 no-op으로 대체
 * 2개 파일에서 import (App.tsx, pickup.ts)
 */

class SfxManager {
  private enabled = true;

  play(_name: string, _options?: { volume?: number; pitch?: number }): void {
    // no-op stub
  }

  preload(_names: string[]): Promise<void> {
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
