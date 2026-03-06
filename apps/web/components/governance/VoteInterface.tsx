'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  type Proposal,
  PROPOSAL_TYPE_LABELS,
  PROPOSAL_TYPE_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './types';

interface VoteInterfaceProps {
  proposal: Proposal;
  userTokenBalance: number;
  onVote?: (proposalId: number, support: boolean, tokenAmount: number) => void;
  onWithdraw?: (proposalId: number) => void;
  className?: string;
}

/**
 * Vote Interface
 * Cast votes on governance proposals with quadratic weighting display
 */
export default function VoteInterface({
  proposal,
  userTokenBalance,
  onVote,
  onWithdraw,
  className = '',
}: VoteInterfaceProps) {
  const [tokenAmount, setTokenAmount] = useState('');
  const [voting, setVoting] = useState(false);

  const isActive = proposal.status === 'active';
  const now = Date.now() / 1000;
  const votingEnded = now >= proposal.endTime;
  const canVote = isActive && !votingEnded && !proposal.userVoted;
  const canWithdraw = votingEnded && proposal.userVoted && parseFloat(proposal.userTokensLocked || '0') > 0;

  const timeLeft = useMemo(() => {
    if (votingEnded) return 'Ended';
    const secs = proposal.endTime - now;
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${mins}m`;
  }, [proposal.endTime, now, votingEnded]);

  const totalVotes = proposal.forVotes + proposal.againstVotes;
  const forPercent = totalVotes > 0 ? (proposal.forVotes / totalVotes) * 100 : 50;
  const againstPercent = 100 - forPercent;

  // Quadratic weight preview
  const previewAmount = parseFloat(tokenAmount) || 0;
  const quadraticWeight = Math.sqrt(previewAmount);

  const handleVote = useCallback(
    (support: boolean) => {
      if (!canVote || previewAmount <= 0 || previewAmount > userTokenBalance) return;
      setVoting(true);
      onVote?.(proposal.id, support, previewAmount);
      setTimeout(() => setVoting(false), 2000);
    },
    [canVote, previewAmount, userTokenBalance, proposal.id, onVote]
  );

  const statusColor = STATUS_COLORS[proposal.status];
  const typeColor = PROPOSAL_TYPE_COLORS[proposal.proposalType];

  return (
    <div
      className={className}
      style={{
        background: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(232, 224, 212, 0.1)',
        borderRadius: '12px',
        padding: '20px',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: `${typeColor}20`,
              color: typeColor,
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {PROPOSAL_TYPE_LABELS[proposal.proposalType]}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: `${statusColor}20`,
              color: statusColor,
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {STATUS_LABELS[proposal.status]}
          </span>
        </div>
        <span style={{ color: '#8B8B8B', fontSize: '12px' }}>{timeLeft}</span>
      </div>

      {/* Title & Description */}
      <h4
        style={{
          color: '#E8E0D4',
          fontWeight: 700,
          fontSize: '16px',
          margin: '0 0 6px 0',
        }}
      >
        {proposal.title}
      </h4>
      <p
        style={{
          color: '#8B8B8B',
          fontSize: '13px',
          margin: '0 0 16px 0',
          lineHeight: 1.5,
        }}
      >
        {proposal.description}
      </p>

      {/* Vote progress bar */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
            fontSize: '12px',
          }}
        >
          <span style={{ color: '#4A9E4A' }}>
            For: {proposal.forVotes.toFixed(1)} ({forPercent.toFixed(1)}%)
          </span>
          <span style={{ color: '#CC3333' }}>
            Against: {proposal.againstVotes.toFixed(1)} ({againstPercent.toFixed(1)}%)
          </span>
        </div>
        <div
          style={{
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(204, 51, 51, 0.3)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${forPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4A9E4A, #5CB85C)',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#8B8B8B',
            marginTop: '4px',
            textAlign: 'center',
          }}
        >
          Quadratic weighted votes (sqrt of tokens used)
        </div>
      </div>

      {/* Voting section */}
      {canVote && (
        <>
          {/* Token amount input */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                color: '#8B8B8B',
                fontSize: '11px',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              TOKENS TO COMMIT (locked until voting ends)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(232, 224, 212, 0.15)',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#E8E0D4',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: '"Rajdhani", sans-serif',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setTokenAmount(String(userTokenBalance))}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(204, 153, 51, 0.3)',
                  background: 'transparent',
                  color: '#CC9933',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: '"Rajdhani", sans-serif',
                }}
              >
                MAX
              </button>
            </div>
            {previewAmount > 0 && (
              <div style={{ fontSize: '11px', color: '#CC9933', marginTop: '4px' }}>
                Vote power: {quadraticWeight.toFixed(2)} (sqrt of {previewAmount.toLocaleString()})
              </div>
            )}
          </div>

          {/* Vote buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleVote(true)}
              disabled={voting || previewAmount <= 0}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #4A9E4A, #3D8B3D)',
                color: '#111',
                fontWeight: 700,
                fontSize: '14px',
                cursor: voting ? 'wait' : 'pointer',
                opacity: previewAmount > 0 ? 1 : 0.5,
                fontFamily: '"Rajdhani", sans-serif',
                textTransform: 'uppercase',
              }}
            >
              Vote For
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={voting || previewAmount <= 0}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #CC3333, #AA2222)',
                color: '#111',
                fontWeight: 700,
                fontSize: '14px',
                cursor: voting ? 'wait' : 'pointer',
                opacity: previewAmount > 0 ? 1 : 0.5,
                fontFamily: '"Rajdhani", sans-serif',
                textTransform: 'uppercase',
              }}
            >
              Vote Against
            </button>
          </div>
        </>
      )}

      {/* Already voted */}
      {proposal.userVoted && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: `${proposal.userVoteSupport ? 'rgba(74, 158, 74, 0.1)' : 'rgba(204, 51, 51, 0.1)'}`,
            border: `1px solid ${proposal.userVoteSupport ? 'rgba(74, 158, 74, 0.2)' : 'rgba(204, 51, 51, 0.2)'}`,
            color: proposal.userVoteSupport ? '#4A9E4A' : '#CC3333',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          You voted {proposal.userVoteSupport ? 'FOR' : 'AGAINST'} this proposal
          {canWithdraw && (
            <button
              onClick={() => onWithdraw?.(proposal.id)}
              style={{
                display: 'block',
                margin: '8px auto 0',
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(232, 224, 212, 0.2)',
                background: 'transparent',
                color: '#E8E0D4',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: '"Rajdhani", sans-serif',
              }}
            >
              Withdraw Locked Tokens
            </button>
          )}
        </div>
      )}

      {/* Proposer + Timelock info */}
      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#8B8B8B',
        }}
      >
        <span>
          Proposed by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
        </span>
        {proposal.status === 'passed' && (
          <span style={{ color: '#6B8CCC' }}>12h timelock before execution</span>
        )}
      </div>
    </div>
  );
}
