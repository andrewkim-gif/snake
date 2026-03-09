/**
 * game/rendering/enemies/chapter1b.ts - Chapter 1: Stages 6-10 (Escape)
 *
 * Performance-optimized monsters for escape sequence stages
 */

import type { EnemyRenderData } from './types';

// ===== STAGE 6: Parking Lot (주차장) =====

export const drawHeadlight = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.sin(t / 300) > 0.3;

  ctx.save();

  // Two headlights
  ctx.fillStyle = isHit ? '#fff' : (blink ? '#fef08a' : '#fbbf24');

  // Left light
  ctx.beginPath();
  ctx.ellipse(-8, 0, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Right light
  ctx.beginPath();
  ctx.ellipse(8, 0, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Light beams (when on)
  if (!isHit && blink) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-14, -20);
    ctx.lineTo(-2, -20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(2, -20);
    ctx.lineTo(14, -20);
    ctx.closePath();
    ctx.fill();
  }

  // Eyes (pupils)
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-8, 0, 2, 0, Math.PI * 2);
  ctx.arc(8, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawTireRoller = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const roll = (t / 150) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(roll);

  // Outer tire
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  // Tread marks
  ctx.strokeStyle = isHit ? '#fff' : '#374151';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
    ctx.lineTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
    ctx.stroke();
  }

  // Inner rim
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  // Hub
  ctx.fillStyle = isHit ? '#fff' : '#a8a29e';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawParkingCone = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const sway = Math.sin(t / 400) * 0.1;

  ctx.save();
  ctx.rotate(sway);

  // Cone body
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-10, 10);
  ctx.lineTo(10, 10);
  ctx.closePath();
  ctx.fill();

  // White stripes
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.lineTo(3, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(-9, 8);
  ctx.lineTo(9, 8);
  ctx.lineTo(7, 4);
  ctx.closePath();
  ctx.fill();

  // Base
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-12, 10, 24, 4);

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-3, -2, 2, 0, Math.PI * 2);
  ctx.arc(3, -2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawOilSlick = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spread = Math.sin(t / 500) * 2;

  ctx.save();

  // Main blob
  ctx.fillStyle = isHit ? '#fff' : '#422006';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14 + spread, 8 + spread * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rainbow sheen
  if (!isHit) {
    ctx.fillStyle = '#7c3aed';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(-4, -2, 6, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.ellipse(3, 1, 5, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#fef3c7';
  ctx.beginPath();
  ctx.arc(-4, -1, 2, 0, Math.PI * 2);
  ctx.arc(4, -1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-4, -1, 1, 0, Math.PI * 2);
  ctx.arc(4, -1, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawExhaustGhost = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const rise = Math.sin(t / 400) * 3;

  ctx.save();
  ctx.translate(0, -rise);

  // Smoke cloud
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.globalAlpha = isHit ? 1 : 0.7;

  ctx.beginPath();
  ctx.arc(-4, 4, 6, 0, Math.PI * 2);
  ctx.arc(4, 2, 7, 0, Math.PI * 2);
  ctx.arc(0, -4, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-4, -4, 2, 0, Math.PI * 2);
  ctx.arc(4, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  // Wavy mouth
  ctx.strokeStyle = isHit ? '#fff' : '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.quadraticCurveTo(0, 5, 4, 2);
  ctx.stroke();

  ctx.restore();
};

// ===== STAGE 7: Emergency Stairs (비상계단) =====

export const drawStairStep = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const chomp = Math.sin(t / 200) * 0.2;

  ctx.save();

  // Lower step
  ctx.fillStyle = isHit ? '#fff' : '#78716c';
  ctx.fillRect(-12, 4, 24, 8);

  // Upper step (jaw)
  ctx.save();
  ctx.rotate(-chomp);
  ctx.fillStyle = isHit ? '#fff' : '#57534e';
  ctx.fillRect(-12, -8, 24, 8);
  ctx.restore();

  // Teeth
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.fillRect(-8, 2, 4, 3);
  ctx.fillRect(-2, 2, 4, 3);
  ctx.fillRect(4, 2, 4, 3);

  // Eyes on upper step
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-5, -4, 2, 0, Math.PI * 2);
  ctx.arc(5, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawHandrailSnake = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wave = Math.sin(t / 250);

  ctx.save();

  // Snake body (rail shape)
  ctx.strokeStyle = isHit ? '#fff' : '#a1a1aa';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.quadraticCurveTo(-7, 6 + wave * 4, 0, 0);
  ctx.quadraticCurveTo(7, -6 - wave * 4, 14, -6);
  ctx.stroke();

  // Head
  ctx.fillStyle = isHit ? '#fff' : '#71717a';
  ctx.beginPath();
  ctx.ellipse(14, -6, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(15, -8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(15, -8, 1, 0, Math.PI * 2);
  ctx.fill();

  // Tongue
  ctx.strokeStyle = isHit ? '#fff' : '#ef4444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, -6);
  ctx.lineTo(22, -8);
  ctx.lineTo(20, -6);
  ctx.lineTo(22, -4);
  ctx.stroke();

  ctx.restore();
};

export const drawExitSign = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.sin(t / 400) > 0;

  ctx.save();

  // Sign body
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(-14, -8, 28, 16);

  // Text background
  ctx.fillStyle = isHit ? '#fff' : '#166534';
  ctx.fillRect(-12, -6, 18, 12);

  // EXIT text
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('EXIT', -10, 2);

  // Arrow (blinking)
  if (!isHit && blink) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(4, -4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
  }

  // Running figure
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.arc(-6, -2, 2, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.strokeStyle = isHit ? '#fff' : '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-6, 4); // body
  ctx.moveTo(-8, 2);
  ctx.lineTo(-4, 2); // arms
  ctx.moveTo(-6, 4);
  ctx.lineTo(-8, 6); // leg
  ctx.moveTo(-6, 4);
  ctx.lineTo(-4, 6); // leg
  ctx.stroke();

  ctx.restore();
};

export const drawFireExt = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spray = Math.sin(t / 100) > 0.7;

  ctx.save();

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(-8, 10);
  ctx.lineTo(8, 10);
  ctx.lineTo(6, -10);
  ctx.closePath();
  ctx.fill();

  // Handle
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-4, -14, 8, 4);

  // Nozzle
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(6, -12, 8, 3);

  // Spray (when active)
  if (!isHit && spray) {
    ctx.fillStyle = '#f5f5f4';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(14, -10);
    ctx.lineTo(24, -14);
    ctx.lineTo(24, -6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Pressure gauge
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.arc(0, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.beginPath();
  ctx.arc(0, -4, 2, Math.PI, Math.PI * 1.5);
  ctx.fill();

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.arc(-3, 2, 2, 0, Math.PI * 2);
  ctx.arc(3, 2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawEchoShade = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const fade = (Math.sin(t / 500) + 1) / 2;

  ctx.save();

  // Multiple fading silhouettes
  for (let i = 0; i < 3; i++) {
    const offset = i * 4;
    const alpha = isHit ? 1 : (1 - i * 0.3) * fade;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = isHit ? '#fff' : '#27272a';

    // Human silhouette
    ctx.beginPath();
    ctx.arc(-offset, -8, 4, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.fillRect(-3 - offset, -4, 6, 10); // body
    ctx.fillRect(-5 - offset, 6, 10, 4); // legs
  }

  ctx.globalAlpha = 1;

  // Glowing eyes on front shade
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-2, -8, 1.5, 0, Math.PI * 2);
  ctx.arc(2, -8, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

// ===== STAGE 8: Rooftop (옥상) =====

export const drawAntennaZap = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const zap = Math.sin(t / 100) > 0.8;

  ctx.save();

  // Base
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(-6, 6, 12, 6);

  // Pole
  ctx.fillStyle = isHit ? '#fff' : '#9ca3af';
  ctx.fillRect(-2, -12, 4, 18);

  // Top element
  ctx.fillRect(-8, -12, 16, 3);

  // Zap effect
  if (!isHit && zap) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-3, -18);
    ctx.lineTo(2, -16);
    ctx.lineTo(-1, -22);
    ctx.stroke();
  }

  // Signal waves
  ctx.strokeStyle = isHit ? '#fff' : '#06b6d4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-8, -10, 4, -Math.PI * 0.3, Math.PI * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, -10, 4, Math.PI * 0.7, Math.PI * 1.3);
  ctx.stroke();

  ctx.restore();
};

export const drawWindSpirit = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 300) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(spin);

  // Swirl body
  ctx.strokeStyle = isHit ? '#fff' : '#e0f2fe';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 1.5);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 6, Math.PI * 0.5, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 3, Math.PI, Math.PI * 2.5);
  ctx.stroke();

  ctx.restore();

  // Eyes in center
  ctx.fillStyle = isHit ? '#fff' : '#0ea5e9';
  ctx.beginPath();
  ctx.arc(-2, 0, 2, 0, Math.PI * 2);
  ctx.arc(2, 0, 2, 0, Math.PI * 2);
  ctx.fill();
};

export const drawSatelliteEye = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const track = Math.sin(t / 600) * 0.3;

  ctx.save();
  ctx.rotate(track);

  // Dish
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 8, 0, Math.PI * 0.8, Math.PI * 2.2);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Receiver arm
  ctx.strokeStyle = isHit ? '#fff' : '#6b7280';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -10);
  ctx.stroke();

  // Receiver
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.beginPath();
  ctx.arc(0, -10, 3, 0, Math.PI * 2);
  ctx.fill();

  // Eye on receiver
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -10, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Mount
  ctx.fillStyle = isHit ? '#fff' : '#a8a29e';
  ctx.fillRect(-4, 6, 8, 6);

  ctx.restore();
};

