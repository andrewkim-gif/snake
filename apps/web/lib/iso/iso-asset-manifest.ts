/**
 * iso-asset-manifest.ts
 *
 * Phase 1: PixiJS 8 Assets API에 전달할 에셋 매니페스트
 * - iso-asset-catalog.ts를 참조하여 모든 에셋 경로를 bundle로 그룹핑
 * - 번들: terrain, buildings, decorations, citizens, effects, common
 * - 바이옴별 lazy loading 지원 — 전체를 한 번에 로드하지 않음
 *
 * 참조: iso-asset-catalog.ts (Phase 0)
 * 참조: iso-biome-defs.ts (Phase 1)
 *
 * @generated 2026-03-09 Phase 1
 */

import type { BiomeType } from '../../components/game/iso/types';
import {
  GROUND_SERIES, WALL_SERIES, ROOF_SERIES, STONE_SERIES,
  TREE_SERIES, FLORA_SERIES, WALLFLORA_SERIES, MISC_SERIES,
  SHADOW_VARIANTS, DOOR_SERIES, CHEST_SERIES,
  CLOUD_ASSETS, SPECIAL_ASSETS, OTHER_ASSETS,
  envAssetPath, shadowAssetPath,
  waterRipplePath, windmillPath,
  effectFramePath, destructibleFramePath, propFramePath,
  WATER_RIPPLE_COUNT, WATER_RIPPLE_FRAMES,
  WINDMILL_COUNT, WINDMILL_FRAMES,
  EFFECT_ANIMS, DESTRUCTIBLE_ANIMS, PROP_ANIMS,
  type GroundSeries, type WallSeries, type RoofSeries,
  type TreeSeries, type FloraSeries, type MiscSeries,
  type DoorSeries, type ChestSeries,
  DEFAULT_DIRECTION,
} from './iso-asset-catalog';
import { BIOME_DEFS, getBiomeGroundSeries, getBiomeWallSeries, getBiomeRoofSeries } from './iso-biome-defs';

// ============================================================================
// 타입 정의
// ============================================================================

/** PixiJS Assets 번들 에셋 항목 */
export interface BundleAsset {
  alias: string;
  src: string;
}

/** PixiJS Assets 번들 */
export interface AssetBundle {
  name: string;
  assets: BundleAsset[];
}

/** 전체 매니페스트 */
export interface AssetManifest {
  bundles: AssetBundle[];
}

// SECTION_HELPERS

// ============================================================================
// 에셋 alias 생성 헬퍼
// ============================================================================

/**
 * Environment 에셋 alias 생성
 * 형식: "{category}_{series}{variant}" (예: "ground_A1", "wall_C3")
 */
export function envAlias(category: string, series: string, variant: number): string {
  return `${category.toLowerCase()}_${series}${variant}`;
}

/**
 * Shadow 에셋 alias 생성
 * 형식: "shadow_{variant}" (예: "shadow_1")
 */
export function shadowAlias(variant: number): string {
  return `shadow_${variant}`;
}

// SECTION_BIOME_TERRAIN

// ============================================================================
// 바이옴별 지형 번들 생성
// ============================================================================

/**
 * 바이옴에 필요한 Ground 에셋 번들 생성
 * 해당 바이옴의 주력 + 보조 Ground 시리즈만 포함
 */
function buildGroundAssets(biome: BiomeType): BundleAsset[] {
  const seriesList = getBiomeGroundSeries(biome);
  const assets: BundleAsset[] = [];

  for (const s of seriesList) {
    const seriesDef = GROUND_SERIES[s as GroundSeries];
    if (!seriesDef) continue;
    for (const v of seriesDef.variants) {
      assets.push({
        alias: envAlias('ground', s, v),
        src: envAssetPath('Ground', s, v, DEFAULT_DIRECTION),
      });
    }
  }

  return assets;
}

/**
 * 바이옴에 필요한 Wall 에셋 번들 생성
 */
