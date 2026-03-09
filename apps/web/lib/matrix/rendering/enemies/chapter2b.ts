/**
 * game/rendering/enemies/chapter2b.ts - Chapter 2 몬스터 렌더러 (Stages 16-20)
 * Battleground 테마 - 폐허, 저항군, 훈련장, 메인프레임, 데이터감옥
 * Performance-optimized: No shadowBlur, simple shapes
 */

import type { EnemyRenderData } from './types';

// ===== Stage 16: Ruins (폐허) =====

/** 잔해 골렘 - 불규칙한 돌 덩어리 */
export const drawRubbleGolem = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const reassemble = Math.sin(t / 500) * 2;

  // 불규칙한 몸체
  ctx.fillStyle = isHit ? '#fff' : '#78716c';
  ctx.beginPath();
  ctx.moveTo(-8, -10 + reassemble);
  ctx.lineTo(6, -8);
  ctx.lineTo(10, 2 - reassemble);
  ctx.lineTo(4, 10);
  ctx.lineTo(-6, 8 + reassemble);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();

  // 금간 자국
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(0, 0);
  ctx.lineTo(4, 6);
  ctx.stroke();

  // 눈 (빛나는 틈)
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-4, -2, 2, 2);
  ctx.fillRect(2, -2, 2, 2);
};

/** 녹슨 크롤러 - 삐걱거리는 로봇 */
export const drawRustCrawler = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const jitter = Math.floor(t / 100) % 2 ? 1 : -1;

  ctx.save();
  ctx.translate(jitter, 0);

  // 녹슨 몸체
  ctx.fillStyle = isHit ? '#fff' : '#b45309';
  ctx.fillRect(-10, -6, 20, 12);

  // 녹 패치
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-8, -4, 4, 4);
  ctx.fillRect(4, 0, 5, 3);

  // 삐걱거리는 다리
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.lineTo(-10, 12 + jitter);
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 12 - jitter);
  ctx.moveTo(8, 6);
  ctx.lineTo(10, 12 + jitter);
  ctx.stroke();

  // 깨진 눈
  ctx.fillStyle = Math.floor(t / 200) % 3 === 0 ? '#ef4444' : '#1f2937';
  ctx.fillRect(-6, -3, 3, 3);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(3, -3, 3, 3);

  ctx.restore();
};

/** 철근 스파이크 - 튀어나오는 철근 */
export const drawRebarSpike = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const extend = Math.abs(Math.sin(t / 300)) * 8;

  // 콘크리트 기반
  ctx.fillStyle = '#78716c';
  ctx.fillRect(-10, 4, 20, 8);

  // 철근들
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-7, 4 - extend, 3, extend + 4);
  ctx.fillRect(-1, 2 - extend * 0.8, 3, extend * 0.8 + 6);
  ctx.fillRect(5, 4 - extend * 1.2, 3, extend * 1.2 + 4);

  // 녹
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-6, 2 - extend, 1, 3);
  ctx.fillRect(6, 2 - extend, 1, 2);
};

/** 먼지 구름 - 부유하는 먼지 */
export const drawDustCloud = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const float = Math.sin(t / 300) * 3;

  ctx.save();
  ctx.translate(0, float);

  // 구름 형태
  ctx.fillStyle = isHit ? '#fff' : 'rgba(168, 162, 158, 0.8)';
  ctx.beginPath();
  ctx.arc(-6, 0, 6, 0, Math.PI * 2);
  ctx.arc(0, -3, 7, 0, Math.PI * 2);
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.arc(0, 4, 5, 0, Math.PI * 2);
  ctx.fill();

  // 먼지 입자
  ctx.fillStyle = '#57534e';
  ctx.fillRect(-4, -5, 1, 1);
  ctx.fillRect(3, -2, 1, 1);
  ctx.fillRect(-2, 3, 1, 1);

  ctx.restore();
};

/** 깨진 화면 - 금간 모니터 */
export const drawBrokenScreen = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const flicker = Math.floor(t / 150) % 3;

  // 모니터 프레임
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-12, -10, 24, 20);

  // 화면
  ctx.fillStyle = isHit ? '#fff' : (flicker === 0 ? '#1f2937' : '#0f172a');
  ctx.fillRect(-10, -8, 20, 16);

  // 금간 자국
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(0, 0);
  ctx.lineTo(-4, 8);
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 4);
  ctx.stroke();

  // 깜빡이는 픽셀
  if (flicker === 1) {
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-6, -4, 2, 2);
    ctx.fillRect(4, 2, 2, 2);
  }
};

