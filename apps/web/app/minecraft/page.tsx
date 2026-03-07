'use client'

// Minecraft R3F 페이지 — 독립 실행 (서버 연결 불필요)

import { useState, useCallback, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { PlayerMode, HOTBAR_BLOCKS, type CustomBlock } from '@/lib/3d/mc-types'
import type { BlockInstance } from '@/lib/3d/mc-terrain-worker'
import MCScene from '@/components/3d/MCScene'
import MCTerrain from '@/components/3d/MCTerrain'
import MCCamera from '@/components/3d/MCCamera'
import MCBlockInteraction from '@/components/3d/MCBlockInteraction'
import MCMenu from '@/components/mc/MCMenu'
import MCHotbar from '@/components/mc/MCHotbar'
import MCCrosshair from '@/components/mc/MCCrosshair'
import MCFPS from '@/components/mc/MCFPS'

export default function MinecraftPage() {
  // 게임 상태
  const [isPlaying, setIsPlaying] = useState(false)
  const [locked, setLocked] = useState(false)
  const [mode, setMode] = useState(PlayerMode.walking)
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>([])
  const [terrainBlocks, setTerrainBlocks] = useState<BlockInstance[]>([])
  const [terrainIdMap, setTerrainIdMap] = useState<Record<string, number>>({})
  const [hasEnteredGame, setHasEnteredGame] = useState(false)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // 월드 시드 (세션 고정)
  const seed = useMemo(() => Math.random(), [])

  // Canvas 요소에 포인터 잠금 요청 (사용자 제스처 내에서 호출해야 함)
  const requestPointerLock = useCallback(() => {
    const el = canvasContainerRef.current?.querySelector('canvas')
    if (el) {
      // 동기적 호출 — 사용자 제스처 컨텍스트 유지
      try {
        const result = el.requestPointerLock()
        // Promise를 반환하는 경우 (최신 브라우저)
        if (result && typeof (result as any).catch === 'function') {
          ;(result as any).catch(() => {
            // 실패 시 무시
          })
        }
      } catch {
        // 지원 안 되는 환경
      }
    }
  }, [])

  // 게임 시작 (Play 클릭)
  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    // Canvas가 마운트된 후 첫 번째 클릭에서 PointerLock이 걸림
    // 여기서 직접 lock 시도는 안 됨 (Canvas가 아직 마운트 전)
  }, [])

  // 일시정지 화면에서 재개 (사용자 클릭 제스처 내)
  const handleResume = useCallback(() => {
    requestPointerLock()
  }, [requestPointerLock])

  // 포인터 잠금/해제
  const handleLock = useCallback(() => {
    setLocked(true)
    setHasEnteredGame(true)
  }, [])
  const handleUnlock = useCallback(() => setLocked(false), [])

  // 현재 들고 있는 블록
  const heldBlock = HOTBAR_BLOCKS[selectedSlot]

  // 블록 배치
  const handleBlockPlace = useCallback((block: CustomBlock) => {
    setCustomBlocks((prev) => [...prev, block])
  }, [])

  // 블록 제거
  const handleBlockRemove = useCallback(
    (x: number, y: number, z: number) => {
      setCustomBlocks((prev) => {
        const existingIdx = prev.findIndex(
          (b) => b.x === x && b.y === y && b.z === z && b.placed
        )
        if (existingIdx !== -1) {
          return prev.filter((_, i) => i !== existingIdx)
        }
        return [
          ...prev,
          { x, y, z, type: 0 as const, placed: false },
        ]
      })
    },
    []
  )

  // 터레인 데이터 수신
  const handleTerrainReady = useCallback(
    (data: { blocks: BlockInstance[]; idMap: Record<string, number> }) => {
      setTerrainBlocks(data.blocks)
      setTerrainIdMap(data.idMap)
    },
    []
  )

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* R3F Canvas */}
      {isPlaying && (
        <div ref={canvasContainerRef} style={{ width: '100%', height: '100%' }}>
          <Canvas
            gl={{
              antialias: false,
              powerPreference: 'high-performance',
            }}
            camera={{ fov: 50, near: 0.01, far: 500 }}
            style={{ width: '100%', height: '100%' }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x87ceeb)
            }}
          >
            <MCScene />
            <MCTerrain
              seed={seed}
              customBlocks={customBlocks}
              onTerrainReady={handleTerrainReady}
            />
            <MCCamera
              seed={seed}
              locked={locked}
              onLock={handleLock}
              onUnlock={handleUnlock}
              mode={mode}
              onModeChange={setMode}
              terrainBlocks={terrainBlocks}
              terrainIdMap={terrainIdMap}
            />
            <MCBlockInteraction
              locked={locked}
              heldBlock={heldBlock}
              terrainBlocks={terrainBlocks}
              terrainIdMap={terrainIdMap}
              onBlockPlace={handleBlockPlace}
              onBlockRemove={handleBlockRemove}
            />
          </Canvas>
        </div>
      )}

      {/* UI 오버레이 */}
      <MCMenu
        isPlaying={isPlaying}
        locked={locked}
        hasEnteredGame={hasEnteredGame}
        mode={mode}
        onPlay={handlePlay}
        onResume={handleResume}
      />
      <MCHotbar
        selectedIndex={selectedSlot}
        onSelect={setSelectedSlot}
        locked={locked}
      />
      <MCCrosshair visible={locked} />
      <MCFPS visible={locked} />
    </div>
  )
}
