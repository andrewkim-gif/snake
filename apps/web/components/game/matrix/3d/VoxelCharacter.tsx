'use client';

/**
 * VoxelCharacter.tsx — MC 큐블링 스타일 인게임 캐릭터
 *
 * 로비 VoxelCharacter의 Canvas 텍스처 + 큐블링 프로포션을 재사용하되,
 * 인게임 전용 로직(playerRef 동기화, velocity facing, hit flash, terrain height,
 * idle/walk/hit/death 애니메이션)을 통합.
 *
 * 특징:
 * - 16x16 Canvas 픽셀아트 텍스처 (NearestFilter)
 * - 6-face head (얼굴/머리카락/귀)
 * - 큐블링 24u 프로포션 (1.5 world units)
 * - 어깨/엉덩이 피벗 회전 (geometry.translate)
 * - Hit flash (emissive pulse)
 * - Split rendering (upper/lower renderOrder)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, terrainH, -y)
 * useFrame priority=0 필수
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player, PlayerClass } from '@/lib/matrix/types';
import { getClassScale } from '@/lib/matrix/rendering3d/character-config';
import { getTerrainHeight } from '@/lib/matrix/rendering3d/terrain';
import { LOBBY_DIMENSIONS, LOBBY_OFFSETS } from '@/lib/3d/cubeling-proportions';

// ============================================
// 큐블링 프로포션 상수
// ============================================

const HEAD = LOBBY_DIMENSIONS.head;
const BODY = LOBBY_DIMENSIONS.body;
const ARM = LOBBY_DIMENSIONS.arm;
const LEG = LOBBY_DIMENSIONS.leg;

const LEG_TOP = LOBBY_OFFSETS.legTop;        // 0.4375
const BODY_CENTER = LOBBY_OFFSETS.bodyCenter; // 0.65625
const SHOULDER_Y = LOBBY_OFFSETS.shoulderY;   // 0.875
const HEAD_CENTER = LOBBY_OFFSETS.headCenter; // 1.1875

// ============================================
// 게임 상수
// ============================================

/** Hit flash 지속 시간 (초) */
const HIT_FLASH_DURATION = 0.15;
/** Hit flash emissive 색상 */
const HIT_FLASH_COLOR = new THREE.Color('#ff4444');
/** Hit flash emissive 강도 */
const HIT_FLASH_INTENSITY = 2.0;
/** 이동 속도 임계값 (이하면 idle) */
const MOVE_THRESHOLD = 0.5;
/** facing angle LERP 속도 */
const FACING_LERP = 0.15;

// ============================================
// RenderOrder 상수 (S18: Split Rendering)
// ============================================

export const RENDER_ORDER_LOWER = 1;
export const RENDER_ORDER_EFFECTS = 2;
export const RENDER_ORDER_UPPER = 3;

// ============================================
// 텍스처 생성 유틸 (Canvas 16x16 픽셀아트)
// ============================================

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

// ============================================
// 클래스별 MC 스타일 색상
// ============================================

interface McColors {
  skinTone: string;
  hairColor: string;
  topColor: string;
  bottomColor: string;
}

const CLASS_MC_COLORS: Record<string, McColors> = {
  neo:       { skinTone: '#D4A574', hairColor: '#1f2120', topColor: '#f8fafc', bottomColor: '#1e293b' },
  cipher:    { skinTone: '#D4A574', hairColor: '#4A3728', topColor: '#6366f1', bottomColor: '#312e81' },
  phantom:   { skinTone: '#C4956A', hairColor: '#2d1b0e', topColor: '#7c3aed', bottomColor: '#1e1b4b' },
  sentinel:  { skinTone: '#E8C4A0', hairColor: '#c4956a', topColor: '#0ea5e9', bottomColor: '#0c4a6e' },
  berserker: { skinTone: '#C4956A', hairColor: '#8b0000', topColor: '#dc2626', bottomColor: '#450a0a' },
  oracle:    { skinTone: '#F5E0C4', hairColor: '#ffd700', topColor: '#f59e0b', bottomColor: '#78350f' },
  architect: { skinTone: '#D4A574', hairColor: '#4A3728', topColor: '#10b981', bottomColor: '#064e3b' },
  virus:     { skinTone: '#A08060', hairColor: '#1a1a2e', topColor: '#84cc16', bottomColor: '#1a2e05' },
  glitch:    { skinTone: '#D4A574', hairColor: '#ff69b4', topColor: '#ec4899', bottomColor: '#500724' },
};

