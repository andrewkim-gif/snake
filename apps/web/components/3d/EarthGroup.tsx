'use client';

/**
 * EarthGroup — Earth sphere (PBR day/night), clouds, atmosphere glow, sun, starfield.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
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
} from '@/lib/globe-shaders';

// ─── Sun direction helper (UTC-based realtime position) ───

function computeSunDirection(out: THREE.Vector3): void {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
  const ha = ((utcH - 12) / 24) * 2 * Math.PI;
  const sx = Math.cos(decRad) * Math.cos(ha);
  const sy = Math.sin(decRad);
  const sz = Math.cos(decRad) * Math.sin(ha);
  out.set(sx, sy, sz).normalize();
}

// ─── EarthSphere (PBR day/night + normal + specular) ───

function EarthSphere() {
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

  const earthMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTexture },
        uNightMap: { value: createBlackTexture() },
        uNormalMap: { value: createFlatNormalTexture() },
        uSpecularMap: { value: createBlackSpecularTexture() },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
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

  useFrame(() => {
    computeSunDirection(earthMat.uniforms.uSunDir.value);
  });

  return (
    <mesh material={earthMat}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
    </mesh>
  );
}

// ─── EarthClouds ───

function EarthClouds() {
  const cloudsTextureRef = useRef<THREE.Texture | null>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
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

  const cloudsMat = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudsMap: { value: createBlackTexture() },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: cloudsVertexShader,
      fragmentShader: cloudsFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    matRef.current = mat;
    return mat;
  }, []);

  useEffect(() => {
    if (ready && cloudsTextureRef.current && matRef.current) {
      matRef.current.uniforms.uCloudsMap.value = cloudsTextureRef.current;
      matRef.current.uniformsNeedUpdate = true;
    }
  }, [ready]);

  useFrame(() => {
    if (!matRef.current) return;
    computeSunDirection(matRef.current.uniforms.uSunDir.value);
  });

  return (
    <mesh material={cloudsMat} renderOrder={50}>
      <sphereGeometry args={[GLOBE_RADIUS * 1.005, 64, 64]} />
    </mesh>
  );
}

// ─── AtmosphereGlow ───

function AtmosphereGlow() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (!matRef.current) return;
    computeSunDirection(matRef.current.uniforms.uSunDir.value);
  });

  return (
    <mesh renderOrder={48}>
      <sphereGeometry args={[GLOBE_RADIUS * 1.02, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={atmoVertexShader}
        fragmentShader={atmoFragmentShader}
        uniforms={{ uSunDir: { value: new THREE.Vector3(1, 0, 0) } }}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── SunLight (UTC-based realtime position + corona glow) ───

function SunLight() {
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

  useFrame(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
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

const _starCamDir = new THREE.Vector3();

function Starfield() {
  const { scene, camera } = useThree();
  const milkyWayTexture = useLoader(THREE.TextureLoader, '/textures/stars-milky-way.jpg');

  useMemo(() => {
    milkyWayTexture.colorSpace = THREE.SRGBColorSpace;
    milkyWayTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = milkyWayTexture;
  }, [milkyWayTexture, scene]);

  useFrame(() => {
    const dist = camera.position.length();
    const t = THREE.MathUtils.clamp((dist - 150) / (400 - 150), 0, 1);
    const smooth = t * t * (3 - 2 * t);

    scene.backgroundIntensity = 0.3 + smooth * 0.3;

    _starCamDir.copy(camera.position).normalize();
    scene.backgroundRotation.set(
      _starCamDir.y * 0.08,
      -_starCamDir.x * 0.08,
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

export function EarthGroup() {
  return (
    <>
      <EarthSphere />
      <EarthClouds />
      <AtmosphereGlow />
    </>
  );
}

export { SunLight, Starfield };
