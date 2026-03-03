'use client';

import { useState, useCallback } from 'react';
import { GameCanvas } from '@/components/game/GameCanvas';
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

/* 색상 어둡게 */
function darkenHex(hex: string, amount: number): string {
  const h = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((h >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((h >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((h & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* 로비 뱀 캐릭터 — 균형잡힌 비율 + 확실한 아웃라인 stroke */
function SnakeCharacter({ color, secondaryColor, size = 120, eyeStyle = 'default' }: {
  color: string; secondaryColor: string; size?: number; eyeStyle?: string;
}) {
  const outline = P.pencilDark; // 완전 검은색 아웃라인 — 손그림 느낌
  const sw = 2.2;

  return (
    <svg width={size} height={size} viewBox="0 0 100 70">
      {/* 바디 — 가로로 기어가는 부드러운 웨이브 */}
      {/* 아웃라인 (검은색, 두꺼운) */}
      <path
        d="M 8 45 Q 20 30, 35 38 Q 50 46, 62 35 Q 72 27, 75 30"
        stroke={outline} strokeWidth="17" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* 색상 fill */}
      <path
        d="M 8 45 Q 20 30, 35 38 Q 50 46, 62 35 Q 72 27, 75 30"
        stroke={color} strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />

      {/* 머리 — 오른쪽 끝, 진행방향 위를 바라봄 */}
      <circle cx="78" cy="26" r="14" fill={outline} />
      <circle cx="78" cy="26" r="12" fill={color} />

      {/* 눈 */}
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

      {/* 혀 */}
      <path d="M 86 30 Q 90 33, 88 36" stroke="#C75B5B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 88 29 Q 92 32, 92 35" stroke="#C75B5B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* 로고 — Patrick Hand 폰트 + 연필 밑줄 + 크레용 악센트 */
function GameLogo() {
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="280" height="64" viewBox="0 0 280 64" style={{ maxWidth: '80vw', height: 'auto' }}>
        <defs>
          <filter id="logo-sketch" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="5" result="turbulence" />
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g filter="url(#logo-sketch)">
          {/* 연필 아웃라인 (2 pass) */}
          <text x="140" y="46" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="44"
            letterSpacing="1" fill="none" stroke={P.pencilDark} strokeWidth="4" strokeLinejoin="round"
            opacity="0.3"
          >
            CROSNAKE
          </text>

          <text x="140" y="46" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="44"
            letterSpacing="1" fill="none" stroke={P.pencilDark} strokeWidth="1.5" strokeLinejoin="round"
          >
            CROSNAKE
          </text>

          {/* 크레용 fill */}
          <text x="140" y="46" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="44"
            letterSpacing="1" fill={P.pencilDark} opacity="0.85"
          >
            CROSNAKE
          </text>

          {/* C — 크레용 오렌지 악센트 */}
          <text x="140" y="46" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="44"
            letterSpacing="1" fill={P.crayonOrange} opacity="0.7"
          >
            C<tspan fill="transparent">ROSNAKE</tspan>
          </text>

          {/* S — 크레용 핑크 악센트 */}
          <text x="140" y="46" textAnchor="middle"
            fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="700" fontSize="44"
            letterSpacing="1" fill={P.crayonPink} opacity="0.7"
          >
            <tspan fill="transparent">CRO</tspan>S<tspan fill="transparent">NAKE</tspan>
          </text>
        </g>

        {/* 연필 밑줄 (wobbly) */}
        <path d="M 55 50 Q 100 52, 140 49 Q 180 46, 225 50"
          fill="none" stroke={P.pencilDark} strokeWidth="1.5" opacity="0.3"
          strokeLinecap="round" />

        {/* 서브타이틀 — 연필 텍스트 */}
        <text x="140" y="62" textAnchor="middle"
          fontFamily="'Patrick Hand', 'Inter', sans-serif" fontWeight="400" fontSize="9"
          letterSpacing="3" fill={P.pencilMedium}
        >
          SLITHER · GROW · WIN
        </text>
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
      {/* 캐릭터 프리뷰 + 좌우 화살표 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={prevSkin} aria-label="Previous skin" className="arrow-btn"
          style={{
            width: 36, height: 36, borderRadius: '4px',
            border: `1.5px solid ${P.pencilMedium}`,
            backgroundColor: P.paper, color: P.pencilDark,
            fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Patrick Hand", "Inter", sans-serif',
          }}>
          &#8249;
        </button>

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
          }}>
          &#8250;
        </button>
      </div>

      {/* 스킨 도트 — 연필 border + 종이 bg */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
        }}>
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

        {/* 페이지 인디케이터 */}
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
  const [playing, setPlaying] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [skinId, setSkinId] = useState(0);

  const handlePlay = useCallback(() => setPlaying(true), []);

  if (playing) {
    return (
      <GameCanvas
        playerName={playerName || `Snake${Math.floor(Math.random() * 9999)}`}
        skinId={skinId}
        onExit={() => setPlaying(false)}
      />
    );
  }

  return (
    <main className="lobby-main" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', height: '100vh',
      overflow: 'hidden',
      fontFamily: '"Patrick Hand", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      backgroundColor: P.paper,
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: LOBBY_STYLES }} />

      {/* 중앙 로비 UI */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '1.25rem', width: '100%', maxWidth: '360px',
        padding: '0 1.5rem', boxSizing: 'border-box',
      }}>

        {/* 로고 */}
        <GameLogo />

        {/* 캐릭터 + 스킨 선택 */}
        <SkinCarousel skinId={skinId} onSelect={setSkinId} />

        {/* 이름 입력 + 플레이 버튼 */}
        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <input
            type="text" value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={16}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePlay(); }}
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

          <button className="play-btn" onClick={handlePlay} style={{
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
            PLAY!
          </button>
        </div>

        {/* 조작법 힌트 */}
        <div style={{
          display: 'flex', gap: '1.2rem', justifyContent: 'center',
          fontSize: '0.8rem', color: P.pencilLight, fontWeight: 400,
          letterSpacing: '0.03em',
          fontFamily: '"Patrick Hand", "Inter", sans-serif',
        }}>
          <span>Mouse = Steer</span>
          <span>Click = Boost</span>
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
  @media (max-width: 640px) {
    main { padding: 0 0.5rem; }
  }
`;
