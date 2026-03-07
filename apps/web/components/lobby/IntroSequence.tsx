'use client';

/**
 * IntroSequence — 시네마틱 진입 연출 (HTML 오버레이)
 *
 * 3D 카메라 연출은 GlobeIntroCamera에서 처리.
 * 이 컴포넌트는:
 *  1. 처음에 검은 오버레이로 씬을 가림
 *  2. 서서히 투명해지면서 3D 씬(로고+지구본)이 드러남
 *  3. UI 패널들 staggered reveal 타이밍 관리
 *  4. 클릭/ESC 스킵 지원
 *
 * Timeline:
 *  0.0s  — 검은 오버레이 (3D 씬 로딩 대기)
 *  0.5s  — 오버레이 서서히 투명 → 3D 로고+지구본 정면 뷰 드러남
 *  1.0s  — 카메라 접근 시작 (GlobeIntroCamera에서 처리)
 *  2.5s  — UI stagger 시작 (헤더, 좌측패널)
 *  3.5s  — 인트로 완전 완료
 */

import { useState, useEffect, useCallback } from 'react';
import { SK, bodyFont } from '@/lib/sketch-ui';

const INTRO_SESSION_KEY = 'aww-intro-played';

interface IntroSequenceProps {
  onIntroComplete: () => void;
  onPhaseChange?: (phase: IntroPhase) => void;
}

export type IntroPhase =
  | 'black'         // 0.0s — 검은 화면
  | 'reveal'        // 0.5s — 오버레이 페이드아웃 → 3D 씬 드러남
  | 'camera-move'   // 1.0s — 카메라 접근 + 지구본 회전 시작
  | 'ui-stagger'    // 2.5s — UI 패널 등장
  | 'done';         // 3.5s — 인트로 완료

export function IntroSequence({ onIntroComplete, onPhaseChange }: IntroSequenceProps) {
  const [phase, setPhase] = useState<IntroPhase>('black');
  const [visible, setVisible] = useState(true);

  // 세션 내 이미 재생 → 즉시 스킵
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(INTRO_SESSION_KEY)) {
      setPhase('done');
      setVisible(false);
      onIntroComplete();
      onPhaseChange?.('done');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 타임라인 시퀀서
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(INTRO_SESSION_KEY)) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (ms: number, p: IntroPhase) => {
      timers.push(setTimeout(() => {
        setPhase(p);
        onPhaseChange?.(p);
      }, ms));
    };

    schedule(500, 'reveal');
    schedule(1000, 'camera-move');
    schedule(2500, 'ui-stagger');
    schedule(3500, 'done');

    timers.push(setTimeout(() => {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
      onIntroComplete();
      setTimeout(() => setVisible(false), 600);
    }, 3500));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 클릭/ESC 스킵
  const handleSkip = useCallback(() => {
    if (phase === 'done') return;
    setPhase('done');
    onPhaseChange?.('done');
    sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    onIntroComplete();
    setTimeout(() => setVisible(false), 300);
  }, [phase, onIntroComplete, onPhaseChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') handleSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSkip]);

  if (!visible) return null;

  const isDone = phase === 'done';
  const isRevealing = phase !== 'black';

  return (
    <div
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        pointerEvents: isDone ? 'none' : 'auto',
        cursor: isDone ? 'default' : 'pointer',
        opacity: isDone ? 0 : 1,
        transition: isDone ? 'opacity 500ms ease' : undefined,
      }}
    >
      {/* 검은 오버레이 — 서서히 투명 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#030305',
        opacity: isRevealing ? 0 : 1,
        transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none',
      }} />

      {/* 스킵 안내 */}
      {!isDone && phase !== 'black' && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: bodyFont,
          fontSize: '9px',
          color: SK.textMuted,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          opacity: 0.4,
          zIndex: 20,
        }}>
          CLICK TO SKIP
        </div>
      )}
    </div>
  );
}
