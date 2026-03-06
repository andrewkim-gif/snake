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

// GeoJSON geometry → centroid (lat/lng) 계산
function computeCentroid(geometry: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  let ring: number[][];
  if (geometry.type === 'Polygon') {
    ring = (geometry.coordinates as number[][][])[0];
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    let maxLen = 0;
    ring = [];
    for (const p of polys) {
      if (p[0].length > maxLen) { maxLen = p[0].length; ring = p[0]; }
    }
  } else return null;
  if (!ring.length) return null;
  let sLng = 0, sLat = 0;
  for (const [lng, lat] of ring) { sLng += lng; sLat += lat; }
  return { lng: sLng / ring.length, lat: sLat / ring.length };
}

// Globe 3D 오브젝트 컴포넌트
function GlobeObject({
  countryStates,
  selectedCountry,
  onCountryClick,
}: Omit<GlobeViewProps, 'style' | 'autoRotate'>) {
  const globeRef = useRef<ThreeGlobeInstance | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // GeoJSON 로딩
  useEffect(() => {
    loadGeoJSON().then(setGeoData).catch(console.error);
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

      const polys = geoData.features.filter((f) => f.geometry.type !== 'Point');

      const globe = new ThreeGlobeClass!()
        .globeImageUrl('/textures/earth-blue-marble.jpg')
        .showGlobe(true)
        .showAtmosphere(false)
        .polygonsData(polys)
        .polygonCapColor((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          const state = countryStates?.get(iso3);
          if (state?.sovereignFaction) return hexToRgba(sovereigntyColors.neutral, 0.55);
          return hexToRgba(sovereigntyColors.unclaimed, 0.45);
        })
        .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
        .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.15)')
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
        // 이전 라벨 그룹 제거
        if (labelGroupRef.current) {
          labelGroupRef.current.traverse((child) => {
            if (child instanceof THREE.Sprite) {
              child.material.map?.dispose();
              child.material.dispose();
            }
          });
          groupRef.current.remove(labelGroupRef.current);
        }

        groupRef.current.add(globe as unknown as THREE.Object3D);
        globeRef.current = globe;

        // 국가 이름 라벨 (커스텀 스프라이트 — TextGeometry 호환성 이슈 회피)
        const labelGroup = new THREE.Group();
        labelGroup.name = 'country-labels';

        for (const f of polys) {
          const name = (f.properties.NAME as string) || '';
          if (!name) continue;
          const centroid = computeCentroid(f.geometry);
          if (!centroid) continue;

          // 캔버스에 텍스트 렌더링
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const fontSize = 36;
          ctx.font = `600 ${fontSize}px "Rajdhani", "Segoe UI", sans-serif`;
          const metrics = ctx.measureText(name);
          const pw = Math.ceil(metrics.width) + 20;
          const ph = fontSize + 16;
          canvas.width = pw;
          canvas.height = ph;
          // canvas 리사이즈 후 font 재설정 필수
          ctx.font = `600 ${fontSize}px "Rajdhani", "Segoe UI", sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          // 다크 아웃라인 (가독성)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.lineWidth = 4;
          ctx.lineJoin = 'round';
          ctx.strokeText(name, pw / 2, ph / 2);
          // 흰색 본문
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.fillText(name, pw / 2, ph / 2);

          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

          const mat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true,
          });
          const sprite = new THREE.Sprite(mat);

          // 위치: three-globe polar2Cartesian 공식
          const alt = 0.015;
          const phi = (90 - centroid.lat) * Math.PI / 180;
          const theta = (90 - centroid.lng) * Math.PI / 180;
          const r = 100 * (1 + alt);
          sprite.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta),
          );

          // 스케일: 텍스트 비율 유지, 기본 높이 5 world units
          const baseH = 5;
          sprite.scale.set(baseH * (pw / ph), baseH, 1);

          labelGroup.add(sprite);
        }

        groupRef.current.add(labelGroup);
        labelGroupRef.current = labelGroup;
      }

      setGlobeReady(true);
    })();

    return () => {
      cancelled = true;
      // 라벨 텍스처 메모리 해제
      if (labelGroupRef.current) {
        labelGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Sprite) {
            child.material.map?.dispose();
            child.material.dispose();
          }
        });
      }
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
        if (state?.battleStatus === 'in_battle') return hexToRgba(sovereigntyColors.atWar, 0.55);
        if (state?.sovereignFaction) return hexToRgba(sovereigntyColors.neutral, 0.55);
        return hexToRgba(sovereigntyColors.unclaimed, 0.45);
      })
      .polygonAltitude((feat: object) => {
        const f = feat as { properties: Record<string, unknown> };
        const iso3 = getCountryISO(f.properties);
        if (selectedCountry && iso3 === selectedCountry) return 0.004;
        return 0.001;
      });
  }, [countryStates, selectedCountry, geoData, globeReady]);

  // 라벨 거리 기반 페이드 (줌아웃 시 희미, 줌인 시 선명)
  useFrame(({ camera }) => {
    if (!labelGroupRef.current) return;
    const dist = camera.position.length();
    // 350 이상: 투명, 200 이하: 불투명
    const opacity = THREE.MathUtils.clamp((350 - dist) / 150, 0, 1);
    labelGroupRef.current.visible = opacity > 0.01;
    if (!labelGroupRef.current.visible) return;
    for (const child of labelGroupRef.current.children) {
      if (child instanceof THREE.Sprite) {
        child.material.opacity = opacity;
      }
    }
  });

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

      // three-globe은 각 polygon 메시의 __data에 원본 GeoJSON feature를 저장
      let target: THREE.Object3D | null = intersects[0].object;
      while (target) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feat = (target as any).__data;
        if (feat?.properties) {
          const iso3 = getCountryISO(feat.properties);
          const name = (feat.properties.NAME as string) || (feat.properties.ADMIN as string) || 'Unknown';
          if (iso3) {
            onCountryClick(iso3, name);
          }
          break;
        }
        target = target.parent;
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

// 카메라 모션 설정
const MIN_DIST = 150;
const MAX_DIST = 500;
const MIN_ROTATE_SPEED = 0.15;     // 줌인 시 회전 속도 (0.03→0.15: 5배 향상)
const MAX_ROTATE_SPEED = 0.5;
const ROTATION_DAMPING = 0.015;    // 회전 관성 감쇠
const ZOOM_FRICTION = 0.92;        // 줌 속도 감쇠 (프레임당 8% 감속)
const ZOOM_IMPULSE = 0.00004;      // 스크롤 1px당 속도 누적
const ZOOM_MAX_VEL = 0.03;         // 줌 최대 속도 (프레임당 3%)

function AdaptiveControls() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, gl } = useThree();
  const zoomVel = useRef(0);
  const pinchRef = useRef(0);

  // 모멘텀 기반 줌 (휠 + 터치 핀치)
  useEffect(() => {
    const canvas = gl.domElement;

    // 마우스 휠 / 트랙패드: 속도 누적 → 자연스러운 가감속
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 40;
      if (e.deltaMode === 2) delta *= 800;
      zoomVel.current += THREE.MathUtils.clamp(delta, -150, 150) * ZOOM_IMPULSE;
      zoomVel.current = THREE.MathUtils.clamp(zoomVel.current, -ZOOM_MAX_VEL, ZOOM_MAX_VEL);
    };

    // 터치 핀치: 핀치 비율 → 속도 변환
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        zoomVel.current += (1 - dist / pinchRef.current) * 0.06;
        zoomVel.current = THREE.MathUtils.clamp(zoomVel.current, -0.05, 0.05);
        pinchRef.current = dist;
      }
    };
    const onTouchEnd = () => { pinchRef.current = 0; };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [gl]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const currentDist = camera.position.length();

    // 모멘텀 줌: 속도 적분 + 마찰 감쇠 (스크롤 멈춰도 관성으로 서서히 정지)
    if (Math.abs(zoomVel.current) > 0.00005) {
      const newDist = THREE.MathUtils.clamp(
        currentDist * (1 + zoomVel.current), MIN_DIST, MAX_DIST,
      );
      // 경계 도달 시 해당 방향 속도 즉시 소멸 (반발 방지)
      if (newDist >= MAX_DIST && zoomVel.current > 0) zoomVel.current = 0;
      if (newDist <= MIN_DIST && zoomVel.current < 0) zoomVel.current = 0;
      camera.position.normalize().multiplyScalar(newDist);
      zoomVel.current *= ZOOM_FRICTION;
    } else {
      zoomVel.current = 0;
    }

    // 적응형 회전 속도 (√ 커브: 줌인 시에도 답답하지 않게)
    const t = Math.max(0, Math.min(1, (currentDist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
    (controlsRef.current as unknown as { rotateSpeed: number }).rotateSpeed =
      MIN_ROTATE_SPEED + (MAX_ROTATE_SPEED - MIN_ROTATE_SPEED) * Math.sqrt(t);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={false}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      enableDamping
      dampingFactor={ROTATION_DAMPING}
      rotateSpeed={MAX_ROTATE_SPEED}
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
