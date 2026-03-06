'use client';

/**
 * /factions/[id] — 팩션 상세 페이지 (동적 라우트)
 * FactionDetail + TechTree 컴포넌트 연결
 * URL params에서 faction ID 추출
 */

import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// Lazy load 대형 컴포넌트
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

// Mock 팩션 데이터 (서버 미연결 시 표시)
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
  const params = useParams();
  const router = useRouter();
  const factionId = params.id as string;

  const mockFaction = MOCK_FACTIONS[factionId];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 서버 데이터 모드: FactionDetail 컴포넌트 */}
      {SERVER_URL ? (
        <FactionDetail
          serverUrl={SERVER_URL}
          factionId={factionId}
          onBack={() => router.push('/factions')}
        />
      ) : (
        /* Mock 데이터 모드: 팩션 상세 */
        <div>
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.push('/factions')}
            style={{
              background: 'none',
              border: 'none',
              color: SK.textSecondary,
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              cursor: 'pointer',
              padding: '4px 0',
              marginBottom: 16,
            }}
          >
            ← BACK TO FACTIONS
          </button>

          {mockFaction ? (
            <>
              {/* 팩션 헤더 카드 */}
              <div style={{
                padding: 20,
                background: SK.cardBg,
                border: sketchBorder(),
                borderRadius: radius.lg,
                borderLeft: `4px solid ${mockFaction.color}`,
                boxShadow: sketchShadow('md'),
                marginBottom: 20,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                  <div>
                    <h2 style={{
                      fontFamily: headingFont,
                      fontSize: '22px',
                      color: SK.textPrimary,
                      margin: 0,
                      letterSpacing: '1px',
                    }}>
                      {mockFaction.name}
                    </h2>
                    <span style={{
                      fontFamily: bodyFont,
                      fontSize: SKFont.sm,
                      color: SK.textMuted,
                    }}>
                      [{mockFaction.tag}] &mdash; Founded {new Date(mockFaction.founded).toLocaleDateString()}
                    </span>
                    <p style={{
                      fontFamily: bodyFont,
                      fontSize: SKFont.sm,
                      color: SK.textSecondary,
                      marginTop: 12,
                      lineHeight: 1.5,
                    }}>
                      {mockFaction.description}
                    </p>
                  </div>
                  <div style={{
                    fontFamily: bodyFont,
                    fontSize: SKFont.xs,
                    color: SK.gold,
                    textAlign: 'right',
                    flexShrink: 0,
                    marginLeft: 24,
                  }}>
                    <div>Prestige: {mockFaction.prestige}</div>
                    <div>GDP: {(mockFaction.total_gdp / 1000).toFixed(1)}K</div>
                    <div style={{ color: SK.textSecondary, marginTop: 4 }}>
                      Leader: {mockFaction.leader}
                    </div>
                  </div>
                </div>
              </div>

              {/* 통계 카드 그리드 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 24,
              }}>
                {[
                  { label: 'Members', value: String(mockFaction.member_count), color: SK.blue },
                  { label: 'Territories', value: String(mockFaction.territory_count), color: SK.green },
                  { label: 'Prestige', value: String(mockFaction.prestige), color: SK.gold },
                  { label: 'Total GDP', value: `${(mockFaction.total_gdp / 1000).toFixed(1)}K`, color: SK.orange },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      padding: '14px 16px',
                      background: SK.cardBg,
                      border: sketchBorder(SK.borderDark),
                      borderRadius: radius.md,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      fontFamily: headingFont,
                      fontSize: '20px',
                      color: stat.color,
                    }}>
                      {stat.value}
                    </div>
                    <div style={{
                      fontFamily: bodyFont,
                      fontSize: SKFont.xs,
                      color: SK.textMuted,
                      marginTop: 4,
                    }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
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
                  JOIN FACTION
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
                  VIEW DIPLOMACY
                </button>
              </div>
            </>
          ) : (
            <div style={{
              padding: 40,
              textAlign: 'center',
              color: SK.textMuted,
              fontFamily: bodyFont,
              fontSize: SKFont.body,
            }}>
              Faction &quot;{factionId}&quot; not found. Check the faction ID and try again.
            </div>
          )}
        </div>
      )}

      {/* TechTree 섹션 */}
      <div>
        <h3 style={{
          fontFamily: headingFont,
          fontSize: '16px',
          color: SK.textPrimary,
          letterSpacing: '1px',
          marginBottom: 16,
        }}>
          TECHNOLOGY RESEARCH
        </h3>
        <TechTree
          factionId={factionId}
          readOnly={true}
        />
      </div>
    </div>
  );
}
