'use client';

/**
 * RemotePlayer3D.tsx — 원격 플레이어 3D 렌더링 (S40)
 *
 * Phase 7: Multiplayer 3D
 * - Voxel character (character-models.ts 재사용) + nation color
 * - LOD 3단계: HIGH(full model), MID(simplified), LOW(colored cube)
 * - 최대 35 remote players 렌더링
 * - PvP 모드 시 적/아군 구분 (blue=ally, red=enemy 아우라)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createBaseCharacterGeometry,
  disposeCharacter,
  type CharacterParts,
  type CharacterColors,
  CHARACTER_HEIGHT,
} from '@/lib/matrix/rendering3d/character-models';
import { Html } from '@react-three/drei';

// ============================================
// Constants
// ============================================

/** 최대 동시 렌더링 remote player 수 */
const MAX_RENDERED_PLAYERS = 35;

/** LOD 거리 임계값 (2D 좌표 기준, px) */
const LOD_HIGH_DISTANCE = 800;
const LOD_MID_DISTANCE = 1400;
const LOD_CULL_DISTANCE = 2200;

/** 적응형 LOD: 플레이어 수 임계값 */
const ADAPTIVE_LOD_THRESHOLD = 31;

/** 아군/적 아우라 색상 */
const ALLY_AURA_COLOR = new THREE.Color('#3B82F6');
const ENEMY_AURA_COLOR = new THREE.Color('#EF4444');

/** 아우라 반경 배율 */
const AURA_RADIUS = 2.5;
const AURA_PULSE_SPEED = 0.002;

/** LOW LOD 큐브 크기 */
const LOW_LOD_CUBE_SIZE = 1.2;

/** 네임태그 Y 오프셋 (캐릭터 머리 위, 3D units) */
const NAMETAG_Y_OFFSET = 4.5;

/** HP 바 CSS 스타일 */
const HP_BAR_WIDTH = 50;
const HP_BAR_HEIGHT = 4;

// ============================================
// 국적 색상 (2D constants 재사용)
// ============================================

const NATION_COLORS: Record<string, { primary: string; glow: string }> = {
  KOR: { primary: '#0047A0', glow: '#4B8BF5' },
  USA: { primary: '#B31942', glow: '#FF6B8A' },
  JPN: { primary: '#BC002D', glow: '#FF4D6A' },
  CHN: { primary: '#DE2910', glow: '#FF5533' },
  GBR: { primary: '#012169', glow: '#4169E1' },
  DEU: { primary: '#DD0000', glow: '#FF4444' },
  FRA: { primary: '#002395', glow: '#4466FF' },
  RUS: { primary: '#0039A6', glow: '#4488FF' },
  BRA: { primary: '#009739', glow: '#33CC66' },
  IND: { primary: '#FF9933', glow: '#FFBB66' },
  CAN: { primary: '#FF0000', glow: '#FF4444' },
  AUS: { primary: '#00008B', glow: '#4444FF' },
};

const DEFAULT_NATION_COLOR = { primary: '#6B7280', glow: '#9CA3AF' };

function getNationColor(nationCode: string) {
  return NATION_COLORS[nationCode] ?? DEFAULT_NATION_COLOR;
}

// ============================================
// Types
// ============================================

/** 보간된 원격 플레이어 데이터 */
export interface RemotePlayer3DData {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  nation: string;
  isAlly: boolean;
  angle?: number;
  weapons: string[];
  status: string[];
}

export interface RemotePlayer3DProps {
  /** 원격 플레이어 배열 ref */
  remotePlayersRef: React.MutableRefObject<RemotePlayer3DData[]>;
  /** 로컬 플레이어 위치 ref (거리 계산용) */
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
  /** PvP 활성 여부 */
  pvpEnabled?: boolean;
}

// ============================================
// 단일 원격 플레이어 컴포넌트
// ============================================

interface SingleRemotePlayerProps {
  playerId: string;
  remotePlayersRef: React.MutableRefObject<RemotePlayer3DData[]>;
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
  pvpEnabled: boolean;
  lodLevel: React.MutableRefObject<'HIGH' | 'MID' | 'LOW' | 'CULL'>;
}