function getClassMcColors(playerClass: string): McColors {
  return CLASS_MC_COLORS[playerClass] ?? CLASS_MC_COLORS.neo;
}

// ============================================
// Head 6-Face 텍스처 생성
// ============================================

function createHeadMaterials(mc: McColors): THREE.MeshLambertMaterial[] {
  const { skinTone, hairColor } = mc;
  const darkHair = darkenHex(hairColor, 0.2);
  const darkSkin = darkenHex(skinTone, 0.1);

  // +Z: Front face (얼굴 — 눈/코/입 + 머리카락)
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

  // -Z: Back (뒷머리)
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

  // +Y: Top (정수리)
  const [tC, tX] = createCanvas();
  tX.fillStyle = hairColor;
  tX.fillRect(0, 0, 16, 16);
  tX.fillStyle = darkHair;
  tX.fillRect(7, 0, 2, 16);

  // -Y: Bottom (턱)
  const [btC, btX] = createCanvas();
  btX.fillStyle = darkenHex(skinTone, 0.1);
  btX.fillRect(0, 0, 16, 16);

  // ±X: Side (옆머리 + 귀)
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
  return [
    new THREE.MeshLambertMaterial({ map: sideTex }),            // [0] +X right
    new THREE.MeshLambertMaterial({ map: sideTex }),            // [1] -X left
    new THREE.MeshLambertMaterial({ map: toCanvasTex(tC) }),    // [2] +Y top
    new THREE.MeshLambertMaterial({ map: toCanvasTex(btC) }),   // [3] -Y bottom
    new THREE.MeshLambertMaterial({ map: toCanvasTex(fC) }),    // [4] +Z front
    new THREE.MeshLambertMaterial({ map: toCanvasTex(bC) }),    // [5] -Z back
  ];
}

// ============================================
// Body/Arm/Leg 텍스처 생성
// ============================================

function createBodyTextures(mc: McColors) {
  const { skinTone, topColor, bottomColor } = mc;
  const darkTop = darkenHex(topColor, 0.25);
  const darkBottom = darkenHex(bottomColor, 0.25);

  // Body: 상의 + 벨트
  const [bC, bCtx] = createCanvas();
  bCtx.fillStyle = topColor;
  bCtx.fillRect(0, 0, 16, 16);
  bCtx.fillStyle = darkTop;
  for (let x = 0; x < 16; x++) {
    bCtx.fillRect(x, 0, 1, 1);
    bCtx.fillRect(x, 15, 1, 1);
  }
  for (let y = 0; y < 16; y++) {
    bCtx.fillRect(0, y, 1, 1);
    bCtx.fillRect(15, y, 1, 1);
  }
  bCtx.fillStyle = darkBottom;
  bCtx.fillRect(1, 13, 14, 2);

  // Arm: 소매 + 피부
  const [aC, aCtx] = createCanvas();
  aCtx.fillStyle = topColor;
  aCtx.fillRect(0, 0, 16, 10);
  aCtx.fillStyle = skinTone;
  aCtx.fillRect(0, 10, 16, 6);
  aCtx.fillStyle = darkTop;
  for (let y = 0; y < 16; y++) {
    aCtx.fillRect(0, y, 1, 1);
    aCtx.fillRect(15, y, 1, 1);
  }

  // Leg: 바지 + 신발
  const [lC, lCtx] = createCanvas();
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
    body: toCanvasTex(bC),
    arm: toCanvasTex(aC),
    leg: toCanvasTex(lC),
  };
}

// ============================================
// Props
// ============================================

export interface VoxelCharacterProps {
  playerRef: React.MutableRefObject<Player>;
  playerClass?: PlayerClass;
  visible?: boolean;
}

// ============================================
// VoxelCharacter Component
// ============================================

