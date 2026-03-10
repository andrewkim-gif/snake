'use client';

/**
 * LandmarkMeshes — MC 복셀 스타일 3D 랜드마크 레이어 (v22 태양 라이팅 + v29 바이옴 리얼리즘)
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
 *
 * v29 Phase 2 추가:
 *   - per-instance aBiomeIdx (float, 0-5) + aAgeSeed (float, 0-1) InstancedBufferAttribute
 *   - 바이옴 틴트 (6색 uniform 배열, 알베도와 0.25 소프트 믹스)
 *   - 풍화 노이즈 (hash21 기반 per-pixel 0.12 강도)
 *   - 환경 안개 (바이옴별 fog 색상, 카메라 거리 100~350 범위 0.2 블렌딩)
 *
 * v29 Phase 4 추가:
 *   - Tier 기반 스케일 차등화 (TIER_1=1.8, TIER_2=1.4, TIER_3=1.0)
 *   - iso3 해시 기반 결정론적 Y축 회전 (인스턴스별 방향 변형)
 *   - ±10% 스케일 미세 변형 (iso3 시드 기반 결정론적 jitter)
 *   - 바이옴별 밤 이미시브 강도 차등화 (urban 0.9, arctic 0.2)
 *
 * v29 Phase 5 추가:
 *   - 바이옴별 ambient/diffuse 조정 (diffuseBoost: arctic 밝은 반사, tropical 부드러운 그림자)
 *   - Blinn-Phong 스페큘러 (밝은 블록=금속/크리스탈 proxy, 0.3 max 강도)
 *   - 창문 깜빡임 애니메이션 (uTime + vAgeSeed 위상차, 밤에만 동작)
 *   - vWorldPos varying (스페큘러 view direction 계산용)
 *
 * v29 Phase 7 추가:
 *   - 7B: 셰이더 색온도 중립화 (스페큘러 near-white, 밤 emissive softer amber, sky indirect 2배)
 *   - 7C: 재질 기반 라이팅 분화 (uMaterialProps[38] uniform, UV 블록 인덱스 역산, 패턴별 specular/weathering)
 *   - 7D: Face AO 범위 복원 (0.7→0.45 하한, 입체감 대폭 강화)
 *   - 7E: 바이옴 weathering 필드 실제 연결 (uBiomeWeathering[6] uniform, 고정 0.12 제거)
 *   - 7G: 바이옴별 블록 치환 (archetype+biome 키 그룹핑, buildVoxelGeometry biome 파라미터)
 *
 * v33 Phase 2 성능 최적화:
 *   - static attribute (biomeAttr, ageAttr) needsUpdate 제거 — visibleCount 변경 시에만 업로드
 *   - dirty flag 패턴 — 카메라 미이동 시 빌보드/스케일 계산 스킵
 *   - 단일 useFrame 통합 — 부모에서 모든 archetype 일괄 업데이트 (useFrame 오버헤드 제거)
 *   - LOD 연동 — useGlobeLODDistance 'far' 티어에서 매 4프레임마다만 업데이트
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { LandmarkArchetype } from '@/lib/landmark-data';
import type { Landmark } from '@/lib/landmark-data';
import type { BiomeType } from '@/components/game/iso/types';
import { createArchetypeGeometry, createArchetypeEdgeGeometry, disposeGeometryCache } from '@/lib/landmark-geometries';
import { getBlockAtlasTexture } from '@/lib/mc-texture-atlas';
import { BIOME_LANDMARK_TINTS, BIOME_INDEX } from '@/lib/biome-landmark-tints';
import { MATERIAL_PROPS } from '@/lib/mc-blocks';
import { useGlobeLODDistance } from '@/hooks/useGlobeLOD';
import { useAdaptiveQualityContext } from '@/hooks/useAdaptiveQuality';
import { useSharedTick } from '@/components/lobby/GlobeView';

// ─── Constants ───

const SURFACE_ALT = 0.5;
const BACKFACE_THRESHOLD = 0.05;
const BACKFACE_FADE_RANGE = 0.3;

// v33 Phase 2: 카메라 이동 감지 임계값 (이 거리 미만 이동 시 업데이트 스킵)
const CAMERA_DIRTY_THRESHOLD = 0.5;
// v33 Phase 2: 'far' LOD에서 업데이트 빈도 (N프레임마다 1회)
const FAR_LOD_UPDATE_INTERVAL = 4;

// v29 Phase 4: Tier 기반 스케일 차등화 (기존 LANDMARK_SCALE=1.5 대체)
const TIER_SCALE: Record<number, number> = {
  1: 1.8,  // TIER_1 (S+A급 28개국) — 가장 크게
  2: 1.4,  // TIER_2 (B급 40개국)
  3: 1.0,  // TIER_3 (C+D급 ~127개국) — 가장 작게
};

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
// v33 Phase 2: 이전 카메라 위치 비교용 temp
const _prevCamPos = new THREE.Vector3();

// ─── v29 Phase 2: iso3 해시 기반 결정론적 랜덤 시드 ───

function iso3HashSeed(iso3: string): number {
  let h = 0;
  for (let i = 0; i < iso3.length; i++) {
    h = ((h << 5) - h + iso3.charCodeAt(i)) | 0;
  }
  // 0-1 범위로 정규화 (양수만)
  return Math.abs(h % 10000) / 10000;
}

// ─── v29 Phase 4: iso3 해시 기반 결정론적 Y축 회전 ───

function iso3ToRotation(iso3: string): number {
  let hash = 0;
  for (let i = 0; i < iso3.length; i++) {
    hash = ((hash << 5) - hash + iso3.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 360) * (Math.PI / 180);
}

// v29 Phase 4: Y축 회전 기준 축 (GC 방지)
const _yAxis = new THREE.Vector3(0, 1, 0);

// ─── v29 Phase 2: 바이옴 uniform 배열 (정렬 순서 보장) ───

const BIOME_ORDER: BiomeType[] = ['temperate', 'arid', 'tropical', 'arctic', 'mediterranean', 'urban'];

const biomeTintArray = BIOME_ORDER.map(b => BIOME_LANDMARK_TINTS[b].tint);
const biomeFogArray = BIOME_ORDER.map(b => BIOME_LANDMARK_TINTS[b].fog);
// v29 Phase 4: 바이옴별 밤 이미시브 강도 배열
const biomeNightEmissiveArray = BIOME_ORDER.map(b => BIOME_LANDMARK_TINTS[b].nightEmissive);
// v29 Phase 5: 바이옴별 디퓨즈 부스트 배열
const biomeDiffuseBoostArray = BIOME_ORDER.map(b => BIOME_LANDMARK_TINTS[b].diffuseBoost);
// v29 Phase 7E: 바이옴별 풍화 강도 배열
const biomeWeatheringArray = BIOME_ORDER.map(b => BIOME_LANDMARK_TINTS[b].weathering);

// v29 Phase 7C: 블록별 재질 속성 (vec2[38] → flat Float32Array for uniform)
const materialPropsArray = MATERIAL_PROPS.map(([spec, weather]) => new THREE.Vector2(spec, weather));

// ─── Types ───

export interface LandmarkMeshesProps {
  landmarks: Landmark[];
  globeRadius?: number;
}

// ─── Archetype 그룹핑 ───

interface ArchetypeGroup {
  archetype: LandmarkArchetype;
  /** v29 Phase 7G: 그룹의 대표 바이옴 (geometry 치환용) */
  groupBiome: BiomeType;
  landmarks: Landmark[];
  positions: THREE.Vector3[];
  normals: THREE.Vector3[];
  /** v29: 각 랜드마크의 바이옴 (Phase 2에서 셰이더 attribute로 전달) */
  biomes: BiomeType[];
  /** v29 Phase 4: 각 랜드마크의 티어 (스케일 차등화용) */
  tiers: number[];
}

