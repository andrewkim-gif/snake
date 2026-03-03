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

/* 스케치 뱀 캐릭터 — 연필 아웃라인 + 크레용 fill + feTurbulence 워블 */
function SnakeCharacter({ color, secondaryColor, size = 120, eyeStyle = 'default' }: {
  color: string; secondaryColor: string; size?: number; eyeStyle?: string;
}) {
  const outline = darkenHex(color, 0.4);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <filter id="sketch-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" seed="3" result="turbulence" />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#sketch-wobble)">
        {/* 바디 — 연필 아웃라인 + 크레용 */}
        <path
          d="M 28 70 Q 38 50, 50 52 Q 62 54, 58 40"
          stroke={outline} strokeWidth="14" fill="none" strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M 28 70 Q 38 50, 50 52 Q 62 54, 58 40"
          stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          opacity="0.8"
        />
        {/* 바디 내부 */}
        <path
          d="M 28 70 Q 38 50, 50 52 Q 62 54, 58 40"
          stroke={secondaryColor} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.4"
        />

        {/* 꼬리 — 연필 점 */}
        <circle cx="28" cy="70" r="4" stroke={outline} strokeWidth="1.5" fill={color} opacity="0.8" />

        {/* 머리 — 연필 원 */}
        <circle cx="58" cy="32" r="15" stroke={outline} strokeWidth="2.5" fill="none" opacity="0.5" />
        <circle cx="58" cy="32" r="13" fill={color} opacity="0.8" />

        {/* 해칭 음영 */}
        <line x1="50" y1="36" x2="53" y2="42" stroke={outline} strokeWidth="0.8" opacity="0.2" />
        <line x1="52" y1="35" x2="55" y2="41" stroke={outline} strokeWidth="0.8" opacity="0.2" />
        <line x1="54" y1="34" x2="57" y2="40" stroke={outline} strokeWidth="0.8" opacity="0.2" />

        {/* 눈 */}
        {eyeStyle === 'dot' && <>
          <circle cx="54" cy="30" r="2.5" fill={P.pencilDark} />
          <circle cx="64" cy="30" r="2.5" fill={P.pencilDark} />
        </>}
        {(eyeStyle === 'default' || eyeStyle === 'cute') && <>
          <circle cx="54" cy="30" r="4.5" fill={P.paper} stroke={P.pencilDark} strokeWidth="1.2" />
          <circle cx="64" cy="30" r="4.5" fill={P.paper} stroke={P.pencilDark} strokeWidth="1.2" />
          <circle cx="55" cy="30.5" r="2" fill={P.pencilDark} />
          <circle cx="65" cy="30.5" r="2" fill={P.pencilDark} />
        </>}
        {eyeStyle === 'angry' && <>
          <circle cx="54" cy="30" r="4.5" fill={P.paper} stroke={P.pencilDark} strokeWidth="1.2" />
          <circle cx="64" cy="30" r="4.5" fill={P.paper} stroke={P.pencilDark} strokeWidth="1.2" />
          <circle cx="55" cy="31" r="2.2" fill={P.pencilDark} />
          <circle cx="65" cy="31" r="2.2" fill={P.pencilDark} />
          <line x1="50" y1="26" x2="57" y2="28" stroke={P.pencilDark} strokeWidth="2" strokeLinecap="round" />
          <line x1="68" y1="28" x2="61" y2="26" stroke={P.pencilDark} strokeWidth="2" strokeLinecap="round" />
        </>}
        {eyeStyle === 'cool' && <>
          <rect x="49" y="28" width="10" height="5" rx="1" fill={P.pencilDark} />
          <rect x="61" y="28" width="10" height="5" rx="1" fill={P.pencilDark} />
        </>}
        {eyeStyle === 'wink' && <>
          <circle cx="54" cy="30" r="4.5" fill={P.paper} stroke={P.pencilDark} strokeWidth="1.2" />
          <circle cx="55" cy="30.5" r="2" fill={P.pencilDark} />
          <path d="M 61 31 Q 64 28 67 31" stroke={P.pencilDark} strokeWidth="2" fill="none" strokeLinecap="round" />
        </>}
      </g>
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
    <main style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', height: '100vh',
      overflow: 'hidden',
      fontFamily: '"Patrick Hand", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      background: `${P.paper} url('/images/lobby-bg.png') center/cover no-repeat`,
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
