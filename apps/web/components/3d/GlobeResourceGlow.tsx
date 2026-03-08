'use client';

/**
 * GlobeResourceGlow — v23 Phase 5 Task 3, v24 Phase 4 통일
 * 자원 채굴 지표 이펙트:
 * - 자원 산출국 centroid 지표면에 빛나는 원 (RingGeometry + ShaderMaterial pulse)
 * - 상승 파티클 (InstancedMesh SphereGeometry(0.15) 6~8개, 위로 상승 후 페이드)
 * - v24: COLORS_3D.resource 색상, SURFACE_ALT.GROUND 고도, RENDER_ORDER 체계 적용
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { COLORS_3D, SURFACE_ALT, RENDER_ORDER } from '@/lib/effect-constants';

// ─── Types ───

export interface ResourceData {
  country: string;       // ISO3
  resourceType: string;  // oil, tech, food, metal 등
  timestamp: number;
}

export interface GlobeResourceGlowProps {
  resources: ResourceData[];
  centroidsMap: Map<string, [number, number]>;
  globeRadius?: number;
  visible?: boolean;
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const RING_INNER = 2.5;
const RING_OUTER = 4.0;
const PARTICLE_COUNT = 7;  // 6~8 중간값
const PARTICLE_RADIUS = 0.25;
const PARTICLE_ASCEND_HEIGHT = 8.0; // 상승 높이
const PARTICLE_CYCLE_SEC = 3.0;     // 한 사이클 (초)
// v24: 색상을 effect-constants에서 가져옴
const RESOURCE_COLOR_HDR = COLORS_3D.resource;

// ─── GC-prevention ───

const _tempVec = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
// v23 Phase 6: GC-prevention — reusable lateral vectors + scale vector
const _lateral1 = new THREE.Vector3();
const _lateral2 = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();

// ─── Glow ring shader ───

const ringVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // 펄스: 밝기 진동
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
    // 링 중심에서 바깥으로 밝기 감소
    float dist = length(vUv - 0.5) * 2.0;
    float glow = 1.0 - smoothstep(0.3, 1.0, dist);
    float alpha = pulse * glow * uOpacity;
    gl_FragColor = vec4(uColor * (1.0 + pulse * 0.5), alpha);
  }
`;

// ─── Internal render data ───

interface ResourceRenderData {
  ring: THREE.Mesh;
  ringMaterial: THREE.ShaderMaterial;
  particles: THREE.InstancedMesh;
  particleMaterial: THREE.MeshBasicMaterial;
  normal: THREE.Vector3; // 표면 법선
  position: THREE.Vector3;
  key: string;
}

// ─── Component ───

export function GlobeResourceGlow({
  resources,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
}: GlobeResourceGlowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dataRef = useRef<ResourceRenderData[]>([]);

  // 공유 geometry
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(RING_INNER, RING_OUTER, 32),
    [],
  );
  const particleGeo = useMemo(
    () => new THREE.SphereGeometry(PARTICLE_RADIUS, 6, 6),
    [],
  );

  // resources 변경 시 재구축
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 기존 정리
    for (const d of dataRef.current) {
      group.remove(d.ring);
      group.remove(d.particles);
      d.ringMaterial.dispose();
      d.particleMaterial.dispose();
      d.particles.dispose();
    }
    dataRef.current = [];

    for (const resource of resources) {
      const centroid = centroidsMap.get(resource.country);
      if (!centroid) continue;

      const pos = latLngToVector3(centroid[0], centroid[1], globeRadius + SURFACE_ALT.GROUND);
      const normal = pos.clone().normalize();

      // 글로우 링
      const ringMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: RESOURCE_COLOR_HDR.clone() },
          uTime: { value: 0 },
          uOpacity: { value: 0.7 },
        },
        vertexShader: ringVertexShader,
        fragmentShader: ringFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });

      const ring = new THREE.Mesh(ringGeo, ringMaterial);
      ring.position.copy(pos);
      _quat.setFromUnitVectors(_up, normal);
      ring.quaternion.copy(_quat);
      ring.rotateX(-Math.PI / 2);
      ring.renderOrder = RENDER_ORDER.SURFACE_GLOW;

      // 상승 파티클 (InstancedMesh)
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: RESOURCE_COLOR_HDR.clone(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });

      const particles = new THREE.InstancedMesh(
        particleGeo,
        particleMaterial,
        PARTICLE_COUNT,
      );
      particles.count = 0; // ★ 초기 count=0 (origin 검은박스 방지)
      particles.renderOrder = RENDER_ORDER.PARTICLES;

      group.add(ring);
      group.add(particles);

      dataRef.current.push({
        ring,
        ringMaterial,
        particles,
        particleMaterial,
        normal,
        position: pos.clone(),
        key: `${resource.country}_${resource.resourceType}_${resource.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, centroidsMap, globeRadius]);

  // 매 프레임: 셰이더 time + 파티클 상승 애니메이션
  useFrame(({ clock }) => {
    if (!visible) return;
    const elapsed = clock.getElapsedTime();

    for (const d of dataRef.current) {
      // 링 셰이더 time
      d.ringMaterial.uniforms.uTime.value = elapsed;

      // 링 느린 회전
      d.ring.rotateZ(0.002);

      // 파티클 상승: 각 파티클은 시차(phase offset)를 두고 순환
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const phase = i / PARTICLE_COUNT;
        const t = ((elapsed / PARTICLE_CYCLE_SEC) + phase) % 1.0;

        // 상승 위치: normal 방향으로 올라감
        const height = t * PARTICLE_ASCEND_HEIGHT;
        _tempVec.copy(d.position).addScaledVector(d.normal, height);

        // 약간의 수평 오프셋 (나선형)
        const angle = t * Math.PI * 4 + phase * Math.PI * 2;
        const lateralOffset = Math.sin(t * Math.PI) * 1.2; // 중간이 가장 넓음
        _lateral1.crossVectors(d.normal, _up).normalize();
        if (_lateral1.lengthSq() < 0.01) _lateral1.set(1, 0, 0); // fallback
        _lateral2.crossVectors(d.normal, _lateral1).normalize();
        _tempVec.addScaledVector(_lateral1, Math.cos(angle) * lateralOffset);
        _tempVec.addScaledVector(_lateral2, Math.sin(angle) * lateralOffset);

        // 크기: 위로 갈수록 작아짐
        const scale = 1.0 - t * 0.7;

        _tempMatrix.makeTranslation(_tempVec.x, _tempVec.y, _tempVec.z);
        _scaleVec.set(scale, scale, scale);
        _tempMatrix.scale(_scaleVec);

        d.particles.setMatrixAt(i, _tempMatrix);

        // 색상: opacity 페이드 (위로 갈수록 투명)
        d.particleMaterial.opacity = 0.8 * (1.0 - t * 0.8);
      }
      d.particles.count = PARTICLE_COUNT; // ★ count 복원
      d.particles.instanceMatrix.needsUpdate = true;
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of dataRef.current) {
        d.ringMaterial.dispose();
        d.particleMaterial.dispose();
        d.particles.dispose();
      }
      ringGeo.dispose();
      particleGeo.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
