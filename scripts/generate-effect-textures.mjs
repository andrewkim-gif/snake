#!/usr/bin/env node
/**
 * generate-effect-textures.mjs
 * 32x32 프로시저럴 이펙트 스프라이트 PNG 생성 스크립트
 * sharp로 raw RGBA 버퍼 → PNG 변환
 *
 * 대상 (8종):
 *  spark, flame, smoke, dust, slash_trail, bullet_trail, hit_flash, xp_glow
 * → apps/web/public/textures/arena/fx/ 에 저장
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SIZE = 32;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2;
const OUT_DIR = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'textures', 'arena', 'fx');

// 결정적 시드 PRNG (Mulberry32)
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RGBA 버퍼 생성 (모두 투명)
function createBuffer() {
  return Buffer.alloc(SIZE * SIZE * 4, 0);
}

// 픽셀 설정 (알파 블렌딩)
function setPixel(buf, x, y, r, g, b, a = 255) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= SIZE || iy < 0 || iy >= SIZE) return;
  const idx = (iy * SIZE + ix) * 4;

  // 기존 알파와 합성 (SRC_OVER)
  const srcA = a / 255;
  const dstA = buf[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);

  if (outA > 0) {
    buf[idx]     = Math.round((r * srcA + buf[idx]     * dstA * (1 - srcA)) / outA);
    buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
    buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
    buf[idx + 3] = Math.round(outA * 255);
  }
}

// 픽셀 설정 (덮어쓰기, 블렌딩 없이)
function setPixelRaw(buf, x, y, r, g, b, a = 255) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= SIZE || iy < 0 || iy >= SIZE) return;
  const idx = (iy * SIZE + ix) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

// 픽셀 additive 블렌딩
function addPixel(buf, x, y, r, g, b, a = 255) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= SIZE || iy < 0 || iy >= SIZE) return;
  const idx = (iy * SIZE + ix) * 4;

  buf[idx]     = Math.min(255, buf[idx]     + Math.round(r * a / 255));
  buf[idx + 1] = Math.min(255, buf[idx + 1] + Math.round(g * a / 255));
  buf[idx + 2] = Math.min(255, buf[idx + 2] + Math.round(b * a / 255));
  buf[idx + 3] = Math.min(255, buf[idx + 3] + a);
}

// 방사형 그라디언트 원 그리기
function drawRadialGradient(buf, cx, cy, radius, stops) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const t = Math.min(dist / radius, 1.0);

      // 그라디언트 보간
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].pos && t <= stops[i + 1].pos) {
          const local = (t - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
          r = Math.round(stops[i].r + (stops[i + 1].r - stops[i].r) * local);
          g = Math.round(stops[i].g + (stops[i + 1].g - stops[i].g) * local);
          b = Math.round(stops[i].b + (stops[i + 1].b - stops[i].b) * local);
          a = Math.round(stops[i].a + (stops[i + 1].a - stops[i].a) * local);
          break;
        }
      }

      if (a > 0) {
        setPixel(buf, x, y, r, g, b, a);
      }
    }
  }
}

// Additive 방사형 그라디언트
function drawRadialGradientAdditive(buf, cx, cy, radius, stops) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const t = Math.min(dist / radius, 1.0);

      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].pos && t <= stops[i + 1].pos) {
          const local = (t - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
          r = Math.round(stops[i].r + (stops[i + 1].r - stops[i].r) * local);
          g = Math.round(stops[i].g + (stops[i + 1].g - stops[i].g) * local);
          b = Math.round(stops[i].b + (stops[i + 1].b - stops[i].b) * local);
          a = Math.round(stops[i].a + (stops[i + 1].a - stops[i].a) * local);
          break;
        }
      }

      if (a > 0) {
        addPixel(buf, x, y, r, g, b, a);
      }
    }
  }
}

// 선분 그리기 (Bresenham)
function drawLine(buf, x0, y0, x1, y1, r, g, b, a, width = 1) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  const halfW = Math.floor(width / 2);

  while (true) {
    for (let wy = -halfW; wy <= halfW; wy++) {
      for (let wx = -halfW; wx <= halfW; wx++) {
        setPixel(buf, cx + wx, cy + wy, r, g, b, a);
      }
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
}

// ============================================
// 이펙트 생성 함수들
// ============================================

/** spark: 밝은 노란+흰 방사형 글로우, 중심 밝음 + 십자 패턴 */
function generateSpark() {
  const buf = createBuffer();

  // 메인 글로우
  drawRadialGradient(buf, CX, CY, R, [
    { pos: 0.0,  r: 255, g: 255, b: 255, a: 255 },
    { pos: 0.15, r: 255, g: 255, b: 200, a: 242 },
    { pos: 0.4,  r: 255, g: 230, b: 100, a: 153 },
    { pos: 0.7,  r: 255, g: 200, b: 50,  a: 51  },
    { pos: 1.0,  r: 255, g: 180, b: 0,   a: 0   },
  ]);

  // 십자 광선 (수평+수직)
  for (let x = 0; x < SIZE; x++) {
    const dist = Math.abs(x - CX) / R;
    const alpha = Math.round(200 * Math.max(0, 1 - dist * 1.5));
    if (alpha > 0) {
      addPixel(buf, x, CY - 1, 255, 255, 255, Math.round(alpha * 0.6));
      addPixel(buf, x, CY, 255, 255, 255, alpha);
      addPixel(buf, x, CY + 1, 255, 255, 255, Math.round(alpha * 0.6));
    }
  }
  for (let y = 0; y < SIZE; y++) {
    const dist = Math.abs(y - CY) / R;
    const alpha = Math.round(200 * Math.max(0, 1 - dist * 1.5));
    if (alpha > 0) {
      addPixel(buf, CX - 1, y, 255, 255, 255, Math.round(alpha * 0.6));
      addPixel(buf, CX, y, 255, 255, 255, alpha);
      addPixel(buf, CX + 1, y, 255, 255, 255, Math.round(alpha * 0.6));
    }
  }

  return buf;
}

