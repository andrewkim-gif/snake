'use client';

/**
 * GlobeAllianceBeam — v23 Phase 5 Task 1
 * 동맹 빛줄기: 2국가 centroid 사이 파란 빛 아크 라인
 * - QuadraticBezierCurve3 기반 TubeGeometry
 * - AdditiveBlending, 파란색(#4488ff), 파동 애니메이션 (uTime 기반 UV offset)
 * - 연결선 위에 작은 빛 파티클 4~6개 흘러감 (InstancedMesh)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';

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
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const ARC_SEGMENTS = 48;
const ARC_HEIGHT_FACTOR = 0.30;  // 30% of centroid distance
const BEAM_COLOR = new THREE.Color(0x4488ff);
const BEAM_HDR = new THREE.Color(0x4488ff).multiplyScalar(2.5); // Bloom 연동
const FLOW_PARTICLES_PER_BEAM = 5;
const PARTICLE_RADIUS = 0.5;
const TUBE_RADIUS = 0.4;
const TUBE_SEGMENTS = 48;
const TUBE_RADIAL = 6;

// ─── GC-prevention temp objects ───

const _tempVec = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();

// ─── Beam shader material ───

const beamVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // 파동 애니메이션: UV.x를 따라 이동하는 밝기 패턴
    float wave = sin((vUv.x - uTime * 0.5) * 12.0) * 0.5 + 0.5;
    float pulse = 0.4 + 0.6 * wave;
    // 중심 밝기 (vUv.y = 0~1, 중심 = 0.5)
    float centerGlow = 1.0 - abs(vUv.y - 0.5) * 2.0;
    centerGlow = pow(centerGlow, 0.5); // 부드러운 가장자리
    float alpha = pulse * centerGlow * uOpacity;
    gl_FragColor = vec4(uColor * (1.0 + wave * 0.5), alpha);
  }
`;

// ─── Helpers ───

/** 두 구면 점 사이의 2차 베지어 커브 포인트 */
function createArcCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
): THREE.QuadraticBezierCurve3 {
  const mid = _tempVec.addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  const control = mid.clone().normalize().multiplyScalar(radius + dist * ARC_HEIGHT_FACTOR);
  return new THREE.QuadraticBezierCurve3(start.clone(), control, end.clone());
}

/** 아크 라인 TubeGeometry + ShaderMaterial 생성 */
function createBeamMesh(curve: THREE.QuadraticBezierCurve3): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
} {
  const geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_RADIAL, false);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: BEAM_HDR.clone() },
      uTime: { value: 0 },
      uOpacity: { value: 0.8 },
    },
    vertexShader: beamVertexShader,
    fragmentShader: beamFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 5;
  return { mesh, material };
}

// ─── Internal beam data ───

interface BeamRenderData {
  curve: THREE.QuadraticBezierCurve3;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  particleMesh: THREE.InstancedMesh;
  key: string;
}

// ─── Component ───

export function GlobeAllianceBeam({
  alliances,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
}: GlobeAllianceBeamProps) {
  const groupRef = useRef<THREE.Group>(null);
  const beamsRef = useRef<BeamRenderData[]>([]);

  // 파티클 공유 geometry + material
  const particleGeo = useMemo(
    () => new THREE.SphereGeometry(PARTICLE_RADIUS, 6, 6),
    [],
  );
  const particleMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: BEAM_HDR.clone(),
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
      group.remove(beam.mesh);
      group.remove(beam.particleMesh);
      beam.mesh.geometry.dispose();
      beam.material.dispose();
      beam.particleMesh.dispose();
    }
    beamsRef.current = [];

    for (const alliance of alliances) {
      const fromC = centroidsMap.get(alliance.from);
      const toC = centroidsMap.get(alliance.to);
      if (!fromC || !toC) continue;

      const startPos = latLngToVector3(fromC[0], fromC[1], globeRadius + 1.0);
      const endPos = latLngToVector3(toC[0], toC[1], globeRadius + 1.0);

      const curve = createArcCurve(startPos, endPos, globeRadius);
      const { mesh, material } = createBeamMesh(curve);

      // 흐르는 빛 파티클 (InstancedMesh)
      const particleMesh = new THREE.InstancedMesh(
        particleGeo,
        particleMat.clone(),
        FLOW_PARTICLES_PER_BEAM,
      );
      particleMesh.renderOrder = 6;

      group.add(mesh);
      group.add(particleMesh);

      beamsRef.current.push({
        curve,
        mesh,
        material,
        particleMesh,
        key: `${alliance.from}_${alliance.to}_${alliance.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alliances, centroidsMap, globeRadius]);

  // 매 프레임: 셰이더 time + 파티클 위치 업데이트
  useFrame(({ clock }) => {
    if (!visible) return;
    const elapsed = clock.getElapsedTime();

    for (const beam of beamsRef.current) {
      // 셰이더 time uniform
      beam.material.uniforms.uTime.value = elapsed;

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
      beam.particleMesh.instanceMatrix.needsUpdate = true;
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const beam of beamsRef.current) {
        beam.mesh.geometry.dispose();
        beam.material.dispose();
        beam.particleMesh.dispose();
      }
      particleGeo.dispose();
      particleMat.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
