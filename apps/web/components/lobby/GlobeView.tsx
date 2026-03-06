'use client';

/**
 * GlobeView — three-globe 3D 지구본
 * 실사 렌더링: NASA Blue Marble 바다 텍스처 + 얇은 대기 림 + 자동 회전 없음
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CountryClientState, GeoJSONData } from '@/lib/globe-data';
import { loadGeoJSON } from '@/lib/globe-data';
import { sovereigntyColors, getCountryISO } from '@/lib/map-style';

// three-globe dynamic import 타입
type ThreeGlobeInstance = import('three-globe').default;
let ThreeGlobeClass: (new () => ThreeGlobeInstance) | null = null;

interface GlobeViewProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  style?: React.CSSProperties;
}

// Globe 3D 오브젝트 컴포넌트
function GlobeObject({
  countryStates,
  selectedCountry,
  onCountryClick,
}: Omit<GlobeViewProps, 'style' | 'autoRotate'>) {
  const globeRef = useRef<ThreeGlobeInstance | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const featureMapRef = useRef<Map<number, { iso3: string; name: string }>>(new Map());

  // GeoJSON 로딩
  useEffect(() => {
    loadGeoJSON().then((data) => {
      setGeoData(data);
      const map = new Map<number, { iso3: string; name: string }>();
      const polys = data.features.filter((f) => f.geometry.type !== 'Point');
      polys.forEach((f, i) => {
        const iso3 = getCountryISO(f.properties);
        const name = (f.properties.NAME as string) || (f.properties.ADMIN as string) || 'Unknown';
        map.set(i, { iso3, name });
      });
      featureMapRef.current = map;
    }).catch(console.error);
  }, []);

  // three-globe 인스턴스 생성
  useEffect(() => {
    if (!geoData) return;

    let cancelled = false;

    (async () => {
      if (!ThreeGlobeClass) {
        const mod = await import('three-globe');
        ThreeGlobeClass = mod.default as unknown as new () => ThreeGlobeInstance;
      }
      if (cancelled) return;

      const globe = new ThreeGlobeClass!()
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .showGlobe(true)
        .showAtmosphere(false)
        .polygonsData(geoData.features.filter((f) => f.geometry.type !== 'Point'))
        .polygonCapColor((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          const state = countryStates?.get(iso3);
          if (state?.sovereignFaction) return sovereigntyColors.neutral;
          return sovereigntyColors.unclaimed;
        })
        .polygonSideColor(() => 'rgba(99, 102, 241, 0.12)')
        .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.12)')
        .polygonAltitude((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          if (selectedCountry && iso3 === selectedCountry) return 0.02;
          return 0.006;
        });

      // Globe material: 실사 바다 — 텍스처 색감 보존 + 수면 반사
      const globeMat = globe.globeMaterial() as THREE.MeshPhongMaterial;
      globeMat.color = new THREE.Color('#bbccdd');
      globeMat.emissive = new THREE.Color('#0a1520');
      globeMat.emissiveIntensity = 0.12;
      globeMat.shininess = 90;
      globeMat.specular = new THREE.Color('#446688');

      if (groupRef.current) {
        if (globeRef.current) {
          groupRef.current.remove(globeRef.current as unknown as THREE.Object3D);
        }
        groupRef.current.add(globe as unknown as THREE.Object3D);
        globeRef.current = globe;
      }

      setGlobeReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [geoData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 국가 상태/선택 변경 시 polygons 업데이트
  useEffect(() => {
    if (!globeRef.current || !geoData || !globeReady) return;
    const globe = globeRef.current;

    globe
      .polygonCapColor((feat: object) => {
        const f = feat as { properties: Record<string, unknown> };
        const iso3 = getCountryISO(f.properties);
        const state = countryStates?.get(iso3);
        if (state?.battleStatus === 'in_battle') return sovereigntyColors.atWar;
        if (state?.sovereignFaction) return sovereigntyColors.neutral;
        return sovereigntyColors.unclaimed;
      })
      .polygonAltitude((feat: object) => {
        const f = feat as { properties: Record<string, unknown> };
        const iso3 = getCountryISO(f.properties);
        if (selectedCountry && iso3 === selectedCountry) return 0.02;
        return 0.006;
      });
  }, [countryStates, selectedCountry, geoData, globeReady]);

  // tick 유지
  useFrame(() => {});

  // 드래그 vs 클릭 구분
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const CLICK_THRESHOLD = 5;

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }, []);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!onCountryClick || !globeRef.current) return;

    if (pointerDownPos.current) {
      const dx = e.nativeEvent.clientX - pointerDownPos.current.x;
      const dy = e.nativeEvent.clientY - pointerDownPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;
    }

    const intersected = e.object;
    if (!intersected) return;

    const parent = intersected.parent;
    if (parent) {
      const idx = parent.children.indexOf(intersected);
      const info = featureMapRef.current.get(idx);
      if (info) {
        onCountryClick(info.iso3, info.name);
        return;
      }
    }

    const globeObj = globeRef.current as unknown as THREE.Object3D;
    const polygonGroup = globeObj.children.find(
      (c) => c.type === 'Group' && c.children.length > 10
    );
    if (polygonGroup) {
      const meshIdx = polygonGroup.children.indexOf(intersected);
      if (meshIdx >= 0) {
        const info = featureMapRef.current.get(meshIdx);
        if (info) {
          onCountryClick(info.iso3, info.name);
        }
      }
    }
  }, [onCountryClick]);

  return (
    <group ref={groupRef} onPointerDown={handlePointerDown} onClick={handleClick} />
  );
}

// 대기 글로우 이펙트 (실사 — 얇은 BackSide 대기 림)
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
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          vec3 color = vec3(0.35, 0.65, 1.0);
          gl_FragColor = vec4(color, 1.0) * intensity * 0.35;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <mesh material={material}>
      <sphereGeometry args={[104, 64, 64]} />
    </mesh>
  );
}

// 줌 레벨에 따라 회전 속도 동적 조절
const MIN_DIST = 150;
const MAX_DIST = 500;
const MIN_ROTATE_SPEED = 0.03;
const MAX_ROTATE_SPEED = 0.5;

function AdaptiveControls() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!controlsRef.current) return;
    const dist = camera.position.length();
    const t = Math.max(0, Math.min(1, (dist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
    (controlsRef.current as unknown as { rotateSpeed: number }).rotateSpeed =
      MIN_ROTATE_SPEED + (MAX_ROTATE_SPEED - MIN_ROTATE_SPEED) * t * t;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={MAX_ROTATE_SPEED}
      zoomSpeed={0.8}
    />
  );
}

export function GlobeView({
  countryStates,
  selectedCountry,
  onCountryClick,
  style,
}: GlobeViewProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#07080C', ...style }}>
      <Canvas
        camera={{
          position: [0, 0, 300],
          fov: 50,
          near: 1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[100, 100, 100]} intensity={0.7} />
        <directionalLight position={[-100, -50, -100]} intensity={0.2} color="#6366F1" />

        <GlobeObject
          countryStates={countryStates}
          selectedCountry={selectedCountry}
          onCountryClick={onCountryClick}
        />

        <AtmosphereGlow />

        <AdaptiveControls />
      </Canvas>
    </div>
  );
}
