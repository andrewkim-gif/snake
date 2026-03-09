/**
 * regen-iso-assets.mjs — v26 ISO 에셋 고품질 재생성
 *
 * 1. Gemini gemini-3.1-flash-image-preview로 512x512 생성
 * 2. sharp로 배경 제거 + 올바른 크기 다운스케일 (Lanczos)
 * 3. 타일은 다이아몬드 마스크 적용 (간격 방지)
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const BASE = 'apps/web/public/textures/iso';

// 에셋 정의: { path, prompt, targetW, targetH, type }
const ASSETS = [];

// ─── 타일 (64x32, 다이아몬드 마스크 필요) ───
const TILE_STYLE = 'isometric diamond tile, pixel art style, top-down isometric view, vibrant colors, game asset, NO text, NO letters, NO watermark';
const tiles = [
  { name: 'grass', desc: 'lush green grass terrain with small flowers and grass blades' },
  { name: 'water', desc: 'blue ocean water with small white wave crests and light reflections' },
  { name: 'mountain', desc: 'rocky gray mountain terrain with snow-capped peaks and brown rocks' },
  { name: 'forest', desc: 'dense green forest with multiple tree canopies and dark undergrowth' },
  { name: 'desert', desc: 'golden sand desert terrain with sand dunes and small cacti' },
  { name: 'beach', desc: 'sandy beach shoreline where sand meets water with shells' },
];
for (const t of tiles) {
  ASSETS.push({
    path: `tiles/${t.name}.png`,
    prompt: `Create a ${t.desc}, ${TILE_STYLE}. The tile should be a rhombus/diamond shape viewed from above at 30-degree isometric angle. Fill the ENTIRE image with the terrain pattern.`,
    targetW: 64, targetH: 32, type: 'tile',
  });
}

// ─── 건물 (64x64, 투명 배경) ───
const BUILD_STYLE = 'isometric building, pixel art style, cute miniature, vibrant colors, game asset, white/light background, NO text, NO letters';
const buildings = [
  { name: 'house', desc: 'small cozy residential house with red roof and chimney' },
  { name: 'farm', desc: 'wooden farm barn with hay bales and a small garden' },
  { name: 'barracks', desc: 'military barracks building with camouflage pattern and flag' },
  { name: 'market', desc: 'colorful market building with open stalls and awnings' },
  { name: 'factory', desc: 'industrial factory with smokestacks and conveyor belts' },
  { name: 'power_plant', desc: 'power plant with cooling towers emitting steam' },
  { name: 'hospital', desc: 'white hospital building with red cross symbol' },
  { name: 'school', desc: 'school building with clock tower and playground' },
  { name: 'church', desc: 'stone church with tall steeple and stained glass windows' },
  { name: 'government', desc: 'grand government capitol building with columns and dome' },
];
for (const b of buildings) {
  ASSETS.push({
    path: `buildings/${b.name}.png`,
    prompt: `Create a ${b.desc}, ${BUILD_STYLE}. Isometric 3/4 view showing top and two sides. Single building centered in frame.`,
    targetW: 64, targetH: 64, type: 'building',
  });
}

// ─── 시민 (16x16, 투명 배경) ───
const CIT_STYLE = 'tiny pixel art character sprite, 16x16 pixels, transparent background, retro game style, bright colors, NO text';
const citizens = [
  { name: 'working', desc: 'worker character wearing hard hat holding a tool, blue overalls' },
  { name: 'commuting', desc: 'person walking briskly carrying a briefcase, wearing suit' },
  { name: 'shopping', desc: 'person carrying shopping bags, colorful casual clothes' },
  { name: 'resting', desc: 'person sitting relaxed on a bench, casual clothes' },
  { name: 'protesting', desc: 'person holding a protest sign above their head, red shirt' },
  { name: 'idle', desc: 'person standing casually with hands in pockets, green shirt' },
];
for (const c of citizens) {
  ASSETS.push({
    path: `citizens/${c.name}.png`,
    prompt: `Create a ${c.desc}, ${CIT_STYLE}. Single character, front-facing, simple pixelated design.`,
    targetW: 16, targetH: 16, type: 'citizen',
  });
}

// ─── 아이콘 (32x32, 투명 배경) ───
const ICON_STYLE = 'pixel art icon, 32x32 pixels, transparent background, bright saturated colors, game UI icon, NO text, NO letters';
const icons = [
  { name: 'gold', desc: 'stack of gold coins with sparkle' },
  { name: 'food', desc: 'red apple with green leaf' },
  { name: 'iron', desc: 'iron ore chunk, metallic gray' },
  { name: 'oil', desc: 'black oil barrel with yellow hazard stripe' },
  { name: 'power', desc: 'yellow lightning bolt symbol' },
  { name: 'wood', desc: 'brown wooden log stack' },
  { name: 'stone', desc: 'gray stone blocks pile' },
  { name: 'population', desc: 'group of tiny people silhouettes' },
  { name: 'happiness', desc: 'yellow smiley face emoji' },
  { name: 'military', desc: 'green military shield with star' },
  { name: 'energy', desc: 'glowing green energy crystal' },
  { name: 'faith', desc: 'white dove with olive branch' },
  { name: 'production', desc: 'rotating gear/cog mechanism' },
  { name: 'research', desc: 'blue science flask with bubbles' },
  { name: 'trade', desc: 'handshake icon, two hands meeting' },
  // category icons
  { name: 'cat_residential', desc: 'small house icon for residential category' },
  { name: 'cat_production', desc: 'factory gear icon for production category' },
  { name: 'cat_commerce', desc: 'shopping cart icon for commerce category' },
  { name: 'cat_military', desc: 'sword and shield for military category' },
  { name: 'cat_infrastructure', desc: 'road/bridge icon for infrastructure' },
  { name: 'cat_civic', desc: 'government building icon for civic category' },
  { name: 'cat_special', desc: 'golden star icon for special category' },
];
for (const i of icons) {
  ASSETS.push({
    path: `icons/${i.name}.png`,
    prompt: `Create a ${i.desc}, ${ICON_STYLE}. Centered in frame, clean simple design.`,
    targetW: 32, targetH: 32, type: 'icon',
  });
}

// ─── Gemini API 호출 ───
async function generateImage(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error('No candidates in response');

  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('No image data in response');
}

// ─── 배경 제거 (BFS flood fill) ───
async function removeBackground(buf, tolerance = 50) {
  const img = sharp(buf);
  const meta = await img.metadata();
  const { width, height } = meta;
  const raw = await img.ensureAlpha().raw().toBuffer();
  const ch = 4;

  // 코너 샘플링으로 배경색 추정
  const getP = (x, y) => {
    const i = (y * width + x) * ch;
    return [raw[i], raw[i+1], raw[i+2]];
  };
  const samples = [
    getP(0,0), getP(width-1,0), getP(0,height-1), getP(width-1,height-1),
    getP(Math.floor(width/2),0), getP(Math.floor(width/2),height-1),
  ];
  const bgR = Math.round(samples.reduce((s,p)=>s+p[0],0)/samples.length);
  const bgG = Math.round(samples.reduce((s,p)=>s+p[1],0)/samples.length);
  const bgB = Math.round(samples.reduce((s,p)=>s+p[2],0)/samples.length);

  const result = Buffer.from(raw);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBg = (idx) => {
    const r = raw[idx*ch], g = raw[idx*ch+1], b = raw[idx*ch+2];
    return Math.sqrt((r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2) < tolerance;
  };

  // 가장자리 픽셀 시드
  for (let x = 0; x < width; x++) {
    for (const y of [0, height-1]) {
      const pos = y * width + x;
      if (isBg(pos)) { visited[pos]=1; queue.push(pos); }
    }
  }
  for (let y = 1; y < height-1; y++) {
    for (const x of [0, width-1]) {
      const pos = y * width + x;
      if (isBg(pos)) { visited[pos]=1; queue.push(pos); }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    result[pos * ch + 3] = 0;
    const x = pos % width, y = Math.floor(pos / width);
    for (const n of [pos-1, pos+1, pos-width, pos+width]) {
      if (n >= 0 && n < width*height && !visited[n]) {
        const nx = n % width;
        if (Math.abs(nx - x) <= 1 && isBg(n)) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  return sharp(result, { raw: { width, height, channels: ch } }).png().toBuffer();
}

// ─── 다이아몬드 마스크 생성 (타일용) ───
function createDiamondMask(w, h) {
  // SVG 다이아몬드 마스크 → sharp 알파 마스크
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}" fill="white"/>
  </svg>`;
  return Buffer.from(svg);
}

// ─── 에셋 처리 파이프라인 ───
async function processAsset(asset, idx, total) {
  const outPath = path.join(BASE, asset.path);
  const label = `[${idx+1}/${total}] ${asset.path}`;

  try {
    // 1. Gemini 생성
    console.log(`  🎨 ${label} — generating...`);
    const rawBuf = await generateImage(asset.prompt);
    const rawMeta = await sharp(rawBuf).metadata();
    console.log(`     raw: ${rawMeta.width}x${rawMeta.height}`);

    let processed;

    if (asset.type === 'tile') {
      // 타일: 전체 이미지를 타겟 크기로 리사이즈 → 다이아몬드 마스크
      const resized = await sharp(rawBuf)
        .resize(asset.targetW, asset.targetH, { fit: 'fill', kernel: 'lanczos3' })
        .ensureAlpha()
        .png()
        .toBuffer();

      // 다이아몬드 마스크 적용
      const mask = createDiamondMask(asset.targetW, asset.targetH);
      const maskBuf = await sharp(mask)
        .resize(asset.targetW, asset.targetH)
        .greyscale()
        .raw()
        .toBuffer();

      const resizedRaw = await sharp(resized).raw().toBuffer();
      const resultBuf = Buffer.from(resizedRaw);
      // 마스크의 흰색(255) 영역만 보이게
      for (let i = 0; i < maskBuf.length; i++) {
        const alpha = maskBuf[i]; // 0 or 255
        resultBuf[i * 4 + 3] = alpha > 128 ? resultBuf[i * 4 + 3] : 0;
      }
      processed = await sharp(resultBuf, {
        raw: { width: asset.targetW, height: asset.targetH, channels: 4 }
      }).png().toBuffer();

    } else {
      // 건물/시민/아이콘: 배경 제거 → 리사이즈
      const noBg = await removeBackground(rawBuf);
      processed = await sharp(noBg)
        .resize(asset.targetW, asset.targetH, {
          fit: 'contain',
          kernel: 'lanczos3',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }

    // 저장
    fs.writeFileSync(outPath, processed);
    const finalSize = (processed.length / 1024).toFixed(1);
    console.log(`  ✅ ${label} — ${asset.targetW}x${asset.targetH}, ${finalSize}KB`);
    return true;
  } catch (err) {
    console.error(`  ❌ ${label} — ${err.message}`);
    return false;
  }
}

// ─── 메인 ───
async function main() {
  console.log(`\n🎮 v26 ISO Asset Regeneration (${ASSETS.length} assets)\n`);

  // 카테고리별 필터 (CLI arg)
  const filter = process.argv[2]; // tiles, buildings, citizens, icons, or all
  let targets = ASSETS;
  if (filter && filter !== 'all') {
    targets = ASSETS.filter(a => a.path.startsWith(filter));
    console.log(`  Filter: ${filter} (${targets.length} assets)\n`);
  }

  let success = 0, fail = 0;
  for (let i = 0; i < targets.length; i++) {
    const ok = await processAsset(targets[i], i, targets.length);
    if (ok) success++; else fail++;

    // Rate limit: 2초 대기 (Gemini 무료 티어)
    if (i < targets.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n📊 Results: ${success} success, ${fail} failed out of ${targets.length}`);
}

main().catch(console.error);
