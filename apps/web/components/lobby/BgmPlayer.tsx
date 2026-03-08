'use client';

/**
 * BGM Player — 로비 우하단 미니 뮤직 플레이어
 * Apex Tactical UI 스타일 (좌하단 버튼과 동일한 디자인 언어)
 * HTMLAudioElement 기반, 기존 SoundEngine과 독립
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
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
  /** 우하단 bottom offset (NewsFeed 높이 + 여백) */
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
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.5;
    const saved = localStorage.getItem(LS_VOLUME);
    return saved ? parseFloat(saved) : 0.5;
  });
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_MUTED) === 'true';
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverBtn, setHoverBtn] = useState<string | null>(null);

  // Audio 엘리먼트 초기화
  useEffect(() => {
    const audio = new Audio(PLAYLIST[trackIndex].src);
    audio.volume = isMuted ? 0 : volume;
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      // 다음 트랙 자동 재생
      setTrackIndex(prev => {
        const next = (prev + 1) % PLAYLIST.length;
        localStorage.setItem(LS_TRACK, String(next));
        return next;
      });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
    };
    // trackIndex 변경 시 새 Audio 생성
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

  // 볼륨/뮤트 변경 반영
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
    localStorage.setItem(LS_VOLUME, String(volume));
    localStorage.setItem(LS_MUTED, String(isMuted));
  }, [volume, isMuted]);

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

  const skipPrev = useCallback(() => {
    const prev = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    localStorage.setItem(LS_TRACK, String(prev));
    setTrackIndex(prev);
  }, [trackIndex]);

  const skipNext = useCallback(() => {
    const next = (trackIndex + 1) % PLAYLIST.length;
    localStorage.setItem(LS_TRACK, String(next));
    setTrackIndex(next);
  }, [trackIndex]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // 프로그레스 바 클릭 시크
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }, [duration]);

  const formatTime = (sec: number) => {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 아이콘 버튼 공통 스타일
  const iconBtn = (name: string, active = false): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: active ? SK.accent : (hoverBtn === name ? SK.textPrimary : SK.textMuted),
    transition: 'color 150ms ease',
  });

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
      {/* 메인 컨테이너 — Apex 스타일 */}
      <div style={{
        position: 'relative',
        width: 200,
        backgroundColor: OVERLAY.bg,
        border: OVERLAY.border,
        borderTop: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: OVERLAY.borderRadius,
        backdropFilter: OVERLAY.blur,
        WebkitBackdropFilter: OVERLAY.blur,
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        overflow: 'hidden',
      }}>
        {/* 상단: 트랙명 + 시간 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px 2px 10px',
        }}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            fontWeight: 600,
            color: SK.textSecondary,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 110,
          }}>
            ♪ {PLAYLIST[trackIndex].name}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.textMuted,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* 프로그레스 바 */}
        <div
          onClick={handleProgressClick}
          style={{
            margin: '2px 10px 4px 10px',
            height: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progress}%`,
            backgroundColor: SK.accent,
            transition: 'width 0.3s linear',
          }} />
        </div>

        {/* 컨트롤 row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px 6px 8px',
          gap: '2px',
        }}>
          {/* Prev */}
          <button
            onClick={skipPrev}
            onMouseEnter={() => setHoverBtn('prev')}
            onMouseLeave={() => setHoverBtn(null)}
            style={iconBtn('prev')}
          >
            <SkipBack size={11} fill="currentColor" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            onMouseEnter={() => setHoverBtn('play')}
            onMouseLeave={() => setHoverBtn(null)}
            style={iconBtn('play', isPlaying)}
          >
            {isPlaying
              ? <Pause size={13} fill="currentColor" />
              : <Play size={13} fill="currentColor" />
            }
          </button>

          {/* Next */}
          <button
            onClick={skipNext}
            onMouseEnter={() => setHoverBtn('next')}
            onMouseLeave={() => setHoverBtn(null)}
            style={iconBtn('next')}
          >
            <SkipForward size={11} fill="currentColor" />
          </button>

          {/* 스페이서 */}
          <div style={{ flex: 1 }} />

          {/* 볼륨 슬라이더 (컴팩트) */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0 && isMuted) setIsMuted(false);
            }}
            style={{
              width: 48,
              height: 3,
              accentColor: SK.accent,
              cursor: 'pointer',
              opacity: 0.7,
            }}
          />

          {/* Mute */}
          <button
            onClick={toggleMute}
            onMouseEnter={() => setHoverBtn('mute')}
            onMouseLeave={() => setHoverBtn(null)}
            style={iconBtn('mute', isMuted)}
          >
            {isMuted
              ? <VolumeX size={11} />
              : <Volume2 size={11} />
            }
          </button>
        </div>

        {/* 좌하단 삼각 데코 (좌하단 버튼과 동일) */}
        <div style={{
          position: 'absolute',
          bottom: -1,
          left: -1,
          width: 0,
          height: 0,
          borderLeft: '10px solid #EF4444',
          borderTop: '10px solid transparent',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}
