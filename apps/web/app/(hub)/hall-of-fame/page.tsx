'use client';

/**
 * /hall-of-fame — 명예의 전당
 * HallOfFame + SeasonTimeline 컴포넌트 연결
 * 시즌별 챔피언, 전설적 전투, 기록 보유자
 * 가로 스크롤 타임라인 UI
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// Lazy load 대형 컴포넌트
const HallOfFame = dynamic(() => import('@/components/hall-of-fame/HallOfFame'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 40, textAlign: 'center' }}>
      Loading Hall of Fame...
    </div>
  ),
});

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

// Mock 시즌 데이터 (서버 미연결 시 표시)
interface MockSeasonRecord {
  id: string;
  season: number;
  seasonName: string;
  category: string;
  categoryIcon: string;
  winnerName: string;
  winnerType: 'faction' | 'player';
  recordLabel: string;
  trophyType: 'gold' | 'silver' | 'bronze';
}

const MOCK_RECORDS: MockSeasonRecord[] = [
  { id: '1', season: 1, seasonName: 'Dawn of Nations', category: 'Season Champion', categoryIcon: '\uD83C\uDFC6', winnerName: 'NATO Alliance', winnerType: 'faction', recordLabel: 'Dominated 42 territories at season end', trophyType: 'gold' },
  { id: '2', season: 1, seasonName: 'Dawn of Nations', category: 'Top Warrior', categoryIcon: '\u2694\uFE0F', winnerName: 'xXDarkLord420Xx', winnerType: 'player', recordLabel: '2,847 kills across 156 battles', trophyType: 'gold' },
  { id: '3', season: 1, seasonName: 'Dawn of Nations', category: 'Richest Faction', categoryIcon: '\uD83D\uDCB0', winnerName: 'East Asia Coalition', winnerType: 'faction', recordLabel: 'GDP: 85,000 at peak', trophyType: 'gold' },
  { id: '4', season: 1, seasonName: 'Dawn of Nations', category: 'Master Diplomat', categoryIcon: '\uD83D\uDEE1\uFE0F', winnerName: 'Admiral Johansson', winnerType: 'player', recordLabel: '12 successful treaty negotiations', trophyType: 'silver' },
  { id: '5', season: 1, seasonName: 'Dawn of Nations', category: 'Speed Runner', categoryIcon: '\u26A1', winnerName: 'GhostSnake_kr', winnerType: 'player', recordLabel: 'Reached Level 20 in 3m 42s', trophyType: 'gold' },
  { id: '6', season: 1, seasonName: 'Dawn of Nations', category: 'Legendary Battle', categoryIcon: '\uD83D\uDC51', winnerName: 'Battle of Seoul', winnerType: 'faction', recordLabel: '64 players, 3 factions, 22 minutes', trophyType: 'gold' },
];

// Mock 타임라인 시즌 데이터
interface MockTimelineSeason {
  number: number;
  name: string;
  startDate: string;
  endDate: string;
  champion: string;
  totalBattles: number;
  peakPlayers: number;
}

const MOCK_SEASONS: MockTimelineSeason[] = [
  { number: 1, name: 'Dawn of Nations', startDate: '2026-01-15', endDate: '2026-02-12', champion: 'NATO Alliance', totalBattles: 4820, peakPlayers: 1240 },
  { number: 2, name: 'Rising Empires', startDate: '2026-02-19', endDate: '2026-03-19', champion: 'TBD', totalBattles: 2100, peakPlayers: 890 },
];

export default function HallOfFamePage() {
  const tHof = useTranslations('hallOfFame');
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  // 서버 연결 시 HallOfFame 컴포넌트 사용
  if (SERVER_URL) {
    return <HallOfFame serverUrl={SERVER_URL} />;
  }

  // Mock 데이터 모드: 인라인 표시
  const filteredRecords = selectedSeason !== null
    ? MOCK_RECORDS.filter(r => r.season === selectedSeason)
    : MOCK_RECORDS;

  // 시즌별 그룹화
  const recordsBySeason = new Map<number, MockSeasonRecord[]>();
  for (const record of filteredRecords) {
    const list = recordsBySeason.get(record.season) || [];
    list.push(record);
    recordsBySeason.set(record.season, list);
  }
  const sortedSeasons = Array.from(recordsBySeason.keys()).sort((a, b) => b - a);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{
          fontFamily: headingFont,
          fontWeight: 800,
          fontSize: '28px',
          color: SK.textPrimary,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          {tHof('title')}
        </h1>
        <p style={{
          fontFamily: bodyFont,
          fontSize: '14px',
          color: SK.textSecondary,
          marginTop: 8,
        }}>
          {tHof('subtitle')}
        </p>
      </div>

      {/* 가로 스크롤 시즌 타임라인 */}
      <div style={{
        marginBottom: 32,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingBottom: 8,
      }}>
        <style>{`
          .timeline-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="timeline-scroll"
          style={{
            display: 'flex',
            gap: 16,
            minWidth: 'max-content',
            padding: '0 4px',
          }}
        >
          {/* All Seasons 버튼 */}
          <button
            onClick={() => setSelectedSeason(null)}
            style={{
              padding: '12px 20px',
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              fontWeight: selectedSeason === null ? 700 : 400,
              color: selectedSeason === null ? SK.textWhite : SK.textSecondary,
              background: selectedSeason === null ? SK.blue : SK.cardBg,
              border: sketchBorder(selectedSeason === null ? SK.blue : SK.border),
              borderRadius: radius.md,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              minWidth: 120,
            }}
          >
            {tHof('allSeasons')}
          </button>

          {/* 시즌 타임라인 카드 */}
          {MOCK_SEASONS.map((season) => {
            const isActive = selectedSeason === season.number;
            return (
              <button
                key={season.number}
                onClick={() => setSelectedSeason(season.number)}
                style={{
                  padding: '12px 20px',
                  fontFamily: bodyFont,
                  fontSize: SKFont.sm,
                  color: isActive ? SK.textWhite : SK.textPrimary,
                  background: isActive ? SK.cardBgHover : SK.cardBg,
                  border: sketchBorder(isActive ? SK.orange : SK.border),
                  borderRadius: radius.md,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  minWidth: 200,
                }}
              >
                <div style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.body,
                  marginBottom: 4,
                  color: isActive ? SK.orange : SK.textPrimary,
                }}>
                  S{season.number}: {season.name}
                </div>
                <div style={{
                  fontSize: SKFont.xs,
                  color: SK.textMuted,
                  display: 'flex',
                  gap: 8,
                }}>
                  <span>{season.champion}</span>
                  <span>{tHof('battles', { count: season.totalBattles })}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 기록 카드 그리드 */}
      {sortedSeasons.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: SK.textMuted,
          fontFamily: bodyFont,
          fontSize: SKFont.body,
        }}>
          {tHof('noRecords')}
        </div>
      ) : (
        sortedSeasons.map((seasonNum) => {
          const seasonRecords = recordsBySeason.get(seasonNum) || [];
          const seasonName = seasonRecords[0]?.seasonName || `Season ${seasonNum}`;

          return (
            <div key={seasonNum} style={{ marginBottom: 32 }}>
              {/* 시즌 헤더 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: sketchBorder(SK.border),
              }}>
                <h2 style={{
                  fontFamily: headingFont,
                  fontSize: '18px',
                  color: SK.textPrimary,
                  fontWeight: 700,
                  margin: 0,
                }}>
                  Season {seasonNum}: {seasonName}
                </h2>
              </div>

              {/* 기록 카드 그리드 — 반응형 */}
              <div
                className="hof-record-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 12,
                }}
              >
                <style>{`
                  @media (max-width: 767px) {
                    .hof-record-grid {
                      grid-template-columns: 1fr !important;
                      gap: 10px !important;
                    }
                  }
                `}</style>
                {seasonRecords.map((record) => {
                  const trophyEmoji = record.trophyType === 'gold'
                    ? '\uD83C\uDFC6'
                    : record.trophyType === 'silver'
                    ? '\uD83E\uDD48'
                    : '\uD83E\uDD49';
                  const trophyColor = record.trophyType === 'gold'
                    ? SK.gold
                    : record.trophyType === 'silver'
                    ? SK.textSecondary
                    : SK.orange;

                  return (
                    <div
                      key={record.id}
                      style={{
                        background: SK.cardBg,
                        border: sketchBorder(SK.border),
                        borderRadius: radius.md,
                        padding: 16,
                        boxShadow: sketchShadow('sm'),
                      }}
                    >
                      {/* 카테고리 + 트로피 */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}>
                        <span style={{
                          fontFamily: bodyFont,
                          fontSize: SKFont.xs,
                          color: SK.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {record.categoryIcon} {record.category}
                        </span>
                        <span style={{ fontSize: 20, color: trophyColor }}>
                          {trophyEmoji}
                        </span>
                      </div>

                      {/* 우승자 이름 */}
                      <div style={{
                        fontFamily: headingFont,
                        fontSize: SKFont.body,
                        color: SK.textPrimary,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}>
                        {record.winnerName}
                      </div>

                      {/* 기록 */}
                      <div style={{
                        fontFamily: bodyFont,
                        fontSize: SKFont.sm,
                        color: SK.textSecondary,
                        marginBottom: 8,
                      }}>
                        {record.recordLabel}
                      </div>

                      {/* 타입 뱃지 */}
                      <span style={{
                        display: 'inline-block',
                        fontFamily: bodyFont,
                        fontSize: SKFont.xs,
                        color: record.winnerType === 'faction' ? SK.blue : SK.green,
                        background: record.winnerType === 'faction' ? 'rgba(59,130,246,0.1)' : 'rgba(22,163,74,0.1)',
                        padding: '2px 8px',
                        borderRadius: radius.pill,
                      }}>
                        {record.winnerType === 'faction' ? tHof('factionBadge') : tHof('playerBadge')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
