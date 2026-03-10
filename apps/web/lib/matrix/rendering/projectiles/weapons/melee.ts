/**
 * game/rendering/projectiles/weapons/melee.ts - 근접 무기 렌더링
 * v37: STEEL 카테고리 군사 테마 리디자인
 *   - whip (전투 채찍 / Assault Rifle): 총구 화염 + 탄도 궤적 + 잔상
 *   - punch (강철 주먹 / Power Smash): 충격파 + 에너지 빔 + 파동 패턴
 *   - axe (전술 토마호크 / Scatter Shot): 파편 산개 + 방사형 투사체
 *   - sword (삼단봉 / Blade Aura): 호형 참격파 + 잔상 트레일
 *
 * STEEL 컬러: #EF4444(메인레드) → #FCA5A5(하이라이트) → #7F1D1D(그림자)
 */

import { shouldUseGlow } from '../../enemies/renderContext';
import { drawProjectileShadow, ISO_Z_TO_SCREEN_Y, isoRenderAngle } from '../../../isometric';
import { EASING } from '../../effects/easing';

export interface MeleeWeaponParams {
  ctx: CanvasRenderingContext2D;
  p: any;
  playerPos?: { x: number; y: number };
  time?: number; // v7.20: 프레임당 1회만 Date.now() 호출하여 전달
}

// v7.20: 공통 easing 모듈 사용 (중복 제거)

// ===== 헬퍼 함수들 (먼저 정의) =====

// Quadratic Bezier 곡선 위의 점 계산
function quadraticBezierPoint(
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1
  };
}

