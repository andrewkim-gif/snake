'use client';

/**
 * DamageNumbers.tsx — Object Pool 기반 3D 데미지 넘버 (S36)
 *
 * 1. Object pool 기반 DOM 요소 재사용 (최대 40개)
 * 2. CSS animation: float-up + fade-out + scale
 * 3. 색상: white(일반), red(적 공격), green(힐), gold(크리티컬)
 * 4. drei `<Html>` 기반 world-to-screen 앵커링
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, height, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DamageNumber, Player } from '@/lib/matrix/types';

// ============================================
// Constants
// ============================================

/** 최대 동시 표시 데미지 넘버 */
const MAX_DAMAGE_NUMBERS = 40;

/** 데미지 넘버 표시 시간 (초) */
const DAMAGE_NUMBER_DURATION = 0.8;

/** 떠오르는 속도 (3D Y축, 단위/초) */
const FLOAT_SPEED = 8.0;

/** 초기 높이 오프셋 (머리 위) */
const INITIAL_HEIGHT = 3.5;

/** 데미지 타입별 색상 (Phase 5: 궁극기 + 크리티컬 강화) */
const DAMAGE_COLORS = {
  normal: '#ffffff',
  enemy: '#ff4444',
  heal: '#44ff44',
  critical: '#ffd700',
  ultimate: '#FFD700',
} as const;

type DamageType = keyof typeof DAMAGE_COLORS;

// ============================================
// CSS 스타일 (인라인 — 글로벌 CSS 의존 제거)
// ============================================

const baseStyle: React.CSSProperties = {
  pointerEvents: 'none',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  fontFamily: '"Rajdhani", sans-serif',
  fontWeight: 'bold',
  textShadow: '0 0 4px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6)',
  lineHeight: 1,
  textAlign: 'center',
};

// ============================================
// Pool Item 상태
// ============================================

interface DamageNumberSlot {
  /** 활성 여부 */
  active: boolean;
  /** 2D 월드 좌표 X */
  worldX: number;
  /** 2D 월드 좌표 Y */
  worldY: number;
  /** 현재 3D 높이 */
  height: number;
  /** 표시 텍스트 */
  text: string;
  /** 색상 */
  color: string;
  /** 폰트 크기 (px) */
  fontSize: number;
  /** 남은 시간 (초) */
  remaining: number;
  /** 전체 지속 시간 (초) */
  duration: number;
  /** 크리티컬 여부 (확대 효과) */
  isCritical: boolean;
}

// ============================================
// Props
// ============================================

export interface DamageNumbersProps {
  /** 데미지 넘버 소스 ref (외부 시스템에서 push) */
  damageNumbersRef?: React.MutableRefObject<DamageNumber[]>;
  /** 플레이어 좌표 ref (거리 컬링용) */
  playerRef?: React.MutableRefObject<Player>;
}

/**
 * DamageNumbers — Object Pool 기반 3D 데미지 넘버
 *
 * MAX_DAMAGE_NUMBERS(40)개의 슬롯을 pre-allocate하고 재사용.
 * 비활성 슬롯은 display:none으로 DOM에서 숨김.
 *
 * 외부에서 damageNumbersRef에 DamageNumber를 push하면
 * useFrame에서 자동으로 소비하여 표시.
 */
