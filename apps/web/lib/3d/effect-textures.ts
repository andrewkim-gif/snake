/**
 * effect-textures.ts — 이펙트 스프라이트 텍스처 로더 + 프로시저럴 CanvasTexture fallback
 *
 * 8종 이펙트 텍스처: spark, flame, smoke, dust, slash_trail, bullet_trail, hit_flash, xp_glow
 * - 파일 로딩 시도 (/textures/arena/fx/[name].png)
 * - 실패 시 CanvasTexture 프로시저럴 fallback (radialGradient 기반)
 * - LinearFilter 사용 (이펙트는 부드럽게)
 * - 캐싱: 동일 이름 재요청 시 캐시 반환
 */

import * as THREE from 'three';

// ─── 상수 ───
const FX_SIZE = 32;
const FX_PATH = '/textures/arena/fx/';

// ─── 텍스처 캐시 ───
const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

// ─── 이펙트 이름 타입 ───
export type EffectName =
  | 'spark'
  | 'flame'
  | 'smoke'
  | 'dust'
  | 'slash_trail'
  | 'bullet_trail'
  | 'hit_flash'
  | 'xp_glow';

// ─── 프로시저럴 생성 함수 맵 ───
const proceduralGenerators: Record<EffectName, () => THREE.CanvasTexture> = {
  spark: createSparkTexture,
  flame: createFlameTexture,
  smoke: createSmokeTexture,
  dust: createDustTexture,
  slash_trail: createSlashTrailTexture,
  bullet_trail: createBulletTrailTexture,
  hit_flash: createHitFlashTexture,
  xp_glow: createXpGlowTexture,
};

// ─── Canvas 헬퍼 ───

function createCanvas(size = FX_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function toEffectTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  // 이펙트는 LinearFilter로 부드럽게 (NearestFilter 사용하지 않음)
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── 메인 API ───

/**
 * 이펙트 텍스처 가져오기 (캐싱)
 * 1) 캐시 확인
 * 2) 파일 로딩 시도 → 성공 시 캐시 저장
 * 3) 실패 시 프로시저럴 CanvasTexture fallback
 */
export function getEffectTexture(name: EffectName): THREE.Texture {
  const cached = textureCache.get(name);
  if (cached) return cached;

  // 프로시저럴 fallback 먼저 생성 (즉시 사용 가능)
  const generator = proceduralGenerators[name];
  const fallback = generator();
  textureCache.set(name, fallback);

  // 파일 로딩 비동기 시도 — 성공하면 캐시 교체
  loader.load(
    `${FX_PATH}${name}.png`,
    (tex) => {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(name, tex);
      // 이전 fallback dispose
      fallback.dispose();
    },
    undefined,
    // 로딩 실패 — fallback 유지 (에러 무시)
    () => {},
  );

  return fallback;
}

/**
 * 모든 이펙트 텍스처 캐시 해제
 */
export function disposeEffectTextures(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}

// ============================================
// 프로시저럴 텍스처 생성 함수들 (32x32 Canvas)
// ============================================

/** spark: 밝은 노란+흰 방사형 글로우, 중심 밝음 */
export function createSparkTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  // 방사형 그라디언트: 중심(밝은 흰색) → 노란색 → 투명
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.15, 'rgba(255, 255, 200, 0.95)');
  grad.addColorStop(0.4, 'rgba(255, 230, 100, 0.6)');
  grad.addColorStop(0.7, 'rgba(255, 200, 50, 0.2)');
  grad.addColorStop(1.0, 'rgba(255, 180, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  // 중심에 작은 밝은 십자 패턴 (스파크 느낌)
  ctx.globalCompositeOperation = 'lighter';
  const crossGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
  crossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  crossGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = crossGrad;

  // 수평 빔
  ctx.fillRect(0, cy - 2, FX_SIZE, 4);
  // 수직 빔
  ctx.fillRect(cx - 2, 0, 4, FX_SIZE);

  return toEffectTexture(canvas);
}

/** flame: 주황~빨강 그라디언트, 불꽃 형태 */
export function createFlameTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  // 배경 투명
  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 방사형 그라디언트: 중심(밝은 노란) → 주황 → 빨강 → 투명
  const grad = ctx.createRadialGradient(cx, cy * 1.1, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255, 255, 200, 1.0)');
  grad.addColorStop(0.2, 'rgba(255, 200, 50, 0.9)');
  grad.addColorStop(0.45, 'rgba(255, 120, 20, 0.7)');
  grad.addColorStop(0.7, 'rgba(200, 50, 10, 0.3)');
  grad.addColorStop(1.0, 'rgba(150, 20, 0, 0.0)');

  ctx.fillStyle = grad;
  // 약간 위로 치우친 타원형 불꽃
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, r * 0.85, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // 상단에 밝은 코어
  const coreGrad = ctx.createRadialGradient(cx, cy + 3, 0, cx, cy + 3, r * 0.35);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  coreGrad.addColorStop(1.0, 'rgba(255, 200, 100, 0.0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  return toEffectTexture(canvas);
}

