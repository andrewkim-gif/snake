'use client';

import { useState, useCallback } from 'react';
import { GameCanvas } from '@/components/game/GameCanvas';
import { DEFAULT_SKINS } from '@snake-arena/shared';

/* Brawl Stars Bold Cartoon 팔레트 */
const BS = {
  bg: '#0F1923',
  panel: 'rgba(15, 10, 40, 0.85)',
  gold: '#FFD700',
  goldDark: '#FF8C00',
  green: '#39FF14',
  greenDark: '#1A8A0A',
  blue: '#00D4FF',
  white: '#FFFFFF',
  textMuted: '#8899AA',
  black: '#000000',
} as const;

/* SVG 뱀 캐릭터 — S자 곡선 몸통 + 둥근 머리 + 표정 */
function SnakeCharacter({ color, secondaryColor, size = 120, eyeStyle = 'default', direction = 'right', className = '' }: {
  color: string; secondaryColor: string; size?: number; eyeStyle?: string; direction?: 'left' | 'right'; className?: string;
}) {
  const flip = direction === 'left' ? 'scale(-1, 1)' : '';

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className}
      style={{ filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.45))' }}>
      <g transform={`translate(60,60) ${flip} translate(-60,-60)`}>
        {/* 몸통 — 깔끔한 S자 곡선, 꼬리→머리 방향 */}
        <path d="M 20 78 C 35 78, 40 50, 55 50 C 70 50, 65 80, 80 80 C 90 80, 92 68, 92 58"
          stroke="#000" strokeWidth="22" fill="none" strokeLinecap="round" />
        <path d="M 20 78 C 35 78, 40 50, 55 50 C 70 50, 65 80, 80 80 C 90 80, 92 68, 92 58"
          stroke={color} strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d="M 20 78 C 35 78, 40 50, 55 50 C 70 50, 65 80, 80 80 C 90 80, 92 68, 92 58"
          stroke={secondaryColor} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.5" />
        {/* 머리 — 둥근 원형 */}
        <circle cx="92" cy="50" r="18" fill="#000" />
        <circle cx="92" cy="50" r="15" fill={color} />
        {/* 머리 하이라이트 */}
        <circle cx="87" cy="44" r="5" fill="rgba(255,255,255,0.2)" />
        {/* ── 표정별 눈 ── */}
        {eyeStyle === 'default' && <>
          {/* 기본 — 동글동글 친근한 눈 */}
          <circle cx="87" cy="47" r="6" fill="#FFF" />
          <circle cx="99" cy="47" r="6" fill="#FFF" />
          <circle cx="89" cy="47" r="3" fill="#111" />
          <circle cx="101" cy="47" r="3" fill="#111" />
          <circle cx="88" cy="45" r="1.5" fill="#FFF" />
          <circle cx="100" cy="45" r="1.5" fill="#FFF" />
        </>}
        {eyeStyle === 'angry' && <>
          {/* 화남 — 찌푸린 눈 + 눈썹 */}
          <circle cx="87" cy="48" r="6" fill="#FFF" />
          <circle cx="99" cy="48" r="6" fill="#FFF" />
          <circle cx="89" cy="49" r="3.5" fill="#B00" />
          <circle cx="101" cy="49" r="3.5" fill="#B00" />
          <circle cx="88" cy="47" r="1.2" fill="#FFF" />
          <circle cx="100" cy="47" r="1.2" fill="#FFF" />
          {/* V자 눈썹 */}
          <line x1="82" y1="39" x2="91" y2="42" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="104" y1="42" x2="95" y2="39" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
          {/* 이빨 */}
          <polygon points="86,56 89,62 92,56" fill="#FFF" />
          <polygon points="96,56 99,62 102,56" fill="#FFF" />
        </>}
        {eyeStyle === 'cute' && <>
          {/* 귀여움 — 반짝이는 큰 눈 + 볼터치 */}
          <circle cx="87" cy="47" r="7" fill="#FFF" />
          <circle cx="99" cy="47" r="7" fill="#FFF" />
          <circle cx="89" cy="48" r="4" fill="#222" />
          <circle cx="101" cy="48" r="4" fill="#222" />
          {/* 큰 하이라이트 + 작은 하이라이트 */}
          <circle cx="87" cy="45" r="2.5" fill="#FFF" />
          <circle cx="99" cy="45" r="2.5" fill="#FFF" />
          <circle cx="91" cy="49" r="1" fill="#FFF" />
          <circle cx="103" cy="49" r="1" fill="#FFF" />
          {/* 볼터치 */}
          <ellipse cx="83" cy="55" rx="4" ry="2.5" fill="#FF6B8A" opacity="0.5" />
          <ellipse cx="103" cy="55" rx="4" ry="2.5" fill="#FF6B8A" opacity="0.5" />
          {/* 웃는 입 */}
          <path d="M 89 56 Q 93 60, 97 56" stroke="#222" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>}
        {eyeStyle === 'cool' && <>
          {/* 쿨한 — 선글라스 */}
          <rect x="81" y="43" width="14" height="8" rx="3" fill="#111" />
          <rect x="97" y="43" width="14" height="8" rx="3" fill="#111" />
          {/* 선글라스 반짝 */}
          <line x1="83" y1="45" x2="87" y2="45" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="99" y1="45" x2="103" y2="45" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
          {/* 브릿지 */}
          <line x1="95" y1="47" x2="97" y2="47" stroke="#111" strokeWidth="2" strokeLinecap="round" />
          {/* 입꼬리 올린 미소 */}
          <path d="M 88 57 Q 93 60, 98 57" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>}
        {/* 꼬리 끝 — 동그란 마무리 */}
        <circle cx="20" cy="78" r="6" fill="#000" />
        <circle cx="20" cy="78" r="4" fill={color} />
      </g>
    </svg>
  );
}

