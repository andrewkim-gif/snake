'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { AgentNetworkData } from '@snake-arena/shared'
import type { GameData } from '../../hooks/useSocket'
import { VoxelSnake } from './VoxelSnake'

interface SnakeGroupProps {
  snakesRef: MutableRefObject<AgentNetworkData[]>
  dataRef: MutableRefObject<GameData>
}

interface SnakeEntry {
  id: string
  skinId: number
}

/**
 * 뱀 목록 관리 — ID 리스트가 변경될 때만 React 리렌더
 * 각 VoxelSnake는 snakesRef에서 매 프레임 자기 데이터를 직접 조회
 */
export function SnakeGroup({ snakesRef, dataRef }: SnakeGroupProps) {
  const [snakeEntries, setSnakeEntries] = useState<SnakeEntry[]>([])
  const prevIdsRef = useRef('')

  useFrame(() => {
    const snakes = snakesRef.current
    const ids = snakes.map(s => s.i).sort().join(',')

    // ID 목록이 변경된 경우에만 React state 업데이트
    if (ids !== prevIdsRef.current) {
      prevIdsRef.current = ids
      setSnakeEntries(snakes.map(s => ({ id: s.i, skinId: s.k })))
    }
  })

  const myId = dataRef.current.playerId

  return (
    <group>
      {snakeEntries.map(entry => (
        <VoxelSnake
          key={entry.id}
          snakeId={entry.id}
          snakesRef={snakesRef}
          isMe={entry.id === myId}
          initialSkinId={entry.skinId}
        />
      ))}
    </group>
  )
}
