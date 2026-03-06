/**
 * cubeling-textures.ts — 큐블링 캐릭터 텍스처 생성 모듈
 *
 * Color-Tint 전략: 흰색 base 텍스처 + setColorAt() 런타임 틴팅
 * - 패턴별 body base 텍스처 (solid/striped/dotted/gradient)
 * - 얼굴 텍스처 (눈+입 조합별)
 * - 팔/다리 base 텍스처
 * - LRU 캐시 매니저
 *
 * 모든 텍스처: 16×16, NearestFilter, no mipmaps, SRGBColorSpace
 * Canvas 2D 프로시저럴 생성 → 파일 불필요
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
 */
export function applyRoundingShade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.min(w, h) * 0.55,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// ─── 패턴별 Body Base 텍스처 (흰색 base) ───

/**
 * 패턴별 body base 텍스처 생성
 * 흰색 base → setColorAt()이 최종 색상 결정
 * 패턴은 밝기 차이로 표현 (흰/연회색)
 *
 * @param pattern - PatternType 인덱스 (0=solid, 1=striped, 2=dotted, 3=gradient, 4~7)
 */
export function generateBodyBase(pattern: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 흰색 base
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  switch (pattern) {
    case 1: // striped — 줄무늬
      for (let y = 0; y < 16; y++) {
        if (y % 4 < 2) {
          fillRect(ctx, 0, y, 16, 1, '#E0E0E0');
        }
      }
      break;

    case 2: // dotted — 도트
      for (let y = 1; y < 15; y += 3) {
        for (let x = 1; x < 15; x += 3) {
          fillRect(ctx, x, y, 2, 2, '#E8E8E8');
        }
      }
      break;

    case 3: // gradient — 세로 그라데이션 (위→아래 밝기 변화)
      for (let y = 0; y < 16; y++) {
        const brightness = Math.round(255 - (y / 15) * 40); // 255→215
        const hex = brightness.toString(16).padStart(2, '0');
        fillRect(ctx, 0, y, 16, 1, `#${hex}${hex}${hex}`);
      }
      break;

    case 4: // checker — 체커보드
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          if ((x + y) % 4 === 0) {
            fillRect(ctx, x, y, 2, 2, '#E0E0E0');
          }
        }
      }
      break;

    case 5: // camo — 카모 패턴
      // 불규칙한 블롭 형태
      fillRect(ctx, 2, 1, 5, 3, '#E0E0E0');
      fillRect(ctx, 9, 4, 4, 4, '#D8D8D8');
      fillRect(ctx, 1, 8, 6, 3, '#E0E0E0');
      fillRect(ctx, 10, 10, 5, 4, '#E0E0E0');
      fillRect(ctx, 4, 12, 3, 3, '#D8D8D8');
      break;

    case 6: // zigzag — 지그재그
      for (let y = 0; y < 16; y++) {
        const offset = (y % 4 < 2) ? 0 : 4;
        for (let x = offset; x < 16; x += 8) {
          fillRect(ctx, x, y, 4, 1, '#E0E0E0');
        }
      }
      break;

    case 7: // heart — 하트 무늬
      // 간단한 하트 패턴 (중앙)
      px(ctx, 5, 5, '#E8E8E8'); px(ctx, 6, 5, '#E8E8E8');
      px(ctx, 9, 5, '#E8E8E8'); px(ctx, 10, 5, '#E8E8E8');
      fillRect(ctx, 4, 6, 8, 1, '#E8E8E8');
      fillRect(ctx, 5, 7, 6, 1, '#E8E8E8');
      fillRect(ctx, 6, 8, 4, 1, '#E8E8E8');
      fillRect(ctx, 7, 9, 2, 1, '#E8E8E8');
      break;

    // case 0 (solid): 이미 흰색으로 채워져 있음
  }

  // 외곽선 (약간 어둡게)
  for (let i = 0; i < 16; i++) {
    px(ctx, i, 0, '#E8E8E8');
    px(ctx, i, 15, '#E8E8E8');
    px(ctx, 0, i, '#E8E8E8');
    px(ctx, 15, i, '#E8E8E8');
  }

  // 벨트 라인 (하단)
  fillRect(ctx, 1, 13, 14, 2, '#D0D0D0');

  // 둥근 착시
  applyRoundingShade(ctx, 16, 16);

  return toCanvasTexture(canvas);
}

