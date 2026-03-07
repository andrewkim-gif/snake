'use client';

/**
 * WeatherEffects — v16 Phase 8 날씨 비주얼 시스템
 *
 * R3F instancedMesh 기반 파티클: 비/눈/모래 입자
 * drei fog 동적 조절
 * 번개 플래시 (DirectionalLight + CSS overlay)
 *
 * CRITICAL: useFrame priority 0 (기본값) 사용!
 */

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── 상수 ───
const MAX_PARTICLES = 800;
const RAIN_SPEED = 120;       // units/sec downward
const SNOW_SPEED = 15;        // units/sec downward (느리게)
const SAND_SPEED = 40;        // units/sec lateral
const PARTICLE_SPREAD = 120;  // XZ 반경 (카메라 주변)
const PARTICLE_HEIGHT = 80;   // Y 범위 (카메라 위)
const PARTICLE_RESET_Y = -5;  // 리셋 기준 높이

// 날씨별 fog 설정
const FOG_CONFIG: Record<string, { near: number; far: number; color: string }> = {
  clear:     { near: 800, far: 3000, color: '#87CEEB' },
  rain:      { near: 100, far: 600,  color: '#5A6575' },
  snow:      { near: 150, far: 700,  color: '#B8C8D8' },
  sandstorm: { near: 50,  far: 400,  color: '#C4A265' },
  fog:       { near: 30,  far: 250,  color: '#8A9AA8' },
};

// 날씨별 파티클 색상
const PARTICLE_COLORS: Record<string, THREE.Color> = {
  rain: new THREE.Color(0.6, 0.7, 0.9),
  snow: new THREE.Color(0.95, 0.95, 1.0),
  sandstorm: new THREE.Color(0.8, 0.65, 0.35),
};

interface WeatherEffectsProps {
  /** 서버에서 전달된 날씨 상태 */
  weather: { type: string; intensity: number } | null;
}

// 임시 객체 (GC 방지)
const _tempObj = new THREE.Object3D();
const _tempColor = new THREE.Color();

export function WeatherEffects({ weather }: WeatherEffectsProps) {
  const { scene, camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const [lightningFlash, setLightningFlash] = useState(false);

  const weatherType = weather?.type ?? 'clear';
  const intensity = weather?.intensity ?? 0;
  const isActive = weatherType !== 'clear' && intensity > 0;
  const particleCount = isActive ? Math.floor(MAX_PARTICLES * Math.min(1, intensity)) : 0;

  // 파티클 초기 위치 (오프셋 배열)
  const offsets = useMemo(() => {
    const arr = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * PARTICLE_SPREAD * 2;
      arr[i * 3 + 1] = Math.random() * PARTICLE_HEIGHT;
      arr[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD * 2;
    }
    return arr;
  }, []);

  // 파티클 랜덤 스피드 변동
  const speedVariation = useMemo(() => {
    const arr = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      arr[i] = 0.7 + Math.random() * 0.6;
    }
    return arr;
  }, []);

  // 파티클 geometry — 날씨별 형태
  const geometry = useMemo(() => {
    if (weatherType === 'rain') {
      // 비: 얇은 세로 라인 모양
      return new THREE.BoxGeometry(0.05, 0.8, 0.05);
    } else if (weatherType === 'snow') {
      // 눈: 작은 구
      return new THREE.IcosahedronGeometry(0.15, 0);
    } else if (weatherType === 'sandstorm') {
      // 모래: 작은 사각형
      return new THREE.BoxGeometry(0.12, 0.12, 0.12);
    }
    return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }, [weatherType]);

  // 파티클 material
  const material = useMemo(() => {
    const color = PARTICLE_COLORS[weatherType] ?? new THREE.Color(1, 1, 1);
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(0.7, intensity * 0.8),
      depthWrite: false,
    });
  }, [weatherType, intensity]);

  // ─── Fog 동적 조절 ───
  useEffect(() => {
    const config = FOG_CONFIG[weatherType] ?? FOG_CONFIG.clear;
    const fogColor = new THREE.Color(config.color);

    // Lerp toward target fog
    const targetNear = config.near;
    const targetFar = config.far;

    if (!scene.fog) {
      scene.fog = new THREE.Fog(fogColor, targetNear, targetFar);
    } else if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(fogColor);
      scene.fog.near = targetNear;
      scene.fog.far = targetFar;
    }

    return () => {
      // 정리 시 fog 리셋
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = 800;
        scene.fog.far = 3000;
        scene.fog.color.set('#87CEEB');
      }
    };
  }, [weatherType, scene]);

  // ─── 번개 플래시 (비 날씨에서만, 랜덤 간격) ───
  useEffect(() => {
    if (weatherType !== 'rain') return;

    const triggerLightning = () => {
      setLightningFlash(true);
      setTimeout(() => setLightningFlash(false), 150);
      setTimeout(() => {
        setLightningFlash(true);
        setTimeout(() => setLightningFlash(false), 80);
      }, 200);
    };

    // 10~30초 간격 랜덤 번개
    const scheduleNext = () => {
      const delay = 10000 + Math.random() * 20000;
      return setTimeout(() => {
        triggerLightning();
        timerRef = scheduleNext();
      }, delay);
    };

    let timerRef = scheduleNext();
    return () => clearTimeout(timerRef);
  }, [weatherType]);

  // ─── 파티클 애니메이션 (priority 0) ───
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !isActive) {
      if (mesh) mesh.count = 0;
      return;
    }

    mesh.count = particleCount;
    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    for (let i = 0; i < particleCount; i++) {
      const sv = speedVariation[i];
      const idx = i * 3;

      // 이동
      switch (weatherType) {
        case 'rain':
          offsets[idx + 1] -= RAIN_SPEED * sv * delta;
          offsets[idx]     += (Math.random() - 0.5) * 2 * delta; // 약간의 수평 흔들림
          break;
        case 'snow':
          offsets[idx + 1] -= SNOW_SPEED * sv * delta;
          offsets[idx]     += Math.sin(offsets[idx + 1] * 0.5 + i) * 3 * delta; // 눈 흔들림
          offsets[idx + 2] += Math.cos(offsets[idx + 1] * 0.3 + i * 0.5) * 2 * delta;
          break;
        case 'sandstorm':
          offsets[idx]     += SAND_SPEED * sv * delta; // 수평 이동
          offsets[idx + 1] -= 5 * sv * delta;          // 약간의 하강
          offsets[idx + 2] += (Math.random() - 0.5) * 10 * delta;
          break;
      }

      // 경계 리셋: 카메라 주변 재배치
      if (offsets[idx + 1] < PARTICLE_RESET_Y) {
        offsets[idx + 1] = PARTICLE_HEIGHT;
        offsets[idx]     = (Math.random() - 0.5) * PARTICLE_SPREAD * 2;
        offsets[idx + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD * 2;
      }

      // 모래폭풍: 수평 경계 리셋
      if (weatherType === 'sandstorm' && offsets[idx] > PARTICLE_SPREAD) {
        offsets[idx] = -PARTICLE_SPREAD;
      }

      // 월드 좌표 = 카메라 + 오프셋
      _tempObj.position.set(
        camX + offsets[idx],
        Math.max(0, camY * 0.3 + offsets[idx + 1]),
        camZ + offsets[idx + 2],
      );

      // 비는 세로 방향 유지
      if (weatherType === 'rain') {
        _tempObj.rotation.set(0, 0, (Math.random() - 0.5) * 0.1);
      } else if (weatherType === 'snow') {
        _tempObj.rotation.set(
          offsets[idx + 1] * 0.1,
          offsets[idx] * 0.05,
          offsets[idx + 2] * 0.1,
        );
      }

      _tempObj.updateMatrix();
      mesh.setMatrixAt(i, _tempObj.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    // 번개 라이트 강도
    if (lightRef.current) {
      lightRef.current.intensity = lightningFlash ? 5 : 0;
    }
  });

  if (!isActive) return null;

  return (
    <>
      {/* 파티클 InstancedMesh */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, MAX_PARTICLES]}
        frustumCulled={false}
      />

      {/* 번개 라이트 (비 날씨) */}
      {weatherType === 'rain' && (
        <directionalLight
          ref={lightRef}
          position={[100, 200, 50]}
          intensity={0}
          color="#FFFFFF"
        />
      )}

      {/* CSS 번개 플래시 오버레이 (HTML) — 별도 import 필요 */}
    </>
  );
}

