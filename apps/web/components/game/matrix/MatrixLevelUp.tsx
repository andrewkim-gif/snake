'use client';

/**
 * MatrixLevelUp.tsx - v29 Phase 5: Level Up Selection Modal
 *
 * Adapted from app_ingame/components/LevelUpModal.tsx
 * - WEAPON_DATA / WEAPON_ICONS / config-driven skill system
 * - Weighted random skill choices
 * - Rarity color/icon per skill
 * - Auto-select timer (Vibe Coding)
 * - Keyboard shortcuts (1-4)
 * - Matrix green theme (#00FF41)
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import { WEAPON_DATA, MAX_ACTIVE_SKILLS, GOLD_REWARD } from '@/lib/matrix/constants';
import type { WeaponType } from '@/lib/matrix/types';
import {
  Code2, Keyboard, Globe, GitCommit, Server, FileCode, Link2, Radio,
  Download, Sparkles, Layers, RefreshCw, Database, ShieldCheck, Bug,
  GripHorizontal, Target, Dice5, Crown, ArrowRight, Magnet, Bot,
  Diamond, GitFork, AlertTriangle, Focus, Coins, Shield, ScrollText, Gauge,
  Zap, Settings,
} from 'lucide-react';
import { soundManager } from '@/lib/matrix/utils/audio';

// ============================================
// Re-export interfaces for MatrixApp compatibility
// ============================================

/**
 * LevelUpOption - kept for backward compat with MatrixApp
 * MatrixApp generates these, but internally we use UpgradeOption
 */
export interface LevelUpOption {
  id: string;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  type: 'weapon' | 'skill' | 'passive';
}

export interface MatrixLevelUpProps {
  /** MatrixApp passes currentWeapons for full config-driven generation */
  currentWeapons?: Record<string, number>;
  /** Fallback: pre-generated options from MatrixApp */
  options?: LevelUpOption[];
  /** onSelect receives weapon type id */
  onSelect: (id: string) => void;
  /** Player class for filtering */
  playerClass?: string;
  /** Rerolls remaining */
  rerollsLeft?: number;
  /** Reroll callback */
  onReroll?: () => void;
  /** Auto Hunt (Vibe Coding) enabled */
  isAutoHunt?: boolean;
  /** Time scale multiplier */
  timeScale?: number;
  /** Dev mode (show all skills) */
  isDevMode?: boolean;
}

// ============================================
// Internal types
// ============================================

interface UpgradeOption {
  type: WeaponType;
  isNew: boolean;
  currentLevel: number;
  nextLevel: number;
  name: string;
  description: string;
  statChanges: string;
  color: string;
  isUltimate: boolean;
  isMax: boolean;
  isGoldReward?: boolean;
}

// ============================================
// Weapon Icons mapping
// ============================================

export const WEAPON_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  // Melee/Aura
  whip: Code2,
  punch: Keyboard,
  sword: GripHorizontal,
  bible: FileCode,
  garlic: Bug,
  pool: Shield,
  // Ranged
  wand: Globe,
  knife: GitCommit,
  axe: Server,
  bow: Target,
  ping: Radio,
  shard: Diamond,
  fork: GitFork,
  // Special
  lightning: Sparkles,
  beam: Layers,
  laser: RefreshCw,
  phishing: Database,
  stablecoin: ShieldCheck,
  bridge: Link2,
  airdrop: Download,
  genesis: AlertTriangle,
  // Passives
  aggregator: Magnet,
  oracle: ScrollText,
  focus: Focus,
  overclock: Gauge,
  // Reward
  gold_reward: Coins,
};

// ============================================
// Constants
// ============================================

const MATRIX_GREEN = '#00FF41';

// ============================================
// Component
// ============================================

