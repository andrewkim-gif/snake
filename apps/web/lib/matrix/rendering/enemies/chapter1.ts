/**
 * game/rendering/enemies/chapter1.ts - Chapter 1: Office & Escape (Stages 1-10)
 *
 * Performance-optimized monsters:
 * - NO shadowBlur/shadowColor
 * - NO Math.random() per frame
 * - Simple sin() animations only
 * - Max 8 draw calls per monster
 */

import type { EnemyRenderData } from './types';

// ===== STAGE 1: First Desk (첫 책상) =====

export const drawStapler = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const bite = Math.sin(t / 200) * 0.3; // Mouth open/close

  ctx.save();

  // Base (bottom part)
  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.fillRect(-10, 2, 20, 6);

  // Top part (rotates for bite)
  ctx.save();
  ctx.rotate(-bite);
  ctx.fillStyle = isHit ? '#fff' : fill;
  ctx.fillRect(-10, -8, 20, 8);

  // Staple slot
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-6, -4, 12, 2);
  ctx.restore();

  // Eye
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(6, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawCoffeeCup = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const slosh = Math.sin(t / 250) * 2;

  ctx.save();
  ctx.translate(0, slosh * 0.5);

  // Cup body
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(-6, 10);
  ctx.lineTo(6, 10);
  ctx.lineTo(8, -8);
  ctx.closePath();
  ctx.fill();

  // Coffee liquid
  ctx.fillStyle = isHit ? '#fff' : '#92400e';
  ctx.beginPath();
  ctx.moveTo(-7, -4 + slosh);
  ctx.quadraticCurveTo(0, -6 + slosh, 7, -4 + slosh);
  ctx.lineTo(6, 8);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();

  // Handle
  ctx.strokeStyle = isHit ? '#fff' : '#d6d3d1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(10, 0, 5, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();

  // Eyes (angry)
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-5, -2, 3, 3);
  ctx.fillRect(2, -2, 3, 3);

  ctx.restore();
};

export const drawStickyNote = (
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

  // Note body
  ctx.fillStyle = isHit ? '#fff' : '#fef08a';
  ctx.fillRect(-10, -10, 20, 20);

  // Folded corner
  ctx.fillStyle = isHit ? '#fff' : '#fde047';
  ctx.beginPath();
  ctx.moveTo(10, -10);
  ctx.lineTo(4, -10);
  ctx.lineTo(10, -4);
  ctx.closePath();
  ctx.fill();

  // Face
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  // Eyes
  ctx.fillRect(-6, -3, 3, 3);
  ctx.fillRect(3, -3, 3, 3);
  // Mouth (wavy)
  ctx.beginPath();
  ctx.moveTo(-4, 4);
  ctx.quadraticCurveTo(0, 7, 4, 4);
  ctx.stroke();

  ctx.restore();
};

export const drawMouseCable = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wave = Math.sin(t / 300);

  ctx.save();

  // Cable body (snake-like)
  ctx.strokeStyle = isHit ? '#fff' : '#1f2937';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-4, -8 * wave, 0, 0);
  ctx.quadraticCurveTo(4, 8 * wave, 12, 0);
  ctx.stroke();

  // Head (USB connector)
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(10, -4, 6, 8);

  // Eyes on head
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(12, -2, 2, 2);
  ctx.fillRect(12, 1, 2, 2);

  ctx.restore();
};

export const drawKeyboardKey = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const press = Math.sin(t / 150) > 0.8 ? 2 : 0; // Quick press

  ctx.save();
  ctx.translate(0, press);

  // Key shadow/base
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-9, -7, 18, 18);

  // Key top
  ctx.fillStyle = isHit ? '#fff' : '#f3f4f6';
  ctx.fillRect(-8, -8, 16, 14);

  // Letter on key
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A', 0, 2);

  // Angry eyebrows
  ctx.strokeStyle = isHit ? '#fff' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(-2, -2);
  ctx.moveTo(5, -4);
  ctx.lineTo(2, -2);
  ctx.stroke();

  ctx.restore();
};

// ===== STAGE 2: Break Room (휴게실) =====

