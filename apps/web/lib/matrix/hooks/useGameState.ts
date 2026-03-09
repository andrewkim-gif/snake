/**
 * useGameState - 게임 상태 관리 훅
 * App.tsx에서 추출한 게임 상태 관련 로직
 */

import React, { useState, useCallback, useEffect } from 'react';
import { GAME_CONFIG, CLASS_DATA, MAX_REROLLS, GOLD_REWARD, WEAPON_DATA, MAX_ACTIVE_SKILLS } from '../constants';
import { GameState, PlayerClass, WeaponType, RouletteReward, WaveNumber } from '../types';
import { soundManager } from '../utils/audio';

const LAST_CLASS_KEY = 'nexus_last_class';

export interface UseGameStateReturn {
  // 기본 상태
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  health: number;
  setHealth: React.Dispatch<React.SetStateAction<number>>;
  xp: number;
  setXp: React.Dispatch<React.SetStateAction<number>>;
  nextXp: number;
  setNextXp: React.Dispatch<React.SetStateAction<number>>;
  level: number;
  setLevel: React.Dispatch<React.SetStateAction<number>>;
  gameTime: number;
  setGameTime: React.Dispatch<React.SetStateAction<number>>;

  // 스페셜 스킬
  specialCooldown: number;
  setSpecialCooldown: React.Dispatch<React.SetStateAction<number>>;

  // 클래스
  selectedClass: PlayerClass;
  setSelectedClass: React.Dispatch<React.SetStateAction<PlayerClass>>;

  // 무기
  weapons: Record<string, number>;
  setWeapons: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  weaponCooldowns: Partial<Record<WeaponType, number>>;
  setWeaponCooldowns: React.Dispatch<React.SetStateAction<Partial<Record<WeaponType, number>>>>;

  // 리롤
  rerollsLeft: number;
  setRerollsLeft: React.Dispatch<React.SetStateAction<number>>;

  // 게임 상태
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;

  // 보상
  appliedReward: RouletteReward | null;
  setAppliedReward: React.Dispatch<React.SetStateAction<RouletteReward | null>>;

  // UI 상태
  isMenuOpen: boolean;
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  damageFlashTrigger: boolean;
  setDamageFlashTrigger: React.Dispatch<React.SetStateAction<boolean>>;
  resetTrigger: number;
  setResetTrigger: React.Dispatch<React.SetStateAction<number>>;

  // 콜백
  handleScoreUpdate: (newScore: number) => void;
  handleHealthUpdate: (newHealth: number) => void;
  handleXpUpdate: (currentXp: number, requiredXp: number, lvl: number) => void;
  handleTimeUpdate: (t: number) => void;
  handleSpecialUpdate: (cd: number) => void;
  handleWeaponCooldownsUpdate: (cds: Partial<Record<WeaponType, number>>) => void;
  handleLevelUpTrigger: () => void;
  handleSelectUpgrade: (type: WeaponType, actualMaxHealth?: number) => void;
  handleReroll: () => void;
  handleDamageTaken: (damageFlashEnabled: boolean) => void;
  toggleMenu: () => void;
}

