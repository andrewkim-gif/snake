/**
 * biome-decoder — v16 Phase 5
 * base64 → gunzip → Uint8Array 디코딩 유틸리티
 * 바이옴 그리드 + 장애물 그리드 공용
 */

import pako from 'pako';

export interface BiomeGridData {
  /** Uint8Array of biome indices (0-5) */
  grid: Uint8Array;
  /** Grid width in cells (same as heightmap) */
  width: number;
  /** Grid height in cells */
  height: number;
}

export interface ObstacleGridData {
  /** Uint8Array of obstacle types (0=empty, 1=rock, 2=tree, 3=wall, 4=water, 5=shrine, 6=spring, 7=altar) */
  grid: Uint8Array;
  /** Grid width in cells */
  width: number;
  /** Grid height in cells */
  height: number;
}

/**
 * base64 gzip uint8 grid → Uint8Array 디코딩
 */
function decodeUint8Grid(
  base64Data: string,
  expectedSize: number,
): Uint8Array | null {
  try {
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes);

    if (decompressed.byteLength !== expectedSize) {
      console.warn(
        `[BiomeDecoder] Size mismatch: expected ${expectedSize}, got ${decompressed.byteLength}`,
      );
      return null;
    }

    return new Uint8Array(decompressed.buffer, decompressed.byteOffset, expectedSize);
  } catch (err) {
    console.error('[BiomeDecoder] Failed to decode grid:', err);
    return null;
  }
}

/**
 * 서버에서 받은 biomeData를 BiomeGridData로 디코딩
 */
export function decodeBiomeGrid(
  base64Data: string,
  width: number,
  height: number,
): BiomeGridData | null {
  const grid = decodeUint8Grid(base64Data, width * height);
  if (!grid) return null;
  return { grid, width, height };
}

/**
 * 서버에서 받은 obstacleData를 ObstacleGridData로 디코딩
 */
export function decodeObstacleGrid(
  base64Data: string,
  width: number,
  height: number,
): ObstacleGridData | null {
  const grid = decodeUint8Grid(base64Data, width * height);
  if (!grid) return null;
  return { grid, width, height };
}
