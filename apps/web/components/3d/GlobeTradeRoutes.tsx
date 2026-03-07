'use client';

/**
 * GlobeTradeRoutes — v15 Phase 5
 * Trade route visualization on the 3D globe:
 * - Sea routes: blue dashed bezier curves
 * - Land routes: green solid bezier curves
 * - Moving cargo sprite dots along routes
 * - Line width = trade volume (1~4)
 * - Opacity = trade frequency (0.3~1.0)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import type { TradeRouteData } from '@/hooks/useSocket';

// ─── Types ───

export interface GlobeTradeRoutesProps {
  /** Active trade routes to visualize */
  tradeRoutes: TradeRouteData[];
  /** Map of ISO3 → [lat, lng] country centroids */
  countryCentroids: Map<string, [number, number]>;
  /** Globe radius (must match globe mesh) */
  globeRadius?: number;
  /** Visibility toggle */
  visible?: boolean;
}

// ─── Constants ───

const DEFAULT_GLOBE_RADIUS = 100;
const ARC_SEGMENTS = 48;
const ARC_HEIGHT_FACTOR = 0.15; // 무역 라인은 전쟁 아크보다 낮게
const MAX_VISIBLE_ROUTES = 30;  // 성능 제한: 최대 동시 표시 루트
const CARGO_SPEED = 0.3;        // 화물 이동 속도 (초당 t 진행)

// 색상 팔레트
const SEA_COLOR = new THREE.Color(0x3399ff);  // 해상: 파란색
const LAND_COLOR = new THREE.Color(0x33cc66); // 육상: 초록색
const CARGO_COLOR_SEA = new THREE.Color(0x66bbff);
const CARGO_COLOR_LAND = new THREE.Color(0x66ee88);

// ─── Helpers ───
// latLngToVector3 → @/lib/globe-utils (v20 통합)

/** 두 구면 점 사이의 베지어 곡선 포인트 배열 생성 */
function createBezierArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  segments: number,
): THREE.Vector3[] {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  // 중점을 구면 바깥으로 밀어서 곡선 높이 생성
  mid.normalize().multiplyScalar(radius + dist * ARC_HEIGHT_FACTOR);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const invT = 1 - t;
    // 2차 베지어: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
    const p = new THREE.Vector3()
      .addScaledVector(start, invT * invT)
      .addScaledVector(mid, 2 * invT * t)
      .addScaledVector(end, t * t);
    points.push(p);
  }
  return points;
}

/** trade volume → 라인 두께 (1~4) */
function volumeToWidth(volume: number): number {
  return THREE.MathUtils.clamp(1 + Math.log10(Math.max(volume, 1)) * 0.8, 1, 4);
}

/** route age → opacity (최신=1.0, 오래된=0.3) */
function ageToOpacity(timestamp: number, now: number): number {
  const ageSec = (now - timestamp) / 1000;
  // 30초 수명: 0초=1.0 → 30초=0.3
  return THREE.MathUtils.clamp(1.0 - ageSec * (0.7 / 30), 0.3, 1.0);
}

// ─── Internal: single trade route line + cargo ───

interface RouteRenderData {
  points: THREE.Vector3[];
  type: 'sea' | 'land';
  volume: number;
  timestamp: number;
  key: string;
}

// ─── Component ───

