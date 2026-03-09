'use client';

/**
 * MatrixIntro.tsx - "THE MATRIX" 진입 연출
 * 녹색 코드 레인 (Matrix digital rain) + 글리치 텍스트
 * 2.5초 후 자동 dismiss → onComplete 콜백
 */

import { useRef, useEffect, useCallback, useState } from 'react';

interface MatrixIntroProps {
  onComplete: () => void;
  duration?: number; // ms (기본 2500)
  /** v29b Phase 2: 진입 국가 이름 (표시용) */
  countryName?: string;
}

// Matrix rain 문자셋 (카타카나 + 숫자 + 기호)
const RAIN_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF@#$%&*';

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  length: number;
  opacity: number;
}

export function MatrixIntro({ onComplete, duration = 2500, countryName }: MatrixIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const columnsRef = useRef<RainColumn[]>([]);
  // v29b Phase 2: 국가명이 있으면 "BATTLE FOR [국가명]", 없으면 "THE MATRIX"
  const displayTitle = countryName ? `BATTLE FOR ${countryName.toUpperCase()}` : 'THE MATRIX';
  const [glitchText, setGlitchText] = useState(displayTitle);
  const completedRef = useRef(false);

  // 글리치 문자 생성
  const glitchChar = useCallback(() => {
    return RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
  }, []);

  // 글리치 효과 (텍스트 일부를 랜덤 문자로 치환)
  useEffect(() => {
    const original = displayTitle;
    const interval = setInterval(() => {
      const now = Date.now() - startTimeRef.current;
      // 처음 1.5초: 강한 글리치, 이후: 안정화
      const glitchIntensity = now < 1500 ? 0.4 : 0.1;

      let result = '';
      for (let i = 0; i < original.length; i++) {
        if (original[i] === ' ') {
          result += ' ';
        } else if (Math.random() < glitchIntensity) {
          result += glitchChar();
        } else {
          result += original[i];
        }
      }
      setGlitchText(result);
    }, 80);

    return () => clearInterval(interval);
  }, [glitchChar]);

  // 자동 dismiss 타이머
  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  // 클릭/키로 스킵
  useEffect(() => {
    const skip = () => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [onComplete]);

  // Matrix rain 애니메이션
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 사이즈
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fontSize = 14;
    const numCols = Math.ceil(canvas.width / fontSize);

    // 레인 컬럼 초기화
    const columns: RainColumn[] = [];
    for (let i = 0; i < numCols; i++) {
      const length = 5 + Math.floor(Math.random() * 20);
      const chars: string[] = [];
      for (let j = 0; j < length; j++) {
        chars.push(RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)]);
      }
      columns.push({
        x: i * fontSize,
        y: -Math.random() * canvas.height * 2, // 랜덤 시작 위치
        speed: 80 + Math.random() * 200,
        chars,
        length,
        opacity: 0.3 + Math.random() * 0.7,
      });
    }
    columnsRef.current = columns;

    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // 반투명 검은 배경 (잔상 효과)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (const col of columns) {
        col.y += col.speed * dt;

        for (let j = 0; j < col.chars.length; j++) {
          const charY = col.y - j * fontSize;
          if (charY < -fontSize || charY > canvas.height + fontSize) continue;

          // 첫 번째 문자: 밝은 흰록색, 나머지: 점점 어두운 녹색
          const brightness = j === 0 ? 1.0 : Math.max(0.1, 1 - j / col.length);
          if (j === 0) {
            ctx.fillStyle = `rgba(180, 255, 180, ${col.opacity})`;
          } else {
            const g = Math.floor(100 + brightness * 155);
            ctx.fillStyle = `rgba(0, ${g}, 65, ${col.opacity * brightness})`;
          }

          ctx.fillText(col.chars[j], col.x, charY);

          // 간헐적 문자 변경
          if (Math.random() < 0.02) {
            col.chars[j] = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
          }
        }

        // 화면 밖으로 나가면 리셋
        if (col.y - col.length * fontSize > canvas.height) {
          col.y = -col.length * fontSize;
          col.speed = 80 + Math.random() * 200;
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    // 초기: 완전 검은 화면
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    requestRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: '#000',
    }}>
      {/* Matrix rain canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* 중앙 텍스트 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* "THE MATRIX" 글리치 텍스트 */}
        <h1 style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(48px, 8vw, 96px)',
          fontWeight: 'bold',
          color: '#00FF41',
          textShadow: `
            0 0 10px #00FF41,
            0 0 20px #00FF41,
            0 0 40px #00CC33,
            0 0 80px #009922,
            ${Math.random() > 0.7 ? `${(Math.random() - 0.5) * 4}px 0 rgba(255,0,0,0.5)` : '0 0 0 transparent'}
          `,
          letterSpacing: '0.15em',
          margin: 0,
          // 글리치 트랜슬레이트 (가끔 떨림)
          transform: Math.random() > 0.8
            ? `translateX(${(Math.random() - 0.5) * 3}px)`
            : 'none',
        }}>
          {glitchText}
        </h1>

        {/* 부제 */}
        <p style={{
          fontFamily: 'monospace',
          fontSize: '14px',
          color: 'rgba(0, 255, 65, 0.5)',
          marginTop: '24px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
        }}>
          {countryName ? 'deploying combat agents' : 'survival protocol initiated'}
        </p>

        {/* 스킵 안내 */}
        <p style={{
          fontFamily: 'monospace',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.2)',
          marginTop: '48px',
        }}>
          press any key to skip
        </p>
      </div>
    </div>
  );
}
