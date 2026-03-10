/**
 * game/rendering/projectiles/weapons/magic.ts - 마법/영역 무기 렌더링
 * v37: 카테고리 테마 리디자인
 *   - wand (에너지 볼트 / Plasma Bolt): TERRITORY 블루 — 영역 확장 펄스
 *   - bible (가디언 위성): SOVEREIGNTY 그린 — 궤도 도는 구체 (기존 유지)
 *   - garlic (방어 필드): SOVEREIGNTY 그린 — 오로라 에너지 영역 (기존 유지)
 *   - pool (지뢰밭 / Minefield): TERRITORY 블루 → 영역 설치물 (맥동하는 위험 구역)
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
export function drawBible(params: MagicWeaponParams): void {
  const { ctx, p, playerPos, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const dx = p.position.x - playerPos.x;
  const dy = p.position.y - playerPos.y;
  const orbitAngle = Math.atan2(dy, dx);

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // v7.15: LOD 체크 (한 번만)
  const useGlow = shouldUseGlow();

  // VS Code 테마 팔레트
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#a78bfa' : '#10b981');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '167, 139, 250' : '16, 185, 129');

  ctx.save();

  // 궤도 회전 with 이징 (매우 느리게)
  const spinProgress = (time / 3000) % 1;
  const spinEase = EASING.easeInOutCubic(spinProgress);
  const editorSpin = spinEase * Math.PI * 2;

  // v7.30: 아이소메트릭 변환 적용
  // 순서: 궤도각도 회전 → 아이소메트릭 Y압축 → 에디터 자체 스핀
  ctx.rotate(orbitAngle);
  ctx.scale(1, 0.6); // 아이소메트릭 Y 압축 (0.5보다 약간 완화)
  ctx.rotate(Math.PI / 2 + editorSpin);

  // 에디터 사이즈 (압축 보상으로 높이 증가)
  const editorW = 28;
  const editorH = 42; // 36 → 42 (압축 보상)

  // ===== 코드 에디터 윈도우 =====
  // v7.34: 글로우 알파 증가 (0.3 → 0.5), shadowBlur 증가 (10 → 14)
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-editorW / 2 * 1.1, -editorH / 2 * 1.1,
                  editorW * 1.1, editorH * 1.1, 4);
    ctx.fill();
    ctx.restore();
  }

  // 에디터 배경 (단색으로 단순화)
  ctx.fillStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.roundRect(-editorW / 2, -editorH / 2, editorW, editorH, 4);
  ctx.fill();

  // 테두리 (글로우 조건부)
  // v7.34: shadowBlur 증가 (8 → 12), lineWidth 증가 (2 → 2.5)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 타이틀 바 =====
  ctx.fillStyle = '#313244';
  ctx.fillRect(-editorW / 2 + 1, -editorH / 2 + 1, editorW - 2, 8);

  // 윈도우 버튼들 (애니메이션 단순화)
  const buttons = [
    { color: '#f38ba8', x: -editorW / 2 + 5 },
    { color: '#f9e2af', x: -editorW / 2 + 10 },
    { color: '#a6e3a1', x: -editorW / 2 + 15 },
  ];

  buttons.forEach((btn) => {
    ctx.fillStyle = btn.color;
    ctx.beginPath();
    ctx.arc(btn.x, -editorH / 2 + 5, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // ===== 코드 라인들 (타이핑 효과 단순화) =====
  const codeLines = isUltimate
    ? ['/**', ' * @api', ' * @param', ' */']
    : (isEvolved ? ['import {', '  API', '} from'] : ['// doc', 'fn()']);

  // 신택스 하이라이팅 색상
  const syntaxColors = {
    comment: '#6c7086',
    keyword: '#cba6f7',
    function: '#89b4fa',
    default: '#cdd6f4'
  };

  const lineHeight = 5;
  const startY = -editorH / 2 + 14;

  codeLines.forEach((line, idx) => {
    const lineY = startY + idx * lineHeight;

    // 라인 넘버
    ctx.font = '4px monospace';
    ctx.fillStyle = '#6c7086';
    ctx.textAlign = 'right';
    ctx.fillText(String(idx + 1), -editorW / 2 + 7, lineY);

    // 코드 텍스트 (신택스 하이라이팅)
    ctx.textAlign = 'left';
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith(' *')) {
      ctx.fillStyle = syntaxColors.comment;
    } else if (line.includes('import') || line.includes('export')) {
      ctx.fillStyle = syntaxColors.keyword;
    } else if (line.includes('fn') || line.includes('()')) {
      ctx.fillStyle = syntaxColors.function;
    } else {
      ctx.fillStyle = syntaxColors.default;
    }
    ctx.fillText(line.substring(0, 7), -editorW / 2 + 9, lineY);
  });

  // ===== 커서 깜빡임 (shadowBlur 제거) =====
  if (Math.sin(time / 150) > 0) {
    const cursorLine = Math.floor((time / 300) % codeLines.length);
    const cursorX = -editorW / 2 + 9 + Math.min(codeLines[cursorLine].length, 7) * 2.5;
    const cursorY = startY + cursorLine * lineHeight - 3;

    ctx.fillStyle = mainColor;
    ctx.fillRect(cursorX, cursorY, 1, 5);
  }

  // ===== 스크롤바 (shadowBlur 제거) =====
  ctx.fillStyle = '#45475a';
  ctx.fillRect(editorW / 2 - 3, -editorH / 2 + 10, 2, editorH - 12);

  const scrollProgress = (time / 2000) % 1;
  ctx.fillStyle = mainColor;
  ctx.fillRect(editorW / 2 - 3, -editorH / 2 + 10 + scrollProgress * (editorH - 20), 2, 6);

  // ===== 진화/궁극 추가 이펙트 (최적화) =====
  // v7.34: 파티클 알파 증가, 크기 증가
  if (isEvolved || isUltimate) {
    // v7.34: 심볼 개수 복원 (4/3 → 5/4), 알파 증가
    const symbolCount = isUltimate ? 5 : 4;
    const symbols = isUltimate ? ['@', '#', '$', '%', '&'] : ['{', '}', '()', '[]'];

    for (let c = 0; c < symbolCount; c++) {
      const cAngle = (time / 400 + c * Math.PI * 2 / symbolCount) % (Math.PI * 2);
      const cDist = Math.max(editorW, editorH) / 2 + 10; // v7.34: 거리 증가 (8 → 10)
      const cPulse = Math.sin(time / 150 + c) * 0.15 + 0.85; // v7.34: 알파 증가 (0.7 → 0.85)

      ctx.font = 'bold 9px monospace'; // v7.34: 크기 증가 (8 → 9)
      ctx.fillStyle = `rgba(${glowColorRgba}, ${cPulse})`;
      ctx.textAlign = 'center';
      ctx.fillText(symbols[c], Math.cos(cAngle) * cDist, Math.sin(cAngle) * cDist);
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-orbitAngle - Math.PI / 2 - editorSpin);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.fillText('README.md', 0, -editorH / 2 - 10);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Debug Aura - 오로라 에너지 영역
 * v7.37: 오로라 효과 - 아이콘 제거, 순수한 에너지장 표현
 * v7.39: 아이소메트릭 Y축 압축 제거 - 인게임은 toIsoScreen에서 이미 변환됨
 * - 물결치는 다층 링
 * - 회전하는 광선 빔
 * - 부드러운 색상 변화
 */
export function drawGarlic(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const garlicRadius = p.radius || 60;

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  const useGlow = shouldUseGlow();

  // 오로라 테마 컬러 (초록/시안/골드)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#22d3ee' : '#84cc16');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '34, 211, 238' : '132, 204, 22');

  // 보조 색상 (오로라 색상 변화용)
  const secondaryRgba = isUltimate ? '239, 68, 68' : (isEvolved ? '167, 139, 250' : '34, 211, 238');

  ctx.save();

  // Note: 인게임에서는 toIsoScreen()이 이미 아이소메트릭 변환을 적용함
  // Collection 미리보기에서만 별도로 scale 적용 필요

  // 기본 펄스
  const pulse = 1 + Math.sin(time / 400) * 0.08;

  // ===== 1. 기본 영역 배경 (부드러운 그라데이션) =====
  // v7.34: 알파값 증가 - 더 선명한 영역 표시
  if (useGlow) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, garlicRadius * pulse);
    gradient.addColorStop(0, `rgba(${glowColorRgba}, 0.35)`);
    gradient.addColorStop(0.5, `rgba(${glowColorRgba}, 0.18)`);
    gradient.addColorStop(0.8, `rgba(${secondaryRgba}, 0.08)`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.18)`;
  }
  ctx.beginPath();
  ctx.arc(0, 0, garlicRadius * pulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 2. 오로라 광선 빔 (회전하는 부채꼴) =====
  // v7.34: 빔 알파 증가 (0.15 → 0.25)
  const beamCount = isUltimate ? 6 : (isEvolved ? 5 : 4);
  const beamWidth = Math.PI / (isUltimate ? 8 : 10); // 빔 폭

  for (let i = 0; i < beamCount; i++) {
    const beamAngle = (time / 2000) + (i * Math.PI * 2 / beamCount);
    const beamAlpha = 0.25 + Math.sin(time / 300 + i * 1.5) * 0.1;

    // 색상 교차 (주/보조 색상 번갈아)
    const useSecondary = i % 2 === 0;
    const beamRgba = useSecondary ? secondaryRgba : glowColorRgba;

    ctx.save();
    ctx.rotate(beamAngle);

    // 부채꼴 빔
    if (useGlow) {
      const beamGradient = ctx.createRadialGradient(0, 0, garlicRadius * 0.1, 0, 0, garlicRadius * 0.9);
      beamGradient.addColorStop(0, `rgba(${beamRgba}, ${beamAlpha * 0.5})`);
      beamGradient.addColorStop(0.5, `rgba(${beamRgba}, ${beamAlpha})`);
      beamGradient.addColorStop(1, `rgba(${beamRgba}, 0)`);
      ctx.fillStyle = beamGradient;
    } else {
      ctx.fillStyle = `rgba(${beamRgba}, ${beamAlpha * 0.7})`;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, garlicRadius * 0.85 * pulse, -beamWidth, beamWidth);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ===== 3. 물결치는 동심원 (3개 층) =====
  // v7.34: 링 알파 증가 (0.25 → 0.4)
  const ringCount = isUltimate ? 4 : 3;
  for (let r = 0; r < ringCount; r++) {
    // 각 링마다 다른 위상으로 물결
    const wavePhase = time / 500 + r * Math.PI * 0.7;
    const baseRadius = garlicRadius * (0.3 + r * 0.2);
    const waveAmp = garlicRadius * 0.05;
    const ringRadius = baseRadius + Math.sin(wavePhase) * waveAmp;
    const ringAlpha = 0.4 - r * 0.08;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
    ctx.lineWidth = 2.5 - r * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 4. 회전 대시 링 (외곽) =====
  // v7.34: 알파 증가 (0.3 → 0.5), lineWidth 증가 (1.5 → 2)
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.5)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 12]);
  ctx.lineDashOffset = time / 50;
  ctx.beginPath();
  ctx.arc(0, 0, garlicRadius * 0.9 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // ===== 5. 떠다니는 에너지 파티클 =====
  // v7.34: 파티클 알파 증가 (0.4 → 0.6), 크기 증가
  const particleCount = isUltimate ? 8 : (isEvolved ? 6 : 4);
  for (let i = 0; i < particleCount; i++) {
    // 나선형 움직임
    const spiralAngle = (time / 1500) + (i * Math.PI * 2 / particleCount);
    const spiralRadius = garlicRadius * (0.3 + Math.sin(time / 800 + i) * 0.2);
    const px = Math.cos(spiralAngle) * spiralRadius * pulse;
    const py = Math.sin(spiralAngle) * spiralRadius * pulse;
    const pAlpha = 0.6 + Math.sin(time / 250 + i * 2) * 0.2;
    const pSize = 4 + Math.sin(time / 200 + i) * 2;

    // 파티클 색상 교차
    const pRgba = i % 2 === 0 ? glowColorRgba : secondaryRgba;

    ctx.fillStyle = `rgba(${pRgba}, ${pAlpha})`;
    ctx.beginPath();
    ctx.arc(px, py, pSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 6. 중앙 에너지 코어 (작은 글로우 점) =====
  // v7.34: 코어 알파 증가 (0.6 → 0.8), 크기 증가
  const corePulse = 1 + Math.sin(time / 200) * 0.3;
  const coreSize = 8 * corePulse;

  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = `rgba(${glowColorRgba}, 0.8)`;
  ctx.beginPath();
  ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 코어 내부 밝은 점 - v7.34: 알파 증가 (0.5 → 0.7)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + Math.sin(time / 150) * 0.25})`;
  ctx.beginPath();
  ctx.arc(0, 0, coreSize * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // ===== 7. 펄스 웨이브 (퍼져나가는 링) =====
  // v7.34: 펄스 웨이브 알파 증가 (0.35 → 0.55)
  const waveProgress = (time / 800) % 1;
  const waveRadius = coreSize + waveProgress * (garlicRadius * 0.95 - coreSize);
  const waveAlpha = (1 - waveProgress) * 0.55;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${waveAlpha})`;
  ctx.lineWidth = 3 * (1 - waveProgress);
  ctx.beginPath();
  ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 8. 진화/궁극 추가 효과 =====
  if (isEvolved || isUltimate) {
    // 추가 외곽 에너지 파동
    const outerWaveCount = isUltimate ? 3 : 2;
    for (let w = 0; w < outerWaveCount; w++) {
      const owProgress = ((time / 1000) + w * 0.33) % 1;
      const owRadius = garlicRadius * (0.6 + owProgress * 0.35) * pulse;
      const owAlpha = (1 - owProgress) * 0.2;

      ctx.strokeStyle = `rgba(${secondaryRgba}, ${owAlpha})`;
      ctx.lineWidth = 1.5 * (1 - owProgress);
      ctx.beginPath();
      ctx.arc(0, 0, owRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (isUltimate) {
      // 외곽 글로우 링
      ctx.strokeStyle = `rgba(${glowColorRgba}, 0.4)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, garlicRadius * 0.95 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Minefield — TERRITORY (DATA) 카테고리
 * v37: 지뢰밭 → 영역 설치물 (맥동하는 위험 구역)
 * - 위험 구역 표시 (레드-블루 맥동 그라데이션)
 * - 매설 지뢰 노드 (삼각형 경고 표시 + 맥동 글로우)
 * - 위험 감지 동심원 (레이더 스캔 패턴)
 * - 지표면 균열 텍스처 (매설 표시)
 * - 진화: 전기 방전 아크 + 추가 지뢰 노드
 */
export function drawPool(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const poolRadius = (p.radius || 60) * 1.3;

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // TERRITORY 컬러 팔레트 (블루 계열 — 위험 구역)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#93C5FD' : '#3B82F6');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '147, 197, 253' : '59, 130, 246');
  const dangerRgba = isUltimate ? '239, 68, 68' : '30, 58, 138'; // 위험 강조 보조색

  // LOD 체크 (한 번만)
  const useGlow = shouldUseGlow();

  ctx.save();

  // 맥동 펄스 (위험 구역 호흡 효과)
  const dangerPulse = 1 + Math.sin(time / 350) * 0.08;
  const alertPulse = Math.sin(time / 200) * 0.5 + 0.5; // 0~1 경고 깜빡임

  // ===== 1. 위험 구역 배경 (맥동 그라데이션) =====
  if (useGlow) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, poolRadius * dangerPulse);
    gradient.addColorStop(0, `rgba(${glowColorRgba}, ${0.35 + alertPulse * 0.1})`);
    gradient.addColorStop(0.4, `rgba(${glowColorRgba}, 0.2)`);
    gradient.addColorStop(0.7, `rgba(${dangerRgba}, 0.12)`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.22)`;
  }
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * dangerPulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 2. 위험 구역 경계선 (이중 링 + 경고 대시) =====
  // 외곽 실선 (굵은 경계)
  ctx.strokeStyle = `rgba(${glowColorRgba}, ${0.6 + alertPulse * 0.25})`;
  ctx.lineWidth = isUltimate ? 4 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * dangerPulse * 0.95, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 경고 대시 링 (회전)
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.5)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = time / 50;
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * dangerPulse * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // ===== 3. 레이더 스캔 동심원 (위험 감지 패턴) =====
  const scanCount = isUltimate ? 4 : 3;
  for (let r = 0; r < scanCount; r++) {
    const scanPhase = ((time / 600 + r * 0.33) % 1);
    const scanRadius = poolRadius * 0.2 + scanPhase * poolRadius * 0.7;
    const scanAlpha = (1 - scanPhase) * 0.4;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${scanAlpha})`;
    ctx.lineWidth = 2 * (1 - scanPhase);
    ctx.beginPath();
    ctx.arc(0, 0, scanRadius * dangerPulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 4. 지표면 균열 라인 (매설 표시) =====
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * dangerPulse * 0.9, 0, Math.PI * 2);
  ctx.clip();

  const crackCount = isUltimate ? 8 : (isEvolved ? 6 : 5);
  for (let c = 0; c < crackCount; c++) {
    const crackAngle = (c / crackCount) * Math.PI * 2 + 0.3;
    const crackLen = poolRadius * (0.3 + Math.sin(time / 800 + c * 2) * 0.1);
    const cx1 = Math.cos(crackAngle) * 12;
    const cy1 = Math.sin(crackAngle) * 12;
    const cx2 = Math.cos(crackAngle + 0.15) * crackLen;
    const cy2 = Math.sin(crackAngle + 0.15) * crackLen;

    ctx.strokeStyle = `rgba(${glowColorRgba}, 0.25)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    // 지그재그 균열
    const midX = (cx1 + cx2) / 2 + Math.sin(crackAngle * 3) * 8;
    const midY = (cy1 + cy2) / 2 + Math.cos(crackAngle * 3) * 8;
    ctx.lineTo(midX, midY);
    ctx.lineTo(cx2, cy2);
    ctx.stroke();
  }
  ctx.restore();

  // ===== 5. 매설 지뢰 노드 (삼각형 경고 + 맥동 글로우) =====
  const mineCount = isUltimate ? 7 : (isEvolved ? 5 : 4);
  const mineOrbitRadius = poolRadius * dangerPulse * 0.6;

  for (let i = 0; i < mineCount; i++) {
    const mineAngle = (i * Math.PI * 2 / mineCount) + Math.sin(time / 2000) * 0.1;
    const mineRadialOffset = mineOrbitRadius * (0.5 + (i % 3) * 0.25);
    const mx = Math.cos(mineAngle) * mineRadialOffset;
    const my = Math.sin(mineAngle) * mineRadialOffset;

    // 개별 지뢰 맥동 (시차 적용)
    const minePulse = 0.8 + Math.sin(time / 250 + i * 1.7) * 0.2;
    const mineSize = (isUltimate ? 9 : 7) * minePulse;

    ctx.save();
    ctx.translate(mx, my);

    // 지뢰 맥동 글로우
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8 + alertPulse * 6;
    }

    // 지뢰 본체 (육각형 — 대인지뢰 형태)
    ctx.fillStyle = `rgba(${glowColorRgba}, ${0.7 + alertPulse * 0.2})`;
    ctx.beginPath();
    for (let h = 0; h < 6; h++) {
      const hAngle = (h / 6) * Math.PI * 2 - Math.PI / 6;
      const hx = Math.cos(hAngle) * mineSize;
      const hy = Math.sin(hAngle) * mineSize;
      if (h === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();

    // 지뢰 내부 코어 (어두운 중심)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, mineSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 경고 표시 (맥동하는 점)
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, mineSize * 0.25 * minePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // ===== 6. 중앙 위험 표시 (경고 삼각형) =====
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
  }

  // 경고 삼각형 외곽
  const triSize = isUltimate ? 16 : 13;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(0, -triSize);
  ctx.lineTo(triSize * 0.87, triSize * 0.5);
  ctx.lineTo(-triSize * 0.87, triSize * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // 삼각형 내부 (어두운 색)
  const innerTri = triSize * 0.65;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, -innerTri + 2);
  ctx.lineTo(innerTri * 0.87, innerTri * 0.5 + 2);
  ctx.lineTo(-innerTri * 0.87, innerTri * 0.5 + 2);
  ctx.closePath();
  ctx.fill();

  // 느낌표 (!) 경고 심볼
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.roundRect(-1.5, -5, 3, 7, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 5, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // ===== 7. 위험 감지 펄스 웨이브 =====
  const waveCount = isUltimate ? 2 : 1;
  for (let w = 0; w < waveCount; w++) {
    const waveProgress = ((time / 700 + w * 0.5) % 1);
    const waveRadius = 15 + waveProgress * (poolRadius * 0.85 - 15);
    const waveAlpha = (1 - waveProgress) * 0.5;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${waveAlpha})`;
    ctx.lineWidth = 2.5 * (1 - waveProgress);
    ctx.beginPath();
    ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 8. 진화/궁극 추가 효과 =====
  if (isEvolved || isUltimate) {
    // 전기 방전 아크 (지뢰 간 연결 — 위험 네트워크)
    const arcCount = isUltimate ? 5 : 3;
    for (let a = 0; a < arcCount; a++) {
      const a1 = (a / mineCount) * Math.PI * 2 + Math.sin(time / 2000) * 0.1;
      const a2 = ((a + 1) / mineCount) * Math.PI * 2 + Math.sin(time / 2000) * 0.1;
      const r1 = mineOrbitRadius * (0.5 + (a % 3) * 0.25);
      const r2 = mineOrbitRadius * (0.5 + ((a + 1) % 3) * 0.25);

      const x1 = Math.cos(a1) * r1;
      const y1 = Math.sin(a1) * r1;
      const x2 = Math.cos(a2) * r2;
      const y2 = Math.sin(a2) * r2;

      // 번개 형태 지그재그 라인
      const arcAlpha = 0.3 + Math.sin(time / 80 + a * 2) * 0.3;
      ctx.strokeStyle = `rgba(${glowColorRgba}, ${arcAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);

      const segments = 3;
      for (let s = 1; s <= segments; s++) {
        const t = s / (segments + 1);
        const lx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 12;
        const ly = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 12;
        ctx.lineTo(lx, ly);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 외곽 위험 마커 (삼각형 경고 심볼 회전)
    const markerCount = isUltimate ? 6 : 4;
    const markerRadius = poolRadius * 0.88 * dangerPulse;

    for (let m = 0; m < markerCount; m++) {
      const mAngle = (time / 1500 + m * Math.PI * 2 / markerCount) % (Math.PI * 2);
      const markerX = Math.cos(mAngle) * markerRadius;
      const markerY = Math.sin(mAngle) * markerRadius;
      const mAlpha = 0.6 + Math.sin(time / 150 + m * 1.3) * 0.2;

      ctx.save();
      ctx.translate(markerX, markerY);

      // 작은 삼각형 경고 마커
      ctx.fillStyle = `rgba(${glowColorRgba}, ${mAlpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(3.5, 2);
      ctx.lineTo(-3.5, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    if (isUltimate) {
      // MINEFIELD 라벨
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = mainColor;
      ctx.fillText('MINEFIELD', 0, poolRadius * 0.45);
    }
  }

  ctx.restore();
}
