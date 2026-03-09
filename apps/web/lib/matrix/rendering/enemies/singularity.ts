/**
 * game/rendering/enemies/singularity.ts - 한계돌파 모드 적 렌더링 (최적화됨)
 * 
 * Era 1 (Genesis): Bitling, Spammer
 * Era 2 (Infection): Crypter, Ransomer, Pixel, Bug
 * Era 3 (Mutation): Worm, Adware, Mutant, Polymorphic
 * Era 4 (Pandemic): Trojan, Botnet
 * Era 5 (Apocalypse): Rootkit, APT
 * Era 6 (Singularity): Zeroday, Skynet
 * 
 * 최적화: Date.now() → getFrameTime(), Math.random() → deterministicRandom(), shadowBlur 조건부
 */

import type { EnemyRenderData } from './types';
import { getFrameTime, shouldUseShadow, deterministicRandom, getSeedBase } from './renderContext';

export const drawBitling = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  // 비트 플리커 애니메이션 (결정론적)
  const flicker = deterministicRandom(seed) > 0.9 ? (deterministicRandom(seed + 1) - 0.5) * 4 : 0;
  const pulse = Math.sin(t / 100) * 1;
  const rotate = Math.sin(t / 300) * 0.1;

  ctx.save();
  ctx.translate(flicker, 0);
  ctx.rotate(rotate);

  // === 그림자 ===
  ctx.fillStyle = 'rgba(0, 255, 65, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 메인 큐브 바디 ===
  const size = 8 + pulse;
  ctx.fillStyle = isHit ? '#fff' : '#0d1117';
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, 2);
  ctx.fill();

  // 테두리 글로우
  ctx.strokeStyle = isHit ? '#fff' : '#00FF41';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // === 0/1 디스플레이 ===
  if (!isHit) {
    const bitValue = Math.floor(t / 200) % 2;
    ctx.fillStyle = '#00FF41';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bitValue.toString(), 0, 0);
  }

  // === 코너 LED ===
  if (!isHit) {
    ctx.fillStyle = Math.floor(t / 150) % 2 === 0 ? '#00FF41' : '#0d1117';
    ctx.beginPath();
    ctx.arc(-size / 2 + 2, -size / 2 + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size / 2 - 2, -size / 2 + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // === 데이터 트레일 ===
  if (!isHit) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#00FF41';
    ctx.font = '4px monospace';
    for (let i = 0; i < 3; i++) {
      const trailY = size / 2 + 3 + i * 4;
      ctx.fillText(Math.floor(t / 100 + i) % 2 === 0 ? '0' : '1', 0, trailY);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawSpammer = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const pulse = Math.sin(t / 100) * 2;
  const shake = Math.sin(t / 40) * 1.5;
  const messageFloat = (t / 60) % 30;

  ctx.save();
  ctx.translate(shake, 0);

  // === 그림자 ===
  ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 메인 바디 (메일 서버) ===
  ctx.fillStyle = isHit ? '#fff' : '#1e3a8a';
  ctx.beginPath();
  ctx.roundRect(-8, -8, 16, 14, 3);
  ctx.fill();

  // 서버 라인
  if (!isHit) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-6, -5 + i * 4);
      ctx.lineTo(6, -5 + i * 4);
      ctx.stroke();
    }
  }

  // === 봉투 헤드 ===
  ctx.fillStyle = isHit ? '#fff' : '#60a5fa';
  ctx.beginPath();
  ctx.moveTo(-7, -10);
  ctx.lineTo(0, -15);
  ctx.lineTo(7, -10);
  ctx.closePath();
  ctx.fill();

  // 봉투 라인
  if (!isHit) {
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -11);
    ctx.lineTo(0, -8);
    ctx.lineTo(5, -11);
    ctx.stroke();
  }

  // === LED 상태등 ===
  if (!isHit) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = Math.floor(t / 80 + i * 50) % 3 === 0 ? '#22c55e' : '#1e3a8a';
      ctx.beginPath();
      ctx.arc(-5 + i * 3.5, 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === 스팸 메시지 발사 ===
  if (!isHit) {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) {
      const msgX = 10 + (messageFloat + i * 8) % 25;
      const msgY = -12 + i * 5 + Math.sin(t / 100 + i) * 2;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(msgX - 3, msgY - 2, 6, 4, 1);
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.moveTo(msgX - 2, msgY - 1);
      ctx.lineTo(msgX, msgY + 1);
      ctx.lineTo(msgX + 2, msgY - 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // === 눈 (이모티콘 스타일) ===
  if (!isHit) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('>_<', 0, -2);
  }

  // === SPAM 텍스트 ===
  if (!isHit) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPAM', 0, 12);
  }

  ctx.restore();
};

