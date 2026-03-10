'use client';

/**
 * DeathRecap.tsx - v37 Phase 8: 사망 원인 분석 오버레이
 *
 * 사망 시 전체 화면 오버레이:
 * - 킬러 정보: 팩션 태그, 클래스 아이콘, 에이전트명
 * - 사용한 무기 + 데미지 분석
 * - 나의 전투 통계 요약 (킬/데스/생존시간/획득Gold)
 * - "Respawn" 또는 "Spectate" 버튼
 *
 * 디자인: SK 팔레트, Chakra Petch heading, border-radius: 0
 */

import { memo, useEffect, useState } from 'react';
import { Skull, Eye, RotateCcw, Clock, Coins, Swords, Target } from 'lucide-react';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { SkillIconSVG } from './SkillIconSVG';
import { getCategoryDisplayName, getCategoryDisplayColor } from '@/lib/matrix/config/skills/category-display.config';
import { getSkillCategory } from '@/lib/matrix/utils/skill-icons';
import type { WeaponType, PlayerClass } from '@/lib/matrix/types';

// ============================================
// Types
// ============================================

/** 킬러 정보 */
export interface KillerInfo {
  /** 킬러 에이전트 ID */
  agentId: string;
  /** 표시명 */
  displayName: string;
  /** 플레이어 클래스 */
  playerClass: PlayerClass;
  /** 팩션 태그 */
  faction?: string;
  /** 팩션 컬러 */
  factionColor?: string;
  /** 사용 무기 */
  weaponType?: WeaponType;
  /** 무기 레벨 */
  weaponLevel?: number;
  /** 최종 데미지 */
  damage?: number;
  /** 크리티컬 여부 */
  wasCritical?: boolean;
}

/** 사망 시 플레이어 통계 */
export interface DeathStats {
  /** 총 킬 수 */
  kills: number;
  /** 총 데스 수 */
  deaths: number;
  /** 생존 시간 (초) */
  survivalTime: number;
  /** 획득 Gold */
  goldEarned: number;
  /** 최고 연속 킬 */
  bestCombo?: number;
  /** 가장 많이 킬한 무기 */
  topWeapon?: WeaponType;
  /** 해당 무기 킬 수 */
  topWeaponKills?: number;
}

export interface DeathRecapProps {
  /** 표시 여부 */
  isVisible: boolean;
  /** 킬러 정보 */
  killer: KillerInfo | null;
  /** 사망 시 통계 */
  stats: DeathStats;
  /** 리스폰 콜백 */
  onRespawn: () => void;
  /** 관전 모드 콜백 */
  onSpectate: () => void;
  /** 로비 복귀 콜백 */
  onExitToLobby: () => void;
}

// ============================================
// CSS Keyframes (injected once)
// ============================================

const KEYFRAMES_ID = 'death-recap-v37-keyframes';

