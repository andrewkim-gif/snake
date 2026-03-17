/**
 * audio.ts - Web Audio API 합성 사운드 시스템
 * 오디오 파일 없이 코드로 사운드 생성 (펀치감 강한 모던 톤)
 * 기존 인터페이스 100% 호환 (45개 파일에서 import)
 *
 * v48 최적화:
 * - 노이즈 버퍼 사전 캐싱 (매 프레임 createBuffer + Math.random 제거)
 * - onended disconnect (메모리 누수 방지)
 * - 쿨다운 증가 (hit 25→80ms, death 100→150ms)
 */

// === Web Audio Context 싱글톤 ===
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new AudioContext();
      // 컨텍스트 생성 시 노이즈 버퍼 초기화
      _initNoiseBuffers(_ctx);
    } catch {
      return null;
    }
  }
  // suspended 상태면 resume (브라우저 자동재생 정책)
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

// === 노이즈 버퍼 캐시 (1회 생성, 무한 재사용) ===
let _hitNoiseBuffer: AudioBuffer | null = null;    // 0.06초
let _killNoiseBuffer: AudioBuffer | null = null;   // 0.08초
let _explosionNoiseBuffer: AudioBuffer | null = null; // 0.3초

function _initNoiseBuffers(ctx: AudioContext) {
  // hit 노이즈 (0.06초, 감쇄)
  const hitSize = Math.ceil(ctx.sampleRate * 0.06);
  _hitNoiseBuffer = ctx.createBuffer(1, hitSize, ctx.sampleRate);
  const hitData = _hitNoiseBuffer.getChannelData(0);
  for (let i = 0; i < hitSize; i++) {
    hitData[i] = (Math.random() * 2 - 1) * (1 - i / hitSize);
  }

  // kill 노이즈 (0.08초, 큐빅 감쇄)
  const killSize = Math.ceil(ctx.sampleRate * 0.08);
  _killNoiseBuffer = ctx.createBuffer(1, killSize, ctx.sampleRate);
  const killData = _killNoiseBuffer.getChannelData(0);
  for (let i = 0; i < killSize; i++) {
    killData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / killSize, 3);
  }

  // explosion 노이즈 (0.3초, 제곱 감쇄)
  const expSize = Math.ceil(ctx.sampleRate * 0.3);
  _explosionNoiseBuffer = ctx.createBuffer(1, expSize, ctx.sampleRate);
  const expData = _explosionNoiseBuffer.getChannelData(0);
  for (let i = 0; i < expSize; i++) {
    expData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / expSize, 2);
  }
}

// === 쿨다운 관리 (동일 사운드 연속 재생 방지) ===
const _cooldowns = new Map<string, number>();
function canPlay(id: string, minInterval: number): boolean {
  const now = performance.now();
  const last = _cooldowns.get(id) ?? 0;
  if (now - last < minInterval) return false;
  _cooldowns.set(id, now);
  return true;
}

// === 유틸: 노드 자동 해제 ===
function autoDisconnect(osc: OscillatorNode, ...nodes: AudioNode[]) {
  osc.onended = () => {
    osc.disconnect();
    for (const n of nodes) n.disconnect();
  };
}

function autoDisconnectSource(src: AudioBufferSourceNode, ...nodes: AudioNode[]) {
  src.onended = () => {
    src.disconnect();
    for (const n of nodes) n.disconnect();
  };
}

// === 합성 사운드 프리셋 ===

/** 근접 무기 타격음: 묵직한 저음 펀치 + 고음 임팩트 */
function synthMeleeHit(vol: number, pitch = 1.0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // 저음 펀치 (사각파)
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  const osc1 = ctx.createOscillator();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(90 * pitch, now);
  osc1.frequency.exponentialRampToValueAtTime(40, now + 0.08);
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.12);
  autoDisconnect(osc1, gain);

  // 고음 임팩트 (사인파 클릭)
  const gain2 = ctx.createGain();
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(vol * 0.3, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(800 * pitch, now);
  osc2.frequency.exponentialRampToValueAtTime(200, now + 0.04);
  osc2.connect(gain2);
  osc2.start(now);
  osc2.stop(now + 0.05);
  autoDisconnect(osc2, gain2);
}

