'use client';

import { useState, useCallback } from 'react';
import {
  CROSSX_LINKS,
  formatTokenAmount,
  defenseMultiplierToPercent,
  openCrossx,
  isCrossxAvailable,
  type StakingInfo,
} from '@/lib/crossx-config';

interface StakingPanelProps {
  iso3: string;
  tokenName: string;
  tokenSymbol: string;
  stakingInfo: StakingInfo;
  userBalance: string;
  treasuryAddress: string;
  defenseMultiplier: number;
  onStake?: (amount: string) => void;
  onUnstake?: (amount: string) => void;
  onClaimRewards?: () => void;
  className?: string;
}

type Tab = 'stake' | 'unstake';

/**
 * Staking Panel
 * Stake/Unstake national tokens + claim rewards
 */
export default function StakingPanel({
  iso3,
  tokenName,
  tokenSymbol,
  stakingInfo,
  userBalance,
  treasuryAddress,
  defenseMultiplier,
  onStake,
  onUnstake,
  onClaimRewards,
  className = '',
}: StakingPanelProps) {
  const [tab, setTab] = useState<Tab>('stake');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const maxAmount = tab === 'stake' ? userBalance : stakingInfo.userStaked;

  const handleSubmit = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);

    if (isCrossxAvailable()) {
      // Deep link to CROSSx for on-chain transaction
      openCrossx(CROSSX_LINKS.stake(treasuryAddress, amount));
      setLoading(false);
      return;
    }

    // Local callback
    if (tab === 'stake') {
      onStake?.(amount);
    } else {
      onUnstake?.(amount);
    }

    setTimeout(() => {
      setLoading(false);
      setAmount('');
    }, 1500);
  }, [amount, tab, treasuryAddress, onStake, onUnstake]);

  const handleMax = useCallback(() => {
    setAmount(maxAmount);
  }, [maxAmount]);

  const aprPercent = (stakingInfo.apr / 100).toFixed(1);
  const pendingRewardDisplay = formatTokenAmount(stakingInfo.pendingReward);
  const hasPendingReward = parseFloat(stakingInfo.pendingReward) > 0;

  return (
    <div
      className={className}
      style={{
        background: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(232, 224, 212, 0.1)',
        borderRadius: 0,
        padding: '20px',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ color: '#E8E0D4', fontWeight: 700, fontSize: '16px' }}>
            Stake ${tokenSymbol}
          </div>
          <div style={{ color: '#8B8B8B', fontSize: '12px' }}>
            {tokenName} — {iso3}
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 0,
            background: 'rgba(74, 158, 74, 0.15)',
            border: '1px solid rgba(74, 158, 74, 0.3)',
            color: '#4A9E4A',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {aprPercent}% APR
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 0,
        }}
      >
        <div>
          <div style={{ color: '#8B8B8B', fontSize: '11px', marginBottom: '4px' }}>
            Total Staked
          </div>
          <div style={{ color: '#E8E0D4', fontWeight: 600, fontSize: '14px' }}>
            {formatTokenAmount(stakingInfo.totalStaked)}
          </div>
        </div>
        <div>
          <div style={{ color: '#8B8B8B', fontSize: '11px', marginBottom: '4px' }}>
            Your Stake
          </div>
          <div style={{ color: '#CC9933', fontWeight: 600, fontSize: '14px' }}>
            {formatTokenAmount(stakingInfo.userStaked)}
          </div>
        </div>
        <div>
          <div style={{ color: '#8B8B8B', fontSize: '11px', marginBottom: '4px' }}>
            Defense Buff
          </div>
          <div style={{ color: '#4A9E4A', fontWeight: 600, fontSize: '14px' }}>
            {defenseMultiplierToPercent(defenseMultiplier)}
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '12px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 0,
          padding: '3px',
        }}
      >
        {(['stake', 'unstake'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 0,
              border: 'none',
              background: tab === t ? 'rgba(204, 153, 51, 0.2)' : 'transparent',
              color: tab === t ? '#CC9933' : '#8B8B8B',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
              fontFamily: '"Rajdhani", sans-serif',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%',
              padding: '10px 60px 10px 12px',
              borderRadius: 0,
              border: '1px solid rgba(232, 224, 212, 0.15)',
              background: 'rgba(255,255,255,0.03)',
              color: '#E8E0D4',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: '"Rajdhani", sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleMax}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '3px 8px',
              borderRadius: 0,
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
      </div>

      {/* Available balance */}
      <div
        style={{
          fontSize: '12px',
          color: '#8B8B8B',
          marginBottom: '16px',
          paddingLeft: '4px',
        }}
      >
        Available: {formatTokenAmount(maxAmount)} ${tokenSymbol}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !amount || parseFloat(amount) <= 0}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 0,
          border: 'none',
          background: tab === 'stake'
            ? 'linear-gradient(135deg, #CC9933, #B8862D)'
            : 'linear-gradient(135deg, #CC3333, #AA2222)',
          color: '#111',
          fontWeight: 700,
          fontSize: '15px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading || !amount || parseFloat(amount) <= 0 ? 0.5 : 1,
          transition: 'opacity 0.15s',
          fontFamily: '"Rajdhani", sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        {loading
          ? 'Processing...'
          : tab === 'stake'
            ? `Stake ${tokenSymbol}`
            : `Unstake ${tokenSymbol}`}
      </button>

      {/* Pending rewards */}
      {hasPendingReward && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 12px',
            background: 'rgba(74, 158, 74, 0.08)',
            borderRadius: 0,
            border: '1px solid rgba(74, 158, 74, 0.2)',
          }}
        >
          <div>
            <div style={{ color: '#8B8B8B', fontSize: '11px' }}>
              Pending Rewards
            </div>
            <div style={{ color: '#4A9E4A', fontWeight: 700, fontSize: '16px' }}>
              {pendingRewardDisplay} ${tokenSymbol}
            </div>
          </div>
          <button
            onClick={onClaimRewards}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: '1px solid #4A9E4A',
              background: 'rgba(74, 158, 74, 0.2)',
              color: '#4A9E4A',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: '"Rajdhani", sans-serif',
            }}
          >
            Claim
          </button>
        </div>
      )}
    </div>
  );
}
