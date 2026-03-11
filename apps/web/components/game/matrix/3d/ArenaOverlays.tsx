'use client';

/**
 * ArenaOverlays.tsx — Kill Feed + War Border + War Countdown (S43)
 *
 * Phase 7: Multiplayer 3D
 * 1. Kill feed: HTML overlay 기존 로직 재사용
 * 2. War border: CSS gradient border + corner marks
 * 3. War countdown: vignette + text + siren flash
 *
 * DOM overlay 기반 (R3F Canvas 위에 absolute positioned)
 * 기존 PvpEffectsManager 상태 관리 로직 데이터를 그대로 소비
 */

import React, { useRef, useEffect, useCallback } from 'react';

// ============================================
// Constants (기존 multiplayer/constants 재사용)
// ============================================

/** 킬피드 최대 표시 수 */
const KILLFEED_MAX_ENTRIES = 5;
/** 킬피드 항목 표시 시간 (ms) */
const KILLFEED_ENTRY_DURATION = 5000;
/** 킬피드 항목 높이 (px) */
const KILLFEED_ENTRY_HEIGHT = 28;
/** 킬피드 위치 (화면 우상단 오프셋) */
const KILLFEED_OFFSET_X = 10;
const KILLFEED_OFFSET_Y = 80;

/** 전쟁 테두리 두께 (px) */
const WAR_BORDER_WIDTH = 3;
/** 코너 마크 크기 (px) */
const CORNER_MARK_LENGTH = 20;

/** 폰트 */
const FONT_DISPLAY = "'Black Ops One', 'Ethnocentric', monospace";
const FONT_BODY = "'Rajdhani', sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

/** 국적 색상 */
const NATION_COLORS: Record<string, { primary: string; glow: string }> = {
  KOR: { primary: '#0047A0', glow: '#4B8BF5' },
  USA: { primary: '#B31942', glow: '#FF6B8A' },
  JPN: { primary: '#BC002D', glow: '#FF4D6A' },
  CHN: { primary: '#DE2910', glow: '#FF5533' },
  GBR: { primary: '#012169', glow: '#4169E1' },
  DEU: { primary: '#DD0000', glow: '#FF4444' },
  FRA: { primary: '#002395', glow: '#4466FF' },
  RUS: { primary: '#0039A6', glow: '#4488FF' },
  BRA: { primary: '#009739', glow: '#33CC66' },
  IND: { primary: '#FF9933', glow: '#FFBB66' },
  CAN: { primary: '#FF0000', glow: '#FF4444' },
  AUS: { primary: '#00008B', glow: '#4444FF' },
};
const DEFAULT_NATION = { primary: '#6B7280', glow: '#9CA3AF' };
function getNationColor(code: string) { return NATION_COLORS[code] ?? DEFAULT_NATION; }

// ============================================
// Types
// ============================================

/** 킬 알림 항목 */
export interface KillFeedEntry {
  killerName: string;
  targetName: string;
  killerNation: string;
  targetNation: string;
  weaponId: string;
  createdAt: number;
  score: number;
}

export interface ArenaOverlaysProps {
  /** 킬피드 항목 배열 ref */
  killFeedRef: React.MutableRefObject<KillFeedEntry[]>;
  /** 전쟁 페이즈 활성 여부 */
  warPhaseActive?: boolean;
  /** 전쟁 카운트다운 (초, 0이하면 비표시) */
  warCountdown?: number;
  /** 오버레이 표시 여부 */
  visible?: boolean;
}

// ============================================
// ArenaOverlays 컴포넌트
// ============================================

/**
 * ArenaOverlays — Kill Feed + War Border + War Countdown
 *
 * DOM overlay 기반 (R3F Canvas 위에 배치).
 * requestAnimationFrame으로 DOM 직접 업데이트 (React re-render 최소화).
 */
