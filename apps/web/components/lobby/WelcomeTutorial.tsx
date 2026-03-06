'use client';

/**
 * WelcomeTutorial — 첫 방문 시 3단계 가이드 모달
 * Phase 1 MVP: 간단한 텍스트 가이드
 */

import { useState, useEffect } from 'react';
import { MC, mcPanelShadow, pixelFont, bodyFont } from '@/lib/minecraft-ui';

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
        border: `2px solid ${MC.panelBorderDark}`, padding: '1.5rem',
        maxWidth: '400px', width: '90%', textAlign: 'center',
      }}>
        <div style={{
          fontFamily: pixelFont, fontSize: '0.5rem', color: MC.textGold,
          marginBottom: '0.8rem', textShadow: '1px 1px 0 #553300',
        }}>
          {current.title}
        </div>
        <div style={{
          fontFamily: bodyFont, fontSize: '0.9rem', color: MC.textSecondary,
          lineHeight: '1.5', marginBottom: '1rem',
        }}>
          {current.text}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} style={{
              fontFamily: pixelFont, fontSize: '0.35rem', color: '#FFF',
              backgroundColor: MC.btnGreen, padding: '6px 20px',
              border: 'none', cursor: 'pointer',
            }}>
              NEXT ({step + 1}/{STEPS.length})
            </button>
          ) : (
            <button onClick={dismiss} style={{
              fontFamily: pixelFont, fontSize: '0.35rem', color: '#FFF',
              backgroundColor: MC.btnGreen, padding: '6px 20px',
              border: 'none', cursor: 'pointer',
            }}>
              LET'S GO!
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button onClick={dismiss} style={{
              fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textGray,
              backgroundColor: 'transparent', padding: '6px 12px',
              border: `1px solid ${MC.panelBorderLight}`, cursor: 'pointer',
            }}>
              SKIP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
