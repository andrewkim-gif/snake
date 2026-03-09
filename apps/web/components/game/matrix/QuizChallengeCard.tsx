'use client';

/**
 * QuizChallengeCard.tsx - v32 Phase 1: Mission Challenge Card (Apex Tactical Style)
 *
 * Apex Design System:
 * - SK.glassBg + backdrop-filter for card background
 * - headingFont (Chakra Petch) for titles
 * - bodyFont (Space Grotesk) for labels/body
 * - SK.gold for mission theme, SK.accent for warnings
 * - borderRadius: 0 (sharp tactical edges)
 * - Apex tactical design system (SK tokens only)
 *
 * States: active, success, failed/expired
 */

import React, { useMemo } from 'react';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { QUIZ_CONFIG } from '@/lib/matrix/config/quiz.config';
import type { QuizChallenge } from '@/lib/matrix/types';

// ─── Props ───

interface QuizChallengeCardProps {
  challenge: QuizChallenge | null;
}

// ─── Keyframes ───

const keyframes = `
  @keyframes qc-slide-in {
    from { opacity: 0; transform: translateX(12px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes qc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes qc-success-flash {
    0% { box-shadow: 0 0 0px ${SK.green}00; }
    50% { box-shadow: 0 0 20px ${SK.green}60; }
    100% { box-shadow: 0 0 0px ${SK.green}00; }
  }
  @keyframes qc-fail-flash {
    0% { box-shadow: 0 0 0px ${SK.accent}00; }
    50% { box-shadow: 0 0 20px ${SK.accent}60; }
    100% { box-shadow: 0 0 0px ${SK.accent}00; }
  }
`;

// ─── Difficulty Config ───

function getDifficultyConfig(difficulty: string) {
  switch (difficulty) {
    case 'easy': return { color: SK.green, label: 'EASY' };
    case 'medium': return { color: SK.gold, label: 'MED' };
    case 'hard': return { color: SK.accent, label: 'HARD' };
    default: return { color: SK.textMuted, label: '---' };
  }
}

// ─── Reward Display ───

function getRewardIcon(type: string): string {
  switch (type) {
    case 'levelUp': return 'LV+';
    case 'heal': return 'HP+';
    case 'weapon': return 'WPN';
    case 'buff': return 'BUF';
    case 'xp': return 'XP+';
    case 'gold': return 'CR+';
    default: return '+';
  }
}

// ─── Success State ───

function SuccessCard({ challenge }: { challenge: QuizChallenge }) {
  const rewardIcon = getRewardIcon(challenge.reward.type);

  return (
    <div
      style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '16px 32px',
          background: SK.glassBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${SK.green}50`,
          borderRadius: 0,
          animation: 'qc-success-flash 1s ease-out',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: headingFont,
            fontSize: '22px',
            color: SK.green,
            letterSpacing: '0.1em',
            fontWeight: 700,
          }}
        >
          {QUIZ_CONFIG.texts.success.en}
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: '11px',
            color: `${SK.green}cc`,
            marginTop: '4px',
          }}
        >
          {rewardIcon} {challenge.reward.label}
        </div>
      </div>
    </div>
  );
}

// ─── Failed State ───

function FailedCard({ challenge }: { challenge: QuizChallenge }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '16px 32px',
          background: SK.glassBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${SK.accent}50`,
          borderRadius: 0,
          animation: 'qc-fail-flash 1s ease-out',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: headingFont,
            fontSize: '22px',
            color: SK.accent,
            letterSpacing: '0.1em',
            fontWeight: 700,
          }}
        >
          {QUIZ_CONFIG.texts.fail.en}
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: '11px',
            color: `${SK.accent}cc`,
            marginTop: '4px',
          }}
        >
          SPD -30% (5s)
        </div>
      </div>
    </div>
  );
}

// ─── Active Card ───

function ActiveCard({ challenge }: { challenge: QuizChallenge }) {
  const progress = Math.min(100, (challenge.current / challenge.target) * 100);
  const isTimerWarning = challenge.remaining <= QUIZ_CONFIG.visual.timerWarningThreshold;
  const diffConfig = getDifficultyConfig(challenge.difficulty);
  const rewardIcon = getRewardIcon(challenge.reward.type);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '340px',
        right: '8px',
        zIndex: 40,
        pointerEvents: 'none',
        animation: 'qc-slide-in 0.3s ease-out',
        willChange: 'transform',
      }}
    >
      <div
        style={{
          width: '192px',
          background: SK.glassBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${SK.gold}30`,
          borderRadius: 0,
          clipPath: apexClip.md,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 10px',
            background: `${SK.bg}cc`,
            borderBottom: `1px solid ${SK.gold}20`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontFamily: headingFont,
                fontSize: '11px',
                color: SK.gold,
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              MISSION
            </span>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: '8px',
                color: '#fff',
                padding: '0 4px',
                background: diffConfig.color,
                borderRadius: 0,
              }}
            >
              {diffConfig.label}
            </span>
          </div>

          {/* Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              animation: isTimerWarning ? 'qc-pulse 0.5s ease-in-out infinite' : 'none',
            }}
          >
            <span
              style={{
                fontFamily: headingFont,
                fontSize: '12px',
                color: isTimerWarning ? SK.accent : SK.gold,
                fontWeight: 600,
              }}
            >
              {Math.ceil(challenge.remaining)}s
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '8px 10px' }}>
          {/* Description */}
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: `${SK.gold}dd`,
              marginBottom: '8px',
              lineHeight: 1.3,
            }}
          >
            {challenge.description}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '6px' }}>
            <div
              style={{
                height: '5px',
                background: SK.cardBg,
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${SK.gold}, ${SK.orangeLight})`,
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '2px',
              }}
            >
              <span
                style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: SK.gold,
                }}
              >
                {challenge.current} / {challenge.target}
              </span>
              <span
                style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: SK.gold,
                }}
              >
                {Math.floor(progress)}%
              </span>
            </div>
          </div>

          {/* Reward */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 6px',
              background: `${SK.gold}10`,
              border: `1px solid ${SK.gold}20`,
              borderRadius: 0,
            }}
          >
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: '8px',
                color: `${SK.gold}cc`,
              }}
            >
              {rewardIcon} {challenge.reward.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Penalty Indicator ───

export function QuizPenaltyIndicator({
  isActive,
  timer,
}: {
  isActive: boolean;
  timer: number;
}) {
  if (!isActive) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: SK.glassBg,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: `1px solid ${SK.accent}40`,
          padding: '4px 12px',
          borderRadius: 0,
        }}
      >
        <span
          style={{
            fontFamily: headingFont,
            fontSize: '11px',
            color: SK.accent,
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
        >
          SPD PENALTY
        </span>
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: `${SK.accent}cc`,
          }}
        >
          {Math.ceil(timer)}s
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───

export function QuizChallengeCard({ challenge }: QuizChallengeCardProps) {
  if (!challenge) return null;

  return (
    <>
      <style>{keyframes}</style>

      {challenge.status === 'success' && (
        <SuccessCard challenge={challenge} />
      )}

      {(challenge.status === 'failed' || challenge.status === 'expired') && (
        <FailedCard challenge={challenge} />
      )}

      {challenge.status === 'active' && (
        <ActiveCard challenge={challenge} />
      )}
    </>
  );
}

export default QuizChallengeCard;
