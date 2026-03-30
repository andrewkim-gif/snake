import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import LZString from 'lz-string';

const DIAGRAMS_DIR = '/Users/andrew.kim/Documents/Obsidian Vault/DAVINCI/AI World War/diagrams';
const EXPORT_DIR = '/Users/andrew.kim/Desktop/AWW/scripts/diagram-export';

const files = readdirSync(DIAGRAMS_DIR).filter(f => f.endsWith('.excalidraw.md'));

for (const file of files) {
  const content = readFileSync(join(DIAGRAMS_DIR, file), 'utf-8');
  const stem = file.replace('.excalidraw.md', '');

  const match = content.match(/```compressed-json\n([\s\S]*?)```/);
  if (!match) {
    console.log(`✗ ${stem}: no compressed-json block`);
    continue;
  }

  // 핵심: 줄바꿈 제거 후 LZ-String base64 디코딩
  const compressed = match[1].trim().replace(/\n/g, '');

  try {
    const decompressed = LZString.decompressFromBase64(compressed);
    if (!decompressed) throw new Error('decompression returned null');

    const json = JSON.parse(decompressed);
    const outPath = join(EXPORT_DIR, `${stem}.excalidraw.json`);
    writeFileSync(outPath, JSON.stringify(json));
    console.log(`✓ ${stem}: ${json.elements?.length || 0} elements`);
  } catch (e) {
    console.log(`✗ ${stem}: ${e.message}`);
  }
}
