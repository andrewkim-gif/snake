'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

/** 마크 스타일 하늘 반구 + 간단한 복셀 구름 */
export function SkyBox() {
  return (
    <>
      {/* 하늘 반구 — 씬 fog와 동일한 색으로 자연스럽게 연결 */}
      <mesh>
        <sphereGeometry args={[1400, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
      </mesh>
      <VoxelClouds />
    </>
  )
}

/** 복셀 구름 — 흰색 플랫 큐브 그룹, 천천히 이동 */
function VoxelClouds() {
  const cloudData = useMemo(() => {
    const clouds: { x: number; z: number; scaleX: number; scaleZ: number }[] = []
    // seeded positions (모든 클라이언트 동일)
    for (let i = 0; i < 15; i++) {
      clouds.push({
        x: ((i * 397 + 123) % 2000) - 1000,
        z: ((i * 571 + 89) % 2000) - 1000,
        scaleX: 30 + (i * 13) % 40,
        scaleZ: 20 + (i * 7) % 30,
      })
    }
    return clouds
  }, [])

  return (
    <group>
      {cloudData.map((c, i) => (
        <mesh key={i} position={[c.x, 400 + (i % 3) * 20, c.z]}>
          <boxGeometry args={[c.scaleX, 6, c.scaleZ]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  )
}
