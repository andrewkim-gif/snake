'use client';

/**
 * MatrixLevelUp.tsx - v37 Phase 6: Level Up Modal Redesign + Economy Feedback
 *
 * Redesigned features:
 * - Dual combat stats (DMG, SPD, RNG) + economy effects (Gold/kill, Gold/min)
 * - Card type visual distinction: normal (gray), evolution (blue+glow), ultimate (gold+crown)
 * - Category color top stripe (STEEL=#EF4444 etc)
 * - SkillIconSVG integration
 * - Improved auto-select with economy ROI factor
 * - BEST badge on recommended card
 *
 * Design system: SK palette, Chakra Petch heading, Space Grotesk body, border-radius: 0
 */

import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { WEAPON_DATA, MAX_ACTIVE_SKILLS, GOLD_REWARD } from '@/lib/matrix/constants';
import type { WeaponType } from '@/lib/matrix/types';
import {
  Code2, Keyboard, Globe, GitCommit, Server, FileCode, Link2, Radio,
  Download, Sparkles, Layers, RefreshCw, Database, ShieldCheck, Bug,
  GripHorizontal, Target, Dice5, Crown, ArrowRight, Magnet, Bot,
  Diamond, GitFork, AlertTriangle, Focus, Coins, Shield, ScrollText, Gauge,
  Zap, Settings, Star, TrendingUp,
} from 'lucide-react';
import { soundManager } from '@/lib/matrix/utils/audio';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';
import { getWeaponCategory } from '@/lib/matrix/config/skills/progressive-tree.config';
import {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_DISPLAY_COLORS,
} from '@/lib/matrix/config/skills/category-display.config';
import { SkillIconSVG } from './SkillIconSVG';

// ============================================
// PLACEHOLDER: Category colors
// ============================================

/** v37: Use centralized category display colors */
function getCategoryColor(weaponType: WeaponType): string {
  const cat = getWeaponCategory(weaponType);
  if (cat && CATEGORY_DISPLAY_COLORS[cat as keyof typeof CATEGORY_DISPLAY_COLORS]) {
    return CATEGORY_DISPLAY_COLORS[cat as keyof typeof CATEGORY_DISPLAY_COLORS];
  }
  return SK.textMuted;
}

function getCategoryName(weaponType: WeaponType): string {
  const cat = getWeaponCategory(weaponType);
  if (cat && CATEGORY_DISPLAY_NAMES[cat as keyof typeof CATEGORY_DISPLAY_NAMES]) {
    return CATEGORY_DISPLAY_NAMES[cat as keyof typeof CATEGORY_DISPLAY_NAMES];
  }
  return '';
}

/** Passives that have economy effects (string set, not WeaponType constrained) */
const ECONOMY_PASSIVES = new Set([
  'gold_reward', 'nation_loyalty', 'aggregator', 'oracle', 'focus', 'overclock',
]);

// ============================================
// PLACEHOLDER: Interfaces
// ============================================

/**
 * LevelUpOption - kept for backward compat with MatrixApp
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
  /** v37 Phase 6: current gold for economy display */
  currentGold?: number;
  /** v37 Phase 6: player kill count for ROI estimation */
  playerKills?: number;
  /** v37 Phase 6: match elapsed time (seconds) for Gold/min calc */
  matchTime?: number;
}

/** Card type for visual distinction */
type CardType = 'normal' | 'evolution' | 'ultimate' | 'economy' | 'synergy';

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
  /** v37 Phase 6: card visual type */
  cardType: CardType;
  /** v37 Phase 6: combat stat breakdown */
  combatStats: { label: string; value: string }[];
  /** v37 Phase 6: economy effect description */
  economyEffect: string;
  /** v37 Phase 6: estimated Gold/min contribution */
  estimatedGoldPerMin: number;
  /** v37 Phase 6: is best recommended */
  isBest: boolean;
  /** Is evolution threshold */
  isEvolution: boolean;
}

// ============================================
// PLACEHOLDER: Legacy WEAPON_ICONS
// ============================================

