/**
 * game/rendering/projectiles/weapons/ranged.ts - 원거리 무기 렌더링
 * v37: 카테고리 테마 리디자인
 *   - knife (전투 단검 / Railgun): STEEL 레드 — 관통 라인 + 전하 파티클 + 충격파
 *   - bow (레일건 빔 / Data Wave): TERRITORY 블루 — 충격파 링 (확장하며 감쇠)
 *   - ping: ALLIANCE 퍼플 — 체인 라이트닝 (기존 유지)
 *   - shard (클러스터탄 / Siege Cannon): TERRITORY 블루 — 대형 포탄 궤적 + 착탄 폭발
 *   - airdrop: MORALE 시안 — 공습 (기존 유지)
 *   - fork: ALLIANCE 퍼플 — 분열탄 (기존 유지)
 */

import { GLOW_PRESETS, EASING, applyEasing, lerp, lerpColor, setGlow, clearGlow } from '../../effects';
import { shouldUseGlow } from '../../enemies/renderContext';
import { drawProjectileShadow, ISO_Z_TO_SCREEN_Y, isoRenderAngle, applyIsoProjectileTransform } from '../../../isometric';

export interface RangedWeaponParams {
  ctx: CanvasRenderingContext2D;
  p: any;
  playerPos: { x: number; y: number };
  time?: number; // v7.20: 프레임당 1회만 Date.now() 호출하여 전달
}

// v7.20: 공통 easing 모듈 사용 (중복 제거 - EASING import 활용)

