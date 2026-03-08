'use client';

/**
 * /arena — Arena Mode Test Page (v19)
 *
 * 서버 연결 MCTerrain 아레나 직접 진입 테스트 페이지.
 * 로비/글로브 우회하여 바로 아레나에 입장.
 * 국가 코드, 이름 등을 URL 파라미터로 받을 수 있음.
 *
 * Usage:
 *   /arena                     → 기본값(KOR)으로 입장
 *   /arena?country=USA         → USA 아레나 입장
 *   /arena?country=JPN&name=TestBot
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSocketContext } from '@/providers/SocketProvider';
import { packAppearance, createDefaultAppearance } from '@agent-survivor/shared';

const GameCanvas3D = dynamic(
  () => import('@/components/game/GameCanvas3D').then(m => ({ default: m.GameCanvas3D })),
  { ssr: false },
);

type TestState = 'connecting' | 'joining' | 'playing' | 'error';

export default function ArenaTestPage() {
  const params = useSearchParams();
  const country = params.get('country') || 'KOR';
  const name = useMemo(() => params.get('name') || `Tester${Math.floor(Math.random() * 9999)}`, [params]);
  const skinId = parseInt(params.get('skin') || '0', 10);

  const [state, setState] = useState<TestState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState('Initializing...');
  const joinedRef = useRef(false);

  const {
    dataRef, uiState, switchArena, sendInput, sendInputV16,
    respawn, chooseUpgrade, dismissSynergyPopup, connected,
    // v19 Phase 2: AR data pipeline
    arStateRef, arInterpRef, arEventQueueRef, arUiState, sendARChoice,
    // v19 Phase 5: Classic bridge skip
    arBridgeSkipRef,
  } = useSocketContext();

  // v19 Phase 5: Skip classic bridge in AR mode (AR components render directly)
  useEffect(() => {
    arBridgeSkipRef.current = true;
    return () => { arBridgeSkipRef.current = false; };
  }, [arBridgeSkipRef]);

  // 소켓 연결 감지 → 자동 아레나 입장
  useEffect(() => {
    if (joinedRef.current) return;

    if (!connected) {
      setDebugInfo(`Socket not connected yet (connected=${connected})`);
      return;
    }

    // 소켓 연결됨 → join 시도
    setDebugInfo(`Socket connected! Joining ${country}...`);
    setState('joining');
    const ap = packAppearance(createDefaultAppearance()).toString();
    switchArena(country, name, country, skinId, ap);
    joinedRef.current = true;
  }, [connected, country, name, skinId, switchArena]);

  // joined → playing 전환 (서버에서 currentRoomId 수신 시)
  useEffect(() => {
    if (uiState.currentRoomId) {
      setDebugInfo(`Joined room: ${uiState.currentRoomId}`);
      setState('playing');
    }
  }, [uiState.currentRoomId]);

  // 타임아웃 (20초 내 연결+입장 안되면 에러)
  useEffect(() => {
    if (state === 'playing' || state === 'error') return;
    const timeout = setTimeout(() => {
      if (!uiState.currentRoomId) {
        setState('error');
        setError(
          `Failed to join arena "${country}". connected=${connected}, roomId=${uiState.currentRoomId}. ` +
          `Check that the game server is running.`
        );
      }
    }, 20000);
    return () => clearTimeout(timeout);
  }, [state, uiState.currentRoomId, country, connected]);

  const handleExit = useCallback(() => {
    window.location.href = '/';
  }, []);

  const handleRetry = useCallback(() => {
    joinedRef.current = false;
    setState('connecting');
    setError(null);
    setDebugInfo('Retrying...');
  }, []);

  // 게임 화면
  if (state === 'playing') {
    return (
      <GameCanvas3D
        dataRef={dataRef}
        uiState={uiState}
        sendInput={sendInput}
        sendInputV16={sendInputV16}
        respawn={respawn}
        playerName={name}
        skinId={skinId}
        onExit={handleExit}
        chooseUpgrade={chooseUpgrade}
        dismissSynergyPopup={dismissSynergyPopup}
        isArenaMode={true}
        arStateRef={arStateRef}
        arInterpRef={arInterpRef}
        arEventQueueRef={arEventQueueRef}
        arUiState={arUiState}
        sendARChoice={sendARChoice}
      />
    );
  }

  // 로딩/에러 화면
  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#111', color: '#E8E0D4',
      fontFamily: '"Rajdhani", sans-serif', gap: 16,
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>
        ARENA TEST MODE
      </h1>

      {state === 'connecting' && (
        <div style={{ color: connected ? '#CC9933' : '#888' }}>
          {connected ? `Connected! Joining ${country}...` : 'Connecting to server...'}
        </div>
      )}

      {state === 'joining' && (
        <div style={{ color: '#CC9933' }}>
          Joining arena: {country}...
        </div>
      )}

      {state === 'error' && (
        <>
          <div style={{ color: '#CC3333', maxWidth: 400, textAlign: 'center' }}>
            {error}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '8px 20px', backgroundColor: '#CC9933', color: '#111',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700,
              }}
            >
              Retry
            </button>
            <button
              onClick={handleExit}
              style={{
                padding: '8px 20px', backgroundColor: '#333', color: '#E8E0D4',
                border: '1px solid #555', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Back to Lobby
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: 24, fontSize: 12, color: '#555', textAlign: 'center' }}>
        <div>URL params: ?country=KOR&name=TestBot&skin=0</div>
        <div style={{ marginTop: 4 }}>Press ESC in-game to exit</div>
        <div style={{ marginTop: 8, color: '#444', fontSize: 11 }}>
          {debugInfo}
        </div>
      </div>
    </div>
  );
}
