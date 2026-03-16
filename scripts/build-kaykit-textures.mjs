#!/usr/bin/env node

/**
 * build-kaykit-textures.mjs — KayKit BlockBits 아틀라스에서 블록 텍스처 추출
 *
 * 각 GLTF의 .bin에서 TEXCOORD_0 UV bounding box를 계산하고
 * block_bits_texture.png (1024x1024)에서 crop → 32x32 PNG 저장
 *
 * GLTF UV 좌표계: V=0이 이미지 상단 (V 반전 불필요)
 *
 * Usage: node scripts/build-kaykit-textures.mjs
 */

import { readFileSync, mkdirSync, existsSync, statSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const GLTF_DIR = 'assets/KayKit_BlockBits_1.0_FREE/Assets/gltf';
const ATLAS_PATH = path.join(GLTF_DIR, 'block_bits_texture.png');
const OUTPUT_DIR = 'apps/web/public/textures/blocks';
const ATLAS_SIZE = 1024;
const OUTPUT_SIZE = 32;

// ── UV 바운딩 박스 계산 ──────────────────────────────────────────────
function readUVBounds(gltfName) {
  const gltfPath = path.join(GLTF_DIR, `${gltfName}.gltf`);
  const binPath = path.join(GLTF_DIR, `${gltfName}.bin`);

  const gltf = JSON.parse(readFileSync(gltfPath, 'utf-8'));
  const bin = readFileSync(binPath);

  const prim = gltf.meshes[0].primitives[0];
  const texAccessor = gltf.accessors[prim.attributes.TEXCOORD_0];
  const texBV = gltf.bufferViews[texAccessor.bufferView];
  const offset = (texBV.byteOffset ?? 0) + (texAccessor.byteOffset ?? 0);
  const count = texAccessor.count;

  const uvs = [];
  for (let i = 0; i < count; i++) {
    uvs.push([
      bin.readFloatLE(offset + i * 8),
      bin.readFloatLE(offset + i * 8 + 4),
    ]);
  }
  return uvs;
}

// UV 좌표 → 픽셀 crop 영역 (V 반전 없음)
function uvBoundsToPixelRect(uvs) {
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  for (const [u, v] of uvs) {
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return {
    left: Math.floor(minU * ATLAS_SIZE),
    top: Math.floor(minV * ATLAS_SIZE),
    width: Math.ceil((maxU - minU) * ATLAS_SIZE),
    height: Math.ceil((maxV - minV) * ATLAS_SIZE),
  };
}

// ── UV 클러스터 분석 (전환 블록용) ───────────────────────────────────
function clusterUVs(uvs) {
  // 아틀라스를 8x8 그리드로 분할하여 UV 포인트를 셀에 배치
  const cellSize = 1 / 8;
  const cellMap = new Map();
  for (const [u, v] of uvs) {
    const cx = Math.floor(u / cellSize);
    const cy = Math.floor(v / cellSize);
    const key = `${cx},${cy}`;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key).push([u, v]);
  }

  // BFS로 인접 셀을 클러스터로 병합
  const clusters = [];
  const visited = new Set();

  for (const [key, points] of cellMap) {
    if (visited.has(key)) continue;

    const cluster = [...points];
    const queue = [key];
    visited.add(key);

    while (queue.length > 0) {
      const curr = queue.shift();
      const [cx, cy] = curr.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nk = `${cx + dx},${cy + dy}`;
          if (cellMap.has(nk) && !visited.has(nk)) {
            visited.add(nk);
            queue.push(nk);
            cluster.push(...cellMap.get(nk));
          }
        }
      }
    }
    clusters.push(cluster);
  }

  // 포인트 수 기준 내림차순 정렬
  clusters.sort((a, b) => b.length - a.length);
  return clusters;
}

// ── 추출 대상 정의 ──────────────────────────────────────────────────
// 단순 블록: gltf 이름으로 UV bbox 전체를 crop
const SIMPLE_BLOCKS = {
  snow: 'snow',
  stone_dark: 'stone_dark',
  sand_A: 'sand',       // sand_A → sand.png (밝은 모래)
  sand_B: 'sand_dark',  // sand_B → sand_dark.png (어두운 모래)
  water: 'water',
};

// 하드코딩 블록: UV 분석이 복잡한 블록은 아틀라스 좌표를 직접 지정
// lava 모델은 stone_dark 텍스처 + lava 텍스처를 혼합하여 사용하므로
// lava 색상 영역을 직접 지정
const HARDCODED_BLOCKS = {
  lava: {
    output: 'lava',
    rect: { left: 128, top: 288, width: 96, height: 96 }, // 아틀라스의 밝은 주황색 lava 영역
  },
};

// 전환 블록: 클러스터 분석 후 적합한 재질 텍스처를 추출
// cluster 0 = 메인 재질 (더 많은 UV 포인트), cluster 1 = 전환 재질
// 게임에서 블록 전체에 하나의 텍스처를 사용하므로, 대표 재질을 선택
const TRANSITION_BLOCKS = [
  // dirt_with_grass: c0=dirt, c1=grass → 이름이 "grass_top"이므로 c1 (grass) 사용
  { gltf: 'dirt_with_grass', output: 'dirt_with_grass_top', cluster: 1 },
  // dirt_with_snow: c0=dirt, c1=snow → 눈 덮인 흙의 대표 색은 c0 (dirt side)
  { gltf: 'dirt_with_snow', output: 'dirt_with_snow', cluster: 0 },
  // grass_with_snow: c0=snow, c1=grass → 눈 덮인 잔디의 대표색은 c1 (grass)
  { gltf: 'grass_with_snow', output: 'grass_with_snow', cluster: 1 },
  // sand_with_grass: c0=sand, c1=grass → 모래+풀의 대표색은 c0 (sand side)
  { gltf: 'sand_with_grass', output: 'sand_with_grass', cluster: 0 },
  // gravel_with_grass: c0=gravel, c1=grass → 자갈+풀의 대표색은 c0 (gravel side)
  { gltf: 'gravel_with_grass', output: 'gravel_with_grass', cluster: 0 },
];

