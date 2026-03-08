'use client'

// Minecraft 터레인 R3F 컴포넌트
// InstancedMesh per block type, Web Worker 청크 생성
// 면 제거 최적화: 6면 모두 불투명 블록에 둘러싸인 블록은 렌더하지 않음

import { useRef, useEffect, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BlockType,
  MC_CHUNK_SIZE,
  MC_RENDER_DISTANCE,
  MC_CLOUD_HEIGHT,
  MC_BASE_Y,
  MC_TREE_HEIGHT,
  BLOCK_ALLOC_FACTORS,
  blockKey,
  type CustomBlock,
} from '@/lib/3d/mc-types'
import { getBlockMaterial } from '@/lib/3d/mc-materials'
import { MCNoise } from '@/lib/3d/mc-noise'
import type {
  TerrainWorkerInput,
  TerrainWorkerOutput,
  BlockInstance,
} from '@/lib/3d/mc-terrain-worker'

const BLOCK_TYPE_COUNT = 14 // BlockType: grass(0)~gravel(13)
const blockGeo = new THREE.BoxGeometry(1, 1, 1)

/** 아레나 모드 설정: 반경 내 정적 지형 */
export interface MCTerrainArenaMode {
  /** 아레나 반경 (블록 단위, 예: 80) */
  radius: number
  /** 높이 편차 제한 +/-N 블록 (예: 5) */
  flattenVariance: number
  /** 국가 해시 시드 */
  seed: number
}

interface MCTerrainProps {
  seed: number
  customBlocks: CustomBlock[]
  onTerrainReady?: (data: {
    blocks: BlockInstance[]
    idMap: Record<string, number>
  }) => void
  /** v19: 아레나 모드 -- 반경 내 정적 지형, 청크 업데이트 스킵 */
  arenaMode?: MCTerrainArenaMode
}

