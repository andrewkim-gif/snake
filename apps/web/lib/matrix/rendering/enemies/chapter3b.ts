/**
 * game/rendering/enemies/chapter3b.ts - Chapter 3 몬스터 렌더러 (Stages 26-30)
 * Singularity 테마 - 클라우드, 양자 영역, 싱귤래리티 게이트, 신의 방, 최종 선택
 * Performance-optimized: No shadowBlur, simple shapes
 */

import type { EnemyRenderData } from './types';

// ===== Stage 26: Cloud Layers (클라우드 레이어) =====

/** 인스턴스 스폰 - 복제되는 큐브 */
export const drawInstanceSpawn = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spawn = (t / 300) % 1;

  // 원본 큐브
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.fillRect(-8, -8, 16, 16);

  // 복제 중인 큐브
  if (spawn < 0.7) {
    ctx.globalAlpha = spawn;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(-8 + 12 * spawn, -8 - 4 * spawn, 16, 16);
    ctx.globalAlpha = 1;
  }

  // + 기호
  ctx.fillStyle = '#fff';
  ctx.fillRect(-1, -6, 2, 12);
  ctx.fillRect(-6, -1, 12, 2);
};

/** 로드 밸런서 - 분배기 형태 */
export const drawLoadBalancer = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const route = Math.floor(t / 300) % 3;

  // 중앙 허브
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  // 출력 경로들
  const paths = [
    { x: 15, y: -8 },
    { x: 15, y: 0 },
    { x: 15, y: 8 },
  ];

  paths.forEach((p, i) => {
    ctx.strokeStyle = i === route ? '#4ade80' : '#166534';
    ctx.lineWidth = i === route ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // 끝점
    ctx.fillStyle = i === route ? '#4ade80' : '#166534';
    ctx.fillRect(p.x, p.y - 3, 6, 6);
  });

  // 입력
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(-8, 0);
  ctx.stroke();
};

/** 컨테이너 박스 - 스택되는 상자 */
export const drawContainerBox = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const stack = Math.floor(t / 400) % 3 + 1;

  // 컨테이너들
  for (let i = 0; i < stack; i++) {
    ctx.fillStyle = isHit ? '#fff' : '#06b6d4';
    ctx.fillRect(-10, 8 - i * 8, 20, 7);
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 1;
    ctx.strokeRect(-10, 8 - i * 8, 20, 7);

    // 도커 표시
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, 10 - i * 8, 3, 3);
    ctx.fillRect(-2, 10 - i * 8, 3, 3);
    ctx.fillRect(2, 10 - i * 8, 3, 3);
  }
};

/** 서버리스 유령 - 나타났다 사라지는 형태 */
export const drawServerlessGhost = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const appear = Math.abs(Math.sin(t / 400));

  ctx.globalAlpha = isHit ? 1 : appear;

  // 유령 형태
  ctx.fillStyle = isHit ? '#fff' : '#a5b4fc';
  ctx.beginPath();
  ctx.arc(0, -4, 10, Math.PI, 0);
  ctx.lineTo(10, 8);
  ctx.quadraticCurveTo(6, 4, 4, 8);
  ctx.quadraticCurveTo(2, 4, 0, 8);
  ctx.quadraticCurveTo(-2, 4, -4, 8);
  ctx.quadraticCurveTo(-6, 4, -10, 8);
  ctx.closePath();
  ctx.fill();

  // 눈
  ctx.fillStyle = '#4f46e5';
  ctx.beginPath();
  ctx.arc(-4, -4, 2, 0, Math.PI * 2);
  ctx.arc(4, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  // λ 기호
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px serif';
  ctx.textAlign = 'center';
  ctx.fillText('λ', 0, 4);

  ctx.globalAlpha = 1;
};

