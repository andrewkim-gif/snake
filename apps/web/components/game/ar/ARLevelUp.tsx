'use client';

/**
 * ARLevelUp — 레벨업 시 Tome 3카드 선택 팝업
 *
 * 레벨업 발생 시 전체 화면 위에 표시:
 * - 3개 Tome 카드 (희귀도별 테두리 색상)
 * - 각 카드: 아이콘 + 이름 + 효과 설명 + 희귀도 뱃지
 * - 클릭으로 선택 → 서버에 ar_choose 전송
 * - 게임이 일시정지되지 않음 (투명 배경으로 시야 유지)
 */

import { useCallback, memo } from 'react';
import type { ARTomeOffer } from '@/lib/3d/ar-types';
import { TOME_INFO, RARITY_COLORS, RARITY_BG_COLORS } from '@/lib/3d/ar-types';

interface ARLevelUpProps {
  level: number;
  choices: ARTomeOffer[];
  onChoose: (tomeId: string) => void;
}

function ARLevelUpInner({ level, choices, onChoose }: ARLevelUpProps) {
  const handleSelect = useCallback(
    (tomeId: string) => {
      onChoose(tomeId);
    },
    [onChoose]
  );

  if (!choices || choices.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 100,
        pointerEvents: 'auto',
      }}
    >
      {/* 레벨업 타이틀 */}
      <div
        style={{
          fontFamily: '"Black Ops One", monospace',
          fontSize: 28,
          color: '#FFD700',
          marginBottom: 8,
          textShadow: '0 2px 8px rgba(255, 215, 0, 0.5)',
          letterSpacing: 2,
        }}
      >
        LEVEL UP!
      </div>
      <div
        style={{
          fontSize: 16,
          color: '#E8E0D4',
          marginBottom: 24,
          fontFamily: '"Rajdhani", sans-serif',
        }}
      >
        Level {level} — Choose a Tome
      </div>

      {/* 3카드 */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          maxWidth: '90vw',
        }}
      >
        {choices.map((offer) => {
          const info = TOME_INFO[offer.tomeId];
          const borderColor = RARITY_COLORS[offer.rarity];
          const bgColor = RARITY_BG_COLORS[offer.rarity];

          return (
            <button
              key={offer.tomeId}
              onClick={() => handleSelect(offer.tomeId)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 16px',
                width: 180,
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                backgroundColor: bgColor,
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                color: '#E8E0D4',
                fontFamily: '"Rajdhani", sans-serif',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${borderColor}66`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {/* 아이콘 */}
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                {info?.icon || '?'}
              </div>

              {/* 이름 */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: borderColor,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {info?.name || offer.tomeId}
              </div>

              {/* 희귀도 뱃지 */}
              <div
                style={{
                  fontSize: 11,
                  color: borderColor,
                  border: `1px solid ${borderColor}44`,
                  borderRadius: 4,
                  padding: '1px 8px',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {offer.rarity}
              </div>

              {/* 효과 설명 */}
              <div
                style={{
                  fontSize: 13,
                  color: '#BBBBBB',
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                {info?.desc || 'Unknown effect'}
              </div>

              {/* 태그 */}
              <div
                style={{
                  fontSize: 10,
                  color: '#888888',
                  marginTop: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}
              >
                {info?.tag || ''}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const ARLevelUp = memo(ARLevelUpInner);
