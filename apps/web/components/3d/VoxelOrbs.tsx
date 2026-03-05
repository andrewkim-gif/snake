'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { GameData } from '../../hooks/useSocket'

interface VoxelOrbsProps {
  dataRef: MutableRefObject<GameData>
}

const MAX_ORBS = 2000
const _obj = new THREE.Object3D()
const _color = new THREE.Color()

// 마크 보석 블록 컬러 팔레트
const ORB_COLORS = [
  '#4488FF', // 다이아몬드
  '#44DD44', // 에메랄드
  '#FFD700', // 금
  '#FF4444', // 레드스톤
  '#AA44FF', // 자수정
  '#FF8844', // 구리
  '#44FFDD', // 프리즈마린
  '#FF88AA', // 석영
]

/**
 * 전체 오브를 1개 InstancedMesh로 렌더링
 * 회전 + 부유 애니메이션 (마크 드랍 아이템 스타일)
 */
export function VoxelOrbs({ dataRef }: VoxelOrbsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const timeRef = useRef(0)

  // DynamicDrawUsage 설정 (검증 반영: 매 프레임 업데이트 최적화)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    timeRef.current += delta

    const orbs = dataRef.current.latestState?.o ?? []
    const t = timeRef.current
    const count = Math.min(orbs.length, MAX_ORBS)
    meshRef.current.count = count

    for (let i = 0; i < count; i++) {
      const orb = orbs[i]

      // 부유 높이
      const floatY = 3 + Math.sin(t * 2 + i * 0.7) * 1.5
      // 회전
      const rotY = t * 1.5 + i * 0.3

      // value 기반 크기
      const scale = 2.5 + Math.min(orb.v / 15, 3)

      _obj.position.set(orb.x, floatY, orb.y)
      _obj.rotation.set(0, rotY, 0)
      _obj.scale.setScalar(scale)
      _obj.updateMatrix()
      meshRef.current.setMatrixAt(i, _obj.matrix)

      // 색상
      _color.set(ORB_COLORS[orb.c % ORB_COLORS.length])
      meshRef.current.setColorAt(i, _color)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  }, 0)

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_ORBS]}
      frustumCulled={false}
    />
  )
}
