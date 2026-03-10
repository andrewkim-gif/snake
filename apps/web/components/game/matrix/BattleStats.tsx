'use client';

/**
 * BattleStats.tsx - v37 Phase 8: 전투 통계 패널
 *
 * FieldShop의 Stats 탭 또는 독립 패널로 사용.
 * - DPS (Damage Per Second)
 * - GPM (Gold Per Minute)
 * - SPM (Score Per Minute)
 * - 무기별 킬 분포 차트 (가로 바)
 * - 카테고리별 데미지 비율
 *
 * 디자인: SK 팔레트, Chakra Petch heading, border-radius: 0
 */

import { memo } from 'react';
import { Activity, Coins, Zap, Swords, BarChart3 } from 'lucide-react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';
import {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_DISPLAY_COLORS,
} from '@/lib/matrix/config/skills/category-display.config';
import type { SkillCategory, WeaponType } from '@/lib/matrix/types';

// ============================================
// Types
// ============================================

/** 무기별 킬 통계 */
export interface WeaponKillStat {
  weaponType: WeaponType;
  weaponName: string;
  kills: number;
  damage: number;
  category: SkillCategory;
}

/** 카테고리별 데미지 통계 */
export interface CategoryDamageStat {
  category: SkillCategory;
  totalDamage: number;
  percentage: number; // 0~100
}

/** 전투 통계 데이터 */
export interface BattleStatsData {
  /** 초당 데미지 */
  dps: number;
  /** 분당 Gold */
  gpm: number;
  /** 분당 Score */
  spm: number;
  /** Gold/킬 비율 */
  goldPerKill: number;
  /** 총 킬 */
  totalKills: number;
  /** 총 데미지 */
  totalDamage: number;
  /** 무기별 킬 분포 */
  weaponKills: WeaponKillStat[];
  /** 카테고리별 데미지 비율 */
  categoryDamage: CategoryDamageStat[];
}

export interface BattleStatsProps {
  /** 전투 통계 데이터 */
  stats: BattleStatsData;
  /** 컴팩트 모드 (FieldShop 탭 내 사용 시) */
  compact?: boolean;
}

// ============================================
// Sub: Metric Card
// ============================================

function MetricCard({
  icon: IconComp,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: 0,
        position: 'relative',
      }}
    >
      {/* Left color stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: color,
        }}
      />

      <IconComp size={14} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 9,
            color: SK.textMuted,
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: headingFont,
            fontSize: 15,
            fontWeight: 900,
            color,
          }}
        >
          {value}
        </div>
      </div>
      {subValue && (
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 9,
            color: SK.textMuted,
          }}
        >
          {subValue}
        </span>
      )}
    </div>
  );
}

// ============================================
// Sub: Weapon Kill Bar
// ============================================

function WeaponKillBar({
  stat,
  maxKills,
}: {
  stat: WeaponKillStat;
  maxKills: number;
}) {
  const barPercent = maxKills > 0 ? (stat.kills / maxKills) * 100 : 0;
  const catColor = CATEGORY_DISPLAY_COLORS[stat.category] ?? SK.textMuted;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '3px 0',
      }}
    >
      {/* Weapon name */}
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: 10,
          color: SK.textSecondary,
          width: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {stat.weaponName}
      </span>

      {/* Bar */}
      <div
        style={{
          flex: 1,
          height: 8,
          background: SK.cardBg,
          borderRadius: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barPercent}%`,
            background: catColor,
            transition: 'width 0.3s ease-out',
            minWidth: barPercent > 0 ? 2 : 0,
          }}
        />
      </div>

      {/* Kill count */}
      <span
        style={{
          fontFamily: headingFont,
          fontSize: 10,
          fontWeight: 700,
          color: catColor,
          width: 30,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {stat.kills}
      </span>
    </div>
  );
}

// ============================================
// Sub: Category Damage Ratio
// ============================================

function CategoryDamageRatio({ stats }: { stats: CategoryDamageStat[] }) {
  const sorted = [...stats].sort((a, b) => b.percentage - a.percentage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          height: 12,
          overflow: 'hidden',
          borderRadius: 0,
          border: `1px solid ${SK.border}`,
        }}
      >
        {sorted.map(stat => {
          if (stat.percentage <= 0) return null;
          const color = CATEGORY_DISPLAY_COLORS[stat.category] ?? SK.textMuted;
          return (
            <div
              key={stat.category}
              style={{
                width: `${stat.percentage}%`,
                background: color,
                minWidth: stat.percentage > 0 ? 2 : 0,
                transition: 'width 0.3s ease-out',
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {sorted.map(stat => {
          if (stat.percentage <= 0) return null;
          const color = CATEGORY_DISPLAY_COLORS[stat.category] ?? SK.textMuted;
          const displayName = CATEGORY_DISPLAY_NAMES[stat.category] ?? stat.category;
          return (
            <div
              key={stat.category}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: color,
                  borderRadius: 0,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: bodyFont,
                  fontSize: 9,
                  color: SK.textMuted,
                }}
              >
                {displayName} {Math.round(stat.percentage)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

function BattleStatsInner({ stats, compact = false }: BattleStatsProps) {
  const maxWeaponKills = Math.max(1, ...stats.weaponKills.map(w => w.kills));
  const topWeapons = [...stats.weaponKills]
    .sort((a, b) => b.kills - a.kills)
    .slice(0, compact ? 5 : 10);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 8 : 12,
        padding: compact ? 0 : '12px 0',
      }}
    >
      {/* Section: Key Metrics */}
      <div>
        <div
          style={{
            fontFamily: headingFont,
            fontSize: 10,
            fontWeight: 700,
            color: SK.textMuted,
            letterSpacing: '0.15em',
            marginBottom: 6,
          }}
        >
          COMBAT METRICS
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <MetricCard
            icon={Activity}
            label="DPS"
            value={stats.dps.toFixed(1)}
            subValue="dmg/sec"
            color={SK.accent}
          />
          <MetricCard
            icon={Coins}
            label="GPM"
            value={Math.round(stats.gpm).toLocaleString()}
            subValue="gold/min"
            color={SK.gold}
          />
          <MetricCard
            icon={Zap}
            label="SPM"
            value={Math.round(stats.spm).toLocaleString()}
            subValue="score/min"
            color={SK.blue}
          />
          <MetricCard
            icon={Swords}
            label="GOLD / KILL"
            value={stats.totalKills > 0 ? Math.round(stats.goldPerKill).toString() : '-'}
            subValue="efficiency"
            color={SK.green}
          />
        </div>
      </div>

      {/* Section: Weapon Kill Distribution */}
      {topWeapons.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: headingFont,
              fontSize: 10,
              fontWeight: 700,
              color: SK.textMuted,
              letterSpacing: '0.15em',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BarChart3 size={11} style={{ color: SK.textMuted }} />
            WEAPON KILLS
          </div>
          <div
            style={{
              background: `${SK.cardBg}`,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              padding: '6px 10px',
            }}
          >
            {topWeapons.map(stat => (
              <WeaponKillBar
                key={stat.weaponType}
                stat={stat}
                maxKills={maxWeaponKills}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section: Category Damage Ratio */}
      {stats.categoryDamage.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: headingFont,
              fontSize: 10,
              fontWeight: 700,
              color: SK.textMuted,
              letterSpacing: '0.15em',
              marginBottom: 6,
            }}
          >
            DAMAGE BY CATEGORY
          </div>
          <CategoryDamageRatio stats={stats.categoryDamage} />
        </div>
      )}
    </div>
  );
}

const BattleStats = memo(BattleStatsInner);
export default BattleStats;
