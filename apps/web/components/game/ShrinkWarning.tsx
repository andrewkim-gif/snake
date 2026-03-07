'use client';

/**
 * ShrinkWarning — 아레나 수축 경고 시각 효과
 * 빨간 펄스 화면 테두리 + "DANGER ZONE" 텍스트
 * v10 추가: 수축 경계 근접도 기반 빨간 비네팅 오버레이
 *
 * 비네팅 강도 계산:
 *   - 경계로부터의 거리 = currentRadius - playerDistance
 *   - safeMargin = currentRadius * 0.15 (안전 마진 15%)
 *   - proximity = 1 - clamp(거리 / safeMargin, 0, 1)
 *   - 가까울수록 proximity → 1, 멀수록 → 0
 *
 * 비네팅 방식: CSS radial-gradient + box-shadow inset 이중 레이어
 *   - radial-gradient: 중심 투명 → 가장자리 빨강 (부드러운 그라데이션)
 *   - box-shadow inset: 테두리 글로우 (선명한 경계)
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ArenaShrinkPayload } from '@agent-survivor/shared';
import { MC, pixelFont } from '@/lib/minecraft-ui';

interface ShrinkWarningProps {
  shrinkData: ArenaShrinkPayload | null;
  playerDistance: number;
  currentRadius: number;
}

export function ShrinkWarning({ shrinkData, playerDistance, currentRadius }: ShrinkWarningProps) {
  const tGame = useTranslations('game');
  const [pulse, setPulse] = useState(0);

  // 펄스 애니메이션 (~15fps로 제한하여 불필요한 re-render 감소)
  useEffect(() => {
    let raf: number;
    let lastFrame = 0;
    const FRAME_INTERVAL = 66; // ~15fps
    const animate = (now: number) => {
      if (now - lastFrame >= FRAME_INTERVAL) {
        setPulse(now * 0.003);
        lastFrame = now;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const safeRadius = currentRadius;
  const dangerZone = playerDistance > safeRadius;
  const nearEdge = playerDistance > safeRadius * 0.85;

  // 비네팅 강도 계산: 경계에 가까울수록 강한 빨간 비네팅
  const vignetteIntensity = useMemo(() => {
    if (currentRadius <= 0) return 0;
    // 안전 마진: 반경의 15% 이내로 접근하면 비네팅 시작
    const safeMargin = currentRadius * 0.15;
    const distFromEdge = currentRadius - playerDistance;

    if (distFromEdge <= 0) {
      // 경계 밖: 최대 강도
      return 1.0;
    }
    if (distFromEdge >= safeMargin) {
      // 안전 마진 밖: 비네팅 없음
      return 0;
    }
    // 0~1 사이: 경계에 가까울수록 강함
    return 1.0 - distFromEdge / safeMargin;
  }, [currentRadius, playerDistance]);

  // 수축 진행 중일 때 추가 비네팅 (경계 근접과 별도)
  const shrinkActive = shrinkData !== null && shrinkData.currentRadius > (shrinkData.minRadius ?? 0);

  if (!nearEdge && !shrinkData && vignetteIntensity <= 0) return null;

  const pulseAlpha = dangerZone
    ? 0.15 + Math.sin(pulse * 2) * 0.1
    : nearEdge
      ? 0.05 + Math.sin(pulse) * 0.03
      : 0;

  // 비네팅 계산값
  const vignetteAlpha = vignetteIntensity * (0.3 + Math.sin(pulse * 1.5) * 0.1);
  const vignetteSpread = Math.max(30, 100 - vignetteIntensity * 70); // 중심 투명 영역 크기 (30~100%)
  const glowSize = 40 + vignetteIntensity * 80; // box-shadow 크기 (40~120px)
  const glowAlpha = vignetteIntensity * (0.2 + Math.sin(pulse * 2) * 0.08);

  return (
    <>
      {/* 비네팅 오버레이: radial-gradient 기반 (부드러운 가장자리 빨강) */}
      {vignetteIntensity > 0.01 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 11,
          background: `radial-gradient(ellipse at center, transparent ${vignetteSpread}%, rgba(180, 20, 20, ${vignetteAlpha}) 100%)`,
          transition: 'background 300ms ease-out',
        }} />
      )}

      {/* 기존 box-shadow 비네팅 (강화된 글로우) */}
      {(nearEdge || dangerZone || vignetteIntensity > 0.01) && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12,
          boxShadow: vignetteIntensity > 0.01
            ? `inset 0 0 ${glowSize}px rgba(255, 30, 30, ${glowAlpha}), inset 0 0 ${dangerZone ? 80 : 40}px rgba(255, 50, 50, ${pulseAlpha})`
            : `inset 0 0 ${dangerZone ? 80 : 40}px rgba(255, 50, 50, ${pulseAlpha})`,
          transition: 'box-shadow 200ms',
        }} />
      )}

      {/* 수축 활성 중 + 경계 접근 시 상단 경고 바 */}
      {shrinkActive && vignetteIntensity > 0.3 && !dangerZone && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '3px',
          background: `linear-gradient(to right, transparent, rgba(255, 50, 50, ${vignetteIntensity * 0.6}), transparent)`,
          pointerEvents: 'none',
          zIndex: 13,
        }} />
      )}

      {dangerZone && (
        <div style={{
          position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 16, fontFamily: pixelFont, fontSize: '0.6rem', color: MC.textRed,
          textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
          opacity: 0.6 + Math.sin(pulse * 2) * 0.4,
          letterSpacing: '0.15em', pointerEvents: 'none',
        }}>
          {tGame('dangerZone')}
        </div>
      )}

      {shrinkData && shrinkData.currentRadius < 6000 && !dangerZone && nearEdge && (
        <div style={{
          position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 14, fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textRed,
          backgroundColor: 'rgba(0,0,0,0.5)', padding: '3px 10px',
          textShadow: '1px 1px 0 rgba(0,0,0,0.6)', pointerEvents: 'none', opacity: 0.8,
        }}>
          {tGame('arenaShrinking')}
        </div>
      )}
    </>
  );
}
