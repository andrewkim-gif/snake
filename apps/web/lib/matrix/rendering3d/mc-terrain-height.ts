/**
 * MC 지형 높이 쿼리 유틸 — EnemyRenderer, SwingArc 등에서 사용
 *
 * MCNoise 기반 getHeight()를 캐시된 인스턴스로 제공.
 * MCVoxelTerrain과 동일한 seed/noise 사용.
 *
 * 최적화: 프레임 단위 높이 캐시 (정수 좌표 기반)
 * - getHeight(ix, iz)는 동일 정수 좌표에 대해 항상 같은 결과
 * - 프레임마다 여러 컴포넌트가 같은/인접 좌표를 쿼리 → 캐시 히트
 * - invalidateHeightCache()를 매 프레임 호출하여 캐시 교체
 */

import { MCNoise } from '@/lib/3d/mc-noise';

// 시드별 MCNoise 인스턴스 캐시
const _noiseCache = new Map<number, MCNoise>();

// 현재 활성 시드 (기본값 42)
let _activeSeed = 42;

// 프레임 단위 높이 캐시 (정수 좌표 → 높이)
// key = ix * 65536 + iz (정수 좌표를 단일 숫자로 인코딩)
let _heightCache = new Map<number, number>();
let _heightCachePrev = new Map<number, number>();

/** 프레임 캐시 초기화 — 매 프레임 시작 시 호출 (GameLogic에서) */
export function invalidateHeightCache(): void {
  // 이전 프레임 캐시 재사용 (double-buffering으로 GC 방지)
  const tmp = _heightCachePrev;
  _heightCachePrev = _heightCache;
  _heightCache = tmp;
  _heightCache.clear();
}

/** 캐시된 정수 좌표 높이 조회 */
function getCachedHeight(noise: MCNoise, ix: number, iz: number): number {
  const key = ix * 65536 + iz;
  let h = _heightCache.get(key);
  if (h !== undefined) return h;
  // 이전 프레임 캐시도 확인 (카메라 이동이 느릴 때 히트율 높음)
  h = _heightCachePrev.get(key);
  if (h !== undefined) {
    _heightCache.set(key, h);
    return h;
  }
  h = noise.getHeight(ix, iz);
  _heightCache.set(key, h);
  return h;
}

/** 활성 MC 시드 설정 (MatrixScene에서 호출) */
export function setMCTerrainSeed(seed: number): void {
  _activeSeed = seed;
  if (!_noiseCache.has(seed)) {
    _noiseCache.set(seed, new MCNoise(seed));
  }
}

function getNoise(): MCNoise {
  let noise = _noiseCache.get(_activeSeed);
  if (!noise) {
    noise = new MCNoise(_activeSeed);
    _noiseCache.set(_activeSeed, noise);
  }
  return noise;
}

/**
 * MC noise 기반 지형 높이 반환 (쌍선형 보간 + 프레임 캐시)
 * 블록 경계에서 이산 점프 없이 부드러운 높이 전환.
 * 블록 위에 엔티티를 올려놓을 때: getMCTerrainHeight(x, z) + 1
 */
export function getMCTerrainHeight(worldX: number, worldZ: number): number {
  const noise = getNoise();

  // 쌍선형 보간: 인접 4개 블록 높이를 부드럽게 블렌딩
  const ix = Math.floor(worldX);
  const iz = Math.floor(worldZ);
  const fx = worldX - ix;
  const fz = worldZ - iz;

  const h00 = getCachedHeight(noise, ix, iz);
  const h10 = getCachedHeight(noise, ix + 1, iz);
  const h01 = getCachedHeight(noise, ix, iz + 1);
  const h11 = getCachedHeight(noise, ix + 1, iz + 1);

  // smoothstep으로 더 자연스러운 전환
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);

  const top = h00 + (h10 - h00) * sx;
  const bottom = h01 + (h11 - h01) * sx;
  return top + (bottom - top) * sz;
}

/** 이산(블록 단위) 지형 높이 — 블록 배치/충돌 전용 */
export function getMCTerrainHeightDiscrete(worldX: number, worldZ: number): number {
  const noise = getNoise();
  return getCachedHeight(noise, Math.floor(worldX), Math.floor(worldZ));
}
