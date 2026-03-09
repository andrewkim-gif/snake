/**
 * game/rendering/projectiles/effects.ts - 특수 투사체 이펙트 (v4.9 Stylish)
 *
 * Lightning Bolt (Claude Assist) 등 특수 이펙트 렌더링
 *
 * v4.9: Multi-layer glow, eased animations, pulse effects, energy particles
 * v4.9.1: LOD-aware globalCompositeOperation 최적화
 * v7.20: 성능 최적화 - easing 통합 모듈 사용, time 파라미터화
 */

import { EASING } from '../effects/easing';
import { shouldUseGlow } from '../enemies/renderContext';

// v7.20: 공통 easing 모듈 사용 (중복 제거 - EASING import 활용)

// ============================================================================
// Claude Assist - Lightning Bolt (v4.9 Stylish)
// ============================================================================

/**
 * Claude Assist - 타로카드 번개 효과
 *
 * v4.9 Features:
 * - Multi-layer lightning glow with sequential blur
 * - Eased appear/fade animation
 * - Branch lightning sub-effects
 * - Energy particles along bolt path
 * - Animated tarot card origin with pulse
 * - Impact sparks with physics
 * - Ambient glow and flicker effects
 */
export const drawLightningBolt = (
  ctx: CanvasRenderingContext2D,
  bolt: {
    segments: { x: number; y: number }[];
    color: string;
    life: number;
    maxLife: number;
    width: number;
    isEvolved?: boolean;
    isUltimate?: boolean;
  },
  frameTime?: number // v7.20: 프레임당 1회만 Date.now() 호출하여 전달
): void => {
  if (bolt.segments.length < 2) return;

  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백

  // Safe alpha calculation with bounds
  const lifeRatio = Math.max(0, Math.min(1, bolt.life / (bolt.maxLife || 1)));

  // Eased appear/fade animation
  let alpha = 1;
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));

  if (progress < 0.1) {
    // Quick appear with easing
    const appearProgress = Math.max(0, Math.min(1, progress / 0.1));
    alpha = Math.max(0.1, EASING.easeOutQuad(appearProgress));
  } else if (progress > 0.7) {
    // Slower fade out
    const fadeProgress = Math.max(0, Math.min(1, (progress - 0.7) / 0.3));
    alpha = Math.max(0.1, 1 - EASING.easeOutQuad(fadeProgress));
  }

  // Flicker effect for electrical feel
  const flicker = 0.85 + Math.sin(time / 10) * 0.1 + Math.random() * 0.05;
  alpha *= flicker;

  const isEvolved = bolt.isEvolved;
  const isUltimate = bolt.isUltimate;

  // Color scheme - Claude Purple / Gold Ultimate
  const mainColor = isUltimate ? '#fbbf24' : isEvolved ? '#c084fc' : bolt.color || '#a78bfa';
  const coreColor = '#ffffff';
  const glowColor = isUltimate
    ? 'rgba(251, 191, 36,'
    : isEvolved
      ? 'rgba(192, 132, 252,'
      : 'rgba(167, 139, 250,';

  const startPos = bolt.segments[0];
  const endPos = bolt.segments[bolt.segments.length - 1];

  ctx.save();

  // ========================================
  // Multi-layer lightning glow
  // ========================================
  const glowLayers = [
    { blur: 30, alpha: 0.08, width: bolt.width + 20 },
    { blur: 20, alpha: 0.15, width: bolt.width + 12 },
    { blur: 12, alpha: 0.25, width: bolt.width + 6 },
    { blur: 6, alpha: 0.4, width: bolt.width + 3 },
  ];

  const useGlow = shouldUseGlow(); // v4.9.1: LOD 캐시

  for (const layer of glowLayers) {
    ctx.save();
    ctx.globalAlpha = alpha * layer.alpha;
    if (useGlow) ctx.globalCompositeOperation = 'lighter'; // v4.9.1: LOD-aware
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1, layer.width);
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = layer.blur;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
    for (let i = 1; i < bolt.segments.length; i++) {
      ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ========================================
  // Main lightning bolt body
  // ========================================
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  if (useGlow) ctx.globalCompositeOperation = 'lighter'; // v4.9.1: LOD-aware
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = Math.max(2, bolt.width + 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }

  ctx.beginPath();
  ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
  for (let i = 1; i < bolt.segments.length; i++) {
    ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // ========================================
  // Lightning core (bright white center)
  // ========================================
  ctx.save();
  ctx.globalAlpha = alpha * 0.95;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = Math.max(1, bolt.width * 0.6);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = coreColor;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
  for (let i = 1; i < bolt.segments.length; i++) {
    ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // ========================================
  // Branch lightning sub-effects
  // ========================================
  const branchCount = isUltimate ? 4 : isEvolved ? 3 : 2;
  const branchAlpha = alpha * 0.5;

  for (let b = 0; b < branchCount; b++) {
    // Pick a random segment point for branch origin
    const branchIdx = Math.floor((b + 1) * bolt.segments.length / (branchCount + 1));
    if (branchIdx >= bolt.segments.length) continue;

    const branchOrigin = bolt.segments[branchIdx];
    const branchAngle = ((time / 200 + b * 1.5) % Math.PI) - Math.PI / 2;
    const branchLength = 15 + Math.sin(time / 100 + b) * 8;

    // Generate branch segments
    const branchSegments = 4;
    let bx = branchOrigin.x;
    let by = branchOrigin.y;

    ctx.save();
    ctx.globalAlpha = branchAlpha;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1, bolt.width * 0.4);
    ctx.lineCap = 'round';
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(bx, by);

    for (let s = 0; s < branchSegments; s++) {
      const segLength = branchLength / branchSegments;
      const jitter = (Math.random() - 0.5) * 0.5;
      bx += Math.cos(branchAngle + jitter) * segLength;
      by += Math.sin(branchAngle + jitter) * segLength;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ========================================
  // Energy particles along bolt path
  // ========================================
  const particleCount = isUltimate ? 10 : isEvolved ? 8 : 6;

  for (let i = 0; i < particleCount; i++) {
    const particleProgress = ((time / 80 + i * 50) % (bolt.segments.length * 100)) / (bolt.segments.length * 100);
    const segIdx = Math.floor(particleProgress * (bolt.segments.length - 1));
    const nextIdx = Math.min(segIdx + 1, bolt.segments.length - 1);
    const segProgress = (particleProgress * (bolt.segments.length - 1)) % 1;

    const px = bolt.segments[segIdx].x + (bolt.segments[nextIdx].x - bolt.segments[segIdx].x) * segProgress;
    const py = bolt.segments[segIdx].y + (bolt.segments[nextIdx].y - bolt.segments[segIdx].y) * segProgress;

    // Offset from main line
    const offsetAngle = time / 30 + i * 2;
    const offsetDist = Math.sin(time / 20 + i) * 6;
    const particleX = px + Math.cos(offsetAngle) * offsetDist;
    const particleY = py + Math.sin(offsetAngle) * offsetDist;

    const particleAlpha = Math.sin(particleProgress * Math.PI) * alpha * 0.8;
    const particleSize = 2 + Math.sin(time / 25 + i) * 1;

    if (particleAlpha > 0.1) {
      ctx.save();
      ctx.globalAlpha = particleAlpha;
      ctx.fillStyle = coreColor;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(particleX, particleY, Math.max(1, particleSize), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ========================================
  // Tarot card at origin with animation
  // ========================================
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(startPos.x, startPos.y);

  // Card rotation with elastic easing
  const cardRotationBase = time / 300;
  const cardWobble = Math.sin(time / 80) * 0.1;
  ctx.rotate(cardRotationBase + cardWobble);

  // Card scale with pulse
  const cardPulse = 1 + Math.sin(time / 150) * 0.08;
  ctx.scale(cardPulse, cardPulse);

  // Card outer glow
  ctx.save();
  ctx.globalAlpha = alpha * 0.4;
  ctx.shadowColor = mainColor;
  ctx.shadowBlur = 20;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.roundRect(-10, -15, 20, 30, 3);
  ctx.fill();
  ctx.restore();

  // Card background with gradient
  const cardGrad = ctx.createLinearGradient(-8, -12, 8, 12);
  cardGrad.addColorStop(0, isUltimate ? '#451a03' : '#1e1b4b');
  cardGrad.addColorStop(0.5, isUltimate ? '#78350f' : '#312e81');
  cardGrad.addColorStop(1, isUltimate ? '#451a03' : '#1e1b4b');

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = mainColor;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(-9, -13, 18, 26, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Card inner border
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = `${glowColor}0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-7, -11, 14, 22, 2);
  ctx.stroke();
  ctx.restore();

  // Star symbol with animation
  const starPulse = 1 + Math.sin(time / 100) * 0.15;
  const starColor = isUltimate ? '#fcd34d' : '#facc15';

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.scale(starPulse, starPulse);

  // Star glow
  ctx.shadowColor = starColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = starColor;

  ctx.beginPath();
  for (let s = 0; s < 5; s++) {
    const sAngle = (s / 5) * Math.PI * 2 - Math.PI / 2;
    const outerR = 5;
    const innerR = 2;
    const ox = Math.cos(sAngle) * outerR;
    const oy = Math.sin(sAngle) * outerR;
    const ix = Math.cos(sAngle + Math.PI / 5) * innerR;
    const iy = Math.sin(sAngle + Math.PI / 5) * innerR;
    if (s === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Ultimate: Extra symbols
  if (isUltimate) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 6px serif';
    ctx.textAlign = 'center';
    ctx.fillText('AI', 0, 9);
    ctx.restore();
  }

  ctx.restore(); // End card transform

  // ========================================
  // Origin pulse rings
  // ========================================
  for (let ring = 0; ring < 3; ring++) {
    const ringPhase = ((time / 350 + ring * 0.33) % 1);
    const ringRadius = 12 + ringPhase * 25;
    const ringAlpha = Math.max(0, (1 - ringPhase) * 0.35 * alpha);

    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1, 2.5 - ringPhase * 1.5);
    ctx.beginPath();
    ctx.arc(startPos.x, startPos.y, Math.max(1, ringRadius), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ========================================
  // Impact sparks at endpoint
  // ========================================
  ctx.save();
  ctx.translate(endPos.x, endPos.y);

  // Impact glow
  const impactGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  impactGlow.addColorStop(0, `${glowColor}${alpha * 0.6})`);
  impactGlow.addColorStop(0.4, `${glowColor}${alpha * 0.3})`);
  impactGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = impactGlow;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();

  // Rotating sparks with physics
  const sparkCount = isUltimate ? 12 : isEvolved ? 10 : 8;
  for (let sp = 0; sp < sparkCount; sp++) {
    const baseAngle = (sp / sparkCount) * Math.PI * 2;
    const sparkAngle = baseAngle + time / 40;
    const sparkDist = 12 + Math.sin(time / 25 + sp * 1.2) * 7;
    const sparkVelocity = Math.cos(time / 50 + sp) * 4;

    const sx = Math.cos(sparkAngle) * (sparkDist + sparkVelocity);
    const sy = Math.sin(sparkAngle) * (sparkDist + sparkVelocity);
    const sparkSize = 2.5 + Math.random() * 2;
    const sparkAlpha = alpha * (0.7 + Math.random() * 0.3);

    ctx.save();
    ctx.globalAlpha = sparkAlpha;
    ctx.fillStyle = sp % 2 === 0 ? coreColor : mainColor;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1, sparkSize), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Impact core flash
  const flashPulse = 0.8 + Math.sin(time / 20) * 0.2;
  ctx.save();
  ctx.globalAlpha = alpha * 0.9 * flashPulse;
  ctx.fillStyle = coreColor;
  ctx.shadowColor = coreColor;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore(); // End impact transform

  // ========================================
  // Evolved/Ultimate: Extra electric arcs
  // ========================================
  if (isEvolved || isUltimate) {
    const arcCount = isUltimate ? 3 : 2;

    for (let arc = 0; arc < arcCount; arc++) {
      const arcPhase = ((time / 200 + arc * 0.5) % 1);
      const arcAlpha = Math.sin(arcPhase * Math.PI) * alpha * 0.4;

      if (arcAlpha > 0.1) {
        // Arc travels along the bolt
        const arcProgress = arcPhase;
        const arcSegIdx = Math.floor(arcProgress * (bolt.segments.length - 1));
        const nextArcIdx = Math.min(arcSegIdx + 1, bolt.segments.length - 1);

        const arcX = bolt.segments[arcSegIdx].x + (bolt.segments[nextArcIdx].x - bolt.segments[arcSegIdx].x) * (arcProgress * (bolt.segments.length - 1) % 1);
        const arcY = bolt.segments[arcSegIdx].y + (bolt.segments[nextArcIdx].y - bolt.segments[arcSegIdx].y) * (arcProgress * (bolt.segments.length - 1) % 1);

        // Mini lightning burst
        ctx.save();
        ctx.globalAlpha = arcAlpha;
        ctx.translate(arcX, arcY);

        const burstCount = 4;
        for (let burst = 0; burst < burstCount; burst++) {
          const burstAngle = (burst / burstCount) * Math.PI * 2 + time / 100;
          const burstLength = 8 + Math.random() * 6;

          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = mainColor;
          ctx.shadowBlur = 4;

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(burstAngle) * burstLength,
            Math.sin(burstAngle) * burstLength
          );
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // ========================================
  // Ultimate: Golden aura effect
  // ========================================
  if (isUltimate) {
    // Golden ambient particles
    const ambientCount = 6;
    for (let a = 0; a < ambientCount; a++) {
      const ambientProgress = ((time / 500 + a * 0.16) % 1);
      const segIdx = Math.floor(ambientProgress * (bolt.segments.length - 1));
      const nextIdx = Math.min(segIdx + 1, bolt.segments.length - 1);

      const ambientX = bolt.segments[segIdx].x + (bolt.segments[nextIdx].x - bolt.segments[segIdx].x) * (ambientProgress * (bolt.segments.length - 1) % 1);
      const ambientY = bolt.segments[segIdx].y + (bolt.segments[nextIdx].y - bolt.segments[segIdx].y) * (ambientProgress * (bolt.segments.length - 1) % 1);

      const driftX = Math.sin(time / 40 + a * 2) * 15;
      const driftY = Math.cos(time / 35 + a * 1.5) * 15;
      const ambientAlpha = Math.sin(ambientProgress * Math.PI) * alpha * 0.5;

      ctx.save();
      ctx.globalAlpha = ambientAlpha;
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ambientX + driftX, ambientY + driftY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ultimate label
    const labelPos = bolt.segments[Math.floor(bolt.segments.length / 2)];
    const labelPulse = 0.6 + Math.sin(time / 120) * 0.4;

    ctx.save();
    ctx.globalAlpha = alpha * labelPulse * 0.7;
    ctx.fillStyle = '#fcd34d';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.fillText('CLAUDE', labelPos.x, labelPos.y - 15);
    ctx.restore();
  }

  ctx.restore();
};

// ==========================================
// NEW ENEMY RENDERING SYSTEM (AI/MATRIX THEME v4)
// CODE SURVIVOR - AI vs Programmer
// ==========================================
