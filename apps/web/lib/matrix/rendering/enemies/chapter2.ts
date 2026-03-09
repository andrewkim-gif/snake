/**
 * game/rendering/enemies/chapter2.ts - Chapter 2 몬스터 렌더러 (Stages 11-15)
 * Underground 테마 - 해커, 암호화, 다크웹, AI공장
 * Performance-optimized: No shadowBlur, simple shapes
 */

import type { EnemyRenderData } from './types';

// ===== Stage 11: Hacker Hideout (해커 아지트) =====

/** 스크립트 키디 - 후드 쓴 해커 실루엣 */
export const drawScriptKiddie = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  // 후드
  ctx.fillStyle = isHit ? '#fff' : '#1e293b';
  ctx.beginPath();
  ctx.arc(0, -4, 10, Math.PI, 0);
  ctx.lineTo(8, 8);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();

  // 얼굴 (어둠)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (타이핑 시 깜빡임)
  if (Math.floor(t / 200) % 3 !== 0) {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-3, -2, 2, 2);
    ctx.fillRect(1, -2, 2, 2);
  }

  // 키보드 타이핑 표시
  ctx.fillStyle = '#22c55e';
  const keyOffset = Math.floor(t / 100) % 3;
  ctx.fillRect(-4 + keyOffset * 3, 10, 2, 1);
};

/** 프록시 마스크 - 변하는 가면 */
export const drawProxyMask = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const phase = Math.floor(t / 500) % 3;

  // 마스크 형태
  ctx.fillStyle = isHit ? '#fff' : '#8b5cf6';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 얼굴 변환 - 3가지 표정
  ctx.fillStyle = '#1e1b4b';
  if (phase === 0) {
    // 웃는 얼굴
    ctx.fillRect(-4, -3, 2, 3);
    ctx.fillRect(2, -3, 2, 3);
    ctx.beginPath();
    ctx.arc(0, 3, 4, 0, Math.PI);
    ctx.stroke();
  } else if (phase === 1) {
    // 화난 얼굴
    ctx.fillRect(-4, -2, 2, 2);
    ctx.fillRect(2, -2, 2, 2);
    ctx.fillRect(-3, 4, 6, 2);
  } else {
    // 무표정
    ctx.fillRect(-4, -2, 2, 2);
    ctx.fillRect(2, -2, 2, 2);
    ctx.fillRect(-2, 4, 4, 1);
  }
};

/** VPN 터널 - 원통형 터널 */
export const drawVpnTunnel = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  // 터널 외곽
  ctx.fillStyle = isHit ? '#fff' : '#22c55e';
  ctx.fillRect(-12, -6, 24, 12);

  // 내부 (어둠)
  ctx.fillStyle = '#052e16';
  ctx.fillRect(-10, -4, 20, 8);

  // 데이터 흐름 (움직이는 점들)
  ctx.fillStyle = '#4ade80';
  const flow = (t / 50) % 20;
  for (let i = 0; i < 3; i++) {
    const x = -8 + ((flow + i * 7) % 16);
    ctx.fillRect(x, -2, 3, 4);
  }
};

/** 토르 양파 - 겹겹이 쌓인 원 */
export const drawTorOnion = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 300) * 0.1 + 1;

  // 레이어들 (바깥에서 안으로)
  const colors = ['#581c87', '#7c3aed', '#a855f7', '#c084fc', '#e9d5ff'];
  for (let i = 0; i < 5; i++) {
    const radius = (12 - i * 2) * (i === 4 - Math.floor(t / 200) % 5 ? pulse : 1);
    ctx.fillStyle = isHit ? '#fff' : colors[i];
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** 백도어 - 열렸다 닫히는 문 */
export const drawBackdoor = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const openAmount = Math.abs(Math.sin(t / 400)) * 6;

  // 문틀
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.fillRect(-10, -12, 20, 24);

  // 문 (열림/닫힘)
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-8 + openAmount, -10, 14 - openAmount, 20);

  // 손잡이
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(4, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  // 열릴 때 내부 표시
  if (openAmount > 3) {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-6, -4, 4, 8);
  }
};

// ===== Stage 12: Encrypted Tunnel (암호화 터널) =====

