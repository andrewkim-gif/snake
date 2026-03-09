/**
 * audio.ts - SoundManager stub
 * app_ingame의 soundManager를 no-op으로 대체
 * 45개 파일에서 import되므로 인터페이스를 정확히 맞춰야 함
 */

class SoundManager {
  private muted = false;
  private volume = 1.0;
  private currentTrack: string | null = null;
  private comboCount = 0;
  private lastComboTime = 0;

  // BGM 관련
  playMenuBGM(): void {}
  playGameBGM(): void {}
  stopBGM(): void {}
  pauseBGM(): void {}
  resumeBGM(): void {}
  nextMenuTrack(): void {}
  prevMenuTrack(): void {}
  toggleMenuPlay(): void {}
  getCurrentTrackInfo(): { name: string; index: number; total: number } {
    return { name: '', index: 0, total: 0 };
  }

  // SFX 관련
  playSFX(
    name: string,
    _options?: {
      pitch?: number;
      volume?: number;
      intensity?: number;
      isCritical?: boolean;
    }
  ): void {
    // no-op stub
    void name;
  }

  // 무기별 사운드 메서드 (combat.ts, weapons.ts에서 호출)
  playWhipSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playWandSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playKnifeSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playAxeSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playBibleSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playGarlicSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playPoolSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playLightningSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playBeamSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playLaserSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playPhishingSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playPunchSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playBowSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playPingSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playShardSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playAirdropSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playForkSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playGenesisSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playBridgeSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}
  playSwordSound(_opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void {}

  // 게임 이벤트 사운드
  playHitSound(): void {}
  playDeathSound(): void {}
  playLevelUpSound(): void {}
  playPickupSound(): void {}
  playBossSound(): void {}
  playCashSound(): void {}
  playPowerupSound(): void {}
  playClickSound(): void {}

  // 콤보 시스템
  resetCombo(): void {
    this.comboCount = 0;
    this.lastComboTime = 0;
  }

  // 볼륨/뮤트 제어
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }
  getVolume(): number {
    return this.volume;
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
  isMuted(): boolean {
    return this.muted;
  }
  toggleMute(): void {
    this.muted = !this.muted;
  }

  // 프리로드
  preloadAll(): Promise<void> {
    return Promise.resolve();
  }

  // 정리
  dispose(): void {
    this.currentTrack = null;
  }
}

/** 글로벌 싱글톤 */
export const soundManager = new SoundManager();

/** 메뉴 OST 목록 (stub) */
export const MENU_OSTS: string[] = [];
