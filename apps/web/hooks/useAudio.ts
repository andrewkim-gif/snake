'use client';

/**
 * useAudio — Web Audio API 기반 사운드 시스템
 * v12 S24: 기본 SFX (킬, 레벨업, 어빌리티) + 테마별 앰비언스
 *
 * Web Audio API oscillator로 합성 사운드 생성
 * 실제 오디오 파일 불필요 — 모든 사운드를 프로그래매틱으로 합성
 */

import { useRef, useCallback, useEffect, useState } from 'react';

// ─── 사운드 타입 정의 ───
export type SFXType = 'kill' | 'level_up' | 'ability_venom' | 'ability_shield' | 'ability_lightning' | 'ability_dash' | 'ability_drain' | 'ability_gravity' | 'death' | 'orb_collect';

export type AmbienceTheme = 'forest' | 'desert' | 'mountain' | 'urban' | 'arctic' | 'island';

interface UseAudioReturn {
  /** SFX 재생 */
  playSFX: (type: SFXType) => void;
  /** 앰비언스 시작 */
  startAmbience: (theme: AmbienceTheme) => void;
  /** 앰비언스 정지 */
  stopAmbience: () => void;
  /** 음소거 토글 */
  toggleMute: () => void;
  /** 현재 음소거 상태 */
  isMuted: boolean;
  /** 마스터 볼륨 (0~1) */
  setVolume: (vol: number) => void;
}

// ─── 합성 SFX 정의 (oscillator 파라미터) ───
interface SynthNote {
  freq: number;
  type: OscillatorType;
  duration: number;
  delay?: number;
  gain?: number;
  detune?: number;
}

const SFX_DEFINITIONS: Record<SFXType, SynthNote[]> = {
  kill: [
    // 짧은 상승 톤 (킬 확인음)
    { freq: 440, type: 'square', duration: 0.08, gain: 0.15 },
    { freq: 660, type: 'square', duration: 0.08, delay: 0.06, gain: 0.12 },
    { freq: 880, type: 'square', duration: 0.12, delay: 0.12, gain: 0.1 },
  ],
  level_up: [
    // 상승 아르페지오 (레벨업 팡파르)
    { freq: 523, type: 'sine', duration: 0.15, gain: 0.2 },
    { freq: 659, type: 'sine', duration: 0.15, delay: 0.1, gain: 0.18 },
    { freq: 784, type: 'sine', duration: 0.15, delay: 0.2, gain: 0.16 },
    { freq: 1047, type: 'sine', duration: 0.3, delay: 0.3, gain: 0.2 },
  ],
  ability_venom: [
    // 저음 부글거림 (독 오라)
    { freq: 110, type: 'sawtooth', duration: 0.3, gain: 0.1, detune: 50 },
    { freq: 130, type: 'sawtooth', duration: 0.2, delay: 0.1, gain: 0.08, detune: -30 },
  ],
  ability_shield: [
    // 차임 (방패 활성화)
    { freq: 800, type: 'sine', duration: 0.15, gain: 0.15 },
    { freq: 1200, type: 'sine', duration: 0.2, delay: 0.05, gain: 0.12 },
    { freq: 600, type: 'triangle', duration: 0.3, delay: 0.1, gain: 0.1 },
  ],
  ability_lightning: [
    // 크래클 (번개)
    { freq: 200, type: 'sawtooth', duration: 0.05, gain: 0.2 },
    { freq: 800, type: 'square', duration: 0.03, delay: 0.03, gain: 0.15 },
    { freq: 100, type: 'sawtooth', duration: 0.1, delay: 0.05, gain: 0.12 },
    { freq: 1600, type: 'square', duration: 0.02, delay: 0.08, gain: 0.1 },
  ],
  ability_dash: [
    // 우쉬 (스피드)
    { freq: 300, type: 'sine', duration: 0.15, gain: 0.1 },
    { freq: 600, type: 'sine', duration: 0.1, delay: 0.05, gain: 0.08 },
  ],
  ability_drain: [
    // 흡입 (하강 톤)
    { freq: 500, type: 'sine', duration: 0.2, gain: 0.12 },
    { freq: 350, type: 'sine', duration: 0.2, delay: 0.1, gain: 0.1 },
    { freq: 200, type: 'sine', duration: 0.3, delay: 0.2, gain: 0.08 },
  ],
  ability_gravity: [
    // 깊은 울림 (중력장)
    { freq: 80, type: 'sine', duration: 0.4, gain: 0.15 },
    { freq: 120, type: 'triangle', duration: 0.3, delay: 0.1, gain: 0.1 },
  ],
  death: [
    // 하강 톤 (사망)
    { freq: 440, type: 'square', duration: 0.15, gain: 0.15 },
    { freq: 330, type: 'square', duration: 0.15, delay: 0.1, gain: 0.12 },
    { freq: 220, type: 'square', duration: 0.3, delay: 0.2, gain: 0.1 },
    { freq: 110, type: 'square', duration: 0.4, delay: 0.3, gain: 0.08 },
  ],
  orb_collect: [
    // 틱 (오브 수집)
    { freq: 1200, type: 'sine', duration: 0.05, gain: 0.08 },
  ],
};

