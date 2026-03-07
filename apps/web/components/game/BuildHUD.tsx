'use client';

/**
 * BuildHUD — v14 Phase 3: Build status display (icon-based)
 *   - Weapon slots: icon + level badge (Lv1~5)
 *   - Passive stacks: icon + stack count
 *   - Active synergies: gold-bordered icon + name
 *   - Legacy Tome/Ability support preserved
 * Bottom-left, Dark Tactical style
 */

import type { TomeType, AbilityType, PassiveType, V14SynergyType, WeaponType } from '@agent-survivor/shared';

// ─── Weapon Icons (short label + color) ───
const WEAPON_META: Record<string, { label: string; color: string }> = {
  bonk_mallet:    { label: 'BNK', color: '#C08040' },
  chain_bolt:     { label: 'CHN', color: '#00BFFF' },
  flame_ring:     { label: 'FLM', color: '#FF4500' },
  frost_shards:   { label: 'ICE', color: '#87CEEB' },
  shadow_strike:  { label: 'SHD', color: '#8A2BE2' },
  thunder_clap:   { label: 'THN', color: '#FFD700' },
  venom_cloud:    { label: 'VNM', color: '#32CD32' },
  crystal_shield: { label: 'CRY', color: '#00CED1' },
  gravity_bomb:   { label: 'GRV', color: '#4B0082' },
  soul_drain:     { label: 'SOL', color: '#FF6347' },
};

