'use client'

// Minecraft 메인 메뉴 / 일시정지 메뉴
// - 시작 화면: MINECRAFT 타이틀 + Play 버튼
// - 일시정지: Resume Game + Back to Lobby 버튼
// - ESC로 포인터 잠금 해제 시 자동 표시
// - Minecraft 스타일 다크 버튼 + 픽셀 미학

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

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

  // 로비로 돌아가기
  const handleBackToLobby = useCallback(() => {
    router.push('/')
  }, [router])

  // 플레이 중이고 포인터 잠긴 상태면 메뉴 숨김
  if (isPlaying && locked) return null

  // 일시정지 화면 (isPlaying && !locked)
  if (isPlaying && !locked) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)',
          zIndex: 200,
        }}
      >
        {/* 타이틀 */}
        <h2
          style={{
            fontFamily: 'monospace',
            fontSize: 28,
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '2px 2px 0 #333',
            marginBottom: 32,
            letterSpacing: 2,
          }}
        >
          {hasEnteredGame ? 'Game Paused' : 'Ready'}
        </h2>

        {/* Resume Game 버튼 */}
        <MenuButton onClick={onResume}>
          {hasEnteredGame ? 'Resume Game' : 'Start Game'}
        </MenuButton>

        {/* Back to Lobby 버튼 */}
        <div style={{ height: 8 }} />
        <MenuButton onClick={handleBackToLobby} variant="secondary">
          Back to Lobby
        </MenuButton>

        {/* 모드 표시 + 단축키 안내 */}
        <div
          style={{
            marginTop: 24,
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            lineHeight: 1.8,
          }}
        >
          <div>Press E or Click to resume | ESC to pause</div>
          <div style={{ color: 'rgba(255,255,200,0.5)', marginTop: 4 }}>
            Mode: {mode.toUpperCase()}
          </div>
        </div>
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
      {/* MINECRAFT 타이틀 */}
      <h1
        style={{
          fontFamily: 'monospace',
          fontSize: 52,
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '3px 3px 0 #333, 4px 4px 0 rgba(0,0,0,0.2)',
          marginBottom: 8,
          letterSpacing: 6,
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

      {/* Play 버튼 */}
      <MenuButton onClick={onPlay}>Play</MenuButton>

      {/* Back to Lobby 버튼 */}
      <div style={{ height: 8 }} />
      <MenuButton onClick={handleBackToLobby} variant="secondary">
        Back to Lobby
      </MenuButton>

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

// ---------------------------------------------------------------------------
// Minecraft 스타일 버튼 컴포넌트
// ---------------------------------------------------------------------------
function MenuButton({
  onClick,
  children,
  variant = 'primary',
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  const isPrimary = variant === 'primary'

  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'monospace',
        fontSize: isPrimary ? 18 : 16,
        fontWeight: 'bold',
        color: '#fff',
        background: isPrimary
          ? 'rgba(76, 175, 80, 0.7)'
          : 'rgba(0,0,0,0.5)',
        border: `2px solid ${isPrimary ? '#66BB6A' : '#555'}`,
        borderRadius: 4,
        padding: isPrimary ? '10px 48px' : '8px 48px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        minWidth: 220,
        textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
      }}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = 'rgba(76, 175, 80, 0.9)'
          e.currentTarget.style.borderColor = '#81C784'
        } else {
          e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
          e.currentTarget.style.borderColor = '#aaa'
        }
      }}
      onMouseLeave={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = 'rgba(76, 175, 80, 0.7)'
          e.currentTarget.style.borderColor = '#66BB6A'
        } else {
          e.currentTarget.style.background = 'rgba(0,0,0,0.5)'
          e.currentTarget.style.borderColor = '#555'
        }
      }}
    >
      {children}
    </button>
  )
}
