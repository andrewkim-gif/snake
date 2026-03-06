'use client';

/**
 * RoomList — 카드형 룸 리스트 + 상태 pill 뱃지 + 플레이어 바
 * 글래스모피즘 카드 스타일 + 모던 레이아웃
 */

import { useState } from 'react';
import type { RoomInfo, RoomStatus } from '@snake-arena/shared';
import { MC, MCModern, pixelFont, bodyFont } from '@/lib/minecraft-ui';

const STATUS_CONFIG: Record<RoomStatus, { text: string; color: string; bg: string }> = {
  waiting: { text: 'WAITING', color: MC.textGray, bg: MCModern.statusWaiting },
  countdown: { text: 'STARTING', color: MC.textYellow, bg: MCModern.statusStarting },
  playing: { text: 'LIVE', color: MC.textGreen, bg: MCModern.statusLive },
  ending: { text: 'ENDING', color: MC.textRed, bg: MCModern.statusEnding },
  cooldown: { text: 'NEXT', color: MC.textSecondary, bg: MCModern.statusWaiting },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface RoomListProps {
  rooms: RoomInfo[];
  onJoin: (roomId: string) => void;
}

export function RoomList({ rooms, onJoin }: RoomListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {rooms.map((room, idx) => (
        <RoomCard key={room.id} room={room} index={idx} onJoin={onJoin} />
      ))}
    </div>
  );
}

function RoomCard({ room, index, onJoin }: { room: RoomInfo; index: number; onJoin: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const status = STATUS_CONFIG[room.state];
  const joinable = ['waiting', 'countdown', 'playing'].includes(room.state) && room.playerCount < room.maxPlayers;
  const fillPct = Math.min(100, (room.playerCount / room.maxPlayers) * 100);

  return (
    <button
      onClick={() => joinable && onJoin(room.id)}
      disabled={!joinable}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.55rem 0.7rem',
        backgroundColor: hovered && joinable ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered && joinable ? MCModern.glassBorderHover : MCModern.glassBorder}`,
        borderRadius: MCModern.radiusSm,
        cursor: joinable ? 'pointer' : 'default',
        opacity: joinable ? 1 : 0.45,
        transition: MCModern.transitionFast,
        width: '100%',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 플레이어 바 (하단 진행률 바) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '2px',
        width: `${fillPct}%`,
        backgroundColor: status.color,
        opacity: 0.5,
        transition: 'width 500ms ease',
      }} />

      {/* Arena name */}
      <span style={{
        fontFamily: bodyFont,
        fontSize: '0.85rem',
        fontWeight: 600,
        color: MC.textPrimary,
        minWidth: '60px',
      }}>
        Arena {index + 1}
      </span>

      {/* Status pill 뱃지 */}
      <span style={{
        fontFamily: pixelFont,
        fontSize: '0.3rem',
        color: status.color,
        backgroundColor: status.bg,
        padding: '2px 6px',
        borderRadius: MCModern.radiusPill,
        letterSpacing: '0.04em',
        lineHeight: 1.4,
      }}>
        {status.text}
      </span>

      {/* Player count */}
      <span style={{
        fontFamily: bodyFont,
        fontSize: '0.75rem',
        color: MC.textSecondary,
        marginLeft: 'auto',
      }}>
        {room.playerCount}/{room.maxPlayers}
      </span>

      {/* Time */}
      {room.state !== 'waiting' && (
        <span style={{
          fontFamily: bodyFont,
          fontSize: '0.75rem',
          color: MC.textGray,
          minWidth: '35px',
          textAlign: 'right',
        }}>
          {formatTime(room.timeRemaining)}
        </span>
      )}

      {/* Winner */}
      {room.winner && (room.state === 'ending' || room.state === 'cooldown') && (
        <span style={{
          fontFamily: bodyFont,
          fontSize: '0.7rem',
          color: MC.textGold,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '80px',
        }}>
          {room.winner.name}
        </span>
      )}
    </button>
  );
}
