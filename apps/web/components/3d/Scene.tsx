'use client';

/**
 * Scene — 라이팅 + 분위기 설정 + 라운드 시간 기반 atmosphere 변화
 * MC 플랫 셰이딩: ambientLight + directionalLight
 * castShadow=false (성능 + MC 미학)
 *
 * 테마별 fog/sky/lighting 설정:
 *   forest:   녹색 안개, 중간 밝기
 *   desert:   노란 안개, 밝은 태양
 *   mountain: 회색 안개, 가까운 시야
 *   urban:    중성 안개, 차가운 조명
 *   arctic:   흰 안개, 낮은 대비
 *   island:   파란 안개, 밝은 태양
 *
 * 분위기 시스템 (라운드 경과):
 *   0~2분: 기본 테마색
 *   2~4분: → 어두워짐
 *   4~5분: → 긴박한 보라
 *   fog near: 점점 좁아짐 (시야 좁아짐)
 *
 * useFrame priority 0 필수!
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainPalette } from '@/lib/3d/terrain-textures';

interface SceneProps {
  /** 라운드 남은 시간 (초). 기본값=300(5분). undefined면 분위기 변화 없음 */
  timeRemaining?: number;
  /** 테마 이름 (forest/desert/mountain/urban/arctic/island) */
  theme?: string;
  /** v19: 아레나 모드 — MCScene 스타일 조명 (하늘색 안개 + 포인트 라이트) */
  isArenaMode?: boolean;
}

// ─── 색상 보간 헬퍼 ───

const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _colorResult = new THREE.Color();

/** 세 단계 색상 보간: t=0→base, t≈0.6→dusk, t=1→night */
function getAtmosphereColor(baseColor: string, t: number): THREE.Color {
  const dusk = '#5566AA';
  const night = '#332244';

  if (t <= 0.4) {
    _colorResult.set(baseColor);
  } else if (t <= 0.8) {
    const localT = (t - 0.4) / 0.4;
    _colorA.set(baseColor);
    _colorB.set(dusk);
    _colorResult.copy(_colorA).lerp(_colorB, localT);
  } else {
    const localT = (t - 0.8) / 0.2;
    _colorA.set(dusk);
    _colorB.set(night);
    _colorResult.copy(_colorA).lerp(_colorB, localT);
  }

  return _colorResult;
}

// v19: 아레나 모드 MC 스타일 씬 상수 (MCScene.tsx에서 가져옴)
const MC_SKY_COLOR = 0x87ceeb;
const MC_FOG_NEAR = 1;
const MC_FOG_FAR = 120; // 아레나 반경(80블록) 내 가시 거리

export function Scene({ timeRemaining, theme = 'forest', isArenaMode }: SceneProps) {
  const { scene } = useThree();
  const fogRef = useRef<THREE.Fog | null>(null);
  const palette = getTerrainPalette(theme);

  // Fog + 배경색 설정 (아레나 모드: MC 스타일, 클래식: 테마별)
  useEffect(() => {
    let fog: THREE.Fog;
    if (isArenaMode) {
      fog = new THREE.Fog(MC_SKY_COLOR, MC_FOG_NEAR, MC_FOG_FAR);
      scene.background = new THREE.Color(MC_SKY_COLOR);
    } else {
      fog = new THREE.Fog(palette.fogColor, palette.fogNear, palette.fogFar);
      scene.background = new THREE.Color(palette.skyColor);
    }
    scene.fog = fog;
    fogRef.current = fog;

    return () => {
      scene.fog = null;
      scene.background = null;
      fogRef.current = null;
    };
  }, [scene, palette.fogColor, palette.fogNear, palette.fogFar, palette.skyColor, isArenaMode]);

  // ─── 분위기 변화 (라운드 시간 기반, 아레나 모드에서는 고정) ───
  useFrame(() => {
    const fog = fogRef.current;
    if (!fog) return;

    // 아레나 모드: 고정 MC 스타일 안개 (분위기 변화 없음)
    if (isArenaMode) return;

    if (timeRemaining === undefined || timeRemaining >= 300) {
      fog.color.set(palette.fogColor);
      fog.near = palette.fogNear;
      if (scene.background instanceof THREE.Color) {
        scene.background.set(palette.skyColor);
      }
      return;
    }

    const totalDuration = 300;
    const t = Math.max(0, Math.min(1, 1 - timeRemaining / totalDuration));

    const color = getAtmosphereColor(palette.fogColor, t);
    fog.color.copy(color);
    fog.near = palette.fogNear - t * 250;

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(color);
    }
  });

  // v19: 아레나 모드 → MC 스타일 조명 (reference: minecraft-threejs/src/core/index.ts)
  // Canvas flat={true} → NoToneMapping 이므로 reference와 동일한 밝기 보장
  if (isArenaMode) {
    return (
      <>
        {/* MC reference: AmbientLight(0x404040) — NoToneMapping에서 충분한 기본 조명 */}
        <ambientLight color={0x404040} intensity={1} />
        {/* MC reference: PointLight(0xffffff, 0.5) at (500,500,500) — 태양 역할 */}
        <pointLight position={[500, 500, 500]} intensity={0.5} color={0xffffff} />
        {/* MC reference: PointLight(0xffffff, 0.2) at (-500,500,-500) — 보조광 */}
        <pointLight position={[-500, 500, -500]} intensity={0.2} color={0xffffff} />
      </>
    );
  }

  return (
    <>
      {/* 환경광 — 테마별 강도 */}
      <ambientLight intensity={palette.ambientIntensity} />

      {/* 방향광 — 태양 역할, 테마별 위치/강도 */}
      <directionalLight
        position={palette.sunPosition}
        intensity={palette.sunIntensity}
        castShadow={false}
      />
    </>
  );
}
