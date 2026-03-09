'use client'

// Minecraft 크로스헤어 (화면 중앙 + 자)

export default function MCCrosshair({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* 가로 */}
      <div
        style={{
          position: 'absolute',
          width: 24,
          height: 2,
          background: 'rgba(255,255,255,0.8)',
          left: -12,
          top: -1,
          mixBlendMode: 'difference',
        }}
      />
      {/* 세로 */}
      <div
        style={{
          position: 'absolute',
          width: 2,
          height: 24,
          background: 'rgba(255,255,255,0.8)',
          left: -1,
          top: -12,
          mixBlendMode: 'difference',
        }}
      />
    </div>
  )
}
