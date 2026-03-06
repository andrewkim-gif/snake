/**
 * cubeling-textures.ts -- 큐블링 캐릭터 텍스처 생성 모듈 (Phase 3)
 *
 * Color-Tint 전략: 흰색 base 텍스처 + setColorAt() 런타임 틴팅
 * - 패턴별 body base 텍스처 (solid/striped/dotted/gradient + checker/camo/zigzag/heart)
 * - 얼굴 텍스처 (눈12종 + 입8종 조합별)
 * - 머리카락 텍스처 시스템 (16 헤어스타일)
 * - 팔/다리 base 텍스처 (손/신발 표현 + 둥근 착시)
 * - LRU 캐시 매니저
 *
 * Phase 3 신규:
 *   - generateEyeTexture(eyeStyle) — 12종 눈 프로시저럴 (독립 함수)
 *   - generateMouthTexture(mouthStyle) — 8종 입 프로시저럴 (독립 함수)
 *   - generateHairTopTexture(hairStyle) — 16종 정수리 헤어 텍스처
 *   - generateHairBackTexture(hairStyle) — 16종 뒷머리 헤어 텍스처
 *   - generateHairSideTexture(hairStyle) — 16종 옆머리 헤어 텍스처
 *   - 둥근 착시 셰이딩 강화 (모든 파트에 적용)
 *   - 팔 손 영역 + 다리 신발 영역 개선
 *
 * 모든 텍스처: 16x16, NearestFilter, no mipmaps, SRGBColorSpace
 * Canvas 2D 프로시저럴 생성 -- 파일 불필요
 */

import * as THREE from 'three';
import { EYE_STYLES, MOUTH_STYLES } from '@agent-survivor/shared';
import type { FaceKey } from '@agent-survivor/shared';

// ─── 상수 ───

const TEX_SIZE = 16;

/** 눈 색상 키 매핑 */
const EYE_COLOR_MAP: Record<string, string> = {
  b: '#3A3028',   // 검정 (어두운 갈색)
  w: '#FFFFFF',   // 흰색
  h: '#CCDDFF',   // 하이라이트 (연보라/푸른빛)
  g: '#FFD700',   // 골드 (Star 눈)
  r: '#FF4444',   // 빨강 (Heart 눈)
  v: '#222222',   // 바이저 (Cool)
};

/** 입 색상 키 매핑 */
const MOUTH_COLOR_MAP: Record<string, string> = {
  d: '#8B4040',   // 어두운 피부톤 (입)
  w: '#FFFFFF',   // 흰색 (이빨)
};

// ─── Canvas 유틸 ───

function createCanvas(size = TEX_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function toCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── 둥근 착시 셰이딩 ───

/**
 * 라디얼 그라데이션으로 가장자리를 어둡게 처리
 * BoxGeometry인데 둥글게 보이는 착시 효과
 * Phase 3: innerRadius/outerRadius 파라미터로 강도 조절 가능
 */
export function applyRoundingShade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  innerRadius = 0.35,
  outerRadius = 0.55,
  opacity = 0.15,
): void {
  const gradient = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * innerRadius,
    w / 2, h / 2, Math.min(w, h) * outerRadius,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${opacity})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/**
 * 직사각형 엣지 비네팅 (사각형 파트용)
 * 좌/우 가장자리와 상/하 가장자리를 그라데이션으로 어둡게
 */
function applyEdgeVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  edgeWidth = 2,
  opacity = 0.10,
): void {
  const alphaStep = opacity / edgeWidth;
  for (let i = 0; i < edgeWidth; i++) {
    const alpha = (edgeWidth - i) * alphaStep;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    // 좌측 엣지
    ctx.fillRect(i, 0, 1, h);
    // 우측 엣지
    ctx.fillRect(w - 1 - i, 0, 1, h);
    // 상단 엣지
    ctx.fillRect(0, i, w, 1);
    // 하단 엣지
    ctx.fillRect(0, h - 1 - i, w, 1);
  }
}

// ─── 눈 스타일 12종 프로시저럴 생성 (독립 함수) ───

/**
 * 눈 텍스처를 Canvas에 직접 그리는 함수
 * 16x16 텍스처 내 눈 위치: 왼쪽 눈 (4, 5), 오른쪽 눈 (9, 5) (각 3x2)
 *
 * @param eyeStyle - 눈 스타일 인덱스 (0~11)
 * @returns 독립 16x16 CanvasTexture (눈만 그려진 상태, 나머지 투명)
 */
export function generateEyeTexture(eyeStyle: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  // 투명 배경
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  const eyeDef = EYE_STYLES[eyeStyle % EYE_STYLES.length];
  if (eyeDef) {
    for (const [px_x, px_y, colorKey] of eyeDef.pixels) {
      const color = EYE_COLOR_MAP[colorKey] ?? '#3A3028';
      // 왼쪽 눈
      px(ctx, 4 + px_x, 5 + px_y, color);
      // 오른쪽 눈
      // Wink(4)의 경우 오른쪽 눈은 감은 형태 — 특수 처리
      if (eyeStyle === 4) {
        // Wink: 오른쪽 눈은 가로 일자 (감은 눈)
        px(ctx, 9, 6, '#3A3028');
        px(ctx, 10, 6, '#3A3028');
        px(ctx, 11, 6, '#3A3028');
      } else {
        px(ctx, 9 + px_x, 5 + px_y, color);
      }
    }
  }

  return toCanvasTexture(canvas);
}

// ─── 입 스타일 8종 프로시저럴 생성 (독립 함수) ───

/**
 * 입 텍스처를 Canvas에 직접 그리는 함수
 * 16x16 텍스처 내 입 위치: (5, 11) 시작, 6x2 영역
 *
 * @param mouthStyle - 입 스타일 인덱스 (0~7)
 * @returns 독립 16x16 CanvasTexture (입만 그려진 상태, 나머지 투명)
 */
export function generateMouthTexture(mouthStyle: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  const mouthDef = MOUTH_STYLES[mouthStyle % MOUTH_STYLES.length];
  if (mouthDef) {
    for (const [px_x, px_y, colorKey] of mouthDef.pixels) {
      const color = MOUTH_COLOR_MAP[colorKey] ?? '#8B4040';
      px(ctx, 5 + px_x, 11 + px_y, color);
    }
  }

  return toCanvasTexture(canvas);
}

// ─── 머리카락 텍스처 시스템 (16 헤어스타일) ───

