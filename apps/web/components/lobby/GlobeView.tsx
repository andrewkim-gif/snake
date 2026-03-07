'use client';

/**
 * GlobeScene v5 — Step 3: 구체 텍스처 + 국가 폴리곤
 * earth-blue-marble 텍스처 + GeoJSON earcut 삼각분할
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Canvas, useThree, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import earcut from 'earcut';
import { loadGeoJSON } from '@/lib/globe-data';
import { getCountryISO } from '@/lib/map-style';
import type { CountryClientState } from '@/lib/globe-data';

// v14: Globe domination + war effects
import { GlobeDominationLayer } from '@/components/3d/GlobeDominationLayer';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import { GlobeWarEffects } from '@/components/3d/GlobeWarEffects';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';

// v15: Flag atlas + country labels
import { GlobeCountryLabels } from '@/components/3d/GlobeCountryLabels';
import { loadFlagAtlas } from '@/lib/flag-atlas';
import type { FlagAtlasResult } from '@/lib/flag-atlas';
import { COUNTRIES } from '@/lib/country-data';

interface GlobeViewProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  style?: React.CSSProperties;
  /** v14: Domination overlay data */
  dominationStates?: Map<string, CountryDominationState>;
  /** v14: Active war effects data */
  wars?: WarEffectData[];
  /** v14: Country centroids for war arc rendering */
  countryCentroids?: Map<string, [number, number]>;
  /** v14: Hover callback for GlobeHoverPanel (iso3, name, or null to clear) */
  onHover?: (iso3: string | null, name: string | null) => void;
}

const BG = '#030305';
const RADIUS = 100;
const ALT = 0.15; // 구체 표면 밀착 (최소 z-fighting 방지 오프셋)

// ─── 좌표 변환: (lon, lat) → 구면 (x, y, z) ───

function geoToXYZ(
  lon: number, lat: number, r: number,
  out: Float32Array, offset: number,
) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  out[offset]     = -r * Math.sin(phi) * Math.cos(theta);
  out[offset + 1] =  r * Math.cos(phi);
  out[offset + 2] =  r * Math.sin(phi) * Math.sin(theta);
}

// ─── 역변환: 구면 (x, y, z) → (lon, lat) ───

function xyzToGeo(point: THREE.Vector3, _r: number): [number, number] {
  const r = point.length();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, point.y / r))) * (180 / Math.PI);
  let lon = Math.atan2(point.z, -point.x) * (180 / Math.PI) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return [lon, lat];
}

// ─── 점-다각형 내부 판별 (Ray Casting) ───

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function findCountryAtPoint(
  lon: number, lat: number, features: any[],
): { iso3: string; name: string } | null {
  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const { type, coordinates } = geom;
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];
    for (const rings of polygons) {
      if (pointInRing(lon, lat, rings[0])) {
        let inHole = false;
        for (let h = 1; h < rings.length; h++) {
          if (pointInRing(lon, lat, rings[h])) { inHole = true; break; }
        }
        if (!inHole) {
          const props = feature.properties || {};
          const iso3 = getCountryISO(props);
          const name = (props.NAME || props.ADMIN || iso3) as string;
          return iso3 ? { iso3, name } : null;
        }
      }
    }
  }
  return null;
}

// 모듈 레벨 호버 상태 (useFrame 읽기 / 이벤트 핸들러 쓰기)
let _hoveredIso3: string | null = null;

// ─── 변 세분화 (구면 곡률 보정) ───

const MAX_DEG = 2; // 2° 이상 변은 분할 → 삼각형이 구면에 밀착

function subdivideRing(ring: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    result.push([lon1, lat1]);
    const dlon = lon2 - lon1;
    const dlat = lat2 - lat1;
    const dist = Math.sqrt(dlon * dlon + dlat * dlat);
    if (dist > MAX_DEG) {
      const segs = Math.ceil(dist / MAX_DEG);
      for (let j = 1; j < segs; j++) {
        const t = j / segs;
        result.push([lon1 + dlon * t, lat1 + dlat * t]);
      }
    }
  }
  // 마지막 점 (닫힌 링의 끝점)
  result.push(ring[ring.length - 1]);
  return result;
}

// ─── 폴리곤 삼각분할 ───