/** smoke: 회색 원형, 부드러운 엣지, 반투명 */
export function createSmokeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 부드러운 회색 방사형 그라디언트
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(180, 180, 180, 0.5)');
  grad.addColorStop(0.3, 'rgba(160, 160, 160, 0.4)');
  grad.addColorStop(0.6, 'rgba(140, 140, 140, 0.2)');
  grad.addColorStop(1.0, 'rgba(120, 120, 120, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  // 약간의 불규칙성을 위해 오프셋된 두 번째 그라디언트
  const grad2 = ctx.createRadialGradient(cx - 3, cy - 2, 0, cx, cy, r * 0.8);
  grad2.addColorStop(0, 'rgba(200, 200, 200, 0.3)');
  grad2.addColorStop(1.0, 'rgba(150, 150, 150, 0.0)');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  return toEffectTexture(canvas);
}

/** dust: 갈색 점들, 산개 패턴 */
export function createDustTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 베이스: 부드러운 갈색 글로우
  const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  baseGrad.addColorStop(0, 'rgba(180, 140, 80, 0.5)');
  baseGrad.addColorStop(0.5, 'rgba(160, 120, 60, 0.25)');
  baseGrad.addColorStop(1.0, 'rgba(140, 100, 40, 0.0)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  // 산개된 점들
  const rng = mulberry32(42); // 결정적 랜덤
  for (let i = 0; i < 20; i++) {
    const px = rng() * FX_SIZE;
    const py = rng() * FX_SIZE;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    if (dist > r * 0.85) continue; // 원 바깥 제외

    const alpha = (1 - dist / r) * (0.3 + rng() * 0.4);
    const size = 1 + rng() * 2;
    const brown = Math.floor(100 + rng() * 80);

    ctx.fillStyle = `rgba(${brown + 50}, ${brown + 20}, ${brown - 30}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  return toEffectTexture(canvas);
}

/** slash_trail: 흰→연파랑 호형 궤적 */
export function createSlashTrailTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 호형 궤적 (arc 형태)
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  // 외부 글로우
  for (let w = 8; w >= 2; w -= 2) {
    const alpha = w === 8 ? 0.1 : w === 6 ? 0.2 : w === 4 ? 0.4 : 0.8;
    ctx.strokeStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cy + 4, r * 0.65, Math.PI * 1.2, Math.PI * 1.9);
    ctx.stroke();
  }

  // 중심 밝은 라인
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, r * 0.65, Math.PI * 1.2, Math.PI * 1.9);
  ctx.stroke();

  // 시작/끝 점에 밝은 글로우
  const startAngle = Math.PI * 1.9;
  const sx = cx + Math.cos(startAngle) * r * 0.65;
  const sy = cy + 4 + Math.sin(startAngle) * r * 0.65;
  const tipGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4);
  tipGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  tipGrad.addColorStop(1, 'rgba(200, 230, 255, 0.0)');
  ctx.fillStyle = tipGrad;
  ctx.fillRect(sx - 4, sy - 4, 8, 8);

  return toEffectTexture(canvas);
}

/** bullet_trail: 밝은 원형 점, 중심 밝음 */
export function createBulletTrailTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 밝은 원형 글로우
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.3, 'rgba(200, 230, 255, 0.8)');
  grad.addColorStop(0.6, 'rgba(150, 200, 255, 0.4)');
  grad.addColorStop(1.0, 'rgba(100, 170, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  // 추가 외곽 헤일로
  const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  haloGrad.addColorStop(0, 'rgba(130, 180, 255, 0.1)');
  haloGrad.addColorStop(1.0, 'rgba(100, 150, 255, 0.0)');
  ctx.fillStyle = haloGrad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  return toEffectTexture(canvas);
}

/** hit_flash: 흰+노란 방사형 폭발 */
export function createHitFlashTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 방사형 폭발 패턴
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.15, 'rgba(255, 255, 220, 0.9)');
  grad.addColorStop(0.35, 'rgba(255, 240, 150, 0.6)');
  grad.addColorStop(0.6, 'rgba(255, 200, 80, 0.25)');
  grad.addColorStop(1.0, 'rgba(255, 180, 50, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  // 방사형 광선 (8방향)
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const ex = cx + Math.cos(angle) * r * 0.9;
    const ey = cy + Math.sin(angle) * r * 0.9;

    const rayGrad = ctx.createLinearGradient(cx, cy, ex, ey);
    rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    rayGrad.addColorStop(0.5, 'rgba(255, 240, 180, 0.15)');
    rayGrad.addColorStop(1.0, 'rgba(255, 220, 100, 0.0)');

    ctx.strokeStyle = rayGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  return toEffectTexture(canvas);
}

/** xp_glow: 초록+연두 방사형 글로우 */
export function createXpGlowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = FX_SIZE / 2;
  const cy = FX_SIZE / 2;
  const r = FX_SIZE / 2;

  ctx.clearRect(0, 0, FX_SIZE, FX_SIZE);

  // 초록 방사형 글로우
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(180, 255, 180, 1.0)');
  grad.addColorStop(0.2, 'rgba(100, 255, 100, 0.8)');
  grad.addColorStop(0.5, 'rgba(50, 200, 50, 0.4)');
  grad.addColorStop(0.8, 'rgba(30, 150, 30, 0.1)');
  grad.addColorStop(1.0, 'rgba(20, 100, 20, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  // 중심에 밝은 코어
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.25);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  coreGrad.addColorStop(1.0, 'rgba(200, 255, 200, 0.0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, FX_SIZE, FX_SIZE);

  return toEffectTexture(canvas);
}

// ─── 유틸 ───

/** 결정적 PRNG (Mulberry32) — dust 텍스처용 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