/** 암호 블록 - 변하는 문자가 있는 큐브 */
export const drawCipherBlock = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  // 큐브
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.fillRect(-10, -10, 20, 20);

  // 테두리
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -10, 20, 20);

  // 변하는 문자
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = 'ABCDEF0123456789';
  const char = chars[Math.floor(t / 100) % chars.length];
  ctx.fillText(char, 0, 0);
};

/** 해시 충돌 - 충돌하는 두 원 */
export const drawHashCollision = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const offset = Math.sin(t / 200) * 4;

  // 두 원이 충돌
  ctx.fillStyle = isHit ? '#fff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-4 + offset, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.beginPath();
  ctx.arc(4 - offset, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  // 충돌 지점 표시
  if (Math.abs(offset) < 2) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** 솔트 쉐이커 - 흔들리는 소금통 */
export const drawSaltShaker = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const shake = Math.sin(t / 50) * 2;

  ctx.save();
  ctx.rotate(shake * Math.PI / 180);

  // 몸체
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.fillRect(-6, -8, 12, 16);

  // 뚜껑
  ctx.fillStyle = '#a8a29e';
  ctx.fillRect(-7, -10, 14, 4);

  // 구멍들
  ctx.fillStyle = '#374151';
  ctx.fillRect(-3, -9, 2, 2);
  ctx.fillRect(1, -9, 2, 2);

  ctx.restore();

  // 떨어지는 입자
  ctx.fillStyle = '#e5e5e5';
  const fall = (t / 30) % 15;
  ctx.fillRect(-2, 8 + fall, 1, 1);
  ctx.fillRect(1, 6 + fall, 1, 1);
};

/** 키 조각 - 회전하는 열쇠 파편 */
export const drawKeyFragment = (
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

  // 열쇠 머리
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();

  // 열쇠 구멍
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.arc(0, -6, 2, 0, Math.PI * 2);
  ctx.fill();

  // 열쇠 몸통 (깨진)
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.fillRect(-2, 0, 4, 8);

  // 톱니 (불완전)
  ctx.fillRect(2, 2, 3, 2);
  ctx.fillRect(2, 6, 2, 2);

  ctx.restore();
};

/** 패딩 오라클 - 물음표 구슬 */
export const drawPaddingOracle = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const pulse = Math.sin(t / 300) * 2 + 10;

  // 구슬
  ctx.fillStyle = isHit ? '#fff' : '#8b5cf6';
  ctx.beginPath();
  ctx.arc(0, 0, pulse, 0, Math.PI * 2);
  ctx.fill();

  // 물음표
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);
};

// ===== Stage 13: Dark Web (다크웹) =====

/** 실크로드 크롤러 - 거미 형태 */
export const drawSilkCrawler = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const legMove = Math.sin(t / 100) * 0.2;

  // 몸통
  ctx.fillStyle = isHit ? '#fff' : '#18181b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 다리 (8개)
  ctx.strokeStyle = isHit ? '#fff' : '#27272a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const angle = (i * 0.4 + 0.3 + legMove * (i % 2 ? 1 : -1));
    // 왼쪽 다리
    ctx.beginPath();
    ctx.moveTo(-6, -2 + i * 2);
    ctx.lineTo(-6 - Math.cos(angle) * 8, -2 + i * 2 + Math.sin(angle) * 4);
    ctx.stroke();
    // 오른쪽 다리
    ctx.beginPath();
    ctx.moveTo(6, -2 + i * 2);
    ctx.lineTo(6 + Math.cos(angle) * 8, -2 + i * 2 + Math.sin(angle) * 4);
    ctx.stroke();
  }

  // 눈
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-3, -3, 2, 2);
  ctx.fillRect(1, -3, 2, 2);
};

