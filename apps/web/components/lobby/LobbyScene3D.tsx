'use client'

import { Canvas } from '@react-three/fiber'
import { Scene } from '@/components/3d/Scene'
import { SkyBox } from '@/components/3d/SkyBox'
import { VoxelTerrain } from '@/components/3d/VoxelTerrain'
import { LobbyCamera } from '@/components/3d/LobbyCamera'
import { LobbyHills } from './LobbyHills'
import { LobbyTerrainObjects } from './LobbyTerrainObjects'
import { LobbyIdleSnakes } from './LobbyIdleSnakes'
import { LobbySkyObjects } from './LobbySkyObjects'

/** 로비 3D 배경 씬 — 마인크래프트 지형 (radius 800) */
export function LobbyScene3D() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        dpr={[1, 1]}
        gl={{ antialias: true }}
        camera={{ fov: 50, near: 1, far: 2000 }}
        style={{ background: '#87CEEB' }}
      >
        <Scene />
        <SkyBox />
        <VoxelTerrain radius={800} />
        <LobbyCamera />
        <LobbyHills />
        <LobbyTerrainObjects />
        <LobbyIdleSnakes />
        <LobbySkyObjects />
      </Canvas>
    </div>
  )
}
