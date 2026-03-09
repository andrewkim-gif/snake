'use client';

/**
 * MatrixLevelUp.tsx - v28 Phase 5: Level-up skill selection modal
 *
 * 레벨업 시 게임 일시정지 + 4개 카드 선택
 * 카드: 무기/스킬 이름, 설명, 현재/다음 레벨, 아이콘(이모지), 레어도 색상
 */

import { useCallback, useEffect, memo } from 'react';

// ============================================
// Props 인터페이스
// ============================================

export interface LevelUpOption {
  id: string;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string; // emoji
  type: 'weapon' | 'skill' | 'passive';
}

export interface MatrixLevelUpProps {
  options: LevelUpOption[];
  onSelect: (id: string) => void;
}

// ============================================
// 상수
// ============================================

const MATRIX_GREEN = '#00FF41';

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

const RARITY_BG: Record<string, string> = {
  common: 'rgba(170, 170, 170, 0.08)',
  uncommon: 'rgba(74, 222, 128, 0.08)',
  rare: 'rgba(96, 165, 250, 0.08)',
  epic: 'rgba(192, 132, 252, 0.08)',
  legendary: 'rgba(251, 191, 36, 0.10)',
};

const RARITY_BORDER: Record<string, string> = {
  common: 'rgba(170, 170, 170, 0.3)',
  uncommon: 'rgba(74, 222, 128, 0.4)',
  rare: 'rgba(96, 165, 250, 0.5)',
  epic: 'rgba(192, 132, 252, 0.5)',
  legendary: 'rgba(251, 191, 36, 0.6)',
};

const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

const TYPE_LABEL: Record<string, string> = {
  weapon: 'WEAPON',
  skill: 'SKILL',
  passive: 'PASSIVE',
};

// ============================================
// 컴포넌트
// ============================================

function MatrixLevelUp({ options, onSelect }: MatrixLevelUpProps) {
  // 키보드 단축키 (1-4)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        onSelect(options[idx].id);
      }
    },
    [options, onSelect],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/85"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="flex flex-col items-center gap-4 px-4 w-full max-w-2xl">
        {/* 타이틀 */}
        <div className="text-center mb-2">
          <h2
            className="text-3xl font-bold tracking-[0.2em] mb-1"
            style={{ color: MATRIX_GREEN }}
          >
            LEVEL UP
          </h2>
          <p className="text-xs text-gray-500 tracking-wider">
            SELECT AN UPGRADE
          </p>
        </div>

        {/* 카드 목록 */}
        <div className="flex flex-col gap-3 w-full">
          {options.map((opt, idx) => {
            const rarityColor = RARITY_COLORS[opt.rarity] || RARITY_COLORS.common;
            const rarityBg = RARITY_BG[opt.rarity] || RARITY_BG.common;
            const rarityBorder = RARITY_BORDER[opt.rarity] || RARITY_BORDER.common;
            const isNew = opt.currentLevel === 0;
            const isMax = opt.currentLevel + 1 >= opt.maxLevel;

            return (
              <button
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                className="relative flex items-center gap-4 p-3 transition-all duration-150
                           hover:scale-[1.02] active:scale-[0.98]
                           pointer-events-auto cursor-pointer text-left"
                style={{
                  backgroundColor: rarityBg,
                  border: `1px solid ${rarityBorder}`,
                }}
              >
                {/* 왼쪽: 아이콘 + 레벨 */}
                <div className="relative shrink-0">
                  <div
                    className="w-14 h-14 flex items-center justify-center text-2xl"
                    style={{
                      border: `2px solid ${rarityColor}`,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                    }}
                  >
                    {opt.icon}
                  </div>
                  {/* 레벨 뱃지 */}
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.9)',
                      border: `1px solid ${rarityColor}`,
                      color: rarityColor,
                    }}
                  >
                    {isNew ? 'NEW' : `Lv.${opt.currentLevel} \u2192 ${opt.currentLevel + 1}`}
                  </div>
                </div>

                {/* 중앙: 이름 + 설명 + 레어도/타입 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-sm font-bold tracking-wide truncate"
                      style={{ color: rarityColor }}
                    >
                      {opt.name}
                    </span>
                    {isMax && (
                      <span className="text-[8px] px-1 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold">
                        MAX
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-snug mb-1 line-clamp-2">
                    {opt.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[8px] font-bold tracking-widest px-1.5 py-0.5"
                      style={{
                        color: rarityColor,
                        backgroundColor: `${rarityColor}15`,
                        border: `1px solid ${rarityColor}30`,
                      }}
                    >
                      {RARITY_LABEL[opt.rarity]}
                    </span>
                    <span className="text-[8px] text-gray-600 tracking-wider">
                      {TYPE_LABEL[opt.type]}
                    </span>
                  </div>
                </div>

                {/* 오른쪽: 키보드 힌트 */}
                <div
                  className="shrink-0 w-8 h-8 flex items-center justify-center text-sm font-bold"
                  style={{
                    border: `1px solid ${MATRIX_GREEN}40`,
                    color: MATRIX_GREEN,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                  }}
                >
                  {idx + 1}
                </div>
              </button>
            );
          })}
        </div>

        {/* 하단 안내 */}
        <p className="text-[10px] text-gray-600 tracking-wider mt-1">
          Press 1-{options.length} for quick select
        </p>
      </div>
    </div>
  );
}

export default memo(MatrixLevelUp);