function triangulatePolygon(
  rings: number[][][],
  radius: number,
): Float32Array | null {
  if (!rings || rings.length === 0 || rings[0].length < 3) return null;

  // 각 링의 변을 세분화 (큰 삼각형 → 구면 처짐 방지)
  const subdividedRings = rings.map(subdivideRing);

  // earcut용 2D 좌표 + 홀 인덱스
  const flat: number[] = [];
  const holes: number[] = [];

  for (let i = 0; i < subdividedRings.length; i++) {
    if (i > 0) holes.push(flat.length / 2);
    for (const coord of subdividedRings[i]) {
      flat.push(coord[0], coord[1]); // lon, lat
    }
  }

  const indices = earcut(flat, holes.length > 0 ? holes : undefined, 2);
  if (indices.length === 0) return null;

  // 삼각 인덱스 → 3D 구면 좌표
  const raw = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const lon = flat[idx * 2];
    const lat = flat[idx * 2 + 1];
    geoToXYZ(lon, lat, radius, raw, i * 3);
  }

  // 큰 삼각형 재분할 → 구면 밀착
  return subdivideSphericalMesh(raw, radius, MAX_EDGE_3D);
}

// ─── 삼각형 재분할 + 구면 재투영 ───
// earcut이 만든 큰 내부 삼각형을 쪼개서 구면 곡률에 밀착시킴

function subdivideSphericalMesh(
  verts: Float32Array, radius: number, maxEdge: number,
): Float32Array {
  let tris = Array.from(verts);

  for (let iter = 0; iter < 6; iter++) {
    const next: number[] = [];
    let didSplit = false;

    for (let i = 0; i < tris.length; i += 9) {
      const ax = tris[i],   ay = tris[i+1], az = tris[i+2];
      const bx = tris[i+3], by = tris[i+4], bz = tris[i+5];
      const cx = tris[i+6], cy = tris[i+7], cz = tris[i+8];

      const dAB = Math.sqrt((bx-ax)**2 + (by-ay)**2 + (bz-az)**2);
      const dBC = Math.sqrt((cx-bx)**2 + (cy-by)**2 + (cz-bz)**2);
      const dCA = Math.sqrt((ax-cx)**2 + (ay-cy)**2 + (az-cz)**2);
      const maxD = Math.max(dAB, dBC, dCA);

      if (maxD <= maxEdge) {
        next.push(ax,ay,az, bx,by,bz, cx,cy,cz);
        continue;
      }

      didSplit = true;
      // 가장 긴 변의 중점 → 구면에 재투영
      let mx: number, my: number, mz: number;

      if (dAB >= dBC && dAB >= dCA) {
        mx = (ax+bx)/2; my = (ay+by)/2; mz = (az+bz)/2;
        const s = radius / Math.sqrt(mx*mx + my*my + mz*mz);
        mx *= s; my *= s; mz *= s;
        next.push(ax,ay,az, mx,my,mz, cx,cy,cz);
        next.push(mx,my,mz, bx,by,bz, cx,cy,cz);
      } else if (dBC >= dCA) {
        mx = (bx+cx)/2; my = (by+cy)/2; mz = (bz+cz)/2;
        const s = radius / Math.sqrt(mx*mx + my*my + mz*mz);
        mx *= s; my *= s; mz *= s;
        next.push(ax,ay,az, bx,by,bz, mx,my,mz);
        next.push(ax,ay,az, mx,my,mz, cx,cy,cz);
      } else {
        mx = (cx+ax)/2; my = (cy+ay)/2; mz = (cz+az)/2;
        const s = radius / Math.sqrt(mx*mx + my*my + mz*mz);
        mx *= s; my *= s; mz *= s;
        next.push(ax,ay,az, bx,by,bz, mx,my,mz);
        next.push(mx,my,mz, bx,by,bz, cx,cy,cz);
      }
    }

    tris = next;
    if (!didSplit) break;
  }

  return new Float32Array(tris);
}

// 5° 호에 해당하는 현 길이 (R=102 기준 ≈ 8.9)
const MAX_EDGE_3D = 2 * (RADIUS + ALT) * Math.sin(5 * Math.PI / 360);

// ─── GeoJSON → BufferGeometry 배열 ───

interface CountryGeo {
  iso3: string;
  name: string;
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
}

const LABEL_R = RADIUS + ALT + 2; // 라벨 높이 (폴리곤 위)

