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
 *
 * v29b: All Tailwind className converted to inline styles.
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
    <div data-testid="levelup-modal" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.9)',
      padding: 8,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 512,
        backgroundColor: 'rgba(0,0,0,0.95)',
        border: '2px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '95vh',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 12,
          paddingBottom: 12,
          borderBottom: '1px solid #374151',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: `2px solid ${MATRIX_GREEN}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${MATRIX_GREEN}20`,
              }}
            >
              <Zap size={20} style={{ color: MATRIX_GREEN }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: '0.05em', color: MATRIX_GREEN, margin: 0 }}>LEVEL UP</h2>
              <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>Select an upgrade</p>
            </div>
          </div>

          {onReroll && (
            <button
              onClick={handleRerollClick}
              disabled={rerollsLeft <= 0 || (options[0]?.isGoldReward ?? false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                transition: 'all 0.2s',
                cursor: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? 'pointer' : 'not-allowed',
                opacity: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? 1 : 0.5,
                backgroundColor: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? '#9333ea' : 'rgba(0,0,0,0.6)',
                border: `1px solid ${rerollsLeft > 0 && !(options[0]?.isGoldReward) ? '#a855f7' : '#374151'}`,
              }}
            >
              <Dice5 style={{ color: 'white', width: 20, height: 20 }} />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span style={{ fontSize: 8, color: '#e9d5ff', lineHeight: 1, marginBottom: 2 }}>REROLL</span>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: 'white', lineHeight: 1 }}>{rerollsLeft}</span>
              </div>
            </button>
          )}
        </div>

        {/* Dev Mode Banner */}
        {isDevMode && (
          <div style={{
            backgroundColor: 'rgba(124,45,18,0.4)',
            borderBottom: '1px solid rgba(249,115,22,0.5)',
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={14} style={{ color: '#fb923c', animation: 'spin 3s linear infinite' }} />
              <span style={{ color: '#fb923c', fontSize: 12, letterSpacing: '0.05em' }}>DEV MODE</span>
            </div>
            <span style={{ color: '#fdba74', fontSize: 10 }}>{options.length} skills</span>
          </div>
        )}

        {/* Auto Hunt Banner */}
        {!isDevMode && isAutoHunt && autoSelectTimer !== null && (
          <div style={{
            borderBottom: '1px solid',
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s',
            ...(isHoveringOptions
              ? { backgroundColor: 'rgba(113,63,18,0.4)', borderBottomColor: 'rgba(234,179,8,0.5)' }
              : { backgroundColor: 'rgba(20,83,45,0.4)', borderBottomColor: 'rgba(34,197,94,0.5)' }
            ),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={14} style={{ color: isHoveringOptions ? '#facc15' : '#4ade80' }} />
              <span style={{
                fontSize: 12,
                letterSpacing: '0.05em',
                color: isHoveringOptions ? '#facc15' : '#4ade80',
              }}>
                {isHoveringOptions ? 'PAUSED' : 'VIBE CODING'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 64,
                height: 6,
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: `1px solid ${isHoveringOptions ? 'rgba(161,98,7,0.5)' : 'rgba(21,128,61,0.5)'}`,
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: isHoveringOptions ? '#eab308' : '#22c55e',
                    width: `${(autoSelectTimer / 5) * 100}%`,
                    transition: isHoveringOptions ? 'none' : 'width 1s linear',
                  }}
                />
              </div>
              <span style={{
                fontSize: 14,
                minWidth: 16,
                textAlign: 'center',
                color: isHoveringOptions ? '#facc15' : '#4ade80',
              }}>
                {autoSelectTimer}
              </span>
            </div>
          </div>
        )}

        {/* Options List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 16,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
          onMouseEnter={() => setIsHoveringOptions(true)}
          onMouseLeave={() => setIsHoveringOptions(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 448, marginLeft: 'auto', marginRight: 'auto' }}>
            {options.map((opt, idx) => {
              const Icon = WEAPON_ICONS[opt.type] || Zap;
              const isUltimateUpgrade = opt.isUltimate;

              return (
                <button
                  key={opt.type + idx}
                  data-testid={`levelup-option-${idx}`}
                  onClick={() => onSelect(opt.type)}
                  style={{
                    position: 'relative',
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'all 0.2s',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    textAlign: 'left',
                    ...(isUltimateUpgrade
                      ? { backgroundColor: 'rgba(113,63,18,0.3)', border: '2px solid #eab308' }
                      : opt.isGoldReward
                        ? { backgroundColor: 'rgba(20,83,45,0.3)', border: '2px solid #22c55e' }
                        : { backgroundColor: 'rgba(0,0,0,0.6)', border: '1px solid #374151' }
                    ),
                  }}
                >
                  {/* Left: Icon + Level */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        border: `2px solid ${opt.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isUltimateUpgrade ? 'rgba(113,63,18,0.4)' : 'rgba(0,0,0,0.8)',
                      }}
                    >
                      <Icon size={24} style={{ color: opt.color }} />
                    </div>
                    {isUltimateUpgrade && (
                      <Crown style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        color: '#facc15',
                        width: 16,
                        height: 16,
                      }} />
                    )}
                    {opt.isNew && (
                      <div style={{
                        position: 'absolute',
                        top: -4,
                        left: -4,
                        backgroundColor: '#ef4444',
                        border: '1px solid #f87171',
                        color: 'white',
                        fontSize: 8,
                        paddingLeft: 4,
                        paddingRight: 4,
                        paddingTop: 2,
                        paddingBottom: 2,
                      }}>
                        NEW
                      </div>
                    )}
                    {!opt.isGoldReward && (
                      <div style={{
                        position: 'absolute',
                        bottom: -4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        border: '1px solid #374151',
                        paddingLeft: 6,
                        paddingRight: 6,
                        paddingTop: 2,
                        paddingBottom: 2,
                        fontSize: 9,
                      }}>
                        <span style={{ color: '#6b7280' }}>{opt.currentLevel}</span>
                        <ArrowRight size={8} style={{ color: '#4b5563' }} />
                        <span style={{ color: isUltimateUpgrade ? '#facc15' : MATRIX_GREEN }}>{opt.nextLevel}</span>
                      </div>
                    )}
                  </div>

                  {/* Center: Name + Description + Stats */}
                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 16,
                        letterSpacing: '0.025em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold',
                        color: opt.color,
                      }}>
                        {opt.name}
                      </span>
                    </div>
                    <p style={{
                      color: '#6b7280',
                      fontSize: 10,
                      lineHeight: 1.375,
                      marginBottom: 4,
                      margin: 0,
                      marginTop: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {opt.description}
                    </p>
                    <span
                      style={{
                        fontSize: 10,
                        color: isUltimateUpgrade ? '#facc15' : MATRIX_GREEN,
                      }}
                    >
                      {opt.statChanges}
                    </span>
                  </div>

                  {/* Right: Keyboard hint */}
                  <div style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid #4b5563',
                    fontSize: 14,
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                  }}>
                    {idx + 1}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 8,
          paddingBottom: 8,
          textAlign: 'center',
          color: '#4b5563',
          fontSize: 9,
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderTop: '1px solid #374151',
        }}>
          Press 1, 2, 3, 4 for quick select
        </div>

      </div>
    </div>
  );
}

const MatrixLevelUp = memo(MatrixLevelUpInner);
export default MatrixLevelUp;
