/**
 * game/rendering/projectiles/weapons/special.ts - 특수 무기 렌더링 (v7.15 Performance)
 *
 * Async/Await (bridge), Stack Trace (beam), Recursive Loop (laser)
 *
 * v4.9: Multi-layer glow, eased animations, pulse rings, trail effects
 * v4.9.1: LOD-aware shadowBlur 최적화
 * v7.15: 성능 최적화 - 글로우 레이어/파티클/트레일/shadowBlur 대폭 감소
 * v7.20: 성능 최적화 - easing 통합 모듈 사용, time 파라미터화
 */

import { EASING } from '../../effects/easing';
import { shouldUseGlow } from '../../enemies/renderContext';
import { isoRenderAngle } from '../../../isometric';

export interface SpecialWeaponParams {
  ctx: CanvasRenderingContext2D;
  p: any;
  playerPos: { x: number; y: number };
  time?: number; // v7.20: 프레임당 1회만 Date.now() 호출하여 전달
}

// v7.20: 공통 easing 모듈 사용 (중복 제거 - EASING import 활용)

// ============================================================================
// Async/Await - Promise Chain Binding (bridge)
// ============================================================================

/**
 * Async/Await - Promise 체인 바인딩
 *
 * v4.9 Features:
 * - Multi-layer chain glow with sequential blur
 * - Elastic node bounce animation
 * - Data flow particles with trail
 * - Rhythmic pulse waves along chain
 * - .then() callback visualization
 */
