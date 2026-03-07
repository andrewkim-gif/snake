'use client';

/**
 * LevelUpOverlay — v14 Phase 3: 3-choice upgrade card UI
 * Supports: weapon, passive, synergy_hint, tome (legacy), ability (legacy)
 * MC dark panel style, 5-second timeout progress bar
 * Keyboard [1][2][3] selection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { LevelUpPayload, UpgradeChoice, WeaponType } from '@agent-survivor/shared';
import { MC, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';

// ─── Weapon icon labels ───
const WEAPON_ICONS: Record<string, string> = {
  bonk_mallet: 'BNK', chain_bolt: 'CHN', flame_ring: 'FLM', frost_shards: 'ICE',
  shadow_strike: 'SHD', thunder_clap: 'THN', venom_cloud: 'VNM', crystal_shield: 'CRY',
  gravity_bomb: 'GRV', soul_drain: 'SOL',
};

// ─── Passive icon labels ───
const PASSIVE_ICONS: Record<string, string> = {
  vigor: 'VIG', swift: 'SWF', fury: 'FRY', iron_skin: 'ISK', magnet: 'MAG',
  fortune: 'FOR', vitality: 'VIT', precision: 'PRC', blast: 'BLT', haste: 'HST',
};

// ─── Legacy Tome/Ability icons ───
const TOME_ICONS: Record<string, string> = {
  xp: 'XP', speed: 'SPD', damage: 'DMG', armor: 'ARM',
  magnet: 'MAG', luck: 'LCK', regen: 'REG', cursed: 'CRS',
};
const ABILITY_ICONS: Record<string, string> = {
  venom_aura: 'VNM', shield_burst: 'SHL', lightning_strike: 'LTN',
  speed_dash: 'DSH', mass_drain: 'DRN', gravity_well: 'GRV',
};

// ─── Color mapping by choice type ───
const WEAPON_COLORS: Record<string, string> = {
  bonk_mallet: '#C08040', chain_bolt: '#00BFFF', flame_ring: '#FF4500', frost_shards: '#87CEEB',
  shadow_strike: '#4B0082', thunder_clap: '#FFD700', venom_cloud: '#32CD32', crystal_shield: '#00CED1',
  gravity_bomb: '#8B0000', soul_drain: '#FF6347',
};

const PASSIVE_COLORS: Record<string, string> = {
  vigor: '#FF5555', swift: '#55FFFF', fury: '#FF4444', iron_skin: '#AAAAAA', magnet: '#FFFF55',
  fortune: '#55FF55', vitality: '#FF69B4', precision: '#FFD700', blast: '#FF8C00', haste: '#00FF7F',
};

const TYPE_COLORS: Record<string, string> = {
  xp: '#FFAA00', speed: '#55FFFF', damage: '#FF5555', armor: '#AAAAAA',
  magnet: '#FFFF55', luck: '#55FF55', regen: '#55FF55', cursed: '#AA00AA',
  venom_aura: '#55FF55', shield_burst: '#5555FF', lightning_strike: '#FFFF55',
  speed_dash: '#55FFFF', mass_drain: '#FF55FF', gravity_well: '#AA00AA',
};

interface LevelUpOverlayProps {
  levelUp: LevelUpPayload;
  onChoose: (choiceId: string) => void;
}

export function LevelUpOverlay({ levelUp, onChoose }: LevelUpOverlayProps) {
  const tGame = useTranslations('game');
  const { level, choices, timeoutTicks } = levelUp;
  const timeoutSeconds = timeoutTicks / 20;
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    startTimeRef.current = performance.now();
    const animate = () => {
      const secs = (performance.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs < timeoutSeconds) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timeoutSeconds]);

  // Keyboard [1][2][3] selection
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < choices.length) {
        handleChoose(choices[idx].id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [choices]);

  const progress = Math.min(elapsed / timeoutSeconds, 1);

  const handleChoose = useCallback((choiceId: string) => {
    cancelAnimationFrame(rafRef.current);
    onChoose(choiceId);
  }, [onChoose]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: 45, fontFamily: bodyFont, gap: '1rem',
    }}>
      <div style={{
        fontFamily: pixelFont, fontSize: '1rem', color: MC.textGold,
        textShadow: '2px 2px 0 #553300', letterSpacing: '0.08em',
      }}>
        {tGame('levelUp', { level })}
      </div>
      <div style={{
        fontFamily: pixelFont, fontSize: '0.4rem', color: MC.textSecondary, letterSpacing: '0.05em',
      }}>
        {tGame('chooseUpgrade')}
      </div>

      <div style={{
        display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: '700px', padding: '0 0.5rem',
      }}>
        {choices.map((choice, idx) => (
          <UpgradeCard
            key={choice.id}
            choice={choice}
            index={idx}
            hovered={hoveredIdx === idx}
            onHover={() => setHoveredIdx(idx)}
            onLeave={() => setHoveredIdx(null)}
            onClick={() => handleChoose(choice.id)}
          />
        ))}
      </div>

      {/* 5-second timeout progress bar */}
      <div style={{
        width: '300px', maxWidth: '80vw', height: '6px',
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.5rem',
      }}>
        <div style={{
          width: `${(1 - progress) * 100}%`, height: '100%',
          backgroundColor: progress > 0.7 ? MC.textRed : MC.textGold,
          transition: 'background-color 300ms', borderRadius: '3px',
        }} />
      </div>
      <div style={{
        fontFamily: pixelFont, fontSize: '0.35rem',
        color: progress > 0.7 ? MC.textRed : MC.textGray,
      }}>
        {Math.max(0, timeoutSeconds - elapsed).toFixed(1)}s
      </div>
    </div>
  );
}

