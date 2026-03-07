'use client';

/**
 * StatsChart — 8대 국가 지표 게이지/바 차트 + 추세 화살표
 * v14 Phase 6 — S29
 */

import { SK, SKFont, bodyFont, radius } from '@/lib/sketch-ui';

export interface NationStatsData {
  happiness: number;       // 0-100
  birthRate: number;       // 0.5-4.0
  gdp: number;             // $B
  militaryPower: number;   // 0-100
  techLevel: number;       // 0-100
  loyalty: number;         // 0-100
  population: number;      // thousands
  internationalRep: number; // -100 to +100
}

interface StatConfig {
  key: keyof NationStatsData;
  label: string;
  icon: string;
  color: string;
  min: number;
  max: number;
  format: (v: number) => string;
}

const STAT_CONFIGS: StatConfig[] = [
  { key: 'happiness', label: 'Happiness', icon: 'H', color: '#FBBF24',
    min: 0, max: 100, format: (v) => `${v.toFixed(0)}` },
  { key: 'birthRate', label: 'Birth Rate', icon: 'B', color: '#F472B6',
    min: 0.5, max: 4.0, format: (v) => `${v.toFixed(2)}` },
  { key: 'gdp', label: 'GDP', icon: '$', color: '#34D399',
    min: 0, max: 5000, format: (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}T` : `$${v.toFixed(0)}B` },
  { key: 'militaryPower', label: 'Military', icon: 'M', color: '#EF4444',
    min: 0, max: 100, format: (v) => `${v.toFixed(0)}` },
  { key: 'techLevel', label: 'Tech Level', icon: 'T', color: '#60A5FA',
    min: 0, max: 100, format: (v) => `${v.toFixed(0)}` },
  { key: 'loyalty', label: 'Loyalty', icon: 'L', color: '#A78BFA',
    min: 0, max: 100, format: (v) => `${v.toFixed(0)}` },
  { key: 'population', label: 'Population', icon: 'P', color: '#FB923C',
    min: 0, max: 5000, format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${v.toFixed(0)}K` },
  { key: 'internationalRep', label: 'Reputation', icon: 'R', color: '#2DD4BF',
    min: -100, max: 100, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}` },
];

interface StatsChartProps {
  stats: NationStatsData;
  previousStats?: NationStatsData | null;
}

function getTrend(current: number, previous: number | undefined): 'up' | 'down' | 'stable' {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'stable') return <span style={{ color: SK.textMuted, fontSize: '10px' }}>--</span>;
  if (trend === 'up') return <span style={{ color: SK.green, fontSize: '12px', fontWeight: 700 }}>^</span>;
  return <span style={{ color: SK.red, fontSize: '12px', fontWeight: 700 }}>v</span>;
}

export function StatsChart({ stats, previousStats }: StatsChartProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textMuted,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginBottom: '4px',
      }}>
        National Statistics
      </div>

      {STAT_CONFIGS.map((cfg) => {
        const value = stats[cfg.key];
        const prevValue = previousStats?.[cfg.key];
        const normalized = Math.max(0, Math.min(1, (value - cfg.min) / (cfg.max - cfg.min)));
        const percentage = normalized * 100;
        const trend = getTrend(value, prevValue);

        return (
          <div key={cfg.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {/* Icon */}
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: radius.sm,
              background: `${cfg.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: bodyFont,
              fontSize: '11px',
              fontWeight: 800,
              color: cfg.color,
              flexShrink: 0,
            }}>
              {cfg.icon}
            </div>

            {/* Label */}
            <div style={{
              width: '72px',
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textSecondary,
              flexShrink: 0,
            }}>
              {cfg.label}
            </div>

            {/* Bar */}
            <div style={{
              flex: 1,
              height: '6px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 0,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${percentage}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`,
                borderRadius: 0,
                transition: 'width 500ms ease',
              }} />
            </div>

            {/* Value */}
            <div style={{
              width: '52px',
              textAlign: 'right',
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textPrimary,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {cfg.format(value)}
            </div>

            {/* Trend */}
            <div style={{ width: '16px', textAlign: 'center', flexShrink: 0 }}>
              <TrendArrow trend={trend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatsChart;