/* 스킨 선택 캐러셀 — 좌우 화살표 + 대형 프리뷰 */
function SkinCarousel({ skinId, onSelect }: { skinId: number; onSelect: (id: number) => void }) {
  const skin = DEFAULT_SKINS[skinId];
  const prev = () => onSelect((skinId - 1 + DEFAULT_SKINS.length) % DEFAULT_SKINS.length);
  const next = () => onSelect((skinId + 1) % DEFAULT_SKINS.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      {/* 대형 캐릭터 프리뷰 + 좌우 화살표 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button onClick={prev} className="arrow-btn" aria-label="Previous skin"
          style={{
            width: 40, height: 40, borderRadius: '50%', border: `3px solid ${BS.black}`,
            backgroundColor: 'rgba(255,255,255,0.1)', color: BS.white,
            fontSize: '1.3rem', fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 3px 0 ${BS.black}`, fontFamily: 'inherit',
          }}>
          ‹
        </button>

        <div className="skin-preview" style={{
          width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
          borderRadius: '50%', position: 'relative',
        }}>
          {/* 글로우 링 */}
          <div style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: `2px solid ${skin?.primaryColor ?? BS.gold}`,
            opacity: 0.4, boxShadow: `0 0 20px ${skin?.primaryColor ?? BS.gold}40`,
          }} />
          <SnakeCharacter
            color={skin?.primaryColor ?? BS.gold}
            secondaryColor={skin?.secondaryColor ?? BS.goldDark}
            size={120}
            eyeStyle={skin?.eyeStyle ?? 'default'}
            direction="right"
          />
        </div>

        <button onClick={next} className="arrow-btn" aria-label="Next skin"
          style={{
            width: 40, height: 40, borderRadius: '50%', border: `3px solid ${BS.black}`,
            backgroundColor: 'rgba(255,255,255,0.1)', color: BS.white,
            fontSize: '1.3rem', fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 3px 0 ${BS.black}`, fontFamily: 'inherit',
          }}>
          ›
        </button>
      </div>

      {/* 스킨 색상 도트 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {DEFAULT_SKINS.map((s, i) => (
          <button key={i} onClick={() => onSelect(i)} aria-label={`Skin ${i + 1}`}
            style={{
              width: skinId === i ? 28 : 22, height: skinId === i ? 28 : 22,
              borderRadius: '50%', backgroundColor: s.primaryColor, padding: 0,
              border: skinId === i ? `3px solid ${BS.gold}` : `2px solid ${BS.black}`,
              cursor: 'pointer', transition: 'all 150ms ease',
              boxShadow: skinId === i
                ? `0 0 10px ${s.primaryColor}, 0 2px 0 rgba(0,0,0,0.4)`
                : `0 2px 0 rgba(0,0,0,0.3)`,
            }}
          />
        ))}
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
      />
    );
  }

  return (
    <main style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', height: '100vh', backgroundColor: BS.bg,
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: LOBBY_STYLES }} />

      {/* 배경 이미지 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/lobby-bg.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.5, pointerEvents: 'none',
      }} />

      {/* 배경 비네트 오버레이 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, transparent 30%, ${BS.bg} 100%)`,
        pointerEvents: 'none',
      }} />

      {/* 플로팅 뱀 데코 */}
      <div className="float-a" style={{
        position: 'absolute', top: '8%', left: '4%', opacity: 0.35, pointerEvents: 'none',
      }}>
        <SnakeCharacter color="#FF4444" secondaryColor="#CC0000" size={80} eyeStyle="angry" direction="right" />
      </div>
      <div className="float-b" style={{
        position: 'absolute', top: '15%', right: '5%', opacity: 0.3, pointerEvents: 'none',
      }}>
        <SnakeCharacter color="#00D4FF" secondaryColor="#0099CC" size={65} eyeStyle="cool" direction="left" />
      </div>
      <div className="float-c" style={{
        position: 'absolute', bottom: '12%', left: '6%', opacity: 0.25, pointerEvents: 'none',
      }}>
        <SnakeCharacter color="#FF1493" secondaryColor="#CC0066" size={55} eyeStyle="cute" direction="right" />
      </div>
      <div className="float-d" style={{
        position: 'absolute', bottom: '20%', right: '4%', opacity: 0.3, pointerEvents: 'none',
      }}>
        <SnakeCharacter color="#39FF14" secondaryColor="#00CC00" size={60} eyeStyle="default" direction="left" />
      </div>

      {/* ═══ 중앙 게임 로비 UI ═══ */}
      <div className="lobby-container" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
        position: 'relative', zIndex: 2, width: '100%', maxWidth: '420px',
        padding: '0 1.5rem', boxSizing: 'border-box',
      }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(1.8rem, 6vw, 2.6rem)', margin: 0,
            fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1,
            textTransform: 'uppercase', position: 'relative',
            color: BS.white,
            transform: 'rotate(-2deg)',
            textShadow: `3px 3px 0 ${BS.black}, -2px -2px 0 ${BS.black}, 2px -2px 0 ${BS.black}, -2px 2px 0 ${BS.black}, 0 4px 0 ${BS.black}`,
            WebkitTextStroke: `2px ${BS.black}`,
            paintOrder: 'stroke fill',
          }}>
            CROSNAKE
          </h1>
          <p style={{
            fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', margin: '0.3rem 0 0',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.25em',
          }}>
            Eat &middot; Grow &middot; Dominate
          </p>
        </div>

        {/* 캐릭터 프리뷰 + 스킨 선택 */}
        <SkinCarousel skinId={skinId} onSelect={setSkinId} />

        {/* 게임 진입 패널 */}
        <div style={{
          width: '100%', backgroundColor: BS.panel,
          borderRadius: '20px', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
          border: `3px solid ${BS.black}`,
          boxShadow: `0 6px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.3),
                      inset 0 1px 0 rgba(255,255,255,0.06)`,
          backdropFilter: 'blur(10px)',
        }}>
          {/* 이름 입력 */}
          <input
            type="text" value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="ENTER YOUR NAME..."
            maxLength={16}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePlay(); }}
            style={{
              padding: '0.9rem 1.2rem', fontSize: '1rem', width: '100%',
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: `2px solid rgba(255,255,255,0.12)`,
              borderRadius: '14px', color: BS.white,
              outline: 'none', fontFamily: 'inherit', fontWeight: 700,
              boxSizing: 'border-box', textTransform: 'uppercase',
              letterSpacing: '0.06em', textAlign: 'center',
            }}
            onFocus={(e) => { e.target.style.borderColor = BS.blue; e.target.style.boxShadow = `0 0 12px ${BS.blue}30`; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
          />

          {/* PLAY 버튼 — 3D 카툰 */}
          <button className="play-btn" onClick={handlePlay} style={{
            padding: '0', fontSize: '1.4rem',
            backgroundColor: BS.green, color: BS.black,
            border: `3px solid ${BS.black}`,
            borderRadius: '16px', cursor: 'pointer',
            fontWeight: 900, fontFamily: 'inherit',
            height: '3.6rem', textTransform: 'uppercase',
            letterSpacing: '0.06em', width: '100%',
            boxShadow: `0 6px 0 ${BS.greenDark}, 0 8px 12px rgba(0,0,0,0.4),
                        inset 0 2px 0 rgba(255,255,255,0.35)`,
            transition: 'transform 100ms, box-shadow 100ms',
          }}>
            PLAY!
          </button>
        </div>

        {/* 조작법 힌트 */}
        <div style={{
          display: 'flex', gap: '1.5rem', justifyContent: 'center',
          fontSize: '0.75rem', color: BS.textMuted, fontWeight: 700,
          textShadow: `1px 1px 0 ${BS.black}`,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          <span>🖱️ Steer</span>
          <span>🖱️ Click = Boost</span>
          <span>🔵 Eat Orbs</span>
        </div>
      </div>
    </main>
  );
}

const LOBBY_STYLES = `
  /* 플레이 버튼 인터랙션 */
  .play-btn:hover {
    transform: translateY(-2px) !important;
    filter: brightness(1.1);
  }
  .play-btn:active {
    transform: translateY(3px) !important;
    box-shadow: 0 3px 0 #1A8A0A, 0 4px 6px rgba(0,0,0,0.4),
                inset 0 2px 0 rgba(255,255,255,0.3) !important;
  }
  /* 화살표 버튼 */
  .arrow-btn:hover {
    background-color: rgba(255,255,255,0.2) !important;
    transform: scale(1.1);
  }
  .arrow-btn:active {
    transform: scale(0.95) translateY(2px);
    box-shadow: 0 1px 0 #000 !important;
  }
  /* 스킨 프리뷰 바운스 */
  .skin-preview {
    animation: previewPulse 3s ease-in-out infinite;
  }
  @keyframes previewPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }
  /* 플로팅 뱀 데코 */
  .float-a { animation: fA 6s ease-in-out infinite; }
  .float-b { animation: fB 7s ease-in-out infinite 1s; }
  .float-c { animation: fC 8s ease-in-out infinite 2s; }
  .float-d { animation: fB 6.5s ease-in-out infinite 0.5s; }
  @keyframes fA {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(5deg); }
  }
  @keyframes fB {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-12px) rotate(-4deg); }
  }
  @keyframes fC {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(3deg); }
  }
  /* 모바일 대응 */
  @media (max-width: 640px) {
    .float-a, .float-b, .float-c, .float-d {
      display: none !important;
    }
    .lobby-container {
      max-width: 100% !important;
      padding: 0 1rem !important;
    }
  }
`;
