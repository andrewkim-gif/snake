'use client';

/**
 * GlobeView — three-globe 3D 지구본
 * S07: R3F 통합, GeoJSON 국가 폴리곤, 팩션 색상, 자동 회전, 대기 글로우
 * three-globe (not globe.gl) — label/onClick은 R3F raycasting으로 구현
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
  autoRotate?: boolean;
  style?: React.CSSProperties;
}

// Globe 3D 오브젝트 컴포넌트
function GlobeObject({
  countryStates,
  selectedCountry,
  onCountryClick,
  autoRotate = true,
}: Omit<GlobeViewProps, 'style'>) {
  const globeRef = useRef<ThreeGlobeInstance | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  // feature 인덱스 → iso3/name 매핑 (raycasting용)
  const featureMapRef = useRef<Map<number, { iso3: string; name: string }>>(new Map());

  // GeoJSON 로딩
  useEffect(() => {
    loadGeoJSON().then((data) => {
      setGeoData(data);
      // feature 매핑 빌드
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
        .globeImageUrl('')
        .showGlobe(true)
        .showAtmosphere(true)
        .atmosphereColor('#1A3A5C')
        .atmosphereAltitude(0.25)
        .polygonsData(geoData.features.filter((f) => f.geometry.type !== 'Point'))
        .polygonCapColor((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          const state = countryStates?.get(iso3);
          if (state?.sovereignFaction) return sovereigntyColors.neutral;
          return sovereigntyColors.unclaimed;
        })
        .polygonSideColor(() => 'rgba(26, 42, 64, 0.6)')
        .polygonStrokeColor(() => '#1E293B')
        .polygonAltitude((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          if (selectedCountry && iso3 === selectedCountry) return 0.02;
          return 0.006;
        });

      // Globe material: 어두운 바다
      const globeMat = globe.globeMaterial() as THREE.MeshPhongMaterial;
      globeMat.color = new THREE.Color('#0A0E14');
      globeMat.emissive = new THREE.Color('#05080C');
      globeMat.shininess = 5;

      if (groupRef.current) {
        // 이전 globe 제거
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

  // 자동 회전
  useFrame(() => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += 0.0005;
    }
  });

  // 클릭 핸들러 (group 레벨에서 raycasting)
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!onCountryClick || !globeRef.current) return;

    // three-globe polygon meshes are children of the globe object.
    // Traverse up from the hit object to find the polygon index.
    const intersected = e.object;
    if (!intersected) return;

    // three-globe names polygon meshes with the feature index.
    // Try to find the userData or parent index.
    const parent = intersected.parent;
    if (parent) {
      const idx = parent.children.indexOf(intersected);
      const info = featureMapRef.current.get(idx);
      if (info) {
        onCountryClick(info.iso3, info.name);
        return;
      }
    }

    // Fallback: try all features by checking closest match
    // This is a simplified approach — the polygon group is typically
    // the 2nd child group in three-globe's hierarchy
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
    <group ref={groupRef} onClick={handleClick} />
  );
}

// 대기 글로우 이펙트
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
      <sphereGeometry args={[105, 32, 32]} />
    </mesh>
  );
}

export function GlobeView({
  countryStates,
  selectedCountry,
  onCountryClick,
  autoRotate = true,
  style,
}: GlobeViewProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#0A0E14', ...style }}>
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
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 100]} intensity={0.8} />
        <directionalLight position={[-100, -50, -100]} intensity={0.3} color="#4488AA" />

        <GlobeObject
          countryStates={countryStates}
          selectedCountry={selectedCountry}
          onCountryClick={onCountryClick}
          autoRotate={autoRotate}
        />

        <AtmosphereGlow />

        <OrbitControls
          enablePan={false}
          minDistance={150}
          maxDistance={500}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
      </Canvas>
    </div>
  );
}
