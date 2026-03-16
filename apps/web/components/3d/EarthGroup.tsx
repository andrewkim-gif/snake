'use client';

/**
 * EarthGroup — Earth sphere (PBR day/night), clouds, atmosphere glow, sun, starfield.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 *
 * v33 Phase 1 optimizations:
 * - Task 1: Unified sun direction computation (single computeSunDirection per frame, shared via ref)
 * - Task 4: Atmosphere segments 64→32
 * - Task 5: AtmosphereGlow uniforms pre-created via useMemo
 *
 * v33 Phase 3 optimizations:
 * - EarthSphere/EarthClouds/AtmosphereGlow: sunDirRef.current를 uniform에 직접 공유 → 3개 useFrame 제거
 * - Starfield: SharedTickRef에서 cameraDist/cameraDir 읽기 → camera.position 중복 계산 제거
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useThree, useLoader, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { GLOBE_RADIUS } from '@/lib/globe-geo';
import { createBlackTexture, createFlatNormalTexture, createBlackSpecularTexture } from '@/lib/texture-utils';
import {
  earthVertexShader, earthFragmentShader,
  cloudsVertexShader, cloudsFragmentShader,
  atmoVertexShader, atmoFragmentShader,
  dottedVertexShader, dottedFragmentShader,
} from '@/lib/globe-shaders';
// v33 Phase 3: SharedTickData for Starfield
import type { SharedTickData } from '@/components/lobby/GlobeView';
// v33 Phase 5: AdaptiveQuality context
import { useAdaptiveQualityContext } from '@/hooks/useAdaptiveQuality';

// ─── Sun direction helper (UTC-based realtime position, GC-free) ───

// Cache year start millis at module load (avoids per-frame Date allocation)
const _yearStartMs = new Date(new Date().getFullYear(), 0, 0).getTime();

/**
 * Compute sun direction in-place using Date.now() (primitive, no GC).
 * Uses cached _yearStartMs to avoid per-frame Date construction.
 */
function computeSunDirection(out: THREE.Vector3): void {
  const nowMs = Date.now();
  const dayOfYear = Math.floor((nowMs - _yearStartMs) / 86400000);
  const utcH = (nowMs % 86400000) / 3600000;
  const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
  const ha = ((utcH - 12) / 24) * 2 * Math.PI;
  const sx = Math.cos(decRad) * Math.cos(ha);
  const sy = Math.sin(decRad);
  const sz = Math.cos(decRad) * Math.sin(ha);
  out.set(sx, sy, sz).normalize();
}

// ─── EarthSphere (PBR day/night + normal + specular) ───

interface SunDirProp {
  sunDirRef: React.RefObject<THREE.Vector3>;
}

function EarthSphere({ sunDirRef }: SunDirProp) {
  const dayTexture = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  dayTexture.colorSpace = THREE.SRGBColorSpace;

  const nightTextureRef = useRef<THREE.Texture | null>(null);
  const normalTextureRef = useRef<THREE.Texture | null>(null);
  const specularTextureRef = useRef<THREE.Texture | null>(null);
  const [texturesReady, setTexturesReady] = useState(0);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let mounted = true;
    const onLoad = () => { if (mounted) setTexturesReady(prev => prev + 1); };

    loader.load('/textures/earth-night-lights.jpg',
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; nightTextureRef.current = tex; onLoad(); },
      undefined,
      () => { nightTextureRef.current = createBlackTexture(); onLoad(); },
    );
    loader.load('/textures/earth-normal-map.jpg',
      (tex) => { tex.colorSpace = THREE.LinearSRGBColorSpace; normalTextureRef.current = tex; onLoad(); },
      undefined,
      () => { normalTextureRef.current = createFlatNormalTexture(); onLoad(); },
    );
    loader.load('/textures/earth-specular-map.jpg',
      (tex) => { tex.colorSpace = THREE.LinearSRGBColorSpace; specularTextureRef.current = tex; onLoad(); },
      undefined,
      () => { specularTextureRef.current = createBlackSpecularTexture(); onLoad(); },
    );
    return () => {
      mounted = false;
      nightTextureRef.current?.dispose();
      normalTextureRef.current?.dispose();
      specularTextureRef.current?.dispose();
    };
  }, []);

  // v33 Phase 3: sunDirRef.current를 직접 uniform value로 공유 → useFrame 복사 제거
  const earthMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTexture },
        uNightMap: { value: createBlackTexture() },
        uNormalMap: { value: createFlatNormalTexture() },
        uSpecularMap: { value: createBlackSpecularTexture() },
        uSunDir: { value: sunDirRef.current },
        uNormalScale: { value: 1.0 },
      },
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayTexture]);

  useEffect(() => {
    if (texturesReady < 3) return;
    if (nightTextureRef.current) earthMat.uniforms.uNightMap.value = nightTextureRef.current;
    if (normalTextureRef.current) earthMat.uniforms.uNormalMap.value = normalTextureRef.current;
    if (specularTextureRef.current) earthMat.uniforms.uSpecularMap.value = specularTextureRef.current;
    earthMat.uniformsNeedUpdate = true;
  }, [texturesReady, earthMat]);

  // v33 Phase 6: earthMat (useMemo ShaderMaterial) dispose — R3F 자동 dispose 대상 아님
  useEffect(() => {
    return () => {
      earthMat.dispose();
    };
  }, [earthMat]);

  // v33 Phase 3: useFrame 제거 — sunDirRef.current를 직접 공유하므로 복사 불필요
  // (GlobeScene에서 computeSunDirection이 sunDirRef.current를 in-place 업데이트)

  return (
    <mesh material={earthMat}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
    </mesh>
  );
}