// ===== Stage 17: Resistance Camp (저항군 캠프) =====

/** 감염된 경비 - 눈이 빨갛게 빛나는 사람 */
export const drawInfectedGuard = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const eyeBlink = Math.floor(t / 500) % 3;

  // 몸체
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(-6, 0, 12, 14);

  // 머리
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath();
  ctx.arc(0, -4, 8, 0, Math.PI * 2);
  ctx.fill();

  // 감염된 눈
  ctx.fillStyle = eyeBlink === 0 ? '#ef4444' : '#dc2626';
  ctx.beginPath();
  ctx.arc(-3, -4, 2, 0, Math.PI * 2);
  ctx.arc(3, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  // 헬멧
  ctx.fillStyle = '#365314';
  ctx.beginPath();
  ctx.arc(0, -6, 9, Math.PI, 0);
  ctx.fill();
};

/** 글리치 의무병 - 깜빡이는 십자가 */
export const drawGlitchedMedic = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const glitch = Math.floor(t / 100) % 4;

  // 몸체
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(-8, -6, 16, 18);

  // 십자가 (글리치)
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  const offsetX = glitch === 1 ? 2 : glitch === 3 ? -2 : 0;
  ctx.fillRect(-2 + offsetX, -4, 4, 12);
  ctx.fillRect(-6, 0, 12, 4);

  // 글리치 라인
  if (glitch === 2) {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-8, 2, 16, 2);
  }
};

/** 해킹된 터렛 - 회전하며 조준하는 총 */
export const drawHackedTurret = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const aimAngle = Math.sin(t / 400) * 0.5;

  // 기반
  ctx.fillStyle = '#374151';
  ctx.fillRect(-8, 4, 16, 8);

  // 회전 포탑
  ctx.save();
  ctx.rotate(aimAngle);
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  // 총신
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-2, -14, 4, 10);

  // 조준 레이저
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -24);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
};

/** 배신자 드론 - 아군처럼 보이는 드론 */
export const drawTraitorDrone = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const hover = Math.sin(t / 150) * 2;
  const propeller = (t / 20) % (Math.PI * 2);

  ctx.save();
  ctx.translate(0, hover);

  // X자 프레임
  ctx.strokeStyle = isHit ? '#fff' : '#3b82f6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(10, 10);
  ctx.moveTo(10, -10);
  ctx.lineTo(-10, 10);
  ctx.stroke();

  // 프로펠러
  ctx.fillStyle = '#1f2937';
  const propPos = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
  propPos.forEach(([px, py]) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(propeller);
    ctx.fillRect(-4, -1, 8, 2);
    ctx.restore();
  });

  // 중앙 바디 (숨겨진 적색)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/** 보급품 미믹 - 입 벌리는 상자 */
export const drawSupplyMimic = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const mouthOpen = Math.abs(Math.sin(t / 300)) * 8;

  // 상자 몸체
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.fillRect(-10, -4 + mouthOpen / 2, 20, 16 - mouthOpen / 2);

  // 뚜껑 (열림)
  ctx.fillStyle = '#f59e0b';
  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(-mouthOpen * Math.PI / 180 * 3);
  ctx.fillRect(-10, -4, 20, 4);
  ctx.restore();

  // 이빨
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 4, -4 + mouthOpen / 2);
    ctx.lineTo(-6 + i * 4, 0);
    ctx.lineTo(-4 + i * 4, -4 + mouthOpen / 2);
    ctx.fill();
  }

  // 혀
  if (mouthOpen > 4) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(0, 2, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

// ===== Stage 18: Training Ground (훈련장) =====

/** 타겟 더미 - 팝업 표적 */
export const drawTargetDummy = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const popup = Math.abs(Math.sin(t / 400)) * 6;

  ctx.save();
  ctx.translate(0, 6 - popup);

  // 표적 원
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -4, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -4, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -4, 4, 0, Math.PI * 2);
  ctx.fill();

  // 중심점
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -4, 1, 0, Math.PI * 2);
  ctx.fill();

  // 지지대
  ctx.fillStyle = '#78716c';
  ctx.fillRect(-2, 6, 4, 8);

  ctx.restore();
};

