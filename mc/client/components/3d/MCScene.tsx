'use client'

// Minecraft 씬 설정: 조명 + 안개 + 하늘
// AmbientLight (0.6) + DirectionalLight (0.8) + Fog (하늘색)

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { MC_RENDER_DISTANCE, MC_CHUNK_SIZE } from '@/lib/3d/mc-types'

const SKY_COLOR = 0x87ceeb
const FOG_NEAR = 50
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
      {/* 환경광: 전체적으로 고른 밝기 */}
      <ambientLight intensity={0.6} />

      {/* 방향광: 태양 역할 (우상단 앞에서 비춤) */}
      <directionalLight
        position={[100, 200, 100]}
        intensity={0.8}
        color={0xffffff}
      />
    </>
  )
}