export function DamageNumbers({ damageNumbersRef, playerRef }: DamageNumbersProps) {
  // Pool 슬롯 배열
  const slotsRef = useRef<DamageNumberSlot[]>(
    Array.from({ length: MAX_DAMAGE_NUMBERS }, () => ({
      active: false,
      worldX: 0,
      worldY: 0,
      height: INITIAL_HEIGHT,
      text: '',
      color: DAMAGE_COLORS.normal,
      fontSize: 14,
      remaining: 0,
      duration: DAMAGE_NUMBER_DURATION,
      isCritical: false,
    }))
  );

  // DOM 요소 refs (직접 조작으로 React re-render 방지)
  const domRefs = useRef<(HTMLDivElement | null)[]>(
    new Array(MAX_DAMAGE_NUMBERS).fill(null)
  );

  // 3D 위치 refs (Html position 업데이트용)
  const positionRefs = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_DAMAGE_NUMBERS }, () => new THREE.Vector3(0, -100, 0))
  );

  /**
   * 다음 빈 슬롯 인덱스 반환 (없으면 가장 오래된 것 재사용)
   */
  const getNextSlot = useCallback((): number => {
    const slots = slotsRef.current;

    // 1. 비활성 슬롯 찾기
    for (let i = 0; i < MAX_DAMAGE_NUMBERS; i++) {
      if (!slots[i].active) return i;
    }

    // 2. 모두 활성이면 가장 오래된(remaining 가장 적은) 것 재사용
    let oldestIdx = 0;
    let minRemaining = Infinity;
    for (let i = 0; i < MAX_DAMAGE_NUMBERS; i++) {
      if (slots[i].remaining < minRemaining) {
        minRemaining = slots[i].remaining;
        oldestIdx = i;
      }
    }
    return oldestIdx;
  }, []);

  /**
   * 데미지 타입 판정 (Phase 5: 궁극기 999 감지)
   */
  const getDamageType = useCallback((dn: DamageNumber): DamageType => {
    // Phase 5: 궁극기 데미지 (999) — 특별 표시
    if (dn.value === 999 && dn.color === '#FFD700') return 'ultimate';
    if (dn.isCritical) return 'critical';
    if (dn.color === '#44ff44' || dn.color === 'green' || dn.color?.includes('green')) return 'heal';
    if (dn.color === '#ff4444' || dn.color === 'red' || dn.color?.includes('red')) return 'enemy';
    return 'normal';
  }, []);

  // useFrame: 소스에서 새 데미지 소비 + 기존 슬롯 업데이트
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const slots = slotsRef.current;
    const positions = positionRefs.current;

    // 1. 새 데미지 넘버 소비
    if (damageNumbersRef?.current && damageNumbersRef.current.length > 0) {
      // 배열에서 꺼내서 슬롯에 할당
      const newNumbers = damageNumbersRef.current.splice(0, 10); // 프레임당 최대 10개 처리

      for (const dn of newNumbers) {
        const idx = getNextSlot();
        const slot = slots[idx];
        const type = getDamageType(dn);

        slot.active = true;
        slot.worldX = dn.position.x;
        slot.worldY = dn.position.y;
        slot.height = INITIAL_HEIGHT;
        // Phase 5: 궁극기 텍스트 강화
        if (type === 'ultimate') {
          slot.text = '999';
          slot.fontSize = 24;
          slot.color = DAMAGE_COLORS.ultimate;
        } else if (type === 'heal') {
          slot.text = `+${Math.abs(dn.value)}`;
          slot.fontSize = 14;
          slot.color = DAMAGE_COLORS.heal;
        } else if (type === 'critical') {
          // Phase 5: 크리티컬 강화 — 더 크게, "CRIT!" 접두사
          slot.text = dn.value >= 100 ? `CRIT! ${dn.value}` : String(dn.value);
          slot.fontSize = dn.value >= 100 ? 22 : 20;
          slot.color = DAMAGE_COLORS.critical;
        } else {
          slot.text = String(Math.abs(dn.value));
          slot.fontSize = 14;
          slot.color = DAMAGE_COLORS[type];
        }
        slot.remaining = type === 'ultimate' ? 1.5 : DAMAGE_NUMBER_DURATION;
        slot.duration = type === 'ultimate' ? 1.5 : DAMAGE_NUMBER_DURATION;
        slot.isCritical = dn.isCritical ?? type === 'ultimate';
      }
    }

    // 2. 기존 슬롯 업데이트
    for (let i = 0; i < MAX_DAMAGE_NUMBERS; i++) {
      const slot = slots[i];
      const dom = domRefs.current[i];

      if (!slot.active) {
        if (dom) dom.style.display = 'none';
        // 비활성 슬롯은 화면 밖으로
        positions[i].set(0, -100, 0);
        continue;
      }

      // 시간 감소
      slot.remaining -= dt;
      if (slot.remaining <= 0) {
        slot.active = false;
        if (dom) dom.style.display = 'none';
        positions[i].set(0, -100, 0);
        continue;
      }

      // 떠오르는 효과
      slot.height += FLOAT_SPEED * dt;

      // 3D 위치 업데이트 (2D → 3D 좌표 매핑)
      positions[i].set(slot.worldX, slot.height, -slot.worldY);

      // DOM 직접 업데이트 (React re-render 방지)
      if (dom) {
        const progress = 1 - slot.remaining / slot.duration;
        const opacity = 1 - progress;
        const scale = slot.isCritical
          ? 1.5 - progress * 0.9 // 크리티컬: 크게 시작 → 줄어듦
          : 1.0 - progress * 0.4;
        const translateY = -progress * 30; // CSS 추가 이동

        dom.style.display = 'block';
        dom.style.opacity = String(Math.max(0, opacity));
        dom.style.transform = `translateY(${translateY}px) scale(${Math.max(0.3, scale)})`;
        dom.style.color = slot.color;
        dom.style.fontSize = `${slot.fontSize}px`;
        dom.textContent = slot.text;
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_DAMAGE_NUMBERS }, (_, i) => (
        <Html
          key={`dmg-${i}`}
          position={positionRefs.current[i]}
          center
          zIndexRange={[0, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            ref={(el) => {
              domRefs.current[i] = el;
            }}
            style={{
              ...baseStyle,
              display: 'none',
              transition: 'none',
            }}
          />
        </Html>
      ))}
    </>
  );
}

export default DamageNumbers;
