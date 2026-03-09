/**
 * v26 Phase 7 — Isometric Texture Loader
 *
 * PixiJS 8 Assets API 기반 텍스처 로더.
 * - Terrain/Building/Citizen/Icon 텍스처 매핑
 * - 비동기 프리로드 + graceful fallback (텍스처 없으면 기존 Graphics 유지)
 * - getTerrainTexture / getBuildingTexture / getCitizenTexture / getIconTexture
 */

import { Assets, Texture } from 'pixi.js';

// ─── 텍스처 경로 매핑 ───

/** 지형 타입 → 텍스처 경로 */
const TERRAIN_TEXTURE_MAP: Record<string, string> = {
  grass:    '/textures/iso/tiles/grass.png',
  water:    '/textures/iso/tiles/water.png',
  mountain: '/textures/iso/tiles/mountain.png',
  forest:   '/textures/iso/tiles/forest.png',
  desert:   '/textures/iso/tiles/desert.png',
  beach:    '/textures/iso/tiles/beach.png',
};

/** 건물 타입 → 텍스처 경로 */
const BUILDING_TEXTURE_MAP: Record<string, string> = {
  house:       '/textures/iso/buildings/house.png',
  farm:        '/textures/iso/buildings/farm.png',
  barracks:    '/textures/iso/buildings/barracks.png',
  market:      '/textures/iso/buildings/market.png',
  factory:     '/textures/iso/buildings/factory.png',
  power_plant: '/textures/iso/buildings/power_plant.png',
  hospital:    '/textures/iso/buildings/hospital.png',
  school:      '/textures/iso/buildings/school.png',
  church:      '/textures/iso/buildings/church.png',
  government:  '/textures/iso/buildings/government.png',
};

/** 시민 상태 → 텍스처 경로 */
const CITIZEN_TEXTURE_MAP: Record<string, string> = {
  working:    '/textures/iso/citizens/working.png',
  commuting:  '/textures/iso/citizens/commuting.png',
  shopping:   '/textures/iso/citizens/shopping.png',
  resting:    '/textures/iso/citizens/resting.png',
  protesting: '/textures/iso/citizens/protesting.png',
  idle:       '/textures/iso/citizens/idle.png',
};

/** 리소스 아이콘 → 텍스처 경로 */
const ICON_TEXTURE_MAP: Record<string, string> = {
  gold:       '/textures/iso/icons/gold.png',
  food:       '/textures/iso/icons/food.png',
  iron:       '/textures/iso/icons/iron.png',
  oil:        '/textures/iso/icons/oil.png',
  power:      '/textures/iso/icons/power.png',
  wood:       '/textures/iso/icons/wood.png',
  stone:      '/textures/iso/icons/stone.png',
  population: '/textures/iso/icons/population.png',
  happiness:  '/textures/iso/icons/happiness.png',
  military:   '/textures/iso/icons/military.png',
};

// ─── 로드 상태 ───

/** 텍스처 로드 완료 여부 */
let _loaded = false;
/** 로드 중 에러 발생 시 true → fallback 모드 */
let _fallbackMode = false;
/** 로드된 텍스처 캐시 */
const _textureCache: Map<string, Texture> = new Map();

// ─── 프리로드 ───

/**
 * 모든 아이소메트릭 텍스처를 프리로드.
 * PixiJS Assets.load()는 이미 로드된 텍스처를 재로드하지 않음.
 *
 * @returns 로드 성공 여부 (false면 fallback 모드)
 */
export async function preloadIsoTextures(): Promise<boolean> {
  if (_loaded) return !_fallbackMode;

  // 모든 텍스처 경로 수집
  const allMaps = [
    TERRAIN_TEXTURE_MAP,
    BUILDING_TEXTURE_MAP,
    CITIZEN_TEXTURE_MAP,
    ICON_TEXTURE_MAP,
  ];

  const allPaths: string[] = [];
  for (const map of allMaps) {
    for (const path of Object.values(map)) {
      allPaths.push(path);
    }
  }

  try {
    // PixiJS 8: Assets.load() 배열로 일괄 로드
    const textures = await Assets.load<Texture>(allPaths);

    // 캐시에 저장 (배열 로드 시 object 형태로 반환)
    if (textures && typeof textures === 'object') {
      for (const [key, tex] of Object.entries(textures)) {
        if (tex && tex instanceof Texture) {
          _textureCache.set(key, tex);
        }
      }
    }

    _loaded = true;
    _fallbackMode = false;
    console.log(`[IsoTextures] Preloaded ${_textureCache.size} textures`);
    return true;
  } catch (err) {
    console.warn('[IsoTextures] Preload failed, using fallback Graphics:', err);
    _loaded = true;
    _fallbackMode = true;
    return false;
  }
}

// ─── 텍스처 접근자 ───

/**
 * 지형 텍스처 반환. 없으면 null (→ 기존 Graphics 사용).
 */
export function getTerrainTexture(terrainType: string): Texture | null {
  if (_fallbackMode) return null;
  const path = TERRAIN_TEXTURE_MAP[terrainType];
  if (!path) return null;
  return _textureCache.get(path) ?? Assets.get<Texture>(path) ?? null;
}

/**
 * 건물 텍스처 반환. 없으면 null (→ 기존 프로시저럴 렌더링).
 */
export function getBuildingTexture(buildingDefId: string): Texture | null {
  if (_fallbackMode) return null;
  const path = BUILDING_TEXTURE_MAP[buildingDefId];
  if (!path) return null;
  return _textureCache.get(path) ?? Assets.get<Texture>(path) ?? null;
}

/**
 * 시민 텍스처 반환. 없으면 null (→ 기존 Graphics dot).
 */
export function getCitizenTexture(state: string): Texture | null {
  if (_fallbackMode) return null;
  const path = CITIZEN_TEXTURE_MAP[state];
  if (!path) return null;
  return _textureCache.get(path) ?? Assets.get<Texture>(path) ?? null;
}

/**
 * 아이콘 텍스처 반환. 없으면 null.
 */
export function getIconTexture(iconName: string): Texture | null {
  if (_fallbackMode) return null;
  const path = ICON_TEXTURE_MAP[iconName];
  if (!path) return null;
  return _textureCache.get(path) ?? Assets.get<Texture>(path) ?? null;
}

/**
 * 텍스처 로드 상태 확인
 */
export function isTexturesLoaded(): boolean {
  return _loaded && !_fallbackMode;
}

/**
 * fallback 모드 여부 (텍스처 로드 실패)
 */
export function isTextureFallback(): boolean {
  return _fallbackMode;
}