/**
 * 헤어스타일별 픽셀 패턴 정의
 *
 * 16종 헤어스타일:
 *  0: Buzz    — 짧은 커트 (모히칸 약간)
 *  1: Spiky   — 뾰족 머리
 *  2: Side    — 옆으로 넘김
 *  3: Long    — 긴 머리 (어깨까지)
 *  4: Curly   — 곱슬
 *  5: Mohawk  — 모히칸
 *  6: Bob     — 단발
 *  7: Ponytail— 포니테일 (뒤로 묶음)
 *  8: Afro    — 아프로 (부풀린)
 *  9: Flat    — 납작 다운
 * 10: Bowl    — 바가지
 * 11: Parted  — 가르마
 * 12: Shaggy  — 헝클어진
 * 13: Braids  — 땋은 머리
 * 14: Bald    — 대머리 (최소)
 * 15: Cap     — 비니/모자형
 *
 * 모두 흰색 base — setColorAt이 머리카락 색 결정
 */

/** 정수리(top face) 헤어 패턴 생성 */
export function generateHairTopTexture(hairStyle: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  // base 밝은 회색 (머리카락 영역)
  fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');

  switch (hairStyle) {
    case 0: // Buzz — 짧은 커트 (전체 가벼운 텍스처)
      for (let y = 0; y < 16; y += 2) {
        for (let x = (y % 4 === 0) ? 0 : 1; x < 16; x += 2) {
          px(ctx, x, y, '#E4E4E4');
        }
      }
      break;

    case 1: // Spiky — 뾰족 (방사형 선)
      for (let i = 0; i < 16; i += 3) {
        fillRect(ctx, i, 0, 1, 16, '#E0E0E0');
        fillRect(ctx, 0, i, 16, 1, '#E0E0E0');
      }
      break;

    case 2: // Side — 옆으로 넘김 (사선)
      for (let y = 0; y < 16; y++) {
        fillRect(ctx, 0, y, Math.min(16, y + 4), 1, '#EDEDED');
      }
      // 가르마 — 좌측
      fillRect(ctx, 2, 0, 1, 16, '#DADADA');
      break;

    case 3: // Long — 긴 머리 (세로 흐름)
      for (let x = 0; x < 16; x += 2) {
        fillRect(ctx, x, 0, 1, 16, '#E8E8E8');
      }
      break;

    case 4: // Curly — 곱슬 (불규칙 도트)
      for (let y = 0; y < 16; y += 3) {
        for (let x = (y % 6 < 3) ? 1 : 0; x < 16; x += 3) {
          fillRect(ctx, x, y, 2, 2, '#E4E4E4');
        }
      }
      break;

    case 5: // Mohawk — 중앙 볼록
      fillRect(ctx, 6, 0, 4, 16, '#EAEAEA');
      fillRect(ctx, 7, 0, 2, 16, '#E0E0E0');
      break;

    case 6: // Bob — 단발 (고른 분포)
      fillRect(ctx, 0, 0, 16, 16, '#EDEDED');
      fillRect(ctx, 7, 0, 2, 16, '#E0E0E0');
      break;

    case 7: // Ponytail — 가르마 + 뒤쪽 집중
      fillRect(ctx, 7, 0, 2, 16, '#E0E0E0');
      fillRect(ctx, 6, 10, 4, 6, '#E4E4E4');
      break;

    case 8: // Afro — 부풀린 (전체 밀도 높음)
      fillRect(ctx, 0, 0, 16, 16, '#E8E8E8');
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          px(ctx, x, y, '#DEDEDE');
        }
      }
      break;

    case 9: // Flat — 납작 (가르마 강조)
      fillRect(ctx, 7, 0, 2, 16, '#DADADA');
      fillRect(ctx, 0, 0, 7, 16, '#EDEDED');
      fillRect(ctx, 9, 0, 7, 16, '#EDEDED');
      break;

    case 10: // Bowl — 바가지 (가장자리 진하게)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.04 * (3 - i)})`;
        ctx.fillRect(i, i, 16 - i * 2, 16 - i * 2);
      }
      break;

    case 11: // Parted — 가르마
      fillRect(ctx, 0, 0, 16, 16, '#EDEDED');
      fillRect(ctx, 7, 0, 2, 16, '#D8D8D8');
      // 좌우 방향 흐름
      for (let y = 0; y < 16; y += 3) {
        fillRect(ctx, 0, y, 7, 1, '#E4E4E4');
        fillRect(ctx, 9, y, 7, 1, '#E4E4E4');
      }
      break;

    case 12: // Shaggy — 헝클어진
      for (let y = 0; y < 16; y++) {
        const offset = (y * 7 + 3) % 5;
        for (let x = offset; x < 16; x += 5) {
          fillRect(ctx, x, y, 2, 1, '#E0E0E0');
        }
      }
      break;

    case 13: // Braids — 땋은 머리 (X자 패턴)
      fillRect(ctx, 0, 0, 16, 16, '#EDEDED');
      for (let y = 0; y < 16; y += 4) {
        px(ctx, 4, y, '#DADADA'); px(ctx, 5, y + 1, '#DADADA');
        px(ctx, 4, y + 2, '#DADADA'); px(ctx, 5, y + 3, '#DADADA');
        px(ctx, 10, y, '#DADADA'); px(ctx, 11, y + 1, '#DADADA');
        px(ctx, 10, y + 2, '#DADADA'); px(ctx, 11, y + 3, '#DADADA');
      }
      break;

    case 14: // Bald — 대머리 (거의 투명)
      fillRect(ctx, 0, 0, 16, 16, '#FAFAFA');
      break;

    case 15: // Cap — 비니 (가로 줄)
      for (let y = 0; y < 16; y++) {
        fillRect(ctx, 0, y, 16, 1, y % 3 === 0 ? '#E0E0E0' : '#EDEDED');
      }
      break;
  }

  applyRoundingShade(ctx, 16, 16);
  return toCanvasTexture(canvas);
}

