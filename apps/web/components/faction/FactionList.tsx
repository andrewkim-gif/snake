'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

/** Faction data from the server */
interface Faction {
  id: string;
  name: string;
  tag: string;
  color: string;
  banner_url?: string;
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
  created_at: string;
}

interface FactionListProps {
  /** Server base URL for API calls */
  serverUrl: string;
  /** Currently selected faction ID */
  selectedId?: string;
  /** Callback when a faction is selected */
  onSelect?: (faction: Faction) => void;
  /** Callback to create a new faction */
  onCreate?: () => void;
}

/** FactionList — 팩션 목록 (SK tactical UI 스타일) */
export default function FactionList({ serverUrl, selectedId, onSelect, onCreate }: FactionListProps) {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${serverUrl}/api/factions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFactions(data.factions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load factions');
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchFactions();
  }, [fetchFactions]);

  if (loading) {
    return (
      <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 20, textAlign: 'center' }}>
        Loading factions...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: SK.red, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 20, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderBottom: sketchBorder()
      }}>
        <span style={{
          fontFamily: headingFont, fontSize: SKFont.h3, color: SK.textPrimary, letterSpacing: '1px'
        }}>
          FACTIONS
        </span>
        <span style={{
          fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted,
        }}>
          {factions.length} registered
        </span>
      </div>

      {/* Create button */}
      {onCreate && (
        <button
          onClick={onCreate}
          style={{
            padding: '10px 16px',
            background: SK.green,
            color: SK.textWhite,
            fontFamily: headingFont,
            fontSize: SKFont.sm,
            border: 'none',
            borderRadius: radius.md,
            cursor: 'pointer',
            letterSpacing: '1px',
            boxShadow: sketchShadow('sm'),
          }}
        >
          + CREATE FACTION (1000 GOLD)
        </button>
      )}

      {/* Faction list */}
      {factions.length === 0 ? (
        <div style={{
          color: SK.textMuted, fontFamily: bodyFont, fontSize: SKFont.sm,
          padding: 32, textAlign: 'center',
        }}>
          No factions yet. Be the first to create one.
        </div>
      ) : (
        factions.map((faction) => (
          <div
            key={faction.id}
            onClick={() => onSelect?.(faction)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              background: selectedId === faction.id ? SK.cardBgHover : SK.cardBg,
              border: selectedId === faction.id ? sketchBorder(SK.borderFocus) : sketchBorder(),
              borderRadius: radius.md,
              cursor: 'pointer',
              transition: 'background 0.15s',
              boxShadow: sketchShadow('sm'),
            }}
          >
            {/* Color swatch */}
            <div style={{
              width: 8, height: 40, borderRadius: radius.sm,
              background: faction.color, flexShrink: 0,
            }} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: headingFont, fontSize: SKFont.body,
                  color: SK.textPrimary, letterSpacing: '0.5px',
                }}>
                  {faction.name}
                </span>
                <span style={{
                  fontFamily: bodyFont, fontSize: SKFont.xs,
                  color: SK.textMuted,
                }}>
                  [{faction.tag}]
                </span>
              </div>
              <div style={{
                fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textSecondary,
                display: 'flex', gap: 12, marginTop: 2,
              }}>
                <span>{faction.member_count} members</span>
                <span>{faction.territory_count} territories</span>
                <span style={{ color: SK.gold }}>P: {faction.prestige}</span>
              </div>
            </div>

            {/* GDP */}
            <div style={{
              fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.gold,
              textAlign: 'right', flexShrink: 0,
            }}>
              GDP {(faction.total_gdp / 1000).toFixed(1)}K
            </div>
          </div>
        ))
      )}
    </div>
  );
}
