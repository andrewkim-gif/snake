'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight, isNearLake, srand } from '@/lib/3d/terrain-noise'

/* ── Trees (20): height-aware placement ── */

interface TreeData { x: number; z: number; gy: number; th: number; cs: number }

function computeTrees(count: number): TreeData[] {
  const trees: TreeData[] = []
  for (let i = 0; trees.length < count && i < 200; i++) {
    const angle = srand(i * 7 + 1) * Math.PI * 2
    const dist = 60 + srand(i * 7 + 2) * 400
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    const gy = terrainHeight(x, z)
    if (gy > 20) continue       // 산악 지대 제외
    if (isNearLake(x, z)) continue  // 호수 근처 제외
    trees.push({
      x, z, gy,
      th: 18 + srand(i * 7 + 3) * 14,
      cs: 16 + srand(i * 7 + 4) * 10,
    })
  }
  return trees
}

function Trees() {
  const treeData = useMemo(() => computeTrees(20), [])
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const canopyRef = useRef<THREE.InstancedMesh>(null)
  const _obj = useMemo(() => new THREE.Object3D(), [])
  const trunkMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#6B4E32' }), [])
  const leafMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3A8C21' }), [])
  const initRef = useRef(false)

  useFrame(() => {
    if (initRef.current || !trunkRef.current || !canopyRef.current) return
    initRef.current = true

    for (let i = 0; i < treeData.length; i++) {
      const { x, z, gy, th, cs } = treeData[i]

      _obj.position.set(x, gy + th / 2, z)
      _obj.rotation.set(0, srand(i * 7 + 5) * 6.28, 0)
      _obj.scale.set(5, th, 5)
      _obj.updateMatrix()
      trunkRef.current.setMatrixAt(i, _obj.matrix)

      _obj.position.set(x, gy + th + cs * 0.3, z)
      _obj.scale.set(cs, cs * 0.65, cs)
      _obj.updateMatrix()
      canopyRef.current.setMatrixAt(i, _obj.matrix)
    }

    trunkRef.current.instanceMatrix.needsUpdate = true
    canopyRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, treeData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={trunkMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, treeData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={leafMat} attach="material" />
      </instancedMesh>
    </>
  )
}

/* ── Rocks (25): height-aware ── */

interface RockData { x: number; z: number; gy: number; sx: number; sy: number; sz: number }

function computeRocks(count: number): RockData[] {
  const rocks: RockData[] = []
  for (let i = 0; rocks.length < count && i < 150; i++) {
    const angle = srand(i * 13 + 50) * Math.PI * 2
    const dist = 40 + srand(i * 13 + 51) * 450
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    if (isNearLake(x, z)) continue
    rocks.push({
      x, z, gy: terrainHeight(x, z),
      sx: 3 + srand(i * 13 + 52) * 5,
      sy: 2 + srand(i * 13 + 53) * 4,
      sz: 3 + srand(i * 13 + 54) * 5,
    })
  }
  return rocks
}

function Rocks() {
  const rockData = useMemo(() => computeRocks(25), [])
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const _obj = useMemo(() => new THREE.Object3D(), [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#888888' }), [])
  const initRef = useRef(false)

  useFrame(() => {
    if (initRef.current || !meshRef.current) return
    initRef.current = true

    for (let i = 0; i < rockData.length; i++) {
      const { x, z, gy, sx, sy, sz } = rockData[i]
      _obj.position.set(x, gy + sy * 0.35, z)
      _obj.rotation.set(0, srand(i * 13 + 55) * 6.28, 0)
      _obj.scale.set(sx, sy, sz)
      _obj.updateMatrix()
      meshRef.current.setMatrixAt(i, _obj.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, rockData.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <primitive object={mat} attach="material" />
    </instancedMesh>
  )
}

/* ── Flowers (20): flat zone + low hills only ── */

const PETAL_COLORS = ['#FF5555', '#FFAA00', '#FF55FF', '#5555FF', '#55FFFF', '#FFFF55', '#FF8855', '#AA55FF']

interface FlowerData { x: number; z: number; gy: number }

function computeFlowers(count: number): FlowerData[] {
  const flowers: FlowerData[] = []
  for (let i = 0; flowers.length < count && i < 150; i++) {
    const angle = srand(i * 17 + 200) * Math.PI * 2
    const dist = 30 + srand(i * 17 + 201) * 350
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    const gy = terrainHeight(x, z)
    if (gy > 15) continue
    if (isNearLake(x, z)) continue
    flowers.push({ x, z, gy })
  }
  return flowers
}

function Flowers() {
  const flowerData = useMemo(() => computeFlowers(20), [])
  const stemRef = useRef<THREE.InstancedMesh>(null)
  const petalRef = useRef<THREE.InstancedMesh>(null)
  const _obj = useMemo(() => new THREE.Object3D(), [])
  const stemMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4CAF50' }), [])
  const petalMat = useMemo(() => new THREE.MeshLambertMaterial(), [])
  const initRef = useRef(false)

  useFrame(() => {
    if (initRef.current || !stemRef.current || !petalRef.current) return
    initRef.current = true

    const colors = new Float32Array(flowerData.length * 3)
    for (let ci = 0; ci < flowerData.length; ci++) {
      const c = new THREE.Color(PETAL_COLORS[ci % PETAL_COLORS.length])
      colors[ci * 3] = c.r; colors[ci * 3 + 1] = c.g; colors[ci * 3 + 2] = c.b
    }
    petalRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)

    for (let i = 0; i < flowerData.length; i++) {
      const { x, z, gy } = flowerData[i]

      _obj.position.set(x, gy + 3, z)
      _obj.rotation.set(0, 0, 0)
      _obj.scale.set(0.8, 6, 0.8)
      _obj.updateMatrix()
      stemRef.current.setMatrixAt(i, _obj.matrix)

      _obj.position.set(x, gy + 7, z)
      _obj.scale.set(3, 3, 3)
      _obj.updateMatrix()
      petalRef.current.setMatrixAt(i, _obj.matrix)
    }

    stemRef.current.instanceMatrix.needsUpdate = true
    petalRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={stemRef} args={[undefined, undefined, flowerData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={stemMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={petalRef} args={[undefined, undefined, flowerData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={petalMat} attach="material" />
      </instancedMesh>
    </>
  )
}

/* ── Export ── */
export function LobbyTerrainObjects() {
  return (
    <>
      <Trees />
      <Rocks />
      <Flowers />
    </>
  )
}