/** flame: 주황~빨강 그라디언트, 불꽃 형태 */
function generateFlame() {
  const buf = createBuffer();

  // 타원형 불꽃 (살짝 아래 치우침)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - CX) / (R * 0.85);
      const dy = (y - (CY + 2)) / (R * 0.95);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) continue;

      const t = dist;
      let r, g, b, a;
      if (t < 0.2) {
        const l = t / 0.2;
        r = 255; g = Math.round(255 - 55 * l); b = Math.round(200 - 150 * l); a = 255;
      } else if (t < 0.45) {
        const l = (t - 0.2) / 0.25;
        r = 255; g = Math.round(200 - 80 * l); b = Math.round(50 - 30 * l); a = Math.round(230 - 51 * l);
      } else if (t < 0.7) {
        const l = (t - 0.45) / 0.25;
        r = Math.round(255 - 55 * l); g = Math.round(120 - 70 * l); b = Math.round(20 - 10 * l); a = Math.round(179 - 102 * l);
      } else {
        const l = (t - 0.7) / 0.3;
        r = Math.round(200 - 50 * l); g = Math.round(50 - 30 * l); b = Math.round(10); a = Math.round(77 * (1 - l));
      }

      setPixel(buf, x, y, r, g, b, a);
    }
  }

  // 중심 코어 글로우
  drawRadialGradientAdditive(buf, CX, CY + 3, R * 0.35, [
    { pos: 0, r: 255, g: 255, b: 255, a: 153 },
    { pos: 1, r: 255, g: 200, b: 100, a: 0 },
  ]);

  return buf;
}

