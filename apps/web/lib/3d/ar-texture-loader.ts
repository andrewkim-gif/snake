/**
 * ar-texture-loader.ts — 아레나 텍스처 프리로더 + 프로시저럴 픽셀아트 생성
 *
 * 16x16/32x32 마인크래프트 스타일 픽셀아트 텍스처 생성 및 캐싱:
 * - 몬스터 얼굴/몸통 5종
 * - 미니보스 텍스처 5종
 * - 투사체 스프라이트 4종
 * - 아이템 아이콘
 * - 이펙트 파티클 스프라이트
 *
 * NearestFilter로 픽셀 보존, LRU 캐시 재사용
 */

import * as THREE from 'three';

// ============================================================
// 유틸리티
// ============================================================

const TEX_SIZE = 16;
const TEX_SIZE_32 = 32;

function createCanvas(size: number): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function px(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function fillRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function toCanvasTexture(canvas: OffscreenCanvas): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false; // NearestFilter에 mipmap 불필요
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================
// 몬스터 얼굴 텍스처 (16x16)
// ============================================================

function generateZombieFace(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 녹색 피부 베이스
  fillRect(ctx, 0, 0, 16, 16, '#4a8c3f');
  // 어두운 디테일
  fillRect(ctx, 2, 2, 12, 4, '#3d7533');
  // 눈 (붉은 빛)
  px(ctx, 4, 5, '#1a1a1a'); px(ctx, 5, 5, '#cc2222');
  px(ctx, 10, 5, '#cc2222'); px(ctx, 11, 5, '#1a1a1a');
  // 입 (찢어진 형태)
  for (let x = 4; x <= 11; x++) {
    if (x % 2 === 0) px(ctx, x, 10, '#2d5a24');
    else px(ctx, x, 11, '#2d5a24');
  }
  // 부패 반점
  px(ctx, 3, 8, '#556b2f'); px(ctx, 12, 7, '#556b2f');
  px(ctx, 7, 3, '#556b2f');
  return toCanvasTexture(canvas);
}

function generateSkeletonFace(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 뼈 색상 베이스
  fillRect(ctx, 0, 0, 16, 16, '#d4c8b0');
  // 어두운 눈구멍
  fillRect(ctx, 3, 4, 3, 3, '#1a1a1a');
  fillRect(ctx, 10, 4, 3, 3, '#1a1a1a');
  // 눈 빛 (빨강)
  px(ctx, 4, 5, '#ff3333'); px(ctx, 11, 5, '#ff3333');
  // 코
  fillRect(ctx, 7, 7, 2, 2, '#b0a090');
  // 이빨
  for (let x = 4; x <= 11; x++) {
    px(ctx, x, 11, x % 2 === 0 ? '#ffffff' : '#b0a090');
  }
  // 뼈 균열
  px(ctx, 2, 2, '#a09880'); px(ctx, 13, 3, '#a09880');
  return toCanvasTexture(canvas);
}

function generateSlimeFace(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 반투명 녹색 베이스
  fillRect(ctx, 0, 0, 16, 16, '#8BC34A');
  // 내부 코어 어두운 영역
  fillRect(ctx, 4, 4, 8, 8, '#6a9b30');
  fillRect(ctx, 6, 6, 4, 4, '#558B2F');
  // 눈
  fillRect(ctx, 4, 5, 2, 2, '#1a1a1a');
  fillRect(ctx, 10, 5, 2, 2, '#1a1a1a');
  px(ctx, 5, 5, '#ffffff'); px(ctx, 11, 5, '#ffffff');
  // 입 (심플 라인)
  fillRect(ctx, 6, 10, 4, 1, '#558B2F');
  // 광택 하이라이트
  px(ctx, 3, 3, '#a0d860'); px(ctx, 4, 2, '#a0d860');
  return toCanvasTexture(canvas);
}

function generateSpiderFace(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 갈색 베이스
  fillRect(ctx, 0, 0, 16, 16, '#795548');
  // 8개 눈 (2줄 4개씩)
  const eyeColor = '#ff1111';
  px(ctx, 3, 4, eyeColor); px(ctx, 6, 4, eyeColor);
  px(ctx, 9, 4, eyeColor); px(ctx, 12, 4, eyeColor);
  px(ctx, 4, 6, eyeColor); px(ctx, 7, 6, eyeColor);
  px(ctx, 8, 6, eyeColor); px(ctx, 11, 6, eyeColor);
  // 입 (큰 턱)
  fillRect(ctx, 5, 9, 2, 3, '#5D4037');
  fillRect(ctx, 9, 9, 2, 3, '#5D4037');
  // 털 디테일
  for (let y = 0; y < 16; y += 3) {
    px(ctx, 1, y, '#5D4037'); px(ctx, 14, y, '#5D4037');
  }
  return toCanvasTexture(canvas);
}

function generateCreeperFace(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 밝은 녹색 베이스
  fillRect(ctx, 0, 0, 16, 16, '#66BB6A');
  // 어두운 패치 (MC 크리퍼 스타일)
  fillRect(ctx, 2, 1, 3, 3, '#4CAF50');
  fillRect(ctx, 11, 2, 3, 2, '#4CAF50');
  fillRect(ctx, 5, 12, 4, 3, '#4CAF50');
  // 눈 (검은 사각형)
  fillRect(ctx, 3, 4, 3, 3, '#1a1a1a');
  fillRect(ctx, 10, 4, 3, 3, '#1a1a1a');
  // 입 (MC 크리퍼 특유의 []: 형태)
  fillRect(ctx, 6, 8, 4, 1, '#1a1a1a');
  fillRect(ctx, 6, 9, 1, 3, '#1a1a1a');
  fillRect(ctx, 9, 9, 1, 3, '#1a1a1a');
  fillRect(ctx, 7, 11, 2, 1, '#1a1a1a');
  return toCanvasTexture(canvas);
}

// ============================================================
// 몬스터 몸통 텍스처 (16x16)
// ============================================================

function generateZombieBody(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 녹색 옷 베이스
  fillRect(ctx, 0, 0, 16, 16, '#4CAF50');
  // 찢어진 옷 디테일
  fillRect(ctx, 0, 0, 16, 3, '#388E3C');
  fillRect(ctx, 0, 13, 16, 3, '#388E3C');
  // 상처/찢김
  for (let y = 4; y < 13; y += 3) {
    px(ctx, 2 + (y % 4), y, '#2d5a24');
    px(ctx, 11 - (y % 3), y, '#2d5a24');
  }
  // 벨트
  fillRect(ctx, 0, 10, 16, 1, '#795548');
  return toCanvasTexture(canvas);
}

function generateSkeletonBody(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 뼈 베이스
  fillRect(ctx, 0, 0, 16, 16, '#E0E0E0');
  // 갈비뼈 패턴
  for (let y = 2; y < 14; y += 2) {
    fillRect(ctx, 3, y, 10, 1, '#BDBDBD');
  }
  // 척추
  fillRect(ctx, 7, 0, 2, 16, '#CCCCCC');
  return toCanvasTexture(canvas);
}

function generateSlimeBody(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 투명한 녹색 젤리
  fillRect(ctx, 0, 0, 16, 16, '#8BC34A');
  // 내부 거품
  fillRect(ctx, 4, 4, 8, 8, '#7CB342');
  px(ctx, 3, 3, '#9CCC65'); px(ctx, 12, 4, '#9CCC65');
  px(ctx, 5, 11, '#9CCC65'); px(ctx, 10, 2, '#9CCC65');
  // 코어 중심
  fillRect(ctx, 6, 6, 4, 4, '#558B2F');
  return toCanvasTexture(canvas);
}

function generateSpiderBody(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 갈색 거미 몸통
  fillRect(ctx, 0, 0, 16, 16, '#795548');
  // 등 무늬
  fillRect(ctx, 4, 3, 8, 10, '#5D4037');
  // 빨간 시간표 무늬
  fillRect(ctx, 6, 5, 4, 2, '#CC3333');
  fillRect(ctx, 7, 7, 2, 3, '#CC3333');
  // 털 질감
  for (let x = 0; x < 16; x += 2) {
    px(ctx, x, 0, '#5D4037');
    px(ctx, x, 15, '#5D4037');
  }
  return toCanvasTexture(canvas);
}

function generateCreeperBody(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 밝은 녹색 베이스
  fillRect(ctx, 0, 0, 16, 16, '#76FF03');
  // MC 크리퍼 패턴 (어두운 블록)
  fillRect(ctx, 1, 1, 3, 3, '#66BB6A');
  fillRect(ctx, 6, 0, 4, 2, '#66BB6A');
  fillRect(ctx, 12, 2, 3, 3, '#66BB6A');
  fillRect(ctx, 3, 6, 3, 4, '#66BB6A');
  fillRect(ctx, 9, 5, 4, 3, '#66BB6A');
  fillRect(ctx, 0, 11, 4, 3, '#66BB6A');
  fillRect(ctx, 7, 10, 3, 4, '#66BB6A');
  fillRect(ctx, 12, 12, 3, 3, '#66BB6A');
  return toCanvasTexture(canvas);
}

// ============================================================
// 미니보스 텍스처 (32x32)
// ============================================================

function generateGolemTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE_32);
  // 돌/철 베이스
  fillRect(ctx, 0, 0, 32, 32, '#795548');
  // 균열 패턴
  for (let i = 0; i < 8; i++) {
    const x = (i * 7 + 3) % 30;
    const y = (i * 11 + 5) % 30;
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x, y, 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, 2);
  }
  // 빛나는 눈
  fillRect(ctx, 8, 10, 4, 4, '#1a1a1a');
  fillRect(ctx, 20, 10, 4, 4, '#1a1a1a');
  px(ctx, 9, 11, '#FF5722'); px(ctx, 10, 11, '#FF5722');
  px(ctx, 21, 11, '#FF5722'); px(ctx, 22, 11, '#FF5722');
  // 이끼
  fillRect(ctx, 2, 26, 5, 3, '#4a8c3f');
  fillRect(ctx, 24, 28, 4, 2, '#4a8c3f');
  return toCanvasTexture(canvas);
}

function generateWraithTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE_32);
  // 어두운 보라 베이스
  fillRect(ctx, 0, 0, 32, 32, '#4A148C');
  // 유령 같은 그라디언트 (아래로 갈수록 투명)
  for (let y = 20; y < 32; y++) {
    const alpha = 1 - (y - 20) / 12;
    ctx.fillStyle = `rgba(74, 20, 140, ${alpha})`;
    ctx.fillRect(0, y, 32, 1);
  }
  // 빛나는 눈
  fillRect(ctx, 8, 10, 5, 3, '#E040FB');
  fillRect(ctx, 19, 10, 5, 3, '#E040FB');
  px(ctx, 10, 11, '#ffffff'); px(ctx, 21, 11, '#ffffff');
  // 찢어진 가장자리
  for (let x = 0; x < 32; x += 3) {
    const depth = (x * 7) % 4 + 1;
    fillRect(ctx, x, 32 - depth, 2, depth, '#311B92');
  }
  return toCanvasTexture(canvas);
}

function generateDragonWhelpTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE_32);
  // 붉은 비늘 베이스
  fillRect(ctx, 0, 0, 32, 32, '#FF5722');
  // 비늘 패턴
  for (let y = 0; y < 32; y += 3) {
    for (let x = (y % 6 === 0 ? 0 : 2); x < 32; x += 4) {
      fillRect(ctx, x, y, 3, 2, '#E64A19');
    }
  }
  // 눈
  fillRect(ctx, 7, 8, 5, 4, '#FFD600');
  fillRect(ctx, 20, 8, 5, 4, '#FFD600');
  px(ctx, 9, 9, '#1a1a1a'); px(ctx, 10, 9, '#1a1a1a');
  px(ctx, 22, 9, '#1a1a1a'); px(ctx, 23, 9, '#1a1a1a');
  // 배 (밝은 부분)
  fillRect(ctx, 8, 18, 16, 10, '#FFAB91');
  return toCanvasTexture(canvas);
}

function generateLichKingTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE_32);
  // 어두운 파랑 베이스
  fillRect(ctx, 0, 0, 32, 32, '#1A237E');
  // 마법 룬 패턴
  const runeColor = '#5C6BC0';
  for (let i = 0; i < 6; i++) {
    const x = 4 + (i * 5) % 24;
    const y = 4 + (i * 7) % 24;
    fillRect(ctx, x, y, 3, 1, runeColor);
    fillRect(ctx, x + 1, y - 1, 1, 3, runeColor);
  }
  // 왕관
  fillRect(ctx, 6, 2, 20, 3, '#FFD600');
  px(ctx, 8, 0, '#FFD600'); px(ctx, 16, 0, '#FFD600'); px(ctx, 24, 0, '#FFD600');
  px(ctx, 8, 1, '#FFD600'); px(ctx, 16, 1, '#FFD600'); px(ctx, 24, 1, '#FFD600');
  // 빛나는 눈
  fillRect(ctx, 9, 10, 4, 3, '#64B5F6');
  fillRect(ctx, 19, 10, 4, 3, '#64B5F6');
  px(ctx, 10, 11, '#ffffff'); px(ctx, 20, 11, '#ffffff');
  // 해골 입
  for (let x = 10; x < 22; x++) {
    px(ctx, x, 20, x % 2 === 0 ? '#E0E0E0' : '#1A237E');
  }
  return toCanvasTexture(canvas);
}

function generateTheArenaTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE_32);
  // 황금/검정 베이스
  fillRect(ctx, 0, 0, 32, 32, '#1a1a1a');
  // 황금 문양
  const gold = '#FFD700';
  // 중앙 원
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(16 + Math.cos(rad) * 10);
    const y = Math.round(16 + Math.sin(rad) * 10);
    if (x >= 0 && x < 32 && y >= 0 && y < 32) px(ctx, x, y, gold);
  }
  // 십자 패턴
  fillRect(ctx, 14, 4, 4, 24, '#B8860B');
  fillRect(ctx, 4, 14, 24, 4, '#B8860B');
  // 눈 (빨강)
  fillRect(ctx, 9, 12, 4, 4, '#FF1744');
  fillRect(ctx, 19, 12, 4, 4, '#FF1744');
  px(ctx, 10, 13, '#ffffff'); px(ctx, 20, 13, '#ffffff');
  // 코너 장식
  fillRect(ctx, 1, 1, 4, 4, gold);
  fillRect(ctx, 27, 1, 4, 4, gold);
  fillRect(ctx, 1, 27, 4, 4, gold);
  fillRect(ctx, 27, 27, 4, 4, gold);
  return toCanvasTexture(canvas);
}

// ============================================================
// 투사체 스프라이트 (16x16)
// ============================================================

function generateArrowSprite(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  // 투명 배경
  ctx.clearRect(0, 0, 16, 16);
  // 화살촉
  fillRect(ctx, 6, 0, 4, 3, '#888888');
  px(ctx, 7, 0, '#CCCCCC'); px(ctx, 8, 0, '#CCCCCC');
  // 화살대
  fillRect(ctx, 7, 3, 2, 10, '#8B6914');
  // 깃
  fillRect(ctx, 5, 12, 2, 3, '#FF5722');
  fillRect(ctx, 9, 12, 2, 3, '#FF5722');
  return toCanvasTexture(canvas);
}

function generateMagicOrbSprite(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  ctx.clearRect(0, 0, 16, 16);
  // 외곽 글로우
  for (let a = 0; a < 360; a += 20) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(8 + Math.cos(rad) * 5);
    const y = Math.round(8 + Math.sin(rad) * 5);
    if (x >= 0 && x < 16 && y >= 0 && y < 16) px(ctx, x, y, '#2196F3');
  }
  // 내부 구체
  fillRect(ctx, 5, 5, 6, 6, '#4FC3F7');
  fillRect(ctx, 6, 4, 4, 8, '#4FC3F7');
  fillRect(ctx, 4, 6, 8, 4, '#4FC3F7');
  // 코어 빛
  fillRect(ctx, 7, 7, 2, 2, '#ffffff');
  return toCanvasTexture(canvas);
}

function generateBeamSprite(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  ctx.clearRect(0, 0, 16, 16);
  // 관통 빔 (수직 방향)
  fillRect(ctx, 6, 0, 4, 16, '#FF9800');
  fillRect(ctx, 7, 0, 2, 16, '#FFCC02');
  // 글로우 가장자리
  fillRect(ctx, 5, 0, 1, 16, '#FF6F00');
  fillRect(ctx, 10, 0, 1, 16, '#FF6F00');
  return toCanvasTexture(canvas);
}

function generateExplosionSprite(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  ctx.clearRect(0, 0, 16, 16);
  // 폭발 원형
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    for (let r = 3; r <= 6; r++) {
      const x = Math.round(8 + Math.cos(rad) * r);
      const y = Math.round(8 + Math.sin(rad) * r);
      if (x >= 0 && x < 16 && y >= 0 && y < 16) {
        px(ctx, x, y, r < 5 ? '#FF5722' : '#FF9800');
      }
    }
  }
  // 코어
  fillRect(ctx, 6, 6, 4, 4, '#FFEB3B');
  fillRect(ctx, 7, 7, 2, 2, '#ffffff');
  return toCanvasTexture(canvas);
}

// ============================================================
// 파티클/이펙트 텍스처 (8x8 ~ 16x16)
// ============================================================

