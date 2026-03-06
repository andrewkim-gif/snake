'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// --- Types ---

interface PolicySnapshot {
  country_iso: string;
  tax_rate: number;
  trade_openness: number;
  military_spend: number;
  tech_invest: number;
}

interface PolicyEffect {
  policy: string;
  value: number;
  description: string;
  trade_off: string;
  gold_income_modifier?: number;
  production_modifier?: number;
  defense_bonus_modifier?: number;
  tech_production_bonus?: number;
  gdp_modifier?: number;
}

interface PolicyLimits {
  [key: string]: {
    min: number;
    max: number;
    step: number;
    default: number;
  };
}

// --- Props ---

interface PolicyPanelProps {
  serverUrl: string;
  countryISO: string;
  countryName: string;
  authToken: string;
  currentUserId: string;
  canEdit: boolean; // true if user has Council+ in sovereign faction with Lv.3+
  onPolicyChange?: (policy: PolicySnapshot) => void;
}

// --- Policy Metadata ---

const POLICY_META: Record<string, {
  label: string;
  icon: string;
  color: string;
  unit: string;
  description: string;
  tradeOff: string;
}> = {
  tax_rate: {
    label: 'Tax Rate',
    icon: 'TAX',
    color: SK.gold,
    unit: '%',
    description: 'Gold income from resource production',
    tradeOff: 'High tax may cause agent migration',
  },
  trade_openness: {
    label: 'Trade Openness',
    icon: 'TRD',
    color: SK.blue,
    unit: '%',
    description: 'Allow import/export of resources',
    tradeOff: 'High openness = vulnerable to sanctions',
  },
  military_spend: {
    label: 'Military Spending',
    icon: 'MIL',
    color: SK.red,
    unit: '%',
    description: 'Defense bonus for arena battles',
    tradeOff: 'Reduces civilian production and GDP',
  },
  tech_invest: {
    label: 'Tech Investment',
    icon: 'R&D',
    color: SK.green,
    unit: '%',
    description: 'Boost Tech production and long-term GDP',
    tradeOff: 'Short-term resource reduction',
  },
};

// --- Component ---

