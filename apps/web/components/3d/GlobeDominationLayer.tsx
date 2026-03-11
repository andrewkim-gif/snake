'use client';

/**
 * GlobeDominationLayer — v14 Phase 5 S26 + v15 Phase 3 셰이더 강화 + v33 Phase 7 Merged Geometry
 * Renders domination state on the globe:
 * - Dominated countries: colored with dominant nation's representative color
 * - Sovereignty: soft pulse glow (shader uniform oscillation)
 * - Hegemony: strong glow + crown icon
 * - Transition: 2s fade animation between colors
 * - Undominated: grey (#666666)
 *
 * v15 Phase 3 추가:
 * - 골드 전환 웨이브: sovereignty→hegemony 전환 시 골드 펄스 확산 (3초)
 * - 분쟁 영토 해칭: 2개국 이상 경합 국가에 대각선 스트라이프 패턴
 * - 점령 완료 플래시: hegemony 달성 시 밝은 백색 플래시 감쇠 (3초)
 *
 * v33 Phase 7: Merged Geometry 최적화
 * - 195개 개별 Mesh → 1개 Merged BufferGeometry + 1 ShaderMaterial
 * - per-vertex attributes로 국가별 색상/이펙트 데이터 전달
 * - 195 draw calls → 1 draw call
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_ORDER } from '@/lib/effect-constants';
import type { DistanceLODConfig } from '@/hooks/useGlobeLOD';
import { useAdaptiveQualityContext } from '@/hooks/useAdaptiveQuality';

// ─── Types ───

export type DominationLevel = 'none' | 'active' | 'sovereignty' | 'hegemony';

export interface CountryDominationState {
  iso3: string;
  dominantNation: string;       // ISO3 of the dominating nation (empty if none)
  level: DominationLevel;
  color: string;                // hex color for this domination (e.g., nation's representative color)
  transitionProgress: number;   // 0-1, for fade animation (1 = complete)
  previousColor: string;        // previous color for transitions
  contested?: boolean;          // v15: true if 2+ nations competing for this country
  previousLevel?: DominationLevel; // v15: previous level for transition detection
}

export interface GlobeDominationLayerProps {
  /**
   * Map of ISO3 → domination state for each country visible on the globe.
   * Only countries in this map get colored; others remain default globe color.
   */
  dominationStates: Map<string, CountryDominationState>;

  /**
   * Map of ISO3 → BufferGeometry (country polygon meshes from the globe builder).
   * These geometries are pre-triangulated from GeoJSON.
   */
  countryGeometries?: Map<string, THREE.BufferGeometry>;

  /**
   * Globe radius (must match the globe mesh).
   */
  globeRadius?: number;

  /** Visibility toggle */
  visible?: boolean;

  /** v33 Phase 4: 카메라 거리 LOD 설정 */
  distanceLOD?: DistanceLODConfig;
}

// ─── Constants ───

const DEFAULT_GLOBE_RADIUS = 100;
const UNDOMINATED_COLOR = '#666666';
const SOVEREIGNTY_PULSE_SPEED = 1.5;        // oscillations per second
const SOVEREIGNTY_PULSE_AMPLITUDE = 0.20;   // ±20% brightness
const HEGEMONY_GLOW_INTENSITY = 0.4;
const TRANSITION_DURATION = 2.0;            // 2 seconds fade

// v15 Phase 3: 셰이더 이펙트 상수
const TRANSITION_WAVE_DURATION = 3.0;       // 골드 웨이브 3초 확산
const FLASH_DURATION = 3.0;                 // 점령 완료 플래시 3초 감쇠

// v33 Phase 7: per-vertex attribute 인덱스 (stride 8 floats per attribute set)
// aColor(3) + aPreviousColor(3) + aParams(4: transition, glowIntensity, pulseAmplitude, disputeIntensity) + aEffects(2: transitionWave, flashIntensity)

// ─── Merged Geometry Vertex Shader ───

const mergedVertexShader = /* glsl */ `
  // per-vertex 국가별 색상/이펙트 데이터 (attribute)
  attribute vec3 aColor;
  attribute vec3 aPreviousColor;
  attribute vec4 aParams;   // x=transition, y=glowIntensity, z=pulseAmplitude, w=disputeIntensity
  attribute vec2 aEffects;  // x=transitionWave, y=flashIntensity

  // varying → fragment로 전달
  varying vec3 vColor;
  varying vec3 vPreviousColor;
  varying vec4 vParams;
  varying vec2 vEffects;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vScreenUV;

  void main() {
    // per-vertex 데이터를 varying으로 전달
    vColor = aColor;
    vPreviousColor = aPreviousColor;
    vParams = aParams;
    vEffects = aEffects;

    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // 스크린 UV 계산 (해칭 패턴용)
    vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;
    gl_Position = clipPos;
  }
`;

// ─── Merged Geometry Fragment Shader ───