// 가장 큰 폴리곤 파트의 중심점 계산
function computeCentroid(polygons: number[][][][]): [number, number] {
  let bestRing = polygons[0][0];
  for (const rings of polygons) {
    if (rings[0].length > bestRing.length) bestRing = rings[0];
  }
  let sLon = 0, sLat = 0;
  for (const [lon, lat] of bestRing) { sLon += lon; sLat += lat; }
  return [sLon / bestRing.length, sLat / bestRing.length];
}

function buildCountryGeometries(geoData: { features: any[] }): CountryGeo[] {
  const result: CountryGeo[] = [];

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const props = feature.properties || {};
    const iso3 = getCountryISO(props);
    if (!iso3) continue;

    const name = (props.NAME || props.ADMIN || iso3) as string;
    const { type, coordinates } = geom;

    // Polygon / MultiPolygon → 통일된 배열
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    if (polygons.length === 0) continue;

    // 각 파트 삼각분할 후 병합
    const parts: Float32Array[] = [];
    for (const rings of polygons) {
      const verts = triangulatePolygon(rings, RADIUS + ALT);
      if (verts) parts.push(verts);
    }
    if (parts.length === 0) continue;

    const total = parts.reduce((s, v) => s + v.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const v of parts) { merged.set(v, off); off += v.length; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    geo.computeVertexNormals();

    // 중심점 → 3D 좌표
    const [cLon, cLat] = computeCentroid(polygons);
    const tmp = new Float32Array(3);
    geoToXYZ(cLon, cLat, LABEL_R, tmp, 0);
    const centroid = new THREE.Vector3(tmp[0], tmp[1], tmp[2]);

    result.push({ iso3, name, geometry: geo, centroid });
  }

  return result;
}

// ─── R3F: 지구 텍스처 구체 ───

function EarthSphere() {
  const texture = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  const shadowRef = useRef<THREE.Mesh>(null);

  // 밤/낮 오버레이: 태양 반대편에 반투명 검정 반구를 씌움
  const nightMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: new THREE.Vector3(1, 0, 0) } },
    vertexShader: `
      varying vec3 vWorldNormal;
      void main() {
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      varying vec3 vWorldNormal;
      void main() {
        float NdotL = dot(vWorldNormal, uSunDir);
        // 부드러운 터미네이터: -0.1 ~ 0.3 구간에서 전환
        float night = 1.0 - smoothstep(-0.1, 0.3, NdotL);
        // 낮 면: 약간 어둡게 (0.25), 밤 면: 많이 어둡게 (0.7)
        float darkness = mix(0.25, 0.7, night);
        gl_FragColor = vec4(0.01, 0.02, 0.06, darkness);
      }
    `,
    transparent: true,
    depthWrite: false,
  }), []);

  useFrame(() => {
    if (!shadowRef.current) return;
    // SunLight와 동일한 태양 위치 계산
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const sx = Math.cos(decRad) * Math.cos(ha);
    const sy = Math.sin(decRad);
    const sz = Math.cos(decRad) * Math.sin(ha);
    nightMat.uniforms.uSunDir.value.set(sx, sy, sz).normalize();
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      {/* 밤/낮 셰도우 오버레이 (텍스처 위에 반투명 렌더링) */}
      <mesh ref={shadowRef} material={nightMat}>
        <sphereGeometry args={[RADIUS + 0.1, 64, 64]} />
      </mesh>
    </group>
  );
}

// ─── R3F: 실시간 태양 (UTC 기반 위치 + 코로나 글로우) ───