// ─── Upgrade Card Component ───

function UpgradeCard({
  choice, index, hovered, onHover, onLeave, onClick,
}: {
  choice: UpgradeChoice; index: number; hovered: boolean;
  onHover: () => void; onLeave: () => void; onClick: () => void;
}) {
  const tGame = useTranslations('game');

  // Determine card styling based on type
  const { icon, accentColor, badgeText, badgeColor, isSynergyHint } = getCardMeta(choice, tGame);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onTouchStart={onHover}
      onTouchEnd={onLeave}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
        width: '180px', minWidth: '140px', flex: '1 1 140px', maxWidth: '200px',
        padding: '1rem 0.8rem', minHeight: '48px',
        backgroundColor: hovered ? 'rgba(255,255,255,0.12)' : MC.panelBg,
        boxShadow: mcPanelShadow(),
        border: isSynergyHint
          ? `2px solid ${MC.textGold}`  // Gold border for synergy hints
          : hovered ? `2px solid ${accentColor}` : `2px solid ${MC.panelBorderDark}`,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Key hint */}
      <div style={{
        fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGray,
        position: 'absolute', top: '4px', right: '8px',
      }}>
        [{index + 1}]
      </div>

      {/* Badge */}
      <div style={{
        fontFamily: pixelFont, fontSize: '0.35rem', color: '#FFF',
        backgroundColor: badgeColor, padding: '2px 8px', letterSpacing: '0.08em',
      }}>
        {badgeText}
      </div>

      {/* Icon box */}
      <div style={{
        width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        border: isSynergyHint ? `2px solid ${MC.textGold}` : `2px solid ${accentColor}`,
        fontFamily: pixelFont, fontSize: '0.6rem',
        color: isSynergyHint ? MC.textGold : accentColor,
        fontWeight: 700,
        boxShadow: isSynergyHint ? `0 0 8px rgba(255,170,0,0.4)` : 'none',
      }}>
        {icon}
      </div>

      {/* Name */}
      <div style={{ fontFamily: pixelFont, fontSize: '0.4rem', color: MC.textPrimary, lineHeight: '1.4' }}>
        {choice.name}
      </div>

      {/* Description */}
      <div style={{ fontFamily: bodyFont, fontSize: '0.75rem', color: MC.textSecondary, lineHeight: '1.3' }}>
        {choice.description}
      </div>

      {/* Weapon level indicator */}
      {choice.type === 'weapon' && choice.weaponLevel !== undefined && choice.weaponLevel > 0 && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: '#FF8C00',
          backgroundColor: 'rgba(255,140,0,0.15)', padding: '2px 6px',
        }}>
          Lv.{choice.weaponLevel} {'→'} Lv.{choice.weaponLevel + 1}
        </div>
      )}
      {choice.type === 'weapon' && (choice.weaponLevel === undefined || choice.weaponLevel === 0) && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGreen,
          backgroundColor: 'rgba(85,255,85,0.1)', padding: '2px 6px',
        }}>
          NEW WEAPON
        </div>
      )}

      {/* Passive stack indicator */}
      {choice.type === 'passive' && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: '#55FFFF',
          backgroundColor: 'rgba(85,255,255,0.1)', padding: '2px 6px',
        }}>
          {choice.passiveStacks ?? 0}/{choice.passiveMax ?? 5} {'→'} {(choice.passiveStacks ?? 0) + 1}/{choice.passiveMax ?? 5}
        </div>
      )}

      {/* Synergy hint: missing requirements */}
      {choice.type === 'synergy_hint' && choice.synergyMissing && (
        <div style={{
          fontFamily: bodyFont, fontSize: '0.65rem', color: MC.textGold,
          backgroundColor: 'rgba(255,170,0,0.1)', padding: '3px 6px',
          lineHeight: '1.2',
          border: `1px solid rgba(255,170,0,0.3)`,
        }}>
          {choice.synergyMissing}
        </div>
      )}

      {/* Legacy: Tome stacks */}
      {choice.type === 'tome' && choice.currentStacks !== undefined && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGold,
          backgroundColor: 'rgba(255,170,0,0.15)', padding: '2px 6px',
        }}>
          {tGame('stack', { from: choice.currentStacks, to: (choice.currentStacks ?? 0) + 1 })}
        </div>
      )}
      {/* Legacy: Ability level */}
      {choice.type === 'ability' && choice.currentLevel !== undefined && choice.currentLevel > 0 && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: '#5B8DAD',
          backgroundColor: 'rgba(91,141,173,0.15)', padding: '2px 6px',
        }}>
          Lv.{choice.currentLevel} {'→'} Lv.{choice.currentLevel + 1}
        </div>
      )}
      {choice.type === 'ability' && (choice.currentLevel === undefined || choice.currentLevel === 0) && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGreen,
          backgroundColor: 'rgba(85,255,85,0.1)', padding: '2px 6px',
        }}>
          {tGame('newAbility')}
        </div>
      )}
    </button>
  );
}

