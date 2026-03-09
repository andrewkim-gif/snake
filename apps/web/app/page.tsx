'use client';

/**
 * AI World War — Main Page (v14 Phase 8)
 * CIC (Combat Information Center) 디자인
 * LobbyHeader + WorldView + Agent Setup + NewsFeed 통합
 * v14 S35: EventTicker 통합
 * v14 S36: ESC 키 → 인게임→로비 복귀, 글로브 클릭 → 아레나 즉시 입장 (소켓 유지)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CubelingAppearance } from '@agent-survivor/shared';
import { createDefaultAppearance, packAppearance } from '@agent-survivor/shared';
import { McInput } from '@/components/lobby/McInput';
import { CharacterCreator } from '@/components/lobby/CharacterCreator';
import { NationalitySelector, loadNationality, saveNationality } from '@/components/lobby/NationalitySelector';
import { Tutorial } from '@/components/game/Tutorial';
import { NewsFeed, type NewsEventType } from '@/components/lobby/NewsFeed';
import { GameSystemPopup } from '@/components/hub/GameSystemPopup';
import { EconomyPopup } from '@/components/hub/EconomyPopup';
import { FactionPopup } from '@/components/hub/FactionPopup';
import { GovernancePopup } from '@/components/hub/GovernancePopup';
import { HallOfFamePopup } from '@/components/hub/HallOfFamePopup';
import { SettingsPopup } from '@/components/hub/SettingsPopup';
import { usePopup } from '@/hooks/usePopup';
import { IntroSequence } from '@/components/lobby/IntroSequence';
import { BgmPlayer } from '@/components/lobby/BgmPlayer';
import type { IntroPhase } from '@/components/lobby/IntroSequence';
import { useSocketContext } from '@/providers/SocketProvider';
import type { GameMode } from '@/providers/SocketProvider';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { OVERLAY, KEYFRAMES_PULSE } from '@/lib/overlay-tokens';
import type { MainTabKey } from '@/components/hub/PopupTabNav';
import { ChevronRight, Minus, Settings, Globe, TrendingUp, Swords, Landmark, Trophy } from 'lucide-react';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';
import type { TradeRouteData } from '@/hooks/useSocket';

const WorldView = dynamic(
  () => import('@/components/world/WorldView').then(m => ({ default: m.WorldView })),
  { ssr: false },
);
const GameCanvas3D = dynamic(
  () => import('@/components/game/GameCanvas3D').then(m => ({ default: m.GameCanvas3D })),
  { ssr: false },
);
// v26: Isometric city canvas (PixiJS 8) — dynamic import, ssr: false
const IsoCanvas = dynamic(
  () => import('@/components/game/iso/IsoCanvas').then(m => ({ default: m.IsoCanvas })),
  { ssr: false },
);
// v29: MatrixApp 오케스트레이터 (게임 훅 + MatrixCanvas + 오버레이 통합)
const MatrixApp = dynamic(
  () => import('@/components/game/matrix/MatrixApp').then(m => ({ default: m.MatrixApp })),
  { ssr: false },
);

const NEWS_FEED_HEIGHT = 36;

/* ── Matrix 게임 로딩 오버레이 (GlobeLoadingScreen 스타일) ── */
const MATRIX_LOADING_TEXTS = [
  'DEPLOYING COMBAT AGENTS',
  'LOADING BATTLEFIELD',
  'INITIALIZING WEAPONS SYSTEM',
  'ESTABLISHING BATTLE LINK',
];

