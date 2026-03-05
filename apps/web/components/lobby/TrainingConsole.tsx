'use client';

import { useState, useEffect, useCallback } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { McButton } from '@/components/lobby/McButton';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

// ─── Types ───

interface CombatRule {
  condition: string;
  action: string;
  priority?: number;
}

interface TrainingConfig {
  buildPath: string;
  fallbackPath?: string;
  combatStyle: string;
  combatRules: CombatRule[];
  strategyPhases: Array<{ phase: string; strategy: string }>;
  bannedUpgrades: string[];
  alwaysPick: string[];
  updatedAt?: number;
}

interface RoundResult {
  timestamp: number;
  buildPath: string;
  finalLevel: number;
  kills: number;
  rank: number;
  score: number;
  survivalTimeSec: number;
  synergies: string[];
}

interface PerformanceStats {
  avgRank: number;
  avgLevel: number;
  avgKills: number;
  avgScore: number;
  avgSurvival: number;
  winRate: number;
  topSynergies: string[];
}

interface TrainingConsoleProps {
  /** Socket.IO setTrainingProfile 콜백 */
  onSaveProfile?: (agentId: string, profile: any) => void;
}

// ─── Constants ───

const BUILD_PATHS = [
  { value: 'berserker', label: 'BERSERKER', desc: 'Damage > Cursed > Venom > Speed', synergy: 'Glass Cannon', icon: '⚔' },
  { value: 'tank', label: 'TANK', desc: 'Armor > Regen > Shield > Mass Drain', synergy: 'Iron Fortress', icon: '🛡' },
  { value: 'speedster', label: 'SPEEDSTER', desc: 'Speed > Magnet > XP > Speed Dash', synergy: 'Speedster', icon: '⚡' },
  { value: 'vampire', label: 'VAMPIRE', desc: 'Regen > Venom > Mass Drain > Damage', synergy: 'Vampire', icon: '🦇' },
  { value: 'scholar', label: 'SCHOLAR', desc: 'XP > Luck > Magnet', synergy: 'Holy Trinity', icon: '📚' },
] as const;

const COMBAT_STYLES = ['aggressive', 'defensive', 'balanced'] as const;

const PHASE_STRATEGIES = ['gather', 'fight', 'farm', 'kite', 'camp'] as const;

const COMBAT_ACTIONS = ['engage', 'flee', 'kite', 'go_center', 'gather', 'camp'] as const;

const DEFAULT_COMBAT_RULES: CombatRule[] = [
  { condition: 'mass_ratio > 2.0', action: 'engage', priority: 1 },
  { condition: 'mass_ratio < 0.5', action: 'flee', priority: 0 },
  { condition: 'nearby_threats >= 2', action: 'flee', priority: 0 },
  { condition: 'health_ratio < 0.3', action: 'flee', priority: 0 },
  { condition: 'arena_radius_ratio > 0.85', action: 'go_center', priority: 1 },
];

const CONDITION_VARIABLES = [
  { name: 'mass_ratio', desc: 'My mass / Enemy mass' },
  { name: 'nearby_threats', desc: 'Threats nearby (>1.5x mass)' },
  { name: 'nearby_enemies', desc: 'Enemies within range' },
  { name: 'health_ratio', desc: 'Current health ratio' },
  { name: 'arena_radius_ratio', desc: 'Distance from center / Arena radius' },
  { name: 'time_ratio', desc: 'Time remaining / Total time' },
  { name: 'level', desc: 'My level' },
  { name: 'distance', desc: 'Nearest enemy distance' },
];

const UPGRADES_LIST = [
  'damage', 'cursed', 'speed', 'armor', 'regen', 'magnet', 'luck', 'xp',
  'venom_aura', 'shield_burst', 'lightning_strike', 'speed_dash', 'mass_drain', 'gravity_well',
];

// ─── Component ───

