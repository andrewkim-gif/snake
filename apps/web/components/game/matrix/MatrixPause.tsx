'use client';

/**
 * MatrixPause.tsx - v28 Phase 5: ESC Pause Menu
 *
 * 반투명 다크 오버레이 + 중앙 패널
 * Resume, Settings (disabled), Exit to Lobby
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
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
      style={{ fontFamily: 'monospace' }}
    >
      <div
        className="flex flex-col items-center gap-6 p-8 w-full max-w-xs"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          border: `1px solid ${MATRIX_GREEN}40`,
        }}
      >
        {/* 타이틀 */}
        <h2
          className="text-2xl font-bold tracking-[0.3em]"
          style={{ color: MATRIX_GREEN }}
        >
          PAUSED
        </h2>

        {/* 메뉴 버튼 */}
        <div className="flex flex-col gap-3 w-full">
          {/* Resume */}
          <button
            onClick={onResume}
            className="w-full py-3 text-sm font-bold tracking-widest transition-all duration-150
                       hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer"
            style={{
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
            className="w-full py-3 text-sm font-bold tracking-widest opacity-30 cursor-not-allowed"
            style={{
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
            className="w-full py-3 text-sm font-bold tracking-widest transition-all duration-150
                       hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer"
            style={{
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          >
            EXIT TO LOBBY
          </button>
        </div>

        {/* 안내 */}
        <p className="text-[10px] text-gray-600 tracking-wider">
          Press ESC to resume
        </p>
      </div>
    </div>
  );
}

export default memo(MatrixPause);
