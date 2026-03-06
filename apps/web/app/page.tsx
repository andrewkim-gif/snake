'use client';

/**
 * Agent Survivor — Main Page
 * v10: 3D 로비 + 글래스모피즘 UI + 게임 모드 전환
 * LobbyScene3D 동적 임포트 (SSR 불가)
 * useSocket을 page.tsx에서 lift하여 lobby/playing 모드에 props 전달
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RoomList } from '@/components/lobby/RoomList';
import { RecentWinnersPanel } from '@/components/lobby/RecentWinnersPanel';
import { McPanel } from '@/components/lobby/McPanel';
import { McButton } from '@/components/lobby/McButton';
import { McInput } from '@/components/lobby/McInput';
import { CharacterCreator } from '@/components/lobby/CharacterCreator';
import { WelcomeTutorial } from '@/components/lobby/WelcomeTutorial';
import { useSocket } from '@/hooks/useSocket';
import { MC, pixelFont } from '@/lib/minecraft-ui';
// Three.js / R3F SSR 불가 → 동적 임포트
const LobbyScene3D = dynamic(
  () => import('@/components/3d/LobbyScene3D').then(m => ({ default: m.LobbyScene3D })),
  { ssr: false },
);
const GameCanvas3D = dynamic(
  () => import('@/components/game/GameCanvas3D').then(m => ({ default: m.GameCanvas3D })),
  { ssr: false },
);

/* ── 메인 홈 컴포넌트 ── */
export default function Home() {
  const [mode, setMode] = useState<'lobby' | 'transitioning' | 'playing'>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const {
    dataRef, uiState, joinRoom, leaveRoom, sendInput,
    respawn, chooseUpgrade, dismissSynergyPopup,
  } = useSocket();

  // localStorage에서 이름/스킨 복원
  useEffect(() => {
    const savedName = localStorage.getItem('agent-survivor-name');
    const savedSkin = localStorage.getItem('agent-survivor-skin');
    if (savedName) setPlayerName(savedName);
    if (savedSkin) setSkinId(parseInt(savedSkin, 10) || 0);
  }, []);

  // 이름/스킨 저장
  useEffect(() => {
    if (playerName) localStorage.setItem('agent-survivor-name', playerName);
  }, [playerName]);
  useEffect(() => {
    localStorage.setItem('agent-survivor-skin', String(skinId));
  }, [skinId]);

  const handleQuickJoin = useCallback(() => {
    const name = playerName || `Agent${Math.floor(Math.random() * 9999)}`;
    setFadeOut(true);
    setTimeout(() => {
      joinRoom('quick', name, skinId);
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [joinRoom, playerName, skinId]);

  const handleJoinRoom = useCallback((roomId: string) => {
    const name = playerName || `Agent${Math.floor(Math.random() * 9999)}`;
    setFadeOut(true);
    setTimeout(() => {
      joinRoom(roomId, name, skinId);
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [joinRoom, playerName, skinId]);

  const handleExit = useCallback(() => {
    leaveRoom();
    setMode('lobby');
  }, [leaveRoom]);

  // Lobby → Game 전환 시 WebGL context 충돌 방지 (200ms 딜레이)
  useEffect(() => {
    if (mode !== 'transitioning') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setMode('playing');
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode]);

  if (mode === 'transitioning') {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#87CEEB', fontFamily: pixelFont,
        fontSize: '0.6rem', color: '#FFF',
      }}>
        Loading game...
      </div>
    );
  }

  if (mode === 'playing') {
    return (
      <GameCanvas3D
        dataRef={dataRef}
        uiState={uiState}
        sendInput={sendInput}
        respawn={respawn}
        playerName={playerName}
        skinId={skinId}
        onExit={handleExit}
        chooseUpgrade={chooseUpgrade}
        dismissSynergyPopup={dismissSynergyPopup}
      />
    );
  }

  // ─── LOBBY ───
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 300ms ease',
    }}>
      <WelcomeTutorial />

      {/* 3D 배경 씬 */}
      <LobbyScene3D />

      {/* UI 오버레이 */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '0.8rem',
        padding: '1rem',
      }}>
        {/* 로고 */}
        <div style={{
          fontFamily: pixelFont,
          fontSize: '1.2rem',
          color: MC.textGold,
          textShadow: '3px 3px 0 #553300, -1px -1px 0 #000, 0 0 20px rgba(255,170,0,0.3)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '0.3rem',
        }}>
          Agent Survivor
        </div>
        <div style={{
          fontFamily: pixelFont,
          fontSize: '0.3rem',
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.08em',
          marginBottom: '0.5rem',
          textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
        }}>
          Survival Roguelike Auto-Battler
        </div>

        {/* 연결 상태 */}
        <div style={{
          fontFamily: pixelFont,
          fontSize: '0.25rem',
          color: uiState.connected ? MC.textGreen : MC.textRed,
          textShadow: uiState.connected
            ? '0 0 8px rgba(85,255,85,0.4)'
            : '0 0 8px rgba(255,85,85,0.4)',
        }}>
          {uiState.connected ? 'CONNECTED' : 'CONNECTING...'}
        </div>

        {/* 메인 패널: 2열 레이아웃 */}
        <div style={{
          display: 'flex',
          gap: '0.8rem',
          maxWidth: '800px',
          width: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {/* 좌: 플레이어 설정 + 참가 */}
          <McPanel style={{ flex: '1 1 320px', maxWidth: '400px', padding: '1rem' }}>
            <div style={{
              fontFamily: pixelFont, fontSize: '0.35rem', color: MC.textSecondary,
              marginBottom: '0.5rem', letterSpacing: '0.06em',
            }}>
              AGENT SETUP
            </div>

            <McInput
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter agent name..."
              style={{ marginBottom: '0.6rem' }}
            />

            <CharacterCreator skinId={skinId} onSelect={setSkinId} />

            <div style={{ marginTop: '0.8rem' }}>
              <McButton
                variant="green"
                onClick={handleQuickJoin}
                disabled={!uiState.connected}
                style={{ width: '100%', padding: '8px 0' }}
              >
                QUICK JOIN
              </McButton>
            </div>
          </McPanel>

          {/* 우: 룸 리스트 + 최근 우승자 */}
          <div style={{ flex: '1 1 320px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <McPanel style={{ padding: '0.8rem' }}>
              <div style={{
                fontFamily: pixelFont, fontSize: '0.35rem', color: MC.textSecondary,
                marginBottom: '0.4rem', letterSpacing: '0.06em',
              }}>
                GAME ROOMS
              </div>
              <RoomList
                rooms={uiState.rooms}
                onJoin={handleJoinRoom}
              />
            </McPanel>

            <McPanel style={{ padding: '0.8rem' }}>
              <RecentWinnersPanel winners={uiState.recentWinners} />
            </McPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
