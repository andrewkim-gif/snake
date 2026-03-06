'use client';

import type { RecentWinner } from '@snake-arena/shared';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

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
    <div style={{ width: '100%' }}>
      <div style={{
        fontFamily: pixelFont,
        fontSize: '0.45rem',
        color: MC.textGold,
        marginBottom: '0.4rem',
        letterSpacing: '0.05em',
        borderBottom: `1px solid ${MC.panelBorderDark}`,
        paddingBottom: '0.3rem',
      }}>
        RECENT CHAMPIONS
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.2rem',
        maxHeight: '100px', overflowY: 'auto',
      }}>
        {winners.slice(0, 5).map((w, i) => (
          <div key={`${w.roomId}-${w.timestamp}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontFamily: bodyFont,
            fontSize: '0.75rem',
          }}>
            <span style={{ color: MC.textGold, fontWeight: 700 }}>
              {i === 0 ? '\u{1F3C6}' : '\u{2B50}'} {w.name}
            </span>
            <span style={{ color: MC.textSecondary }}>
              {w.score}pts
            </span>
            <span style={{ color: MC.textGray, marginLeft: 'auto', fontSize: '0.65rem' }}>
              {w.roomId.replace('room-', 'R')} · {timeAgo(w.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
