'use client';

/**
 * ARSpectateOverlay — Spectator mode UI after death (Phase 4)
 *
 * Shows:
 * - "SPECTATING" banner
 * - Target player name/level/HP
 * - Left/Right arrow controls to switch targets
 * - Death summary stats
 * - "Return to Lobby" button
 *
 * 데이터 소스: arUiState (alive, kills, level, factionId) + arStateRef (alive players)
 * spectate target은 내부 state로 관리, left/right 키로 전환
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ARPlayerNet, ARState } from '@/lib/3d/ar-types';

interface ARSpectateOverlayProps {
  /** 현재 플레이어의 사망 정보 */
  kills: number;
  level: number;
  /** 관전 가능 여부 (true when dead and battle is ongoing) */
  canSpectate: boolean;
  /** AR state ref for finding alive players */
  arStateRef: React.MutableRefObject<ARState | null>;
  /** 현재 플레이어 ID */
  playerId: string | null;
  /** 관전 대상 변경 시 ARCamera에 전달할 ref */
  spectateTargetRef?: React.MutableRefObject<string | null>;
  /** 로비 복귀 콜백 */
  onReturnToLobby: () => void;
}

export function ARSpectateOverlay({
  kills,
  level,
  canSpectate,
  arStateRef,
  playerId,
  spectateTargetRef,
  onReturnToLobby,
}: ARSpectateOverlayProps) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [targetPlayer, setTargetPlayer] = useState<ARPlayerNet | null>(null);
  const alivePlayers = useRef<ARPlayerNet[]>([]);

  // 매 250ms마다 alive players 목록 갱신
  useEffect(() => {
    const interval = setInterval(() => {
      const state = arStateRef.current;
      if (!state) return;
      const alive = state.players.filter(p => p.alive && p.id !== playerId);
      alivePlayers.current = alive;

      // 현재 타겟이 유효한지 확인
      if (alive.length > 0) {
        const clampedIdx = targetIndex % alive.length;
        const target = alive[clampedIdx];
        setTargetPlayer(target);
        if (spectateTargetRef) {
          spectateTargetRef.current = target.id;
        }
      } else {
        setTargetPlayer(null);
        if (spectateTargetRef) {
          spectateTargetRef.current = null;
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [arStateRef, playerId, targetIndex, spectateTargetRef]);

  // 좌우 방향키로 관전 타겟 전환
  const switchTarget = useCallback((direction: number) => {
    const alive = alivePlayers.current;
    if (alive.length === 0) return;
    setTargetIndex(prev => {
      const next = (prev + direction + alive.length) % alive.length;
      return next;
    });
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        switchTarget(-1);
      } else if (e.key === 'ArrowRight') {
        switchTarget(1);
      } else if (e.key === 'Escape') {
        onReturnToLobby();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [switchTarget, onReturnToLobby]);

  const aliveCount = alivePlayers.current.length;

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
        {/* YOU DIED */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: '#F44336',
            fontFamily: '"Black Ops One", sans-serif',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          You Died
        </div>

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
          <span>Level {level}</span>
          <span>{kills} Kills</span>
        </div>
      </div>

      {/* Spectating banner (center — shown when no spectate targets) */}
      {(!canSpectate || aliveCount === 0) && (
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
          <div
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#999',
              fontFamily: '"Black Ops One", sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 4,
            }}
          >
            {aliveCount === 0 ? 'Battle Over' : 'Waiting...'}
          </div>
        </div>
      )}

      {/* Spectate controls (bottom) */}
      {canSpectate && targetPlayer && (
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
              onClick={() => switchTarget(-1)}
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
              onClick={() => switchTarget(1)}
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
