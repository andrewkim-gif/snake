/**
 * procedural-sfx.ts — Web Audio API 기반 프로시저럴 SFX 합성 유틸리티
 *
 * v16 Phase 7: 모든 게임 사운드를 코드로 합성 (외부 오디오 파일 불필요)
 * - 발걸음 (바이옴별 주파수/노이즈 변조)
 * - 전투 (피격, 사망, 레벨업, 오브 수집)
 * - 환경 BGM/앰비언스 (oscillator + filter sweep)
 * - UI 사운드 (카운트다운, 능력 준비)
 */

// ─── Types ───

export type FootstepBiome = 'grass' | 'sand' | 'stone' | 'snow' | 'water' | 'swamp';

export type CombatSFX =
  | 'hit_light'
  | 'hit_heavy'
  | 'hit_critical'
  | 'death'
  | 'kill_confirm'
  | 'level_up'
  | 'orb_collect'
  | 'dash'
  | 'shield_block'
  | 'weapon_fire';

export type UISFX =
  | 'countdown_tick'
  | 'countdown_go'
  | 'ability_ready'
  | 'epoch_transition'
  | 'war_start'
  | 'levelup';

export type AmbienceBiome = 'forest' | 'desert' | 'mountain' | 'urban' | 'arctic' | 'island';

// ─── Procedural noise buffer 생성 ───

/** 화이트 노이즈 AudioBuffer 생성 (한 번 만들어 캐시) */
export function createNoiseBuffer(ctx: AudioContext, duration = 0.5): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ─── Footstep synthesizers (바이옴별) ───

/** 프로시저럴 발걸음 — 바이옴에 따라 주파수/필터/노이즈 다름 */
export function synthFootstep(
  ctx: AudioContext,
  dest: AudioNode,
  biome: FootstepBiome,
  noiseBuffer: AudioBuffer,
  volume = 0.12,
): void {
  const now = ctx.currentTime;

  switch (biome) {
    case 'grass': {
      // 풀밟기: 짧은 노이즈 버스트 + 고역 컷
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2500;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * 0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(filter).connect(gain).connect(dest);
      src.start(now);
      src.stop(now + 0.08);
      break;
    }
    case 'sand': {
      // 모래 바스락: 밴드패스 노이즈 + 느린 감쇠
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3500;
      bp.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      src.connect(bp).connect(gain).connect(dest);
      src.start(now);
      src.stop(now + 0.12);
      break;
    }
    case 'stone': {
      // 돌발자국: 짧은 임팩트 + 클릭
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain).connect(dest);
      osc.start(now);
      osc.stop(now + 0.06);

      // 노이즈 레이어
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(volume * 0.3, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      src.connect(hp).connect(ng).connect(dest);
      src.start(now);
      src.stop(now + 0.04);
      break;
    }
    case 'snow': {
      // 눈밟기: 부드러운 크런치 (매우 짧은 필터 노이즈)
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5000, now);
      lp.frequency.exponentialRampToValueAtTime(800, now + 0.06);
      lp.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      src.connect(lp).connect(gain).connect(dest);
      src.start(now);
      src.stop(now + 0.1);
      break;
    }
    case 'water': {
      // 물 스플래시: 저역 펑 + 노이즈 스플래시
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(volume * 0.6, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g1).connect(dest);
      osc.start(now);
      osc.stop(now + 0.15);

      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.8;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(volume * 0.5, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      src.connect(bp).connect(g2).connect(dest);
      src.start(now);
      src.stop(now + 0.2);
      break;
    }
    case 'swamp': {
      // 늪지: 저음 꾸르륵 + 기포
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.setValueAtTime(150, now + 0.05);
      osc.frequency.setValueAtTime(80, now + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
  }
}

// ─── Combat SFX synthesizers ───

export function synthCombatSFX(
  ctx: AudioContext,
  dest: AudioNode,
  type: CombatSFX,
  noiseBuffer: AudioBuffer,
  volume = 0.15,
): void {
  const now = ctx.currentTime;

  switch (type) {
    case 'hit_light': {
      // 가벼운 타격: 짧은 사인 + 노이즈
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }
    case 'hit_heavy': {
      // 강한 타격: 저음 임팩트 + 노이즈 레이어
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 1.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.16);

      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1000;
      bp.Q.value = 2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(volume * 0.6, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(bp).connect(ng).connect(dest);
      src.start(now);
      src.stop(now + 0.1);
      break;
    }
    case 'hit_critical': {
      // 크리티컬: 상승 톤 + 크래클
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 1.4, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    }
    case 'death': {
      // 사망: 하강 스윕 + 잔향
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume, now);
      g.gain.linearRampToValueAtTime(volume * 0.7, now + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.65);

      // 두 번째 레이어
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(330, now + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(40, now + 0.5);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(volume * 0.6, now + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(g2).connect(dest);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.6);
      break;
    }
    case 'kill_confirm': {
      // 킬 확인: 상승 아르페지오 (8-bit 스타일)
      const notes = [440, 660, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        const t = now + i * 0.06;
        g.gain.setValueAtTime(volume * (0.15 - i * 0.02), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + 0.12);
      });
      break;
    }
    case 'level_up': {
      // 레벨업 팡파르: 4음 상승 아르페지오
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        const t = now + i * 0.1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(volume * 0.2, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + (i === 3 ? 0.4 : 0.15));
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + (i === 3 ? 0.45 : 0.2));
      });
      break;
    }
    case 'orb_collect': {
      // 오브 수집: 짧은 핑
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.6, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.07);
      break;
    }
    case 'dash': {
      // 대시: 우쉬 (화이트 노이즈 + 스윕 필터)
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(500, now);
      bp.frequency.linearRampToValueAtTime(3000, now + 0.1);
      bp.frequency.exponentialRampToValueAtTime(200, now + 0.3);
      bp.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.8, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      src.connect(bp).connect(g).connect(dest);
      src.start(now);
      src.stop(now + 0.3);
      break;
    }
    case 'shield_block': {
      // 방패 블록: 메탈릭 링
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 800;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(g);
      osc2.connect(g);
      g.connect(dest);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.25);
      osc2.stop(now + 0.25);
      break;
    }
    case 'weapon_fire': {
      // 무기 발사: 짧은 펄스
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.8, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.07);
      break;
    }
  }
}

