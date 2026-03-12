/**
 * mob-textures.ts — 몬스터 프로시저럴 16x16 CanvasTexture 생성기
 * 12종 템플릿별 픽셀아트 텍스처 (Phase 3: V45 텍스처 에셋 품질 개선)
 *
 * agent-textures.ts 패턴 재사용:
 *   createCanvas(16,16) → px(ctx, x, y, color) → toCanvasTexture()
 *
 * 흰색(0xffffff) 베이스에 디테일을 그려서 instance color와 곱셈 블렌딩
 * NearestFilter + no mipmaps → 픽셀아트 렌더링
 * textureCache Map으로 동일 templateId 재생성 방지
 */

import * as THREE from 'three';
import type { EnemyTemplateId } from '@/lib/matrix/rendering3d/enemy-templates';

// ─── 텍스처 캐시 ───
const textureCache = new Map<string, THREE.CanvasTexture>();

const TEX_SIZE = 16;

// ─── Canvas 텍스처 생성 헬퍼 (agent-textures.ts 패턴 재사용) ───

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

/** 단일 픽셀 그리기 */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/** 사각형 영역 채우기 */
function fill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Canvas → THREE.CanvasTexture 변환 (NearestFilter, SRGBColorSpace) */
function toCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── 템플릿별 텍스처 생성 함수들 ───

/**
 * humanoid_small: 고블린 얼굴
 * 작고 날카로운 빨간 눈, 녹색 피부, 뾰족한 귀
 * 흰색 베이스 + 어두운 디테일 → instance color가 전체 틴트
 */
function createHumanoidSmallTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  // 흰색 베이스 (instance color와 곱셈 블렌딩)
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 얼굴 영역 — 약간 어두운 녹색 톤 (곱셈 시 피부 느낌)
  fill(ctx, 2, 2, 12, 12, '#d0e8d0');

  // 뾰족한 귀 (양쪽)
  px(ctx, 1, 4, '#c0d8c0');
  px(ctx, 0, 3, '#b8d0b8');
  px(ctx, 14, 4, '#c0d8c0');
  px(ctx, 15, 3, '#b8d0b8');

  // 빨간 눈 — 날카로운 슬릿
  px(ctx, 5, 6, '#ff3333');
  px(ctx, 6, 6, '#cc0000');
  px(ctx, 10, 6, '#ff3333');
  px(ctx, 9, 6, '#cc0000');

  // 눈 하이라이트
  px(ctx, 5, 5, '#ff6666');
  px(ctx, 10, 5, '#ff6666');

  // 입 — 이빨
  fill(ctx, 6, 10, 4, 1, '#888888');
  px(ctx, 6, 11, '#cccccc');
  px(ctx, 9, 11, '#cccccc');

  // 이마 주름
  fill(ctx, 4, 3, 8, 1, '#b8d0b8');

  return toCanvasTexture(canvas);
}

/**
 * humanoid_medium: 전사 갑옷
 * 은색 갑옷 패턴, 어두운 바이저
 */
function createHumanoidMediumTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 갑옷 플레이트 패턴 (은색/회색 톤)
  fill(ctx, 1, 1, 14, 14, '#e0e0e8');

  // 가슴 갑옷 중앙 라인
  fill(ctx, 7, 2, 2, 12, '#c0c0cc');

  // 어깨 패드
  fill(ctx, 1, 1, 4, 3, '#d0d0d8');
  fill(ctx, 11, 1, 4, 3, '#d0d0d8');

  // 바이저 (어두운 슬릿)
  fill(ctx, 4, 5, 8, 2, '#666680');
  // 눈 슬릿
  px(ctx, 5, 5, '#333344');
  px(ctx, 6, 5, '#333344');
  px(ctx, 9, 5, '#333344');
  px(ctx, 10, 5, '#333344');

  // 리벳 포인트
  px(ctx, 3, 3, '#aaaabc');
  px(ctx, 12, 3, '#aaaabc');
  px(ctx, 3, 10, '#aaaabc');
  px(ctx, 12, 10, '#aaaabc');

  // 벨트
  fill(ctx, 2, 12, 12, 2, '#b0b0c0');

  return toCanvasTexture(canvas);
}

/**
 * humanoid_large: 거인 문신
 * 파란 전쟁 페인트, 거대한 이빨
 */
function createHumanoidLargeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 피부 베이스
  fill(ctx, 1, 1, 14, 14, '#e8ddd0');

  // 파란 전쟁 페인트 (줄무늬 패턴)
  fill(ctx, 2, 3, 12, 2, '#8899cc');
  fill(ctx, 3, 8, 10, 1, '#7788bb');
  fill(ctx, 4, 11, 8, 1, '#7788bb');

  // 대각선 페인트
  for (let i = 0; i < 5; i++) {
    px(ctx, 2 + i, 5 + i, '#6677aa');
    px(ctx, 13 - i, 5 + i, '#6677aa');
  }

  // 눈 — 작고 날카로운
  px(ctx, 5, 5, '#ffcc00');
  px(ctx, 6, 5, '#ffcc00');
  px(ctx, 10, 5, '#ffcc00');
  px(ctx, 9, 5, '#ffcc00');

  // 거대한 이빨
  fill(ctx, 5, 12, 2, 2, '#f0f0f0');
  fill(ctx, 9, 12, 2, 2, '#f0f0f0');
  px(ctx, 7, 13, '#e0e0e0');
  px(ctx, 8, 13, '#e0e0e0');

  return toCanvasTexture(canvas);
}

/**
 * flying: 날개 무늬
 * 반투명 날개 패턴, 파란/보라 컬러
 */
function createFlyingTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 날개 패턴 — 반투명 효과 (밝은 베이스 + 선)
  fill(ctx, 0, 0, 16, 16, '#e8e0f0');

  // 날개맥 (정맥 패턴)
  for (let i = 0; i < 14; i++) {
    px(ctx, 1 + i, 8, '#c0b0d8');
  }
  // 부채꼴 방사형 맥
  for (let i = 0; i < 7; i++) {
    px(ctx, 8, 1 + i, '#c8b8e0');
    px(ctx, 4 + i, 2 + i, '#c0b0d8');
    px(ctx, 11 - i, 2 + i, '#c0b0d8');
  }

  // 끝단 — 약간 어두운 테두리
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 0, '#d0c0e0');
    px(ctx, x, 15, '#d0c0e0');
  }
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, '#d0c0e0');
    px(ctx, 15, y, '#d0c0e0');
  }

  // 빛나는 점 (에너지 포인트)
  px(ctx, 8, 4, '#f0e8ff');
  px(ctx, 4, 10, '#f0e8ff');
  px(ctx, 12, 10, '#f0e8ff');

  return toCanvasTexture(canvas);
}

/**
 * crawler: 벌레 눈
 * 다수의 빨간 복안, 어두운 키틴질 몸체
 */
function createCrawlerTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 키틴질 몸체 — 어두운 갈색
  fill(ctx, 0, 0, 16, 16, '#c8b8a0');

  // 키틴 세그먼트 라인
  for (let y = 0; y < 16; y += 4) {
    fill(ctx, 0, y, 16, 1, '#b0a090');
  }

  // 복안 — 다수의 빨간 눈 (3x2 그리드)
  const eyePositions = [
    [4, 3], [7, 2], [10, 3],
    [3, 6], [7, 5], [11, 6],
    [5, 8], [9, 8],
  ];
  for (const [ex, ey] of eyePositions) {
    px(ctx, ex, ey, '#ff4444');
    px(ctx, ex + 1, ey, '#cc2222');
  }

  // 키틴질 반사 하이라이트
  px(ctx, 6, 11, '#ddd0c0');
  px(ctx, 9, 12, '#ddd0c0');

  return toCanvasTexture(canvas);
}

/**
 * sphere: 에너지 소용돌이
 * 빙글빙글 도는 에너지 라인, 밝은 코어
 */
function createSphereTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 밝은 에너지 코어 (중앙)
  fill(ctx, 5, 5, 6, 6, '#f8f8ff');
  fill(ctx, 6, 6, 4, 4, '#f0f0ff');

  // 소용돌이 에너지 라인 (나선형)
  const spiralPoints = [
    [8, 1], [11, 2], [13, 4], [14, 7],
    [13, 10], [11, 13], [8, 14], [5, 13],
    [3, 11], [2, 8], [3, 5], [5, 3],
  ];
  for (const [sx, sy] of spiralPoints) {
    px(ctx, sx, sy, '#dde0f0');
  }

  // 내부 고리
  const innerRing = [
    [7, 3], [10, 4], [12, 7], [11, 10],
    [8, 12], [5, 11], [3, 8], [4, 5],
  ];
  for (const [rx, ry] of innerRing) {
    px(ctx, rx, ry, '#e8e8f8');
  }

  // 밝은 중앙 하이라이트
  px(ctx, 7, 7, '#ffffff');
  px(ctx, 8, 8, '#ffffff');

  return toCanvasTexture(canvas);
}

/**
 * turret: 기계 패널
 * 금속 리벳, LED 표시등, 기계적 그리드
 */
function createTurretTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 금속 패널 베이스
  fill(ctx, 0, 0, 16, 16, '#d8d8e0');

  // 그리드 라인 (기계적 패턴)
  for (let i = 0; i < 16; i += 4) {
    fill(ctx, i, 0, 1, 16, '#c0c0cc');
    fill(ctx, 0, i, 16, 1, '#c0c0cc');
  }

  // 리벳 포인트 (4 코너 + 중앙)
  const rivetPositions = [
    [2, 2], [13, 2], [2, 13], [13, 13],
    [7, 7], [8, 7], [7, 8], [8, 8],
  ];
  for (const [rx, ry] of rivetPositions) {
    px(ctx, rx, ry, '#a8a8b8');
  }

  // LED 표시등 (녹색/빨간)
  px(ctx, 5, 5, '#88ff88');
  px(ctx, 10, 5, '#88ff88');
  px(ctx, 7, 10, '#ff6666');
  px(ctx, 8, 10, '#ff6666');

  // 슬릿/환기구
  fill(ctx, 3, 12, 2, 1, '#b0b0c0');
  fill(ctx, 11, 12, 2, 1, '#b0b0c0');

  return toCanvasTexture(canvas);
}

/**
 * quadruped: 짐승 모피
 * 갈색/검은 줄무늬, 털 질감
 */
function createQuadrupedTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 모피 베이스 — 밝은 갈색
  fill(ctx, 0, 0, 16, 16, '#e0d0c0');

  // 줄무늬 패턴 (호랑이/짐승 무늬)
  for (let y = 1; y < 15; y += 3) {
    const offset = (y % 6 < 3) ? 0 : 2;
    fill(ctx, 2 + offset, y, 3, 2, '#c0a888');
    fill(ctx, 9 + offset, y, 3, 2, '#c0a888');
  }

  // 어두운 줄무늬 악센트
  for (let y = 2; y < 14; y += 5) {
    fill(ctx, 1, y, 14, 1, '#b8a080');
  }

  // 털 질감 — 랜덤 밝은 점
  const furHighlights = [
    [3, 4], [7, 2], [11, 5], [5, 9],
    [13, 8], [2, 12], [9, 13], [14, 3],
  ];
  for (const [fx, fy] of furHighlights) {
    px(ctx, fx, fy, '#ecdcc8');
  }

  return toCanvasTexture(canvas);
}

/**
 * boss_small: 왕관+갑옷
 * 금색 왕관, 화려한 장식 갑옷
 */
function createBossSmallTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 화려한 갑옷 베이스
  fill(ctx, 1, 4, 14, 11, '#e8e0d0');

  // 왕관 (상단)
  fill(ctx, 3, 0, 10, 3, '#f0d860');
  // 왕관 톱니
  px(ctx, 4, 0, '#ffe080');
  px(ctx, 7, 0, '#ffe080');
  px(ctx, 8, 0, '#ffe080');
  px(ctx, 11, 0, '#ffe080');
  // 왕관 보석
  px(ctx, 6, 1, '#ff4444');
  px(ctx, 9, 1, '#4488ff');

  // 갑옷 장식 — 중앙 엠블렘
  fill(ctx, 6, 6, 4, 4, '#f0d860');
  fill(ctx, 7, 7, 2, 2, '#ffeebb');

  // 갑옷 테두리 라인
  fill(ctx, 1, 4, 14, 1, '#d8c858');
  fill(ctx, 1, 14, 14, 1, '#d8c858');

  // 눈 (위엄있는)
  px(ctx, 5, 4, '#ffffff');
  px(ctx, 10, 4, '#ffffff');

  return toCanvasTexture(canvas);
}

/**
 * boss_medium: 용 비늘
 * 빨강/금 비늘 패턴, 날카로운 눈
 */
function createBossMediumTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 비늘 패턴 베이스
  fill(ctx, 0, 0, 16, 16, '#e8d0c0');

  // 비늘 — 다이아몬드 그리드
  for (let y = 0; y < 16; y += 3) {
    for (let x = 0; x < 16; x += 3) {
      const offset = (y % 6 < 3) ? 0 : 1;
      px(ctx, x + offset, y, '#d8b8a0');
      px(ctx, x + offset + 1, y + 1, '#d0b098');
    }
  }

  // 금색 하이라이트 비늘
  px(ctx, 4, 4, '#f0d060');
  px(ctx, 11, 4, '#f0d060');
  px(ctx, 7, 8, '#f0d060');
  px(ctx, 8, 12, '#f0d060');

  // 날카로운 눈
  fill(ctx, 4, 2, 3, 2, '#ffcc00');
  px(ctx, 5, 3, '#cc0000');
  fill(ctx, 9, 2, 3, 2, '#ffcc00');
  px(ctx, 10, 3, '#cc0000');

  // 중앙 등줄기 라인
  fill(ctx, 7, 0, 2, 16, '#d0a888');

  return toCanvasTexture(canvas);
}

