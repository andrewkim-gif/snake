'use client';

/**
 * GlobeLoadingScreen — 3D 지구본 로딩 중 표시하는 전체 화면 로딩 스크린
 *
 * Apex Tactical CIC 디자인 시스템 (SK tokens):
 * - 검은 배경 + 레드 악센트 로딩바
 * - clip-path 삼각 컷 (우상단 대각선)
 * - 로딩 완료 시 페이드아웃
 */

import { useState, useEffect, useRef } from 'react';
import { SK, bodyFont, headingFont, apexClip } from '@/lib/sketch-ui';

interface GlobeLoadingScreenProps {
  /** 3D 씬 로딩 완료 여부 */
  ready: boolean;
  /** 페이드아웃 완료 후 호출 (DOM 제거 가능) */
  onFadeComplete?: () => void;
}

// 로딩 텍스트 사이클
const LOADING_TEXTS = [
  'INITIALIZING COMMAND CENTER',
  'LOADING GEOPOLITICAL DATA',
  'RENDERING GLOBAL THEATER',
  'ESTABLISHING UPLINK',
];

export function GlobeLoadingScreen({ ready, onFadeComplete }: GlobeLoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [textIndex, setTextIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const rafRef = useRef(0);

  // 시뮬레이션 프로그레스 (실제 로딩은 ready prop으로 제어)
  useEffect(() => {
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      // ready 전: 0→85% 를 3초에 걸쳐 (ease-out)
      // ready 후: 즉시 100%
      if (!ready) {
        const t = Math.min(elapsed / 3000, 1);
        const eased = 1 - (1 - t) * (1 - t); // ease-out quadratic
        progressRef.current = eased * 85;
      } else {
        progressRef.current = Math.min(progressRef.current + 5, 100);
      }
      setProgress(progressRef.current);

      if (progressRef.current < 100) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready]);

  // 텍스트 사이클
  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % LOADING_TEXTS.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // ready + progress 100% → 페이드아웃
  useEffect(() => {
    if (ready && progress >= 99) {
      const timer = setTimeout(() => setFadeOut(true), 200);
      return () => clearTimeout(timer);
    }
  }, [ready, progress]);

  // 페이드아웃 완료 → 콜백
  useEffect(() => {
    if (fadeOut) {
      const timer = setTimeout(() => onFadeComplete?.(), 600);
      return () => clearTimeout(timer);
    }
  }, [fadeOut, onFadeComplete]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: SK.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 600ms ease',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* 중앙 로딩 블록 */}
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 로고 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/generated/logo-v2.png"
            alt="AI World War"
            style={{
              height: 36,
              objectFit: 'contain',
              filter: `drop-shadow(0 0 8px ${SK.accent}66)`,
            }}
          />
        </div>

        {/* 프로그레스 바 트랙 */}
        <div
          style={{
            width: '100%',
            height: 3,
            background: 'rgba(255, 255, 255, 0.06)',
            position: 'relative',
            overflow: 'hidden',
            clipPath: apexClip.sm,
          }}
        >
          {/* 프로그레스 바 필 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${SK.accentDark}, ${SK.accent})`,
              transition: 'width 100ms linear',
              boxShadow: `0 0 12px ${SK.accent}66, 0 0 4px ${SK.accent}44`,
            }}
          />
        </div>

        {/* 하단 정보 라인 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* 로딩 텍스트 */}
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 10,
              letterSpacing: '0.15em',
              color: SK.textMuted,
              textTransform: 'uppercase',
            }}
          >
            {LOADING_TEXTS[textIndex]}
          </div>

          {/* 퍼센트 */}
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 11,
              color: SK.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* 하단 레드 악센트 라인 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${SK.accent}66, transparent)`,
        }}
      />

      <style>{`
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
