'use client';

/**
 * MatrixHUD.tsx - v37 Phase 5: Tactical War Room HUD 리디자인
 *
 * Layer-based 정보 계층:
 * - Layer 0 (항상 표시): HP 이중 바, XP 바, Gold 카운터 — 좌상단
 * - Layer 1 (전투 정보): 타이머, 킬 카운터 — 우상단
 * - Layer 2 (컨텍스트): 무기 슬롯 바 — 좌하단
 *
 * 신규 기능:
 * - HP 이중 바 (잔여 HP가 서서히 따라감)
 * - 20% 이하 HP 위험 비네트 (맥동 효과)
 * - Gold 카운터 (금색 코인 + Gold/분 표시 + 획득 팝 애니메이션)
 * - 무기 슬롯 리디자인 (가로 배열, 카테고리 컬러 상단 스트라이프)
 * - 페이즈 전환 배너 (전초전/교전기/결전)
 *
 * 디자인 시스템: SK 팔레트, Chakra Petch heading, Space Grotesk body, border-radius: 0
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap, Clock, Skull, Coins,
} from 'lucide-react';
import { WEAPON_DATA } from '@/lib/matrix/constants';
import type { WeaponType } from '@/lib/matrix/types';
import { SkillIconSVG } from './SkillIconSVG';
import { getSkillCategory } from '@/lib/matrix/utils/skill-icons';
import { getCategoryDisplayColor } from '@/lib/matrix/config/skills/category-display.config';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';

// ============================================
// Props
// ============================================

export interface WeaponSlot {
  type: string;
  level: number;
  cooldownPercent: number;
}

/** 매치 페이즈 */
export type MatchPhase = 'skirmish' | 'engagement' | 'showdown';

export interface MatrixHUDProps {
  health: number;
  maxHealth: number;
  xp: number;
  xpToNext: number;
  level: number;
  score: number;
  kills: number;
  gameTime: number;
  weaponSlots: WeaponSlot[];
  enemyCount: number;
  autoHuntEnabled: boolean;
  isPaused: boolean;
  /** v37: 현재 Gold 보유량 (기본 0) */
  gold?: number;
  /** v37: Gold/분 (30초 이동평균, 기본 0) */
  goldPerMin?: number;
  /** v37: 현재 매치 페이즈 */
  matchPhase?: MatchPhase;
  /** v37: 이전 프레임 HP (이중 바 계산용, 없으면 health와 동일) */
  previousHealth?: number;
}

// ============================================
// 페이즈 설정
// ============================================

const PHASE_CONFIG: Record<MatchPhase, { label: string; color: string; labelKo: string }> = {
  skirmish: { label: 'SKIRMISH', color: '#22C55E', labelKo: '전초전' },
  engagement: { label: 'ENGAGEMENT', color: '#F59E0B', labelKo: '교전기' },
  showdown: { label: 'SHOWDOWN', color: '#EF4444', labelKo: '결전' },
};

// ============================================
// Utils
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatGold(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ============================================
// Gold Pop Animation Hook
// ============================================

function useGoldPop(gold: number) {
  const [isPopping, setIsPopping] = useState(false);
  const prevGoldRef = useRef(gold);

  useEffect(() => {
    if (gold > prevGoldRef.current) {
      setIsPopping(true);
      const timer = setTimeout(() => setIsPopping(false), 400);
      prevGoldRef.current = gold;
      return () => clearTimeout(timer);
    }
    prevGoldRef.current = gold;
  }, [gold]);

  return isPopping;
}

// ============================================
// HP Trailing Bar Hook
// ============================================

function useTrailingHP(health: number, maxHealth: number) {
  const [trailingHP, setTrailingHP] = useState(health);
  const trailingRef = useRef(health);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // 즉시 health가 올라가면 trailing도 즉시 올림
    if (health >= trailingRef.current) {
      trailingRef.current = health;
      setTrailingHP(health);
      return;
    }

    // health가 떨어지면 trailing은 천천히 따라감
    const startTrail = trailingRef.current;
    const startTime = performance.now();
    const duration = 800; // ms

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const currentTrail = startTrail + (health - startTrail) * eased;
      trailingRef.current = currentTrail;
      setTrailingHP(currentTrail);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [health, maxHealth]);

  return trailingHP;
}

