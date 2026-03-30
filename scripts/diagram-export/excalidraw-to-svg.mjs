import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { exportToSvg } from '@excalidraw/utils';

const EXPORT_DIR = '/Users/andrew.kim/Desktop/AWW/scripts/diagram-export';

const jsonFiles = readdirSync(EXPORT_DIR).filter(f => f.endsWith('.excalidraw.json'));

for (const file of jsonFiles) {
  const stem = file.replace('.excalidraw.json', '');
  try {
    const data = JSON.parse(readFileSync(join(EXPORT_DIR, file), 'utf-8'));

    const svg = await exportToSvg({
      elements: data.elements || [],
      appState: {
        ...(data.appState || {}),
        exportWithDarkMode: false,
        exportBackground: true,
        viewBackgroundColor: '#ffffff',
      },
      files: data.files || {},
    });

    const svgString = svg.outerHTML || svg.toString();
    const outPath = join(EXPORT_DIR, `${stem}.svg`);
    writeFileSync(outPath, svgString);
    console.log(`✓ ${stem}.svg (${svgString.length} chars)`);
  } catch (e) {
    console.log(`✗ ${stem}: ${e.message}`);
  }
}
