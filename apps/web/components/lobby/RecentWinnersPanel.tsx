'use client';

/**
 * RecentWinnersPanel — MC 스타일 최근 우승자 리스트
 * 랭크 번호 + 이름 + 점수 + 시간
 */

import type { RecentWinner } from '@agent-survivor/shared';
import { MC, MCFont, mcBorder, pixelFont, bodyFont } from '@/lib/minecraft-ui';

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
        fontFamily: pixelFont, fontSize: MCFont.h2,
        color: MC.textGold, marginBottom: '10px',
        letterSpacing: '1px',
        textShadow: '1px 1px 0 #553300',
      }}>
        RECENT CHAMPIONS
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        maxHeight: '140px', overflowY: 'auto',
      }}>
        {winners.slice(0, 5).map((w, i) => (
          <div key={`${w.roomId ?? i}-${w.timestamp ?? 0}`} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px',
            backgroundColor: 'rgba(0,0,0,0.4)',
            boxShadow: mcBorder('#484848', '#1A1A1A', 1),
          }}>
            {/* 순위 */}
            <span style={{
              fontFamily: pixelFont, fontSize: MCFont.body,
              color: RANK_COLORS[i] || MC.textGray, minWidth: '28px',
            }}>
              #{i + 1}
            </span>

            {/* 이름 */}
            <span style={{
              fontFamily: bodyFont, fontSize: '14px',
              color: MC.textPrimary, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', flex: 1,
            }}>
              {w.name}
            </span>

            {/* 점수 */}
            <span style={{
              fontFamily: pixelFont, fontSize: MCFont.body, color: MC.textGold,
            }}>
              {w.score}
            </span>

            {/* 시간 + 룸 */}
            <span style={{
              fontFamily: bodyFont, fontSize: '12px', color: MC.textGray,
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
