/**
 * heightmap-decoder — v16 Phase 4
 * base64 → gunzip → Float32Array 디코딩 유틸리티
 */

import pako from 'pako';
import type { HeightmapTerrainData } from '@/components/3d/HeightmapTerrain';

/**
 * 서버에서 받은 base64 gzip 데이터를 HeightmapTerrainData로 디코딩
 */
export function decodeHeightmap(
  base64Data: string,
  width: number,
  height: number,
  cellSize: number,
): HeightmapTerrainData | null {
  try {
    // 1. base64 → binary
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 2. gunzip (pako.inflate)
    const decompressed = pako.inflate(bytes);

    // 3. Convert to Float32Array (little-endian, matching Go binary.LittleEndian)
    const float32Count = width * height;
    const expectedBytes = float32Count * 4;
    if (decompressed.byteLength !== expectedBytes) {
      console.warn(
        `[HeightmapDecoder] Size mismatch: expected ${expectedBytes} bytes, got ${decompressed.byteLength}`,
      );
      return null;
    }

    const heightData = new Float32Array(decompressed.buffer, decompressed.byteOffset, float32Count);

    return {
      heightData,
      width,
      height,
      cellSize,
    };
  } catch (err) {
    console.error('[HeightmapDecoder] Failed to decode heightmap:', err);
    return null;
  }
}
