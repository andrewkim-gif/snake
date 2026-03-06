'use client';

/**
 * ShrinkWarning — 아레나 수축 경고 시각 효과
 * 빨간 펄스 화면 테두리 + "DANGER ZONE" 텍스트
 */

import { useState, useEffect } from 'react';
import type { ArenaShrinkPayload } from '@snake-arena/shared';
import { MC, pixelFont } from '@/lib/minecraft-ui';

interface ShrinkWarningProps {
  shrinkData: ArenaShrinkPayload | null;
  playerDistance: number;
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

  const safeRadius = currentRadius;
  const dangerZone = playerDistance > safeRadius;
  const nearEdge = playerDistance > safeRadius * 0.85;

  if (!nearEdge && !shrinkData) return null;

  const pulseAlpha = dangerZone
    ? 0.15 + Math.sin(pulse * 2) * 0.1
    : nearEdge
      ? 0.05 + Math.sin(pulse) * 0.03
      : 0;

  return (
    <>
      {(nearEdge || dangerZone) && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12,
          boxShadow: `inset 0 0 ${dangerZone ? 80 : 40}px rgba(255, 50, 50, ${pulseAlpha})`,
          transition: 'box-shadow 200ms',
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
          DANGER ZONE
        </div>
      )}

      {shrinkData && shrinkData.currentRadius < 6000 && !dangerZone && nearEdge && (
        <div style={{
          position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 14, fontFamily: pixelFont, fontSize: '0.3rem', color: MC.textRed,
          backgroundColor: 'rgba(0,0,0,0.5)', padding: '3px 10px',
          textShadow: '1px 1px 0 rgba(0,0,0,0.6)', pointerEvents: 'none', opacity: 0.8,
        }}>
          ARENA SHRINKING
        </div>
      )}
    </>
  );
}
