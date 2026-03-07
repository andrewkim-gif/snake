'use client'

// Minecraft FPS 카메라 + 물리 + 충돌 감지
// PointerLockControls + WASD + 중력 + 점프 + 비행 모드

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PointerLockControls } from '@react-three/drei'
import {
  PlayerMode,
  PLAYER_SPEEDS,
  PLAYER_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_FALL_VELOCITY,
  MC_BASE_Y,
} from '@/lib/3d/mc-types'
import { MCNoise } from '@/lib/3d/mc-noise'
import type { BlockInstance } from '@/lib/3d/mc-terrain-worker'

interface MCCameraProps {
  seed: number
  locked: boolean
  onLock: () => void
  onUnlock: () => void
  mode: PlayerMode
  onModeChange: (mode: PlayerMode) => void
  terrainBlocks: BlockInstance[]
  terrainIdMap: Record<string, number>
}

export default function MCCamera({
  seed,
  locked,
  onLock,
  onUnlock,
  mode,
  onModeChange,
  terrainBlocks,
  terrainIdMap,
}: MCCameraProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const velocityRef = useRef(new THREE.Vector3())
  const keysRef = useRef<Set<string>>(new Set())
  const groundedRef = useRef(true) // 바닥에 서 있는지
  const noiseRef = useRef(new MCNoise(seed))
  const prevTimeRef = useRef(performance.now())

  useEffect(() => {
    noiseRef.current = new MCNoise(seed)
  }, [seed])

  // 초기 위치: 지형 위에 스폰
  useEffect(() => {
    const spawnY = MC_BASE_Y + noiseRef.current.getSurfaceOffset(8, 8) + 3
    camera.position.set(8, spawnY, 8)
  }, [camera])

  // 키보드 입력
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      keysRef.current.add(e.code)

      if (e.code === 'KeyQ') {
        const newMode =
          mode === PlayerMode.flying ? PlayerMode.walking : PlayerMode.flying
        onModeChange(newMode)
        velocityRef.current.y = 0
        groundedRef.current = false
      }

      if (
        e.code === 'Space' &&
        mode === PlayerMode.walking &&
        groundedRef.current
      ) {
        velocityRef.current.y = JUMP_VELOCITY
        groundedRef.current = false
      }
    },
    [mode, onModeChange]
  )

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.code)
  }, [])

  useEffect(() => {
    if (locked) {
      document.addEventListener('keydown', onKeyDown)
      document.addEventListener('keyup', onKeyUp)
    } else {
      keysRef.current.clear()
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [locked, onKeyDown, onKeyUp])

  // 해당 위치의 지표면 Y (블록 위 = 서 있을 수 있는 높이) 계산
  const getGroundY = useCallback(
    (px: number, pz: number): number => {
      const noise = noiseRef.current
      const bx = Math.round(px)
      const bz = Math.round(pz)
      const surfaceY = MC_BASE_Y + noise.getSurfaceOffset(bx, bz)

      // idMap에서 해당 x,z 칼럼의 가장 높은 블록 찾기
      // 단순화: 노이즈 기반 지표면 + 나무 체크
      let maxY = surfaceY

      // 나무 체크 (trunk)
      const treeOffset = noise.getTreeOffset(bx, bz)
      const stoneOffset = noise.getStoneOffset(bx, bz)
      const yOffset = noise.getSurfaceOffset(bx, bz)
      if (
        treeOffset > noise.treeThreshold &&
        yOffset >= -3 &&
        stoneOffset <= noise.stoneThreshold
      ) {
        // 나무가 있는 위치면 trunk 꼭대기가 ground
        maxY = Math.max(maxY, surfaceY + 10) // MC_TREE_HEIGHT
      }

      // 커스텀 블록도 체크 (idMap에서 이 x,z 칼럼의 블록들)
      // 현재 플레이어 발 아래의 블록만 체크
      const feetY = Math.round(camera.position.y - PLAYER_HEIGHT)
      for (let checkY = feetY; checkY >= feetY - 2; checkY--) {
        const key = `${bx}_${checkY}_${bz}`
        if (terrainIdMap[key] !== undefined) {
          maxY = Math.max(maxY, checkY)
          break
        }
      }

      return maxY
    },
    [camera, terrainIdMap]
  )

  // 물리 업데이트
  useFrame(() => {
    if (!locked) return

    const now = performance.now()
    const delta = Math.min((now - prevTimeRef.current) / 1000, 0.1)
    prevTimeRef.current = now

    const keys = keysRef.current
    const vel = velocityRef.current
    const speed = PLAYER_SPEEDS[mode]

    let moveX = 0
    let moveZ = 0
    if (keys.has('KeyW')) moveX = 1
    if (keys.has('KeyS')) moveX = -1
    if (keys.has('KeyA')) moveZ = 1
    if (keys.has('KeyD')) moveZ = -1

    if (mode === PlayerMode.flying) {
      // 비행 모드: 중력 없음, 직접 이동
      vel.x = moveX * speed
      vel.z = moveZ * speed
      vel.y = 0
      if (keys.has('Space')) vel.y = speed * 0.5
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) vel.y = -speed * 0.5

      const controls = controlsRef.current
      if (controls) {
        controls.moveForward(vel.x * delta)
        controls.moveRight(-vel.z * delta)
      }
      camera.position.y += vel.y * delta
      groundedRef.current = false
    } else {
      // === 걷기 모드 ===

      // 현재 위치의 지표면 높이
      const groundY = getGroundY(camera.position.x, camera.position.z)
      // 플레이어 발이 있어야 할 높이 (블록 위 + 플레이어 키)
      const standY = groundY + 1 + PLAYER_HEIGHT

      if (groundedRef.current) {
        // --- 바닥에 서 있는 상태: 중력 없음, Y 고정 ---
        vel.y = 0
        camera.position.y = standY

        // 수평 이동
        const controls = controlsRef.current
        if (controls) {
          controls.moveForward(moveX * speed * delta)
          controls.moveRight(-moveZ * speed * delta)
        }

        // 이동 후 새 위치의 지표면 체크
        const newGroundY = getGroundY(camera.position.x, camera.position.z)
        const newStandY = newGroundY + 1 + PLAYER_HEIGHT

        // 높이 차이가 1블록 이내면 부드럽게 따라감 (경사/계단)
        if (Math.abs(newStandY - camera.position.y) <= 1.2) {
          camera.position.y = newStandY
        } else if (newStandY < camera.position.y - 1.2) {
          // 절벽: 공중으로 전환
          groundedRef.current = false
          vel.y = 0
        } else if (newStandY > camera.position.y + 1.2) {
          // 벽: 이동 취소 (간단한 벽 충돌)
          controls?.moveForward(-moveX * speed * delta)
          controls?.moveRight(moveZ * speed * delta)
        }
      } else {
        // --- 공중 상태: 중력 적용 ---
        vel.y -= GRAVITY * delta
        if (vel.y < -MAX_FALL_VELOCITY) vel.y = -MAX_FALL_VELOCITY

        // 수평 이동 (공중에서도 조작 가능)
        const controls = controlsRef.current
        if (controls) {
          controls.moveForward(moveX * speed * delta)
          controls.moveRight(-moveZ * speed * delta)
        }

        // Y 이동
        camera.position.y += vel.y * delta

        // 착지 체크
        if (camera.position.y <= standY) {
          camera.position.y = standY
          vel.y = 0
          groundedRef.current = true
        }

        // 천장 충돌 (점프 중 머리 위 블록)
        if (vel.y > 0) {
          const headY = Math.round(camera.position.y + 0.2)
          const headX = Math.round(camera.position.x)
          const headZ = Math.round(camera.position.z)
          const headKey = `${headX}_${headY}_${headZ}`
          const noise = noiseRef.current
          const headSurfaceY = MC_BASE_Y + noise.getSurfaceOffset(headX, headZ)
          if (terrainIdMap[headKey] !== undefined || headY <= headSurfaceY) {
            vel.y = 0
          }
        }

        // 안전장치: 너무 아래로 떨어지면 리스폰
        if (camera.position.y < -50) {
          const spawnY =
            MC_BASE_Y +
            noiseRef.current.getSurfaceOffset(
              Math.round(camera.position.x),
              Math.round(camera.position.z)
            ) +
            3
          camera.position.y = spawnY
          vel.y = 0
          groundedRef.current = false
        }
      }
    }
  })

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={onLock}
      onUnlock={onUnlock}
    />
  )
}