// ─── v33 Phase 2: Archetype별 런타임 데이터 (통합 useFrame용) ───

interface ArchetypeRuntimeData {
  meshRef: React.RefObject<THREE.InstancedMesh | null>;
  biomeAttrRef: React.MutableRefObject<THREE.InstancedBufferAttribute | null>;
  ageAttrRef: React.MutableRefObject<THREE.InstancedBufferAttribute | null>;
  edgeGeometry: THREE.InstancedBufferGeometry;
  edgeAttrs: {
    m0: THREE.InstancedBufferAttribute;
    m1: THREE.InstancedBufferAttribute;
    m2: THREE.InstancedBufferAttribute;
    m3: THREE.InstancedBufferAttribute;
  };
  instanceData: {
    biomeIndices: Float32Array;
    ageSeeds: Float32Array;
    finalScales: Float32Array;
    yRotations: THREE.Quaternion[];
  };
  /** v33 Phase 2: 이전 프레임의 visible count (변경 시에만 static attr 업로드) */
  prevVisibleCount: number;
}

// ─── Landmark Sun Lighting Shaders (v22 Phase 1) ───

const landmarkVertexShader = /* glsl */ `
  attribute vec3 color; // vertexColors (면별 밝기: top=1.0, bottom=0.5, sides=0.6/0.8)
  attribute float aBiomeIdx; // v29: 바이옴 인덱스 (0-5)
  attribute float aAgeSeed;  // v29: 풍화/노화 시드 (0-1)
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vBiomeIdx;   // v29: fragment로 전달
  varying float vAgeSeed;    // v29: fragment로 전달
  varying float vCamDist;    // v29: 카메라 거리 (환경 안개용)
  varying vec3 vWorldPos;    // v29 Phase 5: 월드 좌표 (스페큘러용)
  void main() {
    vUv = uv;
    vColor = color;
    vBiomeIdx = aBiomeIdx;
    vAgeSeed = aAgeSeed;
    // InstancedMesh: instanceMatrix * vec4(normal, 0.0) 로 월드 노멀 계산
    vWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
    // v29: 카메라 거리 계산 (환경 안개) + v29 Phase 5: worldPos varying
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vCamDist = length(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const landmarkFragmentShader = /* glsl */ `
  uniform sampler2D uMap;        // atlas texture (sRGB)
  uniform vec3 uSunDir;          // 태양 방향 (정규화)
  uniform vec3 uBiomeTints[6];   // v29: 6개 바이옴 tint 색상
  uniform vec3 uBiomeFogs[6];    // v29: 6개 바이옴 fog 색상
  uniform float uBiomeNightEmissive[6]; // v29 Phase 4: 바이옴별 밤 이미시브 강도
  uniform float uBiomeDiffuseBoost[6]; // v29 Phase 5: 바이옴별 디퓨즈 부스트
  uniform float uBiomeWeathering[6];  // v29 Phase 7E: 바이옴별 풍화 강도
  uniform vec2 uMaterialProps[38];    // v29 Phase 7C: [specular, weatheringFactor] per block type
  uniform float uTime;           // v29 Phase 5: 시간 (초, 창문 깜빡임용)
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vColor;           // 면별 밝기 (AO)
  varying float vBiomeIdx;       // v29: 바이옴 인덱스
  varying float vAgeSeed;        // v29: 풍화 시드
  varying float vCamDist;        // v29: 카메라 거리
  varying vec3 vWorldPos;        // v29 Phase 5: 월드 좌표 (스페큘러용)

  // v29: 간단한 해시 함수 (풍화 노이즈용)
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    float NdotL = dot(N, uSunDir);

    // v29 Phase 2+5: 바이옴 인덱스 (early declaration for diffuse boost)
    int biomeId = int(vBiomeIdx + 0.5);
    biomeId = clamp(biomeId, 0, 5);

    // 텍스처 색상 (sRGB → 선형으로 근사 변환하여 라이팅 계산)
    vec4 texColor = texture2D(uMap, vUv);
    vec3 albedo = pow(texColor.rgb, vec3(2.2));

    // v29 Phase 7C: UV에서 블록 인덱스 역산 (8x8 atlas, 64px cells)
    int col = int(vUv.x * 8.0);
    int row = int(vUv.y * 8.0);
    int blockIdx = row * 8 + col;
    blockIdx = clamp(blockIdx, 0, 37);
    vec2 matProps = uMaterialProps[blockIdx];
    float matSpecular = matProps.x;
    float matWeatherFactor = matProps.y;

    // v29 Phase 5: 바이옴별 ambient/diffuse 조정
    // arctic: 높은 ambient (눈 반사), tropical: 낮은 ambient (부드러운 그림자), arid: 강한 대비
    float biomeDiffuse = uBiomeDiffuseBoost[biomeId];
    float ambient = 0.25 + biomeDiffuse * 0.15;
    float diffuse = max(NdotL, 0.0) * (0.65 + biomeDiffuse * 0.1) + ambient;

    // 면별 AO (vertex color) — 입체감 강화 (0.5~1.0 → 0.45~1.0)
    float ao = mix(0.45, 1.0, vColor.r);

    // 최종 라이팅: 알베도 × 디퓨즈 × AO
    vec3 color = albedo * diffuse * ao;

    // 하늘빛 간접광 (태양 반대쪽에 은은한 파란 반사)
    float skyFactor = max(-NdotL, 0.0) * 0.15;
    color += albedo * vec3(0.5, 0.6, 0.9) * skyFactor;

    // v29 Phase 7C: 재질 기반 스페큘러 하이라이트 (Blinn-Phong)
    // 기존 texColor.r 추측적 shininess → 재질별 specularStrength
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(N, halfDir), 0.0), 32.0);
    color += vec3(1.0, 0.98, 0.95) * spec * matSpecular * max(NdotL, 0.0);

    // v29 Phase 2: 바이옴 틴트 적용 (서틀하게 MC 미학 보존)
    vec3 biomeTint = uBiomeTints[biomeId];
    color = mix(color, color * biomeTint, 0.25);

    // v29 Phase 7C+7E: 풍화(Weathering) 노이즈 — 바이옴 × 재질 계수
    float weathering = hash21(vUv * 50.0 + vAgeSeed * 100.0) * uBiomeWeathering[biomeId] * matWeatherFactor;
    color *= (1.0 - weathering);

    // 야간 emissive: 밤면에서 창문 불빛 (따뜻한 글로우)
    // v29 Phase 4: 바이옴별 밤 이미시브 강도 적용
    // v29 Phase 5: 창문 깜빡임 애니메이션 (uTime + vAgeSeed로 인스턴스별 위상차)
    float biomeNightEmissive = uBiomeNightEmissive[biomeId];
    float nightFactor = smoothstep(0.1, -0.3, NdotL);
    float flicker = 0.85 + 0.15 * sin(uTime * 2.0 + vAgeSeed * 50.0);
    float windowLight = texColor.r * 0.25 * biomeNightEmissive;
    vec3 emissive = vec3(0.95, 0.9, 0.75) * windowLight * nightFactor * flicker;
    color += emissive;

    // v29 Phase 2: 환경 안개(Atmospheric Fog) — 거리 기반 바이옴 안개
    vec3 biomeFog = uBiomeFogs[biomeId];
    float fogFactor = smoothstep(100.0, 350.0, vCamDist) * 0.2;
    color = mix(color, biomeFog, fogFactor);

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
      // v29 Phase 2: 바이옴 틴트/안개 uniform 배열 (6개 바이옴, 정렬 순서 보장)
      uBiomeTints: { value: biomeTintArray },
      uBiomeFogs: { value: biomeFogArray },
      // v29 Phase 4: 바이옴별 밤 이미시브 강도
      uBiomeNightEmissive: { value: biomeNightEmissiveArray },
      // v29 Phase 5: 바이옴별 디퓨즈 부스트 + 시간
      uBiomeDiffuseBoost: { value: biomeDiffuseBoostArray },
      // v29 Phase 7E: 바이옴별 풍화 강도
      uBiomeWeathering: { value: biomeWeatheringArray },
      // v29 Phase 7C: 블록별 재질 속성 (specular, weatheringFactor)
      uMaterialProps: { value: materialPropsArray },
      uTime: { value: 0 },
    },
    vertexShader: landmarkVertexShader,
    fragmentShader: landmarkFragmentShader,
    // ★ Fix: fill mesh는 항상 alpha=1.0 출력 → opaque 패스에서 렌더링해야 함
    // transparent: true + depthWrite: false 였을 때 지구 edge 근처 건물이
    // depth test 실패하여 라인만 보이는 버그 발생
    transparent: false,
    depthWrite: true,
    // 지구 표면과의 z-fighting 방지 (depth 값을 카메라 쪽으로 미세 이동)
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  return sharedMaterial;
}