// ─── UI SFX synthesizers ───

export function synthUISFX(
  ctx: AudioContext,
  dest: AudioNode,
  type: UISFX,
  volume = 0.1,
): void {
  const now = ctx.currentTime;

  switch (type) {
    case 'countdown_tick': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }
    case 'countdown_go': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 1.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    }
    case 'ability_ready': {
      const notes = [660, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        const t = now + i * 0.06;
        g.gain.setValueAtTime(volume * 0.8, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + 0.12);
      });
      break;
    }
    case 'epoch_transition': {
      // 에포크 전환: 깊은 울림 + 상승 톤
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.8);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 1.2, now);
      g.gain.linearRampToValueAtTime(volume * 0.6, now + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 1.1);
      break;
    }
    case 'war_start': {
      // 전쟁 시작: 드럼롤 느낌 (저음 반복)
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 80 + i * 20;
        const g = ctx.createGain();
        const t = now + i * 0.08;
        g.gain.setValueAtTime(volume * (0.3 + i * 0.15), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + 0.08);
      }
      break;
    }
    case 'levelup': {
      // 레벨업: 상승 아르페지오 (C5→E5→G5→C6)
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        const t = now + i * 0.08;
        g.gain.setValueAtTime(volume * 1.0, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(g).connect(dest);
        osc.start(t);
        osc.stop(t + 0.25);
      });
      break;
    }
  }
}

// ─── Ambience / BGM Oscillator Configs (SoundEngine에서 사용) ───

export interface AmbienceLayerConfig {
  freq: number;
  type: OscillatorType;
  gain: number;
  lfoFreq?: number;
  lfoDepth?: number;
  /** 바이패스 필터 설정 */
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterQ?: number;
}

export interface AmbienceConfig {
  baseFreq: number;
  baseType: OscillatorType;
  baseGain: number;
  layers: AmbienceLayerConfig[];
}

/** 바이옴별 앰비언스 설정 (프로시저럴 오실레이터 + LFO) */
export const AMBIENCE_CONFIGS: Record<AmbienceBiome, AmbienceConfig> = {
  forest: {
    baseFreq: 120, baseType: 'sine', baseGain: 0.018,
    layers: [
      { freq: 2000, type: 'sine', gain: 0.012, lfoFreq: 3, lfoDepth: 800 },
      { freq: 3500, type: 'sine', gain: 0.007, lfoFreq: 5, lfoDepth: 500 },
      { freq: 200, type: 'sine', gain: 0.008, lfoFreq: 0.3, lfoDepth: 50 },
    ],
  },
  desert: {
    baseFreq: 80, baseType: 'sine', baseGain: 0.022,
    layers: [
      { freq: 150, type: 'sine', gain: 0.018, lfoFreq: 0.5, lfoDepth: 40 },
      { freq: 400, type: 'sine', gain: 0.008, lfoFreq: 0.8, lfoDepth: 100 },
    ],
  },
  mountain: {
    baseFreq: 100, baseType: 'sine', baseGain: 0.018,
    layers: [
      { freq: 200, type: 'sine', gain: 0.012, lfoFreq: 0.4, lfoDepth: 60 },
      { freq: 600, type: 'sine', gain: 0.006, lfoFreq: 0.2, lfoDepth: 200 },
    ],
  },
  urban: {
    baseFreq: 60, baseType: 'sine', baseGain: 0.012,
    layers: [
      { freq: 100, type: 'triangle', gain: 0.008, lfoFreq: 0.1, lfoDepth: 20 },
      { freq: 300, type: 'sine', gain: 0.004, lfoFreq: 2, lfoDepth: 50 },
    ],
  },
  arctic: {
    baseFreq: 90, baseType: 'sine', baseGain: 0.018,
    layers: [
      { freq: 250, type: 'sine', gain: 0.015, lfoFreq: 0.6, lfoDepth: 80 },
      { freq: 4000, type: 'sine', gain: 0.002, lfoFreq: 0.1, lfoDepth: 2000 },
    ],
  },
  island: {
    baseFreq: 150, baseType: 'sine', baseGain: 0.018,
    layers: [
      { freq: 100, type: 'sine', gain: 0.02, lfoFreq: 0.15, lfoDepth: 50 },
      { freq: 250, type: 'sine', gain: 0.012, lfoFreq: 0.3, lfoDepth: 80 },
      { freq: 2500, type: 'sine', gain: 0.008, lfoFreq: 4, lfoDepth: 600 },
    ],
  },
};

/** 전투 텐션 BGM 설정: 낮은 드론 + 펄스 + 하이핫 */
export interface TensionBGMConfig {
  droneFreq: number;
  droneType: OscillatorType;
  droneGain: number;
  pulseFreq: number;
  pulseRate: number;  // Hz (BPM / 60)
  pulseGain: number;
}

export const TENSION_BGM_CONFIG: TensionBGMConfig = {
  droneFreq: 55,
  droneType: 'sawtooth',
  droneGain: 0.025,
  pulseFreq: 110,
  pulseRate: 2,  // 120 BPM
  pulseGain: 0.02,
};