export function generateLeafParticle(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(8);
  ctx.clearRect(0, 0, 8, 8);
  // 나뭇잎 형태
  fillRect(ctx, 2, 1, 4, 2, '#4CAF50');
  fillRect(ctx, 1, 3, 6, 2, '#388E3C');
  fillRect(ctx, 2, 5, 4, 2, '#2E7D32');
  px(ctx, 4, 7, '#795548'); // 줄기
  return toCanvasTexture(canvas);
}

export function generateSnowParticle(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(8);
  ctx.clearRect(0, 0, 8, 8);
  // 눈송이 (십자)
  fillRect(ctx, 3, 1, 2, 6, '#ffffff');
  fillRect(ctx, 1, 3, 6, 2, '#ffffff');
  px(ctx, 1, 1, '#E3F2FD'); px(ctx, 6, 1, '#E3F2FD');
  px(ctx, 1, 6, '#E3F2FD'); px(ctx, 6, 6, '#E3F2FD');
  return toCanvasTexture(canvas);
}

export function generateSandParticle(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(8);
  ctx.clearRect(0, 0, 8, 8);
  fillRect(ctx, 2, 2, 4, 4, '#D4A76A');
  fillRect(ctx, 3, 3, 2, 2, '#C4975A');
  return toCanvasTexture(canvas);
}

export function generateWaterDropParticle(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(8);
  ctx.clearRect(0, 0, 8, 8);
  // 물방울
  px(ctx, 3, 1, '#64B5F6'); px(ctx, 4, 1, '#64B5F6');
  fillRect(ctx, 2, 2, 4, 3, '#42A5F5');
  fillRect(ctx, 3, 5, 2, 2, '#2196F3');
  px(ctx, 3, 2, '#ffffff'); // 하이라이트
  return toCanvasTexture(canvas);
}

export function generateDebrisParticle(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(8);
  ctx.clearRect(0, 0, 8, 8);
  fillRect(ctx, 1, 1, 6, 6, '#666666');
  fillRect(ctx, 2, 2, 4, 4, '#888888');
  px(ctx, 3, 3, '#aaaaaa');
  return toCanvasTexture(canvas);
}

// ============================================================
// 아이템 아이콘 텍스처 (16x16)
// ============================================================

export function generatePotionIcon(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  ctx.clearRect(0, 0, 16, 16);
  // 병 목
  fillRect(ctx, 6, 1, 4, 3, '#BDBDBD');
  // 병 몸통
  fillRect(ctx, 4, 4, 8, 9, '#E0F7FA');
  fillRect(ctx, 5, 5, 6, 7, '#4FC3F7');
  // 빛나는 액체
  px(ctx, 6, 6, '#ffffff'); px(ctx, 7, 7, '#B3E5FC');
  // 코르크
  fillRect(ctx, 6, 0, 4, 1, '#8D6E63');
  return toCanvasTexture(canvas);
}

export function generateWeaponIcon(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  ctx.clearRect(0, 0, 16, 16);
  // 검날
  fillRect(ctx, 7, 1, 2, 9, '#B0BEC5');
  px(ctx, 6, 2, '#CFD8DC'); px(ctx, 9, 2, '#CFD8DC');
  // 코등이
  fillRect(ctx, 5, 10, 6, 1, '#FFD700');
  // 손잡이
  fillRect(ctx, 7, 11, 2, 4, '#795548');
  return toCanvasTexture(canvas);
}

export function generateArmorIcon(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(TEX_SIZE);
  ctx.clearRect(0, 0, 16, 16);
  // 갑옷 형태
  fillRect(ctx, 3, 2, 10, 12, '#78909C');
  fillRect(ctx, 5, 3, 6, 10, '#90A4AE');
  // 어깨
  fillRect(ctx, 1, 2, 2, 4, '#78909C');
  fillRect(ctx, 13, 2, 2, 4, '#78909C');
  // 장식
  fillRect(ctx, 7, 5, 2, 2, '#FFD700');
  return toCanvasTexture(canvas);
}

// ============================================================
// 텍스처 캐시 매니저
// ============================================================

export type MobTextureType = 'zombie' | 'skeleton' | 'slime' | 'spider' | 'creeper';
export type MinibossTextureType = 'golem' | 'wraith' | 'dragon_whelp' | 'lich_king' | 'the_arena';
export type ProjectileTextureType = 'straight' | 'homing' | 'pierce' | 'aoe';

