/**
 * game/rendering/projectiles/weapons/special.ts - 특수 무기 렌더링
 * v37 Phase 4: 카테고리 테마 리디자인
 *   - bridge (냉각 폭탄): ALLIANCE 퍼플 — 극저온 결정 + 동결 오라 + 서리 지대
 *   - beam (레이저 캐논): MORALE 시안 — 직선 에너지 빔 + 충격파
 *   - laser (회전 레이저): MORALE 시안 — 360도 회전 에너지 소 + 잔상 트레일
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
 * 냉각 폭탄 (Cryo Bomb) — ALLIANCE (NETWORK) 카테고리
 * v37 Phase 4: 극저온 결정 + 동결 오라 + 서리 파동 (퍼플 외교/동맹 테마)
 * - 얼음 결정 체인 (퍼플-아이스 혼합)
 * - 동결 노드 (육각 결정 형태)
 * - 진화: 서리 지대 확장 + 다중 결정
 */
export function drawBridge(params: SpecialWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  ctx.rotate(isoRenderAngle(p.angle));
  const time = frameTime ?? Date.now();

  const useGlow = shouldUseGlow();
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // ALLIANCE 컬러 팔레트 (퍼플 계열 + 아이스 톤)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#C4B5FD' : '#8B5CF6');
  const secondaryColor = isUltimate ? '#fde68a' : (isEvolved ? '#E0E7FF' : '#A5B4FC');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '196, 181, 253' : '139, 92, 246');

  // Safe lifeRatio bounds
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));

  // Appear/fade animation
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
  const waveAmplitude = 4 * bridgeScale;
  const nodeSize = 5 * bridgeScale;
  const lineWidth = 3 * bridgeScale;

  // ===== 1. 동결 에너지 글로우 =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.4 * alphaAnim;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(0.5, lineWidth * 2.5);
    ctx.lineCap = 'round';

    ctx.beginPath();
    const glowSegments = 20;
    for (let i = 0; i <= glowSegments; i++) {
      const ratio = i / glowSegments;
      const x = ratio * totalLength;
      const wave = Math.sin((time / 90 + x / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(ratio * Math.PI));
      if (i === 0) ctx.moveTo(x, wave);
      else ctx.lineTo(x, wave);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ===== 2. 메인 냉각 체인 라인 =====
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
  const chainSegments = 25;
  for (let i = 0; i <= chainSegments; i++) {
    const ratio = i / chainSegments;
    const x = ratio * totalLength;
    const wave = Math.sin((time / 90 + x / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(ratio * Math.PI));
    if (i === 0) ctx.moveTo(x, wave);
    else ctx.lineTo(x, wave);
  }
  ctx.stroke();
  ctx.restore();

  // ===== 3. 동결 결정 노드 (육각형) =====
  const nodeCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let idx = 0; idx < nodeCount; idx++) {
    const posRatio = 0.15 + (idx / (nodeCount - 1)) * 0.7;
    const posX = posRatio * totalLength;
    const wave = Math.sin((time / 90 + posX / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(posRatio * Math.PI));

    const bounceScale2 = 1.1 + Math.sin(time / 500 + idx) * 0.12;
    const currentNodeSize = nodeSize * bounceScale2;

    // 육각형 결정 노드
    ctx.save();
    ctx.globalAlpha = alphaAnim;
    ctx.fillStyle = '#1a103d';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1.5, lineWidth * 0.9);
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 10;
    }

    // 육각형 그리기
    ctx.beginPath();
    for (let h = 0; h < 6; h++) {
      const hAngle = (h / 6) * Math.PI * 2 - Math.PI / 6;
      const hx = posX + Math.cos(hAngle) * currentNodeSize;
      const hy = wave + Math.sin(hAngle) * currentNodeSize;
      if (h === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 결정 내부 십자 패턴 (얼음 결정 느낌)
    if (bridgeScale > 0.45) {
      ctx.save();
      ctx.globalAlpha = 0.5 * alphaAnim;
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1;
      // 6방향 빗금
      for (let l = 0; l < 3; l++) {
        const lAngle = (l / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(posX + Math.cos(lAngle) * currentNodeSize * 0.6, wave + Math.sin(lAngle) * currentNodeSize * 0.6);
        ctx.lineTo(posX - Math.cos(lAngle) * currentNodeSize * 0.6, wave - Math.sin(lAngle) * currentNodeSize * 0.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ===== 4. 냉기 파티클 (서리 입자) =====
  const particleCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  const particleSize = Math.max(2.5, 3 * bridgeScale);

  for (let i = 0; i < particleCount; i++) {
    const baseProgress = ((time / 350 + i / particleCount) % 1);
    const flowProgress = EASING.easeInOutSine(baseProgress);
    const visibleProgress = 0.1 + flowProgress * 0.8;
    const px = visibleProgress * totalLength;
    const py = Math.sin((time / 90 + px / 8)) * waveAmplitude * EASING.easeInOutSine(Math.sin(visibleProgress * Math.PI));

    ctx.save();
    ctx.globalAlpha = 0.85 * alphaAnim;
    if (useGlow) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
    }
    // 다이아몬드 형태 (서리 결정)
    ctx.fillStyle = secondaryColor;
    ctx.beginPath();
    ctx.moveTo(px, py - particleSize);
    ctx.lineTo(px + particleSize * 0.7, py);
    ctx.lineTo(px, py + particleSize);
    ctx.lineTo(px - particleSize * 0.7, py);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ===== 5. 진화: 서리 분기 =====
  if (isEvolved || isUltimate) {
    const branchOffset = 9 * bridgeScale;

    ctx.save();
    ctx.globalAlpha = 0.5 * alphaAnim;
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = Math.max(0.8, lineWidth * 0.7);
    ctx.setLineDash([4 * bridgeScale, 3 * bridgeScale]);

    // 상단 서리 분기
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const ratio = 0.3 + (i / 8) * 0.4;
      const x = ratio * totalLength;
      const baseWave = Math.sin((time / 90 + x / 8)) * waveAmplitude;
      if (i === 0) ctx.moveTo(x, baseWave * 0.5);
      else ctx.lineTo(x, baseWave - branchOffset);
    }
    ctx.stroke();

    // 하단 서리 분기
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const ratio = 0.3 + (i / 8) * 0.4;
      const x = ratio * totalLength;
      const baseWave = Math.sin((time / 90 + x / 8)) * waveAmplitude;
      if (i === 0) ctx.moveTo(x, baseWave * 0.5);
      else ctx.lineTo(x, baseWave + branchOffset);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 궁극: 절대영도 라벨
    if (isUltimate) {
      const labelPulse = Math.sin(time / 200) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.8 * alphaAnim * labelPulse;
      ctx.fillStyle = mainColor;
      ctx.font = `bold ${Math.max(7, 8 * bridgeScale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('ABS ZERO', totalLength * 0.5, -branchOffset * 1.5);
      ctx.restore();
    }
  }

  // ===== 6. 서리 스파크 =====
  const sparkCount = 3;
  for (let s = 0; s < sparkCount; s++) {
    const sparkProgress = (((time / 90) + s * 0.33) % 1);
    const sparkX = sparkProgress * totalLength;
    const sparkWave = Math.sin((time / 90 + sparkX / 8)) * waveAmplitude;
    const sparkAlpha = Math.sin(sparkProgress * Math.PI) * 0.85 * alphaAnim;

    if (sparkAlpha > 0.25) {
      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkWave, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ============================================================================
// Stack Trace - Laser Pointer Beam (beam)
// ============================================================================

/**
 * 레이저 캐논 (Laser Cannon) — MORALE (SYSTEM) 카테고리
 * v37 Phase 4: 직선 에너지 빔 + 충격파 + 사기 파동 (시안 사기/여론 테마)
 * - 에너지 집중 → 빔 발사 (차지업 연출)
 * - 빔 끝 임팩트 충격파
 * - 진화: 입자 빔 확대 + 전파 효과
 */
export function drawBeam(params: SpecialWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const beamWidth = (p.width || 20) * 0.45;
  const beamLength = p.height || 600;

  const useGlow = shouldUseGlow();
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.5)));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  ctx.rotate(isoRenderAngle(p.angle));

  // Progress and phase
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));
  let beamAlpha = 1;
  let beamScale = 1;

  if (progress < 0.15) {
    const ap = Math.max(0, Math.min(1, progress / 0.15));
    beamScale = Math.max(0.1, EASING.easeOutBack(ap));
    beamAlpha = Math.max(0.1, EASING.easeOutQuad(ap));
  } else if (progress > 0.85) {
    const fp = Math.max(0, Math.min(1, (progress - 0.85) / 0.15));
    beamAlpha = Math.max(0.1, 1 - EASING.easeOutQuad(fp));
    beamScale = Math.max(0.1, 1 - fp * 0.5);
  }

  const actualLength = beamLength * beamScale;
  const flicker = 0.88 + Math.sin(time / 18) * 0.12;

  // MORALE 컬러 팔레트 (시안 계열)
  const beamColor = isUltimate
    ? { r: 250, g: 204, b: 21 }   // Gold
    : isEvolved
      ? { r: 103, g: 232, b: 249 } // Light cyan
      : { r: 6, g: 182, b: 212 };  // Cyan

  const hexColor = isUltimate ? '#facc15' : isEvolved ? '#67E8F9' : '#06B6D4';
  const deepColor = isUltimate ? '#92400E' : '#164E63';

  // ===== 1. 캐논 본체 (사기 방송기 형태) =====
  ctx.save();
  ctx.globalAlpha = beamAlpha;
  ctx.fillStyle = deepColor;
  if (useGlow) {
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.roundRect(-10, -6, 24, 12, 4);
  ctx.fill();
  ctx.restore();

  // 디테일 라인
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.7;
  ctx.fillStyle = hexColor;
  ctx.fillRect(-7, -3, 18, 1.5);
  ctx.fillRect(-7, 2, 14, 1);
  ctx.restore();

  // 전파 인디케이터
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
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(5.5, -0.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 이미터
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

  // ===== 2. 빔 글로우 =====
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

  // ===== 3. 메인 빔 =====
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.92;
  ctx.fillStyle = `rgba(${beamColor.r}, ${beamColor.g}, ${beamColor.b}, 0.95)`;
  ctx.fillRect(emitterX, -beamWidth * 0.75, actualLength, beamWidth * 1.5);
  ctx.restore();

  // ===== 4. 코어 빔 (밝은 중심) =====
  const corePulse = 0.85 + Math.sin(time / 30) * 0.15;
  const coreWidth = beamWidth * 0.32 * corePulse;

  ctx.save();
  ctx.globalAlpha = beamAlpha * flicker * 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(emitterX, -coreWidth, actualLength * 0.75, coreWidth * 2);
  ctx.restore();

  // ===== 5. 빔 파티클 (에너지 입자) =====
  const particleCount = 6;
  for (let i = 0; i < particleCount; i++) {
    const pSpeed = 45 + i * 12;
    const pProgress = ((time / pSpeed + i * 50) % actualLength) / actualLength;
    const px = emitterX + pProgress * actualLength;
    const pyOffset = Math.sin(time / 25 + i * 1.5) * beamWidth * 0.5;
    const pAlpha = Math.sin(pProgress * Math.PI) * beamAlpha * flicker;

    if (pAlpha > 0.15) {
      ctx.save();
      ctx.globalAlpha = pAlpha * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, pyOffset, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 6. 빔 끝 임팩트 =====
  if (beamScale > 0.5) {
    const endX = emitterX + actualLength;

    // 임팩트 링
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

    // 중앙 임팩트 글로우
    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.6;
    ctx.fillStyle = `rgba(${beamColor.r}, ${beamColor.g}, ${beamColor.b}, 0.7)`;
    ctx.beginPath();
    ctx.arc(endX, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 스파크
    for (let s = 0; s < 4; s++) {
      const sAngle = (time / 70 + s * (Math.PI * 2 / 4)) % (Math.PI * 2);
      const sDist = 14 + Math.sin(time / 22 + s * 2) * 6;
      ctx.save();
      ctx.globalAlpha = beamAlpha * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(endX + Math.cos(sAngle) * sDist, Math.sin(sAngle) * sDist, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 7. 진화: 전파 스캔 =====
  if (isEvolved && beamScale > 0.3) {
    // 사이드 가이드 라인 (전파 경계)
    ctx.save();
    ctx.globalAlpha = 0.45 * beamAlpha * flicker;
    ctx.strokeStyle = '#67E8F9';
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

    // 전파 스캔 바
    const scanProgress = ((time / 15) % actualLength);
    ctx.save();
    ctx.globalAlpha = 0.65 * beamAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(emitterX + scanProgress, -beamWidth * 1.1, 3, beamWidth * 2.2);
    ctx.restore();
  }

  // ===== 8. 차지업 이펙트 =====
  if (progress < 0.2) {
    const chargeRatio = EASING.easeOutCubic(Math.max(0, Math.min(1, progress / 0.2)));

    ctx.save();
    ctx.globalAlpha = chargeRatio * 0.9;
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

    for (let c = 0; c < 3; c++) {
      const cAngle = (c / 3) * Math.PI * 2 + time / 150;
      const cDist = 25 * (1 - chargeRatio);
      ctx.save();
      ctx.globalAlpha = chargeRatio * 0.85;
      ctx.fillStyle = hexColor;
      ctx.beginPath();
      ctx.arc(emitterX + Math.cos(cAngle) * cDist, Math.sin(cAngle) * cDist, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 9. 궁극: 궤도 타격 =====
  if (isUltimate) {
    ctx.save();
    ctx.globalAlpha = 0.45 * beamAlpha * flicker;
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

    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.4;
    ctx.fillStyle = 'rgba(253, 230, 138, 0.6)';
    ctx.fillRect(emitterX, -beamWidth * 0.5, actualLength * 0.85, beamWidth);
    ctx.restore();
  }
}

// ============================================================================
// Recursive Loop - Rotating Laser (laser)
// ============================================================================

/**
 * 회전 레이저 (Spinning Saw) — MORALE (SYSTEM) 카테고리
 * v37 Phase 4: 360도 회전 에너지 소 + 잔상 트레일 (시안 사기/여론 테마)
 * - 회전하며 베는 에너지 빔
 * - 원점 펄스 링 (사기 파동)
 * - 진화: 이중 회전 + 사이버 톱날
 */
export function drawLaser(params: SpecialWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const laserLength = p.radius || 100;
  const laserWidth = 10;

  const useGlow = shouldUseGlow();
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.8)));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;
  const progress = Math.max(0, Math.min(1, 1 - lifeRatio));

  const laserAngle = p.angle || 0;

  // Fade effect
  let beamAlpha = 1;
  if (progress < 0.1) {
    const ap = Math.max(0, Math.min(1, progress / 0.1));
    beamAlpha = Math.max(0.1, EASING.easeOutQuad(ap));
  } else if (progress > 0.9) {
    const fp = Math.max(0, Math.min(1, (progress - 0.9) / 0.1));
    beamAlpha = Math.max(0.1, 1 - EASING.easeOutQuad(fp));
  }

  const flicker = 0.92 + Math.sin(time / 12) * 0.08;

  // MORALE 컬러 팔레트 (시안 계열)
  const laserColor = isUltimate
    ? { r: 251, g: 191, b: 36 }   // Amber/Gold
    : isEvolved
      ? { r: 103, g: 232, b: 249 } // Light cyan
      : { r: 6, g: 182, b: 212 };  // Cyan

  const hexColor = isUltimate ? '#fbbf24' : isEvolved ? '#67E8F9' : '#06B6D4';
  const glowHex = isUltimate ? '#fcd34d' : isEvolved ? '#A5F3FC' : '#22D3EE';

  ctx.rotate(laserAngle);

  // ===== 1. 잔상 트레일 =====
  const sweepDirection = (p as { sweepDirection?: number }).sweepDirection || 1;
  const trailCount = 3;

  for (let t = trailCount; t > 0; t--) {
    const trailAngleOffset = -t * 0.08 * sweepDirection;
    const trailProg = Math.max(0, Math.min(1, 1 - t / trailCount));
    const trailAlpha = EASING.easeOutQuad(trailProg) * 0.35 * beamAlpha;
    const trailLen = laserLength * (0.55 + trailProg * 0.4);

    ctx.save();
    ctx.rotate(trailAngleOffset);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.8)`;
    ctx.fillRect(0, -laserWidth * 0.3, trailLen, laserWidth * 0.6);
    ctx.restore();
  }

  // ===== 2. 빔 글로우 =====
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

  // ===== 3. 메인 빔 =====
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.95;
  ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 1.0)`;
  ctx.fillRect(0, -laserWidth * 0.6, laserLength, laserWidth * 1.2);
  ctx.restore();

  // ===== 4. 코어 빔 (밝은 중심) =====
  const corePulse = 0.88 + Math.sin(time / 20) * 0.12;
  const coreWidth = laserWidth * 0.22 * corePulse;

  ctx.save();
  ctx.globalAlpha = beamAlpha * flicker * 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, -coreWidth, laserLength * 0.75, coreWidth * 2);
  ctx.restore();

  // ===== 5. 원점 펄스 링 (사기 파동) =====
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

  // 원점 글로우
  ctx.save();
  ctx.globalAlpha = beamAlpha * 0.7;
  if (useGlow) {
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.85)`;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 원점 코어
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

  // ===== 6. 빔 끝 스파크 =====
  if (beamAlpha > 0.4) {
    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.5;
    ctx.fillStyle = `rgba(${laserColor.r}, ${laserColor.g}, ${laserColor.b}, 0.75)`;
    ctx.beginPath();
    ctx.arc(laserLength, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let s = 0; s < 3; s++) {
      const sAngle = (time / 50 + s * (Math.PI * 2 / 3)) % (Math.PI * 2);
      const sDist = 10 + Math.sin(time / 18 + s * 1.5) * 5;
      ctx.save();
      ctx.globalAlpha = beamAlpha * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(laserLength + Math.cos(sAngle) * sDist, Math.sin(sAngle) * sDist, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 7. 에너지 마커 (빔 중간 노드) =====
  const markerCount = isUltimate ? 3 : isEvolved ? 2 : 2;
  for (let m = 0; m < markerCount; m++) {
    const markerRatio = 0.25 + (m / (markerCount - 1)) * 0.5;
    const markerX = markerRatio * laserLength;
    const markerScale = 0.92 + Math.sin(time / 500 + m * 0.3) * 0.18;

    ctx.save();
    ctx.globalAlpha = beamAlpha * 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(markerX, 0, Math.max(2, 4 * markerScale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===== 8. 진화: 사이드 가이드 =====
  if (isEvolved) {
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

  // ===== 9. 궁극: 골드 캐스케이드 =====
  if (isUltimate) {
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

    for (let c = 0; c < 3; c++) {
      const cascProg = ((time / 300 + c * 0.33) % 1);
      const cascX = cascProg * laserLength;
      const cascAlpha = Math.sin(cascProg * Math.PI) * 0.7 * beamAlpha;

      if (cascAlpha > 0.2) {
        ctx.save();
        ctx.globalAlpha = cascAlpha;
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(cascX, -laserWidth * 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cascX, laserWidth * 0.8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
