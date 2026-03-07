'use client';

/**
 * /factions — 팩션 목록 + 대시보드
 * PageHeader + DashPanel 통합 컴포넌트 사용
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';
import { PageHeader, StatCard } from '@/components/hub';
import { Swords, Users, MapPin, Award, DollarSign } from 'lucide-react';

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

interface MockFaction {
  id: string;
  name: string;
  tag: string;
  color: string;
  member_count: number;
  territory_count: number;
  military: number;
  economy: number;
  prestige: number;
  total_gdp: number;
}

const MOCK_FACTIONS: MockFaction[] = [
  { id: 'east-asia', name: 'East Asia Coalition', tag: 'EAC', color: '#FF6B6B', member_count: 38, territory_count: 12, military: 4, economy: 5, prestige: 2400, total_gdp: 45000 },
  { id: 'nato-alliance', name: 'NATO Alliance', tag: 'NATO', color: '#3B82F6', member_count: 31, territory_count: 28, military: 5, economy: 4, prestige: 3200, total_gdp: 62000 },
  { id: 'brics-pact', name: 'BRICS Pact', tag: 'BRICS', color: '#10B981', member_count: 22, territory_count: 15, military: 3, economy: 4, prestige: 1800, total_gdp: 38000 },
  { id: 'african-union', name: 'African Union', tag: 'AU', color: '#F59E0B', member_count: 54, territory_count: 40, military: 2, economy: 3, prestige: 1200, total_gdp: 18000 },
  { id: 'nordic-council', name: 'Nordic Council', tag: 'NORD', color: '#8B5CF6', member_count: 5, territory_count: 5, military: 3, economy: 5, prestige: 900, total_gdp: 12000 },
  { id: 'mercosur', name: 'Mercosur Alliance', tag: 'MER', color: '#06B6D4', member_count: 8, territory_count: 6, military: 2, economy: 3, prestige: 750, total_gdp: 9500 },
];

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
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [useServerData, setUseServerData] = useState(!!SERVER_URL);

  const handleFactionSelect = useCallback((faction: { id: string }) => {
    setSelectedFactionId(faction.id);
  }, []);

  // 집계 통계
  const totalMembers = MOCK_FACTIONS.reduce((s, f) => s + f.member_count, 0);
  const totalTerritories = MOCK_FACTIONS.reduce((s, f) => s + f.territory_count, 0);
  const totalGdp = MOCK_FACTIONS.reduce((s, f) => s + f.total_gdp, 0);

  return (
    <div>
      <PageHeader
        icon={Swords}
        title={tFaction('title')}
        description={tFaction('subtitle')}
        accentColor="#EF4444"
        heroImage="/images/hero-factions.png"
      >
        <button
          onClick={() => setUseServerData(!useServerData)}
          style={{
            padding: '4px 12px',
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
            background: 'transparent',
            border: sketchBorder(SK.borderDark),
            borderRadius: radius.md,
            cursor: 'pointer',
          }}
        >
          {useServerData ? tFaction('mockData') : tFaction('liveData')}
        </button>
      </PageHeader>

      {/* 집계 통계 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <StatCard label="Active Factions" value={String(MOCK_FACTIONS.length)} color={SK.textPrimary} icon={Swords} />
        <StatCard label="Total Members" value={String(totalMembers)} color={SK.blue} icon={Users} />
        <StatCard label="Territories" value={String(totalTerritories)} color={SK.green} icon={MapPin} />
        <StatCard label="Combined GDP" value={`${(totalGdp / 1000).toFixed(0)}K`} color={SK.orange} icon={DollarSign} />
      </div>

      {/* 서버 데이터 모드 */}
      {useServerData && SERVER_URL ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FactionList
            serverUrl={SERVER_URL}
            selectedId={selectedFactionId ?? undefined}
            onSelect={handleFactionSelect}
          />
          {selectedFactionId && showDashboard && (
            <FactionDashboard
              serverUrl={SERVER_URL}
              factionId={selectedFactionId}
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
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
            @media (min-width: 768px) and (max-width: 1024px) {
              .factions-card-grid {
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
              }
            }
          `}</style>
          {MOCK_FACTIONS.map((faction) => (
            <div
              key={faction.id}
              style={{
                background: SK.cardBg,
                border: sketchBorder(selectedFactionId === faction.id ? SK.blue : SK.border),
                borderRadius: radius.lg,
                padding: 20,
                boxShadow: sketchShadow('sm'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: `4px solid ${faction.color}`,
              }}
              onClick={() => setSelectedFactionId(faction.id)}
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

              <Link
                href={`/factions/${faction.id}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-block',
                  fontFamily: headingFont,
                  fontSize: SKFont.xs,
                  color: SK.blue,
                  textDecoration: 'none',
                  letterSpacing: '1px',
                  padding: '6px 14px',
                  border: `1px solid ${SK.blue}40`,
                  borderRadius: radius.md,
                  transition: 'all 0.15s ease',
                }}
              >
                {tFaction('viewDetail')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
