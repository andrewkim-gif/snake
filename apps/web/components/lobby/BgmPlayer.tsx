'use client';

/**
 * BGM Player — 미니멀 재생/멈춤 토글 버튼
 * 좌하단 버튼들과 동일한 디자인 언어, 우하단 배치
 * HTMLAudioElement 기반, 기존 SoundEngine과 독립
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';

// 플레이리스트 — public/sounds/bgm/ 디렉토리
const PLAYLIST = [
  { src: '/sounds/bgm/bgm1.mp3', name: 'Track 01' },
  { src: '/sounds/bgm/bgm2.mp3', name: 'Track 02' },
];

// localStorage 키
const LS_VOLUME = 'aww-bgm-volume';
const LS_MUTED = 'aww-bgm-muted';
const LS_TRACK = 'aww-bgm-track';

interface BgmPlayerProps {
  /** 플레이어 표시 여부 (로비 모드에서만) */
  visible?: boolean;
  /** 우하단 bottom offset */
  bottomOffset?: number;
}

export function BgmPlayer({ visible = true, bottomOffset = 48 }: BgmPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(LS_TRACK);
    return saved ? Math.min(parseInt(saved, 10), PLAYLIST.length - 1) : 0;
  });
  const [volume] = useState(() => {
    if (typeof window === 'undefined') return 0.5;
    const saved = localStorage.getItem(LS_VOLUME);
    return saved ? parseFloat(saved) : 0.5;
  });
  const [isMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_MUTED) === 'true';
  });
  const [hover, setHover] = useState(false);

  // Audio 엘리먼트 초기화
  useEffect(() => {
    const audio = new Audio(PLAYLIST[trackIndex].src);
    audio.volume = isMuted ? 0 : volume;
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onEnded = () => {
      // 다음 트랙 자동 재생
      setTrackIndex(prev => {
        const next = (prev + 1) % PLAYLIST.length;
        localStorage.setItem(LS_TRACK, String(next));
        return next;
      });
    };

    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex]);

  // trackIndex 변경 → 재생 중이었으면 새 트랙도 재생
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = PLAYLIST[trackIndex].src;
    audio.volume = isMuted ? 0 : volume;
    if (isPlaying) {
      audio.play().catch(() => {/* autoplay 차단 */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {/* autoplay 차단 */});
    }
  }, [isPlaying]);

  return (
    <div style={{
      position: 'absolute',
      bottom: bottomOffset,
      right: 16,
      zIndex: 65,
      pointerEvents: visible ? 'auto' : 'none',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(20px)',
      transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
    }}>
      {/* 재생/멈춤 버튼 */}
      <button
        onClick={togglePlay}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
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
          backgroundColor: isPlaying ? SK.accent : `rgba(239, 68, 68, 0.7)`,
          cursor: 'pointer',
          transition: `all ${OVERLAY.transition}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
          boxShadow: isPlaying
            ? '0 0 24px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
            : hover
              ? '0 0 20px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 0 16px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          borderLeft: `3px solid ${SK.accent}`,
        }}
      >
        {isPlaying
          ? <Pause size={12} color="#FFFFFF" strokeWidth={2.5} />
          : <Play size={12} color="#FFFFFF" strokeWidth={2.5} />
        }
        {isPlaying ? 'BGM ON' : 'BGM OFF'}
      </button>
    </div>
  );
}