function SingleRemotePlayer({
  playerId,
  remotePlayersRef,
  playerRef,
  pvpEnabled,
  lodLevel,
}: SingleRemotePlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const partsRef = useRef<CharacterParts | null>(null);
  const lowLodMeshRef = useRef<THREE.Mesh>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const htmlVisible = useRef(false);
  const nameRef = useRef('');
  const hpRef = useRef(1);
  const maxHpRef = useRef(1);
  const levelRef = useRef(1);
  const nationRef = useRef('');
  const isAllyRef = useRef(false);

  // 캐릭터 파트 생성 (HIGH LOD)
  const characterParts = useMemo(() => {
    return createBaseCharacterGeometry();
  }, []);

  useEffect(() => {
    partsRef.current = characterParts;
    return () => {
      disposeCharacter(characterParts);
    };
  }, [characterParts]);

  // LOW LOD 큐브 geometry + material
  const lowLodGeo = useMemo(() => new THREE.BoxGeometry(LOW_LOD_CUBE_SIZE, LOW_LOD_CUBE_SIZE * 1.5, LOW_LOD_CUBE_SIZE), []);
  const lowLodMat = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.7,
    metalness: 0.1,
    flatShading: true,
  }), []);

  // 아우라 링 geometry + material
  const auraGeo = useMemo(() => new THREE.RingGeometry(AURA_RADIUS * 0.8, AURA_RADIUS, 32), []);
  const auraMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // 정리
  useEffect(() => {
    return () => {
      lowLodGeo.dispose();
      lowLodMat.dispose();
      auraGeo.dispose();
      auraMat.dispose();
    };
  }, [lowLodGeo, lowLodMat, auraGeo, auraMat]);

  useFrame(() => {
    if (!groupRef.current) return;

    // 현재 프레임의 플레이어 데이터 찾기
    const players = remotePlayersRef.current;
    const data = players.find(p => p.id === playerId);

    if (!data) {
      groupRef.current.visible = false;
      htmlVisible.current = false;
      return;
    }

    // 거리 계산 (2D)
    const localPlayer = playerRef.current;
    const dx = data.x - localPlayer.position.x;
    const dy = data.y - localPlayer.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 적응형 LOD threshold
    const totalPlayers = players.length;
    const factor = totalPlayers > ADAPTIVE_LOD_THRESHOLD
      ? Math.max(0.65, 1 - (totalPlayers - ADAPTIVE_LOD_THRESHOLD) / 60)
      : 1;

    // LOD 판정
    let lod: 'HIGH' | 'MID' | 'LOW' | 'CULL';
    if (dist > LOD_CULL_DISTANCE * factor) {
      lod = 'CULL';
    } else if (dist > LOD_MID_DISTANCE * factor) {
      lod = 'LOW';
    } else if (dist > LOD_HIGH_DISTANCE * factor) {
      lod = 'MID';
    } else {
      lod = 'HIGH';
    }
    lodLevel.current = lod;

    if (lod === 'CULL') {
      groupRef.current.visible = false;
      htmlVisible.current = false;
      return;
    }

    groupRef.current.visible = true;

    // 위치 동기화 (2D→3D 좌표 매핑)
    groupRef.current.position.set(data.x, 0, -data.y);

    // 상태 업데이트 (drei Html용)
    nameRef.current = data.name;
    hpRef.current = data.hp;
    maxHpRef.current = data.maxHp;
    levelRef.current = data.level;
    nationRef.current = data.nation;
    isAllyRef.current = data.isAlly;

    // facing rotation
    if (data.angle != null) {
      groupRef.current.rotation.y = data.angle;
    }

    // 국적 색상 적용
    const nationColor = getNationColor(data.nation);

    // --- HIGH LOD: full character ---
    if (partsRef.current) {
      const charGroup = partsRef.current.group;
      charGroup.visible = lod === 'HIGH' || lod === 'MID';

      if (lod === 'MID') {
        // MID: simplified — 팔 숨기기
        partsRef.current.leftArm.visible = false;
        partsRef.current.rightArm.visible = false;
        partsRef.current.head.visible = true;
        partsRef.current.body.visible = true;
        partsRef.current.leftLeg.visible = true;
        partsRef.current.rightLeg.visible = true;
      } else if (lod === 'HIGH') {
        // HIGH: 모든 파트 표시
        for (const mesh of partsRef.current.allMeshes) {
          mesh.visible = true;
        }
      }

      // 국적 색상을 body에 적용
      const bodyMat = partsRef.current.body.material as THREE.MeshStandardMaterial;
      bodyMat.color.set(nationColor.primary);
    }

    // --- LOW LOD: colored cube ---
    if (lowLodMeshRef.current) {
      lowLodMeshRef.current.visible = lod === 'LOW';
      if (lod === 'LOW') {
        lowLodMat.color.set(nationColor.primary);
        lowLodMeshRef.current.position.y = LOW_LOD_CUBE_SIZE * 0.75;
      }
    }

    // --- PvP 아우라 ---
    if (auraRingRef.current) {
      if (pvpEnabled && (lod === 'HIGH' || lod === 'MID')) {
        auraRingRef.current.visible = true;
        const time = Date.now();
        const pulse = 0.15 + 0.1 * Math.sin(time * AURA_PULSE_SPEED);
        auraMat.opacity = pulse;
        auraMat.color.copy(data.isAlly ? ALLY_AURA_COLOR : ENEMY_AURA_COLOR);
        auraRingRef.current.position.y = 0.05;
      } else {
        auraRingRef.current.visible = false;
      }
    }

    // 네임태그 표시 조건
    htmlVisible.current = lod === 'HIGH' || lod === 'MID';
  });

  return (
    <group ref={groupRef}>
      {/* HIGH/MID LOD: Voxel character */}
      <primitive object={characterParts.group} />

      {/* LOW LOD: Colored cube */}
      <mesh ref={lowLodMeshRef} visible={false}>
        <primitive object={lowLodGeo} attach="geometry" />
        <primitive object={lowLodMat} attach="material" />
      </mesh>

      {/* PvP 아우라 링 (지면에 배치) */}
      <mesh
        ref={auraRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <primitive object={auraGeo} attach="geometry" />
        <primitive object={auraMat} attach="material" />
      </mesh>

      {/* 네임태그 + HP 바 (drei Html) */}
      <RemotePlayerNametag
        position={[0, NAMETAG_Y_OFFSET, 0]}
        nameRef={nameRef}
        hpRef={hpRef}
        maxHpRef={maxHpRef}
        levelRef={levelRef}
        nationRef={nationRef}
        isAllyRef={isAllyRef}
        pvpEnabled={pvpEnabled}
      />
    </group>
  );
}

