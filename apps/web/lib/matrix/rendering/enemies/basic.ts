/**
 * game/rendering/enemies/basic.ts - 기본 적 렌더링 (최적화 버전)
 *
 * 기본 적 타입: Glitch, Bot, Malware
 *
 * Performance Optimizations:
 * - Date.now() → getFrameTime() (프레임당 1회 호출)
 * - Math.random() → deterministicRandom() (일관된 애니메이션)
 * - shadowBlur → shouldUseShadow() 조건부 (LOD 기반)
 */

import type { EnemyRenderData } from './types';
import {
  getFrameTime,
  shouldUseShadow,
  deterministicRandom,
  getSeedBase,
} from './renderContext';

export const drawGlitch = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const MATRIX_GREEN = '#00FF41';

  // 결정론적 시드 (enemy.id 기반)
  const seed = (enemy.id || 0) + getSeedBase();

  // 글리치 애니메이션 - 결정론적 떨림
  const glitchX = deterministicRandom(seed) > 0.9 ? (deterministicRandom(seed + 1) - 0.5) * 4 : 0;
  const glitchY = deterministicRandom(seed + 2) > 0.9 ? (deterministicRandom(seed + 3) - 0.5) * 2 : 0;
  const flicker = deterministicRandom(seed + 4) > 0.85 ? 0.5 : 1;
  const hover = Math.sin(t / 200) * 2;
  const rotate = Math.sin(t / 400) * 0.1;

  ctx.save();
  ctx.translate(glitchX, glitchY + hover);
  ctx.rotate(rotate);
  ctx.globalAlpha = isHit ? 1 : flicker;

  // === 메인 큐브 바디 (글리치 AI 코어) ===
  const cubeSize = 8;

  // 글로우 이펙트 (LOD HIGH에서만)
  if (shouldUseShadow() && !isHit) {
    ctx.shadowColor = MATRIX_GREEN;
    ctx.shadowBlur = 8;
  }

  // 큐브 몸체
  ctx.fillStyle = isHit ? '#fff' : '#0a0a0a';
  ctx.beginPath();
  ctx.roundRect(-cubeSize, -cubeSize, cubeSize * 2, cubeSize * 2, 2);
  ctx.fill();

  // 테두리 (매트릭스 그린)
  ctx.strokeStyle = isHit ? '#fff' : MATRIX_GREEN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-cubeSize, -cubeSize, cubeSize * 2, cubeSize * 2, 2);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // === 글리치 라인들 (결정론적) ===
  if (!isHit && deterministicRandom(seed + 5) > 0.7) {
    ctx.fillStyle = MATRIX_GREEN;
    ctx.globalAlpha = 0.6;
    const lineY = (deterministicRandom(seed + 6) - 0.5) * cubeSize * 1.5;
    ctx.fillRect(-cubeSize + 1, lineY, cubeSize * 2 - 2, 1);
    ctx.globalAlpha = 1;
  }

  // === 눈 (LED 디스플레이) ===
  const eyeFlicker = Math.floor(t / 100) % 2 === 0;
  ctx.fillStyle = isHit ? '#fff' : (eyeFlicker ? MATRIX_GREEN : '#00cc33');

  // 왼쪽 눈 (사각 픽셀)
  ctx.fillRect(-5, -3, 3, 3);

  // 오른쪽 눈 (결정론적 깜빡임)
  if (deterministicRandom(seed + 7) > 0.1) {
    ctx.fillRect(2, -3, 3, 3);
  }

  // === 입 (에러 메시지 디스플레이) ===
  ctx.fillStyle = isHit ? '#fff' : '#ff0000';
  ctx.fillRect(-4, 3, 2, 1);
  ctx.fillRect(-1, 3, 2, 1);
  ctx.fillRect(2, 3, 2, 1);

  // === 떠다니는 데이터 비트 (결정론적) ===
  if (!isHit) {
    ctx.fillStyle = MATRIX_GREEN;
    ctx.globalAlpha = 0.7;
    const bitY = Math.sin(t / 150) * 3;
    ctx.font = '6px monospace';
    ctx.fillText(deterministicRandom(seed + 8) > 0.5 ? '0' : '1', -cubeSize - 4, bitY);
    ctx.fillText(deterministicRandom(seed + 9) > 0.5 ? '0' : '1', cubeSize + 1, -bitY);
    ctx.globalAlpha = 1;
  }

  // === 안테나 (신호 수신) ===
  ctx.strokeStyle = isHit ? '#fff' : MATRIX_GREEN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -cubeSize);
  ctx.lineTo(0, -cubeSize - 4);
  ctx.stroke();

  // 안테나 끝 점멸
  if (Math.floor(t / 200) % 2 === 0) {
    ctx.fillStyle = isHit ? '#fff' : '#ff0000';
    ctx.beginPath();
    ctx.arc(0, -cubeSize - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

export const drawBot = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const ASSISTANT_BLUE = '#3b82f6';
  const DARK_BLUE = '#1e3a8a';

  // 부드러운 호버링 애니메이션
  const hover = Math.sin(t / 300) * 3;
  const pulse = Math.sin(t / 500) * 0.05;
  const tilt = Math.sin(t / 600) * 0.05;

  ctx.save();
  ctx.translate(0, hover);
  ctx.rotate(tilt);

  // === 그림자 ===
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 12 - hover * 0.5, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 메인 바디 (말풍선 형태) ===
  if (shouldUseShadow() && !isHit) {
    ctx.shadowColor = ASSISTANT_BLUE;
    ctx.shadowBlur = 10;
  }

  // 말풍선 몸체
  ctx.fillStyle = isHit ? '#fff' : ASSISTANT_BLUE;
  ctx.beginPath();
  ctx.ellipse(0, -2, 12 + pulse * 10, 10 + pulse * 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 말풍선 꼬리
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.quadraticCurveTo(-12, 10, -10, 14);
  ctx.quadraticCurveTo(-6, 12, -6, 8);
  ctx.fill();

  ctx.shadowBlur = 0;

  // === 내부 화면 (디스플레이) ===
  ctx.fillStyle = isHit ? '#fff' : '#1e293b';
  ctx.beginPath();
  ctx.ellipse(0, -2, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 눈 (LED 점) ===
  const blink = Math.floor(t / 3000) % 10 === 0 ? 0.5 : 2;
  ctx.fillStyle = isHit ? '#fff' : '#60a5fa';

  // 왼쪽 눈
  ctx.beginPath();
  ctx.ellipse(-4, -3, 2, blink, 0, 0, Math.PI * 2);
  ctx.fill();

  // 오른쪽 눈
  ctx.beginPath();
  ctx.ellipse(4, -3, 2, blink, 0, 0, Math.PI * 2);
  ctx.fill();

  // === 타이핑 인디케이터 (입) ===
  const dot1 = Math.sin(t / 200) > 0;
  const dot2 = Math.sin(t / 200 + 1) > 0;
  const dot3 = Math.sin(t / 200 + 2) > 0;

  ctx.fillStyle = isHit ? '#fff' : '#94a3b8';
  if (dot1) ctx.fillRect(-4, 2, 2, 2);
  if (dot2) ctx.fillRect(-1, 2, 2, 2);
  if (dot3) ctx.fillRect(2, 2, 2, 2);

  // === 안테나 ===
  ctx.strokeStyle = isHit ? '#fff' : ASSISTANT_BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, -16);
  ctx.stroke();

  // 안테나 끝 원
  ctx.fillStyle = isHit ? '#fff' : '#60a5fa';
  ctx.beginPath();
  ctx.arc(0, -18, 3, 0, Math.PI * 2);
  ctx.fill();

  // 안테나 신호 링
  if (!isHit && Math.floor(t / 500) % 2 === 0) {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -18, 5 + Math.sin(t / 100) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // === 팔 (작은 로봇 팔) ===
  const armWave = Math.sin(t / 400) * 0.3;

  // 왼팔
  ctx.fillStyle = isHit ? '#fff' : DARK_BLUE;
  ctx.save();
  ctx.translate(-11, -2);
  ctx.rotate(armWave);
  ctx.beginPath();
  ctx.roundRect(-2, 0, 4, 8, 2);
  ctx.fill();
  // 손
  ctx.fillStyle = isHit ? '#fff' : '#60a5fa';
  ctx.beginPath();
  ctx.arc(0, 10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 오른팔
  ctx.fillStyle = isHit ? '#fff' : DARK_BLUE;
  ctx.save();
  ctx.translate(11, -2);
  ctx.rotate(-armWave);
  ctx.beginPath();
  ctx.roundRect(-2, 0, 4, 8, 2);
  ctx.fill();
  ctx.fillStyle = isHit ? '#fff' : '#60a5fa';
  ctx.beginPath();
  ctx.arc(0, 10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
};

export const drawMalware = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const VIRUS_RED = '#dc2626';
  const DARK_RED = '#7f1d1d';
  const GLOW_RED = '#ef4444';

  // 공격적 움직임 - 빠른 진동
  const rage = Math.sin(t / 50) * 2;
  const pulse = Math.sin(t / 100) * 0.15;
  const spin = (t / 500) % (Math.PI * 2);

  ctx.save();
  ctx.translate(rage * 0.3, rage * 0.2);

  // === 글로우 이펙트 (LOD HIGH에서만) ===
  if (shouldUseShadow() && !isHit) {
    ctx.shadowColor = GLOW_RED;
    ctx.shadowBlur = 15;
  }

  // === 외부 스파이크 링 (회전) ===
  ctx.save();
  ctx.rotate(spin);
  ctx.strokeStyle = isHit ? '#fff' : VIRUS_RED;
  ctx.lineWidth = 2;

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spikeLen = 6 + Math.sin(t / 100 + i) * 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-2, -10 - spikeLen);
    ctx.lineTo(0, -12 - spikeLen);
    ctx.lineTo(2, -10 - spikeLen);
    ctx.closePath();
    ctx.fillStyle = isHit ? '#fff' : DARK_RED;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // === 메인 바디 (육각형 바이러스 코어) ===
  ctx.fillStyle = isHit ? '#fff' : DARK_RED;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const r = 10 + pulse * 5;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // 테두리
  ctx.strokeStyle = isHit ? '#fff' : VIRUS_RED;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // === 내부 코어 (맥동하는 핵) ===
  ctx.fillStyle = isHit ? '#fff' : GLOW_RED;
  ctx.beginPath();
  ctx.arc(0, 0, 5 + pulse * 3, 0, Math.PI * 2);
  ctx.fill();

  // 코어 내부 패턴
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(-2, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // === 눈 (위협적인 X 표시) ===
  ctx.strokeStyle = isHit ? '#fff' : '#000';
  ctx.lineWidth = 2;

  // 왼쪽 X
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-3, -1);
  ctx.moveTo(-3, -4);
  ctx.lineTo(-6, -1);
  ctx.stroke();

  // 오른쪽 X
  ctx.beginPath();
  ctx.moveTo(3, -4);
  ctx.lineTo(6, -1);
  ctx.moveTo(6, -4);
  ctx.lineTo(3, -1);
  ctx.stroke();

  // === 입 (위협적인 지그재그) ===
  ctx.strokeStyle = isHit ? '#fff' : '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, 3);
  ctx.lineTo(-2, 5);
  ctx.lineTo(0, 3);
  ctx.lineTo(2, 5);
  ctx.lineTo(4, 3);
  ctx.stroke();

  // === 데이터 침투 파티클 ===
  if (!isHit) {
    ctx.fillStyle = VIRUS_RED;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 4; i++) {
      const particleAngle = (t / 200 + i * Math.PI / 2) % (Math.PI * 2);
      const particleDist = 15 + Math.sin(t / 100 + i) * 3;
      const px = Math.cos(particleAngle) * particleDist;
      const py = Math.sin(particleAngle) * particleDist;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // === 경고 표시 (깜빡임) ===
  if (!isHit && Math.floor(t / 200) % 2 === 0) {
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('!', -2, -14);
  }

  ctx.restore();
};
