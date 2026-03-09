'use client';

/**
 * /factions — 팩션 목록 + 대시보드
 * DashboardPage + DetailModal + API 연동 (mock fallback 제거)
 */

import { useState, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius, grid } from '@/lib/sketch-ui';
import { DetailModal } from '@/components/hub';
import { Users, Shield, Crown, Star, User } from 'lucide-react';
import { fetchFactions, fetchFaction, type FactionSummary, type FactionDetailResponse } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';

const FactionList = dynamic(() => import('@/components/faction/FactionList'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      ...
    </div>
  ),
});

const FactionDashboard = dynamic(() => import('@/components/faction/FactionDashboard'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      ...
    </div>
  ),
});

function StarRating({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted, width: 56 }}>
        {label}
      </span>
      <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, letterSpacing: '1px' }}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} style={{ color: i < value ? SK.gold : SK.textMuted }}>
            {i < value ? '\u2605' : '\u2606'}
          </span>
        ))}
      </span>
    </div>
  );
}

function FactionsPageInner() {
  const tFaction = useTranslations('faction');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // 서버에서 팩션 목록 가져오기
  const { data: factions, loading } = useApiData(fetchFactions, { refreshInterval: 30_000 });

  // 선택된 팩션 상세 가져오기
  const [selectedDetail, setSelectedDetail] = useState<FactionDetailResponse | null>(null);
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    fetchFaction(selectedId).then((d) => setSelectedDetail(d));
  }, [selectedId]);

  const handleFactionSelect = useCallback((faction: { id: string }) => {
    setSelectedId(faction.id);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
        Loading factions...
      </div>
    );
  }

  const factionList = factions ?? [];
  const factionCount = factionList.length;
  const totalMembers = factionList.reduce((s, f) => s + f.member_count, 0);
  const totalTerritories = factionList.reduce((s, f) => s + (f.territory_count ?? 0), 0);
  const totalGdp = factionList.reduce((s, f) => s + (f.total_gdp ?? 0), 0);

  // 목록에서 선택된 팩션 찾기 (카드 하이라이트용)
  const selectedFaction = factionList.find((f) => f.id === selectedId) ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: SK.bg,
        color: SK.textPrimary,
        fontFamily: bodyFont,
        padding: 24,
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: SKFont.h1,
            color: SK.gold,
            margin: 0,
          }}
        >
          Factions
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          Alliance standings, power rankings, and faction warfare
        </p>
      </header>

      {/* Tab content */}
      <main>
      {/* 팩션 카드 그리드 — 서버 데이터 기반 */}
      <div
        className="factions-card-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: grid.panel,
          gap: 16,
        }}
      >
        <style>{`
          @media (max-width: 767px) {
            .factions-card-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
          }
        `}</style>
        {factionList.map((faction) => (
          <div
            key={faction.id}
            style={{
              background: SK.cardBg,
              borderTop: `1px solid ${selectedId === faction.id ? SK.blue : SK.border}`,
              borderRight: `1px solid ${selectedId === faction.id ? SK.blue : SK.border}`,
              borderBottom: `1px solid ${selectedId === faction.id ? SK.blue : SK.border}`,
              borderLeft: `4px solid ${faction.color}`,
              borderRadius: 0,
              padding: 20,
              boxShadow: sketchShadow('sm'),
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setSelectedId(faction.id)}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}>
              <div>
                <h3 style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.body,
                  color: SK.textPrimary,
                  margin: 0,
                  letterSpacing: '1px',
                }}>
                  {faction.name}
                </h3>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textMuted,
                }}>
                  [{faction.tag}]
                </span>
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.gold,
                textAlign: 'right',
              }}>
                <div>{tFaction('prestige')}: {faction.prestige}</div>
                <div>{tFaction('totalGdp')} {((faction.total_gdp ?? 0) / 1000).toFixed(1)}K</div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: 16,
              marginBottom: 12,
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textSecondary,
            }}>
              <span>{tFaction('membersCount', { count: faction.member_count })}</span>
              <span>{tFaction('territoriesCount', { count: faction.territory_count ?? 0 })}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(faction.id);
              }}
              style={{
                display: 'inline-block',
                fontFamily: headingFont,
                fontSize: SKFont.xs,
                color: SK.blue,
                textDecoration: 'none',
                letterSpacing: '1px',
                padding: '6px 14px',
                border: `1px solid ${SK.blue}40`,
                borderRadius: 0,
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tFaction('viewDetail')}
            </button>
          </div>
        ))}
      </div>

      {/* DetailModal — 팩션 상세 (서버 API) */}
      <DetailModal
        open={!!selectedDetail}
        onClose={() => setSelectedId(null)}
        title={selectedDetail?.name ?? 'Faction Detail'}
        accentColor={selectedDetail?.color}
      >
        {selectedDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
            }}>
              [{selectedDetail.tag}] &mdash; {tFaction('leader')}: {selectedDetail.leader_id?.slice(0, 8) ?? 'N/A'}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              <StatItem label={tFaction('members')} value={String(selectedDetail.member_count)} color={SK.blue} />
              <StatItem label={tFaction('territory')} value={String(selectedDetail.territory_count ?? 0)} color={SK.green} />
              <StatItem label={tFaction('prestige')} value={String(selectedDetail.prestige)} color={SK.gold} />
              <StatItem label={tFaction('totalGdp')} value={`${((selectedDetail.total_gdp ?? 0) / 1000).toFixed(1)}K`} color={SK.orange} />
            </div>

            {/* 멤버 목록 */}
            {'members' in selectedDetail && (selectedDetail as FactionDetailResponse).members?.length > 0 && (
              <div>
                <div style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.xs,
                  color: SK.textSecondary,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Users size={14} />
                  MEMBERS ({(selectedDetail as FactionDetailResponse).members.length})
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}>
                  {(selectedDetail as FactionDetailResponse).members
                    .sort((a, b) => {
                      const order = { supreme_leader: 0, council: 1, commander: 2, member: 3 };
                      return (order[a.role] ?? 4) - (order[b.role] ?? 4);
                    })
                    .map((m) => (
                    <div
                      key={m.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: SK.bgWarm,
                        border: `1px solid ${SK.borderDark}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MemberRoleIcon role={m.role} />
                        <span style={{
                          fontFamily: bodyFont,
                          fontSize: SKFont.xs,
                          color: SK.textPrimary,
                        }}>
                          {m.username || m.user_id.slice(0, 8)}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: bodyFont,
                        fontSize: '10px',
                        color: getRoleColor(m.role),
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {m.role.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{
                flex: 1,
                padding: '10px 20px',
                fontFamily: headingFont,
                fontSize: SKFont.sm,
                color: SK.textWhite,
                background: SK.green,
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                letterSpacing: '1px',
              }}>
                {tFaction('joinFaction')}
              </button>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  fontFamily: headingFont,
                  fontSize: SKFont.sm,
                  color: SK.textSecondary,
                  background: 'transparent',
                  border: sketchBorder(),
                  borderRadius: 0,
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </DetailModal>
      </main>
    </div>
  );
}

export default function FactionsPage() {
  return (
    <ServerRequired>
      <Suspense
        fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
            ...
          </div>
        }
      >
        <FactionsPageInner />
      </Suspense>
    </ServerRequired>
  );
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'supreme_leader': return SK.gold;
    case 'council': return SK.orange;
    case 'commander': return SK.blue;
    default: return SK.textMuted;
  }
}

function MemberRoleIcon({ role }: { role: string }) {
  const color = getRoleColor(role);
  const size = 14;
  switch (role) {
    case 'supreme_leader': return <Crown size={size} color={color} />;
    case 'council': return <Shield size={size} color={color} />;
    case 'commander': return <Star size={size} color={color} />;
    default: return <User size={size} color={color} />;
  }
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: SK.bgWarm,
      borderRadius: 0,
      border: sketchBorder(SK.borderDark),
    }}>
      <div style={{
        fontFamily: headingFont,
        fontSize: '16px',
        color,
        marginBottom: 2,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textMuted,
      }}>
        {label}
      </div>
    </div>
  );
}