/** 뒷머리(back face) 헤어 패턴 생성 */
export function generateHairBackTexture(hairStyle: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 상단: 머리카락, 하단: 목/피부 (흰색)
  fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
  fillRect(ctx, 2, 12, 12, 4, '#FFFFFF'); // 목/피부 영역

  switch (hairStyle) {
    case 0: // Buzz — 짧은 커트 (목 노출)
      fillRect(ctx, 2, 10, 12, 2, '#FFFFFF');
      break;

    case 1: // Spiky — 뾰족 (상단 돌출)
      for (let x = 1; x < 15; x += 3) {
        fillRect(ctx, x, 0, 2, 3, '#E4E4E4');
      }
      break;

    case 2: // Side — 한쪽으로 넘김
      for (let y = 0; y < 10; y++) {
        fillRect(ctx, 0, y, 16 - y, 1, '#EDEDED');
      }
      break;

    case 3: // Long — 긴 머리 (아래까지 덮음)
      fillRect(ctx, 0, 0, 16, 16, '#EDEDED');
      for (let x = 0; x < 16; x += 2) {
        fillRect(ctx, x, 0, 1, 16, '#E4E4E4');
      }
      // 끝단 가볍게
      fillRect(ctx, 0, 14, 16, 2, '#F4F4F4');
      break;

    case 4: // Curly — 곱슬 (둥근 패턴)
      for (let y = 0; y < 12; y += 3) {
        for (let x = (y % 6 < 3) ? 1 : 0; x < 16; x += 3) {
          fillRect(ctx, x, y, 2, 2, '#E4E4E4');
        }
      }
      break;

    case 5: // Mohawk — 뒷쪽은 짧음
      fillRect(ctx, 0, 0, 16, 12, '#F4F4F4');
      fillRect(ctx, 6, 0, 4, 8, '#E4E4E4'); // 중앙만 볼록
      break;

    case 6: // Bob — 단발 (턱선까지)
      fillRect(ctx, 0, 0, 16, 14, '#EDEDED');
      // 끝라인
      fillRect(ctx, 1, 12, 14, 1, '#E0E0E0');
      break;

    case 7: // Ponytail — 꼬리 표현
      fillRect(ctx, 5, 8, 6, 8, '#E8E8E8');
      fillRect(ctx, 6, 12, 4, 4, '#E0E0E0');
      // 묶인 부분
      fillRect(ctx, 6, 8, 4, 2, '#DADADA');
      break;

    case 8: // Afro — 크고 둥근
      fillRect(ctx, 0, 0, 16, 16, '#E8E8E8');
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          px(ctx, x, y, '#DEDEDE');
        }
      }
      break;

    case 9: // Flat — 납작
      fillRect(ctx, 0, 0, 16, 10, '#EDEDED');
      break;

    case 10: // Bowl — 바가지 (정돈된 라인)
      fillRect(ctx, 0, 0, 16, 12, '#EDEDED');
      fillRect(ctx, 0, 10, 16, 2, '#E0E0E0'); // 컷라인
      break;

    case 11: // Parted
      fillRect(ctx, 0, 0, 16, 12, '#EDEDED');
      fillRect(ctx, 7, 0, 2, 12, '#D8D8D8');
      break;

    case 12: // Shaggy — 헝클어진 (삐죽)
      for (let x = 0; x < 16; x++) {
        const h = 8 + ((x * 5 + 3) % 5);
        fillRect(ctx, x, 0, 1, h, '#EDEDED');
      }
      break;

    case 13: // Braids — 땋은 머리 (두 줄)
      fillRect(ctx, 3, 4, 3, 12, '#E8E8E8');
      fillRect(ctx, 10, 4, 3, 12, '#E8E8E8');
      for (let y = 4; y < 16; y += 2) {
        px(ctx, 4, y, '#DADADA');
        px(ctx, 11, y, '#DADADA');
      }
      break;

    case 14: // Bald
      fillRect(ctx, 0, 0, 16, 16, '#FAFAFA');
      fillRect(ctx, 2, 12, 12, 4, '#FFFFFF');
      break;

    case 15: // Cap — 비니 (뒤쪽도 덮음)
      for (let y = 0; y < 12; y++) {
        fillRect(ctx, 0, y, 16, 1, y % 3 === 0 ? '#E0E0E0' : '#EDEDED');
      }
      break;
  }

  // 외곽 약간 어둡게
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#E0E0E0');
    px(ctx, 15, y, '#E0E0E0');
  }

  applyRoundingShade(ctx, 16, 16);
  return toCanvasTexture(canvas);
}

/** 옆머리(side face) 헤어 패턴 생성 */
export function generateHairSideTexture(hairStyle: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // base: 피부색 (흰색)
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  // 기본: 상단 머리카락 영역
  const hairHeight = getHairSideHeight(hairStyle);
  fillRect(ctx, 0, 0, 16, hairHeight, '#F0F0F0');

  // 옆머리 사이드번 영역
  const sideburnDepth = getHairSideburnDepth(hairStyle);
  if (sideburnDepth > 0) {
    fillRect(ctx, 0, hairHeight, sideburnDepth, 4, '#E8E8E8');
    fillRect(ctx, 16 - sideburnDepth, hairHeight, sideburnDepth, 4, '#E8E8E8');
  }

  // 스타일별 추가 디테일
  switch (hairStyle) {
    case 1: // Spiky — 뾰족 돌출
      for (let x = 1; x < 15; x += 4) {
        fillRect(ctx, x, 0, 2, 2, '#E4E4E4');
      }
      break;

    case 3: // Long — 긴 머리 (옆면도 덮음)
      fillRect(ctx, 0, 0, 16, 14, '#EDEDED');
      for (let y = 0; y < 14; y += 2) {
        fillRect(ctx, 0, y, 16, 1, '#E8E8E8');
      }
      break;

    case 4: // Curly — 곱슬 (볼륨)
      for (let y = 0; y < hairHeight; y += 3) {
        for (let x = 0; x < 16; x += 3) {
          fillRect(ctx, x, y, 2, 2, '#E4E4E4');
        }
      }
      break;

    case 8: // Afro — 양쪽 부풀림
      fillRect(ctx, 0, 0, 16, 12, '#E8E8E8');
      for (let y = 0; y < 12; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          px(ctx, x, y, '#DEDEDE');
        }
      }
      break;

    case 10: // Bowl — 바가지 (정돈된 컷라인)
      fillRect(ctx, 0, hairHeight - 1, 16, 1, '#E0E0E0');
      break;

    case 15: // Cap — 비니
      fillRect(ctx, 0, 0, 16, hairHeight, '#EDEDED');
      for (let y = 0; y < hairHeight; y++) {
        if (y % 3 === 0) fillRect(ctx, 0, y, 16, 1, '#E0E0E0');
      }
      break;
  }

  // 귀 표시 (hairStyle 14=Bald 제외하고 대부분 표시)
  if (hairStyle !== 8 && hairStyle !== 15) { // Afro, Cap은 귀 가림
    px(ctx, 7, 7, '#E8E8E8');
    px(ctx, 8, 7, '#E8E8E8');
    px(ctx, 7, 8, '#E0E0E0');
    px(ctx, 8, 8, '#E0E0E0');
  }

  applyRoundingShade(ctx, 16, 16);
  return toCanvasTexture(canvas);
}

