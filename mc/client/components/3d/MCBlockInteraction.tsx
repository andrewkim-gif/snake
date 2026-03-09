'use client'

// 블록 상호작용: 레이캐스팅으로 블록 파괴/배치 + 하이라이트
// 좌클릭: 파괴, 우클릭: 배치

import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BlockType,
  INTERACTION_RANGE,
  PLAYER_HEIGHT,
  blockKey,
  type CustomBlock,
} from '@/lib/3d/mc-types'
import { highlightMaterial } from '@/lib/3d/mc-materials'
import type { BlockInstance } from '@/lib/3d/mc-terrain-worker'

interface MCBlockInteractionProps {
  locked: boolean
  heldBlock: BlockType
  terrainBlocks: BlockInstance[]
  terrainIdMap: Record<string, number>
  onBlockPlace: (block: CustomBlock) => void
  onBlockRemove: (x: number, y: number, z: number) => void
}

export default function MCBlockInteraction({
  locked,
  heldBlock,
  terrainBlocks,
  terrainIdMap,
  onBlockPlace,
  onBlockRemove,
}: MCBlockInteractionProps) {
  const { camera, scene } = useThree()
  const highlightRef = useRef<THREE.Mesh>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseHoldRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 레이캐스터 설정
  useEffect(() => {
    raycasterRef.current.far = INTERACTION_RANGE
  }, [])

  // 교차점 계산용 임시 InstancedMesh (화면 중앙에서 레이캐스팅)
  const findTargetBlock = useCallback((): {
    position: THREE.Vector3
    normal: THREE.Vector3
    blockIndex: number
  } | null => {
    const raycaster = raycasterRef.current
    // 화면 중앙 (크로스헤어)
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

    // scene의 모든 InstancedMesh에서 교차점 검색
    const meshes: THREE.InstancedMesh[] = []
    scene.traverse((child) => {
      if (
        child instanceof THREE.InstancedMesh &&
        child !== highlightRef.current
      ) {
        meshes.push(child)
      }
    })

    let closest: THREE.Intersection | null = null

    for (const mesh of meshes) {
      const intersects = raycaster.intersectObject(mesh, false)
      if (intersects.length > 0) {
        if (!closest || intersects[0].distance < closest.distance) {
          closest = intersects[0]
        }
      }
    }

    if (!closest || !closest.face) return null

    // 블록 중심 좌표 계산
    const point = closest.point
    const normal = closest.face.normal.clone()

    // 히트 포인트에서 약간 안쪽으로 이동하여 블록 좌표 결정
    const blockPos = new THREE.Vector3(
      Math.round(point.x - normal.x * 0.5),
      Math.round(point.y - normal.y * 0.5),
      Math.round(point.z - normal.z * 0.5)
    )

    const key = blockKey(blockPos.x, blockPos.y, blockPos.z)
    const idx = terrainIdMap[key]

    return {
      position: blockPos,
      normal,
      blockIndex: idx ?? -1,
    }
  }, [camera, scene, terrainIdMap])

  // 하이라이트 업데이트
  useFrame(() => {
    if (!locked || !highlightRef.current) {
      if (highlightRef.current) highlightRef.current.visible = false
      return
    }

    const target = findTargetBlock()
    if (target) {
      highlightRef.current.position.copy(target.position)
      highlightRef.current.visible = true
    } else {
      highlightRef.current.visible = false
    }
  })

  // 마우스 클릭 핸들러
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!locked) return

      const action = () => {
        const target = findTargetBlock()
        if (!target) return

        if (e.button === 0) {
          // 좌클릭: 블록 파괴
          const { position } = target

          // 베드록은 파괴 불가
          const key = blockKey(position.x, position.y, position.z)
          const idx = terrainIdMap[key]
          if (idx !== undefined) {
            const block = terrainBlocks[idx]
            if (block && block.type === BlockType.bedrock) return
          }

          onBlockRemove(position.x, position.y, position.z)
        } else if (e.button === 2) {
          // 우클릭: 블록 배치
          const placePos = new THREE.Vector3(
            Math.round(target.position.x + target.normal.x),
            Math.round(target.position.y + target.normal.y),
            Math.round(target.position.z + target.normal.z)
          )

          // 플레이어 위치와 겹치는지 확인
          const playerBlockY1 = Math.round(
            camera.position.y - PLAYER_HEIGHT
          )
          const playerBlockY2 = Math.round(camera.position.y)
          const playerX = Math.round(camera.position.x)
          const playerZ = Math.round(camera.position.z)

          if (
            placePos.x === playerX &&
            placePos.z === playerZ &&
            (placePos.y === playerBlockY1 || placePos.y === playerBlockY2)
          ) {
            return // 플레이어 위치에는 배치 불가
          }

          onBlockPlace({
            x: placePos.x,
            y: placePos.y,
            z: placePos.z,
            type: heldBlock,
            placed: true,
          })
        }
      }

      action()

      // 길게 누르면 반복 실행 (333ms 간격)
      if (e.button === 0) {
        mouseHoldRef.current = setInterval(action, 333)
      }
    },
    [
      locked,
      findTargetBlock,
      terrainIdMap,
      terrainBlocks,
      heldBlock,
      camera,
      onBlockPlace,
      onBlockRemove,
    ]
  )

  const handleMouseUp = useCallback(() => {
    if (mouseHoldRef.current) {
      clearInterval(mouseHoldRef.current)
      mouseHoldRef.current = null
    }
  }, [])

  // 우클릭 컨텍스트 메뉴 방지
  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    if (locked) {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('contextmenu', handleContextMenu)
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('contextmenu', handleContextMenu)
      if (mouseHoldRef.current) {
        clearInterval(mouseHoldRef.current)
      }
    }
  }, [locked, handleMouseDown, handleMouseUp, handleContextMenu])

  return (
    <mesh ref={highlightRef} visible={false} material={highlightMaterial}>
      <boxGeometry args={[1.01, 1.01, 1.01]} />
    </mesh>
  )
}
