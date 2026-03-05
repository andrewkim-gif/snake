'use client';

import { useState, useEffect, useCallback } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

interface Personality {
  id: string;
  name: string;
  description: string;
  weights: {
    hunt: number;
    flee: number;
    gather: number;
    wander: number;
  };
}

const PERSONALITY_ICONS: Record<string, string> = {
  aggressive: '\u2694',   // crossed swords
  defensive: '\u26E8',    // shield (using alternative)
  opportunist: '\u2606',  // star
  explorer: '\u26A1',     // lightning / compass
  builder: '\u2692',      // hammer and pick
  berserker: '\u2620',    // skull and crossbones
};

// Fallback icons if above don't render
const PERSONALITY_LABELS: Record<string, string> = {
  aggressive: 'ATK',
  defensive: 'DEF',
  opportunist: 'OPP',
  explorer: 'EXP',
  builder: 'BLD',
  berserker: 'BSK',
};

interface PersonalitySelectorProps {
  playerName: string;
}

export function PersonalitySelector({ playerName }: PersonalitySelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [selected, setSelected] = useState('opportunist');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;

    const fetchPersonalities = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/meta/personalities`);
        if (res.ok) {
          setPersonalities(await res.json());
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    fetchPersonalities();
  }, [expanded, loaded]);

  const handleSelect = useCallback(async (id: string) => {
    setSelected(id);
    if (!playerName) return;

    try {
      await fetch(`${SERVER_URL}/api/agent/personality`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, personality: id }),
      });
    } catch {
      // Silently fail
    }
  }, [playerName]);

  return (
    <McPanel style={{ padding: '0.8rem' }}>
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
          PERSONALITY
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
        <div style={{
          marginTop: '0.8rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
        }}>
          {personalities.map(p => {
            const isActive = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                style={{
                  padding: '0.5rem 0.3rem',
                  backgroundColor: isActive
                    ? 'rgba(255, 170, 0, 0.2)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `2px solid ${isActive ? MC.textGold : MC.panelBorderDark}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'border-color 200ms ease, background-color 200ms ease',
                }}
              >
                {/* Icon */}
                <span style={{
                  fontSize: '1.2rem',
                  lineHeight: 1,
                }}>
                  {PERSONALITY_ICONS[p.id] ?? PERSONALITY_LABELS[p.id]}
                </span>

                {/* Name */}
                <span style={{
                  fontFamily: pixelFont,
                  fontSize: '0.28rem',
                  color: isActive ? MC.textGold : MC.textPrimary,
                  textTransform: 'uppercase',
                }}>
                  {p.name}
                </span>

                {/* Description */}
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '0.55rem',
                  color: MC.textSecondary,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}>
                  {p.description}
                </span>

                {/* Weight bars */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginTop: '2px',
                }}>
                  <WeightBar label="H" value={p.weights.hunt} color={MC.textRed} />
                  <WeightBar label="F" value={p.weights.flee} color={MC.textYellow} />
                  <WeightBar label="G" value={p.weights.gather} color={MC.textGreen} />
                  <WeightBar label="W" value={p.weights.wander} color="#5B8DAD" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </McPanel>
  );
}

function WeightBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <span style={{
        fontFamily: pixelFont,
        fontSize: '0.2rem',
        color: MC.textGray,
        width: '10px',
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: '4px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${value * 100}%`,
          height: '100%',
          backgroundColor: color,
        }} />
      </div>
    </div>
  );
}
