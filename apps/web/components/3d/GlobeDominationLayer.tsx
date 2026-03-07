'use client';

/**
 * GlobeDominationLayer — v14 Phase 5 S26
 * Renders domination state on the globe:
 * - Dominated countries: colored with dominant nation's representative color
 * - Sovereignty: soft pulse glow (shader uniform oscillation)
 * - Hegemony: strong glow + crown icon
 * - Transition: 2s fade animation between colors
 * - Undominated: grey (#666666)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Types ───

export type DominationLevel = 'none' | 'active' | 'sovereignty' | 'hegemony';

export interface CountryDominationState {
  iso3: string;
  dominantNation: string;       // ISO3 of the dominating nation (empty if none)
  level: DominationLevel;
  color: string;                // hex color for this domination (e.g., nation's representative color)
  transitionProgress: number;   // 0-1, for fade animation (1 = complete)
  previousColor: string;        // previous color for transitions
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

// ─── Domination shader material ───

const dominationVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const dominationFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uPreviousColor;
  uniform float uTransition;      // 0 → 1 (color fade progress)
  uniform float uGlowIntensity;   // 0 for none, >0 for sovereignty/hegemony
  uniform float uPulsePhase;      // animated time for pulse effect
  uniform float uPulseAmplitude;  // 0 for no pulse, 0.2 for sovereignty
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Interpolate between previous and current color during transition
    vec3 baseColor = mix(uPreviousColor, uColor, uTransition);

    // Apply pulse glow for sovereignty
    float pulse = 1.0 + uPulseAmplitude * sin(uPulsePhase * 6.28318);
    baseColor *= pulse;

    // Add glow for sovereignty/hegemony
    baseColor += vec3(uGlowIntensity);

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
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 10; // Render above base globe

      const data: DominationMeshData = {
        geometry,
        material,
        mesh,
        state,
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

  // Animate: pulse glow, transition fades
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
}

// ─── Utility: Create domination state from server data ───

export interface ServerDominationData {
  countryCode: string;
  dominantNation: string;
  status: 'none' | 'active' | 'sovereignty' | 'hegemony';
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
    });
  }

  return states;
}

export default GlobeDominationLayer;
