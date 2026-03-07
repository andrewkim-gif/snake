'use client';

/**
 * useSoundEngine — SoundEngine React 훅
 *
 * v16 Phase 7: SoundEngine 싱글턴을 React 컴포넌트에서 사용하기 위한 래퍼
 * - 게임 이벤트 (킬, 사망, 레벨업, 오브 수집) → 자동 SFX 트리거
 * - 발걸음: walkCycle 동기화 (바이옴별)
 * - 앰비언스: 바이옴 진입 시 자동 시작
 * - 전투 텐션 BGM: 전쟁 페이즈 시 전환
 * - 카메라 셰이크: 피격/킬/사망 이벤트 연동
 * - 설정: SettingsContent와 연동 가능한 인터페이스
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { getSoundEngine, type FXQuality } from '@/lib/3d/sound-engine';
import { getCameraShake } from '@/lib/3d/camera-shake';
import type { FootstepBiome, CombatSFX, UISFX, AmbienceBiome } from '@/lib/3d/procedural-sfx';

// ─── Return Type ───

export interface UseSoundEngineReturn {
  // ─── SFX 재생 ───
  playFootstep: (biome: FootstepBiome) => void;
  playCombat: (type: CombatSFX) => void;
  playCombat3D: (type: CombatSFX, worldX: number, worldZ: number) => void;
  playUI: (type: UISFX) => void;

  // ─── BGM/앰비언스 ───
  startAmbience: (biome: AmbienceBiome) => void;
  stopAmbience: () => void;
  startTensionBGM: () => void;
  stopTensionBGM: () => void;

  // ─── 카메라 이펙트 ───
  triggerHitShake: (damage: number) => void;
  triggerKillShake: () => void;
  triggerDeathShake: () => void;
  triggerDashEffect: () => void;

  // ─── 설정 ───
  toggleMute: () => boolean;
  isMuted: boolean;
  sfxVolume: number;
  bgmVolume: number;
  fxQuality: FXQuality;
  setSFXVolume: (vol: number) => void;
  setBGMVolume: (vol: number) => void;
  setFXQuality: (quality: FXQuality) => void;
}

// ─── Hook ───

export function useSoundEngine(): UseSoundEngineReturn {
  const engine = getSoundEngine();
  const shake = getCameraShake();

  // React state (UI 리렌더링용)
  const [settings, setSettings] = useState(() => engine.getSettings());

  // 리스너 위치 (플레이어 위치 — 외부에서 업데이트)
  const listenerPosRef = useRef({ x: 0, z: 0 });

  // ─── SFX ───

  const playFootstep = useCallback((biome: FootstepBiome) => {
    engine.playFootstep(biome);
  }, [engine]);

  const playCombat = useCallback((type: CombatSFX) => {
    engine.playCombat(type);
    // 피격 사운드 → 카메라 셰이크 연동
    if (type === 'hit_light') shake.triggerHit(10);
    else if (type === 'hit_heavy') shake.triggerHit(30);
    else if (type === 'hit_critical') shake.triggerHit(50);
  }, [engine, shake]);

  const playCombat3D = useCallback((type: CombatSFX, worldX: number, worldZ: number) => {
    engine.playCombat3D(type, worldX, worldZ, listenerPosRef.current.x, listenerPosRef.current.z);
  }, [engine]);

  const playUI = useCallback((type: UISFX) => {
    engine.playUI(type);
  }, [engine]);

  // ─── BGM/앰비언스 ───

  const startAmbience = useCallback((biome: AmbienceBiome) => {
    engine.startAmbience(biome);
  }, [engine]);

  const stopAmbience = useCallback(() => {
    engine.stopAmbience();
  }, [engine]);

  const startTensionBGM = useCallback(() => {
    engine.startTensionBGM();
  }, [engine]);

  const stopTensionBGM = useCallback(() => {
    engine.stopTensionBGM();
  }, [engine]);

  // ─── 카메라 이펙트 ───

  const triggerHitShake = useCallback((damage: number) => {
    shake.triggerHit(damage);
    engine.playCombat(damage > 20 ? 'hit_heavy' : 'hit_light');
  }, [shake, engine]);

  const triggerKillShake = useCallback(() => {
    shake.triggerKill();
    engine.playCombat('kill_confirm');
  }, [shake, engine]);

  const triggerDeathShake = useCallback(() => {
    shake.triggerDeath();
    engine.playCombat('death');
  }, [shake, engine]);

  const triggerDashEffect = useCallback(() => {
    shake.triggerDash();
    engine.playCombat('dash');
  }, [shake, engine]);

  // ─── 설정 ───

  const toggleMute = useCallback((): boolean => {
    const muted = engine.toggleMute();
    setSettings(engine.getSettings());
    return muted;
  }, [engine]);

  const setSFXVolume = useCallback((vol: number) => {
    engine.setSFXVolume(vol);
    setSettings(engine.getSettings());
  }, [engine]);

  const setBGMVolume = useCallback((vol: number) => {
    engine.setBGMVolume(vol);
    setSettings(engine.getSettings());
  }, [engine]);

  const setFXQuality = useCallback((quality: FXQuality) => {
    engine.setFXQuality(quality);
    shake.setEnabled(quality !== 'off');
    setSettings(engine.getSettings());
  }, [engine, shake]);

  // ─── 클린업 (페이지 전환 시) ───
  useEffect(() => {
    return () => {
      engine.stopAmbience();
      engine.stopTensionBGM();
    };
  }, [engine]);

  return {
    playFootstep,
    playCombat,
    playCombat3D,
    playUI,
    startAmbience,
    stopAmbience,
    startTensionBGM,
    stopTensionBGM,
    triggerHitShake,
    triggerKillShake,
    triggerDeathShake,
    triggerDashEffect,
    toggleMute,
    isMuted: settings.muted,
    sfxVolume: settings.sfxVolume,
    bgmVolume: settings.bgmVolume,
    fxQuality: settings.fxQuality,
    setSFXVolume,
    setBGMVolume,
    setFXQuality,
  };
}
