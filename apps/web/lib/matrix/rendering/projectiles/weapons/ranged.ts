/**
 * game/rendering/projectiles/weapons/ranged.ts - 원거리 무기 렌더링
 * v37: 카테고리 테마 리디자인
 *   - knife (전투 단검 / Railgun): STEEL 레드 — 관통 라인 + 전하 파티클 + 충격파
 *   - bow (레일건 빔 / Data Wave): TERRITORY 블루 — 충격파 링 (확장하며 감쇠)
 *   - ping (소나 펄스): ALLIANCE 퍼플 — 동심원 소나 파동 + 네트워크 노드 패턴
 *   - shard (클러스터탄 / Siege Cannon): TERRITORY 블루 — 대형 포탄 궤적 + 착탄 폭발
 *   - airdrop (공습): MORALE 시안 — 낙하 폭격 마커 + 충격파
 *   - fork (분열탄): ALLIANCE 퍼플 — 분기 에너지 볼트 + 동맹 연결선
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
/**
 * 소나 펄스 (Sonar Pulse) — ALLIANCE (NETWORK) 카테고리
 * v37 Phase 4: 동심원 소나 파동 + 네트워크 노드 패턴 (퍼플 외교/동맹 테마)
 * - 확산하는 소나 링 (벽 반사 암시)
 * - 네트워크 노드 연결선
 * - 진화: 추적 파동 + 다중 소나
 */
