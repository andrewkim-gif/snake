'use client';

/**
 * BuildHUD — 현재 빌드 상태 표시 (Tome 스택 + Ability 슬롯 + 활성 시너지)
 * 화면 좌측 하단, MC 인벤토리 스타일
 */

import type { TomeType, AbilityType } from '@agent-survivor/shared';
import { MC, pixelFont } from '@/lib/minecraft-ui';

const TOME_INFO: Record<string, { label: string; color: string }> = {
  xp:     { label: 'XP',  color: '#FFAA00' },
  speed:  { label: 'SPD', color: '#55FFFF' },
  damage: { label: 'DMG', color: '#FF5555' },
  armor:  { label: 'ARM', color: '#AAAAAA' },
  magnet: { label: 'MAG', color: '#FFFF55' },
  luck:   { label: 'LCK', color: '#55FF55' },
  regen:  { label: 'REG', color: '#55FF55' },
  cursed: { label: 'CRS', color: '#AA00AA' },
};

const ABILITY_INFO: Record<string, { label: string; color: string }> = {
  venom_aura:       { label: 'VNM', color: '#55FF55' },
  shield_burst:     { label: 'SHL', color: '#5555FF' },
  lightning_strike:  { label: 'LTN', color: '#FFFF55' },
  speed_dash:       { label: 'DSH', color: '#55FFFF' },
  mass_drain:       { label: 'DRN', color: '#FF55FF' },
  gravity_well:     { label: 'GRV', color: '#AA00AA' },
};

export interface BuildData {
  tomes: Partial<Record<TomeType, number>>;
  abilities: Array<{ type: AbilityType; level: number }>;
  synergies: string[];
}

interface BuildHUDProps {
  build: BuildData | null;
}

export function BuildHUD({ build }: BuildHUDProps) {
  if (!build) return null;

  const activeTomes = Object.entries(build.tomes).filter(([_, stacks]) => stacks && stacks > 0);
  const hasContent = activeTomes.length > 0 || build.abilities.length > 0 || build.synergies.length > 0;
  if (!hasContent) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '40px', left: '12px',
      display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 15, pointerEvents: 'none',
    }}>
      {activeTomes.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '200px' }}>
          {activeTomes.map(([type, stacks]) => {
            const info = TOME_INFO[type];
            if (!info) return null;
            return (
              <div key={type} style={{
                display: 'flex', alignItems: 'center', gap: '2px',
                backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 4px',
                border: `1px solid ${info.color}40`,
              }}>
                <span style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: info.color }}>{info.label}</span>
                <span style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textPrimary }}>x{stacks}</span>
              </div>
            );
          })}
        </div>
      )}

      {build.abilities.length > 0 && (
        <div style={{ display: 'flex', gap: '3px' }}>
          {build.abilities.map((ability, idx) => {
            const info = ABILITY_INFO[ability.type];
            if (!info) return null;
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '2px',
                backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 5px',
                border: `1px solid ${info.color}40`,
              }}>
                <span style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: info.color }}>{info.label}</span>
                <span style={{ fontFamily: pixelFont, fontSize: '0.2rem', color: MC.textSecondary }}>Lv{ability.level}</span>
              </div>
            );
          })}
        </div>
      )}

      {build.synergies.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '200px' }}>
          {build.synergies.map((synergy) => (
            <div key={synergy} style={{
              fontFamily: pixelFont, fontSize: '0.22rem', color: MC.textGold,
              backgroundColor: 'rgba(255,170,0,0.15)', border: `1px solid ${MC.textGold}40`,
              padding: '1px 4px', letterSpacing: '0.04em',
            }}>
              {synergy}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
