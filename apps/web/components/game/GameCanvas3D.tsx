'use client'

import { Canvas } from '@react-three/fiber'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { RootState } from '@react-three/fiber'
import type { GameData, UiState } from '../../hooks/useSocket'
import type { AgentNetworkData } from '@snake-arena/shared'
import { ARENA_CONFIG } from '@snake-arena/shared'
import { clearTextureCache } from '../../lib/3d/voxel-textures'

import { Suspense } from 'react'
import { Scene } from '../3d/Scene'
import { CameraSystem } from '../3d/CameraSystem'
import { SkyBox } from '../3d/SkyBox'
import { VoxelTerrain } from '../3d/VoxelTerrain'
import { VoxelBoundary } from '../3d/VoxelBoundary'
import { SnakeGroup } from '../3d/SnakeGroup'
import { VoxelOrbs } from '../3d/VoxelOrbs'
import { GameLoop } from '../3d/GameLoop'

// 기존 오버레이 재사용
import { RoundTimerHUD } from './RoundTimerHUD'
import { CountdownOverlay } from './CountdownOverlay'
import { RoundResultOverlay } from './RoundResultOverlay'
import type { BuildSummary } from './RoundResultOverlay'
import { DeathOverlay } from './DeathOverlay'

// v10 새 오버레이
import { LevelUpOverlay } from './LevelUpOverlay'
import { BuildHUD } from './BuildHUD'
import type { BuildData } from './BuildHUD'
import { XPBar } from './XPBar'
import { ShrinkWarning } from './ShrinkWarning'
import { SynergyPopup } from './SynergyPopup'

// Phase 5: Coach + Analyst
import { CoachOverlay } from './CoachOverlay'
import { AnalystPanel } from './AnalystPanel'

interface GameCanvas3DProps {
  dataRef: React.MutableRefObject<GameData>
  uiState: UiState
  sendInput: (angle: number, boost: boolean, seq: number) => void
  respawn: (name?: string, skinId?: number) => void
  playerName: string
  skinId: number
  onExit: () => void
  chooseUpgrade?: (choiceId: string) => void
  dismissSynergyPopup?: (synergyId: string) => void
}

