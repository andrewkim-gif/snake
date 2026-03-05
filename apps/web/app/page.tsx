'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RoomList } from '@/components/lobby/RoomList';
import { RecentWinnersPanel } from '@/components/lobby/RecentWinnersPanel';
import { McPanel } from '@/components/lobby/McPanel';
import { McButton } from '@/components/lobby/McButton';
import { McInput } from '@/components/lobby/McInput';
import { CharacterCreator } from '@/components/lobby/CharacterCreator';
import { WelcomeTutorial } from '@/components/lobby/WelcomeTutorial';
import { TrainingConsole } from '@/components/lobby/TrainingConsole';
import { RPPanel } from '@/components/lobby/RPPanel';
import { QuestPanel } from '@/components/lobby/QuestPanel';
import { GlobalLeaderboard } from '@/components/lobby/GlobalLeaderboard';
import { PersonalitySelector } from '@/components/lobby/PersonalitySelector';
import { useSocket } from '@/hooks/useSocket';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

// GameCanvas uses 2D Canvas — SSR 불가 -> dynamic import (ssr: false)
const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas').then(m => ({ default: m.GameCanvas })),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#87CEEB', fontFamily: pixelFont,
        fontSize: '0.6rem', color: '#FFF',
      }}>
        Loading game...
      </div>
    ),
  },
);

const LobbyScene3D = dynamic(() => import('@/components/lobby/LobbyScene3D').then(m => ({ default: m.LobbyScene3D })), {
  ssr: false,
});

/* ── 메인 홈 컴포넌트 ── */
export default function Home() {
  const [mode, setMode] = useState<'lobby' | 'transitioning' | 'playing'>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const { dataRef, uiState, joinRoom, leaveRoom, sendInput, respawn, chooseUpgrade, dismissSynergyPopup, setTrainingProfile } = useSocket();

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

  // Lobby -> Game 전환 시 WebGL context 충돌 방지
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
      <GameCanvas
        dataRef={dataRef}
        uiState={uiState}
        sendInput={sendInput}
        respawn={respawn}
        playerName={playerName || `Agent${Math.floor(Math.random() * 9999)}`}
        skinId={skinId}
        onExit={handleExit}
        chooseUpgrade={chooseUpgrade}
        dismissSynergyPopup={dismissSynergyPopup}
      />
    );
  }

  return (
    <main style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', height: '100vh',
      overflow: 'auto',
      fontFamily: bodyFont,
      position: 'relative',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 300ms ease',
    }}>
      <style dangerouslySetInnerHTML={{ __html: LOBBY_STYLES }} />

      {/* Welcome Tutorial (first visit) */}
      <WelcomeTutorial />

      {/* 3D 배경 */}
      <LobbyScene3D />

      {/* UI 오버레이 */}
      <div className="lobby-columns" style={{
        display: 'flex', flexDirection: 'row',
        gap: '1.5rem', width: '100%', maxWidth: '960px',
        padding: '2rem 1.5rem', boxSizing: 'border-box',
        alignItems: 'flex-start',
        position: 'relative', zIndex: 1,
      }}>

        {/* ===== 왼쪽 패널: 로고 + 캐릭터 커스터마이저 + 입력 + 버튼 ===== */}
        <McPanel className="lobby-left" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.8rem', flex: '0 0 45%', maxWidth: '380px',
          padding: '1.2rem',
        }}>
          {/* 로고 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: pixelFont,
              fontSize: '0.85rem',
              color: MC.textGold,
              textShadow: '2px 2px 0 #553300',
              letterSpacing: '0.05em',
              lineHeight: '1.4',
            }}>
              AGENT<br/>SURVIVOR
            </div>
            <div style={{
              fontFamily: pixelFont,
              fontSize: '0.3rem',
              color: MC.textSecondary,
              marginTop: '0.3rem',
              letterSpacing: '0.1em',
            }}>
              FIGHT &middot; EVOLVE &middot; SURVIVE
            </div>
          </div>

          {/* Character Creator (프리뷰 + 스킨 그리드) */}
          <CharacterCreator skinId={skinId} onSelect={setSkinId} />

          {/* 이름 입력 + 버튼 */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <McInput
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter agent name..."
              maxLength={16}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickJoin(); }}
            />

            <McButton
              variant="green"
              onClick={handleQuickJoin}
              style={{
                width: '100%',
                fontSize: '0.7rem',
                padding: '0.8rem 1rem',
              }}
            >
              QUICK PLAY!
            </McButton>
          </div>

          {/* 연결 상태 */}
          {!uiState.connected && (
            <div style={{
              fontFamily: pixelFont,
              fontSize: '0.4rem',
              color: MC.textRed,
            }}>
              Connecting...
            </div>
          )}
        </McPanel>

        {/* ===== 오른쪽 패널: 서버 리스트 + 최근 우승자 ===== */}
        <McPanel className="lobby-right" style={{
          display: 'flex', flexDirection: 'column',
          gap: '0.8rem', flex: '1 1 55%', minWidth: 0,
          padding: '1.2rem',
        }}>
          {/* 서버 리스트 */}
          {uiState.rooms.length > 0 && (
            <RoomList rooms={uiState.rooms} onJoinRoom={handleJoinRoom} />
          )}

          {/* 최근 우승자 */}
          <RecentWinnersPanel winners={uiState.recentWinners} />

          {/* Agent Training Console */}
          <TrainingConsole onSaveProfile={setTrainingProfile} />

          {/* RP System */}
          <RPPanel playerName={playerName} />

          {/* Quest System */}
          <QuestPanel playerName={playerName} />

          {/* Agent Personality */}
          <PersonalitySelector playerName={playerName} />

          {/* Global Leaderboard */}
          <GlobalLeaderboard />

          {/* 조작 힌트 */}
          <div style={{
            display: 'flex', gap: '1rem', justifyContent: 'center',
            fontFamily: pixelFont, fontSize: '0.35rem',
            color: MC.textGray, marginTop: 'auto',
            paddingTop: '0.5rem',
            borderTop: `1px solid ${MC.panelBorderDark}`,
          }}>
            <span>WASD = Move</span>
            <span>Mouse = Aim</span>
            <span>Space = Dash</span>
          </div>
        </McPanel>

      </div>
    </main>
  );
}

const LOBBY_STYLES = `
  /* 모바일: 1-column 스택 */
  @media (max-width: 768px) {
    .lobby-columns {
      flex-direction: column !important;
      align-items: center !important;
      padding: 1.5rem 1rem !important;
      gap: 1rem !important;
    }
    .lobby-left {
      flex: none !important;
      max-width: 100% !important;
      width: 100% !important;
      max-width: 360px !important;
    }
    .lobby-right {
      flex: none !important;
      width: 100% !important;
      max-width: 360px !important;
    }
  }
  @media (max-width: 480px) {
    .lobby-columns {
      padding: 1rem 0.75rem !important;
    }
  }
`;