export default function MCTerrain({
  seed,
  customBlocks,
  onTerrainReady,
  arenaMode,
}: MCTerrainProps) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>(
    new Array(BLOCK_TYPE_COUNT).fill(null)
  )
  const workerRef = useRef<Worker | null>(null)
  const lastChunkRef = useRef<string>('')
  const blocksRef = useRef<BlockInstance[]>([])
  const idMapRef = useRef<Record<string, number>>({})
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const isGeneratingRef = useRef(false)

  // Worker 초기화
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('../../lib/3d/mc-terrain-worker.ts', import.meta.url),
        { type: 'module' }
      )

      worker.onmessage = (e: MessageEvent<TerrainWorkerOutput>) => {
        // Worker 타임아웃 해제
        if (workerTimeoutRef.current) {
          clearTimeout(workerTimeoutRef.current)
          workerTimeoutRef.current = null
        }
        const { blocks, idMap, visibleBlocks } = e.data
        blocksRef.current = blocks
        idMapRef.current = idMap
        // 면 제거 최적화: visibleBlocks가 있으면 가시 블록만 렌더
        const renderBlocks = visibleBlocks ?? blocks
        updateInstancedMeshes(renderBlocks)
        onTerrainReady?.({ blocks, idMap })
        isGeneratingRef.current = false
      }

      worker.onerror = (e) => {
        console.warn('Terrain worker error, falling back to main thread:', e.message)
        workerRef.current = null
        isGeneratingRef.current = false
      }

      workerRef.current = worker

      return () => {
        worker.terminate()
      }
    } catch (e) {
      console.warn('Failed to create terrain worker:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // InstancedMesh 업데이트
  const updateInstancedMeshes = useCallback(
    (blocks: BlockInstance[]) => {
      // 블록 타입별 분류
      const byType: Map<BlockType, BlockInstance[]> = new Map()
      for (let i = 0; i < BLOCK_TYPE_COUNT; i++) {
        byType.set(i as BlockType, [])
      }
      for (const b of blocks) {
        byType.get(b.type)?.push(b)
      }

      // 각 타입별 InstancedMesh 업데이트
      for (let t = 0; t < BLOCK_TYPE_COUNT; t++) {
        const mesh = meshRefs.current[t]
        if (!mesh) continue

        const typeBlocks = byType.get(t as BlockType) || []
        const count = Math.min(typeBlocks.length, mesh.count)

        for (let i = 0; i < count; i++) {
          const b = typeBlocks[i]
          dummy.position.set(b.x, b.y, b.z)
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
        }

        // 나머지 인스턴스 숨기기
        const zeroMatrix = new THREE.Matrix4().set(
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        )
        for (let i = count; i < mesh.count; i++) {
          mesh.setMatrixAt(i, zeroMatrix)
        }

        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
      }
    },
    [dummy]
  )

  // 메인 스레드 터레인 생성 (Worker 폴백)
  const generateOnMainThread = useCallback(
    (cx: number, cz: number) => {
      const noise = new MCNoise(seed)
      const blocks: BlockInstance[] = []
      const idMap: Record<string, number> = {}

      const removedSet = new Set<string>()
      const placedBlocks: BlockInstance[] = []
      for (const cb of customBlocks) {
        if (!cb.placed) removedSet.add(blockKey(cb.x, cb.y, cb.z))
        else placedBlocks.push({ x: cb.x, y: cb.y, z: cb.z, type: cb.type })
      }

      let startX: number, endX: number, startZ: number, endZ: number
      if (arenaMode) {
        startX = -arenaMode.radius
        endX = arenaMode.radius
        startZ = -arenaMode.radius
        endZ = arenaMode.radius
      } else {
        startX = -MC_CHUNK_SIZE * MC_RENDER_DISTANCE + MC_CHUNK_SIZE * cx
        endX = MC_CHUNK_SIZE * MC_RENDER_DISTANCE + MC_CHUNK_SIZE + MC_CHUNK_SIZE * cx
        startZ = -MC_CHUNK_SIZE * MC_RENDER_DISTANCE + MC_CHUNK_SIZE * cz
        endZ = MC_CHUNK_SIZE * MC_RENDER_DISTANCE + MC_CHUNK_SIZE + MC_CHUNK_SIZE * cz
      }

      for (let x = startX; x < endX; x++) {
        for (let z = startZ; z < endZ; z++) {
          // 아레나 모드: 원형 경계 밖 블록 스킵
          if (arenaMode) {
            if (x * x + z * z > arenaMode.radius * arenaMode.radius) continue
          }

          let yOffset = noise.getSurfaceOffset(x, z)
          // 아레나 모드: 높이 편차 클램프
          if (arenaMode) {
            yOffset = Math.max(-arenaMode.flattenVariance, Math.min(arenaMode.flattenVariance, yOffset))
          }
          const y = MC_BASE_Y + yOffset
          const key = blockKey(x, y, z)
          if (removedSet.has(key)) continue

          const stoneOffset = noise.getStoneOffset(x, z)
          const coalOffset = noise.getCoalOffset(x, z)

          let type: BlockType
          if (stoneOffset > noise.stoneThreshold && coalOffset > noise.coalThreshold) {
            type = BlockType.coal
          } else if (stoneOffset > noise.stoneThreshold) {
            type = BlockType.stone
          } else if (yOffset < -3) {
            type = BlockType.sand
          } else {
            type = BlockType.grass
          }

          idMap[key] = blocks.length
          blocks.push({ x, y, z, type })

          // 나무
          const treeOffset = noise.getTreeOffset(x, z)
          if (treeOffset > noise.treeThreshold && yOffset >= -3 && stoneOffset <= noise.stoneThreshold) {
            for (let ty = 1; ty <= MC_TREE_HEIGHT; ty++) {
              const tKey = blockKey(x, y + ty, z)
              if (removedSet.has(tKey)) continue
              idMap[tKey] = blocks.length
              blocks.push({ x, y: y + ty, z, type: BlockType.tree })
            }
            const leafBase = y + MC_TREE_HEIGHT - 3
            for (let lx = x - 3; lx <= x + 3; lx++) {
              for (let ly = leafBase; ly <= leafBase + 6; ly++) {
                for (let lz = z - 3; lz <= z + 3; lz++) {
                  if (lx === x && lz === z && ly <= y + MC_TREE_HEIGHT) continue
                  if (noise.getLeafOffset(lx, ly, lz) > noise.leafThreshold) {
                    const lKey = blockKey(lx, ly, lz)
                    if (removedSet.has(lKey) || idMap[lKey] !== undefined) continue
                    idMap[lKey] = blocks.length
                    blocks.push({ x: lx, y: ly, z: lz, type: BlockType.leaf })
                  }
                }
              }
            }
          }
        }
      }

      for (const pb of placedBlocks) {
        if (pb.x >= startX && pb.x < endX && pb.z >= startZ && pb.z < endZ) {
          const pKey = blockKey(pb.x, pb.y, pb.z)
          if (idMap[pKey] === undefined) {
            idMap[pKey] = blocks.length
            blocks.push(pb)
          }
        }
      }

      blocksRef.current = blocks
      idMapRef.current = idMap
      updateInstancedMeshes(blocks)
      onTerrainReady?.({ blocks, idMap })
      isGeneratingRef.current = false
    },
    [seed, customBlocks, updateInstancedMeshes, onTerrainReady, arenaMode]
  )

  // Worker 타임아웃 ref
  const workerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 청크 변경 감지 + 생성 요청
  const requestGeneration = useCallback(
    (cx: number, cz: number) => {
      // 이미 생성 중이면 스킵 (중복 방지)
      if (isGeneratingRef.current) return
      isGeneratingRef.current = true

      // 이전 타임아웃 해제
      if (workerTimeoutRef.current) {
        clearTimeout(workerTimeoutRef.current)
        workerTimeoutRef.current = null
      }

      if (workerRef.current) {
        const input: TerrainWorkerInput = {
          chunkX: cx,
          chunkZ: cz,
          chunkSize: MC_CHUNK_SIZE,
          distance: arenaMode ? 1 : MC_RENDER_DISTANCE,
          seed,
          customBlocks,
          arenaMode: arenaMode ? {
            centerX: 0,
            centerZ: 0,
            radius: arenaMode.radius,
            flattenVariance: arenaMode.flattenVariance,
          } : undefined,
        }
        workerRef.current.postMessage(input)

        // 5초 타임아웃: Worker 무응답 시 메인 스레드 폴백
        workerTimeoutRef.current = setTimeout(() => {
          if (isGeneratingRef.current) {
            console.warn('Terrain worker timeout, falling back to main thread')
            workerRef.current = null
            isGeneratingRef.current = false
            generateOnMainThread(cx, cz)
          }
        }, 5000)
      } else {
        // Worker 실패 시 메인 스레드 폴백
        generateOnMainThread(cx, cz)
      }
    },
    [seed, customBlocks, generateOnMainThread, arenaMode]
  )

  // 초기 생성 (아레나 모드: 중심(0,0)에서 1회, 일반 모드: 카메라 위치)
  useEffect(() => {
    if (arenaMode) {
      lastChunkRef.current = '0_0'
      requestGeneration(0, 0)
    } else {
      const cx = Math.floor(camera.position.x / MC_CHUNK_SIZE)
      const cz = Math.floor(camera.position.z / MC_CHUNK_SIZE)
      lastChunkRef.current = `${cx}_${cz}`
      requestGeneration(cx, cz)
    }
  }, [camera, requestGeneration, arenaMode])

  // 매 프레임 청크 변경 체크 (아레나 모드에서는 스킵 -- 정적 지형)
  useFrame(() => {
    if (arenaMode) return // 아레나: 정적, 청크 업데이트 불필요

    const cx = Math.floor(camera.position.x / MC_CHUNK_SIZE)
    const cz = Math.floor(camera.position.z / MC_CHUNK_SIZE)
    const key = `${cx}_${cz}`

    if (key !== lastChunkRef.current) {
      lastChunkRef.current = key
      requestGeneration(cx, cz)
    }
  })

  // 최대 인스턴스 수 계산 (아레나: 원형 면적 기반, 일반: 사각형 범위)
  const maxCount = useMemo(() => {
    if (arenaMode) {
      // 원형 면적: pi * r^2 + 여유분 (나무/잎 포함)
      const r = arenaMode.radius
      return Math.ceil(Math.PI * r * r) + 2000
    }
    const range =
      MC_RENDER_DISTANCE * MC_CHUNK_SIZE * 2 + MC_CHUNK_SIZE
    return range * range + 500
  }, [arenaMode])

  // Geometry/Material dispose
  useEffect(() => {
    return () => {
      // 언마운트 시 InstancedMesh geometry는 공유하므로 dispose하지 않음
      // Material은 mc-materials.ts 캐시에서 관리
      meshRefs.current.forEach((mesh) => {
        if (mesh) {
          mesh.dispose()
        }
      })
    }
  }, [])

  return (
    <group ref={groupRef}>
      {/* 블록 타입별 InstancedMesh */}
      {Array.from({ length: BLOCK_TYPE_COUNT }, (_, i) => {
        const type = i as BlockType
        const count = Math.ceil(maxCount * BLOCK_ALLOC_FACTORS[type])
        return (
          <instancedMesh
            key={type}
            ref={(el) => {
              meshRefs.current[type] = el
            }}
            args={[blockGeo, getBlockMaterial(type), count]}
            frustumCulled={false}
            castShadow={false}
            receiveShadow={false}
          />
        )
      })}

      {/* 구름 (아레나 모드에서는 비활성 -- 작은 영역이라 불필요) */}
      {!arenaMode && <MCClouds seed={seed} />}
    </group>
  )
}

// 구름 컴포넌트 (reference: minecraft-threejs 스타일 -- 큰 박스 지오메트리)
function MCClouds({ seed }: { seed: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (!meshRef.current) return
    const mesh = meshRef.current
    let idx = 0

    // 구름 클러스터 생성 (reference: 20x5x14 scale per cloud chunk)
    for (let c = 0; c < 12; c++) {
      const cx = (Math.sin(seed * (c + 1) * 3.7) * 150) | 0
      const cz = (Math.cos(seed * (c + 1) * 2.3) * 150) | 0
      const cy = MC_CLOUD_HEIGHT + ((Math.sin(seed * c) * 10) | 0)

      if (idx >= mesh.count) break
      // 각 구름은 하나의 큰 인스턴스 (20x5x14 geometry로 렌더)
      dummy.position.set(cx, cy, cz)
      // 약간의 랜덤 스케일 변화
      const sx = 0.8 + Math.abs(Math.sin(seed * (c + 3))) * 0.6
      const sz = 0.8 + Math.abs(Math.cos(seed * (c + 5))) * 0.6
      dummy.scale.set(sx, 1, sz)
      dummy.updateMatrix()
      mesh.setMatrixAt(idx++, dummy.matrix)
    }

    // 나머지 숨기기
    const zeroMatrix = new THREE.Matrix4().set(
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    )
    for (let i = idx; i < mesh.count; i++) {
      mesh.setMatrixAt(i, zeroMatrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  }, [seed, dummy])

  const cloudMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
      }),
    []
  )

  // reference 스타일: 큰 박스 지오메트리 (20x5x14)
  const cloudGeo = useMemo(() => new THREE.BoxGeometry(20, 5, 14), [])

  // dispose
  useEffect(() => {
    return () => {
      cloudGeo.dispose()
      cloudMat.dispose()
    }
  }, [cloudGeo, cloudMat])

  return (
    <instancedMesh
      ref={meshRef}
      args={[cloudGeo, cloudMat, 50]}
      frustumCulled={false}
    />
  )
}