export const drawVendingBot = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.sin(t / 500) > 0.9;

  ctx.save();

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.fillRect(-8, -12, 16, 24);

  // Display window
  ctx.fillStyle = isHit ? '#fff' : '#1e293b';
  ctx.fillRect(-6, -10, 12, 10);

  // Items in window
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.fillRect(-4, -8, 3, 3);
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(1, -8, 3, 3);

  // Coin slot (blinking)
  ctx.fillStyle = isHit ? '#fff' : (blink ? '#fbbf24' : '#6b7280');
  ctx.fillRect(4, 4, 2, 4);

  // Dispensing slot
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-4, 8, 8, 4);

  ctx.restore();
};

export const drawDonut = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const roll = (t / 500) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(roll);

  // Outer donut
  ctx.fillStyle = isHit ? '#fff' : '#f472b6';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // Inner hole
  ctx.fillStyle = isHit ? '#fff' : '#fdf2f8';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Sprinkles (fixed positions)
  if (!isHit) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-6, -2, 2, 1);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(4, 3, 2, 1);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-2, 6, 2, 1);
  }

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-3, -6, 2, 0, Math.PI * 2);
  ctx.arc(3, -6, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawSodaCan = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const fizz = Math.sin(t / 100) * 2;

  ctx.save();

  // Can body
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top rim
  ctx.fillStyle = isHit ? '#fff' : '#a8a29e';
  ctx.beginPath();
  ctx.ellipse(0, -10, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pull tab
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(-2, -12, 4, 3);

  // Fizz bubbles (simple circles)
  if (!isHit) {
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(-2, -14 + fizz, 2, 0, Math.PI * 2);
    ctx.arc(2, -16 + fizz, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Face
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.arc(-3, -2, 2, 0, Math.PI * 2);
  ctx.arc(3, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-3, -2, 1, 0, Math.PI * 2);
  ctx.arc(3, -2, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawChipBag = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const puff = Math.sin(t / 300) * 2;

  ctx.save();

  // Bag body (puffy)
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.quadraticCurveTo(-10 - puff, 0, -8, 10);
  ctx.lineTo(8, 10);
  ctx.quadraticCurveTo(10 + puff, 0, 8, -10);
  ctx.closePath();
  ctx.fill();

  // Top crimp
  ctx.fillStyle = isHit ? '#fff' : '#d97706';
  ctx.fillRect(-6, -12, 12, 3);

  // Brand stripe
  ctx.fillStyle = isHit ? '#fff' : '#dc2626';
  ctx.fillRect(-7, -2, 14, 6);

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-5, -6, 3, 3);
  ctx.fillRect(2, -6, 3, 3);

  ctx.restore();
};

export const drawMicrowave = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 200) % (Math.PI * 2);

  ctx.save();

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.fillRect(-12, -10, 24, 20);

  // Window
  ctx.fillStyle = isHit ? '#fff' : '#1e293b';
  ctx.fillRect(-10, -8, 14, 14);

  // Rotating plate inside
  ctx.save();
  ctx.translate(-3, 0);
  ctx.rotate(spin);
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Control panel
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(6, -6, 4, 12);

  // Buttons
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(7, -4, 2, 2);
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.fillRect(7, 2, 2, 2);

  ctx.restore();
};

// ===== STAGE 3: Meeting Room (회의실) =====

export const drawProjector = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const aperture = Math.sin(t / 400) * 2 + 6;

  ctx.save();

  // Body
  ctx.fillStyle = isHit ? '#fff' : '#1e293b';
  ctx.fillRect(-10, -6, 20, 12);

  // Lens housing
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.beginPath();
  ctx.arc(-12, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // Lens (aperture animation)
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.beginPath();
  ctx.arc(-12, 0, aperture, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(-12, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  // Vent lines
  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.fillRect(2, -4, 6, 1);
  ctx.fillRect(2, 0, 6, 1);
  ctx.fillRect(2, 4, 6, 1);

  ctx.restore();
};

export const drawWhiteboard = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const textFade = (Math.sin(t / 600) + 1) / 2;

  ctx.save();

  // Frame
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(-14, -10, 28, 20);

  // Board
  ctx.fillStyle = isHit ? '#fff' : '#ffffff';
  ctx.fillRect(-12, -8, 24, 16);

  // Fading text/scribbles
  if (!isHit) {
    ctx.globalAlpha = textFade;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(8, -4);
    ctx.moveTo(-8, 0);
    ctx.lineTo(4, 0);
    ctx.moveTo(-8, 4);
    ctx.lineTo(6, 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Angry face
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-4, -2, 2, 0, Math.PI * 2);
  ctx.arc(4, -2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawPresentation = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const slide = Math.floor(t / 1000) % 3;

  ctx.save();

  // Screen (16:9)
  ctx.fillStyle = isHit ? '#fff' : '#2563eb';
  ctx.fillRect(-14, -8, 28, 16);

  // Inner content area
  ctx.fillStyle = isHit ? '#fff' : '#1e40af';
  ctx.fillRect(-12, -6, 24, 12);

  // Slide content (changes)
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  if (slide === 0) {
    // Bars
    ctx.fillRect(-8, 2, 4, -6);
    ctx.fillRect(-2, 2, 4, -4);
    ctx.fillRect(4, 2, 4, -8);
  } else if (slide === 1) {
    // Pie
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 1.5);
    ctx.lineTo(0, 0);
    ctx.fill();
  } else {
    // Text lines
    ctx.fillRect(-8, -4, 16, 2);
    ctx.fillRect(-8, 0, 12, 2);
  }

  ctx.restore();
};

export const drawChairSpin = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 100) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(spin);

  // Seat
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Backrest
  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.fillRect(-6, -12, 12, 10);

  // Base
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 10);
  ctx.stroke();

  // Wheels (5 point star)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.fillRect(
      Math.cos(angle) * 8 - 2,
      Math.sin(angle) * 8 + 8,
      4, 4
    );
  }

  ctx.restore();
};

