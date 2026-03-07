'use client'

// Minecraft 메인 메뉴 / 일시정지 메뉴

import { useCallback, useEffect } from 'react'
import { PlayerMode } from '@/lib/3d/mc-types'

interface MCMenuProps {
  isPlaying: boolean
  locked: boolean
  hasEnteredGame: boolean // true: 한 번이라도 잠금된 적 있음
  mode: PlayerMode
  onPlay: () => void
  onResume: () => void
}

export default function MCMenu({
  isPlaying,
  locked,
  hasEnteredGame,
  mode,
  onPlay,
  onResume,
}: MCMenuProps) {
  // E키로 재개 (플레이 중 + 잠금해제 상태)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && isPlaying && !locked) {
        onResume()
      }
    },
    [isPlaying, locked, onResume]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 플레이 중이고 포인터 잠긴 상태면 메뉴 숨김
  if (isPlaying && locked) return null

  // 일시정지 화면 (isPlaying && !locked): 클릭하면 재개
  if (isPlaying && !locked) {
    return (
      <div
        onClick={onResume}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
          cursor: 'pointer',
        }}
      >
        <h2
          style={{
            fontFamily: 'monospace',
            fontSize: 24,
            color: '#fff',
            textShadow: '2px 2px 0 #333',
            marginBottom: 16,
          }}
        >
          {hasEnteredGame ? 'Game Paused' : 'Ready'}
        </h2>
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: 16,
            color: 'rgba(255,255,255,0.8)',
            marginBottom: 8,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          Click anywhere to {hasEnteredGame ? 'resume' : 'start'}
        </p>
        {hasEnteredGame && (
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Press E to resume | ESC to pause
          </p>
        )}
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'rgba(255,255,200,0.5)',
            marginTop: 16,
          }}
        >
          Mode: {mode.toUpperCase()}
        </p>
      </div>
    )
  }

  // 시작 화면
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(180deg, #87ceeb 0%, #5ba3cf 50%, #3a7ca5 100%)',
        zIndex: 200,
      }}
    >
      {/* 타이틀 */}
      <h1
        style={{
          fontFamily: 'monospace',
          fontSize: 48,
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '3px 3px 0 #333',
          marginBottom: 8,
          letterSpacing: 4,
        }}
      >
        MINECRAFT
      </h1>
      <p
        style={{
          fontFamily: 'monospace',
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 40,
        }}
      >
        R3F Edition
      </p>

      <MenuButton onClick={onPlay}>Play</MenuButton>

      {/* 조작법 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          lineHeight: 1.8,
        }}
      >
        <div>WASD: Move | Space: Jump | Mouse: Look</div>
        <div>Left Click: Break | Right Click: Place</div>
        <div>1-9: Select Block | Scroll: Cycle | Q: Fly Mode</div>
        <div>E / Esc: Menu</div>
      </div>
    </div>
  )
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'monospace',
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        background: 'rgba(0,0,0,0.5)',
        border: '2px solid #555',
        borderRadius: 4,
        padding: '10px 48px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        minWidth: 220,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
        e.currentTarget.style.borderColor = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.5)'
        e.currentTarget.style.borderColor = '#555'
      }}
    >
      {children}
    </button>
  )
}
