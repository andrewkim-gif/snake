// Minecraft 블록 머티리얼 (텍스처 로딩 + 캐시)
// InstancedMesh 호환을 위해 단일 머티리얼 + 6면 머티리얼 지원

import * as THREE from 'three'
import { BlockType, BLOCK_TEXTURE_MAP, type BlockTextureFaces } from './mc-types'

// ---------------------------------------------------------------------------
// 텍스처 로더 (NearestFilter = 픽셀아트 스타일)
// ---------------------------------------------------------------------------
const loader = new THREE.TextureLoader()

/** 텍스처 로딩 + 픽셀아트 필터 설정 */
function loadTex(path: string): THREE.Texture {
  const tex = loader.load(path)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------------------------------------------------------------------------
// 텍스처 캐시 (경로 → Texture)
// ---------------------------------------------------------------------------
const textureCache = new Map<string, THREE.Texture>()

function getCachedTexture(path: string): THREE.Texture {
  if (textureCache.has(path)) return textureCache.get(path)!
  const tex = loadTex(path)
  textureCache.set(path, tex)
  return tex
}

// ---------------------------------------------------------------------------
// MeshLambertMaterial 생성 (가벼운 조명 반응)
// ---------------------------------------------------------------------------
function makeLambertMat(
  texturePath: string,
  options?: { transparent?: boolean; color?: THREE.ColorRepresentation }
): THREE.MeshLambertMaterial {
  const tex = getCachedTexture(texturePath)
  return new THREE.MeshLambertMaterial({
    map: tex,
    transparent: options?.transparent ?? false,
    opacity: options?.transparent ? 0.8 : 1.0,
    side: options?.transparent ? THREE.DoubleSide : THREE.FrontSide,
    color: options?.color,
  })
}

/** MeshStandardMaterial 생성 (더 높은 품질) */
function makeStandardMat(
  texturePath: string,
  options?: { transparent?: boolean; color?: THREE.ColorRepresentation }
): THREE.MeshStandardMaterial {
  const tex = getCachedTexture(texturePath)
  return new THREE.MeshStandardMaterial({
    map: tex,
    transparent: options?.transparent ?? false,
    opacity: options?.transparent ? 0.8 : 1.0,
    side: options?.transparent ? THREE.DoubleSide : THREE.FrontSide,
    roughness: 1.0,
    metalness: 0,
    color: options?.color,
  })
}

// ---------------------------------------------------------------------------
// 단일 머티리얼 캐시 (InstancedMesh용)
// ---------------------------------------------------------------------------
const materialCache = new Map<BlockType, THREE.Material>()

/**
 * createBlockMaterial — 블록 타입별 MeshLambertMaterial 생성/캐시
 * InstancedMesh에서 사용 (단일 텍스처 = 성능 우선)
 */
export function createBlockMaterial(type: BlockType): THREE.MeshLambertMaterial {
  if (materialCache.has(type)) return materialCache.get(type) as THREE.MeshLambertMaterial

  const texMap = BLOCK_TEXTURE_MAP[type as Exclude<BlockType, BlockType.AIR>]
  if (!texMap) {
    // AIR 등 텍스처 없는 타입 폴백
    const fallback = new THREE.MeshLambertMaterial({ color: 0xff00ff })
    materialCache.set(type, fallback)
    return fallback
  }

  const isTransparent = type === BlockType.glass || type === BlockType.leaf
  const color = type === BlockType.leaf ? new THREE.Color(0.2, 0.8, 0.2) : undefined

  // TPS 카메라에서 상단면이 가장 잘 보이므로 top 텍스처 사용
  const mat = makeLambertMat(texMap.top, { transparent: isTransparent, color })
  materialCache.set(type, mat)
  return mat
}

/**
 * getBlockMaterial — createBlockMaterial 별칭 (하위 호환)
 */
export function getBlockMaterial(type: BlockType): THREE.Material {
  return createBlockMaterial(type)
}

// ---------------------------------------------------------------------------
// 6면 머티리얼 (일반 Mesh 박스용)
// ---------------------------------------------------------------------------

/**
 * getSixFaceMaterial — 6면 각각 다른 텍스처의 MeshStandardMaterial 배열
 * [+x, -x, +y, -y, +z, -z] 순서
 */
export function getSixFaceMaterial(
  side: string,
  top: string,
  bottom: string,
): THREE.MeshStandardMaterial[] {
  return [
    makeStandardMat(side),   // +x (east)
    makeStandardMat(side),   // -x (west)
    makeStandardMat(top),    // +y (top)
    makeStandardMat(bottom), // -y (bottom)
    makeStandardMat(side),   // +z (south)
    makeStandardMat(side),   // -z (north)
  ]
}

/**
 * getSixFaceMaterialForBlock — BlockType으로 6면 머티리얼 생성
 */
export function getSixFaceMaterialForBlock(
  type: Exclude<BlockType, BlockType.AIR>,
): THREE.MeshStandardMaterial[] {
  const texMap = BLOCK_TEXTURE_MAP[type]
  return getSixFaceMaterial(texMap.side, texMap.top, texMap.bottom)
}

// ---------------------------------------------------------------------------
// 하이라이트 머티리얼 (블록 선택 표시)
// ---------------------------------------------------------------------------
export const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
})

// ---------------------------------------------------------------------------
// Dispose 유틸리티
// ---------------------------------------------------------------------------

/** 모든 캐시된 머티리얼 + 텍스처 해제 */
export function disposeMaterials(): void {
  materialCache.forEach((mat) => {
    mat.dispose()
  })
  materialCache.clear()

  textureCache.forEach((tex) => {
    tex.dispose()
  })
  textureCache.clear()
}

/** 특정 블록 타입의 머티리얼만 해제 */
export function disposeBlockMaterial(type: BlockType): void {
  const mat = materialCache.get(type)
  if (mat) {
    mat.dispose()
    materialCache.delete(type)
  }
}
