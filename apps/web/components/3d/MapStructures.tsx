'use client';

/**
 * MapStructures — 맵 구조물 (Shrine / Spring / Altar)
 * XP Shrine (3개): Mid Zone, 120° 간격, radius * 0.40
 * Healing Spring (2개): Edge Zone, 180° 간격, radius * 0.75
 * Upgrade Altar (2개): Mid~Core 경계, 180° 간격, radius * 0.30
 *
 * 각 구조물은 복셀 블록 조합 (BoxGeometry 기반)
 * 크리스탈/마법서에 회전+부유 애니메이션
 * useFrame priority 0 필수!
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MapStructuresProps {
  arenaRadius: number;
}

// ─── 위치 계산 ───

function positionsOnCircle(
  radius: number,
  count: number,
  offsetAngle = 0,
): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const angle = offsetAngle + (i * Math.PI * 2) / count;
    positions.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return positions;
}

// ─── XP Shrine 서브컴포넌트 ───

function XPShrine({ position }: { position: [number, number] }) {
  const crystalRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!crystalRef.current) return;
    const t = performance.now() * 0.001;
    crystalRef.current.rotation.y = t * 0.8;
    // 부유 bob
    crystalRef.current.position.y = 30 + Math.sin(t * 1.5) * 2;
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* 받침대 */}
      <mesh position-y={2}>
        <boxGeometry args={[16, 4, 16]} />
        <meshLambertMaterial color="#888888" />
      </mesh>

      {/* 기둥 */}
      <mesh position-y={16}>
        <boxGeometry args={[8, 24, 8]} />
        <meshLambertMaterial color="#999999" />
      </mesh>

      {/* 크리스탈 — emissive green, 회전 애니메이션 */}
      <mesh ref={crystalRef} position-y={30}>
        <boxGeometry args={[6, 6, 6]} />
        <meshLambertMaterial
          color="#44CC44"
          emissive={new THREE.Color('#22AA22')}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

// ─── Healing Spring 서브컴포넌트 ───

function HealingSpring({ position }: { position: [number, number] }) {
  const waterRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!waterRef.current) return;
    const t = performance.now() * 0.001;
    // 수면 물결 — Y축 미세 변동
    waterRef.current.position.y = 2.5 + Math.sin(t * 2.0) * 0.3;
    // 수면 스케일 물결
    const wave = 1.0 + Math.sin(t * 1.5) * 0.02;
    waterRef.current.scale.set(wave, 1, wave);
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* 테두리 — 이끼 낀 돌 링 (4개 박스로 사각 링 근사) */}
      <mesh position={[0, 2, -14]}>
        <boxGeometry args={[28, 4, 4]} />
        <meshLambertMaterial color="#5A7A52" />
      </mesh>
      <mesh position={[0, 2, 14]}>
        <boxGeometry args={[28, 4, 4]} />
        <meshLambertMaterial color="#5A7A52" />
      </mesh>
      <mesh position={[-14, 2, 0]}>
        <boxGeometry args={[4, 4, 28]} />
        <meshLambertMaterial color="#5A7A52" />
      </mesh>
      <mesh position={[14, 2, 0]}>
        <boxGeometry args={[4, 4, 28]} />
        <meshLambertMaterial color="#5A7A52" />
      </mesh>

      {/* 수면 — 반투명 blue */}
      <mesh ref={waterRef} rotation-x={-Math.PI / 2} position-y={2.5}>
        <circleGeometry args={[12, 32]} />
        <meshLambertMaterial
          color="#4488CC"
          emissive={new THREE.Color('#2266AA')}
          emissiveIntensity={0.15}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}

// ─── Upgrade Altar 서브컴포넌트 ───

function UpgradeAltar({ position }: { position: [number, number] }) {
  const bookRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!bookRef.current) return;
    const t = performance.now() * 0.001;
    bookRef.current.rotation.y = t * 0.6;
    // 부유 bob
    bookRef.current.position.y = 14 + Math.sin(t * 1.2) * 1.5;
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* 제단 — 옵시디언 다크 */}
      <mesh position-y={4}>
        <boxGeometry args={[12, 8, 12]} />
        <meshLambertMaterial color="#1A1025" />
      </mesh>

      {/* 마법서 — emissive purple, 회전+부유 */}
      <mesh ref={bookRef} position-y={14}>
        <boxGeometry args={[4, 1, 6]} />
        <meshLambertMaterial
          color="#8844CC"
          emissive={new THREE.Color('#6622AA')}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

// ─── 메인 컴포넌트 ───

export function MapStructures({ arenaRadius }: MapStructuresProps) {
  // 구조물 위치 계산
  const shrinePositions = positionsOnCircle(arenaRadius * 0.40, 3, 0);
  const springPositions = positionsOnCircle(arenaRadius * 0.75, 2, Math.PI / 4);
  const altarPositions = positionsOnCircle(arenaRadius * 0.30, 2, Math.PI / 2);

  return (
    <group>
      {/* XP Shrines — 3개, Mid Zone, 120° 간격 */}
      {shrinePositions.map((pos, i) => (
        <XPShrine key={`shrine-${i}`} position={pos} />
      ))}

      {/* Healing Springs — 2개, Edge Zone, 180° 간격 */}
      {springPositions.map((pos, i) => (
        <HealingSpring key={`spring-${i}`} position={pos} />
      ))}

      {/* Upgrade Altars — 2개, Mid~Core 경계, 180° 간격 */}
      {altarPositions.map((pos, i) => (
        <UpgradeAltar key={`altar-${i}`} position={pos} />
      ))}
    </group>
  );
}
