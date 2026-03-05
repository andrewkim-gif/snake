'use client'

import { Canvas } from '@react-three/fiber'
import { useState } from 'react'

function Box() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#5D9B3E" />
    </mesh>
  )
}

export default function Test3D() {
  const [status, setStatus] = useState('loading...')

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '8px 16px',
        fontFamily: 'monospace', fontSize: 14, borderRadius: 4,
      }}>
        Status: {status}
      </div>

      <Canvas
        flat
        gl={{ antialias: false, alpha: false }}
        camera={{ position: [5, 5, 5], fov: 50 }}
        dpr={1}
        style={{ width: '100%', height: '100%' }}
        onCreated={(state) => {
          const info = state.gl.info
          setStatus(`OK - renderer: ${state.gl.constructor.name}, programs: ${info.programs?.length ?? 0}`)
          const canvas = state.gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            setStatus('CONTEXT LOST!')
          })
        }}
        fallback={<div style={{ padding: 20, color: 'red' }}>WebGL not supported in this browser</div>}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <Box />
        <Ground />
      </Canvas>
    </div>
  )
}
