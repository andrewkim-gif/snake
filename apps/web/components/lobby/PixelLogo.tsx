'use client';

/**
 * PixelLogo — AI World War 로고
 * Gemini 생성 스케치 로고 유지 + 작전 지도 스타일 폴백
 */

import { useState } from 'react';
import Image from 'next/image';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

export function PixelLogo() {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}>
        <Image
          src="/images/logo-ww-mc.png"
          alt="AI World War"
          width={500}
          height={274}
          priority
          onError={() => setImgError(true)}
          style={{
            maxWidth: 'min(500px, 90vw)',
            height: 'auto',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }}
        />
        <div style={{
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '4px',
          marginTop: '6px',
          textTransform: 'uppercase',
        }}>
          Multiplayer Survival Roguelike
        </div>
      </div>
    );
  }

  // CSS 폴백 로고
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
    }}>
      <div style={{
        fontFamily: bodyFont,
        fontWeight: 800,
        fontSize: 'clamp(24px, 5vw, 36px)',
        color: SK.gold,
        lineHeight: 1,
        letterSpacing: '6px',
      }}>
        AI
      </div>
      <div style={{
        fontFamily: bodyFont,
        fontWeight: 800,
        fontSize: 'clamp(40px, 10vw, 64px)',
        color: SK.textPrimary,
        lineHeight: 1,
        marginTop: '2px',
        letterSpacing: '2px',
      }}>
        WORLD WAR
      </div>
      <div style={{
        fontFamily: bodyFont,
        fontWeight: 600,
        fontSize: SKFont.xs,
        color: SK.textMuted,
        letterSpacing: '4px',
        marginTop: '8px',
        textTransform: 'uppercase',
      }}>
        Multiplayer Survival Roguelike
      </div>
    </div>
  );
}
