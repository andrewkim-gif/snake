'use client';

import { useEffect, useState } from 'react';
import type { EpochPhase } from '@agent-survivor/shared';

// --- Phase display configuration ---

interface PhaseConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseAnimation: boolean;
}

const PHASE_CONFIGS: Record<EpochPhase, PhaseConfig> = {
  peace: {
    label: 'PEACE',
    color: '#4A9E4A',
    bgColor: 'rgba(74, 158, 74, 0.15)',
    borderColor: '#4A9E4A',
    pulseAnimation: false,
  },
  war_countdown: {
    label: 'WAR INCOMING',
    color: '#CC9933',
    bgColor: 'rgba(204, 153, 51, 0.2)',
    borderColor: '#CC9933',
    pulseAnimation: true,
  },
  war: {
    label: 'WAR',
    color: '#CC3333',
    bgColor: 'rgba(204, 51, 51, 0.15)',
    borderColor: '#CC3333',
    pulseAnimation: true,
  },
  shrink: {
    label: 'SHRINK',
    color: '#CC5500',
    bgColor: 'rgba(204, 85, 0, 0.15)',
    borderColor: '#CC5500',
    pulseAnimation: true,
  },
  end: {
    label: 'EPOCH END',
    color: '#8888AA',
    bgColor: 'rgba(136, 136, 170, 0.15)',
    borderColor: '#8888AA',
    pulseAnimation: false,
  },
  transition: {
    label: 'NEXT EPOCH',
    color: '#6688BB',
    bgColor: 'rgba(102, 136, 187, 0.15)',
    borderColor: '#6688BB',
    pulseAnimation: false,
  },
};

// --- Props ---

interface EpochHUDProps {
  epochNumber: number;
  phase: EpochPhase;
  timeRemaining: number;      // seconds remaining in epoch
  phaseTimeRemaining: number;  // seconds remaining in current phase
  pvpEnabled: boolean;
  nationScores?: Record<string, number>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Component ---

export function EpochHUD({
  epochNumber,
  phase,
  timeRemaining,
  phaseTimeRemaining,
  pvpEnabled,
  nationScores,
}: EpochHUDProps) {
  const config = PHASE_CONFIGS[phase] || PHASE_CONFIGS.peace;

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 25,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      pointerEvents: 'none',
    }}>
      {/* Main epoch timer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(17, 17, 17, 0.85)',
        padding: '6px 16px',
        borderRadius: '4px',
        border: `1.5px solid ${config.borderColor}`,
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        transition: 'all 300ms',
      }}>
        {/* Epoch number */}
        <span style={{
          fontSize: '0.7rem',
          color: '#8888AA',
          letterSpacing: '0.05em',
        }}>
          E{epochNumber}
        </span>

        {/* Phase badge */}
        <div style={{
          padding: '2px 8px',
          borderRadius: '2px',
          backgroundColor: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          fontSize: '0.75rem',
          fontWeight: 700,
          color: config.color,
          letterSpacing: '0.1em',
          animation: config.pulseAnimation ? 'epochPulse 1.5s ease-in-out infinite' : 'none',
        }}>
          {config.label}
        </div>

        {/* Timer */}
        <span style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: phaseTimeRemaining <= 30 ? '#CC3333' : '#E8E0D4',
          letterSpacing: '0.05em',
          fontFamily: '"Rajdhani", "Inter", monospace',
          minWidth: '48px',
          textAlign: 'center',
        }}>
          {formatTime(phaseTimeRemaining)}
        </span>

        {/* PvP indicator */}
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: pvpEnabled ? '#CC3333' : '#4A9E4A',
          boxShadow: pvpEnabled
            ? '0 0 6px rgba(204, 51, 51, 0.6)'
            : '0 0 6px rgba(74, 158, 74, 0.4)',
          transition: 'all 300ms',
        }} title={pvpEnabled ? 'PvP ON' : 'PvP OFF'} />
      </div>

      {/* Total epoch time (smaller, below main bar) */}
      <div style={{
        fontSize: '0.65rem',
        color: '#666',
        fontFamily: '"Rajdhani", "Inter", monospace',
        letterSpacing: '0.05em',
      }}>
        EPOCH {formatTime(timeRemaining)}
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes epochPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// --- War Countdown Overlay ---

interface WarCountdownOverlayProps {
  countdown: number; // 3, 2, 1
}

