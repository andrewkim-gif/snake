/**
 * game/map/objects.ts - 맵 오브젝트 시스템
 *
 * v7.2: Object + StreetLamp 스프라이트 시스템
 * - Object1-28: 다양한 소품
 * - StreetLamp 1-2: 가로등
 * - 바이옴별 적절한 스프라이트 자동 선택
 */

import type {
  BiomeType,
  MapObject,
  MapObjectDef,
  MapObjectType,
  CollisionResult,
} from './types';
import { seededSimplex2D, normalizeNoise } from './noise';
import { getBiomeAt, getStageMapConfig, getBiomeConfig } from './biomes';
import {
  getRandomObjectForBiome,
  hasCollision as spriteHasCollision,
  getObjectSize,
  getCollisionRatio,
  type ObjectSpriteType,
} from '../tiles/objectLoader';
import {
  getObjectCollisionBox,
  checkCircleAABBCollision,
  isPointInBox,
  calculatePushVector,
} from '../collision';

// ============================================
// Object Definitions
// ============================================

/**
 * 모든 맵 오브젝트 정의
 */
export const MAP_OBJECT_DEFS: Record<MapObjectType, MapObjectDef> = {
  // 자연 오브젝트 (크기 2배 - 이소메트릭 뷰용)
  tree_small: {
    type: 'tree_small',
    width: 40,
    height: 50,
    hasCollision: true,
    zIndex: 10,
    renderScale: 1.5,
    allowedBiomes: ['grass'],
  },
  tree_large: {
    type: 'tree_large',
    width: 60,
    height: 70,
    hasCollision: true,
    zIndex: 15,
    renderScale: 1.8,
    allowedBiomes: ['grass'],
  },
  bush: {
    type: 'bush',
    width: 32,
    height: 24,
    hasCollision: false,
    zIndex: 5,
    renderScale: 1.2,
    allowedBiomes: ['grass'],
  },
  rock_small: {
    type: 'rock_small',
    width: 28,
    height: 24,
    hasCollision: true,
    zIndex: 5,
    renderScale: 1.4,
    allowedBiomes: ['grass', 'stone'],
  },
  rock_medium: {
    type: 'rock_medium',
    width: 48,
    height: 40,
    hasCollision: true,
    zIndex: 8,
    renderScale: 1.6,
    allowedBiomes: ['stone'],
  },
  flower_patch: {
    type: 'flower_patch',
    width: 36,
    height: 28,
    hasCollision: false,
    zIndex: 2,
    renderScale: 1.0,
    allowedBiomes: ['grass'],
  },

  // 도시 오브젝트 (크기 2배)
  barrel: {
    type: 'barrel',
    width: 32,
    height: 40,
    hasCollision: true,
    zIndex: 8,
    renderScale: 1.5,
    allowedBiomes: ['concrete', 'stone'],
  },
  crate: {
    type: 'crate',
    width: 40,
    height: 36,
    hasCollision: true,
    zIndex: 7,
    renderScale: 1.5,
    allowedBiomes: ['concrete', 'stone', 'special'],
  },
  trash_bin: {
    type: 'trash_bin',
    width: 28,
    height: 36,
    hasCollision: true,
    zIndex: 6,
    renderScale: 1.4,
    allowedBiomes: ['concrete'],
  },
  cone: {
    type: 'cone',
    width: 24,
    height: 32,
    hasCollision: true,
    zIndex: 4,
    renderScale: 1.3,
    allowedBiomes: ['concrete'],
  },
  bench: {
    type: 'bench',
    width: 56,
    height: 28,
    hasCollision: true,
    zIndex: 6,
    renderScale: 1.5,
    allowedBiomes: ['concrete', 'grass'],
  },
  lamp_post: {
    type: 'lamp_post',
    width: 20,
    height: 60,
    hasCollision: true,
    zIndex: 20,
    renderScale: 2.0,
    allowedBiomes: ['concrete'],
  },

  // Matrix 오브젝트 (크기 2배)
  data_node: {
    type: 'data_node',
    width: 36,
    height: 36,
    hasCollision: true,
    zIndex: 10,
    renderScale: 1.5,
    allowedBiomes: ['void'],
  },
  corrupted_terminal: {
    type: 'corrupted_terminal',
    width: 48,
    height: 40,
    hasCollision: true,
    zIndex: 12,
    renderScale: 1.6,
    allowedBiomes: ['void'],
  },
  glitch_zone: {
    type: 'glitch_zone',
    width: 60,
    height: 60,
    hasCollision: false,
    zIndex: 1,
    renderScale: 1.5,
    allowedBiomes: ['void'],
  },
  matrix_pillar: {
    type: 'matrix_pillar',
    width: 32,
    height: 80,
    hasCollision: true,
    zIndex: 25,
    renderScale: 2.0,
    allowedBiomes: ['void'],
  },

  // 기존 학교 오브젝트 (크기 2배)
  desk: {
    type: 'desk',
    width: 56,
    height: 40,
    hasCollision: true,
    zIndex: 8,
    sprite: './assets/map/furniture/desk.png',
    renderScale: 1.5,
  },
  locker: {
    type: 'locker',
    width: 32,
    height: 64,
    hasCollision: true,
    zIndex: 12,
    renderScale: 1.5,
  },
  vending_machine: {
    type: 'vending_machine',
    width: 40,
    height: 64,
    hasCollision: true,
    zIndex: 15,
    sprite: './assets/map/furniture/vending.png',
    renderScale: 1.5,
  },
};

