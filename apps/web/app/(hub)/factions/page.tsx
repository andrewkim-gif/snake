'use client';

/**
 * /factions — 팩션 목록 + 대시보드
 * DashboardPage + DetailModal + mock data 모듈 사용
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius, grid } from '@/lib/sketch-ui';
import { DashboardPage, DetailModal } from '@/components/hub';
import { MOCK_FACTIONS, MOCK_FACTION_DETAILS } from '@/lib/mock-data';
import type { MockFaction } from '@/lib/mock-data';
import { Swords, Users, MapPin, DollarSign } from 'lucide-react';

const FactionList = dynamic(() => import('@/components/faction/FactionList'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading faction list...
    </div>
  ),
});

const FactionDashboard = dynamic(() => import('@/components/faction/FactionDashboard'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading dashboard...
    </div>
  ),
});

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

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

export default function FactionsPage() {
  const tFaction = useTranslations('faction');
  const [selectedFaction, setSelectedFaction] = useState<MockFaction | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [useServerData, setUseServerData] = useState(!!SERVER_URL);

  const handleFactionSelect = useCallback((faction: { id: string }) => {
    const f = MOCK_FACTIONS.find((mf) => mf.id === faction.id);
    if (f) setSelectedFaction(f);
  }, []);

  const totalMembers = MOCK_FACTIONS.reduce((s, f) => s + f.member_count, 0);
  const totalTerritories = MOCK_FACTIONS.reduce((s, f) => s + f.territory_count, 0);
  const totalGdp = MOCK_FACTIONS.reduce((s, f) => s + f.total_gdp, 0);

  const selectedDetail = selectedFaction ? MOCK_FACTION_DETAILS[selectedFaction.id] : null;

  return (
    <DashboardPage
      icon={Swords}
      title={tFaction('title')}
      description={tFaction('subtitle')}
      accentColor="#EF4444"
      heroImage="/images/hero-factions.png"
      headerChildren={
        <button
          onClick={() => setUseServerData(!useServerData)}
          style={{
            padding: '4px 12px',
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
            background: 'transparent',
            border: sketchBorder(SK.borderDark),
            borderRadius: 0,
            cursor: 'pointer',
          }}
        >
          {useServerData ? tFaction('mockData') : tFaction('liveData')}
        </button>
      }
      stats={[
        { label: 'Active Factions', value: String(MOCK_FACTIONS.length), color: SK.textPrimary, icon: Swords },
        { label: 'Total Members', value: String(totalMembers), color: SK.blue, icon: Users },
        { label: 'Territories', value: String(totalTerritories), color: SK.green, icon: MapPin },
        { label: 'Combined GDP', value: `${(totalGdp / 1000).toFixed(0)}K`, color: SK.orange, icon: DollarSign },
      ]}
    >
      {/* 서버 데이터 모드 */}
      {useServerData && SERVER_URL ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FactionList
            serverUrl={SERVER_URL}
            selectedId={selectedFaction?.id ?? undefined}
            onSelect={handleFactionSelect}
          />
          {selectedFaction && showDashboard && (
            <FactionDashboard
              serverUrl={SERVER_URL}
              factionId={selectedFaction.id}
              currentUserId="local-user"
              authToken=""
              onClose={() => setShowDashboard(false)}
            />
          )}
        </div>
      ) : (
        /* Mock 데이터 모드: 팩션 카드 그리드 */
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
          {MOCK_FACTIONS.map((faction) => (
            <div
              key={faction.id}
              style={{
                background: SK.cardBg,
                border: sketchBorder(selectedFaction?.id === faction.id ? SK.blue : SK.border),
                borderRadius: 0,
                padding: 20,
                boxShadow: sketchShadow('sm'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: `4px solid ${faction.color}`,
              }}
              onClick={() => setSelectedFaction(faction)}
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
                  <div>P: {faction.prestige}</div>
                  <div>GDP {(faction.total_gdp / 1000).toFixed(1)}K</div>
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
                <span>{tFaction('territoriesCount', { count: faction.territory_count })}</span>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginBottom: 16,
              }}>
                <StarRating label={tFaction('military')} value={faction.military} />
                <StarRating label={tFaction('economyRating')} value={faction.economy} />
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFaction(faction);
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
      )}

      {/* DetailModal — 팩션 상세 */}
      <DetailModal
        open={!!selectedDetail}
        onClose={() => setSelectedFaction(null)}
        title={selectedDetail?.name}
        accentColor={selectedDetail?.color}
      >
        {selectedDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{
              fontFamily: bodyFont,
              fontSize: '13px',
              color: SK.textSecondary,
              margin: 0,
              lineHeight: 1.6,
            }}>
              {selectedDetail.description}
            </p>

            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
            }}>
              [{selectedDetail.tag}] &mdash; {tFaction('leader')}: {selectedDetail.leader}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              <StatItem label={tFaction('members')} value={String(selectedDetail.member_count)} color={SK.blue} />
              <StatItem label={tFaction('territory')} value={String(selectedDetail.territory_count)} color={SK.green} />
              <StatItem label={tFaction('prestige')} value={String(selectedDetail.prestige)} color={SK.gold} />
              <StatItem label={tFaction('totalGdp')} value={`${(selectedDetail.total_gdp / 1000).toFixed(1)}K`} color={SK.orange} />
            </div>

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
              <a
                href={`/factions/${selectedDetail.id}`}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  fontFamily: headingFont,
                  fontSize: SKFont.sm,
                  color: SK.textSecondary,
                  background: 'transparent',
                  border: sketchBorder(),
                  borderRadius: 0,
                  textDecoration: 'none',
                  textAlign: 'center',
                  letterSpacing: '1px',
                }}
              >
                {tFaction('viewDetail')}
              </a>
            </div>
          </div>
        )}
      </DetailModal>
    </DashboardPage>
  );
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
