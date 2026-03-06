'use client';

import { useState, useEffect, useCallback } from 'react';
import { McPanel } from './McPanel';
import { McButton } from './McButton';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

// ============================================================
// Training Console UI (S51)
// McPanel-based collapsible panel for agent training configuration
// ============================================================

// --- Types ---

interface TrainingProfile {
  agentId: string;
  buildProfile: BuildProfile;
  combatRules: CombatRule[];
  strategyPhases: StrategyPhases;
  personality?: string;
}

interface BuildProfile {
  primaryPath: string;
  fallbackPath: string;
  fallbackCondition: { levelBelow: number; timeElapsed: number };
  bannedUpgrades: string[];
  alwaysPick: string[];
  neverPick: string[];
}

interface CombatRule {
  condition: string;
  action: string;
}

interface StrategyPhases {
  early: string;
  mid: string;
  late: string;
}

interface RoundResult {
  roundId: string;
  timestamp: string;
  rank: number;
  level: number;
  kills: number;
  survivalTime: number;
  synergies: string[];
  deathCause: string;
  buildHash: string;
}

interface AgentMemory {
  agentId: string;
  roundHistory: RoundResult[];
  totalRounds: number;
  totalKills: number;
  avgRank: number;
  avgLevel: number;
  winCount: number;
  bestRank: number;
}

// --- Constants ---

const BUILD_PATHS = ['berserker', 'tank', 'speedster', 'vampire', 'scholar'];
const COMBAT_STYLES = ['aggressive', 'defensive', 'balanced', 'xp_rush', 'endgame'];
const PERSONALITIES = ['warrior', 'guardian', 'scholar', 'runner', 'experimenter', 'adaptive'];
const PERSONALITY_ICONS: Record<string, string> = {
  warrior: '\u2694\uFE0F',
  guardian: '\uD83D\uDEE1\uFE0F',
  scholar: '\uD83D\uDCDA',
  runner: '\uD83C\uDFC3',
  experimenter: '\uD83E\uDDEA',
  adaptive: '\uD83C\uDFAF',
};

const UPGRADE_TYPES = [
  'xp', 'speed', 'damage', 'armor', 'magnet', 'luck', 'regen', 'cursed',
  'venom_aura', 'shield_burst', 'lightning_strike', 'speed_dash', 'mass_drain', 'gravity_well',
];

const CONDITION_TEMPLATES = [
  'mass_ratio > 2.0',
  'mass_ratio < 0.5',
  'time_remaining < 60',
  'mass < 20',
  'mass > 100',
  'level < 5',
  'level > 8',
];

const ACTION_OPTIONS = ['engage', 'flee', 'go_center', 'no_boost', 'farm_orbs', 'camp_shrinkage'];

// --- Props ---

interface TrainingConsoleProps {
  serverUrl: string;
  agentId?: string;
  onTrainingUpdate?: (profile: TrainingProfile) => void;
}

// ============================================================
// Main Component
// ============================================================

