/**
 * game/sprites/loader.ts - 8방향 스프라이트 로더
 * 모든 캐릭터의 방향별 이미지를 프리로드하고 캐시
 */

import { PlayerClass } from '../types';
import { CharacterDirection8Sprites, SpriteLoadingState, Direction8ImageKey } from './types';

// 캐릭터별 스프라이트 캐시
const spriteCache = new Map<PlayerClass, CharacterDirection8Sprites>();

// 로딩 상태
let loadingState: SpriteLoadingState = { total: 0, loaded: 0, failed: [] };

// 지원하는 캐릭터 목록
const CHARACTERS: PlayerClass[] = [
  'neo', 'trinity', 'morpheus', 'tank', 'cypher',
  'niobe', 'oracle', 'mouse', 'dozer'
];

// 방향별 이미지 파일 키 (캐릭터 이름으로 치환됨)
const IMAGE_KEYS: Direction8ImageKey[] = [
  'front',
  'back',
  'side_left',
  'back_side_left',
  'front_side_left'
];

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
 * 단일 캐릭터의 모든 방향 이미지 로드
 */
async function loadCharacterSprites(characterId: PlayerClass): Promise<CharacterDirection8Sprites | null> {
  const basePath = `/assets/cha/${characterId}`;
  const sprites: Partial<CharacterDirection8Sprites> = {};

  try {
    const promises = IMAGE_KEYS.map(async (key) => {
      const src = `${basePath}/${characterId}_${key}.png`;
      sprites[key] = await loadImage(src);
      loadingState.loaded++;
    });

    await Promise.all(promises);
    return sprites as CharacterDirection8Sprites;
  } catch {
    loadingState.failed.push(characterId);
    // 8방향 스프라이트 로드 실패는 정상 - drawCatSprite로 폴백됨
    return null;
  }
}

/**
 * 모든 캐릭터 스프라이트 프리로드
 * @param onProgress 진행률 콜백 (0-100)
 * @returns Promise<void>
 */
export async function preloadAllCharacterSprites(
  onProgress?: (percent: number) => void
): Promise<void> {
  // 이미 로드 완료된 경우 스킵
  if (spriteCache.size === CHARACTERS.length) {
    onProgress?.(100);
    return;
  }

  // 초기화
  spriteCache.clear();
  loadingState = {
    total: CHARACTERS.length * IMAGE_KEYS.length,
    loaded: 0,
    failed: []
  };

  const updateProgress = () => {
    if (onProgress) {
      const percent = Math.round((loadingState.loaded / loadingState.total) * 100);
      onProgress(percent);
    }
  };

  // 병렬 로드
  const loadPromises = CHARACTERS.map(async (charId) => {
    const sprites = await loadCharacterSprites(charId);
    if (sprites) {
      spriteCache.set(charId, sprites);
    }
    updateProgress();
  });

  await Promise.all(loadPromises);

  // 로그 제거 - 8방향 스프라이트 없으면 drawCatSprite 폴백 사용
}

/**
 * 특정 캐릭터의 스프라이트만 로드 (지연 로딩용)
 */
export async function loadCharacterSpritesIfNeeded(characterId: PlayerClass): Promise<boolean> {
  if (spriteCache.has(characterId)) {
    return true;
  }

  const sprites = await loadCharacterSprites(characterId);
  if (sprites) {
    spriteCache.set(characterId, sprites);
    return true;
  }
  return false;
}

/**
 * 캐릭터 스프라이트 가져오기
 */
export function getCharacterSprites(characterId: PlayerClass): CharacterDirection8Sprites | undefined {
  return spriteCache.get(characterId);
}

/**
 * 스프라이트 로드 여부 확인
 */
export function isSpritesLoaded(characterId: PlayerClass): boolean {
  return spriteCache.has(characterId);
}

/**
 * 모든 스프라이트 로드 완료 여부
 */
export function isAllSpritesLoaded(): boolean {
  return spriteCache.size === CHARACTERS.length;
}

/**
 * 로딩 상태 반환
 */
export function getLoadingState(): SpriteLoadingState {
  return { ...loadingState };
}

/**
 * 캐시 초기화 (테스트/리로드용)
 */
export function clearSpriteCache(): void {
  spriteCache.clear();
  loadingState = { total: 0, loaded: 0, failed: [] };
}