function buildWallAssets(biome: BiomeType): BundleAsset[] {
  const seriesList = getBiomeWallSeries(biome);
  const assets: BundleAsset[] = [];

  for (const s of seriesList) {
    const seriesDef = WALL_SERIES[s as WallSeries];
    if (!seriesDef) continue;
    for (const v of seriesDef.variants) {
      assets.push({
        alias: envAlias('wall', s, v),
        src: envAssetPath('Wall', s, v, DEFAULT_DIRECTION),
      });
    }
  }

  return assets;
}

/**
 * 바이옴에 필요한 Roof 에셋 번들 생성
 */
function buildRoofAssets(biome: BiomeType): BundleAsset[] {
  const seriesList = getBiomeRoofSeries(biome);
  const assets: BundleAsset[] = [];

  for (const s of seriesList) {
    const seriesDef = ROOF_SERIES[s as RoofSeries];
    if (!seriesDef) continue;
    for (const v of seriesDef.variants) {
      assets.push({
        alias: envAlias('roof', s, v),
        src: envAssetPath('Roof', s, v, DEFAULT_DIRECTION),
      });
    }
  }

  return assets;
}

/**
 * 바이옴에 필요한 Tree 에셋 번들 생성
 */
function buildTreeAssets(biome: BiomeType): BundleAsset[] {
  const biomeDef = BIOME_DEFS[biome];
  const assets: BundleAsset[] = [];

  for (const s of biomeDef.trees) {
    const seriesDef = TREE_SERIES[s as TreeSeries];
    if (!seriesDef) continue;
    for (const v of seriesDef.variants) {
      assets.push({
        alias: envAlias('tree', s, v),
        src: envAssetPath('Tree', s, v, DEFAULT_DIRECTION),
      });
    }
  }

  return assets;
}

/**
 * 바이옴에 필요한 Flora 에셋 번들 생성
 */
function buildFloraAssets(biome: BiomeType): BundleAsset[] {
  const biomeDef = BIOME_DEFS[biome];
  const assets: BundleAsset[] = [];

  for (const s of biomeDef.flora) {
    const seriesDef = FLORA_SERIES[s as FloraSeries];
    if (!seriesDef) continue;
    for (const v of seriesDef.variants) {
      assets.push({
        alias: envAlias('flora', s, v),
        src: envAssetPath('Flora', s, v, DEFAULT_DIRECTION),
      });
    }
  }

  return assets;
}

// SECTION_BIOME_BUILDINGS

// ============================================================================
// 건물 관련 에셋 (Door / Stone / WallFlora)
// ============================================================================

/**
 * Door 에셋 — 모든 Door 시리즈 (전 바이옴 공통)
 */
function buildDoorAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const [s, def] of Object.entries(DOOR_SERIES)) {
    for (const v of def.variants) {
      assets.push({
        alias: envAlias('door', s, v),
        src: envAssetPath('Door', s, v, DEFAULT_DIRECTION),
      });
    }
  }
  return assets;
}

/**
 * Stone 에셋 — 도로/건물 주변 포장 (전 바이옴 공통)
 */
function buildStoneAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const v of STONE_SERIES.variants) {
    assets.push({
      alias: envAlias('stone', 'A', v),
      src: envAssetPath('Stone', 'A', v, DEFAULT_DIRECTION),
    });
  }
  return assets;
}

/**
 * WallFlora 에셋 — 벽면 덩굴 (Temperate/Mediterranean만 사용하지만 공통 로드)
 */
function buildWallFloraAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const v of WALLFLORA_SERIES.variants) {
    assets.push({
      alias: envAlias('wallflora', 'A', v),
      src: envAssetPath('WallFlora', 'A', v, DEFAULT_DIRECTION),
    });
  }
  return assets;
}

/**
 * Chest 에셋 — 보물/저장 상자 (전 바이옴 공통)
 */
function buildChestAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const [s, def] of Object.entries(CHEST_SERIES)) {
    for (const v of def.variants) {
      assets.push({
        alias: envAlias('chest', s, v),
        src: envAssetPath('Chest', s, v, DEFAULT_DIRECTION),
      });
    }
  }
  return assets;
}

/**
 * Misc 소품 에셋 — 바이옴별로 관련 시리즈만 로드
 */
