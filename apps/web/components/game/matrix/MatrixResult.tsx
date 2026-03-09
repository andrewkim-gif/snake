'use client';

/**
 * MatrixResult.tsx - v28 Phase 5: Game Over / Clear result screen
 *
 * 통계: 생존 시간, 킬 수, 점수, 최고 레벨, 획득 무기 목록
 * 버튼: Retry, Exit to Lobby
 */

import { useCallback, useEffect, memo } from 'react';

// ============================================
// Props 인터페이스
// ============================================

export interface MatrixResultProps {
  survived: boolean;
  survivalTime: number;
  kills: number;
  score: number;
  level: number;
  weapons: string[];
  onRetry: () => void;
  onExitToLobby: () => void;
}

// ============================================
// 상수
// ============================================

const MATRIX_GREEN = '#00FF41';

// 무기 이름 매핑 (간략)
const WEAPON_NAMES: Record<string, string> = {
  wand: 'API Call',
  knife: 'Git Push',
  whip: 'Hand Coding',
  axe: 'Server Throw',
  bow: 'GraphQL',
  bible: 'Documentation',
  garlic: 'Debug Aura',
  pool: 'Firewall Zone',
  lightning: 'Claude Assist',
  beam: 'Stack Trace',
  laser: 'Recursive Loop',
  ping: 'Ping Packet',
  shard: 'Code Snippet',
  fork: 'Git Fork',
  punch: 'Keyboard Punch',
  sword: 'Sword',
  bridge: 'Async/Await',
  phishing: 'MCP Server',
  stablecoin: 'Type Safety',
  airdrop: 'NPM Install',
  genesis: 'System Crash',
};

// ============================================
// 유틸리티
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// 컴포넌트
// ============================================

function MatrixResult({
  survived,
  survivalTime,
  kills,
  score,
  level,
  weapons,
  onRetry,
  onExitToLobby,
}: MatrixResultProps) {
  // Enter = Retry, Escape = Exit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onRetry();
      } else if (e.key === 'Escape') {
        onExitToLobby();
      }
    },
    [onRetry, onExitToLobby],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/90"
      style={{ fontFamily: 'monospace' }}
    >
      <div
        className="flex flex-col items-center gap-6 p-8 w-full max-w-sm"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          border: `1px solid ${survived ? MATRIX_GREEN : '#ef4444'}40`,
        }}
      >
        {/* 타이틀 */}
        <div className="text-center">
          <h2
            className="text-3xl font-bold tracking-[0.2em] mb-1"
            style={{ color: survived ? MATRIX_GREEN : '#ef4444' }}
          >
            {survived ? 'SURVIVED' : 'GAME OVER'}
          </h2>
          <p className="text-xs text-gray-600 tracking-wider">
            {survived ? 'YOU HAVE ESCAPED THE MATRIX' : 'CONNECTION TERMINATED'}
          </p>
        </div>

        {/* 통계 */}
        <div className="w-full flex flex-col gap-2">
          <StatRow label="SURVIVAL TIME" value={formatTime(survivalTime)} color={MATRIX_GREEN} />
          <StatRow label="KILLS" value={kills.toString()} color="#ef4444" />
          <StatRow label="SCORE" value={score.toLocaleString()} color="#fbbf24" />
          <StatRow label="MAX LEVEL" value={`Lv.${level}`} color="#8b5cf6" />
        </div>

        {/* 획득 무기 목록 */}
        {weapons.length > 0 && (
          <div className="w-full">
            <div className="text-[9px] text-gray-600 tracking-widest mb-1.5">WEAPONS ACQUIRED</div>
            <div className="flex flex-wrap gap-1.5">
              {weapons.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="text-[9px] px-2 py-0.5 tracking-wider"
                  style={{
                    color: MATRIX_GREEN,
                    backgroundColor: 'rgba(0, 255, 65, 0.08)',
                    border: '1px solid rgba(0, 255, 65, 0.2)',
                  }}
                >
                  {WEAPON_NAMES[w] || w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div
          className="w-full h-px"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />

        {/* 버튼 */}
        <div className="flex flex-col gap-3 w-full">
          {/* Retry */}
          <button
            onClick={onRetry}
            className="w-full py-3 text-sm font-bold tracking-widest transition-all duration-150
                       hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer"
            style={{
              color: '#000',
              backgroundColor: MATRIX_GREEN,
              border: `1px solid ${MATRIX_GREEN}`,
            }}
          >
            RETRY
          </button>

          {/* Exit to Lobby */}
          <button
            onClick={onExitToLobby}
            className="w-full py-3 text-sm font-bold tracking-widest transition-all duration-150
                       hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer"
            style={{
              color: '#999',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            EXIT TO LOBBY
          </button>
        </div>

        {/* 안내 */}
        <p className="text-[10px] text-gray-600 tracking-wider">
          ENTER to retry | ESC to exit
        </p>
      </div>
    </div>
  );
}

// ============================================
// 서브 컴포넌트: 통계 행
// ============================================

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <span className="text-[10px] text-gray-500 tracking-widest">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default memo(MatrixResult);