/** 헤어스타일별 옆면 머리카락 높이 (0~16 중 상단부터) */
function getHairSideHeight(hairStyle: number): number {
  const heights: Record<number, number> = {
    0: 4,   // Buzz
    1: 5,   // Spiky
    2: 6,   // Side
    3: 14,  // Long
    4: 8,   // Curly
    5: 4,   // Mohawk (옆은 짧음)
    6: 10,  // Bob
    7: 5,   // Ponytail
    8: 12,  // Afro
    9: 5,   // Flat
    10: 8,  // Bowl
    11: 6,  // Parted
    12: 7,  // Shaggy
    13: 6,  // Braids
    14: 2,  // Bald
    15: 8,  // Cap
  };
  return heights[hairStyle] ?? 5;
}

/** 헤어스타일별 사이드번 깊이 */
function getHairSideburnDepth(hairStyle: number): number {
  const depths: Record<number, number> = {
    0: 1, 1: 2, 2: 3, 3: 0, 4: 3,
    5: 0, 6: 0, 7: 2, 8: 0, 9: 1,
    10: 0, 11: 2, 12: 2, 13: 2, 14: 0, 15: 0,
  };
  return depths[hairStyle] ?? 1;
}

// ─── 패턴별 Body Base 텍스처 (흰색 base) ───

/**
 * 패턴별 body base 텍스처 생성
 * 흰색 base -- setColorAt()이 최종 색상 결정
 * 패턴은 밝기 차이로 표현 (흰/연회색)
 *
 * Phase 3: 둥근 착시 셰이딩 강화 + 목/어깨 라인 추가
 *
 * @param pattern - PatternType 인덱스 (0=solid, 1=striped, 2=dotted, 3=gradient, 4~7)
 */
export function generateBodyBase(pattern: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 흰색 base
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  switch (pattern) {
    case 1: // striped -- 줄무늬
      for (let y = 0; y < 16; y++) {
        if (y % 4 < 2) {
          fillRect(ctx, 0, y, 16, 1, '#E0E0E0');
        }
      }
      break;

    case 2: // dotted -- 도트
      for (let y = 1; y < 15; y += 3) {
        for (let x = 1; x < 15; x += 3) {
          fillRect(ctx, x, y, 2, 2, '#E8E8E8');
        }
      }
      break;

    case 3: // gradient -- 세로 그라데이션 (위->아래 밝기 변화)
      for (let y = 0; y < 16; y++) {
        const brightness = Math.round(255 - (y / 15) * 40); // 255->215
        const hex = brightness.toString(16).padStart(2, '0');
        fillRect(ctx, 0, y, 16, 1, `#${hex}${hex}${hex}`);
      }
      break;

    case 4: // checker -- 체커보드
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          if ((x + y) % 4 === 0) {
            fillRect(ctx, x, y, 2, 2, '#E0E0E0');
          }
        }
      }
      break;

    case 5: // camo -- 카모 패턴
      fillRect(ctx, 2, 1, 5, 3, '#E0E0E0');
      fillRect(ctx, 9, 4, 4, 4, '#D8D8D8');
      fillRect(ctx, 1, 8, 6, 3, '#E0E0E0');
      fillRect(ctx, 10, 10, 5, 4, '#E0E0E0');
      fillRect(ctx, 4, 12, 3, 3, '#D8D8D8');
      break;

    case 6: // zigzag -- 지그재그
      for (let y = 0; y < 16; y++) {
        const offset = (y % 4 < 2) ? 0 : 4;
        for (let x = offset; x < 16; x += 8) {
          fillRect(ctx, x, y, 4, 1, '#E0E0E0');
        }
      }
      break;

    case 7: // heart -- 하트 무늬
      px(ctx, 5, 5, '#E8E8E8'); px(ctx, 6, 5, '#E8E8E8');
      px(ctx, 9, 5, '#E8E8E8'); px(ctx, 10, 5, '#E8E8E8');
      fillRect(ctx, 4, 6, 8, 1, '#E8E8E8');
      fillRect(ctx, 5, 7, 6, 1, '#E8E8E8');
      fillRect(ctx, 6, 8, 4, 1, '#E8E8E8');
      fillRect(ctx, 7, 9, 2, 1, '#E8E8E8');
      break;

    // case 0 (solid): 이미 흰색으로 채워져 있음
  }

  // 목/어깨 라인 (상단 2행 — 약간 어둡게)
  fillRect(ctx, 1, 0, 14, 1, '#F0F0F0');
  fillRect(ctx, 2, 1, 12, 1, '#F4F4F4');

  // 외곽선 (약간 어둡게)
  for (let i = 0; i < 16; i++) {
    px(ctx, i, 0, '#E8E8E8');
    px(ctx, i, 15, '#E8E8E8');
    px(ctx, 0, i, '#E8E8E8');
    px(ctx, 15, i, '#E8E8E8');
  }

  // 벨트 라인 (하단)
  fillRect(ctx, 1, 13, 14, 2, '#D0D0D0');

  // 둥근 착시 + 엣지 비네팅
  applyRoundingShade(ctx, 16, 16);
  applyEdgeVignette(ctx, 16, 16, 2, 0.08);

  return toCanvasTexture(canvas);
}

// ─── 팔 Base 텍스처 ───

/**
 * 팔 base 텍스처 (흰색 base)
 * Phase 3: 손 영역 개선 (하단 4px를 밝은 톤 + 손가락 표현)
 *
 * 상단 Row 0-9:  소매 (흰색, 패턴 무관)
 * 중간 Row 10-11: 소매 끝/손목 (약간 어두운 경계)
 * 하단 Row 12-15: 손 영역 (밝은 피부톤 base)
 */