function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Group>(null);

  // 태양 코로나 글로우 (캔버스 라디얼 그래디언트)
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.15, 'rgba(255,240,200,0.6)');
    g.addColorStop(0.4, 'rgba(255,220,150,0.12)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    // 태양 적위 (지축 23.44° 기울기)
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    // 시간각: UTC 12시 = 본초자오선(경도 0°) 정오
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const d = 500;
    const x = d * Math.cos(decRad) * Math.cos(ha);
    const y = d * Math.sin(decRad);
    const z = d * Math.cos(decRad) * Math.sin(ha);
    lightRef.current?.position.set(x, y, z);
    sunRef.current?.position.set(x, y, z);
  });

  return (
    <>
      <directionalLight ref={lightRef} intensity={1.15} color="#FFF8F0" />
      <group ref={sunRef}>
        {/* 태양 코어 */}
        <mesh>
          <sphereGeometry args={[5, 16, 16]} />
          <meshBasicMaterial color="#FFF8E0" toneMapped={false} />
        </mesh>
        {/* 태양 코로나 글로우 */}
        <sprite scale={[120, 120, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
    </>
  );
}

// ─── R3F: 배경 별 (셰이더 깜빡임 + 항성 스펙트럼 색상) ───

function Starfield() {
  const COUNT = 4000;
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    // 항성 스펙트럼 유형별 색상 (O/B 청백 → K 주황)
    const starColors: [number, number, number][] = [
      [0.7, 0.8, 1.0], [0.85, 0.9, 1.0], [1.0, 1.0, 1.0],
      [1.0, 0.96, 0.85], [1.0, 0.88, 0.7],
    ];
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 650 + Math.random() * 250;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      // 밝기: 멱급수 분포 (대부분 어둡고, 소수만 밝음)
      const brightness = Math.pow(Math.random(), 3);
      sizes[i] = 0.6 + brightness * 3.5;
      const c = starColors[Math.floor(Math.random() * starColors.length)];
      const b = 0.4 + brightness * 0.6;
      colors[i * 3] = c[0] * b;
      colors[i * 3 + 1] = c[1] * b;
      colors[i * 3 + 2] = c[2] * b;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          float twinkle = 0.6 + 0.4 * sin(uTime * (0.3 + aPhase * 0.8) + aPhase * 6.283);
          vAlpha = twinkle;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (1.0 + 0.15 * sin(uTime * 0.5 + aPhase * 3.14));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.15, d) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <points geometry={geometry} material={material} />;
}

// ─── R3F: 대기 글로우 (림 라이트 효과) ───

function AtmosphereGlow() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.1, 0.3, 0.6, 1.0) * intensity;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
  }, []);

  return (
    <mesh material={material}>
      <sphereGeometry args={[RADIUS * 1.05, 32, 32]} />
    </mesh>
  );
}

// ─── R3F: 국가 경계선 (단일 배치 LineSegments) ───

function buildBorderPositions(geoData: { features: any[] }): Float32Array {
  const segs: number[] = [];
  const borderR = RADIUS + 0.15; // 지구 표면에 밀착 (z-fighting 방지 최소 오프셋)
  const tmp1 = new Float32Array(3);
  const tmp2 = new Float32Array(3);

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const { type, coordinates } = geom;
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    for (const rings of polygons) {
      const ring = subdivideRing(rings[0]);
      for (let i = 0; i < ring.length - 1; i++) {
        geoToXYZ(ring[i][0], ring[i][1], borderR, tmp1, 0);
        geoToXYZ(ring[i + 1][0], ring[i + 1][1], borderR, tmp2, 0);
        segs.push(tmp1[0], tmp1[1], tmp1[2], tmp2[0], tmp2[1], tmp2[2]);
      }
    }
  }
  return new Float32Array(segs);
}

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

  // 캔버스 리사이즈 시 해상도 업데이트
  useEffect(() => {
    if (line) (line.material as LineMaterial).resolution.set(size.width, size.height);
  }, [size, line]);

  if (!line) return null;
  return <primitive object={line} />;
}

// ─── R3F: 국가 인터랙션 (레이캐스트 → 국가 감지 + 클릭) ───

const CLICK_DRAG_THRESHOLD = 25; // 5px² — 이 이상 움직이면 드래그로 판정

