/**
 * Texture fallback utilities — 1x1 placeholder textures for missing PBR maps.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

import * as THREE from 'three';

/** 야간 텍스처 로드 실패 시 검정 1x1 fallback 생성 */
export function createBlackTexture(): THREE.DataTexture {
  const data = new Uint8Array([0, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/** 기본 노멀맵 (파란색 = 평면 노멀 [0.5, 0.5, 1.0]) */
export function createFlatNormalTexture(): THREE.DataTexture {
  const data = new Uint8Array([128, 128, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/** 기본 스페큘러맵 (검정 = 반사 없음) */
export function createBlackSpecularTexture(): THREE.DataTexture {
  const data = new Uint8Array([0, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
