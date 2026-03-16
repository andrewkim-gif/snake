'use client';

/**
 * EntityUI.tsx — HP바 + 네임태그 3D 앵커링 (S37)
 *
 * 1. HP바: 적/에이전트 머리 위 (green→yellow→red)
 * 2. Nametag: 이름 + 레벨 배지
 * 3. LOD 연동: HIGH=full, MID=bar only, LOW=dot
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, height, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Player, Enemy, Agent } from '@/lib/matrix/types';
import type { QualityTier } from '@/hooks/useAdaptiveQuality';

// ============================================
// Constants
// ============================================

/** 동시 HP바 최대 수 */
const MAX_VISIBLE_HP = 30;

/** 동시 네임태그 최대 수 */
const MAX_VISIBLE_NAMES = 15;

/** 엔티티 머리 위 오프셋 (3D Y축) */
const HEAD_OFFSET = 3.5;

/** LOD 거리 임계값 */
const LOD_HIGH_DIST = 800;
const LOD_MID_DIST = 1400;
const LOD_CULL_DIST = 2200;

// ============================================
// HP 색상 보간
// ============================================

/**
 * HP 비율에 따른 색상 (green → yellow → red)
 */
function getHPColor(ratio: number): string {
  if (ratio > 0.6) {
    // green → yellow (1.0→0.6)
    const t = (ratio - 0.6) / 0.4;
    const r = Math.round(255 * (1 - t));
    return `rgb(${r}, 255, 0)`;
  } else if (ratio > 0.3) {
    // yellow → orange (0.6→0.3)
    const t = (ratio - 0.3) / 0.3;
    const g = Math.round(255 * t);
    return `rgb(255, ${g}, 0)`;
  } else {
    // orange → red (0.3→0.0)
    return '#ff3333';
  }
}

// ============================================
// UI Slot 상태
// ============================================

interface EntityUISlot {
  /** 활성 여부 */
  active: boolean;
  /** 엔티티 ID */
  entityId: string;
  /** 2D 월드 좌표 */
  worldX: number;
  worldY: number;
  /** HP 비율 (0-1) */
  hpRatio: number;
  /** 이름 */
  name: string;
  /** 레벨 */
  level: number;
  /** LOD 레벨 */
  lod: 'HIGH' | 'MID' | 'LOW';
  /** 엔티티 타입 */
  type: 'enemy' | 'agent';
}

// ============================================
// Props
// ============================================

export interface EntityUIProps {
  /** 플레이어 ref (거리 계산용) */
  playerRef: React.MutableRefObject<Player>;
  /** 적 목록 ref */
  enemiesRef?: React.MutableRefObject<Enemy[]>;
  /** 에이전트 목록 ref */
  agentsRef?: React.MutableRefObject<Agent[]>;
  /** 품질 티어 */
  qualityTier?: QualityTier;
}

/**
 * EntityUI — HP바 + 네임태그 3D 앵커링
 *
 * 매 프레임 가까운 엔티티를 선별하여 HP바/네임태그 표시.
 * LOD에 따라 상세도 자동 조절:
 * - HIGH: full HP bar + nametag + level badge
 * - MID: mini HP bar only
 * - LOW: color dot only
 */