export function generateArmBase(_pattern: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 소매 영역 (흰색)
  fillRect(ctx, 0, 0, 16, 10, '#FFFFFF');

  // 소매 끝 경계선 (커프스)
  fillRect(ctx, 0, 10, 16, 2, '#ECECEC');

  // 손 영역 (밝은 톤 -- 피부톤 setColorAt이 틴팅)
  fillRect(ctx, 0, 12, 16, 4, '#F8F8F8');

  // 손가락 표현 (하단 1px에 미세한 구분선)
  px(ctx, 4, 15, '#EEEEEE');
  px(ctx, 8, 15, '#EEEEEE');
  px(ctx, 12, 15, '#EEEEEE');

  // 외곽선
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#E8E8E8');
    px(ctx, 15, y, '#E8E8E8');
  }

  // 둥근 착시 + 엣지 비네팅
  applyRoundingShade(ctx, 16, 16);
  applyEdgeVignette(ctx, 16, 16, 1, 0.06);

  return toCanvasTexture(canvas);
}

// ─── 다리 Base 텍스처 ───

/**
 * 다리 base 텍스처 (흰색 base)
 * Phase 3: 신발 영역 개선 (하단 4px — 발등/밑창 구분)
 *
 * 상단 Row 0-11: 바지 (흰색)
 * 하단 Row 12-15: 신발 (어두운 톤 — 패턴 포함)
 */
export function generateLegBase(_pattern: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 바지 영역 (흰색)
  fillRect(ctx, 0, 0, 16, 12, '#FFFFFF');

  // 신발 상단 (발등 — 약간 어두움)
  fillRect(ctx, 0, 12, 16, 2, '#C8C8C8');
  // 신발 밑창 (더 어두움)
  fillRect(ctx, 0, 14, 16, 2, '#B0B0B0');
  // 신발 측면 하이라이트 (반사)
  px(ctx, 3, 12, '#D0D0D0');
  px(ctx, 4, 12, '#D4D4D4');
  // 신발 끈/장식 라인
  fillRect(ctx, 2, 13, 12, 1, '#BEBEBE');

  // 외곽선
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#E8E8E8');
    px(ctx, 15, y, '#E8E8E8');
  }

  // 둥근 착시 + 엣지 비네팅
  applyRoundingShade(ctx, 16, 16);
  applyEdgeVignette(ctx, 16, 16, 1, 0.06);

  return toCanvasTexture(canvas);
}

// ─── 얼굴 텍스처 (Head 앞면) ───

/**
 * 눈+입 조합별 얼굴 텍스처 생성
 * 흰색 base -- 머리카락/피부톤은 setColorAt으로 틴팅
 * 눈/입은 고유 색상 (검정, 하이라이트 등)
 *
 * Phase 3 레이아웃 (16x16):
 *   Row 0-3:   머리카락 영역 (연회색 -> setColorAt이 머리카락색으로 틴팅)
 *   Row 4:     이마 전환 영역
 *   Row 5-6:   눈 영역 (3x2 per eye, 왼(4,5) 오(9,5))
 *   Row 7-8:   볼 영역
 *   Row 9:     코 (약간 어둡게)
 *   Row 10:    입 위 여백
 *   Row 11-12: 입 영역 (6x2, 시작 (5,11))
 *   Row 13:    턱
 *   Row 14-15: 하단 모서리 (둥근 착시 강화)
 */
export function generateFaceTexture(
  eyeStyle: number,
  mouthStyle: number,
  _marking: number = 0,
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 전체를 피부톤 base (흰색 -- setColorAt이 피부색으로 만듦)
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  // 머리카락 영역 (상단 4행) -- 약간 밝은 회색
  // setColorAt으로 머리카락 색이 곱해지면 자연스럽게 표현
  fillRect(ctx, 0, 0, 16, 4, '#F0F0F0');
  // 옆머리 (Row 4~7 양쪽)
  fillRect(ctx, 0, 4, 2, 4, '#E8E8E8');
  fillRect(ctx, 14, 4, 2, 4, '#E8E8E8');

  // 눈 그리기 (3x2 per eye)
  const eyeDef = EYE_STYLES[eyeStyle % EYE_STYLES.length];
  if (eyeDef) {
    // Wink(4): 오른쪽 눈만 특수 처리 (감은 눈)
    if (eyeStyle === 4) {
      // 왼쪽 눈: 정상
      for (const [px_x, px_y, colorKey] of eyeDef.pixels) {
        const color = EYE_COLOR_MAP[colorKey] ?? '#3A3028';
        px(ctx, 4 + px_x, 5 + px_y, color);
      }
      // 오른쪽 눈: 감은 눈 (가로 일자)
      px(ctx, 9, 6, '#3A3028');
      px(ctx, 10, 6, '#3A3028');
      px(ctx, 11, 6, '#3A3028');
    } else {
      for (const [px_x, px_y, colorKey] of eyeDef.pixels) {
        const color = EYE_COLOR_MAP[colorKey] ?? '#3A3028';
        // 왼쪽 눈
        px(ctx, 4 + px_x, 5 + px_y, color);
        // 오른쪽 눈 (좌우 대칭)
        px(ctx, 9 + px_x, 5 + px_y, color);
      }
    }
  }

  // 볼 블러시 (약간의 붉은 기운 -- 밝기 차이로 표현)
  px(ctx, 2, 8, '#F8F8F8');
  px(ctx, 3, 8, '#F8F8F8');
  px(ctx, 12, 8, '#F8F8F8');
  px(ctx, 13, 8, '#F8F8F8');

  // 코 (Row 9, 중앙 2px)
  px(ctx, 7, 9, '#E8E8E8');
  px(ctx, 8, 9, '#E8E8E8');

  // 입 그리기 (Row 11~12, 6x2 영역, 시작점 (5, 11))
  const mouthDef = MOUTH_STYLES[mouthStyle % MOUTH_STYLES.length];
  if (mouthDef) {
    for (const [px_x, px_y, colorKey] of mouthDef.pixels) {
      const color = MOUTH_COLOR_MAP[colorKey] ?? '#8B4040';
      px(ctx, 5 + px_x, 11 + px_y, color);
    }
  }

  // 하단 모서리 어둡게 (둥근 착시 강화)
  fillRect(ctx, 0, 14, 2, 2, '#EAEAEA');
  fillRect(ctx, 14, 14, 2, 2, '#EAEAEA');
  // 볼/턱 라인 (Row 13)
  px(ctx, 0, 13, '#ECECEC');
  px(ctx, 15, 13, '#ECECEC');

  // 전체 둥근 착시 (얼굴은 약한 셰이딩)
  applyRoundingShade(ctx, 16, 16, 0.40, 0.60, 0.10);

  return toCanvasTexture(canvas);
}

