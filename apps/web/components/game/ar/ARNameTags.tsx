'use client';

/**
 * ARNameTags — 팩션(국가) 이름태그 컴포넌트 (v18 Phase 4)
 *
 * 각 플레이어 머리 위에 팩션(국가) 이름과 레벨을 표시.
 * 같은 팩션 = 파란색, 다른 팩션 = 빨간색.
 */

import { useMemo, useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ARPlayerNet } from '@/lib/3d/ar-types';
import type { ARInterpolationState } from '@/lib/3d/ar-interpolation';
import { getInterpolatedPos } from '@/lib/3d/ar-interpolation';

// ── Props ────────────────────────────────────────────────

interface ARNameTagsProps {
  /** 모든 플레이어 목록 (서버 상태) */
  players: ARPlayerNet[];

  /** 현재 플레이어 ID */
  myId: string;

  /** 현재 플레이어의 팩션 ID */
  myFactionId: string;

  /** 보간 상태 ref */
  interpRef: React.RefObject<ARInterpolationState | null>;

  /** 이름태그 높이 오프셋 (Y축) */
  heightOffset?: number;
}

// ── 색상 상수 ────────────────────────────────────────────

const ALLY_COLOR = '#4488FF';      // 같은 팩션 = 파란색
const ENEMY_COLOR = '#FF4444';     // 다른 팩션 = 빨간색
const MY_COLOR = '#44FF44';        // 나 = 초록색
const DEAD_COLOR = '#888888';      // 사망 = 회색

// ── 컴포넌트 ────────────────────────────────────────────

function ARNameTagsInner({
  players,
  myId,
  myFactionId,
  interpRef,
  heightOffset = 2.5,
}: ARNameTagsProps) {
  return (
    <group>
      {players.map((player) => (
        <NameTag
          key={player.id}
          player={player}
          isMe={player.id === myId}
          isAlly={player.factionId === myFactionId && player.factionId !== ''}
          interpRef={interpRef}
          heightOffset={heightOffset}
        />
      ))}
    </group>
  );
}

const ARNameTags = memo(ARNameTagsInner);
export default ARNameTags;

// ── 단일 이름태그 ────────────────────────────────────────

interface NameTagProps {
  player: ARPlayerNet;
  isMe: boolean;
  isAlly: boolean;
  interpRef: React.RefObject<ARInterpolationState | null>;
  heightOffset: number;
}

function NameTag({ player, isMe, isAlly, interpRef, heightOffset }: NameTagProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 색상 결정
  const color = useMemo(() => {
    if (!player.alive) return DEAD_COLOR;
    if (isMe) return MY_COLOR;
    if (isAlly) return ALLY_COLOR;
    return ENEMY_COLOR;
  }, [player.alive, isMe, isAlly]);

  // HP 비율
  const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0;

  // 매 프레임 위치 갱신 (보간 적용)
  useFrame(() => {
    if (!groupRef.current) return;

    const interp = interpRef.current;
    if (interp) {
      const pos = getInterpolatedPos(interp, player.id);
      if (pos) {
        groupRef.current.position.set(pos.x, heightOffset, pos.z);
        return;
      }
    }

    // 보간 없으면 서버 위치 직접 사용
    groupRef.current.position.set(player.pos.x, heightOffset, player.pos.z);
  });

  // 사망 시 숨기기
  if (!player.alive) return null;

  // 나 자신의 태그는 숨기기 (HUD에 표시)
  if (isMe) return null;

  return (
    <group ref={groupRef}>
      <Html
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {/* 이름 + 레벨 */}
          <div
            style={{
              color,
              fontSize: '11px',
              fontWeight: 'bold',
              fontFamily: '"Rajdhani", sans-serif',
              textShadow: '0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {player.name}
            <span
              style={{
                fontSize: '9px',
                opacity: 0.8,
                marginLeft: '4px',
              }}
            >
              Lv.{player.level}
            </span>
          </div>

          {/* 팩션 이름 */}
          {player.factionId && (
            <div
              style={{
                color,
                fontSize: '8px',
                opacity: 0.7,
                fontFamily: '"Rajdhani", sans-serif',
                textShadow: '0 0 3px rgba(0,0,0,0.6)',
                lineHeight: 1,
              }}
            >
              [{player.factionId}]
            </div>
          )}

          {/* HP 바 */}
          <div
            style={{
              width: '40px',
              height: '3px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${hpRatio * 100}%`,
                height: '100%',
                backgroundColor: hpRatio > 0.5 ? '#44FF44' : hpRatio > 0.25 ? '#FFAA00' : '#FF4444',
                transition: 'width 0.1s ease-out',
              }}
            />
          </div>
        </div>
      </Html>
    </group>
  );
}
