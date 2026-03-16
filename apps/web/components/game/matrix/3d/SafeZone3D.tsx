'use client';

/**
 * SafeZone3D.tsx — Arena 안전지대 3D 시각화 (S38)
 *
 * 1. 반투명 실린더 mesh (안전지대 경계)
 * 2. 바깥 영역: red fog/tint effect (shader)
 * 3. Shrink animation: radius 감소 + target radius 표시
 * 4. Warning vignette: 플레이어 outside 시 화면 효과
 * 5. Direction arrow: billboard pointing to safe center
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 *
 * 참조: apps/web/lib/matrix/rendering/arena/safeZone.ts (기존 2D 구현)
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SafeZone, Player } from '@/lib/matrix/types';

// ============================================
// Constants
// ============================================

/** 안전지대 벽 높이 (3D units) */
const WALL_HEIGHT = 60;

/** 위험 영역 평면 크기 */
const DANGER_PLANE_SIZE = 6000;

/** 방향 화살표 표시 거리 (플레이어와 화면 가장자리 사이) */
const ARROW_DISTANCE = 12;

// ============================================
// Shader — 위험 영역 표시 (원 밖 = 빨간 반투명)
// ============================================

const SAFE_ZONE_VERT = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    // 월드 좌표를 fragment shader로 전달
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xz; // XZ 평면 (Y는 높이)
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SAFE_ZONE_FRAG = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform vec3 uColor;
  uniform float uPulse;
  varying vec2 vWorldPos;

  void main() {
    float dist = distance(vWorldPos, uCenter);

    // 안전지대 내부: 완전 투명
    if (dist < uRadius) {
      discard;
    }

    // 경계 근처: 부드러운 전환
    float edgeFade = smoothstep(uRadius, uRadius + 30.0, dist);

    // 거리에 따라 점점 진해지는 빨간색
    float intensity = min(edgeFade * 0.25, 0.35);

    // 펄스 효과 (축소 중)
    intensity *= (0.85 + uPulse * 0.15);

    gl_FragColor = vec4(uColor, intensity);
  }
