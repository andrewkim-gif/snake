'use client';

/**
 * GlobeTradeRoutes — v15 Phase 5 + v23 Phase 4
 * Trade route visualization on the 3D globe:
 * - Sea routes: blue dashed bezier curves
 * - Land routes: green solid bezier curves
 * - v23: Resource-specific 3D cargo icons (oil tanker, tech plane, food container, metal ore)
 * - Cargo oriented along route tangent direction
 * - Line width = trade volume (1~4)
 * - Opacity = trade frequency (0.3~1.0)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcPoints } from '@/lib/effect-utils';
import { ARC_HEIGHT, COLORS_BASE, RENDER_ORDER } from '@/lib/effect-constants';
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
const TRADE_ARC_SEGMENTS = 48;
const MAX_VISIBLE_ROUTES = 30;  // 성능 제한: 최대 동시 표시 루트
const CARGO_SPEED = 0.3;        // 화물 이동 속도 (초당 t 진행)

// 색상 팔레트 — v24: 통일 색상 체계 (교역 녹색 기반)
const SEA_COLOR = new THREE.Color(COLORS_BASE.trade).multiplyScalar(0.85);  // 해상: 교역색 약간 어둡게
const LAND_COLOR = COLORS_BASE.trade.clone(); // 육상: 교역 녹색

// v23: 자원별 화물 색상
const CARGO_COLORS: Record<string, THREE.Color> = {
  oil: new THREE.Color(0x44aaff),   // 밝은 파란색 (유조선)
  tech: new THREE.Color(0xccccdd),  // 은색 (비행기)
  food: new THREE.Color(0x44bb44),  // 녹색 (컨테이너)
  metal: new THREE.Color(0xcc8833), // 갈색-주황 (광석)
  default: new THREE.Color(0x88aacc), // 기본
};

// ─── GC-prevention temp objects (module scope) ───

const _tempVec3A = new THREE.Vector3();
const _tempVec3B = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);

// ─── Helpers ───

/** trade volume -> 라인 두께 (1~4) */
function volumeToWidth(volume: number): number {
  return THREE.MathUtils.clamp(1 + Math.log10(Math.max(volume, 1)) * 0.8, 1, 4);
}

/** route age -> opacity (최신=1.0, 오래된=0.3) */
function ageToOpacity(timestamp: number, now: number): number {
  const ageSec = (now - timestamp) / 1000;
  // 30초 수명: 0초=1.0 -> 30초=0.3
  return THREE.MathUtils.clamp(1.0 - ageSec * (0.7 / 30), 0.3, 1.0);
}

// ─── v23: Resource-specific cargo geometry + material factories ───

type ResourceType = 'oil' | 'tech' | 'food' | 'metal' | 'default';

/** 자원 타입 문자열을 정규화 */
function normalizeResource(resource: string): ResourceType {
  const r = resource.toLowerCase();
  if (r === 'oil' || r === 'petroleum' || r === 'energy') return 'oil';
  if (r === 'tech' || r === 'technology' || r === 'electronics') return 'tech';
  if (r === 'food' || r === 'grain' || r === 'agriculture') return 'food';
  if (r === 'metal' || r === 'ore' || r === 'minerals' || r === 'steel') return 'metal';
  return 'default';
}

/** 자원별 geometry 생성 (1회 공유) */
function createCargoGeometry(type: ResourceType): THREE.BufferGeometry {
  switch (type) {
    case 'oil':
      // 유조선: 납작한 박스 (탱커)
      return new THREE.BoxGeometry(0.8, 0.3, 0.3);
    case 'tech':
      // 비행기: 원뿔 (4면체)
      return new THREE.ConeGeometry(0.3, 0.8, 4);
    case 'food':
      // 컨테이너: 정육면체
      return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    case 'metal':
      // 광석: 팔면체
      return new THREE.OctahedronGeometry(0.4);
    default:
      // 기본: 구체
      return new THREE.SphereGeometry(0.4, 6, 6);
  }
}

