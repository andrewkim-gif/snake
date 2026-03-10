'use client';

/**
 * GlobeResourceGlow — v24 Phase 6 최적화
 * 자원 채굴 지표 이펙트:
 * - 자원 산출국 centroid 지표면에 빛나는 원 (RingGeometry + ShaderMaterial pulse)
 * - 상승 파티클 (InstancedMesh SphereGeometry(0.15) 6~8개, 위로 상승 후 페이드)
 *
 * v24 Phase 6 변경:
 * - ShaderMaterial: per-event uTime은 필요하므로 material 풀링 대신 uniform 기반 유지
 *   (architecture doc: "Acceptable. ShaderMaterial has per-event uniform state.")
 * - particleMaterial: 공유 material 사용 (color.clone() 대신 단일 인스턴스)
 * - 3-tier distance LOD 지원 (far: 링만, mid: 파티클 50%, close: 풀)
 * - prefers-reduced-motion: 펄스/회전 비활성화, 정적 글로우
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { COLORS_3D, SURFACE_ALT, RENDER_ORDER, REDUCED_MOTION } from '@/lib/effect-constants';
import type { DistanceLODConfig } from '@/hooks/useGlobeLOD';
import { useAdaptiveQualityContext } from '@/hooks/useAdaptiveQuality';

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
  /** v24 Phase 6: 카메라 거리 LOD 설정 */
  distanceLOD?: DistanceLODConfig;
  /** v24 Phase 6: prefers-reduced-motion */
  reducedMotion?: boolean;
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
  uniform float uReducedMotion;
  varying vec2 vUv;
  void main() {
    // 펄스: 밝기 진동 (reduced motion이면 정적)
    float pulse = uReducedMotion > 0.5 ? 0.7 : 0.5 + 0.5 * sin(uTime * 3.0);
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
  distanceLOD,
  reducedMotion = false,
}: GlobeResourceGlowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dataRef = useRef<ResourceRenderData[]>([]);
  // v33 Phase 4: far LOD에서 프레임 스킵용 카운터
  const frameCountRef = useRef(0);
  // v33 Phase 5: AdaptiveQuality context
  const qualityRef = useAdaptiveQualityContext();

  // 공유 geometry
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(RING_INNER, RING_OUTER, 32),
    [],
  );
  const particleGeo = useMemo(
    () => new THREE.SphereGeometry(PARTICLE_RADIUS, 6, 6),
    [],
  );

  // v24 Phase 6: 공유 particle material (clone 제거)
  const sharedParticleMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: RESOURCE_COLOR_HDR.clone(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
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
      d.particles.dispose();
    }
    dataRef.current = [];

    for (const resource of resources) {
      const centroid = centroidsMap.get(resource.country);
      if (!centroid) continue;

      const pos = latLngToVector3(centroid[0], centroid[1], globeRadius + SURFACE_ALT.GROUND);
      const normal = pos.clone().normalize();

      // 글로우 링 (per-event ShaderMaterial — uTime phase offset 필요)
      const ringMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: RESOURCE_COLOR_HDR.clone() },
          uTime: { value: 0 },
          uOpacity: { value: 0.7 },
          uReducedMotion: { value: reducedMotion ? 1.0 : 0.0 },
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

      // 상승 파티클 (InstancedMesh — 공유 material 사용)
      const particles = new THREE.InstancedMesh(
        particleGeo,
        sharedParticleMaterial,
        PARTICLE_COUNT,
      );
      particles.count = 0; // 초기 count=0 (origin 검은박스 방지)
      particles.renderOrder = RENDER_ORDER.PARTICLES;

      group.add(ring);
      group.add(particles);

      dataRef.current.push({
        ring,
        ringMaterial,
        particles,
        normal,
        position: pos.clone(),
        key: `${resource.country}_${resource.resourceType}_${resource.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, centroidsMap, globeRadius]);

  // 매 프레임: 셰이더 time + 파티클 상승 (LOD + reduced motion 반영)
  useFrame(({ clock }) => {
    if (!visible) return;
    // v33 Phase 4: 자원 데이터가 없으면 스킵
    if (dataRef.current.length === 0) return;
    // v33 Phase 4+5: far LOD + AdaptiveQuality 기반 프레임 스킵
    frameCountRef.current++;
    const distSkip = distanceLOD?.distanceTier === 'far' ? 3 : 1;
    const skip = Math.max(qualityRef.current.effectFrameSkip, distSkip);
    if (skip > 1 && frameCountRef.current % skip !== 0) return;
    const elapsed = clock.getElapsedTime();

    // LOD 기반 파티클 표시/숨김 + 배율
    const showParticles = distanceLOD?.showParticles ?? true;
    const lodParticleMultiplier = distanceLOD?.particleMultiplier ?? 1.0;
    const effectiveParticleCount = showParticles
      ? Math.max(1, Math.floor(PARTICLE_COUNT * lodParticleMultiplier))
      : 0;

    for (const d of dataRef.current) {
      // 링 셰이더 time + reduced motion uniform 업데이트
      d.ringMaterial.uniforms.uTime.value = elapsed;
      d.ringMaterial.uniforms.uReducedMotion.value = reducedMotion ? 1.0 : 0.0;

      // 링 느린 회전 (reduced motion이면 비활성화)
      if (!reducedMotion) {
        d.ring.rotateZ(0.002);
      }

      // reduced motion이면 파티클 숨김
      if (reducedMotion || !showParticles) {
        d.particles.count = 0;
        continue;
      }

      // 파티클 상승: 각 파티클은 시차(phase offset)를 두고 순환
      for (let i = 0; i < effectiveParticleCount; i++) {
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
      }

      // opacity 페이드 (공유 material이므로 마지막 파티클 기준)
      sharedParticleMaterial.opacity = 0.8;
      d.particles.count = effectiveParticleCount;
      d.particles.instanceMatrix.needsUpdate = true;
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of dataRef.current) {
        d.ringMaterial.dispose();
        d.particles.dispose();
      }
      ringGeo.dispose();
      particleGeo.dispose();
      sharedParticleMaterial.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