/** 원거리 발사음: 전자음 + 빠른 디케이 */
function synthRangedShot(vol: number, pitch = 1.0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(200 * pitch, now + 0.08);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.1);
  autoDisconnect(osc, gain);
}

/** 피격음: 캐시된 노이즈 버스트 + 저음 (버퍼 재사용) */
function synthHit(vol: number, pitch = 1.0) {
  const ctx = getCtx();
  if (!ctx || !_hitNoiseBuffer) return;
  const now = ctx.currentTime;

  // 캐시된 노이즈 버퍼 재생
  const noise = ctx.createBufferSource();
  noise.buffer = _hitNoiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000 * pitch;
  filter.Q.value = 1.5;
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.06);
  autoDisconnectSource(noise, filter, noiseGain);

  // 저음 임팩트
  const gain2 = ctx.createGain();
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(vol * 0.3, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
  osc.connect(gain2);
  osc.start(now);
  osc.stop(now + 0.08);
  autoDisconnect(osc, gain2);
}

/** 폭발음: 캐시된 노이즈 + 저음 진동 (버퍼 재사용) */
function synthExplosion(vol: number) {
  const ctx = getCtx();
  if (!ctx || !_explosionNoiseBuffer) return;
  const now = ctx.currentTime;

  // 캐시된 노이즈 폭발
  const noise = ctx.createBufferSource();
  noise.buffer = _explosionNoiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(3000, now);
  lpf.frequency.exponentialRampToValueAtTime(200, now + 0.2);
  noise.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.3);
  autoDisconnectSource(noise, lpf, noiseGain);

  // 서브 베이스 진동
  const subGain = ctx.createGain();
  subGain.connect(ctx.destination);
  subGain.gain.setValueAtTime(vol * 0.6, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, now);
  sub.frequency.exponentialRampToValueAtTime(25, now + 0.15);
  sub.connect(subGain);
  sub.start(now);
  sub.stop(now + 0.2);
  autoDisconnect(sub, subGain);
}

/** 적 죽음: 캐시된 파열음 + 하강 톤 (버퍼 재사용) */
function synthKill(vol: number) {
  const ctx = getCtx();
  if (!ctx || !_killNoiseBuffer) return;
  const now = ctx.currentTime;

  // 캐시된 파열음
  const noise = ctx.createBufferSource();
  noise.buffer = _killNoiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.08);
  autoDisconnectSource(noise, noiseGain);

  // 하강 톤
  const gain2 = ctx.createGain();
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(vol * 0.25, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
  osc.connect(gain2);
  osc.start(now);
  osc.stop(now + 0.15);
  autoDisconnect(osc, gain2);
}

/** 레벨업: 상승 아르페지오 팡파르 */
function synthLevelUp(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

  notes.forEach((freq, i) => {
    const t = now + i * 0.08;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.25);
    autoDisconnect(osc, gain);
  });
}

/** 치유: 부드러운 상승 톤 */
function synthHeal(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.2, now);
  gain.gain.linearRampToValueAtTime(vol * 0.35, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.linearRampToValueAtTime(880, now + 0.15);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
  autoDisconnect(osc, gain);
}

/** 파워업: 전자 상승음 + 반짝이 */
function synthPowerup(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // 메인 상승음
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
  autoDisconnect(osc, gain);

  // 반짝이 (고음 사인파 트레몰로)
  const gain2 = ctx.createGain();
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(vol * 0.1, now + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2000, now + 0.05);
  osc2.connect(gain2);
  osc2.start(now + 0.05);
  osc2.stop(now + 0.25);
  autoDisconnect(osc2, gain2);
}

/** 코인/캐쉬: 짧은 금속성 딩 */
function synthCash(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.setValueAtTime(1600, now + 0.03);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.15);
  autoDisconnect(osc, gain);
}

