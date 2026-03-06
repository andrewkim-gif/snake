'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// --- Types ---

interface FactionMember {
  user_id: string;
  username: string;
  role: 'supreme_leader' | 'council' | 'commander' | 'member';
  joined_at: string;
}

interface ResourceBundle {
  gold: number;
  oil: number;
  minerals: number;
  food: number;
  tech: number;
  influence: number;
}

interface Faction {
  id: string;
  name: string;
  tag: string;
  color: string;
  leader_id: string;
  treasury: ResourceBundle;
  prestige: number;
  member_count: number;
  territory_count: number;
  total_gdp: number;
}

interface Treaty {
  id: string;
  type: string;
  faction_a: string;
  faction_b: string;
  status: string;
  started_at: string;
  expires_at: string;
}

interface WarRecord {
  id: string;
  attacker_id: string;
  attacker_name: string;
  defender_id: string;
  defender_name: string;
  status: string;
  declared_at: string;
  end_reason?: string;
  winner_id?: string;
}

// --- Props ---

interface FactionDashboardProps {
  serverUrl: string;
  factionId: string;
  currentUserId: string;
  authToken: string;
  onClose?: () => void;
}

type DashTab = 'members' | 'territory' | 'diplomacy' | 'treasury' | 'war';

const ROLE_LABELS: Record<string, { label: string; color: string; rank: number }> = {
  supreme_leader: { label: 'SUPREME LEADER', color: SK.gold, rank: 4 },
  council: { label: 'COUNCIL', color: SK.orangeLight, rank: 3 },
  commander: { label: 'COMMANDER', color: SK.blue, rank: 2 },
  member: { label: 'MEMBER', color: SK.textSecondary, rank: 1 },
};

const TREATY_LABELS: Record<string, { label: string; color: string }> = {
  non_aggression: { label: 'Non-Aggression Pact', color: SK.blue },
  trade_agreement: { label: 'Trade Agreement', color: SK.green },
  military_alliance: { label: 'Military Alliance', color: SK.gold },
  economic_sanction: { label: 'Economic Sanction', color: SK.red },
  tribute: { label: 'Tribute', color: SK.orangeDark },
};

