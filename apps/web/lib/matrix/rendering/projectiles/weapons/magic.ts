/**
 * game/rendering/projectiles/weapons/magic.ts - 마법/영역 무기 렌더링
 * v37: 카테고리 테마 리디자인
 *   - wand (에너지 볼트 / Plasma Bolt): TERRITORY 블루 — 영역 확장 펄스
 *   - bible (가디언 위성): SOVEREIGNTY 그린 — 궤도 방어 유닛 + 에너지 실드
 *   - garlic (방어 필드): SOVEREIGNTY 그린 — 방어 오라 + 육각 실드 패턴
 *   - pool (지뢰밭 / Minefield): SOVEREIGNTY 그린 — 매설 방어 구역 + 경고 패턴
 */

import { shouldUseGlow } from '../../enemies/renderContext';
import { isoRenderAngle, applyIsoProjectileTransform } from '../../../isometric';
import { EASING } from '../../effects/easing';

export interface MagicWeaponParams {
  ctx: CanvasRenderingContext2D;
  p: any;
  playerPos: { x: number; y: number };
  time?: number; // v7.20: 프레임당 1회만 Date.now() 호출하여 전달
}

// v7.20: 공통 easing 모듈 사용 (중복 제거)

/**
 * 에너지 볼트 / Plasma Bolt — TERRITORY (DATA) 카테고리
 * v37: 영역 확장 펄스 + 플라즈마 에너지 (블루 에너지 테마)
 */