/** UI 클릭: 매우 짧은 틱 */
function synthClick(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, now);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.03);
  autoDisconnect(osc, gain);
}

/** 게임오버: 하강 + 저음 진동 */
function synthGameOver(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [440, 370, 330, 220]; // 하강

  notes.forEach((freq, i) => {
    const t = now + i * 0.15;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(vol * 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.3);
    autoDisconnect(osc, gain);
  });
}

/** 빔/레이저 발사: 지속적인 전자음 */
function synthBeam(vol: number, pitch = 1.0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400 * pitch, now);
  osc.frequency.linearRampToValueAtTime(800 * pitch, now + 0.1);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.2);
  autoDisconnect(osc, gain);
}

/** 라이트닝: 크랙클 + 스파크 */
function synthLightning(vol: number, pitch = 1.0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // 크랙클 (고속 주파수 스윕)
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200 * pitch, now);
  osc.frequency.setValueAtTime(1600 * pitch, now + 0.02);
  osc.frequency.setValueAtTime(100 * pitch, now + 0.04);
  osc.frequency.setValueAtTime(2000 * pitch, now + 0.06);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.12);
  autoDisconnect(osc, gain);
}

/** 콤보 사운드: 피치 상승하는 임팩트 */
function synthCombo(vol: number, pitch = 1.0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol * 0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(500 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(1000 * pitch, now + 0.05);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.1);
  autoDisconnect(osc, gain);
}

/** 알림/경고: 반복 비프 */
function synthAlarm(vol: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.12;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(vol * 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.08);
    autoDisconnect(osc, gain);
  }
}

// === SFX 이름 → 합성 함수 매핑 ===
type SynthFn = (vol: number, pitch?: number) => void;
const SFX_MAP: Record<string, SynthFn> = {
  hit: synthHit,
  slash: synthMeleeHit,
  shoot: synthRangedShot,
  explosion: synthExplosion,
  powerup: synthPowerup,
  heal: synthHeal,
  levelup: synthLevelUp,
  cash: synthCash,
  click: synthClick,
  combo: synthCombo,
  alarm: synthAlarm,
  alert: synthAlarm,
  gameover: synthGameOver,
  start: synthPowerup,
};

// === 무기 이름 → 합성 함수 매핑 ===
const WEAPON_SFX_MAP: Record<string, SynthFn> = {
  whip: synthMeleeHit,
  punch: synthMeleeHit,
  sword: synthMeleeHit,
  wand: synthRangedShot,
  knife: synthRangedShot,
  axe: synthRangedShot,
  bow: synthRangedShot,
  ping: synthRangedShot,
  shard: synthRangedShot,
  fork: synthRangedShot,
  crossbow: synthRangedShot,
  bible: synthBeam,
  garlic: synthBeam,
  pool: synthBeam,
  lightning: synthLightning,
  beam: synthBeam,
  laser: synthBeam,
  phishing: synthExplosion,
  bridge: synthLightning,
  airdrop: synthExplosion,
  genesis: synthExplosion,
};

class SoundManager {
  private muted = false;
  private volume = 1.0;
  private currentTrack: string | null = null;
  private comboCount = 0;
  private lastComboTime = 0;

  // BGM 관련 (추후 구현 — 현재 stub)
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

  // === SFX 재생 (핵심 메서드) ===
  playSFX(
    name: string,
    options?: {
      pitch?: number;
      volume?: number;
      intensity?: number;
      isCritical?: boolean;
    }
  ): void {
    if (this.muted) return;
    if (!canPlay(`sfx-${name}`, 60)) return; // 30→60ms

    const fn = SFX_MAP[name];
    if (fn) {
      const vol = this.volume * (options?.volume ?? 1.0);
      const pitch = options?.pitch ?? 1.0;
      fn(vol, pitch);
    }
  }

