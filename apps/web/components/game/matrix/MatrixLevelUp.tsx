'use client';

/**
 * MatrixLevelUp.tsx - v32 Phase 3: Level Up Selection Modal (Apex Tactical Redesign)
 *
 * Adapted from app_ingame/components/LevelUpModal.tsx
 * - WEAPON_DATA / WEAPON_ICONS / config-driven skill system
 * - Weighted random skill choices
 * - Rarity color/icon per skill
 * - Auto-select timer (Vibe Coding)
 * - Keyboard shortcuts (1-4)
 * - Category color stripes
 * - apexClip on skill cards
 *
 * v32: Full Apex tactical redesign — SK tokens, headingFont/bodyFont, borderRadius:0,
 *      apexClip, category color stripes. Apex tactical design system (SK tokens only).
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
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';
import { getWeaponCategory } from '@/lib/matrix/config/skills/progressive-tree.config';
import { SkillIcon } from './SkillIcon';

// ============================================
// Category color mapping for left stripe
// ============================================

const CATEGORY_STRIPE_COLORS: Record<string, string> = {
  CODE: '#10B981',
  DATA: '#06B6D4',
  NETWORK: '#8B5CF6',
  SECURITY: '#EF4444',
  AI: '#F59E0B',
  SYSTEM: '#EC4899',
};

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
// Weapon Icons mapping (Legacy - use SkillIcon instead)
// Kept for backward compatibility with external imports
// ============================================

/** @deprecated Use `<SkillIcon type={...} />` component instead */
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
// Helper: get category stripe color for a weapon
// ============================================

