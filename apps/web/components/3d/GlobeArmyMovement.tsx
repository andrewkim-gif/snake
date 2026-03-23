'use client';

// R3F 컴포넌트 — Globe 씬 내부에서 마운트
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcPoints } from '@/lib/effect-utils';
import { ARC_HEIGHT, RENDER_ORDER } from '@/lib/effect-constants';

// ── 인터페이스 ──

interface IArmyMovement {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  progress: number; // 0.0 ~ 1.0 (출발~도착)
  ownerColor: string;
  unitCount: number;
}

interface IGlobeArmyMovementProps {
  movements: IArmyMovement[];
  globeRadius?: number;
}

// ── 상수 ──

const DEFAULT_GLOBE_RADIUS = 100;
const ARC_SEGMENTS = 48;
const SPHERE_SEGMENTS = 6;
const CONE_RADIUS = 0.4;
const CONE_HEIGHT = 1.2;
const BLINK_THRESHOLD = 0.8; // progress > 0.8 → 빨간색 깜빡임

// ── 유닛 수에 따른 라인 두께 ──

function unitCountToLineWidth(count: number): number {
  if (count >= 100) return 2.5;
  if (count >= 50) return 2.0;
  if (count >= 10) return 1.5;
  return 1.0;
}

// ── 유닛 수에 따른 구체 크기 ──

function unitCountToSphereScale(count: number): number {
  if (count >= 100) return 1.2;
  if (count >= 50) return 0.9;
  if (count >= 10) return 0.7;
  return 0.5;
}

// ── 개별 군대 이동 아크 ──

function ArmyArc({ movement, globeRadius }: { movement: IArmyMovement; globeRadius: number }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);

  // 커브 포인트 계산 (from/to 변경 시 재계산)
  const arcData = useMemo(() => {
    const startPos = latLngToVector3(movement.from.lat, movement.from.lng, globeRadius + 0.5);
    const endPos = latLngToVector3(movement.to.lat, movement.to.lng, globeRadius + 0.5);
    const points = createArcPoints(startPos, endPos, globeRadius, ARC_HEIGHT.war, ARC_SEGMENTS);

    // 라인 geometry
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

    return { points, lineGeo, startPos, endPos };
  }, [movement.from.lat, movement.from.lng, movement.to.lat, movement.to.lng, globeRadius]);

  // 라인 머티리얼 (소유자 색상)
  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(movement.ownerColor),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      linewidth: unitCountToLineWidth(movement.unitCount),
    });
  }, [movement.ownerColor, movement.unitCount]);

  // 구체 머티리얼 (소유자 색상)
  const sphereMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(movement.ownerColor),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    });
  }, [movement.ownerColor]);

  // 콘 머티리얼 (화살표 방향)
  const coneMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(movement.ownerColor),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
    });
  }, [movement.ownerColor]);

  // 매 프레임: 구체/콘 위치 업데이트
  useFrame(({ clock }) => {
    if (!sphereRef.current || !coneRef.current) return;

    const { points } = arcData;
    const ptsLen = points.length;
    const progress = Math.max(0, Math.min(movement.progress, 1));

    // 구체 위치 — progress에 따라 아크 위 이동
    const idx = Math.floor(progress * (ptsLen - 1));
    const frac = progress * (ptsLen - 1) - idx;
    const p0 = points[Math.min(idx, ptsLen - 1)];
    const p1 = points[Math.min(idx + 1, ptsLen - 1)];

    sphereRef.current.position.lerpVectors(p0, p1, frac);
    const scale = unitCountToSphereScale(movement.unitCount);
    sphereRef.current.scale.setScalar(scale);

    // 도착 임박 깜빡임 (progress > 0.8)
    if (progress > BLINK_THRESHOLD) {
      const blinkRate = 4 + (progress - BLINK_THRESHOLD) * 20; // 점점 빠르게
      const blink = Math.sin(clock.getElapsedTime() * blinkRate * Math.PI) > 0;
      const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(blink ? '#ff2222' : movement.ownerColor);
    }

    // 콘 (화살표) — 구체 약간 뒤에 배치
    const coneIdx = Math.max(0, idx - 1);
    const cp0 = points[Math.min(coneIdx, ptsLen - 1)];
    const cp1 = points[Math.min(coneIdx + 1, ptsLen - 1)];
    coneRef.current.position.lerpVectors(cp0, cp1, frac);
    coneRef.current.scale.setScalar(scale * 0.7);

    // 콘이 이동 방향을 바라보도록 회전
    const direction = new THREE.Vector3().subVectors(p1, p0).normalize();
    if (direction.lengthSq() > 0) {
      const quaternion = new THREE.Quaternion();
      // ConeGeometry 기본 방향은 +Y, 이동 방향으로 회전
      const up = new THREE.Vector3(0, 1, 0);
      quaternion.setFromUnitVectors(up, direction);
      coneRef.current.quaternion.copy(quaternion);
    }
  });

  const sphereScale = unitCountToSphereScale(movement.unitCount);

  return (
    <group>
      {/* 아크 라인 */}
      <primitive
        ref={lineRef}
        object={new THREE.Line(arcData.lineGeo, lineMaterial)}
        renderOrder={RENDER_ORDER.ARC_WAR}
      />
      {/* 이동 구체 */}
      <mesh ref={sphereRef} renderOrder={RENDER_ORDER.CARGO}>
        <sphereGeometry args={[0.5, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <primitive object={sphereMaterial} attach="material" />
      </mesh>
      {/* 방향 콘 (화살표) */}
      <mesh ref={coneRef} renderOrder={RENDER_ORDER.CARGO}>
        <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 4]} />
        <primitive object={coneMaterial} attach="material" />
      </mesh>
    </group>
  );
}

// ── 메인 컴포넌트 ──

export default function GlobeArmyMovement({
  movements,
  globeRadius = DEFAULT_GLOBE_RADIUS,
}: IGlobeArmyMovementProps) {
  return (
    <group>
      {movements.map((movement) => (
        <ArmyArc key={movement.id} movement={movement} globeRadius={globeRadius} />
      ))}
    </group>
  );
}
