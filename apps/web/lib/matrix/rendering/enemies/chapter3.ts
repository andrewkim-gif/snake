/**
 * game/rendering/enemies/chapter3.ts - Chapter 3 몬스터 렌더러 (Stages 21-25)
 * Digital World 테마 - 코드의 바다, 메모리 궁전, CPU 코어, 뉴럴 네트워크, 학습 센터
 * Performance-optimized: No shadowBlur, simple shapes
 */

import type { EnemyRenderData } from './types';

// ===== Stage 21: Sea of Code (코드의 바다) =====

/** 구문 물고기 - 헤엄치는 물고기 */
export const drawSyntaxFish = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const swim = Math.sin(t / 150) * 0.1;
  const tailWag = Math.sin(t / 100) * 0.3;

  ctx.save();
  ctx.rotate(swim);

  // 몸통
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 꼬리
  ctx.save();
  ctx.rotate(tailWag);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-18, -6);
  ctx.lineTo(-18, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.arc(7, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 지느러미
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-4, -12);
  ctx.lineTo(4, -12);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

/** 괄호 게 - 옆으로 걷는 게 */
export const drawBracketCrab = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const sideStep = Math.sin(t / 200) * 2;
  const legMove = Math.sin(t / 80) * 0.2;

  ctx.save();
  ctx.translate(sideStep, 0);

  // 몸통
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 집게 (괄호 형태)
  ctx.strokeStyle = isHit ? '#fff' : '#ea580c';
  ctx.lineWidth = 3;
  // 왼쪽 {
  ctx.beginPath();
  ctx.arc(-16, 0, 6, -Math.PI * 0.6, Math.PI * 0.6);
  ctx.stroke();
  // 오른쪽 }
  ctx.beginPath();
  ctx.arc(16, 0, 6, Math.PI * 0.4, Math.PI * 1.6);
  ctx.stroke();

  // 다리
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const legAngle = legMove * (i % 2 ? 1 : -1);
    ctx.beginPath();
    ctx.moveTo(-8 + i * 4, 6);
    ctx.lineTo(-10 + i * 4, 12 + Math.sin(legAngle) * 2);
    ctx.moveTo(-8 + i * 4, -6);
    ctx.lineTo(-10 + i * 4, -12 - Math.sin(legAngle) * 2);
    ctx.stroke();
  }

  // 눈
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-4, -4, 2, 3);
  ctx.fillRect(2, -4, 2, 3);

  ctx.restore();
};

/** 주석 해파리 - 부유하는 해파리 */
export const drawCommentJellyfish = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const float = Math.sin(t / 300) * 3;
  const pulse = Math.sin(t / 200) * 0.1 + 1;

  ctx.save();
  ctx.translate(0, float);

  // 머리 (우산 형태)
  ctx.fillStyle = isHit ? '#fff' : 'rgba(34, 197, 94, 0.7)';
  ctx.beginPath();
  ctx.arc(0, 0, 10 * pulse, Math.PI, 0);
  ctx.quadraticCurveTo(10, 5, 0, 5);
  ctx.quadraticCurveTo(-10, 5, -10 * pulse, 0);
  ctx.fill();

  // 촉수
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 3;
    const wave = Math.sin(t / 150 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(x, 5);
    ctx.quadraticCurveTo(x + wave, 12, x, 20);
    ctx.stroke();
  }

  // 주석 텍스트
  ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('//', 0, 0);

  ctx.restore();
};

