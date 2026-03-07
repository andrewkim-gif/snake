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

  // 로고 생성 — Last of Us 스타일, 순백색, A 심볼 높이 = 텍스트 높이
  const tlou = `The Last of Us game logo style. The typography has a slightly rough, organic, hand-crafted quality — as if the letters were carved or etched into stone, with subtle cracks and nature reclaiming the edges. Tiny hints of moss, lichen, or vine tendrils growing in the crevices of some letters. But still very legible and elegant — not overly grunge. Think of the original The Last of Us Part I game cover title.`;

  const prompts = [
    {
      prompt: `Generate a wide horizontal game title logo on a solid black background (#000000).

The text reads: A  AI WORLD WAR

All letters are PURE WHITE (#FFFFFF) on solid black.

${tlou}

CRITICAL SIZE RULE: The "A" on the far left is the same cap-height as every other letter. It is NOT a big emblem or icon — it is a letter "A" rendered in a slightly more decorative style, like a drop cap or initial letter. Same height as "W" in WORLD. Same height as "I" in AI. All letters on the same baseline.

The "A" mark on the left has these subtle differences from the other letters:
- Slightly thicker strokes
- A small nature element (tiny vine or crack detail) integrated into its form
- But still clearly a letter A, not a symbol or icon

The remaining text "AI WORLD WAR" uses elegant weathered serif capitals — like The Last of Us.

Style:
- All white (#FFFFFF), no color, no tints
- Organic/nature-reclaimed texture on the letterforms
- Wide aspect ratio (6:1 or wider)
- Elegant and sophisticated — premium AAA game title quality
- No 3D, no drop shadows — the beauty comes from the texture and typography alone`,
      file: 'logo-v1.png',
    },
    {
      prompt: `Create a wide game title logo on solid black (#000000) background.

Text: A  AI WORLD WAR

Style: The Last of Us Part I title aesthetic. Every letter is pure white (#FFFFFF). The typography looks slightly weathered, like carved stone with nature slowly growing over it — subtle cracks in the letterforms, tiny moss or organic textures in the serifs.

THE A ON THE LEFT: It is a capital letter A, exactly the same height as every other capital letter. NOT an oversized symbol. Think of it as a stylized initial — same baseline, same cap height as "AI WORLD WAR" next to it. The A might have a slightly different serif treatment or a small artistic flourish, but it's the same scale. Like how "The Last of Us" has uniform letter heights with just texture variation.

Layout: Single horizontal line, all letters same height, wide format (at minimum 5:1 width-to-height).

No 3D. No gradients. No glow effects. Just beautiful white weathered typography on black.`,
      file: 'logo-v2.png',
    },
    {
      prompt: `Design a minimalist game title logo on pure black (#000000) background.

Text reads:  A · AI WORLD WAR

(The "A" is followed by a small centered dot "·" separator, then "AI WORLD WAR")

Every character is pure white (#FFFFFF). The font is an elegant, slightly distressed serif — inspired by The Last of Us game title. Letters have organic weathering: thin hairline cracks, tiny bits of erosion at the edges. The beauty is in restraint.

ABSOLUTE RULE: The "A" before the dot is the EXACT SAME HEIGHT as every other capital letter. It is simply a letter A with slightly bolder weight or a subtle stylistic flourish. It does not dominate. It does not tower. It is one letter among many, just slightly distinguished.

Wide panoramic format. Clean. White on black. No effects, no 3D, no glow.
Imagine this as a AAA PlayStation exclusive game title card.`,
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
