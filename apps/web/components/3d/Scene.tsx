'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

/** 씬 환경 설정: 조명 + 안개 + 배경색 */
export function Scene() {
  const { scene } = useThree()

  useEffect(() => {
    scene.background = new THREE.Color('#87CEEB')
    // fog end를 camera.far(1500) 이하로 설정 — 원거리 렌더링 부하 감소
    scene.fog = new THREE.Fog('#87CEEB', 400, 1200)
  }, [scene])

  return (
    <>
      {/* 마크 스타일 면별 라이팅 재현: 강한 디렉셔널 + 약한 앰비언트 */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[100, 150, 80]}
        intensity={0.85}
        castShadow={false}
      />
    </>
  )
}
