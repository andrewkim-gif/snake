'use client';

/**
 * CountryLayer — Country borders, polygon hover highlight, hover border glow.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { loadGeoJSON } from '@/lib/globe-data';
import {
  buildBorderPositions,
  buildPerCountryBorders,
  GLOBE_RADIUS,
  type CountryGeo,
  type CountryBorderGeoData,
} from '@/lib/globe-geo';

// 모듈 레벨 호버 참조 (GlobeInteractionLayer에서 write, 여기서 read)
import { getHoveredIso3 } from '@/components/3d/GlobeInteractionLayer';

// ─── CountryBorders (단일 배치 LineSegments) ───

function CountryBorders() {
  const { size } = useThree();
  const [line, setLine] = useState<LineSegments2 | null>(null);

  useEffect(() => {
    loadGeoJSON().then((data) => {
      const positions = buildBorderPositions(data);
      const geo = new LineSegmentsGeometry();
      geo.setPositions(positions);
      const mat = new LineMaterial({
        color: 0x000000,
        linewidth: 1.2,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      mat.resolution.set(size.width, size.height);
      setLine(new LineSegments2(geo, mat));
    }).catch(console.error);
    return () => {
      if (line) {
        line.geometry.dispose();
        (line.material as LineMaterial).dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (line) (line.material as LineMaterial).resolution.set(size.width, size.height);
  }, [size, line]);

  if (!line) return null;
  return <primitive object={line} />;
}

// ─── CountryHoverHighlight ───

const _hoverColor = new THREE.Color('#4DA6D9');

function CountryHoverHighlight({ countries }: { countries: CountryGeo[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const prevIso = useRef<string | null>(null);
  const fadeRef = useRef(0);

  const geoMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const c of countries) map.set(c.iso3, c.geometry);
    return map;
  }, [countries]);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const hovIso = getHoveredIso3();
    const target = hovIso ? 1 : 0;
    fadeRef.current += (target - fadeRef.current) * 0.18;
    if (fadeRef.current < 0.005) fadeRef.current = 0;
    if (fadeRef.current > 0.995) fadeRef.current = 1;

    if (hovIso !== prevIso.current) {
      prevIso.current = hovIso;
      if (hovIso) {
        const geo = geoMap.get(hovIso);
        if (geo) {
          mesh.geometry = geo;
          mesh.visible = true;
          fadeRef.current = 0.15;
        } else {
          mesh.visible = false;
        }
      }
    }

    if (!hovIso) {
      if (fadeRef.current < 0.01) mesh.visible = false;
    }
    mat.opacity = fadeRef.current * 0.35;
  });

  return (
    <mesh ref={meshRef} visible={false} renderOrder={1}>
      <bufferGeometry />
      <meshBasicMaterial
        ref={matRef}
        color={_hoverColor}
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

// ─── HoverBorderGlow (traveling light pulse) ───

function HoverBorderGlow() {
  const borderDataRef = useRef<Map<string, CountryBorderGeoData>>(new Map());
  const lineRef = useRef<THREE.LineSegments>(null);
  const prevIso = useRef<string | null>(null);
  const fadeRef = useRef(0);
  const [loaded, setLoaded] = useState(false);

  const shaderMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTotalLength: { value: 1 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float aDistance;
      varying float vDist;
      void main() {
        vDist = aDistance;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTotalLength;
      uniform float uOpacity;
      varying float vDist;
      void main() {
        float dashSize = 3.0;
        float t = fract(vDist / dashSize - uTime * 1.5);
        float dash = smoothstep(0.0, 0.08, t) * smoothstep(0.5, 0.42, t);
        vec3 col = vec3(0.35, 0.75, 1.0);
        gl_FragColor = vec4(col * dash * uOpacity, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useEffect(() => {
    loadGeoJSON().then((data) => {
      borderDataRef.current = buildPerCountryBorders(data);
      setLoaded(true);
    }).catch(console.error);
    return () => {
      borderDataRef.current.forEach((d) => d.geometry.dispose());
      borderDataRef.current.clear();
    };
  }, []);

  useFrame(({ clock }) => {
    const line = lineRef.current;
    if (!line) return;

    const hovIso = getHoveredIso3();
    const target = hovIso ? 1 : 0;
    fadeRef.current += (target - fadeRef.current) * 0.15;
    if (fadeRef.current < 0.005) fadeRef.current = 0;
    if (fadeRef.current > 0.995) fadeRef.current = 1;

    if (hovIso !== prevIso.current) {
      prevIso.current = hovIso;
      if (hovIso) {
        const data = borderDataRef.current.get(hovIso);
        if (data) {
          line.geometry = data.geometry;
          line.visible = true;
          shaderMat.uniforms.uTotalLength.value = data.totalLength;
          fadeRef.current = 0.1;
        } else {
          line.visible = false;
        }
      }
    }

    if (!hovIso && fadeRef.current < 0.01) {
      line.visible = false;
    }

    shaderMat.uniforms.uTime.value = clock.getElapsedTime();
    shaderMat.uniforms.uOpacity.value = fadeRef.current;
  });

  if (!loaded) return null;

  return (
    <lineSegments ref={lineRef} visible={false} material={shaderMat} renderOrder={2}>
      <bufferGeometry />
    </lineSegments>
  );
}

// ─── CountryPolygons (wrapper) ───

function CountryPolygons({ countries }: { countries: CountryGeo[] }) {
  // CountryLabels is now in GlobeCountryNameLabels.tsx — imported by GlobeScene directly
  return (
    <group>
      {countries.length > 0 && (
        <CountryHoverHighlight countries={countries} />
      )}
    </group>
  );
}

// ─── Exported Composite ───

export interface CountryLayerProps {
  countries: CountryGeo[];
}

export function CountryLayer({ countries }: CountryLayerProps) {
  return (
    <>
      <CountryBorders />
      <CountryPolygons countries={countries} />
      <HoverBorderGlow />
    </>
  );
}
