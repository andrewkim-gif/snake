'use client';

/**
 * GlobeAllianceBeam — v23 Phase 5 Task 1 (v2: Line-based, no TubeGeometry)
 * 동맹 빛줄기: 2국가 centroid 사이 파란 빛 아크 라인
 * - QuadraticBezierCurve3 기반 BufferGeometry Line (TubeGeometry 제거 → 검은박스 해결)
 * - AdditiveBlending, 파란색(#4488ff)
 * - 연결선 위에 작은 빛 파티클 4~6개 흘러감 (InstancedMesh)
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcCurve } from '@/lib/effect-utils';
import { ARC_HEIGHT, COLORS_3D, RENDER_ORDER } from '@/lib/effect-constants';
import type { DistanceLODConfig } from '@/hooks/useGlobeLOD';
import { useAdaptiveQualityContext } from '@/hooks/useAdaptiveQuality';

// ─── Types ───

export interface AllianceData {
  from: string;   // ISO3
  to: string;     // ISO3
  timestamp: number;
}

export interface GlobeAllianceBeamProps {
  alliances: AllianceData[];
  centroidsMap: Map<string, [number, number]>;
  globeRadius?: number;
  visible?: boolean;
  /** v33 Phase 4: 카메라 거리 LOD 설정 */
  distanceLOD?: DistanceLODConfig;
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const FLOW_PARTICLES_PER_BEAM = 5;
const PARTICLE_RADIUS = 0.5;
const LINE_POINTS = 64; // 커브 샘플링 포인트 수

// ─── GC-prevention temp objects ───

const _tempVec = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();

// ─── Helpers ───

/** 아크 라인 BufferGeometry + LineBasicMaterial 생성 (TubeGeometry 대체) */
function createBeamLine(curve: THREE.QuadraticBezierCurve3): {
  line: THREE.Line;
  material: THREE.LineBasicMaterial;
} {
  const points = curve.getPoints(LINE_POINTS);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: COLORS_3D.alliance.clone(),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    linewidth: 1, // WebGL 제한: 항상 1px, 파티클로 두께감 보완
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = RENDER_ORDER.ARC_ALLIANCE;
  return { line, material };
}

// ─── Internal beam data ───

interface BeamRenderData {
  curve: THREE.QuadraticBezierCurve3;
  line: THREE.Line;
  lineMaterial: THREE.LineBasicMaterial;
  particleMesh: THREE.InstancedMesh;
  key: string;
}

// ─── Component ───

export function GlobeAllianceBeam({
  alliances,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
  distanceLOD,
}: GlobeAllianceBeamProps) {
  const groupRef = useRef<THREE.Group>(null);
  const beamsRef = useRef<BeamRenderData[]>([]);
  // v33 Phase 4: far LOD에서 프레임 스킵용 카운터
  const frameCountRef = useRef(0);
  // v33 Phase 5: AdaptiveQuality context
  const qualityRef = useAdaptiveQualityContext();

  // 파티클 공유 geometry + material
  const particleGeo = useMemo(
    () => new THREE.SphereGeometry(PARTICLE_RADIUS, 6, 6),
    [],
  );
  const particleMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: COLORS_3D.alliance.clone(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    [],
  );

  // alliances 변경 시 빔 재구축
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 기존 정리
    for (const beam of beamsRef.current) {
      group.remove(beam.line);
      group.remove(beam.particleMesh);
      beam.line.geometry.dispose();
      beam.lineMaterial.dispose();
      // v33 Phase 4: clone된 particle material도 dispose
      if (beam.particleMesh.material) {
        (beam.particleMesh.material as THREE.Material).dispose();
      }
      beam.particleMesh.dispose();
    }
    beamsRef.current = [];

    for (const alliance of alliances) {
      const fromC = centroidsMap.get(alliance.from);
      const toC = centroidsMap.get(alliance.to);
      if (!fromC || !toC) continue;

      const startPos = latLngToVector3(fromC[0], fromC[1], globeRadius + 1.0);
      const endPos = latLngToVector3(toC[0], toC[1], globeRadius + 1.0);

      const curve = createArcCurve(startPos, endPos, globeRadius, ARC_HEIGHT.alliance);
      const { line, material: lineMaterial } = createBeamLine(curve);

      // 흐르는 빛 파티클 (InstancedMesh) — 라인 두께감 보완
      const particleMesh = new THREE.InstancedMesh(
        particleGeo,
        particleMat.clone(),
        FLOW_PARTICLES_PER_BEAM,
      );
      particleMesh.count = 0; // ★ 초기 count=0 (origin 검은박스 방지)
      particleMesh.renderOrder = RENDER_ORDER.PARTICLES;

      group.add(line);
      group.add(particleMesh);

      beamsRef.current.push({
        curve,
        line,
        lineMaterial,
        particleMesh,
        key: `${alliance.from}_${alliance.to}_${alliance.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alliances, centroidsMap, globeRadius]);

  // 매 프레임: 라인 opacity 파동 + 파티클 위치 업데이트
  useFrame(({ clock }) => {
    if (!visible) return;
    // v33 Phase 4: 동맹 빔이 없으면 스킵
    if (beamsRef.current.length === 0) return;
    // v33 Phase 4+5: far LOD + AdaptiveQuality 기반 프레임 스킵
    frameCountRef.current++;
    const distSkip = distanceLOD?.distanceTier === 'far' ? 3 : 1;
    const skip = Math.max(qualityRef.current.effectFrameSkip, distSkip);
    if (skip > 1 && frameCountRef.current % skip !== 0) return;
    const elapsed = clock.getElapsedTime();

    // v33 Phase 4: far LOD에서 파티클 스킵
    const showParticles = distanceLOD?.showParticles ?? true;

    for (const beam of beamsRef.current) {
      // 라인 opacity 파동 애니메이션
      const pulse = 0.5 + 0.3 * Math.sin(elapsed * 2.0);
      beam.lineMaterial.opacity = pulse;

      // v33 Phase 4: far LOD에서 파티클 숨김
      if (!showParticles) {
        beam.particleMesh.count = 0;
        continue;
      }

      // 파티클 위치: 곡선을 따라 등간격 이동
      for (let i = 0; i < FLOW_PARTICLES_PER_BEAM; i++) {
        const baseT = i / FLOW_PARTICLES_PER_BEAM;
        const t = (baseT + elapsed * 0.15) % 1.0; // 천천히 이동
        beam.curve.getPointAt(t, _tempVec);
        _tempMatrix.makeTranslation(_tempVec.x, _tempVec.y, _tempVec.z);

        // 크기 변동: 중앙이 크고 끝이 작음
        const sizeT = Math.sin(t * Math.PI); // 0→1→0
        const scale = 0.5 + sizeT * 0.8;
        _tempMatrix.scale(_tempVec.set(scale, scale, scale));

        beam.particleMesh.setMatrixAt(i, _tempMatrix);
      }
      beam.particleMesh.count = FLOW_PARTICLES_PER_BEAM; // ★ count 복원
      beam.particleMesh.instanceMatrix.needsUpdate = true;
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const beam of beamsRef.current) {
        beam.line.geometry.dispose();
        beam.lineMaterial.dispose();
        // v33 Phase 4: clone된 particle material도 dispose
        if (beam.particleMesh.material) {
          (beam.particleMesh.material as THREE.Material).dispose();
        }
        beam.particleMesh.dispose();
      }
      particleGeo.dispose();
      particleMat.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
