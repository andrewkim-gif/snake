'use client';

/**
 * GameHUD3D.tsx — 3D 모드용 경량 HUD 오버레이
 *
 * MatrixScene의 matrix-scene-hud-overlay div 안에 렌더링되는 DOM 오버레이.
 * playerRef에서 직접 값을 읽어 HP/XP/레벨/점수/킬을 표시한다.
 *
 * 기존 MatrixHUD.tsx(824줄)의 핵심만 추출한 경량 버전.
 * SK 팔레트 + Apex 스타일 적용.
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import type { Player } from '@/lib/matrix/types';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';

// ============================================
// Props
// ============================================

export interface GameHUD3DProps {
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
  /** 적 수 (선택) */
  enemyCount?: number;
  /** 게임 시간 (초) */
  gameTime?: number;
}

// ============================================
// HP Trailing Bar Hook
// ============================================

function useTrailingHP(health: number) {
  const [trailing, setTrailing] = useState(health);
  const trailingRef = useRef(health);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (health >= trailingRef.current) {
      trailingRef.current = health;
      setTrailing(health);
      return;
    }

    const startTrail = trailingRef.current;
    const startTime = performance.now();
    const duration = 600;

    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = startTrail + (health - startTrail) * eased;
      trailingRef.current = val;
      setTrailing(val);
      if (t < 1) animRef.current = requestAnimationFrame(animate);
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [health]);

  return trailing;
}

// ============================================
// Kill Pop Hook
// ============================================

function usePopAnimation(value: number) {
  const [popping, setPopping] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value > prevRef.current) {
      setPopping(true);
      const t = setTimeout(() => setPopping(false), 300);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  return popping;
}

// ============================================
// Danger Vignette
// ============================================

function DangerVignette({ healthPct }: { healthPct: number }) {
  if (healthPct > 20) return null;
  const intensity = Math.max(0, 1 - healthPct / 20);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 5,
      background: `radial-gradient(ellipse at center, transparent 50%, rgba(239,68,68,${0.15 + intensity * 0.25}) 100%)`,
      animation: 'hud3d-vignette 1.5s ease-in-out infinite',
      opacity: 0.6 + intensity * 0.4,
    }} />
  );
}

// ============================================
// CSS Keyframes (inject once)
// ============================================

