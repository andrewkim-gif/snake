'use client';

import { type VoteHistoryEntry } from './types';

interface VoteHistoryProps {
  entries: VoteHistoryEntry[];
  className?: string;
}

/**
 * Vote History Archive
 * Shows the user's past voting activity
 */
export default function VoteHistory({ entries, className = '' }: VoteHistoryProps) {
  if (entries.length === 0) {
    return (
      <div
        className={className}
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#8B8B8B',
          fontSize: '13px',
          fontFamily: '"Rajdhani", sans-serif',
        }}
      >
        No voting history yet.
      </div>
    );
  }

  return (
    <div className={className} style={{ fontFamily: '"Rajdhani", sans-serif' }}>
      <h4
        style={{
          color: '#E8E0D4',
          fontWeight: 700,
          fontSize: '14px',
          margin: '0 0 12px 0',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        Vote History
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {entries.map((entry, idx) => {
          const date = new Date(entry.timestamp * 1000);
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={`${entry.proposalId}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr auto',
                gap: '10px',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)',
                borderLeft: `3px solid ${entry.support ? '#4A9E4A' : '#CC3333'}`,
              }}
            >
              {/* Vote indicator */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: entry.support
                    ? 'rgba(74, 158, 74, 0.15)'
                    : 'rgba(204, 51, 51, 0.15)',
                  color: entry.support ? '#4A9E4A' : '#CC3333',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                {entry.support ? 'Y' : 'N'}
              </div>

              {/* Proposal info */}
              <div>
                <div
                  style={{
                    color: '#E8E0D4',
                    fontSize: '13px',
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {entry.title}
                </div>
                <div style={{ color: '#8B8B8B', fontSize: '11px', marginTop: '2px' }}>
                  {entry.iso3} — Weight: {entry.quadraticWeight.toFixed(2)} — {dateStr}
                </div>
              </div>

              {/* Tokens used */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#CC9933', fontSize: '12px', fontWeight: 600 }}>
                  {Number(entry.tokensUsed).toLocaleString()}
                </div>
                <div style={{ color: '#8B8B8B', fontSize: '10px' }}>tokens</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