  // === 무기별 사운드 ===
  private _playWeapon(weapon: string, opts?: { pitch?: number; intensity?: number; isCritical?: boolean }) {
    if (this.muted) return;
    if (!canPlay(`wpn-${weapon}`, 60)) return; // 40→60ms
    const fn = WEAPON_SFX_MAP[weapon] ?? synthRangedShot;
    const vol = this.volume * (opts?.isCritical ? 1.2 : 0.8);
    const pitch = (opts?.pitch ?? 1.0) * (0.95 + Math.random() * 0.1); // ±5% pitch 변화
    fn(vol, pitch);
  }

  playWhipSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('whip', opts); }
  playWandSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('wand', opts); }
  playKnifeSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('knife', opts); }
  playAxeSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('axe', opts); }
  playBibleSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('bible', opts); }
  playGarlicSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('garlic', opts); }
  playPoolSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('pool', opts); }
  playLightningSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('lightning', opts); }
  playBeamSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('beam', opts); }
  playLaserSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('laser', opts); }
  playPhishingSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('phishing', opts); }
  playPunchSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('punch', opts); }
  playBowSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('bow', opts); }
  playPingSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('ping', opts); }
  playShardSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('shard', opts); }
  playAirdropSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('airdrop', opts); }
  playForkSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('fork', opts); }
  playGenesisSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('genesis', opts); }
  playBridgeSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('bridge', opts); }
  playSwordSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('sword', opts); }
  playCrossbowSound(opts?: { pitch?: number; intensity?: number; isCritical?: boolean }): void { this._playWeapon('crossbow', opts); }

  // === 피격 SFX ===
  playHitSFX(
    _name: string,
    optionsOrCritical?: boolean | {
      pitch?: number;
      volume?: number;
      intensity?: number;
      isCritical?: boolean;
    }
  ): void {
    if (this.muted) return;
    if (!canPlay('hit-sfx', 80)) return; // 25→80ms
    const isCrit = typeof optionsOrCritical === 'boolean' ? optionsOrCritical : optionsOrCritical?.isCritical;
    const vol = this.volume * (isCrit ? 1.0 : 0.6);
    const pitch = (isCrit ? 1.3 : 1.0) * (0.9 + Math.random() * 0.2);
    synthHit(vol, pitch);
  }

  // === 이벤트 사운드 ===
  playHitSound(): void { if (!this.muted && canPlay('hit', 80)) synthHit(this.volume * 0.5); } // 25→80ms
  playDeathSound(): void { if (!this.muted && canPlay('death', 150)) synthKill(this.volume); } // 100→150ms
  playLevelUpSound(): void { if (!this.muted && canPlay('lvlup', 200)) synthLevelUp(this.volume); }
  playPickupSound(): void { if (!this.muted && canPlay('pickup', 50)) synthCash(this.volume * 0.7); }
  playBossSound(): void { if (!this.muted && canPlay('boss', 300)) synthExplosion(this.volume); }
  playCashSound(): void { if (!this.muted && canPlay('cash-evt', 40)) synthCash(this.volume * 0.8); }
  playPowerupSound(): void { if (!this.muted && canPlay('powerup-evt', 100)) synthPowerup(this.volume); }
  playClickSound(): void { if (!this.muted && canPlay('click-evt', 30)) synthClick(this.volume); }

  // === 콤보 ===
  resetCombo(): void {
    this.comboCount = 0;
    this.lastComboTime = 0;
  }

  // === 볼륨/뮤트 ===
  setVolume(vol: number): void { this.volume = Math.max(0, Math.min(1, vol)); }
  getVolume(): number { return this.volume; }
  setMuted(muted: boolean): void { this.muted = muted; }
  isMuted(): boolean { return this.muted; }
  toggleMute(): void { this.muted = !this.muted; }

  // === 프리로드 / 정리 ===
  preloadAll(): Promise<void> {
    // Web Audio 합성: 컨텍스트 + 노이즈 버퍼 초기화
    getCtx();
    return Promise.resolve();
  }
  dispose(): void {
    this.currentTrack = null;
    _cooldowns.clear();
  }
}

/** 글로벌 싱글톤 */
export const soundManager = new SoundManager();

/** 메뉴 OST 목록 (stub) */
export const MENU_OSTS: string[] = [];