// ============================================
// Object Spawning
// ============================================

const GRID_SIZE = 32;
let objectIdCounter = 0;

/**
 * 해시 기반 랜덤 (결정론적)
 */
function seededRandom(x: number, y: number, seed: number): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 43.7823) * 43758.5453) % 1;
}

/**
 * 그리드 위치에서 오브젝트 스폰 여부 및 타입 결정
 * v7.1: 스프라이트 기반 오브젝트 생성
 */
export function getObjectAtGrid(
  col: number,
  row: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): MapObject | null {
  // v6.9: 플레이어 스폰 위치(0,0) 주변 17x17 그리드는 오브젝트 생성 금지
  // 게임 시작 시 넓은 안전 영역 확보 (±8 그리드 = ~256px 반경)
  const SPAWN_SAFE_RADIUS = 8;
  if (Math.abs(col) <= SPAWN_SAFE_RADIUS && Math.abs(row) <= SPAWN_SAFE_RADIUS) {
    return null;
  }

  const worldX = col * GRID_SIZE;
  const worldY = row * GRID_SIZE;

  // 노이즈 기반 스폰 확률
  const spawnNoise = seededSimplex2D(col * 0.3, row * 0.3, seed + 5000);
  const spawnChance = normalizeNoise(spawnNoise);

  // 맵 설정에서 밀도 가져오기
  const config = getStageMapConfig(stageId, gameMode);
  const biome = getBiomeAt(worldX, worldY, config, seed);
  const biomeConfig = getBiomeConfig(biome);
  const density = biomeConfig.objectDensity * config.objectDensityMultiplier;

  // 밀도 기반 스폰 체크
  if (spawnChance > density) {
    return null;
  }

  // v7.1: 스프라이트 기반 오브젝트 선택
  const seedValue = col * 73856093 + row * 19349663 + seed;
  const spriteType = getRandomObjectForBiome(biome, seedValue);

  if (!spriteType) {
    return null;
  }

  // 스프라이트 크기 가져오기
  const size = getObjectSize(spriteType);
  const hasCollisionFlag = spriteHasCollision(spriteType);
  const collisionRatio = getCollisionRatio(spriteType);

  // 방향 결정 (4방향 중 랜덤)
  const directions = ['N', 'E', 'S', 'W'] as const;
  const dirIndex = Math.floor(seededRandom(col, row, seed + 6000) * 4);
  const direction = directions[dirIndex];

  // 오브젝트 위치 (셀 내 약간의 랜덤 오프셋)
  const offsetX = (seededRandom(col, row, seed + 7000) - 0.5) * GRID_SIZE * 0.3;
  const offsetY = (seededRandom(col, row, seed + 8000) - 0.5) * GRID_SIZE * 0.3;

  // 스케일 변형 (±10%)
  const baseScale = 0.5; // 기본 0.5x 스케일 (타일이 크므로)
  const scale = baseScale * (0.9 + seededRandom(col, row, seed + 10000) * 0.2);

  // 렌더링 크기
  const renderWidth = size.width * scale;
  const renderHeight = size.height * scale;

  // v7.18: 충돌 크기 (스프라이트 발 위치 기준, 위로 확장)
  const collisionWidth = renderWidth * collisionRatio.widthRatio;
  const collisionHeight = renderHeight * collisionRatio.heightRatio;

  // def 생성 (스프라이트 정보 + 충돌 정보 포함)
  const def: MapObjectDef = {
    type: spriteType as unknown as MapObjectType,
    width: renderWidth,
    height: renderHeight,
    hasCollision: hasCollisionFlag,
    zIndex: hasCollisionFlag ? 15 : 5,
    renderScale: scale,
    // v7.18: 충돌 영역 (발 위치에서 위로 확장)
    collisionWidth,
    collisionHeight,
  };

  return {
    id: ++objectIdCounter,
    type: spriteType as unknown as MapObjectType,
    x: worldX + GRID_SIZE / 2 + offsetX,
    y: worldY + GRID_SIZE / 2 + offsetY,
    rotation: 0, // 스프라이트는 회전하지 않음, 방향 사용
    scale,
    def,
    // 추가 속성
    spriteType,
    direction,
  } as MapObject & { spriteType: ObjectSpriteType; direction: string };
}

