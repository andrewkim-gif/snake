'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// --- Types ---

interface CouncilSeat {
  faction_id: string;
  faction_name: string;
  seat_type: 'permanent' | 'non_permanent' | 'observer';
  country_iso: string;
  has_veto: boolean;
}

interface Resolution {
  id: string;
  type: string;
  name: string;
  description: string;
  status: 'voting' | 'passed' | 'vetoed' | 'rejected' | 'expired';
  proposed_by: string;
  proposer_name: string;
  target_faction?: string;
  votes: Record<string, boolean>;
  vetoed_by?: string;
  created_at: string;
  voting_ends_at: string;
  effect_starts_at?: string;
  effect_expires_at?: string;
}

type ResolutionType = 'nuclear_ban' | 'free_trade' | 'peacekeeping' | 'economic_sanction' | 'climate_accord';

// --- Constants ---

const RESOLUTION_TYPES: { type: ResolutionType; name: string; icon: string; desc: string }[] = [
  { type: 'nuclear_ban', name: 'Nuclear Ban', icon: '☢️', desc: 'Disable Capital Siege' },
  { type: 'free_trade', name: 'Free Trade Act', icon: '🤝', desc: 'Trade fees -50%' },
  { type: 'peacekeeping', name: 'Peacekeeping', icon: '🕊️', desc: 'War declarations banned 48h' },
  { type: 'economic_sanction', name: 'Economic Sanction', icon: '🚫', desc: 'Block faction trade' },
  { type: 'climate_accord', name: 'Climate Accord', icon: '🌍', desc: 'Resources -10%, Tech +20%' },
];

const STATUS_COLORS: Record<string, string> = {
  voting: SK.blue,
  passed: SK.green,
  vetoed: SK.red,
  rejected: SK.textSecondary,
  expired: SK.textSecondary,
};

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

// --- Props ---

interface UNCouncilProps {
  factionId?: string;
  token?: string;
}

// --- Component ---