/** 장애물 벽 - 솟아오르는 벽 */
export const drawObstacleWall = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const rise = Math.abs(Math.sin(t / 500)) * 10;

  // 벽
  ctx.fillStyle = isHit ? '#fff' : '#78716c';
  ctx.fillRect(-12, 12 - rise, 24, rise + 4);

  // 벽돌 패턴
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 1;
  for (let y = 14 - rise; y < 16; y += 4) {
    for (let x = -12; x < 12; x += 8) {
      const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
      ctx.strokeRect(x + offset, y, 8, 4);
    }
  }
};

/** 드릴 교관 AI - 군인 형태 */
export const drawDrillSergeant = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const shout = Math.floor(t / 200) % 3;

  // 몸체
  ctx.fillStyle = isHit ? '#fff' : '#365314';
  ctx.fillRect(-8, 0, 16, 14);

  // 머리
  ctx.fillStyle = '#78716c';
  ctx.beginPath();
  ctx.arc(0, -4, 8, 0, Math.PI * 2);
  ctx.fill();

  // 모자
  ctx.fillStyle = '#365314';
  ctx.fillRect(-10, -10, 20, 4);

  // 입 (고함)
  ctx.fillStyle = '#1f2937';
  if (shout === 0) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-2, -1, 4, 2);
  }

  // 눈
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-4, -6, 2, 2);
  ctx.fillRect(2, -6, 2, 2);
};

/** 트립와이어 - 팽팽한 선 */
export const drawTripwire = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const tense = Math.sin(t / 100) * 1;

  // 양쪽 기둥
  ctx.fillStyle = '#57534e';
  ctx.fillRect(-14, -2, 4, 10);
  ctx.fillRect(10, -2, 4, 10);

  // 와이어
  ctx.strokeStyle = isHit ? '#fff' : '#dc2626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.quadraticCurveTo(0, 2 + tense, 10, 2);
  ctx.stroke();

  // 경고 표시
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-4, -2);
  ctx.lineTo(4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-1, -6, 2, 3);
  ctx.fillRect(-1, -2, 2, 1);
};

/** 모래주머니 - 굴러가는 타원 */
export const drawSandbagTumble = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const roll = (t / 300) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(roll);

  // 모래주머니
  ctx.fillStyle = isHit ? '#fff' : '#d6d3d1';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 이음새
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(12, 0);
  ctx.stroke();

  // 묶인 부분
  ctx.fillStyle = '#78716c';
  ctx.fillRect(10, -3, 4, 6);

  ctx.restore();
};

// ===== Stage 19: Mainframe (메인프레임) =====

/** 로직 게이트 - AND/OR 기호 */
export const drawLogicGate = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const signal = Math.floor(t / 300) % 2;

  // 게이트 몸체 (AND 형태)
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.lineTo(0, -8);
  ctx.arc(0, 0, 8, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  // 입력선
  ctx.strokeStyle = signal ? '#22c55e' : '#6b7280';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.lineTo(-10, -4);
  ctx.moveTo(-16, 4);
  ctx.lineTo(-10, 4);
  ctx.stroke();

  // 출력선
  ctx.strokeStyle = signal ? '#22c55e' : '#ef4444';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();
};

/** 레지스터 파일 - 작은 사각형들 */
export const drawRegisterFile = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const activeReg = Math.floor(t / 150) % 8;

  // 레지스터 그리드
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * 6 - 9;
    const y = Math.floor(i / 4) * 6 - 3;
    ctx.fillStyle = i === activeReg ? '#22c55e' : (isHit ? '#fff' : '#1e3a5f');
    ctx.fillRect(x, y, 5, 5);
  }

  // 프레임
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.strokeRect(-11, -5, 22, 14);
};

/** 버스 컨트롤러 - 긴 직사각형 */
export const drawBusController = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const signalPos = (t / 50) % 28;

  // 버스 본체
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.fillRect(-14, -4, 28, 8);

  // 신호 이동
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(-14 + signalPos, -2, 4, 4);

  // 연결점
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-14, -2, 2, 4);
  ctx.fillRect(12, -2, 2, 4);
};

/** ALU 코어 - 다이아몬드 */
export const drawAluCore = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 200) * 0.1 + 1;

  ctx.save();
  ctx.scale(pulse, pulse);

  // 다이아몬드
  ctx.fillStyle = isHit ? '#fff' : '#a855f7';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();

  // 연산 기호
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ops = ['+', '-', '*', '/'];
  ctx.fillText(ops[Math.floor(t / 300) % 4], 0, 0);

  ctx.restore();
};

