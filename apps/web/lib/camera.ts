/**
 * Camera — 카메라 추적 + 동적 줌 로직
 * dt 기반 프레임 독립 lerp로 부드러운 추적
 */

import { lerp } from '@snake-arena/shared';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 };
}

/** 카메라를 대상 위치로 부드럽게 추적 + mass 기반 동적 줌 */
export function updateCamera(
  camera: Camera,
  targetX: number,
  targetY: number,
  mass: number,
  dt = 0.016,
): void {
  // dt 기반 프레임 독립 lerp (60fps에서 ~0.15 → 어느 fps에서도 동일한 느낌)
  const posSmooth = 1 - Math.pow(1 - 0.15, dt * 60);
  camera.x = lerp(camera.x, targetX, posSmooth);
  camera.y = lerp(camera.y, targetY, posSmooth);

  // 동적 줌 — mass가 클수록 줌아웃하여 긴 몸체 전체가 보이게
  const targetZoom = Math.max(0.35, Math.min(1.0, 1.0 - Math.pow(mass, 0.4) * 0.03));
  const zoomSmooth = 1 - Math.pow(1 - 0.08, dt * 60);
  camera.zoom = lerp(camera.zoom, targetZoom, zoomSmooth);
}
