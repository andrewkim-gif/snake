'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { DEFAULT_SKINS } from '@snake-arena/shared'
import type { SnakeSkin } from '@snake-arena/shared'
import { createBodyTexture, createFaceTexture } from '@/lib/3d/voxel-textures'

/* ── Expression textures ── */

type Expression = 'normal' | 'blink' | 'happy' | 'surprised'

function pixelTex(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createExprTexture(skin: SnakeSkin, expr: Expression): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 16; c.height = 16
  const ctx = c.getContext('2d')!

  ctx.fillStyle = skin.primaryColor
  ctx.fillRect(0, 0, 16, 16)

  switch (expr) {
    case 'blink':
      // 눈 감음 — 가로 선
      ctx.fillStyle = '#222222'
      ctx.fillRect(3, 6, 4, 1)
      ctx.fillRect(9, 6, 4, 1)
      // 입
      ctx.fillStyle = '#444444'
      ctx.fillRect(6, 11, 4, 1)
      break

    case 'happy':
      // ^^ 눈 (웃는 눈)
      ctx.fillStyle = '#222222'
      ctx.fillRect(3, 6, 1, 1); ctx.fillRect(4, 5, 2, 1); ctx.fillRect(6, 6, 1, 1)
      ctx.fillRect(9, 6, 1, 1); ctx.fillRect(10, 5, 2, 1); ctx.fillRect(12, 6, 1, 1)
      // 볼 홍조
      ctx.fillStyle = '#FF9999'
      ctx.fillRect(2, 8, 3, 2)
      ctx.fillRect(11, 8, 3, 2)
      // 미소
      ctx.fillStyle = '#444444'
      ctx.fillRect(5, 11, 1, 1)
      ctx.fillRect(6, 12, 4, 1)
      ctx.fillRect(10, 11, 1, 1)
      break

    case 'surprised':
      // 큰 눈
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(2, 3, 5, 5)
      ctx.fillRect(9, 3, 5, 5)
      // 동공
      ctx.fillStyle = '#222222'
      ctx.fillRect(4, 4, 2, 3)
      ctx.fillRect(10, 4, 2, 3)
      // 하이라이트
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(5, 4, 1, 1)
      ctx.fillRect(11, 4, 1, 1)
      // O 입
      ctx.fillStyle = '#333333'
      ctx.fillRect(6, 10, 4, 3)
      ctx.fillStyle = '#5A3030'
      ctx.fillRect(7, 11, 2, 1)
      break
  }

  return pixelTex(c)
}

/* ── Expression animation sequence ── */
const EXPR_SEQ: { expr: Expression; dur: number }[] = [
  { expr: 'normal', dur: 2.8 },
  { expr: 'blink', dur: 0.12 },
  { expr: 'normal', dur: 1.5 },
  { expr: 'happy', dur: 1.8 },
  { expr: 'normal', dur: 2.2 },
  { expr: 'blink', dur: 0.12 },
  { expr: 'normal', dur: 1.0 },
  { expr: 'surprised', dur: 1.2 },
  { expr: 'blink', dur: 0.12 },
  { expr: 'normal', dur: 2.0 },
]

/* ── Camera: 얼굴 정면 고정 ── */
function FaceCamera() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0.5, 0.3, 3.5)
    camera.lookAt(0, 0, 0)
  }, [camera])
  return null
}

/* ── Face Preview Snake ── */
function FacePreviewSnake({ skinId }: { skinId: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const skin = useMemo(() => DEFAULT_SKINS[skinId] ?? DEFAULT_SKINS[0], [skinId])
  const bodyTex = useMemo(() => createBodyTexture(skin), [skin])
  const normalFaceTex = useMemo(() => createFaceTexture(skin), [skin])

  const exprTextures = useMemo(() => ({
    normal: normalFaceTex,
    blink: createExprTexture(skin, 'blink'),
    happy: createExprTexture(skin, 'happy'),
    surprised: createExprTexture(skin, 'surprised'),
  }), [skin, normalFaceTex])

  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ map: bodyTex }), [bodyTex])
  const faceMat = useMemo(() => new THREE.MeshLambertMaterial({ map: normalFaceTex }), [normalFaceTex])

  const headMats = useMemo(() => {
    const side = new THREE.MeshLambertMaterial({ map: bodyTex })
    return [side, side, side, side, faceMat, side]
  }, [bodyTex, faceMat])

  const timeRef = useRef(0)
  const seqRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta

    // 표정 순환
    const entry = EXPR_SEQ[seqRef.current]
    if (timeRef.current >= entry.dur) {
      timeRef.current = 0
      seqRef.current = (seqRef.current + 1) % EXPR_SEQ.length
      const next = EXPR_SEQ[seqRef.current]
      faceMat.map = exprTextures[next.expr]
      faceMat.needsUpdate = true
    }

    // 부드러운 아이들 모션 (회전 없이 미세 움직임)
    if (groupRef.current) {
      const t = performance.now() * 0.001
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.12
      groupRef.current.rotation.z = Math.sin(t * 0.35) * 0.04
      groupRef.current.position.y = Math.sin(t * 0.7) * 0.06
    }
  })

  const cubeSize = 1.0
  const headSize = cubeSize * 1.3
  const bodyCount = 5

  return (
    <group ref={groupRef}>
      {/* 머리 — 원점, 얼굴이 +Z (카메라 방향) */}
      <mesh position={[0, 0, 0]} material={headMats}>
        <boxGeometry args={[headSize, headSize, headSize]} />
      </mesh>
      {/* 몸통 — -Z 방향으로 뒤로 */}
      {Array.from({ length: bodyCount }, (_, i) => {
        const fromEnd = bodyCount - i
        const tailScale = fromEnd < 3 ? 0.5 + 0.5 * (fromEnd / 3) : 1.0
        const s = cubeSize * tailScale
        return (
          <mesh key={i} position={[0, 0, -(i + 1) * cubeSize * 0.7]}>
            <boxGeometry args={[s, s, s]} />
            <primitive object={bodyMat} attach="material" />
          </mesh>
        )
      })}
    </group>
  )
}

/* ── Export ── */
interface LobbySnakePreviewProps {
  skinId: number
  size?: number
}

export function LobbySnakePreview({ skinId, size = 120 }: LobbySnakePreviewProps) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 35, near: 0.1, far: 100 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 5]} intensity={0.9} />
        <FaceCamera />
        <FacePreviewSnake skinId={skinId} />
      </Canvas>
    </div>
  )
}
