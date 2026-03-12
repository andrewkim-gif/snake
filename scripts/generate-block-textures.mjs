#!/usr/bin/env node
/**
 * generate-block-textures.mjs
 * 32x32 프로시저럴 블록 텍스처 생성 스크립트
 * sharp로 raw RGBA 버퍼 → PNG 변환
 *
 * 대상 (16종):
 *  - 기본 9종: grass_top_green, grass_block_side, dirt, stone, sand, coal_ore, bedrock, cobblestone, gravel
 *  - 잔디 변형 3종: grass_top_dark, grass_top_dry, grass_top_lush
 *  - 돌/흙 변형 4종: stone_mossy, stone_cracked, dirt_mossy, dirt_path
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SIZE = 32;
const OUT_DIR = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'textures', 'blocks');

// 결정적 시드 PRNG (Mulberry32)
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RGBA 버퍼 생성
function createBuffer() {
  return Buffer.alloc(SIZE * SIZE * 4);
}

// 픽셀 설정 (r, g, b, a=255)
function setPixel(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

// 전체 채우기
function fill(buf, r, g, b) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      setPixel(buf, x, y, r, g, b);
    }
  }
}

// 노이즈 기반 색상 변형 (seed 기반 결정적)
function addNoise(buf, seed, intensity = 20) {
  const rng = mulberry32(seed);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      const n = Math.floor((rng() - 0.5) * intensity * 2);
      buf[idx] = Math.max(0, Math.min(255, buf[idx] + n));
      buf[idx + 1] = Math.max(0, Math.min(255, buf[idx + 1] + n));
      buf[idx + 2] = Math.max(0, Math.min(255, buf[idx + 2] + n));
    }
  }
}

// 색상 노이즈 (채널별 독립)
function addColorNoise(buf, seed, rInt = 10, gInt = 10, bInt = 10) {
  const rng = mulberry32(seed);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      buf[idx] = Math.max(0, Math.min(255, buf[idx] + Math.floor((rng() - 0.5) * rInt * 2)));
      buf[idx + 1] = Math.max(0, Math.min(255, buf[idx + 1] + Math.floor((rng() - 0.5) * gInt * 2)));
      buf[idx + 2] = Math.max(0, Math.min(255, buf[idx + 2] + Math.floor((rng() - 0.5) * bInt * 2)));
    }
  }
}

// 직사각형 채우기
function fillRect(buf, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPixel(buf, x, y, r, g, b);
    }
  }
}

// 점 패턴 (불규칙 도트)
function addDots(buf, seed, count, r, g, b, size = 1) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        setPixel(buf, x + dx, y + dy, r, g, b);
      }
    }
  }
}

// ============================================
// 각 블록별 텍스처 생성 함수
// ============================================

function generateGrassTopGreen() {
  const buf = createBuffer();
  // 기본 초록
  fill(buf, 95, 159, 53);
  // 밝은 초록 노이즈
  addColorNoise(buf, 1001, 15, 25, 10);
  // 어두운 풀잎 점
  addDots(buf, 1002, 40, 70, 130, 40, 1);
  // 밝은 하이라이트 점
  addDots(buf, 1003, 25, 120, 185, 70, 1);
  return buf;
}

function generateGrassBlockSide() {
  const buf = createBuffer();
  // 상단 4행: 잔디 초록
  fillRect(buf, 0, 0, SIZE, 6, 95, 159, 53);
  // 초록 부분 노이즈
  const rng = mulberry32(2001);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      const n = Math.floor((rng() - 0.5) * 30);
      buf[idx] = Math.max(0, Math.min(255, buf[idx] + n));
      buf[idx + 1] = Math.max(0, Math.min(255, buf[idx + 1] + n));
    }
  }
  // 중간: 잔디-흙 경계 (불규칙)
  for (let x = 0; x < SIZE; x++) {
    const offset = Math.floor(rng() * 3);
    for (let y = 6; y < 6 + offset; y++) {
      setPixel(buf, x, y, 95 + Math.floor(rng() * 20), 140 + Math.floor(rng() * 20), 50);
    }
  }
  // 하단: 흙
  fillRect(buf, 0, 8, SIZE, SIZE - 8, 134, 96, 67);
  addNoise(buf, 2002, 15);
  // 흙 질감 점
  addDots(buf, 2003, 30, 115, 80, 55, 1);
  addDots(buf, 2004, 15, 150, 110, 78, 1);
  return buf;
}

function generateDirt() {
  const buf = createBuffer();
  fill(buf, 134, 96, 67);
  addColorNoise(buf, 3001, 18, 15, 12);
  // 어두운 반점
  addDots(buf, 3002, 35, 110, 78, 52, 2);
  // 밝은 반점
  addDots(buf, 3003, 20, 155, 115, 80, 1);
  // 작은 돌 입자
  addDots(buf, 3004, 8, 160, 155, 140, 1);
  return buf;
}

function generateStone() {
  const buf = createBuffer();
  fill(buf, 125, 125, 125);
  addColorNoise(buf, 4001, 20, 20, 20);
  // 어두운 균열/점
  addDots(buf, 4002, 30, 95, 95, 95, 2);
  // 밝은 하이라이트
  addDots(buf, 4003, 20, 150, 150, 150, 1);
  // 미세한 격자 패턴 (돌 질감)
  const rng = mulberry32(4004);
  for (let y = 0; y < SIZE; y += 4) {
    for (let x = 0; x < SIZE; x++) {
      if (rng() > 0.5) {
        const idx = (y * SIZE + x) * 4;
        buf[idx] -= 8;
        buf[idx + 1] -= 8;
        buf[idx + 2] -= 8;
      }
    }
  }
  return buf;
}

function generateSand() {
  const buf = createBuffer();
  fill(buf, 219, 211, 160);
  addColorNoise(buf, 5001, 12, 10, 8);
  // 밝은 입자
  addDots(buf, 5002, 40, 235, 228, 180, 1);
  // 어두운 입자
  addDots(buf, 5003, 25, 195, 185, 140, 1);
  return buf;
}

function generateCoalOre() {
  const buf = createBuffer();
  // 돌 기반
  fill(buf, 125, 125, 125);
  addNoise(buf, 6001, 15);
  // 석탄 반점 (검은색 덩어리)
  const rng = mulberry32(6002);
  for (let i = 0; i < 6; i++) {
    const cx = 3 + Math.floor(rng() * (SIZE - 6));
    const cy = 3 + Math.floor(rng() * (SIZE - 6));
    const s = 2 + Math.floor(rng() * 3);
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        if (rng() > 0.2) {
          setPixel(buf, cx + dx, cy + dy, 30 + Math.floor(rng() * 20), 28 + Math.floor(rng() * 15), 25 + Math.floor(rng() * 15));
        }
      }
    }
  }
  return buf;
}

function generateBedrock() {
  const buf = createBuffer();
  fill(buf, 85, 85, 85);
  addColorNoise(buf, 7001, 25, 25, 25);
  // 어두운 균열
  addDots(buf, 7002, 50, 50, 50, 50, 2);
  // 밝은 반점
  addDots(buf, 7003, 15, 110, 110, 110, 1);
  // 불규칙 패턴 (극도로 단단한 느낌)
  const rng = mulberry32(7004);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (rng() > 0.85) {
        const idx = (y * SIZE + x) * 4;
        const v = Math.floor(rng() * 30) - 15;
        buf[idx] = Math.max(30, Math.min(120, buf[idx] + v));
        buf[idx + 1] = Math.max(30, Math.min(120, buf[idx + 1] + v));
        buf[idx + 2] = Math.max(30, Math.min(120, buf[idx + 2] + v));
      }
    }
  }
  return buf;
}

function generateCobblestone() {
  const buf = createBuffer();
  fill(buf, 122, 122, 122);
  // 돌 블록 패턴 (불규칙 격자)
  const rng = mulberry32(8001);
  // 돌 블록 경계선
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const blockX = Math.floor(x / 6);
      const blockY = Math.floor(y / 5);
      const offsetX = (blockY % 2 === 0) ? 0 : 3;
      const localX = (x + offsetX) % 6;
      const localY = y % 5;
      // 블록 경계
      if (localX === 0 || localY === 0) {
        setPixel(buf, x, y, 90, 90, 90);
      } else {
        // 블록 내부 색상 변형
        const shade = 110 + Math.floor(rng() * 30);
        setPixel(buf, x, y, shade, shade, shade);
      }
    }
  }
  addNoise(buf, 8002, 8);
  return buf;
}

function generateGravel() {
  const buf = createBuffer();
  fill(buf, 130, 125, 120);
  addColorNoise(buf, 9001, 20, 18, 16);
  // 자갈 입자 (크고 작은 원형 돌)
  const rng = mulberry32(9002);
  for (let i = 0; i < 18; i++) {
    const cx = Math.floor(rng() * SIZE);
    const cy = Math.floor(rng() * SIZE);
    const shade = 100 + Math.floor(rng() * 60);
    const s = 1 + Math.floor(rng() * 3);
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        setPixel(buf, cx + dx, cy + dy, shade, shade - 5, shade - 10);
      }
    }
  }
  return buf;
}

// ============================================
// 잔디 변형 3종
// ============================================

function generateGrassTopDark() {
  const buf = createBuffer();
  // 진한 초록 (어두운 숲)
  fill(buf, 55, 120, 35);
  addColorNoise(buf, 10001, 12, 20, 8);
  addDots(buf, 10002, 35, 40, 100, 25, 1);
  addDots(buf, 10003, 20, 75, 145, 50, 1);
  return buf;
}

function generateGrassTopDry() {
  const buf = createBuffer();
  // 마른 풀 (황록색)
  fill(buf, 155, 165, 75);
  addColorNoise(buf, 11001, 15, 12, 10);
  addDots(buf, 11002, 30, 140, 148, 60, 1);
  addDots(buf, 11003, 20, 170, 180, 90, 1);
  // 갈색 마른 부분
  addDots(buf, 11004, 15, 160, 140, 80, 2);
  return buf;
}

function generateGrassTopLush() {
  const buf = createBuffer();
  // 무성한 풀 (밝은 에메랄드)
  fill(buf, 70, 190, 55);
  addColorNoise(buf, 12001, 10, 22, 8);
  addDots(buf, 12002, 35, 55, 170, 40, 1);
  addDots(buf, 12003, 25, 90, 215, 70, 1);
  // 꽃 점 (작은 노란/흰 점)
  addDots(buf, 12004, 5, 240, 240, 100, 1);
  return buf;
}

// ============================================
// 돌/흙 변형 4종
// ============================================

function generateStoneMossy() {
  const buf = createBuffer();
  // 돌 기반
  fill(buf, 125, 125, 125);
  addNoise(buf, 13001, 15);
  // 이끼 패치 (초록)
  const rng = mulberry32(13002);
  for (let i = 0; i < 10; i++) {
    const cx = Math.floor(rng() * SIZE);
    const cy = Math.floor(rng() * SIZE);
    const s = 2 + Math.floor(rng() * 4);
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        if (rng() > 0.3) {
          const gr = 60 + Math.floor(rng() * 30);
          setPixel(buf, (cx + dx) % SIZE, (cy + dy) % SIZE, gr - 20, gr + 40, gr - 25);
        }
      }
    }
  }
  return buf;
}

function generateStoneCracked() {
  const buf = createBuffer();
  fill(buf, 120, 120, 120);
  addNoise(buf, 14001, 15);
  // 균열 라인
  const rng = mulberry32(14002);
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(rng() * SIZE);
    let y = Math.floor(rng() * SIZE);
    const len = 8 + Math.floor(rng() * 12);
    for (let j = 0; j < len; j++) {
      setPixel(buf, x, y, 70, 70, 70);
      if (rng() > 0.5) setPixel(buf, x + 1, y, 80, 80, 80);
      if (rng() > 0.6) x += (rng() > 0.5 ? 1 : -1);
      y += 1;
      if (y >= SIZE) break;
      x = Math.max(0, Math.min(SIZE - 1, x));
    }
  }
  return buf;
}

function generateDirtMossy() {
  const buf = createBuffer();
  fill(buf, 134, 96, 67);
  addColorNoise(buf, 15001, 15, 12, 10);
  // 이끼 패치
  const rng = mulberry32(15002);
  for (let i = 0; i < 8; i++) {
    const cx = Math.floor(rng() * SIZE);
    const cy = Math.floor(rng() * SIZE);
    const s = 2 + Math.floor(rng() * 3);
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        if (rng() > 0.3) {
          setPixel(buf, (cx + dx) % SIZE, (cy + dy) % SIZE, 70 + Math.floor(rng() * 20), 110 + Math.floor(rng() * 30), 50);
        }
      }
    }
  }
  return buf;
}

function generateDirtPath() {
  const buf = createBuffer();
  // 밝은 갈색 (다진 흙길)
  fill(buf, 165, 130, 90);
  addColorNoise(buf, 16001, 12, 10, 8);
  // 발자국 자갈 느낌
  addDots(buf, 16002, 20, 145, 110, 75, 2);
  addDots(buf, 16003, 25, 180, 145, 105, 1);
  // 가장자리 어둡게
  for (let x = 0; x < SIZE; x++) {
    setPixel(buf, x, 0, 140, 105, 70);
    setPixel(buf, x, 1, 145, 110, 75);
    setPixel(buf, x, SIZE - 1, 140, 105, 70);
    setPixel(buf, x, SIZE - 2, 145, 110, 75);
  }
  return buf;
}

// ============================================
// PNG 저장 함수
// ============================================

async function saveTexture(name, buf) {
  const path = join(OUT_DIR, `${name}.png`);
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .png()
    .toFile(path);
  const stat = await import('fs').then(fs => fs.statSync(path));
  console.log(`  ✓ ${name}.png (${stat.size} bytes)`);
}

// ============================================
// 메인
// ============================================

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('🎨 Generating 32x32 procedural block textures...\n');

  // 기본 9종
  console.log('--- Base blocks (9) ---');
  await saveTexture('grass_top_green', generateGrassTopGreen());
  await saveTexture('grass_block_side', generateGrassBlockSide());
  await saveTexture('dirt', generateDirt());
  await saveTexture('stone', generateStone());
  await saveTexture('sand', generateSand());
  await saveTexture('coal_ore', generateCoalOre());
  await saveTexture('bedrock', generateBedrock());
  await saveTexture('cobblestone', generateCobblestone());
  await saveTexture('gravel', generateGravel());

  // 잔디 변형 3종
  console.log('\n--- Grass variants (3) ---');
  await saveTexture('grass_top_dark', generateGrassTopDark());
  await saveTexture('grass_top_dry', generateGrassTopDry());
  await saveTexture('grass_top_lush', generateGrassTopLush());

  // 돌/흙 변형 4종
  console.log('\n--- Stone/Dirt variants (4) ---');
  await saveTexture('stone_mossy', generateStoneMossy());
  await saveTexture('stone_cracked', generateStoneCracked());
  await saveTexture('dirt_mossy', generateDirtMossy());
  await saveTexture('dirt_path', generateDirtPath());

  console.log('\n✅ Done! 16 textures generated in', OUT_DIR);
}

main().catch(console.error);
