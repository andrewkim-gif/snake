'use client';

/**
 * Agent Survivor — Main Page
 * v10: 3D 로비 + MC 레트로 UI + 게임 모드 전환
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
import { PixelLogo } from '@/components/lobby/PixelLogo';
import { useSocket } from '@/hooks/useSocket';
import { MC, MCFont, pixelFont } from '@/lib/minecraft-ui';

const LobbyScene3D = dynamic(
  () => import('@/components/3d/LobbyScene3D').then(m => ({ default: m.LobbyScene3D })),
  { ssr: false },
);
const GameCanvas3D = dynamic(
  () => import('@/components/game/GameCanvas3D').then(m => ({ default: m.GameCanvas3D })),
  { ssr: false },
);

export default function Home() {
  const [mode, setMode] = useState<'lobby' | 'transitioning' | 'playing'>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const {
    dataRef, uiState, joinRoom, leaveRoom, sendInput,
    respawn, chooseUpgrade, dismissSynergyPopup,
  } = useSocket();

  useEffect(() => {
    const savedName = localStorage.getItem('agent-survivor-name');
    const savedSkin = localStorage.getItem('agent-survivor-skin');
    if (savedName) setPlayerName(savedName);
    if (savedSkin) setSkinId(parseInt(savedSkin, 10) || 0);
  }, []);

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
        fontSize: '16px', color: '#FFF',
        textShadow: '2px 2px 0 rgba(0,0,0,0.3)',
      }}>
        Loading arena...
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
      <LobbyScene3D />

      {/* UI 오버레이 */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '14px',
        padding: 'clamp(10px, 3vw, 20px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        {/* 로고 */}
        <PixelLogo />

        {/* 연결 상태 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{
            width: '8px', height: '8px',
            backgroundColor: uiState.connected ? MC.textGreen : MC.textRed,
            boxShadow: uiState.connected
              ? '0 0 8px rgba(85,255,85,0.6)'
              : '0 0 8px rgba(255,85,85,0.6)',
          }} />
          <span style={{
            fontFamily: pixelFont,
            fontSize: MCFont.sm,
            color: uiState.connected ? MC.textGreen : MC.textRed,
            textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
          }}>
            {uiState.connected ? 'ONLINE' : 'CONNECTING...'}
          </span>
        </div>

        {/* 메인 패널: 2열 레이아웃 */}
        <div style={{
          display: 'flex',
          gap: '16px',
          maxWidth: '860px',
          width: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {/* 좌: 플레이어 설정 + 참가 */}
          <McPanel style={{ flex: '1 1 340px', maxWidth: '420px', padding: '16px' }}>
            <div style={{
              fontFamily: pixelFont, fontSize: MCFont.h2, color: MC.textGold,
              marginBottom: '12px', letterSpacing: '1px',
              textShadow: '1px 1px 0 #553300',
            }}>
              AGENT SETUP
            </div>

            <McInput
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter agent name..."
              style={{ marginBottom: '14px' }}
            />

            <CharacterCreator skinId={skinId} onSelect={setSkinId} />

            <div style={{ marginTop: '16px' }}>
              <McButton
                variant="green"
                onClick={handleQuickJoin}
                disabled={!uiState.connected}
                style={{ width: '100%', padding: '12px 0', fontSize: MCFont.h2 }}
              >
                ⚔ QUICK JOIN ⚔
              </McButton>
            </div>
          </McPanel>

          {/* 우: 룸 리스트 + 최근 우승자 */}
          <div style={{
            flex: '1 1 340px', maxWidth: '420px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            <McPanel style={{ padding: '14px' }}>
              <div style={{
                fontFamily: pixelFont, fontSize: MCFont.h2, color: MC.textGold,
                marginBottom: '10px', letterSpacing: '1px',
                textShadow: '1px 1px 0 #553300',
              }}>
                GAME ROOMS
              </div>
              <RoomList rooms={uiState.rooms} onJoin={handleJoinRoom} />
            </McPanel>

            <McPanel style={{ padding: '14px' }}>
              <RecentWinnersPanel winners={uiState.recentWinners} />
            </McPanel>
          </div>
        </div>

        {/* 하단 버전 배지 */}
        <div style={{
          fontFamily: pixelFont,
          fontSize: MCFont.xs,
          color: 'rgba(255,255,255,0.25)',
          textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
          letterSpacing: '1px',
        }}>
          v10.0 ALPHA
        </div>
      </div>
    </div>
  );
}
