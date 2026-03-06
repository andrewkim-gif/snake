#!/usr/bin/env node
/**
 * Agent Survivor 로고 이미지 생성 스크립트
 * Gemini 3.1 Flash → 손그림 스케치 스타일 로고 → sharp 배경 제거 → PNG
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'apps/web/public/images');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set');
  process.exit(1);
}

const MODEL = 'gemini-3.1-flash-image-preview';

async function generateLogo() {
  console.log('🎨 Generating sketch-style logo with Gemini...');

  const prompt = `Create a hand-drawn sketch style game logo for "AI WORLD WAR".

CRITICAL REQUIREMENTS:
- Hand-drawn, sketch style lettering — as if drawn with a thick marker or pen on paper
- The text "AI" on top, small and bold, in warm orange (#FF8C42) hand-drawn letters
- The words "WORLD WAR" below, larger, in dark charcoal (#2D2926) hand-drawn bold letters
- Small hand-drawn doodle elements around the text: explosions, lightning bolts, stars, battle icons
- Include small hand-drawn robot/AI icons or crossed swords near the title
- SOLID WHITE background (#FFFFFF) — I will remove it programmatically
- Imperfect, organic letterforms — NOT pixel art, NOT digital-looking
- Letters should look like they were drawn by hand with slight irregularities
- Wide banner format, approximately 3:1 aspect ratio
- Warm, friendly, approachable feeling despite the war theme — like a fun notebook doodle
- Style references: indie game logos, notebook sketches, hand-lettering art
- The overall look should feel warm, playful, and hand-crafted
- NO 3D effects, NO metallic textures, NO digital perfection`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 1.0,
      },
    }),
  });

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts) {
    console.error('No response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const parts = data.candidates[0].content.parts;
  let rawPath = null;

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      rawPath = path.join(OUT_DIR, 'logo-raw.png');
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(rawPath, buffer);
      console.log(`✅ Raw logo saved: ${rawPath} (${buffer.length} bytes)`);
    }
    if (part.text) {
      console.log('📝 Gemini:', part.text.slice(0, 200));
    }
  }

  if (!rawPath) {
    console.error('❌ No image generated');
    process.exit(1);
  }

  return rawPath;
}

async function removeBackground(inputPath) {
  console.log('🔧 Removing white background with sharp...');

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp not found, copying raw file as-is');
    fs.copyFileSync(inputPath, path.join(OUT_DIR, 'logo.png'));
    return;
  }

  const { data, info } = await sharp(inputPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  // 흰색/밝은 회색 배경 제거 (스케치 로고용)
  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const lightness = (max + min) / 2;

    // 거의 흰색/밝은 무채색 배경 제거
    if (chroma < 30 && lightness > 210) {
      data[i + 3] = 0;
      removed++;
    }
    // 약간 탁한 흰색 (종이 느낌)
    else if (chroma < 20 && lightness > 190) {
      data[i + 3] = 0;
      removed++;
    }
    // 매우 밝은 배경 가장자리
    else if (chroma < 15 && lightness > 230) {
      data[i + 3] = 0;
      removed++;
    }
  }

  const outputPath = path.join(OUT_DIR, 'logo.png');
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png()
    .toFile(outputPath);

  const total = info.width * info.height;
  console.log(`✅ Background removed: ${removed}/${total} pixels (${Math.round(removed/total*100)}%)`);
  console.log(`✅ Final logo: ${outputPath}`);
}

async function main() {
  const rawPath = await generateLogo();
  await removeBackground(rawPath);
  console.log('🎮 Sketch logo generation complete!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
