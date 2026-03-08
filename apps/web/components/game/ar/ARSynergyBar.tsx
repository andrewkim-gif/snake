'use client';

/**
 * ARSynergyBar — 활성 시너지 아이콘 바 (Phase 3 Task 7)
 *
 * ARHUD 근처에 배치. arUiState.synergies 기반으로
 * 활성화된 시너지 아이콘/이름을 표시한다.
 */

import { memo } from 'react';
import { SYNERGY_INFO, type ARSynergyID } from '@/lib/3d/ar-types';

interface ARSynergyBarProps {
  synergies: ARSynergyID[];
}

// 시너지별 아이콘 매핑
const SYNERGY_ICONS: Record<ARSynergyID, string> = {
  infernal: '🔥',
  blizzard: '❄️',
  thunder_god: '⚡',
  plague_doctor: '☠️',
  juggernaut: '🛡️',
  glass_cannon_syn: '💎',
  speed_demon: '💨',
  holy_trinity: '✨',
  vampire_lord: '🧛',
  fortress: '🏰',
};

function ARSynergyBarInner({ synergies }: ARSynergyBarProps) {
  if (!synergies || synergies.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {synergies.map((synId) => {
        const info = SYNERGY_INFO[synId];
        const icon = SYNERGY_ICONS[synId] || '?';
        return (
          <div
            key={synId}
            title={info ? `${info.name}: ${info.desc}` : synId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: info ? `${info.color}22` : 'rgba(255,255,255,0.1)',
              border: `1px solid ${info?.color || '#888'}44`,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
            <span
              style={{
                fontSize: 8,
                color: info?.color || '#E8E0D4',
                fontFamily: '"Rajdhani", sans-serif',
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {info?.name || synId}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const ARSynergyBar = memo(ARSynergyBarInner);
