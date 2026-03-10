'use client';

/**
 * CapturePointUI.tsx — v33 Phase 5: 캡처 포인트 상태 UI
 *
 * Canvas 위 React DOM 오버레이 (position: absolute, 좌하단)
 * - 3개 캡처 포인트: Resource (+50% XP), Buff (+25% DMG), Healing (+3 HP/s)
 * - 각 포인트의 점령 국가, 점령 진행률 프로그레스 바
 * - 내 국가 점령 시 골드 하이라이트
 *
 * 디자인: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 */

import { memo, useMemo } from 'react';
import type { CapturePointState } from '@/hooks/useMatrixSocket';

// ─── 폰트 정의 ───
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ─── 캡처 포인트 타입별 설정 ───
interface CapturePointConfig {
  label: string;
  icon: string;
  color: string;
  effect: string;
  glowColor: string;
}

const CAPTURE_CONFIGS: Record<string, CapturePointConfig> = {
  resource: {
    label: 'RESOURCE',
    icon: '\u26A1', // Lightning bolt
    color: '#FBBF24',
    effect: '+50% XP',
    glowColor: 'rgba(251,191,36,0.4)',
  },
  buff: {
    label: 'BUFF',
    icon: '\u2694', // Crossed swords
    color: '#EF4444',
    effect: '+25% DMG',
    glowColor: 'rgba(239,68,68,0.4)',
  },
  healing: {
    label: 'HEALING',
    icon: '\u2764', // Heart
    color: '#4ADE80',
    effect: '+3 HP/s',
    glowColor: 'rgba(74,222,128,0.4)',
  },
};

// ─── Props ───

export interface CapturePointUIProps {
  /** 서버에서 수신한 캡처 포인트 상태 배열 */
  captures: CapturePointState[];
  /** 플레이어 소속 국가 코드 */
  playerNation?: string;
  /** 현재 플레이어가 점령 중인 포인트 ID */
  capturingPointId?: string | null;
}

// ─── Component ───

function CapturePointUIInner({
  captures,
  playerNation,
  capturingPointId,
}: CapturePointUIProps) {
  // 캡처 포인트 리스트 정규화
  const points = useMemo(() => {
    if (!captures || captures.length === 0) {
      // 기본 3개 포인트
      return [
        { id: 'resource', owner: null, progress: 0 },
        { id: 'buff', owner: null, progress: 0 },
        { id: 'healing', owner: null, progress: 0 },
      ];
    }
    return captures;
  }, [captures]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 96,
        right: 8,
        zIndex: 40,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        width: 130,
      }}
    >
      {/* ═══ Header ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 6,
          paddingBottom: 2,
        }}
      >
        <span
          style={{
            color: '#55565E',
            fontFamily: DISPLAY_FONT,
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.2em',
          }}
        >
          CAPTURE POINTS
        </span>
      </div>

      {/* ═══ Point Cards ═══ */}
      {points.map((point) => {
        const config = CAPTURE_CONFIGS[point.id] ?? CAPTURE_CONFIGS.resource;
        const isOwned = point.owner !== null;
        const isPlayerOwned = playerNation && point.owner?.toUpperCase() === playerNation.toUpperCase();
        const isCapturing = capturingPointId === point.id;
        const progressPercent = Math.min(100, Math.max(0, point.progress * 100));

        return (
          <div
            key={point.id}
            style={{
              background: 'rgba(8,8,12,0.8)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${isPlayerOwned ? 'rgba(204,153,51,0.4)' : isOwned ? `${config.color}33` : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 0,
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
              padding: '4px 8px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isCapturing ? `0 0 12px ${config.glowColor}` : 'none',
            }}
          >
            {/* Progress bar background fill */}
            {progressPercent > 0 && progressPercent < 100 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${progressPercent}%`,
                  background: `linear-gradient(to right, ${config.color}15, ${config.color}25)`,
                  transition: 'width 0.3s ease-out',
                }}
              />
            )}

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Top row: icon + label + owner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Type icon */}
                  <span
                    style={{
                      fontSize: 10,
                      filter: isOwned ? 'none' : 'grayscale(0.7)',
                    }}
                  >
                    {config.icon}
                  </span>

                  {/* Label */}
                  <span
                    style={{
                      color: isOwned ? config.color : '#55565E',
                      fontFamily: DISPLAY_FONT,
                      fontSize: 7,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textShadow: isOwned ? `0 0 4px ${config.glowColor}` : 'none',
                    }}
                  >
                    {config.label}
                  </span>
                </div>

                {/* Owner nation badge */}
                {isOwned && (
                  <span
                    style={{
                      color: isPlayerOwned ? '#CC9933' : '#8B8D98',
                      fontFamily: BODY_FONT,
                      fontSize: 8,
                      fontWeight: 600,
                      textShadow: isPlayerOwned ? '0 0 4px rgba(204,153,51,0.3)' : 'none',
                    }}
                  >
                    {point.owner}
                  </span>
                )}
              </div>

              {/* Bottom row: effect text + progress */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    color: isOwned ? config.color : '#55565E',
                    fontFamily: BODY_FONT,
                    fontSize: 8,
                    fontWeight: 500,
                    opacity: isOwned ? 0.8 : 0.4,
                  }}
                >
                  {config.effect}
                </span>

                {/* Progress bar (visible during capture) */}
                {progressPercent > 0 && progressPercent < 100 && (
                  <div
                    style={{
                      width: 36,
                      height: 3,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        backgroundColor: config.color,
                        boxShadow: `0 0 4px ${config.glowColor}`,
                        transition: 'width 0.3s ease-out',
                      }}
                    />
                  </div>
                )}

                {/* Captured checkmark */}
                {progressPercent >= 100 && isOwned && (
                  <span
                    style={{
                      color: config.color,
                      fontSize: 8,
                      fontFamily: BODY_FONT,
                      textShadow: `0 0 4px ${config.glowColor}`,
                    }}
                  >
                    HELD
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CapturePointUI = memo(CapturePointUIInner);
export default CapturePointUI;
