/**
 * gen-logo.ts — Gemini API 로고 생성 스크립트
 * "Last of Us" 스타일 AI WORLD WAR 로고
 */

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, '../public/assets/generated');

async function generateLogo(promptText: string, filename: string): Promise<void> {
  console.log(`\n[GEN] ${filename}`);
  console.log(`[PROMPT] ${promptText.slice(0, 120)}...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${API_KEY}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[ERROR] ${res.status}: ${err}`);
    return;
  }

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData) {
      const buf = Buffer.from(part.inlineData.data, 'base64');
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`[SAVED] ${outPath} (${(buf.length / 1024).toFixed(1)}KB)`);
    }
    if (part.text) {
      console.log(`[TEXT] ${part.text.slice(0, 200)}`);
    }
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 로고 생성 — 3가지 변형
  const basePrompt = `Create a wide horizontal game logo on a completely transparent background (PNG with alpha channel).

The logo has two parts side by side, perfectly height-aligned:

LEFT: A bold stylized letter "A" symbol — geometric, flat, modern military style. The "A" has angular edges, possibly with a small triangular notch or crossbar detail. It should look like an emblem or insignia mark. Monochrome warm off-white color (#E8E0D4).

RIGHT: The text "AI WORLD WAR" in a weathered, distressed serif military typeface. Inspired by The Last of Us logo typography — slightly worn, with subtle texture/erosion on the letter edges, but still very legible and clean. Same warm off-white color (#E8E0D4).

The overall style is:
- Flat design (no 3D, no gradients, no shadows)
- Distressed/weathered texture on the letterforms only
- Military/tactical aesthetic
- The A symbol and text are the SAME height
- Wide aspect ratio (approximately 5:1)
- Transparent background — NO background fill, NO background shape
- Sophisticated and minimal — not cluttered

Think of a premium war game title screen logo. Clean but with character.`;

  const prompts = [
    {
      prompt: basePrompt + '\n\nVariation: The A symbol has a clean triangular shape with a horizontal crossbar, slightly wider than the text height. Very geometric and precise.',
      file: 'logo-v1.png',
    },
    {
      prompt: basePrompt + '\n\nVariation: The A symbol incorporates subtle crack/erosion details like ivy or roots growing on stone. More organic feel, matching The Last of Us aesthetic.',
      file: 'logo-v2.png',
    },
    {
      prompt: basePrompt + '\n\nVariation: The A symbol is enclosed in a thin angular border (like a military unit patch outline). Very flat and tactical. The overall feel is austere and commanding.',
      file: 'logo-v3.png',
    },
  ];

  for (const { prompt, file } of prompts) {
    await generateLogo(prompt, file);
    // rate limit spacing
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n[DONE] Logo generation complete. Check /public/assets/generated/');
}

main().catch(console.error);