/** @deprecated Use `<SkillIconSVG type={...} />` component instead */
export const WEAPON_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  whip: Code2, punch: Keyboard, sword: GripHorizontal, bible: FileCode,
  garlic: Bug, pool: Shield, wand: Globe, knife: GitCommit,
  axe: Server, bow: Target, ping: Radio, shard: Diamond, fork: GitFork,
  lightning: Sparkles, beam: Layers, laser: RefreshCw, phishing: Database,
  stablecoin: ShieldCheck, bridge: Link2, airdrop: Download, genesis: AlertTriangle,
  aggregator: Magnet, oracle: ScrollText, focus: Focus, overclock: Gauge,
  gold_reward: Coins,
};

// ============================================
// PLACEHOLDER: Economy helpers
// ============================================

/** Compute combat stat changes between levels */
function getCombatStats(
  type: WeaponType,
  currentLevel: number,
  nextLevel: number,
): { label: string; value: string }[] {
  const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
  if (!data) return [];
  const prev = data.stats[currentLevel - 1];
  const next = data.stats[nextLevel - 1];
  if (!prev || !next) return [];

  const stats: { label: string; value: string }[] = [];
  if (next.damage !== prev.damage) {
    const diff = next.damage - prev.damage;
    stats.push({ label: 'DMG', value: `${diff > 0 ? '+' : ''}${Math.round(diff)}` });
  }
  if (next.cooldown !== prev.cooldown) {
    const spdPct = Math.round((1 - next.cooldown / prev.cooldown) * 100);
    if (spdPct !== 0) stats.push({ label: 'SPD', value: `${spdPct > 0 ? '+' : ''}${spdPct}%` });
  }
  if (next.area !== prev.area) {
    const rngPct = Math.round(((next.area - prev.area) / Math.max(prev.area, 1)) * 100);
    if (rngPct !== 0) stats.push({ label: 'RNG', value: `${rngPct > 0 ? '+' : ''}${rngPct}%` });
  }
  if (next.pierce !== prev.pierce) {
    stats.push({ label: 'PRC', value: `+${next.pierce - prev.pierce}` });
  }
  if (next.amount !== prev.amount) {
    stats.push({ label: 'AMT', value: `+${next.amount - prev.amount}` });
  }
  return stats;
}

/** Compute legacy stat changes string */
function getStatChangesStr(type: WeaponType, currentLevel: number, nextLevel: number): string {
  const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
  if (!data) return '';
  const prev = data.stats[currentLevel - 1];
  const next = data.stats[nextLevel - 1];
  if (!prev) return 'System initialized';
  if (next.isEvolved && !prev.isEvolved) return 'EVOLUTION';
  if (next.isUltimate && !prev.isUltimate) return 'ULTIMATE AWAKENING';

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
}

/** Estimate economy effect for a weapon at given level */
function getEconomyEffect(type: WeaponType, nextLevel: number): string {
  // Tier-based gold bonuses (v37 design doc)
  if (nextLevel >= 20) return 'Kill Gold +50%';
  if (nextLevel >= 11) return 'Kill Gold +25%';
  if (nextLevel >= 6) return 'Kill Gold +10%';
  // Economy passives
  if (type === 'gold_reward') return 'All Gold +20%/Lv';
  if ((type as string) === 'nation_loyalty') return 'Nation Score +10%/Lv';
  if (type === 'aggregator') return 'Pickup radius +15%';
  if (type === 'oracle') return 'Rare drop +8%';
  if (type === 'focus') return 'Crit Gold +50%';
  if (type === 'overclock') return 'Area clear XP bonus';
  return '';
}