// v7.34: 두꺼운 쇄사슬 체인 렌더링 (알파값 및 글로우 개선)
function drawWhipChain(
  ctx: CanvasRenderingContext2D,
  length: number,
  curvature: number,
  color: string,
  baseWidth: number,
  time: number,
  useGlow: boolean
): void {
  const linkCount = 10;

  // 베지어 곡선 제어점
  const endX = length;
  const endY = 0;
  const controlX = length * 0.5;
  const controlY = curvature * length * 0.65;

  // 글로우 효과 (v7.34: shadowBlur 12→16)
  if (useGlow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
  }

  for (let i = 0; i < linkCount; i++) {
    const t = i / linkCount;
    const tNext = (i + 0.65) / linkCount;

    // 베지어 경로상 위치
    const pos = quadraticBezierPoint(0, 0, controlX, controlY, endX, endY, t);
    const nextPos = quadraticBezierPoint(0, 0, controlX, controlY, endX, endY, Math.min(1, tNext));

    // 접선 각도 계산
    const tangentAngle = Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x);

    // 체인 흔들림 (시간 + 위치 기반)
    const wobble = Math.sin(time / 40 + i * 0.8) * 0.12 * (1 - t * 0.5);

    // v7.34: 링크 크기 증가 (끝도 더 두꺼움)
    const sizeRatio = Math.pow(1 - t * 0.35, 0.65);
    const linkWidth = baseWidth * sizeRatio * 1.1;
    const linkHeight = linkWidth * 2.6;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(tangentAngle + wobble);

    // 링크 본체 (v7.34: 더 선명한 채우기)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-linkHeight / 2, -linkWidth / 2, linkHeight, linkWidth, linkWidth / 2);
    ctx.fill();

    // v7.34: 테두리 알파 0.4→0.55, lineWidth 2→2.5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 하이라이트 (v7.34: 알파 0.5→0.65, 크기 증가)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-linkHeight * 0.15, -linkWidth * 0.2, linkHeight * 0.28, linkWidth * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // v7.34: 조인트 크기 증가, 알파값 개선
    if (i < linkCount - 1) {
      const jointT = (i + 0.5) / linkCount;
      const jointPos = quadraticBezierPoint(0, 0, controlX, controlY, endX, endY, jointT);
      const jointSize = linkWidth * 0.75;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(jointPos.x, jointPos.y, jointSize, 0, Math.PI * 2);
      ctx.fill();

      // 조인트 테두리 (v7.34: 알파 0.3→0.45, lineWidth 1.5→2)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 조인트 하이라이트 (v7.34: 알파 0.6→0.75, 크기 증가)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(jointPos.x - jointSize * 0.25, jointPos.y - jointSize * 0.25, jointSize * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.shadowBlur = 0;
}

// ===== whip (전투 채찍 / Assault Rifle) - STEEL 카테고리 =====
// v37: 총구 화염 + 탄도 궤적 + 슬래시 라인 (군사 테마)
export function drawWhipProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();
  const whipLength = Math.max(60, p.radius * 3.6);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.3)));
  const swingProgress = Math.max(0, Math.min(1, 1 - lifeRatio));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // STEEL 컬러 팔레트 (레드 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#FCA5A5' : '#EF4444');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '252, 165, 165' : '239, 68, 68');
  const coreColor = isUltimate ? '#FEF3C7' : (isEvolved ? '#FEE2E2' : '#FCA5A5');

  // 스윙 범위 (충돌 판정과 동기화)
  const swingStart = -Math.PI * 0.33;
  const swingEnd = Math.PI * 0.44;
  const swingRange = swingEnd - swingStart;
  const swingAngle = swingStart + swingProgress * swingRange;

  // 알파: 빠르게 나타나고 → 유지 → 빠르게 사라짐
  let alpha;
  if (swingProgress < 0.08) {
    alpha = Math.pow(swingProgress / 0.08, 0.5);
  } else if (swingProgress < 0.6) {
    alpha = 1;
  } else {
    alpha = 1 - Math.pow((swingProgress - 0.6) / 0.4, 1.5);
  }

  ctx.rotate(p.angle + swingAngle);

  ctx.save();
  ctx.globalAlpha = alpha;

  // ===== 1. 탄도 궤적 잔상 (3단 트레일) =====
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let t = trailCount; t >= 1; t--) {
    const trailAlpha = (1 - t / (trailCount + 1)) * 0.6;
    const trailLength = whipLength * (1 - t * 0.08);

    ctx.save();
    ctx.globalAlpha = trailAlpha * alpha;
    ctx.strokeStyle = `rgba(${glowRgba}, 0.8)`;
    ctx.lineWidth = Math.max(1, 4 - t * 0.8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(trailLength, 0);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 2. 메인 탄도 라인 (밝은 황색 라인) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5 * alpha;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(whipLength, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 메인 탄도 라인 본체
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(whipLength, 0);
  ctx.stroke();

  // 코어 라인 (밝은 중심)
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(whipLength * 0.8, 0);
  ctx.stroke();

  // ===== 3. 총구 화염 (Muzzle Flash) =====
  const flashProgress = Math.max(0, 1 - swingProgress * 3); // 초반에만 밝음
  if (flashProgress > 0.05) {
    const flashSize = (isUltimate ? 18 : (isEvolved ? 14 : 10)) * flashProgress;

    // 화염 외곽 (오렌지)
    ctx.save();
    ctx.globalAlpha = flashProgress * 0.7;
    if (useGlow) {
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    // 별 모양 화염
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? flashSize : flashSize * 0.5;
      const fx = Math.cos(a) * r;
      const fy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    ctx.fill();

    // 화염 코어 (황색)
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.arc(0, 0, flashSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===== 4. 탄환 선두 임팩트 (끝부분) =====
  const tipPulse = 0.85 + Math.sin(time / 50) * 0.15;
  const tipSize = (isUltimate ? 6 : (isEvolved ? 5 : 4)) * tipPulse;

  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(whipLength, 0, tipSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ===== 5. 금속 스파크 파티클 (충격 잔해) =====
  const sparkCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let s = 0; s < sparkCount; s++) {
    const sparkPhase = ((time / 60 + s * 0.25) % 1);
    const sparkDist = whipLength * (0.3 + sparkPhase * 0.5);
    const sparkY = Math.sin(time / 30 + s * 2.1) * 6;
    const sparkAlpha = Math.sin(sparkPhase * Math.PI) * 0.8;

    ctx.save();
    ctx.globalAlpha = sparkAlpha * alpha;
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(sparkDist, sparkY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===== 6. 진화/궁극 추가 이펙트 =====
  if (isEvolved || isUltimate) {
    // 이중 궤적선 (바깥쪽 가이드)
    ctx.save();
    ctx.globalAlpha = 0.3 * alpha;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(whipLength * 0.85, -4);
    ctx.moveTo(8, 6);
    ctx.lineTo(whipLength * 0.85, 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (isUltimate && useGlow) {
    // 궁극: 화염 오라
    ctx.save();
    ctx.globalAlpha = 0.3 * alpha;
    ctx.shadowColor = '#fcd34d';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(whipLength * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// v7.36: 아름다운 타원 곡선 채찍
function drawWhipEllipse(
  ctx: CanvasRenderingContext2D,
  length: number,
  curvature: number,  // -1 ~ 1 (양수: 아래로 휨, 음수: 위로 휨)
  color: string,
  width: number,
  tapered: boolean
): void {
  // 끝점 (항상 오른쪽으로 length만큼)
  const endX = length;
  const endY = 0;

  // v7.39: 제어점 - 더 깊은 곡선 (0.5 → 0.65)
  const controlX = length * 0.5;
  const controlY = curvature * length * 0.65; // 곡률에 따라 위/아래로 (더 심하게)

  if (tapered) {
    // 테이퍼드: 여러 세그먼트로 두께 변화
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;

      // Quadratic Bezier 점 계산
      const p1 = quadraticBezierPoint(0, 0, controlX, controlY, endX, endY, t1);
      const p2 = quadraticBezierPoint(0, 0, controlX, controlY, endX, endY, t2);

      // 두께: 끝으로 갈수록 얇아짐
      const w = width * Math.pow(1 - t1 * 0.9, 0.5);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, w);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    // 단순: quadraticCurveTo로 한 번에
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, width);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
  }
}

// v7.29: 진짜 채찍 물리 - 각 세그먼트가 실제로 다른 각도로 뻗어나감 (레거시)
function drawWhipWave(
  ctx: CanvasRenderingContext2D,
  length: number,
  baseAngle: number,
  midAngle: number,
  tipAngle: number,
  sCurve: number,
  tipSpeed: number,
  color: string,
  width: number,
  tapered: boolean
): void {
  const segments = 24;
  const points: { x: number; y: number }[] = [];

  // 각 세그먼트의 누적 위치 계산
  // 핵심: 각 세그먼트가 "자신의 각도"로 뻗어나감
  let currentX = 0;
  let currentY = 0;
  const segmentLength = length / segments;

  for (let i = 0; i <= segments; i++) {
    points.push({ x: currentX, y: currentY });

    if (i < segments) {
      const t = i / segments; // 0 ~ 1 (채찍 위치)

      // 이 세그먼트의 각도 계산 (base → mid → tip 보간)
      // 끝으로 갈수록 tipAngle에 가까워짐 (= 뒤처짐)
      let segAngle: number;
      if (t < 0.4) {
        // 손잡이~중간: base → mid
        const localT = t / 0.4;
        segAngle = baseAngle + (midAngle - baseAngle) * EASING.easeInQuad(localT);
      } else {
        // 중간~끝: mid → tip (가속 적용)
        const localT = (t - 0.4) / 0.6;
        const accelT = Math.pow(localT, 1.5 / tipSpeed); // 끝이 더 뒤처짐
        segAngle = midAngle + (tipAngle - midAngle) * accelT;
      }

      // 상대 각도 (baseAngle 기준, 왜냐하면 ctx가 baseAngle로 회전됨)
      const relativeAngle = segAngle - baseAngle;

      // S자 곡선 추가 (채찍 특유의 물결)
      // 끝으로 갈수록 S자 효과 강해짐
      const sWaveAngle = Math.sin(t * Math.PI * 2.5) * sCurve * t * 0.8;

      // 최종 세그먼트 방향
      const finalAngle = relativeAngle + sWaveAngle;

      // 다음 점 계산 (현재 점에서 finalAngle 방향으로 segmentLength만큼)
      currentX += Math.cos(finalAngle) * segmentLength;
      currentY += Math.sin(finalAngle) * segmentLength;
    }
  }

  // 그리기 (테이퍼드)
  if (tapered) {
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / (points.length - 1);
      // 끝으로 갈수록 얇아짐
      const w = width * Math.pow(1 - t * 0.85, 0.6);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, w);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, width);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
}

// v7.27: 채찍 끝 모션블러 트레일
function drawWhipTrail(
  ctx: CanvasRenderingContext2D,
  length: number,
  angleOffset: number,
  curvature: number,
  color: string,
  width: number
): void {
  // 채찍 끝 50%만 그림
  const startT = 0.5;
  const segments = 10;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();

  for (let i = 0; i <= segments; i++) {
    const t = startT + (i / segments) * (1 - startT);
    const dist = length * t;
    const curve = Math.sin(t * Math.PI) * curvature * length * 0.2;
    const x = dist * Math.cos(angleOffset) - curve * Math.sin(angleOffset);
    const y = dist * Math.sin(angleOffset) + curve * Math.cos(angleOffset);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// 베지어 곡선으로 채찍 형태 그리기
function drawWhipCurve(
  ctx: CanvasRenderingContext2D,
  length: number,
  curvature: number,
  tipLag: number,
  color: string,
  width: number,
  tapered: boolean
): void {
  const segments = 20;
  const cp1x = length * 0.3;
  const cp1y = curvature * length * 0.5;
  const cp2x = length * (0.6 + tipLag * 0.2);
  const cp2y = curvature * length * 0.2;
  const endX = length * (0.95 - tipLag * 0.1);
  const endY = curvature * length * 0.1;

  if (tapered) {
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;

      const p1 = bezierPoint(0, 0, cp1x, cp1y, cp2x, cp2y, endX, endY, t1);
      const p2 = bezierPoint(0, 0, cp1x, cp1y, cp2x, cp2y, endX, endY, t2);

      const w1 = width * (1 - t1 * 0.7);
      const w2 = width * (1 - t2 * 0.7);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, (w1 + w2) / 2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, width);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    ctx.stroke();
  }
}

// 3차 베지어 곡선 상의 점 계산
function bezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
    y: mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3
  };
}

// ===== punch (강철 주먹 / Power Smash) - STEEL 카테고리 =====
// v37: 방사형 충격파 + 먼지 + 대지 균열 (군사 임팩트 테마)
export function drawPunchProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.2)));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  ctx.rotate(isoRenderAngle(p.angle));

  // 임팩트 진행도 (0→1로 증가)
  const impactProgress = Math.max(0, 1 - lifeRatio);
  const impactEase = EASING.easeOutExpo(impactProgress);

  const fistSize = Math.max(28, p.radius * 1.3);

  // STEEL 컬러 팔레트 (레드 계열 — 군사/충격)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#FCA5A5' : '#EF4444');
  const secondColor = isUltimate ? '#F97316' : (isEvolved ? '#F87171' : '#DC2626');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '252, 165, 165' : '239, 68, 68');

  // ===== 1. 충격파 링 (방사형 확산 — 더 크고 군사적) =====
  const waveCount = isUltimate ? 3 : 2;
  for (let w = 0; w < waveCount; w++) {
    const waveDelay = w * 0.12;
    const waveProgress = Math.max(0, impactProgress - waveDelay);
    const waveEase = EASING.easeOutExpo(Math.min(1, waveProgress * 1.8));
    const waveRadius = fistSize * (0.6 + waveEase * 2.2);
    const waveAlpha = (1 - waveEase) * 0.55;

    if (waveAlpha > 0.03) {
      ctx.strokeStyle = `rgba(${glowRgba}, ${waveAlpha})`;
      ctx.lineWidth = 3.5 - w * 0.8;
      ctx.beginPath();
      ctx.arc(fistSize * 0.4, 0, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ===== 2. 주먹 그림자 =====
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(fistSize * 0.4 + 3, 3, fistSize * 0.42, fistSize * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // ===== 3. 팔 (강철 장갑 팔) =====
  const armExtend = EASING.easeOutBack(Math.min(1, impactProgress * 2));
  const armLength = fistSize * 0.7 * armExtend;

  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.roundRect(-armLength * 0.3, -fistSize * 0.18, armLength, fistSize * 0.36, 4);
  ctx.fill();

  ctx.strokeStyle = '#991B1B';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ===== 4. 주먹 본체 (강철 주먹) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(fistSize * 0.4, 0, fistSize * 0.4, fistSize * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 주먹 몸체 (어두운 레드)
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.ellipse(fistSize * 0.4, 0, fistSize * 0.4, fistSize * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 주먹 테두리 글로우
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 5. 너클 (금속 강화 마디) =====
  const knuckleY = [-fistSize * 0.18, -fistSize * 0.06, fistSize * 0.06, fistSize * 0.18];
  const knuckleX = fistSize * 0.7;

  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.ellipse(knuckleX, knuckleY[k], fistSize * 0.12, fistSize * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // 충격 스파크 하이라이트
    const pulsePhase = (time / 100 + k * 0.15) % 1;
    if (pulsePhase < 0.4) {
      const pulseAlpha = (1 - pulsePhase / 0.4) * 0.85;
      ctx.fillStyle = k % 2 === 0 ? mainColor : secondColor;
      ctx.globalAlpha = pulseAlpha;
      ctx.beginPath();
      ctx.ellipse(knuckleX, knuckleY[k], fistSize * 0.1, fistSize * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ===== 6. 금속 파편 폭발 (히트 시 — 바이너리 대신 파편) =====
  if (impactProgress > 0.25) {
    const debrisProgress = (impactProgress - 0.25) / 0.75;
    const debrisEase = EASING.easeOutExpo(debrisProgress);
    const debrisCount = isUltimate ? 10 : (isEvolved ? 7 : 5);

    for (let d = 0; d < debrisCount; d++) {
      const debrisAngle = (d / debrisCount) * Math.PI * 2 + time / 200;
      const debrisDist = fistSize * (0.5 + debrisEase * 1.3);
      const debrisAlpha = (1 - debrisEase) * 0.9;

      if (debrisAlpha > 0.1) {
        ctx.save();
        ctx.translate(
          fistSize * 0.4 + Math.cos(debrisAngle) * debrisDist,
          Math.sin(debrisAngle) * debrisDist
        );
        ctx.rotate(debrisAngle + time / 50);
        ctx.globalAlpha = debrisAlpha;

        // 금속 파편 (작은 사각형/삼각형)
        ctx.fillStyle = d % 3 === 0 ? '#FCA5A5' : (d % 3 === 1 ? mainColor : '#F97316');
        if (d % 2 === 0) {
          // 사각 파편
          ctx.fillRect(-2.5, -1.5, 5, 3);
        } else {
          // 삼각 파편
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.lineTo(3, 2);
          ctx.lineTo(-3, 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  // ===== 7. 스피드라인 (뒤쪽 — 충격 방향선) =====
  const lineCount = isUltimate ? 4 : 3;
  for (let l = 0; l < lineCount; l++) {
    const lineY = (l - (lineCount - 1) / 2) * 8;
    const lineEase = EASING.easeOutExpo(impactProgress);
    const lineLength = 15 + l * 5 + lineEase * 18;
    const lineAlpha = 0.6 * (1 - impactProgress * 0.5);

    ctx.strokeStyle = `rgba(${glowRgba}, ${lineAlpha})`;
    ctx.lineWidth = 2.5 - l * 0.3;
    ctx.beginPath();
    ctx.moveTo(-8 - l * 3, lineY);
    ctx.lineTo(-8 - lineLength, lineY);
    ctx.stroke();
  }

  // ===== 8. 진화: 대지 균열 이펙트 =====
  if ((isEvolved || isUltimate) && impactProgress > 0.4) {
    const crackProgress = (impactProgress - 0.4) / 0.6;
    const crackEase = EASING.easeOutExpo(crackProgress);
    const crackAlpha = (1 - crackProgress) * 0.7;

    ctx.save();
    ctx.globalAlpha = crackAlpha;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // 방사형 균열선 (3~5개)
    const crackCount = isUltimate ? 5 : 3;
    for (let c = 0; c < crackCount; c++) {
      const cAngle = (c / crackCount) * Math.PI - Math.PI * 0.5;
      const cLen = fistSize * crackEase * 1.5;
      const cx = fistSize * 0.4 + Math.cos(cAngle) * 5;
      const cy = Math.sin(cAngle) * 5;
      const endX = cx + Math.cos(cAngle) * cLen;
      const endY = cy + Math.sin(cAngle) * cLen;
      // 지그재그 균열
      const midX = cx + Math.cos(cAngle) * cLen * 0.5 + Math.sin(cAngle) * 4;
      const midY = cy + Math.sin(cAngle) * cLen * 0.5 - Math.cos(cAngle) * 4;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(midX, midY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ===== 9. 중앙 임팩트 플래시 =====
  if (impactProgress > 0.6 && useGlow) {
    const flashProgress = (impactProgress - 0.6) / 0.4;
    const flashAlpha = (1 - flashProgress) * 0.6;

    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fistSize * 0.75, 0, fistSize * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== axe (전술 토마호크 / Scatter Shot) - TERRITORY 카테고리 =====
// v37: 회전 투사체 + 바람 궤적 + 파편 산개 (블루 에너지 테마)
export function drawAxeProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();

  // Z축 물리
  const z = p.z ?? 0;
  if (z > 0) {
    drawProjectileShadow(ctx, 0, 0, z, 15);
    ctx.translate(0, -z * ISO_Z_TO_SCREEN_Y);
  }

  const axeRot = p.currentRotation !== undefined ? p.currentRotation : p.angle;
  ctx.rotate(axeRot);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // TERRITORY 컬러 팔레트 (블루 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#93C5FD' : '#3B82F6');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '147, 197, 253' : '59, 130, 246');
  const coreColor = isUltimate ? '#FEF3C7' : (isEvolved ? '#DBEAFE' : '#1E3A8A');

  const axeScale = Math.max(0.5, (p.radius || 12) / 12);
  const axeWidth = 20 * axeScale;
  const axeHeight = 28 * axeScale;

  // ===== 1. 모션 블러 트레일 (회전 잔상) =====
  const trailCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let t = trailCount; t >= 1; t--) {
    const trailRot = -t * 0.25;
    const trailAlpha = (1 - t / (trailCount + 1)) * 0.45;

    ctx.save();
    ctx.rotate(trailRot);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = `rgba(${glowRgba}, 0.6)`;
    // 토마호크 형태 잔상
    ctx.beginPath();
    ctx.moveTo(0, -axeHeight * 0.4);
    ctx.lineTo(axeWidth * 0.5, -axeHeight * 0.15);
    ctx.lineTo(axeWidth * 0.35, axeHeight * 0.4);
    ctx.lineTo(-axeWidth * 0.35, axeHeight * 0.4);
    ctx.lineTo(-axeWidth * 0.5, -axeHeight * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ===== 2. 에너지 글로우 (블루 오라) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, axeWidth * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===== 3. 토마호크 본체 (기하학적 도끼 형태) =====
  // 도끼 머리
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.moveTo(0, -axeHeight * 0.45);
  ctx.lineTo(axeWidth * 0.55, -axeHeight * 0.1);
  ctx.quadraticCurveTo(axeWidth * 0.5, axeHeight * 0.15, axeWidth * 0.3, axeHeight * 0.25);
  ctx.lineTo(0, axeHeight * 0.1);
  ctx.lineTo(-axeWidth * 0.3, axeHeight * 0.25);
  ctx.quadraticCurveTo(-axeWidth * 0.5, axeHeight * 0.15, -axeWidth * 0.55, -axeHeight * 0.1);
  ctx.closePath();
  ctx.fill();

  // 도끼 테두리
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 도끼 자루
  ctx.fillStyle = '#1E3A8A';
  ctx.beginPath();
  ctx.roundRect(-2.5, axeHeight * 0.1, 5, axeHeight * 0.35, 2);
  ctx.fill();
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 에너지 코어 (중앙 빛나는 점)
  const corePulse = 0.8 + Math.sin(time / 60) * 0.2;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, -axeHeight * 0.1, 4 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 4. 바람 궤적 파티클 =====
  const windCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let w = 0; w < windCount; w++) {
    const wPhase = ((time / 100 + w * 0.3) % 1);
    const wAngle = axeRot + Math.PI + (w - windCount / 2) * 0.3;
    const wDist = axeWidth + wPhase * 15;
    const wAlpha = (1 - wPhase) * 0.7;

    ctx.save();
    ctx.globalAlpha = wAlpha;
    ctx.strokeStyle = `rgba(${glowRgba}, 0.8)`;
    ctx.lineWidth = 2 - wPhase;
    ctx.beginPath();
    ctx.arc(-Math.cos(w) * wDist * 0.3, Math.sin(w) * wDist * 0.3, 3 + wPhase * 4, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 5. 진화/궁극 추가 이펙트 =====
  if (isEvolved || isUltimate) {
    // 에너지 링 (도끼 주변)
    const ringPhase = (time / 300) % 1;
    ctx.strokeStyle = `rgba(${glowRgba}, ${(1 - ringPhase) * 0.5})`;
    ctx.lineWidth = 2 * (1 - ringPhase);
    ctx.beginPath();
    ctx.arc(0, 0, axeWidth * 0.6 + ringPhase * 12, 0, Math.PI * 2);
    ctx.stroke();

    // 전기 아크 (진화)
    const arcCount = isUltimate ? 3 : 2;
    for (let a = 0; a < arcCount; a++) {
      const aAngle = (time / 200 + a * Math.PI * 2 / arcCount) % (Math.PI * 2);
      const ax = Math.cos(aAngle) * (axeWidth * 0.6);
      const ay = Math.sin(aAngle) * (axeWidth * 0.6);

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const midX = ax * 0.5 + Math.sin(time / 20 + a) * 4;
      const midY = ay * 0.5 + Math.cos(time / 20 + a) * 4;
      ctx.quadraticCurveTo(midX, midY, ax, ay);
      ctx.stroke();
      ctx.restore();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-axeRot);
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      if (useGlow) {
        ctx.shadowColor = '#fcd34d';
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = '#fcd34d';
      ctx.fillText('HAWK', 0, -axeHeight * 0.5 - 8);
      ctx.restore();
    }
  }
}

// ===== sword (전투 검 / Blade Aura) - STEEL 카테고리 =====
// v37: 호형 참격파 + 잔상 트레일 (날카로운 슬래시)
export function drawSwordProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();
  const swordRadius = Math.max(40, p.radius || 60);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.3)));
  const swingProgress = Math.max(0, Math.min(1, 1 - lifeRatio));

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // STEEL 컬러 팔레트 (레드 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#FCA5A5' : '#EF4444');
  const secondaryColor = isUltimate ? '#F97316' : (isEvolved ? '#F87171' : '#DC2626');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '252, 165, 165' : '239, 68, 68');

  // 스윙 with 이징
  const swingEase = EASING.easeOutElastic(swingProgress);
  const swingAngle = swingEase * Math.PI - Math.PI / 2;

  ctx.rotate(isoRenderAngle(p.angle + swingAngle));

  // ===== 1. 참격파 잔상 트레일 (호형 슬래시 궤적) =====
  const trailCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let t = trailCount; t >= 1; t--) {
    const trailAngle = -t * 0.3;
    const trailAlpha = (1 - t / (trailCount + 1)) * 0.5;

    ctx.save();
    ctx.rotate(trailAngle);
    ctx.globalAlpha = trailAlpha;

    // 호형 슬래시 잔상
    ctx.strokeStyle = `rgba(${glowRgba}, 0.7)`;
    ctx.lineWidth = 6 - t;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, swordRadius * 0.85, -0.3, 0.3);
    ctx.stroke();

    ctx.restore();
  }

  // ===== 2. 검 본체 (날카로운 직선 칼날) =====
  const bladeLength = swordRadius * 0.9;

  // 글로우
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bladeLength, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 칼날 본체 (밝은 금속 + 레드 에너지 가장자리)
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.lineTo(bladeLength - 2, -2);
  ctx.lineTo(bladeLength + 5, 0); // 끝 포인트
  ctx.lineTo(bladeLength - 2, 2);
  ctx.lineTo(6, 4);
  ctx.closePath();
  ctx.fill();

  // 칼날 에너지 가장자리 (레드)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 8;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 칼날 중심선 (밝은 하이라이트)
  ctx.strokeStyle = '#FCA5A5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(bladeLength * 0.8, 0);
  ctx.stroke();

  // 손잡이 (단순)
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.roundRect(-2, -5, 10, 10, 2);
  ctx.fill();
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 가드 (십자 가드)
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.roundRect(6, -7, 3, 14, 1);
  ctx.fill();

  // ===== 3. 호형 참격파 (스윙 아크) =====
  if (swingProgress > 0.5) {
    const arcProgress = (swingProgress - 0.5) / 0.5;
    const arcEase = EASING.easeOutQuad(arcProgress);
    const arcAlpha = arcEase * (1 - arcProgress) * 0.8;

    // 메인 참격파 호
    ctx.save();
    ctx.globalAlpha = arcAlpha;
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, swordRadius * 0.95, -0.5, 0.5);
    ctx.stroke();

    // 2차 참격파 (더 넓은 호)
    ctx.strokeStyle = `rgba(${glowRgba}, ${arcAlpha * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, swordRadius * 1.05, -0.65, 0.65);
    ctx.stroke();
    ctx.restore();

    // 슬래시 스피드라인 (방사형)
    for (let sl = 0; sl < 3; sl++) {
      const slAngle = -0.3 + sl * 0.3;
      const slAlpha = arcAlpha * (1 - sl * 0.2);

      ctx.strokeStyle = `rgba(${glowRgba}, ${slAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(slAngle) * swordRadius * 0.5,
        Math.sin(slAngle) * swordRadius * 0.5
      );
      ctx.lineTo(
        Math.cos(slAngle) * swordRadius * 0.98,
        Math.sin(slAngle) * swordRadius * 0.98
      );
      ctx.stroke();
    }
  }

  // ===== 4. 금속 스파크 (충격 파편) =====
  if (swingProgress > 0.6) {
    const sparkProgress = (swingProgress - 0.6) / 0.4;
    const sparkCount = isUltimate ? 5 : (isEvolved ? 3 : 2);

    for (let s = 0; s < sparkCount; s++) {
      const sAngle = (s / sparkCount) * 0.8 - 0.4;
      const sDist = swordRadius * (0.8 + sparkProgress * 0.3);
      const sAlpha = (1 - sparkProgress) * 0.8;
      const sx = Math.cos(sAngle) * sDist;
      const sy = Math.sin(sAngle) * sDist;

      ctx.save();
      ctx.globalAlpha = sAlpha;
      ctx.fillStyle = '#FCA5A5';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 5. 궁극 추가 이펙트 =====
  if (isUltimate && useGlow) {
    ctx.save();
    const ultPulse = (time / 100) % 1;
    ctx.globalAlpha = 0.4 + Math.sin(ultPulse * Math.PI * 2) * 0.2;
    ctx.shadowColor = '#fcd34d';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(swordRadius * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }
}