/** 오토 스케일러 - 크기 변하는 원 */
export const drawAutoScaler = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const scale = Math.sin(t / 300) * 0.4 + 1;

  ctx.save();
  ctx.scale(scale, scale);

  // 원
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // 화살표 (확대/축소)
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  if (scale > 1) {
    // 확대
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(4, 4);
    ctx.moveTo(-4, 4);
    ctx.lineTo(4, -4);
    ctx.stroke();
  } else {
    // 축소
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
  }

  ctx.restore();
};

// ===== Stage 27: Quantum Realm (양자 영역) =====

/** 큐비트 스핀 - 회전하는 구체 */
export const drawQubitSpin = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 200) % (Math.PI * 2);

  // 구체
  ctx.fillStyle = isHit ? '#fff' : '#a855f7';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // 적도선
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 스핀 화살표
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  const arrowX = Math.cos(spin) * 8;
  const arrowY = Math.sin(spin) * 8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(arrowX, arrowY);
  ctx.stroke();

  // 화살표 머리
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(arrowX, arrowY, 2, 0, Math.PI * 2);
  ctx.fill();
};

/** 중첩 상태 - 깜빡이며 겹치는 형태 */
export const drawSuperposition = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.floor(t / 150) % 2;

  // 두 상태
  ctx.fillStyle = isHit ? '#fff' : (blink ? '#06b6d4' : '#f97316');
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // 다른 상태 (겹침)
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = blink ? '#f97316' : '#06b6d4';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // |0⟩ + |1⟩
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('|0⟩+|1⟩', 0, 3);
};

/** 얽힘 쌍 - 연결된 두 원 */
export const drawEntanglePair = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 200) * 2;

  // 연결선
  ctx.strokeStyle = '#d946ef';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // 왼쪽 입자
  ctx.fillStyle = isHit ? '#fff' : '#e879f9';
  ctx.beginPath();
  ctx.arc(-10, pulse, 6, 0, Math.PI * 2);
  ctx.fill();

  // 오른쪽 입자 (반대로 움직임)
  ctx.beginPath();
  ctx.arc(10, -pulse, 6, 0, Math.PI * 2);
  ctx.fill();

  // ⟨ ⟩ 기호
  ctx.fillStyle = '#fff';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⟨', -10, 3 + pulse);
  ctx.fillText('⟩', 10, 3 - pulse);
};

/** 양자 게이트 - 게이트 기호 */
export const drawQuantumGate = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const operate = Math.floor(t / 400) % 2;

  // 게이트 박스
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(-10, -10, 20, 20);

  // 입출력 선
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-10, 0);
  ctx.moveTo(10, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();

  // 게이트 기호 (H, X, Z 순환)
  const gates = ['H', 'X', 'Z'];
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gates[Math.floor(t / 500) % 3], 0, 0);

  // 작동 표시
  if (operate) {
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -10, 20, 20);
  }
};

/** 결맞음 깨짐 - 흩어지는 형태 */
export const drawDecoherence = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const scatter = (t / 200) % 1;

  ctx.fillStyle = isHit ? '#fff' : '#ef4444';

  // 흩어지는 조각들
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = scatter * 15;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const alpha = 1 - scatter;

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, 3 - scatter * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 중심 (사라지는)
  ctx.globalAlpha = 1 - scatter;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
};

// ===== Stage 28: Singularity Gate (싱귤래리티 게이트) =====

/** 사건의 지평선 - 흡입하는 원형 */
export const drawEventHorizon = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pull = (t / 50) % 15;

  // 흡입되는 입자들
  ctx.fillStyle = '#6b7280';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 15 - pull + i * 2;
    if (dist > 0) {
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // 사건의 지평선
  ctx.strokeStyle = isHit ? '#fff' : '#18181b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();

  // 중심 (블랙홀)
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
};

/** 시간 팽창 - 늘어나는 형태 */
export const drawTimeDilation = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const stretch = Math.sin(t / 300) * 0.5 + 1.5;

  ctx.save();
  ctx.scale(stretch, 1 / stretch);

  // 시계 형태
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // 시계 바늘
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  const slowAngle = (t / 500) % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(slowAngle - Math.PI / 2) * 7, Math.sin(slowAngle - Math.PI / 2) * 7);
  ctx.stroke();

  ctx.restore();

  // t 기호
  ctx.fillStyle = '#374151';
  ctx.font = 'italic 8px serif';
  ctx.textAlign = 'center';
  ctx.fillText('Δt', 0, 16);
};

