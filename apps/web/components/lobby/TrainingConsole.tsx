'use client';

import { useState, useEffect, useCallback } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { McButton } from '@/components/lobby/McButton';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

// ─── Types ───

interface StrategyPhase {
  phase: string;
  strategy: string;
}

interface TrainingConfig {
  buildPath: string;
  combatStyle: string;
  strategyPhases: StrategyPhase[];
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

// ─── Constants ───

const BUILD_PATHS = [
  { value: 'berserker', label: 'BERSERKER', desc: 'Damage + Speed' },
  { value: 'fortress', label: 'FORTRESS', desc: 'Regen + Armor' },
  { value: 'quicksilver', label: 'QUICKSILVER', desc: 'Speed + Magnet' },
  { value: 'collector', label: 'COLLECTOR', desc: 'Magnet + XP' },
  { value: 'balanced', label: 'BALANCED', desc: 'All-round' },
] as const;

const COMBAT_STYLES = ['aggressive', 'defensive', 'balanced'] as const;

const PHASE_STRATEGIES = ['gather', 'fight', 'farm', 'kite', 'camp'] as const;

// ─── Component ───

export function TrainingConsole() {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<TrainingConfig>({
    buildPath: 'balanced',
    combatStyle: 'balanced',
    strategyPhases: [
      { phase: 'early', strategy: 'gather' },
      { phase: 'mid', strategy: 'farm' },
      { phase: 'late', strategy: 'fight' },
    ],
  });
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch config + history on expand
  useEffect(() => {
    if (!expanded || loaded) return;

    const fetchData = async () => {
      try {
        const [cfgRes, histRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/training?agentId=default`),
          fetch(`${SERVER_URL}/api/training/history?agentId=default`),
        ]);

        if (cfgRes.ok) {
          const data = await cfgRes.json();
          setConfig(data);
        }
        if (histRes.ok) {
          const data = await histRes.json();
          setHistory(Array.isArray(data) ? data : []);
        }
        setLoaded(true);
      } catch {
        // Server may not be running, use defaults
        setLoaded(true);
      }
    };
    fetchData();
  }, [expanded, loaded]);

  // Save config
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`${SERVER_URL}/api/training`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'default', config }),
      });
    } catch {
      // Silently fail if server unavailable
    } finally {
      setSaving(false);
    }
  }, [config]);

  const updateBuildPath = (buildPath: string) => {
    setConfig(prev => ({ ...prev, buildPath }));
  };

  const updateCombatStyle = (combatStyle: string) => {
    setConfig(prev => ({ ...prev, combatStyle }));
  };

  const updatePhaseStrategy = (phase: string, strategy: string) => {
    setConfig(prev => ({
      ...prev,
      strategyPhases: prev.strategyPhases.map(p =>
        p.phase === phase ? { ...p, strategy } : p
      ),
    }));
  };

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
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

          {/* Build Path Selector */}
          <Section title="BUILD PATH">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {BUILD_PATHS.map(bp => (
                <McButton
                  key={bp.value}
                  variant={config.buildPath === bp.value ? 'green' : 'default'}
                  onClick={() => updateBuildPath(bp.value)}
                  style={{ fontSize: '0.4rem', padding: '0.4rem 0.6rem', flex: '1 1 auto', minWidth: '80px' }}
                >
                  {bp.label}
                </McButton>
              ))}
            </div>
            {config.buildPath && (
              <div style={{
                fontFamily: bodyFont,
                fontSize: '0.7rem',
                color: MC.textSecondary,
                marginTop: '0.3rem',
              }}>
                {BUILD_PATHS.find(bp => bp.value === config.buildPath)?.desc ?? ''}
              </div>
            )}
          </Section>

          {/* Combat Style */}
          <Section title="COMBAT STYLE">
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {COMBAT_STYLES.map(style => (
                <label key={style} style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer',
                  fontFamily: bodyFont, fontSize: '0.75rem',
                  color: config.combatStyle === style ? MC.textGreen : MC.textSecondary,
                }}>
                  <input
                    type="radio"
                    name="combatStyle"
                    checked={config.combatStyle === style}
                    onChange={() => updateCombatStyle(style)}
                    style={{ accentColor: MC.btnGreen }}
                  />
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </label>
              ))}
            </div>
          </Section>

          {/* Strategy Phases */}
          <Section title="STRATEGY PHASES">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {config.strategyPhases.map(phase => (
                <div key={phase.phase} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span style={{
                    fontFamily: pixelFont, fontSize: '0.35rem',
                    color: MC.textYellow, width: '50px', textTransform: 'uppercase',
                  }}>
                    {phase.phase}
                  </span>
                  <select
                    value={phase.strategy}
                    onChange={(e) => updatePhaseStrategy(phase.phase, e.target.value)}
                    style={{
                      backgroundColor: MC.inputBg,
                      border: `1px solid ${MC.inputBorder}`,
                      color: MC.textPrimary,
                      fontFamily: bodyFont,
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.5rem',
                      flex: 1,
                      outline: 'none',
                    }}
                  >
                    {PHASE_STRATEGIES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Section>

          {/* Save Button */}
          <McButton
            variant="green"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', fontSize: '0.45rem', padding: '0.5rem' }}
          >
            {saving ? 'SAVING...' : 'SAVE CONFIG'}
          </McButton>

          {/* Learning Log */}
          {history.length > 0 && (
            <Section title="LEARNING LOG">
              <div style={{
                maxHeight: '150px',
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}
    </McPanel>
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

const thStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
  fontWeight: 'normal',
  fontSize: '0.6rem',
};

const tdStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
};