export const drawClockWatcher = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const second = (t / 50) % (Math.PI * 2);

  ctx.save();

  // Clock face
  ctx.fillStyle = isHit ? '#fff' : '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = isHit ? '#fff' : '#1f2937';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hour marks
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillRect(
      Math.cos(angle) * 9 - 1,
      Math.sin(angle) * 9 - 1,
      2, 2
    );
  }

  // Hour hand
  ctx.strokeStyle = isHit ? '#fff' : '#1f2937';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(-Math.PI / 3) * 5, Math.sin(-Math.PI / 3) * 5);
  ctx.stroke();

  // Second hand (animated)
  ctx.strokeStyle = isHit ? '#fff' : '#ef4444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(second - Math.PI / 2) * 8, Math.sin(second - Math.PI / 2) * 8);
  ctx.stroke();

  ctx.restore();
};

// ===== STAGE 4: Server Entrance (서버 입구) =====

export const drawKeycard = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const slide = Math.sin(t / 200) * 3;

  ctx.save();
  ctx.translate(slide, 0);

  // Card body
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(-10, -6, 20, 12);

  // Chip
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.fillRect(-8, -3, 6, 6);

  // Magnetic stripe
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-10, 3, 20, 2);

  // Eyes
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.beginPath();
  ctx.arc(3, -1, 2, 0, Math.PI * 2);
  ctx.arc(7, -1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(3, -1, 1, 0, Math.PI * 2);
  ctx.arc(7, -1, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawCameraEye = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const scan = Math.sin(t / 500) * 0.5;

  ctx.save();
  ctx.rotate(scan);

  // Mount
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-3, -14, 6, 6);

  // Dome
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(0, 0, 10, Math.PI, 0);
  ctx.fill();

  // Camera body
  ctx.fillStyle = isHit ? '#fff' : '#4b5563';
  ctx.beginPath();
  ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI);
  ctx.fill();

  // Lens
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Recording light
  const blink = Math.sin(t / 200) > 0;
  if (!isHit && blink) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(6, -4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

export const drawFirewallCube = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 300) * 0.2 + 1;

  ctx.save();
  ctx.scale(pulse, pulse);

  // Cube faces (isometric-ish)
  // Top
  ctx.fillStyle = isHit ? '#fff' : '#fb923c';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(10, -5);
  ctx.lineTo(0, 0);
  ctx.lineTo(-10, -5);
  ctx.closePath();
  ctx.fill();

  // Left
  ctx.fillStyle = isHit ? '#fff' : '#ea580c';
  ctx.beginPath();
  ctx.moveTo(-10, -5);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();

  // Right
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.moveTo(10, -5);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(10, 5);
  ctx.closePath();
  ctx.fill();

  // Flame icon
  ctx.fillStyle = isHit ? '#fff' : '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(3, -3, 0, 2);
  ctx.quadraticCurveTo(-3, -3, 0, -6);
  ctx.fill();

  ctx.restore();
};

