'use client';

/**
 * AI World War — Main Page
 * 작전 지도 / 워룸 컨셉: 다크 + 손그림 아웃라인 + 군사 톤
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
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';

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
        backgroundColor: SK.bg, fontFamily: headingFont,
        fontSize: '24px', color: SK.textPrimary,
        letterSpacing: '3px',
      }}>
        DEPLOYING...
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

      {/* 다크 오버레이 (3D 씬 위에 비네팅 효과) */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5,
        background: `radial-gradient(
          ellipse at center,
          rgba(17, 17, 17, 0.6) 0%,
          rgba(17, 17, 17, 0.85) 60%,
          rgba(17, 17, 17, 0.95) 100%
        )`,
        pointerEvents: 'none',
      }} />

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
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            backgroundColor: uiState.connected ? SK.statusOnline : SK.statusOffline,
            boxShadow: uiState.connected
              ? `0 0 6px ${SK.green}80`
              : `0 0 6px ${SK.red}80`,
          }} />
          <span style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: SKFont.xs,
            color: uiState.connected ? SK.green : SK.red,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {uiState.connected ? 'Online' : 'Connecting...'}
          </span>
        </div>

        {/* 메인 패널: 2열 레이아웃 */}
        <div style={{
          display: 'flex',
          gap: '14px',
          maxWidth: '860px',
          width: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {/* 좌: 플레이어 설정 + 참가 */}
          <McPanel style={{ flex: '1 1 340px', maxWidth: '420px', padding: '18px' }}>
            <div style={{
              fontFamily: headingFont, fontSize: SKFont.h2,
              color: SK.textPrimary, marginBottom: '12px',
              letterSpacing: '2px',
            }}>
              AGENT SETUP
            </div>

            <McInput
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter callsign..."
              style={{ marginBottom: '14px' }}
            />

            <CharacterCreator skinId={skinId} onSelect={setSkinId} />

            <div style={{ marginTop: '16px' }}>
              <McButton
                variant="green"
                onClick={handleQuickJoin}
                disabled={!uiState.connected}
                style={{ width: '100%', padding: '12px 0', fontSize: SKFont.h3 }}
              >
                QUICK DEPLOY
              </McButton>
            </div>
          </McPanel>

          {/* 우: 룸 리스트 + 최근 우승자 */}
          <div style={{
            flex: '1 1 340px', maxWidth: '420px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            <McPanel style={{ padding: '16px' }}>
              <div style={{
                fontFamily: headingFont, fontSize: SKFont.h2,
                color: SK.textPrimary, marginBottom: '10px',
                letterSpacing: '2px',
              }}>
                WAR ZONES
              </div>
              <RoomList rooms={uiState.rooms} onJoin={handleJoinRoom} />
            </McPanel>

            <McPanel style={{ padding: '16px' }}>
              <RecentWinnersPanel winners={uiState.recentWinners} />
            </McPanel>
          </div>
        </div>

        {/* 하단 버전 */}
        <div style={{
          fontFamily: bodyFont,
          fontWeight: 500,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}>
          v10.0 alpha
        </div>
      </div>
    </div>
  );
}
