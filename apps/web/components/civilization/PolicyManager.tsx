'use client';

/**
 * PolicyManager — 10대 정책 카드 + 현재 선택 표시 + 변경 UI
 * v14 Phase 6 — S29
 * 헤게모니 국가만 정책 변경 가능
 */

import { useState, useCallback } from 'react';
import { SK, SKFont, bodyFont, radius } from '@/lib/sketch-ui';

// ─── Policy Types (client-side mirror of server domain) ──
export type PolicyCategory =
  | 'religion' | 'language' | 'government' | 'tax_rate'
  | 'military' | 'education' | 'trade' | 'environment'
  | 'immigration' | 'culture';

export interface PolicyOption {
  level: number;
  name: string;
  description: string;
  effects: Record<string, number>;
}

export interface PolicyCategoryDef {
  category: PolicyCategory;
  name: string;
  description: string;
  options: [PolicyOption, PolicyOption, PolicyOption];
}

export interface CountryPoliciesData {
  countryCode: string;
  policies: Record<PolicyCategory, number>;
  lastChanged: number;
  changedBy: string;
  graceEnd: number;
}

// ─── Policy Definitions (client copy) ──
const POLICY_DEFS: PolicyCategoryDef[] = [
  { category: 'religion', name: 'State Religion', description: 'National religious policy',
    options: [
      { level: 0, name: 'Atheism', description: 'Secular state', effects: { techLevel: 10, loyalty: -5 } },
      { level: 1, name: 'Polytheism', description: 'Multiple faiths', effects: { happiness: 10, loyalty: 5 } },
      { level: 2, name: 'Monotheism', description: 'One faith', effects: { loyalty: 15, happiness: -5 } },
    ] },
  { category: 'language', name: 'Official Language', description: 'Language policy',
    options: [
      { level: 0, name: 'Native Only', description: 'Preserve national language', effects: { loyalty: 10, internationalRep: -5 } },
      { level: 1, name: 'Bilingual', description: 'Two official languages', effects: { happiness: 5, gdp: 5 } },
      { level: 2, name: 'Global', description: 'International lingua franca', effects: { gdp: 10, loyalty: -5 } },
    ] },
  { category: 'government', name: 'Political System', description: 'Form of government',
    options: [
      { level: 0, name: 'Democracy', description: 'Rule by the people', effects: { happiness: 15, militaryPower: -5 } },
      { level: 1, name: 'Authoritarian', description: 'Strong central authority', effects: { militaryPower: 15, happiness: -10 } },
      { level: 2, name: 'Oligarchy', description: 'Rule by economic elite', effects: { gdp: 15, happiness: -5, loyalty: -5 } },
    ] },
  { category: 'tax_rate', name: 'Tax Rate', description: 'Tax burden',
    options: [
      { level: 0, name: 'Low (10%)', description: 'Minimal taxation', effects: { happiness: 10, gdp: -10 } },
      { level: 1, name: 'Medium (25%)', description: 'Balanced', effects: { happiness: 0, gdp: 5 } },
      { level: 2, name: 'High (40%)', description: 'Heavy taxation', effects: { happiness: -10, gdp: 15 } },
    ] },
  { category: 'military', name: 'Military Budget', description: 'Defense spending',
    options: [
      { level: 0, name: 'Minimal (10%)', description: 'Small army', effects: { gdp: 10, militaryPower: -15 } },
      { level: 1, name: 'Normal (25%)', description: 'Balanced defense', effects: { militaryPower: 5 } },
      { level: 2, name: 'Maximum (50%)', description: 'Full mobilization', effects: { militaryPower: 20, happiness: -10, gdp: -10 } },
    ] },
  { category: 'education', name: 'Education', description: 'Education investment',
    options: [
      { level: 0, name: 'Basic', description: 'Minimal education', effects: { gdp: 5, techLevel: -10 } },
      { level: 1, name: 'Standard', description: 'Adequate education', effects: { techLevel: 5, happiness: 5 } },
      { level: 2, name: 'Elite', description: 'World-class education', effects: { techLevel: 15, happiness: 5, gdp: -10 } },
    ] },
  { category: 'trade', name: 'Trade Policy', description: 'Trade stance',
    options: [
      { level: 0, name: 'Protectionism', description: 'Restrict trade', effects: { loyalty: 5, gdp: -5, internationalRep: -10 } },
      { level: 1, name: 'Free Trade', description: 'Open markets', effects: { gdp: 10, internationalRep: 10 } },
      { level: 2, name: 'Sanctions', description: 'Trade warfare', effects: { internationalRep: -15, militaryPower: 5 } },
    ] },
  { category: 'environment', name: 'Environment', description: 'Environmental policy',
    options: [
      { level: 0, name: 'Exploit', description: 'Max extraction', effects: { gdp: 10, happiness: -10, birthRate: -0.3 } },
      { level: 1, name: 'Balance', description: 'Sustainable dev', effects: { happiness: 5, birthRate: 0.1 } },
      { level: 2, name: 'Preserve', description: 'Full protection', effects: { happiness: 10, birthRate: 0.3, gdp: -10 } },
    ] },
  { category: 'immigration', name: 'Immigration', description: 'Border control',
    options: [
      { level: 0, name: 'Closed', description: 'No immigration', effects: { loyalty: 10, population: -5 } },
      { level: 1, name: 'Selective', description: 'Skilled workers', effects: { techLevel: 5, population: 3 } },
      { level: 2, name: 'Open', description: 'Free movement', effects: { population: 10, loyalty: -10, gdp: 5 } },
    ] },
  { category: 'culture', name: 'Culture', description: 'Cultural direction',
    options: [
      { level: 0, name: 'Traditional', description: 'Preserve heritage', effects: { loyalty: 10, happiness: 5 } },
      { level: 1, name: 'Innovation', description: 'Promote creativity', effects: { techLevel: 10, gdp: 5 } },
      { level: 2, name: 'Fusion', description: 'Blend cultures', effects: { happiness: 10, internationalRep: 10, loyalty: -5 } },
    ] },
];

