'use client';

/**
 * RoomList — 모던 룸 리스트
 * 클린 행 + 상태 뱃지 + 호버 하이라이트
 */

import { useState } from 'react';
import type { RoomInfo, RoomStatus } from '@agent-survivor/shared';
import { SK, SKFont, bodyFont, handDrawnRadius, statusColors } from '@/lib/sketch-ui';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {rooms.map((room, idx) => (
        <RoomCard key={room.id} room={room} index={idx} onJoin={onJoin} />
      ))}
    </div>
  );
}

function RoomCard({ room, index, onJoin }: { room: RoomInfo; index: number; onJoin: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const status = statusColors[room.state as keyof typeof statusColors] || statusColors.waiting;
  const joinable = ['waiting', 'countdown', 'playing'].includes(room.state) && room.playerCount < room.maxPlayers;

  return (
    <button
      onClick={() => joinable && onJoin(room.id)}
      disabled={!joinable}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        backgroundColor: hovered && joinable ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
        borderRadius: '6px',
        border: `1px solid ${hovered && joinable ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.04)'}`,
        cursor: joinable ? 'pointer' : 'default',
        opacity: joinable ? 1 : 0.35,
        width: '100%',
        textAlign: 'left',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Arena 이름 */}
      <span style={{
        fontFamily: bodyFont, fontSize: '14px', fontWeight: 800,
        color: SK.textPrimary, minWidth: '95px',
        letterSpacing: '1px',
      }}>
        ZONE {index + 1}
      </span>

      {/* 상태 뱃지 */}
      <span style={{
        fontFamily: bodyFont, fontSize: SKFont.xs, fontWeight: 700,
        color: status.color,
        backgroundColor: status.bg,
        padding: '2px 8px',
        borderRadius: '4px',
        border: `1px solid ${status.color}25`,
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        {status.text}
      </span>

      {/* 플레이어 수 */}
      <span style={{
        fontFamily: bodyFont, fontSize: SKFont.sm, fontWeight: 600,
        color: SK.textSecondary, marginLeft: 'auto',
      }}>
        {room.playerCount}/{room.maxPlayers}
      </span>

      {/* 시간 */}
      {room.state !== 'waiting' && (
        <span style={{
          fontFamily: bodyFont, fontSize: SKFont.xs, fontWeight: 500,
          color: SK.textMuted, minWidth: '40px', textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(room.timeRemaining)}
        </span>
      )}

      {/* 우승자 */}
      {room.winner && (room.state === 'ending' || room.state === 'cooldown') && (
        <span style={{
          fontFamily: bodyFont, fontSize: '13px', fontWeight: 700,
          color: SK.gold, maxWidth: '80px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {room.winner.name}
        </span>
      )}
    </button>
  );
}