export function EntityUI({
  playerRef,
  enemiesRef,
  agentsRef,
  qualityTier = 'HIGH',
}: EntityUIProps) {
  // UI 슬롯 배열 (최대 30개)
  const slotsRef = useRef<EntityUISlot[]>(
    Array.from({ length: MAX_VISIBLE_HP }, () => ({
      active: false,
      entityId: '',
      worldX: 0,
      worldY: 0,
      hpRatio: 1,
      name: '',
      level: 1,
      lod: 'HIGH' as const,
      type: 'enemy' as const,
    }))
  );

  // DOM refs (직접 조작)
  const domRefs = useRef<(HTMLDivElement | null)[]>(
    new Array(MAX_VISIBLE_HP).fill(null)
  );

  // 3D 위치 refs
  const positionRefs = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_VISIBLE_HP }, () => new THREE.Vector3(0, -100, 0))
  );

  /**
   * LOD 판정
   */
  const getLOD = useCallback(
    (dist: number, totalCount: number): 'HIGH' | 'MID' | 'LOW' | 'CULL' => {
      const factor = totalCount > 150 ? Math.max(0.65, 1 - (totalCount - 150) / 500) : 1;
      if (dist > LOD_CULL_DIST * factor) return 'CULL';
      if (dist > LOD_MID_DIST * factor) return 'LOW';
      if (dist > LOD_HIGH_DIST * factor) return 'MID';
      return 'HIGH';
    },
    []
  );

  useFrame(() => {
    const player = playerRef.current;
    const playerX = player.position.x;
    const playerY = player.position.y;
    const enemies = enemiesRef?.current ?? [];
    const agents = agentsRef?.current ?? [];
    const slots = slotsRef.current;
    const positions = positionRefs.current;
    const totalCount = enemies.length + agents.length;

    // 거리순 정렬용 배열
    interface EntityEntry {
      id: string;
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      name: string;
      level: number;
      dist: number;
      type: 'enemy' | 'agent';
      lod: 'HIGH' | 'MID' | 'LOW';
    }

    const visible: EntityEntry[] = [];

    // 적 수집
    for (const enemy of enemies) {
      const dx = enemy.position.x - playerX;
      const dy = enemy.position.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lod = getLOD(dist, totalCount);
      if (lod === 'CULL') continue;

      visible.push({
        id: enemy.id,
        x: enemy.position.x,
        y: enemy.position.y,
        hp: enemy.health,
        maxHp: enemy.maxHealth,
        name: enemy.name ?? enemy.enemyType ?? '',
        level: 1,
        dist,
        type: 'enemy',
        lod,
      });
    }

    // 에이전트 수집
    for (const agent of agents) {
      const dx = agent.position.x - playerX;
      const dy = agent.position.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lod = getLOD(dist, totalCount);
      if (lod === 'CULL') continue;

      visible.push({
        id: agent.id,
        x: agent.position.x,
        y: agent.position.y,
        hp: agent.health,
        maxHp: agent.maxHealth,
        name: agent.agentId ?? '',
        level: agent.level ?? 1,
        dist,
        type: 'agent',
        lod,
      });
    }

    // 거리순 정렬 → 가까운 것 우선
    visible.sort((a, b) => a.dist - b.dist);

    // 슬롯에 할당
    const limit = Math.min(visible.length, MAX_VISIBLE_HP);
    for (let i = 0; i < MAX_VISIBLE_HP; i++) {
      const slot = slots[i];
      const dom = domRefs.current[i];

      if (i >= limit) {
        // 빈 슬롯
        slot.active = false;
        if (dom) dom.style.display = 'none';
        positions[i].set(0, -100, 0);
        continue;
      }

      const entry = visible[i];
      slot.active = true;
      slot.entityId = entry.id;
      slot.worldX = entry.x;
      slot.worldY = entry.y;
      slot.hpRatio = Math.max(0, Math.min(1, entry.hp / entry.maxHp));
      slot.name = entry.name;
      slot.level = entry.level;
      slot.lod = entry.lod;
      slot.type = entry.type;

      // 3D 위치 업데이트
      positions[i].set(entry.x, HEAD_OFFSET, -entry.y);

      // DOM 직접 업데이트
      if (dom) {
        dom.style.display = 'block';

        const hpColor = getHPColor(slot.hpRatio);

        if (slot.lod === 'HIGH') {
          // Full: HP bar + nametag + level badge
          const nameVisible = i < MAX_VISIBLE_NAMES;
          dom.innerHTML = `
            ${
              nameVisible
                ? `<div style="
                    font-size:10px;
                    color:#e8e0d4;
                    text-align:center;
                    margin-bottom:2px;
                    font-family:'Rajdhani',sans-serif;
                    text-shadow:0 0 3px rgba(0,0,0,0.8);
                    white-space:nowrap;
                  ">
                    ${slot.name}
                    <span style="
                      background:${slot.type === 'agent' ? '#cc9933' : '#555'};
                      color:#fff;
                      font-size:8px;
                      padding:0 3px;
                      border-radius:2px;
                      margin-left:2px;
                    ">Lv${slot.level}</span>
                  </div>`
                : ''
            }
            <div style="
              width:40px;
              height:4px;
              background:rgba(0,0,0,0.6);
              border-radius:2px;
              overflow:hidden;
              border:1px solid rgba(255,255,255,0.15);
            ">
              <div style="
                width:${slot.hpRatio * 100}%;
                height:100%;
                background:${hpColor};
                border-radius:1px;
                transition:width 0.1s ease-out;
              "></div>
            </div>
          `;
        } else if (slot.lod === 'MID') {
          // Mini: HP bar only
          dom.innerHTML = `
            <div style="
              width:20px;
              height:3px;
              background:rgba(0,0,0,0.5);
              border-radius:1px;
              overflow:hidden;
            ">
              <div style="
                width:${slot.hpRatio * 100}%;
                height:100%;
                background:${hpColor};
              "></div>
            </div>
          `;
        } else {
          // LOW: Color dot only
          const dotColor = slot.hpRatio > 0.5 ? '#44ff44' : '#ff3333';
          dom.innerHTML = `
            <div style="
              width:4px;
              height:4px;
              border-radius:50%;
              background:${dotColor};
            "></div>
          `;
        }
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_VISIBLE_HP }, (_, i) => (
        <Html
          key={`hp-${i}`}
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
              pointerEvents: 'none',
              userSelect: 'none',
              display: 'none',
            }}
          />
        </Html>
      ))}
    </>
  );
}

export default EntityUI;
