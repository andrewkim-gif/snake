'use client';

/**
 * BROverlay.tsx — v39 Phase 6: 배틀로얄 오버레이
 *
 * 배틀로얄 페이즈 전용 HUD 오버레이:
 * - 세이프존 수축 타이머 (다음 수축까지 남은 시간)
 * - 생존 팩션 목록 (팩션명, 색상, 생존 인원, 전멸 여부)
 * - 존 밖 데미지 경고 (화면 테두리 적색 플래시)
 * - BR SubPhase 인디케이터
 *
 * Canvas 위 React DOM 오버레이 (position: absolute).
 */

import { memo, useMemo } from 'react';
import type { RoundPhase, BRSubPhase, IFactionPresence } from '@/lib/matrix/types/region';
import type { SafeZoneVisual } from '@/lib/matrix/systems/round-engine-client';

// ── 폰트 ──
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ── Props ──

export interface BROverlayProps {
  /** 현재 페이즈 */
  phase: RoundPhase;
  /** BR 서브 페이즈 */
  brSubPhase: BRSubPhase | null;
  /** 페이즈 남은 시간 (초) */
  countdown: number;
  /** 세이프존 시각화 데이터 */
  safeZone: SafeZoneVisual;
  /** 참가 팩션 목록 */
  factions: IFactionPresence[];
  /** 플레이어가 세이프존 밖에 있는지 여부 */
  isOutsideZone: boolean;
  /** 다음 세이프존 수축까지 남은 시간 (초) */
  nextShrinkIn: number;
  /** 라운드 번호 */
  roundNumber: number;
  /** 표시 여부 (BR 페이즈에서만 true) */
  visible: boolean;
}

// ── 서브 페이즈 색상 ──
const SUB_PHASE_COLORS: Record<string, string> = {
  skirmish: '#F97316',
  engagement: '#EF4444',
  final_battle: '#DC2626',
};

const SUB_PHASE_LABELS: Record<string, string> = {
  skirmish: 'SKIRMISH',
  engagement: 'ENGAGEMENT',
  final_battle: 'FINAL BATTLE',
};

// ── 컴포넌트 ──

