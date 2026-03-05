'use client';

import { useState, useEffect } from 'react';
import { McPanel } from '@/components/lobby/McPanel';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

interface RPLeaderEntry {
  rank: number;
  name: string;
  totalRP: number;
  gamesPlayed: number;
}

interface BuildWinRate {
  buildPath: string;
  wins: number;
  rounds: number;
  winRate: number;
}

interface SynergyStats {
  synergyId: string;
  timesAchieved: number;
  totalRounds: number;
  rate: number;
}

type Tab = 'players' | 'builds' | 'synergies';

export function GlobalLeaderboard() {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<RPLeaderEntry[]>([]);
  const [builds, setBuilds] = useState<BuildWinRate[]>([]);
  const [synergies, setSynergies] = useState<SynergyStats[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;

    const fetchAll = async () => {
      try {
        const [lbRes, statsRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/meta/leaderboard`),
          fetch(`${SERVER_URL}/api/meta/stats`),
        ]);

        if (lbRes.ok) {
          const data = await lbRes.json();
          setPlayers(Array.isArray(data) ? data : []);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setBuilds(data.buildWinRates ?? []);
          setSynergies(data.synergyStats ?? []);
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    fetchAll();
  }, [expanded, loaded]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'players', label: 'TOP PLAYERS' },
    { key: 'builds', label: 'BUILD STATS' },
    { key: 'synergies', label: 'SYNERGIES' },
  ];

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
          GLOBAL LEADERBOARD
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
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '0.6rem',
          }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  padding: '0.3rem 0.4rem',
                  fontFamily: pixelFont,
                  fontSize: '0.28rem',
                  color: tab === t.key ? MC.textGold : MC.textGray,
                  backgroundColor: tab === t.key ? 'rgba(255,170,0,0.15)' : 'transparent',
                  border: `1px solid ${tab === t.key ? MC.textGold : MC.panelBorderDark}`,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {tab === 'players' && (
              <PlayersTab players={players} />
            )}
            {tab === 'builds' && (
              <BuildsTab builds={builds} />
            )}
            {tab === 'synergies' && (
              <SynergiesTab synergies={synergies} />
            )}
          </div>
        </div>
      )}
    </McPanel>
  );
}

function PlayersTab({ players }: { players: RPLeaderEntry[] }) {
  if (players.length === 0) {
    return (
      <div style={{ fontFamily: bodyFont, fontSize: '0.7rem', color: MC.textGray, textAlign: 'center', padding: '1rem' }}>
        No players yet. Be the first!
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: MC.textGray, textAlign: 'left' }}>
          <th style={thStyle}>#</th>
          <th style={thStyle}>Name</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>RP</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Games</th>
        </tr>
      </thead>
      <tbody>
        {players.slice(0, 20).map((p) => (
          <tr key={p.name} style={{
            color: p.rank <= 3 ? MC.textGold : MC.textSecondary,
            borderBottom: `1px solid ${MC.panelBorderDark}`,
          }}>
            <td style={tdStyle}>{p.rank}</td>
            <td style={tdStyle}>{p.name}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{p.totalRP}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{p.gamesPlayed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BuildsTab({ builds }: { builds: BuildWinRate[] }) {
  if (builds.length === 0) {
    return (
      <div style={{ fontFamily: bodyFont, fontSize: '0.7rem', color: MC.textGray, textAlign: 'center', padding: '1rem' }}>
        No build data yet.
      </div>
    );
  }

  const maxRounds = Math.max(...builds.map(b => b.rounds), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {builds.map(b => (
        <div key={b.buildPath}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: '2px',
          }}>
            <span style={{
              fontFamily: pixelFont,
              fontSize: '0.3rem',
              color: MC.textPrimary,
              textTransform: 'uppercase',
            }}>
              {b.buildPath}
            </span>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '0.65rem',
              color: MC.textGold,
            }}>
              {b.winRate.toFixed(1)}% win
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '10px',
            backgroundColor: 'rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(b.rounds / maxRounds) * 100}%`,
              height: '100%',
              backgroundColor: MC.btnGreen,
            }} />
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '0.55rem',
            color: MC.textGray,
            textAlign: 'right',
            marginTop: '1px',
          }}>
            {b.rounds} rounds, {b.wins} wins
          </div>
        </div>
      ))}
    </div>
  );
}

function SynergiesTab({ synergies }: { synergies: SynergyStats[] }) {
  if (synergies.length === 0) {
    return (
      <div style={{ fontFamily: bodyFont, fontSize: '0.7rem', color: MC.textGray, textAlign: 'center', padding: '1rem' }}>
        No synergy data yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {synergies.map(s => (
        <div key={s.synergyId} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.3rem 0.4rem',
          backgroundColor: 'rgba(255, 170, 0, 0.06)',
          border: `1px solid ${MC.panelBorderDark}`,
        }}>
          <span style={{
            fontFamily: pixelFont,
            fontSize: '0.3rem',
            color: MC.textGold,
          }}>
            {s.synergyId}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '0.65rem',
            color: MC.textSecondary,
          }}>
            {s.rate.toFixed(1)}% discovery ({s.timesAchieved}x)
          </span>
        </div>
      ))}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
  fontWeight: 'normal',
  fontSize: '0.6rem',
  fontFamily: pixelFont,
};

const tdStyle: React.CSSProperties = {
  padding: '0.2rem 0.3rem',
  fontFamily: bodyFont,
  fontSize: '0.7rem',
};