export function WarCountdownOverlay({ countdown }: WarCountdownOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 900);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!visible || countdown <= 0) return null;

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
      zIndex: 50,
      pointerEvents: 'none',
      backgroundColor: 'rgba(204, 51, 51, 0.08)',
    }}>
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '1rem',
        color: '#CC3333',
        letterSpacing: '0.2em',
        marginBottom: '8px',
        textShadow: '0 0 20px rgba(204, 51, 51, 0.5)',
      }}>
        WAR BEGINS IN
      </div>
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '5rem',
        fontWeight: 900,
        color: '#CC3333',
        textShadow: '0 0 40px rgba(204, 51, 51, 0.6), 0 4px 8px rgba(0,0,0,0.3)',
        animation: 'warCountBounce 0.3s ease-out',
      }}>
        {countdown}
      </div>
      <style>{`
        @keyframes warCountBounce {
          0% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// --- Epoch Result Overlay ---

interface EpochResultOverlayProps {
  epochNumber: number;
  nationScores: Record<string, number>;
  topPlayers: Array<{
    id: string;
    name: string;
    nationality: string;
    score: number;
    kills: number;
  }>;
  personalScore: number;
  personalRank: number;
  onDismiss?: () => void;
}

export function EpochResultOverlay({
  epochNumber,
  nationScores,
  topPlayers,
  personalScore,
  personalRank,
  onDismiss,
}: EpochResultOverlayProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Sort nation scores descending
  const sortedNations = Object.entries(nationScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

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
      zIndex: 60,
      backgroundColor: 'rgba(17, 17, 17, 0.9)',
      animation: 'epochResultFadeIn 0.4s ease-out',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '1.4rem',
        color: '#CC9933',
        letterSpacing: '0.15em',
        marginBottom: '4px',
      }}>
        EPOCH {epochNumber} COMPLETE
      </div>

      {/* Personal stats */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '20px',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8888AA', letterSpacing: '0.1em' }}>YOUR RANK</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E8E0D4' }}>#{personalRank}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8888AA', letterSpacing: '0.1em' }}>YOUR SCORE</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#CC9933' }}>{personalScore}</div>
        </div>
      </div>

      {/* Nation rankings */}
      <div style={{
        marginBottom: '16px',
        width: '300px',
      }}>
        <div style={{
          fontSize: '0.75rem',
          color: '#8888AA',
          letterSpacing: '0.1em',
          marginBottom: '8px',
          fontFamily: '"Black Ops One", "Inter", sans-serif',
        }}>
          NATION RANKINGS
        </div>
        {sortedNations.map(([nation, score], idx) => (
          <div key={nation} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: idx === 0 ? 'rgba(204, 153, 51, 0.1)' : 'transparent',
            borderLeft: idx === 0 ? '3px solid #CC9933' : '3px solid transparent',
            fontFamily: '"Rajdhani", "Inter", sans-serif',
          }}>
            <span style={{ color: '#E8E0D4', fontSize: '0.9rem' }}>
              {idx + 1}. {nation}
            </span>
            <span style={{ color: '#CC9933', fontWeight: 700, fontSize: '0.9rem' }}>
              {score}
            </span>
          </div>
        ))}
      </div>

      {/* Top players */}
      {topPlayers.length > 0 && (
        <div style={{ width: '300px' }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#8888AA',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            fontFamily: '"Black Ops One", "Inter", sans-serif',
          }}>
            TOP PLAYERS
          </div>
          {topPlayers.slice(0, 3).map((player, idx) => (
            <div key={player.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '3px 8px',
              fontFamily: '"Rajdhani", "Inter", sans-serif',
              fontSize: '0.85rem',
            }}>
              <span style={{ color: '#E8E0D4' }}>
                {idx + 1}. {player.name}
                <span style={{ color: '#666', marginLeft: '4px', fontSize: '0.75rem' }}>
                  [{player.nationality}]
                </span>
              </span>
              <span style={{ color: '#CC9933' }}>{player.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Auto-dismiss timer */}
      <div style={{
        marginTop: '16px',
        fontSize: '0.65rem',
        color: '#555',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
      }}>
        Next epoch starting...
      </div>

      <style>{`
        @keyframes epochResultFadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// --- Respawn Overlay ---

interface RespawnOverlayProps {
  countdown: number;     // 3, 2, 1, 0
  isRespawning: boolean; // true when just respawned (glow effect)
}

export function RespawnOverlay({ countdown, isRespawning }: RespawnOverlayProps) {
  if (!isRespawning && countdown <= 0) return null;

  // Respawn glow effect (after respawn)
  if (isRespawning) {
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 45,
        pointerEvents: 'none',
        border: '3px solid rgba(74, 158, 74, 0.6)',
        boxShadow: 'inset 0 0 60px rgba(74, 158, 74, 0.2)',
        animation: 'respawnGlow 2s ease-out forwards',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: '"Black Ops One", "Inter", sans-serif',
          fontSize: '1rem',
          color: '#4A9E4A',
          letterSpacing: '0.2em',
          animation: 'respawnTextFade 1.5s ease-out forwards',
        }}>
          RESPAWNED
        </div>
        <style>{`
          @keyframes respawnGlow {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes respawnTextFade {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
            100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // Countdown to respawn (death screen)
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
      zIndex: 55,
      pointerEvents: 'none',
      backgroundColor: 'rgba(17, 17, 17, 0.75)',
    }}>
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '0.9rem',
        color: '#8888AA',
        letterSpacing: '0.15em',
        marginBottom: '8px',
      }}>
        RESPAWNING IN
      </div>
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '4rem',
        fontWeight: 900,
        color: '#E8E0D4',
        textShadow: '0 0 30px rgba(232, 224, 212, 0.3)',
        animation: 'respawnCountBounce 0.3s ease-out',
      }}>
        {countdown}
      </div>
      <div style={{
        marginTop: '8px',
        fontSize: '0.7rem',
        color: '#666',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
      }}>
        Level & build preserved
      </div>
      <style>{`
        @keyframes respawnCountBounce {
          0% { transform: scale(1.3); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