/** 비트코인 도둑 - 동전과 가면 */
export const drawBitcoinThief = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const coinRot = (t / 300) % (Math.PI * 2);

  // 도둑 가면
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.arc(0, 2, 10, 0, Math.PI * 2);
  ctx.fill();

  // 눈구멍
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(-4, 0, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(4, 0, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 회전하는 비트코인
  ctx.save();
  ctx.translate(0, -10);
  ctx.scale(Math.cos(coinRot), 1);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', 0, 0);
  ctx.restore();
};

/** 피싱 훅 - 낚시바늘 */
export const drawPhishHook = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const swing = Math.sin(t / 200) * 0.1;

  ctx.save();
  ctx.rotate(swing);

  // 낚싯줄
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, -5);
  ctx.stroke();

  // 바늘
  ctx.strokeStyle = isHit ? '#fff' : '#3b82f6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 5);
  ctx.arc(5, 5, 5, Math.PI, Math.PI * 0.5, true);
  ctx.stroke();

  // 미끼 (@ 기호)
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@', 10, 12);

  ctx.restore();
};

/** 스캠 팝업 - 경고창 */
export const drawScamPopup = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const blink = Math.floor(t / 300) % 2;

  // 창
  ctx.fillStyle = isHit ? '#fff' : '#f5f5f4';
  ctx.fillRect(-12, -10, 24, 20);

  // 상단 바
  ctx.fillStyle = blink ? '#ef4444' : '#dc2626';
  ctx.fillRect(-12, -10, 24, 5);

  // X 버튼
  ctx.fillStyle = '#fff';
  ctx.fillRect(8, -9, 3, 3);

  // 경고 내용
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WIN!', 0, 0);
  ctx.fillStyle = '#000';
  ctx.font = '4px sans-serif';
  ctx.fillText('CLICK', 0, 6);
};

/** 신원 유령 - 페이드되는 얼굴 */
export const drawIdentityGhost = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const fade = Math.sin(t / 400) * 0.3 + 0.5;

  ctx.globalAlpha = isHit ? 1 : fade;

  // 얼굴 윤곽
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (빈 구멍)
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.ellipse(-4, -2, 2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(4, -2, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 입 (O 형태)
  ctx.beginPath();
  ctx.ellipse(0, 5, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
};

// ===== Stage 14: AI Factory (AI 공장) =====

/** 조립 팔 - 로봇 팔 */
export const drawAssemblyArm = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const grab = Math.sin(t / 300) * 0.3;

  // 기둥
  ctx.fillStyle = '#374151';
  ctx.fillRect(-3, -12, 6, 8);

  // 팔
  ctx.fillStyle = isHit ? '#fff' : '#f97316';
  ctx.save();
  ctx.rotate(Math.sin(t / 400) * 0.2);
  ctx.fillRect(-2, -4, 4, 12);

  // 집게
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.moveTo(-3, 8);
  ctx.lineTo(-6, 12 + grab * 4);
  ctx.lineTo(-3, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3, 8);
  ctx.lineTo(6, 12 + grab * 4);
  ctx.lineTo(3, 12);
  ctx.fill();
  ctx.restore();
};

/** 컨베이어 봇 - 이동하는 상자 로봇 */
export const drawConveyorBot = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wheelRot = (t / 100) % (Math.PI * 2);

  // 몸체
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  ctx.fillRect(-10, -8, 20, 12);

  // 바퀴
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(-6, 6, 4, 0, Math.PI * 2);
  ctx.arc(6, 6, 4, 0, Math.PI * 2);
  ctx.fill();

  // 바퀴 스포크
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6 + Math.cos(wheelRot) * 3, 6 + Math.sin(wheelRot) * 3);
  ctx.lineTo(-6 - Math.cos(wheelRot) * 3, 6 - Math.sin(wheelRot) * 3);
  ctx.moveTo(6 + Math.cos(wheelRot) * 3, 6 + Math.sin(wheelRot) * 3);
  ctx.lineTo(6 - Math.cos(wheelRot) * 3, 6 - Math.sin(wheelRot) * 3);
  ctx.stroke();

  // 표시등
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(-2, -6, 4, 2);
};

/** QC 스캐너 - 스캔 레이저 */
export const drawQcScanner = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const scanY = Math.sin(t / 200) * 10;

  // 본체
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-8, -12, 16, 6);

  // 스캔 빔
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, scanY);
  ctx.lineTo(10, scanY);
  ctx.stroke();

  // 빔 확산
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-10, scanY);
  ctx.lineTo(10, scanY);
  ctx.stroke();
};

