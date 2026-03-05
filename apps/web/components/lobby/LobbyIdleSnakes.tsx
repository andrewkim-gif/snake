'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEFAULT_SKINS } from '@snake-arena/shared'
import { createBodyTexture, createFaceTexture } from '@/lib/3d/voxel-textures'
import { terrainHeight } from '@/lib/3d/terrain-noise'

/* ── Movement pattern types ── */
type MovementType = 'circle' | 'figure8' | 'wander' | 'zigzag' | 'sine'

function getPosition(type: MovementType, t: number, r: number): { x: number; z: number } {
  switch (type) {
    case 'circle':
      return { x: Math.cos(t) * r, z: Math.sin(t) * r }
    case 'figure8':
      // Lemniscate of Gerono
      return { x: Math.cos(t) * r, z: Math.sin(2 * t) * r * 0.5 }
    case 'wander':
      // Organic Lissajous-like drift
      return {
        x: Math.sin(t * 0.7) * r + Math.sin(t * 0.23) * r * 0.4,
        z: Math.cos(t * 0.5) * r + Math.cos(t * 0.37) * r * 0.3,
      }
    case 'zigzag': {
      // Triangle wave modulation on circular base
      const tri = Math.abs(((t * 2) % 4) - 2) - 1
      return { x: Math.cos(t * 0.8) * r + tri * 25, z: Math.sin(t * 0.8) * r }
    }
    case 'sine':
      // Circular + sine wobble
      return { x: Math.cos(t * 0.6) * r, z: Math.sin(t * 0.6) * r + Math.sin(t * 3) * 20 }
  }
}

function getHeading(type: MovementType, t: number, r: number, dir: number): number {
  const dt = 0.01 * dir
  const p0 = getPosition(type, t, r)
  const p1 = getPosition(type, t + dt, r)
  return Math.atan2(p1.x - p0.x, p1.z - p0.z)
}

/* ── Single idle snake ── */
interface SnakeConfig {
  movement: MovementType
  pathRadius: number
  speed: number
  segmentCount: number
  skinId: number
  startAngle: number
  offset?: [number, number]
  cubeSize?: number
}

function IdleSnake({ movement, pathRadius, speed, segmentCount, skinId, startAngle, offset = [0, 0], cubeSize = 8 }: SnakeConfig) {
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.Mesh>(null)
  const timeRef = useRef(startAngle)

  const skin = useMemo(() => DEFAULT_SKINS[skinId] ?? DEFAULT_SKINS[0], [skinId])
  const bodyTex = useMemo(() => createBodyTexture(skin), [skin])
  const faceTex = useMemo(() => createFaceTexture(skin), [skin])
  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ map: bodyTex }), [bodyTex])
  const headMats = useMemo(() => {
    const side = new THREE.MeshLambertMaterial({ map: bodyTex })
    const face = new THREE.MeshLambertMaterial({ map: faceTex })
    return [side, side, side, side, face, side]
  }, [bodyTex, faceTex])
  const _obj = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    timeRef.current += delta * speed
    if (!bodyRef.current || !headRef.current) return

    const t = timeRef.current
    const dir = speed > 0 ? 1 : -1
    const segSpacing = 0.12
    const ox = offset[0], oz = offset[1]

    // Head
    const hp = getPosition(movement, t, pathRadius)
    const hh = getHeading(movement, t, pathRadius, dir)
    const headSize = cubeSize * 1.3
    const headWx = hp.x + ox, headWz = hp.z + oz
    const headGy = terrainHeight(headWx, headWz)
    headRef.current.position.set(headWx, headGy + headSize / 2, headWz)
    headRef.current.rotation.set(0, hh, 0)
    headRef.current.scale.setScalar(headSize)

    // Body segments
    for (let i = 0; i < segmentCount; i++) {
      const st = t - (i + 1) * segSpacing * dir
      const sp = getPosition(movement, st, pathRadius)
      const sh = getHeading(movement, st, pathRadius, dir)
      const fromEnd = segmentCount - i
      const tailScale = fromEnd < 3 ? 0.5 + 0.5 * (fromEnd / 3) : 1.0
      const s = cubeSize * tailScale
      const segWx = sp.x + ox, segWz = sp.z + oz
      const segGy = terrainHeight(segWx, segWz)

      _obj.position.set(segWx, segGy + s / 2, segWz)
      _obj.rotation.set(0, sh, 0)
      _obj.scale.set(s, s, s)
      _obj.updateMatrix()
      bodyRef.current.setMatrixAt(i, _obj.matrix)
    }
    bodyRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, segmentCount]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={bodyMat} attach="material" />
      </instancedMesh>
      <mesh ref={headRef} material={headMats}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
    </group>
  )
}

/* ── 8 snakes — 플랫 존(CENTER_CLEAR=200) 내부에서만 이동 ── */
const SNAKE_CONFIGS: SnakeConfig[] = [
  // Circle orbits (max reach ≈ pathRadius)
  { movement: 'circle', pathRadius: 80, speed: 0.3, segmentCount: 8, skinId: 0, startAngle: 0 },
  { movement: 'circle', pathRadius: 100, speed: -0.18, segmentCount: 12, skinId: 5, startAngle: 3 },
  // Figure-8 (max reach ≈ pathRadius + |offset|)
  { movement: 'figure8', pathRadius: 90, speed: 0.25, segmentCount: 7, skinId: 2, startAngle: 1 },
  { movement: 'figure8', pathRadius: 70, speed: -0.3, segmentCount: 6, skinId: 12, startAngle: 4, offset: [30, -20] },
  // Organic wander (max reach ≈ pathRadius*1.4 + |offset|)
  { movement: 'wander', pathRadius: 80, speed: 0.8, segmentCount: 10, skinId: 7, startAngle: 0, offset: [-15, 10] },
  { movement: 'wander', pathRadius: 70, speed: 0.6, segmentCount: 6, skinId: 14, startAngle: 2.5, offset: [20, 30] },
  // Zigzag (max reach ≈ pathRadius + 25 + |offset|)
  { movement: 'zigzag', pathRadius: 90, speed: 0.25, segmentCount: 8, skinId: 3, startAngle: 5, offset: [10, -20] },
  // Sine wave (max reach ≈ pathRadius + 20 + |offset|)
  { movement: 'sine', pathRadius: 85, speed: 0.3, segmentCount: 7, skinId: 9, startAngle: 1.5, offset: [-25, 15] },
]

export function LobbyIdleSnakes() {
  return (
    <>
      {SNAKE_CONFIGS.map((cfg, i) => (
        <IdleSnake key={i} {...cfg} />
      ))}
    </>
  )
}
