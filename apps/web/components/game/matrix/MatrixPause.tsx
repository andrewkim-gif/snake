'use client';

/**
 * MatrixPause.tsx - v28 Phase 5: ESC Pause Menu
 *
 * 반투명 다크 오버레이 + 중앙 패널
 * Resume, Settings (disabled), Exit to Lobby
 *
 * v29b: All Tailwind className converted to inline styles.
 */

import { useCallback, useEffect, memo } from 'react';

// ============================================
// Props 인터페이스
// ============================================

export interface MatrixPauseProps {
  onResume: () => void;
  onExitToLobby: () => void;
}

// ============================================
// 상수
// ============================================

const MATRIX_GREEN = '#00FF41';

// ============================================
// 컴포넌트
// ============================================

function MatrixPause({ onResume, onExitToLobby }: MatrixPauseProps) {
  // ESC 키로 Resume
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onResume();
      }
    },
    [onResume],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          padding: 32,
          width: '100%',
          maxWidth: 320,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          border: `1px solid ${MATRIX_GREEN}40`,
        }}
      >
        {/* 타이틀 */}
        <h2
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            letterSpacing: '0.3em',
            color: MATRIX_GREEN,
            margin: 0,
          }}
        >
          PAUSED
        </h2>

        {/* 메뉴 버튼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {/* Resume */}
          <button
            onClick={onResume}
            style={{
              width: '100%',
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 14,
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              transition: 'all 0.15s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: '#000',
              backgroundColor: MATRIX_GREEN,
              border: `1px solid ${MATRIX_GREEN}`,
            }}
          >
            RESUME
          </button>

          {/* Settings (미구현) */}
          <button
            disabled
            style={{
              width: '100%',
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 14,
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              opacity: 0.3,
              cursor: 'not-allowed',
              color: MATRIX_GREEN,
              backgroundColor: 'transparent',
              border: `1px solid ${MATRIX_GREEN}40`,
            }}
          >
            SETTINGS
          </button>

          {/* Exit to Lobby */}
          <button
            onClick={onExitToLobby}
            style={{
              width: '100%',
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 14,
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              transition: 'all 0.15s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          >
            EXIT TO LOBBY
          </button>
        </div>

        {/* 안내 */}
        <p style={{ fontSize: 10, color: '#4b5563', letterSpacing: '0.05em', margin: 0 }}>
          Press ESC to resume
        </p>
      </div>
    </div>
  );
}

export default memo(MatrixPause);
