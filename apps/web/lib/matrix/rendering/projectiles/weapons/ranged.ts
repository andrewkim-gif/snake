/**
 * game/rendering/projectiles/weapons/ranged.ts - 원거리 무기 렌더링
 * v4.9: 스타일리시 이펙트 시스템 적용 - 이징, 글로우, 트레일, 펄스
 * v6.0: 아이소메트릭 Z축 물리 + 그림자 렌더링
 * v7.20: 성능 최적화 - easing 통합 모듈 사용, time 파라미터화
 *
 * Git Push (knife), GraphQL Query (bow), Ping 패킷 (ping), 유리파편 (shard),
 * NPM Install (airdrop), 삼지창 (fork)
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
 * Git Push - 커밋 해시 발사체
 * v4.9: easeOutBack 바운스 + matrix 글로우 프리셋 + 코드 파티클 트레일
 * v7.15: 성능 최적화 - 트레일/글로우 레이어/shadowBlur 대폭 감소
 */
export function drawKnife(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const knifeRot = p.currentRotation !== undefined ? p.currentRotation : p.angle;
  const useGlow = shouldUseGlow();

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // v4 컬러 팔레트 (매트릭스 스타일)
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#a78bfa' : '#00FF41');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '167, 139, 250' : '0, 255, 65');

  // 크기 계산 with easeOutBack
  const baseSize = Math.max(8, (p.radius || 5) * 2.5);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const appearProgress = Math.max(0, Math.min(1, (1 - lifeRatio) * 4));
  const bounceScale = Math.max(0.1, EASING.easeOutBack(appearProgress));
  const commitSize = Math.max(4, baseSize * bounceScale);

  ctx.save();
  applyIsoProjectileTransform(ctx, knifeRot); // v7.20: 아이소메트릭 3D 원근감

  // ===== 트레일 시스템 (v7.34: 개수 증가 5/4/3, 알파값 0.85) =====
  const trailChars = ['git', 'push', '-f'];
  const trailCount = isUltimate ? 5 : (isEvolved ? 4 : 3);

  // v7.34: 트레일 개수 증가 (4/3/2 → 5/4/3), 알파값 증가 (0.6 → 0.85)
  for (let i = trailCount; i >= 1; i--) {
    const trailEase = EASING.easeOutExpo(1 - i / trailCount);
    const offsetX = -i * 14 * trailEase;
    const waveY = Math.sin(time / 100 + i) * 4;
    const alpha = 0.85 * (1 - i / trailCount);

    ctx.font = `bold ${9 - i}px monospace`;
    ctx.fillStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.fillText(trailChars[i % trailChars.length], offsetX, waveY);
  }

  // ===== 펄스 링 (v7.34: 알파값 0.35 → 0.55, lineWidth 증가) =====
  const pulsePhase = (time / 200) % 1;
  const pulseRadius = commitSize * (1.2 + pulsePhase * 0.6);
  const pulseAlpha = (1 - pulsePhase) * 0.55;

  ctx.strokeStyle = `rgba(${glowColorRgba}, ${pulseAlpha})`;
  ctx.lineWidth = 2.5 * (1 - pulsePhase);
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 메인 커밋 노드 (v7.34: 글로우 알파 0.3→0.5, shadowBlur 12→16) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5 * bounceScale;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, commitSize * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 커밋 원 본체 (단색)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, 0, commitSize, 0, Math.PI * 2);
  ctx.fill();

  // 테두리 (v7.34: shadowBlur 8→12, lineWidth 3→3.5)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== Git 브랜치 라인 =====
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(commitSize, 0);
  ctx.lineTo(commitSize + 12, 0);
  ctx.stroke();

  // 화살표 머리
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(commitSize + 16, 0);
  ctx.lineTo(commitSize + 10, -4);
  ctx.lineTo(commitSize + 10, 4);
  ctx.closePath();
  ctx.fill();

  // 뒤쪽 브랜치 라인 (v7.34: 알파값 0.4 → 0.6)
  ctx.strokeStyle = `rgba(${glowColorRgba}, 0.6)`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(-commitSize, 0);
  ctx.lineTo(-commitSize - 15, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // ===== 커밋 해시 텍스트 =====
  const hashes = isUltimate ? ['HEAD', 'main'] : (isEvolved ? ['merge', 'dev'] : ['push', 'git']);
  const hashIndex = Math.floor(time / 500) % hashes.length;

  ctx.font = 'bold 7px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(hashes[hashIndex], 0, 1);

  // ===== Diff 표시 (v7.15: shadowBlur 제거) =====
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('+' + (isUltimate ? '99' : isEvolved ? '42' : '7'), -commitSize - 6, -8);

  ctx.fillStyle = '#ef4444';
  ctx.fillText('-' + (isUltimate ? '0' : isEvolved ? '3' : '2'), -commitSize - 6, 8);

  // ===== 진화/궁극 브랜치 이펙트 (v7.15: shadowBlur 제거) =====
  if (isEvolved || isUltimate) {
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;

    // 위쪽 브랜치
    ctx.beginPath();
    ctx.moveTo(-commitSize * 0.7, -commitSize * 0.7);
    ctx.quadraticCurveTo(-commitSize - 4, -8, -commitSize - 10, -12);
    ctx.stroke();

    // 아래쪽 브랜치
    ctx.beginPath();
    ctx.moveTo(-commitSize * 0.7, commitSize * 0.7);
    ctx.quadraticCurveTo(-commitSize - 4, 8, -commitSize - 10, 12);
    ctx.stroke();

    // 작은 커밋 노드들
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(-commitSize - 10, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-commitSize - 10, 12, 4, 0, Math.PI * 2);
    ctx.fill();

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-knifeRot);
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#ef4444';
      ctx.strokeText('--force', 0, -commitSize - 10);
      ctx.fillText('--force', 0, -commitSize - 10);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * GraphQL Query - 핑크 쿼리 발사체
 * v4.9: 이징 트레일 + electric 글로우 + 쿼리 텍스트 파티클
 * v7.15: 성능 최적화 - 트레일/글로우 레이어/shadowBlur 감소
 */
export function drawBow(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle); // v7.20: 아이소메트릭 3D 원근감

  const isEvolved = p.isEvolved;
  const isUltimate = p.isUltimate;

  // GraphQL 핑크 팔레트
  const mainColor = isUltimate ? '#fcd34d' : (isEvolved ? '#f472b6' : '#e535ab');
  const glowColorRgba = isUltimate ? '252, 211, 77' : (isEvolved ? '244, 114, 182' : '229, 53, 171');

  const bowSize = Math.max(6, (p.radius || 3) * 2);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));
  const appearEase = Math.max(0.1, EASING.easeOutElastic(Math.max(0, Math.min(1, (1 - lifeRatio) * 3))));
  const scale = Math.max(4, bowSize * appearEase);

  // ===== 쿼리 텍스트 트레일 (v7.34: 개수 증가, 알파값 0.5→0.75) =====
  const queryParts = ['query', '{', 'user', '}'];
  const trailCount = isUltimate ? 4 : (isEvolved ? 3 : 2);

  for (let i = trailCount; i >= 1; i--) {
    const trailEase = EASING.easeOutExpo(1 - i / trailCount);
    const offsetX = -i * 12 * trailEase;
    const alpha = 0.75 * (1 - i / trailCount);

    ctx.font = `bold ${8 - i}px monospace`;
    ctx.fillStyle = `rgba(${glowColorRgba}, ${alpha})`;
    ctx.fillText(queryParts[i % queryParts.length], offsetX, 0);
  }

  // ===== 펄스 링 (v7.34: 알파값 0.4→0.6, lineWidth 증가) =====
  const pulsePhase = (time / 180) % 1;
  ctx.strokeStyle = `rgba(${glowColorRgba}, ${(1 - pulsePhase) * 0.6})`;
  ctx.lineWidth = 2.5 * (1 - pulsePhase);
  ctx.beginPath();
  ctx.arc(0, 0, scale + pulsePhase * 12, 0, Math.PI * 2);
  ctx.stroke();

  // ===== 메인 GraphQL 로고 (v7.34: 글로우 알파 0.3→0.5, shadowBlur 10→14) =====
  if (useGlow) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * scale * 1.15;
      const y = Math.sin(angle) * scale * 1.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 메인 노드 (단색)
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * scale;
    const y = Math.sin(angle) * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // 테두리 (v7.34: shadowBlur 8→12, lineWidth 2→2.5)
  if (useGlow) {
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 내부 연결선 (v7.34: 알파값 0.5→0.7)
  ctx.strokeStyle = `rgba(255, 255, 255, 0.7)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const angle1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const angle2 = ((i + 3) / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle1) * scale * 0.5, Math.sin(angle1) * scale * 0.5);
    ctx.lineTo(Math.cos(angle2) * scale * 0.5, Math.sin(angle2) * scale * 0.5);
    ctx.stroke();
  }

  // 중앙 노드
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, scale * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // ===== 진화/궁극 (v7.15: shadowBlur 제거) =====
  if (isEvolved || isUltimate) {
    const orbitalCount = isUltimate ? 3 : 2;
    for (let o = 0; o < orbitalCount; o++) {
      const oAngle = (time / 300 + o * Math.PI * 2 / orbitalCount) % (Math.PI * 2);
      const ox = Math.cos(oAngle) * (scale + 8);
      const oy = Math.sin(oAngle) * (scale + 8);

      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(ox, oy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isUltimate) {
      ctx.save();
      ctx.rotate(-p.angle);
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.fillText('MUTATION', 0, -scale - 8);
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
 * 유리 파편 - 창문 유리
 * v4.9: 회전 이징 + 반사광 글로우 + 깨짐 이펙트
 * v7.15: 성능 최적화 - 트레일/shadowBlur/gradient 감소
 */
export function drawShard(params: RangedWeaponParams): void {
  const { ctx, p, time: frameTime } = params;
  const time = frameTime ?? Date.now(); // v7.20: 외부에서 전달받거나 폴백
  const useGlow = shouldUseGlow();

  ctx.save();
  applyIsoProjectileTransform(ctx, p.angle); // v7.20: 아이소메트릭 3D 원근감

  const shardSize = Math.max(15, p.radius * 1.5);
  const lifeRatio = Math.max(0, Math.min(1, p.life / (p.startLife || 1)));

  // 회전 with 이징 (점점 느려지는 회전)
  const spinProgress = Math.max(0, Math.min(1, 1 - lifeRatio));
  const spinEase = EASING.easeOutExpo(spinProgress);
  const spin = spinEase * Math.PI * 6;
  ctx.rotate(spin);

  // ===== 잔상 트레일 (v7.34: 개수 3, 알파값 증가) =====
  for (let t = 3; t >= 1; t--) {
    const trailAlpha = (1 - t / 4) * 0.5;
    const trailSpin = spin - t * 0.3;

    ctx.save();
    ctx.rotate(-spin + trailSpin);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = 'rgba(147, 197, 253, 0.7)';
    ctx.beginPath();
    ctx.moveTo(shardSize * 0.8, 0);
    ctx.lineTo(shardSize * 0.2, -shardSize * 0.6);
    ctx.lineTo(-shardSize * 0.3, -shardSize * 0.2);
    ctx.lineTo(-shardSize * 0.2, shardSize * 0.3);
    ctx.lineTo(shardSize * 0.15, shardSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ===== 메인 유리 파편 (v7.34: shadowBlur 10→14, 알파값 증가) =====
  if (useGlow) {
    ctx.shadowColor = '#93c5fd';
    ctx.shadowBlur = 14;
  }

  // 유리 본체 (v7.34: 알파값 0.75→0.88)
  ctx.fillStyle = 'rgba(147, 197, 253, 0.88)';
  ctx.beginPath();
  ctx.moveTo(shardSize, 0);
  ctx.lineTo(shardSize * 0.3, -shardSize * 0.8);
  ctx.lineTo(-shardSize * 0.5, -shardSize * 0.3);
  ctx.lineTo(-shardSize * 0.4, shardSize * 0.4);
  ctx.lineTo(shardSize * 0.2, shardSize * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ===== 반사광 (애니메이션) (v7.34: 알파값 증가) =====
  const reflectPhase = (time / 200) % 1;
  const reflectX = -shardSize * 0.3 + reflectPhase * shardSize * 0.6;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.moveTo(reflectX, -shardSize * 0.3);
  ctx.lineTo(reflectX + shardSize * 0.2, -shardSize * 0.5);
  ctx.lineTo(reflectX + shardSize * 0.1, -shardSize * 0.15);
  ctx.closePath();
  ctx.fill();

  // 반짝임 포인트 (v7.34: 크기/알파 증가)
  const sparkle = Math.sin(time / 80) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + sparkle * 0.5})`;
  ctx.beginPath();
  ctx.arc(shardSize * 0.5, -shardSize * 0.2, 3 + sparkle * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // ===== 균열 라인 (v7.34: 알파값 0.5→0.7) =====
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(shardSize * 0.5, shardSize * 0.25);
  ctx.moveTo(0, 0);
  ctx.lineTo(-shardSize * 0.25, -shardSize * 0.35);
  ctx.moveTo(0, 0);
  ctx.lineTo(shardSize * 0.15, -shardSize * 0.4);
  ctx.stroke();

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