function MatrixLevelUpInner({
  currentWeapons,
  options: fallbackOptions,
  onSelect,
  playerClass,
  rerollsLeft = 0,
  onReroll,
  isAutoHunt,
  timeScale = 1.0,
  isDevMode = false,
}: MatrixLevelUpProps) {
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [autoSelectTimer, setAutoSelectTimer] = useState<number | null>(null);
  const [isHoveringOptions, setIsHoveringOptions] = useState(false);

  // ─── Stat changes description ───
  const getStatChanges = (type: WeaponType, currentLevel: number, nextLevel: number): string => {
    const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
    if (!data) return '';
    const prev = data.stats[currentLevel - 1];
    const next = data.stats[nextLevel - 1];
    if (!prev) return 'System initialized';
    if ((next as any).isEvolved && !(prev as any).isEvolved) return '>> EVOLUTION DETECTED <<';
    if ((next as any).isUltimate && !(prev as any).isUltimate) return '>> ULTIMATE POWER UNLOCKED <<';

    const changes: string[] = [];
    if (next.damage > prev.damage) changes.push(`DMG +${Math.round(next.damage - prev.damage)}`);
    if (next.amount > prev.amount) {
      if (type === 'oracle') changes.push(`Luck +${next.amount - prev.amount}%`);
      else if (type === 'stablecoin') changes.push(`Shield +${next.amount - prev.amount}`);
      else if (type === 'focus') changes.push(`Crit +${((next.amount - prev.amount) / 10).toFixed(1)}%`);
      else changes.push(`Count +${next.amount - prev.amount}`);
    }
    if (next.cooldown < prev.cooldown) changes.push(`Speed +${Math.round((1 - next.cooldown / prev.cooldown) * 100)}%`);
    if (next.area > prev.area) changes.push(`Range +${Math.round(((next.area - prev.area) / prev.area) * 100)}%`);
    if (next.pierce > prev.pierce) changes.push(`Pierce +${next.pierce - prev.pierce}`);
    return changes.length > 0 ? changes.join('  |  ') : 'Performance optimized';
  };

  // ─── Generate upgrade options from WEAPON_DATA ───
  const generateOptions = useCallback(() => {
    // If no currentWeapons, fall back to pre-built options
    if (!currentWeapons) {
      if (fallbackOptions && fallbackOptions.length > 0) {
        const converted: UpgradeOption[] = fallbackOptions.map(opt => ({
          type: opt.id as WeaponType,
          isNew: opt.currentLevel === 0,
          currentLevel: opt.currentLevel,
          nextLevel: opt.currentLevel + 1,
          name: opt.name,
          description: opt.description,
          statChanges: '',
          color: opt.rarity === 'legendary' ? '#facc15' : opt.rarity === 'epic' ? '#c084fc' : opt.rarity === 'rare' ? '#60a5fa' : MATRIX_GREEN,
          isUltimate: opt.rarity === 'legendary',
          isMax: opt.currentLevel + 1 >= opt.maxLevel,
        }));
        setOptions(converted);
      }
      return;
    }

    const possibleUpgrades: UpgradeOption[] = [];
    const allTypes = Object.keys(WEAPON_DATA) as WeaponType[];
    const traderWeapons: WeaponType[] = ['sword' as WeaponType, 'bow' as WeaponType, 'crossbow' as WeaponType, 'axe' as WeaponType, 'knife' as WeaponType];

    const activeSkillCount = (Object.values(currentWeapons) as number[]).filter(lvl => lvl > 0).length;
    const isSlotsFull = activeSkillCount >= MAX_ACTIVE_SKILLS;

    allTypes.forEach(type => {
      if (type === 'gold_reward') return;

      if (!isDevMode) {
        if (playerClass === 'cypher' && !traderWeapons.includes(type)) return;
        if (playerClass !== 'cypher' && ['sword', 'bow', 'crossbow'].includes(type)) return;
        if (type === 'punch' && playerClass !== 'tank') return;
      }

      const currentLevel = currentWeapons[type] || 0;
      if (!isDevMode && isSlotsFull && currentLevel === 0) return;
      if (currentLevel >= 20) return;

      const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
      if (!data) return;

      if (currentLevel < data.stats.length) {
        const nextLevel = currentLevel + 1;
        let statChanges = '';
        let description = data.desc;
        const nextStats = data.stats[nextLevel - 1];
        const isEvolved = (nextStats as any).isEvolved || false;
        const isUltimate = (nextStats as any).isUltimate || false;

        if (currentLevel === 0) {
          statChanges = 'NEW EQUIPMENT';
          description = data.desc;
        } else if (isEvolved && (!currentWeapons[type] || !(WEAPON_DATA[type as keyof typeof WEAPON_DATA] as any).stats[currentLevel - 1].isEvolved)) {
          statChanges = 'EVOLUTION';
          description = `Evolved: ${(nextStats as any).evolvedName}`;
        } else if (isUltimate && (!currentWeapons[type] || !(WEAPON_DATA[type as keyof typeof WEAPON_DATA] as any).stats[currentLevel - 1].isUltimate)) {
          statChanges = 'ULTIMATE AWAKENING';
          description = `Ultimate: ${(nextStats as any).evolvedName}`;
        } else {
          statChanges = getStatChanges(type, currentLevel, nextLevel);
        }

        possibleUpgrades.push({
          type,
          isNew: currentLevel === 0,
          currentLevel,
          nextLevel,
          name: (nextStats as any).evolvedName || data.name,
          description,
          statChanges,
          color: isUltimate ? '#facc15' : (isEvolved ? '#38bdf8' : data.color),
          isUltimate,
          isMax: nextLevel === 20,
        });
      }
    });

    if (possibleUpgrades.length === 0) {
      setOptions([{
        type: 'gold_reward' as WeaponType,
        isNew: false,
        currentLevel: 0,
        nextLevel: 0,
        name: GOLD_REWARD.name,
        description: GOLD_REWARD.desc,
        statChanges: `SCORE +${GOLD_REWARD.value} | HP +${GOLD_REWARD.heal}`,
        color: GOLD_REWARD.color,
        isUltimate: false,
        isMax: false,
        isGoldReward: true,
      }]);
    } else {
      if (isDevMode) {
        const sorted = possibleUpgrades.sort((a, b) => {
          if (a.currentLevel > 0 && b.currentLevel === 0) return -1;
          if (a.currentLevel === 0 && b.currentLevel > 0) return 1;
          if (a.currentLevel !== b.currentLevel) return b.currentLevel - a.currentLevel;
          return a.name.localeCompare(b.name);
        });
        setOptions(sorted);
      } else {
        const shuffled = possibleUpgrades.sort(() => 0.5 - Math.random());
        setOptions(shuffled.slice(0, 4));
      }
    }
  }, [currentWeapons, playerClass, isDevMode, fallbackOptions]);

  useEffect(() => {
    generateOptions();
  }, [generateOptions]);

  // ─── Auto Hunt timer ───
  const [autoTimerInitialized, setAutoTimerInitialized] = useState(false);

  useEffect(() => {
    if (isDevMode) {
      setAutoSelectTimer(null);
      setAutoTimerInitialized(false);
      return;
    }
    if (isAutoHunt && options.length > 0 && !autoTimerInitialized) {
      setAutoTimerInitialized(true);
      setAutoSelectTimer(5);
    }
  }, [isAutoHunt, options.length, isDevMode, autoTimerInitialized]);

  useEffect(() => {
    if (isDevMode || !isAutoHunt || autoSelectTimer === null || options.length === 0 || isHoveringOptions) {
      return;
    }
    const intervalMs = 1000 / timeScale;
    const timer = setInterval(() => {
      setAutoSelectTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        soundManager.playSFX('click');
        return prev - 1;
      });
    }, intervalMs);
    return () => { clearInterval(timer); };
  }, [isAutoHunt, autoSelectTimer, timeScale, isDevMode, options.length, isHoveringOptions]);

  // Auto select when timer hits 0
  useEffect(() => {
    if (isDevMode || !isAutoHunt || autoSelectTimer !== 0 || options.length === 0) return;

    let bestOption = options[0];
    const ultimate = options.find(o => o.isUltimate);
    if (ultimate) {
      bestOption = ultimate;
    } else {
      const evolution = options.find(o => o.statChanges.includes('EVOLUTION') || o.statChanges.includes('TRANSCENDENCE'));
      if (evolution) {
        bestOption = evolution;
      } else {
        const highestLevel = [...options].sort((a, b) => b.currentLevel - a.currentLevel)[0];
        if (highestLevel && !highestLevel.isGoldReward) {
          bestOption = highestLevel;
        }
      }
    }
    onSelect(bestOption.type);
  }, [autoSelectTimer, isAutoHunt, isDevMode, options, onSelect]);

  // ─── Keyboard shortcuts (1-4) ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' && options[0]) onSelect(options[0].type);
      if (e.key === '2' && options[1]) onSelect(options[1].type);
      if (e.key === '3' && options[2]) onSelect(options[2].type);
      if (e.key === '4' && options[3]) onSelect(options[3].type);
      if (e.code === 'Numpad1' && options[0]) onSelect(options[0].type);
      if (e.code === 'Numpad2' && options[1]) onSelect(options[1].type);
      if (e.code === 'Numpad3' && options[2]) onSelect(options[2].type);
      if (e.code === 'Numpad4' && options[3]) onSelect(options[3].type);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, onSelect]);

  // ─── Reroll ───
  const handleRerollClick = () => {
    if (rerollsLeft > 0 && onReroll) {
      soundManager.playSFX('click');
      onReroll();
      generateOptions();
      if (isAutoHunt) {
        setAutoTimerInitialized(false);
        setAutoSelectTimer(5);
        setTimeout(() => setAutoTimerInitialized(true), 0);
      }
    }
  };

  return (
    <div data-testid="levelup-modal" className="absolute inset-0 z-[70] flex items-center justify-center bg-black/90 p-2 md:p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-black/95 border-2 border-gray-700 flex flex-col max-h-[95vh] overflow-hidden">

        {/* Header */}
        <div className="bg-black/80 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 border-2 flex items-center justify-center"
              style={{ borderColor: MATRIX_GREEN, backgroundColor: `${MATRIX_GREEN}20` }}
            >
              <Zap size={20} style={{ color: MATRIX_GREEN }} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wider" style={{ color: MATRIX_GREEN }}>LEVEL UP</h2>
              <p className="text-gray-500 text-[10px]">Select an upgrade</p>
            </div>
          </div>

          {onReroll && (
            <button
              onClick={handleRerollClick}
              disabled={rerollsLeft <= 0 || (options[0]?.isGoldReward ?? false)}
              className={`
                flex items-center gap-2 px-3 py-2 border transition-all active:scale-95
                ${rerollsLeft > 0 && !(options[0]?.isGoldReward)
                  ? 'bg-purple-600 hover:bg-purple-500 border-purple-400'
                  : 'bg-black/60 border-gray-700 cursor-not-allowed opacity-50'}
              `}
            >
              <Dice5 className="text-white w-5 h-5" />
              <div className="flex flex-col text-left">
                <span className="text-[8px] text-purple-200 leading-none mb-0.5">REROLL</span>
                <span className="text-sm font-bold text-white leading-none">{rerollsLeft}</span>
              </div>
            </button>
          )}
        </div>

        {/* Dev Mode Banner */}
        {isDevMode && (
          <div className="bg-orange-900/40 border-b border-orange-500/50 px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-orange-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span className="text-orange-400 text-xs tracking-wider">DEV MODE</span>
            </div>
            <span className="text-orange-300 text-[10px]">{options.length} skills</span>
          </div>
        )}

        {/* Auto Hunt Banner */}
        {!isDevMode && isAutoHunt && autoSelectTimer !== null && (
          <div className={`border-b px-3 py-1.5 flex items-center justify-between transition-colors ${
            isHoveringOptions
              ? 'bg-yellow-900/40 border-yellow-500/50'
              : 'bg-green-900/40 border-green-500/50'
          }`}>
            <div className="flex items-center gap-2">
              <Bot size={14} className={isHoveringOptions ? 'text-yellow-400' : 'text-green-400'} />
              <span className={`text-xs tracking-wider ${isHoveringOptions ? 'text-yellow-400' : 'text-green-400'}`}>
                {isHoveringOptions ? 'PAUSED' : 'VIBE CODING'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-16 h-1.5 bg-black/80 border overflow-hidden ${
                isHoveringOptions ? 'border-yellow-700/50' : 'border-green-700/50'
              }`}>
                <div
                  className={`h-full ${isHoveringOptions ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${(autoSelectTimer / 5) * 100}%`, transition: isHoveringOptions ? 'none' : 'width 1s linear' }}
                />
              </div>
              <span className={`text-sm min-w-[16px] text-center ${isHoveringOptions ? 'text-yellow-400' : 'text-green-400'}`}>
                {autoSelectTimer}
              </span>
            </div>
          </div>
        )}

        {/* Options List */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-black/60"
          onMouseEnter={() => setIsHoveringOptions(true)}
          onMouseLeave={() => setIsHoveringOptions(false)}
        >
          <div className="flex flex-col gap-2 max-w-md mx-auto">
            {options.map((opt, idx) => {
              const Icon = WEAPON_ICONS[opt.type] || Zap;
              const isUltimateUpgrade = opt.isUltimate;

              return (
                <button
                  key={opt.type + idx}
                  data-testid={`levelup-option-${idx}`}
                  onClick={() => onSelect(opt.type)}
                  className={`
                    relative p-3 flex items-center gap-4 transition-all active:scale-[0.98] group pointer-events-auto
                    ${isUltimateUpgrade
                      ? 'bg-yellow-900/30 border-2 border-yellow-500'
                      : opt.isGoldReward
                        ? 'bg-green-900/30 border-2 border-green-500'
                        : 'bg-black/60 border border-gray-700 hover:bg-gray-900/60 hover:border-gray-500'}
                  `}
                >
                  {/* Left: Icon + Level */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-12 h-12 border-2 flex items-center justify-center ${isUltimateUpgrade ? 'bg-yellow-900/40' : 'bg-black/80'}`}
                      style={{ borderColor: opt.color }}
                    >
                      <Icon size={24} style={{ color: opt.color }} />
                    </div>
                    {isUltimateUpgrade && (
                      <Crown className="absolute -top-2 -right-2 text-yellow-400 w-4 h-4" />
                    )}
                    {opt.isNew && (
                      <div className="absolute -top-1 -left-1 bg-red-500 border border-red-400 text-white text-[8px] px-1 py-0.5">
                        NEW
                      </div>
                    )}
                    {!opt.isGoldReward && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/90 border border-gray-700 px-1.5 py-0.5 text-[9px]">
                        <span className="text-gray-500">{opt.currentLevel}</span>
                        <ArrowRight size={8} className="text-gray-600" />
                        <span style={{ color: isUltimateUpgrade ? '#facc15' : MATRIX_GREEN }}>{opt.nextLevel}</span>
                      </div>
                    )}
                  </div>

                  {/* Center: Name + Description + Stats */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base tracking-wide truncate font-bold" style={{ color: opt.color }}>
                        {opt.name}
                      </span>
                    </div>
                    <p className="text-gray-500 text-[10px] leading-snug mb-1 line-clamp-2">
                      {opt.description}
                    </p>
                    <span
                      className="text-[10px]"
                      style={{ color: isUltimateUpgrade ? '#facc15' : MATRIX_GREEN }}
                    >
                      {opt.statChanges}
                    </span>
                  </div>

                  {/* Right: Keyboard hint */}
                  <div className="shrink-0 w-7 h-7 bg-black/80 border border-gray-600 text-sm text-gray-400 flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 text-center text-gray-600 text-[9px] bg-black/80 border-t border-gray-700">
          Press 1, 2, 3, 4 for quick select
        </div>

      </div>
    </div>
  );
}

const MatrixLevelUp = memo(MatrixLevelUpInner);
export default MatrixLevelUp;
