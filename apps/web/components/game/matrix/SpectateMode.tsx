'use client';

/**
 * SpectateMode.tsx - v37 Phase 8: 관전 모드 오버레이
 *
 * 사망 후 살아있는 에이전트 목록에서 선택하여 관전.
 * - 좌우 화살표키로 에이전트 전환
 * - 관전 중 "SPECTATING: [에이전트명]" 표시
 * - 관전 중 보상 예측 시스템 (관전 대상이 이기면 추가 보상)
 *
 * 디자인: SK 팔레트, Chakra Petch heading, border-radius: 0
 */

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Eye, ChevronLeft, ChevronRight, Trophy, X } from 'lucide-react';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import type { PlayerClass } from '@/lib/matrix/types';

// ============================================
// Types
// ============================================

/** 관전 가능한 에이전트 정보 */
export interface SpectateTarget {
  /** 에이전트 ID */
  agentId: string;
  /** 표시명 */
  displayName: string;
  /** 플레이어 클래스 */
  playerClass: PlayerClass;
  /** 팩션 태그 */
  faction?: string;
  /** 팩션 컬러 */
  factionColor?: string;
  /** 현재 킬 수 */
  kills: number;
  /** 현재 HP 퍼센트 (0~100) */
  healthPercent: number;
  /** 현재 레벨 */
  level: number;
  /** 현재 Gold */
  gold?: number;
  /** 생존 여부 */
  isAlive: boolean;
}

export interface SpectateModeProps {
  /** 관전 모드 활성 여부 */
  isActive: boolean;
  /** 관전 가능한 에이전트 목록 (살아있는 것만) */
  targets: SpectateTarget[];
  /** 현재 관전 중인 에이전트 인덱스 */
  currentTargetIndex: number;
  /** 관전 대상 변경 콜백 */
  onTargetChange: (index: number) => void;
  /** 관전 종료 (로비 복귀) */
  onExit: () => void;
  /** 관전 대상이 승리 시 예상 보상 보너스 (%) */
  rewardBonusPercent?: number;
}

// ============================================
// CSS Keyframes (injected once)
// ============================================

const KEYFRAMES_ID = 'spectate-mode-v37-keyframes';