const EFFECT_LABELS: Record<string, string> = {
  happiness: 'Happiness',
  birthRate: 'Birth Rate',
  gdp: 'GDP',
  militaryPower: 'Military',
  techLevel: 'Tech',
  loyalty: 'Loyalty',
  population: 'Population',
  internationalRep: 'Reputation',
};

// ─── Sub-Components ──

function EffectBadge({ stat, value }: { stat: string; value: number }) {
  const isPositive = value > 0;
  const color = isPositive ? SK.green : SK.red;
  const label = EFFECT_LABELS[stat] || stat;
  const sign = isPositive ? '+' : '';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: radius.sm,
      background: `${color}15`,
      color: color,
      fontFamily: bodyFont,
      fontSize: '10px',
      fontWeight: 600,
      marginRight: '4px',
      marginBottom: '2px',
    }}>
      {label} {sign}{value}
    </span>
  );
}

function PolicyConfirmModal({
  category,
  option,
  currentLevel,
  onConfirm,
  onCancel,
}: {
  category: PolicyCategoryDef;
  option: PolicyOption;
  currentLevel: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const currentOption = category.options[currentLevel];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
    }}
    onClick={onCancel}
    >
      <div
        style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: radius.lg,
          padding: '24px',
          maxWidth: '380px',
          width: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.h3,
          color: SK.textPrimary,
          fontWeight: 700,
          marginBottom: '16px',
        }}>
          Change {category.name}?
        </div>

        {/* Current → New */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            flex: 1,
            padding: '10px',
            background: `${SK.red}10`,
            borderRadius: radius.md,
            border: `1px solid ${SK.red}30`,
          }}>
            <div style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textMuted, marginBottom: '4px' }}>
              CURRENT
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textPrimary, fontWeight: 600 }}>
              {currentOption.name}
            </div>
          </div>

          <span style={{ color: SK.textMuted, fontSize: '16px' }}>-&gt;</span>

          <div style={{
            flex: 1,
            padding: '10px',
            background: `${SK.green}10`,
            borderRadius: radius.md,
            border: `1px solid ${SK.green}30`,
          }}>
            <div style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textMuted, marginBottom: '4px' }}>
              NEW
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textPrimary, fontWeight: 600 }}>
              {option.name}
            </div>
          </div>
        </div>

        {/* Effect preview */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
            letterSpacing: '1px',
            marginBottom: '6px',
          }}>
            EFFECT CHANGES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
            {Object.entries(option.effects).map(([stat, value]) => (
              <EffectBadge key={stat} stat={stat} value={value} />
            ))}
          </div>
        </div>

        {/* Grace period notice */}
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.orange,
          marginBottom: '16px',
          padding: '8px',
          background: `${SK.orange}10`,
          borderRadius: radius.sm,
        }}>
          6-hour grace period. Effects apply next epoch after grace ends.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              background: 'transparent',
              border: `1px solid ${SK.border}`,
              borderRadius: radius.md,
              color: SK.textSecondary,
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              background: SK.blue,
              border: 'none',
              borderRadius: radius.md,
              color: SK.textWhite,
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main PolicyManager Component ──