export function useGameState(): UseGameStateReturn {
  // 기본 상태
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(GAME_CONFIG.PLAYER_HP);
  const [xp, setXp] = useState(0);
  const [nextXp, setNextXp] = useState(10);
  const [level, setLevel] = useState(1);
  const [gameTime, setGameTime] = useState(0);

  // 스페셜 스킬
  const [specialCooldown, setSpecialCooldown] = useState(0);

  // 클래스 (마지막 플레이한 캐릭터 자동 선택)
  const [selectedClass, setSelectedClass] = useState<PlayerClass>(() => {
    const saved = localStorage.getItem(LAST_CLASS_KEY);
    if (saved && CLASS_DATA[saved as PlayerClass]) {
      return saved as PlayerClass;
    }
    return 'neo';
  });

  // 클래스 변경 시 저장
  useEffect(() => {
    localStorage.setItem(LAST_CLASS_KEY, selectedClass);
  }, [selectedClass]);

  // 무기
  const [weapons, setWeapons] = useState<Record<string, number>>({ whip: 1 });
  const [weaponCooldowns, setWeaponCooldowns] = useState<Partial<Record<WeaponType, number>>>({});

  // 리롤
  const [rerollsLeft, setRerollsLeft] = useState(MAX_REROLLS);

  // 게임 상태
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    isLevelUp: false,
    isCharacterSelect: false,
    gameTime: 0,
    stage: 1,
    phase: 'farming',
    wave: 1 as WaveNumber  // 새로운 웨이브 시스템
  });

  // 보상
  const [appliedReward, setAppliedReward] = useState<RouletteReward | null>(null);

  // UI 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [damageFlashTrigger, setDamageFlashTrigger] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  // 콜백들
  const handleScoreUpdate = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleHealthUpdate = useCallback((newHealth: number) => {
    setHealth(newHealth);
  }, []);

  const handleXpUpdate = useCallback((currentXp: number, requiredXp: number, lvl: number) => {
    setXp(currentXp);
    setNextXp(requiredXp);
    setLevel(lvl);
  }, []);

  const handleTimeUpdate = useCallback((t: number) => {
    setGameTime(t);
  }, []);

  const handleSpecialUpdate = useCallback((cd: number) => {
    setSpecialCooldown(cd);
  }, []);

  const handleWeaponCooldownsUpdate = useCallback((cds: Partial<Record<WeaponType, number>>) => {
    setWeaponCooldowns(cds);
  }, []);

  const handleLevelUpTrigger = useCallback(() => {
    setGameState(prev => ({ ...prev, isLevelUp: true }));
  }, []);

  const handleSelectUpgrade = useCallback((type: WeaponType, actualMaxHealth?: number) => {
    if (type === 'gold_reward') {
      setScore(prev => prev + GOLD_REWARD.value);
      // 실제 최대 체력 기준으로 회복 (업그레이드/캐릭터 강화 보너스 포함)
      // actualMaxHealth가 전달되지 않으면 기본 계산 사용 (폴백)
      const maxHealth = actualMaxHealth ?? (GAME_CONFIG.PLAYER_HP * (CLASS_DATA[selectedClass]?.hpMult || 1));
      setHealth(prev => Math.min(maxHealth, prev + GOLD_REWARD.heal));
      soundManager.playSFX('cash');
    } else {
      setWeapons(prev => ({
        ...prev,
        [type]: (prev[type] || 0) + 1
      }));
      soundManager.playSFX('powerup');
    }
    setGameState(prev => ({ ...prev, isLevelUp: false }));
  }, [selectedClass]);

  const handleReroll = useCallback(() => {
    setRerollsLeft(prev => Math.max(0, prev - 1));
  }, []);

  const handleDamageTaken = useCallback((damageFlashEnabled: boolean) => {
    if (damageFlashEnabled) {
      setDamageFlashTrigger(true);
      setTimeout(() => setDamageFlashTrigger(false), 150);
    }
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  return {
    score, setScore,
    health, setHealth,
    xp, setXp,
    nextXp, setNextXp,
    level, setLevel,
    gameTime, setGameTime,
    specialCooldown, setSpecialCooldown,
    selectedClass, setSelectedClass,
    weapons, setWeapons,
    weaponCooldowns, setWeaponCooldowns,
    rerollsLeft, setRerollsLeft,
    gameState, setGameState,
    appliedReward, setAppliedReward,
    isMenuOpen, setIsMenuOpen,
    damageFlashTrigger, setDamageFlashTrigger,
    resetTrigger, setResetTrigger,
    handleScoreUpdate,
    handleHealthUpdate,
    handleXpUpdate,
    handleTimeUpdate,
    handleSpecialUpdate,
    handleWeaponCooldownsUpdate,
    handleLevelUpTrigger,
    handleSelectUpgrade,
    handleReroll,
    handleDamageTaken,
    toggleMenu,
  };
}
