'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { createGrassTexture } from '../../lib/3d/voxel-textures'

interface VoxelTerrainProps {
  radius: number
}

/**
 * 마크 스타일 잔디 바닥
 * 최적화: InstancedMesh 대신 단일 CircleGeometry + NearestFilter 타일링
 * → 1 드로우콜, ~256 버텍스
 */
export function VoxelTerrain({ radius }: VoxelTerrainProps) {
  const texture = useMemo(() => {
    const tex = createGrassTexture()
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(radius / 4, radius / 4)
    return tex
  }, [radius])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <circleGeometry args={[radius, 128]} />
      <meshLambertMaterial map={texture} />
    </mesh>
  )
}