// ─── Card Meta Helper ───

function getCardMeta(choice: UpgradeChoice, tGame: ReturnType<typeof useTranslations>) {
  const isSynergyHint = choice.type === 'synergy_hint';

  switch (choice.type) {
    case 'weapon': {
      const wt = choice.weaponType ?? '';
      return {
        icon: WEAPON_ICONS[wt] ?? 'W',
        accentColor: WEAPON_COLORS[wt] ?? '#FF8C00',
        badgeText: 'WEAPON',
        badgeColor: '#B85C00',
        isSynergyHint: false,
      };
    }
    case 'passive': {
      const pt = choice.passiveType ?? '';
      return {
        icon: PASSIVE_ICONS[pt] ?? 'P',
        accentColor: PASSIVE_COLORS[pt] ?? '#55FFFF',
        badgeText: 'PASSIVE',
        badgeColor: '#2E7D32',
        isSynergyHint: false,
      };
    }
    case 'synergy_hint':
      return {
        icon: 'SYN',
        accentColor: MC.textGold,
        badgeText: 'SYNERGY',
        badgeColor: '#CC9933',
        isSynergyHint: true,
      };
    case 'tome': {
      const typeKey = choice.tomeType ?? '';
      return {
        icon: TOME_ICONS[typeKey] ?? 'T',
        accentColor: TYPE_COLORS[typeKey] ?? MC.textGold,
        badgeText: tGame('tome') as string,
        badgeColor: '#579E45',
        isSynergyHint: false,
      };
    }
    case 'ability': {
      const typeKey = choice.abilityType ?? '';
      return {
        icon: ABILITY_ICONS[typeKey] ?? 'A',
        accentColor: TYPE_COLORS[typeKey] ?? MC.textGold,
        badgeText: tGame('ability') as string,
        badgeColor: '#5B8DAD',
        isSynergyHint: false,
      };
    }
    default:
      return {
        icon: '?',
        accentColor: MC.textGold,
        badgeText: 'UPGRADE',
        badgeColor: '#555',
        isSynergyHint: false,
      };
  }
}