/** 자원별 material 생성 */
function createCargoMaterial(type: ResourceType): THREE.MeshBasicMaterial {
  const color = CARGO_COLORS[type] || CARGO_COLORS.default;
  return new THREE.MeshBasicMaterial({
    color: color.clone(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// ─── Internal: single trade route line + cargo ───

interface RouteRenderData {
  points: THREE.Vector3[];
  type: 'sea' | 'land';
  resource: ResourceType;
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
  // v23: 자원별 cargo geometry + material 캐시 (생성된 것 추적하여 cleanup)
  const cargoGeosRef = useRef<Map<ResourceType, THREE.BufferGeometry>>(new Map());
  const cargoMatsRef = useRef<Map<ResourceType, THREE.MeshBasicMaterial>>(new Map());

  /** 자원 타입별 geometry 획득 (캐시 사용) */
  const getCargoGeo = (type: ResourceType): THREE.BufferGeometry => {
    let geo = cargoGeosRef.current.get(type);
    if (!geo) {
      geo = createCargoGeometry(type);
      cargoGeosRef.current.set(type, geo);
    }
    return geo;
  };

  /** 자원 타입별 material 획득 (캐시 사용) */
  const getCargoMat = (type: ResourceType): THREE.MeshBasicMaterial => {
    let mat = cargoMatsRef.current.get(type);
    if (!mat) {
      mat = createCargoMaterial(type);
      cargoMatsRef.current.set(type, mat);
    }
    return mat;
  };

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

  // tradeRoutes -> 렌더 데이터 변환
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

      const points = createArcPoints(startPos, endPos, globeRadius, ARC_HEIGHT.trade, TRADE_ARC_SEGMENTS);
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
      line.renderOrder = RENDER_ORDER.ARC_TRADE;
      linesRef.current.push(line);
      groupRef.current.add(line);

      // v23: 자원별 3D 화물 메시 (resource 필드 참조)
      const resType = normalizeResource(route.resource || 'default');
      const cargoGeo = getCargoGeo(resType);
      const cargoMat = getCargoMat(resType);
      const cargo = new THREE.Mesh(cargoGeo, cargoMat);
      cargo.renderOrder = RENDER_ORDER.CARGO;
      cargosRef.current.push(cargo);
      groupRef.current.add(cargo);

      routeDataRef.current.push({
        points,
        type: route.type,
        resource: resType,
        volume: route.volume,
        timestamp: route.timestamp,
        key: `${route.from}_${route.to}_${route.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeRoutes, countryCentroids, globeRadius, createLineMaterial]);

  // 매 프레임: opacity 업데이트 + 화물 이동 + 접선 정렬
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

      // 화물 위치: 루트를 따라 이동하는 t (0->1 반복)
      const ageSec = (now - routeData.timestamp) / 1000;
      const t = (ageSec * CARGO_SPEED) % 1;
      const ptsLen = routeData.points.length;
      const idx = Math.floor(t * (ptsLen - 1));
      const frac = t * (ptsLen - 1) - idx;
      const p0 = routeData.points[Math.min(idx, ptsLen - 1)];
      const p1 = routeData.points[Math.min(idx + 1, ptsLen - 1)];
      cargo.position.lerpVectors(p0, p1, frac);

      // v23: 접선 방향 정렬 (화물이 진행 방향을 향하도록)
      _tempVec3A.subVectors(p1, p0);
      if (_tempVec3A.lengthSq() > 0.0001) {
        _tempVec3A.normalize();
        // lookAt 방향: cargo 위치에서 접선 방향으로 바라봄
        _tempVec3B.copy(cargo.position).add(_tempVec3A);
        cargo.lookAt(_tempVec3B);
      }

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
      // v23: dispose cached cargo geometries & materials
      for (const geo of cargoGeosRef.current.values()) geo.dispose();
      for (const mat of cargoMatsRef.current.values()) mat.dispose();
      cargoGeosRef.current.clear();
      cargoMatsRef.current.clear();
    };
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
