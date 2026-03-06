'use client';

/**
 * RecentWinnersPanel — 모던 행 스타일 + 랭크 도트
 */

import type { RecentWinner } from '@snake-arena/shared';
import { MC, MCModern, pixelFont, bodyFont } from '@/lib/minecraft-ui';

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  return `${m}m ago`;
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', MC.textSecondary, MC.textGray];

interface RecentWinnersPanelProps {
  winners: RecentWinner[];
}

export function RecentWinnersPanel({ winners }: RecentWinnersPanelProps) {
  if (winners.length === 0) return null;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        fontFamily: pixelFont,
        fontSize: '0.4rem',
        color: MC.textGold,
        marginBottom: '0.4rem',
        letterSpacing: '0.05em',
      }}>
        RECENT CHAMPIONS
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        maxHeight: '110px', overflowY: 'auto',
      }}>
        {winners.slice(0, 5).map((w, i) => (
          <div key={`${w.roomId}-${w.timestamp}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.3rem 0.5rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: MCModern.radiusSm,
            transition: MCModern.transitionFast,
          }}>
            {/* 랭크 도트 */}
            <div style={{
              width: 8, height: 8,
              borderRadius: '50%',
              backgroundColor: RANK_COLORS[i] || MC.textGray,
              flexShrink: 0,
            }} />

            {/* Name */}
            <span style={{
              fontFamily: bodyFont,
              fontSize: '0.8rem',
              color: MC.textPrimary,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {w.name}
            </span>

            {/* Score */}
            <span style={{
              fontFamily: pixelFont,
              fontSize: '0.3rem',
              color: MC.textGold,
            }}>
              {w.score}
            </span>

            {/* Time + Room */}
            <span style={{
              fontFamily: bodyFont,
              fontSize: '0.65rem',
              color: MC.textGray,
              whiteSpace: 'nowrap',
            }}>
              {w.roomId.replace('room-', 'R')} · {timeAgo(w.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
