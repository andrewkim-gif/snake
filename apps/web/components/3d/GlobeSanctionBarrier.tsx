'use client';

/**
 * GlobeSanctionBarrier — v23 Phase 5 Task 2
 * 제재 차단선 이펙트:
 * - 대상국 centroid에 빨간 X 마크 (두 개의 BoxGeometry 교차 + 빨간 emissive)
 * - 제재 발동국→대상국 사이 빨간 점선 아크 라인 (LineDashedMaterial)
 * - 주변 빨간 점선 원 (RingGeometry + MeshBasicMaterial, 느린 회전)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';

// ─── Types ───

export interface SanctionData {
  from: string;   // ISO3 — 제재 발동국
  to: string;     // ISO3 — 제재 대상국
  timestamp: number;
}

export interface GlobeSanctionBarrierProps {
  sanctions: SanctionData[];
  centroidsMap: Map<string, [number, number]>;
  globeRadius?: number;
  visible?: boolean;
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const ARC_SEGMENTS = 48;
const ARC_HEIGHT_FACTOR = 0.25;
const SANCTION_COLOR = new THREE.Color(0xcc3333);
const SANCTION_HDR = new THREE.Color(0xcc3333).multiplyScalar(2.0);
const X_BAR_LENGTH = 3.0;
const X_BAR_THICKNESS = 0.4;

const RING_INNER = 4.0;
const RING_OUTER = 4.5;
const DASH_LINE_SEGMENTS = 48;

// ─── GC-prevention ───

const _tempVec = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

// ─── Helpers ───

/** 두 구면 점 사이의 아크 라인 포인트 */
function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  segments: number,
): THREE.Vector3[] {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  mid.normalize().multiplyScalar(radius + dist * ARC_HEIGHT_FACTOR);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const invT = 1 - t;
    const p = new THREE.Vector3()
      .addScaledVector(start, invT * invT)
      .addScaledVector(mid, 2 * invT * t)
      .addScaledVector(end, t * t);
    points.push(p);
  }
  return points;
}

// ─── Internal render data ───

interface SanctionRenderData {
  // X 마크 (대상국 위)
  xBar1: THREE.Mesh;
  xBar2: THREE.Mesh;
  // 빨간 점선 원
  ring: THREE.Mesh;
  // 점선 아크 라인 (발동국→대상국)
  dashLine: THREE.Line;
  dashMaterial: THREE.LineDashedMaterial;
  // 대상국 위치 normal (회전 연산용)
  targetNormal: THREE.Vector3;
  key: string;
}

// ─── Component ───

