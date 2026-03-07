'use client';

/**
 * Debug Page — 인게임 즉시 진입 + 실시간 디버그 오버레이
 *
 * /debug 로 접속하면:
 *   1. 자동으로 랜덤 국가 아레나에 입장
 *   2. 실시간 카메라/입력 디버그 정보 오버레이
 *   3. ESC로 로비 복귀 없이 디버그 패널 토글
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createDefaultAppearance, packAppearance } from '@agent-survivor/shared';
import { useSocketContext } from '@/providers/SocketProvider';

const GameCanvas3D = dynamic(
  () => import('@/components/game/GameCanvas3D').then(m => ({ default: m.GameCanvas3D })),
  { ssr: false },
);

// 테스트용 국가 목록 (활성 아레나가 많은 국가)
const TEST_COUNTRIES = ['USA', 'KOR', 'JPN', 'GBR', 'DEU', 'FRA', 'CHN', 'BRA', 'IND', 'RUS'];

export default function DebugPage() {
  const [mode, setMode] = useState<'connecting' | 'playing'>('connecting');
  const [debugVisible, setDebugVisible] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState(TEST_COUNTRIES[0]);
  const [autoJoined, setAutoJoined] = useState(false);

  const {
    dataRef, uiState, joinCountryArena, leaveRoom, sendInput, sendInputV16,
    respawn, chooseUpgrade, dismissSynergyPopup, setGameMode,
  } = useSocketContext();

  // 자동 진입
  useEffect(() => {
    if (autoJoined) return;
    setAutoJoined(true);

    const name = `Debug${Math.floor(Math.random() * 9999)}`;
    const ap = packAppearance(createDefaultAppearance()).toString();
    const country = selectedCountry;
    joinCountryArena(country, name, country, 0, ap);
    setGameMode('transitioning');
  }, [autoJoined, joinCountryArena, selectedCountry, setGameMode]);

  // joined 감지 → playing
  useEffect(() => {
    if (mode === 'connecting' && uiState.currentRoomId) {
      setMode('playing');
      setGameMode('playing');
    }
  }, [mode, uiState.currentRoomId, setGameMode]);

  // 8초 타임아웃
  useEffect(() => {
    if (mode !== 'connecting') return;
    const timer = setTimeout(() => {
      // 타임아웃: 다른 국가로 재시도
      const idx = TEST_COUNTRIES.indexOf(selectedCountry);
      const next = TEST_COUNTRIES[(idx + 1) % TEST_COUNTRIES.length];
      setSelectedCountry(next);
      setAutoJoined(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [mode, selectedCountry]);

  // 디버그 패널 토글 (F1)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'F1') {
        e.preventDefault();
        setDebugVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleExit = useCallback(() => {
    leaveRoom();
    setMode('connecting');
    setAutoJoined(false);
  }, [leaveRoom]);

  if (mode === 'connecting') {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#111', color: '#E8E0D4', fontFamily: 'monospace',
        gap: 16,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>DEBUG MODE</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          Connecting to {selectedCountry} arena...
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
          Press F1 to toggle debug overlay
        </div>
      </div>
    );
  }

  return (
    <>
      <GameCanvas3D
        dataRef={dataRef}
        uiState={uiState}
        sendInput={sendInput}
        sendInputV16={sendInputV16}
        respawn={respawn}
        playerName={`Debug${Math.floor(Math.random() * 9999)}`}
        skinId={0}
        onExit={handleExit}
        chooseUpgrade={chooseUpgrade}
        dismissSynergyPopup={dismissSynergyPopup}
      />

      {/* 디버그 오버레이 */}
      {debugVisible && (
        <DebugOverlay dataRef={dataRef} uiState={uiState} />
      )}
    </>
  );
}

// ─── 디버그 오버레이 ───
function DebugOverlay({
  dataRef,
  uiState,
}: {
  dataRef: React.MutableRefObject<any>;
  uiState: any;
}) {
  const [info, setInfo] = useState<DebugInfo>({
    fps: 0,
    playerId: '',
    playerPos: { x: 0, y: 0 },
    playerHeading: 0,
    agentCount: 0,
    roomId: '',
    roomState: '',
    pointerLocked: false,
  });
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const update = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      // 매 500ms마다 FPS 업데이트
      if (elapsed >= 500) {
        const fps = Math.round((frameCountRef.current / elapsed) * 1000);
        frameCountRef.current = 0;
        lastTimeRef.current = now;

        const state = dataRef.current.latestState;
        const pid = dataRef.current.playerId;
        const myAgent = state?.s?.find((a: any) => a.i === pid);

        setInfo({
          fps,
          playerId: pid ?? '',
          playerPos: myAgent ? { x: Math.round(myAgent.x), y: Math.round(myAgent.y) } : { x: 0, y: 0 },
          playerHeading: myAgent?.h ?? 0,
          agentCount: state?.s?.length ?? 0,
          roomId: uiState.currentRoomId ?? '',
          roomState: uiState.roomState ?? '',
          pointerLocked: !!document.pointerLockElement,
        });
      }

      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [dataRef, uiState]);

  return (
    <div style={{
      position: 'fixed', top: 8, left: 8, zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11, padding: '8px 12px',
      borderRadius: 4, border: '1px solid #0f03',
      pointerEvents: 'none', lineHeight: 1.6,
      minWidth: 240,
    }}>
      <div style={{ color: '#ff0', fontWeight: 700, marginBottom: 4 }}>
        DEBUG (F1 toggle)
      </div>
      <div>FPS: <span style={{ color: info.fps >= 50 ? '#0f0' : info.fps >= 30 ? '#ff0' : '#f00' }}>{info.fps}</span></div>
      <div>Room: {info.roomId} ({info.roomState})</div>
      <div>Player: {info.playerId?.slice(0, 8)}...</div>
      <div>Pos: ({info.playerPos.x}, {info.playerPos.y})</div>
      <div>Heading: {(info.playerHeading * 180 / Math.PI).toFixed(1)}&deg;</div>
      <div>Agents: {info.agentCount}</div>
      <div>Pointer Lock: <span style={{ color: info.pointerLocked ? '#0f0' : '#f00' }}>
        {info.pointerLocked ? 'ON' : 'OFF (click to lock)'}
      </span></div>
      <div style={{ marginTop: 4, color: '#888', fontSize: 10 }}>
        WASD=move | Mouse=aim | Shift=boost | Space=jump | E=dash
      </div>
    </div>
  );
}

interface DebugInfo {
  fps: number;
  playerId: string;
  playerPos: { x: number; y: number };
  playerHeading: number;
  agentCount: number;
  roomId: string;
  roomState: string;
  pointerLocked: boolean;
}