const mergedFragmentShader = /* glsl */ `
  // 글로벌 uniforms (모든 국가 공통)
  uniform float uPulsePhase;        // animated time for pulse effect
  uniform float uOpacity;

  // per-vertex에서 전달받은 varying
  varying vec3 vColor;
  varying vec3 vPreviousColor;
  varying vec4 vParams;   // x=transition, y=glowIntensity, z=pulseAmplitude, w=disputeIntensity
  varying vec2 vEffects;  // x=transitionWave, y=flashIntensity

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vScreenUV;

  void main() {
    float uTransition = vParams.x;
    float uGlowIntensity = vParams.y;
    float uPulseAmplitude = vParams.z;
    float uDisputeIntensity = vParams.w;
    float uTransitionWave = vEffects.x;
    float uFlashIntensity = vEffects.y;

    // Interpolate between previous and current color during transition
    vec3 baseColor = mix(vPreviousColor, vColor, uTransition);

    // Apply pulse glow for sovereignty
    float pulse = 1.0 + uPulseAmplitude * sin(uPulsePhase * 6.28318);
    baseColor *= pulse;

    // Add glow for sovereignty/hegemony
    baseColor += vec3(uGlowIntensity);

    // v15: 분쟁 영토 해칭 패턴 (대각선 스트라이프)
    if (uDisputeIntensity > 0.01) {
      float stripe = fract((vScreenUV.x + vScreenUV.y) * 20.0);
      float hatch = step(0.5, stripe);
      // 밝은 줄과 어두운 줄 교차 — 분쟁 강도에 비례
      float darken = mix(1.0, 0.5, hatch * uDisputeIntensity);
      baseColor *= darken;
      // 분쟁 영역에 미세한 적색 틴트 추가
      baseColor += vec3(0.15, 0.02, 0.02) * uDisputeIntensity * hatch;
    }

    // v15: 골드 전환 웨이브 (sovereignty→hegemony)
    if (uTransitionWave > 0.01) {
      // 스크린 중심에서 바깥으로 확산하는 골드 웨이브
      float dist = length(vScreenUV - vec2(0.5));
      float waveFront = uTransitionWave * 0.8;  // 최대 반경
      float waveWidth = 0.12;
      float wave = smoothstep(waveFront - waveWidth, waveFront, dist)
                  * smoothstep(waveFront + waveWidth, waveFront, dist);
      // 골드 색상 (#FFD700) 혼합
      vec3 goldColor = vec3(1.0, 0.843, 0.0);
      baseColor = mix(baseColor, goldColor, wave * 0.7);
      // 웨이브 통과 후 전체적으로 미세한 골드 틴트
      float passed = smoothstep(waveFront + waveWidth, waveFront, dist);
      baseColor = mix(baseColor, goldColor, passed * 0.15 * uTransitionWave);
    }

    // v15: 점령 완료 플래시 (밝은 백색 플래시, 3초 감쇠)
    if (uFlashIntensity > 0.01) {
      baseColor = mix(baseColor, vec3(1.0), uFlashIntensity * 0.6);
    }

    // Simple rim lighting for depth
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    rim = pow(rim, 3.0) * 0.15;
    baseColor += vec3(rim);

    gl_FragColor = vec4(baseColor, uOpacity);
  }
`;

// ─── Nation representative colors ───
// Maps common ISO3 codes to recognizable national colors.
// Fallback: hash-based color generation for unlisted nations.
const NATION_COLORS: Record<string, string> = {
  USA: '#3B82F6', // blue
  GBR: '#DC2626', // red
  FRA: '#2563EB', // blue
  DEU: '#FBBF24', // gold
  JPN: '#DC2626', // red (sun)
  KOR: '#1D4ED8', // blue
  CHN: '#DC2626', // red
  RUS: '#1E40AF', // dark blue
  BRA: '#16A34A', // green
  IND: '#F97316', // orange
  AUS: '#FBBF24', // gold
  CAN: '#DC2626', // red
  MEX: '#16A34A', // green
  ARG: '#60A5FA', // light blue
  ITA: '#16A34A', // green
  ESP: '#DC2626', // red
  TUR: '#DC2626', // red
  SAU: '#16A34A', // green
  EGY: '#FBBF24', // gold
  NGA: '#16A34A', // green
  ZAF: '#16A34A', // green
  IDN: '#DC2626', // red
  THA: '#1E40AF', // blue
  VNM: '#DC2626', // red
  PHL: '#2563EB', // blue
  MYS: '#1E40AF', // blue
  SGP: '#DC2626', // red
  NZL: '#1D4ED8', // blue
  SWE: '#FBBF24', // gold
  NOR: '#DC2626', // red
  FIN: '#2563EB', // blue
  DNK: '#DC2626', // red
  POL: '#DC2626', // red
  UKR: '#FBBF24', // gold
  ISR: '#2563EB', // blue
  IRN: '#16A34A', // green
  PAK: '#16A34A', // green
  COL: '#FBBF24', // gold
  PER: '#DC2626', // red
  CHL: '#DC2626', // red
  PRK: '#DC2626', // red
};

/**
 * Get the representative color for a nation.
 * Falls back to a deterministic hash color for unlisted nations.
 */
