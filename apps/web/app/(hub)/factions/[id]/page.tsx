'use client';

/**
 * /factions/[id] — 팩션 상세 페이지 (동적 라우트)
 * PageHeader + StatCard 통합 컴포넌트 사용
 */

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';
import { PageHeader, StatCard } from '@/components/hub';
import { Swords, Users, MapPin, Award, DollarSign, ArrowLeft } from 'lucide-react';

const FactionDetail = dynamic(() => import('@/components/faction/FactionDetail'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading faction details...
    </div>
  ),
});

const TechTree = dynamic(() => import('@/components/faction/TechTree'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading tech tree...
    </div>
  ),
});

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

const MOCK_FACTIONS: Record<string, {
  id: string;
  name: string;
  tag: string;
  color: string;
  member_count: number;
  territory_count: number;
  prestige: number;
  total_gdp: number;
  description: string;
  leader: string;
  founded: string;
}> = {
  'east-asia': {
    id: 'east-asia', name: 'East Asia Coalition', tag: 'EAC', color: '#FF6B6B',
    member_count: 38, territory_count: 12, prestige: 2400, total_gdp: 45000,
    description: 'A coalition of East Asian nations focused on technological superiority and economic dominance.',
    leader: 'Commander Hayashi', founded: '2026-01-15',
  },
  'nato-alliance': {
    id: 'nato-alliance', name: 'NATO Alliance', tag: 'NATO', color: '#3B82F6',
    member_count: 31, territory_count: 28, prestige: 3200, total_gdp: 62000,
    description: 'The Western military alliance prioritizing collective defense and democratic values.',
    leader: 'General Thornton', founded: '2026-01-10',
  },
  'brics-pact': {
    id: 'brics-pact', name: 'BRICS Pact', tag: 'BRICS', color: '#10B981',
    member_count: 22, territory_count: 15, prestige: 1800, total_gdp: 38000,
    description: 'An economic bloc of emerging economies aiming to reshape the global order.',
    leader: 'Premier Volkov', founded: '2026-01-20',
  },
  'african-union': {
    id: 'african-union', name: 'African Union', tag: 'AU', color: '#F59E0B',
    member_count: 54, territory_count: 40, prestige: 1200, total_gdp: 18000,
    description: 'United African nations building strength through numbers and resource wealth.',
    leader: 'Marshal Adeyemi', founded: '2026-02-01',
  },
  'nordic-council': {
    id: 'nordic-council', name: 'Nordic Council', tag: 'NORD', color: '#8B5CF6',
    member_count: 5, territory_count: 5, prestige: 900, total_gdp: 12000,
    description: 'A small but highly efficient alliance of Nordic nations. Quality over quantity.',
    leader: 'Admiral Johansson', founded: '2026-01-25',
  },
  'mercosur': {
    id: 'mercosur', name: 'Mercosur Alliance', tag: 'MER', color: '#06B6D4',
    member_count: 8, territory_count: 6, prestige: 750, total_gdp: 9500,
    description: 'South American economic and defense partnership.',
    leader: 'General Silva', founded: '2026-02-10',
  },
};

export default function FactionDetailPage() {
  const tFaction = useTranslations('faction');
  const params = useParams();
  const router = useRouter();
  const factionId = params.id as string;

  const mockFaction = MOCK_FACTIONS[factionId];

  if (SERVER_URL) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <FactionDetail
          serverUrl={SERVER_URL}
          factionId={factionId}
          onBack={() => router.push('/factions')}
        />
        <TechTree factionId={factionId} readOnly={true} />
      </div>
    );
  }

  if (!mockFaction) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: SK.textMuted, fontFamily: bodyFont }}>
        {tFaction('factionNotFoundMsg', { id: factionId })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 뒤로가기 */}
      <button
        onClick={() => router.push('/factions')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: SK.textSecondary,
          fontFamily: bodyFont,
          fontSize: SKFont.sm,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <ArrowLeft size={14} />
        {tFaction('backToFactions')}
      </button>

      <PageHeader
        icon={Swords}
        title={mockFaction.name}
        description={mockFaction.description}
        accentColor={mockFaction.color}
        heroImage="/images/hero-factions.png"
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
          }}>
            [{mockFaction.tag}] &mdash; {tFaction('leader')}: {mockFaction.leader}
          </span>
        </div>
      </PageHeader>

      {/* 통계 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        <StatCard label={tFaction('members')} value={String(mockFaction.member_count)} color={SK.blue} icon={Users} />
        <StatCard label={tFaction('territory')} value={String(mockFaction.territory_count)} color={SK.green} icon={MapPin} />
        <StatCard label={tFaction('prestige')} value={String(mockFaction.prestige)} color={SK.gold} icon={Award} />
        <StatCard label={tFaction('totalGdp')} value={`${(mockFaction.total_gdp / 1000).toFixed(1)}K`} color={SK.orange} icon={DollarSign} />
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button style={{
          padding: '10px 20px',
          fontFamily: headingFont,
          fontSize: SKFont.sm,
          color: SK.textWhite,
          background: SK.green,
          border: 'none',
          borderRadius: radius.md,
          cursor: 'pointer',
          letterSpacing: '1px',
        }}>
          {tFaction('joinFaction')}
        </button>
        <button style={{
          padding: '10px 20px',
          fontFamily: headingFont,
          fontSize: SKFont.sm,
          color: SK.textSecondary,
          background: 'transparent',
          border: sketchBorder(),
          borderRadius: radius.md,
          cursor: 'pointer',
          letterSpacing: '1px',
        }}>
          {tFaction('viewDiplomacy')}
        </button>
      </div>

      {/* TechTree */}
      <div>
        <h3 style={{
          fontFamily: headingFont,
          fontSize: '16px',
          color: SK.textPrimary,
          letterSpacing: '1px',
          marginBottom: 16,
        }}>
          {tFaction('techResearch')}
        </h3>
        <TechTree factionId={factionId} readOnly={true} />
      </div>
    </div>
  );
}