/** Estimate Gold/min contribution of a weapon upgrade */
function estimateGoldPerMin(
  type: WeaponType,
  nextLevel: number,
  killsPerMin: number,
): number {
  const baseGoldPerKill = 25;
  // Higher tier = better gold multiplier
  let goldMultiplier = 1.0;
  if (nextLevel >= 20) goldMultiplier = 1.5;
  else if (nextLevel >= 11) goldMultiplier = 1.25;
  else if (nextLevel >= 6) goldMultiplier = 1.1;

  // Economy passives get direct gold benefit
  if (type === 'gold_reward') goldMultiplier += 0.2 * nextLevel;
  if (type === 'focus') goldMultiplier += 0.05 * nextLevel;

  // DPS contribution from damage/cooldown improvement
  const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
  if (data && nextLevel > 0 && nextLevel <= data.stats.length) {
    const stats = data.stats[nextLevel - 1];
    const dpsScore = stats.damage / Math.max(stats.cooldown, 0.1);
    // Higher DPS = more kills = more gold
    return (dpsScore * 0.1 + baseGoldPerKill * killsPerMin * (goldMultiplier - 1));
  }
  return baseGoldPerKill * killsPerMin * (goldMultiplier - 1);
}

/** Determine card visual type */
function getCardType(opt: { isUltimate: boolean; isGoldReward?: boolean; statChanges: string; type: WeaponType }): CardType {
  if (opt.isUltimate) return 'ultimate';
  if (opt.statChanges === 'EVOLUTION') return 'evolution';
  if (opt.isGoldReward || ECONOMY_PASSIVES.has(opt.type)) return 'economy';
  return 'normal';
}

// ============================================
// PLACEHOLDER: Auto select logic
// ============================================

/**
 * v37 Phase 6: Improved auto-select with economy ROI factor
 * Priority:
 *  1. Ultimate (Tier 4) — instant pick
 *  2. Evolution (Tier 3) — instant pick
 *  3. Highest ROI among owned weapons (Gold/min increase)
 *  4. New weapon with best DPS x Gold multiplier
 *  5. Passive (combat > economy, but if gold < 500 prefer economy)
 */
function autoSelectBestWithEconomy(
  options: UpgradeOption[],
  currentGold: number,
): UpgradeOption | undefined {
  if (options.length === 0) return undefined;

  // 1. Ultimate
  const ultimate = options.find(o => o.isUltimate);
  if (ultimate) return ultimate;

  // 2. Evolution
  const evolution = options.find(o => o.isEvolution);
  if (evolution) return evolution;

  // 3. Best ROI (Gold/min based)
  const nonGoldReward = options.filter(o => !o.isGoldReward);
  if (nonGoldReward.length > 0) {
    // Prefer economy passives when gold is low
    if (currentGold < 500) {
      const economyPassive = nonGoldReward.find(o => o.cardType === 'economy');
      if (economyPassive) return economyPassive;
    }

    // Otherwise pick highest estimated Gold/min
    const sorted = [...nonGoldReward].sort((a, b) => {
      // Prefer higher level weapons (they're closer to evolution)
      const levelWeight = (b.currentLevel - a.currentLevel) * 5;
      // Prefer higher Gold/min
      const goldWeight = b.estimatedGoldPerMin - a.estimatedGoldPerMin;
      return levelWeight + goldWeight;
    });
    if (sorted[0]) return sorted[0];
  }

  return options[0];
}

