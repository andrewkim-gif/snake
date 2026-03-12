'use client';

/**
 * SwingArc.tsx — 3D 근접 공격 Swing Arc 이펙트 (Phase 3)
 *
 * 플레이어 자동 공격 시 반원 형태의 slash 이펙트를 표시한다.
 * - RingGeometry 기반 반원 (thetaStart/thetaLength로 반원 생성)
 * - 0.25초 동안 표시 후 fade out
 * - MeshBasicMaterial 반투명 (depth test off, 항상 표시)
 * - 플레이어 위치 + facing 방향 기반 회전
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, h, y) — MC FPS 직접 매핑
 * useFrame priority=0 필수
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '@/lib/matrix/types';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';

// ============================================
// 상수
// ============================================

/** Swing arc 지속 시간 (초) */
const SWING_DURATION = 0.25;

/** Swing arc 반지름 (MC 블록 스케일: 2~3 블록) */
const SWING_RADIUS = 2.5;

/** Swing arc 두께 */
const SWING_THICKNESS = 0.6;

// ============================================
// 공격 이벤트 구조
// ============================================

/** 공격 이벤트 (MatrixScene에서 발행) */
export interface AttackEvent {
  /** 공격 시점 2D 좌표 (플레이어 위치) */
  position: { x: number; y: number };
  /** 공격 방향 (facing) — 2D */
  direction: { x: number; y: number };
  /** 크리티컬 여부 */
  isCritical: boolean;
  /** 이벤트 시간 */
  timestamp: number;
}

// ============================================
// Props
// ============================================

export interface SwingArcProps {
  /** 플레이어 ref (위치/facing 동기화) */
  playerRef: React.MutableRefObject<Player>;
  /** 공격 이벤트 큐 ref */
  attackEventsRef: React.MutableRefObject<AttackEvent[]>;
  /** facing 방향 ref */
  facingRef: React.MutableRefObject<{ x: number; y: number }>;
}

// ============================================
// SwingArc Component
// ============================================

export function SwingArc({ playerRef, attackEventsRef, facingRef }: SwingArcProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 최대 동시 표시 가능한 arc 수 (3개면 충분)
  const MAX_ARCS = 3;

  // arc 상태 관리
  const arcsRef = useRef<{
    active: boolean;
    timer: number;
    posX: number;
    posZ: number;
    rotation: number;
    isCritical: boolean;
  }[]>([]);

  // mesh + material refs
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const matRefs = useRef<THREE.MeshBasicMaterial[]>([]);

  // geometry (재사용) — 반원 형태 (RingGeometry)
  const geometry = useMemo(() => {
    // RingGeometry(innerRadius, outerRadius, thetaSegments, phiSegments, thetaStart, thetaLength)
    const geo = new THREE.RingGeometry(
      SWING_RADIUS - SWING_THICKNESS,
      SWING_RADIUS,
      16,    // theta segments
      1,     // phi segments
      0,     // theta start (0 = right)
      Math.PI // theta length (PI = 반원)
    );
    return geo;
  }, []);

  // arc 상태 초기화
  useMemo(() => {
    const arcs = [];
    for (let i = 0; i < MAX_ARCS; i++) {
      arcs.push({
        active: false,
        timer: 0,
        posX: 0,
        posZ: 0,
        rotation: 0,
        isCritical: false,
      });
    }
    arcsRef.current = arcs;
  }, []);

  // geometry cleanup (언마운트 시 메모리 누수 방지)
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // useFrame: 공격 이벤트 소비 + arc 업데이트
  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const arcs = arcsRef.current;

    // 새 공격 이벤트 처리
    const events = attackEventsRef.current;
    while (events.length > 0) {
      const event = events.shift()!;

      // 비활성 arc 슬롯 찾기
      let freeIdx = -1;
      for (let i = 0; i < MAX_ARCS; i++) {
        if (!arcs[i].active) {
          freeIdx = i;
          break;
        }
      }
      // 모든 슬롯이 활성이면 가장 오래된 것 재사용
      if (freeIdx === -1) {
        let oldest = 0;
        for (let i = 1; i < MAX_ARCS; i++) {
          if (arcs[i].timer < arcs[oldest].timer) oldest = i;
        }
        freeIdx = oldest;
      }

      const arc = arcs[freeIdx];
      arc.active = true;
      arc.timer = SWING_DURATION;
      arc.posX = event.position.x;
      arc.posZ = event.position.y; // MC FPS: y→z 직접 매핑
      arc.isCritical = event.isCritical;

      // facing 방향 → Y축 회전 각도 (MC FPS: x,y → x,z 직접)
      const fx = event.direction.x;
      const fy = event.direction.y;
      if (Math.abs(fx) > 0.01 || Math.abs(fy) > 0.01) {
        arc.rotation = Math.atan2(fx, fy);
      } else {
        const f = facingRef.current;
        arc.rotation = Math.atan2(f.x, f.y);
      }
    }

    // arc 업데이트 + 렌더링
    for (let i = 0; i < MAX_ARCS; i++) {
      const arc = arcs[i];
      const mesh = meshRefs.current[i];
      const mat = matRefs.current[i];
      if (!mesh || !mat) continue;

      if (!arc.active) {
        mesh.visible = false;
        continue;
      }

      arc.timer -= delta;
      if (arc.timer <= 0) {
        arc.active = false;
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;

      // 위치 (플레이어 현재 위치 기반 — 실시간 추적)
      const player = playerRef.current;
      const px = player.position.x;
      const pz = player.position.y; // MC FPS: y→z 직접 매핑
      // height3d가 있으면 점프 높이 반영, 없으면 지형 기반
      const baseH = player.height3d != null ? player.height3d : getMCTerrainHeight(px, pz) + 1;
      const h = baseH + 0.9; // 눈 높이

      mesh.position.set(px, h, pz);

      // 회전: XZ 평면에 놓고 Y축 회전으로 facing 방향
      mesh.rotation.set(-Math.PI / 2, 0, arc.rotation + Math.PI / 2);

      // 스케일: 시작 시 작아지다가 커지는 효과
      const progress = 1 - arc.timer / SWING_DURATION; // 0→1
      const scaleT = Math.sin(progress * Math.PI); // 0→1→0 bell curve
      mesh.scale.setScalar(0.6 + scaleT * 0.5);

      // 투명도: fade out
      const alpha = arc.timer / SWING_DURATION;
      mat.opacity = alpha * 0.6;

      // 색상: 크리티컬이면 황금색, 아니면 시안
      if (arc.isCritical) {
        mat.color.setHex(0xffdd00);
      } else {
        mat.color.setHex(0x00ffcc);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: MAX_ARCS }, (_, i) => (
        <mesh
          key={`swing-arc-${i}`}
          ref={(el) => {
            if (el) meshRefs.current[i] = el;
          }}
          visible={false}
          renderOrder={100}
        >
          <primitive object={geometry} attach="geometry" />
          <meshBasicMaterial
            ref={(el: THREE.MeshBasicMaterial | null) => {
              if (el) matRefs.current[i] = el;
            }}
            color="#00ffcc"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

export default SwingArc;
