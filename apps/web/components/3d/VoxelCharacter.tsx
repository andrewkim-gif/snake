'use client';

/**
 * VoxelCharacter -- 큐블링(Cubeling) 스타일 6파트 휴머노이드 (로비 프리뷰)
 *
 * Phase 1 변경사항:
 * - MC 32u 프로포션 -> 큐블링 24u 프로포션
 * - HEAD 0.5->0.625, BODY 0.5x0.75->0.5x0.4375, ARM/LEG 0.75->0.4375
 * - 총 높이: 2.0 -> 1.5 world units
 * - cubeling-proportions.ts의 LOBBY_DIMENSIONS/LOBBY_OFFSETS 사용
 *
 * Phase 7 추가:
 * - appearance?: CubelingAppearance prop -- 있으면 appearance 기반 렌더링
 * - appearance 기반: VIVID_PALETTE/SKIN_TONES 색상 매핑 + 패턴 텍스처
 *
 * idle 애니메이션: 팔/다리 pendulum + 머리 bob/look
 * useFrame priority=0 (auto-render 유지 필수)
 * arm/leg pivot: geometry.translate(0, -halfHeight, 0)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CubelingAppearance } from '@agent-survivor/shared';
import { VIVID_PALETTE, SKIN_TONES } from '@agent-survivor/shared';
import { getAgentTextures } from '@/lib/3d/agent-textures';
import { LOBBY_DIMENSIONS, LOBBY_OFFSETS } from '@/lib/3d/cubeling-proportions';

interface VoxelCharacterProps {
  skinId: number;
  appearance?: CubelingAppearance;
  position: [number, number, number];
  rotation?: number;
  phaseOffset?: number;
}

// 큐블링 로비 치수 (cubeling-proportions에서 가져옴)
const HEAD = LOBBY_DIMENSIONS.head;
const BODY = LOBBY_DIMENSIONS.body;
const ARM = LOBBY_DIMENSIONS.arm;
const LEG = LOBBY_DIMENSIONS.leg;

// 발바닥 기준 Y 오프셋 (큐블링 24u -> 1.5 world units)
const LEG_TOP = LOBBY_OFFSETS.legTop;           // 0.4375
const BODY_CENTER = LOBBY_OFFSETS.bodyCenter;    // 0.65625
const SHOULDER_Y = LOBBY_OFFSETS.shoulderY;      // 0.875
const HEAD_CENTER = LOBBY_OFFSETS.headCenter;    // 1.1875

// ─── 텍스처 생성 유틸 (appearance 기반) ───

const TEX_SIZE = 16;

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function toCanvasTex(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = parseInt(hex.slice(1), 16);
  return [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return `#${((dr << 16) | (dg << 8) | db).toString(16).padStart(6, '0')}`;
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0')}`;
}

/**
 * appearance 기반 텍스처 세트 생성
 * 간단한 색상 매핑으로 프리뷰 목적에 충분한 품질
 */
function createAppearanceTextures(a: CubelingAppearance) {
  const topColor = VIVID_PALETTE[a.topColor] ?? '#4488FF';
  const bottomColor = VIVID_PALETTE[a.bottomColor] ?? '#333333';
  const skinTone = SKIN_TONES[a.skinTone] ?? '#D4A574';
  const darkTop = darkenHex(topColor, 0.25);
  const lightTop = lightenHex(topColor, 0.2);
  const darkBottom = darkenHex(bottomColor, 0.25);

  // Head 텍스처 (얼굴)
  const [hCanvas, hCtx] = createCanvas();
  hCtx.fillStyle = skinTone;
  hCtx.fillRect(0, 0, 16, 16);
  // 머리카락 상단
  hCtx.fillStyle = topColor;
  hCtx.fillRect(0, 0, 16, 4);
  hCtx.fillStyle = darkTop;
  hCtx.fillRect(0, 4, 2, 4);
  hCtx.fillRect(14, 4, 2, 4);
  // 눈 (간단 기본)
  hCtx.fillStyle = '#FFFFFF';
  hCtx.fillRect(4, 5, 3, 3);
  hCtx.fillRect(9, 5, 3, 3);
  hCtx.fillStyle = '#3A3028';
  hCtx.fillRect(5, 6, 1, 1);
  hCtx.fillRect(10, 6, 1, 1);
  // 코
  hCtx.fillStyle = darkenHex(skinTone, 0.1);
  hCtx.fillRect(7, 9, 2, 1);
  // 입
  hCtx.fillStyle = darkenHex(skinTone, 0.2);
  hCtx.fillRect(6, 11, 4, 1);

  // Body 텍스처
  const [bCanvas, bCtx] = createCanvas();
  bCtx.fillStyle = topColor;
  bCtx.fillRect(0, 0, 16, 16);
  // 패턴 적용
  if (a.pattern === 1) { // striped
    for (let y = 0; y < 16; y++) {
      if (y % 4 < 2) {
        bCtx.fillStyle = bottomColor;
        bCtx.fillRect(1, y, 14, 1);
      }
    }
  } else if (a.pattern === 2) { // dotted
    bCtx.fillStyle = lightTop;
    for (let y = 1; y < 15; y += 3) {
      for (let x = 1; x < 15; x += 3) {
        bCtx.fillRect(x, y, 2, 2);
      }
    }
  } else if (a.pattern === 4) { // checker
    for (let y = 0; y < 16; y += 2) {
      for (let x = 0; x < 16; x += 2) {
        if ((x + y) % 4 === 0) {
          bCtx.fillStyle = bottomColor;
          bCtx.fillRect(x, y, 2, 2);
        }
      }
    }
  }
  // 외곽
  bCtx.fillStyle = darkTop;
  for (let x = 0; x < 16; x++) {
    bCtx.fillRect(x, 0, 1, 1);
    bCtx.fillRect(x, 15, 1, 1);
  }
  for (let y = 0; y < 16; y++) {
    bCtx.fillRect(0, y, 1, 1);
    bCtx.fillRect(15, y, 1, 1);
  }
  // 벨트
  bCtx.fillStyle = darkBottom;
  bCtx.fillRect(1, 13, 14, 2);

  // Arm 텍스처
  const [aCanvas, aCtx] = createCanvas();
  aCtx.fillStyle = topColor;
  aCtx.fillRect(0, 0, 16, 10);
  aCtx.fillStyle = skinTone;
  aCtx.fillRect(0, 10, 16, 6);
  aCtx.fillStyle = darkTop;
  for (let y = 0; y < 16; y++) {
    aCtx.fillRect(0, y, 1, 1);
    aCtx.fillRect(15, y, 1, 1);
  }

  // Leg 텍스처
  const [lCanvas, lCtx] = createCanvas();
  lCtx.fillStyle = bottomColor;
  lCtx.fillRect(0, 0, 16, 12);
  lCtx.fillStyle = darkenHex(bottomColor, 0.4);
  lCtx.fillRect(0, 12, 16, 4);
  lCtx.fillStyle = darkBottom;
  for (let y = 0; y < 16; y++) {
    lCtx.fillRect(0, y, 1, 1);
    lCtx.fillRect(15, y, 1, 1);
  }

  return {
    head: toCanvasTex(hCanvas),
    body: toCanvasTex(bCanvas),
    arm: toCanvasTex(aCanvas),
    leg: toCanvasTex(lCanvas),
  };
}