export default function PolicyPanel({
  serverUrl,
  countryISO,
  countryName,
  authToken,
  currentUserId,
  canEdit,
  onPolicyChange,
}: PolicyPanelProps) {
  const [policy, setPolicy] = useState<PolicySnapshot | null>(null);
  const [effects, setEffects] = useState<PolicyEffect[]>([]);
  const [limits, setLimits] = useState<PolicyLimits | null>(null);
  const [draft, setDraft] = useState<PolicySnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current policy and limits
  const fetchPolicy = useCallback(async () => {
    try {
      const [policyRes, limitsRes] = await Promise.all([
        fetch(`${serverUrl}/api/economy/policy/${countryISO}`),
        fetch(`${serverUrl}/api/economy/policy/limits`),
      ]);

      if (policyRes.ok) {
        const data = await policyRes.json();
        setPolicy(data.policy);
        setEffects(data.effects || []);
        if (!draft) {
          setDraft(data.policy);
        }
      }

      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setLimits(data.limits);
      }
    } catch {
      setError('Failed to load policy data');
    }
  }, [serverUrl, countryISO, draft]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Save policy changes
  const handleSave = async () => {
    if (!draft || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${serverUrl}/api/economy/policy/${countryISO}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          tax_rate: draft.tax_rate,
          trade_openness: draft.trade_openness,
          military_spend: draft.military_spend,
          tech_invest: draft.tech_invest,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update policy');
      }

      const data = await res.json();
      setPolicy(data.policy);
      setEffects(data.effects || []);
      setDraft(data.policy);
      setSuccess('Policy updated successfully');
      onPolicyChange?.(data.policy);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  // Reset to current values
  const handleReset = () => {
    if (policy) {
      setDraft({ ...policy });
    }
  };

  // Check if draft differs from current
  const hasChanges = draft && policy && (
    draft.tax_rate !== policy.tax_rate ||
    draft.trade_openness !== policy.trade_openness ||
    draft.military_spend !== policy.military_spend ||
    draft.tech_invest !== policy.tech_invest
  );

  if (!policy || !draft) {
    return (
      <div style={{
        background: SK.cardBg,
        border: sketchBorder(),
        borderRadius: radius.lg,
        padding: '24px',
        fontFamily: bodyFont,
        color: SK.textSecondary,
        textAlign: 'center',
      }}>
        Loading economic policy...
      </div>
    );
  }

  return (
    <div style={{
      background: SK.cardBg,
      border: sketchBorder(),
      borderRadius: radius.lg,
      boxShadow: sketchShadow('md'),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: sketchBorder(SK.borderDark),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{
            fontFamily: headingFont,
            fontSize: SKFont.h3,
            color: SK.textWhite,
            margin: 0,
            letterSpacing: '1px',
          }}>
            ECONOMIC POLICY
          </h3>
          <span style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textSecondary,
            marginTop: '2px',
            display: 'block',
          }}>
            {countryName} ({countryISO})
          </span>
        </div>

        {!canEdit && (
          <span style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
            padding: '4px 8px',
            border: sketchBorder(SK.borderDark),
            borderRadius: radius.sm,
          }}>
            VIEW ONLY
          </span>
        )}
      </div>

      {/* Policy Sliders */}
      <div style={{ padding: '16px 20px' }}>
        {(['tax_rate', 'trade_openness', 'military_spend', 'tech_invest'] as const).map((key) => {
          const meta = POLICY_META[key];
          const limit = limits?.[key];
          const value = draft[key];
          const displayValue = key === 'trade_openness'
            ? Math.round(value * 100)
            : Math.round(value * 100);

          return (
            <div key={key} style={{ marginBottom: '20px' }}>
              {/* Label row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: headingFont,
                    fontSize: SKFont.xs,
                    color: meta.color,
                    background: `${meta.color}15`,
                    padding: '2px 6px',
                    borderRadius: radius.sm,
                    letterSpacing: '1px',
                  }}>
                    {meta.icon}
                  </span>
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: SKFont.sm,
                    color: SK.textPrimary,
                    fontWeight: 600,
                  }}>
                    {meta.label}
                  </span>
                </div>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.body,
                  color: meta.color,
                  fontWeight: 700,
                  minWidth: '48px',
                  textAlign: 'right',
                }}>
                  {displayValue}{meta.unit}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={(limit?.min ?? 0) * 100}
                max={(limit?.max ?? 1) * 100}
                step={(limit?.step ?? 0.01) * 100}
                value={value * 100}
                disabled={!canEdit || saving}
                onChange={(e) => {
                  setDraft(prev => prev ? {
                    ...prev,
                    [key]: parseFloat(e.target.value) / 100,
                  } : prev);
                }}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: canEdit ? 'pointer' : 'not-allowed',
                  opacity: canEdit ? 1 : 0.6,
                  accentColor: meta.color,
                }}
              />

              {/* Description */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
              }}>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textMuted,
                }}>
                  {meta.description}
                </span>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.orangeDark,
                }}>
                  {meta.tradeOff}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Effects Preview */}
      {effects.length > 0 && (
        <div style={{
          padding: '12px 20px',
          borderTop: sketchBorder(SK.borderDark),
          background: `${SK.bg}80`,
        }}>
          <h4 style={{
            fontFamily: headingFont,
            fontSize: SKFont.xs,
            color: SK.textSecondary,
            margin: '0 0 8px 0',
            letterSpacing: '2px',
          }}>
            POLICY EFFECTS
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}>
            {effects.map((effect) => {
              const gdpMod = effect.gdp_modifier ?? 1.0;
              const isPositive = gdpMod >= 1.0;
              return (
                <div key={effect.policy} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 8px',
                  background: SK.cardBg,
                  borderRadius: radius.sm,
                  border: sketchBorder(SK.borderDark),
                }}>
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: SKFont.xs,
                    color: SK.textSecondary,
                  }}>
                    GDP
                  </span>
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: SKFont.xs,
                    color: isPositive ? SK.green : SK.red,
                    fontWeight: 600,
                  }}>
                    {isPositive ? '+' : ''}{Math.round((gdpMod - 1) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {canEdit && (
        <div style={{
          padding: '12px 20px',
          borderTop: sketchBorder(SK.borderDark),
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={handleReset}
            disabled={!hasChanges || saving}
            style={{
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textSecondary,
              background: 'transparent',
              border: sketchBorder(SK.border),
              borderRadius: radius.md,
              padding: '6px 14px',
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              opacity: hasChanges && !saving ? 1 : 0.4,
            }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textWhite,
              background: hasChanges ? SK.green : SK.textMuted,
              border: 'none',
              borderRadius: radius.md,
              padding: '6px 14px',
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              opacity: saving ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving...' : 'Apply Policy'}
          </button>
        </div>
      )}

      {/* Status Messages */}
      {(error || success) && (
        <div style={{
          padding: '8px 20px 12px',
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: error ? SK.red : SK.green,
        }}>
          {error || success}
        </div>
      )}
    </div>
  );
}
