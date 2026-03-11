'use client';

/**
 * MatrixScene.tsx — R3F 기반 3D 렌더링 엔진 (Phase 0+1+2+5+6)
 *
 * Canvas 2D MatrixCanvas.tsx의 3D 대체 컴포넌트.
 * 게임 로직(useGameLoop)은 동일하게 재사용하고,
 * 렌더링만 Three.js Scene Graph로 교체한다.
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 *
 * Phase 0 통합 항목:
 * - useGameLoop (Worker 기반 게임 로직)
 * - GameCamera (Isometric OrthographicCamera + LERP + Zoom + Shake)
 * - GameLighting (Ambient + Directional x2 + Shadows)
 *
 * Phase 1 통합 항목 (Terrain):
 * - VoxelTerrain (Chunked 3D 지형 + Biome + Noise)
 * - TerrainObjects (InstancedMesh 지형 오브젝트)
 * - PickupRenderer (XP Orb + Item Drop 3D)
 *
 * Phase 2 통합 항목 (Character):
 * - VoxelCharacter (3-head chibi BoxGeometry 캐릭터, S16+S18)
 *
 * Phase 5 통합 항목 (Effects):
 * - PostProcessingEffects (Bloom + Vignette, S33)
 * - ParticleSystem (InstancedMesh 파티클, S34)
 *
 * Phase 6 통합 항목 (UI & HUD):
 * - WorldUI (drei Html 앵커링 시스템, S35)
 * - DamageNumbers (Object Pool DOM, S36)
 * - EntityUI (HP바 + 네임태그, S37)
 * - SafeZone3D (안전지대 3D 시각화, S38)
 * - HUD Overlay (기존 React HUD 컴포넌트, S39)
 * - ScreenFlashOverlay (DOM 기반 화면 플래시, S33)
 */

import React, { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameRefs, type GameRefs } from '@/lib/matrix/hooks/useGameRefs';
import { useGameLoop } from '@/lib/matrix/hooks/useGameLoop';
import { GameCamera } from './3d/GameCamera';
import { GameLighting } from './3d/GameLighting';
import { VoxelTerrain } from './3d/VoxelTerrain';
import { TerrainObjects } from './3d/TerrainObjects';
import { PickupRenderer } from './3d/PickupRenderer';
import { VoxelCharacter } from './3d/VoxelCharacter';
// Phase 5: Effects
import { PostProcessingEffects, ScreenFlashOverlay, useScreenFlash } from './3d/PostProcessing';
import { ParticleSystem } from './3d/ParticleSystem';
// Phase 6: UI & HUD
import { WorldUI } from './3d/WorldUI';
import { DamageNumbers } from './3d/DamageNumbers';
import { EntityUI } from './3d/EntityUI';
import { SafeZone3D } from './3d/SafeZone3D';

/**
 * MatrixSceneProps — Phase 0 최소 props
 * Phase 1+에서 전체 MatrixCanvasProps로 확장 예정
 */
export interface MatrixSceneProps {
  /** 게임 활성 상태 */
  gameActive: boolean;
  /** 외부에서 주입하는 GameRefs (MatrixApp에서 공유 시) */
  gameRefs?: GameRefs;
}

/**
 * GroundPlane — 기본 지면 (테스트 fallback)
 * Phase 1: VoxelTerrain이 주 지형이며, 이 컴포넌트는 fallback으로 유지
 */
