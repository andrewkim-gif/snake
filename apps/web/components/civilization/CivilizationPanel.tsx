'use client';

/**
 * CivilizationPanel — 정책 관리 + 지표 대시보드 통합 뷰
 * v14 Phase 6 — S29
 * CountryPanel의 CIVILIZATION 탭에 삽입됨
 */

import { useState } from 'react';
import { SK, SKFont, bodyFont, radius } from '@/lib/sketch-ui';
import { PolicyManager, type CountryPoliciesData, type PolicyCategory } from './PolicyManager';
import { StatsChart, type NationStatsData } from './StatsChart';

// ─── Sub-tab within civilization panel ──
type CivSubTab = 'STATS' | 'POLICIES';

interface CivilizationPanelProps {
  countryCode: string;
  countryName: string;
  stats: NationStatsData;
  previousStats?: NationStatsData | null;
  policies: CountryPoliciesData;
  canChangePolicy: boolean;
  dominantNation?: string;
  hasHegemony?: boolean;
  hasSovereignty?: boolean;
  onSetPolicy?: (category: PolicyCategory, level: number) => void;
}

export function CivilizationPanel({
  countryCode,
  countryName,
  stats,
  previousStats,
  policies,
  canChangePolicy,
  dominantNation,
  hasHegemony,
  hasSovereignty,
  onSetPolicy,
}: CivilizationPanelProps) {
  const [subTab, setSubTab] = useState<CivSubTab>('STATS');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Domination Status Banner */}
      <div style={{
        padding: '10px 12px',
        background: hasHegemony
          ? `${SK.gold}15`
          : hasSovereignty
            ? `${SK.blue}15`
            : dominantNation
              ? `${SK.green}10`
              : SK.cardBg,
        borderRadius: radius.md,
        border: `1px solid ${
          hasHegemony ? `${SK.gold}40` : hasSovereignty ? `${SK.blue}40` : SK.border
        }`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
            letterSpacing: '1px',
            marginBottom: '2px',
          }}>
            DOMINATION STATUS
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            fontWeight: 700,
            color: hasHegemony ? SK.gold : hasSovereignty ? SK.blue : SK.textPrimary,
          }}>
            {hasHegemony
              ? 'HEGEMONY'
              : hasSovereignty
                ? 'SOVEREIGNTY'
                : dominantNation
                  ? `Dominated by ${dominantNation}`
                  : 'Unclaimed'}
          </div>
        </div>

        {/* Status Badge */}
        {(hasHegemony || hasSovereignty) && (
          <div style={{
            padding: '4px 10px',
            borderRadius: radius.pill,
            background: hasHegemony ? SK.gold : SK.blue,
            color: '#000',
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '1px',
          }}>
            {hasHegemony ? 'POLICY ACCESS' : 'BUFFS ACTIVE'}
          </div>
        )}
      </div>

      {/* Sub-tab switcher */}
      <div style={{
        display: 'flex',
        borderRadius: radius.md,
        background: 'rgba(255,255,255,0.03)',
        padding: '2px',
      }}>
        {(['STATS', 'POLICIES'] as CivSubTab[]).map((tab) => {
          const isActive = subTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: radius.sm,
                border: 'none',
                background: isActive ? SK.cardBg : 'transparent',
                color: isActive ? SK.textPrimary : SK.textMuted,
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                fontWeight: 700,
                letterSpacing: '1px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      {subTab === 'STATS' ? (
        <StatsChart stats={stats} previousStats={previousStats} />
      ) : (
        <PolicyManager
          policies={policies}
          canChange={canChangePolicy}
          onSetPolicy={onSetPolicy}
        />
      )}
    </div>
  );
}

export default CivilizationPanel;
