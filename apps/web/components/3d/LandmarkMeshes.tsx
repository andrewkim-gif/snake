'use client';

/**
 * LandmarkMeshes — MC 복셀 스타일 3D 랜드마크 레이어 (v22 Phase 1 태양 라이팅)
 *
 * 구현:
 *   - Archetype별 InstancedMesh (사용 중인 Archetype 수만큼 draw calls)
 *   - VoxelBox 데이터 구동 geometry (landmark-geometries.ts) + 아틀라스 UV 리매핑
 *   - 커스텀 ShaderMaterial (태양 방향 인식 + 야간 emissive 창문 불빛)
 *   - 면별 밝기 vertex color (top=1.0, bottom=0.5, sides=0.6/0.8)
 *   - 구면 정렬: Quaternion.setFromUnitVectors로 지구 표면 수직 배치
 *   - Backface culling: dot(normal, camDir) < 0.05 → hide, fade 0.05~0.35
 *   - renderOrder = 95 (라벨=100 아래)
 *   - GC 방지: 모듈 스코프 temp 객체 사전 할당
 *   - uSunDir uniform: EarthSphere와 동일한 UTC 기반 태양 방향
 *   - 야간 emissive: NdotL < 0 → 창문 불빛 (warm glow)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { LandmarkArchetype } from '@/lib/landmark-data';
import type { Landmark } from '@/lib/landmark-data';
import { createArchetypeGeometry, createArchetypeEdgeGeometry, disposeGeometryCache } from '@/lib/landmark-geometries';
import { getBlockAtlasTexture } from '@/lib/mc-texture-atlas';

// ─── Constants ───

const SURFACE_ALT = 0.3;
const BACKFACE_THRESHOLD = 0.05;
const BACKFACE_FADE_RANGE = 0.3;
const LANDMARK_SCALE = 1.5; // 전체 스케일 조정 (지구 반경 100 대비 ~5-8 unit 높이)

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

// ─── Types ───

export interface LandmarkMeshesProps {
  landmarks: Landmark[];
  globeRadius?: number;
}

// ─── Archetype 그룹핑 ───

interface ArchetypeGroup {
  archetype: LandmarkArchetype;
  landmarks: Landmark[];
  positions: THREE.Vector3[];
  normals: THREE.Vector3[];
}

// ─── Landmark Sun Lighting Shaders (v22 Phase 1) ───

const landmarkVertexShader = /* glsl */ `
  attribute vec3 color; // vertexColors (면별 밝기: top=1.0, bottom=0.5, sides=0.6/0.8)
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = color;
    // InstancedMesh: instanceMatrix * vec4(normal, 0.0) 로 월드 노멀 계산
    vWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const landmarkFragmentShader = /* glsl */ `
  uniform sampler2D uMap;   // atlas texture (sRGB)
  uniform vec3 uSunDir;     // 태양 방향 (정규화)
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vColor;      // 면별 밝기 (AO)

  void main() {
    vec3 N = normalize(vWorldNormal);
    float NdotL = dot(N, uSunDir);

    // 텍스처 색상 (sRGB → 선형으로 근사 변환하여 라이팅 계산)
    vec4 texColor = texture2D(uMap, vUv);
    vec3 albedo = pow(texColor.rgb, vec3(2.2));

    // 디퓨즈 라이팅 — 밝은 쪽 0.9, 어두운 쪽 ambient 0.25
    float diffuse = max(NdotL, 0.0) * 0.65 + 0.25;

    // 면별 AO (vertex color) — 부드럽게 적용 (0.5~1.0 → 0.7~1.0)
    float ao = mix(0.7, 1.0, vColor.r);

    // 최종 라이팅: 알베도 × 디퓨즈 × AO
    vec3 color = albedo * diffuse * ao;

    // 하늘빛 간접광 (태양 반대쪽에 은은한 파란 반사)
    float skyFactor = max(-NdotL, 0.0) * 0.08;
    color += albedo * vec3(0.5, 0.6, 0.9) * skyFactor;

    // 야간 emissive: 밤면에서 창문 불빛 (따뜻한 글로우)
    float nightFactor = smoothstep(0.1, -0.3, NdotL);
    float windowLight = texColor.r * 0.25;
    vec3 emissive = vec3(1.0, 0.85, 0.5) * windowLight * nightFactor;
    color += emissive;

    // 선형 → sRGB 변환 (감마 보정)
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, texColor.a);
  }