// ─── Head 기타 면 텍스처 (헤어스타일 기반) ───

/**
 * 머리 상단(정수리) -- 헤어스타일별 텍스처 (흰색 base -> setColorAt 머리색)
 * Phase 3: hairStyle 파라미터 추가, 기본 0 (하위 호환)
 */
export function generateHeadTopBase(hairStyle = 0): THREE.CanvasTexture {
  return generateHairTopTexture(hairStyle);
}

/**
 * 머리 뒷면 -- 헤어스타일별 뒷머리 (흰색 base -> setColorAt 머리색)
 * Phase 3: hairStyle 파라미터 추가
 */
export function generateHeadBackBase(hairStyle = 0): THREE.CanvasTexture {
  return generateHairBackTexture(hairStyle);
}

/**
 * 머리 옆면 -- 헤어스타일별 옆머리 (흰색 base -> setColorAt 혼합)
 * Phase 3: hairStyle 파라미터 추가
 */
export function generateHeadSideBase(hairStyle = 0): THREE.CanvasTexture {
  return generateHairSideTexture(hairStyle);
}

/** 머리 하단(턱) -- 피부톤 (흰색 base -> setColorAt 피부색) */
export function generateHeadBottomBase(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
  applyRoundingShade(ctx, 16, 16, 0.30, 0.50, 0.08);
  return toCanvasTexture(canvas);
}

// ─── 얼굴 6-Material 세트 생성 ───

/**
 * Head용 6-material 배열 생성 (BoxGeometry face order)
 * [0]+X=front(얼굴), [1]-X=back, [2]+Y=top, [3]-Y=bottom, [4]+Z=left, [5]-Z=right
 * 모든 material.color = white -- setColorAt으로 틴팅
 *
 * Phase 3: hairStyle 파라미터 추가 -- 머리 비-앞면에 헤어스타일 반영
 */
export function createHeadMaterials(
  eyeStyle: number,
  mouthStyle: number,
  marking = 0,
  hairStyle = 0,
): THREE.MeshLambertMaterial[] {
  const frontTex = generateFaceTexture(eyeStyle, mouthStyle, marking);
  const backTex = generateHeadBackBase(hairStyle);
  const topTex = generateHeadTopBase(hairStyle);
  const bottomTex = generateHeadBottomBase();
  const sideTex = generateHeadSideBase(hairStyle);

  return [
    new THREE.MeshLambertMaterial({ map: frontTex, color: 0xffffff }),   // +X 앞면(얼굴)
    new THREE.MeshLambertMaterial({ map: backTex, color: 0xffffff }),    // -X 뒷면
    new THREE.MeshLambertMaterial({ map: topTex, color: 0xffffff }),     // +Y 정수리
    new THREE.MeshLambertMaterial({ map: bottomTex, color: 0xffffff }), // -Y 턱
    new THREE.MeshLambertMaterial({ map: sideTex, color: 0xffffff }),   // +Z 왼쪽
    new THREE.MeshLambertMaterial({ map: sideTex, color: 0xffffff }),   // -Z 오른쪽
  ];
}

// ─── 텍스처 캐시 매니저 ───

interface CacheEntry<T> {
  value: T;
  lastUsed: number;
}

/**
 * LRU 캐시 관리자
 * 최대 maxSize 항목 유지, 초과 시 가장 오래된 항목 삭제 + dispose
 *
 * Phase 3: 얼굴 캐시 키에 hairStyle 포함 (FaceKey 확장)
 */
export class TextureCacheManager {
  /** 얼굴 텍스처 캐시: FaceKey -> 6-material 배열 */
  private faceCache = new Map<string, CacheEntry<THREE.MeshLambertMaterial[]>>();
  /** body 패턴 텍스처 캐시: pattern -> CanvasTexture */
  private bodyCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();
  /** arm base 텍스처 캐시 */
  private armCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();
  /** leg base 텍스처 캐시 */
  private legCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();
  /** 눈 텍스처 캐시: eyeStyle -> CanvasTexture */
  private eyeCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();
  /** 입 텍스처 캐시: mouthStyle -> CanvasTexture */
  private mouthCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();

  private maxSize: number;

  constructor(maxSize = 60) {
    this.maxSize = maxSize;
  }

  /** 얼굴 material 세트 가져오기 (캐시) */
  getFaceMaterials(
    faceKey: FaceKey,
    eyeStyle: number,
    mouthStyle: number,
    marking = 0,
    hairStyle = 0,
  ): THREE.MeshLambertMaterial[] {
    // Phase 3: 헤어스타일 포함한 확장 키
    const extKey = `${faceKey}-h${hairStyle}`;
    const cached = this.faceCache.get(extKey);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const mats = createHeadMaterials(eyeStyle, mouthStyle, marking, hairStyle);
    this.faceCache.set(extKey, { value: mats, lastUsed: performance.now() });
    return mats;
  }

  /** body 패턴 텍스처 가져오기 (캐시) */
  getBodyTexture(pattern: number): THREE.CanvasTexture {
    const cached = this.bodyCache.get(pattern);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const tex = generateBodyBase(pattern);
    this.bodyCache.set(pattern, { value: tex, lastUsed: performance.now() });
    return tex;
  }

  /** arm base 텍스처 가져오기 (캐시) */
  getArmTexture(pattern: number): THREE.CanvasTexture {
    const cached = this.armCache.get(pattern);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const tex = generateArmBase(pattern);
    this.armCache.set(pattern, { value: tex, lastUsed: performance.now() });
    return tex;
  }

  /** leg base 텍스처 가져오기 (캐시) */
  getLegTexture(pattern: number): THREE.CanvasTexture {
    const cached = this.legCache.get(pattern);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const tex = generateLegBase(pattern);
    this.legCache.set(pattern, { value: tex, lastUsed: performance.now() });
    return tex;
  }

  /** 눈 텍스처 가져오기 (캐시) */
  getEyeTexture(eyeStyle: number): THREE.CanvasTexture {
    const cached = this.eyeCache.get(eyeStyle);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const tex = generateEyeTexture(eyeStyle);
    this.eyeCache.set(eyeStyle, { value: tex, lastUsed: performance.now() });
    return tex;
  }

