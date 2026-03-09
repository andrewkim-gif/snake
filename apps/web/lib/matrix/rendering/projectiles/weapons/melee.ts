/**
 * game/rendering/projectiles/weapons/melee.ts - 근접 무기 렌더링
 * v4.9: 스타일리시 이펙트 시스템 - 이징, 글로우, 트레일, 펄스
 * v4.9.1: LOD-aware shadowBlur 최적화
 * v6.0: 아이소메트릭 Z축 물리 + 그림자 렌더링
 * v7.20: 성능 최적화 - easing 통합 모듈 사용, time 파라미터화
 * v7.38: "쌱아앙악!" - 72%까지 완전히 보이다가 pow(6) 초급격 페이드아웃 + 스케일 축소
 * v7.39: "처음에 멋지게" - 초반 곡률 부스트로 드라마틱한 휘어짐
 * v7.40: "뒤에서 휘두르며 등장" - 뒤쪽에서 서서히 등장 → 앞으로 휘두르며 사라짐
 * v7.41: "더 뒤에서 속도감있게" - 거의 뒤(-175°)에서 휙! 하고 빠르게 등장
 * v7.42: "자연스럽게 등장" - easeIn으로 희미하게 → 선명하게 (툭 등장 수정)
 * v7.43: "쇄사슬 느낌" - 연결된 체인 링크로 렌더링
 * v7.44: "두꺼운 쇄사슬" - 더 두껍고 촘촘한 체인 링크
 * v7.45: (롤백됨)
 * v7.46: (롤백됨)
 * v7.47: (롤백됨)
 * v7.48: "단순 원형 스윙" - 아이소 변환 제거, 방향+스윙만 결합 (레이저처럼 깔끔하게)
 * v7.49: "얇은 체인" - baseWidth 축소 (14/12/10 → 8/6/5)
 * v7.50: "빠른 스윙" - fadeIn 8%, fadeOut 55%, 구간 압축으로 체감 2배 속도
 * v7.51: (롤백됨)
 * v7.52: (롤백됨)
 * v7.53: (롤백됨 - 너무 빠름)
 * v7.54: (롤백됨)
 * v7.55: (롤백됨)
 * v7.56: "점점 빠르게!" - duration 1.2배, 가속 곡선, pow 20 사라짐
 * v7.34: "도파민 시각 효과" - 모든 스킬 알파값 및 시각 효과 대폭 개선
 *        - whip: 체인 글로우/하이라이트/조인트 알파값 증가, shadowBlur 16
 *        - punch: RGB 충격파/글로우/키캡/스피드라인/히트 텍스트 알파값 증가
 *        - axe: 트레일/글로우/팬/LED/열기 파티클/데이터 스트림 알파값 증가
 *        - sword: 트레일/글로우/스윙 아크/얼티밋 효과 알파값 증가
 *
 * whip (Hand Coding), punch (Keyboard Punch), axe (Server Throw), sword (삼단봉)
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

// ===== whip (Hand Coding) - 코드 라인 채찍 =====
// v7.59: 자연스러운 스윙 - 알파 0에서 나타나고 가속하며 사라짐, 곡선 유지
export function drawWhipProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();
  const whipLength = Math.max(60, p.radius * 3.6);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.3)));
  const swingProgress = Math.max(0, Math.min(1, 1 - lifeRatio));
  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // 컬러
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#22d3ee' : '#fbbf24');

  // v7.60: 충돌 판정과 동기화! (projectile.ts 418-420과 동일)
  // 스윙 범위: -60° ~ +80° (총 140° 호)
  const swingStart = -Math.PI * 0.33;  // -60°
  const swingEnd = Math.PI * 0.44;     // +80°
  const swingRange = swingEnd - swingStart;

  // 선형 진행 (충돌과 동일하게!)
  const swingAngle = swingStart + swingProgress * swingRange;

  // 알파: 빠르게 나타나고 → 유지 → 빠르게 사라짐
  let alpha;
  if (swingProgress < 0.08) {
    // 처음 8%: 빠르게 나타남
    alpha = Math.pow(swingProgress / 0.08, 0.5);
  } else if (swingProgress < 0.6) {
    // 중간: 완전히 보임
    alpha = 1;
  } else {
    // 마지막 40%: 가속하며 사라짐
    alpha = 1 - Math.pow((swingProgress - 0.6) / 0.4, 1.5);
  }

  // 곡률: 스윙 중간에 최대 휘어짐 (채찍다운 큰 곡선)
  const curvature = Math.sin(swingProgress * Math.PI) * 0.6;

  // 회전 적용
  ctx.rotate(p.angle + swingAngle);

  // 채찍 본체 렌더링
  ctx.save();
  ctx.globalAlpha = alpha;

  const baseWidth = isUltimate ? 8 : (isEvolved ? 6 : 5);
  drawWhipChain(ctx, whipLength, curvature, mainColor, baseWidth, time, useGlow);

  ctx.restore();

  // 얼티밋 글로우 (v7.34: 알파 0.2→0.35, shadowBlur 15→20)
  if (isUltimate && useGlow && alpha > 0.5) {
    ctx.save();
    ctx.globalAlpha = 0.35 * alpha;
    ctx.shadowColor = '#fcd34d';
    ctx.shadowBlur = 20;
    drawWhipEllipse(ctx, whipLength, curvature, '#fcd34d', 10, false);
    ctx.restore();
  }
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

// ===== punch (Keyboard Punch) - 기계식 키보드 펀치 =====
// v7.15: 성능 최적화 - 충격파/글로우/파편/shadowBlur 대폭 감소
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

  // v7.x 컬러 팔레트: 사이버 주먹
  const mainColor = isUltimate ? '#ef4444' : (isEvolved ? '#8b5cf6' : '#22c55e');
  const secondColor = isUltimate ? '#fbbf24' : (isEvolved ? '#06b6d4' : '#3b82f6');
  const glowRgba = isUltimate ? '239, 68, 68' : (isEvolved ? '139, 92, 246' : '34, 197, 94');

  // ===== 충격파 링 (확산) =====
  const waveCount = isUltimate ? 3 : 2;
  for (let w = 0; w < waveCount; w++) {
    const waveDelay = w * 0.12;
    const waveProgress = Math.max(0, impactProgress - waveDelay);
    const waveEase = EASING.easeOutExpo(Math.min(1, waveProgress * 1.8));
    const waveRadius = fistSize * (0.6 + waveEase * 1.8);
    const waveAlpha = (1 - waveEase) * 0.5;

    if (waveAlpha > 0.03) {
      ctx.strokeStyle = `rgba(${glowRgba}, ${waveAlpha})`;
      ctx.lineWidth = 3 - w * 0.8;
      ctx.beginPath();
      ctx.arc(fistSize * 0.4, 0, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ===== 주먹 그림자 =====
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(fistSize * 0.4 + 3, 3, fistSize * 0.42, fistSize * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // ===== 팔 (뒤쪽에서 나오는 느낌) =====
  const armExtend = EASING.easeOutBack(Math.min(1, impactProgress * 2));
  const armLength = fistSize * 0.7 * armExtend;

  // 팔 그라데이션 효과 (단색으로 심플하게)
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(-armLength * 0.3, -fistSize * 0.18, armLength, fistSize * 0.36, 4);
  ctx.fill();

  // 팔 테두리
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ===== 주먹 본체 =====
  // 글로우 레이어
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(fistSize * 0.4, 0, fistSize * 0.4, fistSize * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 주먹 몸체
  ctx.fillStyle = '#1f2937';
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

  // ===== 너클 (손가락 마디) - 4개 =====
  const knuckleY = [-fistSize * 0.18, -fistSize * 0.06, fistSize * 0.06, fistSize * 0.18];
  const knuckleX = fistSize * 0.7;

  for (let k = 0; k < 4; k++) {
    // 너클 베이스
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.ellipse(knuckleX, knuckleY[k], fistSize * 0.12, fistSize * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // RGB 펄스 하이라이트
    const pulsePhase = (time / 100 + k * 0.15) % 1;
    const pulseActive = pulsePhase < 0.4;
    if (pulseActive) {
      const pulseAlpha = (1 - pulsePhase / 0.4) * 0.85;
      const knuckleColor = k % 2 === 0 ? mainColor : secondColor;
      ctx.fillStyle = knuckleColor;
      ctx.globalAlpha = pulseAlpha;
      ctx.beginPath();
      ctx.ellipse(knuckleX, knuckleY[k], fistSize * 0.1, fistSize * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ===== 바이너리 비트 폭발 (임팩트 시) =====
  if (impactProgress > 0.25) {
    const bitProgress = (impactProgress - 0.25) / 0.75;
    const bitEase = EASING.easeOutExpo(bitProgress);
    const bitCount = isUltimate ? 10 : (isEvolved ? 7 : 5);

    for (let b = 0; b < bitCount; b++) {
      const bitAngle = (b / bitCount) * Math.PI * 2 + time / 200;
      const bitDist = fistSize * (0.5 + bitEase * 1.2);
      const bitAlpha = (1 - bitEase) * 0.9;
      const bitChar = b % 2 === 0 ? '1' : '0';

      if (bitAlpha > 0.1) {
        ctx.save();
        ctx.translate(
          fistSize * 0.4 + Math.cos(bitAngle) * bitDist,
          Math.sin(bitAngle) * bitDist
        );

        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = b % 3 === 0 ? mainColor : secondColor;
        ctx.globalAlpha = bitAlpha;
        ctx.fillText(bitChar, 0, 0);

        ctx.restore();
      }
    }
  }

  // ===== 스피드라인 (뒤쪽) =====
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

  // ===== 글리치 이펙트 (진화/궁극) =====
  if ((isEvolved || isUltimate) && impactProgress > 0.5) {
    const glitchAlpha = (impactProgress - 0.5) * 1.5;
    const glitchOffset = Math.sin(time / 15) * 3;

    // 글리치 복제 (RGB 분리)
    ctx.save();
    ctx.globalAlpha = glitchAlpha * 0.3;

    // 빨강 오프셋
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(fistSize * 0.4 + glitchOffset, -1.5, fistSize * 0.38, fistSize * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // 파랑 오프셋
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(fistSize * 0.4 - glitchOffset, 1.5, fistSize * 0.38, fistSize * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ===== 중앙 임팩트 플래시 =====
  if (impactProgress > 0.6 && useGlow) {
    const flashProgress = (impactProgress - 0.6) / 0.4;
    const flashAlpha = (1 - flashProgress) * 0.55;

    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fistSize * 0.75, 0, fistSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== axe (Server Throw) - 서버/GPU 투척 =====
// v7.15: 성능 최적화 - 트레일/글로우/파티클/shadowBlur 대폭 감소
export function drawAxeProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const useGlow = shouldUseGlow();

  // v6.0: Z축 물리가 있는 경우 그림자 먼저 렌더링
  const z = p.z ?? 0;
  if (z > 0) {
    drawProjectileShadow(ctx, 0, 0, z, 15);
    ctx.translate(0, -z * ISO_Z_TO_SCREEN_Y);
  }

  const axeRot = p.currentRotation !== undefined ? p.currentRotation : p.angle;
  ctx.rotate(axeRot);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // v4 컬러 팔레트
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#22d3ee' : '#22c55e');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '34, 211, 238' : '34, 197, 94');

  const axeScale = Math.max(0.5, (p.radius || 12) / 12);
  const serverWidth = 18 * axeScale;
  const serverHeight = 30 * axeScale;

  // ===== 모션 블러 트레일 (v7.15: 6/5/4 → 3/2/2, v7.34: 알파 0.25→0.4) =====
  const trailCount = isUltimate ? 3 : (isEvolved ? 2 : 2);
  for (let t = trailCount; t >= 1; t--) {
    const trailRot = -t * 0.22;
    const trailAlpha = (1 - t / trailCount) * 0.4;
    const trailEase = EASING.easeOutExpo(1 - t / trailCount);

    ctx.save();
    ctx.rotate(trailRot);
    ctx.globalAlpha = trailAlpha * trailEase;

    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-serverWidth/2, -serverHeight/2, serverWidth, serverHeight, 3);
    ctx.fill();

    ctx.restore();
  }

  // ===== 글로우 레이어 (v7.15: 3→1, v7.34: 알파 0.3→0.45, shadowBlur 15→20) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-serverWidth/2, -serverHeight/2, serverWidth, serverHeight, 3);
    ctx.fill();
    ctx.restore();
  }

  // ===== 서버 본체 (v7.15: gradient→단색) =====
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-serverWidth/2, -serverHeight/2, serverWidth, serverHeight, 3);
  ctx.fill();

  // 테두리 글로우 (v7.15: 조건부, v7.34: shadowBlur 8→12, lineWidth 2→2.5)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== GPU 팬 (회전 애니메이션) (v7.34: lineWidth 증가) =====
  const fanY = -serverHeight/4;
  const fanRadius = 6.5 * axeScale;

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, fanY, fanRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 팬 블레이드 (회전) (v7.34: lineWidth 2→2.5)
  const fanSpin = (time / 25) % (Math.PI * 2);
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  for (let b = 0; b < 4; b++) {
    const bAngle = fanSpin + (b / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, fanY);
    ctx.lineTo(
      Math.cos(bAngle) * fanRadius * 0.85,
      fanY + Math.sin(bAngle) * fanRadius * 0.85
    );
    ctx.stroke();
  }

  // ===== LED 인디케이터 (v7.15: LED 글로우 제거, v7.34: 크기 2.5→3, 더 밝은 색상) =====
  const ledColors = isUltimate
    ? ['#fcd34d', '#f59e0b', '#22c55e']
    : (isEvolved ? ['#22d3ee', '#3b82f6', '#22c55e'] : ['#22c55e', '#22c55e', '#ef4444']);

  for (let l = 0; l < 3; l++) {
    const ledY = serverHeight/4 - 10 + l * 6;
    const ledPulse = (time / 100 + l * 0.3) % 1;
    const ledBright = l === 2 ? Math.sin(ledPulse * Math.PI * 2) > 0 : true;

    ctx.fillStyle = ledBright ? ledColors[l] : '#1e293b';
    ctx.beginPath();
    ctx.arc(-serverWidth/2 + 5, ledY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 이더넷 포트 =====
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(serverWidth/2 - 5, -5, 4, 4);
  ctx.fillRect(serverWidth/2 - 5, 2, 4, 4);

  // ===== 라벨 (v7.15: shadowBlur 조건부, v7.34: shadowBlur 6→10, 폰트 크기 증가) =====
  ctx.font = `bold ${7 * axeScale}px monospace`;
  ctx.fillStyle = mainColor;
  ctx.textAlign = 'center';
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.fillText(isUltimate ? 'RTX' : (isEvolved ? 'GPU' : 'SRV'), 0, serverHeight/4 + 3);
  ctx.shadowBlur = 0;

  // ===== 열기 파티클 (v7.15: 8/6/4 → 3/2/2, v7.34: 알파 0.7→0.85, 크기 증가) =====
  const heatCount = isUltimate ? 3 : (isEvolved ? 2 : 2);
  for (let h = 0; h < heatCount; h++) {
    const hPhase = (time / 180 + h * 0.2) % 1;
    const hEase = EASING.easeOutQuad(hPhase);
    const hY = -serverHeight/2 - 10 - hEase * 22;
    const hX = Math.sin(time / 80 + h * 1.2) * 7;
    const hAlpha = (1 - hPhase) * 0.85;
    const hSize = Math.max(1.5, (2.5 + (1 - hPhase) * 3.5));

    ctx.fillStyle = `rgba(${glowRgba}, ${hAlpha})`;
    ctx.beginPath();
    ctx.arc(hX, hY, hSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 데이터 스트림 (v7.15: 4→2, v7.34: 알파 0.6→0.8, lineWidth 1.5→2) =====
  if (isEvolved || isUltimate) {
    ctx.strokeStyle = `rgba(${glowRgba}, 0.8)`;
    ctx.lineWidth = 2;

    for (let d = 0; d < 2; d++) {
      const dX = -serverWidth/2 + 5 + d * 8;
      const dPhase = (time / 120 + d * 0.15) % 1;
      const dEase = EASING.easeOutExpo(dPhase);
      const dLen = 12 * dEase;

      ctx.beginPath();
      ctx.moveTo(dX, serverHeight/2);
      ctx.lineTo(dX, serverHeight/2 + dLen);
      ctx.stroke();
    }

    // 오버클럭 텍스트 (v7.15: shadowBlur 조건부, v7.34: shadowBlur 10→14, 폰트 증가)
    if (isUltimate) {
      ctx.save();
      ctx.rotate(-axeRot);

      const ocPulse = (time / 200) % 1;
      const ocScale = EASING.easeOutElastic(ocPulse) * 0.35 + 0.85;

      ctx.font = `bold ${11 * ocScale}px monospace`;
      ctx.textAlign = 'center';
      if (useGlow) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 14;
      }
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3.5;
      ctx.fillStyle = '#ef4444';
      ctx.strokeText('OC!', 0, -serverHeight/2 - 15);
      ctx.fillText('OC!', 0, -serverHeight/2 - 15);

      ctx.restore();
    }
  }
}

// ===== sword (삼단봉 / Extendable Baton) =====
// v7.15: 성능 최적화 - 트레일/글로우/충격파/gradient/shadowBlur 대폭 감소
export function drawSwordProjectile(params: MeleeWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const useGlow = shouldUseGlow();
  const swordRadius = Math.max(40, p.radius || 60);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 0.3)));
  const swingProgress = Math.max(0, Math.min(1, 1 - lifeRatio));

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // v4 컬러 팔레트 (메탈릭)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#22d3ee' : '#94a3b8');
  const secondaryColor = isUltimate ? '#f59e0b' : (isEvolved ? '#06b6d4' : '#64748b');
  const glowRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '34, 211, 238' : '148, 163, 184');

  // 스윙 with 이징
  const swingEase = EASING.easeOutElastic(swingProgress);
  const swingAngle = swingEase * Math.PI - Math.PI / 2;

  ctx.rotate(isoRenderAngle(p.angle + swingAngle));

  // ===== 모션 블러 트레일 (v7.15: 8/6/5 → 3/2/2, v7.34: 알파 0.3→0.45, lineWidth 6→7) =====
  const trailCount = isUltimate ? 3 : (isEvolved ? 2 : 2);
  for (let t = trailCount; t >= 1; t--) {
    const trailAngle = -t * 0.28;
    const trailAlpha = (1 - t / trailCount) * 0.45;
    const trailEase = EASING.easeOutExpo(1 - t / trailCount);

    ctx.save();
    ctx.rotate(trailAngle);
    ctx.globalAlpha = trailAlpha * trailEase;

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(swordRadius * 0.88, 0);
    ctx.stroke();

    ctx.restore();
  }

  // ===== 삼단봉 확장 애니메이션 =====
  const segmentLen = swordRadius * 0.35;

  const stage1Progress = Math.min(1, swingProgress * 3);
  const stage2Progress = Math.max(0, Math.min(1, (swingProgress - 0.33) * 3));
  const stage3Progress = Math.max(0, Math.min(1, (swingProgress - 0.66) * 3));

  const stage1Ease = EASING.easeOutBack(stage1Progress);
  const stage2Ease = EASING.easeOutBack(stage2Progress);
  const stage3Ease = EASING.easeOutBack(stage3Progress);

  // ===== 글로우 레이어 (v7.15: 2→1, v7.34: 알파 0.3→0.45, shadowBlur 12→16, lineWidth 10→12) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const totalLen = segmentLen * stage1Ease +
                     segmentLen * stage2Ease +
                     segmentLen * 0.8 * stage3Ease;
    ctx.lineTo(totalLen, 0);
    ctx.stroke();

    ctx.restore();
  }

  // ===== 1단 (손잡이) (v7.15: gradient→단색) =====
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(0, -5, segmentLen * stage1Ease, 10, 3);
  ctx.fill();

  // 손잡이 그립 패턴
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  for (let g = 0; g < 4; g++) {
    const gx = 5 + g * 6;
    if (gx < segmentLen * stage1Ease - 5) {
      ctx.beginPath();
      ctx.moveTo(gx, -4);
      ctx.lineTo(gx, 4);
      ctx.stroke();
    }
  }

  // 연결부 1 (v7.15: shadowBlur 제거)
  if (stage1Progress > 0.8) {
    ctx.fillStyle = secondaryColor;
    ctx.beginPath();
    ctx.arc(segmentLen * stage1Ease, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 2단 (v7.15: gradient→단색, 충격파 제거) =====
  if (stage2Progress > 0) {
    const seg2Start = segmentLen * stage1Ease + 3;
    const seg2Len = segmentLen * stage2Ease;

    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.roundRect(seg2Start, -4, seg2Len, 8, 2);
    ctx.fill();

    // 연결부 2 (v7.15: shadowBlur 제거)
    if (stage2Progress > 0.8) {
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(seg2Start + seg2Len, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== 3단 (끝) (v7.15: gradient→단색, v7.34: 끝부분 광택 0.3→0.5) =====
  if (stage3Progress > 0) {
    const seg3Start = segmentLen * stage1Ease + segmentLen * stage2Ease + 6;
    const seg3Len = segmentLen * 0.8 * stage3Ease;

    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.roundRect(seg3Start, -3, seg3Len, 6, 2);
    ctx.fill();

    // 끝부분 광택 (v7.34: 알파 0.3→0.5, 크기 증가)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * stage3Ease})`;
    ctx.beginPath();
    ctx.roundRect(seg3Start + seg3Len - 6, -2.5, 5, 5, 1);
    ctx.fill();
  }

  // ===== 스윙 아크 (v7.15: 스피드라인 3→2, v7.34: 알파 0.6→0.75, lineWidth 4→5) =====
  if (swingProgress > 0.7) {
    const arcProgress = (swingProgress - 0.7) / 0.3;
    const arcEase = EASING.easeOutQuad(arcProgress);
    const arcAlpha = arcEase * (1 - arcProgress) * 0.75;

    ctx.strokeStyle = `rgba(255, 255, 255, ${arcAlpha})`;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, swordRadius * 0.97, -0.55, 0.55);
    ctx.stroke();

    // 스윙 스피드라인 (v7.15: 3→2, v7.34: lineWidth 2→2.5)
    for (let sl = 0; sl < 2; sl++) {
      const slAngle = -0.22 + sl * 0.44;
      const slAlpha = arcAlpha * (1 - sl * 0.25);

      ctx.strokeStyle = `rgba(${glowRgba}, ${slAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(slAngle) * swordRadius * 0.58,
        Math.sin(slAngle) * swordRadius * 0.58
      );
      ctx.lineTo(
        Math.cos(slAngle) * swordRadius * 0.97,
        Math.sin(slAngle) * swordRadius * 0.97
      );
      ctx.stroke();
    }
  }

  // ===== 얼티밋 추가 이펙트 (v7.15: shadowBlur 조건부, v7.34: 알파 0.3→0.45, shadowBlur 20→25) =====
  if (isUltimate && useGlow) {
    ctx.save();
    const ultPulse = (time / 100) % 1;
    ctx.globalAlpha = 0.45 + Math.sin(ultPulse * Math.PI * 2) * 0.2;
    ctx.shadowColor = '#fcd34d';
    ctx.shadowBlur = 25;
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(swordRadius * 0.92, 0);
    ctx.stroke();
    ctx.restore();
  }
}