// ─── 앰비언스 정의 (테마별 연속 노이즈/톤) ───
interface AmbienceConfig {
  /** 기본 노이즈 타입 */
  baseFreq: number;
  baseType: OscillatorType;
  baseGain: number;
  /** 추가 레이어 (새소리, 바람 등) */
  layers: Array<{
    freq: number;
    type: OscillatorType;
    gain: number;
    lfoFreq?: number;  // 모듈레이션 주파수
    lfoDepth?: number; // 모듈레이션 깊이
  }>;
}

const AMBIENCE_CONFIGS: Record<AmbienceTheme, AmbienceConfig> = {
  forest: {
    // 새소리 + 바람
    baseFreq: 120, baseType: 'sine', baseGain: 0.02,
    layers: [
      { freq: 2000, type: 'sine', gain: 0.015, lfoFreq: 3, lfoDepth: 800 },  // 새소리
      { freq: 3500, type: 'sine', gain: 0.008, lfoFreq: 5, lfoDepth: 500 },  // 높은 새소리
      { freq: 200, type: 'sine', gain: 0.01, lfoFreq: 0.3, lfoDepth: 50 },   // 나뭇잎 바람
    ],
  },
  desert: {
    // 바람 울림
    baseFreq: 80, baseType: 'sine', baseGain: 0.025,
    layers: [
      { freq: 150, type: 'sine', gain: 0.02, lfoFreq: 0.5, lfoDepth: 40 },  // 낮은 바람
      { freq: 400, type: 'sine', gain: 0.01, lfoFreq: 0.8, lfoDepth: 100 }, // 높은 바람
    ],
  },
  mountain: {
    // 바람 + 에코
    baseFreq: 100, baseType: 'sine', baseGain: 0.02,
    layers: [
      { freq: 200, type: 'sine', gain: 0.015, lfoFreq: 0.4, lfoDepth: 60 },  // 산 바람
      { freq: 600, type: 'sine', gain: 0.008, lfoFreq: 0.2, lfoDepth: 200 }, // 에코
    ],
  },
  urban: {
    // 도시 험
    baseFreq: 60, baseType: 'sine', baseGain: 0.015,
    layers: [
      { freq: 100, type: 'triangle', gain: 0.01, lfoFreq: 0.1, lfoDepth: 20 }, // 기계 험
      { freq: 300, type: 'sine', gain: 0.005, lfoFreq: 2, lfoDepth: 50 },      // 교통
    ],
  },
  arctic: {
    // 바람 + 얼음 크랙
    baseFreq: 90, baseType: 'sine', baseGain: 0.02,
    layers: [
      { freq: 250, type: 'sine', gain: 0.02, lfoFreq: 0.6, lfoDepth: 80 },   // 극지 바람
      { freq: 4000, type: 'sine', gain: 0.003, lfoFreq: 0.1, lfoDepth: 2000 }, // 얼음 크랙
    ],
  },
  island: {
    // 파도 + 새
    baseFreq: 150, baseType: 'sine', baseGain: 0.02,
    layers: [
      { freq: 100, type: 'sine', gain: 0.025, lfoFreq: 0.15, lfoDepth: 50 }, // 파도
      { freq: 250, type: 'sine', gain: 0.015, lfoFreq: 0.3, lfoDepth: 80 },  // 파도 고조파
      { freq: 2500, type: 'sine', gain: 0.01, lfoFreq: 4, lfoDepth: 600 },   // 갈매기
    ],
  },
};

