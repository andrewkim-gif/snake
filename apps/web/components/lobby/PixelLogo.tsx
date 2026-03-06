'use client';

/**
 * PixelLogo — Agent Survivor 로고 (AI 생성 픽셀아트 이미지)
 * gemini-3.1-flash-image-preview로 생성 + sharp 배경 제거
 */

import Image from 'next/image';
import { pixelFont, MCFont } from '@/lib/minecraft-ui';

export function PixelLogo() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
    }}>
      {/* 로고 이미지 */}
      <Image
        src="/images/logo.png"
        alt="Agent Survivor"
        width={400}
        height={153}
        priority
        style={{
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
          maxWidth: 'min(400px, 85vw)',
          height: 'auto',
        }}
      />

      {/* 서브타이틀 */}
      <div style={{
        fontFamily: pixelFont,
        fontSize: MCFont.sm,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '3px',
        marginTop: '8px',
        textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
      }}>
        SURVIVAL ROGUELIKE
      </div>
    </div>
  );
}
