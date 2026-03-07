'use client';

import { useState, useMemo } from 'react';
import {
  type Proposal,
  type ProposalStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
  PROPOSAL_TYPE_COLORS,
} from './types';

interface ProposalListProps {
  proposals: Proposal[];
  onSelectProposal?: (proposal: Proposal) => void;
  className?: string;
}

/**
 * Proposal List
 * Displays all governance proposals with status filters
 */
export default function ProposalList({
  proposals,
  onSelectProposal,
  className = '',
}: ProposalListProps) {
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');

  const filtered = useMemo(() => {
    let list = proposals;
    if (statusFilter !== 'all') {
      list = proposals.filter((p) => p.status === statusFilter);
    }
    // Sort: active first, then by startTime desc
    return [...list].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return b.startTime - a.startTime;
    });
  }, [proposals, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: proposals.length };
    for (const p of proposals) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [proposals]);

  return (
    <div className={className} style={{ fontFamily: '"Rajdhani", sans-serif' }}>
      {/* Status filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '12px',
          padding: '3px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 0,
          overflowX: 'auto',
        }}
      >
        {(
          [
            ['all', '#E8E0D4'],
            ['active', STATUS_COLORS.active],
            ['passed', STATUS_COLORS.passed],
            ['rejected', STATUS_COLORS.rejected],
            ['executed', STATUS_COLORS.executed],
          ] as [ProposalStatus | 'all', string][]
        ).map(([status, color]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '6px 12px',
              borderRadius: 0,
              border: 'none',
              background: statusFilter === status ? `${color}20` : 'transparent',
              color: statusFilter === status ? color : '#8B8B8B',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: '"Rajdhani", sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {status === 'all' ? 'All' : STATUS_LABELS[status as ProposalStatus]}{' '}
            ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Proposal list */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#8B8B8B',
            fontSize: '13px',
          }}
        >
          No proposals found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((proposal) => {
            const totalVotes = proposal.forVotes + proposal.againstVotes;
            const forPct = totalVotes > 0 ? (proposal.forVotes / totalVotes) * 100 : 50;
            const statusColor = STATUS_COLORS[proposal.status];
            const typeColor = PROPOSAL_TYPE_COLORS[proposal.proposalType];
            const now = Date.now() / 1000;
            const timeLeft = proposal.endTime - now;
            const timeStr =
              timeLeft <= 0
                ? 'Ended'
                : timeLeft > 86400
                  ? `${Math.floor(timeLeft / 86400)}d`
                  : `${Math.floor(timeLeft / 3600)}h`;

            return (
              <div
                key={proposal.id}
                onClick={() => onSelectProposal?.(proposal)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  border: '1px solid rgba(232, 224, 212, 0.05)',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')
                }
              >
                {/* Top row: badges + time */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 0,
                        background: `${typeColor}15`,
                        color: typeColor,
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      {PROPOSAL_TYPE_LABELS[proposal.proposalType]}
                    </span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 0,
                        background: `${statusColor}15`,
                        color: statusColor,
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      {STATUS_LABELS[proposal.status]}
                    </span>
                  </div>
                  <span style={{ color: '#8B8B8B', fontSize: '11px' }}>{timeStr}</span>
                </div>

                {/* Title */}
                <div
                  style={{
                    color: '#E8E0D4',
                    fontWeight: 600,
                    fontSize: '14px',
                    marginBottom: '6px',
                  }}
                >
                  {proposal.title}
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: '4px',
                    borderRadius: 0,
                    background: 'rgba(204, 51, 51, 0.2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${forPct}%`,
                      height: '100%',
                      background: '#4A9E4A',
                      borderRadius: 0,
                    }}
                  />
                </div>

                {/* Vote counts */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    marginTop: '4px',
                  }}
                >
                  <span style={{ color: '#4A9E4A' }}>
                    For {proposal.forVotes.toFixed(1)}
                  </span>
                  <span style={{ color: '#CC3333' }}>
                    Against {proposal.againstVotes.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