export const drawVentPuff = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const puff = Math.sin(t / 200);

  ctx.save();

  // Vent grill
  ctx.fillStyle = isHit ? '#fff' : '#a8a29e';
  ctx.fillRect(-10, -6, 20, 14);

  // Grill lines
  ctx.fillStyle = isHit ? '#fff' : '#57534e';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-8, -4 + i * 3, 16, 1);
  }

  // Puff clouds
  if (!isHit) {
    ctx.fillStyle = '#e7e5e4';
    ctx.globalAlpha = 0.6 + puff * 0.2;
    ctx.beginPath();
    ctx.arc(-3, -10 - puff * 4, 4, 0, Math.PI * 2);
    ctx.arc(3, -12 - puff * 4, 3, 0, Math.PI * 2);
    ctx.arc(0, -14 - puff * 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Angry eyes behind grill
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.fillRect(-6, 0, 3, 2);
  ctx.fillRect(3, 0, 3, 2);

  ctx.restore();
};

export const drawPigeonBot = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const flap = Math.sin(t / 100) * 0.3;

  ctx.save();

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#9ca3af';
  ctx.beginPath();
  ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = isHit ? '#fff' : '#d1d5db';
  ctx.beginPath();
  ctx.arc(6, -4, 5, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  ctx.save();
  ctx.translate(-2, 0);
  ctx.rotate(flap);
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.ellipse(-6, -2, 8, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(-2, 0);
  ctx.rotate(-flap);
  ctx.beginPath();
  ctx.ellipse(-6, 6, 8, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Beak
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.lineTo(14, -3);
  ctx.lineTo(10, -2);
  ctx.closePath();
  ctx.fill();

  // Robot eye
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(8, -5, 2, 0, Math.PI * 2);
  ctx.fill();

  // Antenna
  ctx.strokeStyle = isHit ? '#fff' : '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, -9);
  ctx.lineTo(6, -13);
  ctx.stroke();
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(6, -14, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

// ===== STAGE 9: City Chase (도시 추격) =====

export const drawTrafficLight = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const phase = Math.floor(t / 800) % 3;

  ctx.save();

  // Pole
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-2, 8, 4, 8);

  // Housing
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-6, -12, 12, 20);

  // Lights
  const colors = ['#ef4444', '#fbbf24', '#22c55e'];
  const offColor = '#374151';

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = isHit ? '#fff' : (phase === i ? colors[i] : offColor);
    ctx.beginPath();
    ctx.arc(0, -8 + i * 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Visor
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(-10, -16);
  ctx.lineTo(10, -16);
  ctx.lineTo(6, -12);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

export const drawManhole = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pop = Math.sin(t / 300) > 0.7 ? -4 : 0;

  ctx.save();
  ctx.translate(0, pop);

  // Cover
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pattern
  ctx.strokeStyle = isHit ? '#fff' : '#1f2937';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 5);
  ctx.stroke();

  // Grip holes
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.ellipse(-4, -2, 2, 1, 0, 0, Math.PI * 2);
  ctx.ellipse(4, -2, 2, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes peeking
  if (pop < 0) {
    ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(-3, 6, 2, 0, Math.PI * 2);
    ctx.arc(3, 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

export const drawBillboard = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const flicker = Math.sin(t / 150) > 0.9;

  ctx.save();

  // Frame
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(-14, -10, 28, 18);

  // Screen
  ctx.fillStyle = isHit ? '#fff' : (flicker ? '#1e3a8a' : '#3b82f6');
  ctx.fillRect(-12, -8, 24, 14);

  // Content (ad)
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.font = 'bold 6px sans-serif';
  ctx.fillText('BUY', -8, -2);
  ctx.fillText('NOW!', -8, 4);

  // Glitch line
  if (!isHit && flicker) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-12, Math.sin(t / 50) * 6, 24, 2);
  }

  // Support poles
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-10, 8, 4, 8);
  ctx.fillRect(6, 8, 4, 8);

  ctx.restore();
};

export const drawDroneCam = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const hover = Math.sin(t / 300) * 2;
  const propSpin = (t / 50) % (Math.PI * 2);

  ctx.save();
  ctx.translate(0, hover);

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.strokeStyle = isHit ? '#fff' : '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-12, -4);
  ctx.moveTo(6, 0);
  ctx.lineTo(12, -4);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-12, 4);
  ctx.moveTo(6, 0);
  ctx.lineTo(12, 4);
  ctx.stroke();

  // Propellers (simplified rotation)
  ctx.save();
  ctx.translate(-12, -4);
  ctx.rotate(propSpin);
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(-6, -1, 12, 2);
  ctx.restore();

  ctx.save();
  ctx.translate(12, -4);
  ctx.rotate(-propSpin);
  ctx.fillRect(-6, -1, 12, 2);
  ctx.restore();

  // Camera
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawStreetlamp = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const flicker = Math.sin(t / 200) > 0.85 ? 0.5 : 1;

  ctx.save();

  // Pole
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-2, -4, 4, 18);

  // Arm
  ctx.fillRect(-2, -6, 12, 3);

  // Lamp housing
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.lineTo(14, -10);
  ctx.lineTo(16, -4);
  ctx.lineTo(4, -4);
  ctx.closePath();
  ctx.fill();

  // Light
  ctx.globalAlpha = isHit ? 1 : flicker;
  ctx.fillStyle = isHit ? '#fff' : '#fef08a';
  ctx.beginPath();
  ctx.ellipse(10, -2, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Face on lamp
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(8, -7, 1.5, 0, Math.PI * 2);
  ctx.arc(12, -7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

// ===== STAGE 10: Safehouse (은신처) =====

export const drawStaticTv = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  ctx.save();

  // TV body
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-12, -10, 24, 20);

  // Screen
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-10, -8, 20, 14);

  // Static noise (deterministic pattern)
  if (!isHit) {
    const seed = Math.floor(t / 50);
    for (let i = 0; i < 20; i++) {
      const x = ((seed * 13 + i * 7) % 18) - 9;
      const y = ((seed * 17 + i * 11) % 12) - 6;
      ctx.fillStyle = (i % 2 === 0) ? '#f5f5f4' : '#6b7280';
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Antenna
  ctx.strokeStyle = isHit ? '#fff' : '#6b7280';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(-8, -16);
  ctx.moveTo(4, -10);
  ctx.lineTo(8, -16);
  ctx.stroke();

  // Legs
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-8, 10, 4, 4);
  ctx.fillRect(4, 10, 4, 4);

  ctx.restore();
};