  /** 입 텍스처 가져오기 (캐시) */
  getMouthTexture(mouthStyle: number): THREE.CanvasTexture {
    const cached = this.mouthCache.get(mouthStyle);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const tex = generateMouthTexture(mouthStyle);
    this.mouthCache.set(mouthStyle, { value: tex, lastUsed: performance.now() });
    return tex;
  }

  /** LRU 정리: maxSize 초과 시 가장 오래된 얼굴 캐시 삭제 */
  cleanup(): void {
    if (this.faceCache.size <= this.maxSize) return;

    const entries = [...this.faceCache.entries()]
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toRemove = entries.slice(0, entries.length - this.maxSize);
    for (const [key, entry] of toRemove) {
      for (const mat of entry.value) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
      this.faceCache.delete(key);
    }
  }

  /** 전체 해제 */
  dispose(): void {
    this.faceCache.forEach(entry => {
      for (const mat of entry.value) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    });
    this.faceCache.clear();

    this.bodyCache.forEach(entry => entry.value.dispose());
    this.bodyCache.clear();

    this.armCache.forEach(entry => entry.value.dispose());
    this.armCache.clear();

    this.legCache.forEach(entry => entry.value.dispose());
    this.legCache.clear();

    this.eyeCache.forEach(entry => entry.value.dispose());
    this.eyeCache.clear();

    this.mouthCache.forEach(entry => entry.value.dispose());
    this.mouthCache.clear();
  }

  /** 캐시 크기 반환 */
  get size(): number {
    return (
      this.faceCache.size +
      this.bodyCache.size +
      this.armCache.size +
      this.legCache.size +
      this.eyeCache.size +
      this.mouthCache.size
    );
  }
}

// ─── Phase 5: 장비 텍스처 생성 ───

/**
 * 모자 프로시저럴 텍스처 (16x16, 흰색 base → setColorAt 틴팅)
 *
 * 8종 모자:
 *  crown — 왕관 (톱니 형태)
 *  helmet — 헬멧 (반구형 덮개)
 *  cap — 모자 (챙 있음)
 *  hood — 후드 (두건)
 *  halo — 후광 (반투명 링)
 *  horns — 뿔 (바이킹)
 *  propeller — 프로펠러 (모자)
 *  tophat — 탑햇 (높은 모자)
 */
export function generateHatTexture(hatGeometryType: string): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  switch (hatGeometryType) {
    case 'crown':
      // 왕관 톱니 패턴 (상단)
      fillRect(ctx, 0, 6, 16, 10, '#F0F0F0');
      // 톱니
      fillRect(ctx, 1, 0, 2, 6, '#F4F4F4');
      fillRect(ctx, 5, 0, 2, 6, '#F4F4F4');
      fillRect(ctx, 9, 0, 2, 6, '#F4F4F4');
      fillRect(ctx, 13, 0, 2, 6, '#F4F4F4');
      // 보석 장식
      px(ctx, 2, 2, '#E0E0E0');
      px(ctx, 6, 2, '#E0E0E0');
      px(ctx, 10, 2, '#E0E0E0');
      px(ctx, 14, 2, '#E0E0E0');
      // 하단 밴드
      fillRect(ctx, 0, 14, 16, 2, '#D8D8D8');
      break;

    case 'helmet':
      // 헬멧 (볼록한 형태)
      fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
      // 상단 볼록 하이라이트
      fillRect(ctx, 3, 2, 10, 3, '#F8F8F8');
      // 하단 가드
      fillRect(ctx, 0, 12, 16, 4, '#E0E0E0');
      // 외곽
      for (let y = 0; y < 16; y++) {
        px(ctx, 0, y, '#E4E4E4');
        px(ctx, 15, y, '#E4E4E4');
      }
      // 리벳 장식
      px(ctx, 4, 8, '#D0D0D0');
      px(ctx, 11, 8, '#D0D0D0');
      break;

    case 'hat':
      // 마법사/챙모자
      fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
      // 뾰족한 상단
      fillRect(ctx, 6, 0, 4, 4, '#F4F4F4');
      fillRect(ctx, 7, 0, 2, 2, '#F8F8F8');
      // 챙 (하단)
      fillRect(ctx, 0, 12, 16, 4, '#E4E4E4');
      // 별 장식 (마법사풍)
      px(ctx, 7, 7, '#E8E8E8');
      px(ctx, 8, 7, '#E8E8E8');
      px(ctx, 7, 8, '#E8E8E8');
      px(ctx, 8, 8, '#E8E8E8');
      break;
  }

  applyRoundingShade(ctx, 16, 16, 0.35, 0.55, 0.10);
  return toCanvasTexture(canvas);
}

/**
 * 무기 프로시저럴 텍스처 (16x16, 흰색 base → setColorAt 틴팅)
 *
 * 6종 무기:
 *  sword(blade) — 검 (날+가드+손잡이)
 *  axe(blade) — 도끼 (넓은 날)
 *  staff — 지팡이 (긴 봉)
 *  bow(blade) — 활 (곡선)
 *  shield(blade) — 방패
 *  wand(staff) — 완드
 */
export function generateWeaponTexture(weaponGeometryType: string): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  switch (weaponGeometryType) {
    case 'blade':
      // 검 날 (상단 밝은 부분)
      fillRect(ctx, 5, 0, 6, 10, '#F4F4F4');
      // 날 하이라이트
      fillRect(ctx, 6, 1, 2, 8, '#FAFAFA');
      // 가드 (중간)
      fillRect(ctx, 2, 10, 12, 2, '#D0D0D0');
      // 손잡이 (하단)
      fillRect(ctx, 6, 12, 4, 4, '#C8C8C8');
      // 외곽선
      for (let y = 0; y < 10; y++) {
        px(ctx, 5, y, '#E0E0E0');
        px(ctx, 10, y, '#E0E0E0');
      }
      break;

    case 'staff':
      // 봉 (중앙 세로)
      fillRect(ctx, 6, 0, 4, 16, '#F0F0F0');
      // 봉 하이라이트
      fillRect(ctx, 7, 0, 2, 16, '#F4F4F4');
      // 상단 장식 (보석/불꽃)
      fillRect(ctx, 4, 0, 8, 4, '#E8E8E8');
      fillRect(ctx, 5, 0, 6, 3, '#F0F0F0');
      px(ctx, 7, 1, '#FAFAFA');
      px(ctx, 8, 1, '#FAFAFA');
      // 하단 (그립)
      fillRect(ctx, 6, 13, 4, 3, '#D0D0D0');
      break;
  }

  applyRoundingShade(ctx, 16, 16, 0.30, 0.50, 0.08);
  return toCanvasTexture(canvas);
}

