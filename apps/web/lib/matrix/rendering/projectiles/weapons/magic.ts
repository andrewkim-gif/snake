/**
 * game/rendering/projectiles/weapons/magic.ts - 마법/영역 무기 렌더링
 * v4.9: 스타일리시 이펙트 시스템 - 이징, 글로우, 펄스, 파티클
 * v4.9.1: LOD-aware shadowBlur 최적화
 * v7.20: 성능 최적화 - easing 통합 모듈 사용, gradient→solid 변환, time 파라미터화
 *
 * API Call (wand), Documentation (bible), Debug Aura (garlic), Firewall Zone (pool)
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
 * API Call - JSON/REST 리퀘스트 발사체
 * v4.9: 이징 바운스 + 데이터 스트림 트레일 + JSON 파티클
 * v7.15: 성능 최적화 - LOD 기반 이펙트 감소, shadowBlur 최소화
 */
export function drawWand(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const bounceBonus = 1 + (p.bounceCount || 0) * 0.5;

  // v7.15: LOD 체크 (한 번만)
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle); // v7.20: 아이소메트릭 3D 원근감

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // REST API 팔레트 (블루 테마)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#22d3ee' : '#3b82f6');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '34, 211, 238' : '59, 130, 246');
  const methodColors = {
    GET: '#22c55e',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
    PATCH: '#a855f7'
  };

  // 크기 with 탄성 등장
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const appearProgress = Math.max(0, Math.min(1, (1 - lifeRatio) * 4));
  const bounceScale = Math.max(0.1, EASING.easeOutBack(appearProgress)); // v7.20: 공통 모듈
  const packetSize = Math.max(8, Math.max(14, (p.radius || 6) * 3) * bounceBonus * bounceScale);

  // ===== JSON 데이터 스트림 트레일 (최적화: 개수 감소, shadowBlur 조건부) =====
  const jsonChars = ['{', '"data":', '[', '}', '"status":'];
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3); // 10/8/6 → 5/4/3

  for (let i = trailCount; i >= 1; i--) {
    const trailEase = EASING.easeOutExpo(1 - i / trailCount); // v7.20: 공통 모듈
    const offsetX = -i * 12 * trailEase;
    const waveY = Math.sin(time / 60 + i * 0.8) * 4;
    // v7.34: 알파값 증가 (0.6 → 0.85) - 더 선명한 트레일
    const alpha = 0.85 * (1 - i / trailCount);
    const fontSize = Math.max(6, 9 - i * 0.6);

    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.fillText(jsonChars[i % jsonChars.length], offsetX, waveY);
  }

  // ===== 펄스 링 (1개로 축소) =====
  // v7.34: 알파값 증가 (0.3 → 0.5) - 더 선명한 펄스
  const pulsePhase = (time / 160) % 1;
  const ringRadius = packetSize * 0.8 + pulsePhase * 12;
  const ringAlpha = (1 - pulsePhase) * 0.5;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${ringAlpha})`;
  ctx.lineWidth = 2.5 * (1 - pulsePhase);
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 메인 API 패킷 (글로우 레이어 조건부) =====
  // v7.34: 글로우 알파 증가 (0.3 → 0.5), shadowBlur 증가 (12 → 16)
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5 * bounceScale;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-packetSize / 2 * 1.2, -packetSize / 2 * 1.2,
                  packetSize * 1.2, packetSize * 1.2, 6);
    ctx.fill();
    ctx.restore();
  }

  // 패킷 배경 (단색으로 단순화)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-packetSize / 2, -packetSize / 2, packetSize, packetSize, 5);
  ctx.fill();

  // 테두리 (글로우 조건부)
  // v7.34: shadowBlur 증가 (8 → 12), lineWidth 증가 (2.5 → 3)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== HTTP 메서드 뱃지 =====
  const methods = isUltimate ? ['DELETE', 'PUT'] : (isEvolved ? ['POST', 'GET'] : ['GET']);
  const currentMethod = methods[Math.floor(time / 400) % methods.length];
  const methodColor = methodColors[currentMethod as keyof typeof methodColors] || '#3b82f6';

  ctx.fillStyle = methodColor;
  ctx.beginPath();
  ctx.roundRect(-packetSize / 2 + 2, -packetSize / 2 + 2, packetSize - 4, 10, 3);
  ctx.fill();

  ctx.font = 'bold 6px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(currentMethod, 0, -packetSize / 2 + 9);

  // ===== JSON 데이터 표시 (간소화) =====
  const jsonLines = isUltimate ? ['"status": 200', '"ok": true'] : ['"data": {...}'];

  ctx.font = '4px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';

  jsonLines.forEach((line, idx) => {
    ctx.fillText(line.substring(0, 12), -packetSize / 2 + 4, -packetSize / 2 + 18 + idx * 6);
  });

  // ===== 전송 인디케이터 (간소화) =====
  // v7.34: 알파값 범위 증가 (0.6-1.0 → 0.7-1.0), 크기 증가 (3 → 4)
  const pulse = Math.sin(time / 100) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(${glowColorRgba}, ${pulse})`;
  ctx.beginPath();
  ctx.arc(packetSize / 2 - 4, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // ===== 속도선 (2개로 축소) =====
  // v7.34: 알파값 증가 (0.5 → 0.7), lineWidth 증가 (2 → 2.5)
  for (let s = 0; s < 2; s++) {
    const flowProgress = ((time / 100) + s * 0.5) % 1;
    const sY = (s - 0.5) * 8;
    const sAlpha = Math.sin(flowProgress * Math.PI) * 0.7;

    ctx.strokeStyle = `rgba(${glowColorRgba}, ${sAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-packetSize - 5 - flowProgress * 15, sY);
    ctx.lineTo(-packetSize - 5 - flowProgress * 15 - 8, sY);
    ctx.stroke();
  }

  // ===== 진화/궁극 추가 이펙트 (최적화) =====
  // v7.34: 파티클 알파 증가, 크기 증가
  if (isEvolved || isUltimate) {
    // 데이터 오비탈 파티클 (개수 감소, shadowBlur 제거)
    const orbitalCount = isUltimate ? 5 : 4; // v7.34: 개수 복원 (4/3 → 5/4)
    for (let d = 0; d < orbitalCount; d++) {
      const dAngle = (time / 250 + d * Math.PI * 2 / orbitalCount) % (Math.PI * 2);
      const dDist = packetSize * 0.8 + 8; // v7.34: 거리 증가 (6 → 8)
      const dPulse = Math.sin(time / 120 + d) * 0.15 + 0.9; // v7.34: 알파 증가 (0.8 → 0.9)

      ctx.font = 'bold 8px monospace'; // v7.34: bold 추가, 크기 증가 (7 → 8)
      ctx.fillStyle = `rgba(${glowColorRgba}, ${dPulse})`;
      ctx.textAlign = 'center';
      const dataChars = ['0', '1', '{', '}'];
      ctx.fillText(dataChars[d % dataChars.length],
                   Math.cos(dAngle) * dDist,
                   Math.sin(dAngle) * dDist);
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-p.angle);
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#22c55e';

      const statusY = -packetSize - 6;
      ctx.strokeText('200 OK', 0, statusY);
      ctx.fillText('200 OK', 0, statusY);
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
 * Firewall Zone - 네트워크 보안 영역
 * v7.30: 궤도 도는 보안 노드 + 스캔 라인 + 이중 회전 링
 * v7.36: 그림자 추가 - 공중에 떠있는 듯한 연출
 * v7.39: 아이소메트릭 Y축 압축 제거 - 인게임은 toIsoScreen에서 이미 변환됨
 * - 기본 상태에서도 역동적인 궤도 요소
 * - 보안 스캐너 스캔 라인 효과
 * - 반대 방향 회전 대시 링 2개
 */
export function drawPool(params: MagicWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const poolRadius = (p.radius || 60) * 1.3;

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // 사이버 보안 테마 컬러
  const mainColor = isUltimate ? '#ef4444' : (isEvolved ? '#f97316' : '#06b6d4');
  const glowColorRgba = isUltimate ? '239, 68, 68' : (isEvolved ? '249, 115, 22' : '6, 182, 212');

  // LOD 체크 (한 번만)
  const useGlow = shouldUseGlow();

  ctx.save();

  // Note: 인게임에서는 toIsoScreen()이 이미 아이소메트릭 변환을 적용함
  // Collection 미리보기에서만 별도로 scale 적용 필요

  // 간단한 펄스 (sin 기반)
  const pulse = 1 + Math.sin(time / 500) * 0.05;

  // ===== 1. 영역 배경 =====
  // v7.34: 배경 알파 증가 - 더 선명한 영역 표시
  if (useGlow) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, poolRadius * pulse);
    gradient.addColorStop(0, `rgba(${glowColorRgba}, 0.4)`);
    gradient.addColorStop(0.6, `rgba(${glowColorRgba}, 0.2)`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.25)`;
  }
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * pulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 2. 외곽 테두리 링 =====
  // v7.34: 알파 증가 (0.6 → 0.8), lineWidth 증가
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.8)`;
  ctx.lineWidth = isUltimate ? 4 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * pulse * 0.95, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 3. 스캔 라인 효과 (보안 스캐너) =====
  // v7.34: 스캔 알파 증가 (0.4 → 0.6)
  const scanY = Math.sin(time / 400) * poolRadius * 0.7;
  const scanAlpha = 0.6 + Math.sin(time / 200) * 0.15;

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * pulse * 0.9, 0, Math.PI * 2);
  ctx.clip();

  // 스캔 라인
  ctx.strokeStyle = `rgba(${glowColorRgba}, ${scanAlpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-poolRadius, scanY);
  ctx.lineTo(poolRadius, scanY);
  ctx.stroke();

  // 스캔 글로우 (작은 원) - v7.34: 알파 증가 (0.3 → 0.5), 크기 증가
  if (useGlow) {
    ctx.fillStyle = `rgba(${glowColorRgba}, 0.5)`;
    ctx.beginPath();
    ctx.arc(0, scanY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ===== 4. 이중 회전 대시 링 (반대 방향) =====
  // v7.34: 알파 증가 (0.35 → 0.55), lineWidth 증가
  // 외부 링 (시계 방향)
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.55)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = time / 60;
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * pulse * 0.8, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 링 (반시계 방향)
  ctx.lineDashOffset = -time / 80;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, poolRadius * pulse * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // ===== 5. 궤도 도는 보안 노드 (기본 상태에서도 3개) =====
  // v7.34: 노드 크기 증가, shadowBlur 증가
  const baseNodeCount = isUltimate ? 6 : (isEvolved ? 5 : 4);
  const orbitRadius = poolRadius * pulse * 0.68;

  for (let i = 0; i < baseNodeCount; i++) {
    // 각 노드 다른 속도로 회전
    const speedMod = 1 + (i * 0.15);
    const nodeAngle = (time / (1200 / speedMod)) + (i * Math.PI * 2 / baseNodeCount);
    const nx = Math.cos(nodeAngle) * orbitRadius;
    const ny = Math.sin(nodeAngle) * orbitRadius;

    // 노드 글로우 - v7.34: shadowBlur 증가 (6 → 10)
    if (useGlow) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 10;
    }

    // 작은 방패/잠금 아이콘
    ctx.save();
    ctx.translate(nx, ny);

    // 노드 배경 - v7.34: 크기 증가 (6/5 → 8/7)
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, isUltimate ? 8 : 7, 0, Math.PI * 2);
    ctx.fill();

    // 노드 내부 심볼 - v7.34: 크기 증가 (3.5/3 → 5/4)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, isUltimate ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();

    // 잠금 심볼 (작은 원) - v7.34: 크기 증가
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0.5, 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // ===== 6. 중앙 아이콘 (방패 심볼) =====
  // v7.34: shadowBlur 증가 (10 → 15)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 15;
  }

  // 방패 외곽
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, -6);
  ctx.lineTo(10, 4);
  ctx.quadraticCurveTo(10, 12, 0, 16);
  ctx.quadraticCurveTo(-10, 12, -10, 4);
  ctx.lineTo(-10, -6);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  // 방패 내부 (어두운 색)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, -4);
  ctx.lineTo(6, 2);
  ctx.quadraticCurveTo(6, 8, 0, 11);
  ctx.quadraticCurveTo(-6, 8, -6, 2);
  ctx.lineTo(-6, -4);
  ctx.closePath();
  ctx.fill();

  // 체크마크 또는 잠금 심볼
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (isUltimate) {
    // 체크마크
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-1, 5);
    ctx.lineTo(4, -2);
    ctx.stroke();
  } else {
    // 간단한 잠금
    ctx.beginPath();
    ctx.arc(0, 2, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -1, 2, Math.PI, 0);
    ctx.stroke();
  }

  // ===== 7. 펄스 웨이브 =====
  // v7.34: 펄스 웨이브 알파 증가 (0.35 → 0.55)
  const waveProgress = (time / 800) % 1;
  const waveRadius = 20 + waveProgress * (poolRadius * 0.9 - 20);
  const waveAlpha = (1 - waveProgress) * 0.55;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${waveAlpha})`;
  ctx.lineWidth = 2.5 * (1 - waveProgress);
  ctx.beginPath();
  ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 8. 진화/궁극 추가 효과 =====
  // v7.34: 파티클 알파 증가 (0.5 → 0.7), 개수 증가
  if (isEvolved || isUltimate) {
    // 외곽 데이터 패킷 (빠르게 공전)
    const packetCount = isUltimate ? 10 : 7;
    const packetRadius = poolRadius * 0.9 * pulse;
    const packetChars = ['{', '}', '0', '1', '<', '>', '/', '*'];

    for (let i = 0; i < packetCount; i++) {
      const pAngle = (time / 300) + (i * Math.PI * 2 / packetCount);
      const px = Math.cos(pAngle) * packetRadius;
      const py = Math.sin(pAngle) * packetRadius;
      const pAlpha = 0.7 + Math.sin(time / 150 + i) * 0.2;

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = `rgba(${glowColorRgba}, ${pAlpha})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(packetChars[i % packetChars.length], px, py);
    }

    if (isUltimate) {
      // FIREWALL 라벨
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = mainColor;
      ctx.fillText('FIREWALL', 0, poolRadius * 0.45);
    }
  }

  ctx.restore();
}
