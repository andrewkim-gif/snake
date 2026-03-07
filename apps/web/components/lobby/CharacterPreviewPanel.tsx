'use client';

/**
 * CharacterPreviewPanel — 280px 풀패널 3D 캐릭터 프리뷰
 *
 * Phase 2: 로비 캐릭터 프리뷰 강화
 *   - 패널 전체 너비(280px) × 180px 높이 활용
 *   - 드래그 회전: 마우스/터치 Y축 회전
 *   - 자동 회전: 3초 미조작 시 0.3 rad/s
 *   - 3-point lighting (key + fill + rim) + 바닥 그림자
 *   - 모바일: 높이 150px, dpr 제한 1.5
 */

import { useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CubelingAppearance } from '@agent-survivor/shared';
import { SK } from '@/lib/sketch-ui';
import { VoxelCharacter } from '@/components/3d/VoxelCharacter';

// ─── 상수 ───

const IDLE_TIMEOUT = 3.0;       // 3초 미조작 → 자동 회전 시작
const AUTO_ROTATE_SPEED = 0.3;  // rad/s
const DRAG_SENSITIVITY = 0.008; // px → rad 변환 계수
const CAMERA_RADIUS = 3.2;
const CAMERA_HEIGHT = 1.8;
const LOOK_AT_Y = 0.85;

// ─── 프리뷰 카메라 (드래그 + 자동 회전) ───

interface PreviewCameraProps {
  angleRef: React.MutableRefObject<number>;
  idleTimeRef: React.MutableRefObject<number>;
}

function PreviewCamera({ angleRef, idleTimeRef }: PreviewCameraProps) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    // 자동 회전: idle 시간이 임계값 초과 시
    idleTimeRef.current += delta;
    if (idleTimeRef.current > IDLE_TIMEOUT) {
      angleRef.current += AUTO_ROTATE_SPEED * delta;
    }

    const a = angleRef.current;
    camera.position.set(
      Math.cos(a) * CAMERA_RADIUS,
      CAMERA_HEIGHT,
      Math.sin(a) * CAMERA_RADIUS,
    );
    camera.lookAt(0, LOOK_AT_Y, 0);
  });

  return null;
}

// ─── 바닥 그림자 ───

function FloorShadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <circleGeometry args={[0.8, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.15} />
    </mesh>
  );
}

// ─── Props ───

interface CharacterPreviewPanelProps {
  appearance: CubelingAppearance;
  skinId: number;
  /** 프리뷰 높이 (기본 240px) */
  height?: number;
}

export function CharacterPreviewPanel({ appearance, skinId, height = 240 }: CharacterPreviewPanelProps) {
  const angleRef = useRef(Math.PI / 2); // 카메라가 +Z 정면을 바라보도록
  const idleTimeRef = useRef(IDLE_TIMEOUT + 1); // 처음엔 자동 회전 시작
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 드래그 시작
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    lastX.current = e.clientX;
    idleTimeRef.current = 0; // 자동 회전 리셋
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  // 드래그 중
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastX.current;
    angleRef.current += dx * DRAG_SENSITIVITY;
    lastX.current = e.clientX;
    idleTimeRef.current = 0;
  }, []);

  // 드래그 종료
  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    idleTimeRef.current = 0;
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: 0,
        border: `1px solid ${SK.border}`,
        backgroundColor: SK.bgWarm,
        overflow: 'hidden',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        touchAction: 'none',    // 터치 드래그 시 스크롤 방지
        userSelect: 'none',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 40, near: 0.1, far: 20 }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* 3-point lighting */}
        <ambientLight intensity={0.4} />
        {/* Key light — 우상단 메인 조명 */}
        <directionalLight
          position={[3, 5, 2]}
          intensity={0.8}
          color="#FFFFFF"
        />
        {/* Fill light — 좌하단 보조 (약한 블루 톤) */}
        <directionalLight
          position={[-3, 2, -1]}
          intensity={0.3}
          color="#A0C0FF"
        />
        {/* Rim light — 뒤쪽 역광 (골드 톤) */}
        <directionalLight
          position={[0, 3, -4]}
          intensity={0.4}
          color="#FFE0A0"
        />

        <PreviewCamera angleRef={angleRef} idleTimeRef={idleTimeRef} />

        <Suspense fallback={null}>
          <VoxelCharacter
            skinId={skinId}
            appearance={appearance}
            position={[0, 0, 0]}
            rotation={0}
            phaseOffset={0}
            showcaseMode
          />
          <FloorShadow />
        </Suspense>
      </Canvas>
    </div>
  );
}
