/**
 * Turret Rendering Module
 * CODE SURVIVOR v4 - 터렛 시각화
 */

import {
  PlacedTurret,
  TurretProjectile,
  TurretAoeEffect,
  RARITY_COLORS,
} from '../../types';
import { getTurretById } from '../../config/arena.config';

// Matrix 색상
const matrixGreen = '#00FF41';
const matrixDarkGreen = '#003B00';
const cyberBlue = '#06b6d4';
const cyberPurple = '#a855f7';

/**
 * 터렛 렌더링 v5.0 - 플레이어 머리 위 떠다니기
 * @param playerPos 플레이어 위치 (머리 위에 떠다니게 할 경우 전달)
 * @param turretIndex 동시에 여러 터렛 있을 때 인덱스 (위치 오프셋용)
 */
export function drawTurret(
  ctx: CanvasRenderingContext2D,
  turret: PlacedTurret,
  time: number,
  playerPos?: { x: number; y: number },
  turretIndex: number = 0
): void {
  const config = getTurretById(turret.configId);
  if (!config) {
    console.warn('[drawTurret] Config not found for turret:', turret.configId);
    return;
  }

  const { spawnAnimation, hitFlash, hp, maxHp } = turret;
  const rarityColors = RARITY_COLORS[config.rarity];

  // v5.0: 플레이어 위치 기반 + 떠다니기 애니메이션
  const SCALE = 0.5; // 50% 크기
  const FLOAT_AMPLITUDE = 4; // 떠다니기 진폭
  const FLOAT_SPEED = 400; // 떠다니기 속도 (낮을수록 빠름)

  // v5.0: Agent는 왼쪽 위, Skill은 오른쪽 위
  const isAgent = config.type === 'agent';
  const AGENT_OFFSET_X = -25; // 왼쪽
  const AGENT_OFFSET_Y = -50; // 살짝 위
  const SKILL_OFFSET_X = 25;  // 오른쪽
  const SKILL_OFFSET_Y = -45; // 위

  // 위치 계산
  let renderX: number;
  let renderY: number;

  if (playerPos) {
    // 플레이어 머리 위에 위치 (타입별 다른 위치)
    const floatOffset = Math.sin(time / FLOAT_SPEED + (isAgent ? 0 : Math.PI * 0.5)) * FLOAT_AMPLITUDE;

    if (isAgent) {
      renderX = playerPos.x + AGENT_OFFSET_X;
      renderY = playerPos.y + AGENT_OFFSET_Y + floatOffset;
    } else {
      renderX = playerPos.x + SKILL_OFFSET_X;
      renderY = playerPos.y + SKILL_OFFSET_Y + floatOffset;
    }
  } else {
    // 기존 월드 좌표 사용 (fallback)
    renderX = turret.x;
    renderY = turret.y;
  }

  ctx.save();
  ctx.translate(renderX, renderY);

  // 50% 크기 스케일 적용
  ctx.scale(SCALE, SCALE);

  // 스폰 애니메이션
  if (spawnAnimation < 1) {
    ctx.globalAlpha = spawnAnimation;
    ctx.scale(spawnAnimation, spawnAnimation);
  }

  // 히트 플래시
  if (hitFlash > 0) {
    ctx.filter = `brightness(${1 + hitFlash})`;
  }

  // 그림자 (작은 크기에 맞게 축소)
  ctx.shadowColor = rarityColors.glow;
  ctx.shadowBlur = (8 + Math.sin(time / 200) * 3) * SCALE;

  // 터렛 타입에 따른 렌더링
  if (config.type === 'agent') {
    drawAgentTurret(ctx, config, time, turret.facingAngle || 0, turret.id);
  } else {
    drawSkillTurret(ctx, config, time);
  }

  // HP 바 (작은 크기에선 생략)
  // if (hp < maxHp) {
  //   drawTurretHpBar(ctx, hp, maxHp, rarityColors.primary);
  // }

  // 등급 표시 (글로우 링) - 작은 크기에서도 표시
  drawRarityRing(ctx, config.rarity, time);

  ctx.restore();
}

// 터렛별 현재 각도 저장 (부드러운 회전용)
const turretCurrentAngles = new Map<string, number>();

/**
 * Agent 터렛 (원거리) 렌더링 - 위에서 바라보는 군용 터렛 스타일
 * @param facingAngle 목표 포신 회전 각도 (라디안)
 * @param turretId 터렛 고유 ID (부드러운 회전용)
 */