if (typeof window !== 'undefined' && !document.getElementById(KEYFRAMES_ID)) {
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes spectateGlow {
      0%, 100% { text-shadow: 0 0 8px rgba(59, 130, 246, 0.3); }
      50% { text-shadow: 0 0 16px rgba(59, 130, 246, 0.6); }
    }
    @keyframes spectateSlideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes spectateTargetChange {
      0% { opacity: 0.5; transform: scale(0.95); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Main Component
// ============================================

function SpectateModeInner({
  isActive,
  targets,
  currentTargetIndex,
  onTargetChange,
  onExit,
  rewardBonusPercent = 10,
}: SpectateModeProps) {
  const [targetKey, setTargetKey] = useState(0); // For re-triggering animation

  // Keyboard navigation
  useEffect(() => {
    if (!isActive || targets.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        const newIndex = (currentTargetIndex - 1 + targets.length) % targets.length;
        onTargetChange(newIndex);
        setTargetKey(prev => prev + 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        const newIndex = (currentTargetIndex + 1) % targets.length;
        onTargetChange(newIndex);
        setTargetKey(prev => prev + 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, targets.length, currentTargetIndex, onTargetChange, onExit]);

  if (!isActive || targets.length === 0) return null;

  const safeIndex = Math.min(currentTargetIndex, targets.length - 1);
  const target = targets[safeIndex];
  if (!target) return null;

  return (
    <>
      {/* Top center: SPECTATING banner */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'auto',
          animation: 'spectateSlideIn 0.3s ease-out',
        }}
      >
        {/* Left arrow */}
        <button
          onClick={() => {
            const newIndex = (currentTargetIndex - 1 + targets.length) % targets.length;
            onTargetChange(newIndex);
            setTargetKey(prev => prev + 1);
          }}
          style={{
            background: SK.glassBg,
            border: `1px solid ${SK.border}`,
            borderRadius: 0,
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={16} style={{ color: SK.textSecondary }} />
        </button>

        {/* Main banner */}
        <div
          key={targetKey}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: SK.glassBg,
            backdropFilter: 'blur(8px)',
            border: `1px solid rgba(59, 130, 246, 0.2)`,
            padding: '8px 16px',
            clipPath: apexClip.sm,
            animation: 'spectateTargetChange 0.3s ease-out',
          }}
        >
          <Eye size={14} style={{ color: '#3B82F6' }} />
          <span
            style={{
              fontFamily: headingFont,
              fontSize: 10,
              fontWeight: 700,
              color: '#3B82F6',
              letterSpacing: '0.2em',
              animation: 'spectateGlow 2s ease-in-out infinite',
            }}
          >
            SPECTATING
          </span>

          {/* Faction tag */}
          {target.faction && (
            <span
              style={{
                fontFamily: headingFont,
                fontSize: 9,
                fontWeight: 800,
                color: target.factionColor ?? SK.textMuted,
                letterSpacing: '0.06em',
                padding: '1px 4px',
                border: `1px solid ${(target.factionColor ?? SK.textMuted) + '40'}`,
                borderRadius: 0,
              }}
            >
              {target.faction}
            </span>
          )}

          {/* Agent name */}
          <span
            style={{
              fontFamily: headingFont,
              fontSize: 16,
              fontWeight: 900,
              color: SK.textPrimary,
              letterSpacing: '0.05em',
            }}
          >
            {target.displayName}
          </span>

          {/* Class */}
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 10,
              color: SK.textMuted,
            }}
          >
            {target.playerClass.toUpperCase()}
          </span>

          {/* Counter */}
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 9,
              color: SK.textMuted,
              marginLeft: 4,
            }}
          >
            {safeIndex + 1}/{targets.length}
          </span>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => {
            const newIndex = (currentTargetIndex + 1) % targets.length;
            onTargetChange(newIndex);
            setTargetKey(prev => prev + 1);
          }}
          style={{
            background: SK.glassBg,
            border: `1px solid ${SK.border}`,
            borderRadius: 0,
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronRight size={16} style={{ color: SK.textSecondary }} />
        </button>
      </div>

      {/* Bottom center: Agent stats + reward prediction */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          gap: 12,
          pointerEvents: 'auto',
          animation: 'spectateSlideIn 0.4s ease-out',
        }}
      >
        {/* Agent quick stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: SK.glassBg,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${SK.border}`,
            padding: '8px 16px',
            borderRadius: 0,
          }}
        >
          {/* Kills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontFamily: headingFont,
                fontSize: 14,
                fontWeight: 900,
                color: SK.accent,
              }}
            >
              {target.kills}
            </span>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: 9,
                color: SK.textMuted,
              }}
            >
              KILLS
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 16,
              background: SK.border,
            }}
          />

          {/* Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontFamily: headingFont,
                fontSize: 14,
                fontWeight: 900,
                color: SK.textPrimary,
              }}
            >
              LV.{target.level}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 16,
              background: SK.border,
            }}
          />

          {/* HP */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: 60,
                height: 6,
                background: SK.cardBg,
                borderRadius: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${target.healthPercent}%`,
                  background:
                    target.healthPercent > 50
                      ? SK.green
                      : target.healthPercent > 20
                      ? SK.gold
                      : SK.red,
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: 9,
                color: SK.textMuted,
              }}
            >
              {Math.round(target.healthPercent)}%
            </span>
          </div>
        </div>

        {/* Reward prediction */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `${SK.gold}10`,
            border: `1px solid ${SK.gold}20`,
            padding: '8px 12px',
            borderRadius: 0,
          }}
        >
          <Trophy size={13} style={{ color: SK.gold }} />
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 10,
              color: SK.gold,
            }}
          >
            Win bonus: +{rewardBonusPercent}% Score
          </span>
        </div>

        {/* Exit button */}
        <button
          onClick={onExit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: SK.glassBg,
            border: `1px solid ${SK.border}`,
            borderRadius: 0,
            padding: '8px 12px',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget.style.background = SK.cardBgHover);
          }}
          onMouseLeave={e => {
            (e.currentTarget.style.background = SK.glassBg);
          }}
        >
          <X size={12} style={{ color: SK.textMuted }} />
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 10,
              color: SK.textMuted,
              letterSpacing: '0.05em',
            }}
          >
            ESC
          </span>
        </button>
      </div>

      {/* Keyboard hints */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 9,
            color: SK.textMuted,
            letterSpacing: '0.05em',
          }}
        >
          [A / LEFT] Prev &nbsp;&middot;&nbsp; [D / RIGHT] Next
          &nbsp;&middot;&nbsp; [ESC] Exit
        </span>
      </div>
    </>
  );
}

const SpectateMode = memo(SpectateModeInner);
export default SpectateMode;