const _KEYFRAMES_INJECTED = typeof window !== 'undefined' ? (() => {
  const id = 'game-hud-3d-keyframes';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes hud3d-vignette {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      @keyframes hud3d-pop {
        0% { transform: scale(1); }
        50% { transform: scale(1.25); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(s);
  }
  return true;
})() : false;

// prevent unused warning
void _KEYFRAMES_INJECTED;

// ============================================
// 시간 포맷
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// Main Component
// ============================================

function GameHUD3DInner({ playerRef, enemyCount, gameTime }: GameHUD3DProps) {
  // 60fps로 playerRef 값을 읽어 state 동기화 (throttle: ~100ms)
  const [hp, setHp] = useState(0);
  const [maxHp, setMaxHp] = useState(100);
  const [xp, setXp] = useState(0);
  const [xpToNext, setXpToNext] = useState(100);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const animRef = useRef<number>(0);

  // playerRef에서 주기적으로 값 읽기 (~6fps, 성능 최적화)
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      const p = playerRef.current;
      setHp(p.health);
      setMaxHp(p.maxHealth);
      setXp(p.xp);
      setXpToNext(p.nextLevelXp ?? 100);
      setLevel(p.level);
      setScore(p.score);
      // kills는 Player 타입에 없으므로 score 기반 추정 또는 별도 ref
      // 현재 구현: score를 kills로 표시하지 않고 score만 사용
      setKills((p as any).kills ?? 0);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [playerRef]);

  const healthPct = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0;
  const xpPct = xpToNext > 0 ? Math.min(100, (xp / xpToNext) * 100) : 0;
  const isLowHP = healthPct <= 20;

  // trailing HP
  const trailingHP = useTrailingHP(hp);
  const trailingPct = maxHp > 0 ? Math.min(100, (trailingHP / maxHp) * 100) : 0;

  // kill pop
  const isKillPop = usePopAnimation(kills);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      userSelect: 'none',
      fontFamily: bodyFont,
    }}>
      {/* 위험 비네트 */}
      <DangerVignette healthPct={healthPct} />

      {/* ═══ 좌상단: Level + HP + XP ═══ */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {/* Row 1: Level Badge + HP Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Level Badge */}
          <div style={{
            minWidth: 38,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: SK.accent,
            clipPath: apexClip.sm,
            flexShrink: 0,
            paddingLeft: 6,
            paddingRight: 8,
            gap: 3,
          }}>
            <span style={{
              color: SK.textWhite,
              fontSize: 9,
              fontWeight: 700,
              fontFamily: headingFont,
              letterSpacing: '0.05em',
            }}>LV</span>
            <span style={{
              color: SK.textWhite,
              fontSize: 15,
              fontWeight: 900,
              fontFamily: headingFont,
            }}>{level}</span>
          </div>

          {/* HP Dual Bar */}
          <div style={{
            width: 180,
            height: 14,
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(4px)',
            border: `1px solid ${isLowHP ? 'rgba(239,68,68,0.4)' : SK.border}`,
            position: 'relative',
            overflow: 'hidden',
            clipPath: apexClip.sm,
          }}>
            {/* Trailing bar (잔여 HP) */}
            <div style={{
              position: 'absolute',
              top: 0, bottom: 0, left: 0,
              width: `${trailingPct}%`,
              backgroundColor: 'rgba(239,68,68,0.35)',
            }} />
            {/* Current HP */}
            <div style={{
              position: 'absolute',
              top: 0, bottom: 0, left: 0,
              background: isLowHP
                ? 'linear-gradient(to right, #DC2626, #EF4444)'
                : `linear-gradient(to right, ${SK.red}, ${SK.redDark})`,
              width: `${healthPct}%`,
              transition: 'width 0.15s ease-out',
            }} />
            {/* HP text */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                color: SK.textWhite,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: bodyFont,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}>
                {Math.ceil(Math.min(hp, maxHp))}/{Math.ceil(maxHp)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: XP Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 44 }}>
          <div style={{
            width: 140,
            height: 4,
            backgroundColor: SK.cardBg,
            position: 'relative',
            overflow: 'hidden',
            clipPath: apexClip.sm,
          }}>
            <div style={{
              height: '100%',
              background: `linear-gradient(to right, ${SK.accent}, ${SK.accentDark})`,
              width: `${xpPct}%`,
              transition: 'width 0.2s linear',
            }} />
          </div>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            fontFamily: bodyFont,
            color: SK.textMuted,
          }}>XP</span>
        </div>
      </div>

      {/* ═══ 우상단: Timer + Score + Kills ═══ */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}>
        {/* Timer (게임 시간이 있을 때만) */}
        {gameTime != null && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(4px)',
            border: `1px solid ${SK.border}`,
            paddingLeft: 10,
            paddingRight: 12,
            paddingTop: 5,
            paddingBottom: 5,
            clipPath: apexClip.sm,
          }}>
            <span style={{
              color: SK.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: headingFont,
            }}>T</span>
            <span style={{
              color: SK.textPrimary,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: headingFont,
              letterSpacing: '0.08em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTime(gameTime)}
            </span>
          </div>
        )}

        {/* Score */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          backgroundColor: SK.glassBg,
          backdropFilter: 'blur(4px)',
          border: `1px solid ${SK.border}`,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4,
          clipPath: apexClip.sm,
        }}>
          <span style={{
            color: SK.gold,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: headingFont,
          }}>SC</span>
          <span style={{
            color: SK.gold,
            fontSize: 16,
            fontWeight: 900,
            fontFamily: headingFont,
          }}>
            {score > 999 ? `${(score / 1000).toFixed(1)}K` : score}
          </span>
        </div>

        {/* Kills (값이 있을 때만) */}
        {kills > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(4px)',
            border: `1px solid ${SK.border}`,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            clipPath: apexClip.sm,
          }}>
            <span style={{
              color: SK.accent,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: headingFont,
            }}>K</span>
            <span style={{
              color: SK.accent,
              fontSize: 16,
              fontWeight: 900,
              fontFamily: headingFont,
              animation: isKillPop ? 'hud3d-pop 0.3s ease-out' : undefined,
              display: 'inline-block',
            }}>
              {kills}
            </span>
          </div>
        )}

        {/* Enemy Count */}
        {enemyCount != null && (
          <span style={{
            fontSize: 10,
            color: SK.textMuted,
            fontFamily: bodyFont,
            paddingRight: 4,
          }}>
            Enemies: {enemyCount}
          </span>
        )}
      </div>
    </div>
  );
}

const GameHUD3D = memo(GameHUD3DInner);
export { GameHUD3D };
export default GameHUD3D;
