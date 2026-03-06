'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// --- Types ---

interface Mercenary {
  id: string;
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  dps: number;
  hp: number;
  level: number;
  build: string;
  hire_cost: number;
  hired_by?: string;
  deployed_at?: string;
  hired_at?: string;
  contract_ends_at?: string;
  is_deployed: boolean;
  auto_defend: boolean;
}

// --- Constants ---

const TIER_CONFIG = {
  legendary: { label: 'Legendary', color: '#FFD700', bgColor: '#3a2f00' },
  gold: { label: 'Gold', color: '#FFA500', bgColor: '#3a2500' },
  silver: { label: 'Silver', color: '#C0C0C0', bgColor: '#2a2a2a' },
  bronze: { label: 'Bronze', color: '#CD7F32', bgColor: '#2a1f0a' },
} as const;

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

// --- Props ---

interface MercenaryMarketProps {
  factionId?: string;
  token?: string;
}

// --- Component ---

export default function MercenaryMarket({ factionId, token }: MercenaryMarketProps) {
  const [available, setAvailable] = useState<Mercenary[]>([]);
  const [myMercs, setMyMercs] = useState<Mercenary[]>([]);
  const [tab, setTab] = useState<'market' | 'my-mercs'>('market');
  const [hiring, setHiring] = useState<string | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployCountry, setDeployCountry] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch available mercenaries
  const fetchAvailable = useCallback(() => {
    fetch(`${SERVER_URL}/api/mercenaries/available`)
      .then(res => res.json())
      .then(data => setAvailable(data.mercenaries || []))
      .catch(() => {});
  }, []);

  // Fetch my mercenaries
  const fetchMyMercs = useCallback(() => {
    if (!token || !factionId) return;
    fetch(`${SERVER_URL}/api/mercenaries/my-mercs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setMyMercs(data.mercenaries || []))
      .catch(() => {});
  }, [token, factionId]);

  useEffect(() => {
    fetchAvailable();
    fetchMyMercs();
  }, [fetchAvailable, fetchMyMercs]);

  // Hire a mercenary
  const handleHire = async (mercId: string) => {
    if (!token) return;
    setHiring(mercId);
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/mercenaries/hire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mercenary_id: mercId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Hire failed');
      } else {
        fetchAvailable();
        fetchMyMercs();
        setTab('my-mercs');
      }
    } catch {
      setError('Network error');
    } finally {
      setHiring(null);
    }
  };

  // Deploy a mercenary
  const handleDeploy = async (mercId: string) => {
    if (!token || !deployCountry) return;
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/mercenaries/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mercenary_id: mercId, country_iso: deployCountry }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Deploy failed');
      } else {
        fetchMyMercs();
        setDeploying(null);
        setDeployCountry('');
      }
    } catch {
      setError('Network error');
    }
  };

  // Dismiss a mercenary
  const handleDismiss = async (mercId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/mercenaries/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mercenary_id: mercId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Dismiss failed');
      } else {
        fetchMyMercs();
      }
    } catch {
      setError('Network error');
    }
  };

  // Render a mercenary card
  const MercCard = ({ merc, showHire, showActions }: { merc: Mercenary; showHire?: boolean; showActions?: boolean }) => {
    const tc = TIER_CONFIG[merc.tier];
    const isExpired = merc.contract_ends_at && new Date(merc.contract_ends_at) < new Date();

    return (
      <div style={{
        padding: '14px',
        background: tc.bgColor,
        border: `2px solid ${tc.color}`,
        borderRadius: radius.md,
        position: 'relative',
        opacity: isExpired ? 0.5 : 1,
      }}>
        {/* Tier badge */}
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '12px',
          background: tc.color,
          color: '#000',
          fontFamily: headingFont,
          fontSize: '9px',
          padding: '2px 8px',
          borderRadius: radius.sm,
          fontWeight: 'bold',
        }}>
          {tc.label}
        </div>

        {/* Name + Level */}
        <div style={{
          fontFamily: headingFont,
          fontSize: '14px',
          color: tc.color,
          marginBottom: '4px',
        }}>
          {merc.name}
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: '11px',
          color: SK.textSecondary,
          marginBottom: '8px',
        }}>
          Lv.{merc.level} {merc.build}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
          <div>
            <span style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textSecondary }}>DPS</span>
            <div style={{ fontFamily: headingFont, fontSize: '13px', color: SK.red }}>
              {merc.dps.toFixed(1)}
            </div>
          </div>
          <div>
            <span style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textSecondary }}>HP</span>
            <div style={{ fontFamily: headingFont, fontSize: '13px', color: SK.green }}>
              {merc.hp.toFixed(0)}
            </div>
          </div>
          <div>
            <span style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textSecondary }}>Cost</span>
            <div style={{ fontFamily: headingFont, fontSize: '13px', color: SK.gold }}>
              {merc.hire_cost}G
            </div>
          </div>
        </div>

        {/* Deployment status */}
        {merc.is_deployed && merc.deployed_at && (
          <div style={{
            fontFamily: bodyFont,
            fontSize: '11px',
            color: SK.blue,
            marginBottom: '6px',
          }}>
            Deployed: {merc.deployed_at} {merc.auto_defend ? '(Auto-Defend)' : ''}
          </div>
        )}

        {/* Hire button */}
        {showHire && token && (
          <button
            onClick={() => handleHire(merc.id)}
            disabled={hiring === merc.id}
            style={{
              width: '100%',
              padding: '8px',
              fontFamily: headingFont,
              fontSize: '11px',
              background: hiring === merc.id ? SK.bgWarm : tc.color,
              color: '#000',
              border: 'none',
              borderRadius: radius.sm,
              cursor: hiring === merc.id ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {hiring === merc.id ? 'Hiring...' : `Hire for ${merc.hire_cost} Gold`}
          </button>
        )}

        {/* Actions for owned mercs */}
        {showActions && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {!merc.is_deployed && (
              <>
                {deploying === merc.id ? (
                  <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <input
                      type="text"
                      placeholder="Country ISO (e.g. KOR)"
                      value={deployCountry}
                      onChange={e => setDeployCountry(e.target.value.toUpperCase())}
                      style={{
                        flex: 1,
                        padding: '6px',
                        fontFamily: bodyFont,
                        fontSize: '11px',
                        background: SK.bgWarm,
                        color: SK.textPrimary,
                        border: `1px solid ${SK.border}`,
                        borderRadius: radius.sm,
                      }}
                    />
                    <button
                      onClick={() => handleDeploy(merc.id)}
                      style={{
                        padding: '6px 12px',
                        fontFamily: headingFont,
                        fontSize: '10px',
                        background: SK.green,
                        color: '#fff',
                        border: 'none',
                        borderRadius: radius.sm,
                        cursor: 'pointer',
                      }}
                    >
                      Go
                    </button>
                    <button
                      onClick={() => { setDeploying(null); setDeployCountry(''); }}
                      style={{
                        padding: '6px 8px',
                        fontFamily: headingFont,
                        fontSize: '10px',
                        background: SK.bgWarm,
                        color: SK.textSecondary,
                        border: `1px solid ${SK.border}`,
                        borderRadius: radius.sm,
                        cursor: 'pointer',
                      }}
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeploying(merc.id)}
                    style={{
                      padding: '6px 12px',
                      fontFamily: headingFont,
                      fontSize: '10px',
                      background: SK.blue,
                      color: '#fff',
                      border: 'none',
                      borderRadius: radius.sm,
                      cursor: 'pointer',
                    }}
                  >
                    Deploy
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => handleDismiss(merc.id)}
              style={{
                padding: '6px 12px',
                fontFamily: headingFont,
                fontSize: '10px',
                background: SK.red,
                color: '#fff',
                border: 'none',
                borderRadius: radius.sm,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  };

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
        marginBottom: '16px',
      }}>
        Mercenary Guild
      </h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setTab('market')}
          style={{
            flex: 1,
            padding: '10px',
            fontFamily: headingFont,
            fontSize: '12px',
            background: tab === 'market' ? SK.cardBg : 'transparent',
            color: tab === 'market' ? SK.textPrimary : SK.textSecondary,
            border: `1px solid ${tab === 'market' ? SK.border : 'transparent'}`,
            borderRadius: radius.sm,
            cursor: 'pointer',
          }}
        >
          Available ({available.length})
        </button>
        <button
          onClick={() => setTab('my-mercs')}
          style={{
            flex: 1,
            padding: '10px',
            fontFamily: headingFont,
            fontSize: '12px',
            background: tab === 'my-mercs' ? SK.cardBg : 'transparent',
            color: tab === 'my-mercs' ? SK.textPrimary : SK.textSecondary,
            border: `1px solid ${tab === 'my-mercs' ? SK.border : 'transparent'}`,
            borderRadius: radius.sm,
            cursor: 'pointer',
          }}
        >
          My Mercs ({myMercs.length})
        </button>
      </div>

      {/* Error */}
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

      {/* Market Tab */}
      {tab === 'market' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px',
        }}>
          {available.length === 0 ? (
            <div style={{
              fontFamily: bodyFont,
              fontSize: '12px',
              color: SK.textSecondary,
              textAlign: 'center',
              padding: '24px',
              gridColumn: '1 / -1',
            }}>
              Market is refreshing... Check back soon.
            </div>
          ) : (
            available.map(merc => (
              <MercCard key={merc.id} merc={merc} showHire />
            ))
          )}
        </div>
      )}

      {/* My Mercs Tab */}
      {tab === 'my-mercs' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px',
        }}>
          {myMercs.length === 0 ? (
            <div style={{
              fontFamily: bodyFont,
              fontSize: '12px',
              color: SK.textSecondary,
              textAlign: 'center',
              padding: '24px',
              gridColumn: '1 / -1',
            }}>
              No hired mercenaries. Visit the market to hire some!
            </div>
          ) : (
            myMercs.map(merc => (
              <MercCard key={merc.id} merc={merc} showActions />
            ))
          )}
        </div>
      )}
    </div>
  );
}
