'use client'

// Minecraft 씬 설정: 조명 + 안개 + 하늘

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { MC_RENDER_DISTANCE, MC_CHUNK_SIZE } from '@/lib/3d/mc-types'

const SKY_COLOR = 0x87ceeb
const FOG_NEAR = 1
const FOG_FAR = MC_RENDER_DISTANCE * MC_CHUNK_SIZE + MC_CHUNK_SIZE

export default function MCScene() {
  const { scene } = useThree()

  useEffect(() => {
    scene.background = new THREE.Color(SKY_COLOR)
    scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR)

    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene])

  return (
    <>
      {/* 방향광 */}
      <pointLight position={[500, 500, 500]} intensity={0.5} />
      <pointLight position={[-500, 500, -500]} intensity={0.2} />
      {/* 환경광 */}
      <ambientLight color={0x404040} intensity={1} />
    </>
  )
}
