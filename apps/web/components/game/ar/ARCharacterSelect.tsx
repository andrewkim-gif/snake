'use client';

/**
 * ARCharacterSelect — 캐릭터 선택 화면 (Phase 3)
 *
 * 8종 캐릭터 카드 표시
 * 각 캐릭터별 고유 패시브, 시작 무기, 스탯 정보
 * 선택 시 콜백으로 캐릭터 타입 전달
 */

import { useState } from 'react';
import type { ARCharacterType } from '@/lib/3d/ar-types';
import { CHARACTER_INFO, WEAPON_INFO, RARITY_COLORS } from '@/lib/3d/ar-types';

const ALL_CHARACTERS: ARCharacterType[] = [
  'striker',
  'guardian',
  'pyro',
  'frost_mage',
  'sniper',
  'gambler',
  'berserker',
  'shadow',
];

// 캐릭터별 태그 색상
const TAG_COLORS: Record<string, string> = {
  melee: '#FF5722',
  tank: '#607D8B',
  mage: '#9C27B0',
  ranged: '#2196F3',
  growth: '#FFC107',
  assassin: '#4CAF50',
};

interface ARCharacterSelectProps {
  onSelect: (character: ARCharacterType) => void;
}

export function ARCharacterSelect({ onSelect }: ARCharacterSelectProps) {
  const [selected, setSelected] = useState<ARCharacterType | null>(null);
  const [hovering, setHovering] = useState<ARCharacterType | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontFamily: '"Black Ops One", sans-serif',
          fontSize: 32,
          color: '#E8E0D4',
          marginBottom: 8,
          letterSpacing: 2,
        }}
      >
        SELECT CHARACTER
      </h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Choose your combat style. Each character has a unique passive ability.
      </p>

      {/* Character Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          maxWidth: 720,
          padding: '0 16px',
        }}
      >
        {ALL_CHARACTERS.map((charId) => {
          const info = CHARACTER_INFO[charId];
          const weaponInfo = WEAPON_INFO[info.startWeapon];
          const isSelected = selected === charId;
          const isHovering = hovering === charId;
          const tagColor = TAG_COLORS[info.tag] || '#888';

          return (
            <button
              key={charId}
              onClick={() => setSelected(charId)}
              onMouseEnter={() => setHovering(charId)}
              onMouseLeave={() => setHovering(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 12px',
                backgroundColor: isSelected
                  ? 'rgba(204,153,51,0.25)'
                  : isHovering
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.04)',
                border: isSelected
                  ? '2px solid #CC9933'
                  : '2px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 200ms',
                minWidth: 150,
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: 36, marginBottom: 8 }}>{info.icon}</span>

              {/* Name */}
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isSelected ? '#CC9933' : '#E8E0D4',
                  marginBottom: 4,
                }}
              >
                {info.name}
              </span>

              {/* Tag */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: tagColor,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                {info.tag}
              </span>

              {/* Passive */}
              <span
                style={{
                  fontSize: 11,
                  color: '#aaa',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  marginBottom: 8,
                }}
              >
                {info.passive}
              </span>

              {/* Start Weapon */}
              <span
                style={{
                  fontSize: 11,
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{weaponInfo.icon}</span>
                <span>{weaponInfo.name}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={!selected}
        style={{
          marginTop: 24,
          padding: '12px 48px',
          fontSize: 18,
          fontWeight: 700,
          fontFamily: '"Black Ops One", sans-serif',
          backgroundColor: selected ? '#CC9933' : '#333',
          color: selected ? '#111' : '#666',
          border: 'none',
          borderRadius: 6,
          cursor: selected ? 'pointer' : 'not-allowed',
          transition: 'all 200ms',
          letterSpacing: 1,
        }}
      >
        DEPLOY
      </button>
    </div>
  );
}
