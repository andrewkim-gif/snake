'use client';

/**
 * MatrixHUD.tsx - v32 Phase 2: Apex Tactical HUD 리디자인
 *
 * Apex 디자인 시스템 적용:
 * - SK 토큰 (accent, glassBg, cardBg, border 등)
 * - headingFont (Chakra Petch) / bodyFont (Space Grotesk)
 * - apexClip.sm 삼각 컷 (borderRadius: 0)
 * - Apex tactical design system (SK tokens only)
 *
 * 레이아웃:
 * - 상단: XP 바 (SK.accent 그라데이션, 4px) → 레벨 배지 + HP 바 + 킬/타이머
 * - 하단: 무기 슬롯 (SK.cardBg, apexClip.sm, 쿨다운 오버레이)
 * - 좌하단: 오토헌트 버튼 (SK.green 활성)
 *
 * 기능 로직 변경 없음 — 오직 시각 스타일만 Apex 토큰으로 교체
 */

import { memo } from 'react';
import {
  Zap, Terminal, Clock,
} from 'lucide-react';
import { WEAPON_DATA } from '@/lib/matrix/constants';
import type { WeaponType } from '@/lib/matrix/types';
import { SkillIcon } from './SkillIcon';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';

// ============================================
// Props
// ============================================

export interface WeaponSlot {
  type: string;
  level: number;
  cooldownPercent: number;
}

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
}