export function useAudio(): UseAudioReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const ambienceNodesRef = useRef<Array<OscillatorNode | GainNode>>([]);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('aww-muted') === 'true';
  });
  const volumeRef = useRef(0.5);

  // AudioContext 초기화 (lazy — 첫 상호작용 후)
  const getCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : volumeRef.current;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;
      return ctx;
    } catch {
      return null;
    }
  }, [isMuted]);

  // SFX 재생
  const playSFX = useCallback((type: SFXType) => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx || !masterGainRef.current) return;

    const notes = SFX_DEFINITIONS[type];
    if (!notes) return;

    // AudioContext가 suspended 상태면 resume
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = note.type;
      osc.frequency.value = note.freq;
      if (note.detune) osc.detune.value = note.detune;

      const startTime = now + (note.delay ?? 0);
      const endTime = startTime + note.duration;
      const noteGain = (note.gain ?? 0.1) * volumeRef.current;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(noteGain, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);

      osc.connect(gain);
      gain.connect(masterGainRef.current);

      osc.start(startTime);
      osc.stop(endTime + 0.01);
    }
  }, [isMuted, getCtx]);

  // 앰비언스 시작
  const startAmbience = useCallback((theme: AmbienceTheme) => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx || !masterGainRef.current) return;

    // 기존 앰비언스 정지
    for (const node of ambienceNodesRef.current) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    ambienceNodesRef.current = [];

    const config = AMBIENCE_CONFIGS[theme];
    if (!config) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // 베이스 드론
    const baseOsc = ctx.createOscillator();
    const baseGain = ctx.createGain();
    baseOsc.type = config.baseType;
    baseOsc.frequency.value = config.baseFreq;
    baseGain.gain.value = config.baseGain * volumeRef.current;
    baseOsc.connect(baseGain);
    baseGain.connect(masterGainRef.current);
    baseOsc.start();
    ambienceNodesRef.current.push(baseOsc, baseGain);

    // 레이어
    for (const layer of config.layers) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = layer.type;
      osc.frequency.value = layer.freq;
      gain.gain.value = layer.gain * volumeRef.current;

      // LFO 모듈레이션 (자연스러운 변화)
      if (layer.lfoFreq && layer.lfoDepth) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = layer.lfoFreq;
        lfoGain.gain.value = layer.lfoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        ambienceNodesRef.current.push(lfo, lfoGain);
      }

      osc.connect(gain);
      gain.connect(masterGainRef.current);
      osc.start();
      ambienceNodesRef.current.push(osc, gain);
    }
  }, [isMuted, getCtx]);

  // 앰비언스 정지
  const stopAmbience = useCallback(() => {
    for (const node of ambienceNodesRef.current) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    ambienceNodesRef.current = [];
  }, []);

  // 음소거 토글
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('aww-muted', String(next));
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = next ? 0 : volumeRef.current;
      }
      if (next) {
        // 앰비언스도 정지
        for (const node of ambienceNodesRef.current) {
          try {
            if (node instanceof OscillatorNode) node.stop();
            node.disconnect();
          } catch { /* ignore */ }
        }
        ambienceNodesRef.current = [];
      }
      return next;
    });
  }, []);

  // 볼륨 설정
  const setVolume = useCallback((vol: number) => {
    volumeRef.current = Math.max(0, Math.min(1, vol));
    if (masterGainRef.current && !isMuted) {
      masterGainRef.current.gain.value = volumeRef.current;
    }
  }, [isMuted]);

  // 클린업
  useEffect(() => {
    return () => {
      for (const node of ambienceNodesRef.current) {
        try {
          if (node instanceof OscillatorNode) node.stop();
          node.disconnect();
        } catch { /* ignore */ }
      }
      ambienceNodesRef.current = [];
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, []);

  return { playSFX, startAmbience, stopAmbience, toggleMute, isMuted, setVolume };
}
