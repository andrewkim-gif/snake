'use client';

/**
 * BuildHUD — 현재 빌드 상태 표시 (아이콘 기반)
 * v12 S22: 텍스트 → 아이콘 변환
 *   - Tome 스택: SVG 아이콘 × 스택 수
 *   - Ability: 원형 쿨다운 타이머
 *   - Synergy: 골드 테두리 아이콘
 * 화면 좌측 하단, Dark Tactical 스타일
 */

import { useRef, useEffect } from 'react';
import type { TomeType, AbilityType } from '@agent-survivor/shared';

// ─── Tome 아이콘 SVG 경로 + 메타데이터 ───
const TOME_ICONS: Record<string, { path: string; color: string; label: string }> = {
  xp: {
    label: 'XP',
    color: '#FFAA00',
    // 별 아이콘
    path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  },
  speed: {
    label: 'SPD',
    color: '#55FFFF',
    // 번개 아이콘
    path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  damage: {
    label: 'DMG',
    color: '#FF5555',
    // 검 아이콘
    path: 'M6.92 5L5 7l6 6-5 5 1.5 1.5 5-5 5 5L19 18l-5-5 6-6-2-2-6 6-5.08-6z',
  },
  armor: {
    label: 'ARM',
    color: '#AAAAAA',
    // 방패 아이콘
    path: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z',
  },
  magnet: {
    label: 'MAG',
    color: '#FFFF55',
    // 자석 아이콘
    path: 'M3 7v6c0 5 4 9 9 9s9-4 9-9V7h-5v6c0 2.2-1.8 4-4 4s-4-1.8-4-4V7H3z',
  },
  luck: {
    label: 'LCK',
    color: '#55FF55',
    // 클로버 아이콘
    path: 'M12 2C9.8 2 8 3.8 8 6c0 1 .4 2 1 2.7C7.4 9 6 10.1 6 12c0 2.2 1.8 4 4 4 .7 0 1.4-.2 2-.5.6.3 1.3.5 2 .5 2.2 0 4-1.8 4-4 0-1.9-1.4-3-3-3.3.6-.7 1-1.7 1-2.7 0-2.2-1.8-4-4-4zm0 20l-1-4h2l-1 4z',
  },
  regen: {
    label: 'REG',
    color: '#55FF55',
    // 하트 아이콘
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  },
  cursed: {
    label: 'CRS',
    color: '#AA00AA',
    // 해골 아이콘
    path: 'M12 2C6.48 2 2 6.48 2 12c0 3.7 2 6.9 5 8.6V22h3v-1h4v1h3v-1.4c3-1.7 5-4.9 5-8.6 0-5.52-4.48-10-10-10zM8.5 14c-.83 0-1.5-.67-1.5-1.5S7.67 11 8.5 11s1.5.67 1.5 1.5S9.33 14 8.5 14zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  },
};

// ─── Ability 아이콘 + 쿨다운 색상 ───
const ABILITY_ICONS: Record<string, { path: string; color: string; label: string }> = {
  venom_aura: {
    label: 'VNM',
    color: '#55FF55',
    // 독 구름
    path: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-1H6v1zM12 3C7 3 3 7 3 12c0 3 1.5 5.5 3.8 7h10.4c2.3-1.5 3.8-4 3.8-7 0-5-4-9-9-9z',
  },
  shield_burst: {
    label: 'SHL',
    color: '#5555FF',
    // 방패 폭발
    path: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z',
  },
  lightning_strike: {
    label: 'LTN',
    color: '#FFFF55',
    // 번개
    path: 'M7 2v11h3v9l7-12h-4l4-8H7z',
  },
  speed_dash: {
    label: 'DSH',
    color: '#55FFFF',
    // 스피드
    path: 'M20.38 8.57l-1.23 1.85a8 8 0 01-.22 7.58H5.07A8 8 0 0115.58 6.85l1.85-1.23A10 10 0 003.35 19a2 2 0 001.72 1h13.85a2 2 0 001.74-1 10 10 0 00-.27-10.44z M10.59 15.41a2 2 0 002.83 0l5.66-8.49-8.49 5.66a2 2 0 000 2.83z',
  },
  mass_drain: {
    label: 'DRN',
    color: '#FF55FF',
    // 흡수
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  },
  gravity_well: {
    label: 'GRV',
    color: '#AA00AA',
    // 블랙홀 소용돌이
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  },
};

// ─── Synergy 아이콘 맵 ───
const SYNERGY_ICONS: Record<string, string> = {
  // 시너지별 SVG path (공통 디폴트)
  default: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z',
};

export interface BuildData {
  tomes: Partial<Record<TomeType, number>>;
  abilities: Array<{ type: AbilityType; level: number; cooldownPct?: number }>;
  synergies: string[];
}

interface BuildHUDProps {
  build: BuildData | null;
}

/** SVG 아이콘 렌더 헬퍼 */
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
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill={info.color} style={{ opacity: 0.9 }}
      >
        <path d={info.path} />
      </svg>
      {stacks > 1 && (
        <span style={{
          fontFamily: '"Rajdhani", "Inter", sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          color: info.color,
          lineHeight: 1,
        }}>
          {stacks}
        </span>
      )}
      {/* 스택 도트 인디케이터 (최대 5) */}
      <div style={{
        position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '1px',
      }}>
        {Array.from({ length: Math.min(stacks, 5) }).map((_, i) => (
          <div key={i} style={{
            width: '2px', height: '2px',
            backgroundColor: info.color,
            opacity: 0.8,
          }} />
        ))}
      </div>
    </div>
  );
}