export const drawAccessDenied = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.sin(t / 150) > 0;

  ctx.save();

  // Circle background
  ctx.fillStyle = isHit ? '#fff' : (blink ? '#dc2626' : '#991b1b');
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  // X mark
  ctx.strokeStyle = isHit ? '#fff' : '#fff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, 6);
  ctx.moveTo(6, -6);
  ctx.lineTo(-6, 6);
  ctx.stroke();

  ctx.restore();
};

export const drawFingerprint = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const scanY = (Math.sin(t / 400) * 0.5 + 0.5) * 20 - 10;

  ctx.save();

  // Fingerprint pattern (concentric curves)
  ctx.strokeStyle = isHit ? '#fff' : '#06b6d4';
  ctx.lineWidth = 1;

  for (let i = 2; i < 12; i += 2) {
    ctx.beginPath();
    ctx.arc(0, 4, i, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }

  // Scan line
  if (!isHit) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, scanY);
    ctx.lineTo(10, scanY);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = isHit ? '#fff' : '#0891b2';
  ctx.lineWidth = 2;
  ctx.strokeRect(-12, -12, 24, 24);

  ctx.restore();
};

// ===== STAGE 5: Server Core (서버 코어) =====

export const drawDataPacket = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const move = Math.sin(t / 200) * 4;

  ctx.save();
  ctx.translate(move, 0);

  // Packet boxes
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.fillRect(-10, -4, 6, 8);
  ctx.fillRect(-2, -4, 6, 8);
  ctx.fillRect(6, -4, 6, 8);

  // Connection lines
  ctx.strokeStyle = isHit ? '#fff' : '#60a5fa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-2, 0);
  ctx.moveTo(4, 0);
  ctx.lineTo(6, 0);
  ctx.stroke();

  // Header indicator
  ctx.fillStyle = isHit ? '#fff' : '#1e3a8a';
  ctx.fillRect(-10, -4, 6, 2);

  ctx.restore();
};

export const drawBitStream = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  ctx.save();

  ctx.fillStyle = isHit ? '#fff' : '#00FF41';
  ctx.font = '10px monospace';

  // Scrolling bits
  const offset = (t / 100) % 20;
  const bits = '10110010';

  for (let i = 0; i < bits.length; i++) {
    const x = -14 + (i * 4 + offset) % 28;
    ctx.fillText(bits[i], x, 4);
  }

  // Body outline
  ctx.strokeStyle = isHit ? '#fff' : '#00FF41';
  ctx.lineWidth = 1;
  ctx.strokeRect(-12, -8, 24, 16);

  ctx.restore();
};

export const drawMemoryLeak = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const drip = (t / 300) % 20;

  ctx.save();

  // Memory block
  ctx.fillStyle = isHit ? '#fff' : '#8b5cf6';
  ctx.fillRect(-8, -10, 16, 14);

  // Crack
  ctx.strokeStyle = isHit ? '#fff' : '#c4b5fd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -10);
  ctx.lineTo(2, 0);
  ctx.lineTo(-1, 4);
  ctx.stroke();

  // Dripping data
  ctx.fillStyle = isHit ? '#fff' : '#a78bfa';
  ctx.beginPath();
  ctx.ellipse(0, 4 + drip, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Label
  ctx.fillStyle = isHit ? '#fff' : '#fff';
  ctx.font = '8px monospace';
  ctx.fillText('MEM', -8, -4);

  ctx.restore();
};

export const drawCacheMiss = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 500) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(spin);

  // Question mark body
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);

  // Orbit ring
  ctx.strokeStyle = isHit ? '#fff' : '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
};

export const drawThreadTangle = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wiggle = Math.sin(t / 200) * 2;

  ctx.save();

  // Tangled threads
  ctx.strokeStyle = isHit ? '#fff' : '#10b981';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Thread 1
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.quadraticCurveTo(wiggle, 0, -10, 8);
  ctx.stroke();

  // Thread 2
  ctx.strokeStyle = isHit ? '#fff' : '#34d399';
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.quadraticCurveTo(-wiggle, 0, 10, 8);
  ctx.stroke();

  // Thread 3
  ctx.strokeStyle = isHit ? '#fff' : '#6ee7b7';
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(0, wiggle, 8, 0);
  ctx.stroke();

  // Center knot
  ctx.fillStyle = isHit ? '#fff' : '#059669';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};