// ===== 글로우 렌더링 헬퍼 (v4.9: LOD-aware) =====
function applyGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  pulseTime?: number,
  pulseIntensity: number = 0.3
): void {
  // v4.9: LOD 체크 - HIGH LOD에서만 글로우 적용
  if (!shouldUseGlow()) return;

  let finalBlur = blur;
  if (pulseTime !== undefined) {
    finalBlur = blur * (1 + Math.sin(pulseTime) * pulseIntensity);
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = finalBlur;
}

/**
 * 전투 단검 / Railgun — STEEL (CODE) 카테고리
 * v37: 관통 라인 + 전하 파티클 + 충격파 (레드 군사 테마)
 */
export function drawKnife(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const knifeRot = p.currentRotation !== undefined ? p.currentRotation : p.angle;
  const useGlow = shouldUseGlow();

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // STEEL 컬러 팔레트 (레드 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#FCA5A5' : '#EF4444');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '252, 165, 165' : '239, 68, 68');
  const coreColor = isUltimate ? '#FEF3C7' : (isEvolved ? '#FEE2E2' : '#FCA5A5');

  // 크기 계산
  const baseSize = Math.max(8, (p.radius || 5) * 2.5);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const appearProgress = Math.max(0, Math.min(1, (1 - lifeRatio) * 4));
  const bounceScale = Math.max(0.1, EASING.easeOutBack(appearProgress));
  const knifeSize = Math.max(4, baseSize * bounceScale);

  ctx.save();
  applyIsoProjectileTransform(ctx, knifeRot);

  // ===== 1. 전하 파티클 트레일 (뒤쪽 잔상) =====
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let i = trailCount; i >= 1; i--) {
    const trailEase = EASING.easeOutExpo(1 - i / trailCount);
    const offsetX = -i * 10 * trailEase;
    const waveY = Math.sin(time / 80 + i * 1.5) * 3;
    const alpha = 0.7 * (1 - i / trailCount);

    ctx.fillStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(offsetX, waveY, 2.5 - i * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 2. 충격파 링 =====
  const pulsePhase = (time / 200) % 1;
  const pulseRadius = knifeSize * (1.1 + pulsePhase * 0.8);
  const pulseAlpha = (1 - pulsePhase) * 0.5;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${pulseAlpha})`;
  ctx.lineWidth = 2 * (1 - pulsePhase);
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 3. 메인 단검 본체 (날카로운 삼각형) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5 * bounceScale;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(knifeSize + 6, 0);
    ctx.lineTo(-knifeSize * 0.5, -knifeSize * 0.6);
    ctx.lineTo(-knifeSize * 0.5, knifeSize * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 단검 칼날 (어두운 금속)
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.moveTo(knifeSize + 4, 0);
  ctx.lineTo(-knifeSize * 0.3, -knifeSize * 0.45);
  ctx.lineTo(-knifeSize * 0.3, knifeSize * 0.45);
  ctx.closePath();
  ctx.fill();

  // 칼날 테두리
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 칼날 중심 하이라이트
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(knifeSize * 0.8, 0);
  ctx.lineTo(-knifeSize * 0.1, 0);
  ctx.stroke();

  // 관통 방향 화살표 (앞쪽 돌출)
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(knifeSize + 8, 0);
  ctx.lineTo(knifeSize + 2, -3);
  ctx.lineTo(knifeSize + 2, 3);
  ctx.closePath();
  ctx.fill();

  // ===== 4. 전하 스파크 (칼날 주변 전기) =====
  const sparkCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let s = 0; s < sparkCount; s++) {
    const sAngle = (time / 60 + s * Math.PI * 2 / sparkCount) % (Math.PI * 2);
    const sDist = knifeSize * 0.8;
    const sx = Math.cos(sAngle) * sDist;
    const sy = Math.sin(sAngle) * sDist;
    const sAlpha = 0.6 + Math.sin(time / 40 + s) * 0.3;

    ctx.fillStyle = `rgba(${glowColorRgba}, ${sAlpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 5. 진화/궁극 이펙트 =====
  if (isEvolved || isUltimate) {
    // 진동 블러 (이중 잔상)
    ctx.save();
    ctx.globalAlpha = 0.25;
    const blurOffset = Math.sin(time / 20) * 2;
    ctx.translate(0, blurOffset);
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(knifeSize + 3, 0);
    ctx.lineTo(-knifeSize * 0.2, -knifeSize * 0.35);
    ctx.lineTo(-knifeSize * 0.2, knifeSize * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(0, -blurOffset);
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(knifeSize + 3, 0);
    ctx.lineTo(-knifeSize * 0.2, -knifeSize * 0.35);
    ctx.lineTo(-knifeSize * 0.2, knifeSize * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-knifeRot);
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fcd34d';
      ctx.fillText('PLASMA', 0, -knifeSize - 8);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * 레일건 / Data Wave — TERRITORY (DATA) 카테고리
 * v37: 고속 관통 빔 + 충격파 링 (블루 에너지 테마)
 */
export function drawBow(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // TERRITORY 컬러 팔레트 (블루 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#93C5FD' : '#3B82F6');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '147, 197, 253' : '59, 130, 246');
  const coreColor = isUltimate ? '#FEF3C7' : '#DBEAFE';

  const bowSize = Math.max(6, (p.radius || 3) * 2);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const appearEase = Math.max(0.1, EASING.easeOutElastic(Math.max(0, Math.min(1, (1 - lifeRatio) * 3))));
  const scale = Math.max(4, bowSize * appearEase);

  // ===== 1. 에너지 트레일 (뒤쪽 잔상) =====
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let i = trailCount; i >= 1; i--) {
    const trailEase = EASING.easeOutExpo(1 - i / trailCount);
    const offsetX = -i * 10 * trailEase;
    const alpha = 0.7 * (1 - i / trailCount);

    ctx.fillStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(offsetX, 0, scale * 0.4 - i * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 2. 충격파 링 (확장하며 감쇠) =====
  const ringCount = isUltimate ? 2 : 1;
  for (let r = 0; r < ringCount; r++) {
    const ringPhase = ((time / 250 + r * 0.5) % 1);
    const ringRadius = scale + ringPhase * 18;
    const ringAlpha = (1 - ringPhase) * 0.55;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
    ctx.lineWidth = 2.5 * (1 - ringPhase);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 3. 메인 에너지 볼트 본체 (빛나는 구체) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, scale * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 에너지 코어 (블루 구체)
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, 0, scale, 0, Math.PI * 2);
  ctx.fill();

  // 테두리
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 내부 에너지 패턴 (십자형 빔)
  ctx.strokeStyle = `rgba(255, 255, 255, 0.6)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-scale * 0.6, 0);
  ctx.lineTo(scale * 0.6, 0);
  ctx.moveTo(0, -scale * 0.6);
  ctx.lineTo(0, scale * 0.6);
  ctx.stroke();

  // 중앙 코어 (밝은 점)
  const corePulse = 0.8 + Math.sin(time / 40) * 0.2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, scale * 0.25 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 4. 전자기 파동 (진화/궁극) =====
  if (isEvolved || isUltimate) {
    // 오비탈 에너지 입자
    const orbitalCount = isUltimate ? 4 : 3;
    for (let o = 0; o < orbitalCount; o++) {
      const oAngle = (time / 200 + o * Math.PI * 2 / orbitalCount) % (Math.PI * 2);
      const oDist = scale + 8;
      const ox = Math.cos(oAngle) * oDist;
      const oy = Math.sin(oAngle) * oDist;

      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 연결선 (에너지 아크)
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      ctx.restore();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-p.angle);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'center';
      ctx.fillText('RAIL', 0, -scale - 10);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Ping 패킷 - 네트워크 패킷 바운싱
 * v4.9: EASING.easeOutBounce 바운스 + electric 글로우 + 네트워크 웨이브 트레일
 * v7.15: 성능 최적화 - 트레일/글로우/펄스 링 대폭 감소
 */
export function drawPing(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const hitCount = p.hitCount || 0;
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle); // v7.20: 아이소메트릭 3D 원근감

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // 사이버 팔레트
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#f472b6' : '#06b6d4');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '244, 114, 182' : '6, 182, 212');

  // 바운스 이펙트
  const bounceScale = hitCount > 0 ? EASING.easeOutBounce(Math.min(1, ((time / 100) % 1))) : 1;
  const packetSize = Math.max(10, (p.radius || 5) * 2.5) * (1 + hitCount * 0.1) * bounceScale;

  // ===== 네트워크 웨이브 트레일 (v7.34: 개수 증가 4/3/3, 알파값 0.4→0.65) =====
  const trailLen = isUltimate ? 4 : (isEvolved ? 3 : 3);
  for (let t = trailLen; t >= 1; t--) {
    const trailEase = EASING.easeOutExpo(1 - t / trailLen);
    const trailX = -t * 12 * trailEase;
    const alpha = 0.65 * (1 - t / trailLen);

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(trailX, 0, 8 - t * 1.5, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.stroke();
  }

  // ===== 펄스 링 (v7.34: 알파값 0.35→0.55, lineWidth 증가) =====
  const pulsePhase = (time / 250) % 1;
  const ringRadius = packetSize + pulsePhase * 15;
  const ringAlpha = (1 - pulsePhase) * 0.55;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
  ctx.lineWidth = 2.5 * (1 - pulsePhase);
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 메인 패킷 (v7.34: 글로우 알파 0.3→0.5, shadowBlur 12→16) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const hAngle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const hx = Math.cos(hAngle) * packetSize * 1.2;
      const hy = Math.sin(hAngle) * packetSize * 1.2;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 패킷 본체 (단색)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const hAngle = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const hx = Math.cos(hAngle) * packetSize;
    const hy = Math.sin(hAngle) * packetSize;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fill();

  // 테두리 (v7.34: shadowBlur 8→12, lineWidth 2.5→3)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 내부 정보 =====
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = mainColor;
  ctx.textAlign = 'center';
  ctx.fillText('ICMP', 0, -2);

  ctx.font = '5px monospace';
  ctx.fillStyle = '#94a3b8';
  const ttl = isUltimate ? 255 : (isEvolved ? 128 : 64);
  ctx.fillText(`TTL:${Math.max(0, ttl - hitCount)}`, 0, 7);

  // ===== 바운스 카운터 =====
  if (hitCount > 0) {
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(packetSize - 3, -packetSize + 3, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#000';
    ctx.fillText(String(hitCount), packetSize - 3, -packetSize + 6);
  }

  // ===== 전송 방향 화살표 (v7.15: 3→2) =====
  const arrowFlow = (time / 200) % 1;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;

  for (let a = 0; a < 2; a++) {
    const aProgress = (arrowFlow + a * 0.5) % 1;
    const ax = packetSize + 3 + aProgress * 10;
    const aAlpha = Math.sin(aProgress * Math.PI);

    ctx.save();
    ctx.globalAlpha = aAlpha;
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax - 4, -3);
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax - 4, 3);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 진화/궁극 (v7.34: 오비탈 개수 4/3, 알파값 0.5→0.75, 크기 증가) =====
  if (isEvolved || isUltimate) {
    const subCount = isUltimate ? 4 : 3;
    for (let s = 0; s < subCount; s++) {
      const sAngle = (time / 500 + s * Math.PI * 2 / subCount) % (Math.PI * 2);
      const sDist = packetSize + 14;

      ctx.fillStyle = `rgba(${glowColorRgba}, 0.75)`;
      ctx.beginPath();
      ctx.arc(Math.cos(sAngle) * sDist, Math.sin(sAngle) * sDist, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-p.angle);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.fillText('BROADCAST', 0, -packetSize - 10);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * 클러스터탄 / Siege Cannon — TERRITORY (DATA) 카테고리
 * v37: 대형 포탄 형태 + 착탄 폭발 + 분열 파편 (블루 에너지 테마)
 */
export function drawShard(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // TERRITORY 컬러 팔레트 (블루 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#93C5FD' : '#3B82F6');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '147, 197, 253' : '59, 130, 246');
  const coreColor = isUltimate ? '#FEF3C7' : '#1E3A8A';

  const shardSize = Math.max(12, p.radius * 1.3);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));

  // 회전 (포탄 스핀)
  const spinProgress = Math.max(0, Math.min(1, 1 - lifeRatio));
  const spinEase = EASING.easeOutExpo(spinProgress);
  const spin = spinEase * Math.PI * 4;
  ctx.rotate(spin);

  // ===== 1. 에너지 트레일 잔상 =====
  const trailCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let t = trailCount; t >= 1; t--) {
    const trailAlpha = (1 - t / (trailCount + 1)) * 0.5;
    const trailSpin = spin - t * 0.35;

    ctx.save();
    ctx.rotate(-spin + trailSpin);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.6)`;
    ctx.beginPath();
    // 포탄 형태 잔상
    ctx.moveTo(shardSize * 0.6, 0);
    ctx.lineTo(shardSize * 0.15, -shardSize * 0.4);
    ctx.lineTo(-shardSize * 0.5, -shardSize * 0.2);
    ctx.lineTo(-shardSize * 0.5, shardSize * 0.2);
    ctx.lineTo(shardSize * 0.15, shardSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 2. 포탄 본체 (다각형 클러스터) =====
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
  }

  // 포탄 외형 (다면체)
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.moveTo(shardSize * 0.7, 0);
  ctx.lineTo(shardSize * 0.2, -shardSize * 0.55);
  ctx.lineTo(-shardSize * 0.4, -shardSize * 0.3);
  ctx.lineTo(-shardSize * 0.5, 0);
  ctx.lineTo(-shardSize * 0.4, shardSize * 0.3);
  ctx.lineTo(shardSize * 0.2, shardSize * 0.55);
  ctx.closePath();
  ctx.fill();

  // 포탄 테두리 (에너지 라인)
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 3. 내부 분열선 (클러스터 세그먼트 표시) =====
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.6)`;
  ctx.lineWidth = 1;
  // 분열 라인 (3방향)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(shardSize * 0.5, shardSize * 0.2);
  ctx.moveTo(0, 0);
  ctx.lineTo(-shardSize * 0.3, -shardSize * 0.25);
  ctx.moveTo(0, 0);
  ctx.lineTo(-shardSize * 0.1, shardSize * 0.35);
  ctx.stroke();

  // 에너지 코어
  const corePulse = 0.7 + Math.sin(time / 50) * 0.3;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, 0, 3 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 4. 에너지 스파크 (표면 전기) =====
  const sparkCount = isUltimate ? 4 : (isEvolved ? 3 : 2);
  for (let s = 0; s < sparkCount; s++) {
    const sPhase = ((time / 70 + s * 0.3) % 1);
    const sAngle = s * Math.PI * 2 / sparkCount + time / 100;
    const sDist = shardSize * 0.45;
    const sx = Math.cos(sAngle) * sDist;
    const sy = Math.sin(sAngle) * sDist;
    const sAlpha = Math.sin(sPhase * Math.PI) * 0.8;

    ctx.fillStyle = `rgba(${glowColorRgba}, ${sAlpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 5. 진화: 6방향 분열 암시 =====
  if (isEvolved || isUltimate) {
    const splitCount = isUltimate ? 6 : 4;
    const splitAlpha = 0.4 + Math.sin(time / 200) * 0.2;

    ctx.save();
    ctx.globalAlpha = splitAlpha;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let sp = 0; sp < splitCount; sp++) {
      const spAngle = (sp / splitCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(spAngle) * shardSize * 0.5, Math.sin(spAngle) * shardSize * 0.5);
      ctx.lineTo(Math.cos(spAngle) * shardSize * 1.2, Math.sin(spAngle) * shardSize * 1.2);
      ctx.stroke();

      // 분열 방향 점
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(
        Math.cos(spAngle) * shardSize * 1.2,
        Math.sin(spAngle) * shardSize * 1.2,
        2, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * NPM Install - 패키지 폭탄 드롭
 * v4.9: 낙하 이징 + 프로그레스 애니메이션 + 의존성 파티클
 * v6.0: 아이소메트릭 Z축 물리 + 그림자 렌더링
 * v7.15: 성능 최적화 - 파티클/글로우/shadowBlur 감소
 */
export function drawAirdrop(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const useGlow = shouldUseGlow();

  // v6.0: Z축 물리가 있는 경우 그림자 먼저 렌더링
  const z = p.z ?? 0;
  if (z > 0) {
    drawProjectileShadow(ctx, 0, 0, z, 20);
    ctx.translate(0, -z * ISO_Z_TO_SCREEN_Y);
  }

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // NPM 레드 팔레트
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#f472b6' : '#cb3837');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '244, 114, 182' : '203, 56, 55');

  // 스윙
  const swing = Math.sin(time / 160 * Math.PI * 2) * 0.1;

  ctx.save();
  ctx.rotate(swing);

  // ===== 다운로드 스트림 (v7.34: 개수 증가 4/3/3, 알파값 0.5→0.7) =====
  const streamCount = isUltimate ? 4 : (isEvolved ? 3 : 3);
  for (let s = 0; s < streamCount; s++) {
    const sX = -8 + s * 5;
    const sPhase = (time / 100 + s * 0.3) % 1;
    const sY = -38 + sPhase * 18;
    const sAlpha = (1 - sPhase) * 0.7;

    ctx.fillStyle = `rgba(${glowColorRgba}, ${sAlpha})`;
    ctx.beginPath();
    ctx.arc(sX, sY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 케이블/줄 =====
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  ctx.quadraticCurveTo(-2, -10, 0, 0);
  ctx.moveTo(10, -22);
  ctx.quadraticCurveTo(2, -10, 0, 0);
  ctx.stroke();

  // ===== 클라우드 (v7.34: shadowBlur 8→12, lineWidth 증가) =====
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, -32, 12, 0, Math.PI * 2);
  ctx.arc(-10, -28, 8, 0, Math.PI * 2);
  ctx.arc(10, -28, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 다운로드 아이콘
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.lineTo(0, -26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(-4, -30);
  ctx.lineTo(4, -30);
  ctx.closePath();
  ctx.fill();

  // ===== 패키지 박스 (v7.34: 글로우 알파 0.3→0.5, shadowBlur 10→14) =====
  const boxSize = 20;

  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-boxSize / 2 - 1, -boxSize / 2 + 4, boxSize + 2, boxSize + 2, 4);
    ctx.fill();
    ctx.restore();
  }

  // 박스 본체 (단색)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-boxSize / 2, -boxSize / 2 + 5, boxSize, boxSize, 4);
  ctx.fill();

  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== NPM 로고 =====
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = mainColor;
  ctx.textAlign = 'center';
  ctx.fillText('npm', 0, 18);

  ctx.font = '5px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(isUltimate ? '@latest' : '^1.0.0', 0, 8);

  // ===== 의존성 파티클 (v7.34: 개수 증가 5/4/3, 알파값 0.5→0.75) =====
  const depCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let d = 0; d < depCount; d++) {
    const dAngle = (time / 400 + d * Math.PI * 2 / depCount) % (Math.PI * 2);
    const dDist = boxSize + 10;

    ctx.fillStyle = `rgba(${glowColorRgba}, 0.75)`;
    ctx.beginPath();
    ctx.roundRect(
      Math.cos(dAngle) * dDist - 3.5,
      Math.sin(dAngle) * dDist + 5 - 3.5,
      7, 7, 2
    );
    ctx.fill();
  }

  // ===== 진화/궁극 (v7.15: gradient→단색) =====
  if (isEvolved || isUltimate) {
    // 프로그레스 바
    ctx.fillStyle = '#334155';
    ctx.fillRect(-boxSize / 2, boxSize / 2 + 10, boxSize, 5);

    const progress = (time / 1200) % 1;
    ctx.fillStyle = mainColor;
    ctx.fillRect(-boxSize / 2, boxSize / 2 + 10, boxSize * progress, 5);

    ctx.font = '4px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Installing...', 0, boxSize / 2 + 22);

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-swing);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('node_modules/', 0, -48);
      ctx.font = 'bold 9px monospace';
      ctx.fillText('1.2GB!', 0, -40);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Git Fork - 날아가는 번개 줄기 (v7.42)
 * 디아블로 체인 라이트닝 스타일: 사방으로 전기가 퍼져나감!
 * 각 projectile이 개별 번개 줄기로 날아감
 */
export function drawFork(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // 컬러 스킴 (전기/사이버 테마)
  const mainColor = isUltimate ? '#fbbf24' : (isEvolved ? '#a855f7' : '#06b6d4');
  const glowRgb = isUltimate ? '251, 191, 36' : (isEvolved ? '168, 85, 247' : '6, 182, 212');
  const coreColor = isUltimate ? '#fef3c7' : (isEvolved ? '#e9d5ff' : '#ffffff');

  // 번개 길이 (이동 방향으로)
  const boltLength = Math.max(25, p.radius * 3);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));

  ctx.save();
  ctx.translate(p.position.x, p.position.y);
  ctx.rotate(p.angle); // 이동 방향으로 회전

  // ===== 1. 트레일 (뒤로 뻗는 전기 잔상) (v7.34: 개수 증가 5/4/3, 알파값 0.3→0.5) =====
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let t = 1; t <= trailCount; t++) {
    const trailAlpha = (1 - t / (trailCount + 1)) * 0.5 * lifeRatio;
    const trailOffset = -t * 8;

    ctx.save();
    ctx.globalAlpha = trailAlpha;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3.5 - t * 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trailOffset, 0);
    ctx.lineTo(trailOffset - 12, Math.sin(time / 50 + t) * 4);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 2. 메인 번개 줄기 (지글거리는 경로) =====
  const segments = 5;
  const points: { x: number; y: number }[] = [{ x: -boltLength * 0.3, y: 0 }];

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = -boltLength * 0.3 + boltLength * t;

    // 지터 (지글거림) - 시간 기반
    const jitterAmount = 8 * (1 - Math.abs(t - 0.5) * 2); // 중간이 가장 많이 흔들림
    const jitter = Math.sin(time / 30 + i * 2.3 + p.angle * 10) * jitterAmount;

    points.push({
      x: baseX,
      y: jitter
    });
  }

  // === 글로우 레이어 (v7.34: 알파값 0.5→0.7, shadowBlur 15→20, lineWidth 증가) ===
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.7 * lifeRatio;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 10;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // === 메인 전기 라인 (v7.34: lineWidth 4→5) ===
  ctx.save();
  ctx.globalAlpha = lifeRatio;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // === 코어 라인 (밝은 중심) ===
  ctx.save();
  ctx.globalAlpha = lifeRatio;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // ===== 3. 선두 전기 볼 (번개 머리) (v7.34: 크기 증가, 알파값 0.6→0.8, shadowBlur 12→18) =====
  const headX = points[points.length - 1].x;
  const headY = points[points.length - 1].y;
  const headPulse = 0.85 + Math.sin(time / 40) * 0.15;
  const headSize = (isUltimate ? 8 : (isEvolved ? 6.5 : 5)) * headPulse;

  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.8 * lifeRatio;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(headX, headY, headSize * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = lifeRatio;
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(headX, headY, headSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ===== 4. 분기 번개 (진화/궁극) (v7.34: 알파값 0.6→0.8, lineWidth 2→3, 노드 크기 2→3) =====
  if (isEvolved || isUltimate) {
    const branchCount = isUltimate ? 4 : 2;
    const midPoint = points[2]; // 중간 지점

    for (let b = 0; b < branchCount; b++) {
      const branchAngle = (b % 2 === 0 ? 1 : -1) * (0.5 + b * 0.2);
      const branchLength = boltLength * (isUltimate ? 0.45 : 0.38);

      ctx.save();
      ctx.globalAlpha = 0.8 * lifeRatio;
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      // 분기 번개 경로
      ctx.beginPath();
      ctx.moveTo(midPoint.x, midPoint.y);

      const branchEndX = midPoint.x + Math.cos(branchAngle) * branchLength;
      const branchEndY = midPoint.y + Math.sin(branchAngle) * branchLength;
      const branchMidX = midPoint.x + Math.cos(branchAngle) * branchLength * 0.5;
      const branchMidY = midPoint.y + Math.sin(branchAngle) * branchLength * 0.5 + Math.sin(time / 35 + b) * 6;

      ctx.quadraticCurveTo(branchMidX, branchMidY, branchEndX, branchEndY);
      ctx.stroke();

      // 분기 끝 노드 (v7.34: 크기 증가)
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(branchEndX, branchEndY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 5. 궁극 전용: 전기 스파크 입자 (v7.34: 개수 4→6, 크기 2→3, 알파값 증가) =====
  if (isUltimate) {
    const sparkCount = 6;
    for (let s = 0; s < sparkCount; s++) {
      const sparkPhase = ((time / 70 + s * 0.17) % 1);
      const sparkX = -boltLength * 0.3 + boltLength * sparkPhase;
      const sparkY = Math.sin(time / 22 + s * 1.3) * 10;
      const sparkAlpha = Math.sin(sparkPhase * Math.PI) * 0.95 * lifeRatio;

      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}
