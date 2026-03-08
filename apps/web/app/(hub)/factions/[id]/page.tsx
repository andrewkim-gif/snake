'use client';

/**
 * /factions/[id] — 팩션 상세 페이지 (동적 라우트)
 * DashboardPage + mock data 모듈 사용 + 딥링크 유지
 */

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, radius } from '@/lib/sketch-ui';
import { DashboardPage } from '@/components/hub';
import { MOCK_FACTION_DETAILS } from '@/lib/mock-data';
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

import { getServerUrl } from '@/lib/api-client';

const SERVER_URL = getServerUrl();

export default function FactionDetailPage() {
  const tFaction = useTranslations('faction');
  const params = useParams();
  const router = useRouter();
  const factionId = params.id as string;

  const mockFaction = MOCK_FACTION_DETAILS[factionId];

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

      <DashboardPage
        icon={Swords}
        title={mockFaction.name}
        description={mockFaction.description}
        accentColor={mockFaction.color}
        heroImage="/images/hero-factions.png"
        headerChildren={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
            }}>
              [{mockFaction.tag}] &mdash; {tFaction('leader')}: {mockFaction.leader}
            </span>
          </div>
        }
        stats={[
          { label: tFaction('members'), value: String(mockFaction.member_count), color: SK.blue, icon: Users },
          { label: tFaction('territory'), value: String(mockFaction.territory_count), color: SK.green, icon: MapPin },
          { label: tFaction('prestige'), value: String(mockFaction.prestige), color: SK.gold, icon: Award },
          { label: tFaction('totalGdp'), value: `${(mockFaction.total_gdp / 1000).toFixed(1)}K`, color: SK.orange, icon: DollarSign },
        ]}
      >
        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button style={{
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
          <button style={{
            padding: '10px 20px',
            fontFamily: headingFont,
            fontSize: SKFont.sm,
            color: SK.textSecondary,
            background: 'transparent',
            border: sketchBorder(),
            borderRadius: 0,
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
      </DashboardPage>
    </div>
  );
}
