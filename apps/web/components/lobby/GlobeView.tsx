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
        .showAtmosphere(false)
        .polygonsData(geoData.features.filter((f) => f.geometry.type !== 'Point'))
        .polygonCapColor((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          const state = countryStates?.get(iso3);
          if (state?.sovereignFaction) return sovereigntyColors.neutral;
          return sovereigntyColors.unclaimed;
        })
        .polygonSideColor(() => 'rgba(50, 85, 120, 0.6)')
        .polygonStrokeColor(() => '#254565')
        .polygonAltitude((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          if (selectedCountry && iso3 === selectedCountry) return 0.02;
          return 0.006;
        });

      // Globe material: 은은히 발광하는 딥 네이비 바다
      const globeMat = globe.globeMaterial() as THREE.MeshPhongMaterial;
      globeMat.color = new THREE.Color('#101D2E');
      globeMat.emissive = new THREE.Color('#0C1828');
      globeMat.emissiveIntensity = 0.4;
      globeMat.shininess = 20;

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

  // tick 유지 (globe 내부 애니메이션용)
  useFrame(() => {});

  // 드래그 vs 클릭 구분 — 마우스다운 위치 기록
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const CLICK_THRESHOLD = 5; // px — 이 이하 이동만 클릭으로 인정

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }, []);

  // 클릭 핸들러 (group 레벨에서 raycasting)
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!onCountryClick || !globeRef.current) return;

    // 드래그 감지: 마우스다운과 마우스업 거리가 threshold 초과 시 무시
    if (pointerDownPos.current) {
      const dx = e.nativeEvent.clientX - pointerDownPos.current.x;
      const dy = e.nativeEvent.clientY - pointerDownPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;
    }

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
    <group ref={groupRef} onPointerDown={handlePointerDown} onClick={handleClick} />
  );
}

// 대기 글로우 이펙트 (FrontSide Fresnel: 가장자리 발광 + 중심 투명)
function AtmosphereGlow() {
  // 외부 대기 — 넓은 Fresnel 글로우 (가장자리에서 밝고 중심은 투명)
  const atmosphereMaterial = useMemo(() => {
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
          float fresnel = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
          float glow = pow(fresnel, 2.5) * 0.8;
          gl_FragColor = vec4(0.2, 0.5, 1.0, glow);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // 내부 림 — 지표면 바로 위의 날카로운 에지 글로우
  const rimMaterial = useMemo(() => {
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
          float fresnel = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
          float rim = pow(fresnel, 4.0) * 0.5;
          gl_FragColor = vec4(0.35, 0.6, 1.0, rim);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <>
      {/* 외부 대기 — 넓은 Fresnel 글로우 (r=112, globe=100) */}
      <mesh material={atmosphereMaterial}>
        <sphereGeometry args={[112, 64, 64]} />
      </mesh>
      {/* 내부 림 — 날카로운 에지 라이트 (r=103) */}
      <mesh material={rimMaterial}>
        <sphereGeometry args={[103, 48, 48]} />
      </mesh>
    </>
  );
}

// 줌 레벨에 따라 회전 속도 동적 조절 (2차 곡선 — 줌인 시 급격히 느려짐)
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
    // 2차 곡선: 가까울수록 급격히 느려짐 (t=0→0.03, t=0.43→0.12, t=1→0.5)
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
    <div style={{ width: '100%', height: '100%', background: '#0A0F1A', ...style }}>
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
        <ambientLight intensity={0.85} />
        <directionalLight position={[100, 100, 100]} intensity={1.0} />
        <directionalLight position={[-100, -50, -100]} intensity={0.5} color="#4A90D9" />

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