function drawAgentTurret(
  ctx: CanvasRenderingContext2D,
  config: any,
  time: number,
  facingAngle: number = 0,
  turretId?: string
): void {
  const rarityColors = RARITY_COLORS[config.rarity];

  // ===== 부드러운 포신 회전 (Lerp) =====
  const id = turretId || 'default';
  let currentAngle = turretCurrentAngles.get(id) ?? facingAngle;

  // 각도 차이 계산 (최단 경로)
  let angleDiff = facingAngle - currentAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // 부드럽게 보간 (lerp factor 0.08 = 천천히, 0.15 = 빠르게)
  const lerpFactor = 0.1;
  currentAngle += angleDiff * lerpFactor;
  turretCurrentAngles.set(id, currentAngle);

  // ===== 1. 베이스 플랫폼 (원형, 회전하지 않음) =====
  const baseRadius = 22;

  // 베이스 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(3, 3, baseRadius + 2, baseRadius + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 베이스 외곽 링
  ctx.fillStyle = '#0a0a15';
  ctx.strokeStyle = rarityColors.border;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 베이스 내부 원 (바닥판)
  const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius - 4);
  innerGrad.addColorStop(0, '#1a1a2e');
  innerGrad.addColorStop(0.7, '#12121f');
  innerGrad.addColorStop(1, '#0a0a15');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius - 4, 0, Math.PI * 2);
  ctx.fill();

  // 베이스 데코 (8방향 볼트)
  ctx.fillStyle = '#2a2a3e';
  for (let i = 0; i < 8; i++) {
    const bAngle = (i * Math.PI * 2) / 8;
    const bx = Math.cos(bAngle) * (baseRadius - 6);
    const by = Math.sin(bAngle) * (baseRadius - 6);
    ctx.beginPath();
    ctx.arc(bx, by, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 2. 회전하는 터렛 상부 (포탑) =====
  ctx.save();
  ctx.rotate(currentAngle);

  // 포탑 몸체 (타원형)
  const turretBodyW = 16;
  const turretBodyH = 20;

  ctx.fillStyle = '#1e1e2e';
  ctx.strokeStyle = rarityColors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, turretBodyW / 2, turretBodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 포탑 상부 디테일 (해치)
  ctx.fillStyle = '#2a2a3e';
  ctx.beginPath();
  ctx.arc(0, 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a3a4e';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ===== 3. 포신 (Gun Barrel) =====
  const barrelLength = 28;
  const barrelWidth = 5;

  // 포신 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-barrelWidth / 2 + 2, -barrelLength - 2, barrelWidth, barrelLength);

  // 포신 몸체
  const barrelGrad = ctx.createLinearGradient(-barrelWidth / 2, 0, barrelWidth / 2, 0);
  barrelGrad.addColorStop(0, '#2a2a3e');
  barrelGrad.addColorStop(0.3, '#4a4a5e');
  barrelGrad.addColorStop(0.5, '#5a5a6e');
  barrelGrad.addColorStop(0.7, '#4a4a5e');
  barrelGrad.addColorStop(1, '#2a2a3e');

  ctx.fillStyle = barrelGrad;
  ctx.fillRect(-barrelWidth / 2, -barrelLength, barrelWidth, barrelLength - 5);

  // 포신 테두리
  ctx.strokeStyle = rarityColors.primary;
  ctx.lineWidth = 1;
  ctx.strokeRect(-barrelWidth / 2, -barrelLength, barrelWidth, barrelLength - 5);

  // 포구 (Muzzle)
  ctx.fillStyle = '#0a0a15';
  ctx.beginPath();
  ctx.arc(0, -barrelLength, barrelWidth / 2 + 1, 0, Math.PI * 2);
  ctx.fill();

  // 포구 발광 (레이저 조준)
  const muzzlePulse = Math.sin(time / 100) * 0.5 + 0.5;
  ctx.fillStyle = matrixGreen;
  ctx.shadowColor = matrixGreen;
  ctx.shadowBlur = 8 + muzzlePulse * 8;
  ctx.beginPath();
  ctx.arc(0, -barrelLength, 2 + muzzlePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 포신 마운트 (회전축 연결부)
  ctx.fillStyle = '#3a3a4e';
  ctx.beginPath();
  ctx.arc(0, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rarityColors.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // ===== 4. 중앙 회전축 (항상 위에) =====
  ctx.fillStyle = rarityColors.primary;
  ctx.shadowColor = rarityColors.glow;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 중앙 코어 하이라이트
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(-2, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ===== 5. 조준 레이저 (포신 방향으로) =====
  ctx.save();
  ctx.rotate(currentAngle);

  const laserLength = 60;
  const laserPulse = Math.sin(time / 80) * 0.3 + 0.7;

  ctx.strokeStyle = `rgba(0, 255, 65, ${0.15 * laserPulse})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(0, -barrelLength - 5);
  ctx.lineTo(0, -barrelLength - laserLength);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

/**
 * Skill 터렛 (근접 AOE) 렌더링
 */
function drawSkillTurret(
  ctx: CanvasRenderingContext2D,
  config: any,
  time: number
): void {
  const rarityColors = RARITY_COLORS[config.rarity];
  const pulseScale = 1 + Math.sin(time / 200) * 0.08;

  // 베이스 (원형)
  ctx.fillStyle = '#1a1a2e';
  ctx.strokeStyle = rarityColors.border;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 28 * pulseScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 내부 에너지 링
  const ringRotation = time / 300;
  ctx.save();
  ctx.rotate(ringRotation);

  ctx.strokeStyle = rarityColors.primary;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // 중앙 코어
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
  gradient.addColorStop(0, rarityColors.primary);
  gradient.addColorStop(0.5, rarityColors.glow);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();

  // 에너지 파동 (외부로 확장)
  const waveRadius = 30 + ((time / 10) % 30);
  const waveAlpha = 1 - (waveRadius - 30) / 30;
  ctx.strokeStyle = `rgba(${hexToRgb(rarityColors.primary)}, ${waveAlpha * 0.5})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 심볼 (Skill 타입 표시)
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', 0, 0);
}

/**
 * 등급 링 렌더링
 */
function drawRarityRing(
  ctx: CanvasRenderingContext2D,
  rarity: string,
  time: number
): void {
  const rarityColors = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS];

  // Legendary/Mythic 특수 효과
  if (rarity === 'legendary' || rarity === 'mythic') {
    const particleCount = rarity === 'mythic' ? 8 : 5;
    const orbitRadius = 35;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i * Math.PI * 2) / particleCount + time / 500;
      const px = Math.cos(angle) * orbitRadius;
      const py = Math.sin(angle) * orbitRadius;

      ctx.fillStyle = rarityColors.glow;
      ctx.shadowColor = rarityColors.glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * HP 바 렌더링
 */
function drawTurretHpBar(
  ctx: CanvasRenderingContext2D,
  hp: number,
  maxHp: number,
  color: string
): void {
  const barWidth = 40;
  const barHeight = 4;
  const hpPercent = hp / maxHp;

  // 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(-barWidth / 2, 35, barWidth, barHeight);

  // HP
  ctx.fillStyle = hpPercent > 0.5 ? matrixGreen : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(-barWidth / 2, 35, barWidth * hpPercent, barHeight);

  // 테두리
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(-barWidth / 2, 35, barWidth, barHeight);
}

/**
 * 터렛 투사체 렌더링
 */
export function drawTurretProjectile(
  ctx: CanvasRenderingContext2D,
  projectile: TurretProjectile,
  time: number
): void {
  const { x, y, abilityType, color, radius, isBeam, beamWidth, startX, startY, targetX, targetY } = projectile;

  ctx.save();

  // 빔 타입
  if (isBeam && startX !== undefined && startY !== undefined) {
    drawBeamProjectile(ctx, startX, startY, x, y, color, beamWidth || 8, time);
    ctx.restore();
    return;
  }

  // 박격포
  if (abilityType === 'mortar') {
    drawMortarProjectile(ctx, x, y, radius, color, time);
    ctx.restore();
    return;
  }

  ctx.translate(x, y);

  // 글로우
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // 기본 투사체
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // 유도 미사일 추가 효과
  if (abilityType === 'homing_projectile') {
    // 트레일
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-projectile.vx * 0.05, -projectile.vy * 0.05);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * 빔 투사체 렌더링
 */
function drawBeamProjectile(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string,
  width: number,
  time: number
): void {
  const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.1, color);
  gradient.addColorStop(0.9, color);
  gradient.addColorStop(1, 'transparent');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // 빔 중심 밝은 선
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = width / 3;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

/**
 * 박격포 투사체 렌더링
 */
function drawMortarProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // 그림자 (착탄 지점)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 30, radius * 0.5, radius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 투사체
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // 꼬리 불꽃
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-5, 20);
  ctx.lineTo(5, 20);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * AOE 효과 렌더링
 */
export function drawTurretAoeEffect(
  ctx: CanvasRenderingContext2D,
  effect: TurretAoeEffect,
  time: number
): void {
  const { x, y, radius, color, life, maxLife, abilityType } = effect;
  const progress = 1 - life / maxLife;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.max(0, 1 - progress * 0.5);

  switch (abilityType) {
    case 'aoe_pulse':
      drawPulseEffect(ctx, radius, color, progress, time);
      break;

    case 'spinning_blade':
      drawSpinningBladeEffect(ctx, radius, color, effect.rotation || 0, time);
      break;

    case 'gravity_well':
      drawGravityWellEffect(ctx, radius, color, time);
      break;

    case 'flame_burst':
      drawFlameEffect(ctx, radius, color, progress, time);
      break;

    case 'meltdown':
      drawLavaEffect(ctx, radius, color, time);
      break;

    case 'expanding_wave':
      drawExpandingWaveEffect(ctx, radius, color, progress, time);
      break;

    case 'rift':
      drawRiftEffect(ctx, radius, color, time);
      break;

    case 'screen_nuke':
      drawScreenNukeEffect(ctx, progress, time);
      break;

    default:
      drawDefaultAoeEffect(ctx, radius, color, progress);
  }

  ctx.restore();
}

// AOE 효과 개별 렌더링 함수들

function drawPulseEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  progress: number,
  time: number
): void {
  const currentRadius = radius * (0.5 + progress * 0.5);
  const alpha = 1 - progress;

  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * (1 - progress);
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;

  ctx.beginPath();
  ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 원
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpinningBladeEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  rotation: number,
  time: number
): void {
  ctx.save();
  ctx.rotate((rotation * Math.PI) / 180);

  // 4개의 날
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 0.2, -radius * 0.8);
    ctx.lineTo(0, -radius);
    ctx.lineTo(-radius * 0.2, -radius * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // 중심
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGravityWellEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  time: number
): void {
  // 나선형 패턴
  const spiralCount = 3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  for (let s = 0; s < spiralCount; s++) {
    const offset = (s * Math.PI * 2) / spiralCount + time / 300;
    ctx.beginPath();
    for (let i = 0; i < 50; i++) {
      const angle = offset + (i * Math.PI) / 10;
      const r = (radius * i) / 50;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 중심 구멍
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlameEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  progress: number,
  time: number
): void {
  // 불꽃 파티클
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i * Math.PI * 2) / particleCount + time / 100;
    const dist = radius * (0.3 + Math.random() * 0.7);
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist - Math.random() * 20;

    const gradient = ctx.createRadialGradient(px, py, 0, px, py, 15);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.3, color);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLavaEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  time: number
): void {
  // 용암 웅덩이
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, '#ff6b00');
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(0.8, '#8b0000');
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // 버블 효과
  const bubbleCount = 5;
  for (let i = 0; i < bubbleCount; i++) {
    const angle = (i * Math.PI * 2) / bubbleCount + time / 500;
    const dist = radius * 0.5 * Math.random();
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;
    const bubbleSize = 3 + Math.sin(time / 100 + i) * 2;

    ctx.fillStyle = '#ff9500';
    ctx.beginPath();
    ctx.arc(px, py, bubbleSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExpandingWaveEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  progress: number,
  time: number
): void {
  // 확산 링
  ctx.strokeStyle = color;
  ctx.lineWidth = 6 * (1 - progress * 0.5);
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 내부 링
  if (radius > 50) {
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRiftEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  time: number
): void {
  // 차원 균열
  ctx.save();
  ctx.rotate(time / 500);

  // 불규칙한 형태
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const r = radius * (0.8 + Math.sin(time / 100 + i) * 0.2);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // 중심 블랙홀
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.5);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScreenNukeEffect(
  ctx: CanvasRenderingContext2D,
  progress: number,
  time: number
): void {
  // 화면 전체 플래시 (실제로는 화면 크기에 맞게)
  ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.8})`;
  ctx.fillRect(-2000, -2000, 4000, 4000);
}

function drawDefaultAoeEffect(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  progress: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1 - progress;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 설치 모드 오버레이 렌더링
 */
export function drawPlacementOverlay(
  ctx: CanvasRenderingContext2D,
  playerX: number,
  playerY: number,
  cursorX: number,
  cursorY: number,
  placementRadius: number,
  isValid: boolean,
  turretType: 'agent' | 'skill',
  time: number
): void {
  ctx.save();

  // 설치 가능 범위
  ctx.strokeStyle = isValid ? matrixGreen : '#ef4444';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.globalAlpha = 0.5 + Math.sin(time / 200) * 0.2;

  ctx.beginPath();
  ctx.arc(playerX, playerY, placementRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 커서 위치 미리보기
  if (cursorX !== null && cursorY !== null) {
    ctx.translate(cursorX, cursorY);

    // 유효성에 따른 색상
    const previewColor = isValid ? matrixGreen : '#ef4444';
    ctx.globalAlpha = 0.6;

    // 터렛 미리보기 (간단한 형태)
    if (turretType === 'agent') {
      // 원형 베이스
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();

      // 포탑 몸체
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 포신
      ctx.fillStyle = previewColor;
      ctx.fillRect(-2.5, -28, 5, 23);

      // 포구
      ctx.beginPath();
      ctx.arc(0, -28, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 원형
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();

      // S 마크
      ctx.fillStyle = previewColor;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 0);
    }

    // 십자선
    ctx.strokeStyle = previewColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(-10, 0);
    ctx.moveTo(10, 0);
    ctx.lineTo(40, 0);
    ctx.moveTo(0, -40);
    ctx.lineTo(0, -10);
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 40);
    ctx.stroke();
  }

  ctx.restore();
}

// 유틸리티: hex to rgb
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 255, 255';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
