'use client';

/**
 * GlobeTitle — 3D "AI WORLD WAR" title image billboard above globe.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

import { useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// ─── useNoBloomMaterial Hook ───

/**
 * Bloom-proof MeshBasicMaterial.
 * toneMapped: false로 원본 텍스처 밝기를 그대로 유지하면서,
 * bloom luminance pass에서만 어둡게 출력하여 bloom 번짐을 방지.
 */
export function useNoBloomMaterial(texture: THREE.Texture) {
  return useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return mat;
  }, [texture]);
}

// ─── GlobeTitle Component ───

export function GlobeTitle() {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const texture = useTexture('/assets/generated/title-3d.png');
  const material = useNoBloomMaterial(texture);

  useFrame((state) => {
    if (!groupRef.current) return;
    // 빌보드: 항상 카메라를 향함
    groupRef.current.quaternion.copy(camera.quaternion);
    // 부유 애니메이션: 부드러운 상하 흔들림
    groupRef.current.position.y = 138 + Math.sin(state.clock.elapsedTime * 0.5) * 1.5;
  });

  // 텍스처 비율에 맞춰 plane 크기 설정
  const img = texture.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / img.height : 4;
  const planeHeight = 9;
  const planeWidth = planeHeight * aspect;

  return (
    <group ref={groupRef} position={[0, 138, 0]}>
      <mesh>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}
