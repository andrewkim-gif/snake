'use client';

/**
 * GlobeSanctionBarrier — v24 Phase 6 최적화
 * 제재 차단선 이펙트:
 * - 대상국 centroid에 빨간 X 마크 (InstancedMesh 2개로 통합 — draw call 감소)
 * - 제재 발동국→대상국 사이 빨간 점선 아크 라인 (LineDashedMaterial)
 * - 주변 빨간 점선 원 (InstancedMesh 1개로 통합)
 *
 * v24 Phase 6 변경:
 * - 개별 Mesh → InstancedMesh 전환 (X바 2개 + 링 1개)
 * - Material clone 제거 → 공유 material (전체 동시 펄스, 시각적으로 적합)
 * - 3-tier distance LOD 지원 (far: 아크만, mid: 아이콘 표시, close: 풀)
 * - prefers-reduced-motion: 펄스/회전 비활성화
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcPoints } from '@/lib/effect-utils';
import {
  ARC_HEIGHT, COLORS_3D, COLORS_BASE, RENDER_ORDER, REDUCED_MOTION,
} from '@/lib/effect-constants';
import type { DistanceLODConfig } from '@/hooks/useGlobeLOD';

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
  /** v24 Phase 6: 카메라 거리 LOD 설정 */
  distanceLOD?: DistanceLODConfig;
  /** v24 Phase 6: prefers-reduced-motion */
  reducedMotion?: boolean;
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const SANCTION_ARC_SEGMENTS = 48;
const X_BAR_LENGTH = 3.0;
const X_BAR_THICKNESS = 0.4;
const RING_INNER = 4.0;
const RING_OUTER = 4.5;
const MAX_SANCTIONS = 30; // InstancedMesh 최대 인스턴스 수

// ─── GC-prevention ───

const _tempVec = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _rotMatrix = new THREE.Matrix4();
const _scaleMatrix = new THREE.Matrix4();

// ─── Internal render data (아크 라인용 — InstancedMesh 대상 아님) ───

interface SanctionArcData {
  dashLine: THREE.Line;
  dashMaterial: THREE.LineDashedMaterial;
  key: string;
}

// ─── Component ───

