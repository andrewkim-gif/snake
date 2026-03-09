/**
 * building-composites.ts
 *
 * Phase 4: 53 건물 → 6 시각 등급 매핑 + BuildingComposite 생성
 *
 * 6 시각 등급:
 *   small_wood    — 소형 목조 (house, housing, apartment, clinic, road, oil_well, gas_extractor)
 *   medium_wood   — 중형 목조 (farm, logging_camp, sawmill, school, hospital, warehouse, entertainment, plantations)
 *   medium_stone  — 중형 석조 (market, fishing_wharf, food_factory, sugar_mill, cigar_factory, textile_mill, university)
 *   large_factory — 대형 공장 (factory, power_plants, steel_mill, smelters, refineries, electronics, machinery, port, airport)
 *   military      — 군사 시설 (barracks, weapons_depot, military_base)
 *   government    — 정부/종교 (town_hall, capitol, luxury_workshop, pharma_lab, aerospace_complex)
 *
 * 각 등급은 기후대별 Wall/Roof 오버라이드를 받음 (iso-biome-defs.ts)
 *
 * @generated 2026-03-09 Phase 4
 */

import type { BuildingVisualGrade, VisualGradeComposite, WallSeries, RoofSeries } from './iso-asset-catalog';
import { VISUAL_GRADE_DEFAULTS, WALL_SERIES, ROOF_SERIES } from './iso-asset-catalog';
import type { BiomeType, BuildingComposite } from '../../components/game/iso/types';
import { getBiomeBuildingStyle, type BuildingVisualGradeId } from './iso-biome-defs';

// ============================================================================
// 1. 53 건물 → 시각 등급 매핑
// ============================================================================

/** 건물 ID → 시각 등급 매핑 */
export const BUILDING_VISUAL_GRADE_MAP: Record<string, BuildingVisualGrade> = {
  // --- small_wood: 소형 목조 ---
  'house':           'small_wood',
  'housing':         'small_wood',
  'apartment':       'small_wood',
  'clinic':          'small_wood',
  'road':            'small_wood',
  'oil_well':        'small_wood',
  'gas_extractor':   'small_wood',

  // --- medium_wood: 중형 목조 ---
  'farm':                'medium_wood',
  'sugar_plantation':    'medium_wood',
  'tobacco_plantation':  'medium_wood',
  'cotton_plantation':   'medium_wood',
  'coffee_plantation':   'medium_wood',
  'rubber_plantation':   'medium_wood',
  'logging_camp':        'medium_wood',
  'sawmill':             'medium_wood',
  'school':              'medium_wood',
  'entertainment':       'medium_wood',
  'warehouse':           'medium_wood',
  'ranch':               'medium_wood',

  // --- medium_stone: 중형 석조 ---
  'market':          'medium_stone',
  'fishing_wharf':   'medium_stone',
  'food_factory':    'medium_stone',
  'sugar_mill':      'medium_stone',
  'cigar_factory':   'medium_stone',
  'textile_mill':    'medium_stone',
  'university':      'medium_stone',

  // --- large_factory: 대형 공장 ---
  'iron_mine':            'large_factory',
  'bauxite_mine':         'large_factory',
  'coal_mine':            'large_factory',
  'rare_earth_mine':      'large_factory',
  'steel_mill':           'large_factory',
  'aluminum_smelter':     'large_factory',
  'plastics_plant':       'large_factory',
  'chemical_plant':       'large_factory',
  'refinery':             'large_factory',
  'electronics_factory':  'large_factory',
  'machinery_plant':      'large_factory',
  'coal_power':           'large_factory',
  'gas_power':            'large_factory',
  'oil_power':            'large_factory',
  'nuclear_power':        'large_factory',
  'port':                 'large_factory',
  'airport':              'large_factory',
  'arms_factory':         'large_factory',
  'vehicle_factory':      'large_factory',
  'semiconductor_fab':    'large_factory',

  // --- military: 군사 시설 ---
  'barracks':       'military',
  'weapons_depot':  'military',
  'military_base':  'military',

  // --- government: 정부/종교 ---
  'town_hall':           'government',
  'capitol':             'government',
  'luxury_workshop':     'government',
  'pharma_lab':          'government',
  'aerospace_complex':   'government',
};

// ============================================================================
// 2. 시각 등급별 Wall/Roof 변형 범위
// ============================================================================

/**
 * 각 시각 등급별 Wall/Roof 변형 번호 범위
 * 건물 크기(sizeW * sizeH)에 따라 변형 번호를 선택하여 크기감 조절
 * 큰 번호 = 더 넓은 벽/지붕
 */