function GlobeInteraction({ onCountryClick, onHover }: { onCountryClick?: (iso3: string, name: string) => void; onHover?: (iso3: string | null, name: string | null) => void }) {
  const featuresRef = useRef<any[]>([]);
  const hoveredRef = useRef<{ iso3: string; name: string } | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadGeoJSON().then((data) => { featuresRef.current = data.features; }).catch(console.error);
    return () => { document.body.style.cursor = 'default'; };
  }, []);

  const handlePointerMove = useCallback((e: any) => {
    e.stopPropagation();
    const point = e.point as THREE.Vector3;
    const [lon, lat] = xyzToGeo(point, RADIUS);
    const hit = findCountryAtPoint(lon, lat, featuresRef.current);
    if (hit) {
      _hoveredIso3 = hit.iso3;
      hoveredRef.current = hit;
      document.body.style.cursor = 'pointer';
      onHover?.(hit.iso3, hit.name);
    } else {
      _hoveredIso3 = null;
      hoveredRef.current = null;
      document.body.style.cursor = 'default';
      onHover?.(null, null);
    }
  }, [onHover]);

  // 드래그 시작 지점 기록
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    const ne = e.nativeEvent as PointerEvent;
    pointerDownPos.current = { x: ne.clientX, y: ne.clientY };
  }, []);

  // 클릭: 드래그 거리가 임계값 미만일 때만 국가 선택
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    const ne = e.nativeEvent as PointerEvent;
    if (pointerDownPos.current) {
      const dx = ne.clientX - pointerDownPos.current.x;
      const dy = ne.clientY - pointerDownPos.current.y;
      if (dx * dx + dy * dy > CLICK_DRAG_THRESHOLD) return; // 드래그 → 무시
    }
    if (hoveredRef.current && onCountryClick) {
      onCountryClick(hoveredRef.current.iso3, hoveredRef.current.name);
    }
  }, [onCountryClick]);

  const handlePointerLeave = useCallback(() => {
    _hoveredIso3 = null;
    hoveredRef.current = null;
    document.body.style.cursor = 'default';
    onHover?.(null, null);
  }, [onHover]);

  return (
    <mesh
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onPointerLeave={handlePointerLeave}
    >
      <sphereGeometry args={[RADIUS + 3, 64, 64]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ─── R3F: 호버 국가 폴리곤 하이라이트 ───

const _hoverColor = new THREE.Color('#4DA6D9');

function CountryHoverHighlight({ countries }: { countries: CountryGeo[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const prevIso = useRef<string | null>(null);
  const fadeRef = useRef(0); // 0=투명, 1=완전 표시

  // iso3 → geometry 맵 (빠른 조회)
  const geoMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const c of countries) map.set(c.iso3, c.geometry);
    return map;
  }, [countries]);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const hovIso = _hoveredIso3;
    const target = hovIso ? 1 : 0;
    fadeRef.current += (target - fadeRef.current) * 0.18;
    if (fadeRef.current < 0.005) fadeRef.current = 0;
    if (fadeRef.current > 0.995) fadeRef.current = 1;

    // 호버 대상 변경 시 geometry 교체
    if (hovIso !== prevIso.current) {
      prevIso.current = hovIso;
      if (hovIso) {
        const geo = geoMap.get(hovIso);
        if (geo) {
          mesh.geometry = geo;
          mesh.visible = true;
          fadeRef.current = 0.15; // 약간의 즉시 표시
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

// ─── R3F: 호버 경계선 빛 효과 (traveling light pulse) ───

interface CountryBorderGeoData {
  geometry: THREE.BufferGeometry;
  totalLength: number;
}

function buildPerCountryBorders(geoData: { features: any[] }): Map<string, CountryBorderGeoData> {
  const map = new Map<string, CountryBorderGeoData>();
  const borderR = RADIUS + ALT + 0.05;
  const tmp1 = new Float32Array(3);
  const tmp2 = new Float32Array(3);

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const props = feature.properties || {};
    const iso3 = getCountryISO(props);
    if (!iso3) continue;

    const { type, coordinates } = geom;
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    const positions: number[] = [];
    const dists: number[] = [];
    let cumDist = 0;

    for (const rings of polygons) {
      const ring = subdivideRing(rings[0]);
      for (let i = 0; i < ring.length - 1; i++) {
        geoToXYZ(ring[i][0], ring[i][1], borderR, tmp1, 0);
        geoToXYZ(ring[i + 1][0], ring[i + 1][1], borderR, tmp2, 0);
        positions.push(tmp1[0], tmp1[1], tmp1[2]);
        dists.push(cumDist);
        const dx = tmp2[0] - tmp1[0], dy = tmp2[1] - tmp1[1], dz = tmp2[2] - tmp1[2];
        cumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
        positions.push(tmp2[0], tmp2[1], tmp2[2]);
        dists.push(cumDist);
      }
    }

    if (positions.length === 0) continue;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aDistance', new THREE.Float32BufferAttribute(dists, 1));
    map.set(iso3, { geometry: geo, totalLength: cumDist });
  }

  return map;
}

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
        // 움직이는 점선 — 월드 좌표 기반 일정 간격
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

    const hovIso = _hoveredIso3;
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

// ─── R3F: 국가 폴리곤 렌더러 ───

function CountryPolygons({ countries }: { countries: CountryGeo[] }) {
  return (
    <group>
      {countries.length > 0 && (
        <>
          <CountryHoverHighlight countries={countries} />
          <CountryLabels countries={countries} />
        </>
      )}
    </group>
  );
}

// ─── R3F: 국가 라벨 (빌보드 + 오클루전 + 호버 확대 애니메이션) ───

// 라벨 호버 색상 (모듈 레벨 — GC 방지)
const _labelBaseCol = new THREE.Color('#E8E0D4');
const _labelHoverCol = new THREE.Color('#4DA6D9'); // 전술 사이안
const HOVER_SCALE_MUL = 1.6; // 호버 시 기본 스케일 대비 확대 배율

// 화면 중앙 기반 라벨 페이드 상수
const LABEL_SCREEN_FULL = 0.3;  // NDC 거리 0~0.3: 100% 스케일/투명도
const LABEL_SCREEN_HIDE = 1.1;  // NDC 거리 1.1+: 완전 투명 (화면 밖 근처)
const LABEL_CAM_HIDE = 450;     // 카메라 거리 450+ → 모든 라벨 숨김
const LABEL_CAM_FADE = 320;     // 카메라 거리 320부터 페이드 시작

// 스크린 프로젝션용 임시 벡터 (모듈 레벨 — GC 방지)
const _proj = new THREE.Vector3();

function CountryLabels({ countries }: { countries: CountryGeo[] }) {
  const { camera } = useThree();
  const refs = useRef<(THREE.Group | null)[]>([]);
  // 라벨별 호버 진행도 (0=기본, 1=호버 완료) — 부드러운 전환용
  const hoverProgress = useRef<Float32Array>(new Float32Array(0));

  // 각 라벨의 법선 벡터 — 1회만 계산
  const normals = useMemo(
    () => countries.map((c) => c.centroid.clone().normalize()),
    [countries],
  );

  const _cam = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    // 라벨 수 변경 시 배열 재할당
    if (hoverProgress.current.length !== countries.length) {
      hoverProgress.current = new Float32Array(countries.length);
    }

    const camDist = camera.position.length();

    // ── 줌 아웃 시 전체 페이드 (320~450 구간) ──
    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - LABEL_CAM_FADE) / (LABEL_CAM_HIDE - LABEL_CAM_FADE), 0, 1,
    );
    if (zoomFade <= 0) {
      refs.current.forEach((g) => { if (g) g.visible = false; });
      return;
    }

    // 거리 기반 기본 스케일: 가까울수록 크게 (150→1.1x, 500→0.8x)
    const t = THREE.MathUtils.clamp((camDist - 150) / 350, 0, 1);
    const baseScale = THREE.MathUtils.lerp(1.1, 0.8, t);

    const hovIso = _hoveredIso3;
    _cam.copy(camera.position).normalize();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const dot = normals[i].dot(_cam);

      // 뒷면 오클루전: dot < 0.05 → 숨김
      g.visible = dot > 0.05;
      if (!g.visible) return;

      g.quaternion.copy(camera.quaternion);

      // ── 화면 중앙 기반 페이드: NDC 좌표로 투영 후 중앙 거리 계산 ──
      _proj.copy(countries[i].centroid).project(camera);
      const screenDist = Math.sqrt(_proj.x * _proj.x + _proj.y * _proj.y);
      const raw = 1 - THREE.MathUtils.clamp(
        (screenDist - LABEL_SCREEN_FULL) / (LABEL_SCREEN_HIDE - LABEL_SCREEN_FULL), 0, 1,
      );
      const centerFade = raw * raw * (3 - 2 * raw); // smoothstep

      // 호버 진행도 lerp (0→1: 확대, 1→0: 복귀)
      const isHovered = hovIso === countries[i].iso3;
      const target = isHovered ? 1 : 0;
      hoverProgress.current[i] += (target - hoverProgress.current[i]) * 0.12;
      if (hoverProgress.current[i] < 0.01) hoverProgress.current[i] = 0;
      if (hoverProgress.current[i] > 0.99) hoverProgress.current[i] = 1;

      const p = hoverProgress.current[i];

      // 스케일 = baseScale × centerFade(0.5~1.0) × hoverMul
      const scaleFade = 0.5 + 0.5 * centerFade; // 가장자리: 50%, 중앙: 100%
      const hoverMul = 1 + (HOVER_SCALE_MUL - 1) * p;
      g.scale.setScalar(baseScale * scaleFade * hoverMul);

      // troika Text: fillOpacity로 투명도 제어 (material.opacity는 무시됨)
      const textMesh = g.children[0] as any;
      if (textMesh) {
        const alpha = Math.max(centerFade * zoomFade, p);
        textMesh.fillOpacity = alpha;
        textMesh.outlineOpacity = alpha;
        // 색상 전환: troika DerivedMaterial의 color uniform
        if (textMesh.material?.color) {
          textMesh.material.color.lerpColors(_labelBaseCol, _labelHoverCol, p);
        }
      }
    });
  });

  return (
    <>
      {countries.map((c, i) => (
        <group
          key={c.iso3}
          position={c.centroid}
          ref={(el) => { refs.current[i] = el; }}
        >
          <Text
            fontSize={1.5}
            color="#E8E0D4"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.1}
            outlineColor="#111111"
            letterSpacing={0.06}
            fontWeight={700}
          >
            {c.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </>
  );
}

// ─── R3F: SizeGate (Canvas 리사이즈 대기) ───

function SizeGate({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready && size.width > 100 && size.height > 100) setReady(true);
  }, [size, ready]);
  return ready ? <>{children}</> : null;
}

