'use client';

/**
 * Scene — 라이팅 + 분위기 설정 + 라운드 시간 기반 atmosphere 변화
 * MC 플랫 셰이딩: ambientLight 0.55 + directionalLight 0.85
 * castShadow=false (성능 + MC 미학)
 * Fog: '#87CEEB' near=400 far=1200 (분위기 + 원거리 페이드)
 *
 * 분위기 시스템:
 *   0~2분: #87CEEB (맑은 하늘)
 *   2~4분: → #5566AA (어두워짐)
 *   4~5분: → #332244 (긴박한 보라)
 *   fog near: 400 → 250 (시야 좁아짐)
 *
 * useFrame priority 0 필수!
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneProps {
  /** 라운드 남은 시간 (초). 기본값=300(5분). undefined면 분위기 변화 없음 */
  timeRemaining?: number;
}

// ─── 색상 보간 헬퍼 ───

const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _colorResult = new THREE.Color();

/** 세 단계 색상 보간: t=0→sky, t≈0.6→dusk, t=1→night */
function getAtmosphereColor(t: number): THREE.Color {
  const sky = '#87CEEB';
  const dusk = '#5566AA';
  const night = '#332244';

  if (t <= 0.4) {
    _colorResult.set(sky);
  } else if (t <= 0.8) {
    const localT = (t - 0.4) / 0.4;
    _colorA.set(sky);
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

export function Scene({ timeRemaining }: SceneProps) {
  const { scene } = useThree();
  const fogRef = useRef<THREE.Fog | null>(null);

  // Fog 설정 — scene.fog 직접 할당 (JSX로 불가)
  useEffect(() => {
    const fog = new THREE.Fog('#87CEEB', 400, 1200);
    scene.fog = fog;
    scene.background = new THREE.Color('#87CEEB');
    fogRef.current = fog;

    return () => {
      scene.fog = null;
      scene.background = null;
      fogRef.current = null;
    };
  }, [scene]);

  // ─── 분위기 변화 (라운드 시간 기반) ───
  useFrame(() => {
    const fog = fogRef.current;
    if (!fog) return;

    if (timeRemaining === undefined || timeRemaining >= 300) {
      fog.color.set('#87CEEB');
      fog.near = 400;
      if (scene.background instanceof THREE.Color) {
        scene.background.set('#87CEEB');
      }
      return;
    }

    const totalDuration = 300;
    const t = Math.max(0, Math.min(1, 1 - timeRemaining / totalDuration));

    const color = getAtmosphereColor(t);
    fog.color.copy(color);
    fog.near = 400 - t * 150;

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(color);
    }
  });

  return (
    <>
      {/* 환경광 — 전체 균일 조명, MC 플랫 느낌 */}
      <ambientLight intensity={0.55} />

      {/* 방향광 — 태양 역할, 그림자 없음 (MC 미학 + 성능) */}
      <directionalLight
        position={[100, 150, 80]}
        intensity={0.85}
        castShadow={false}
      />
    </>
  );
}