/** FactionDashboard — 팩션 관리 대시보드 */
export default function FactionDashboard({
  serverUrl, factionId, currentUserId, authToken, onClose,
}: FactionDashboardProps) {
  const [tab, setTab] = useState<DashTab>('members');
  const [faction, setFaction] = useState<Faction | null>(null);
  const [members, setMembers] = useState<FactionMember[]>([]);
  const [treaties, setTreaties] = useState<Treaty[]>([]);
  const [wars, setWars] = useState<WarRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  }), [authToken]);

  // Fetch all faction data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [facRes, treatyRes, warRes] = await Promise.all([
        fetch(`${serverUrl}/api/factions/${factionId}`),
        fetch(`${serverUrl}/api/diplomacy/treaties/${factionId}`, { headers: headers() }),
        fetch(`${serverUrl}/api/wars/faction/${factionId}`, { headers: headers() }),
      ]);

      if (facRes.ok) {
        const d = await facRes.json();
        setFaction(d.faction);
        setMembers(d.members || []);
      }
      if (treatyRes.ok) {
        const d = await treatyRes.json();
        setTreaties(d.treaties || []);
      }
      if (warRes.ok) {
        const d = await warRes.json();
        setWars(d.wars || []);
      }
    } catch {
      // Silently handle fetch errors for now
    } finally {
      setLoading(false);
    }
  }, [serverUrl, factionId, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Permission check
  const myRole = members.find((m) => m.user_id === currentUserId)?.role;
  const myRank = myRole ? (ROLE_LABELS[myRole]?.rank ?? 0) : 0;
  const isCouncilPlus = myRank >= 3;
  const isLeader = myRole === 'supreme_leader';

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...panelStyle, padding: 40, textAlign: 'center' }}>
          <span style={{ color: SK.textSecondary, fontFamily: bodyFont }}>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!faction) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...panelStyle, padding: 40, textAlign: 'center' }}>
          <span style={{ color: SK.red, fontFamily: bodyFont }}>Faction not found</span>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
          borderBottom: sketchBorder(),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 24, background: faction.color, borderRadius: radius.sm }} />
            <h2 style={{
              fontFamily: headingFont, fontSize: SKFont.h3, color: SK.textPrimary,
              margin: 0, letterSpacing: '1px',
            }}>
              {faction.name}
            </h2>
            <span style={{
              fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted,
            }}>
              [{faction.tag}]
            </span>
          </div>
          {onClose && (
            <button onClick={onClose} style={closeBtnStyle}>X</button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: sketchBorder(),
          padding: '0 8px',
        }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 14px',
                fontFamily: headingFont, fontSize: SKFont.xs,
                color: tab === key ? SK.gold : SK.textMuted,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === key ? `2px solid ${SK.gold}` : '2px solid transparent',
                letterSpacing: '1px',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          {tab === 'members' && (
            <MembersPanel
              members={members}
              currentUserId={currentUserId}
              isCouncilPlus={isCouncilPlus}
              serverUrl={serverUrl}
              factionId={factionId}
              headers={headers()}
              onRefresh={fetchData}
            />
          )}
          {tab === 'territory' && (
            <TerritoryPanel faction={faction} />
          )}
          {tab === 'diplomacy' && (
            <DiplomacyPanel
              treaties={treaties}
              factionId={factionId}
              isCouncilPlus={isCouncilPlus}
              serverUrl={serverUrl}
              headers={headers()}
              onRefresh={fetchData}
            />
          )}
          {tab === 'treasury' && (
            <TreasuryPanel
              treasury={faction.treasury}
              isCouncilPlus={isCouncilPlus}
              serverUrl={serverUrl}
              factionId={factionId}
              headers={headers()}
              onRefresh={fetchData}
            />
          )}
          {tab === 'war' && (
            <WarPanel
              wars={wars}
              factionId={factionId}
              isLeader={isLeader}
              isCouncilPlus={isCouncilPlus}
              serverUrl={serverUrl}
              headers={headers()}
              onRefresh={fetchData}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Tab definitions ---

const TABS: { key: DashTab; label: string }[] = [
  { key: 'members', label: 'MEMBERS' },
  { key: 'territory', label: 'TERRITORY' },
  { key: 'diplomacy', label: 'DIPLOMACY' },
  { key: 'treasury', label: 'TREASURY' },
  { key: 'war', label: 'WAR' },
];

// --- Sub-panels ---

/** Members management panel */
function MembersPanel({
  members, currentUserId, isCouncilPlus, serverUrl, factionId, headers, onRefresh,
}: {
  members: FactionMember[];
  currentUserId: string;
  isCouncilPlus: boolean;
  serverUrl: string;
  factionId: string;
  headers: Record<string, string>;
  onRefresh: () => void;
}) {
  const handleKick = async (targetId: string) => {
    try {
      await fetch(`${serverUrl}/api/factions/${factionId}/kick`, {
        method: 'POST', headers,
        body: JSON.stringify({ target_user_id: targetId }),
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  const handlePromote = async (targetId: string, newRole: string) => {
    try {
      await fetch(`${serverUrl}/api/factions/${factionId}/promote`, {
        method: 'POST', headers,
        body: JSON.stringify({ target_user_id: targetId, new_role: newRole }),
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  const sorted = [...members].sort((a, b) => {
    return (ROLE_LABELS[b.role]?.rank ?? 0) - (ROLE_LABELS[a.role]?.rank ?? 0);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary, letterSpacing: '1px', marginBottom: 4 }}>
        MEMBER ROSTER ({members.length})
      </div>
      {sorted.map((m) => {
        const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS.member;
        const isMe = m.user_id === currentUserId;
        const canKick = isCouncilPlus && !isMe && m.role !== 'supreme_leader';

        return (
          <div key={m.user_id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', borderRadius: radius.sm,
            background: isMe ? 'rgba(204, 153, 51, 0.06)' : 'transparent',
            border: sketchBorder(SK.borderDark),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textPrimary }}>
                {m.username || m.user_id.slice(0, 8)}
              </span>
              <span style={{
                fontFamily: bodyFont, fontSize: SKFont.xs, color: roleInfo.color,
                padding: '1px 6px', borderRadius: radius.sm,
                background: `${roleInfo.color}18`,
              }}>
                {roleInfo.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {isCouncilPlus && !isMe && m.role === 'member' && (
                <SmallBtn label="CMD" color={SK.blue} onClick={() => handlePromote(m.user_id, 'commander')} />
              )}
              {canKick && (
                <SmallBtn label="KICK" color={SK.red} onClick={() => handleKick(m.user_id)} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Territory overview panel */
function TerritoryPanel({ faction }: { faction: Faction }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary, letterSpacing: '1px' }}>
        TERRITORY STATUS
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <StatCard label="Countries Controlled" value={String(faction.territory_count)} color={SK.green} />
        <StatCard label="Total GDP" value={`${(faction.total_gdp / 1000).toFixed(1)}K`} color={SK.gold} />
        <StatCard label="Prestige" value={String(faction.prestige)} color={SK.orangeLight} />
        <StatCard label="Members" value={String(faction.member_count)} color={SK.blue} />
      </div>
      <div style={{
        fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted,
        padding: 12, textAlign: 'center',
        border: sketchBorder(SK.borderDark), borderRadius: radius.md,
      }}>
        Territory map view available on the World Map screen.
      </div>
    </div>
  );
}

/** Diplomacy management panel */
function DiplomacyPanel({
  treaties, factionId, isCouncilPlus, serverUrl, headers, onRefresh,
}: {
  treaties: Treaty[];
  factionId: string;
  isCouncilPlus: boolean;
  serverUrl: string;
  headers: Record<string, string>;
  onRefresh: () => void;
}) {
  const handleBreak = async (treatyId: string) => {
    try {
      await fetch(`${serverUrl}/api/diplomacy/break`, {
        method: 'POST', headers,
        body: JSON.stringify({ treaty_id: treatyId }),
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary, letterSpacing: '1px' }}>
        ACTIVE TREATIES ({treaties.length})
      </div>
      {treaties.length === 0 ? (
        <div style={{ fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textMuted, textAlign: 'center', padding: 24 }}>
          No active diplomatic agreements.
        </div>
      ) : (
        treaties.map((t) => {
          const typeInfo = TREATY_LABELS[t.type] || { label: t.type, color: SK.textSecondary };
          const otherFaction = t.faction_a === factionId ? t.faction_b : t.faction_a;

          return (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderRadius: radius.sm,
              border: sketchBorder(SK.borderDark),
            }}>
              <div>
                <div style={{
                  fontFamily: bodyFont, fontSize: SKFont.sm, color: typeInfo.color,
                  fontWeight: 600,
                }}>
                  {typeInfo.label}
                </div>
                <div style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted }}>
                  with {otherFaction.slice(0, 8)}...
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted }}>
                  {t.status}
                </span>
                {isCouncilPlus && t.status === 'active' && (
                  <SmallBtn label="BREAK" color={SK.red} onClick={() => handleBreak(t.id)} />
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Treasury panel with deposit/withdraw */
function TreasuryPanel({
  treasury, isCouncilPlus, serverUrl, factionId, headers, onRefresh,
}: {
  treasury: ResourceBundle;
  isCouncilPlus: boolean;
  serverUrl: string;
  factionId: string;
  headers: Record<string, string>;
  onRefresh: () => void;
}) {
  const [depositAmt, setDepositAmt] = useState(0);
  const [withdrawAmt, setWithdrawAmt] = useState(0);

  const handleDeposit = async () => {
    if (depositAmt <= 0) return;
    try {
      await fetch(`${serverUrl}/api/factions/${factionId}/deposit`, {
        method: 'POST', headers,
        body: JSON.stringify({ gold: depositAmt }),
      });
      setDepositAmt(0);
      onRefresh();
    } catch { /* ignore */ }
  };

  const handleWithdraw = async () => {
    if (withdrawAmt <= 0) return;
    try {
      await fetch(`${serverUrl}/api/factions/${factionId}/withdraw`, {
        method: 'POST', headers,
        body: JSON.stringify({ gold: withdrawAmt }),
      });
      setWithdrawAmt(0);
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary, letterSpacing: '1px' }}>
        FACTION TREASURY
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <ResourceCard label="Gold" value={treasury.gold} color={SK.gold} />
        <ResourceCard label="Oil" value={treasury.oil} color="#666" />
        <ResourceCard label="Minerals" value={treasury.minerals} color={SK.blue} />
        <ResourceCard label="Food" value={treasury.food} color={SK.green} />
        <ResourceCard label="Tech" value={treasury.tech} color={SK.orangeLight} />
        <ResourceCard label="Influence" value={treasury.influence} color="#AA66CC" />
      </div>

      {/* Deposit / Withdraw */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 0',
        borderTop: sketchBorder(SK.borderDark),
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted, display: 'block', marginBottom: 4 }}>
            Deposit Gold
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="number"
              value={depositAmt}
              onChange={(e) => setDepositAmt(Math.max(0, Number(e.target.value)))}
              style={inputStyle}
            />
            <button onClick={handleDeposit} style={{ ...actionBtnStyle, background: SK.green }}>
              DEPOSIT
            </button>
          </div>
        </div>
        {isCouncilPlus && (
          <div style={{ flex: 1 }}>
            <label style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted, display: 'block', marginBottom: 4 }}>
              Withdraw Gold
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(Math.max(0, Number(e.target.value)))}
                style={inputStyle}
              />
              <button onClick={handleWithdraw} style={{ ...actionBtnStyle, background: SK.orangeDark }}>
                WITHDRAW
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** War management panel */
function WarPanel({
  wars, factionId, isLeader, isCouncilPlus, serverUrl, headers, onRefresh,
}: {
  wars: WarRecord[];
  factionId: string;
  isLeader: boolean;
  isCouncilPlus: boolean;
  serverUrl: string;
  headers: Record<string, string>;
  onRefresh: () => void;
}) {
  const [targetFaction, setTargetFaction] = useState('');

  const handleDeclare = async () => {
    if (!targetFaction.trim()) return;
    try {
      await fetch(`${serverUrl}/api/wars/declare`, {
        method: 'POST', headers,
        body: JSON.stringify({ defender_faction_id: targetFaction.trim() }),
      });
      setTargetFaction('');
      onRefresh();
    } catch { /* ignore */ }
  };

  const handleSurrender = async (warId: string) => {
    try {
      await fetch(`${serverUrl}/api/wars/${warId}/surrender`, {
        method: 'POST', headers,
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  const handleCeasefire = async (warId: string) => {
    try {
      await fetch(`${serverUrl}/api/wars/${warId}/ceasefire`, {
        method: 'POST', headers,
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  const warStatusColor = (s: string) => {
    switch (s) {
      case 'declared': case 'preparing': return SK.orangeLight;
      case 'active': return SK.red;
      case 'ended': return SK.textMuted;
      default: return SK.textSecondary;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textSecondary, letterSpacing: '1px' }}>
        ACTIVE WARS ({wars.length})
      </div>

      {/* Declare war */}
      {isCouncilPlus && (
        <div style={{
          padding: 10, borderRadius: radius.md,
          border: sketchBorder(SK.borderDark),
        }}>
          <label style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted, display: 'block', marginBottom: 4 }}>
            Declare War (costs 300 Influence + 500 Oil)
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              placeholder="Target Faction ID"
              value={targetFaction}
              onChange={(e) => setTargetFaction(e.target.value)}
              style={inputStyle}
            />
            <button onClick={handleDeclare} style={{ ...actionBtnStyle, background: SK.red }}>
              DECLARE
            </button>
          </div>
        </div>
      )}

      {/* War list */}
      {wars.length === 0 ? (
        <div style={{ fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textMuted, textAlign: 'center', padding: 24 }}>
          No active wars. Peace prevails... for now.
        </div>
      ) : (
        wars.map((w) => {
          const isAttacker = w.attacker_id === factionId;
          const opponentName = isAttacker ? (w.defender_name || w.defender_id.slice(0, 8)) : (w.attacker_name || w.attacker_id.slice(0, 8));
          const role = isAttacker ? 'ATTACKER' : 'DEFENDER';

          return (
            <div key={w.id} style={{
              padding: '10px 12px', borderRadius: radius.md,
              border: sketchBorder(SK.borderDark),
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: headingFont, fontSize: SKFont.sm, color: SK.textPrimary }}>
                  vs {opponentName}
                </span>
                <span style={{
                  fontFamily: bodyFont, fontSize: SKFont.xs,
                  color: warStatusColor(w.status),
                  padding: '1px 6px', borderRadius: radius.sm,
                  background: `${warStatusColor(w.status)}18`,
                }}>
                  {w.status.toUpperCase()}
                </span>
              </div>
              <div style={{
                fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted,
                display: 'flex', gap: 12,
              }}>
                <span>Role: {role}</span>
                <span>Declared: {new Date(w.declared_at).toLocaleDateString()}</span>
              </div>
              {w.status !== 'ended' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {isCouncilPlus && (
                    <SmallBtn label="CEASEFIRE" color={SK.blue} onClick={() => handleCeasefire(w.id)} />
                  )}
                  {isLeader && (
                    <SmallBtn label="SURRENDER" color={SK.red} onClick={() => handleSurrender(w.id)} />
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// --- Shared micro components ---

function SmallBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        padding: '3px 8px',
        fontFamily: bodyFont, fontSize: SKFont.xs,
        color: SK.textWhite, background: color,
        border: 'none', borderRadius: radius.sm, cursor: 'pointer',
        letterSpacing: '0.5px',
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: radius.md,
      background: SK.cardBg, border: sketchBorder(SK.borderDark),
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: headingFont, fontSize: SKFont.h3, color }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ResourceCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: radius.sm,
      background: 'rgba(255,255,255,0.02)',
      display: 'flex', justifyContent: 'space-between',
    }}>
      <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted }}>{label}</span>
      <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color, fontWeight: 600 }}>{value.toLocaleString()}</span>
    </div>
  );
}

// --- Shared styles ---

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: SK.overlay,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
};

const panelStyle: React.CSSProperties = {
  width: '90vw', maxWidth: 640,
  maxHeight: '85vh',
  background: SK.bg,
  border: sketchBorder(),
  borderRadius: radius.lg,
  boxShadow: sketchShadow('lg'),
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: SK.textMuted, fontFamily: headingFont, fontSize: SKFont.body,
  cursor: 'pointer', padding: '4px 8px',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontFamily: bodyFont, fontSize: SKFont.sm,
  color: SK.textPrimary,
  background: SK.cardBg,
  border: sketchBorder(),
  borderRadius: radius.sm,
  outline: 'none',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontFamily: headingFont, fontSize: SKFont.xs,
  color: SK.textWhite,
  border: 'none', borderRadius: radius.sm, cursor: 'pointer',
  letterSpacing: '0.5px',
  flexShrink: 0,
};
