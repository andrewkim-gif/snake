/**
 * game/rendering/enemies/special.ts - 특수 적 렌더링 (최적화됨)
 * 
 * 특수 적 타입: Whale(슈퍼컴퓨터), Sniper(스나이퍼 드론), Caster(코드캐스터), Artillery(DDoS봇)
 * 
 * 최적화: Date.now() → getFrameTime(), Math.random() → deterministicRandom(), shadowBlur 조건부
 */

import type { EnemyRenderData } from './types';
import { getFrameTime, shouldUseShadow, deterministicRandom, getSeedBase } from './renderContext';

export const drawWhale = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const SERVER_GRAY = '#374151';
  const DARK_GRAY = '#1f2937';
  const LED_GREEN = '#22c55e';
  const LED_BLUE = '#3b82f6';

  const rumble = Math.sin(t / 500) * 1;
  const pulse = Math.sin(t / 300) * 0.5;
  const fanSpin = (t / 50) % (Math.PI * 2);

  ctx.save();
  ctx.translate(rumble * 0.3, 0);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit && shouldUseShadow()) {
    ctx.shadowColor = LED_BLUE;
    ctx.shadowBlur = 8;
  }

  ctx.fillStyle = isHit ? '#fff' : DARK_GRAY;
  ctx.beginPath();
  ctx.roundRect(-18, -16, 36, 36, 4);
  ctx.fill();

  ctx.strokeStyle = isHit ? '#fff' : SERVER_GRAY;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-18, -16, 36, 36, 4);
  ctx.stroke();

  ctx.shadowBlur = 0;

  for (let i = 0; i < 4; i++) {
    const slotY = -10 + i * 8;
    ctx.fillStyle = isHit ? '#fff' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-14, slotY, 28, 6, 1);
    ctx.fill();

    ctx.strokeStyle = isHit ? '#fff' : SERVER_GRAY;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!isHit) {
      const ledOn = Math.floor(t / (100 + i * 50)) % 3 !== 0;
      ctx.fillStyle = ledOn ? LED_GREEN : '#064e3b';
      ctx.beginPath();
      ctx.arc(-10, slotY + 3, 1.5, 0, Math.PI * 2);
      ctx.fill();

      const activityLed = Math.floor(t / (50 + i * 30)) % 2 === 0;
      ctx.fillStyle = activityLed ? LED_BLUE : '#1e3a8a';
      ctx.beginPath();
      ctx.arc(-6, slotY + 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(10, 0);
  ctx.rotate(fanSpin);

  ctx.strokeStyle = isHit ? '#fff' : SERVER_GRAY;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i / 4) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -4, 1.5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = isHit ? '#fff' : DARK_GRAY;
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = isHit ? '#fff' : '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-14, -14, 12, 8, 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = LED_GREEN;
    ctx.font = '6px monospace';
    ctx.fillText('CPU', -12, -9);

    const barWidth = 8 * (0.5 + Math.sin(t / 200) * 0.3);
    ctx.fillStyle = LED_GREEN;
    ctx.fillRect(-12, -7, barWidth, 2);
  }

  ctx.strokeStyle = isHit ? '#fff' : '#0ea5e9';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-12, 20);
  ctx.quadraticCurveTo(-15, 25, -10, 28);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(12, 20);
  ctx.quadraticCurveTo(15, 25, 10, 28);
  ctx.stroke();

  const powerOn = Math.floor(t / 1000) % 5 !== 0;
  ctx.fillStyle = isHit ? '#fff' : (powerOn ? '#22c55e' : '#064e3b');
  ctx.beginPath();
  ctx.arc(14, -12, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : SERVER_GRAY;
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(-2 + i * 4, -20, 2, 4);
  }

  if (!isHit) {
    ctx.fillStyle = LED_BLUE;
    ctx.globalAlpha = 0.6;
    const dataY = (t / 100) % 30 - 15;
    ctx.fillRect(-1, dataY, 2, 3);
    ctx.globalAlpha = 1;
  }

  if (!isHit && Math.floor(t / 300) % 3 === 0) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1;
    const heatY = Math.sin(t / 100) * 3;
    ctx.beginPath();
    ctx.moveTo(-5, -18 + heatY);
    ctx.quadraticCurveTo(-3, -22 + heatY, -5, -25 + heatY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -18 + heatY);
    ctx.quadraticCurveTo(7, -22 + heatY, 5, -25 + heatY);
    ctx.stroke();
  }

  ctx.restore();
};

