'use client';

/**
 * GlobeDominationLayer — v14 Phase 5 S26 + v15 Phase 3 셰이더 강화
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
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_ORDER } from '@/lib/effect-constants';

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

// ─── Domination shader material ───

const dominationVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vScreenUV;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // 스크린 UV 계산 (해칭 패턴용)
    vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;
    gl_Position = clipPos;
  }
`;

const dominationFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uPreviousColor;
  uniform float uTransition;        // 0 → 1 (color fade progress)
  uniform float uGlowIntensity;     // 0 for none, >0 for sovereignty/hegemony
  uniform float uPulsePhase;        // animated time for pulse effect
  uniform float uPulseAmplitude;    // 0 for no pulse, 0.2 for sovereignty
  uniform float uOpacity;

  // v15 Phase 3: 신규 uniforms
  uniform float uTransitionWave;    // 0→1: 골드 펄스 웨이브 (sovereignty→hegemony 전환)
  uniform float uDisputeIntensity;  // 0=평화, 1=분쟁 (2개국 이상 경합)
  uniform float uFlashIntensity;    // 1→0: 점령 완료 플래시 (3초 감쇠)

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vScreenUV;

  void main() {
    // Interpolate between previous and current color during transition
    vec3 baseColor = mix(uPreviousColor, uColor, uTransition);

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

// ─── Helper: parse hex to THREE.Color ───

function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// ─── Country domination mesh ───

interface DominationMeshData {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  state: CountryDominationState;
  // v15 Phase 3: 전환 웨이브 + 플래시 타이머
  transitionWaveTimer: number;   // 0→TRANSITION_WAVE_DURATION → stops
  flashTimer: number;            // FLASH_DURATION→0 → stops
}

/**
 * GlobeDominationLayer renders domination overlays on the globe.
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
}: GlobeDominationLayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshDataRef = useRef<Map<string, DominationMeshData>>(new Map());
  const transitionTimers = useRef<Map<string, number>>(new Map());

  // Create or update meshes when geometries or states change
  useEffect(() => {
    if (!countryGeometries || !groupRef.current) return;

    const group = groupRef.current;
    const meshMap = meshDataRef.current;
    const existingIsos = new Set(meshMap.keys());

    // Update or create meshes for each country with domination state
    dominationStates.forEach((state, iso3) => {
      const geometry = countryGeometries.get(iso3);
      if (!geometry) return;

      existingIsos.delete(iso3);

      if (meshMap.has(iso3)) {
        // Update existing mesh uniforms
        const data = meshMap.get(iso3)!;
        updateMeshUniforms(data, state);
        data.state = state;
        return;
      }

      // Create new mesh
      const color = state.dominantNation
        ? hexToThreeColor(state.color || getNationColor(state.dominantNation))
        : hexToThreeColor(UNDOMINATED_COLOR);
      const prevColor = state.previousColor
        ? hexToThreeColor(state.previousColor)
        : color.clone();

      const glowIntensity = state.level === 'hegemony'
        ? HEGEMONY_GLOW_INTENSITY
        : 0;
      const pulseAmplitude = state.level === 'sovereignty'
        ? SOVEREIGNTY_PULSE_AMPLITUDE
        : state.level === 'hegemony'
          ? SOVEREIGNTY_PULSE_AMPLITUDE * 0.5 // hegemony has subtler pulse
          : 0;

      const material = new THREE.ShaderMaterial({
        vertexShader: dominationVertexShader,
        fragmentShader: dominationFragmentShader,
        uniforms: {
          uColor: { value: color },
          uPreviousColor: { value: prevColor },
          uTransition: { value: state.transitionProgress },
          uGlowIntensity: { value: glowIntensity },
          uPulsePhase: { value: 0.0 },
          uPulseAmplitude: { value: pulseAmplitude },
          uOpacity: { value: 0.7 },
          // v15 Phase 3: 신규 uniforms
          uTransitionWave: { value: 0.0 },
          uDisputeIntensity: { value: state.contested ? 1.0 : 0.0 },
          uFlashIntensity: { value: 0.0 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = RENDER_ORDER.DOMINATION; // v24: 통일 renderOrder

      // v15: 전환 웨이브 + 플래시 초기화
      const isNewHegemony = state.level === 'hegemony' &&
        state.previousLevel !== 'hegemony';

      const data: DominationMeshData = {
        geometry,
        material,
        mesh,
        state,
        transitionWaveTimer: isNewHegemony ? 0 : -1,
        flashTimer: isNewHegemony ? FLASH_DURATION : -1,
      };

      meshMap.set(iso3, data);
      group.add(mesh);

      // Start transition timer if not complete
      if (state.transitionProgress < 1.0) {
        transitionTimers.current.set(iso3, 0);
      }
    });

    // Remove meshes for countries no longer in domination states
    existingIsos.forEach((iso3) => {
      const data = meshMap.get(iso3);
      if (data) {
        group.remove(data.mesh);
        data.material.dispose();
        meshMap.delete(iso3);
        transitionTimers.current.delete(iso3);
      }
    });
  }, [dominationStates, countryGeometries, globeRadius]);

  // Animate: pulse glow, transition fades, v15 effects
  useFrame((_, delta) => {
    if (!visible) return;

    const meshMap = meshDataRef.current;

    meshMap.forEach((data, iso3) => {
      const mat = data.material;

      // Animate pulse for sovereignty/hegemony
      if (data.state.level === 'sovereignty' || data.state.level === 'hegemony') {
        const currentPhase = (mat.uniforms.uPulsePhase.value as number) +
          delta * SOVEREIGNTY_PULSE_SPEED;
        mat.uniforms.uPulsePhase.value = currentPhase % 1000; // prevent overflow
      }

      // Animate transition fade (2 seconds)
      const timer = transitionTimers.current.get(iso3);
      if (timer !== undefined && timer < TRANSITION_DURATION) {
        const newTimer = timer + delta;
        const progress = Math.min(newTimer / TRANSITION_DURATION, 1.0);
        mat.uniforms.uTransition.value = progress;
        transitionTimers.current.set(iso3, newTimer);

        if (progress >= 1.0) {
          transitionTimers.current.delete(iso3);
        }
      }

      // v15 Phase 3: 골드 전환 웨이브 애니메이션 (sovereignty→hegemony)
      if (data.transitionWaveTimer >= 0 && data.transitionWaveTimer < TRANSITION_WAVE_DURATION) {
        data.transitionWaveTimer += delta;
        const waveProgress = Math.min(data.transitionWaveTimer / TRANSITION_WAVE_DURATION, 1.0);
        mat.uniforms.uTransitionWave.value = waveProgress;
        if (waveProgress >= 1.0) {
          // 웨이브 완료 후 서서히 사라짐
          data.transitionWaveTimer = TRANSITION_WAVE_DURATION;
        }
      } else if (data.transitionWaveTimer >= TRANSITION_WAVE_DURATION) {
        // 웨이브 완료 후 0으로 감쇠
        const current = mat.uniforms.uTransitionWave.value as number;
        if (current > 0.01) {
          mat.uniforms.uTransitionWave.value = current - delta * 0.5;
        } else {
          mat.uniforms.uTransitionWave.value = 0;
          data.transitionWaveTimer = -1; // 완전 종료
        }
      }

      // v15 Phase 3: 점령 완료 플래시 감쇠 (3초)
      if (data.flashTimer > 0) {
        data.flashTimer -= delta;
        const flashProgress = Math.max(data.flashTimer / FLASH_DURATION, 0);
        // easeOutCubic 감쇠 커브
        mat.uniforms.uFlashIntensity.value = flashProgress * flashProgress;
        if (data.flashTimer <= 0) {
          data.flashTimer = -1;
          mat.uniforms.uFlashIntensity.value = 0;
        }
      }
    });
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const meshMap = meshDataRef.current;
      meshMap.forEach((data) => {
        data.material.dispose();
      });
      meshMap.clear();
      transitionTimers.current.clear();
    };
  }, []);

  return <group ref={groupRef} visible={visible} />;
}

// ─── Helper: update mesh uniforms from state ───

function updateMeshUniforms(data: DominationMeshData, newState: CountryDominationState) {
  const mat = data.material;
  const oldState = data.state;

  // Color change → trigger transition animation
  if (newState.color !== oldState.color || newState.dominantNation !== oldState.dominantNation) {
    // Set previous color to current
    const currentColor = mat.uniforms.uColor.value as THREE.Color;
    (mat.uniforms.uPreviousColor.value as THREE.Color).copy(currentColor);

    // Set new target color
    const targetColor = newState.dominantNation
      ? hexToThreeColor(newState.color || getNationColor(newState.dominantNation))
      : hexToThreeColor(UNDOMINATED_COLOR);
    (mat.uniforms.uColor.value as THREE.Color).copy(targetColor);

    // Reset transition
    mat.uniforms.uTransition.value = 0;
  }

  // Update glow/pulse based on domination level
  const glowIntensity = newState.level === 'hegemony'
    ? HEGEMONY_GLOW_INTENSITY
    : 0;
  const pulseAmplitude = newState.level === 'sovereignty'
    ? SOVEREIGNTY_PULSE_AMPLITUDE
    : newState.level === 'hegemony'
      ? SOVEREIGNTY_PULSE_AMPLITUDE * 0.5
      : 0;

  mat.uniforms.uGlowIntensity.value = glowIntensity;
  mat.uniforms.uPulseAmplitude.value = pulseAmplitude;

  // v15 Phase 3: 분쟁 해칭 업데이트
  mat.uniforms.uDisputeIntensity.value = newState.contested ? 1.0 : 0.0;

  // v15 Phase 3: sovereignty→hegemony 전환 감지 → 골드 웨이브 + 플래시 트리거
  const wasNotHegemony = oldState.level !== 'hegemony';
  const isNowHegemony = newState.level === 'hegemony';
  if (wasNotHegemony && isNowHegemony) {
    // 골드 전환 웨이브 시작
    data.transitionWaveTimer = 0;
    mat.uniforms.uTransitionWave.value = 0;
    // 점령 완료 플래시 시작
    data.flashTimer = FLASH_DURATION;
    mat.uniforms.uFlashIntensity.value = 1.0;
  }
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

export default GlobeDominationLayer;