// ─── 팔 Base 텍스처 ───

/**
 * 팔 base 텍스처 (흰색 base)
 * 상단: 소매 (흰색, 패턴 없음)
 * 하단: 손 영역 (약간 어두운 → 피부톤 setColorAt이 틴팅)
 */
export function generateArmBase(_pattern: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 소매 영역 (흰색)
  fillRect(ctx, 0, 0, 16, 10, '#FFFFFF');

  // 손 영역 (약간 밝은 회색 — 피부톤과 구분)
  fillRect(ctx, 0, 10, 16, 6, '#F0F0F0');

  // 외곽선
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#E8E8E8');
    px(ctx, 15, y, '#E8E8E8');
  }

  applyRoundingShade(ctx, 16, 16);

  return toCanvasTexture(canvas);
}

// ─── 다리 Base 텍스처 ───

/**
 * 다리 base 텍스처 (흰색 base)
 * 상단: 바지 (흰색)
 * 하단: 신발 (어두운 → bottomColor setColorAt)
 */
export function generateLegBase(_pattern: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 바지 영역 (흰색)
  fillRect(ctx, 0, 0, 16, 12, '#FFFFFF');

  // 신발 영역 (어두운 톤)
  fillRect(ctx, 0, 12, 16, 4, '#C0C0C0');

  // 외곽선
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#E8E8E8');
    px(ctx, 15, y, '#E8E8E8');
  }

  applyRoundingShade(ctx, 16, 16);

  return toCanvasTexture(canvas);
}

// ─── 얼굴 텍스처 (Head 앞면) ───

/**
 * 눈+입 조합별 얼굴 텍스처 생성
 * 흰색 base → 머리카락/피부톤은 setColorAt으로 틴팅
 * 눈/입은 고유 색상 (검정, 하이라이트 등)
 *
 * 레이아웃 (16×16):
 *   Row 0-3:  머리카락 영역 (연회색 → setColorAt이 머리카락색으로 틴팅)
 *   Row 4-6:  눈 영역 (피부톤 base + 눈 픽셀)
 *   Row 7:    코 (약간 어둡게)
 *   Row 8-9:  입 영역
 *   Row 10-15: 피부/턱 (흰색 base → setColorAt으로 피부톤)
 */
export function generateFaceTexture(
  eyeStyle: number,
  mouthStyle: number,
  _marking: number = 0,
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 전체를 피부톤 base (흰색 — setColorAt이 피부색으로 만듦)
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');

  // 머리카락 영역 (상단 4행) — 약간 밝은 회색
  // setColorAt으로 머리카락 색이 곱해지면 자연스럽게 표현
  fillRect(ctx, 0, 0, 16, 4, '#F0F0F0');
  // 옆머리 (Row 4~7 양쪽)
  fillRect(ctx, 0, 4, 2, 4, '#E8E8E8');
  fillRect(ctx, 14, 4, 2, 4, '#E8E8E8');

  // 눈 그리기 (Row 3~6 영역, 3×2 픽셀 per eye)
  const eyeDef = EYE_STYLES[eyeStyle % EYE_STYLES.length];
  if (eyeDef) {
    // 왼쪽 눈: (4, 5) 시작점
    // 오른쪽 눈: (9, 5) 시작점
    for (const [px_x, px_y, colorKey] of eyeDef.pixels) {
      const color = EYE_COLOR_MAP[colorKey] ?? '#3A3028';
      // 왼쪽 눈
      px(ctx, 4 + px_x, 5 + px_y, color);
      // 오른쪽 눈 (Wink의 경우 특수 처리는 하지 않음 — 기획서 기반 대칭)
      px(ctx, 9 + px_x, 5 + px_y, color);
    }
  }

  // 코 (Row 9, 중앙 2px)
  px(ctx, 7, 9, '#E0E0E0');
  px(ctx, 8, 9, '#E0E0E0');

  // 입 그리기 (Row 11~12, 6×2 영역, 시작점 (5, 11))
  const mouthDef = MOUTH_STYLES[mouthStyle % MOUTH_STYLES.length];
  if (mouthDef) {
    for (const [px_x, px_y, colorKey] of mouthDef.pixels) {
      const color = MOUTH_COLOR_MAP[colorKey] ?? '#8B4040';
      px(ctx, 5 + px_x, 11 + px_y, color);
    }
  }

  // 하단 모서리 어둡게 (둥근 착시)
  fillRect(ctx, 0, 14, 2, 2, '#E8E8E8');
  fillRect(ctx, 14, 14, 2, 2, '#E8E8E8');

  return toCanvasTexture(canvas);
}