`;

// ─── 머티리얼 (커스텀 ShaderMaterial: atlas + vertexColors + 태양 라이팅) ───

let sharedMaterial: THREE.ShaderMaterial | null = null;

function getSharedMaterial(): THREE.ShaderMaterial {
  if (sharedMaterial) return sharedMaterial;
  const atlas = getBlockAtlasTexture();
  sharedMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: atlas },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader: landmarkVertexShader,
    fragmentShader: landmarkFragmentShader,
    transparent: true,
  });
  return sharedMaterial;
}


// ─── ArchetypeInstancedMesh 서브 컴포넌트 ───

interface ArchetypeInstancedMeshProps {
  group: ArchetypeGroup;
  globeRadius: number;
  camera: THREE.Camera;
}

function ArchetypeInstancedMesh({ group, globeRadius, camera }: ArchetypeInstancedMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const edgeRef = useRef<THREE.LineSegments>(null!);

  const geometry = useMemo(() => {
    return createArchetypeGeometry(group.archetype);
  }, [group.archetype]);

  // MC 외곽선용 InstancedBufferGeometry (EdgesGeometry 기반)
  const edgeGeometry = useMemo(() => {
    const baseEdge = createArchetypeEdgeGeometry(group.archetype);
    const ibg = new THREE.InstancedBufferGeometry();
    ibg.index = baseEdge.index;
    ibg.attributes.position = baseEdge.attributes.position;
    // 인스턴스당 변환 행렬: mat4 = 4개 vec4 어트리뷰트 (column-major)
    const maxCount = group.landmarks.length;
    ibg.setAttribute('aInstanceMatrix0', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 4), 4, false, 1));
    ibg.setAttribute('aInstanceMatrix1', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 4), 4, false, 1));
    ibg.setAttribute('aInstanceMatrix2', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 4), 4, false, 1));
    ibg.setAttribute('aInstanceMatrix3', new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 4), 4, false, 1));
    ibg.instanceCount = 0;
    return ibg;
  }, [group.archetype, group.landmarks.length]);

  // 외곽선용 셰이더 머티리얼 (인스턴스 행렬 지원)
  const edgeMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      attribute vec4 aInstanceMatrix0;
      attribute vec4 aInstanceMatrix1;
      attribute vec4 aInstanceMatrix2;
      attribute vec4 aInstanceMatrix3;
      void main() {
        mat4 inst = mat4(aInstanceMatrix0, aInstanceMatrix1, aInstanceMatrix2, aInstanceMatrix3);
        gl_Position = projectionMatrix * modelViewMatrix * inst * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      void main() {
        gl_FragColor = vec4(0.08, 0.08, 0.08, 0.5);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  }), []);

  // 공유 아틀라스 머티리얼 (vertexColors로 면별 밝기 적용)
  const material = useMemo(() => getSharedMaterial(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    _camDir.copy(camera.position).normalize();

    let visibleCount = 0;

    // 엣지 어트리뷰트 배열 참조
    const m0 = edgeGeometry.getAttribute('aInstanceMatrix0') as THREE.InstancedBufferAttribute;
    const m1 = edgeGeometry.getAttribute('aInstanceMatrix1') as THREE.InstancedBufferAttribute;
    const m2 = edgeGeometry.getAttribute('aInstanceMatrix2') as THREE.InstancedBufferAttribute;
    const m3 = edgeGeometry.getAttribute('aInstanceMatrix3') as THREE.InstancedBufferAttribute;

    for (let i = 0; i < group.landmarks.length; i++) {
      const pos = group.positions[i];
      const normal = group.normals[i];

      // Backface culling
      const dot = normal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) continue;

      // Alpha fade (backface 경계)
      const fade = THREE.MathUtils.clamp(
        (dot - BACKFACE_THRESHOLD) / BACKFACE_FADE_RANGE, 0, 1,
      );

      // 구면 정렬: Y축(위)를 법선 방향으로 회전
      _quat.setFromUnitVectors(_up, normal);

      _obj.position.copy(pos);
      _obj.quaternion.copy(_quat);
      const s = LANDMARK_SCALE * fade;
      _obj.scale.set(s, s, s);
      _obj.updateMatrix();
      mesh.setMatrixAt(visibleCount, _obj.matrix);

      // 엣지 인스턴스 행렬도 동기화
      const e = _obj.matrix.elements;
      const j = visibleCount;
      m0.setXYZW(j, e[0], e[1], e[2], e[3]);
      m1.setXYZW(j, e[4], e[5], e[6], e[7]);
      m2.setXYZW(j, e[8], e[9], e[10], e[11]);
      m3.setXYZW(j, e[12], e[13], e[14], e[15]);

      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;

    // 엣지 인스턴스 카운트 업데이트
    edgeGeometry.instanceCount = visibleCount;
    m0.needsUpdate = true;
    m1.needsUpdate = true;
    m2.needsUpdate = true;
    m3.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, group.landmarks.length]}
        frustumCulled={false}
        renderOrder={95}
        castShadow={false}
        receiveShadow={false}
      />
      {/* MC 블록 외곽선 */}
      <lineSegments
        ref={edgeRef}
        geometry={edgeGeometry}
        material={edgeMaterial}
        frustumCulled={false}
        renderOrder={96}
      />
    </>
  );
}

// ─── 메인 컴포넌트 ───

export function LandmarkMeshes({
  landmarks,
  globeRadius = 100,
}: LandmarkMeshesProps) {
  const { camera } = useThree();

  // Archetype별 그룹핑 + 3D 좌표 계산
  const archetypeGroups = useMemo(() => {
    const groupMap = new Map<LandmarkArchetype, ArchetypeGroup>();
    const r = globeRadius + SURFACE_ALT;

    for (const lm of landmarks) {
      let group = groupMap.get(lm.archetype);
      if (!group) {
        group = {
          archetype: lm.archetype,
          landmarks: [],
          positions: [],
          normals: [],
        };
        groupMap.set(lm.archetype, group);
      }

      const pos = latLngToVector3(lm.lat, lm.lng, r);
      const normal = pos.clone().normalize();
      group.landmarks.push(lm);
      group.positions.push(pos);
      group.normals.push(normal);
    }

    return Array.from(groupMap.values());
  }, [landmarks, globeRadius]);

  // v22: useFrame에서 태양 방향 갱신 (UTC 기반, EarthSphere와 동일 계산)
  // sharedMaterial 하나를 모든 ArchetypeInstancedMesh가 공유 → uniform 한 번만 갱신
  useFrame(() => {
    if (!sharedMaterial) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    // 태양 적위 (지축 23.44도 기울기)
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    // 시간각: UTC 12시 = 본초자오선 정오
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const sx = Math.cos(decRad) * Math.cos(ha);
    const sy = Math.sin(decRad);
    const sz = Math.cos(decRad) * Math.sin(ha);
    sharedMaterial.uniforms.uSunDir.value.set(sx, sy, sz).normalize();
  });

  // 언마운트 시 geometry cache + 공유 머티리얼 정리
  useEffect(() => {
    return () => {
      disposeGeometryCache();
      if (sharedMaterial) {
        sharedMaterial.dispose();
        sharedMaterial = null;
      }
    };
  }, []);

  return (
    <group>
      {archetypeGroups.map(group => (
        <ArchetypeInstancedMesh
          key={group.archetype}
          group={group}
          globeRadius={globeRadius}
          camera={camera}
        />
      ))}
    </group>
  );
}