// ============================================
// 네임태그 + HP 바 (drei Html)
// ============================================

interface RemotePlayerNametagProps {
  position: [number, number, number];
  nameRef: React.MutableRefObject<string>;
  hpRef: React.MutableRefObject<number>;
  maxHpRef: React.MutableRefObject<number>;
  levelRef: React.MutableRefObject<number>;
  nationRef: React.MutableRefObject<string>;
  isAllyRef: React.MutableRefObject<boolean>;
  pvpEnabled: boolean;
}

function RemotePlayerNametag({
  position,
  nameRef,
  hpRef,
  maxHpRef,
  levelRef,
  nationRef,
  isAllyRef,
  pvpEnabled,
}: RemotePlayerNametagProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    if (!divRef.current) return;

    const name = nameRef.current;
    const hp = hpRef.current;
    const maxHp = maxHpRef.current;
    const level = levelRef.current;
    const nation = nationRef.current;
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
    const nationColor = getNationColor(nation);

    // HP 바 색상 (green → yellow → red)
    let hpColor = '#22c55e';
    if (hpPercent < 30) hpColor = '#ef4444';
    else if (hpPercent < 60) hpColor = '#eab308';

    // 아군/적 border 색상
    const borderColor = pvpEnabled
      ? (isAllyRef.current ? '#3B82F6' : '#EF4444')
      : 'transparent';

    divRef.current.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;gap:2px;
        pointer-events:none;user-select:none;
      ">
        <div style="
          font-size:10px;font-family:'Rajdhani',sans-serif;font-weight:600;
          color:${nationColor.glow};text-shadow:0 1px 2px rgba(0,0,0,0.8);
          white-space:nowrap;
        ">
          <span style="font-size:8px;opacity:0.7;margin-right:2px;">[${nation || '???'}]</span>
          ${name || 'Unknown'}
          <span style="
            background:${nationColor.primary};color:#fff;font-size:8px;
            padding:0 3px;border-radius:2px;margin-left:3px;
          ">Lv${level}</span>
        </div>
        <div style="
          width:${HP_BAR_WIDTH}px;height:${HP_BAR_HEIGHT}px;
          background:rgba(0,0,0,0.6);border-radius:2px;overflow:hidden;
          border:1px solid ${borderColor};
        ">
          <div style="
            width:${hpPercent}%;height:100%;background:${hpColor};
            transition:width 0.15s;
          "></div>
        </div>
      </div>
    `;
  });

  return (
    <Html
      position={position}
      center
      zIndexRange={[0, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div ref={divRef} />
    </Html>
  );
}

// ============================================
// RemotePlayer3D 오케스트레이터
// ============================================

/**
 * RemotePlayer3D — 원격 플레이어 3D 렌더링 오케스트레이터
 *
 * 최대 35명의 remote player를 3D voxel 캐릭터로 렌더링.
 * LOD 기반 디테일 조절 + PvP 아우라.
 */
export function RemotePlayer3D({
  remotePlayersRef,
  playerRef,
  pvpEnabled = false,
}: RemotePlayer3DProps) {
  // 활성 플레이어 ID 목록 관리
  const activeIdsRef = useRef<string[]>([]);
  const lodLevelsRef = useRef<Map<string, React.MutableRefObject<'HIGH' | 'MID' | 'LOW' | 'CULL'>>>(new Map());

  useFrame(() => {
    const players = remotePlayersRef.current;

    // 거리 기준 정렬 (가까운 순)
    const localPlayer = playerRef.current;
    const sorted = [...players]
      .map(p => ({
        id: p.id,
        dist: Math.sqrt(
          (p.x - localPlayer.position.x) ** 2 +
          (p.y - localPlayer.position.y) ** 2
        ),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, MAX_RENDERED_PLAYERS);

    activeIdsRef.current = sorted.map(s => s.id);
  });

  // 플레이어 수 기반 슬롯 생성 (최대 35)
  const slots = useMemo(() => {
    const result: { id: number; lodRef: React.MutableRefObject<'HIGH' | 'MID' | 'LOW' | 'CULL'> }[] = [];
    for (let i = 0; i < MAX_RENDERED_PLAYERS; i++) {
      result.push({
        id: i,
        // eslint-disable-next-line react-hooks/rules-of-hooks
        lodRef: { current: 'CULL' as const },
      });
    }
    return result;
  }, []);

  // 가상 슬롯 렌더러 — players ref에서 직접 읽음
  return (
    <group name="remote-players-3d">
      {slots.map((slot) => (
        <RemotePlayerSlot
          key={slot.id}
          slotIndex={slot.id}
          remotePlayersRef={remotePlayersRef}
          playerRef={playerRef}
          pvpEnabled={pvpEnabled}
          activeIdsRef={activeIdsRef}
        />
      ))}
    </group>
  );
}

// ============================================
// 슬롯 기반 렌더러 (풀링)
// ============================================

interface RemotePlayerSlotProps {
  slotIndex: number;
  remotePlayersRef: React.MutableRefObject<RemotePlayer3DData[]>;
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
  pvpEnabled: boolean;
  activeIdsRef: React.MutableRefObject<string[]>;
}

function RemotePlayerSlot({
  slotIndex,
  remotePlayersRef,
  playerRef,
  pvpEnabled,
  activeIdsRef,
}: RemotePlayerSlotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const partsRef = useRef<CharacterParts | null>(null);
  const lowLodMeshRef = useRef<THREE.Mesh>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const nametagDivRef = useRef<HTMLDivElement>(null);

  // 캐릭터 파트 생성
  const characterParts = useMemo(() => createBaseCharacterGeometry(), []);

  useEffect(() => {
    partsRef.current = characterParts;
    return () => disposeCharacter(characterParts);
  }, [characterParts]);

  // 공유 geometry/material
  const lowLodGeo = useMemo(() => new THREE.BoxGeometry(LOW_LOD_CUBE_SIZE, LOW_LOD_CUBE_SIZE * 1.5, LOW_LOD_CUBE_SIZE), []);
  const lowLodMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1, flatShading: true }), []);
  const auraGeo = useMemo(() => new THREE.RingGeometry(AURA_RADIUS * 0.8, AURA_RADIUS, 24), []);
  const auraMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }), []);

  useEffect(() => {
    return () => {
      lowLodGeo.dispose();
      lowLodMat.dispose();
      auraGeo.dispose();
      auraMat.dispose();
    };
  }, [lowLodGeo, lowLodMat, auraGeo, auraMat]);

  useFrame(() => {
    if (!groupRef.current) return;

    const activeIds = activeIdsRef.current;
    const assignedId = activeIds[slotIndex];

    if (!assignedId) {
      groupRef.current.visible = false;
      return;
    }

    const players = remotePlayersRef.current;
    const data = players.find(p => p.id === assignedId);

    if (!data) {
      groupRef.current.visible = false;
      return;
    }

    // 거리 계산
    const localPlayer = playerRef.current;
    const dx = data.x - localPlayer.position.x;
    const dy = data.y - localPlayer.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 적응형 LOD
    const totalPlayers = players.length;
    const factor = totalPlayers > ADAPTIVE_LOD_THRESHOLD
      ? Math.max(0.65, 1 - (totalPlayers - ADAPTIVE_LOD_THRESHOLD) / 60)
      : 1;

    let lod: 'HIGH' | 'MID' | 'LOW' | 'CULL';
    if (dist > LOD_CULL_DISTANCE * factor) lod = 'CULL';
    else if (dist > LOD_MID_DISTANCE * factor) lod = 'LOW';
    else if (dist > LOD_HIGH_DISTANCE * factor) lod = 'MID';
    else lod = 'HIGH';

    if (lod === 'CULL') {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    groupRef.current.position.set(data.x, 0, -data.y);

    if (data.angle != null) {
      groupRef.current.rotation.y = data.angle;
    }

    const nationColor = getNationColor(data.nation);

    // HIGH/MID LOD: character
    if (partsRef.current) {
      const charGroup = partsRef.current.group;
      charGroup.visible = lod === 'HIGH' || lod === 'MID';

      if (lod === 'MID') {
        partsRef.current.leftArm.visible = false;
        partsRef.current.rightArm.visible = false;
      } else if (lod === 'HIGH') {
        for (const mesh of partsRef.current.allMeshes) mesh.visible = true;
      }

      const bodyMat = partsRef.current.body.material as THREE.MeshStandardMaterial;
      bodyMat.color.set(nationColor.primary);
    }

    // LOW LOD: cube
    if (lowLodMeshRef.current) {
      lowLodMeshRef.current.visible = lod === 'LOW';
      if (lod === 'LOW') {
        lowLodMat.color.set(nationColor.primary);
        lowLodMeshRef.current.position.y = LOW_LOD_CUBE_SIZE * 0.75;
      }
    }

    // PvP 아우라
    if (auraRingRef.current) {
      if (pvpEnabled && (lod === 'HIGH' || lod === 'MID')) {
        auraRingRef.current.visible = true;
        const pulse = 0.15 + 0.1 * Math.sin(Date.now() * AURA_PULSE_SPEED);
        auraMat.opacity = pulse;
        auraMat.color.copy(data.isAlly ? ALLY_AURA_COLOR : ENEMY_AURA_COLOR);
      } else {
        auraRingRef.current.visible = false;
      }
    }

    // 네임태그 업데이트
    if (nametagDivRef.current && (lod === 'HIGH' || lod === 'MID')) {
      const hpPercent = data.maxHp > 0 ? Math.max(0, Math.min(100, (data.hp / data.maxHp) * 100)) : 0;
      let hpColor = '#22c55e';
      if (hpPercent < 30) hpColor = '#ef4444';
      else if (hpPercent < 60) hpColor = '#eab308';

      const borderColor = pvpEnabled
        ? (data.isAlly ? '#3B82F6' : '#EF4444')
        : 'transparent';

      nametagDivRef.current.style.display = 'block';
      nametagDivRef.current.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="font-size:10px;font-family:'Rajdhani',sans-serif;font-weight:600;color:${nationColor.glow};text-shadow:0 1px 2px rgba(0,0,0,0.8);white-space:nowrap;">
            <span style="font-size:8px;opacity:0.7;margin-right:2px;">[${data.nation || '???'}]</span>
            ${data.name || 'Unknown'}
            <span style="background:${nationColor.primary};color:#fff;font-size:8px;padding:0 3px;border-radius:2px;margin-left:3px;">Lv${data.level}</span>
          </div>
          <div style="width:${HP_BAR_WIDTH}px;height:${HP_BAR_HEIGHT}px;background:rgba(0,0,0,0.6);border-radius:2px;overflow:hidden;border:1px solid ${borderColor};">
            <div style="width:${hpPercent}%;height:100%;background:${hpColor};"></div>
          </div>
        </div>
      `;
    } else if (nametagDivRef.current) {
      nametagDivRef.current.style.display = 'none';
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={characterParts.group} />

      <mesh ref={lowLodMeshRef} visible={false}>
        <primitive object={lowLodGeo} attach="geometry" />
        <primitive object={lowLodMat} attach="material" />
      </mesh>

      <mesh ref={auraRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} position={[0, 0.05, 0]}>
        <primitive object={auraGeo} attach="geometry" />
        <primitive object={auraMat} attach="material" />
      </mesh>

      <Html position={[0, NAMETAG_Y_OFFSET, 0]} center zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={nametagDivRef} style={{ pointerEvents: 'none', userSelect: 'none' }} />
      </Html>
    </group>
  );
}

export default RemotePlayer3D;
