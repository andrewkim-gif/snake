'use client';

import { useEffect, useState, useCallback } from 'react';
import type { EpochScoreboardEntry, NationScoreSummary } from '@agent-survivor/shared';

// ============================================================
// v14 Phase 4 — S22: ScoreboardOverlay
// Tab key: full player ranking + nation scores
// Epoch end: MVP, personal stats, nation ranking
// ============================================================

// --- Tab Scoreboard (held with Tab key) ---

interface ScoreboardOverlayProps {
  visible: boolean;
  players: EpochScoreboardEntry[];
  nationScores: NationScoreSummary[];
  currentPlayerId?: string;
  epochNumber: number;
  phase: string;
}

export function ScoreboardOverlay({
  visible,
  players,
  nationScores,
  currentPlayerId,
  epochNumber,
  phase,
}: ScoreboardOverlayProps) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 70,
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex',
        gap: '24px',
        maxWidth: '900px',
        width: '90%',
      }}>
        {/* Player Rankings (left) */}
        <div style={{ flex: 2 }}>
          <div style={{
            fontFamily: '"Black Ops One", "Inter", sans-serif',
            fontSize: '0.85rem',
            color: '#CC9933',
            letterSpacing: '0.15em',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>SCOREBOARD</span>
            <span style={{ fontSize: '0.65rem', color: '#8888AA' }}>
              E{epochNumber} | {phase.toUpperCase()}
            </span>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 50px 50px 50px 50px 60px',
            gap: '4px',
            padding: '4px 8px',
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            fontSize: '0.6rem',
            color: '#666',
            letterSpacing: '0.1em',
            borderBottom: '1px solid #333',
          }}>
            <span>#</span>
            <span>NAME</span>
            <span style={{ textAlign: 'center' }}>K</span>
            <span style={{ textAlign: 'center' }}>D</span>
            <span style={{ textAlign: 'center' }}>A</span>
            <span style={{ textAlign: 'center' }}>LV</span>
            <span style={{ textAlign: 'right' }}>SCORE</span>
          </div>

          {/* Player rows */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {players.map((p) => {
              const isMe = p.id === currentPlayerId;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 50px 50px 50px 50px 60px',
                    gap: '4px',
                    padding: '3px 8px',
                    fontFamily: '"Rajdhani", "Inter", sans-serif',
                    fontSize: '0.8rem',
                    backgroundColor: isMe ? 'rgba(204, 153, 51, 0.12)' : 'transparent',
                    borderLeft: isMe ? '3px solid #CC9933' : '3px solid transparent',
                    transition: 'background-color 200ms',
                  }}
                >
                  <span style={{ color: p.rank <= 3 ? '#CC9933' : '#8888AA', fontWeight: p.rank <= 3 ? 700 : 400 }}>
                    {p.rank}
                  </span>
                  <span style={{
                    color: isMe ? '#CC9933' : '#E8E0D4',
                    fontWeight: isMe ? 700 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                    {p.nationality && (
                      <span style={{ color: '#555', fontSize: '0.65rem', marginLeft: '4px' }}>
                        [{p.nationality}]
                      </span>
                    )}
                    {p.isBot && (
                      <span style={{ color: '#555', fontSize: '0.6rem', marginLeft: '4px' }}>BOT</span>
                    )}
                  </span>
                  <span style={{ textAlign: 'center', color: '#4A9E4A' }}>{p.kills}</span>
                  <span style={{ textAlign: 'center', color: '#CC3333' }}>{p.deaths}</span>
                  <span style={{ textAlign: 'center', color: '#CC9933' }}>{p.assists}</span>
                  <span style={{ textAlign: 'center', color: '#8888AA' }}>{p.level}</span>
                  <span style={{ textAlign: 'right', color: '#E8E0D4', fontWeight: 700 }}>{p.score}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nation Scores (right) */}
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={{
            fontFamily: '"Black Ops One", "Inter", sans-serif',
            fontSize: '0.75rem',
            color: '#8888AA',
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}>
            NATIONS
          </div>

          {nationScores.map((ns, idx) => (
            <div
              key={ns.nationality}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                fontFamily: '"Rajdhani", "Inter", sans-serif',
                fontSize: '0.8rem',
                backgroundColor: idx === 0 ? 'rgba(204, 153, 51, 0.1)' : 'transparent',
                borderLeft: idx === 0 ? '3px solid #CC9933' : '3px solid transparent',
              }}
            >
              <div>
                <span style={{ color: '#E8E0D4', fontWeight: idx === 0 ? 700 : 400 }}>
                  {idx + 1}. {ns.nationality}
                </span>
                <span style={{ color: '#555', fontSize: '0.65rem', marginLeft: '4px' }}>
                  ({ns.playerCount}p)
                </span>
              </div>
              <span style={{ color: '#CC9933', fontWeight: 700 }}>{ns.totalScore}</span>
            </div>
          ))}

          {/* Hint */}
          <div style={{
            marginTop: '16px',
            fontSize: '0.6rem',
            color: '#444',
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            textAlign: 'center',
          }}>
            Hold TAB for scoreboard
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Epoch End Result Overlay (MVP + stats) ---

interface EpochEndResultProps {
  epochNumber: number;
  mvp: EpochScoreboardEntry | null;
  personalStats: {
    rank: number;
    kills: number;
    deaths: number;
    assists: number;
    level: number;
    score: number;
  };
  nationScores: NationScoreSummary[];
  onDismiss?: () => void;
}

export function EpochEndResultOverlay({
  epochNumber,
  mvp,
  personalStats,
  nationScores,
  onDismiss,
}: EpochEndResultProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 65,
      backgroundColor: 'rgba(17, 17, 17, 0.92)',
      animation: 'epochEndFadeIn 0.4s ease-out',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '1.4rem',
        color: '#CC9933',
        letterSpacing: '0.15em',
        marginBottom: '16px',
      }}>
        EPOCH {epochNumber} COMPLETE
      </div>

      {/* MVP */}
      {mvp && (
        <div style={{
          backgroundColor: 'rgba(204, 153, 51, 0.08)',
          border: '1px solid rgba(204, 153, 51, 0.3)',
          borderRadius: 0,
          padding: '8px 20px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: '"Black Ops One", "Inter", sans-serif',
            fontSize: '0.7rem',
            color: '#CC9933',
            letterSpacing: '0.2em',
            marginBottom: '4px',
          }}>
            MVP
          </div>
          <div style={{
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            fontSize: '1.2rem',
            color: '#E8E0D4',
            fontWeight: 700,
          }}>
            {mvp.name}
            {mvp.nationality && (
              <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: '6px' }}>
                [{mvp.nationality}]
              </span>
            )}
          </div>
          <div style={{
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            fontSize: '0.8rem',
            color: '#8888AA',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            marginTop: '4px',
          }}>
            <span>{mvp.kills} K</span>
            <span>{mvp.deaths} D</span>
            <span>{mvp.assists} A</span>
            <span>Lv{mvp.level}</span>
            <span style={{ color: '#CC9933' }}>{mvp.score} pts</span>
          </div>
        </div>
      )}

      {/* Personal Stats */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '16px',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
      }}>
        <StatBox label="RANK" value={`#${personalStats.rank}`} color="#E8E0D4" />
        <StatBox label="KILLS" value={String(personalStats.kills)} color="#4A9E4A" />
        <StatBox label="DEATHS" value={String(personalStats.deaths)} color="#CC3333" />
        <StatBox label="ASSISTS" value={String(personalStats.assists)} color="#CC9933" />
        <StatBox label="LEVEL" value={String(personalStats.level)} color="#8888AA" />
        <StatBox label="SCORE" value={String(personalStats.score)} color="#CC9933" />
      </div>

      {/* Top 5 Nation Rankings */}
      {nationScores.length > 0 && (
        <div style={{ width: '280px' }}>
          <div style={{
            fontFamily: '"Black Ops One", "Inter", sans-serif',
            fontSize: '0.7rem',
            color: '#8888AA',
            letterSpacing: '0.1em',
            marginBottom: '6px',
          }}>
            NATION RANKINGS
          </div>
          {nationScores.slice(0, 5).map((ns, idx) => (
            <div key={ns.nationality} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '3px 8px',
              fontFamily: '"Rajdhani", "Inter", sans-serif',
              fontSize: '0.85rem',
              backgroundColor: idx === 0 ? 'rgba(204, 153, 51, 0.1)' : 'transparent',
              borderLeft: idx === 0 ? '3px solid #CC9933' : '3px solid transparent',
            }}>
              <span style={{ color: '#E8E0D4' }}>
                {idx + 1}. {ns.nationality}
              </span>
              <span style={{ color: '#CC9933', fontWeight: 700 }}>{ns.totalScore}</span>
            </div>
          ))}
        </div>
      )}

      {/* Auto-dismiss timer */}
      <div style={{
        marginTop: '16px',
        fontSize: '0.6rem',
        color: '#444',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
      }}>
        Next epoch starting...
      </div>

      <style>{`
        @keyframes epochEndFadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// --- Stat Box helper ---

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// --- useScoreboard hook (Tab key detection) ---

export function useScoreboardToggle(): boolean {
  const [isHeld, setIsHeld] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setIsHeld(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setIsHeld(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return isHeld;
}
