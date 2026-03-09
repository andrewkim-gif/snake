/**
 * game/rendering/projectiles/weapons/skills.ts - 신규 스킬 렌더링
 * v8.2: Skill System v2.0 - 고도화된 이펙트 (트레일, 펄스, 이징, 글로우, 바운스)
 *
 * CODE: syntax_error, compiler, debugger_skill, hotfix
 * DATA: json_bomb, csv_spray, binary, big_data
 * NETWORK: websocket, tcp_flood, dns_spoof, packet_loss, vpn_tunnel
 * SECURITY: antivirus, sandbox, zero_trust, honeypot, incident_response
 * AI: neural_net, chatgpt, deepfake, singularity_core
 *
 * 개선 패턴 (drawKnife 참고):
 * - easeOutBack 스폰 바운스
 * - 트레일 파티클 (텍스트/기호)
 * - 펄스 링 이펙트
 * - 다중 글로우 레이어
 */

import { shouldUseGlow } from '../../enemies/renderContext';
// v9.0: applyIsoProjectileTransform 제거 - GameCanvas에서 이미 ISO 처리됨
// import { applyIsoProjectileTransform } from '../../isometric';

export interface SkillWeaponParams {
  ctx: CanvasRenderingContext2D;
  p: any;
  playerPos: { x: number; y: number };
  time?: number;
}

// ===== COLOR PALETTES =====
const CATEGORY_COLORS = {
  CODE: { main: '#00FF41', glow: '0, 255, 65', accent: '#39FF14', dark: '#003300' },      // Matrix green
  DATA: { main: '#06b6d4', glow: '6, 182, 212', accent: '#22d3ee', dark: '#001a20' },     // Cyan
  NETWORK: { main: '#8b5cf6', glow: '139, 92, 246', accent: '#a78bfa', dark: '#1a0033' }, // Purple
  SECURITY: { main: '#ef4444', glow: '239, 68, 68', accent: '#f87171', dark: '#1a0000' }, // Red
  AI: { main: '#f59e0b', glow: '245, 158, 11', accent: '#fbbf24', dark: '#1a1000' },      // Amber
  SYSTEM: { main: '#ec4899', glow: '236, 72, 153', accent: '#f472b6', dark: '#1a0010' },  // Pink
};

// ===== HELPER FUNCTIONS =====
function applyGlow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  if (!shouldUseGlow()) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function clearGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

// ===== ADVANCED EASING (drawKnife 참고) =====
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// 스폰 바운스 계산 (생성 후 0.3초간)
function getSpawnBounce(p: any): number {
  const age = p.age || 0;
  const spawnDuration = 0.3;
  if (age > spawnDuration) return 1;
  const t = age / spawnDuration;
  return easeOutBack(t);
}

// 트레일 알파 계산
function getTrailAlpha(index: number, total: number): number {
  return easeOutExpo(1 - index / total) * 0.6;
}

// =========================================
// CODE CATEGORY SKILLS
// =========================================

/**
 * Syntax Error - 빨간 에러 메시지 발사체 (v8.2 고도화)
 * - 스폰 바운스 애니메이션
 * - ERROR 텍스트 트레일
 * - 펄스 링 + 글리치 효과
 */
export function drawSyntaxError(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(14, (p.radius || 8) * 1.6);
  const useGlow = shouldUseGlow();
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();

  // v9.0 DEBUG: ISO 변환 없이 단순 회전만 적용 (GameCanvas에서 이미 ISO 처리됨)
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 트레일 파티클 (ERROR 관련 키워드) =====
  const trailTexts = ['ERR', '!', '404', 'X', '?'];
  const trailCount = 4;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount);
    const trailOffset = -i * size * 0.4;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `bold ${size * 0.3}px monospace`;
    ctx.fillStyle = '#ff0000';
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 펄스 링 이펙트 =====
  if (useGlow) {
    const pulsePhase = (time / 180) % 1;
    const pulseRadius = size * (0.8 + pulsePhase * 0.5);
    const pulseAlpha = (1 - pulsePhase) * 0.5;

    ctx.strokeStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 글로우 레이어 (여러 겹) =====
  if (useGlow) {
    ctx.globalAlpha = 0.3;
    applyGlow(ctx, '#ff0000', 20);
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.roundRect(-size*0.6, -size*0.4, size*1.2, size*0.8, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ===== 메인 에러 박스 =====
  applyGlow(ctx, '#ff0000', 15);
  ctx.fillStyle = '#1a0000';
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-size*0.55, -size*0.35, size*1.1, size*0.7, 4);
  ctx.fill();
  ctx.stroke();

  // ===== 글리치 라인 (빠른 깜빡임) =====
  clearGlow(ctx);
  const glitchActive = Math.sin(time / 50) > 0.7;
  if (glitchActive) {
    ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
    ctx.fillRect(-size*0.55, -size*0.1 + Math.random() * size * 0.2, size*1.1, 3);
  }

  // ===== ERROR 텍스트 (메인) =====
  ctx.font = `bold ${size*0.28}px monospace`;
  ctx.fillStyle = '#ff3333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ERROR', 0, 0);

  // ===== 느낌표 강조 =====
  const bangPulse = 1 + Math.sin(time / 80) * 0.2;
  ctx.font = `bold ${size*0.35 * bangPulse}px monospace`;
  ctx.fillStyle = '#ffff00';
  ctx.fillText('!', size*0.45, -size*0.25);

  ctx.restore();
}

/**
 * Compiler - 기어 톱니바퀴 발사체 (v8.2 고도화)
 * - 스폰 바운스 + 회전 가속
 * - 컴파일 텍스트 트레일 (gcc, build, make)
 * - 이중 기어 + 에너지 코어
 */