export const drawRadioWave = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const expand = (t / 500) % 1;

  ctx.save();

  // Radio body
  ctx.fillStyle = isHit ? '#fff' : '#78716c';
  ctx.fillRect(-8, -4, 16, 10);

  // Speaker grille
  ctx.fillStyle = isHit ? '#fff' : '#57534e';
  ctx.beginPath();
  ctx.arc(-2, 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Dial
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.fillRect(4, -2, 3, 6);

  // Expanding waves
  if (!isHit) {
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const r = 8 + (expand + i * 0.33) * 12;
      const alpha = 1 - (expand + i * 0.33);
      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(0, -8, r, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Antenna
  ctx.strokeStyle = isHit ? '#fff' : '#a8a29e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.lineTo(10, -12);
  ctx.stroke();

  ctx.restore();
};

export const drawFridgeHum = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const shake = Math.sin(t / 50) * 0.5;

  ctx.save();
  ctx.translate(shake, 0);

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.fillRect(-8, -14, 16, 28);

  // Door line
  ctx.strokeStyle = isHit ? '#fff' : '#d6d3d1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(8, -2);
  ctx.stroke();

  // Handles
  ctx.fillStyle = isHit ? '#fff' : '#a8a29e';
  ctx.fillRect(4, -10, 2, 6);
  ctx.fillRect(4, 2, 2, 6);

  // Magnet/sticker
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-3, -8, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (peeking from inside)
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-3, -6, 1.5, 0, Math.PI * 2);
  ctx.arc(2, -6, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Vibration lines
  if (!isHit) {
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(-10, -8);
    ctx.moveTo(-12, 0);
    ctx.lineTo(-10, 2);
    ctx.moveTo(10, -8);
    ctx.lineTo(12, -10);
    ctx.moveTo(10, 2);
    ctx.lineTo(12, 0);
    ctx.stroke();
  }

  ctx.restore();
};

export const drawDustyFan = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 400) % (Math.PI * 2);

  ctx.save();

  // Base
  ctx.fillStyle = isHit ? '#fff' : '#78716c';
  ctx.fillRect(-4, 6, 8, 8);

  // Stand
  ctx.fillRect(-2, 0, 4, 8);

  // Cage back
  ctx.fillStyle = isHit ? '#fff' : '#a8a29e';
  ctx.beginPath();
  ctx.arc(0, -6, 10, 0, Math.PI * 2);
  ctx.fill();

  // Blades
  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(spin);
  ctx.fillStyle = isHit ? '#fff' : '#d6d3d1';
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i / 3) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -5, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Center hub
  ctx.fillStyle = isHit ? '#fff' : '#57534e';
  ctx.beginPath();
  ctx.arc(0, -6, 3, 0, Math.PI * 2);
  ctx.fill();

  // Dust spots
  if (!isHit) {
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.arc(-6, -10, 1, 0, Math.PI * 2);
    ctx.arc(7, -4, 1, 0, Math.PI * 2);
    ctx.arc(-4, -2, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

export const drawShadowCorner = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const stretch = Math.sin(t / 400) * 4;

  ctx.save();

  // Shadow body (triangular)
  ctx.fillStyle = isHit ? '#fff' : '#18181b';
  ctx.beginPath();
  ctx.moveTo(-12, 12);
  ctx.lineTo(-12, -8 - stretch);
  ctx.lineTo(8 + stretch, 12);
  ctx.closePath();
  ctx.fill();

  // Gradient edge
  if (!isHit) {
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(-10, -4 - stretch * 0.5);
    ctx.lineTo(4 + stretch * 0.5, 10);
    ctx.closePath();
    ctx.fill();
  }

  // Glowing eye
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-6, 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-6, 2, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};
