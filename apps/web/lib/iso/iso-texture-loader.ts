/**
 * iso-texture-loader.ts (v27)
 *
 * Phase 1: PixiJS 8 Assets API 기반 텍스처 로더 완전 재작성
 * - 바이옴별 on-demand 로드 (preloadBiomeTextures)
 * - Ground/Wall/Roof/Tree/Flora 등 카테고리별 접근자
 * - 이전 바이옴 에셋 언로드 (캐시 관리)
 * - fallback 모드 (텍스처 로드 실패 시 기존 Graphics 유지)
 *
 * 기존 apps/web/lib/iso-texture-loader.ts (v26)은 유지하되,
 * Phase 2에서 import를 이 파일로 변경 예정.
 *
 * 참조: iso-asset-manifest.ts, iso-biome-defs.ts, iso-asset-catalog.ts
 *
 * @generated 2026-03-09 Phase 1
 */

import { Assets, Texture } from 'pixi.js';
import type { BiomeType } from '../../components/game/iso/types';
import {
  buildBiomeManifest,
  getBiomeBundleNames,
  logManifestSummary,
  envAlias,
  shadowAlias,
} from './iso-asset-manifest';
import {
  envAssetPath,
  shadowAssetPath,
  DEFAULT_DIRECTION,
  GROUND_SAFE_FULL_VARIANTS,
  type GroundSeries,
} from './iso-asset-catalog';

// ============================================================================
// 내부 상태
// ============================================================================

/** 현재 로드된 바이옴 */
let _currentBiome: BiomeType | null = null;

/** 로드 완료 여부 */
let _loaded = false;

/** fallback 모드 (로드 실패 시) */
let _fallbackMode = false;

/** 현재 로드 중인 Promise (중복 방지) */
let _loadingPromise: Promise<boolean> | null = null;

/** 매니페스트 초기화 완료 여부 */
let _manifestInitialized = false;

// ============================================================================
// 로더 초기화 & 바이옴별 로드
// ============================================================================

/**
 * 바이옴별 텍스처 프리로드
 *
 * 1. 이전 바이옴 에셋 언로드
 * 2. 새 바이옴 매니페스트 빌드
 * 3. PixiJS Assets API로 번들 로드
 *
 * @param biome 로드할 바이옴
 * @returns 로드 성공 여부 (false = fallback 모드)
 */
export async function preloadBiomeTextures(biome: BiomeType): Promise<boolean> {
  // 이미 같은 바이옴이 로드되어 있으면 스킵
  if (_loaded && _currentBiome === biome && !_fallbackMode) {
    return true;
  }

  // 중복 로드 방지
  if (_loadingPromise) {
    return _loadingPromise;
  }

  _loadingPromise = _doPreload(biome);
  const result = await _loadingPromise;
  _loadingPromise = null;
  return result;
}

/**
 * 실제 로드 수행
 */
