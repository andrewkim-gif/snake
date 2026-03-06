'use client';

/**
 * RecentWinnersPanel — 작전 지도 스타일 최근 챔피언
 * 군사 랭크 + 어두운 행 + 손그림 보더
 */

import type { RecentWinner } from '@agent-survivor/shared';
import { SK, SKFont, headingFont, bodyFont, handDrawnRadius } from '@/lib/sketch-ui';

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  return `${m}m`;
}

const RANK_LABELS = ['1ST', '2ND', '3RD', '4TH', '5TH'];
const RANK_COLORS = [SK.gold, '#A8A8A8', '#8B6B3D', SK.textSecondary, SK.textMuted];

interface RecentWinnersPanelProps {
  winners: RecentWinner[];
}

export function RecentWinnersPanel({ winners }: RecentWinnersPanelProps) {
  if (winners.length === 0) return null;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        fontFamily: headingFont, fontSize: SKFont.h2,
        color: SK.gold, marginBottom: '10px',
        letterSpacing: '2px',
      }}>
        KILL LEADERS
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '3px',
        maxHeight: '150px', overflowY: 'auto',
      }}>
        {winners.slice(0, 5).map((w, i) => (
          <div key={`${w.roomId ?? i}-${w.timestamp ?? 0}`} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 10px',
            borderBottom: `1px solid ${SK.borderDark}`,
          }}>
            {/* 순위 */}
            <span style={{
              fontFamily: headingFont, fontSize: '13px',
              color: RANK_COLORS[i] || SK.textMuted, minWidth: '32px',
            }}>
              {RANK_LABELS[i]}
            </span>

            {/* 이름 */}
            <span style={{
              fontFamily: bodyFont, fontSize: SKFont.body, fontWeight: 600,
              color: SK.textPrimary,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', flex: 1,
            }}>
              {w.name}
            </span>

            {/* 점수 */}
            <span style={{
              fontFamily: headingFont, fontSize: '15px',
              color: SK.gold,
            }}>
              {w.score}
            </span>

            {/* 시간 */}
            <span style={{
              fontFamily: bodyFont, fontSize: SKFont.xs, fontWeight: 500,
              color: SK.textMuted, whiteSpace: 'nowrap',
            }}>
              {timeAgo(w.timestamp ?? Date.now())}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
