/**
 * game/rendering/environment/terrain/index.ts - Terrain 모듈 집합
 *
 * 모든 지형지물 렌더링 함수 export
 */

// Types
export type { TerrainParams } from './classroom';

// Terrain renderers by stage
export { drawClassroomTerrain } from './classroom';   // Stage 1-5
export { drawCafeteriaTerrain } from './cafeteria';   // Stage 6-10
export { drawGymTerrain } from './gym';               // Stage 11-15
export { drawScienceTerrain } from './science';       // Stage 16-20
export { drawAdminTerrain } from './admin';           // Stage 21-25
export { drawEscapeTerrain } from './escape';         // Stage 26-30
export { drawSingularityTerrain } from './singularity'; // Singularity Mode

// Terrain type mapping
import { drawClassroomTerrain } from './classroom';
import { drawCafeteriaTerrain } from './cafeteria';
import { drawGymTerrain } from './gym';
import { drawScienceTerrain } from './science';
import { drawAdminTerrain } from './admin';
import { drawEscapeTerrain } from './escape';
import { drawSingularityTerrain } from './singularity';
import type { TerrainParams } from './classroom';

export type TerrainType = 'classroom' | 'cafeteria' | 'gym' | 'science' | 'admin' | 'escape' | 'singularity';

/**
 * Dispatcher: 지형 타입에 따라 적절한 렌더러 호출
 */
export function drawTerrainByType(terrainType: TerrainType, params: TerrainParams): void {
  switch (terrainType) {
    case 'classroom':
      drawClassroomTerrain(params);
      break;
    case 'cafeteria':
      drawCafeteriaTerrain(params);
      break;
    case 'gym':
      drawGymTerrain(params);
      break;
    case 'science':
      drawScienceTerrain(params);
      break;
    case 'admin':
      drawAdminTerrain(params);
      break;
    case 'escape':
      drawEscapeTerrain(params);
      break;
    case 'singularity':
      drawSingularityTerrain(params);
      break;
  }
}
