'use client';

/**
 * WelcomeTutorial — 작전 브리핑 스타일 웰컴 모달
 * 다크 패널 + 손그림 보더 + 군사 톤
 */

import { useState, useEffect } from 'react';
import { SK, SKFont, headingFont, bodyFont, handDrawnRadius, sketchBorder } from '@/lib/sketch-ui';
import { McButton } from './McButton';

const STEPS = [
  {
    title: 'BRIEFING',
    text: 'AI World War is an auto-battler survival roguelike. Move with your mouse, dash with click.',
  },
  {
    title: 'ARMAMENT',
    text: 'Collect XP orbs to level up. Choose Tomes (passive buffs) and Abilities (active skills). Combine them for powerful Synergies!',
  },
  {
    title: 'MISSION',
    text: 'The arena shrinks over time. Be the last agent standing to win the round. Good luck, commander.',
  },
];

export function WelcomeTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('agent-survivor-tutorial-seen');
    if (!seen) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('agent-survivor-tutorial-seen', '1');
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 100,
    }}>
      <div style={{
        backgroundColor: SK.cardBg,
        borderRadius: handDrawnRadius(4),
        border: sketchBorder('rgba(232, 224, 212, 0.25)'),
        padding: '28px',
        maxWidth: '420px', width: '90%', textAlign: 'center',
      }}>
        {/* 단계 표시 */}
        <div style={{
          fontFamily: bodyFont, fontSize: SKFont.xs, fontWeight: 600,
          color: SK.textMuted, marginBottom: '16px',
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* 제목 */}
        <div style={{
          fontFamily: headingFont, fontSize: '28px',
          color: SK.textPrimary,
          marginBottom: '14px',
          letterSpacing: '3px',
        }}>
          {current.title}
        </div>

        {/* 본문 */}
        <div style={{
          fontFamily: bodyFont, fontSize: SKFont.body, fontWeight: 500,
          color: SK.textSecondary,
          lineHeight: 1.6, marginBottom: '24px',
        }}>
          {current.text}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          {step < STEPS.length - 1 ? (
            <McButton variant="green" onClick={() => setStep(s => s + 1)}>
              NEXT
            </McButton>
          ) : (
            <McButton variant="green" onClick={dismiss}>
              DEPLOY
            </McButton>
          )}
          {step < STEPS.length - 1 && (
            <McButton variant="default" onClick={dismiss}>
              SKIP
            </McButton>
          )}
        </div>
      </div>
    </div>
  );
}