// ============================================
// Phase Banner Component
// ============================================

function PhaseBanner({ phase }: { phase: MatchPhase | undefined }) {
  const [visible, setVisible] = useState(false);
  const [displayPhase, setDisplayPhase] = useState<MatchPhase | undefined>(undefined);
  const prevPhaseRef = useRef<MatchPhase | undefined>(undefined);

  useEffect(() => {
    if (phase && phase !== prevPhaseRef.current && prevPhaseRef.current !== undefined) {
      setDisplayPhase(phase);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      prevPhaseRef.current = phase;
      return () => clearTimeout(timer);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  if (!visible || !displayPhase) return null;

  const config = PHASE_CONFIG[displayPhase];

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 100,
      pointerEvents: 'none',
      animation: 'phaseSlideIn 0.4s ease-out, phaseFadeOut 0.8s ease-in 2.2s forwards',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}>
        {/* Phase label top */}
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          fontFamily: bodyFont,
          color: config.color,
          letterSpacing: '0.3em',
          opacity: 0.7,
        }}>
          PHASE CHANGE
        </span>
        {/* Main phase name */}
        <span style={{
          fontSize: 48,
          fontWeight: 900,
          fontFamily: headingFont,
          color: config.color,
          letterSpacing: '0.15em',
          textShadow: `0 0 40px ${config.color}80, 0 0 80px ${config.color}40`,
          animation: 'phaseGlitch 0.1s linear 0.2s 3',
        }}>
          {config.label}
        </span>
        {/* Decorative line */}
        <div style={{
          width: 200,
          height: 2,
          background: `linear-gradient(to right, transparent, ${config.color}, transparent)`,
          marginTop: 4,
        }} />
      </div>
    </div>
  );
}

// ============================================
// Danger Vignette Component
// ============================================

function DangerVignette({ healthPercent }: { healthPercent: number }) {
  if (healthPercent > 20) return null;

  // 20% 이하 시 비네트 intensity 증가 (0~20 → 1~0)
  const intensity = Math.max(0, 1 - healthPercent / 20);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 5,
      background: `radial-gradient(ellipse at center, transparent 50%, rgba(239, 68, 68, ${0.15 + intensity * 0.25}) 100%)`,
      animation: 'vignettePulse 1.5s ease-in-out infinite',
      opacity: 0.6 + intensity * 0.4,
    }} />
  );
}

// ============================================
// CSS Keyframes (injected once)
// ============================================