`;

// ============================================
// Props
// ============================================

export interface SafeZone3DProps {
  /** 안전지대 상태 ref (UseArenaReturn에서) */
  safeZoneRef?: React.MutableRefObject<SafeZone>;
  /** 안전지대 상태 (직접 전달) */
  safeZone?: SafeZone;
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
  /** 위험 경고 강도 ref (PostProcessing에 전달) */
  warningIntensityRef?: React.MutableRefObject<number>;
}

/**
 * SafeZone3D — Arena 안전지대 3D 시각화
 *
 * 구성 요소:
 * 1. 반투명 실린더 (안전지대 벽) — phase별 색상 변화
 * 2. 위험 영역 평면 (shader 기반 원형 hole)
 * 3. 목표 반경 링 (축소 중일 때)
 * 4. 방향 화살표 (바깥에 있을 때 안전지대 중심 방향)
 * 5. 경고 표시 (안전지대 밖 텍스트)
 */
export function SafeZone3D({
  safeZoneRef,
  safeZone: safeZoneProp,
  playerRef,
  warningIntensityRef,
}: SafeZone3DProps) {
  // Refs
  const wallRef = useRef<THREE.Mesh>(null);
  const dangerPlaneRef = useRef<THREE.Mesh>(null);
  const targetRingRef = useRef<THREE.Mesh>(null);
  const arrowGroupRef = useRef<THREE.Group>(null);
  const warningDomRef = useRef<HTMLDivElement>(null);

  // 안전지대 벽 material
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // 위험 영역 shader material
  const dangerMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uCenter: { value: new THREE.Vector2(0, 0) },
          uRadius: { value: 1000 },
          uColor: { value: new THREE.Color(0.7, 0.0, 0.0) },
          uPulse: { value: 1.0 },
        },
        vertexShader: SAFE_ZONE_VERT,
        fragmentShader: SAFE_ZONE_FRAG,
      }),
    []
  );

  // 목표 반경 링 material
  const targetRingMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // 정리
  useEffect(() => {
    return () => {
      wallMaterial.dispose();
      dangerMaterial.dispose();
      targetRingMaterial.dispose();
    };
  }, [wallMaterial, dangerMaterial, targetRingMaterial]);

  // useFrame: 안전지대 상태 반영
  useFrame(() => {
    // safeZone 상태 가져오기
    const sz = safeZoneRef?.current ?? safeZoneProp;
    if (!sz || !sz.center) return;

    const player = playerRef.current;
    const centerX = sz.center.x;
    const centerZ = -sz.center.y; // 2D → 3D 좌표 변환
    const currentRadius = sz.currentRadius;
    const targetRadius = sz.targetRadius;

    // ─── 1. 안전지대 벽 (반투명 실린더) ───
    if (wallRef.current) {
      wallRef.current.position.set(centerX, WALL_HEIGHT / 2, centerZ);
      // CylinderGeometry args=[radiusTop, radiusBottom, height, radialSegments]
      // 스케일로 반경 조절 (초기 반경 100 기준)
      const scale = currentRadius / 100;
      wallRef.current.scale.set(scale, 1, scale);

      // Phase별 색상 변화
      const phase = sz.phase ?? 0;
      let wallColor: number;
      if (phase <= 1) {
        wallColor = 0x00ff88; // 녹색
      } else if (phase <= 2) {
        wallColor = 0xffaa00; // 주황
      } else {
        wallColor = 0xff3333; // 빨강
      }
      wallMaterial.color.setHex(wallColor);

      // 경고 시 펄스 opacity
      if (sz.isWarning) {
        const pulse = Math.sin(Date.now() / 200) * 0.05 + 0.15;
        wallMaterial.opacity = pulse;
      } else {
        wallMaterial.opacity = 0.12;
      }
    }

    // ─── 2. 위험 영역 평면 ───
    if (dangerPlaneRef.current) {
      dangerPlaneRef.current.position.set(centerX, 0.05, centerZ);

      const mat = dangerPlaneRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uCenter.value.set(centerX, centerZ);
      mat.uniforms.uRadius.value = currentRadius;

      // 축소 중 펄스
      if (sz.isShrinking) {
        mat.uniforms.uPulse.value = Math.sin(Date.now() / 150) * 0.5 + 1.0;
      } else {
        mat.uniforms.uPulse.value = 1.0;
      }
    }

    // ─── 3. 목표 반경 링 ───
    if (targetRingRef.current) {
      if (currentRadius > targetRadius && targetRadius > 0) {
        targetRingRef.current.visible = true;
        targetRingRef.current.position.set(centerX, 0.1, centerZ);
        const targetScale = targetRadius / 100;
        targetRingRef.current.scale.set(targetScale, 1, targetScale);
      } else {
        targetRingRef.current.visible = false;
      }
    }

    // ─── 4. 플레이어 outside 판정 + 경고 ───
    const playerDist = Math.sqrt(
      (player.position.x - sz.center.x) ** 2 + (player.position.y - sz.center.y) ** 2
    );
    const isOutside = playerDist > currentRadius;
    const overDistance = isOutside ? playerDist - currentRadius : 0;
    const warningIntensity = Math.min(1, overDistance / 200);

    // PostProcessing에 warning intensity 전달
    if (warningIntensityRef) {
      warningIntensityRef.current = warningIntensity;
    }

    // ─── 5. 방향 화살표 (안전지대 밖일 때) ───
    if (arrowGroupRef.current) {
      if (isOutside) {
        arrowGroupRef.current.visible = true;

        // 플레이어 → 안전지대 중심 방향
        const angle = Math.atan2(
          sz.center.y - player.position.y,
          sz.center.x - player.position.x
        );

        // 플레이어 머리 위에 화살표 배치
        const arrowX = player.position.x + Math.cos(angle) * ARROW_DISTANCE;
        const arrowZ = player.position.y + Math.sin(angle) * ARROW_DISTANCE;
        arrowGroupRef.current.position.set(arrowX, 6, arrowZ);
        arrowGroupRef.current.rotation.y = -angle + Math.PI / 2;
      } else {
        arrowGroupRef.current.visible = false;
      }
    }

    // ─── 6. 경고 텍스트 DOM 업데이트 ───
    if (warningDomRef.current) {
      if (isOutside) {
        const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
        warningDomRef.current.style.display = 'block';
        warningDomRef.current.style.opacity = String(0.5 + pulse * 0.5);
      } else {
        warningDomRef.current.style.display = 'none';
      }
    }
  });

  return (
    <group>
      {/* 안전지대 벽 — 반투명 실린더 */}
      <mesh ref={wallRef} material={wallMaterial}>
        <cylinderGeometry args={[100, 100, WALL_HEIGHT, 64, 1, true]} />
      </mesh>

      {/* 위험 영역 — 전체 월드 커버 평면 + 원형 hole shader */}
      <mesh
        ref={dangerPlaneRef}
        rotation={[-Math.PI / 2, 0, 0]}
        material={dangerMaterial}
      >
        <planeGeometry args={[DANGER_PLANE_SIZE, DANGER_PLANE_SIZE]} />
      </mesh>

      {/* 목표 반경 링 — 점선 표시 (축소 중) */}
      <mesh
        ref={targetRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        material={targetRingMaterial}
      >
        <ringGeometry args={[99, 101, 64]} />
      </mesh>

      {/* 방향 화살표 — Billboard (항상 카메라를 향함) */}
      <group ref={arrowGroupRef} visible={false}>
        <Billboard>
          <mesh>
            <coneGeometry args={[0.8, 2.0, 4]} />
            <meshBasicMaterial
              color={0x00ff41}
              transparent
              opacity={0.8}
            />
          </mesh>
        </Billboard>
      </group>

      {/* 경고 텍스트 — 플레이어 머리 위 HTML */}
      <Html
        position={[0, 8, 0]}
        center
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={warningDomRef}
          style={{
            display: 'none',
            color: '#ff3333',
            fontSize: '16px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            textShadow: '0 0 8px rgba(255, 0, 0, 0.8)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          ! OUTSIDE SAFE ZONE !
        </div>
      </Html>
    </group>
  );
}

export default SafeZone3D;
