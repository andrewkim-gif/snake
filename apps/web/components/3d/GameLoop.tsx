'use client'

import { useFrame } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import type { GameData } from '../../hooks/useSocket'
import type { AgentNetworkData } from '@snake-arena/shared'
import { interpolateAgents, applyClientPrediction } from '../../lib/interpolation'

interface GameLoopProps {
  dataRef: MutableRefObject<GameData>
  angleRef: MutableRefObject<number>
  snakesRef: MutableRefObject<AgentNetworkData[]>
  cameraTargetRef: MutableRefObject<{ x: number; z: number; mass: number }>
}

/**
 * R3F useFrame 기반 게임 루프
 * v10: Snake → Agent 전환
 */
export function GameLoop({ dataRef, angleRef, snakesRef, cameraTargetRef }: GameLoopProps) {
  useFrame((_, dt) => {
    try {
      const data = dataRef.current
      const state = data.latestState
      if (!state) {
        snakesRef.current = []
        return
      }

      // 보간 t 계산
      const now = performance.now()
      const serverInterval = data.stateTimestamp - data.prevStateTimestamp
      const elapsed = now - data.stateTimestamp
      const t = serverInterval > 0 ? Math.min(elapsed / serverInterval, 1.5) : 1

      // Agent 보간
      let agents = interpolateAgents(data.prevState?.s || null, state.s, t)

      // 내 Agent 클라이언트 예측
      const myAgent = agents.find(a => a.i === data.playerId)
      if (myAgent) {
        const predicted = applyClientPrediction(myAgent, angleRef.current, dt)
        agents = agents.map(a => a.i === data.playerId ? predicted : a)

        // 카메라 타겟 업데이트 (서버 y → Three.js z)
        cameraTargetRef.current.x = predicted.x
        cameraTargetRef.current.z = predicted.y
        cameraTargetRef.current.mass = predicted.m
      }

      // 보간된 결과를 ref에 저장
      snakesRef.current = agents
    } catch (err) {
      console.error('[GameLoop] useFrame error:', err)
    }
  })

  return null
}