// ─── DottedEarthSphere (COBE-style dotted globe) ───

interface DottedEarthProps extends SunDirProp {}

function DottedEarthSphere({ sunDirRef }: DottedEarthProps) {
  // 기존 blue marble 텍스처를 land mask로 재활용 (luminance로 변환)
  const landTexture = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  landTexture.colorSpace = THREE.SRGBColorSpace;

  const dottedMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uLandMap: { value: landTexture },
        uSunDir: { value: sunDirRef.current },
        uDots: { value: 24000.0 },
        uDotSize: { value: 0.0012 },           // 점 크기 (작을수록 작은 점, COBE 기본 0.008)
        uDiffuse: { value: 1.2 },              // 라이팅 감쇠 (COBE 기본: 1.2)
        uDotBrightness: { value: 6.0 },        // 점 밝기 (COBE 기본: 6)
        uMapBaseBrightness: { value: 0.1 },    // 바다 최소 밝기
        uBaseColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uDark: { value: 1.0 },                // 1=밝은 점, 0=어두운 배경
      },
      vertexShader: dottedVertexShader,
      fragmentShader: dottedFragmentShader,
      transparent: true,
      depthWrite: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landTexture]);

  useEffect(() => {
    return () => { dottedMat.dispose(); };
  }, [dottedMat]);

  return (
    <mesh material={dottedMat}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
    </mesh>
  );
}

// ─── EarthClouds ───

interface EarthCloudsProps extends SunDirProp {
  /** v33 Phase 5: 품질 프리셋 ref (LOW에서 비활성화) */
  qualityRef?: React.RefObject<import('@/hooks/useAdaptiveQuality').QualityPreset>;
}

function EarthClouds({ sunDirRef, qualityRef }: EarthCloudsProps) {
  const cloudsTextureRef = useRef<THREE.Texture | null>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let mounted = true;
    loader.load('/textures/earth-clouds.jpg',
      (tex) => {
        tex.colorSpace = THREE.LinearSRGBColorSpace;
        cloudsTextureRef.current = tex;
        if (mounted) setReady(true);
      },
      undefined,
      () => { if (mounted) setReady(false); },
    );
    return () => {
      mounted = false;
      cloudsTextureRef.current?.dispose();
    };
  }, []);

  // v33 Phase 3: sunDirRef.current를 직접 uniform value로 공유 → useFrame 복사 제거
  const cloudsMat = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudsMap: { value: createBlackTexture() },
        uSunDir: { value: sunDirRef.current },
      },
      vertexShader: cloudsVertexShader,
      fragmentShader: cloudsFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    matRef.current = mat;
    return mat;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && cloudsTextureRef.current && matRef.current) {
      matRef.current.uniforms.uCloudsMap.value = cloudsTextureRef.current;
      matRef.current.uniformsNeedUpdate = true;
    }
  }, [ready]);

  // v33 Phase 3: useFrame 제거 — sunDirRef.current를 직접 공유하므로 복사 불필요

  // v33 Phase 5: LOW 품질에서 구름 숨김
  useFrame(() => {
    if (!meshRef.current || !qualityRef) return;
    meshRef.current.visible = qualityRef.current.enableClouds;
  });

  // v33 Phase 6: cloudsMat (useMemo ShaderMaterial) dispose
  useEffect(() => {
    return () => {
      cloudsMat.dispose();
    };
  }, [cloudsMat]);

  return (
    <mesh ref={meshRef} material={cloudsMat} renderOrder={50}>
      <sphereGeometry args={[GLOBE_RADIUS * 1.005, 64, 64]} />
    </mesh>
  );
}

// ─── AtmosphereGlow ───
// v33 Task 4: Segments 64→32 (translucent glow, visual difference negligible)
// v33 Task 5: Uniforms pre-created via useMemo (no per-render allocation)