export const drawCrypter = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const pulse = Math.sin(t / 150) * 2;
  const lockRotate = Math.sin(t / 200) * 0.1;
  const encryptPhase = (t / 100) % 100;

  ctx.save();
  ctx.rotate(lockRotate);

  // === 그림자 ===
  ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 자물쇠 바디 ===
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.roundRect(-10, -4, 20, 16, 3);
  ctx.fill();

  ctx.strokeStyle = isHit ? '#fff' : '#22c55e';
  ctx.lineWidth = 2;
  ctx.stroke();

  // === 자물쇠 고리 ===
  ctx.strokeStyle = isHit ? '#fff' : '#4b5563';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -8, 8, Math.PI, 0);
  ctx.stroke();

  if (!isHit) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -8, 8, Math.PI * 0.8, Math.PI * 0.2);
    ctx.stroke();
  }

  // === 키홀 ===
  if (!isHit) {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, 4);
    ctx.lineTo(0, 10);
    ctx.lineTo(2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // === 암호화 진행 바 ===
  if (!isHit) {
    ctx.fillStyle = '#374151';
    ctx.fillRect(-8, -2, 16, 3);
    ctx.fillStyle = '#22c55e';
    const progress = (encryptPhase / 100) * 16;
    ctx.fillRect(-8, -2, progress, 3);
  }

  // === 암호 텍스트 플로팅 ===
  if (!isHit) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#22c55e';
    ctx.font = '5px monospace';
    const cryptChars = ['#', '$', '%', '@', '&', '*'];
    for (let i = 0; i < 6; i++) {
      const cx = Math.sin(t / 80 + i * 1.2) * 15;
      const cy = -18 - i * 3 + (t / 50 + i * 10) % 15;
      ctx.fillText(cryptChars[i], cx, cy);
    }
    ctx.globalAlpha = 1;
  }

  // === LOCKED 텍스트 ===
  if (!isHit) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED', 0, 16);
  }

  ctx.restore();
};

export const drawRansomer = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const pulse = Math.sin(t / 100) * 2;
  const shake = deterministicRandom(seed) > 0.95 ? (deterministicRandom(seed + 1) - 0.5) * 3 : 0;
  const timerBlink = Math.floor(t / 300) % 2 === 0;

  ctx.save();
  ctx.translate(shake, 0);

  // === 그림자 ===
  ctx.fillStyle = 'rgba(234, 179, 8, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 경고 팝업 바디 ===
  ctx.fillStyle = isHit ? '#fff' : '#7f1d1d';
  ctx.beginPath();
  ctx.roundRect(-12, -10, 24, 22, 3);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#dc2626';
  ctx.fillRect(-12, -10, 24, 6);

  // X 버튼
  if (!isHit) {
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.roundRect(8, -9, 3, 4, 1);
    ctx.fill();
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, -8);
    ctx.lineTo(10, -6);
    ctx.moveTo(10, -8);
    ctx.lineTo(9, -6);
    ctx.stroke();
  }

  // === 달러 심볼 ===
  if (!isHit) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
  }

  // === 타이머 카운트다운 ===
  if (!isHit) {
    ctx.fillStyle = timerBlink ? '#ef4444' : '#fbbf24';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    const hours = Math.floor((t / 1000) % 24);
    const mins = Math.floor((t / 1000) % 60);
    ctx.fillText(`${String(23 - hours).padStart(2, '0')}:${String(59 - mins).padStart(2, '0')}`, 0, 10);
  }

  // === 비트코인 요구 ===
  if (!isHit) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAY 0.5 BTC', 0, -5);
  }

  // === 파일 아이콘들 ===
  if (!isHit) {
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      const fx = -15 + Math.sin(t / 150 + i * 2) * 3;
      const fy = -8 + i * 8 + Math.cos(t / 200 + i) * 2;
      ctx.fillStyle = '#374151';
      ctx.fillRect(fx - 3, fy - 4, 6, 8);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // === 경고 느낌표 ===
  if (!isHit && timerBlink) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-10, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.font = 'bold 4px monospace';
    ctx.fillText('!', -12, -13);
  }

  ctx.restore();
};

