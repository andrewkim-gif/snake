'use client';

/**
 * ShrinkWarning — 아레나 수축 경고 시각 효과
 * 빨간 펄스 화면 테두리 + "DANGER ZONE" 텍스트
 */

import { useState, useEffect } from 'react';
import type { ArenaShrinkPayload } from '@snake-arena/shared';
import { MC, pixelFont } from '@/lib/minecraft-ui';

interface ShrinkWarningProps {
  /** 아레나 수축 정보 (null이면 숨김) */
  shrinkData: ArenaShrinkPayload | null;
  /** 현재 플레이어의 arena 중심에서의 거리 (단위: world px) */
  playerDistance: number;
  /** 현재 아레나 반경 (shrinkData.currentRadius 또는 기본값) */
  currentRadius: number;
}

export function ShrinkWarning({ shrinkData, playerDistance, currentRadius }: ShrinkWarningProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      setPulse(performance.now() * 0.003);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 플레이어가 경계 바깥 또는 매우 가까운지
  const safeRadius = currentRadius;
  const dangerZone = playerDistance > safeRadius;
  const nearEdge = playerDistance > safeRadius * 0.85;

  if (!nearEdge && !shrinkData) return null;

  const pulseAlpha = dangerZone
    ? 0.15 + Math.sin(pulse * 2) * 0.1 // 바깥: 더 강하게
    : nearEdge
      ? 0.05 + Math.sin(pulse) * 0.03 // 가까이: 약하게
      : 0;

  return (
    <>
      {/* 빨간 테두리 효과 (vignette) */}
      {(nearEdge || dangerZone) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 12,
          boxShadow: `inset 0 0 ${dangerZone ? 80 : 40}px rgba(255, 50, 50, ${pulseAlpha})`,
          transition: 'box-shadow 200ms',
        }} />
      )}

      {/* DANGER ZONE 텍스트 (바깥일 때만) */}
      {dangerZone && (
        <div style={{
          position: 'absolute',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 16,
          fontFamily: pixelFont,
          fontSize: '0.6rem',
          color: MC.textRed,
          textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
          opacity: 0.6 + Math.sin(pulse * 2) * 0.4,
          letterSpacing: '0.15em',
          pointerEvents: 'none',
        }}>
          DANGER ZONE
        </div>
      )}

      {/* 수축 진행 표시 (상단) */}
      {shrinkData && shrinkData.currentRadius < 6000 && !dangerZone && nearEdge && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 14,
          fontFamily: pixelFont,
          fontSize: '0.3rem',
          color: MC.textRed,
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '3px 10px',
          textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          pointerEvents: 'none',
          opacity: 0.8,
        }}>
          ARENA SHRINKING
        </div>
      )}
    </>
  );
}