export function GlobeSanctionBarrier({
  sanctions,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
  distanceLOD,
  reducedMotion = false,
}: GlobeSanctionBarrierProps) {
  const groupRef = useRef<THREE.Group>(null);
  const arcDataRef = useRef<SanctionArcData[]>([]);

  // InstancedMesh refs
  const xBar1Ref = useRef<THREE.InstancedMesh>(null);
  const xBar2Ref = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);

  // 타겟 법선 저장 (링 회전용)
  const normalsRef = useRef<THREE.Vector3[]>([]);
  const instanceCountRef = useRef(0);

  // 공유 geometry
  const barGeo = useMemo(
    () => new THREE.PlaneGeometry(X_BAR_LENGTH, X_BAR_THICKNESS),
    [],
  );
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(RING_INNER, RING_OUTER, 32),
    [],
  );

  // 공유 material (clone 없이 단일 인스턴스 사용)
  const xMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: COLORS_3D.sanction.clone(),
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
      color: COLORS_BASE.sanction.clone(),
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

    // 기존 아크 라인 정리
    for (const d of arcDataRef.current) {
      group.remove(d.dashLine);
      d.dashLine.geometry.dispose();
      d.dashMaterial.dispose();
    }
    arcDataRef.current = [];
    normalsRef.current = [];

    const count = Math.min(sanctions.length, MAX_SANCTIONS);
    instanceCountRef.current = count;

    // InstancedMesh 인스턴스 매트릭스 설정
    let idx = 0;
    for (const sanction of sanctions) {
      if (idx >= MAX_SANCTIONS) break;

      const toC = centroidsMap.get(sanction.to);
      if (!toC) continue;

      const fromC = centroidsMap.get(sanction.from);
      const targetPos = latLngToVector3(toC[0], toC[1], globeRadius + 1.5);
      const targetNormal = targetPos.clone().normalize();
      normalsRef.current.push(targetNormal);

      // 기저 회전: _up → targetNormal
      _quat.setFromUnitVectors(_up, targetNormal);

      // X Bar 1: +45도 회전
      _matrix.makeRotationFromQuaternion(_quat);
      _rotMatrix.makeRotationX(-Math.PI / 2);
      _matrix.multiply(_rotMatrix);
      _rotMatrix.makeRotationZ(Math.PI / 4);
      _matrix.multiply(_rotMatrix);
      _matrix.setPosition(targetPos);
      if (xBar1Ref.current) xBar1Ref.current.setMatrixAt(idx, _matrix);

      // X Bar 2: -45도 회전
      _matrix.makeRotationFromQuaternion(_quat);
      _rotMatrix.makeRotationX(-Math.PI / 2);
      _matrix.multiply(_rotMatrix);
      _rotMatrix.makeRotationZ(-Math.PI / 4);
      _matrix.multiply(_rotMatrix);
      _matrix.setPosition(targetPos);
      if (xBar2Ref.current) xBar2Ref.current.setMatrixAt(idx, _matrix);

      // Ring
      _matrix.makeRotationFromQuaternion(_quat);
      _rotMatrix.makeRotationX(-Math.PI / 2);
      _matrix.multiply(_rotMatrix);
      _matrix.setPosition(targetPos);
      if (ringRef.current) ringRef.current.setMatrixAt(idx, _matrix);

      // 점선 아크 라인 (발동국→대상국) — 아크는 InstancedMesh 불가
      if (fromC) {
        const startPos = latLngToVector3(fromC[0], fromC[1], globeRadius + 1.0);
        const endPos = latLngToVector3(toC[0], toC[1], globeRadius + 1.0);
        const points = createArcPoints(startPos, endPos, globeRadius, ARC_HEIGHT.sanction, SANCTION_ARC_SEGMENTS);

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const dashMaterial = new THREE.LineDashedMaterial({
          color: COLORS_BASE.sanction.clone(),
          dashSize: 2.0,
          gapSize: 1.5,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        });

        const dashLine = new THREE.Line(lineGeo, dashMaterial);
        dashLine.computeLineDistances();
        dashLine.renderOrder = RENDER_ORDER.ARC_SANCTION;
        group.add(dashLine);

        arcDataRef.current.push({
          dashLine,
          dashMaterial,
          key: `${sanction.from}_${sanction.to}_${sanction.timestamp}`,
        });
      }

      idx++;
    }

    // InstancedMesh count + needsUpdate
    if (xBar1Ref.current) {
      xBar1Ref.current.count = idx;
      xBar1Ref.current.instanceMatrix.needsUpdate = true;
    }
    if (xBar2Ref.current) {
      xBar2Ref.current.count = idx;
      xBar2Ref.current.instanceMatrix.needsUpdate = true;
    }
    if (ringRef.current) {
      ringRef.current.count = idx;
      ringRef.current.instanceMatrix.needsUpdate = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sanctions, centroidsMap, globeRadius]);

  // 매 프레임: X 마크 펄스 + 링 회전 (LOD + reduced motion 반영)
  useFrame(({ clock }) => {
    if (!visible) return;

    const elapsed = clock.getElapsedTime();
    const showIcons = distanceLOD?.showIcons ?? true;

    // X 마크: 스케일 펄스 + opacity 진동
    if (reducedMotion) {
      // 정적 표시
      xMaterial.opacity = REDUCED_MOTION.staticOpacity;
      ringMaterial.opacity = REDUCED_MOTION.staticOpacity * 0.6;
    } else {
      const pulse = 1.0 + Math.sin(elapsed * 3.0) * 0.15;
      const xOpacity = 0.7 + Math.sin(elapsed * 2.0) * 0.3;
      xMaterial.opacity = xOpacity;

      // 스케일 펄스는 InstancedMesh에서 전체 그룹에 적용
      if (xBar1Ref.current) xBar1Ref.current.scale.setScalar(pulse);
      if (xBar2Ref.current) xBar2Ref.current.scale.setScalar(pulse);

      // 링 opacity 진동
      ringMaterial.opacity = 0.3 + Math.sin(elapsed * 1.5) * 0.15;

      // 링 회전: InstancedMesh 전체에 느린 Z 회전 적용
      if (ringRef.current) {
        ringRef.current.rotation.z += 0.003;
      }
    }

    // LOD: far에서 아이콘 숨김
    if (xBar1Ref.current) xBar1Ref.current.visible = showIcons;
    if (xBar2Ref.current) xBar2Ref.current.visible = showIcons;
    if (ringRef.current) ringRef.current.visible = showIcons;
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of arcDataRef.current) {
        d.dashLine.geometry.dispose();
        d.dashMaterial.dispose();
      }
      barGeo.dispose();
      ringGeo.dispose();
      xMaterial.dispose();
      ringMaterial.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group ref={groupRef} visible={visible}>
      {/* InstancedMesh: X 바 1 (+45도) */}
      <instancedMesh
        ref={xBar1Ref}
        args={[barGeo, xMaterial, MAX_SANCTIONS]}
        renderOrder={RENDER_ORDER.SANCTION_XMARK}
        frustumCulled={false}
      />
      {/* InstancedMesh: X 바 2 (-45도) */}
      <instancedMesh
        ref={xBar2Ref}
        args={[barGeo, xMaterial, MAX_SANCTIONS]}
        renderOrder={RENDER_ORDER.SANCTION_XMARK}
        frustumCulled={false}
      />
      {/* InstancedMesh: 점선 원 링 */}
      <instancedMesh
        ref={ringRef}
        args={[ringGeo, ringMaterial, MAX_SANCTIONS]}
        renderOrder={RENDER_ORDER.SURFACE_RING}
        frustumCulled={false}
      />
    </group>
  );
}
