'use client'

// Minecraft FPS 카메라 + 물리 + 충돌 감지
// PointerLockControls + WASD + 중력 + 점프 + 비행 모드
// 6방향 충돌 감지: front/back/left/right/up/down

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PointerLockControls } from '@react-three/drei'
import {
  PlayerMode,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_FALL_VELOCITY,
  MC_BASE_Y,
  blockKey,
  isSolidBlock,
  BlockType,
} from '@/lib/3d/mc-types'
import { MCNoise } from '@/lib/3d/mc-noise'
import type { BlockInstance } from '@/lib/3d/mc-terrain-worker'

// 이동 속도 (blocks/sec)
const WALK_SPEED = 4.3
const FLY_SPEED = 10.0
const SNEAK_SPEED = 1.95
const FLY_VERTICAL_SPEED = 6.0

// 더블 Space 감지 시간 (ms)
const DOUBLE_TAP_THRESHOLD = 300

// 카메라 높이 (눈 높이 = 플레이어 위치 + 1.62)
const EYE_HEIGHT = 1.62

// 충돌 체크 오프셋 (몸통 반경)
const COLLISION_MARGIN = 0.3

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
  const groundedRef = useRef(true)
  const noiseRef = useRef(new MCNoise(seed))
  const prevTimeRef = useRef(performance.now())
  const lastSpacePressRef = useRef(0) // 더블 Space 감지용

  // 임시 벡터 (매 프레임 재사용)
  const forwardVec = useRef(new THREE.Vector3())
  const rightVec = useRef(new THREE.Vector3())
  const moveVec = useRef(new THREE.Vector3())

  useEffect(() => {
    noiseRef.current = new MCNoise(seed)
  }, [seed])

  // 초기 위치: 지형 위에 스폰
  useEffect(() => {
    const spawnY = MC_BASE_Y + noiseRef.current.getSurfaceOffset(8, 8) + 1 + EYE_HEIGHT
    camera.position.set(8, spawnY, 8)
  }, [camera])

  // ---------------------------------------------------------------------------
  // 블록 충돌 체크: 월드 좌표 (wx, wy, wz)에 solid 블록이 있는지
  // ---------------------------------------------------------------------------
  const isSolidAt = useCallback(
    (wx: number, wy: number, wz: number): boolean => {
      const bx = Math.floor(wx)
      const by = Math.floor(wy)
      const bz = Math.floor(wz)
      const key = blockKey(bx, by, bz)

      // terrainIdMap에서 블록 존재 확인
      if (terrainIdMap[key] !== undefined) {
        const block = terrainBlocks[terrainIdMap[key]]
        if (block && isSolidBlock(block.type)) return true
      }

      // 노이즈 기반 지표면 체크 (terrainIdMap에 아직 로드되지 않은 청크 대비)
      const noise = noiseRef.current
      const surfaceY = MC_BASE_Y + noise.getSurfaceOffset(bx, bz)
      if (by <= surfaceY) return true

      return false
    },
    [terrainBlocks, terrainIdMap]
  )

  // ---------------------------------------------------------------------------
  // 6방향 충돌 감지: 이동 방향에 solid 블록이 있으면 차단
  // 플레이어 몸통: 폭 PLAYER_WIDTH, 높이 PLAYER_HEIGHT
  // 눈 위치가 camera.position이므로, 발 위치 = camera.y - EYE_HEIGHT
  // ---------------------------------------------------------------------------
  const checkCollision = useCallback(
    (pos: THREE.Vector3, dir: 'x' | 'y' | 'z', delta: number): boolean => {
      const feetY = pos.y - EYE_HEIGHT
      const headY = feetY + PLAYER_HEIGHT

      if (dir === 'y') {
        if (delta < 0) {
          // 아래로 이동: 발 아래 블록 체크
          const nextFeetY = feetY + delta
          // 4개 코너 체크 (몸통 가장자리)
          for (const ox of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
            for (const oz of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
              if (isSolidAt(pos.x + ox, nextFeetY, pos.z + oz)) return true
            }
          }
        } else {
          // 위로 이동: 머리 위 블록 체크
          const nextHeadY = headY + delta
          for (const ox of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
            for (const oz of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
              if (isSolidAt(pos.x + ox, nextHeadY, pos.z + oz)) return true
            }
          }
        }
        return false
      }

      // X/Z 방향: 몸통 전체 높이에서 체크 (발, 허리, 머리)
      const checkHeights = [feetY + 0.1, feetY + 0.9, headY - 0.1]

      if (dir === 'x') {
        const nextX = pos.x + delta
        const edgeX = delta > 0 ? nextX + COLLISION_MARGIN : nextX - COLLISION_MARGIN
        for (const hy of checkHeights) {
          for (const oz of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
            if (isSolidAt(edgeX, hy, pos.z + oz)) return true
          }
        }
      } else {
        // dir === 'z'
        const nextZ = pos.z + delta
        const edgeZ = delta > 0 ? nextZ + COLLISION_MARGIN : nextZ - COLLISION_MARGIN
        for (const hy of checkHeights) {
          for (const ox of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
            if (isSolidAt(pos.x + ox, hy, edgeZ)) return true
          }
        }
      }

      return false
    },
    [isSolidAt]
  )

  // ---------------------------------------------------------------------------
  // 키보드 입력 핸들러
  // ---------------------------------------------------------------------------
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      keysRef.current.add(e.code)

      // Q: 비행 모드 토글
      if (e.code === 'KeyQ') {
        const newMode =
          mode === PlayerMode.flying ? PlayerMode.walking : PlayerMode.flying
        onModeChange(newMode)
        velocityRef.current.y = 0
        if (newMode === PlayerMode.walking) {
          groundedRef.current = false // 비행 -> 걷기 전환 시 낙하 시작
        }
      }

      // Space: 점프 또는 더블 탭 비행 토글
      if (e.code === 'Space') {
        const now = performance.now()
        const timeSinceLastSpace = now - lastSpacePressRef.current
        lastSpacePressRef.current = now

        // 더블 Space: 비행 모드 토글
        if (timeSinceLastSpace < DOUBLE_TAP_THRESHOLD) {
          const newMode =
            mode === PlayerMode.flying ? PlayerMode.walking : PlayerMode.flying
          onModeChange(newMode)
          velocityRef.current.y = 0
          if (newMode === PlayerMode.walking) {
            groundedRef.current = false
          }
        } else if (mode === PlayerMode.walking && groundedRef.current) {
          // 단일 Space: 점프 (바닥에 서 있을 때만)
          velocityRef.current.y = JUMP_VELOCITY
          groundedRef.current = false
        }
      }

      // Shift: 웅크리기 모드 (걷기 중에만)
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && mode === PlayerMode.walking) {
        onModeChange(PlayerMode.sneaking)
      }
    },
    [mode, onModeChange]
  )

  const onKeyUp = useCallback(
    (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)

      // Shift 해제: 웅크리기 -> 걷기
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && mode === PlayerMode.sneaking) {
        onModeChange(PlayerMode.walking)
      }
    },
    [mode, onModeChange]
  )

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

  // ---------------------------------------------------------------------------
  // 물리 업데이트 (매 프레임)
  // ---------------------------------------------------------------------------
  useFrame(() => {
    if (!locked) return

    const now = performance.now()
    const delta = Math.min((now - prevTimeRef.current) / 1000, 0.1)
    prevTimeRef.current = now

    const keys = keysRef.current
    const vel = velocityRef.current

    // 현재 모드에 따른 이동 속도
    let speed: number
    switch (mode) {
      case PlayerMode.flying:
        speed = FLY_SPEED
        break
      case PlayerMode.sneaking:
        speed = SNEAK_SPEED
        break
      default:
        speed = WALK_SPEED
    }

    // 카메라 방향 벡터 계산
    camera.getWorldDirection(forwardVec.current)
    forwardVec.current.y = 0
    forwardVec.current.normalize()

    rightVec.current.crossVectors(forwardVec.current, camera.up).normalize()

    // WASD 입력 -> 이동 벡터
    moveVec.current.set(0, 0, 0)
    if (keys.has('KeyW')) moveVec.current.add(forwardVec.current)
    if (keys.has('KeyS')) moveVec.current.sub(forwardVec.current)
    if (keys.has('KeyA')) moveVec.current.sub(rightVec.current)
    if (keys.has('KeyD')) moveVec.current.add(rightVec.current)

    // 정규화 (대각선 이동 속도 보정)
    if (moveVec.current.lengthSq() > 0) {
      moveVec.current.normalize()
    }

    if (mode === PlayerMode.flying) {
      // === 비행 모드 ===
      // 수평 이동
      const moveX = moveVec.current.x * speed * delta
      const moveZ = moveVec.current.z * speed * delta

      // X 충돌 체크
      if (moveX !== 0 && !checkCollision(camera.position, 'x', moveX)) {
        camera.position.x += moveX
      }
      // Z 충돌 체크
      if (moveZ !== 0 && !checkCollision(camera.position, 'z', moveZ)) {
        camera.position.z += moveZ
      }

      // 수직 이동
      let verticalMove = 0
      if (keys.has('Space')) verticalMove += FLY_VERTICAL_SPEED * delta
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) verticalMove -= FLY_VERTICAL_SPEED * delta

      if (verticalMove !== 0 && !checkCollision(camera.position, 'y', verticalMove)) {
        camera.position.y += verticalMove
      }

      groundedRef.current = false
    } else {
      // === 걷기 / 웅크리기 모드 ===

      // 수평 이동
      const moveX = moveVec.current.x * speed * delta
      const moveZ = moveVec.current.z * speed * delta

      // X 충돌 체크 후 이동
      if (moveX !== 0 && !checkCollision(camera.position, 'x', moveX)) {
        camera.position.x += moveX
      }
      // Z 충돌 체크 후 이동
      if (moveZ !== 0 && !checkCollision(camera.position, 'z', moveZ)) {
        camera.position.z += moveZ
      }

      // 중력 적용
      if (!groundedRef.current) {
        vel.y -= GRAVITY * delta
        if (vel.y < -MAX_FALL_VELOCITY) vel.y = -MAX_FALL_VELOCITY
      }

      // 수직 이동
      const verticalDelta = vel.y * delta
      if (verticalDelta !== 0) {
        if (checkCollision(camera.position, 'y', verticalDelta)) {
          // 충돌: 속도 0
          if (vel.y < 0) {
            // 착지
            groundedRef.current = true
            // 발을 블록 위에 정확히 맞춤
            const feetY = camera.position.y - EYE_HEIGHT
            const snappedFeetY = Math.ceil(feetY) // 가장 가까운 블록 위
            camera.position.y = snappedFeetY + EYE_HEIGHT
          }
          vel.y = 0
        } else {
          camera.position.y += verticalDelta
          if (vel.y < 0) groundedRef.current = false
        }
      }

      // 바닥 아래에 블록이 없으면 낙하 시작
      if (groundedRef.current) {
        const feetY = camera.position.y - EYE_HEIGHT
        const belowFeetY = feetY - 0.1
        let hasGround = false
        for (const ox of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
          for (const oz of [-COLLISION_MARGIN, COLLISION_MARGIN]) {
            if (isSolidAt(camera.position.x + ox, belowFeetY, camera.position.z + oz)) {
              hasGround = true
              break
            }
          }
          if (hasGround) break
        }
        if (!hasGround) {
          groundedRef.current = false
        }
      }

      // 안전장치: 너무 아래로 떨어지면 리스폰
      if (camera.position.y < -50) {
        const spawnX = Math.round(camera.position.x)
        const spawnZ = Math.round(camera.position.z)
        const spawnY =
          MC_BASE_Y +
          noiseRef.current.getSurfaceOffset(spawnX, spawnZ) +
          1 +
          EYE_HEIGHT
        camera.position.set(spawnX, spawnY, spawnZ)
        vel.y = 0
        groundedRef.current = true
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
