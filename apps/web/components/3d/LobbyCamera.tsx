'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * 로비 공전 카메라 — 마인크래프트 지형 조감용
 * radius=350, height=180 + bob, 0.05 rad/s
 * fog 300-1000 (산악 지대 보이게)
 */
export function LobbyCamera() {
  const { camera, scene } = useThree()
  const angleRef = useRef(0)

  useEffect(() => {
    scene.fog = new THREE.Fog('#87CEEB', 300, 1000)
  }, [scene])

  useFrame((_, delta) => {
    angleRef.current += delta * 0.05
    const t = angleRef.current
    const r = 350
    const h = 180 + Math.sin(t * 0.3) * 12
    camera.position.set(Math.cos(t) * r, h, Math.sin(t) * r)
    camera.lookAt(0, 20, 0)
  })

  return null
}