/** 변수 뱀장어 - 구불거리는 긴 형태 */
export const drawVariableEel = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  ctx.strokeStyle = isHit ? '#fff' : '#a855f7';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  // 구불거리는 몸체
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  for (let i = 0; i < 30; i++) {
    const x = -15 + i;
    const y = Math.sin(t / 100 + i * 0.3) * 5;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 머리
  ctx.fillStyle = isHit ? '#fff' : '#c084fc';
  ctx.beginPath();
  ctx.arc(15, Math.sin(t / 100 + 9) * 5, 5, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(16, Math.sin(t / 100 + 9) * 5 - 1, 2, 0, Math.PI * 2);
  ctx.fill();
};

/** 함수 고래 - 느리게 수영하는 큰 형태 */
export const drawFunctionWhale = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const swim = Math.sin(t / 400) * 0.05;
  const tailMove = Math.sin(t / 300) * 0.2;

  ctx.save();
  ctx.rotate(swim);

  // 몸통
  ctx.fillStyle = isHit ? '#fff' : '#1e293b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // 꼬리
  ctx.save();
  ctx.translate(-16, 0);
  ctx.rotate(tailMove);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 배
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 5, 0, 0, Math.PI);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(10, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(11, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // fn() 텍스트
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('fn', 0, 2);

  ctx.restore();
};

// ===== Stage 22: Memory Palace (메모리 궁전) =====

/** 힙 더미 - 쌓였다 무너지는 형태 */
export const drawHeapPile = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const collapse = Math.sin(t / 400);

  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';

  // 불규칙한 블록들
  const blocks = [
    { x: -8, y: 6, w: 8, h: 6, rot: collapse * 0.1 },
    { x: 2, y: 4, w: 10, h: 8, rot: -collapse * 0.05 },
    { x: -4, y: -2, w: 7, h: 6, rot: collapse * 0.15 },
    { x: 4, y: -4, w: 6, h: 5, rot: -collapse * 0.1 },
    { x: -2, y: -10, w: 8, h: 6, rot: collapse * 0.2 },
  ];

  blocks.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y + collapse * 2);
    ctx.rotate(b.rot);
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
  });
};

/** 스택 타워 - 쌓인 사각형 */
export const drawStackTower = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pushPop = Math.floor(t / 500) % 5;

  // 스택 블록들
  for (let i = 0; i < 5; i++) {
    const show = i <= pushPop;
    if (show) {
      ctx.fillStyle = isHit ? '#fff' : (i === pushPop ? '#60a5fa' : '#3b82f6');
      ctx.fillRect(-8, 10 - i * 5, 16, 4);
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, 10 - i * 5, 16, 4);
    }
  }

  // PUSH/POP 텍스트
  ctx.fillStyle = '#fff';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(pushPop < 3 ? 'PUSH' : 'POP', 0, -12);
};

/** 포인터 화살 - 가리키는 화살표 */
export const drawPointerArrow = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const point = Math.sin(t / 200) * 3;

  ctx.save();
  ctx.translate(point, 0);

  // 화살표
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(4, -6);
  ctx.lineTo(4, -3);
  ctx.lineTo(-12, -3);
  ctx.lineTo(-12, 3);
  ctx.lineTo(4, 3);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.fill();

  // * 기호
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('*', -4, 4);

  ctx.restore();
};

/** 가비지 컬렉터 - 청소기 형태 */
export const drawGarbageCollector = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const vacuum = Math.sin(t / 100) * 2;

  // 본체
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  // 흡입구
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.lineTo(18 + vacuum, -6);
  ctx.lineTo(18 + vacuum, 6);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  // GC 텍스트
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GC', 0, 3);

  // 흡입되는 입자
  ctx.fillStyle = '#9ca3af';
  for (let i = 0; i < 3; i++) {
    const px = 20 + vacuum + i * 4;
    const py = Math.sin(t / 100 + i) * 3;
    ctx.fillRect(px, py - 1, 2, 2);
  }
};

/** 메모리 조각 - 흩어지는 형태 */
export const drawMemoryFragment = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  ctx.fillStyle = isHit ? '#fff' : '#e879f9';

  // 흩어지는 조각들
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + t / 1000;
    const dist = 6 + Math.sin(t / 200 + i) * 3;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const size = 3 + Math.sin(t / 150 + i) * 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + t / 500);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // 중심 코어
  ctx.fillStyle = '#d946ef';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
};

// ===== Stage 23: CPU Core (CPU 코어) =====

/** 클럭 사이클 - 펄스 파동 */
export const drawClockCycle = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const phase = (t / 100) % 20;

  // 파동 원들
  ctx.strokeStyle = isHit ? '#fff' : '#fbbf24';
  ctx.lineWidth = 2;

  for (let i = 0; i < 3; i++) {
    const r = ((phase + i * 7) % 20) + 4;
    const alpha = 1 - r / 24;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 중심
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Hz 텍스트
  ctx.fillStyle = '#78350f';
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Hz', 0, 2);
};