function buildMiscAssets(biome: BiomeType): BundleAsset[] {
  const assets: BundleAsset[] = [];

  // 모든 바이옴에서 공통 사용하는 Misc 시리즈 (A: 깃발, B: 가구/배럴 일부)
  const miscSeriesToLoad: MiscSeries[] = ['A', 'B'];

  // 특정 바이옴에 추가
  switch (biome) {
    case 'temperate':
    case 'mediterranean':
      miscSeriesToLoad.push('D', 'E'); // 장식 + 기계
      break;
    case 'arid':
      miscSeriesToLoad.push('E');      // 기계
      break;
    case 'tropical':
      miscSeriesToLoad.push('D');      // 장식
      break;
    case 'arctic':
      miscSeriesToLoad.push('C', 'E'); // 무기 + 기계
      break;
    case 'urban':
      miscSeriesToLoad.push('D', 'E'); // 장식 + 기계
      break;
  }

  // 군사 시설은 모든 바이옴에서 가능하므로 C(무기) 항상 포함
  if (!miscSeriesToLoad.includes('C')) {
    miscSeriesToLoad.push('C');
  }

  for (const s of miscSeriesToLoad) {
    const seriesDef = MISC_SERIES[s];
    if (!seriesDef) continue;
    for (const v of seriesDef.variants) {
      assets.push({
        alias: envAlias('misc', s, v),
        src: envAssetPath('Misc', s, v, DEFAULT_DIRECTION),
      });
    }
  }

  return assets;
}

// SECTION_COMMON

// ============================================================================
// 공통 에셋 번들 (모든 바이옴에서 사용)
// ============================================================================

/**
 * Shadow 에셋 — 모든 바이옴 공통
 */
function buildShadowAssets(): BundleAsset[] {
  return SHADOW_VARIANTS.map((v) => ({
    alias: shadowAlias(v),
    src: shadowAssetPath(v, DEFAULT_DIRECTION),
  }));
}

/**
 * Water Ripples 애니메이션 프레임 에셋 — 13종 × 16프레임 = 208 파일
 * 모든 바이옴에서 물 타일이 있으면 사용
 */
function buildWaterRippleAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (let ripple = 1; ripple <= WATER_RIPPLE_COUNT; ripple++) {
    for (let frame = 0; frame < WATER_RIPPLE_FRAMES; frame++) {
      assets.push({
        alias: `water_ripple_${ripple}_${frame}`,
        src: waterRipplePath(ripple, frame),
      });
    }
  }
  return assets;
}

/**
 * WindMill 애니메이션 프레임 에셋 — 2종 × 17프레임 = 34 파일
 * Temperate/Mediterranean 바이옴에서 Farm 인접에 사용
 */
function buildWindmillAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (let mill = 1; mill <= WINDMILL_COUNT; mill++) {
    for (let frame = 0; frame < WINDMILL_FRAMES; frame++) {
      assets.push({
        alias: `windmill_${mill}_${frame}`,
        src: windmillPath(mill, frame),
      });
    }
  }
  return assets;
}

/**
 * Effects 애니메이션 프레임 에셋 (14종)
 * 건설/버프/전투 이펙트
 */
function buildEffectAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const effect of EFFECT_ANIMS) {
    for (let frame = 0; frame < effect.frames; frame++) {
      assets.push({
        alias: `effect_${effect.name}_${frame}`,
        src: effectFramePath(effect.name, frame),
      });
    }
  }
  return assets;
}

/**
 * Destructible 애니메이션 프레임 에셋 (17종)
 * 건물 파괴 이펙트
 */
function buildDestructibleAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const destr of DESTRUCTIBLE_ANIMS) {
    for (let frame = 0; frame < destr.frames; frame++) {
      assets.push({
        alias: `destructible_${destr.name}_${frame}`,
        src: destructibleFramePath(destr.name, frame),
      });
    }
  }
  return assets;
}

/**
 * Props 애니메이션 프레임 에셋 (11종)
 * Fire, Torch, Barrel 등 소품 애니메이션
 */
function buildPropAnimAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];
  for (const prop of PROP_ANIMS) {
    for (let frame = 0; frame < prop.frames; frame++) {
      assets.push({
        alias: `prop_${prop.name}_${frame}`,
        src: propFramePath(prop.name, frame),
      });
    }
  }
  return assets;
}

/**
 * 공통 에셋 (구름, 특수 타일, 애니메이션)
 */
function buildCommonAssets(): BundleAsset[] {
  const assets: BundleAsset[] = [];

  // 구름
  assets.push(
    { alias: 'cloud_1', src: OTHER_ASSETS.cloud1 },
    { alias: 'cloud_2', src: OTHER_ASSETS.cloud2 },
    { alias: 'cloud_3', src: OTHER_ASSETS.cloud3 },
  );

  // 특수 에셋
  assets.push(
    { alias: 'special_black_tile', src: SPECIAL_ASSETS.blackTile },
    { alias: 'special_tile_preview', src: SPECIAL_ASSETS.tilePreview },
  );

  // 기타 오버레이
  assets.push(
    { alias: 'other_god_ray', src: OTHER_ASSETS.godRay },
    { alias: 'other_dash_line', src: OTHER_ASSETS.dashLine },
  );

  // Water Ripples 애니메이션 (13종 × 16프레임)
  assets.push(...buildWaterRippleAssets());

  // WindMill 애니메이션 (2종 × 17프레임)
  assets.push(...buildWindmillAssets());

  return assets;
}

// SECTION_MANIFEST_BUILDER

// ============================================================================
// 바이옴별 매니페스트 빌더
// ============================================================================

/**
 * 바이옴별 전체 매니페스트 생성
 *
 * PixiJS Assets.init({ manifest }) 에 전달하는 구조체.
 * 바이옴에 필요한 에셋만 포함하여 메모리 효율성 보장.
 *
 * 번들 구성:
 * - `terrain_{biome}`: Ground + Tree + Flora (바이옴별 다름)
 * - `buildings_{biome}`: Wall + Roof + Door + Stone + WallFlora + Chest (바이옴별 다름)
 * - `decorations_{biome}`: Misc 소품 (바이옴별 일부 다름)
 * - `common`: Shadow + Cloud + Special (모든 바이옴 공통)
 */
export function buildBiomeManifest(biome: BiomeType): AssetManifest {
  return {
    bundles: [
      {
        name: `terrain_${biome}`,
        assets: [
          ...buildGroundAssets(biome),
          ...buildTreeAssets(biome),
          ...buildFloraAssets(biome),
        ],
      },
      {
        name: `buildings_${biome}`,
        assets: [
          ...buildWallAssets(biome),
          ...buildRoofAssets(biome),
          ...buildDoorAssets(),
          ...buildStoneAssets(),
          ...buildWallFloraAssets(),
          ...buildChestAssets(),
        ],
      },
      {
        name: `decorations_${biome}`,
        assets: [
          ...buildMiscAssets(biome),
          ...buildShadowAssets(),
        ],
      },
      {
        name: 'common',
        assets: buildCommonAssets(),
      },
      {
        name: 'effects',
        assets: [
          ...buildEffectAssets(),
          ...buildDestructibleAssets(),
          ...buildPropAnimAssets(),
        ],
      },
    ],
  };
}

/**
 * 바이옴의 모든 번들 이름 반환
 */
export function getBiomeBundleNames(biome: BiomeType): string[] {
  return [
    `terrain_${biome}`,
    `buildings_${biome}`,
    `decorations_${biome}`,
    'common',
    'effects',
  ];
}

/**
 * 매니페스트의 총 에셋 수 계산
 */
export function countManifestAssets(manifest: AssetManifest): number {
  return manifest.bundles.reduce((sum, bundle) => sum + bundle.assets.length, 0);
}

/**
 * 디버그용: 매니페스트 요약 출력
 */
export function logManifestSummary(manifest: AssetManifest): void {
  console.log('[IsoManifest] Bundle summary:');
  for (const bundle of manifest.bundles) {
    console.log(`  ${bundle.name}: ${bundle.assets.length} assets`);
  }
  console.log(`  Total: ${countManifestAssets(manifest)} assets`);
}
