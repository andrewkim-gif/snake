'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  BLOCK_SIZE, TERRAIN_RADIUS, CENTER_CLEAR,
  LAKES, terrainHeight, isNearLake,
} from '@/lib/3d/terrain-noise'

/* ── 지형 컬럼 데이터 사전 계산 ── */
interface ColumnData { x: number; z: number; height: number }

function computeColumns(): ColumnData[] {
  const columns: ColumnData[] = []
  const halfGrid = Math.ceil(TERRAIN_RADIUS / BLOCK_SIZE)

  for (let gx = -halfGrid; gx <= halfGrid; gx++) {
    for (let gz = -halfGrid; gz <= halfGrid; gz++) {
      const x = gx * BLOCK_SIZE
      const z = gz * BLOCK_SIZE
      const dist = Math.sqrt(x * x + z * z)
      if (dist > TERRAIN_RADIUS || dist < CENTER_CLEAR * 0.8) continue

      const h = terrainHeight(x, z)
      if (h > 1) columns.push({ x, z, height: h })
    }
  }

  return columns
}

/* ── 지형 컬럼 + 잔디/눈 캡 ── */
function TerrainColumns() {
  const columnRef = useRef<THREE.InstancedMesh>(null)
  const capRef = useRef<THREE.InstancedMesh>(null)

  const columns = useMemo(() => computeColumns(), [])
  const _obj = useMemo(() => new THREE.Object3D(), [])
  const columnMat = useMemo(() => new THREE.MeshLambertMaterial(), [])
  const capMat = useMemo(() => new THREE.MeshLambertMaterial(), [])
  const initRef = useRef(false)

  useFrame(() => {
    if (initRef.current || !columnRef.current || !capRef.current) return
    initRef.current = true

    const count = columns.length
    const colColors = new Float32Array(count * 3)
    const capColors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const { x, z, height } = columns[i]
      const nearLake = isNearLake(x, z)

      // Column body
      _obj.position.set(x, height / 2, z)
      _obj.rotation.set(0, 0, 0)
      _obj.scale.set(BLOCK_SIZE, height, BLOCK_SIZE)
      _obj.updateMatrix()
      columnRef.current!.setMatrixAt(i, _obj.matrix)

      // Cap (thin slab on top)
      _obj.position.set(x, height + 1, z)
      _obj.scale.set(BLOCK_SIZE + 0.5, 2, BLOCK_SIZE + 0.5)
      _obj.updateMatrix()
      capRef.current!.setMatrixAt(i, _obj.matrix)

      // Column body color: sand near lake, dirt/stone/dark by height
      let cc: THREE.Color
      if (height < 12) cc = new THREE.Color(nearLake ? '#C4B060' : '#8B6B3A')
      else if (height < 30) cc = new THREE.Color('#777777')
      else cc = new THREE.Color('#5A5A5A')
      colColors[i * 3] = cc.r; colColors[i * 3 + 1] = cc.g; colColors[i * 3 + 2] = cc.b

      // Cap color: sand / grass / stone / snow
      let capC: THREE.Color
      if (height < 20) capC = new THREE.Color(nearLake ? '#D4C36A' : '#4A8C32')
      else if (height < 40) capC = new THREE.Color('#888888')
      else capC = new THREE.Color('#EEEEEE')
      capColors[i * 3] = capC.r; capColors[i * 3 + 1] = capC.g; capColors[i * 3 + 2] = capC.b
    }

    columnRef.current!.instanceColor = new THREE.InstancedBufferAttribute(colColors, 3)
    capRef.current!.instanceColor = new THREE.InstancedBufferAttribute(capColors, 3)
    columnRef.current!.instanceMatrix.needsUpdate = true
    capRef.current!.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={columnRef} args={[undefined, undefined, columns.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={columnMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, columns.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={capMat} attach="material" />
      </instancedMesh>
    </>
  )
}

/* ── 호수 (물) ── */
function WaterLakes() {
  return (
    <>
      {LAKES.map((lake, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[lake.cx, 0.3, lake.cz]}>
          <circleGeometry args={[lake.radius, 32]} />
          <meshBasicMaterial color="#2E7DB0" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

/* ── Export ── */
export function LobbyHills() {
  return (
    <>
      <TerrainColumns />
      <WaterLakes />
    </>
  )
}