const KEYFRAMES_INJECTED = typeof window !== 'undefined' ? (() => {
  const styleId = 'matrix-hud-v37-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes vignettePulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      @keyframes goldPop {
        0% { transform: scale(1); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      @keyframes phaseSlideIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      @keyframes phaseFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes phaseGlitch {
        0% { transform: translate(0, 0); }
        25% { transform: translate(-2px, 1px); }
        50% { transform: translate(2px, -1px); }
        75% { transform: translate(-1px, -1px); }
        100% { transform: translate(0, 0); }
      }
      @keyframes killPop {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  return true;
})() : false;

// Prevent unused variable warning
void KEYFRAMES_INJECTED;

// ============================================
// Main Component
// ============================================

function MatrixHUDInner({
  health,
  maxHealth,
  xp,
  xpToNext,
  level,
  score,
  kills,
  gameTime,
  weaponSlots,
  enemyCount,
  autoHuntEnabled,
  isPaused,
  gold = 0,
  goldPerMin = 0,
  matchPhase,
  previousHealth,
}: MatrixHUDProps) {
  const healthPercent = maxHealth > 0 ? Math.min(100, (health / maxHealth) * 100) : 0;
  const xpPercent = xpToNext > 0 ? Math.min(100, (xp / xpToNext) * 100) : 0;
  const isLowHP = healthPercent <= 20;
  const isLowTime = gameTime >= 210; // 3:30+  = 결전 임박

  // HP trailing bar
  const trailingHP = useTrailingHP(health, maxHealth);
  const trailingPercent = maxHealth > 0 ? Math.min(100, (trailingHP / maxHealth) * 100) : 0;

  // Gold pop animation
  const isGoldPopping = useGoldPop(gold);

  // Kill pop animation
  const [isKillPopping, setIsKillPopping] = useState(false);
  const prevKillsRef = useRef(kills);
  useEffect(() => {
    if (kills > prevKillsRef.current) {
      setIsKillPopping(true);
      const t = setTimeout(() => setIsKillPopping(false), 300);
      prevKillsRef.current = kills;
      return () => clearTimeout(t);
    }
    prevKillsRef.current = kills;
  }, [kills]);

  // Owned weapon slots only (빈 슬롯 숨김)
  const ownedSlots = weaponSlots.filter(s => s.level > 0);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 10,
      fontFamily: bodyFont,
    }}>

      {/* ═══════════════════════════════════════
          DANGER VIGNETTE (HP < 20%)
          ═══════════════════════════════════════ */}
      <DangerVignette healthPercent={healthPercent} />

      {/* ═══════════════════════════════════════
          LAYER 0: TOP-LEFT CLUSTER (HP + XP + Gold)
          ═══════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'auto',
      }}>
        {/* Row 1: Level Badge + HP Dual Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Level badge */}
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
            border: `1px solid ${isLowHP ? 'rgba(239, 68, 68, 0.4)' : SK.border}`,
            position: 'relative',
            overflow: 'hidden',
            clipPath: apexClip.sm,
          }}>
            {/* Trailing bar (잔여 HP — 빨간색이 천천히 따라감) */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: `${trailingPercent}%`,
                backgroundColor: 'rgba(239, 68, 68, 0.35)',
              }}
            />
            {/* Current HP bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                background: isLowHP
                  ? `linear-gradient(to right, #DC2626, #EF4444)`
                  : `linear-gradient(to right, ${SK.red}, ${SK.redDark})`,
                width: `${healthPercent}%`,
                transition: 'width 0.15s ease-out',
              }}
            />
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
                {Math.ceil(Math.min(health, maxHealth))}/{Math.ceil(maxHealth)}
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
              width: `${xpPercent}%`,
              transition: 'width 0.2s linear',
            }} />
          </div>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            fontFamily: bodyFont,
            color: SK.textMuted,
          }}>
            XP
          </span>
        </div>

        {/* Row 3: Gold Counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 2,
          marginTop: 2,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(4px)',
            border: `1px solid ${SK.border}`,
            paddingLeft: 8,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            clipPath: apexClip.sm,
          }}>
            <Coins size={13} style={{ color: SK.gold, flexShrink: 0 }} />
            <span style={{
              color: SK.gold,
              fontSize: 14,
              fontWeight: 900,
              fontFamily: headingFont,
              animation: isGoldPopping ? 'goldPop 0.4s ease-out' : undefined,
              display: 'inline-block',
            }}>
              {formatGold(gold)}
            </span>
            {/* Gold/min indicator */}
            {goldPerMin > 0 && (
              <span style={{
                fontSize: 9,
                color: SK.textMuted,
                fontFamily: bodyFont,
                fontWeight: 500,
                marginLeft: 2,
              }}>
                +{Math.round(goldPerMin)}/m
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          LAYER 1: TOP-RIGHT CLUSTER (Timer + Kills)
          ═══════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        pointerEvents: 'auto',
      }}>
        {/* Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: SK.glassBg,
          backdropFilter: 'blur(4px)',
          border: `1px solid ${isLowTime ? 'rgba(239, 68, 68, 0.3)' : SK.border}`,
          paddingLeft: 10,
          paddingRight: 12,
          paddingTop: 5,
          paddingBottom: 5,
          clipPath: apexClip.sm,
        }}>
          <Clock size={13} style={{ color: isLowTime ? SK.red : SK.textSecondary }} />
          <span style={{
            color: isLowTime ? SK.red : SK.textPrimary,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: headingFont,
            letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatTime(gameTime)}
          </span>
        </div>

        {/* Kills */}
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
          <Skull size={13} style={{ color: SK.accent }} />
          <span style={{
            color: SK.accent,
            fontSize: 16,
            fontWeight: 900,
            fontFamily: headingFont,
            animation: isKillPopping ? 'killPop 0.3s ease-out' : undefined,
            display: 'inline-block',
          }}>
            {kills}
          </span>
          <span style={{
            color: SK.textMuted,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: bodyFont,
            letterSpacing: '0.05em',
          }}>KILLS</span>
        </div>

        {/* Score */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingRight: 4,
        }}>
          <Zap size={11} style={{ color: SK.gold }} />
          <span style={{
            color: SK.textSecondary,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: bodyFont,
          }}>
            {score > 999 ? `${(score / 1000).toFixed(1)}K` : score}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          LAYER 2: BOTTOM-LEFT — Weapon Slot Bar (가로 배열)
          ═══════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 20,
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex',
          gap: 3,
          backgroundColor: SK.glassBg,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${SK.border}`,
          padding: 4,
          clipPath: apexClip.sm,
        }}>
          {ownedSlots.map((slot) => {
            const type = slot.type as WeaponType;
            const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
            if (!data) return null;

            const category = getSkillCategory(type);
            const catColor = category ? getCategoryDisplayColor(category) : '#666';
            const cdPercent = Math.min(100, slot.cooldownPercent * 100);
            const isEvolved = slot.level >= 11;
            const isUltimate = slot.level >= 20;

            return (
              <div key={slot.type} style={{ position: 'relative', flexShrink: 0 }}>
                {/* Category color top stripe */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: catColor,
                  zIndex: 2,
                  opacity: 0.8,
                }} />
                <div style={{
                  width: 38,
                  height: 38,
                  backgroundColor: SK.cardBg,
                  border: `1px solid ${isEvolved ? catColor + '60' : SK.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isEvolved ? `0 0 8px ${catColor}30` : 'none',
                }}>
                  <SkillIconSVG
                    type={type}
                    size={20}
                    level={slot.level}
                    cooldownPercent={slot.cooldownPercent}
                  />
                  {/* Cooldown overlay — bottom-up fill */}
                  {cdPercent > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.55)',
                        transition: 'height 0.1s linear',
                        height: `${cdPercent}%`,
                      }}
                    />
                  )}
                  {/* Level badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: 'rgba(9, 9, 11, 0.9)',
                    fontSize: 8,
                    paddingLeft: 3,
                    paddingRight: 3,
                    paddingTop: 1,
                    paddingBottom: 0,
                    color: isUltimate ? SK.gold : isEvolved ? catColor : SK.textSecondary,
                    fontFamily: headingFont,
                    fontWeight: 700,
                    borderTop: `1px solid ${SK.border}`,
                    borderLeft: `1px solid ${SK.border}`,
                    lineHeight: '12px',
                  }}>
                    {slot.level}
                  </div>
                  {/* Evolution star */}
                  {isEvolved && !isUltimate && (
                    <div style={{
                      position: 'absolute',
                      top: 1,
                      left: 1,
                      fontSize: 7,
                      lineHeight: 1,
                      color: catColor,
                    }}>
                      ★
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          BOTTOM-RIGHT: Enemy count
          ═══════════════════════════════════════ */}
      <div style={{ position: 'absolute', bottom: 8, right: 12, zIndex: 10 }}>
        <span style={{
          fontSize: 10,
          color: SK.textMuted,
          fontFamily: bodyFont,
        }}>
          Enemies: {enemyCount}
        </span>
      </div>

      {/* ═══════════════════════════════════════
          BOTTOM-CENTER: ESC Pause hint
          ═══════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        bottom: 2,
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <span style={{
          fontSize: 10,
          color: SK.textMuted,
          fontFamily: bodyFont,
          letterSpacing: '0.05em',
        }}>ESC Pause</span>
      </div>

      {/* ═══════════════════════════════════════
          PHASE TRANSITION BANNER (전초전→교전기→결전)
          ═══════════════════════════════════════ */}
      <PhaseBanner phase={matchPhase} />

      {/* ═══════════════════════════════════════
          PAUSED Overlay
          ═══════════════════════════════════════ */}
      {isPaused && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: '0.3em',
              color: SK.accent,
              fontFamily: headingFont,
              textShadow: `0 0 24px rgba(239, 68, 68, 0.6)`,
            }}
          >
            PAUSED
          </span>
        </div>
      )}
    </div>
  );
}

const MatrixHUD = memo(MatrixHUDInner);
export default MatrixHUD;
