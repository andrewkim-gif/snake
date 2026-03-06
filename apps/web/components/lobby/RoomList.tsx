'use client';

import type { RoomInfo, RoomStatus } from '@snake-arena/shared';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

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
  onJoinRoom: (roomId: string) => void;
}

export function RoomList({ rooms, onJoinRoom }: RoomListProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px',
      width: '100%',
    }}>
      {/* 헤더 */}
      <div style={{
        fontFamily: pixelFont,
        fontSize: '0.55rem',
        color: MC.textSecondary,
        padding: '0.3rem 0.5rem',
        letterSpacing: '0.05em',
        marginBottom: '2px',
      }}>
        ARENAS
      </div>

      {rooms.map((room, idx) => {
        const status = STATUS_CONFIG[room.state];
        const joinable = ['waiting', 'countdown', 'playing'].includes(room.state) &&
          room.playerCount < room.maxPlayers;

        return (
          <button
            key={room.id}
            onClick={() => joinable && onJoinRoom(room.id)}
            disabled={!joinable}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.5rem 0.6rem',
              backgroundColor: joinable ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.2)',
              border: 'none',
              borderBottom: `1px solid ${MC.panelBorderDark}`,
              cursor: joinable ? 'pointer' : 'default',
              opacity: joinable ? 1 : 0.5,
              transition: 'background-color 80ms',
              width: '100%',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { if (joinable) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = joinable ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.2)'; }}
          >
            {/* Room name */}
            <span style={{
              fontFamily: bodyFont,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: MC.textPrimary,
              minWidth: '60px',
            }}>
              Arena {idx + 1}
            </span>

            {/* Status */}
            <span style={{
              fontFamily: pixelFont,
              fontSize: '0.4rem',
              color: status.color,
              minWidth: '60px',
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

            {/* Winner name (if ending/cooldown) */}
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
      })}
    </div>
  );
}