if (typeof window !== 'undefined' && !document.getElementById(KEYFRAMES_ID)) {
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes deathRecapFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes deathRecapSlideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes deathRecapPulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
    @keyframes deathRecapGlitch {
      0% { transform: translate(0, 0); clip-path: inset(0 0 0 0); }
      20% { transform: translate(-3px, 2px); clip-path: inset(20% 0 60% 0); }
      40% { transform: translate(3px, -1px); clip-path: inset(40% 0 30% 0); }
      60% { transform: translate(-2px, -2px); clip-path: inset(60% 0 10% 0); }
      80% { transform: translate(2px, 1px); clip-path: inset(10% 0 80% 0); }
      100% { transform: translate(0, 0); clip-path: inset(0 0 0 0); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Utility
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// Sub: StatRow
// ============================================

function StatRow({
  icon: IconComp,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: `1px solid ${SK.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconComp size={14} style={{ color: SK.textMuted }} />
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 11,
            color: SK.textSecondary,
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: headingFont,
          fontSize: 13,
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

function DeathRecapInner({
  isVisible,
  killer,
  stats,
  onRespawn,
  onSpectate,
  onExitToLobby,
}: DeathRecapProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Delay content appearance for dramatic effect
      const timer = setTimeout(() => setShowContent(true), 400);
      return () => clearTimeout(timer);
    }
    setShowContent(false);
  }, [isVisible]);

  if (!isVisible) return null;

  const weaponCategory = killer?.weaponType
    ? getSkillCategory(killer.weaponType)
    : undefined;
  const categoryColor = weaponCategory
    ? getCategoryDisplayColor(weaponCategory)
    : SK.textMuted;
  const categoryName = weaponCategory
    ? getCategoryDisplayName(weaponCategory)
    : '';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        animation: 'deathRecapFadeIn 0.5s ease-out',
      }}
    >
      {/* Red vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(239, 68, 68, 0.15) 100%)',
          pointerEvents: 'none',
          animation: 'deathRecapPulse 2s ease-in-out infinite',
        }}
      />

      {/* Content panel */}
      {showContent && (
        <div
          style={{
            width: 380,
            maxWidth: '90vw',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            animation: 'deathRecapSlideUp 0.5s ease-out',
          }}
        >
          {/* Header: ELIMINATED */}
          <div
            style={{
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            <div
              style={{
                fontFamily: headingFont,
                fontSize: 12,
                fontWeight: 700,
                color: SK.red,
                letterSpacing: '0.4em',
                marginBottom: 4,
              }}
            >
              YOU HAVE BEEN
            </div>
            <div
              style={{
                fontFamily: headingFont,
                fontSize: 36,
                fontWeight: 900,
                color: SK.red,
                letterSpacing: '0.15em',
                textShadow: `0 0 30px rgba(239, 68, 68, 0.5)`,
                animation: 'deathRecapGlitch 0.15s linear 0.5s 2',
              }}
            >
              ELIMINATED
            </div>
            <div
              style={{
                width: 200,
                height: 2,
                background: `linear-gradient(to right, transparent, ${SK.red}, transparent)`,
                margin: '8px auto 0',
              }}
            />
          </div>

          {/* Killer Info Panel */}
          {killer && (
            <div
              style={{
                background: SK.cardBg,
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
                padding: '14px 16px',
                marginBottom: 2,
                position: 'relative',
              }}
            >
              {/* Left color stripe */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: categoryColor,
                }}
              />

              <div
                style={{
                  fontFamily: headingFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: SK.textMuted,
                  letterSpacing: '0.15em',
                  marginBottom: 10,
                }}
              >
                KILLED BY
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Killer weapon icon */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: `${categoryColor}15`,
                    border: `1px solid ${categoryColor}40`,
                    borderRadius: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {killer.weaponType ? (
                    <SkillIconSVG
                      type={killer.weaponType}
                      size={28}
                      level={killer.weaponLevel ?? 1}
                    />
                  ) : (
                    <Skull size={24} style={{ color: SK.red }} />
                  )}
                </div>

                {/* Killer details */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    {killer.faction && (
                      <span
                        style={{
                          fontFamily: headingFont,
                          fontSize: 9,
                          fontWeight: 800,
                          color: killer.factionColor ?? SK.textMuted,
                          letterSpacing: '0.06em',
                          padding: '1px 5px',
                          border: `1px solid ${(killer.factionColor ?? SK.textMuted) + '40'}`,
                          borderRadius: 0,
                        }}
                      >
                        {killer.faction}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: headingFont,
                        fontSize: 16,
                        fontWeight: 900,
                        color: SK.textPrimary,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {killer.displayName}
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: bodyFont,
                      fontSize: 10,
                      color: SK.textSecondary,
                    }}
                  >
                    {killer.playerClass.toUpperCase()}
                    {categoryName ? ` / ${categoryName}` : ''}
                  </div>

                  {/* Damage info */}
                  {killer.damage != null && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: headingFont,
                          fontSize: 18,
                          fontWeight: 900,
                          color: killer.wasCritical ? SK.gold : categoryColor,
                        }}
                      >
                        {killer.damage}
                      </span>
                      <span
                        style={{
                          fontFamily: bodyFont,
                          fontSize: 10,
                          color: SK.textMuted,
                        }}
                      >
                        DMG
                      </span>
                      {killer.wasCritical && (
                        <span
                          style={{
                            fontFamily: headingFont,
                            fontSize: 9,
                            fontWeight: 800,
                            color: SK.gold,
                            letterSpacing: '0.1em',
                            padding: '1px 5px',
                            background: `${SK.gold}15`,
                            border: `1px solid ${SK.gold}30`,
                          }}
                        >
                          CRITICAL
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Your Stats Panel */}
          <div
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              padding: '12px 16px',
              marginBottom: 2,
              position: 'relative',
            }}
          >
            {/* Left gold stripe */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: SK.gold,
              }}
            />

            <div
              style={{
                fontFamily: headingFont,
                fontSize: 10,
                fontWeight: 700,
                color: SK.textMuted,
                letterSpacing: '0.15em',
                marginBottom: 8,
              }}
            >
              YOUR STATS AT DEATH
            </div>

            <StatRow icon={Skull} label="Kills" value={stats.kills} color={SK.accent} />
            <StatRow icon={Clock} label="Survival Time" value={formatTime(stats.survivalTime)} color={SK.textPrimary} />
            <StatRow icon={Coins} label="Gold Earned" value={`${stats.goldEarned.toLocaleString()}G`} color={SK.gold} />
            {stats.topWeapon && (
              <StatRow
                icon={Swords}
                label={`Best Weapon`}
                value={`${stats.topWeaponKills ?? 0} kills`}
                color={SK.textPrimary}
              />
            )}
            {stats.bestCombo != null && stats.bestCombo > 1 && (
              <StatRow
                icon={Target}
                label="Best Combo"
                value={`${stats.bestCombo}x`}
                color={SK.gold}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              marginTop: 4,
            }}
          >
            {/* Respawn Button */}
            <button
              onClick={onRespawn}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                fontFamily: headingFont,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: SK.bg,
                background: SK.accent,
                border: `1px solid ${SK.accent}`,
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget.style.background = SK.accentLight);
              }}
              onMouseLeave={e => {
                (e.currentTarget.style.background = SK.accent);
              }}
            >
              <RotateCcw size={14} />
              RESPAWN
            </button>

            {/* Spectate Button */}
            <button
              onClick={onSpectate}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                fontFamily: headingFont,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: SK.textPrimary,
                background: SK.cardBg,
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget.style.background = SK.cardBgHover);
              }}
              onMouseLeave={e => {
                (e.currentTarget.style.background = SK.cardBg);
              }}
            >
              <Eye size={14} />
              SPECTATE
            </button>
          </div>

          {/* Exit hint */}
          <div
            style={{
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            <button
              onClick={onExitToLobby}
              style={{
                fontFamily: bodyFont,
                fontSize: 10,
                color: SK.textMuted,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                padding: '4px 8px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget.style.color = SK.textSecondary);
              }}
              onMouseLeave={e => {
                (e.currentTarget.style.color = SK.textMuted);
              }}
            >
              EXIT TO LOBBY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DeathRecap = memo(DeathRecapInner);
export default DeathRecap;
