'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';
import SeasonTimeline from './SeasonTimeline';

/* 대시보드 스타일 심플 헤더 */

// --- Types ---

interface HOFCategory {
  category: string;
  display_name: string;
  icon: string;
  description: string;
}

interface HOFEntry {
  id: string;
  season_id: string;
  season_number: number;
  season_name: string;
  category: string;
  winner_id: string;
  winner_name: string;
  winner_type: string;
  leader_name?: string;
  record_value: number;
  record_label: string;
  trophy_type: string;
  badge_key: string;
  awarded_at: string;
}

interface HallOfFameProps {
  serverUrl: string;
}

// --- Icon Map ---
const categoryIcons: Record<string, string> = {
  trophy: '\uD83C\uDFC6',
  coin: '\uD83D\uDCB0',
  sword: '\u2694\uFE0F',
  shield: '\uD83D\uDEE1\uFE0F',
  crown: '\uD83D\uDC51',
  star: '\u2B50',
  book: '\uD83D\uDCDC',
};

// --- Main Component ---

export default function HallOfFame({ serverUrl }: HallOfFameProps) {
  const [categories, setCategories] = useState<HOFCategory[]>([]);
  const [entries, setEntries] = useState<HOFEntry[]>([]);
  const [seasonNumbers, setSeasonNumbers] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineSeasonId, setTimelineSeasonId] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, entriesRes, seasonsRes] = await Promise.all([
        fetch(`${serverUrl}/api/hall-of-fame/categories`),
        fetch(`${serverUrl}/api/hall-of-fame`),
        fetch(`${serverUrl}/api/hall-of-fame/seasons`),
      ]);

      if (!catRes.ok || !entriesRes.ok || !seasonsRes.ok) {
        throw new Error('Failed to load Hall of Fame data');
      }

      const catData = await catRes.json();
      const entriesData = await entriesRes.json();
      const seasonsData = await seasonsRes.json();

      setCategories(catData.categories || []);
      setEntries(entriesData.entries || []);
      setSeasonNumbers(seasonsData.seasons || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter entries by selected season and category
  const filteredEntries = entries.filter((e) => {
    if (selectedSeason !== null && e.season_number !== selectedSeason) return false;
    if (selectedCategory !== null && e.category !== selectedCategory) return false;
    return true;
  });

  // Group entries by season for display
  const entriesBySeason = new Map<number, HOFEntry[]>();
  for (const entry of filteredEntries) {
    const list = entriesBySeason.get(entry.season_number) || [];
    list.push(entry);
    entriesBySeason.set(entry.season_number, list);
  }
  const sortedSeasons = Array.from(entriesBySeason.keys()).sort((a, b) => b - a);

  if (loading) {
    return (
      <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 40, textAlign: 'center' }}>
        Loading Hall of Fame...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: SK.red, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 40, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

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
          Hall of Fame
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          Legends who shaped the world across seasons
        </p>
      </header>

      {/* Tab content */}
      <main>

      {/* Season Tabs — 대시보드 스타일 */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${SK.border}`, paddingBottom: 0, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedSeason(null)}
          style={{
            fontFamily: bodyFont, fontSize: SKFont.body,
            fontWeight: selectedSeason === null ? 700 : 400,
            color: selectedSeason === null ? SK.gold : SK.textSecondary,
            background: selectedSeason === null ? `${SK.gold}15` : 'transparent',
            border: 'none',
            borderBottom: selectedSeason === null ? `1px solid ${SK.gold}` : '1px solid transparent',
            padding: '10px 18px', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          All Seasons
        </button>
        {seasonNumbers.map((num) => (
          <button
            key={num}
            onClick={() => setSelectedSeason(num)}
            style={{
              fontFamily: bodyFont, fontSize: SKFont.body,
              fontWeight: selectedSeason === num ? 700 : 400,
              color: selectedSeason === num ? SK.gold : SK.textSecondary,
              background: selectedSeason === num ? `${SK.gold}15` : 'transparent',
              border: 'none',
              borderBottom: selectedSeason === num ? `1px solid ${SK.gold}` : '1px solid transparent',
              padding: '10px 18px', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Season {num}
          </button>
        ))}
      </nav>

      {/* Category Filter — 대시보드 스타일 서브탭 */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${SK.border}`, paddingBottom: 0, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            fontFamily: bodyFont, fontSize: SKFont.sm,
            fontWeight: selectedCategory === null ? 700 : 400,
            color: selectedCategory === null ? SK.gold : SK.textSecondary,
            background: selectedCategory === null ? `${SK.gold}15` : 'transparent',
            border: 'none',
            borderBottom: selectedCategory === null ? `1px solid ${SK.gold}` : '1px solid transparent',
            padding: '8px 14px', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setSelectedCategory(cat.category)}
            style={{
              fontFamily: bodyFont, fontSize: SKFont.sm,
              fontWeight: selectedCategory === cat.category ? 700 : 400,
              color: selectedCategory === cat.category ? SK.gold : SK.textSecondary,
              background: selectedCategory === cat.category ? `${SK.gold}15` : 'transparent',
              border: 'none',
              borderBottom: selectedCategory === cat.category ? `1px solid ${SK.gold}` : '1px solid transparent',
              padding: '8px 14px', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {categoryIcons[cat.icon] || ''} {cat.display_name}
          </button>
        ))}
      </nav>

      {/* Entries */}
      {sortedSeasons.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: SK.textMuted,
          fontFamily: bodyFont,
          fontSize: SKFont.body,
        }}>
          No Hall of Fame records yet. Complete a season to see winners here.
        </div>
      ) : (
        sortedSeasons.map((seasonNum) => {
          const seasonEntries = entriesBySeason.get(seasonNum) || [];
          const seasonName = seasonEntries[0]?.season_name || `Season ${seasonNum}`;
          const seasonId = seasonEntries[0]?.season_id || '';

          return (
            <div key={seasonNum} style={{ marginBottom: 32 }}>
              {/* Season Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: sketchBorder(SK.border),
              }}>
                <h2 style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.h3,
                  color: SK.textPrimary,
                  fontWeight: 700,
                  margin: 0,
                }}>
                  Season {seasonNum}: {seasonName}
                </h2>
                <button
                  onClick={() => {
                    setTimelineSeasonId(seasonId);
                    setShowTimeline(true);
                  }}
                  style={{
                    fontFamily: bodyFont,
                    fontSize: SKFont.xs,
                    color: SK.blue,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: radius.sm,
                  }}
                >
                  View Timeline Replay
                </button>
              </div>

              {/* Entry Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}>
                {seasonEntries.map((entry) => {
                  const catInfo = categories.find((c) => c.category === entry.category);
                  return (
                    <WinnerCard
                      key={entry.id}
                      entry={entry}
                      categoryInfo={catInfo}
                    />
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Timeline Replay Modal */}
      {showTimeline && timelineSeasonId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: SK.overlay,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowTimeline(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: SK.cardBg,
              borderRadius: radius.lg,
              padding: 24,
              maxWidth: 800,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: sketchShadow('lg'),
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <h3 style={{
                fontFamily: headingFont,
                fontSize: SKFont.h3,
                color: SK.textPrimary,
                fontWeight: 700,
                margin: 0,
              }}>
                Season Timelapse
              </h3>
              <button
                onClick={() => setShowTimeline(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: SKFont.h3,
                  color: SK.textMuted,
                  cursor: 'pointer',
                }}
              >
                x
              </button>
            </div>
            <SeasonTimeline
              serverUrl={serverUrl}
              seasonId={timelineSeasonId}
            />
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

// --- Sub-components ---

function WinnerCard({ entry, categoryInfo }: {
  entry: HOFEntry;
  categoryInfo?: HOFCategory;
}) {
  const icon = categoryInfo ? (categoryIcons[categoryInfo.icon] || '') : '';
  const trophyColor = entry.trophy_type === 'gold'
    ? SK.gold
    : entry.trophy_type === 'silver'
    ? SK.textSecondary
    : SK.orange;

  return (
    <div style={{
      background: SK.cardBg,
      border: sketchBorder(SK.border),
      borderRadius: radius.md,
      padding: 16,
      boxShadow: sketchShadow('sm'),
      transition: 'box-shadow 0.15s ease',
    }}>
      {/* Category & Trophy */}
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
          {icon} {categoryInfo?.display_name || entry.category}
        </span>
        <span style={{
          fontSize: 20,
          color: trophyColor,
        }}>
          {entry.trophy_type === 'gold' ? '\uD83C\uDFC6' : entry.trophy_type === 'silver' ? '\uD83E\uDD48' : '\uD83E\uDD49'}
        </span>
      </div>

      {/* Winner Name */}
      <div style={{
        fontFamily: headingFont,
        fontSize: SKFont.body,
        color: SK.textPrimary,
        fontWeight: 700,
        marginBottom: 4,
      }}>
        {entry.winner_name}
      </div>

      {/* Record */}
      <div style={{
        fontFamily: bodyFont,
        fontSize: SKFont.sm,
        color: SK.textSecondary,
        marginBottom: 4,
      }}>
        {entry.record_label}
      </div>

      {/* Type badge */}
      <div style={{
        display: 'inline-block',
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: entry.winner_type === 'faction' ? SK.blue : SK.green,
        background: entry.winner_type === 'faction' ? 'rgba(59,130,246,0.1)' : 'rgba(22,163,74,0.1)',
        padding: '2px 8px',
        borderRadius: radius.pill,
      }}>
        {entry.winner_type === 'faction' ? 'Faction' : 'Player'}
      </div>
    </div>
  );
}
