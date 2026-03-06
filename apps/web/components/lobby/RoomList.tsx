'use client';

/**
 * RoomList — MC 서버 리스트 스타일
 * 엠보스 보더 + 상태 브래킷 [LIVE] + 플레이어 수
 */

import { useState } from 'react';
import type { RoomInfo, RoomStatus } from '@snake-arena/shared';
import { MC, MCFont, mcBorder, pixelFont } from '@/lib/minecraft-ui';

const STATUS_CONFIG: Record<RoomStatus, { text: string; color: string }> = {
  waiting: { text: 'WAITING', color: MC.textGray },
  countdown: { text: 'STARTING', color: MC.textYellow },
  playing: { text: 'LIVE', color: MC.textGreen },
  ending: { text: 'ENDING', color: MC.textRed },
  cooldown: { text: 'NEXT', color: MC.textSecondary },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
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

  return (
    <button
      onClick={() => joinable && onJoin(room.id)}
      disabled={!joinable}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        backgroundColor: hovered && joinable ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.5)',
        boxShadow: mcBorder('#484848', '#1A1A1A', 1),
        border: 'none',
        cursor: joinable ? 'pointer' : 'default',
        opacity: joinable ? 1 : 0.4,
        width: '100%',
        textAlign: 'left',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Arena 이름 */}
      <span style={{
        fontFamily: pixelFont, fontSize: MCFont.body,
        color: MC.textSecondary, minWidth: '85px',
      }}>
        Arena {index + 1}
      </span>

      {/* 상태 [LIVE] */}
      <span style={{
        fontFamily: pixelFont, fontSize: MCFont.sm, color: status.color,
      }}>
        [{status.text}]
      </span>

      {/* 플레이어 수 */}
      <span style={{
        fontFamily: pixelFont, fontSize: MCFont.sm,
        color: MC.textSecondary, marginLeft: 'auto',
      }}>
        {room.playerCount}/{room.maxPlayers}
      </span>

      {/* 시간 */}
      {room.state !== 'waiting' && (
        <span style={{
          fontFamily: pixelFont, fontSize: MCFont.xs,
          color: MC.textGray, minWidth: '44px', textAlign: 'right',
        }}>
          {formatTime(room.timeRemaining)}
        </span>
      )}

      {/* 우승자 */}
      {room.winner && (room.state === 'ending' || room.state === 'cooldown') && (
        <span style={{
          fontFamily: pixelFont, fontSize: MCFont.xs,
          color: MC.textGold, maxWidth: '70px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {room.winner.name}
        </span>
      )}
    </button>
  );
}