// ─── Head 기타 면 텍스처 (흰색 base) ───

/** 머리 상단(정수리) — 머리카락 base (흰색 → setColorAt 머리색) */
export function generateHeadTopBase(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
  // 가르마 라인
  fillRect(ctx, 7, 0, 2, 16, '#E0E0E0');
  applyRoundingShade(ctx, 16, 16);
  return toCanvasTexture(canvas);
}

/** 머리 뒷면 — 뒷머리 (흰색 base → setColorAt 머리색) */
export function generateHeadBackBase(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
  // 아래쪽 목/피부 영역
  fillRect(ctx, 2, 12, 12, 4, '#FFFFFF');
  // 외곽 약간 어둡게
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#E0E0E0');
    px(ctx, 15, y, '#E0E0E0');
  }
  applyRoundingShade(ctx, 16, 16);
  return toCanvasTexture(canvas);
}

/** 머리 옆면 — 옆머리 (흰색 base → setColorAt 머리색/피부톤 혼합) */
export function generateHeadSideBase(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#FFFFFF');
  // 머리카락 상단
  fillRect(ctx, 0, 0, 16, 5, '#F0F0F0');
  fillRect(ctx, 0, 5, 3, 3, '#E8E8E8');
  fillRect(ctx, 13, 5, 3, 3, '#E8E8E8');
  // 귀 표시
  px(ctx, 7, 7, '#E8E8E8');
  px(ctx, 8, 7, '#E8E8E8');
  px(ctx, 7, 8, '#E0E0E0');
  px(ctx, 8, 8, '#E0E0E0');
  applyRoundingShade(ctx, 16, 16);
  return toCanvasTexture(canvas);
}

/** 머리 하단(턱) — 피부톤 (흰색 base → setColorAt 피부색) */
export function generateHeadBottomBase(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fillRect(ctx, 0, 0, 16, 16, '#F0F0F0');
  return toCanvasTexture(canvas);
}

// ─── 얼굴 6-Material 세트 생성 ───

/**
 * Head용 6-material 배열 생성 (BoxGeometry face order)
 * [0]+X=front(얼굴), [1]-X=back, [2]+Y=top, [3]-Y=bottom, [4]+Z=left, [5]-Z=right
 * 모든 material.color = white → setColorAt으로 틴팅
 */
export function createHeadMaterials(
  eyeStyle: number,
  mouthStyle: number,
  marking: number = 0,
): THREE.MeshLambertMaterial[] {
  const frontTex = generateFaceTexture(eyeStyle, mouthStyle, marking);
  const backTex = generateHeadBackBase();
  const topTex = generateHeadTopBase();
  const bottomTex = generateHeadBottomBase();
  const sideTex = generateHeadSideBase();

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
 */
export class TextureCacheManager {
  /** 얼굴 텍스처 캐시: FaceKey → 6-material 배열 */
  private faceCache = new Map<string, CacheEntry<THREE.MeshLambertMaterial[]>>();
  /** body 패턴 텍스처 캐시: pattern → CanvasTexture */
  private bodyCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();
  /** arm base 텍스처 캐시 */
  private armCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();
  /** leg base 텍스처 캐시 */
  private legCache = new Map<number, CacheEntry<THREE.CanvasTexture>>();

  private maxSize: number;

  constructor(maxSize = 60) {
    this.maxSize = maxSize;
  }

  /** 얼굴 material 세트 가져오기 (캐시) */
  getFaceMaterials(faceKey: FaceKey, eyeStyle: number, mouthStyle: number, marking = 0): THREE.MeshLambertMaterial[] {
    const cached = this.faceCache.get(faceKey);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.value;
    }

    const mats = createHeadMaterials(eyeStyle, mouthStyle, marking);
    this.faceCache.set(faceKey, { value: mats, lastUsed: performance.now() });
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
  }

  /** 캐시 크기 반환 */
  get size(): number {
    return this.faceCache.size + this.bodyCache.size + this.armCache.size + this.legCache.size;
  }
}

/** 글로벌 싱글턴 캐시 매니저 */
export const textureCacheManager = new TextureCacheManager(60);
