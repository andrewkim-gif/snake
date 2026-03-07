'use client';

import { useState, useCallback } from 'react';
import { type ProposalType, PROPOSAL_TYPE_LABELS } from './types';

interface ProposalFormProps {
  iso3: string;
  tokenSymbol: string;
  minTokens: number; // Minimum tokens required to propose
  userBalance: number;
  onSubmit?: (data: {
    iso3: string;
    title: string;
    description: string;
    proposalType: ProposalType;
  }) => void;
  onCancel?: () => void;
}

/**
 * Proposal Form
 * Create a new governance proposal for a country
 */
export default function ProposalForm({
  iso3,
  tokenSymbol,
  minTokens,
  userBalance,
  onSubmit,
  onCancel,
}: ProposalFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposalType, setProposalType] = useState<ProposalType>('tax');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    title.trim().length >= 5 &&
    description.trim().length >= 10 &&
    userBalance >= minTokens &&
    !submitting;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitting(true);
    onSubmit?.({
      iso3,
      title: title.trim(),
      description: description.trim(),
      proposalType,
    });
    setTimeout(() => setSubmitting(false), 2000);
  }, [canSubmit, iso3, title, description, proposalType, onSubmit]);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 0,
    border: '1px solid rgba(232, 224, 212, 0.15)',
    background: 'rgba(255,255,255,0.03)',
    color: '#E8E0D4',
    fontSize: '14px',
    fontFamily: '"Rajdhani", sans-serif',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      style={{
        background: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(232, 224, 212, 0.1)',
        borderRadius: 0,
        padding: '20px',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ color: '#E8E0D4', fontWeight: 700, fontSize: '18px', margin: 0 }}>
          New Proposal — {iso3}
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8B8B8B',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        )}
      </div>

      {/* Proposal type selector */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#8B8B8B', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
          POLICY TYPE
        </label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(Object.entries(PROPOSAL_TYPE_LABELS) as [ProposalType, string][]).map(
            ([type, label]) => (
              <button
                key={type}
                onClick={() => setProposalType(type)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 0,
                  border: `1px solid ${proposalType === type ? '#CC9933' : 'rgba(232, 224, 212, 0.15)'}`,
                  background: proposalType === type ? 'rgba(204, 153, 51, 0.15)' : 'transparent',
                  color: proposalType === type ? '#CC9933' : '#8B8B8B',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: '"Rajdhani", sans-serif',
                }}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#8B8B8B', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
          TITLE
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Reduce tax rate to 15%"
          maxLength={100}
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#8B8B8B', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
          DESCRIPTION
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the proposed policy change and its expected impact..."
          maxLength={1000}
          rows={4}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: '80px',
          }}
        />
      </div>

      {/* Requirements notice */}
      {userBalance < minTokens && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 0,
            background: 'rgba(204, 51, 51, 0.1)',
            border: '1px solid rgba(204, 51, 51, 0.2)',
            color: '#CC3333',
            fontSize: '12px',
            marginBottom: '16px',
          }}
        >
          Requires at least {minTokens.toLocaleString()} ${tokenSymbol} to create a proposal.
          You have {userBalance.toLocaleString()}.
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 0,
              border: '1px solid rgba(232, 224, 212, 0.15)',
              background: 'transparent',
              color: '#8B8B8B',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: '"Rajdhani", sans-serif',
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            flex: 2,
            padding: '10px',
            borderRadius: 0,
            border: 'none',
            background: 'linear-gradient(135deg, #CC9933, #B8862D)',
            color: '#111',
            fontWeight: 700,
            fontSize: '14px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.5,
            fontFamily: '"Rajdhani", sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Proposal'}
        </button>
      </div>
    </div>
  );
}