async function _doPreload(biome: BiomeType): Promise<boolean> {
  console.log(`[IsoTextureLoader] Preloading biome: ${biome}`);
  const startTime = performance.now();

  try {
    // 1. 이전 바이옴 언로드
    if (_currentBiome && _currentBiome !== biome) {
      await unloadBiomeTextures(_currentBiome);
    }

    // 2. 매니페스트 빌드
    const manifest = buildBiomeManifest(biome);
    logManifestSummary(manifest);

    // 3. PixiJS Assets 초기화 (최초 1회)
    //    Assets.init은 이미 init된 경우 경고를 낼 수 있으므로
    //    addBundle 방식으로 동적 등록
    for (const bundle of manifest.bundles) {
      // 이미 등록된 번들은 무시 (common 등 재사용)
      try {
        Assets.addBundle(bundle.name, bundle.assets);
      } catch {
        // 이미 등록된 번들 — 무시
      }
    }

    // 4. 번들 로드 — 각 번들 독립적으로 로드 (하나의 실패가 전체를 죽이지 않음)
    const bundleNames = getBiomeBundleNames(biome);
    let loadedCount = 0;
    let terrainLoaded = false;

    for (const name of bundleNames) {
      try {
        await Assets.loadBundle(name);
        loadedCount++;
        // terrain 번들 성공 여부 추적 (가장 중요 — 바닥 타일)
        if (name.startsWith('terrain_')) {
          terrainLoaded = true;
        }
      } catch (bundleErr) {
        console.warn(`[IsoTextureLoader] Bundle '${name}' failed to load:`, bundleErr);
        // 번들 실패해도 계속 진행 — 나머지 번들은 독립적으로 로드
      }
    }

    _currentBiome = biome;
    _loaded = true;
    // terrain 번들이 로드되면 fallback 모드 비활성화 (나머지는 부분 실패 허용)
    _fallbackMode = !terrainLoaded;

    const elapsed = (performance.now() - startTime).toFixed(0);
    if (terrainLoaded) {
      console.log(`[IsoTextureLoader] Biome ${biome} loaded in ${elapsed}ms (${loadedCount}/${bundleNames.length} bundles)`);
    } else {
      console.warn(`[IsoTextureLoader] Biome ${biome} terrain failed, fallback mode (${loadedCount}/${bundleNames.length} bundles)`);
    }
    return terrainLoaded;
  } catch (err) {
    console.warn('[IsoTextureLoader] Preload failed, using fallback mode:', err);
    _loaded = true;
    _fallbackMode = true;
    _currentBiome = biome;
    return false;
  }
}

/**
 * 바이옴 에셋 언로드 — 메모리 해제
 */
export async function unloadBiomeTextures(biome: BiomeType): Promise<void> {
  console.log(`[IsoTextureLoader] Unloading biome: ${biome}`);

  const bundleNames = getBiomeBundleNames(biome);
  for (const name of bundleNames) {
    // common 번들은 언로드하지 않음 (모든 바이옴에서 사용)
    if (name === 'common') continue;
    try {
      await Assets.unloadBundle(name);
    } catch {
      // 이미 언로드되었거나 로드되지 않은 번들 — 무시
    }
  }
}

// ============================================================================
// 텍스처 접근자
// ============================================================================

/**
 * Ground 텍스처 반환
 *
 * @param series Ground 시리즈 문자 (A~J)
 * @param variant 변형 번호
 * @returns Texture 또는 null (fallback 모드)
 */
