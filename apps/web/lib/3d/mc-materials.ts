// Minecraft 블록 머티리얼 (텍스처 로딩 + 캐시)
// InstancedMesh 호환을 위해 단일 머티리얼 사용

import * as THREE from 'three'
import { BlockType } from './mc-types'

const TEX_PATH = '/textures/blocks/'

// 픽셀 아트 텍스처 로더
const loader = new THREE.TextureLoader()

function loadTex(name: string): THREE.Texture {
  const tex = loader.load(`${TEX_PATH}${name}.png`)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// 캐시된 머티리얼
const materialCache = new Map<BlockType, THREE.Material>()

function makeMat(name: string, transparent = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: loadTex(name),
    transparent,
    opacity: transparent ? 0.8 : 1.0,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
    roughness: 1.0,
    metalness: 0,
  })
}

// 6면 머티리얼 배열 (일반 Mesh용)
export function getSixFaceMaterial(
  side: string,
  top: string,
  bottom: string
): THREE.MeshStandardMaterial[] {
  return [
    makeMat(side),   // +x
    makeMat(side),   // -x
    makeMat(top),    // +y
    makeMat(bottom), // -y
    makeMat(side),   // +z
    makeMat(side),   // -z
  ]
}

// InstancedMesh용 단일 머티리얼 (블록 타입별 대표 텍스처)
export function getBlockMaterial(type: BlockType): THREE.Material {
  if (materialCache.has(type)) return materialCache.get(type)!

  let mat: THREE.Material

  switch (type) {
    case BlockType.grass:
      mat = makeMat('grass_top_green') // TPS 카메라에서 상단면이 가장 잘 보임
      break
    case BlockType.tree:
      mat = makeMat('oak_log')
      break
    case BlockType.sand:
      mat = makeMat('sand')
      break
    case BlockType.leaf:
      mat = makeMat('oak_leaves', true)
      break
    case BlockType.dirt:
      mat = makeMat('dirt')
      break
    case BlockType.stone:
      mat = makeMat('stone')
      break
    case BlockType.coal:
      mat = makeMat('coal_ore')
      break
    case BlockType.wood:
      mat = makeMat('oak_planks')
      break
    case BlockType.diamond:
      mat = makeMat('diamond_block')
      break
    case BlockType.quartz:
      mat = makeMat('quartz_block_side')
      break
    case BlockType.glass:
      mat = makeMat('glass', true)
      break
    case BlockType.bedrock:
      mat = makeMat('bedrock')
      break
    default:
      mat = makeMat('stone')
  }

  materialCache.set(type, mat)
  return mat
}

// 하이라이트 머티리얼 (블록 선택 표시)
export const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
})

// 머티리얼 정리
export function disposeMaterials() {
  materialCache.forEach((mat) => mat.dispose())
  materialCache.clear()
}