// ─── R3F: 줌 레벨 적응형 OrbitControls ───
// 확대 시 rotateSpeed를 낮추고 damping을 높여 자연스러운 회전 제공

const MIN_DIST = 150;
const MAX_DIST = 500;
const ROTATE_SPEED_CLOSE = 0.2;   // 최대 확대 시 (느린 정밀 회전)
const ROTATE_SPEED_FAR = 0.8;     // 최대 축소 시 (빠른 전체 회전)
const DAMPING_CLOSE = 0.08;       // 확대 시 부드러운 감속
const DAMPING_FAR = 0.05;         // 축소 시 표준 감속

function AdaptiveOrbitControls() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dist = camera.position.length();
    // 0(최근접) → 1(최원거리) 정규화
    const t = THREE.MathUtils.clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
    // easeOutQuad 커브: 확대 시 속도 감소가 더 급격하게 느껴지도록
    const ease = 1 - (1 - t) * (1 - t);

    controls.rotateSpeed = THREE.MathUtils.lerp(ROTATE_SPEED_CLOSE, ROTATE_SPEED_FAR, ease);
    controls.dampingFactor = THREE.MathUtils.lerp(DAMPING_CLOSE, DAMPING_FAR, ease);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      enableDamping
      dampingFactor={DAMPING_FAR}
      rotateSpeed={ROTATE_SPEED_FAR}
      zoomSpeed={0.8}
    />
  );
}

