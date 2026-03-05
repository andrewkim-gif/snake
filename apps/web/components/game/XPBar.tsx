'use client';

/**
 * XPBar — 화면 최하단 풀 너비 XP 프로그레스 바
 * 레벨업 시 플래시 애니메이션
 */

import { useState, useEffect, useRef } from 'react';
import { MC, pixelFont } from '@/lib/minecraft-ui';

interface XPBarProps {
  level: number;
  xp: number;
  xpToNext: number;
}

export function XPBar({ level, xp, xpToNext }: XPBarProps) {
  const [flash, setFlash] = useState(false);
  const prevLevelRef = useRef(level);

  // 레벨업 감지 -> 플래시
  useEffect(() => {
    if (level > prevLevelRef.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 600);
      prevLevelRef.current = level;
      return () => clearTimeout(timer);
    }
    prevLevelRef.current = level;
  }, [level]);

  const progress = xpToNext > 0 ? Math.min(xp / xpToNext, 1) : 0;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '20px',
      zIndex: 15,
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {/* 배경 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
      }} />

      {/* XP fill */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${progress * 100}%`,
        backgroundColor: flash ? '#55FF55' : '#579E45',
        transition: flash ? 'none' : 'width 200ms ease, background-color 300ms',
        boxShadow: flash ? '0 0 12px rgba(85, 255, 85, 0.6)' : 'none',
      }} />

      {/* 레벨 번호 (좌측) */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        fontFamily: pixelFont,
        fontSize: '0.35rem',
        color: MC.textGold,
        paddingLeft: '8px',
        textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
      }}>
        Lv.{level}
      </div>

      {/* XP 수치 (우측) */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        fontFamily: pixelFont,
        fontSize: '0.25rem',
        color: MC.textSecondary,
        marginLeft: 'auto',
        paddingRight: '8px',
        textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
      }}>
        {Math.floor(xp)}/{xpToNext}
      </div>
    </div>
  );
}
