'use client';

/**
 * MatrixCanvas — v28 Matrix 자동전투 서바이벌 게임 캔버스
 * Phase 0 stub: 게임 루프 + 렌더링은 Phase 4에서 구현
 */

import { useRef, useEffect, useCallback } from 'react';

interface MatrixCanvasProps {
  onExit: () => void;
}

export function MatrixCanvas({ onExit }: MatrixCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ESC 키 → 로비 복귀
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // 캔버스 리사이즈
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Phase 0 임시 렌더링 — "Matrix Loading" 표시
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00FF41';
    ctx.font = '32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('THE MATRIX', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#00CC33';
    ctx.fillText('Engine loading... (Phase 4)', canvas.width / 2, canvas.height / 2 + 20);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#666666';
    ctx.fillText('Press ESC to exit', canvas.width / 2, canvas.height / 2 + 60);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
      }}
    />
  );
}