/** 캐시 라인 - 히트/미스 표시 */
export const drawCacheLine = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const hit = Math.floor(t / 400) % 3 !== 0;

  // 캐시 라인
  ctx.fillStyle = hit ? '#22c55e' : '#ef4444';
  ctx.fillRect(-14, -3, 28, 6);

  // 데이터 블록
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = isHit ? '#fff' : '#06b6d4';
    ctx.fillRect(-12 + i * 4, -2, 3, 4);
  }

  // HIT/MISS 표시
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hit ? 'HIT' : 'MISS', 0, 8);
};

// ===== Stage 20: Data Prison (데이터 감옥) =====

/** 방화벽 가드 - 방패 형태 */
export const drawFirewallGuard = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const block = Math.floor(t / 400) % 2;

  // 방패
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, -6);
  ctx.lineTo(10, 6);
  ctx.lineTo(0, 12);
  ctx.lineTo(-10, 6);
  ctx.lineTo(-10, -6);
  ctx.closePath();
  ctx.fill();

  // 불꽃 패턴
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 0);
  ctx.lineTo(0, 6);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();

  // 막기 효과
  if (block) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
};

/** 격리 셀 - 격자 큐브 */
export const drawQuarantineCell = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 300) * 0.1 + 1;

  ctx.save();
  ctx.scale(pulse, pulse);

  // 큐브 외곽
  ctx.strokeStyle = isHit ? '#fff' : '#dc2626';
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -10, 20, 20);

  // 격자
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, -10);
    ctx.lineTo(i, 10);
    ctx.moveTo(-10, i);
    ctx.lineTo(10, i);
    ctx.stroke();
  }

  // 갇힌 데이터
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/** 손상 파일 - 찢어진 문서 */
export const drawCorruptedFile = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const tear = Math.sin(t / 200) * 2;

  // 문서 (왼쪽 반)
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.lineTo(-2 + tear, -12);
  ctx.lineTo(0, -6);
  ctx.lineTo(-4 + tear, 0);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-6 + tear, 12);
  ctx.lineTo(-8, 12);
  ctx.closePath();
  ctx.fill();

  // 문서 (오른쪽 반)
  ctx.fillStyle = '#e5e5e5';
  ctx.beginPath();
  ctx.moveTo(8, -12);
  ctx.lineTo(0 - tear, -12);
  ctx.lineTo(-2, -6);
  ctx.lineTo(2 - tear, 0);
  ctx.lineTo(0, 6);
  ctx.lineTo(4 - tear, 12);
  ctx.lineTo(8, 12);
  ctx.closePath();
  ctx.fill();

  // 텍스트 라인
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(-6, -8, 4, 1);
  ctx.fillRect(2, -8, 4, 1);
  ctx.fillRect(-6, -4, 3, 1);
  ctx.fillRect(2, -4, 5, 1);
};

/** 삭제 마커 - X 표시 */
export const drawDeleteMarker = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.floor(t / 250) % 2;

  // 원
  ctx.fillStyle = blink ? '#ef4444' : '#dc2626';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  // X
  ctx.strokeStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, 6);
  ctx.moveTo(6, -6);
  ctx.lineTo(-6, 6);
  ctx.stroke();
};

/** 백업 유령 - 반투명 복제 */
export const drawBackupGhost = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const fade = Math.sin(t / 400) * 0.2 + 0.4;
  const drift = Math.sin(t / 300) * 3;

  ctx.globalAlpha = isHit ? 1 : fade;

  ctx.save();
  ctx.translate(drift, 0);

  // 유령 형태
  ctx.fillStyle = isHit ? '#fff' : '#a5b4fc';
  ctx.beginPath();
  ctx.arc(0, -4, 10, Math.PI, 0);
  ctx.lineTo(10, 10);
  // 물결 하단
  ctx.quadraticCurveTo(6, 6, 4, 10);
  ctx.quadraticCurveTo(2, 6, 0, 10);
  ctx.quadraticCurveTo(-2, 6, -4, 10);
  ctx.quadraticCurveTo(-6, 6, -10, 10);
  ctx.closePath();
  ctx.fill();

  // 눈
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.arc(-4, -4, 2, 0, Math.PI * 2);
  ctx.arc(4, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.globalAlpha = 1;
};
