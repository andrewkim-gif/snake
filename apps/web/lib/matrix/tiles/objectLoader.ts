/**
 * game/tiles/objectLoader.ts - 맵 오브젝트 스프라이트 로더
 *
 * v7.2: Object + StreetLamp 시리즈만 사용
 * - Object1-28: 다양한 소품 (배럴, 상자, 바위 등)
 * - StreetLamp 1-2: 가로등
 */

import type { TileDirection } from './loader';

// ============================================
// Object Sprite Types
// ============================================

// Object 시리즈 (Object1-28)
export type ObjectType =
  | 'Object1' | 'Object2' | 'Object3' | 'Object4' | 'Object5'
  | 'Object6' | 'Object7' | 'Object8' | 'Object9' | 'Object10'
  | 'Object11' | 'Object12' | 'Object13' | 'Object14' | 'Object15'
  | 'Object16' | 'Object17' | 'Object18' | 'Object19' | 'Object20'
  | 'Object21' | 'Object22' | 'Object23' | 'Object24' | 'Object25'
  | 'Object26' | 'Object27' | 'Object28';

// StreetLamp 시리즈
export type StreetLampType = 'StreetLamp1' | 'StreetLamp2';

// 모든 오브젝트 스프라이트 타입
export type ObjectSpriteType = ObjectType | StreetLampType;

// 스프라이트 이미지 캐시
const objectSpriteCache: Map<string, HTMLImageElement> = new Map();

// 로딩 상태
let isLoading = false;
let isLoaded = false;

// ============================================
// Biome-Specific Object Lists
// ============================================

// 잔디 바이옴 오브젝트 (자연스러운 소품들)
export const GRASS_OBJECTS: ObjectSpriteType[] = [
  'Object1', 'Object2', 'Object3', 'Object4', 'Object5',
  'Object6', 'Object7', 'Object8', 'Object9', 'Object10',
];

// 돌/바위 바이옴 오브젝트
export const STONE_OBJECTS: ObjectSpriteType[] = [
  'Object11', 'Object12', 'Object13', 'Object14', 'Object15',
  'Object1', 'Object2', 'Object3',
];

// 콘크리트/도시 바이옴 오브젝트 (가로등 포함)
export const CONCRETE_OBJECTS: ObjectSpriteType[] = [
  'Object16', 'Object17', 'Object18', 'Object19', 'Object20',
  'Object21', 'Object22', 'Object23', 'Object24', 'Object25',
  'StreetLamp1', 'StreetLamp2',
];

// 특수 바이옴 오브젝트
export const SPECIAL_OBJECTS: ObjectSpriteType[] = [
  'Object23', 'Object24', 'Object25', 'Object26', 'Object27', 'Object28',
];

// Matrix/Void 바이옴 오브젝트 (특수 + 가로등)
export const VOID_OBJECTS: ObjectSpriteType[] = [
  'Object26', 'Object27', 'Object28',
  'StreetLamp1', 'StreetLamp2',
];

// ============================================
// Sprite Loading
// ============================================

/**
 * 스프라이트 캐시 키 생성
 */
function getSpriteCacheKey(type: string, direction: TileDirection): string {
  return `${type}_${direction}`;
}

/**
 * 스프라이트 이미지 경로 생성
 */
function getSpriteImagePath(type: string, direction: TileDirection): string {
  let filename: string;

  if (type.startsWith('StreetLamp')) {
    // StreetLamp1 -> "StreetLamp 1"
    const num = type.replace('StreetLamp', '');
    filename = `StreetLamp ${num}_${direction}.png`;
  } else {
    // Object1 -> "Object1"
    filename = `${type}_${direction}.png`;
  }

  return `./assets/tile/${encodeURIComponent(filename)}`;
}

/**
 * 단일 이미지 로드
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

/**
 * 모든 오브젝트 스프라이트 로드
 */
export async function loadAllObjectSprites(): Promise<void> {
  if (isLoaded || isLoading) return;
  isLoading = true;

  // 모든 오브젝트 타입 수집
  const allObjects = new Set<string>([
    ...GRASS_OBJECTS,
    ...STONE_OBJECTS,
    ...CONCRETE_OBJECTS,
    ...SPECIAL_OBJECTS,
    ...VOID_OBJECTS,
  ]);

  const directions: TileDirection[] = ['N', 'E', 'S', 'W'];
  const loadPromises: Promise<void>[] = [];
  const objectsArray = Array.from(allObjects);

  for (const objType of objectsArray) {
    for (const dir of directions) {
      const key = getSpriteCacheKey(objType, dir);
      const path = getSpriteImagePath(objType, dir);

      loadPromises.push(
        loadImage(path)
          .then(img => {
            objectSpriteCache.set(key, img);
          })
          .catch(() => {
            // 일부 방향은 없을 수 있음 (silent fail)
          })
      );
    }
  }

  await Promise.all(loadPromises);
  isLoaded = true;
  isLoading = false;
  console.log(`[ObjectLoader v7.2] Loaded ${objectSpriteCache.size} object sprites (Object + StreetLamp)`);
}