export function GlobeSanctionBarrier({
  sanctions,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
}: GlobeSanctionBarrierProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dataRef = useRef<SanctionRenderData[]>([]);

  // 공유 geometry — PlaneGeometry로 교체 (BoxGeometry는 검은 박스 문제 유발)
  const barGeo = useMemo(
    () => new THREE.PlaneGeometry(X_BAR_LENGTH, X_BAR_THICKNESS),
    [],
  );
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(RING_INNER, RING_OUTER, 32),
    [],
  );

  // 공유 material
  const xMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: SANCTION_HDR,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    [],
  );

  const ringMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: SANCTION_COLOR,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    [],
  );

  // sanctions 변경 시 재구축
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 기존 정리
    for (const d of dataRef.current) {
      group.remove(d.xBar1);
      group.remove(d.xBar2);
      group.remove(d.ring);
      group.remove(d.dashLine);
      d.dashLine.geometry.dispose();
      d.dashMaterial.dispose();
    }
    dataRef.current = [];

    for (const sanction of sanctions) {
      const fromC = centroidsMap.get(sanction.from);
      const toC = centroidsMap.get(sanction.to);
      if (!toC) continue; // 대상국은 필수

      const targetPos = latLngToVector3(toC[0], toC[1], globeRadius + 1.5);
      const targetNormal = targetPos.clone().normalize();

      // X 마크: 두 개의 교차 박스
      const xBar1 = new THREE.Mesh(barGeo, xMaterial.clone());
      const xBar2 = new THREE.Mesh(barGeo, xMaterial.clone());

      // 표면 법선 방향으로 회전
      _quat.setFromUnitVectors(_up, targetNormal);
      xBar1.position.copy(targetPos);
      xBar1.quaternion.copy(_quat);
      xBar1.rotateX(-Math.PI / 2); // 표면에 눕힘
      xBar1.rotateZ(Math.PI / 4);  // 45도 회전 → X 모양

      xBar2.position.copy(targetPos);
      xBar2.quaternion.copy(_quat);
      xBar2.rotateX(-Math.PI / 2);
      xBar2.rotateZ(-Math.PI / 4); // -45도 회전

      xBar1.renderOrder = 5;
      xBar2.renderOrder = 5;

      // 빨간 점선 원 (대상국 주변)
      const ring = new THREE.Mesh(ringGeo, ringMaterial.clone());
      ring.position.copy(targetPos);
      ring.quaternion.copy(_quat);
      ring.rotateX(-Math.PI / 2);
      ring.renderOrder = 4;

      group.add(xBar1);
      group.add(xBar2);
      group.add(ring);

      // 점선 아크 라인 (발동국→대상국)
      let dashLine: THREE.Line;
      let dashMaterial: THREE.LineDashedMaterial;

      if (fromC) {
        const startPos = latLngToVector3(fromC[0], fromC[1], globeRadius + 1.0);
        const endPos = latLngToVector3(toC[0], toC[1], globeRadius + 1.0);
        const points = createArcPoints(startPos, endPos, globeRadius, DASH_LINE_SEGMENTS);

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        dashMaterial = new THREE.LineDashedMaterial({
          color: SANCTION_COLOR,
          dashSize: 2.0,
          gapSize: 1.5,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        });

        dashLine = new THREE.Line(lineGeo, dashMaterial);
        dashLine.computeLineDistances(); // dashed material 필수
        dashLine.renderOrder = 4;
      } else {
        // from 없으면 빈 라인
        dashMaterial = new THREE.LineDashedMaterial({ color: SANCTION_COLOR });
        dashLine = new THREE.Line(new THREE.BufferGeometry(), dashMaterial);
        dashLine.visible = false;
      }

      group.add(dashLine);

      dataRef.current.push({
        xBar1,
        xBar2,
        ring,
        dashLine,
        dashMaterial,
        targetNormal,
        key: `${sanction.from}_${sanction.to}_${sanction.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sanctions, centroidsMap, globeRadius]);

  // 매 프레임: X 마크 펄스 + 링 느린 회전
  useFrame(({ clock }) => {
    if (!visible) return;
    const elapsed = clock.getElapsedTime();

    for (const d of dataRef.current) {
      // X 마크 펄스 (크기 진동)
      const pulse = 1.0 + Math.sin(elapsed * 3.0) * 0.15;
      d.xBar1.scale.setScalar(pulse);
      d.xBar2.scale.setScalar(pulse);

      // X 마크 opacity 진동
      const xOpacity = 0.7 + Math.sin(elapsed * 2.0) * 0.3;
      (d.xBar1.material as THREE.MeshBasicMaterial).opacity = xOpacity;
      (d.xBar2.material as THREE.MeshBasicMaterial).opacity = xOpacity;

      // 링 느린 회전 (법선 축 기준)
      d.ring.rotateZ(0.003);

      // 링 opacity 진동
      (d.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(elapsed * 1.5) * 0.15;
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of dataRef.current) {
        d.dashLine.geometry.dispose();
        d.dashMaterial.dispose();
        (d.xBar1.material as THREE.Material).dispose();
        (d.xBar2.material as THREE.Material).dispose();
        (d.ring.material as THREE.Material).dispose();
      }
      barGeo.dispose();
      ringGeo.dispose();
      xMaterial.dispose();
      ringMaterial.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
