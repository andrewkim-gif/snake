'use client';

/**
 * CapturePointRenderer — v14 Phase 8 S37: 3D Capture Point Visualization
 *
 * Renders 3 strategic capture points per arena:
 *   - Resource (+XP): Gold beam
 *   - Buff (+DMG): Red beam
 *   - Healing (+HP/s): Green beam
 *
 * Each point shows:
 *   - Circular ground zone (translucent ring)
 *   - Vertical beam pillar (color-coded)
 *   - Progress indicator (ring fill)
 *   - Owner nationality flag color
 *   - War mode glow effect
 *
 * useFrame priority 0 (R3F v9 auto-render compatible)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Types matching server capture_point.go ───

export type CapturePointType = 'resource' | 'buff' | 'healing';
export type CapturePointState = 'neutral' | 'capturing' | 'contested' | 'captured';

export interface CapturePointData {
  id: string;
  type: CapturePointType;
  x: number;
  y: number;
  state: CapturePointState;
  owner?: string;
  progress: number; // 0.0~1.0
  capturer?: string;
  isWarPoint?: boolean;
}

// ─── Color configuration per point type ───

const POINT_COLORS: Record<CapturePointType, {
  beam: string;
  zone: string;
  glow: string;
}> = {
  resource: {
    beam: '#F59E0B',  // Gold
    zone: '#F59E0B',
    glow: '#FBBF24',
  },
  buff: {
    beam: '#EF4444',  // Red
    zone: '#EF4444',
    glow: '#F87171',
  },
  healing: {
    beam: '#10B981',  // Green
    zone: '#10B981',
    glow: '#34D399',
  },
};

const ZONE_RADIUS = 4.0; // 80px / 20 (world scale factor)
const BEAM_HEIGHT = 16;
const BEAM_RADIUS = 0.3;
const RING_SEGMENTS = 32;

// ─── Props ───

interface CapturePointRendererProps {
  capturePoints: CapturePointData[];
}

// ─── Single Capture Point ───

function CapturePointMesh({ point }: { point: CapturePointData }) {
  const groupRef = useRef<THREE.Group>(null!);
  const beamRef = useRef<THREE.Mesh>(null!);
  const zoneRef = useRef<THREE.Mesh>(null!);
  const progressRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.PointLight>(null!);

  const colors = POINT_COLORS[point.type];

  // Beam material
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: colors.beam,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [colors.beam]);

  // Zone material
  const zoneMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: colors.zone,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [colors.zone]);

  // Progress ring material (solid, brighter)
  const progressMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: colors.beam,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [colors.beam]);

  // Captured owner overlay material
  const capturedMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // Animate per frame
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Beam pulse
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      const time = performance.now() * 0.001;

      if (point.state === 'captured') {
        mat.opacity = 0.5 + Math.sin(time * 2) * 0.15;
      } else if (point.state === 'capturing') {
        mat.opacity = 0.3 + Math.sin(time * 4) * 0.2;
      } else if (point.state === 'contested') {
        mat.opacity = 0.2 + Math.sin(time * 6) * 0.15;
        mat.color.set('#FFFFFF'); // Flash white when contested
      } else {
        mat.opacity = 0.2 + Math.sin(time * 1.5) * 0.1;
        mat.color.set(colors.beam);
      }

      // War mode: more intense
      if (point.isWarPoint) {
        mat.opacity = Math.min(mat.opacity * 1.5, 1.0);
      }
    }

    // Zone opacity based on state
    if (zoneRef.current) {
      const mat = zoneRef.current.material as THREE.MeshBasicMaterial;
      switch (point.state) {
        case 'neutral':
          mat.opacity = 0.08;
          break;
        case 'capturing':
          mat.opacity = 0.15 + point.progress * 0.15;
          break;
        case 'contested':
          mat.opacity = 0.12;
          mat.color.set('#FFFFFF');
          break;
        case 'captured':
          mat.opacity = 0.25;
          mat.color.set(colors.zone);
          break;
      }
    }

    // Progress ring scale
    if (progressRef.current) {
      const scale = Math.max(0.01, point.progress);
      progressRef.current.scale.set(scale, scale, 1);
      const mat = progressRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = point.state === 'capturing' ? 0.5 : 0;
    }

    // Glow light
    if (glowRef.current) {
      glowRef.current.intensity = point.state === 'captured' ? 2.0 : point.state === 'capturing' ? 1.0 : 0.3;
      if (point.isWarPoint) {
        glowRef.current.intensity *= 1.5;
      }
    }
  });

  // Convert from 2D game coords to 3D scene coords
  const posX = point.x / 20; // Scale factor
  const posZ = point.y / 20;

  return (
    <group ref={groupRef} position={[posX, 0, posZ]}>
      {/* Ground zone circle */}
      <mesh
        ref={zoneRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        material={zoneMat}
      >
        <circleGeometry args={[ZONE_RADIUS, RING_SEGMENTS]} />
      </mesh>

      {/* Progress ring (shows capture progress) */}
      <mesh
        ref={progressRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        material={progressMat}
      >
        <ringGeometry args={[ZONE_RADIUS * 0.85, ZONE_RADIUS, RING_SEGMENTS]} />
      </mesh>

      {/* Captured overlay ring */}
      {point.state === 'captured' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.07, 0]}
          material={capturedMat}
        >
          <ringGeometry args={[ZONE_RADIUS * 0.9, ZONE_RADIUS * 0.95, RING_SEGMENTS]} />
        </mesh>
      )}

      {/* Vertical beam pillar */}
      <mesh
        ref={beamRef}
        position={[0, BEAM_HEIGHT / 2, 0]}
        material={beamMat}
      >
        <cylinderGeometry args={[BEAM_RADIUS, BEAM_RADIUS * 1.5, BEAM_HEIGHT, 8, 1, true]} />
      </mesh>

      {/* War mode: wider outer beam */}
      {point.isWarPoint && (
        <mesh
          position={[0, BEAM_HEIGHT / 2, 0]}
        >
          <cylinderGeometry args={[BEAM_RADIUS * 2, BEAM_RADIUS * 3, BEAM_HEIGHT, 8, 1, true]} />
          <meshBasicMaterial
            color="#FF0000"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Point light for glow */}
      <pointLight
        ref={glowRef}
        position={[0, 2, 0]}
        color={colors.glow}
        intensity={0.5}
        distance={ZONE_RADIUS * 4}
        decay={2}
      />
    </group>
  );
}

// ─── Main Renderer ───

export function CapturePointRenderer({ capturePoints }: CapturePointRendererProps) {
  if (!capturePoints || capturePoints.length === 0) return null;

  return (
    <group name="capture-points">
      {capturePoints.map((point) => (
        <CapturePointMesh key={point.id} point={point} />
      ))}
    </group>
  );
}