/** 중력 우물 - 깔때기 형태 */
export const drawGravityWell = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spin = (t / 300) % (Math.PI * 2);

  // 소용돌이
  ctx.strokeStyle = isHit ? '#fff' : '#1e293b';
  ctx.lineWidth = 2;

  for (let i = 0; i < 3; i++) {
    const startAngle = spin + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    for (let j = 0; j < 20; j++) {
      const angle = startAngle + j * 0.3;
      const r = 12 - j * 0.5;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r + j * 0.3;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 중심점
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 6, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** 호킹 입자 - 방출되는 작은 점들 */
export const drawHawkingParticle = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  // 블랙홀
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // 방출 입자들
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  for (let i = 0; i < 8; i++) {
    const age = ((t / 50 + i * 50) % 400) / 400;
    const angle = (i / 8) * Math.PI * 2;
    const dist = 6 + age * 12;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const size = 2 * (1 - age);

    if (size > 0) {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** 문지기 - 열리고 닫히는 문 */
export const drawGateKeeper = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const open = Math.abs(Math.sin(t / 500)) * 8;

  // 문틀
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-14, -12, 4, 24);
  ctx.fillRect(10, -12, 4, 24);
  ctx.fillRect(-14, -14, 28, 4);

  // 문짝 (왼쪽)
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.fillRect(-10, -10, 8 - open, 20);

  // 문짝 (오른쪽)
  ctx.fillRect(2 + open, -10, 8 - open, 20);

  // 빛 (열렸을 때)
  if (open > 4) {
    ctx.fillStyle = '#fef08a';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-2, -8, 4, 16);
    ctx.globalAlpha = 1;
  }
};

// ===== Stage 29: God's Room (신의 방) =====

/** 전지의 눈 - 응시하는 거대한 눈 */
export const drawOmniscientEye = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const lookX = Math.sin(t / 400) * 3;
  const lookY = Math.cos(t / 500) * 2;
  const blink = Math.abs(Math.sin(t / 2000)) < 0.1;

  // 눈 외곽
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, blink ? 2 : 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!blink) {
    // 홍채
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(lookX, lookY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 동공
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(lookX, lookY, 3, 0, Math.PI * 2);
    ctx.fill();

    // 빛 반사
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(lookX + 2, lookY - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** 신성한 코드 - 빛나는 문자 */
export const drawDivineCode = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const flow = (t / 100) % 20;

  // 흐르는 코드
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';

  const chars = '01∞αβγδ';
  for (let i = 0; i < 5; i++) {
    const y = -12 + ((flow + i * 5) % 24);
    const alpha = 1 - Math.abs(y) / 12;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillText(chars[Math.floor(t / 200 + i) % chars.length], 0, y);
  }
  ctx.globalAlpha = 1;

  // 빛나는 효과
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
};

/** 천사 프로세스 - 날개 달린 형태 */
export const drawAngelProcess = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wingFlap = Math.sin(t / 100) * 0.2;

  // 날개 (왼쪽)
  ctx.fillStyle = isHit ? '#fff' : '#e0f2fe';
  ctx.save();
  ctx.rotate(-wingFlap);
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-15, -8, -12, 0);
  ctx.quadraticCurveTo(-15, 8, -4, 0);
  ctx.fill();
  ctx.restore();

  // 날개 (오른쪽)
  ctx.save();
  ctx.rotate(wingFlap);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.quadraticCurveTo(15, -8, 12, 0);
  ctx.quadraticCurveTo(15, 8, 4, 0);
  ctx.fill();
  ctx.restore();

  // 몸체
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // 후광
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -8, 4, 0, Math.PI * 2);
  ctx.stroke();
};