export default function GameCanvas3D({
  dataRef, uiState, sendInput, respawn, playerName, skinId, onExit,
  chooseUpgrade, dismissSynergyPopup,
}: GameCanvas3DProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [canvasError, setCanvasError] = useState<string | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)
  const inputSeqRef = useRef(0)
  const angleRef = useRef(0)
  const boostRef = useRef(false)

  // 보간된 스네이크 상태 (useFrame에서 업데이트, ref로 관리)
  const snakesRef = useRef<AgentNetworkData[]>([])
  const cameraTargetRef = useRef({ x: 0, z: 0, mass: 10 })

  const handleCreated = useCallback((state: RootState) => {
    const canvas = state.gl?.domElement
    if (!canvas) {
      setCanvasError('No canvas element')
      return
    }
    canvas.addEventListener('webglcontextlost', (e: Event) => {
      e.preventDefault()
      setContextLost(true)
    })
    canvas.addEventListener('webglcontextrestored', () => {
      clearTextureCache()
      setContextLost(false)
    })
  }, [])

  // 언마운트 시 텍스처 캐시 정리
  useEffect(() => {
    return () => {
      clearTextureCache()
    }
  }, [])

  // 키보드 입력 처리
  const keysRef = useRef({ up: false, down: false, left: false, right: false })

  const updateAngle = useCallback(() => {
    const k = keysRef.current
    let dx = 0, dy = 0
    if (k.right) dx += 1
    if (k.left) dx -= 1
    if (k.down) dy += 1
    if (k.up) dy -= 1
    if (dx === 0 && dy === 0) return
    let angle = Math.atan2(dy, dx)
    if (angle < 0) angle += Math.PI * 2
    angleRef.current = angle
    inputSeqRef.current++
    sendInput(angle, boostRef.current, inputSeqRef.current)
  }, [sendInput])

  // 키 이벤트 등록 (useEffect로 올바르게 cleanup)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        setMenuOpen(prev => !prev)
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        boostRef.current = true
        inputSeqRef.current++
        sendInput(angleRef.current, true, inputSeqRef.current)
        return
      }
      const dirMap: Record<string, string> = {
        KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
        KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      }
      const dir = dirMap[e.code]
      if (dir) {
        e.preventDefault()
        ;(keysRef.current as any)[dir] = true
        updateAngle()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        boostRef.current = false
        inputSeqRef.current++
        sendInput(angleRef.current, false, inputSeqRef.current)
        return
      }
      const dirMap: Record<string, string> = {
        KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
        KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      }
      const dir = dirMap[e.code]
      if (dir) {
        ;(keysRef.current as any)[dir] = false
        updateAngle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [sendInput, updateAngle])

  const handleRespawn = useCallback(() => {
    const rs = uiState.roomState
    if (rs === 'ending' || rs === 'cooldown') return
    respawn(playerName, skinId)
  }, [respawn, playerName, skinId, uiState.roomState])

  // 현재 플레이어 정보 추출 (for BuildHUD, XPBar, ShrinkWarning)
  const myAgent = useMemo(() => {
    const state = dataRef.current.latestState
    if (!state || !dataRef.current.playerId) return null
    return state.s.find(a => a.i === dataRef.current.playerId) ?? null
  }, [dataRef.current.latestState?.t, dataRef.current.playerId])

  // Build data (extracted from agent state or estimated)
  // In real implementation, server would send build data; for now we display level info
  const buildData: BuildData | null = null // Will be populated when server sends build state

  // Player distance from center (for ShrinkWarning)
  const playerDistance = myAgent
    ? Math.sqrt(myAgent.x * myAgent.x + myAgent.y * myAgent.y)
    : 0

  const currentRadius = uiState.arenaShrink?.currentRadius ?? ARENA_CONFIG.radius

  const showTimer = uiState.roomState === 'playing' && uiState.timeRemaining > 0
  const showCountdown = uiState.roomState === 'countdown' && uiState.countdown !== null && uiState.countdown > 0
  const showRoundResult = uiState.roomState === 'ending' && uiState.roundEnd !== null
  const showCooldown = uiState.roomState === 'cooldown'
  const showWaiting = uiState.roomState === 'waiting'
  const showDeath = uiState.deathInfo && !showRoundResult && !showCooldown && uiState.roomState !== 'ending'
  const showLevelUp = uiState.levelUp !== null && uiState.alive && !showDeath && !showRoundResult

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#87CEEB' }}>
      <Canvas
        key={canvasKey}
        dpr={[1, 1]}
        gl={{ antialias: true }}
        camera={{ fov: 50, near: 1, far: 1500, position: [0, 300, 180] }}
        style={{ background: '#87CEEB' }}
        onCreated={handleCreated}
      >
        <Scene />
        <SkyBox />
        <VoxelTerrain radius={ARENA_CONFIG.radius} />
        <VoxelBoundary radius={ARENA_CONFIG.radius} />
        <GameLoop
          dataRef={dataRef}
          angleRef={angleRef}
          snakesRef={snakesRef}
          cameraTargetRef={cameraTargetRef}
        />
        <CameraSystem
          mode="play"
          cameraTargetRef={cameraTargetRef}
        />
        <Suspense fallback={null}>
          <SnakeGroup
            snakesRef={snakesRef}
            dataRef={dataRef}
          />
        </Suspense>
        <VoxelOrbs dataRef={dataRef} />
      </Canvas>

      {/* WebGL context lost overlay (Canvas stays mounted for recovery) */}
      {(contextLost || canvasError) && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
          backgroundColor: 'rgba(135, 206, 235, 0.95)',
          fontFamily: '"Patrick Hand", sans-serif', color: '#333', zIndex: 50,
        }}>
          <div style={{ fontSize: '1.5rem' }}>{canvasError || 'WebGL Context Lost'}</div>
          <button onClick={() => { clearTextureCache(); setContextLost(false); setCanvasError(null); setCanvasKey(k => k + 1) }}
            style={menuBtnStyle}>Retry</button>
          <button onClick={onExit} style={menuBtnStyle}>Exit to Lobby</button>
        </div>
      )}

      {/* v10 ShrinkWarning (always mounted, conditionally visible) */}
      <ShrinkWarning
        shrinkData={uiState.arenaShrink}
        playerDistance={playerDistance}
        currentRadius={currentRadius}
      />

      {/* v10 Synergy Popup (toast notifications) */}
      {dismissSynergyPopup && (
        <SynergyPopup
          synergies={uiState.synergyPopups}
          onDismiss={dismissSynergyPopup}
        />
      )}

      {/* v10 BuildHUD (bottom-left build info) */}
      <BuildHUD build={buildData} />

      {/* v10 XP Bar (bottom, full width) */}
      {myAgent && (
        <XPBar
          level={myAgent.lv ?? 1}
          xp={0}
          xpToNext={100}
        />
      )}

      {/* HTML 오버레이 (기존 컴포넌트 100% 재사용) */}
      {showTimer && <RoundTimerHUD timeRemaining={uiState.timeRemaining} />}
      {showCountdown && <CountdownOverlay initialCount={uiState.countdown!} />}
      {showRoundResult && (
        <RoundResultOverlay
          roundEnd={uiState.roundEnd!}
          deathInfo={uiState.deathInfo}
          analysisPanel={<AnalystPanel analysis={uiState.roundAnalysis ?? null} />}
        />
      )}
      {showCooldown && <WaitingBanner text="Next round starting soon..." />}
      {showWaiting && <WaitingBanner text="Waiting for players..." />}
      {showDeath && !showLevelUp && <DeathOverlay deathInfo={uiState.deathInfo!} onRespawn={handleRespawn} />}

      {/* Phase 5: Coach Overlay (during gameplay) */}
      <CoachOverlay message={uiState.coachMessage ?? null} />

      {/* v10 LevelUp Overlay (highest priority gameplay overlay) */}
      {showLevelUp && chooseUpgrade && (
        <LevelUpOverlay
          levelUp={uiState.levelUp!}
          onChoose={chooseUpgrade}
        />
      )}

      {menuOpen && (
        <PauseMenu onResume={() => setMenuOpen(false)} onExit={onExit} />
      )}
    </div>
  )
}

function WaitingBanner({ text }: { text: string }) {
  return (
    <div style={{
      position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, fontFamily: '"Patrick Hand", "Inter", sans-serif',
      fontSize: '1.1rem', fontWeight: 700, color: '#6B5E52',
      backgroundColor: 'rgba(245, 240, 232, 0.85)',
      padding: '6px 20px', borderRadius: '4px',
      border: '1.5px solid #A89888', letterSpacing: '0.03em',
    }}>
      {text}
    </div>
  )
}

function PauseMenu({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(30, 30, 30, 0.85)', zIndex: 50,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <button onClick={onResume} style={menuBtnStyle}>Resume</button>
        <button onClick={onExit} style={menuBtnStyle}>Exit to Lobby</button>
      </div>
    </div>
  )
}

const menuBtnStyle: React.CSSProperties = {
  padding: '12px 32px', fontSize: '1.1rem', fontWeight: 700,
  fontFamily: '"Patrick Hand", "Inter", sans-serif',
  cursor: 'pointer', border: '2px solid #555',
  borderRadius: '4px', backgroundColor: '#444', color: '#FFF',
}