// ─── 3D 타이틀: "AI WORLD WAR" 글로브 위 이미지 텍스처 (Last of Us 스타일) ───

function GlobeTitle() {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const texture = useTexture('/assets/generated/title-3d.png');

  useFrame((state) => {
    if (!groupRef.current) return;
    // 빌보드: 항상 카메라를 향함
    groupRef.current.quaternion.copy(camera.quaternion);
    // 부유 애니메이션: 부드러운 상하 흔들림
    groupRef.current.position.y = 138 + Math.sin(state.clock.elapsedTime * 0.5) * 1.5;
  });

  // 텍스처 비율에 맞춰 plane 크기 설정
  const aspect = texture.image ? texture.image.width / texture.image.height : 4;
  const planeHeight = 18;
  const planeWidth = planeHeight * aspect;

  return (
    <group ref={groupRef} position={[0, 138, 0]}>
      <mesh>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── R3F: GeoJSON 데이터 로더 + 씬 구성 (Canvas 내부) ───
// Country geometries와 centroids를 로드하여 하위 컴포넌트에 전달

function GlobeScene({
  onCountryClick,
  onHover,
  dominationStates,
  wars,
  countryStates,
}: {
  onCountryClick?: (iso3: string, name: string) => void;
  onHover?: (iso3: string | null, name: string | null) => void;
  dominationStates: Map<string, CountryDominationState>;
  wars: WarEffectData[];
  countryStates: Map<string, CountryClientState>;
}) {
  const [countries, setCountries] = useState<CountryGeo[]>([]);
  const [flagAtlas, setFlagAtlas] = useState<FlagAtlasResult | null>(null);

  // GeoJSON → CountryGeo[] 로드 (1회)
  useEffect(() => {
    loadGeoJSON()
      .then((data) => setCountries(buildCountryGeometries(data)))
      .catch(console.error);

    return () => {
      setCountries((prev) => {
        prev.forEach((c) => c.geometry.dispose());
        return [];
      });
    };
  }, []);

  // v15: Flag atlas 로드 (1회)
  useEffect(() => {
    const iso2List = COUNTRIES.map((c) => c.iso2);
    loadFlagAtlas(iso2List).then(setFlagAtlas).catch(console.error);
  }, []);

  // iso3 → BufferGeometry 맵 (GlobeDominationLayer용)
  const countryGeoMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const c of countries) map.set(c.iso3, c.geometry);
    return map;
  }, [countries]);

  // iso3 → [lat, lng] centroid 맵 (GlobeWarEffects용)
  // computeCentroid()은 [lon, lat] (GeoJSON 컨벤션)을 반환하므로 [lat, lng]로 스왑
  const centroidsMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const c of countries) {
      // centroid는 3D Vector3 → 역변환하여 [lat, lng] 추출
      const [lon, lat] = xyzToGeo(c.centroid, LABEL_R);
      map.set(c.iso3, [lat, lon]);
    }
    return map;
  }, [countries]);

  return (
    <>
      {/* 우주: 최소 ambient + 반구 필 + 실시간 태양 + 별 */}
      <ambientLight intensity={0.35} color="#1a2a4a" />
      <hemisphereLight args={['#334466', '#0a0e18', 0.25]} />
      <SunLight />
      <Starfield />
      {/* 지구 텍스처 구체 + 대기 글로우 */}
      <EarthSphere />
      <AtmosphereGlow />
      {/* 글로브 위 3D 타이틀 */}
      <GlobeTitle />
      {/* 국가 경계선 + 라벨 + 인터랙션 */}
      <CountryBorders />
      <CountryPolygons countries={countries} />
      <HoverBorderGlow />
      <GlobeInteraction onCountryClick={onCountryClick} onHover={onHover} />
      <AdaptiveOrbitControls />

      {/* v14: Domination color overlay (국가별 지배 색상) */}
      {dominationStates.size > 0 && (
        <GlobeDominationLayer
          dominationStates={dominationStates}
          countryGeometries={countryGeoMap}
          globeRadius={RADIUS}
        />
      )}

      {/* v14: War visual effects (아크라인, 영토 점멸, 폭발 파티클) */}
      {wars.length > 0 && (
        <GlobeWarEffects
          wars={wars}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
        />
      )}

      {/* v15: Country flag + agent count labels (국기 표시의 유일한 책임) */}
      {flagAtlas && centroidsMap.size > 0 && (
        <GlobeCountryLabels
          countryCentroids={centroidsMap}
          countryStates={countryStates}
          dominationStates={dominationStates}
          flagAtlas={flagAtlas}
          globeRadius={RADIUS}
        />
      )}
    </>
  );
}

// ─── 메인 컴포넌트 ───

export function GlobeView({
  countryStates,
  onCountryClick,
  style,
  dominationStates,
  wars,
  countryCentroids,
  onHover,
}: GlobeViewProps) {
  // v14: fallback empty maps/arrays for domination and war effects
  const domStates = dominationStates ?? new Map<string, CountryDominationState>();
  const warList = wars ?? [];
  const cStates = countryStates ?? new Map<string, CountryClientState>();

  return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', ...style }}>
      <Canvas
        camera={{ position: [0, 0, 300], fov: 50, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor(BG); }}
      >
        <SizeGate>
          <GlobeScene
            onCountryClick={onCountryClick}
            onHover={onHover}
            dominationStates={domStates}
            wars={warList}
            countryStates={cStates}
          />
        </SizeGate>
      </Canvas>
    </div>
  );
}
