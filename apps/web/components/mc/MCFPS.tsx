'use client'

// FPS 카운터

import { useRef, useState, useEffect } from 'react'

export default function MCFPS({ visible }: { visible: boolean }) {
  const [fps, setFps] = useState(0)
  const framesRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    if (!visible) return

    let rafId: number

    const tick = () => {
      framesRef.current++
      const now = performance.now()
      const elapsed = now - lastTimeRef.current

      if (elapsed >= 1000) {
        setFps(Math.round((framesRef.current * 1000) / elapsed))
        framesRef.current = 0
        lastTimeRef.current = now
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [visible])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        color: '#fff',
        fontSize: 14,
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.4)',
        padding: '2px 8px',
        borderRadius: 4,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {fps} FPS
    </div>
  )
}
