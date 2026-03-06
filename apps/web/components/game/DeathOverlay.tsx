'use client';

/**
 * DeathOverlay — 사망 화면 UI (Crayon / Pencil Sketch 스타일)
 */

import type { DeathPayload } from '@agent-survivor/shared';

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
        backgroundColor: 'rgba(245, 240, 232, 0.94)',
        color: '#3A3028',
        gap: '1rem',
        fontFamily: '"Patrick Hand", "Inter", sans-serif',
      }}
    >
      {/* 타이틀 — 크레용 레드 + 연필 밑줄 */}
      <h2
        style={{
          fontSize: 'clamp(2rem, 6vw, 3rem)',
          margin: 0,
          color: '#C75B5B',
          fontWeight: 900,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          position: 'relative',
        }}
      >
        Oh No!
        <span style={{
          position: 'absolute',
          bottom: '-4px',
          left: '10%',
          width: '80%',
          height: '3px',
          backgroundColor: '#3A3028',
          opacity: 0.25,
          transform: 'rotate(-1deg)',
        }} />
      </h2>

      {deathInfo.killer && (
        <p style={{ margin: 0, color: '#6B5E52', fontSize: 'clamp(0.9rem, 3vw, 1.2rem)' }}>
          Eaten by{' '}
          <span style={{ color: '#D4914A', fontWeight: 800 }}>{deathInfo.killer}</span>
        </p>
      )}

      {/* 스탯 카드 — 종이 패널 + 연필 테두리 */}
      <div
        style={{
          display: 'flex',
          gap: 'clamp(0.6rem, 3vw, 1.5rem)',
          fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
          fontWeight: 700,
          color: '#3A3028',
          backgroundColor: 'rgba(245, 240, 232, 0.95)',
          padding: 'clamp(0.6rem, 2vw, 1rem) clamp(1rem, 4vw, 2rem)',
          borderRadius: '4px',
          border: '1.5px solid #6B5E52',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <span>
          Score:{' '}
          <span style={{ color: '#D4914A' }}>{deathInfo.score}</span>
        </span>
        <span>
          Kills:{' '}
          <span style={{ color: '#C75B5B' }}>{deathInfo.kills}</span>
        </span>
        <span>
          Time:{' '}
          <span style={{ color: '#5B8DAD' }}>{deathInfo.duration}s</span>
        </span>
      </div>

      {/* 버튼 — 크레용 오렌지 + 연필 아웃라인 (최소 터치 타겟 48px) */}
      <button
        onClick={onRespawn}
        style={{
          marginTop: '0.5rem',
          padding: '0.8rem 3rem',
          minHeight: '48px',
          minWidth: '48px',
          fontSize: 'clamp(1rem, 3vw, 1.3rem)',
          backgroundColor: '#D4914A',
          color: '#F5F0E8',
          border: '2px solid #3A3028',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 900,
          fontFamily: '"Patrick Hand", "Inter", sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'transform 100ms',
        }}
        onMouseDown={(e) => {
          (e.target as HTMLElement).style.transform = 'translateY(2px)';
        }}
        onMouseUp={(e) => {
          (e.target as HTMLElement).style.transform = 'translateY(0)';
        }}
        onTouchStart={(e) => {
          (e.target as HTMLElement).style.transform = 'translateY(2px)';
        }}
        onTouchEnd={(e) => {
          (e.target as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