// ── 메인 실행 ───────────────────────────────────────────────────────
async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[build-kaykit] Atlas: ${ATLAS_PATH} (${ATLAS_SIZE}x${ATLAS_SIZE})`);
  console.log(`[build-kaykit] Output: ${OUTPUT_DIR} (${OUTPUT_SIZE}x${OUTPUT_SIZE})`);
  console.log('');

  let successCount = 0;
  const totalCount =
    Object.keys(SIMPLE_BLOCKS).length +
    Object.keys(HARDCODED_BLOCKS).length +
    TRANSITION_BLOCKS.length;

  // ── 단순 블록 처리 ──
  console.log('=== Simple Blocks ===');
  for (const [gltfName, outputName] of Object.entries(SIMPLE_BLOCKS)) {
    try {
      const uvs = readUVBounds(gltfName);
      const rect = uvBoundsToPixelRect(uvs);

      // 유효성 검사
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.left + rect.width > ATLAS_SIZE ||
        rect.top + rect.height > ATLAS_SIZE
      ) {
        console.warn(
          `  [SKIP] ${gltfName} — invalid crop: ${JSON.stringify(rect)}`
        );
        continue;
      }

      const outputPath = path.join(OUTPUT_DIR, `${outputName}.png`);

      await sharp(ATLAS_PATH)
        .extract(rect)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          kernel: sharp.kernel.nearest,
          fit: 'cover',
        })
        .png()
        .toFile(outputPath);

      const size = statSync(outputPath).size;
      console.log(
        `  [OK] ${gltfName} → ${outputName}.png (crop: ${rect.width}x${rect.height}, file: ${size}B)`
      );
      successCount++;
    } catch (err) {
      console.error(`  [ERROR] ${gltfName}: ${err.message}`);
    }
  }

  // ── 하드코딩 블록 처리 ──
  console.log('\n=== Hardcoded Blocks ===');
  for (const [name, { output: outputName, rect }] of Object.entries(HARDCODED_BLOCKS)) {
    try {
      const outputPath = path.join(OUTPUT_DIR, `${outputName}.png`);

      await sharp(ATLAS_PATH)
        .extract(rect)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          kernel: sharp.kernel.nearest,
          fit: 'cover',
        })
        .png()
        .toFile(outputPath);

      const size = statSync(outputPath).size;
      console.log(
        `  [OK] ${name} → ${outputName}.png (crop: ${rect.width}x${rect.height} @${rect.left},${rect.top}, file: ${size}B)`
      );
      successCount++;
    } catch (err) {
      console.error(`  [ERROR] ${name}: ${err.message}`);
    }
  }

  // ── 전환 블록 처리 ──
  console.log('\n=== Transition Blocks ===');
  for (const { gltf: gltfName, output: outputName, cluster: clusterIdx } of TRANSITION_BLOCKS) {
    try {
      const uvs = readUVBounds(gltfName);
      const clusters = clusterUVs(uvs);

      if (clusterIdx >= clusters.length) {
        console.warn(
          `  [SKIP] ${gltfName} — cluster ${clusterIdx} not found (only ${clusters.length} clusters)`
        );
        continue;
      }

      const clusterUvs = clusters[clusterIdx];
      const rect = uvBoundsToPixelRect(clusterUvs);

      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.left + rect.width > ATLAS_SIZE ||
        rect.top + rect.height > ATLAS_SIZE
      ) {
        console.warn(
          `  [SKIP] ${gltfName} — invalid crop: ${JSON.stringify(rect)}`
        );
        continue;
      }

      const outputPath = path.join(OUTPUT_DIR, `${outputName}.png`);

      await sharp(ATLAS_PATH)
        .extract(rect)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          kernel: sharp.kernel.nearest,
          fit: 'cover',
        })
        .png()
        .toFile(outputPath);

      const size = statSync(outputPath).size;
      console.log(
        `  [OK] ${gltfName}[c${clusterIdx}] → ${outputName}.png (crop: ${rect.width}x${rect.height}, file: ${size}B)`
      );
      successCount++;
    } catch (err) {
      console.error(`  [ERROR] ${gltfName}: ${err.message}`);
    }
  }

  console.log('');
  console.log(
    `[build-kaykit] Done: ${successCount}/${totalCount} textures generated`
  );

  // ── 결과 검증 ──
  if (successCount > 0) {
    console.log('\n=== Output Verification ===');
    const files = [
      ...Object.values(SIMPLE_BLOCKS),
      ...Object.values(HARDCODED_BLOCKS).map((h) => h.output),
      ...TRANSITION_BLOCKS.map((t) => t.output),
    ];
    for (const name of files) {
      const filePath = path.join(OUTPUT_DIR, `${name}.png`);
      if (existsSync(filePath)) {
        const stat = statSync(filePath);
        const ok = stat.size > 100 ? 'OK' : 'WARN: too small';
        console.log(`  ${name}.png: ${stat.size}B [${ok}]`);
      } else {
        console.log(`  ${name}.png: MISSING`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
