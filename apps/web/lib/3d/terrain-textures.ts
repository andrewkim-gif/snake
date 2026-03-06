/**
 * terrain-textures — 6종 테마별 프로시저럴 16x16 Canvas 텍스처 생성기
 * forest / desert / mountain / urban / arctic / island
 *
 * 반환: { ground, side, accent } CanvasTexture 세트
 * NearestFilter + no mipmaps → 픽셀 아트 MC 스타일
 */

import * as THREE from 'three';

export type TerrainTheme = 'forest' | 'desert' | 'mountain' | 'urban' | 'arctic' | 'island';

export interface TerrainTextureSet {
  ground: THREE.CanvasTexture;
  side: THREE.CanvasTexture;
  accent: THREE.CanvasTexture;
}

const TEX_SIZE = 16;

// ─── 공통 헬퍼 ───

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 기본색 + 노이즈 2가지 변형으로 16x16 채움 */
function fillNoisy(
  ctx: CanvasRenderingContext2D,
  base: string,
  varA: string,
  varB: string,
  seed: number,
  threshA = 0.3,
  threshB = 0.45,
): void {
  const rand = seededRand(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const r = rand();
      if (r < threshA) {
        ctx.fillStyle = varA;
        ctx.fillRect(x, y, 1, 1);
      } else if (r < threshB) {
        ctx.fillStyle = varB;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

// ─── 6종 테마 텍스처 생성 ───

function createForestTextures(): TerrainTextureSet {
  // ground: 녹색 잔디
  const [gc, gCtx] = createCanvas();
  fillNoisy(gCtx, '#4a7c3f', '#3e6b35', '#5a8f4a', 42);

  // side: 짙은 흙
  const [sc, sCtx] = createCanvas();
  fillNoisy(sCtx, '#5a3d2b', '#4e3322', '#6b4e36', 137);
  // 상단 초록 잔디 레이어
  sCtx.fillStyle = '#4a7c3f';
  sCtx.fillRect(0, 0, TEX_SIZE, 2);
  const rand = seededRand(200);
  for (let x = 0; x < TEX_SIZE; x++) {
    if (rand() > 0.4) sCtx.fillRect(x, 2, 1, 1);
  }

  // accent: 이끼 낀 돌
  const [ac, aCtx] = createCanvas();
  fillNoisy(aCtx, '#5a6b4a', '#4a5c3d', '#6b7c5a', 256);

  return { ground: toTexture(gc), side: toTexture(sc), accent: toTexture(ac) };
}

function createDesertTextures(): TerrainTextureSet {
  // ground: 모래색
  const [gc, gCtx] = createCanvas();
  fillNoisy(gCtx, '#C4A661', '#b89955', '#d4b672', 42);

  // side: 연모래 + 하단 어두움
  const [sc, sCtx] = createCanvas();
  fillNoisy(sCtx, '#d4b672', '#c4a661', '#e4c682', 137);
  sCtx.fillStyle = '#a08448';
  for (let x = 0; x < TEX_SIZE; x++) {
    sCtx.fillRect(x, 14, 1, 2);
  }

  // accent: 적갈색 사암
  const [ac, aCtx] = createCanvas();
  fillNoisy(aCtx, '#b07040', '#a06035', '#c0804a', 256);

  return { ground: toTexture(gc), side: toTexture(sc), accent: toTexture(ac) };
}

function createMountainTextures(): TerrainTextureSet {
  // ground: 회색 바위
  const [gc, gCtx] = createCanvas();
  fillNoisy(gCtx, '#6b6b6b', '#5a5a5a', '#7c7c7c', 42);
  // 균열 라인
  gCtx.fillStyle = '#4a4a4a';
  gCtx.fillRect(2, 6, 5, 1);
  gCtx.fillRect(9, 11, 4, 1);

  // side: 눈 뒤덮인 바위
  const [sc, sCtx] = createCanvas();
  fillNoisy(sCtx, '#6b6b6b', '#5a5a5a', '#7c7c7c', 137);
  // 상단 눈 레이어
  sCtx.fillStyle = '#e8e8f0';
  sCtx.fillRect(0, 0, TEX_SIZE, 3);
  const rand = seededRand(300);
  for (let x = 0; x < TEX_SIZE; x++) {
    if (rand() > 0.3) sCtx.fillRect(x, 3, 1, 1);
    if (rand() > 0.6) sCtx.fillRect(x, 4, 1, 1);
  }

  // accent: 암석
  const [ac, aCtx] = createCanvas();
  fillNoisy(aCtx, '#555555', '#444444', '#666666', 256);

  return { ground: toTexture(gc), side: toTexture(sc), accent: toTexture(ac) };
}

function createUrbanTextures(): TerrainTextureSet {
  // ground: 콘크리트
  const [gc, gCtx] = createCanvas();
  fillNoisy(gCtx, '#808080', '#707070', '#909090', 42, 0.2, 0.35);
  // 콘크리트 조인트 라인
  gCtx.fillStyle = '#606060';
  gCtx.fillRect(0, 7, TEX_SIZE, 1);
  gCtx.fillRect(7, 0, 1, TEX_SIZE);

  // side: 아스팔트
  const [sc, sCtx] = createCanvas();
  fillNoisy(sCtx, '#404040', '#353535', '#4a4a4a', 137, 0.2, 0.35);

  // accent: 벽돌
  const [ac, aCtx] = createCanvas();
  const rand = seededRand(256);
  aCtx.fillStyle = '#8B4513';
  aCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // 벽돌 패턴
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    aCtx.fillStyle = '#606060';
    aCtx.fillRect(0, y + 3, TEX_SIZE, 1); // 수평 줄눈
    const offset = row % 2 === 0 ? 0 : 4;
    for (let col = 0; col < 3; col++) {
      const x = offset + col * 8 - 1;
      if (x >= 0 && x < TEX_SIZE) aCtx.fillRect(x, y, 1, 3); // 수직 줄눈
    }
    // 약간의 색 변형
    for (let dx = 0; dx < TEX_SIZE; dx++) {
      for (let dy = y; dy < y + 3 && dy < TEX_SIZE; dy++) {
        if (rand() < 0.15) {
          aCtx.fillStyle = '#7a3a0e';
          aCtx.fillRect(dx, dy, 1, 1);
        } else if (rand() < 0.1) {
          aCtx.fillStyle = '#9c5520';
          aCtx.fillRect(dx, dy, 1, 1);
        }
      }
    }
  }

  return { ground: toTexture(gc), side: toTexture(sc), accent: toTexture(ac) };
}

function createArcticTextures(): TerrainTextureSet {
  // ground: 흰 눈
  const [gc, gCtx] = createCanvas();
  fillNoisy(gCtx, '#e8e8f0', '#d8d8e8', '#f0f0f8', 42, 0.25, 0.4);

  // side: 눈+얼음 레이어
  const [sc, sCtx] = createCanvas();
  fillNoisy(sCtx, '#d8d8e8', '#c8c8d8', '#e8e8f0', 137);
  // 하단 얼음 레이어
  sCtx.fillStyle = '#88bbff';
  for (let x = 0; x < TEX_SIZE; x++) {
    sCtx.fillRect(x, 12, 1, 4);
  }
  const rand = seededRand(350);
  for (let x = 0; x < TEX_SIZE; x++) {
    if (rand() > 0.4) sCtx.fillRect(x, 11, 1, 1);
  }

  // accent: 얼음
  const [ac, aCtx] = createCanvas();
  fillNoisy(aCtx, '#88bbff', '#78aaee', '#99ccff', 256);
  // 반짝이는 포인트
  aCtx.fillStyle = '#ccddff';
  aCtx.fillRect(3, 4, 1, 1);
  aCtx.fillRect(10, 8, 1, 1);
  aCtx.fillRect(7, 13, 1, 1);

  return { ground: toTexture(gc), side: toTexture(sc), accent: toTexture(ac) };
}

function createIslandTextures(): TerrainTextureSet {
  // ground: 모래 + 잔디 혼합
  const [gc, gCtx] = createCanvas();
  fillNoisy(gCtx, '#c4a661', '#b89955', '#d4b672', 42);
  // 중앙 잔디 패치
  gCtx.fillStyle = '#5a8f4a';
  gCtx.fillRect(4, 4, 8, 8);
  const rand = seededRand(100);
  for (let x = 4; x < 12; x++) {
    for (let y = 4; y < 12; y++) {
      if (rand() < 0.3) {
        gCtx.fillStyle = '#4a7c3f';
        gCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  // side: 절벽 + 모래
  const [sc, sCtx] = createCanvas();
  fillNoisy(sCtx, '#8B6B47', '#7A5C3A', '#9B7B57', 137);
  sCtx.fillStyle = '#c4a661';
  sCtx.fillRect(0, 0, TEX_SIZE, 2);

  // accent: 물 (파란색)
  const [ac, aCtx] = createCanvas();
  fillNoisy(aCtx, '#3388cc', '#2277bb', '#44aadd', 256);
  // 파도 하이라이트
  aCtx.fillStyle = '#66bbee';
  aCtx.fillRect(2, 5, 3, 1);
  aCtx.fillRect(9, 10, 4, 1);

  return { ground: toTexture(gc), side: toTexture(sc), accent: toTexture(ac) };
}

// ─── 테마별 팔레트 색상 (비-텍스처 요소에 사용) ───

export interface TerrainPalette {
  groundColor: string;
  sideColor: string;
  accentColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  skyColor: string;
  ambientIntensity: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
}

export function getTerrainPalette(theme: string): TerrainPalette {
  switch (theme) {
    case 'forest':
      return {
        groundColor: '#4a7c3f', sideColor: '#5a3d2b', accentColor: '#5a6b4a',
        fogColor: '#87CEAA', fogNear: 500, fogFar: 2200,
        skyColor: '#87CEAA', ambientIntensity: 0.5, sunIntensity: 0.8,
        sunPosition: [100, 150, 80],
      };
    case 'desert':
      return {
        groundColor: '#C4A661', sideColor: '#d4b672', accentColor: '#b07040',
        fogColor: '#E8D8A0', fogNear: 700, fogFar: 3000,
        skyColor: '#E8D8A0', ambientIntensity: 0.65, sunIntensity: 1.0,
        sunPosition: [120, 200, 60],
      };
    case 'mountain':
      return {
        groundColor: '#6b6b6b', sideColor: '#555555', accentColor: '#e8e8f0',
        fogColor: '#B0B8C8', fogNear: 400, fogFar: 1800,
        skyColor: '#B0B8C8', ambientIntensity: 0.5, sunIntensity: 0.75,
        sunPosition: [80, 180, 100],
      };
    case 'urban':
      return {
        groundColor: '#808080', sideColor: '#404040', accentColor: '#8B4513',
        fogColor: '#999999', fogNear: 500, fogFar: 2000,
        skyColor: '#AAAAAA', ambientIntensity: 0.6, sunIntensity: 0.7,
        sunPosition: [100, 120, 80],
      };
    case 'arctic':
      return {
        groundColor: '#e8e8f0', sideColor: '#d8d8e8', accentColor: '#88bbff',
        fogColor: '#D8E0F0', fogNear: 400, fogFar: 2000,
        skyColor: '#D8E0F0', ambientIntensity: 0.7, sunIntensity: 0.6,
        sunPosition: [60, 100, 120],
      };
    case 'island':
      return {
        groundColor: '#c4a661', sideColor: '#5a8f4a', accentColor: '#3388cc',
        fogColor: '#87CEEB', fogNear: 600, fogFar: 2800,
        skyColor: '#87CEEB', ambientIntensity: 0.6, sunIntensity: 0.9,
        sunPosition: [100, 170, 70],
      };
    default: // forest 기본
      return {
        groundColor: '#4a7c3f', sideColor: '#5a3d2b', accentColor: '#5a6b4a',
        fogColor: '#87CEEB', fogNear: 600, fogFar: 2500,
        skyColor: '#87CEEB', ambientIntensity: 0.55, sunIntensity: 0.85,
        sunPosition: [100, 150, 80],
      };
  }
}

// ─── 공개 API ───

const cache = new Map<string, TerrainTextureSet>();

export function createTerrainTextures(theme: string): TerrainTextureSet {
  const cached = cache.get(theme);
  if (cached) return cached;

  let set: TerrainTextureSet;
  switch (theme) {
    case 'forest': set = createForestTextures(); break;
    case 'desert': set = createDesertTextures(); break;
    case 'mountain': set = createMountainTextures(); break;
    case 'urban': set = createUrbanTextures(); break;
    case 'arctic': set = createArcticTextures(); break;
    case 'island': set = createIslandTextures(); break;
    default: set = createForestTextures(); break;
  }
  cache.set(theme, set);
  return set;
}

export function disposeTerrainTextures(): void {
  for (const [, set] of cache) {
    set.ground.dispose();
    set.side.dispose();
    set.accent.dispose();
  }
  cache.clear();
}

// ─── 전투 보너스 설명 (클라이언트 표시용) ───

export function getTerrainBonusDescription(theme: string): string {
  switch (theme) {
    case 'forest': return 'Forest: -20% Damage Received';
    case 'desert': return 'Desert: -10% Speed, +20% Vision';
    case 'mountain': return 'Mountain: +15% DPS, -15% Speed';
    case 'urban': return 'Urban: -30% Dash Damage';
    case 'arctic': return 'Arctic: -20% Speed, -30% Orb Density';
    case 'island': return 'Island: +50% Arena Shrink Speed';
    default: return '';
  }
}