/**
 * 오브젝트 스프라이트 가져오기
 */
export function getObjectSprite(type: string, direction: TileDirection = 'N'): HTMLImageElement | null {
  const key = getSpriteCacheKey(type, direction);
  return objectSpriteCache.get(key) || null;
}

/**
 * 스프라이트 로드 상태 확인
 */
export function areObjectSpritesLoaded(): boolean {
  return isLoaded;
}

// ============================================
// Biome-based Object Selection
// ============================================

/**
 * 바이옴에 따른 랜덤 오브젝트 타입 선택
 */
export function getRandomObjectForBiome(
  biome: string,
  seedValue: number
): ObjectSpriteType | null {
  let objectList: ObjectSpriteType[];

  switch (biome) {
    case 'grass':
      objectList = GRASS_OBJECTS;
      break;
    case 'stone':
      objectList = STONE_OBJECTS;
      break;
    case 'concrete':
      objectList = CONCRETE_OBJECTS;
      break;
    case 'special':
      objectList = SPECIAL_OBJECTS;
      break;
    case 'void':
      objectList = VOID_OBJECTS;
      break;
    default:
      objectList = GRASS_OBJECTS;
  }

  if (objectList.length === 0) return null;

  // 시드 기반 선택
  const index = Math.floor(Math.abs(seedValue) % objectList.length);
  return objectList[index];
}

/**
 * 오브젝트가 충돌 가능한지 확인
 * v7.32: 모든 오브젝트는 무조건 충돌 있음
 *        (맵에 보이는 구조물은 당연히 막아야 함)
 *        장식용 요소는 별도 시스템으로 처리 (오브젝트 스폰 밀도로 조절)
 */
export function hasCollision(_type: ObjectSpriteType): boolean {
  // 모든 오브젝트는 충돌 있음
  return true;
}

/**
 * 오브젝트 크기 가져오기 (렌더링용)
 */
export function getObjectSize(type: ObjectSpriteType): { width: number; height: number } {
  // 가로등 - 세로로 긴 형태
  if (type.startsWith('StreetLamp')) {
    return { width: 64, height: 192 };
  }

  // Object 번호에 따라 크기 결정
  const num = parseInt(type.replace('Object', ''));

  if (num <= 5) {
    // 작은 소품
    return { width: 64, height: 64 };
  } else if (num <= 15) {
    // 중간 소품
    return { width: 96, height: 96 };
  } else if (num <= 22) {
    // 큰 소품
    return { width: 128, height: 128 };
  } else {
    // 대형 구조물
    return { width: 128, height: 192 };
  }
}

/**
 * 오브젝트 충돌 영역 비율 가져오기
 * v7.18: 스프라이트 크기 대비 실제 충돌 영역 비율
 * - 충돌 박스는 스프라이트 "발" 위치에서 위로 확장
 * - 너비/높이 비율이 작을수록 좁은 충돌 영역
 */
export function getCollisionRatio(type: ObjectSpriteType): { widthRatio: number; heightRatio: number } {
  // 가로등 - 아주 좁은 충돌 (기둥만)
  if (type.startsWith('StreetLamp')) {
    return { widthRatio: 0.2, heightRatio: 0.15 };
  }

  const num = parseInt(type.replace('Object', ''));

  if (num <= 5) {
    // 작은 소품 - 전체 영역의 60%
    return { widthRatio: 0.6, heightRatio: 0.5 };
  } else if (num <= 15) {
    // 중간 소품 (나무/바위) - 발 근처만 (줄기/바닥)
    return { widthRatio: 0.4, heightRatio: 0.3 };
  } else if (num <= 22) {
    // 큰 소품 - 발 근처만
    return { widthRatio: 0.35, heightRatio: 0.25 };
  } else {
    // 대형 구조물 - 기둥/하단만
    return { widthRatio: 0.3, heightRatio: 0.2 };
  }
}