export function GlobeTradeRoutes({
  tradeRoutes,
  countryCentroids,
  globeRadius = DEFAULT_GLOBE_RADIUS,
  visible = true,
}: GlobeTradeRoutesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.Line[]>([]);
  const cargosRef = useRef<THREE.Mesh[]>([]);
  const routeDataRef = useRef<RouteRenderData[]>([]);
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);

  // 화물 스프라이트용 구 geometry (공유, 1회 생성)
  const cargoGeo = useMemo(() => new THREE.SphereGeometry(0.6, 6, 6), []);

  // 화물 머티리얼 풀: sea/land 각 1개
  const cargoMats = useMemo(() => ({
    sea: new THREE.MeshBasicMaterial({
      color: CARGO_COLOR_SEA,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    land: new THREE.MeshBasicMaterial({
      color: CARGO_COLOR_LAND,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  }), []);

  // 라인 셰이더 머티리얼 (점선/실선 구분)
  const createLineMaterial = useMemo(() => (isSea: boolean) => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: isSea ? SEA_COLOR.clone() : LAND_COLOR.clone() },
        uOpacity: { value: 1.0 },
        uTime: { value: 0 },
        uDashed: { value: isSea ? 1.0 : 0.0 },
        uTotalLength: { value: 1.0 },
      },
      vertexShader: `
        attribute float aLineDistance;
        varying float vLineDistance;
        void main() {
          vLineDistance = aLineDistance;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        uniform float uDashed;
        uniform float uTotalLength;
        varying float vLineDistance;
        void main() {
          float alpha = uOpacity;
          // 점선 모드: 해상 루트
          if (uDashed > 0.5) {
            float dashLen = uTotalLength * 0.04;
            float gap = dashLen * 0.6;
            float cycle = dashLen + gap;
            float pos = mod(vLineDistance - uTime * dashLen * 3.0, cycle);
            if (pos > dashLen) alpha *= 0.1;
          }
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // tradeRoutes → 렌더 데이터 변환
  useEffect(() => {
    if (!groupRef.current) return;

    // 기존 라인/화물 정리
    for (const line of linesRef.current) {
      groupRef.current.remove(line);
      line.geometry.dispose();
    }
    for (const cargo of cargosRef.current) {
      groupRef.current.remove(cargo);
    }
    for (const mat of materialsRef.current) {
      mat.dispose();
    }
    linesRef.current = [];
    cargosRef.current = [];
    materialsRef.current = [];
    routeDataRef.current = [];

    // 최근 MAX_VISIBLE_ROUTES개만 표시
    const visibleRoutes = tradeRoutes.slice(-MAX_VISIBLE_ROUTES);

    for (const route of visibleRoutes) {
      const fromCentroid = countryCentroids.get(route.from);
      const toCentroid = countryCentroids.get(route.to);
      if (!fromCentroid || !toCentroid) continue;

      const startPos = latLngToVector3(fromCentroid[0], fromCentroid[1], globeRadius + 0.5);
      const endPos = latLngToVector3(toCentroid[0], toCentroid[1], globeRadius + 0.5);

      const points = createBezierArcPoints(startPos, endPos, globeRadius, ARC_SEGMENTS);
      const isSea = route.type === 'sea';

      // 라인 geometry (+ line distance attribute for dashed shader)
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const distances = new Float32Array(points.length);
      let cumDist = 0;
      distances[0] = 0;
      for (let i = 1; i < points.length; i++) {
        cumDist += points[i].distanceTo(points[i - 1]);
        distances[i] = cumDist;
      }
      lineGeo.setAttribute('aLineDistance', new THREE.BufferAttribute(distances, 1));

      const mat = createLineMaterial(isSea);
      mat.uniforms.uTotalLength.value = cumDist;
      materialsRef.current.push(mat);

      const line = new THREE.Line(lineGeo, mat);
      line.renderOrder = 3;
      linesRef.current.push(line);
      groupRef.current.add(line);

      // 화물 스프라이트 (각 루트에 1개 이동 점)
      const cargo = new THREE.Mesh(cargoGeo, isSea ? cargoMats.sea : cargoMats.land);
      cargo.renderOrder = 4;
      cargosRef.current.push(cargo);
      groupRef.current.add(cargo);

      routeDataRef.current.push({
        points,
        type: route.type,
        volume: route.volume,
        timestamp: route.timestamp,
        key: `${route.from}_${route.to}_${route.timestamp}`,
      });
    }
  }, [tradeRoutes, countryCentroids, globeRadius, cargoGeo, cargoMats, createLineMaterial]);

  // 매 프레임: opacity 업데이트 + 화물 이동
  useFrame(({ clock }) => {
    if (!visible) return;

    const now = Date.now();
    const elapsed = clock.getElapsedTime();

    for (let i = 0; i < routeDataRef.current.length; i++) {
      const routeData = routeDataRef.current[i];
      const line = linesRef.current[i];
      const cargo = cargosRef.current[i];
      if (!line || !cargo || !routeData) continue;

      // opacity: 나이 기반
      const opacity = ageToOpacity(routeData.timestamp, now);
      const mat = line.material as THREE.ShaderMaterial;
      mat.uniforms.uOpacity.value = opacity;
      mat.uniforms.uTime.value = elapsed;

      // 화물 위치: 루트를 따라 이동하는 t (0→1 반복)
      const ageSec = (now - routeData.timestamp) / 1000;
      const t = (ageSec * CARGO_SPEED) % 1;
      const idx = Math.floor(t * (routeData.points.length - 1));
      const frac = t * (routeData.points.length - 1) - idx;
      const p0 = routeData.points[Math.min(idx, routeData.points.length - 1)];
      const p1 = routeData.points[Math.min(idx + 1, routeData.points.length - 1)];
      cargo.position.lerpVectors(p0, p1, frac);

      // 화물 크기: volume 기반
      const scale = volumeToWidth(routeData.volume) * 0.5;
      cargo.scale.setScalar(scale);

      // 화물 opacity
      const cargoMat = cargo.material as THREE.MeshBasicMaterial;
      cargoMat.opacity = opacity;
    }
  });

  // cleanup on unmount
  useEffect(() => {
    return () => {
      for (const mat of materialsRef.current) mat.dispose();
      cargoGeo.dispose();
      cargoMats.sea.dispose();
      cargoMats.land.dispose();
    };
  }, [cargoGeo, cargoMats]);

  return <group ref={groupRef} visible={visible} />;
}