/** smoke: 회색 원형, 부드러운 엣지, 반투명 */
function generateSmoke() {
  const buf = createBuffer();

  // 메인 연기
  drawRadialGradient(buf, CX, CY, R, [
    { pos: 0.0, r: 180, g: 180, b: 180, a: 128 },
    { pos: 0.3, r: 160, g: 160, b: 160, a: 102 },
    { pos: 0.6, r: 140, g: 140, b: 140, a: 51  },
    { pos: 1.0, r: 120, g: 120, b: 120, a: 0   },
  ]);

  // 오프셋 두 번째 연기 레이어
  drawRadialGradient(buf, CX - 3, CY - 2, R * 0.8, [
    { pos: 0.0, r: 200, g: 200, b: 200, a: 77 },
    { pos: 1.0, r: 150, g: 150, b: 150, a: 0  },
  ]);

  return buf;
}

/** dust: 갈색 점들, 산개 패턴 */
function generateDust() {
  const buf = createBuffer();

  // 베이스 갈색 글로우
  drawRadialGradient(buf, CX, CY, R, [
    { pos: 0.0, r: 180, g: 140, b: 80, a: 128 },
    { pos: 0.5, r: 160, g: 120, b: 60, a: 64  },
    { pos: 1.0, r: 140, g: 100, b: 40, a: 0   },
  ]);

  // 산개된 점들
  const rng = mulberry32(42);
  for (let i = 0; i < 20; i++) {
    const px = rng() * SIZE;
    const py = rng() * SIZE;
    const dist = Math.sqrt((px - CX) ** 2 + (py - CY) ** 2);
    if (dist > R * 0.85) continue;

    const alpha = Math.round((1 - dist / R) * (80 + rng() * 100));
    const sz = 1 + Math.floor(rng() * 2);
    const brown = Math.floor(100 + rng() * 80);

    for (let dy = 0; dy < sz; dy++) {
      for (let dx = 0; dx < sz; dx++) {
        setPixel(buf, Math.floor(px) + dx, Math.floor(py) + dy,
          brown + 50, brown + 20, Math.max(0, brown - 30), alpha);
      }
    }
  }

  return buf;
}

/** slash_trail: 흰→연파랑 호형 궤적 */
function generateSlashTrail() {
  const buf = createBuffer();

  // 호형 궤적 (다중 두께로 글로우 시뮬레이션)
  const arcRadius = R * 0.65;
  const arcCY = CY + 4;
  const startAngle = Math.PI * 1.2;
  const endAngle = Math.PI * 1.9;
  const steps = 60;

  // 외부 글로우 (넓은 반경)
  const widths = [
    { w: 4, r: 180, g: 220, b: 255, a: 25 },
    { w: 3, r: 190, g: 225, b: 255, a: 50 },
    { w: 2, r: 220, g: 240, b: 255, a: 100 },
    { w: 1, r: 255, g: 255, b: 255, a: 230 },
  ];

  for (const layer of widths) {
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const x = CX + Math.cos(angle) * arcRadius;
      const y = arcCY + Math.sin(angle) * arcRadius;

      for (let dy = -layer.w; dy <= layer.w; dy++) {
        for (let dx = -layer.w; dx <= layer.w; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= layer.w) {
            const falloff = 1 - d / (layer.w + 0.5);
            setPixel(buf, Math.round(x + dx), Math.round(y + dy),
              layer.r, layer.g, layer.b, Math.round(layer.a * falloff));
          }
        }
      }
    }
  }

  // 끝 점 글로우
  const tipAngle = endAngle;
  const tipX = CX + Math.cos(tipAngle) * arcRadius;
  const tipY = arcCY + Math.sin(tipAngle) * arcRadius;
  drawRadialGradientAdditive(buf, tipX, tipY, 4, [
    { pos: 0, r: 255, g: 255, b: 255, a: 200 },
    { pos: 1, r: 200, g: 230, b: 255, a: 0 },
  ]);

  return buf;
}

