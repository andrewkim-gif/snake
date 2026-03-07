'use client';

/**
 * AI World War — Main Page (v14 Phase 8)
 * CIC (Combat Information Center) 디자인
 * LobbyHeader + WorldView + Agent Setup + NewsFeed 통합
 * v14 S35: EventTicker 통합
 * v14 S36: ESC 키 → 인게임→로비 복귀, 글로브 클릭 → 아레나 즉시 입장 (소켓 유지)
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CubelingAppearance } from '@agent-survivor/shared';
import { createDefaultAppearance, packAppearance } from '@agent-survivor/shared';
import { LobbyHeader } from '@/components/lobby/LobbyHeader';
import { McInput } from '@/components/lobby/McInput';
import { CharacterCreator } from '@/components/lobby/CharacterCreator';
import { NationalitySelector, loadNationality, saveNationality } from '@/components/lobby/NationalitySelector';
import { Tutorial } from '@/components/game/Tutorial';
import { NewsFeed } from '@/components/lobby/NewsFeed';
import { GameSystemPopup } from '@/components/hub/GameSystemPopup';
import { useSocketContext } from '@/providers/SocketProvider';
import type { GameMode } from '@/providers/SocketProvider';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import type { MainTabKey } from '@/components/hub/PopupTabNav';

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
  const tLobby = useTranslations('lobby');
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'lobby' | 'transitioning' | 'playing'>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const [appearance, setAppearance] = useState<CubelingAppearance>(createDefaultAppearance);
  const [nationality, setNationality] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [newsExpanded, setNewsExpanded] = useState(false);
  // v14 S36: 에포크 상태 요약 (로비 복귀 시 표시)
  const [epochSummary, setEpochSummary] = useState<string | null>(null);

  // 게임 시스템 팝업 상태
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<MainTabKey>('economy');
  const [panelSubTab, setPanelSubTab] = useState<string | undefined>();

  // URL ?panel= 파라미터로 자동 오픈
  useEffect(() => {
    const panel = searchParams.get('panel');
    if (panel) {
      setPanelTab(panel as MainTabKey);
      const sub = searchParams.get('tab') || undefined;
      setPanelSubTab(sub);
      setPanelOpen(true);
    }
  }, [searchParams]);

  const handleOpenPanel = useCallback((tab?: MainTabKey) => {
    if (tab) setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // v13: 전역 SocketContext에서 소켓 데이터 + 액션 가져오기
  const {
    dataRef, uiState, joinRoom, joinCountryArena, leaveRoom, sendInput,
    respawn, chooseUpgrade, dismissSynergyPopup, setGameMode, switchArena,
  } = useSocketContext();

  // v13: 로컬 mode ↔ 전역 gameMode 동기화
  useEffect(() => {
    setGameMode(mode as GameMode);
  }, [mode, setGameMode]);

  // localStorage 복원
  useEffect(() => {
    const savedName = localStorage.getItem('agent-survivor-name');
    const savedSkin = localStorage.getItem('agent-survivor-skin');
    const savedNat = loadNationality();
    if (savedName) setPlayerName(savedName);
    if (savedSkin) setSkinId(parseInt(savedSkin, 10) || 0);
    if (savedNat) setNationality(savedNat);
  }, []);

  useEffect(() => {
    if (playerName) localStorage.setItem('agent-survivor-name', playerName);
  }, [playerName]);
  useEffect(() => {
    localStorage.setItem('agent-survivor-skin', String(skinId));
  }, [skinId]);

  // 국가 아레나 진입 (v14: nationality 포함)
  const handleEnterArena = useCallback((iso3: string) => {
    const name = playerName || `Agent${Math.floor(Math.random() * 9999)}`;
    const packedAp = packAppearance(appearance).toString();
    const nat = nationality || iso3; // 국적 미선택 시 입장 국가를 국적으로 사용
    setEpochSummary(null); // 에포크 요약 초기화
    setFadeOut(true);
    setTimeout(() => {
      // v14: joinCountryArena에 nationality 포함, fallback으로 joinRoom도 유지
      if (nat) {
        joinCountryArena(iso3, name, nat, skinId, packedAp);
      } else {
        joinRoom(iso3, name, skinId, packedAp);
      }
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [joinRoom, joinCountryArena, playerName, skinId, appearance, nationality]);

  // 관전
  const handleSpectate = useCallback((iso3: string) => {
    const name = playerName || `Spectator${Math.floor(Math.random() * 999)}`;
    const packedAp = packAppearance(appearance).toString();
    const nat = nationality || iso3;
    setEpochSummary(null);
    setFadeOut(true);
    setTimeout(() => {
      if (nat) {
        joinCountryArena(iso3, name, nat, skinId, packedAp);
      } else {
        joinRoom(iso3, name, skinId, packedAp);
      }
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [joinRoom, joinCountryArena, playerName, skinId, appearance, nationality]);

  // v14 S36: ESC 키로 인게임 → 로비 복귀 (소켓 유지: leaveRoom만 호출)
  const handleExitToLobby = useCallback(() => {
    // Capture epoch summary before leaving
    const epoch = uiState.epoch;
    if (epoch) {
      const phaseLabel = epoch.phase === 'peace' ? 'PEACE' : epoch.phase === 'war' ? 'WAR' : epoch.phase.toUpperCase();
      setEpochSummary(`Epoch ${epoch.epochNumber} - ${phaseLabel} phase`);
    }
    leaveRoom();
    setFadeOut(true);
    setTimeout(() => {
      setMode('lobby');
      setFadeOut(false);
    }, 300);
  }, [leaveRoom, uiState.epoch]);

  // 퇴장 (기존 — 완전 종료)
  const handleExit = useCallback(() => {
    leaveRoom();
    setMode('lobby');
  }, [leaveRoom]);

  // v14 S36: ESC 키 핸들러 (인게임에서만 작동)
  useEffect(() => {
    if (mode !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExitToLobby();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleExitToLobby]);

  // v14 S36: 글로브에서 국가 클릭 시 아레나 즉시 입장 (소켓 유지 + 전환)
  const handleQuickEnterArena = useCallback((iso3: string) => {
    const name = playerName || `Agent${Math.floor(Math.random() * 9999)}`;
    const packedAp = packAppearance(appearance).toString();
    const nat = nationality || iso3;
    setEpochSummary(null);
    setFadeOut(true);
    setTimeout(() => {
      // switchArena: 소켓 재연결 없이 room 변경
      switchArena(iso3, name, nat, skinId, packedAp);
      setMode('transitioning');
      setFadeOut(false);
    }, 300);
  }, [switchArena, playerName, skinId, appearance, nationality]);


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

  // v11: battle_complete 수신 → 10초 후 자동 leaveRoom
  useEffect(() => {
    if (!uiState.battleComplete || mode !== 'playing') return;
    const timer = setTimeout(() => {
      handleExit();
    }, 10_000);
    return () => clearTimeout(timer);
  }, [uiState.battleComplete, mode, handleExit]);

  // v14 S36: 에포크 요약 자동 해제 (10초 후)
  useEffect(() => {
    if (!epochSummary) return;
    const timer = setTimeout(() => setEpochSummary(null), 10_000);
    return () => clearTimeout(timer);
  }, [epochSummary]);

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
        {tLobby('deploying')}
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
        onExit={handleExitToLobby}
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
      {/* v14: 6-step onboarding tutorial (replaces WelcomeTutorial) */}
      <Tutorial />

      {/* 전체 화면 지구본/맵 */}
      <WorldView
        countryStates={uiState.countryStates}
        onEnterArena={handleQuickEnterArena}
        onSpectate={handleSpectate}
        bottomOffset={NEWS_FEED_HEIGHT}
        dominationStates={uiState.dominationStates}
        wars={uiState.wars}
        tradeRoutes={uiState.tradeRoutes}
        globalEvents={uiState.globalEvents}
      />

      {/* CIC 헤더 바 */}
      <LobbyHeader
        connected={uiState.connected}
      />

      {/* v14 S36: 에포크 상태 요약 (로비 복귀 시) */}
      {epochSummary && (
        <div style={{
          position: 'absolute',
          top: 92,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 65,
          pointerEvents: 'none',
        }}>
          <div style={{
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${SK.glassBorder}`,
            borderRadius: 0,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#CC9933',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              fontWeight: 600,
              color: SK.textSecondary,
              letterSpacing: '1px',
            }}>
              {epochSummary}
            </span>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '1px',
            }}>
              ESC to return
            </span>
          </div>
        </div>
      )}

      {/* 좌측 패널 — GAME SYSTEM 버튼 + Agent Setup */}
      <div style={{
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 60,
        maxWidth: '280px',
        width: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {/* GAME SYSTEM 버튼 */}
        <button
          onClick={() => handleOpenPanel()}
          style={{
            pointerEvents: 'auto',
            fontFamily: headingFont,
            fontWeight: 700,
            fontSize: '11px',
            color: SK.textSecondary,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            padding: '10px 16px',
            background: SK.glassBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${SK.glassBorder}`,
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'all 200ms ease',
            width: '100%',
            textAlign: 'left',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          GAME SYSTEM
        </button>
        {setupOpen ? (
          <div style={{
            backgroundColor: SK.glassBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${SK.glassBorder}`,
            borderRadius: 0,
            borderTop: '1px solid #EF4444',
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
                {tLobby('agentSetup')}
              </span>
              <button
                onClick={() => setSetupOpen(false)}
                style={{
                  background: 'none',
                  border: `1px solid ${SK.border}`,
                  borderRadius: 0,
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
              placeholder={tLobby('enterCallsign')}
              style={{ marginBottom: '8px' }}
            />

            {/* v14: 국적 선택 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontFamily: bodyFont,
                fontSize: '9px',
                fontWeight: 700,
                color: SK.textMuted,
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
                marginBottom: '4px',
              }}>
                NATIONALITY
              </div>
              <NationalitySelector
                value={nationality}
                onChange={(iso3) => {
                  setNationality(iso3);
                  saveNationality(iso3);
                }}
              />
            </div>

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
              {tLobby('clickToDeploy')}
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
              borderLeft: '1px solid #EF4444',
              borderRadius: 0,
              backgroundColor: SK.glassBg,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {tLobby('agentSetup')}
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

      {/* 게임 시스템 팝업 — 글로브 위 오버레이 */}
      <GameSystemPopup
        open={panelOpen}
        onClose={handleClosePanel}
        initialTab={panelTab}
        initialSubTab={panelSubTab}
      />

      {/* v15: Server error toast (arena_full, join_failed 등) */}
      {uiState.lastError && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          backgroundColor: 'rgba(204, 51, 51, 0.95)',
          color: '#fff',
          padding: '10px 24px',
          borderRadius: 0,
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          animation: 'fadeIn 200ms ease',
        }}>
          {uiState.lastError.code === 'arena_full'
            ? 'This arena is full. Try another country!'
            : uiState.lastError.message}
        </div>
      )}
    </div>
  );
}
