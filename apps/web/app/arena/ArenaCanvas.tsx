'use client';

/**
 * ArenaCanvas — R3F Canvas for Arena Combat
 *
 * 분리된 Canvas 컴포넌트 (dynamic import 대상)
 * - ARCamera, ARPlayer, AREntities 조합
 * - 간단한 지면 + 조명 + 안개
 * - WASD 이동 처리
 */

import { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARCamera } from '@/components/game/ar/ARCamera';
import { ARPlayer } from '@/components/game/ar/ARPlayer';
import { AREntities } from '@/components/game/ar/AREntities';
import { ARDamageNumbers, type DamageNumber } from '@/components/game/ar/ARDamageNumbers';
import type { AREnemyNet, ARCrystalNet } from '@/lib/3d/ar-types';

const ARENA_RADIUS = 40;
const PLAYER_SPEED = 5;

interface ArenaCanvasProps {
  enemies: AREnemyNet[];
  xpCrystals: ARCrystalNet[];
  playerPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  playerRotRef: React.MutableRefObject<number>;
  movingRef: React.MutableRefObject<boolean>;
  keysRef: React.MutableRefObject<Set<string>>;
  attackRange: number;
  hpRatio: number;
  alive: boolean;
  damageNumbersRef: React.MutableRefObject<DamageNumber[]>;
}

// 내부 게임 루프 (Canvas 내부)
function GameLoop({
  playerPosRef,
  playerRotRef,
  movingRef,
  keysRef,
  yawRef,
  alive,
}: {
  playerPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  playerRotRef: React.MutableRefObject<number>;
  movingRef: React.MutableRefObject<boolean>;
  keysRef: React.MutableRefObject<Set<string>>;
  yawRef: React.MutableRefObject<number>;
  alive: boolean;
}) {
  useFrame((_, delta) => {
    if (!alive) return;

    const keys = keysRef.current;
    let dx = 0;
    let dz = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    const moving = dx !== 0 || dz !== 0;
    movingRef.current = moving;

    if (moving) {
      // Rotate movement by camera yaw
      const yaw = yawRef.current;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;

      // Normalize
      const mag = Math.sqrt(rx * rx + rz * rz);
      const nx = mag > 0 ? rx / mag : 0;
      const nz = mag > 0 ? rz / mag : 0;

      const pos = playerPosRef.current;
      pos.x += nx * PLAYER_SPEED * delta;
      pos.z += nz * PLAYER_SPEED * delta;

      // Clamp to arena
      const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      if (dist > ARENA_RADIUS) {
        const scale = ARENA_RADIUS / dist;
        pos.x *= scale;
        pos.z *= scale;
      }

      // Face movement direction
      playerRotRef.current = Math.atan2(nx, nz);
    }
  });

  return null;
}

// 지면 그리드
function ArenaGround() {
  return (
    <group>
      {/* 바닥 평면 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS, 64]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>

      {/* 아레나 경계 링 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.3, ARENA_RADIUS, 64]} />
        <meshBasicMaterial color="#FF4444" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* 그리드 라인 */}
      <gridHelper args={[ARENA_RADIUS * 2, 40, '#333333', '#222222']} position={[0, 0.005, 0]} />
    </group>
  );
}

export default function ArenaCanvas({
  enemies,
  xpCrystals,
  playerPosRef,
  playerRotRef,
  movingRef,
  keysRef,
  attackRange,
  hpRatio,
  alive,
  damageNumbersRef,
}: ArenaCanvasProps) {
  const yawRef = useRef(0);
  const lockedRef = useRef(false);

  return (
    <Canvas
      camera={{ fov: 60, near: 0.1, far: 200, position: [0, 10, 10] }}
      style={{ position: 'absolute', inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      onPointerDown={() => {
        lockedRef.current = true;
      }}
    >
      {/* 조명 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} castShadow />
      <hemisphereLight args={['#87CEEB', '#333333', 0.3]} />

      {/* 안개 */}
      <fog attach="fog" args={['#111111', 30, 80]} />

      {/* 지면 */}
      <ArenaGround />

      {/* 게임 루프 (이동 처리) */}
      <GameLoop
        playerPosRef={playerPosRef}
        playerRotRef={playerRotRef}
        movingRef={movingRef}
        keysRef={keysRef}
        yawRef={yawRef}
        alive={alive}
      />

      {/* 카메라 */}
      <ARCamera playerPosRef={playerPosRef} locked={true} yawRef={yawRef} />

      {/* 플레이어 */}
      <PlayerWrapper
        playerPosRef={playerPosRef}
        playerRotRef={playerRotRef}
        movingRef={movingRef}
        attackRange={attackRange}
        hpRatio={hpRatio}
      />

      {/* 적 + XP 크리스탈 */}
      <AREntities enemies={enemies} xpCrystals={xpCrystals} />

      {/* 데미지 넘버 */}
      <ARDamageNumbers numbersRef={damageNumbersRef} />
    </Canvas>
  );
}

// PlayerWrapper reads refs and passes to ARPlayer
function PlayerWrapper({
  playerPosRef,
  playerRotRef,
  movingRef,
  attackRange,
  hpRatio,
}: {
  playerPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  playerRotRef: React.MutableRefObject<number>;
  movingRef: React.MutableRefObject<boolean>;
  attackRange: number;
  hpRatio: number;
}) {
  const posRef = useRef({ x: 0, y: 0, z: 0 });

  // We need to re-render ARPlayer per frame, but ARPlayer uses useFrame internally.
  // Pass refs directly.
  return (
    <ARPlayerBridge
      playerPosRef={playerPosRef}
      playerRotRef={playerRotRef}
      movingRef={movingRef}
      attackRange={attackRange}
      hpRatio={hpRatio}
    />
  );
}

function ARPlayerBridge({
  playerPosRef,
  playerRotRef,
  movingRef,
  attackRange,
  hpRatio,
}: {
  playerPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  playerRotRef: React.MutableRefObject<number>;
  movingRef: React.MutableRefObject<boolean>;
  attackRange: number;
  hpRatio: number;
}) {
  // ARPlayer expects position as tuple, but we need it to update per frame.
  // We use a wrapper group that reads from refs in useFrame.
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    // Position is updated by GameLoop via playerPosRef
  });

  return (
    <ARPlayer
      position={[playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z]}
      rotation={playerRotRef.current}
      moving={movingRef.current}
      attackRange={attackRange}
      hpRatio={hpRatio}
      posRef={playerPosRef}
    />
  );
}
