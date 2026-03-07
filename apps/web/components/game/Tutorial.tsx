'use client';

/**
 * Tutorial — v14 Phase 10 S44: 6-step Onboarding System
 *
 * Steps:
 * 1. Character Creation + Nationality Selection Guide
 * 2. Movement & Orb Collection (Peace Phase)
 * 3. Weapon Auto-fire + Level-up Selection
 * 4. Deathmatch Combat Flow
 * 5. Domination System Overview
 * 6. Globe & Country Info Guide
 *
 * Features:
 * - Semi-transparent overlay with spotlight highlights
 * - Auto-starts on first visit (localStorage flag)
 * - Skippable at any time
 * - Event-driven step triggers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MC } from '@/lib/minecraft-ui';

// --- Tutorial Step Definitions ---

export type TutorialStepId =
  | 'character_creation'
  | 'movement'
  | 'levelup'
  | 'deathmatch'
  | 'domination'
  | 'globe';

interface TutorialStepDef {
  id: TutorialStepId;
  title: string;
  description: string;
  highlightArea?: HighlightArea;
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
  autoAdvanceTrigger?: string; // event name that auto-advances this step
}

interface HighlightArea {
  top?: string;
  left?: string;
  width?: string;
  height?: string;
  bottom?: string;
  right?: string;
  borderRadius?: string;
}

const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'character_creation',
    title: 'CREATE YOUR AGENT',
    description:
      'Enter your name and select your nationality from 195 countries. ' +
      'Hit RANDOMIZE to generate a unique character, then CONFIRM to enter the battle.',
    highlightArea: { top: '20%', left: '25%', width: '50%', height: '60%', borderRadius: '8px' },
    arrowDirection: 'down',
    autoAdvanceTrigger: 'character_confirmed',
  },
  {
    id: 'movement',
    title: 'MOVE & COLLECT',
    description:
      'Use WASD or joystick to move your agent. Collect glowing orbs to gain XP during the Peace Phase. ' +
      'You have 5 minutes to farm before combat begins!',
    highlightArea: { bottom: '10%', left: '35%', width: '30%', height: '15%', borderRadius: '8px' },
    arrowDirection: 'up',
    autoAdvanceTrigger: 'first_orb_collected',
  },
  {
    id: 'levelup',
    title: 'LEVEL UP & CHOOSE',
    description:
      'When you level up, choose 1 of 3 upgrades: Weapons (auto-fire!), Passives (stat boosts), ' +
      'or Synergy hints. Duplicate weapons evolve to higher levels. Build your combo!',
    highlightArea: { top: '25%', left: '20%', width: '60%', height: '50%', borderRadius: '8px' },
    arrowDirection: 'down',
    autoAdvanceTrigger: 'first_levelup',
  },
  {
    id: 'deathmatch',
    title: 'DEATHMATCH!',
    description:
      'After 5 minutes of peace, WAR PHASE begins! Your weapons fire automatically. ' +
      'Position wisely, dodge enemy attacks, and rack up kills. Death? You respawn in 3 seconds with your build intact.',
    highlightArea: { top: '5%', left: '30%', width: '40%', height: '10%', borderRadius: '8px' },
    arrowDirection: 'down',
    autoAdvanceTrigger: 'first_war_phase',
  },
  {
    id: 'domination',
    title: 'DOMINATE NATIONS',
    description:
      'Every 10-minute epoch, your kills earn National Points. After 6 epochs (1 hour), ' +
      'the top-scoring nation dominates! Hold for 24h to gain Sovereignty, 7 days for Hegemony powers.',
    highlightArea: { top: '5%', right: '5%', width: '25%', height: '20%', borderRadius: '8px' },
    arrowDirection: 'left',
    autoAdvanceTrigger: 'first_epoch_end',
  },
  {
    id: 'globe',
    title: 'THE WORLD AWAITS',
    description:
      'Press ESC to return to the Globe view. Click any country to enter its arena. ' +
      'Watch domination colors change in real-time, and wage wars between nations!',
    highlightArea: { top: '20%', left: '20%', width: '60%', height: '60%', borderRadius: '50%' },
    arrowDirection: 'down',
    autoAdvanceTrigger: 'first_globe_return',
  },
];

// --- Local Storage Key ---
const TUTORIAL_COMPLETED_KEY = 'aww_tutorial_completed';
const TUTORIAL_STEP_KEY = 'aww_tutorial_step';

// --- Tutorial Event Bus ---
type TutorialEventCallback = (event: string) => void;
const tutorialListeners: TutorialEventCallback[] = [];

/** Emit a tutorial trigger event from anywhere in the app. */
export function emitTutorialEvent(event: string): void {
  tutorialListeners.forEach((cb) => cb(event));
}

// --- Tutorial Component ---

