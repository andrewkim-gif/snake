'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/* ═══════════════════════════════════════════
   Pixel Bird Flocks — V-formation + wing flap
   ═══════════════════════════════════════════ */

interface FlockConfig {
  orbitRadius: number
  altitude: number
  speed: number
  startAngle: number
  color: string
  birdCount: number
}

function BirdFlock({ orbitRadius, altitude, speed, startAngle, color, birdCount }: FlockConfig) {
  const groupRef = useRef<THREE.Group>(null)
  const wingPivotsRef = useRef<THREE.Group[]>([])

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(1.5, 1, 2.5), [])
  const wingGeo = useMemo(() => new THREE.BoxGeometry(2, 0.3, 1.8), [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color }), [color])
  const wingMat = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(1.3)
    return new THREE.MeshLambertMaterial({ color: c })
  }, [color])

  // V-formation positions
  const positions = useMemo(() => {
    const p: [number, number, number][] = [[0, 0, 0]]
    for (let i = 1; i < birdCount; i++) {
      const row = Math.ceil(i / 2)
      const side = i % 2 === 0 ? -1 : 1
      p.push([side * row * 5, row * 1.5, -row * 4])
    }
    return p
  }, [birdCount])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime * speed + startAngle

    // Flock orbit
    groupRef.current.position.set(
      Math.cos(t) * orbitRadius,
      altitude + Math.sin(clock.elapsedTime * 1.5) * 5,
      Math.sin(t) * orbitRadius,
    )
    groupRef.current.rotation.y = Math.atan2(-Math.sin(t) * speed, Math.cos(t) * speed)

    // Wing flap (all birds via pivot refs)
    wingPivotsRef.current.forEach((pivot, idx) => {
      if (!pivot) return
      const birdIdx = Math.floor(idx / 2)
      const isLeft = idx % 2 === 0
      const flap = Math.sin(clock.elapsedTime * 8 + birdIdx * 0.5) * 0.6
      pivot.rotation.z = isLeft ? flap : -flap
    })
  })

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh geometry={bodyGeo} material={mat} />
          {/* Left wing pivot */}
          <group position={[-0.75, 0.3, 0]} ref={(el) => { if (el) wingPivotsRef.current[i * 2] = el }}>
            <mesh position={[-1, 0, 0]} geometry={wingGeo} material={wingMat} />
          </group>
          {/* Right wing pivot */}
          <group position={[0.75, 0.3, 0]} ref={(el) => { if (el) wingPivotsRef.current[i * 2 + 1] = el }}>
            <mesh position={[1, 0, 0]} geometry={wingGeo} material={wingMat} />
          </group>
        </group>
      ))}
    </group>
  )
}

/* ═══════════════════════════════════════════
   Floating Crystal Cubes — rotate + bob
   ═══════════════════════════════════════════ */

const CUBE_DATA = [
  { pos: [80, 40, -60] as const, color: '#FF5555', size: 4, rotSpd: 0.5, bobSpd: 0.8, bobAmp: 3 },
  { pos: [-100, 55, 40] as const, color: '#55FF55', size: 3, rotSpd: -0.3, bobSpd: 1.2, bobAmp: 4 },
  { pos: [30, 65, 120] as const, color: '#5555FF', size: 5, rotSpd: 0.4, bobSpd: 0.6, bobAmp: 2 },
  { pos: [-70, 45, -110] as const, color: '#FFAA00', size: 3.5, rotSpd: -0.6, bobSpd: 1.0, bobAmp: 3 },
  { pos: [150, 50, 30] as const, color: '#FF55FF', size: 4, rotSpd: 0.35, bobSpd: 0.9, bobAmp: 3.5 },
  { pos: [-40, 70, 90] as const, color: '#55FFFF', size: 3, rotSpd: -0.45, bobSpd: 1.1, bobAmp: 2.5 },
  { pos: [110, 35, -90] as const, color: '#FFFF55', size: 4.5, rotSpd: 0.55, bobSpd: 0.7, bobAmp: 4 },
  { pos: [-130, 60, -20] as const, color: '#FF8855', size: 3.5, rotSpd: -0.4, bobSpd: 1.3, bobAmp: 3 },
]

