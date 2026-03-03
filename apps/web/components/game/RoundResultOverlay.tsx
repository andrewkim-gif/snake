'use client';

import type { RoundEndPayload } from '@snake-arena/shared';

const P = {
  paper: '#F5F0E8',
  pencilDark: '#3A3028',
  pencilMedium: '#6B5E52',
  crayonOrange: '#D4914A',
  crayonGreen: '#7BA868',
  crayonRed: '#C75B5B',
  crayonBlue: '#5B8DAD',
} as const;

interface RoundResultOverlayProps {
  roundEnd: RoundEndPayload;
}

export function RoundResultOverlay({ roundEnd }: RoundResultOverlayProps) {
  const { winner, yourRank, yourScore, finalLeaderboard } = roundEnd;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(245, 240, 232, 0.94)',
      zIndex: 40,
      fontFamily: '"Patrick Hand", "Inter", sans-serif',
      gap: '0.8rem',
    }}>
      {/* Title */}
      <h2 style={{
        fontSize: '2.2rem', fontWeight: 900, color: P.crayonOrange,
        margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
        position: 'relative',
      }}>
        ROUND OVER!
        <span style={{
          position: 'absolute', bottom: '-3px', left: '10%', width: '80%',
          height: '2.5px', backgroundColor: P.pencilDark, opacity: 0.2,
        }} />
      </h2>

      {/* Winner */}
      {winner && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
        }}>
          <span style={{ fontSize: '0.9rem', color: P.pencilMedium }}>Winner</span>
          <span style={{
            fontSize: '1.8rem', fontWeight: 900, color: P.crayonOrange,
          }}>
            {winner.name}
          </span>
          <span style={{ fontSize: '0.85rem', color: P.pencilMedium }}>
            {winner.score} pts · {winner.kills} kills
          </span>
        </div>
      )}

      {/* Your stats */}
      <div style={{
        display: 'flex', gap: '1.5rem', fontSize: '1rem', fontWeight: 700,
        color: P.pencilDark,
        backgroundColor: 'rgba(245, 240, 232, 0.95)',
        padding: '0.8rem 2rem', borderRadius: '4px',
        border: `1.5px solid ${P.pencilMedium}`,
      }}>
        <span>
          Rank: <span style={{ color: P.crayonBlue }}>#{yourRank}</span>
        </span>
        <span>
          Score: <span style={{ color: P.crayonOrange }}>{yourScore}</span>
        </span>
      </div>

      {/* Top 5 leaderboard */}
      {finalLeaderboard.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.15rem',
          fontSize: '0.8rem', color: P.pencilMedium,
          minWidth: '200px',
        }}>
          {finalLeaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: '1rem',
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? P.crayonOrange : P.pencilMedium,
            }}>
              <span>#{entry.rank} {entry.name}</span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Next round info */}
      <p style={{
        fontSize: '0.85rem', color: P.pencilMedium,
        margin: 0, fontStyle: 'italic',
      }}>
        Next round starting soon...
      </p>
    </div>
  );
}