export const drawPixel = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const glitch = Math.sin(t / 80) * 2;
  const scanline = (t / 30) % 20;
  const pixelColors = ['#00FF41', '#3b82f6', '#ef4444', '#fbbf24'];

  ctx.save();

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const cellSeed = seed + i * 10 + j;
      const shouldRender = deterministicRandom(cellSeed) > 0.15;
      if (shouldRender) {
        const rgbOffset = deterministicRandom(cellSeed + 100) > 0.8 ? 1 : 0;
        ctx.fillStyle = isHit ? '#fff' : pixelColors[(i + j + Math.floor(t / 200)) % 4];
        ctx.fillRect(-6 + i * 3 + rgbOffset, -6 + j * 3, 3, 3);

        if (rgbOffset > 0 && !isHit) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.fillRect(-6 + i * 3 - 1, -6 + j * 3, 3, 3);
        }
      }
    }
  }

  if (!isHit) {
    ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
    ctx.fillRect(-8, -8 + scanline, 16, 2);
  }

  ctx.strokeStyle = isHit ? '#fff' : '#00FF41';
  ctx.lineWidth = 1;
  ctx.strokeRect(-7, -7, 14, 14);

  ctx.restore();
};

export const drawBug = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const crawl = Math.sin(t / 100) * 0.1;
  const legMove = Math.sin(t / 50) * 3;

  ctx.save();
  ctx.rotate(crawl);

  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#ef4444';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ERR', 0, -2);
    ctx.fillText('404', 0, 3);
  }

  ctx.strokeStyle = isHit ? '#fff' : '#ef4444';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const y = -4 + i * 4;
    const move = Math.sin(t / 50 + i * 2) * 2;
    ctx.beginPath();
    ctx.moveTo(-5, y);
    ctx.lineTo(-9, y + move);
    ctx.lineTo(-11, y - 1 + move);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, y);
    ctx.lineTo(9, y - move);
    ctx.lineTo(11, y - 1 - move);
    ctx.stroke();
  }

  ctx.strokeStyle = isHit ? '#fff' : '#fbbf24';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -9);
  ctx.lineTo(-4, -14 + Math.sin(t / 80) * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, -9);
  ctx.lineTo(4, -14 + Math.sin(t / 80 + 1) * 2);
  ctx.stroke();

  if (!isHit) {
    ctx.fillStyle = Math.floor(t / 150) % 2 === 0 ? '#ef4444' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(-4, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -14, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

export const drawWorm = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const wave = Math.sin(t / 150) * 3;

  ctx.save();

  const segmentColor = isHit ? '#fff' : '#06b6d4';
  for (let i = 0; i < 5; i++) {
    const size = 5 - i * 0.5;
    const x = wave * Math.sin(i * 0.5);
    const y = -10 + i * 5;

    ctx.fillStyle = isHit ? '#fff' : '#0d1117';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = segmentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (i < 4) {
      const nextX = wave * Math.sin((i + 1) * 0.5);
      const nextY = -10 + (i + 1) * 5;
      ctx.strokeStyle = isHit ? '#fff' : 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(nextX, nextY - (5 - (i + 1) * 0.5));
      ctx.stroke();
    }
  }

  const headX = wave * Math.sin(-0.5);
  ctx.fillStyle = isHit ? '#fff' : '#06b6d4';
  ctx.beginPath();
  ctx.arc(headX, -12, 6, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(headX, -12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(headX, -12, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isHit) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#06b6d4';
    for (let i = 0; i < 3; i++) {
      const px = headX + Math.sin(t / 80 + i * 2) * 10;
      const py = -15 - i * 3 + Math.cos(t / 100 + i) * 2;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawAdware = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const bounce = Math.sin(t / 100) * 2;
  const annoying = Math.floor(t / 200) % 2 === 0;

  ctx.save();
  ctx.translate(0, bounce);

  ctx.fillStyle = isHit ? '#fff' : '#f3f4f6';
  ctx.beginPath();
  ctx.roundRect(-12, -10, 24, 22, 3);
  ctx.fill();

  ctx.strokeStyle = isHit ? '#fff' : '#9ca3af';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isHit ? '#fff' : '#e5e7eb';
  ctx.fillRect(-12, -10, 24, 5);

  if (!isHit) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(8, -9, 3, 3, 1);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(9, -8);
    ctx.lineTo(10, -7);
    ctx.moveTo(10, -8);
    ctx.lineTo(9, -7);
    ctx.stroke();
  }

  if (!isHit) {
    ctx.fillStyle = annoying ? '#ef4444' : '#22c55e';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU WIN!', 0, -1);

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.roundRect(-8, 2, 16, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '4px sans-serif';
    ctx.fillText('CLAIM NOW', 0, 6);

    if (annoying) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '6px sans-serif';
      ctx.fillText('***', -10, 0);
      ctx.fillText('***', 10, 0);
    }
  }

  ctx.fillStyle = isHit ? '#fff' : '#d1d5db';
  ctx.fillRect(-10, 12, 6, 4);
  ctx.fillRect(4, 12, 6, 4);

  if (!isHit) {
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 3; i++) {
      const px = Math.sin(t / 100 + i * 2) * 18;
      const py = -8 + i * 6 + Math.cos(t / 150 + i) * 3;
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(px - 4, py - 3, 8, 6);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 4, py - 3, 8, 6);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawMutant = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const glitch = Math.sin(t / 80) * 0.1;
  const pulse1 = Math.sin(t / 100) * 2;
  const pulse2 = Math.sin(t / 120 + 1) * 2;

  ctx.save();
  ctx.rotate(glitch);

  ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.ellipse(-1, 0, 8, 10, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isHit ? '#fff' : '#a855f7';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.beginPath();
  ctx.ellipse(7, -3, 5, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isHit ? '#fff' : '#c084fc';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!isHit) {
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(-10 + pulse1, -8);
    ctx.lineTo(-8, -12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -8);
    ctx.lineTo(10 + pulse2, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 6);
    ctx.lineTo(-8, 10 + pulse1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 6);
    ctx.lineTo(10, 8 + pulse2);
    ctx.stroke();
  }

  if (!isHit) {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(-3, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(-3, -2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isHit) {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(7, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(7, -4, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isHit) {
    ctx.fillStyle = '#ef4444';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ERR', -2, 5);
    ctx.fillText('MUT', 7, 2);
  }

  if (!isHit) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#a855f7';
    for (let i = 0; i < 4; i++) {
      const px = Math.sin(t / 60 + i * 1.5) * 12;
      const py = Math.cos(t / 80 + i * 1.5) * 10;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawPolymorphic = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const morph = Math.floor(t / 300) % 3;
  const transition = (t % 300) / 300;

  ctx.save();

  const morphColors = ['#22c55e', '#3b82f6', '#ef4444'];
  const currentColor = isHit ? '#fff' : morphColors[morph];

  ctx.fillStyle = `rgba(${morph === 0 ? '34,197,94' : morph === 1 ? '59,130,246' : '239,68,68'}, 0.25)`;
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (morph === 0) {
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -2, 7, 0, Math.PI * 2);
    ctx.fill();

    if (!isHit) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#86efac';
      ctx.font = '4px monospace';
      for (let i = 0; i < 3; i++) {
        ctx.fillText('01', -6 + i * 4, -3 + Math.sin(t / 100 + i) * 2);
      }
      ctx.globalAlpha = 1;
    }
  } else if (morph === 1) {
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isHit ? '#fff' : '#1d4ed8';
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-2, -14);
      ctx.lineTo(2, -14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else {
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.roundRect(-7, -7, 14, 14, 2);
    ctx.fill();

    if (!isHit) {
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, 4);
      ctx.moveTo(4, -4);
      ctx.lineTo(-4, 4);
      ctx.stroke();
    }
  }

  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POLY', 0, 1);
  }

  ctx.restore();
};

export const drawTrojan = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const hover = Math.sin(t / 300) * 2;
  const pulse = Math.sin(t / 400) * 0.1 + 1;
  const glitch = deterministicRandom(seed) > 0.92;
  const glitchX = glitch ? (deterministicRandom(seed + 1) - 0.5) * 4 : 0;

  ctx.save();
  ctx.translate(glitchX, hover);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const iconSize = 16 * pulse;
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(-iconSize/2, -iconSize/2 - 2, iconSize, iconSize, 4);
  ctx.fill();

  if (!isHit) {
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (!isHit) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-1.5, -iconSize/2 + 2, 3, iconSize - 4);
    ctx.fillRect(-iconSize/2 + 2, -3, iconSize - 4, 3);
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isHit && Math.sin(t / 500) > 0.3) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(iconSize/2 - 3, -iconSize/2 + 3);
    ctx.lineTo(iconSize/2 - 6, 2);
    ctx.lineTo(iconSize/2 - 2, iconSize/2 - 4);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(iconSize/2 - 4, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(iconSize/2 - 4, 0, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isHit) {
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const angle = (i - 1) * 0.3;
      const wiggle = Math.sin(t / 150 + i) * 0.2;
      ctx.save();
      ctx.translate((i - 1) * 4, iconSize/2);
      ctx.rotate(angle + wiggle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2, 6, 0, 10 + Math.sin(t / 200 + i) * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (!isHit) {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(iconSize/2 - 2, -iconSize/2 + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FREE', iconSize/2 - 2, -iconSize/2 + 4);
  }

  if (glitch && !isHit) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-iconSize/2 + 2, -2, iconSize - 4, 3);
  }

  ctx.restore();
};

export const drawBotnet = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const botCount = 5;
  const t = getFrameTime();

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const botPositions: {x: number, y: number}[] = [];
  for (let i = 0; i < botCount; i++) {
    const angle = (Math.PI * 2 * i) / botCount + t / 1200;
    const dist = 10 + Math.sin(t / 300 + i) * 2;
    botPositions.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.5
    });
  }

  if (!isHit) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const dashOffset = (t / 50) % 6;
    ctx.lineDashOffset = -dashOffset;

    for (const pos of botPositions) {
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  for (let i = 0; i < botCount; i++) {
    const pos = botPositions[i];
    const pulse = Math.sin(t / 200 + i * 0.8) * 0.2 + 1;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    const botSize = 5 * pulse;
    ctx.fillStyle = isHit ? '#fff' : '#374151';
    ctx.fillRect(-botSize/2, -botSize/2, botSize, botSize);

    if (!isHit) {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-botSize/2 + 1, -botSize/2 + 1, botSize - 2, botSize * 0.6);

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, -1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!isHit && Math.sin(t / 100 + i * 2) > 0) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(botSize/2 - 1.5, botSize/2 - 1.5, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, -2);

  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-8, -8, 16, 16);

  if (!isHit) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(-7, -7, 14, 14);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const blinkPhase = Math.sin(t / 80 + row * 2 + col * 3) > 0;
        ctx.fillStyle = blinkPhase ? '#dc2626' : '#450a0a';
        ctx.beginPath();
        ctx.arc(-5 + col * 3.5, -4 + row * 4, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('C&C', 0, 7);
  }

  if (!isHit) {
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, -14);
    ctx.stroke();

    const signalPulse = Math.sin(t / 150) * 0.3 + 1;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(0, -14, 2 * signalPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.5)';
    ctx.lineWidth = 1;
    for (let r = 1; r <= 2; r++) {
      const radius = 4 + r * 3 + Math.sin(t / 200) * 2;
      ctx.globalAlpha = 0.5 - r * 0.15;
      ctx.beginPath();
      ctx.arc(0, -14, radius, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawRootkit = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const float = Math.sin(t / 250) * 2;
  const pulse = 0.4 + Math.sin(t / 400) * 0.2;
  const phase = Math.floor(t / 1500) % 3;

  ctx.save();
  ctx.translate(0, float);

  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.globalAlpha = pulse;
  }

  const iconSize = 18;

  if (phase === 0) {
    ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-iconSize/2, -iconSize/2 + 3);
    ctx.lineTo(-iconSize/2 + 6, -iconSize/2 + 3);
    ctx.lineTo(-iconSize/2 + 8, -iconSize/2);
    ctx.lineTo(iconSize/2, -iconSize/2);
    ctx.lineTo(iconSize/2, iconSize/2 - 3);
    ctx.lineTo(-iconSize/2, iconSize/2 - 3);
    ctx.closePath();
    ctx.fill();
  } else if (phase === 1) {
    ctx.fillStyle = isHit ? '#fff' : '#6b7280';
    ctx.fillRect(-iconSize/2, -iconSize/2, iconSize, iconSize);
    if (!isHit) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(-iconSize/2 + 2, -iconSize/2 + 2, iconSize - 4, 4);
      ctx.fillRect(-iconSize/2 + 2, -iconSize/2 + 8, iconSize - 4, 2);
      ctx.fillRect(-iconSize/2 + 2, -iconSize/2 + 12, iconSize * 0.6, 2);
    }
  } else {
    ctx.fillStyle = isHit ? '#fff' : '#9ca3af';
    const gearSize = 8;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const r1 = gearSize;
      const r2 = gearSize * 0.6;
      ctx.lineTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
      ctx.lineTo(Math.cos(angle + Math.PI/8) * r2, Math.sin(angle + Math.PI/8) * r2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = isHit ? '#eee' : '#6b7280';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  if (!isHit && Math.sin(t / 300) > 0.5) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + t / 500;
      const wiggle = Math.sin(t / 100 + i) * 0.3;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(iconSize/2, 0);
      ctx.quadraticCurveTo(
        iconSize/2 + 5 + Math.sin(t/150 + i) * 3,
        wiggle * 10,
        iconSize/2 + 8,
        Math.sin(t/120 + i) * 5
      );
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 숨겨진 붉은 눈 - shouldUseShadow() 조건부
  if (!isHit && deterministicRandom(seed) > 0.85) {
    ctx.fillStyle = '#dc2626';
    if (shouldUseShadow()) {
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(-3, -2, 2, 0, Math.PI * 2);
    ctx.arc(3, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (!isHit && Math.sin(t / 800) > 0.8) {
    ctx.fillStyle = 'rgba(220, 38, 38, 0.7)';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROOT', 0, iconSize/2 + 8);
  }

  if (!isHit) {
    ctx.strokeStyle = 'rgba(107, 114, 128, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 5;
      const len = 8 + Math.sin(t / 200 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(x, iconSize/2);
      ctx.lineTo(x, iconSize/2 + len);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
};

export const drawApt = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const hover = Math.sin(t / 350) * 2;
  const scanPulse = (t / 100) % 360;
  const alertBlink = Math.sin(t / 150) > 0;

  ctx.save();
  ctx.translate(0, hover);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const size = 14;
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const x = Math.cos(angle) * size;
    const y = Math.sin(angle) * size * 0.7;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  if (!isHit) {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (!isHit) {
    ctx.save();
    ctx.rotate((scanPulse * Math.PI) / 180);

    const gradient = ctx.createLinearGradient(0, 0, 25, 0);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(25, -3);
    ctx.lineTo(25, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.fillStyle = isHit ? '#fff' : '#111827';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#dc2626';
    if (shouldUseShadow()) {
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fca5a5';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-2, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  if (!isHit) {
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 * i) / 3 + Math.PI / 6;
      const mx = Math.cos(angle) * 10;
      const my = Math.sin(angle) * 7;

      ctx.fillStyle = '#374151';
      ctx.fillRect(mx - 3, my - 2, 6, 4);

      ctx.fillStyle = alertBlink ? '#22c55e' : '#166534';
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!isHit) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1;
    const lockSize = 20 + Math.sin(t / 200) * 3;

    ctx.beginPath();
    ctx.moveTo(-lockSize, -lockSize * 0.6 + 5);
    ctx.lineTo(-lockSize, -lockSize * 0.6);
    ctx.lineTo(-lockSize + 5, -lockSize * 0.6);
    ctx.moveTo(lockSize - 5, -lockSize * 0.6);
    ctx.lineTo(lockSize, -lockSize * 0.6);
    ctx.lineTo(lockSize, -lockSize * 0.6 + 5);
    ctx.moveTo(lockSize, lockSize * 0.6 - 5);
    ctx.lineTo(lockSize, lockSize * 0.6);
    ctx.lineTo(lockSize - 5, lockSize * 0.6);
    ctx.moveTo(-lockSize + 5, lockSize * 0.6);
    ctx.lineTo(-lockSize, lockSize * 0.6);
    ctx.lineTo(-lockSize, lockSize * 0.6 - 5);
    ctx.stroke();
  }

  if (!isHit) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('APT', 0, size + 6);
  }

  if (!isHit) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const dashOffset = (t / 30) % 8;
    ctx.lineDashOffset = -dashOffset;

    ctx.beginPath();
    ctx.moveTo(0, -size * 0.7 - 10);
    ctx.lineTo(0, -size * 0.7);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  ctx.restore();
};

export const drawZeroday = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const bs = 1.2;
  const pulse = Math.sin(t / 200) * 0.15 + 1;
  const glitch = deterministicRandom(seed) > 0.9;
  const codeScroll = (t / 50) % 100;

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 14 * bs, 14 * bs, 4 * bs, 0, 0, Math.PI * 2);
  ctx.fill();

  if (glitch) {
    ctx.translate((deterministicRandom(seed + 2) - 0.5) * 5, 0);
  }

  const bodySize = 16 * bs * pulse;

  ctx.strokeStyle = isHit ? '#fff' : '#a855f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const distort = Math.sin(t / 100 + i * 2) * 2;
    const x = Math.cos(angle) * (bodySize + distort);
    const y = Math.sin(angle) * (bodySize * 0.8 + distort);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = isHit ? '#fff' : '#1a1a2e';
  ctx.beginPath();
  ctx.arc(0, 0, bodySize * 0.7, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.save();
    ctx.clip();
    ctx.font = '6px monospace';
    ctx.fillStyle = '#a855f7';
    const codes = ['0x00', 'NULL', 'CVE', '???', 'VULN', '0DAY'];
    for (let i = 0; i < 5; i++) {
      const y = ((codeScroll + i * 20) % 40) - 20;
      ctx.globalAlpha = 0.6 - Math.abs(y) / 40;
      ctx.fillText(codes[i % codes.length], -10, y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  if (!isHit) {
    ctx.fillStyle = '#a855f7';
    if (shouldUseShadow()) {
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 15;
    }
    ctx.font = `bold ${14 * bs}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0);
    ctx.shadowBlur = 0;
  }

  if (!isHit) {
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + t / 1000;
      const wiggle = Math.sin(t / 80 + i) * 3;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(bodySize * 0.7, 0);
      ctx.quadraticCurveTo(
        bodySize + wiggle,
        wiggle,
        bodySize * 1.3 + Math.sin(t / 100 + i) * 3,
        0
      );
      ctx.stroke();

      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(bodySize * 1.3 + Math.sin(t / 100 + i) * 3, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (!isHit) {
    ctx.fillStyle = Math.sin(t / 150) > 0 ? '#dc2626' : '#7f1d1d';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0-DAY', 0, bodySize + 8);
  }

  ctx.strokeStyle = isHit ? 'rgba(255,255,255,0.4)' : 'rgba(168, 85, 247, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const auraSize = bodySize * 1.4 + Math.sin(t / 150) * 3;
  ctx.beginPath();
  ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (glitch && !isHit) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-bodySize + 3, -3, bodySize * 2 - 6, 2);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(-bodySize + 3, 0, bodySize * 2 - 6, 2);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(-bodySize + 3, 3, bodySize * 2 - 6, 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawSkynet = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const bs = 1.5;
  const pulse = Math.sin(t / 300) * 0.1 + 1;
  const rotate = t / 3000;
  const dataFlow = (t / 40) % 20;

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 18 * bs, 20 * bs, 6 * bs, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.save();
    ctx.rotate(rotate);
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * 30 * bs, Math.sin(angle) * 20 * bs);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 30 * bs, Math.sin(angle) * 20 * bs, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = isHit ? '#fff' : '#111827';
  ctx.beginPath();
  ctx.moveTo(0, -20 * bs);
  ctx.lineTo(-18 * bs, 12 * bs);
  ctx.lineTo(18 * bs, 12 * bs);
  ctx.closePath();
  ctx.fill();

  if (!isHit) {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (!isHit) {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = -20 * bs + i * 7 * bs;
      const ratio = i / 5;
      const width = 18 * bs * ratio;
      ctx.beginPath();
      ctx.moveTo(-width, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  if (!isHit) {
    ctx.fillStyle = '#dc2626';
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 6 * bs;
      const yOffset = ((dataFlow + i * 7) % 30) * bs;
      const y = 10 * bs - yOffset;
      if (y > -18 * bs) {
        ctx.globalAlpha = 1 - yOffset / (30 * bs);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  const eyeY = -5 * bs;
  const eyeSize = 10 * bs * pulse;

  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.beginPath();
  ctx.arc(0, eyeY, eyeSize + 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#eee' : '#0a0a0a';
  ctx.beginPath();
  ctx.arc(0, eyeY, eyeSize, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#dc2626';
    if (shouldUseShadow()) {
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 20;
    }
    ctx.beginPath();
    ctx.arc(0, eyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fca5a5';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-eyeSize * 0.25, eyeY - eyeSize * 0.25, eyeSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  if (!isHit) {
    ctx.fillStyle = '#dc2626';
    ctx.font = `bold ${8 * bs}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('SKYNET', 0, 8 * bs);
  }

  if (!isHit) {
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20 * bs);
    ctx.lineTo(0, -28 * bs);
    ctx.stroke();

    ctx.fillStyle = Math.sin(t / 100) > 0 ? '#dc2626' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(0, -28 * bs, 3 * bs, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      const radius = 5 * bs + r * 4 * bs + Math.sin(t / 200) * 2;
      ctx.globalAlpha = 0.5 - r * 0.15;
      ctx.beginPath();
      ctx.arc(0, -28 * bs, radius, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (!isHit) {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-15 * bs, 12 * bs, 30 * bs, 6 * bs);

    for (let i = 0; i < 8; i++) {
      const blink = Math.sin(t / 50 + i * 0.5) > 0;
      ctx.fillStyle = blink ? '#22c55e' : '#166534';
      ctx.beginPath();
      ctx.arc(-12 * bs + i * 3.5 * bs, 15 * bs, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = isHit ? 'rgba(255,255,255,0.3)' : 'rgba(220, 38, 38, 0.2)';
  ctx.lineWidth = 2;
  const auraSize = 28 * bs + Math.sin(t / 200) * 3;
  ctx.beginPath();
  ctx.arc(0, -3 * bs, auraSize, 0, Math.PI * 2);
  ctx.stroke();

  if (!isHit && Math.sin(t / 300) > 0) {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ONLINE', 0, -18 * bs);
  }

  ctx.restore();
};
