'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { EpochPhase } from '@agent-survivor/shared';

// --- Phase display configuration ---

interface PhaseConfig {
  labelKey: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseAnimation: boolean;
}

const PHASE_CONFIGS: Record<EpochPhase, PhaseConfig> = {
  peace: {
    labelKey: 'phasePeace',
    color: '#4A9E4A',
    bgColor: 'rgba(74, 158, 74, 0.15)',
    borderColor: '#4A9E4A',
    pulseAnimation: false,
  },
  war_countdown: {
    labelKey: 'phaseWarIncoming',
    color: '#CC9933',
    bgColor: 'rgba(204, 153, 51, 0.2)',
    borderColor: '#CC9933',
    pulseAnimation: true,
  },
  war: {
    labelKey: 'phaseWar',
    color: '#CC3333',
    bgColor: 'rgba(204, 51, 51, 0.15)',
    borderColor: '#CC3333',
    pulseAnimation: true,
  },
  shrink: {
    labelKey: 'phaseShrink',
    color: '#CC5500',
    bgColor: 'rgba(204, 85, 0, 0.15)',
    borderColor: '#CC5500',
    pulseAnimation: true,
  },
  end: {
    labelKey: 'phaseEpochEnd',
    color: '#8888AA',
    bgColor: 'rgba(136, 136, 170, 0.15)',
    borderColor: '#8888AA',
    pulseAnimation: false,
  },
  transition: {
    labelKey: 'phaseNextEpoch',
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
  // v14 Phase 4: KDA & nation score display
  kills?: number;
  deaths?: number;
  assists?: number;
  playerNationality?: string;
  playerNationScore?: number;
  arenaRadius?: number;      // current arena radius for shrink display
  maxArenaRadius?: number;   // max arena radius
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
  kills = 0,
  deaths = 0,
  assists = 0,
  playerNationality,
  playerNationScore = 0,
  arenaRadius,
  maxArenaRadius,
}: EpochHUDProps) {
  const tGame = useTranslations('game');
  const config = PHASE_CONFIGS[phase] || PHASE_CONFIGS.peace;

  // Shrink percentage for visual indicator
  const shrinkPct = (arenaRadius && maxArenaRadius && maxArenaRadius > 0)
    ? Math.round((arenaRadius / maxArenaRadius) * 100)
    : 100;

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
          {tGame(config.labelKey)}
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

      {/* KDA Counter + Nation Score (v14 Phase 4) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'rgba(17, 17, 17, 0.75)',
        padding: '3px 12px',
        borderRadius: '3px',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '0.75rem',
      }}>
        {/* KDA */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ color: '#4A9E4A', fontWeight: 700 }}>{kills}</span>
          <span style={{ color: '#555' }}>/</span>
          <span style={{ color: '#CC3333', fontWeight: 700 }}>{deaths}</span>
          <span style={{ color: '#555' }}>/</span>
          <span style={{ color: '#CC9933', fontWeight: 700 }}>{assists}</span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '12px', backgroundColor: '#333' }} />

        {/* Nation Score */}
        {playerNationality && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#8888AA', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
              {playerNationality}
            </span>
            <span style={{ color: '#CC9933', fontWeight: 700 }}>
              {playerNationScore}
            </span>
          </div>
        )}

        {/* Arena shrink indicator (during shrink phase) */}
        {(phase === 'shrink') && shrinkPct < 100 && (
          <>
            <div style={{ width: '1px', height: '12px', backgroundColor: '#333' }} />
            <span style={{ color: '#CC5500', fontWeight: 700, fontSize: '0.7rem' }}>
              {shrinkPct}%
            </span>
          </>
        )}
      </div>

      {/* Total epoch time (smaller, below KDA bar) */}
      <div style={{
        fontSize: '0.65rem',
        color: '#666',
        fontFamily: '"Rajdhani", "Inter", monospace',
        letterSpacing: '0.05em',
      }}>
        {tGame('epoch')} {formatTime(timeRemaining)}
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
  const tGame = useTranslations('game');
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
        {tGame('warBeginsIn')}
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
  const tGame = useTranslations('game');
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
        {tGame('epochComplete', { epochNumber })}
      </div>

      {/* Personal stats */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '20px',
        fontFamily: '"Rajdhani", "Inter", sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8888AA', letterSpacing: '0.1em' }}>{tGame('yourRank')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E8E0D4' }}>#{personalRank}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8888AA', letterSpacing: '0.1em' }}>{tGame('yourScore')}</div>
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
          {tGame('nationRankings')}
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
            {tGame('topPlayersLabel')}
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
        {tGame('nextEpochStarting')}
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

// --- War Vignette Effect (Phase 4: S22) ---

interface WarVignetteProps {
  active: boolean;  // true during war/shrink phases
  intensity?: number; // 0.0~1.0 (default 0.5)
}

export function WarVignetteOverlay({ active, intensity = 0.5 }: WarVignetteProps) {
  if (!active) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
      pointerEvents: 'none',
      boxShadow: `inset 0 0 120px rgba(204, 51, 51, ${intensity * 0.3}), inset 0 0 60px rgba(204, 51, 51, ${intensity * 0.15})`,
      animation: 'warVignettePulse 2s ease-in-out infinite',
    }}>
      {/* Warning text (fades in briefly) */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '0.8rem',
        color: 'rgba(204, 51, 51, 0.6)',
        letterSpacing: '0.3em',
        animation: 'warTextFade 4s ease-in-out forwards',
      }}>
        PVP ACTIVE
      </div>
      <style>{`
        @keyframes warVignettePulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes warTextFade {
          0% { opacity: 0; }
          15% { opacity: 0.8; }
          60% { opacity: 0.4; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// --- Arena Shrink Visual (Phase 4: S22) ---

interface ArenaShrinkIndicatorProps {
  currentRadius: number;
  maxRadius: number;
  visible: boolean; // true during shrink phase
}

export function ArenaShrinkIndicator({ currentRadius, maxRadius, visible }: ArenaShrinkIndicatorProps) {
  if (!visible || currentRadius >= maxRadius) return null;

  const pct = Math.round((currentRadius / maxRadius) * 100);

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 22,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      <div style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: '0.7rem',
        color: '#CC5500',
        letterSpacing: '0.1em',
        animation: 'shrinkPulse 1.5s ease-in-out infinite',
      }}>
        ARENA SHRINKING
      </div>
      {/* Progress bar */}
      <div style={{
        width: '120px',
        height: '4px',
        backgroundColor: 'rgba(204, 85, 0, 0.2)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: pct > 50 ? '#CC9933' : pct > 25 ? '#CC5500' : '#CC3333',
          borderRadius: '2px',
          transition: 'width 1s linear, background-color 1s',
        }} />
      </div>
      <div style={{
        fontSize: '0.6rem',
        color: '#888',
        fontFamily: '"Rajdhani", "Inter", monospace',
      }}>
        {Math.round(currentRadius)}px
      </div>
      <style>{`
        @keyframes shrinkPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
  const tGame = useTranslations('game');
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
          {tGame('respawned')}
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
        {tGame('respawningIn')}
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
        {tGame('levelBuildPreserved')}
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
