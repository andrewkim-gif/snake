#!/usr/bin/env node
/**
 * gen-citizen-spritesheets.mjs
 *
 * PixiJS 8 Spritesheet JSON 생성기
 * 1920×1024 스프라이트 시트 → 128×128 프레임 (15열 × 8행)
 * 8행 = 8방향 (S, SW, W, NW, N, NE, E, SE)
 * 15열 = 애니메이션 프레임
 *
 * 출력: apps/web/public/game/Characters/spritesheets/{CharType}_{Anim}.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// 스프라이트 시트 규격
const SHEET_W = 1920;
const SHEET_H = 1024;
const FRAME_W = 128;
const FRAME_H = 128;
const COLS = 15;
const ROWS = 8;

// 방향 이름 (행 0~7)
const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];

// 시민이 사용하는 애니메이션
const CITIZEN_ANIMATIONS = ['Walk', 'Run', 'Idle', 'Taunt'];

// 시민 캐릭터 타입
const CITIZEN_CHAR_TYPES = ['Player', 'NPC1', 'NPC2', 'NPC3'];

const outDir = join(
  import.meta.dirname,
  '..',
  'apps/web/public/game/Characters/spritesheets',
);
mkdirSync(outDir, { recursive: true });

for (const charType of CITIZEN_CHAR_TYPES) {
  for (const anim of CITIZEN_ANIMATIONS) {
    // 원본 이미지 경로 (JSON과 상대 경로)
    const imagePath = `../${charType}/${anim}.png`;

    const frames = {};
    const animations = {};

    for (let row = 0; row < ROWS; row++) {
      const dir = DIRECTIONS[row];
      const animKey = `${dir}`;
      const frameKeys = [];

      for (let col = 0; col < COLS; col++) {
        const frameKey = `${dir}_${String(col).padStart(2, '0')}`;
        frames[frameKey] = {
          frame: { x: col * FRAME_W, y: row * FRAME_H, w: FRAME_W, h: FRAME_H },
          sourceSize: { w: FRAME_W, h: FRAME_H },
          spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        };
        frameKeys.push(frameKey);
      }

      animations[animKey] = frameKeys;
    }

    const json = {
      frames,
      meta: {
        image: imagePath,
        format: 'RGBA8888',
        size: { w: SHEET_W, h: SHEET_H },
        scale: 1,
      },
      animations,
    };

    const filename = `${charType}_${anim}.json`;
    writeFileSync(join(outDir, filename), JSON.stringify(json, null, 2));
    console.log(`Generated: ${filename}`);
  }
}

console.log(`\nDone! Generated ${CITIZEN_CHAR_TYPES.length * CITIZEN_ANIMATIONS.length} spritesheet JSONs.`);