export function drawPing(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const hitCount = p.hitCount || 0;
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // ALLIANCE 컬러 팔레트 (퍼플 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#C4B5FD' : '#8B5CF6');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '196, 181, 253' : '139, 92, 246');
  const deepColor = isUltimate ? '#FEF3C7' : '#4C1D95';

  // 바운스 이펙트
  const bounceScale = hitCount > 0 ? EASING.easeOutBounce(Math.min(1, ((time / 100) % 1))) : 1;
  const pulseSize = Math.max(10, (p.radius || 5) * 2.5) * (1 + hitCount * 0.1) * bounceScale;

  // ===== 1. 소나 파동 트레일 (확산 호) =====
  const trailLen = isUltimate ? 4 : (isEvolved ? 3 : 3);
  for (let t = trailLen; t >= 1; t--) {
    const trailEase = EASING.easeOutExpo(1 - t / trailLen);
    const trailX = -t * 14 * trailEase;
    const alpha = 0.6 * (1 - t / trailLen);

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(trailX, 0, 10 - t * 2, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  }

  // ===== 2. 확산 소나 링 (3중 동심원) =====
  const ringCount = isUltimate ? 3 : 2;
  for (let r = 0; r < ringCount; r++) {
    const ringPhase = ((time / 300 + r * 0.33) % 1);
    const ringRadius = pulseSize + ringPhase * 20;
    const ringAlpha = (1 - ringPhase) * 0.5;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
    ctx.lineWidth = 2.5 * (1 - ringPhase);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 3. 메인 소나 코어 (원형 에너지 구체) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, pulseSize * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 코어 본체 (다크 퍼플)
  ctx.fillStyle = deepColor;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.fill();

  // 코어 테두리
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 4. 내부 소나 패턴 (십자 + 동심원) =====
  const scanPulse = 0.8 + Math.sin(time / 100) * 0.2;

  // 십자 레이더 라인
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-pulseSize * 0.7, 0);
  ctx.lineTo(pulseSize * 0.7, 0);
  ctx.moveTo(0, -pulseSize * 0.7);
  ctx.lineTo(0, pulseSize * 0.7);
  ctx.stroke();

  // 내부 미니 링
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.4)`;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize * 0.45 * scanPulse, 0, Math.PI * 2);
  ctx.stroke();

  // 스캔 스윕 (회전하는 부채꼴)
  const sweepAngle = (time / 500) % (Math.PI * 2);
  ctx.fillStyle = `rgba(${glowColorRgba}, 0.25)`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, pulseSize * 0.8, sweepAngle, sweepAngle + Math.PI * 0.4);
  ctx.closePath();
  ctx.fill();

  // ===== 5. 바운스 카운터 뱃지 =====
  if (hitCount > 0) {
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(pulseSize - 3, -pulseSize + 3, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(String(hitCount), pulseSize - 3, -pulseSize + 6);
  }

  // ===== 6. 네트워크 노드 (진화/궁극) =====
  if (isEvolved || isUltimate) {
    const nodeCount = isUltimate ? 5 : 3;
    for (let n = 0; n < nodeCount; n++) {
      const nAngle = (time / 600 + n * Math.PI * 2 / nodeCount) % (Math.PI * 2);
      const nDist = pulseSize + 12;
      const nx = Math.cos(nAngle) * nDist;
      const ny = Math.sin(nAngle) * nDist;

      // 연결선 (코어 → 노드)
      ctx.strokeStyle = `rgba(${glowColorRgba}, 0.4)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.setLineDash([]);

      // 노드 점
      ctx.fillStyle = `rgba(${glowColorRgba}, 0.8)`;
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 궁극: EMP 펄스 라벨
    if (isUltimate) {
      ctx.save();
      ctx.rotate(-p.angle);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.fillText('EMP PULSE', 0, -pulseSize - 10);
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
 * 공습 (Airstrike) — MORALE (SYSTEM) 카테고리
 * v37 Phase 4: 낙하 폭격 마커 + 충격파 + 사기 파동 (시안 사기/여론 테마)
 * - 낙하 궤적 (시안 트레일)
 * - 폭격 타겟 마커 (십자선)
 * - 진화: 융단 폭격 다중 투하
 */
export function drawAirdrop(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();

  // Z축 물리 — 그림자 렌더링
  const z = p.z ?? 0;
  if (z > 0) {
    drawProjectileShadow(ctx, 0, 0, z, 20);
    ctx.translate(0, -z * ISO_Z_TO_SCREEN_Y);
  }

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // MORALE 컬러 팔레트 (시안 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#67E8F9' : '#06B6D4');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '103, 232, 249' : '6, 182, 212');
  const deepColor = '#164E63';

  // 낙하 흔들림
  const swing = Math.sin(time / 160 * Math.PI * 2) * 0.08;

  ctx.save();
  ctx.rotate(swing);

  // ===== 1. 낙하 궤적 (하강 스트림) =====
  const streamCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let s = 0; s < streamCount; s++) {
    const sX = -6 + s * 3;
    const sPhase = (time / 80 + s * 0.25) % 1;
    const sY = -42 + sPhase * 20;
    const sAlpha = (1 - sPhase) * 0.7;

    ctx.fillStyle = `rgba(${glowColorRgba}, ${sAlpha})`;
    ctx.beginPath();
    ctx.arc(sX, sY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 2. 타겟 마커 (십자선 — 착탄 지점 표시) =====
  const markerPulse = 0.8 + Math.sin(time / 150) * 0.2;
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.5)`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 8, 16 * markerPulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 십자 조준선
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.4)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, 8); ctx.lineTo(10, 8);
  ctx.moveTo(0, -2); ctx.lineTo(0, 18);
  ctx.stroke();

  // ===== 3. 폭탄 본체 (유선형 미사일) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.ellipse(0, -8, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 미사일 본체
  ctx.fillStyle = deepColor;
  ctx.beginPath();
  ctx.ellipse(0, -8, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 미사일 노즈콘 (윗부분 하이라이트)
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(-4, -18);
  ctx.lineTo(0, -22);
  ctx.lineTo(4, -18);
  ctx.closePath();
  ctx.fill();

  // 안정 날개 (하단)
  ctx.fillStyle = `rgba(${glowColorRgba}, 0.6)`;
  ctx.beginPath();
  ctx.moveTo(-7, 2);
  ctx.lineTo(-12, 6);
  ctx.lineTo(-7, 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, 2);
  ctx.lineTo(12, 6);
  ctx.lineTo(7, 4);
  ctx.closePath();
  ctx.fill();

  // ===== 4. 추진 화염 (하단 제트) =====
  const flamePulse = 0.7 + Math.sin(time / 30) * 0.3;
  ctx.fillStyle = `rgba(${glowColorRgba}, ${0.6 * flamePulse})`;
  ctx.beginPath();
  ctx.moveTo(-3, 4);
  ctx.lineTo(0, 4 + 8 * flamePulse);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();

  // ===== 5. 진화/궁극: 편대 폭격 =====
  if (isEvolved || isUltimate) {
    const wingCount = isUltimate ? 4 : 2;
    for (let w = 0; w < wingCount; w++) {
      const wx = (w % 2 === 0 ? -1 : 1) * (14 + Math.floor(w / 2) * 10);
      const wy = -4 + Math.sin(time / 200 + w) * 3;
      const wAlpha = 0.5 + Math.sin(time / 300 + w * 1.5) * 0.15;

      ctx.save();
      ctx.globalAlpha = wAlpha;
      ctx.fillStyle = `rgba(${glowColorRgba}, 0.7)`;
      ctx.beginPath();
      ctx.ellipse(wx, wy, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-swing);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.fillText('CARPET BOMB', 0, -30);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * 분열탄 (MIRV Warhead) — ALLIANCE (NETWORK) 카테고리
 * v37 Phase 4: 분기 에너지 볼트 + 동맹 연결선 (퍼플 외교/동맹 테마)
 * - 전진 후 Y자 분기하는 에너지 볼트
 * - 동맹 연결선 (분기 경로 표시)
 * - 진화: 다탄두 MIRV 패턴
 */
export function drawFork(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const useGlow = shouldUseGlow();

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // ALLIANCE 컬러 팔레트 (퍼플 계열)
  const mainColor = isUltimate ? '#fbbf24' : (isEvolved ? '#C4B5FD' : '#8B5CF6');
  const glowRgb = isUltimate ? '251, 191, 36' : (isEvolved ? '196, 181, 253' : '139, 92, 246');
  const coreColor = isUltimate ? '#fef3c7' : (isEvolved ? '#EDE9FE' : '#ffffff');

  // 볼트 길이
  const boltLength = Math.max(25, p.radius * 3);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));

  ctx.save();
  ctx.translate(p.position.x, p.position.y);
  ctx.rotate(p.angle);

  // ===== 1. 트레일 (퍼플 에너지 잔상) =====
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
    ctx.lineTo(trailOffset - 10, Math.sin(time / 50 + t) * 3);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 2. 메인 에너지 볼트 (진행 경로) =====
  const segments = 5;
  const points: { x: number; y: number }[] = [{ x: -boltLength * 0.3, y: 0 }];

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = -boltLength * 0.3 + boltLength * t;
    const jitterAmount = 5 * (1 - Math.abs(t - 0.5) * 2);
    const jitter = Math.sin(time / 35 + i * 2.3 + p.angle * 10) * jitterAmount;
    points.push({ x: baseX, y: jitter });
  }

  // 글로우 레이어
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.6 * lifeRatio;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 9;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;
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

  // 메인 에너지 라인
  ctx.save();
  ctx.globalAlpha = lifeRatio;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // 코어 라인 (밝은 중심)
  ctx.save();
  ctx.globalAlpha = lifeRatio;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // ===== 3. 선두 에너지 노드 (분열 코어) =====
  const headX = points[points.length - 1].x;
  const headY = points[points.length - 1].y;
  const headPulse = 0.85 + Math.sin(time / 40) * 0.15;
  const headSize = (isUltimate ? 7 : (isEvolved ? 6 : 4.5)) * headPulse;

  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.7 * lifeRatio;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(headX, headY, headSize * 1.5, 0, Math.PI * 2);
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

  // Y자 분기 표시 (앞쪽에 분기 예고선)
  const forkAlpha = 0.4 + Math.sin(time / 200) * 0.15;
  ctx.save();
  ctx.globalAlpha = forkAlpha * lifeRatio;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(headX, headY);
  ctx.lineTo(headX + 12, headY - 8);
  ctx.moveTo(headX, headY);
  ctx.lineTo(headX + 12, headY + 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ===== 4. 분기 볼트 (진화/궁극) =====
  if (isEvolved || isUltimate) {
    const branchCount = isUltimate ? 4 : 2;
    const midPoint = points[2];

    for (let b = 0; b < branchCount; b++) {
      const branchAngle = (b % 2 === 0 ? 1 : -1) * (0.5 + b * 0.2);
      const branchLength = boltLength * (isUltimate ? 0.45 : 0.38);

      ctx.save();
      ctx.globalAlpha = 0.75 * lifeRatio;
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(midPoint.x, midPoint.y);

      const branchEndX = midPoint.x + Math.cos(branchAngle) * branchLength;
      const branchEndY = midPoint.y + Math.sin(branchAngle) * branchLength;
      const branchMidX = midPoint.x + Math.cos(branchAngle) * branchLength * 0.5;
      const branchMidY = midPoint.y + Math.sin(branchAngle) * branchLength * 0.5 + Math.sin(time / 35 + b) * 5;

      ctx.quadraticCurveTo(branchMidX, branchMidY, branchEndX, branchEndY);
      ctx.stroke();

      // 분기 끝 노드 (동맹 노드)
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(branchEndX, branchEndY, 3, 0, Math.PI * 2);
      ctx.fill();

      // 동맹 연결 링
      ctx.strokeStyle = `rgba(${glowRgb}, 0.4)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(branchEndX, branchEndY, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ===== 5. 궁극: MIRV 분산 스파크 =====
  if (isUltimate) {
    const sparkCount = 6;
    for (let s = 0; s < sparkCount; s++) {
      const sparkPhase = ((time / 70 + s * 0.17) % 1);
      const sparkX = -boltLength * 0.3 + boltLength * sparkPhase;
      const sparkY = Math.sin(time / 22 + s * 1.3) * 8;
      const sparkAlpha = Math.sin(sparkPhase * Math.PI) * 0.9 * lifeRatio;

      ctx.save();
      ctx.globalAlpha = sparkAlpha;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}
