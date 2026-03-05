'use client';

import { useState, useEffect } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

const SKIN_THRESHOLDS = [
  50, 100, 200, 350, 500, 750,
  1000, 1300, 1600, 2000, 2500, 3000,
  3500, 4000, 5000, 6000, 7500, 10000,
];

interface RPData {
  totalRP: number;
  unlockedSkins: number[];
  unlockedPersonalities: string[];
  gamesPlayed: number;
  nextUnlock: number;
  unlockedCount: number;
  totalUnlocks: number;
}

interface RPPanelProps {
  playerName: string;
}

export function RPPanel({ playerName }: RPPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<RPData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded || !playerName) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/meta/rp?name=${encodeURIComponent(playerName)}`);
        if (res.ok) {
          setData(await res.json());
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    fetchData();
  }, [expanded, loaded, playerName]);

  // Refetch when playerName changes
  useEffect(() => {
    setLoaded(false);
  }, [playerName]);

  const progressPct = data && data.nextUnlock > 0
    ? Math.min(100, (data.totalRP / data.nextUnlock) * 100)
    : 100;

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
          REPUTATION
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
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Current RP + Games */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontFamily: pixelFont,
                fontSize: '0.6rem',
                color: MC.textGold,
                textShadow: '1px 1px 0 #553300',
              }}>
                {data?.totalRP ?? 0} RP
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: '0.7rem',
                color: MC.textSecondary,
                marginTop: '2px',
              }}>
                {data?.gamesPlayed ?? 0} games played
              </div>
            </div>
            {!playerName && (
              <div style={{
                fontFamily: pixelFont,
                fontSize: '0.3rem',
                color: MC.textGray,
              }}>
                Enter name to track
              </div>
            )}
          </div>

          {/* Progress bar to next unlock */}
          {data && data.nextUnlock > 0 && (
            <div>
              <div style={{
                fontFamily: pixelFont,
                fontSize: '0.3rem',
                color: MC.textSecondary,
                marginBottom: '4px',
              }}>
                NEXT UNLOCK: {data.nextUnlock} RP
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: `1px solid ${MC.panelBorderDark}`,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  backgroundColor: MC.btnGreen,
                  transition: 'width 300ms ease',
                }} />
              </div>
              <div style={{
                fontFamily: bodyFont,
                fontSize: '0.6rem',
                color: MC.textGray,
                textAlign: 'right',
                marginTop: '2px',
              }}>
                {data.totalRP}/{data.nextUnlock}
              </div>
            </div>
          )}

          {/* Unlock milestones grid */}
          <div>
            <div style={{
              fontFamily: pixelFont,
              fontSize: '0.3rem',
              color: MC.textSecondary,
              marginBottom: '6px',
              borderBottom: `1px solid ${MC.panelBorderDark}`,
              paddingBottom: '3px',
              letterSpacing: '0.06em',
            }}>
              UNLOCK MILESTONES
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '4px',
            }}>
              {SKIN_THRESHOLDS.map((threshold, i) => {
                const unlocked = (data?.totalRP ?? 0) >= threshold;
                return (
                  <div key={i} style={{
                    textAlign: 'center',
                    padding: '4px 2px',
                    backgroundColor: unlocked
                      ? 'rgba(255, 170, 0, 0.2)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${unlocked ? MC.textGold : MC.panelBorderDark}`,
                  }}>
                    <div style={{
                      fontFamily: pixelFont,
                      fontSize: '0.25rem',
                      color: unlocked ? MC.textGold : MC.textGray,
                    }}>
                      {unlocked ? '\u2713' : '\u25CF'}
                    </div>
                    <div style={{
                      fontFamily: bodyFont,
                      fontSize: '0.55rem',
                      color: unlocked ? MC.textGold : MC.textGray,
                      marginTop: '1px',
                    }}>
                      {threshold >= 1000 ? `${threshold / 1000}k` : threshold}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </McPanel>
  );
}
