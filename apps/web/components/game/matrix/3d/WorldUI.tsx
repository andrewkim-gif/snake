'use client';

/**
 * WorldUI.tsx — drei Html 기반 world-to-screen 앵커링 시스템 (S35)
 *
 * 1. drei `<Html>` 컴포넌트 기반 world-to-screen 앵커링 시스템
 * 2. 엔티티 머리 위 고정점 계산 (position.y + height offset)
 * 3. 가시 범위 외 자동 숨김 (distance culling)
 * 4. Z-index 관리
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Player, Enemy, Agent, DamageNumber } from '@/lib/matrix/types';
import type { QualityTier } from '@/hooks/useAdaptiveQuality';

// ============================================
// Constants
// ============================================

/** UI 가시 최대 거리 (2D 좌표 기준, px) */
const MAX_VISIBLE_DISTANCE = 1400;

/** UI 가시 최소 거리 (이 안에서만 상세 표시) */
const DETAIL_VISIBLE_DISTANCE = 800;

/** 엔티티 머리 위 오프셋 (3D Y축) */
const HEAD_OFFSET_PLAYER = 4.0;
const HEAD_OFFSET_ENEMY = 3.0;
const HEAD_OFFSET_AGENT = 4.0;

// ============================================
// Types
// ============================================

/**
 * World UI 앵커 포인트
 */
export interface WorldAnchor {
  /** 고유 ID */
  id: string;
  /** 3D 월드 좌표 (이미 변환된) */
  position: THREE.Vector3;
  /** 2D 원본 좌표 (거리 계산용) */
  worldX: number;
  worldY: number;
  /** LOD 레벨 */
  lod: 'HIGH' | 'MID' | 'LOW' | 'CULL';
  /** 엔티티 타입 */
  type: 'player' | 'enemy' | 'agent';
}

/**
 * LOD 기반 거리 판정
 */
function calculateLOD(
  distance: number,
  totalCount: number
): 'HIGH' | 'MID' | 'LOW' | 'CULL' {
  // 적응형 threshold (엔티티 많을수록 축소)
  const factor = totalCount > 150 ? Math.max(0.65, 1 - (totalCount - 150) / 500) : 1;
  const highThreshold = DETAIL_VISIBLE_DISTANCE * factor;
  const midThreshold = MAX_VISIBLE_DISTANCE * factor;

  if (distance > midThreshold + 400) return 'CULL';
  if (distance > midThreshold) return 'LOW';
  if (distance > highThreshold) return 'MID';
  return 'HIGH';
}

// ============================================
// Props
// ============================================

export interface WorldUIProps {
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
  /** 적 목록 ref */
  enemiesRef?: React.MutableRefObject<Enemy[]>;
  /** 에이전트 목록 ref */
  agentsRef?: React.MutableRefObject<Agent[]>;
  /** 데미지 넘버 ref */
  damageNumbersRef?: React.MutableRefObject<DamageNumber[]>;
  /** 품질 티어 */
  qualityTier?: QualityTier;
  /** 자식 컴포넌트 (DamageNumbers, EntityUI 등) */
  children?: React.ReactNode;
}

/**
 * WorldUI — drei Html 기반 World-to-Screen UI 오케스트레이터
 *
 * R3F 씬 내에서 HTML 요소를 3D 위치에 앵커링합니다.
 * 하위 컴포넌트(DamageNumbers, EntityUI)에 앵커 데이터를 제공합니다.
 *
 * 주요 기능:
 * - 엔티티 머리 위 고정점 계산 (position.y + height offset)
 * - 거리 기반 LOD: HIGH/MID/LOW/CULL
 * - 가시 범위 외 자동 숨김
 * - Z-index 관리 (HUD overlay 위에 표시 방지)
 */
export function WorldUI({
  playerRef,
  enemiesRef,
  agentsRef,
  damageNumbersRef,
  qualityTier = 'HIGH',
  children,
}: WorldUIProps) {
  // 앵커 포인트 캐시 (매 프레임 업데이트)
  const anchorsRef = useRef<WorldAnchor[]>([]);

  useFrame(() => {
    const player = playerRef.current;
    const playerX = player.position.x;
    const playerY = player.position.y;

    const newAnchors: WorldAnchor[] = [];
    const enemies = enemiesRef?.current ?? [];
    const agents = agentsRef?.current ?? [];
    const totalCount = enemies.length + agents.length;

    // 적 앵커 포인트 계산
    for (const enemy of enemies) {
      const dx = enemy.position.x - playerX;
      const dy = enemy.position.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lod = calculateLOD(dist, totalCount);

      if (lod === 'CULL') continue;

      newAnchors.push({
        id: enemy.id,
        position: new THREE.Vector3(
          enemy.position.x,
          HEAD_OFFSET_ENEMY,
          -enemy.position.y
        ),
        worldX: enemy.position.x,
        worldY: enemy.position.y,
        lod,
        type: 'enemy',
      });
    }

    // 에이전트 앵커 포인트 계산
    for (const agent of agents) {
      const dx = agent.position.x - playerX;
      const dy = agent.position.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lod = calculateLOD(dist, totalCount);

      if (lod === 'CULL') continue;

      newAnchors.push({
        id: agent.id,
        position: new THREE.Vector3(
          agent.position.x,
          HEAD_OFFSET_AGENT,
          -agent.position.y
        ),
        worldX: agent.position.x,
        worldY: agent.position.y,
        lod,
        type: 'agent',
      });
    }

    anchorsRef.current = newAnchors;
  });

  return (
    <group>
      {children}
    </group>
  );
}

// ============================================
// WorldAnchoredHtml — 단일 앵커 포인트에 Html 배치
// ============================================

export interface WorldAnchoredHtmlProps {
  /** 3D 월드 좌표 */
  position: [number, number, number];
  /** 가시 여부 */
  visible?: boolean;
  /** Z-index 범위 (HUD 아래) */
  zIndexRange?: [number, number];
  /** 자식 HTML */
  children: React.ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 중심 정렬 여부 */
  center?: boolean;
}

/**
 * WorldAnchoredHtml — 3D 위치에 HTML 요소 앵커링
 *
 * drei `<Html>` 래퍼. Z-index, 가시성, 거리 기반 스케일링 자동 관리.
 */
export function WorldAnchoredHtml({
  position,
  visible = true,
  zIndexRange = [0, 0],
  children,
  className,
  center = true,
}: WorldAnchoredHtmlProps) {
  if (!visible) return null;

  return (
    <Html
      position={position}
      center={center}
      zIndexRange={zIndexRange}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      className={className}
    >
      {children}
    </Html>
  );
}

// ============================================
// distance2D 헬퍼
// ============================================

/**
 * 2D 거리 계산 (성능 최적화 — sqrt 사용)
 */
export function distance2D(
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export default WorldUI;