interface TutorialProps {
  /** Force show tutorial (ignores localStorage). */
  forceShow?: boolean;
  /** Called when tutorial is completed or skipped. */
  onComplete?: () => void;
}

export function Tutorial({ forceShow = false, onComplete }: TutorialProps) {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const listenerRef = useRef<TutorialEventCallback | null>(null);

  // Check if tutorial should show
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setFadeIn(true);
      return;
    }

    const completed = localStorage.getItem(TUTORIAL_COMPLETED_KEY);
    if (!completed) {
      // First visit — auto-start
      setVisible(true);
      setTimeout(() => setFadeIn(true), 100);

      // Restore step if partially completed
      const savedStep = localStorage.getItem(TUTORIAL_STEP_KEY);
      if (savedStep) {
        const idx = parseInt(savedStep, 10);
        if (!isNaN(idx) && idx >= 0 && idx < TUTORIAL_STEPS.length) {
          setStepIndex(idx);
        }
      }
    }
  }, [forceShow]);

  // Register event listener for auto-advance triggers
  useEffect(() => {
    const listener: TutorialEventCallback = (event) => {
      if (!visible) return;
      const currentStep = TUTORIAL_STEPS[stepIndex];
      if (currentStep?.autoAdvanceTrigger === event) {
        handleNext();
      }
    };

    listenerRef.current = listener;
    tutorialListeners.push(listener);

    return () => {
      const idx = tutorialListeners.indexOf(listener);
      if (idx >= 0) tutorialListeners.splice(idx, 1);
    };
  }, [visible, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = useCallback(() => {
    if (stepIndex < TUTORIAL_STEPS.length - 1) {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      localStorage.setItem(TUTORIAL_STEP_KEY, String(nextIdx));
    } else {
      handleComplete();
    }
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrev = useCallback(() => {
    if (stepIndex > 0) {
      const prevIdx = stepIndex - 1;
      setStepIndex(prevIdx);
      localStorage.setItem(TUTORIAL_STEP_KEY, String(prevIdx));
    }
  }, [stepIndex]);

  const handleComplete = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      localStorage.removeItem(TUTORIAL_STEP_KEY);
      onComplete?.();
    }, 300);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  if (!visible) return null;

  const step = TUTORIAL_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'auto',
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}
    >
      {/* Semi-transparent backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
        }}
      />

      {/* Highlight cutout area */}
      {step.highlightArea && (
        <div
          style={{
            position: 'absolute',
            ...step.highlightArea,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            border: `2px solid ${MC.textGold}`,
            borderRadius: step.highlightArea.borderRadius || '0px',
            zIndex: 1,
            pointerEvents: 'none',
            animation: 'tutorialPulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Content card */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(90vw, 520px)',
          backgroundColor: MC.panelBg,
          border: `2px solid ${MC.panelBorderLight}`,
          padding: '24px',
          zIndex: 2,
          fontFamily: '"Rajdhani", "Inter", sans-serif',
        }}
      >
        {/* Step counter */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <span style={{ color: MC.textGold, fontSize: '12px', letterSpacing: '0.1em' }}>
            STEP {stepIndex + 1} / {TUTORIAL_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: MC.textGray,
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
              padding: '4px 8px',
            }}
          >
            SKIP TUTORIAL
          </button>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '3px',
            backgroundColor: MC.panelBorderDark,
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: MC.textGold,
              transition: 'width 300ms ease',
            }}
          />
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 700,
            color: MC.textPrimary,
            fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            lineHeight: 1.6,
            color: MC.textSecondary,
          }}
        >
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={handlePrev}
            disabled={stepIndex === 0}
            style={{
              flex: 1,
              padding: '10px 16px',
              backgroundColor: stepIndex === 0 ? MC.panelBorderDark : MC.btnDefault,
              color: stepIndex === 0 ? MC.textGray : MC.textPrimary,
              border: 'none',
              cursor: stepIndex === 0 ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              opacity: stepIndex === 0 ? 0.5 : 1,
            }}
          >
            BACK
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              padding: '10px 16px',
              backgroundColor: stepIndex === TUTORIAL_STEPS.length - 1 ? MC.btnGreen : MC.textGold,
              color: '#000',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {stepIndex === TUTORIAL_STEPS.length - 1 ? 'START PLAYING' : 'NEXT'}
          </button>
        </div>
      </div>

      {/* CSS Animation for pulse */}
      <style>{`
        @keyframes tutorialPulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 20px rgba(204, 153, 51, 0.3); }
          50% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 40px rgba(204, 153, 51, 0.6); }
        }
      `}</style>
    </div>
  );
}

// --- Utility: Reset tutorial state ---
export function resetTutorial(): void {
  localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
  localStorage.removeItem(TUTORIAL_STEP_KEY);
}

// --- Utility: Check if tutorial was completed ---
export function isTutorialCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
}
