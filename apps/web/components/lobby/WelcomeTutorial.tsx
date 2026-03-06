'use client';

/**
 * WelcomeTutorial — 첫 방문 시 3단계 가이드 모달
 * MC 패널 + McButton 사용
 */

import { useState, useEffect } from 'react';
import { MC, MCFont, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';
import { McButton } from './McButton';

const STEPS = [
  {
    title: 'Welcome, Agent!',
    text: 'Agent Survivor is an auto-battler survival roguelike. Move with your mouse, dash with click.',
  },
  {
    title: 'Build Your Power',
    text: 'Collect XP orbs to level up. Choose Tomes (passive buffs) and Abilities (active skills). Combine them for powerful Synergies!',
  },
  {
    title: 'Survive & Win',
    text: 'The arena shrinks over time. Be the last agent standing to win the round. Good luck!',
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
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100,
    }}>
      <div style={{
        backgroundColor: MC.panelBg, boxShadow: mcPanelShadow(),
        border: `3px solid ${MC.panelBorderDark}`, padding: '24px',
        maxWidth: '440px', width: '90%', textAlign: 'center',
      }}>
        {/* 단계 표시 */}
        <div style={{
          fontFamily: pixelFont, fontSize: MCFont.xs, color: MC.textGray,
          marginBottom: '8px', letterSpacing: '1px',
        }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* 제목 */}
        <div style={{
          fontFamily: pixelFont, fontSize: MCFont.h1, color: MC.textGold,
          marginBottom: '14px', textShadow: '2px 2px 0 #553300',
          lineHeight: 1.4,
        }}>
          {current.title}
        </div>

        {/* 본문 */}
        <div style={{
          fontFamily: bodyFont, fontSize: '15px', color: MC.textSecondary,
          lineHeight: 1.6, marginBottom: '20px',
        }}>
          {current.text}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {step < STEPS.length - 1 ? (
            <McButton variant="green" onClick={() => setStep(s => s + 1)}>
              NEXT
            </McButton>
          ) : (
            <McButton variant="green" onClick={dismiss}>
              LET&#39;S GO!
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
