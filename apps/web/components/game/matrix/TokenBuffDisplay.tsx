'use client';

/**
 * TokenBuffDisplay.tsx — v33 Phase 5: 토큰 보유 버프 표시
 *
 * Canvas 위 React DOM 오버레이 (position: absolute, 좌측 중앙)
 * - 현재 활성화된 토큰 버프 (XP 부스트, 스탯 버프, 특수 스킬) 아이콘 표시
 * - 캡처 포인트 버프도 함께 표시
 * - 호버 시 툴팁 (pointerEvents: auto)
 *
 * 토큰 보유량 기반 버프:
 *   100+ → +10% XP
 *   1,000+ → +5% ALL STATS
 *   10,000+ → +15% XP + "Rally" 스킬
 *   100,000+ → +20% XP + +10% ALL STATS + "Inspire" 스킬
 *
 * 디자인: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 */

import { memo, useState, useCallback } from 'react';
import type { MatrixBuffPayload } from '@/hooks/useMatrixSocket';

// ─── 폰트 정의 ───
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ─── 버프 설정 ───

interface BuffConfig {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  glowColor: string;
}

/** 토큰 버프 정의 */
function getTokenBuffs(payload: MatrixBuffPayload | null): BuffConfig[] {
  if (!payload) return [];
  const buffs: BuffConfig[] = [];

  if (payload.tokenBuffs.xpBoost > 0) {
    buffs.push({
      id: 'xp-boost',
      icon: '\u2B50', // Star
      label: `+${Math.round(payload.tokenBuffs.xpBoost * 100)}% XP`,
      description: `Token holding XP boost`,
      color: '#FBBF24',
      glowColor: 'rgba(251,191,36,0.4)',
    });
  }

  if (payload.tokenBuffs.statBoost > 0) {
    buffs.push({
      id: 'stat-boost',
      icon: '\u2694', // Crossed swords
      label: `+${Math.round(payload.tokenBuffs.statBoost * 100)}% STATS`,
      description: `Token holding stat multiplier`,
      color: '#8B5CF6',
      glowColor: 'rgba(139,92,246,0.4)',
    });
  }

  for (const skill of payload.tokenBuffs.specialSkills) {
    buffs.push({
      id: `skill-${skill}`,
      icon: '\u269B', // Atom
      label: skill.toUpperCase(),
      description: `Special skill: ${skill}`,
      color: '#6366F1',
      glowColor: 'rgba(99,102,241,0.4)',
    });
  }

  // 캡처 포인트 버프
  if (payload.captureBuffs.resource) {
    buffs.push({
      id: 'capture-resource',
      icon: '\u26A1', // Lightning
      label: '+50% XP',
      description: 'Resource point captured',
      color: '#FBBF24',
      glowColor: 'rgba(251,191,36,0.3)',
    });
  }

  if (payload.captureBuffs.buff) {
    buffs.push({
      id: 'capture-buff',
      icon: '\uD83D\uDDE1', // Dagger
      label: '+25% DMG',
      description: 'Buff point captured',
      color: '#EF4444',
      glowColor: 'rgba(239,68,68,0.3)',
    });
  }

  if (payload.captureBuffs.healing) {
    buffs.push({
      id: 'capture-healing',
      icon: '\u2764', // Heart
      label: '+3 HP/s',
      description: 'Healing point captured',
      color: '#4ADE80',
      glowColor: 'rgba(74,222,128,0.3)',
    });
  }

  return buffs;
}

// ─── Props ───

export interface TokenBuffDisplayProps {
  /** matrix_buff 페이로드 */
  buffData: MatrixBuffPayload | null;
}

// ─── Component ───

function TokenBuffDisplayInner({ buffData }: TokenBuffDisplayProps) {
  const buffs = getTokenBuffs(buffData);
  const [hoveredBuff, setHoveredBuff] = useState<string | null>(null);

  const handleMouseEnter = useCallback((id: string) => setHoveredBuff(id), []);
  const handleMouseLeave = useCallback(() => setHoveredBuff(null), []);

  if (buffs.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* ═══ Header ═══ */}
      <div
        style={{
          color: '#55565E',
          fontFamily: DISPLAY_FONT,
          fontSize: 6,
          fontWeight: 700,
          letterSpacing: '0.2em',
          paddingLeft: 2,
          marginBottom: 1,
          pointerEvents: 'none',
        }}
      >
        BUFFS
      </div>

      {/* ═══ Buff Icons ═══ */}
      {buffs.map((buff) => {
        const isHovered = hoveredBuff === buff.id;

        return (
          <div
            key={buff.id}
            style={{ position: 'relative' }}
            onMouseEnter={() => handleMouseEnter(buff.id)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Buff icon card */}
            <div
              style={{
                width: 28,
                height: 28,
                background: 'rgba(8,8,12,0.8)',
                backdropFilter: 'blur(6px)',
                border: `1px solid ${buff.color}33`,
                borderRadius: 0,
                clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
                boxShadow: isHovered ? `0 0 12px ${buff.glowColor}` : 'none',
                transition: 'box-shadow 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  lineHeight: 1,
                  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
                }}
              >
                {buff.icon}
              </span>
            </div>

            {/* Tooltip */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  left: 34,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(8,8,12,0.92)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${buff.color}44`,
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 12px ${buff.glowColor}`,
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    color: buff.color,
                    fontFamily: DISPLAY_FONT,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textShadow: `0 0 4px ${buff.glowColor}`,
                  }}
                >
                  {buff.label}
                </div>
                <div
                  style={{
                    color: '#8B8D98',
                    fontFamily: BODY_FONT,
                    fontSize: 8,
                    marginTop: 1,
                  }}
                >
                  {buff.description}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TokenBuffDisplay = memo(TokenBuffDisplayInner);
export default TokenBuffDisplay;