/** 명령 페치 - 이동하는 작은 패킷 */
export const drawInstructionFetch = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const move = (t / 50) % 30 - 15;

  ctx.save();
  ctx.translate(move, 0);

  // 패킷
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.fillRect(-6, -4, 12, 8);

  // 화살표 표시
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(-1, -2);
  ctx.lineTo(-1, 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 경로 표시
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();
  ctx.setLineDash([]);
};

/** 분기 예측기 - Y자 형태 */
export const drawBranchPredictor = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const choice = Math.floor(t / 500) % 2;

  // Y자 기본 형태
  ctx.strokeStyle = isHit ? '#fff' : '#22c55e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(0, 0);
  ctx.lineTo(-8, -10);
  ctx.moveTo(0, 0);
  ctx.lineTo(8, -10);
  ctx.stroke();

  // 선택된 경로 강조
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(choice ? 8 : -8, -10);
  ctx.stroke();

  // 화살표
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  const arrowX = choice ? 8 : -8;
  ctx.moveTo(arrowX, -12);
  ctx.lineTo(arrowX - 3, -8);
  ctx.lineTo(arrowX + 3, -8);
  ctx.closePath();
  ctx.fill();
};

/** 파이프라인 스톨 - 막힌 관 */
export const drawPipelineStall = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const shake = Math.sin(t / 50) * 1;

  ctx.save();
  ctx.translate(shake, 0);

  // 파이프
  ctx.fillStyle = '#374151';
  ctx.fillRect(-14, -5, 28, 10);

  // 막힌 부분
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.fillRect(-4, -6, 8, 12);

  // X 표시
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.lineTo(2, 3);
  ctx.moveTo(2, -3);
  ctx.lineTo(-2, 3);
  ctx.stroke();

  // STALL 텍스트
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STALL', 0, 14);

  ctx.restore();
};

/** 열 스파이크 - 솟아오르는 불꽃 */
export const drawThermalSpike = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const spike = Math.abs(Math.sin(t / 200)) * 8;

  // 불꽃들
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  for (let i = 0; i < 5; i++) {
    const x = -8 + i * 4;
    const h = 6 + Math.sin(t / 100 + i) * 3 + spike;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 2, 8 - h);
    ctx.lineTo(x + 4, 8);
    ctx.closePath();
    ctx.fill();
  }

  // 기반
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-10, 8, 20, 4);

  // 온도 표시
  ctx.fillStyle = '#fff';
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOT', 0, 4);
};

// ===== Stage 24: Neural Network (뉴럴 네트워크) =====

/** 뉴런 노드 - 활성화되는 원 */
export const drawNeuronNode = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const active = Math.sin(t / 200) > 0;
  const pulse = active ? Math.sin(t / 100) * 2 + 10 : 8;

  // 연결선
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 1;
  const connections = [[-15, -10], [15, -10], [-15, 10], [15, 10]];
  connections.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  // 노드
  ctx.fillStyle = isHit ? '#fff' : (active ? '#a855f7' : '#7c3aed');
  ctx.beginPath();
  ctx.arc(0, 0, pulse, 0, Math.PI * 2);
  ctx.fill();

  // 활성화 표시
  if (active) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1', 0, 3);
  }
};

/** 시냅스 스파크 - 전달되는 작은 불꽃 */
export const drawSynapseSpark = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const travel = (t / 30) % 30 - 15;

  // 경로
  ctx.strokeStyle = '#164e63';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();

  // 스파크
  ctx.fillStyle = isHit ? '#fff' : '#06b6d4';
  ctx.beginPath();
  ctx.arc(travel, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  // 빛나는 효과
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(travel, 0, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** 가중치 조절기 - 슬라이더 형태 */
export const drawWeightAdjuster = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pos = Math.sin(t / 300) * 10;

  // 트랙
  ctx.fillStyle = '#374151';
  ctx.fillRect(-14, -3, 28, 6);

  // 슬라이더
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(pos - 4, -5, 8, 10);

  // 값 표시
  ctx.fillStyle = '#fff';
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'center';
  const val = ((pos + 10) / 20).toFixed(1);
  ctx.fillText(val, pos, 2);

  // w 라벨
  ctx.fillStyle = '#22c55e';
  ctx.fillText('w', -16, 2);
};

/** 바이어스 블롭 - 움직이는 타원 */
export const drawBiasBlob = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wobble = Math.sin(t / 150) * 2;
  const stretch = Math.sin(t / 200) * 0.2 + 1;

  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.ellipse(wobble, 0, 10 * stretch, 8 / stretch, 0, 0, Math.PI * 2);
  ctx.fill();

  // b 라벨
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('b', wobble, 4);
};