export function TrainingConsole({ onSaveProfile }: TrainingConsoleProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'build' | 'combat' | 'strategy' | 'log'>('build');
  const [config, setConfig] = useState<TrainingConfig>({
    buildPath: 'berserker',
    combatStyle: 'balanced',
    combatRules: [...DEFAULT_COMBAT_RULES],
    strategyPhases: [
      { phase: 'early', strategy: 'gather' },
      { phase: 'mid', strategy: 'farm' },
      { phase: 'late', strategy: 'fight' },
    ],
    bannedUpgrades: [],
    alwaysPick: [],
  });
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  // Fetch config + history on expand
  useEffect(() => {
    if (!expanded || loaded) return;

    const fetchData = async () => {
      try {
        const [cfgRes, histRes, statsRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/v1/agents/default/training`).catch(() => null),
          fetch(`${SERVER_URL}/api/v1/agents/default/training/history`).catch(() => null),
          fetch(`${SERVER_URL}/api/v1/agents/default/training/stats`).catch(() => null),
        ]);

        if (cfgRes?.ok) {
          const data = await cfgRes.json();
          setConfig(prev => ({
            ...prev,
            buildPath: data.buildProfile?.primaryPath ?? prev.buildPath,
            fallbackPath: data.buildProfile?.fallbackPath,
            combatRules: data.combatRules ?? prev.combatRules,
            strategyPhases: data.strategyPhases
              ? [
                  { phase: 'early', strategy: data.strategyPhases.early },
                  { phase: 'mid', strategy: data.strategyPhases.mid },
                  { phase: 'late', strategy: data.strategyPhases.late },
                ]
              : prev.strategyPhases,
            bannedUpgrades: data.buildProfile?.bannedUpgrades ?? [],
            alwaysPick: data.buildProfile?.alwaysPick ?? [],
          }));
        }
        if (histRes?.ok) {
          const data = await histRes.json();
          setHistory(Array.isArray(data) ? data : []);
        }
        if (statsRes?.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    fetchData();
  }, [expanded, loaded]);

  // Save config
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveSuccess(null);

    const profile = {
      buildProfile: {
        primaryPath: config.buildPath,
        fallbackPath: config.fallbackPath,
        bannedUpgrades: config.bannedUpgrades,
        alwaysPick: config.alwaysPick,
      },
      combatRules: config.combatRules,
      strategyPhases: {
        early: config.strategyPhases[0]?.strategy || 'gather',
        mid: config.strategyPhases[1]?.strategy || 'farm',
        late: config.strategyPhases[2]?.strategy || 'fight',
      },
    };

    try {
      // Socket.IO 방식
      if (onSaveProfile) {
        onSaveProfile('default', profile);
      }

      // REST 방식 (보완)
      await fetch(`${SERVER_URL}/api/v1/agents/default/training`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(null), 2000);
    } catch {
      setSaveSuccess(false);
      setTimeout(() => setSaveSuccess(null), 3000);
    } finally {
      setSaving(false);
    }
  }, [config, onSaveProfile]);

  // ─── Updaters ───

  const updateBuildPath = (buildPath: string) => {
    setConfig(prev => ({ ...prev, buildPath }));
  };

  const updateFallbackPath = (fallbackPath: string) => {
    setConfig(prev => ({ ...prev, fallbackPath: fallbackPath || undefined }));
  };

  const updatePhaseStrategy = (phase: string, strategy: string) => {
    setConfig(prev => ({
      ...prev,
      strategyPhases: prev.strategyPhases.map(p =>
        p.phase === phase ? { ...p, strategy } : p,
      ),
    }));
  };

  const addCombatRule = () => {
    setConfig(prev => ({
      ...prev,
      combatRules: [...prev.combatRules, { condition: 'mass_ratio > 1.5', action: 'engage', priority: 5 }],
    }));
  };

  const removeCombatRule = (index: number) => {
    setConfig(prev => ({
      ...prev,
      combatRules: prev.combatRules.filter((_, i) => i !== index),
    }));
  };

  const updateCombatRule = (index: number, field: keyof CombatRule, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      combatRules: prev.combatRules.map((r, i) =>
        i === index ? { ...r, [field]: value } : r,
      ),
    }));
  };

  const toggleBannedUpgrade = (upgrade: string) => {
    setConfig(prev => ({
      ...prev,
      bannedUpgrades: prev.bannedUpgrades.includes(upgrade)
        ? prev.bannedUpgrades.filter(u => u !== upgrade)
        : [...prev.bannedUpgrades, upgrade],
    }));
  };

  const toggleAlwaysPick = (upgrade: string) => {
    setConfig(prev => ({
      ...prev,
      alwaysPick: prev.alwaysPick.includes(upgrade)
        ? prev.alwaysPick.filter(u => u !== upgrade)
        : [...prev.alwaysPick, upgrade],
    }));
  };

  // ─── Render ───

  return (
    <McPanel style={{ padding: '0.8rem' }}>
      {/* Header with toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 0,
        }}
      >
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.5rem',
          color: MC.textGold,
          textShadow: '1px 1px 0 #553300',
          letterSpacing: '0.05em',
        }}>
          AGENT TRAINING
        </span>
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.4rem',
          color: MC.textGray,
        }}>
          {expanded ? '[-]' : '[+]'}
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: '0.8rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.8rem' }}>
            {(['build', 'combat', 'strategy', 'log'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  background: activeTab === tab ? MC.btnGreen : MC.btnDefault,
                  border: `2px solid ${activeTab === tab ? MC.btnGreenDark : MC.btnDefaultDark}`,
                  borderBottom: `3px solid ${activeTab === tab ? MC.btnGreenDark : MC.btnDefaultDark}`,
                  color: MC.textPrimary,
                  fontFamily: pixelFont,
                  fontSize: '0.3rem',
                  padding: '0.35rem 0.2rem',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {activeTab === 'build' && <BuildTab
              config={config}
              onUpdateBuildPath={updateBuildPath}
              onUpdateFallbackPath={updateFallbackPath}
              onToggleBanned={toggleBannedUpgrade}
              onToggleAlwaysPick={toggleAlwaysPick}
            />}

            {activeTab === 'combat' && <CombatTab
              rules={config.combatRules}
              onAdd={addCombatRule}
              onRemove={removeCombatRule}
              onUpdate={updateCombatRule}
            />}

            {activeTab === 'strategy' && <StrategyTab
              phases={config.strategyPhases}
              onUpdatePhase={updatePhaseStrategy}
            />}

            {activeTab === 'log' && <LogTab
              history={history}
              stats={stats}
            />}
          </div>

          {/* Save Button */}
          <div style={{ marginTop: '0.8rem' }}>
            <McButton
              variant={saveSuccess === true ? 'green' : saveSuccess === false ? 'red' : 'green'}
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', fontSize: '0.45rem', padding: '0.5rem' }}
            >
              {saving ? 'SAVING...' : saveSuccess === true ? 'SAVED!' : saveSuccess === false ? 'SAVE FAILED' : 'SAVE CONFIG'}
            </McButton>
          </div>
        </div>
      )}
    </McPanel>
  );
}

// ─── Build Tab ───

function BuildTab({
  config,
  onUpdateBuildPath,
  onUpdateFallbackPath,
  onToggleBanned,
  onToggleAlwaysPick,
}: {
  config: TrainingConfig;
  onUpdateBuildPath: (path: string) => void;
  onUpdateFallbackPath: (path: string) => void;
  onToggleBanned: (upgrade: string) => void;
  onToggleAlwaysPick: (upgrade: string) => void;
}) {
  return (
    <>
      {/* Primary Build Path */}
      <Section title="PRIMARY BUILD PATH">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {BUILD_PATHS.map(bp => (
            <button
              key={bp.value}
              onClick={() => onUpdateBuildPath(bp.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.6rem',
                background: config.buildPath === bp.value
                  ? `linear-gradient(to right, ${MC.btnGreenDark}, ${MC.btnGreen})`
                  : MC.inputBg,
                border: `2px solid ${config.buildPath === bp.value ? MC.btnGreen : MC.panelBorderDark}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{bp.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: pixelFont,
                  fontSize: '0.35rem',
                  color: config.buildPath === bp.value ? MC.textPrimary : MC.textSecondary,
                  letterSpacing: '0.05em',
                }}>
                  {bp.label}
                </div>
                <div style={{
                  fontFamily: bodyFont,
                  fontSize: '0.65rem',
                  color: MC.textGray,
                  marginTop: '0.1rem',
                }}>
                  {bp.desc}
                </div>
              </div>
              <div style={{
                fontFamily: pixelFont,
                fontSize: '0.25rem',
                color: MC.textYellow,
              }}>
                {bp.synergy}
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Fallback Path */}
      <Section title="FALLBACK PATH (OPTIONAL)">
        <select
          value={config.fallbackPath || ''}
          onChange={(e) => onUpdateFallbackPath(e.target.value)}
          style={{
            ...selectStyle,
            width: '100%',
          }}
        >
          <option value="">None</option>
          {BUILD_PATHS.filter(bp => bp.value !== config.buildPath).map(bp => (
            <option key={bp.value} value={bp.value}>{bp.label}</option>
          ))}
        </select>
        <div style={{ fontFamily: bodyFont, fontSize: '0.6rem', color: MC.textGray, marginTop: '0.3rem' }}>
          Activated when falling behind (e.g., low level after 2 min)
        </div>
      </Section>

      {/* Banned / Always Pick */}
      <Section title="UPGRADE PREFERENCES">
        <div style={{ marginBottom: '0.4rem' }}>
          <div style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textRed, marginBottom: '0.3rem' }}>
            BANNED (never pick):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {UPGRADES_LIST.map(u => (
              <ChipButton
                key={`ban-${u}`}
                label={u}
                active={config.bannedUpgrades.includes(u)}
                color={MC.btnRed}
                onClick={() => onToggleBanned(u)}
              />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: pixelFont, fontSize: '0.25rem', color: MC.textGreen, marginBottom: '0.3rem' }}>
            ALWAYS PICK (priority):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {UPGRADES_LIST.map(u => (
              <ChipButton
                key={`always-${u}`}
                label={u}
                active={config.alwaysPick.includes(u)}
                color={MC.btnGreen}
                onClick={() => onToggleAlwaysPick(u)}
              />
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

// ─── Combat Tab ───

function CombatTab({
  rules,
  onAdd,
  onRemove,
  onUpdate,
}: {
  rules: CombatRule[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof CombatRule, value: string | number) => void;
}) {
  return (
    <>
      <Section title="COMBAT RULES">
        <div style={{ fontFamily: bodyFont, fontSize: '0.6rem', color: MC.textGray, marginBottom: '0.5rem' }}>
          Rules are evaluated top-to-bottom. First matching rule wins.
        </div>

        {rules.map((rule, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '0.3rem',
            alignItems: 'center',
            marginBottom: '0.4rem',
            padding: '0.3rem',
            background: MC.inputBg,
            border: `1px solid ${MC.panelBorderDark}`,
          }}>
            <span style={{
              fontFamily: pixelFont,
              fontSize: '0.25rem',
              color: MC.textYellow,
              minWidth: '16px',
              textAlign: 'center',
            }}>
              {i + 1}
            </span>

            {/* Condition */}
            <input
              value={rule.condition}
              onChange={(e) => onUpdate(i, 'condition', e.target.value)}
              placeholder="mass_ratio > 2.0"
              style={{
                ...inputStyle,
                flex: 2,
              }}
            />

            {/* Arrow */}
            <span style={{ fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGray }}>
              {'>'}
            </span>

            {/* Action */}
            <select
              value={rule.action}
              onChange={(e) => onUpdate(i, 'action', e.target.value)}
              style={{
                ...selectStyle,
                flex: 1,
              }}
            >
              {COMBAT_ACTIONS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Remove */}
            <button
              onClick={() => onRemove(i)}
              style={{
                background: MC.btnRed,
                border: `1px solid ${MC.btnRedDark}`,
                color: MC.textPrimary,
                fontFamily: pixelFont,
                fontSize: '0.25rem',
                padding: '0.2rem 0.3rem',
                cursor: 'pointer',
              }}
            >
              X
            </button>
          </div>
        ))}

        <McButton
          variant="default"
          onClick={onAdd}
          style={{ width: '100%', fontSize: '0.35rem', padding: '0.35rem' }}
        >
          + ADD RULE
        </McButton>
      </Section>

      {/* Condition Reference */}
      <Section title="CONDITION REFERENCE">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {CONDITION_VARIABLES.map(v => (
            <div key={v.name} style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: bodyFont,
              fontSize: '0.6rem',
            }}>
              <code style={{ color: MC.textYellow, fontFamily: 'monospace', fontSize: '0.6rem' }}>
                {v.name}
              </code>
              <span style={{ color: MC.textGray }}>{v.desc}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ─── Strategy Tab ───

function StrategyTab({
  phases,
  onUpdatePhase,
}: {
  phases: Array<{ phase: string; strategy: string }>;
  onUpdatePhase: (phase: string, strategy: string) => void;
}) {
  const phaseInfo: Record<string, { time: string; color: string }> = {
    early: { time: '0:00 - 2:00', color: MC.textGreen },
    mid: { time: '2:00 - 4:00', color: MC.textYellow },
    late: { time: '4:00 - 5:00', color: MC.textRed },
  };

  return (
    <Section title="STRATEGY PHASES">
      <div style={{ fontFamily: bodyFont, fontSize: '0.6rem', color: MC.textGray, marginBottom: '0.5rem' }}>
        Define behavior for each phase of the round.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {phases.map(phase => {
          const info = phaseInfo[phase.phase] || { time: '', color: MC.textGray };
          return (
            <div key={phase.phase} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem',
              background: MC.inputBg,
              border: `1px solid ${MC.panelBorderDark}`,
            }}>
              <div style={{ minWidth: '70px' }}>
                <div style={{
                  fontFamily: pixelFont,
                  fontSize: '0.35rem',
                  color: info.color,
                  textTransform: 'uppercase',
                }}>
                  {phase.phase}
                </div>
                <div style={{
                  fontFamily: bodyFont,
                  fontSize: '0.55rem',
                  color: MC.textGray,
                }}>
                  {info.time}
                </div>
              </div>

              <select
                value={phase.strategy}
                onChange={(e) => onUpdatePhase(phase.phase, e.target.value)}
                style={{
                  ...selectStyle,
                  flex: 1,
                }}
              >
                {PHASE_STRATEGIES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>

              <div style={{
                fontFamily: bodyFont,
                fontSize: '0.55rem',
                color: MC.textGray,
                minWidth: '100px',
              }}>
                {getStrategyDesc(phase.strategy)}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Log Tab ───

function LogTab({
  history,
  stats,
}: {
  history: RoundResult[];
  stats: PerformanceStats | null;
}) {
  return (
    <>
      {/* Performance Stats */}
      {stats && (stats.avgRank > 0 || stats.avgLevel > 0) && (
        <Section title="PERFORMANCE STATS">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.4rem',
          }}>
            <StatCard label="Avg Rank" value={`#${stats.avgRank}`} color={MC.textGold} />
            <StatCard label="Avg Level" value={`Lv.${stats.avgLevel}`} color={MC.textGreen} />
            <StatCard label="Avg Kills" value={`${stats.avgKills}`} color={MC.textRed} />
            <StatCard label="Win Rate" value={`${stats.winRate}%`} color={MC.textYellow} />
            <StatCard label="Avg Score" value={`${stats.avgScore}`} color={MC.textPrimary} />
            <StatCard label="Avg Survival" value={`${stats.avgSurvival}s`} color={MC.textSecondary} />
          </div>
          {stats.topSynergies.length > 0 && (
            <div style={{
              marginTop: '0.4rem',
              fontFamily: bodyFont,
              fontSize: '0.65rem',
              color: MC.textGray,
            }}>
              Top Synergies: {stats.topSynergies.map(s => (
                <span key={s} style={{
                  color: MC.textYellow,
                  marginLeft: '0.3rem',
                  padding: '0.1rem 0.3rem',
                  background: 'rgba(255, 170, 0, 0.15)',
                  border: `1px solid rgba(255, 170, 0, 0.3)`,
                }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Round History */}
      <Section title="LEARNING LOG">
        {history.length === 0 ? (
          <div style={{
            fontFamily: bodyFont,
            fontSize: '0.7rem',
            color: MC.textGray,
            textAlign: 'center',
            padding: '1rem',
          }}>
            No round data yet. Play some rounds!
          </div>
        ) : (
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '0.65rem',
            fontFamily: bodyFont,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: MC.textGray, textAlign: 'left' }}>
                  <th style={thStyle}>Lv</th>
                  <th style={thStyle}>Kills</th>
                  <th style={thStyle}>Rank</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Build</th>
                  <th style={thStyle}>Synergies</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((r, i) => (
                  <tr key={i} style={{
                    color: r.rank === 1 ? MC.textGold : MC.textSecondary,
                    borderBottom: `1px solid ${MC.panelBorderDark}`,
                  }}>
                    <td style={tdStyle}>{r.finalLevel}</td>
                    <td style={tdStyle}>{r.kills}</td>
                    <td style={tdStyle}>#{r.rank}</td>
                    <td style={tdStyle}>{r.score}</td>
                    <td style={tdStyle}>{r.buildPath}</td>
                    <td style={tdStyle}>
                      {r.synergies.length > 0
                        ? r.synergies.join(', ')
                        : <span style={{ color: MC.textGray }}>-</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Sub-components ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: pixelFont,
        fontSize: '0.35rem',
        color: MC.textSecondary,
        marginBottom: '0.4rem',
        letterSpacing: '0.08em',
        borderBottom: `1px solid ${MC.panelBorderDark}`,
        paddingBottom: '0.2rem',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : 'transparent',
        border: `1px solid ${active ? color : MC.panelBorderDark}`,
        color: active ? MC.textPrimary : MC.textGray,
        fontFamily: bodyFont,
        fontSize: '0.6rem',
        padding: '0.15rem 0.4rem',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: MC.inputBg,
      border: `1px solid ${MC.panelBorderDark}`,
      padding: '0.3rem',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: pixelFont, fontSize: '0.35rem', color }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: '0.55rem', color: MC.textGray, marginTop: '0.1rem' }}>{label}</div>
    </div>
  );
}

// ─── Helpers ───

function getStrategyDesc(strategy: string): string {
  switch (strategy) {
    case 'gather': return 'Collect orbs safely';
    case 'fight': return 'Hunt weak enemies';
    case 'farm': return 'Balanced farming';
    case 'kite': return 'Hit-and-run tactics';
    case 'camp': return 'Camp shrink edge';
    default: return '';
  }
}

// ─── Styles ───

const thStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
  fontWeight: 'normal',
  fontSize: '0.6rem',
};

const tdStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
};

const selectStyle: React.CSSProperties = {
  backgroundColor: MC.inputBg,
  border: `1px solid ${MC.inputBorder}`,
  color: MC.textPrimary,
  fontFamily: bodyFont,
  fontSize: '0.75rem',
  padding: '0.3rem 0.5rem',
  outline: 'none',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: MC.inputBg,
  border: `1px solid ${MC.inputBorder}`,
  color: MC.textPrimary,
  fontFamily: 'monospace',
  fontSize: '0.65rem',
  padding: '0.25rem 0.4rem',
  outline: 'none',
};
