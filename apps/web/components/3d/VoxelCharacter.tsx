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
import { VIVID_PALETTE, SKIN_TONES, HAIR_COLORS, HAT_DEFS, WEAPON_DEFS, BACK_ITEM_DEFS } from '@agent-survivor/shared';
import { getAgentTextures, getHeadMaterials } from '@/lib/3d/agent-textures';
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
 * 6-face head materials (얼굴은 +X 면에만 표시)
 * BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
 * +X = front (face), -X = back (hair), +Y = top (hair), -Y = chin, ±Z = sides
 */
function createAppearanceHeadMaterials(a: CubelingAppearance): THREE.MeshLambertMaterial[] {
  const skinTone = SKIN_TONES[a.skinTone] ?? '#D4A574';
  const hairColor = HAIR_COLORS[a.hairColor] ?? '#4A3728';
  const darkHair = darkenHex(hairColor, 0.2);
  const darkSkin = darkenHex(skinTone, 0.1);

  // +X: Front face (얼굴 — 눈/코/입 + 머리카락 상단)
  const [fC, fX] = createCanvas();
  fX.fillStyle = skinTone;
  fX.fillRect(0, 0, 16, 16);
  fX.fillStyle = hairColor;
  fX.fillRect(0, 0, 16, 4);
  fX.fillStyle = darkHair;
  fX.fillRect(0, 4, 2, 4);
  fX.fillRect(14, 4, 2, 4);
  // 눈
  fX.fillStyle = '#FFFFFF';
  fX.fillRect(4, 5, 3, 3);
  fX.fillRect(9, 5, 3, 3);
  fX.fillStyle = '#3A3028';
  fX.fillRect(5, 6, 1, 1);
  fX.fillRect(10, 6, 1, 1);
  // 코
  fX.fillStyle = darkSkin;
  fX.fillRect(7, 9, 2, 1);
  // 입
  fX.fillStyle = darkenHex(skinTone, 0.2);
  fX.fillRect(6, 11, 4, 1);

  // -X: Back face (뒷머리 — 머리카락 + 목)
  const [bC, bX] = createCanvas();
  bX.fillStyle = hairColor;
  bX.fillRect(0, 0, 16, 16);
  bX.fillStyle = skinTone;
  bX.fillRect(3, 13, 10, 3);
  bX.fillStyle = darkHair;
  for (let y = 0; y < 16; y++) {
    bX.fillRect(0, y, 1, 1);
    bX.fillRect(15, y, 1, 1);
  }

  // +Y: Top (정수리 — 머리카락)
  const [tC, tX] = createCanvas();
  tX.fillStyle = hairColor;
  tX.fillRect(0, 0, 16, 16);
  tX.fillStyle = darkHair;
  tX.fillRect(7, 0, 2, 16);

  // -Y: Bottom (턱)
  const [btC, btX] = createCanvas();
  btX.fillStyle = darkenHex(skinTone, 0.1);
  btX.fillRect(0, 0, 16, 16);

  // ±Z: Side faces (옆머리 — 피부 + 머리카락 + 귀)
  const [sC, sX] = createCanvas();
  sX.fillStyle = skinTone;
  sX.fillRect(0, 0, 16, 16);
  sX.fillStyle = hairColor;
  sX.fillRect(0, 0, 16, 5);
  sX.fillStyle = darkHair;
  sX.fillRect(0, 5, 3, 3);
  sX.fillRect(13, 5, 3, 3);
  sX.fillStyle = darkSkin;
  sX.fillRect(7, 7, 2, 2);

  const sideTex = toCanvasTex(sC);
  // BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
  // Head dims: w=0.625(X) h=0.625(Y) d=0.5(Z) → +Z face is 0.625×0.625 (widest, visual "front")
  return [
    new THREE.MeshLambertMaterial({ map: sideTex }),            // +X side (narrow)
    new THREE.MeshLambertMaterial({ map: sideTex }),            // -X side (narrow)
    new THREE.MeshLambertMaterial({ map: toCanvasTex(tC) }),    // +Y top (hair)
    new THREE.MeshLambertMaterial({ map: toCanvasTex(btC) }),   // -Y bottom (chin)
    new THREE.MeshLambertMaterial({ map: toCanvasTex(fC) }),    // +Z front (face) ← 정면
    new THREE.MeshLambertMaterial({ map: toCanvasTex(bC) }),    // -Z back (hair)
  ];
}

