'use client';

/**
 * WelcomeTutorial — 작전 브리핑 스타일 웰컴 모달
 * v15: 글래스모피즘 + 비주얼 스텝 인디케이터 + lucide 아이콘
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Swords, Target } from 'lucide-react';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { McButton } from './McButton';
import type { LucideIcon } from 'lucide-react';

interface StepConfig {
  key: string;
  icon: LucideIcon;
}

const STEPS: StepConfig[] = [
  { key: 'briefing', icon: FileText },
  { key: 'armament', icon: Swords },
  { key: 'mission', icon: Target },
];

/** 비주얼 스텝 인디케이터: 원 3개 + 연결 라인 */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0px',
      marginBottom: '24px',
    }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {/* 원 */}
            <div style={{
              width: active ? '14px' : '10px',
              height: active ? '14px' : '10px',
              borderRadius: '50%',
              backgroundColor: done ? SK.gold : active ? 'transparent' : 'transparent',
              border: `2px solid ${done || active ? SK.gold : 'rgba(255,255,255,0.15)'}`,
              transition: 'all 300ms ease',
              boxShadow: active ? `0 0 10px ${SK.gold}40` : 'none',
            }} />
            {/* 라인 (마지막 아이템 제외) */}
            {i < total - 1 && (
              <div style={{
                width: '32px',
                height: '2px',
                backgroundColor: done ? SK.gold : 'rgba(255,255,255,0.1)',
                transition: 'background-color 300ms ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WelcomeTutorial() {
  const tTutorial = useTranslations('tutorial');
  const tCommon = useTranslations('common');
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('agent-survivor-tutorial-seen');
    if (!seen) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('agent-survivor-tutorial-seen', '1');
  };

  const nextStep = () => {
    setFadeKey((k) => k + 1);
    setStep((s) => s + 1);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: SK.glassBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.06)',
        borderTop: `2px solid ${SK.gold}`,
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
        padding: '32px',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center',
      }}>
        {/* 스텝 인디케이터 */}
        <StepIndicator current={step} total={STEPS.length} />

        {/* 아이콘 */}
        <div
          key={fadeKey}
          style={{
            animation: 'tutorialFadeIn 350ms ease',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 0,
              background: `${SK.gold}15`,
              border: `1px solid ${SK.gold}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon size={24} color={SK.gold} strokeWidth={1.5} />
            </div>
          </div>

          {/* 제목 */}
          <div style={{
            fontFamily: headingFont,
            fontSize: '26px',
            color: SK.textPrimary,
            marginBottom: '12px',
            letterSpacing: '3px',
          }}>
            {tTutorial(current.key)}
          </div>

          {/* 본문 */}
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.body,
            fontWeight: 500,
            color: SK.textSecondary,
            lineHeight: 1.7,
            marginBottom: '28px',
          }}>
            {tTutorial(`${current.key}Desc`)}
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          {step < STEPS.length - 1 ? (
            <McButton variant="green" onClick={nextStep}>
              {tCommon('next')}
            </McButton>
          ) : (
            <McButton variant="green" onClick={dismiss}>
              {tTutorial('deploy')}
            </McButton>
          )}
          {step < STEPS.length - 1 && (
            <McButton variant="default" onClick={dismiss}>
              {tCommon('skip')}
            </McButton>
          )}
        </div>
      </div>

      {/* 페이드 애니메이션 */}
      <style>{`
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