function getCategoryColor(weaponType: WeaponType): string {
  const cat = getWeaponCategory(weaponType);
  if (cat && CATEGORY_STRIPE_COLORS[cat]) return CATEGORY_STRIPE_COLORS[cat];
  return SK.textMuted;
}

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
          color: opt.rarity === 'legendary' ? SK.gold : opt.rarity === 'epic' ? '#c084fc' : opt.rarity === 'rare' ? '#60a5fa' : SK.textPrimary,
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
          color: isUltimate ? SK.gold : (isEvolved ? '#38bdf8' : data.color),
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

  // Auto-select timer percentage (for circular progress)
  const timerPct = autoSelectTimer !== null ? (autoSelectTimer / 5) * 100 : 0;

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
      backgroundColor: OVERLAY.bg,
      backdropFilter: OVERLAY.blur,
      WebkitBackdropFilter: OVERLAY.blur,
      padding: 8,
      fontFamily: bodyFont,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: SK.bg,
        border: `1px solid ${SK.border}`,
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '95vh',
        overflow: 'hidden',
      }}>

        {/* ─── Header ─── */}
        <div style={{
          background: SK.cardBg,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 14,
          paddingBottom: 14,
          borderBottom: `1px solid ${SK.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              border: `2px solid ${SK.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: SK.accentBg,
              clipPath: apexClip.sm,
            }}>
              <Zap size={20} style={{ color: SK.accent }} />
            </div>
            <div>
              <h2 style={{
                fontFamily: headingFont,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: SK.accent,
                margin: 0,
              }}>
                LEVEL UP
              </h2>
              <p style={{ color: SK.textMuted, fontSize: 11, margin: 0 }}>
                Choose Your Upgrade
              </p>
            </div>
          </div>

          {/* Reroll button */}
          {onReroll && (
            <button
              onClick={handleRerollClick}
              disabled={rerollsLeft <= 0 || (options[0]?.isGoldReward ?? false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 48,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 10,
                paddingBottom: 10,
                transition: 'all 0.2s',
                cursor: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? 'pointer' : 'not-allowed',
                opacity: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? 1 : 0.4,
                background: 'transparent',
                border: `1px solid ${SK.textSecondary}`,
                borderRadius: 0,
                color: SK.textSecondary,
                fontFamily: bodyFont,
              }}
            >
              <Dice5 style={{ width: 18, height: 18 }} />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span style={{ fontSize: 9, color: SK.textMuted, lineHeight: 1, marginBottom: 2, letterSpacing: '0.08em' }}>REROLL</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: SK.textSecondary, lineHeight: 1 }}>{rerollsLeft}</span>
              </div>
            </button>
          )}
        </div>

        {/* ─── Dev Mode Banner ─── */}
        {isDevMode && (
          <div style={{
            background: `${SK.orange}15`,
            borderBottom: `1px solid ${SK.orange}40`,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={14} style={{ color: SK.orange, animation: 'spin 3s linear infinite' }} />
              <span style={{ color: SK.orange, fontSize: 12, letterSpacing: '0.05em', fontWeight: 600 }}>DEV MODE</span>
            </div>
            <span style={{ color: SK.orangeLight, fontSize: 10 }}>{options.length} skills</span>
          </div>
        )}

        {/* ─── Auto Hunt Banner ─── */}
        {!isDevMode && isAutoHunt && autoSelectTimer !== null && (
          <div style={{
            borderBottom: `1px solid ${isHoveringOptions ? `${SK.orange}40` : `${SK.green}40`}`,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s',
            background: isHoveringOptions ? `${SK.orange}12` : `${SK.green}12`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={14} style={{ color: isHoveringOptions ? SK.orange : SK.green }} />
              <span style={{
                fontSize: 12,
                letterSpacing: '0.08em',
                fontWeight: 600,
                color: isHoveringOptions ? SK.orange : SK.green,
              }}>
                {isHoveringOptions ? 'PAUSED' : 'AUTO SELECT'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Linear progress bar */}
              <div style={{
                width: 64,
                height: 4,
                background: SK.cardBg,
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  background: isHoveringOptions ? SK.orange : SK.accent,
                  width: `${timerPct}%`,
                  transition: isHoveringOptions ? 'none' : 'width 1s linear',
                }} />
              </div>
              <span style={{
                fontFamily: headingFont,
                fontSize: 16,
                fontWeight: 700,
                minWidth: 16,
                textAlign: 'center',
                color: isHoveringOptions ? SK.orange : SK.accent,
              }}>
                {autoSelectTimer}
              </span>
            </div>
          </div>
        )}

        {/* ─── Options List ─── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 16,
            background: SK.bgWarm,
          }}
          onMouseEnter={() => setIsHoveringOptions(true)}
          onMouseLeave={() => setIsHoveringOptions(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            {options.map((opt, idx) => {
              const isUltimateUpgrade = opt.isUltimate;
              const categoryColor = getCategoryColor(opt.type);

              return (
                <button
                  key={opt.type + idx}
                  data-testid={`levelup-option-${idx}`}
                  onClick={() => onSelect(opt.type)}
                  style={{
                    position: 'relative',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'stretch',
                    transition: 'all 0.15s',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: isUltimateUpgrade
                      ? `${SK.gold}12`
                      : opt.isGoldReward
                        ? `${SK.green}10`
                        : SK.cardBg,
                    border: isUltimateUpgrade
                      ? `1px solid ${SK.gold}60`
                      : opt.isGoldReward
                        ? `1px solid ${SK.green}40`
                        : `1px solid ${SK.border}`,
                    borderRadius: 0,
                    clipPath: apexClip.md,
                    overflow: 'hidden',
                    fontFamily: bodyFont,
                  }}
                >
                  {/* Category color stripe (left) */}
                  <div style={{
                    width: 4,
                    flexShrink: 0,
                    background: categoryColor,
                  }} />

                  {/* Main content area */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 12,
                  }}>
                    {/* Left: Icon + Level */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        border: `1px solid ${opt.color}80`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isUltimateUpgrade ? `${SK.gold}20` : SK.bg,
                        clipPath: apexClip.sm,
                      }}>
                        <SkillIcon type={opt.type} size={24} style={{ color: opt.color }} />
                      </div>
                      {isUltimateUpgrade && (
                        <Crown style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          color: SK.gold,
                          width: 16,
                          height: 16,
                        }} />
                      )}
                      {opt.isNew && (
                        <div style={{
                          position: 'absolute',
                          top: -4,
                          left: -4,
                          background: SK.gold,
                          color: SK.bg,
                          fontSize: 8,
                          fontWeight: 700,
                          paddingLeft: 4,
                          paddingRight: 4,
                          paddingTop: 1,
                          paddingBottom: 1,
                          letterSpacing: '0.05em',
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
                          background: SK.bg,
                          border: `1px solid ${SK.border}`,
                          paddingLeft: 6,
                          paddingRight: 6,
                          paddingTop: 2,
                          paddingBottom: 2,
                          fontSize: 9,
                        }}>
                          <span style={{ color: SK.textMuted }}>{opt.currentLevel}</span>
                          <ArrowRight size={8} style={{ color: SK.textMuted }} />
                          <span style={{ color: isUltimateUpgrade ? SK.gold : SK.accent, fontWeight: 700 }}>{opt.nextLevel}</span>
                        </div>
                      )}
                    </div>

                    {/* Center: Name + Description + Stats */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{
                          fontFamily: headingFont,
                          fontSize: 15,
                          letterSpacing: '0.03em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                          color: opt.color,
                        }}>
                          {opt.name}
                        </span>
                      </div>
                      <p style={{
                        color: SK.textMuted,
                        fontSize: 11,
                        lineHeight: 1.4,
                        margin: 0,
                        marginBottom: 4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {opt.description}
                      </p>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: isUltimateUpgrade ? SK.gold : SK.accent,
                        letterSpacing: '0.03em',
                      }}>
                        {opt.statChanges}
                      </span>
                    </div>

                    {/* Right: Keyboard hint */}
                    <div style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      background: SK.bg,
                      border: `1px solid ${SK.border}`,
                      fontSize: 14,
                      color: SK.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontFamily: headingFont,
                    }}>
                      {idx + 1}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div style={{
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 8,
          paddingBottom: 8,
          textAlign: 'center',
          color: SK.textMuted,
          fontSize: 10,
          background: SK.cardBg,
          borderTop: `1px solid ${SK.border}`,
          letterSpacing: '0.05em',
        }}>
          Press 1, 2, 3, 4 for quick select
        </div>

      </div>
    </div>
  );
}

const MatrixLevelUp = memo(MatrixLevelUpInner);
export default MatrixLevelUp;