// ============================================
// Spatial Query
// ============================================

/**
 * 범위 내 오브젝트 쿼리
 * 실시간 생성 방식 (캐싱 없음, 결정론적)
 */
export function getObjectsInRange(
  centerX: number,
  centerY: number,
  range: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): MapObject[] {
  const objects: MapObject[] = [];

  const startCol = Math.floor((centerX - range) / GRID_SIZE);
  const endCol = Math.ceil((centerX + range) / GRID_SIZE);
  const startRow = Math.floor((centerY - range) / GRID_SIZE);
  const endRow = Math.ceil((centerY + range) / GRID_SIZE);

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const obj = getObjectAtGrid(col, row, stageId, gameMode, seed);
      if (obj) {
        // 실제 범위 내인지 확인
        const dx = obj.x - centerX;
        const dy = obj.y - centerY;
        if (dx * dx + dy * dy <= range * range) {
          objects.push(obj);
        }
      }
    }
  }

  return objects;
}

/**
 * 화면에 보이는 오브젝트 쿼리
 */
export function getObjectsInView(
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): MapObject[] {
  const objects: MapObject[] = [];
  const margin = GRID_SIZE * 2; // 여유 마진

  const startCol = Math.floor((cameraX - margin) / GRID_SIZE);
  const endCol = Math.ceil((cameraX + viewWidth + margin) / GRID_SIZE);
  const startRow = Math.floor((cameraY - margin) / GRID_SIZE);
  const endRow = Math.ceil((cameraY + viewHeight + margin) / GRID_SIZE);

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const obj = getObjectAtGrid(col, row, stageId, gameMode, seed);
      if (obj) {
        objects.push(obj);
      }
    }
  }

  // z-index로 정렬 (낮은 것부터)
  objects.sort((a, b) => a.def.zIndex - b.def.zIndex);

  return objects;
}

// ============================================
// Collision Detection
// ============================================

/**
 * 원형 엔티티와 오브젝트 충돌 체크
 *
 * v7.25: collision 모듈 사용으로 리팩토링
 * - getObjectCollisionBox: 월드 좌표 기반 충돌 박스 계산
 * - checkCircleAABBCollision: 원-AABB 충돌 감지
 *
 * ⚠️ 렌더링 오프셋(screenY -= height * 0.85)은 절대 여기서 사용하지 마세요!
 */