export function drawBridge(params: SpecialWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  ctx.rotate(isoRenderAngle(p.angle));
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백

  // v7.15: LOD 체크
  const useGlow = shouldUseGlow();

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // Color scheme - Promise chain colors
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#f472b6' : '#8b5cf6');
  const secondaryColor = isUltimate ? '#fde68a' : (isEvolved ? '#f9a8d4' : '#a78bfa');
  const glowColor = isUltimate ? 'rgba(252, 211, 77,' : (isEvolved ? 'rgba(244, 114, 182,' : 'rgba(139, 92, 246,');

  // Safe lifeRatio bounds
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));

  // Appear/fade animation with easing
  let scaleAnim = 1;
  let alphaAnim = 1;
  if (progress < 0.15) {
    const appearProgress = Math.max(0, Math.min(1, progress / 0.15));
    scaleAnim = Math.max(0.1, EASING.easeOutBack(appearProgress));
    alphaAnim = EASING.easeOutQuad(appearProgress);
  } else if (progress > 0.85) {
    const fadeProgress = Math.max(0, Math.min(1, (progress - 0.85) / 0.15));
    alphaAnim = Math.max(0.1, 1 - EASING.easeOutQuad(fadeProgress));
    scaleAnim = Math.max(0.1, 1 - fadeProgress * 0.3);
  }

  // Dynamic sizing
  const bridgeScale = Math.max(0.4, (p.radius || 5) / 10) * scaleAnim;
  const totalLength = 80 * bridgeScale;
  const waveAmplitude = 5 * bridgeScale;
  const nodeSize = 4 * bridgeScale;
  const lineWidth = 3 * bridgeScale;

  // ========================================
  // Multi-layer chain glow (v7.34: 알파값 0.25→0.45, shadowBlur 12→16, lineWidth 증가)
  // ========================================
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45 * alphaAnim;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(0.5, lineWidth * 2.5);
    ctx.lineCap = 'round';

    ctx.beginPath();
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const ratio = i / segments;
      const x = ratio * totalLength;
      const wave = Math.sin((time / 80 + x / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(ratio * Math.PI));

      if (i === 0) ctx.moveTo(x, wave);
      else ctx.lineTo(x, wave);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ========================================
  // Main promise chain line (v7.34: lineWidth 증가, shadowBlur 6→10)
  // ========================================
  ctx.save();
  ctx.globalAlpha = alphaAnim;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = Math.max(1.5, lineWidth * 1.3);
  ctx.lineCap = 'round';
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }

  ctx.beginPath();
  const segments = 25;
  for (let i = 0; i <= segments; i++) {
    const ratio = i / segments;
    const x = ratio * totalLength;
    const wave = Math.sin((time / 80 + x / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(ratio * Math.PI));

    if (i === 0) ctx.moveTo(x, wave);
    else ctx.lineTo(x, wave);
  }
  ctx.stroke();
  ctx.restore();

  // ========================================
  // Promise nodes (v7.34: 노드 크기 증가, shadowBlur 6→10, 라벨 크기 증가)
  // ========================================
  const nodeCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  const nodeLabels = isUltimate
    ? ['()', '.then', '=>', '{}']
    : (isEvolved ? ['()', '.then', '{}'] : ['()', '{}']);

  for (let idx = 0; idx < nodeCount; idx++) {
    const posRatio = 0.15 + (idx / (nodeCount - 1)) * 0.7;
    const posX = posRatio * totalLength;
    const wave = Math.sin((time / 80 + posX / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(posRatio * Math.PI));

    // Simple scale animation (v7.34: 크기 증가)
    const bounceScale = 1.1 + Math.sin(time / 500 + idx) * 0.12;
    const currentNodeSize = nodeSize * bounceScale * 1.2;

    // Node body (v7.34: lineWidth 증가, shadowBlur 6→10)
    ctx.save();
    ctx.globalAlpha = alphaAnim;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1.5, lineWidth * 0.9);
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(posX, wave, Math.max(3, currentNodeSize), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Node label (v7.34: 폰트 크기 증가)
    if (bridgeScale > 0.45) {
      ctx.save();
      ctx.globalAlpha = 0.95 * alphaAnim;
      ctx.font = `bold ${Math.max(6, 6 * bridgeScale)}px 'Courier New', monospace`;
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nodeLabels[idx], posX, wave);
      ctx.restore();
    }
  }

  // ========================================
  // Data flow particles (v7.34: 개수 4/3/2, 크기 증가, shadowBlur 6→10)
  // ========================================
  const particleCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  const particleSize = Math.max(3, 3.5 * bridgeScale);

  for (let i = 0; i < particleCount; i++) {
    const baseProgress = ((time / 350 + i / particleCount) % 1);
    const flowProgress = EASING.easeInOutSine(baseProgress);
    const visibleProgress = 0.1 + flowProgress * 0.8;
    const px = visibleProgress * totalLength;
    const py = Math.sin((time / 80 + px / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(visibleProgress * Math.PI));

    // Main particle (v7.34: shadowBlur 6→10)
    ctx.save();
    ctx.globalAlpha = 0.95 * alphaAnim;
    if (useGlow) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, particleSize), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ========================================
  // Evolved/Ultimate: Async branches (v7.34: 알파값 0.35→0.55, lineWidth 증가)
  // ========================================
  if (isEvolved || isUltimate) {
    const branchOffset = 9 * bridgeScale;

    ctx.save();
    ctx.globalAlpha = 0.55 * alphaAnim;
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = Math.max(0.8, lineWidth * 0.7);
    ctx.setLineDash([4 * bridgeScale, 3 * bridgeScale]);

    // Upper async branch (v7.15: segments 12→8)
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const ratio = 0.3 + (i / 8) * 0.4;
      const x = ratio * totalLength;
      const baseWave = Math.sin((time / 80 + x / 8)) * waveAmplitude;
      const branchWave = baseWave - branchOffset;
      if (i === 0) ctx.moveTo(x, baseWave * 0.5);
      else ctx.lineTo(x, branchWave);
    }
    ctx.stroke();

    // Lower async branch
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const ratio = 0.3 + (i / 8) * 0.4;
      const x = ratio * totalLength;
      const baseWave = Math.sin((time / 80 + x / 8)) * waveAmplitude;
      const branchWave = baseWave + branchOffset;
      if (i === 0) ctx.moveTo(x, baseWave * 0.5);
      else ctx.lineTo(x, branchWave);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Await indicator (v7.34: 알파값 0.6→0.8, 폰트 크기 증가)
    if (isUltimate) {
      const awaitX = totalLength * 0.65;
      const awaitPulse = Math.sin(time / 200) * 0.5 + 0.5;

      ctx.save();
      ctx.globalAlpha = 0.8 * alphaAnim * awaitPulse;
      ctx.fillStyle = mainColor;
      ctx.font = `bold ${Math.max(7, 8 * bridgeScale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('await', awaitX, -branchOffset * 1.5);
      ctx.restore();
    }
  }

  // ========================================
  // Edge energy sparks (v7.34: 개수 3, 크기 증가, 알파값 증가)
  // ========================================
  const sparkTime = time / 90;
  const sparkCount = 3;

  for (let s = 0; s < sparkCount; s++) {
    const sparkProgress = ((sparkTime + s * 0.33) % 1);
    const sparkX = sparkProgress * totalLength;
    const sparkWave = Math.sin((time / 80 + sparkX / 8)) * waveAmplitude;
    const sparkAlpha = Math.sin(sparkProgress * Math.PI) * 0.9 * alphaAnim;

    if (sparkAlpha > 0.25) {
      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkWave, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ============================================================================
// Stack Trace - Laser Pointer Beam (beam)
// ============================================================================

/**
 * Stack Trace - 레이저 조준기 빔
 *
 * v4.9 Features:
 * - Multi-layer beam glow with gradient
 * - Eased charge-up animation
 * - Impact sparks with physics
 * - Scanning data visualization
 * - Core beam pulsation
 */
export function drawBeam(params: SpecialWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const beamWidth = (p.width || 20) * 0.45;
  const beamLength = p.height || 600;

  // v7.15: LOD 체크
  const useGlow = shouldUseGlow();

  // Safe lifeRatio bounds
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.5)));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  ctx.rotate(isoRenderAngle(p.angle));

  // Progress and phase calculation
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));
  let beamAlpha = 1;
  let beamScale = 1;

  // Eased appear/fade
  if (progress < 0.15) {
    const appearProgress = Math.max(0, Math.min(1, progress / 0.15));
    beamScale = Math.max(0.1, EASING.easeOutBack(appearProgress));
    beamAlpha = Math.max(0.1, EASING.easeOutQuad(appearProgress));
  } else if (progress > 0.85) {
    const fadeProgress = Math.max(0, Math.min(1, (progress - 0.85) / 0.15));
    beamAlpha = Math.max(0.1, 1 - EASING.easeOutQuad(fadeProgress));
    beamScale = Math.max(0.1, 1 - fadeProgress * 0.5);
  }

  const actualLength = beamLength * beamScale;
  const flicker = 0.88 + Math.sin(time / 18) * 0.12;

  // Color scheme
  const beamColor = isUltimate
    ? { r: 250, g: 204, b: 21 }  // Gold
    : isEvolved
      ? { r: 74, g: 222, b: 128 }  // Green
      : { r: 239, g: 68, b: 68 };   // Red

  const hexColor = isUltimate ? '#facc15' : isEvolved ? '#4ade80' : '#ef4444';

  // ========================================
  // Laser pointer device (v7.34: shadowBlur 4→8)
  // ========================================

  // Device body (v7.34: shadowBlur 4→8)
  ctx.save();
  ctx.globalAlpha = beamAlpha;
  ctx.fillStyle = isEvolved ? '#22c55e' : '#374151';
  if (useGlow) {
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.roundRect(-10, -6, 24, 12, 4);
  ctx.fill();
  ctx.restore();

  // Device detail lines
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.8;
  ctx.fillStyle = isEvolved ? '#4ade80' : '#6b7280';
  ctx.fillRect(-7, -4, 18, 2);
  ctx.fillRect(-7, 2, 14, 1);
  ctx.restore();

  // Power indicator LED (v7.34: shadowBlur 6→12, 크기 증가)
  ctx.save();
  ctx.globalAlpha = beamAlpha * flicker;
  if (useGlow) {
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = hexColor;
  ctx.beginPath();
  ctx.arc(6, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // LED inner glow (v7.34: 크기 증가)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(5.5, -0.5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Emitter (v7.34: shadowBlur 8→14, 크기 증가)
  const emitterX = 14;

  ctx.save();
  ctx.globalAlpha = beamAlpha;
  if (useGlow) {
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = hexColor;
  ctx.beginPath();
  ctx.arc(emitterX, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(emitterX - 1, -1, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ========================================
  // Beam glow (v7.34: 알파값 0.2→0.35, shadowBlur 12→18, 글로우 너비 증가)
  // ========================================
  if (useGlow) {
    const glowWidth = beamWidth * 2.5;
    ctx.save();
    ctx.globalAlpha = 0.35 * beamAlpha * flicker;
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(${beamColor.r}, ${beamColor.g}, ${beamColor.b}, 0.5)`;
    ctx.fillRect(emitterX, -glowWidth, actualLength, glowWidth * 2);
    ctx.restore();
  }

  // ========================================
  // Main beam body (v7.34: 알파값 증가, 너비 증가)
  // ========================================
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.92;
  ctx.fillStyle = `rgba(${beamColor.r}, ${beamColor.g}, ${beamColor.b}, 0.95)`;
  ctx.fillRect(emitterX, -beamWidth * 0.75, actualLength, beamWidth * 1.5);
  ctx.restore();

  // ========================================
  // Core beam (v7.34: 코어 너비 증가, 알파값 증가)
  // ========================================
  const corePulse = 0.85 + Math.sin(time / 30) * 0.15;
  const coreWidth = beamWidth * 0.32 * corePulse;

  ctx.save();
  ctx.globalAlpha = beamAlpha * flicker * 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(emitterX, -coreWidth, actualLength * 0.75, coreWidth * 2);
  ctx.restore();

  // ========================================
  // Beam particles (v7.34: 개수 6, 크기 증가, 알파값 증가)
  // ========================================
  const particleCount = 6;
  for (let i = 0; i < particleCount; i++) {
    const particleSpeed = 45 + i * 12;
    const particleProgress = ((time / particleSpeed + i * 50) % actualLength) / actualLength;
    const px = emitterX + particleProgress * actualLength;
    const pyOffset = Math.sin(time / 25 + i * 1.5) * beamWidth * 0.5;
    const particleAlpha = Math.sin(particleProgress * Math.PI) * beamAlpha * flicker;

    if (particleAlpha > 0.15) {
      ctx.save();
      ctx.globalAlpha = particleAlpha * 0.95;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, pyOffset, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ========================================
  // Beam end impact (v7.34: 링 알파값 0.4→0.6, 스파크 4개, 크기 증가)
  // ========================================
  if (beamScale > 0.5) {
    const endX = emitterX + actualLength;

    // Impact ring (v7.34: 알파값 증가, 크기 증가, lineWidth 증가)
    const ringPhase = ((time / 280) % 1);
    const ringRadius = 18 + ringPhase * 24;
    const ringAlpha = Math.max(0, (1 - ringPhase) * 0.6 * beamAlpha);

    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(endX, 0, Math.max(1, ringRadius), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Central impact glow (v7.34: 알파값 0.5→0.65, 크기 증가)
    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.65;
    ctx.fillStyle = `rgba(${beamColor.r}, ${beamColor.g}, ${beamColor.b}, 0.7)`;
    ctx.beginPath();
    ctx.arc(endX, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Spark particles (v7.34: 개수 4, 알파값 0.7→0.85, 크기 증가)
    for (let s = 0; s < 4; s++) {
      const sparkAngle = (time / 70 + s * (Math.PI * 2 / 4)) % (Math.PI * 2);
      const sparkDist = 14 + Math.sin(time / 22 + s * 2) * 6;
      const sx = endX + Math.cos(sparkAngle) * sparkDist;
      const sy = Math.sin(sparkAngle) * sparkDist;

      ctx.save();
      ctx.globalAlpha = beamAlpha * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ========================================
  // Evolved: Data scan (v7.34: 알파값 증가, lineWidth 증가, 스캔바 크기 증가)
  // ========================================
  if (isEvolved && beamScale > 0.3) {
    // Scan lines (v7.34: 알파값 0.3→0.5, lineWidth 1→1.5)
    ctx.save();
    ctx.globalAlpha = 0.5 * beamAlpha * flicker;
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.moveTo(emitterX, -beamWidth * 1.3);
    ctx.lineTo(emitterX + actualLength * 0.85, -beamWidth * 1.3);
    ctx.moveTo(emitterX, beamWidth * 1.3);
    ctx.lineTo(emitterX + actualLength * 0.85, beamWidth * 1.3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Moving scan bar (v7.34: 알파값 0.5→0.7, 크기 증가)
    const scanProgress = ((time / 15) % actualLength);
    ctx.save();
    ctx.globalAlpha = 0.7 * beamAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(emitterX + scanProgress, -beamWidth * 1.1, 4, beamWidth * 2.2);
    ctx.restore();
  }

  // ========================================
  // Charge-up effect (v7.34: 알파값 증가, shadowBlur 12, 링 크기 증가, 파티클 크기 증가)
  // ========================================
  if (progress < 0.2) {
    const chargeRatio = EASING.easeOutCubic(Math.max(0, Math.min(1, progress / 0.2)));

    // Charging ring (v7.34: shadowBlur 8→12, lineWidth 2.5→3, 링 크기 증가)
    ctx.save();
    ctx.globalAlpha = chargeRatio * 0.95;
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 3;
    if (useGlow) {
      ctx.shadowColor = hexColor;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(emitterX, 0, 12 + chargeRatio * 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
    ctx.stroke();
    ctx.restore();

    // Converging particles (v7.34: 알파값 0.8→0.9, 크기 2→3)
    for (let c = 0; c < 3; c++) {
      const cAngle = (c / 3) * Math.PI * 2 + time / 150;
      const cDist = 25 * (1 - chargeRatio);
      const cx = emitterX + Math.cos(cAngle) * cDist;
      const cy = Math.sin(cAngle) * cDist;

      ctx.save();
      ctx.globalAlpha = chargeRatio * 0.9;
      ctx.fillStyle = hexColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ========================================
  // Ultimate: Golden effects (v7.34: 알파값 증가, shadowBlur 20, 크기 증가)
  // ========================================
  if (isUltimate) {
    // Golden aura on device (v7.34: 알파값 0.3→0.5, shadowBlur 15→20, lineWidth 2→2.5)
    ctx.save();
    ctx.globalAlpha = 0.5 * beamAlpha * flicker;
    if (useGlow) {
      ctx.shadowColor = '#fcd34d';
      ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-14, -9, 32, 18, 5);
    ctx.stroke();
    ctx.restore();

    // Extra beam layer (v7.34: 알파값 0.3→0.45, 크기 증가)
    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.45;
    ctx.fillStyle = 'rgba(253, 230, 138, 0.6)';
    ctx.fillRect(emitterX, -beamWidth * 0.5, actualLength * 0.85, beamWidth);
    ctx.restore();
  }
}

// ============================================================================
// Recursive Loop - Rotating Laser (laser)
// ============================================================================

/**
 * Recursive Loop - 회전 레이저
 *
 * v4.9 Features:
 * - Multi-layer rotating glow
 * - Afterimage trails with easing
 * - Origin pulse rings
 * - Endpoint energy sparks
 * - Recursive visual indicators
 */
export function drawLaser(params: SpecialWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const laserLength = p.radius || 100;
  const laserWidth = 10;

  // v7.15: LOD 체크
  const useGlow = shouldUseGlow();

  // Safe lifeRatio bounds
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.8)));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));

  const laserAngle = p.angle || 0;

  // Eased fade effect
  let beamAlpha = 1;
  if (progress < 0.1) {
    const appearProgress = Math.max(0, Math.min(1, progress / 0.1));
    beamAlpha = Math.max(0.1, EASING.easeOutQuad(appearProgress));
  } else if (progress > 0.9) {
    const fadeProgress = Math.max(0, Math.min(1, (progress - 0.9) / 0.1));
    beamAlpha = Math.max(0.1, 1 - EASING.easeOutQuad(fadeProgress));
  }

  const flicker = 0.92 + Math.sin(time / 12) * 0.08;

  // Color scheme - Rose/Pink recursive theme
  const laserColor = isUltimate
    ? { r: 251, g: 191, b: 36 }   // Amber
    : isEvolved
      ? { r: 244, g: 63, b: 94 }   // Rose
      : { r: 251, g: 113, b: 133 }; // Pink

  const hexColor = isUltimate ? '#fbbf24' : isEvolved ? '#f43f5e' : '#fb7185';
  const glowHex = isUltimate ? '#fcd34d' : isEvolved ? '#fb7185' : '#fda4af';

  ctx.rotate(laserAngle);

  // ========================================
  // Rotation afterimage trails (v7.34: 알파값 0.2→0.35, 색상 알파 0.6→0.8, 너비 증가)
  // ========================================
  const sweepDirection = (p as { sweepDirection?: number }).sweepDirection || 1;
  const trailCount = 3;

  for (let t = trailCount; t > 0; t--) {
    const trailAngleOffset = -t * 0.08 * sweepDirection;
    const trailProgress = Math.max(0, Math.min(1, 1 - t / trailCount));
    const trailAlpha = EASING.easeOutQuad(trailProgress) * 0.35 * beamAlpha;
    const trailLength = laserLength * (0.55 + trailProgress * 0.4);

    ctx.save();
    ctx.rotate(trailAngleOffset);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.8)`;
    ctx.fillRect(0, -laserWidth * 0.3, trailLength, laserWidth * 0.6);
    ctx.restore();
  }

  // ========================================
  // Laser glow (v7.34: 알파값 0.25→0.4, shadowBlur 12→18, 색상 알파 0.5→0.65)
  // ========================================
  if (useGlow) {
    const glowWidth = laserWidth * 2.2;
    ctx.save();
    ctx.globalAlpha = 0.4 * beamAlpha * flicker;
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.65)`;
    ctx.fillRect(0, -glowWidth, laserLength, glowWidth * 2);
    ctx.restore();
  }

  // ========================================
  // Main laser beam (v7.34: 알파값 0.9→0.95, 너비 증가)
  // ========================================
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.95;
  ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 1.0)`;
  ctx.fillRect(0, -laserWidth * 0.6, laserLength, laserWidth * 1.2);
  ctx.restore();

  // ========================================
  // Core beam (v7.34: 펄스 0.85→0.88, 너비 0.18→0.22, 알파값 0.9→0.95, 길이 0.7→0.75)
  // ========================================
  const corePulse = 0.88 + Math.sin(time / 20) * 0.12;
  const coreWidth = laserWidth * 0.22 * corePulse;

  ctx.save();
  ctx.globalAlpha = beamAlpha * flicker * 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, -coreWidth, laserLength * 0.75, coreWidth * 2);
  ctx.restore();

  // ========================================
  // Origin point (v7.34: 링 알파 0.4→0.55, 크기 증가, shadowBlur 증가)
  // ========================================

  // Single pulse ring (v7.34: 알파값 0.4→0.55, lineWidth 2→2.5, 크기 증가)
  const ringPhase = ((time / 400) % 1);
  const ringRadius = 10 + ringPhase * 20;
  const ringAlpha = Math.max(0, (1 - ringPhase) * 0.55 * beamAlpha);

  ctx.save();
  ctx.globalAlpha = ringAlpha;
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, ringRadius), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Origin glow (v7.34: 알파값 0.6→0.75, shadowBlur 10→14, 크기 12→14, 색상 알파 0.7→0.85)
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.75;
  if (useGlow) {
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.85)`;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Origin core (v7.34: shadowBlur 8→12, 크기 4→5)
  ctx.save();
  ctx.globalAlpha = beamAlpha;
  ctx.fillStyle = '#ffffff';
  if (useGlow) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ========================================
  // Laser end (v7.34: 알파값 증가, 크기 증가, 스파크 개선)
  // ========================================
  if (beamAlpha > 0.4) {
    // End glow (v7.34: 알파값 0.4→0.55, 크기 15→18, 색상 알파 0.6→0.75)
    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.55;
    ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.75)`;
    ctx.beginPath();
    ctx.arc(laserLength, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Spark particles (v7.34: 개수 2→3, 알파값 0.7→0.85, 크기 2→3, 거리 증가)
    for (let s = 0; s < 3; s++) {
      const sparkAngle = (time / 50 + s * (Math.PI * 2 / 3)) % (Math.PI * 2);
      const sparkDist = 12 + Math.sin(time / 18 + s * 1.5) * 5;
      const sx = laserLength + Math.cos(sparkAngle) * sparkDist;
      const sy = Math.sin(sparkAngle) * sparkDist;

      ctx.save();
      ctx.globalAlpha = beamAlpha * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ========================================
  // Recursive indicators (v7.34: 알파값 0.6→0.8, 크기 증가, 펄스 강화)
  // ========================================
  const markerCount = isUltimate ? 3 : isEvolved ? 2 : 2;
  for (let m = 0; m < markerCount; m++) {
    const markerRatio = 0.25 + (m / (markerCount - 1)) * 0.5;
    const markerX = markerRatio * laserLength;
    const markerScale = 0.92 + Math.sin(time / 500 + m * 0.3) * 0.18;
    const markerSize = 4 * markerScale;

    // Marker center (v7.34: 알파값 0.6→0.8, 크기 3→4)
    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(markerX, 0, Math.max(2, markerSize), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ========================================
  // Evolved: Sweeping effects (v7.34: 알파값 0.25→0.4, lineWidth 1→1.5, 길이 증가)
  // ========================================
  if (isEvolved) {
    // Side guide lines (v7.34: 알파값 증가, 선 굵기 증가)
    ctx.save();
    ctx.globalAlpha = 0.4 * beamAlpha * flicker;
    ctx.strokeStyle = glowHex;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, -laserWidth * 1.4);
    ctx.lineTo(laserLength * 0.85, -laserWidth * 1.4);
    ctx.moveTo(0, laserWidth * 1.4);
    ctx.lineTo(laserLength * 0.85, laserWidth * 1.4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ========================================
  // Ultimate: Golden cascade (v7.34: 알파값 증가, shadowBlur 20, 크기 증가)
  // ========================================
  if (isUltimate) {
    // Golden outer aura (v7.34: 알파값 0.2→0.35, shadowBlur 15→20, lineWidth 2→2.5)
    ctx.save();
    ctx.globalAlpha = 0.35 * beamAlpha * flicker;
    if (useGlow) {
      ctx.shadowColor = '#fcd34d';
      ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -laserWidth * 1.7);
    ctx.lineTo(laserLength * 0.9, -laserWidth * 1.7);
    ctx.moveTo(0, laserWidth * 1.7);
    ctx.lineTo(laserLength * 0.9, laserWidth * 1.7);
    ctx.stroke();
    ctx.restore();

    // Cascade particles (v7.34: 개수 2→3, 알파값 0.5→0.7, 크기 2→3)
    for (let c = 0; c < 3; c++) {
      const cascadeProgress = ((time / 300 + c * 0.33) % 1);
      const cascadeX = cascadeProgress * laserLength;
      const cascadeAlpha = Math.sin(cascadeProgress * Math.PI) * 0.7 * beamAlpha;

      if (cascadeAlpha > 0.2) {
        ctx.save();
        ctx.globalAlpha = cascadeAlpha;
        ctx.fillStyle = '#fde68a';
        // Upper cascade
        ctx.beginPath();
        ctx.arc(cascadeX, -laserWidth * 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
        // Lower cascade
        ctx.beginPath();
        ctx.arc(cascadeX, laserWidth * 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
