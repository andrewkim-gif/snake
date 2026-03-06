'use client';

/**
 * PixelLogo — Agent Survivor 타이틀 로고
 * MC 스타일 3D 블록 텍스트 + 장식 구분선 + 서브타이틀
 */

import { pixelFont, MCFont } from '@/lib/minecraft-ui';

export function PixelLogo() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
    }}>
      {/* AGENT — 골드 3D 블록 텍스트 */}
      <div style={{
        fontFamily: pixelFont,
        fontSize: '44px',
        color: '#FFCC00',
        textShadow: `
          2px 2px 0 #B38F00,
          4px 4px 0 #806600,
          6px 6px 0 #4D3900,
          8px 8px 0 #1A1400,
          0 0 20px rgba(255,204,0,0.3),
          0 0 60px rgba(255,170,0,0.12)
        `,
        letterSpacing: '6px',
        lineHeight: 1,
      }}>
        AGENT
      </div>

      {/* SURVIVOR — 레드-오렌지 3D 블록 텍스트 */}
      <div style={{
        fontFamily: pixelFont,
        fontSize: '44px',
        color: '#FF6644',
        textShadow: `
          2px 2px 0 #CC4422,
          4px 4px 0 #992211,
          6px 6px 0 #661100,
          8px 8px 0 #330800,
          0 0 20px rgba(255,102,68,0.3),
          0 0 60px rgba(255,85,85,0.12)
        `,
        letterSpacing: '3px',
        lineHeight: 1,
        marginTop: '2px',
      }}>
        SURVIVOR
      </div>

      {/* 장식 구분선 (⚔) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '10px',
      }}>
        <div style={{
          width: '70px', height: '3px',
          background: 'linear-gradient(90deg, transparent, #FFAA00)',
        }} />
        <span style={{
          fontFamily: pixelFont,
          fontSize: '14px',
          color: '#FFAA00',
          textShadow: '0 0 10px rgba(255,170,0,0.6)',
        }}>
          ⚔
        </span>
        <div style={{
          width: '70px', height: '3px',
          background: 'linear-gradient(90deg, #FFAA00, transparent)',
        }} />
      </div>

      {/* 서브타이틀 */}
      <div style={{
        fontFamily: pixelFont,
        fontSize: MCFont.sm,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '3px',
        marginTop: '6px',
        textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
      }}>
        SURVIVAL ROGUELIKE
      </div>
    </div>
  );
}