/**
 * appearance를 키 문자열로 변환 (useMemo 의존성 용)
 * topColor, bottomColor, skinTone, pattern만으로 텍스처 결정
 */
function appearanceTexKey(a: CubelingAppearance): string {
  return `${a.topColor}-${a.bottomColor}-${a.skinTone}-${a.pattern}`;
}

export function VoxelCharacter({ skinId, appearance, position, rotation = 0, phaseOffset = 0 }: VoxelCharacterProps) {
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);
  const leftLegRef = useRef<THREE.Mesh>(null!);
  const rightLegRef = useRef<THREE.Mesh>(null!);
  const headRef = useRef<THREE.Mesh>(null!);

  // appearance가 있으면 appearance 기반 텍스처, 없으면 레거시 skinId 기반
  const texKey = appearance ? appearanceTexKey(appearance) : `legacy-${skinId}`;
  const textures = useMemo(() => {
    if (appearance) {
      return createAppearanceTextures(appearance);
    }
    return getAgentTextures(skinId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texKey]);

  // 피벗 조정된 지오메트리 (어깨/엉덩이 기준 회전)
  const armGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(ARM.w, ARM.h, ARM.d);
    geo.translate(0, -ARM.h / 2, 0);
    return geo;
  }, []);

  const legGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(LEG.w, LEG.h, LEG.d);
    geo.translate(0, -LEG.h / 2, 0);
    return geo;
  }, []);

  // 재질
  const headMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.head }), [textures]);
  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.body }), [textures]);
  const armMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.arm }), [textures]);
  const legMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.leg }), [textures]);

  // idle 애니메이션 (priority=0)
  useFrame((state) => {
    const t = state.clock.elapsedTime + phaseOffset;

    // 팔 pendulum swing (큐블링 짧은 팔 -> 진폭 유지)
    const armSwing = Math.sin(t * 1.5) * 0.25;
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSwing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -armSwing;

    // 다리 pendulum swing (반대)
    const legSwing = Math.sin(t * 1.5) * 0.18;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -legSwing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = legSwing;

    // 머리 bob + 좌우 look
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.2;
      headRef.current.position.y = HEAD_CENTER + Math.sin(t * 0.8) * 0.02;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh position={[0, BODY_CENTER, 0]} material={bodyMat}>
        <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
      </mesh>

      {/* Head -- 큐블링: 큰 머리(42%) */}
      <mesh ref={headRef} position={[0, HEAD_CENTER, 0]} material={headMat}>
        <boxGeometry args={[HEAD.w, HEAD.h, HEAD.d]} />
      </mesh>

      {/* Left Arm -- 어깨 피벗 */}
      <mesh
        ref={leftArmRef}
        position={[-(BODY.w / 2 + ARM.w / 2), SHOULDER_Y, 0]}
        geometry={armGeo}
        material={armMat}
      />

      {/* Right Arm -- 어깨 피벗 */}
      <mesh
        ref={rightArmRef}
        position={[BODY.w / 2 + ARM.w / 2, SHOULDER_Y, 0]}
        geometry={armGeo}
        material={armMat}
      />

      {/* Left Leg -- 엉덩이 피벗 */}
      <mesh
        ref={leftLegRef}
        position={[-LEG.w / 2, LEG_TOP, 0]}
        geometry={legGeo}
        material={legMat}
      />

      {/* Right Leg -- 엉덩이 피벗 */}
      <mesh
        ref={rightLegRef}
        position={[LEG.w / 2, LEG_TOP, 0]}
        geometry={legGeo}
        material={legMat}
      />
    </group>
  );
}
