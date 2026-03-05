'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type { MutableRefObject } from 'react'

interface PlayCameraProps {
  cameraTargetRef: MutableRefObject<{ x: number; z: number; mass: number }>
}

/**
 * 플레이어 추적 카메라 (기존 camera.ts 로직 3D 변환)
 * - lerp 기반 부드러운 추적
 * - mass에 따른 동적 줌아웃
 * - 틸트 ~55° 퍼스펙티브
 */
export function PlayCamera({ cameraTargetRef }: PlayCameraProps) {
  const { camera } = useThree()
  const initialized = useRef(false)

  useFrame((_, delta) => {
    const { x: targetX, z: targetZ, mass } = cameraTargetRef.current

    // dt 기반 프레임 독립 lerp (기존 camera.ts 공식 그대로)
    const posSmooth = 1 - Math.pow(1 - 0.15, delta * 60)
    const zoomSmooth = 1 - Math.pow(1 - 0.08, delta * 60)

    // 동적 줌 — mass가 클수록 멀리 (기존 공식)
    const targetZoom = Math.max(0.35, Math.min(1.0, 1.0 - Math.pow(mass, 0.4) * 0.03))

    // 3D 카메라 높이/거리 (camera.far=1500 범위 내)
    const height = 300 / targetZoom
    const behind = 180 / targetZoom

    const desiredX = targetX
    const desiredY = height
    const desiredZ = targetZ + behind

    if (!initialized.current) {
      camera.position.set(desiredX, desiredY, desiredZ)
      initialized.current = true
    } else {
      camera.position.x += (desiredX - camera.position.x) * posSmooth
      camera.position.y += (desiredY - camera.position.y) * zoomSmooth
      camera.position.z += (desiredZ - camera.position.z) * posSmooth
    }

    camera.lookAt(targetX, 0, targetZ)
  }) // GameLoop보다 뒤 JSX 위치 → 게임 상태 업데이트 후 실행

  return null
}