function MatrixLoadingOverlay({ countryName, onComplete }: { countryName: string; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 단일 useEffect: 프로그레스 애니메이션 + 텍스트 사이클 + 완료 처리
  // deps 없음 → 마운트 1회만 실행, 리렌더 영향 없음
  useEffect(() => {
    const startTime = Date.now();
    const DURATION = 2000;
    let completed = false;
    let rafId = 0;

    // 텍스트 사이클
    let txtIdx = 0;
    const textInterval = setInterval(() => {
      txtIdx = (txtIdx + 1) % MATRIX_LOADING_TEXTS.length;
      setTextIndex(txtIdx);
    }, 600);

    const tick = () => {
      if (completed) return;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const p = eased * 100;
      setProgress(p);

      if (p >= 99.5 && !completed) {
        completed = true;
        setTimeout(() => setFadeOut(true), 200);
        setTimeout(() => onCompleteRef.current(), 800);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(textInterval);
    };
  }, []);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 200,
      background: SK.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 600ms ease',
      pointerEvents: fadeOut ? 'none' : 'auto',
    }}>
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 국가명 헤딩 */}
        <div style={{
          fontFamily: headingFont,
          fontSize: 'clamp(24px, 5vw, 36px)',
          fontWeight: 700,
          color: SK.accent,
          letterSpacing: '0.12em',
          textAlign: 'center',
          textTransform: 'uppercase',
        }}>
          BATTLE FOR {countryName.toUpperCase()}
        </div>

        {/* 프로그레스 바 트랙 */}
        <div style={{
          width: '100%',
          height: 3,
          background: 'rgba(255, 255, 255, 0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${SK.accentDark || SK.accent}, ${SK.accent})`,
            transition: 'width 100ms linear',
            boxShadow: `0 0 12px ${SK.accent}66, 0 0 4px ${SK.accent}44`,
          }} />
        </div>

        {/* 하단 정보 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: 10,
            letterSpacing: '0.15em',
            color: SK.textMuted,
            textTransform: 'uppercase',
          }}>
            {MATRIX_LOADING_TEXTS[textIndex]}
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: 11,
            color: SK.textSecondary,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* 하단 악센트 라인 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${SK.accent}66, transparent)`,
      }} />
    </div>
  );
}

export default function Home() {
  const tLobby = useTranslations('lobby');
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'lobby' | 'transitioning' | 'playing' | 'iso' | 'matrix'>('lobby');
  // v26: 아이소메트릭 국가 관리 대상 (Phase 8: spectating 플래그 추가)
  const [isoCountry, setIsoCountry] = useState<{ iso3: string; name: string; spectating?: boolean } | null>(null);
  // v29b Phase 2: Matrix 진입 시 국가 정보
  const [matrixCountry, setMatrixCountry] = useState<{ iso3: string; name: string } | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const [appearance, setAppearance] = useState<CubelingAppearance>(createDefaultAppearance);
  const [nationality, setNationality] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [newsExpanded, setNewsExpanded] = useState(false);
  // v14 S36: 에포크 상태 요약 (로비 복귀 시 표시)
  const [epochSummary, setEpochSummary] = useState<string | null>(null);

  // v17: 시네마틱 인트로 상태
  const [introPhase, setIntroPhase] = useState<IntroPhase>('done');
  // v29b: Matrix 게임 로딩 상태
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [introComplete, setIntroComplete] = useState(true);
  const [introActive, setIntroActive] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  // 클라이언트에서만 인트로 활성화 여부 결정 (SSR hydration 불일치 방지)
  useEffect(() => {
    const alreadyPlayed = sessionStorage.getItem('aww-intro-played');
    if (!alreadyPlayed) {
      setIntroPhase('black');
      setIntroComplete(false);
      setIntroActive(true);
    }
    setClientReady(true);
  }, []);

  // 인트로 중에는 UI 요소 숨김 (staggered reveal)
  // clientReady 전에는 모두 false → SSR 깜빡임 방지
  const showHeader = clientReady && (introPhase === 'ui-stagger' || introPhase === 'done' || !introActive);
  const showLeftPanel = clientReady && (introPhase === 'ui-stagger' || introPhase === 'done' || !introActive);
  const showNewsFeed = clientReady && (introPhase === 'done' || !introActive);

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
    // 약간의 딜레이 후 인트로 카메라 비활성화 (OrbitControls 전환)
    setTimeout(() => setIntroActive(false), 100);
  }, []);

  const handleIntroPhaseChange = useCallback((phase: IntroPhase) => {
    setIntroPhase(phase);
  }, []);

  // v31: 새 팝업 시스템 (usePopup 훅)
  const { activePopup, activeSection: popupSection, openPopup, closePopup, setSection: setPopupSection } = usePopup();

  // 레거시 게임 시스템 팝업 상태 (Phase 4에서 제거 예정)
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<MainTabKey>('economy');
  const [panelSubTab, setPanelSubTab] = useState<string | undefined>();

  // URL ?panel= 파라미터로 자동 오픈 (레거시 — 새 팝업이 활성화되지 않았을 때만)
  useEffect(() => {
    // 새 팝업 시스템이 활성화되어 있으면 레거시 팝업 비활성화
    if (activePopup) {
      setPanelOpen(false);
      return;
    }
    const panel = searchParams.get('panel');
    if (panel) {
      setPanelTab(panel as MainTabKey);
      const sub = searchParams.get('tab') || undefined;
      setPanelSubTab(sub);
      setPanelOpen(true);
    }
  }, [searchParams, activePopup]);

  const handleOpenPanel = useCallback((tab?: MainTabKey) => {
    if (tab) setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // v13: 전역 SocketContext에서 소켓 데이터 + 액션 가져오기
  const {
    dataRef, uiState, joinRoom, joinCountryArena, leaveRoom, sendInput, sendInputV16,
    respawn, chooseUpgrade, dismissSynergyPopup, setGameMode, switchArena,
    arStateRef, arInterpRef, arEventQueueRef, arUiState, sendARChoice,
  } = useSocketContext();

  // ─── DEV: 테스트용 더미 전쟁/교역 (1분 주기) ───
  const [testWars, setTestWars] = useState<WarEffectData[]>([]);
  const [testTrades, setTestTrades] = useState<TradeRouteData[]>([]);

  useEffect(() => {
    const SAMPLE_COUNTRIES = [
      'USA', 'CHN', 'RUS', 'KOR', 'JPN', 'DEU', 'GBR', 'FRA', 'BRA', 'IND',
      'AUS', 'CAN', 'MEX', 'ARG', 'EGY', 'NGA', 'ZAF', 'TUR', 'SAU', 'IDN',
    ];
    const pick = () => {
      const a = SAMPLE_COUNTRIES[Math.floor(Math.random() * SAMPLE_COUNTRIES.length)];
      let b = a;
      while (b === a) b = SAMPLE_COUNTRIES[Math.floor(Math.random() * SAMPLE_COUNTRIES.length)];
      return [a, b] as const;
    };
    const generate = () => {
      const now = Date.now();

      // 1~2개 전쟁
      const warCount = 1 + Math.floor(Math.random() * 2);
      const wars: WarEffectData[] = [];
      for (let i = 0; i < warCount; i++) {
        const [att, def] = pick();
        wars.push({
          warId: `test-war-${now}-${i}`,
          state: Math.random() > 0.3 ? 'active' : 'preparation',
          attacker: att,
          defender: def,
          attackerScore: Math.floor(Math.random() * 100),
          defenderScore: Math.floor(Math.random() * 100),
        });
      }
      setTestWars(wars);

      // 2~4개 교역 루트
      const tradeCount = 2 + Math.floor(Math.random() * 3);
      const trades: TradeRouteData[] = [];
      for (let i = 0; i < tradeCount; i++) {
        const [from, to] = pick();
        trades.push({
          from,
          to,
          type: Math.random() > 0.5 ? 'sea' : 'land',
          volume: 10 + Math.floor(Math.random() * 90),
          resource: ['oil', 'tech', 'food', 'metal'][Math.floor(Math.random() * 4)],
          timestamp: now,
        });
      }
      setTestTrades(trades);
    };

    generate(); // 즉시 1회 실행
    const interval = setInterval(generate, 60_000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  // 서버 데이터가 있으면 서버 데이터, 없으면 테스트 데이터
  const activeWars = uiState.wars.length > 0 ? uiState.wars : testWars;
  const activeTrades = uiState.tradeRoutes.length > 0 ? uiState.tradeRoutes : testTrades;

  // 뉴스 피드 데이터 안정화 (매 렌더 .map() 재생성 방지)
  const newsItems = useMemo(() =>
    uiState.globalEvents.map(evt => ({
      id: evt.id,
      type: (evt.type as NewsEventType) || 'global_event',
      headline: evt.message,
      timestamp: evt.timestamp,
      countryISO: evt.countryCode,
      targetISO: evt.targetCode,
    })),
    [uiState.globalEvents],
  );

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

  // v19: ESC 키 핸들러 제거 — GameCanvas3D의 PauseMenu가 ESC 토글 담당
  // (이전: ESC 즉시 로비 퇴장 → 수정: PauseMenu → "Exit to Lobby" 클릭 시에만 퇴장)

  // v29b Phase 2: Globe → Matrix 진입 (국가 선택 → 로딩바 → MatrixApp)
  const handleManageCountry = useCallback((iso3: string, name: string) => {
    setMatrixCountry({ iso3, name });
    setMatrixLoading(true);
    setFadeOut(true);
    setTimeout(() => {
      setMode('matrix');
      setFadeOut(false);
    }, 300);
  }, []);


  // v26: Iso → Globe 복귀
  const handleBackToGlobe = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setMode('lobby');
      setIsoCountry(null);
      setFadeOut(false);
    }, 300);
  }, []);

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

  // --- v26: 아이소메트릭 국가 관리 화면 ---
  if (mode === 'iso' && isoCountry) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 300ms ease',
      }}>
        <IsoCanvas
          countryIso3={isoCountry.iso3}
          countryName={isoCountry.name}
          onBackToGlobe={handleBackToGlobe}
          spectating={isoCountry.spectating}
        />
      </div>
    );
  }

  // --- v29: MatrixApp 오케스트레이터 (게임 훅 + 캔버스 + 오버레이 통합) ---
  if (mode === 'matrix') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 300ms ease',
      }}>
        <MatrixApp
          countryIso3={matrixCountry?.iso3}
          countryName={matrixCountry?.name}
          onExitToLobby={() => {
            setFadeOut(true);
            setTimeout(() => {
              setMode('lobby');
              setMatrixCountry(null);
              setMatrixLoading(false);
              setFadeOut(false);
            }, 300);
          }}
        />
        {/* Matrix 게임 로딩 오버레이 — GlobeLoadingScreen 스타일 */}
        {matrixLoading && (
          <MatrixLoadingOverlay
            countryName={matrixCountry?.name ?? ''}
            onComplete={() => setMatrixLoading(false)}
          />
        )}
      </div>
    );
  }

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
        sendInputV16={sendInputV16}
        respawn={respawn}
        playerName={playerName}
        skinId={skinId}
        onExit={handleExitToLobby}
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
      {/* v17: 시네마틱 인트로 오버레이 */}
      <IntroSequence
        onIntroComplete={handleIntroComplete}
        onPhaseChange={handleIntroPhaseChange}
      />

      {/* v14: 6-step onboarding tutorial (replaces WelcomeTutorial) */}
      {!introActive && <Tutorial />}

      {/* 전체 화면 지구본/맵 */}
      <WorldView
        countryStates={uiState.countryStates}
        onEnterArena={handleQuickEnterArena}
        onSpectate={handleSpectate}
        onManageCountry={handleManageCountry}
        bottomOffset={NEWS_FEED_HEIGHT}
        dominationStates={uiState.dominationStates}
        wars={activeWars}
        tradeRoutes={activeTrades}
        globalEvents={uiState.globalEvents}
        introActive={introActive}
        onIntroComplete={() => {}} // 카메라 완료는 GlobeIntroCamera가 처리
        activeConflictCountries={uiState.activeConflictCountries}
        alliances={[]}
        sanctions={[]}
        resources={[]}
        spyOps={[]}
        nukes={[]}
      />

      {/* 우상단: ONLINE 인디케이터 + 명예의전당 + 설정 버튼 */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity: showHeader ? 1 : 0,
        transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* ONLINE 인디케이터 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: uiState.connected ? SK.statusOnline : SK.statusOffline,
            boxShadow: uiState.connected
              ? `0 0 8px ${SK.green}80`
              : `0 0 8px ${SK.red}60`,
          }} />
          <span style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: '9px',
            color: uiState.connected ? SK.green : SK.red,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {uiState.connected ? tLobby('online') : tLobby('offline')}
          </span>
        </div>

        {/* v31 Phase 3: 명예의전당 버튼 (네모) */}
        <button
          onClick={() => openPopup('hallOfFame')}
          title="HALL OF FAME"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 0,
            border: activePopup === 'hallOfFame'
              ? `2px solid ${SK.gold}`
              : '1px solid rgba(255, 255, 255, 0.1)',
            background: activePopup === 'hallOfFame'
              ? `${SK.gold}20`
              : 'rgba(9, 9, 11, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            pointerEvents: 'auto',
            boxShadow: activePopup === 'hallOfFame'
              ? `0 0 12px ${SK.gold}40`
              : 'none',
          }}
          onMouseEnter={(e) => {
            if (activePopup !== 'hallOfFame') {
              e.currentTarget.style.borderColor = SK.gold;
              e.currentTarget.style.background = `${SK.gold}15`;
            }
          }}
          onMouseLeave={(e) => {
            if (activePopup !== 'hallOfFame') {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.background = 'rgba(9, 9, 11, 0.6)';
            }
          }}
        >
          <Trophy
            size={16}
            strokeWidth={2}
            color={activePopup === 'hallOfFame' ? SK.gold : SK.textSecondary}
          />
        </button>

        {/* v31 Phase 3: 설정 버튼 (네모) */}
        <button
          onClick={() => openPopup('settings', 'profile')}
          title="SETTINGS"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 0,
            border: activePopup === 'settings'
              ? `2px solid ${SK.textSecondary}`
              : '1px solid rgba(255, 255, 255, 0.1)',
            background: activePopup === 'settings'
              ? 'rgba(139, 141, 152, 0.2)'
              : 'rgba(9, 9, 11, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            pointerEvents: 'auto',
            boxShadow: activePopup === 'settings'
              ? `0 0 12px rgba(139, 141, 152, 0.3)`
              : 'none',
          }}
          onMouseEnter={(e) => {
            if (activePopup !== 'settings') {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }
          }}
          onMouseLeave={(e) => {
            if (activePopup !== 'settings') {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.background = 'rgba(9, 9, 11, 0.6)';
            }
          }}
        >
          <Settings
            size={16}
            strokeWidth={2}
            color={activePopup === 'settings' ? SK.textPrimary : SK.textSecondary}
          />
        </button>
      </div>

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
            backgroundColor: OVERLAY.bg,
            backdropFilter: OVERLAY.blur,
            WebkitBackdropFilter: OVERLAY.blur,
            border: OVERLAY.border,
            borderRadius: OVERLAY.borderRadius,
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
              animation: 'effectPulse 1.5s infinite',
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

      {/* 좌하단 컨트롤 — 로고 + 가로 버튼 */}
      <div style={{
        position: 'absolute',
        bottom: NEWS_FEED_HEIGHT + 28,
        left: 28,
        zIndex: 65,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        pointerEvents: 'none',
        opacity: showLeftPanel ? 1 : 0,
        transform: showLeftPanel ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
      }}>
          {/* 로고 — 버튼 행 상단 */}
          <div style={{ pointerEvents: 'auto', marginBottom: '4px', paddingLeft: '2px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/generated/logo-v2.png"
              alt="AI WORLD WAR"
              style={{
                height: '22px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
              }}
            />
          </div>
          {/* 가로 버튼 행 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '4px' }}>
          {/* Agent Setup 버튼 — 메인 컬러 통일 */}
          <button
            onClick={() => setSetupOpen(prev => !prev)}
            style={{
              position: 'relative',
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '11px',
              color: '#FFFFFF',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '6px 14px',
              border: 'none',
              borderRadius: 0,
              backgroundColor: SK.accent,
              cursor: 'pointer',
              transition: `all ${OVERLAY.transition}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Settings size={12} color="#FFFFFF" strokeWidth={2.5} />
            {tLobby('agentSetup')}
          </button>

          {/* v31: ECONOMY 버튼 — 메인 레드 */}
          <button
            onClick={() => openPopup('economy', 'tokens')}
            style={{
              position: 'relative',
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '11px',
              color: '#FFFFFF',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '6px 14px',
              border: 'none',
              borderRadius: 0,
              backgroundColor: activePopup === 'economy' ? SK.accent : `rgba(239, 68, 68, 0.7)`,
              cursor: 'pointer',
              transition: `all ${OVERLAY.transition}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
              boxShadow: activePopup === 'economy'
                ? '0 0 24px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                : '0 0 16px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              borderLeft: `3px solid ${SK.accent}`,
            }}
          >
            <TrendingUp size={12} color="#FFFFFF" strokeWidth={2.5} />
            ECONOMY
          </button>

          {/* v31: FACTIONS 버튼 — 메인 레드 */}
          <button
            onClick={() => openPopup('factions', 'overview')}
            style={{
              position: 'relative',
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '11px',
              color: '#FFFFFF',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '6px 14px',
              border: 'none',
              borderRadius: 0,
              backgroundColor: activePopup === 'factions' ? SK.accent : `rgba(239, 68, 68, 0.7)`,
              cursor: 'pointer',
              transition: `all ${OVERLAY.transition}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
              boxShadow: activePopup === 'factions'
                ? '0 0 24px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                : '0 0 16px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              borderLeft: `3px solid ${SK.accent}`,
            }}
          >
            <Swords size={12} color="#FFFFFF" strokeWidth={2.5} />
            FACTIONS
          </button>

          {/* v31: GOVERNANCE 버튼 — 메인 레드 */}
          <button
            onClick={() => openPopup('governance', 'proposals')}
            style={{
              position: 'relative',
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '11px',
              color: '#FFFFFF',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '6px 14px',
              border: 'none',
              borderRadius: 0,
              backgroundColor: activePopup === 'governance' ? SK.accent : `rgba(239, 68, 68, 0.7)`,
              cursor: 'pointer',
              transition: `all ${OVERLAY.transition}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
              boxShadow: activePopup === 'governance'
                ? '0 0 24px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                : '0 0 16px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              borderLeft: `3px solid ${SK.accent}`,
            }}
          >
            <Landmark size={12} color="#FFFFFF" strokeWidth={2.5} />
            GOVERNANCE
          </button>
          </div>{/* 가로 버튼 행 닫기 */}

      </div>

      {/* Agent Setup 팝업 (setupOpen 시) */}
      {setupOpen && (
        <div style={{
          position: 'absolute',
          bottom: NEWS_FEED_HEIGHT + 95,
          left: 28,
          zIndex: 66,
          width: 'min(300px, calc(100vw - 32px))',
          pointerEvents: 'auto',
        }}>
          <div style={{
            position: 'relative',
            backgroundColor: OVERLAY.bg,
            backdropFilter: OVERLAY.blur,
            WebkitBackdropFilter: OVERLAY.blur,
            border: OVERLAY.border,
            borderRadius: OVERLAY.borderRadius,
            borderTop: '1px solid rgba(239, 68, 68, 0.5)',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.7)',
            overflow: 'visible',
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
          }}>
            {/* 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: `1px solid ${SK.borderDark}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={12} color={SK.accent} strokeWidth={2} />
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: SK.textPrimary,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  {tLobby('agentSetup')}
                </span>
              </div>
              <button
                onClick={() => setSetupOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderRadius: 0,
                  color: SK.textMuted,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: `color ${OVERLAY.transition}`,
                }}
              >
                <Minus size={14} strokeWidth={2} />
              </button>
            </div>

            {/* 콘텐츠 */}
            <div style={{ padding: '12px 14px' }}>
              <McInput
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={tLobby('enterCallsign')}
                style={{ marginBottom: '10px' }}
              />
              <div style={{ marginBottom: '10px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginBottom: '5px',
                }}>
                  <Globe size={10} color={SK.textMuted} strokeWidth={2} />
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: '10px',
                    fontWeight: 600,
                    color: SK.textMuted,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase' as const,
                  }}>
                    NATIONALITY
                  </span>
                </div>
                <NationalitySelector
                  value={nationality}
                  onChange={(iso3) => {
                    setNationality(iso3);
                    saveNationality(iso3);
                  }}
                />
              </div>
              <CharacterCreator
                skinId={skinId}
                onSelect={setSkinId}
                appearance={appearance}
                onAppearanceChange={setAppearance}
              />
              <div style={{
                marginTop: '12px',
                padding: '8px 0 0',
                textAlign: 'center',
                fontFamily: bodyFont,
                fontSize: '10px',
                color: SK.textMuted,
                letterSpacing: '0.5px',
                borderTop: `1px solid ${SK.borderDark}`,
              }}>
                {tLobby('clickToDeploy')}
              </div>
            </div>
            {/* 왼쪽 아래 붉은 삼각형 */}
            <div style={{
              position: 'absolute',
              bottom: -1,
              left: -1,
              width: 0,
              height: 0,
              borderLeft: '14px solid #EF4444',
              borderTop: '14px solid transparent',
              pointerEvents: 'none',
            }} />
          </div>
        </div>
      )}

      {/* BGM Player — 우하단 (좌하단 버튼과 동일 높이) */}
      <BgmPlayer
        visible={showLeftPanel && mode === 'lobby'}
        bottomOffset={NEWS_FEED_HEIGHT + 28}
      />

      {/* 뉴스 피드 — 하단 고정 — v17: staggered reveal */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        opacity: showNewsFeed ? 1 : 0,
        transform: showNewsFeed ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
      }}>
        <NewsFeed
          news={newsItems}
          expanded={newsExpanded}
          onToggleExpand={() => setNewsExpanded(prev => !prev)}
        />
      </div>

      {/* v31: 독립 팝업 시스템 (Phase 2) */}
      <EconomyPopup
        isOpen={activePopup === 'economy'}
        onClose={closePopup}
        activeSection={activePopup === 'economy' ? popupSection : null}
        onSectionChange={setPopupSection}
      />
      <FactionPopup
        isOpen={activePopup === 'factions'}
        onClose={closePopup}
        activeSection={activePopup === 'factions' ? popupSection : null}
        onSectionChange={setPopupSection}
      />
      <GovernancePopup
        isOpen={activePopup === 'governance'}
        onClose={closePopup}
        activeSection={activePopup === 'governance' ? popupSection : null}
        onSectionChange={setPopupSection}
      />

      {/* v31 Phase 3: 명예의전당 팝업 */}
      <HallOfFamePopup
        isOpen={activePopup === 'hallOfFame'}
        onClose={closePopup}
      />

      {/* v31 Phase 3: 설정 통합 팝업 (profile/dashboard/settings 탭) */}
      <SettingsPopup
        isOpen={activePopup === 'settings'}
        onClose={closePopup}
        activeTab={activePopup === 'settings' ? popupSection : null}
        onTabChange={setPopupSection}
      />

      {/* 레거시 게임 시스템 팝업 — 새 팝업 시스템이 비활성일 때만 표시 (Phase 4에서 제거 예정) */}
      <GameSystemPopup
        open={panelOpen && !activePopup}
        onClose={handleClosePanel}
        initialTab={panelTab}
        initialSubTab={panelSubTab}
      />

      {/* 통일 pulse 키프레임 (overlay-tokens.ts) */}
      <style>{KEYFRAMES_PULSE}</style>

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
