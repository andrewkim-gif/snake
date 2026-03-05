'use client';

import { useState } from 'react';
import { MC, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';

export interface RoundAnalysis {
  buildEfficiency: number;
  combatScore: number;
  positioningScore: number;
  suggestions: string[];
}

interface AnalystPanelProps {
  analysis: RoundAnalysis | null;
}

function getScoreColor(score: number): string {
  if (score >= 70) return MC.textGreen;
  if (score >= 40) return MC.textYellow;
  return MC.textRed;
}

function ScoreMeter({ label, score }: { label: string; score: number }) {
  const color = getScoreColor(score);
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: '3px',
      }}>
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.25rem',
          color: MC.textSecondary,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.25rem',
          color,
        }}>
          {score.toFixed(0)}
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, score)}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 500ms ease',
        }} />
      </div>
    </div>
  );
}

export function AnalystPanel({ analysis }: AnalystPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  return (
    <div style={{
      backgroundColor: MC.panelBg,
      boxShadow: mcPanelShadow(),
      border: `2px solid ${MC.panelBorderDark}`,
      padding: '0.6rem 1rem',
      maxWidth: '350px',
      width: '100%',
    }}>
      {/* Header */}
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
          fontSize: '0.35rem',
          color: MC.textGold,
          letterSpacing: '0.06em',
          textShadow: '1px 1px 0 #553300',
        }}>
          {'\u2605'} AI ANALYSIS
        </span>
        <span style={{
          fontFamily: pixelFont,
          fontSize: '0.3rem',
          color: MC.textGray,
        }}>
          {expanded ? '[-]' : '[+]'}
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: '0.5rem' }}>
          {/* Score meters */}
          <ScoreMeter label="BUILD" score={analysis.buildEfficiency} />
          <ScoreMeter label="COMBAT" score={analysis.combatScore} />
          <ScoreMeter label="POSITION" score={analysis.positioningScore} />

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{
                fontFamily: pixelFont,
                fontSize: '0.25rem',
                color: MC.textGray,
                marginBottom: '4px',
                borderTop: `1px solid ${MC.panelBorderDark}`,
                paddingTop: '6px',
              }}>
                SUGGESTIONS
              </div>
              {analysis.suggestions.map((s, i) => (
                <div key={i} style={{
                  fontFamily: bodyFont,
                  fontSize: '0.7rem',
                  color: MC.textSecondary,
                  padding: '3px 0',
                  display: 'flex',
                  gap: '6px',
                  lineHeight: 1.4,
                }}>
                  <span style={{ color: MC.textGold, flexShrink: 0 }}>{'\u2022'}</span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