// ============================================
// Utils
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatScore(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ============================================
// Component
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
}: MatrixHUDProps) {
  const healthPercent = maxHealth > 0 ? Math.min(100, (health / maxHealth) * 100) : 0;
  const xpPercent = xpToNext > 0 ? Math.min(100, (xp / xpToNext) * 100) : 0;

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

      {/* ========================================
          TOP SYSTEM BAR — Apex Tactical
          ======================================== */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 40,
        pointerEvents: 'auto',
      }}>

        {/* XP Bar — SK.accent 그라데이션, 4px 높이, apexClip.sm */}
        <div style={{
          width: '100%',
          height: 4,
          backgroundColor: SK.cardBg,
          position: 'relative',
          clipPath: apexClip.sm,
        }}>
          <div
            style={{
              height: '100%',
              background: `linear-gradient(to right, ${SK.accent}, ${SK.accentDark})`,
              position: 'relative',
              overflow: 'hidden',
              width: `${xpPercent}%`,
              transition: 'width 0.2s linear',
            }}
          />
        </div>

        {/* Main header: Level badge + HP bar + Kills/Timer */}
        <div style={{
          maxWidth: 1024,
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '100%',
          position: 'relative',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 12,
          paddingRight: 12,
          marginTop: 4,
        }}>
          {/* Left: Level badge + HP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {/* Level badge — SK.accent bg, headingFont, apexClip.sm */}
            <div style={{
              minWidth: 40,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: SK.accent,
              clipPath: apexClip.sm,
              flexShrink: 0,
              zIndex: 10,
              paddingLeft: 8,
              paddingRight: 10,
              gap: 4,
            }}>
              <span style={{
                color: SK.textWhite,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: headingFont,
                letterSpacing: '0.05em',
              }}>LV</span>
              <span style={{
                color: SK.textWhite,
                fontSize: 16,
                fontWeight: 900,
                fontFamily: headingFont,
              }}>{level}</span>
            </div>

            {/* HP bar — SK.red fill, SK.glassBg 트랙, 3px height, apexClip.sm */}
            <div style={{
              flex: 1,
              maxWidth: 180,
              height: 14,
              backgroundColor: SK.glassBg,
              backdropFilter: 'blur(4px)',
              border: `1px solid ${SK.border}`,
              position: 'relative',
              overflow: 'hidden',
              clipPath: apexClip.sm,
            }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  background: `linear-gradient(to right, ${SK.red}, ${SK.redDark})`,
                  transition: 'width 0.3s ease-out',
                  width: `${healthPercent}%`,
                }}
              />
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
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

          {/* Right: Kills + Timer + Score — bodyFont, SK.textSecondary */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            flexShrink: 0,
          }}>
            {/* Kills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} style={{ color: SK.accent }} />
              <span style={{
                color: SK.accent,
                fontSize: 14,
                fontWeight: 900,
                fontFamily: headingFont,
              }}>{kills}</span>
              <span style={{
                color: SK.textMuted,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: bodyFont,
                letterSpacing: '0.05em',
              }}>KILLS</span>
            </div>

            {/* Timer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} style={{ color: SK.textSecondary }} />
              <span style={{
                color: SK.textSecondary,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: headingFont,
                letterSpacing: '0.05em',
              }}>
                {formatTime(gameTime)}
              </span>
            </div>

            {/* Score */}
            <div style={{
              backgroundColor: SK.glassBg,
              backdropFilter: 'blur(4px)',
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 3,
              paddingBottom: 3,
              border: `1px solid ${SK.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              clipPath: apexClip.sm,
            }}>
              <span style={{
                color: SK.gold,
                fontSize: 11,
                fontWeight: 900,
                fontFamily: headingFont,
              }}>$</span>
              <span style={{
                color: SK.textPrimary,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: bodyFont,
              }}>{formatScore(score)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Hunt indicator (bottom left) — SK.green 활성, SK.border 비활성 */}
      <div style={{
        position: 'absolute',
        bottom: 96,
        left: 16,
        zIndex: 30,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 52,
          height: 52,
          border: `1px solid ${autoHuntEnabled ? SK.green : SK.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: autoHuntEnabled ? 'rgba(16, 185, 129, 0.15)' : SK.cardBg,
          clipPath: apexClip.sm,
          boxShadow: autoHuntEnabled ? `0 0 16px rgba(16, 185, 129, 0.4)` : 'none',
        }}>
          {autoHuntEnabled && <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />}
          <div style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}>
            <Terminal size={22} style={{
              color: autoHuntEnabled ? SK.green : SK.textMuted,
            }} />
            <div style={{
              fontSize: 8,
              lineHeight: 1,
              textAlign: 'center',
              color: autoHuntEnabled ? SK.greenLight : SK.textMuted,
              fontFamily: headingFont,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}>VIBE</div>
          </div>
        </div>
      </div>

      {/* ========================================
          Bottom: Weapon Slots — SK.cardBg, apexClip.sm, 쿨다운 SK.accent 오버레이
          ======================================== */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        zIndex: 20,
        pointerEvents: 'none',
        paddingBottom: 4,
        paddingLeft: 12,
        paddingRight: 12,
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: 80,
          maxWidth: 1280,
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          <div style={{
            pointerEvents: 'auto',
            width: 'auto',
            maxWidth: 'calc(100% - 140px)',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              backgroundColor: SK.glassBg,
              backdropFilter: 'blur(8px)',
              padding: 4,
              border: `1px solid ${SK.border}`,
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
              clipPath: apexClip.sm,
            }}>
              {weaponSlots.map((slot) => {
                const type = slot.type as WeaponType;
                const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
                if (!data || slot.level === 0) return null;

                const cdPercent = Math.min(100, slot.cooldownPercent * 100);

                return (
                  <div key={slot.type} style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      backgroundColor: SK.cardBg,
                      border: `1px solid ${SK.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      clipPath: apexClip.sm,
                    }}>
                      <SkillIcon type={type} size={16} style={{ color: data.color }} />
                      {/* Cooldown overlay — SK.accent 반투명 */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: '100%',
                          backgroundColor: 'rgba(239, 68, 68, 0.35)',
                          transition: 'height 0.1s linear',
                          height: `${cdPercent}%`,
                        }}
                      />
                      {/* Level badge */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        backgroundColor: 'rgba(9, 9, 11, 0.9)',
                        fontSize: 8,
                        paddingLeft: 2,
                        paddingRight: 3,
                        paddingTop: 1,
                        color: SK.textSecondary,
                        fontFamily: headingFont,
                        fontWeight: 700,
                        borderBottom: `1px solid ${SK.border}`,
                        borderLeft: `1px solid ${SK.border}`,
                      }}>
                        {slot.level}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        paddingBottom: 2,
      }}>
        <span style={{
          fontSize: 10,
          color: SK.textMuted,
          fontFamily: bodyFont,
          letterSpacing: '0.05em',
        }}>ESC Pause</span>
      </div>

      {/* Enemy count (bottom right) */}
      <div style={{ position: 'absolute', bottom: 8, right: 12, zIndex: 10 }}>
        <span style={{
          fontSize: 10,
          color: SK.textMuted,
          fontFamily: bodyFont,
        }}>
          Enemies: {enemyCount}
        </span>
      </div>

      {/* Paused overlay — SK.accent, headingFont */}
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