export function ArenaOverlays({
  killFeedRef,
  warPhaseActive = false,
  warCountdown = 0,
  visible = true,
}: ArenaOverlaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const killFeedContainerRef = useRef<HTMLDivElement>(null);
  const warBorderRef = useRef<HTMLDivElement>(null);
  const warCountdownRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>(0);

  // 애니메이션 루프
  useEffect(() => {
    if (!visible) return;

    let running = true;

    const animate = () => {
      if (!running) return;

      const now = Date.now();
      const time = now;

      // --- Kill Feed 업데이트 ---
      if (killFeedContainerRef.current) {
        const entries = killFeedRef.current;
        // 만료된 항목 필터링
        const active = entries.filter(e => now - e.createdAt < KILLFEED_ENTRY_DURATION);

        let html = '';
        for (let i = 0; i < Math.min(active.length, KILLFEED_MAX_ENTRIES); i++) {
          const entry = active[i];
          const elapsed = now - entry.createdAt;
          const progress = elapsed / KILLFEED_ENTRY_DURATION;

          // 페이드인/아웃
          let alpha = 1;
          if (progress < 0.1) alpha = progress / 0.1;
          if (progress > 0.8) alpha = (1 - progress) / 0.2;

          const slideOffset = progress < 0.05 ? (1 - progress / 0.05) * -20 : 0;

          const killerColor = getNationColor(entry.killerNation);
          const targetColor = getNationColor(entry.targetNation);

          html += `
            <div style="
              display:flex;align-items:center;gap:6px;
              padding:3px 10px;margin-bottom:2px;
              background:rgba(17,17,17,0.85);border-radius:3px;
              opacity:${Math.max(0, alpha)};
              transform:translateY(${slideOffset}px);
              border-left:2px solid ${killerColor.primary};
              transition:opacity 0.1s;
            ">
              <span style="color:${killerColor.glow};font-weight:700;font-size:10px;font-family:${FONT_BODY};">
                ${entry.killerName}
              </span>
              <span style="color:#CC9933;font-size:10px;">\u2694</span>
              <span style="color:${targetColor.glow};font-size:10px;font-family:${FONT_BODY};">
                ${entry.targetName}
              </span>
              ${entry.score > 0 ? `
                <span style="color:#CC9933;font-size:9px;font-family:${FONT_MONO};font-weight:700;margin-left:auto;">
                  +${entry.score}
                </span>
              ` : ''}
            </div>
          `;
        }
        killFeedContainerRef.current.innerHTML = html;
      }

      // --- War Border 업데이트 ---
      if (warBorderRef.current) {
        if (warPhaseActive) {
          warBorderRef.current.style.display = 'block';
          const pulse = 0.7 + 0.3 * Math.sin(time / 800);

          // 4변 그래디언트 테두리 + 코너 마크
          warBorderRef.current.style.opacity = String(pulse);
          warBorderRef.current.style.boxShadow = `
            inset 0 0 ${WAR_BORDER_WIDTH}px rgba(204, 51, 51, ${0.4 * pulse}),
            inset 0 0 ${WAR_BORDER_WIDTH * 3}px rgba(204, 51, 51, ${0.15 * pulse})
          `;
          warBorderRef.current.style.borderColor = `rgba(204, 51, 51, ${0.4 * pulse})`;
        } else {
          warBorderRef.current.style.display = 'none';
        }
      }

      // --- War Countdown 업데이트 ---
      if (warCountdownRef.current) {
        if (warCountdown > 0) {
          warCountdownRef.current.style.display = 'flex';
          const pulse = 0.8 + 0.2 * Math.sin(time / 200);
          const sirenOn = warCountdown <= 3 && Math.sin(time / 100) > 0;

          warCountdownRef.current.innerHTML = `
            <div style="
              display:flex;flex-direction:column;align-items:center;gap:8px;
              text-align:center;
            ">
              <div style="
                font-size:14px;font-family:${FONT_DISPLAY};font-weight:700;
                color:rgba(255,68,68,${0.8 * pulse});
                text-shadow:0 0 20px rgba(255,68,68,${0.4 * pulse});
                letter-spacing:2px;
              ">WAR INCOMING</div>
              <div style="
                font-size:48px;font-family:${FONT_DISPLAY};font-weight:700;
                color:#FF4444;
                text-shadow:0 0 30px rgba(255,68,68,${0.6 * pulse});
              ">${Math.ceil(warCountdown)}</div>
              ${warCountdown <= 3 ? `
                <div style="
                  font-size:12px;font-family:${FONT_BODY};font-weight:700;
                  color:rgba(255,68,68,${sirenOn ? 0.9 : 0});
                  letter-spacing:3px;
                ">[ ALERT ]</div>
              ` : ''}
            </div>
          `;

          // 비네팅 효과 (CSS radial-gradient background)
          warCountdownRef.current.style.background = `
            radial-gradient(
              ellipse at center,
              transparent 30%,
              rgba(204, 51, 51, ${0.15 * pulse}) 100%
            )
          `;
        } else {
          warCountdownRef.current.style.display = 'none';
        }
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [visible, warPhaseActive, warCountdown, killFeedRef]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Kill Feed (우상단) */}
      <div
        ref={killFeedContainerRef}
        style={{
          position: 'absolute',
          top: KILLFEED_OFFSET_Y,
          right: KILLFEED_OFFSET_X,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      />

      {/* War Border (전체 화면 테두리) */}
      <div
        ref={warBorderRef}
        style={{
          position: 'absolute',
          inset: 0,
          border: `${WAR_BORDER_WIDTH}px solid transparent`,
          display: 'none',
          pointerEvents: 'none',
        }}
      >
        {/* 코너 마크 (타겟 마크 스타일) */}
        {/* 좌상단 */}
        <div style={{
          position: 'absolute', top: 4, left: 4,
          width: CORNER_MARK_LENGTH, height: CORNER_MARK_LENGTH,
          borderTop: '2px solid rgba(204,51,51,0.6)',
          borderLeft: '2px solid rgba(204,51,51,0.6)',
        }} />
        {/* 우상단 */}
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: CORNER_MARK_LENGTH, height: CORNER_MARK_LENGTH,
          borderTop: '2px solid rgba(204,51,51,0.6)',
          borderRight: '2px solid rgba(204,51,51,0.6)',
        }} />
        {/* 좌하단 */}
        <div style={{
          position: 'absolute', bottom: 4, left: 4,
          width: CORNER_MARK_LENGTH, height: CORNER_MARK_LENGTH,
          borderBottom: '2px solid rgba(204,51,51,0.6)',
          borderLeft: '2px solid rgba(204,51,51,0.6)',
        }} />
        {/* 우하단 */}
        <div style={{
          position: 'absolute', bottom: 4, right: 4,
          width: CORNER_MARK_LENGTH, height: CORNER_MARK_LENGTH,
          borderBottom: '2px solid rgba(204,51,51,0.6)',
          borderRight: '2px solid rgba(204,51,51,0.6)',
        }} />
      </div>

      {/* War Countdown Overlay (화면 중앙 상단) */}
      <div
        ref={warCountdownRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'none',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '25vh',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default ArenaOverlays;