/** 활성화 파동 - 전파되는 파동 */
export const drawActivationWave = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  ctx.strokeStyle = isHit ? '#fff' : '#3b82f6';
  ctx.lineWidth = 2;

  // 파동 곡선
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  for (let x = -15; x <= 15; x += 2) {
    const phase = (t / 100 + x * 0.2);
    const y = Math.sin(phase) * 6;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 활성화 점
  const activeX = ((t / 50) % 30) - 15;
  const activeY = Math.sin((t / 100 + activeX * 0.2)) * 6;
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(activeX, activeY, 4, 0, Math.PI * 2);
  ctx.fill();
};

// ===== Stage 25: Learning Center (학습 센터) =====

/** 학습 데이터 - 문서 더미 */
export const drawTrainingData = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const stack = Math.sin(t / 300) * 2;

  // 문서들
  const docs = [
    { y: 6, color: '#9ca3af' },
    { y: 2, color: '#6b7280' },
    { y: -2, color: '#4b5563' },
    { y: -6, color: '#374151' },
  ];

  docs.forEach((doc, i) => {
    ctx.fillStyle = isHit ? '#fff' : doc.color;
    ctx.fillRect(-10, doc.y + stack * (i * 0.2), 20, 4);
    // 텍스트 라인
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-8, doc.y + stack * (i * 0.2) + 1, 8, 1);
    ctx.fillRect(-8, doc.y + stack * (i * 0.2) + 2.5, 12, 1);
  });
};

/** 손실 함수 - 하강하는 그래프 */
export const drawLossFunction = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const descent = (t / 500) % 1;

  // 축
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(-12, 10);
  ctx.lineTo(12, 10);
  ctx.stroke();

  // 손실 곡선
  ctx.strokeStyle = isHit ? '#fff' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  for (let x = -10; x <= 10; x++) {
    const y = 8 - 16 * Math.exp(-(x + 10) * 0.1) * (1 - descent * 0.3);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 현재 위치
  const currentX = -10 + descent * 20;
  const currentY = 8 - 16 * Math.exp(-(currentX + 10) * 0.1) * (1 - descent * 0.3);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** 그래디언트 흐름 - 역전파 화살표 */
export const drawGradientFlow = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const flow = (t / 50) % 25;

  // 화살표들
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  for (let i = 0; i < 4; i++) {
    const x = 12 - ((flow + i * 6) % 24);
    ctx.beginPath();
    ctx.moveTo(x - 4, 0);
    ctx.lineTo(x, -4);
    ctx.lineTo(x, -2);
    ctx.lineTo(x + 6, -2);
    ctx.lineTo(x + 6, 2);
    ctx.lineTo(x, 2);
    ctx.lineTo(x, 4);
    ctx.closePath();
    ctx.fill();
  }

  // ∇ 기호
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 10px serif';
  ctx.textAlign = 'center';
  ctx.fillText('∇', 0, -8);
};

/** 과적합 - 복잡한 곡선 */
export const drawOverfitting = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const twist = Math.sin(t / 200) * 0.5;

  // 과도하게 구불거리는 선
  ctx.strokeStyle = isHit ? '#fff' : '#f97316';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  for (let x = -14; x <= 14; x++) {
    const y = Math.sin(x * 0.8 + twist) * 5 + Math.sin(x * 1.5) * 3 + Math.cos(x * 2.2) * 2;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 데이터 포인트들
  ctx.fillStyle = '#ea580c';
  const points = [[-10, 2], [-5, -3], [0, 4], [5, -2], [10, 1]];
  points.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  });
};

/** 에포크 카운터 - 증가하는 숫자 */
export const drawEpochCounter = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const epoch = Math.floor(t / 200) % 100;

  // 박스
  ctx.fillStyle = isHit ? '#fff' : '#1e3a5f';
  ctx.fillRect(-12, -10, 24, 20);

  // 숫자
  ctx.fillStyle = '#3b82f6';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(epoch.toString().padStart(2, '0'), 0, 0);

  // EPOCH 라벨
  ctx.fillStyle = '#60a5fa';
  ctx.font = '6px sans-serif';
  ctx.fillText('EPOCH', 0, -14);
};
