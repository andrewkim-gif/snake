'use client'

import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { useRef, useMemo, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { AgentNetworkData } from '@snake-arena/shared'
import { DEFAULT_SKINS } from '@snake-arena/shared'
import { segmentRotY } from '../../lib/3d/coordinate-utils'
import { createBodyTexture, createFaceTexture } from '../../lib/3d/voxel-textures'

interface VoxelSnakeProps {
  snakeId: string
  snakesRef: MutableRefObject<AgentNetworkData[]>
  isMe: boolean
  initialSkinId: number
}

const MAX_SEGMENTS = 200
const _obj = new THREE.Object3D()

export function VoxelSnake({ snakeId, snakesRef, isMe, initialSkinId }: VoxelSnakeProps) {
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.Mesh>(null)
  const billboardRef = useRef<THREE.Group>(null)
  const [name, setName] = useState('')

  const skin = useMemo(() => DEFAULT_SKINS[initialSkinId] ?? DEFAULT_SKINS[0], [initialSkinId])
  const bodyTex = useMemo(() => createBodyTexture(skin), [skin])
  const faceTex = useMemo(() => createFaceTexture(skin), [skin])
  const sideTex = useMemo(() => createBodyTexture(skin), [skin])

  // 머리 6면 머티리얼: 정면(+Z)만 얼굴, 나머지는 몸통 텍스처
  const headMaterials = useMemo(() => [
    new THREE.MeshLambertMaterial({ map: sideTex }),  // +X
    new THREE.MeshLambertMaterial({ map: sideTex }),  // -X
    new THREE.MeshLambertMaterial({ map: sideTex }),  // +Y
    new THREE.MeshLambertMaterial({ map: sideTex }),  // -Y
    new THREE.MeshLambertMaterial({ map: faceTex }),   // +Z (정면=얼굴)
    new THREE.MeshLambertMaterial({ map: sideTex }),  // -Z
  ], [faceTex, sideTex])

  // 부스트 머티리얼
  const bodyMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ map: bodyTex }),
    [bodyTex],
  )
  const boostRef = useRef(false)

  useFrame(() => {
    const data = snakesRef.current.find(s => s.i === snakeId)
    if (!data) return

    // v10: Agent는 단일 좌표 (x,y). p가 없으면 position에서 생성
    const segments = data.p ?? [[data.x, data.y]] as [number, number][]
    if (!bodyRef.current) return

    // 이름 동기화 (변경 시에만 setState)
    if (data.n !== name) setName(data.n)

    // 부스트 이펙트
    if (data.b !== boostRef.current) {
      boostRef.current = data.b
      bodyMaterial.emissive.set(data.b ? '#FFFFFF' : '#000000')
      bodyMaterial.emissiveIntensity = data.b ? 0.3 : 0
    }

    // 큐브 크기: mass 기반
    const cubeSize = Math.min(12, 6 + data.m * 0.005)

    // 몸통 세그먼트 (머리 제외)
    const bodyCount = segments.length - 1
    bodyRef.current.count = Math.min(bodyCount, MAX_SEGMENTS)

    for (let i = 1; i < segments.length && i <= MAX_SEGMENTS; i++) {
      const seg = segments[i]
      const rotY = segmentRotY(segments, i)

      // 꼬리 테이퍼링: 마지막 5개 점진 축소
      const fromEnd = segments.length - i
      const tailScale = fromEnd < 5 ? 0.5 + 0.5 * (fromEnd / 5) : 1.0
      const s = cubeSize * tailScale

      _obj.position.set(seg[0], s / 2, seg[1])
      _obj.rotation.set(0, rotY, 0)
      _obj.scale.set(s, s, s)
      _obj.updateMatrix()
      bodyRef.current.setMatrixAt(i - 1, _obj.matrix)
    }
    bodyRef.current.instanceMatrix.needsUpdate = true

    // 머리 위치/회전
    if (headRef.current && segments.length > 0) {
      const head = segments[0]
      const headSize = cubeSize * 1.3
      headRef.current.position.set(head[0], headSize / 2, head[1])
      headRef.current.rotation.set(0, -data.h, 0)
      headRef.current.scale.setScalar(headSize)
    }

    // 이름태그 Billboard 위치 갱신
    if (billboardRef.current && segments.length > 0) {
      billboardRef.current.position.set(segments[0][0], 20, segments[0][1])
    }
  }) // ⚠️ priority 인자 사용 금지 — non-zero는 R3F auto-render 비활성화

  return (
    <group>
      {/* 몸통: InstancedMesh */}
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, MAX_SEGMENTS]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={bodyMaterial} attach="material" />
      </instancedMesh>

      {/* 머리: 별도 Mesh (6면 머티리얼) */}
      <mesh ref={headRef} material={headMaterials}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      {/* 이름태그: Billboard + Text */}
      <Billboard ref={billboardRef} follow>
        <Text
          fontSize={isMe ? 6 : 5}
          color={isMe ? '#FFD700' : '#FFFFFF'}
          outlineWidth={0.4}
          outlineColor="#000000"
          anchorY="bottom"
          font="/fonts/PatrickHand-Regular.ttf"
        >
          {name}
        </Text>
      </Billboard>
    </group>
  )
}
