'use client';

/**
 * ARSpectateOverlay — Spectator mode UI after death
 *
 * Shows:
 * - "SPECTATING" banner
 * - Target player name/level/HP
 * - Left/Right arrow controls to switch targets
 * - Death summary stats
 * - "Return to Lobby" button
 */

import { useCallback, useEffect } from 'react';
import type { ARDeathScreenData, ARPlayerNet } from '@/lib/3d/ar-types';

interface ARSpectateOverlayProps {
  deathData: ARDeathScreenData;
  targetPlayer: ARPlayerNet | null;
  onSwitchTarget: (direction: number) => void;
  onReturnToLobby: () => void;
  aliveCount: number;
}

export function ARSpectateOverlay({
  deathData,
  targetPlayer,
  onSwitchTarget,
  onReturnToLobby,
  aliveCount,
}: ARSpectateOverlayProps) {
  // Keyboard handler for left/right arrow
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onSwitchTarget(-1);
      } else if (e.key === 'ArrowRight') {
        onSwitchTarget(1);
      } else if (e.key === 'Escape') {
        onReturnToLobby();
      }
    },
    [onSwitchTarget, onReturnToLobby],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      {/* Death summary (top area) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Killed by */}
        {deathData.killerName && (
          <div style={{ fontSize: 14, color: '#F44336', fontFamily: 'monospace' }}>
            Killed by {deathData.killerName}
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'monospace',
          }}
        >
          <span>Rank #{deathData.rank}</span>
          <span>Level {deathData.finalLevel}</span>
          <span>{deathData.kills} Kills</span>
          {deathData.pvpKills > 0 && <span>{deathData.pvpKills} PvP Kills</span>}
          <span>Survived {formatTime(deathData.survivalTime)}</span>
        </div>
      </div>

      {/* Spectating banner (center) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      >
        {!deathData.canSpectate || aliveCount === 0 ? (
          <div
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#999',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: 4,
            }}
          >
            Battle Over
          </div>
        ) : null}
      </div>

      {/* Spectate controls (bottom) */}
      {deathData.canSpectate && targetPlayer && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* SPECTATING label */}
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: 3,
            }}
          >
            Spectating
          </div>

          {/* Target info + arrows */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => onSwitchTarget(-1)}
              style={{
                width: 32,
                height: 32,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {'<'}
            </button>

            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: '#fff',
                  fontFamily: 'monospace',
                }}
              >
                {targetPlayer.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'monospace',
                }}
              >
                Lv.{targetPlayer.level} | HP {Math.round(targetPlayer.hp)}/{Math.round(targetPlayer.maxHp)}
              </div>
            </div>

            <button
              onClick={() => onSwitchTarget(1)}
              style={{
                width: 32,
                height: 32,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {'>'}
            </button>
          </div>

          {/* Alive count */}
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
            }}
          >
            {aliveCount} players alive
          </div>
        </div>
      )}

      {/* Return to lobby button */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <button
          onClick={onReturnToLobby}
          style={{
            padding: '8px 24px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            fontFamily: 'monospace',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          ESC Return to Lobby
        </button>
      </div>
    </div>
  );
}