function FloatingCubes() {
  const refs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    CUBE_DATA.forEach((c, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      mesh.rotation.y = t * c.rotSpd
      mesh.rotation.x = t * c.rotSpd * 0.3
      mesh.position.y = c.pos[1] + Math.sin(t * c.bobSpd + i) * c.bobAmp
    })
  })

  return (
    <>
      {CUBE_DATA.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el }}
          position={[c.pos[0], c.pos[1], c.pos[2]]}
        >
          <boxGeometry args={[c.size, c.size, c.size]} />
          <meshLambertMaterial color={c.color} emissive={c.color} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </>
  )
}

/* ═══════════════════════════════════════════
   Cloud Clusters — fluffy multi-box drifting clouds
   ═══════════════════════════════════════════ */

function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function genCloudBoxes(seed: number) {
  const count = 3 + Math.floor(srand(seed) * 3) // 3-5 boxes per cluster
  const boxes: { dx: number; dy: number; dz: number; sx: number; sy: number; sz: number; op: number }[] = []
  for (let j = 0; j < count; j++) {
    boxes.push({
      dx: (srand(seed + j * 3 + 1) - 0.5) * 25,
      dy: (srand(seed + j * 3 + 2) - 0.5) * 6,
      dz: (srand(seed + j * 3 + 3) - 0.5) * 20,
      sx: 18 + srand(seed + j * 7 + 10) * 30,
      sy: 5 + srand(seed + j * 7 + 11) * 5,
      sz: 12 + srand(seed + j * 7 + 12) * 22,
      op: 0.6 + srand(seed + j * 7 + 13) * 0.3,
    })
  }
  return boxes
}

const CLOUD_CLUSTERS = Array.from({ length: 10 }, (_, i) => ({
  cx: (srand(i * 31 + 300) - 0.5) * 600,
  cy: 220 + srand(i * 31 + 301) * 80,
  cz: (srand(i * 31 + 302) - 0.5) * 600,
  speed: (srand(i * 31 + 303) - 0.5) * 4,
  boxes: genCloudBoxes(i * 100),
}))

function CloudClusters() {
  const groupRefs = useRef<(THREE.Group | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    CLOUD_CLUSTERS.forEach((c, i) => {
      const group = groupRefs.current[i]
      if (!group) return
      group.position.x = c.cx + Math.sin(t * 0.02 * c.speed + i * 2) * 100
      group.position.z = c.cz + Math.cos(t * 0.015 * c.speed + i * 3) * 80
    })
  })

  return (
    <>
      {CLOUD_CLUSTERS.map((cluster, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el }}
          position={[cluster.cx, cluster.cy, cluster.cz]}
        >
          {cluster.boxes.map((b, j) => (
            <mesh key={j} position={[b.dx, b.dy, b.dz]}>
              <boxGeometry args={[b.sx, b.sy, b.sz]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={b.op} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/* ═══════════════════════════════════════════
   Export — all sky objects
   ═══════════════════════════════════════════ */

export function LobbySkyObjects() {
  return (
    <>
      {/* 새 떼 3개 */}
      <BirdFlock orbitRadius={200} altitude={120} speed={0.08} startAngle={0} color="#2C2C2C" birdCount={4} />
      <BirdFlock orbitRadius={250} altitude={160} speed={-0.06} startAngle={2} color="#8B4513" birdCount={3} />
      <BirdFlock orbitRadius={180} altitude={140} speed={0.1} startAngle={4.5} color="#EEEEEE" birdCount={5} />

      <FloatingCubes />
      <CloudClusters />
    </>
  )
}