// ============================================
// PLACEHOLDER: Component
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
  currentGold = 0,
  playerKills = 0,
  matchTime = 0,
}: MatrixLevelUpProps) {
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [autoSelectTimer, setAutoSelectTimer] = useState<number | null>(null);
  const [isHoveringOptions, setIsHoveringOptions] = useState(false);

  // Kill rate estimation for Gold/min calc
  const killsPerMin = useMemo(() => {
    if (matchTime <= 0) return 2; // default estimate
    return Math.max(1, (playerKills / matchTime) * 60);
  }, [playerKills, matchTime]);

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
          cardType: 'normal' as CardType,
          combatStats: [],
          economyEffect: '',
          estimatedGoldPerMin: 0,
          isBest: false,
          isEvolution: false,
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
      if (currentLevel >= data.stats.length) return;

      const nextLevel = currentLevel + 1;
      let statChanges = '';
      let description = data.desc;
      const nextStats = data.stats[nextLevel - 1];
      const isEvolved = nextStats.isEvolved || false;
      const isUltimateFlag = nextStats.isUltimate || false;
      let isEvolutionThreshold = false;

      if (currentLevel === 0) {
        statChanges = 'NEW EQUIPMENT';
        description = data.desc;
      } else if (isEvolved && (!currentWeapons[type] || !WEAPON_DATA[type as keyof typeof WEAPON_DATA]?.stats[currentLevel - 1]?.isEvolved)) {
        statChanges = 'EVOLUTION';
        description = `Evolved: ${nextStats.evolvedName}`;
        isEvolutionThreshold = true;
      } else if (isUltimateFlag && (!currentWeapons[type] || !WEAPON_DATA[type as keyof typeof WEAPON_DATA]?.stats[currentLevel - 1]?.isUltimate)) {
        statChanges = 'ULTIMATE AWAKENING';
        description = `Ultimate: ${nextStats.evolvedName}`;
      } else {
        statChanges = getStatChangesStr(type, currentLevel, nextLevel);
      }

      const combatStats = currentLevel > 0 ? getCombatStats(type, currentLevel, nextLevel) : [];
      const economyEffect = getEconomyEffect(type, nextLevel);
      const estGoldPerMin = estimateGoldPerMin(type, nextLevel, killsPerMin);

      const optData: UpgradeOption = {
        type,
        isNew: currentLevel === 0,
        currentLevel,
        nextLevel,
        name: nextStats.evolvedName || data.name,
        description,
        statChanges,
        color: isUltimateFlag ? SK.gold : (isEvolved ? '#38bdf8' : data.color),
        isUltimate: isUltimateFlag,
        isMax: nextLevel === 20,
        cardType: 'normal',
        combatStats,
        economyEffect,
        estimatedGoldPerMin: estGoldPerMin,
        isBest: false,
        isEvolution: isEvolutionThreshold,
      };
      optData.cardType = getCardType(optData);
      possibleUpgrades.push(optData);
    });

    if (possibleUpgrades.length === 0) {
      setOptions([{
        type: 'gold_reward' as WeaponType,
        isNew: false, currentLevel: 0, nextLevel: 0,
        name: GOLD_REWARD.name, description: GOLD_REWARD.desc,
        statChanges: `SCORE +${GOLD_REWARD.value} | HP +${GOLD_REWARD.heal}`,
        color: GOLD_REWARD.color, isUltimate: false, isMax: false, isGoldReward: true,
        cardType: 'economy', combatStats: [], economyEffect: 'Score + HP recovery',
        estimatedGoldPerMin: 0, isBest: true, isEvolution: false,
      }]);
    } else {
      let selected: UpgradeOption[];
      if (isDevMode) {
        selected = possibleUpgrades.sort((a, b) => {
          if (a.currentLevel > 0 && b.currentLevel === 0) return -1;
          if (a.currentLevel === 0 && b.currentLevel > 0) return 1;
          if (a.currentLevel !== b.currentLevel) return b.currentLevel - a.currentLevel;
          return a.name.localeCompare(b.name);
        });
      } else {
        // Fisher-Yates shuffle (균등 분포)
        const arr = [...possibleUpgrades];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        selected = arr.slice(0, 4);
      }
      // Mark best option
      const best = autoSelectBestWithEconomy(selected, currentGold);
      selected.forEach(o => { o.isBest = (o === best); });
      setOptions(selected);
    }
  }, [currentWeapons, playerClass, isDevMode, fallbackOptions, killsPerMin, currentGold]);

  useEffect(() => { generateOptions(); }, [generateOptions]);

  // ─── Auto Hunt timer ───
  const [autoTimerInitialized, setAutoTimerInitialized] = useState(false);

  useEffect(() => {
    if (isDevMode) { setAutoSelectTimer(null); setAutoTimerInitialized(false); return; }
    if (isAutoHunt && options.length > 0 && !autoTimerInitialized) {
      setAutoTimerInitialized(true);
      setAutoSelectTimer(5);
    }
  }, [isAutoHunt, options.length, isDevMode, autoTimerInitialized]);

  useEffect(() => {
    if (isDevMode || !isAutoHunt || autoSelectTimer === null || options.length === 0 || isHoveringOptions) return;
    const intervalMs = 1000 / timeScale;
    const timer = setInterval(() => {
      setAutoSelectTimer(prev => {
        if (prev === null || prev <= 1) { clearInterval(timer); return 0; }
        soundManager.playSFX('click');
        return prev - 1;
      });
    }, intervalMs);
    return () => { clearInterval(timer); };
  }, [isAutoHunt, autoSelectTimer, timeScale, isDevMode, options.length, isHoveringOptions]);

  // Auto select when timer hits 0
  useEffect(() => {
    if (isDevMode || !isAutoHunt || autoSelectTimer !== 0 || options.length === 0) return;
    const bestOption = autoSelectBestWithEconomy(options, currentGold);
    if (bestOption) onSelect(bestOption.type);
  }, [autoSelectTimer, isAutoHunt, isDevMode, options, onSelect, currentGold]);

  // ─── Keyboard shortcuts (1-4) ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < options.length) onSelect(options[idx].type);
      const numpadIdx = parseInt(e.code.replace('Numpad', '')) - 1;
      if (!isNaN(numpadIdx) && numpadIdx >= 0 && numpadIdx < options.length) onSelect(options[numpadIdx].type);
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

  const timerPct = autoSelectTimer !== null ? (autoSelectTimer / 5) * 100 : 0;

  // ─── Card border/bg by type ───
  function getCardStyle(opt: UpgradeOption): { bg: string; border: string; glow: string } {
    switch (opt.cardType) {
      case 'ultimate':
        return {
          bg: `${SK.gold}12`,
          border: `1px solid ${SK.gold}60`,
          glow: `0 0 12px ${SK.gold}30`,
        };
      case 'evolution':
        return {
          bg: `#38bdf815`,
          border: `1px solid #38bdf860`,
          glow: `0 0 10px #38bdf830`,
        };
      case 'economy':
        return {
          bg: `${SK.gold}08`,
          border: `1px solid ${SK.gold}30`,
          glow: 'none',
        };
      default:
        return {
          bg: SK.cardBg,
          border: `1px solid ${SK.border}`,
          glow: 'none',
        };
    }
  }

  return (
    <div data-testid="levelup-modal" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: OVERLAY.bg, backdropFilter: OVERLAY.blur,
      WebkitBackdropFilter: OVERLAY.blur, padding: 8, fontFamily: bodyFont,
    }}>
      <div style={{
        width: '100%', maxWidth: 540, background: SK.bg,
        border: `1px solid ${SK.border}`, borderRadius: 0,
        display: 'flex', flexDirection: 'column', maxHeight: '95vh', overflow: 'hidden',
      }}>

        {/* ─── Header ─── */}
        <div style={{
          background: SK.cardBg, paddingLeft: 20, paddingRight: 20,
          paddingTop: 14, paddingBottom: 14, borderBottom: `1px solid ${SK.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, border: `2px solid ${SK.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: SK.accentBg, clipPath: apexClip.sm,
            }}>
              <Zap size={20} style={{ color: SK.accent }} />
            </div>
            <div>
              <h2 style={{
                fontFamily: headingFont, fontSize: 20, fontWeight: 700,
                letterSpacing: '0.08em', color: SK.accent, margin: 0,
              }}>LEVEL UP</h2>
              <p style={{ color: SK.textMuted, fontSize: 11, margin: 0 }}>
                Choose Your Upgrade
              </p>
            </div>
          </div>
          {onReroll && (
            <button onClick={handleRerollClick}
              disabled={rerollsLeft <= 0 || (options[0]?.isGoldReward ?? false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, minHeight: 48,
                paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                transition: 'all 0.2s',
                cursor: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? 'pointer' : 'not-allowed',
                opacity: rerollsLeft > 0 && !(options[0]?.isGoldReward) ? 1 : 0.4,
                background: 'transparent', border: `1px solid ${SK.textSecondary}`,
                borderRadius: 0, color: SK.textSecondary, fontFamily: bodyFont,
              }}>
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
            background: `${SK.orange}15`, borderBottom: `1px solid ${SK.orange}40`,
            paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
            paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'all 0.2s',
            background: isHoveringOptions ? `${SK.orange}12` : `${SK.green}12`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={14} style={{ color: isHoveringOptions ? SK.orange : SK.green }} />
              <span style={{ fontSize: 12, letterSpacing: '0.08em', fontWeight: 600,
                color: isHoveringOptions ? SK.orange : SK.green }}>
                {isHoveringOptions ? 'PAUSED' : 'AUTO SELECT'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 64, height: 4, background: SK.cardBg, border: `1px solid ${SK.border}`, borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: isHoveringOptions ? SK.orange : SK.accent, width: `${timerPct}%`, transition: isHoveringOptions ? 'none' : 'width 1s linear' }} />
              </div>
              <span style={{ fontFamily: headingFont, fontSize: 16, fontWeight: 700, minWidth: 16, textAlign: 'center', color: isHoveringOptions ? SK.orange : SK.accent }}>
                {autoSelectTimer}
              </span>
            </div>
          </div>
        )}

        {/* ─── Options List ─── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16, background: SK.bgWarm }}
          onMouseEnter={() => setIsHoveringOptions(true)}
          onMouseLeave={() => setIsHoveringOptions(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            {options.map((opt, idx) => {
              const categoryColor = getCategoryColor(opt.type);
              const categoryName = getCategoryName(opt.type);
              const cardStyle = getCardStyle(opt);

              return (
                <button key={opt.type + idx} data-testid={`levelup-option-${idx}`}
                  onClick={() => onSelect(opt.type)}
                  style={{
                    position: 'relative', padding: 0, display: 'flex', flexDirection: 'column',
                    transition: 'all 0.15s', pointerEvents: 'auto', cursor: 'pointer', textAlign: 'left',
                    background: cardStyle.bg, border: cardStyle.border, borderRadius: 0,
                    clipPath: apexClip.md, overflow: 'hidden', fontFamily: bodyFont,
                    boxShadow: cardStyle.glow,
                  }}>

                  {/* Category color TOP stripe */}
                  <div style={{ width: '100%', height: 3, background: categoryColor, flexShrink: 0 }} />

                  {/* BEST badge */}
                  {opt.isBest && !isDevMode && (
                    <div style={{
                      position: 'absolute', top: 6, right: 40, zIndex: 5,
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: SK.gold, color: SK.bg, fontSize: 9, fontWeight: 800,
                      paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                      letterSpacing: '0.08em', fontFamily: headingFont,
                    }}>
                      <Star size={9} /> BEST
                    </div>
                  )}

                  {/* Main content area */}
                  <div style={{ display: 'flex', alignItems: 'stretch', padding: 12, gap: 12 }}>

                    {/* Left: Icon + Level */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 56, height: 56,
                        border: opt.cardType === 'ultimate' ? `2px solid ${SK.gold}80`
                          : opt.cardType === 'evolution' ? `2px solid #38bdf880`
                          : `1px solid ${opt.color}60`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: opt.cardType === 'ultimate' ? `${SK.gold}20`
                          : opt.cardType === 'evolution' ? '#38bdf815'
                          : SK.bg,
                        clipPath: apexClip.sm,
                      }}>
                        <SkillIconSVG type={opt.type} size={36} level={opt.nextLevel} color={opt.color} />
                      </div>
                      {opt.isUltimate && (
                        <Crown style={{ position: 'absolute', top: -8, right: -8, color: SK.gold, width: 16, height: 16 }} />
                      )}
                      {opt.isNew && (
                        <div style={{
                          position: 'absolute', top: -4, left: -4, background: SK.gold, color: SK.bg,
                          fontSize: 8, fontWeight: 700, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
                          letterSpacing: '0.05em',
                        }}>NEW</div>
                      )}
                      {!opt.isGoldReward && (
                        <div style={{
                          position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                          display: 'flex', alignItems: 'center', gap: 2, background: SK.bg,
                          border: `1px solid ${SK.border}`, paddingLeft: 6, paddingRight: 6,
                          paddingTop: 2, paddingBottom: 2, fontSize: 9,
                        }}>
                          <span style={{ color: SK.textMuted }}>{opt.currentLevel}</span>
                          <ArrowRight size={8} style={{ color: SK.textMuted }} />
                          <span style={{ color: opt.isUltimate ? SK.gold : SK.accent, fontWeight: 700 }}>{opt.nextLevel}</span>
                        </div>
                      )}
                    </div>

                    {/* Center: Name + Dual stats */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* Name + category */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: headingFont, fontSize: 15, letterSpacing: '0.03em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: 700, color: opt.color,
                        }}>{opt.name}</span>
                        {categoryName && (
                          <span style={{
                            fontSize: 8, fontWeight: 700, color: categoryColor, letterSpacing: '0.08em',
                            background: `${categoryColor}15`, paddingLeft: 4, paddingRight: 4,
                            paddingTop: 1, paddingBottom: 1, flexShrink: 0,
                          }}>{categoryName}</span>
                        )}
                      </div>

                      {/* Description */}
                      <p style={{
                        color: SK.textMuted, fontSize: 10, lineHeight: 1.3, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>{opt.description}</p>

                      {/* Dual stat display */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {/* COMBAT section */}
                        {opt.combatStats.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 8, color: SK.textMuted, letterSpacing: '0.1em', fontWeight: 700 }}>COMBAT</span>
                            {opt.combatStats.slice(0, 3).map((s, si) => (
                              <span key={si} style={{
                                fontSize: 10, fontWeight: 700, fontFamily: headingFont,
                                color: opt.isUltimate ? SK.gold : SK.accent,
                              }}>{s.label} {s.value}</span>
                            ))}
                          </div>
                        )}
                        {/* ECONOMY section */}
                        {opt.economyEffect && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <TrendingUp size={10} style={{ color: SK.gold, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: SK.gold, fontWeight: 600 }}>{opt.economyEffect}</span>
                          </div>
                        )}
                      </div>

                      {/* Stat changes label (evolution/ultimate) */}
                      {(opt.statChanges === 'EVOLUTION' || opt.statChanges === 'ULTIMATE AWAKENING' || opt.statChanges === 'NEW EQUIPMENT') && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: opt.isUltimate ? SK.gold : opt.isEvolution ? '#38bdf8' : SK.accent,
                          letterSpacing: '0.05em',
                        }}>{opt.statChanges}</span>
                      )}
                    </div>

                    {/* Right: Keyboard hint */}
                    <div style={{
                      flexShrink: 0, width: 28, height: 28, background: SK.bg,
                      border: `1px solid ${SK.border}`, fontSize: 14, color: SK.textMuted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontFamily: headingFont, alignSelf: 'flex-start',
                    }}>{idx + 1}</div>
                  </div>

                  {/* Evolution gauge bar (for non-gold-reward) */}
                  {!opt.isGoldReward && opt.nextLevel < 20 && (
                    <div style={{
                      height: 2, background: SK.cardBg, marginLeft: 12, marginRight: 12, marginBottom: 8,
                    }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, (opt.nextLevel / 20) * 100)}%`,
                        background: `linear-gradient(to right, ${categoryColor}60, ${categoryColor})`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div style={{
          paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
          textAlign: 'center', color: SK.textMuted, fontSize: 10,
          background: SK.cardBg, borderTop: `1px solid ${SK.border}`, letterSpacing: '0.05em',
        }}>
          Press 1, 2, 3, 4 for quick select
        </div>
      </div>
    </div>
  );
}

const MatrixLevelUp = memo(MatrixLevelUpInner);
export default MatrixLevelUp;
