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

/* 스케치 뱀 캐릭터 — 게임 내 렌더링과 일치하는 둥근 세그먼트 체인 + wobbly 아웃라인 */
function SnakeCharacter({ color, secondaryColor, size = 120, eyeStyle = 'default' }: {
  color: string; secondaryColor: string; size?: number; eyeStyle?: string;
}) {
  const outline = darkenHex(color, 0.4);
  // 게임과 동일한 세그먼트 체인 바디 (둥근 원형 조인트)
  // S-curve를 따라 배치된 8개 원 + wobbly 머리
  const bodyPts = [
    { x: 25, y: 78 }, { x: 28, y: 70 }, { x: 33, y: 63 },
    { x: 40, y: 57 }, { x: 47, y: 53 }, { x: 53, y: 48 },
    { x: 57, y: 42 },
  ];
  const headCenter = { x: 58, y: 32 };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* 바디 세그먼트 — 게임과 동일: 아웃라인 원 + 크레용 fill 원 체인 */}
      {/* Pass 1: 연필 아웃라인 (darken 40%, 게임의 2-pass sketch outline과 동일) */}
      {bodyPts.map((p, i) => {
        const r = 7 - i * 0.4; // 꼬리로 갈수록 작아짐
        const jx = ((Math.sin(i * 9301 + 49297) * 49271) % 1 - 0.5) * 1.5;
        const jy = ((Math.sin((i+1) * 9301 + 49297) * 49271) % 1 - 0.5) * 1.5;
        return <circle key={`o${i}`} cx={p.x + jx} cy={p.y + jy} r={r + 1.5}
          fill={outline} opacity="0.5" />;
      })}
      {/* Pass 2: 크레용 fill (opacity 0.85 — 게임과 동일) */}
      {bodyPts.map((p, i) => {
        const r = 7 - i * 0.4;
        return <circle key={`f${i}`} cx={p.x} cy={p.y} r={r}
          fill={color} opacity="0.85" />;
      })}
      {/* 바디 내부 secondary 라인 (게임의 secondary stroke와 동일) */}
      {bodyPts.map((p, i) => {
        const r = (7 - i * 0.4) * 0.35;
        return <circle key={`s${i}`} cx={p.x} cy={p.y} r={r}
          fill={secondaryColor} opacity="0.4" />;
      })}

      {/* 꼬리 끝 — 작은 점 */}
      <circle cx="22" cy="83" r="3" fill={outline} opacity="0.4" />
      <circle cx="22" cy="83" r="2" fill={color} opacity="0.7" />

      {/* 머리 — wobbly 8각형 (게임의 wobblyCirclePath와 동일) */}
      <polygon
        points="72,30 70,23 64,19 56,20 51,25 50,33 54,40 62,42 69,38"
        fill={outline} opacity="0.5"
      />
      <polygon
        points="71,30 69,24 64,21 57,22 53,26 52,33 55,39 62,40 68,37"
        fill={color} opacity="0.85"
      />

      {/* 해칭 음영 (게임의 drawHatching과 동일 — 짧은 대각선) */}
      <line x1="54" y1="35" x2="56" y2="39" stroke={outline} strokeWidth="0.7" opacity="0.2" />
      <line x1="56" y1="34" x2="58" y2="38" stroke={outline} strokeWidth="0.7" opacity="0.2" />
      <line x1="58" y1="33" x2="60" y2="37" stroke={outline} strokeWidth="0.7" opacity="0.2" />
      <line x1="60" y1="32" x2="62" y2="36" stroke={outline} strokeWidth="0.7" opacity="0.2" />

      {/* 눈 — 게임의 drawEyes와 동일한 스타일 */}
      {eyeStyle === 'dot' && <>
        <circle cx="58" cy="28" r="2.5" fill={P.pencilDark} />
        <circle cx="66" cy="28" r="2.5" fill={P.pencilDark} />
      </>}
      {(eyeStyle === 'default' || eyeStyle === 'cute') && <>
        {/* wobbly 원 흰자 + 연필 테두리 (게임의 wobblyCirclePath + PAPER fill) */}
        <polygon points="55,24 58,23 61,25 61,29 58,31 55,30" fill={P.paper} stroke={P.pencilDark} strokeWidth="1" />
        <polygon points="63,24 66,23 69,25 69,29 66,31 63,30" fill={P.paper} stroke={P.pencilDark} strokeWidth="1" />
        <circle cx="58.5" cy="27.5" r="2" fill={P.pencilDark} />
        <circle cx="66.5" cy="27.5" r="2" fill={P.pencilDark} />
      </>}
      {eyeStyle === 'angry' && <>
        <polygon points="55,24 58,23 61,25 61,29 58,31 55,30" fill={P.paper} stroke={P.pencilDark} strokeWidth="1" />
        <polygon points="63,24 66,23 69,25 69,29 66,31 63,30" fill={P.paper} stroke={P.pencilDark} strokeWidth="1" />
        <circle cx="58.5" cy="28" r="2.2" fill={P.pencilDark} />
        <circle cx="66.5" cy="28" r="2.2" fill={P.pencilDark} />
        <line x1="54" y1="22" x2="60" y2="23" stroke={P.pencilDark} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="70" y1="23" x2="64" y2="22" stroke={P.pencilDark} strokeWidth="1.8" strokeLinecap="round" />
      </>}
      {eyeStyle === 'cool' && <>
        <rect x="54" y="25" width="8" height="4.5" rx="1" fill={P.pencilDark} />
        <rect x="64" y="25" width="8" height="4.5" rx="1" fill={P.pencilDark} />
      </>}
      {eyeStyle === 'wink' && <>
        <polygon points="55,24 58,23 61,25 61,29 58,31 55,30" fill={P.paper} stroke={P.pencilDark} strokeWidth="1" />
        <circle cx="58.5" cy="27.5" r="2" fill={P.pencilDark} />
        <path d="M 63 29 Q 66 25.5 69 29" stroke={P.pencilDark} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>}
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
      backgroundImage: `url('/images/lobby-bg.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: P.paper,
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
