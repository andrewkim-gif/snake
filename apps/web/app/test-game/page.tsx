'use client'

/**
 * 🔴 DIAGNOSTIC PAGE: 인게임 3D 렌더링 진단
 * 소켓 없이 GameCanvas3D의 3D 컴포넌트만 독립 테스트
 * http://localhost:9002/test-game 에서 확인
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useState, useRef, useEffect, Suspense } from 'react'
import * as THREE from 'three'
import type { RootState } from '@react-three/fiber'

// 게임에서 사용하는 실제 컴포넌트 import
import { Scene } from '@/components/3d/Scene'
import { SkyBox } from '@/components/3d/SkyBox'
import { VoxelTerrain } from '@/components/3d/VoxelTerrain'
import { VoxelBoundary } from '@/components/3d/VoxelBoundary'
import { ARENA_CONFIG } from '@snake-arena/shared'

// 진단 상태 추적
const diagnosticLog: string[] = []
function log(msg: string) {
  const t = `[${(performance.now() / 1000).toFixed(2)}s] ${msg}`
  diagnosticLog.push(t)
  console.log(t)
}

/** 매 프레임 상태 확인 (첫 10프레임만) */
function FrameLogger() {
  const frameRef = useRef(0)
  const { camera, scene, gl } = useThree()

  useEffect(() => {
    log(`FrameLogger mounted — camera: [${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}]`)
    log(`  scene.children: ${scene.children.length}, background: ${scene.background ? 'SET' : 'NULL'}, fog: ${scene.fog ? 'SET' : 'NULL'}`)
    log(`  renderer: ${gl.constructor.name}, size: ${gl.domElement.width}x${gl.domElement.height}`)
  }, [camera, scene, gl])

  useFrame(() => {
    frameRef.current++
    if (frameRef.current <= 5) {
      log(`Frame ${frameRef.current}: children=${scene.children.length}, bg=${scene.background ? 'OK' : 'NULL'}, fog=${scene.fog ? 'OK' : 'NULL'}`)
    }
  })

  return null
}

/** 테스트 단계별 Canvas */
type TestLevel = 'minimal' | 'scene-only' | 'scene+terrain' | 'full-game'

const LEVELS: TestLevel[] = ['minimal', 'scene-only', 'scene+terrain', 'full-game']

function TestCanvas({ level }: { level: TestLevel }) {
  const [status, setStatus] = useState('initializing...')

  const handleCreated = (state: RootState) => {
    const info = {
      renderer: state.gl.constructor.name,
      canvasSize: `${state.gl.domElement.width}x${state.gl.domElement.height}`,
      cameraPos: `[${state.camera.position.x.toFixed(0)}, ${state.camera.position.y.toFixed(0)}, ${state.camera.position.z.toFixed(0)}]`,
      sceneChildren: state.scene.children.length,
    }
    log(`Canvas created for level="${level}": ${JSON.stringify(info)}`)
    setStatus(`OK - ${info.renderer} ${info.canvasSize}`)
  }

  return (
    <div style={{ width: '100%', height: '400px', border: '2px solid #333', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 4, left: 4, zIndex: 10,
        background: 'rgba(0,0,0,0.8)', color: '#0f0', padding: '4px 8px',
        fontFamily: 'monospace', fontSize: 12, borderRadius: 4,
      }}>
        Level: {level} | Status: {status}
      </div>
      <Canvas
        flat
        gl={{ antialias: false, alpha: false }}
        camera={{ fov: 50, near: 1, far: 1500, position: [0, 300, 180] }}
        dpr={1}
        style={{ width: '100%', height: '100%', background: '#000' }}
        onCreated={handleCreated}
        fallback={
          <div style={{ color: 'red', padding: 20, fontSize: 24, background: '#300' }}>
            ❌ WebGL FAILED for level=&quot;{level}&quot;
          </div>
        }
      >
        <FrameLogger />

        {/* Level 1: 최소 — 조명 + 빨간 큐브만 */}
        {level === 'minimal' && (
          <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[100, 150, 80]} intensity={0.8} />
            <mesh position={[0, 50, 0]}>
              <boxGeometry args={[100, 100, 100]} />
              <meshStandardMaterial color="#FF0000" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
              <planeGeometry args={[500, 500]} />
              <meshStandardMaterial color="#5D9B3E" />
            </mesh>
          </>
        )}

        {/* Level 2: Scene 컴포넌트만 (fog + background + light) */}
        {level === 'scene-only' && (
          <>
            <Scene />
            <mesh position={[0, 50, 0]}>
              <boxGeometry args={[100, 100, 100]} />
              <meshBasicMaterial color="#FF0000" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
              <planeGeometry args={[500, 500]} />
              <meshLambertMaterial color="#5D9B3E" />
            </mesh>
          </>
        )}

        {/* Level 3: Scene + VoxelTerrain + SkyBox */}
        {level === 'scene+terrain' && (
          <>
            <Scene />
            <SkyBox />
            <VoxelTerrain radius={ARENA_CONFIG.radius} />
            <VoxelBoundary radius={ARENA_CONFIG.radius} />
            <mesh position={[0, 50, 0]}>
              <boxGeometry args={[50, 50, 50]} />
              <meshBasicMaterial color="#FF0000" />
            </mesh>
          </>
        )}

        {/* Level 4: 풀 게임 구성 (뱀/오브 제외 — 데이터 불필요 컴포넌트만) */}
        {level === 'full-game' && (
          <>
            <Scene />
            <SkyBox />
            <VoxelTerrain radius={ARENA_CONFIG.radius} />
            <VoxelBoundary radius={ARENA_CONFIG.radius} />
            <mesh position={[0, 50, 0]}>
              <boxGeometry args={[50, 50, 50]} />
              <meshBasicMaterial color="#FF0000" />
            </mesh>
          </>
        )}
      </Canvas>
    </div>
  )
}

export default function TestGamePage() {
  const [currentLevel, setCurrentLevel] = useState<TestLevel>('minimal')
  const [logs, setLogs] = useState<string[]>([])

  // 로그 주기적 갱신
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...diagnosticLog])
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', background: '#1a1a1a', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ color: '#FF0', fontSize: 18 }}>🔴 In-Game 3D Diagnostic</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {LEVELS.map(level => (
          <button
            key={level}
            onClick={() => { diagnosticLog.length = 0; setCurrentLevel(level); }}
            style={{
              padding: '8px 16px', fontFamily: 'monospace',
              background: currentLevel === level ? '#4a4' : '#333',
              color: '#fff', border: '1px solid #666', cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            {level}
          </button>
        ))}
      </div>

      <p style={{ color: '#aaa', fontSize: 12, margin: '4px 0 12px' }}>
        Camera: [0, 300, 180] looking at origin | Same config as GameCanvas3D (flat, no-AA, alpha:false, dpr:1)
      </p>

      {/* Canvas 영역 */}
      <TestCanvas key={currentLevel} level={currentLevel} />

      {/* 로그 */}
      <div style={{
        marginTop: 16, padding: 12, background: '#111', border: '1px solid #333',
        maxHeight: 300, overflow: 'auto', fontSize: 11, lineHeight: '1.6',
      }}>
        <div style={{ color: '#888', marginBottom: 4 }}>Diagnostic Log:</div>
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.includes('❌') ? '#f44' : l.includes('OK') ? '#4f4' : '#ccc' }}>
            {l}
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: '#666' }}>Waiting for events...</div>}
      </div>
    </div>
  )
}