const MOB_FACE_GENERATORS: Record<MobTextureType, () => THREE.CanvasTexture> = {
  zombie: generateZombieFace,
  skeleton: generateSkeletonFace,
  slime: generateSlimeFace,
  spider: generateSpiderFace,
  creeper: generateCreeperFace,
};

const MOB_BODY_GENERATORS: Record<MobTextureType, () => THREE.CanvasTexture> = {
  zombie: generateZombieBody,
  skeleton: generateSkeletonBody,
  slime: generateSlimeBody,
  spider: generateSpiderBody,
  creeper: generateCreeperBody,
};

const MINIBOSS_GENERATORS: Record<MinibossTextureType, () => THREE.CanvasTexture> = {
  golem: generateGolemTexture,
  wraith: generateWraithTexture,
  dragon_whelp: generateDragonWhelpTexture,
  lich_king: generateLichKingTexture,
  the_arena: generateTheArenaTexture,
};

const PROJECTILE_GENERATORS: Record<ProjectileTextureType, () => THREE.CanvasTexture> = {
  straight: generateArrowSprite,
  homing: generateMagicOrbSprite,
  pierce: generateBeamSprite,
  aoe: generateExplosionSprite,
};

class ArenaTextureCache {
  private mobFaces = new Map<string, THREE.CanvasTexture>();
  private mobBodies = new Map<string, THREE.CanvasTexture>();
  private miniboss = new Map<string, THREE.CanvasTexture>();
  private projectiles = new Map<string, THREE.CanvasTexture>();
  private particles = new Map<string, THREE.CanvasTexture>();
  private items = new Map<string, THREE.CanvasTexture>();

  getMobFace(type: MobTextureType): THREE.CanvasTexture {
    if (!this.mobFaces.has(type)) {
      this.mobFaces.set(type, MOB_FACE_GENERATORS[type]());
    }
    return this.mobFaces.get(type)!;
  }

  getMobBody(type: MobTextureType): THREE.CanvasTexture {
    if (!this.mobBodies.has(type)) {
      this.mobBodies.set(type, MOB_BODY_GENERATORS[type]());
    }
    return this.mobBodies.get(type)!;
  }

  getMiniboss(type: MinibossTextureType): THREE.CanvasTexture {
    if (!this.miniboss.has(type)) {
      this.miniboss.set(type, MINIBOSS_GENERATORS[type]());
    }
    return this.miniboss.get(type)!;
  }

  getProjectile(type: ProjectileTextureType): THREE.CanvasTexture {
    if (!this.projectiles.has(type)) {
      this.projectiles.set(type, PROJECTILE_GENERATORS[type]());
    }
    return this.projectiles.get(type)!;
  }

  getParticle(name: string, generator: () => THREE.CanvasTexture): THREE.CanvasTexture {
    if (!this.particles.has(name)) {
      this.particles.set(name, generator());
    }
    return this.particles.get(name)!;
  }

  getItem(name: string, generator: () => THREE.CanvasTexture): THREE.CanvasTexture {
    if (!this.items.has(name)) {
      this.items.set(name, generator());
    }
    return this.items.get(name)!;
  }

  /** 모든 텍스처 프리로드 */
  preloadAll(): void {
    const mobTypes: MobTextureType[] = ['zombie', 'skeleton', 'slime', 'spider', 'creeper'];
    for (const t of mobTypes) {
      this.getMobFace(t);
      this.getMobBody(t);
    }
    const minibossTypes: MinibossTextureType[] = ['golem', 'wraith', 'dragon_whelp', 'lich_king', 'the_arena'];
    for (const t of minibossTypes) {
      this.getMiniboss(t);
    }
    const projTypes: ProjectileTextureType[] = ['straight', 'homing', 'pierce', 'aoe'];
    for (const t of projTypes) {
      this.getProjectile(t);
    }
  }

  dispose(): void {
    for (const tex of this.mobFaces.values()) tex.dispose();
    for (const tex of this.mobBodies.values()) tex.dispose();
    for (const tex of this.miniboss.values()) tex.dispose();
    for (const tex of this.projectiles.values()) tex.dispose();
    for (const tex of this.particles.values()) tex.dispose();
    for (const tex of this.items.values()) tex.dispose();
    this.mobFaces.clear();
    this.mobBodies.clear();
    this.miniboss.clear();
    this.projectiles.clear();
    this.particles.clear();
    this.items.clear();
  }
}

/** 싱글톤 인스턴스 */
export const arenaTextureCache = new ArenaTextureCache();