export function drawCompiler(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(16, (p.radius || 10) * 1.5);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.CODE;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 트레일 파티클 (컴파일 명령어) =====
  const trailTexts = ['gcc', '>>>', 'make', 'build', '...'];
  const trailCount = 4;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount);
    const trailOffset = -i * size * 0.5;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `bold ${size * 0.22}px monospace`;
    ctx.fillStyle = colors.main;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 외곽 에너지 링 =====
  if (useGlow) {
    const ringPhase = (time / 150) % 1;
    const ringAlpha = 0.4 * (1 - ringPhase);
    ctx.strokeStyle = `rgba(${colors.glow}, ${ringAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.9 + ringPhase * 0.3), 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 회전하는 외부 기어 =====
  const rotation = (time / 150) % (Math.PI * 2);
  ctx.save();
  ctx.rotate(rotation);

  if (useGlow) applyGlow(ctx, colors.main, 14);
  ctx.fillStyle = colors.main;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;

  // 기어 이빨 (10개)
  const teeth = 10;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const innerR = size * 0.5;
    const outerR = size * 0.8;
    const toothAngle = Math.PI / teeth * 0.6;

    ctx.lineTo(Math.cos(angle - toothAngle) * innerR, Math.sin(angle - toothAngle) * innerR);
    ctx.lineTo(Math.cos(angle - toothAngle/2) * outerR, Math.sin(angle - toothAngle/2) * outerR);
    ctx.lineTo(Math.cos(angle + toothAngle/2) * outerR, Math.sin(angle + toothAngle/2) * outerR);
    ctx.lineTo(Math.cos(angle + toothAngle) * innerR, Math.sin(angle + toothAngle) * innerR);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ===== 내부 역회전 기어 =====
  ctx.save();
  ctx.rotate(-rotation * 1.5);
  clearGlow(ctx);
  ctx.fillStyle = colors.dark;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1.5;

  const innerTeeth = 6;
  ctx.beginPath();
  for (let i = 0; i < innerTeeth; i++) {
    const angle = (i / innerTeeth) * Math.PI * 2;
    const innerR = size * 0.2;
    const outerR = size * 0.38;
    const toothAngle = Math.PI / innerTeeth * 0.5;

    ctx.lineTo(Math.cos(angle - toothAngle) * innerR, Math.sin(angle - toothAngle) * innerR);
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    ctx.lineTo(Math.cos(angle + toothAngle) * innerR, Math.sin(angle + toothAngle) * innerR);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ===== 중앙 에너지 코어 =====
  const corePulse = 1 + Math.sin(time / 100) * 0.2;
  if (useGlow) applyGlow(ctx, '#ffffff', 10);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 진행률 표시 (%) =====
  clearGlow(ctx);
  const progress = Math.floor((time / 50) % 100);
  ctx.font = `bold ${size * 0.18}px monospace`;
  ctx.fillStyle = colors.main;
  ctx.textAlign = 'center';
  ctx.fillText(`${progress}%`, 0, size * 0.55);

  ctx.restore();
}

/**
 * Debugger - 돋보기 + 버그 발사체 (v8.2 고도화)
 * - 스캐닝 라인 애니메이션
 * - 디버그 텍스트 트레일 (console.log, breakpoint)
 * - 버그 타겟팅 UI
 */
export function drawDebuggerSkill(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(18, (p.radius || 10) * 1.7);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.CODE;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 트레일 파티클 (디버그 명령어) =====
  const trailTexts = ['log()', '>>>', 'break', 'step', '...'];
  const trailCount = 4;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount);
    const trailOffset = -i * size * 0.45;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `${size * 0.2}px monospace`;
    ctx.fillStyle = colors.main;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 스캐닝 링 (확산) =====
  if (useGlow) {
    const scanPhase = (time / 200) % 1;
    ctx.strokeStyle = `rgba(${colors.glow}, ${0.5 * (1 - scanPhase)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(-size*0.1, -size*0.1, size * (0.4 + scanPhase * 0.3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ===== 돋보기 렌즈 글로우 =====
  if (useGlow) {
    ctx.globalAlpha = 0.3;
    applyGlow(ctx, colors.main, 16);
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.arc(-size*0.1, -size*0.1, size*0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ===== 돋보기 프레임 =====
  applyGlow(ctx, colors.main, 12);
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-size*0.1, -size*0.1, size*0.35, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 돋보기 손잡이 =====
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size*0.12, size*0.12);
  ctx.lineTo(size*0.4, size*0.4);
  ctx.stroke();

  // ===== 렌즈 내부 (반투명) =====
  clearGlow(ctx);
  ctx.fillStyle = `rgba(${colors.glow}, 0.15)`;
  ctx.beginPath();
  ctx.arc(-size*0.1, -size*0.1, size*0.32, 0, Math.PI * 2);
  ctx.fill();

  // ===== 스캐닝 라인 (위아래 반복) =====
  const scanY = Math.sin(time / 100) * size * 0.25;
  ctx.strokeStyle = `rgba(${colors.glow}, 0.7)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size*0.35, -size*0.1 + scanY);
  ctx.lineTo(size*0.15, -size*0.1 + scanY);
  ctx.stroke();

  // ===== 버그 타겟 (중앙) =====
  const bugPulse = 1 + Math.sin(time / 80) * 0.15;
  ctx.fillStyle = '#ff3333';
  ctx.font = `${size * 0.28 * bugPulse}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐛', -size*0.1, -size*0.1);

  // ===== 타겟팅 십자선 =====
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  // 가로선
  ctx.moveTo(-size*0.25, -size*0.1);
  ctx.lineTo(-size*0.15, -size*0.1);
  ctx.moveTo(-size*0.05, -size*0.1);
  ctx.lineTo(size*0.05, -size*0.1);
  // 세로선
  ctx.moveTo(-size*0.1, -size*0.25);
  ctx.lineTo(-size*0.1, -size*0.15);
  ctx.moveTo(-size*0.1, -size*0.05);
  ctx.lineTo(-size*0.1, size*0.05);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

/**
 * Hotfix - 반창고/패치 발사체 (v8.2 고도화)
 * - 빠른 스폰 바운스 (긴급 배포 느낌)
 * - 스피드 트레일 (빠른 발사)
 * - 힐링 파티클 + 체크마크 애니메이션
 */
export function drawHotfix(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(16, (p.radius || 10) * 1.5);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.CODE;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 스피드 트레일 (빠른 배포) =====
  const trailTexts = ['v1.0.1', 'patch', 'fix!', '>>>', '✓'];
  const trailCount = 5;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount) * 0.8;
    const trailOffset = -i * size * 0.35;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `bold ${size * 0.18}px monospace`;
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 힐링 파티클 (+ 기호들) =====
  if (useGlow) {
    const particleCount = 4;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time / 300;
      const dist = size * 0.6;
      const particleAlpha = 0.4 + Math.sin(time / 150 + i) * 0.3;

      ctx.globalAlpha = particleAlpha;
      ctx.fillStyle = colors.accent;
      ctx.font = `bold ${size * 0.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('+', Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 펄스 링 (회복 효과) =====
  if (useGlow) {
    const pulsePhase = (time / 120) % 1;
    const pulseAlpha = (1 - pulsePhase) * 0.4;

    ctx.strokeStyle = `rgba(${colors.glow}, ${pulseAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.4 + pulsePhase * 0.4), 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 반창고 글로우 =====
  if (useGlow) {
    ctx.globalAlpha = 0.4;
    applyGlow(ctx, colors.main, 12);
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.roundRect(-size*0.55, -size*0.18, size*1.1, size*0.36, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ===== 반창고 본체 (십자형) =====
  applyGlow(ctx, colors.main, 10);

  // 베이지 베이스
  ctx.fillStyle = '#e8d5b7';
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2;

  // 가로 반창고
  ctx.beginPath();
  ctx.roundRect(-size*0.5, -size*0.15, size, size*0.3, 3);
  ctx.fill();
  ctx.stroke();

  // 세로 반창고
  ctx.beginPath();
  ctx.roundRect(-size*0.15, -size*0.5, size*0.3, size, 3);
  ctx.fill();
  ctx.stroke();

  // ===== 천공 패턴 (반창고 구멍) =====
  clearGlow(ctx);
  ctx.fillStyle = 'rgba(200, 180, 160, 0.8)';
  const holePositions = [
    [-size*0.3, 0], [size*0.3, 0], [0, -size*0.3], [0, size*0.3]
  ];
  for (const [hx, hy] of holePositions) {
    ctx.beginPath();
    ctx.arc(hx, hy, size*0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 중앙 십자가 (회복 심볼) =====
  const crossPulse = 1 + Math.sin(time / 100) * 0.1;
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 3 * crossPulse;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size*0.12, 0);
  ctx.lineTo(size*0.12, 0);
  ctx.moveTo(0, -size*0.12);
  ctx.lineTo(0, size*0.12);
  ctx.stroke();

  // ===== 체크마크 (성공적 배포) =====
  const checkPhase = (time / 500) % 1;
  if (checkPhase > 0.5) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size*0.25, -size*0.35);
    ctx.lineTo(size*0.35, -size*0.25);
    ctx.lineTo(size*0.5, -size*0.45);
    ctx.stroke();
  }

  ctx.restore();
}

// =========================================
// DATA CATEGORY SKILLS
// =========================================

/**
 * JSON Bomb - {} 폭발하는 JSON 발사체 (v8.2 고도화)
 * - 데이터 폭발 이펙트
 * - JSON 키-값 트레일
 * - 압축/해제 펄스
 */
export function drawJsonBomb(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(18, (p.radius || 12) * 1.4);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.DATA;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 트레일 파티클 (JSON 키-값) =====
  const trailTexts = ['"id":', '{}', '[]', '"data"', '...'];
  const trailCount = 4;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount);
    const trailOffset = -i * size * 0.45;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `bold ${size * 0.2}px monospace`;
    ctx.fillStyle = colors.main;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 데이터 폭발 파티클 =====
  if (useGlow) {
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time / 400;
      const dist = size * (0.5 + Math.sin(time / 150 + i) * 0.15);
      const chars = ['{', '}', '[', ']', ':', ','];

      ctx.globalAlpha = 0.5;
      ctx.font = `bold ${size * 0.18}px monospace`;
      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'center';
      ctx.fillText(chars[i], Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 압축/해제 펄스 링 =====
  if (useGlow) {
    const pulsePhase = (time / 200) % 1;
    const pulseAlpha = (1 - pulsePhase) * 0.5;

    ctx.strokeStyle = `rgba(${colors.glow}, ${pulseAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.5 + pulsePhase * 0.4), 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 글로우 레이어 =====
  if (useGlow) {
    ctx.globalAlpha = 0.35;
    applyGlow(ctx, colors.main, 18);
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.roundRect(-size*0.55, -size*0.55, size*1.1, size*1.1, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ===== 메인 JSON 박스 =====
  const mainPulse = 1 + Math.sin(time / 120) * 0.08;
  ctx.save();
  ctx.scale(mainPulse, mainPulse);

  applyGlow(ctx, colors.main, 14);
  ctx.fillStyle = colors.dark;
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-size*0.48, -size*0.48, size*0.96, size*0.96, 5);
  ctx.fill();
  ctx.stroke();

  // ===== { } 메인 텍스트 =====
  clearGlow(ctx);
  ctx.font = `bold ${size*0.45}px monospace`;
  ctx.fillStyle = colors.main;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('{  }', 0, 0);

  // ===== 내부 데이터 (깜빡임) =====
  const dataPhase = Math.floor(time / 300) % 3;
  const dataTexts = ['...', '===', ':::'];
  ctx.font = `bold ${size*0.22}px monospace`;
  ctx.fillStyle = colors.accent;
  ctx.fillText(dataTexts[dataPhase], 0, 0);

  ctx.restore();

  // ===== 폭발 위험 표시 =====
  const warningPulse = Math.sin(time / 80) > 0;
  if (warningPulse) {
    ctx.fillStyle = '#ff6600';
    ctx.font = `bold ${size * 0.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', size * 0.4, -size * 0.4);
  }

  ctx.restore();
}

/**
 * CSV Spray - 쉼표로 구분된 데이터 스프레이 (v8.2 고도화)
 * - 스프레드시트 셀 애니메이션
 * - 데이터 값 스트림
 * - 확산 트레일
 */
export function drawCsvSpray(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(12, (p.radius || 6) * 1.6);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.DATA;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 스프레이 트레일 (데이터 값들) =====
  const trailValues = ['A1', 'B2', '...', '99', 'NULL'];
  const trailCount = 3;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount) * 0.7;
    const trailOffset = -i * size * 0.5;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `${size * 0.22}px monospace`;
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    ctx.fillText(trailValues[i % trailValues.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 스프레이 확산 효과 =====
  if (useGlow) {
    const sprayCount = 3;
    for (let i = 0; i < sprayCount; i++) {
      const spreadY = (i - 1) * size * 0.4;
      const spreadAlpha = 0.3 - Math.abs(i - 1) * 0.1;
      const spreadOffset = size * 0.3 + (time / 50) % (size * 0.3);

      ctx.globalAlpha = spreadAlpha;
      ctx.fillStyle = colors.main;
      ctx.beginPath();
      ctx.arc(spreadOffset, spreadY, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ===== 글로우 배경 =====
  if (useGlow) {
    applyGlow(ctx, colors.main, 10);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.roundRect(-size*0.8, -size*0.35, size*1.6, size*0.7, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ===== 3개 셀 (CSV 행) =====
  applyGlow(ctx, colors.main, 8);

  const cellData = ['A', 'B', 'C'];
  for (let i = -1; i <= 1; i++) {
    const cellX = i * size * 0.55;
    const cellPulse = 1 + Math.sin(time / 150 + i * 0.5) * 0.08;

    ctx.save();
    ctx.translate(cellX, 0);
    ctx.scale(cellPulse, cellPulse);

    // 셀 배경
    ctx.fillStyle = colors.dark;
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-size*0.22, -size*0.28, size*0.44, size*0.56, 2);
    ctx.fill();
    ctx.stroke();

    // 셀 데이터
    clearGlow(ctx);
    ctx.font = `bold ${size * 0.22}px monospace`;
    ctx.fillStyle = colors.main;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cellData[i + 1], 0, 0);

    ctx.restore();
  }

  // ===== 쉼표 구분자 (애니메이션) =====
  clearGlow(ctx);
  const commaAlpha = 0.7 + Math.sin(time / 100) * 0.3;
  ctx.globalAlpha = commaAlpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size*0.35}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(',', -size*0.28, size*0.12);
  ctx.fillText(',', size*0.28, size*0.12);
  ctx.globalAlpha = 1;

  ctx.restore();
}

/**
 * Binary - 0과 1 스트림 발사체 (v8.2 고도화)
 * - 매트릭스 스타일 바이너리 레인
 * - 글리치 효과
 * - 데이터 코어 + 비트 파티클
 */
export function drawBinary(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(14, (p.radius || 8) * 1.6);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.DATA;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 바이너리 트레일 스트림 =====
  const trailBits = ['01', '10', '11', '00'];
  const trailCount = 4;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount);
    const trailOffset = -i * size * 0.4;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `bold ${size * 0.25}px monospace`;
    ctx.fillStyle = colors.main;
    ctx.textAlign = 'center';
    ctx.fillText(trailBits[i % trailBits.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 펄스 링 =====
  if (useGlow) {
    const pulsePhase = (time / 160) % 1;
    const pulseAlpha = (1 - pulsePhase) * 0.4;

    ctx.strokeStyle = `rgba(${colors.glow}, ${pulseAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.4 + pulsePhase * 0.35), 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== 글로우 코어 =====
  if (useGlow) {
    applyGlow(ctx, colors.main, 14);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ===== 바이너리 스트림 (매트릭스 레인) =====
  applyGlow(ctx, colors.main, 10);
  ctx.font = `bold ${size*0.32}px monospace`;

  const bitRows = 3;
  const bitCols = 4;
  for (let row = 0; row < bitRows; row++) {
    for (let col = 0; col < bitCols; col++) {
      const bitX = (col - (bitCols - 1) / 2) * size * 0.28;
      const bitY = (row - (bitRows - 1) / 2) * size * 0.28;

      // 시간에 따른 비트 변경
      const bitValue = Math.floor(time / 80 + row * col) % 2;
      const bitAlpha = 0.5 + Math.sin(time / 100 + row + col) * 0.3;

      ctx.globalAlpha = bitAlpha;
      ctx.fillStyle = bitValue ? colors.main : colors.accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(bitValue), bitX, bitY);
    }
  }
  ctx.globalAlpha = 1;

  // ===== 중앙 데이터 코어 =====
  clearGlow(ctx);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // ===== 글리치 오버레이 =====
  const glitchActive = Math.sin(time / 40) > 0.85;
  if (glitchActive && useGlow) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-size * 0.5, -size * 0.05 + Math.random() * size * 0.1, size, size * 0.1);
    ctx.globalAlpha = 1;
  }

  // ===== 비트 파티클 (외곽 공전) =====
  if (useGlow) {
    const particleCount = 4;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time / 250;
      const dist = size * 0.5;

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = colors.accent;
      ctx.font = `${size * 0.15}px monospace`;
      ctx.fillText(i % 2 ? '1' : '0', Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/**
 * Big Data - 거대한 데이터 클러스터 (v8.2 고도화)
 * - 다중 레이어 데이터 클러스터
 * - 데이터 플로우 애니메이션
 * - 노드 간 연결 펄스
 */
export function drawBigData(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const baseSize = Math.max(22, (p.radius || 15) * 1.4);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.DATA;
  const bounceScale = getSpawnBounce(p);
  const size = baseSize * bounceScale;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용

  // ===== 데이터 플로우 트레일 =====
  const trailTexts = ['DATA', '>>>>', 'FLOW', 'SYNC', '...'];
  const trailCount = 4;
  for (let i = trailCount; i >= 1; i--) {
    const trailAlpha = getTrailAlpha(i, trailCount);
    const trailOffset = -i * size * 0.5;

    ctx.save();
    ctx.translate(trailOffset, 0);
    ctx.globalAlpha = trailAlpha;
    ctx.font = `bold ${size * 0.15}px monospace`;
    ctx.fillStyle = colors.main;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 외곽 펄스 링 (다중) =====
  if (useGlow) {
    for (let ring = 0; ring < 2; ring++) {
      const ringPhase = ((time / 250) + ring * 0.5) % 1;
      const ringAlpha = (1 - ringPhase) * 0.35;

      ctx.strokeStyle = `rgba(${colors.glow}, ${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.5 + ringPhase * 0.4), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ===== 외곽 노드 레이어 =====
  if (useGlow) applyGlow(ctx, colors.main, 18);

  const outerNodeCount = 8;
  const outerDist = size * 0.5;
  const outerRotation = time / 600;

  for (let i = 0; i < outerNodeCount; i++) {
    const angle = (i / outerNodeCount) * Math.PI * 2 + outerRotation;
    const x = Math.cos(angle) * outerDist;
    const y = Math.sin(angle) * outerDist;
    const nodePulse = size * 0.1 + Math.sin(time / 150 + i * 0.7) * 2;

    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(x, y, nodePulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 내부 노드 레이어 (역회전) =====
  const innerNodeCount = 5;
  const innerDist = size * 0.28;
  const innerRotation = -time / 400;

  for (let i = 0; i < innerNodeCount; i++) {
    const angle = (i / innerNodeCount) * Math.PI * 2 + innerRotation;
    const x = Math.cos(angle) * innerDist;
    const y = Math.sin(angle) * innerDist;
    const nodePulse = size * 0.08 + Math.sin(time / 120 + i * 0.5) * 1.5;

    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.arc(x, y, nodePulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 연결선 (애니메이션) =====
  clearGlow(ctx);

  // 외곽→중앙 연결
  for (let i = 0; i < outerNodeCount; i++) {
    const angle = (i / outerNodeCount) * Math.PI * 2 + outerRotation;
    const pulseAlpha = 0.3 + Math.sin(time / 100 + i) * 0.2;

    ctx.strokeStyle = `rgba(${colors.glow}, ${pulseAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * outerDist, Math.sin(angle) * outerDist);
    ctx.stroke();
  }

  // 노드 간 연결 (일부)
  ctx.strokeStyle = `rgba(${colors.glow}, 0.25)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < outerNodeCount; i++) {
    const angle1 = (i / outerNodeCount) * Math.PI * 2 + outerRotation;
    const angle2 = ((i + 1) / outerNodeCount) * Math.PI * 2 + outerRotation;

    ctx.beginPath();
    ctx.moveTo(Math.cos(angle1) * outerDist, Math.sin(angle1) * outerDist);
    ctx.lineTo(Math.cos(angle2) * outerDist, Math.sin(angle2) * outerDist);
    ctx.stroke();
  }

  // ===== 중앙 코어 =====
  if (useGlow) applyGlow(ctx, '#ffffff', 12);
  const corePulse = 1 + Math.sin(time / 80) * 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12 * corePulse, 0, Math.PI * 2);
  ctx.fill();

  // ===== 데이터 플로우 파티클 =====
  if (useGlow) {
    const flowCount = 3;
    for (let i = 0; i < flowCount; i++) {
      const flowPhase = ((time / 300) + i / flowCount) % 1;
      const flowAngle = (i / flowCount) * Math.PI * 2 + time / 500;
      const flowDist = flowPhase * size * 0.5;

      ctx.globalAlpha = 1 - flowPhase;
      ctx.fillStyle = colors.main;
      ctx.beginPath();
      ctx.arc(Math.cos(flowAngle) * flowDist, Math.sin(flowAngle) * flowDist, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ===== "BIG DATA" 라벨 =====
  clearGlow(ctx);
  ctx.font = `bold ${size * 0.12}px monospace`;
  ctx.fillStyle = colors.accent;
  ctx.textAlign = 'center';
  ctx.fillText('BIG DATA', 0, size * 0.7);

  ctx.restore();
}

// =========================================
// NETWORK CATEGORY SKILLS
// =========================================

/**
 * WebSocket - 양방향 화살표 연결
 */
export function drawWebsocket(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(14, (p.radius || 10) * 1.4);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.NETWORK;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (양방향 데이터)
  const trailTexts = ['<->', 'send', 'recv', 'ws://', 'open'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.accent;
    ctx.font = `${size * 0.18}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.35);
  }
  ctx.globalAlpha = 1;

  // 연결 상태 펄스 링
  const pulsePhase = (time / 400) % 1;
  const pulseSize = size * (0.4 + pulsePhase * 0.6);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, colors.main, 12);
  ctx.strokeStyle = colors.main;
  ctx.fillStyle = colors.main;
  ctx.lineWidth = 2.5;

  // 양방향 화살표 (향상된 애니메이션)
  const pulse = Math.sin(time / 80) * size * 0.12;
  const dataFlow = (time / 50) % (size * 0.8);

  // 데이터 흐름 점들
  ctx.fillStyle = colors.accent;
  for (let i = 0; i < 3; i++) {
    const flowX = -size * 0.4 + ((dataFlow + i * size * 0.25) % (size * 0.8));
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(flowX, -size * 0.05, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 역방향 데이터
  for (let i = 0; i < 3; i++) {
    const flowX = size * 0.4 - ((dataFlow + i * size * 0.25) % (size * 0.8));
    ctx.beginPath();
    ctx.arc(flowX, size * 0.05, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 왼쪽 화살표 <-
  ctx.strokeStyle = colors.main;
  ctx.beginPath();
  ctx.moveTo(-size*0.55 - pulse, 0);
  ctx.lineTo(-size*0.15, 0);
  ctx.moveTo(-size*0.55 - pulse, 0);
  ctx.lineTo(-size*0.4 - pulse, -size*0.12);
  ctx.moveTo(-size*0.55 - pulse, 0);
  ctx.lineTo(-size*0.4 - pulse, size*0.12);
  ctx.stroke();

  // 오른쪽 화살표 ->
  ctx.beginPath();
  ctx.moveTo(size*0.15, 0);
  ctx.lineTo(size*0.55 + pulse, 0);
  ctx.moveTo(size*0.55 + pulse, 0);
  ctx.lineTo(size*0.4 + pulse, -size*0.12);
  ctx.moveTo(size*0.55 + pulse, 0);
  ctx.lineTo(size*0.4 + pulse, size*0.12);
  ctx.stroke();

  // WS 배지
  clearGlow(ctx);
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.roundRect(-size * 0.2, -size * 0.15, size * 0.4, size * 0.3, 3);
  ctx.fill();
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = colors.main;
  ctx.font = `bold ${size*0.22}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('WS', 0, size*0.06);

  ctx.restore();
}

/**
 * TCP Flood - 패킷 폭풍
 */
export function drawTcpFlood(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(12, (p.radius || 8) * 1.5);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.NETWORK;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (포트 번호)
  const trailTexts = ['SYN', 'ACK', ':80', ':443', 'FIN'];
  for (let i = 0; i < 5; i++) {
    const trailOffset = -i * size * 0.35;
    const alpha = getTrailAlpha(i, 5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.accent;
    ctx.font = `${size * 0.16}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.4);
  }
  ctx.globalAlpha = 1;

  // 과부하 펄스 링
  const pulsePhase = (time / 250) % 1;
  const pulseSize = size * (0.3 + pulsePhase * 0.8);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, colors.main, 10);

  // 패킷 폭풍 (향상된 버전)
  const packetCount = 7;
  for (let i = 0; i < packetCount; i++) {
    const speed = 40 + (i % 3) * 10;
    const offset = ((time / speed) + i * 15) % (size * 3) - size * 1.5;
    const y = Math.sin(time / 80 + i * 1.5) * size * 0.25;
    const alpha = 1 - Math.abs(offset) / (size * 1.5);
    const packetSize = size * (0.12 + (i % 3) * 0.04);

    ctx.globalAlpha = Math.max(0.3, alpha);

    // 패킷 박스
    ctx.fillStyle = colors.main;
    ctx.fillRect(offset - packetSize, y - packetSize * 0.7, packetSize * 2, packetSize * 1.4);

    // 패킷 내부 라인
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offset - packetSize * 0.6, y);
    ctx.lineTo(offset + packetSize * 0.6, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 폭발 중심 (DDoS 표시)
  clearGlow(ctx);
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 번개 아이콘 (과부하)
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, -size * 0.12);
  ctx.lineTo(size * 0.04, -size * 0.02);
  ctx.lineTo(-size * 0.02, -size * 0.02);
  ctx.lineTo(size * 0.08, size * 0.12);
  ctx.lineTo(-size * 0.04, size * 0.02);
  ctx.lineTo(size * 0.02, size * 0.02);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * DNS Spoof - 변조된 주소 발사체
 */
export function drawDnsSpoof(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(14, (p.radius || 10) * 1.4);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.NETWORK;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (가짜 IP)
  const trailTexts = ['fake', 'spoof', 'MITM', 'redirect', 'poison'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.45;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = `${size * 0.15}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.35);
  }
  ctx.globalAlpha = 1;

  // 경고 펄스 링
  const pulsePhase = (time / 300) % 1;
  const pulseSize = size * (0.5 + pulsePhase * 0.5);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 글리치 효과 (향상)
  const glitchIntensity = Math.sin(time / 40);
  const glitch = glitchIntensity > 0.7 ? (Math.random() - 0.5) * 6 : 0;
  const colorGlitch = glitchIntensity > 0.85;
  ctx.translate(glitch, glitch * 0.3);

  if (useGlow) applyGlow(ctx, colorGlitch ? '#ff0000' : colors.main, 12);

  // 주소창 모양 (향상)
  ctx.fillStyle = colors.dark;
  ctx.strokeStyle = colorGlitch ? '#ff0000' : colors.main;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-size*0.65, -size*0.22, size*1.3, size*0.44, 4);
  ctx.fill();
  ctx.stroke();

  // 자물쇠 아이콘 (깨진 자물쇠)
  clearGlow(ctx);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-size * 0.45, -size * 0.05, size * 0.08, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-size * 0.52, -size * 0.05, size * 0.14, size * 0.12);

  // URL 텍스트 (교대 표시)
  const showFake = Math.floor(time / 200) % 2 === 0;
  ctx.font = `${size*0.18}px monospace`;
  ctx.fillStyle = showFake ? '#ff4444' : colors.accent;
  ctx.textAlign = 'center';
  ctx.fillText(showFake ? 'evil.com' : '192.168.X.X', size * 0.1, size * 0.06);

  // RGB 분리 글리치 오버레이
  if (colorGlitch) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff0000';
    ctx.fillText('evil.com', size * 0.12, size * 0.04);
    ctx.fillStyle = '#00ffff';
    ctx.fillText('evil.com', size * 0.08, size * 0.08);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/**
 * Packet Loss - 끊어진 패킷
 */
export function drawPacketLoss(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(12, (p.radius || 8) * 1.5);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.NETWORK;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (손실된 패킷)
  const trailTexts = ['DROP', 'LOST', 'FAIL', 'TIMEOUT', '???'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    const flicker = Math.random() > 0.7 ? 0.3 : 1; // 불안정한 깜빡임
    ctx.globalAlpha = alpha * flicker;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = `${size * 0.14}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.35);
  }
  ctx.globalAlpha = 1;

  // 실패 펄스 링 (빨간색)
  const pulsePhase = (time / 350) % 1;
  const pulseSize = size * (0.3 + pulsePhase * 0.5);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.globalAlpha = pulseAlpha * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, colors.main, 10);

  // 분리된 패킷 조각들
  const fragmentCount = 4;
  for (let i = 0; i < fragmentCount; i++) {
    const angle = (Math.PI * 2 * i) / fragmentCount + time / 300;
    const dist = size * 0.35;
    const fragX = Math.cos(angle) * dist;
    const fragY = Math.sin(angle) * dist * 0.5; // 아이소메트릭 압축
    const fragSize = size * 0.15;

    // 조각 패킷
    ctx.fillStyle = colors.main;
    ctx.globalAlpha = 0.6 + Math.sin(time / 100 + i) * 0.3;
    ctx.fillRect(fragX - fragSize/2, fragY - fragSize/3, fragSize, fragSize * 0.6);
  }
  ctx.globalAlpha = 1;

  // 점선 연결 시도 (실패 중)
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(-size*0.4, 0);
  ctx.lineTo(size*0.4, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // 중앙 에러 아이콘
  clearGlow(ctx);

  // X 배경 원
  ctx.fillStyle = '#330000';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  // X 표시 (향상)
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-size*0.1, -size*0.1);
  ctx.lineTo(size*0.1, size*0.1);
  ctx.moveTo(size*0.1, -size*0.1);
  ctx.lineTo(-size*0.1, size*0.1);
  ctx.stroke();

  // 손실률 표시
  const lossRate = 50 + Math.floor(Math.sin(time / 200) * 30);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = `${size * 0.12}px monospace`;
  ctx.fillText(`${lossRate}%`, 0, size * 0.45);

  ctx.restore();
}

/**
 * VPN Tunnel - 터널/파이프 모양
 */
export function drawVpnTunnel(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(16, (p.radius || 12) * 1.3);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.NETWORK;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (암호화 키워드)
  const trailTexts = ['AES', 'TLS', 'SSL', 'encrypt', 'secure'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.45;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00ff88';
    ctx.font = `${size * 0.14}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.4);
  }
  ctx.globalAlpha = 1;

  // 보안 펄스 링 (녹색)
  const pulsePhase = (time / 400) % 1;
  const pulseSize = size * (0.4 + pulsePhase * 0.6);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, colors.main, 14);

  // 터널 깊이감 (3D 파이프)
  const tunnelDepth = 5;
  for (let i = tunnelDepth - 1; i >= 0; i--) {
    const depthScale = 1 - i * 0.15;
    const depthOffset = i * 2;
    const alpha = 0.3 + (1 - i / tunnelDepth) * 0.7;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = i === 0 ? colors.dark : colors.main;
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(depthOffset, 0, size*0.5*depthScale, size*0.25*depthScale, 0, 0, Math.PI * 2);
    if (i === 0) ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 데이터 흐름 (터널 통과)
  const dataCount = 4;
  for (let i = 0; i < dataCount; i++) {
    const flowPhase = ((time / 150) + i * 0.25) % 1;
    const flowX = -size * 0.3 + flowPhase * size * 0.9;
    const flowScale = 0.5 + Math.sin(flowPhase * Math.PI) * 0.5;

    ctx.fillStyle = '#00ffcc';
    ctx.globalAlpha = flowScale;
    ctx.beginPath();
    ctx.arc(flowX, 0, size * 0.05 * flowScale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 자물쇠 아이콘 (보안 표시)
  clearGlow(ctx);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -size * 0.08, size * 0.1, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#00ff88';
  ctx.fillRect(-size * 0.08, -size * 0.08, size * 0.16, size * 0.14);

  // VPN 라벨
  ctx.fillStyle = colors.dark;
  ctx.font = `bold ${size*0.1}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('VPN', 0, size * 0.04);

  // 암호화 상태 표시
  ctx.fillStyle = '#00ff88';
  ctx.font = `${size * 0.1}px monospace`;
  ctx.fillText('SECURE', 0, size * 0.35);

  ctx.restore();
}

// =========================================
// SECURITY CATEGORY SKILLS
// =========================================

/**
 * Antivirus - 방패 + 체크마크
 */
export function drawAntivirus(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(16, (p.radius || 12) * 1.3);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.SECURITY;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (보안 키워드)
  const trailTexts = ['SCAN', 'SAFE', 'CLEAN', 'BLOCK', 'GUARD'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00ff66';
    ctx.font = `${size * 0.14}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.5);
  }
  ctx.globalAlpha = 1;

  // 보호 펄스 링
  const pulsePhase = (time / 350) % 1;
  const pulseSize = size * (0.5 + pulsePhase * 0.5);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 펄스 효과
  const pulse = 1 + Math.sin(time / 150) * 0.08;
  ctx.scale(pulse, pulse);

  if (useGlow) applyGlow(ctx, '#00ff00', 14);

  // 방패 모양 (향상)
  ctx.fillStyle = '#002200';
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -size*0.5);
  ctx.lineTo(size*0.45, -size*0.3);
  ctx.lineTo(size*0.45, size*0.1);
  ctx.quadraticCurveTo(size*0.3, size*0.4, 0, size*0.55);
  ctx.quadraticCurveTo(-size*0.3, size*0.4, -size*0.45, size*0.1);
  ctx.lineTo(-size*0.45, -size*0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 스캔 라인 (위에서 아래로)
  const scanY = ((time / 300) % 1) * size - size * 0.4;
  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(-size * 0.35, scanY);
  ctx.lineTo(size * 0.35, scanY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 체크마크 (향상)
  clearGlow(ctx);
  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size*0.15, size*0.05);
  ctx.lineTo(-size*0.02, size*0.2);
  ctx.lineTo(size*0.2, -size*0.12);
  ctx.stroke();

  // 100% 표시
  ctx.fillStyle = '#00ff66';
  ctx.font = `bold ${size * 0.12}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('100%', 0, -size * 0.3);

  ctx.restore();
}

/**
 * Sandbox - 격리된 박스
 */
export function drawSandbox(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(16, (p.radius || 12) * 1.3);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.SECURITY;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (격리 키워드)
  const trailTexts = ['ISO', 'VM', 'JAIL', 'CONTAIN', 'TEST'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.accent;
    ctx.font = `${size * 0.14}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.5);
  }
  ctx.globalAlpha = 1;

  // 격리 펄스 링 (점선)
  const pulsePhase = (time / 400) % 1;
  const pulseSize = size * (0.5 + pulsePhase * 0.4);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.globalAlpha = pulseAlpha * 0.5;
  ctx.beginPath();
  ctx.rect(-pulseSize, -pulseSize * 0.6, pulseSize * 2, pulseSize * 1.2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, colors.main, 12);

  // 점선 박스 (격리 컨테이너) - 3D 효과
  ctx.fillStyle = colors.dark;
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);

  // 박스 면
  ctx.beginPath();
  ctx.rect(-size*0.4, -size*0.35, size*0.8, size*0.7);
  ctx.fill();
  ctx.stroke();

  // 격자 내부
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  for (let i = 1; i < 4; i++) {
    const y = -size * 0.35 + (size * 0.7 * i / 4);
    ctx.beginPath();
    ctx.moveTo(-size * 0.38, y);
    ctx.lineTo(size * 0.38, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // 내부 격리된 프로세스 아이콘
  clearGlow(ctx);
  const processCount = 3;
  for (let i = 0; i < processCount; i++) {
    const angle = (Math.PI * 2 * i) / processCount + time / 500;
    const dist = size * 0.2;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist * 0.5;

    // 프로세스 박스
    ctx.fillStyle = '#ff6b6b';
    ctx.globalAlpha = 0.7 + Math.sin(time / 150 + i) * 0.3;
    ctx.fillRect(px - size * 0.06, py - size * 0.04, size * 0.12, size * 0.08);
  }
  ctx.globalAlpha = 1;

  // 경고 표시
  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold ${size * 0.18}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, size * 0.05);

  // SANDBOX 라벨
  ctx.fillStyle = colors.accent;
  ctx.font = `${size * 0.1}px monospace`;
  ctx.fillText('SANDBOX', 0, size * 0.4);

  ctx.restore();
}

/**
 * Zero Trust - 물음표 + 경고
 */
export function drawZeroTrust(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(14, (p.radius || 10) * 1.4);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.SECURITY;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (의심 키워드)
  const trailTexts = ['DENY', 'VERIFY', 'AUTH', 'CHECK', 'TRUST?'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.accent;
    ctx.font = `${size * 0.13}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.45);
  }
  ctx.globalAlpha = 1;

  // 검증 펄스 링 (경고색)
  const pulsePhase = (time / 300) % 1;
  const pulseSize = size * (0.4 + pulsePhase * 0.5);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 깜빡임 (향상)
  const blink = Math.sin(time / 120) > 0.3;
  const alertBlink = Math.sin(time / 80) > 0.7;

  if (useGlow) applyGlow(ctx, alertBlink ? '#ff4444' : colors.main, 12);

  // 육각형 배경 (보안 뱃지)
  ctx.fillStyle = blink ? '#2a0a0a' : colors.dark;
  ctx.strokeStyle = alertBlink ? '#ff4444' : colors.main;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(angle) * size * 0.45;
    const y = Math.sin(angle) * size * 0.45;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 스캔 회전 라인
  const scanAngle = (time / 200) % (Math.PI * 2);
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(scanAngle) * size * 0.4, Math.sin(scanAngle) * size * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ? 마크 (향상)
  clearGlow(ctx);
  const questionPulse = 1 + Math.sin(time / 150) * 0.1;
  ctx.font = `bold ${size * 0.45 * questionPulse}px sans-serif`;
  ctx.fillStyle = alertBlink ? '#ff4444' : colors.main;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, -size * 0.02);

  // VERIFY 라벨
  ctx.fillStyle = '#ffcc00';
  ctx.font = `${size * 0.1}px monospace`;
  ctx.fillText('VERIFY', 0, size * 0.35);

  ctx.restore();
}

/**
 * Honeypot - 꿀단지 함정
 */
export function drawHoneypot(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(14, (p.radius || 10) * 1.4);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.SECURITY;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (유인 키워드)
  const trailTexts = ['TRAP', 'BAIT', 'LURE', 'DECOY', 'FAKE'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fbbf24';
    ctx.font = `${size * 0.13}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.55);
  }
  ctx.globalAlpha = 1;

  // 유인 펄스 링 (황금색)
  const pulsePhase = (time / 350) % 1;
  const pulseSize = size * (0.4 + pulsePhase * 0.5);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulseAlpha * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, '#fbbf24', 14);

  // 꿀단지 본체 (향상)
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.1);
  ctx.quadraticCurveTo(-size * 0.4, size * 0.2, -size * 0.25, size * 0.35);
  ctx.lineTo(size * 0.25, size * 0.35);
  ctx.quadraticCurveTo(size * 0.4, size * 0.2, size * 0.3, -size * 0.1);
  ctx.closePath();
  ctx.fill();

  // 꿀 (넘치는 효과)
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.05, size * 0.28, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // 단지 입구
  ctx.fillStyle = '#92400e';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.2, size * 0.22, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 꿀벌 파티클 (유인됨)
  clearGlow(ctx);
  const beeCount = 3;
  for (let i = 0; i < beeCount; i++) {
    const angle = (time / 300 + i * 2.1) % (Math.PI * 2);
    const dist = size * (0.45 + Math.sin(time / 200 + i) * 0.1);
    const beeX = Math.cos(angle) * dist;
    const beeY = Math.sin(angle) * dist * 0.5 - size * 0.1;

    // 벌 몸통
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(beeX, beeY, size * 0.06, size * 0.04, angle, 0, Math.PI * 2);
    ctx.fill();

    // 벌 줄무늬
    ctx.fillStyle = '#000';
    ctx.fillRect(beeX - size * 0.02, beeY - size * 0.02, size * 0.015, size * 0.04);
  }

  // 꿀 드립 (향상)
  const dripPhase = (time / 400) % 1;
  const dripY = dripPhase * size * 0.25;
  const dripAlpha = 1 - dripPhase;
  ctx.fillStyle = '#fbbf24';
  ctx.globalAlpha = dripAlpha;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.35 + dripY, 3 - dripPhase * 2, 5 - dripPhase * 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // TRAP 라벨
  ctx.fillStyle = '#ff4444';
  ctx.font = `bold ${size * 0.12}px monospace`;
  ctx.fillText('TRAP!', 0, -size * 0.38);

  ctx.restore();
}

/**
 * Incident Response - 경보 + 스패너
 */
export function drawIncidentResponse(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(16, (p.radius || 12) * 1.3);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.SECURITY;
  const bounceScale = getSpawnBounce(p);

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // 트레일 파티클 (대응 키워드)
  const trailTexts = ['ALERT', 'RESP', 'FIX', 'PATCH', 'MITIG'];
  for (let i = 0; i < 4; i++) {
    const trailOffset = -i * size * 0.4;
    const alpha = getTrailAlpha(i, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = `${size * 0.13}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], trailOffset, size * 0.5);
  }
  ctx.globalAlpha = 1;

  // 비상 펄스 링 (빨간색)
  const pulsePhase = (time / 250) % 1;
  const pulseSize = size * (0.4 + pulsePhase * 0.6);
  const pulseAlpha = 1 - pulsePhase;
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.globalAlpha = pulseAlpha * 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 경보 깜빡임 (향상)
  const alarm = Math.sin(time / 80) > 0;
  const fastBlink = Math.sin(time / 50) > 0.5;

  if (useGlow) applyGlow(ctx, alarm ? '#ff0000' : colors.main, 16);

  // 경보등 베이스
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.roundRect(-size * 0.18, -size * 0.35, size * 0.36, size * 0.15, 3);
  ctx.fill();

  // 경보등 (깜빡임)
  ctx.fillStyle = alarm ? '#ff0000' : '#660000';
  ctx.beginPath();
  ctx.arc(0, -size * 0.25, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // 경보등 하이라이트
  if (alarm) {
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(-size * 0.05, -size * 0.3, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // 경보 광선 (비상시)
  if (fastBlink) {
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const rayAngle = (Math.PI * i / 2) + time / 300;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rayAngle) * size * 0.22, -size * 0.25 + Math.sin(rayAngle) * size * 0.22);
      ctx.lineTo(Math.cos(rayAngle) * size * 0.35, -size * 0.25 + Math.sin(rayAngle) * size * 0.35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 스패너 + 렌치 (수리 도구)
  clearGlow(ctx);

  // 렌치
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size * 0.25, size * 0.35);
  ctx.lineTo(size * 0.05, size * 0.1);
  ctx.stroke();

  // 렌치 헤드
  ctx.fillStyle = '#666666';
  ctx.beginPath();
  ctx.arc(size * 0.05, size * 0.1, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(size * 0.05, size * 0.1, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // 드라이버
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(size * 0.25, size * 0.35);
  ctx.lineTo(size * 0.05, size * 0.15);
  ctx.stroke();

  // 드라이버 팁
  ctx.fillStyle = '#888888';
  ctx.beginPath();
  ctx.moveTo(size * 0.05, size * 0.15);
  ctx.lineTo(size * 0.02, size * 0.08);
  ctx.lineTo(size * 0.08, size * 0.08);
  ctx.closePath();
  ctx.fill();

  // 진행 상태 표시
  const progress = ((time / 1000) % 1) * 100;
  ctx.fillStyle = '#00ff66';
  ctx.font = `${size * 0.1}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(progress)}%`, 0, size * 0.5);

  ctx.restore();
}

// =========================================
// AI CATEGORY SKILLS
// =========================================

/**
 * Neural Net - 뉴런 연결망 (v8.2 Enhanced)
 * 다층 신경망 + 시냅스 전류 흐름 + 학습 데이터 트레일
 */
export function drawNeuralNet(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(18, (p.radius || 14) * 1.3);
  const bounceScale = getSpawnBounce(p);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.AI;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // === 트레일 파티클 (학습 데이터) ===
  const trailTexts = ['LEARN', 'TRAIN', 'WEIGHTS', 'BIAS', 'EPOCH', 'LOSS↓'];
  for (let i = 0; i < 5; i++) {
    const trailAlpha = getTrailAlpha(i, 5);
    const offset = i * 12;
    ctx.save();
    ctx.translate(0, offset);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = colors.accent;
    ctx.font = `bold ${size * 0.18}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }

  // === 펄스 링 (학습 사이클) ===
  const pulsePhase = (time / 800) % 1;
  const pulseRadius = size * 0.6 * (0.5 + pulsePhase * 0.5);
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - pulsePhase;
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, colors.main, 15);

  // === 3층 뉴런 네트워크 ===
  // 입력층 (3노드)
  const inputLayer = [
    { x: -size * 0.4, y: -size * 0.3 },
    { x: -size * 0.4, y: 0 },
    { x: -size * 0.4, y: size * 0.3 },
  ];
  // 은닉층 (4노드)
  const hiddenLayer = [
    { x: 0, y: -size * 0.35 },
    { x: 0, y: -size * 0.12 },
    { x: 0, y: size * 0.12 },
    { x: 0, y: size * 0.35 },
  ];
  // 출력층 (2노드)
  const outputLayer = [
    { x: size * 0.4, y: -size * 0.15 },
    { x: size * 0.4, y: size * 0.15 },
  ];

  // 시냅스 연결선 (전류 흐름 효과)
  ctx.lineWidth = 1.5;

  // 입력 → 은닉
  for (let i = 0; i < inputLayer.length; i++) {
    for (let j = 0; j < hiddenLayer.length; j++) {
      const pulse = Math.sin(time / 80 + i * 2 + j * 3) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(${colors.glow}, ${pulse * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(inputLayer[i].x, inputLayer[i].y);
      ctx.lineTo(hiddenLayer[j].x, hiddenLayer[j].y);
      ctx.stroke();

      // 전류 흐름 점
      if (pulse > 0.7) {
        const flowT = (time / 200 + i + j) % 1;
        const fx = inputLayer[i].x + (hiddenLayer[j].x - inputLayer[i].x) * flowT;
        const fy = inputLayer[i].y + (hiddenLayer[j].y - inputLayer[i].y) * flowT;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 은닉 → 출력
  for (let i = 0; i < hiddenLayer.length; i++) {
    for (let j = 0; j < outputLayer.length; j++) {
      const pulse = Math.sin(time / 70 + i * 3 + j * 2) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(${colors.glow}, ${pulse * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(hiddenLayer[i].x, hiddenLayer[i].y);
      ctx.lineTo(outputLayer[j].x, outputLayer[j].y);
      ctx.stroke();
    }
  }

  // 노드 그리기
  clearGlow(ctx);
  const allNodes = [...inputLayer, ...hiddenLayer, ...outputLayer];
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    const activation = Math.sin(time / 100 + i * 0.5) * 0.5 + 0.5;

    // 활성화 글로우
    if (useGlow && activation > 0.6) {
      applyGlow(ctx, colors.main, 8);
    }

    // 노드 원
    ctx.fillStyle = activation > 0.6 ? colors.main : colors.dark;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size * 0.07, 0, Math.PI * 2);
    ctx.fill();

    clearGlow(ctx);
  }

  // === 중앙 AI 아이콘 ===
  ctx.fillStyle = colors.accent;
  ctx.font = `bold ${size * 0.2}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AI', 0, size * 0.55);

  ctx.restore();
}

/**
 * ChatGPT - 채팅 버블 (v8.2 Enhanced)
 * 대화 인터페이스 + 타이핑 애니메이션 + 응답 스트리밍
 */
export function drawChatGpt(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(16, (p.radius || 12) * 1.3);
  const bounceScale = getSpawnBounce(p);
  const useGlow = shouldUseGlow();
  const gptGreen = '#10a37f';

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // === 트레일 파티클 (대화 키워드) ===
  const trailTexts = ['Hello!', 'Thinking...', 'Sure!', 'Here:', 'Let me', 'I can'];
  for (let i = 0; i < 5; i++) {
    const trailAlpha = getTrailAlpha(i, 5);
    const offset = i * 10;
    ctx.save();
    ctx.translate(0, offset);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = gptGreen;
    ctx.font = `bold ${size * 0.15}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }

  // === 펄스 링 (응답 생성) ===
  const pulsePhase = (time / 600) % 1;
  const pulseRadius = size * 0.55 * (0.5 + pulsePhase * 0.5);
  ctx.strokeStyle = gptGreen;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - pulsePhase;
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (useGlow) applyGlow(ctx, gptGreen, 15);

  // === 채팅 인터페이스 ===
  // 외곽 프레임
  ctx.fillStyle = '#343541';
  ctx.beginPath();
  ctx.roundRect(-size * 0.5, -size * 0.4, size, size * 0.7, 8);
  ctx.fill();

  // 내부 채팅 영역
  ctx.fillStyle = '#444654';
  ctx.beginPath();
  ctx.roundRect(-size * 0.45, -size * 0.35, size * 0.9, size * 0.55, 5);
  ctx.fill();

  clearGlow(ctx);

  // === 스트리밍 텍스트 효과 ===
  const streamChars = '▌';
  const textPhase = Math.floor(time / 100) % 20;
  const displayText = 'AI'.substring(0, Math.min(2, Math.floor(textPhase / 3)));

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.2}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(displayText, -size * 0.35, -size * 0.1);

  // 커서 깜빡임
  if (Math.floor(time / 300) % 2 === 0) {
    ctx.fillStyle = gptGreen;
    const cursorX = -size * 0.35 + displayText.length * size * 0.12;
    ctx.fillText(streamChars, cursorX, -size * 0.1);
  }

  // === 타이핑 인디케이터 (3점) ===
  const dotPhase = Math.floor(time / 150) % 4;
  for (let i = 0; i < 3; i++) {
    const dotY = -size * 0.25 + (dotPhase === i ? -2 : 0);
    ctx.fillStyle = dotPhase === i ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-size * 0.15 + i * size * 0.12, dotY, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  // === GPT 로고 (말풍선 꼬리) ===
  if (useGlow) applyGlow(ctx, gptGreen, 10);
  ctx.fillStyle = gptGreen;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, size * 0.3);
  ctx.lineTo(-size * 0.25, size * 0.5);
  ctx.lineTo(size * 0.05, size * 0.3);
  ctx.closePath();
  ctx.fill();

  // GPT 텍스트
  clearGlow(ctx);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.12}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('GPT', -size * 0.1, size * 0.45);

  // === 오비탈 토큰 ===
  const tokenCount = 4;
  for (let i = 0; i < tokenCount; i++) {
    const angle = (i / tokenCount) * Math.PI * 2 + time / 500;
    const dist = size * 0.6;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist * 0.5; // 이소메트릭 압축

    ctx.fillStyle = gptGreen;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Deepfake - 왜곡된 얼굴 (v8.2 Enhanced)
 * RGB 글리치 분리 + 얼굴 왜곡 + 조작 경고
 */
export function drawDeepfake(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(16, (p.radius || 12) * 1.3);
  const bounceScale = getSpawnBounce(p);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.AI;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // === 트레일 파티클 (조작 키워드) ===
  const trailTexts = ['FAKE', 'SYNTH', 'GAN', 'MORPH', 'CLONE', 'SWAP'];
  for (let i = 0; i < 5; i++) {
    const trailAlpha = getTrailAlpha(i, 5);
    const offset = i * 10;
    const glitchOffset = Math.sin(time / 50 + i) * 3;
    ctx.save();
    ctx.translate(glitchOffset, offset);
    ctx.globalAlpha = trailAlpha;
    // RGB 분리 텍스트
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.font = `bold ${size * 0.14}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], -1, 0);
    ctx.fillStyle = 'rgba(0,255,255,0.5)';
    ctx.fillText(trailTexts[i % trailTexts.length], 1, 0);
    ctx.fillStyle = colors.accent;
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }

  // === 경고 펄스 링 ===
  const pulsePhase = (time / 500) % 1;
  const pulseRadius = size * 0.6 * (0.5 + pulsePhase * 0.5);
  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - pulsePhase;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // === 글리치 오프셋 계산 ===
  const glitchX = Math.sin(time / 25) * 3;
  const glitchY = Math.cos(time / 35) * 2;
  const glitchIntensity = Math.random() > 0.9 ? 5 : 1;

  if (useGlow) applyGlow(ctx, colors.main, 12);

  // === 왜곡된 얼굴 (3중 RGB 분리) ===
  // 빨강 레이어
  ctx.strokeStyle = 'rgba(255,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(glitchX * glitchIntensity, glitchY, size * 0.38, size * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 청록 레이어
  ctx.strokeStyle = 'rgba(0,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-glitchX * glitchIntensity, -glitchY, size * 0.38, size * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 메인 레이어
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.35, size * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();

  clearGlow(ctx);

  // === 눈 (불안정한 애니메이션) ===
  const eyeGlitch = Math.sin(time / 60) * 2;
  const leftEyeX = -size * 0.12 + eyeGlitch;
  const rightEyeX = size * 0.12 - eyeGlitch;

  // 눈 RGB 분리
  ctx.fillStyle = 'rgba(255,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(leftEyeX - 1, -size * 0.08, size * 0.07, 0, Math.PI * 2);
  ctx.arc(rightEyeX - 1, -size * 0.08, size * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(leftEyeX + 1, -size * 0.08, size * 0.07, 0, Math.PI * 2);
  ctx.arc(rightEyeX + 1, -size * 0.08, size * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.main;
  ctx.beginPath();
  ctx.arc(leftEyeX, -size * 0.08, size * 0.06, 0, Math.PI * 2);
  ctx.arc(rightEyeX, -size * 0.08, size * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // === 입 (왜곡된 미소) ===
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 1.5;
  const mouthWave = Math.sin(time / 80);
  ctx.beginPath();
  ctx.moveTo(-size * 0.15, size * 0.12);
  ctx.quadraticCurveTo(0, size * 0.2 + mouthWave * 3, size * 0.15, size * 0.12);
  ctx.stroke();

  // === FAKE 라벨 (깜빡임) ===
  if (Math.floor(time / 400) % 2 === 0) {
    ctx.fillStyle = '#ff3366';
    ctx.font = `bold ${size * 0.18}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('FAKE', 0, size * 0.55);
  }

  // === 스캔라인 글리치 ===
  const scanY = ((time / 100) % 1) * size * 1.2 - size * 0.6;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, scanY);
  ctx.lineTo(size * 0.5, scanY);
  ctx.stroke();

  ctx.restore();
}

/**
 * Singularity Core - AI 특이점 코어 (v8.2 Enhanced)
 * 블랙홀 사건지평선 + 다중 궤도 링 + 무한 에너지 방출
 */
export function drawSingularityCore(params: SkillWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now();
  const size = Math.max(24, (p.radius || 18) * 1.3);
  const bounceScale = getSpawnBounce(p);
  const useGlow = shouldUseGlow();
  const colors = CATEGORY_COLORS.AI;

  ctx.save();
  ctx.rotate(p.angle || 0);
  ctx.scale(1, 0.75); // v9.0: ISO Y축 압축만 적용
  ctx.scale(bounceScale, bounceScale);

  // === 트레일 파티클 (특이점 키워드) ===
  const trailTexts = ['∞', 'AGI', 'ASI', 'OMEGA', 'TRANSCEND', 'BEYOND'];
  for (let i = 0; i < 6; i++) {
    const trailAlpha = getTrailAlpha(i, 6);
    const offset = i * 14;
    const spiralAngle = (time / 200 + i * 0.5) % (Math.PI * 2);
    const spiralX = Math.sin(spiralAngle) * 8;
    ctx.save();
    ctx.translate(spiralX, offset);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = i % 2 === 0 ? colors.main : colors.accent;
    ctx.font = `bold ${size * 0.16}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(trailTexts[i % trailTexts.length], 0, 0);
    ctx.restore();
  }

  // === 다중 펄스 링 (사건지평선 팽창) ===
  for (let r = 0; r < 3; r++) {
    const pulsePhase = ((time / 700) + r * 0.33) % 1;
    const pulseRadius = size * 0.7 * (0.3 + pulsePhase * 0.7);
    ctx.strokeStyle = r === 0 ? colors.main : (r === 1 ? colors.accent : '#fff');
    ctx.lineWidth = 2 - r * 0.5;
    ctx.globalAlpha = (1 - pulsePhase) * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // === 회전 계산 ===
  const rotation = time / 250;

  // === 외곽 사건지평선 (3중 링) ===
  if (useGlow) applyGlow(ctx, colors.main, 25);

  // 외곽 링 1 - 점선
  ctx.save();
  ctx.rotate(rotation);
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 외곽 링 2 - 역회전
  ctx.save();
  ctx.rotate(-rotation * 1.5);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 내곽 링 3 - 빠른 회전
  ctx.save();
  ctx.rotate(rotation * 2.5);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // === 블랙홀 코어 (그라디언트) ===
  clearGlow(ctx);
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.25);
  coreGrad.addColorStop(0, '#000');
  coreGrad.addColorStop(0.4, '#1a0033');
  coreGrad.addColorStop(0.7, colors.main);
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // === 중심 에너지 포인트 ===
  if (useGlow) applyGlow(ctx, '#fff', 15);
  ctx.fillStyle = '#fff';
  const corePulse = 1 + Math.sin(time / 100) * 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.06 * corePulse, 0, Math.PI * 2);
  ctx.fill();
  clearGlow(ctx);

  // === 오비탈 에너지 파티클 (3층) ===
  // 외곽 오비탈 (8개)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + rotation;
    const dist = size * 0.5;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist * 0.6; // 이소메트릭 압축

    ctx.fillStyle = colors.main;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 중간 오비탈 (6개, 역회전)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - rotation * 1.5;
    const dist = size * 0.38;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist * 0.6;

    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 내곽 오비탈 (4개, 빠른 회전)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + rotation * 3;
    const dist = size * 0.22;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist * 0.6;

    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // === 에너지 제트 (상하) ===
  if (useGlow) applyGlow(ctx, colors.main, 10);
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;

  // 상단 제트
  const jetLength = size * 0.4 + Math.sin(time / 80) * size * 0.1;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.2);
  ctx.lineTo(-size * 0.08, -size * 0.2 - jetLength);
  ctx.lineTo(0, -size * 0.2 - jetLength * 1.2);
  ctx.lineTo(size * 0.08, -size * 0.2 - jetLength);
  ctx.closePath();
  ctx.stroke();

  // 하단 제트
  ctx.beginPath();
  ctx.moveTo(0, size * 0.2);
  ctx.lineTo(-size * 0.08, size * 0.2 + jetLength);
  ctx.lineTo(0, size * 0.2 + jetLength * 1.2);
  ctx.lineTo(size * 0.08, size * 0.2 + jetLength);
  ctx.closePath();
  ctx.stroke();

  clearGlow(ctx);

  // === ∞ 심볼 (중앙) ===
  ctx.fillStyle = colors.accent;
  ctx.font = `bold ${size * 0.2}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.5 + Math.sin(time / 200) * 0.3;
  ctx.fillText('∞', 0, 0);

  ctx.globalAlpha = 1;
  ctx.restore();
}