export default function UNCouncil({ factionId, token }: UNCouncilProps) {
  const [seats, setSeats] = useState<CouncilSeat[]>([]);
  const [votingResolutions, setVotingResolutions] = useState<Resolution[]>([]);
  const [historyResolutions, setHistoryResolutions] = useState<Resolution[]>([]);
  const [activeEffects, setActiveEffects] = useState<{
    capital_siege_disabled: boolean;
    war_declaration_banned: boolean;
    trade_fee_reduction: number;
  }>({ capital_siege_disabled: false, war_declaration_banned: false, trade_fee_reduction: 0 });
  const [proposing, setProposing] = useState(false);
  const [selectedType, setSelectedType] = useState<ResolutionType>('nuclear_ban');
  const [targetFaction, setTargetFaction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'council' | 'voting' | 'history'>('council');

  // Fetch seats
  useEffect(() => {
    fetch(`${SERVER_URL}/api/council/seats`)
      .then(res => res.json())
      .then(data => setSeats(data.seats || []))
      .catch(() => {});
  }, []);

  // Fetch resolutions
  const fetchResolutions = useCallback(() => {
    fetch(`${SERVER_URL}/api/council/resolutions`)
      .then(res => res.json())
      .then(data => {
        setVotingResolutions(data.voting || []);
        setHistoryResolutions(data.history || []);
      })
      .catch(() => {});

    fetch(`${SERVER_URL}/api/council/active`)
      .then(res => res.json())
      .then(data => setActiveEffects({
        capital_siege_disabled: data.capital_siege_disabled || false,
        war_declaration_banned: data.war_declaration_banned || false,
        trade_fee_reduction: data.trade_fee_reduction || 0,
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchResolutions();
    const interval = setInterval(fetchResolutions, 30000);
    return () => clearInterval(interval);
  }, [fetchResolutions]);

  // Propose a resolution
  const handlePropose = async () => {
    if (!token || !factionId) return;
    setProposing(true);
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/council/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: selectedType,
          target_faction: selectedType === 'economic_sanction' ? targetFaction : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to propose');
      } else {
        fetchResolutions();
        setTab('voting');
      }
    } catch {
      setError('Network error');
    } finally {
      setProposing(false);
    }
  };

  // Cast a vote
  const handleVote = async (resolutionId: string, inFavor: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/council/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolution_id: resolutionId, in_favor: inFavor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Vote failed');
      } else {
        fetchResolutions();
      }
    } catch {
      setError('Network error');
    }
  };

  // Check if user's faction has a seat
  const userSeat = seats.find(s => s.faction_id === factionId);
  const canVote = !!userSeat && userSeat.seat_type !== 'observer';

  return (
    <div style={{
      background: SK.bg,
      border: sketchBorder(),
      borderRadius: radius.lg,
      padding: '24px',
      boxShadow: sketchShadow('md'),
    }}>
      {/* Header */}
      <h2 style={{
        fontFamily: headingFont,
        fontSize: '18px',
        color: SK.textPrimary,
        marginBottom: '6px',
      }}>
        UN Security Council
      </h2>

      {/* Active effects banner */}
      {(activeEffects.capital_siege_disabled || activeEffects.war_declaration_banned || activeEffects.trade_fee_reduction > 0) && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          background: `${SK.blue}22`,
          border: `1px solid ${SK.blue}`,
          borderRadius: radius.sm,
          fontFamily: bodyFont,
          fontSize: '11px',
          color: SK.blue,
        }}>
          Active Effects:
          {activeEffects.capital_siege_disabled && ' [Nuclear Ban] '}
          {activeEffects.war_declaration_banned && ' [Peacekeeping] '}
          {activeEffects.trade_fee_reduction > 0 && ` [Free Trade -${activeEffects.trade_fee_reduction * 100}%] `}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['council', 'voting', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px',
              fontFamily: headingFont,
              fontSize: '11px',
              background: tab === t ? SK.cardBg : 'transparent',
              color: tab === t ? SK.textPrimary : SK.textSecondary,
              border: `1px solid ${tab === t ? SK.border : 'transparent'}`,
              borderRadius: radius.sm,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t} {t === 'voting' && votingResolutions.length > 0 ? `(${votingResolutions.length})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          background: '#3a1a1a',
          border: `1px solid ${SK.red}`,
          borderRadius: radius.sm,
          fontFamily: bodyFont,
          fontSize: '12px',
          color: SK.red,
        }}>
          {error}
        </div>
      )}

      {/* Council Seats Tab */}
      {tab === 'council' && (
        <div>
          <div style={{ fontFamily: headingFont, fontSize: '13px', color: SK.textPrimary, marginBottom: '12px' }}>
            Permanent Members (Veto Power)
          </div>
          {seats.filter(s => s.seat_type === 'permanent').map(seat => (
            <div key={seat.faction_id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginBottom: '6px',
              background: SK.cardBg,
              borderRadius: radius.sm,
              border: `1px solid ${SK.border}`,
            }}>
              <span style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.textPrimary }}>
                {seat.country_iso} - {seat.faction_name || seat.faction_id}
              </span>
              <span style={{ fontFamily: bodyFont, fontSize: '11px', color: SK.gold }}>
                VETO
              </span>
            </div>
          ))}

          <div style={{ fontFamily: headingFont, fontSize: '13px', color: SK.textPrimary, margin: '16px 0 12px' }}>
            Non-Permanent Members
          </div>
          {seats.filter(s => s.seat_type === 'non_permanent').map(seat => (
            <div key={seat.faction_id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginBottom: '6px',
              background: SK.bgWarm,
              borderRadius: radius.sm,
            }}>
              <span style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.textPrimary }}>
                {seat.country_iso} - {seat.faction_name || seat.faction_id}
              </span>
              <span style={{ fontFamily: bodyFont, fontSize: '11px', color: SK.textSecondary }}>
                MEMBER
              </span>
            </div>
          ))}

          {/* Propose button */}
          {canVote && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontFamily: headingFont, fontSize: '13px', color: SK.textPrimary, marginBottom: '8px' }}>
                Propose Resolution
              </div>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value as ResolutionType)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontFamily: bodyFont,
                  fontSize: '12px',
                  background: SK.bgWarm,
                  color: SK.textPrimary,
                  border: `1px solid ${SK.border}`,
                  borderRadius: radius.sm,
                  marginBottom: '8px',
                }}
              >
                {RESOLUTION_TYPES.map(rt => (
                  <option key={rt.type} value={rt.type}>
                    {rt.icon} {rt.name} - {rt.desc}
                  </option>
                ))}
              </select>

              {selectedType === 'economic_sanction' && (
                <input
                  type="text"
                  placeholder="Target Faction ID"
                  value={targetFaction}
                  onChange={e => setTargetFaction(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontFamily: bodyFont,
                    fontSize: '12px',
                    background: SK.bgWarm,
                    color: SK.textPrimary,
                    border: `1px solid ${SK.border}`,
                    borderRadius: radius.sm,
                    marginBottom: '8px',
                  }}
                />
              )}

              <button
                onClick={handlePropose}
                disabled={proposing}
                style={{
                  padding: '8px 20px',
                  fontFamily: headingFont,
                  fontSize: '12px',
                  background: proposing ? SK.bgWarm : SK.blue,
                  color: '#fff',
                  border: 'none',
                  borderRadius: radius.sm,
                  cursor: proposing ? 'not-allowed' : 'pointer',
                }}
              >
                {proposing ? 'Submitting...' : 'Submit Resolution'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Voting Tab */}
      {tab === 'voting' && (
        <div>
          {votingResolutions.length === 0 ? (
            <div style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.textSecondary, textAlign: 'center', padding: '24px' }}>
              No active votes
            </div>
          ) : (
            votingResolutions.map(res => {
              const yesCount = Object.values(res.votes).filter(v => v).length;
              const noCount = Object.values(res.votes).filter(v => !v).length;
              const hasVoted = factionId ? res.votes[factionId] !== undefined : false;

              return (
                <div key={res.id} style={{
                  padding: '14px',
                  marginBottom: '10px',
                  background: SK.cardBg,
                  border: `1px solid ${SK.border}`,
                  borderRadius: radius.md,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontFamily: headingFont, fontSize: '13px', color: SK.textPrimary }}>
                      {res.name}
                    </span>
                    <span style={{ fontFamily: bodyFont, fontSize: '11px', color: SK.blue }}>
                      VOTING
                    </span>
                  </div>
                  <div style={{ fontFamily: bodyFont, fontSize: '11px', color: SK.textSecondary, marginBottom: '8px' }}>
                    {res.description} | Proposed by {res.proposer_name || res.proposed_by}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.green }}>
                      YES: {yesCount}
                    </span>
                    <span style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.red }}>
                      NO: {noCount}
                    </span>
                  </div>

                  {canVote && !hasVoted && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleVote(res.id, true)}
                        style={{
                          padding: '6px 16px',
                          fontFamily: headingFont,
                          fontSize: '11px',
                          background: SK.green,
                          color: '#fff',
                          border: 'none',
                          borderRadius: radius.sm,
                          cursor: 'pointer',
                        }}
                      >
                        Vote YES
                      </button>
                      <button
                        onClick={() => handleVote(res.id, false)}
                        style={{
                          padding: '6px 16px',
                          fontFamily: headingFont,
                          fontSize: '11px',
                          background: SK.red,
                          color: '#fff',
                          border: 'none',
                          borderRadius: radius.sm,
                          cursor: 'pointer',
                        }}
                      >
                        Vote NO {userSeat?.has_veto ? '(VETO)' : ''}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div>
          {historyResolutions.length === 0 ? (
            <div style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.textSecondary, textAlign: 'center', padding: '24px' }}>
              No resolution history
            </div>
          ) : (
            historyResolutions.map(res => (
              <div key={res.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginBottom: '4px',
                background: SK.bgWarm,
                borderRadius: radius.sm,
              }}>
                <span style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.textPrimary }}>
                  {res.name}
                </span>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '11px',
                  color: STATUS_COLORS[res.status] || SK.textSecondary,
                  textTransform: 'uppercase',
                }}>
                  {res.status} {res.vetoed_by ? `(veto: ${res.vetoed_by})` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
