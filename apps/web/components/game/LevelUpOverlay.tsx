'use client';

/**
 * LevelUpOverlay — 레벨업 시 3택 업그레이드 카드 UI
 * MC 다크 패널 스타일, 5초 타임아웃 프로그레스 바
 * 키보드 [1][2][3] 선택 지원
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LevelUpPayload, UpgradeChoice } from '@snake-arena/shared';
import { MC, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const TOME_ICONS: Record<string, string> = {
  xp: 'XP', speed: 'SPD', damage: 'DMG', armor: 'ARM',
  magnet: 'MAG', luck: 'LCK', regen: 'REG', cursed: 'CRS',
};

const ABILITY_ICONS: Record<string, string> = {
  venom_aura: 'VNM', shield_burst: 'SHL', lightning_strike: 'LTN',
  speed_dash: 'DSH', mass_drain: 'DRN', gravity_well: 'GRV',
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

  // 키보드 [1][2][3] 선택
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
        LEVEL UP! Lv.{level}
      </div>
      <div style={{
        fontFamily: pixelFont, fontSize: '0.4rem', color: MC.textSecondary, letterSpacing: '0.05em',
      }}>
        Choose an upgrade [1] [2] [3]
      </div>

      <div style={{
        display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px',
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

function UpgradeCard({
  choice, index, hovered, onHover, onLeave, onClick,
}: {
  choice: UpgradeChoice; index: number; hovered: boolean;
  onHover: () => void; onLeave: () => void; onClick: () => void;
}) {
  const isTome = choice.type === 'tome';
  const typeKey = isTome ? choice.tomeType : choice.abilityType;
  const icon = isTome
    ? TOME_ICONS[choice.tomeType ?? ''] ?? 'T'
    : ABILITY_ICONS[choice.abilityType ?? ''] ?? 'A';
  const accentColor = TYPE_COLORS[typeKey ?? ''] ?? MC.textGold;
  const badgeColor = isTome ? '#579E45' : '#5B8DAD';
  const badgeText = isTome ? 'TOME' : 'ABILITY';

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
        width: '180px', padding: '1rem 0.8rem',
        backgroundColor: hovered ? 'rgba(255,255,255,0.12)' : MC.panelBg,
        boxShadow: mcPanelShadow(),
        border: hovered ? `2px solid ${accentColor}` : `2px solid ${MC.panelBorderDark}`,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        textAlign: 'center',
      }}
    >
      {/* 키 힌트 */}
      <div style={{
        fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGray,
        position: 'absolute', top: '4px', right: '8px',
      }}>
        [{index + 1}]
      </div>

      <div style={{
        fontFamily: pixelFont, fontSize: '0.35rem', color: '#FFF',
        backgroundColor: badgeColor, padding: '2px 8px', letterSpacing: '0.08em',
      }}>
        {badgeText}
      </div>

      <div style={{
        width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)', border: `2px solid ${accentColor}`,
        fontFamily: pixelFont, fontSize: '0.6rem', color: accentColor, fontWeight: 700,
      }}>
        {icon}
      </div>

      <div style={{ fontFamily: pixelFont, fontSize: '0.4rem', color: MC.textPrimary, lineHeight: '1.4' }}>
        {choice.name}
      </div>

      <div style={{ fontFamily: bodyFont, fontSize: '0.75rem', color: MC.textSecondary, lineHeight: '1.3' }}>
        {choice.description}
      </div>

      {isTome && choice.currentStacks !== undefined && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGold,
          backgroundColor: 'rgba(255,170,0,0.15)', padding: '2px 6px',
        }}>
          STACK {choice.currentStacks} {'->'} {choice.currentStacks + 1}
        </div>
      )}
      {!isTome && choice.currentLevel !== undefined && choice.currentLevel > 0 && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: '#5B8DAD',
          backgroundColor: 'rgba(91,141,173,0.15)', padding: '2px 6px',
        }}>
          Lv.{choice.currentLevel} {'->'} Lv.{choice.currentLevel + 1}
        </div>
      )}
      {!isTome && (choice.currentLevel === undefined || choice.currentLevel === 0) && (
        <div style={{
          fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGreen,
          backgroundColor: 'rgba(85,255,85,0.1)', padding: '2px 6px',
        }}>
          NEW ABILITY
        </div>
      )}
    </button>
  );
}
