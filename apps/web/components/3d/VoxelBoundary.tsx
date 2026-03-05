'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { createBedrockTexture } from '../../lib/3d/voxel-textures'

interface VoxelBoundaryProps {
  radius: number
}

/** 마크 스타일 베드록 벽 — 3블록(24유닛) 높이 원통 */
export function VoxelBoundary({ radius }: VoxelBoundaryProps) {
  const texture = useMemo(() => {
    const tex = createBedrockTexture()
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(64, 3)
    return tex
  }, [])

  return (
    <mesh position={[0, 12, 0]}>
      <cylinderGeometry args={[radius + 2, radius + 2, 24, 64, 1, true]} />
      <meshLambertMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  )
}
