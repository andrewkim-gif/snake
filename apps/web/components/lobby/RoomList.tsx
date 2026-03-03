'use client';

import type { RoomInfo, RoomStatus } from '@snake-arena/shared';

const P = {
  paper: '#F5F0E8',
  pencilDark: '#3A3028',
  pencilMedium: '#6B5E52',
  pencilLight: '#A89888',
  crayonOrange: '#D4914A',
  crayonRed: '#C75B5B',
  crayonGreen: '#7BA868',
  crayonBlue: '#5B8DAD',
  crayonPurple: '#8B72A8',
} as const;

const STATUS_LABELS: Record<RoomStatus, { text: string; color: string }> = {
  waiting: { text: 'WAIT', color: P.pencilLight },
  countdown: { text: 'START', color: P.crayonOrange },
  playing: { text: 'LIVE', color: P.crayonGreen },
  ending: { text: 'END', color: P.crayonRed },
  cooldown: { text: 'NEXT', color: P.crayonBlue },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface RoomListProps {
  rooms: RoomInfo[];
  onJoinRoom: (roomId: string) => void;
}

export function RoomList({ rooms, onJoinRoom }: RoomListProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '0.5rem',
      width: '100%',
    }}>
      {rooms.map((room, idx) => {
        const status = STATUS_LABELS[room.state];
        const joinable = ['waiting', 'countdown', 'playing'].includes(room.state) &&
          room.playerCount < room.maxPlayers;

        return (
          <button
            key={room.id}
            onClick={() => joinable && onJoinRoom(room.id)}
            disabled={!joinable}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.3rem', padding: '0.6rem 0.4rem',
              backgroundColor: joinable ? P.paper : 'rgba(245,240,232,0.6)',
              border: `1.5px solid ${joinable ? P.pencilMedium : P.pencilLight}`,
              borderRadius: '4px',
              cursor: joinable ? 'pointer' : 'default',
              fontFamily: '"Patrick Hand", "Inter", sans-serif',
              opacity: joinable ? 1 : 0.6,
              transition: 'transform 100ms',
            }}
            onMouseDown={(e) => joinable && ((e.target as HTMLElement).style.transform = 'scale(0.97)')}
            onMouseUp={(e) => ((e.target as HTMLElement).style.transform = 'scale(1)')}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.transform = 'scale(1)')}
          >
            {/* Room number */}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: P.pencilDark }}>
              Room {idx + 1}
            </span>

            {/* Status badge */}
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              color: P.paper, backgroundColor: status.color,
              padding: '1px 8px', borderRadius: '3px',
              letterSpacing: '0.05em',
            }}>
              {status.text}
            </span>

            {/* Player count */}
            <span style={{ fontSize: '0.75rem', color: P.pencilMedium }}>
              {room.playerCount} player{room.playerCount !== 1 ? 's' : ''}
            </span>

            {/* Time */}
            {room.state !== 'waiting' && (
              <span style={{ fontSize: '0.7rem', color: P.pencilLight }}>
                {formatTime(room.timeRemaining)}
              </span>
            )}

            {/* Winner */}
            {room.winner && (room.state === 'ending' || room.state === 'cooldown') && (
              <span style={{
                fontSize: '0.65rem', color: P.crayonOrange, fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {room.winner.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
