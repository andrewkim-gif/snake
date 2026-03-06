'use client';

/**
 * GlobeView — three-globe 3D 지구본
 * 실사 렌더링: NASA Blue Marble 바다 텍스처 + 얇은 대기 림 + 자동 회전 없음
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

// hex → rgba 변환 (반투명 오버레이용)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
        .globeImageUrl('/textures/earth-blue-marble.jpg')
        .showGlobe(true)
        .showAtmosphere(false)
        .polygonsData(geoData.features.filter((f) => f.geometry.type !== 'Point'))
        .polygonCapColor((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          const state = countryStates?.get(iso3);
          if (state?.sovereignFaction) return hexToRgba(sovereigntyColors.neutral, 0.35);
          return hexToRgba(sovereigntyColors.unclaimed, 0.15);
        })
        .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
        .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.06)')
        .polygonAltitude((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          if (selectedCountry && iso3 === selectedCountry) return 0.004;
          return 0.001;
        });

      // Globe material: 텍스처 원본 색감 보존, specular 제거 (우주에서 지구는 Phong 반사 없음)
      const globeMat = globe.globeMaterial() as THREE.MeshPhongMaterial;
      globeMat.color = new THREE.Color('#ffffff');
      globeMat.emissive = new THREE.Color('#040810');
      globeMat.emissiveIntensity = 0.02;
      globeMat.shininess = 0;
      globeMat.specular = new THREE.Color('#000000');

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
        if (state?.battleStatus === 'in_battle') return hexToRgba(sovereigntyColors.atWar, 0.45);
        if (state?.sovereignFaction) return hexToRgba(sovereigntyColors.neutral, 0.35);
        return hexToRgba(sovereigntyColors.unclaimed, 0.15);
      })
      .polygonAltitude((feat: object) => {
        const f = feat as { properties: Record<string, unknown> };
        const iso3 = getCountryISO(f.properties);
        if (selectedCountry && iso3 === selectedCountry) return 0.004;
        return 0.001;
      });
  }, [countryStates, selectedCountry, geoData, globeReady]);

  // tick 유지
  useFrame(() => {});

  // DOM 이벤트 기반 클릭 감지 (R3F 이벤트는 imperatively 추가된 three-globe 메시를 감지 못함)
  const { gl, camera } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const CLICK_THRESHOLD = 5;

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;

    const canvas = gl.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPos.current = { x: event.clientX, y: event.clientY };
    };

    const handleCanvasClick = (event: MouseEvent) => {
      if (!onCountryClick || !globeRef.current) return;

      // 드래그 vs 클릭 구분
      if (pointerDownPos.current) {
        const dx = event.clientX - pointerDownPos.current.x;
        const dy = event.clientY - pointerDownPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;
      }

      // 마우스 좌표 → NDC 변환
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // three-globe 오브젝트의 모든 자식에 대해 레이캐스트
      const globeObj = globeRef.current as unknown as THREE.Object3D;
      const intersects = raycasterRef.current.intersectObjects(globeObj.children, true);

      if (intersects.length === 0) return;

      const intersected = intersects[0].object;

      // 폴리곤 그룹 찾기 (three-globe이 생성한 국가 메시 그룹)
      const polygonGroup = globeObj.children.find(
        (c) => c.type === 'Group' && c.children.length > 10
      );

      if (polygonGroup) {
        // 직접 자식에서 먼저 찾기
        let meshIdx = polygonGroup.children.indexOf(intersected);

        // 중첩된 경우 부모를 타고 올라가기
        if (meshIdx < 0 && intersected.parent && intersected.parent !== polygonGroup) {
          meshIdx = polygonGroup.children.indexOf(intersected.parent);
        }

        if (meshIdx >= 0) {
          const info = featureMapRef.current.get(meshIdx);
          if (info) {
            onCountryClick(info.iso3, info.name);
          }
        }
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [globeReady, gl, camera, onCountryClick]);

  return (
    <group ref={groupRef} />
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

// 실시간 태양 위치 + 조명 (현재 UTC 시각 기반)
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
    const x = d * Math.cos(decRad) * Math.sin(-ha);
    const y = d * Math.sin(decRad);
    const z = d * Math.cos(decRad) * Math.cos(-ha);

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

// 배경 별 (자연스러운 크기/색상/깜빡임 변화)
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
        {/* 우주: 최소 ambient + 반구 필 + 실시간 태양 + 별 */}
        <ambientLight intensity={0.08} color="#1a2a4a" />
        <hemisphereLight args={['#223355', '#080810', 0.1]} />
        <SunLight />
        <Starfield />

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