export function getNationColor(iso3: string): string {
  if (NATION_COLORS[iso3]) return NATION_COLORS[iso3];

  // Hash the ISO3 code to generate a consistent color
  let hash = 0;
  for (let i = 0; i < iso3.length; i++) {
    hash = iso3.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

// ─── Helper: parse hex to r/g/b (GC-free, 모듈 스코프 재사용) ───

const _parseColor = new THREE.Color();

/** hex → {r,g,b} 를 모듈 스코프 _parseColor에 파싱. 반환 객체는 즉시 읽고 버릴 것 (재사용됨). */
function hexToThreeColor(hex: string): THREE.Color {
  return _parseColor.set(hex);
}

// ─── v33 Phase 7: per-country 애니메이션 상태 (CPU 측) ───

interface CountryAnimState {
  // 현재 셰이더 파라미터 (per-vertex attribute에 반영)
  colorR: number; colorG: number; colorB: number;
  prevColorR: number; prevColorG: number; prevColorB: number;
  transition: number;
  glowIntensity: number;
  pulseAmplitude: number;
  disputeIntensity: number;
  transitionWave: number;
  flashIntensity: number;
  // 애니메이션 타이머
  transitionTimer: number;       // 색상 전환 타이머 (0→TRANSITION_DURATION)
  transitionWaveTimer: number;   // 골드 웨이브 타이머 (-1=비활성, 0→TRANSITION_WAVE_DURATION)
  flashTimer: number;            // 플래시 타이머 (-1=비활성, FLASH_DURATION→0)
  // 현재 domination state 스냅샷
  level: DominationLevel;
  dominantNation: string;
  stateColor: string;
  contested: boolean;
}

// ─── v33 Phase 7: Merged geometry 빌드 정보 ───

interface MergedGeometryInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  // iso3 → 해당 국가의 vertex 범위 [startIndex, count]
  countryVertexRanges: Map<string, [number, number]>;
  totalVertices: number;
  // per-vertex attribute 배열 참조 (직접 업데이트용)
  colorArray: Float32Array;
  prevColorArray: Float32Array;
  paramsArray: Float32Array;   // stride 4: transition, glow, pulse, dispute
  effectsArray: Float32Array;  // stride 2: transitionWave, flashIntensity
}

/**
 * v33 Phase 7: 모든 국가 geometry를 하나의 BufferGeometry로 병합.
 * 각 국가의 vertex 범위를 기록하여 per-vertex attribute 업데이트에 사용.
 */
function buildMergedGeometry(
  countryGeometries: Map<string, THREE.BufferGeometry>,
  dominationIsos: Set<string>,
): MergedGeometryInfo {
  // 1단계: 총 vertex 수 계산 + 국가별 범위 기록
  const countryVertexRanges = new Map<string, [number, number]>();
  let totalVertices = 0;

  // domination 상태가 있는 국가만 포함
  const orderedIsos: string[] = [];
  dominationIsos.forEach((iso3) => {
    const geo = countryGeometries.get(iso3);
    if (!geo) return;
    const posAttr = geo.getAttribute('position');
    if (!posAttr) return;
    orderedIsos.push(iso3);
    countryVertexRanges.set(iso3, [totalVertices, posAttr.count]);
    totalVertices += posAttr.count;
  });

  // 2단계: 병합된 position/normal 배열 생성
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);

  // per-vertex 커스텀 attributes
  const colorArray = new Float32Array(totalVertices * 3);
  const prevColorArray = new Float32Array(totalVertices * 3);
  const paramsArray = new Float32Array(totalVertices * 4);
  const effectsArray = new Float32Array(totalVertices * 2);

  let offset = 0;
  for (const iso3 of orderedIsos) {
    const geo = countryGeometries.get(iso3)!;
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    const count = posAttr.count;

    // position 복사
    for (let i = 0; i < count; i++) {
      positions[(offset + i) * 3] = posAttr.getX(i);
      positions[(offset + i) * 3 + 1] = posAttr.getY(i);
      positions[(offset + i) * 3 + 2] = posAttr.getZ(i);
    }

    // normal 복사 (없으면 position 방향을 normal로 사용 — 구 표면)
    for (let i = 0; i < count; i++) {
      if (normAttr) {
        normals[(offset + i) * 3] = normAttr.getX(i);
        normals[(offset + i) * 3 + 1] = normAttr.getY(i);
        normals[(offset + i) * 3 + 2] = normAttr.getZ(i);
      } else {
        // 구 표면: position 방향 = normal 방향
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        normals[(offset + i) * 3] = x / len;
        normals[(offset + i) * 3 + 1] = y / len;
        normals[(offset + i) * 3 + 2] = z / len;
      }
    }

    // per-vertex attribute 초기값: 기본 회색 (나중에 상태 업데이트에서 덮어씀)
    hexToThreeColor(UNDOMINATED_COLOR);
    for (let i = 0; i < count; i++) {
      const vi = offset + i;
      colorArray[vi * 3] = _parseColor.r;
      colorArray[vi * 3 + 1] = _parseColor.g;
      colorArray[vi * 3 + 2] = _parseColor.b;
      prevColorArray[vi * 3] = _parseColor.r;
      prevColorArray[vi * 3 + 1] = _parseColor.g;
      prevColorArray[vi * 3 + 2] = _parseColor.b;
      paramsArray[vi * 4] = 1.0;     // transition (완료 상태)
      paramsArray[vi * 4 + 1] = 0.0; // glowIntensity
      paramsArray[vi * 4 + 2] = 0.0; // pulseAmplitude
      paramsArray[vi * 4 + 3] = 0.0; // disputeIntensity
      effectsArray[vi * 2] = 0.0;     // transitionWave
      effectsArray[vi * 2 + 1] = 0.0; // flashIntensity
    }

    offset += count;
  }

  // 3단계: BufferGeometry 생성
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colorArray, 3));
  geometry.setAttribute('aPreviousColor', new THREE.BufferAttribute(prevColorArray, 3));
  geometry.setAttribute('aParams', new THREE.BufferAttribute(paramsArray, 4));
  geometry.setAttribute('aEffects', new THREE.BufferAttribute(effectsArray, 2));

  // index 복사 (indexed geometry 지원)
  let totalIndices = 0;
  let hasIndex = false;
  for (const iso3 of orderedIsos) {
    const geo = countryGeometries.get(iso3)!;
    if (geo.index) {
      hasIndex = true;
      totalIndices += geo.index.count;
    } else {
      // non-indexed: 3 indices per vertex (triangle list)
      totalIndices += geo.getAttribute('position').count;
    }
  }

  if (hasIndex) {
    const indices = new Uint32Array(totalIndices);
    let idxOffset = 0;
    let vertexOffset = 0;
    for (const iso3 of orderedIsos) {
      const geo = countryGeometries.get(iso3)!;
      const posCount = geo.getAttribute('position').count;
      if (geo.index) {
        const srcIdx = geo.index;
        for (let i = 0; i < srcIdx.count; i++) {
          indices[idxOffset + i] = srcIdx.getX(i) + vertexOffset;
        }
        idxOffset += srcIdx.count;
      } else {
        // non-indexed → identity index
        for (let i = 0; i < posCount; i++) {
          indices[idxOffset + i] = vertexOffset + i;
        }
        idxOffset += posCount;
      }
      vertexOffset += posCount;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  // 4단계: ShaderMaterial 생성 (글로벌 uniforms만)
  const material = new THREE.ShaderMaterial({
    vertexShader: mergedVertexShader,
    fragmentShader: mergedFragmentShader,
    uniforms: {
      uPulsePhase: { value: 0.0 },
      uOpacity: { value: 0.7 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  return {
    geometry,
    material,
    countryVertexRanges,
    totalVertices,
    colorArray,
    prevColorArray,
    paramsArray,
    effectsArray,
  };
}

/**
 * GlobeDominationLayer renders domination overlays on the globe.
 *
 * v33 Phase 7: 195개 개별 Mesh → 1개 Merged BufferGeometry (1 draw call)
 *
 * Usage:
 * ```tsx
 * <GlobeDominationLayer
 *   dominationStates={dominationMap}
 *   countryGeometries={geoMap}
 *   globeRadius={100}
 * />
 * ```
 */
export function GlobeDominationLayer({
  dominationStates,
  countryGeometries,
  globeRadius = DEFAULT_GLOBE_RADIUS,
  visible = true,
  distanceLOD,
}: GlobeDominationLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  // v33 Phase 7: merged geometry 정보
  const mergedRef = useRef<MergedGeometryInfo | null>(null);
  // per-country 애니메이션 상태 (CPU 측)
  const animStatesRef = useRef<Map<string, CountryAnimState>>(new Map());
  // v33 Phase 4: far LOD에서 프레임 스킵용 카운터
  const frameCountRef = useRef(0);
  // v33 Phase 5: AdaptiveQuality context
  const qualityRef = useAdaptiveQualityContext();
  // attribute 업데이트 필요 여부 플래그
  const needsAttributeUpdate = useRef(false);

  // v33 Phase 7: 국가별 per-vertex attribute 업데이트 헬퍼
  const updateCountryAttributes = useCallback((
    merged: MergedGeometryInfo,
    iso3: string,
    anim: CountryAnimState,
  ) => {
    const range = merged.countryVertexRanges.get(iso3);
    if (!range) return;
    const [start, count] = range;

    for (let i = 0; i < count; i++) {
      const vi = start + i;
      // aColor (vec3)
      merged.colorArray[vi * 3] = anim.colorR;
      merged.colorArray[vi * 3 + 1] = anim.colorG;
      merged.colorArray[vi * 3 + 2] = anim.colorB;
      // aPreviousColor (vec3)
      merged.prevColorArray[vi * 3] = anim.prevColorR;
      merged.prevColorArray[vi * 3 + 1] = anim.prevColorG;
      merged.prevColorArray[vi * 3 + 2] = anim.prevColorB;
      // aParams (vec4)
      merged.paramsArray[vi * 4] = anim.transition;
      merged.paramsArray[vi * 4 + 1] = anim.glowIntensity;
      merged.paramsArray[vi * 4 + 2] = anim.pulseAmplitude;
      merged.paramsArray[vi * 4 + 3] = anim.disputeIntensity;
      // aEffects (vec2)
      merged.effectsArray[vi * 2] = anim.transitionWave;
      merged.effectsArray[vi * 2 + 1] = anim.flashIntensity;
    }
  }, []);

  // v33 Phase 7: merged geometry 빌드 + 국가 상태 초기화
  useEffect(() => {
    if (!countryGeometries || countryGeometries.size === 0) return;

    const dominationIsos = new Set(dominationStates.keys());

    // 기존 merged geometry가 없거나 국가 구성이 바뀌면 재빌드
    const prevMerged = mergedRef.current;
    const needsRebuild = !prevMerged ||
      !sameKeySet(prevMerged.countryVertexRanges, dominationIsos, countryGeometries);

    if (needsRebuild) {
      // 이전 geometry/material 정리
      if (prevMerged) {
        prevMerged.geometry.dispose();
        prevMerged.material.dispose();
      }

      const merged = buildMergedGeometry(countryGeometries, dominationIsos);
      mergedRef.current = merged;

      // mesh에 새 geometry/material 적용
      if (meshRef.current) {
        meshRef.current.geometry = merged.geometry;
        meshRef.current.material = merged.material;
      }

      // 애니메이션 상태 초기화
      const animStates = animStatesRef.current;
      const prevAnimStates = new Map(animStates);
      animStates.clear();

      dominationStates.forEach((state, iso3) => {
        if (!merged.countryVertexRanges.has(iso3)) return;

        const prevAnim = prevAnimStates.get(iso3);
        // v33 perf: hexToThreeColor는 _parseColor를 재사용하므로 즉시 r/g/b 복사
        hexToThreeColor(state.dominantNation
          ? (state.color || getNationColor(state.dominantNation))
          : UNDOMINATED_COLOR);
        const cR = _parseColor.r, cG = _parseColor.g, cB = _parseColor.b;
        if (state.previousColor) {
          hexToThreeColor(state.previousColor);
        }
        // previousColor 없으면 _parseColor는 이미 current color 상태
        const pR = _parseColor.r, pG = _parseColor.g, pB = _parseColor.b;

        const isNewHegemony = state.level === 'hegemony' &&
          state.previousLevel !== 'hegemony';

        const anim: CountryAnimState = {
          colorR: cR, colorG: cG, colorB: cB,
          prevColorR: pR, prevColorG: pG, prevColorB: pB,
          transition: state.transitionProgress,
          glowIntensity: state.level === 'hegemony' ? HEGEMONY_GLOW_INTENSITY : 0,
          pulseAmplitude: state.level === 'sovereignty'
            ? SOVEREIGNTY_PULSE_AMPLITUDE
            : state.level === 'hegemony'
              ? SOVEREIGNTY_PULSE_AMPLITUDE * 0.5
              : 0,
          disputeIntensity: state.contested ? 1.0 : 0.0,
          transitionWave: 0,
          flashIntensity: isNewHegemony ? 1.0 : 0,
          transitionTimer: state.transitionProgress < 1.0 ? 0 : TRANSITION_DURATION,
          transitionWaveTimer: isNewHegemony ? 0 : -1,
          flashTimer: isNewHegemony ? FLASH_DURATION : -1,
          level: state.level,
          dominantNation: state.dominantNation,
          stateColor: state.color,
          contested: state.contested ?? false,
        };

        // 이전 애니메이션 상태에서 진행 중인 타이머 복원
        if (prevAnim) {
          anim.transitionWaveTimer = prevAnim.transitionWaveTimer;
          anim.flashTimer = prevAnim.flashTimer;
          anim.transitionWave = prevAnim.transitionWave;
          anim.flashIntensity = prevAnim.flashIntensity;
        }

        animStates.set(iso3, anim);
        updateCountryAttributes(merged, iso3, anim);
      });

      // 모든 attribute 업데이트 플래그
      markAllAttributesDirty(merged.geometry);
    } else {
      // geometry 재빌드 불필요 — 상태만 업데이트
      const merged = mergedRef.current!;
      const animStates = animStatesRef.current;

      dominationStates.forEach((state, iso3) => {
        if (!merged.countryVertexRanges.has(iso3)) return;

        const existingAnim = animStates.get(iso3);
        if (existingAnim) {
          // 기존 국가: 상태 변경 감지 → 업데이트
          updateAnimFromState(existingAnim, state);
        } else {
          // 새 국가 (이론적으로 여기에 오면 rebuild 필요하나 안전 처리)
          hexToThreeColor(state.dominantNation
            ? (state.color || getNationColor(state.dominantNation))
            : UNDOMINATED_COLOR);
          const cR2 = _parseColor.r, cG2 = _parseColor.g, cB2 = _parseColor.b;
          if (state.previousColor) {
            hexToThreeColor(state.previousColor);
          }
          const pR2 = _parseColor.r, pG2 = _parseColor.g, pB2 = _parseColor.b;
          const isNewHegemony = state.level === 'hegemony' &&
            state.previousLevel !== 'hegemony';

          const anim: CountryAnimState = {
            colorR: cR2, colorG: cG2, colorB: cB2,
            prevColorR: pR2, prevColorG: pG2, prevColorB: pB2,
            transition: state.transitionProgress,
            glowIntensity: state.level === 'hegemony' ? HEGEMONY_GLOW_INTENSITY : 0,
            pulseAmplitude: state.level === 'sovereignty'
              ? SOVEREIGNTY_PULSE_AMPLITUDE
              : state.level === 'hegemony'
                ? SOVEREIGNTY_PULSE_AMPLITUDE * 0.5
                : 0,
            disputeIntensity: state.contested ? 1.0 : 0.0,
            transitionWave: 0,
            flashIntensity: isNewHegemony ? 1.0 : 0,
            transitionTimer: state.transitionProgress < 1.0 ? 0 : TRANSITION_DURATION,
            transitionWaveTimer: isNewHegemony ? 0 : -1,
            flashTimer: isNewHegemony ? FLASH_DURATION : -1,
            level: state.level,
            dominantNation: state.dominantNation,
            stateColor: state.color,
            contested: state.contested ?? false,
          };
          animStates.set(iso3, anim);
        }

        const anim = animStates.get(iso3)!;
        updateCountryAttributes(merged, iso3, anim);
      });

      markAllAttributesDirty(merged.geometry);
    }

    needsAttributeUpdate.current = true;
  }, [dominationStates, countryGeometries, globeRadius, updateCountryAttributes]);

  // Animate: pulse glow, transition fades, v15 effects
  useFrame((_, delta) => {
    if (!visible) return;
    const merged = mergedRef.current;
    if (!merged) return;
    const animStates = animStatesRef.current;
    if (animStates.size === 0) return;

    // v33 Phase 4+5: far LOD + AdaptiveQuality 기반 프레임 스킵
    frameCountRef.current++;
    const distSkip = distanceLOD?.distanceTier === 'far' ? 4 : 1;
    const skip = Math.max(qualityRef.current.effectFrameSkip, distSkip);
    if (skip > 1 && frameCountRef.current % skip !== 0) return;

    // 글로벌 pulse phase 업데이트
    const mat = merged.material;
    const currentPhase = (mat.uniforms.uPulsePhase.value as number) +
      delta * SOVEREIGNTY_PULSE_SPEED;
    mat.uniforms.uPulsePhase.value = currentPhase % 1000;

    let anyChanged = false;

    animStates.forEach((anim, iso3) => {
      let changed = false;

      // Animate transition fade (2 seconds)
      if (anim.transitionTimer < TRANSITION_DURATION) {
        anim.transitionTimer += delta;
        anim.transition = Math.min(anim.transitionTimer / TRANSITION_DURATION, 1.0);
        changed = true;
      }

      // v15 Phase 3: 골드 전환 웨이브 애니메이션 (sovereignty→hegemony)
      if (anim.transitionWaveTimer >= 0 && anim.transitionWaveTimer < TRANSITION_WAVE_DURATION) {
        anim.transitionWaveTimer += delta;
        anim.transitionWave = Math.min(anim.transitionWaveTimer / TRANSITION_WAVE_DURATION, 1.0);
        if (anim.transitionWave >= 1.0) {
          anim.transitionWaveTimer = TRANSITION_WAVE_DURATION;
        }
        changed = true;
      } else if (anim.transitionWaveTimer >= TRANSITION_WAVE_DURATION) {
        // 웨이브 완료 후 0으로 감쇠
        if (anim.transitionWave > 0.01) {
          anim.transitionWave -= delta * 0.5;
          if (anim.transitionWave <= 0.01) {
            anim.transitionWave = 0;
            anim.transitionWaveTimer = -1;
          }
          changed = true;
        } else {
          anim.transitionWave = 0;
          anim.transitionWaveTimer = -1;
        }
      }

      // v15 Phase 3: 점령 완료 플래시 감쇠 (3초)
      if (anim.flashTimer > 0) {
        anim.flashTimer -= delta;
        const flashProgress = Math.max(anim.flashTimer / FLASH_DURATION, 0);
        // easeOutCubic 감쇠 커브
        anim.flashIntensity = flashProgress * flashProgress;
        if (anim.flashTimer <= 0) {
          anim.flashTimer = -1;
          anim.flashIntensity = 0;
        }
        changed = true;
      }

      // 변경된 국가만 per-vertex attribute 업데이트
      if (changed) {
        updateCountryAttributes(merged, iso3, anim);
        anyChanged = true;
      }
    });

    // GPU에 변경 사항 전송 (attribute 더티 플래그)
    if (anyChanged) {
      markDirtyAttributes(merged.geometry);
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const merged = mergedRef.current;
      if (merged) {
        merged.geometry.dispose();
        merged.material.dispose();
      }
      mergedRef.current = null;
      animStatesRef.current.clear();
    };
  }, []);

  return (
    <mesh
      ref={meshRef}
      visible={visible}
      renderOrder={RENDER_ORDER.DOMINATION}
      frustumCulled={false}
    />
  );
}

// ─── v33 Phase 7: 헬퍼 함수들 ───

/**
 * 기존 애니메이션 상태를 새 domination state로 업데이트.
 * 색상 변경 시 transition 애니메이션 트리거.
 */
function updateAnimFromState(anim: CountryAnimState, newState: CountryDominationState) {
  // 색상 변경 감지 → transition 애니메이션 시작
  if (newState.color !== anim.stateColor || newState.dominantNation !== anim.dominantNation) {
    // previous color ← current color
    anim.prevColorR = anim.colorR;
    anim.prevColorG = anim.colorG;
    anim.prevColorB = anim.colorB;

    // new target color (v33 perf: _parseColor 재사용)
    hexToThreeColor(newState.dominantNation
      ? (newState.color || getNationColor(newState.dominantNation))
      : UNDOMINATED_COLOR);
    anim.colorR = _parseColor.r;
    anim.colorG = _parseColor.g;
    anim.colorB = _parseColor.b;

    // transition 리셋
    anim.transition = 0;
    anim.transitionTimer = 0;
    anim.stateColor = newState.color;
    anim.dominantNation = newState.dominantNation;
  }

  // glow/pulse 레벨 업데이트
  anim.glowIntensity = newState.level === 'hegemony' ? HEGEMONY_GLOW_INTENSITY : 0;
  anim.pulseAmplitude = newState.level === 'sovereignty'
    ? SOVEREIGNTY_PULSE_AMPLITUDE
    : newState.level === 'hegemony'
      ? SOVEREIGNTY_PULSE_AMPLITUDE * 0.5
      : 0;

  // 분쟁 해칭
  anim.disputeIntensity = newState.contested ? 1.0 : 0.0;
  anim.contested = newState.contested ?? false;

  // sovereignty→hegemony 전환 감지
  const wasNotHegemony = anim.level !== 'hegemony';
  const isNowHegemony = newState.level === 'hegemony';
  if (wasNotHegemony && isNowHegemony) {
    anim.transitionWaveTimer = 0;
    anim.transitionWave = 0;
    anim.flashTimer = FLASH_DURATION;
    anim.flashIntensity = 1.0;
  }

  anim.level = newState.level;
}

/**
 * 두 키 세트가 동일한지 비교 (rebuild 판단용).
 * countryGeometries에 실제로 존재하는 iso3만 고려.
 */
function sameKeySet(
  existingRanges: Map<string, [number, number]>,
  newIsos: Set<string>,
  countryGeometries: Map<string, THREE.BufferGeometry>,
): boolean {
  // 새 iso3 중 geometry가 있는 것만 필터
  const validNewIsos = new Set<string>();
  newIsos.forEach((iso3) => {
    if (countryGeometries.has(iso3)) validNewIsos.add(iso3);
  });

  if (existingRanges.size !== validNewIsos.size) return false;
  for (const iso3 of validNewIsos) {
    if (!existingRanges.has(iso3)) return false;
  }
  return true;
}

/**
 * params/effects attribute만 더티 마킹 (애니메이션 루프에서 사용).
 */
function markDirtyAttributes(geometry: THREE.BufferGeometry) {
  const paramsAttr = geometry.getAttribute('aParams') as THREE.BufferAttribute;
  const effectsAttr = geometry.getAttribute('aEffects') as THREE.BufferAttribute;
  if (paramsAttr) paramsAttr.needsUpdate = true;
  if (effectsAttr) effectsAttr.needsUpdate = true;
}

/**
 * 모든 per-vertex attribute를 더티 마킹 (초기화/상태 변경 시 사용).
 */
function markAllAttributesDirty(geometry: THREE.BufferGeometry) {
  const colorAttr = geometry.getAttribute('aColor') as THREE.BufferAttribute;
  const prevColorAttr = geometry.getAttribute('aPreviousColor') as THREE.BufferAttribute;
  const paramsAttr = geometry.getAttribute('aParams') as THREE.BufferAttribute;
  const effectsAttr = geometry.getAttribute('aEffects') as THREE.BufferAttribute;
  if (colorAttr) colorAttr.needsUpdate = true;
  if (prevColorAttr) prevColorAttr.needsUpdate = true;
  if (paramsAttr) paramsAttr.needsUpdate = true;
  if (effectsAttr) effectsAttr.needsUpdate = true;
}

// ─── Utility: Create domination state from server data ───

export interface ServerDominationData {
  countryCode: string;
  dominantNation: string;
  status: 'none' | 'active' | 'sovereignty' | 'hegemony';
  contested?: boolean;          // v15: 2개국 이상 경합 중
}

/**
 * Convert server domination data to client-side domination state map.
 * Use this when receiving domination_update events from the server.
 */
export function buildDominationStates(
  serverData: ServerDominationData[],
  previousStates?: Map<string, CountryDominationState>,
): Map<string, CountryDominationState> {
  const states = new Map<string, CountryDominationState>();

  for (const data of serverData) {
    const prevState = previousStates?.get(data.countryCode);
    const prevColor = prevState?.color || UNDOMINATED_COLOR;
    const newColor = data.dominantNation
      ? getNationColor(data.dominantNation)
      : UNDOMINATED_COLOR;

    const isTransition = prevColor !== newColor;

    states.set(data.countryCode, {
      iso3: data.countryCode,
      dominantNation: data.dominantNation,
      level: data.status as DominationLevel,
      color: newColor,
      transitionProgress: isTransition ? 0.0 : 1.0,
      previousColor: prevColor,
      // v15 Phase 3
      contested: data.contested ?? false,
      previousLevel: prevState?.level ?? 'none',
    });
  }

  return states;
}

// ─── v39 Phase 7: Territory → Domination 브릿지 ───

/**
 * v39 TerritorySnapshot에서 GlobeDominationLayer용 dominationStates를 생성한다.
 *
 * v39의 영토 지배 데이터는 "지역(Region)" 단위이지만, GlobeDominationLayer는
 * "국가(Country)" 단위로 동작한다. 따라서 국가 내 모든 지역의 지배 상태를
 * 집계하여 국가 단위 domination state로 변환한다.
 *
 * 집계 규칙:
 * - 모든 지역을 한 팩션이 지배 → 해당 팩션의 색상으로 표시 (sovereigntyLevel 적용)
 * - 일부 지역만 지배 → 가장 많은 지역을 지배한 팩션의 색상 (contested 표시)
 * - 지배 팩션 없음 → none (회색)
 */
export interface V39TerritoryRegion {
  regionId: string;
  countryCode: string;
  controllerFaction?: string;
  controllerColor?: string;
  controlStreak: number;
  sovereigntyLevel: string;
}

export interface V39TerritorySovereignty {
  countryCode: string;
  sovereignFaction?: string;
  sovereigntyLevel: string;
  streakDays: number;
  allControlled: boolean;
}

export interface V39TerritoryData {
  regions: V39TerritoryRegion[];
  countries: V39TerritorySovereignty[];
}

/**
 * v39 영토 데이터를 GlobeDominationLayer의 dominationStates로 변환.
 *
 * @param territoryData - 서버에서 수신한 v39 territory snapshot
 * @param factionColors - 팩션 ID → hex color 매핑
 * @param previousStates - 이전 domination states (애니메이션 전환용)
 */
export function buildDominationStatesFromTerritory(
  territoryData: V39TerritoryData,
  factionColors: Record<string, string>,
  previousStates?: Map<string, CountryDominationState>,
): Map<string, CountryDominationState> {
  const states = new Map<string, CountryDominationState>();

  // 국가별 지역 그룹핑
  const countryRegions = new Map<string, V39TerritoryRegion[]>();
  for (const region of territoryData.regions) {
    const existing = countryRegions.get(region.countryCode) || [];
    existing.push(region);
    countryRegions.set(region.countryCode, existing);
  }

  // 국가 주권 맵
  const sovereigntyMap = new Map<string, V39TerritorySovereignty>();
  for (const cs of territoryData.countries) {
    sovereigntyMap.set(cs.countryCode, cs);
  }

  // 국가별 domination state 생성
  for (const [countryCode, regions] of countryRegions) {
    const sovereignty = sovereigntyMap.get(countryCode);
    const prevState = previousStates?.get(countryCode);

    // 국가 주권 정보가 있으면 우선 사용
    if (sovereignty && sovereignty.sovereignFaction && sovereignty.allControlled) {
      const factionId = sovereignty.sovereignFaction;
      const color = factionColors[factionId]
        || sovereignty.sovereignFaction
        || '#888888';
      const prevColor = prevState?.color || UNDOMINATED_COLOR;
      const isTransition = prevColor !== color;

      // sovereigntyLevel을 DominationLevel로 매핑
      const level = mapSovereigntyToLevel(sovereignty.sovereigntyLevel);

      states.set(countryCode, {
        iso3: countryCode,
        dominantNation: factionId,
        level,
        color,
        transitionProgress: isTransition ? 0.0 : 1.0,
        previousColor: prevColor,
        contested: false,
        previousLevel: prevState?.level ?? 'none',
      });
      continue;
    }

    // 지역별 지배 팩션 집계
    const factionControlCount = new Map<string, number>();
    let totalControlled = 0;

    for (const region of regions) {
      if (region.controllerFaction) {
        totalControlled++;
        const count = factionControlCount.get(region.controllerFaction) || 0;
        factionControlCount.set(region.controllerFaction, count + 1);
      }
    }

    if (totalControlled === 0) {
      // 지배 팩션 없음
      const prevColor = prevState?.color || UNDOMINATED_COLOR;
      states.set(countryCode, {
        iso3: countryCode,
        dominantNation: '',
        level: 'none',
        color: UNDOMINATED_COLOR,
        transitionProgress: prevColor !== UNDOMINATED_COLOR ? 0.0 : 1.0,
        previousColor: prevColor,
        contested: false,
        previousLevel: prevState?.level ?? 'none',
      });
      continue;
    }

    // 가장 많은 지역을 지배한 팩션 찾기
    let dominantFaction = '';
    let maxCount = 0;
    let secondCount = 0;
    for (const [fid, count] of factionControlCount) {
      if (count > maxCount) {
        secondCount = maxCount;
        dominantFaction = fid;
        maxCount = count;
      } else if (count > secondCount) {
        secondCount = count;
      }
    }

    const isContested = factionControlCount.size > 1;
    const color = factionColors[dominantFaction] || '#888888';
    const prevColor = prevState?.color || UNDOMINATED_COLOR;
    const isTransition = prevColor !== color;

    // 부분 지배 → active 레벨
    const level: DominationLevel = totalControlled === regions.length
      ? mapSovereigntyToLevel(sovereignty?.sovereigntyLevel || 'active_domination')
      : totalControlled > 0
        ? 'active'
        : 'none';

    states.set(countryCode, {
      iso3: countryCode,
      dominantNation: dominantFaction,
      level,
      color,
      transitionProgress: isTransition ? 0.0 : 1.0,
      previousColor: prevColor,
      contested: isContested,
      previousLevel: prevState?.level ?? 'none',
    });
  }

  return states;
}

/**
 * v39 SovereigntyLevel → v14 DominationLevel 매핑.
 */
function mapSovereigntyToLevel(sovereigntyLevel: string): DominationLevel {
  switch (sovereigntyLevel) {
    case 'hegemony':
      return 'hegemony';
    case 'sovereignty':
      return 'sovereignty';
    case 'active_domination':
      return 'active';
    default:
      return 'none';
  }
}

/**
 * 팩션 컬러를 GlobeDominationLayer의 NATION_COLORS 형식으로 변환.
 * 팩션 ID 기반 컬러를 국가 코드 기반으로 리매핑한다.
 *
 * @param territories - 국가별 주권 팩션 매핑
 * @param factionColors - 팩션 ID → hex color
 */
export function buildFactionNationColors(
  territories: V39TerritorySovereignty[],
  factionColors: Record<string, string>,
): Record<string, string> {
  const colors: Record<string, string> = {};

  for (const t of territories) {
    if (t.sovereignFaction && factionColors[t.sovereignFaction]) {
      colors[t.countryCode] = factionColors[t.sovereignFaction];
    }
  }

  return colors;
}

export default GlobeDominationLayer;
