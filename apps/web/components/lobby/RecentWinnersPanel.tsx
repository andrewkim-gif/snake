'use client';

import type { RecentWinner } from '@snake-arena/shared';

const P = {
  pencilDark: '#3A3028',
  pencilMedium: '#6B5E52',
  pencilLight: '#A89888',
  crayonOrange: '#D4914A',
} as const;

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  return `${m}m ago`;
}

interface RecentWinnersPanelProps {
  winners: RecentWinner[];
}

export function RecentWinnersPanel({ winners }: RecentWinnersPanelProps) {
  if (winners.length === 0) return null;

  return (
    <div style={{
      width: '100%',
      fontFamily: '"Patrick Hand", "Inter", sans-serif',
    }}>
      <div style={{
        fontSize: '0.8rem', fontWeight: 700, color: P.pencilDark,
        marginBottom: '0.3rem', letterSpacing: '0.03em',
      }}>
        Recent Winners
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.15rem',
        maxHeight: '100px', overflowY: 'auto',
      }}>
        {winners.slice(0, 5).map((w, i) => (
          <div key={`${w.roomId}-${w.timestamp}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.72rem', color: P.pencilMedium,
          }}>
            <span style={{ color: P.crayonOrange, fontWeight: 700 }}>
              {i === 0 ? '\u{1F947}' : '\u{2B50}'} {w.name}
            </span>
            <span>{w.score}pts</span>
            <span style={{ color: P.pencilLight, marginLeft: 'auto' }}>
              {w.roomId.replace('room-', 'R')} · {timeAgo(w.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