// ─── ArchetypeInstancedMesh 서브 컴포넌트 (v33: useFrame 제거, JSX만 렌더링) ───

interface ArchetypeInstancedMeshProps {
  group: ArchetypeGroup;
  globeRadius: number;
  /** v33 Phase 2: 부모가 런타임 데이터에 접근하기 위한 콜백 */
  onRuntimeReady: (key: string, data: ArchetypeRuntimeData) => void;
  onRuntimeCleanup: (key: string) => void;
}

function ArchetypeInstancedMesh({ group, globeRadius, onRuntimeReady, onRuntimeCleanup }: ArchetypeInstancedMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // v29 Phase 2: InstancedBufferAttribute 참조
  const biomeAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const ageAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  const groupKey = `${group.archetype}_${group.groupBiome}`;

  const meshRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) {
      mesh.count = 0;
      meshRef.current = mesh;
      // v29 Phase 2: aBiomeIdx / aAgeSeed per-instance attributes 추가
      const maxCount = group.landmarks.length;
      if (!mesh.geometry.getAttribute('aBiomeIdx')) {
        const biomeAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxCount), 1, false, 1);
        mesh.geometry.setAttribute('aBiomeIdx', biomeAttr);
        biomeAttrRef.current = biomeAttr;
      }
      if (!mesh.geometry.getAttribute('aAgeSeed')) {
        const ageAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxCount), 1, false, 1);
        mesh.geometry.setAttribute('aAgeSeed', ageAttr);
        ageAttrRef.current = ageAttr;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.landmarks.length]);

  const geometry = useMemo(() => {
    // v29 Phase 7G: 바이옴별 geometry 치환
    return createArchetypeGeometry(group.archetype, group.groupBiome);
  }, [group.archetype, group.groupBiome]);

  // v29 Phase 2+4: per-landmark 바이옴/풍화 + 스케일/회전 (결정론적, useMemo)
  const instanceData = useMemo(() => {
    const count = group.landmarks.length;
    const biomeIndices = new Float32Array(count);
    const ageSeeds = new Float32Array(count);
    // v29 Phase 4: 미리 계산된 최종 스케일 (tierScale * jitter)
    const finalScales = new Float32Array(count);
    // v29 Phase 4: 미리 계산된 Y축 회전 quaternion
    const yRotations = new Array<THREE.Quaternion>(count);

    for (let i = 0; i < count; i++) {
      const iso3 = group.landmarks[i].iso3;
      const tier = group.tiers[i];
      const seed = iso3HashSeed(iso3);

      biomeIndices[i] = BIOME_INDEX[group.biomes[i]] ?? 0;
      ageSeeds[i] = seed;

      // Phase 4 Task 1+3: tierScale × jitter (±10%)
      const tierScale = TIER_SCALE[tier] ?? 1.0;
      const jitterFactor = 0.9 + seed * 0.2; // 0.9 ~ 1.1
      finalScales[i] = tierScale * jitterFactor;

      // Phase 4 Task 2: iso3 기반 결정론적 Y축 회전
      const yRotAngle = iso3ToRotation(iso3);
      yRotations[i] = new THREE.Quaternion().setFromAxisAngle(_yAxis, yRotAngle);
    }
    return { biomeIndices, ageSeeds, finalScales, yRotations };
  }, [group.landmarks, group.biomes, group.tiers]);

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

  // v29 Phase 6: 엣지 어트리뷰트 참조 캐시 (per-frame getAttribute 호출 제거)
  const edgeAttrs = useMemo(() => ({
    m0: edgeGeometry.getAttribute('aInstanceMatrix0') as THREE.InstancedBufferAttribute,
    m1: edgeGeometry.getAttribute('aInstanceMatrix1') as THREE.InstancedBufferAttribute,
    m2: edgeGeometry.getAttribute('aInstanceMatrix2') as THREE.InstancedBufferAttribute,
    m3: edgeGeometry.getAttribute('aInstanceMatrix3') as THREE.InstancedBufferAttribute,
  }), [edgeGeometry]);

  // v33 Phase 2: 마운트 시 런타임 데이터를 부모에 등록, 언마운트 시 해제
  useEffect(() => {
    onRuntimeReady(groupKey, {
      meshRef,
      biomeAttrRef,
      ageAttrRef,
      edgeGeometry,
      edgeAttrs,
      instanceData,
      prevVisibleCount: -1, // 초기값: 무조건 첫 프레임에서 static attr 업로드 강제
    });
    return () => {
      onRuntimeCleanup(groupKey);
      // v33 Phase 6: useMemo로 생성한 edgeGeometry + edgeMaterial dispose
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, edgeGeometry, edgeAttrs, instanceData]);

  return (
    <>
      <instancedMesh
        ref={meshRefCb}
        args={[geometry, material, group.landmarks.length]}
        frustumCulled={false}
        renderOrder={95}
        castShadow={false}
        receiveShadow={false}
      />
      {/* MC 블록 외곽선 */}
      <lineSegments
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

  // v33 Phase 2: LOD 연동 — 카메라 거리 기반 업데이트 빈도 조절
  const distanceLODRef = useGlobeLODDistance();
  // v33 Phase 5: AdaptiveQuality context
  const qualityRef = useAdaptiveQualityContext();
  // v33 perf: SharedTickData에서 태양 방향 참조 (중복 계산 제거)
  const sharedTickRef = useSharedTick();

  // v33 Phase 2: Archetype별 런타임 데이터 맵 (통합 useFrame에서 사용)
  const runtimeMapRef = useRef<Map<string, ArchetypeRuntimeData>>(new Map());

  // v33 Phase 2: 카메라 dirty flag — 이전 위치 저장
  const prevCamPosRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  // v33 Phase 2: 'far' LOD 프레임 카운터
  const frameCountRef = useRef(0);

  // v33 Phase 2: 런타임 등록/해제 콜백 (안정 참조, 재렌더링 방지)
  const handleRuntimeReady = useCallback((key: string, data: ArchetypeRuntimeData) => {
    runtimeMapRef.current.set(key, data);
  }, []);
  const handleRuntimeCleanup = useCallback((key: string) => {
    runtimeMapRef.current.delete(key);
  }, []);

  // v29 Phase 7G: Archetype + Biome 별 그룹핑 + 3D 좌표 계산
  // 같은 아키타입이라도 바이옴이 다르면 별도 InstancedMesh로 관리 (블록 치환 때문)
  const archetypeGroups = useMemo(() => {
    const groupMap = new Map<string, ArchetypeGroup>();
    const r = globeRadius + SURFACE_ALT;

    for (const lm of landmarks) {
      // v29 Phase 7G: archetype + biome으로 그룹화
      const key = `${lm.archetype}_${lm.biome}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          archetype: lm.archetype,
          groupBiome: lm.biome,
          landmarks: [],
          positions: [],
          normals: [],
          biomes: [],
          tiers: [],
        };
        groupMap.set(key, group);
      }

      const pos = latLngToVector3(lm.lat, lm.lng, r);
      const normal = pos.clone().normalize();
      group.landmarks.push(lm);
      group.positions.push(pos);
      group.normals.push(normal);
      group.biomes.push(lm.biome);
      group.tiers.push(lm.tier);
    }

    return Array.from(groupMap.values());
  }, [landmarks, globeRadius]);

  // v33 Phase 2: 그룹 키 → 그룹 데이터 매핑 (useFrame에서 사용)
  const groupByKey = useMemo(() => {
    const map = new Map<string, ArchetypeGroup>();
    for (const g of archetypeGroups) {
      map.set(`${g.archetype}_${g.groupBiome}`, g);
    }
    return map;
  }, [archetypeGroups]);

  // v33 Phase 2: 통합 useFrame — 태양 uniform + 모든 archetype 인스턴스 업데이트
  useFrame((state) => {
    // ── 1. 태양 방향 + uTime uniform 갱신 (SharedTickData에서 가져옴, 중복계산 제거) ──
    if (sharedMaterial) {
      sharedMaterial.uniforms.uSunDir.value.copy(sharedTickRef.current.sunDir);
      sharedMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }

    // ── 2. LOD + AdaptiveQuality 기반 업데이트 빈도 제어 ──
    frameCountRef.current++;
    const distSkip = distanceLODRef.current.distanceTier === 'far' ? FAR_LOD_UPDATE_INTERVAL : 1;
    const skip = Math.max(qualityRef.current.effectFrameSkip, distSkip);
    if (skip > 1 && frameCountRef.current % skip !== 0) return;

    // ── 3. 카메라 dirty flag 체크 ──
    const camPos = camera.position;
    _prevCamPos.copy(prevCamPosRef.current);
    const camDelta = _prevCamPos.distanceToSquared(camPos);
    const cameraDirty = camDelta > CAMERA_DIRTY_THRESHOLD * CAMERA_DIRTY_THRESHOLD;

    // 카메라 미이동 시 빌보드/스케일/backface 계산 스킵
    if (!cameraDirty) return;

    // 카메라 위치 저장
    prevCamPosRef.current.copy(camPos);

    // ── 4. 카메라 방향 한 번 계산 (모든 그룹 공유) ──
    _camDir.copy(camPos).normalize();

    // ── 5. 모든 archetype 그룹 일괄 업데이트 ──
    const runtimeMap = runtimeMapRef.current;
    for (const [key, runtime] of runtimeMap) {
      const group = groupByKey.get(key);
      if (!group) continue;

      const mesh = runtime.meshRef.current;
      if (!mesh) continue;

      const { m0, m1, m2, m3 } = runtime.edgeAttrs;
      const biomeAttr = runtime.biomeAttrRef.current;
      const ageAttr = runtime.ageAttrRef.current;
      const { biomeIndices, ageSeeds, finalScales, yRotations } = runtime.instanceData;

      let visibleCount = 0;

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
        // ★ 너무 작은 스케일은 검은 점으로 보이므로 스킵
        if (fade < 0.15) continue;

        // v29 Phase 4: Y축 회전을 먼저 적용 → surface normal alignment를 곱함
        _quat.setFromUnitVectors(_up, normal);
        _quat.multiply(yRotations[i]);

        _obj.position.copy(pos);
        _obj.quaternion.copy(_quat);
        const s = finalScales[i] * fade;
        _obj.scale.set(s, s, s);
        _obj.updateMatrix();
        mesh.setMatrixAt(visibleCount, _obj.matrix);

        // v29 Phase 2+4: per-instance 바이옴 인덱스 + 풍화 시드 설정
        if (biomeAttr) biomeAttr.setX(visibleCount, biomeIndices[i]);
        if (ageAttr) ageAttr.setX(visibleCount, ageSeeds[i]);

        // 엣지 인스턴스 행렬도 동기화
        const e = _obj.matrix.elements;
        m0.setXYZW(visibleCount, e[0], e[1], e[2], e[3]);
        m1.setXYZW(visibleCount, e[4], e[5], e[6], e[7]);
        m2.setXYZW(visibleCount, e[8], e[9], e[10], e[11]);
        m3.setXYZW(visibleCount, e[12], e[13], e[14], e[15]);

        visibleCount++;
      }

      mesh.count = visibleCount;
      mesh.instanceMatrix.needsUpdate = true;

      // v33 Phase 2: static attribute는 visibleCount 변경 시에만 needsUpdate
      // 카메라가 움직이면 backface culling이 바뀌어 인스턴스 순서가 달라지므로
      // visibleCount가 같아도 인덱스 매핑이 변할 수 있음 → cameraDirty일 때 업데이트
      // 하지만 이미 cameraDirty 체크 위에서 통과했으므로, 여기서는 항상 업로드 필요
      // 최적화: prevVisibleCount와 비교하여 동일하면 데이터 내용도 동일한지 확인 불가
      // → 안전하게: cameraDirty 통과 시 항상 업로드 (카메라 미이동 시 이 코드 자체 미도달)
      if (biomeAttr) biomeAttr.needsUpdate = true;
      if (ageAttr) ageAttr.needsUpdate = true;

      // 엣지 인스턴스 카운트 업데이트
      runtime.edgeGeometry.instanceCount = visibleCount;
      m0.needsUpdate = true;
      m1.needsUpdate = true;
      m2.needsUpdate = true;
      m3.needsUpdate = true;

      // v33 Phase 2: prevVisibleCount 갱신
      runtime.prevVisibleCount = visibleCount;
    }
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
          key={`${group.archetype}_${group.groupBiome}`}
          group={group}
          globeRadius={globeRadius}
          onRuntimeReady={handleRuntimeReady}
          onRuntimeCleanup={handleRuntimeCleanup}
        />
      ))}
    </group>
  );
}
