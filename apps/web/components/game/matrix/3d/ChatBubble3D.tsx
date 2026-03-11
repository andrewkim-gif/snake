'use client';

/**
 * ChatBubble3D.tsx — 에이전트 채팅 말풍선 3D (S42)
 *
 * Phase 7: Multiplayer 3D
 * 1. drei Html 기반 speech bubble
 * 2. 에이전트 머리 위 앵커링
 * 3. Fade-in/out animation (CSS transition)
 * 4. 최대 3 bubbles 동시 표시
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { ChatMessage } from '@/lib/matrix/systems/agent-chat';

// ============================================
// Constants
// ============================================

/** 최대 동시 표시 버블 수 */
const MAX_VISIBLE_BUBBLES = 3;

/** 말풍선 Y 오프셋 (캐릭터 머리 위, 3D units) */
const BUBBLE_Y_OFFSET = 5.5;

/** 말풍선 최대 너비 (px) */
const BUBBLE_MAX_WIDTH = 180;

/** 거리 제한 (2D 좌표 기준, px) — 이 이상이면 표시 안 함 */
const MAX_VISIBLE_DISTANCE = 1200;

/** 페이드 인/아웃 시간 (ms) */
const FADE_IN_DURATION = 200;
const FADE_OUT_DURATION = 400;

// ============================================
// Types
// ============================================

export interface ChatBubble3DProps {
  /** 활성 채팅 메시지 배열 ref */
  chatMessagesRef: React.MutableRefObject<ChatMessage[]>;
  /** 로컬 플레이어 위치 ref (거리 계산용) */
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
}

// ============================================
// 말풍선 스타일
// ============================================

const bubbleStyle: React.CSSProperties = {
  maxWidth: BUBBLE_MAX_WIDTH,
  padding: '6px 10px',
  backgroundColor: 'rgba(17, 17, 17, 0.92)',
  border: '1px solid rgba(204, 153, 51, 0.4)',
  borderRadius: 8,
  color: '#E8E0D4',
  fontSize: 11,
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 500,
  lineHeight: 1.3,
  textAlign: 'center' as const,
  pointerEvents: 'none' as const,
  userSelect: 'none' as const,
  whiteSpace: 'normal' as const,
  wordBreak: 'break-word' as const,
  transition: `opacity ${FADE_IN_DURATION}ms ease-in, transform ${FADE_IN_DURATION}ms ease-out`,
  // 말풍선 꼬리 (CSS triangle) — 아래쪽
  position: 'relative' as const,
};

const tailStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -6,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: '6px solid rgba(17, 17, 17, 0.92)',
};

// ============================================
// ChatBubble3D 컴포넌트
// ============================================

/**
 * ChatBubble3D — 에이전트 채팅 말풍선 3D 렌더러
 *
 * 최대 3개의 채팅 버블을 3D 월드에 표시.
 * drei Html을 사용하여 에이전트 위치에 앵커링.
 */
export function ChatBubble3D({
  chatMessagesRef,
  playerRef,
}: ChatBubble3DProps) {
  // 버블 슬롯 (최대 3개)
  const slots = useMemo(() => {
    return Array.from({ length: MAX_VISIBLE_BUBBLES }, (_, i) => i);
  }, []);

  return (
    <group name="chat-bubbles-3d">
      {slots.map((slotIndex) => (
        <BubbleSlot
          key={slotIndex}
          slotIndex={slotIndex}
          chatMessagesRef={chatMessagesRef}
          playerRef={playerRef}
        />
      ))}
    </group>
  );
}

// ============================================
// 단일 말풍선 슬롯
// ============================================

interface BubbleSlotProps {
  slotIndex: number;
  chatMessagesRef: React.MutableRefObject<ChatMessage[]>;
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
}

function BubbleSlot({
  slotIndex,
  chatMessagesRef,
  playerRef,
}: BubbleSlotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bubbleDivRef = useRef<HTMLDivElement>(null);
  const prevMessageId = useRef<string>('');

  useFrame(() => {
    if (!groupRef.current) return;

    const messages = chatMessagesRef.current;

    // 슬롯에 해당하는 메시지 (최근 3개 중 slotIndex번째)
    // opacity > 0인 메시지만 선택
    const visibleMessages = messages.filter(m => m.opacity > 0);
    const msg = visibleMessages[slotIndex];

    if (!msg) {
      groupRef.current.visible = false;
      if (bubbleDivRef.current) {
        bubbleDivRef.current.style.opacity = '0';
        bubbleDivRef.current.style.transform = 'scale(0.8) translateY(5px)';
      }
      prevMessageId.current = '';
      return;
    }

    // 거리 체크
    const localPlayer = playerRef.current;
    const dx = msg.position.x - localPlayer.position.x;
    const dy = msg.position.y - localPlayer.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MAX_VISIBLE_DISTANCE) {
      groupRef.current.visible = false;
      return;
    }

    // 위치 설정 (2D→3D 좌표 매핑)
    groupRef.current.visible = true;
    groupRef.current.position.set(msg.position.x, BUBBLE_Y_OFFSET, -msg.position.y);

    // 말풍선 콘텐츠 업데이트
    if (bubbleDivRef.current) {
      // 새 메시지 감지 → 페이드 인
      const isNewMessage = prevMessageId.current !== msg.id;
      if (isNewMessage) {
        prevMessageId.current = msg.id;
        // 초기 상태 (숨김)
        bubbleDivRef.current.style.opacity = '0';
        bubbleDivRef.current.style.transform = 'scale(0.8) translateY(5px)';

        // 다음 프레임에서 페이드 인
        requestAnimationFrame(() => {
          if (bubbleDivRef.current) {
            bubbleDivRef.current.style.opacity = String(msg.opacity);
            bubbleDivRef.current.style.transform = 'scale(1) translateY(0)';
          }
        });
      } else {
        // 기존 메시지: opacity 업데이트 (페이드 아웃)
        bubbleDivRef.current.style.opacity = String(Math.max(0, msg.opacity));
      }

      // 메시지 텍스트 업데이트
      const agentName = msg.agentId.replace('agent_', '').toUpperCase();
      bubbleDivRef.current.innerHTML = `
        <div style="
          max-width:${BUBBLE_MAX_WIDTH}px;padding:6px 10px;
          background:rgba(17,17,17,0.92);
          border:1px solid rgba(204,153,51,0.4);
          border-radius:8px;color:#E8E0D4;
          font-size:11px;font-family:'Rajdhani',sans-serif;font-weight:500;
          line-height:1.3;text-align:center;white-space:normal;word-break:break-word;
          position:relative;
        ">
          <div style="
            font-size:8px;color:#CC9933;font-weight:700;
            margin-bottom:2px;letter-spacing:0.5px;
          ">${agentName}</div>
          <div>${msg.message}</div>
          <div style="
            position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
            width:0;height:0;
            border-left:5px solid transparent;
            border-right:5px solid transparent;
            border-top:6px solid rgba(17,17,17,0.92);
          "></div>
        </div>
      `;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <Html
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={bubbleDivRef}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0,
            transform: 'scale(0.8) translateY(5px)',
            transition: `opacity ${FADE_IN_DURATION}ms ease-in, transform ${FADE_IN_DURATION}ms ease-out`,
          }}
        />
      </Html>
    </group>
  );
}

export default ChatBubble3D;