/**
 * LightningFlashOverlay — CSS 번개 플래시 (Canvas 밖 HTML)
 */
export function LightningFlashOverlay({ weather }: { weather: { type: string; intensity: number } | null }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (weather?.type !== 'rain') return;

    const triggerFlash = () => {
      setFlash(true);
      setTimeout(() => setFlash(false), 100);
      setTimeout(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 60);
      }, 150);
    };

    const scheduleNext = () => {
      const delay = 12000 + Math.random() * 25000;
      return setTimeout(() => {
        triggerFlash();
        timerRef = scheduleNext();
      }, delay);
    };

    let timerRef = scheduleNext();
    return () => clearTimeout(timerRef);
  }, [weather?.type]);

  if (!flash) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        pointerEvents: 'none',
        zIndex: 5,
        transition: 'opacity 50ms',
      }}
    />
  );
}

/**
 * WeatherHUD — 현재 날씨 표시 (좌상단)
 */
export function WeatherHUD({ weather }: { weather: { type: string; intensity: number } | null }) {
  if (!weather || weather.type === 'clear') return null;

  const labels: Record<string, string> = {
    rain: 'RAIN',
    snow: 'SNOW',
    sandstorm: 'SANDSTORM',
    fog: 'FOG',
  };

  const icons: Record<string, string> = {
    rain: '\u{1F327}',       // cloud with rain
    snow: '\u{2744}',        // snowflake
    sandstorm: '\u{1F32A}',  // tornado
    fog: '\u{1F32B}',        // fog
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '52px',
        left: '12px',
        zIndex: 15,
        pointerEvents: 'none',
        fontFamily: '"Black Ops One", "Patrick Hand", "Inter", sans-serif',
        fontSize: '0.7rem',
        color: '#E8E0D4',
        backgroundColor: 'rgba(17, 17, 17, 0.6)',
        padding: '4px 10px',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.15)',
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span>{icons[weather.type] ?? ''}</span>
      <span>{labels[weather.type] ?? weather.type.toUpperCase()}</span>
    </div>
  );
}