// ─── Passive Icons ───
const PASSIVE_META: Record<string, { label: string; color: string; path: string }> = {
  vigor:     { label: 'VIG', color: '#FF5555', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  swift:     { label: 'SWF', color: '#55FFFF', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  fury:      { label: 'FRY', color: '#FF4444', path: 'M6.92 5L5 7l6 6-5 5 1.5 1.5 5-5 5 5L19 18l-5-5 6-6-2-2-6 6-5.08-6z' },
  iron_skin: { label: 'ISK', color: '#AAAAAA', path: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z' },
  magnet:    { label: 'MAG', color: '#FFFF55', path: 'M3 7v6c0 5 4 9 9 9s9-4 9-9V7h-5v6c0 2.2-1.8 4-4 4s-4-1.8-4-4V7H3z' },
  fortune:   { label: 'FOR', color: '#55FF55', path: 'M12 2C9.8 2 8 3.8 8 6c0 1 .4 2 1 2.7C7.4 9 6 10.1 6 12c0 2.2 1.8 4 4 4 .7 0 1.4-.2 2-.5.6.3 1.3.5 2 .5 2.2 0 4-1.8 4-4 0-1.9-1.4-3-3-3.3.6-.7 1-1.7 1-2.7 0-2.2-1.8-4-4-4zm0 20l-1-4h2l-1 4z' },
  vitality:  { label: 'VIT', color: '#FF69B4', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
  precision: { label: 'PRC', color: '#FFD700', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z' },
  blast:     { label: 'BLT', color: '#FF8C00', path: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z' },
  haste:     { label: 'HST', color: '#00FF7F', path: 'M20.38 8.57l-1.23 1.85a8 8 0 01-.22 7.58H5.07A8 8 0 0115.58 6.85l1.85-1.23A10 10 0 003.35 19a2 2 0 001.72 1h13.85a2 2 0 001.74-1 10 10 0 00-.27-10.44z' },
};

// ─── v14 Synergy display names ───
const SYNERGY_NAMES: Record<string, string> = {
  thermal_shock: 'Thermal Shock',
  assassins_mark: "Assassin's Mark",
  fortress: 'Fortress',
  corruption: 'Corruption',
  thunder_god: 'Thunder God',
  gravity_master: 'Gravity Master',
  berserker_v14: 'Berserker',
  iron_maiden: 'Iron Maiden',
  glass_cannon_v14: 'Glass Cannon',
  speedster_v14: 'Speedster',
};

// ─── Legacy Tome Icons ───
const TOME_ICONS: Record<string, { path: string; color: string; label: string }> = {
  xp:     { label: 'XP',  color: '#FFAA00', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  speed:  { label: 'SPD', color: '#55FFFF', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  damage: { label: 'DMG', color: '#FF5555', path: 'M6.92 5L5 7l6 6-5 5 1.5 1.5 5-5 5 5L19 18l-5-5 6-6-2-2-6 6-5.08-6z' },
  armor:  { label: 'ARM', color: '#AAAAAA', path: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z' },
  magnet: { label: 'MAG', color: '#FFFF55', path: 'M3 7v6c0 5 4 9 9 9s9-4 9-9V7h-5v6c0 2.2-1.8 4-4 4s-4-1.8-4-4V7H3z' },
  luck:   { label: 'LCK', color: '#55FF55', path: 'M12 2C9.8 2 8 3.8 8 6c0 1 .4 2 1 2.7C7.4 9 6 10.1 6 12c0 2.2 1.8 4 4 4 .7 0 1.4-.2 2-.5.6.3 1.3.5 2 .5 2.2 0 4-1.8 4-4 0-1.9-1.4-3-3-3.3.6-.7 1-1.7 1-2.7 0-2.2-1.8-4-4-4zm0 20l-1-4h2l-1 4z' },
  regen:  { label: 'REG', color: '#55FF55', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  cursed: { label: 'CRS', color: '#AA00AA', path: 'M12 2C6.48 2 2 6.48 2 12c0 3.7 2 6.9 5 8.6V22h3v-1h4v1h3v-1.4c3-1.7 5-4.9 5-8.6 0-5.52-4.48-10-10-10zM8.5 14c-.83 0-1.5-.67-1.5-1.5S7.67 11 8.5 11s1.5.67 1.5 1.5S9.33 14 8.5 14zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
};

// ─── Legacy Ability Icons ───
const ABILITY_ICONS: Record<string, { path: string; color: string; label: string }> = {
  venom_aura:      { label: 'VNM', color: '#55FF55', path: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-1H6v1zM12 3C7 3 3 7 3 12c0 3 1.5 5.5 3.8 7h10.4c2.3-1.5 3.8-4 3.8-7 0-5-4-9-9-9z' },
  shield_burst:    { label: 'SHL', color: '#5555FF', path: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z' },
  lightning_strike: { label: 'LTN', color: '#FFFF55', path: 'M7 2v11h3v9l7-12h-4l4-8H7z' },
  speed_dash:      { label: 'DSH', color: '#55FFFF', path: 'M20.38 8.57l-1.23 1.85a8 8 0 01-.22 7.58H5.07A8 8 0 0115.58 6.85l1.85-1.23A10 10 0 003.35 19a2 2 0 001.72 1h13.85a2 2 0 001.74-1 10 10 0 00-.27-10.44z' },
  mass_drain:      { label: 'DRN', color: '#FF55FF', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
  gravity_well:    { label: 'GRV', color: '#AA00AA', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z' },
};

// ─── Synergy Icon ───
const SYNERGY_STAR_PATH = 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z';

// ─── Build Data Types ───
export interface BuildData {
  // Legacy
  tomes: Partial<Record<TomeType, number>>;
  abilities: Array<{ type: AbilityType; level: number; cooldownPct?: number }>;
  synergies: string[];
  // v14 Phase 3
  weapons?: Array<{ type: WeaponType; level: number }>;
  passives?: Partial<Record<PassiveType, number>>;
  v14Synergies?: V14SynergyType[];
}

interface BuildHUDProps {
  build: BuildData | null;
}

// ─── Weapon Slot Icon ───
function WeaponIcon({ type, level }: { type: string; level: number }) {
  const meta = WEAPON_META[type];
  if (!meta) return null;

  const isUltimate = level >= 5;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      padding: '4px 6px',
      border: isUltimate ? `2px solid ${meta.color}` : `1px solid ${meta.color}50`,
      position: 'relative',
      boxShadow: isUltimate ? `0 0 6px ${meta.color}60` : 'none',
    }}>
      <span style={{
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '12px', fontWeight: 700, color: meta.color, lineHeight: 1,
      }}>
        {meta.label}
      </span>
      {/* Level badge */}
      <div style={{
        position: 'absolute', bottom: '-4px', right: '-4px',
        minWidth: '14px', height: '14px',
        backgroundColor: isUltimate ? meta.color : 'rgba(17, 17, 17, 0.95)',
        border: `1px solid ${meta.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '9px', fontWeight: 700,
        color: isUltimate ? '#000' : meta.color,
        lineHeight: 1, padding: '0 2px',
      }}>
        {isUltimate ? 'MAX' : level}
      </div>
    </div>
  );
}

// ─── Passive Stack Icon ───
function PassiveIcon({ type, stacks }: { type: string; stacks: number }) {
  const meta = PASSIVE_META[type];
  if (!meta) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      padding: '3px 5px',
      border: `1px solid ${meta.color}50`,
      position: 'relative',
    }}>
      <svg
        width="14" height="14" viewBox="0 0 24 24"
        fill={meta.color} style={{ opacity: 0.9 }}
      >
        <path d={meta.path} />
      </svg>
      {stacks > 1 && (
        <span style={{
          fontFamily: '"Rajdhani", "Inter", sans-serif',
          fontSize: '11px', fontWeight: 700, color: meta.color, lineHeight: 1,
        }}>
          {stacks}
        </span>
      )}
      {/* Stack dots */}
      <div style={{
        position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '1px',
      }}>
        {Array.from({ length: Math.min(stacks, 6) }).map((_, i) => (
          <div key={i} style={{
            width: '2px', height: '2px',
            backgroundColor: meta.color, opacity: 0.8,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Legacy Tome Icon ───
function TomeIcon({ type, stacks }: { type: string; stacks: number }) {
  const info = TOME_ICONS[type];
  if (!info) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      padding: '3px 5px',
      border: `1px solid ${info.color}50`,
      position: 'relative',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={info.color} style={{ opacity: 0.9 }}>
        <path d={info.path} />
      </svg>
      {stacks > 1 && (
        <span style={{
          fontFamily: '"Rajdhani", "Inter", sans-serif',
          fontSize: '11px', fontWeight: 700, color: info.color, lineHeight: 1,
        }}>
          {stacks}
        </span>
      )}
    </div>
  );
}

// ─── Legacy Ability Icon (circular cooldown) ───
function AbilityIcon({ type, level, cooldownPct = 0 }: {
  type: string; level: number; cooldownPct: number;
}) {
  const info = ABILITY_ICONS[type];
  if (!info) return null;

  const size = 32;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - cooldownPct);
  const isReady = cooldownPct >= 1;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="rgba(17, 17, 17, 0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={isReady ? info.color : `${info.color}66`}
          strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <svg width="16" height="16" viewBox="0 0 24 24"
        fill={isReady ? info.color : `${info.color}88`}
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <path d={info.path} />
      </svg>
      <div style={{
        position: 'absolute', bottom: '-2px', right: '-2px',
        width: '12px', height: '12px',
        backgroundColor: 'rgba(17, 17, 17, 0.9)',
        border: `1px solid ${info.color}80`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '8px', fontWeight: 700, color: info.color, lineHeight: 1,
      }}>
        {level}
      </div>
    </div>
  );
}

// ─── v14 Synergy Icon (gold border) ───
function V14SynergyIcon({ type }: { type: string }) {
  const name = SYNERGY_NAMES[type] ?? type;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '3px',
      backgroundColor: 'rgba(204, 153, 51, 0.15)',
      border: '1.5px solid #CC9933',
      padding: '2px 6px',
      boxShadow: '0 0 4px rgba(204, 153, 51, 0.3)',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#CC9933" style={{ opacity: 0.9 }}>
        <path d={SYNERGY_STAR_PATH} />
      </svg>
      <span style={{
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '10px', fontWeight: 700, color: '#CC9933',
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {name}
      </span>
    </div>
  );
}

// ─── Legacy Synergy Icon ───
function SynergyIcon({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '3px',
      backgroundColor: 'rgba(204, 153, 51, 0.15)',
      border: '1.5px solid #CC9933',
      padding: '2px 6px',
      boxShadow: '0 0 4px rgba(204, 153, 51, 0.3)',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#CC9933" style={{ opacity: 0.9 }}>
        <path d={SYNERGY_STAR_PATH} />
      </svg>
      <span style={{
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '10px', fontWeight: 700, color: '#CC9933',
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {name}
      </span>
    </div>
  );
}

// ─── Main BuildHUD Component ───

export function BuildHUD({ build }: BuildHUDProps) {
  if (!build) return null;

  const hasWeapons = build.weapons && build.weapons.length > 0;
  const hasPassives = build.passives && Object.values(build.passives).some(v => v && v > 0);
  const hasV14Synergies = build.v14Synergies && build.v14Synergies.length > 0;
  const activeTomes = Object.entries(build.tomes).filter(([_, stacks]) => stacks && stacks > 0);
  const hasLegacy = activeTomes.length > 0 || build.abilities.length > 0 || build.synergies.length > 0;
  const hasContent = hasWeapons || hasPassives || hasV14Synergies || hasLegacy;

  if (!hasContent) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '40px', left: '12px',
      display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 15, pointerEvents: 'none',
    }}>
      {/* v14: Weapon slots with level */}
      {hasWeapons && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '260px' }}>
          {build.weapons!.map((w) => (
            <WeaponIcon key={w.type} type={w.type} level={w.level} />
          ))}
        </div>
      )}

      {/* v14: Passive stacks */}
      {hasPassives && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '220px' }}>
          {Object.entries(build.passives!).map(([type, stacks]) => (
            stacks && stacks > 0 ? <PassiveIcon key={type} type={type} stacks={stacks} /> : null
          ))}
        </div>
      )}

      {/* v14: Active synergies */}
      {hasV14Synergies && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '220px' }}>
          {build.v14Synergies!.map((syn) => (
            <V14SynergyIcon key={syn} type={syn} />
          ))}
        </div>
      )}

      {/* Legacy: Tome stacks */}
      {activeTomes.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '220px' }}>
          {activeTomes.map(([type, stacks]) => (
            <TomeIcon key={type} type={type} stacks={stacks!} />
          ))}
        </div>
      )}

      {/* Legacy: Ability cooldown icons */}
      {build.abilities.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {build.abilities.map((ability, idx) => (
            <AbilityIcon
              key={idx}
              type={ability.type}
              level={ability.level}
              cooldownPct={ability.cooldownPct ?? 1}
            />
          ))}
        </div>
      )}

      {/* Legacy: Active synergies */}
      {build.synergies.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '220px' }}>
          {build.synergies.map((synergy) => (
            <SynergyIcon key={synergy} name={synergy} />
          ))}
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes abilityPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
