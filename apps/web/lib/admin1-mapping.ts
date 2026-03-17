/**
 * admin1-mapping.ts — 20개 주요국 Natural Earth admin1 → game region 매핑 (참조용)
 *
 * 빌드 타임에 사용되는 매핑. 런타임에서는 이미 TopoJSON에 game_region_idx가 포함됨.
 * 이 파일은 admin1-mapping.mjs의 TypeScript 타입 참조용.
 */

/** 20개 주요국의 admin1 name → game region slug 매핑 */
export const ADMIN1_REGION_MAPPING: Record<string, Record<string, string[]>> = {
  // S 티어: USA, CHN, RUS, IND, JPN, DEU, GBR, FRA
  // A 티어: KOR, BRA, CAN, AUS, ITA, TUR, SAU, MEX, IDN, ESP, NLD, POL
  // 상세 매핑은 admin1-mapping.mjs 참조
};