function AtmosphereGlow({ sunDirRef }: SunDirProp) {
  // v33 Phase 3: sunDirRef.current를 직접 uniform value로 공유 → useFrame 제거
  const uniforms = useMemo(() => ({
    uSunDir: { value: sunDirRef.current },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return (
    <mesh renderOrder={48}>
      {/* v33 Task 4: 64,64 → 32,32 segments */}
      <sphereGeometry args={[GLOBE_RADIUS * 1.02, 32, 32]} />
      <shaderMaterial
        vertexShader={atmoVertexShader}
        fragmentShader={atmoFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── SunLight (UTC-based realtime position + corona glow) ───
// v33 Task 1: Uses shared sunDirRef instead of duplicating computation

function SunLight({ sunDirRef }: SunDirProp) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Group>(null);

  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,252,240,1.0)');
    g.addColorStop(0.05, 'rgba(255,248,220,0.8)');
    g.addColorStop(0.12, 'rgba(255,235,180,0.3)');
    g.addColorStop(0.25, 'rgba(255,220,140,0.08)');
    g.addColorStop(0.5, 'rgba(255,200,100,0.01)');
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }, []);

  // v33 Phase 6: glowTexture (useMemo CanvasTexture) dispose
  useEffect(() => {
    return () => {
      glowTexture.dispose();
    };
  }, [glowTexture]);

  // v33: Derive sun position from shared direction ref (distance=500)
  useFrame(() => {
    if (!sunDirRef.current) return;
    const d = 500;
    const x = sunDirRef.current.x * d;
    const y = sunDirRef.current.y * d;
    const z = sunDirRef.current.z * d;
    lightRef.current?.position.set(x, y, z);
    sunRef.current?.position.set(x, y, z);
  });

  return (
    <>
      <directionalLight ref={lightRef} intensity={2.5} color="#FFF8F0" />
      <group ref={sunRef}>
        <mesh>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial color="#FFF8E0" toneMapped={false} />
        </mesh>
        <sprite scale={[50, 50, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
        <sprite scale={[20, 20, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
    </>
  );
}

// ─── Starfield (equirectangular skybox + parallax) ───

interface StarfieldProps {
  sharedTickRef: React.RefObject<SharedTickData>;
}

function Starfield({ sharedTickRef }: StarfieldProps) {
  const { scene } = useThree();
  const milkyWayTexture = useLoader(THREE.TextureLoader, '/textures/stars-milky-way.jpg');
  // v33 Phase 5: AdaptiveQuality context
  const qualityRef = useAdaptiveQualityContext();

  useMemo(() => {
    milkyWayTexture.colorSpace = THREE.SRGBColorSpace;
    milkyWayTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = milkyWayTexture;
  }, [milkyWayTexture, scene]);

  // v33 Phase 3: SharedTickRef에서 cameraDist/cameraDir 읽기 → 중복 계산 제거
  // v33 Phase 5: MEDIUM/LOW 품질에서 별 intensity 최소화
  useFrame(() => {
    const tick = sharedTickRef.current;

    // v33 Phase 5: 별 비활성화 시 최소 intensity (완전 검정 대신 미세한 배경)
    if (!qualityRef.current.enableStars) {
      scene.backgroundIntensity = 0.05;
      scene.backgroundRotation.set(0, 0, 0);
      return;
    }

    const t = THREE.MathUtils.clamp((tick.cameraDist - 150) / (400 - 150), 0, 1);
    const smooth = t * t * (3 - 2 * t);

    scene.backgroundIntensity = 0.3 + smooth * 0.3;

    scene.backgroundRotation.set(
      tick.cameraDir.y * 0.08,
      -tick.cameraDir.x * 0.08,
      0,
    );
  });

  useEffect(() => {
    return () => {
      scene.background = null;
      scene.backgroundIntensity = 1;
      scene.backgroundRotation.set(0, 0, 0);
    };
  }, [scene]);

  return null;
}

// ─── Exported Composite ───
// v33 Task 1: Single sunDirRef computed once per frame, shared to all sub-components
// Accepts external sunDirRef from parent (GlobeScene) to share with SunLight

interface EarthGroupProps {
  sunDirRef: React.RefObject<THREE.Vector3>;
  /** v33 Phase 5: 품질 프리셋 ref (LOW에서 구름 숨김) */
  qualityRef?: React.RefObject<import('@/hooks/useAdaptiveQuality').QualityPreset>;
  /** v47: COBE 스타일 dotted globe 모드 */
  dottedMode?: boolean;
}

export function EarthGroup({ sunDirRef, qualityRef, dottedMode }: EarthGroupProps) {
  return (
    <>
      {dottedMode ? (
        <DottedEarthSphere sunDirRef={sunDirRef} />
      ) : (
        <>
          <EarthSphere sunDirRef={sunDirRef} />
          {/* v33 Phase 5: LOW 품질에서 구름 opacity 제어 */}
          <EarthClouds sunDirRef={sunDirRef} qualityRef={qualityRef} />
          <AtmosphereGlow sunDirRef={sunDirRef} />
        </>
      )}
    </>
  );
}

export { SunLight, Starfield, computeSunDirection };

// v33: Export types for GlobeView to pass sunDirRef
export type { SunDirProp };