export function checkCircleObjectCollision(
  cx: number,
  cy: number,
  radius: number,
  obj: MapObject
): boolean {
  if (!obj.def.hasCollision) return false;

  // collision 모듈로 충돌 박스 계산 (월드 좌표 기반)
  const box = getObjectCollisionBox(
    obj.x,  // 발 위치 X (월드)
    obj.y,  // 발 위치 Y (월드)
    obj.def.collisionWidth ?? obj.def.width,
    obj.def.collisionHeight ?? obj.def.height
  );

  // 원-AABB 충돌 감지
  return checkCircleAABBCollision({ x: cx, y: cy, radius }, box);
}

/**
 * 범위 내 충돌하는 오브젝트 찾기
 *
 * v7.25: collision 모듈 사용으로 리팩토링
 * - getObjectCollisionBox: 월드 좌표 기반 충돌 박스 계산
 * - calculatePushVector: 밀어내기 벡터 계산
 *
 * ⚠️ 렌더링 오프셋(screenY -= height * 0.85)은 절대 여기서 사용하지 마세요!
 */
export function findCollidingObjects(
  cx: number,
  cy: number,
  radius: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): CollisionResult {
  const searchRange = radius + GRID_SIZE;
  const objects = getObjectsInRange(cx, cy, searchRange, stageId, gameMode, seed);

  for (const obj of objects) {
    if (checkCircleObjectCollision(cx, cy, radius, obj)) {
      // collision 모듈로 충돌 박스 계산 (월드 좌표 기반)
      const box = getObjectCollisionBox(
        obj.x,
        obj.y,
        obj.def.collisionWidth ?? obj.def.width,
        obj.def.collisionHeight ?? obj.def.height
      );

      // collision 모듈로 밀어내기 벡터 계산
      const push = calculatePushVector({ x: cx, y: cy, radius }, box);

      return {
        collided: true,
        object: obj,
        pushX: push.pushX,
        pushY: push.pushY,
      };
    }
  }

  return { collided: false };
}

/**
 * 특정 위치에 오브젝트가 있는지 확인 (점)
 *
 * v7.25: collision 모듈 사용으로 리팩토링
 * - getObjectCollisionBox: 월드 좌표 기반 충돌 박스 계산
 * - isPointInBox: 점이 박스 안에 있는지 확인
 *
 * ⚠️ 렌더링 오프셋(screenY -= height * 0.85)은 절대 여기서 사용하지 마세요!
 */
export function isObjectAt(
  x: number,
  y: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): boolean {
  const col = Math.floor(x / GRID_SIZE);
  const row = Math.floor(y / GRID_SIZE);

  // 주변 3x3 그리드 검사
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const obj = getObjectAtGrid(col + dc, row + dr, stageId, gameMode, seed);
      if (obj && obj.def.hasCollision) {
        // collision 모듈로 충돌 박스 계산 (월드 좌표 기반)
        const box = getObjectCollisionBox(
          obj.x,
          obj.y,
          obj.def.collisionWidth ?? obj.def.width,
          obj.def.collisionHeight ?? obj.def.height
        );

        // 점이 박스 안에 있는지 확인
        if (isPointInBox(x, y, box)) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================
// Object Rendering Helpers
// ============================================

/**
 * 오브젝트 정의 가져오기
 */
export function getObjectDef(type: MapObjectType): MapObjectDef {
  return MAP_OBJECT_DEFS[type];
}

/**
 * 바이옴에서 허용된 오브젝트 목록
 */
export function getAllowedObjectsForBiome(biome: BiomeType): MapObjectType[] {
  return Object.entries(MAP_OBJECT_DEFS)
    .filter(([_, def]) => !def.allowedBiomes || def.allowedBiomes.includes(biome))
    .map(([type]) => type as MapObjectType);
}