/**
 * 등 장비 프로시저럴 텍스처 (16x16, 흰색 base → setColorAt 틴팅)
 *
 * 5종 등 아이템:
 *  cape — 망토 (직물 패턴)
 *  wings — 날개 (깃털 패턴)
 *  pack — 배낭 (주머니/버클)
 */
export function generateBackItemTexture(backGeometryType: string): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  switch (backGeometryType) {
    case 'cape':
      // 망토 직물 패턴
      fillRect(ctx, 0, 0, 16, 16, '#F4F4F4');
      // 세로 주름
      for (let x = 0; x < 16; x += 4) {
        fillRect(ctx, x, 0, 1, 16, '#E8E8E8');
      }
      // 상단 어깨 연결부
      fillRect(ctx, 0, 0, 16, 2, '#E0E0E0');
      // 하단 자락 (불규칙)
      for (let x = 0; x < 16; x++) {
        const edge = 14 + (x % 3 === 0 ? 1 : 0);
        fillRect(ctx, x, edge, 1, 16 - edge, '#EBEBEB');
      }
      break;

    case 'wings':
      // 날개 깃털 패턴
      fillRect(ctx, 0, 0, 16, 16, '#F8F8F8');
      // 깃털 라인 (사선)
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x++) {
          if ((x + y) % 4 === 0) {
            px(ctx, x, y, '#EEEEEE');
          }
        }
      }
      // 중앙 척추
      fillRect(ctx, 7, 0, 2, 16, '#E4E4E4');
      // 상단 연결부
      fillRect(ctx, 5, 0, 6, 2, '#E0E0E0');
      break;

    case 'pack':
      // 배낭 (주머니/버클)
      fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
      // 메인 주머니 외곽
      fillRect(ctx, 1, 1, 14, 12, '#F4F4F4');
      // 구분선
      fillRect(ctx, 1, 5, 14, 1, '#E0E0E0');
      // 버클
      fillRect(ctx, 6, 3, 4, 2, '#D8D8D8');
      // 지퍼 라인
      fillRect(ctx, 7, 6, 2, 6, '#E0E0E0');
      // 하단 바닥
      fillRect(ctx, 1, 13, 14, 3, '#E4E4E4');
      break;
  }

  applyRoundingShade(ctx, 16, 16, 0.35, 0.55, 0.10);
  return toCanvasTexture(canvas);
}

// ─── Phase 6: 눈 깜빡임 & 표정 텍스처 ───

/**
 * 닫힌 눈 텍스처 생성 (깜빡임용)
 * 16x16 투명 캔버스에 양쪽 눈 위치에 가로 일자 라인만 그림
 * 눈 위치: 왼쪽 (4,6), 오른쪽 (9,6) — 눈 영역 하단 1px 라인
 */
export function generateClosedEyeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  // 닫힌 눈: 각 눈 3px 가로 라인 (y=6, 눈 하단)
  // 왼쪽 눈
  px(ctx, 4, 6, '#3A3028');
  px(ctx, 5, 6, '#3A3028');
  px(ctx, 6, 6, '#3A3028');
  // 오른쪽 눈
  px(ctx, 9, 6, '#3A3028');
  px(ctx, 10, 6, '#3A3028');
  px(ctx, 11, 6, '#3A3028');

  return toCanvasTexture(canvas);
}

/**
 * 표정별 눈 오버라이드 텍스처 생성
 *
 * AnimState에 따라 다른 눈 텍스처를 반환:
 *  - 'hit':     찡그린 눈 (수평 일자 + 약간 비스듬)
 *  - 'death':   X눈 (대각선 교차)
 *  - 'levelup': 별눈 (Star 스타일 — 골드)
 *  - 'victory': 하트눈 (Heart 스타일 — 빨강) 또는 눈웃음
 *  - 'boost':   좁힌 눈 (Cool 스타일 — 바이저 느낌)
 *
 * @param expression - 표정 키
 * @returns 16x16 CanvasTexture (눈만 그려진 상태, 나머지 투명)
 */
export function generateExpressionEyeTexture(
  expression: 'hit' | 'death' | 'levelup' | 'victory' | 'boost',
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  // 양쪽 눈에 동일 패턴 적용 (왼쪽 기준점 4,5 / 오른쪽 기준점 9,5)
  const drawBothEyes = (pattern: [number, number, string][]) => {
    for (const [dx, dy, color] of pattern) {
      px(ctx, 4 + dx, 5 + dy, color);
      px(ctx, 9 + dx, 5 + dy, color);
    }
  };

  switch (expression) {
    case 'hit':
      // 찡그린 눈: 가운데 꽉 쥔 | | 형태 (세로 2px)
      drawBothEyes([
        [0, 0, '#3A3028'], [2, 0, '#3A3028'],
        [1, 0, '#3A3028'], [1, 1, '#3A3028'],
      ]);
      break;

    case 'death':
      // X눈: 대각선 교차
      drawBothEyes([
        [0, 0, '#3A3028'], [2, 0, '#3A3028'],
        [1, 1, '#3A3028'],
        [0, 1, '#3A3028'], [2, 1, '#3A3028'],
      ]);
      break;

    case 'levelup':
      // 별눈: 골드 색상으로 별 모양
      drawBothEyes([
        [0, 0, '#FFD700'], [1, 0, '#FFD700'], [2, 0, '#FFD700'],
        [0, 1, '#FFD700'], [1, 1, '#FFD700'], [2, 1, '#FFD700'],
      ]);
      break;

    case 'victory':
      // 눈웃음: 반원형 ( ^  ^ )
      drawBothEyes([
        [0, 0, '#3A3028'], [2, 0, '#3A3028'],
        [0, 1, '#3A3028'], [1, 1, '#3A3028'], [2, 1, '#3A3028'],
      ]);
      break;

    case 'boost':
      // 좁힌 눈: 가로 바이저 (Cool 스타일)
      drawBothEyes([
        [0, 0, '#222222'], [1, 0, '#222222'], [2, 0, '#222222'],
        [0, 1, '#222222'], [1, 1, '#222222'], [2, 1, '#222222'],
      ]);
      break;
  }

  return toCanvasTexture(canvas);
}

/** 글로벌 싱글턴 캐시 매니저 */
export const textureCacheManager = new TextureCacheManager(60);
