'use client';

import { useState, useCallback } from 'react';
import { GameCanvas } from '@/components/game/GameCanvas';
import { RoomList } from '@/components/lobby/RoomList';
import { RecentWinnersPanel } from '@/components/lobby/RecentWinnersPanel';
import { useSocket } from '@/hooks/useSocket';
import { DEFAULT_SKINS } from '@snake-arena/shared';

/* Crayon Sketch 팔레트 */
const P = {
  paper: '#F5F0E8',
  paperGrain: '#EDE7DB',
  pencilDark: '#3A3028',
  pencilMedium: '#6B5E52',
  pencilLight: '#A89888',
  crayonOrange: '#D4914A',
  crayonRed: '#C75B5B',
  crayonBlue: '#5B8DAD',
  crayonGreen: '#7BA868',
  crayonPink: '#C47A8E',
} as const;

/* 로비 뱀 캐릭터 — 균형잡힌 비율 + 확실한 아웃라인 stroke */
function SnakeCharacter({ color, secondaryColor, size = 120, eyeStyle = 'default' }: {
  color: string; secondaryColor: string; size?: number; eyeStyle?: string;
}) {
  const outline = P.pencilDark;

  return (
    <svg width={size} height={size} viewBox="0 0 100 70">
      <path
        d="M 8 45 Q 20 30, 35 38 Q 50 46, 62 35 Q 72 27, 75 30"
        stroke={outline} strokeWidth="17" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M 8 45 Q 20 30, 35 38 Q 50 46, 62 35 Q 72 27, 75 30"
        stroke={color} strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="78" cy="26" r="14" fill={outline} />
      <circle cx="78" cy="26" r="12" fill={color} />

      {eyeStyle === 'dot' && <>
        <circle cx="75" cy="23" r="3" fill={P.pencilDark} />
        <circle cx="83" cy="23" r="3" fill={P.pencilDark} />
        <circle cx="74.2" cy="21.8" r="1" fill="#FFF" />
        <circle cx="82.2" cy="21.8" r="1" fill="#FFF" />
      </>}
      {(eyeStyle === 'default' || eyeStyle === 'cute') && <>
        <circle cx="74" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <circle cx="84" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <circle cx="75.5" cy="23.5" r="2.5" fill={P.pencilDark} />
        <circle cx="85.5" cy="23.5" r="2.5" fill={P.pencilDark} />
        <circle cx="74.5" cy="22" r="1" fill="#FFF" />
        <circle cx="84.5" cy="22" r="1" fill="#FFF" />
      </>}
      {eyeStyle === 'angry' && <>
        <circle cx="74" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <circle cx="84" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <circle cx="75.5" cy="24" r="2.5" fill={P.pencilDark} />
        <circle cx="85.5" cy="24" r="2.5" fill={P.pencilDark} />
        <line x1="71" y1="18" x2="77" y2="20" stroke={P.pencilDark} strokeWidth="2" strokeLinecap="round" />
        <line x1="87" y1="20" x2="81" y2="18" stroke={P.pencilDark} strokeWidth="2" strokeLinecap="round" />
      </>}
      {eyeStyle === 'cool' && <>
        <circle cx="74" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <circle cx="84" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <rect x="70" y="20" width="8.5" height="4" rx="1.5" fill={P.pencilDark} />
        <rect x="80" y="20" width="8.5" height="4" rx="1.5" fill={P.pencilDark} />
      </>}
      {eyeStyle === 'wink' && <>
        <circle cx="74" cy="23" r="4.5" fill="#FFF" stroke={P.pencilDark} strokeWidth="1.5" />
        <circle cx="75.5" cy="23.5" r="2.5" fill={P.pencilDark} />
        <circle cx="74.5" cy="22" r="1" fill="#FFF" />
        <path d="M 81 24.5 Q 84 20 87 24.5" stroke={P.pencilDark} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>}

      <path d="M 86 30 Q 90 33, 88 36" stroke="#C75B5B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 88 29 Q 92 32, 92 35" stroke="#C75B5B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* 로고 — 큰 사이즈 + 강한 손그림 워블 + 뱀 낙서 장식 */
function GameLogo() {
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="360" height="100" viewBox="0 0 360 100" style={{ maxWidth: '90vw', height: 'auto' }}>
        <defs>
          <filter id="logo-sketch" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="3" seed="5" result="turbulence" />
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {/* 왼쪽 뱀 낙서 장식 */}
        <g filter="url(#logo-sketch)" opacity="0.5">
          <path d="M 28 30 Q 18 40, 28 50 Q 38 58, 30 66"
            fill="none" stroke={P.crayonGreen} strokeWidth="5" strokeLinecap="round" />
          <circle cx="30" cy="25" r="5" fill={P.crayonGreen} opacity="0.7" />
          <circle cx="27" cy="23" r="1.5" fill={P.pencilDark} />
          <circle cx="33" cy="23" r="1.5" fill={P.pencilDark} />
          <path d="M 35 27 L 39 25 M 35 27 L 39 29" stroke={P.crayonRed} strokeWidth="1" strokeLinecap="round" />
        </g>
        {/* 메인 타이틀 */}
        <g filter="url(#logo-sketch)">
          <text x="195" y="62" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="60"
            letterSpacing="2" fill="none" stroke={P.pencilDark} strokeWidth="5" strokeLinejoin="round"
            opacity="0.25"
          >CROSNAKE</text>
          <text x="195" y="62" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="60"
            letterSpacing="2" fill="none" stroke={P.pencilDark} strokeWidth="2" strokeLinejoin="round"
          >CROSNAKE</text>
          <text x="195" y="62" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="60"
            letterSpacing="2" fill={P.pencilDark} opacity="0.85"
          >CROSNAKE</text>
          <text x="195" y="62" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="60"
            letterSpacing="2" fill={P.crayonOrange} opacity="0.7"
          >C<tspan fill="transparent">ROSNAKE</tspan></text>
          <text x="195" y="62" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="60"
            letterSpacing="2" fill={P.crayonPink} opacity="0.7"
          ><tspan fill="transparent">CRO</tspan>S<tspan fill="transparent">NAKE</tspan></text>
        </g>
        {/* 두꺼운 연필 밑줄 */}
        <path d="M 72 70 Q 130 73, 195 68 Q 260 63, 318 70"
          fill="none" stroke={P.pencilDark} strokeWidth="2.5" opacity="0.3" strokeLinecap="round" />
        <path d="M 78 72 Q 135 74, 195 70 Q 258 66, 312 73"
          fill="none" stroke={P.pencilDark} strokeWidth="1" opacity="0.15" strokeLinecap="round" />
        {/* 서브타이틀 */}
        <text x="195" y="88" textAnchor="middle"
          fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="400" fontSize="12"
          letterSpacing="4" fill={P.pencilMedium}
        >SLITHER · GROW · WIN</text>
      </svg>
    </div>
  );
}

/* 스킨 캐러셀 */
const SKINS_PER_PAGE = 8;

function SkinCarousel({ skinId, onSelect }: { skinId: number; onSelect: (id: number) => void }) {
  const skin = DEFAULT_SKINS[skinId];
  const totalPages = Math.ceil(DEFAULT_SKINS.length / SKINS_PER_PAGE);
  const currentPage = Math.floor(skinId / SKINS_PER_PAGE);

  const prevSkin = () => onSelect((skinId - 1 + DEFAULT_SKINS.length) % DEFAULT_SKINS.length);
  const nextSkin = () => onSelect((skinId + 1) % DEFAULT_SKINS.length);

  const pageStart = currentPage * SKINS_PER_PAGE;
  const pageSkins = DEFAULT_SKINS.slice(pageStart, pageStart + SKINS_PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={prevSkin} aria-label="Previous skin" className="arrow-btn"
          style={{
            width: 36, height: 36, borderRadius: '4px',
            border: `1.5px solid ${P.pencilMedium}`,
            backgroundColor: P.paper, color: P.pencilDark,
            fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Patrick Hand", "Inter", sans-serif',
          }}>&#8249;</button>

        <div style={{
          width: 120, height: 120,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SnakeCharacter
            color={skin?.primaryColor ?? P.crayonOrange}
            secondaryColor={skin?.secondaryColor ?? P.crayonRed}
            size={110}
            eyeStyle={skin?.eyeStyle ?? 'dot'}
          />
        </div>

        <button onClick={nextSkin} aria-label="Next skin" className="arrow-btn"
          style={{
            width: 36, height: 36, borderRadius: '4px',
            border: `1.5px solid ${P.pencilMedium}`,
            backgroundColor: P.paper, color: P.pencilDark,
            fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Patrick Hand", "Inter", sans-serif',
          }}>&#8250;</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {pageSkins.map((s, i) => {
            const globalIndex = pageStart + i;
            const isSelected = skinId === globalIndex;
            return (
              <button key={globalIndex} onClick={() => onSelect(globalIndex)}
                aria-label={`Skin ${globalIndex + 1}`}
                style={{
                  width: isSelected ? 26 : 22, height: isSelected ? 26 : 22,
                  borderRadius: '4px', backgroundColor: s.primaryColor, padding: 0,
                  opacity: isSelected ? 1 : 0.7,
                  border: isSelected ? `2.5px solid ${P.pencilDark}` : `1.5px solid ${P.pencilMedium}`,
                  cursor: 'pointer', transition: 'all 120ms ease',
                }}
              />
            );
          })}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
            {Array.from({ length: totalPages }, (_, i) => (
              <div key={i} style={{
                width: currentPage === i ? 12 : 5, height: 3, borderRadius: 1,
                backgroundColor: currentPage === i ? P.pencilDark : P.pencilLight,
                transition: 'all 150ms ease',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<'lobby' | 'playing'>('lobby');
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);
  const { dataRef, uiState, joinRoom, leaveRoom, sendInput, respawn, disconnect } = useSocket();

  const handleQuickJoin = useCallback(() => {
    const name = playerName || `Snake${Math.floor(Math.random() * 9999)}`;
    joinRoom('quick', name, skinId);
    setMode('playing');
  }, [joinRoom, playerName, skinId]);

  const handleJoinRoom = useCallback((roomId: string) => {
    const name = playerName || `Snake${Math.floor(Math.random() * 9999)}`;
    joinRoom(roomId, name, skinId);
    setMode('playing');
  }, [joinRoom, playerName, skinId]);

  const handleExit = useCallback(() => {
    leaveRoom();
    setMode('lobby');
  }, [leaveRoom]);

  if (mode === 'playing') {
    return (
      <GameCanvas
        dataRef={dataRef}
        uiState={uiState}
        sendInput={sendInput}
        respawn={respawn}
        playerName={playerName || `Snake${Math.floor(Math.random() * 9999)}`}
        skinId={skinId}
        onExit={handleExit}
      />
    );
  }

  return (
    <main className="lobby-main" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', height: '100vh',
      overflow: 'auto',
      fontFamily: '"Patrick Hand", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      backgroundColor: P.paper,
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: LOBBY_STYLES }} />

      {/* 2-Column 래퍼 (모바일: 1-column 스택) */}
      <div className="lobby-columns" style={{
        display: 'flex', flexDirection: 'row',
        gap: '2rem', width: '100%', maxWidth: '960px',
        padding: '2rem 1.5rem', boxSizing: 'border-box',
        alignItems: 'flex-start',
      }}>

        {/* ===== 왼쪽 컬럼: 로고 + 캐릭터 + 이름 + 버튼 ===== */}
        <div className="lobby-left" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '1rem', flex: '0 0 45%', maxWidth: '380px',
        }}>
          <GameLogo />
          <SkinCarousel skinId={skinId} onSelect={setSkinId} />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              type="text" value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name..."
              maxLength={16}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickJoin(); }}
              className="name-input"
              style={{
                padding: '0.85rem 1rem', fontSize: '1.1rem', width: '100%',
                backgroundColor: P.paper,
                border: `1.5px solid ${P.pencilMedium}`,
                borderRadius: '4px', color: P.pencilDark,
                outline: 'none',
                fontFamily: '"Patrick Hand", "Inter", sans-serif',
                fontWeight: 400,
                boxSizing: 'border-box', textAlign: 'center',
              }}
            />

            <button className="play-btn" onClick={handleQuickJoin} style={{
              padding: '0', fontSize: '1.5rem',
              backgroundColor: P.crayonOrange, color: P.paper,
              border: `2px solid ${P.pencilDark}`,
              borderRadius: '4px', cursor: 'pointer',
              fontWeight: 700,
              fontFamily: '"Patrick Hand", "Inter", sans-serif',
              height: '3.4rem', textTransform: 'uppercase',
              letterSpacing: '0.06em', width: '100%',
              transition: 'transform 100ms',
            }}>
              QUICK PLAY!
            </button>
          </div>

          {/* Connection status — 왼쪽 하단 */}
          {!uiState.connected && (
            <div style={{
              fontSize: '0.75rem', color: P.crayonRed, fontWeight: 700,
              fontFamily: '"Patrick Hand", "Inter", sans-serif',
            }}>
              Connecting...
            </div>
          )}
        </div>

        {/* ===== 오른쪽 컬럼: 룸 리스트 + 최근 우승자 + 힌트 ===== */}
        <div className="lobby-right" style={{
          display: 'flex', flexDirection: 'column',
          gap: '1rem', flex: '1 1 55%', minWidth: 0,
        }}>
          {/* Room List */}
          {uiState.rooms.length > 0 && (
            <RoomList rooms={uiState.rooms} onJoinRoom={handleJoinRoom} />
          )}

          {/* Recent Winners */}
          <RecentWinnersPanel winners={uiState.recentWinners} />

          {/* Controls hint */}
          <div style={{
            display: 'flex', gap: '1.2rem', justifyContent: 'center',
            fontSize: '0.8rem', color: P.pencilLight, fontWeight: 400,
            letterSpacing: '0.03em',
            fontFamily: '"Patrick Hand", "Inter", sans-serif',
            marginTop: 'auto',
          }}>
            <span>Mouse = Steer</span>
            <span>Click = Boost</span>
          </div>
        </div>

      </div>
    </main>
  );
}

const LOBBY_STYLES = `
  .lobby-main::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/images/lobby-bg.png') center/cover no-repeat;
    opacity: 0.2;
    pointer-events: none;
    z-index: 0;
  }
  .lobby-main > * {
    position: relative;
    z-index: 1;
  }
  .play-btn:hover {
    transform: translateY(-2px) !important;
    opacity: 0.9;
  }
  .play-btn:active {
    transform: translateY(2px) !important;
  }
  .arrow-btn:hover {
    background-color: #EDE7DB !important;
  }
  .arrow-btn:active {
    transform: scale(0.95);
  }
  .name-input:focus {
    border-color: #3A3028 !important;
  }
  /* 모바일: 1-column 스택 */
  @media (max-width: 768px) {
    .lobby-main {
      align-items: flex-start !important;
    }
    .lobby-columns {
      flex-direction: column !important;
      align-items: center !important;
      padding: 1.5rem 1rem !important;
      gap: 1.2rem !important;
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
