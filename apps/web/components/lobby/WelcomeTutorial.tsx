'use client';

/**
 * WelcomeTutorial — 첫 방문 시 3단계 튜토리얼 모달
 * Step 1: Move (WASD/Mouse)
 * Step 2: Level Up (collect orbs, choose upgrades)
 * Step 3: Survive (last agent standing wins)
 */

import { useState, useEffect } from 'react';
import { MC, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';
import { McButton } from './McButton';

const TUTORIAL_KEY = 'agent_survivor_tutorial_seen';

const STEPS = [
  {
    title: 'MOVE',
    description: 'Use WASD or Arrow Keys to move your agent. Hold Space to dash. Mouse to aim.',
    accent: '#55FFFF',
    icon: 'WASD',
  },
  {
    title: 'LEVEL UP',
    description: 'Collect orbs for XP. Choose upgrades when you level up. Build synergies for powerful combos!',
    accent: '#FFAA00',
    icon: 'LV',
  },
  {
    title: 'SURVIVE',
    description: 'Last agent standing wins. Arena shrinks over time. Use your build wisely!',
    accent: '#FF5555',
    icon: '1st',
  },
];

export function WelcomeTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(TUTORIAL_KEY);
      if (!seen) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setVisible(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
      // localStorage unavailable
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      zIndex: 100,
      fontFamily: bodyFont,
    }}>
      <div style={{
        backgroundColor: MC.panelBg,
        boxShadow: mcPanelShadow(),
        border: `2px solid ${MC.panelBorderDark}`,
        padding: '1.5rem',
        maxWidth: '360px',
        width: '90vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
      }}>
        {/* 타이틀 */}
        <div style={{
          fontFamily: pixelFont,
          fontSize: '0.7rem',
          color: MC.textGold,
          textShadow: '2px 2px 0 #553300',
          letterSpacing: '0.08em',
        }}>
          AGENT SURVIVOR
        </div>

        {/* 스텝 인디케이터 */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: step === i ? 20 : 8,
              height: 4,
              backgroundColor: step === i ? current.accent : MC.textGray,
              transition: 'all 200ms ease',
            }} />
          ))}
        </div>

        {/* 아이콘 */}
        <div style={{
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
          border: `2px solid ${current.accent}`,
          fontFamily: pixelFont,
          fontSize: '0.6rem',
          color: current.accent,
        }}>
          {current.icon}
        </div>

        {/* 스텝 제목 */}
        <div style={{
          fontFamily: pixelFont,
          fontSize: '0.5rem',
          color: current.accent,
          letterSpacing: '0.1em',
        }}>
          {step + 1}. {current.title}
        </div>

        {/* 설명 */}
        <div style={{
          fontSize: '0.85rem',
          color: MC.textSecondary,
          textAlign: 'center',
          lineHeight: '1.5',
        }}>
          {current.description}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
          <McButton
            variant="default"
            onClick={handleClose}
            style={{ flex: 1, fontSize: '0.5rem', padding: '0.5rem' }}
          >
            SKIP
          </McButton>
          <McButton
            variant="green"
            onClick={handleNext}
            style={{ flex: 2, fontSize: '0.5rem', padding: '0.5rem' }}
          >
            {step < STEPS.length - 1 ? 'NEXT' : 'GOT IT!'}
          </McButton>
        </div>
      </div>
    </div>
  );
}