/** 불량품 - 찌그러진 큐브 */
export const drawDefectUnit = (
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

  // 찌그러진 형태
  ctx.fillStyle = isHit ? '#fff' : '#1f2937';
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.lineTo(10, -8);
  ctx.lineTo(8, 10);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  // 금간 자국
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(2, 0);
  ctx.lineTo(-2, 8);
  ctx.stroke();

  // ERROR 표시
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ERR', 0, 0);

  ctx.restore();
};

/** 용광로 불꽃 - 튀는 불꽃 */
export const drawForgeSpark = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();

  // 불꽃 코어
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // 불꽃 가지들
  ctx.fillStyle = '#f97316';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + t / 200;
    const len = 6 + Math.sin(t / 100 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(angle) * len,
      Math.sin(angle) * len
    );
    ctx.lineTo(
      Math.cos(angle + 0.3) * (len - 2),
      Math.sin(angle + 0.3) * (len - 2)
    );
    ctx.closePath();
    ctx.fill();
  }
};

// ===== Stage 15: Factory Core (공장 코어) =====

/** 코어 드론 - 육각형 드론 */
export const drawCoreDrone = (
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

  // 육각형 몸체
  ctx.fillStyle = isHit ? '#fff' : '#3b82f6';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 10;
    const y = Math.sin(angle) * 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // 중심 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/** 전력 셀 - 배터리 */
export const drawPowerCell = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const charge = (t / 20) % 20;

  // 배터리 외곽
  ctx.fillStyle = isHit ? '#fff' : '#374151';
  ctx.fillRect(-8, -12, 16, 24);

  // 양극
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(-4, -14, 8, 3);

  // 충전 레벨
  ctx.fillStyle = '#22c55e';
  const level = Math.min(20, charge);
  ctx.fillRect(-6, 10 - level, 12, level);

  // 번개 표시
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(-2, 0);
  ctx.lineTo(1, 0);
  ctx.lineTo(-2, 6);
  ctx.lineTo(2, 0);
  ctx.lineTo(-1, 0);
  ctx.closePath();
  ctx.fill();
};

/** 냉각팬 - 빠르게 회전하는 팬 */
export const drawCoolingFan = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const rot = (t / 30) % (Math.PI * 2);

  // 프레임
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(rot);

  // 날개
  ctx.fillStyle = isHit ? '#fff' : '#6b7280';
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4, -10);
    ctx.lineTo(-4, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // 중심
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** 회로 버그 - 전선 달린 벌레 */
export const drawCircuitBug = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const wiggle = Math.sin(t / 100) * 0.1;

  ctx.save();
  ctx.rotate(wiggle);

  // 몸통
  ctx.fillStyle = isHit ? '#fff' : '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 다리 (전선처럼)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-4 + i * 4, -4);
    ctx.lineTo(-6 + i * 4, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4 + i * 4, 4);
    ctx.lineTo(-6 + i * 4, 10);
    ctx.stroke();
  }

  // 더듬이 (안테나)
  ctx.strokeStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-12, -4);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-12, 4);
  ctx.stroke();

  ctx.restore();
};

/** 스팀 배출구 - 증기 분출 */
export const drawSteamVent = (
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  fill: string,
  shade: string,
  isHit: boolean
): void => {
  const t = Date.now();
  const puff = (t / 50) % 15;

  // 배출구
  ctx.fillStyle = '#374151';
  ctx.fillRect(-8, 4, 16, 8);

  // 그릴
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-6 + i * 4, 4);
    ctx.lineTo(-6 + i * 4, 12);
    ctx.stroke();
  }

  // 증기 구름들
  ctx.fillStyle = isHit ? '#fff' : 'rgba(245, 245, 244, 0.7)';
  ctx.beginPath();
  ctx.arc(-4, -puff, 4 + puff * 0.3, 0, Math.PI * 2);
  ctx.arc(4, -puff - 2, 3 + puff * 0.2, 0, Math.PI * 2);
  ctx.arc(0, -puff - 4, 5 + puff * 0.4, 0, Math.PI * 2);
  ctx.fill();
};