interface VariantRange {
  /** 소형 건물(1x1) Wall 변형 후보 */
  wallSmall: readonly number[];
  /** 중형 건물(2x1, 2x2) Wall 변형 후보 */
  wallMedium: readonly number[];
  /** 대형 건물(3x2+) Wall 변형 후보 */
  wallLarge: readonly number[];
  /** 소형 Roof 변형 후보 */
  roofSmall: readonly number[];
  /** 중형 Roof 변형 후보 */
  roofMedium: readonly number[];
  /** 대형 Roof 변형 후보 */
  roofLarge: readonly number[];
}

/**
 * Wall 시리즈별 변형 범위 (작은 번호=소형, 큰 번호=대형)
 * 실제 에셋 분석에 따라 대략적으로 분류
 */
function getVariantRange(wallSeries: string, roofSeries: string): VariantRange {
  const wallVariants = WALL_SERIES[wallSeries as WallSeries]?.variants ?? [1];
  const roofVariants = ROOF_SERIES[roofSeries as RoofSeries]?.variants ?? [1];

  const wLen = wallVariants.length;
  const rLen = roofVariants.length;

  // 각 시리즈의 변형을 3등분 (소/중/대)
  const wThird = Math.max(1, Math.ceil(wLen / 3));
  const rThird = Math.max(1, Math.ceil(rLen / 3));

  return {
    wallSmall:  wallVariants.slice(0, wThird),
    wallMedium: wallVariants.slice(wThird, wThird * 2),
    wallLarge:  wallVariants.slice(wThird * 2),
    roofSmall:  roofVariants.slice(0, rThird),
    roofMedium: roofVariants.slice(rThird, rThird * 2),
    roofLarge:  roofVariants.slice(rThird * 2),
  };
}

// ============================================================================
// 3. BuildingComposite 생성
// ============================================================================

/**
 * 건물 ID + 바이옴 → BuildingComposite 반환
 *
 * 1. 건물 ID → 시각 등급 조회
 * 2. 시각 등급 + 바이옴 → Wall/Roof 시리즈 (오버라이드 적용)
 * 3. 건물 크기 → 변형 번호 선택 (시드 기반)
 * 4. Door 시리즈/변형은 등급 기본값 사용
 *
 * @param buildingId 건물 ID (예: 'house', 'farm')
 * @param biome 현재 바이옴
 * @param sizeW 건물 타일 폭
 * @param sizeH 건물 타일 높이
 * @param seed 랜덤 시드 (변형 선택용)
 */
export function getBuildingComposite(
  buildingId: string,
  biome: BiomeType,
  sizeW: number = 1,
  sizeH: number = 1,
  seed: number = 0,
): BuildingComposite {
  // 1. 시각 등급 조회
  const grade = BUILDING_VISUAL_GRADE_MAP[buildingId] ?? 'small_wood';

  // 2. 바이옴 오버라이드 적용
  const biomeStyle = getBiomeBuildingStyle(biome, grade as BuildingVisualGradeId);
  const gradeDefaults = VISUAL_GRADE_DEFAULTS[grade];

  // 3. 변형 범위에서 건물 크기에 맞는 변형 선택
  const range = getVariantRange(biomeStyle.wallSeries, biomeStyle.roofSeries);
  const area = sizeW * sizeH;

  let wallCandidates: readonly number[];
  let roofCandidates: readonly number[];

  if (area >= 6) {
    // 대형 건물 (3x2, 4x3 등)
    wallCandidates = range.wallLarge.length > 0 ? range.wallLarge : range.wallMedium;
    roofCandidates = range.roofLarge.length > 0 ? range.roofLarge : range.roofMedium;
  } else if (area >= 2) {
    // 중형 건물 (2x1, 2x2 등)
    wallCandidates = range.wallMedium.length > 0 ? range.wallMedium : range.wallSmall;
    roofCandidates = range.roofMedium.length > 0 ? range.roofMedium : range.roofSmall;
  } else {
    // 소형 건물 (1x1)
    wallCandidates = range.wallSmall;
    roofCandidates = range.roofSmall;
  }

  // 시드 기반 변형 선택
  const wallVariant = wallCandidates[Math.abs(seed) % wallCandidates.length];
  const roofVariant = roofCandidates[Math.abs(seed + 7) % roofCandidates.length];

  return {
    wallSeries: biomeStyle.wallSeries,
    wallVariant,
    roofSeries: biomeStyle.roofSeries,
    roofVariant,
    doorSeries: gradeDefaults.doorSeries,
    doorVariant: gradeDefaults.doorVariant,
  };
}

/**
 * 건물 ID의 시각 등급 조회
 */
export function getBuildingGrade(buildingId: string): BuildingVisualGrade {
  return BUILDING_VISUAL_GRADE_MAP[buildingId] ?? 'small_wood';
}

/**
 * 전체 시각 등급 목록
 */
export const ALL_VISUAL_GRADES: readonly BuildingVisualGrade[] = [
  'small_wood',
  'medium_wood',
  'medium_stone',
  'large_factory',
  'military',
  'government',
] as const;
