'use client';

/**
 * LandmarkSprites — Far LOD 빌보드 스프라이트 레이어 (v20 Phase 2)
 *
 * 구현:
 *   - InstancedMesh + PlaneGeometry 빌보드
 *   - CanvasTexture 아틀라스: 8x6 그리드 (42개 랜드마크 실루엣 아이콘)
 *   - 커스텀 셰이더: per-instance UV offset으로 아틀라스 슬롯 참조
 *   - Backface culling: dot(normal, camDir) < 0.05 -> hide, 0.05~0.35 fade
 *   - Tier 기반 가시성: Far LOD에서 Tier 1만 15개 표시
 *   - renderOrder = 98 (GlobeCountryLabels=100 아래)
 *   - GC 방지: 모듈 스코프 temp 객체 사전 할당
 *
 * 최적화: GPU 1 드로콜, ~30 삼각형 (15 스프라이트 x 2 tri)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { LANDMARKS, LandmarkTier } from '@/lib/landmark-data';
import type { Landmark } from '@/lib/landmark-data';

// ─── Constants ───

/** 최대 스프라이트 수 (Tier 1 = 15, 여유 버퍼 포함) */
const MAX_SPRITES = 50;

/** 스프라이트 월드 크기 */
const SPRITE_SIZE = 4.0;

/** 구체 표면 위 오프셋 */
const SURFACE_ALT = 2.0;

/** 뒷면 오클루전 임계값 (GlobeConflictIndicators와 동일) */
const BACKFACE_THRESHOLD = 0.05;
/** dot product 페이드 범위 (0.05 ~ 0.35) */
const BACKFACE_FADE_RANGE = 0.3;

/** 아틀라스 그리드: 8열 x 6행 = 48 슬롯 (42개 사용) */
const ATLAS_COLS = 8;
const ATLAS_ROWS = 6;
/** 아틀라스 전체 크기 */
const ATLAS_SIZE = 1024;
/** 슬롯 크기 */
const SLOT_W = ATLAS_SIZE / ATLAS_COLS; // 128
const SLOT_H = ATLAS_SIZE / ATLAS_ROWS; // ~170.67

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _normal = new THREE.Vector3();

// ─── Types ───

export interface LandmarkSpritesProps {
  /** 표시할 랜드마크 목록 (GlobeLandmarks에서 필터링하여 전달) */
  landmarks: Landmark[];
  /** 지구 반경 (기본 100) */
  globeRadius?: number;
  /** 최대 표시 수 (useGlobeLOD에서 제어) */
  maxSprites?: number;
}

// ─── Sprite Atlas Icon Drawers ───
// 각 Archetype에 대한 간단한 실루엣 아이콘 그리기 함수