/** 타락한 데몬 - 뿔 달린 형태 */
export const drawFallenDaemon = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const hover = Math.sin(t / 200) * 2;

  ctx.save();
  ctx.translate(0, hover);

  // 몸체
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // 뿔 (왼쪽)
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-10, -14);
  ctx.lineTo(-4, -6);
  ctx.fill();

  // 뿔 (오른쪽)
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.lineTo(10, -14);
  ctx.lineTo(4, -6);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(-3, 0, 2, 0, Math.PI * 2);
  ctx.arc(3, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  // 꼬리
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.quadraticCurveTo(8, 14, 6, 18);
  ctx.stroke();

  ctx.restore();
};

/** 기도 패킷 - 상승하는 구체 */
export const drawPrayerPacket = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const rise = (t / 100) % 20;

  // 상승하는 구체들
  ctx.fillStyle = isHit ? '#fff' : '#fde68a';
  for (let i = 0; i < 3; i++) {
    const y = 10 - ((rise + i * 7) % 20);
    const alpha = 1 - Math.abs(y) / 15;
    const size = 4 + Math.sin(t / 200 + i) * 1;

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.beginPath();
    ctx.arc(Math.sin(i * 2) * 4, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// ===== Stage 30: Final Choice (최종 선택) =====

/** 운명의 파편 - 회전하는 결정 */
export const drawDestinyShard = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const rot = (t / 300) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(rot);

  // 결정 형태
  ctx.fillStyle = isHit ? '#fff' : '#a855f7';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  // 내부 빛
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 0);
  ctx.lineTo(0, 6);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

/** 타임라인 분기 - Y 형태 */
export const drawTimelineSplit = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 200) * 2;

  // 분기 경로
  ctx.strokeStyle = isHit ? '#fff' : '#3b82f6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(0, 0);
  ctx.lineTo(-10, -10 + pulse);
  ctx.moveTo(0, 0);
  ctx.lineTo(10, -10 - pulse);
  ctx.stroke();

  // 분기점
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // 끝점들
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(-10, -10 + pulse, 3, 0, Math.PI * 2);
  ctx.arc(10, -10 - pulse, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** 선택의 메아리 - 페이드되는 잔상 */
export const drawChoiceEcho = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  // 여러 개의 잔상
  for (let i = 4; i >= 0; i--) {
    const alpha = 0.2 + (4 - i) * 0.2;
    const offset = i * 3;
    const size = 8 - i;

    ctx.globalAlpha = isHit ? 1 : alpha;
    ctx.fillStyle = isHit ? '#fff' : '#6b7280';
    ctx.beginPath();
    ctx.arc(-offset + Math.sin(t / 200) * i, 0, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
};

/** 패러독스 루프 - 무한 기호 */
export const drawParadoxLoop = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const rot = (t / 500) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(rot);

  // 무한 기호
  ctx.strokeStyle = isHit ? '#fff' : '#f97316';
  ctx.lineWidth = 4;
  ctx.beginPath();
  // 왼쪽 원
  ctx.arc(-6, 0, 6, Math.PI * 0.75, Math.PI * 2.25, false);
  // 오른쪽 원
  ctx.arc(6, 0, 6, Math.PI * 1.25, Math.PI * 0.75, true);
  ctx.stroke();

  ctx.restore();

  // 중심점
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** 최종 비트 - 0과 1 전환 */
export const drawFinalBit = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const bit = Math.floor(t / 300) % 2;

  // 배경
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-12, -12, 24, 24);

  // 비트 값
  ctx.fillStyle = isHit ? '#fff' : '#00FF41';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bit.toString(), 0, 0);

  // 테두리
  ctx.strokeStyle = '#00FF41';
  ctx.lineWidth = 2;
  ctx.strokeRect(-12, -12, 24, 24);

  // 깜빡임 효과
  if (Math.floor(t / 50) % 4 === 0) {
    ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
    ctx.fillRect(-12, -12, 24, 24);
  }
};
