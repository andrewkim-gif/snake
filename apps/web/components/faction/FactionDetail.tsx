'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

/** Faction member from the server */
interface FactionMember {
  user_id: string;
  username: string;
  role: 'supreme_leader' | 'council' | 'commander' | 'member';
  joined_at: string;
}

/** Faction data */
interface Faction {
  id: string;
  name: string;
  tag: string;
  color: string;
  leader_id: string;
  treasury: {
    gold: number;
    oil: number;
    minerals: number;
    food: number;
    tech: number;
    influence: number;
  };
  prestige: number;
  member_count: number;
  territory_count: number;
  total_gdp: number;
}

interface FactionDetailProps {
  serverUrl: string;
  factionId: string;
  currentUserId?: string;
  onBack?: () => void;
  onJoin?: (factionId: string) => void;
  onLeave?: () => void;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  supreme_leader: { label: 'SUPREME LEADER', color: SK.gold },
  council: { label: 'COUNCIL', color: SK.orangeLight },
  commander: { label: 'COMMANDER', color: SK.blue },
  member: { label: 'MEMBER', color: SK.textSecondary },
};

/** FactionDetail — 팩션 상세 (멤버 목록, 재정, 액션) */
export default function FactionDetail({
  serverUrl, factionId, currentUserId, onBack, onJoin, onLeave,
}: FactionDetailProps) {
  const [faction, setFaction] = useState<Faction | null>(null);
  const [members, setMembers] = useState<FactionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${serverUrl}/api/factions/${factionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFaction(data.faction);
      setMembers(data.members || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load faction');
    } finally {
      setLoading(false);
    }
  }, [serverUrl, factionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 20, textAlign: 'center' }}>
        Loading faction...
      </div>
    );
  }

  if (error || !faction) {
    return (
      <div style={{ color: SK.red, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 20, textAlign: 'center' }}>
        {error || 'Faction not found'}
      </div>
    );
  }

  const isMember = members.some((m) => m.user_id === currentUserId);
  const currentRole = members.find((m) => m.user_id === currentUserId)?.role;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: SK.textSecondary,
              fontFamily: bodyFont, fontSize: SKFont.sm, cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            &larr; BACK
          </button>
        )}
      </div>

      {/* Faction header card */}
      <div style={{
        padding: 16, background: SK.cardBg,
        border: sketchBorder(), borderRadius: radius.md,
        borderLeft: `4px solid ${faction.color}`,
        boxShadow: sketchShadow('md'),
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{
              fontFamily: headingFont, fontSize: SKFont.h2, color: SK.textPrimary,
              margin: 0, letterSpacing: '1px',
            }}>
              {faction.name}
            </h2>
            <span style={{
              fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textMuted,
            }}>
              [{faction.tag}]
            </span>
          </div>
          <div style={{
            fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.gold,
            textAlign: 'right',
          }}>
            <div>Prestige: {faction.prestige}</div>
            <div>Territories: {faction.territory_count}</div>
          </div>
        </div>
      </div>

      {/* Treasury */}
      <div style={{
        padding: 12, background: SK.cardBg,
        border: sketchBorder(), borderRadius: radius.md,
      }}>
        <div style={{
          fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary,
          marginBottom: 8, letterSpacing: '1px',
        }}>
          TREASURY
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          fontFamily: bodyFont, fontSize: SKFont.xs,
        }}>
          <ResourceBadge label="Gold" value={faction.treasury.gold} color={SK.gold} />
          <ResourceBadge label="Oil" value={faction.treasury.oil} color="#444" />
          <ResourceBadge label="Minerals" value={faction.treasury.minerals} color={SK.blue} />
          <ResourceBadge label="Food" value={faction.treasury.food} color={SK.green} />
          <ResourceBadge label="Tech" value={faction.treasury.tech} color={SK.orangeLight} />
          <ResourceBadge label="Influence" value={faction.treasury.influence} color="#AA66CC" />
        </div>
      </div>

      {/* Members */}
      <div style={{
        padding: 12, background: SK.cardBg,
        border: sketchBorder(), borderRadius: radius.md,
      }}>
        <div style={{
          fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary,
          marginBottom: 8, letterSpacing: '1px',
        }}>
          MEMBERS ({faction.member_count})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {members.map((m) => {
            const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS.member;
            return (
              <div key={m.user_id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', borderRadius: radius.sm,
                background: m.user_id === currentUserId ? 'rgba(204, 153, 51, 0.08)' : 'transparent',
              }}>
                <span style={{ fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textPrimary }}>
                  {m.username || m.user_id.slice(0, 8)}
                </span>
                <span style={{
                  fontFamily: bodyFont, fontSize: SKFont.xs,
                  color: roleInfo.color, letterSpacing: '0.5px',
                }}>
                  {roleInfo.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!isMember && onJoin && (
          <button
            onClick={() => onJoin(faction.id)}
            style={{
              flex: 1, padding: '10px 16px',
              background: SK.green, color: SK.textWhite,
              fontFamily: headingFont, fontSize: SKFont.sm,
              border: 'none', borderRadius: radius.md, cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            JOIN FACTION
          </button>
        )}
        {isMember && currentRole !== 'supreme_leader' && onLeave && (
          <button
            onClick={onLeave}
            style={{
              flex: 1, padding: '10px 16px',
              background: SK.red, color: SK.textWhite,
              fontFamily: headingFont, fontSize: SKFont.sm,
              border: 'none', borderRadius: radius.md, cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            LEAVE FACTION
          </button>
        )}
      </div>
    </div>
  );
}

/** Small resource badge */
function ResourceBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px', borderRadius: radius.sm,
      background: 'rgba(255,255,255,0.03)',
    }}>
      <span style={{ color: SK.textMuted }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value.toLocaleString()}</span>
    </div>
  );
}