/**
 * boss_large: 마왕 문양
 * 보라/검정 마법 룬, 빛나는 눈
 */
function createBossLargeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 어두운 베이스
  fill(ctx, 0, 0, 16, 16, '#d0c0d8');

  // 마법 룬 패턴 (보라 라인)
  // 중앙 원형 룬
  const runeCircle = [
    [6, 2], [7, 2], [8, 2], [9, 2],
    [4, 4], [11, 4],
    [3, 6], [12, 6],
    [3, 9], [12, 9],
    [4, 11], [11, 11],
    [6, 13], [7, 13], [8, 13], [9, 13],
  ];
  for (const [rx, ry] of runeCircle) {
    px(ctx, rx, ry, '#c0a0e0');
  }

  // 내부 십자형 룬
  fill(ctx, 7, 4, 2, 8, '#c8a8e8');
  fill(ctx, 4, 7, 8, 2, '#c8a8e8');

  // 빛나는 눈 (밝은 보라/흰색)
  px(ctx, 5, 5, '#f0e0ff');
  px(ctx, 6, 5, '#e8d0ff');
  px(ctx, 10, 5, '#f0e0ff');
  px(ctx, 9, 5, '#e8d0ff');

  // 코너 룬 장식
  px(ctx, 1, 1, '#b898d0');
  px(ctx, 14, 1, '#b898d0');
  px(ctx, 1, 14, '#b898d0');
  px(ctx, 14, 14, '#b898d0');

  return toCanvasTexture(canvas);
}

/**
 * cube: 글리치/디지털 노이즈
 * 매트릭스 스타일 녹색 코드 패턴, 글리치 줄
 */
function createCubeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  fill(ctx, 0, 0, 16, 16, '#ffffff');

  // 디지털 노이즈 베이스 — 미세한 그리드
  fill(ctx, 0, 0, 16, 16, '#e8f0e8');

  // 매트릭스 코드 줄 (녹색 세로 라인)
  for (let x = 1; x < 15; x += 2) {
    const len = 3 + (x * 7) % 5;
    const startY = (x * 3) % 4;
    for (let y = startY; y < Math.min(startY + len, 16); y++) {
      const brightness = 0.7 + ((y * x) % 3) * 0.1;
      const g = Math.round(200 * brightness);
      px(ctx, x, y, `rgb(${Math.round(g * 0.4)},${g},${Math.round(g * 0.4)})`);
    }
  }

  // 글리치 수평 줄
  fill(ctx, 0, 5, 16, 1, '#d0e8d0');
  fill(ctx, 0, 11, 16, 1, '#d0e8d0');

  // 밝은 글리치 점
  px(ctx, 3, 7, '#f0fff0');
  px(ctx, 12, 3, '#f0fff0');
  px(ctx, 8, 13, '#f0fff0');

  return toCanvasTexture(canvas);
}

// ─── 템플릿 ID → 생성 함수 매핑 ───

const TEXTURE_GENERATORS: Record<EnemyTemplateId, () => THREE.CanvasTexture> = {
  humanoid_small: createHumanoidSmallTexture,
  humanoid_medium: createHumanoidMediumTexture,
  humanoid_large: createHumanoidLargeTexture,
  flying: createFlyingTexture,
  crawler: createCrawlerTexture,
  sphere: createSphereTexture,
  quadruped: createQuadrupedTexture,
  turret: createTurretTexture,
  boss_small: createBossSmallTexture,
  boss_medium: createBossMediumTexture,
  boss_large: createBossLargeTexture,
  cube: createCubeTexture,
};

// ─── Public API ───

/**
 * 템플릿 ID에 해당하는 몬스터 텍스처 가져오기 (캐싱)
 *
 * 흰색 베이스에 디테일을 그리므로, MeshStandardMaterial의 color(=instance color)와
 * 곱셈 블렌딩되어 "텍스처 디테일 + 색상 틴트" 효과가 자연스러움.
 *
 * @param templateId - 적 템플릿 ID (12종)
 * @returns THREE.CanvasTexture (16x16, NearestFilter, SRGBColorSpace)
 */
export function getMobTexture(templateId: EnemyTemplateId): THREE.CanvasTexture {
  const cached = textureCache.get(templateId);
  if (cached) return cached;

  const generator = TEXTURE_GENERATORS[templateId];
  const texture = generator();

  textureCache.set(templateId, texture);
  return texture;
}

/**
 * 텍스처 캐시 해제 (메모리 정리)
 */
export function disposeMobTextureCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}