export const BROverlay = memo(function BROverlay({
  phase,
  brSubPhase,
  countdown,
  safeZone,
  factions,
  isOutsideZone,
  nextShrinkIn,
  roundNumber,
  visible,
}: BROverlayProps) {
  if (!visible || (phase !== 'br' && phase !== 'br_countdown')) {
    return null;
  }

  // 타이머 포맷
  const timerDisplay = useMemo(() => {
    const s = Math.max(0, Math.floor(countdown));
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }, [countdown]);

  // 생존/전멸 팩션 분류
  const { aliveFactions, eliminatedFactions } = useMemo(() => {
    const alive = factions.filter(f => !f.isEliminated);
    const eliminated = factions.filter(f => f.isEliminated);
    // 내 팩션 우선 정렬
    alive.sort((a, b) => {
      if (a.isMyFaction && !b.isMyFaction) return -1;
      if (!a.isMyFaction && b.isMyFaction) return 1;
      return b.aliveCount - a.aliveCount;
    });
    return { aliveFactions: alive, eliminatedFactions: eliminated };
  }, [factions]);

  const subPhaseColor = brSubPhase ? (SUB_PHASE_COLORS[brSubPhase] ?? '#EF4444') : '#EF4444';
  const subPhaseLabel = brSubPhase ? (SUB_PHASE_LABELS[brSubPhase] ?? 'BR') : 'BR';

  return (
    <>
      {/* 존 밖 데미지 경고 — 화면 테두리 적색 플래시 */}
      {isOutsideZone && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 50,
            border: '4px solid rgba(239, 68, 68, 0.8)',
            boxShadow:
              'inset 0 0 60px rgba(239, 68, 68, 0.3), inset 0 0 120px rgba(239, 68, 68, 0.15)',
            animation: 'brZoneDamageFlash 0.8s ease-in-out infinite alternate',
          }}
        />
      )}

      {/* 존 밖 경고 텍스트 */}
      {isOutsideZone && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 51,
            fontFamily: DISPLAY_FONT,
            fontSize: 18,
            fontWeight: 700,
            color: '#EF4444',
            textShadow: '0 0 16px rgba(239,68,68,0.8), 0 0 32px rgba(239,68,68,0.4)',
            letterSpacing: '0.15em',
            animation: 'brWarningPulse 1s ease-in-out infinite',
          }}
        >
          ⚠ OUTSIDE SAFE ZONE — TAKING DAMAGE ⚠
        </div>
      )}

      {/* 세이프존 수축 타이머 (우측 상단) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {/* 수축 상태 인디케이터 */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            border: `1px solid ${safeZone.isShrinking ? '#EF4444' : safeZone.isWarning ? '#FBBF24' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 8,
            padding: '8px 14px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              fontFamily: BODY_FONT,
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.1em',
              marginBottom: 2,
            }}
          >
            {safeZone.isShrinking
              ? 'ZONE SHRINKING'
              : safeZone.isWarning
                ? 'SHRINK WARNING'
                : 'NEXT SHRINK'}
          </div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: safeZone.isShrinking ? '#EF4444' : safeZone.isWarning ? '#FBBF24' : '#FFFFFF',
              textShadow: safeZone.isShrinking
                ? '0 0 12px rgba(239,68,68,0.6)'
                : safeZone.isWarning
                  ? '0 0 12px rgba(251,191,36,0.6)'
                  : 'none',
            }}
          >
            {nextShrinkIn > 0 ? formatCountdown(nextShrinkIn) : '--'}
          </div>
          {/* 세이프존 DPS 표시 */}
          {safeZone.dps > 0 && (
            <div
              style={{
                fontFamily: BODY_FONT,
                fontSize: 10,
                color: '#EF4444',
                marginTop: 2,
              }}
            >
              Zone DMG: {safeZone.dps} HP/s
            </div>
          )}
        </div>

        {/* 세이프존 단계 표시 */}
        <div
          style={{
            display: 'flex',
            gap: 4,
          }}
        >
          {[1, 2, 3, 4].map(p => (
            <div
              key={p}
              style={{
                width: 12,
                height: 4,
                borderRadius: 2,
                background:
                  p <= safeZone.phase
                    ? '#EF4444'
                    : 'rgba(255,255,255,0.2)',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* 생존 팩션 목록 (좌측 중단) */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 16,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 280,
          overflowY: 'auto',
        }}
      >
        {/* 생존 팩션 헤더 */}
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.15em',
            marginBottom: 4,
          }}
        >
          FACTIONS ALIVE: {aliveFactions.length}
        </div>

        {/* 생존 팩션 목록 */}
        {aliveFactions.map(f => (
          <div
            key={f.factionId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: f.isMyFaction
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(0, 0, 0, 0.5)',
              border: `1px solid ${f.isMyFaction ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6,
              padding: '6px 10px',
              backdropFilter: 'blur(4px)',
              minWidth: 160,
            }}
          >
            {/* 팩션 컬러 마커 */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: f.color,
                boxShadow: `0 0 6px ${f.color}80`,
                flexShrink: 0,
              }}
            />
            {/* 팩션명 */}
            <div
              style={{
                fontFamily: BODY_FONT,
                fontSize: 12,
                fontWeight: 600,
                color: f.isMyFaction ? '#4ADE80' : '#E8E0D4',
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {f.factionName}
              {f.isMyFaction && (
                <span style={{ fontSize: 9, color: '#4ADE80', marginLeft: 4 }}>YOU</span>
              )}
            </div>
            {/* 생존 인원 */}
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 13,
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {f.aliveCount}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                /{f.memberCount}
              </span>
            </div>
          </div>
        ))}

        {/* 전멸된 팩션 */}
        {eliminatedFactions.length > 0 && (
          <>
            <div
              style={{
                fontFamily: BODY_FONT,
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.1em',
                marginTop: 6,
              }}
            >
              ELIMINATED
            </div>
            {eliminatedFactions.map(f => (
              <div
                key={f.factionId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  opacity: 0.6,
                  minWidth: 160,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: f.color,
                    opacity: 0.4,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontFamily: BODY_FONT,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.4)',
                    textDecoration: 'line-through',
                    flex: 1,
                  }}
                >
                  {f.factionName}
                </div>
                <div
                  style={{
                    fontFamily: BODY_FONT,
                    fontSize: 10,
                    color: '#EF4444',
                  }}
                >
                  WIPED
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* BR SubPhase 배지 (상단 중앙) */}
      {brSubPhase && phase === 'br' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              border: `1px solid ${subPhaseColor}60`,
              borderRadius: 8,
              padding: '6px 18px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 14,
                fontWeight: 700,
                color: subPhaseColor,
                letterSpacing: '0.2em',
                textShadow: `0 0 12px ${subPhaseColor}80`,
              }}
            >
              {subPhaseLabel}
            </div>
          </div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 28,
              fontWeight: 700,
              color: '#FFFFFF',
              textShadow: `0 0 16px ${subPhaseColor}60`,
            }}
          >
            {timerDisplay}
          </div>
        </div>
      )}

      {/* CSS 키프레임 */}
      <style>{`
        @keyframes brZoneDamageFlash {
          0% { border-color: rgba(239, 68, 68, 0.8); box-shadow: inset 0 0 60px rgba(239, 68, 68, 0.3); }
          100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: inset 0 0 30px rgba(239, 68, 68, 0.15); }
        }
        @keyframes brWarningPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
});

// ── 유틸리티 ──

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 60) {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
  return `${s}s`;
}

export default BROverlay;
