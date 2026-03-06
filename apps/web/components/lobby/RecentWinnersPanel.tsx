'use client';

/**
 * RecentWinnersPanel — MC 스타일 최근 우승자 리스트
 * 순위 번호 + 이름 + 점수 + 시간
 */

import type { RecentWinner } from '@snake-arena/shared';
import { MC, mcBorder, pixelFont, bodyFont } from '@/lib/minecraft-ui';

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
        fontFamily: pixelFont, fontSize: '0.35rem',
        color: MC.textGold, marginBottom: '0.4rem',
        letterSpacing: '0.05em',
      }}>
        RECENT CHAMPIONS
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '3px',
        maxHeight: '110px', overflowY: 'auto',
      }}>
        {winners.slice(0, 5).map((w, i) => (
          <div key={`${w.roomId ?? i}-${w.timestamp ?? 0}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.25rem 0.4rem',
            backgroundColor: 'rgba(0,0,0,0.4)',
            boxShadow: mcBorder('#484848', '#1A1A1A', 1),
          }}>
            {/* 순위 */}
            <span style={{
              fontFamily: pixelFont, fontSize: '0.22rem',
              color: RANK_COLORS[i] || MC.textGray, minWidth: '22px',
            }}>
              #{i + 1}
            </span>

            {/* 이름 */}
            <span style={{
              fontFamily: bodyFont, fontSize: '0.8rem',
              color: MC.textPrimary, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', flex: 1,
            }}>
              {w.name}
            </span>

            {/* 점수 */}
            <span style={{
              fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGold,
            }}>
              {w.score}
            </span>

            {/* 시간 + 룸 */}
            <span style={{
              fontFamily: bodyFont, fontSize: '0.65rem', color: MC.textGray,
              whiteSpace: 'nowrap',
            }}>
              {(w.roomId ?? '').replace('room-', 'R')} · {timeAgo(w.timestamp ?? Date.now())}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