export function VoxelCharacter({
  playerRef,
  playerClass = 'neo',
  visible = true,
}: VoxelCharacterProps) {
  // Refs
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null!);
  const bodyRef = useRef<THREE.Mesh>(null!);
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);
  const leftLegRef = useRef<THREE.Mesh>(null!);
  const rightLegRef = useRef<THREE.Mesh>(null!);

  // 상태 추적
  const currentFacingRef = useRef(0);
  const prevHitFlashRef = useRef(0);
  const hitFlashTimerRef = useRef(0);
  // 애니메이션 상태: 'idle' | 'walk' | 'hit' | 'death'
  const animStateRef = useRef<'idle' | 'walk' | 'hit' | 'death'>('idle');
  const hitAnimTimerRef = useRef(0);
  const deathAnimTimerRef = useRef(0);

  // MC 색상 기반 텍스처 생성
  const mc = getClassMcColors(playerClass);
  const texKey = `${playerClass}`;

  const headMats = useMemo(() => createHeadMaterials(mc), [texKey]);
  const textures = useMemo(() => createBodyTextures(mc), [texKey]);

  // 피벗 조정 지오메트리 (어깨/엉덩이 기준 회전)
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

  // 머티리얼
  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.body }), [textures]);
  const armMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.arm }), [textures]);
  const legMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.leg }), [textures]);

  // 모든 머티리얼 배열 (hit flash용)
  const allMatsRef = useRef<THREE.MeshLambertMaterial[]>([]);

  // ============================================
  // useFrame — 매 프레임 업데이트 (priority=0 필수)
  // ============================================

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const player = playerRef.current;

    // --- 1. Position 동기화 ---
    const px = player.position.x;
    const pz = -player.position.y;
    groupRef.current.position.x = px;
    groupRef.current.position.y = getTerrainHeight(px, pz);
    groupRef.current.position.z = pz;

    // --- 2. 클래스 스케일 ---
    const scale = getClassScale(playerClass);
    groupRef.current.scale.setScalar(scale);

    // --- 3. 8방향 Facing ---
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > MOVE_THRESHOLD) {
      const targetAngle = Math.atan2(vx, -vy);
      let diff = targetAngle - currentFacingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      currentFacingRef.current += diff * FACING_LERP;
      groupRef.current.rotation.y = currentFacingRef.current;
    }

    // --- 4. 애니메이션 상태 결정 ---
    const isAlive = player.health > 0;
    const isNewHit = player.hitFlashTimer > 0 && prevHitFlashRef.current <= 0;
    prevHitFlashRef.current = player.hitFlashTimer;

    if (!isAlive) {
      if (animStateRef.current !== 'death') {
        animStateRef.current = 'death';
        deathAnimTimerRef.current = 0;
      }
    } else if (isNewHit) {
      animStateRef.current = 'hit';
      hitAnimTimerRef.current = 0;
      hitFlashTimerRef.current = HIT_FLASH_DURATION;
    } else if (animStateRef.current === 'hit') {
      hitAnimTimerRef.current += delta;
      if (hitAnimTimerRef.current > 0.3) {
        animStateRef.current = speed > MOVE_THRESHOLD ? 'walk' : 'idle';
      }
    } else if (animStateRef.current !== 'death') {
      animStateRef.current = speed > MOVE_THRESHOLD ? 'walk' : 'idle';
    }

    // --- 5. 애니메이션 적용 (sin-based, 로비 스타일) ---
    const t = state.clock.elapsedTime;
    let armL = 0, armR = 0, legL = 0, legR = 0;
    let headY = HEAD_CENTER, headRotY = 0, headRotX = 0;
    let bodyY = BODY_CENTER, bodyRotX = 0;
    let groupY = groupRef.current.position.y;

    switch (animStateRef.current) {
      case 'idle': {
        armL = Math.sin(t * 1.5) * 0.25;
        armR = -armL;
        legL = -Math.sin(t * 1.5) * 0.18;
        legR = -legL;
        headRotY = Math.sin(t * 0.5) * 0.15;
        headY = HEAD_CENTER + Math.sin(t * 0.8) * 0.02;
        break;
      }
      case 'walk': {
        const freq = 3.0;
        const swing = 0.5;
        armL = Math.sin(t * freq) * swing;
        armR = -armL;
        legL = -Math.sin(t * freq) * swing * 0.8;
        legR = -legL;
        groupY += Math.abs(Math.cos(t * freq)) * 0.03;
        headRotX = -0.05;
        break;
      }
      case 'hit': {
        const p = Math.min(hitAnimTimerRef.current / 0.3, 1);
        const decay = Math.exp(-p * 6);
        bodyRotX = -0.3 * decay;
        armL = -0.5 * decay;
        armR = -0.5 * decay;
        headRotX = 0.2 * decay;
        break;
      }
      case 'death': {
        deathAnimTimerRef.current += delta;
        const p = Math.min(deathAnimTimerRef.current / 0.8, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        bodyRotX = (Math.PI / 2) * eased;
        bodyY = BODY_CENTER - 0.6 * eased;
        headY = HEAD_CENTER - 0.7 * eased;
        headRotX = (Math.PI / 2) * eased;
        armL = (Math.PI / 2) * eased;
        armR = (Math.PI / 2) * eased;
        break;
      }
    }

    // 트랜스폼 적용
    if (headRef.current) {
      headRef.current.rotation.y = headRotY;
      headRef.current.rotation.x = headRotX;
      headRef.current.position.y = headY;
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.x = bodyRotX;
      bodyRef.current.position.y = bodyY;
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = armL;
    if (rightArmRef.current) rightArmRef.current.rotation.x = armR;
    if (leftLegRef.current) leftLegRef.current.rotation.x = legL;
    if (rightLegRef.current) rightLegRef.current.rotation.x = legR;
    groupRef.current.position.y = groupY;

    // --- 6. Hit Flash Effect ---
    // allMats 수집 (한 번만)
    if (allMatsRef.current.length === 0) {
      const mats: THREE.MeshLambertMaterial[] = [];
      if (bodyMat) mats.push(bodyMat);
      if (armMat) mats.push(armMat);
      if (legMat) mats.push(legMat);
      // head는 배열이므로 별도 처리
      if (headMats) {
        for (const m of headMats) mats.push(m);
      }
      allMatsRef.current = mats;
    }

    if (hitFlashTimerRef.current > 0) {
      hitFlashTimerRef.current -= delta;
      const flashT = Math.max(0, hitFlashTimerRef.current / HIT_FLASH_DURATION);
      for (const mat of allMatsRef.current) {
        mat.emissive.copy(HIT_FLASH_COLOR);
        mat.emissiveIntensity = flashT * HIT_FLASH_INTENSITY;
      }
    } else {
      for (const mat of allMatsRef.current) {
        if (mat.emissiveIntensity > 0) {
          mat.emissiveIntensity = 0;
          mat.emissive.setScalar(0);
        }
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, BODY_CENTER, 0]} material={bodyMat} renderOrder={RENDER_ORDER_UPPER}>
        <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
      </mesh>

      {/* Head — 6-face materials (front=+Z=index4) */}
      <mesh ref={headRef} position={[0, HEAD_CENTER, 0]} material={headMats} renderOrder={RENDER_ORDER_UPPER}>
        <boxGeometry args={[HEAD.w, HEAD.h, HEAD.d]} />
      </mesh>

      {/* Left Arm — 어깨 피벗 */}
      <mesh
        ref={leftArmRef}
        position={[-(BODY.w / 2 + ARM.w / 2), SHOULDER_Y, 0]}
        geometry={armGeo}
        material={armMat}
        renderOrder={RENDER_ORDER_UPPER}
      />

      {/* Right Arm — 어깨 피벗 */}
      <mesh
        ref={rightArmRef}
        position={[BODY.w / 2 + ARM.w / 2, SHOULDER_Y, 0]}
        geometry={armGeo}
        material={armMat}
        renderOrder={RENDER_ORDER_UPPER}
      />

      {/* Left Leg — 엉덩이 피벗 */}
      <mesh
        ref={leftLegRef}
        position={[-LEG.w / 2, LEG_TOP, 0]}
        geometry={legGeo}
        material={legMat}
        renderOrder={RENDER_ORDER_LOWER}
      />

      {/* Right Leg — 엉덩이 피벗 */}
      <mesh
        ref={rightLegRef}
        position={[LEG.w / 2, LEG_TOP, 0]}
        geometry={legGeo}
        material={legMat}
        renderOrder={RENDER_ORDER_LOWER}
      />
    </group>
  );
}

export default VoxelCharacter;