export const drawSniper = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const SPAM_PURPLE = '#7c3aed';
  const DARK_PURPLE = '#4c1d95';
  const ENVELOPE_WHITE = '#f5f3ff';

  const charge = enemy.attackCooldown !== undefined ? Math.max(0, 1.0 - enemy.attackCooldown) : 0;
  const isCharging = enemy.attackCooldown !== undefined && enemy.attackCooldown < 1.0;
  const hover = Math.sin(t / 300) * 2;
  const tilt = Math.sin(t / 400) * 0.05;

  ctx.save();
  ctx.translate(0, hover);
  ctx.rotate(tilt);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 14 - hover * 0.5, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit && shouldUseShadow()) {
    ctx.shadowColor = SPAM_PURPLE;
    ctx.shadowBlur = 10;
  }

  ctx.fillStyle = isHit ? '#fff' : ENVELOPE_WHITE;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(12, -8);
  ctx.lineTo(12, 8);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = isHit ? '#fff' : SPAM_PURPLE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isHit ? '#fff' : SPAM_PURPLE;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(0, 2);
  ctx.lineTo(12, -8);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  if (!isHit) {
    ctx.fillStyle = DARK_PURPLE;
    ctx.font = 'bold 6px monospace';
    ctx.fillText('SPAM', -10, 5);
  }

  ctx.fillStyle = isHit ? '#fff' : SPAM_PURPLE;
  ctx.beginPath();
  ctx.arc(0, -14, 6, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('@', -3, -11);
  }

  const armAngle = isCharging ? -Math.PI / 3 - charge * 0.6 : 0.2;

  ctx.save();
  ctx.translate(10, -4);
  ctx.rotate(armAngle);

  ctx.fillStyle = isHit ? '#fff' : DARK_PURPLE;
  ctx.beginPath();
  ctx.roundRect(-2, 0, 4, 12, 2);
  ctx.fill();

  if (isCharging || Math.floor(t / 400) % 2 === 0) {
    ctx.fillStyle = isHit ? '#fff' : ENVELOPE_WHITE;
    ctx.save();
    ctx.translate(0, 14);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.roundRect(-4, -2, 8, 6, 1);
    ctx.fill();
    ctx.strokeStyle = isHit ? '#fff' : SPAM_PURPLE;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!isHit) {
      ctx.fillStyle = SPAM_PURPLE;
      ctx.font = '4px monospace';
      ctx.fillText('@', -2, 2);
    }
    ctx.restore();
  }
  ctx.restore();

  ctx.fillStyle = isHit ? '#fff' : DARK_PURPLE;
  ctx.save();
  ctx.translate(-10, -4);
  ctx.rotate(-0.3);
  ctx.beginPath();
  ctx.roundRect(-2, 0, 4, 10, 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = isHit ? '#fff' : DARK_PURPLE;
  ctx.beginPath();
  ctx.roundRect(-6, 8, 4, 8, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(2, 8, 4, 8, 2);
  ctx.fill();

  if (!isHit && isCharging) {
    ctx.strokeStyle = SPAM_PURPLE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5 + charge * 0.5;
    for (let i = 0; i < 3; i++) {
      const ringSize = 8 + i * 4 + charge * 5;
      ctx.beginPath();
      ctx.arc(12, -4, ringSize, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (!isHit) {
    ctx.fillStyle = SPAM_PURPLE;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      const particleX = Math.sin(t / 200 + i * 2) * 15;
      const particleY = Math.cos(t / 300 + i) * 8;
      ctx.font = '5px monospace';
      ctx.fillText('@', particleX - 2, particleY);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};

export const drawCaster = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const PHISHING_PINK = '#ec4899';
  const DARK_PINK = '#9d174d';
  const HOOK_GOLD = '#fbbf24';

  const isCharging = enemy.attackCooldown !== undefined && enemy.attackCooldown < 1.5;
  const castSwing = isCharging ? Math.sin(t / 100) * 0.5 : Math.sin(t / 500) * 0.1;
  const hover = Math.sin(t / 350) * 2;
  const lineWave = Math.sin(t / 150) * 3;

  ctx.save();
  ctx.translate(0, hover);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 16 - hover * 0.5, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit && shouldUseShadow()) {
    ctx.shadowColor = PHISHING_PINK;
    ctx.shadowBlur = 10;
  }

  ctx.fillStyle = isHit ? '#fff' : PHISHING_PINK;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-16, -5);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-16, 5);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.roundRect(-6, -4, 12, 8, 1);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(-5, -3, 10, 2);
    ctx.fillRect(-5, 0, 10, 2);

    ctx.fillStyle = PHISHING_PINK;
    ctx.fillRect(-4, 3, 8, 2);

    ctx.fillStyle = DARK_PINK;
    ctx.font = '3px monospace';
    ctx.fillText('LOGIN', -3, 4.5);
  }

  ctx.fillStyle = isHit ? '#fff' : DARK_PINK;
  ctx.beginPath();
  ctx.ellipse(8, -2, 5, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.ellipse(9, -3, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#000';
  ctx.beginPath();
  ctx.arc(10, -3, 1.2, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = HOOK_GOLD;
    ctx.font = 'bold 4px monospace';
    ctx.fillText('$', 9, -2);
  }

  ctx.strokeStyle = isHit ? '#fff' : '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(10, 0, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.save();
  ctx.translate(6, -6);
  ctx.rotate(castSwing);

  ctx.strokeStyle = isHit ? '#fff' : DARK_PINK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(5, -10, 2, -18);
  ctx.stroke();

  ctx.strokeStyle = isHit ? '#fff' : '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, -18);
  ctx.quadraticCurveTo(4 + lineWave, -12, 6, -8 + Math.abs(lineWave));
  ctx.stroke();

  if (!isHit && shouldUseShadow()) {
    ctx.shadowColor = HOOK_GOLD;
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = isHit ? '#fff' : HOOK_GOLD;
  ctx.beginPath();
  ctx.arc(6, -8 + Math.abs(lineWave), 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isHit ? '#fff' : '#71717a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(6, -5 + Math.abs(lineWave), 2, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();

  const finWave = Math.sin(t / 200) * 0.3;

  ctx.fillStyle = isHit ? '#fff' : DARK_PINK;
  ctx.save();
  ctx.translate(0, -8);
  ctx.rotate(finWave);
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(0, -5);
  ctx.lineTo(3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(-5, 4);
  ctx.rotate(-finWave);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (!isHit && isCharging) {
    ctx.fillStyle = HOOK_GOLD;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) {
      const dataX = Math.sin(t / 100 + i * 1.5) * 12;
      const dataY = -10 - i * 3 + Math.cos(t / 150 + i) * 2;
      ctx.font = '4px monospace';
      ctx.fillText(['@', '#', '$', '*'][i], dataX, dataY);
    }
    ctx.globalAlpha = 1;
  }

  if (!isHit && Math.floor(t / 400) % 2 === 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-5, -15);
    ctx.lineTo(-2, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 4px monospace';
    ctx.fillText('!', -6, -11);
  }

  ctx.restore();
};

export const drawArtillery = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const danger = enemy.attackCooldown !== undefined && enemy.attackCooldown < 0.8;
  const pulse = Math.sin(t / (danger ? 40 : 180)) * (danger ? 4 : 1.5);
  const dangerFlash = danger && Math.floor(t / 80) % 2 === 0;
  const bodyColor = dangerFlash ? '#ef4444' : '#f97316';
  const tremble = danger ? (deterministicRandom(seed) - 0.5) * 3 : 0;

  ctx.save();
  ctx.translate(tremble, tremble * 0.5);

  ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 12 + pulse * 0.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-8, 6, 3, 8);
  ctx.fillRect(5, 6, 3, 8);
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.ellipse(-6.5, 14, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6.5, 14, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.save();
  ctx.translate(-14 - pulse * 0.5, 0);
  ctx.rotate(-0.2);
  ctx.fillRect(-4, -6, 8, 12);
  ctx.fillStyle = dangerFlash ? '#fbbf24' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, -8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(14 + pulse * 0.5, 0);
  ctx.rotate(0.2);
  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.fillRect(-4, -6, 8, 12);
  ctx.fillStyle = dangerFlash ? '#fbbf24' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, -8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = isHit ? '#fff' : bodyColor;
  const bodyWidth = 11 + pulse;
  const bodyHeight = 12 + pulse * 0.8;
  ctx.beginPath();
  ctx.roundRect(-bodyWidth, -bodyHeight, bodyWidth * 2, bodyHeight * 2, 3);
  ctx.fill();

  if (!isHit) {
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = -8 + i * 5;
      ctx.beginPath();
      ctx.moveTo(-bodyWidth + 2, y);
      ctx.lineTo(bodyWidth - 2, y);
      ctx.stroke();
    }
  }

  if (!isHit) {
    ctx.fillStyle = danger ? '#ef4444' : '#fbbf24';
    ctx.fillRect(-bodyWidth + 2, -bodyHeight + 2, 3, 6 + pulse);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dangerFlash ? '#ef4444' : ['#22c55e', '#fbbf24', '#ef4444'][i];
      ctx.beginPath();
      ctx.arc(bodyWidth - 4, -6 + i * 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (danger && !isHit) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
    const loadProgress = Math.min(1, (0.8 - (enemy.attackCooldown || 0)) / 0.8);
    ctx.fillRect(-6, 6, 12 * loadProgress, 3);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(-6, 6, 12, 3);
  }

  if (danger && !isHit) {
    ctx.fillStyle = 'rgba(249, 115, 22, 0.6)';
    for (let i = 0; i < 6; i++) {
      const packetX = Math.sin(t / 80 + i * 1) * (8 + pulse);
      const packetY = -14 - pulse - (t / 40 + i * 15) % 20;
      const packetSize = 3 + Math.sin(t / 60 + i) * 1;
      ctx.save();
      ctx.translate(packetX, packetY);
      ctx.rotate(t / 200 + i);
      ctx.fillRect(-packetSize / 2, -packetSize / 2, packetSize, packetSize);
      ctx.restore();
    }
  }

  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-1.5, -bodyHeight - 8, 3, 8);
  ctx.fillStyle = dangerFlash ? '#ef4444' : '#f97316';
  ctx.beginPath();
  ctx.arc(0, -bodyHeight - 10, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.fillRect(-7, -bodyHeight - 5, 2, 5);
  ctx.fillRect(5, -bodyHeight - 5, 2, 5);
  ctx.fillStyle = dangerFlash ? '#fbbf24' : '#9ca3af';
  ctx.beginPath();
  ctx.arc(-6, -bodyHeight - 6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -bodyHeight - 6, 2, 0, Math.PI * 2);
  ctx.fill();

  if (!isHit) {
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.roundRect(-7, -6, 14, 8, 2);
    ctx.fill();

    ctx.fillStyle = dangerFlash ? '#ef4444' : '#f97316';
    ctx.beginPath();
    ctx.arc(-3, -2, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -4.5);
    ctx.lineTo(-3, 0.5);
    ctx.moveTo(-5.5, -2);
    ctx.lineTo(-0.5, -2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(3, -2, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -4.5);
    ctx.lineTo(3, 0.5);
    ctx.moveTo(0.5, -2);
    ctx.lineTo(5.5, -2);
    ctx.stroke();
  }

  if (!isHit) {
    ctx.fillStyle = dangerFlash ? '#ef4444' : '#f97316';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DDoS', 0, 11);
  }

  if (!isHit) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#f97316';
    for (let i = 0; i < 4; i++) {
      const streamX = Math.sin(t / 120 + i * 1.5) * 15;
      const streamY = -16 - i * 4 + Math.cos(t / 100 + i) * 2;
      ctx.font = '4px monospace';
      ctx.fillText(['>>>', '<<<', '|||', '+++'][i], streamX, streamY);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};