/** 원형 쿨다운 표시 어빌리티 아이콘 */
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
    <div style={{
      position: 'relative',
      width: size, height: size,
    }}>
      {/* 배경 원 */}
      <svg
        width={size} height={size}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* 배경 트랙 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="rgba(17, 17, 17, 0.85)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* 쿨다운 진행 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={isReady ? info.color : `${info.color}66`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      {/* 아이콘 */}
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill={isReady ? info.color : `${info.color}88`}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <path d={info.path} />
      </svg>
      {/* 레벨 뱃지 */}
      <div style={{
        position: 'absolute', bottom: '-2px', right: '-2px',
        width: '12px', height: '12px',
        backgroundColor: 'rgba(17, 17, 17, 0.9)',
        border: `1px solid ${info.color}80`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '8px', fontWeight: 700, color: info.color,
        lineHeight: 1,
      }}>
        {level}
      </div>
      {/* Ready 글로우 */}
      {isReady && (
        <div style={{
          position: 'absolute', inset: '-2px',
          border: `1px solid ${info.color}60`,
          boxShadow: `0 0 6px ${info.color}40`,
          animation: 'abilityPulse 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

/** 활성 시너지 아이콘 (골드 테두리) */
function SynergyIcon({ name }: { name: string }) {
  const iconPath = SYNERGY_ICONS[name] ?? SYNERGY_ICONS['default'];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '3px',
      backgroundColor: 'rgba(204, 153, 51, 0.15)',
      border: '1.5px solid #CC9933',
      padding: '2px 6px',
      boxShadow: '0 0 4px rgba(204, 153, 51, 0.3)',
    }}>
      <svg
        width="12" height="12" viewBox="0 0 24 24"
        fill="#CC9933" style={{ opacity: 0.9 }}
      >
        <path d={iconPath} />
      </svg>
      <span style={{
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '10px',
        fontWeight: 700,
        color: '#CC9933',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        {name}
      </span>
    </div>
  );
}

export function BuildHUD({ build }: BuildHUDProps) {
  if (!build) return null;

  const activeTomes = Object.entries(build.tomes).filter(([_, stacks]) => stacks && stacks > 0);
  const hasContent = activeTomes.length > 0 || build.abilities.length > 0 || build.synergies.length > 0;
  if (!hasContent) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '40px', left: '12px',
      display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 15, pointerEvents: 'none',
    }}>
      {/* Tome 스택 아이콘 그리드 */}
      {activeTomes.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '220px' }}>
          {activeTomes.map(([type, stacks]) => (
            <TomeIcon key={type} type={type} stacks={stacks!} />
          ))}
        </div>
      )}

      {/* Ability 쿨다운 원형 아이콘 */}
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

      {/* 활성 시너지 (골드 테두리) */}
      {build.synergies.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '220px' }}>
          {build.synergies.map((synergy) => (
            <SynergyIcon key={synergy} name={synergy} />
          ))}
        </div>
      )}

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes abilityPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
