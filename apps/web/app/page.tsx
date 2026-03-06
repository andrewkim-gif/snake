'use client';

/**
 * AI World War — Main Page (v12)
 * CIC (Combat Information Center) 디자인
 * LobbyHeader + WorldView + Agent Setup + NewsFeed 통합
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { CubelingAppearance } from '@agent-survivor/shared';
import { createDefaultAppearance, packAppearance } from '@agent-survivor/shared';
import { LobbyHeader } from '@/components/lobby/LobbyHeader';
import { McInput } from '@/components/lobby/McInput';
import { CharacterCreator } from '@/components/lobby/CharacterCreator';
import { WelcomeTutorial } from '@/components/lobby/WelcomeTutorial';
import { NewsFeed } from '@/components/lobby/NewsFeed';
import { useSocket } from '@/hooks/useSocket';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

const WorldView = dynamic(
  () => import('@/components/world/WorldView').then(m => ({ default: m.WorldView })),
  { ssr: false },
);
const GameCanvas3D = dynamic(
  () => import('@/components/game/GameCanvas3D').then(m => ({ default: m.GameCanvas3D })),
  { ssr: false },
);

const NEWS_FEED_HEIGHT = 36;

export default function Home() {
  const [mode, setMode] = useState<'lobby' | 'transitioning' | 'playing'>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const [appearance, setAppearance] = useState<CubelingAppearance>(createDefaultAppearance);
  const [fadeOut, setFadeOut] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'globe' | 'map'>('globe');
  const {
    dataRef, uiState, joinRoom, leaveRoom, sendInput,
    respawn, chooseUpgrade, dismissSynergyPopup,
  } = useSocket();

  // localStorage 복원
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

  // 뷰 전환 (fade)
  const handleToggleView = useCallback(() => {
    setViewMode(prev => prev === 'globe' ? 'map' : 'globe');
  }, []);

  // 국가 아레나 진입
  const handleEnterArena = useCallback((iso3: string) => {
    const name = playerName || `Agent${Math.floor(Math.random() * 9999)}`;
    const packedAp = packAppearance(appearance).toString();
    setFadeOut(true);
    setTimeout(() => {
      joinRoom(iso3, name, skinId, packedAp);
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [joinRoom, playerName, skinId, appearance]);

  // 관전
  const handleSpectate = useCallback((iso3: string) => {
    const name = playerName || `Spectator${Math.floor(Math.random() * 999)}`;
    const packedAp = packAppearance(appearance).toString();
    setFadeOut(true);
    setTimeout(() => {
      joinRoom(iso3, name, skinId, packedAp);
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [joinRoom, playerName, skinId, appearance]);

  // 퇴장
  const handleExit = useCallback(() => {
    leaveRoom();
    setMode('lobby');
  }, [leaveRoom]);

  // 전환: joined 이벤트 수신 시 playing으로 전환, 8초 타임아웃 시 lobby 복귀
  useEffect(() => {
    if (mode !== 'transitioning') return;
    // 서버에서 joined 수신 → currentRoomId 설정됨 → playing
    if (uiState.currentRoomId) {
      setMode('playing');
      return;
    }
    // 타임아웃: 서버 응답 없으면 lobby 복귀
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        setMode('lobby');
        setFadeOut(false);
      }
    }, 8000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, uiState.currentRoomId]);

  // --- 전환 화면 ---
  if (mode === 'transitioning') {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: SK.bg, fontFamily: bodyFont,
        fontWeight: 700, fontSize: '20px', color: SK.textPrimary,
        letterSpacing: '3px',
      }}>
        DEPLOYING TO ARENA...
      </div>
    );
  }

  // --- 게임 화면 ---
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

  // --- 로비 화면: CIC 디자인 ---
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

      {/* 전체 화면 지구본/맵 */}
      <WorldView
        viewMode={viewMode}
        onEnterArena={handleEnterArena}
        onSpectate={handleSpectate}
        bottomOffset={NEWS_FEED_HEIGHT}
      />

      {/* CIC 헤더 바 */}
      <LobbyHeader
        connected={uiState.connected}
        viewMode={viewMode}
        onToggleView={handleToggleView}
      />

      {/* Agent Setup 패널 — 좌측 */}
      <div style={{
        position: 'absolute',
        top: 68,
        left: 16,
        zIndex: 60,
        maxWidth: '280px',
        width: 'calc(100vw - 32px)',
      }}>
        {setupOpen ? (
          <div style={{
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${SK.glassBorder}`,
            borderRadius: '6px',
            padding: '14px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          }}>
            {/* 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <span style={{
                fontFamily: bodyFont,
                fontSize: '13px',
                fontWeight: 700,
                color: SK.textPrimary,
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}>
                AGENT SETUP
              </span>
              <button
                onClick={() => setSetupOpen(false)}
                style={{
                  background: 'none',
                  border: `1px solid ${SK.border}`,
                  borderRadius: '3px',
                  color: SK.textSecondary,
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  fontWeight: 700,
                  transition: 'all 150ms ease',
                }}
              >
                —
              </button>
            </div>

            {/* 이름 입력 */}
            <McInput
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter callsign..."
              style={{ marginBottom: '12px' }}
            />

            {/* 캐릭터 에디터 (Phase 7) */}
            <CharacterCreator
              skinId={skinId}
              onSelect={setSkinId}
              appearance={appearance}
              onAppearanceChange={setAppearance}
            />

            {/* 안내 문구 */}
            <div style={{
              marginTop: '14px',
              padding: '8px 0 0',
              textAlign: 'center',
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
              letterSpacing: '1.5px',
              borderTop: `1px solid ${SK.borderDark}`,
            }}>
              CLICK A COUNTRY TO DEPLOY
            </div>
          </div>
        ) : (
          <button
            onClick={() => setSetupOpen(true)}
            style={{
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '10px',
              color: SK.textSecondary,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '8px 16px',
              border: `1px solid ${SK.border}`,
              borderRadius: '4px',
              backgroundColor: SK.glassBg,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            AGENT SETUP
          </button>
        )}
      </div>

      {/* 뉴스 피드 — 하단 고정 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
      }}>
        <NewsFeed
          expanded={newsExpanded}
          onToggleExpand={() => setNewsExpanded(prev => !prev)}
        />
      </div>
    </div>
  );
}