/** bullet_trail: 밝은 원형 점, 중심 밝음 */
function generateBulletTrail() {
  const buf = createBuffer();

  // 내부 밝은 코어
  drawRadialGradient(buf, CX, CY, R * 0.6, [
    { pos: 0.0, r: 255, g: 255, b: 255, a: 255 },
    { pos: 0.3, r: 200, g: 230, b: 255, a: 204 },
    { pos: 0.6, r: 150, g: 200, b: 255, a: 102 },
    { pos: 1.0, r: 100, g: 170, b: 255, a: 0   },
  ]);

  // 외곽 헤일로
  drawRadialGradient(buf, CX, CY, R, [
    { pos: 0.0, r: 130, g: 180, b: 255, a: 0   },
    { pos: 0.5, r: 130, g: 180, b: 255, a: 25  },
    { pos: 1.0, r: 100, g: 150, b: 255, a: 0   },
  ]);

  return buf;
}

/** hit_flash: 흰+노란 방사형 폭발 + 광선 */
function generateHitFlash() {
  const buf = createBuffer();

  // 방사형 폭발 베이스
  drawRadialGradient(buf, CX, CY, R, [
    { pos: 0.0,  r: 255, g: 255, b: 255, a: 255 },
    { pos: 0.15, r: 255, g: 255, b: 220, a: 230 },
    { pos: 0.35, r: 255, g: 240, b: 150, a: 153 },
    { pos: 0.6,  r: 255, g: 200, b: 80,  a: 64  },
    { pos: 1.0,  r: 255, g: 180, b: 50,  a: 0   },
  ]);

  // 8방향 광선
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const ex = CX + Math.cos(angle) * R * 0.9;
    const ey = CY + Math.sin(angle) * R * 0.9;

    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = CX + (ex - CX) * t;
      const y = CY + (ey - CY) * t;
      const alpha = Math.round(100 * (1 - t));
      const gVal = Math.round(255 - 15 * t);
      const bVal = Math.round(255 - 75 * t);
      addPixel(buf, Math.round(x), Math.round(y), 255, gVal, bVal, alpha);
      // 두께 1px 추가
      addPixel(buf, Math.round(x) + 1, Math.round(y), 255, gVal, bVal, Math.round(alpha * 0.5));
      addPixel(buf, Math.round(x), Math.round(y) + 1, 255, gVal, bVal, Math.round(alpha * 0.5));
    }
  }

  return buf;
}

/** xp_glow: 초록+연두 방사형 글로우 */
function generateXpGlow() {
  const buf = createBuffer();

  // 초록 방사형 글로우
  drawRadialGradient(buf, CX, CY, R, [
    { pos: 0.0, r: 180, g: 255, b: 180, a: 255 },
    { pos: 0.2, r: 100, g: 255, b: 100, a: 204 },
    { pos: 0.5, r: 50,  g: 200, b: 50,  a: 102 },
    { pos: 0.8, r: 30,  g: 150, b: 30,  a: 26  },
    { pos: 1.0, r: 20,  g: 100, b: 20,  a: 0   },
  ]);

  // 중심 밝은 코어
  drawRadialGradientAdditive(buf, CX, CY, R * 0.25, [
    { pos: 0, r: 255, g: 255, b: 255, a: 128 },
    { pos: 1, r: 200, g: 255, b: 200, a: 0 },
  ]);

  return buf;
}

// ============================================
// 메인 실행
// ============================================

const generators = {
  spark: generateSpark,
  flame: generateFlame,
  smoke: generateSmoke,
  dust: generateDust,
  slash_trail: generateSlashTrail,
  bullet_trail: generateBulletTrail,
  hit_flash: generateHitFlash,
  xp_glow: generateXpGlow,
};

async function main() {
  // 출력 디렉토리 생성
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`🎨 이펙트 텍스처 생성 시작 (${SIZE}x${SIZE}, RGBA)`);
  console.log(`📁 출력: ${OUT_DIR}\n`);

  for (const [name, gen] of Object.entries(generators)) {
    const buf = gen();
    const outPath = join(OUT_DIR, `${name}.png`);

    await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
      .png()
      .toFile(outPath);

    console.log(`  ✅ ${name}.png (${buf.length} bytes raw → PNG)`);
  }

  console.log(`\n🎉 완료: ${Object.keys(generators).length}종 이펙트 텍스처 생성`);
}

main().catch(console.error);
