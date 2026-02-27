'use client';

/**
 * DeathOverlay — 사망 화면 UI (Brawl Stars 스타일 Bold Cartoon)
 */

import type { DeathPayload } from '@snake-arena/shared';

interface DeathOverlayProps {
  deathInfo: DeathPayload;
  onRespawn: () => void;
}

export function DeathOverlay({ deathInfo, onRespawn }: DeathOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        color: '#FFFFFF',
        gap: '1rem',
      }}
    >
      {/* 타이틀 — 두꺼운 텍스트 */}
      <h2
        style={{
          fontSize: '3rem',
          margin: 0,
          color: '#FF3B3B',
          fontWeight: 900,
          letterSpacing: '0.05em',
          textShadow: '0 0 20px rgba(255,59,59,0.5), 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
          textTransform: 'uppercase',
        }}
      >
        YOU DIED!
      </h2>

      {deathInfo.killer && (
        <p style={{ margin: 0, color: '#B0BEC5', fontSize: '1.2rem', textShadow: '2px 2px 0 #000' }}>
          Killed by{' '}
          <span style={{ color: '#FF6B00', fontWeight: 800 }}>{deathInfo.killer}</span>
        </p>
      )}

      {/* 스탯 카드 — 카툰 스타일 */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          fontSize: '1rem',
          fontWeight: 700,
          color: '#FFFFFF',
          backgroundColor: 'rgba(25, 20, 60, 0.9)',
          padding: '1rem 2rem',
          borderRadius: '14px',
          border: '3px solid #000',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          textShadow: '2px 2px 0 #000',
        }}
      >
        <span>
          Score:{' '}
          <span style={{ color: '#FFD700' }}>{deathInfo.score}</span>
        </span>
        <span>
          Kills:{' '}
          <span style={{ color: '#FF3B3B' }}>{deathInfo.kills}</span>
        </span>
        <span>
          Time:{' '}
          <span style={{ color: '#00D4FF' }}>{deathInfo.duration}s</span>
        </span>
      </div>

      {/* 버튼 — Brawl Stars 3D 카툰 버튼 */}
      <button
        onClick={onRespawn}
        style={{
          marginTop: '0.5rem',
          padding: '0.8rem 3rem',
          fontSize: '1.2rem',
          backgroundColor: '#39FF14',
          color: '#000000',
          border: '3px solid #000',
          borderRadius: '16px',
          cursor: 'pointer',
          fontWeight: 900,
          fontFamily: 'inherit',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          boxShadow: '0 6px 0 #1A8A0A, 0 8px 8px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.3)',
          transition: 'transform 100ms, box-shadow 100ms',
          textShadow: 'none',
        }}
        onMouseDown={(e) => {
          (e.target as HTMLElement).style.transform = 'translateY(3px)';
          (e.target as HTMLElement).style.boxShadow = '0 3px 0 #1A8A0A, 0 4px 4px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.3)';
        }}
        onMouseUp={(e) => {
          (e.target as HTMLElement).style.transform = 'translateY(0)';
          (e.target as HTMLElement).style.boxShadow = '0 6px 0 #1A8A0A, 0 8px 8px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.3)';
        }}
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