export function TrainingConsole({ serverUrl, agentId = 'my-agent', onTrainingUpdate }: TrainingConsoleProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [profile, setProfile] = useState<TrainingProfile | null>(null);
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch training profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/agent/${agentId}/training`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else if (res.status === 404) {
        // No profile yet — initialize with defaults
        setProfile({
          agentId,
          buildProfile: {
            primaryPath: 'scholar',
            fallbackPath: '',
            fallbackCondition: { levelBelow: 0, timeElapsed: 0 },
            bannedUpgrades: [],
            alwaysPick: [],
            neverPick: [],
          },
          combatRules: [],
          strategyPhases: { early: 'balanced', mid: 'balanced', late: 'balanced' },
        });
      }
    } catch {
      setError('Failed to load training profile');
    }
  }, [serverUrl, agentId]);

  // Fetch memory data
  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/agent/${agentId}/memory`);
      if (res.ok) {
        const data = await res.json();
        setMemory(data);
      }
    } catch {
      // Memory might not exist yet
    }
  }, [serverUrl, agentId]);

  useEffect(() => {
    if (!collapsed) {
      setLoading(true);
      Promise.all([fetchProfile(), fetchMemory()]).finally(() => setLoading(false));
    }
  }, [collapsed, fetchProfile, fetchMemory]);

  // Save profile
  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${serverUrl}/api/agent/${agentId}/training`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildProfile: profile.buildProfile,
          combatRules: profile.combatRules,
          strategyPhases: profile.strategyPhases,
          personality: profile.personality,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }

      const saved = await res.json();
      setProfile(saved);
      onTrainingUpdate?.(saved);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to personality preset
  const resetToPreset = (personality: string) => {
    setProfile(prev => prev ? {
      ...prev,
      personality,
    } : null);
  };

  return (
    <McPanel style={{ marginTop: '0.75rem' }}>
      {/* Collapsible Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.6rem',
          color: MC.textGold,
          textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
        }}>
          AGENT TRAINING
        </span>
        <span style={{ color: MC.textSecondary, fontSize: '0.75rem' }}>
          {collapsed ? '\u25B6' : '\u25BC'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '0.75rem' }}>
          {loading ? (
            <p style={{ color: MC.textGray, fontFamily: bodyFont, fontSize: '0.8rem' }}>
              Loading...
            </p>
          ) : (
            <>
              {/* Training Header */}
              <TrainingHeader memory={memory} agentId={agentId} />

              {/* Build Profile Editor */}
              {profile && (
                <BuildProfileEditor
                  profile={profile.buildProfile}
                  personality={profile.personality}
                  onChange={(bp) => setProfile(p => p ? { ...p, buildProfile: bp } : null)}
                  onPersonalityChange={resetToPreset}
                />
              )}

              {/* Combat Rules Editor */}
              {profile && (
                <CombatRulesEditor
                  rules={profile.combatRules}
                  onChange={(rules) => setProfile(p => p ? { ...p, combatRules: rules } : null)}
                />
              )}

              {/* Strategy Phase Editor */}
              {profile && (
                <StrategyPhaseEditor
                  phases={profile.strategyPhases}
                  onChange={(phases) => setProfile(p => p ? { ...p, strategyPhases: phases } : null)}
                />
              )}

              {/* Learning Log */}
              <LearningLog memory={memory} />

              {/* Actions */}
              {error && (
                <p style={{ color: MC.textRed, fontFamily: bodyFont, fontSize: '0.75rem', margin: '0.5rem 0' }}>
                  {error}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <McButton variant="green" onClick={saveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </McButton>
                <McButton variant="default" onClick={fetchProfile}>
                  Reset
                </McButton>
              </div>
            </>
          )}
        </div>
      )}
    </McPanel>
  );
}

// ============================================================
// Sub-Components
// ============================================================

/** TrainingHeader — Agent status display */
function TrainingHeader({ memory, agentId }: { memory: AgentMemory | null; agentId: string }) {
  const winRate = memory && memory.totalRounds > 0
    ? ((memory.winCount / memory.totalRounds) * 100).toFixed(0)
    : '0';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.4rem 0',
      borderBottom: `1px solid ${MC.panelBorderDark}`,
      marginBottom: '0.5rem',
    }}>
      <span style={{ fontFamily: bodyFont, fontSize: '0.8rem', color: MC.textPrimary }}>
        {agentId}
      </span>
      <div style={{ display: 'flex', gap: '0.75rem', fontFamily: bodyFont, fontSize: '0.7rem' }}>
        <span style={{ color: MC.textGreen }}>
          WR: {winRate}%
        </span>
        <span style={{ color: MC.textYellow }}>
          Avg Lv: {memory ? memory.avgLevel.toFixed(1) : '-'}
        </span>
        <span style={{ color: MC.textSecondary }}>
          {memory ? memory.totalRounds : 0} rounds
        </span>
      </div>
    </div>
  );
}

/** BuildProfileEditor — Build path selection + banned/required upgrades */
function BuildProfileEditor({
  profile,
  personality,
  onChange,
  onPersonalityChange,
}: {
  profile: BuildProfile;
  personality?: string;
  onChange: (bp: BuildProfile) => void;
  onPersonalityChange: (p: string) => void;
}) {
  return (
    <SectionPanel title="Build Profile">
      {/* Personality Presets */}
      <div style={{ marginBottom: '0.5rem' }}>
        <Label>Personality Preset</Label>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {PERSONALITIES.map(p => (
            <McButton
              key={p}
              variant={personality === p ? 'green' : 'default'}
              onClick={() => onPersonalityChange(p)}
              style={{ fontSize: '0.5rem', padding: '0.3rem 0.5rem' }}
            >
              {PERSONALITY_ICONS[p] || ''} {p}
            </McButton>
          ))}
        </div>
      </div>

      {/* Primary Path */}
      <div style={{ marginBottom: '0.4rem' }}>
        <Label>Primary Build Path</Label>
        <select
          value={profile.primaryPath}
          onChange={(e) => onChange({ ...profile, primaryPath: e.target.value })}
          style={selectStyle}
        >
          <option value="">-- Select --</option>
          {BUILD_PATHS.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Fallback Path */}
      <div style={{ marginBottom: '0.4rem' }}>
        <Label>Fallback Path</Label>
        <select
          value={profile.fallbackPath}
          onChange={(e) => onChange({ ...profile, fallbackPath: e.target.value })}
          style={selectStyle}
        >
          <option value="">-- None --</option>
          {BUILD_PATHS.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Banned Upgrades */}
      <div style={{ marginBottom: '0.4rem' }}>
        <Label>Banned Upgrades</Label>
        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
          {UPGRADE_TYPES.map(u => (
            <ToggleChip
              key={u}
              label={u}
              active={profile.bannedUpgrades.includes(u)}
              color={MC.textRed}
              onToggle={() => {
                const banned = profile.bannedUpgrades.includes(u)
                  ? profile.bannedUpgrades.filter(b => b !== u)
                  : [...profile.bannedUpgrades, u];
                onChange({ ...profile, bannedUpgrades: banned });
              }}
            />
          ))}
        </div>
      </div>

      {/* Always Pick */}
      <div>
        <Label>Always Pick</Label>
        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
          {UPGRADE_TYPES.map(u => (
            <ToggleChip
              key={u}
              label={u}
              active={profile.alwaysPick.includes(u)}
              color={MC.textGreen}
              onToggle={() => {
                const always = profile.alwaysPick.includes(u)
                  ? profile.alwaysPick.filter(a => a !== u)
                  : [...profile.alwaysPick, u];
                onChange({ ...profile, alwaysPick: always });
              }}
            />
          ))}
        </div>
      </div>
    </SectionPanel>
  );
}

/** CombatRulesEditor — if/then conditional rules */
function CombatRulesEditor({
  rules,
  onChange,
}: {
  rules: CombatRule[];
  onChange: (rules: CombatRule[]) => void;
}) {
  const addRule = () => {
    onChange([...rules, { condition: CONDITION_TEMPLATES[0], action: ACTION_OPTIONS[0] }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: 'condition' | 'action', value: string) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <SectionPanel title="Combat Rules">
      {rules.map((rule, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: '0.3rem',
          alignItems: 'center',
          marginBottom: '0.3rem',
        }}>
          <span style={{ color: MC.textGold, fontFamily: bodyFont, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
            IF
          </span>
          <select
            value={rule.condition}
            onChange={(e) => updateRule(i, 'condition', e.target.value)}
            style={{ ...selectStyle, flex: 1, fontSize: '0.65rem' }}
          >
            {CONDITION_TEMPLATES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span style={{ color: MC.textGold, fontFamily: bodyFont, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
            THEN
          </span>
          <select
            value={rule.action}
            onChange={(e) => updateRule(i, 'action', e.target.value)}
            style={{ ...selectStyle, flex: 1, fontSize: '0.65rem' }}
          >
            {ACTION_OPTIONS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <McButton
            variant="red"
            onClick={() => removeRule(i)}
            style={{ padding: '0.2rem 0.4rem', fontSize: '0.5rem' }}
          >
            X
          </McButton>
        </div>
      ))}
      <McButton
        variant="default"
        onClick={addRule}
        style={{ fontSize: '0.5rem', padding: '0.25rem 0.5rem', marginTop: '0.25rem' }}
      >
        + Add Rule
      </McButton>
    </SectionPanel>
  );
}

/** StrategyPhaseEditor — early/mid/late combat style dropdowns */
function StrategyPhaseEditor({
  phases,
  onChange,
}: {
  phases: StrategyPhases;
  onChange: (phases: StrategyPhases) => void;
}) {
  return (
    <SectionPanel title="Strategy Phases">
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['early', 'mid', 'late'] as const).map(phase => (
          <div key={phase} style={{ flex: 1 }}>
            <Label>{phase.toUpperCase()} ({
              phase === 'early' ? '0-2m' : phase === 'mid' ? '2-4m' : '4-5m'
            })</Label>
            <select
              value={phases[phase]}
              onChange={(e) => onChange({ ...phases, [phase]: e.target.value })}
              style={{ ...selectStyle, width: '100%' }}
            >
              {COMBAT_STYLES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}

/** LearningLog — Recent 10 round results table */
function LearningLog({ memory }: { memory: AgentMemory | null }) {
  if (!memory || memory.roundHistory.length === 0) {
    return (
      <SectionPanel title="Learning Log">
        <p style={{ color: MC.textGray, fontFamily: bodyFont, fontSize: '0.7rem' }}>
          No round data yet. Play some rounds to see results.
        </p>
      </SectionPanel>
    );
  }

  const recent = memory.roundHistory.slice(-10).reverse();

  return (
    <SectionPanel title="Learning Log">
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: bodyFont,
          fontSize: '0.65rem',
          color: MC.textSecondary,
        }}>
          <thead>
            <tr>
              {['#', 'Rank', 'Level', 'Kills', 'Time', 'Synergies', 'Death'].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: '0.2rem 0.3rem',
                  borderBottom: `1px solid ${MC.panelBorderDark}`,
                  color: MC.textGold,
                  fontSize: '0.55rem',
                  fontFamily: pixelFont,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} style={{
                backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}>
                <td style={cellStyle}>{memory.roundHistory.length - i}</td>
                <td style={{
                  ...cellStyle,
                  color: r.rank === 1 ? MC.textGold : r.rank <= 3 ? MC.textGreen : MC.textSecondary,
                }}>
                  #{r.rank}
                </td>
                <td style={cellStyle}>Lv{r.level}</td>
                <td style={cellStyle}>{r.kills}</td>
                <td style={cellStyle}>{formatTime(r.survivalTime)}</td>
                <td style={cellStyle}>{r.synergies.length > 0 ? r.synergies.join(', ') : '-'}</td>
                <td style={cellStyle}>{r.deathCause}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  );
}

// ============================================================
// Utility Components
// ============================================================

/** SectionPanel — Collapsible sub-section with title */
function SectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      marginBottom: '0.5rem',
      backgroundColor: 'rgba(255,255,255,0.03)',
      padding: '0.4rem',
      border: `1px solid ${MC.panelBorderDark}`,
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: open ? '0.3rem' : 0,
        }}
      >
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.5rem',
          color: MC.textSecondary,
          textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
        }}>
          {title}
        </span>
        <span style={{ color: MC.textGray, fontSize: '0.6rem' }}>
          {open ? '\u25BC' : '\u25B6'}
        </span>
      </div>
      {open && children}
    </div>
  );
}

/** Label — Consistent form label */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: bodyFont,
      fontSize: '0.65rem',
      color: MC.textGray,
      marginBottom: '0.15rem',
    }}>
      {children}
    </div>
  );
}

/** ToggleChip — Small clickable tag for upgrade selection */
function ToggleChip({
  label,
  active,
  color,
  onToggle,
}: {
  label: string;
  active: boolean;
  color: string;
  onToggle: () => void;
}) {
  return (
    <span
      onClick={onToggle}
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.3rem',
        fontSize: '0.5rem',
        fontFamily: bodyFont,
        backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
        color: active ? color : MC.textGray,
        border: `1px solid ${active ? color : MC.panelBorderDark}`,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 100ms',
      }}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
}

// ============================================================
// Styles & Helpers
// ============================================================

const selectStyle: React.CSSProperties = {
  backgroundColor: MC.inputBg,
  color: MC.textPrimary,
  border: `1px solid ${MC.inputBorder}`,
  fontFamily: bodyFont,
  fontSize: '0.7rem',
  padding: '0.3rem 0.4rem',
  outline: 'none',
};

const cellStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
  borderBottom: `1px solid rgba(255,255,255,0.05)`,
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