/** PLACEHOLDER — 아이콘 그리기 유틸 */
function drawLandmarkIcon(
  ctx: CanvasRenderingContext2D,
  landmark: Landmark,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pad = 8;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const ix = x + pad;
  const iy = y + pad;

  ctx.fillStyle = '#E8E0D4';
  ctx.strokeStyle = '#E8E0D4';
  ctx.lineWidth = 2;

  const arch = landmark.archetype;

  switch (arch) {
    case 'TOWER':
    case 'CLOCK_TOWER':
    case 'MINARET': {
      // 삼각형 타워 실루엣
      ctx.beginPath();
      ctx.moveTo(cx - iw * 0.3, iy + ih);
      ctx.lineTo(cx, iy);
      ctx.lineTo(cx + iw * 0.3, iy + ih);
      ctx.closePath();
      ctx.fill();
      // 수평 라인 장식
      ctx.beginPath();
      ctx.moveTo(cx - iw * 0.2, iy + ih * 0.4);
      ctx.lineTo(cx + iw * 0.2, iy + ih * 0.4);
      ctx.moveTo(cx - iw * 0.25, iy + ih * 0.7);
      ctx.lineTo(cx + iw * 0.25, iy + ih * 0.7);
      ctx.stroke();
      break;
    }
    case 'PYRAMID': {
      // 피라미드 삼각형
      ctx.beginPath();
      ctx.moveTo(cx - iw * 0.45, iy + ih);
      ctx.lineTo(cx, iy + ih * 0.1);
      ctx.lineTo(cx + iw * 0.45, iy + ih);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'MOSQUE': {
      // 돔 (반원 + 직사각형 베이스)
      ctx.beginPath();
      ctx.arc(cx, iy + ih * 0.55, iw * 0.35, Math.PI, 0);
      ctx.lineTo(cx + iw * 0.35, iy + ih);
      ctx.lineTo(cx - iw * 0.35, iy + ih);
      ctx.closePath();
      ctx.fill();
      // 미나렛 (작은 수직 바)
      ctx.fillRect(cx - iw * 0.45, iy + ih * 0.3, iw * 0.06, ih * 0.7);
      ctx.fillRect(cx + iw * 0.39, iy + ih * 0.3, iw * 0.06, ih * 0.7);
      break;
    }
    case 'NEEDLE': {
      // 가느다란 니들
      ctx.fillRect(cx - iw * 0.04, iy, iw * 0.08, ih);
      // 관측대 원
      ctx.beginPath();
      ctx.arc(cx, iy + ih * 0.35, iw * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'STATUE': {
      // 받침대 + 십자형 상체
      ctx.fillRect(cx - iw * 0.2, iy + ih * 0.6, iw * 0.4, ih * 0.4);
      // 몸체
      ctx.fillRect(cx - iw * 0.06, iy + ih * 0.15, iw * 0.12, ih * 0.45);
      // 팔
      ctx.fillRect(cx - iw * 0.3, iy + ih * 0.2, iw * 0.6, iw * 0.08);
      // 머리
      ctx.beginPath();
      ctx.arc(cx, iy + ih * 0.12, iw * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'WALL': {
      // 지그재그 성벽
      ctx.beginPath();
      ctx.moveTo(ix, iy + ih * 0.7);
      ctx.lineTo(ix + iw * 0.2, iy + ih * 0.4);
      ctx.lineTo(ix + iw * 0.4, iy + ih * 0.6);
      ctx.lineTo(ix + iw * 0.6, iy + ih * 0.3);
      ctx.lineTo(ix + iw * 0.8, iy + ih * 0.5);
      ctx.lineTo(ix + iw, iy + ih * 0.2);
      ctx.lineTo(ix + iw, iy + ih);
      ctx.lineTo(ix, iy + ih);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ARENA': {
      // 타원 링 (콜로세움)
      ctx.beginPath();
      ctx.ellipse(cx, cy + ih * 0.1, iw * 0.4, ih * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy + ih * 0.1, iw * 0.4, ih * 0.3, 0, Math.PI * 0.8, Math.PI * 0.2);
      ctx.stroke();
      ctx.lineWidth = 2;
      break;
    }
    case 'BRIDGE': {
      // 두 타워 + 케이블
      ctx.fillRect(cx - iw * 0.35, iy + ih * 0.2, iw * 0.08, ih * 0.8);
      ctx.fillRect(cx + iw * 0.27, iy + ih * 0.2, iw * 0.08, ih * 0.8);
      // 케이블 (곡선)
      ctx.beginPath();
      ctx.moveTo(cx - iw * 0.31, iy + ih * 0.2);
      ctx.quadraticCurveTo(cx, iy + ih * 0.55, cx + iw * 0.31, iy + ih * 0.2);
      ctx.stroke();
      // 도로
      ctx.fillRect(cx - iw * 0.45, iy + ih * 0.7, iw * 0.9, ih * 0.06);
      break;
    }
    case 'PAGODA': {
      // 적층 박스 (파고다)
      const tiers = 3;
      for (let t = 0; t < tiers; t++) {
        const tw = iw * (0.5 - t * 0.1);
        const th = ih * 0.2;
        const tx = cx - tw / 2;
        const ty = iy + ih - (t + 1) * th;
        ctx.fillRect(tx, ty, tw, th - 2);
        // 지붕
        ctx.beginPath();
        ctx.moveTo(tx - iw * 0.05, ty);
        ctx.lineTo(cx, ty - ih * 0.06);
        ctx.lineTo(tx + tw + iw * 0.05, ty);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'SHELLS': {
      // 오페라하우스 돛 모양
      for (let s = 0; s < 3; s++) {
        const sx = cx - iw * 0.15 + s * iw * 0.15;
        ctx.beginPath();
        ctx.moveTo(sx, iy + ih * 0.9);
        ctx.quadraticCurveTo(sx + iw * 0.05, iy + ih * 0.1, sx + iw * 0.2, iy + ih * 0.9);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'ONION_DOME': {
      // 양파돔 (성 바실리)
      const domes = [0, -0.2, 0.2];
      for (const dx of domes) {
        const ddx = cx + dx * iw;
        ctx.beginPath();
        ctx.moveTo(ddx - iw * 0.1, iy + ih * 0.5);
        ctx.quadraticCurveTo(ddx - iw * 0.15, iy + ih * 0.2, ddx, iy + ih * 0.1);
        ctx.quadraticCurveTo(ddx + iw * 0.15, iy + ih * 0.2, ddx + iw * 0.1, iy + ih * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      // 베이스
      ctx.fillRect(cx - iw * 0.35, iy + ih * 0.5, iw * 0.7, ih * 0.5);
      break;
    }
    case 'MOUNTAIN': {
      // 산 (삼각형 + 흰 캡)
      ctx.beginPath();
      ctx.moveTo(ix, iy + ih);
      ctx.lineTo(cx, iy + ih * 0.1);
      ctx.lineTo(ix + iw, iy + ih);
      ctx.closePath();
      ctx.fill();
      // 흰 눈 캡
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(cx - iw * 0.12, iy + ih * 0.3);
      ctx.lineTo(cx, iy + ih * 0.1);
      ctx.lineTo(cx + iw * 0.12, iy + ih * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      // 기본: 다이아몬드 형태
      ctx.beginPath();
      ctx.moveTo(cx, iy);
      ctx.lineTo(cx + iw * 0.35, cy);
      ctx.lineTo(cx, iy + ih);
      ctx.lineTo(cx - iw * 0.35, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ─── Atlas Generation ───

function createSpriteAtlas(landmarks: Landmark[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  // 검은 배경 (투명하면 블렌딩 이슈)
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  for (let i = 0; i < landmarks.length && i < ATLAS_COLS * ATLAS_ROWS; i++) {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const x = col * SLOT_W;
    const y = row * SLOT_H;

    drawLandmarkIcon(ctx, landmarks[i], x, y, SLOT_W, SLOT_H);
  }

  return canvas;
}

// ─── Shader ───

const spriteVertexShader = /* glsl */ `
  attribute vec2 uvOffset;
  attribute float alphaVal;
  varying vec2 vUv;
  varying float vAlpha;
  uniform vec2 slotSize;

  void main() {
    // UV: 슬롯 오프셋 + 슬롯 내 위치
    vUv = uvOffset + uv * slotSize;
    vAlpha = alphaVal;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const spriteFragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec4 texColor = texture2D(uAtlas, vUv);

    // 매우 투명한 영역 discard
    if (texColor.a < 0.02 && length(texColor.rgb) < 0.05) discard;

    // 글로우 효과: 밝기 부스트
    vec3 color = texColor.rgb * 1.3;

    float alpha = max(texColor.a, step(0.05, length(texColor.rgb))) * vAlpha;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Component ───

export function LandmarkSprites({
  landmarks,
  globeRadius = 100,
  maxSprites = 15,
}: LandmarkSpritesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { camera } = useThree();

  // 아틀라스 텍스처 (1회 생성)
  const { atlasTexture, atlasCanvas } = useMemo(() => {
    const canvas = createSpriteAtlas(LANDMARKS);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.flipY = false; // canvas y=0(상단) → UV y=0(상단)
    return { atlasTexture: tex, atlasCanvas: canvas };
  }, []);

  // per-instance UV offset 버퍼 (랜드마크 id → 아틀라스 슬롯)
  const uvOffsetBuf = useMemo(() => new Float32Array(MAX_SPRITES * 2), []);
  // per-instance alpha
  const alphaBuf = useMemo(() => new Float32Array(MAX_SPRITES).fill(1), []);

  // 좌표 캐시: 각 랜드마크의 3D 위치 + 법선
  const positionCache = useMemo(() => {
    const r = globeRadius + SURFACE_ALT;
    return LANDMARKS.map(lm => {
      const pos = latLngToVector3(lm.lat, lm.lng, r);
      const normal = pos.clone().normalize();
      return { pos, normal, id: lm.id, tier: lm.tier };
    });
  }, [globeRadius]);

  // Geometry + Material
  const geometry = useMemo(() => new THREE.PlaneGeometry(SPRITE_SIZE, SPRITE_SIZE), []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlasTexture },
      slotSize: { value: new THREE.Vector2(1 / ATLAS_COLS, 1 / ATLAS_ROWS) },
    },
    vertexShader: spriteVertexShader,
    fragmentShader: spriteFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [atlasTexture]);

  // 정리
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      atlasTexture.dispose();
    };
  }, [geometry, material, atlasTexture]);

  // ─── useFrame: 위치 + billboard + backface culling ───
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || landmarks.length === 0) return;

    // lazy init: per-instance 어트리뷰트
    if (!mesh.geometry.getAttribute('uvOffset')) {
      mesh.geometry.setAttribute('uvOffset',
        new THREE.InstancedBufferAttribute(uvOffsetBuf, 2));
      mesh.geometry.setAttribute('alphaVal',
        new THREE.InstancedBufferAttribute(alphaBuf, 1));
    }

    _camDir.copy(camera.position).normalize();
    const camDist = camera.position.length();

    // 거리 기반 스케일: 멀수록 약간 작게 (300→1.2x, 500→0.7x)
    const distT = THREE.MathUtils.clamp((camDist - 250) / 250, 0, 1);
    const baseScale = THREE.MathUtils.lerp(1.4, 0.8, distT);

    let idx = 0;
    const limit = Math.min(maxSprites, landmarks.length);

    for (let i = 0; i < landmarks.length && idx < limit; i++) {
      const lm = landmarks[i];
      // 인덱스는 원본 LANDMARKS 배열에서의 위치 (0-based)
      const cacheIdx = lm.id - 1;
      const cached = positionCache[cacheIdx];
      if (!cached) continue;

      // Backface culling
      const dot = cached.normal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) continue;

      // dot 기반 alpha fade (0.05~0.35 구간)
      const dotFade = THREE.MathUtils.clamp(
        (dot - BACKFACE_THRESHOLD) / BACKFACE_FADE_RANGE, 0, 1,
      );

      // Billboard: 카메라 quaternion 복사
      _obj.position.copy(cached.pos);
      _obj.quaternion.copy(camera.quaternion);

      const scale = baseScale * dotFade;
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      mesh.setMatrixAt(idx, _obj.matrix);

      // UV offset: 랜드마크 id → 아틀라스 슬롯 (0-based index)
      const slotIdx = lm.id - 1;
      const col = slotIdx % ATLAS_COLS;
      const row = Math.floor(slotIdx / ATLAS_COLS);
      uvOffsetBuf[idx * 2] = col / ATLAS_COLS;
      uvOffsetBuf[idx * 2 + 1] = row / ATLAS_ROWS;

      // Alpha
      alphaBuf[idx] = dotFade;

      idx++;
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;

    const uvAttr = mesh.geometry.getAttribute('uvOffset') as THREE.InstancedBufferAttribute;
    const alphaAttr = mesh.geometry.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;
    if (uvAttr) uvAttr.needsUpdate = true;
    if (alphaAttr) alphaAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_SPRITES]}
      frustumCulled={false}
      renderOrder={98}
    />
  );
}