function GroundPlane() {
  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#1a1a2e"
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * SceneContent — R3F Canvas 내부 3D 씬 콘텐츠
 * useFrame 등 R3F 훅은 Canvas 내부에서만 사용 가능
 */
function SceneContent({
  refs,
  warningIntensityRef,
}: {
  refs: GameRefs;
  warningIntensityRef: React.MutableRefObject<number>;
}) {
  return (
    <>
      {/* 배경색 */}
      <color attach="background" args={['#111111']} />

      {/* 카메라 — Isometric OrthographicCamera + LERP Follow + Zoom + Shake */}
      <GameCamera
        playerRef={refs.player}
        currentZoomRef={refs.currentZoom}
        screenShakeTimerRef={refs.screenShakeTimer}
        screenShakeIntensityRef={refs.screenShakeIntensity}
      />

      {/* 조명 — Ambient + Directional x2 + Shadows */}
      <GameLighting />

      {/* Phase 1: Chunked 3D 지형 (VoxelTerrain + biome + noise) */}
      <VoxelTerrain
        playerRef={refs.player}
        stageId={refs.currentStageId.current}
        gameMode="stage"
        seed={42}
      />

      {/* Phase 1: 지형 오브젝트 (InstancedMesh) */}
      <TerrainObjects
        playerRef={refs.player}
        stageId={refs.currentStageId.current}
        gameMode="stage"
        seed={42}
      />

      {/* Phase 1: Pickup 아이템 (XP Orb + Item Drop) */}
      <PickupRenderer
        gemsRef={refs.gems}
        pickupsRef={refs.pickups}
        playerRef={refs.player}
      />

      {/* Fallback 지면 (VoxelTerrain 로드 전 또는 극한 거리) */}
      <GroundPlane />

      {/* Phase 2: Voxel 캐릭터 (3-head chibi, S13-S18) */}
      <VoxelCharacter
        playerRef={refs.player}
        playerClass={refs.player.current.playerClass ?? 'neo'}
      />

      {/* Phase 5: 파티클 시스템 (S34) */}
      <ParticleSystem qualityTier="HIGH" />

      {/* Phase 6: 안전지대 3D (S38) */}
      <SafeZone3D
        playerRef={refs.player}
        warningIntensityRef={warningIntensityRef}
      />

      {/* Phase 6: World UI — 데미지 넘버 + HP바/네임태그 (S35, S36, S37) */}
      <WorldUI playerRef={refs.player}>
        <DamageNumbers
          damageNumbersRef={refs.damageNumbers}
          playerRef={refs.player}
        />
        <EntityUI
          playerRef={refs.player}
          enemiesRef={refs.enemies}
          qualityTier="HIGH"
        />
      </WorldUI>

      {/* Phase 5: 후처리 이펙트 — Bloom + Vignette (S33) */}
      <PostProcessingEffects
        qualityTier="HIGH"
        warningIntensityRef={warningIntensityRef}
      />
    </>
  );
}

/**
 * MatrixScene — R3F Canvas 래퍼 + useGameLoop 통합
 *
 * 2D/3D 듀얼 모드 지원:
 * - MatrixApp에서 renderMode='3d' 시 MatrixScene 마운트
 * - renderMode='2d' 시 기존 MatrixCanvas 마운트
 *
 * useFrame priority=0 필수 — non-zero priority는 R3F auto-render 비활성화
 */
export function MatrixScene({ gameActive, gameRefs }: MatrixSceneProps) {
  // 내부 refs (외부에서 주입되지 않은 경우 자체 refs 생성)
  const internalRefs = useGameRefs();
  const refs = gameRefs ?? internalRefs;

  // Phase 5: Screen Flash (DOM overlay)
  const { flashRef, trigger: triggerFlash, update: updateFlash } = useScreenFlash();

  // Phase 6: 위험 경고 강도 ref (SafeZone3D → PostProcessing 연동)
  const warningIntensityRef = useRef(0);

  // useGameLoop — Worker 기반 게임 로직 실행
  // 3D 모드에서는 render=null (R3F useFrame이 렌더링 담당)
  // Phase 0: update는 플레이어 위치만 시뮬레이션 (테스트용)
  const updateRef = useRef((_dt: number) => {});
  useMemo(() => {
    // 테스트용: 원 운동으로 플레이어 위치 시뮬레이션
    let time = 0;
    updateRef.current = (dt: number) => {
      time += dt;
      const player = refs.player.current;
      // 반경 30의 원 운동 (게임 로직 동작 확인용)
      player.position.x = Math.cos(time * 0.5) * 30;
      player.position.y = Math.sin(time * 0.5) * 30;
      player.velocity.x = -Math.sin(time * 0.5) * 15;
      player.velocity.y = Math.cos(time * 0.5) * 15;
      // Screen Flash 업데이트
      updateFlash(dt);
    };
  }, [refs.player, updateFlash]);

  useGameLoop({
    gameActive,
    update: (dt: number) => updateRef.current(dt),
    render: null, // 3D 모드: rAF 불필요 (R3F가 자체 렌더링)
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* R3F 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        orthographic
        camera={{
          zoom: 50,
          position: [800, 800, 800],
          near: 0.1,
          far: 5000,
        }}
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
        frameloop="always"
        shadows="soft"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#111111',
        }}
      >
        <SceneContent refs={refs} warningIntensityRef={warningIntensityRef} />
      </Canvas>

      {/* Phase 5: Screen Flash Overlay (S33) — DOM 기반 */}
      <ScreenFlashOverlay flashRef={flashRef} />

      {/* Phase 6: HUD Overlay (S39) — 기존 React HUD 컴포넌트 그대로 overlay */}
      {/* MatrixApp에서 HUD props를 전달받아 여기에 렌더링 */}
      {/* 현재는 슬롯만 준비 — 실제 HUD는 MatrixApp에서 조건부 렌더링 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
        className="matrix-scene-hud-overlay"
      >
        {/* 모바일 조이스틱 overlay 영역 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40%',
            pointerEvents: 'auto',
          }}
          className="matrix-scene-joystick-area"
        />
      </div>
    </div>
  );
}

export default MatrixScene;