/**
 * appearance 기반 텍스처 세트 생성 (body/arm/leg만)
 * head는 createAppearanceHeadMaterials에서 6-face로 생성
 */
function createAppearanceTextures(a: CubelingAppearance) {
  const topColor = VIVID_PALETTE[a.topColor] ?? '#4488FF';
  const bottomColor = VIVID_PALETTE[a.bottomColor] ?? '#333333';
  const skinTone = SKIN_TONES[a.skinTone] ?? '#D4A574';
  const darkTop = darkenHex(topColor, 0.25);
  const lightTop = lightenHex(topColor, 0.2);
  const darkBottom = darkenHex(bottomColor, 0.25);

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
  return `${a.topColor}-${a.bottomColor}-${a.skinTone}-${a.pattern}-${a.hairColor}`;
}

// ─── 게임유닛 → 월드유닛 변환 (16gu = 1wu) ───
const GU = 1 / 16;

// ─── 장비 그룹 (로비 프리뷰) ───

function EquipmentGroup({ appearance: a }: { appearance: CubelingAppearance }) {
  const hatDef = a.hat > 0 ? HAT_DEFS.find(h => h.id === a.hat) : null;
  const weaponDef = a.weapon > 0 ? WEAPON_DEFS.find(w => w.id === a.weapon) : null;
  const backDef = a.backItem > 0 ? BACK_ITEM_DEFS.find(b => b.id === a.backItem) : null;

  // 머리 상단 Y (월드유닛)
  const headTopY = HEAD_CENTER + HEAD.h / 2;
  // 어깨+팔 끝 (월드유닛)
  const handY = SHOULDER_Y - ARM.h;

  return (
    <>
      {/* 모자: 머리 위에 배치 */}
      {hatDef && (() => {
        const geo = EQUIPMENT_SIZES[hatDef.geometryType];
        if (!geo) return null;
        return (
          <mesh position={[0, headTopY + geo[1] / 2, 0]}>
            <boxGeometry args={geo} />
            <meshLambertMaterial color={hatDef.baseColor} />
          </mesh>
        );
      })()}

      {/* 무기: 오른손에 배치 */}
      {weaponDef && (() => {
        const geo = EQUIPMENT_SIZES[weaponDef.geometryType];
        if (!geo) return null;
        return (
          <mesh position={[BODY.w / 2 + ARM.w / 2, handY - geo[1] * 0.3, ARM.d / 2 + 0.05]}>
            <boxGeometry args={geo} />
            <meshLambertMaterial color={weaponDef.baseColor} />
          </mesh>
        );
      })()}

      {/* 등 아이템: 몸통 뒤에 배치 */}
      {backDef && (() => {
        const geo = EQUIPMENT_SIZES[backDef.geometryType];
        if (!geo) return null;
        return (
          <mesh position={[0, BODY_CENTER, -(BODY.d / 2 + geo[2] / 2)]}>
            <boxGeometry args={geo} />
            <meshLambertMaterial color={backDef.baseColor} />
          </mesh>
        );
      })()}
    </>
  );
}

/** 장비 타입별 월드유닛 [W, H, D] */
const EQUIPMENT_SIZES: Record<string, [number, number, number]> = {
  helmet: [11 * GU, 6 * GU, 9 * GU],
  hat:    [12 * GU, 4 * GU, 12 * GU],
  crown:  [10 * GU, 3 * GU, 10 * GU],
  blade:  [2 * GU, 14 * GU, 1 * GU],
  staff:  [1 * GU, 14 * GU, 1 * GU],
  cape:   [6 * GU, 8 * GU, 0.5 * GU],
  wings:  [14 * GU, 8 * GU, 0.5 * GU],
  pack:   [4 * GU, 5 * GU, 3 * GU],
};

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

  // Head: 6-face materials (얼굴은 +X 면에만)
  const headMats = useMemo(() => {
    if (appearance) return createAppearanceHeadMaterials(appearance);
    return getHeadMaterials(skinId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texKey]);

  // 재질
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

      {/* Head -- 큐블링: 큰 머리(42%), 6-face materials (얼굴은 +X면) */}
      <mesh ref={headRef} position={[0, HEAD_CENTER, 0]} material={headMats}>
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

      {/* Equipment (appearance가 있을 때만) */}
      {appearance && <EquipmentGroup appearance={appearance} />}
    </group>
  );
}