interface PolicyManagerProps {
  policies: CountryPoliciesData;
  canChange: boolean;       // true if user has hegemony
  onSetPolicy?: (category: PolicyCategory, level: number) => void;
}

export function PolicyManager({ policies, canChange, onSetPolicy }: PolicyManagerProps) {
  const [confirmState, setConfirmState] = useState<{
    category: PolicyCategoryDef;
    option: PolicyOption;
  } | null>(null);

  const handleOptionClick = useCallback((catDef: PolicyCategoryDef, option: PolicyOption) => {
    if (!canChange) return;
    const currentLevel = policies.policies[catDef.category] ?? 1;
    if (option.level === currentLevel) return;
    setConfirmState({ category: catDef, option });
  }, [canChange, policies]);

  const handleConfirm = useCallback(() => {
    if (!confirmState) return;
    onSetPolicy?.(confirmState.category.category, confirmState.option.level);
    setConfirmState(null);
  }, [confirmState, onSetPolicy]);

  const graceActive = policies.graceEnd > 0 && Date.now() / 1000 < policies.graceEnd;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}>
          National Policies
        </div>
        {!canChange && (
          <span style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.orange,
            padding: '2px 8px',
            background: `${SK.orange}15`,
            borderRadius: radius.sm,
          }}>
            HEGEMONY REQUIRED
          </span>
        )}
        {graceActive && (
          <span style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.blue,
            padding: '2px 8px',
            background: `${SK.blue}15`,
            borderRadius: radius.sm,
          }}>
            GRACE PERIOD
          </span>
        )}
      </div>

      {/* Policy Cards */}
      {POLICY_DEFS.map((catDef) => {
        const currentLevel = policies.policies[catDef.category] ?? 1;
        const currentOption = catDef.options[currentLevel];

        return (
          <div key={catDef.category} style={{
            padding: '10px 12px',
            background: SK.cardBg,
            borderRadius: radius.md,
            border: `1px solid ${SK.border}`,
          }}>
            {/* Category name + current selection */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}>
              <span style={{
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                color: SK.textPrimary,
                fontWeight: 600,
              }}>
                {catDef.name}
              </span>
              <span style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.blue,
                fontWeight: 700,
              }}>
                {currentOption.name}
              </span>
            </div>

            {/* 3 option buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {catDef.options.map((opt) => {
                const isActive = opt.level === currentLevel;
                const isDisabled = !canChange || isActive;

                return (
                  <button
                    key={opt.level}
                    onClick={() => !isDisabled && handleOptionClick(catDef, opt)}
                    disabled={isDisabled}
                    title={`${opt.name}: ${opt.description}`}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: radius.sm,
                      border: isActive
                        ? `1px solid ${SK.blue}80`
                        : `1px solid ${SK.border}`,
                      background: isActive
                        ? `${SK.blue}20`
                        : 'transparent',
                      color: isActive ? SK.blue : SK.textSecondary,
                      fontFamily: bodyFont,
                      fontSize: '10px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: isDisabled ? 'default' : 'pointer',
                      opacity: isDisabled && !isActive ? 0.5 : 1,
                      transition: 'all 150ms ease',
                    }}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>

            {/* Active effects */}
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
              {Object.entries(currentOption.effects).map(([stat, value]) => (
                <EffectBadge key={stat} stat={stat} value={value} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Confirmation Modal */}
      {confirmState && (
        <PolicyConfirmModal
          category={confirmState.category}
          option={confirmState.option}
          currentLevel={policies.policies[confirmState.category.category] ?? 1}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

export default PolicyManager;