export function getGroundTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('ground', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * 안전한 Ground full diamond 텍스처 반환
 * 시드 기반으로 해당 시리즈의 full 변형 중 하나를 선택
 *
 * @param series Ground 시리즈 문자
 * @param seed 랜덤 시드 (타일 좌표 해시)
 */
export function getSafeGroundTexture(series: string, seed: number): Texture | null {
  if (_fallbackMode) return null;
  const variants = GROUND_SAFE_FULL_VARIANTS[series as GroundSeries];
  if (!variants || variants.length === 0) return null;
  const idx = Math.abs(seed) % variants.length;
  return getGroundTexture(series, variants[idx]);
}

/**
 * Wall 텍스처 반환
 */
export function getWallTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('wall', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Roof 텍스처 반환
 */
export function getRoofTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('roof', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Tree 텍스처 반환
 */
export function getTreeTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('tree', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Flora 텍스처 반환
 */
export function getFloraTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('flora', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Stone 포장 텍스처 반환
 */
export function getStoneTexture(variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('stone', 'A', variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Shadow 텍스처 반환
 */
export function getShadowTexture(variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = shadowAlias(variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Door 텍스처 반환
 */
export function getDoorTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('door', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * WallFlora 텍스처 반환
 */
export function getWallFloraTexture(variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('wallflora', 'A', variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Misc 소품 텍스처 반환
 */
export function getMiscTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('misc', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Chest 텍스처 반환
 */
export function getChestTexture(series: string, variant: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = envAlias('chest', series, variant);
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * 구름 텍스처 반환 (1~3)
 */
export function getCloudTexture(index: number): Texture | null {
  if (_fallbackMode) return null;
  const alias = `cloud_${index}`;
  return Assets.get<Texture>(alias) ?? null;
}

/**
 * Water Ripple 프레임 텍스처 배열 반환 (AnimatedSprite용)
 * @param rippleIndex 리플 시리즈 (1~13)
 * @returns 16개 Texture 배열 또는 null
 */
export function getWaterRippleFrames(rippleIndex: number): Texture[] | null {
  if (_fallbackMode) return null;
  const frames: Texture[] = [];
  for (let i = 0; i < 16; i++) {
    const alias = `water_ripple_${rippleIndex}_${i}`;
    const tex = Assets.get<Texture>(alias);
    if (!tex) return null; // 하나라도 없으면 실패
    frames.push(tex);
  }
  return frames;
}

/**
 * WindMill 프레임 텍스처 배열 반환 (AnimatedSprite용)
 * @param millIndex 풍차 시리즈 (1~2)
 * @returns 17개 Texture 배열 또는 null
 */
export function getWindmillFrames(millIndex: number): Texture[] | null {
  if (_fallbackMode) return null;
  const frames: Texture[] = [];
  for (let i = 0; i < 17; i++) {
    const alias = `windmill_${millIndex}_${i}`;
    const tex = Assets.get<Texture>(alias);
    if (!tex) return null;
    frames.push(tex);
  }
  return frames;
}

/**
 * Effect 프레임 텍스처 배열 반환 (AnimatedSprite용)
 * @param effectName 이펙트 이름 (예: 'LevelUp', 'Buff1')
 * @param frameCount 총 프레임 수
 * @returns Texture 배열 또는 null
 */
export function getEffectFrames(effectName: string, frameCount: number): Texture[] | null {
  if (_fallbackMode) return null;
  const frames: Texture[] = [];
  for (let i = 0; i < frameCount; i++) {
    const alias = `effect_${effectName}_${i}`;
    const tex = Assets.get<Texture>(alias);
    if (!tex) return null;
    frames.push(tex);
  }
  return frames;
}

/**
 * Destructible 프레임 텍스처 배열 반환 (AnimatedSprite용)
 * @param destructibleName 파괴 애니메이션 이름 (예: 'Wall Wood explosion Small')
 * @param frameCount 총 프레임 수
 * @returns Texture 배열 또는 null
 */
export function getDestructibleFrames(destructibleName: string, frameCount: number): Texture[] | null {
  if (_fallbackMode) return null;
  const frames: Texture[] = [];
  for (let i = 0; i < frameCount; i++) {
    const alias = `destructible_${destructibleName}_${i}`;
    const tex = Assets.get<Texture>(alias);
    if (!tex) return null;
    frames.push(tex);
  }
  return frames;
}

/**
 * Prop 프레임 텍스처 배열 반환 (AnimatedSprite용)
 * @param propName 소품 이름 (예: 'Fire', 'Torch 1')
 * @param frameCount 총 프레임 수
 * @returns Texture 배열 또는 null
 */
export function getPropFrames(propName: string, frameCount: number): Texture[] | null {
  if (_fallbackMode) return null;
  const frames: Texture[] = [];
  for (let i = 0; i < frameCount; i++) {
    const alias = `prop_${propName}_${i}`;
    const tex = Assets.get<Texture>(alias);
    if (!tex) return null;
    frames.push(tex);
  }
  return frames;
}

/**
 * 특수 에셋 텍스처 반환
 */
export function getSpecialTexture(name: string): Texture | null {
  if (_fallbackMode) return null;
  const alias = `special_${name}`;
  return Assets.get<Texture>(alias) ?? null;
}

// ============================================================================
// 상태 조회
// ============================================================================

/** 현재 로드된 바이옴 반환 */
export function getCurrentBiome(): BiomeType | null {
  return _currentBiome;
}

/** 텍스처 로드 완료 여부 */
export function isTexturesLoaded(): boolean {
  return _loaded && !_fallbackMode;
}

/** fallback 모드 여부 */
export function isTextureFallback(): boolean {
  return _fallbackMode;
}

/** 로드 중 여부 */
export function isLoading(): boolean {
  return _loadingPromise !== null;
}

/**
 * 전체 리셋 (테스트/디버그용)
 */
export function resetTextureLoader(): void {
  _currentBiome = null;
  _loaded = false;
  _fallbackMode = false;
  _loadingPromise = null;
  _manifestInitialized = false;
}