export function drawWand(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const bounceBonus = 1 + (p.bounceCount || 0) * 0.5;
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // TERRITORY 컬러 팔레트 (블루 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#93C5FD' : '#3B82F6');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '147, 197, 253' : '59, 130, 246');
  const coreColor = isUltimate ? '#FEF3C7' : '#DBEAFE';

  // 크기 with 탄성 등장
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const appearProgress = Math.max(0, Math.min(1, (1 - lifeRatio) * 4));
  const bounceScale = Math.max(0.1, EASING.easeOutBack(appearProgress));
  const boltSize = Math.max(8, Math.max(12, (p.radius || 6) * 2.5) * bounceBonus * bounceScale);

  // ===== 1. 에너지 트레일 (플라즈마 잔상) =====
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3);
  for (let i = trailCount; i >= 1; i--) {
    const trailEase = EASING.easeOutExpo(1 - i / trailCount);
    const offsetX = -i * 10 * trailEase;
    const waveY = Math.sin(time / 80 + i * 1.2) * 3;
    const alpha = 0.7 * (1 - i / trailCount);

    ctx.fillStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(offsetX, waveY, boltSize * 0.35 - i * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 2. 영역 확장 펄스 링 =====
  const pulseCount = isUltimate ? 2 : 1;
  for (let pr = 0; pr < pulseCount; pr++) {
    const pulsePhase = ((time / 200 + pr * 0.5) % 1);
    const ringRadius = boltSize * 0.7 + pulsePhase * 15;
    const ringAlpha = (1 - pulsePhase) * 0.5;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
    ctx.lineWidth = 2.5 * (1 - pulsePhase);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 3. 메인 플라즈마 볼트 (빛나는 에너지 구체) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5 * bounceScale;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, boltSize * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 플라즈마 구체 본체
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, 0, boltSize * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // 테두리 글로우
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 내부 에너지 패턴 (파동 라인)
  const waveOffset = time / 50;
  ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let w = 0; w < 8; w++) {
    const wAngle = (w / 8) * Math.PI * 2 + waveOffset;
    const wr = boltSize * 0.35;
    const wx = Math.cos(wAngle) * wr;
    const wy = Math.sin(wAngle) * wr;
    if (w === 0) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  }
  ctx.closePath();
  ctx.stroke();

  // 코어 (밝은 중심점)
  const corePulse = 0.8 + Math.sin(time / 35) * 0.2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, boltSize * 0.15 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 4. 에너지 전달 인디케이터 =====
  const pulse = Math.sin(time / 80) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(${glowColorRgba}, ${pulse})`;
  ctx.beginPath();
  ctx.arc(boltSize * 0.55, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  // 속도선 (에너지 궤적)
  for (let s = 0; s < 2; s++) {
    const flowProgress = ((time / 100) + s * 0.5) % 1;
    const sY = (s - 0.5) * 6;
    const sAlpha = Math.sin(flowProgress * Math.PI) * 0.6;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${sAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-boltSize * 0.6 - flowProgress * 12, sY);
    ctx.lineTo(-boltSize * 0.6 - flowProgress * 12 - 8, sY);
    ctx.stroke();
  }

  // ===== 5. 진화/궁극 이펙트 =====
  if (isEvolved || isUltimate) {
    // 오비탈 에너지 입자 (유도 궤적 암시)
    const orbitalCount = isUltimate ? 5 : 3;
    for (let d = 0; d < orbitalCount; d++) {
      const dAngle = (time / 250 + d * Math.PI * 2 / orbitalCount) % (Math.PI * 2);
      const dDist = boltSize * 0.7 + 6;

      ctx.fillStyle = `rgba(${glowColorRgba}, 0.8)`;
      ctx.beginPath();
      ctx.arc(
        Math.cos(dAngle) * dDist,
        Math.sin(dAngle) * dDist,
        2.5, 0, Math.PI * 2
      );
      ctx.fill();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-p.angle);
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fcd34d';
      ctx.fillText('PLASMA', 0, -boltSize * 0.7 - 8);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Documentation - API 문서/코드 에디터 오비탈
 * v4.9: 궤도 이징 + VS Code 스타일 + 타이핑 효과
 * v7.15: 성능 최적화 - LOD 기반 shadowBlur, 글로우 레이어 감소
 * v7.30: 아이소메트릭 Y 압축 적용 - 평면 위에 눕혀진 문서 느낌
 */
/**
 * 가디언 위성 (Guardian Satellite) — SOVEREIGNTY (SECURITY) 카테고리
 * v37 Phase 4: 궤도 방어 유닛 + 에너지 실드 (그린 방어/안보 테마)
 * - 궤도를 도는 방어 드론 (육각형 실드)
 * - 방어 에너지 필드 라인
 * - 진화: 전투 위성 + 공격 기능
 */
export function drawBible(params: MagicWeaponParams): void {
  const { ctx, p, playerPos, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const dx = p.position.x - playerPos.x;
  const dy = p.position.y - playerPos.y;
  const orbitAngle = Math.atan2(dy, dx);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  const useGlow = shouldUseGlow();

  // SOVEREIGNTY 컬러 팔레트 (그린 계열)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#86EFAC' : '#22C55E');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '134, 239, 172' : '34, 197, 94');
  const deepColor = '#14532D';

  ctx.save();

  // 궤도 회전
  const spinProgress = (time / 3000) % 1;
  const spinEase = EASING.easeInOutCubic(spinProgress);
  const satelliteSpin = spinEase * Math.PI * 2;

  ctx.rotate(orbitAngle);
  ctx.scale(1, 0.6); // 아이소메트릭 Y 압축
  ctx.rotate(Math.PI / 2 + satelliteSpin);

  // 위성 크기
  const satW = 24;
  const satH = 24;

  // ===== 1. 방어 실드 글로우 =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, satW * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===== 2. 위성 본체 (육각형 드론) =====
  ctx.fillStyle = deepColor;
  ctx.beginPath();
  for (let h = 0; h < 6; h++) {
    const hAngle = (h / 6) * Math.PI * 2 - Math.PI / 6;
    const hx = Math.cos(hAngle) * satW * 0.5;
    const hy = Math.sin(hAngle) * satH * 0.5;
    if (h === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fill();

  // 테두리
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 3. 내부 방어 문양 (실드 패턴) =====
  // 중앙 방패 마크
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(0, -satH * 0.25);
  ctx.lineTo(satW * 0.18, -satH * 0.1);
  ctx.lineTo(satW * 0.18, satH * 0.1);
  ctx.lineTo(0, satH * 0.22);
  ctx.lineTo(-satW * 0.18, satH * 0.1);
  ctx.lineTo(-satW * 0.18, -satH * 0.1);
  ctx.closePath();
  ctx.fill();

  // 방패 내부 어두운 라인
  ctx.fillStyle = deepColor;
  ctx.beginPath();
  ctx.moveTo(0, -satH * 0.15);
  ctx.lineTo(satW * 0.1, -satH * 0.05);
  ctx.lineTo(satW * 0.1, satH * 0.05);
  ctx.lineTo(0, satH * 0.12);
  ctx.lineTo(-satW * 0.1, satH * 0.05);
  ctx.lineTo(-satW * 0.1, -satH * 0.05);
  ctx.closePath();
  ctx.fill();

  // 중앙 에너지 코어
  const corePulse = 0.8 + Math.sin(time / 200) * 0.2;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, 0, 3 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 4. 안테나/센서 (위성 디테일) =====
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.6)`;
  ctx.lineWidth = 1.5;
  // 상단 센서
  ctx.beginPath();
  ctx.moveTo(0, -satH * 0.5);
  ctx.lineTo(0, -satH * 0.7);
  ctx.stroke();
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, -satH * 0.7, 2, 0, Math.PI * 2);
  ctx.fill();

  // ===== 5. 진화/궁극 추가 이펙트 =====
  if (isEvolved || isUltimate) {
    // 궤도 방어 링 (회전하는 실드 파편)
    const shieldCount = isUltimate ? 5 : 4;
    for (let c = 0; c < shieldCount; c++) {
      const cAngle = (time / 400 + c * Math.PI * 2 / shieldCount) % (Math.PI * 2);
      const cDist = satW * 0.55 + 8;
      const cPulse = 0.7 + Math.sin(time / 150 + c) * 0.3;

      // 작은 방어 실드 조각
      ctx.fillStyle = `rgba(${glowColorRgba}, ${cPulse})`;
      ctx.beginPath();
      const cx = Math.cos(cAngle) * cDist;
      const cy = Math.sin(cAngle) * cDist;
      // 작은 다이아몬드
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 3, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 3, cy);
      ctx.closePath();
      ctx.fill();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-orbitAngle - Math.PI / 2 - satelliteSpin);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.fillText('GUARDIAN', 0, -satH * 0.5 - 10);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Fortress Shield — SOVEREIGNTY (SECURITY) 카테고리
 * v37 Phase 4: 방어 요새 실드 + 육각 배리어 패턴
 * - 육각형 실드 타일 격자 (허니컴 포트리스)
 * - 회전하는 방어 포탑 아크 (그린 에너지 빔)
 * - 맥동하는 방어 오라 층 (다중 그린 링)
 * - 실드 재생 파티클 (나선형 에너지 순환)
 */
export function drawGarlic(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const shieldRadius = p.radius || 60;

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  const useGlow = shouldUseGlow();

  // SOVEREIGNTY 컬러 팔레트 (그린 계열 — 방어/안보)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#86EFAC' : '#22C55E');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '134, 239, 172' : '34, 197, 94');
  const deepGreen = isUltimate ? '250, 204, 21' : (isEvolved ? '74, 222, 128' : '22, 163, 74');

  ctx.save();

  // 기본 펄스 (요새 호흡)
  const pulse = 1 + Math.sin(time / 400) * 0.06;

  // ===== 1. 방어 오라 배경 (그린 에너지 필드) =====
  if (useGlow) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, shieldRadius * pulse);
    gradient.addColorStop(0, `rgba(${glowColorRgba}, 0.3)`);
    gradient.addColorStop(0.4, `rgba(${glowColorRgba}, 0.15)`);
    gradient.addColorStop(0.75, `rgba(${deepGreen}, 0.08)`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.16)`;
  }
  ctx.beginPath();
  ctx.arc(0, 0, shieldRadius * pulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 2. 육각형 실드 타일 격자 (허니컴 배리어) =====
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, shieldRadius * pulse * 0.88, 0, Math.PI * 2);
  ctx.clip();

  const hexSize = isUltimate ? 14 : (isEvolved ? 16 : 18);
  const hexRows = 5;
  const hexCols = 5;
  const hexH = hexSize * Math.sqrt(3);

  for (let row = -hexRows; row <= hexRows; row++) {
    for (let col = -hexCols; col <= hexCols; col++) {
      const hx = col * hexSize * 1.5;
      const hy = row * hexH + (col % 2 !== 0 ? hexH * 0.5 : 0);
      const dist = Math.sqrt(hx * hx + hy * hy);

      if (dist > shieldRadius * 0.9) continue;

      // 거리에 따른 투명도 + 시간 기반 맥동
      const distRatio = dist / shieldRadius;
      const hexPulse = Math.sin(time / 300 + dist * 0.05) * 0.5 + 0.5;
      const hexAlpha = (0.15 + hexPulse * 0.15) * (1 - distRatio * 0.6);

      ctx.strokeStyle = `rgba(${glowColorRgba}, ${hexAlpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const angle = (v / 6) * Math.PI * 2 - Math.PI / 6;
        const vx = hx + Math.cos(angle) * hexSize * 0.5;
        const vy = hy + Math.sin(angle) * hexSize * 0.5;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // ===== 3. 방어 포탑 아크 (회전하는 방어 빔) =====
  const turretCount = isUltimate ? 6 : (isEvolved ? 5 : 4);
  const turretWidth = Math.PI / (isUltimate ? 7 : 9);

  for (let i = 0; i < turretCount; i++) {
    const turretAngle = (time / 2200) + (i * Math.PI * 2 / turretCount);
    const turretAlpha = 0.2 + Math.sin(time / 350 + i * 1.5) * 0.08;

    ctx.save();
    ctx.rotate(turretAngle);

    if (useGlow) {
      const beamGrad = ctx.createRadialGradient(0, 0, shieldRadius * 0.15, 0, 0, shieldRadius * 0.85);
      beamGrad.addColorStop(0, `rgba(${glowColorRgba}, ${turretAlpha * 0.4})`);
      beamGrad.addColorStop(0.6, `rgba(${glowColorRgba}, ${turretAlpha})`);
      beamGrad.addColorStop(1, `rgba(${glowColorRgba}, 0)`);
      ctx.fillStyle = beamGrad;
    } else {
      ctx.fillStyle = `rgba(${glowColorRgba}, ${turretAlpha * 0.6})`;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, shieldRadius * 0.82 * pulse, -turretWidth, turretWidth);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ===== 4. 다중 방어 링 (물결치는 동심원) =====
  const ringCount = isUltimate ? 4 : 3;
  for (let r = 0; r < ringCount; r++) {
    const wavePhase = time / 500 + r * Math.PI * 0.7;
    const baseRadius = shieldRadius * (0.3 + r * 0.18);
    const waveAmp = shieldRadius * 0.04;
    const ringRadius = baseRadius + Math.sin(wavePhase) * waveAmp;
    const ringAlpha = 0.35 - r * 0.07;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
    ctx.lineWidth = 2.5 - r * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 5. 외곽 회전 대시 링 (포트리스 경계) =====
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.45)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = time / 55;
  ctx.beginPath();
  ctx.arc(0, 0, shieldRadius * 0.92 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // ===== 6. 실드 재생 파티클 (나선형 순환) =====
  const particleCount = isUltimate ? 8 : (isEvolved ? 6 : 4);
  for (let i = 0; i < particleCount; i++) {
    const spiralAngle = (time / 1500) + (i * Math.PI * 2 / particleCount);
    const spiralRadius = shieldRadius * (0.25 + Math.sin(time / 800 + i) * 0.2);
    const px = Math.cos(spiralAngle) * spiralRadius * pulse;
    const py = Math.sin(spiralAngle) * spiralRadius * pulse;
    const pAlpha = 0.55 + Math.sin(time / 250 + i * 2) * 0.2;

    // 다이아몬드 형태 파티클 (방패 파편)
    const pSize = 4 + Math.sin(time / 200 + i) * 1.5;
    const pRgba = i % 2 === 0 ? glowColorRgba : deepGreen;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(time / 400 + i);
    ctx.fillStyle = `rgba(${pRgba}, ${pAlpha})`;
    ctx.beginPath();
    ctx.moveTo(0, -pSize);
    ctx.lineTo(pSize * 0.6, 0);
    ctx.lineTo(0, pSize);
    ctx.lineTo(-pSize * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ===== 7. 중앙 방어 코어 (실드 제너레이터) =====
  const corePulse = 1 + Math.sin(time / 200) * 0.25;
  const coreSize = 9 * corePulse;

  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
  }

  // 코어 외곽 (육각형)
  ctx.fillStyle = `rgba(${glowColorRgba}, 0.75)`;
  ctx.beginPath();
  for (let v = 0; v < 6; v++) {
    const angle = (v / 6) * Math.PI * 2 - Math.PI / 6;
    const vx = Math.cos(angle) * coreSize;
    const vy = Math.sin(angle) * coreSize;
    if (v === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // 코어 내부 밝은 원
  ctx.fillStyle = `rgba(255, 255, 255, ${0.65 + Math.sin(time / 150) * 0.25})`;
  ctx.beginPath();
  ctx.arc(0, 0, coreSize * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // ===== 8. 방어 펄스 웨이브 (퍼져나가는 실드 링) =====
  const waveProgress = (time / 900) % 1;
  const waveRadius = coreSize + waveProgress * (shieldRadius * 0.92 - coreSize);
  const waveAlpha = (1 - waveProgress) * 0.5;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${waveAlpha})`;
  ctx.lineWidth = 2.5 * (1 - waveProgress);
  ctx.beginPath();
  ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 9. 진화/궁극 추가 효과 =====
  if (isEvolved || isUltimate) {
    // 외곽 에너지 파동 (방어 증폭)
    const outerWaveCount = isUltimate ? 3 : 2;
    for (let w = 0; w < outerWaveCount; w++) {
      const owProgress = ((time / 1000) + w * 0.33) % 1;
      const owRadius = shieldRadius * (0.6 + owProgress * 0.35) * pulse;
      const owAlpha = (1 - owProgress) * 0.18;

      ctx.strokeStyle = `rgba(${deepGreen}, ${owAlpha})`;
      ctx.lineWidth = 1.5 * (1 - owProgress);
      ctx.beginPath();
      ctx.arc(0, 0, owRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 포트리스 노드 (외곽 방어 포인트)
    const nodeCount = isUltimate ? 8 : 5;
    const nodeRadius = shieldRadius * 0.85 * pulse;
    for (let n = 0; n < nodeCount; n++) {
      const nAngle = (n / nodeCount) * Math.PI * 2 + time / 3000;
      const nx = Math.cos(nAngle) * nodeRadius;
      const ny = Math.sin(nAngle) * nodeRadius;
      const nPulse = 0.6 + Math.sin(time / 200 + n * 1.5) * 0.3;

      ctx.fillStyle = `rgba(${glowColorRgba}, ${nPulse})`;
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isUltimate) {
      // 궁극 외곽 실드 링
      ctx.strokeStyle = `rgba(${glowColorRgba}, 0.4)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, shieldRadius * 0.96 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Defense Zone — SOVEREIGNTY (SECURITY) 카테고리
 * v37 Phase 4: 방어 구역 설치물 (그린 보안 필드)
 * - 보안 구역 표시 (그린 맥동 그라데이션)
 * - 방어 노드 (육각 실드 + 맥동 글로우)
 * - 감시 스캔 동심원 (보안 레이더 패턴)
 * - 바리케이드 라인 (방어선 텍스처)
 * - 진화: 실드 연결 아크 + 추가 방어 노드 + SECURED 라벨
 */
export function drawPool(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const zoneRadius = (p.radius || 60) * 1.3;

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // SOVEREIGNTY 컬러 팔레트 (그린 계열 — 방어/안보)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#86EFAC' : '#22C55E');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '134, 239, 172' : '34, 197, 94');
  const deepGreen = isUltimate ? '250, 204, 21' : '20, 83, 45'; // 깊은 그린 보조색

  // LOD 체크 (한 번만)
  const useGlow = shouldUseGlow();

  ctx.save();

  // 맥동 펄스 (방어 구역 호흡 효과)
  const defensePulse = 1 + Math.sin(time / 350) * 0.07;
  const shieldFlicker = Math.sin(time / 200) * 0.5 + 0.5; // 0~1 실드 깜빡임

  // ===== 1. 보안 구역 배경 (그린 에너지 그라데이션) =====
  if (useGlow) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, zoneRadius * defensePulse);
    gradient.addColorStop(0, `rgba(${glowColorRgba}, ${0.3 + shieldFlicker * 0.08})`);
    gradient.addColorStop(0.4, `rgba(${glowColorRgba}, 0.18)`);
    gradient.addColorStop(0.7, `rgba(${deepGreen}, 0.1)`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.2)`;
  }
  ctx.beginPath();
  ctx.arc(0, 0, zoneRadius * defensePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 2. 방어 구역 경계선 (이중 링 + 보안 대시) =====
  // 외곽 실선 (방어선 경계)
  ctx.strokeStyle = `rgba(${glowColorRgba}, ${0.55 + shieldFlicker * 0.2})`;
  ctx.lineWidth = isUltimate ? 4 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, zoneRadius * defensePulse * 0.95, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 보안 대시 링 (회전)
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.45)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = time / 55;
  ctx.beginPath();
  ctx.arc(0, 0, zoneRadius * defensePulse * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // ===== 3. 감시 스캔 동심원 (보안 레이더 패턴) =====
  const scanCount = isUltimate ? 4 : 3;
  for (let r = 0; r < scanCount; r++) {
    const scanPhase = ((time / 650 + r * 0.33) % 1);
    const scanRadius = zoneRadius * 0.2 + scanPhase * zoneRadius * 0.7;
    const scanAlpha = (1 - scanPhase) * 0.35;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${scanAlpha})`;
    ctx.lineWidth = 2 * (1 - scanPhase);
    ctx.beginPath();
    ctx.arc(0, 0, scanRadius * defensePulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 4. 바리케이드 라인 (방어선 텍스처) =====
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, zoneRadius * defensePulse * 0.9, 0, Math.PI * 2);
  ctx.clip();

  const barricadeCount = isUltimate ? 8 : (isEvolved ? 6 : 5);
  for (let c = 0; c < barricadeCount; c++) {
    const bAngle = (c / barricadeCount) * Math.PI * 2 + 0.3;
    const bLen = zoneRadius * (0.3 + Math.sin(time / 800 + c * 2) * 0.08);
    const bx1 = Math.cos(bAngle) * 12;
    const by1 = Math.sin(bAngle) * 12;
    const bx2 = Math.cos(bAngle + 0.12) * bLen;
    const by2 = Math.sin(bAngle + 0.12) * bLen;

    ctx.strokeStyle = `rgba(${glowColorRgba}, 0.2)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    // 철조망 패턴 (지그재그)
    const midX = (bx1 + bx2) / 2 + Math.sin(bAngle * 3) * 6;
    const midY = (by1 + by2) / 2 + Math.cos(bAngle * 3) * 6;
    ctx.lineTo(midX, midY);
    ctx.lineTo(bx2, by2);
    ctx.stroke();

    // 작은 방어 마크 (십자 형태)
    ctx.strokeStyle = `rgba(${glowColorRgba}, 0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX - 3, midY);
    ctx.lineTo(midX + 3, midY);
    ctx.moveTo(midX, midY - 3);
    ctx.lineTo(midX, midY + 3);
    ctx.stroke();
  }
  ctx.restore();

  // ===== 5. 방어 노드 (육각 실드 + 맥동 글로우) =====
  const nodeCount = isUltimate ? 7 : (isEvolved ? 5 : 4);
  const nodeOrbitRadius = zoneRadius * defensePulse * 0.6;

  for (let i = 0; i < nodeCount; i++) {
    const nodeAngle = (i * Math.PI * 2 / nodeCount) + Math.sin(time / 2000) * 0.1;
    const nodeRadialOffset = nodeOrbitRadius * (0.5 + (i % 3) * 0.25);
    const nx = Math.cos(nodeAngle) * nodeRadialOffset;
    const ny = Math.sin(nodeAngle) * nodeRadialOffset;

    // 개별 노드 맥동 (시차 적용)
    const nodePulse = 0.8 + Math.sin(time / 250 + i * 1.7) * 0.2;
    const nodeSize = (isUltimate ? 9 : 7) * nodePulse;

    ctx.save();
    ctx.translate(nx, ny);

    // 노드 맥동 글로우
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 7 + shieldFlicker * 5;
    }

    // 방어 노드 본체 (육각형 — 실드 유닛)
    ctx.fillStyle = `rgba(${glowColorRgba}, ${0.65 + shieldFlicker * 0.15})`;
    ctx.beginPath();
    for (let h = 0; h < 6; h++) {
      const hAngle = (h / 6) * Math.PI * 2 - Math.PI / 6;
      const hx = Math.cos(hAngle) * nodeSize;
      const hy = Math.sin(hAngle) * nodeSize;
      if (h === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();

    // 노드 내부 코어 (어두운 중심)
    ctx.fillStyle = '#052e16';
    ctx.beginPath();
    ctx.arc(0, 0, nodeSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 실드 표시 (맥동하는 점)
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, nodeSize * 0.25 * nodePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // ===== 6. 중앙 보안 표시 (실드 엠블렘) =====
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
  }

  // 방패 형태 엠블렘
  const shieldSize = isUltimate ? 16 : 13;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(0, -shieldSize);
  ctx.lineTo(shieldSize * 0.85, -shieldSize * 0.2);
  ctx.lineTo(shieldSize * 0.7, shieldSize * 0.5);
  ctx.lineTo(0, shieldSize * 0.8);
  ctx.lineTo(-shieldSize * 0.7, shieldSize * 0.5);
  ctx.lineTo(-shieldSize * 0.85, -shieldSize * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // 방패 내부 (어두운 색)
  const innerShield = shieldSize * 0.6;
  ctx.fillStyle = '#052e16';
  ctx.beginPath();
  ctx.moveTo(0, -innerShield + 2);
  ctx.lineTo(innerShield * 0.85, -innerShield * 0.2 + 2);
  ctx.lineTo(innerShield * 0.7, innerShield * 0.5 + 2);
  ctx.lineTo(0, innerShield * 0.8 + 2);
  ctx.lineTo(-innerShield * 0.7, innerShield * 0.5 + 2);
  ctx.lineTo(-innerShield * 0.85, -innerShield * 0.2 + 2);
  ctx.closePath();
  ctx.fill();

  // 체크마크 (보안 확인 심볼)
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 1);
  ctx.lineTo(-1, 4);
  ctx.lineTo(5, -3);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // ===== 7. 보안 감지 펄스 웨이브 =====
  const waveCount = isUltimate ? 2 : 1;
  for (let w = 0; w < waveCount; w++) {
    const waveProgress = ((time / 750 + w * 0.5) % 1);
    const waveRadius = 15 + waveProgress * (zoneRadius * 0.85 - 15);
    const waveAlpha = (1 - waveProgress) * 0.45;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${waveAlpha})`;
    ctx.lineWidth = 2.5 * (1 - waveProgress);
    ctx.beginPath();
    ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 8. 진화/궁극 추가 효과 =====
  if (isEvolved || isUltimate) {
    // 실드 연결 아크 (방어 노드 간 — 보안 네트워크)
    const arcCount = isUltimate ? 5 : 3;
    for (let a = 0; a < arcCount; a++) {
      const a1 = (a / nodeCount) * Math.PI * 2 + Math.sin(time / 2000) * 0.1;
      const a2 = ((a + 1) / nodeCount) * Math.PI * 2 + Math.sin(time / 2000) * 0.1;
      const r1 = nodeOrbitRadius * (0.5 + (a % 3) * 0.25);
      const r2 = nodeOrbitRadius * (0.5 + ((a + 1) % 3) * 0.25);

      const x1 = Math.cos(a1) * r1;
      const y1 = Math.sin(a1) * r1;
      const x2 = Math.cos(a2) * r2;
      const y2 = Math.sin(a2) * r2;

      // 에너지 연결선 (안정적인 곡선)
      const arcAlpha = 0.25 + Math.sin(time / 120 + a * 2) * 0.2;
      ctx.strokeStyle = `rgba(${glowColorRgba}, ${arcAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);

      // 부드러운 베지어 곡선 (번개 대신 안정적 링크)
      const cpx = (x1 + x2) / 2 + Math.sin(time / 500 + a) * 8;
      const cpy = (y1 + y2) / 2 + Math.cos(time / 500 + a) * 8;
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.stroke();
    }

    // 외곽 방어 마커 (실드 심볼 회전)
    const markerCount = isUltimate ? 6 : 4;
    const markerRadius = zoneRadius * 0.88 * defensePulse;

    for (let m = 0; m < markerCount; m++) {
      const mAngle = (time / 1500 + m * Math.PI * 2 / markerCount) % (Math.PI * 2);
      const markerX = Math.cos(mAngle) * markerRadius;
      const markerY = Math.sin(mAngle) * markerRadius;
      const mAlpha = 0.55 + Math.sin(time / 150 + m * 1.3) * 0.2;

      ctx.save();
      ctx.translate(markerX, markerY);

      // 작은 실드 마커 (다이아몬드 형태)
      ctx.fillStyle = `rgba(${glowColorRgba}, ${mAlpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    if (isUltimate) {
      // SECURED 라벨
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = mainColor;
      ctx.fillText('SECURED', 0, zoneRadius * 0.45);
    }
  }

  ctx.restore();
}
